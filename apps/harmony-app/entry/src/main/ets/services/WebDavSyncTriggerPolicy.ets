export const WEBDAV_SYNC_TRIGGER_MANUAL: string = 'manual';
export const WEBDAV_SYNC_TRIGGER_LOCAL_CHANGE: string = 'localChange';

export class WebDavSyncTriggerPolicy {
  static resolveLocalPushMessage(trigger: string): string {
    return trigger === WEBDAV_SYNC_TRIGGER_LOCAL_CHANGE
      ? '本地变更已同步到 WebDAV。'
      : '本地修改已同步到 WebDAV。';
  }
}