import { AppI18n } from '../utils/AppI18n';

export const WEBDAV_SYNC_TRIGGER_MANUAL: string = 'manual';
export const WEBDAV_SYNC_TRIGGER_LOCAL_CHANGE: string = 'localChange';

export class WebDavSyncTriggerPolicy {
  static resolveLocalPushMessage(trigger: string): string {
    return trigger === WEBDAV_SYNC_TRIGGER_LOCAL_CHANGE
      ? AppI18n.globalString($r('app.string.webdav_local_change_synced'), 'Local changes synced to WebDAV.')
      : AppI18n.globalString($r('app.string.webdav_local_modified_synced'), 'Local updates synced to WebDAV.');
  }
}
