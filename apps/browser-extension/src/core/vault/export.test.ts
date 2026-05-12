import { expect, it } from 'vitest';

import { VaultImportFormatError, VaultParameterError } from './errors';
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

it('rejects encrypted export when password is missing', async () => {
  await expect(
    exportVaultBundle({ version: 1, accounts: [] })
  ).rejects.toBeInstanceOf(VaultParameterError);
});

it('rejects plain import when vault data is invalid', async () => {
  await expect(
    importVaultBundle({ mode: 'plain', vault: { version: 'bad', accounts: [] } } as never)
  ).rejects.toBeInstanceOf(VaultImportFormatError);
});

it('rejects encrypted import when password is missing', async () => {
  const exported = await exportVaultBundle({ version: 1, accounts: [] }, 'secret');

  await expect(importVaultBundle(exported)).rejects.toBeInstanceOf(VaultParameterError);
});

it('rejects bundle objects with an unsupported mode', async () => {
  await expect(
    importVaultBundle({ mode: 'zip' } as never)
  ).rejects.toBeInstanceOf(VaultImportFormatError);
});
