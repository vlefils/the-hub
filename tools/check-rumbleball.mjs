// Run serially and bound each process, including assertion failures on DOM trees.
import { spawn } from 'node:child_process';
import { setPriority, constants } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2), pattern = args.find(arg => arg.startsWith('--name='))?.slice(7), skip = args.find(arg => arg.startsWith('--skip='))?.slice(7);
const keepGoing = args.includes('--keep-going'), failures = [];
for (const arg of args) if (arg.startsWith('--') && !arg.startsWith('--name=') && !arg.startsWith('--skip=') && arg !== '--keep-going') throw new Error(`Unknown option: ${arg}`);
const files = args.filter(arg => !arg.startsWith('--'));
let current;
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { current?.kill(); process.exit(130); });
if (!files.length) { console.error('Usage: node tools/check-rumbleball.mjs rumbleball/file.test.mjs [...]'); process.exit(1); }
for (const file of files) {
  if (!/^rumbleball[\/\\].+\.test\.mjs$/.test(file) || file.includes('..')) throw new Error('Only Rumbleball test files are accepted.');
  console.log(`Checking ${file}`);
  const child = current = spawn(process.execPath, ['--max-old-space-size=256', '--test', '--test-isolation=none', '--test-concurrency=1', '--test-force-exit', '--test-reporter=spec', ...(pattern ? ['--test-name-pattern', pattern] : []), ...(skip ? ['--test-skip-pattern', skip] : []), resolve(root, file)], { cwd: root, stdio: 'inherit', windowsHide: true });
  try { setPriority(child.pid, constants.priority.PRIORITY_BELOW_NORMAL); } catch { /* Some hosts do not permit scheduling changes. */ }
  const timer = setTimeout(() => { console.error(`Stopped ${file}: 60 second limit.`); child.kill(); }, 60_000);
  const code = await new Promise((done, reject) => { child.once('error', reject); child.once('exit', done); });
  clearTimeout(timer);
  current = null;
  if (code !== 0) { failures.push(file); if (!keepGoing) process.exit(typeof code === 'number' ? code : 1); }
}
if (failures.length) { console.error(`Failed files: ${failures.join(', ')}`); process.exit(1); }
