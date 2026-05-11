import type { StorageAreaLike } from '../core/vault/vault-store';

const SECURITY_PREFERENCES_KEY = 'securityPreferences';
const SESSION_CREDENTIALS_KEY = 'sessionCredentials';

export interface SecurityPreferences {
  rememberSessionUntilBrowserRestart: boolean;
}

interface SessionCredentials {
  masterPassword: string | null;
}

export interface SecurityPreferencesStore {
  load(): Promise<SecurityPreferences>;
  save(patch: Partial<SecurityPreferences>): Promise<SecurityPreferences>;
}

export interface SessionCredentialsStore {
  load(): Promise<SessionCredentials>;
  save(credentials: SessionCredentials): Promise<SessionCredentials>;
  clear(): Promise<void>;
}

const defaultSecurityPreferences: SecurityPreferences = {
  rememberSessionUntilBrowserRestart: true
};

export const securityPreferencesStore = createSecurityPreferencesStore();
export const sessionCredentialsStore = createSessionCredentialsStore();

function createSecurityPreferencesStore(): SecurityPreferencesStore {
  try {
    const storage = getChromeLocalStorage();
    return createPersistedSecurityPreferencesStore(storage);
  } catch {
    return createMemorySecurityPreferencesStore();
  }
}

function createSessionCredentialsStore(): SessionCredentialsStore {
  try {
    const storage = getChromeSessionStorage();
    return createPersistedSessionCredentialsStore(storage);
  } catch {
    return createMemorySessionCredentialsStore();
  }
}

function createPersistedSecurityPreferencesStore(
  storage: StorageAreaLike
): SecurityPreferencesStore {
  return {
    async load() {
      const result = await storage.get([SECURITY_PREFERENCES_KEY]);
      return normalizeSecurityPreferences(result[SECURITY_PREFERENCES_KEY]);
    },
    async save(patch) {
      const current = await this.load();
      const next = normalizeSecurityPreferences({ ...current, ...patch });
      await storage.set({ [SECURITY_PREFERENCES_KEY]: next });
      return next;
    }
  };
}

function createPersistedSessionCredentialsStore(
  storage: StorageAreaLike
): SessionCredentialsStore {
  return {
    async load() {
      const result = await storage.get([SESSION_CREDENTIALS_KEY]);
      return normalizeSessionCredentials(result[SESSION_CREDENTIALS_KEY]);
    },
    async save(credentials) {
      const next = normalizeSessionCredentials(credentials);
      await storage.set({ [SESSION_CREDENTIALS_KEY]: next });
      return next;
    },
    async clear() {
      await storage.remove(SESSION_CREDENTIALS_KEY);
    }
  };
}

function createMemorySecurityPreferencesStore(): SecurityPreferencesStore {
  let state = { ...defaultSecurityPreferences };

  return {
    async load() {
      return { ...state };
    },
    async save(patch) {
      state = normalizeSecurityPreferences({ ...state, ...patch });
      return { ...state };
    }
  };
}

function createMemorySessionCredentialsStore(): SessionCredentialsStore {
  let state: SessionCredentials = { masterPassword: null };

  return {
    async load() {
      return { ...state };
    },
    async save(credentials) {
      state = normalizeSessionCredentials(credentials);
      return { ...state };
    },
    async clear() {
      state = { masterPassword: null };
    }
  };
}

function normalizeSecurityPreferences(value: unknown): SecurityPreferences {
  if (typeof value !== 'object' || value === null) {
    return { ...defaultSecurityPreferences };
  }

  const record = value as Partial<SecurityPreferences>;

  return {
    rememberSessionUntilBrowserRestart:
      typeof record.rememberSessionUntilBrowserRestart === 'boolean'
        ? record.rememberSessionUntilBrowserRestart
        : defaultSecurityPreferences.rememberSessionUntilBrowserRestart
  };
}

function normalizeSessionCredentials(value: unknown): SessionCredentials {
  if (typeof value !== 'object' || value === null) {
    return { masterPassword: null };
  }

  const record = value as Partial<SessionCredentials>;

  return {
    masterPassword: typeof record.masterPassword === 'string' ? record.masterPassword : null
  };
}

function getChromeLocalStorage(): StorageAreaLike {
  const storage = (
    globalThis as typeof globalThis & {
      chrome?: { storage?: { local?: StorageAreaLike } };
    }
  ).chrome?.storage?.local;

  if (!storage) {
    throw new Error('chrome.storage.local is unavailable');
  }

  return storage;
}

function getChromeSessionStorage(): StorageAreaLike {
  const storage = (
    globalThis as typeof globalThis & {
      chrome?: { storage?: { session?: StorageAreaLike } };
    }
  ).chrome?.storage?.session;

  if (!storage) {
    throw new Error('chrome.storage.session is unavailable');
  }

  return storage;
}
