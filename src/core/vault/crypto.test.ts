import { expect, it } from 'vitest';

import { decryptVault, encryptVault } from './crypto';

it('round-trips encrypted vault payload', async () => {
  const encrypted = await encryptVault({ version: 1, accounts: [] }, 'pass123456');
  const decrypted = await decryptVault(encrypted, 'pass123456');

  expect(decrypted.version).toBe(1);
  expect(decrypted.accounts).toEqual([]);
});

it('rejects decryption with the wrong password', async () => {
  const encrypted = await encryptVault({ version: 1, accounts: [] }, 'pass123456');

  await expect(decryptVault(encrypted, 'wrong-password')).rejects.toThrow();
});
