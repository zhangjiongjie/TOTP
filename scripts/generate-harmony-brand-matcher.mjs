import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dataPath = path.join(root, 'packages/totp-core/src/icons/icon-matchers-data.json');
const outputPath = path.join(root, 'apps/harmony-app/entry/src/main/ets/services/BrandIconMatcher.ets');

const iconMatchers = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

const lines = [
  '// Generated from packages/totp-core/src/icons/icon-matchers-data.json.',
  '// Run npm run generate:harmony-brand-matcher after changing brand rules.',
  '',
  'export function resolveIconKey(issuer: string, accountName: string): string {',
  '  let candidates: string[] = [issuer.trim().toLowerCase(), accountName.trim().toLowerCase()];',
  '  for (let index: number = 0; index < candidates.length; index++) {',
  '    let resolvedKey: string = resolveCandidate(candidates[index]);',
  "    if (resolvedKey !== 'default') {",
  '      return resolvedKey;',
  '    }',
  '  }',
  '',
  "  return 'default';",
  '}',
  '',
  'export function resolveDisplayBrandKey(iconKey: string, issuer: string, accountName: string): string {',
  '  let recognizedKey: string = resolveIconKey(issuer, accountName);',
  "  if (recognizedKey !== 'default') {",
  '    return recognizedKey;',
  '  }',
  '',
  "  return 'default';",
  '}',
  '',
  'function resolveCandidate(candidate: string): string {',
  '  if (candidate.length === 0) {',
  "    return 'default';",
  '  }'
];

for (const matcher of iconMatchers) {
  const conditions = matcher.patterns.map((pattern) => createCondition(pattern)).join(' || ');
  lines.push(`  if (${conditions}) {`);
  lines.push(`    return '${matcher.key}';`);
  lines.push('  }');
}

lines.push(
  '',
  "  return 'default';",
  '}',
  '',
  'function containsWord(text: string, word: string): boolean {',
  '  let index: number = text.indexOf(word);',
  '  while (index >= 0) {',
  "    let before: string = index > 0 ? text.substring(index - 1, index) : '';",
  '    let afterIndex: number = index + word.length;',
  "    let after: string = afterIndex < text.length ? text.substring(afterIndex, afterIndex + 1) : '';",
  '    if (!isWordCharacter(before) && !isWordCharacter(after)) {',
  '      return true;',
  '    }',
  '    index = text.indexOf(word, index + 1);',
  '  }',
  '  return false;',
  '}',
  '',
  'function containsWordSequence(text: string, sequence: string): boolean {',
  '  let normalizedText: string = normalizeSeparators(text);',
  '  let normalizedSequence: string = normalizeSeparators(sequence);',
  '  return normalizedText.indexOf(normalizedSequence) >= 0;',
  '}',
  '',
  'function normalizeSeparators(text: string): string {',
  "  return text.replace(/[^a-z0-9]+/g, ' ').trim();",
  '}',
  '',
  'function isWordCharacter(value: string): boolean {',
  '  return value.length > 0 && /[a-z0-9_]/.test(value);',
  '}',
  ''
);

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, lines.join('\n'), 'utf8');
console.log(`Generated ${path.relative(root, outputPath)}`);

function createCondition(pattern) {
  const value = JSON.stringify(pattern.value.toLowerCase());
  switch (pattern.type) {
    case 'contains':
      return `candidate.indexOf(${value}) >= 0`;
    case 'exact':
      return `candidate === ${value}`;
    case 'word':
      return `containsWord(candidate, ${value})`;
    case 'wordSequence':
      return `containsWordSequence(candidate, ${value})`;
    default:
      throw new Error(`Unsupported matcher pattern type: ${pattern.type}`);
  }
}
