import { common } from '@kit.AbilityKit';
import { BusinessError } from '@kit.BasicServicesKit';
import { LocalVault, createLocalVaultFromJson } from '../model/LocalVault';
import { WebDavSettings } from '../model/WebDavSettings';
import { WebDavSyncMetadata, createDefaultWebDavSyncMetadata } from '../model/WebDavSyncMetadata';
import { LocalVaultStore } from '../storage/LocalVaultStore';
import { SettingsStore } from '../storage/SettingsStore';
import { WebDavClient, WebDavRemoteSnapshot, WebDavUploadResult } from './WebDavClient';
import { EncryptedRemoteVaultBlob, RemoteVaultCryptoService } from './RemoteVaultCryptoService';
import { UnlockService } from './UnlockService';
import { AppI18n } from '../utils/AppI18n';
import {
  WEBDAV_SYNC_DECISION_CONFLICT,
  WEBDAV_SYNC_DECISION_FIRST_BIND_CONFLICT,
  WEBDAV_SYNC_DECISION_IDLE_EMPTY,
  WEBDAV_SYNC_DECISION_MERGE_AND_PUSH,
  WEBDAV_SYNC_DECISION_PULL_REMOTE,
  WEBDAV_SYNC_DECISION_PUSH_LOCAL,
  WEBDAV_SYNC_DECISION_REFRESH_BASELINE,
  WEBDAV_SYNC_DECISION_SYNCED,
  WEBDAV_SYNC_DECISION_SYNCED_EMPTY,
  WebDavSyncDecision,
  WebDavSyncDecisionInput
} from './WebDavSyncDecision';
import { WebDavVaultSyncAlgorithms } from './WebDavVaultSyncAlgorithms';
import { WEBDAV_SYNC_TRIGGER_LOCAL_CHANGE, WEBDAV_SYNC_TRIGGER_MANUAL, WebDavSyncTriggerPolicy } from './WebDavSyncTriggerPolicy';

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
  private operationQueue: Promise<void> = Promise.resolve();

  static getInstance(): WebDavSyncService {
    if (WebDavSyncService.instance === undefined) {
      WebDavSyncService.instance = new WebDavSyncService();
    }
    return WebDavSyncService.instance;
  }

  async syncNow(context: common.UIAbilityContext): Promise<WebDavSyncResult> {
    return await this.runExclusive((): Promise<WebDavSyncResult> => {
      return this.syncNowLocked(context);
    });
  }

  async syncLocalChange(context: common.UIAbilityContext): Promise<WebDavSyncResult> {
    return await this.runExclusive((): Promise<WebDavSyncResult> => {
      return this.syncLocalChangeLocked(context);
    });
  }

  private async syncNowLocked(context: common.UIAbilityContext): Promise<WebDavSyncResult> {
    return await this.syncCoreLocked(context, WEBDAV_SYNC_TRIGGER_MANUAL);
  }

  private async syncCoreLocked(context: common.UIAbilityContext, trigger: string): Promise<WebDavSyncResult> {
    let settings: WebDavSettings = this.settingsStore.loadWebDavSettings(context);
    if (!settings.enabled) {
      return new WebDavSyncResult('disabled', this.appString($r('app.string.webdav_disabled_local_only'), 'WebDAV is not enabled. Sync stays on this device.'));
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
      return new WebDavSyncResult('blocked', this.appString($r('app.string.home_sync_remote_password_required'), 'Verify the remote vault master password to continue syncing.'));
    }
    let remoteSnapshot: WebDavRemoteSnapshot | undefined = remoteDownload.snapshot;
    let localFingerprint: string = this.createFingerprint(localVault);

    if (remoteSnapshot === undefined) {
      let decision: WebDavSyncDecision = WebDavSyncDecision.decideMissingRemote(localVault.accounts.length);
      if (decision.action === WEBDAV_SYNC_DECISION_IDLE_EMPTY) {
        this.saveMetadata(context, syncProfileKey, localFingerprint, this.createBaseVaultJson(localVault), '', '', 'idle', '');
        return new WebDavSyncResult('idle', this.appString($r('app.string.webdav_remote_empty_local_empty'), 'Remote vault does not exist yet, and local vault is empty.'));
      }
      return await this.pushLocal(context, settings, localVault, localFingerprint, '', WebDavSyncTriggerPolicy.resolveLocalPushMessage(trigger));
    }

    let remoteFingerprint: string = this.createFingerprint(remoteSnapshot.vault);
    let mergedVault: LocalVault | undefined = undefined;
    if (metadata.baseFingerprint.length > 0 &&
      localFingerprint !== metadata.baseFingerprint &&
      remoteFingerprint !== metadata.baseFingerprint) {
      mergedVault = this.mergeAccountLevelChanges(metadata, localVault, remoteSnapshot.vault);
    }
    let decision: WebDavSyncDecision = WebDavSyncDecision.decideExistingRemote(new WebDavSyncDecisionInput(
      localVaultIsUninitialized,
      true,
      localFingerprint,
      remoteFingerprint,
      metadata.baseFingerprint,
      localVault.accounts.length,
      remoteSnapshot.vault.accounts.length,
      mergedVault !== undefined
    ));

    if (decision.action === WEBDAV_SYNC_DECISION_PULL_REMOTE) {
      return this.pullRemote(context, settings, remoteSnapshot, remoteFingerprint);
    }
    if (decision.action === WEBDAV_SYNC_DECISION_SYNCED_EMPTY) {
      this.saveMetadata(context, syncProfileKey, remoteFingerprint, this.createBaseVaultJson(remoteSnapshot.vault), remoteSnapshot.revision, remoteSnapshot.etag, 'synced', '');
      return new WebDavSyncResult('synced', this.appString($r('app.string.webdav_both_empty'), 'Local and WebDAV are both empty.'));
    }
    if (decision.action === WEBDAV_SYNC_DECISION_SYNCED) {
      this.vaultStore.saveWithRemoteKey(context, localVault, remoteSnapshot.encryptedVault, remoteSnapshot.vaultKey);
      this.saveMetadata(context, syncProfileKey, remoteFingerprint, this.createBaseVaultJson(localVault), remoteSnapshot.revision, remoteSnapshot.etag, 'synced', '');
      return new WebDavSyncResult('synced', this.appString($r('app.string.webdav_synced_latest'), 'Local and WebDAV are up to date.'));
    }
    if (decision.action === WEBDAV_SYNC_DECISION_FIRST_BIND_CONFLICT) {
      this.saveMetadata(context, syncProfileKey, metadata.baseFingerprint, metadata.baseVaultJson, metadata.remoteRevision, metadata.remoteEtag, 'conflict', this.appString($r('app.string.webdav_first_bind_conflict_metadata'), 'Local and remote both contain data during first binding.'));
      return new WebDavSyncResult('conflict', this.appString($r('app.string.webdav_first_bind_conflict'), 'Local and remote both contain data during first binding. Choose which side to keep first.'));
    }
    if (decision.action === WEBDAV_SYNC_DECISION_PUSH_LOCAL) {
      this.vaultStore.saveWithRemoteKey(context, localVault, remoteSnapshot.encryptedVault, remoteSnapshot.vaultKey);
      return await this.pushLocal(context, settings, localVault, localFingerprint, remoteSnapshot.etag, WebDavSyncTriggerPolicy.resolveLocalPushMessage(trigger), remoteSnapshot);
    }
    if (decision.action === WEBDAV_SYNC_DECISION_REFRESH_BASELINE) {
      this.saveMetadata(context, syncProfileKey, remoteFingerprint, this.createBaseVaultJson(localVault), remoteSnapshot.revision, remoteSnapshot.etag, 'synced', '');
      return new WebDavSyncResult('synced', this.appString($r('app.string.webdav_baseline_refreshed'), 'Sync baseline refreshed.'));
    }

    if (decision.action === WEBDAV_SYNC_DECISION_MERGE_AND_PUSH && mergedVault !== undefined) {
      let savedMergedVault: LocalVault = this.vaultStore.saveWithRemoteKey(context, mergedVault, remoteSnapshot.encryptedVault, remoteSnapshot.vaultKey);
      let mergedFingerprint: string = this.createFingerprint(savedMergedVault);
      return await this.pushLocal(
        context,
        settings,
        savedMergedVault,
        mergedFingerprint,
        remoteSnapshot.etag,
        this.appString($r('app.string.webdav_auto_merged_synced'), 'Local and remote changes were merged automatically and synced to WebDAV.'),
        remoteSnapshot
      );
    }

    if (decision.action !== WEBDAV_SYNC_DECISION_CONFLICT) {
      this.saveMetadata(context, syncProfileKey, metadata.baseFingerprint, metadata.baseVaultJson, metadata.remoteRevision, metadata.remoteEtag, 'conflict', this.appString($r('app.string.webdav_decision_unhandled_metadata'), 'Sync decision could not be handled.'));
      return new WebDavSyncResult('conflict', this.appString($r('app.string.webdav_decision_unhandled'), 'Sync decision could not be handled. Please try again later.'));
    }

    this.saveMetadata(context, syncProfileKey, metadata.baseFingerprint, metadata.baseVaultJson, metadata.remoteRevision, metadata.remoteEtag, 'conflict', this.appString($r('app.string.webdav_both_changed_metadata'), 'Local and remote both changed.'));
    return new WebDavSyncResult('conflict', this.appString($r('app.string.webdav_both_changed_choose'), 'Local and remote both changed. Choose keep local or use remote on the home page.'));
  }

  private async syncLocalChangeLocked(context: common.UIAbilityContext): Promise<WebDavSyncResult> {
    return await this.syncCoreLocked(context, WEBDAV_SYNC_TRIGGER_LOCAL_CHANGE);
  }

  async keepLocalVersion(context: common.UIAbilityContext): Promise<WebDavSyncResult> {
    return await this.runExclusive((): Promise<WebDavSyncResult> => {
      return this.keepLocalVersionLocked(context);
    });
  }

  private async keepLocalVersionLocked(context: common.UIAbilityContext): Promise<WebDavSyncResult> {
    let settings: WebDavSettings = this.settingsStore.loadWebDavSettings(context);
    if (!settings.enabled) {
      return new WebDavSyncResult('disabled', this.appString($r('app.string.webdav_disabled_conflict'), 'WebDAV is not enabled. Sync conflicts cannot be resolved.'));
    }
    this.validateSettings(settings);

    let localVault: LocalVault = this.vaultStore.load(context);
    let localFingerprint: string = this.createFingerprint(localVault);
    let metadata: WebDavSyncMetadata = this.settingsStore.loadWebDavSyncMetadata(context);
    let syncProfileKey: string = this.createSyncProfileKey(settings);
    let remoteDownload: WebDavDownloadResult = await this.downloadOrBlocked(context, settings, metadata, syncProfileKey);
    if (remoteDownload.blocked) {
      return new WebDavSyncResult('blocked', this.appString($r('app.string.home_sync_remote_password_required'), 'Verify the remote vault master password to continue syncing.'));
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
    return await this.runExclusive((): Promise<WebDavSyncResult> => {
      return this.useRemoteVersionLocked(context);
    });
  }

  private async useRemoteVersionLocked(context: common.UIAbilityContext): Promise<WebDavSyncResult> {
    let settings: WebDavSettings = this.settingsStore.loadWebDavSettings(context);
    if (!settings.enabled) {
      return new WebDavSyncResult('disabled', this.appString($r('app.string.webdav_disabled_conflict'), 'WebDAV is not enabled. Sync conflicts cannot be resolved.'));
    }
    this.validateSettings(settings);

    let remoteDownload: WebDavDownloadResult = await this.downloadOrBlocked(
      context,
      settings,
      this.settingsStore.loadWebDavSyncMetadata(context),
      this.createSyncProfileKey(settings)
    );
    if (remoteDownload.blocked) {
      return new WebDavSyncResult('blocked', this.appString($r('app.string.home_sync_remote_password_required'), 'Verify the remote vault master password to continue syncing.'));
    }
    let remoteSnapshot: WebDavRemoteSnapshot | undefined = remoteDownload.snapshot;
    if (remoteSnapshot === undefined) {
      return new WebDavSyncResult('missing', this.appString($r('app.string.webdav_remote_missing_use'), 'Remote vault does not exist. Cannot use the remote version.'));
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
    message: string = AppI18n.globalString($r('app.string.webdav_local_modified_synced'), 'Local updates synced to WebDAV.'),
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
    return new WebDavSyncResult('pulled', this.appString($r('app.string.webdav_restored_remote'), 'Restored the remote version from WebDAV.'), vault);
  }

  async verifyRemoteMasterPassword(context: common.UIAbilityContext, remotePassword: string): Promise<WebDavSyncResult> {
    return await this.runExclusive((): Promise<WebDavSyncResult> => {
      return this.verifyRemoteMasterPasswordLocked(context, remotePassword);
    });
  }

  private async verifyRemoteMasterPasswordLocked(context: common.UIAbilityContext, remotePassword: string): Promise<WebDavSyncResult> {
    let settings: WebDavSettings = this.settingsStore.loadWebDavSettings(context);
    if (!settings.enabled) {
      return new WebDavSyncResult('disabled', this.appString($r('app.string.webdav_disabled_local_only'), 'WebDAV is not enabled. Sync stays on this device.'));
    }
    this.validateSettings(settings);
    if (remotePassword.trim().length === 0) {
      throw new Error(this.appString($r('app.string.error_remote_master_password_required'), 'Enter the remote master password.'));
    }

    let metadata: WebDavSyncMetadata = this.settingsStore.loadWebDavSyncMetadata(context);
    let syncProfileKey: string = this.createSyncProfileKey(settings);
    let remoteSnapshot: WebDavRemoteSnapshot | undefined = await this.client.downloadWithPassword(settings, remotePassword.trim());
    if (remoteSnapshot === undefined) {
      throw new Error(this.appString($r('app.string.webdav_remote_missing_use'), 'Remote vault does not exist. Cannot use the remote version.'));
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
      return new WebDavSyncResult('synced', this.appString($r('app.string.webdav_both_empty'), 'Local and WebDAV are both empty.'), vault);
    }

    if (localFingerprint === remoteFingerprint) {
      let vault: LocalVault = this.vaultStore.saveWithRemoteKey(context, remoteSnapshot.vault, remoteSnapshot.encryptedVault, remoteSnapshot.vaultKey);
      this.saveMetadata(context, syncProfileKey, remoteFingerprint, this.createBaseVaultJson(vault), remoteSnapshot.revision, remoteSnapshot.etag, 'synced', '');
      UnlockService.getInstance().adoptRemoteMasterPassword(context, remotePassword);
      return new WebDavSyncResult('pulled', this.appString($r('app.string.webdav_remote_password_verified_updated'), 'Remote vault password verified. Local password updated.'), vault);
    }

    let baseVault: LocalVault | undefined = this.loadBaseVault(metadata);
    if (baseVault === undefined || metadata.baseFingerprint.length === 0) {
      if (localVault.accounts.length === 0) {
        let vault: LocalVault = this.vaultStore.saveWithRemoteKey(context, remoteSnapshot.vault, remoteSnapshot.encryptedVault, remoteSnapshot.vaultKey);
        this.saveMetadata(context, syncProfileKey, remoteFingerprint, this.createBaseVaultJson(vault), remoteSnapshot.revision, remoteSnapshot.etag, 'synced', '');
        UnlockService.getInstance().adoptRemoteMasterPassword(context, remotePassword);
        return new WebDavSyncResult('pulled', this.appString($r('app.string.webdav_restored_remote'), 'Restored the remote version from WebDAV.'), vault);
      }
      if (remoteSnapshot.vault.accounts.length === 0) {
        let savedLocal: LocalVault = this.vaultStore.saveWithRemoteKey(context, localVault, remoteSnapshot.encryptedVault, remoteSnapshot.vaultKey);
        let pushed: WebDavSyncResult = await this.pushLocal(context, settings, savedLocal, this.createFingerprint(savedLocal), remoteSnapshot.etag, this.appString($r('app.string.webdav_local_modified_synced'), 'Local updates synced to WebDAV.'), remoteSnapshot);
        UnlockService.getInstance().adoptRemoteMasterPassword(context, remotePassword);
        return pushed;
      }
      this.vaultStore.saveWithRemoteKey(context, localVault, remoteSnapshot.encryptedVault, remoteSnapshot.vaultKey);
      this.saveMetadata(context, syncProfileKey, metadata.baseFingerprint, metadata.baseVaultJson, remoteSnapshot.revision, remoteSnapshot.etag, 'conflict', this.appString($r('app.string.webdav_conflict_continue_metadata'), 'Local and remote have a sync conflict. Resolve it before continuing sync.'));
      UnlockService.getInstance().adoptRemoteMasterPassword(context, remotePassword);
      return new WebDavSyncResult('conflict', this.appString($r('app.string.webdav_conflict_resolve_first_data'), 'Local and remote both contain data. Resolve the sync conflict first.'));
    }

    let localChanged: boolean = localFingerprint !== metadata.baseFingerprint;
    let remoteChanged: boolean = remoteFingerprint !== metadata.baseFingerprint;
    if (localChanged && !remoteChanged) {
      let savedLocal: LocalVault = this.vaultStore.saveWithRemoteKey(context, localVault, remoteSnapshot.encryptedVault, remoteSnapshot.vaultKey);
      let pushed: WebDavSyncResult = await this.pushLocal(context, settings, savedLocal, this.createFingerprint(savedLocal), remoteSnapshot.etag, this.appString($r('app.string.webdav_local_modified_synced'), 'Local updates synced to WebDAV.'), remoteSnapshot);
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
      return new WebDavSyncResult('synced', this.appString($r('app.string.webdav_baseline_refreshed'), 'Sync baseline refreshed.'), vault);
    }

    let mergedVault: LocalVault | undefined = this.mergeAccountLevelChanges(metadata, localVault, remoteSnapshot.vault);
    if (mergedVault !== undefined) {
      let savedMerged: LocalVault = this.vaultStore.saveWithRemoteKey(context, mergedVault, remoteSnapshot.encryptedVault, remoteSnapshot.vaultKey);
      let pushed: WebDavSyncResult = await this.pushLocal(context, settings, savedMerged, this.createFingerprint(savedMerged), remoteSnapshot.etag, this.appString($r('app.string.webdav_auto_merged_synced'), 'Local and remote changes were merged automatically and synced to WebDAV.'), remoteSnapshot);
      UnlockService.getInstance().adoptRemoteMasterPassword(context, remotePassword);
      return pushed;
    }

    this.vaultStore.saveWithRemoteKey(context, localVault, remoteSnapshot.encryptedVault, remoteSnapshot.vaultKey);
    this.saveMetadata(context, syncProfileKey, metadata.baseFingerprint, metadata.baseVaultJson, remoteSnapshot.revision, remoteSnapshot.etag, 'conflict', this.appString($r('app.string.webdav_conflict_continue_metadata'), 'Local and remote have a sync conflict. Resolve it before continuing sync.'));
    UnlockService.getInstance().adoptRemoteMasterPassword(context, remotePassword);
    return new WebDavSyncResult('conflict', this.appString($r('app.string.webdav_conflict_account'), 'Local and remote account data conflict. Resolve the sync conflict first.'));
  }

  async changeMasterPassword(context: common.UIAbilityContext, currentPassword: string, nextPassword: string): Promise<WebDavSyncResult> {
    return await this.runExclusive((): Promise<WebDavSyncResult> => {
      return this.changeMasterPasswordLocked(context, currentPassword, nextPassword);
    });
  }

  private async changeMasterPasswordLocked(context: common.UIAbilityContext, currentPassword: string, nextPassword: string): Promise<WebDavSyncResult> {
    let settings: WebDavSettings = this.settingsStore.loadWebDavSettings(context);
    let metadata: WebDavSyncMetadata = this.settingsStore.loadWebDavSyncMetadata(context);
    if (settings.enabled && metadata.lastStatus === 'blocked') {
      throw new Error(this.appString($r('app.string.webdav_remote_verify_before_password_change'), 'Verify the remote vault master password before continuing sync, then change the master password.'));
    }
    if (!settings.enabled) {
      this.vaultStore.rewrapMasterPassword(context, currentPassword, nextPassword);
      UnlockService.getInstance().updateMasterPassword(context, currentPassword, nextPassword);
      return new WebDavSyncResult('local', this.appString($r('app.string.master_password_changed'), 'Master password changed.'));
    }

    this.validateSettings(settings);
    let syncProfileKey: string = this.createSyncProfileKey(settings);
    metadata = metadata.syncProfileKey === syncProfileKey || metadata.syncProfileKey === this.createLegacySyncProfileKey(settings)
      ? metadata
      : createDefaultWebDavSyncMetadata();
    let localVault: LocalVault = this.vaultStore.load(context);
    this.vaultStore.assertMasterPassword(context, currentPassword);
    let remoteSnapshot: WebDavRemoteSnapshot | undefined;
    try {
      remoteSnapshot = await this.client.downloadWithPassword(settings, currentPassword);
    } catch (_error) {
      return new WebDavSyncResult('blocked', this.appString($r('app.string.webdav_remote_verify_before_password_change_short'), 'Verify the remote vault before changing the master password.'));
    }
    if (remoteSnapshot === undefined) {
      let localVaultKey: Uint8Array = this.vaultStore.exportVaultKey(context, currentPassword);
      let localFingerprint: string = this.createFingerprint(localVault);
      let encryptedVault: EncryptedRemoteVaultBlob = this.cryptoService.encryptWithPasswordAndVaultKey(localVault, nextPassword, localVaultKey);
      let revision: string = this.createRevision(localFingerprint);
      let upload: WebDavUploadResult = await this.client.uploadEncryptedVault(settings, encryptedVault, revision, '');
      let vault: LocalVault = this.vaultStore.saveWithRemoteKey(context, localVault, encryptedVault, localVaultKey);
      UnlockService.getInstance().updateMasterPassword(context, currentPassword, nextPassword);
      this.saveMetadata(context, syncProfileKey, localFingerprint, this.createBaseVaultJson(vault), upload.revision, upload.etag, 'synced', '');
      return new WebDavSyncResult('pushed', this.appString($r('app.string.master_password_changed_webdav'), 'Master password changed and synced to WebDAV.'), vault);
    }

    let localFingerprint: string = this.createFingerprint(localVault);
    let remoteFingerprint: string = this.createFingerprint(remoteSnapshot.vault);
    let mergedVault: LocalVault | undefined = undefined;
    if (metadata.baseFingerprint.length > 0 &&
      localFingerprint !== metadata.baseFingerprint &&
      remoteFingerprint !== metadata.baseFingerprint) {
      mergedVault = this.mergeAccountLevelChanges(metadata, localVault, remoteSnapshot.vault);
    }
    let decision: WebDavSyncDecision = WebDavSyncDecision.decidePasswordChange(new WebDavSyncDecisionInput(
      false,
      true,
      localFingerprint,
      remoteFingerprint,
      metadata.baseFingerprint,
      localVault.accounts.length,
      remoteSnapshot.vault.accounts.length,
      mergedVault !== undefined
    ));
    let finalVault: LocalVault;
    if (decision.action === WEBDAV_SYNC_DECISION_SYNCED) {
      finalVault = localVault;
    } else if (decision.action === WEBDAV_SYNC_DECISION_FIRST_BIND_CONFLICT) {
      this.saveMetadata(context, syncProfileKey, metadata.baseFingerprint, metadata.baseVaultJson, remoteSnapshot.revision, remoteSnapshot.etag, 'conflict', this.appString($r('app.string.webdav_first_bind_conflict_metadata'), 'Local and remote both contain data during first binding.'));
      return new WebDavSyncResult('conflict', this.appString($r('app.string.webdav_password_first_bind_conflict'), 'Master password was not synced: local and remote both contain data during first binding. Complete data sync first.'));
    } else if (decision.action === WEBDAV_SYNC_DECISION_PUSH_LOCAL) {
      finalVault = localVault;
    } else if (decision.action === WEBDAV_SYNC_DECISION_PULL_REMOTE) {
      finalVault = remoteSnapshot.vault;
    } else if (decision.action === WEBDAV_SYNC_DECISION_MERGE_AND_PUSH && mergedVault !== undefined) {
      finalVault = mergedVault;
    } else {
      this.saveMetadata(context, syncProfileKey, metadata.baseFingerprint, metadata.baseVaultJson, remoteSnapshot.revision, remoteSnapshot.etag, 'conflict', this.appString($r('app.string.webdav_both_changed_metadata'), 'Local and remote both changed.'));
      return new WebDavSyncResult('conflict', this.appString($r('app.string.webdav_both_changed_before_password_change'), 'Local and remote both changed. Resolve the conflict before changing the master password.'));
    }

    let fingerprint: string = this.createFingerprint(finalVault);
    let encryptedVault: EncryptedRemoteVaultBlob = fingerprint === remoteFingerprint
      ? this.cryptoService.rewrapKeyEncryption(remoteSnapshot.encryptedVault, nextPassword, remoteSnapshot.vaultKey)
      : this.cryptoService.encryptWithVaultKey(
        finalVault,
        this.cryptoService.rewrapKeyEncryption(remoteSnapshot.encryptedVault, nextPassword, remoteSnapshot.vaultKey),
        remoteSnapshot.vaultKey
      );
    let revision: string = this.createRevision(fingerprint);
    let upload: WebDavUploadResult = await this.client.uploadEncryptedVault(settings, encryptedVault, revision, remoteSnapshot.etag);
    let vault: LocalVault = this.vaultStore.saveWithRemoteKey(context, finalVault, encryptedVault, remoteSnapshot.vaultKey);
    UnlockService.getInstance().updateMasterPassword(context, currentPassword, nextPassword);
    this.saveMetadata(context, syncProfileKey, fingerprint, this.createBaseVaultJson(vault), upload.revision, upload.etag, 'synced', '');
    return new WebDavSyncResult('pushed', this.appString($r('app.string.master_password_changed_webdav'), 'Master password changed and synced to WebDAV.'), vault);
  }

  private async runExclusive(task: () => Promise<WebDavSyncResult>): Promise<WebDavSyncResult> {
    let previousOperation: Promise<void> = this.operationQueue;
    let releaseOperation: () => void = (): void => {};
    this.operationQueue = new Promise<void>((resolve: () => void): void => {
      releaseOperation = resolve;
    });

    await previousOperation;
    try {
      return await task();
    } finally {
      releaseOperation();
    }
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
          this.appString($r('app.string.home_sync_remote_password_required'), 'Verify the remote vault master password to continue syncing.')
        );
        return new WebDavDownloadResult(undefined, true);
      }
      throw new Error(this.readErrorMessage(error as Object));
    }
  }

  private validateSettings(settings: WebDavSettings): void {
    if (settings.serverUrl.trim().length === 0) {
      throw new Error(this.appString($r('app.string.error_webdav_server_required'), 'Enter the WebDAV server URL first.'));
    }
    if (!settings.serverUrl.startsWith('http://') && !settings.serverUrl.startsWith('https://')) {
      throw new Error(this.appString($r('app.string.webdav_validate_url_scheme'), 'WebDAV server URL must start with http:// or https://.'));
    }
    if (settings.filePath.trim().length === 0) {
      throw new Error(this.appString($r('app.string.webdav_validate_file_path_required'), 'Enter the WebDAV vault path first.'));
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
    return WebDavVaultSyncAlgorithms.mergeAccountLevelChanges(baseVault, localVault, remoteVault);
  }

  private createFingerprint(vault: LocalVault): string {
    return WebDavVaultSyncAlgorithms.createFingerprint(vault);
  }

  private hashText(text: string): string {
    return WebDavVaultSyncAlgorithms.hashText(text);
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
    return this.appString($r('app.string.webdav_sync_failed_retry'), 'Sync failed. Please try again later.');
  }

  private appString(resource: Resource, fallback: string): string {
    return AppI18n.globalString(resource, fallback);
  }

  private isRemotePasswordBlockedError(error: Object): boolean {
    let message: string = this.readErrorMessage(error);
    return message.indexOf('解密 WebDAV 保管库失败') >= 0 ||
      message.indexOf('主密码') >= 0 ||
      message.indexOf('Failed to decrypt WebDAV vault') >= 0 ||
      message.indexOf('master password') >= 0 ||
      message.indexOf('decrypt') >= 0;
  }
}
