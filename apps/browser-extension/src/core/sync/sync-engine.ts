import {
  detectVaultConflict,
  type PendingConflictSnapshot,
  type PendingSyncConflict,
  type SyncDecision,
  type SyncInspectionSnapshot
} from './conflict';
import {
  WebDavClientError,
  type WebDavClient,
  type WebDavProfile,
  type WebDavRemoteSnapshot
} from './webdav-client';
import { loadEncryptedVault, saveEncryptedVault, type VaultStorageAdapter } from '../vault/vault-store';
import type { EncryptedVaultBlob } from '../vault/crypto';
import type { SyncMetadataSnapshot, SyncMetadataStore } from '../../state/sync-store';

export { WebDavClientError, type PendingSyncConflict, type WebDavProfile, type WebDavRemoteSnapshot };

export type SyncSource = 'none' | 'local' | 'remote' | 'local-cache';
export type SyncResultStatus =
  | 'disabled'
  | 'noop'
  | 'local-cache'
  | 'pulled'
  | 'pushed'
  | 'conflict'
  | 'download-error'
  | 'upload-error'
  | 'validation-error';

export interface SyncResultError {
  kind: 'download' | 'upload' | 'validation';
  message: string;
  retryable: boolean;
  statusCode: number | null;
}

export interface SyncRunResult {
  status: SyncResultStatus;
  source: SyncSource;
  localRevision: string | null;
  remoteRevision: string | null;
  localVault: EncryptedVaultBlob | null;
  merged?: boolean;
  decision?: SyncDecision;
  pendingConflict?: PendingSyncConflict | null;
  error?: SyncResultError;
}

export interface SyncOnOpenResult {
  initial: SyncRunResult;
  background: Promise<SyncRunResult>;
}

export interface CreateSyncEngineOptions {
  profile: WebDavProfile | null;
  client: WebDavClient;
  vaultStorage: VaultStorageAdapter;
  syncStore: SyncMetadataStore;
  fingerprintVault?: (encryptedVault: EncryptedVaultBlob) => Promise<string>;
  mergeConflict?: (input: {
    metadata: SyncMetadataSnapshot;
    local: PendingConflictSnapshot;
    remote: PendingConflictSnapshot;
  }) => Promise<EncryptedVaultBlob | null>;
  preferRemoteOnFirstSync?: (input: {
    local: SyncInspectionSnapshot;
    remote: SyncInspectionSnapshot;
    metadata: SyncMetadataSnapshot;
  }) => Promise<boolean> | boolean;
  now?: () => string;
}

export interface SyncEngine {
  syncOnOpen(): Promise<SyncOnOpenResult>;
  syncNow(): Promise<SyncRunResult>;
  resolveConflict(payload: PendingSyncConflict, choice: 'local' | 'remote'): Promise<SyncRunResult>;
}

interface SyncContext {
  metadata: SyncMetadataSnapshot;
  localVault: EncryptedVaultBlob | null;
  localSnapshot: SyncInspectionSnapshot | null;
}

interface SyncCandidateInput {
  encryptedVault: EncryptedVaultBlob;
  revision: string;
  updatedAt: string;
  source: 'local' | 'remote';
  status?: 'ready';
  fingerprintVault: (encryptedVault: EncryptedVaultBlob) => Promise<string>;
}

export function createSyncEngine({
  profile,
  client,
  vaultStorage,
  syncStore,
  fingerprintVault = createEncryptedVaultFingerprint,
  mergeConflict,
  preferRemoteOnFirstSync,
  now = () => new Date().toISOString()
}: CreateSyncEngineOptions): SyncEngine {
  return {
    async syncOnOpen() {
      if (!profile?.enabled) {
        const disabled = createDisabledResult();

        return {
          initial: disabled,
          background: Promise.resolve(disabled)
        };
      }

      const context = await loadContext(vaultStorage, syncStore, fingerprintVault, now);
      const initial = createOpenInitialResult(context.localVault, context.localSnapshot, context.metadata);
      const background = performSync(
        profile,
        'open',
        context,
        client,
        vaultStorage,
        syncStore,
        fingerprintVault,
        mergeConflict,
        preferRemoteOnFirstSync,
        now
      );

      return {
        initial,
        background
      };
    },
    async syncNow() {
      if (!profile?.enabled) {
        return createDisabledResult();
      }

      const context = await loadContext(vaultStorage, syncStore, fingerprintVault, now);

      return performSync(
        profile,
        'manual',
        context,
        client,
        vaultStorage,
        syncStore,
        fingerprintVault,
        mergeConflict,
        preferRemoteOnFirstSync,
        now
      );
    },
    async resolveConflict(payload, choice) {
      if (!profile?.enabled) {
        return createDisabledResult();
      }

      const context = await loadContext(vaultStorage, syncStore, fingerprintVault, now);

      if (!isPendingConflictCurrent(context.metadata.pendingConflict, payload)) {
        return handleValidationFailure(
          'Pending sync conflict is stale or no longer matches the current sync state',
          context,
          syncStore
        );
      }

      if (choice === 'remote') {
        const remoteSnapshot: WebDavRemoteSnapshot = {
          revision: payload.remote.revision,
          updatedAt: payload.remote.updatedAt,
          encryptedVault: payload.remote.encryptedVault,
          etag: payload.remote.etag
        };

        return applyRemoteSnapshot(
          remoteSnapshot,
          profile,
          vaultStorage,
          syncStore,
          fingerprintVault,
          now
        );
      }

      return uploadLocalSnapshot(
        {
          encryptedVault: payload.local.encryptedVault,
          snapshot: payload.local
        },
        profile,
        client,
        syncStore,
        payload.remote.etag,
        fingerprintVault,
        now
      );
    }
  };
}

async function performSync(
  profile: WebDavProfile,
  mode: 'open' | 'manual',
  context: SyncContext,
  client: WebDavClient,
  vaultStorage: VaultStorageAdapter,
  syncStore: SyncMetadataStore,
  fingerprintVault: (encryptedVault: EncryptedVaultBlob) => Promise<string>,
  mergeConflict:
    | ((input: {
        metadata: SyncMetadataSnapshot;
        local: PendingConflictSnapshot;
        remote: PendingConflictSnapshot;
      }) => Promise<EncryptedVaultBlob | null>)
    | undefined,
  preferRemoteOnFirstSync:
    | ((input: {
        local: SyncInspectionSnapshot;
        remote: SyncInspectionSnapshot;
        metadata: SyncMetadataSnapshot;
      }) => Promise<boolean> | boolean)
    | undefined,
  now: () => string
): Promise<SyncRunResult> {
  let remoteSnapshot: WebDavRemoteSnapshot | null;

  try {
    remoteSnapshot = await client.download(profile);
  } catch (error) {
    return handleSyncError('download', error, context, syncStore);
  }

  if (!context.localSnapshot && !remoteSnapshot) {
    return finalizeNoop(syncStore, now, {
      localVault: null,
      local: null,
      remote: null,
      baseVault: null
    });
  }

  if (!context.localSnapshot && remoteSnapshot) {
    return applyRemoteSnapshot(
      remoteSnapshot,
      profile,
      vaultStorage,
      syncStore,
      fingerprintVault,
      now
    );
  }

  if (context.localSnapshot && !remoteSnapshot) {
    return uploadLocalSnapshot(
      {
        encryptedVault: context.localVault!,
        snapshot: context.localSnapshot
      },
      profile,
      client,
      syncStore,
      null,
      fingerprintVault,
      now
    );
  }

  const remote = await createCandidateSnapshot({
    encryptedVault: remoteSnapshot!.encryptedVault,
    revision: remoteSnapshot!.revision,
    updatedAt: remoteSnapshot!.updatedAt,
    source: 'remote',
    fingerprintVault
  });
  const local = context.localSnapshot!;
  const decision = detectVaultConflict({
    baseRevision: context.metadata.baseRevision,
    baseFingerprint: context.metadata.baseFingerprint,
    local,
    remote
  });

  if (
    !context.metadata.baseFingerprint &&
    preferRemoteOnFirstSync &&
    (await preferRemoteOnFirstSync({
      local,
      remote,
      metadata: context.metadata
    }))
  ) {
    return applyRemoteSnapshot(
      remoteSnapshot!,
      profile,
      vaultStorage,
      syncStore,
      fingerprintVault,
      now
    );
  }

  if (decision.kind === 'apply-local') {
    return uploadLocalSnapshot(
      {
        encryptedVault: context.localVault!,
        snapshot: local
      },
      profile,
      client,
      syncStore,
      remoteSnapshot!.etag,
      fingerprintVault,
      now
    );
  }

  if (decision.kind === 'apply-remote') {
    return applyRemoteSnapshot(
      remoteSnapshot!,
      profile,
      vaultStorage,
      syncStore,
      fingerprintVault,
      now
    );
  }

  if (decision.kind === 'conflict') {
    const localConflict: PendingConflictSnapshot = {
      ...local,
      encryptedVault: context.localVault!,
      etag: null
    };
    const remoteConflict: PendingConflictSnapshot = {
      ...remote,
      encryptedVault: remoteSnapshot!.encryptedVault,
      etag: remoteSnapshot!.etag
    };

    if (mergeConflict) {
      const mergedVault = await mergeConflict({
        metadata: context.metadata,
        local: localConflict,
        remote: remoteConflict
      });

      if (mergedVault) {
        await saveEncryptedVault(mergedVault, vaultStorage);
        const mergedLocalSnapshot = await createLocalSnapshot(
          mergedVault,
          context.metadata.localRevision,
          context.metadata.localFingerprint,
          fingerprintVault,
          now
        );
        const mergedResult = await uploadLocalSnapshot(
          {
            encryptedVault: mergedVault,
            snapshot: mergedLocalSnapshot
          },
          profile,
          client,
          syncStore,
          remoteSnapshot!.etag,
          fingerprintVault,
          now
        );

        return {
          ...mergedResult,
          merged: true
        };
      }
    }

    const pendingConflict = createPendingConflict(
      context.metadata,
      localConflict,
      remoteConflict,
      now()
    );

    await syncStore.save({
      profile,
      remoteRevision: remote.revision,
      remoteUpdatedAt: remote.updatedAt,
      remoteEtag: remoteSnapshot!.etag,
      lastStatus: 'conflict',
      lastError: null,
      pendingConflict
    });

    return {
      status: 'conflict',
      source: mode === 'open' && context.localVault ? 'local-cache' : 'none',
      localRevision: local.revision,
      remoteRevision: remote.revision,
      localVault: context.localVault,
      decision,
      pendingConflict
    };
  }

  return finalizeNoop(syncStore, now, {
    localVault: context.localVault,
    local,
    remote,
    remoteVault: remoteSnapshot!.encryptedVault,
    profile,
    remoteEtag: remoteSnapshot!.etag
  });
}

async function loadContext(
  vaultStorage: VaultStorageAdapter,
  syncStore: SyncMetadataStore,
  fingerprintVault: (encryptedVault: EncryptedVaultBlob) => Promise<string>,
  now: () => string
): Promise<SyncContext> {
  const metadata = await syncStore.load();
  const localVault = await loadEncryptedVault(vaultStorage);
  const localSnapshot = localVault
    ? await createLocalSnapshot(
        localVault,
        metadata.localRevision,
        metadata.localFingerprint,
        fingerprintVault,
        now
      )
    : null;

  return {
    metadata,
    localVault,
    localSnapshot
  };
}

async function applyRemoteSnapshot(
  remoteSnapshot: WebDavRemoteSnapshot,
  profile: WebDavProfile,
  vaultStorage: VaultStorageAdapter,
  syncStore: SyncMetadataStore,
  fingerprintVault: (encryptedVault: EncryptedVaultBlob) => Promise<string>,
  now: () => string
): Promise<SyncRunResult> {
  const remote = await createCandidateSnapshot({
    encryptedVault: remoteSnapshot.encryptedVault,
    revision: remoteSnapshot.revision,
    updatedAt: remoteSnapshot.updatedAt,
    source: 'remote',
    fingerprintVault
  });

  await saveEncryptedVault(remoteSnapshot.encryptedVault, vaultStorage);

  const syncedAt = now();
  await syncStore.save({
    profile,
    baseRevision: remote.revision,
    baseFingerprint: remote.fingerprint,
    baseVault: remoteSnapshot.encryptedVault,
    localRevision: remote.revision,
    localFingerprint: remote.fingerprint,
    localUpdatedAt: remote.updatedAt,
    remoteRevision: remote.revision,
    remoteUpdatedAt: remote.updatedAt,
    remoteEtag: remoteSnapshot.etag,
    lastSyncedAt: syncedAt,
    lastPulledAt: syncedAt,
    lastStatus: 'pulled',
    lastError: null,
    pendingConflict: null
  });

  return {
    status: 'pulled',
    source: 'remote',
    localRevision: remote.revision,
    remoteRevision: remote.revision,
    localVault: remoteSnapshot.encryptedVault,
    pendingConflict: null
  };
}

async function uploadLocalSnapshot(
  local: { encryptedVault: EncryptedVaultBlob; snapshot: SyncInspectionSnapshot },
  profile: WebDavProfile,
  client: WebDavClient,
  syncStore: SyncMetadataStore,
  previousEtag: string | null,
  fingerprintVault: (encryptedVault: EncryptedVaultBlob) => Promise<string>,
  now: () => string
): Promise<SyncRunResult> {
  let uploaded: WebDavRemoteSnapshot;

  try {
    uploaded = await client.upload(profile, {
      revision: local.snapshot.revision,
      updatedAt: local.snapshot.updatedAt,
      encryptedVault: local.encryptedVault,
      previousEtag
    });
  } catch (error) {
    return handleSyncError(
      'upload',
      error,
      {
        localVault: local.encryptedVault,
        localSnapshot: local.snapshot,
        metadata: await syncStore.load()
      },
      syncStore
    );
  }

  const remote = await createCandidateSnapshot({
    encryptedVault: uploaded.encryptedVault,
    revision: uploaded.revision,
    updatedAt: uploaded.updatedAt,
    source: 'remote',
    fingerprintVault
  });
  const syncedAt = now();

  await syncStore.save({
    profile,
    baseRevision: remote.revision,
    baseFingerprint: local.snapshot.fingerprint,
    baseVault: local.encryptedVault,
    localRevision: remote.revision,
    localFingerprint: local.snapshot.fingerprint,
    localUpdatedAt: uploaded.updatedAt,
    remoteRevision: remote.revision,
    remoteUpdatedAt: uploaded.updatedAt,
    remoteEtag: uploaded.etag,
    lastSyncedAt: syncedAt,
    lastPushedAt: syncedAt,
    lastStatus: 'pushed',
    lastError: null,
    pendingConflict: null
  });

  return {
    status: 'pushed',
    source: 'local',
    localRevision: remote.revision,
    remoteRevision: remote.revision,
    localVault: local.encryptedVault,
    pendingConflict: null
  };
}

async function finalizeNoop(
  syncStore: SyncMetadataStore,
  now: () => string,
  input: {
    localVault: EncryptedVaultBlob | null;
    local: SyncInspectionSnapshot | null;
    remote: SyncInspectionSnapshot | null;
    remoteVault?: EncryptedVaultBlob | null;
    baseVault?: EncryptedVaultBlob | null;
    profile?: WebDavProfile;
    remoteEtag?: string | null;
  }
): Promise<SyncRunResult> {
  const localRevision = input.remote?.revision ?? input.local?.revision ?? null;
  const localFingerprint = input.remote?.fingerprint ?? input.local?.fingerprint ?? null;
  const updatedAt = input.remote?.updatedAt ?? input.local?.updatedAt ?? null;

  await syncStore.save({
    ...(input.profile ? { profile: input.profile } : {}),
    baseRevision: input.remote?.revision ?? input.local?.revision ?? null,
    baseFingerprint: input.remote?.fingerprint ?? input.local?.fingerprint ?? null,
    baseVault: input.baseVault ?? input.remoteVault ?? input.localVault,
    localRevision,
    localFingerprint,
    localUpdatedAt: updatedAt,
    remoteRevision: input.remote?.revision ?? null,
    remoteUpdatedAt: input.remote?.updatedAt ?? null,
    remoteEtag: input.remoteEtag ?? null,
    lastSyncedAt: now(),
    lastStatus: 'noop',
    lastError: null,
    pendingConflict: null
  });

  return {
    status: 'noop',
    source: 'none',
    localRevision,
    remoteRevision: input.remote?.revision ?? null,
    localVault: input.localVault,
    pendingConflict: null
  };
}

function createDisabledResult(): SyncRunResult {
  return {
    status: 'disabled',
    source: 'none',
    localRevision: null,
    remoteRevision: null,
    localVault: null,
    pendingConflict: null
  };
}

function createOpenInitialResult(
  localVault: EncryptedVaultBlob | null,
  localSnapshot: SyncInspectionSnapshot | null,
  metadata: SyncMetadataSnapshot
): SyncRunResult {
  if (!localVault) {
    return {
      status: 'noop',
      source: 'none',
      localRevision: localSnapshot?.revision ?? metadata.localRevision,
      remoteRevision: metadata.remoteRevision,
      localVault: null,
      pendingConflict: metadata.pendingConflict
    };
  }

  return {
    status: 'local-cache',
    source: 'local-cache',
    localRevision: localSnapshot?.revision ?? metadata.localRevision,
    remoteRevision: metadata.remoteRevision,
    localVault,
    pendingConflict: metadata.pendingConflict
  };
}

async function createLocalSnapshot(
  encryptedVault: EncryptedVaultBlob,
  previousRevision: string | null,
  previousFingerprint: string | null,
  fingerprintVault: (encryptedVault: EncryptedVaultBlob) => Promise<string>,
  now: () => string
): Promise<SyncInspectionSnapshot> {
  const fingerprint = await fingerprintVault(encryptedVault);
  const revision =
    previousFingerprint && previousFingerprint === fingerprint && previousRevision
      ? previousRevision
      : `local:${fingerprint}`;

  return {
    revision,
    updatedAt: now(),
    fingerprint,
    source: 'local',
    status: 'ready'
  };
}

async function createCandidateSnapshot({
  encryptedVault,
  revision,
  updatedAt,
  source,
  status = 'ready',
  fingerprintVault
}: SyncCandidateInput): Promise<SyncInspectionSnapshot> {
  return {
    revision,
    updatedAt,
    fingerprint: await fingerprintVault(encryptedVault),
    source,
    status
  };
}

function createPendingConflict(
  metadata: SyncMetadataSnapshot,
  local: PendingConflictSnapshot,
  remote: PendingConflictSnapshot,
  detectedAt: string
): PendingSyncConflict {
  return {
    kind: 'vault-conflict',
    detectedAt,
    baseRevision: metadata.baseRevision,
    baseFingerprint: metadata.baseFingerprint,
    local,
    remote
  };
}

async function createEncryptedVaultFingerprint(
  encryptedVault: EncryptedVaultBlob
): Promise<string> {
  const encoded = new TextEncoder().encode(JSON.stringify(encryptedVault));
  const digest = await crypto.subtle.digest('SHA-256', encoded);

  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

async function handleSyncError(
  operation: 'download' | 'upload',
  error: unknown,
  context: SyncContext,
  syncStore: SyncMetadataStore
): Promise<SyncRunResult> {
  const normalized = normalizeSyncError(operation, error);
  const status = `${normalized.kind}-error` as Extract<
    SyncResultStatus,
    'download-error' | 'upload-error' | 'validation-error'
  >;

  await syncStore.save({
    lastStatus: status,
    lastError: normalized.message
  });

  return {
    status,
    source: context.localVault ? 'local-cache' : 'none',
    localRevision: context.localSnapshot?.revision ?? context.metadata.localRevision,
    remoteRevision: context.metadata.remoteRevision,
    localVault: context.localVault,
    pendingConflict: context.metadata.pendingConflict,
    error: normalized
  };
}

function normalizeSyncError(
  operation: 'download' | 'upload',
  error: unknown
): SyncResultError {
  if (error instanceof WebDavClientError) {
    return {
      kind: error.kind,
      message: error.message,
      retryable: error.retryable,
      statusCode: error.statusCode
    };
  }

  return {
    kind: operation,
    message: error instanceof Error ? error.message : 'Unknown sync error',
    retryable: true,
    statusCode: null
  };
}

async function handleValidationFailure(
  message: string,
  context: SyncContext,
  syncStore: SyncMetadataStore
): Promise<SyncRunResult> {
  const error: SyncResultError = {
    kind: 'validation',
    message,
    retryable: false,
    statusCode: null
  };

  await syncStore.save({
    lastStatus: 'validation-error',
    lastError: message
  });

  return {
    status: 'validation-error',
    source: context.localVault ? 'local-cache' : 'none',
    localRevision: context.localSnapshot?.revision ?? context.metadata.localRevision,
    remoteRevision: context.metadata.remoteRevision,
    localVault: context.localVault,
    pendingConflict: context.metadata.pendingConflict,
    error
  };
}

function isPendingConflictCurrent(
  current: PendingSyncConflict | null,
  candidate: PendingSyncConflict
): boolean {
  if (!current) {
    return false;
  }

  return (
    current.kind === candidate.kind &&
    current.detectedAt === candidate.detectedAt &&
    current.baseRevision === candidate.baseRevision &&
    current.baseFingerprint === candidate.baseFingerprint &&
    current.local.revision === candidate.local.revision &&
    current.local.fingerprint === candidate.local.fingerprint &&
    current.local.updatedAt === candidate.local.updatedAt &&
    current.remote.revision === candidate.remote.revision &&
    current.remote.fingerprint === candidate.remote.fingerprint &&
    current.remote.updatedAt === candidate.remote.updatedAt &&
    current.remote.etag === candidate.remote.etag
  );
}
