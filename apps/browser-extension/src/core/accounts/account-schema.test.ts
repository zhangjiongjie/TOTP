import { expect, it } from 'vitest';
import { createAccountRecord } from './account-schema';

it('copies tags instead of reusing the input array', () => {
  const tags = ['work'];
  const record = createAccountRecord(
    {
      id: 'account-1',
      issuer: 'GitHub',
      accountName: 'alice',
      secret: 'JBSWY3DPEHPK3PXP',
      digits: 6,
      period: 30,
      algorithm: 'SHA1',
      updatedAt: '2026-05-10T00:00:00.000Z'
    },
    { tags }
  );

  tags.push('personal');

  expect(record.tags).toEqual(['work']);
});
