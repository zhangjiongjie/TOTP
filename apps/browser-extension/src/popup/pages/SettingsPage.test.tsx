import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsPage } from './SettingsPage';

const {
  mockGetSnapshot,
  mockSaveWebDavProfile,
  mockExportVault,
  mockImportVault,
  mockResolveConflict
} = vi.hoisted(() => ({
  mockGetSnapshot: vi.fn(),
  mockSaveWebDavProfile: vi.fn(),
  mockExportVault: vi.fn(),
  mockImportVault: vi.fn(),
  mockResolveConflict: vi.fn()
}));

vi.mock('../../services/settings-service', () => ({
  settingsService: {
    getSnapshot: mockGetSnapshot,
    saveWebDavProfile: mockSaveWebDavProfile,
    exportVault: mockExportVault,
    importVault: mockImportVault,
    resolveConflict: mockResolveConflict
  }
}));

describe('SettingsPage', () => {
  beforeEach(() => {
    mockGetSnapshot.mockReset();
    mockSaveWebDavProfile.mockReset();
    mockExportVault.mockReset();
    mockImportVault.mockReset();
    mockResolveConflict.mockReset();

    mockGetSnapshot.mockResolvedValue({
      webDavProfile: null,
      syncMetadata: {
        lastStatus: null,
        lastSyncedAt: null,
        lastError: null,
        pendingConflict: null
      }
    });
  });

  it('renders the WebDAV form from stored settings and saves when enabling sync', async () => {
    mockGetSnapshot.mockResolvedValueOnce({
      webDavProfile: {
        id: 'webdav-primary',
        enabled: true,
        baseUrl: 'https://dav.example.com/remote.php/dav/files/demo',
        filePath: '/totp/vault.json',
        username: 'alice',
        password: 'secret',
        syncIntervalMs: 300000
      },
      syncMetadata: {
        lastStatus: 'pushed',
        lastSyncedAt: '2026-05-10T08:00:00.000Z',
        lastError: null,
        pendingConflict: null
      }
    });
    mockGetSnapshot.mockResolvedValueOnce({
      webDavProfile: {
        id: 'webdav-primary',
        enabled: true,
        baseUrl: 'https://dav.example.com/remote.php/dav/files/demo',
        filePath: '/totp/backup.json',
        username: 'alice',
        password: 'secret',
        syncIntervalMs: 300000
      },
      syncMetadata: {
        lastStatus: 'pushed',
        lastSyncedAt: '2026-05-10T08:00:00.000Z',
        lastError: null,
        pendingConflict: null
      }
    });

    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByLabelText('WebDAV 服务地址')).toHaveValue(
        'https://dav.example.com/remote.php/dav/files/demo'
      );
    });
    expect(screen.getByText('已保存 2026-05-10 16:00')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '设置' })).toBeInTheDocument();
    expect(screen.queryByText('备份与同步')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '保存 WebDAV 设置' })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('远端文件路径'), {
      target: { value: '/totp/backup.json' }
    });
    fireEvent.click(screen.getByRole('checkbox', { name: '启用同步' }));
    fireEvent.click(screen.getByRole('checkbox', { name: '启用同步' }));

    await waitFor(() => {
      expect(mockSaveWebDavProfile).toHaveBeenCalledWith({
        id: 'webdav-primary',
        enabled: true,
        baseUrl: 'https://dav.example.com/remote.php/dav/files/demo',
        filePath: '/totp/backup.json',
        username: 'alice',
        password: 'secret',
        syncIntervalMs: 300000
      });
    });
    expect(await screen.findByText('已启用 WebDAV 同步')).toBeInTheDocument();
  });

  it('exports the vault and imports a selected backup file', async () => {
    mockExportVault.mockResolvedValueOnce({
      filename: 'totp-backup.json',
      content: '{"mode":"plain"}'
    });
    mockImportVault.mockResolvedValueOnce({
      importedCount: 2,
      mode: 'plain'
    });

    render(<SettingsPage />);

    fireEvent.click(screen.getByRole('button', { name: '导出' }));
    await waitFor(() => {
      expect(mockExportVault).toHaveBeenCalled();
    });
    expect(await screen.findByText('已导出')).toBeInTheDocument();

    const importFile = new File(['{"mode":"plain"}'], 'backup.json', {
      type: 'application/json'
    });
    fireEvent.change(await screen.findByLabelText('导入'), {
      target: { files: [importFile] }
    });

    expect(mockImportVault).toHaveBeenCalledWith(importFile, { password: undefined });
    expect(await screen.findByText('已导入 2 个账号')).toBeInTheDocument();
  });

  it('shows WebDAV save errors next to the WebDAV form', async () => {
    mockSaveWebDavProfile.mockRejectedValueOnce(new Error('WebDAV unavailable.'));

    render(<SettingsPage />);

    fireEvent.click(await screen.findByRole('checkbox', { name: '启用同步' }));

    expect(await screen.findByText('WebDAV unavailable.')).toBeInTheDocument();
  });

  it('opens the sync conflict dialog and resolves with the chosen version', async () => {
    const pendingConflict = {
      kind: 'vault-conflict',
      detectedAt: '2026-05-10T08:05:00.000Z',
      baseRevision: 'base-1',
      baseFingerprint: 'base-fingerprint',
      local: {
        revision: 'local-1',
        fingerprint: 'local-fingerprint',
        updatedAt: '2026-05-10T08:01:00.000Z',
        encryptedVault: {
          formatVersion: 1,
          kdf: { name: 'PBKDF2', iterations: 100000, hash: 'SHA-256' },
          cipher: 'AES-GCM',
          salt: 'salt',
          iv: 'iv',
          ciphertext: 'ciphertext',
          passwordVerifier: 'verifier'
        },
        etag: null
      },
      remote: {
        revision: 'remote-1',
        fingerprint: 'remote-fingerprint',
        updatedAt: '2026-05-10T08:02:00.000Z',
        encryptedVault: {
          formatVersion: 1,
          kdf: { name: 'PBKDF2', iterations: 100000, hash: 'SHA-256' },
          cipher: 'AES-GCM',
          salt: 'salt',
          iv: 'iv',
          ciphertext: 'ciphertext',
          passwordVerifier: 'verifier'
        },
        etag: '"etag-1"'
      }
    };

    mockGetSnapshot.mockResolvedValueOnce({
      webDavProfile: null,
      syncMetadata: {
        lastStatus: 'conflict',
        lastSyncedAt: '2026-05-10T08:00:00.000Z',
        lastError: null,
        pendingConflict
      }
    });
    mockGetSnapshot.mockResolvedValueOnce({
      webDavProfile: null,
      syncMetadata: {
        lastStatus: 'pushed',
        lastSyncedAt: '2026-05-10T08:06:00.000Z',
        lastError: null,
        pendingConflict: null
      }
    });
    mockResolveConflict.mockResolvedValueOnce({
      status: 'pushed',
      source: 'local',
      localRevision: 'local-1',
      remoteRevision: 'local-1',
      localVault: null,
      pendingConflict: null
    });

    render(<SettingsPage />);

    fireEvent.click(await screen.findByRole('button', { name: '查看同步冲突' }));
    fireEvent.click(await screen.findByRole('button', { name: /保留本地版本/i }));

    await waitFor(() => {
      expect(mockResolveConflict).toHaveBeenCalledWith(pendingConflict, 'local');
    });
    expect(await screen.findByText('已保留本地版本。')).toBeInTheDocument();
  });
});
