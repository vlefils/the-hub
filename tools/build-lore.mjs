import { readFile, writeFile } from 'node:fs/promises';
import { renderLore, renderLoreWelcome } from './lore-html.mjs';
const file = new URL('../index.html', import.meta.url);
const html = await readFile(file, 'utf8');
const withWelcome = html.replace(/(<div class="long-copy tablet-copy">)[\s\S]*?(<\/div>)/, (_, open, close) => `${open}\n${renderLoreWelcome()}\n${close}`);
await writeFile(file, withWelcome.replace(/<!-- LORE:START[\s\S]*?<!-- LORE:END -->/, () => renderLore()));
console.log('Lore rebuilt: faction figures, individual location pages and local contacts.');
