const BASE64_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function encodeBase64(bytes: Uint8Array): string {
  const binary = bytesToBinary(bytes);

  if (typeof globalThis.btoa === 'function') {
    return globalThis.btoa(binary);
  }

  let output = '';

  for (let index = 0; index < bytes.length; index += 3) {
    const a = bytes[index] ?? 0;
    const b = bytes[index + 1] ?? 0;
    const c = bytes[index + 2] ?? 0;
    const triplet = (a << 16) | (b << 8) | c;

    output += BASE64_ALPHABET[(triplet >> 18) & 0x3f];
    output += BASE64_ALPHABET[(triplet >> 12) & 0x3f];
    output += index + 1 < bytes.length ? BASE64_ALPHABET[(triplet >> 6) & 0x3f] : '=';
    output += index + 2 < bytes.length ? BASE64_ALPHABET[triplet & 0x3f] : '=';
  }

  return output;
}

export function decodeBase64(value: string): Uint8Array {
  if (!isValidBase64(value)) {
    throw new Error('Invalid base64');
  }

  const normalized = value.replace(/\s+/g, '');

  if (typeof globalThis.atob === 'function') {
    return binaryToBytes(globalThis.atob(normalized));
  }

  const paddingLength = normalized.endsWith('==') ? 2 : normalized.endsWith('=') ? 1 : 0;
  const outputLength = (normalized.length / 4) * 3 - paddingLength;
  const output = new Uint8Array(outputLength);
  let offset = 0;

  for (let index = 0; index < normalized.length; index += 4) {
    const a = decodeBase64Character(normalized[index]);
    const b = decodeBase64Character(normalized[index + 1]);
    const c = normalized[index + 2] === '=' ? 0 : decodeBase64Character(normalized[index + 2]);
    const d = normalized[index + 3] === '=' ? 0 : decodeBase64Character(normalized[index + 3]);
    const triplet = (a << 18) | (b << 12) | (c << 6) | d;

    output[offset++] = (triplet >> 16) & 0xff;

    if (normalized[index + 2] !== '=') {
      output[offset++] = (triplet >> 8) & 0xff;
    }

    if (normalized[index + 3] !== '=') {
      output[offset++] = triplet & 0xff;
    }
  }

  return output;
}

function isValidBase64(value: string): boolean {
  const normalized = value.replace(/\s+/g, '');

  if (normalized.length === 0 || normalized.length % 4 !== 0) {
    return false;
  }

  return /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
    normalized
  );
}

function decodeBase64Character(character: string): number {
  const index = BASE64_ALPHABET.indexOf(character);

  if (index === -1) {
    throw new Error('Invalid base64');
  }

  return index;
}

function bytesToBinary(bytes: Uint8Array): string {
  let output = '';

  for (const byte of bytes) {
    output += String.fromCharCode(byte);
  }

  return output;
}

function binaryToBytes(binary: string): Uint8Array {
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
