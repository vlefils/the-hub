// Optimize generated originals, preserving every panel; UI crops them with CSS.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let sharp;
try { sharp = require('sharp'); } catch { sharp = require('C:/Users/valentin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp'); }
const manifest = JSON.parse(await readFile(process.argv[2] || '.local/lore-art-sources.json', 'utf8'));
await mkdir('assets/lore', { recursive: true });
for (const item of manifest) {
  const output = resolve(`assets/lore/${item.id}.webp`);
  const result = await sharp(item.source).webp({ quality: 86, effort: 6 }).toFile(output);
  console.log(`${item.id}: ${result.width}×${result.height}, ${Math.round(result.size / 1024)} KB`);
}
await writeFile(process.argv[3] || 'assets/lore/prompts.json', JSON.stringify({ mode: 'Built-in image_gen', styleReferences: ['assets/landmarks/rules-combat.webp', 'assets/landmarks/rules-second-chance.webp'], assets: manifest.map(({ id, prompt }) => ({ file: `${id}.webp`, prompt })) }, null, 2) + '\n');
