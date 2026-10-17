// Current engine against itself: a balanced round robin of the five deployment openings.
// node tools/rumbleball-opening-benchmark.mjs [--matches 1000] [--out report-prefix]
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMatch, simulateMatch } from '../rumbleball/engine.mjs';
import { PROFILES } from '../rumbleball/data.mjs';
import { OPENINGS, OPENING_IDS } from '../rumbleball/openings.mjs';
import { compilePlayer } from '../rumbleball/progression.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
let games = 1000, out = 'rumbleball/playtests/openings-1000-2026-10-17';
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === '--matches') games = Number(process.argv[++i]);
  else if (process.argv[i] === '--out') out = process.argv[++i];
  else throw new Error(`Argument inconnu : ${process.argv[i]}`);
}
const perMatchup = games / OPENING_IDS.length ** 2;
assert.ok(Number.isSafeInteger(perMatchup) && perMatchup > 0, 'Nombre de matchs multiple de 25 requis.');
const prefix = resolve(root, out), seedPrefix = 'opening-bench-2026-10-17-v1';
const roster = PROFILES.map((profile, i) => compilePlayer({ id: `benchmark-${i}`, profile: i,
  name: profile.trainingName, role: profile.role, instruction: 'normal', xp: 0, fatigue: 0, implant: null }));
const configFor = ({ seed, home, away }) => ({ seed, strategy: 'balanced', awayStrategy: 'balanced',
  openings: { home, away }, rosters: { home: structuredClone(roster), away: structuredClone(roster) } });
const schedule = [];
for (let a = 0; a < OPENING_IDS.length; a++) for (let b = a; b < OPENING_IDS.length; b++) {
  for (let i = 0; i < perMatchup; i++) {
    const seed = `${seedPrefix}-${a}-${b}-${i}`, home = OPENING_IDS[a], away = OPENING_IDS[b];
    schedule.push({ seed, home, away });
    // Identical openings already put the opening on both sides. Do not replay
    // that identical configuration and count a duplicate as another sample.
    if (a !== b) schedule.push({ seed, home: away, away: home });
  }
}
assert.equal(schedule.length, games);
assert.equal(new Set(schedule.map((m) => `${m.seed}:${m.home}:${m.away}`)).size, games);

const blankMetrics = () => ({ passesAttempted: 0, passesCompleted: 0, directPasses: 0, reactionPasses: 0,
  readyPasses: 0, relayTurns: 0, relayMovementTurns: 0, relayReceptionsAfterMovement: 0,
  attacks: 0, opportunities: 0, hits: 0, damageDealt: 0, damageTaken: 0, knockouts: 0, knockoutsTaken: 0,
  recoveries: 0, groundPickupsAttempted: 0, groundPickupsCompleted: 0,
  stripsAttempted: 0, stripsCompleted: 0, grapplesAttempted: 0, grapplesCompleted: 0, dodges: 0, dashes: 0 });
const blankTally = () => ({ appearances: 0, wins: 0, losses: 0, draws: 0, winsOpponentAllKo: 0,
  eliminatedOpponent: 0, teamAllKo: 0, survivors: 0, overtime: 0, firstEngagementWon: 0,
  winsAfterFirstEngagement: 0, roundOnePossession: 0 });
const report = {
  generatedAt: new Date().toISOString(),
  engineCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  sourcesSha256: Object.fromEntries(['engine.mjs', 'ai.mjs', 'rules.mjs', 'data.mjs', 'classes.mjs',
    'openings.mjs', 'deployment.mjs', 'progression.mjs'].map((file) => [file,
    createHash('sha256').update(readFileSync(resolve(root, 'rumbleball', file), 'utf8').replaceAll('\r\n', '\n')).digest('hex')])),
  method: { games, perOrderedMatchup: perMatchup, openings: OPENING_IDS, strategy: 'balanced', rulesVersion: 5,
    level: 1, fatigue: 0, equipment: false, instructions: 'normal', seedPrefix, roster,
    mirroredCrossOpeningPairs: schedule.filter((m) => m.home !== m.away).length / 2,
    distinctSelfOpeningGames: schedule.filter((m) => m.home === m.away).length,
    koWinDefinition: 'Winner has possession at the final whistle AND all five opponents have 0 HP. No automatic KO victory exists.',
    description: 'Current AI on both sides. Every ordered opening combination gets the same number of games. Cross-opening scenarios share a seed with their side-swapped counterpart; self-opening scenarios use distinct seeds and are never duplicated. No career progression. Jeu libre has no imposed opening and is excluded.' },
  totals: { games: 0, homeWins: 0, awayWins: 0, draws: 0, winsOpponentAllKo: 0, bothTeamsAllKo: 0,
    overtime: 0, rounds: 0, turns: 0, firstEngagementsUnclaimed: 0, firstEngagementWinnerWins: 0 },
  byOpening: Object.fromEntries(OPENING_IDS.map((id) => [id, { name: OPENINGS[id].name, ...blankTally(),
    metrics: blankMetrics(), bySide: { home: blankTally(), away: blankTally() },
    versus: Object.fromEntries(OPENING_IDS.map((other) => [other, blankTally()])) }])),
  matches: [],
};
// Verify equivalent profiles and valid half-court deployment before measuring.
for (const home of OPENING_IDS) for (const away of OPENING_IDS) {
  const state = createMatch(configFor({ seed: 'opening-equivalence', home, away }));
  const profile = ({ id, teamId, position, startPosition, initiative, initiativeDie, initiativeTie, ...rest }) => rest;
  for (let i = 0; i < 5; i++) assert.deepEqual(profile(state.players[i]), profile(state.players[i + 5]));
}
const simulationStart = performance.now();
for (const scenario of schedule) {
  const metrics = { home: blankMetrics(), away: blankMetrics() }, hp = new Map();
  const sideOf = (id) => id?.startsWith('home-') ? 'home' : id?.startsWith('away-') ? 'away' : null;
  const other = (side) => side === 'home' ? 'away' : 'home';
  let firstEngagement, roundOneHolder = null;
  const match = simulateMatch(configFor(scenario), (state, events) => {
    for (const p of state.players) {
      const lost = (hp.get(p.id) ?? p.maxHp) - p.hp;
      assert.ok(lost >= 0, 'No healing or return from KO is expected.');
      metrics[p.teamId].damageTaken += lost; metrics[other(p.teamId)].damageDealt += lost; hp.set(p.id, p.hp);
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
        if (action.type === 'pass') actionStats[action.reaction ? 'reactionPasses' : 'directPasses']++;
        if (action.type === 'pickup' && !action.atCenter) actionStats.groundPickupsAttempted++;
        if (action.type === 'strip') actionStats.stripsAttempted++;
        if (action.type === 'grapple') actionStats.grapplesAttempted++;
      }
      const side = sideOf(event.playerId), stats = metrics[side];
      if (event.type === 'attack') stats.attacks++;
      if (event.type === 'opportunity') stats.opportunities++;
      if (event.type === 'damage') metrics[other(side)].hits++;
      if (event.type === 'ready-pass') stats.readyPasses++;
      if (event.type === 'dodge') metrics[sideOf(event.actorId)].dodges++;
      if (event.type === 'dash') metrics[sideOf(event.actorId)].dashes++;
      if (event.type === 'grapple') metrics[sideOf(event.actorId)].grapplesCompleted++;
      if (event.type === 'possession' && event.reason === 'arrache') stats.stripsCompleted++;
      if (event.type === 'possession' && currentAction?.type === 'pickup' && !currentAction.atCenter
        && event.playerId === currentAction.playerId) stats.groundPickupsCompleted++;
    }
  });
  const state = match.state, winner = state.result.winnerId;
  assert.equal(state.finished, true); assert.ok(state.round >= 10 && state.round <= 13);
  const survivors = Object.fromEntries(['home', 'away'].map((side) => [side,
    state.players.filter((p) => p.teamId === side && p.hp > 0).length]));
  const koWin = Boolean(winner && survivors[other(winner)] === 0);
  report.totals.games++; report.totals[winner ? `${winner}Wins` : 'draws']++;
  report.totals.winsOpponentAllKo += Number(koWin);
  report.totals.bothTeamsAllKo += Number(survivors.home === 0 && survivors.away === 0);
  report.totals.overtime += Number(state.round > 10); report.totals.rounds += state.round; report.totals.turns += state.turns;
  report.totals.firstEngagementsUnclaimed += Number(!firstEngagement);
  report.totals.firstEngagementWinnerWins += Number(Boolean(firstEngagement && winner === firstEngagement));
  for (const side of ['home', 'away']) {
    const opponent = other(side), stats = metrics[side], row = report.byOpening[scenario[side]];
    for (const key of ['passesAttempted', 'passesCompleted', 'knockouts', 'recoveries']) stats[key] = state.stats[side][key];
    stats.knockoutsTaken = state.stats[opponent].knockouts;
    assert.equal(stats.knockouts, 5 - survivors[opponent]);
    assert.equal(stats.directPasses + stats.reactionPasses, stats.passesAttempted);
    assert.ok(stats.passesCompleted <= stats.passesAttempted && stats.hits <= stats.attacks + stats.opportunities);
    assert.ok(stats.groundPickupsCompleted <= stats.groundPickupsAttempted);
    assert.ok(stats.stripsCompleted <= stats.stripsAttempted && stats.grapplesCompleted <= stats.grapplesAttempted);
    for (const tally of [row, row.bySide[side], row.versus[scenario[opponent]]]) {
      tally.appearances++; tally.wins += Number(winner === side); tally.losses += Number(winner === opponent); tally.draws += Number(!winner);
      tally.winsOpponentAllKo += Number(winner === side && koWin); tally.eliminatedOpponent += Number(survivors[opponent] === 0);
      tally.teamAllKo += Number(survivors[side] === 0); tally.survivors += survivors[side]; tally.overtime += Number(state.round > 10);
      tally.firstEngagementWon += Number(firstEngagement === side);
      tally.winsAfterFirstEngagement += Number(firstEngagement === side && winner === side);
      tally.roundOnePossession += Number(roundOneHolder === side);
    }
    for (const key of Object.keys(stats)) row.metrics[key] += stats[key];
  }
  report.matches.push({ ...scenario, winnerSide: winner, winnerOpening: winner ? scenario[winner] : null,
    koWin, firstEngagement, roundOneHolder, rounds: state.round, turns: state.turns, survivors, metrics });
  if (report.totals.games % 50 === 0) console.log(`${report.totals.games}/${games} matchs — ${((performance.now() - simulationStart) / 1000).toFixed(1)} s`);
}
report.simulationSeconds = (performance.now() - simulationStart) / 1000;
assert.equal(report.totals.games, games);
assert.equal(report.totals.homeWins + report.totals.awayWins + report.totals.draws, games);
for (const row of Object.values(report.byOpening)) {
  assert.equal(row.appearances, games * 2 / OPENING_IDS.length);
  assert.equal(row.bySide.home.appearances, row.bySide.away.appearances);
  assert.equal(row.wins + row.losses + row.draws, row.appearances);
  for (const matchup of Object.values(row.versus)) assert.equal(matchup.appearances, perMatchup * 2);
}
const rows = Object.values(report.byOpening).sort((a, b) => b.wins - a.wins || a.name.localeCompare(b.name));
const num = (n, digits = 1) => n.toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const pct = (n, total) => total ? `${num(100 * n / total)} %` : '—';
const tables = {
  results: '| Ouverture | Matchs joués | V | N | D | Victoires | Dont adversaire entièrement KO | Victoires hors miroirs |\n|---|---:|---:|---:|---:|---:|---:|---:|\n'
    + rows.map((r) => `| ${r.name} | ${r.appearances} | ${r.wins} | ${r.draws} | ${r.losses} | ${pct(r.wins, r.appearances)} | ${r.winsOpponentAllKo} | ${pct(r.wins - r.versus[OPENING_IDS.find((id) => report.byOpening[id] === r)].wins, r.appearances - perMatchup * 2)} |`).join('\n'),
  ball: '| Ouverture | Passes réussies/tentées | Réussite | Passes tentées/match | Préparations | Passes en réaction | Courses de démarquage | Passe après course | Récupérations | Arrachements réussis/tentés |\n|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|\n'
    + rows.map((r) => { const m = r.metrics; return `| ${r.name} | ${m.passesCompleted}/${m.passesAttempted} | ${pct(m.passesCompleted, m.passesAttempted)} | ${num(m.passesAttempted / r.appearances, 2)} | ${m.readyPasses} | ${m.reactionPasses} | ${m.relayMovementTurns} | ${m.relayReceptionsAfterMovement} | ${m.recoveries} | ${m.stripsCompleted}/${m.stripsAttempted} |`; }).join('\n'),
  combat: '| Ouverture | KO infligés | KO subis | KO infligés/match | Attaques normales/match | Opportunités | Frappes qui touchent | PV retirés/match | Luttes réussies/tentées | Survivants moyens |\n|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|\n'
    + rows.map((r) => { const m = r.metrics; return `| ${r.name} | ${m.knockouts} | ${m.knockoutsTaken} | ${num(m.knockouts / r.appearances, 2)} | ${num(m.attacks / r.appearances)} | ${m.opportunities} | ${pct(m.hits, m.attacks + m.opportunities)} | ${num(m.damageDealt / r.appearances)} | ${m.grapplesCompleted}/${m.grapplesAttempted} | ${num(r.survivors / r.appearances, 2)} |`; }).join('\n'),
  opening: '| Ouverture | Engagements gagnés | Victoires après engagement gagné | Balle en fin du round 1 | Équipe entièrement KO | Matchs en prolongation |\n|---|---:|---:|---:|---:|---:|\n'
    + rows.map((r) => `| ${r.name} | ${r.firstEngagementWon}/${r.appearances} | ${pct(r.winsAfterFirstEngagement, r.firstEngagementWon)} | ${r.roundOnePossession}/${r.appearances} | ${r.teamAllKo} | ${r.overtime} |`).join('\n'),
  matchups: '| Taux de victoire de la ligne contre la colonne | ' + OPENING_IDS.map((id) => OPENINGS[id].name).join(' | ') + ' |\n|---|' + OPENING_IDS.map(() => '---:|').join('') + '\n'
    + OPENING_IDS.map((id) => `| ${OPENINGS[id].name} | ${OPENING_IDS.map((other) => { const t = report.byOpening[id].versus[other]; return pct(t.wins, t.appearances); }).join(' | ')} |`).join('\n'),
};
const markdown = `# Rumbleball — ${games} matchs, comparaison des ouvertures\n\n`
  + `Moteur : \`${report.engineCommit}\`. Simulation : **${num(report.simulationSeconds)} secondes**.\n\n`
  + `## Protocole\n\n${games} rencontres, ${perMatchup} par combinaison ordonnée des cinq ouvertures, soit ${games * 2 / OPENING_IDS.length} apparitions par ouverture, moitié à domicile et moitié à l'extérieur. Les ${report.method.mirroredCrossOpeningPairs} scénarios opposant deux ouvertures différentes sont rejoués avec les ouvertures échangées. Les ${report.method.distinctSelfOpeningGames} rencontres avec la même ouverture des deux côtés utilisent des graines distinctes : aucun doublon de configuration. Un match alimente les statistiques de ses deux équipes ; les apparitions totalisent donc ${games * 2}.\n\n`
  + `Effectifs strictement identiques : Nora (Capitaine/relais), Brique (Bélier/bloqueur), Zip (Escamoteur/porteur), Étau (Bélier/récupérateur), Vigie (Passeur/défenseur). Niveau 1, consignes normales, aucune fatigue ni équipement, plan collectif **Équilibré** commun. Le placement initial et l'ouverture varient ensemble. Jeu libre n'impose pas d'ouverture et n'est pas inclus. Les invariants du moteur sont vérifiés à chaque tour.\n\n`
  + `## Résultats\n\n${tables.results}\n\n**KO** : le moteur ne déclare aucune victoire automatique par KO. La colonne compte les victoires à la possession où les cinq adversaires sont KO à la fin. « Hors miroirs » retire les matchs avec la même ouverture des deux côtés.\n\n`
  + `## Ballon et démarquage\n\n${tables.ball}\n\nLes passes incluent les passes directes et en réaction. Une course de démarquage est un tour affecté au relais comprenant un déplacement réel. « Passe après course » compte un déclenchement après le mouvement, même si le jet échoue. Les réactions vers un joueur déjà libre au début de son tour n'entrent pas dans cette dernière colonne. Récupérations = prises de possession hors réception de passe, dont engagement, interception, arrachement et ramassage.\n\n`
  + `## Combat\n\n${tables.combat}\n\nLes PV retirés sont les pertes effectives, après absorption et sans compter les dégâts excédant les PV restants. Le taux de frappe inclut attaques normales et opportunités.\n\n`
  + `## Engagement et survie\n\n${tables.opening}\n\n## Confrontations directes\n\n${tables.matchups}\n\nChaque cellule repose sur ${perMatchup * 2} apparitions d'équipe. La diagonale comporte ${perMatchup} rencontres communes aux deux équipes, donc ${perMatchup * 2} apparitions.\n\n`
  + `## Totaux et reproduction\n\n${report.totals.homeWins} victoires à domicile, ${report.totals.awayWins} à l'extérieur, ${report.totals.draws} nuls ; ${report.totals.winsOpponentAllKo} victoires avec les cinq adversaires KO, ${report.totals.bothTeamsAllKo} matchs avec les deux équipes entièrement KO, ${report.totals.overtime} prolongations. Rounds moyens : ${num(report.totals.rounds / games, 2)} ; tours joués moyens : ${num(report.totals.turns / games, 2)}.\n\n`
  + `Les deux matchs d'un même scénario partagent la graine et ne sont pas indépendants. Ces chiffres décrivent ce protocole avec ces profils et ce plan collectif ; ils ne démontrent pas qu'une ouverture est supérieure dans tous les effectifs ou toutes les tactiques.\n\n`
  + `Reproduction depuis la racine : \`node tools/rumbleball-opening-benchmark.mjs --matches ${games} --out ${out.replaceAll('\\', '/')}\`, avec les sources de jeu du commit indiqué. Le JSON voisin conserve la configuration, les empreintes de sources et chaque résultat.\n`;
mkdirSync(dirname(prefix), { recursive: true });
writeFileSync(`${prefix}.json`, JSON.stringify(report, null, 2) + '\n');
writeFileSync(`${prefix}.md`, markdown);
console.log(JSON.stringify({ totals: report.totals, simulationSeconds: report.simulationSeconds,
  byOpening: rows.map(({ name, appearances, wins, draws, losses, winsOpponentAllKo, metrics }) =>
    ({ name, appearances, wins, draws, losses, winsOpponentAllKo, metrics })), report: `${prefix}.md` }, null, 2));
