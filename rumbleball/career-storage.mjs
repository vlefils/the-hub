import { PROFILES, ROLES, INSTRUCTIONS, STRATEGIES } from './data.mjs';
import { CATALOGUE, MAX_SQUAD_SIZE } from './progression.mjs';
import { assertInvariants } from './rules.mjs';
import { createMatch } from './engine.mjs';
import { validKitColor } from './appearance.mjs';
import { validCrest, validPortrait, identifyCareer } from './identity.mjs';
import { validDeployment } from './deployment.mjs';
import { validOpening } from './openings.mjs';
import { MAX_LEVEL, XP_THRESHOLDS, levelOf, validPlayerDevelopment, ensureCareerDevelopment } from './player-development.mjs';
import { validPlayoffs, playoffFixtures, validFixtureResult } from './playoffs.mjs';
import { ensureCareerPlayoffs } from './career.mjs';
import { validEquipmentInventory, equipmentAvailable, validIssuedWeapons, ensureCareerEquipment } from './equipment.mjs';
import { isLongCareer, fatigueLimit, LONG_RULES, divisionOf } from './career-rules.mjs';

export const CAREER_KEY = 'the-hub.rumbleball.career.v1';
const check = (condition) => { if (!condition) throw new Error('Sauvegarde de carrière invalide ou incompatible.'); };
const integer = (value, min = 0) => Number.isSafeInteger(value) && value >= min;
const name = (value) => typeof value === 'string' && value.trim().length > 0 && value.length <= 80;
const initialLevelIn = (p, [min, max]) => levelOf(p) >= min && levelOf(p) <= max && p.xp === XP_THRESHOLDS[levelOf(p) - 1];
function validSummary(summary, cap, long) {
  return summary && Array.isArray(summary.progress)
    && ['reward', 'wages', 'debtRepaid', 'remainingDebt', 'available', 'seasonPrize'].every(key => integer(summary[key]))
    && summary.progress.every(p => p && name(p.name) && name(p.playerId) && integer(p.xp)
      && integer(p.beforeLevel, 1) && integer(p.level, 1) && p.level <= MAX_LEVEL
      && integer(p.beforeFatigue) && integer(p.fatigue) && p.beforeFatigue <= cap && p.fatigue <= cap
      && (!long || integer(p.injuryMatches) && p.injuryMatches <= 4 && (p.newInjury === undefined || integer(p.newInjury, 1) && p.newInjury <= 4)));
}
export function validateCareer(c) {
  check(c && c.version === 1 && ['draft', 'active'].includes(c.status) && name(c.seed));
  check(c.mode === undefined || ['classic', 'long'].includes(c.mode));
  const long = isLongCareer(c), cap = fatigueLimit(c), playoffOptions = { allowForfeit: long };
  check(long ? c.longCareer?.version === 1 && integer(c.longCareer.division, 1) && c.longCareer.division <= 6 : c.longCareer === undefined);
  const validInventory = (items, players) => validEquipmentInventory(items, players.map(p => p.id), players) && items.every(item => equipmentAvailable(item.itemId, c.mode));
  check(integer(c.balance, -Number.MAX_SAFE_INTEGER) && integer(c.season, 1) && integer(c.day) && c.day <= 10 && integer(c.completedDays));
  check(c.completedDays === (c.season - 1) * 10 + c.day);
  check(Array.isArray(c.clubs) && c.clubs.length === 6 && c.clubs[0].id === 'club');
  const clubIds = c.clubs.map((club) => club.id); check(new Set(clubIds).size === 6);
  const playerIds = new Set();
  const validatePlayer = (p) => {
    check(p.portraitId === undefined || validPortrait(p.portraitId));
    check(p && name(p.id) && name(p.name) && integer(p.profile) && p.profile < PROFILES.length && integer(p.xp) && integer(p.fatigue) && p.fatigue <= cap);
    check(long ? integer(p.injuryMatches) && p.injuryMatches <= 4 : p.injuryMatches === undefined || p.injuryMatches === 0);
    check(Object.hasOwn(ROLES, p.role) && Object.hasOwn(INSTRUCTIONS, p.instruction));
    check(validPlayerDevelopment(p));
    check(p.issuedWeapons === undefined || validIssuedWeapons(p.issuedWeapons));
    check(p.implant === null || CATALOGUE[p.implant]?.slot === 'implant' && equipmentAvailable(p.implant, c.mode));
    check(!playerIds.has(p.id)); playerIds.add(p.id);
  };
  for (const [index, club] of c.clubs.entries()) {
    check(club.crestId === undefined || validCrest(club.crestId));
    check(club.kitColor === undefined || validKitColor(club.kitColor));
    check(club.deployment === undefined || validDeployment(club.deployment));
    check(club.opening === undefined || validOpening(club.opening));
    check(name(club.id) && name(club.name) && name(club.style) && Object.hasOwn(STRATEGIES, club.strategy) && Array.isArray(club.players));
    check(!index && c.status === 'draft' ? club.players.length === 0 : club.players.length >= 5 && club.players.length <= MAX_SQUAD_SIZE);
    club.players.forEach(validatePlayer);
    if (long && index) {
      check(club.players.length === 10 && validInventory(club.inventory, club.players));
      check(club.players.every(p => initialLevelIn(p, divisionOf(c).botLevels)));
    }
    if (index && !long && (club.balance !== undefined || club.inventory !== undefined || club.transactions !== undefined)) {
      check(integer(club.balance, -Number.MAX_SAFE_INTEGER) && Array.isArray(club.inventory) && Array.isArray(club.transactions));
      check(validInventory(club.inventory, club.players));
      const entries = new Set();
      let balance = 600;
      for (const t of club.transactions) {
        check(name(t.id) && !entries.has(t.id) && name(t.fixtureId) && typeof t.label === 'string' && t.label.length <= 200 && integer(t.amount, -Number.MAX_SAFE_INTEGER) && integer(t.balance, -Number.MAX_SAFE_INTEGER)); entries.add(t.id);
        if (t.amount < 0 && t.label !== 'Salaires de la journée') check(balance >= -t.amount);
        balance += t.amount; check(integer(balance, -Number.MAX_SAFE_INTEGER) && t.balance === balance);
      }
      check(balance === club.balance);
    }
  }
  check(Array.isArray(c.market) && c.market.length <= 12); c.market.forEach(validatePlayer);
  if (long) check(c.market.every(p => initialLevelIn(p, divisionOf(c).recruitLevels) && p.fatigue === 0 && p.injuryMatches === 0));
  const ownedIds = c.clubs[0].players.map((p) => p.id);
  check(Array.isArray(c.lineup) && new Set(c.lineup).size === c.lineup.length && c.lineup.every((id) => ownedIds.includes(id)) && c.lineup.length === (c.status === 'draft' ? 0 : 5));
  check(validInventory(c.inventory, c.clubs[0].players));
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
      check(f.result === null || validFixtureResult(f.result, f.homeId, f.awayId, playoffOptions));
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
  const validTable = (rows, ids = clubIds) => Array.isArray(rows) && rows.length === 6 && new Set(rows.map((r) => r.clubId)).size === 6 && rows.some(r => r.clubId === 'club') && rows.every((r) => ids.includes(r.clubId) && name(r.clubId) && name(r.name) && ['played', 'wins', 'draws', 'losses', 'points'].every((key) => integer(r[key])) && r.played === r.wins + r.draws + r.losses && r.points === r.wins * 3 + r.draws);
  check(validTable(c.table));
  check(c.seasonHistory.every((s, index) => s.season === index + 1 && integer(s.prize) && validTable(s.table, long ? s.table?.map(row => row.clubId) : clubIds) && (!long || integer(s.division, 1) && s.division <= 6 && (s.nextDivision === undefined || integer(s.nextDivision, 1) && s.nextDivision <= 6))));
  check(c.playoffs === undefined || c.playoffs === null || c.day === 10 && validPlayoffs(c.playoffs, c.table.map(row => row.clubId), `s${c.season}-playoffs`, playoffOptions));
  for (const past of c.seasonHistory) if (past.playoffs) check(past.championId && past.playoffs.championId === past.championId && validPlayoffs(past.playoffs, past.table.map(row => row.clubId), `s${past.season}-playoffs`, playoffOptions));
  const fixtures = [...c.schedule.flat(), ...(c.playoffs?.rounds.flatMap(round => round.matches) ?? [])];
  for (const f of fixtures.filter(f => [f.homeId, f.awayId].includes('club'))) {
    const wages = c.transactions.filter((t) => t.fixtureId === f.id && t.label === 'Salaires de la journée');
    const rewards = c.transactions.filter((t) => t.fixtureId === f.id && t.label === 'Prime de match');
    check(wages.length === Number(Boolean(f.result) || c.current?.fixtureId === f.id) && rewards.length === Number(Boolean(f.result)));
  }
  if (c.current !== null) {
    const m = c.current; check(c.status === 'active' && m && typeof m.settled === 'boolean' && integer(m.wages) && Array.isArray(m.turns));
    const f = fixtures.find(fixture => fixture.id === m.fixtureId); check(f && Boolean(f.result) === m.settled);
    const groupDay = c.schedule.findIndex(day => day.some(fixture => fixture.id === m.fixtureId));
    check(groupDay >= 0 ? (m.settled ? groupDay < c.day : groupDay === c.day) : c.day === 10 && (m.settled || playoffFixtures(c.playoffs).some(fixture => fixture.id === m.fixtureId)));
    const matchSeed = f.seed ?? `${c.seed}:${f.id}`;
    check(m.settled ? validSummary(m.summary, cap, long) && m.summary.wages === m.wages : m.summary === null);
    check(c.transactions.find(t => t.fixtureId === f.id && t.label === 'Salaires de la journée')?.amount === -m.wages);
    if (m.kind === 'forfeit') {
      check(long && m.settled && m.state === undefined && m.turns.length === 0 && m.config?.seed === matchSeed && name(m.config.teamNames?.home) && name(m.config.teamNames?.away));
      check(validFixtureResult(m.result, 'home', 'away', playoffOptions) && m.result.round === 0);
      check(f.result.kind === m.result.kind && f.result.winnerId === (m.result.winnerId === 'home' ? 'club' : m.result.winnerId === 'away' ? f.homeId === 'club' ? f.awayId : f.homeId : null));
      return c;
    }
    check(m.kind === undefined || m.kind === 'match');
    check(m.config?.careerRules === (long ? LONG_RULES : undefined) && m.state?.careerRules === m.config.careerRules);
    check(m.config?.seed === matchSeed && m.state?.seed === matchSeed && m.state.players?.length === 10 && m.turns.length <= 131);
    check(m.state.finished === m.settled && integer(m.state.turns) && m.state.turns <= 130);
    check(integer(m.state.round, 1) && m.state.round <= 13 && integer(m.state.turnIndex) && m.state.turnIndex < (m.settled ? 11 : 10));
    check(Array.isArray(m.state.initiative) && new Set(m.state.initiative).size === 10 && m.state.initiative.every((id) => m.state.players.some((p) => p.id === id)));
    check(m.turns.every((events) => Array.isArray(events) && events.every((e) => typeof e.type === 'string' && typeof e.message === 'string')));
    check(c.transactions.filter((t) => t.fixtureId === f.id && t.label === 'Salaires de la journée').length === 1);
    check(m.config.rosters && ['home', 'away'].every((side) => Array.isArray(m.config.rosters[side]) && m.config.rosters[side].length === 5));
    check(name(m.config.teamNames?.home) && name(m.config.teamNames?.away));
    check(integer(m.state.rng) && m.state.rng <= 4294967295 && Array.isArray(m.state.teams) && m.state.teams.length === 2);
    check(m.state.teams.every((t, i) => t.id === (i ? 'away' : 'home') && name(t.name) && Object.hasOwn(STRATEGIES, t.strategy) && (t.kitColor === undefined || validKitColor(t.kitColor)) && (t.crestId === undefined || validCrest(t.crestId)) && t.crestId === m.config.crestIds?.[t.id]));
    check(['regular', 'overtime', 'final'].includes(m.state.phase));
    if (m.settled) check(m.state.result && [null, 'home', 'away'].includes(m.state.result.winnerId) && integer(m.state.result.round, m.state.version >= 6 ? 1 : 10));
    else check(m.state.result === null);
    check(['home', 'away'].every((side) => m.state.stats?.[side] && ['passesAttempted', 'passesCompleted', 'recoveries', 'knockouts'].every((key) => integer(m.state.stats[side][key]))));
    check([2, 3, 4, 5, 6, 7, 8].includes(m.state.version));
    check(m.config.rulesVersion === undefined || m.config.rulesVersion === m.state.version);
    const initial = createMatch({ ...m.config, rulesVersion: m.state.version });
    if (m.state.version >= 4) check(m.state.teams.every((team, i) => validOpening(team.opening) && team.opening === initial.teams[i].opening));
    check(initial.players.every((p, i) => {
      const saved = m.state.players[i];
      check(p.portraitId === undefined || validPortrait(p.portraitId)); check(p.portraitId === saved.portraitId);
      check(name(p.name) && integer(p.level, 1) && p.level <= MAX_LEVEL && integer(p.maxHp, 1) && integer(p.armor, 1) && Number.isFinite(p.speed) && p.speed > 0);
      if (long) check(integer(p.fatigue) && p.fatigue <= cap && p.fatigue === saved.fatigue);
      check(Object.values(p.skills).every(Number.isFinite) && Object.values(p.abilities).every(Number.isFinite) && Object.values(p.attack).every(Number.isFinite));
      check(integer(saved.hp) && Number.isFinite(saved.movement) && saved.movement >= 0 && saved.classState && Array.isArray(m.state.aids) && Array.isArray(m.state.calls));
      if (m.state.version >= 3) check(JSON.stringify(p.startPosition) === JSON.stringify(saved.startPosition));
      return ['playerId', 'id', 'teamId', 'name', 'level', 'archetype', 'maxHp', 'armor', 'speed', 'number', 'role', 'instruction', 'initiativeDie', 'initiative', 'initiativeTie', 'proficiencyBonus', 'chargeDC'].every((key) => p[key] === saved[key])
        && ['skills', 'abilities', 'attack', 'weapon', 'offhandAttack'].every((key) => JSON.stringify(p[key]) === JSON.stringify(saved[key]));
    }));
    assertInvariants(m.state);
  }
  return c;
}
export function exportCareer(career) { validateCareer(career); return JSON.stringify({ format: 'the-hub-rumbleball', version: 1, career }, null, 2); }
export function serializeCareer(career) { validateCareer(career); return JSON.stringify({ format: 'the-hub-rumbleball', version: 1, career }); }
export function importCareer(json) {
  if (typeof json !== 'string' || json.length > 8_000_000) throw new Error('Fichier JSON trop volumineux.');
  let data; try { data = JSON.parse(json); } catch { throw new Error('Ce fichier ne contient pas un JSON lisible.'); }
  if (data?.format !== 'the-hub-rumbleball' || data.version !== 1) throw new Error('Format de carrière inconnu.');
  return ensureCareerEquipment(ensureCareerPlayoffs(ensureCareerDevelopment(identifyCareer(validateCareer(data.career)))));
}
export function loadCareer(storage) {
  try { const raw = storage.getItem(CAREER_KEY); return { career: raw ? importCareer(raw) : null, error: null, hasSave: Boolean(raw) }; }
  catch (error) { return { career: null, error: `Chargement impossible : ${error.message} La sauvegarde existante est conservée.`, hasSave: true }; }
}
export function persistCareer(storage, career) {
  // A single setItem is atomic: quota/security failures leave the previous value intact.
  const json = serializeCareer(career); storage.setItem(CAREER_KEY, json);
}
