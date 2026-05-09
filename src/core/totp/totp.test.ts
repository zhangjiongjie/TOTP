import { describe, expect, it } from 'vitest';
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
