import { isEncryptedVaultBlob, type EncryptedVaultBlob } from './crypto';
import { VaultIntegrityError, VaultStorageUnavailableError } from './errors';

const VAULT_STORAGE_KEY = 'vault';

export interface StorageAreaLike {
  get(keys?: string | string[] | Record<string, unknown> | null): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
}

export interface VaultStorageAdapter {
  kind: 'chrome' | 'memory';
  area: StorageAreaLike;
}

export async function loadEncryptedVault(
  adapter: VaultStorageAdapter = createChromeVaultStorageAdapter()
): Promise<EncryptedVaultBlob | null> {
  const result = await adapter.area.get([VAULT_STORAGE_KEY]);
  const storedValue = result[VAULT_STORAGE_KEY];

  if (storedValue == null) {
    return null;
  }

  if (!isEncryptedVaultBlob(storedValue)) {
    throw new VaultIntegrityError('Stored vault payload is invalid');
  }

  return storedValue;
}

export async function saveEncryptedVault(
  vault: EncryptedVaultBlob,
  adapter: VaultStorageAdapter = createChromeVaultStorageAdapter()
): Promise<void> {
  await adapter.area.set({ [VAULT_STORAGE_KEY]: vault });
}

export async function clearEncryptedVault(
  adapter: VaultStorageAdapter = createChromeVaultStorageAdapter()
): Promise<void> {
  await adapter.area.remove(VAULT_STORAGE_KEY);
}

export function createChromeVaultStorageAdapter(): VaultStorageAdapter {
  const extensionStorage = (
    globalThis as typeof globalThis & {
      chrome?: { storage?: { local?: StorageAreaLike } };
    }
  ).chrome?.storage?.local;

  if (!extensionStorage) {
    throw new VaultStorageUnavailableError('chrome.storage.local is unavailable');
  }

  return {
    kind: 'chrome',
    area: extensionStorage
  };
}

export function createMemoryVaultStorageAdapter(): VaultStorageAdapter {
  const inMemoryStorage = new Map<string, unknown>();

  return {
    kind: 'memory',
    area: {
      async get(keys) {
      const requestedKeys = normalizeRequestedKeys(keys, inMemoryStorage);

      return Object.fromEntries(
        requestedKeys
          .filter((key) => inMemoryStorage.has(key))
          .map((key) => [key, inMemoryStorage.get(key)])
      );
      },
      async set(items) {
        for (const [key, value] of Object.entries(items)) {
          inMemoryStorage.set(key, value);
        }
      },
      async remove(keys) {
        for (const key of Array.isArray(keys) ? keys : [keys]) {
          inMemoryStorage.delete(key);
        }
      }
    }
  };
}

function normalizeRequestedKeys(
  keys: string | string[] | Record<string, unknown> | null | undefined,
  storage: Map<string, unknown>
): string[] {
  if (!keys) {
    return [...storage.keys()];
  }

  if (typeof keys === 'string') {
    return [keys];
  }

  if (Array.isArray(keys)) {
    return keys;
  }

  return Object.keys(keys);
}
