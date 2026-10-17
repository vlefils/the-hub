import { clone, PROFILES, STARTS, ROLES, INSTRUCTIONS, STRATEGIES } from './data.mjs';
import { decideClassAction, decideMovement, decideTurn } from './ai.mjs';
import { ARCHETYPES, initialClassState } from './classes.mjs';
import { matchKits } from './appearance.mjs';
import { assertInvariants, beginTurn, carrier, emit, endTurn, legalAction, moveAlong, randomInt, resolveAction, resolveClassAction, stat } from './rules.mjs';

export const DEFAULT_SEED = 'arche-01';
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
  state.ball = { carrierId: null, position: { x: 5 + randomInt(state, 2), y: 3 + randomInt(state, 2) } };
}
export function createMatch(config = {}) {
  const seed = String(config.seed ?? DEFAULT_SEED).slice(0, 80);
  const kits = matchKits(config.kitColors?.home, config.kitColors?.away);
  const state = {
    version: 2, seed, rng: seedHash(seed), round: 1, turnIndex: 0, activeId: null,
    phase: 'regular', finished: false, result: null, turns: 0, aids: [], calls: [], lastDecision: null,
    teams: [
      { id: 'home', kitColor: kits.home, name: config.teamNames?.home ?? 'Les Recrues', strategy: Object.hasOwn(STRATEGIES, config.strategy) ? config.strategy : 'balanced' },
      { id: 'away', kitColor: kits.away, name: config.teamNames?.away ?? 'Les Charognards', strategy: Object.hasOwn(STRATEGIES, config.awayStrategy) ? config.awayStrategy : 'balanced' },
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
          hp: profile.maxHp, position: startPosition(teamId, index), movement: profile.speed,
          reaction: true, action: true, interaction: true, pickedUp: false, prone: false,
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
function finish(state, events, winner) {
  state.finished = true;
  state.calls = [];
  for (const p of state.players) { p.classState.targetId = null; p.classState.flaw = 0; }
  state.result = { winnerId: winner?.teamId ?? null, carrierId: winner?.id ?? null, round: state.round,
    reason: winner ? 'possession' : 'draw' };
  const team = state.teams.find((t) => t.id === winner?.teamId);
  emit(state, events, 'finish', winner ? `${team.name} remportent le match : ${winner.name} possède la balle à la sirène.` : 'Match nul : la balle reste libre après le dernier engagement.');
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
      p.position = startPosition(p.teamId, p.number - 1); p.grappling = null; p.grappledBy = null; p.dodging = false;
      p.classState.targetId = null; p.classState.flaw = 0;
    }
    emit(state, events, 'restart', 'Dernier engagement au centre : un round pour contrôler la balle. PV et KO conservés.');
  }
  for (const p of state.players) p.reaction = p.hp > 0;
}
function advance(state, events) {
  state.turnIndex++;
  if (state.turnIndex === state.initiative.length) endRound(state, events);
}
function stepMutable(state) {
  const events = [];
  if (state.finished) return events;
  // Skip KO slots without granting turns or reactions. Also handles both teams entirely KO.
  let actor;
  while (!state.finished) {
    actor = state.players.find((p) => p.id === state.initiative[state.turnIndex]);
    if (actor?.hp > 0) break;
    advance(state, events);
  }
  if (state.finished) { assertInvariants(state); return events; }
  state.activeId = actor.id;
  state.turns++;
  beginTurn(state, actor, events);
  const useClassAction = (path = []) => {
    const choice = decideClassAction(state, actor, path);
    if (choice) resolveClassAction(state, actor, choice, events);
  };
  useClassAction();
  const decision = decideTurn(state, actor);
  state.lastDecision = { playerId: actor.id, reason: decision.reason, action: decision.action.type };
  emit(state, events, 'decision', `${actor.name} · ${decision.reason}`, { playerId: actor.id, action: decision.action.type });
  useClassAction(decision.path); moveAlong(state, actor, decision.path, events); useClassAction();
  if (actor.hp > 0) {
    // A reaction may remove possession during movement. Reconsider only actions legal
    // at the reached cell; a fresh full-turn plan could require another unexecuted path.
    let action = decision.action;
    if (action.technique && !legalAction(state, actor, action)) {
      const basic = { ...action }; delete basic.technique;
      if (legalAction(state, actor, basic)) action = basic;
    }
    if (!legalAction(state, actor, action)) {
      const revised = decideTurn(state, { ...actor, movement: 0 });
      action = revised.action;
      state.lastDecision = { playerId: actor.id, reason: revised.reason, action: action.type };
      emit(state, events, 'replan', `${actor.name} adapte son plan après le déplacement : ${revised.reason}`);
    }
    if (!resolveAction(state, actor, action, events)) throw new Error(`Action illégale du bot : ${actor.id} ${action.type}`);
    // An uncontested pickup is an interaction, so the actor still has their action.
    if (actor.action && actor.hp > 0) {
      const followup = decideTurn(state, actor);
      useClassAction(followup.path); moveAlong(state, actor, followup.path, events); useClassAction();
      if (actor.hp > 0) {
        const basic = { ...followup.action }; delete basic.technique;
        const next = legalAction(state, actor, followup.action) ? followup.action : legalAction(state, actor, basic) ? basic : { type: 'dodge' };
        if (!resolveAction(state, actor, next, events)) throw new Error(`Action de suivi illégale : ${actor.id}`);
      }
    }
    if (actor.grappling) {
      const held = state.players.find((p) => p.id === actor.grappling);
      emit(state, events, 'hold-position', `${actor.name} maintient sa prise sur ${held.name} et conserve sa position ; le mouvement restant n’est pas dépensé.`);
    } else {
      const path = decideMovement(state, actor); useClassAction(path); moveAlong(state, actor, path, events);
    }
  }
  endTurn(state, actor, events);
  assertInvariants(state);
  advance(state, events);
  assertInvariants(state);
  return events;
}
export function stepMatch(input) {
  const state = clone(input);
  return { state, events: stepMutable(state) };
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
