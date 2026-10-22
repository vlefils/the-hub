// Compare deterministic full matches with a git-archived baseline, in one
// bounded process. Usage: node --max-old-space-size=256 tools/rumbleball-performance-check.mjs <baseline-rumbleball-dir> [report.json]
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { setPriority, constants } from 'node:os';
import { simulateMatch } from '../rumbleball/engine.mjs';
try { setPriority(process.pid, constants.priority.PRIORITY_BELOW_NORMAL); } catch {}
if (!process.argv[2]) throw new Error('Pass the baseline rumbleball directory');
const baseline = await import(pathToFileURL(resolve(process.argv[2], 'engine.mjs')).href);
const configs = Array.from({ length: 12 }, (_, n) => ({ seed: `performance-${n}`, rulesVersion: [4, 5, 6, 7, 8][n % 5],
  strategy: ['balanced', 'possession', 'pressing'][n % 3], awayStrategy: ['pressing', 'balanced', 'possession'][n % 3] }));
baseline.simulateMatch({ seed: 'warm-performance' }); simulateMatch({ seed: 'warm-performance' });
const results = [], started = performance.now();
for (const [index, config] of configs.entries()) {
  if (performance.now() - started > 55000) throw new Error('55 second benchmark budget exceeded');
  let oldResult, next, oldMs, newMs;
  const old = () => { const at = performance.now(); oldResult = baseline.simulateMatch(config); oldMs = performance.now() - at; };
  const current = () => { const at = performance.now(); next = simulateMatch(config); newMs = performance.now() - at; };
  if (index % 2) { current(); old(); } else { old(); current(); }
  // Compare every event and final field, including RNG, not just the winner.
  assert.deepEqual(next, oldResult);
  results.push({ seed: config.seed, version: config.rulesVersion, turns: next.state.turns, oldMs, newMs });
}
const oldMs = results.reduce((n, row) => n + row.oldMs, 0), newMs = results.reduce((n, row) => n + row.newMs, 0);
const report = { matches: results.length, identical: true, node: process.version, oldMs, newMs, speedup: oldMs / newMs, results };
if (process.argv[3]) await writeFile(process.argv[3], JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
