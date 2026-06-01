import { common } from '@kit.AbilityKit';
import { SyncResultPresentation, SyncResultPresentationPolicy } from '../policies/SyncResultPresentationPolicy';
import { LocalVault } from '../model/LocalVault';
import { WebDavSyncResult, WebDavSyncService } from './WebDavSyncService';
import { AppI18n } from '../utils/AppI18n';

export const WEBDAV_SYNC_COORDINATOR_CONFLICT: string = 'conflict';
export const WEBDAV_SYNC_COORDINATOR_LOCAL_CHANGE: string = 'localChange';
export const WEBDAV_SYNC_COORDINATOR_MANUAL: string = 'manual';
export const WEBDAV_SYNC_COORDINATOR_REMOTE_PASSWORD: string = 'remotePassword';

export interface WebDavSyncOperationRunner {
  syncNow(context: Object): Promise<WebDavSyncResult>;
  syncLocalChange(context: Object): Promise<WebDavSyncResult>;
  verifyRemoteMasterPassword(context: Object, remotePassword: string): Promise<WebDavSyncResult>;
  keepLocalVersion(context: Object): Promise<WebDavSyncResult>;
  useRemoteVersion(context: Object): Promise<WebDavSyncResult>;
}

class DefaultWebDavSyncOperationRunner implements WebDavSyncOperationRunner {
  async syncNow(context: Object): Promise<WebDavSyncResult> {
    return await WebDavSyncService.getInstance().syncNow(context as common.UIAbilityContext);
  }

  async syncLocalChange(context: Object): Promise<WebDavSyncResult> {
    return await WebDavSyncService.getInstance().syncLocalChange(context as common.UIAbilityContext);
  }

  async verifyRemoteMasterPassword(context: Object, remotePassword: string): Promise<WebDavSyncResult> {
    return await WebDavSyncService.getInstance().verifyRemoteMasterPassword(context as common.UIAbilityContext, remotePassword);
  }

  async keepLocalVersion(context: Object): Promise<WebDavSyncResult> {
    return await WebDavSyncService.getInstance().keepLocalVersion(context as common.UIAbilityContext);
  }

  async useRemoteVersion(context: Object): Promise<WebDavSyncResult> {
    return await WebDavSyncService.getInstance().useRemoteVersion(context as common.UIAbilityContext);
  }
}

export class WebDavSyncActionOutcome {
  action: string;
  result: WebDavSyncResult | undefined;
  presentation: SyncResultPresentation | undefined;
  vault: LocalVault | undefined;
  errorMessage: string;
  remotePasswordErrorMessage: string;
  remotePasswordVerified: boolean;

  constructor(
    action: string,
    result: WebDavSyncResult | undefined,
    presentation: SyncResultPresentation | undefined,
    vault: LocalVault | undefined,
    errorMessage: string,
    remotePasswordErrorMessage: string,
    remotePasswordVerified: boolean
  ) {
    this.action = action;
    this.result = result;
    this.presentation = presentation;
    this.vault = vault;
    this.errorMessage = errorMessage;
    this.remotePasswordErrorMessage = remotePasswordErrorMessage;
    this.remotePasswordVerified = remotePasswordVerified;
  }

  static success(action: string, result: WebDavSyncResult, presentation: SyncResultPresentation, remotePasswordVerified: boolean = false): WebDavSyncActionOutcome {
    return new WebDavSyncActionOutcome(action, result, presentation, result.vault, '', '', remotePasswordVerified);
  }

  static error(action: string, message: string): WebDavSyncActionOutcome {
    return new WebDavSyncActionOutcome(action, undefined, undefined, undefined, message, '', false);
  }

  static remotePasswordError(message: string): WebDavSyncActionOutcome {
    return new WebDavSyncActionOutcome(WEBDAV_SYNC_COORDINATOR_REMOTE_PASSWORD, undefined, undefined, undefined, '', message, false);
  }

  hasError(): boolean {
    return this.errorMessage.length > 0 || this.remotePasswordErrorMessage.length > 0;
  }
}

export class WebDavSyncCoordinator {
  private runner: WebDavSyncOperationRunner;

  constructor(runner: WebDavSyncOperationRunner = new DefaultWebDavSyncOperationRunner()) {
    this.runner = runner;
  }

  async manualSync(context: Object, isUnlocked: boolean, activeRoute: string): Promise<WebDavSyncActionOutcome> {
    try {
      let result: WebDavSyncResult = await this.runner.syncNow(context);
      return WebDavSyncActionOutcome.success(
        WEBDAV_SYNC_COORDINATOR_MANUAL,
        result,
        SyncResultPresentationPolicy.forStandardSync(result, isUnlocked, activeRoute)
      );
    } catch (error) {
      return WebDavSyncActionOutcome.error(WEBDAV_SYNC_COORDINATOR_MANUAL, this.normalizeError(
        error,
        AppI18n.globalString($r('app.string.webdav_sync_failed'), 'Sync failed'),
        AppI18n.globalString($r('app.string.webdav_sync_failed_retry'), 'Sync failed. Please try again later.')
      ));
    }
  }

  async syncLocalChange(context: Object, isUnlocked: boolean, activeRoute: string): Promise<WebDavSyncActionOutcome> {
    try {
      let result: WebDavSyncResult = await this.runner.syncLocalChange(context);
      return WebDavSyncActionOutcome.success(
        WEBDAV_SYNC_COORDINATOR_LOCAL_CHANGE,
        result,
        SyncResultPresentationPolicy.forStandardSync(result, isUnlocked, activeRoute)
      );
    } catch (error) {
      return WebDavSyncActionOutcome.error(WEBDAV_SYNC_COORDINATOR_LOCAL_CHANGE, this.normalizeError(
        error,
        AppI18n.globalString($r('app.string.webdav_sync_local_change_failed'), 'Failed to sync local changes'),
        AppI18n.globalString($r('app.string.webdav_sync_local_change_failed_retry'), 'Failed to sync local changes. Please try again later.')
      ));
    }
  }

  async verifyRemotePassword(context: Object, remotePassword: string): Promise<WebDavSyncActionOutcome> {
    if (remotePassword.trim().length === 0) {
      return WebDavSyncActionOutcome.remotePasswordError(AppI18n.globalString($r('app.string.error_remote_master_password_required'), 'Enter the remote master password.'));
    }
    try {
      let result: WebDavSyncResult = await this.runner.verifyRemoteMasterPassword(context, remotePassword);
      return WebDavSyncActionOutcome.success(
        WEBDAV_SYNC_COORDINATOR_REMOTE_PASSWORD,
        result,
        SyncResultPresentationPolicy.forRemotePasswordVerification(result),
        true
      );
    } catch (error) {
      return WebDavSyncActionOutcome.remotePasswordError(this.readErrorMessage(error, AppI18n.globalString($r('app.string.webdav_remote_password_verify_failed'), 'Remote vault password verification failed.')));
    }
  }

  async resolveConflict(context: Object, keepLocal: boolean): Promise<WebDavSyncActionOutcome> {
    try {
      let result: WebDavSyncResult = keepLocal
        ? await this.runner.keepLocalVersion(context)
        : await this.runner.useRemoteVersion(context);
      return WebDavSyncActionOutcome.success(
        WEBDAV_SYNC_COORDINATOR_CONFLICT,
        result,
        SyncResultPresentationPolicy.forConflictResolution(result)
      );
    } catch (error) {
      return WebDavSyncActionOutcome.error(WEBDAV_SYNC_COORDINATOR_CONFLICT, this.normalizeError(
        error,
        AppI18n.globalString($r('app.string.webdav_conflict_resolve_failed'), 'Failed to resolve conflict'),
        AppI18n.globalString($r('app.string.webdav_conflict_resolve_failed_retry'), 'Failed to resolve conflict. Please try again later.')
      ));
    }
  }

  private normalizeError(error: Object, prefix: string, fallback: string): string {
    let message: string = this.readErrorMessage(error, '');
    return message.length > 0 ? `${prefix}：${message}` : fallback;
  }

  private readErrorMessage(error: Object, fallback: string): string {
    let runtimeError: Error = error as Error;
    if (runtimeError && runtimeError.message && runtimeError.message.length > 0) {
      return runtimeError.message;
    }
    return fallback;
  }
}
