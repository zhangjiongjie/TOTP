import { describe, expect, it, vi } from 'vitest';

import type { EncryptedVaultBlob } from '../../../totp-core/src/vault/crypto';
import { createMemoryVaultStorageAdapter } from '../../../totp-core/src/vault/vault-store';
import { createMemorySyncMetadataStore } from '../state/sync-store';
import {
  createSyncEngine,
  WebDavClientError,
  type PendingSyncConflict,
  type SyncOnOpenResult,
  type WebDavRemoteSnapshot
} from './sync-engine';
import { createSyncService } from '../../services/sync-service';
import { lockSession, unlockSession } from '../../state/session-store';

const LOCAL_VAULT = createEncryptedVault('local-ciphertext');
const REMOTE_VAULT = createEncryptedVault('remote-ciphertext');
const BASE_VAULT = createEncryptedVault('base-ciphertext');

function createEncryptedVault(ciphertext: string): EncryptedVaultBlob {
  return {
    formatVersion: 1,
    kdf: {
      name: 'PBKDF2',
      iterations: 310000,
      hash: 'SHA-256'
    },
    cipher: 'AES-GCM',
    salt: 'salt',
    iv: 'iv',
    ciphertext,
    passwordVerifier: 'verifier'
  };
}

describe('createSyncEngine', () => {
  it('returns local cache immediately on open and reports background download failure', async () => {
    const vaultStorage = createMemoryVaultStorageAdapter();
    const syncStore = createMemorySyncMetadataStore();

    await vaultStorage.area.set({ vault: LOCAL_VAULT });

    let rejectDownload!: (reason?: unknown) => void;
    const download = vi.fn().mockImplementation(
      () =>
        new Promise<never>((_, reject) => {
          rejectDownload = reject;
        })
    );

    const engine = createSyncEngine({
      profile: {
        id: 'primary',
        enabled: true,
        baseUrl: 'https://dav.example.com',
        filePath: '/vault.json'
      },
      vaultStorage,
      syncStore,
      client: {
        download,
        upload: vi.fn()
      },
      now: () => '2026-05-10T08:00:00.000Z'
    });

    const openResult = await engine.syncOnOpen();

    expect(openResult.initial.status).toBe('local-cache');
    expect(openResult.initial.source).toBe('local-cache');
    expect(openResult.initial.localVault?.ciphertext).toBe('local-ciphertext');

    rejectDownload(new WebDavClientError('download', 'offline'));

    const background = await openResult.background;

    expect(background.status).toBe('download-error');
    expect(background.source).toBe('local-cache');
  });

  it('sync service also exposes two-phase open sync when session is unlocked', async () => {
    const vaultStorage = createMemoryVaultStorageAdapter();
    const syncStore = createMemorySyncMetadataStore();

    await vaultStorage.area.set({ vault: LOCAL_VAULT });

    const keyMaterial = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
    unlockSession(keyMaterial);

    try {
      const service = createSyncService({
        profile: {
          id: 'primary',
          enabled: true,
          baseUrl: 'https://dav.example.com',
          filePath: '/vault.json'
        },
        vaultStorage,
        syncStore,
        client: {
          download: vi.fn().mockResolvedValue({
            revision: 'rev-1',
            updatedAt: '2026-05-10T08:05:00.000Z',
            etag: '"etag-1"',
            encryptedVault: LOCAL_VAULT
          } satisfies WebDavRemoteSnapshot),
          upload: vi.fn().mockResolvedValue({
            revision: 'rev-1',
            updatedAt: '2026-05-10T08:05:00.000Z',
            etag: '"etag-1"',
            encryptedVault: LOCAL_VAULT
          } satisfies WebDavRemoteSnapshot)
        },
        now: () => '2026-05-10T08:00:00.000Z'
      });

      const openResult = await service.syncOnOpen();

      expect(openResult.initial.status).toBe('local-cache');
      expect((await openResult.background).status).toBe('noop');
    } finally {
      lockSession();
    }
  });

  it('does not misclassify unchanged local content as modified when remote revision changes', async () => {
    const vaultStorage = createMemoryVaultStorageAdapter();
    const syncStore = createMemorySyncMetadataStore({
      baseRevision: 'rev-base',
      baseFingerprint: await createFingerprint(LOCAL_VAULT),
      localRevision: 'rev-base',
      localFingerprint: await createFingerprint(LOCAL_VAULT),
      localUpdatedAt: '2026-05-10T07:00:00.000Z'
    });

    await vaultStorage.area.set({ vault: LOCAL_VAULT });

    const remoteSnapshot: WebDavRemoteSnapshot = {
      revision: 'rev-remote-2',
      updatedAt: '2026-05-10T09:00:00.000Z',
      etag: '"etag-2"',
      encryptedVault: LOCAL_VAULT
    };

    const engine = createSyncEngine({
      profile: {
        id: 'primary',
        enabled: true,
        baseUrl: 'https://dav.example.com',
        filePath: '/vault.json'
      },
      vaultStorage,
      syncStore,
      client: {
        download: vi.fn().mockResolvedValue(remoteSnapshot),
        upload: vi.fn()
      },
      now: () => '2026-05-10T09:30:00.000Z'
    });

    const result = await engine.syncNow();

    expect(result.status).toBe('noop');
    expect(result.source).toBe('none');
    expect(result.remoteRevision).toBe('rev-remote-2');
    expect(await syncStore.load()).toMatchObject({
      baseRevision: 'rev-remote-2',
      localRevision: 'rev-remote-2',
      remoteRevision: 'rev-remote-2'
    });
  });

  it('pushes local vault when local changed without a conflict', async () => {
    const vaultStorage = createMemoryVaultStorageAdapter();
    const syncStore = createMemorySyncMetadataStore({
      baseRevision: 'rev-base',
      baseFingerprint: await createFingerprint(BASE_VAULT),
      remoteRevision: 'rev-base',
      remoteEtag: '"etag-base"',
      remoteUpdatedAt: '2026-05-10T07:00:00.000Z'
    });

    await vaultStorage.area.set({ vault: LOCAL_VAULT });

    const upload = vi.fn().mockResolvedValue({
      revision: 'rev-local',
      updatedAt: '2026-05-10T10:00:00.000Z',
      etag: '"etag-local"',
      encryptedVault: LOCAL_VAULT
    } satisfies WebDavRemoteSnapshot);

    const engine = createSyncEngine({
      profile: {
        id: 'primary',
        enabled: true,
        baseUrl: 'https://dav.example.com',
        filePath: '/vault.json'
      },
      vaultStorage,
      syncStore,
      client: {
        download: vi.fn().mockResolvedValue({
          revision: 'rev-base',
          updatedAt: '2026-05-10T07:00:00.000Z',
          etag: '"etag-base"',
          encryptedVault: BASE_VAULT
        } satisfies WebDavRemoteSnapshot),
        upload
      },
      now: () => '2026-05-10T10:00:00.000Z'
    });

    const result = await engine.syncNow();

    expect(result.status).toBe('pushed');
    expect(result.source).toBe('local');
    expect(result.remoteRevision).toBe('rev-local');
    expect(upload).toHaveBeenCalledTimes(1);
  });

  it('recreates the remote file when it was deleted and does not send a stale etag', async () => {
    const vaultStorage = createMemoryVaultStorageAdapter();
    const syncStore = createMemorySyncMetadataStore({
      baseRevision: 'rev-base',
      baseFingerprint: await createFingerprint(BASE_VAULT),
      remoteRevision: 'rev-base',
      remoteEtag: '"stale-etag"'
    });

    await vaultStorage.area.set({ vault: LOCAL_VAULT });

    const upload = vi.fn().mockResolvedValue({
      revision: 'rev-recreated',
      updatedAt: '2026-05-10T10:30:00.000Z',
      etag: '"etag-new"',
      encryptedVault: LOCAL_VAULT
    } satisfies WebDavRemoteSnapshot);

    const engine = createSyncEngine({
      profile: {
        id: 'primary',
        enabled: true,
        baseUrl: 'https://dav.example.com',
        filePath: '/vault.json'
      },
      vaultStorage,
      syncStore,
      client: {
        download: vi.fn().mockResolvedValue(null),
        upload
      },
      now: () => '2026-05-10T10:30:00.000Z'
    });

    const result = await engine.syncNow();

    expect(result.status).toBe('pushed');
    expect(upload).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ previousEtag: null })
    );
  });

  it('returns an upload error result instead of throwing when upload fails', async () => {
    const vaultStorage = createMemoryVaultStorageAdapter();
    const syncStore = createMemorySyncMetadataStore();

    await vaultStorage.area.set({ vault: LOCAL_VAULT });

    const engine = createSyncEngine({
      profile: {
        id: 'primary',
        enabled: true,
        baseUrl: 'https://dav.example.com',
        filePath: '/vault.json'
      },
      vaultStorage,
      syncStore,
      client: {
        download: vi.fn().mockResolvedValue(null),
        upload: vi.fn().mockRejectedValue(
          new WebDavClientError('upload', 'precondition failed', { statusCode: 412 })
        )
      },
      now: () => '2026-05-10T11:00:00.000Z'
    });

    const result = await engine.syncNow();

    expect(result.status).toBe('upload-error');
    expect(result.error).toMatchObject({
      kind: 'upload',
      statusCode: 412
    });
    expect(await syncStore.load()).toMatchObject({
      lastStatus: 'upload-error',
      lastError: 'precondition failed'
    });
  });

  it('returns a pending conflict payload and can resolve it with the remote choice', async () => {
    const vaultStorage = createMemoryVaultStorageAdapter();
    const syncStore = createMemorySyncMetadataStore({
      baseRevision: 'rev-base',
      baseFingerprint: await createFingerprint(BASE_VAULT),
      remoteRevision: 'rev-base',
      remoteUpdatedAt: '2026-05-10T07:00:00.000Z'
    });

    await vaultStorage.area.set({ vault: LOCAL_VAULT });

    const engine = createSyncEngine({
      profile: {
        id: 'primary',
        enabled: true,
        baseUrl: 'https://dav.example.com',
        filePath: '/vault.json'
      },
      vaultStorage,
      syncStore,
      client: {
        download: vi.fn().mockResolvedValue({
          revision: 'rev-remote',
          updatedAt: '2026-05-10T11:00:00.000Z',
          etag: '"etag-remote"',
          encryptedVault: REMOTE_VAULT
        } satisfies WebDavRemoteSnapshot),
        upload: vi.fn()
      },
      now: () => '2026-05-10T11:30:00.000Z'
    });

    const result = await engine.syncNow();

    expect(result.status).toBe('conflict');
    expect(result.pendingConflict?.remote).toMatchObject({
      revision: 'rev-remote',
      updatedAt: '2026-05-10T11:00:00.000Z',
      etag: '"etag-remote"',
      encryptedVault: REMOTE_VAULT
    });

    const resolved = await engine.resolveConflict(
      result.pendingConflict as PendingSyncConflict,
      'remote'
    );

    expect(resolved.status).toBe('pulled');
    expect((await vaultStorage.area.get('vault')).vault).toEqual(REMOTE_VAULT);
    expect((await syncStore.load()).pendingConflict).toBeNull();
  });

  it('rejects a stale pending conflict payload instead of overwriting newer sync state', async () => {
    const vaultStorage = createMemoryVaultStorageAdapter();
    const syncStore = createMemorySyncMetadataStore({
      baseRevision: 'rev-base',
      baseFingerprint: await createFingerprint(BASE_VAULT)
    });

    await vaultStorage.area.set({ vault: LOCAL_VAULT });

    const engine = createSyncEngine({
      profile: {
        id: 'primary',
        enabled: true,
        baseUrl: 'https://dav.example.com',
        filePath: '/vault.json'
      },
      vaultStorage,
      syncStore,
      client: {
        download: vi.fn().mockResolvedValue({
          revision: 'rev-remote',
          updatedAt: '2026-05-10T11:00:00.000Z',
          etag: '"etag-remote"',
          encryptedVault: REMOTE_VAULT
        } satisfies WebDavRemoteSnapshot),
        upload: vi.fn()
      },
      now: () => '2026-05-10T11:30:00.000Z'
    });

    const conflictResult = await engine.syncNow();
    const staleConflict = {
      ...(conflictResult.pendingConflict as PendingSyncConflict),
      detectedAt: '2026-05-10T09:00:00.000Z'
    };

    const resolved = await engine.resolveConflict(staleConflict, 'remote');

    expect(resolved.status).toBe('validation-error');
    expect(resolved.error).toMatchObject({
      kind: 'validation',
      retryable: false
    });
    expect((await vaultStorage.area.get('vault')).vault).toEqual(LOCAL_VAULT);
    expect((await syncStore.load()).pendingConflict).toMatchObject({
      detectedAt: '2026-05-10T11:30:00.000Z'
    });
  });

  it('preserves conflict context during background open sync so the UI can resolve it later', async () => {
    const vaultStorage = createMemoryVaultStorageAdapter();
    const syncStore = createMemorySyncMetadataStore({
      baseRevision: 'rev-base',
      baseFingerprint: await createFingerprint(BASE_VAULT)
    });

    await vaultStorage.area.set({ vault: LOCAL_VAULT });

    const engine = createSyncEngine({
      profile: {
        id: 'primary',
        enabled: true,
        baseUrl: 'https://dav.example.com',
        filePath: '/vault.json'
      },
      vaultStorage,
      syncStore,
      client: {
        download: vi.fn().mockResolvedValue({
          revision: 'rev-remote',
          updatedAt: '2026-05-10T11:00:00.000Z',
          etag: '"etag-remote"',
          encryptedVault: REMOTE_VAULT
        } satisfies WebDavRemoteSnapshot),
        upload: vi.fn()
      },
      now: () => '2026-05-10T11:30:00.000Z'
    });

    const openResult: SyncOnOpenResult = await engine.syncOnOpen();

    expect(openResult.initial.status).toBe('local-cache');

    const background = await openResult.background;

    expect(background.status).toBe('conflict');
    expect(background.pendingConflict?.remote).toMatchObject({
      revision: 'rev-remote',
      etag: '"etag-remote"',
      encryptedVault: REMOTE_VAULT
    });
  });
});

async function createFingerprint(encryptedVault: EncryptedVaultBlob): Promise<string> {
  const encoded = new TextEncoder().encode(JSON.stringify(encryptedVault));
  const digest = await crypto.subtle.digest('SHA-256', encoded);

  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}
