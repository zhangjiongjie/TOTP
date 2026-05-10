import {
  decryptVault,
  encryptVault,
  isEncryptedVaultBlob,
  parseVaultPayload,
  type EncryptedVaultBlob,
  type VaultPayload
} from './crypto';
import { VaultImportFormatError, VaultParameterError } from './errors';

export type ExportBundle =
  | { mode: 'plain'; vault: VaultPayload }
  | { mode: 'encrypted'; encryptedVault: EncryptedVaultBlob };

export async function exportVaultBundle(
  vault: VaultPayload,
  password?: string,
  mode: ExportBundle['mode'] = 'encrypted'
): Promise<ExportBundle> {
  const validatedVault = parseVaultPayload(
    vault,
    VaultImportFormatError,
    'Vault payload is invalid for export'
  );

  if (mode === 'plain') {
    return {
      mode: 'plain',
      vault: validatedVault
    };
  }

  if (!password) {
    throw new VaultParameterError('Password is required for encrypted export');
  }

  return {
    mode: 'encrypted',
    encryptedVault: await encryptVault(validatedVault, password)
  };
}

export async function importVaultBundle(
  bundle: unknown,
  password?: string
): Promise<VaultPayload> {
  if (!isExportBundleRecord(bundle)) {
    throw new VaultImportFormatError('Export bundle is invalid');
  }

  if (bundle.mode === 'plain') {
    return parseVaultPayload(bundle.vault, VaultImportFormatError, 'Plain export vault is invalid');
  }

  if (!password) {
    throw new VaultParameterError('Password is required for encrypted import');
  }

  if (!isEncryptedVaultBlob(bundle.encryptedVault)) {
    throw new VaultImportFormatError('Encrypted export payload is invalid');
  }

  return decryptVault(bundle.encryptedVault, password);
}

function isExportBundleRecord(
  value: unknown
): value is
  | { mode: 'plain'; vault: unknown }
  | { mode: 'encrypted'; encryptedVault: EncryptedVaultBlob | unknown } {
  if (typeof value !== 'object' || value === null || !('mode' in value)) {
    return false;
  }

  if (value.mode === 'plain') {
    return 'vault' in value;
  }

  if (value.mode === 'encrypted') {
    return 'encryptedVault' in value;
  }

  return false;
}
