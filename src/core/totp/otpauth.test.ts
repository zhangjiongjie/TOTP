import { expect, it } from 'vitest';
import { parseOtpAuthUri } from './otpauth';

it('parses issuer and account name', () => {
  const parsed = parseOtpAuthUri(
    'otpauth://totp/GitHub:alice?secret=JBSWY3DPEHPK3PXP&issuer=GitHub'
  );

  expect(parsed.issuer).toBe('GitHub');
  expect(parsed.accountName).toBe('alice');
});
