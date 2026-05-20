import { expect, it, vi } from 'vitest';

import {
  decryptVault,
  decryptVaultWithKey,
  encryptVault,
  encryptVaultWithKey,
  rewrapVaultKey,
  unlockVault,
  type EncryptedVaultBlob
} from './crypto';
import { VaultAuthenticationError, VaultIntegrityError } from './errors';
import {
  CURRENT_CIPHER,
  CURRENT_ENVELOPE_VERSION,
  CURRENT_KDF_CONFIG,
  deriveWrappingKey
} from './password';

it('round-trips encrypted vault payload', async () => {
  const encrypted = await encryptVault({ version: 1, accounts: [] }, 'pass123456');
  const decrypted = await decryptVault(encrypted, 'pass123456');

  expect(encrypted.formatVersion).toBe(CURRENT_ENVELOPE_VERSION);
  expect(encrypted.vaultId).toMatch(/^[0-9a-f-]{36}$/);
  expect(encrypted.kdf).toMatchObject(CURRENT_KDF_CONFIG);
  expect(encrypted.kdf.salt).toEqual(expect.any(String));
  expect(encrypted.keyEncryption.cipher).toBe(CURRENT_CIPHER);
  expect(encrypted.vaultEncryption.cipher).toBe(CURRENT_CIPHER);
  expect(decrypted.version).toBe(1);
  expect(decrypted.accounts).toEqual([]);
});

it('unlocks the random vault key and reuses it for account saves', async () => {
  const encrypted = await encryptVault({ version: 1, accounts: [] }, 'pass123456');
  const unlocked = await unlockVault(encrypted, 'pass123456');
  const saved = await encryptVaultWithKey(
    {
      version: 1,
      accounts: [
        {
          id: '1',
          issuer: 'GitLab',
          accountName: 'me@example.com',
          secret: 'JBSWY3DPEHPK3PXP',
          digits: 6,
          period: 30,
          algorithm: 'SHA1',
          tags: ['Default'],
          groupId: 'default',
          pinned: false,
          iconKey: 'gitlab',
          updatedAt: '2026-05-19T00:00:00.000Z'
        }
      ]
    },
    encrypted,
    unlocked.vaultKey
  );

  expect(saved.vaultId).toBe(encrypted.vaultId);
  expect(saved.keyEncryption).toEqual(encrypted.keyEncryption);
  expect(saved.vaultEncryption.iv).not.toBe(encrypted.vaultEncryption.iv);
  await expect(decryptVaultWithKey(saved, unlocked.vaultKey)).resolves.toHaveProperty(
    'accounts.length',
    1
  );
});

it('rewraps the same vault key when the master password changes', async () => {
  const encrypted = await encryptVault({ version: 1, accounts: [] }, 'pass123456');
  const before = await unlockVault(encrypted, 'pass123456');
  const rewrapped = await rewrapVaultKey(encrypted, 'pass123456', 'next-pass123456');
  const after = await unlockVault(rewrapped, 'next-pass123456');

  expect(rewrapped.vaultId).toBe(encrypted.vaultId);
  expect(rewrapped.kdf.salt).not.toBe(encrypted.kdf.salt);
  expect(rewrapped.keyEncryption).not.toEqual(encrypted.keyEncryption);
  expect(after.vaultKey).toEqual(before.vaultKey);
  await expect(decryptVault(rewrapped, 'pass123456')).rejects.toBeInstanceOf(
    VaultAuthenticationError
  );
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
        vaultId: 'vault',
        kdf: { ...CURRENT_KDF_CONFIG, salt: '*' },
        keyEncryption: {
          cipher: CURRENT_CIPHER,
          iv: '*',
          ciphertext: '*'
        },
        vaultEncryption: {
          cipher: CURRENT_CIPHER,
          iv: '*',
          ciphertext: '*'
        }
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
        vaultEncryption: {
          ...encrypted.vaultEncryption,
          cipher: 'AES-CBC'
        }
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
  const wrappingKey = await deriveWrappingKey(password, salt);
  const vaultKey = crypto.getRandomValues(new Uint8Array(32));
  const keyIv = crypto.getRandomValues(new Uint8Array(12));
  const vaultIv = crypto.getRandomValues(new Uint8Array(12));
  const importedVaultKey = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(vaultKey),
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
  const wrappedVaultKey = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(keyIv) },
    wrappingKey,
    toArrayBuffer(vaultKey)
  );
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(vaultIv) },
    importedVaultKey,
    toArrayBuffer(new TextEncoder().encode(plaintext))
  );

  return {
    formatVersion: CURRENT_ENVELOPE_VERSION,
    vaultId: '00000000-0000-4000-8000-000000000000',
    kdf: { ...CURRENT_KDF_CONFIG, salt: btoa(String.fromCharCode(...salt)) },
    keyEncryption: {
      cipher: CURRENT_CIPHER,
      iv: btoa(String.fromCharCode(...keyIv)),
      ciphertext: btoa(String.fromCharCode(...new Uint8Array(wrappedVaultKey)))
    },
    vaultEncryption: {
      cipher: CURRENT_CIPHER,
      iv: btoa(String.fromCharCode(...vaultIv)),
      ciphertext: btoa(String.fromCharCode(...new Uint8Array(ciphertext)))
    }
  };
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}
