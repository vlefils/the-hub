// Sensitivity check, separate from the fixed-roster strategy benchmark.
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { compilePlayer } from '../rumbleball/progression.mjs';
import { PROFILES } from '../rumbleball/data.mjs';
import { createMatch } from '../rumbleball/engine.mjs';
import { OPENING_IDS } from '../rumbleball/openings.mjs';
import { blankTally, measureMatch, tallySide } from './rumbleball-benchmark-metrics.mjs';

const variants = [
  { id: 'mobile', profiles: [0, 2, 4, 2, 4], xp: 0, fatigue: 0, implant: null },
  { id: 'contact', profiles: [1, 3, 1, 3, 1], xp: 0, fatigue: 0, implant: null },
  { id: 'veterans-fatigued', profiles: [0, 1, 2, 3, 4], xp: 140, fatigue: 5, implant: 'legs', protection: 'armor' },
];
const report = { generatedAt: new Date().toISOString(), method: 'Each variant: 25 opening pairs, each replayed with sides exchanged. Conservation versus alternating Balanced/Pressing. Exactly equal compiled rosters. Independent seeds; 50 matches per variant, descriptive sensitivity check, not a ranking of compositions.', variants: [] };
const start = performance.now();
for (const spec of variants) {
  const roster = spec.profiles.map((profile, i) => {
    const player = { id: `${spec.id}-${i}`, profile, name: `${PROFILES[profile].trainingName} ${i + 1}`,
      role: PROFILES[profile].role, instruction: 'normal', xp: spec.xp, fatigue: spec.fatigue, implant: spec.implant };
    return compilePlayer(player, spec.protection ? [{ playerId: player.id, itemId: spec.protection }] : []);
  });
  const row = { ...spec, roster, tally: blankTally(), matches: [] };
  for (let i = 0; i < 25; i++) for (const side of ['home', 'away']) {
    const other = i % 2 ? 'balanced' : 'pressing';
    const x = OPENING_IDS[Math.floor(i / 5)], y = OPENING_IDS[i % 5];
    const config = { seed: `evasion-profile-${spec.id}-${i}`, strategy: side === 'home' ? 'possession' : other,
      awayStrategy: side === 'away' ? 'possession' : other, rosters: { home: roster, away: roster },
      openings: { home: side === 'home' ? x : y, away: side === 'away' ? x : y } };
    const state = createMatch(config);
    const profile = ({ id, teamId, position, startPosition, initiative, initiativeDie, initiativeTie, ...p }) => p;
    for (let n = 0; n < 5; n++) assert.deepEqual(profile(state.players[n]), profile(state.players[n + 5]));
    const match = measureMatch(config); tallySide(row.tally, match, side);
    row.matches.push({ seed: config.seed, side, other, openings: config.openings, ...match });
  }
  report.variants.push(row);
  console.log(spec.id, row.tally.wins, '/', row.tally.appearances, `${row.tally.metrics.passesCompleted}/${row.tally.metrics.passesAttempted} passes`);
}
report.simulationSeconds = (performance.now() - start) / 1000;
writeFileSync(new URL('../rumbleball/playtests/evasion-profiles-150-2026-10-17.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
