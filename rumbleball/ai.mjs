import {
  active, allies, armorAgainst, carrier, chargeRun, collectiveOpening, distance, hasCheckHelp, hasPassCall, interceptionCandidates, legalAction, legalClassAction,
  movementView, opponents, playerById, provokesOpportunity, reachableCells, shouldTakeOpportunity, skill,
} from './rules.mjs';
import { isRunner } from './classes.mjs';

const nearestDistance = (players, cell) => Math.min(12, ...players.map((p) => distance(p.position, cell)));
const order = (a, b) => a.id.localeCompare(b.id);
const turnsUntil = (state, id) => {
  const gap = state.initiative.indexOf(id) - state.turnIndex;
  return gap > 0 ? gap : gap + state.initiative.length;
};
export const strategyOf = (state, actor) => state.teams.find((t) => t.id === actor.teamId).strategy;

// Small shared plan, recalculated from public state. No simulated future dice or opponent intent.
export function teamPlan(state, actor) {
  const team = active(state).filter((p) => p.teamId === actor.teamId);
  const holder = carrier(state);
  const ball = holder?.position ?? state.ball.position;
  const ranked = (players, role, point) => [...players].sort((a, b) =>
    (distance(a.position, point) / (a.speed / 1.5) - Number(a.role === role) * .4)
    - (distance(b.position, point) / (b.speed / 1.5) - Number(b.role === role) * .4) || order(a, b));
  if (!holder) {
    return { mode: 'free', primary: ranked(team, 'retriever', ball)[0]?.id, target: ball };
  }
  if (holder.teamId === actor.teamId) {
    const rest = team.filter((p) => p.id !== holder.id);
    const protector = ranked(rest, 'blocker', ball)[0];
    const relay = ranked(rest.filter((p) => p.id !== protector?.id && p.reaction), 'relay', ball)[0];
    const outlet = strategyOf(state, actor) === 'possession'
      ? rest.filter((p) => p.id !== protector?.id && p.id !== relay?.id && p.reaction && p.archetype === 'passeur' && p.role !== 'blocker').sort(order)[0] : null;
    return { mode: 'own', holder, protector: protector?.id, relay: relay?.id, outlet: outlet?.id };
  }
  const primary = ranked(team, 'retriever', ball)[0];
  const marks = new Map();
  if (primary) marks.set(primary.id, holder.id);
  const targets = opponents(state, actor).filter((p) => p.id !== holder.id).sort((a, b) => distance(a.position, ball) - distance(b.position, ball) || order(a, b));
  for (const p of team.filter((p) => p.id !== primary?.id).sort((a, b) => Number(b.role === 'defender') - Number(a.role === 'defender') || order(a, b))) {
    targets.sort((a, b) => distance(p.position, a.position) - distance(p.position, b.position) || order(a, b));
    marks.set(p.id, targets.shift()?.id ?? holder.id);
  }
  return { mode: 'enemy', holder, primary: primary?.id, marks };
}

export function safety(state, actor, cell) {
  const enemies = opponents(state, actor);
  return nearestDistance(enemies, cell) * 5
    - enemies.filter((p) => distance(p.position, cell) <= 1).length * 18
    - enemies.filter((p) => distance(p.position, cell) === 2).length * 5
    + allies(state, actor).filter((p) => distance(p.position, cell) <= 2).length * 3;
}
function possessionSafety(state, actor, cell) {
  const horizon = Math.min(turnsUntil(state, actor.id), state.round >= 10 ? state.initiative.length - state.turnIndex : Infinity);
  // A receiver who acts before the pursuers can carry on the relay. A holder
  // whose turn just ended must survive the whole initiative cycle instead.
  const pursuers = opponents(state, actor).filter((p) => turnsUntil(state, p.id) < horizon
    && distance(p.position, cell) > 1 && distance(p.position, cell) <= Math.floor(p.speed / 1.5) + 1).length;
  return safety(state, actor, cell) + Math.min(8, Math.max(skill(actor, 'wrestling'), skill(actor, 'acrobatics'))) * 2
    - Number(Boolean(actor.grappledBy)) * 18 - Number(actor.prone) * 10 - (1 - actor.hp / actor.maxHp) * 10 - pursuers * 8;
}
const carryWeight = (state, actor) => strategyOf(state, actor) === 'possession' || actor.instruction === 'cautious' ? 1.6 : 1.2;
const keepBonus = (state, actor) => 48 + Number(strategyOf(state, actor) === 'possession') * 12 + Number(actor.instruction === 'cautious') * 12;

// Public dice distributions only: one pass check and the one eligible interceptor.
// No RNG is consumed and neither the seed nor future bot decisions are inspected.
export function passCompletionChance(state, actor, receiver, precision = false) {
  if (!receiver?.reaction || !legalAction(state, actor, { type: 'pass', targetId: receiver.id, ...(precision ? { technique: 'precision' } : {}) })) return 0;
  const dc = actor.grappledBy || opponents(state, actor).some((p) => distance(actor.position, p.position) <= 1) ? 15 : 10;
  const advantage = precision || hasCheckHelp(state, actor) || hasPassCall(state, actor);
  const interceptor = interceptionCandidates(state, actor, receiver.position)[0];
  const interceptAdvantage = interceptor && (hasCheckHelp(state, interceptor) || interceptor.archetype === 'passeur' && interceptor.classState.focus > 0);
  let chance = 0;
  for (let die = 1; die <= 20; die++) {
    const total = die + skill(actor, 'acrobatics');
    if (total < dc) continue;
    const tiedOrLower = interceptor ? Math.max(0, Math.min(1, (total - skill(interceptor, 'acrobatics')) / 20)) : 1;
    chance += (advantage ? (2 * die - 1) / 400 : 1 / 20) * (interceptAdvantage ? tiedOrLower ** 2 : tiedOrLower);
  }
  return chance;
}
function passScore(state, actor, receiver, precision = false) {
  const source = possessionSafety(state, actor, actor.position), destination = possessionSafety(state, receiver, receiver.position);
  const improvement = destination - source;
  const preferCarrier = receiver.role === 'carrier' && actor.role !== 'carrier';
  // Circulate to escape pressure or improve the holder, never just to count passes.
  if (improvement <= 6 && !(preferCarrier && improvement >= 0)) return null;
  const chance = passCompletionChance(state, actor, receiver, precision);
  if (chance < .45) return null;
  const weight = carryWeight(state, actor), loss = 65 + Number(state.round >= 9) * 65;
  const pressureRelief = Math.max(0, opponents(state, actor).filter((p) => distance(p.position, actor.position) <= 1).length
    - opponents(state, receiver).filter((p) => distance(p.position, receiver.position) <= 1).length) * 20;
  const receiverNext = state.initiative.indexOf(receiver.id) > state.turnIndex;
  const relayTempo = receiverNext ? Math.min(24, receiver.speed * (strategyOf(state, actor) === 'possession' ? 2 : 1)) : 0;
  // Replace the thrower's positional value with expected possession at the receiver.
  return chance * (destination * weight + keepBonus(state, actor) + Number(preferCarrier) * 15 + pressureRelief + relayTempo)
    - (1 - chance) * loss - source * weight;
}
function possessionUntilNextTurn(state, holder) {
  let retained = 1;
  const defense = Math.max(skill(holder, 'wrestling'), skill(holder, 'acrobatics'));
  for (const enemy of opponents(state, holder)) {
    if (distance(enemy.position, holder.position) > 1 || turnsUntil(state, enemy.id) >= turnsUntil(state, holder.id)) continue;
    let steal = 0;
    for (let die = 1; die <= 20; die++) steal += Math.max(0, Math.min(1, (die + skill(enemy, 'wrestling') - defense - 1) / 20)) / 20;
    retained *= 1 - steal;
  }
  return retained;
}
function taskFor(state, actor, plan) {
  if (state.ball.carrierId === actor.id) return 'carry';
  if (plan.mode === 'free') return actor.id === plan.primary ? 'recover' : 'screen';
  if (plan.mode === 'own') return actor.id === plan.protector ? 'protect' : actor.id === plan.relay || actor.id === plan.outlet ? 'relay' : 'screen';
  return actor.id === plan.primary || strategyOf(state, actor) === 'pressing' && actor.role === 'retriever' ? 'recover' : 'mark';
}
function positionalScore(state, actor, cell, plan, task) {
  const ball = carrier(state)?.position ?? state.ball.position;
  if (task === 'carry') {
    return possessionSafety(state, actor, cell) * carryWeight(state, actor);
  }
  if (task === 'recover') return 55 - distance(cell, ball) * 11;
  if (task === 'relay') {
    const gap = distance(cell, ball);
    const blockedLane = plan.holder && interceptionCandidates(state, plan.holder, cell).length > 0;
    return 26 - Math.abs(gap - 3) * 8 + safety(state, actor, cell) * .55 - Number(gap > 6) * 40 - Number(blockedLane) * 18;
  }
  if (task === 'protect') {
    const threat = opponents(state, actor).sort((a, b) => distance(a.position, ball) - distance(b.position, ball) || order(a, b))[0];
    return 32 - Math.max(0, distance(cell, ball) - 1) * 13 - (threat ? Math.max(0, distance(cell, threat.position) - 1) * 5 : 0);
  }
  const marked = plan.marks?.get(actor.id);
  const enemy = marked ? playerById(state, marked) : opponents(state, actor).sort((a, b) => distance(a.position, ball) - distance(b.position, ball) || order(a, b))[0];
  return 25 - (enemy ? Math.max(0, distance(cell, enemy.position) - 1) * 7 : 0) - Math.max(0, distance(cell, ball) - 3) * 4;
}
function exposure(state, actor, path, disengaged = false) {
  if (disengaged || actor.disengaged) return 0;
  let last = actor.position;
  const provoked = new Set();
  for (const next of path) {
    opponents(state, actor).forEach((p) => {
      if (actor.archetype === 'escamoteur' && actor.classState.flaw === 1 && actor.classState.targetId === p.id) return;
      if (provokesOpportunity(p, actor, last, next) && shouldTakeOpportunity(state, p, actor)) provoked.add(p.id);
    });
    last = next;
  }
  return provoked.size * (state.ball.carrierId === actor.id ? 32 : actor.instruction === 'cautious' ? 22 : 13);
}
function evaluateCells(state, actor, plan, task, budget, disengaged = false) {
  return reachableCells(state, actor, budget).map((entry) => {
    const view = movementView(state, actor, entry.position);
    return { ...entry, score: positionalScore(view.state, view.actor, entry.position, plan, task)
      - exposure(state, actor, entry.path, disengaged) - entry.cost * .12 };
  }).sort((a, b) => b.score - a.score || a.cost - b.cost || a.position.y - b.position.y || a.position.x - b.position.x);
}
function explain(actor, task, type, target) {
  const intentions = {
    pickup: 'Tente de contrôler la balle libre', strip: 'Cherche directement l’arrachement',
    attack: target ? `Contient ${target.name} par une frappe` : 'Met la pression au contact',
    grapple: 'Immobilise une menace', shove: 'Déséquilibre une menace', pass: 'Cherche un relais mieux protégé',
    help: 'Crée une ouverture pour un équipier', escape: 'Cherche à retrouver sa mobilité',
    dodge: task === 'carry' ? 'Protège la possession en esquivant' : 'Tient sa position en esquivant',
    disengage: 'Préserve sa mobilité sans subir de frappe gratuite', dash: 'Accélère pour remplir son rôle', wait: 'Garde sa position',
  };
  return `${intentions[type] ?? 'Se replace'} · ${actor.instruction === 'cautious' ? 'prudent' : actor.instruction === 'aggressive' ? 'agressif' : 'normal'}.`;
}

export function decideTurn(state, actor) {
  const plan = teamPlan(state, actor), task = taskFor(state, actor, plan);
  const strategy = strategyOf(state, actor);
  const aggression = Number(actor.instruction === 'aggressive') * 18 + Number(strategy === 'pressing') * 8 - Number(actor.instruction === 'cautious') * 12;
  const cells = evaluateCells(state, actor, plan, task, actor.movement);
  const candidates = [];
  const add = (entry, action, score) => {
    const view = movementView(state, actor, entry.position);
    view.actor = { ...view.actor, chargeRun: chargeRun(actor, entry.path) };
    if (!legalAction(view.state, view.actor, action)) return;
    const target = playerById(view.state, action.targetId);
    if (action.type === 'pass') {
      const spent = new Set(); let from = actor.position;
      for (const to of entry.path) {
        for (const enemy of opponents(state, actor)) {
          const feinted = actor.archetype === 'escamoteur' && actor.classState.flaw && actor.classState.targetId === enemy.id;
          if (!feinted && provokesOpportunity(enemy, actor, from, to) && shouldTakeOpportunity(state, enemy, actor)) spent.add(enemy.id);
        }
        from = to;
      }
      // Conditional on reaching the throw, those reactions have already been spent.
      // The existing exposure score still charges for the danger of that route.
      view.state = { ...view.state, players: view.state.players.map((p) => p.id === actor.id ? view.actor : spent.has(p.id) ? { ...p, reaction: false } : p),
        ball: { ...view.state.ball, position: { ...view.actor.position } } };
      const normal = passScore(view.state, view.actor, target);
      if (normal !== null) candidates.push({ path: entry.path, action, score: entry.score + normal, task });
      const difficult = view.actor.grappledBy || opponents(view.state, view.actor).some((p) => distance(p.position, entry.position) <= 1)
        || interceptionCandidates(view.state, view.actor, target.position).length > 0;
      const enhanced = { ...action, technique: 'precision' };
      if ((difficult || state.round >= 8) && !hasCheckHelp(state, actor) && !hasPassCall(state, actor) && legalAction(view.state, view.actor, enhanced)) {
        const adjusted = passScore(view.state, view.actor, target, true);
        if (adjusted !== null) candidates.push({ path: entry.path, action: enhanced, score: entry.score + adjusted, task });
      }
      return;
    }
    const opening = target && ['strip', 'grapple', 'shove'].includes(action.type) && collectiveOpening(view.state, view.actor, target);
    candidates.push({ path: entry.path, action, score: entry.score + score + (opening ? 7 : 0), task });
    let technique, gain = 0;
    if (action.type === 'strip' && !hasCheckHelp(state, actor)) { technique = 'exploitation'; gain = 9; }
    if (action.type === 'attack' && !actor.grappling && !target.grappledBy) { technique = 'percussion'; gain = 5; }
    const enhanced = { ...action, technique };
    if (technique && legalAction(view.state, view.actor, enhanced)) candidates.push({ path: entry.path, action: enhanced, score: entry.score + score + gain, task });
  };
  const holder = carrier(state);
  for (const cell of cells) {
    const { actor: actorHere, state: here } = movementView(state, actor, cell.position);
    const adjacent = opponents(here, actorHere).filter((p) => distance(p.position, cell.position) <= 1);
    if (!holder && distance(cell.position, state.ball.position) <= 1) add(cell, { type: 'pickup' }, 150 + Math.max(skill(actor, 'acrobatics'), skill(actor, 'wrestling')) * 2);
    if (actor.grappledBy) add(cell, { type: 'escape' }, state.ball.carrierId === actor.id ? 55 : 70);
    for (const enemy of adjacent) {
      const danger = holder?.teamId === actor.teamId && holder.id !== actor.id && distance(enemy.position, holder.position) <= 2;
      add(cell, { type: 'strip', targetId: enemy.id }, 106 + skill(actor, 'wrestling') * 3 + Number(actor.role === 'retriever') * 16 + aggression * .3);
      const hitChance = Math.max(.05, Math.min(.95, (21 + actor.attack.bonus - armorAgainst(enemy, actor)) / 20));
      const ko = enemy.hp <= actor.attack.die / 2 + .5 + actor.attack.flat;
      add(cell, { type: 'attack', targetId: enemy.id }, 18 + hitChance * 18 + Number(enemy.id === holder?.id) * 28 + Number(danger) * 18 + Number(ko) * 20 + aggression);
      add(cell, { type: 'grapple', targetId: enemy.id }, 20 + Number(danger) * 38 + Number(actor.role === 'blocker') * 15 + Number(enemy.id === holder?.id) * 8 + aggression * .2);
      add(cell, { type: 'shove', targetId: enemy.id }, 17 + Number(danger) * 15 + Number(actor.role === 'blocker') * 8 + aggression * .3);
    }
    if (holder?.id === actor.id) {
      for (const ally of allies(here, actorHere)) {
        if (!ally.reaction || distance(cell.position, ally.position) > 6) continue;
        add(cell, { type: 'pass', targetId: ally.id }, 0);
      }
    }
    for (const ally of allies(here, actorHere)) {
      if (distance(cell.position, ally.position) > 1) continue;
      const hasHelp = state.aids.some((a) => a.allyId === ally.id && a.kind === 'check');
      if (!hasHelp) add(cell, { type: 'help', targetId: ally.id }, ally.id === holder?.id ? 30 + Number(strategy === 'possession') * 12 : 12);
      const foe = opponents(here, actorHere).find((p) => distance(p.position, cell.position) <= 1 && distance(p.position, ally.position) <= 1);
      if (foe && !state.aids.some((a) => a.allyId === ally.id && a.enemyId === foe.id)) add(cell, { type: 'help', targetId: ally.id, enemyId: foe.id }, 24 + Number(actor.role === 'relay') * 8);
    }
    add(cell, { type: 'dodge' }, holder?.id === actor.id ? actor.grappledBy ? 0 : keepBonus(state, actor) : 5);
    if (adjacent.length && !actor.grappledBy && !actor.grappling) {
      const freed = evaluateCells(here, actorHere, plan, task, Math.max(0, actor.movement - cell.cost), true)[0];
      const gain = freed ? freed.score - positionalScore(state, actor, cell.position, plan, task) : 0;
      add(cell, { type: 'disengage' }, 8 + Math.max(0, gain) + Number(holder?.id === actor.id) * 20);
    }
  }
  if (!actor.grappledBy && !actor.grappling) {
    const far = evaluateCells(state, actor, plan, task, actor.movement + actor.speed)[0];
    if (far && cells[0] && far.score > cells[0].score + 8) {
      candidates.push({ path: [], action: { type: 'dash' }, score: far.score + 9, task });
    }
  }
  candidates.sort((a, b) => b.score - a.score || a.path.length - b.path.length || a.action.type.localeCompare(b.action.type) || (a.action.targetId ?? '').localeCompare(b.action.targetId ?? ''));
  const chosen = candidates[0] ?? { path: [], action: { type: 'wait' }, score: 0, task };
  return { ...chosen, reason: explain(actor, task, chosen.action.type, playerById(state, chosen.action.targetId)) };
}

// One bounded bonus choice at each execution boundary, using public state only.
export function decideClassAction(state, actor, path = []) {
  if (actor.hp <= 0 || !actor.classState) return null;
  const r = actor.classState, target = playerById(state, r.targetId);
  if (actor.archetype === 'escamoteur' && target && r.flaw) {
    let from = actor.position;
    for (const to of path) {
      if (provokesOpportunity(target, actor, from, to) && shouldTakeOpportunity(state, target, actor)) {
        const feint = { type: 'feint', targetId: target.id };
        if (legalClassAction(state, actor, feint)) return feint;
      }
      from = to;
    }
  }
  if (!actor.bonusAction || !isRunner(actor)) return null;
  const holder = carrier(state);
  if (actor.archetype === 'capitaine' && holder?.teamId === actor.teamId && holder.id !== actor.id
    && !hasCheckHelp(state, holder)) {
    const call = { type: 'call', targetId: holder.id };
    const holderIndex = state.initiative.indexOf(holder.id), nextRound = holderIndex <= state.turnIndex;
    if ((!nextRound || state.round < 10) && legalClassAction(state, actor, call) && possessionUntilNextTurn(state, holder) >= .6) {
      const preview = { ...state, turnIndex: holderIndex, round: state.round + Number(nextRound),
        players: nextRound ? state.players.map((p) => ({ ...p, reaction: p.hp > 0 })) : state.players,
        calls: [...state.calls, { sourceId: actor.id, targetId: holder.id }] };
      const nextHolder = { ...holder, action: true, interaction: true, pickedUp: false, dodging: false, disengaged: false,
        movement: holder.grappledBy ? 0 : holder.speed * (holder.prone ? .5 : 1) };
      if (decideTurn(preview, nextHolder).action.type === 'pass') return call;
    }
  }
  const enemies = opponents(state, actor).filter((p) => distance(p.position, actor.position) <= 6)
    .sort((a, b) => Number(b.id === holder?.id) - Number(a.id === holder?.id)
      || distance(a.position, holder?.position ?? actor.position) - distance(b.position, holder?.position ?? actor.position) || order(a, b));
  const preferred = enemies[0];
  if (target?.hp > 0 && distance(target.position, actor.position) <= 6
    && (r.flaw || target.id === preferred?.id)) return null;
  const lock = { type: 'lock', targetId: preferred?.id };
  return legalClassAction(state, actor, lock) ? lock : null;
}

export function decideMovement(state, actor) {
  // Maintaining a hold already achieves a control objective. Spare movement is optional;
  // repositioning with a held target must be part of the next turn's deliberate plan.
  if (actor.hp <= 0 || actor.grappledBy || actor.grappling || actor.movement < 1.5) return [];
  const plan = teamPlan(state, actor), task = taskFor(state, actor, plan);
  const cells = evaluateCells(state, actor, plan, task, actor.movement);
  const current = positionalScore(state, actor, actor.position, plan, task);
  return cells[0]?.score > current + 1 ? cells[0].path : [];
}
