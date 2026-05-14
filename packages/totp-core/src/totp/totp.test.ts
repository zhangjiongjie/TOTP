import { describe, expect, it } from 'vitest';
import { InvalidBase32Error } from '../errors';
import { decodeBase32 } from './base32';
import { generateTotpCode } from './totp';

describe('generateTotpCode', () => {
  it('uses RFC 6238 vector', async () => {
    const code = await generateTotpCode({
      secret: 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ',
      digits: 8,
      period: 30,
      algorithm: 'SHA1',
      timestamp: 59000
    });

    expect(code).toBe('94287082');
  });
});

describe('decodeBase32', () => {
  it('rejects incomplete input length', () => {
    expect(() => decodeBase32('M')).toThrow(InvalidBase32Error);
  });

  it('rejects invalid padding placement', () => {
    expect(() => decodeBase32('MY===A==')).toThrow(InvalidBase32Error);
  });

  it('rejects invalid padding length', () => {
    expect(() => decodeBase32('MZX=====')).toThrow(InvalidBase32Error);
  });

  it('rejects non-zero trailing bits', () => {
    expect(() => decodeBase32('MZ')).toThrow(InvalidBase32Error);
  });
});
