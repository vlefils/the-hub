// Read-only provenance check before any build-time translation of published copy.
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const files = ['index.html', 'script.js', 'catalogue.js', 'playtest-notes.js', 'data/catalogue.json', 'rumbleball/index.html', 'rumbleball/multi.html'];
async function walk(path) {
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const file = `${path}/${entry.name}`;
    if (entry.isDirectory() && !['assets', 'playtests', 'test-support'].includes(entry.name)) await walk(file);
    if (entry.isFile() && entry.name.endsWith('.mjs') && !entry.name.includes('.test.')) files.push(file);
  }
}
await walk('rumbleball');
const hash = input => createHash('sha256').update(input.replace(/\r\n/g, '\n')).digest('hex');
const results = []; let cursor = 0;
async function check() {
  while (cursor < files.length) {
    const path = files[cursor++];
    const committed = execFileSync('git', ['show', `HEAD:${path}`], { encoding: 'utf8', maxBuffer: 10_000_000 });
    // Anonymous raw URL: no connector, auth header or local content is sent.
    const response = await fetch(`https://raw.githubusercontent.com/vlefils/the-hub/main/${path}`, { signal: AbortSignal.timeout(30000) });
    const published = await response.text();
    results.push({ path, status: response.status, matchesPublished: response.ok && hash(committed) === hash(published), sha256: hash(committed) });
  }
}
await Promise.all([check(), check(), check(), check()]);
const report = { repository: 'https://github.com/vlefils/the-hub', access: 'anonymous', checked: results.length, allPublished: results.every(r => r.matchesPublished), files: results };
await writeFile('.local/translation-public-source-audit.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify({ checked: report.checked, allPublished: report.allPublished, mismatches: results.filter(r => !r.matchesPublished).map(r => r.path) }));
