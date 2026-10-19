// Authoritative league transitions. This module runs on the server; browser
// projections deliberately omit seeds, private clubs and future match frames.
import { createCareer, confirmDraft, configureTeam, recruit, sellPlayer, buyItem, assignProtection, sellProtection, setClubColor, setClubCrest, improveAbilities } from '../career.mjs';
import { identifyClub, validCrest, cosmeticHash, CRESTS } from '../identity.mjs';
import { createMatch, stepMatch, CURRENT_RULES } from '../engine.mjs';
import { compilePlayer, salary, progressPlayer } from '../progression.mjs';
import { clubDeployment } from '../deployment.mjs';
import { clubOpening } from '../openings.mjs';
import { ensureClubDevelopment, XP_THRESHOLDS, MAX_LEVEL } from '../player-development.mjs';

export const ONLINE_RULES = Object.freeze({ timezone: 'Europe/Paris', hour: 20, dailyIncome: 210, victoryBonus: 100, breakMs: 120000, roundMs: 12000, kickoffMs: 3500 });
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

export function makeClub(userId, name, seed, color = '#35bdb3', crestId, cosmeticNamespace = userId) {
  let career = createCareer(text(name, 'Nom du club'), seed, color);
  career = confirmDraft(career, career.market.slice(0, 6).map((p) => p.id));
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
  buy: (c, p) => buyItem(c, p.itemId, p.playerId ?? null, p.replaceConfirmed === true),
  equip: (c, p) => assignProtection(c, p.itemId, p.playerId ?? null), sellProtection: (c, p) => sellProtection(c, p.itemId),
  color: (c, p) => setClubColor(c, p.color),
};
export function createLeague({ id, userId, name, clubName, color, crestId, inviteCode, seed, capacity = 6 }, now) {
  need([2, 4, 6, 8].includes(capacity), 'Une ligue accueille 2, 4, 6 ou 8 clubs.');
  need(typeof inviteCode === 'string' && inviteCode.length >= 16, 'Code d’invitation invalide.');
  return { version: 1, id, name: text(name, 'Nom de ligue'), ownerId: userId, inviteCode, seed, capacity, status: 'lobby',
    season: 1, day: 0, completedDays: 0, nextLockAt: null, night: null, history: [],
    members: [{ userId, club: makeClub(userId, clubName, `${seed}:${userId}`, color, crestId, `${id}:${userId}`), draft: null }], createdAt: iso(instant(now)) };
}
export function joinLeague(input, userId, { clubName, color, crestId }, now) {
  const s = copy(input); need(s.status === 'lobby', 'Cette saison a déjà commencé.');
  need(!s.members.some((m) => m.userId === userId), 'Vous participez déjà à cette ligue.');
  need(s.members.length < s.capacity, 'La ligue est complète.');
  s.members.push({ userId, club: makeClub(userId, clubName, `${s.seed}:${userId}`, color, crestId, `${s.id}:${userId}`), draft: null }); return s;
}
export function startLeague(input, userId, now) {
  const s = copy(input); need(s.ownerId === userId, 'Seul le créateur peut lancer la saison.');
  need(s.status === 'lobby' && s.members.length === s.capacity, 'La ligue doit être complète pour commencer.');
  s.status = 'preparation'; s.nextLockAt = nextLock(now); return s;
}
export function isLocked(s, now) { return s.status === 'broadcast' || s.status === 'preparation' && instant(now) >= instant(s.nextLockAt); }
export function editPreparation(input, userId, command, payload, now) {
  const s = copy(input), member = s.members.find((m) => m.userId === userId);
  need(member, 'Vous ne participez pas à cette ligue.'); need(!isLocked(s, now), 'Équipes verrouillées pour la soirée.');
  need(['lobby', 'preparation'].includes(s.status), 'Préparation indisponible.');
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
  const ids = s.members.map((m) => m.userId), n = ids.length, day = s.day % (2 * (n - 1));
  for (let i = 0; i < day % (n - 1); i++) ids.splice(1, 0, ids.pop());
  return Array.from({ length: n / 2 }, (_, i) => day < n - 1 ? [ids[i], ids[n - 1 - i]] : [ids[n - 1 - i], ids[i]]);
}
function configFor(s, [homeId, awayId], seed) {
  const home = s.members.find((m) => m.userId === homeId).club, away = s.members.find((m) => m.userId === awayId).club;
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
function freezeNight(s, now) {
  const start = Math.max(instant(s.nextLockAt), instant(now));
  for (const m of s.members) {
    if (m.draft) m.club = m.draft;
    identifyClub(m.club, `${s.id}:${m.userId}`, m.club.market);
    ensureClubDevelopment(m.club, `${s.id}:${m.userId}`);
    m.draft = null;
    transaction(m.club, ONLINE_RULES.dailyIncome, 'Revenu de ligue', `income-${s.completedDays}`);
    transaction(m.club, -m.club.players.reduce((n, p) => n + salary(p), 0), 'Salaires de la journée', `wages-${s.completedDays}`);
  }
  const games = fixturesFor(s).map((sides, index) => {
    const id = `${s.id}:s${s.season}:d${s.day}:m${index}`, seed = `${s.seed}:${id}`;
    const config = configFor(s, sides, seed), initial = createMatch(config);
    return { id, homeId: sides[0], awayId: sides[1], config, startsAt: index ? null : iso(start), playsAt: index ? null : iso(start + ONLINE_RULES.kickoffMs),
      endsAt: null, broadcast: { initial, rounds: [], final: initial }, settled: false };
  });
  s.status = 'broadcast'; s.night = { day: s.day, season: s.season, startsAt: iso(start), games, endsAt: games.at(-1).endsAt };
}
function settle(s, game) {
  if (game.settled) return;
  const state = game.broadcast.final, winnerId = state.result.winnerId === 'home' ? game.homeId : state.result.winnerId === 'away' ? game.awayId : null;
  for (const [side, id] of [['home', game.homeId], ['away', game.awayId]]) {
    const c = s.members.find((m) => m.userId === id).club;
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
  s.history.push({ id: game.id, season: s.season, day: s.day, homeId: game.homeId, awayId: game.awayId, winnerId, rounds: state.round, endsAt: game.endsAt, replayAvailable: true });
}
export function advanceLeague(input, now, { maxRounds = Infinity } = {}) {
  const s = copy(input), t = instant(now);
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
    if (s.day === 2 * (s.members.length - 1)) { s.season++; s.day = 0; for (const m of s.members) for (const p of m.club.players) p.fatigue = 0; }
    // Recover one delayed evening without retroactively playing many seasons.
    s.nextLockAt = nextLock(now);
  }
  return s;
}
export function leagueTable(s) {
  const rows = s.members.map((m, order) => ({ id: m.userId, name: m.club.name, order, played: 0, wins: 0, draws: 0, losses: 0, points: 0 }));
  for (const g of s.history.filter((g) => g.season === s.season)) for (const id of [g.homeId, g.awayId]) {
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
  return { id: matchId, season: result.season, day: result.day, endsAt: result.endsAt,
    initial: publicState(data.initial, matchId), rounds: data.rounds.map(round => ({ round: round.round,
      turns: round.turns.map(turn => ({ before: publicState(turn.before, matchId), after: publicState(turn.after, matchId), events: copy(turn.events) })) })) };
}
export function leagueProjection(s, userId, now) {
  const member = s.members.find((m) => m.userId === userId); need(member, 'Accès réservé aux participants.');
  const ownClub = copy(member.draft ?? member.club);
  identifyClub(ownClub, `${s.id}:${userId}`, ownClub.market);
  ensureClubDevelopment(ownClub, `${s.id}:${userId}`);
  const t = instant(now), night = s.night;
  const games = night?.games.map((g) => {
    const ended = Boolean(g.endsAt && t >= instant(g.endsAt)), started = Boolean(g.startsAt && t >= instant(g.startsAt));
    return { id: g.id, homeId: g.homeId, awayId: g.awayId, homeName: g.config.teamNames.home, awayName: g.config.teamNames.away,
      startsAt: g.startsAt, playsAt: g.playsAt, endsAt: g.endsAt, status: ended ? 'finished' : started ? 'live' : 'scheduled',
      result: ended ? { winnerId: g.broadcast.final.result.winnerId === 'home' ? g.homeId : g.broadcast.final.result.winnerId === 'away' ? g.awayId : null } : null };
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
  return { id: s.id, name: s.name, ownerId: s.ownerId, capacity: s.capacity, status: s.status, season: s.season, day: s.day,
    members: s.members.map((m) => ({ userId: m.userId, name: m.club.name, kitColor: m.club.kitColor, crestId: m.club.crestId ?? CRESTS[cosmeticHash(`${s.id}:${m.userId}:crest`) % CRESTS.length].id })), inviteCode: s.status === 'lobby' ? s.inviteCode : null,
    serverTime: iso(t), nextLockAt: s.nextLockAt, locked: isLocked(s, now), rules: ONLINE_RULES,
    club: ownClub, hasDraft: Boolean(member.draft), table: leagueTable(s), games, broadcast, waitingForServer,
    history: s.history.map(g => ({ ...copy(g), replayAvailable: Boolean(g.replayAvailable || s.night?.games.some(game => game.id === g.id && game.settled)) })), upcoming: fixturesFor(s).map(([homeId, awayId]) => ({ homeId, awayId })) };
}
