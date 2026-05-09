import { InvalidTotpConfigError } from '../errors';
import type { TotpAlgorithm, TotpConfig } from '../types';
import { getTotpCounter } from '../time';
import { decodeBase32 } from './base32';

const ALGORITHM_MAP: Record<TotpAlgorithm, string> = {
  SHA1: 'SHA-1',
  SHA256: 'SHA-256',
  SHA512: 'SHA-512'
};

export async function generateTotpCode(config: TotpConfig): Promise<string> {
  validateTotpConfig(config);

  const secret = decodeBase32(config.secret);
  const counter = getTotpCounter(config.period, config.timestamp ?? Date.now());
  const key = await crypto.subtle.importKey(
    'raw',
    secret,
    { name: 'HMAC', hash: ALGORITHM_MAP[config.algorithm] },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, encodeCounter(counter));
  const hmac = new Uint8Array(signature);
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const otp = binary % 10 ** config.digits;
  return otp.toString().padStart(config.digits, '0');
}

function validateTotpConfig(config: TotpConfig): void {
  if (!Number.isInteger(config.digits) || config.digits < 1) {
    throw new InvalidTotpConfigError('Digits must be a positive integer.');
  }

  if (!Number.isInteger(config.period) || config.period < 1) {
    throw new InvalidTotpConfigError('Period must be a positive integer.');
  }
}

function encodeCounter(counter: number): ArrayBuffer {
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  const bigCounter = BigInt(counter);

  view.setUint32(0, Number((bigCounter >> 32n) & 0xffffffffn));
  view.setUint32(4, Number(bigCounter & 0xffffffffn));

  return buffer;
}
