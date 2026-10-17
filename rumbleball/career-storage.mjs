import { PROFILES, ROLES, INSTRUCTIONS, STRATEGIES } from './data.mjs';
import { CATALOGUE } from './progression.mjs';
import { assertInvariants } from './rules.mjs';
import { createMatch } from './engine.mjs';

export const CAREER_KEY = 'the-hub.rumbleball.career.v1';
const check = (condition) => { if (!condition) throw new Error('Sauvegarde de carrière invalide ou incompatible.'); };
const integer = (value, min = 0) => Number.isSafeInteger(value) && value >= min;
const name = (value) => typeof value === 'string' && value.trim().length > 0 && value.length <= 80;
export function validateCareer(c) {
  check(c && c.version === 1 && ['draft', 'active'].includes(c.status) && name(c.seed));
  check(integer(c.balance, -Number.MAX_SAFE_INTEGER) && integer(c.season, 1) && integer(c.day) && c.day <= 10 && integer(c.completedDays));
  check(c.completedDays === (c.season - 1) * 10 + c.day);
  check(Array.isArray(c.clubs) && c.clubs.length === 6 && c.clubs[0].id === 'club');
  const clubIds = c.clubs.map((club) => club.id); check(new Set(clubIds).size === 6);
  const playerIds = new Set();
  const validatePlayer = (p) => {
    check(p && name(p.id) && name(p.name) && integer(p.profile) && p.profile < PROFILES.length && integer(p.xp) && integer(p.fatigue) && p.fatigue <= 6);
    check(Object.hasOwn(ROLES, p.role) && Object.hasOwn(INSTRUCTIONS, p.instruction));
    check(p.implant === null || CATALOGUE[p.implant]?.slot === 'implant');
    check(!playerIds.has(p.id)); playerIds.add(p.id);
  };
  for (const [index, club] of c.clubs.entries()) {
    check(name(club.id) && name(club.name) && name(club.style) && Object.hasOwn(STRATEGIES, club.strategy) && Array.isArray(club.players));
    check(index ? club.players.length === 7 : c.status === 'draft' ? club.players.length === 0 : club.players.length >= 5 && club.players.length <= 8);
    club.players.forEach(validatePlayer);
  }
  check(Array.isArray(c.market) && c.market.length <= 12); c.market.forEach(validatePlayer);
  const ownedIds = c.clubs[0].players.map((p) => p.id);
  check(Array.isArray(c.lineup) && new Set(c.lineup).size === c.lineup.length && c.lineup.every((id) => ownedIds.includes(id)) && c.lineup.length === (c.status === 'draft' ? 0 : 5));
  check(Array.isArray(c.inventory) && new Set(c.inventory.map((i) => i.id)).size === c.inventory.length);
  const equipped = new Set();
  for (const item of c.inventory) {
    check(name(item.id) && CATALOGUE[item.itemId]?.slot === 'protection' && (item.playerId === null || ownedIds.includes(item.playerId)));
    if (item.playerId) { check(!equipped.has(item.playerId)); equipped.add(item.playerId); }
  }
  check(Array.isArray(c.tieOrder) && c.tieOrder.length === 6 && new Set(c.tieOrder).size === 6 && c.tieOrder.every((id) => clubIds.includes(id)));
  check(Array.isArray(c.schedule) && c.schedule.length === 10);
  const fixtureIds = new Set(), pairCounts = new Map();
  c.schedule.forEach((fixtures, day) => {
    check(Array.isArray(fixtures) && fixtures.length === 3);
    const participants = [];
    for (const f of fixtures) {
      check(name(f.id) && name(f.seed) && !fixtureIds.has(f.id)); fixtureIds.add(f.id);
      check(clubIds.includes(f.homeId) && clubIds.includes(f.awayId) && f.homeId !== f.awayId); participants.push(f.homeId, f.awayId);
      const key = `${f.homeId}:${f.awayId}`; pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
      check(f.result === null || (typeof f.result === 'object' && (f.result.winnerId === null || [f.homeId, f.awayId].includes(f.result.winnerId)) && integer(f.result.round, 10) && f.result.round <= 13));
      check(day < c.day ? f.result !== null : f.result === null);
    }
    check(new Set(participants).size === 6);
  });
  check(pairCounts.size === 30 && [...pairCounts.values()].every((count) => count === 1));
  check(Array.isArray(c.transactions) && new Set(c.transactions.map((t) => t.id)).size === c.transactions.length && c.transactions.every((t) => name(t.id) && typeof t.label === 'string' && t.label.length <= 200 && integer(t.amount, -Number.MAX_SAFE_INTEGER) && integer(t.balance, -Number.MAX_SAFE_INTEGER)));
  let balance = 2400;
  for (const t of c.transactions) { if (t.amount < 0 && t.label !== 'Salaires de la journée') check(balance >= -t.amount); balance += t.amount; check(integer(balance, -Number.MAX_SAFE_INTEGER) && t.balance === balance); }
  check(balance === c.balance);
  check(Array.isArray(c.seasonHistory) && c.seasonHistory.length === c.season - 1 + Number(c.day === 10));
  const validTable = (rows) => Array.isArray(rows) && rows.length === 6 && new Set(rows.map((r) => r.clubId)).size === 6 && rows.every((r) => clubIds.includes(r.clubId) && name(r.name) && ['played', 'wins', 'draws', 'losses', 'points'].every((key) => integer(r[key])) && r.played === r.wins + r.draws + r.losses && r.points === r.wins * 3 + r.draws);
  check(validTable(c.table));
  check(c.seasonHistory.every((s, index) => s.season === index + 1 && integer(s.prize) && validTable(s.table)));
  for (const f of c.schedule.flat().filter((f) => [f.homeId, f.awayId].includes('club'))) {
    const wages = c.transactions.filter((t) => t.fixtureId === f.id && t.label === 'Salaires de la journée');
    const rewards = c.transactions.filter((t) => t.fixtureId === f.id && t.label === 'Prime de match');
    check(wages.length === Number(Boolean(f.result) || c.current?.fixtureId === f.id) && rewards.length === Number(Boolean(f.result)));
  }
  if (c.current !== null) {
    const m = c.current; check(c.status === 'active' && m && typeof m.settled === 'boolean' && integer(m.wages) && Array.isArray(m.turns));
    const f = c.schedule.flat().find((fixture) => fixture.id === m.fixtureId); check(f && Boolean(f.result) === m.settled);
    check(c.schedule[c.day - Number(m.settled)]?.some((fixture) => fixture.id === m.fixtureId));
    check(m.config?.seed === f.seed && m.state?.seed === f.seed && m.state.players?.length === 10 && m.turns.length <= 131);
    check(m.state.finished === m.settled && integer(m.state.turns) && m.state.turns <= 130);
    check(integer(m.state.round, 1) && m.state.round <= 13 && integer(m.state.turnIndex) && m.state.turnIndex < (m.settled ? 11 : 10));
    check(Array.isArray(m.state.initiative) && new Set(m.state.initiative).size === 10 && m.state.initiative.every((id) => m.state.players.some((p) => p.id === id)));
    check(m.turns.every((events) => Array.isArray(events) && events.every((e) => typeof e.type === 'string' && typeof e.message === 'string')));
    check(c.transactions.filter((t) => t.fixtureId === f.id && t.label === 'Salaires de la journée').length === 1);
    check(m.config.rosters && ['home', 'away'].every((side) => Array.isArray(m.config.rosters[side]) && m.config.rosters[side].length === 5));
    check(name(m.config.teamNames?.home) && name(m.config.teamNames?.away));
    check(integer(m.state.rng) && m.state.rng <= 4294967295 && Array.isArray(m.state.teams) && m.state.teams.length === 2);
    check(m.state.teams.every((t, i) => t.id === (i ? 'away' : 'home') && name(t.name) && Object.hasOwn(STRATEGIES, t.strategy)));
    check(['regular', 'overtime', 'final'].includes(m.state.phase));
    if (m.settled) check(m.state.result && [null, 'home', 'away'].includes(m.state.result.winnerId) && integer(m.state.result.round, 10));
    else check(m.state.result === null);
    check(['home', 'away'].every((side) => m.state.stats?.[side] && ['passesAttempted', 'passesCompleted', 'recoveries', 'knockouts'].every((key) => integer(m.state.stats[side][key]))));
    const initial = createMatch(m.config);
    check(initial.players.every((p, i) => {
      const saved = m.state.players[i];
      check(name(p.name) && integer(p.level, 1) && p.level <= 5 && integer(p.maxHp, 1) && integer(p.armor, 1) && Number.isFinite(p.speed) && p.speed > 0);
      check(Object.values(p.skills).every(Number.isFinite) && Object.values(p.abilities).every(Number.isFinite) && Object.values(p.attack).every(Number.isFinite));
      check(integer(saved.hp) && Number.isFinite(saved.movement) && saved.movement >= 0 && saved.classState && Array.isArray(m.state.aids) && Array.isArray(m.state.calls));
      return ['playerId', 'id', 'teamId', 'name', 'level', 'archetype', 'maxHp', 'armor', 'speed', 'number', 'role', 'instruction', 'initiativeDie', 'initiative', 'initiativeTie'].every((key) => p[key] === saved[key])
        && ['skills', 'abilities', 'attack'].every((key) => JSON.stringify(p[key]) === JSON.stringify(saved[key]));
    }));
    if (m.settled) {
      check(m.summary && Array.isArray(m.summary.progress) && ['reward', 'wages', 'debtRepaid', 'remainingDebt', 'available', 'seasonPrize'].every((key) => integer(m.summary[key])));
      check(m.summary.progress.every((p) => p && name(p.name) && name(p.playerId) && integer(p.xp) && integer(p.beforeLevel, 1) && integer(p.level, 1) && p.level <= 5 && integer(p.beforeFatigue) && integer(p.fatigue) && p.beforeFatigue <= 6 && p.fatigue <= 6));
    }
    assertInvariants(m.state);
  }
  return c;
}
export function exportCareer(career) { validateCareer(career); return JSON.stringify({ format: 'the-hub-rumbleball', version: 1, career }, null, 2); }
export function importCareer(json) {
  if (typeof json !== 'string' || json.length > 8_000_000) throw new Error('Fichier JSON trop volumineux.');
  let data; try { data = JSON.parse(json); } catch { throw new Error('Ce fichier ne contient pas un JSON lisible.'); }
  if (data?.format !== 'the-hub-rumbleball' || data.version !== 1) throw new Error('Format de carrière inconnu.');
  return validateCareer(data.career);
}
export function loadCareer(storage) {
  try { const raw = storage.getItem(CAREER_KEY); return { career: raw ? importCareer(raw) : null, error: null, hasSave: Boolean(raw) }; }
  catch (error) { return { career: null, error: `Chargement impossible : ${error.message} La sauvegarde existante est conservée.`, hasSave: true }; }
}
export function persistCareer(storage, career) {
  // A single setItem is atomic: quota/security failures leave the previous value intact.
  const json = exportCareer(career); storage.setItem(CAREER_KEY, json);
}
