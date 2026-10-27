import { readFile, writeFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const source = await readFile(new URL('index.html', root), 'utf8');
const switcher = source.match(/<div class="language-switch"[\s\S]*?<\/div>/)[0];
for (const path of ['rumbleball/index.html', 'rumbleball/multi.html']) {
  const file = new URL(path, root);
  let html = await readFile(file, 'utf8');
  if (!html.includes('../i18n-init.js')) html = html.replace('<head>', '<head>\n    <script src="../i18n-init.js"></script>\n    <link rel="stylesheet" href="../i18n.css">\n    <script src="../i18n/en.js" defer></script>\n    <script src="../i18n.js" defer></script>');
  if (!html.includes('class="language-switch"')) html = html.replace(/(<a class="rb-hub-link")/, () => `${switcher}\n      <a class="rb-hub-link"`);
  if (!html.includes('class="rb-header-end"')) html = html.replace(/(<div class="rb-account-tools"[^>]*><\/div>)\s*(<div class="language-switch"[\s\S]*?<\/div>)\s*(<a class="rb-hub-link"[\s\S]*?<\/a>)/, '<div class="rb-header-end">$2$1$3</div>');
  await writeFile(file, html);
}
