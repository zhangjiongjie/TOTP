import { expect, it, vi } from 'vitest';

import { encodeBase64 } from './base64';
import {
  decryptVault,
  encryptVault,
  type EncryptedVaultBlob
} from './crypto';
import { VaultAuthenticationError, VaultIntegrityError } from './errors';
import {
  CURRENT_CIPHER,
  CURRENT_ENVELOPE_VERSION,
  CURRENT_KDF_CONFIG,
  deriveAesKey,
  derivePasswordVerifier
} from './password';

it('round-trips encrypted vault payload', async () => {
  const encrypted = await encryptVault({ version: 1, accounts: [] }, 'pass123456');
  const decrypted = await decryptVault(encrypted, 'pass123456');

  expect(encrypted.formatVersion).toBe(CURRENT_ENVELOPE_VERSION);
  expect(encrypted.kdf).toEqual(CURRENT_KDF_CONFIG);
  expect(encrypted.cipher).toBe(CURRENT_CIPHER);
  expect(decrypted.version).toBe(1);
  expect(decrypted.accounts).toEqual([]);
});

it('rejects decryption with the wrong password', async () => {
  const encrypted = await encryptVault({ version: 1, accounts: [] }, 'pass123456');

  await expect(decryptVault(encrypted, 'wrong-password')).rejects.toBeInstanceOf(
    VaultAuthenticationError
  );
});

it('uses browser base64 helpers during encrypt/decrypt round-trip', async () => {
  const originalBtoa = globalThis.btoa;
  const originalAtob = globalThis.atob;
  const btoaSpy = vi.fn((value: string) => originalBtoa(value));
  const atobSpy = vi.fn((value: string) => originalAtob(value));

  globalThis.btoa = btoaSpy;
  globalThis.atob = atobSpy;

  try {
    const encrypted = await encryptVault({ version: 1, accounts: [] }, 'pass123456');
    const decrypted = await decryptVault(encrypted, 'pass123456');

    expect(decrypted).toEqual({ version: 1, accounts: [] });
    expect(btoaSpy).toHaveBeenCalled();
    expect(atobSpy).toHaveBeenCalled();
  } finally {
    globalThis.btoa = originalBtoa;
    globalThis.atob = originalAtob;
  }
});

it('rejects decrypted payloads that do not match the vault shape', async () => {
  const tampered = await createEncryptedBlobForTest(
    JSON.stringify({ version: 'oops', accounts: [] }),
    'pass123456'
  );

  await expect(decryptVault(tampered, 'pass123456')).rejects.toBeInstanceOf(
    VaultIntegrityError
  );
});

it('rejects encrypted blobs with invalid base64 content', async () => {
  await expect(
    decryptVault(
      {
        formatVersion: CURRENT_ENVELOPE_VERSION,
        kdf: CURRENT_KDF_CONFIG,
        cipher: CURRENT_CIPHER,
        salt: '*',
        iv: '*',
        ciphertext: '*',
        passwordVerifier: '*'
      },
      'pass123456'
    )
  ).rejects.toBeInstanceOf(VaultIntegrityError);
});

it('rejects unsupported envelope versions', async () => {
  const encrypted = await encryptVault({ version: 1, accounts: [] }, 'pass123456');

  await expect(
    decryptVault({ ...encrypted, formatVersion: 999 }, 'pass123456')
  ).rejects.toBeInstanceOf(VaultIntegrityError);
});

it('rejects unsupported kdf or cipher metadata', async () => {
  const encrypted = await encryptVault({ version: 1, accounts: [] }, 'pass123456');

  await expect(
    decryptVault(
      {
        ...encrypted,
        kdf: { ...encrypted.kdf, name: 'scrypt' }
      },
      'pass123456'
    )
  ).rejects.toBeInstanceOf(VaultIntegrityError);

  await expect(
    decryptVault(
      {
        ...encrypted,
        cipher: 'AES-CBC'
      },
      'pass123456'
    )
  ).rejects.toBeInstanceOf(VaultIntegrityError);
});

async function createEncryptedBlobForTest(
  plaintext: string,
  password: string
): Promise<EncryptedVaultBlob> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey(password, salt);
  const passwordVerifier = await derivePasswordVerifier(password, salt);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(new TextEncoder().encode(plaintext))
  );

  return {
    formatVersion: CURRENT_ENVELOPE_VERSION,
    kdf: CURRENT_KDF_CONFIG,
    cipher: CURRENT_CIPHER,
    salt: encodeBase64(salt),
    iv: encodeBase64(iv),
    ciphertext: encodeBase64(new Uint8Array(ciphertext)),
    passwordVerifier: encodeBase64(passwordVerifier)
  };
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}
