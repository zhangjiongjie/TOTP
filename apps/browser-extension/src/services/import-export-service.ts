import {
  exportVaultBundle,
  importVaultBundle,
  clearEncryptedVault
} from '@totp/core';
import { accountService } from './account-service';
import type { BackupMode, ExportVaultResult, ImportVaultResult } from './settings-service';
import { syncStore, vaultStorage } from './settings-storage';

export const importExportOps = {
  async exportVault(
    options: { mode?: BackupMode; password?: string } = {}
  ): Promise<ExportVaultResult> {
    const accounts = await accountService.listAccounts();
    const mode = options.mode ?? 'plain';
    const bundle = await exportVaultBundle(
      { version: 1, accounts },
      options.password,
      mode
    );

    return {
      filename: `totp-backup-${mode}.json`,
      content: JSON.stringify(bundle, null, 2),
      mode
    };
  },

  async importVault(
    file: File,
    options: { password?: string } = {}
  ): Promise<ImportVaultResult> {
    const raw = await file.text();
    const bundle = JSON.parse(raw) as { mode?: BackupMode };
    const vault = await importVaultBundle(bundle, options.password);
    await accountService.replaceAllAccounts(vault.accounts);
    await resetSyncCache();

    return {
      importedCount: vault.accounts.length,
      mode: bundle.mode === 'encrypted' ? 'encrypted' : 'plain'
    };
  }
};

async function resetSyncCache() {
  await clearEncryptedVault(vaultStorage);
  const current = await syncStore.load();
  await syncStore.replace({
    ...current,
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
  });
}

