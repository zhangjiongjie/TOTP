#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';

const crypto = globalThis.crypto ?? webcrypto;
const KDF = { name: 'PBKDF2', iterations: 310_000, hash: 'SHA-256' };
const CIPHER = 'AES-GCM';
const encoder = new TextEncoder();
const decoder = new TextDecoder();

const [, , inputPath, outputPath, password] = process.argv;

if (!inputPath || !outputPath || !password) {
  console.error('Usage: node tools/migrate-vault-v1-to-v2.mjs <old-export.json> <new-export.json> <master-password>');
  process.exit(1);
}

const raw = await readFile(inputPath, 'utf8');
const legacyBundle = JSON.parse(raw);
const vault = await importLegacyBundle(legacyBundle, password);
const nextBundle = {
  mode: 'encrypted',
  encryptedVault: await encryptV2(vault, password)
};

await writeFile(outputPath, `${JSON.stringify(nextBundle, null, 2)}\n`, 'utf8');
console.log(`Converted legacy export to v2: ${outputPath}`);

async function importLegacyBundle(bundle, masterPassword) {
  if (bundle?.mode === 'plain') {
    return assertVaultPayload(bundle.vault);
  }

  if (bundle?.mode !== 'encrypted' || !bundle.encryptedVault) {
    throw new Error('Legacy export bundle is invalid');
  }

  const blob = bundle.encryptedVault;
  if (blob.formatVersion !== 1) {
    throw new Error('Only legacy formatVersion 1 exports can be converted');
  }

  assertLegacyMetadata(blob);
  const salt = fromBase64(blob.salt);
  const expectedVerifier = fromBase64(blob.passwordVerifier);
  const actualVerifier = new Uint8Array(await deriveBits(masterPassword, salt));
  if (!bytesEqual(expectedVerifier, actualVerifier)) {
    throw new Error('Master password is incorrect');
  }

  const key = await deriveAesKey(masterPassword, salt);
  const plaintext = await crypto.subtle.decrypt(
    { name: CIPHER, iv: fromBase64(blob.iv) },
    key,
    fromBase64(blob.ciphertext)
  );

  return assertVaultPayload(JSON.parse(decoder.decode(plaintext)));
}

async function encryptV2(vault, masterPassword) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const vaultKey = crypto.getRandomValues(new Uint8Array(32));
  const wrappingKey = await deriveAesKey(masterPassword, salt);
  const importedVaultKey = await importAesKey(vaultKey);

  return {
    formatVersion: 2,
    vaultId: crypto.randomUUID(),
    kdf: { ...KDF, salt: toBase64(salt) },
    keyEncryption: await encryptBytes(vaultKey, wrappingKey),
    vaultEncryption: await encryptBytes(encoder.encode(JSON.stringify(vault)), importedVaultKey)
  };
}

async function deriveAesKey(masterPassword, salt) {
  const material = await crypto.subtle.importKey(
    'raw',
    encoder.encode(masterPassword),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: KDF.name, salt, iterations: KDF.iterations, hash: KDF.hash },
    material,
    { name: CIPHER, length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function deriveBits(masterPassword, salt) {
  const material = await crypto.subtle.importKey(
    'raw',
    encoder.encode(masterPassword),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  return crypto.subtle.deriveBits(
    { name: KDF.name, salt, iterations: KDF.iterations, hash: KDF.hash },
    material,
    256
  );
}

async function importAesKey(keyBytes) {
  return crypto.subtle.importKey('raw', keyBytes, { name: CIPHER }, false, ['encrypt', 'decrypt']);
}

async function encryptBytes(plaintext, key) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: CIPHER, iv }, key, plaintext);
  return {
    cipher: CIPHER,
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(ciphertext))
  };
}

function assertLegacyMetadata(blob) {
  if (
    blob.kdf?.name !== KDF.name ||
    blob.kdf?.iterations !== KDF.iterations ||
    blob.kdf?.hash !== KDF.hash ||
    blob.cipher !== CIPHER
  ) {
    throw new Error('Legacy encrypted vault metadata is not supported');
  }
}

function assertVaultPayload(value) {
  if (
    typeof value !== 'object' ||
    value === null ||
    typeof value.version !== 'number' ||
    !Array.isArray(value.accounts)
  ) {
    throw new Error('Vault payload is invalid');
  }
  return value;
}

function fromBase64(value) {
  return Uint8Array.from(Buffer.from(value, 'base64'));
}

function toBase64(bytes) {
  return Buffer.from(bytes).toString('base64');
}

function bytesEqual(left, right) {
  if (left.length !== right.length) {
    return false;
  }
  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left[index] ^ right[index];
  }
  return result === 0;
}
