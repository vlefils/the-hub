// A reproducible observation sample, not a balance or win-rate assertion.
import { writeFileSync } from 'node:fs';
import { simulateMatch } from '../rumbleball/engine.mjs';

const report = { matches: [], totals: { turns: 0, strips: 0, stolen: 0, attacks: 0, grapples: 0, passes: 0, ready: 0, backToBackStrips: 0 }, longestStripChain: 0 };
for (const strategy of ['balanced', 'possession', 'pressing']) {
  for (let i = 0; i < 8; i++) {
    const row = { seed: `possession-audit-${strategy}-${i}`, strategy, turns: 0, strips: 0, stolen: 0, attacks: 0, grapples: 0, passes: 0, ready: 0, backToBackStrips: 0, longestStripChain: 0 };
    let stripChain = 0, lastBallChangeWasStrip = false;
    const game = simulateMatch({ seed: row.seed, strategy, awayStrategy: strategy }, (state, events) => {
      row.turns++;
      const strips = events.filter((e) => e.resolvedAction?.type === 'strip').length;
      row.strips += strips;
      stripChain = strips ? stripChain + 1 : 0; row.longestStripChain = Math.max(row.longestStripChain, stripChain);
      row.attacks += events.filter((e) => e.type === 'attack' && !e.opportunity).length;
      row.grapples += events.filter((e) => e.type === 'grapple').length;
      row.ready += events.filter((e) => e.type === 'ready-pass').length;
      for (const event of events) {
        if (event.type === 'possession') {
          const stolen = event.reason === 'arrache';
          if (stolen) { row.stolen++; if (lastBallChangeWasStrip) row.backToBackStrips++; }
          lastBallChangeWasStrip = stolen;
        }
        if (['drop', 'pass'].includes(event.type)) lastBallChangeWasStrip = false;
      }
    });
    row.passes = game.state.stats.home.passesAttempted + game.state.stats.away.passesAttempted;
    row.winner = game.state.result.winnerId;
    report.matches.push(row);
    for (const key of Object.keys(report.totals)) report.totals[key] += row[key];
    report.longestStripChain = Math.max(report.longestStripChain, row.longestStripChain);
  }
}
if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(report, null, 2));
console.log(JSON.stringify({ matches: report.matches.length, ...report.totals, longestStripChain: report.longestStripChain }, null, 2));
