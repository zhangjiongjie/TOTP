import { exportVaultBundle, importVaultBundle } from '../core/vault/export';
import { decryptVault } from '../core/vault/crypto';
import type { SyncRunResult } from '../core/sync/sync-engine';
import {
  clearEncryptedVault,
  createChromeVaultStorageAdapter,
  createMemoryVaultStorageAdapter
} from '../core/vault/vault-store';
import { accountService } from './account-service';
import { createSyncService } from './sync-service';
import { refreshAutomaticSync } from '../state/app-store';
import type { PendingSyncConflict } from '../core/sync/conflict';
import {
  createFetchWebDavClient,
  type WebDavProfile
} from '../core/sync/webdav-client';
import {
  createChromeSyncMetadataStore,
  createMemorySyncMetadataStore,
  type SyncMetadataSnapshot
} from '../state/sync-store';
import { getCurrentMasterPassword } from '../state/master-password-store';

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

const syncStore = createSyncStore();
const vaultStorage = createVaultStorage();
const webDavClient = createFetchWebDavClient();

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
    await syncStore.save({ profile: normalizedProfile });
    await refreshAutomaticSync();
    return normalizedProfile;
  },

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
  },

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
    const result = await service.resolveConflict(conflict, choice);

    await applyRemoteAccountsIfNeeded(result);

    return result;
  }
};

function createSyncStore() {
  try {
    return createChromeSyncMetadataStore();
  } catch {
    return createMemorySyncMetadataStore();
  }
}

function createVaultStorage() {
  try {
    return createChromeVaultStorageAdapter();
  } catch {
    return createMemoryVaultStorageAdapter();
  }
}

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

async function requireEnabledProfile(): Promise<WebDavProfile> {
  const metadata = await syncStore.load();

  if (!metadata.profile?.enabled) {
    throw new Error('请先启用 WebDAV 同步。');
  }

  return metadata.profile;
}

async function applyRemoteAccountsIfNeeded(result: SyncRunResult) {
  const masterPassword = getCurrentMasterPassword();

  if ((!result.merged && result.status !== 'pulled') || !result.localVault || !masterPassword) {
    return;
  }

  const decryptedVault = await decryptVault(result.localVault, masterPassword);
  await accountService.replaceAllAccounts(decryptedVault.accounts);
}
