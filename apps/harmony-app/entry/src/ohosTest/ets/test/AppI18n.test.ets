import { describe, it, expect } from '@ohos/hypium';
import { AppI18n } from '../../../main/ets/utils/AppI18n';

export default function appI18nTest(): void {
  describe('AppI18n', () => {
    it('formats fallback text when no global context is registered', 0, () => {
      let message: string = AppI18n.globalFormat($r('app.string.error_unknown'), 'Unknown error: %1$s (%2$d)', 'offline', 3);

      expect(message).assertEqual('Unknown error: offline (3)');
    });
  });
}
