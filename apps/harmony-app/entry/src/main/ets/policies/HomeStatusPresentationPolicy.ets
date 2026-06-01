import { AppI18n } from '../utils/AppI18n';

export const HOME_STATUS_TONE_ERROR: string = 'error';
export const HOME_STATUS_TONE_SECONDARY: string = 'secondary';
export const HOME_STATUS_TONE_SUCCESS: string = 'success';

export class HomeStatusPresentationInput {
  hasSyncConflict: boolean;
  isSyncing: boolean;
  errorMessage: string;
  statusMessage: string;
  copyStatusMessage: string;
  regularSyncStatus: string;

  constructor(
    hasSyncConflict: boolean,
    isSyncing: boolean,
    errorMessage: string,
    statusMessage: string,
    copyStatusMessage: string,
    regularSyncStatus: string
  ) {
    this.hasSyncConflict = hasSyncConflict;
    this.isSyncing = isSyncing;
    this.errorMessage = errorMessage;
    this.statusMessage = statusMessage;
    this.copyStatusMessage = copyStatusMessage;
    this.regularSyncStatus = regularSyncStatus;
  }
}

export class HomeRegularSyncStatusInput {
  isSyncing: boolean;
  canSync: boolean;
  isBlocked: boolean;
  hasSettingsError: boolean;
  lastError: string;

  constructor(isSyncing: boolean, canSync: boolean, isBlocked: boolean, hasSettingsError: boolean, lastError: string) {
    this.isSyncing = isSyncing;
    this.canSync = canSync;
    this.isBlocked = isBlocked;
    this.hasSettingsError = hasSettingsError;
    this.lastError = lastError;
  }
}

export class HomeStatusPresentation {
  shouldShow: boolean;
  message: string;
  tone: string;

  constructor(shouldShow: boolean, message: string, tone: string) {
    this.shouldShow = shouldShow;
    this.message = message;
    this.tone = tone;
  }
}

export class HomeStatusPresentationPolicy {
  static resolve(input: HomeStatusPresentationInput): HomeStatusPresentation {
    let message: string = HomeStatusPresentationPolicy.resolveMessage(input.errorMessage, input.copyStatusMessage, input.regularSyncStatus);
    return new HomeStatusPresentation(
      input.hasSyncConflict || input.isSyncing || input.errorMessage.length > 0 || input.statusMessage.length > 0 || input.copyStatusMessage.length > 0 || input.regularSyncStatus.length > 0,
      message,
      HomeStatusPresentationPolicy.resolveTone(input.errorMessage, input.copyStatusMessage, message)
    );
  }

  static resolveRegularSyncStatus(input: HomeRegularSyncStatusInput): string {
    if (input.isSyncing) {
      return AppI18n.globalString($r('app.string.home_syncing_status'), 'Syncing...');
    }
    if (input.hasSettingsError) {
      return AppI18n.globalString($r('app.string.home_sync_settings_unavailable'), 'Sync settings are unavailable.');
    }
    if (!input.canSync) {
      return AppI18n.globalString($r('app.string.home_sync_disabled_status'), 'WebDAV sync is off. Local mode.');
    }
    if (input.isBlocked || HomeStatusPresentationPolicy.isRemotePasswordStatus(input.lastError)) {
      return AppI18n.globalString($r('app.string.home_sync_remote_password_required'), 'Verify the remote vault master password to continue syncing.');
    }
    return AppI18n.globalString($r('app.string.home_sync_available'), 'Local and WebDAV are already up to date.');
  }

  static isRemotePasswordStatus(message: string): boolean {
    return message.indexOf('远端保管库') >= 0 ||
      message.indexOf('远端密码库') >= 0 ||
      message.indexOf('Master password is incorrect') >= 0 ||
      message.indexOf('master password') >= 0 ||
      message.indexOf('remote vault') >= 0 ||
      message.indexOf('remote password') >= 0 ||
      message.indexOf('主密码') >= 0;
  }

  private static resolveMessage(errorMessage: string, copyStatusMessage: string, regularSyncStatus: string): string {
    if (errorMessage.length > 0) {
      return errorMessage;
    }
    if (copyStatusMessage.length > 0) {
      return copyStatusMessage;
    }
    return regularSyncStatus;
  }

  private static resolveTone(errorMessage: string, copyStatusMessage: string, message: string): string {
    if (errorMessage.length > 0) {
      return HOME_STATUS_TONE_ERROR;
    }
    if (copyStatusMessage.length > 0) {
      return HOME_STATUS_TONE_SUCCESS;
    }
    if (HomeStatusPresentationPolicy.isRemotePasswordStatus(message)) {
      return HOME_STATUS_TONE_ERROR;
    }
    return HOME_STATUS_TONE_SECONDARY;
  }
}
