import { COURT, WET_CELLS, modifier } from './data.mjs';

export const distance = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
export const sameCell = (a, b) => a.x === b.x && a.y === b.y;
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
export function check(state, bonus, events, label, { advantage = false, disadvantage = false } = {}) {
  const dice = [randomInt(state, 20) + 1];
  if (advantage !== disadvantage) dice.push(randomInt(state, 20) + 1);
  const natural = dice.length === 1 ? dice[0] : advantage ? Math.max(...dice) : Math.min(...dice);
  const total = natural + bonus;
  emit(state, events, 'roll', `${label} : ${dice.join(' / ')} ${bonus >= 0 ? '+' : '−'} ${Math.abs(bonus)} = ${total}`, { dice, natural, bonus, total });
  return { natural, total };
}
function aided(state, actor, enemyId, kind) {
  const index = state.aids.findIndex((a) => a.allyId === actor.id && a.kind === kind && (kind !== 'attack' || a.enemyId === enemyId));
  if (index < 0) return false;
  state.aids.splice(index, 1);
  return true;
}
function skillCheck(state, actor, bonus, events, label) {
  return check(state, bonus, events, label, { advantage: aided(state, actor, null, 'check') }).total;
}
export function movementCost(actor, destination) {
  return COURT.cell * (1 + Number(isWet(destination)) + Number(actor.prone));
}
export function canStep(state, actor, from, to) {
  if (!inside(to) || distance(from, to) !== 1 || occupied(state, to, actor.id)) return false;
  if (from.x !== to.x && from.y !== to.y) {
    if (occupied(state, { x: to.x, y: from.y }, actor.id) && occupied(state, { x: from.x, y: to.y }, actor.id)) return false;
  }
  return true;
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
      if (!canStep(state, actor, current.position, next)) continue;
      const cost = current.cost + movementCost(actor, next);
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
  for (let y = Math.min(from.y, to.y); y <= Math.max(from.y, to.y); y++) {
    for (let x = Math.min(from.x, to.x); x <= Math.max(from.x, to.x); x++) {
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
  emit(state, events, 'possession', `${actor.name} ${reason} la balle.`, { playerId: actor.id, teamId: actor.teamId });
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
  emit(state, events, 'drop', `${actor.name} lâche la balle.`, { position: { ...destination } });
}
export function dealDamage(state, actor, target, amount, events) {
  const damage = Math.max(0, amount);
  target.hp = Math.max(0, target.hp - damage);
  emit(state, events, 'damage', `${target.name} subit ${damage} dégâts (${target.hp}/${target.maxHp} PV).`, { playerId: target.id, amount: damage });
  if (target.hp === 0) {
    dropBall(state, target, events);
    releaseGrapples(state, target);
    target.reaction = false; target.action = false; target.prone = true; target.dodging = false;
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
export function performAttack(state, actor, target, events, opportunity = false) {
  if (actor.hp <= 0 || !target || target.hp <= 0 || actor.teamId === target.teamId || distance(actor.position, target.position) > 1 || !(opportunity ? actor.reaction : actor.action)) return false;
  if (opportunity) actor.reaction = false; else actor.action = false;
  emit(state, events, opportunity ? 'opportunity' : 'attack', `${actor.name} ${opportunity ? 'tente une attaque d’opportunité sur' : 'attaque'} ${target.name}.`, { playerId: actor.id, targetId: target.id });
  const helped = aided(state, actor, target.id, 'attack');
  const roll = check(state, actor.attack.bonus, events, `${actor.name} · attaque contre CA ${target.armor}`, {
    advantage: target.prone || helped,
    disadvantage: actor.prone || (target.dodging && !target.grappledBy),
  });
  if (roll.natural === 1 || (roll.natural !== 20 && roll.total < target.armor)) {
    emit(state, events, 'miss', `${actor.name} manque ${target.name}.`);
    return true;
  }
  const dice = Array.from({ length: roll.natural === 20 ? 2 : 1 }, () => randomInt(state, actor.attack.die) + 1);
  emit(state, events, 'roll', `${roll.natural === 20 ? 'Critique ! ' : ''}Dégâts : ${dice.join(' + ')} + ${actor.attack.flat}`, { dice, critical: roll.natural === 20 });
  dealDamage(state, actor, target, dice.reduce((a, b) => a + b, actor.attack.flat), events);
  return true;
}
export function shouldTakeOpportunity(state, actor, mover) {
  const holder = carrier(state);
  if (mover.id === holder?.id) return true;
  if (holder?.teamId === actor.teamId && (actor.role === 'relay' || actor.instruction === 'cautious')) return false;
  return true;
}
export function moveAlong(state, actor, path, events) {
  if (actor.hp <= 0 || actor.grappledBy) return;
  const start = { ...actor.position }, traversed = [];
  for (const next of path) {
    const cost = movementCost(actor, next);
    if (actor.hp <= 0 || actor.grappledBy || cost > actor.movement || !canStep(state, actor, actor.position, next)) break;
    if (!actor.disengaged) {
      const eligible = opponents(state, actor).filter((enemy) => enemy.reaction && distance(enemy.position, actor.position) <= 1 && distance(enemy.position, next) > 1)
        .sort((a, b) => state.initiative.indexOf(a.id) - state.initiative.indexOf(b.id));
      for (const enemy of eligible) {
        if (actor.hp <= 0) break;
        if (shouldTakeOpportunity(state, enemy, actor)) performAttack(state, enemy, actor, events, true);
      }
    }
    if (actor.hp <= 0) break;
    actor.movement -= cost;
    actor.position = { ...next };
    if (state.ball.carrierId === actor.id) state.ball.position = { ...next };
    if (actor.grappling) {
      const held = playerById(state, actor.grappling);
      if (!held || distance(actor.position, held.position) > 1) {
        if (held) held.grappledBy = null;
        actor.grappling = null;
      }
    }
    traversed.push({ ...next });
  }
  if (traversed.length) emit(state, events, 'move', `${actor.name} se déplace de ${traversed.length} case${traversed.length > 1 ? 's' : ''}.`, { playerId: actor.id, from: start, path: traversed, position: { ...actor.position } });
}

export function legalAction(state, actor, action) {
  if (!action || actor.hp <= 0) return false;
  if (action.type === 'wait') return true;
  if (action.type === 'drop') return state.ball.carrierId === actor.id;
  const target = playerById(state, action.targetId);
  const enemy = target && target.hp > 0 && target.teamId !== actor.teamId && distance(actor.position, target.position) <= 1;
  if (action.type === 'pickup') {
    if (state.ball.carrierId || actor.pickedUp || distance(actor.position, state.ball.position) > 1) return false;
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
  if (!legalAction(state, actor, action)) return false;
  const target = playerById(state, action.targetId);
  if (action.type === 'wait') { actor.action = false; emit(state, events, 'wait', `${actor.name} tient sa position.`); return true; }
  if (action.type === 'drop') { dropBall(state, actor, events); return true; }
  if (action.type === 'attack') return performAttack(state, actor, target, events);
  if (action.type === 'pickup') {
    actor.pickedUp = true;
    const defender = ballDefender(state, actor);
    if (!defender) { actor.interaction = false; giveBall(state, actor, events); }
    else {
      actor.action = false;
      const attempt = skillCheck(state, actor, Math.max(skill(actor, 'wrestling'), skill(actor, 'acrobatics')), events, `${actor.name} · ramassage contesté`);
      const defense = skillCheck(state, defender, Math.max(skill(defender, 'wrestling'), skill(defender, 'acrobatics')), events, `${defender.name} · opposition au ramassage`);
      if (attempt > defense) giveBall(state, actor, events);
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
    const defenseBonus = action.type === 'strip' ? Math.max(skill(target, 'wrestling'), skill(target, 'acrobatics')) : Math.max(skill(target, 'athletics'), skill(target, 'acrobatics'));
    const attack = skillCheck(state, actor, skill(actor, 'wrestling'), events, `${actor.name} · ${action.type === 'strip' ? 'arrachement' : action.type === 'grapple' ? 'agrippement' : 'plaquage'}`);
    const defense = skillCheck(state, target, defenseBonus, events, `${target.name} · défense`);
    if (attack <= defense) emit(state, events, 'failure', `${target.name} résiste à ${actor.name}${attack === defense ? ' (égalité au défenseur)' : ''}.`);
    else if (action.type === 'strip') giveBall(state, actor, events, 'arrache');
    else if (action.type === 'grapple') {
      actor.grappling = target.id; target.grappledBy = actor.id;
      emit(state, events, 'grapple', `${actor.name} agrippe ${target.name} : vitesse nulle.`);
    } else if (action.mode === 'push') {
      const valid = neighbors(target.position).filter((p) => !occupied(state, p) && distance(p, actor.position) > distance(target.position, actor.position));
      valid.sort((a, b) => distance(b, actor.position) - distance(a, actor.position) || a.y - b.y || a.x - b.x);
      if (valid[0]) {
        const from = { ...target.position }; target.position = { ...valid[0] };
        if (state.ball.carrierId === target.id) state.ball.position = { ...target.position };
        for (const p of [target, playerById(state, target.grappledBy), playerById(state, target.grappling)].filter(Boolean)) {
          if (p.grappling && distance(p.position, playerById(state, p.grappling).position) > 1) {
            playerById(state, p.grappling).grappledBy = null; p.grappling = null;
          }
        }
        emit(state, events, 'push', `${actor.name} repousse ${target.name} d’une case.`, { playerId: target.id, from, position: { ...target.position } });
      } else emit(state, events, 'hold', `${target.name} est bloqué par la paroi ou les autres joueurs.`);
    } else { target.prone = true; emit(state, events, 'prone', `${actor.name} plaque ${target.name} à terre ; la balle reste tenue.`); }
  }
  if (action.type === 'pass') {
    state.stats[actor.teamId].passesAttempted++;
    const dc = actor.grappledBy || opponents(state, actor).some((p) => distance(actor.position, p.position) <= 1) ? 15 : 10;
    emit(state, events, 'pass', `${actor.name} passe à ${target.name} (DD ${dc}).`, { playerId: actor.id, targetId: target.id, from: { ...actor.position }, position: { ...target.position } });
    const total = skillCheck(state, actor, skill(actor, 'acrobatics'), events, `${actor.name} · passe`);
    if (total < dc) {
      const line = trajectory(actor.position, target.position);
      state.ball = { carrierId: null, position: { ...line[Math.floor((line.length - 1) / 2)] } };
      emit(state, events, 'drop', 'Passe manquée : la balle tombe à mi-trajet.', { position: { ...state.ball.position } });
    } else {
      const interceptor = interceptionCandidates(state, actor, target.position)[0];
      let intercepted = false;
      if (interceptor) {
        interceptor.reaction = false;
        const result = skillCheck(state, interceptor, skill(interceptor, 'acrobatics'), events, `${interceptor.name} · interception contre ${total}`);
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
  actor.action = true; actor.interaction = true; actor.pickedUp = false;
  actor.movement = actor.speed; actor.dodging = false; actor.disengaged = false;
  state.aids = state.aids.filter((a) => a.helperId !== actor.id);
  if (actor.prone && !actor.grappledBy) {
    actor.movement -= actor.speed / 2; actor.prone = false;
    emit(state, events, 'stand', `${actor.name} se relève (moitié du mouvement).`);
  }
}
export function assertInvariants(state) {
  const alive = active(state);
  if (!inside(state.ball.position)) throw new Error('Balle hors terrain');
  if (new Set(alive.map((p) => `${p.position.x},${p.position.y}`)).size !== alive.length) throw new Error('Superposition de joueurs actifs');
  for (const p of state.players) {
    if (!inside(p.position) || p.hp < 0 || p.hp > p.maxHp || p.movement < 0) throw new Error(`État invalide : ${p.id}`);
    if (p.grappledBy) {
      const holder = playerById(state, p.grappledBy);
      if (!holder || holder.hp <= 0 || holder.grappling !== p.id || distance(holder.position, p.position) > 1) throw new Error('Agrippement incohérent');
    }
    if (p.grappling) {
      const held = playerById(state, p.grappling);
      if (!held || p.hp <= 0 || held.hp <= 0 || held.grappledBy !== p.id || distance(held.position, p.position) > 1) throw new Error('Prise incohérente');
    }
  }
  if (state.ball.carrierId) {
    const holder = carrier(state);
    if (!holder || holder.hp <= 0 || !sameCell(holder.position, state.ball.position)) throw new Error('Possession invalide');
  }
}
