// Presentation timeline only: never advances the engine or consumes random numbers.
export const courtPoint = ({ x, y }) => ({ x: x * 60 + 30, y: y * 60 + 30 });
const player = (view, id) => view.players.find((p) => p.id === id);
const snapshot = (state) => ({
  players: state.players.map(({ id, teamId, number, hp, maxHp, position, prone, grappling, grappledBy }) =>
    ({ id, teamId, number, hp, maxHp, position: { ...position }, prone, grappling, grappledBy })),
  ball: { ...state.ball, position: { ...state.ball.position } },
});
const copy = (view) => structuredClone(view);
const ballPoint = (view) => {
  const holder = player(view, view.ball.carrierId);
  const point = courtPoint(holder?.position ?? view.ball.position);
  return holder ? { x: point.x + 17, y: point.y - 17 } : point;
};
const release = (view, id) => {
  const p = player(view, id);
  if (!p) return;
  const held = player(view, p.grappling), holder = player(view, p.grappledBy);
  if (held) held.grappledBy = null;
  if (holder) holder.grappling = null;
  p.grappling = null; p.grappledBy = null;
};
const reconcile = (view) => {
  for (const p of view.players) {
    if (p.hp <= 0) release(view, p.id);
    const held = player(view, p.grappling);
    if (held && Math.max(Math.abs(p.position.x - held.position.x), Math.abs(p.position.y - held.position.y)) > 1) {
      held.grappledBy = null; p.grappling = null;
    }
  }
};

// Keep the familiar minimum cadence, but leave every action time to finish.
export const nextCourtTurnDelay = (remaining = 0, speed = 1) => Math.max(2000 / speed, remaining + 300 / speed);

export function buildCourtPlayback(before, after, events, { speed = 1 } = {}) {
  const initial = snapshot(before), final = snapshot(after);
  const stages = [], effects = [];
  // A new kickoff is a reset, not a trip across the court.
  if (events.some((e) => e.type === 'restart')) return { initial, final, stages, effects, duration: 0 };
  let view = initial, cursor = 0, action = null, attack = null;
  const stage = (duration, update = () => {}, flight = false) => {
    const next = copy(view); update(next); reconcile(next);
    if (duration) stages.push({ start: cursor, end: cursor + duration, from: view, to: next, flight });
    cursor += duration; view = next;
  };
  const effect = (kind, id, label = '', extra = {}) => {
    const p = player(view, id);
    if (p) effects.push({ kind, playerId: id, position: { ...p.position }, label, start: cursor, duration: 900, ...extra });
  };
  const finishBeat = () => {
    const end = Math.max(cursor, ...effects.map((e) => e.start + e.duration));
    if (end > cursor) stage(end - cursor);
  };
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    // Read an action's result before the next action, reaction or movement.
    // In particular, several opportunity attacks get separate beats.
    if (e.resolvedAction || ['move', 'attack', 'opportunity'].includes(e.type)) finishBeat();
    if (e.resolvedAction) action = e.resolvedAction;
    switch (e.type) {
      case 'move': {
        const drag = events[i + 1]?.type === 'drag' && events[i + 1].byId === e.playerId ? events[++i] : null;
        const duration = Math.min(250, 70 + e.path.length * 25);
        e.path.forEach((position, step) => stage(duration / e.path.length, (next) => {
          player(next, e.playerId).position = { ...position };
          if (drag) player(next, drag.playerId).position = { ...drag.path[step] };
        }));
        break;
      }
      case 'attack': case 'opportunity':
        attack = { playerId: e.playerId, targetId: e.targetId };
        effect(e.type, e.targetId, '', { source: { ...player(view, e.playerId).position }, duration: 420 });
        stage(220); break;
      case 'damage':
        effect('damage', e.playerId, `−${e.amount}`);
        stage(650, (next) => { const p = player(next, e.playerId); p.hp = Math.max(0, p.hp - e.amount); }); break;
      case 'miss': effect('miss', attack?.targetId, 'Raté'); stage(650); break;
      case 'ko':
        effect('ko', e.playerId, 'KO');
        stage(650, (next) => { const p = player(next, e.playerId); p.hp = 0; p.prone = true; release(next, p.id); }); break;
      case 'grapple':
        effect('grapple', action?.targetId, 'Prise');
        stage(650, (next) => { player(next, action.playerId).grappling = action.targetId; player(next, action.targetId).grappledBy = action.playerId; }); break;
      case 'escape':
        effect('grapple', action?.playerId, 'Libre'); stage(650, (next) => release(next, action.playerId)); break;
      case 'release':
        if (action?.type === 'release') stage(0, (next) => release(next, action.playerId));
        break;
      case 'prone':
        effect('prone', action?.targetId, 'Au sol'); stage(650, (next) => { player(next, action.targetId).prone = true; }); break;
      case 'stand': stage(180, (next) => { player(next, e.actorId).prone = false; }); break;
      case 'push': stage(100, (next) => { player(next, e.playerId).position = { ...e.position }; }); break;
      case 'possession':
        effect('possession', e.playerId, e.reason === 'intercepte' ? 'Intercept.' : e.reason === 'arrache' ? 'Volée' : 'Balle');
        stage(650, (next) => { next.ball = { carrierId: e.playerId, position: { ...player(next, e.playerId).position } }; }); break;
      case 'pass': {
        // The flight ends at the actual receiver/interceptor, or at the fumble cell.
        const outcome = events.slice(i + 1).find((event) => event.type === 'possession' || event.type === 'drop');
        if (outcome) stage(155, (next) => {
          next.ball = outcome.type === 'possession'
            ? { carrierId: outcome.playerId, position: { ...player(next, outcome.playerId).position } }
            : { carrierId: null, position: { ...outcome.position } };
        }, true);
        break;
      }
      case 'drop': stage(100, (next) => { next.ball = { carrierId: null, position: { ...e.position } }; }, true); break;
      case 'dodge': effect('dodge', action?.playerId, 'Esquive'); stage(650); break;
      case 'help': effect('help', action?.targetId, 'Aide'); stage(650); break;
      case 'failure':
        if (['grapple', 'strip', 'shove'].includes(action?.type)) { effect('miss', action.targetId, 'Résiste'); stage(650); }
        break;
    }
  }
  finishBeat();
  // Only the chosen playback speed scales time, never the turn's complexity.
  const scale = 1 / speed;
  return { initial, final, duration: cursor * scale,
    stages: stages.map((s) => ({ ...s, start: s.start * scale, end: s.end * scale })),
    effects: effects.map((e) => ({ ...e, start: e.start * scale, duration: e.duration * scale })) };
}

const mix = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
export function sampleCourtPlayback(plan, elapsed) {
  if (elapsed >= plan.duration || !plan.stages.length) return { ...plan.final, ballPoint: ballPoint(plan.final), effects: [] };
  const stage = plan.stages.find((s) => elapsed < s.end) ?? plan.stages.at(-1);
  const progress = Math.max(0, Math.min(1, (elapsed - stage.start) / (stage.end - stage.start)));
  const view = { players: stage.to.players.map((p) => ({ ...p, position: mix(player(stage.from, p.id).position, p.position, progress) })), ball: stage.to.ball };
  return { ...view, ballPoint: stage.flight ? mix(ballPoint(stage.from), ballPoint(stage.to), progress) : ballPoint(view),
    flying: stage.flight,
    effects: plan.effects.filter((e) => elapsed >= e.start && elapsed < e.start + e.duration)
      .map((e) => ({ ...e, progress: (elapsed - e.start) / e.duration })) };
}

export function createCourtPlayback(draw, {
  now = () => performance.now(), request = (callback) => requestAnimationFrame(callback),
  cancel = (id) => cancelAnimationFrame(id), reducedMotion = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
} = {}) {
  let requestId = null, generation = 0, final = null, endsAt = 0;
  const stop = () => {
    generation++;
    if (requestId !== null) cancel(requestId);
    requestId = null; endsAt = 0;
  };
  const settle = () => {
    stop();
    if (final) draw({ ...final, ballPoint: ballPoint(final), effects: [] });
  };
  const show = (state) => { stop(); final = snapshot(state); draw({ ...final, ballPoint: ballPoint(final), effects: [] }); };
  const play = (before, after, events, options) => {
    stop(); final = snapshot(after);
    if (reducedMotion()) { settle(); return 0; }
    const plan = buildCourtPlayback(before, after, events, options), started = now(), token = generation;
    endsAt = started + plan.duration;
    const tick = (time) => {
      if (token !== generation) return;
      if (time - started >= plan.duration || reducedMotion()) { settle(); return; }
      draw(sampleCourtPlayback(plan, time - started));
      requestId = request(tick);
    };
    tick(started);
    return plan.duration;
  };
  return { show, play, settle, remaining: () => Math.max(0, endsAt - now()) };
}
