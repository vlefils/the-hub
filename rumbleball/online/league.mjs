// Authoritative league transitions. This module runs on the server; browser
// projections deliberately omit seeds, private clubs and future match frames.
import { createCareer, confirmDraft, configureTeam, recruit, sellPlayer, buyItem, assignProtection, sellProtection, setClubColor, setClubCrest, improveAbilities, aiLineup, equipAiClub } from '../career.mjs';
import { identifyClub, validCrest, cosmeticHash, CRESTS } from '../identity.mjs';
import { createMatch, stepMatch, CURRENT_RULES } from '../engine.mjs';
import { compilePlayer, salary, progressPlayer, recruitmentPrice, MAX_SQUAD_SIZE } from '../progression.mjs';
import { PROFILES } from '../data.mjs';
import { KIT_COLORS } from '../appearance.mjs';
import { clubDeployment } from '../deployment.mjs';
import { clubOpening } from '../openings.mjs';
import { ensureClubDevelopment, automaticAbilityIncreases, XP_THRESHOLDS, MAX_LEVEL } from '../player-development.mjs';
import { createPlayoffs, currentPlayoffRound, playoffFixtures, settlePlayoffFixture, playoffWinner } from '../playoffs.mjs';
import { ensureClubEquipment } from '../equipment.mjs';

export const ONLINE_RULES = Object.freeze({ timezone: 'Europe/Paris', hour: 20, dailyIncome: 210, victoryBonus: 100, breakMs: 120000, roundMs: 12000, kickoffMs: 3500 });
export const MAX_LEAGUE_CLUBS = 128;
export const leagueParticipants = s => [...s.members, ...(s.bots ?? [])];
export const groupDays = count => 2 * (count + count % 2 - 1);
const need = (ok, message) => { if (!ok) throw new Error(message); };
const copy = (value) => structuredClone(value);
const instant = (value) => { const n = new Date(value).getTime(); need(Number.isFinite(n), 'Date invalide.'); return n; };
const iso = (n) => new Date(n).toISOString();
const text = (s, label) => { need(typeof s === 'string' && s.trim().length > 0 && s.trim().length <= 80, `${label} : de 1 à 80 caractères.`); return s.trim(); };
const paris = new Intl.DateTimeFormat('en-CA', { timeZone: ONLINE_RULES.timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' });
export function nextLock(now, includeToday = true) {
  const t = instant(now), parts = Object.fromEntries(paris.formatToParts(t).map((p) => [p.type, p.value]));
  let day = Date.UTC(+parts.year, +parts.month - 1, +parts.day);
  for (let attempt = 0; attempt < 3; attempt++, day += 86400000) {
    // In Paris 20:00 is 18:00 UTC in summer and 19:00 UTC in winter.
    for (const hour of [18, 19]) {
      const candidate = day + hour * 3600000;
      const local = Object.fromEntries(paris.formatToParts(candidate).map((p) => [p.type, p.value]));
      if (+local.hour === 20 && candidate > t && (includeToday || attempt > 0)) return iso(candidate);
    }
  }
  throw new Error('Prochain verrouillage introuvable.');
}

export function makeClub(userId, name, seed, color = '#35bdb3', crestId, cosmeticNamespace = userId, initialRecruitment = false) {
  let career = createCareer(text(name, 'Nom du club'), seed, color);
  if (!initialRecruitment) career = confirmDraft(career, career.market.slice(0, 6).map((p) => p.id));
  // Public cosmetic choices must not encode any part of the secret match seed.
  delete career.clubs[0].crestId;
  for (const p of [...career.clubs[0].players, ...career.market]) { delete p.portraitId; p.name = ''; }
  identifyClub(career.clubs[0], cosmeticNamespace, career.market);
  if (crestId !== undefined) { need(validCrest(crestId), 'Blason inconnu.'); career = setClubCrest(career, crestId); }
  return { ...career.clubs[0], id: userId, lineup: career.lineup, inventory: career.inventory, market: career.market,
    balance: career.balance, transactions: career.transactions };
}
function careerView(club, day) {
  return { status: 'active', clubs: [copy(club)], lineup: copy(club.lineup), inventory: copy(club.inventory), market: copy(club.market),
    balance: club.balance, transactions: copy(club.transactions), season: 1, day, completedDays: day, current: null };
}
const edits = {
  configure: (c, p) => {
    let configured = configureTeam(c, p.lineup, p.assignments ?? {}, p.strategy, p.deployment, p.opening);
    if (p.color !== undefined) configured = setClubColor(configured, p.color);
    return p.crestId === undefined ? configured : setClubCrest(configured, p.crestId);
  },
  recruit: (c, p) => recruit(c, p.playerId), sell: (c, p) => sellPlayer(c, p.playerId),
  advance: (c, p) => improveAbilities(c, p.playerId, p.changes),
  buy: (c, p) => buyItem(c, p.itemId, p.playerId ?? null, p.replaceConfirmed === true, p.location),
  equip: (c, p) => assignProtection(c, p.itemId, p.playerId ?? null, p.location), sellProtection: (c, p) => sellProtection(c, p.itemId),
  color: (c, p) => setClubColor(c, p.color),
};
export function createLeague({ id, userId, name, clubName, color, crestId, inviteCode, seed }, now) {
  need(typeof inviteCode === 'string' && inviteCode.length >= 16, 'Code d’invitation invalide.');
  return { version: 2, id, name: text(name, 'Nom de ligue'), ownerId: userId, inviteCode, seed, capacity: null, status: 'lobby', bots: [], botSequence: 0,
    season: 1, day: 0, completedDays: 0, phase: 'groups', playoffs: null, playoffHistory: [], nextLockAt: null, night: null, history: [],
    members: [{ userId, initialRecruitment: true, club: makeClub(userId, clubName, `${seed}:${userId}`, color, crestId, `${id}:${userId}`, true), draft: null }], createdAt: iso(instant(now)) };
}
export function joinLeague(input, userId, { clubName, color, crestId }, now) {
  const s = copy(input); need(s.status === 'lobby', 'Cette saison a déjà commencé.');
  need(!s.members.some((m) => m.userId === userId), 'Vous participez déjà à cette ligue.');
  need(leagueParticipants(s).length < MAX_LEAGUE_CLUBS, 'La ligue accueille au maximum 128 clubs.');
  s.capacity = null;
  const initialRecruitment = s.version >= 2;
  s.members.push({ userId, initialRecruitment, club: makeClub(userId, clubName, `${s.seed}:${userId}`, color, crestId, `${s.id}:${userId}`, initialRecruitment), draft: null }); return s;
}
export function startLeague(input, userId, now, { firstMatchAt } = {}) {
  const s = copy(input); need(s.ownerId === userId, 'Seul le créateur peut lancer la saison.');
  need(s.status === 'lobby', 'Cette saison a déjà commencé.');
  need(leagueParticipants(s).length >= 2, 'Il faut au moins deux clubs pour commencer.');
  need(typeof firstMatchAt === 'string' && /Z$|[+-]\d{2}:\d{2}$/.test(firstMatchAt), 'Choisissez la date et l’heure du premier match.');
  need(instant(firstMatchAt) > instant(now), 'Le premier match doit être programmé dans le futur.');
  // Old waiting rooms had automatically paid six contracts. Reopen the initial
  // market only when launching those rooms; active seasons are never reset.
  if (s.version < 2) {
    for (const member of s.members) {
      const previous = member.draft ?? member.club;
      member.club = makeClub(member.userId, previous.name, `${s.seed}:${member.userId}`, previous.kitColor, previous.crestId, `${s.id}:${member.userId}`, true);
      member.initialRecruitment = true; member.draft = null;
    }
    s.version = 2;
  }
  s.capacity = leagueParticipants(s).length;
  s.status = s.members.some(m => m.initialRecruitment) ? 'recruitment' : 'preparation';
  s.firstMatchAt = s.nextLockAt = iso(instant(firstMatchAt)); return s;
}
const BOT_NAMES = ['Néon Dogs', 'Circuit Fantôme', 'Chrome Union', 'Les Déphaseurs', 'Secteur Zéro', 'Les Ferrailleurs', 'Signal Noir', 'Les Spectres'];
export function addBot(input, userId) {
  const s = copy(input);
  need(s.ownerId === userId, 'Seul le créateur peut ajouter des bots.');
  need(s.status === 'lobby', 'Les bots se gèrent dans la salle d’attente, avant le lancement.');
  need(leagueParticipants(s).length < MAX_LEAGUE_CLUBS, 'La ligue accueille au maximum 128 clubs.');
  const n = s.botSequence = (s.botSequence ?? 0) + 1, id = `bot:${s.id}:${n}`;
  const name = BOT_NAMES[(n - 1) % BOT_NAMES.length] + (n > BOT_NAMES.length ? ` ${Math.ceil(n / BOT_NAMES.length)}` : '');
  const club = makeClub(id, name, `${s.seed}:${id}`, KIT_COLORS[n % KIT_COLORS.length], undefined, `${s.id}:${id}`);
  club.strategy = ['balanced', 'pressing', 'possession'][(n - 1) % 3];
  (s.bots ??= []).push({ userId: id, club }); s.capacity = null;
  return s;
}
export function removeBot(input, userId, botId) {
  const s = copy(input);
  need(s.ownerId === userId, 'Seul le créateur peut retirer des bots.');
  need(s.status === 'lobby', 'Les bots se gèrent dans la salle d’attente, avant le lancement.');
  need(s.bots?.some(bot => bot.userId === botId), 'Bot introuvable.');
  s.bots = s.bots.filter(bot => bot.userId !== botId); s.capacity = null; return s;
}
export function isLocked(s, now) { return s.status === 'broadcast' || ['recruitment', 'preparation'].includes(s.status) && instant(now) >= instant(s.nextLockAt); }
function recruitInitial(member, ids) {
  const c = confirmDraft({ ...careerView(member.club, 0), status: 'draft' }, ids);
  member.club = { ...c.clubs[0], lineup: c.lineup, inventory: c.inventory, market: c.market, balance: c.balance, transactions: c.transactions };
  member.initialRecruitment = false; member.draft = null;
}
function recruitAtDeadline(member, now) {
  const offers = [...member.club.market].sort((a, b) => recruitmentPrice(a) - recruitmentPrice(b)), ids = [];
  let budget = member.club.balance;
  // A captain, every specialist and two replacements; no equipment purchases.
  for (const archetype of ['capitaine', 'belier', 'escamoteur', 'passeur', 'belier', 'escamoteur']) {
    const available = offers.filter(p => !ids.includes(p.id) && recruitmentPrice(p) <= budget);
    const player = available.find(p => PROFILES[p.profile].archetype === archetype) ?? available[0];
    if (!player) break;
    ids.push(player.id); budget -= recruitmentPrice(player);
  }
  recruitInitial(member, ids);
  member.autoRecruitedAt = iso(instant(now));
}
export function editPreparation(input, userId, command, payload, now) {
  const s = copy(input), member = s.members.find((m) => m.userId === userId);
  need(member, 'Vous ne participez pas à cette ligue.'); need(!isLocked(s, now), 'Équipes verrouillées pour la soirée.');
  need(['recruitment', 'preparation'].includes(s.status), s.status === 'lobby' ? 'Le recrutement ouvre au lancement de la saison.' : 'Préparation indisponible.');
  if (command === 'initialRecruit') {
    need(member.initialRecruitment === true && s.status === 'recruitment', 'Votre effectif initial est déjà recruté.');
    need(Array.isArray(payload.playerIds) && payload.playerIds.length <= MAX_SQUAD_SIZE, 'Sélectionnez de cinq à dix joueurs différents.');
    recruitInitial(member, payload.playerIds);
    if (s.members.every(m => !m.initialRecruitment)) s.status = 'preparation';
    return s;
  }
  need(!member.initialRecruitment, 'Choisissez et validez votre effectif initial avant de préparer votre équipe.');
  if (command === 'cancel') { member.draft = null; return s; }
  need(Object.hasOwn(edits, command), 'Commande inconnue.');
  const source = copy(member.draft ?? member.club);
  identifyClub(source, `${s.id}:${userId}`, source.market);
  ensureClubDevelopment(source, `${s.id}:${userId}`);
  const c = edits[command](careerView(source, s.completedDays % 10), payload);
  member.draft = { ...c.clubs[0], lineup: c.lineup, inventory: c.inventory, market: c.market, balance: c.balance, transactions: c.transactions };
  return s;
}
export function fixturesFor(s) {
  if (s.phase === 'playoffs') return playoffFixtures(s.playoffs).map(match => [match.homeId, match.awayId]);
  const ids = leagueParticipants(s).map((m) => m.userId);
  if (ids.length < 2) return [];
  if (ids.length % 2) ids.push(null);
  const n = ids.length, day = s.day % (2 * (n - 1));
  for (let i = 0; i < day % (n - 1); i++) ids.splice(1, 0, ids.pop());
  return Array.from({ length: n / 2 }, (_, i) => day < n - 1 ? [ids[i], ids[n - 1 - i]] : [ids[n - 1 - i], ids[i]]).filter(pair => pair.every(Boolean));
}
function configFor(s, [homeId, awayId], seed) {
  const clubs = leagueParticipants(s), home = clubs.find((m) => m.userId === homeId).club, away = clubs.find((m) => m.userId === awayId).club;
  return { seed, rulesVersion: CURRENT_RULES, teamNames: { home: home.name, away: away.name }, kitColors: { home: home.kitColor, away: away.kitColor }, crestIds: { home: home.crestId, away: away.crestId },
    strategy: home.strategy, awayStrategy: away.strategy, openings: { home: clubOpening(home), away: clubOpening(away) },
    deployments: { home: clubDeployment(home), away: clubDeployment(away, 'away') },
    rosters: Object.fromEntries([['home', home], ['away', away]].map(([side, c]) => [side, c.lineup.map((id) => compilePlayer(c.players.find((p) => p.id === id), c.inventory))])) };
}
function computeRound(game) {
  let state = game.broadcast.final; const round = state.round, turns = [];
  do { const before = state, step = stepMatch(state, { stopAtRoundEnd: true }); state = step.state; turns.push({ before, after: state, events: step.events }); }
  while (!state.finished && state.round === round);
  game.broadcast.rounds.push({ round, turns }); game.broadcast.final = state;
  if (state.finished) game.endsAt = iso(instant(game.playsAt) + game.broadcast.rounds.length * ONLINE_RULES.roundMs);
}
function transaction(club, amount, label, id) {
  if (club.transactions.some((t) => t.id === id)) return;
  club.balance += amount; club.transactions.push({ id, amount, label, balance: club.balance });
}
function prepareBot(s, bot) {
  let c = bot.club;
  for (const p of c.players) automaticAbilityIncreases(p);
  const reserve = () => c.players.reduce((sum, p) => sum + salary(p), 0);
  if (c.players.length < MAX_SQUAD_SIZE) {
    const count = profile => c.players.filter(p => PROFILES[p.profile].archetype === PROFILES[profile].archetype).length;
    const offer = [...c.market].sort((a, b) => count(a.profile) - count(b.profile) || recruitmentPrice(a) - recruitmentPrice(b)).find(p => c.balance - reserve() >= recruitmentPrice(p) + salary(p));
    if (offer) {
      const recruited = recruit(careerView(c, s.completedDays % 10), offer.id);
      c = { ...recruited.clubs[0], lineup: recruited.lineup, inventory: recruited.inventory, market: recruited.market, balance: recruited.balance, transactions: recruited.transactions };
      for (const p of c.players) automaticAbilityIncreases(p);
    }
  }
  ensureClubEquipment(c, c.market);
  equipAiClub(c, s.completedDays + 1, (amount, label) => transaction(c, amount, label, `bot-gear-${s.completedDays}-${c.transactions.length}`));
  c.lineup = aiLineup(c); bot.club = c;
}
function freezeNight(s, now) {
  const start = Math.max(instant(s.nextLockAt), instant(now));
  for (const m of leagueParticipants(s)) {
    if (m.draft) m.club = m.draft;
    identifyClub(m.club, `${s.id}:${m.userId}`, m.club.market);
    ensureClubDevelopment(m.club, `${s.id}:${m.userId}`);
    m.draft = null;
    transaction(m.club, ONLINE_RULES.dailyIncome, 'Revenu de ligue', `income-${s.completedDays}`);
    transaction(m.club, -m.club.players.reduce((n, p) => n + salary(p), 0), 'Salaires de la journée', `wages-${s.completedDays}`);
  }
  for (const bot of s.bots ?? []) prepareBot(s, bot);
  const fixtures = fixturesFor(s), playing = new Set(fixtures.flat());
  if (s.phase !== 'playoffs') for (const m of leagueParticipants(s)) if (!playing.has(m.userId)) {
    for (const p of m.club.players) progressPlayer(p, false, false);
  }
  const games = fixtures.map((sides, index) => {
    const playoff = s.phase === 'playoffs' ? playoffFixtures(s.playoffs)[index] : null;
    const id = playoff?.id ?? `${s.id}:s${s.season}:d${s.day}:m${index}`, seed = `${s.seed}:${id}`;
    const config = configFor(s, sides, seed), initial = createMatch(config);
    return { id, phase: s.phase ?? 'groups', homeId: sides[0], awayId: sides[1], config, startsAt: index ? null : iso(start), playsAt: index ? null : iso(start + ONLINE_RULES.kickoffMs),
      endsAt: null, broadcast: { initial, rounds: [], final: initial }, settled: false };
  });
  s.status = 'broadcast'; s.night = { day: s.day, season: s.season, phase: s.phase ?? 'groups', name: s.phase === 'playoffs' ? currentPlayoffRound(s.playoffs).name : `Journée ${s.day + 1}`, startsAt: iso(start), games, endsAt: games.at(-1).endsAt };
}
function settle(s, game) {
  if (game.settled) return;
  const state = game.broadcast.final, winnerId = state.result.winnerId === 'home' ? game.homeId : state.result.winnerId === 'away' ? game.awayId : null;
  for (const [side, id] of [['home', game.homeId], ['away', game.awayId]]) {
    const c = leagueParticipants(s).find((m) => m.userId === id).club;
    ensureClubDevelopment(c, `${s.id}:${id}`);
    for (const p of c.players) {
      const played = state.players.find((q) => q.teamId === side && q.playerId === p.id);
      progressPlayer(p, Boolean(played), played?.hp === 0);
    }
    if (id === winnerId) transaction(c, ONLINE_RULES.victoryBonus, 'Prime de victoire', `win-${game.id}`);
    // Personal offers are deterministic and generated once after the match.
    const offers = createCareer(c.name, `${s.seed}:${id}:market:${s.completedDays + 1}`, c.kitColor).market;
    const indices = [0, 1, 2, 4, 8, 10];
    c.market = indices.map((i, n) => ({ ...offers[i], id: `offer-${s.completedDays + 1}-${n}`, xp: XP_THRESHOLDS[Math.min(MAX_LEVEL - 1, Math.floor((s.completedDays + 1) / 5))] }));
    for (const p of c.market) { delete p.portraitId; p.name = ''; }
    identifyClub(c, `${s.id}:${id}`, c.market);
  }
  game.settled = true;
  if (game.phase === 'playoffs') settlePlayoffFixture(s.playoffs, game.id, { winnerId, round: state.result.round });
  const qualification = game.phase === 'playoffs' ? { qualifiedId: playoffWinner(s.playoffs, game.homeId, game.awayId, winnerId), decision: winnerId ? 'match' : 'ranking' } : {};
  s.history.push({ id: game.id, phase: game.phase ?? 'groups', season: s.season, day: s.day, homeId: game.homeId, awayId: game.awayId, winnerId, ...qualification, rounds: state.round, endsAt: game.endsAt, replayAvailable: true });
}
export function advanceLeague(input, now, { maxRounds = Infinity } = {}) {
  const s = copy(input), t = instant(now);
  if (s.status === 'recruitment' && t >= instant(s.nextLockAt)) {
    for (const member of s.members) if (member.initialRecruitment) recruitAtDeadline(member, now);
    s.status = 'preparation';
  }
  if (s.status === 'preparation' && t >= instant(s.nextLockAt)) freezeNight(s, now);
  if (s.status !== 'broadcast') return s;
  for (const [index, game] of s.night.games.entries()) {
    if (!game.startsAt) break;
    while (maxRounds > 0 && !game.broadcast.final.finished) { computeRound(game); maxRounds--; }
    if (game.endsAt && s.night.games[index + 1]) {
      const next = s.night.games[index + 1]; next.startsAt = iso(instant(game.endsAt) + ONLINE_RULES.breakMs);
      next.playsAt = iso(instant(next.startsAt) + ONLINE_RULES.kickoffMs);
    }
    if (game.broadcast.final.finished && t >= instant(game.endsAt)) settle(s, game);
  }
  s.night.endsAt = s.night.games.at(-1).endsAt;
  if (s.night.games.every((g) => g.settled)) {
    s.status = 'preparation'; s.day++; s.completedDays++;
    if (s.phase === 'playoffs' && s.playoffs.championId) {
      (s.playoffHistory ??= []).push({ season: s.season, bracket: copy(s.playoffs) });
      s.season++; s.day = 0; s.phase = 'groups'; s.playoffs = null;
      for (const m of leagueParticipants(s)) for (const p of m.club.players) p.fatigue = 0;
    } else if (s.phase !== 'playoffs' && s.day === groupDays(leagueParticipants(s).length)) {
      s.playoffs = createPlayoffs(leagueTable(s).map(row => row.id), `${s.id}:s${s.season}:playoffs`); s.phase = 'playoffs';
      for (const m of leagueParticipants(s)) for (const p of m.club.players) p.fatigue = 0;
    }
    // Recover one delayed evening without retroactively playing many seasons.
    s.nextLockAt = nextLock(now);
  }
  return s;
}
export function leagueTable(s) {
  const rows = leagueParticipants(s).map((m, order) => ({ id: m.userId, name: m.club.name, order, played: 0, wins: 0, draws: 0, losses: 0, points: 0 }));
  for (const g of s.history.filter(g => g.season === s.season && g.phase !== 'playoffs')) for (const id of [g.homeId, g.awayId]) {
    const r = rows.find((r) => r.id === id); r.played++;
    if (!g.winnerId) { r.draws++; r.points++; } else if (g.winnerId === id) { r.wins++; r.points += 3; } else r.losses++;
  }
  return rows.sort((a, b) => b.points - a.points || b.wins - a.wins || a.order - b.order);
}
function publicState(state, id) {
  const view = copy(state); view.seed = id; view.rng = 0; return view;
}
export function replayProjection(s, userId, matchId, archive, now) {
  need(s.members.some(m => m.userId === userId), 'Accès réservé aux participants.');
  const result = s.history.find(g => g.id === matchId);
  need(result && instant(result.endsAt) <= instant(now), 'Replay disponible uniquement après la fin de la rencontre.');
  const recent = s.night?.games.find(g => g.id === matchId && g.settled);
  const data = archive ?? (recent ? { initial: recent.broadcast.initial, rounds: recent.broadcast.rounds } : null);
  need(data?.initial && Array.isArray(data.rounds) && data.rounds.length, 'Les images de cette ancienne rencontre ne sont plus disponibles.');
  return { id: matchId, season: result.season, day: result.day, phase: result.phase ?? 'groups', endsAt: result.endsAt,
    initial: publicState(data.initial, matchId), rounds: data.rounds.map(round => ({ round: round.round,
      turns: round.turns.map(turn => ({ before: publicState(turn.before, matchId), after: publicState(turn.after, matchId), events: copy(turn.events) })) })) };
}
export function leagueProjection(s, userId, now) {
  const member = s.members.find((m) => m.userId === userId); need(member, 'Accès réservé aux participants.');
  const ownClub = copy(member.draft ?? member.club);
  ensureClubEquipment(ownClub, ownClub.market);
  identifyClub(ownClub, `${s.id}:${userId}`, ownClub.market);
  ensureClubDevelopment(ownClub, `${s.id}:${userId}`);
  const t = instant(now), night = s.night;
  const games = night?.games.map((g) => {
    const ended = Boolean(g.endsAt && t >= instant(g.endsAt)), started = Boolean(g.startsAt && t >= instant(g.startsAt));
    return { id: g.id, homeId: g.homeId, awayId: g.awayId, homeName: g.config.teamNames.home, awayName: g.config.teamNames.away,
      startsAt: g.startsAt, playsAt: g.playsAt, endsAt: g.endsAt, status: ended ? 'finished' : started ? 'live' : 'scheduled',
      phase: g.phase ?? 'groups', result: ended ? { winnerId: g.broadcast.final.result.winnerId === 'home' ? g.homeId : g.broadcast.final.result.winnerId === 'away' ? g.awayId : null } : null };
  }) ?? [];
  const active = night?.games.find((g) => g.startsAt && t >= instant(g.startsAt) && (!g.endsAt || t < instant(g.endsAt)));
  let broadcast = null, waitingForServer = false;
  if (active) {
    const elapsed = Math.max(0, t - instant(active.playsAt)), index = Math.floor(elapsed / ONLINE_RULES.roundMs);
    const round = active.broadcast.rounds[index];
    waitingForServer = t >= instant(active.playsAt) && !round;
    if (!waitingForServer) broadcast = { id: active.id, initial: publicState(active.broadcast.initial, active.id), playsAt: active.playsAt,
      roundStartsAt: iso(instant(active.playsAt) + index * ONLINE_RULES.roundMs),
      turns: t < instant(active.playsAt) ? [] : round.turns.map((turn) => ({ before: publicState(turn.before, active.id), after: publicState(turn.after, active.id), events: copy(turn.events) })) };
  }
  return { id: s.id, name: s.name, ownerId: s.ownerId, capacity: s.status === 'lobby' ? null : s.capacity, maxClubs: MAX_LEAGUE_CLUBS, status: s.status, season: s.season, day: s.day,
    phase: s.phase ?? 'groups', playoffs: copy(s.playoffs ?? null), playoffHistory: copy(s.playoffHistory ?? []),
    members: leagueParticipants(s).map((m) => ({ userId: m.userId, name: m.club.name, ready: !m.initialRecruitment, isBot: (s.bots ?? []).some(bot => bot.userId === m.userId), kitColor: m.club.kitColor, crestId: m.club.crestId ?? CRESTS[cosmeticHash(`${s.id}:${m.userId}:crest`) % CRESTS.length].id })), inviteCode: s.status === 'lobby' ? s.inviteCode : null,
    serverTime: iso(t), suggestedFirstMatchAt: s.status === 'lobby' ? nextLock(now) : null, nextLockAt: s.nextLockAt, locked: isLocked(s, now), rules: ONLINE_RULES,
    club: ownClub, needsRecruitment: Boolean(member.initialRecruitment), autoRecruitedAt: member.autoRecruitedAt ?? null, firstMatchAt: s.firstMatchAt ?? null, hasDraft: Boolean(member.draft), table: leagueTable(s), games, broadcast, waitingForServer,
    history: s.history.map(g => ({ ...copy(g), replayAvailable: Boolean(g.replayAvailable || s.night?.games.some(game => game.id === g.id && game.settled)) })), upcoming: s.status === 'lobby' ? [] : s.status === 'broadcast' ? s.night.games.map(({ homeId, awayId }) => ({ homeId, awayId })) : fixturesFor(s).map(([homeId, awayId]) => ({ homeId, awayId })) };
}
