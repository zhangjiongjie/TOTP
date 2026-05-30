import { describe, it, expect } from '@ohos/hypium';
import {
  HOME_STATUS_TONE_ERROR,
  HOME_STATUS_TONE_SECONDARY,
  HOME_STATUS_TONE_SUCCESS,
  HomeRegularSyncStatusInput,
  HomeStatusPresentation,
  HomeStatusPresentationInput,
  HomeStatusPresentationPolicy
} from '../../../main/ets/policies/HomeStatusPresentationPolicy';

export default function homeStatusPresentationPolicyTest(): void {
  describe('HomeStatusPresentationPolicy', () => {
    it('prefers error message over copy and regular sync messages', 0, () => {
      let presentation: HomeStatusPresentation = HomeStatusPresentationPolicy.resolve(new HomeStatusPresentationInput(
        false,
        false,
        '同步失败',
        '',
        '已复制验证码',
        '本地与 WebDAV 已经是最新版本。'
      ));

      expect(presentation.shouldShow).assertTrue();
      expect(presentation.message).assertEqual('同步失败');
      expect(presentation.tone).assertEqual(HOME_STATUS_TONE_ERROR);
    });

    it('uses copy message before regular sync status', 0, () => {
      let presentation: HomeStatusPresentation = HomeStatusPresentationPolicy.resolve(new HomeStatusPresentationInput(
        false,
        false,
        '',
        '',
        '已复制 GitHub 的验证码到系统剪贴板。',
        '本地与 WebDAV 已经是最新版本。'
      ));

      expect(presentation.shouldShow).assertTrue();
      expect(presentation.message).assertEqual('已复制 GitHub 的验证码到系统剪贴板。');
      expect(presentation.tone).assertEqual(HOME_STATUS_TONE_SUCCESS);
    });

    it('marks remote password regular status as error tone', 0, () => {
      let presentation: HomeStatusPresentation = HomeStatusPresentationPolicy.resolve(new HomeStatusPresentationInput(
        false,
        false,
        '',
        '',
        '',
        '远端保管库需要主密码验证后才能继续同步。'
      ));

      expect(presentation.shouldShow).assertTrue();
      expect(presentation.message).assertEqual('远端保管库需要主密码验证后才能继续同步。');
      expect(presentation.tone).assertEqual(HOME_STATUS_TONE_ERROR);
    });

    it('keeps normal regular sync status secondary', 0, () => {
      let presentation: HomeStatusPresentation = HomeStatusPresentationPolicy.resolve(new HomeStatusPresentationInput(
        false,
        false,
        '',
        '',
        '',
        '本地与 WebDAV 已经是最新版本。'
      ));

      expect(presentation.shouldShow).assertTrue();
      expect(presentation.tone).assertEqual(HOME_STATUS_TONE_SECONDARY);
    });

    it('shows status card while syncing even when message is empty', 0, () => {
      let presentation: HomeStatusPresentation = HomeStatusPresentationPolicy.resolve(new HomeStatusPresentationInput(
        false,
        true,
        '',
        '',
        '',
        ''
      ));

      expect(presentation.shouldShow).assertTrue();
      expect(presentation.message).assertEqual('');
    });

    it('resolves regular sync status from settings and metadata summary', 0, () => {
      expect(HomeStatusPresentationPolicy.resolveRegularSyncStatus(new HomeRegularSyncStatusInput(
        true,
        false,
        false,
        false,
        ''
      ))).assertEqual('同步中...');

      expect(HomeStatusPresentationPolicy.resolveRegularSyncStatus(new HomeRegularSyncStatusInput(
        false,
        false,
        false,
        false,
        ''
      ))).assertEqual('WebDAV 同步未开启，本地模式。');

      expect(HomeStatusPresentationPolicy.resolveRegularSyncStatus(new HomeRegularSyncStatusInput(
        false,
        true,
        true,
        false,
        ''
      ))).assertEqual('远端保管库需要主密码验证后才能继续同步。');

      expect(HomeStatusPresentationPolicy.resolveRegularSyncStatus(new HomeRegularSyncStatusInput(
        false,
        true,
        false,
        false,
        ''
      ))).assertEqual('本地与 WebDAV 已经是最新版本。');
    });
  });
}
