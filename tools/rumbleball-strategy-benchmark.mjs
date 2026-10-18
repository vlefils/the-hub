// Cross the three strategies with all 25 opening combinations, then exchange sides.
// node tools/rumbleball-strategy-benchmark.mjs [--matches 1000] [--out report-prefix]
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PROFILES, STRATEGIES } from '../rumbleball/data.mjs';
import { OPENINGS, OPENING_IDS } from '../rumbleball/openings.mjs';
import { compilePlayer } from '../rumbleball/progression.mjs';
import { blankTally, measureMatch, oppositeSide, tallySide } from './rumbleball-benchmark-metrics.mjs';

const root = fileURLToPath(new URL('../', import.meta.url)), strategies = Object.keys(STRATEGIES);
let games = 1000, out = 'rumbleball/playtests/strategies-mixed-openings-1000-2026-10-17', seedPrefix = 'strategy-mix-2026-10-17-v1';
let sourceRef;
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === '--matches') games = Number(process.argv[++i]);
  else if (process.argv[i] === '--out') out = process.argv[++i];
  else if (process.argv[i] === '--seed-prefix') seedPrefix = process.argv[++i];
  else if (process.argv[i] === '--source-ref') sourceRef = process.argv[++i];
  else throw new Error(`Argument inconnu : ${process.argv[i]}`);
}
assert.ok(Number.isSafeInteger(games) && games >= 50 && games % 50 === 0, 'Nombre de matchs multiple de 50 requis.');
assert.ok(seedPrefix.length > 0 && seedPrefix.length <= 65, 'Préfixe de graine requis, 65 caractères maximum.');
let sourceDirectory = resolve(root, 'rumbleball');
const engineCommit = execFileSync('git', ['rev-parse', '--verify', `${sourceRef ?? 'HEAD'}^{commit}`], { cwd: root, encoding: 'utf8' }).trim();
if (sourceRef) {
  mkdirSync(resolve(root, 'output'), { recursive: true });
  sourceDirectory = mkdtempSync(resolve(root, 'output/strategy-snapshot-'));
  const files = execFileSync('git', ['ls-tree', '-r', '--name-only', engineCommit, 'rumbleball'], { cwd: root, encoding: 'utf8' })
    .trim().split(/\r?\n/).filter((f) => /^rumbleball\/[^/]+\.mjs$/.test(f) && !f.endsWith('.test.mjs'));
  for (const file of files) writeFileSync(resolve(sourceDirectory, file.slice('rumbleball/'.length)),
    execFileSync('git', ['show', `${engineCommit}:${file}`], { cwd: root, maxBuffer: 4 * 1024 * 1024 }));
}
const { createMatch, simulateMatch } = await import(pathToFileURL(resolve(sourceDirectory, 'engine.mjs')));
const prefix = resolve(root, out);
const roster = PROFILES.map((p, i) => compilePlayer({ id: `benchmark-${i}`, profile: i,
  name: p.trainingName, role: p.role, instruction: 'normal', xp: 0, fatigue: 0, implant: null }));
const strategyPairs = strategies.flatMap((a, i) => strategies.slice(i + 1).map((b) => [a, b]));
assert.equal(strategyPairs.length, 3);
const schedule = [];
for (let pairId = 0; pairId < games / 2; pairId++) {
  const [a, b] = strategyPairs[pairId % strategyPairs.length], cell = pairId % OPENING_IDS.length ** 2;
  const x = OPENING_IDS[Math.floor(cell / OPENING_IDS.length)], y = OPENING_IDS[cell % OPENING_IDS.length];
  const seed = `${seedPrefix}-${pairId}`;
  schedule.push({ seed, pairId, homeStrategy: a, awayStrategy: b, homeOpening: x, awayOpening: y },
    { seed, pairId, homeStrategy: b, awayStrategy: a, homeOpening: y, awayOpening: x });
}
const configFor = (s) => ({ seed: s.seed, strategy: s.homeStrategy, awayStrategy: s.awayStrategy,
  openings: { home: s.homeOpening, away: s.awayOpening },
  rosters: { home: structuredClone(roster), away: structuredClone(roster) } });
const hashSource = (source) => createHash('sha256').update(source.replaceAll('\r\n', '\n')).digest('hex');
const sourcesSha256 = Object.fromEntries(['engine.mjs', 'ai.mjs', 'rules.mjs', 'data.mjs', 'classes.mjs',
    'evasion.mjs', 'openings.mjs', 'deployment.mjs', 'progression.mjs'].filter((file) => existsSync(resolve(sourceDirectory, file))).map((file) => [file,
    hashSource(readFileSync(resolve(sourceDirectory, file), 'utf8'))]));
const committedSources = Object.entries(sourcesSha256).every(([file, hash]) => {
  try { return hashSource(execFileSync('git', ['show', `${engineCommit}:rumbleball/${file}`],
    { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })) === hash; }
  catch { return false; }
});
const report = { generatedAt: new Date().toISOString(),
  engineCommit: committedSources ? engineCommit : null, sourceBaseCommit: engineCommit,
  sourceRef: sourceRef ?? null, sourceState: committedSources ? 'verified-commit' : 'working-tree', sourcesSha256,
  method: { games, pairs: games / 2, strategies, openings: OPENING_IDS, seedPrefix, rulesVersion: 5,
    level: 1, fatigue: 0, equipment: false, instructions: 'normal', roster,
    description: 'Current AI on both sides. Only different strategies face each other. Rotate strategy pairs modulo 3 and ordered opening pairs modulo 25, then replay each seed exchanging both strategy and opening sides. All 75 strategy-pair/opening-pair strata receive floor(pairs/75) or ceil(pairs/75) scenarios. Each opening has equal total exposure. The standardized win rate gives equal weight to each opponent strategy and each own/opponent opening combination. No career progression.',
    koWinDefinition: 'Victory by possession with all five opponents KO at the end. No automatic KO victory exists.' },
  design: { byStrategyPair: {}, byOpeningPair: {}, byJointStratum: {} },
  totals: { games: 0, homeWins: 0, awayWins: 0, draws: 0, winsOpponentAllKo: 0, overtime: 0, rounds: 0, turns: 0,
    firstEngagementWinnerWins: 0, firstEngagementsUnclaimed: 0 },
  byStrategy: Object.fromEntries(strategies.map((id) => [id, { name: STRATEGIES[id], ...blankTally(),
    bySide: { home: blankTally(), away: blankTally() },
    versus: Object.fromEntries(strategies.filter((other) => other !== id).map((other) => [other, blankTally()])),
    byOpening: Object.fromEntries(OPENING_IDS.map((opening) => [opening, blankTally()])) }])), matches: [] };
// Counts are scenarios (seed pairs), not individual games.
for (let i = 0; i < schedule.length; i += 2) {
  const s = schedule[i], pair = `${s.homeStrategy}:${s.awayStrategy}`, opening = `${s.homeOpening}:${s.awayOpening}`;
  for (const [table, key] of [[report.design.byStrategyPair, pair], [report.design.byOpeningPair, opening],
    [report.design.byJointStratum, `${pair}:${opening}`]]) table[key] = (table[key] ?? 0) + 1;
}
assert.equal(new Set(schedule.map((s) => `${s.seed}:${s.homeStrategy}:${s.awayStrategy}`)).size, games);
assert.equal(Object.keys(report.design.byOpeningPair).length, 25);
assert.ok(Object.values(report.design.byOpeningPair).every((n) => n === games / 50));
if (games >= 150) {
  assert.equal(Object.keys(report.design.byJointStratum).length, 75);
  assert.ok(Math.max(...Object.values(report.design.byJointStratum)) - Math.min(...Object.values(report.design.byJointStratum)) <= 1);
}
// Every formation and strategy uses the exact same five compiled profiles.
for (const strategy of strategies) for (const opening of OPENING_IDS) {
  const state = createMatch(configFor({ seed: 'strategy-equivalence', homeStrategy: strategy, awayStrategy: 'balanced', homeOpening: opening, awayOpening: 'breakaway' }));
  const profile = ({ id, teamId, position, startPosition, initiative, initiativeDie, initiativeTie, ...rest }) => rest;
  for (let i = 0; i < 5; i++) assert.deepEqual(profile(state.players[i]), profile(state.players[i + 5]));
}
const startedAt = performance.now();
for (const scenario of schedule) {
  const result = measureMatch(configFor(scenario), simulateMatch), match = { ...scenario, ...result,
    winnerStrategy: result.winnerSide ? scenario[`${result.winnerSide}Strategy`] : null };
  const t = report.totals; t.games++; t[match.winnerSide ? `${match.winnerSide}Wins` : 'draws']++;
  t.winsOpponentAllKo += Number(match.koWin); t.overtime += Number(match.rounds > 10);
  t.rounds += match.rounds; t.turns += match.turns;
  t.firstEngagementsUnclaimed += Number(!match.firstEngagement);
  t.firstEngagementWinnerWins += Number(Boolean(match.firstEngagement && match.winnerSide === match.firstEngagement));
  for (const side of ['home', 'away']) {
    const row = report.byStrategy[scenario[`${side}Strategy`]], opening = scenario[`${side}Opening`];
    for (const tally of [row, row.bySide[side], row.byOpening[opening], row.versus[scenario[`${oppositeSide(side)}Strategy`]]]) tallySide(tally, match, side);
  }
  report.matches.push(match);
  if (t.games % 50 === 0) console.log(`${t.games}/${games} matchs — ${((performance.now() - startedAt) / 1000).toFixed(1)} s`);
}
report.simulationSeconds = (performance.now() - startedAt) / 1000;
assert.equal(report.matches.length, games); assert.equal(report.totals.homeWins + report.totals.awayWins + report.totals.draws, games);
for (const row of Object.values(report.byStrategy)) {
  assert.equal(row.bySide.home.appearances, row.bySide.away.appearances);
  assert.equal(row.wins + row.losses + row.draws, row.appearances);
  assert.equal(Object.values(row.byOpening).reduce((sum, r) => sum + r.appearances, 0), row.appearances);
}
for (const opening of OPENING_IDS) assert.equal(Object.values(report.byStrategy).reduce((sum, row) => sum + row.byOpening[opening].appearances, 0), games * 2 / 5);
const sumMetric = (key) => Object.values(report.byStrategy).reduce((n, r) => n + r.metrics[key], 0);
assert.equal(sumMetric('damageDealt'), sumMetric('damageTaken')); assert.equal(sumMetric('knockouts'), sumMetric('knockoutsTaken'));
assert.equal(Object.values(report.byStrategy).reduce((n, r) => n + r.wins, 0), games - report.totals.draws);

// Equal weight for the 2 opponents x 5 own openings x 5 opponent openings.
// This removes the small 6-versus-7-scenario imbalance in the 1,000-game run.
const strata = Object.fromEntries(strategies.map((id) => [id, new Map()]));
for (const match of report.matches) for (const side of ['home', 'away']) {
  const id = match[`${side}Strategy`], opponent = oppositeSide(side);
  const key = `${match[`${opponent}Strategy`]}:${match[`${side}Opening`]}:${match[`${opponent}Opening`]}`;
  const tally = strata[id].get(key) ?? { games: 0, wins: 0 };
  tally.games++; tally.wins += Number(match.winnerSide === side); strata[id].set(key, tally);
}
for (const id of strategies) {
  const groups = [...strata[id].values()];
  report.byStrategy[id].standardizedWinRate = groups.length === 50
    ? groups.reduce((sum, t) => sum + t.wins / t.games, 0) / groups.length : null;
  if (games >= 150) assert.equal(groups.length, 50);
}
const rows = Object.values(report.byStrategy).sort((a, b) =>
  (b.standardizedWinRate ?? b.wins / b.appearances) - (a.standardizedWinRate ?? a.wins / a.appearances));
const num = (n, digits = 1) => n.toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const pct = (n, total) => total ? `${num(100 * n / total)} %` : '—';
const tables = {
  results: '| Stratégie | Matchs joués | V | N | D | Victoires brutes | Taux à pondération égale | Dont cinq adversaires KO |\n|---|---:|---:|---:|---:|---:|---:|---:|\n'
    + rows.map((r) => `| ${r.name} | ${r.appearances} | ${r.wins} | ${r.draws} | ${r.losses} | ${pct(r.wins, r.appearances)} | ${r.standardizedWinRate === null ? '—' : pct(r.standardizedWinRate, 1)} | ${r.winsOpponentAllKo} |`).join('\n'),
  ball: '| Stratégie | Passes réussies/tentées | Réussite | Passes tentées/match | Préparations | Passes en réaction | Courses de démarquage | Passe après course | Récupérations | Arrachements réussis/tentés |\n|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|\n'
    + rows.map((r) => { const m = r.metrics; return `| ${r.name} | ${m.passesCompleted}/${m.passesAttempted} | ${pct(m.passesCompleted, m.passesAttempted)} | ${num(m.passesAttempted / r.appearances, 2)} | ${m.readyPasses} | ${m.reactionPasses} | ${m.relayMovementTurns} | ${m.relayReceptionsAfterMovement} | ${m.recoveries} | ${m.stripsCompleted}/${m.stripsAttempted} |`; }).join('\n'),
  combat: '| Stratégie | KO infligés | KO subis | KO infligés/match | Attaques normales/match | Opportunités | Frappes qui touchent | PV retirés/match | Luttes réussies/tentées | Survivants moyens |\n|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|\n'
    + rows.map((r) => { const m = r.metrics; return `| ${r.name} | ${m.knockouts} | ${m.knockoutsTaken} | ${num(m.knockouts / r.appearances, 2)} | ${num(m.attacks / r.appearances)} | ${m.opportunities} | ${pct(m.hits, m.attacks + m.opportunities)} | ${num(m.damageDealt / r.appearances)} | ${m.grapplesCompleted}/${m.grapplesAttempted} | ${num(r.survivors / r.appearances, 2)} |`; }).join('\n'),
  decisions: '| Stratégie | Actions avec ballon | Passes directes ou préparations | Part de ces actions |\n|---|---:|---:|---:|\n'
    + rows.map((r) => `| ${r.name} | ${r.metrics.holderActions} | ${r.metrics.holderPassingChoices} | ${pct(r.metrics.holderPassingChoices, r.metrics.holderActions)} |`).join('\n'),
  matchups: '| Taux de victoire de la ligne contre la colonne | ' + strategies.map((id) => STRATEGIES[id]).join(' | ') + ' |\n|---|' + strategies.map(() => '---:|').join('') + '\n'
    + strategies.map((id) => `| ${STRATEGIES[id]} | ${strategies.map((other) => { const r = report.byStrategy[id].versus[other]; return r ? `${pct(r.wins, r.appearances)} (${r.wins}/${r.appearances})` : '—'; }).join(' | ')} |`).join('\n'),
  openings: '| Stratégie | Ouverture | Matchs joués | Victoires | Dont cinq adversaires KO | Passes réussies/tentées | Courses de démarquage |\n|---|---|---:|---:|---:|---:|---:|\n'
    + strategies.flatMap((id) => OPENING_IDS.map((opening) => { const r = report.byStrategy[id].byOpening[opening], m = r.metrics; return `| ${STRATEGIES[id]} | ${OPENINGS[opening].name} | ${r.appearances} | ${pct(r.wins, r.appearances)} (${r.wins}) | ${r.winsOpponentAllKo} | ${m.passesCompleted}/${m.passesAttempted} | ${m.relayMovementTurns} |`; })).join('\n'),
};
const markdown = `# Rumbleball — ${games} matchs entre stratégies, ouvertures mélangées\n\n`
  + `Moteur : \`${report.engineCommit ?? `copie de travail basée sur ${report.sourceBaseCommit} ; empreintes dans le JSON`}\`. Simulation : **${num(report.simulationSeconds)} secondes**.\n\n`
  + `## Protocole\n\n${games} matchs, ${games / 2} scénarios joués deux fois avec stratégie et ouverture échangées entre les côtés. Équilibrée, Conservation et Pressing s'affrontent ; aucun match n'oppose une stratégie à elle-même. Les trois duels reçoivent chacun ${Object.values(report.design.byStrategyPair).sort((a, b) => a - b).join(' / ')} scénarios. Le nombre d'apparitions diffère donc légèrement ; les comparaisons utilisent des taux et des moyennes par match.\n\n`
  + `Les 25 combinaisons d'ouvertures sont toutes utilisées, chacune sur ${games / 50} scénarios. Chacune des cinq ouvertures compte ${games * 2 / 5} apparitions au total. ${games >= 150 ? `Chaque duel de stratégies rencontre chacune des 25 combinaisons d'ouvertures sur ${Math.min(...Object.values(report.design.byJointStratum))} à ${Math.max(...Object.values(report.design.byJointStratum))} scénarios.` : 'Cet échantillon de calibration ne couvre pas encore toutes les 75 associations duel–ouvertures.'} La répartition stratégie–ouverture reste aussi proche que possible ; le détail est donné plus bas. Les deux matchs d'un scénario ont la même graine.\n\n`
  + `Mêmes profils des deux côtés : Nora (Capitaine/relais), Brique (Bélier/bloqueur), Zip (Escamoteur/porteur), Étau (Bélier/récupérateur), Vigie (Passeur/défenseur). Niveau 1, consignes normales, aucune fatigue ni équipement, aucune progression entre rencontres. Le moteur vérifie les invariants à chaque tour.\n\n`
  + `## Résultats\n\n${tables.results}\n\nLe taux à pondération égale donne le même poids à chacun des deux adversaires et à chacune des 25 combinaisons d'ouvertures : moyenne de 50 taux de victoire, pour corriger le léger déséquilibre entre sous-groupes. Il n'est calculé que si les 50 sous-groupes sont présents.\n\nLa colonne KO compte les victoires à la possession où les cinq adversaires sont KO à la fin. Le moteur n'accorde aucune victoire automatique par KO. Un match alimente les statistiques de ses deux équipes : les apparitions totalisent ${games * 2}.\n\n`
  + `## Ballon et démarquage\n\n${tables.ball}\n\nLes passes incluent les actions directes, les réactions et les suivis de ramassage. Une course de démarquage est un tour affecté au relais avec un déplacement réel. « Passe après course » compte un déclenchement en réaction après ce déplacement, même si le jet échoue. Récupérations = prises hors réception de passe, dont engagement, interception, arrachement et ramassage.\n\n`
  + `## Choix avec ballon\n\n${tables.decisions}\n\nActions réellement dépensées par le porteur, après ramassage ou réception le cas échéant. Les passes en réaction ne sont pas comptées une deuxième fois : la préparation a déjà coûté l'action. Cette mesure distingue le choix de jeu avec ballon du volume total de passes, qui dépend aussi des occasions de possession. La possession est reconstruite à partir des événements et vérifiée contre l'état réel après chaque tour.\n\n`
  + `## Combat\n\n${tables.combat}\n\nLes PV retirés sont les pertes effectives, après absorption et sans surcompter les dégâts excédant les PV restants. Le taux de frappe inclut les attaques normales et les opportunités.\n\n`
  + `## Confrontations directes\n\n${tables.matchups}\n\n## Stratégies selon l'ouverture\n\n${tables.openings}\n\n`
  + `Ces sous-groupes décrivent les interactions observées avec les ouvertures ; leurs adversaires et graines diffèrent. Ils ne suffisent pas à prouver isolément qu'une ouverture cause un meilleur résultat. Les matchs d'une paire partagent la graine et ne doivent pas être considérés comme indépendants.\n\n`
  + `## Totaux et reproduction\n\n${report.totals.homeWins} victoires à domicile, ${report.totals.awayWins} à l'extérieur, ${report.totals.draws} nuls ; ${report.totals.winsOpponentAllKo} victoires avec cinq adversaires KO, ${report.totals.overtime} prolongations. Rounds moyens : ${num(report.totals.rounds / games, 2)} ; tours joués moyens : ${num(report.totals.turns / games, 2)}.\n\n`
  + `Reproduction : \`node tools/rumbleball-strategy-benchmark.mjs --matches ${games} --seed-prefix ${seedPrefix}${sourceRef ? ` --source-ref ${sourceRef}` : ''} --out ${out.replaceAll('\\', '/')}\`, avec les sources de jeu du commit indiqué. Le JSON voisin conserve le plan d'expérience, les empreintes des sources et les ${games} résultats.\n`;
mkdirSync(dirname(prefix), { recursive: true });
writeFileSync(`${prefix}.json`, JSON.stringify(report, null, 2) + '\n'); writeFileSync(`${prefix}.md`, markdown);
console.log(JSON.stringify({ totals: report.totals, simulationSeconds: report.simulationSeconds,
  byStrategy: rows.map(({ name, appearances, wins, losses, draws, winsOpponentAllKo, standardizedWinRate, metrics }) =>
    ({ name, appearances, wins, losses, draws, winsOpponentAllKo, standardizedWinRate, metrics })), report: `${prefix}.md` }, null, 2));
