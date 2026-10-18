import { clone, PROFILES, STARTS, ROLES, INSTRUCTIONS, STRATEGIES } from './data.mjs';
import { decideClassAction, decideGroundPickup, decideMovement, decideTurn } from './ai.mjs';
import { ARCHETYPES, initialClassState } from './classes.mjs';
import { matchKits } from './appearance.mjs';
import { validCrest } from './identity.mjs';
import { CENTER, defaultDeployment, validDeployment } from './deployment.mjs';
import { defaultOpening, openingDeployment, validOpening } from './openings.mjs';
import { assertInvariants, beginTurn, cancelReadiedPass, carrier, emit, endTurn, legalAction, moveAlong, randomInt, readiedPasser, resolveAction, resolveClassAction, resolveCenterEngagement, resolveReadiedPass, stat } from './rules.mjs';

export const DEFAULT_SEED = 'arche-01';
export const CURRENT_RULES = 6;
export function seedHash(seed) {
  let n = 2166136261;
  for (const char of String(seed)) n = Math.imul(n ^ char.charCodeAt(0), 16777619);
  return n >>> 0;
}
const startPosition = (team, index) => {
  const [x, y] = STARTS[index];
  return team === 'home' ? { x, y } : { x: 11 - x, y: 7 - y };
};
function centerBall(state) {
  state.ball = { carrierId: null, position: state.version >= 3 ? { ...CENTER } : { x: 5 + randomInt(state, 2), y: 3 + randomInt(state, 2) } };
}
export function createMatch(config = {}) {
  const seed = String(config.seed ?? DEFAULT_SEED).slice(0, 80);
  const kits = matchKits(config.kitColors?.home, config.kitColors?.away);
  const version = [2, 3, 4, 5].includes(config.rulesVersion) ? config.rulesVersion : CURRENT_RULES;
  const deployments = {}, openings = {};
  if (version >= 3) for (const side of ['home', 'away']) {
    openings[side] = config.openings?.[side] ?? defaultOpening(side === 'home' ? config.strategy : config.awayStrategy);
    if (!validOpening(openings[side])) throw new Error('Ouverture inconnue.');
    deployments[side] = config.deployments?.[side] ?? (version >= 4 ? openingDeployment(openings[side], side) : defaultDeployment(side === 'home' ? config.strategy : config.awayStrategy, side));
    if (!validDeployment(deployments[side], side)) throw new Error('Déploiement invalide : cinq cases distinctes dans la moitié de chaque équipe.');
  }
  const state = {
    version, seed, rng: seedHash(seed), round: 1, turnIndex: 0, activeId: null,
    phase: 'regular', finished: false, result: null, turns: 0, aids: [], calls: [], lastDecision: null,
    teams: [
      { id: 'home', kitColor: kits.home, ...(validCrest(config.crestIds?.home) ? { crestId: config.crestIds.home } : {}), name: config.teamNames?.home ?? 'Les Recrues', strategy: Object.hasOwn(STRATEGIES, config.strategy) ? config.strategy : 'balanced', ...(version >= 4 ? { opening: openings.home } : {}) },
      { id: 'away', kitColor: kits.away, ...(validCrest(config.crestIds?.away) ? { crestId: config.crestIds.away } : {}), name: config.teamNames?.away ?? 'Les Charognards', strategy: Object.hasOwn(STRATEGIES, config.awayStrategy) ? config.awayStrategy : 'balanced', ...(version >= 4 ? { opening: openings.away } : {}) },
    ],
    stats: { home: { passesAttempted: 0, passesCompleted: 0, recoveries: 0, knockouts: 0 }, away: { passesAttempted: 0, passesCompleted: 0, recoveries: 0, knockouts: 0 } },
    players: ['home', 'away'].flatMap((teamId) => {
      const profiles = config.rosters?.[teamId] ?? PROFILES;
      if (!Array.isArray(profiles) || profiles.length !== 5) throw new Error('Cinq titulaires sont nécessaires.');
      return profiles.map((profile, index) => {
        const assigned = (teamId === 'home' ? config.players : config.awayPlayers)?.[index] ?? (config.rosters?.[teamId] ? profile : undefined);
        const archetype = config.classes === false ? null : Object.hasOwn(ARCHETYPES, assigned?.archetype) ? assigned.archetype : profile.archetype;
        return { ...clone(profile), id: `${teamId}-${index}`, teamId, number: index + 1,
          archetype, classState: initialClassState(archetype, profile.level), bonusAction: true, chargeRun: null, feintTargetId: null,
          name: config.rosters?.[teamId] ? profile.name : teamId === 'home' ? profile.trainingName : profile.name,
          role: Object.hasOwn(ROLES, assigned?.role) ? assigned.role : profile.role,
          instruction: Object.hasOwn(INSTRUCTIONS, assigned?.instruction) ? assigned.instruction : 'normal',
          hp: profile.maxHp, position: version >= 3 ? { ...deployments[teamId][index] } : startPosition(teamId, index), movement: profile.speed,
          ...(version >= 3 ? { startPosition: { ...deployments[teamId][index] } } : {}),
          reaction: true, action: true, interaction: true, pickedUp: false, prone: false,
          ...(version >= 5 ? { readiedPass: null } : {}),
          dodging: false, disengaged: false, grappledBy: null, grappling: null,
        };
      });
    }),
  };
  centerBall(state);
  for (const p of state.players) { p.initiativeDie = randomInt(state, 20) + 1; p.initiative = p.initiativeDie + stat(p, 'dexterity'); p.initiativeTie = randomInt(state, 1000000); }
  state.initiative = [...state.players].sort((a, b) => b.initiative - a.initiative || stat(b, 'dexterity') - stat(a, 'dexterity') || a.initiativeTie - b.initiativeTie || a.id.localeCompare(b.id)).map((p) => p.id);
  assertInvariants(state);
  return state;
}
function finish(state, events, winner, reason = winner ? 'possession' : 'draw') {
  state.finished = true;
  state.calls = [];
  for (const p of state.players) { cancelReadiedPass(state, p, events, 'fin du match'); p.classState.targetId = null; p.classState.flaw = 0; }
  state.result = { winnerId: winner?.teamId ?? null, carrierId: winner?.id ?? null, round: state.round,
    reason };
  const team = state.teams.find((t) => t.id === winner?.teamId);
  emit(state, events, 'finish', reason === 'elimination' ? `${team.name} remportent le match : tous les joueurs adverses sont KO.` : reason === 'double-knockout' ? 'Match nul : les deux équipes sont entièrement KO.' : winner ? `${team.name} remportent le match : ${winner.name} possède la balle à la sirène.` : 'Match nul : la balle reste libre après le dernier engagement.');
}
function finishByKnockouts(state, events) {
  if (state.version < 6) return false;
  if (state.finished) return true;
  const remaining = state.teams.filter(team => state.players.some(p => p.teamId === team.id && p.hp > 0));
  if (remaining.length === 2) return false;
  finish(state, events, remaining.length ? { teamId: remaining[0].id, id: null } : null, remaining.length ? 'elimination' : 'double-knockout');
  assertInvariants(state); return true;
}
function endRound(state, events) {
  const holder = carrier(state);
  emit(state, events, 'round-end', `Fin du round ${state.round} · ${holder ? `${holder.name} possède la balle` : 'balle libre'}.`);
  if (state.round >= 10 && holder) { finish(state, events, holder); return; }
  if (state.round === 13) { finish(state, events, null); return; }
  state.round++;
  state.turnIndex = 0;
  if (state.round === 11) { state.phase = 'overtime'; emit(state, events, 'overtime', 'Balle libre à la sirène : deux rounds de prolongation. Une possession en fin de round suffit.'); }
  if (state.round === 13) {
    state.phase = 'final'; centerBall(state); state.aids = []; state.calls = [];
    for (const p of state.players) {
      p.position = { ...(p.startPosition ?? startPosition(p.teamId, p.number - 1)) }; p.grappling = null; p.grappledBy = null; p.dodging = false;
      p.classState.targetId = null; p.classState.flaw = 0;
    }
    emit(state, events, 'restart', 'Dernier engagement au centre : un round pour contrôler la balle. PV et KO conservés.');
  }
  for (const p of state.players) p.reaction = p.hp > 0;
}
function advance(state, events) {
  if (finishByKnockouts(state, events)) return;
  state.turnIndex++;
  if (state.turnIndex === state.initiative.length) endRound(state, events);
}
function stepMutable(state, { stopAtRoundEnd = false } = {}) {
  const events = [];
  if (state.finished) return events;
  if (finishByKnockouts(state, events)) return events;
  // Skip KO slots without granting turns or reactions. Also handles both teams entirely KO.
  let actor;
  while (!state.finished) {
    // Also handle a new round reached while skipping KO slots in this call.
    if (state.version >= 4 && state.turnIndex === 0) { state.activeId = null; resolveCenterEngagement(state, events); }
    actor = state.players.find((p) => p.id === state.initiative[state.turnIndex]);
    if (actor?.hp > 0) break;
    const round = state.round;
    advance(state, events);
    // Presentation may batch a round, including its skipped KO slots, without
    // accidentally executing the first living player's turn in the next round.
    if (stopAtRoundEnd && (state.round !== round || state.finished)) { assertInvariants(state); return events; }
  }
  if (state.finished) { assertInvariants(state); return events; }
  state.activeId = actor.id;
  state.turns++;
  beginTurn(state, actor, events);
  resolveReadiedPass(state, actor, events);
  if (finishByKnockouts(state, events)) return events;
  const useClassAction = (path = []) => {
    const choice = decideClassAction(state, actor, path);
    if (choice) resolveClassAction(state, actor, choice, events);
  };
  useClassAction();
  if (finishByKnockouts(state, events)) return events;
  const decision = decideTurn(state, actor);
  const plannedPasser = decision.task === 'relay' ? readiedPasser(state)?.id : null;
  state.lastDecision = { playerId: actor.id, reason: decision.reason, action: decision.action.type };
  emit(state, events, 'decision', `${actor.name} · ${decision.reason}`, { playerId: actor.id, action: decision.action.type,
    ...(state.version >= 5 ? { task: decision.task, ...(plannedPasser ? { supportPasserId: plannedPasser } : {}) } : {}) });
  const previousHolder = state.ball.carrierId;
  const followPath = (path) => {
    useClassAction(path); if (finishByKnockouts(state, events)) return true;
    moveAlong(state, actor, path, events); if (finishByKnockouts(state, events)) return true;
    useClassAction(); return finishByKnockouts(state, events);
  };
  if (followPath(decision.path)) return events;
  if (actor.hp > 0) {
    // A reaction may remove possession during movement. Reconsider only actions legal
    // at the reached cell; a fresh full-turn plan could require another unexecuted path.
    let action = decision.action;
    if (action.technique && !legalAction(state, actor, action)) {
      const basic = { ...action }; delete basic.technique;
      if (legalAction(state, actor, basic)) action = basic;
    }
    const supportEnded = state.version >= 5 && decision.task === 'relay' && readiedPasser(state)?.id !== plannedPasser;
    // A reception interrupts movement at the first free passing lane. The new
    // holder can use their real remaining movement before spending their action.
    // Execute that path, then use the usual action-only fallback if interrupted.
    if (state.version >= 5 && state.ball.carrierId === actor.id && previousHolder !== actor.id) {
      const received = decideTurn(state, actor);
      state.lastDecision = { playerId: actor.id, reason: received.reason, action: received.action.type };
      emit(state, events, 'replan', `${actor.name} utilise son mouvement restant après réception : ${received.reason}`);
      if (followPath(received.path)) return events;
      action = received.action;
    }
    if (actor.hp <= 0) { endTurn(state, actor, events); assertInvariants(state); advance(state, events); assertInvariants(state); return events; }
    if (!legalAction(state, actor, action) || supportEnded && state.ball.carrierId !== actor.id
      || state.version < 5 && state.ball.carrierId === actor.id && previousHolder !== actor.id) {
      const revised = decideTurn(state, { ...actor, movement: 0 });
      action = revised.action;
      state.lastDecision = { playerId: actor.id, reason: revised.reason, action: action.type };
      emit(state, events, 'replan', `${actor.name} adapte son plan après le déplacement : ${revised.reason}`);
    }
    if (!resolveAction(state, actor, action, events)) throw new Error(`Action illégale du bot : ${actor.id} ${action.type}`);
    if (finishByKnockouts(state, events)) return events;
    // A pickup may spend only an interaction or an engagement reaction.
    // Use the remaining action without granting an extra one.
    if (actor.action && actor.hp > 0) {
      const followup = decideTurn(state, actor);
      if (followPath(followup.path)) return events;
      if (actor.hp > 0) {
        const basic = { ...followup.action }; delete basic.technique;
        const next = legalAction(state, actor, followup.action) ? followup.action : legalAction(state, actor, basic) ? basic : { type: 'dodge' };
        if (!resolveAction(state, actor, next, events)) throw new Error(`Action de suivi illégale : ${actor.id}`);
        if (finishByKnockouts(state, events)) return events;
      }
    }
    // Damage or a failed pass can leave the ball at the actor's feet after the
    // action. Use the remaining interaction once, without restoring any budget.
    if (!actor.action && actor.hp > 0 && decideGroundPickup(state, actor)) {
      if (!resolveAction(state, actor, { type: 'pickup' }, events)) throw new Error(`Ramassage de suivi illégal : ${actor.id}`);
    }
    if (actor.grappling) {
      const held = state.players.find((p) => p.id === actor.grappling);
      emit(state, events, 'hold-position', `${actor.name} maintient sa prise sur ${held.name} et conserve sa position ; le mouvement restant n’est pas dépensé.`);
    } else {
      const path = decideMovement(state, actor); useClassAction(path); if (finishByKnockouts(state, events)) return events;
      moveAlong(state, actor, path, events); if (finishByKnockouts(state, events)) return events;
    }
  }
  endTurn(state, actor, events);
  assertInvariants(state);
  advance(state, events);
  assertInvariants(state);
  return events;
}
export function stepMatch(input, options) {
  const state = clone(input);
  return { state, events: stepMutable(state, options) };
}
export function simulateMatch(config = {}, onTurn) {
  const state = createMatch(config), events = [];
  while (!state.finished) {
    const turnEvents = stepMutable(state);
    events.push(...turnEvents);
    onTurn?.(state, turnEvents);
    if (state.turns > 130) throw new Error('Limite de tours dépassée');
  }
  return { state, events };
}
