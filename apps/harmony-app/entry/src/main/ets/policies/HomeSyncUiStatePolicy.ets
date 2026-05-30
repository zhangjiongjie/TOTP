export const HOME_SYNC_OPERATION_CONFLICT_KEEP_LOCAL: string = 'conflictKeepLocal';
export const HOME_SYNC_OPERATION_CONFLICT_USE_REMOTE: string = 'conflictUseRemote';
export const HOME_SYNC_OPERATION_LOCAL_CHANGE: string = 'localChange';
export const HOME_SYNC_OPERATION_MANUAL: string = 'manual';

export class HomeSyncOperationStartResult {
  canStart: boolean;
  syncStatusMessage: string;
  successMessage: string;
  errorMessage: string;

  constructor(canStart: boolean, syncStatusMessage: string, successMessage: string, errorMessage: string) {
    this.canStart = canStart;
    this.syncStatusMessage = syncStatusMessage;
    this.successMessage = successMessage;
    this.errorMessage = errorMessage;
  }
}

export class HomeSyncAvailabilityResult {
  canSync: boolean;
  syncStatusMessage: string;

  constructor(canSync: boolean, syncStatusMessage: string) {
    this.canSync = canSync;
    this.syncStatusMessage = syncStatusMessage;
  }
}

export class HomeSyncUiStatePolicy {
  static resolveOperationStart(operation: string, isSyncing: boolean, canSync: boolean): HomeSyncOperationStartResult {
    if (isSyncing) {
      return new HomeSyncOperationStartResult(false, '', '', '同步正在进行中，请稍后再试。');
    }

    if (!canSync && operation === HOME_SYNC_OPERATION_MANUAL) {
      return new HomeSyncOperationStartResult(false, '', 'WebDAV 同步未开启，本地模式。', '');
    }

    if (!canSync && operation === HOME_SYNC_OPERATION_LOCAL_CHANGE) {
      return new HomeSyncOperationStartResult(false, 'WebDAV 同步未开启，本地模式。', '', '');
    }

    return new HomeSyncOperationStartResult(true, HomeSyncUiStatePolicy.resolveStartMessage(operation), '', '');
  }

  static resolveAvailability(canSync: boolean, isSyncing: boolean, hasSyncConflict: boolean, hasSettingsError: boolean): HomeSyncAvailabilityResult {
    if (canSync) {
      return new HomeSyncAvailabilityResult(true, '');
    }
    if (isSyncing || hasSyncConflict) {
      return new HomeSyncAvailabilityResult(false, '');
    }
    return new HomeSyncAvailabilityResult(false, hasSettingsError ? '同步设置暂不可用。' : 'WebDAV 同步未开启，本地模式。');
  }

  private static resolveStartMessage(operation: string): string {
    if (operation === HOME_SYNC_OPERATION_LOCAL_CHANGE) {
      return '同步本地变更中...';
    }
    if (operation === HOME_SYNC_OPERATION_CONFLICT_KEEP_LOCAL) {
      return '正在用本地版本覆盖远端...';
    }
    if (operation === HOME_SYNC_OPERATION_CONFLICT_USE_REMOTE) {
      return '正在使用远端版本覆盖本地...';
    }
    return '同步中...';
  }
}
