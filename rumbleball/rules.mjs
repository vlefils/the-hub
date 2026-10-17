import { COURT, WET_CELLS, modifier } from './data.mjs';
import { ARCHETYPES, classCaps, isRunner } from './classes.mjs';
import { isCenterBall } from './deployment.mjs';
import { openingPlan } from './openings.mjs';

export const distance = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
export const sameCell = (a, b) => a.x === b.x && a.y === b.y;
export const cellLabel = (cell) => `${String.fromCharCode(65 + cell.x)}${cell.y + 1}`;
export const inside = (p) => Number.isInteger(p.x) && Number.isInteger(p.y) && p.x >= 0 && p.x < COURT.width && p.y >= 0 && p.y < COURT.height;
export const playerById = (state, id) => state.players.find((p) => p.id === id);
export const active = (state) => state.players.filter((p) => p.hp > 0);
export const opponents = (state, p) => active(state).filter((q) => q.teamId !== p.teamId);
export const allies = (state, p) => active(state).filter((q) => q.teamId === p.teamId && q.id !== p.id);
export const carrier = (state) => playerById(state, state.ball.carrierId);
const wet = new Set(WET_CELLS.map(([x, y]) => `${x},${y}`));
export const isWet = (p) => wet.has(`${p.x},${p.y}`);
export const skill = (p, name) => p.skills[name] ?? modifier(p.abilities[name === 'acrobatics' ? 'dexterity' : 'strength']);
export const stat = (p, name) => modifier(p.abilities[name]);
export const occupied = (state, pos, exceptId) => active(state).some((p) => p.id !== exceptId && sameCell(p.position, pos));
export const neighbors = (pos) => [-1, 0, 1].flatMap((dx) => [-1, 0, 1].map((dy) => ({ x: pos.x + dx, y: pos.y + dy }))).filter((p) => inside(p) && !sameCell(p, pos));

export function randomInt(state, max) {
  // Mulberry32: RNG state is part of the match, never tied to playback or the clock.
  state.rng = (state.rng + 0x6D2B79F5) >>> 0;
  let n = state.rng;
  n = Math.imul(n ^ (n >>> 15), n | 1);
  n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
  return Math.floor(((n ^ (n >>> 14)) >>> 0) / 4294967296 * max);
}
export function emit(state, events, type, message, data = {}) {
  events.push({ round: state.round, phase: state.phase, actorId: state.activeId ?? null, type, message, ...data });
}
export function check(state, bonus, events, label, { advantage = false, disadvantage = false, playerId } = {}) {
  const dice = [randomInt(state, 20) + 1];
  if (advantage !== disadvantage) dice.push(randomInt(state, 20) + 1);
  const natural = dice.length === 1 ? dice[0] : advantage ? Math.max(...dice) : Math.min(...dice);
  const total = natural + bonus;
  emit(state, events, 'roll', `${label} : ${dice.join(' / ')} ${bonus >= 0 ? '+' : '−'} ${Math.abs(bonus)} = ${total}`, { dice, natural, bonus, total, ...(playerId ? { playerId } : {}) });
  return { natural, total };
}
function aided(state, actor, enemyId, kind) {
  const index = state.aids.findIndex((a) => a.allyId === actor.id && a.kind === kind && (kind !== 'attack' || a.enemyId === enemyId));
  if (index < 0) return false;
  state.aids.splice(index, 1);
  return true;
}
function skillCheck(state, actor, bonus, events, label, advantage = false) {
  const help = aided(state, actor, null, 'check');
  // Keep failed defenders/interceptors identifiable for presentation dependencies.
  return check(state, bonus, events, label, { advantage: help || advantage, playerId: actor.id }).total;
}

export const hasCheckHelp = (state, actor) => state.aids.some((a) => a.allyId === actor.id && a.kind === 'check');
export const hasPassCall = (state, actor) => state.calls?.some((c) => c.targetId === actor.id && playerById(state, c.sourceId)?.hp > 0) ?? false;
export const armorAgainst = (target, attacker) => target.armor + Number(isRunner(target) && target.classState?.flaw === 1 && target.classState.targetId === attacker.id);
export const classEvent = (state, events, ability, actor, message, extra = {}) =>
  emit(state, events, 'class', message, { ability, playerId: actor.id, ...extra });

export function legalClassAction(state, actor, action) {
  if (!action || actor.hp <= 0 || !actor.classState) return false;
  const target = playerById(state, action.targetId), r = actor.classState;
  if (action.type === 'feint') return actor.archetype === 'escamoteur' && r.flaw === 1
    && target?.hp > 0 && target.id === r.targetId && !actor.feintTargetId;
  if (!actor.bonusAction || !target || target.hp <= 0 || distance(actor.position, target.position) > 6) return false;
  if (action.type === 'lock') return isRunner(actor) && target.teamId !== actor.teamId && r.targetId !== target.id;
  if (action.type === 'call') return actor.archetype === 'capitaine' && r.calls > 0 && target.teamId === actor.teamId
    && target.id !== actor.id && !state.calls.some((c) => c.targetId === target.id);
  return false;
}
export function resolveClassAction(state, actor, action, events = []) {
  if (!legalClassAction(state, actor, action)) return false;
  const target = playerById(state, action.targetId), r = actor.classState;
  if (action.type !== 'feint') actor.bonusAction = false;
  if (action.type === 'lock') {
    r.targetId = target.id; r.flaw = 0;
    classEvent(state, events, 'lock', actor, `${actor.name} observe ${target.name} pour préparer une ouverture.`, { targetId: target.id, label: 'Observe' });
  } else if (action.type === 'feint') {
    r.flaw = 0; actor.feintTargetId = target.id;
    classEvent(state, events, 'feint', actor, `${actor.name} exploite sa lecture de ${target.name} pour éviter ses opportunités ce tour.`, { targetId: target.id, label: 'Feinte' });
  } else {
    r.calls--; state.calls.push({ sourceId: actor.id, targetId: target.id });
    classEvent(state, events, 'call', actor, `${actor.name} prépare la prochaine passe de ${target.name} par un appel de jeu.`, { targetId: target.id, visualId: target.id, label: 'Appel' });
  }
  return true;
}
export function endTurn(state, actor, events) {
  for (const observer of state.players.filter((p) => p.hp > 0 && isRunner(p))) {
    const r = observer.classState;
    if (actor.hp > 0 && r.targetId === actor.id && !r.flaw && r.observedRound !== state.round && distance(observer.position, actor.position) <= 6) {
      r.flaw = 1; r.observedRound = state.round;
      classEvent(state, events, 'observe', observer, `${observer.name} repère une faille chez ${actor.name}.`, { targetId: actor.id, label: 'Faille +1' });
    }
  }
  actor.feintTargetId = null;
}
function clearClassLinks(state, target) {
  state.calls = (state.calls ?? []).filter((c) => c.sourceId !== target.id && c.targetId !== target.id);
  for (const p of state.players) {
    if (p.classState?.targetId === target.id || p.id === target.id) {
      p.classState.targetId = null; p.classState.flaw = 0;
    }
  }
}
export function collectiveOpening(state, actor, target) {
  if (hasCheckHelp(state, actor)) return null;
  return allies(state, actor).filter((p) => p.archetype === 'capitaine' && p.classState.flaw === 1
    && p.classState.targetId === target.id && distance(p.position, target.position) <= 6).sort((a, b) => a.id.localeCompare(b.id))[0] ?? null;
}
export function chargeRun(actor, path = []) {
  let run = actor.chargeRun, from = actor.position;
  for (const to of path) {
    const dx = to.x - from.x, dy = to.y - from.y;
    run = run?.dx === dx && run?.dy === dy ? { dx, dy, steps: run.steps + 1 } : { dx, dy, steps: 1 };
    from = to;
  }
  return run;
}
function pushAway(state, actor, target, events) {
  const valid = neighbors(target.position).filter((p) => !occupied(state, p) && distance(p, actor.position) > distance(target.position, actor.position));
  valid.sort((a, b) => distance(b, actor.position) - distance(a, actor.position) || a.y - b.y || a.x - b.x);
  if (!valid[0]) { emit(state, events, 'hold', `${target.name} est bloqué par la paroi ou les autres joueurs.`); return; }
  const from = { ...target.position }; target.position = { ...valid[0] }; target.chargeRun = null;
  if (state.ball.carrierId === target.id) state.ball.position = { ...target.position };
  releaseSeparatedGrapples(state, events);
  emit(state, events, 'push', `${actor.name} repousse ${target.name} d’une case.`, { playerId: target.id, from, position: { ...target.position } });
}
export function movementCost(actor, destination, draggedDestination = null) {
  const difficult = isWet(destination) || Boolean(draggedDestination && isWet(draggedDestination));
  return COURT.cell * (1 + Number(difficult) + Number(actor.prone)) * (actor.grappling ? 2 : 1);
}
function heldPlayer(state, actor) {
  const target = playerById(state, actor.grappling);
  return target?.hp > 0 && target.grappledBy === actor.id ? target : null;
}
// Translate both participants together, preserving their relative positions. Planning and
// execution use this same rigid pair, including the dragged player's terrain and obstacles.
export function movementStep(state, actor, from, to) {
  if (actor.hp <= 0 || actor.grappledBy) return null;
  const held = heldPlayer(state, actor);
  const movingIds = new Set([actor.id, held?.id]);
  const blocked = (cell) => active(state).some((p) => !movingIds.has(p.id) && sameCell(p.position, cell));
  const clear = (a, b) => inside(a) && inside(b) && distance(a, b) === 1 && !blocked(b)
    && !(a.x !== b.x && a.y !== b.y && blocked({ x: b.x, y: a.y }) && blocked({ x: a.x, y: b.y }));
  if (!clear(from, to)) return null;
  let dragged = null;
  if (held) {
    const offset = { x: held.position.x - actor.position.x, y: held.position.y - actor.position.y };
    const heldFrom = { x: from.x + offset.x, y: from.y + offset.y };
    const heldTo = { x: to.x + offset.x, y: to.y + offset.y };
    if (!clear(heldFrom, heldTo)) return null;
    dragged = { playerId: held.id, from: heldFrom, to: heldTo };
  }
  return { cost: movementCost(actor, to, dragged?.to), dragged };
}
export const canStep = (state, actor, from, to) => Boolean(movementStep(state, actor, from, to));

// Evaluate actions at a proposed destination with the held player and their ball in the
// corresponding position. This prevents bots planning against a target's obsolete cell.
export function movementView(state, actor, position) {
  const projected = { ...actor, position: { ...position } };
  const held = heldPlayer(state, actor);
  if (!held) return { state, actor: projected };
  const translated = { ...held, position: {
    x: held.position.x + position.x - actor.position.x,
    y: held.position.y + position.y - actor.position.y,
  } };
  const players = state.players.map((p) => p.id === actor.id ? projected : p.id === held.id ? translated : p);
  const holder = players.find((p) => p.id === state.ball.carrierId);
  return { actor: projected, state: { ...state, players, ball: holder ? { ...state.ball, position: { ...holder.position } } : state.ball } };
}
function releaseSeparatedGrapples(state, events) {
  for (const p of state.players) {
    const held = playerById(state, p.grappling);
    if (held && distance(p.position, held.position) > 1) {
      held.grappledBy = null; p.grappling = null;
      emit(state, events, 'release', `La prise de ${p.name} sur ${held.name} est rompue par le déplacement forcé.`);
    }
  }
}

// Dijkstra on 96 cells, with occupied cells and terrain costs in the same graph used by execution.
export function reachableCells(state, actor, budget = actor.movement) {
  const start = { position: { ...actor.position }, cost: 0, path: [] };
  if (actor.hp <= 0 || actor.grappledBy) return [start];
  const key = (p) => `${p.x},${p.y}`;
  const best = new Map([[key(start.position), start]]);
  const open = [start];
  while (open.length) {
    open.sort((a, b) => a.cost - b.cost || a.position.y - b.position.y || a.position.x - b.position.x);
    const current = open.shift();
    if (current !== best.get(key(current.position))) continue;
    for (const next of neighbors(current.position)) {
      const step = movementStep(state, actor, current.position, next);
      if (!step) continue;
      const cost = current.cost + step.cost;
      if (cost > budget || (best.get(key(next))?.cost ?? Infinity) <= cost) continue;
      const entry = { position: next, cost, path: [...current.path, next] };
      best.set(key(next), entry);
      open.push(entry);
    }
  }
  return [...best.values()];
}

// Cells whose interior the segment crosses, plus endpoint cells. Exact segment/box clipping
// keeps diagonal passes symmetric and avoids treating a corner touch as an extra cell.
export function trajectory(from, to) {
  const points = [];
  const dx = to.x - from.x, dy = to.y - from.y;
  for (let y = Math.floor(Math.min(from.y, to.y)); y <= Math.ceil(Math.max(from.y, to.y)); y++) {
    for (let x = Math.floor(Math.min(from.x, to.x)); x <= Math.ceil(Math.max(from.x, to.x)); x++) {
      let low = 0, high = 1;
      for (const [origin, delta, min, max] of [[from.x, dx, x - .5, x + .5], [from.y, dy, y - .5, y + .5]]) {
        if (delta === 0) { if (origin < min || origin > max) high = -1; }
        else {
          const a = (min - origin) / delta, b = (max - origin) / delta;
          low = Math.max(low, Math.min(a, b)); high = Math.min(high, Math.max(a, b));
        }
      }
      if (high - low > 1e-8 || (dx === 0 && dy === 0)) points.push({ x, y, t: (low + high) / 2 });
    }
  }
  return points.sort((a, b) => a.t - b.t).map(({ x, y }) => ({ x, y }));
}
export function interceptionCandidates(state, passer, receiverPosition) {
  const line = trajectory(passer.position, receiverPosition);
  return opponents(state, passer).filter((p) => p.reaction && line.some((cell) => distance(p.position, cell) <= 1))
    .sort((a, b) => Math.min(...line.map((c) => distance(a.position, c))) - Math.min(...line.map((c) => distance(b.position, c)))
      || skill(b, 'acrobatics') - skill(a, 'acrobatics') || state.initiative.indexOf(a.id) - state.initiative.indexOf(b.id));
}
export function ballDefender(state, actor) {
  return opponents(state, actor).filter((p) => distance(p.position, state.ball.position) <= 1)
    .sort((a, b) => Math.max(skill(b, 'wrestling'), skill(b, 'acrobatics')) - Math.max(skill(a, 'wrestling'), skill(a, 'acrobatics')) || a.id.localeCompare(b.id))[0];
}
export function giveBall(state, actor, events, reason = 'récupère', recovery = true) {
  state.ball = { carrierId: actor.id, position: { ...actor.position } };
  if (recovery) state.stats[actor.teamId].recoveries++;
  emit(state, events, 'possession', `${actor.name} ${reason} la balle.`, { playerId: actor.id, teamId: actor.teamId, reason });
}
export function resolveCenterEngagement(state, events = []) {
  if (state.version < 4 || !isCenterBall(state)) return false;
  const eligible = state.initiative.map((id) => playerById(state, id)).filter((p) => p?.hp > 0 && p.reaction && distance(p.position, state.ball.position) <= 1);
  if (!eligible.length) return false;
  const contested = new Set(eligible.map((p) => p.teamId)).size > 1;
  emit(state, events, 'engagement', 'Le ballon arrive au centre : les joueurs au contact réagissent par ordre d’initiative.', { playerIds: eligible.map((p) => p.id) });
  let winner = null, best = -Infinity;
  for (const p of eligible) {
    p.reaction = false; p.pickedUp = true;
    emit(state, events, 'center-reaction', `${p.name} tente d’intercepter l’engagement en réaction.`, { playerId: p.id });
    const reading = p.archetype === 'passeur' && p.classState.focus > 0 && !hasCheckHelp(state, p);
    if (reading) { p.classState.focus--; classEvent(state, events, 'observe', p, `${p.name} lit la trajectoire de l’engagement (1 concentration).`, { label: 'Lecture' }); }
    const total = skillCheck(state, p, Math.max(skill(p, 'wrestling'), skill(p, 'acrobatics')), events, `${p.name} · interception d’engagement${contested ? '' : ' DD 10'}`, reading);
    if (contested) { if (total > best) { winner = p; best = total; } }
    else if (total >= 10) { winner = p; break; }
  }
  if (winner) giveBall(state, winner, events, 'intercepte');
  emit(state, events, 'engagement-result', winner ? `${winner.name} intercepte l’engagement en réaction et conserve son action.` : 'Les réactions manquent le ballon ; il reste libre au centre.', { playerId: winner?.id ?? null });
  return true;
}
function releaseGrapples(state, actor) {
  if (actor.grappling) {
    const held = playerById(state, actor.grappling);
    if (held) held.grappledBy = null;
    actor.grappling = null;
  }
  if (actor.grappledBy) {
    const holder = playerById(state, actor.grappledBy);
    if (holder) holder.grappling = null;
    actor.grappledBy = null;
  }
}
export function dropBall(state, actor, events, attacker = null) {
  if (state.ball.carrierId !== actor.id) return;
  let destination = actor.position;
  if (actor.hp > 0 && attacker) {
    const options = neighbors(actor.position).filter((p) => !occupied(state, p));
    options.sort((a, b) => distance(a, attacker.position) - distance(b, attacker.position) || a.y - b.y || a.x - b.x);
    destination = options[0] ?? actor.position;
  }
  state.ball = { carrierId: null, position: { ...destination } };
  emit(state, events, 'drop', `${actor.name} lâche la balle.`, { playerId: actor.id, position: { ...destination } });
}
export function dealDamage(state, actor, target, amount, events) {
  let damage = Math.max(0, amount);
  const absorbed = target.hp > 0 && target.archetype === 'belier' ? Math.min(3, damage, target.classState.adrenaline) : 0;
  if (absorbed) {
    target.classState.adrenaline -= absorbed; damage -= absorbed;
    classEvent(state, events, 'absorb', target, `${target.name} absorbe ${absorbed} dégâts grâce à son Adrénaline.`, { amount: absorbed, label: `Absorbe ${absorbed}` });
  }
  target.hp = Math.max(0, target.hp - damage);
  emit(state, events, 'damage', `${target.name} subit ${damage} dégâts (${target.hp}/${target.maxHp} PV).`, { playerId: target.id, amount: damage });
  if (target.hp === 0) {
    dropBall(state, target, events);
    releaseGrapples(state, target);
    target.reaction = false; target.action = false; target.prone = true; target.dodging = false;
    target.bonusAction = false; clearClassLinks(state, target);
    state.aids = state.aids.filter((a) => a.helperId !== target.id && a.allyId !== target.id);
    state.stats[actor.teamId].knockouts++;
    emit(state, events, 'ko', `${target.name} est KO, stable et hors du match.`, { playerId: target.id });
  } else if (damage > 0 && state.ball.carrierId === target.id) {
    const dc = Math.max(10, damage);
    const total = check(state, stat(target, 'constitution'), events, `${target.name} · tenue de balle, DD ${dc}`).total;
    if (total < dc) dropBall(state, target, events, actor);
    else emit(state, events, 'hold', `${target.name} conserve la balle.`);
  }
}
// A reaction is provoked by a particular voluntary step, not by an entire turn's endpoints.
// This predicate is shared by execution and the bots' assessment of a path.
export function provokesOpportunity(actor, mover, from, to) {
  return actor.hp > 0 && mover.hp > 0 && actor.teamId !== mover.teamId && actor.reaction
    && actor.id !== mover.grappling && actor.id !== mover.feintTargetId
    && !mover.disengaged && !mover.grappledBy && inside(from) && inside(to) && distance(from, to) === 1
    && distance(actor.position, from) <= 1 && distance(actor.position, to) > 1;
}
export function performAttack(state, actor, target, events, opportunity = null, technique = null) {
  if (actor.hp <= 0 || !target || target.hp <= 0 || actor.teamId === target.teamId || distance(actor.position, target.position) > 1 || !(opportunity ? actor.reaction : actor.action)) return false;
  if (opportunity && (!opportunity.from || !opportunity.to || !sameCell(target.position, opportunity.from)
    || !provokesOpportunity(actor, target, opportunity.from, opportunity.to)
    || !canStep(state, target, opportunity.from, opportunity.to))) return false;
  if (technique && (opportunity || technique !== 'percussion' || actor.archetype !== 'belier' || actor.classState.adrenaline < 2 || (actor.chargeRun?.steps ?? 0) < 2)) return false;
  if (opportunity) actor.reaction = false; else { actor.action = false; actor.chargeRun = null; }
  if (technique) {
    actor.classState.adrenaline -= 2;
    classEvent(state, events, 'percussion', actor, `${actor.name} lance une percussion sur ${target.name}.`, { targetId: target.id, label: 'Percussion' });
  }
  const trigger = opportunity ? { from: { ...opportunity.from }, to: { ...opportunity.to }, attackerPosition: { ...actor.position }, reach: 1 } : null;
  const message = opportunity
    ? `${actor.name} tente une attaque d’opportunité sur ${target.name} : sortie d’allonge tentée de ${cellLabel(trigger.from)} vers ${cellLabel(trigger.to)}. L’attaque précède le déplacement.`
    : `${actor.name} attaque ${target.name}.`;
  emit(state, events, opportunity ? 'opportunity' : 'attack', message, { playerId: actor.id, targetId: target.id, ...(trigger ? { trigger } : {}) });
  const helped = aided(state, actor, target.id, 'attack');
  const armor = armorAgainst(target, actor);
  const roll = check(state, actor.attack.bonus, events, `${actor.name} · attaque contre CA ${armor}`, {
    advantage: target.prone || helped,
    disadvantage: actor.prone || (target.dodging && !target.grappledBy),
  });
  if (roll.natural === 1 || (roll.natural !== 20 && roll.total < armor)) {
    emit(state, events, 'miss', `${actor.name} manque ${target.name}.`);
    return true;
  }
  const dice = Array.from({ length: roll.natural === 20 ? 2 : 1 }, () => randomInt(state, actor.attack.die) + 1);
  emit(state, events, 'roll', `${roll.natural === 20 ? 'Critique ! ' : ''}Dégâts : ${dice.join(' + ')} + ${actor.attack.flat}`, { dice, critical: roll.natural === 20 });
  dealDamage(state, actor, target, dice.reduce((a, b) => a + b, actor.attack.flat), events);
  if (technique && target.hp > 0) {
    const save = check(state, stat(target, 'strength'), events, `${target.name} · résister à la percussion, DD 13`).total;
    if (save < 13) pushAway(state, actor, target, events);
    else emit(state, events, 'hold', `${target.name} résiste à la percussion.`);
  }
  return true;
}
export function shouldTakeOpportunity(state, actor, mover) {
  const holder = carrier(state);
  if (mover.id === holder?.id) return true;
  if (openingPlan(state, actor)?.receivers.includes(actor.id)) return false;
  const passingOutlet = (actor.archetype === 'passeur' || state.version >= 4 && actor.role === 'defender') && actor.instruction !== 'aggressive'
    && state.teams.find((t) => t.id === actor.teamId)?.strategy === 'possession'
    && holder && distance(actor.position, holder.position) <= 6;
  if (holder?.teamId === actor.teamId && (actor.role === 'relay' || actor.instruction === 'cautious' || passingOutlet)) return false;
  return true;
}
export function moveAlong(state, actor, path, events) {
  if (actor.hp <= 0 || actor.grappledBy) return;
  let start = { ...actor.position }, traversed = [];
  const draggedId = heldPlayer(state, actor)?.id;
  let draggedStart = draggedId ? { ...playerById(state, draggedId).position } : null, draggedPath = [];
  const flushMovement = () => {
    if (!traversed.length) return;
    emit(state, events, 'move', `${actor.name} se déplace de ${traversed.length} case${traversed.length > 1 ? 's' : ''} (${cellLabel(start)} → ${cellLabel(actor.position)}).`, {
      playerId: actor.id, from: start, path: traversed, position: { ...actor.position },
    });
    if (draggedPath.length) {
      const held = playerById(state, draggedId);
      emit(state, events, 'drag', `${actor.name} entraîne ${held.name} (${cellLabel(draggedStart)} → ${cellLabel(held.position)}), à vitesse réduite de moitié, en maintenant la prise.`, {
        playerId: held.id, byId: actor.id, from: draggedStart, path: draggedPath, position: { ...held.position },
      });
      draggedStart = { ...held.position }; draggedPath = [];
    }
    start = { ...actor.position }; traversed = [];
  };
  for (const next of path) {
    const step = movementStep(state, actor, actor.position, next);
    if (!step || step.cost > actor.movement) break;
    if (!actor.disengaged) {
      const eligible = opponents(state, actor).filter((enemy) => provokesOpportunity(enemy, actor, actor.position, next) && shouldTakeOpportunity(state, enemy, actor))
        .sort((a, b) => state.initiative.indexOf(a.id) - state.initiative.indexOf(b.id));
      // Publish the already completed steps before the attack that interrupts the next one.
      if (eligible.length) flushMovement();
      for (const enemy of eligible) {
        if (actor.hp <= 0) break;
        performAttack(state, enemy, actor, events, { from: { ...actor.position }, to: { ...next } });
      }
    }
    if (actor.hp <= 0) {
      emit(state, events, 'movement-stopped', `${actor.name} reste en ${cellLabel(actor.position)} : le KO interrompt le déplacement avant d’atteindre ${cellLabel(next)}.`, {
        playerId: actor.id, position: { ...actor.position }, attemptedTo: { ...next },
      });
      break;
    }
    actor.chargeRun = chargeRun(actor, [next]);
    actor.movement -= step.cost;
    actor.position = { ...next };
    if (state.ball.carrierId === actor.id) state.ball.position = { ...next };
    if (step.dragged) {
      const held = playerById(state, step.dragged.playerId);
      held.position = { ...step.dragged.to };
      draggedPath.push({ ...held.position });
      if (state.ball.carrierId === held.id) state.ball.position = { ...held.position };
      releaseSeparatedGrapples(state, events);
    }
    traversed.push({ ...next });
  }
  flushMovement();
}

export function legalAction(state, actor, action) {
  if (!action || actor.hp <= 0) return false;
  if (action.technique) {
    const r = actor.classState;
    if (action.technique === 'percussion') {
      if (action.type !== 'attack' || actor.archetype !== 'belier' || r.adrenaline < 2 || (actor.chargeRun?.steps ?? 0) < 2) return false;
    } else if (action.technique === 'precision') {
      if (action.type !== 'pass' || actor.archetype !== 'passeur' || r.focus <= 0) return false;
    } else if (action.technique === 'exploitation') {
      if (action.type !== 'strip' || actor.archetype !== 'escamoteur' || r.flaw !== 1 || r.targetId !== action.targetId) return false;
    } else return false;
  }
  if (action.type === 'wait') return true;
  if (action.type === 'drop') return state.ball.carrierId === actor.id;
  if (action.type === 'release') return Boolean(actor.grappling);
  const target = playerById(state, action.targetId);
  const enemy = target && target.hp > 0 && target.teamId !== actor.teamId && distance(actor.position, target.position) <= 1;
  if (action.type === 'pickup') {
    if (state.ball.carrierId || actor.pickedUp || distance(actor.position, state.ball.position) > 1) return false;
    if (isCenterBall(state)) return state.version >= 4 ? actor.reaction : actor.action;
    return ballDefender(state, actor) ? actor.action : actor.interaction;
  }
  if (!actor.action) return false;
  switch (action.type) {
    case 'attack': case 'strip': return Boolean(enemy && (action.type !== 'strip' || state.ball.carrierId === target.id));
    case 'grapple': return Boolean(enemy && !actor.grappling && !target.grappledBy);
    case 'shove': return Boolean(enemy && (!target.prone || action.mode === 'push'));
    case 'escape': return Boolean(actor.grappledBy);
    case 'pass': return Boolean(state.ball.carrierId === actor.id && target?.hp > 0 && target.id !== actor.id && target.teamId === actor.teamId && distance(actor.position, target.position) <= 6);
    case 'help': {
      if (!target || target.hp <= 0 || target.id === actor.id || target.teamId !== actor.teamId) return false;
      if (!action.enemyId) return distance(actor.position, target.position) <= 1;
      const foe = playerById(state, action.enemyId);
      return Boolean(foe?.hp > 0 && foe.teamId !== actor.teamId && distance(actor.position, foe.position) <= 1);
    }
    case 'dash': case 'dodge': case 'disengage': return true;
    default: return false;
  }
}
export function resolveAction(state, actor, action, events = []) {
  const firstEvent = events.length;
  const context = { ...action, playerId: actor.id,
    ...(action?.type === 'pickup' && isCenterBall(state) ? { atCenter: true } : {}),
    targetId: action?.targetId ?? (action?.type === 'release' ? actor.grappling : action?.type === 'escape' ? actor.grappledBy : undefined) };
  const resolved = resolveActionEvents(state, actor, action, events);
  // Mark the actual action, including replans and pickup follow-ups, on its first event.
  // The narrative can group outcomes without parsing French messages or adding RNG calls.
  if (resolved && events.length > firstEvent) events[firstEvent].resolvedAction = context;
  return resolved;
}
function resolveActionEvents(state, actor, action, events) {
  if (!legalAction(state, actor, action)) return false;
  const target = playerById(state, action.targetId);
  if (action.type === 'wait') { actor.action = false; emit(state, events, 'wait', `${actor.name} tient sa position.`); return true; }
  if (action.type === 'drop') { dropBall(state, actor, events); return true; }
  if (action.type === 'release') {
    const held = playerById(state, actor.grappling); held.grappledBy = null; actor.grappling = null;
    emit(state, events, 'release', `${actor.name} relâche volontairement ${held.name}.`); return true;
  }
  if (action.type === 'attack') return performAttack(state, actor, target, events, null, action.technique);
  actor.chargeRun = null;
  if (action.type === 'pickup') {
    if (state.version >= 4 && isCenterBall(state)) return resolveCenterEngagement(state, events);
    actor.pickedUp = true;
    const defender = ballDefender(state, actor);
    if (!defender && isCenterBall(state)) {
      actor.action = false;
      const attempt = skillCheck(state, actor, Math.max(skill(actor, 'wrestling'), skill(actor, 'acrobatics')), events, `${actor.name} · prise au centre DD 10`);
      if (attempt >= 10) giveBall(state, actor, events, 'attrape');
      else emit(state, events, 'failure', `${actor.name} manque le ballon au centre ; il reste à l’intersection.`);
    }
    else if (!defender) { actor.interaction = false; giveBall(state, actor, events); }
    else {
      actor.action = false;
      const attempt = skillCheck(state, actor, Math.max(skill(actor, 'wrestling'), skill(actor, 'acrobatics')), events, `${actor.name} · ramassage contesté`);
      const defense = skillCheck(state, defender, Math.max(skill(defender, 'wrestling'), skill(defender, 'acrobatics')), events, `${defender.name} · opposition au ramassage`);
      if (attempt > defense) giveBall(state, actor, events, isCenterBall(state) ? 'attrape' : 'récupère');
      else emit(state, events, 'failure', `${defender.name} empêche le ramassage ; balle libre.`);
    }
    return true;
  }
  actor.action = false;
  if (action.type === 'dash') { actor.movement += actor.speed; emit(state, events, 'dash', `${actor.name} fonce : mouvement augmenté de ${actor.speed} m.`); }
  if (action.type === 'dodge') { actor.dodging = true; emit(state, events, 'dodge', `${actor.name} esquive jusqu’à son prochain tour.`); }
  if (action.type === 'disengage') { actor.disengaged = true; emit(state, events, 'disengage', `${actor.name} se désengage sans attaque d’opportunité.`); }
  if (action.type === 'help') {
    const kind = action.enemyId ? 'attack' : 'check';
    state.aids = state.aids.filter((a) => !(a.allyId === target.id && a.kind === kind && a.enemyId === (action.enemyId ?? null)));
    state.aids.push({ helperId: actor.id, allyId: target.id, kind, enemyId: action.enemyId ?? null });
    emit(state, events, 'help', `${actor.name} aide ${target.name} : avantage à ${kind === 'attack' ? 'sa prochaine attaque sur la cible' : 'son prochain test'}.`);
  }
  if (action.type === 'escape') {
    const holder = playerById(state, actor.grappledBy);
    const attack = skillCheck(state, actor, Math.max(skill(actor, 'athletics'), skill(actor, 'acrobatics')), events, `${actor.name} · se libérer`);
    const defense = skillCheck(state, holder, skill(holder, 'wrestling'), events, `${holder.name} · maintien`);
    if (attack > defense) { holder.grappling = null; actor.grappledBy = null; emit(state, events, 'escape', `${actor.name} se libère.`); }
    else emit(state, events, 'failure', `${actor.name} reste agrippé.`);
  }
  if (['strip', 'grapple', 'shove'].includes(action.type)) {
    const own = action.technique === 'exploitation';
    const captain = own ? null : collectiveOpening(state, actor, target);
    if (own || captain) {
      const source = captain ?? actor; source.classState.flaw = 0;
      classEvent(state, events, own ? 'exploit' : 'opening', source,
        own ? `${actor.name} exploite sa lecture de ${target.name} pour tenter l’arrachement.`
          : `${source.name} ouvre une brèche pour ${actor.name} contre ${target.name}.`,
        { targetId: target.id, beneficiaryId: actor.id, visualId: actor.id, label: own ? 'Exploitation' : 'Ouverture' });
    }
    const defenseBonus = action.type === 'strip' ? Math.max(skill(target, 'wrestling'), skill(target, 'acrobatics')) : Math.max(skill(target, 'athletics'), skill(target, 'acrobatics'));
    const attack = skillCheck(state, actor, skill(actor, 'wrestling'), events, `${actor.name} · ${action.type === 'strip' ? 'arrachement' : action.type === 'grapple' ? 'agrippement' : 'plaquage'}`, own || Boolean(captain));
    const defense = skillCheck(state, target, defenseBonus, events, `${target.name} · défense`);
    if (attack <= defense) emit(state, events, 'failure', `${target.name} résiste à ${actor.name}${attack === defense ? ' (égalité au défenseur)' : ''}.`);
    else if (action.type === 'strip') giveBall(state, actor, events, 'arrache');
    else if (action.type === 'grapple') {
      actor.grappling = target.id; target.grappledBy = actor.id;
      emit(state, events, 'grapple', `${actor.name} agrippe ${target.name} : vitesse nulle.`);
    } else if (action.mode === 'push') {
      pushAway(state, actor, target, events);
    } else { target.prone = true; emit(state, events, 'prone', `${actor.name} plaque ${target.name} à terre ; la balle reste tenue.`); }
  }
  if (action.type === 'pass') {
    const precision = action.technique === 'precision', called = hasPassCall(state, actor);
    if (precision) {
      actor.classState.focus--;
      classEvent(state, events, 'precision', actor, `${actor.name} ajuste sa passe avec concentration.`, { label: 'Passe ajustée' });
    }
    if (called) {
      const caller = playerById(state, state.calls.find((c) => c.targetId === actor.id).sourceId);
      state.calls = state.calls.filter((c) => c.targetId !== actor.id);
      classEvent(state, events, 'call-used', actor, `${actor.name} suit l’appel de ${caller.name} pour sa passe.`, { label: 'Passe guidée' });
    }
    state.stats[actor.teamId].passesAttempted++;
    const dc = actor.grappledBy || opponents(state, actor).some((p) => distance(actor.position, p.position) <= 1) ? 15 : 10;
    emit(state, events, 'pass', `${actor.name} passe à ${target.name} (DD ${dc}).`, { playerId: actor.id, targetId: target.id, from: { ...actor.position }, position: { ...target.position } });
    const total = skillCheck(state, actor, skill(actor, 'acrobatics'), events, `${actor.name} · passe`, precision || called);
    if (total < dc) {
      const line = trajectory(actor.position, target.position);
      state.ball = { carrierId: null, position: { ...line[Math.floor((line.length - 1) / 2)] } };
      emit(state, events, 'drop', 'Passe manquée : la balle tombe à mi-trajet.', { position: { ...state.ball.position } });
    } else {
      const interceptor = interceptionCandidates(state, actor, target.position)[0];
      let intercepted = false;
      if (interceptor) {
        interceptor.reaction = false;
        const reading = interceptor.archetype === 'passeur' && interceptor.classState.focus > 0 && !hasCheckHelp(state, interceptor) && total < 20 + skill(interceptor, 'acrobatics');
        if (reading) {
          interceptor.classState.focus--;
          classEvent(state, events, 'intercept-read', interceptor, `${interceptor.name} anticipe la trajectoire de la passe.`, { label: 'Anticipation' });
        }
        const result = skillCheck(state, interceptor, skill(interceptor, 'acrobatics'), events, `${interceptor.name} · interception contre ${total}`, reading);
        if (result > total) { giveBall(state, interceptor, events, 'intercepte'); intercepted = true; }
        else emit(state, events, 'failure', `${interceptor.name} manque l’interception et dépense sa réaction.`);
      }
      if (!intercepted) {
        if (target.reaction) {
          target.reaction = false;
          state.stats[actor.teamId].passesCompleted++;
          giveBall(state, target, events, 'reçoit', false);
        } else {
          state.ball = { carrierId: null, position: { ...target.position } };
          emit(state, events, 'drop', `${target.name} n’a plus de réaction : la balle tombe à ses pieds.`, { position: { ...target.position } });
        }
      }
    }
  }
  return true;
}

export function beginTurn(state, actor, events) {
  actor.action = true; actor.bonusAction = true; actor.interaction = true; actor.pickedUp = false;
  actor.chargeRun = null; actor.feintTargetId = null;
  state.calls = (state.calls ?? []).filter((c) => c.sourceId !== actor.id);
  actor.movement = actor.speed; actor.dodging = false; actor.disengaged = false;
  state.aids = state.aids.filter((a) => a.helperId !== actor.id);
  if (actor.prone && !actor.grappledBy) {
    actor.movement -= actor.speed / 2; actor.prone = false;
    emit(state, events, 'stand', `${actor.name} se relève (moitié du mouvement).`);
  }
}
export function assertInvariants(state) {
  const alive = active(state);
  if (!inside(state.ball.position) && !isCenterBall(state)) throw new Error('Balle hors terrain');
  if (new Set(alive.map((p) => `${p.position.x},${p.position.y}`)).size !== alive.length) throw new Error('Superposition de joueurs actifs');
  for (const p of state.players) {
    if (!inside(p.position) || p.hp < 0 || p.hp > p.maxHp || p.movement < 0) throw new Error(`État invalide : ${p.id}`);
    const r = p.classState;
    if (r) {
      for (const [key, maximum] of Object.entries(classCaps(p))) {
        if (!Number.isInteger(r[key]) || r[key] < 0 || r[key] > maximum) throw new Error(`Ressource invalide : ${p.id}/${key}`);
      }
      const locked = playerById(state, r.targetId);
      if ((r.flaw && !r.targetId) || (r.targetId && (!isRunner(p) || !locked || locked.hp <= 0 || locked.teamId === p.teamId))) throw new Error('Verrouillage invalide');
      if (p.archetype && !ARCHETYPES[p.archetype]) throw new Error('Archétype invalide');
    }
    if (p.grappledBy) {
      const holder = playerById(state, p.grappledBy);
      if (!holder || holder.hp <= 0 || holder.grappling !== p.id || distance(holder.position, p.position) > 1) throw new Error('Agrippement incohérent');
    }
    if (p.grappling) {
      const held = playerById(state, p.grappling);
      if (!held || p.hp <= 0 || held.hp <= 0 || held.grappledBy !== p.id || distance(held.position, p.position) > 1) throw new Error('Prise incohérente');
    }
  }
  const recipients = new Set();
  for (const c of state.calls ?? []) {
    const source = playerById(state, c.sourceId), target = playerById(state, c.targetId);
    if (!source || !target || source.hp <= 0 || target.hp <= 0 || source.archetype !== 'capitaine' || source.id === target.id || source.teamId !== target.teamId || recipients.has(target.id)) throw new Error('Appel de jeu invalide');
    recipients.add(target.id);
  }
  if (state.ball.carrierId) {
    const holder = carrier(state);
    if (!holder || holder.hp <= 0 || !sameCell(holder.position, state.ball.position)) throw new Error('Possession invalide');
  }
}
