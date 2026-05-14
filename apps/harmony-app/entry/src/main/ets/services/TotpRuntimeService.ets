import { pasteboard } from '@kit.BasicServicesKit';
import { cryptoFramework } from '@kit.CryptoArchitectureKit';
import { TotpAccount } from '../model/TotpAccount';

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
    let digits: number = this.normalizePositiveInteger(account.digits, 6);
    let period: number = this.normalizePositiveInteger(account.period, 30);
    let algorithm: string = this.normalizeAlgorithm(account.algorithm);
    let secret: Uint8Array = this.decodeBase32(account.secret);
    let counter: number = Math.floor(timestamp / 1000 / period);
    let signature: Uint8Array = this.calculateHmac(algorithm, secret, this.encodeCounter(counter));
    if (signature.length < 4) {
      throw new Error('HMAC 输出长度不足');
    }

    let offset: number = signature[signature.length - 1] & 0x0f;
    if (offset + 3 >= signature.length) {
      throw new Error('HMAC 偏移量无效');
    }

    let binary: number =
      ((signature[offset] & 0x7f) << 24) |
      ((signature[offset + 1] & 0xff) << 16) |
      ((signature[offset + 2] & 0xff) << 8) |
      (signature[offset + 3] & 0xff);

    let modulo: number = Math.pow(10, digits);
    let otp: string = `${binary % modulo}`;
    while (otp.length < digits) {
      otp = `0${otp}`;
    }
    return otp;
  }

  private calculateHmac(algorithm: string, secret: Uint8Array, counter: Uint8Array): Uint8Array {
    try {
      let mac: cryptoFramework.Mac = cryptoFramework.createMac(algorithm);
      let keyGenerator: cryptoFramework.SymKeyGenerator = cryptoFramework.createSymKeyGenerator('HMAC');
      let key: cryptoFramework.SymKey = keyGenerator.convertKeySync({ data: secret });
      mac.initSync(key);
      mac.updateSync({ data: counter });
      return mac.doFinalSync().data;
    } catch (error) {
      throw new Error(`验证码签名计算失败：${this.resolveErrorMessage(error)}`);
    }
  }

  private decodeBase32(value: string): Uint8Array {
    let normalized: string = value.trim().toUpperCase().replace(/[\s-]/g, '');
    if (normalized.length === 0) {
      throw new Error('密钥为空');
    }

    this.validateBase32(normalized);

    let paddingStart: number = normalized.indexOf('=');
    let data: string = paddingStart >= 0 ? normalized.substring(0, paddingStart) : normalized;
    let bits: number = 0;
    let bitCount: number = 0;
    let bytes: number[] = [];
    let alphabet: string = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

    for (let index: number = 0; index < data.length; index++) {
      let character: string = data.substring(index, index + 1);
      let alphabetIndex: number = alphabet.indexOf(character);
      if (alphabetIndex < 0) {
        throw new Error(`Base32 字符无效：${character}`);
      }

      bits = (bits << 5) | alphabetIndex;
      bitCount += 5;

      if (bitCount >= 8) {
        bitCount -= 8;
        bytes.push((bits >>> bitCount) & 0xff);
      }
    }

    if (bitCount > 0) {
      let trailingMask: number = (1 << bitCount) - 1;
      if ((bits & trailingMask) !== 0) {
        throw new Error('Base32 尾部比特无效');
      }
    }

    return Uint8Array.from(bytes);
  }

  private validateBase32(value: string): void {
    let paddingStart: number = value.indexOf('=');
    if (paddingStart < 0) {
      this.validateUnpaddedLength(value.length);
      return;
    }

    let dataLength: number = paddingStart;
    let padding: string = value.substring(paddingStart);
    if (!/^=+$/.test(padding)) {
      throw new Error('Base32 填充位置无效');
    }

    if (value.length % 8 !== 0) {
      throw new Error('Base32 长度无效');
    }

    let remainder: number = dataLength % 8;
    let expectedPadding: number = this.resolveExpectedPadding(remainder);
    if (expectedPadding < 0 || padding.length !== expectedPadding) {
      throw new Error('Base32 填充长度无效');
    }
  }

  private validateUnpaddedLength(length: number): void {
    let remainder: number = length % 8;
    if (remainder !== 0 && remainder !== 2 && remainder !== 4 && remainder !== 5 && remainder !== 7) {
      throw new Error('Base32 输入长度无效');
    }
  }

  private resolveExpectedPadding(remainder: number): number {
    switch (remainder) {
      case 2:
        return 6;
      case 4:
        return 4;
      case 5:
        return 3;
      case 7:
        return 1;
      default:
        return -1;
    }
  }

  private encodeCounter(counter: number): Uint8Array {
    let buffer: Uint8Array = new Uint8Array(8);
    let high: number = Math.floor(counter / 0x100000000);
    let low: number = counter >>> 0;

    buffer[0] = (high >>> 24) & 0xff;
    buffer[1] = (high >>> 16) & 0xff;
    buffer[2] = (high >>> 8) & 0xff;
    buffer[3] = high & 0xff;
    buffer[4] = (low >>> 24) & 0xff;
    buffer[5] = (low >>> 16) & 0xff;
    buffer[6] = (low >>> 8) & 0xff;
    buffer[7] = low & 0xff;

    return buffer;
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

  private normalizeAlgorithm(value: string): string {
    let normalized: string = value.trim().toUpperCase();
    switch (normalized) {
      case 'SHA1':
      case 'SHA256':
      case 'SHA512':
        return normalized;
      default:
        throw new Error(`不支持的算法：${value}`);
    }
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
