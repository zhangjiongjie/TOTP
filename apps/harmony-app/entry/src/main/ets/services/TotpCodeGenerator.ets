import { cryptoFramework } from '@kit.CryptoArchitectureKit';
import { requireTotpAlgorithm } from '../shared/TotpAlgorithm';
import { AppI18n } from '../utils/AppI18n';

export class TotpCodeGenerator {
  static generate(secretValue: string, timestamp: number, periodValue: number, digitsValue: number, algorithmValue: string): string {
    let digits: number = TotpCodeGenerator.normalizePositiveInteger(digitsValue, 6);
    let period: number = TotpCodeGenerator.normalizePositiveInteger(periodValue, 30);
    let algorithm: string = requireTotpAlgorithm(algorithmValue);
    let secret: Uint8Array = TotpCodeGenerator.decodeBase32(secretValue);
    let counter: number = Math.floor(timestamp / 1000 / period);
    let signature: Uint8Array = TotpCodeGenerator.calculateHmac(algorithm, secret, TotpCodeGenerator.encodeCounter(counter));
    if (signature.length < 4) {
      throw new Error(AppI18n.globalString($r('app.string.error_hmac_output_short'), 'HMAC output is too short'));
    }

    let offset: number = signature[signature.length - 1] & 0x0f;
    if (offset + 3 >= signature.length) {
      throw new Error(AppI18n.globalString($r('app.string.error_hmac_offset_invalid'), 'HMAC offset is invalid'));
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

  private static calculateHmac(algorithm: string, secret: Uint8Array, counter: Uint8Array): Uint8Array {
    try {
      let mac: cryptoFramework.Mac = cryptoFramework.createMac(algorithm);
      let keyGenerator: cryptoFramework.SymKeyGenerator = cryptoFramework.createSymKeyGenerator('HMAC');
      let key: cryptoFramework.SymKey = keyGenerator.convertKeySync({ data: secret });
      mac.initSync(key);
      mac.updateSync({ data: counter });
      return mac.doFinalSync().data;
    } catch (error) {
      throw new Error(AppI18n.globalFormat($r('app.string.error_totp_signature_failed'), 'Failed to calculate verification code signature: %1$s', TotpCodeGenerator.resolveErrorMessage(error)));
    }
  }

  private static decodeBase32(value: string): Uint8Array {
    let normalized: string = value.trim().toUpperCase().replace(/[\s-]/g, '');
    if (normalized.length === 0) {
      throw new Error(AppI18n.globalString($r('app.string.error_totp_empty_secret'), 'Secret is empty'));
    }

    TotpCodeGenerator.validateBase32(normalized);

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
        throw new Error(AppI18n.globalFormat($r('app.string.error_base32_invalid_char'), 'Invalid Base32 character: %1$s', character));
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
        throw new Error(AppI18n.globalString($r('app.string.error_base32_trailing_bits'), 'Invalid Base32 trailing bits'));
      }
    }

    return Uint8Array.from(bytes);
  }

  private static validateBase32(value: string): void {
    let paddingStart: number = value.indexOf('=');
    if (paddingStart < 0) {
      TotpCodeGenerator.validateUnpaddedLength(value.length);
      return;
    }

    let dataLength: number = paddingStart;
    let padding: string = value.substring(paddingStart);
    if (!/^=+$/.test(padding)) {
      throw new Error(AppI18n.globalString($r('app.string.error_base32_padding_position'), 'Invalid Base32 padding position'));
    }

    if (value.length % 8 !== 0) {
      throw new Error(AppI18n.globalString($r('app.string.error_base32_length'), 'Invalid Base32 length'));
    }

    let remainder: number = dataLength % 8;
    let expectedPadding: number = TotpCodeGenerator.resolveExpectedPadding(remainder);
    if (expectedPadding < 0 || padding.length !== expectedPadding) {
      throw new Error(AppI18n.globalString($r('app.string.error_base32_padding_length'), 'Invalid Base32 padding length'));
    }
  }

  private static validateUnpaddedLength(length: number): void {
    let remainder: number = length % 8;
    if (remainder !== 0 && remainder !== 2 && remainder !== 4 && remainder !== 5 && remainder !== 7) {
      throw new Error(AppI18n.globalString($r('app.string.error_base32_input_length'), 'Invalid Base32 input length'));
    }
  }

  private static resolveExpectedPadding(remainder: number): number {
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

  private static encodeCounter(counter: number): Uint8Array {
    let bytes: Uint8Array = new Uint8Array(8);
    let high: number = Math.floor(counter / 0x100000000);
    let low: number = counter >>> 0;

    bytes[0] = (high >>> 24) & 0xff;
    bytes[1] = (high >>> 16) & 0xff;
    bytes[2] = (high >>> 8) & 0xff;
    bytes[3] = high & 0xff;
    bytes[4] = (low >>> 24) & 0xff;
    bytes[5] = (low >>> 16) & 0xff;
    bytes[6] = (low >>> 8) & 0xff;
    bytes[7] = low & 0xff;

    return bytes;
  }

  private static normalizePositiveInteger(value: number, fallback: number): number {
    return value > 0 ? Math.floor(value) : fallback;
  }

  private static resolveErrorMessage(error: Object): string {
    let runtimeError: Error = error as Error;
    if (runtimeError.message !== undefined && runtimeError.message.length > 0) {
      return runtimeError.message;
    }
    return AppI18n.globalString($r('app.string.error_totp_compute_failed'), 'Failed to calculate verification code');
  }
}
