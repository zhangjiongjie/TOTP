import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const sourceDir = path.join(root, 'packages/totp-core/src/icons/assets');
const targetDir = path.join(root, 'apps/harmony-app/entry/src/main/resources/base/media');
const resourceResolverPath = path.join(root, 'apps/harmony-app/entry/src/main/ets/services/BrandIconResources.ets');

const harmonyPreferredPng = new Set(['canva', 'default', 'google', 'instagram']);
const supportedExtensions = new Set(['.svg', '.png']);

const sourceFiles = fs.readdirSync(sourceDir)
  .filter((fileName) => supportedExtensions.has(path.extname(fileName).toLowerCase()));

const groupedAssets = new Map();
for (const fileName of sourceFiles) {
  const ext = path.extname(fileName).toLowerCase();
  const key = path.basename(fileName, ext);
  const current = groupedAssets.get(key);
  const shouldReplace = !current ||
    (harmonyPreferredPng.has(key) && ext === '.png') ||
    (!harmonyPreferredPng.has(key) && current.ext !== '.svg' && ext === '.svg');

  if (shouldReplace) {
    groupedAssets.set(key, { fileName, ext });
  }
}

fs.mkdirSync(targetDir, { recursive: true });

for (const fileName of fs.readdirSync(targetDir)) {
  if (fileName.startsWith('brand_') && supportedExtensions.has(path.extname(fileName).toLowerCase())) {
    fs.rmSync(path.join(targetDir, fileName));
  }
}

const copiedFiles = [];
for (const [key, asset] of [...groupedAssets.entries()].sort(([left], [right]) => left.localeCompare(right))) {
  const targetFileName = `brand_${key}${asset.ext}`;
  fs.copyFileSync(path.join(sourceDir, asset.fileName), path.join(targetDir, targetFileName));
  copiedFiles.push(targetFileName);
}

console.log(`Synced ${copiedFiles.length} Harmony brand assets from packages/totp-core/src/icons/assets`);

const resourceLines = [
  '// Generated from packages/totp-core/src/icons/assets.',
  '// Run npm run sync:harmony-brand-assets after changing brand assets.',
  '',
  'export function resolveBrandResource(brandKey: string): Resource {',
  '  switch (brandKey) {'
];

for (const [key] of [...groupedAssets.entries()].sort(([left], [right]) => left.localeCompare(right))) {
  if (key === 'default') {
    continue;
  }
  resourceLines.push(`    case '${key}':`);
  resourceLines.push(`      return $r('app.media.brand_${key}');`);
}

resourceLines.push(
  '    default:',
  "      return $r('app.media.brand_default');",
  '  }',
  '}',
  ''
);

fs.mkdirSync(path.dirname(resourceResolverPath), { recursive: true });
fs.writeFileSync(resourceResolverPath, resourceLines.join('\n'), 'utf8');
console.log(`Generated ${path.relative(root, resourceResolverPath)}`);
