export interface WebAuthnUnlockCredential {
  credentialId: string;
  createdAt: string;
}

const AUTHENTICATOR_TIMEOUT_MS = 60_000;

export function isWebAuthnUnlockSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof PublicKeyCredential !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    Boolean(navigator.credentials?.create) &&
    Boolean(navigator.credentials?.get)
  );
}

export async function registerWebAuthnUnlock(): Promise<WebAuthnUnlockCredential> {
  ensureSupported();

  const credential = await navigator.credentials.create({
    publicKey: {
      challenge: createChallenge(),
      rp: { name: '身份验证器' },
      user: {
        id: createChallenge(16),
        name: 'local-user',
        displayName: '本机解锁'
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 }
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        residentKey: 'preferred',
        userVerification: 'required'
      },
      timeout: AUTHENTICATOR_TIMEOUT_MS,
      attestation: 'none'
    }
  });

  if (!(credential instanceof PublicKeyCredential)) {
    throw new Error('Windows Hello 未完成。');
  }

  return {
    credentialId: encodeBase64Url(credential.rawId),
    createdAt: new Date().toISOString()
  };
}

export async function verifyWebAuthnUnlock(credentialId: string): Promise<void> {
  ensureSupported();

  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: createChallenge(),
      allowCredentials: [
        {
          id: decodeBase64Url(credentialId),
          type: 'public-key'
        }
      ],
      userVerification: 'required',
      timeout: AUTHENTICATOR_TIMEOUT_MS
    }
  });

  if (!(assertion instanceof PublicKeyCredential)) {
    throw new Error('Windows Hello 验证失败。');
  }
}

function ensureSupported() {
  if (!isWebAuthnUnlockSupported()) {
    throw new Error('当前浏览器不支持 Windows Hello 解锁。');
  }
}

function createChallenge(length = 32): ArrayBuffer {
  const challenge = new Uint8Array(length);
  crypto.getRandomValues(challenge);
  return challenge.buffer;
}

function encodeBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function decodeBase64Url(value: string): ArrayBuffer {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes.buffer;
}
