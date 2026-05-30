import { describe, it, expect } from '@ohos/hypium';
import {
  WEBDAV_SYNC_COORDINATOR_CONFLICT,
  WEBDAV_SYNC_COORDINATOR_LOCAL_CHANGE,
  WEBDAV_SYNC_COORDINATOR_MANUAL,
  WEBDAV_SYNC_COORDINATOR_REMOTE_PASSWORD,
  WebDavSyncActionOutcome,
  WebDavSyncCoordinator,
  WebDavSyncOperationRunner
} from '../../../main/ets/services/WebDavSyncCoordinator';
import { WebDavSyncResult } from '../../../main/ets/services/WebDavSyncService';

class FakeWebDavSyncOperationRunner implements WebDavSyncOperationRunner {
  lastCall: string = '';
  keepLocal: boolean = false;

  async syncNow(_context: Object): Promise<WebDavSyncResult> {
    this.lastCall = 'syncNow';
    return new WebDavSyncResult('pulled', '已从 WebDAV 恢复远端版本。');
  }

  async syncLocalChange(_context: Object): Promise<WebDavSyncResult> {
    this.lastCall = 'syncLocalChange';
    return new WebDavSyncResult('pushed', '本地变更已同步到 WebDAV。');
  }

  async verifyRemoteMasterPassword(_context: Object, remotePassword: string): Promise<WebDavSyncResult> {
    this.lastCall = `verify:${remotePassword}`;
    return new WebDavSyncResult('pulled', '远端密码库已验证，本地密码已同步更新。');
  }

  async keepLocalVersion(_context: Object): Promise<WebDavSyncResult> {
    this.lastCall = 'keepLocalVersion';
    this.keepLocal = true;
    return new WebDavSyncResult('pushed', '本地修改已同步到 WebDAV。');
  }

  async useRemoteVersion(_context: Object): Promise<WebDavSyncResult> {
    this.lastCall = 'useRemoteVersion';
    this.keepLocal = false;
    return new WebDavSyncResult('pulled', '已从 WebDAV 恢复远端版本。');
  }
}

class ThrowingWebDavSyncOperationRunner extends FakeWebDavSyncOperationRunner {
  async syncLocalChange(_context: Object): Promise<WebDavSyncResult> {
    throw new Error('网络失败');
  }
}

export default function webDavSyncCoordinatorTest(): void {
  describe('WebDavSyncCoordinator', () => {
    it('runs manual sync and returns standard presentation', 0, async () => {
      let runner: FakeWebDavSyncOperationRunner = new FakeWebDavSyncOperationRunner();
      let outcome: WebDavSyncActionOutcome = await new WebDavSyncCoordinator(runner).manualSync(new Object(), true, 'home');

      expect(runner.lastCall).assertEqual('syncNow');
      expect(outcome.action).assertEqual(WEBDAV_SYNC_COORDINATOR_MANUAL);
      expect(outcome.result !== undefined).assertTrue();
      expect(outcome.presentation !== undefined).assertTrue();
      expect(outcome.presentation?.homeMessageKind).assertEqual('success');
    });

    it('normalizes local change errors with existing user-facing prefix', 0, async () => {
      let outcome: WebDavSyncActionOutcome = await new WebDavSyncCoordinator(new ThrowingWebDavSyncOperationRunner()).syncLocalChange(new Object(), true, 'home');

      expect(outcome.action).assertEqual(WEBDAV_SYNC_COORDINATOR_LOCAL_CHANGE);
      expect(outcome.errorMessage).assertEqual('同步本地变更失败：网络失败');
      expect(outcome.result === undefined).assertTrue();
    });

    it('validates remote password before calling runner', 0, async () => {
      let runner: FakeWebDavSyncOperationRunner = new FakeWebDavSyncOperationRunner();
      let outcome: WebDavSyncActionOutcome = await new WebDavSyncCoordinator(runner).verifyRemotePassword(new Object(), '   ');

      expect(outcome.action).assertEqual(WEBDAV_SYNC_COORDINATOR_REMOTE_PASSWORD);
      expect(outcome.remotePasswordErrorMessage).assertEqual('请输入远端主密码。');
      expect(runner.lastCall).assertEqual('');
    });

    it('runs remote password verification and marks verification complete', 0, async () => {
      let runner: FakeWebDavSyncOperationRunner = new FakeWebDavSyncOperationRunner();
      let outcome: WebDavSyncActionOutcome = await new WebDavSyncCoordinator(runner).verifyRemotePassword(new Object(), 'secret');

      expect(runner.lastCall).assertEqual('verify:secret');
      expect(outcome.remotePasswordVerified).assertTrue();
      expect(outcome.presentation?.homeMessageKind).assertEqual('success');
    });

    it('routes conflict resolution to selected side', 0, async () => {
      let runner: FakeWebDavSyncOperationRunner = new FakeWebDavSyncOperationRunner();
      let coordinator: WebDavSyncCoordinator = new WebDavSyncCoordinator(runner);

      let keepLocalOutcome: WebDavSyncActionOutcome = await coordinator.resolveConflict(new Object(), true);
      expect(keepLocalOutcome.action).assertEqual(WEBDAV_SYNC_COORDINATOR_CONFLICT);
      expect(runner.lastCall).assertEqual('keepLocalVersion');

      await coordinator.resolveConflict(new Object(), false);
      expect(runner.lastCall).assertEqual('useRemoteVersion');
    });
  });
}
