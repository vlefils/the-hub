// Shared seeded bracket. Match results remain distinct from qualification:
// a draw after the existing overtime qualifies the better group seed.
export const playoffPlaces = count => Math.min(count, Math.ceil(count / 8) * 4);
export const playoffRoundName = matches => ({ 1: 'Finale', 2: 'Demi-finales', 4: 'Quarts de finale', 8: 'Huitièmes de finale' }[matches] ?? `Tour des ${matches * 2}`);
const copy = value => structuredClone(value);
const need = condition => { if (!condition) throw new Error('Tableau de playoffs invalide.'); };
function seedOrder(size) {
  let seeds = [1, 2];
  for (let n = 4; n <= size; n *= 2) seeds = seeds.flatMap(seed => [seed, n + 1 - seed]);
  return seeds;
}
function refresh(bracket) {
  for (let r = 1; r < bracket.rounds.length; r++) for (const [i, match] of bracket.rounds[r].matches.entries()) {
    match.homeId = bracket.rounds[r - 1].matches[i * 2].winnerId;
    match.awayId = bracket.rounds[r - 1].matches[i * 2 + 1].winnerId;
  }
  bracket.championId = bracket.rounds.at(-1).matches[0].winnerId;
  return bracket;
}
export function createPlayoffs(ranking, id) {
  need(Array.isArray(ranking) && ranking.length >= 2 && ranking.length <= 128 && new Set(ranking).size === ranking.length && ranking.every(id => typeof id === 'string' && id.length));
  const seeds = ranking.slice(0, playoffPlaces(ranking.length)), size = 2 ** Math.ceil(Math.log2(seeds.length)), order = seedOrder(size), rounds = [];
  for (let count = size / 2, r = 0; count >= 1; count /= 2, r++) rounds.push({ name: playoffRoundName(count), matches: Array.from({ length: count }, (_, i) => {
    const homeId = r ? null : seeds[order[i * 2] - 1] ?? null, awayId = r ? null : seeds[order[i * 2 + 1] - 1] ?? null;
    const bye = !r && (!homeId || !awayId);
    return { id: `${id}-r${r + 1}-m${i + 1}`, homeId, awayId, result: null, winnerId: bye ? homeId ?? awayId : null, decision: bye ? 'bye' : null };
  }) });
  return refresh({ id, seeds, size, rounds, championId: null });
}
export const currentPlayoffRound = bracket => bracket?.rounds.find(round => round.matches.some(match => !match.winnerId)) ?? null;
export const playoffFixtures = bracket => currentPlayoffRound(bracket)?.matches.filter(match => match.homeId && match.awayId && !match.winnerId) ?? [];
export function playoffWinner(bracket, homeId, awayId, winnerId) {
  return winnerId ?? (bracket.seeds.indexOf(homeId) < bracket.seeds.indexOf(awayId) ? homeId : awayId);
}
export function validFixtureResult(result, homeId, awayId, { allowForfeit = false } = {}) {
  if (!result || ![null, homeId, awayId].includes(result.winnerId)) return false;
  if (result.kind === 'forfeit' || result.kind === 'double-forfeit') return allowForfeit && result.round === 0 && (result.kind === 'forfeit' ? result.winnerId !== null : result.winnerId === null);
  return (result.kind === undefined || result.kind === 'played') && Number.isInteger(result.round) && result.round >= 1 && result.round <= 13;
}
export function settlePlayoffFixture(bracket, id, result, options = {}) {
  const match = playoffFixtures(bracket).find(match => match.id === id);
  need(match && validFixtureResult(result, match.homeId, match.awayId, options));
  match.result = copy(result); match.winnerId = playoffWinner(bracket, match.homeId, match.awayId, result.winnerId); match.decision = result.kind && result.kind !== 'played' ? result.kind : result.winnerId ? 'match' : 'ranking';
  return refresh(bracket);
}
export function validPlayoffs(bracket, ranking, id, options = {}) {
  try {
    const expected = createPlayoffs(ranking, id);
    need(bracket && bracket.id === id && bracket.size === expected.size && JSON.stringify(bracket.seeds) === JSON.stringify(expected.seeds) && bracket.rounds.length === expected.rounds.length);
    for (let r = 0; r < expected.rounds.length; r++) {
      const round = bracket.rounds[r]; need(round.name === expected.rounds[r].name && round.matches.length === expected.rounds[r].matches.length);
      for (let i = 0; i < round.matches.length; i++) {
        const match = round.matches[i], canonical = expected.rounds[r].matches[i];
        need(match.id === canonical.id && match.homeId === canonical.homeId && match.awayId === canonical.awayId);
        if (match.result !== null) settlePlayoffFixture(expected, match.id, match.result, options);
        need(match.winnerId === canonical.winnerId && match.decision === canonical.decision);
      }
    }
    need(bracket.championId === expected.championId); return true;
  } catch { return false; }
}
