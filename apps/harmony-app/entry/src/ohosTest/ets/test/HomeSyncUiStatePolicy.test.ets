import { describe, it, expect } from '@ohos/hypium';
import {
  HOME_SYNC_OPERATION_CONFLICT_KEEP_LOCAL,
  HOME_SYNC_OPERATION_CONFLICT_USE_REMOTE,
  HOME_SYNC_OPERATION_LOCAL_CHANGE,
  HOME_SYNC_OPERATION_MANUAL,
  HomeSyncUiStatePolicy,
  HomeSyncAvailabilityResult,
  HomeSyncOperationStartResult
} from '../../../main/ets/policies/HomeSyncUiStatePolicy';

export default function homeSyncUiStatePolicyTest(): void {
  describe('HomeSyncUiStatePolicy', () => {
    it('blocks manual sync while another sync is running', 0, () => {
      let result: HomeSyncOperationStartResult = HomeSyncUiStatePolicy.resolveOperationStart(HOME_SYNC_OPERATION_MANUAL, true, true);

      expect(result.canStart).assertFalse();
      expect(result.errorMessage).assertEqual('同步正在进行中，请稍后再试。');
    });

    it('reports local mode when manual sync is unavailable', 0, () => {
      let result: HomeSyncOperationStartResult = HomeSyncUiStatePolicy.resolveOperationStart(HOME_SYNC_OPERATION_MANUAL, false, false);

      expect(result.canStart).assertFalse();
      expect(result.successMessage).assertEqual('WebDAV 同步未开启，本地模式。');
    });

    it('silently skips local-change sync when WebDAV is unavailable', 0, () => {
      let result: HomeSyncOperationStartResult = HomeSyncUiStatePolicy.resolveOperationStart(HOME_SYNC_OPERATION_LOCAL_CHANGE, false, false);

      expect(result.canStart).assertFalse();
      expect(result.syncStatusMessage).assertEqual('WebDAV 同步未开启，本地模式。');
      expect(result.successMessage).assertEqual('');
      expect(result.errorMessage).assertEqual('');
    });

    it('resolves operation start messages for sync and conflict actions', 0, () => {
      expect(HomeSyncUiStatePolicy.resolveOperationStart(HOME_SYNC_OPERATION_MANUAL, false, true).syncStatusMessage).assertEqual('同步中...');
      expect(HomeSyncUiStatePolicy.resolveOperationStart(HOME_SYNC_OPERATION_LOCAL_CHANGE, false, true).syncStatusMessage).assertEqual('同步本地变更中...');
      expect(HomeSyncUiStatePolicy.resolveOperationStart(HOME_SYNC_OPERATION_CONFLICT_KEEP_LOCAL, false, true).syncStatusMessage).assertEqual('正在用本地版本覆盖远端...');
      expect(HomeSyncUiStatePolicy.resolveOperationStart(HOME_SYNC_OPERATION_CONFLICT_USE_REMOTE, false, true).syncStatusMessage).assertEqual('正在使用远端版本覆盖本地...');
    });

    it('resolves availability status messages', 0, () => {
      let unavailable: HomeSyncAvailabilityResult = HomeSyncUiStatePolicy.resolveAvailability(false, false, false, false);
      let unavailableDuringConflict: HomeSyncAvailabilityResult = HomeSyncUiStatePolicy.resolveAvailability(false, false, true, false);
      let settingsError: HomeSyncAvailabilityResult = HomeSyncUiStatePolicy.resolveAvailability(false, false, false, true);

      expect(unavailable.canSync).assertFalse();
      expect(unavailable.syncStatusMessage).assertEqual('WebDAV 同步未开启，本地模式。');
      expect(unavailableDuringConflict.syncStatusMessage).assertEqual('');
      expect(settingsError.syncStatusMessage).assertEqual('同步设置暂不可用。');
    });
  });
}
