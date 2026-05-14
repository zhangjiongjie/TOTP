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

  const rawLabel = url.pathname.replace(/^\//, '').trim();
  const rawQuery = url.search.startsWith('?') ? url.search.slice(1) : url.search;
  const [issuerFromLabel, accountNameFromLabel] = splitRawLabel(rawLabel);
  const issuer = (getValidatedQueryParam(rawQuery, 'issuer') ?? issuerFromLabel).trim();
  const accountName = accountNameFromLabel.trim();
  const secret = (getValidatedQueryParam(rawQuery, 'secret') ?? '').trim();
  const digits = parsePositiveInteger(getValidatedQueryParam(rawQuery, 'digits'), DEFAULT_DIGITS);
  const period = parsePositiveInteger(getValidatedQueryParam(rawQuery, 'period'), DEFAULT_PERIOD);
  const algorithm = parseAlgorithm(getValidatedQueryParam(rawQuery, 'algorithm'));

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

  if (!/^[0-9]+$/.test(value)) {
    throw new InvalidOtpAuthUriError(`Expected a decimal integer, got: ${value}`);
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

function splitRawLabel(rawLabel: string): [string, string] {
  const separatorIndex = rawLabel.indexOf(':');

  try {
    if (separatorIndex === -1) {
      return ['', decodeURIComponent(rawLabel)];
    }

    return [
      decodeURIComponent(rawLabel.slice(0, separatorIndex)),
      decodeURIComponent(rawLabel.slice(separatorIndex + 1))
    ];
  } catch (error) {
    throw new InvalidOtpAuthUriError('Label contains malformed percent-encoding.', {
      cause: error
    });
  }
}

function getValidatedQueryParam(rawQuery: string, targetKey: string): string | null {
  if (!rawQuery) {
    return null;
  }

  for (const segment of rawQuery.split('&')) {
    if (!segment) {
      continue;
    }

    const separatorIndex = segment.indexOf('=');
    const rawKey = separatorIndex === -1 ? segment : segment.slice(0, separatorIndex);
    const rawValue = separatorIndex === -1 ? '' : segment.slice(separatorIndex + 1);
    const key = decodeQueryComponent(rawKey, targetKey);

    if (key === targetKey) {
      return decodeQueryComponent(rawValue, targetKey);
    }
  }

  return null;
}

function decodeQueryComponent(value: string, key: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, ' '));
  } catch (error) {
    throw new InvalidOtpAuthUriError(
      `Query parameter "${key}" contains malformed percent-encoding.`,
      { cause: error }
    );
  }
}
