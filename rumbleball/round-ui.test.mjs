import test from 'node:test';
import assert from 'node:assert/strict';
import { createMatch } from './engine.mjs';
import { createCareer, confirmDraft } from './career.mjs';
import { CAREER_KEY, exportCareer } from './career-storage.mjs';
import { mountCareer } from './career-ui.mjs';
import { environment, descendants, button, classNode } from './test-support/dom.mjs';

// Drive presentation time and autoplay separately from the engine, without a browser.
function clock(t) {
  let time = 0, id = 0; const frames = new Map(), timers = new Map();
  t.mock.method(performance, 'now', () => time);
  for (const [name, fn] of Object.entries({ requestAnimationFrame: (cb) => { frames.set(++id, cb); return id; }, cancelAnimationFrame: (id) => frames.delete(id) })) {
    const previous = globalThis[name]; globalThis[name] = fn; t.after(() => { if (previous === undefined) delete globalThis[name]; else globalThis[name] = previous; });
  }
  t.mock.method(globalThis, 'setTimeout', (cb, delay) => { timers.set(++id, { at: time + delay, cb }); return id; });
  t.mock.method(globalThis, 'clearTimeout', (id) => timers.delete(id));
  return { frames, timers, elapse(ms) {
    time += ms; const pending = [...frames.values()]; frames.clear(); pending.forEach((cb) => cb(time));
    let due, count = 0;
    while ((due = [...timers].find(([, timer]) => timer.at <= time))) {
      assert.ok(++count < 200, 'Autoplay doit laisser avancer l’horloge.'); timers.delete(due[0]); due[1].cb();
    }
  } };
}

test('UI simultanée : dix tours résolus, douze secondes affichées, plusieurs repères et pause exacte', async (t) => {
  const e = environment(), { mountMatch } = await import('./ui.mjs'), c = clock(t), saved = [];
  globalThis.matchMedia = () => ({ matches: false });
  const view = mountMatch(e.root, { onTurn: (state) => { saved.push(structuredClone(state)); return true; } });
  view.load({ config: {}, state: createMatch({ openings: { home: 'wings', away: 'wings' } }), turns: [] }, true); c.elapse(0);
  assert.equal(saved.at(-1).round, 2); assert.equal(saved.at(-1).turns, 10);
  assert.equal(classNode(e.root, 'rb-clock').textContent, '02:00'); assert.equal(classNode(e.root, 'rb-phase').textContent, 'Round 1/10');
  let overlap = false;
  // Tactical changes may shift the overlapping actions within the round.
  // Check that they receive matching markers when they happen, not at one fixed timestamp.
  for (let time = 0; time < 10000; time += 100) {
    c.elapse(100);
    const markers = e.root.querySelectorAll('.rb-turn-marker').filter((n) => n.getAttribute('visibility') === 'visible').length;
    const pawns = e.root.querySelectorAll('.rb-pawn').filter((n) => n.getAttribute('aria-current') === 'true').length;
    assert.equal(markers, pawns); overlap ||= markers > 1;
  }
  assert.ok(overlap, 'Les actions indépendantes doivent afficher plusieurs joueurs actifs pendant le round.');
  assert.equal(saved.length, 10); assert.equal(classNode(e.root, 'rb-clock').textContent, '01:50');
  await button(e.root, 'Pause').click();
  assert.equal(c.frames.size, 0); assert.equal(c.timers.size, 0); assert.equal(classNode(e.root, 'rb-clock').textContent, '01:48');
  assert.match(classNode(e.root, 'rb-playback-status').textContent, /Pause · round 2/);
  const reading = classNode(e.root, 'rb-reading-mode'); reading.value = 'turn'; await reading.emit('change');
  await button(e.root, 'Tour suivant').click(); assert.equal(saved.length, 11); view.pause();
});

test('animations réduites : la cadence de douze secondes est conservée sans aucun geste planifié', async (t) => {
  const e = environment(), { mountMatch } = await import('./ui.mjs'), c = clock(t), saved = [];
  const view = mountMatch(e.root, { onTurn: (state) => { saved.push(state); return true; } });
  view.load({ config: {}, state: createMatch(), turns: [] }, true); c.elapse(0);
  assert.equal(saved.at(-1).round, 2); assert.equal(c.frames.size, 0); const count = saved.length;
  c.elapse(11999); assert.equal(saved.length, count); c.elapse(1); assert.equal(saved.at(-1).round, 3); view.pause();
});

test('UI : ×8 attend 1 500 ms par round et le résultat reste caché jusqu’à la fin de la dernière animation', async (t) => {
  const e = environment(), { mountMatch } = await import('./ui.mjs'), c = clock(t), saved = [];
  globalThis.matchMedia = () => ({ matches: false });
  const view = mountMatch(e.root, { onTurn: (state) => { saved.push(state); return true; } });
  const speed = descendants(e.root).find((n) => n.getAttribute('aria-label') === 'Vitesse de lecture'); speed.value = '8'; await speed.emit('change');
  view.load({ config: {}, state: createMatch(), turns: [] }, true); c.elapse(0); assert.equal(saved.at(-1).round, 2);
  const count = saved.length; c.elapse(750); assert.equal(saved.length, count); assert.equal(classNode(e.root, 'rb-clock').textContent, '01:54');
  c.elapse(750); assert.equal(saved.at(-1).round, 3); assert.equal(classNode(e.root, 'rb-phase').textContent, 'Round 2/10');
  // Ten 1.5-second rounds at ×8 represent exactly two minutes at ×1.
  for (let round = 3; round <= 10; round++) c.elapse(1500);
  assert.equal(saved.at(-1).finished, true); assert.equal(classNode(e.root, 'rb-result').hidden, true);
  assert.equal(classNode(e.root, 'rb-toolbar').hidden, false);
  c.elapse(1500); assert.equal(classNode(e.root, 'rb-result').hidden, false); assert.equal(classNode(e.root, 'rb-clock').textContent, '00:00');
  assert.equal(c.frames.size, 0); assert.equal(c.timers.size, 0); view.pause();
});

test('carrière : sauvegarde après chaque tour du lot, arrêt sur erreur intermédiaire et reprise sans doublon', async () => {
  let career = createCareer('Les Synchrones'); career = confirmDraft(career, career.market.slice(0, 5).map((p) => p.id));
  const e = environment(exportCareer(career)), { mountMatch } = await import('./ui.mjs'); mountCareer(e.root, mountMatch);
  await descendants(e.root).find((n) => n.tagName === 'button' && n.textContent.startsWith('Jouer ·')).click();
  const write = e.storage.setItem.bind(e.storage); let writes = 0;
  e.storage.setItem = (key, value) => { if (++writes === 3) throw new Error('QuotaExceededError'); write(key, value); };
  await button(e.root, 'Round suivant').click(); assert.equal(writes, 3); assert.equal(e.saved().current.state.turns, 2);
  assert.match(classNode(e.root, 'rb-error').textContent, /non enregistrée/);
  await button(e.root, 'Retour au club · mettre en pause').click(); await button(e.root, 'Réessayer la sauvegarde').click();
  assert.equal(e.saved().current.state.turns, 3);
  await button(e.root, 'Reprendre la rencontre').click(); await button(e.root, 'Round suivant').click();
  const resumed = e.saved(); assert.equal(resumed.current.state.round, 2); assert.equal(resumed.current.state.turns, 10);
  assert.equal(resumed.current.turns.length, 10); assert.equal(resumed.transactions.filter((t) => t.label === 'Salaires de la journée').length, 1);
  assert.equal(resumed.transactions.filter((t) => t.label === 'Prime de match').length, 0);
  await button(e.root, 'Retour au club · mettre en pause').click();
  const reloaded = environment(e.storage.getItem(CAREER_KEY)); mountCareer(reloaded.root, mountMatch);
  await button(reloaded.root, 'Reprendre la rencontre').click();
  assert.match(classNode(reloaded.root, 'rb-playback-status').textContent, /Pause · round 2/); assert.equal(reloaded.saved().current.turns.length, 10);
});

test('coup d’envoi : 3, 2, 1, START puis arrivée au centre sans consommer de temps de jeu ni de jets', async (t) => {
  const e = environment(), { mountMatch } = await import('./ui.mjs'), c = clock(t), saved = [], initial = createMatch();
  globalThis.matchMedia = () => ({ matches: false });
  const view = mountMatch(e.root, { onTurn(state) { saved.push(structuredClone(state)); return true; } });
  const speed = descendants(e.root).find((n) => n.getAttribute('aria-label') === 'Vitesse de lecture'); speed.value = '8'; await speed.emit('change');
  view.load({ config: {}, state: initial, turns: [] }, true, { kickoff: true });
  const cue = () => classNode(e.root, 'rb-kickoff-number').textContent;
  assert.equal(cue(), '3'); assert.equal(classNode(e.root, 'rb-ball-layer').getAttribute('display'), 'none');
  for (const label of ['2', '1']) {
    c.elapse(1000); assert.equal(cue(), label); assert.equal(saved.length, 0);
    assert.equal(classNode(e.root, 'rb-clock').textContent, '02:00');
    assert.equal(classNode(e.root, 'rb-ball-layer').getAttribute('display'), 'none');
  }
  c.elapse(1000); assert.equal(cue(), 'START'); assert.equal(saved.length, 0);
  assert.equal(classNode(e.root, 'rb-ball-layer').getAttribute('display'), 'inline');
  assert.equal(classNode(classNode(e.root, 'rb-ball-layer'), 'rb-ball').parentNode.getAttribute('transform'), 'translate(360 240)');
  assert.equal(classNode(e.root, 'rb-center-zone').getAttribute('visibility'), 'visible');
  assert.ok(classNode(e.root, 'rb-ball-drop').classList.contains('is-arriving'));
  assert.equal(classNode(e.root, 'rb-clock').textContent, '02:00');
  c.elapse(499); assert.equal(saved.length, 0);
  c.elapse(1); assert.equal(classNode(e.root, 'rb-kickoff').hidden, true); assert.equal(saved.at(-1).turns, 10);
  const { stepMatch } = await import('./engine.mjs'); let expected = initial;
  for (let i = 0; i < 10; i++) expected = stepMatch(expected, { stopAtRoundEnd: true }).state;
  assert.deepEqual(saved.at(-1), expected, 'Le compte à rebours ne change aucun jet ni résultat.');
  assert.equal(classNode(e.root, 'rb-clock').textContent, '02:00');
  c.elapse(1500); assert.equal(saved.at(-1).round, 3); view.pause();
});

test('coup d’envoi : pause exacte, changement de vitesse et reprise du décompte restant', async (t) => {
  const e = environment(), { mountMatch } = await import('./ui.mjs'), c = clock(t), saved = [];
  const view = mountMatch(e.root, { onTurn(state) { saved.push(state); return true; } });
  view.load({ config: {}, state: createMatch(), turns: [] }, true, { kickoff: true });
  c.elapse(400); await button(e.root, 'Pause').click(); c.elapse(2000);
  assert.equal(classNode(e.root, 'rb-kickoff-number').textContent, '3'); assert.equal(c.timers.size, 0);
  assert.match(classNode(e.root, 'rb-playback-status').textContent, /Pause · coup d’envoi/);
  await button(e.root, 'Reprendre').click(); c.elapse(599); assert.equal(classNode(e.root, 'rb-kickoff-number').textContent, '3');
  c.elapse(1); assert.equal(classNode(e.root, 'rb-kickoff-number').textContent, '2');
  const speed = descendants(e.root).find((n) => n.getAttribute('aria-label') === 'Vitesse de lecture'); speed.value = '8'; await speed.emit('change');
  c.elapse(999); assert.equal(classNode(e.root, 'rb-kickoff-number').textContent, '2');
  c.elapse(1); assert.equal(classNode(e.root, 'rb-kickoff-number').textContent, '1'); assert.equal(saved.length, 0);
  const reading = classNode(e.root, 'rb-reading-mode'); reading.value = 'turn'; await reading.emit('change');
  c.elapse(1000); assert.equal(classNode(e.root, 'rb-kickoff-number').textContent, 'START');
  c.elapse(500); assert.equal(saved[0].turns, 1, 'Le premier tour détaillé commence dès la fin de l’intro.');
  view.pause(); assert.equal(c.timers.size, 0);
});

test('coup d’envoi : étape manuelle, résultat immédiat et retour au vestiaire annulent les anciens rappels', async (t) => {
  const e = environment(), { mountMatch } = await import('./ui.mjs'), c = clock(t);
  const view = mountMatch(e.root); await classNode(e.root, 'rb-setup').emit('submit');
  assert.equal(classNode(e.root, 'rb-kickoff-number').textContent, '3');
  await button(e.root, 'Round suivant').click(); assert.equal(classNode(e.root, 'rb-kickoff').hidden, true);
  assert.equal(classNode(e.root, 'rb-ball-layer').getAttribute('display'), 'inline'); assert.equal(c.timers.size, 0);
  view.exhibition(); assert.equal(classNode(e.root, 'rb-ball-layer').getAttribute('display'), 'none');
  await classNode(e.root, 'rb-setup').emit('submit'); await button(e.root, 'Voir le résultat').click();
  assert.equal(classNode(e.root, 'rb-kickoff').hidden, true); assert.equal(classNode(e.root, 'rb-result').hidden, false);
  assert.equal(c.timers.size, 0);
  await button(e.root, 'Rejouer ce match').click(); c.elapse(1000); assert.equal(classNode(e.root, 'rb-kickoff-number').textContent, '2');
  view.exhibition(); c.elapse(5000); assert.equal(c.timers.size, 0);
  assert.equal(classNode(e.root, 'rb-kickoff').hidden, true); assert.equal(classNode(e.root, 'rb-setup').hidden, false);
});

test('carrière : intro seulement au lancement, animations réduites et reprise sans nouveau décompte ni salaire', async (t) => {
  let career = createCareer('Les Engagés'); career = confirmDraft(career, career.market.slice(0, 5).map((p) => p.id));
  const e = environment(exportCareer(career)), { mountMatch } = await import('./ui.mjs'), c = clock(t); mountCareer(e.root, mountMatch);
  await descendants(e.root).find((n) => n.tagName === 'button' && n.textContent.startsWith('Jouer ·')).click();
  assert.equal(classNode(e.root, 'rb-kickoff-number').textContent, '3'); assert.equal(e.saved().current.state.turns, 0);
  c.elapse(1000); c.elapse(1000); c.elapse(1000); assert.equal(c.frames.size, 0);
  assert.equal(classNode(e.root, 'rb-ball-layer').getAttribute('display'), 'inline');
  await button(e.root, 'Retour au club · mettre en pause').click(); assert.equal(c.timers.size, 0);
  const reloaded = environment(exportCareer(e.saved())); mountCareer(reloaded.root, mountMatch);
  await button(reloaded.root, 'Reprendre la rencontre').click();
  assert.equal(classNode(reloaded.root, 'rb-kickoff').hidden, true); assert.equal(c.timers.size, 0);
  assert.equal(reloaded.saved().transactions.filter((t) => t.label === 'Salaires de la journée').length, 1);
  await button(reloaded.root, 'Reprendre').click(); c.elapse(0);
  assert.equal(reloaded.saved().current.state.turns, 10); assert.equal(classNode(reloaded.root, 'rb-kickoff').hidden, true);
  await button(reloaded.root, 'Retour au club · mettre en pause').click();
});
