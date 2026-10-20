import { el, btn, field, select } from './career-components.mjs';

// Recorded server frames only: replay controls never resolve a game turn.
export function mountReplay(root, replay, mountMatch) {
  root.replaceChildren();
  root.classList.add('rb-replay-player');
  const controls = el('div', 'rb-controls rb-replay-controls'), matchRoot = el('div', 'rb-replay-match');
  const status = el('p', 'rb-form-status'); status.setAttribute('role', 'status');
  const speed = select({ 1: '×1', 2: '×2', 4: '×4', 8: '×8' }, 1);
  const cursor = el('input'); cursor.type = 'range'; cursor.min = -1; cursor.max = replay.rounds.length - 1; cursor.step = 1;
  cursor.setAttribute('aria-label', 'Round du replay');
  let index = -1, running = false, timer = null, stopped = false;
  const play = btn('Lire le replay', () => {
    if (running) { pause(); return; }
    if (index === replay.rounds.length - 1) index = -1;
    running = true; advance(true);
  });
  const next = btn('Round suivant', () => { pause(); advance(false); });
  const beginning = btn('Revenir au début', () => { pause(); index = -1; show(false); });
  controls.append(play, next, beginning, field('Vitesse du replay', speed));
  const toolbar = el('div', 'rb-replay-toolbar'); toolbar.append(controls, field('Parcourir les rounds', cursor), status);
  root.append(matchRoot);
  const view = mountMatch(matchRoot);
  if (view.setPlaybackControls) view.setPlaybackControls(toolbar); else root.prepend(toolbar);
  function show(animate) {
    const round = replay.rounds[index];
    view.broadcast({ initial: replay.initial, turns: round?.turns ?? [], previousEvents: replay.rounds.slice(0, Math.max(0, index)).flatMap(r => r.turns.map(t => t.events)) }, 0, { speed: Number(speed.value), animate });
    cursor.value = index; cursor.setAttribute('aria-valuetext', index < 0 ? 'Début du match' : `Fin du round ${round.round}`);
    play.textContent = running ? 'Mettre le replay en pause' : 'Lire le replay';
    next.disabled = index === replay.rounds.length - 1;
    status.textContent = index < 0 ? 'Replay en pause · début de la rencontre.' : `${running ? 'Lecture' : 'Pause · fin du round'} ${round.round} / ${replay.rounds.length} · aucune progression modifiée.`;
  }
  function pause() {
    clearTimeout(timer); timer = null; running = false; view.pause();
    show(false);
  }
  function advance(animate) {
    if (stopped) return;
    index = Math.min(index + 1, replay.rounds.length - 1); show(animate);
    if (running) timer = setTimeout(() => {
      timer = null;
      if (index === replay.rounds.length - 1) pause(); else advance(true);
    }, 12000 / Number(speed.value));
  }
  speed.addEventListener('change', pause);
  cursor.addEventListener('input', () => { clearTimeout(timer); timer = null; running = false; index = Number(cursor.value); show(false); });
  const onVisibility = () => { if (document.hidden && !stopped) pause(); };
  document.addEventListener('visibilitychange', onVisibility);
  show(false);
  return { stop() { stopped = true; running = false; clearTimeout(timer); timer = null; if (view.stop) view.stop(); else view.pause(); document.removeEventListener?.('visibilitychange', onVisibility); } };
}
