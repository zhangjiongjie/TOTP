import {
  decryptVault,
  encryptVaultWithKey,
  exportVaultBundle,
  importVaultBundle,
  loadEncryptedVault,
  rewrapVaultKey,
  saveEncryptedVault,
  unlockVault
} from '@totp/core';
import type { EncryptedVaultBlob, VaultPayload } from '@totp/core';
import type { SyncRunResult } from '@totp/sync';
import {
  clearEncryptedVault,
  createChromeVaultStorageAdapter,
  createMemoryVaultStorageAdapter
} from '@totp/core';
import { accountService } from './account-service';
import {
  createSyncService,
  hashString,
  mergeAccountRecords,
  normalizeVaultForFingerprint
} from './sync-service';
import { refreshAutomaticSync } from '../state/app-store';
import type { PendingSyncConflict } from '@totp/sync';
import {
  createFetchWebDavClient,
  type WebDavProfile,
  type WebDavRemoteSnapshot
} from '@totp/sync';
import {
  createChromeSyncMetadataStore,
  createMemorySyncMetadataStore,
  type SyncMetadataSnapshot
} from '@totp/sync';
import { getCurrentMasterPassword, setCurrentMasterPassword } from '../state/master-password-store';

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
    const resolvedConflict =
      choice === 'local' ? await rewrapLocalConflictWithRemoteKey(conflict) : conflict;
    const result = await service.resolveConflict(resolvedConflict, choice);

    await applyRemoteAccountsIfNeeded(result);

    return result;
  },

  async changeMasterPassword(currentPassword: string, nextPassword: string): Promise<void> {
    if (!currentPassword || !nextPassword) {
      throw new Error('请输入当前主密码和新主密码。');
    }

    if (currentPassword === nextPassword) {
      throw new Error('新主密码不能和当前主密码相同。');
    }

    const metadata = await syncStore.load();
    if (metadata.lastStatus === 'blocked') {
      throw new Error('远端保管库需要主密码验证后才能继续同步，请先验证远端主密码。');
    }

    const profile = metadata.profile?.enabled ? metadata.profile : null;

    if (profile) {
      const service = createRuntimeSyncService(profile);
      const syncResult = await service.manualSync();

      if (syncResult.status === 'blocked') {
        throw new Error(syncResult.error?.message ?? '远端保管库需要主密码验证后才能继续同步。');
      }

      if (syncResult.status === 'conflict') {
        throw new Error('本地和远端存在同步冲突，请先解决冲突后再修改主密码。');
      }

      if (syncResult.status.endsWith('-error')) {
        throw new Error(syncResult.error?.message ?? '同步失败，请稍后重试。');
      }

      await applyRemoteAccountsIfNeeded(syncResult);

      const remote = await webDavClient.download(profile);
      const sourceVault = remote?.encryptedVault ?? await loadRequiredLocalVault();
      const rewrappedVault = await rewrapVaultKey(sourceVault, currentPassword, nextPassword);
      const revision = `web:${Date.now()}:${await createVaultFingerprint(rewrappedVault, nextPassword)}`;
      const updatedAt = new Date().toISOString();
      const uploaded = await webDavClient.upload(profile, {
        revision,
        updatedAt,
        encryptedVault: rewrappedVault,
        previousEtag: remote?.etag ?? null
      });
      const fingerprint = await createVaultFingerprint(rewrappedVault, nextPassword);

      await saveEncryptedVault(rewrappedVault, vaultStorage);
      await syncStore.save({
        profile,
        baseRevision: uploaded.revision,
        baseFingerprint: fingerprint,
        baseVault: rewrappedVault,
        localRevision: uploaded.revision,
        localFingerprint: fingerprint,
        localUpdatedAt: uploaded.updatedAt,
        remoteRevision: uploaded.revision,
        remoteUpdatedAt: uploaded.updatedAt,
        remoteEtag: uploaded.etag,
        lastSyncedAt: uploaded.updatedAt,
        lastPushedAt: uploaded.updatedAt,
        lastStatus: 'pushed',
        lastError: null,
        pendingConflict: null
      });
      setCurrentMasterPassword(nextPassword);
      return;
    }

    const localVault = await loadRequiredLocalVault();
    const rewrappedVault = await rewrapVaultKey(localVault, currentPassword, nextPassword);
    await saveEncryptedVault(rewrappedVault, vaultStorage);
    setCurrentMasterPassword(nextPassword);
  },

  async verifyRemoteMasterPassword(remotePassword: string): Promise<void> {
    if (!remotePassword) {
      throw new Error('请输入远端主密码。');
    }

    const profile = await requireEnabledProfile();
    const remote = await webDavClient.download(profile);

    if (!remote) {
      throw new Error('远端保管库不存在。');
    }

    const unlocked = await unlockVault(remote.encryptedVault, remotePassword);
    const remoteFingerprint = await createPlainVaultFingerprint(unlocked.vault);
    const currentPassword = getCurrentMasterPassword();
    const localEncrypted = await loadEncryptedVault(vaultStorage);
    const localVault = localEncrypted && currentPassword
      ? await decryptVaultOrNull(localEncrypted, currentPassword)
      : null;

    if (!localEncrypted || !localVault) {
      await applyVerifiedRemoteVault(profile, remote, unlocked.vault, remoteFingerprint, remotePassword);
      return;
    }

    const metadata = await syncStore.load();
    const localFingerprint = await createPlainVaultFingerprint(localVault);
    const baseVault = metadata.baseVault && currentPassword
      ? await decryptVaultOrNull(metadata.baseVault, currentPassword)
      : null;
    const baseFingerprint = baseVault ? await createPlainVaultFingerprint(baseVault) : metadata.baseFingerprint;

    if (localFingerprint === remoteFingerprint) {
      await applyVerifiedRemoteVault(profile, remote, unlocked.vault, remoteFingerprint, remotePassword);
      return;
    }

    if (!baseVault || !baseFingerprint) {
      if (localVault.accounts.length === 0) {
        await applyVerifiedRemoteVault(profile, remote, unlocked.vault, remoteFingerprint, remotePassword);
        return;
      }

      if (unlocked.vault.accounts.length === 0) {
        await pushVerifiedVault(profile, remote, localVault, unlocked.vaultKey, remotePassword);
        return;
      }

      await markVerifiedRemoteConflict(profile, metadata, remote, remoteFingerprint, localVault, localFingerprint, unlocked.vaultKey, remotePassword);
      throw new Error('本地和远端都有数据，请先处理同步冲突。');
    }

    const localChanged = localFingerprint !== baseFingerprint;
    const remoteChanged = remoteFingerprint !== baseFingerprint;

    if (localChanged && !remoteChanged) {
      await pushVerifiedVault(profile, remote, localVault, unlocked.vaultKey, remotePassword);
      return;
    }

    if (!localChanged && remoteChanged) {
      await applyVerifiedRemoteVault(profile, remote, unlocked.vault, remoteFingerprint, remotePassword);
      return;
    }

    if (!localChanged && !remoteChanged) {
      await applyVerifiedRemoteVault(profile, remote, unlocked.vault, remoteFingerprint, remotePassword);
      return;
    }

    const mergedAccounts = mergeAccountRecords(
      baseVault.accounts,
      localVault.accounts,
      unlocked.vault.accounts
    );

    if (!mergedAccounts) {
      await markVerifiedRemoteConflict(profile, metadata, remote, remoteFingerprint, localVault, localFingerprint, unlocked.vaultKey, remotePassword);
      throw new Error('本地和远端存在账号冲突，请先处理同步冲突。');
    }

    await pushVerifiedVault(
      profile,
      remote,
      {
        version: Math.max(baseVault.version, localVault.version, unlocked.vault.version),
        accounts: mergedAccounts
      },
      unlocked.vaultKey,
      remotePassword
    );
  }
};

function createSyncStore() {
  try {
    return createChromeSyncMetadataStore();
  } catch {
    return createMemorySyncMetadataStore();
  }
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

function createProfileKey(profile: WebDavProfile): string {
  return JSON.stringify({
    baseUrl: profile.baseUrl,
    filePath: profile.filePath,
    username: profile.username ?? '',
    password: profile.password ?? ''
  });
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

async function loadRequiredLocalVault() {
  const localVault = await loadEncryptedVault(vaultStorage);

  if (!localVault) {
    throw new Error('本地保管库不存在。');
  }

  return localVault;
}

async function createVaultFingerprint(encryptedVault: EncryptedVaultBlob, password: string) {
  const vault = await decryptVault(encryptedVault, password);
  return createPlainVaultFingerprint(vault);
}

async function createPlainVaultFingerprint(vault: VaultPayload) {
  return hashString(JSON.stringify(normalizeVaultForFingerprint(vault)));
}

async function decryptVaultOrNull(encryptedVault: EncryptedVaultBlob, password: string) {
  try {
    return await decryptVault(encryptedVault, password);
  } catch {
    return null;
  }
}

async function applyVerifiedRemoteVault(
  profile: WebDavProfile,
  remote: WebDavRemoteSnapshot,
  vault: VaultPayload,
  fingerprint: string,
  remotePassword: string
) {
  await saveEncryptedVault(remote.encryptedVault, vaultStorage);
  await accountService.replaceAllAccounts(vault.accounts);
  await syncStore.save({
    profile,
    baseRevision: remote.revision,
    baseFingerprint: fingerprint,
    baseVault: remote.encryptedVault,
    localRevision: remote.revision,
    localFingerprint: fingerprint,
    localUpdatedAt: remote.updatedAt,
    remoteRevision: remote.revision,
    remoteUpdatedAt: remote.updatedAt,
    remoteEtag: remote.etag,
    lastSyncedAt: remote.updatedAt,
    lastPulledAt: remote.updatedAt,
    lastStatus: 'pulled',
    lastError: null,
    pendingConflict: null
  });
  setCurrentMasterPassword(remotePassword);
}

async function pushVerifiedVault(
  profile: WebDavProfile,
  remote: WebDavRemoteSnapshot,
  vault: VaultPayload,
  remoteVaultKey: Uint8Array,
  remotePassword: string
) {
  const encryptedVault = await encryptVaultWithKey(vault, remote.encryptedVault, remoteVaultKey);
  const fingerprint = await createPlainVaultFingerprint(vault);
  const updatedAt = new Date().toISOString();
  const revision = `web:${Date.now()}:${fingerprint}`;
  const uploaded = await webDavClient.upload(profile, {
    revision,
    updatedAt,
    encryptedVault,
    previousEtag: remote.etag
  });

  await saveEncryptedVault(encryptedVault, vaultStorage);
  await accountService.replaceAllAccounts(vault.accounts);
  await syncStore.save({
    profile,
    baseRevision: uploaded.revision,
    baseFingerprint: fingerprint,
    baseVault: encryptedVault,
    localRevision: uploaded.revision,
    localFingerprint: fingerprint,
    localUpdatedAt: uploaded.updatedAt,
    remoteRevision: uploaded.revision,
    remoteUpdatedAt: uploaded.updatedAt,
    remoteEtag: uploaded.etag,
    lastSyncedAt: uploaded.updatedAt,
    lastPushedAt: uploaded.updatedAt,
    lastStatus: 'pushed',
    lastError: null,
    pendingConflict: null
  });
  setCurrentMasterPassword(remotePassword);
}

async function markVerifiedRemoteConflict(
  profile: WebDavProfile,
  metadata: SyncMetadataSnapshot,
  remote: WebDavRemoteSnapshot,
  remoteFingerprint: string,
  localVault: VaultPayload,
  localFingerprint: string,
  remoteVaultKey: Uint8Array,
  remotePassword: string
) {
  const localEncryptedWithRemoteKey = await encryptVaultWithKey(
    localVault,
    remote.encryptedVault,
    remoteVaultKey
  );
  const detectedAt = new Date().toISOString();

  await saveEncryptedVault(localEncryptedWithRemoteKey, vaultStorage);
  await accountService.replaceAllAccounts(localVault.accounts);
  await syncStore.save({
    profile,
    localRevision: `local:${localFingerprint}`,
    localFingerprint,
    localUpdatedAt: detectedAt,
    remoteRevision: remote.revision,
    remoteUpdatedAt: remote.updatedAt,
    remoteEtag: remote.etag,
    lastStatus: 'conflict',
    lastError: '本地和远端存在同步冲突，请先解决冲突后再继续同步。',
    pendingConflict: {
      kind: 'vault-conflict',
      detectedAt,
      baseRevision: metadata.baseRevision,
      baseFingerprint: metadata.baseFingerprint,
      local: {
        revision: `local:${localFingerprint}`,
        updatedAt: detectedAt,
        fingerprint: localFingerprint,
        source: 'local',
        status: 'ready',
        encryptedVault: localEncryptedWithRemoteKey,
        etag: null
      },
      remote: {
        revision: remote.revision,
        updatedAt: remote.updatedAt,
        fingerprint: remoteFingerprint,
        source: 'remote',
        status: 'ready',
        encryptedVault: remote.encryptedVault,
        etag: remote.etag
      }
    }
  });
  setCurrentMasterPassword(remotePassword);
}

async function applyRemoteAccountsIfNeeded(result: SyncRunResult) {
  const masterPassword = getCurrentMasterPassword();

  if ((!result.merged && result.status !== 'pulled') || !result.localVault || !masterPassword) {
    return;
  }

  const decryptedVault = await decryptVault(result.localVault, masterPassword);
  await accountService.replaceAllAccounts(decryptedVault.accounts);
}
