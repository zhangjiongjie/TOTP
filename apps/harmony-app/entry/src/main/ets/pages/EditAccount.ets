import { common } from '@kit.AbilityKit';
import { AccountForm } from '../components/forms/AccountForm';
import { DeleteConfirmDialog } from '../components/dialogs/DeleteConfirmDialog';
import { LocalVault } from '../model/LocalVault';
import { TotpAccount } from '../model/TotpAccount';
import { AccountDraft, AccountEditorService } from '../services/AccountEditorService';
import { AppI18n } from '../utils/AppI18n';

@Component
export struct EditAccount {
  account: TotpAccount = new TotpAccount('', '', '', '', 6, 30, 'SHA1', 'Default', '', '');
  onSaved: (vault: LocalVault) => void = (_vault: LocalVault) => {};
  onDeleted: (vault: LocalVault) => void = (_vault: LocalVault) => {};
  onBack: () => void = () => {};
  topInset: number = 0;
  bottomInset: number = 116;

  @State private issuer: string = '';
  @State private accountName: string = '';
  @State private secret: string = '';
  @State private otpauthUri: string = '';
  @State private digits: string = '6';
  @State private period: string = '30';
  @State private algorithm: string = 'SHA1';
  @State private groupName: string = 'Default';
  @State private errorMessage: string = '';
  @State private showDeleteDialog: boolean = false;
  @State private initialized: boolean = false;
  private editorService: AccountEditorService = new AccountEditorService();

  aboutToAppear(): void {
    if (!this.initialized) {
      this.loadAccount();
      this.initialized = true;
    }
  }

  build() {
    Stack({ alignContent: Alignment.Bottom }) {
      Scroll() {
        Column({ space: 14 }) {
          Blank()
            .height(this.topInset)
          AccountForm({
            issuer: $issuer,
            accountName: $accountName,
            secret: $secret,
            otpauthUri: $otpauthUri,
            digits: $digits,
            period: $period,
            algorithm: $algorithm,
            groupName: $groupName,
            onApplyUri: () => {
              this.applyOtpauthUri();
            }
          })

          Blank()
            .height(this.bottomInset + 74)
        }
        .width('100%')
        .padding({ left: 16, right: 16, top: 6, bottom: 20 })
      }
      .width('100%')
      .height('100%')
      .scrollBar(BarState.Auto)

      Column({ space: 10 }) {
        if (this.errorMessage.length > 0) {
          Text(this.errorMessage)
            .fontSize(13)
            .lineHeight(20)
            .fontColor($r('app.color.color_danger'))
            .width('100%')
        }

        Row({ space: 12 }) {
          Button($r('app.string.action_delete'))
            .layoutWeight(1)
            .height(50)
            .type(ButtonType.Capsule)
            .fontSize(16)
            .fontWeight(FontWeight.Medium)
            .fontColor($r('app.color.color_danger_text'))
            .backgroundColor($r('app.color.color_danger_soft'))
            .onClick(() => {
              this.showDeleteDialog = true;
            })

          Button($r('app.string.action_save'))
            .layoutWeight(1)
            .height(50)
            .type(ButtonType.Capsule)
            .fontSize(16)
            .fontWeight(FontWeight.Medium)
            .fontColor($r('sys.color.ohos_id_color_foreground_contrary'))
            .backgroundColor($r('app.color.color_primary'))
            .onClick(() => {
              this.saveAccount();
            })
        }
        .width('100%')
      }
      .width('100%')
      .padding({ left: 16, right: 16, top: 14, bottom: this.bottomInset })
      .backgroundColor($r('sys.color.ohos_id_color_background'))

      if (this.showDeleteDialog) {
        DeleteConfirmDialog({
          title: $r('app.string.delete_confirm_title'),
          content: $r('app.string.delete_account_message'),
          confirmText: $r('app.string.action_delete'),
          cancelText: $r('app.string.action_cancel'),
          onConfirm: () => {
            this.deleteAccount();
          },
          onCancel: () => {
            this.showDeleteDialog = false;
          }
        })
      }
    }
    .width('100%')
    .height('100%')
    .backgroundColor($r('sys.color.ohos_id_color_background'))
  }

  private loadAccount(): void {
    this.issuer = this.account.issuer;
    this.accountName = this.account.accountName;
    this.secret = this.account.secret;
    this.digits = `${this.account.digits}`;
    this.period = `${this.account.period}`;
    this.algorithm = this.account.algorithm.length > 0 ? this.account.algorithm : 'SHA1';
    this.groupName = this.account.groupName.length > 0 ? this.account.groupName : 'Default';
    this.otpauthUri = this.buildOtpauthUri();
  }

  private saveAccount(): void {
    this.errorMessage = '';

    try {
      let draft: AccountDraft = this.buildDraft();
      let context: common.UIAbilityContext = this.getUIContext().getHostContext() as common.UIAbilityContext;
      let vault: LocalVault = this.editorService.update(context, this.account.id, draft);
      this.onSaved(vault);
    } catch (error) {
      let message: string = this.readErrorMessage(error);
      this.errorMessage = message.length > 0 ? message : this.appString($r('app.string.error_save_failed'), 'Save failed. Please try again later.');
    }
  }

  private deleteAccount(): void {
    this.errorMessage = '';
    this.showDeleteDialog = false;

    try {
      let context: common.UIAbilityContext = this.getUIContext().getHostContext() as common.UIAbilityContext;
      let vault: LocalVault = this.editorService.delete(context, this.account.id);
      this.onDeleted(vault);
    } catch (error) {
      let message: string = this.readErrorMessage(error);
      this.errorMessage = message.length > 0 ? message : this.appString($r('app.string.error_delete_failed'), 'Delete failed. Please try again later.');
    }
  }

  private buildDraft(): AccountDraft {
    let issuer: string = this.issuer.trim();
    let accountName: string = this.accountName.trim();
    let secret: string = this.secret.trim().replace(/\s+/g, '');

    if (issuer.length === 0) {
      throw new Error(this.appString($r('app.string.error_validate_issuer'), 'Enter an issuer'));
    }
    if (accountName.length === 0) {
      throw new Error(this.appString($r('app.string.error_validate_account_name'), 'Enter an account name'));
    }
    if (secret.length === 0) {
      throw new Error(this.appString($r('app.string.error_validate_secret'), 'Enter a TOTP secret'));
    }

    return {
      issuer: issuer,
      accountName: accountName,
      secret: secret,
      digits: this.parsePositiveNumber(this.digits, 6),
      period: this.parsePositiveNumber(this.period, 30),
      algorithm: this.algorithm.trim().length > 0 ? this.algorithm.trim().toUpperCase() : 'SHA1',
      groupName: this.groupName.trim().length > 0 ? this.groupName.trim() : 'Default'
    };
  }

  private applyOtpauthUri(): void {
    let uri: string = this.otpauthUri.trim();
    if (uri.length === 0) {
      this.errorMessage = this.appString($r('app.string.error_paste_otpauth_first'), 'Paste an otpauth link first');
      return;
    }

    try {
      let parsed: ParsedOtpauth = this.parseOtpauthUri(uri);
      this.issuer = parsed.issuer;
      this.accountName = parsed.accountName;
      this.secret = parsed.secret;
      this.digits = parsed.digits;
      this.period = parsed.period;
      this.algorithm = parsed.algorithm;
      if (parsed.groupName.length > 0) {
        this.groupName = parsed.groupName;
      }
      this.errorMessage = '';
    } catch (error) {
      let message: string = this.readErrorMessage(error);
      this.errorMessage = message.length > 0 ? message : this.appString($r('app.string.error_otpauth_parse_failed'), 'Failed to parse the otpauth link');
    }
  }

  private parseOtpauthUri(uri: string): ParsedOtpauth {
    let normalizedUri: string = uri.trim();
    let prefix: string = 'otpauth://totp/';
    if (!normalizedUri.startsWith(prefix)) {
      throw new Error(this.appString($r('app.string.error_invalid_otpauth_scheme'), 'Only otpauth://totp/ links are supported'));
    }

    let content: string = normalizedUri.substring(prefix.length);
    let queryIndex: number = content.indexOf('?');
    let labelPart: string = queryIndex >= 0 ? content.substring(0, queryIndex) : content;
    let queryPart: string = queryIndex >= 0 ? content.substring(queryIndex + 1) : '';
    let label: string = decodeURIComponent(labelPart);
    let labelIssuer: string = '';
    let labelAccountName: string = label;
    let separatorIndex: number = label.indexOf(':');

    if (separatorIndex >= 0) {
      labelIssuer = label.substring(0, separatorIndex).trim();
      labelAccountName = label.substring(separatorIndex + 1).trim();
    }

    let params: Record<string, string> = this.readQueryParams(queryPart);
    let issuer: string = this.readParam(params, 'issuer', labelIssuer);
    let accountName: string = this.readParam(params, 'accountName', labelAccountName);
    let secret: string = this.readParam(params, 'secret', '');

    if (issuer.length === 0) {
      throw new Error(this.appString($r('app.string.error_otpauth_missing_issuer'), 'The otpauth link is missing an issuer'));
    }
    if (accountName.length === 0) {
      throw new Error(this.appString($r('app.string.error_otpauth_missing_account'), 'The otpauth link is missing an account name'));
    }
    if (secret.length === 0) {
      throw new Error(this.appString($r('app.string.error_otpauth_missing_secret'), 'The otpauth link is missing a secret'));
    }

    return {
      issuer: issuer,
      accountName: accountName,
      secret: secret.replace(/\s+/g, '').toUpperCase(),
      digits: this.readParam(params, 'digits', '6'),
      period: this.readParam(params, 'period', '30'),
      algorithm: this.readParam(params, 'algorithm', 'SHA1').toUpperCase(),
      groupName: this.groupName.trim()
    };
  }

  private readQueryParams(queryPart: string): Record<string, string> {
    let params: Record<string, string> = {};
    if (queryPart.length === 0) {
      return params;
    }

    let items: string[] = queryPart.split('&');
    for (let index: number = 0; index < items.length; index++) {
      let item: string = items[index];
      if (item.length === 0) {
        continue;
      }

      let delimiterIndex: number = item.indexOf('=');
      let key: string = delimiterIndex >= 0 ? item.substring(0, delimiterIndex) : item;
      let value: string = delimiterIndex >= 0 ? item.substring(delimiterIndex + 1) : '';
      params[decodeURIComponent(key)] = decodeURIComponent(value).trim();
    }
    return params;
  }

  private readParam(params: Record<string, string>, key: string, fallback: string): string {
    let value: string | undefined = params[key];
    if (value === undefined) {
      return fallback;
    }
    return value.length > 0 ? value : fallback;
  }

  private parsePositiveNumber(value: string, fallback: number): number {
    let parsed: number = Number.parseInt(value.trim(), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }

  private readErrorMessage(error: Object): string {
    let businessError: Error = error as Error;
    return businessError && businessError.message ? businessError.message : '';
  }

  private buildOtpauthUri(): string {
    let labelIssuer: string = this.account.issuer.trim();
    let labelAccountName: string = this.account.accountName.trim();
    let label: string = `${labelIssuer}:${labelAccountName}`;

    return `otpauth://totp/${encodeURIComponent(label)}?secret=${encodeURIComponent(this.account.secret)}&issuer=${encodeURIComponent(labelIssuer)}&algorithm=${encodeURIComponent(this.account.algorithm)}&digits=${this.account.digits}&period=${this.account.period}`;
  }

  private appString(resource: Resource, fallback: string): string {
    let context: common.UIAbilityContext = this.getUIContext().getHostContext() as common.UIAbilityContext;
    return AppI18n.string(context, resource, fallback);
  }
}

interface ParsedOtpauth {
  issuer: string;
  accountName: string;
  secret: string;
  digits: string;
  period: string;
  algorithm: string;
  groupName: string;
}
