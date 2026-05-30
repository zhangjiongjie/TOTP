import { describe, it, expect } from '@ohos/hypium';
import { SyncResultPresentation, SyncResultPresentationPolicy } from '../../../main/ets/policies/SyncResultPresentationPolicy';
import { WebDavSyncResult } from '../../../main/ets/services/WebDavSyncService';

export default function syncResultPresentationPolicyTest(): void {
  describe('SyncResultPresentationPolicy', () => {
    it('shows remote password dialog for blocked standard sync while unlocked', 0, () => {
      let presentation: SyncResultPresentation = SyncResultPresentationPolicy.forStandardSync(
        new WebDavSyncResult('blocked', '远端保管库需要主密码验证后才能继续同步。'),
        true,
        'home'
      );

      expect(presentation.hasSyncConflict).assertFalse();
      expect(presentation.syncStatusMessage).assertEqual('远端保管库需要主密码验证后才能继续同步。');
      expect(presentation.homeMessageKind).assertEqual('error');
      expect(presentation.remotePasswordDialogAction).assertEqual('show');
    });

    it('keeps blocked standard sync dialog hidden while locked', 0, () => {
      let presentation: SyncResultPresentation = SyncResultPresentationPolicy.forStandardSync(
        new WebDavSyncResult('blocked', '远端保管库需要主密码验证后才能继续同步。'),
        false,
        'unlock'
      );

      expect(presentation.homeMessageKind).assertEqual('error');
      expect(presentation.remotePasswordDialogAction).assertEqual('hide');
    });

    it('marks conflicts as error without opening remote password dialog', 0, () => {
      let presentation: SyncResultPresentation = SyncResultPresentationPolicy.forStandardSync(
        new WebDavSyncResult('conflict', '本地和远端都发生了变化，请在首页选择保留本地或使用远端。'),
        true,
        'home'
      );

      expect(presentation.hasSyncConflict).assertTrue();
      expect(presentation.homeMessageKind).assertEqual('error');
      expect(presentation.remotePasswordDialogAction).assertEqual('keep');
    });

    it('shows non-error standard sync results as success', 0, () => {
      let presentation: SyncResultPresentation = SyncResultPresentationPolicy.forStandardSync(
        new WebDavSyncResult('pulled', '已从 WebDAV 恢复远端版本。'),
        true,
        'home'
      );

      expect(presentation.hasSyncConflict).assertFalse();
      expect(presentation.homeMessageKind).assertEqual('success');
      expect(presentation.homeMessage).assertEqual('已从 WebDAV 恢复远端版本。');
      expect(presentation.remotePasswordDialogAction).assertEqual('keep');
    });

    it('treats remote password verification conflict as error and other results as success', 0, () => {
      let conflict: SyncResultPresentation = SyncResultPresentationPolicy.forRemotePasswordVerification(
        new WebDavSyncResult('conflict', '本地和远端都有数据，请先处理同步冲突。')
      );
      let synced: SyncResultPresentation = SyncResultPresentationPolicy.forRemotePasswordVerification(
        new WebDavSyncResult('pulled', '远端密码库已验证，本地密码已同步更新。')
      );

      expect(conflict.hasSyncConflict).assertTrue();
      expect(conflict.homeMessageKind).assertEqual('error');
      expect(conflict.remotePasswordDialogAction).assertEqual('keep');
      expect(synced.hasSyncConflict).assertFalse();
      expect(synced.homeMessageKind).assertEqual('success');
      expect(synced.remotePasswordDialogAction).assertEqual('keep');
    });

    it('treats conflict resolution blocked and conflict results as errors', 0, () => {
      let blocked: SyncResultPresentation = SyncResultPresentationPolicy.forConflictResolution(
        new WebDavSyncResult('blocked', '远端保管库需要主密码验证后才能继续同步。')
      );
      let pushed: SyncResultPresentation = SyncResultPresentationPolicy.forConflictResolution(
        new WebDavSyncResult('pushed', '本地修改已同步到 WebDAV。')
      );

      expect(blocked.homeMessageKind).assertEqual('error');
      expect(blocked.hasSyncConflict).assertFalse();
      expect(blocked.remotePasswordDialogAction).assertEqual('keep');
      expect(pushed.homeMessageKind).assertEqual('success');
      expect(pushed.hasSyncConflict).assertFalse();
      expect(pushed.remotePasswordDialogAction).assertEqual('keep');
    });
  });
}
