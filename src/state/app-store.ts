import { accountService } from '../services/account-service';
import { decodeBase64 } from '../core/vault/base64';
import { decryptVault, encryptVault } from '../core/vault/crypto';
import {
  clearEncryptedVault,
  createChromeVaultStorageAdapter,
  createMemoryVaultStorageAdapter,
  loadEncryptedVault,
  saveEncryptedVault,
  type VaultStorageAdapter
} from '../core/vault/vault-store';
import { deriveAesKey } from '../core/vault/password';
import {
  getSessionState,
  lockSession,
  subscribeSession,
  type SessionSnapshot,
  unlockSession
} from './session-store';
import {
  isProtectedRoute,
  readRoute,
  routesEqual,
  writeRoute,
  type PopupRoute
} from '../popup/routes';

export interface AppSnapshot {
  isReady: boolean;
  route: PopupRoute;
  session: SessionSnapshot;
  selectedAccountId: string | null;
  unlockError: string | null;
}

type AppListener = (snapshot: AppSnapshot) => void;

const listeners = new Set<AppListener>();
const vaultStorage = createVaultStorage();

let hasStoredVault = false;
let hashListenerAttached = false;
let initializePromise: Promise<void> | null = null;
let currentMasterPassword: string | null = null;
let persistVaultPromise: Promise<void> = Promise.resolve();
let appState = createAppState();

subscribeSession((session) => {
  if (!session.isUnlocked) {
    currentMasterPassword = null;
  }

  const nextRoute = resolveRouteForSession(appState.route, session, hasStoredVault);
  appState = {
    ...appState,
    session,
    route: nextRoute,
    selectedAccountId: getSelectedAccountId(nextRoute)
  };
  syncHash(nextRoute);
  emit();
});

accountService.subscribe(() => {
  if (!appState.session.isUnlocked || !currentMasterPassword || !hasStoredVault) {
    return;
  }

  persistVaultPromise = persistVaultPromise
    .catch(() => undefined)
    .then(async () => {
      if (!appState.session.isUnlocked || !currentMasterPassword || !hasStoredVault) {
        return;
      }

      const accounts = await accountService.listAccounts();
      const encryptedVault = await encryptVault({ version: 1, accounts }, currentMasterPassword);
      await saveEncryptedVault(encryptedVault, vaultStorage);
    });
});

export function getAppState(): AppSnapshot {
  return appState;
}

export function subscribeApp(listener: AppListener): () => void {
  listeners.add(listener);
  listener(appState);

  return () => {
    listeners.delete(listener);
  };
}

export async function initializeApp() {
  attachHashListener();

  if (initializePromise) {
    return initializePromise;
  }

  initializePromise = (async () => {
    hasStoredVault = await detectStoredVaultPresence();
    const route = resolveRouteForSession(readRoute(), appState.session, hasStoredVault);

    appState = {
      ...appState,
      isReady: true,
      route,
      selectedAccountId: getSelectedAccountId(route),
      unlockError: null
    };
    syncHash(route);
    emit();
  })().finally(() => {
    initializePromise = null;
  });

  return initializePromise;
}

export function navigate(route: PopupRoute) {
  const nextRoute = resolveRouteForSession(route, appState.session, hasStoredVault);

  appState = {
    ...appState,
    route: nextRoute,
    selectedAccountId: getSelectedAccountId(nextRoute)
  };
  syncHash(nextRoute);
  emit();
}

export async function submitUnlock(password: string) {
  appState = {
    ...appState,
    unlockError: null
  };
  emit();

  try {
    if (hasStoredVault) {
      const storedVault = await loadEncryptedVault(vaultStorage);

      if (!storedVault) {
        hasStoredVault = false;
        const fallbackRoute = resolveRouteForSession(readRoute(), appState.session, false);
        appState = {
          ...appState,
          route: fallbackRoute,
          selectedAccountId: getSelectedAccountId(fallbackRoute)
        };
        syncHash(fallbackRoute);
        emit();
        return;
      }

      const decryptedVault = await decryptVault(storedVault, password);
      await accountService.replaceAllAccounts(decryptedVault.accounts);
      currentMasterPassword = password;
      const keyMaterial = await deriveAesKey(password, decodeBase64(storedVault.salt));
      unlockSession(keyMaterial);
      return;
    }

    const accounts = await accountService.listAccounts();
    const encryptedVault = await encryptVault({ version: 1, accounts }, password);
    await saveEncryptedVault(encryptedVault, vaultStorage);
    hasStoredVault = true;
    currentMasterPassword = password;

    const keyMaterial = await deriveAesKey(password, decodeBase64(encryptedVault.salt));
    unlockSession(keyMaterial);
  } catch (error) {
    appState = {
      ...appState,
      unlockError: error instanceof Error ? error.message : 'Unable to unlock vault.'
    };
    emit();
  }
}

export async function __resetForTests() {
  if (hashListenerAttached) {
    window.removeEventListener('hashchange', handleHashChange);
    hashListenerAttached = false;
  }

  initializePromise = null;
  hasStoredVault = false;
  currentMasterPassword = null;
  persistVaultPromise = Promise.resolve();
  await clearEncryptedVault(vaultStorage);
  accountService.__resetForTests?.();
  lockSession();
  appState = createAppState();
  emit();
}

export async function __seedStoredVaultForTests(password = 'very-secure-password') {
  const accounts = await accountService.listAccounts();
  const encryptedVault = await encryptVault({ version: 1, accounts }, password);
  await saveEncryptedVault(encryptedVault, vaultStorage);
  hasStoredVault = true;
}

export async function __readStoredVaultForTests(password = 'very-secure-password') {
  const storedVault = await loadEncryptedVault(vaultStorage);

  if (!storedVault) {
    return null;
  }

  return decryptVault(storedVault, password);
}

export async function __corruptStoredVaultForTests() {
  await vaultStorage.area.set({ vault: { broken: true } });
  hasStoredVault = true;
}

function attachHashListener() {
  if (hashListenerAttached) {
    return;
  }

  window.addEventListener('hashchange', handleHashChange);
  hashListenerAttached = true;
}

function handleHashChange() {
  const nextRoute = resolveRouteForSession(readRoute(), appState.session, hasStoredVault);

  appState = {
    ...appState,
    route: nextRoute,
    selectedAccountId: getSelectedAccountId(nextRoute)
  };
  syncHash(nextRoute);
  emit();
}

async function detectStoredVaultPresence() {
  const result = await vaultStorage.area.get(['vault']);
  return 'vault' in result && result.vault != null;
}

function syncHash(route: PopupRoute) {
  if (!routesEqual(readRoute(), route)) {
    writeRoute(route);
  }
}

function createAppState() {
  const route = readRoute();
  const session = getSessionState();

  return {
    isReady: false,
    route,
    session,
    selectedAccountId: getSelectedAccountId(route),
    unlockError: null
  } satisfies AppSnapshot;
}

function resolveRouteForSession(
  route: PopupRoute,
  session: SessionSnapshot,
  storedVaultAvailable: boolean
): PopupRoute {
  const unlockRoute: PopupRoute = { name: storedVaultAvailable ? 'unlock' : 'setup' };

  if (!session.isUnlocked) {
    if (route.name === 'setup' || route.name === 'unlock') {
      return unlockRoute;
    }

    if (isProtectedRoute(route)) {
      return unlockRoute;
    }

    return route;
  }

  if (route.name === 'setup' || route.name === 'unlock') {
    return { name: 'accounts' };
  }

  return route;
}

function getSelectedAccountId(route: PopupRoute) {
  return route.name === 'detail' ? route.accountId : null;
}

function emit() {
  for (const listener of listeners) {
    listener(appState);
  }
}

function createVaultStorage(): VaultStorageAdapter {
  try {
    return createChromeVaultStorageAdapter();
  } catch {
    return createMemoryVaultStorageAdapter();
  }
}
