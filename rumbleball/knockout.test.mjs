import test from 'node:test';
import assert from 'node:assert/strict';
import { createMatch, stepMatch } from './engine.mjs';
import { createCareer, confirmDraft, launchCareerMatch, saveCareerTurn } from './career.mjs';
import { exportCareer, importCareer } from './career-storage.mjs';

test('v6 : défaite immédiate des cinq joueurs KO, sans possession ni tour supplémentaire', () => {
  for (const defeated of ['home', 'away']) {
    const state = createMatch(); state.players.filter(p => p.teamId === defeated).forEach(p => { p.hp = 0; });
    const before = structuredClone(state), { state: done, events } = stepMatch(state);
    assert.deepEqual(state, before); assert.equal(done.finished, true); assert.equal(done.turns, 0); assert.equal(done.round, 1);
    assert.equal(done.result.winnerId, defeated === 'home' ? 'away' : 'home'); assert.equal(done.result.reason, 'elimination'); assert.equal(done.result.carrierId, null);
    assert.equal(events.filter(e => e.type === 'finish').length, 1); assert.match(events.at(-1).message, /tous les joueurs adverses sont KO/);
    assert.deepEqual(stepMatch(done), { state: done, events: [] });
  }
});

test('v6 : le dernier KO pendant une attaque arrête les actions du même tour', () => {
  let state = createMatch({ seed: 'last-knockout', classes: false, strategy: 'pressing' });
  const a = state.players[0], b = state.players[5];
  state.players.filter(p => p.teamId === 'away' && p !== b).forEach(p => { p.hp = 0; });
  a.position = { x: 2, y: 1 }; b.position = { x: 3, y: 1 }; b.hp = 1; b.armor = 1;
  a.attack = { bonus: 100, die: 4, flat: 100 }; a.role = 'blocker'; a.instruction = 'aggressive'; a.speed = 0; a.movement = 0;
  state.initiative = [a.id, ...state.initiative.filter(id => id !== a.id)];
  for (let turns = 0; !state.finished && turns < 10; turns++) state = stepMatch(state).state;
  assert.equal(state.finished, true); assert.equal(state.result.reason, 'elimination'); assert.equal(state.result.winnerId, 'home'); assert.equal(state.round, 1);
  assert.equal(state.players[5].hp, 0);
});

test('v6 : quatre KO ne suffisent pas ; deux équipes entièrement KO donnent un nul', () => {
  const state = createMatch(); state.players.slice(6).forEach(p => { p.hp = 0; });
  assert.equal(stepMatch(state).state.finished, false);
  state.players.forEach(p => { p.hp = 0; });
  const done = stepMatch(state).state; assert.equal(done.result.winnerId, null); assert.equal(done.result.reason, 'double-knockout');
});

test('carrière : résultat anticipé enregistré, exportable et réglé une seule fois', () => {
  let c = createCareer('Club KO', 'career-elimination'); c = confirmDraft(c, c.market.slice(0, 5).map(p => p.id)); c = launchCareerMatch(c);
  const state = structuredClone(c.current.state); state.players.filter(p => p.teamId === 'away').forEach(p => { p.hp = 0; });
  const ended = stepMatch(state); c = saveCareerTurn(c, ended.state, ended.events);
  const restored = importCareer(exportCareer(c)); assert.equal(restored.day, 1); assert.equal(restored.current.state.result.reason, 'elimination');
  assert.equal(restored.transactions.filter(t => t.label === 'Prime de match').length, 1);
  assert.equal(restored.current.state.result.round, 1);
});
