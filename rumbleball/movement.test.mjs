import test from 'node:test';
import assert from 'node:assert/strict';
import { CLASS_SPEEDS, PROFILES } from './data.mjs';
import { compilePlayer } from './progression.mjs';
import { createMatch, CURRENT_RULES } from './engine.mjs';
import { createCareer, confirmDraft, launchCareerMatch } from './career.mjs';
import { exportCareer, importCareer } from './career-storage.mjs';
import { environment, classNode } from './test-support/dom.mjs';
import { mountMatch } from './ui.mjs';

const player = profile => ({ id: 'p', name: 'Chrome', profile, xp: 0, fatigue: 0, role: 'blocker', instruction: 'normal', implant: null,
  abilities: { strength: 15, dexterity: 13, constitution: 14, mind: 8, charisma: 9 }, advancements: [] });

test('Béliers : même vitesse de classe, avec les mêmes effets de fatigue et de matériel', () => {
  for (const profile of [1, 3]) {
    const p = player(profile);
    assert.equal(compilePlayer(p).speed, 9);
    assert.equal(compilePlayer({ ...p, fatigue: 3 }).speed, 7.5);
    assert.equal(compilePlayer(p, [{ id: 'armor', itemId: 'armor', playerId: p.id }]).speed, 7.5);
    assert.equal(compilePlayer(p, [{ id: 'legs', itemId: 'legs', playerId: p.id }]).speed, 10.5);
  }
  for (const [profile, p] of PROFILES.entries()) assert.equal(compilePlayer(player(profile)).speed, CLASS_SPEEDS[p.archetype]);
});

test('nouveaux matchs : vitesse uniforme ; anciens matchs et effectifs figés conservés', () => {
  assert.equal(CURRENT_RULES, 8);
  assert.deepEqual(createMatch().players.filter(p => p.archetype === 'belier').map(p => p.speed), [9, 9, 9, 9]);
  const legacy = createMatch({ rulesVersion: 7 });
  assert.equal(legacy.version, 7);
  assert.deepEqual(legacy.players.filter(p => p.archetype === 'belier').map(p => p.speed), [7.5, 9, 7.5, 9]);
  const rosters = Object.fromEntries(['home', 'away'].map(side => [side, PROFILES.map(p => ({ ...structuredClone(p), name: p.name, level: 1 }))]));
  for (const rulesVersion of [7, 8]) assert.equal(createMatch({ rulesVersion, rosters }).players[1].speed, 7.5);
});

test('ancienne carrière : reprise et export gardent la vitesse du match en cours', () => {
  let c = createCareer('Les Archives', 'movement-regression'); c = confirmDraft(c, c.market.slice(0, 5).map(p => p.id)); c = launchCareerMatch(c);
  c.current.config.rulesVersion = 7;
  for (const side of ['home', 'away']) c.current.config.rosters[side].find(p => p.archetype === 'belier').speed = 7.5;
  c.current.state = createMatch(c.current.config);
  const copy = importCareer(exportCareer(c));
  assert.deepEqual(copy.current, c.current);
  assert.equal(copy.current.state.version, 7);
  assert.equal(copy.current.state.players.find(p => p.archetype === 'belier').speed, 7.5);
});

test('exhibition : les deux Béliers affichent 9 m au vestiaire', () => {
  const e = environment(), view = mountMatch(e.root);
  const rows = classNode(e.root, 'rb-setup-rows').querySelectorAll('.rb-setup-row');
  for (const i of [1, 3]) assert.match(rows[i].textContent, /9 m/);
  view.stop();
});
