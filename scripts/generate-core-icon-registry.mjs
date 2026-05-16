import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const assetsDir = path.join(root, 'packages/totp-core/src/icons/assets');
const outputPath = path.join(root, 'packages/totp-core/src/icons/icon-registry.ts');

const iconKeys = fs.readdirSync(assetsDir)
  .filter((fileName) => path.extname(fileName).toLowerCase() === '.svg')
  .map((fileName) => path.basename(fileName, '.svg'))
  .sort((left, right) => left.localeCompare(right));

const lines = [];
for (const key of iconKeys) {
  lines.push(`import ${toIdentifier(key)}Svg from './assets/${key}.svg?raw';`);
}

lines.push('', 'export const iconRegistry = {');
for (const key of iconKeys) {
  lines.push(`  ${JSON.stringify(key)}: ${toIdentifier(key)}Svg,`);
}

if (iconKeys.length > 0) {
  lines[lines.length - 1] = lines[lines.length - 1].replace(/,$/, '');
}

lines.push('} as const;', '', 'export type IconKey = keyof typeof iconRegistry;', '');

fs.writeFileSync(outputPath, lines.join('\n'), 'utf8');
console.log(`Generated ${path.relative(root, outputPath)} with ${iconKeys.length} SVG icons`);

function toIdentifier(key) {
  return key.replace(/(^|[^a-zA-Z0-9]+)([a-zA-Z0-9])/g, (_match, _separator, value) => value.toUpperCase())
    .replace(/^[A-Z]/, (value) => value.toLowerCase());
}
