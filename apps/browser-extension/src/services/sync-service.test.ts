import { afterEach, describe, expect, it, vi } from 'vitest';
import { decryptVault, encryptVault, type VaultPayload } from '../core/vault/crypto';
import { createMemoryVaultStorageAdapter } from '../core/vault/vault-store';
import { createMemorySyncMetadataStore } from '../state/sync-store';
import { clearCurrentMasterPassword, setCurrentMasterPassword } from '../state/master-password-store';
import { getSeedVaultPayload } from './account-service';
import { createSyncService } from './sync-service';

describe('syncService', () => {
  afterEach(() => {
    clearCurrentMasterPassword();
  });

  it('does not raise a conflict when local and remote decrypt to the same accounts', async () => {
    const password = 'very-secure-password';
    const baseVault: VaultPayload = { version: 1, accounts: [] };
    const changedVault: VaultPayload = {
      version: 1,
      accounts: [
        {
          id: 'demo-1',
          issuer: 'GitHub',
          accountName: 'alice@company.com',
          secret: 'JBSWY3DPEHPK3PXP',
          digits: 6,
          period: 30,
          algorithm: 'SHA1',
          tags: [],
          groupId: null,
          pinned: false,
          iconKey: 'github',
          updatedAt: '2026-05-11T02:30:00.000Z'
        }
      ]
    };
    const vaultStorage = createMemoryVaultStorageAdapter();
    const syncStore = createMemorySyncMetadataStore({
      baseRevision: 'rev-base',
      baseFingerprint: await hashString(JSON.stringify(baseVault)),
      remoteRevision: 'rev-base',
      remoteUpdatedAt: '2026-05-11T02:00:00.000Z'
    });
    const localVault = await encryptVault(changedVault, password);
    const remoteVault = await encryptVault(changedVault, password);
    const upload = vi.fn();

    await vaultStorage.area.set({ vault: localVault });
    setCurrentMasterPassword(password);

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
          revision: 'rev-remote',
          updatedAt: '2026-05-11T02:31:00.000Z',
          etag: '"etag-remote"',
          encryptedVault: remoteVault
        }),
        upload
      },
      now: () => '2026-05-11T02:32:00.000Z'
    });

    const result = await service.manualSync();

    expect(result.status).toBe('noop');
    expect(upload).not.toHaveBeenCalled();
  });

  it('raises a conflict on first sync when both local and remote already contain different data', async () => {
    const password = 'very-secure-password';
    const vaultStorage = createMemoryVaultStorageAdapter();
    const syncStore = createMemorySyncMetadataStore();
    const remoteVaultPayload: VaultPayload = {
      version: 1,
      accounts: [
        {
          id: 'real-1',
          issuer: 'Notion',
          accountName: 'owner@example.com',
          secret: 'JBSWY3DPEHPK3PXP',
          digits: 6,
          period: 30,
          algorithm: 'SHA1',
          tags: ['work'],
          groupId: 'work',
          pinned: true,
          iconKey: 'notion',
          updatedAt: '2026-05-11T03:10:00.000Z'
        }
      ]
    };
    const localSeedVault = await encryptVault(getSeedVaultPayload(), password);
    const remoteVault = await encryptVault(remoteVaultPayload, password);
    const upload = vi.fn();

    await vaultStorage.area.set({ vault: localSeedVault });
    setCurrentMasterPassword(password);

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
          revision: 'rev-remote',
          updatedAt: '2026-05-11T03:10:00.000Z',
          etag: '"etag-remote"',
          encryptedVault: remoteVault
        }),
        upload
      },
      now: () => '2026-05-11T03:12:00.000Z'
    });

    const result = await service.manualSync();

    expect(result.status).toBe('conflict');
    expect(upload).not.toHaveBeenCalled();
    expect(result.pendingConflict).not.toBeNull();
  });

  it('prefers the remote vault on first sync when the local vault is empty', async () => {
    const password = 'very-secure-password';
    const vaultStorage = createMemoryVaultStorageAdapter();
    const syncStore = createMemorySyncMetadataStore();
    const remoteVaultPayload: VaultPayload = {
      version: 1,
      accounts: [
        {
          id: 'real-2',
          issuer: 'GitHub',
          accountName: 'owner@example.com',
          secret: 'JBSWY3DPEHPK3PXP',
          digits: 6,
          period: 30,
          algorithm: 'SHA1',
          tags: [],
          groupId: 'default',
          pinned: false,
          iconKey: 'github',
          updatedAt: '2026-05-11T03:20:00.000Z'
        }
      ]
    };
    const localEmptyVault = await encryptVault({ version: 1, accounts: [] }, password);
    const remoteVault = await encryptVault(remoteVaultPayload, password);
    const upload = vi.fn();

    await vaultStorage.area.set({ vault: localEmptyVault });
    setCurrentMasterPassword(password);

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
          revision: 'rev-remote',
          updatedAt: '2026-05-11T03:20:00.000Z',
          etag: '"etag-remote"',
          encryptedVault: remoteVault
        }),
        upload
      },
      now: () => '2026-05-11T03:21:00.000Z'
    });

    const result = await service.manualSync();

    expect(result.status).toBe('pulled');
    expect(upload).not.toHaveBeenCalled();
  });

  it('merges account-level additions from local and remote before pushing', async () => {
    const password = 'very-secure-password';
    const baseVaultPayload: VaultPayload = {
      version: 1,
      accounts: [
        {
          id: 'base-1',
          issuer: 'GitHub',
          accountName: 'owner@example.com',
          secret: 'JBSWY3DPEHPK3PXP',
          digits: 6,
          period: 30,
          algorithm: 'SHA1',
          tags: [],
          groupId: 'default',
          pinned: false,
          iconKey: 'github',
          updatedAt: '2026-05-11T03:00:00.000Z'
        }
      ]
    };
    const localVaultPayload: VaultPayload = {
      version: 1,
      accounts: [
        ...baseVaultPayload.accounts,
        {
          id: 'local-2',
          issuer: 'Notion',
          accountName: 'owner@company.com',
          secret: 'GEZDGNBVGY3TQOJQ',
          digits: 6,
          period: 30,
          algorithm: 'SHA1',
          tags: ['work'],
          groupId: 'work',
          pinned: false,
          iconKey: 'notion',
          updatedAt: '2026-05-11T03:05:00.000Z'
        }
      ]
    };
    const remoteVaultPayload: VaultPayload = {
      version: 1,
      accounts: [
        ...baseVaultPayload.accounts,
        {
          id: 'remote-3',
          issuer: 'Slack',
          accountName: 'design-ops',
          secret: 'MZXW6YTBOI======',
          digits: 6,
          period: 30,
          algorithm: 'SHA1',
          tags: [],
          groupId: 'default',
          pinned: false,
          iconKey: 'slack',
          updatedAt: '2026-05-11T03:06:00.000Z'
        }
      ]
    };
    const baseVault = await encryptVault(baseVaultPayload, password);
    const localVault = await encryptVault(localVaultPayload, password);
    const remoteVault = await encryptVault(remoteVaultPayload, password);
    const vaultStorage = createMemoryVaultStorageAdapter();
    const syncStore = createMemorySyncMetadataStore({
      baseRevision: 'rev-base',
      baseFingerprint: await hashString(JSON.stringify(baseVaultPayload)),
      remoteRevision: 'rev-base',
      remoteUpdatedAt: '2026-05-11T03:00:00.000Z',
      baseVault
    } as never);
    const upload = vi.fn().mockImplementation(async (_profile, payload) => ({
      revision: 'rev-merged',
      updatedAt: '2026-05-11T03:10:00.000Z',
      etag: '"etag-merged"',
      encryptedVault: payload.encryptedVault
    }));

    await vaultStorage.area.set({ vault: localVault });
    setCurrentMasterPassword(password);

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
          revision: 'rev-remote',
          updatedAt: '2026-05-11T03:06:00.000Z',
          etag: '"etag-remote"',
          encryptedVault: remoteVault
        }),
        upload
      },
      now: () => '2026-05-11T03:10:00.000Z'
    });

    const result = await service.manualSync();
    const mergedVault = await decryptVault(result.localVault!, password);

    expect(result.status).toBe('pushed');
    expect(result.merged).toBe(true);
    expect(upload).toHaveBeenCalledTimes(1);
    expect(mergedVault.accounts.map((account) => account.id).sort()).toEqual([
      'base-1',
      'local-2',
      'remote-3'
    ]);
  });

  it('merges independent account updates, additions, and deletions before pushing', async () => {
    const password = 'very-secure-password';
    const baseVaultPayload: VaultPayload = {
      version: 1,
      accounts: [
        {
          id: 'base-1',
          issuer: 'GitHub',
          accountName: 'owner@example.com',
          secret: 'JBSWY3DPEHPK3PXP',
          digits: 6,
          period: 30,
          algorithm: 'SHA1',
          tags: [],
          groupId: 'default',
          pinned: false,
          iconKey: 'github',
          updatedAt: '2026-05-11T04:00:00.000Z'
        },
        {
          id: 'base-2',
          issuer: 'Legacy',
          accountName: 'delete-me@example.com',
          secret: 'GEZDGNBVGY3TQOJQ',
          digits: 6,
          period: 30,
          algorithm: 'SHA1',
          tags: [],
          groupId: 'default',
          pinned: false,
          iconKey: null,
          updatedAt: '2026-05-11T04:00:00.000Z'
        }
      ]
    };
    const localVaultPayload: VaultPayload = {
      version: 1,
      accounts: [
        {
          ...baseVaultPayload.accounts[0],
          groupId: 'work',
          updatedAt: '2026-05-11T04:05:00.000Z'
        },
        baseVaultPayload.accounts[1],
        {
          id: 'local-3',
          issuer: 'Notion',
          accountName: 'workspace-owner',
          secret: 'JBSWY3DPEHPK3PXP',
          digits: 6,
          period: 30,
          algorithm: 'SHA1',
          tags: ['work'],
          groupId: 'work',
          pinned: false,
          iconKey: 'notion',
          updatedAt: '2026-05-11T04:06:00.000Z'
        }
      ]
    };
    const remoteVaultPayload: VaultPayload = {
      version: 1,
      accounts: [
        {
          ...baseVaultPayload.accounts[0],
          issuer: 'GitHub Enterprise',
          updatedAt: '2026-05-11T04:07:00.000Z'
        },
        {
          id: 'remote-4',
          issuer: 'Slack',
          accountName: 'design-ops',
          secret: 'MZXW6YTBOI======',
          digits: 6,
          period: 30,
          algorithm: 'SHA1',
          tags: [],
          groupId: 'default',
          pinned: false,
          iconKey: 'slack',
          updatedAt: '2026-05-11T04:08:00.000Z'
        }
      ]
    };
    const baseVault = await encryptVault(baseVaultPayload, password);
    const localVault = await encryptVault(localVaultPayload, password);
    const remoteVault = await encryptVault(remoteVaultPayload, password);
    const vaultStorage = createMemoryVaultStorageAdapter();
    const syncStore = createMemorySyncMetadataStore({
      baseRevision: 'rev-base',
      baseFingerprint: await hashString(JSON.stringify(baseVaultPayload)),
      remoteRevision: 'rev-base',
      remoteUpdatedAt: '2026-05-11T04:00:00.000Z',
      baseVault
    } as never);
    const upload = vi.fn().mockImplementation(async (_profile, payload) => ({
      revision: 'rev-merged-2',
      updatedAt: '2026-05-11T04:10:00.000Z',
      etag: '"etag-merged-2"',
      encryptedVault: payload.encryptedVault
    }));

    await vaultStorage.area.set({ vault: localVault });
    setCurrentMasterPassword(password);

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
          revision: 'rev-remote-2',
          updatedAt: '2026-05-11T04:08:00.000Z',
          etag: '"etag-remote-2"',
          encryptedVault: remoteVault
        }),
        upload
      },
      now: () => '2026-05-11T04:10:00.000Z'
    });

    const result = await service.manualSync();
    const mergedVault = await decryptVault(result.localVault!, password);
    const mergedPrimary = mergedVault.accounts.find((account) => account.id === 'base-1');

    expect(result.status).toBe('pushed');
    expect(result.merged).toBe(true);
    expect(upload).toHaveBeenCalledTimes(1);
    expect(mergedVault.accounts.map((account) => account.id).sort()).toEqual([
      'base-1',
      'local-3',
      'remote-4'
    ]);
    expect(mergedPrimary).toMatchObject({
      issuer: 'GitHub Enterprise',
      groupId: 'work'
    });
  });
});

async function hashString(value: string) {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', encoded);

  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
