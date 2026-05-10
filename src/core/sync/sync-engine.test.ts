import { describe, expect, it, vi } from 'vitest';

import type { EncryptedVaultBlob } from '../vault/crypto';
import { createMemoryVaultStorageAdapter } from '../vault/vault-store';
import { createMemorySyncMetadataStore } from '../../state/sync-store';
import {
  createSyncEngine,
  type WebDavRemoteSnapshot
} from './sync-engine';

const LOCAL_VAULT = createEncryptedVault('local-ciphertext');
const REMOTE_VAULT = createEncryptedVault('remote-ciphertext');

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
  it('returns local-cache on open when remote download fails', async () => {
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
        download: vi.fn().mockRejectedValue(new Error('offline')),
        upload: vi.fn()
      },
      now: () => '2026-05-10T08:00:00.000Z'
    });

    const result = await engine.syncOnOpen();

    expect(result.status).toBe('local-cache');
    expect(result.source).toBe('local-cache');
    expect(result.localVault?.ciphertext).toBe('local-ciphertext');
  });

  it('pulls remote vault on open when remote revision is newer', async () => {
    const vaultStorage = createMemoryVaultStorageAdapter();
    const syncStore = createMemorySyncMetadataStore({
      baseRevision: 'rev-local',
      localRevision: 'rev-local',
      localUpdatedAt: '2026-05-10T07:00:00.000Z'
    });

    await vaultStorage.area.set({ vault: LOCAL_VAULT });

    const remoteSnapshot: WebDavRemoteSnapshot = {
      revision: 'rev-remote',
      updatedAt: '2026-05-10T09:00:00.000Z',
      etag: '"etag-2"',
      encryptedVault: REMOTE_VAULT
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

    const result = await engine.syncOnOpen();

    expect(result.status).toBe('pulled');
    expect(result.source).toBe('remote');
    expect(result.remoteRevision).toBe('rev-remote');
    expect((await vaultStorage.area.get('vault')).vault).toEqual(REMOTE_VAULT);
  });

  it('pushes local vault when local changed without a conflict', async () => {
    const vaultStorage = createMemoryVaultStorageAdapter();
    const syncStore = createMemorySyncMetadataStore({
      baseRevision: 'rev-base',
      remoteRevision: 'rev-base',
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
          encryptedVault: createEncryptedVault('base-ciphertext')
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

  it('returns a conflict decision when both local and remote changed', async () => {
    const vaultStorage = createMemoryVaultStorageAdapter();
    const syncStore = createMemorySyncMetadataStore({
      baseRevision: 'rev-base',
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
    expect(result.decision?.kind).toBe('conflict');
    expect(result.decision?.choices).toEqual([
      {
        source: 'local',
        revision: expect.any(String),
        updatedAt: '2026-05-10T11:30:00.000Z'
      },
      {
        source: 'remote',
        revision: 'rev-remote',
        updatedAt: '2026-05-10T11:00:00.000Z'
      }
    ]);
  });
});
