import {
  decryptVault,
  encryptVaultWithKey,
  unlockVault
} from '@totp/core';
import type { SyncRunResult } from '@totp/sync';
import { accountService } from './account-service';
import { createSyncService } from './sync-service';
import { refreshAutomaticSync } from '../state/app-store';
import type { PendingSyncConflict } from '@totp/sync';
import { type WebDavProfile } from '@totp/sync';
import { type SyncMetadataSnapshot } from '@totp/sync';
import { getCurrentMasterPassword } from '../state/master-password-store';
import { syncStore, vaultStorage, webDavClient } from './settings-storage';
import { importExportOps } from './import-export-service';
import { passwordOps } from './password-service';

export type BackupMode = 'plain' | 'encrypted';

export interface SettingsSnapshot {
  webDavProfile: WebDavProfile | null;
  syncMetadata: Pick<
    SyncMetadataSnapshot,
    'lastStatus' | 'lastSyncedAt' | 'lastError' | 'pendingConflict'
  >;
}

export interface ExportVaultResult {
  filename: string;
  content: string;
  mode: BackupMode;
}

export interface ImportVaultResult {
  importedCount: number;
  mode: BackupMode;
}

export const settingsService = {
  async getSnapshot(): Promise<SettingsSnapshot> {
    const metadata = await syncStore.load();

    return {
      webDavProfile: metadata.profile ? { ...metadata.profile } : null,
      syncMetadata: {
        lastStatus: metadata.lastStatus,
        lastSyncedAt: metadata.lastSyncedAt,
        lastError: metadata.lastError,
        pendingConflict: metadata.pendingConflict
      }
    };
  },

  async saveWebDavProfile(profile: WebDavProfile): Promise<WebDavProfile> {
    const normalizedProfile = normalizeWebDavProfile(profile);
    const previous = await syncStore.load();
    const profileChanged = previous.profile
      ? createProfileKey(previous.profile) !== createProfileKey(normalizedProfile)
      : false;

    if (profileChanged) {
      await syncStore.save({
        profile: normalizedProfile,
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
    } else {
      await syncStore.save({ profile: normalizedProfile });
    }
    await refreshAutomaticSync();
    return normalizedProfile;
  },

  exportVault: importExportOps.exportVault,

  importVault: importExportOps.importVault,

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
  },

  changeMasterPassword: passwordOps.changeMasterPassword,

  verifyRemoteMasterPassword: passwordOps.verifyRemoteMasterPassword
};

function createRuntimeSyncService(profile: WebDavProfile | null) {
  return createSyncService({
    profile,
    client: webDavClient,
    vaultStorage,
    syncStore
  });
}

function normalizeWebDavProfile(profile: WebDavProfile): WebDavProfile {
  return {
    id: profile.id.trim() || 'webdav-primary',
    enabled: profile.enabled,
    baseUrl: profile.baseUrl.trim(),
    filePath: profile.filePath.trim(),
    username: profile.username?.trim() || undefined,
    password: profile.password?.trim() || undefined,
    syncIntervalMs: profile.syncIntervalMs
  };
}

function createProfileKey(profile: WebDavProfile): string {
  return JSON.stringify({
    baseUrl: profile.baseUrl,
    filePath: profile.filePath,
    username: profile.username ?? '',
    password: profile.password ?? ''
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
