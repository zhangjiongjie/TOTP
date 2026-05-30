import { describe, it, expect } from '@ohos/hypium';
import {
  ACCOUNT_COPY_KIND_ERROR,
  ACCOUNT_COPY_KIND_SUCCESS,
  AccountCopyPresentation,
  AccountCopyPresentationPolicy
} from '../../../main/ets/policies/AccountCopyPresentationPolicy';
import { TotpAccount } from '../../../main/ets/model/TotpAccount';
import { TotpCodeSnapshot } from '../../../main/ets/services/TotpRuntimeService';

function createAccount(issuer: string): TotpAccount {
  return new TotpAccount('account-1', issuer, 'user@example.com', 'SECRET', 6, 30, 'SHA1', 'Default', '', '');
}

function createSnapshot(rawCode: string): TotpCodeSnapshot {
  return new TotpCodeSnapshot('account-1', rawCode, '123 456', '点击验证码即可复制', '30s / 30s', '剩余 30s');
}

export default function accountCopyPresentationPolicyTest(): void {
  describe('AccountCopyPresentationPolicy', () => {
    it('returns an error when the current code is unavailable', 0, () => {
      let presentation: AccountCopyPresentation = AccountCopyPresentationPolicy.resolve(createSnapshot(''), createAccount('GitHub'));

      expect(presentation.kind).assertEqual(ACCOUNT_COPY_KIND_ERROR);
      expect(presentation.message).assertEqual('当前账号验证码不可复制，请先修正密钥或算法配置。');
    });

    it('uses issuer in the success message when available', 0, () => {
      let presentation: AccountCopyPresentation = AccountCopyPresentationPolicy.resolve(createSnapshot('123456'), createAccount('GitHub'));

      expect(presentation.kind).assertEqual(ACCOUNT_COPY_KIND_SUCCESS);
      expect(presentation.message).assertEqual('已复制 GitHub 的验证码到系统剪贴板。');
    });

    it('falls back to current account when issuer is empty', 0, () => {
      let presentation: AccountCopyPresentation = AccountCopyPresentationPolicy.resolve(createSnapshot('123456'), createAccount(''));

      expect(presentation.kind).assertEqual(ACCOUNT_COPY_KIND_SUCCESS);
      expect(presentation.message).assertEqual('已复制 当前账号 的验证码到系统剪贴板。');
    });
  });
}
