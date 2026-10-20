import test from 'node:test';
import assert from 'node:assert/strict';
import { mountMatch } from './ui.mjs';
import { mountReplay } from './replay-ui.mjs';
import { createMatch, stepMatch } from './engine.mjs';
import { environment, classNode, button } from './test-support/dom.mjs';

test('match : arène, deux effectifs et commandes regroupées sous le terrain', async () => {
  const e = environment(), view = mountMatch(e.root), state = createMatch();
  view.load({ config: {}, state, turns: [] });
  assert.equal(e.root.dataset.matchScreen, 'playing');
  assert.equal(classNode(e.root, 'rb-roster-home').querySelectorAll('.rb-roster-row').length, 5);
  assert.equal(classNode(e.root, 'rb-roster-away').querySelectorAll('.rb-roster-row').length, 5);
  assert.match(classNode(e.root, 'rb-arena-floor').getAttribute('href'), /assets\/broadcast\/arena-floor.svg$/);
  assert.equal(classNode(e.root, 'rb-journal-panel').contains(classNode(e.root, 'rb-toolbar')), true);
  assert.equal(classNode(e.root, 'rb-journal-text').contains(classNode(e.root, 'rb-journal')), true);
  assert.equal(classNode(e.root, 'rb-field-column').contains(classNode(e.root, 'rb-selected')), false);
  await button(e.root, 'Repères et règles').click();
  assert.equal(classNode(e.root, 'rb-match-help-dialog').open, true);
  assert.ok(classNode(e.root, 'rb-match-help-dialog').contains(classNode(e.root, 'rb-legend')));
  view.stop();
  assert.equal(classNode(e.root, 'rb-match-help-dialog').open, false);
});

test('fiches au clic : réouverture et fermeture sans allonger le terrain ni perdre la sélection', async () => {
  const e = environment(), view = mountMatch(e.root), state = createMatch(); view.load({ config: {}, state, turns: [] });
  const row = classNode(e.root, 'rb-roster-home').querySelectorAll('.rb-player-name')[1]; row.focus(); await row.click();
  const dialog = classNode(e.root, 'rb-match-player-dialog');
  assert.equal(dialog.open, true); assert.match(classNode(e.root, 'rb-selected').textContent, /9 m/);
  const turn = stepMatch(state); view.broadcast({ initial: state, turns: [{ before: state, after: turn.state, events: turn.events }] }, 0, { animate: false });
  await button(dialog, 'Fermer').click(); assert.equal(dialog.open, false);
  assert.equal(document.activeElement, classNode(e.root, 'rb-roster-home').querySelectorAll('.rb-player-name')[1], 'Le focus retrouve la carte après une actualisation du match.');
  await classNode(e.root, 'rb-roster-home').querySelectorAll('.rb-player-name')[1].click(); assert.equal(dialog.open, true);
  view.exhibition(); assert.equal(dialog.open, false); assert.equal(e.root.dataset.matchScreen, 'setup'); view.stop();
});

test('résultat : bilan dans une modale et retour au terrain sans section supplémentaire', async () => {
  const e = environment(), view = mountMatch(e.root), state = createMatch(); view.load({ config: {}, state, turns: [] });
  await button(e.root, 'Voir le résultat').click();
  const dialog = classNode(e.root, 'rb-match-result-dialog'), result = classNode(e.root, 'rb-result');
  assert.equal(dialog.open, true); assert.equal(result.parentNode, classNode(dialog, 'rb-modal-body'));
  assert.equal(button(e.root, 'Bilan du match').hidden, false);
  await button(dialog, 'Fermer').click(); assert.equal(dialog.open, false);
  await button(e.root, 'Bilan du match').click(); assert.equal(dialog.open, true); view.stop();
});

test('replay : commandes sous l’arène, lecture des images figées sans mutation', async () => {
  const e = environment(), initial = createMatch({ rulesVersion: 7 }), turn = stepMatch(initial);
  const replay = { initial, rounds: [{ round: 1, turns: [{ before: initial, after: turn.state, events: turn.events }] }] }, original = structuredClone(replay);
  const view = mountReplay(e.root, replay, mountMatch);
  assert.ok(classNode(e.root, 'rb-journal-panel').contains(classNode(e.root, 'rb-replay-controls')));
  await button(classNode(e.root, 'rb-replay-controls'), 'Round suivant').click();
  assert.deepEqual(replay, original); assert.equal(classNode(e.root, 'rb-replay-controls').parentNode.className, 'rb-replay-toolbar'); view.stop();
});
