import { startReadyLeague as startLeague } from '../test-support/online.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createLeague, joinLeague, addBot, removeBot, editPreparation, advanceLeague, nextLock, isLocked, fixturesFor, leagueProjection, leagueParticipants, groupDays, ONLINE_RULES } from './league.mjs';
import { salary, compilePlayer } from '../progression.mjs';
import { createLeagueService } from './server.mjs';

const day = '2026-10-18T10:00:00Z', lock = '2026-10-18T18:00:00.000Z';
function fixture(capacity = 2) {
  let s = createLeague({ id: 'league', userId: 'u0', name: 'Ligue des Rebuts', clubName: 'Les Recrues', inviteCode: 'a'.repeat(32), seed: 'online-tests', capacity }, day);
  for (let i = 1; i < capacity; i++) s = joinLeague(s, `u${i}`, { clubName: `Club ${i}` }, day);
  return startLeague(s, 'u0', day);
}

test('Paris : 20 h en été/hiver, changement d’heure et frontière exacte du verrouillage', () => {
  assert.equal(nextLock(day), lock);
  assert.equal(nextLock('2026-10-25T10:00:00Z'), '2026-10-25T19:00:00.000Z');
  assert.equal(nextLock('2027-03-28T10:00:00Z'), '2027-03-28T18:00:00.000Z');
  assert.equal(nextLock('2026-12-31T20:00:00Z'), '2027-01-01T19:00:00.000Z');
  assert.equal(nextLock(lock), '2026-10-19T18:00:00.000Z');
  const s = fixture(); assert.equal(isLocked(s, '2026-10-18T17:59:59.999Z'), false); assert.equal(isLocked(s, lock), true);
});
test('lobby ouvert : au moins deux clubs, propriétaire, participants uniques et inscriptions closes au lancement', () => {
  const s = createLeague({ id: 'l', userId: 'u', name: 'Ligue', clubName: 'Club', inviteCode: 'a'.repeat(32), seed: 's' }, day);
  assert.equal(s.capacity, null); assert.deepEqual(leagueProjection(s, 'u', day).upcoming, []);
  assert.throws(() => startLeague(s, 'u', day), /au moins deux/);
  assert.throws(() => joinLeague(s, 'u', { clubName: 'Autre' }, day), /déjà/);
  assert.throws(() => startLeague(s, 'other', day), /créateur/);
  const full = fixture(); assert.throws(() => joinLeague(full, 'new', { clubName: 'Tard' }, day), /commencé/);
});
test('préparation : achats et équipe persistants, annulation intégrale et état initial non muté', () => {
  const s = fixture(), before = structuredClone(s), member = s.members[0];
  assert.equal(member.club.players.length, 6); assert.equal(member.club.balance, 600);
  let prepared = editPreparation(s, 'u0', 'buy', { itemId: 'vest', playerId: member.club.players[0].id, balance: 999999 }, day);
  assert.equal(prepared.members[0].club.balance, 600); assert.equal(prepared.members[0].draft.balance, 500);
  assert.equal(prepared.members[0].draft.inventory.length, 1);
  prepared = editPreparation(prepared, 'u0', 'cancel', {}, day);
  assert.deepEqual(prepared, before); assert.deepEqual(s, before);
  assert.throws(() => editPreparation(s, 'u0', 'cancel', {}, lock), /verrouillées/);
  assert.throws(() => editPreparation(s, 'intruder', 'buy', {}, day), /participez/);
  assert.throws(() => editPreparation(s, 'u0', 'replaceState', { balance: 999999 }, day), /inconnue/);
});

test('équipement serveur : deux mains indépendantes, protections localisées, annulation et compilation figée', () => {
  const initial = fixture(), before = structuredClone(initial), player = initial.members[0].club.players[0];
  let s = initial;
  for (const [itemId, location] of [['tonfa', 'rightHand'], ['tonfa', 'leftHand'], ['gloves', 'gloves'], ['soles', 'feet']]) s = editPreparation(s, 'u0', 'buy', { itemId, playerId: player.id, location }, day);
  const draft = s.members[0].draft; assert.equal(draft.inventory.length, 4); assert.equal(draft.balance, 300);
  assert.equal(draft.inventory.filter(item => item.itemId === 'tonfa').length, 2);
  assert.deepEqual(draft.inventory.filter(item => item.itemId === 'tonfa').map(item => item.location), ['rightHand', 'leftHand']);
  assert.equal(leagueProjection(s, 'u1', day).club.inventory.length, 0);
  assert.deepEqual(editPreparation(s, 'u0', 'cancel', {}, day), before); assert.deepEqual(initial, before);
  const frozen = advanceLeague(s, lock), compiled = frozen.night.games[0].config.rosters.home[0];
  assert.equal(compiled.offhandAttack.die, 6); assert.equal(compiled.skills.wrestling, compilePlayer(player).skills.wrestling + 1);
  assert.equal(compiled.visualGear.gloves, 'gloves'); assert.equal(compiled.visualGear.feet, 'soles');
  assert.throws(() => editPreparation(s, 'u0', 'equip', { itemId: draft.inventory[0].id, playerId: player.id, location: 'head' }, day), /incompatible/);
  assert.throws(() => editPreparation(s, 'u0', 'equip', { itemId: draft.inventory[0].id, playerId: player.id, location: 'leftHand' }, lock), /verrouillées/);
});

test('équipement serveur : emplacement falsifié refusé sans débit et deux mains remettent les anciennes armes en réserve', () => {
  const initial = fixture(), p = initial.members[0].club.players[0];
  for (const payload of [{ itemId: 'maul', location: 'head' }, { itemId: 'helmet', location: 'leftHand' }, { itemId: 'tonfa', location: '__proto__' }]) assert.throws(() => editPreparation(initial, 'u0', 'buy', { ...payload, playerId: p.id }, day), /incompatible/);
  assert.equal(initial.members[0].club.balance, 600); assert.equal(initial.members[0].draft, null);
  let s = editPreparation(initial, 'u0', 'buy', { itemId: 'tonfa', playerId: p.id, location: 'rightHand' }, day);
  s = editPreparation(s, 'u0', 'buy', { itemId: 'shield', playerId: p.id, location: 'leftHand' }, day);
  s = editPreparation(s, 'u0', 'buy', { itemId: 'maul', playerId: p.id, location: 'rightHand' }, day);
  const draft = s.members[0].draft; assert.equal(draft.inventory.filter(item => item.playerId === p.id).length, 1);
  assert.ok(draft.inventory.slice(0, 2).every(item => item.playerId === null)); assert.equal(draft.balance, 600);
  const frozen = advanceLeague(s, lock).night.games[0].config.rosters.home[0];
  assert.equal(frozen.attack.die, 6); assert.equal(frozen.attack.count, 2); assert.equal(frozen.offhandAttack, null);
});

test('catalogue serveur : dotation gratuite, tarifs autoritaires, arme avancée figée et annulation', () => {
  const initial = fixture(), p = initial.members[0].club.players[0], before = structuredClone(initial);
  let s = editPreparation(initial, 'u0', 'buy', { itemId: 'tonfa', playerId: p.id, location: 'leftHand' }, day);
  s = editPreparation(s, 'u0', 'buy', { itemId: 'tonfa', playerId: p.id, location: 'leftHand' }, day);
  assert.equal(s.members[0].draft.inventory.length, 1); assert.equal(s.members[0].draft.balance, 600);
  s = editPreparation(s, 'u0', 'buy', { itemId: 'arc_tonfa', playerId: p.id, location: 'rightHand', price: 0, enhancement: 99 }, day);
  assert.equal(s.members[0].draft.balance, 200); assert.equal(initial.members[0].club.balance, 600);
  assert.throws(() => editPreparation(s, 'u0', 'buy', { itemId: 'ghost_baton', playerId: p.id, price: 0 }, day), /manque/);
  for (const itemId of ['ghost_blade', 'sword', 'spear']) assert.throws(() => editPreparation(s, 'u0', 'buy', { itemId, playerId: p.id }, day), /inconnu/);
  const frozen = advanceLeague(s, lock).night.games[0].config.rosters.home[0], base = compilePlayer(p);
  assert.equal(frozen.attack.bonus, base.attack.bonus + 1); assert.equal(frozen.attack.flat, base.attack.flat + 1); assert.equal(frozen.offhandAttack.flat, 0);
  assert.deepEqual(editPreparation(s, 'u0', 'cancel', {}, day), before);
});

test('améliorations serveur : choix contrôlés, brouillon annulable, propriétaire et verrouillage', async () => {
  const s = fixture(), p = s.members[0].club.players[0]; p.xp = 50;
  const before = structuredClone(s);
  assert.throws(() => editPreparation(s, 'u0', 'advance', { playerId: p.id, changes: { charisma: 3 } }, day), /deux/);
  // Club-local identifiers coincide; the other member has no points to spend.
  assert.throws(() => editPreparation(s, 'u1', 'advance', { playerId: p.id, changes: { charisma: 2 } }, day), /Aucune/);
  let prepared = editPreparation(s, 'u0', 'advance', { playerId: p.id, changes: { charisma: 1, mind: 1 }, abilities: { charisma: 99 } }, day);
  const improved = prepared.members[0].draft.players[0];
  assert.equal(improved.abilities.charisma, p.abilities.charisma); assert.deepEqual(improved.advancements, [{ level: 3, changes: { charisma: 1, mind: 1 } }]);
  assert.deepEqual(s, before); assert.deepEqual(prepared.members[1], s.members[1]);
  assert.equal(leagueProjection(prepared, 'u0', day).club.players[0].advancements.length, 1);
  assert.throws(() => editPreparation(prepared, 'u0', 'advance', { playerId: p.id, changes: { mind: 2 } }, day), /Aucune/);
  assert.deepEqual(editPreparation(prepared, 'u0', 'cancel', {}, day), before);
  assert.throws(() => editPreparation(prepared, 'u0', 'advance', { playerId: p.id, changes: { mind: 2 } }, lock), /verrouillées/);
  const frozen = advanceLeague(prepared, lock);
  assert.equal(frozen.members[0].club.players[0].advancements.length, 1);
  const live = frozen.night.games[0].config.rosters.home.find(q => q.playerId === p.id);
  assert.equal(live.abilities.charisma, p.abilities.charisma + 1); assert.equal(live.proficiencyBonus, 2);
  let state = s, revision = 1;
  const service = createLeagueService({ async get() { return { id: state.id, state: structuredClone(state), revision }; }, async commit(id, expected, next) { assert.equal(expected, revision); state = next; return ++revision; } }, { now: () => day });
  const result = await service.command('u0', { action: 'advance', leagueId: s.id, payload: { playerId: p.id, changes: { constitution: 2 } } });
  assert.equal(result.league.club.players[0].advancements.length, 1); assert.equal(result.revision, 2);
});
test('calendrier ouvert : aller-retour pair ou impair et au-delà de huit clubs, avec repos équilibrés', () => {
  for (const capacity of [2, 3, 4, 5, 6, 7, 8, 10, 12]) {
    const s = fixture(capacity), pairs = new Set();
    const rests = new Map(s.members.map(m => [m.userId, 0]));
    for (s.day = 0; s.day < groupDays(capacity); s.day++) {
      const fixtures = fixturesFor(s); assert.equal(new Set(fixtures.flat()).size, capacity - capacity % 2);
      for (const id of rests.keys()) if (!fixtures.flat().includes(id)) rests.set(id, rests.get(id) + 1);
      for (const [home, away] of fixtures) { const key = `${home}:${away}`; assert.equal(pairs.has(key), false); pairs.add(key); }
    }
    assert.equal(pairs.size, capacity * (capacity - 1));
    assert.ok([...rests.values()].every(count => count === (capacity % 2 ? 2 : 0)));
  }
});
test('soirée : tous figés à 20 h, salaires uniques, revenu fixe, deux minutes de pause et résultats à l’heure', () => {
  let s = fixture(6); const initial = structuredClone(s);
  s = editPreparation(s, 'u0', 'buy', { itemId: 'vest', playerId: s.members[0].club.lineup[0] }, day);
  s = advanceLeague(s, lock); assert.equal(s.status, 'broadcast'); assert.equal(s.night.games.length, 3);
  assert.equal(s.members[0].draft, null); assert.equal(s.members[0].club.inventory.length, 1);
  for (const m of s.members) {
    const wages = m.club.transactions.filter((t) => t.label === 'Salaires de la journée'); assert.equal(wages.length, 1);
    assert.equal(wages[0].amount, -90);
    assert.equal(m.club.transactions.filter((t) => t.label === 'Revenu de ligue').length, 1);
  }
  const [first, second] = s.night.games;
  assert.equal(Date.parse(second.startsAt) - Date.parse(first.endsAt), ONLINE_RULES.breakMs);
  const again = advanceLeague(s, lock); assert.deepEqual(again, s);
  const beforeEnd = leagueProjection(s, 'u0', new Date(Date.parse(first.endsAt) - 1)); assert.equal(beforeEnd.games[0].result, null);
  const partial = advanceLeague(s, first.endsAt); assert.equal(partial.status, 'broadcast'); assert.equal(partial.history.length, 1);
  const finished = advanceLeague(partial, s.night.endsAt); assert.equal(finished.status, 'preparation'); assert.equal(finished.completedDays, 1);
  assert.equal(finished.history.length, 3);
  for (const m of finished.members) {
    const winner = finished.history.some((g) => g.winnerId === m.userId);
    assert.equal(m.club.balance, 600 - (m.userId === 'u0' ? 100 : 0) + 210 - 90 + Number(winner) * 100);
    assert.ok(m.club.players.filter((p) => m.club.lineup.includes(p.id)).every((p) => p.xp === 10));
    assert.ok(m.club.players.filter((p) => !m.club.lineup.includes(p.id)).every((p) => p.xp === 4));
  }
  assert.deepEqual(advanceLeague(finished, s.night.endsAt), finished);
  assert.equal(initial.members[0].club.balance, 600);
});

test('banc en ligne : la Constitution pilote la récupération au règlement du match', () => {
  let s = fixture();
  const low = s.members[0].club.players[5], high = s.members[1].club.players[5];
  low.fatigue = high.fatigue = 6;
  low.abilities = { strength: 15, dexterity: 15, constitution: 8, mind: 13, charisma: 8 };
  high.abilities = { strength: 13, dexterity: 15, constitution: 15, mind: 8, charisma: 8 };
  s = advanceLeague(s, lock); s = advanceLeague(s, s.night.endsAt);
  assert.equal(s.members[0].club.players[5].fatigue, 4); assert.equal(s.members[1].club.players[5].fatigue, 1);
  assert.equal(s.members[0].club.players[5].xp, 4); assert.equal(s.members[1].club.players[5].xp, 4);
});
test('diffusion : pas de préparation adverse, pas de prochain round, pas de graine privée', () => {
  let s = fixture(); s = editPreparation(s, 'u0', 'sell', { playerId: s.members[0].club.players[5].id }, day);
  const other = leagueProjection(s, 'u1', day); assert.equal(other.club.players.length, 6);
  assert.equal('draft' in other.members[0], false); assert.equal('seed' in other, false);
  s = advanceLeague(s, lock); const g = s.night.games[0], p = leagueProjection(s, 'u0', g.playsAt);
  assert.equal(p.broadcast.turns[0].before.round, 1); assert.ok(p.broadcast.turns.length <= 10);
  assert.equal(p.broadcast.initial.rng, 0); assert.equal(p.broadcast.initial.seed, g.id);
  assert.equal('config' in p.games[0], false); assert.equal('broadcast' in p.games[0], false);
  assert.equal(p.games[0].result, null); assert.throws(() => leagueProjection(s, 'outsider', lock), /réservé/);
});
test('revenu fixe : couvre six salaires niveau 5, achat sans découvert, dette réduite par revenu', () => {
  let s = fixture(); const c = s.members[0].club; c.players.forEach((p) => { p.xp = 140; }); c.balance = -50;
  assert.equal(c.players.reduce((n, p) => n + salary(p), 0), ONLINE_RULES.dailyIncome);
  assert.throws(() => editPreparation(s, 'u0', 'buy', { itemId: 'vest' }, day), /impayés/);
  s = advanceLeague(s, lock); assert.equal(s.members[0].club.balance, -50);
  assert.equal(s.members[0].club.transactions.filter((t) => t.label === 'Revenu de ligue')[0].amount, 210);
});
test('deux saisons : progression conservée, fatigue remise à zéro et récupération sans avalanche de journées', () => {
  let s = fixture();
  for (let i = 0; i < 6; i++) { s = advanceLeague(s, s.nextLockAt); s = advanceLeague(s, s.night.endsAt); }
  assert.equal(s.season, 3); assert.equal(s.day, 0); assert.equal(s.completedDays, 6); assert.equal(s.history.length, 6);
  assert.ok(s.members.every((m) => m.club.players.every((p) => p.fatigue === 0 && p.xp > 0)));
  let late = advanceLeague(s, '2027-10-18T22:00:00Z'); assert.equal(late.completedDays, 6); assert.equal(late.status, 'broadcast');
  late = advanceLeague(late, late.night.endsAt); assert.equal(late.completedDays, 7); assert.equal(late.nextLockAt, '2027-10-19T18:00:00.000Z');
});

test('worker fractionné : un seul round par appel, même résultat que le calcul complet et attente explicite si retard', () => {
  const initial = fixture(6), full = advanceLeague(initial, lock);
  let sliced = advanceLeague(initial, lock, { maxRounds: 1 });
  assert.deepEqual(sliced.night.games.map((g) => g.broadcast.rounds.length), [1, 0, 0]);
  const delayed = leagueProjection(sliced, 'u0', '2026-10-18T18:01:00Z');
  assert.equal(delayed.broadcast, null); assert.equal(delayed.waitingForServer, true); assert.equal(delayed.games[0].result, null);
  let calls = 1;
  while (sliced.night.games.some((g) => !g.broadcast.final.finished)) {
    assert.ok(++calls <= 39); sliced = advanceLeague(sliced, lock, { maxRounds: 1 });
  }
  assert.deepEqual(sliced, full);
  const done = advanceLeague(sliced, sliced.night.endsAt, { maxRounds: 1 });
  assert.equal(done.history.length, 3); assert.equal(done.completedDays, 1);
});

test('service : authentification, projection, conflit réessayé et double worker sans double paiement', async () => {
  let state = fixture(), revision = 1, conflicts = 1, clock = day;
  const store = {
    async get(id) { return id === state.id ? { id, state: structuredClone(state), revision } : null; },
    async commit(id, expected, next) { if (conflicts-- > 0 || expected !== revision) throw new Error('RB_CONFLICT'); state = next; return ++revision; },
    async due() { return [{ id: state.id }]; }, async list() { return []; },
  };
  const service = createLeagueService(store, { now: () => clock });
  await assert.rejects(() => service.command(null, { action: 'get', leagueId: 'league' }), /Authentification/);
  await assert.rejects(() => service.command('other', { action: 'get', leagueId: 'league' }), /réservé/);
  const updated = await service.command('u0', { action: 'color', leagueId: 'league', payload: { color: '#abc123' } });
  assert.equal(updated.league.club.kitColor, '#abc123'); assert.equal(updated.league.hasDraft, true);
  clock = lock; await Promise.all([service.tick(), service.tick()]);
  assert.equal(state.members[0].club.transactions.filter((t) => t.label === 'Salaires de la journée').length, 1);
  let calls = 0; while (!state.night.games[0].broadcast.final.finished) { assert.ok(++calls <= 13); await service.tick(); }
  clock = state.night.endsAt; await service.tick(); await service.tick(); assert.equal(state.history.length, 1);
});

test('bots : ajout et retrait réservés au créateur, identifiants persistants et aucune fausse adhésion Auth', () => {
  const initial = createLeague({ id: 'l', userId: 'owner', name: 'Ligue', clubName: 'Club', inviteCode: 'a'.repeat(32), seed: 'bots' }, day);
  let s = addBot(initial, 'owner'); const first = s.bots[0].userId;
  assert.equal(initial.bots.length, 0); assert.equal(s.members.length, 1); assert.equal(s.bots[0].club.balance, 600);
  s = joinLeague(s, 'friend', { clubName: 'Ami' }, day);
  assert.throws(() => addBot(s, 'friend'), /créateur/);
  assert.throws(() => removeBot(s, 'friend', first), /créateur/);
  assert.throws(() => removeBot(s, 'owner', 'friend'), /introuvable/);
  s = removeBot(s, 'owner', first); s = addBot(s, 'owner');
  assert.notEqual(s.bots[0].userId, first);
  const view = leagueProjection(s, 'owner', day);
  assert.equal(view.members.length, 3); assert.equal(view.members.filter(m => m.isBot).length, 1);
  assert.equal(view.members.at(-1).club, undefined); assert.equal(view.capacity, null);
  assert.throws(() => leagueProjection(s, s.bots[0].userId, day), /réservé/);
  assert.throws(() => editPreparation(s, s.bots[0].userId, 'buy', {}, day), /participez/);
  s = startLeague(s, 'owner', day); assert.equal(s.capacity, 3);
  assert.throws(() => addBot(s, 'owner'), /avant le lancement/);
  assert.throws(() => removeBot(s, 'owner', s.bots[0].userId), /avant le lancement/);
});

test('bots : achats réels au tarif commun, rotation, recrutement et niveaux sur plusieurs saisons', () => {
  let s = createLeague({ id: 'bots', userId: 'human', name: 'Ligue', clubName: 'Club', inviteCode: 'a'.repeat(32), seed: 'bot-management' }, day);
  s = startLeague(addBot(s, 'human'), 'human', day);
  const initial = structuredClone(s);
  for (let i = 0; i < 18; i++) {
    const oldLineup = [...s.bots[0].club.lineup];
    const transactionCount = s.bots[0].club.transactions.length;
    s = advanceLeague(s, s.nextLockAt, { maxRounds: 0 });
    const c = s.bots[0].club, purchases = c.transactions.filter(t => t.id.startsWith('bot-gear-'));
    const spent = c.transactions.slice(transactionCount).some(t => t.amount < 0 && t.label !== 'Salaires de la journée');
    if (spent) assert.ok(c.balance >= c.players.reduce((sum, p) => sum + salary(p), 0), 'Les achats réservent les prochains salaires ; les salaires seuls peuvent réduire cette réserve.');
    assert.ok(c.inventory.some(item => item.location === 'rightHand'));
    assert.equal(new Set(c.inventory.map(item => item.id)).size, c.inventory.length);
    assert.deepEqual(advanceLeague(s, s.nextLockAt, { maxRounds: 0 }), s, 'Un nouvel appel du worker ne rachète pas d’équipement.');
    if (!i) { assert.equal(c.players.length, 7); assert.ok(purchases.some(t => t.amount < 0)); }
    if (i === 1) assert.notDeepEqual(c.lineup, oldLineup, 'Les remplaçants reposés entrent en jeu.');
    s = advanceLeague(s, s.nextLockAt); s = advanceLeague(s, s.night.endsAt);
  }
  const bot = s.bots[0].club;
  assert.ok(bot.players.length > 6 && bot.players.length <= 10); assert.ok(bot.players.some(p => p.advancements.length));
  assert.equal(initial.bots[0].club.inventory.length, 0);
});

test('bot solvable : une arme avancée est achetée, débitée et compilée dans la bonne main', () => {
  let s = createLeague({ id: 'rich', userId: 'human', name: 'Ligue', clubName: 'Club', inviteCode: 'a'.repeat(32), seed: 'rich-bot' }, day);
  s = startLeague(addBot(s, 'human'), 'human', day); s.completedDays = 1;
  s.bots[0].club.balance = 2000; s.bots[0].club.players[0].implant = 'fibers';
  s = advanceLeague(s, s.nextLockAt, { maxRounds: 0 });
  const bot = s.bots[0].club, gear = bot.inventory.find(item => ['arc_tonfa', 'gravity_maul'].includes(item.itemId));
  assert.ok(gear); assert.equal(gear.location, 'rightHand');
  const cost = gear.itemId === 'arc_tonfa' ? 400 : 600;
  assert.ok(bot.transactions.some(t => t.id.startsWith('bot-gear-') && t.amount === -cost));
  assert.equal(bot.balance, 2000 + 210 - 90 - 300 - cost);
  const compiled = s.night.games[0].config.rosters.away.find(p => p.playerId === gear.playerId);
  assert.equal(compiled.attack.bonus, compilePlayer(bot.players.find(p => p.id === gear.playerId)).attack.bonus + 1);
});

test('bot solvable : implant acheté après les protections et bonus présents au coup d’envoi', () => {
  let s = createLeague({ id: 'implant', userId: 'human', name: 'Ligue', clubName: 'Club', inviteCode: 'a'.repeat(32), seed: 'implant-bot' }, day);
  s = startLeague(addBot(s, 'human'), 'human', day);
  const c = s.bots[0].club; c.balance = 2000;
  c.inventory = c.players.slice(0, 3).map((p, i) => ({ id: `fixture-vest-${i}`, itemId: 'vest', playerId: p.id, location: 'torso' }));
  s = advanceLeague(s, s.nextLockAt, { maxRounds: 0 });
  const bot = s.bots[0].club, implanted = bot.players.find(p => p.implant);
  assert.ok(implanted); assert.ok(bot.transactions.some(t => t.id.startsWith('bot-gear-') && t.amount === -300));
  assert.equal(bot.balance, 2000 + 210 - 90 - 300 - 300);
  const compiled = s.night.games[0].config.rosters.away.find(p => p.playerId === implanted.id);
  assert.deepEqual(compiled, compilePlayer(implanted, bot.inventory));
});

test('ligue impaire : repos récupérateur sans faux résultat et playoffs après le dernier aller-retour', () => {
  let s = fixture(3); s.members.forEach(m => m.club.players.forEach(p => { p.fatigue = 6; }));
  const idle = s.members.find(m => !fixturesFor(s).flat().includes(m.userId)).userId;
  s = advanceLeague(s, lock, { maxRounds: 0 });
  const resting = s.members.find(m => m.userId === idle).club;
  assert.ok(resting.players.every(p => p.fatigue < 6 && p.xp === 4));
  assert.equal(s.history.length, 0); assert.deepEqual(advanceLeague(s, lock, { maxRounds: 0 }), s);
  s = advanceLeague(s, lock); s = advanceLeague(s, s.night.endsAt);
  while (s.phase !== 'playoffs') { s = advanceLeague(s, s.nextLockAt); s = advanceLeague(s, s.night.endsAt); }
  assert.equal(s.completedDays, 6); assert.equal(s.history.length, 6);
  assert.ok(leagueParticipants(s).every(m => m.club.players.every(p => p.fatigue === 0)));
  assert.ok(leagueProjection(s, 'u0', s.nextLockAt).table.every(row => row.played === 4));
});

test('service lobby : ajouts concurrents sans perte, payload financier ignoré et bots sans accès authentifié', async () => {
  let state = createLeague({ id: 'l', userId: 'owner', name: 'Ligue', clubName: 'Club', inviteCode: 'a'.repeat(32), seed: 's' }, day), revision = 1;
  const store = { async get() { return { id: state.id, state: structuredClone(state), revision }; },
    async commit(id, expected, next) { if (expected !== revision) throw new Error('RB_CONFLICT'); state = next; return ++revision; } };
  const service = createLeagueService(store, { now: () => day });
  await Promise.all([1, 2].map(() => service.command('owner', { action: 'addBot', leagueId: 'l', payload: { userId: 'spoofed', balance: 999999 } })));
  assert.equal(state.bots.length, 2); assert.equal(state.members.length, 1);
  assert.ok(state.bots.every(bot => bot.club.balance === 600));
  assert.equal(new Set(state.bots.map(bot => bot.userId)).size, 2);
  await assert.rejects(() => service.command(state.bots[0].userId, { action: 'get', leagueId: 'l' }), /réservé/);
  await service.command('owner', { action: 'removeBot', leagueId: 'l', payload: { botId: state.bots[0].userId } });
  const started = await service.command('owner', { action: 'start', leagueId: 'l', payload: { firstMatchAt: lock } }); assert.equal(started.league.capacity, 2);
  assert.equal(started.league.needsRecruitment, true);
});
