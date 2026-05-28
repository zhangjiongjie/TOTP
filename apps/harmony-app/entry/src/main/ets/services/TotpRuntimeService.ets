import { pasteboard } from '@kit.BasicServicesKit';
import { TotpAccount } from '../model/TotpAccount';
import { TotpCodeGenerator } from './TotpCodeGenerator';

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
      throw new Error(`复制验证码失败：${this.resolveErrorMessage(error)}`);
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
        '点击验证码即可复制',
        `${remainingSeconds}s / ${period}s`,
        `剩余 ${remainingSeconds}s`
      );
    } catch (error) {
      let message: string = this.resolveErrorMessage(error);
      return new TotpCodeSnapshot(
        account.id,
        '',
        '------',
        message,
        `${remainingSeconds}s / ${period}s`,
        '配置异常'
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
    return '验证码计算失败';
  }
}
