// Reproduce the first reported game on its shipped rules, then manage days 2–3
// on the current engine. All saves are isolated files; no browser storage is used.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import * as career from '../rumbleball/career.mjs';
import { stepMatch } from '../rumbleball/engine.mjs';
import { exportCareer, importCareer, validateCareer } from '../rumbleball/career-storage.mjs';
import { narrateTurn } from '../rumbleball/narration.mjs';
import { levelOf } from '../rumbleball/progression.mjs';

const baseline = 'c966ffc';
const moduleUrl = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
function oldSource(file, dependencies = {}) {
  return execFileSync('git', ['show', `${baseline}:rumbleball/${file}`], { encoding: 'utf8' })
    .replace(/from '(\.\/[^']+)'/g, (_, path) => `from ${JSON.stringify(dependencies[path] ?? pathToFileURL(resolve('rumbleball', path)).href)}`);
}
const oldRules = moduleUrl(oldSource('rules.mjs'));
const oldAi = moduleUrl(oldSource('ai.mjs', { './rules.mjs': oldRules }));
const oldEngineUrl = moduleUrl(oldSource('engine.mjs', { './rules.mjs': oldRules, './ai.mjs': oldAi }));
const oldEngine = await import(oldEngineUrl);
const old = await import(moduleUrl(oldSource('career.mjs', { './engine.mjs': oldEngineUrl })));

let c = old.createCareer('Les Rebuts du Chrome', 'partie-retour-17-octobre');
const ids = [...c.market.slice(0, 5), c.market[8], c.market[10]].map((p) => p.id);
c = old.confirmDraft(c, ids);
c = old.buyItem(c, 'vest', ids[2]); c = old.buyItem(c, 'gloves', ids[3]);
c = old.configureTeam(c, ids.slice(0, 5), Object.fromEntries(old.ownedPlayers(c).map((p, i) => [p.id,
  { role: p.role, instruction: i === 1 || i === 3 ? 'aggressive' : i === 2 ? 'cautious' : 'normal' }])), 'possession');
c = old.launchCareerMatch(c);
const replay = oldEngine.simulateMatch(c.current.config);
c = old.saveCareerTurn(c, replay.state, replay.events);
assert.equal(c.balance, 295); assert.equal(c.current.state.turns, 89); assert.equal(c.current.state.result.winnerId, 'home');
validateCareer(c);
const report = { baseline: { day: c.day, balance: c.balance, stats: c.current.state.stats }, days: [] };

function play() {
  const before = { balance: c.balance, roster: career.ownedPlayers(c).map((p) => ({ name: p.name, fatigue: p.fatigue, level: levelOf(p), starter: c.lineup.includes(p.id) })) };
  c = career.launchCareerMatch(c);
  const config = structuredClone(c.current.config), abilities = { home: {}, away: {} }, logs = [], passes = [];
  while (!c.current.settled) {
    const turn = stepMatch(c.current.state);
    for (const event of turn.events) {
      if (event.type === 'class') { const side = turn.state.players.find((p) => p.id === event.playerId).teamId; abilities[side][event.ability] = (abilities[side][event.ability] ?? 0) + 1; }
      if (event.type === 'pass') passes.push({ round: event.round, from: turn.state.players.find((p) => p.id === event.playerId).name, to: turn.state.players.find((p) => p.id === event.targetId).name });
    }
    const narrative = narrateTurn(turn.events, turn.state.players);
    if (narrative.announcements.length || turn.events.some((e) => e.type === 'pass' || e.type === 'ko' || e.ability === 'call-used' || e.ability === 'precision')) {
      logs.push({ turn: turn.state.turns, round: turn.state.round, text: narrative.text, announcements: narrative.announcements.map((e) => e.message) });
    }
    c = career.saveCareerTurn(c, turn.state, turn.events);
    if (turn.state.turns === 12) c = importCareer(exportCareer(c));
  }
  validateCareer(c);
  report.days.push({ day: c.day, opponent: config.teamNames.away, before, config, result: c.current.state.result,
    holder: c.current.state.players.find((p) => p.id === c.current.state.result.carrierId)?.name, turns: c.current.state.turns,
    stats: c.current.state.stats, abilities, passes, summary: c.current.summary, logs });
}

// Rest Zip and Vigie; give the reserve runner the same transferable protection.
c = career.configureTeam(c, [ids[0], ids[1], ids[5], ids[3], ids[6]], Object.fromEntries(career.ownedPlayers(c).map((p) => [p.id,
  { role: p.id === ids[6] ? 'relay' : p.role, instruction: p.id === ids[5] || p.id === ids[6] ? 'cautious' : p.instruction }])), 'possession');
c = career.assignProtection(c, c.inventory.find((i) => i.itemId === 'vest').id, ids[5]);
play();

// Invest in a reserve captain so Nora can recover; return the rested starters.
const fresh = c.market.find((p) => p.profile === 0);
c = career.recruit(c, fresh.id); report.recruitment = { name: fresh.name, cost: 300 };
c = career.configureTeam(c, [fresh.id, ids[1], ids[2], ids[3], ids[4]], Object.fromEntries(career.ownedPlayers(c).map((p) => [p.id,
  { role: p.id === ids[4] ? 'relay' : p.role, instruction: p.id === ids[4] ? 'cautious' : p.instruction }])), 'possession');
c = career.assignProtection(c, c.inventory.find((i) => i.itemId === 'vest').id, ids[2]);
play();
report.final = { balance: c.balance, table: career.standings(c), roster: career.ownedPlayers(c).map((p) => ({ name: p.name, level: levelOf(p), xp: p.xp, fatigue: p.fatigue })) };
fs.mkdirSync('rumbleball/playtests', { recursive: true });
fs.writeFileSync('rumbleball/playtests/rebuts-s1-j3.json', exportCareer(c));
fs.writeFileSync('rumbleball/playtests/two-days-report.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify({ days: report.days.map(({ config, before, logs, summary, ...day }) => ({ ...day, balance: summary.balance, wages: summary.wages, reward: summary.reward })), final: report.final }, null, 2));
