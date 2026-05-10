import type { WebDavProfile } from '../core/sync/webdav-client';
import type { PendingSyncConflict } from '../core/sync/conflict';
import type { StorageAreaLike } from '../core/vault/vault-store';

const SYNC_METADATA_STORAGE_KEY = 'syncMetadata';

export interface SyncMetadata {
  profile: WebDavProfile | null;
  baseRevision: string | null;
  baseFingerprint: string | null;
  localRevision: string | null;
  localFingerprint: string | null;
  localUpdatedAt: string | null;
  remoteRevision: string | null;
  remoteUpdatedAt: string | null;
  remoteEtag: string | null;
  lastSyncedAt: string | null;
  lastPulledAt: string | null;
  lastPushedAt: string | null;
  lastStatus: string | null;
  lastError: string | null;
  pendingConflict: PendingSyncConflict | null;
}

export type SyncMetadataSnapshot = Readonly<SyncMetadata>;

export interface SyncMetadataStore {
  load(): Promise<SyncMetadataSnapshot>;
  save(patch: Partial<SyncMetadata>): Promise<SyncMetadataSnapshot>;
  replace(metadata: SyncMetadata): Promise<SyncMetadataSnapshot>;
}

const defaultSyncMetadata: SyncMetadata = {
  profile: null,
  baseRevision: null,
  baseFingerprint: null,
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

export function createMemorySyncMetadataStore(
  initial: Partial<SyncMetadata> = {}
): SyncMetadataStore {
  let state = createMetadata({ ...defaultSyncMetadata, ...initial });

  return {
    async load() {
      return createSnapshot(state);
    },
    async save(patch) {
      state = createMetadata({ ...state, ...patch });
      return createSnapshot(state);
    },
    async replace(metadata) {
      state = createMetadata(metadata);
      return createSnapshot(state);
    }
  };
}

export function createChromeSyncMetadataStore(): SyncMetadataStore {
  const extensionStorage = (
    globalThis as typeof globalThis & {
      chrome?: { storage?: { local?: StorageAreaLike } };
    }
  ).chrome?.storage?.local;

  if (!extensionStorage) {
    throw new Error('chrome.storage.local is unavailable');
  }

  return {
    async load() {
      const result = await extensionStorage.get([SYNC_METADATA_STORAGE_KEY]);
      return createMetadata(result[SYNC_METADATA_STORAGE_KEY]);
    },
    async save(patch) {
      const current = await this.load();
      const next = createMetadata({ ...current, ...patch });

      await extensionStorage.set({ [SYNC_METADATA_STORAGE_KEY]: next });

      return createSnapshot(next);
    },
    async replace(metadata) {
      const next = createMetadata(metadata);

      await extensionStorage.set({ [SYNC_METADATA_STORAGE_KEY]: next });

      return createSnapshot(next);
    }
  };
}

function createMetadata(value: unknown): SyncMetadata {
  if (typeof value !== 'object' || value === null) {
    return { ...defaultSyncMetadata };
  }

  const record = value as Partial<SyncMetadata>;

  return {
    profile: record.profile ?? null,
    baseRevision: normalizeString(record.baseRevision),
    baseFingerprint: normalizeString(record.baseFingerprint),
    localRevision: normalizeString(record.localRevision),
    localFingerprint: normalizeString(record.localFingerprint),
    localUpdatedAt: normalizeString(record.localUpdatedAt),
    remoteRevision: normalizeString(record.remoteRevision),
    remoteUpdatedAt: normalizeString(record.remoteUpdatedAt),
    remoteEtag: normalizeString(record.remoteEtag),
    lastSyncedAt: normalizeString(record.lastSyncedAt),
    lastPulledAt: normalizeString(record.lastPulledAt),
    lastPushedAt: normalizeString(record.lastPushedAt),
    lastStatus: normalizeString(record.lastStatus),
    lastError: normalizeString(record.lastError),
    pendingConflict: isPendingSyncConflict(record.pendingConflict) ? record.pendingConflict : null
  };
}

function createSnapshot(metadata: SyncMetadata): SyncMetadataSnapshot {
  return Object.freeze({
    ...metadata,
    profile: metadata.profile ? { ...metadata.profile } : null
  });
}

function normalizeString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function isPendingSyncConflict(value: unknown): value is PendingSyncConflict {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  return (
    value.kind === 'vault-conflict' &&
    typeof value.detectedAt === 'string' &&
    'local' in value &&
    'remote' in value
  );
}
