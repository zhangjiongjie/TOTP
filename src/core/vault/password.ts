export const CURRENT_ENVELOPE_VERSION = 1;

export const CURRENT_KDF_CONFIG = {
  name: 'PBKDF2',
  iterations: 310_000,
  hash: 'SHA-256'
} as const;

export const CURRENT_CIPHER = 'AES-GCM' as const;

export async function deriveAesKey(password: string, salt: Uint8Array) {
  const material = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(new TextEncoder().encode(password)),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: CURRENT_KDF_CONFIG.name,
      salt: toArrayBuffer(salt),
      iterations: CURRENT_KDF_CONFIG.iterations,
      hash: CURRENT_KDF_CONFIG.hash
    },
    material,
    { name: CURRENT_CIPHER, length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function derivePasswordVerifier(
  password: string,
  salt: Uint8Array
): Promise<Uint8Array> {
  const material = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(new TextEncoder().encode(password)),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: CURRENT_KDF_CONFIG.name,
      salt: toArrayBuffer(salt),
      iterations: CURRENT_KDF_CONFIG.iterations,
      hash: CURRENT_KDF_CONFIG.hash
    },
    material,
    256
  );

  return new Uint8Array(bits);
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}
