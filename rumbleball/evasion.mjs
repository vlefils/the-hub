import {
  allies, armorAgainst, carrier, distance, hasCheckHelp, hasPassCall,
  legalAction, openPassReceiver, opponents, provokesOpportunity, reachableCells, shouldTakeOpportunity, skill,
} from './rules.mjs';

const delay = (state, id) => {
  const gap = state.initiative.indexOf(id) - state.turnIndex;
  return gap > 0 ? gap : gap + state.initiative.length;
};

// Forecast reachable attacks from public positions, terrain and initiative.
// No future rolls, bot decisions or RNG state are consulted.
export function defensiveForecast(state, actor) {
  const enemies = opponents(state, actor);
  const reach = new Map(enemies.map((enemy) => {
    const view = { ...state, players: state.players.map((p) => p.id === actor.id && !enemy.grappling ? { ...p, hp: 0 } : p) };
    const budget = enemy.grappledBy ? 0 : enemy.speed * (enemy.prone ? .5 : 1);
    return [enemy.id, reachableCells(view, enemy, budget).map((r) => r.position)];
  }));
  const risk = (player, cell, dodging = false, horizon = delay(state, player.id), withBall = state.ball.carrierId === player.id) => {
    let damage = 0, hits = 0;
    const remaining = state.round >= 10 ? state.initiative.length - state.turnIndex : Infinity;
    for (const enemy of enemies) {
      if (delay(state, enemy.id) >= Math.min(horizon, remaining)) continue;
      if (!reach.get(enemy.id).some((p) => distance(p, cell) <= 1)) continue;
      const chance = Math.max(.05, Math.min(.95, (21 + enemy.attack.bonus - armorAgainst(player, enemy)) / 20));
      const hit = dodging && !player.grappledBy ? chance * chance : chance;
      const holder = carrier(state);
      const contest = withBall ? 1 : holder?.id === enemy.id ? .1 : .35;
      hits += hit * contest; damage += hit * contest * ((enemy.attack.die + 1) / 2 + enemy.attack.flat);
    }
    return { damage, hits };
  };
  const routeRisk = (path, dodging = false, disengaged = false) => {
    if (actor.disengaged || disengaged) return 0;
    let from = actor.position, value = 0;
    const spent = new Set();
    for (const to of path) {
      for (const enemy of enemies) {
        if (spent.has(enemy.id) || actor.archetype === 'escamoteur' && actor.classState.flaw && actor.classState.targetId === enemy.id) continue;
        if (!provokesOpportunity(enemy, actor, from, to) || !shouldTakeOpportunity(state, enemy, actor)) continue;
        spent.add(enemy.id);
        const hit = Math.max(.05, Math.min(.95, (21 + enemy.attack.bonus - armorAgainst(actor, enemy)) / 20));
        value += (dodging ? hit * hit : hit) * (state.ball.carrierId === actor.id ? 32 : 15);
      }
      from = to;
    }
    return value;
  };
  return { risk, routeRisk };
}

function positionEvaluator(state, actor, forecast) {
  const holder = carrier(state), carrying = holder?.id === actor.id;
  const team = [actor, ...allies(state, actor)], foes = opponents(state, actor);
  return (player, cell, dodge = false) => {
    const danger = forecast.risk(player, cell, dodge, delay(state, player.id), carrying);
    const separation = Math.min(carrying ? 8 : 3, ...foes.map((p) => distance(p.position, cell)));
    const gap = Math.min(6, ...team.filter((p) => p.id !== player.id && !p.grappledBy).map((p) => distance(p.position, cell)));
    return separation * 4 - danger.damage * (carrying ? 6 : 5) - danger.hits * (carrying ? 20 : 0)
      - (carrying ? Math.min(1, danger.damage / player.hp) * 35 : 0)
      - Math.max(0, gap - 5) * 5
      - (carrying ? 0 : Math.max(0, distance(cell, holder?.position ?? state.ball.position) - 3) * 8);
  };
}

function handlesPosition(state, actor, plan) {
  if (actor.grappledBy || actor.grappling) return false;
  if (state.ball.carrierId === actor.id) return true;
  // Explicit individual instructions retain their cautious/aggressive policy.
  if (actor.instruction !== 'normal') return false;
  // Pickup and the real prepared-pass support assignments use the shared AI.
  if (plan.mode === 'free' && plan.primary === actor.id || plan.supports?.has(actor.id)) return false;
  return !(plan.mode === 'enemy' && state.round >= 8 && plan.primary === actor.id);
}

export function evasiveDecision(state, actor, plan, passChance) {
  if (!actor.action || !handlesPosition(state, actor, plan)) return null;
  const holder = carrier(state), carrying = holder?.id === actor.id;
  const forecast = defensiveForecast(state, actor), mates = allies(state, actor), foes = opponents(state, actor);
  const cells = reachableCells(state, actor, actor.movement);
  const runs = new Map(carrying && actor.reaction ? mates.filter((p) => !p.grappledBy && !p.grappling
    && (mates.length === 1 || p.id !== plan.protector) && delay(state, p.id) < delay(state, actor.id)
    && (state.round < 10 || state.initiative.indexOf(p.id) > state.turnIndex))
    .map((p) => [p.id, reachableCells(state, p, p.speed * (p.prone ? .5 : 1))]) : []);
  const positionValue = positionEvaluator(state, actor, forecast);
  const candidates = [];
  const relays = new Set();
  const preparations = new Set();
  const focus = [...foes].sort((a, b) => {
    const value = (p) => p.hp + p.armor * 2 + Math.min(...[actor, ...mates].map((m) => distance(m.position, p.position))) * 4
      - Number(p.id === holder?.id) * 12;
    return value(a) - value(b) || a.id.localeCompare(b.id);
  })[0];
  const add = (entry, action, score, before = false) => {
    const placed = { ...actor, position: entry.position };
    if (!legalAction(state, placed, action)) return;
    const candidate = { path: before ? [] : entry.path, action, score, task: carrying ? 'carry' : 'evade' };
    candidates.push(candidate);
    return candidate;
  };
  const bestMove = (budget, dodge = false, disengaged = false) => reachableCells(state, actor, budget).map((entry) => ({ ...entry,
    score: positionValue(actor, entry.position, dodge) - forecast.routeRisk(entry.path, dodge, disengaged) - entry.cost * .1,
  })).sort((a, b) => b.score - a.score || a.cost - b.cost)[0];
  for (const [type, budget, dodge, disengaged] of [['dodge', actor.movement, true, false], ['disengage', actor.movement, false, true], ['dash', actor.movement + actor.speed, false, false]]) {
    const entry = bestMove(budget, dodge, disengaged);
    if (type === 'dash' && entry.cost <= actor.movement || type === 'disengage' && !foes.some((p) => distance(p.position, actor.position) <= 1)) continue;
    add(entry, { type }, entry.score + (carrying ? 75 : 0), true);
  }
  if (!carrying) for (const entry of cells) {
    const positional = positionValue(actor, entry.position) - forecast.routeRisk(entry.path) - entry.cost * .1;
    for (const enemy of foes.filter((p) => distance(p.position, entry.position) <= 1)) {
      const chance = Math.max(.05, Math.min(.95, (21 + actor.attack.bonus - armorAgainst(enemy, actor)) / 20));
      const hit = enemy.dodging && !enemy.grappledBy ? chance * chance : enemy.prone ? 1 - (1 - chance) ** 2 : chance;
      const damage = Math.min(enemy.hp, (actor.attack.die + 1) / 2 + actor.attack.flat);
      const kill = enemy.hp <= actor.attack.die + actor.attack.flat ? Math.min(1, (actor.attack.die + actor.attack.flat - enemy.hp + 1) / actor.attack.die) * hit : 0;
      add(entry, { type: 'attack', targetId: enemy.id }, positional + damage * hit * 9 + kill * 55 + Number(focus?.id === enemy.id) * 18);
      if (plan.mode === 'own' && (actor.archetype === 'belier' || actor.role === 'blocker') && !enemy.grappledBy) {
        const threat = distance(enemy.position, holder.position) <= enemy.speed / 1.5 + 1;
        add(entry, { type: 'grapple', targetId: enemy.id }, positional + (threat ? 58 : 15) + skill(actor, 'wrestling') * 2);
      }
    }
  }
  if (carrying) for (const entry of cells) {
    const passer = { ...actor, position: entry.position };
    const route = forecast.routeRisk(entry.path);
    for (const receiver of mates) {
      if (receiver.prone || receiver.grappledBy || foes.some((p) => distance(p.position, receiver.position) <= 1)) continue;
      for (const precision of [false, true]) {
        if (precision && (hasCheckHelp(state, actor) || hasPassCall(state, actor))) continue;
        const action = { type: 'pass', targetId: receiver.id, ...(precision ? { technique: 'precision' } : {}) };
        if (!legalAction(state, passer, action)) continue;
        const chance = passChance(state, passer, receiver, precision);
        if (chance < .6) continue;
        const value = positionValue(receiver, receiver.position, receiver.dodging)
          + Math.max(0, receiver.speed - actor.speed) * 4 + (state.round < 10 && delay(state, receiver.id) < delay(state, actor.id) ? 24 : 0);
        const candidate = add(entry, action, chance * (75 + value) - (1 - chance) * 100 - route - entry.cost * .1);
        if (candidate && foes.length && state.round < 9 && chance >= .75 && route === 0
          && distance(entry.position, receiver.position) >= 2 && delay(state, receiver.id) < delay(state, actor.id)
          && forecast.risk(receiver, receiver.position, false, delay(state, receiver.id), true).hits === 0) relays.add(candidate);
      }
    }
    if (actor.reaction && !foes.some((p) => distance(p.position, entry.position) <= 1)) {
      for (const receiver of mates) {
        const options = runs.get(receiver.id);
        if (!options) continue;
        const usable = options.filter((r) => openPassReceiver(state, passer, { ...receiver, prone: false, position: r.position }));
        if (!usable.length) continue;
        const danger = forecast.risk(actor, entry.position, false, delay(state, receiver.id));
        const best = Math.max(...usable.map((r) => positionValue(receiver, r.position, false)));
        const futureReceiver = { ...receiver, prone: false, position: usable[0].position };
        const view = { ...state, players: state.players.map((p) => p.id === receiver.id ? futureReceiver : p) };
        const precise = !hasCheckHelp(state, passer) && !hasPassCall(state, passer)
          && legalAction(view, passer, { type: 'pass', targetId: receiver.id, technique: 'precision' });
        const chance = passChance(view, passer, futureReceiver, precise);
        const candidate = add(entry, { type: 'ready-pass' }, chance * (75 + best + 24) - (1 - chance) * 100
          - danger.damage * 6 - danger.hits * 20 - route - entry.cost * .1);
        if (candidate && foes.length && state.round < 9 && chance >= .65 && route === 0 && danger.hits <= .7) preparations.add(candidate);
      }
    }
  }
  candidates.sort((a, b) => b.score - a.score || a.path.length - b.path.length || a.action.type.localeCompare(b.action.type));
  return candidates.find((c) => relays.has(c)) ?? (candidates[0]?.action.type === 'pass' ? candidates[0]
    : candidates.find((c) => preparations.has(c)) ?? candidates[0]) ?? null;
}

export function evasiveMovement(state, actor, plan) {
  if (actor.readiedPass || !handlesPosition(state, actor, plan)) return null;
  const forecast = defensiveForecast(state, actor), positionValue = positionEvaluator(state, actor, forecast);
  const ranked = reachableCells(state, actor, actor.movement).map((entry) => {
    return { ...entry, score: positionValue(actor, entry.position, actor.dodging)
      - forecast.routeRisk(entry.path, actor.dodging, actor.disengaged) - entry.cost * .1 };
  }).sort((a, b) => b.score - a.score || a.cost - b.cost);
  return ranked[0]?.path ?? [];
}
