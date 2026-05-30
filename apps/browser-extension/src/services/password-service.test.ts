import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearEncryptedVault,
  decryptVault,
  encryptVault,
  loadEncryptedVault,
  saveEncryptedVault,
  type VaultPayload
} from '@totp/core';
import type { WebDavProfile } from '@totp/sync';
import { clearCurrentMasterPassword, setCurrentMasterPassword } from '../state/master-password-store';
import { accountService } from './account-service';
import { passwordOps } from './password-service';
import { syncStore, vaultStorage, webDavClient } from './settings-storage';

const profile: WebDavProfile = {
  id: 'webdav-primary',
  enabled: true,
  baseUrl: 'https://dav.example.com',
  filePath: '/totp/vault.json'
};

const emptyMetadata = {
  profile: null,
  baseRevision: null,
  baseFingerprint: null,
  baseVault: null,
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

describe('passwordOps.changeMasterPassword', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    accountService.__resetForTests?.();
    clearCurrentMasterPassword();
    await clearEncryptedVault(vaultStorage);
    await syncStore.replace(emptyMetadata);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    clearCurrentMasterPassword();
  });

  it('allows changing to a short master password', async () => {
    const vault: VaultPayload = { version: 1, accounts: [] };
    await saveEncryptedVault(await encryptVault(vault, 'old-password'), vaultStorage);
    setCurrentMasterPassword('old-password');

    await passwordOps.changeMasterPassword('old-password', '1');

    const storedVault = await loadEncryptedVault(vaultStorage);
    await expect(decryptVault(storedVault!, '1')).resolves.toMatchObject({ accounts: [] });
    await expect(decryptVault(storedVault!, 'old-password')).rejects.toThrow();
  });
});

describe('passwordOps.verifyRemoteMasterPassword', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    accountService.__resetForTests?.();
    clearCurrentMasterPassword();
    await clearEncryptedVault(vaultStorage);
    await syncStore.replace(emptyMetadata);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    clearCurrentMasterPassword();
  });

  it('hydrates verified remote accounts without triggering local mutation persistence', async () => {
    const localPassword = 'local-password-1234';
    const remotePassword = 'remote-9!';
    const localVault: VaultPayload = { version: 1, accounts: [] };
    const remoteVault: VaultPayload = {
      version: 1,
      accounts: [
        {
          id: 'remote-1',
          issuer: 'GitHub',
          accountName: 'remote@example.com',
          secret: 'JBSWY3DPEHPK3PXP',
          digits: 6,
          period: 30,
          algorithm: 'SHA1',
          tags: [],
          groupId: 'default',
          pinned: false,
          iconKey: 'github',
          updatedAt: '2026-05-21T10:00:00.000Z'
        }
      ]
    };
    const remoteEncryptedVault = await encryptVault(remoteVault, remotePassword);
    const replaceSpy = vi.spyOn(accountService, 'replaceAllAccounts');
    const silentReplaceSpy = vi.spyOn(accountService, 'replaceAllAccountsSilently');

    await saveEncryptedVault(await encryptVault(localVault, localPassword), vaultStorage);
    setCurrentMasterPassword(localPassword);
    await syncStore.save({
      profile,
      lastStatus: 'blocked',
      lastError: '远端保管库需要主密码验证后才能继续同步。'
    });
    vi.spyOn(webDavClient, 'download').mockResolvedValue({
      revision: 'rev-remote',
      updatedAt: '2026-05-21T10:01:00.000Z',
      etag: '"etag-remote"',
      encryptedVault: remoteEncryptedVault
    });

    await passwordOps.verifyRemoteMasterPassword(remotePassword);

    expect(silentReplaceSpy).toHaveBeenCalledTimes(1);
    expect(replaceSpy).not.toHaveBeenCalled();

    const storedVault = await loadEncryptedVault(vaultStorage);
    await expect(decryptVault(storedVault!, remotePassword)).resolves.toMatchObject({
      accounts: [{ accountName: 'remote@example.com' }]
    });
    await expect(decryptVault(storedVault!, localPassword)).rejects.toThrow();
  });

  it('pushes local changes with a verified short remote password without corrupting the remote vault', async () => {
    const localPassword = 'local-password-1234';
    const remotePassword = 'remote-9!';
    const localVault: VaultPayload = {
      version: 1,
      accounts: [
        {
          id: 'local-1',
          issuer: 'Local',
          accountName: 'local@example.com',
          secret: 'JBSWY3DPEHPK3PXP',
          digits: 6,
          period: 30,
          algorithm: 'SHA1',
          tags: [],
          groupId: 'default',
          pinned: false,
          iconKey: null,
          updatedAt: '2026-05-21T10:00:00.000Z'
        }
      ]
    };
    const remoteVault: VaultPayload = { version: 1, accounts: [] };
    const remoteEncryptedVault = await encryptVault(remoteVault, remotePassword);
    const upload = vi.spyOn(webDavClient, 'upload').mockImplementation(async (_profile, payload) => ({
      revision: payload.revision,
      updatedAt: payload.updatedAt,
      etag: '"etag-uploaded"',
      encryptedVault: payload.encryptedVault
    }));

    await saveEncryptedVault(await encryptVault(localVault, localPassword), vaultStorage);
    setCurrentMasterPassword(localPassword);
    await syncStore.save({
      profile,
      lastStatus: 'blocked',
      lastError: '远端保管库需要主密码验证后才能继续同步。'
    });
    vi.spyOn(webDavClient, 'download').mockResolvedValue({
      revision: 'rev-remote-empty',
      updatedAt: '2026-05-21T10:01:00.000Z',
      etag: '"etag-remote-empty"',
      encryptedVault: remoteEncryptedVault
    });

    await passwordOps.verifyRemoteMasterPassword(remotePassword);

    expect(upload).toHaveBeenCalledTimes(1);
    const uploadedVault = upload.mock.calls[0][1].encryptedVault;
    await expect(decryptVault(uploadedVault, remotePassword)).resolves.toMatchObject({
      accounts: [{ accountName: 'local@example.com' }]
    });
    await expect(decryptVault(uploadedVault, localPassword)).rejects.toThrow();
  });
});
