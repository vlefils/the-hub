import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { KIT_COLORS, clubKit, matchKits, playerLook, readableKit, sportingWeapon } from './appearance.mjs';
import { createCareer, confirmDraft, setClubColor, launchCareerMatch, buyItem, assignProtection, ownedPlayers } from './career.mjs';
import { exportCareer, importCareer } from './career-storage.mjs';
import { compilePlayer } from './progression.mjs';
import { createMatch, simulateMatch } from './engine.mjs';
import { pawnArtwork, playerPortrait, poseCharacter } from './visuals.mjs';
import { installTestDOM, serializeSVG, environment, classNode } from './test-support/dom.mjs';

const club = () => { const c = createCareer('Les Chromés', 'appearance'); return confirmDraft(c, c.market.slice(0, 5).map((p) => p.id)); };

test('maillot : choix gratuit, sauvegardé, figé pendant le match et compatible avec les anciennes carrières', async () => {
  const initial = club(), changed = setClubColor(initial, '#AA2040');
  assert.equal(changed.clubs[0].kitColor, '#aa2040'); assert.equal(initial.clubs[0].kitColor, KIT_COLORS[0]);
  assert.deepEqual(changed.transactions, initial.transactions); assert.equal(changed.balance, initial.balance);
  const loaded = importCareer(exportCareer(changed)), launched = launchCareerMatch(loaded);
  assert.equal(launched.current.state.teams[0].kitColor, '#aa2040');
  assert.equal(importCareer(exportCareer(launched)).current.state.teams[0].kitColor, '#aa2040');
  assert.throws(() => setClubColor(launched, '#ffffff'), /verrouillée/);
  assert.throws(() => setClubColor(initial, 'url(#bad)'), /invalide/);
  const invalid = structuredClone(initial); invalid.clubs[0].kitColor = 'red'; assert.throws(() => exportCareer(invalid));
  const old = importCareer(await readFile(new URL('./playtests/rebuts-s1-j3.json', import.meta.url), 'utf8'));
  assert.equal(clubKit(old.clubs[0]), KIT_COLORS[0]);
  assert.ok(launchCareerMatch(old).current.state.teams.every((t) => /^#[0-9a-f]{6}$/i.test(t.kitColor)));
  for (const t of launched.current.state.teams) delete t.kitColor;
  for (const c of launched.clubs) delete c.kitColor;
  assert.equal(importCareer(exportCareer(launched)).current.state.turns, 0);
});

test('couleurs proches : tenue adverse contrastée, repères lisibles avec un maillot noir ou blanc', () => {
  for (const color of [...KIT_COLORS, '#000000', '#ffffff']) {
    const kits = matchKits(color, color); assert.equal(kits.home, color); assert.notEqual(kits.away, color);
    assert.deepEqual(kits, matchKits(color, color));
    const text = readableKit(color); assert.ok([1, 3, 5].every((i) => parseInt(text.slice(i, i + 2), 16) >= 140));
  }
  assert.deepEqual(matchKits('invalid', 'invalid'), { home: KIT_COLORS[0], away: KIT_COLORS[1] });
});

test('identité : peau et cheveux variés, conservés entre marché, titularisation et rechargement', () => {
  const draft = createCareer('Les Chromés'), looks = draft.market.map(playerLook);
  assert.ok(new Set(looks.map((p) => p.skin)).size >= 5); assert.ok(new Set(looks.map((p) => p.hairStyle)).size >= 4);
  const c = confirmDraft(draft, draft.market.slice(0, 5).map((p) => p.id)), saved = importCareer(exportCareer(c));
  const match = launchCareerMatch(saved).current.state;
  for (const p of ownedPlayers(c)) {
    const runtime = match.players.find((q) => q.playerId === p.id);
    assert.deepEqual(playerLook(runtime), playerLook(p));
    assert.deepEqual(playerLook({ ...runtime, id: 'away-4', name: 'Un autre nom' }), playerLook(p));
  }
});

test('équipement visible : transfert de protection et remplacement d’implant se reflètent sans changer l’identité', () => {
  installTestDOM(); let c = club(); const [a, b] = ownedPlayers(c), render = (id) => {
    const p = ownedPlayers(c).find((p) => p.id === id); return serializeSVG(playerPortrait(compilePlayer(p, c.inventory), clubKit(c.clubs[0])));
  };
  const bareA = render(a.id), bareB = render(b.id), look = playerLook(a);
  c = buyItem(c, 'armor', a.id); assert.notEqual(render(a.id), bareA); assert.equal(render(b.id), bareB);
  c = assignProtection(c, c.inventory[0].id, b.id); assert.equal(render(a.id), bareA); assert.notEqual(render(b.id), bareB);
  c = buyItem(c, 'legs', a.id); const legs = render(a.id);
  c = buyItem(c, 'interface', a.id, true); assert.notEqual(render(a.id), legs);
  const frozen = launchCareerMatch(c).current.state.players.find((p) => p.playerId === a.id);
  assert.deepEqual(frozen.visualGear, { protection: null, implant: 'interface', head: null, torso: null, gloves: null, feet: null, rightHand: 'tonfa', leftHand: null }); assert.deepEqual(playerLook(frozen), look);
});

test('les armes illustrent les attaques existantes ; les couleurs ne changent aucun jet ni résultat', () => {
  const initial = createMatch();
  assert.deepEqual(initial.players.slice(0, 5).map((p) => sportingWeapon(p).id), ['baton', 'maul', 'tonfa', 'baton', 'baton']);
  const a = simulateMatch({ seed: 'cosmetic-only' }), b = simulateMatch({ seed: 'cosmetic-only', kitColors: { home: '#dd1155', away: '#225588' } });
  for (const game of [a, b]) for (const t of game.state.teams) delete t.kitColor;
  assert.deepEqual(a, b);
});

test('gestes : frappe, course, port du ballon et KO ; retour au repos sans pose résiduelle', () => {
  installTestDOM(); const p = createMatch().players[1], node = pawnArtwork(p);
  const pose = (extra) => poseCharacter(node, { ...p, facing: 90, ...extra });
  pose(); const rest = serializeSVG(node);
  for (const kind of ['strike', 'throw', 'receive', 'grapple', 'signal', 'brace', 'dodge']) {
    pose({ gesture: { kind, progress: .5 } }); assert.notEqual(serializeSVG(node), rest);
    pose(); assert.equal(serializeSVG(node), rest);
  }
  pose({ walking: true, walkPhase: Math.PI / 2 }); assert.notEqual(serializeSVG(node), rest);
  pose({ hp: 0 }); assert.match(node.querySelector('.rb-person-body').getAttribute('transform'), /scale\(1 0\.65\)/);
  pose(); assert.equal(serializeSVG(node), rest);
  poseCharacter(node, { ...p, facing: 90 }, { carrying: true }); assert.notEqual(serializeSVG(node), rest);
});

test('exhibition : aperçu immédiat et actualisation des personnages en conservant le focus du pion', async () => {
  const e = environment(), { mountMatch } = await import('./ui.mjs'); const view = mountMatch(e.root);
  const pawn = e.root.querySelector('.rb-pawn'), setup = classNode(e.root, 'rb-setup'), input = setup.querySelector('.rb-kit-color');
  pawn.focus(); input.value = '#663399'; await input.emit('input');
  assert.equal(e.root.querySelector('.rb-pawn'), pawn); assert.equal(document.activeElement, pawn);
  assert.equal(pawn.querySelector('.rb-person-jersey').getAttribute('fill'), '#663399');
  assert.equal(setup.querySelector('.rb-player-portrait').querySelector('.rb-person-jersey').getAttribute('fill'), '#663399');
  let c = club(); c = buyItem(c, 'armor', ownedPlayers(c)[0].id); const current = launchCareerMatch(setClubColor(c, '#ef3050')).current;
  view.load(current); const first = serializeSVG(pawn);
  assert.equal(e.root.querySelector('.rb-pawn'), pawn); assert.equal(pawn.querySelector('.rb-person-jersey').getAttribute('fill'), '#ef3050');
  current.state.players[0].visualGear = { protection: null, implant: null }; view.load(current);
  assert.notEqual(serializeSVG(pawn), first); assert.equal(e.root.querySelector('.rb-pawn'), pawn); view.pause();
});
