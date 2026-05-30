import { WebDavSyncResult } from '../services/WebDavSyncService';

export const HOME_MESSAGE_KIND_ERROR: string = 'error';
export const HOME_MESSAGE_KIND_SUCCESS: string = 'success';
export const REMOTE_PASSWORD_DIALOG_HIDE: string = 'hide';
export const REMOTE_PASSWORD_DIALOG_KEEP: string = 'keep';
export const REMOTE_PASSWORD_DIALOG_SHOW: string = 'show';

export class SyncResultPresentation {
  hasSyncConflict: boolean;
  syncStatusMessage: string;
  homeMessage: string;
  homeMessageKind: string;
  remotePasswordDialogAction: string;

  constructor(
    hasSyncConflict: boolean,
    syncStatusMessage: string,
    homeMessage: string,
    homeMessageKind: string,
    remotePasswordDialogAction: string
  ) {
    this.hasSyncConflict = hasSyncConflict;
    this.syncStatusMessage = syncStatusMessage;
    this.homeMessage = homeMessage;
    this.homeMessageKind = homeMessageKind;
    this.remotePasswordDialogAction = remotePasswordDialogAction;
  }
}

export class SyncResultPresentationPolicy {
  static forStandardSync(result: WebDavSyncResult, isUnlocked: boolean, activeRoute: string): SyncResultPresentation {
    let isBlocked: boolean = result.status === 'blocked';
    let isConflict: boolean = result.status === 'conflict';
    return new SyncResultPresentation(
      isConflict,
      result.message,
      result.message,
      isBlocked || isConflict ? HOME_MESSAGE_KIND_ERROR : HOME_MESSAGE_KIND_SUCCESS,
      isBlocked ? (isUnlocked && activeRoute !== 'unlock' ? REMOTE_PASSWORD_DIALOG_SHOW : REMOTE_PASSWORD_DIALOG_HIDE) : REMOTE_PASSWORD_DIALOG_KEEP
    );
  }

  static forRemotePasswordVerification(result: WebDavSyncResult): SyncResultPresentation {
    let isConflict: boolean = result.status === 'conflict';
    return new SyncResultPresentation(
      isConflict,
      result.message,
      result.message,
      isConflict ? HOME_MESSAGE_KIND_ERROR : HOME_MESSAGE_KIND_SUCCESS,
      REMOTE_PASSWORD_DIALOG_KEEP
    );
  }

  static forConflictResolution(result: WebDavSyncResult): SyncResultPresentation {
    let isConflict: boolean = result.status === 'conflict';
    let isBlocked: boolean = result.status === 'blocked';
    return new SyncResultPresentation(
      isConflict,
      result.message,
      result.message,
      isBlocked || isConflict ? HOME_MESSAGE_KIND_ERROR : HOME_MESSAGE_KIND_SUCCESS,
      REMOTE_PASSWORD_DIALOG_KEEP
    );
  }
}
