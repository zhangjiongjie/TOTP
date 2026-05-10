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

  it('renders the WebDAV form from stored settings and saves updates', async () => {
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

    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByLabelText('WebDAV server URL')).toHaveValue(
        'https://dav.example.com/remote.php/dav/files/demo'
      );
    });
    expect(screen.getByText('Last sync: 2026-05-10T08:00:00.000Z')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Remote file path'), {
      target: { value: '/totp/backup.json' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save WebDAV settings' }));

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
    expect(await screen.findByText('WebDAV settings saved.')).toBeInTheDocument();
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

    fireEvent.click(screen.getByRole('button', { name: 'Export backup' }));
    await waitFor(() => {
      expect(mockExportVault).toHaveBeenCalled();
    });
    expect(await screen.findByText('Exported totp-backup.json.')).toBeInTheDocument();

    const importFile = new File(['{"mode":"plain"}'], 'backup.json', {
      type: 'application/json'
    });
    fireEvent.change(await screen.findByLabelText('Import backup file'), {
      target: { files: [importFile] }
    });

    expect(mockImportVault).toHaveBeenCalledWith(importFile, { password: undefined });
    expect(await screen.findByText('Imported 2 accounts from plain backup.')).toBeInTheDocument();
  });

  it('shows WebDAV save errors next to the WebDAV form', async () => {
    mockSaveWebDavProfile.mockRejectedValueOnce(new Error('WebDAV unavailable.'));

    render(<SettingsPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Save WebDAV settings' }));

    expect(await screen.findByText('WebDAV unavailable.')).toBeInTheDocument();
  });

  it('opens the sync conflict dialog in read-only demo mode', async () => {
    mockGetSnapshot.mockResolvedValueOnce({
      webDavProfile: null,
      syncMetadata: {
        lastStatus: 'conflict',
        lastSyncedAt: '2026-05-10T08:00:00.000Z',
        lastError: null,
        pendingConflict: {
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
        }
      }
    });

    render(<SettingsPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Review sync conflict' }));

    expect(await screen.findByText(/read-only in this popup demo/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Keep local copy/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Use remote copy/i })).toBeDisabled();
  });
});
