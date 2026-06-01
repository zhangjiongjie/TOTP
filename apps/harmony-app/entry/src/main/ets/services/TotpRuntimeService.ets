import { pasteboard } from '@kit.BasicServicesKit';
import { TotpAccount } from '../model/TotpAccount';
import { TotpCodeGenerator } from './TotpCodeGenerator';
import { AppI18n } from '../utils/AppI18n';

export class TotpCodeSnapshot {
  accountId: string;
  rawCode: string;
  codeValue: string;
  codeHint: string;
  countdownLabel: string;
  statusLabel: string;

  constructor(
    accountId: string,
    rawCode: string,
    codeValue: string,
    codeHint: string,
    countdownLabel: string,
    statusLabel: string
  ) {
    this.accountId = accountId;
    this.rawCode = rawCode;
    this.codeValue = codeValue;
    this.codeHint = codeHint;
    this.countdownLabel = countdownLabel;
    this.statusLabel = statusLabel;
  }
}

export class TotpRuntimeService {
  private static instance?: TotpRuntimeService;

  static getInstance(): TotpRuntimeService {
    if (TotpRuntimeService.instance === undefined) {
      TotpRuntimeService.instance = new TotpRuntimeService();
    }
    return TotpRuntimeService.instance;
  }

  createSnapshots(accounts: TotpAccount[], timestamp: number): TotpCodeSnapshot[] {
    let snapshots: TotpCodeSnapshot[] = [];
    for (let index: number = 0; index < accounts.length; index++) {
      snapshots.push(this.createSnapshot(accounts[index], timestamp));
    }
    return snapshots;
  }

  copyCodeToClipboard(code: string): void {
    try {
      let pasteData: pasteboard.PasteData = pasteboard.createData(pasteboard.MIMETYPE_TEXT_PLAIN, code);
      pasteboard.getSystemPasteboard().setDataSync(pasteData);
    } catch (error) {
      throw new Error(AppI18n.globalFormat($r('app.string.error_totp_copy_failed'), 'Failed to copy verification code: %1$s', this.resolveErrorMessage(error)));
    }
  }

  private createSnapshot(account: TotpAccount, timestamp: number): TotpCodeSnapshot {
    let period: number = this.normalizePositiveInteger(account.period, 30);
    let remainingSeconds: number = this.getSecondsUntilNextStep(period, timestamp);

    try {
      let rawCode: string = this.generateTotpCode(account, timestamp);
      return new TotpCodeSnapshot(
        account.id,
        rawCode,
        this.formatCodeValue(rawCode),
        AppI18n.globalString($r('app.string.totp_hint_tap_copy'), 'Tap the code to copy'),
        `${remainingSeconds}s / ${period}s`,
        AppI18n.globalFormat($r('app.string.totp_remaining_seconds'), '%1$ds left', remainingSeconds)
      );
    } catch (error) {
      let message: string = this.resolveErrorMessage(error);
      return new TotpCodeSnapshot(
        account.id,
        '',
        '------',
        message,
        `${remainingSeconds}s / ${period}s`,
        AppI18n.globalString($r('app.string.totp_config_error'), 'Configuration error')
      );
    }
  }

  private generateTotpCode(account: TotpAccount, timestamp: number): string {
    return TotpCodeGenerator.generate(account.secret, timestamp, account.period, account.digits, account.algorithm);
  }

  private getSecondsUntilNextStep(period: number, timestamp: number): number {
    let currentSecond: number = Math.floor(timestamp / 1000);
    let remainder: number = currentSecond % period;
    let remaining: number = period - remainder;
    return remaining > 0 ? remaining : period;
  }

  private normalizePositiveInteger(value: number, fallback: number): number {
    return value > 0 ? Math.floor(value) : fallback;
  }

  private formatCodeValue(rawCode: string): string {
    if (rawCode.length === 6) {
      return `${rawCode.substring(0, 3)} ${rawCode.substring(3)}`;
    }

    if (rawCode.length === 8) {
      return `${rawCode.substring(0, 4)} ${rawCode.substring(4)}`;
    }

    if (rawCode.length > 4 && rawCode.length % 2 === 0) {
      let middle: number = rawCode.length / 2;
      return `${rawCode.substring(0, middle)} ${rawCode.substring(middle)}`;
    }

    return rawCode;
  }

  private resolveErrorMessage(error: Object): string {
    let runtimeError: Error = error as Error;
    if (runtimeError.message !== undefined && runtimeError.message.length > 0) {
      return runtimeError.message;
    }
    return AppI18n.globalString($r('app.string.error_totp_compute_failed'), 'Failed to calculate verification code');
  }
}
