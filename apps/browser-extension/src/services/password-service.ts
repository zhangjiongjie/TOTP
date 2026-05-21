import {
  decryptVault,
  encryptVaultWithKey,
  loadEncryptedVault,
  rewrapVaultKey,
  saveEncryptedVault,
  unlockVault
} from '@totp/core';
import type { EncryptedVaultBlob, VaultPayload } from '@totp/core';
import type { SyncRunResult } from '@totp/sync';
import type { PendingSyncConflict } from '@totp/sync';
import {
  type WebDavProfile,
  type WebDavRemoteSnapshot
} from '@totp/sync';
import { type SyncMetadataSnapshot } from '@totp/sync';
import { getCurrentMasterPassword, setCurrentMasterPassword } from '../state/master-password-store';
import { accountService } from './account-service';
import {
  createSyncService,
  hashString,
  mergeAccountRecords,
  normalizeVaultForFingerprint
} from './sync-service';
import { syncStore, vaultStorage, webDavClient } from './settings-storage';

const MIN_PASSWORD_LENGTH = 12;

export const passwordOps = {
  async changeMasterPassword(currentPassword: string, nextPassword: string): Promise<void> {
    if (!currentPassword || !nextPassword) {
      throw new Error('请输入当前主密码和新主密码。');
    }

    if (currentPassword === nextPassword) {
      throw new Error('新主密码不能和当前主密码相同。');
    }

    if (nextPassword.length < MIN_PASSWORD_LENGTH) {
      throw new Error(`新主密码至少需要 ${MIN_PASSWORD_LENGTH} 位字符。`);
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

async function applyRemoteAccountsIfNeeded(result: SyncRunResult) {
  const masterPassword = getCurrentMasterPassword();

  if ((!result.merged && result.status !== 'pulled') || !result.localVault || !masterPassword) {
    return;
  }

  const decryptedVault = await decryptVault(result.localVault, masterPassword);
  await accountService.replaceAllAccounts(decryptedVault.accounts);
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
