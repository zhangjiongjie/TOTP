import { TotpAccount } from '../../model/TotpAccount';

class BrandPalette {
  backgroundColor: string;
  foregroundColor: string;
  highlightColor: string;

  constructor(backgroundColor: string, foregroundColor: string, highlightColor: string) {
    this.backgroundColor = backgroundColor;
    this.foregroundColor = foregroundColor;
    this.highlightColor = highlightColor;
  }
}

function createFallbackAccount(): TotpAccount {
  return new TotpAccount('', '', '', '', 6, 30, 'SHA1', 'Default', '', '');
}

function normalizeToken(text: string): string {
  return text.trim().toLowerCase();
}

function resolveRecognizedBrandKey(issuer: string, accountName: string): string {
  let candidate: string = `${issuer} ${accountName}`.toLowerCase();
  if (candidate.indexOf('bitwarden') >= 0) {
    return 'bitwarden';
  }
  if (candidate.indexOf('github') >= 0) {
    return 'github';
  }
  if (candidate.indexOf('gitlab') >= 0 || candidate.indexOf('git01.mobiwire.com') >= 0) {
    return 'gitlab';
  }
  if (candidate.indexOf('google') >= 0 || candidate.indexOf('gmail') >= 0) {
    return 'google';
  }
  if (candidate.indexOf('paypal') >= 0) {
    return 'paypal';
  }
  if (candidate.indexOf('microsoft') >= 0 || candidate.indexOf('outlook') >= 0 || candidate.indexOf('azure') >= 0) {
    return 'microsoft';
  }
  if (candidate.indexOf('openai') >= 0 || candidate.indexOf('chatgpt') >= 0) {
    return 'openai';
  }
  if (candidate.indexOf('slack') >= 0) {
    return 'slack';
  }
  if (candidate.indexOf('apple') >= 0 || candidate.indexOf('icloud') >= 0) {
    return 'apple';
  }
  if (candidate.indexOf('discord') >= 0) {
    return 'discord';
  }
  if (candidate.indexOf('dropbox') >= 0) {
    return 'dropbox';
  }
  if (candidate.indexOf('linkedin') >= 0) {
    return 'linkedin';
  }
  if (candidate.indexOf('notion') >= 0) {
    return 'notion';
  }
  if (candidate.indexOf('onedrive') >= 0) {
    return 'onedrive';
  }
  if (candidate.indexOf('spotify') >= 0) {
    return 'spotify';
  }
  if (candidate.indexOf('telegram') >= 0) {
    return 'telegram';
  }
  if (candidate === 'x' || candidate.indexOf('twitter') >= 0) {
    return 'x';
  }
  return 'default';
}

function resolveDisplayBrandKey(iconKey: string, issuer: string, accountName: string): string {
  let recognizedKey: string = resolveRecognizedBrandKey(issuer, accountName);
  if (recognizedKey !== 'default') {
    return recognizedKey;
  }

  return 'default';
}

function resolveBrandPalette(iconKey: string, issuer: string, accountName: string): BrandPalette {
  let token: string = resolveDisplayBrandKey(iconKey, issuer, accountName);
  switch (token) {
    case 'bitwarden':
      return new BrandPalette('#EAF3FF', '#175DDC', '#F8FBFF');
    case 'default':
      return new BrandPalette('#EAF3FF', '#2878C8', '#F8FBFF');
    case 'google':
    case 'gmail':
      return new BrandPalette('#EAF3FF', '#2F63AE', '#F8FBFF');
    case 'microsoft':
    case 'azure':
    case 'outlook':
      return new BrandPalette('#EAF4FB', '#285C88', '#F8FCFF');
    case 'github':
      return new BrandPalette('#EEF1F5', '#394657', '#FBFCFD');
    case 'gitlab':
      return new BrandPalette('#FFF2E2', '#E24329', '#FFFDFC');
    case 'paypal':
      return new BrandPalette('#EAF5FB', '#003087', '#FBFEFF');
    case 'aws':
    case 'amazon':
      return new BrandPalette('#EEF3F7', '#546478', '#FBFCFD');
    case 'discord':
      return new BrandPalette('#EEF0FB', '#4C5F91', '#FAFBFF');
    case 'telegram':
      return new BrandPalette('#EAF6FB', '#2A7595', '#F7FCFE');
    case 'notion':
      return new BrandPalette('#F1F3F7', '#3A4554', '#FCFCFD');
    case 'slack':
      return new BrandPalette('#EEF2FA', '#5A547A', '#FBFCFF');
    default:
      return new BrandPalette('#EEF3F8', '#5D6C7E', '#FBFCFD');
  }
}

function formatDateLabel(isoText: string): string {
  if (isoText.length === 0) {
    return '未记录';
  }

  let date: Date = new Date(isoText);
  if (isNaN(date.getTime())) {
    return isoText;
  }

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function pad(value: number): string {
  return value < 10 ? `0${value}` : `${value}`;
}

@Component
export struct AccountCard {
  @Prop account: TotpAccount = createFallbackAccount();
  @Prop codeValue: string = '------';
  @Prop codeHint: string = '验证码生成中';
  @Prop countdownLabel: string = '30s 周期';
  @Prop statusLabel: string = '本地保管库';
  onCopy?: (accountId: string) => void;
  onEdit?: (accountId: string) => void;

  build() {
    Row({ space: 12 }) {
      this.buildBrandBadge()

      Column({ space: 7 }) {
        Row({ space: 8 }) {
          Column({ space: 3 }) {
            Text(this.resolveIssuerLabel())
              .fontSize(18)
              .fontWeight(FontWeight.Bold)
              .fontColor($r('sys.color.font_primary'))
              .maxLines(1)
              .textOverflow({ overflow: TextOverflow.Ellipsis })

            Text(this.resolveAccountLabel())
              .fontSize(13)
              .fontColor($r('sys.color.font_secondary'))
              .maxLines(1)
              .textOverflow({ overflow: TextOverflow.Ellipsis })
          }
          .alignItems(HorizontalAlign.Start)
          .layoutWeight(1)

          this.buildEditAction()
        }
        .width('100%')
        .alignItems(VerticalAlign.Top)

        Row({ space: 10 }) {
          Text(this.codeValue)
            .fontSize(28)
            .fontWeight(FontWeight.Bold)
            .fontColor('#2471B7')
            .letterSpacing(3)
            .layoutWeight(1)
            .onClick(() => {
              this.copyCurrentCode();
            })

          this.buildCountdownRing()
          this.buildCopyPill()
        }
        .width('100%')
        .alignItems(VerticalAlign.Center)
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start)
    }
    .width('100%')
    .padding({ left: 14, right: 12, top: 12, bottom: 12 })
    .backgroundColor($r('sys.color.comp_background_tertiary'))
    .borderRadius(22)
    .border({ width: 1, color: $r('sys.color.comp_divider') })
    .shadow({ radius: 10, color: '#0F35527C', offsetX: 0, offsetY: 4 })
  }

  @Builder
  private buildBrandBadge(): void {
    Stack({ alignContent: Alignment.Center }) {
      Row()
        .width(48)
        .height(48)
        .backgroundColor('#EAF1F8')
        .borderRadius(14)
        .border({ width: 1, color: '#CFDCEB' })

      if (this.hasBrandIcon()) {
        this.buildBrandIcon()
      } else {
        Text(this.resolveBrandMonogram())
          .fontSize(18)
          .fontWeight(FontWeight.Bold)
          .fontColor(this.resolvePalette().foregroundColor)
          .backgroundColor(Color.White)
          .borderRadius(12)
          .width(32)
          .height(32)
          .textAlign(TextAlign.Center)
          .padding({ top: 6 })
      }
    }
  }

  @Builder
  private buildEditAction(): void {
    Button() {
      Image($r('app.media.action_edit'))
        .width(16)
        .height(16)
        .fillColor('#315C88')
    }
      .width(36)
      .height(36)
      .type(ButtonType.Circle)
      .backgroundColor('#EEF5FB')
      .border({ width: 1, color: '#CBD9E8' })
      .onClick(() => {
        if (this.onEdit) {
          this.onEdit(this.account.id);
        }
      })
  }

  @Builder
  private buildCopyPill(): void {
    Text('复制')
      .fontSize(12)
      .fontWeight(FontWeight.Medium)
      .fontColor('#24527E')
      .backgroundColor('#EFF5FB')
      .borderRadius(999)
      .padding({ left: 12, right: 12, top: 7, bottom: 7 })
      .onClick(() => {
        this.copyCurrentCode();
      })
  }

  @Builder
  private buildCodeSurface(): void {
    Column({ space: 10 }) {
      Row({ space: 12 }) {
        Text(this.codeValue)
          .fontSize(30)
          .fontWeight(FontWeight.Bold)
          .fontColor('#14233B')
          .letterSpacing(4)
          .layoutWeight(1)

        Text('复制')
          .fontSize(14)
          .fontWeight(FontWeight.Medium)
          .fontColor('#24527E')
          .backgroundColor(Color.White)
          .borderRadius(999)
          .padding({ left: 18, right: 18, top: 9, bottom: 9 })
          .onClick(() => {
            this.copyCurrentCode();
          })
      }
      .width('100%')
      .alignItems(VerticalAlign.Center)

      Text(this.codeHint)
        .fontSize(13)
        .fontColor('#6D7D90')
        .width('100%')
    }
    .width('100%')
    .padding({ left: 18, right: 18, top: 18, bottom: 14 })
    .backgroundColor('#EAF2FA')
    .border({ width: 1, color: '#C9D8E8' })
    .borderRadius(22)
    .onClick(() => {
      this.copyCurrentCode();
    })
  }

  @Builder
  private buildCountdownRing(): void {
    Stack({ alignContent: Alignment.Center }) {
      Progress({ value: this.resolveCountdownProgress(), total: 100, type: ProgressType.Ring })
        .width(38)
        .height(38)
        .color('#2C6295')
        .backgroundColor('#E4E9EF')
        .style({ strokeWidth: 4 })

      Text(this.resolveRemainingLabel())
          .fontSize(10)
          .fontWeight(FontWeight.Bold)
        .fontColor($r('sys.color.font_primary'))
    }
    .width(38)
    .height(38)
  }

  private resolveIssuerLabel(): string {
    return this.account.issuer.length > 0 ? this.account.issuer : '未命名服务';
  }

  private resolveAccountLabel(): string {
    return this.account.accountName.length > 0 ? this.account.accountName : '未填写账号';
  }

  private resolveGroupLabel(): string {
    return this.account.groupName.length > 0 ? this.account.groupName : 'Default';
  }

  private resolveAlgorithmLabel(): string {
    return this.account.algorithm.length > 0 ? this.account.algorithm.toUpperCase() : 'SHA1';
  }

  private resolveRemainingSeconds(): number {
    let index: number = this.countdownLabel.indexOf('s');
    if (index <= 0) {
      return 0;
    }
    let parsed: number = Number.parseInt(this.countdownLabel.substring(0, index), 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private resolveCountdownProgress(): number {
    let period: number = this.account.period > 0 ? this.account.period : 30;
    let remaining: number = this.resolveRemainingSeconds();
    if (remaining <= 0) {
      return 100;
    }
    return Math.max(0, Math.min(100, remaining * 100 / period));
  }

  private resolveRemainingLabel(): string {
    let remaining: number = this.resolveRemainingSeconds();
    return remaining > 0 ? `${remaining}s` : this.statusLabel;
  }

  private resolveBrandMonogram(): string {
    let seed: string = this.account.iconKey.length > 0 ? this.account.iconKey : this.resolveIssuerLabel();
    let trimmed: string = seed.trim();
    if (trimmed.length === 0) {
      return 'T';
    }

    let firstChar: string = trimmed.substring(0, 1).toUpperCase();
    if (trimmed.length === 1) {
      return firstChar;
    }

    return `${firstChar}${trimmed.substring(1, 2).toUpperCase()}`;
  }

  private resolvePalette(): BrandPalette {
    return resolveBrandPalette(this.account.iconKey, this.account.issuer, this.account.accountName);
  }

  private copyCurrentCode(): void {
    if (this.onCopy) {
      this.onCopy(this.account.id);
    }
  }

  private resolveBrandKey(): string {
    return resolveDisplayBrandKey(this.account.iconKey, this.account.issuer, this.account.accountName);
  }

  private hasBrandIcon(): boolean {
    switch (this.resolveBrandKey()) {
      case 'apple':
      case 'bitwarden':
      case 'default':
      case 'discord':
      case 'dropbox':
      case 'github':
      case 'gitlab':
      case 'google':
      case 'gmail':
      case 'linkedin':
      case 'microsoft':
      case 'azure':
      case 'outlook':
      case 'notion':
      case 'onedrive':
      case 'openai':
      case 'chatgpt':
      case 'paypal':
      case 'slack':
      case 'spotify':
      case 'telegram':
      case 'x':
      case 'twitter':
        return true;
      default:
        return true;
    }
  }

  @Builder
  private buildBrandIcon(): void {
    if (this.resolveBrandKey() === 'apple') {
      Image($r('app.media.brand_apple')).width(34).height(34)
    } else if (this.resolveBrandKey() === 'bitwarden') {
      Image($r('app.media.brand_bitwarden')).width(34).height(34)
    } else if (this.resolveBrandKey() === 'default') {
      Image($r('app.media.brand_default')).width(34).height(34)
    } else if (this.resolveBrandKey() === 'discord') {
      Image($r('app.media.brand_discord')).width(34).height(34)
    } else if (this.resolveBrandKey() === 'dropbox') {
      Image($r('app.media.brand_dropbox')).width(34).height(34)
    } else if (this.resolveBrandKey() === 'github') {
      Image($r('app.media.brand_github')).width(34).height(34)
    } else if (this.resolveBrandKey() === 'gitlab') {
      Image($r('app.media.brand_gitlab')).width(34).height(34)
    } else if (this.resolveBrandKey() === 'google' || this.resolveBrandKey() === 'gmail') {
      Image($r('app.media.brand_google')).width(34).height(34)
    } else if (this.resolveBrandKey() === 'linkedin') {
      Image($r('app.media.brand_linkedin')).width(34).height(34)
    } else if (this.resolveBrandKey() === 'microsoft' || this.resolveBrandKey() === 'azure' || this.resolveBrandKey() === 'outlook') {
      Image($r('app.media.brand_microsoft')).width(34).height(34)
    } else if (this.resolveBrandKey() === 'notion') {
      Image($r('app.media.brand_notion')).width(34).height(34)
    } else if (this.resolveBrandKey() === 'onedrive') {
      Image($r('app.media.brand_onedrive')).width(34).height(34)
    } else if (this.resolveBrandKey() === 'openai' || this.resolveBrandKey() === 'chatgpt') {
      Image($r('app.media.brand_openai')).width(34).height(34)
    } else if (this.resolveBrandKey() === 'paypal') {
      Image($r('app.media.brand_paypal')).width(34).height(34)
    } else if (this.resolveBrandKey() === 'slack') {
      Image($r('app.media.brand_slack')).width(34).height(34)
    } else if (this.resolveBrandKey() === 'spotify') {
      Image($r('app.media.brand_spotify')).width(34).height(34)
    } else if (this.resolveBrandKey() === 'telegram') {
      Image($r('app.media.brand_telegram')).width(34).height(34)
    } else {
      Image($r('app.media.brand_default')).width(34).height(34)
    }
  }
}
