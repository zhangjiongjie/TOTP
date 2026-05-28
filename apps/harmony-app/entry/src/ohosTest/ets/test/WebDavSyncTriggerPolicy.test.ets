import { describe, it, expect } from '@ohos/hypium';
import {
  WEBDAV_SYNC_TRIGGER_LOCAL_CHANGE,
  WEBDAV_SYNC_TRIGGER_MANUAL,
  WebDavSyncTriggerPolicy
} from '../../../main/ets/services/WebDavSyncTriggerPolicy';

export default function webDavSyncTriggerPolicyTest(): void {
  describe('WebDavSyncTriggerPolicy', () => {
    it('uses local-change success text for local mutation sync', 0, () => {
      expect(WebDavSyncTriggerPolicy.resolveLocalPushMessage(WEBDAV_SYNC_TRIGGER_LOCAL_CHANGE))
        .assertEqual('本地变更已同步到 WebDAV。');
    });

    it('uses normal local push text for manual sync', 0, () => {
      expect(WebDavSyncTriggerPolicy.resolveLocalPushMessage(WEBDAV_SYNC_TRIGGER_MANUAL))
        .assertEqual('本地修改已同步到 WebDAV。');
    });
  });
}