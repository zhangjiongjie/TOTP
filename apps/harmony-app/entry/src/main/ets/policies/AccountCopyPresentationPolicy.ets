import { TotpAccount } from '../model/TotpAccount';
import { TotpCodeSnapshot } from '../services/TotpRuntimeService';

export const ACCOUNT_COPY_KIND_ERROR: string = 'error';
export const ACCOUNT_COPY_KIND_SUCCESS: string = 'success';

export class AccountCopyPresentation {
  kind: string;
  message: string;

  constructor(kind: string, message: string) {
    this.kind = kind;
    this.message = message;
  }
}

export class AccountCopyPresentationPolicy {
  static resolve(snapshot: TotpCodeSnapshot, account: TotpAccount | undefined): AccountCopyPresentation {
    if (snapshot.rawCode.length === 0) {
      return new AccountCopyPresentation(
        ACCOUNT_COPY_KIND_ERROR,
        '当前账号验证码不可复制，请先修正密钥或算法配置。'
      );
    }

    let label: string = account !== undefined && account.issuer.length > 0 ? account.issuer : '当前账号';
    return new AccountCopyPresentation(
      ACCOUNT_COPY_KIND_SUCCESS,
      `已复制 ${label} 的验证码到系统剪贴板。`
    );
  }
}
