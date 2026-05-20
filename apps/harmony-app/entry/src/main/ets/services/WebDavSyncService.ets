import { common } from '@kit.AbilityKit';
import { BusinessError } from '@kit.BasicServicesKit';
import { LocalVault, createLocalVaultFromJson } from '../model/LocalVault';
import { TotpAccount } from '../model/TotpAccount';
import { WebDavSettings } from '../model/WebDavSettings';
import { WebDavSyncMetadata, createDefaultWebDavSyncMetadata } from '../model/WebDavSyncMetadata';
import { LocalVaultStore } from '../storage/LocalVaultStore';
import { SettingsStore } from '../storage/SettingsStore';
import { WebDavClient, WebDavRemoteSnapshot, WebDavUploadResult } from './WebDavClient';
import { EncryptedRemoteVaultBlob, RemoteVaultCryptoService } from './RemoteVaultCryptoService';
import { UnlockService } from './UnlockService';

export class WebDavSyncResult {
  status: string;
  message: string;
  vault: LocalVault | undefined;

  constructor(status: string, message: string, vault: LocalVault | undefined = undefined) {
    this.status = status;
    this.message = message;
    this.vault = vault;
  }
}

class AccountMergeResult {
  hasConflict: boolean;
  account: TotpAccount | null;

  constructor(hasConflict: boolean, account: TotpAccount | null) {
    this.hasConflict = hasConflict;
    this.account = account;
  }
}

class StringMergeResult {
  hasConflict: boolean;
  value: string;

  constructor(hasConflict: boolean, value: string) {
    this.hasConflict = hasConflict;
    this.value = value;
  }
}

class NumberMergeResult {
  hasConflict: boolean;
  value: number;

  constructor(hasConflict: boolean, value: number) {
    this.hasConflict = hasConflict;
    this.value = value;
  }
}

class WebDavDownloadResult {
  snapshot: WebDavRemoteSnapshot | undefined;
  blocked: boolean;

  constructor(snapshot: WebDavRemoteSnapshot | undefined, blocked: boolean) {
    this.snapshot = snapshot;
    this.blocked = blocked;
  }
}

export class WebDavSyncService {
  private static instance: WebDavSyncService | undefined;
  private settingsStore: SettingsStore = new SettingsStore();
  private vaultStore: LocalVaultStore = new LocalVaultStore();
  private client: WebDavClient = new WebDavClient();
  private cryptoService: RemoteVaultCryptoService = new RemoteVaultCryptoService();

  static getInstance(): WebDavSyncService {
    if (WebDavSyncService.instance === undefined) {
      WebDavSyncService.instance = new WebDavSyncService();
    }
    return WebDavSyncService.instance;
  }

  async syncNow(context: common.UIAbilityContext): Promise<WebDavSyncResult> {
    let settings: WebDavSettings = this.settingsStore.loadWebDavSettings(context);
    if (!settings.enabled) {
      return new WebDavSyncResult('disabled', '未启用 WebDAV，同步仅保留在本机。');
    }
    this.validateSettings(settings);

    let localVault: LocalVault = this.vaultStore.load(context);
    let localVaultIsUninitialized: boolean = this.isUninitializedLocalVault(localVault);
    let metadata: WebDavSyncMetadata = this.settingsStore.loadWebDavSyncMetadata(context);
    let syncProfileKey: string = this.createSyncProfileKey(settings);
    if (metadata.syncProfileKey !== syncProfileKey && metadata.syncProfileKey !== this.createLegacySyncProfileKey(settings)) {
      metadata = createDefaultWebDavSyncMetadata();
    }
    let remoteDownload: WebDavDownloadResult = await this.downloadOrBlocked(
      context,
      settings,
      metadata,
      syncProfileKey
    );
    if (remoteDownload.blocked) {
      return new WebDavSyncResult('blocked', '远端保管库需要主密码验证后才能继续同步。');
    }
    let remoteSnapshot: WebDavRemoteSnapshot | undefined = remoteDownload.snapshot;
    let localFingerprint: string = this.createFingerprint(localVault);

    if (remoteSnapshot === undefined) {
      if (localVault.accounts.length === 0) {
        this.saveMetadata(context, syncProfileKey, localFingerprint, this.createBaseVaultJson(localVault), '', '', 'idle', '');
        return new WebDavSyncResult('idle', '远端还没有保管库，本地也为空。');
      }
      return await this.pushLocal(context, settings, localVault, localFingerprint, '');
    }

    let remoteFingerprint: string = this.createFingerprint(remoteSnapshot.vault);
    if (localVaultIsUninitialized && remoteSnapshot.vault.accounts.length > 0) {
      return this.pullRemote(context, settings, remoteSnapshot, remoteFingerprint);
    }
    if (localVaultIsUninitialized && remoteSnapshot.vault.accounts.length === 0) {
      this.saveMetadata(context, syncProfileKey, remoteFingerprint, this.createBaseVaultJson(remoteSnapshot.vault), remoteSnapshot.revision, remoteSnapshot.etag, 'synced', '');
      return new WebDavSyncResult('synced', '本地与 WebDAV 都为空。');
    }

    if (localFingerprint === remoteFingerprint) {
      this.vaultStore.saveWithRemoteKey(context, localVault, remoteSnapshot.encryptedVault, remoteSnapshot.vaultKey);
      this.saveMetadata(context, syncProfileKey, remoteFingerprint, this.createBaseVaultJson(localVault), remoteSnapshot.revision, remoteSnapshot.etag, 'synced', '');
      return new WebDavSyncResult('synced', '本地与 WebDAV 已是最新版本。');
    }

    if (metadata.baseFingerprint.length === 0) {
      if (localVault.accounts.length === 0 && remoteSnapshot.vault.accounts.length > 0) {
        return this.pullRemote(context, settings, remoteSnapshot, remoteFingerprint);
      }
      if (localVault.accounts.length > 0 && remoteSnapshot.vault.accounts.length === 0) {
        this.vaultStore.saveWithRemoteKey(context, localVault, remoteSnapshot.encryptedVault, remoteSnapshot.vaultKey);
        return await this.pushLocal(context, settings, localVault, localFingerprint, remoteSnapshot.etag, undefined, remoteSnapshot);
      }
      this.saveMetadata(context, syncProfileKey, metadata.baseFingerprint, metadata.baseVaultJson, metadata.remoteRevision, metadata.remoteEtag, 'conflict', '首次绑定时本地和远端都有数据。');
      return new WebDavSyncResult('conflict', '首次绑定时本地和远端都有数据，请先决定保留哪一侧。');
    }

    let localChanged: boolean = localFingerprint !== metadata.baseFingerprint;
    let remoteChanged: boolean = remoteFingerprint !== metadata.baseFingerprint;
    if (localChanged && !remoteChanged) {
      this.vaultStore.saveWithRemoteKey(context, localVault, remoteSnapshot.encryptedVault, remoteSnapshot.vaultKey);
      return await this.pushLocal(context, settings, localVault, localFingerprint, remoteSnapshot.etag, undefined, remoteSnapshot);
    }
    if (!localChanged && remoteChanged) {
      return this.pullRemote(context, settings, remoteSnapshot, remoteFingerprint);
    }
    if (!localChanged && !remoteChanged) {
      this.saveMetadata(context, syncProfileKey, remoteFingerprint, this.createBaseVaultJson(localVault), remoteSnapshot.revision, remoteSnapshot.etag, 'synced', '');
      return new WebDavSyncResult('synced', '同步基线已刷新。');
    }

    let mergedVault: LocalVault | undefined = this.mergeAccountLevelChanges(metadata, localVault, remoteSnapshot.vault);
    if (mergedVault !== undefined) {
      let savedMergedVault: LocalVault = this.vaultStore.saveWithRemoteKey(context, mergedVault, remoteSnapshot.encryptedVault, remoteSnapshot.vaultKey);
      let mergedFingerprint: string = this.createFingerprint(savedMergedVault);
      return await this.pushLocal(
        context,
        settings,
        savedMergedVault,
        mergedFingerprint,
        remoteSnapshot.etag,
        '本地和远端修改已自动合并并同步到 WebDAV。',
        remoteSnapshot
      );
    }

    this.saveMetadata(context, syncProfileKey, metadata.baseFingerprint, metadata.baseVaultJson, metadata.remoteRevision, metadata.remoteEtag, 'conflict', '本地和远端都发生了变化。');
    return new WebDavSyncResult('conflict', '本地和远端都发生了变化，请在首页选择保留本地或使用远端。');
  }

  async keepLocalVersion(context: common.UIAbilityContext): Promise<WebDavSyncResult> {
    let settings: WebDavSettings = this.settingsStore.loadWebDavSettings(context);
    if (!settings.enabled) {
      return new WebDavSyncResult('disabled', '未启用 WebDAV，无法处理同步冲突。');
    }
    this.validateSettings(settings);

    let localVault: LocalVault = this.vaultStore.load(context);
    let localFingerprint: string = this.createFingerprint(localVault);
    let metadata: WebDavSyncMetadata = this.settingsStore.loadWebDavSyncMetadata(context);
    let syncProfileKey: string = this.createSyncProfileKey(settings);
    let remoteDownload: WebDavDownloadResult = await this.downloadOrBlocked(context, settings, metadata, syncProfileKey);
    if (remoteDownload.blocked) {
      return new WebDavSyncResult('blocked', '远端保管库需要主密码验证后才能继续同步。');
    }
    let remoteSnapshot: WebDavRemoteSnapshot | undefined = remoteDownload.snapshot;
    let previousEtag: string = remoteSnapshot === undefined ? '' : remoteSnapshot.etag;
    if (remoteSnapshot !== undefined) {
      this.vaultStore.saveWithRemoteKey(context, localVault, remoteSnapshot.encryptedVault, remoteSnapshot.vaultKey);
    }
    return await this.pushLocal(
      context,
      settings,
      localVault,
      localFingerprint,
      previousEtag,
      undefined,
      remoteSnapshot
    );
  }

  async useRemoteVersion(context: common.UIAbilityContext): Promise<WebDavSyncResult> {
    let settings: WebDavSettings = this.settingsStore.loadWebDavSettings(context);
    if (!settings.enabled) {
      return new WebDavSyncResult('disabled', '未启用 WebDAV，无法处理同步冲突。');
    }
    this.validateSettings(settings);

    let remoteDownload: WebDavDownloadResult = await this.downloadOrBlocked(
      context,
      settings,
      this.settingsStore.loadWebDavSyncMetadata(context),
      this.createSyncProfileKey(settings)
    );
    if (remoteDownload.blocked) {
      return new WebDavSyncResult('blocked', '远端保管库需要主密码验证后才能继续同步。');
    }
    let remoteSnapshot: WebDavRemoteSnapshot | undefined = remoteDownload.snapshot;
    if (remoteSnapshot === undefined) {
      return new WebDavSyncResult('missing', '远端保管库不存在，无法使用远端版本。');
    }

    let remoteFingerprint: string = this.createFingerprint(remoteSnapshot.vault);
    return this.pullRemote(context, settings, remoteSnapshot, remoteFingerprint);
  }

  private async pushLocal(
    context: common.UIAbilityContext,
    settings: WebDavSettings,
    vault: LocalVault,
    fingerprint: string,
    previousEtag: string,
    message: string = '本地修改已同步到 WebDAV。',
    keySource: WebDavRemoteSnapshot | undefined = undefined
  ): Promise<WebDavSyncResult> {
    let revision: string = this.createRevision(fingerprint);
    let uploadResult: WebDavUploadResult = await this.client.upload(settings, vault, revision, previousEtag, keySource);
    this.saveMetadata(context, this.createSyncProfileKey(settings), fingerprint, this.createBaseVaultJson(vault), uploadResult.revision, uploadResult.etag, 'synced', '');
    return new WebDavSyncResult('pushed', message);
  }

  private pullRemote(
    context: common.UIAbilityContext,
    settings: WebDavSettings,
    snapshot: WebDavRemoteSnapshot,
    fingerprint: string
  ): WebDavSyncResult {
    let vault: LocalVault = this.vaultStore.saveWithRemoteKey(context, snapshot.vault, snapshot.encryptedVault, snapshot.vaultKey);
    this.saveMetadata(context, this.createSyncProfileKey(settings), fingerprint, this.createBaseVaultJson(vault), snapshot.revision, snapshot.etag, 'synced', '');
    return new WebDavSyncResult('pulled', '已从 WebDAV 恢复远端版本。', vault);
  }

  async verifyRemoteMasterPassword(context: common.UIAbilityContext, remotePassword: string): Promise<WebDavSyncResult> {
    let settings: WebDavSettings = this.settingsStore.loadWebDavSettings(context);
    if (!settings.enabled) {
      return new WebDavSyncResult('disabled', '未启用 WebDAV，同步仅保留在本机。');
    }
    this.validateSettings(settings);
    if (remotePassword.trim().length === 0) {
      throw new Error('请输入远端主密码。');
    }

    let metadata: WebDavSyncMetadata = this.settingsStore.loadWebDavSyncMetadata(context);
    let syncProfileKey: string = this.createSyncProfileKey(settings);
    let remoteSnapshot: WebDavRemoteSnapshot | undefined = await this.client.downloadWithPassword(settings, remotePassword.trim());
    if (remoteSnapshot === undefined) {
      throw new Error('远端保管库不存在。');
    }

    let localVault: LocalVault = this.vaultStore.load(context);
    let localVaultIsUninitialized: boolean = this.isUninitializedLocalVault(localVault);
    let localFingerprint: string = this.createFingerprint(localVault);
    let remoteFingerprint: string = this.createFingerprint(remoteSnapshot.vault);

    if (localVaultIsUninitialized && remoteSnapshot.vault.accounts.length > 0) {
      let pulled: WebDavSyncResult = this.pullRemote(context, settings, remoteSnapshot, remoteFingerprint);
      UnlockService.getInstance().adoptRemoteMasterPassword(context, remotePassword);
      return pulled;
    }
    if (localVaultIsUninitialized && remoteSnapshot.vault.accounts.length === 0) {
      let vault: LocalVault = this.vaultStore.saveWithRemoteKey(context, remoteSnapshot.vault, remoteSnapshot.encryptedVault, remoteSnapshot.vaultKey);
      this.saveMetadata(context, syncProfileKey, remoteFingerprint, this.createBaseVaultJson(vault), remoteSnapshot.revision, remoteSnapshot.etag, 'synced', '');
      UnlockService.getInstance().adoptRemoteMasterPassword(context, remotePassword);
      return new WebDavSyncResult('synced', '本地与 WebDAV 都为空。', vault);
    }

    if (localFingerprint === remoteFingerprint) {
      let vault: LocalVault = this.vaultStore.saveWithRemoteKey(context, remoteSnapshot.vault, remoteSnapshot.encryptedVault, remoteSnapshot.vaultKey);
      this.saveMetadata(context, syncProfileKey, remoteFingerprint, this.createBaseVaultJson(vault), remoteSnapshot.revision, remoteSnapshot.etag, 'synced', '');
      UnlockService.getInstance().adoptRemoteMasterPassword(context, remotePassword);
      return new WebDavSyncResult('pulled', '远端密码库已验证，本地密码已同步更新。', vault);
    }

    let baseVault: LocalVault | undefined = this.loadBaseVault(metadata);
    if (baseVault === undefined || metadata.baseFingerprint.length === 0) {
      if (localVault.accounts.length === 0) {
        let vault: LocalVault = this.vaultStore.saveWithRemoteKey(context, remoteSnapshot.vault, remoteSnapshot.encryptedVault, remoteSnapshot.vaultKey);
        this.saveMetadata(context, syncProfileKey, remoteFingerprint, this.createBaseVaultJson(vault), remoteSnapshot.revision, remoteSnapshot.etag, 'synced', '');
        UnlockService.getInstance().adoptRemoteMasterPassword(context, remotePassword);
        return new WebDavSyncResult('pulled', '已从 WebDAV 恢复远端版本。', vault);
      }
      if (remoteSnapshot.vault.accounts.length === 0) {
        let savedLocal: LocalVault = this.vaultStore.saveWithRemoteKey(context, localVault, remoteSnapshot.encryptedVault, remoteSnapshot.vaultKey);
        let pushed: WebDavSyncResult = await this.pushLocal(context, settings, savedLocal, this.createFingerprint(savedLocal), remoteSnapshot.etag, '本地修改已同步到 WebDAV。', remoteSnapshot);
        UnlockService.getInstance().adoptRemoteMasterPassword(context, remotePassword);
        return pushed;
      }
      this.vaultStore.saveWithRemoteKey(context, localVault, remoteSnapshot.encryptedVault, remoteSnapshot.vaultKey);
      this.saveMetadata(context, syncProfileKey, metadata.baseFingerprint, metadata.baseVaultJson, remoteSnapshot.revision, remoteSnapshot.etag, 'conflict', '本地和远端存在同步冲突，请先解决冲突后再继续同步。');
      UnlockService.getInstance().adoptRemoteMasterPassword(context, remotePassword);
      return new WebDavSyncResult('conflict', '本地和远端都有数据，请先处理同步冲突。');
    }

    let localChanged: boolean = localFingerprint !== metadata.baseFingerprint;
    let remoteChanged: boolean = remoteFingerprint !== metadata.baseFingerprint;
    if (localChanged && !remoteChanged) {
      let savedLocal: LocalVault = this.vaultStore.saveWithRemoteKey(context, localVault, remoteSnapshot.encryptedVault, remoteSnapshot.vaultKey);
      let pushed: WebDavSyncResult = await this.pushLocal(context, settings, savedLocal, this.createFingerprint(savedLocal), remoteSnapshot.etag, '本地修改已同步到 WebDAV。', remoteSnapshot);
      UnlockService.getInstance().adoptRemoteMasterPassword(context, remotePassword);
      return pushed;
    }
    if (!localChanged && remoteChanged) {
      let pulled: WebDavSyncResult = this.pullRemote(context, settings, remoteSnapshot, remoteFingerprint);
      UnlockService.getInstance().adoptRemoteMasterPassword(context, remotePassword);
      return pulled;
    }
    if (!localChanged && !remoteChanged) {
      let vault: LocalVault = this.vaultStore.saveWithRemoteKey(context, remoteSnapshot.vault, remoteSnapshot.encryptedVault, remoteSnapshot.vaultKey);
      this.saveMetadata(context, syncProfileKey, remoteFingerprint, this.createBaseVaultJson(vault), remoteSnapshot.revision, remoteSnapshot.etag, 'synced', '');
      UnlockService.getInstance().adoptRemoteMasterPassword(context, remotePassword);
      return new WebDavSyncResult('synced', '同步基线已刷新。', vault);
    }

    let mergedVault: LocalVault | undefined = this.mergeAccountLevelChanges(metadata, localVault, remoteSnapshot.vault);
    if (mergedVault !== undefined) {
      let savedMerged: LocalVault = this.vaultStore.saveWithRemoteKey(context, mergedVault, remoteSnapshot.encryptedVault, remoteSnapshot.vaultKey);
      let pushed: WebDavSyncResult = await this.pushLocal(context, settings, savedMerged, this.createFingerprint(savedMerged), remoteSnapshot.etag, '本地和远端修改已自动合并并同步到 WebDAV。', remoteSnapshot);
      UnlockService.getInstance().adoptRemoteMasterPassword(context, remotePassword);
      return pushed;
    }

    this.vaultStore.saveWithRemoteKey(context, localVault, remoteSnapshot.encryptedVault, remoteSnapshot.vaultKey);
    this.saveMetadata(context, syncProfileKey, metadata.baseFingerprint, metadata.baseVaultJson, remoteSnapshot.revision, remoteSnapshot.etag, 'conflict', '本地和远端存在同步冲突，请先解决冲突后再继续同步。');
    UnlockService.getInstance().adoptRemoteMasterPassword(context, remotePassword);
    return new WebDavSyncResult('conflict', '本地和远端存在账号冲突，请先处理同步冲突。');
  }

  async changeMasterPassword(context: common.UIAbilityContext, currentPassword: string, nextPassword: string): Promise<WebDavSyncResult> {
    let settings: WebDavSettings = this.settingsStore.loadWebDavSettings(context);
    let metadata: WebDavSyncMetadata = this.settingsStore.loadWebDavSyncMetadata(context);
    if (settings.enabled && metadata.lastStatus === 'blocked') {
      throw new Error('远端保管库需要主密码验证后才能继续同步，请先验证远端主密码。');
    }
    if (!settings.enabled) {
      this.vaultStore.rewrapMasterPassword(context, currentPassword, nextPassword);
      UnlockService.getInstance().updateMasterPassword(context, currentPassword, nextPassword);
      return new WebDavSyncResult('local', '主密码已修改。');
    }

    this.validateSettings(settings);
    let remoteSnapshot: WebDavRemoteSnapshot | undefined = await this.client.downloadWithPassword(settings, currentPassword);
    this.vaultStore.rewrapMasterPassword(context, currentPassword, nextPassword);
    UnlockService.getInstance().updateMasterPassword(context, currentPassword, nextPassword);
    if (remoteSnapshot === undefined) {
      let localVault: LocalVault = this.vaultStore.load(context);
      return await this.pushLocal(context, settings, localVault, this.createFingerprint(localVault), '', '主密码已修改并同步到 WebDAV。');
    }
    let encryptedVault: EncryptedRemoteVaultBlob = this.cryptoService.rewrapKeyEncryption(remoteSnapshot.encryptedVault, nextPassword, remoteSnapshot.vaultKey);
    let fingerprint: string = this.createFingerprint(remoteSnapshot.vault);
    let revision: string = this.createRevision(fingerprint);
    let upload: WebDavUploadResult = await this.client.uploadEncryptedVault(settings, encryptedVault, revision, remoteSnapshot.etag);
    let vault: LocalVault = this.vaultStore.saveWithRemoteKey(context, remoteSnapshot.vault, encryptedVault, remoteSnapshot.vaultKey);
    this.saveMetadata(context, this.createSyncProfileKey(settings), fingerprint, this.createBaseVaultJson(vault), upload.revision, upload.etag, 'synced', '');
    return new WebDavSyncResult('pushed', '主密码已修改并同步到 WebDAV。', vault);
  }

  private async downloadOrBlocked(
    context: common.UIAbilityContext,
    settings: WebDavSettings,
    metadata: WebDavSyncMetadata,
    syncProfileKey: string
  ): Promise<WebDavDownloadResult> {
    try {
      return new WebDavDownloadResult(await this.client.download(settings), false);
    } catch (error) {
      if (this.isRemotePasswordBlockedError(error as Object)) {
        this.saveMetadata(
          context,
          syncProfileKey,
          metadata.baseFingerprint,
          metadata.baseVaultJson,
          metadata.remoteRevision,
          metadata.remoteEtag,
          'blocked',
          '远端保管库需要主密码验证后才能继续同步。'
        );
        return new WebDavDownloadResult(undefined, true);
      }
      throw new Error(this.readErrorMessage(error as Object));
    }
  }

  private validateSettings(settings: WebDavSettings): void {
    if (settings.serverUrl.trim().length === 0) {
      throw new Error('请先填写 WebDAV 服务器地址。');
    }
    if (!settings.serverUrl.startsWith('http://') && !settings.serverUrl.startsWith('https://')) {
      throw new Error('WebDAV 服务器地址需要以 http:// 或 https:// 开头。');
    }
    if (settings.filePath.trim().length === 0) {
      throw new Error('请先填写 WebDAV 保管库路径。');
    }
  }

  private isUninitializedLocalVault(vault: LocalVault): boolean {
    return vault.accounts.length === 0 && vault.updatedAt.length === 0;
  }

  private saveMetadata(
    context: common.UIAbilityContext,
    syncProfileKey: string,
    baseFingerprint: string,
    baseVaultJson: string,
    revision: string,
    etag: string,
    status: string,
    error: string
  ): void {
    let metadata: WebDavSyncMetadata = new WebDavSyncMetadata(
      syncProfileKey,
      baseFingerprint,
      baseVaultJson,
      revision,
      etag,
      new Date().toISOString(),
      status,
      error
    );
    this.settingsStore.saveWebDavSyncMetadata(context, metadata);
  }

  private createSyncProfileKey(settings: WebDavSettings): string {
    return this.hashText(JSON.stringify({
      serverUrl: settings.serverUrl,
      filePath: settings.filePath,
      username: settings.username,
      password: settings.password
    }));
  }

  private createLegacySyncProfileKey(settings: WebDavSettings): string {
    return this.hashText(JSON.stringify({
      enabled: settings.enabled,
      serverUrl: settings.serverUrl,
      filePath: settings.filePath,
      username: settings.username,
      password: settings.password
    }));
  }

  private createBaseVaultJson(vault: LocalVault): string {
    return JSON.stringify(vault.toRecord());
  }

  private loadBaseVault(metadata: WebDavSyncMetadata): LocalVault | undefined {
    if (metadata.baseVaultJson.length === 0) {
      return undefined;
    }
    try {
      return createLocalVaultFromJson(metadata.baseVaultJson);
    } catch (error) {
      return undefined;
    }
  }

  private mergeAccountLevelChanges(metadata: WebDavSyncMetadata, localVault: LocalVault, remoteVault: LocalVault): LocalVault | undefined {
    let baseVault: LocalVault | undefined = this.loadBaseVault(metadata);
    if (baseVault === undefined) {
      return undefined;
    }

    let mergedAccounts: TotpAccount[] | undefined = this.mergeAccountRecords(
      baseVault.accounts,
      localVault.accounts,
      remoteVault.accounts
    );
    if (mergedAccounts === undefined) {
      return undefined;
    }

    return new LocalVault(
      Math.max(baseVault.schemaVersion, Math.max(localVault.schemaVersion, remoteVault.schemaVersion)),
      new Date().toISOString(),
      mergedAccounts
    );
  }

  private mergeAccountRecords(baseAccounts: TotpAccount[], localAccounts: TotpAccount[], remoteAccounts: TotpAccount[]): TotpAccount[] | undefined {
    let baseMap: Map<string, TotpAccount> = this.createAccountMap(baseAccounts);
    let localMap: Map<string, TotpAccount> = this.createAccountMap(localAccounts);
    let remoteMap: Map<string, TotpAccount> = this.createAccountMap(remoteAccounts);
    let accountIds: string[] = this.collectAccountIds(baseAccounts, localAccounts, remoteAccounts);
    let mergedAccounts: TotpAccount[] = [];

    for (let index: number = 0; index < accountIds.length; index++) {
      let accountId: string = accountIds[index];
      let result: AccountMergeResult = this.mergeSingleAccount(
        this.readAccount(baseMap, accountId),
        this.readAccount(localMap, accountId),
        this.readAccount(remoteMap, accountId)
      );

      if (result.hasConflict) {
        return undefined;
      }

      if (result.account !== null) {
        mergedAccounts.push(result.account);
      }
    }

    mergedAccounts.sort((left: TotpAccount, right: TotpAccount) => right.updatedAt.localeCompare(left.updatedAt));
    return mergedAccounts;
  }

  private mergeSingleAccount(baseAccount: TotpAccount | null, localAccount: TotpAccount | null, remoteAccount: TotpAccount | null): AccountMergeResult {
    if (baseAccount === null) {
      if (localAccount !== null && remoteAccount !== null) {
        if (this.accountsEquivalent(localAccount, remoteAccount)) {
          return new AccountMergeResult(false, this.copyAccount(localAccount));
        }
        return new AccountMergeResult(true, null);
      }
      if (localAccount !== null) {
        return new AccountMergeResult(false, this.copyAccount(localAccount));
      }
      if (remoteAccount !== null) {
        return new AccountMergeResult(false, this.copyAccount(remoteAccount));
      }
      return new AccountMergeResult(false, null);
    }

    if (localAccount === null && remoteAccount === null) {
      return new AccountMergeResult(false, null);
    }

    if (localAccount === null && remoteAccount !== null) {
      return new AccountMergeResult(!this.accountsEquivalent(baseAccount, remoteAccount), null);
    }

    if (localAccount !== null && remoteAccount === null) {
      return new AccountMergeResult(!this.accountsEquivalent(baseAccount, localAccount), null);
    }

    if (localAccount === null || remoteAccount === null) {
      return new AccountMergeResult(false, null);
    }

    if (this.accountsEquivalent(localAccount, remoteAccount)) {
      return new AccountMergeResult(false, this.copyAccount(localAccount));
    }

    let issuer: StringMergeResult = this.mergeStringField(baseAccount.issuer, localAccount.issuer, remoteAccount.issuer);
    let accountName: StringMergeResult = this.mergeStringField(baseAccount.accountName, localAccount.accountName, remoteAccount.accountName);
    let secret: StringMergeResult = this.mergeStringField(baseAccount.secret, localAccount.secret, remoteAccount.secret);
    let digits: NumberMergeResult = this.mergeNumberField(baseAccount.digits, localAccount.digits, remoteAccount.digits);
    let period: NumberMergeResult = this.mergeNumberField(baseAccount.period, localAccount.period, remoteAccount.period);
    let algorithm: StringMergeResult = this.mergeStringField(baseAccount.algorithm, localAccount.algorithm, remoteAccount.algorithm);
    let groupName: StringMergeResult = this.mergeStringField(baseAccount.groupName, localAccount.groupName, remoteAccount.groupName);
    let iconKey: StringMergeResult = this.mergeStringField(baseAccount.iconKey, localAccount.iconKey, remoteAccount.iconKey);

    if (issuer.hasConflict || accountName.hasConflict || secret.hasConflict || digits.hasConflict ||
      period.hasConflict || algorithm.hasConflict || groupName.hasConflict || iconKey.hasConflict) {
      return new AccountMergeResult(true, null);
    }

    return new AccountMergeResult(false, new TotpAccount(
      baseAccount.id,
      issuer.value,
      accountName.value,
      secret.value,
      digits.value,
      period.value,
      algorithm.value,
      groupName.value,
      iconKey.value,
      this.pickLatestTimestamp(baseAccount.updatedAt, localAccount.updatedAt, remoteAccount.updatedAt)
    ));
  }

  private mergeStringField(baseValue: string, localValue: string, remoteValue: string): StringMergeResult {
    if (localValue === remoteValue) {
      return new StringMergeResult(false, localValue);
    }
    if (localValue === baseValue) {
      return new StringMergeResult(false, remoteValue);
    }
    if (remoteValue === baseValue) {
      return new StringMergeResult(false, localValue);
    }
    return new StringMergeResult(true, '');
  }

  private mergeNumberField(baseValue: number, localValue: number, remoteValue: number): NumberMergeResult {
    if (localValue === remoteValue) {
      return new NumberMergeResult(false, localValue);
    }
    if (localValue === baseValue) {
      return new NumberMergeResult(false, remoteValue);
    }
    if (remoteValue === baseValue) {
      return new NumberMergeResult(false, localValue);
    }
    return new NumberMergeResult(true, 0);
  }

  private createAccountMap(accounts: TotpAccount[]): Map<string, TotpAccount> {
    let accountMap: Map<string, TotpAccount> = new Map<string, TotpAccount>();
    for (let index: number = 0; index < accounts.length; index++) {
      accountMap.set(accounts[index].id, accounts[index]);
    }
    return accountMap;
  }

  private collectAccountIds(baseAccounts: TotpAccount[], localAccounts: TotpAccount[], remoteAccounts: TotpAccount[]): string[] {
    let accountIds: string[] = [];
    this.appendAccountIds(accountIds, baseAccounts);
    this.appendAccountIds(accountIds, localAccounts);
    this.appendAccountIds(accountIds, remoteAccounts);
    return accountIds;
  }

  private appendAccountIds(accountIds: string[], accounts: TotpAccount[]): void {
    for (let index: number = 0; index < accounts.length; index++) {
      if (accountIds.indexOf(accounts[index].id) < 0) {
        accountIds.push(accounts[index].id);
      }
    }
  }

  private readAccount(accountMap: Map<string, TotpAccount>, accountId: string): TotpAccount | null {
    let account: TotpAccount | undefined = accountMap.get(accountId);
    return account === undefined ? null : account;
  }

  private accountsEquivalent(left: TotpAccount, right: TotpAccount): boolean {
    return left.id === right.id &&
      left.issuer === right.issuer &&
      left.accountName === right.accountName &&
      left.secret === right.secret &&
      left.digits === right.digits &&
      left.period === right.period &&
      left.algorithm === right.algorithm &&
      left.groupName === right.groupName &&
      left.iconKey === right.iconKey;
  }

  private copyAccount(account: TotpAccount): TotpAccount {
    return new TotpAccount(
      account.id,
      account.issuer,
      account.accountName,
      account.secret,
      account.digits,
      account.period,
      account.algorithm,
      account.groupName,
      account.iconKey,
      account.updatedAt
    );
  }

  private pickLatestTimestamp(baseUpdatedAt: string, localUpdatedAt: string, remoteUpdatedAt: string): string {
    let latest: string = baseUpdatedAt;
    if (localUpdatedAt > latest) {
      latest = localUpdatedAt;
    }
    if (remoteUpdatedAt > latest) {
      latest = remoteUpdatedAt;
    }
    return latest;
  }

  private createFingerprint(vault: LocalVault): string {
    let accountPayloads: string[] = [];
    for (let index: number = 0; index < vault.accounts.length; index++) {
      let account = vault.accounts[index];
      accountPayloads.push(JSON.stringify({
        id: account.id,
        issuer: account.issuer,
        accountName: account.accountName,
        secret: account.secret,
        digits: account.digits,
        period: account.period,
        algorithm: account.algorithm,
        groupName: account.groupName,
        iconKey: account.iconKey
      }));
    }
    accountPayloads.sort();
    return this.hashText(JSON.stringify(accountPayloads));
  }

  private hashText(text: string): string {
    let hash: number = 2166136261;
    for (let index: number = 0; index < text.length; index++) {
      hash = hash ^ text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return `fp:${(hash >>> 0).toString(16)}:${text.length}`;
  }

  private createRevision(fingerprint: string): string {
    return `harmony:${Date.now()}:${fingerprint}`;
  }

  private readErrorMessage(error: Object): string {
    let businessError: BusinessError = error as BusinessError;
    if (businessError && businessError.message && businessError.message.length > 0) {
      return businessError.message;
    }
    let plainError: Error = error as Error;
    if (plainError && plainError.message && plainError.message.length > 0) {
      return plainError.message;
    }
    return '同步失败，请稍后重试。';
  }

  private isRemotePasswordBlockedError(error: Object): boolean {
    let message: string = this.readErrorMessage(error);
    return message.indexOf('解密 WebDAV 保管库失败') >= 0 ||
      message.indexOf('主密码') >= 0 ||
      message.indexOf('decrypt') >= 0;
  }
}
