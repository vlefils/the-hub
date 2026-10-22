import { el, btn, field, select } from './career-components.mjs';
import { ROUND_DURATION } from './playback.mjs';
import { ENTRY_DURATION, OPENING_DURATION, EXIT_DURATION } from './match-ceremony.mjs';

// Recorded server frames only: replay controls never resolve a game turn.
export function mountReplay(root, replay, mountMatch) {
  root.replaceChildren();
  root.classList.add('rb-replay-player');
  const controls = el('div', 'rb-controls rb-replay-controls'), matchRoot = el('div', 'rb-replay-match');
  const status = el('p', 'rb-form-status'); status.setAttribute('role', 'status');
  const speed = select({ 1: '×1', 2: '×2', 4: '×4', 8: '×8' }, 1);
  speed.setAttribute('aria-label', 'Vitesse du replay');
  const cursor = el('input'); cursor.type = 'range'; cursor.min = -1; cursor.max = replay.rounds.length - 1; cursor.step = 1;
  cursor.setAttribute('aria-label', 'Round du replay');
  let index = -1, phase = 'ready', elapsed = 0, startedAt = 0, rate = 1, running = false, timer = null, stopped = false;
  const duration = () => phase === 'opening' ? OPENING_DURATION : phase === 'round' ? ROUND_DURATION : phase === 'exit' ? EXIT_DURATION : 0;
  const position = () => Math.min(duration(), elapsed + (running ? (performance.now() - startedAt) * rate : 0));
  const clearTimer = () => { clearTimeout(timer); timer = null; };
  const play = btn('Lire le replay', () => {
    if (running) { pause(); return; }
    if (!replay.rounds.length || stopped) return;
    if (phase === 'ended' || phase === 'ready') { index = -1; phase = 'opening'; elapsed = 0; }
    else if (elapsed >= duration()) advance();
    running = true; startedAt = performance.now(); show(true); schedule();
  });
  const next = btn('Round suivant', () => {
    pause(); index = Math.min(index + 1, replay.rounds.length - 1); phase = 'round'; elapsed = ROUND_DURATION; show(false);
  });
  const beginning = btn('Revenir au début', () => { pause(); index = -1; phase = 'ready'; elapsed = 0; show(false); });
  controls.append(play, next, beginning, field('Vitesse du replay', speed));
  const toolbar = el('div', 'rb-replay-toolbar'); toolbar.append(controls, field('Parcourir les rounds', cursor), status);
  root.append(matchRoot);
  const view = mountMatch(matchRoot);
  if (view.setPlaybackControls) view.setPlaybackControls(toolbar); else root.prepend(toolbar);
  function updateControls() {
    const round = replay.rounds[index];
    cursor.value = index; cursor.setAttribute('aria-valuetext', index < 0 ? 'Début du match' : `${phase === 'round' && position() < ROUND_DURATION ? 'Round' : 'Fin du round'} ${round.round}`);
    play.textContent = running ? 'Mettre le replay en pause' : 'Lire le replay';
    play.disabled = !replay.rounds.length;
    next.disabled = index === replay.rounds.length - 1;
    const label = phase === 'opening' ? 'Entrée des équipes et coup d’envoi' : phase === 'exit' ? 'Sortie des équipes · prise en charge des joueurs KO' : phase === 'ended' ? 'Replay terminé' : round ? `Round ${round.round} / ${replay.rounds.length}` : 'Début de la rencontre';
    status.textContent = `${running ? 'Lecture' : 'Pause'} · ${label}.`;
  }
  function show(animate) {
    const round = replay.rounds[index];
    view.broadcast({ initial: replay.initial, turns: round?.turns ?? [], previousEvents: replay.rounds.slice(0, Math.max(0, index)).flatMap(r => r.turns.map(t => t.events)) }, elapsed / rate, {
      speed: rate, animate,
      entrance: phase === 'opening' ? { duration: OPENING_DURATION, elapsed: elapsed / rate, speed: rate } : null,
      exit: phase === 'exit' ? { duration: EXIT_DURATION } : null,
    });
    updateControls();
  }
  function pause() {
    elapsed = position(); clearTimer(); running = false;
    if (view.pausePlayback) view.pausePlayback(); else view.pause();
    updateControls();
  }
  function advance() {
    elapsed = 0;
    if (phase === 'opening') { phase = 'round'; index = 0; }
    else if (phase === 'round' && index < replay.rounds.length - 1) index++;
    else if (phase === 'round') phase = 'exit';
    else { phase = 'ended'; running = false; }
  }
  function schedule() {
    clearTimer();
    if (!running || stopped) return;
    // Cue boundaries also update the countdown with reduced motion enabled.
    const boundaries = phase === 'opening' ? [ENTRY_DURATION, ENTRY_DURATION + 1000, ENTRY_DURATION + 2000, ENTRY_DURATION + 3000, OPENING_DURATION] : [duration()];
    const at = position(), deadline = boundaries.find(value => value > at) ?? duration();
    timer = setTimeout(() => {
      timer = null;
      if (stopped || !running) return;
      elapsed = position(); startedAt = performance.now();
      if (elapsed >= duration()) { advance(); if (running) show(true); else updateControls(); }
      else if (phase === 'opening' && globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) show(true);
      schedule();
    }, Math.max(0, (deadline - at) / rate));
  }
  speed.addEventListener('change', () => {
    elapsed = position(); startedAt = performance.now(); rate = Number(speed.value);
    if (running) { if (view.setPlaybackSpeed) view.setPlaybackSpeed(rate); else show(true); schedule(); }
    updateControls();
  });
  cursor.addEventListener('input', () => { const target = Number(cursor.value); pause(); index = target; phase = index < 0 ? 'ready' : 'round'; elapsed = index < 0 ? 0 : ROUND_DURATION; show(false); });
  const onVisibility = () => { if (document.hidden && !stopped) pause(); };
  document.addEventListener('visibilitychange', onVisibility);
  show(false);
  return { stop() { stopped = true; running = false; clearTimer(); if (view.stop) view.stop(); else view.pause(); document.removeEventListener?.('visibilitychange', onVisibility); } };
}
