import type { AccountRecord } from '../types';

import { deriveAesKey } from './password';

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
}

export async function encryptVault(
  vault: VaultPayload,
  password: string
): Promise<EncryptedVaultBlob> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const key = await deriveAesKey(password, salt);
  const plaintext = new TextEncoder().encode(JSON.stringify(vault));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(plaintext)
  );

  return {
    version: vault.version,
    salt: encodeBase64(salt),
    iv: encodeBase64(iv),
    ciphertext: encodeBase64(new Uint8Array(ciphertext))
  };
}

export async function decryptVault(
  encryptedVault: EncryptedVaultBlob,
  password: string
): Promise<VaultPayload> {
  const salt = decodeBase64(encryptedVault.salt);
  const iv = decodeBase64(encryptedVault.iv);
  const key = await deriveAesKey(password, salt);
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(decodeBase64(encryptedVault.ciphertext))
  );

  return JSON.parse(new TextDecoder().decode(plaintext)) as VaultPayload;
}

function encodeBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

function decodeBase64(value: string): Uint8Array {
  return Uint8Array.from(Buffer.from(value, 'base64'));
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}
