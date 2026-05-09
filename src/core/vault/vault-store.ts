import type { EncryptedVaultBlob } from './crypto';

const VAULT_STORAGE_KEY = 'vault';
const inMemoryStorage = new Map<string, unknown>();

interface StorageAreaLike {
  get(keys?: string | string[] | Record<string, unknown> | null): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
}

export async function loadEncryptedVault(): Promise<EncryptedVaultBlob | null> {
  const result = await getStorageArea().get([VAULT_STORAGE_KEY]);

  return (result[VAULT_STORAGE_KEY] as EncryptedVaultBlob | null | undefined) ?? null;
}

export async function saveEncryptedVault(vault: EncryptedVaultBlob): Promise<void> {
  await getStorageArea().set({ [VAULT_STORAGE_KEY]: vault });
}

export async function clearEncryptedVault(): Promise<void> {
  await getStorageArea().remove(VAULT_STORAGE_KEY);
}

function getStorageArea(): StorageAreaLike {
  const extensionStorage = (
    globalThis as typeof globalThis & {
      chrome?: { storage?: { local?: StorageAreaLike } };
    }
  ).chrome?.storage?.local;

  if (extensionStorage) {
    return extensionStorage as StorageAreaLike;
  }

  return {
    async get(keys) {
      const requestedKeys = normalizeRequestedKeys(keys);

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
  };
}

function normalizeRequestedKeys(
  keys?: string | string[] | Record<string, unknown> | null
): string[] {
  if (!keys) {
    return [...inMemoryStorage.keys()];
  }

  if (typeof keys === 'string') {
    return [keys];
  }

  if (Array.isArray(keys)) {
    return keys;
  }

  return Object.keys(keys);
}
