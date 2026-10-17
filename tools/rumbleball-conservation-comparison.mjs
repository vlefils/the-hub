// Compare the exact same strategy/opening/seed schedule before and after the policy change.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const baselinePath = resolve(root, process.argv[2] ?? 'rumbleball/playtests/strategies-mixed-openings-1000-2026-10-17.json');
const currentPath = resolve(root, process.argv[3] ?? 'rumbleball/playtests/conservation-passing-1000-2026-10-17.json');
const before = JSON.parse(readFileSync(baselinePath, 'utf8')), after = JSON.parse(readFileSync(currentPath, 'utf8'));
assert.equal(before.matches.length, after.matches.length);
for (const key of ['roster', 'seedPrefix', 'strategies', 'openings', 'level', 'fatigue', 'equipment', 'instructions']) {
  assert.deepEqual(before.method[key], after.method[key], `Different protocol: ${key}`);
}
for (const [file, hash] of Object.entries(before.sourcesSha256)) {
  if (file !== 'ai.mjs') assert.equal(after.sourcesSha256[file], hash, `Game rules changed: ${file}`);
}
let unchangedOtherStrategyGames = 0;
for (let i = 0; i < before.matches.length; i++) {
  const a = before.matches[i], b = after.matches[i];
  for (const key of ['seed', 'pairId', 'homeStrategy', 'awayStrategy', 'homeOpening', 'awayOpening']) assert.equal(a[key], b[key]);
  if (a.homeStrategy === 'possession' || a.awayStrategy === 'possession') continue;
  for (const key of ['winnerSide', 'koWin', 'rounds', 'turns', 'survivors']) assert.deepEqual(a[key], b[key]);
  for (const side of ['home', 'away']) for (const key of Object.keys(a.metrics[side])) assert.equal(a.metrics[side][key], b.metrics[side][key]);
  unchangedOtherStrategyGames++;
}
function conservation(matches) {
  const row = { appearances: 0, wins: 0, passesAttempted: 0, passesCompleted: 0, readyPasses: 0,
    reactionPasses: 0, relayMovementTurns: 0, relayReceptionsAfterMovement: 0, knockoutsTaken: 0 };
  for (const match of matches) for (const side of ['home', 'away']) {
    if (match[`${side}Strategy`] !== 'possession') continue;
    row.appearances++; row.wins += Number(match.winnerSide === side);
    for (const key of Object.keys(row)) if (key in match.metrics[side]) row[key] += match.metrics[side][key];
  }
  return row;
}
const result = {
  baseline: { path: baselinePath, aiSha256: before.sourcesSha256['ai.mjs'] },
  current: { path: currentPath, aiSha256: after.sourcesSha256['ai.mjs'] },
  unchangedOtherStrategyGames,
  full: { before: conservation(before.matches), after: conservation(after.matches) },
  holdout: { excludedCalibrationGames: 150, games: after.matches.length - 150,
    before: conservation(before.matches.slice(150)), after: conservation(after.matches.slice(150)) },
  passingChoiceRates: Object.fromEntries(Object.entries(after.byStrategy).map(([id, row]) =>
    [id, { actions: row.metrics.holderActions, passingChoices: row.metrics.holderPassingChoices,
      share: row.metrics.holderPassingChoices / row.metrics.holderActions }])),
};
const num = (n, digits = 1) => n.toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const pct = (n, total) => `${num(100 * n / total)} %`;
const statsTable = ({ before: a, after: b }) => {
  const labels = { appearances: 'Matchs joués par Conservation', wins: 'Victoires', passesAttempted: 'Passes tentées',
    passesCompleted: 'Passes réussies', readyPasses: 'Préparations', reactionPasses: 'Passes en réaction',
    relayMovementTurns: 'Courses de démarquage', relayReceptionsAfterMovement: 'Passes déclenchées après une course', knockoutsTaken: 'KO subis' };
  return '| Mesure | Avant | Après |\n|---|---:|---:|\n' + Object.entries(labels).map(([key, label]) => `| ${label} | ${a[key]} | ${b[key]} |`).join('\n');
};
const a = result.full.before, b = result.full.after;
const markdown = `# Conservation — circulation et démarquage\n\n`
  + `## Comportement\n\nConservation privilégie un relais libre capable d'enchaîner. Si aucun relais utile n'est disponible, le porteur cherche une position sans contact pour préparer la passe. Le déplacement vers cette préparation ne doit provoquer aucune opportunité. Le porteur reste à portée de ses receveurs, au lieu de maximiser uniquement sa sécurité individuelle.\n\n`
  + `Une préparation mobilise jusqu'à trois soutiens ; ils privilégient l'ouverture d'une ligne de passe sur une lutte secondaire. Aucun démarquage coordonné ne démarre sans passe préparée. Les cibles marquées, à terre ou immobilisées restent exclues, les passes courtes directes restent possibles et la priorité de circulation s'arrête avant les derniers rounds pour protéger la possession à la sirène.\n\n`
  + `## Même banc de 1 000 matchs avant/après\n\n${statsTable(result.full)}\n\n`
  + `Passes tentées par match de Conservation : **${num(a.passesAttempted / a.appearances, 2)} → ${num(b.passesAttempted / b.appearances, 2)}**. Courses de démarquage par match : **${num(a.relayMovementTurns / a.appearances, 2)} → ${num(b.relayMovementTurns / b.appearances, 2)}**. Victoires : **${pct(a.wins, a.appearances)} → ${pct(b.wins, b.appearances)}**.\n\n`
  + `Les ${unchangedOtherStrategyGames} matchs Équilibrée–Pressing reproduisent exactement leur résultat, leurs rounds, leurs tours, leurs survivants et tous les anciens compteurs. Les règles et les profils ont les mêmes empreintes ; seule la politique de décision change. Les adversaires de Conservation peuvent naturellement produire d'autres actions après ses nouveaux choix.\n\n`
  + `## Partie non utilisée pour l'ajustement\n\nLes 150 premiers matchs ont servi à ajuster le comportement. Les 850 suivants étaient réservés à la vérification :\n\n${statsTable(result.holdout)}\n\n`
  + `Ces mesures décrivent cette configuration ; elles ne sont pas une preuve de supériorité générale ou un test statistique du taux de victoire.\n\n`
  + `## Décisions lorsque le porteur peut dépenser son action\n\n| Stratégie | Actions avec ballon | Passes directes ou préparations | Part |\n|---|---:|---:|---:|\n`
  + Object.entries(result.passingChoiceRates).map(([id, row]) => `| ${after.byStrategy[id].name} | ${row.actions} | ${row.passingChoices} | ${pct(row.passingChoices, row.actions)} |`).join('\n')
  + `\n\nLes réactions sont exclues de ce dénominateur : la préparation a déjà consommé l'action. Les ramassages gratuits sont également exclus. Le volume total de passes dépend aussi du nombre de possessions et de joueurs encore debout ; ce tableau mesure le choix du porteur lorsqu'il peut agir.\n\n`
  + `Reproduction de cette comparaison : \`node tools/rumbleball-conservation-comparison.mjs\`. Le rapport du banc et son JSON conservent les configurations, les graines et tous les résultats.\n`;
after.comparison = result;
writeFileSync(currentPath, JSON.stringify(after, null, 2) + '\n');
const comparisonPath = resolve(root, 'rumbleball/playtests/conservation-passing-comparison-2026-10-17.md');
writeFileSync(comparisonPath, markdown);
console.log(JSON.stringify({ ...result, report: comparisonPath }, null, 2));
