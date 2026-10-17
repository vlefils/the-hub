import { trajectory } from './rules.mjs';

// Presentation timeline only: never advances the engine or consumes random numbers.
export const courtPoint = ({ x, y }) => ({ x: x * 60 + 30, y: y * 60 + 30 });
const player = (view, id) => view.players.find((p) => p.id === id);
const snapshot = (state, facings = {}) => ({
  round: state.round, phase: state.phase, finished: state.finished,
  players: state.players.map(({ id, teamId, number, hp, maxHp, position, prone, grappling, grappledBy }) =>
    ({ id, teamId, number, hp, maxHp, position: { ...position }, prone, grappling, grappledBy, facing: facings[id] ?? (teamId === 'home' ? 90 : 270) })),
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

export function buildCourtPlayback(before, after, events, { speed = 1, facings = {}, deferRestart = false } = {}) {
  const initial = snapshot(before, facings), final = snapshot(after, facings);
  const stages = [], effects = [], gestures = [];
  // A new kickoff is a reset, not a trip across the court.
  if (!deferRestart && events.some((e) => e.type === 'restart')) return { initial, final, stages, effects, gestures, duration: 0 };
  let view = initial, cursor = 0, action = null, attack = null, lastPasser = null;
  const heading = (from, to) => (Math.atan2(to.y - from.y, to.x - from.x) * 180 / Math.PI + 450) % 360;
  const face = (id, target) => {
    const p = player(view, id);
    if (!p || !target || p.position.x === target.x && p.position.y === target.y) return;
    view = copy(view); player(view, id).facing = heading(p.position, target);
  };
  const gesture = (kind, id, duration = 600) => { if (player(view, id)) gestures.push({ kind, playerId: id, start: cursor, duration }); };
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
    const end = Math.max(cursor, ...effects.map((e) => e.start + e.duration), ...gestures.map((e) => e.start + e.duration));
    if (end > cursor) stage(end - cursor);
  };
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    // Read an action's result before the next action, reaction or movement.
    // In particular, several opportunity attacks get separate beats.
    if (e.resolvedAction || ['move', 'attack', 'opportunity'].includes(e.type)
      || (e.type === 'class' && ['lock', 'call', 'feint', 'observe'].includes(e.ability))) finishBeat();
    if (e.resolvedAction) action = e.resolvedAction;
    switch (e.type) {
      case 'class':
        if (e.targetId) face(e.playerId, player(view, e.targetId)?.position);
        gesture(e.ability === 'absorb' ? 'brace' : e.ability === 'feint' ? 'dodge' : 'signal', e.visualId ?? e.playerId);
        effect(e.ability === 'absorb' ? 'absorb' : 'class', e.visualId ?? e.playerId, e.label,
          { duration: e.ability === 'observe' ? 600 : 900 });
        stage(e.ability === 'absorb' ? 180 : 450); break;
      case 'move': {
        const drag = events[i + 1]?.type === 'drag' && events[i + 1].byId === e.playerId ? events[++i] : null;
        const duration = Math.min(250, 70 + e.path.length * 25);
        e.path.forEach((position, step) => stage(duration / e.path.length, (next) => {
          const mover = player(next, e.playerId); mover.facing = heading(mover.position, position); mover.position = { ...position };
          if (drag) player(next, drag.playerId).position = { ...drag.path[step] };
        }));
        break;
      }
      case 'attack': case 'opportunity':
        attack = { playerId: e.playerId, targetId: e.targetId };
        face(e.playerId, player(view, e.targetId)?.position); gesture('strike', e.playerId, 450);
        effect(e.type, e.targetId, '', { source: { ...player(view, e.playerId).position }, duration: 420 });
        stage(220); break;
      case 'damage':
        gesture('brace', e.playerId, 650);
        effect('damage', e.playerId, `−${e.amount}`);
        stage(650, (next) => { const p = player(next, e.playerId); p.hp = Math.max(0, p.hp - e.amount); }); break;
      case 'miss': effect('miss', attack?.targetId, 'Raté'); stage(650); break;
      case 'ko':
        effect('ko', e.playerId, 'KO');
        stage(650, (next) => { const p = player(next, e.playerId); p.hp = 0; p.prone = true; release(next, p.id); }); break;
      case 'grapple':
        face(action?.playerId, player(view, action?.targetId)?.position); face(action?.targetId, player(view, action?.playerId)?.position);
        gesture('grapple', action?.playerId); gesture('brace', action?.targetId);
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
        face(e.playerId, lastPasser ? player(view, lastPasser)?.position : view.ball.position); gesture('receive', e.playerId);
        effect('possession', e.playerId, e.reason === 'intercepte' ? 'Intercept.' : e.reason === 'arrache' ? 'Volée' : 'Balle');
        stage(650, (next) => { next.ball = { carrierId: e.playerId, position: { ...player(next, e.playerId).position } }; }); break;
      case 'pass': {
        lastPasser = e.playerId; face(e.playerId, player(view, e.targetId)?.position); gesture('throw', e.playerId, 550);
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
      case 'dodge': gesture('dodge', action?.playerId); effect('dodge', action?.playerId, 'Esquive'); stage(650); break;
      case 'help': gesture('signal', action?.playerId); effect('help', action?.targetId, 'Aide'); stage(650); break;
      case 'failure':
        if (['grapple', 'strip', 'shove'].includes(action?.type)) { effect('miss', action.targetId, 'Résiste'); stage(650); }
        if (action?.type === 'pickup') { face(action.playerId, view.ball.position); gesture('receive', action.playerId); effect('miss', action.playerId, 'Manqué'); stage(650); }
        break;
    }
  }
  finishBeat();
  for (const p of final.players) p.facing = player(view, p.id).facing;
  // Only the chosen playback speed scales time, never the turn's complexity.
  const scale = 1 / speed;
  return { initial, final, duration: cursor * scale,
    stages: stages.map((s) => ({ ...s, start: s.start * scale, end: s.end * scale })),
    effects: effects.map((e) => ({ ...e, start: e.start * scale, duration: e.duration * scale })),
    gestures: gestures.map((e) => ({ ...e, start: e.start * scale, duration: e.duration * scale })) };
}

const mix = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
export function sampleCourtPlayback(plan, elapsed) {
  if (elapsed >= plan.duration || !plan.stages.length) return { ...plan.final, ballPoint: ballPoint(plan.final), effects: [] };
  const stage = plan.stages.find((s) => elapsed < s.end) ?? plan.stages.at(-1);
  const progress = Math.max(0, Math.min(1, (elapsed - stage.start) / (stage.end - stage.start)));
  const gestures = new Map((plan.gestures ?? []).filter((g) => elapsed >= g.start && elapsed < g.start + g.duration).map((g) => [g.playerId, { kind: g.kind, progress: (elapsed - g.start) / g.duration }]));
  const view = { round: plan.initial.round, phase: plan.initial.phase, finished: false, players: stage.to.players.map((p) => {
    const from = player(stage.from, p.id).position;
    return { ...p, position: mix(from, p.position, progress), walking: !p.grappledBy && (from.x !== p.position.x || from.y !== p.position.y),
      walkPhase: (plan.stages.indexOf(stage) + progress) * Math.PI, gesture: gestures.get(p.id) };
  }), ball: stage.flight ? { ...stage.to.ball, carrierId: null } : stage.to.ball };
  return { ...view, ballPoint: stage.flight ? mix(ballPoint(stage.from), ballPoint(stage.to), progress) : ballPoint(view),
    flying: stage.flight,
    effects: plan.effects.filter((e) => elapsed >= e.start && elapsed < e.start + e.duration)
      .map((e) => ({ ...e, progress: (elapsed - e.start) / e.duration })) };
}

export const ROUND_DURATION = 12000;

// Whole turns are independent tracks. Reserve the people, ball and traversed
// cells they actually use, so an interaction cannot overtake its prerequisites.
// This intentionally keeps a crowded duel ordered while distant play overlaps.
export function buildRoundPlayback(turns, { speed = 1, facings = {} } = {}) {
  if (!turns.length) throw new Error('Un round à animer doit contenir au moins une étape.');
  const initial = snapshot(turns[0].before, facings), available = new Map(), scheduled = [];
  const headings = { ...facings }, ids = new Set(initial.players.map((p) => p.id));
  for (const turn of turns) {
    const plan = buildCourtPlayback(turn.before, turn.after, turn.events, { facings: headings, deferRestart: true });
    for (const p of plan.final.players) headings[p.id] = p.facing;
    const participants = new Set(), resources = new Set();
    const references = (value) => {
      if (typeof value === 'string' && ids.has(value)) participants.add(value);
      else if (value && typeof value === 'object') for (const child of Object.values(value)) references(child);
    };
    turn.events.forEach(references);
    for (const p of plan.final.players) if (JSON.stringify(p) !== JSON.stringify(player(plan.initial, p.id))) participants.add(p.id);
    const actorId = turn.after.turns > turn.before.turns ? turn.after.activeId : null;
    if (actorId) participants.add(actorId);
    // A held player and the holder stay on the same track, even without a drag.
    for (const id of participants) for (const view of [plan.initial, plan.final]) {
      const p = player(view, id); if (p?.grappling) participants.add(p.grappling); if (p?.grappledBy) participants.add(p.grappledBy);
    }
    const cell = (p) => { if (p) resources.add(`cell:${p.x},${p.y}`); };
    const route = (points) => {
      points.forEach(cell);
      // Crossing diagonals also share a corridor, despite distinct endpoints.
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1], b = points[i];
        if (a.x !== b.x && a.y !== b.y) resources.add(`diagonal:${Math.min(a.x, b.x)},${Math.min(a.y, b.y)}`);
      }
    };
    for (const id of participants) {
      resources.add(`player:${id}`); cell(player(plan.initial, id)?.position); cell(player(plan.final, id)?.position);
    }
    for (const e of turn.events) if (['move', 'drag', 'push'].includes(e.type)) route([e.from, ...(e.path ?? [e.position])].filter(Boolean));
    for (const stage of plan.stages) if (stage.flight) {
      const from = player(stage.from, stage.from.ball.carrierId)?.position ?? stage.from.ball.position;
      const to = player(stage.to, stage.to.ball.carrierId)?.position ?? stage.to.ball.position;
      route(trajectory(from, to));
    }
    const usesBall = JSON.stringify(plan.initial.ball) !== JSON.stringify(plan.final.ball)
      || [plan.initial.ball.carrierId, plan.final.ball.carrierId].some((id) => id && participants.has(id))
      || turn.events.some((e) => ['pass', 'possession', 'drop'].includes(e.type) || ['pickup', 'strip'].includes(e.resolvedAction?.type));
    if (usesBall) { resources.add('ball'); cell(plan.initial.ball.position); cell(plan.final.ball.position); }
    const start = Math.max(0, ...[...resources].map((r) => available.get(r) ?? 0));
    const end = start + Math.max(plan.duration, actorId ? 180 : 0);
    for (const r of resources) available.set(r, end);
    scheduled.push({ plan, actorId, participants: [...participants], usesBall, start, end });
  }
  const span = Math.max(1, ...scheduled.map((t) => t.end)), duration = ROUND_DURATION / speed, scale = duration / span;
  return { initial, final: snapshot(turns.at(-1).after, headings), duration,
    turns: scheduled.map((t) => ({ ...t, start: t.start * scale, end: t.end * scale, scale })) };
}

export function sampleRoundPlayback(plan, elapsed) {
  if (elapsed >= plan.duration) return { ...plan.final, ballPoint: ballPoint(plan.final), effects: [], activeIds: [], animating: false };
  const view = copy(plan.initial), effects = [], activeIds = [];
  let flight = null;
  for (const t of plan.turns) {
    if (elapsed < t.start) continue;
    const frame = sampleCourtPlayback(t.plan, (elapsed - t.start) / t.scale);
    for (const id of t.participants) {
      const index = view.players.findIndex((p) => p.id === id);
      view.players[index] = { ...player(frame, id), position: { ...player(frame, id).position } };
    }
    if (t.usesBall) { view.ball = copy(frame.ball); flight = frame.flying ? frame.ballPoint : null; }
    effects.push(...frame.effects);
    if (elapsed < t.end && t.actorId) activeIds.push(t.actorId);
  }
  reconcile(view);
  return { ...view, finished: false, effects, activeIds, animating: true, roundProgress: elapsed / plan.duration,
    ballPoint: flight ?? ballPoint(view), flying: Boolean(flight) };
}

export function createCourtPlayback(draw, {
  now = () => performance.now(), request = (callback) => requestAnimationFrame(callback),
  cancel = (id) => cancelAnimationFrame(id), reducedMotion = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
} = {}) {
  let requestId = null, generation = 0, final = null, endsAt = 0, matchKey = null, lastTurns = 0;
  const facings = {};
  const render = (frame) => { for (const p of frame.players) facings[p.id] = p.facing; draw(frame); };
  const stop = () => {
    generation++;
    if (requestId !== null) cancel(requestId);
    requestId = null; endsAt = 0;
  };
  const settle = () => {
    stop();
    if (final) render({ ...final, ballPoint: ballPoint(final), effects: [] });
  };
  const show = (state) => {
    const key = `${state.seed}:${state.players.map((p) => p.playerId ?? p.name).join('|')}`;
    if (key !== matchKey || state.turns < lastTurns) for (const id of Object.keys(facings)) delete facings[id];
    matchKey = key; lastTurns = state.turns;
    stop(); final = snapshot(state, facings); render({ ...final, ballPoint: ballPoint(final), effects: [] });
  };
  const run = (plan, sample) => {
    stop();
    const started = now(), token = generation;
    final = plan.final;
    if (reducedMotion()) { settle(); return 0; }
    endsAt = started + plan.duration;
    const tick = (time) => {
      if (token !== generation) return;
      if (time - started >= plan.duration || reducedMotion()) { settle(); return; }
      render(sample(plan, time - started));
      requestId = request(tick);
    };
    tick(started);
    return plan.duration;
  };
  const play = (before, after, events, options) => run(buildCourtPlayback(before, after, events, { ...options, facings }), sampleCourtPlayback);
  const playRound = (turns, options) => run(buildRoundPlayback(turns, { ...options, facings }), sampleRoundPlayback);
  return { show, play, playRound, settle, remaining: () => Math.max(0, endsAt - now()) };
}
