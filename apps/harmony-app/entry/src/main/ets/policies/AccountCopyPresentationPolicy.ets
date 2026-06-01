import { TotpAccount } from '../model/TotpAccount';
import { TotpCodeSnapshot } from '../services/TotpRuntimeService';
import { AppI18n } from '../utils/AppI18n';

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
        AppI18n.globalString($r('app.string.account_copy_unavailable'), 'The code for this account cannot be copied. Check the secret or algorithm settings.')
      );
    }

    let label: string = account !== undefined && account.issuer.length > 0
      ? account.issuer
      : AppI18n.globalString($r('app.string.account_copy_current_account'), 'Current account');
    return new AccountCopyPresentation(
      ACCOUNT_COPY_KIND_SUCCESS,
      AppI18n.globalFormat($r('app.string.account_copy_success'), 'Copied the verification code for %1$s to the clipboard.', label)
    );
  }
}
