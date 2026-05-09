import {
  decryptVault,
  encryptVault,
  type EncryptedVaultBlob,
  type VaultPayload
} from './crypto';

export type ExportBundle =
  | { mode: 'plain'; vault: VaultPayload }
  | { mode: 'encrypted'; encryptedVault: EncryptedVaultBlob };

export async function exportVaultBundle(
  vault: VaultPayload,
  password?: string,
  mode: ExportBundle['mode'] = 'encrypted'
): Promise<ExportBundle> {
  if (mode === 'plain') {
    return {
      mode: 'plain',
      vault
    };
  }

  if (!password) {
    throw new Error('Password is required for encrypted export');
  }

  return {
    mode: 'encrypted',
    encryptedVault: await encryptVault(vault, password)
  };
}

export async function importVaultBundle(
  bundle: ExportBundle,
  password?: string
): Promise<VaultPayload> {
  if (bundle.mode === 'plain') {
    return bundle.vault;
  }

  if (!password) {
    throw new Error('Password is required for encrypted import');
  }

  return decryptVault(bundle.encryptedVault, password);
}
