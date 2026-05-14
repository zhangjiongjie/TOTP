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
  { key: 'apple', patterns: [/\bapple\b/i, /\bicloud\b/i] },
  { key: 'discord', patterns: [/\bdiscord\b/i] },
  { key: 'dropbox', patterns: [/\bdropbox\b/i] },
  { key: 'github', patterns: [/github/i] },
  { key: 'google', patterns: [/\bgoogle\b/i, /\bgmail\b/i] },
  { key: 'linkedin', patterns: [/\blinkedin\b/i] },
  { key: 'microsoft', patterns: [/\bmicrosoft\b/i, /\boutlook\b/i, /\bazure\b/i] },
  { key: 'notion', patterns: [/\bnotion\b/i] },
  { key: 'onedrive', patterns: [/\bonedrive\b/i] },
  { key: 'slack', patterns: [/\bslack\b/i] },
  { key: 'openai', patterns: [/\bopenai\b/i, /\bchatgpt\b/i] },
  { key: 'spotify', patterns: [/\bspotify\b/i] },
  { key: 'telegram', patterns: [/\btelegram\b/i] },
  { key: 'x', patterns: [/^x$/i, /\btwitter\b/i] }
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
