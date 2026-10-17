// Observe executed passes and relay movements, rather than counting AI proposals.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const moduleUrl = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const cache = new Map();
const source = (ref, file) => (ref === 'working' ? readFileSync(resolve(root, 'rumbleball', file), 'utf8')
  : execFileSync('git', ['show', `${ref}:rumbleball/${file}`], { cwd: root, encoding: 'utf8' })).replaceAll('\r\n', '\n');
function rewrite(text, ref, overrides = {}) {
  return text.replace(/from '(\.\/[^']+)'/g, (_, path) =>
    `from ${JSON.stringify(overrides[path] ?? snapshot(ref, path.slice(2)))}`);
}
function snapshot(ref, file) {
  const key = `${ref}:${file}`;
  if (!cache.has(key)) cache.set(key, moduleUrl(rewrite(source(ref, file), ref)));
  return cache.get(key);
}

const report = { baseline: '83e3981', scenarios: 24,
  workingSourcesSha256: Object.fromEntries(['ai.mjs', 'rules.mjs'].map((file) =>
    [file, createHash('sha256').update(source('working', file)).digest('hex')])), measurements: {} };
for (const ref of [report.baseline, 'working']) {
  const hookUrl = moduleUrl(`
    // Independent observations for ${ref}.
    import { distance, opponents, playerById } from ${JSON.stringify(snapshot(ref, 'rules.mjs'))};
    export const measurements = { passes: 0, reactionPasses: 0, adjacentReceivers: 0, markedReceivers: 0,
      pressuredPassers: 0, pressuredMobilePassers: 0, preparations: 0 };
    export const examples = [];
    export function observe(state, actor, action) {
      if (action.type === 'ready-pass') measurements.preparations++;
      if (action.type !== 'pass') return;
      const target = playerById(state, action.targetId);
      const adjacent = distance(actor.position, target.position) < 2;
      const marked = opponents(state, target).some(p => distance(p.position, target.position) <= 1);
      const pressured = opponents(state, actor).some(p => distance(p.position, actor.position) <= 1);
      const mobile = !action.reaction && !actor.grappledBy && !actor.grappling && actor.movement >= 1.5;
      measurements.passes++; measurements.reactionPasses += Number(Boolean(action.reaction));
      measurements.adjacentReceivers += Number(adjacent); measurements.markedReceivers += Number(marked);
      measurements.pressuredPassers += Number(pressured); measurements.pressuredMobilePassers += Number(pressured && mobile);
      if (examples.length < 4 && (adjacent || marked || pressured && mobile)) examples.push({ state: structuredClone(state), action });
    }
  `);
  const hook = await import(hookUrl);
  const marker = 'function resolveActionEvents(state, actor, action, events) {\n  if (!legalAction(state, actor, action)) return false;';
  const rules = source(ref, 'rules.mjs');
  assert.equal(rules.split(marker).length, 2, 'The observer must hook exactly one legal-action boundary.');
  const observedRules = moduleUrl(`import { observe } from ${JSON.stringify(hookUrl)};\n`
    + rewrite(rules.replace(marker, `${marker}\n  observe(state, actor, action);`), ref));
  const engine = await import(moduleUrl(rewrite(source(ref, 'engine.mjs'), ref, { './rules.mjs': observedRules })));
  const measurements = { matches: 0, turns: 0, completedPasses: 0, relayTurns: 0, relayMovementTurns: 0,
    relayReceptionsAfterMovement: 0, expiredPreparations: 0 };
  for (const strategy of ['balanced', 'possession', 'pressing']) for (let i = 0; i < 8; i++) {
    const config = { seed: `passing-audit-2026-10-17-${strategy}-${i}`, strategy, awayStrategy: strategy };
    const match = engine.simulateMatch(config, (state, events) => {
      const decision = events.find(e => e.type === 'decision');
      if (decision?.task === 'relay') {
        measurements.relayTurns++;
        const movement = events.findIndex(e => e.type === 'move' && e.playerId === decision.playerId);
        if (movement >= 0) {
          measurements.relayMovementTurns++;
          if (events.slice(movement + 1).some(e => e.type === 'ready-trigger' && e.targetId === decision.playerId)) measurements.relayReceptionsAfterMovement++;
        }
      }
      measurements.expiredPreparations += events.filter(e => e.type === 'ready-cancel' && e.reason === 'début de son prochain tour').length;
    });
    if (i === 0 && strategy === 'balanced') {
      const original = await import(snapshot(ref, 'engine.mjs'));
      assert.deepEqual(match, original.simulateMatch(config), 'Observation must not change events, state, or RNG.');
    }
    assert.equal(match.state.finished, true); measurements.matches++; measurements.turns += match.state.turns;
    measurements.completedPasses += match.state.stats.home.passesCompleted + match.state.stats.away.passesCompleted;
  }
  report.measurements[ref] = { ...measurements, ...hook.measurements };
  console.log(`${ref}: ${JSON.stringify(report.measurements[ref])}`);
  if (process.argv.includes('--examples')) writeFileSync(resolve(root, `output/passing-examples-${ref}.json`), JSON.stringify(hook.examples, null, 2));
}
assert.equal(report.measurements.working.markedReceivers, 0, 'AI passes must target an unmarked player.');
assert.ok(report.measurements.working.relayReceptionsAfterMovement > 0, 'Prepared passes must produce actual unmarking runs.');
writeFileSync(resolve(root, 'rumbleball/playtests/passing-audit-2026-10-17.json'), JSON.stringify(report, null, 2) + '\n');
