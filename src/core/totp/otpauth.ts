import { InvalidOtpAuthUriError } from '../errors';
import type { ParsedOtpAuthUri, TotpAlgorithm } from '../types';

const DEFAULT_DIGITS = 6;
const DEFAULT_PERIOD = 30;
const DEFAULT_ALGORITHM: TotpAlgorithm = 'SHA1';

export function parseOtpAuthUri(uri: string): ParsedOtpAuthUri {
  let url: URL;

  try {
    url = new URL(uri);
  } catch (error) {
    throw new InvalidOtpAuthUriError('Invalid otpauth URI.', { cause: error });
  }

  if (url.protocol !== 'otpauth:') {
    throw new InvalidOtpAuthUriError('URI must use the otpauth protocol.');
  }

  if (url.hostname.toLowerCase() !== 'totp') {
    throw new InvalidOtpAuthUriError('Only TOTP otpauth URIs are supported.');
  }

  const label = decodeURIComponent(url.pathname.replace(/^\//, '')).trim();
  const [issuerFromLabel, accountNameFromLabel] = label.includes(':')
    ? label.split(':', 2)
    : ['', label];
  const issuer = (url.searchParams.get('issuer') ?? issuerFromLabel).trim();
  const accountName = accountNameFromLabel.trim();
  const secret = (url.searchParams.get('secret') ?? '').trim();
  const digits = parsePositiveInteger(
    url.searchParams.get('digits'),
    DEFAULT_DIGITS
  );
  const period = parsePositiveInteger(
    url.searchParams.get('period'),
    DEFAULT_PERIOD
  );
  const algorithm = parseAlgorithm(url.searchParams.get('algorithm'));

  if (!accountName) {
    throw new InvalidOtpAuthUriError('Account name is required.');
  }

  if (!secret) {
    throw new InvalidOtpAuthUriError('Secret is required.');
  }

  return {
    issuer,
    accountName,
    secret,
    digits,
    period,
    algorithm
  };
}

function parsePositiveInteger(value: string | null, fallback: number): number {
  if (value === null) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new InvalidOtpAuthUriError(`Expected a positive integer, got: ${value}`);
  }

  return parsed;
}

function parseAlgorithm(value: string | null): TotpAlgorithm {
  if (value === null || value.trim() === '') {
    return DEFAULT_ALGORITHM;
  }

  const normalized = value.trim().toUpperCase();
  if (normalized === 'SHA1' || normalized === 'SHA256' || normalized === 'SHA512') {
    return normalized;
  }

  throw new InvalidOtpAuthUriError(`Unsupported TOTP algorithm: ${value}`);
}
