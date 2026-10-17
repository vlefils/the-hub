import {
  active, allies, armorAgainst, canReceivePass, carrier, chargeRun, collectiveOpening, distance, hasCheckHelp, hasPassCall, interceptionCandidates, legalAction, legalClassAction,
  inside, movementView, openPassReceiver, opponents, playerById, provokesOpportunity, reachableCells, readiedPasser, shouldTakeOpportunity, skill, trajectory,
} from './rules.mjs';
import { isRunner } from './classes.mjs';
import { OPENINGS, openingPlan } from './openings.mjs';
import { isCenterBall } from './deployment.mjs';

const nearestDistance = (players, cell) => Math.min(12, ...players.map((p) => distance(p.position, cell)));
const order = (a, b) => a.id.localeCompare(b.id);
const turnsUntil = (state, id) => {
  const gap = state.initiative.indexOf(id) - state.turnIndex;
  return gap > 0 ? gap : gap + state.initiative.length;
};
export const strategyOf = (state, actor) => state.teams.find((t) => t.id === actor.teamId).strategy;
export const matchPriority = (state) => state.version >= 5 ? state.round <= 6 ? 'combat' : 'ball' : null;
const combatActionBonus = { attack: 60, grapple: 20, shove: 20, strip: -80 };

function supportFormation(state, holder, players, protector) {
  const strategy = strategyOf(state, holder);
  const defensive = strategy === 'possession' || players.filter((p) => p.instruction === 'cautious' || p.role === 'defender').length >= 3;
  const priority = (p) => Number(p.role === 'relay') * 5 + Number(p.role === 'carrier') * 4
    + Number(p.archetype === 'passeur') * 3 + Number(p.instruction === 'cautious') * 2 - Number(p.role === 'blocker') * 2;
  // Keep the assignments when a reception spends a reaction. The player still
  // needs to get free for the next round, rather than being sent back to melee.
  const receivers = players.filter((p) => p.id !== protector && !p.grappledBy && !p.grappling)
    .sort((a, b) => priority(b) - priority(a) || order(a, b)).slice(0, defensive ? 3 : strategy === 'pressing' ? 1 : 2);
  const points = [3, 4].flatMap((gap) => [[0, -gap], [0, gap], [-gap, 0], [gap, 0], [-gap, -gap], [-gap, gap], [gap, -gap], [gap, gap]])
    .map(([x, y]) => ({ x: holder.position.x + x, y: holder.position.y + y })).filter(inside)
    .map((position) => ({ position, blocked: interceptionCandidates(state, holder, position).length > 0 }));
  const supports = new Map();
  for (const receiver of receivers) {
    const score = ({ position: point, blocked }) => safety(state, receiver, point) * .35 - distance(receiver.position, point) * .8
      - Number(blocked) * 16
      + Math.min(4, nearestDistance([...supports.values()].map((position) => ({ position })), point)) * 6;
    const target = points.map((point) => ({ position: point.position, score: score(point) }))
      .sort((a, b) => b.score - a.score || a.position.y - b.position.y || a.position.x - b.position.x)[0]?.position;
    if (target) supports.set(receiver.id, target);
  }
  return supports;
}

// Small shared plan, recalculated from public state. No simulated future dice or opponent intent.
export function teamPlan(state, actor) {
  const team = active(state).filter((p) => p.teamId === actor.teamId);
  const holder = carrier(state);
  const ball = holder?.position ?? state.ball.position;
  const opening = openingPlan(state, actor);
  const marks = new Map();
  if (opening) {
    const threats = [...opponents(state, actor)].sort((a, b) => distance(a.position, ball) - distance(b.position, ball) || order(a, b));
    for (const p of team.filter((p) => p.id !== holder?.id && !opening.receivers.includes(p.id)).sort((a, b) => Number(b.role === 'blocker') - Number(a.role === 'blocker') || order(a, b))) {
      threats.sort((a, b) => distance(p.position, a.position) - distance(p.position, b.position) || order(a, b));
      const target = threats.shift(); if (target) marks.set(p.id, target.id);
    }
  }
  const ranked = (players, role, point) => [...players].sort((a, b) =>
    (distance(a.position, point) / (a.speed / 1.5) - Number(a.role === role) * .4)
    - (distance(b.position, point) / (b.speed / 1.5) - Number(b.role === role) * .4) || order(a, b));
  if (!holder) {
    return { mode: 'free', primary: ranked(team, 'retriever', ball)[0]?.id, target: ball, opening, marks };
  }
  if (holder.teamId === actor.teamId) {
    const rest = team.filter((p) => p.id !== holder.id);
    // With only two players left, a prepared pass needs the sole teammate as
    // its receiver. Before preparation that player still protects the holder.
    const protector = state.version >= 5 ? (rest.length === 1 && readiedPasser(state) ? [] : [...rest]).sort((a, b) => Number(b.role === 'blocker') - Number(a.role === 'blocker')
      || Number(a.role === 'relay' || a.archetype === 'passeur') - Number(b.role === 'relay' || b.archetype === 'passeur') || order(a, b))[0]
      : ranked(rest, 'blocker', ball)[0];
    const relay = ranked(rest.filter((p) => p.id !== protector?.id && p.reaction), 'relay', ball)[0];
    const outlet = strategyOf(state, actor) === 'possession'
      ? rest.filter((p) => p.id !== protector?.id && p.id !== relay?.id && p.reaction && p.archetype === 'passeur' && p.role !== 'blocker').sort(order)[0] : null;
    const passer = readiedPasser(state);
    const spread = state.version >= 5 ? Boolean(passer) : state.version >= 4 && !opening;
    const supports = spread ? supportFormation(state, holder, rest, protector?.id) : new Map();
    const waiting = new Map(rest.map((p) => [p.id, { ...p.position }]));
    return { mode: 'own', holder, passer, protector: protector?.id, relay: relay?.id, outlet: outlet?.id, supports, waiting, opening, marks };
  }
  const primary = ranked(team, 'retriever', ball)[0];
  marks.clear();
  if (primary) marks.set(primary.id, holder.id);
  const targets = opponents(state, actor).filter((p) => p.id !== holder.id).sort((a, b) => distance(a.position, ball) - distance(b.position, ball) || order(a, b));
  for (const p of team.filter((p) => p.id !== primary?.id).sort((a, b) => Number(b.role === 'defender') - Number(a.role === 'defender') || order(a, b))) {
    targets.sort((a, b) => distance(p.position, a.position) - distance(p.position, b.position) || order(a, b));
    marks.set(p.id, targets.shift()?.id ?? holder.id);
  }
  const guard = ranked(team.filter((p) => p.id !== primary?.id && p.role === 'blocker'), 'blocker', ball)[0];
  const coverLines = state.version >= 4 ? new Map([...marks].map(([id, target]) => [id, trajectory(ball, playerById(state, target).position)])) : new Map();
  return { mode: 'enemy', holder, primary: primary?.id, guard: guard?.id, marks, coverLines, opening };
}

export function safety(state, actor, cell) {
  const enemies = opponents(state, actor);
  return nearestDistance(enemies, cell) * 5
    - enemies.filter((p) => distance(p.position, cell) <= 1).length * 18
    - enemies.filter((p) => distance(p.position, cell) === 2).length * 5
    + allies(state, actor).filter((p) => distance(p.position, cell) <= 2).length * 3;
}
function approachingOpponents(state, actor, cell) {
  const horizon = Math.min(turnsUntil(state, actor.id), state.round >= 10 ? state.initiative.length - state.turnIndex : Infinity);
  // A receiver who acts before the pursuers can carry on the relay. A holder
  // whose turn just ended must survive the whole initiative cycle instead.
  return opponents(state, actor).filter((p) => (state.version < 4 || !p.grappledBy) && turnsUntil(state, p.id) < horizon
    && distance(p.position, cell) > 1 && distance(p.position, cell) <= Math.floor(p.speed / 1.5) + 1).length;
}
function possessionSafety(state, actor, cell) {
  const pursuers = approachingOpponents(state, actor, cell);
  return safety(state, actor, cell) + Math.min(8, Math.max(skill(actor, 'wrestling'), skill(actor, 'acrobatics'))) * 2
    - Number(Boolean(actor.grappledBy)) * 18 - Number(actor.prone) * 10 - (1 - actor.hp / actor.maxHp) * 10 - pursuers * (state.version >= 4 ? 16 : 8);
}
const carryWeight = (state, actor) => strategyOf(state, actor) === 'possession' || actor.instruction === 'cautious' ? 1.6 : 1.2;
const keepBonus = (state, actor) => 48 + Number(strategyOf(state, actor) === 'possession') * 12 + Number(actor.instruction === 'cautious') * 12;

// Public dice distributions only: one pass check and the one eligible interceptor.
// No RNG is consumed and neither the seed nor future bot decisions are inspected.
export function passCompletionChance(state, actor, receiver, precision = false) {
  if (!canReceivePass(state, receiver) || !legalAction(state, actor, { type: 'pass', targetId: receiver.id, ...(precision ? { technique: 'precision' } : {}) })) return 0;
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
function receiverRunValue(state, receiver) {
  if (state.version < 4 || receiver.grappledBy || receiver.prone || state.initiative.indexOf(receiver.id) <= state.turnIndex
    || opponents(state, receiver).some((p) => distance(p.position, receiver.position) <= 1)
    || approachingOpponents(state, receiver, receiver.position)) return 0;
  const current = possessionSafety(state, receiver, receiver.position);
  const best = Math.max(current, ...reachableCells(state, receiver, receiver.speed).map((entry) =>
    possessionSafety(state, receiver, entry.position) - exposure(state, receiver, entry.path)));
  // The receiver has a turn before the pursuers: value the space they can
  // actually reach after receiving, with a bounded, discounted local preview.
  return Math.min(30, (best - current) * .6);
}
function passScore(state, actor, receiver, precision = false, opening = null, runValue = 0) {
  // A direct pass is useful as soon as an ally is free, including a short pass.
  // Otherwise carry, get clear, or prepare a pass and wait for an actual outlet.
  const marked = opponents(state, receiver).some((p) => distance(p.position, receiver.position) <= 1);
  if (state.version >= 5 && (receiver.grappledBy || receiver.prone || marked)) return null;
  const source = possessionSafety(state, actor, actor.position), destination = possessionSafety(state, receiver, receiver.position);
  const improvement = destination + runValue - source;
  const preferCarrier = receiver.role === 'carrier' && actor.role !== 'carrier';
  // Circulate to escape pressure or improve the holder, never just to count passes.
  const chance = passCompletionChance(state, actor, receiver, precision);
  const plannedRelay = Boolean(opening?.receivers.includes(receiver.id) && chance >= .5 && improvement >= -8
    && !opponents(state, receiver).some((p) => distance(p.position, receiver.position) <= 1));
  const receiverNext = state.initiative.indexOf(receiver.id) > state.turnIndex;
  const timelyRelay = state.version >= 4 && chance >= .6 && receiverNext && improvement >= -4 && !receiver.grappledBy && !receiver.prone
    && !opponents(state, receiver).some((p) => distance(p.position, receiver.position) <= 1)
    && approachingOpponents(state, actor, actor.position) > approachingOpponents(state, receiver, receiver.position);
  if (improvement <= 6 && !(preferCarrier && improvement >= 0) && !plannedRelay && !timelyRelay) return null;
  if (chance < .45) return null;
  const weight = carryWeight(state, actor), loss = 65 + Number(state.round >= 9) * 65;
  const pressure = opponents(state, actor).filter((p) => distance(p.position, actor.position) <= 1).length;
  // Evaluate the release cell itself: rewarding pressure relief used to reward
  // staying in contact to throw, even when the same pass had a safer run-up.
  const pressureRelief = state.version >= 5 && actor.movement >= 1.5 && !actor.grappledBy ? -pressure * 20
    : Math.max(0, pressure - opponents(state, receiver).filter((p) => distance(p.position, receiver.position) <= 1).length) * 20;
  const relayTempo = receiverNext ? Math.min(24, receiver.speed * (strategyOf(state, actor) === 'possession' ? 2 : 1)) : 0;
  // Replace the thrower's positional value with expected possession at the receiver.
  return chance * ((destination + runValue) * weight + keepBonus(state, actor) + Number(preferCarrier) * 15 + pressureRelief + relayTempo)
    - (1 - chance) * loss - source * weight + Number(plannedRelay) * 72 + Number(timelyRelay) * (strategyOf(state, actor) === 'possession' ? 28 : 16);
}
export function stripSuccessChance(state, actor, holder, exploit = false) {
  const advantage = hasCheckHelp(state, actor) || exploit || Boolean(collectiveOpening(state, actor, holder));
  const attack = skill(actor, 'wrestling'), defense = Math.max(skill(holder, 'wrestling'), skill(holder, 'acrobatics'));
  const defenseAdvantage = hasCheckHelp(state, holder);
  let chance = 0;
  for (let die = 1; die <= 20; die++) {
    // A tie leaves possession with the defender. Helpers and class openings
    // are public state; calculating the distribution spends no dice or aid.
    const lower = Math.max(0, Math.min(1, (die + attack - defense - 1) / 20));
    chance += (advantage ? (2 * die - 1) / 400 : 1 / 20) * (defenseAdvantage ? lower ** 2 : lower);
  }
  return chance;
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
function stripValue(state, actor, holder, task, aggression, exploit = false) {
  const chance = stripSuccessChance(state, actor, holder, exploit), retention = possessionUntilNextTurn(state, actor);
  const assigned = task === 'recover', specialist = actor.role === 'retriever';
  // Winning the ball in an exposed scrum is worth less than securing it.
  // One player contests possession; the other roles keep screening and marking.
  return 18 + chance * (62 + retention * 30 + Number(state.round >= 10) * 45) - (1 - chance) * 12
    + Number(assigned) * 18 + Number(specialist) * 18 + aggression * .15
    - Number(!assigned) * 18 - Number(actor.role === 'blocker' && !assigned) * 12;
}
function taskFor(state, actor, plan) {
  if (state.ball.carrierId === actor.id) return 'carry';
  // A loose ball is an opportunity now, including during the combat rounds.
  // The holder secures it; teammates answer a real prepared pass or keep fighting.
  if (state.version >= 5 && plan.mode === 'free' && actor.id === plan.primary) return 'recover';
  const combat = matchPriority(state) === 'combat' && opponents(state, actor).length > 0;
  if (state.version >= 5 && plan.mode === 'own' && (!combat || plan.passer)) {
    if (actor.id === plan.protector) return 'protect';
    if (!plan.passer) return actor.role === 'blocker' ? 'screen' : 'standby';
    return plan.supports.has(actor.id) ? 'relay' : 'screen';
  }
  if (combat) return 'fight';
  if (plan.opening && plan.mode !== 'enemy') {
    if (plan.opening.receivers.includes(actor.id)) return state.version >= 5 ? 'standby' : 'opening-relay';
    if (plan.mode === 'free') return plan.opening.contenders.includes(actor.id) ? 'recover' : 'screen';
    return plan.opening.id === 'cage' ? 'protect' : 'screen';
  }
  if (plan.mode === 'free') return actor.id === plan.primary ? 'recover' : 'screen';
  if (plan.mode === 'own') {
    if (actor.id === plan.protector) return 'protect';
    if (plan.supports?.size) return plan.supports.has(actor.id) ? 'relay' : 'screen';
    return actor.id === plan.relay || actor.id === plan.outlet ? 'relay' : 'screen';
  }
  if (actor.id === plan.primary || strategyOf(state, actor) === 'pressing' && actor.role === 'retriever') return 'recover';
  if (state.version >= 4 && actor.id !== plan.guard && (strategyOf(state, actor) === 'possession'
    || actor.instruction === 'cautious' || ['defender', 'relay'].includes(actor.role))) return 'cover';
  return 'mark';
}
function positionalScore(state, actor, cell, plan, task) {
  const ball = carrier(state)?.position ?? state.ball.position;
  if (task === 'fight') {
    const holder = carrier(state);
    const gap = holder && holder.teamId !== actor.teamId ? distance(cell, holder.position) : nearestDistance(opponents(state, actor), cell);
    return 35 - Math.max(0, gap - 1) * 12;
  }
  if (task === 'carry') {
    let score = possessionSafety(state, actor, cell) * carryWeight(state, actor);
    if (plan.supports?.size) {
      const receivers = allies(state, actor).filter((p) => plan.supports.has(p.id) && canReceivePass(state, p) && !p.grappledBy);
      if (receivers.length) score -= Math.max(0, nearestDistance(receivers, cell) - 5) * 12;
    }
    if (plan.opening) {
      const retreat = actor.teamId === 'home' ? 5.5 - cell.x : cell.x - 5.5;
      if (['breakaway', 'press'].includes(plan.opening.id)) score += Math.max(0, retreat) * 5;
      if (plan.opening.receivers.length) score -= nearestDistance(state.players.filter((p) => plan.opening.receivers.includes(p.id)), cell) * 6;
      if (plan.opening.id === 'cage') score += allies(state, actor).filter((p) => distance(p.position, cell) <= 1).length * 14
        - Math.max(0, nearestDistance(allies(state, actor), cell) - 1) * 20;
    }
    return score;
  }
  if (task === 'standby') return 30 - distance(cell, plan.waiting?.get(actor.id) ?? actor.position) * 8 + safety(state, actor, cell) * .2;
  if (task === 'opening-relay') return 42 - distance(cell, plan.opening.anchors[actor.id]) * 18 + safety(state, actor, cell) * .25;
  if (task === 'recover') return 55 - distance(cell, ball) * 11;
  if (task === 'relay') {
    const gap = distance(cell, ball);
    const blockedLane = plan.holder && interceptionCandidates(state, plan.holder, cell).length > 0;
    const anchor = plan.supports?.get(actor.id);
    const crowding = anchor ? allies(state, actor).filter((p) => p.id !== plan.holder.id && distance(p.position, cell) <= 1).length * 12 : 0;
    const prepared = Boolean(readiedPasser(state));
    const available = prepared && gap >= 2 && gap <= 6 && !actor.prone && !actor.grappledBy && !blockedLane
      && opponents(state, actor).every((p) => distance(p.position, cell) > 1);
    return 26 - Math.abs(gap - (anchor ? 4 : 3)) * 8 + safety(state, actor, cell) * .55 - Number(gap > 6) * 40 - Number(blockedLane) * 18
      - (anchor ? distance(cell, anchor) * 4 : 0) - crowding + (prepared ? available ? 32 : -12 : 0);
  }
  if (task === 'protect') {
    const threat = opponents(state, actor).sort((a, b) => distance(a.position, ball) - distance(b.position, ball) || order(a, b))[0];
    return 32 - Math.max(0, distance(cell, ball) - 1) * 13 - (threat ? Math.max(0, distance(cell, threat.position) - 1) * 5 : 0);
  }
  const marked = plan.marks?.get(actor.id);
  const enemy = marked ? playerById(state, marked) : opponents(state, actor).sort((a, b) => distance(a.position, ball) - distance(b.position, ball) || order(a, b))[0];
  if (task === 'cover') {
    const line = plan.coverLines.get(actor.id) ?? [];
    const cutsPass = line.some((point) => distance(point, cell) <= 1);
    const crowding = allies(state, actor).filter((p) => distance(p.position, cell) <= 1).length;
    return 30 - (enemy ? Math.abs(distance(cell, enemy.position) - 2) * 6 : 0) + safety(state, actor, cell) * .6
      + Number(cutsPass) * 12 - crowding * 10 - Math.max(0, distance(cell, ball) - 6) * 8;
  }
  return 25 - (enemy ? Math.max(0, distance(cell, enemy.position) - 1) * 7 : 0)
    - Math.max(0, distance(cell, ball) - 3) * (plan.opening && plan.mode === 'own' ? 0 : 4);
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
  return reachableCells(state, actor, budget).filter((entry) => task !== 'standby' || !entry.path.length).filter((entry) => task !== 'cover' || !entry.path.length
    || opponents(state, actor).every((p) => distance(p.position, entry.position) > 1)).map((entry) => {
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
    'ready-pass': 'Prépare une passe en réaction au prochain démarquage',
    dodge: task === 'carry' ? 'Protège la possession en esquivant' : task === 'standby' ? 'Attend une préparation de passe en restant disponible' : task === 'relay' ? 'Se démarque et offre une solution de passe'
      : task === 'cover' ? 'Couvre les lignes de passe en gardant ses distances' : 'Tient sa position en esquivant',
    disengage: 'Préserve sa mobilité sans subir de frappe gratuite', dash: 'Accélère pour remplir son rôle', wait: 'Garde sa position',
  };
  return `${intentions[type] ?? 'Se replace'} · ${actor.instruction === 'cautious' ? 'prudent' : actor.instruction === 'aggressive' ? 'agressif' : 'normal'}.`;
}

export function decideGroundPickup(state, actor) {
  // Attempt a nearby ground ball with the interaction before spending an action
  // or moving away. The engine chooses the follow-up after the real contest.
  if (state.version >= 5 && !state.ball.carrierId && !isCenterBall(state)
    && legalAction(state, actor, { type: 'pickup' })) {
    return { path: [], action: { type: 'pickup' }, score: 150, task: 'recover',
      reason: 'Récupère la balle au sol avec son interaction et conserve son action.' };
  }
  return null;
}

export function decideTurn(state, actor) {
  const pickup = decideGroundPickup(state, actor);
  if (pickup) return pickup;
  const plan = teamPlan(state, actor), task = taskFor(state, actor, plan);
  const strategy = strategyOf(state, actor);
  const supporting = state.version >= 4 && task === 'relay' && plan.supports?.has(actor.id);
  const aggression = Number(actor.instruction === 'aggressive') * 18 + Number(strategy === 'pressing') * 8 - Number(actor.instruction === 'cautious') * 12;
  const cells = evaluateCells(state, actor, plan, task, actor.movement);
  const candidates = [];
  const receiverRuns = new Map();
  const futureRuns = new Map();
  const prospectiveSupports = state.version >= 5 && task === 'carry' && actor.reaction
    ? supportFormation(state, plan.holder, allies(state, actor), allies(state, actor).length > 1 ? plan.protector : null) : new Map();
  const readyCells = new Set([cells.find((cell) => !cell.path.length), ...cells.slice(0, 5)].filter(Boolean));
  const readyValue = (entry) => {
    if (state.version < 5 || !actor.reaction || !readyCells.has(entry)) return null;
    let options = 0;
    for (const ally of allies(state, actor)) {
      if (!prospectiveSupports.has(ally.id) || ally.grappledBy || ally.grappling
        || state.round >= 10 && state.initiative.indexOf(ally.id) <= state.turnIndex) continue;
      if (!futureRuns.has(ally.id)) {
        const runs = reachableCells(state, ally, ally.speed * (ally.prone ? .5 : 1))
          .filter((run) => !opponents(state, ally).some((p) => distance(p.position, run.position) <= 1));
        futureRuns.set(ally.id, runs);
      }
      const passer = { ...actor, position: entry.position };
      if (futureRuns.get(ally.id).some((run) => openPassReceiver(state, passer, { ...ally, position: run.position }))) options++;
    }
    return options ? keepBonus(state, actor) * .8 + 16 + Math.min(3, options) * 6 : null;
  };
  const add = (entry, action, score) => {
    const view = movementView(state, actor, entry.position);
    view.actor = { ...view.actor, chargeRun: chargeRun(actor, entry.path) };
    if (!legalAction(view.state, view.actor, action)) return;
    const objectiveBonus = task === 'fight' ? (combatActionBonus[action.type] ?? 0)
      + Number(action.type === 'attack' && action.targetId === state.ball.carrierId) * 40 : 0;
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
      if (!receiverRuns.has(target.id)) receiverRuns.set(target.id, receiverRunValue(state, target));
      const runValue = receiverRuns.get(target.id);
      const normal = passScore(view.state, view.actor, target, false, plan.opening, runValue);
      const direct = !entry.path.length && plan.opening?.receivers.includes(target.id)
        && (state.version < 5 || opponents(view.state, view.actor).every((p) => distance(p.position, entry.position) > 1)) ? 24 : 0;
      if (normal !== null) candidates.push({ path: entry.path, action, score: entry.score + normal + direct + objectiveBonus, task });
      const difficult = view.actor.grappledBy || opponents(view.state, view.actor).some((p) => distance(p.position, entry.position) <= 1)
        || interceptionCandidates(view.state, view.actor, target.position).length > 0;
      const enhanced = { ...action, technique: 'precision' };
      if ((difficult || state.round >= 8) && !hasCheckHelp(state, actor) && !hasPassCall(state, actor) && legalAction(view.state, view.actor, enhanced)) {
        const adjusted = passScore(view.state, view.actor, target, true, plan.opening, runValue);
        if (adjusted !== null) candidates.push({ path: entry.path, action: enhanced, score: entry.score + adjusted + direct + objectiveBonus, task });
      }
      return;
    }
    const opening = target && ['strip', 'grapple', 'shove'].includes(action.type) && collectiveOpening(view.state, view.actor, target);
    candidates.push({ path: entry.path, action, score: entry.score + score + (opening ? 7 : 0) + objectiveBonus, task });
    let technique, gain = 0;
    if (action.type === 'strip' && !hasCheckHelp(state, actor)) {
      technique = 'exploitation';
      gain = state.version >= 5 ? stripValue(view.state, view.actor, target, task, aggression, true) - score : 9;
    }
    if (action.type === 'attack' && !actor.grappling && !target.grappledBy) { technique = 'percussion'; gain = 5; }
    const enhanced = { ...action, technique };
    if (technique && legalAction(view.state, view.actor, enhanced)) candidates.push({ path: entry.path, action: enhanced, score: entry.score + score + gain + objectiveBonus, task });
  };
  const holder = carrier(state), groundPickup = state.version >= 5 && !isCenterBall(state);
  for (const cell of cells) {
    const { actor: actorHere, state: here } = movementView(state, actor, cell.position);
    const adjacent = opponents(here, actorHere).filter((p) => distance(p.position, cell.position) <= 1);
    if (!holder && (groundPickup || !plan.opening || plan.opening.contenders.includes(actor.id)) && distance(cell.position, state.ball.position) <= 1) add(cell, { type: 'pickup' }, 150 + Math.max(skill(actor, 'acrobatics'), skill(actor, 'wrestling')) * 2);
    if (actor.grappledBy) add(cell, { type: 'escape' }, state.ball.carrierId === actor.id ? 55 : 70);
    for (const enemy of adjacent) {
      const danger = holder?.teamId === actor.teamId && holder.id !== actor.id && distance(enemy.position, holder.position) <= (plan.opening ? enemy.speed / 1.5 + 1 : 2);
      // Coverage leaves pursuit to the assigned pressure players. An opponent
      // already at contact can still be contested without abandoning the lane.
      if (task === 'cover' && distance(actor.position, enemy.position) > 1) continue;
      if (enemy.id === holder?.id) add(cell, { type: 'strip', targetId: enemy.id }, state.version >= 5 ? stripValue(here, actorHere, enemy, task, aggression)
        : 106 + skill(actor, 'wrestling') * 3 + Number(actor.role === 'retriever') * 16 + aggression * .3 + Number(plan.opening?.id === 'press') * 15);
      const hitChance = Math.max(.05, Math.min(.95, (21 + actor.attack.bonus - armorAgainst(enemy, actor)) / 20));
      const ko = enemy.hp <= actor.attack.die / 2 + .5 + actor.attack.flat;
      const distraction = (supporting && !danger || task === 'cover' && enemy.id !== holder?.id) ? actor.instruction === 'aggressive' ? 10 : 30 : 0;
      add(cell, { type: 'attack', targetId: enemy.id }, 18 + hitChance * 18 + Number(enemy.id === holder?.id) * 28 + Number(danger) * 18 + Number(ko) * 20 + aggression - distraction);
      add(cell, { type: 'grapple', targetId: enemy.id }, 20 + Number(danger) * 38 + Number(actor.role === 'blocker') * 15 + Number(enemy.id === holder?.id) * 8 + aggression * .2 - distraction);
      add(cell, { type: 'shove', targetId: enemy.id }, 17 + Number(danger) * 15 + Number(actor.role === 'blocker') * 8 + aggression * .3 - distraction);
    }
    if (holder?.id === actor.id) {
      const prepared = readyValue(cell);
      if (prepared !== null) add(cell, { type: 'ready-pass' }, prepared);
      for (const ally of allies(here, actorHere)) {
        if (!canReceivePass(state, ally) || distance(cell.position, ally.position) > 6) continue;
        add(cell, { type: 'pass', targetId: ally.id }, 0);
      }
    }
    for (const ally of allies(here, actorHere)) {
      if (distance(cell.position, ally.position) > 1) continue;
      const hasHelp = state.aids.some((a) => a.allyId === ally.id && a.kind === 'check');
      if (!hasHelp) add(cell, { type: 'help', targetId: ally.id }, supporting ? 8 : ally.id === holder?.id ? 30 + Number(strategy === 'possession') * 12 : 12);
      const foe = opponents(here, actorHere).find((p) => distance(p.position, cell.position) <= 1 && distance(p.position, ally.position) <= 1);
      if (foe && !state.aids.some((a) => a.allyId === ally.id && a.enemyId === foe.id)) add(cell, { type: 'help', targetId: ally.id, enemyId: foe.id }, 24 + Number(actor.role === 'relay') * 8);
    }
    add(cell, { type: 'dodge' }, holder?.id === actor.id ? actor.grappledBy ? 0 : keepBonus(state, actor) : supporting ? 16 : 5);
    const enteringContact = state.version >= 5 && supporting && !opponents(state, actor).some((p) => distance(p.position, actor.position) <= 1);
    if (adjacent.length && !actor.grappledBy && !actor.grappling && !enteringContact) {
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
  const priority = state.version >= 5 && ['carry', 'recover', 'relay'].includes(task) ? 'ball' : matchPriority(state);
  return { ...chosen, reason: `${priority ? priority === 'combat' ? 'Priorité combat : ' : 'Priorité ballon : ' : ''}${plan.opening ? `${OPENINGS[plan.opening.id].name} : ` : ''}${explain(actor, task, chosen.action.type, playerById(state, chosen.action.targetId))}` };
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
  if (actor.hp <= 0 || actor.grappledBy || actor.grappling || actor.readiedPass || actor.movement < 1.5) return [];
  const plan = teamPlan(state, actor), task = taskFor(state, actor, plan);
  const cells = evaluateCells(state, actor, plan, task, actor.movement);
  const current = positionalScore(state, actor, actor.position, plan, task);
  return cells[0]?.score > current + 1 ? cells[0].path : [];
}
