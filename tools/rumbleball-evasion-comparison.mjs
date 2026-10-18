// Paired comparison of held-out matches. No simulation or tuning occurs here.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { STRATEGIES } from '../rumbleball/data.mjs';
import { OPENINGS } from '../rumbleball/openings.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const beforePath = process.argv[2] ?? 'rumbleball/playtests/evasion-before-1000-2026-10-17.json';
const afterPath = process.argv[3] ?? 'rumbleball/playtests/evasion-after-1000-2026-10-17.json';
const out = process.argv[4] ?? 'rumbleball/playtests/evasion-comparison-2026-10-18';
const read = (path) => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
const before = read(beforePath), after = read(afterPath);
assert.equal(before.matches.length, after.matches.length);
for (const key of ['games', 'pairs', 'roster', 'seedPrefix', 'strategies', 'openings', 'rulesVersion', 'level', 'fatigue', 'equipment', 'instructions']) {
  assert.deepEqual(before.method[key], after.method[key], `Different protocol: ${key}`);
}
for (const key of ['data.mjs', 'classes.mjs', 'openings.mjs', 'deployment.mjs', 'progression.mjs']) {
  assert.equal(before.sourcesSha256[key], after.sourcesSha256[key], `Different profiles or rules: ${key}`);
}
const pairs = new Map();
let otherGames = 0, otherWinnerChanges = 0;
for (let i = 0; i < before.matches.length; i++) {
  const a = before.matches[i], b = after.matches[i];
  for (const key of ['seed', 'pairId', 'homeStrategy', 'awayStrategy', 'homeOpening', 'awayOpening']) assert.equal(a[key], b[key]);
  const side = ['home', 'away'].find((s) => a[`${s}Strategy`] === 'possession');
  if (!side) { otherGames++; otherWinnerChanges += Number(a.winnerSide !== b.winnerSide); continue; }
  const pair = pairs.get(a.pairId) ?? { n: 0, before: 0, after: 0 };
  pair.n++; pair.before += Number(a.winnerSide === side); pair.after += Number(b.winnerSide === side);
  pairs.set(a.pairId, pair);
}
const samples = [...pairs.values()];
samples.forEach((p) => assert.equal(p.n, 2, 'Keep mirrored games together.'));
// Bootstrap whole seed pairs, preserving the before/after and side pairing.
let randomState = 0x18e7a510;
const random = () => ((randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0) / 2 ** 32);
const deltas = Array.from({ length: 10000 }, () => {
  let gain = 0;
  for (let i = 0; i < samples.length; i++) {
    const pair = samples[Math.floor(random() * samples.length)]; gain += pair.after - pair.before;
  }
  return gain / (samples.length * 2);
}).sort((a, b) => a - b);
const a = before.byStrategy.possession, b = after.byStrategy.possession;
const result = { baseline: { path: beforePath, commit: before.engineCommit }, current: { path: afterPath, commit: after.engineCommit },
  seedPrefix: after.method.seedPrefix, comparisonGames: after.matches.length, conservationAppearances: b.appearances,
  conservationPairs: samples.length, before: a, after: b,
  winRateGain: b.wins / b.appearances - a.wins / a.appearances,
  pairedBootstrap: { samples: 10000, seed: '0x18e7a510', unit: 'mirrored seed pair', percentile95: [deltas[249], deltas[9749]] },
  sharedEngineFix: { otherGames, otherWinnerChanges } };
assert.equal(samples.length * 2, b.appearances);
const num = (value, digits = 1) => value.toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const pct = (row) => `${num(row.wins / row.appearances * 100)} % (${row.wins}/${row.appearances})`;
const perGame = (key) => [num(a.metrics[key] / a.appearances, 2), num(b.metrics[key] / b.appearances, 2)];
const table = (header, rows) => `| ${header.join(' | ')} |\n|${header.map(() => '---').join('|')}|\n`
  + rows.map((row) => `| ${row.join(' | ')} |`).join('\n');
const stats = table(['Conservation', 'Avant', 'Après'], [
  ['Victoires', pct(a), pct(b)],
  ['Victoires avec les cinq adversaires KO', a.winsOpponentAllKo, b.winsOpponentAllKo],
  ['KO subis / match', ...perGame('knockoutsTaken')],
  ['PV perdus / match', ...perGame('damageTaken')],
  ['Passes tentées / match', ...perGame('passesAttempted')],
  ['Passes réussies', `${a.metrics.passesCompleted}/${a.metrics.passesAttempted} (${num(a.metrics.passesCompleted / a.metrics.passesAttempted * 100)} %)`,
    `${b.metrics.passesCompleted}/${b.metrics.passesAttempted} (${num(b.metrics.passesCompleted / b.metrics.passesAttempted * 100)} %)`],
  ['Passes préparées / match', ...perGame('readyPasses')],
  ['Courses de démarquage / match', ...perGame('relayMovementTurns')],
  ['Passes en réaction après une course', a.metrics.relayReceptionsAfterMovement, b.metrics.relayReceptionsAfterMovement],
  ['Attaques normales / match', ...perGame('attacks')],
  ['Luttes réussies / match', ...perGame('grapplesCompleted')],
]);
const opponents = table(['Adversaire', 'Avant', 'Après'], Object.keys(b.versus).map((id) => [STRATEGIES[id], pct(a.versus[id]), pct(b.versus[id])]));
const openings = table(['Ouverture de Conservation', 'Avant', 'Après'], Object.keys(b.byOpening).map((id) => [OPENINGS[id].name, pct(a.byOpening[id]), pct(b.byOpening[id])]));
const sides = table(['Côté', 'Avant', 'Après'], ['home', 'away'].map((side) => [side === 'home' ? 'Gauche' : 'Droite', pct(a.bySide[side]), pct(b.bySide[side])]));
const report = `# Conservation : éviter la pression et protéger la possession\n\n`
  + `La nouvelle politique gagne **${pct(b)}**, contre **${pct(a)}** pour l'ancienne, sur les mêmes rencontres. Le gain est de **${num(result.winRateGain * 100)} points**. Elle subit moins de dégâts et de KO. Elle obtient ce résultat avec **moins de passes et davantage de combat ciblé** : ce n'est pas une stratégie de fuite généralisée ou de circulation permanente.\n\n`
  + `## Diagnostic\n\n`
  + `La priorité générale au combat pendant six rounds envoyait aussi les joueurs mobiles au contact. À l'inverse, reculer sans neutraliser les poursuivants échouait sur ce terrain de 12 × 8 cases. La sécurité d'une case doit dépendre des adversaires capables de la rejoindre avant le prochain tour, pas seulement de l'absence de contact immédiat.\n\n`
  + `Forcer les relais multipliait les risques : une passe non contestée reste un jet DD 10, et un bloqueur sans aide n'a que 55 % de réussite. Autre défaut concret : après une réception pendant sa course, le nouveau porteur était réévalué avec zéro mouvement pour choisir son action. Il pouvait encore se déplacer après l'action, mais ne pouvait pas exploiter son mouvement restant pour se replacer avant celle-ci.\n\n`
  + `## Comportement mis en place\n\n`
  + `- **Porteur** : compare les cases accessibles, les réactions sur le trajet et les attaques possibles avant son prochain tour. Il choisit désengagement avant fuite, sprint vers une zone réellement plus sûre, ou esquive et déplacement normal. Il reste à portée d'aide.\n`
  + `- **Partenaires** : les bloqueurs peuvent agripper les poursuivants ; les autres concentrent leurs frappes sur une cible utile et se replacent quand le trajet le permet. Ils évitent de rester seuls dans la mêlée. Ce sont des choix tactiques, sans nouvelle capacité d'écran.\n`
  + `- **Relais** : passe directe vers un joueur debout, libre et sans adversaire adjacent. L'initiative, la sécurité du receveur et les chances du jet comptent. Une préparation n'est envisagée qu'avec une possibilité de réception avant son expiration. Les démarquages coordonnés restent conditionnés à une préparation active.\n`
  + `- **Techniques** : le Passeur peut dépenser sa concentration pour fiabiliser un relais en réaction ; le Capitaine peut soutenir une préparation. Les coûts restent identiques et aucun avantage ne se cumule.\n`
  + `- **Réception** : le moteur exécute maintenant le nouveau déplacement prévu avec le mouvement effectivement restant avant de dépenser l'action. Cette correction bénéficie à toutes les stratégies v5 ; la réception reste gratuite.\n`
  + `- **Fin de match** : les priorités de circulation s'arrêtent aux rounds 9–10 au profit de la conservation à la sirène. Le ramassage libre et les missions de récupération continuent d'utiliser les règles communes.\n\n`
  + `Le plan utilise les positions, caractéristiques, terrain, réactions et initiative publics. Il n'accède à aucun jet futur. Il s'agit d'une estimation tactique optimisée par essais, pas d'une recherche exhaustive garantissant l'optimum. Les consignes individuelles prudentes/agressives continuent de s'appliquer aux non-porteurs.\n\n`
  + `## Validation indépendante des réglages\n\n`
  + `**1 000 matchs avant + 1 000 matchs après**, mêmes graines, effectifs et placements. Chaque version oppose Équilibrée, Conservation et Pressing entre elles : Conservation participe à 666 rencontres, soit 333 scénarios joués avec les côtés échangés. Les cinq ouvertures sont mélangées sur les 25 combinaisons ordonnées. Les profils sont identiques des deux côtés, niveau 1, sans équipement ni fatigue, consignes normales.\n\n`
  + `Les réglages préalables ont utilisé un autre banc de 150 matchs. Aucune graine du banc présent n'a servi aux réglages. Le taux pondéré donnant le même poids aux adversaires et aux combinaisons d'ouvertures passe de ${num(a.standardizedWinRate * 100)} % à ${num(b.standardizedWinRate * 100)} %.\n\n`
  + `${stats}\n\n${opponents}\n\n${sides}\n\n${openings}\n\n`
  + `Le gain est observé contre les deux adversaires, des deux côtés et pour les cinq ouvertures. Un bootstrap apparié de 10 000 rééchantillonnages des **333 paires entières**, gardant ensemble les côtés et versions, donne un intervalle empirique à 95 % de **+${num(deltas[249] * 100)} à +${num(deltas[9749] * 100)} points** pour le gain brut. Cet intervalle décrit ces profils et ce protocole ; il ne garantit pas le même résultat pour toute composition.\n\n`
  + `Les victoires avec cinq adversaires KO restent des victoires à la possession, jamais une nouvelle condition de victoire. Les courses comptées sont les déplacements réellement exécutés avec une mission de relais ; les replis défensifs ne sont pas des démarquages.\n\n`
  + `Le correctif de mouvement après réception est commun : ${otherWinnerChanges} des ${otherGames} rencontres Équilibrée–Pressing changent aussi de vainqueur. La comparaison mesure donc l'ensemble livré (politique et correction d'exécution), sans isoler la contribution de chaque changement.\n\n`
  + `## Autres compositions et limites\n\n`
  + `Un audit séparé de 150 matchs, avec compositions toujours symétriques, donne **31/50 victoires** avec une équipe mobile, **25/50** avec cinq profils de contact et **26/50** avec des vétérans niveau 5, fatigués et équipés. Ce sont de petits échantillons descriptifs : le gain de 63 % du banc principal ne se généralise pas tel quel. Détails : [audit des profils](evasion-profiles-150-2026-10-17.json).\n\n`
  + `La conservation devient plus efficace, mais le volume de passes et de démarquages baisse nettement. Les règles récompensent la possession finale et rendent chaque passe risquée ; elles n'offrent pas de bénéfice au simple fait de faire circuler. Si l'objectif est aussi un spectacle riche en passes, ce résultat ne remplit pas à lui seul cet objectif. Aucun bonus de caractéristique, coût d'action, DD ou règle de victoire n'a été changé pour favoriser cette politique.\n\n`
  + `## Reproduction et sources\n\n`
  + `Avant : ${before.engineCommit}. Après : ${after.engineCommit}. Les JSON conservent les empreintes SHA-256 et les résultats individuels. Durées de simulation : ${num(before.simulationSeconds)} s et ${num(after.simulationSeconds)} s, avec d'autres vérifications en parallèle ; elles ne constituent pas un banc de performance isolé.\n\n`
  + `- [Banc avant](evasion-before-1000-2026-10-17.md) · [données avant](evasion-before-1000-2026-10-17.json)\n`
  + `- [Banc après](evasion-after-1000-2026-10-17.md) · [données après](evasion-after-1000-2026-10-17.json)\n\n`
  + 'Recalcul de cette comparaison : `node tools/rumbleball-evasion-comparison.mjs`. Audit de compositions : `node tools/rumbleball-evasion-profile-audit.mjs`. Tests : `cd rumbleball; node --test`.\n';
writeFileSync(resolve(root, `${out}.json`), JSON.stringify(result, null, 2) + '\n');
writeFileSync(resolve(root, `${out}.md`), report);
console.log(JSON.stringify({ gain: result.winRateGain, interval: result.pairedBootstrap.percentile95, otherWinnerChanges, out }));
