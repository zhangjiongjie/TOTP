import { describe, it, expect } from '@ohos/hypium';
import { InlineMessageState, TransientInlineMessagePolicy } from '../../../main/ets/policies/TransientInlineMessagePolicy';

export default function transientInlineMessagePolicyTest(): void {
  describe('TransientInlineMessagePolicy', () => {
    it('showStatus clears previous error and increments version', 0, () => {
      let state: InlineMessageState = new InlineMessageState('', '导入失败', 1);

      let next: InlineMessageState = TransientInlineMessagePolicy.showStatus(state, '已导出 2 个账号');

      expect(next.statusMessage).assertEqual('已导出 2 个账号');
      expect(next.errorMessage).assertEqual('');
      expect(next.version).assertEqual(2);
    });

    it('showError clears previous status and increments version', 0, () => {
      let state: InlineMessageState = new InlineMessageState('已导出 2 个账号', '', 1);

      let next: InlineMessageState = TransientInlineMessagePolicy.showError(state, '导入失败');

      expect(next.statusMessage).assertEqual('');
      expect(next.errorMessage).assertEqual('导入失败');
      expect(next.version).assertEqual(2);
    });

    it('clearIfVersion keeps newer messages', 0, () => {
      let state: InlineMessageState = new InlineMessageState('已导入 2 个账号', '', 2);

      let staleClear: InlineMessageState = TransientInlineMessagePolicy.clearIfVersion(state, 1);
      expect(staleClear.statusMessage).assertEqual('已导入 2 个账号');
      expect(staleClear.version).assertEqual(2);

      let currentClear: InlineMessageState = TransientInlineMessagePolicy.clearIfVersion(state, 2);
      expect(currentClear.statusMessage).assertEqual('');
      expect(currentClear.errorMessage).assertEqual('');
      expect(currentClear.version).assertEqual(2);
    });
  });
}
