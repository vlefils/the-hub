import test from 'node:test';
import assert from 'node:assert/strict';
import { createMatch, simulateMatch } from './engine.mjs';
import { moveAlong, performAttack, resolveAction } from './rules.mjs';
import { narrateTurn } from './narration.mjs';

const players = [{ id: 'a', name: 'Étau' }, { id: 'b', name: 'Le Frigo' }, { id: 'c', name: 'Pépé 404' }, { id: 'd', name: 'Zip' }];
const event = (type, data = {}) => ({ type, actorId: 'a', message: type, ...data });
const actionEvents = (type, targetId, events) => events.map((e, index) => index ? e : { ...e, resolvedAction: { type, playerId: 'a', targetId } });
const move = (steps = 2) => event('move', { playerId: 'a', path: Array.from({ length: steps }, (_, x) => ({ x, y: 0 })) });

test('exemple demandé : déplacement et lutte fusionnés avec l’attaque manquée', () => {
  const state = createMatch();
  const a = state.players[3], held = state.players[6], target = state.players[9];
  for (const p of state.players) if (![a, held, target].includes(p)) p.hp = 0;
  a.position = { x: 2, y: 1 }; held.position = { x: 2, y: 2 }; target.position = { x: 5, y: 3 };
  a.grappling = held.id; held.grappledBy = a.id; a.movement = 12; target.armor = 100;
  state.activeId = a.id;
  const events = [];
  moveAlong(state, a, [{ x: 3, y: 2 }, { x: 4, y: 3 }], events);
  resolveAction(state, a, { type: 'attack', targetId: target.id }, events);
  events.push(event('hold-position', { actorId: a.id }));
  const before = structuredClone(events);
  const result = narrateTurn(events, state.players);
  assert.equal(result.text, 'Étau a traîné Le Frigo sur 3 mètres pour tenter de mettre une beigne à Pépé 404, mais a raté son coup.');
  assert.equal(a.movement, 3); // 9 m spent in difficult terrain, but only 3 m travelled.
  assert.deepEqual(events, before); assert.deepEqual(result.announcements, []);
});

test('réaction interrompant le déplacement : aucune action inventée après le KO', () => {
  const events = [event('decision', { action: 'grapple' }), move(1),
    event('opportunity', { playerId: 'b', targetId: 'a' }), event('damage', { playerId: 'a', amount: 9 }),
    event('ko', { playerId: 'a' }), event('movement-stopped')];
  assert.equal(narrateTurn(events, players).text, 'Étau a parcouru 1,5 mètre. Le Frigo a cueilli Étau au passage et a provoqué son KO (9 dégâts).');
});

test('une réaction manquée ne devient pas une attaque réussie du joueur actif', () => {
  const result = narrateTurn([event('opportunity', { playerId: 'b', targetId: 'a' }), event('miss')], players);
  assert.equal(result.text, 'Le Frigo a tenté de cueillir Étau au passage, mais a manqué son coup.');
});

test('frappe : dégâts, KO et balle perdue restent visibles', () => {
  const events = actionEvents('attack', 'b', [event('attack'), event('damage', { playerId: 'b', amount: 7 }), event('drop', { playerId: 'b' }), event('ko', { playerId: 'b' })]);
  assert.equal(narrateTurn(events, players).text, 'Étau a mis Le Frigo KO d’une beigne (7 dégâts). Le Frigo a lâché la balle.');
});

test('replanification : le récit décrit l’action exécutée, pas l’intention initiale', () => {
  const events = [event('decision', { action: 'strip' }), ...actionEvents('attack', 'b', [event('attack'), event('miss')])];
  assert.equal(narrateTurn(events, players).text, 'Étau a tenté de mettre une beigne au Frigo, mais a raté son coup.');
});

test('ramassage puis passe : les deux actions et une interception manquée sont regroupées', () => {
  const events = [...actionEvents('pickup', undefined, [event('possession', { playerId: 'a', reason: 'récupère' })]),
    ...actionEvents('pass', 'd', [event('pass'), event('failure'), event('possession', { playerId: 'd', reason: 'reçoit' })])];
  assert.equal(narrateTurn(events, players).text, 'Étau a récupéré la balle. Étau a passé la balle à Zip.');
});

test('passe : interception et balle au sol sont distinguées', () => {
  const intercepted = actionEvents('pass', 'd', [event('pass'), event('possession', { playerId: 'b', reason: 'intercepte' })]);
  assert.equal(narrateTurn(intercepted, players).text, 'Étau a tenté une passe à Zip, mais Le Frigo l’a interceptée.');
  const dropped = actionEvents('pass', 'd', [event('pass'), event('drop')]);
  assert.equal(narrateTurn(dropped, players).text, 'Étau a tenté une passe à Zip, mais la balle a fini au sol.');
});

test('prise et arrachement : le récit suit la réussite réelle', () => {
  const grapple = [move(), ...actionEvents('grapple', 'b', [event('roll'), event('grapple')]), event('hold-position')];
  assert.equal(narrateTurn(grapple, players).text, 'Étau a parcouru 3 mètres pour agripper Le Frigo et a verrouillé sa prise.');
  const strip = actionEvents('strip', 'b', [event('roll'), event('failure')]);
  assert.equal(narrateTurn(strip, players).text, 'Étau a tenté d’arracher la balle au Frigo, sans succès.');
});

test('mobilité : un sprint est fusionné avec les mètres réellement parcourus', () => {
  const events = [...actionEvents('dash', undefined, [event('dash')]), move(5)];
  assert.equal(narrateTurn(events, players).text, 'Étau a sprinté sur 7,5 mètres.');
  const disengage = [...actionEvents('disengage', undefined, [event('disengage')]), move(2)];
  assert.equal(narrateTurn(disengage, players).text, 'Étau a parcouru 3 mètres en évitant les coups gratuits.');
});

test('un déplacement après l’attaque reste après l’attaque dans le récit', () => {
  const events = [...actionEvents('attack', 'c', [event('attack'), event('miss')]), move(1)];
  assert.equal(narrateTurn(events, players).text, 'Étau a tenté de mettre une beigne à Pépé 404, mais a raté son coup. Étau a parcouru 1,5 mètre.');
});

test('traînage partiel : la distance totale ne devient pas une distance de traînage', () => {
  const events = [move(2), event('drag', { byId: 'a', playerId: 'b', path: [{ x: 0, y: 0 }] }), ...actionEvents('dodge', undefined, [event('dodge')])];
  assert.equal(narrateTurn(events, players).text, 'Étau a parcouru 3 mètres, dont 1,5 mètre en traînant Le Frigo pour se mettre en garde.');
});

test('les annonces de victoire et prolongation restent distinctes du tour', () => {
  const result = narrateTurn([event('round-end'), event('overtime', { message: 'Prolongation.' }), event('finish', { message: 'Victoire !' })], players);
  assert.equal(result.text, '');
  assert.deepEqual(result.announcements, [{ type: 'overtime', message: 'Prolongation.' }, { type: 'finish', message: 'Victoire !' }]);
});

test('métadonnées de narration : même état et même hasard que l’attaque directe', () => {
  const state = createMatch(), direct = structuredClone(state), events = [], rawEvents = [];
  for (const s of [state, direct]) { s.players[0].position = { x: 5, y: 3 }; s.players[5].position = { x: 6, y: 3 }; }
  assert.ok(resolveAction(state, state.players[0], { type: 'attack', targetId: state.players[5].id }, events));
  assert.ok(performAttack(direct, direct.players[0], direct.players[5], rawEvents));
  assert.deepEqual(state, direct);
  assert.equal(events[0].resolvedAction.type, 'attack');
  assert.deepEqual(events.map(({ resolvedAction, ...event }) => event), rawEvents);
});

test('match complet : chaque tour joué est raconté sans coordonnées ni données manquantes', () => {
  let count = 0;
  simulateMatch({ seed: 'arche-01', strategy: 'pressing', players: Array.from({ length: 5 }, () => ({ role: 'blocker', instruction: 'aggressive' })) }, (state, events) => {
    const narrative = narrateTurn(events, state.players);
    if (events.some((e) => e.type === 'decision')) { assert.ok(narrative.text); count++; }
    assert.doesNotMatch(narrative.text, /undefined|NaN|\([A-L][1-8] →|mouvement restant/);
  });
  assert.ok(count > 40);
});
