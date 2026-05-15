import { beforeEach, describe, expect, it } from 'vitest';
import { accountService, type AccountDraft } from './account-service';

describe('accountService.createRuntime', () => {
  beforeEach(() => {
    accountService.__resetForTests?.();
  });

  it('generates the real RFC 6238 TOTP code for the account secret', async () => {
    const account = await accountService.addAccount({
      issuer: 'RFC',
      accountName: 'alice',
      secret: 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ',
      digits: 8,
      period: 30,
      algorithm: 'SHA1'
    } satisfies AccountDraft);

    const runtime = await accountService.createRuntime(account, 59000);

    expect(runtime.code).toBe('9428 7082');
  });
});
