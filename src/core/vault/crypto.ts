import type { AccountRecord } from '../types';

import { decodeBase64, encodeBase64 } from './base64';
import {
  VaultAuthenticationError,
  VaultIntegrityError,
  VaultParameterError
} from './errors';
import { deriveAesKey, derivePasswordVerifier } from './password';

const SALT_LENGTH = 16;
const IV_LENGTH = 12;

export interface VaultPayload {
  version: number;
  accounts: AccountRecord[];
}

export interface EncryptedVaultBlob {
  version: number;
  salt: string;
  iv: string;
  ciphertext: string;
  passwordVerifier: string;
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
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const key = await deriveAesKey(password, salt);
  const passwordVerifier = await derivePasswordVerifier(password, salt);
  const plaintext = new TextEncoder().encode(JSON.stringify(validatedVault));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(plaintext)
  );

  return {
    version: validatedVault.version,
    salt: encodeBase64(salt),
    iv: encodeBase64(iv),
    ciphertext: encodeBase64(new Uint8Array(ciphertext)),
    passwordVerifier: encodeBase64(passwordVerifier)
  };
}

export async function decryptVault(
  encryptedVault: EncryptedVaultBlob,
  password: string
): Promise<VaultPayload> {
  assertPassword(password, 'decrypt vault');
  assertEncryptedVaultBlob(encryptedVault);

  try {
    const salt = decodeBase64(encryptedVault.salt);
    const iv = decodeBase64(encryptedVault.iv);
    const expectedVerifier = decodeBase64(encryptedVault.passwordVerifier);
    const actualVerifier = await derivePasswordVerifier(password, salt);

    if (!bytesEqual(expectedVerifier, actualVerifier)) {
      throw new VaultAuthenticationError('Master password is incorrect');
    }

    const key = await deriveAesKey(password, salt);
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: toArrayBuffer(iv) },
      key,
      toArrayBuffer(decodeBase64(encryptedVault.ciphertext))
    );
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
    typeof value.version === 'number' &&
    typeof value.salt === 'string' &&
    typeof value.iv === 'string' &&
    typeof value.ciphertext === 'string' &&
    typeof value.passwordVerifier === 'string'
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
