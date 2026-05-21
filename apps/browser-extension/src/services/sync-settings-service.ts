import { decryptVault, encryptVaultWithKey, unlockVault } from '@totp/core';
import type { SyncRunResult } from '@totp/sync';
import type { PendingSyncConflict } from '@totp/sync';
import { type WebDavProfile } from '@totp/sync';
import { accountService } from './account-service';
import { createSyncService } from './sync-service';
import { getCurrentMasterPassword } from '../state/master-password-store';
import { syncStore, vaultStorage, webDavClient } from './settings-storage';

export const syncSettingsOps = {
  async runManualSync(): Promise<SyncRunResult> {
    const profile = await requireEnabledProfile();
    const service = createRuntimeSyncService(profile);
    const result = await service.manualSync();

    await applyRemoteAccountsIfNeeded(result);

    return result;
  },

  async resolveConflict(
    conflict: PendingSyncConflict,
    choice: 'local' | 'remote'
  ): Promise<SyncRunResult> {
    const profile = await requireEnabledProfile();
    const service = createRuntimeSyncService(profile);
    const resolvedConflict =
      choice === 'local' ? await rewrapLocalConflictWithRemoteKey(conflict) : conflict;
    const result = await service.resolveConflict(resolvedConflict, choice);

    await applyRemoteAccountsIfNeeded(result);

    return result;
  }
};

function createRuntimeSyncService(profile: WebDavProfile | null) {
  return createSyncService({
    profile,
    client: webDavClient,
    vaultStorage,
    syncStore
  });
}

async function requireEnabledProfile(): Promise<WebDavProfile> {
  const metadata = await syncStore.load();

  if (!metadata.profile?.enabled) {
    throw new Error('请先启用 WebDAV 同步。');
  }

  return metadata.profile;
}

async function rewrapLocalConflictWithRemoteKey(conflict: PendingSyncConflict) {
  const masterPassword = getCurrentMasterPassword();

  if (!masterPassword) {
    return conflict;
  }

  const [localVault, remoteUnlocked] = await Promise.all([
    decryptVault(conflict.local.encryptedVault, masterPassword),
    unlockVault(conflict.remote.encryptedVault, masterPassword)
  ]);
  const encryptedVault = await encryptVaultWithKey(
    localVault,
    conflict.remote.encryptedVault,
    remoteUnlocked.vaultKey
  );

  return {
    ...conflict,
    local: {
      ...conflict.local,
      encryptedVault
    }
  };
}

async function applyRemoteAccountsIfNeeded(result: SyncRunResult) {
  const masterPassword = getCurrentMasterPassword();

  if ((!result.merged && result.status !== 'pulled') || !result.localVault || !masterPassword) {
    return;
  }

  const decryptedVault = await decryptVault(result.localVault, masterPassword);
  await accountService.replaceAllAccounts(decryptedVault.accounts);
}
