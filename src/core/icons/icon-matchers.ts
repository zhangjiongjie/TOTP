import type { IconKey } from './icon-registry';

interface IconResolutionInput {
  issuer: string;
  accountName: string;
}

type IconMatcher = {
  key: IconKey;
  patterns: RegExp[];
};

const iconMatchers: IconMatcher[] = [
  { key: 'github', patterns: [/github/i] },
  { key: 'google', patterns: [/\bgoogle\b/i, /\bgmail\b/i] },
  { key: 'microsoft', patterns: [/\bmicrosoft\b/i, /\boutlook\b/i, /\bazure\b/i] },
  { key: 'slack', patterns: [/\bslack\b/i] },
  { key: 'openai', patterns: [/\bopenai\b/i, /\bchatgpt\b/i] }
];

export function resolveIconKey(
  input: IconResolutionInput
): IconKey | null {
  const candidates = [input.issuer, input.accountName]
    .map((value) => value.trim())
    .filter(Boolean);

  for (const candidate of candidates) {
    for (const matcher of iconMatchers) {
      if (matcher.patterns.some((pattern) => pattern.test(candidate))) {
        return matcher.key;
      }
    }
  }

  return null;
}
