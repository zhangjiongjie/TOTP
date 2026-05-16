import type { IconKey } from './icon-registry';
import iconMatcherData from './icon-matchers-data.json';

interface IconResolutionInput {
  issuer: string;
  accountName: string;
}

type IconMatcher = {
  key: IconKey;
  patterns: IconPattern[];
};

type IconPatternType = 'contains' | 'exact' | 'word' | 'wordSequence';

type IconPattern = {
  type: IconPatternType;
  value: string;
};

const iconMatchers: IconMatcher[] = iconMatcherData as IconMatcher[];

export function resolveIconKey(
  input: IconResolutionInput
): IconKey {
  const candidates = [input.issuer, input.accountName]
    .map((value) => value.trim())
    .filter(Boolean);

  for (const candidate of candidates) {
    for (const matcher of iconMatchers) {
      if (matcher.patterns.some((pattern) => matchesPattern(candidate, pattern))) {
        return matcher.key;
      }
    }
  }

  return 'default';
}

function matchesPattern(candidate: string, pattern: IconPattern): boolean {
  const normalizedCandidate = candidate.toLowerCase();
  const normalizedValue = pattern.value.toLowerCase();

  switch (pattern.type) {
    case 'contains':
      return normalizedCandidate.includes(normalizedValue);
    case 'exact':
      return normalizedCandidate === normalizedValue;
    case 'word':
      return containsWord(normalizedCandidate, normalizedValue);
    case 'wordSequence':
      return normalizeSeparators(normalizedCandidate).includes(normalizeSeparators(normalizedValue));
    default:
      return false;
  }
}

function containsWord(text: string, word: string): boolean {
  let index = text.indexOf(word);
  while (index >= 0) {
    const before = index > 0 ? text[index - 1] : '';
    const after = index + word.length < text.length ? text[index + word.length] : '';
    if (!isWordCharacter(before) && !isWordCharacter(after)) {
      return true;
    }
    index = text.indexOf(word, index + 1);
  }
  return false;
}

function normalizeSeparators(text: string): string {
  return text.replace(/[^a-z0-9]+/g, ' ').trim();
}

function isWordCharacter(value: string): boolean {
  return value.length > 0 && /[a-z0-9_]/.test(value);
}
