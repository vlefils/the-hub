import test from 'node:test';
import assert from 'node:assert/strict';
import { ARCHETYPES, initialClassState } from './classes.mjs';
import { createMatch, simulateMatch, stepMatch } from './engine.mjs';
import { decideClassAction, decideTurn } from './ai.mjs';
import { armorAgainst, assertInvariants, beginTurn, collectiveOpening, dealDamage, distance, endTurn, giveBall,
  legalAction, legalClassAction, moveAlong, randomInt, resolveAction, resolveClassAction } from './rules.mjs';
import { narrateTurn } from './narration.mjs';
import { buildCourtPlayback, sampleCourtPlayback } from './playback.mjs';

const assign = (p, archetype) => { p.archetype = archetype; p.classState = initialClassState(archetype); return p; };
function fixture(extra = []) {
  const state = createMatch({ seed: 'class-rules' });
  const ids = ['home-0', 'away-0', ...extra];
  state.players.forEach((p) => { p.hp = ids.includes(p.id) ? p.maxHp : 0; p.reaction = p.hp > 0; });
  const a = state.players[0], b = state.players[5];
  a.position = { x: 2, y: 3 }; b.position = { x: 3, y: 3 }; state.activeId = a.id;
  return { state, a, b, events: [] };
}
function forceD20(state, wanted) {
  for (let n = 0; n < 300000; n++) {
    const probe = { rng: n };
    if (wanted.every((want) => randomInt(probe, 20) + 1 === want)) { state.rng = n; return; }
  }
  throw new Error('Jet de test introuvable');
}
const uses = (events, ability) => events.filter((e) => e.type === 'class' && e.ability === ability);

test('quatre archétypes préfaits, ressources indépendantes, configuration bornée', () => {
  const config = { players: [{ archetype: 'inconnu' }, { archetype: 'escamoteur' }], awayPlayers: [{ archetype: 'passeur' }] };
  const input = structuredClone(config), state = createMatch(config);
  assert.equal(state.players[0].archetype, 'capitaine'); assert.equal(state.players[1].archetype, 'escamoteur');
  assert.equal(state.players[5].archetype, 'passeur'); assert.deepEqual(config, input);
  assert.equal(new Set(createMatch().players.map((p) => p.archetype)).size, 4);
  assert.equal(Object.keys(ARCHETYPES).length, 4);
  state.players[1].classState.flaw = 1; assert.equal(state.players[6].classState.flaw, 0);
  assert.ok(createMatch({ classes: false }).players.every((p) => p.archetype === null));
});

test('Dur au mal : absorption avant tenue, aucun soin ni réaction supplémentaire', () => {
  const { state, a, b, events } = fixture(); assign(b, 'belier'); b.hp = 10; b.abilities.constitution = 100;
  giveBall(state, b, events); events.length = 0;
  dealDamage(state, a, b, 3, events);
  assert.equal(b.hp, 10); assert.equal(b.classState.adrenaline, 3);
  assert.equal(events.some((e) => e.type === 'roll'), false); assert.equal(state.ball.carrierId, b.id);
  dealDamage(state, a, b, 6, events);
  assert.equal(b.hp, 7); assert.equal(b.classState.adrenaline, 0);
  assert.ok(events.some((e) => e.type === 'roll' && e.message.includes('DD 10')));
  dealDamage(state, a, b, 6, events); assert.equal(b.hp, 1);
  assert.equal(uses(events, 'absorb').length, 2); assert.ok(b.reaction); assert.ok(b.action);
});

test('tenue : le DD dépend des dégâts réellement subis après absorption', () => {
  const { state, a, b, events } = fixture(); assign(b, 'belier'); b.abilities.constitution = 100;
  giveBall(state, b, events); dealDamage(state, a, b, 15, events);
  assert.equal(events.find((e) => e.type === 'damage').amount, 12);
  assert.ok(events.some((e) => e.type === 'roll' && e.message.includes('DD 12')));
});

test('percussion : deux vrais pas, coût avant la frappe, poussée sans opportunité et séparation de prise', () => {
  const { state, a, b, events } = fixture(['home-1']); assign(a, 'belier');
  const held = state.players[1]; held.position = { x: 5, y: 4 };
  b.position = { x: 5, y: 3 }; b.grappling = held.id; held.grappledBy = b.id;
  b.abilities.constitution = 100; b.abilities.strength = -100; a.attack.bonus = 100;
  const action = { type: 'attack', targetId: b.id, technique: 'percussion' };
  assert.equal(legalAction(state, a, action), false);
  moveAlong(state, a, [{ x: 3, y: 3 }, { x: 4, y: 3 }], events);
  assert.ok(legalAction(state, a, action)); giveBall(state, b, events); forceD20(state, [10]);
  assert.ok(resolveAction(state, a, action, events));
  assert.equal(a.classState.adrenaline, 4); assert.ok(!a.action && a.bonusAction);
  assert.equal(uses(events, 'percussion').length, 1); assert.ok(events.some((e) => e.type === 'push'));
  assert.equal(events.some((e) => e.type === 'opportunity'), false);
  assert.equal(b.grappling, null); assert.equal(held.grappledBy, null);
  assert.deepEqual(state.ball.position, b.position); assert.ok(b.reaction); assertInvariants(state);
});

test('percussion : trajet bloqué ou virage ne valide pas une course droite imaginaire', () => {
  const { state, a, b, events } = fixture(); assign(a, 'belier'); b.position = { x: 4, y: 3 };
  moveAlong(state, a, [{ x: 3, y: 3 }, { x: 4, y: 3 }], events);
  assert.equal(a.chargeRun.steps, 1);
  const action = { type: 'attack', targetId: b.id, technique: 'percussion' }, unchanged = structuredClone(state);
  assert.equal(resolveAction(state, a, action, events), false); assert.deepEqual(state, unchanged);
  beginTurn(state, a, events); b.position = { x: 5, y: 2 };
  moveAlong(state, a, [{ x: 3, y: 2 }, { x: 4, y: 2 }], events);
  assert.equal(a.chargeRun.steps, 1); assert.equal(legalAction(state, a, action), false);
});

test('percussion manquée : les deux points sont dépensés, aucune poussée', () => {
  const { state, a, b, events } = fixture(); assign(a, 'belier'); b.position = { x: 5, y: 3 }; a.attack.bonus = -100;
  moveAlong(state, a, [{ x: 3, y: 3 }, { x: 4, y: 3 }], events); forceD20(state, [10]);
  resolveAction(state, a, { type: 'attack', targetId: b.id, technique: 'percussion' }, events);
  assert.equal(a.classState.adrenaline, 4); assert.equal(events.some((e) => e.type === 'push'), false);
});

test('Runner : observation après le tour ciblé, plafond, une acquisition par round et CA personnelle', () => {
  const { state, a, b, events } = fixture(); assign(a, 'escamoteur');
  assert.ok(resolveClassAction(state, a, { type: 'lock', targetId: b.id }, events));
  assert.equal(a.bonusAction, false); assert.ok(a.action); assert.equal(a.classState.flaw, 0);
  endTurn(state, a, events); assert.equal(a.classState.flaw, 0);
  endTurn(state, b, events); assert.equal(a.classState.flaw, 1); assert.equal(armorAgainst(a, b), a.armor + 1);
  a.classState.flaw = 0; endTurn(state, b, events); assert.equal(a.classState.flaw, 0);
  state.round++; endTurn(state, b, events); assert.equal(a.classState.flaw, 1);
  assert.equal(uses(events, 'observe').length, 2);
});

test('verrouillage : une seule action bonus, pas de gain instantané ni de faille gratuite en changeant de cible', () => {
  const { state, a, b, events } = fixture(['away-1']); assign(a, 'escamoteur');
  const other = state.players[6]; other.position = { x: 4, y: 3 };
  resolveClassAction(state, a, { type: 'lock', targetId: b.id }, events); endTurn(state, b, events);
  const unchanged = structuredClone(state), length = events.length;
  assert.equal(resolveClassAction(state, a, { type: 'lock', targetId: other.id }, events), false);
  assert.deepEqual(state, unchanged); assert.equal(events.length, length);
  beginTurn(state, a, events); resolveClassAction(state, a, { type: 'lock', targetId: other.id }, events);
  assert.equal(a.classState.flaw, 0); assert.equal(a.classState.targetId, other.id);
  endTurn(state, other, events); assert.equal(a.classState.flaw, 0); // already observed this round
});

test('feinte : protège seulement de la cible lue et expire en fin de tour', () => {
  const { state, a, b, events } = fixture(['away-1']); assign(a, 'escamoteur');
  const other = state.players[6]; other.position = { x: 3, y: 4 }; a.armor = 100;
  a.classState.targetId = b.id; a.classState.flaw = 1;
  resolveClassAction(state, a, { type: 'feint', targetId: b.id }, events);
  assert.ok(a.bonusAction); assert.equal(a.classState.flaw, 0);
  moveAlong(state, a, [{ x: 1, y: 3 }], events);
  assert.deepEqual(events.filter((e) => e.type === 'opportunity').map((e) => e.playerId), [other.id]);
  assert.ok(b.reaction); endTurn(state, a, events); assert.equal(a.feintTargetId, null);
  moveAlong(state, a, [{ x: 2, y: 3 }, { x: 1, y: 3 }], events);
  assert.equal(events.filter((e) => e.type === 'opportunity' && e.playerId === b.id).length, 1);
});

test('feinter ne libère pas une lutte et ne rend pas de déplacement', () => {
  const { state, a, b, events } = fixture(); assign(a, 'escamoteur');
  a.classState.targetId = b.id; a.classState.flaw = 1; a.grappledBy = b.id; b.grappling = a.id;
  const position = { ...a.position }, movement = a.movement;
  resolveClassAction(state, a, { type: 'feint', targetId: b.id }, events); moveAlong(state, a, [{ x: 1, y: 3 }], events);
  assert.deepEqual(a.position, position); assert.equal(a.movement, movement); assert.equal(a.grappledBy, b.id);
});

test('exploitation : avantage consommé dès la tentative, même sur arrachement raté', () => {
  const { state, a, b, events } = fixture(); assign(a, 'escamoteur'); a.skills.wrestling = -100;
  a.classState.targetId = b.id; a.classState.flaw = 1; giveBall(state, b, events);
  resolveAction(state, a, { type: 'strip', targetId: b.id, technique: 'exploitation' }, events);
  assert.equal(events.find((e) => e.type === 'roll').dice.length, 2);
  assert.equal(a.classState.flaw, 0); assert.equal(state.ball.carrierId, b.id); assert.equal(armorAgainst(a, b), a.armor);
});

test('capitaine : une seule faille alliée par test, pour arracher, agripper ou plaquer', () => {
  for (const type of ['strip', 'grapple', 'shove']) {
    const { state, a, b, events } = fixture(['home-1', 'home-2']); assign(a, 'belier');
    const captains = [state.players[1], state.players[2]];
    captains.forEach((p, index) => { assign(p, 'capitaine'); p.position = { x: 1, y: index + 2 }; p.classState.targetId = b.id; p.classState.flaw = 1; });
    giveBall(state, b, events); resolveAction(state, a, { type, targetId: b.id }, events);
    assert.equal(events.find((e) => e.type === 'roll').dice.length, 2);
    assert.equal(captains[0].classState.flaw, 0); assert.equal(captains[1].classState.flaw, 1);
    assert.equal(uses(events, 'opening').length, 1);
  }
});

test('ouverture : portée, allié vivant, pas d’auto-exploitation ni de cumul inutile avec Aider', () => {
  const { state, a, b } = fixture(['home-1']); a.classState.targetId = b.id; a.classState.flaw = 1;
  assert.equal(collectiveOpening(state, a, b), null);
  const ally = state.players[1]; ally.position = { x: 2, y: 2 };
  assert.equal(collectiveOpening(state, ally, b), a);
  state.aids.push({ helperId: a.id, allyId: ally.id, kind: 'check' });
  assert.equal(collectiveOpening(state, ally, b), null); state.aids = [];
  a.position = { x: 11, y: 7 }; assert.equal(collectiveOpening(state, ally, b), null);
  a.hp = 0; a.position = { x: 1, y: 3 }; assert.equal(collectiveOpening(state, ally, b), null);
});

test('appel : bonus partagé avec le verrouillage, expiration au tour du capitaine, aucune recharge', () => {
  const { state, a, b, events } = fixture(['home-1']); const ally = state.players[1]; ally.position = { x: 1, y: 3 };
  assert.ok(resolveClassAction(state, a, { type: 'call', targetId: ally.id }, events));
  assert.equal(a.classState.calls, 1); assert.ok(a.action);
  assert.equal(legalClassAction(state, a, { type: 'lock', targetId: b.id }), false);
  beginTurn(state, ally, events); assert.equal(state.calls.length, 1);
  beginTurn(state, a, events); assert.equal(state.calls.length, 0); assert.equal(a.classState.calls, 1);
  resolveClassAction(state, a, { type: 'call', targetId: ally.id }, events); beginTurn(state, a, events);
  assert.equal(resolveClassAction(state, a, { type: 'call', targetId: ally.id }, events), false);
});

test('appel : avantage non cumulable, dépensé sur la passe même si elle échoue', () => {
  const { state, a, b, events } = fixture(['home-1', 'home-2']);
  const passer = state.players[1], receiver = state.players[2]; passer.position = { x: 1, y: 3 }; receiver.position = { x: 1, y: 6 };
  passer.skills.acrobatics = -100;
  resolveClassAction(state, a, { type: 'call', targetId: passer.id }, events);
  state.aids.push({ helperId: a.id, allyId: passer.id, kind: 'check' }); giveBall(state, passer, events);
  resolveAction(state, passer, { type: 'pass', targetId: receiver.id }, events);
  assert.equal(events.find((e) => e.type === 'roll').dice.length, 2); assert.equal(state.calls.length, 0);
  assert.equal(state.ball.carrierId, null); assert.equal(uses(events, 'call-used').length, 1); assert.ok(receiver.reaction);
});

test('KO sportif : efface observations et appels, sans possibilité de soin ou de relève', () => {
  const { state, a, b, events } = fixture(['home-1']); const ally = state.players[1]; ally.position = { x: 1, y: 3 };
  resolveClassAction(state, a, { type: 'call', targetId: ally.id }, events);
  assign(b, 'escamoteur'); b.classState.targetId = a.id; b.classState.flaw = 1;
  dealDamage(state, b, a, 999, events);
  assert.equal(a.hp, 0); assert.equal(state.calls.length, 0); assert.equal(b.classState.targetId, null); assert.equal(b.classState.flaw, 0);
  assert.equal(legalAction(state, ally, { type: 'heal', targetId: a.id }), false); assertInvariants(state);
});

test('concentration : réserve commune à la passe et l’interception, réaction unique', () => {
  const { state, a, b, events } = fixture(['home-1', 'away-1']); assign(a, 'passeur'); assign(b, null);
  const receiver = state.players[1], rival = state.players[6]; assign(rival, null);
  a.position = { x: 0, y: 0 }; receiver.position = { x: 4, y: 0 }; b.position = { x: 11, y: 7 }; rival.position = { x: 10, y: 7 };
  a.skills.acrobatics = 100; giveBall(state, a, events);
  resolveAction(state, a, { type: 'pass', targetId: receiver.id, technique: 'precision' }, events);
  assert.equal(a.classState.focus, 1); assert.ok(a.reaction); assert.equal(receiver.reaction, true);
  a.position = { x: 3, y: 2 }; receiver.position = { x: 0, y: 7 }; b.position = { x: 1, y: 2 }; rival.position = { x: 6, y: 2 };
  b.skills.acrobatics = 10; giveBall(state, b, events); events.length = 0;
  resolveAction(state, b, { type: 'pass', targetId: rival.id }, events);
  assert.equal(a.classState.focus, 0); assert.equal(a.reaction, false); assert.equal(uses(events, 'intercept-read').length, 1);
  assert.equal(events.filter((e) => e.type === 'roll')[1].dice.length, 2);
  beginTurn(state, a, events); assert.equal(a.reaction, false); assert.equal(a.classState.focus, 0);
});

test('technique illégale : aucun jet, coût ou événement consommé', () => {
  const { state, a, b, events } = fixture();
  for (const action of [{ type: 'attack', targetId: b.id, technique: 'percussion' }, { type: 'strip', targetId: b.id, technique: 'exploitation' }, { type: 'pass', targetId: b.id, technique: 'precision' }]) {
    const original = structuredClone(state);
    assert.equal(resolveAction(state, a, action, events), false); assert.deepEqual(state, original); assert.equal(events.length, 0);
  }
});

test('actions bonus illégales : allié, portée, KO et même cible ne consomment rien', () => {
  const { state, a, b, events } = fixture(['home-1']); const ally = state.players[1]; ally.position = { x: 1, y: 3 };
  for (const action of [{ type: 'lock', targetId: ally.id }, { type: 'call', targetId: a.id }, { type: 'call', targetId: b.id }, { type: 'lock', targetId: 'absent' }]) {
    const original = structuredClone(state);
    assert.equal(resolveClassAction(state, a, action, events), false); assert.deepEqual(state, original);
  }
  ally.position = { x: 11, y: 7 }; assert.equal(legalClassAction(state, a, { type: 'call', targetId: ally.id }), false);
  b.hp = 0; assert.equal(legalClassAction(state, a, { type: 'lock', targetId: b.id }), false);
  assert.equal(events.length, 0);
});

test('observation : pas de gain à distance ni par un observateur KO', () => {
  const { state, a, b, events } = fixture(); a.classState.targetId = b.id; a.position = { x: 11, y: 7 };
  endTurn(state, b, events); assert.equal(a.classState.flaw, 0);
  a.position = { x: 2, y: 3 }; a.hp = 0; endTurn(state, b, events); assert.equal(a.classState.flaw, 0);
  assert.equal(uses(events, 'observe').length, 0);
});

test('dernier engagement : les réserves ne sont pas restaurées après les prolongations', () => {
  const state = createMatch({ rulesVersion: 5 }); state.round = 12; state.turnIndex = state.initiative.length - 1;
  state.players.forEach((p) => { p.hp = 0; p.classState.adrenaline = 0; p.classState.focus = 0; p.classState.calls = 0; });
  const turn = stepMatch(state);
  assert.ok(turn.events.some((e) => e.type === 'restart')); assert.ok(turn.state.finished);
  assert.ok(turn.state.players.every((p) => !p.classState.adrenaline && !p.classState.focus && !p.classState.calls));
});

test('bots : feinte utile, exploitation de faille et passe ajustée sous pression', () => {
  const { state, a, b, events } = fixture(['home-1']); assign(a, 'escamoteur'); a.movement = 0;
  state.round = 7;
  a.classState.targetId = b.id; a.classState.flaw = 1; giveBall(state, b, events);
  assert.equal(decideTurn(state, a).action.technique, 'exploitation');
  b.role = 'blocker';
  assert.equal(decideClassAction(state, a, [{ x: 1, y: 3 }]).type, 'feint');
  assign(a, 'passeur'); a.role = 'blocker'; const relay = state.players[1]; relay.role = 'carrier'; relay.position = { x: 0, y: 0 };
  state.initiative = [a.id, relay.id, b.id, ...state.players.filter((p) => ![a.id, relay.id, b.id].includes(p.id)).map((p) => p.id)];
  giveBall(state, a, events); const original = structuredClone(state);
  const decision = decideTurn(state, a); assert.equal(decision.action.type, 'pass'); assert.equal(decision.action.technique, 'precision');
  assert.deepEqual(state, original);
});

test('présentation : capacités racontées, effets séquentiels et état final identique au moteur', () => {
  const { state, a, b, events } = fixture(); assign(a, 'escamoteur'); a.classState.targetId = b.id; a.classState.flaw = 1;
  a.skills.wrestling = 100; giveBall(state, b, events); events.length = 0;
  const before = structuredClone(state);
  resolveAction(state, a, { type: 'strip', targetId: b.id, technique: 'exploitation' }, events);
  const plan = buildCourtPlayback(before, state, events), narrative = narrateTurn(events, state.players);
  assert.ok(narrative.text.includes('exploite sa lecture')); assert.ok(narrative.text.includes('arraché'));
  assert.ok(plan.effects.some((e) => e.label === 'Exploitation'));
  assert.ok(plan.effects.some((e) => e.kind === 'possession'));
  assert.equal(sampleCourtPlayback(plan, plan.duration).ball.carrierId, state.ball.carrierId);
});

test('classes : replay intégral identique au pas à pas, sans mutation ni soin', () => {
  const config = { seed: 'four-archetypes', strategy: 'pressing' };
  let state = createMatch(config); const events = [];
  while (!state.finished) {
    const original = structuredClone(state), turn = stepMatch(state); assert.deepEqual(state, original);
    events.push(...turn.events); state = turn.state;
  }
  assert.deepEqual({ state, events }, simulateMatch(config));
  assert.equal(events.some((e) => ['heal', 'revive'].includes(e.type)), false);
});

test('compositions : quatre équipes spécialisées et équipes mixtes, trois stratégies, invariants et ressources', { timeout: 60000 }, () => {
  const report = { matches: 0, home: 0, away: 0, draws: 0, abilities: {} };
  for (const archetype of [...Object.keys(ARCHETYPES), null]) {
    for (const strategy of ['balanced', 'pressing', 'possession']) {
      for (let n = 0; n < 2; n++) {
        const config = { seed: `lineups-${archetype}-${n}`, strategy,
          players: Array.from({ length: 5 }, () => ({ ...(archetype ? { archetype } : {}), instruction: n ? 'cautious' : 'aggressive' })) };
        const { state, events } = simulateMatch(config, (s, turnEvents) => {
          assertInvariants(s);
          for (const e of turnEvents.filter((e) => e.type === 'opportunity')) {
            assert.equal(distance(e.trigger.attackerPosition, e.trigger.from), 1);
            assert.ok(distance(e.trigger.attackerPosition, e.trigger.to) > 1);
          }
        });
        assert.ok(state.finished && state.round <= 13 && state.turns <= 130);
        report.matches++; report[state.result.winnerId ?? 'draws']++;
        for (const e of events.filter((e) => e.type === 'class')) report.abilities[e.ability] = (report.abilities[e.ability] ?? 0) + 1;
      }
    }
  }
  // Interception requires an opposing pass near the specialist; its shared cost
  // and actual dice are covered by the controlled interception fixture above.
  for (const ability of ['absorb', 'percussion', 'lock', 'observe', 'feint', 'exploit', 'opening', 'call', 'call-used', 'precision']) {
    assert.ok(report.abilities[ability] > 0, `Technique jamais utilisée : ${ability}`);
  }
  console.log('Rumbleball — compositions avec classes :', JSON.stringify(report));
});
