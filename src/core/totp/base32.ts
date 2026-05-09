import { InvalidBase32Error } from '../errors';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function decodeBase32(value: string): Uint8Array {
  const normalized = value.toUpperCase().replace(/[\s-]/g, '').replace(/=+$/g, '');

  if (!normalized) {
    throw new InvalidBase32Error('Base32 secret is empty.');
  }

  let bits = 0;
  let bitCount = 0;
  const bytes: number[] = [];

  for (const character of normalized) {
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

  return Uint8Array.from(bytes);
}
