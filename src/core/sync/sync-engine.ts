import {
  detectVaultConflict,
  type SyncDecision,
  type SyncInspectionSnapshot
} from './conflict';
import type {
  WebDavClient,
  WebDavProfile,
  WebDavRemoteSnapshot
} from './webdav-client';
import { loadEncryptedVault, saveEncryptedVault, type VaultStorageAdapter } from '../vault/vault-store';
import type { EncryptedVaultBlob } from '../vault/crypto';
import type { SyncMetadataStore } from '../../state/sync-store';

export type { WebDavProfile, WebDavRemoteSnapshot } from './webdav-client';

export interface SyncEngine {
  syncOnOpen(): Promise<SyncRunResult>;
  syncNow(): Promise<SyncRunResult>;
}

export interface SyncRunResult {
  status: 'disabled' | 'noop' | 'local-cache' | 'pulled' | 'pushed' | 'conflict';
  source: 'none' | 'local' | 'remote' | 'local-cache';
  localRevision: string | null;
  remoteRevision: string | null;
  localVault: EncryptedVaultBlob | null;
  decision?: SyncDecision;
  error?: string;
}

export interface CreateSyncEngineOptions {
  profile: WebDavProfile | null;
  client: WebDavClient;
  vaultStorage: VaultStorageAdapter;
  syncStore: SyncMetadataStore;
  now?: () => string;
}

export function createSyncEngine({
  profile,
  client,
  vaultStorage,
  syncStore,
  now = () => new Date().toISOString()
}: CreateSyncEngineOptions): SyncEngine {
  return {
    async syncOnOpen() {
      if (!profile?.enabled) {
        return createDisabledResult();
      }

      const localVault = await loadEncryptedVault(vaultStorage);
      const metadata = await syncStore.load();
      const local = localVault
        ? await createLocalSnapshot(
            localVault,
            metadata.localRevision,
            metadata.localFingerprint,
            metadata.localUpdatedAt,
            now
          )
        : null;

      try {
        const remoteSnapshot = await client.download(profile);

        if (!remoteSnapshot) {
          return finalizeNoop(syncStore, now, localVault, local, metadata.remoteRevision);
        }

        const remote = createRemoteSnapshot(remoteSnapshot);

        if (!local) {
          return pullRemoteVault(remoteSnapshot, profile, vaultStorage, syncStore, now);
        }

        const decision = detectVaultConflict({
          baseRevision: metadata.baseRevision,
          local,
          remote
        });

        if (decision.kind === 'apply-remote') {
          return pullRemoteVault(remoteSnapshot, profile, vaultStorage, syncStore, now);
        }

        if (decision.kind === 'conflict') {
          await syncStore.save({
            lastStatus: 'conflict',
            lastError: null
          });

          return {
            status: 'conflict',
            source: 'none',
            localRevision: local.revision,
            remoteRevision: remote.revision,
            localVault,
            decision
          };
        }

        if (remote.revision === local.revision) {
          return finalizeNoop(syncStore, now, localVault, local, remote.revision);
        }

        return finalizeNoop(syncStore, now, localVault, local, remote.revision);
      } catch (error) {
        if (localVault) {
          await syncStore.save({
            lastStatus: 'local-cache',
            lastError: error instanceof Error ? error.message : 'Unknown sync error'
          });

          return {
            status: 'local-cache',
            source: 'local-cache',
            localRevision: local?.revision ?? null,
            remoteRevision: metadata.remoteRevision,
            localVault,
            error: error instanceof Error ? error.message : 'Unknown sync error'
          };
        }

        throw error;
      }
    },
    async syncNow() {
      if (!profile?.enabled) {
        return createDisabledResult();
      }

      const metadata = await syncStore.load();
      const localVault = await loadEncryptedVault(vaultStorage);
      const local = localVault
        ? await createLocalSnapshot(
            localVault,
            metadata.localRevision,
            metadata.localFingerprint,
            metadata.localUpdatedAt,
            now
          )
        : null;

      let remoteSnapshot: WebDavRemoteSnapshot | null;

      try {
        remoteSnapshot = await client.download(profile);
      } catch (error) {
        if (localVault) {
          await syncStore.save({
            lastStatus: 'local-cache',
            lastError: error instanceof Error ? error.message : 'Unknown sync error'
          });

          return {
            status: 'local-cache',
            source: 'local-cache',
            localRevision: local?.revision ?? null,
            remoteRevision: metadata.remoteRevision,
            localVault,
            error: error instanceof Error ? error.message : 'Unknown sync error'
          };
        }

        throw error;
      }

      if (!local && !remoteSnapshot) {
        return finalizeNoop(syncStore, now, null, null, null);
      }

      if (!local && remoteSnapshot) {
        return pullRemoteVault(remoteSnapshot, profile, vaultStorage, syncStore, now);
      }

      if (local && !remoteSnapshot) {
        return pushLocalVault(localVault!, local, profile, client, syncStore, metadata.remoteEtag, now);
      }

      const remote = createRemoteSnapshot(remoteSnapshot!);
      const decision = detectVaultConflict({
        baseRevision: metadata.baseRevision,
        local,
        remote
      });

      if (decision.kind === 'apply-local') {
        return pushLocalVault(localVault!, local!, profile, client, syncStore, metadata.remoteEtag, now);
      }

      if (decision.kind === 'apply-remote') {
        return pullRemoteVault(remoteSnapshot!, profile, vaultStorage, syncStore, now);
      }

      if (decision.kind === 'conflict') {
        await syncStore.save({
          lastStatus: 'conflict',
          lastError: null,
          remoteRevision: remote.revision,
          remoteUpdatedAt: remote.updatedAt,
          remoteEtag: remoteSnapshot!.etag
        });

        return {
          status: 'conflict',
          source: 'none',
          localRevision: local!.revision,
          remoteRevision: remote.revision,
          localVault,
          decision
        };
      }

      return finalizeNoop(syncStore, now, localVault, local, remote.revision);
    }
  };
}

async function pullRemoteVault(
  remoteSnapshot: WebDavRemoteSnapshot,
  profile: WebDavProfile,
  vaultStorage: VaultStorageAdapter,
  syncStore: SyncMetadataStore,
  now: () => string
): Promise<SyncRunResult> {
  await saveEncryptedVault(remoteSnapshot.encryptedVault, vaultStorage);
  const syncedAt = now();

  await syncStore.save({
    profile,
    baseRevision: remoteSnapshot.revision,
    localRevision: remoteSnapshot.revision,
    localFingerprint: remoteSnapshot.revision,
    localUpdatedAt: remoteSnapshot.updatedAt,
    remoteRevision: remoteSnapshot.revision,
    remoteUpdatedAt: remoteSnapshot.updatedAt,
    remoteEtag: remoteSnapshot.etag,
    lastSyncedAt: syncedAt,
    lastPulledAt: syncedAt,
    lastStatus: 'pulled',
    lastError: null
  });

  return {
    status: 'pulled',
    source: 'remote',
    localRevision: remoteSnapshot.revision,
    remoteRevision: remoteSnapshot.revision,
    localVault: remoteSnapshot.encryptedVault
  };
}

async function pushLocalVault(
  localVault: EncryptedVaultBlob,
  local: SyncInspectionSnapshot,
  profile: WebDavProfile,
  client: WebDavClient,
  syncStore: SyncMetadataStore,
  previousEtag: string | null,
  now: () => string
): Promise<SyncRunResult> {
  const uploaded = await client.upload(profile, {
    revision: local.revision,
    updatedAt: local.updatedAt,
    encryptedVault: localVault,
    previousEtag
  });
  const syncedAt = now();

  await syncStore.save({
    profile,
    baseRevision: uploaded.revision,
    localRevision: local.revision,
    localFingerprint: local.fingerprint,
    localUpdatedAt: local.updatedAt,
    remoteRevision: uploaded.revision,
    remoteUpdatedAt: uploaded.updatedAt,
    remoteEtag: uploaded.etag,
    lastSyncedAt: syncedAt,
    lastPushedAt: syncedAt,
    lastStatus: 'pushed',
    lastError: null
  });

  return {
    status: 'pushed',
    source: 'local',
    localRevision: local.revision,
    remoteRevision: uploaded.revision,
    localVault
  };
}

async function finalizeNoop(
  syncStore: SyncMetadataStore,
  now: () => string,
  localVault: EncryptedVaultBlob | null,
  local: SyncInspectionSnapshot | null,
  remoteRevision: string | null
): Promise<SyncRunResult> {
  await syncStore.save({
    lastSyncedAt: now(),
    lastStatus: 'noop',
    lastError: null,
    localRevision: local?.revision ?? null,
    localFingerprint: local?.fingerprint ?? null,
    localUpdatedAt: local?.updatedAt ?? null,
    remoteRevision
  });

  return {
    status: 'noop',
    source: 'none',
    localRevision: local?.revision ?? null,
    remoteRevision,
    localVault
  };
}

function createDisabledResult(): SyncRunResult {
  return {
    status: 'disabled',
    source: 'none',
    localRevision: null,
    remoteRevision: null,
    localVault: null
  };
}

function createRemoteSnapshot(remoteSnapshot: WebDavRemoteSnapshot): SyncInspectionSnapshot {
  return {
    revision: remoteSnapshot.revision,
    updatedAt: remoteSnapshot.updatedAt,
    fingerprint: remoteSnapshot.revision,
    source: 'remote',
    status: 'ready'
  };
}

async function createLocalSnapshot(
  encryptedVault: EncryptedVaultBlob,
  previousRevision: string | null,
  previousFingerprint: string | null,
  previousUpdatedAt: string | null,
  now: () => string
): Promise<SyncInspectionSnapshot> {
  const fingerprint = await createVaultRevision(encryptedVault);
  const isKnownSnapshot =
    (previousFingerprint && previousFingerprint === fingerprint) ||
    (!previousFingerprint && previousRevision !== null);
  const revision = isKnownSnapshot && previousRevision ? previousRevision : fingerprint;
  const updatedAt = isKnownSnapshot && previousUpdatedAt ? previousUpdatedAt : now();

  return {
    revision,
    updatedAt,
    fingerprint,
    source: 'local',
    status: 'ready'
  };
}

async function createVaultRevision(encryptedVault: EncryptedVaultBlob): Promise<string> {
  const encoded = new TextEncoder().encode(JSON.stringify(encryptedVault));
  const digest = await crypto.subtle.digest('SHA-256', encoded);

  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}
