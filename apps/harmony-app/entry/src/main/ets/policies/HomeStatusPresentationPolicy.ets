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
      return '同步中...';
    }
    if (input.hasSettingsError) {
      return '同步设置暂不可用。';
    }
    if (!input.canSync) {
      return 'WebDAV 同步未开启，本地模式。';
    }
    if (input.isBlocked || HomeStatusPresentationPolicy.isRemotePasswordStatus(input.lastError)) {
      return '远端保管库需要主密码验证后才能继续同步。';
    }
    return '本地与 WebDAV 已经是最新版本。';
  }

  static isRemotePasswordStatus(message: string): boolean {
    return message.indexOf('远端保管库') >= 0 ||
      message.indexOf('远端密码库') >= 0 ||
      message.indexOf('Master password is incorrect') >= 0 ||
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
