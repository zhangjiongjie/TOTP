import { beforeEach, describe, expect, it } from 'vitest';
import { accountService } from './account-service';
import { settingsService } from './settings-service';

describe('settingsService', () => {
  beforeEach(() => {
    accountService.__resetForTests?.();
  });

  it('restores imported account metadata instead of rebuilding draft-only records', async () => {
    const exported = JSON.stringify({
      mode: 'plain',
      vault: {
        version: 1,
        accounts: [
          {
            id: 'import-1',
            issuer: 'GitHub',
            accountName: 'alice@company.com',
            secret: 'JBSWY3DPEHPK3PXP',
            digits: 6,
            period: 30,
            algorithm: 'SHA1',
            tags: ['work', 'critical'],
            groupId: 'personal',
            pinned: true,
            iconKey: 'github',
            updatedAt: '2026-05-10T08:00:00.000Z'
          }
        ]
      }
    });
    const file = {
      name: 'totp-backup-plain.json',
      type: 'application/json',
      text: async () => exported
    } as File;

    await settingsService.importVault(file);

    const accounts = await accountService.listAccounts();
    const restored = accounts.find((account) => account.id === 'import-1');

    expect(restored).not.toBeUndefined();
    expect(restored?.groupId).toBe('personal');
    expect(restored?.tags).toEqual(['work', 'critical']);
    expect(restored?.pinned).toBe(true);
    expect(restored?.iconKey).toBe('github');
    expect(restored?.updatedAt).toBe('2026-05-10T08:00:00.000Z');
  });
});
