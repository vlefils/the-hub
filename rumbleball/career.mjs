import { PROFILES, ROLES, INSTRUCTIONS, STRATEGIES, clone } from './data.mjs';
import { createMatch, simulateMatch, seedHash, CURRENT_RULES } from './engine.mjs';
import { compilePlayer, recruitmentPrice, salary, levelOf, progressPlayer, CATALOGUE, XP_THRESHOLDS, MAX_SQUAD_SIZE, MAX_LEVEL } from './progression.mjs';
import { ensurePlayerDevelopment, ensureCareerDevelopment, applyAbilityIncrease, automaticAbilityIncreases } from './player-development.mjs';
import { playerName } from './player-names.mjs';
import { KIT_COLORS, clubKit, validKitColor } from './appearance.mjs';
import { identifyCareer, identifyClub, playerGender, validCrest } from './identity.mjs';
import { clubDeployment, validDeployment } from './deployment.mjs';
import { DEFAULT_OPENING, clubOpening, openingDeployment, validOpening } from './openings.mjs';
import { createPlayoffs, currentPlayoffRound, playoffFixtures, settlePlayoffFixture } from './playoffs.mjs';
import { equipMutable, compatibleLocation, equipmentDefinition, itemLocation } from './equipment.mjs';

export const SEASON_PRIZES = [600, 400, 200, 100, 100, 100];
const CLUBS = [
  ['Les Charognards', 'Équilibre', 'balanced', [0, 1, 2, 3, 4, 2, 4]],
  ['Les Brise-Chrome', 'Blocage', 'pressing', [1, 3, 1, 0, 2, 3, 4]],
  ['Les Voltigeurs', 'Mobilité', 'balanced', [2, 2, 0, 4, 3, 2, 0]],
  ['Circuit Ouvert', 'Passes', 'possession', [4, 0, 4, 2, 1, 0, 4]],
  ['Les Crocs Néon', 'Pressing', 'pressing', [3, 2, 1, 0, 4, 3, 2]],
];
const CLUB_OPENINGS = ['breakaway', 'cage', 'wings', 'fallback', 'press'];
function random(seed) { let value = seedHash(seed); return () => { value = (Math.imul(value, 1664525) + 1013904223) >>> 0; return value / 4294967296; }; }
function shuffle(values, seed) {
  const result = [...values], next = random(seed);
  for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
}
const need = (condition, message) => { if (!condition) throw new Error(message); };
const team = (career) => career.clubs[0];
const identifiedCopy = (career) => ensureCareerPlayoffs(ensureCareerDevelopment(identifyCareer(clone(career))));
export const ownedPlayers = (career) => team(career).players;
export const payroll = (career) => ownedPlayers(career).reduce((sum, p) => sum + salary(p), 0);
export const managementLocked = (career) => Boolean(career.current && !career.current.settled);
export const careerFixtures = career => career.day < 10 ? career.schedule[career.day] ?? [] : playoffFixtures(career.playoffs);
export const nextFixture = career => careerFixtures(career).find(f => [f.homeId, f.awayId].includes('club')) ?? null;
export const careerSeasonFinished = career => career.day === 10 && Boolean(career.playoffs?.championId);
export function ensureCareerPlayoffs(career) {
  if (career.day === 10 && !career.playoffs) {
    career.playoffs = createPlayoffs(standings(career).map(row => row.clubId), `s${career.season}-playoffs`);
    for (const club of career.clubs) for (const p of club.players) p.fatigue = 0;
  }
  return career;
}
const editable = (career) => need(career.status === 'active' && !managementLocked(career), 'La gestion est verrouillée pendant la rencontre.');
export function purchaseBlock(career, price) {
  return managementLocked(career) ? 'Rencontre en cours : gestion en lecture seule.' : price > 0 && career.balance < 0 ? 'Salaires impayés : remboursez le solde avant tout achat.' : price > 0 && career.balance < price ? `Il manque ${price - career.balance} chromas.` : '';
}
function spend(career, amount, label) { need(!purchaseBlock(career, amount), purchaseBlock(career, amount)); transact(career, amount === 0 ? 0 : -amount, label); }
function transact(career, amount, label, fixtureId = null) {
  career.balance += amount;
  career.transactions.push({ id: `t${career.transactions.length + 1}`, season: career.season, day: Math.min(10, career.day + 1), amount, label, fixtureId, balance: career.balance });
}
function player(id, name, profile, level = 1, seed = id) {
  return ensurePlayerDevelopment({ id, name, profile, xp: XP_THRESHOLDS[level - 1], fatigue: 0, role: PROFILES[profile].role, instruction: 'normal', implant: null }, `${seed}:${id}`);
}
function generateMarket(career, initial = false) {
  const profiles = initial ? [0, 1, 2, 3, 4, 0, 0, 1, 2, 2, 4, 4] : [0, 1, 2, 4, ...shuffle([0, 1, 2, 3, 4], `${career.seed}:market:${career.completedDays}`).slice(0, 2)];
  const used = new Set(career.clubs.flatMap(club => club.players.map(p => p.name)));
  const market = profiles.map((profile, index) => {
    const playoffDay = career.playoffs ? `-p${career.playoffs.rounds.filter(round => round.matches.every(match => match.winnerId)).length}` : '';
    const id = `offer-${career.completedDays}${playoffDay}-${index}`, name = initial && index < 5 ? PROFILES[profile].trainingName : playerName(`${career.seed}:name:${id}`, used, 'neutral', PROFILES[profile].archetype); used.add(name);
    return player(id, name, profile, Math.min(MAX_LEVEL, 1 + Math.floor(career.completedDays / 5)), career.seed);
  });
  identifyClub(team(career), `${career.seed}:club`, market);
  return market;
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
    clubs: [{ id: 'club', name: name.trim(), kitColor, style: 'Votre club', strategy: 'balanced', opening: DEFAULT_OPENING, deployment: openingDeployment(), players: [] }, ...CLUBS.map(([clubName, style, strategy, profiles], index) => ({ id: `ai-${index}`, name: clubName, kitColor: KIT_COLORS[index + 1], style, strategy, opening: CLUB_OPENINGS[index], deployment: openingDeployment(CLUB_OPENINGS[index]),
      balance: 600, inventory: [], transactions: [],
      players: profiles.map((profile, number) => { const p = player(`ai-${index}-${number}`, `${PROFILES[profile].name} ${number + 1}`, profile, 1, seed); if ([1, 4].includes(index)) p.instruction = 'aggressive'; if (index === 1) p.role = number < 3 ? 'blocker' : p.role; if (index === 3 && number < 3) p.role = 'relay'; return p; }) }))],
    lineup: [], inventory: [], transactions: [], market: [], schedule: [], tieOrder: [], current: null, playoffs: null, seasonHistory: [] };
  career.market = generateMarket(career, true);
  career.tieOrder = shuffle(career.clubs.map((c) => c.id), `${career.seed}:ties:1`);
  career.schedule = seasonSchedule(career); career.table = standings(career);
  return identifyCareer(career);
}
export function confirmDraft(input, ids) {
  const c = identifiedCopy(input); need(c.status === 'draft', 'Club déjà créé.');
  need(new Set(ids).size === ids.length && ids.length >= 5 && ids.length <= MAX_SQUAD_SIZE, 'Sélectionnez de cinq à dix joueurs différents.');
  const selected = ids.map((id) => c.market.find((p) => p.id === id)); need(selected.every(Boolean), 'Candidat inconnu.');
  spend(c, selected.reduce((sum, p) => sum + recruitmentPrice(p), 0), 'Contrats initiaux');
  team(c).players = selected; c.lineup = ids.slice(0, 5); c.market = c.market.filter((p) => !ids.includes(p.id)); c.status = 'active'; return c;
}
export function configureTeam(input, lineup, assignments, strategy, deployment, opening) {
  const c = identifiedCopy(input); editable(c);
  need(lineup.length === 5 && new Set(lineup).size === 5 && lineup.every((id) => ownedPlayers(c).some((p) => p.id === id)), 'Choisissez exactement cinq titulaires distincts.');
  need(Object.hasOwn(STRATEGIES, strategy), 'Plan collectif inconnu.');
  if (opening !== undefined) { need(validOpening(opening), 'Ouverture inconnue.'); team(c).opening = opening; }
  if (deployment !== undefined) { need(validDeployment(deployment), 'Placez cinq joueurs distincts dans votre moitié de terrain.'); team(c).deployment = clone(deployment); }
  for (const p of ownedPlayers(c)) { const a = assignments[p.id]; if (!a) continue; need(Object.hasOwn(ROLES, a.role) && Object.hasOwn(INSTRUCTIONS, a.instruction), 'Consigne inconnue.'); p.role = a.role; p.instruction = a.instruction; }
  c.lineup = [...lineup]; team(c).strategy = strategy; return c;
}
export function setClubColor(input, color) {
  const c = identifiedCopy(input); need(!managementLocked(c), 'La gestion est verrouillée pendant la rencontre.');
  need(validKitColor(color), 'Couleur de maillot invalide.'); team(c).kitColor = color.toLowerCase(); return c;
}
export function setClubCrest(input, crestId) {
  const c = identifiedCopy(input); need(!managementLocked(c), 'La gestion est verrouillée pendant la rencontre.');
  need(validCrest(crestId), 'Blason inconnu.'); team(c).crestId = crestId; return c;
}
export function recruit(input, id) {
  const c = identifiedCopy(input); editable(c); need(ownedPlayers(c).length < MAX_SQUAD_SIZE, 'Effectif complet : dix joueurs maximum.');
  const p = c.market.find((q) => q.id === id); need(p, 'Offre indisponible.'); spend(c, recruitmentPrice(p), `Recrutement : ${p.name}`);
  team(c).players.push(p); c.market = c.market.filter((q) => q.id !== id); return c;
}
export function improveAbilities(input, playerId, changes) {
  const c = identifiedCopy(input); editable(c);
  const p = ownedPlayers(c).find(p => p.id === playerId); need(p, 'Joueur inconnu.');
  applyAbilityIncrease(p, changes); return c;
}
export function sellPlayer(input, id) {
  const c = identifiedCopy(input); editable(c); need(ownedPlayers(c).length > 5, 'Cinq joueurs minimum dans le club.');
  const p = ownedPlayers(c).find((q) => q.id === id); need(p, 'Joueur inconnu.');
  transact(c, recruitmentPrice(p) / 2, `Cession : ${p.name}`);
  for (const item of c.inventory) if (item.playerId === id) item.playerId = null;
  team(c).players = ownedPlayers(c).filter((q) => q.id !== id);
  c.lineup = c.lineup.filter((q) => q !== id); if (c.lineup.length < 5) c.lineup.push(ownedPlayers(c).find((q) => !c.lineup.includes(q.id)).id);
  return c;
}
export function buyItem(input, itemId, playerId = null, replaceConfirmed = false, location) {
  const c = identifiedCopy(input); editable(c); const item = equipmentDefinition(itemId); need(item, 'Article inconnu.');
  need(location === undefined || compatibleLocation(itemId, location), 'Emplacement incompatible.');
  const p = ownedPlayers(c).find((q) => q.id === playerId);
  need(playerId === null || p, 'Joueur inconnu.');
  if (item.price === 0) {
    need(p, 'Sélectionnez un joueur pour cette dotation gratuite.');
    const current = c.inventory.find(q => q.itemId === itemId && q.playerId === p.id && (item.hands === 2 || itemLocation(q) === (location ?? 'rightHand')));
    if (current) return c;
    const reserve = c.inventory.find(q => q.itemId === itemId && q.playerId === null);
    if (reserve) { assignProtectionMutable(c, reserve.id, p.id, location); return c; }
  }
  if (item.slot === 'implant') { need(p, 'Sélectionnez un joueur.'); need(!p.implant || replaceConfirmed, 'Le remplacement détruit l’ancien implant. Confirmez ce remplacement.'); }
  spend(c, item.price, `${item.name}${p ? ` : ${p.name}` : ''}`);
  if (item.slot === 'implant') p.implant = itemId;
  else { const id = `gear-${c.transactions.length}`; c.inventory.push({ id, itemId, playerId: null }); if (p) assignProtectionMutable(c, id, p.id, location); }
  return c;
}
function assignProtectionMutable(c, id, playerId, location) {
  need(playerId === null || ownedPlayers(c).some((p) => p.id === playerId), 'Joueur inconnu.');
  equipMutable(c.inventory, id, playerId, location);
}
export function assignProtection(input, id, playerId, location) { const c = identifiedCopy(input); editable(c); assignProtectionMutable(c, id, playerId, location); return c; }
export function sellProtection(input, id) {
  const c = identifiedCopy(input); editable(c); const item = c.inventory.find((q) => q.id === id); need(item, 'Équipement inconnu.');
  transact(c, CATALOGUE[item.itemId].price / 2, `Vente : ${CATALOGUE[item.itemId].name}`); c.inventory = c.inventory.filter((q) => q.id !== id); return c;
}
export function aiLineup(club) {
  return [...club.players].sort((a, b) => a.fatigue - b.fatigue || b.xp - a.xp || a.id.localeCompare(b.id)).slice(0, 5).map((p) => p.id);
}
function manageAiClub(c, club, fixture, wages, winnerId) {
  for (const p of club.players) automaticAbilityIncreases(p);
  // Old saves acquire the same starting management budget when first settled.
  club.balance ??= 600; club.inventory ??= []; club.transactions ??= [];
  const transaction = (amount, label) => {
    club.balance += amount;
    club.transactions.push({ id: `${fixture.id}-${club.transactions.length}`, fixtureId: fixture.id, amount, label, balance: club.balance });
  };
  transaction(-wages, 'Salaires de la journée');
  transaction(!winnerId ? 275 : winnerId === club.id ? 350 : 200, 'Prime de match');
  const reserve = () => club.players.reduce((sum, p) => sum + salary(p), 0);
  const budget = () => Math.max(0, club.balance - reserve());
  let recruited = false;
  if (club.players.length < MAX_SQUAD_SIZE) {
    const preferred = CLUBS[Number(club.id.slice(3))]?.[3] ?? [0, 1, 2, 3, 4];
    const count = profile => club.players.filter(p => PROFILES[p.profile].archetype === PROFILES[profile].archetype).length;
    const profile = [...new Set(preferred)].sort((a, b) => count(a) - count(b))[0];
    const id = `${club.id}-recruit-${c.completedDays + 1}${c.day === 10 ? `-${fixture.id}` : ''}`, used = new Set(c.clubs.flatMap(other => other.players.map(p => p.name)).concat(c.market.map(p => p.name)));
    const p = automaticAbilityIncreases(player(id, playerName(`${c.seed}:name:${id}`, used, 'neutral', PROFILES[profile].archetype), profile, Math.min(MAX_LEVEL, 1 + Math.floor((c.completedDays + 1) / 5)), c.seed));
    identifyClub(club, `${c.seed}:${club.id}`, [p]);
    p.name = playerName(`${c.seed}:name:${id}`, used, playerGender(p), PROFILES[profile].archetype);
    if (budget() >= recruitmentPrice(p) + salary(p)) { transaction(-recruitmentPrice(p), `Recrutement : ${p.name}`); club.players.push(p); recruited = true; }
  }
  // Keep savings for the next contract instead of spending them on gear daily.
  if (!recruited && club.players.length < MAX_SQUAD_SIZE && club.inventory.length) return;
  const order = aiLineup(club).map(id => club.players.find(p => p.id === id));
  order.push(...club.players.filter(p => !order.includes(p)));
  const unprotected = order.find(p => !club.inventory.some(item => item.playerId === p.id && CATALOGUE[item.itemId]?.slot === 'protection'));
  const implant = order.find(p => !p.implant && club.inventory.some(item => item.playerId === p.id && CATALOGUE[item.itemId]?.slot === 'protection'));
  const armable = order.find(p => !club.inventory.some(item => item.playerId === p.id && (CATALOGUE[item.itemId]?.enhancement ?? 0) > 0));
  if (armable && club.players.some(p => p.implant) && (c.completedDays + 1) % 2 === 0) {
    const heavy = PROFILES[armable.profile].archetype === 'belier', upgrade = heavy ? 'gravity_maul' : 'arc_tonfa';
    const armed = club.inventory.some(item => item.playerId === armable.id && CATALOGUE[item.itemId]?.die);
    const itemId = budget() >= CATALOGUE[upgrade].price ? upgrade : !armed ? heavy ? 'maul' : 'tonfa' : null;
    if (itemId) {
      transaction(CATALOGUE[itemId].price === 0 ? 0 : -CATALOGUE[itemId].price, `${CATALOGUE[itemId].name} : ${armable.name}`);
      const reserve = CATALOGUE[itemId].price === 0 && club.inventory.find(item => item.itemId === itemId && item.playerId === null);
      const id = reserve?.id ?? `${club.id}-gear-${club.transactions.length}`;
      if (!reserve) club.inventory.push({ id, itemId, playerId: null }); equipMutable(club.inventory, id, armable.id, 'rightHand'); return;
    }
  }
  const firstImplant = implant && club.inventory.length >= 3 && !club.players.some(p => p.implant);
  if (firstImplant && budget() < 300) return;
  const upgrade = firstImplant || implant && (c.completedDays + 1) % 3 === 0 && budget() >= 300;
  const p = upgrade ? implant : unprotected ?? implant;
  if (!p) return;
  const type = PROFILES[p.profile].archetype;
  const protection = p === unprotected;
  const itemId = protection ? type === 'belier' ? 'gloves' : type === 'capitaine' ? 'vest' : 'soles'
    : p.fatigue >= 3 ? 'regulator' : type === 'escamoteur' ? 'legs' : type === 'passeur' ? 'interface' : 'fibers';
  if (budget() < CATALOGUE[itemId].price) return;
  transaction(-CATALOGUE[itemId].price, `${CATALOGUE[itemId].name} : ${p.name}`);
  if (protection) club.inventory.push({ id: `${club.id}-gear-${club.transactions.length}`, itemId, playerId: p.id });
  else p.implant = itemId;
}
function matchConfig(c, fixture) {
  // Keep the managed club on the left of the broadcast, even in an away fixture.
  const home = team(c), away = c.clubs.find((club) => club.id === (fixture.homeId === 'club' ? fixture.awayId : fixture.homeId));
  return { seed: fixture.seed ?? `${c.seed}:${fixture.id}`, rulesVersion: CURRENT_RULES, openings: { home: clubOpening(home), away: clubOpening(away) }, deployments: { home: clubDeployment(home), away: clubDeployment(away, 'away') }, teamNames: { home: home.name, away: away.name }, kitColors: { home: clubKit(home), away: clubKit(away, c.clubs.indexOf(away)) }, crestIds: { home: home.crestId, away: away.crestId }, strategy: home.strategy, awayStrategy: away.strategy,
    rosters: { home: c.lineup.map((id) => compilePlayer(home.players.find((p) => p.id === id), c.inventory)), away: aiLineup(away).map((id) => compilePlayer(away.players.find((p) => p.id === id), away.inventory)) } };
}
export function launchCareerMatch(input) {
  const c = identifiedCopy(input); editable(c); const fixture = nextFixture(c); need(fixture && !fixture.result, 'La saison est terminée.');
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
  const result = { winnerId, round: state.result.round };
  if (c.day === 10) settlePlayoffFixture(c.playoffs, fixture.id, result); else fixture.result = result;
  const home = c.clubs.find(club => club.id === homeId), away = c.clubs.find(club => club.id === awayId);
  const wages = [home, away].map(club => club.players.reduce((sum, p) => sum + salary(p), 0));
  const homeProgress = applyProgress(home, state, 'home'); applyProgress(away, state, 'away');
  for (const [index, club] of [home, away].entries()) if (club.id !== 'club') manageAiClub(c, club, fixture, wages[index], winnerId);
  return homeProgress;
}
function simulateOtherFixture(c, fixture) {
  const home = c.clubs.find(club => club.id === fixture.homeId), away = c.clubs.find(club => club.id === fixture.awayId);
  const state = simulateMatch({ seed: fixture.seed ?? `${c.seed}:${fixture.id}`, rulesVersion: CURRENT_RULES, openings: { home: clubOpening(home), away: clubOpening(away) }, deployments: { home: clubDeployment(home), away: clubDeployment(away, 'away') }, teamNames: { home: home.name, away: away.name }, kitColors: { home: clubKit(home, c.clubs.indexOf(home)), away: clubKit(away, c.clubs.indexOf(away)) }, strategy: home.strategy, awayStrategy: away.strategy,
    rosters: { home: aiLineup(home).map(id => compilePlayer(home.players.find(p => p.id === id), home.inventory)), away: aiLineup(away).map(id => compilePlayer(away.players.find(p => p.id === id), away.inventory)) } }).state;
  recordFixture(c, fixture, state, home.id, away.id);
}
function archivePlayoffs(c) {
  if (c.playoffs?.championId) Object.assign(c.seasonHistory.at(-1), { championId: c.playoffs.championId, playoffs: clone(c.playoffs) });
}
export function advanceCareerPlayoffs(input) {
  const c = identifiedCopy(input); editable(c);
  need(c.day === 10 && currentPlayoffRound(c.playoffs), 'Aucun tour de playoffs à jouer.');
  need(!nextFixture(c), 'Votre club doit disputer sa rencontre.');
  for (const fixture of [...careerFixtures(c)]) simulateOtherFixture(c, fixture);
  archivePlayoffs(c); c.market = generateMarket(c); return c;
}
export function settleCareerMatch(input) {
  const c = identifiedCopy(input), current = c.current;
  need(current, 'Aucune rencontre en cours.'); if (current.settled) return c;
  need(current.state.finished, 'La rencontre n’est pas terminée.');
  const fixtures = [...careerFixtures(c)], group = c.day < 10;
  const fixture = fixtures.find(f => f.id === current.fixtureId); need(fixture && !fixture.result, 'Cette rencontre a déjà été réglée.');
  const awayId = fixture.homeId === 'club' ? fixture.awayId : fixture.homeId;
  const progress = recordFixture(c, fixture, current.state, 'club', awayId);
  for (const other of fixtures.filter(f => f.id !== fixture.id)) simulateOtherFixture(c, other);
  const reward = current.state.result.winnerId === 'home' ? 350 : current.state.result.winnerId === 'away' ? 200 : 275;
  const debtBefore = Math.max(0, -c.balance); transact(c, reward, 'Prime de match', fixture.id);
  if (group) { c.day++; c.completedDays++; }
  c.market = generateMarket(c); identifyCareer(c); c.table = standings(c);
  let seasonPrize = 0, rank = null;
  if (group && c.day === 10) {
    rank = c.table.findIndex((row) => row.clubId === 'club') + 1; seasonPrize = SEASON_PRIZES[rank - 1];
    transact(c, seasonPrize, `Prime de classement : ${rank}e`, `season-${c.season}`);
    c.seasonHistory.push({ season: c.season, table: clone(c.table), prize: seasonPrize });
    ensureCareerPlayoffs(c);
    for (const entry of progress) entry.fatigue = 0;
  }
  archivePlayoffs(c);
  current.settled = true;
  current.summary = { reward, wages: current.wages, debtRepaid: Math.min(debtBefore, reward + seasonPrize), remainingDebt: Math.max(0, -c.balance), available: Math.max(0, c.balance), balance: c.balance, seasonPrize, rank, progress, ...(group && c.day === 10 ? { fatigueReset: true } : {}) };
  return c;
}
export function saveCareerTurn(input, state, events) {
  const c = identifiedCopy(input); need(managementLocked(c), 'Aucune rencontre à poursuivre.');
  need(state.seed === c.current.state.seed && state.turns >= c.current.state.turns, 'État de rencontre incompatible.');
  c.current.state = clone(state); c.current.turns.push(JSON.parse(JSON.stringify(events)));
  return state.finished ? settleCareerMatch(c) : c;
}
export function nextSeason(input) {
  const c = identifiedCopy(input); editable(c); need(careerSeasonFinished(c), 'Terminez la phase de groupe et les playoffs.');
  c.season++; c.day = 0; c.current = null; c.playoffs = null;
  for (const club of c.clubs) for (const p of club.players) p.fatigue = 0;
  c.tieOrder = shuffle(c.clubs.map((club) => club.id), `${c.seed}:ties:${c.season}`);
  c.schedule = seasonSchedule(c); c.table = standings(c); return c;
}
