// Observation of actual decisions, with identical seeds before/after the fix.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = fileURLToPath(new URL('../', import.meta.url));
const moduleUrl = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const cache = new Map();
function source(ref, file) {
  return ref === 'working' ? readFileSync(resolve(root, 'rumbleball', file), 'utf8')
    : execFileSync('git', ['show', `${ref}:rumbleball/${file}`], { cwd: root, encoding: 'utf8' });
}
function rewrite(text, ref, overrides = {}) {
  return text.replace(/from '(\.\/[^']+)'/g, (_, path) =>
    `from ${JSON.stringify(overrides[path] ?? snapshot(ref, path.slice(2)))}`);
}
function snapshot(ref, file) {
  const key = `${ref}:${file}`;
  if (!cache.has(key)) cache.set(key, moduleUrl(rewrite(source(ref, file), ref)));
  return cache.get(key);
}

const report = { baseline: 'cffafe0', scenarios: 24,
  workingSourcesSha256: Object.fromEntries(['ai.mjs', 'rules.mjs'].map((file) =>
    [file, createHash('sha256').update(source('working', file).replaceAll('\r\n', '\n')).digest('hex')])), measurements: {} };
for (const ref of ['cffafe0', 'working']) {
  const hookUrl = moduleUrl(`
    import * as ai from ${JSON.stringify(snapshot(ref, 'ai.mjs'))};
    import { ballDefender, legalAction } from ${JSON.stringify(snapshot(ref, 'rules.mjs'))};
    import { isCenterBall } from ${JSON.stringify(snapshot(ref, 'deployment.mjs'))};
    export const observations = { immediateFreePickupsAvailable: 0, ignoredOrDeferred: 0, ignoredOrDeferredEarly: 0,
      immediateGroundPickupsAvailable: 0, ignoredOrDeferredGround: 0 };
    export const decideClassAction = ai.decideClassAction, decideMovement = ai.decideMovement;
    export const decideGroundPickup = ai.decideGroundPickup;
    export function decideTurn(state, actor) {
      const ground = !state.ball.carrierId && !isCenterBall(state) && legalAction(state, actor, { type: 'pickup' });
      const free = ground && !ballDefender(state, actor);
      const decision = ai.decideTurn(state, actor);
      if (ground) {
        observations.immediateGroundPickupsAvailable++;
        observations.ignoredOrDeferredGround += Number(decision.action.type !== 'pickup' || decision.path.length > 0);
      }
      if (free) {
        observations.immediateFreePickupsAvailable++;
        if (decision.action.type !== 'pickup' || decision.path.length) {
          observations.ignoredOrDeferred++;
          observations.ignoredOrDeferredEarly += Number(state.round <= 6);
        }
      }
      return decision;
    }
  `);
  const hook = await import(hookUrl);
  const engine = await import(moduleUrl(rewrite(source(ref, 'engine.mjs'), ref, { './ai.mjs': hookUrl })));
  const measurements = { matches: 0, freePickups: 0, afterFreePickup: {}, turns: 0 };
  for (const strategy of ['balanced', 'possession', 'pressing']) for (let i = 0; i < 8; i++) {
    const config = { seed: `loose-ball-audit-2026-10-17-${strategy}-${i}`, strategy, awayStrategy: strategy };
    const match = engine.simulateMatch(config, (state, events) => {
      let pickedUpBy = null;
      for (const event of events) {
        const action = event.resolvedAction;
        if (!action) continue;
        if (action.type === 'pickup' && !action.atCenter && event.type === 'possession') {
          measurements.freePickups++; pickedUpBy = action.playerId;
        } else if (pickedUpBy === action.playerId) {
          measurements.afterFreePickup[action.type] = (measurements.afterFreePickup[action.type] ?? 0) + 1;
          pickedUpBy = null;
        }
      }
    });
    assert.equal(match.state.finished, true); measurements.matches++; measurements.turns += match.state.turns;
  }
  report.measurements[ref] = { ...measurements, ...hook.observations };
  console.log(`${ref}: ${JSON.stringify(report.measurements[ref])}`);
}
assert.ok(report.measurements.working.immediateFreePickupsAvailable > 0);
assert.equal(report.measurements.working.ignoredOrDeferred, 0);
assert.equal(report.measurements.working.ignoredOrDeferredGround, 0);
writeFileSync(resolve(root, 'rumbleball/playtests/loose-ball-audit-2026-10-17.json'), JSON.stringify(report, null, 2) + '\n');
