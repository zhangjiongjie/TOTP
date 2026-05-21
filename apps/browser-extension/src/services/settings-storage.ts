import {
  createChromeVaultStorageAdapter,
  createMemoryVaultStorageAdapter
} from '@totp/core';
import {
  createChromeSyncMetadataStore,
  createMemorySyncMetadataStore
} from '@totp/sync';
import { createFetchWebDavClient } from '@totp/sync';

export const syncStore = createSyncStore();
export const vaultStorage = createVaultStorage();
export const webDavClient = createFetchWebDavClient();

function createSyncStore() {
  try {
    return createChromeSyncMetadataStore();
  } catch {
    return createMemorySyncMetadataStore();
  }
}

function createVaultStorage() {
  try {
    return createChromeVaultStorageAdapter();
  } catch {
    return createMemoryVaultStorageAdapter();
  }
}
