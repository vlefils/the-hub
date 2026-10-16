import {
  active, allies, carrier, distance, interceptionCandidates, legalAction,
  movementView, opponents, playerById, provokesOpportunity, reachableCells, shouldTakeOpportunity, skill,
} from './rules.mjs';

const nearestDistance = (players, cell) => Math.min(12, ...players.map((p) => distance(p.position, cell)));
const order = (a, b) => a.id.localeCompare(b.id);
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
    return { mode: 'own', holder, protector: protector?.id, relay: relay?.id };
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
function taskFor(state, actor, plan) {
  if (state.ball.carrierId === actor.id) return 'carry';
  if (plan.mode === 'free') return actor.id === plan.primary ? 'recover' : 'screen';
  if (plan.mode === 'own') return actor.id === plan.protector ? 'protect' : actor.id === plan.relay ? 'relay' : 'screen';
  return actor.id === plan.primary || strategyOf(state, actor) === 'pressing' && actor.role === 'retriever' ? 'recover' : 'mark';
}
function positionalScore(state, actor, cell, plan, task) {
  const ball = carrier(state)?.position ?? state.ball.position;
  if (task === 'carry') {
    const weight = strategyOf(state, actor) === 'possession' || actor.instruction === 'cautious' ? 1.6 : 1.2;
    return safety(state, actor, cell) * weight;
  }
  if (task === 'recover') return 55 - distance(cell, ball) * 11;
  if (task === 'relay') {
    const gap = distance(cell, ball);
    return 26 - Math.abs(gap - 3) * 8 + safety(state, actor, cell) * .55 - Number(gap > 6) * 40;
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
    if (legalAction(view.state, view.actor, action)) candidates.push({ path: entry.path, action, score: entry.score + score, task });
  };
  const holder = carrier(state);
  for (const cell of cells) {
    const { actor: actorHere, state: here } = movementView(state, actor, cell.position);
    const adjacent = opponents(here, actorHere).filter((p) => distance(p.position, cell.position) <= 1);
    if (!holder && distance(cell.position, state.ball.position) <= 1) add(cell, { type: 'pickup' }, 150 + Math.max(skill(actor, 'acrobatics'), skill(actor, 'wrestling')) * 2);
    if (actor.grappledBy) add(cell, { type: 'escape' }, state.ball.carrierId === actor.id ? 55 : 70);
    for (const enemy of adjacent) {
      const danger = holder?.teamId === actor.teamId && distance(enemy.position, holder.position) <= 2;
      add(cell, { type: 'strip', targetId: enemy.id }, 106 + skill(actor, 'wrestling') * 3 + Number(actor.role === 'retriever') * 16 + aggression * .3);
      const hitChance = Math.max(.05, Math.min(.95, (21 + actor.attack.bonus - enemy.armor) / 20));
      const ko = enemy.hp <= actor.attack.die / 2 + .5 + actor.attack.flat;
      add(cell, { type: 'attack', targetId: enemy.id }, 18 + hitChance * 18 + Number(enemy.id === holder?.id) * 28 + Number(danger) * 18 + Number(ko) * 20 + aggression);
      add(cell, { type: 'grapple', targetId: enemy.id }, 20 + Number(danger) * 38 + Number(actor.role === 'blocker') * 15 + Number(enemy.id === holder?.id) * 8 + aggression * .2);
      add(cell, { type: 'shove', targetId: enemy.id }, 17 + Number(danger) * 15 + Number(actor.role === 'blocker') * 8 + aggression * .3);
    }
    if (holder?.id === actor.id) {
      for (const ally of allies(here, actorHere)) {
        if (!ally.reaction || distance(cell.position, ally.position) > 6) continue;
        const improvement = safety(here, actorHere, ally.position) - safety(here, actorHere, cell.position);
        const preferCarrier = ally.role === 'carrier' && actor.role !== 'carrier';
        if (improvement <= 10 && !preferCarrier) continue;
        const interceptions = interceptionCandidates(here, actorHere, ally.position);
        const dc = adjacent.length || actor.grappledBy ? 15 : 10;
        const success = Math.max(.05, Math.min(.95, (21 + skill(actor, 'acrobatics') - dc) / 20));
        add(cell, { type: 'pass', targetId: ally.id }, 20 + improvement * 1.8 + Number(preferCarrier) * 24 + success * 15 - interceptions.length * 16 - Number(state.round >= 9) * 10);
      }
    }
    for (const ally of allies(here, actorHere)) {
      if (distance(cell.position, ally.position) > 1) continue;
      const hasHelp = state.aids.some((a) => a.allyId === ally.id && a.kind === 'check');
      if (!hasHelp) add(cell, { type: 'help', targetId: ally.id }, ally.id === holder?.id ? 30 + Number(strategy === 'possession') * 12 : 12);
      const foe = opponents(here, actorHere).find((p) => distance(p.position, cell.position) <= 1 && distance(p.position, ally.position) <= 1);
      if (foe && !state.aids.some((a) => a.allyId === ally.id && a.enemyId === foe.id)) add(cell, { type: 'help', targetId: ally.id, enemyId: foe.id }, 24 + Number(actor.role === 'relay') * 8);
    }
    add(cell, { type: 'dodge' }, holder?.id === actor.id ? 48 + Number(strategy === 'possession') * 12 + Number(actor.instruction === 'cautious') * 12 : 5);
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

export function decideMovement(state, actor) {
  // Maintaining a hold already achieves a control objective. Spare movement is optional;
  // repositioning with a held target must be part of the next turn's deliberate plan.
  if (actor.hp <= 0 || actor.grappledBy || actor.grappling || actor.movement < 1.5) return [];
  const plan = teamPlan(state, actor), task = taskFor(state, actor, plan);
  const cells = evaluateCells(state, actor, plan, task, actor.movement);
  const current = positionalScore(state, actor, actor.position, plan, task);
  return cells[0]?.score > current + 1 ? cells[0].path : [];
}
