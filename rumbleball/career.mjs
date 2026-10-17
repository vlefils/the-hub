import { PROFILES, ROLES, INSTRUCTIONS, STRATEGIES, clone } from './data.mjs';
import { createMatch, simulateMatch, seedHash } from './engine.mjs';
import { compilePlayer, recruitmentPrice, salary, levelOf, progressPlayer, CATALOGUE, XP_THRESHOLDS } from './progression.mjs';
import { KIT_COLORS, clubKit, validKitColor } from './appearance.mjs';
import { clubDeployment, defaultDeployment, validDeployment } from './deployment.mjs';

export const SEASON_PRIZES = [600, 400, 200, 100, 100, 100];
const CLUBS = [
  ['Les Charognards', 'Équilibre', 'balanced', [0, 1, 2, 3, 4, 2, 4]],
  ['Les Brise-Chrome', 'Blocage', 'pressing', [1, 3, 1, 0, 2, 3, 4]],
  ['Les Voltigeurs', 'Mobilité', 'balanced', [2, 2, 0, 4, 3, 2, 0]],
  ['Circuit Ouvert', 'Passes', 'possession', [4, 0, 4, 2, 1, 0, 4]],
  ['Les Crocs Néon', 'Pressing', 'pressing', [3, 2, 1, 0, 4, 3, 2]],
];
function random(seed) { let value = seedHash(seed); return () => { value = (Math.imul(value, 1664525) + 1013904223) >>> 0; return value / 4294967296; }; }
function shuffle(values, seed) {
  const result = [...values], next = random(seed);
  for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
}
const need = (condition, message) => { if (!condition) throw new Error(message); };
const team = (career) => career.clubs[0];
export const ownedPlayers = (career) => team(career).players;
export const payroll = (career) => ownedPlayers(career).reduce((sum, p) => sum + salary(p), 0);
export const managementLocked = (career) => Boolean(career.current && !career.current.settled);
export const nextFixture = (career) => career.schedule[career.day]?.find((f) => f.homeId === 'club' || f.awayId === 'club') ?? null;
const editable = (career) => need(career.status === 'active' && !managementLocked(career), 'La gestion est verrouillée pendant la rencontre.');
export function purchaseBlock(career, price) {
  return managementLocked(career) ? 'Rencontre en cours : gestion en lecture seule.' : career.balance < 0 ? 'Salaires impayés : remboursez le solde avant tout achat.' : career.balance < price ? `Il manque ${price - career.balance} chromas.` : '';
}
function spend(career, amount, label) { need(!purchaseBlock(career, amount), purchaseBlock(career, amount)); transact(career, -amount, label); }
function transact(career, amount, label, fixtureId = null) {
  career.balance += amount;
  career.transactions.push({ id: `t${career.transactions.length + 1}`, season: career.season, day: Math.min(10, career.day + 1), amount, label, fixtureId, balance: career.balance });
}
function player(id, name, profile, level = 1) {
  return { id, name, profile, xp: XP_THRESHOLDS[level - 1], fatigue: 0, role: PROFILES[profile].role, instruction: 'normal', implant: null };
}
function generateMarket(career, initial = false) {
  const profiles = initial ? [0, 1, 2, 3, 4, 0, 0, 1, 2, 2, 4, 4] : [0, 1, 2, 4, ...shuffle([0, 1, 2, 3, 4], `${career.seed}:market:${career.completedDays}`).slice(0, 2)];
  const names = ['Echo', 'Magma', 'Pixel', 'Crank', 'Lentille', 'Boussole', 'Cobalt', 'Marteau', 'Flash', 'Glitch', 'Prisme', 'Radar'];
  return profiles.map((profile, index) => player(`offer-${career.completedDays}-${index}`, initial && index < 5 ? PROFILES[profile].trainingName : `${names[index]} ${career.completedDays + 1}`, profile, Math.min(5, 1 + Math.floor(career.completedDays / 5))));
}
function seasonSchedule(career) {
  const ids = shuffle(career.clubs.map((c) => c.id), `${career.seed}:schedule:${career.season}`), first = [];
  for (let day = 0; day < 5; day++) {
    first.push(Array.from({ length: 3 }, (_, index) => ({ homeId: ids[index], awayId: ids[5 - index] })));
    ids.splice(1, 0, ids.pop());
  }
  return [...first, ...first.map((fixtures) => fixtures.map((f) => ({ homeId: f.awayId, awayId: f.homeId })))].map((fixtures, day) => fixtures.map((f, index) => ({ ...f, id: `s${career.season}-d${day + 1}-m${index + 1}`, seed: `league-${seedHash(`${career.seed}:match:s${career.season}:d${day + 1}:m${index + 1}`).toString(36)}`, result: null })));
}
export function standings(career) {
  const rows = career.clubs.map((c) => ({ clubId: c.id, name: c.name, played: 0, wins: 0, draws: 0, losses: 0, points: 0 }));
  for (const fixture of career.schedule.flat()) if (fixture.result) {
    for (const clubId of [fixture.homeId, fixture.awayId]) {
      const row = rows.find((r) => r.clubId === clubId); row.played++;
      if (!fixture.result.winnerId) { row.draws++; row.points++; }
      else if (fixture.result.winnerId === clubId) { row.wins++; row.points += 3; }
      else row.losses++;
    }
  }
  return rows.sort((a, b) => b.points - a.points || b.wins - a.wins || career.tieOrder.indexOf(a.clubId) - career.tieOrder.indexOf(b.clubId));
}
export function createCareer(name, seed = 'career-01', kitColor = KIT_COLORS[0]) {
  need(typeof name === 'string' && name.trim().length > 0 && name.trim().length <= 80, 'Donnez au club un nom de 1 à 80 caractères.');
  need(validKitColor(kitColor), 'Couleur de maillot invalide.');
  const career = { version: 1, seed: String(seed).slice(0, 80), status: 'draft', balance: 2400, season: 1, day: 0, completedDays: 0,
    clubs: [{ id: 'club', name: name.trim(), kitColor, style: 'Votre club', strategy: 'balanced', deployment: defaultDeployment(), players: [] }, ...CLUBS.map(([clubName, style, strategy, profiles], index) => ({ id: `ai-${index}`, name: clubName, kitColor: KIT_COLORS[index + 1], style, strategy, deployment: defaultDeployment(strategy),
      players: profiles.map((profile, number) => { const p = player(`ai-${index}-${number}`, `${PROFILES[profile].name} ${number + 1}`, profile); if ([1, 4].includes(index)) p.instruction = 'aggressive'; if (index === 1) p.role = number < 3 ? 'blocker' : p.role; if (index === 3 && number < 3) p.role = 'relay'; return p; }) }))],
    lineup: [], inventory: [], transactions: [], market: [], schedule: [], tieOrder: [], current: null, seasonHistory: [] };
  career.market = generateMarket(career, true);
  career.tieOrder = shuffle(career.clubs.map((c) => c.id), `${career.seed}:ties:1`);
  career.schedule = seasonSchedule(career); career.table = standings(career);
  return career;
}
export function confirmDraft(input, ids) {
  const c = clone(input); need(c.status === 'draft', 'Club déjà créé.');
  need(new Set(ids).size === ids.length && ids.length >= 5 && ids.length <= 8, 'Sélectionnez de cinq à huit joueurs différents.');
  const selected = ids.map((id) => c.market.find((p) => p.id === id)); need(selected.every(Boolean), 'Candidat inconnu.');
  spend(c, selected.reduce((sum, p) => sum + recruitmentPrice(p), 0), 'Contrats initiaux');
  team(c).players = selected; c.lineup = ids.slice(0, 5); c.market = c.market.filter((p) => !ids.includes(p.id)); c.status = 'active'; return c;
}
export function configureTeam(input, lineup, assignments, strategy, deployment) {
  const c = clone(input); editable(c);
  need(lineup.length === 5 && new Set(lineup).size === 5 && lineup.every((id) => ownedPlayers(c).some((p) => p.id === id)), 'Choisissez exactement cinq titulaires distincts.');
  need(Object.hasOwn(STRATEGIES, strategy), 'Plan collectif inconnu.');
  if (deployment !== undefined) { need(validDeployment(deployment), 'Placez cinq joueurs distincts dans votre moitié de terrain.'); team(c).deployment = clone(deployment); }
  for (const p of ownedPlayers(c)) { const a = assignments[p.id]; if (!a) continue; need(Object.hasOwn(ROLES, a.role) && Object.hasOwn(INSTRUCTIONS, a.instruction), 'Consigne inconnue.'); p.role = a.role; p.instruction = a.instruction; }
  c.lineup = [...lineup]; team(c).strategy = strategy; return c;
}
export function setClubColor(input, color) {
  const c = clone(input); need(!managementLocked(c), 'La gestion est verrouillée pendant la rencontre.');
  need(validKitColor(color), 'Couleur de maillot invalide.'); team(c).kitColor = color.toLowerCase(); return c;
}
export function recruit(input, id) {
  const c = clone(input); editable(c); need(ownedPlayers(c).length < 8, 'Effectif complet : huit joueurs maximum.');
  const p = c.market.find((q) => q.id === id); need(p, 'Offre indisponible.'); spend(c, recruitmentPrice(p), `Recrutement : ${p.name}`);
  team(c).players.push(p); c.market = c.market.filter((q) => q.id !== id); return c;
}
export function sellPlayer(input, id) {
  const c = clone(input); editable(c); need(ownedPlayers(c).length > 5, 'Cinq joueurs minimum dans le club.');
  const p = ownedPlayers(c).find((q) => q.id === id); need(p, 'Joueur inconnu.');
  transact(c, recruitmentPrice(p) / 2, `Cession : ${p.name}`);
  for (const item of c.inventory) if (item.playerId === id) item.playerId = null;
  team(c).players = ownedPlayers(c).filter((q) => q.id !== id);
  c.lineup = c.lineup.filter((q) => q !== id); if (c.lineup.length < 5) c.lineup.push(ownedPlayers(c).find((q) => !c.lineup.includes(q.id)).id);
  return c;
}
export function buyItem(input, itemId, playerId = null, replaceConfirmed = false) {
  const c = clone(input); editable(c); const item = CATALOGUE[itemId]; need(item, 'Article inconnu.');
  const p = ownedPlayers(c).find((q) => q.id === playerId);
  if (item.slot === 'implant') { need(p, 'Sélectionnez un joueur.'); need(!p.implant || replaceConfirmed, 'Le remplacement détruit l’ancien implant. Confirmez ce remplacement.'); }
  spend(c, item.price, `${item.name}${p ? ` : ${p.name}` : ''}`);
  if (item.slot === 'implant') p.implant = itemId;
  else { const id = `gear-${c.transactions.length}`; c.inventory.push({ id, itemId, playerId: null }); if (p) assignProtectionMutable(c, id, p.id); }
  return c;
}
function assignProtectionMutable(c, id, playerId) {
  const item = c.inventory.find((q) => q.id === id); need(item, 'Protection inconnue.');
  need(playerId === null || ownedPlayers(c).some((p) => p.id === playerId), 'Joueur inconnu.');
  if (playerId) for (const old of c.inventory) if (old.playerId === playerId) old.playerId = null;
  item.playerId = playerId;
}
export function assignProtection(input, id, playerId) { const c = clone(input); editable(c); assignProtectionMutable(c, id, playerId); return c; }
export function sellProtection(input, id) {
  const c = clone(input); editable(c); const item = c.inventory.find((q) => q.id === id); need(item, 'Protection inconnue.');
  transact(c, CATALOGUE[item.itemId].price / 2, `Vente : ${CATALOGUE[item.itemId].name}`); c.inventory = c.inventory.filter((q) => q.id !== id); return c;
}
export function aiLineup(club) {
  return [...club.players].sort((a, b) => a.fatigue - b.fatigue || b.xp - a.xp || a.id.localeCompare(b.id)).slice(0, 5).map((p) => p.id);
}
function matchConfig(c, fixture) {
  // Keep the managed club on the left of the broadcast, even in an away fixture.
  const home = team(c), away = c.clubs.find((club) => club.id === (fixture.homeId === 'club' ? fixture.awayId : fixture.homeId));
  return { seed: fixture.seed, rulesVersion: 3, deployments: { home: clubDeployment(home), away: clubDeployment(away, 'away') }, teamNames: { home: home.name, away: away.name }, kitColors: { home: clubKit(home), away: clubKit(away, c.clubs.indexOf(away)) }, strategy: home.strategy, awayStrategy: away.strategy,
    rosters: { home: c.lineup.map((id) => compilePlayer(home.players.find((p) => p.id === id), c.inventory)), away: aiLineup(away).map((id) => compilePlayer(away.players.find((p) => p.id === id))) } };
}
export function launchCareerMatch(input) {
  const c = clone(input); editable(c); const fixture = nextFixture(c); need(fixture && !fixture.result, 'La saison est terminée.');
  need(c.lineup.length === 5 && new Set(c.lineup).size === 5 && c.lineup.every((id) => ownedPlayers(c).some((p) => p.id === id)), 'Cinq titulaires sont nécessaires.');
  const config = matchConfig(c, fixture), wages = payroll(c);
  transact(c, -wages, 'Salaires de la journée', fixture.id);
  c.current = { fixtureId: fixture.id, config, state: createMatch(config), turns: [], wages, settled: false, summary: null };
  return c;
}
function applyProgress(club, state, side) {
  const participants = state.players.filter((p) => p.teamId === side);
  return club.players.map((p) => { const played = participants.find((q) => q.playerId === p.id); return progressPlayer(p, Boolean(played), played?.hp === 0); });
}
function recordFixture(c, fixture, state, homeId, awayId) {
  const winnerId = state.result.winnerId === 'home' ? homeId : state.result.winnerId === 'away' ? awayId : null;
  fixture.result = { winnerId, round: state.result.round };
  const homeProgress = applyProgress(c.clubs.find((club) => club.id === homeId), state, 'home');
  applyProgress(c.clubs.find((club) => club.id === awayId), state, 'away');
  return homeProgress;
}
export function settleCareerMatch(input) {
  const c = clone(input), current = c.current;
  need(current, 'Aucune rencontre en cours.'); if (current.settled) return c;
  need(current.state.finished, 'La rencontre n’est pas terminée.');
  const fixture = c.schedule[c.day].find((f) => f.id === current.fixtureId); need(fixture && !fixture.result, 'Cette rencontre a déjà été réglée.');
  const awayId = fixture.homeId === 'club' ? fixture.awayId : fixture.homeId;
  const progress = recordFixture(c, fixture, current.state, 'club', awayId);
  for (const other of c.schedule[c.day].filter((f) => f.id !== fixture.id)) {
    const home = c.clubs.find((club) => club.id === other.homeId), away = c.clubs.find((club) => club.id === other.awayId);
    const state = simulateMatch({ seed: other.seed, rulesVersion: 3, deployments: { home: clubDeployment(home), away: clubDeployment(away, 'away') }, teamNames: { home: home.name, away: away.name }, kitColors: { home: clubKit(home, c.clubs.indexOf(home)), away: clubKit(away, c.clubs.indexOf(away)) }, strategy: home.strategy, awayStrategy: away.strategy,
      rosters: { home: aiLineup(home).map((id) => compilePlayer(home.players.find((p) => p.id === id))), away: aiLineup(away).map((id) => compilePlayer(away.players.find((p) => p.id === id))) } }).state;
    recordFixture(c, other, state, home.id, away.id);
  }
  const reward = current.state.result.winnerId === 'home' ? 350 : current.state.result.winnerId === 'away' ? 200 : 275;
  const debtBefore = Math.max(0, -c.balance); transact(c, reward, 'Prime de match', fixture.id);
  c.day++; c.completedDays++; c.market = generateMarket(c); c.table = standings(c);
  let seasonPrize = 0, rank = null;
  if (c.day === 10) {
    rank = c.table.findIndex((row) => row.clubId === 'club') + 1; seasonPrize = SEASON_PRIZES[rank - 1];
    transact(c, seasonPrize, `Prime de classement : ${rank}e`, `season-${c.season}`);
    c.seasonHistory.push({ season: c.season, table: clone(c.table), prize: seasonPrize });
  }
  current.settled = true;
  current.summary = { reward, wages: current.wages, debtRepaid: Math.min(debtBefore, reward + seasonPrize), remainingDebt: Math.max(0, -c.balance), available: Math.max(0, c.balance), balance: c.balance, seasonPrize, rank, progress };
  return c;
}
export function saveCareerTurn(input, state, events) {
  const c = clone(input); need(managementLocked(c), 'Aucune rencontre à poursuivre.');
  need(state.seed === c.current.state.seed && state.turns >= c.current.state.turns, 'État de rencontre incompatible.');
  c.current.state = clone(state); c.current.turns.push(JSON.parse(JSON.stringify(events)));
  return state.finished ? settleCareerMatch(c) : c;
}
export function nextSeason(input) {
  const c = clone(input); editable(c); need(c.day === 10, 'Terminez les dix journées.');
  c.season++; c.day = 0; c.current = null;
  for (const club of c.clubs) for (const p of club.players) p.fatigue = 0;
  c.tieOrder = shuffle(c.clubs.map((club) => club.id), `${c.seed}:ties:${c.season}`);
  c.schedule = seasonSchedule(c); c.table = standings(c); return c;
}
