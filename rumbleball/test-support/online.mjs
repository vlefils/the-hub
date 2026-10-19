import { startLeague, editPreparation, nextLock } from '../online/league.mjs';

// Existing match tests start after managers have explicitly confirmed six offers.
export function startReadyLeague(input, owner, now, options = { firstMatchAt: nextLock(now) }) {
  let state = startLeague(input, owner, now, options);
  for (const member of state.members) if (member.initialRecruitment) state = editPreparation(state, member.userId, 'initialRecruit', { playerIds: member.club.market.slice(0, 6).map(p => p.id) }, now);
  return state;
}
