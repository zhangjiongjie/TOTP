import { expect, it } from 'vitest';

import { exportVaultBundle, importVaultBundle } from './export';

it('exports and imports encrypted bundle', async () => {
  const exported = await exportVaultBundle({ version: 1, accounts: [] }, 'secret');
  const imported = await importVaultBundle(exported, 'secret');

  expect(exported.mode).toBe('encrypted');
  expect(imported.accounts).toEqual([]);
});

it('exports and imports plain bundle', async () => {
  const exported = await exportVaultBundle(
    { version: 1, accounts: [] },
    undefined,
    'plain'
  );
  const imported = await importVaultBundle(exported);

  expect(exported.mode).toBe('plain');
  expect(imported).toEqual({ version: 1, accounts: [] });
});
