import { common } from '@kit.AbilityKit';
import { BusinessError } from '@kit.BasicServicesKit';
import { photoAccessHelper } from '@kit.MediaLibraryKit';
import { detectBarcode, scanBarcode, scanCore } from '@kit.ScanKit';
import { AccountForm } from '../components/forms/AccountForm';
import { LocalVault } from '../model/LocalVault';
import { AccountDraft, AccountEditorService } from '../services/AccountEditorService';

@Component
export struct AddAccount {
  onSaved: (vault: LocalVault) => void = (_vault: LocalVault) => {};
  onBack: () => void = () => {};
  showBackButton: boolean = true;
  bottomInset: number = 18;
  topInset: number = 0;
  @Prop @Watch('onPhotoRequestTokenChanged') photoRequestToken: number = 0;
  @Prop @Watch('onScanRequestTokenChanged') scanRequestToken: number = 0;

  @State private issuer: string = '';
  @State private accountName: string = '';
  @State private secret: string = '';
  @State private otpauthUri: string = '';
  @State private digits: string = '6';
  @State private period: string = '30';
  @State private algorithm: string = 'SHA1';
  @State private groupName: string = 'Default';
  @State private statusMessage: string = '';
  @State private errorMessage: string = '';
  private editorService: AccountEditorService = new AccountEditorService();

  build() {
    Stack({ alignContent: Alignment.Bottom }) {
      Scroll() {
        Column({ space: 14 }) {
          Blank()
            .height(this.topInset)
          if (this.statusMessage.length > 0) {
            Text(this.statusMessage)
              .fontSize(13)
              .lineHeight(20)
              .fontColor($r('sys.color.font_secondary'))
              .width('100%')
          }

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
            .height(this.bottomInset + 84)
        }
        .width('100%')
        .padding({ left: 16, right: 16, top: 6, bottom: 20 })
      }
      .scrollBar(BarState.Auto)
      .width('100%')
      .height('100%')

      Column({ space: 10 }) {
        if (this.errorMessage.length > 0) {
          Text(this.errorMessage)
            .fontSize(13)
            .lineHeight(20)
            .fontColor('#C53D3D')
            .width('100%')
        }

        Button('保存')
          .width('100%')
          .height(50)
          .type(ButtonType.Capsule)
          .fontSize(16)
          .fontWeight(FontWeight.Medium)
          .fontColor(Color.White)
          .backgroundColor('#1E5AA8')
          .onClick(() => {
            this.saveAccount();
          })
      }
      .width('100%')
      .padding({ left: 16, right: 16, top: 14, bottom: this.bottomInset })
      .backgroundColor($r('sys.color.ohos_id_color_background'))
    }
    .width('100%')
    .height('100%')
    .backgroundColor($r('sys.color.ohos_id_color_background'))
  }

  private onPhotoRequestTokenChanged(): void {
    if (this.photoRequestToken > 0) {
      this.pickQrImage();
    }
  }

  private onScanRequestTokenChanged(): void {
    if (this.scanRequestToken > 0) {
      this.startQrScan();
    }
  }

  private saveAccount(): void {
    this.errorMessage = '';

    try {
      let draft: AccountDraft = this.buildDraft();
      let context: common.UIAbilityContext = this.getUIContext().getHostContext() as common.UIAbilityContext;
      let vault: LocalVault = this.editorService.create(context, draft);
      this.resetForm();
      this.onSaved(vault);
    } catch (error) {
      let message: string = this.readErrorMessage(error);
      this.errorMessage = message.length > 0 ? message : '保存失败，请稍后重试。';
    }
  }

  private buildDraft(): AccountDraft {
    let issuer: string = this.issuer.trim();
    let accountName: string = this.accountName.trim();
    let secret: string = this.secret.trim().replace(/\s+/g, '');

    if (issuer.length === 0) {
      throw new Error('请输入发行方名称');
    }
    if (accountName.length === 0) {
      throw new Error('请输入账号名称');
    }
    if (secret.length === 0) {
      throw new Error('请输入 TOTP 密钥');
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
      this.errorMessage = '请先粘贴 otpauth 链接';
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
      this.statusMessage = '已解析';
    } catch (error) {
      let message: string = this.readErrorMessage(error);
      this.errorMessage = message.length > 0 ? message : 'otpauth 链接解析失败';
    }
  }

  private async startQrScan(): Promise<void> {
    this.errorMessage = '';
    this.statusMessage = '扫码中...';
    try {
      let context: common.UIAbilityContext = this.getUIContext().getHostContext() as common.UIAbilityContext;
      let options: scanBarcode.ScanOptions = {
        scanTypes: [scanCore.ScanType.QR_CODE],
        enableMultiMode: false,
        enableAlbum: false
      };
      let result: scanBarcode.ScanResult = await scanBarcode.startScanForResult(context, options);
      this.applyScanValue(result.originalValue, '扫码成功');
    } catch (error) {
      this.handleScanError(error, '扫码失败，请重试。');
    }
  }

  private async pickQrImage(): Promise<void> {
    this.errorMessage = '';
    this.statusMessage = '打开相册...';
    try {
      let photoOption: photoAccessHelper.PhotoSelectOptions = new photoAccessHelper.PhotoSelectOptions();
      photoOption.MIMEType = photoAccessHelper.PhotoViewMIMETypes.IMAGE_TYPE;
      photoOption.maxSelectNumber = 1;
      photoOption.isPhotoTakingSupported = false;
      photoOption.isEditSupported = false;

      let photoPicker: photoAccessHelper.PhotoViewPicker = new photoAccessHelper.PhotoViewPicker();
      let selected: photoAccessHelper.PhotoSelectResult = await photoPicker.select(photoOption);
      if (selected.photoUris.length === 0) {
        this.statusMessage = '';
        return;
      }

      let inputImage: detectBarcode.InputImage = { uri: selected.photoUris[0] };
      let options: scanBarcode.ScanOptions = {
        scanTypes: [scanCore.ScanType.QR_CODE],
        enableMultiMode: false,
        enableAlbum: false
      };
      let results: Array<scanBarcode.ScanResult> = await detectBarcode.decode(inputImage, options);
      if (results.length === 0) {
        this.errorMessage = '图片中未识别到二维码。';
        this.statusMessage = '';
        return;
      }
      this.applyScanValue(results[0].originalValue, '已解析图片');
    } catch (error) {
      this.handleScanError(error, '图片解析失败，请换一张更清晰的二维码。');
    }
  }

  private applyScanValue(value: string, successMessage: string): void {
    let normalized: string = value.trim();
    if (!normalized.startsWith('otpauth://totp/')) {
      this.errorMessage = '识别成功，但内容不是 otpauth://totp/ 链接。';
      this.statusMessage = '';
      return;
    }
    this.otpauthUri = normalized;
    this.applyOtpauthUri();
    if (this.errorMessage.length === 0) {
      this.statusMessage = successMessage;
    }
  }

  private handleScanError(error: Object, fallback: string): void {
    let businessError: BusinessError = error as BusinessError;
    if (businessError && businessError.code === 1000500002) {
      this.statusMessage = '';
      return;
    }
    this.statusMessage = '';
    this.errorMessage = businessError && businessError.message && businessError.message.length > 0
      ? `${fallback}${businessError.message}`
      : fallback;
  }

  private resetForm(): void {
    this.issuer = '';
    this.accountName = '';
    this.secret = '';
    this.otpauthUri = '';
    this.digits = '6';
    this.period = '30';
    this.algorithm = 'SHA1';
    this.groupName = 'Default';
    this.errorMessage = '';
    this.statusMessage = '';
  }

  private parseOtpauthUri(uri: string): ParsedOtpauth {
    let normalizedUri: string = uri.trim();
    let prefix: string = 'otpauth://totp/';
    if (!normalizedUri.startsWith(prefix)) {
      throw new Error('仅支持 otpauth://totp/ 链接');
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
      throw new Error('otpauth 链接缺少 issuer');
    }
    if (accountName.length === 0) {
      throw new Error('otpauth 链接缺少账号名称');
    }
    if (secret.length === 0) {
      throw new Error('otpauth 链接缺少 secret');
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
