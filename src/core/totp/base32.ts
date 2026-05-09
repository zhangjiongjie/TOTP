import { InvalidBase32Error } from '../errors';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const VALID_UNPADDED_REMAINDERS = new Set([0, 2, 4, 5, 7]);
const VALID_PADDING_BY_REMAINDER = new Map<number, number>([
  [2, 6],
  [4, 4],
  [5, 3],
  [7, 1]
]);

export function decodeBase32(value: string): Uint8Array {
  const normalized = value.toUpperCase().replace(/[\s-]/g, '');

  if (!normalized) {
    throw new InvalidBase32Error('Base32 secret is empty.');
  }

  validateBase32Structure(normalized);

  const paddingStart = normalized.indexOf('=');
  const data = paddingStart === -1 ? normalized : normalized.slice(0, paddingStart);

  let bits = 0;
  let bitCount = 0;
  const bytes: number[] = [];

  for (const character of data) {
    const index = BASE32_ALPHABET.indexOf(character);

    if (index === -1) {
      throw new InvalidBase32Error(`Invalid Base32 character: ${character}`);
    }

    bits = (bits << 5) | index;
    bitCount += 5;

    if (bitCount >= 8) {
      bitCount -= 8;
      bytes.push((bits >>> bitCount) & 0xff);
    }
  }

  if (bitCount > 0) {
    const trailingMask = (1 << bitCount) - 1;
    if ((bits & trailingMask) !== 0) {
      throw new InvalidBase32Error('Base32 input has non-zero trailing bits.');
    }
  }

  return Uint8Array.from(bytes);
}

function validateBase32Structure(value: string): void {
  const paddingStart = value.indexOf('=');

  if (paddingStart === -1) {
    validateUnpaddedLength(value.length);
    return;
  }

  const dataLength = paddingStart;
  const padding = value.slice(paddingStart);

  if (!/^=+$/.test(padding)) {
    throw new InvalidBase32Error('Base32 padding must appear only at the end.');
  }

  if (value.length % 8 !== 0) {
    throw new InvalidBase32Error('Padded Base32 input must use full 8-character blocks.');
  }

  const remainder = dataLength % 8;
  const expectedPadding = VALID_PADDING_BY_REMAINDER.get(remainder);
  if (expectedPadding === undefined || padding.length !== expectedPadding) {
    throw new InvalidBase32Error('Invalid Base32 padding length.');
  }
}

function validateUnpaddedLength(length: number): void {
  if (!VALID_UNPADDED_REMAINDERS.has(length % 8)) {
    throw new InvalidBase32Error('Base32 input does not encode a whole number of bytes.');
  }
}
