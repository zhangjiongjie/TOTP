import { describe, expect, it } from 'vitest';
import { InvalidOtpAuthUriError } from '../errors';
import { parseOtpAuthUri } from './otpauth';

describe('parseOtpAuthUri', () => {
  it('parses issuer and account name', () => {
    const parsed = parseOtpAuthUri(
      'otpauth://totp/GitHub:alice?secret=JBSWY3DPEHPK3PXP&issuer=GitHub'
    );

    expect(parsed.issuer).toBe('GitHub');
    expect(parsed.accountName).toBe('alice');
  });

  it('keeps an encoded colon inside the account name', () => {
    const parsed = parseOtpAuthUri(
      'otpauth://totp/alice%3Awork?secret=JBSWY3DPEHPK3PXP'
    );

    expect(parsed.issuer).toBe('');
    expect(parsed.accountName).toBe('alice:work');
  });

  it('uses default parameters when optional query params are omitted', () => {
    const parsed = parseOtpAuthUri('otpauth://totp/alice?secret=JBSWY3DPEHPK3PXP');

    expect(parsed.digits).toBe(6);
    expect(parsed.period).toBe(30);
    expect(parsed.algorithm).toBe('SHA1');
  });

  it('rejects non-decimal digit values', () => {
    expect(() =>
      parseOtpAuthUri('otpauth://totp/alice?secret=JBSWY3DPEHPK3PXP&digits=1e2')
    ).toThrow(InvalidOtpAuthUriError);
  });

  it('wraps malformed label percent-encoding as a domain error', () => {
    expect(() =>
      parseOtpAuthUri('otpauth://totp/%E0?secret=JBSWY3DPEHPK3PXP')
    ).toThrow(InvalidOtpAuthUriError);
  });
});
