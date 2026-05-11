import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { decryptVault, encryptVault } from '../core/vault/crypto';
import {
  __corruptStoredVaultForTests,
  __readSyncMetadataForTests,
  __readStoredVaultForTests,
  __resetForTests,
  __runAutomaticSyncNowForTests,
  __saveSyncProfileForTests,
  __seedStoredVaultForTests,
  __setSyncClientForTests,
  initializeApp,
  submitUnlock
} from '../state/app-store';
import { accountService } from '../services/account-service';
import { runRuntimeManualSync } from '../services/runtime-sync-service';
import { App } from './App';

describe('App', () => {
  beforeEach(async () => {
    await __resetForTests();
    window.location.hash = '#settings';
  });

  it('routes locked sessions into the setup flow before showing protected pages', async () => {
    render(<App />);

    expect(await screen.findByRole('heading', { name: '创建主密码' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '备份与同步' })).not.toBeInTheDocument();
  });

  it('routes existing vaults into the unlock flow before showing protected pages', async () => {
    await __seedStoredVaultForTests();

    render(<App />);

    expect(await screen.findByRole('heading', { name: '输入主密码' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '备份与同步' })).not.toBeInTheDocument();
  });

  it('hydrates accounts from the encrypted vault after a successful unlock', async () => {
    await accountService.replaceAllAccounts([
      {
        id: 'vault-1',
        issuer: 'Custom',
        accountName: 'vault-user',
        secret: 'JBSWY3DPEHPK3PXP',
        digits: 6,
        period: 30,
        algorithm: 'SHA1',
        tags: ['restored'],
        groupId: 'personal',
        pinned: true,
        iconKey: null,
        updatedAt: '2026-05-10T08:00:00.000Z'
      }
    ]);
    await __seedStoredVaultForTests();
    accountService.__resetForTests?.();

    render(<App />);

    fireEvent.change(await screen.findByLabelText('主密码'), {
      target: { value: 'very-secure-password' }
    });
    fireEvent.click(screen.getByRole('button', { name: '解锁' }));

    expect(await screen.findByText('vault-user')).toBeInTheDocument();
    expect(screen.getByText('Custom')).toBeInTheDocument();
  });

  it('persists account changes back into the encrypted vault after setup unlock', async () => {
    render(<App />);

    fireEvent.change(await screen.findByLabelText('主密码'), {
      target: { value: 'very-secure-password' }
    });
    fireEvent.click(screen.getByRole('button', { name: '创建并继续' }));
    await screen.findByRole('heading', { name: 'TOTP Authenticator' });

    await act(async () => {
      await accountService.addAccount({
        issuer: 'Persisted',
        accountName: 'local-change',
        secret: 'GEZDGNBVGY3TQOJQ',
        digits: 6,
        period: 30,
        algorithm: 'SHA1'
      });
    });

    await waitFor(async () => {
      const storedVault = await __readStoredVaultForTests();

      expect(
        storedVault?.accounts.some((account) => account.accountName === 'local-change')
      ).toBe(true);
    });
  });

  it('persists account changes after unlocking an existing vault', async () => {
    await __seedStoredVaultForTests();

    render(<App />);

    fireEvent.change(await screen.findByLabelText('主密码'), {
      target: { value: 'very-secure-password' }
    });
    fireEvent.click(screen.getByRole('button', { name: '解锁' }));
    await screen.findByRole('heading', { name: 'TOTP Authenticator' });

    await act(async () => {
      await accountService.addAccount({
        issuer: 'AfterUnlock',
        accountName: 'existing-vault-change',
        secret: 'GEZDGNBVGY3TQOJQ',
        digits: 6,
        period: 30,
        algorithm: 'SHA1'
      });
    });

    await waitFor(async () => {
      const storedVault = await __readStoredVaultForTests();

      expect(
        storedVault?.accounts.some((account) => account.accountName === 'existing-vault-change')
      ).toBe(true);
    });
  });

  it('keeps corrupted stored vaults on the unlock flow and shows the error', async () => {
    await __corruptStoredVaultForTests();

    render(<App />);

    expect(await screen.findByRole('heading', { name: '输入主密码' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('主密码'), {
      target: { value: 'very-secure-password' }
    });
    fireEvent.click(screen.getByRole('button', { name: '解锁' }));

    expect(await screen.findByText('Stored vault payload is invalid')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '输入主密码' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '创建主密码' })).not.toBeInTheDocument();
  });

  it('pulls the remote vault on first sync when the freshly created local vault is empty', async () => {
    const password = 'very-secure-password';
    const remoteVault = await encryptVault(
      {
        version: 1,
        accounts: [
          {
            id: 'remote-1',
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
            updatedAt: '2026-05-11T10:00:00.000Z'
          }
        ]
      },
      password
    );
    const upload = vi.fn();

    __setSyncClientForTests({
      download: vi.fn().mockResolvedValue({
        revision: 'rev-remote-1',
        updatedAt: '2026-05-11T10:00:00.000Z',
        etag: '"etag-remote-1"',
        encryptedVault: remoteVault
      }),
      upload
    });
    await __saveSyncProfileForTests({
      id: 'webdav-primary',
      enabled: true,
      baseUrl: 'https://dav.example.com',
      filePath: '/vault.json',
      syncIntervalMs: 300000
    });

    render(<App />);

    fireEvent.change(await screen.findByLabelText('主密码'), {
      target: { value: password }
    });
    fireEvent.click(screen.getByRole('button', { name: '创建并继续' }));

    expect(await screen.findByText('owner@example.com')).toBeInTheDocument();
    expect(screen.getByText('Notion')).toBeInTheDocument();
    expect(upload).not.toHaveBeenCalled();

    await waitFor(async () => {
      const metadata = await __readSyncMetadataForTests();
      expect(metadata.lastStatus).toBe('pulled');
      expect(metadata.pendingConflict).toBeNull();
    });
  });

  it('pushes local account changes to the remote automatically after unlock', async () => {
    const password = 'very-secure-password';
    const emptyVault = await encryptVault({ version: 1, accounts: [] }, password);
    const upload = vi.fn().mockImplementation(async (_profile, payload) => ({
      revision: 'rev-local-1',
      updatedAt: '2026-05-11T10:05:00.000Z',
      etag: '"etag-local-1"',
      encryptedVault: payload.encryptedVault
    }));

    __setSyncClientForTests({
      download: vi.fn().mockResolvedValue({
        revision: 'rev-remote-empty',
        updatedAt: '2026-05-11T10:00:00.000Z',
        etag: '"etag-remote-empty"',
        encryptedVault: emptyVault
      }),
      upload
    });
    await __saveSyncProfileForTests({
      id: 'webdav-primary',
      enabled: true,
      baseUrl: 'https://dav.example.com',
      filePath: '/vault.json',
      syncIntervalMs: 300000
    });

    render(<App />);

    fireEvent.change(await screen.findByLabelText('主密码'), {
      target: { value: password }
    });
    fireEvent.click(screen.getByRole('button', { name: '创建并继续' }));
    await screen.findByRole('heading', { name: 'TOTP Authenticator' });

    await act(async () => {
      await accountService.addAccount({
        issuer: 'GitHub',
        accountName: 'sync-me@example.com',
        secret: 'GEZDGNBVGY3TQOJQ',
        digits: 6,
        period: 30,
        algorithm: 'SHA1'
      });
    });

    expect(await screen.findByText('sync-me@example.com')).toBeInTheDocument();

    await waitFor(() => {
      expect(upload).toHaveBeenCalledTimes(1);
    });

    const uploadedPayload = upload.mock.calls[0]?.[1];
    const decryptedVault = await decryptVault(uploadedPayload.encryptedVault, password);

    expect(
      decryptedVault.accounts.some((account) => account.accountName === 'sync-me@example.com')
    ).toBe(true);
  });

  it('applies remote deletions on follow-up automatic sync runs', async () => {
    const password = 'very-secure-password';
    let currentRemoteSnapshot = {
      revision: 'rev-remote-1',
      updatedAt: '2026-05-11T10:00:00.000Z',
      etag: '"etag-remote-1"',
      encryptedVault: await encryptVault(
        {
          version: 1,
          accounts: [
            {
              id: 'remote-1',
              issuer: 'GitHub',
              accountName: 'remove-me@example.com',
              secret: 'JBSWY3DPEHPK3PXP',
              digits: 6,
              period: 30,
              algorithm: 'SHA1',
              tags: [],
              groupId: 'default',
              pinned: false,
              iconKey: 'github',
              updatedAt: '2026-05-11T10:00:00.000Z'
            }
          ]
        },
        password
      )
    };
    const download = vi.fn().mockImplementation(async () => currentRemoteSnapshot);

    __setSyncClientForTests({
      download,
      upload: vi.fn()
    });
    await __saveSyncProfileForTests({
      id: 'webdav-primary',
      enabled: true,
      baseUrl: 'https://dav.example.com',
      filePath: '/vault.json',
      syncIntervalMs: 300000
    });

    render(<App />);

    fireEvent.change(await screen.findByLabelText('主密码'), {
      target: { value: password }
    });
    fireEvent.click(screen.getByRole('button', { name: '创建并继续' }));

    expect(await screen.findByText('remove-me@example.com')).toBeInTheDocument();

    currentRemoteSnapshot = {
      revision: 'rev-remote-2',
      updatedAt: '2026-05-11T10:10:00.000Z',
      etag: '"etag-remote-2"',
      encryptedVault: await encryptVault({ version: 1, accounts: [] }, password)
    };

    await act(async () => {
      await __runAutomaticSyncNowForTests();
    });

    await waitFor(() => {
      expect(screen.queryByText('remove-me@example.com')).not.toBeInTheDocument();
    });
  });

  it('keeps newly added accounts when the user triggers a manual sync immediately', async () => {
    const password = 'very-secure-password';
    const emptyVault = await encryptVault({ version: 1, accounts: [] }, password);
    const upload = vi.fn().mockImplementation(async (_profile, payload) => ({
      revision: 'rev-local-immediate',
      updatedAt: '2026-05-11T10:05:00.000Z',
      etag: '"etag-local-immediate"',
      encryptedVault: payload.encryptedVault
    }));

    __setSyncClientForTests({
      download: vi.fn().mockResolvedValue({
        revision: 'rev-remote-empty',
        updatedAt: '2026-05-11T10:00:00.000Z',
        etag: '"etag-remote-empty"',
        encryptedVault: emptyVault
      }),
      upload
    });
    await __saveSyncProfileForTests({
      id: 'webdav-primary',
      enabled: true,
      baseUrl: 'https://dav.example.com',
      filePath: '/vault.json',
      syncIntervalMs: 300000
    });

    render(<App />);

    fireEvent.change(await screen.findByLabelText('主密码'), {
      target: { value: password }
    });
    fireEvent.click(screen.getByRole('button', { name: '创建并继续' }));
    await screen.findByRole('heading', { name: 'TOTP Authenticator' });

    await act(async () => {
      await accountService.addAccount({
        issuer: 'Immediate Sync',
        accountName: 'race@example.com',
        secret: 'GEZDGNBVGY3TQOJQ',
        digits: 6,
        period: 30,
        algorithm: 'SHA1'
      });
      await runRuntimeManualSync();
    });

    await waitFor(() => {
      expect(screen.getByText('race@example.com')).toBeInTheDocument();
    });

    const storedVault = await __readStoredVaultForTests(password);
    expect(storedVault?.accounts.some((account) => account.accountName === 'race@example.com')).toBe(
      true
    );
    expect(upload).toHaveBeenCalled();
  });

  it('reuses the pending automatic push when manual sync is triggered during upload', async () => {
    const password = 'very-secure-password';
    const emptyVault = await encryptVault({ version: 1, accounts: [] }, password);
    let resolveUpload:
      | ((value: {
          revision: string;
          updatedAt: string;
          etag: string;
          encryptedVault: EncryptedVaultBlob;
        }) => void)
      | null = null;
    const upload = vi.fn().mockImplementation(
      async (_profile, payload) =>
        new Promise((resolve) => {
          resolveUpload = resolve;
          void payload;
        })
    );

    __setSyncClientForTests({
      download: vi.fn().mockResolvedValue({
        revision: 'rev-remote-empty',
        updatedAt: '2026-05-11T10:00:00.000Z',
        etag: '"etag-remote-empty"',
        encryptedVault: emptyVault
      }),
      upload
    });
    await __saveSyncProfileForTests({
      id: 'webdav-primary',
      enabled: true,
      baseUrl: 'https://dav.example.com',
      filePath: '/vault.json',
      syncIntervalMs: 300000
    });

    render(<App />);

    fireEvent.change(await screen.findByLabelText('主密码'), {
      target: { value: password }
    });
    fireEvent.click(screen.getByRole('button', { name: '创建并继续' }));
    await screen.findByRole('heading', { name: 'TOTP Authenticator' });

    await act(async () => {
      await accountService.addAccount({
        issuer: 'Pending Upload',
        accountName: 'upload-race@example.com',
        secret: 'GEZDGNBVGY3TQOJQ',
        digits: 6,
        period: 30,
        algorithm: 'SHA1'
      });
    });

    const manualSyncPromise = runRuntimeManualSync();

    await waitFor(() => {
      expect(upload).toHaveBeenCalledTimes(1);
      expect(resolveUpload).not.toBeNull();
    });
    expect(screen.getByRole('button', { name: 'Sync' })).toBeDisabled();
    expect(screen.getByText('正在同步本地变更，请稍候...')).toBeInTheDocument();

    resolveUpload?.({
      revision: 'rev-upload-race',
      updatedAt: '2026-05-11T10:07:00.000Z',
      etag: '"etag-upload-race"',
      encryptedVault: upload.mock.calls[0][1].encryptedVault
    });

    await act(async () => {
      await manualSyncPromise;
    });

    expect(upload).toHaveBeenCalledTimes(1);
    const storedVault = await __readStoredVaultForTests(password);
    expect(
      storedVault?.accounts.some((account) => account.accountName === 'upload-race@example.com')
    ).toBe(true);
  });

  it('does not wipe a newly added account when manual sync races with the first background pull', async () => {
    const password = 'very-secure-password';
    const emptyVault = await encryptVault({ version: 1, accounts: [] }, password);
    let resolveInitialDownload:
      | ((value: {
          revision: string;
          updatedAt: string;
          etag: string;
          encryptedVault: typeof emptyVault;
        }) => void)
      | null = null;
    let firstDownloadPending = true;
    const upload = vi.fn().mockImplementation(async (_profile, payload) => ({
      revision: 'rev-manual-race',
      updatedAt: '2026-05-11T10:06:00.000Z',
      etag: '"etag-manual-race"',
      encryptedVault: payload.encryptedVault
    }));

    __setSyncClientForTests({
      download: vi.fn().mockImplementation(() => {
        if (firstDownloadPending) {
          return new Promise((resolve) => {
            resolveInitialDownload = (value) => {
              firstDownloadPending = false;
              resolve(value);
            };
          });
        }

        return Promise.resolve({
          revision: 'rev-remote-empty',
          updatedAt: '2026-05-11T10:00:00.000Z',
          etag: '"etag-remote-empty"',
          encryptedVault: emptyVault
        });
      }),
      upload
    });
    await __saveSyncProfileForTests({
      id: 'webdav-primary',
      enabled: true,
      baseUrl: 'https://dav.example.com',
      filePath: '/vault.json',
      syncIntervalMs: 300000
    });

    await initializeApp();
    await submitUnlock(password);
    await waitFor(() => {
      expect(resolveInitialDownload).not.toBeNull();
    });

    await act(async () => {
      await accountService.addAccount({
        issuer: 'Immediate Sync',
        accountName: 'first-pull-race@example.com',
        secret: 'GEZDGNBVGY3TQOJQ',
        digits: 6,
        period: 30,
        algorithm: 'SHA1'
      });

      resolveInitialDownload?.({
        revision: 'rev-remote-empty',
        updatedAt: '2026-05-11T10:00:00.000Z',
        etag: '"etag-remote-empty"',
        encryptedVault: emptyVault
      });

      await runRuntimeManualSync();
    });

    const storedVault = await __readStoredVaultForTests(password);
    expect(
      storedVault?.accounts.some(
        (account) => account.accountName === 'first-pull-race@example.com'
      )
    ).toBe(true);
    const accounts = await accountService.listAccounts();
    expect(
      accounts.some((account) => account.accountName === 'first-pull-race@example.com')
    ).toBe(true);
    expect(upload).toHaveBeenCalled();
  }, 10000);

  it('does not let a stale background pull wipe newer local accounts', async () => {
    const password = 'very-secure-password';
    const emptyVault = await encryptVault({ version: 1, accounts: [] }, password);
    let resolveDownload: ((value: {
      revision: string;
      updatedAt: string;
      etag: string;
      encryptedVault: typeof emptyVault;
    }) => void) | null = null;
    const upload = vi.fn().mockImplementation(async (_profile, payload) => ({
      revision: 'rev-after-stale-pull',
      updatedAt: '2026-05-11T10:06:00.000Z',
      etag: '"etag-after-stale-pull"',
      encryptedVault: payload.encryptedVault
    }));

    __setSyncClientForTests({
      download: vi.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveDownload = resolve;
          })
      ),
      upload
    });
    await __saveSyncProfileForTests({
      id: 'webdav-primary',
      enabled: true,
      baseUrl: 'https://dav.example.com',
      filePath: '/vault.json',
      syncIntervalMs: 300000
    });

    render(<App />);

    fireEvent.change(await screen.findByLabelText('主密码'), {
      target: { value: password }
    });
    fireEvent.click(screen.getByRole('button', { name: '创建并继续' }));
    await screen.findByRole('heading', { name: 'TOTP Authenticator' });

    await act(async () => {
      await accountService.addAccount({
        issuer: 'Background Race',
        accountName: 'stale@example.com',
        secret: 'GEZDGNBVGY3TQOJQ',
        digits: 6,
        period: 30,
        algorithm: 'SHA1'
      });
    });

    resolveDownload?.({
      revision: 'rev-remote-empty',
      updatedAt: '2026-05-11T10:00:00.000Z',
      etag: '"etag-remote-empty"',
      encryptedVault: emptyVault
    });

    await waitFor(() => {
      expect(screen.getByText('stale@example.com')).toBeInTheDocument();
    });

    await waitFor(async () => {
      const storedVault = await __readStoredVaultForTests(password);
      expect(
        storedVault?.accounts.some((account) => account.accountName === 'stale@example.com')
      ).toBe(true);
    });
  });

  it('does not let a stale background pull resurrect a locally deleted account', async () => {
    const password = 'very-secure-password';
    await accountService.replaceAllAccounts([
      {
        id: 'delete-race-1',
        issuer: 'GitHub',
        accountName: 'deleted@example.com',
        secret: 'JBSWY3DPEHPK3PXP',
        digits: 6,
        period: 30,
        algorithm: 'SHA1',
        tags: [],
        groupId: 'default',
        pinned: false,
        iconKey: 'github',
        updatedAt: '2026-05-11T10:00:00.000Z'
      }
    ]);
    await __seedStoredVaultForTests(password);
    let resolveDownload: ((value: {
      revision: string;
      updatedAt: string;
      etag: string;
      encryptedVault: EncryptedVaultBlob;
    }) => void) | null = null;
    const remoteVault = await encryptVault(
      {
        version: 1,
        accounts: [
          {
            id: 'delete-race-1',
            issuer: 'GitHub',
            accountName: 'deleted@example.com',
            secret: 'JBSWY3DPEHPK3PXP',
            digits: 6,
            period: 30,
            algorithm: 'SHA1',
            tags: [],
            groupId: 'default',
            pinned: false,
            iconKey: 'github',
            updatedAt: '2026-05-11T10:00:00.000Z'
          }
        ]
      },
      password
    );

    __setSyncClientForTests({
      download: vi.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveDownload = resolve;
          })
      ),
      upload: vi.fn()
    });
    await __saveSyncProfileForTests({
      id: 'webdav-primary',
      enabled: true,
      baseUrl: 'https://dav.example.com',
      filePath: '/vault.json',
      syncIntervalMs: 300000
    });

    render(<App />);

    fireEvent.change(await screen.findByLabelText('主密码'), {
      target: { value: password }
    });
    fireEvent.click(screen.getByRole('button', { name: '解锁' }));
    await screen.findByText('deleted@example.com');

    await act(async () => {
      await accountService.deleteAccount('delete-race-1');
    });

    resolveDownload?.({
      revision: 'rev-remote-stale-delete',
      updatedAt: '2026-05-11T10:01:00.000Z',
      etag: '"etag-remote-stale-delete"',
      encryptedVault: remoteVault
    });

    await waitFor(() => {
      expect(screen.queryByText('deleted@example.com')).not.toBeInTheDocument();
    });

    await waitFor(async () => {
      const storedVault = await __readStoredVaultForTests(password);
      expect(
        storedVault?.accounts.some((account) => account.accountName === 'deleted@example.com')
      ).toBe(false);
    });
  });
});
