import { AppI18n } from '../utils/AppI18n';

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
      return new HomeSyncOperationStartResult(false, '', '', AppI18n.globalString($r('app.string.home_sync_busy'), 'Sync is already in progress. Please try again later.'));
    }

    if (!canSync && operation === HOME_SYNC_OPERATION_MANUAL) {
      return new HomeSyncOperationStartResult(false, '', AppI18n.globalString($r('app.string.home_sync_disabled_status'), 'WebDAV sync is off. Local mode.'), '');
    }

    if (!canSync && operation === HOME_SYNC_OPERATION_LOCAL_CHANGE) {
      return new HomeSyncOperationStartResult(false, AppI18n.globalString($r('app.string.home_sync_disabled_status'), 'WebDAV sync is off. Local mode.'), '', '');
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
    return new HomeSyncAvailabilityResult(false, hasSettingsError
      ? AppI18n.globalString($r('app.string.home_sync_settings_unavailable'), 'Sync settings are unavailable.')
      : AppI18n.globalString($r('app.string.home_sync_disabled_status'), 'WebDAV sync is off. Local mode.'));
  }

  private static resolveStartMessage(operation: string): string {
    if (operation === HOME_SYNC_OPERATION_LOCAL_CHANGE) {
      return AppI18n.globalString($r('app.string.home_sync_local_change_status'), 'Syncing local changes...');
    }
    if (operation === HOME_SYNC_OPERATION_CONFLICT_KEEP_LOCAL) {
      return AppI18n.globalString($r('app.string.home_sync_conflict_keep_local_status'), 'Using the local version to overwrite remote...');
    }
    if (operation === HOME_SYNC_OPERATION_CONFLICT_USE_REMOTE) {
      return AppI18n.globalString($r('app.string.home_sync_conflict_use_remote_status'), 'Using the remote version to overwrite local...');
    }
    return AppI18n.globalString($r('app.string.home_syncing_status'), 'Syncing...');
  }
}
