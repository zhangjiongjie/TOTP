import { decodeBase64 } from './base64';
import { encryptVault, isEncryptedVaultBlob, parseVaultPayload, type VaultPayload } from './crypto';
import {
  VaultAuthenticationError,
  VaultImportFormatError,
  VaultIntegrityError,
  VaultParameterError
} from './errors';
import { CURRENT_CIPHER, CURRENT_KDF_CONFIG, derivePasswordVerifier, deriveWrappingKey } from './password';

interface LegacyEncryptedVaultBlob {
  formatVersion: number;
  kdf: {
    name: string;
    iterations: number;
    hash: string;
  };
  cipher: string;
  salt: string;
  iv: string;
  ciphertext: string;
  passwordVerifier: string;
}

type LegacyExportBundle =
  | { mode: 'plain'; vault: unknown }
  | { mode: 'encrypted'; encryptedVault: LegacyEncryptedVaultBlob | unknown };

export async function convertLegacyExportBundleToV2(
  bundle: unknown,
  password: string
) {
  if (!password) {
    throw new VaultParameterError('Password is required for legacy export migration');
  }

  const vault = await importLegacyVaultBundle(bundle, password);
  return {
    mode: 'encrypted' as const,
    encryptedVault: await encryptVault(vault, password)
  };
}

export async function importLegacyVaultBundle(
  bundle: unknown,
  password: string
): Promise<VaultPayload> {
  if (!isLegacyExportBundle(bundle)) {
    throw new VaultImportFormatError('Legacy export bundle is invalid');
  }

  if (bundle.mode === 'plain') {
    return parseVaultPayload(bundle.vault, VaultImportFormatError, 'Plain legacy vault is invalid');
  }

  if (isEncryptedVaultBlob(bundle.encryptedVault)) {
    throw new VaultImportFormatError('Export bundle is already v2');
  }

  if (!isLegacyEncryptedVaultBlob(bundle.encryptedVault)) {
    throw new VaultImportFormatError('Legacy encrypted export payload is invalid');
  }

  return decryptLegacyVault(bundle.encryptedVault, password);
}

async function decryptLegacyVault(
  encryptedVault: LegacyEncryptedVaultBlob,
  password: string
): Promise<VaultPayload> {
  assertSupportedLegacyMetadata(encryptedVault);

  try {
    const salt = decodeBase64(encryptedVault.salt);
    const expectedVerifier = decodeBase64(encryptedVault.passwordVerifier);
    const actualVerifier = await derivePasswordVerifier(password, salt);

    if (!bytesEqual(expectedVerifier, actualVerifier)) {
      throw new VaultAuthenticationError('Master password is incorrect');
    }

    const key = await deriveWrappingKey(password, salt);
    const plaintext = await crypto.subtle.decrypt(
      { name: encryptedVault.cipher, iv: toArrayBuffer(decodeBase64(encryptedVault.iv)) },
      key,
      toArrayBuffer(decodeBase64(encryptedVault.ciphertext))
    );
    const parsed = JSON.parse(new TextDecoder().decode(plaintext)) as unknown;
    return parseVaultPayload(parsed, VaultIntegrityError, 'Legacy vault payload is invalid');
  } catch (error) {
    if (error instanceof VaultAuthenticationError || error instanceof VaultIntegrityError) {
      throw error;
    }

    throw new VaultIntegrityError('Legacy encrypted vault is corrupted or invalid', {
      cause: error
    });
  }
}

function assertSupportedLegacyMetadata(encryptedVault: LegacyEncryptedVaultBlob) {
  if (encryptedVault.formatVersion !== 1) {
    throw new VaultIntegrityError('Legacy encrypted vault version is not supported');
  }

  if (
    encryptedVault.kdf.name !== CURRENT_KDF_CONFIG.name ||
    encryptedVault.kdf.iterations !== CURRENT_KDF_CONFIG.iterations ||
    encryptedVault.kdf.hash !== CURRENT_KDF_CONFIG.hash
  ) {
    throw new VaultIntegrityError('Legacy encrypted vault KDF metadata is not supported');
  }

  if (encryptedVault.cipher !== CURRENT_CIPHER) {
    throw new VaultIntegrityError('Legacy encrypted vault cipher metadata is not supported');
  }
}

function isLegacyExportBundle(value: unknown): value is LegacyExportBundle {
  return (
    typeof value === 'object' &&
    value !== null &&
    'mode' in value &&
    (value.mode === 'plain' || value.mode === 'encrypted')
  );
}

function isLegacyEncryptedVaultBlob(value: unknown): value is LegacyEncryptedVaultBlob {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  const kdf = record.kdf as Record<string, unknown> | undefined;
  return (
    record.formatVersion === 1 &&
    typeof kdf?.name === 'string' &&
    typeof kdf.iterations === 'number' &&
    typeof kdf.hash === 'string' &&
    typeof record.cipher === 'string' &&
    typeof record.salt === 'string' &&
    typeof record.iv === 'string' &&
    typeof record.ciphertext === 'string' &&
    typeof record.passwordVerifier === 'string'
  );
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) {
    return false;
  }

  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left[index] ^ right[index];
  }
  return result === 0;
}
