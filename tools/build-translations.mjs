// Build-time only. No remote translation is ever requested by the website.
// Setup: npm install --prefix .local/lore-tooling --no-audit --no-fund acorn
// Extract only: node tools/build-translations.mjs --extract
// Refresh dictionary: node tools/build-translations.mjs
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve, relative } from 'node:path';
import { factions, people } from '../data/lore.mjs';
import { loreEnglish } from '../data/lore.en.mjs';
import { musicEnglish } from '../data/music.mjs';
import { factionNamesEnglish, translateFactionNames } from '../data/lore-english-names.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const publishedOnly = process.argv.includes('--published-only');
let publishedHashes;
if (publishedOnly) {
  const audit = JSON.parse(await readFile(resolve(root, '.local/translation-public-source-audit.json'), 'utf8'));
  if (!audit.allPublished) throw new Error('Public provenance audit must pass first.');
  publishedHashes = new Map(audit.files.map(file => [file.path, file.sha256]));
}
const sourceFile = path => {
  if (!publishedOnly) return readFile(resolve(root, path), 'utf8');
  const name = path.replaceAll('\\', '/');
  const content = execFileSync('git', ['show', `HEAD:${name}`], { cwd: root, encoding: 'utf8', maxBuffer: 10_000_000 });
  const hash = createHash('sha256').update(content.replace(/\r\n/g, '\n')).digest('hex');
  if (publishedHashes.get(name) !== hash) throw new Error(`Re-run public provenance audit for ${name}.`);
  return content;
};
const require = createRequire(import.meta.url);
const { parse } = require(resolve(root, '.local/lore-tooling/node_modules/acorn'));
const norm = s => s.replace(/\s+/g, ' ').trim();
const entity = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', ndash: '–', mdash: '—', hellip: '…', times: '×', middot: '·', rarr: '→', divide: '÷', plusmn: '±', le: '≤', ge: '≥', agrave: 'à', acirc: 'â', auml: 'ä', eacute: 'é', egrave: 'è', ecirc: 'ê', euml: 'ë', icirc: 'î', iuml: 'ï', ocirc: 'ô', ouml: 'ö', ugrave: 'ù', ucirc: 'û', uuml: 'ü', ccedil: 'ç', oelig: 'œ', OElig: 'Œ', Agrave: 'À', Eacute: 'É', Ecirc: 'Ê', Ccedil: 'Ç' };
const decode = s => s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (all, key) => key.startsWith('#') ? String.fromCodePoint(key[1].toLowerCase() === 'x' ? parseInt(key.slice(2), 16) : +key.slice(1)) : entity[key] ?? all);
const strings = new Set(), templates = new Set();
const natural = s => /\p{L}/u.test(s) && !/^(?:https?:|\.\.?\/|#|assets\/|image\/|text\/|application\/)/.test(s) && !/^[\w/-]+\.(?:mjs|js|json|png|webp|jpg|css|html|svg|woff2?)\b/.test(s) && !/^\.[\w:.[\]="'-]+$/.test(s) && (s.includes(' ') || /[À-ÿŒœ]/.test(s) || /^\p{Lu}[\p{L}-]+$/u.test(s));
const add = input => {
  const s = norm(decode(input));
  if (!s || s.length > 15000 || !natural(s)) return;
  (s.includes('{{') ? templates : strings).add(s);
};
const html = input => {
  const clean = input.replace(/<!--[\s\S]*?-->|<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>/gi, '');
  for (const match of clean.matchAll(/(?:^|>)([^<>]+)(?=<|$)/g)) add(match[1]);
  for (const match of clean.matchAll(/(?:aria-label|aria-description|aria-valuetext|title|placeholder|alt|content)\s*=\s*(["'])(.*?)\1/gs)) add(match[2]);
  for (const match of clean.matchAll(/<textarea\b[^>]*>([\s\S]*?)<\/textarea>/gi)) match[1].split(/\r?\n/).forEach(add);
};
const flatten = node => node.type === 'Literal' && typeof node.value === 'string' ? [node.value] : node.type === 'BinaryExpression' && node.operator === '+' ? [...flatten(node.left), ...flatten(node.right)] : [null];
const code = (input, file) => {
  let tree;
  try { tree = parse(input, { ecmaVersion: 'latest', sourceType: 'module' }); } catch (error) { throw new Error(`${file}: ${error.message}`); }
  const walk = (node, parent, key) => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'Literal' && typeof node.value === 'string' && !(parent?.type === 'Property' && key === 'key') && !['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration'].includes(parent?.type)) {
      if (/<[a-z!/]/i.test(node.value)) html(node.value); else node.value.split(/\n\s*\n/).forEach(add);
    }
    if (node.type === 'TemplateLiteral') {
      const text = node.quasis.map((q, i) => (q.value.cooked || '') + (i < node.expressions.length ? `{{${i}}}` : '')).join('');
      if (/<[a-z!/]/i.test(text)) html(text); else text.split(/\n\s*\n/).forEach(add);
      node.quasis.forEach(q => { if (q.value.cooked && !/[<>]/.test(q.value.cooked)) add(q.value.cooked); });
    }
    if (node.type === 'BinaryExpression' && node.operator === '+' && !(parent?.type === 'BinaryExpression' && parent.operator === '+')) {
      let index = 0; const parts = flatten(node);
      if (parts.some(p => typeof p === 'string' && natural(p))) add(parts.map(p => p ?? `{{${index++}}}`).join(''));
    }
    for (const [childKey, child] of Object.entries(node)) {
      if (Array.isArray(child)) child.forEach(item => walk(item, node, childKey));
      else if (child && typeof child === 'object' && child.type) walk(child, node, childKey);
    }
  }; walk(tree);
};
for (const file of ['index.html', 'rumbleball/index.html', 'rumbleball/multi.html']) html(await sourceFile(file));
for (const file of ['script.js', 'catalogue.js', 'playtest-notes.js', ...(publishedOnly ? [] : ['lore.js'])]) code(await sourceFile(file), file);
async function modules(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && !['assets', 'playtests', 'test-support'].includes(entry.name)) await modules(resolve(dir, entry.name));
    if (entry.isFile() && entry.name.endsWith('.mjs') && !entry.name.includes('.test.')) { const file = relative(root, resolve(dir, entry.name)); code(await sourceFile(file), file); }
  }
}
await modules(resolve(root, 'rumbleball'));
const values = value => { if (typeof value === 'string') value.split(/\n\s*\n/).forEach(add); else if (Array.isArray(value)) value.forEach(values); else if (value && typeof value === 'object') Object.values(value).forEach(values); };
values(JSON.parse(await sourceFile('data/catalogue.json')));
await mkdir(resolve(root, 'i18n'), { recursive: true });
const all = [...strings, ...templates];
await writeFile(resolve(root, publishedOnly ? '.local/published-source-strings.json' : 'i18n/source-strings.json'), JSON.stringify({ texts: [...strings], templates: [...templates] }, null, 2) + '\n');
console.log(`Extracted ${strings.size} texts and ${templates.size} templates (${all.join('').length} characters).`);
if (process.argv.includes('--extract')) process.exit(0);
let cache = {};
try { cache = JSON.parse(await readFile(resolve(root, '.local/en-cache.json'), 'utf8')); }
catch {
  try { const previous = JSON.parse(await readFile(resolve(root, 'i18n/en.json'), 'utf8')); cache = { ...previous.texts, ...Object.fromEntries(previous.templates) }; }
  catch { /* First build. */ }
}
for (const [fr, en] of Object.entries(cache)) cache[norm(decode(fr))] ??= en;
const glossary = {
  'The Hub': 'The Hub', 'Paradise': 'Paradise', 'Chroma': 'Chroma',
  ...factionNamesEnglish, 'Bastion': 'Bastion',
  'Helix Genomics': 'Helix Genomics', 'Synapse': 'Synapse', 'Blackridge Capital': 'Blackridge Capital', 'Velvet': 'Velvet',
  'Gâchette': 'Gunner', 'Gachette': 'Gunner', 'Ferrailleur': 'Scrapper', 'Dopeur': 'Booster', 'Brute': 'Brute', 'Runner': 'Runner', 'Neuro': 'Neuro',
  'Le Grand Soir': 'Le Grand Soir', 'Rumbleball': 'Rumbleball',
  ...Object.fromEntries(people.map(p => [p.name, p.name])),
};
const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const terms = Object.keys(glossary).sort((a, b) => b.length - a.length);
const termPattern = new RegExp(terms.map(escape).join('|'), 'g');
const protect = s => {
  const saved = [];
  const text = s.replace(termPattern, term => { const id = saved.length; saved.push(glossary[term]); return `ZXQ${id}QXZ`; });
  return { text, restore: value => value.replace(/ZXQ\s*(\d+)\s*QXZ/gi, (_, id) => saved[+id] ?? '').replace(/\{\{\s*(\d+)\s*\}\}/g, '{{$1}}') };
};
const overrides = {
  'Règles': 'Rules', 'Regles': 'Rules', 'Personnage': 'Character', 'Outils': 'Tools', 'PNJ': 'NPCs', 'MJ': 'GM', 'PJ': 'PC',
  'PV': 'HP', 'CA': 'AC', 'DD': 'DC', 'Dextérité': 'Dexterity', 'Dexterite': 'Dexterity', 'Vigueur': 'Vigor', 'Sang-froid': 'Composure',
  'Fiche PJ': 'Character sheet', 'Force': 'Strength', 'Esprit': 'Mind', 'Aller à…': 'Jump to…', 'Bientôt': 'Coming soon', 'Bientot': 'Coming soon',
  'Lore': 'Lore', 'Lore / Factions': 'Lore / Factions', 'Tonalité': 'Tone', 'Tonalite': 'Tone', 'Catalogue complet': 'Full catalogue',
  'Ce qu’il propose': 'What they offer', 'L’aborder': 'Approaching them', 'Secret · réservé au MJ': 'Secret · GM only',
  'Mêlée': 'Melee', 'Melee': 'Melee', 'Soin': 'Healing', 'Dégâts': 'Damage', 'Degats': 'Damage', 'Jet': 'Roll',
  'Corps': 'Body', 'Nerfs': 'Nerves', 'Chair': 'Flesh', 'Acier': 'Steel', 'Plomb': 'Lead', 'Viseur': 'Marksman',
  'Pirate': 'Hacker', 'Fixeur': 'Fixer', 'Tueur': 'Killer', 'Dose': 'Dose', 'Scalpel': 'Scalpel',
  'Lire le dossier': 'Read dossier', 'Zones neutres': 'Neutral areas', 'Toutes les influences': 'All influences', 'Influence': 'Influence',
};
for (const term of terms) overrides[term] = glossary[term];
Object.assign(overrides, loreEnglish);
Object.assign(overrides, musicEnglish);
const pending = all.filter(s => cache[s] == null && overrides[s] == null);
const batches = []; let batch = [], length = 0;
for (const text of pending) { if (length + text.length > 3200 && batch.length) { batches.push(batch); batch = []; length = 0; } batch.push(text); length += text.length + 30; } if (batch.length) batches.push(batch);
console.log(`${pending.length} uncached entries; ${publishedOnly ? batches.length + ' public translation batches' : 'offline compilation'}.`);
const sleep = ms => new Promise(r => setTimeout(r, ms));
let cursor = 0, done = 0;
async function worker() {
  while (cursor < batches.length) {
    const n = cursor++, entries = batches[n], protectedEntries = entries.map(protect);
    const query = protectedEntries.map((p, i) => `⟦${String(i).padStart(5, '0')}⟧\n${p.text}`).join('\n\n');
    let success = false;
    for (let attempt = 0; attempt < 5 && !success; attempt++) {
      try {
        const url = new URL('https://translate.googleapis.com/translate_a/single');
        url.search = new URLSearchParams({ client: 'gtx', sl: 'fr', tl: 'en', dt: 't', q: query });
        const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const result = await response.json();
        const combined = result[0].map(s => s[0] || '').join('');
        const marks = [...combined.matchAll(/⟦\s*(\d+)\s*⟧/g)];
        if (marks.length !== entries.length) throw new Error(`Lost delimiters (${marks.length}/${entries.length})`);
        for (let i = 0; i < marks.length; i++) {
          const id = +marks[i][1];
          const translated = norm(combined.slice(marks[i].index + marks[i][0].length, marks[i + 1]?.index ?? combined.length));
          const restored = protectedEntries[id].restore(translated);
          const tokens = s => [...s.matchAll(/\{\{(\d+)\}\}/g)].map(m => m[1]).sort().join(',');
          if (tokens(entries[id]) !== tokens(restored)) throw new Error(`Lost interpolation: ${entries[id].slice(0, 60)}`);
          cache[entries[id]] = restored;
        }
        success = true; done++;
        await writeFile(resolve(root, '.local/en-cache.json'), JSON.stringify(cache, null, 2) + '\n');
        if (done % 10 === 0 || done === batches.length) console.log(`${done}/${batches.length} batches complete.`);
        await sleep(250);
      } catch (error) { console.log(`Batch ${n + 1}, attempt ${attempt + 1}: ${error.message}`); await sleep(1000 * (attempt + 1)); }
    }
    if (!success) throw new Error(`Batch ${n + 1} failed. Cache saved; rerun to resume.`);
  }
}
if (publishedOnly && !process.argv.includes('--compile-only')) await Promise.all([worker(), worker()]);
const polish = (fr, en) => {
  let result = en.replace(/\bPV\b/g, 'HP').replace(/\bCA\b/g, 'AC').replace(/\bDD\b/g, 'DC');
  result = result.replace(/\bDexterit[eé]\b/g, 'Dexterity').replace(/\bCharisme\b/g, 'Charisma');
  if (/\bEsprit\b/.test(fr)) result = result.replace(/\bSpirit\b/g, 'Mind').replace(/\bspirit\b/g, 'Mind');
  if (/ma[iî]trise/i.test(fr)) result = result.replace(/\bmasteries\b/gi, 'proficiencies').replace(/\bmastery\b/gi, 'proficiency');
  if (/(?:jet|competence|compétence|aux sauvegardes|sauvegarde.*(?:Force|Dexter|Esprit|Constitution|Charisme|degat|dégât|créature|creature))/i.test(fr)) result = result.replace(/\bbackups\b/gi, 'saving throws').replace(/\bbackup\b/gi, 'saving throw');
  result = result.replace(/\bmastery bonus\b/gi, 'proficiency bonus').replace(/\blife points\b/gi, 'hit points');
  if (/\bViseur\b/.test(fr)) result = result.replace(/\bviewfinder\b/gi, 'Marksman');
  return result;
};
// Authored lore is already edited: heuristic fixes for cached translations can
// confuse memory backups with saving throws inside otherwise correct prose.
const translated = s => loreEnglish[s] ?? translateFactionNames(polish(s, overrides[s] ?? cache[s] ?? s));
const dictionary = { texts: { ...overrides, ...Object.fromEntries([...strings].map(s => [s, translated(s)])) }, templates: [...templates].map(s => [s, translated(s)]) };
const missing = all.filter(s => cache[s] == null && overrides[s] == null);
await writeFile(resolve(root, '.local/translation-coverage.json'), JSON.stringify({ total: all.length, missing }, null, 2));
await writeFile(resolve(root, 'i18n/en.js'), `// Generated offline translations; see tools/build-translations.mjs.\nwindow.HUB_EN = ${JSON.stringify(dictionary)};\n`);
await writeFile(resolve(root, 'i18n/en.json'), JSON.stringify(dictionary, null, 2) + '\n');
console.log(`English dictionary written: ${Object.keys(dictionary.texts).length} texts and ${dictionary.templates.length} templates.`);
if (missing.length) console.log(`Uncached entries requiring review: ${missing.length}. See .local/translation-coverage.json.`);
