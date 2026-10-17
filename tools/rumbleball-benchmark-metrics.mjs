import assert from 'node:assert/strict';
import { simulateMatch } from '../rumbleball/engine.mjs';

export const blankMetrics = () => ({ passesAttempted: 0, passesCompleted: 0, directPasses: 0, reactionPasses: 0,
  readyPasses: 0, relayTurns: 0, relayMovementTurns: 0, relayReceptionsAfterMovement: 0,
  attacks: 0, opportunities: 0, hits: 0, damageDealt: 0, damageTaken: 0, knockouts: 0, knockoutsTaken: 0,
  recoveries: 0, groundPickupsAttempted: 0, groundPickupsCompleted: 0,
  stripsAttempted: 0, stripsCompleted: 0, grapplesAttempted: 0, grapplesCompleted: 0, dodges: 0, dashes: 0,
  holderActions: 0, holderPassingChoices: 0 });
export const blankTally = () => ({ appearances: 0, wins: 0, losses: 0, draws: 0, winsOpponentAllKo: 0,
  eliminatedOpponent: 0, teamAllKo: 0, survivors: 0, overtime: 0, firstEngagementWon: 0,
  winsAfterFirstEngagement: 0, roundOnePossession: 0, metrics: blankMetrics() });
export const oppositeSide = (side) => side === 'home' ? 'away' : 'home';
const sideOf = (id) => id?.startsWith('home-') ? 'home' : id?.startsWith('away-') ? 'away' : null;

// Count executed actions, including nested reaction passes and pickup follow-ups.
// No hooks, dice consumption, AI replacement, or changes to the production engine.
export function measureMatch(config) {
  const metrics = { home: blankMetrics(), away: blankMetrics() }, hp = new Map();
  let firstEngagement, roundOneHolder = null;
  let observedCarrier = null;
  const { state } = simulateMatch(config, (state, events) => {
    for (const p of state.players) {
      const lost = (hp.get(p.id) ?? p.maxHp) - p.hp;
      assert.ok(lost >= 0, 'No healing or return from KO is expected.');
      metrics[p.teamId].damageTaken += lost; metrics[oppositeSide(p.teamId)].damageDealt += lost; hp.set(p.id, p.hp);
    }
    const decision = events.find((e) => e.type === 'decision');
    if (decision?.task === 'relay') {
      const stats = metrics[sideOf(decision.playerId)]; stats.relayTurns++;
      const moved = events.findIndex((e) => e.type === 'move' && e.playerId === decision.playerId);
      if (moved >= 0) {
        stats.relayMovementTurns++;
        if (events.slice(moved + 1).some((e) => e.type === 'ready-trigger' && e.targetId === decision.playerId)) stats.relayReceptionsAfterMovement++;
      }
    }
    let currentAction = null;
    for (const event of events) {
      if (event.resolvedAction) currentAction = event.resolvedAction;
      if (event.type === 'engagement-result' && firstEngagement === undefined) firstEngagement = sideOf(event.playerId);
      if (event.type === 'round-end' && event.round === 1) roundOneHolder = sideOf(state.ball.carrierId);
      const action = event.resolvedAction, actionStats = action && metrics[sideOf(action.playerId)];
      if (actionStats) {
        if (observedCarrier === action.playerId && !action.reaction && !['pickup', 'drop', 'release'].includes(action.type)) {
          actionStats.holderActions++;
          actionStats.holderPassingChoices += Number(['pass', 'ready-pass'].includes(action.type));
        }
        if (action.type === 'pass') actionStats[action.reaction ? 'reactionPasses' : 'directPasses']++;
        if (action.type === 'pickup' && !action.atCenter) actionStats.groundPickupsAttempted++;
        if (action.type === 'strip') actionStats.stripsAttempted++;
        if (action.type === 'grapple') actionStats.grapplesAttempted++;
      }
      const side = sideOf(event.playerId), stats = metrics[side];
      if (event.type === 'attack') stats.attacks++;
      if (event.type === 'opportunity') stats.opportunities++;
      if (event.type === 'damage') metrics[oppositeSide(side)].hits++;
      if (event.type === 'ready-pass') stats.readyPasses++;
      if (event.type === 'dodge') metrics[sideOf(event.actorId)].dodges++;
      if (event.type === 'dash') metrics[sideOf(event.actorId)].dashes++;
      if (event.type === 'grapple') metrics[sideOf(event.actorId)].grapplesCompleted++;
      if (event.type === 'possession' && event.reason === 'arrache') stats.stripsCompleted++;
      if (event.type === 'possession' && currentAction?.type === 'pickup' && !currentAction.atCenter
        && event.playerId === currentAction.playerId) stats.groundPickupsCompleted++;
      if (event.type === 'possession') observedCarrier = event.playerId;
      if (event.type === 'drop') observedCarrier = null;
    }
    assert.equal(observedCarrier, state.ball.carrierId, 'Possession reconstructed from events must match the real state.');
  });
  assert.equal(state.finished, true); assert.ok(state.round >= 10 && state.round <= 13);
  const survivors = Object.fromEntries(['home', 'away'].map((side) => [side,
    state.players.filter((p) => p.teamId === side && p.hp > 0).length]));
  const winnerSide = state.result.winnerId;
  for (const side of ['home', 'away']) {
    const stats = metrics[side], opponent = oppositeSide(side);
    for (const key of ['passesAttempted', 'passesCompleted', 'knockouts', 'recoveries']) stats[key] = state.stats[side][key];
    stats.knockoutsTaken = state.stats[opponent].knockouts;
    assert.equal(stats.knockouts, 5 - survivors[opponent]);
    assert.equal(stats.directPasses + stats.reactionPasses, stats.passesAttempted);
    assert.ok(stats.passesCompleted <= stats.passesAttempted && stats.hits <= stats.attacks + stats.opportunities);
    assert.ok(stats.groundPickupsCompleted <= stats.groundPickupsAttempted);
    assert.ok(stats.stripsCompleted <= stats.stripsAttempted && stats.grapplesCompleted <= stats.grapplesAttempted);
    assert.ok(stats.holderPassingChoices <= stats.holderActions);
  }
  return { winnerSide, koWin: Boolean(winnerSide && survivors[oppositeSide(winnerSide)] === 0),
    firstEngagement: firstEngagement ?? null, roundOneHolder, rounds: state.round, turns: state.turns, survivors, metrics };
}

export function tallySide(tally, match, side) {
  const opponent = oppositeSide(side);
  tally.appearances++; tally.wins += Number(match.winnerSide === side); tally.losses += Number(match.winnerSide === opponent);
  tally.draws += Number(!match.winnerSide); tally.winsOpponentAllKo += Number(match.winnerSide === side && match.koWin);
  tally.eliminatedOpponent += Number(match.survivors[opponent] === 0); tally.teamAllKo += Number(match.survivors[side] === 0);
  tally.survivors += match.survivors[side]; tally.overtime += Number(match.rounds > 10);
  tally.firstEngagementWon += Number(match.firstEngagement === side);
  tally.winsAfterFirstEngagement += Number(match.firstEngagement === side && match.winnerSide === side);
  tally.roundOnePossession += Number(match.roundOneHolder === side);
  for (const key of Object.keys(tally.metrics)) tally.metrics[key] += match.metrics[side][key];
}
