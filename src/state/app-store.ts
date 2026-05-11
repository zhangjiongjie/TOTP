import { accountService } from '../services/account-service';
import { createSyncService } from '../services/sync-service';
import { decodeBase64 } from '../core/vault/base64';
import { decryptVault, encryptVault, type EncryptedVaultBlob } from '../core/vault/crypto';
import {
  createFetchWebDavClient,
  type WebDavClient,
  type WebDavProfile
} from '../core/sync/webdav-client';
import {
  clearEncryptedVault,
  createChromeVaultStorageAdapter,
  createMemoryVaultStorageAdapter,
  loadEncryptedVault,
  saveEncryptedVault,
  type VaultStorageAdapter
} from '../core/vault/vault-store';
import { deriveAesKey } from '../core/vault/password';
import type { SyncRunResult } from '../core/sync/sync-engine';
import {
  createChromeSyncMetadataStore,
  createMemorySyncMetadataStore,
  type SyncMetadata,
  type SyncMetadataSnapshot,
  type SyncMetadataStore
} from './sync-store';
import {
  getSessionState,
  lockSession,
  subscribeSession,
  type SessionSnapshot,
  unlockSession
} from './session-store';
import {
  clearCurrentMasterPassword,
  getCurrentMasterPassword,
  setCurrentMasterPassword
} from './master-password-store';
import { securityPreferencesStore, sessionCredentialsStore } from './security-store';
import {
  isProtectedRoute,
  readRoute,
  routesEqual,
  writeRoute,
  type PopupRoute
} from '../popup/routes';

export interface AppSyncSnapshot {
  phase: 'idle' | 'syncing';
  trigger: 'manual' | 'automatic' | null;
  lastResultStatus: SyncRunResult['status'] | null;
  lastError: string | null;
}

export interface AppSnapshot {
  isReady: boolean;
  route: PopupRoute;
  session: SessionSnapshot;
  selectedAccountId: string | null;
  unlockError: string | null;
  sync: AppSyncSnapshot;
}

type AppListener = (snapshot: AppSnapshot) => void;

const listeners = new Set<AppListener>();
const vaultStorage = createVaultStorage();
const syncStore = createSyncStore();

let hasStoredVault = false;
let hashListenerAttached = false;
let initializePromise: Promise<void> | null = null;
let persistVaultPromise: Promise<void> = Promise.resolve();
let autoSyncQueue: Promise<SyncRunResult | null> = Promise.resolve(null);
let autoSyncTimerId: ReturnType<typeof globalThis.setInterval> | null = null;
let autoSyncGeneration = 0;
let pendingAutoSyncRuns = 0;
let isApplyingRemoteSyncUpdate = false;
let syncClientOverride: WebDavClient | null = null;
let localMutationVersion = 0;
let appState = createAppState();

subscribeSession((session) => {
  if (!session.isUnlocked) {
    clearCurrentMasterPassword();
    stopAutomaticSync();
  } else if (hasStoredVault) {
    void refreshAutomaticSync();
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
  const currentMasterPassword = getCurrentMasterPassword();

  if (
    !appState.session.isUnlocked ||
    !currentMasterPassword ||
    !hasStoredVault ||
    isApplyingRemoteSyncUpdate
  ) {
    return;
  }

  localMutationVersion += 1;

  persistVaultPromise = persistVaultPromise
    .catch(() => undefined)
    .then(async () => {
      const nextMasterPassword = getCurrentMasterPassword();

      if (!appState.session.isUnlocked || !nextMasterPassword || !hasStoredVault) {
        return;
      }

      const accounts = await accountService.listAccounts();
      const encryptedVault = await encryptVault({ version: 1, accounts }, nextMasterPassword);
      await saveEncryptedVault(encryptedVault, vaultStorage);
      queueLocalSync();
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
    await restoreRememberedSessionIfPossible();
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
      setCurrentMasterPassword(password);
      const keyMaterial = await deriveAesKey(password, decodeBase64(storedVault.salt));
      unlockSession(keyMaterial);
      await syncRememberedSessionPreference(password);
      return;
    }

    const accounts = await accountService.listAccounts();
    const encryptedVault = await encryptVault({ version: 1, accounts }, password);
    await saveEncryptedVault(encryptedVault, vaultStorage);
    hasStoredVault = true;
    setCurrentMasterPassword(password);

    const keyMaterial = await deriveAesKey(password, decodeBase64(encryptedVault.salt));
    unlockSession(keyMaterial);
    await syncRememberedSessionPreference(password);
  } catch (error) {
    await sessionCredentialsStore.clear();
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
  clearCurrentMasterPassword();
  persistVaultPromise = Promise.resolve();
  autoSyncQueue = Promise.resolve(null);
  syncClientOverride = null;
  localMutationVersion = 0;
  pendingAutoSyncRuns = 0;
  stopAutomaticSync();
  await clearEncryptedVault(vaultStorage);
  await clearSyncMetadata();
  await sessionCredentialsStore.clear();
  await securityPreferencesStore.save({
    rememberSessionUntilBrowserRestart: true
  });
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

export async function __saveSyncProfileForTests(profile: WebDavProfile) {
  await syncStore.save({ profile });
}

export async function __readSyncMetadataForTests(): Promise<SyncMetadataSnapshot> {
  return syncStore.load();
}

export function __setSyncClientForTests(client: WebDavClient | null) {
  syncClientOverride = client;
}

export async function __runAutomaticSyncNowForTests() {
  await runAutomaticSyncNow(autoSyncGeneration || 1);
}

export async function runManualSyncFromAppState(): Promise<SyncRunResult> {
  const queueBeforeFlush = autoSyncQueue;
  await flushPendingLocalVaultWrites();
  const queueAfterFlush = autoSyncQueue;
  const hadPendingAutoSync = pendingAutoSyncRuns > 0;
  const settledAutoSync = await queueAfterFlush.catch(() => null);

  if ((queueAfterFlush !== queueBeforeFlush || hadPendingAutoSync) && settledAutoSync) {
    return settledAutoSync;
  }

  return runSyncWithSharedState();
}

export async function refreshAutomaticSync() {
  stopAutomaticSync();

  if (!hasStoredVault || !getSessionState().isUnlocked) {
    return;
  }

  const profile = await loadEnabledSyncProfile();

  if (!profile) {
    return;
  }

  const generation = ++autoSyncGeneration;
  const intervalMs = normalizeSyncInterval(profile.syncIntervalMs);

  autoSyncTimerId = globalThis.setInterval(() => {
    void runAutomaticSyncNow(generation);
  }, intervalMs);

  await runAutomaticSyncNow(generation);
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

async function restoreRememberedSessionIfPossible() {
  if (!hasStoredVault || getSessionState().isUnlocked) {
    return;
  }

  const preferences = await securityPreferencesStore.load();
  if (!preferences.rememberSessionUntilBrowserRestart) {
    await sessionCredentialsStore.clear();
    return;
  }

  const { masterPassword } = await sessionCredentialsStore.load();
  if (!masterPassword) {
    return;
  }

  try {
    const storedVault = await loadEncryptedVault(vaultStorage);
    if (!storedVault) {
      await sessionCredentialsStore.clear();
      return;
    }

    const decryptedVault = await decryptVault(storedVault, masterPassword);
    await accountService.replaceAllAccounts(decryptedVault.accounts);
    setCurrentMasterPassword(masterPassword);
    const keyMaterial = await deriveAesKey(masterPassword, decodeBase64(storedVault.salt));
    unlockSession(keyMaterial);
  } catch {
    clearCurrentMasterPassword();
    await sessionCredentialsStore.clear();
  }
}

async function syncRememberedSessionPreference(password: string) {
  const preferences = await securityPreferencesStore.load();

  if (!preferences.rememberSessionUntilBrowserRestart) {
    await sessionCredentialsStore.clear();
    return;
  }

  await sessionCredentialsStore.save({ masterPassword: password });
}

function syncHash(route: PopupRoute) {
  if (!routesEqual(readRoute(), route)) {
    writeRoute(route);
  }
}

function createAppState(): AppSnapshot {
  const route = readRoute();
  const session = getSessionState();

  return {
    isReady: false,
    route,
    session,
    selectedAccountId: getSelectedAccountId(route),
    unlockError: null,
    sync: {
      phase: 'idle',
      trigger: null,
      lastResultStatus: null,
      lastError: null
    }
  } satisfies AppSnapshot;
}

function beginSyncActivity(trigger: 'manual' | 'automatic') {
  appState = {
    ...appState,
    sync: {
      ...appState.sync,
      phase: 'syncing',
      trigger,
      lastError: null
    }
  };
  emit();
}

function completeSyncActivity() {
  if (pendingAutoSyncRuns > 0) {
    return;
  }

  appState = {
    ...appState,
    sync: {
      ...appState.sync,
      phase: 'idle',
      trigger: null
    }
  };
  emit();
}

function setSyncResult(result: SyncRunResult) {
  appState = {
    ...appState,
    sync: {
      ...appState.sync,
      lastResultStatus: result.status,
      lastError: result.error?.message ?? null
    }
  };
  emit();
}

function setSyncError(message: string) {
  appState = {
    ...appState,
    sync: {
      ...appState.sync,
      lastError: message
    }
  };
  emit();
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

function createSyncStore(): SyncMetadataStore {
  try {
    return createChromeSyncMetadataStore();
  } catch {
    return createMemorySyncMetadataStore();
  }
}

function stopAutomaticSync() {
  autoSyncGeneration += 1;

  if (autoSyncTimerId !== null) {
    globalThis.clearInterval(autoSyncTimerId);
    autoSyncTimerId = null;
  }
}

function queueLocalSync() {
  if (isApplyingRemoteSyncUpdate) {
    return;
  }

  void runAutomaticSyncNow(autoSyncGeneration);
}

async function flushPendingLocalVaultWrites() {
  await persistVaultPromise.catch(() => undefined);
}

async function runAutomaticSyncNow(generation: number) {
  pendingAutoSyncRuns += 1;
  beginSyncActivity('automatic');
  autoSyncQueue = autoSyncQueue
    .catch(() => null)
    .then(async () => {
      try {
        if (generation !== autoSyncGeneration || !hasStoredVault || !getSessionState().isUnlocked) {
          return null;
        }

        const startedMutationVersion = localMutationVersion;
        const result = await executeSyncForCurrentProfile();

        if (generation !== autoSyncGeneration || !getSessionState().isUnlocked) {
          return null;
        }

        if (
          result.status === 'pulled' &&
          localMutationVersion !== startedMutationVersion
        ) {
          await restoreLatestAccountsToLocalVault();
          return runSyncWithSharedState();
        }

        await applyRemoteAccountsIfNeeded(
          result.localVault,
          result.status,
          result.merged === true
        );
        setSyncResult(result);

        return result;
      } finally {
        pendingAutoSyncRuns = Math.max(0, pendingAutoSyncRuns - 1);
        completeSyncActivity();
      }
    });

  await autoSyncQueue;
}

async function runSyncWithSharedState() {
  beginSyncActivity('manual');

  try {
    const result = await executeSyncForCurrentProfile();

    await applyRemoteAccountsIfNeeded(
      result.localVault,
      result.status,
      result.merged === true
    );
    setSyncResult(result);

    return result;
  } catch (error) {
    setSyncError(error instanceof Error ? error.message : '同步失败，请稍后重试。');
    throw error;
  } finally {
    completeSyncActivity();
  }
}

async function executeSyncForCurrentProfile() {
  const metadata = await syncStore.load();
  const service = createSyncService({
    profile: metadata.profile,
    client: getSyncClient(),
    vaultStorage,
    syncStore
  });

  return service.manualSync();
}

async function applyRemoteAccountsIfNeeded(
  localVault: EncryptedVaultBlob | null,
  status: string,
  merged = false
) {
  const masterPassword = getCurrentMasterPassword();

  if ((!merged && status !== 'pulled') || !localVault || !masterPassword) {
    return;
  }

  const decryptedVault = await decryptVault(localVault, masterPassword);
  isApplyingRemoteSyncUpdate = true;

  try {
    await accountService.replaceAllAccounts(decryptedVault.accounts);
  } finally {
    isApplyingRemoteSyncUpdate = false;
  }
}

async function restoreLatestAccountsToLocalVault() {
  const masterPassword = getCurrentMasterPassword();

  if (!masterPassword || !hasStoredVault) {
    return;
  }

  const accounts = await accountService.listAccounts();
  const encryptedVault = await encryptVault({ version: 1, accounts }, masterPassword);
  await saveEncryptedVault(encryptedVault, vaultStorage);
}

async function loadEnabledSyncProfile(): Promise<WebDavProfile | null> {
  const metadata = await syncStore.load();
  return metadata.profile?.enabled ? metadata.profile : null;
}

function getSyncClient(): WebDavClient {
  return syncClientOverride ?? createFetchWebDavClient();
}

function normalizeSyncInterval(value: number | undefined) {
  return Math.max(60_000, value ?? 300_000);
}

async function clearSyncMetadata() {
  const cleared: SyncMetadata = {
    profile: null,
    baseRevision: null,
    baseFingerprint: null,
    baseVault: null,
    localRevision: null,
    localFingerprint: null,
    localUpdatedAt: null,
    remoteRevision: null,
    remoteUpdatedAt: null,
    remoteEtag: null,
    lastSyncedAt: null,
    lastPulledAt: null,
    lastPushedAt: null,
    lastStatus: null,
    lastError: null,
    pendingConflict: null
  };

  await syncStore.replace(cleared);
}
