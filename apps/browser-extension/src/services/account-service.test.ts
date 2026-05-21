import { beforeEach, describe, expect, it, vi } from 'vitest';
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

  it('can hydrate accounts without notifying local mutation subscribers', async () => {
    const listener = vi.fn();
    const unsubscribe = accountService.subscribe(listener);

    await accountService.replaceAllAccountsSilently([
      {
        id: 'remote-1',
        issuer: 'Remote',
        accountName: 'remote@example.com',
        secret: 'GEZDGNBVGY3TQOJQ',
        digits: 6,
        period: 30,
        algorithm: 'SHA1',
        tags: [],
        groupId: 'default',
        pinned: false,
        iconKey: null,
        updatedAt: '2026-05-21T10:00:00.000Z'
      }
    ]);

    expect(listener).not.toHaveBeenCalled();
    await accountService.addAccount({
      issuer: 'Local',
      accountName: 'local@example.com',
      secret: 'JBSWY3DPEHPK3PXP',
      digits: 6,
      period: 30,
      algorithm: 'SHA1'
    });
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
  });
});
