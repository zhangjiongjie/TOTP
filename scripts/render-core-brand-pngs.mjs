import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Resvg } from '@resvg/resvg-js';

const repoRoot = process.cwd();
const sourceDir = path.join(repoRoot, 'packages', 'totp-core', 'src', 'icons', 'assets');
const androidDrawableDir = path.join(repoRoot, 'apps', 'android-app', 'app', 'src', 'main', 'res', 'drawable');
const iconSize = 256;

function renderSvgToPng(svgText) {
  return new Resvg(svgText, {
    fitTo: {
      mode: 'width',
      value: iconSize
    },
    background: 'rgba(0, 0, 0, 0)'
  }).render().asPng();
}

async function main() {
  const files = await readdir(sourceDir);
  const svgNames = files.filter((name) => name.endsWith('.svg')).sort();
  const existingPngs = new Set(files.filter((name) => name.endsWith('.png')));
  const missingPngNames = svgNames
    .map((name) => name.replace(/\.svg$/, '.png'))
    .filter((name) => !existingPngs.has(name));

  for (const pngName of missingPngNames) {
    const baseName = pngName.replace(/\.png$/, '');
    const svgText = await readFile(path.join(sourceDir, `${baseName}.svg`), 'utf8');
    await writeFile(path.join(sourceDir, pngName), renderSvgToPng(svgText));
  }

  await mkdir(androidDrawableDir, { recursive: true });
  const allPngNames = (await readdir(sourceDir)).filter((name) => name.endsWith('.png')).sort();
  for (const pngName of allPngNames) {
    await writeFile(
      path.join(androidDrawableDir, `brand_${pngName}`),
      await readFile(path.join(sourceDir, pngName))
    );
  }

  console.log(`Generated ${missingPngNames.length} core PNG files and synced ${allPngNames.length} Android drawable PNG files.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
