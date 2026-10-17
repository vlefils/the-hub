// Uncertainty for mirrored duels: the independent unit is a seed's two games.
// node tools/rumbleball-duel-statistics.mjs report.json [previous-independent.json] [--same-seeds baseline.json]
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Under the null, exchange the old/new labels together within each seed pair.
// Integer weights also support draws, with half a point for each team.
export function pairedPermutationP(differences) {
  assert.ok(differences.every((value) => Number.isInteger(value) && Math.abs(value) <= 4));
  const observed = Math.abs(differences.reduce((sum, value) => sum + value, 0));
  let probabilities = new Map([[0, 1]]);
  for (const difference of differences) {
    const weight = Math.abs(difference);
    if (!weight) continue;
    const next = new Map();
    for (const [sum, probability] of probabilities) for (const sign of [-1, 1]) {
      const value = sum + sign * weight;
      next.set(value, (next.get(value) ?? 0) + probability / 2);
    }
    probabilities = next;
  }
  const mass = [...probabilities.values()].reduce((sum, value) => sum + value, 0);
  assert.ok(Math.abs(mass - 1) < 1e-10);
  return Math.min(1, [...probabilities].filter(([sum]) => Math.abs(sum) >= observed)
    .reduce((sum, [, probability]) => sum + probability, 0));
}

export function analyzeDuels(report) {
  const pairs = new Map(), strata = new Map();
  const tally = { old: 0, new: 0, draws: 0 };
  assert.equal(report.matches.length, report.method.games);
  for (const match of report.matches) {
    assert.ok(Object.hasOwn(tally, match.winner));
    tally[match.winner]++;
    const key = `${match.strategy}:${match.seed}`;
    if (!pairs.has(key)) pairs.set(key, []);
    pairs.get(key).push(match);
  }
  assert.deepEqual(tally, report.results);
  assert.equal(pairs.size * 2, report.matches.length);
  const differences = [], pairedResults = { favorsOld: 0, favorsNew: 0, tied: 0 };
  for (const matches of pairs.values()) {
    assert.equal(matches.length, 2);
    assert.deepEqual(matches.map((m) => m.newSide).sort(), ['away', 'home']);
    const points = matches.reduce((sum, m) => sum + (m.winner === 'new' ? 1 : m.winner === 'draws' ? .5 : 0), 0);
    const difference = 2 * points - 2;
    differences.push(difference);
    pairedResults[difference > 0 ? 'favorsNew' : difference < 0 ? 'favorsOld' : 'tied']++;
    const strategy = matches[0].strategy;
    if (!strata.has(strategy)) strata.set(strategy, []);
    strata.get(strategy).push(points / 2);
  }
  // Stratified variance of the mean pair score. No independence assumption is
  // made between the two games sharing a seed; strata weights match the run.
  let variance = 0;
  const byStrategy = {};
  for (const [strategy, values] of strata) {
    assert.ok(values.length >= 2, 'At least two seed pairs per strategy for uncertainty estimation');
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const sampleVariance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
    const weight = values.length / pairs.size;
    variance += weight ** 2 * sampleVariance / values.length;
    byStrategy[strategy] = { pairs: values.length, newScoreShare: mean };
  }
  const newScoreShare = (tally.new + tally.draws / 2) / report.matches.length;
  const standardError = Math.sqrt(variance), margin95 = 1.959963984540054 * standardError;
  const interval95 = [Math.max(0, newScoreShare - margin95), Math.min(1, newScoreShare + margin95)];
  return { games: report.matches.length, pairs: pairs.size, results: tally, newScoreShare,
    standardError, margin95, interval95, pairedPermutationP: pairedPermutationP(differences),
    pairedResults, byStrategy,
    method: 'Normal 95% interval using stratified variance across seed pairs; exact two-sided sign-flip permutation of version labels within pairs. Draw = half a point. Assumes exchangeability under the null and independent seed scenarios, not independent mirrored games.',
  };
}

export function compareCampaigns(report, baseline) {
  assert.equal(report.matches.length, baseline.matches.length);
  assert.equal(report.refs.old, baseline.refs.old);
  assert.deepEqual(report.method.roster, baseline.method.roster);
  for (const key of ['rulesVersion', 'level', 'fatigue', 'equipment', 'instructions']) assert.equal(report.method[key], baseline.method[key]);
  const keyOf = (m) => `${m.strategy}:${m.seed}:${m.newSide}`;
  const previous = new Map(baseline.matches.map((m) => [keyOf(m), m]));
  assert.equal(previous.size, baseline.matches.length);
  const score = (m) => m.winner === 'new' ? 1 : m.winner === 'draws' ? .5 : 0;
  const pairs = new Map(), strata = new Map();
  let improved = 0, worsened = 0, unchanged = 0;
  for (const match of report.matches) {
    const before = previous.get(keyOf(match)); assert.ok(before, 'Every game must match the baseline seed, tactic and side');
    const difference = score(match) - score(before);
    if (difference > 0) improved++; else if (difference < 0) worsened++; else unchanged++;
    const pairKey = `${match.strategy}:${match.seed}`;
    if (!pairs.has(pairKey)) pairs.set(pairKey, { strategy: match.strategy, differences: [] });
    pairs.get(pairKey).differences.push(difference);
  }
  const differences = [];
  for (const pair of pairs.values()) {
    assert.equal(pair.differences.length, 2);
    const sum = pair.differences.reduce((a, b) => a + b, 0);
    differences.push(2 * sum);
    if (!strata.has(pair.strategy)) strata.set(pair.strategy, []);
    strata.get(pair.strategy).push(sum / 2);
  }
  let delta = 0, variance = 0;
  for (const values of strata.values()) {
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const weight = values.length / pairs.size;
    delta += weight * mean;
    variance += weight ** 2 * values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1) / values.length;
  }
  const margin95 = 1.959963984540054 * Math.sqrt(variance);
  return { baselineResults: baseline.results, currentResults: report.results, games: report.matches.length,
    delta, margin95, interval95: [Math.max(-1, delta - margin95), Math.min(1, delta + margin95)],
    improved, worsened, unchanged, pairedPermutationP: pairedPermutationP(differences),
    method: 'Before/after differences on the exact same seed, side and tactic, grouped by mirrored seed pairs and stratified by tactic. The two games sharing a seed are kept together.',
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const file = resolve(process.argv[2]);
  const report = JSON.parse(readFileSync(file, 'utf8'));
  report.statistics = analyzeDuels(report);
  if (process.argv[3] && !process.argv[3].startsWith('--')) {
    const previous = JSON.parse(readFileSync(resolve(process.argv[3]), 'utf8'));
    const previousSeeds = new Set(previous.matches.map((match) => match.seed));
    assert.ok(report.matches.every((match) => !previousSeeds.has(match.seed)), 'Confirmation must use entirely fresh seeds');
    report.statistics.previousSample = analyzeDuels(previous);
  }
  const comparisonArg = process.argv.indexOf('--same-seeds');
  if (comparisonArg >= 0) report.statistics.comparison = compareCampaigns(report,
    JSON.parse(readFileSync(resolve(process.argv[comparisonArg + 1]), 'utf8')));
  const pct = (value) => (100 * value).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const stats = report.statistics;
  const p = stats.pairedPermutationP < .0001 ? stats.pairedPermutationP.toExponential(3) : stats.pairedPermutationP.toFixed(4);
  const conclusion = stats.interval95[1] < .5 && stats.pairedPermutationP < .05
    ? 'La nouvelle IA est en retrait sur ce protocole : son intervalle est sous 50 % et le test par paire rejette l’égalité au seuil de 5 %.'
    : stats.interval95[0] > .5 && stats.pairedPermutationP < .05
      ? 'La nouvelle IA est en avance sur ce protocole : son intervalle est au-dessus de 50 % et le test par paire rejette l’égalité au seuil de 5 %.'
      : 'Cet échantillon ne permet pas de conclure à un avantage au seuil de 5 % avec les deux vérifications retenues.';
  const previous = stats.previousSample;
  const comparison = stats.comparison;
  const section = `\n## Incertitude et comparaison\n\n` +
    `Part de points de la nouvelle IA (victoire = 1, nul = 0,5) : **${pct(stats.newScoreShare)} %**. ${report.results.draws === 0 ? 'Sans nul, il s’agit également de son taux de victoire. ' : ''}` +
    `Intervalle de confiance approximatif à 95 % : **${pct(stats.interval95[0])}–${pct(stats.interval95[1])} %**, soit ±${pct(stats.margin95)} points.\n\n` +
    `Les deux matchs d’une même graine sont traités comme une paire dépendante. La variance est calculée sur les ${stats.pairs} paires, en conservant la répartition des tactiques. Test de permutation exact par paire, bilatéral : **p = ${p}**. Ce p décrit les résultats aussi extrêmes sous l’hypothèse d’échangeabilité des versions ; ce n’est pas la probabilité que l’hypothèse soit vraie.\n\n` +
    `Paires favorables à l’ancienne IA : ${stats.pairedResults.favorsOld} ; à la nouvelle : ${stats.pairedResults.favorsNew} ; à égalité : ${stats.pairedResults.tied}.\n\n` +
    `${conclusion}\n\n` +
    (previous ? `Premier échantillon séparé de ${previous.games} matchs : nouvelle IA ${pct(previous.newScoreShare)} %, intervalle ${pct(previous.interval95[0])}–${pct(previous.interval95[1])} %. Les nouvelles graines ne recoupent aucune des précédentes ; les premiers matchs ne sont pas inclus dans les ${stats.games} de confirmation.\n\n` : '') +
    (comparison ? `Comparaison avant/après sur les mêmes ${comparison.games} matchs : **${comparison.baselineResults.new} → ${comparison.currentResults.new} victoires** de la nouvelle IA. Variation de sa part de points : **${pct(comparison.delta)} points**, intervalle à 95 % de **${pct(comparison.interval95[0])} à ${pct(comparison.interval95[1])} points**. ${comparison.improved} résultats améliorés, ${comparison.worsened} dégradés, ${comparison.unchanged} inchangés. Les différences avant/après sont également regroupées par paire de graines.\n\n` : '') +
    `Ces estimations portent sur les tirages de ce protocole, avec ces cinq profils de niveau 1 et ces trois tactiques. Elles ne mesurent pas la performance sur tous les effectifs possibles et n’isolent pas la cause d’un éventuel écart.\n\n` +
    `Calcul reproductible : \`node tools/rumbleball-duel-statistics.mjs ${file.replaceAll('\\', '/')}${comparisonArg >= 0 ? ` --same-seeds ${process.argv[comparisonArg + 1].replaceAll('\\', '/')}` : ''}\`.\n`;
  const markdownFile = file.replace(/\.json$/, '.md');
  assert.notEqual(markdownFile, file, 'Expected .json input');
  const existing = readFileSync(markdownFile, 'utf8').split('\n## Incertitude et comparaison')[0];
  writeFileSync(file, JSON.stringify(report, null, 2) + '\n');
  writeFileSync(markdownFile, existing.trimEnd() + '\n' + section);
  console.log(JSON.stringify({ ...stats, conclusion, timing: report.timing }, null, 2));
}
