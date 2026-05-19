import type { AccountRecord } from '../types';

import { decodeBase64, encodeBase64 } from './base64';
import {
  VaultAuthenticationError,
  VaultIntegrityError,
  VaultParameterError
} from './errors';
import {
  CURRENT_CIPHER,
  CURRENT_ENVELOPE_VERSION,
  CURRENT_KDF_CONFIG,
  deriveWrappingKey,
  importAesKey
} from './password';

const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const VAULT_KEY_LENGTH = 32;

export interface VaultPayload {
  version: number;
  accounts: AccountRecord[];
}

export interface EncryptedVaultBlob {
  formatVersion: number;
  vaultId: string;
  kdf: {
    name: string;
    iterations: number;
    hash: string;
    salt: string;
  };
  keyEncryption: EncryptedAesGcmPayload;
  vaultEncryption: EncryptedAesGcmPayload;
}

export interface EncryptedAesGcmPayload {
  cipher: string;
  iv: string;
  ciphertext: string;
}

export interface UnlockedVault {
  vault: VaultPayload;
  vaultId: string;
  vaultKey: Uint8Array;
}

export async function encryptVault(
  vault: VaultPayload,
  password: string
): Promise<EncryptedVaultBlob> {
  assertPassword(password, 'encrypt vault');
  const validatedVault = parseVaultPayload(
    vault,
    VaultIntegrityError,
    'Vault payload is invalid'
  );

  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const vaultKey = crypto.getRandomValues(new Uint8Array(VAULT_KEY_LENGTH));
  const vaultId = createVaultId();
  const wrappingKey = await deriveWrappingKey(password, salt);
  const keyEncryption = await encryptBytes(vaultKey, wrappingKey);
  const vaultEncryption = await encryptVaultPayload(validatedVault, vaultKey);

  return {
    formatVersion: CURRENT_ENVELOPE_VERSION,
    vaultId,
    kdf: { ...CURRENT_KDF_CONFIG, salt: encodeBase64(salt) },
    keyEncryption,
    vaultEncryption
  };
}

export async function decryptVault(
  encryptedVault: EncryptedVaultBlob,
  password: string
): Promise<VaultPayload> {
  return (await unlockVault(encryptedVault, password)).vault;
}

export async function unlockVault(
  encryptedVault: EncryptedVaultBlob,
  password: string
): Promise<UnlockedVault> {
  assertPassword(password, 'decrypt vault');
  assertEncryptedVaultBlob(encryptedVault);

  try {
    assertSupportedEncryptionMetadata(encryptedVault);
    const wrappingKey = await deriveWrappingKey(password, decodeBase64(encryptedVault.kdf.salt));
    const vaultKey = await decryptBytes(encryptedVault.keyEncryption, wrappingKey);
    const vault = await decryptVaultWithKey(encryptedVault, vaultKey);

    return {
      vault,
      vaultId: encryptedVault.vaultId,
      vaultKey
    };
  } catch (error) {
    if (error instanceof VaultAuthenticationError || error instanceof VaultIntegrityError) {
      throw error;
    }

    if (isCryptoOperationError(error)) {
      throw new VaultAuthenticationError('Master password is incorrect', { cause: error });
    }

    throw new VaultIntegrityError('Encrypted vault is corrupted or invalid', {
      cause: error
    });
  }
}

export async function decryptVaultWithKey(
  encryptedVault: EncryptedVaultBlob,
  vaultKey: Uint8Array
): Promise<VaultPayload> {
  assertEncryptedVaultBlob(encryptedVault);

  try {
    assertSupportedEncryptionMetadata(encryptedVault);
    const key = await importAesKey(vaultKey);
    const plaintext = await decryptAesGcm(encryptedVault.vaultEncryption, key);
    const parsed = JSON.parse(new TextDecoder().decode(plaintext)) as unknown;

    return parseVaultPayload(parsed, VaultIntegrityError, 'Vault payload is invalid');
  } catch (error) {
    if (error instanceof VaultAuthenticationError || error instanceof VaultIntegrityError) {
      throw error;
    }

    throw new VaultIntegrityError('Encrypted vault is corrupted or invalid', {
      cause: error
    });
  }
}

export async function encryptVaultWithKey(
  vault: VaultPayload,
  encryptedVault: EncryptedVaultBlob,
  vaultKey: Uint8Array
): Promise<EncryptedVaultBlob> {
  assertEncryptedVaultBlob(encryptedVault);
  assertSupportedEncryptionMetadata(encryptedVault);
  const validatedVault = parseVaultPayload(
    vault,
    VaultIntegrityError,
    'Vault payload is invalid'
  );

  return {
    ...encryptedVault,
    vaultEncryption: await encryptVaultPayload(validatedVault, vaultKey)
  };
}

export async function rewrapVaultKey(
  encryptedVault: EncryptedVaultBlob,
  currentPassword: string,
  nextPassword: string
): Promise<EncryptedVaultBlob> {
  assertPassword(currentPassword, 'decrypt vault');
  assertPassword(nextPassword, 'encrypt vault');
  const unlocked = await unlockVault(encryptedVault, currentPassword);
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const wrappingKey = await deriveWrappingKey(nextPassword, salt);

  return {
    ...encryptedVault,
    kdf: { ...CURRENT_KDF_CONFIG, salt: encodeBase64(salt) },
    keyEncryption: await encryptBytes(unlocked.vaultKey, wrappingKey)
  };
}

export {
  VaultAuthenticationError,
  VaultIntegrityError,
  VaultParameterError
} from './errors';

export function parseVaultPayload<TError extends Error>(
  value: unknown,
  ErrorType: new (message: string, options?: { cause?: unknown }) => TError,
  message: string
): VaultPayload {
  if (!isVaultPayload(value)) {
    throw new ErrorType(message);
  }

  return {
    version: value.version,
    accounts: value.accounts.map((account) => ({ ...account, tags: [...account.tags] }))
  };
}

export function isEncryptedVaultBlob(value: unknown): value is EncryptedVaultBlob {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.formatVersion === 'number' &&
    typeof value.vaultId === 'string' &&
    isRecord(value.kdf) &&
    typeof value.kdf.name === 'string' &&
    typeof value.kdf.iterations === 'number' &&
    typeof value.kdf.hash === 'string' &&
    typeof value.kdf.salt === 'string' &&
    isEncryptedAesGcmPayload(value.keyEncryption) &&
    isEncryptedAesGcmPayload(value.vaultEncryption)
  );
}

export function isEncryptedAesGcmPayload(value: unknown): value is EncryptedAesGcmPayload {
  return (
    isRecord(value) &&
    typeof value.cipher === 'string' &&
    typeof value.iv === 'string' &&
    typeof value.ciphertext === 'string'
  );
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function assertPassword(password: string, action: string) {
  if (!password) {
    throw new VaultParameterError(`Password is required to ${action}`);
  }
}

function assertEncryptedVaultBlob(value: unknown): asserts value is EncryptedVaultBlob {
  if (!isEncryptedVaultBlob(value)) {
    throw new VaultIntegrityError('Encrypted vault blob is invalid');
  }
}

function assertSupportedEncryptionMetadata(encryptedVault: EncryptedVaultBlob) {
  if (encryptedVault.formatVersion !== CURRENT_ENVELOPE_VERSION) {
    throw new VaultIntegrityError('Encrypted vault format version is not supported');
  }

  if (
    encryptedVault.kdf.name !== CURRENT_KDF_CONFIG.name ||
    encryptedVault.kdf.iterations !== CURRENT_KDF_CONFIG.iterations ||
    encryptedVault.kdf.hash !== CURRENT_KDF_CONFIG.hash
  ) {
    throw new VaultIntegrityError('Encrypted vault KDF metadata is not supported');
  }

  if (
    encryptedVault.keyEncryption.cipher !== CURRENT_CIPHER ||
    encryptedVault.vaultEncryption.cipher !== CURRENT_CIPHER
  ) {
    throw new VaultIntegrityError('Encrypted vault cipher metadata is not supported');
  }
}

function isVaultPayload(value: unknown): value is VaultPayload {
  if (!isRecord(value) || typeof value.version !== 'number' || !Array.isArray(value.accounts)) {
    return false;
  }

  return value.accounts.every(isAccountRecord);
}

function isAccountRecord(value: unknown): value is AccountRecord {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === 'string' &&
    typeof value.issuer === 'string' &&
    typeof value.accountName === 'string' &&
    typeof value.secret === 'string' &&
    typeof value.digits === 'number' &&
    typeof value.period === 'number' &&
    isTotpAlgorithm(value.algorithm) &&
    Array.isArray(value.tags) &&
    value.tags.every((tag) => typeof tag === 'string') &&
    (value.groupId === null || typeof value.groupId === 'string') &&
    typeof value.pinned === 'boolean' &&
    (value.iconKey === null || typeof value.iconKey === 'string') &&
    typeof value.updatedAt === 'string'
  );
}

function isTotpAlgorithm(value: unknown): value is AccountRecord['algorithm'] {
  return value === 'SHA1' || value === 'SHA256' || value === 'SHA512';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
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

async function encryptVaultPayload(vault: VaultPayload, vaultKey: Uint8Array) {
  const key = await importAesKey(vaultKey);
  return encryptBytes(new TextEncoder().encode(JSON.stringify(vault)), key);
}

async function encryptBytes(plaintext: Uint8Array, key: CryptoKey): Promise<EncryptedAesGcmPayload> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const ciphertext = await crypto.subtle.encrypt(
    { name: CURRENT_CIPHER, iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(plaintext)
  );

  return {
    cipher: CURRENT_CIPHER,
    iv: encodeBase64(iv),
    ciphertext: encodeBase64(new Uint8Array(ciphertext))
  };
}

async function decryptBytes(payload: EncryptedAesGcmPayload, key: CryptoKey): Promise<Uint8Array> {
  const plaintext = await decryptAesGcm(payload, key);
  return new Uint8Array(plaintext);
}

async function decryptAesGcm(payload: EncryptedAesGcmPayload, key: CryptoKey): Promise<ArrayBuffer> {
  return crypto.subtle.decrypt(
    { name: payload.cipher, iv: toArrayBuffer(decodeBase64(payload.iv)) },
    key,
    toArrayBuffer(decodeBase64(payload.ciphertext))
  );
}

function createVaultId(): string {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function isCryptoOperationError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name?: unknown }).name === 'OperationError'
  );
}
