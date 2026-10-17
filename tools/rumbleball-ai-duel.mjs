// Historical versus current AI, in the same match, with mirrored equivalent teams.
// Run: node tools/rumbleball-ai-duel.mjs [report-prefix] [--matches 1000] [--seed-prefix NAME] [--new-ai FILE]
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const startedAt = performance.now();
let games = 100, seedPrefix = 'ai-duel-2026-10-17', reportPrefix, newAiFile;
for (let i = 2; i < process.argv.length; i++) {
  const arg = process.argv[i];
  if (arg === '--matches') games = Number(process.argv[++i]);
  else if (arg === '--seed-prefix') seedPrefix = process.argv[++i];
  else if (arg === '--new-ai') newAiFile = resolve(root, process.argv[++i]);
  else if (!arg.startsWith('--') && !reportPrefix) reportPrefix = arg;
  else throw new Error(`Argument inconnu : ${arg}`);
}
assert.ok(Number.isSafeInteger(games) && games >= 6 && games % 2 === 0, 'Nombre pair de matchs, au moins 6.');
assert.ok(typeof seedPrefix === 'string' && seedPrefix.length > 0 && seedPrefix.length <= 45, 'Préfixe de graines requis, 45 caractères maximum.');
const pairedScenarios = games / 2;
const strategies = ['balanced', 'possession', 'pressing'];
const schedule = strategies.map((strategy, i) => [strategy,
  Math.floor(pairedScenarios / 3) + Number(i < pairedScenarios % 3)]);
const refs = { old: '514181f', new: 'b8276fa' };
const sources = new Map(), modules = new Map();
const moduleUrl = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
function sourceAt(ref, file) {
  const key = `${ref}:${file}`;
  if (!sources.has(key)) sources.set(key, execFileSync('git', ['show', `${ref}:rumbleball/${file}`], {
    cwd: root, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024,
  }));
  return sources.get(key);
}
function rewrite(source, ref, overrides = {}) {
  return source.replace(/from '(\.\/[^']+)'/g, (_, path) =>
    `from ${JSON.stringify(overrides[path] ?? snapshotModule(ref, path.slice(2)))}`);
}
function snapshotModule(ref, file) {
  const key = `${ref}:${file}`;
  if (!modules.has(key)) modules.set(key, moduleUrl(rewrite(sourceAt(ref, file), ref)));
  return modules.get(key);
}

const variantSource = newAiFile ? readFileSync(newAiFile, 'utf8').replaceAll('\r\n', '\n') : null;
const newAiUrl = variantSource ? moduleUrl(rewrite(variantSource, refs.new)) : snapshotModule(refs.new, 'ai.mjs');
const dispatcherUrl = moduleUrl(`
  import * as oldAi from ${JSON.stringify(snapshotModule(refs.old, 'ai.mjs'))};
  import * as newAi from ${JSON.stringify(newAiUrl)};
  let policies = { home: 'new', away: 'new' }, counts = {};
  export function setPolicies(next) { policies = next; counts = { old: 0, new: 0 }; }
  export function callCounts() { return { ...counts }; }
  export function usesNewAi(actor) { return policies[actor.teamId] === 'new'; }
  function call(name, state, actor, ...args) {
    const policy = policies[actor.teamId]; counts[policy]++;
    return (policy === 'old' ? oldAi : newAi)[name](state, actor, ...args);
  }
  export const decideTurn = (state, actor) => call('decideTurn', state, actor);
  export const decideMovement = (state, actor) => call('decideMovement', state, actor);
  export const decideClassAction = (state, actor, path) => call('decideClassAction', state, actor, path);
`);
const dispatcher = await import(dispatcherUrl);
let mixedSource = sourceAt(refs.new, 'engine.mjs');
const aiImport = 'decideClassAction, decideMovement, decideTurn }';
const replanGuard = 'const supportEnded = state.version >= 5';
assert.equal(mixedSource.split(aiImport).length, 2);
assert.equal(mixedSource.split(replanGuard).length, 2);
mixedSource = mixedSource.replace(aiImport, 'decideClassAction, decideMovement, decideTurn, usesNewAi }')
  .replace(replanGuard, 'const supportEnded = usesNewAi(actor) && state.version >= 5');
// Only this in-memory module is instrumented. No production source is changed.
// Keep the new support-replanning correction exclusive to the new team's turns.
const mixed = await import(moduleUrl(rewrite(mixedSource, refs.new, { './ai.mjs': dispatcherUrl })));
const { PROFILES, STRATEGIES } = await import(snapshotModule(refs.new, 'data.mjs'));
const { compilePlayer } = await import(snapshotModule(refs.new, 'progression.mjs'));
const roster = PROFILES.map((profile, i) => compilePlayer({
  id: `benchmark-${i}`, profile: i, name: profile.trainingName, role: profile.role,
  instruction: 'normal', xp: 0, fatigue: 0, implant: null,
}));
function configFor(seed, strategy) {
  return { seed, strategy, awayStrategy: strategy, rosters: {
    home: structuredClone(roster), away: structuredClone(roster),
  } };
}
function checkEquivalent(config) {
  const state = mixed.createMatch(config);
  for (let i = 0; i < 5; i++) {
    const comparable = (p) => {
      const { id, teamId, position, startPosition, initiative, initiativeDie, initiativeTie, ...rest } = p;
      return rest;
    };
    assert.deepEqual(comparable(state.players[i]), comparable(state.players[i + 5]));
    assert.equal(state.players[i].position.x, 11 - state.players[i + 5].position.x);
    assert.equal(state.players[i].position.y, 7 - state.players[i + 5].position.y);
  }
}

// Calibration games are separate from the measured duels. Switching both teams to a
// single policy must reproduce that policy's complete native final state.
for (const policy of ['old', 'new']) {
  const nativeUrl = policy === 'new' && variantSource
    ? moduleUrl(rewrite(sourceAt(refs.new, 'engine.mjs'), refs.new, { './ai.mjs': newAiUrl }))
    : snapshotModule(refs[policy], 'engine.mjs');
  const native = await import(nativeUrl);
  for (const strategy of Object.keys(STRATEGIES)) {
    const config = configFor(`duel-calibration-${strategy}`, strategy);
    dispatcher.setPolicies({ home: policy, away: policy });
    assert.deepEqual(mixed.simulateMatch(config).state, native.simulateMatch(config).state,
      `Mixed harness does not reproduce native ${policy}/${strategy}`);
  }
}
console.log('Calibration OK : 6 matchs hors échantillon reproduisent exactement les moteurs natifs.');

const blankMetrics = () => ({ stripsAttempted: 0, stripsCompleted: 0,
  passesAttempted: 0, passesCompleted: 0, readyPasses: 0, reactionPasses: 0,
  attacks: 0, grapplesAttempted: 0, grapplesCompleted: 0, knockouts: 0, recoveries: 0 });
const report = {
  refs: Object.fromEntries(Object.entries(refs).map(([policy, ref]) => [policy,
    execFileSync('git', ['rev-parse', ref], { cwd: root, encoding: 'utf8' }).trim()])),
  method: { games, pairedScenarios, seedPrefix, calibrationGamesExcluded: 6,
    rulesVersion: 5, level: 1, fatigue: 0, equipment: false, instructions: 'normal',
    roster: roster.map(({ name, archetype, role, armor, maxHp, speed, skills }) =>
      ({ name, archetype, role, armor, maxHp, speed, skills })),
    description: 'Same five profiles, tactics and mirrored deployment on both sides. Each seed played twice with AI sides exchanged. Shared new resolution rules; support replanning enabled only for new AI. Historical AI modules loaded from Git snapshots. No career progression between matches.',
  },
  results: { new: 0, old: 0, draws: 0 },
  ...(variantSource ? { variant: { sourceFile: newAiFile, sha256: createHash('sha256').update(variantSource).digest('hex'),
    description: 'Only the new AI module is replaced; all other modules remain pinned to the same Git versions.' } } : {}),
  byStrategy: {}, bySide: { new: { home: 0, away: 0 }, old: { home: 0, away: 0 } },
  metrics: { old: blankMetrics(), new: blankMetrics() }, matches: [],
};

const simulationStartedAt = performance.now();
for (const [strategy, pairs] of schedule) {
  const tally = report.byStrategy[strategy] = { games: pairs * 2, new: 0, old: 0, draws: 0 };
  for (let pair = 0; pair < pairs; pair++) {
    const seed = `${seedPrefix}-${strategy}-${pair}`;
    for (const newSide of ['home', 'away']) {
      const policies = { home: newSide === 'home' ? 'new' : 'old', away: newSide === 'away' ? 'new' : 'old' };
      dispatcher.setPolicies(policies);
      const config = configFor(seed, strategy);
      checkEquivalent(config);
      const metrics = { old: blankMetrics(), new: blankMetrics() };
      const game = mixed.simulateMatch(config, (state, events) => {
        const owner = (id) => policies[state.players.find((p) => p.id === id)?.teamId];
        const activePolicy = owner(state.activeId);
        for (const event of events) {
          const action = event.resolvedAction;
          if (action && owner(action.playerId)) {
            const stats = metrics[owner(action.playerId)];
            if (action.type === 'strip') stats.stripsAttempted++;
            if (action.type === 'grapple') stats.grapplesAttempted++;
          }
          if (event.type === 'possession' && event.reason === 'arrache') metrics[owner(event.playerId)].stripsCompleted++;
          if (event.type === 'ready-pass') metrics[owner(event.playerId)].readyPasses++;
          if (event.type === 'ready-trigger') metrics[owner(event.playerId)].reactionPasses++;
          if (event.type === 'attack') metrics[owner(event.playerId)].attacks++;
          if (event.type === 'grapple') metrics[activePolicy].grapplesCompleted++;
        }
      });
      assert.equal(game.state.finished, true);
      for (const side of ['home', 'away']) {
        const stats = metrics[policies[side]];
        for (const key of ['passesAttempted', 'passesCompleted', 'knockouts', 'recoveries']) stats[key] = game.state.stats[side][key];
      }
      const counts = dispatcher.callCounts();
      assert.ok(counts.old > 0 && counts.new > 0, 'Each duel must actually execute both AIs');
      const winnerSide = game.state.result.winnerId, winner = winnerSide ? policies[winnerSide] : 'draws';
      report.results[winner]++; tally[winner]++;
      if (winnerSide) report.bySide[winner][winnerSide]++;
      for (const policy of ['old', 'new']) for (const key of Object.keys(metrics[policy])) report.metrics[policy][key] += metrics[policy][key];
      report.matches.push({ seed, strategy, newSide, winner, winnerSide,
        rounds: game.state.round, turns: game.state.turns, metrics, decisionCalls: counts,
        survivingPlayers: Object.fromEntries(['home', 'away'].map((side) =>
          [policies[side], game.state.players.filter((p) => p.teamId === side && p.hp > 0).length])),
      });
      if (report.matches.length % (games >= 1000 ? 50 : 10) === 0) console.log(`${report.matches.length}/${games} : ${JSON.stringify(report.results)} (${((performance.now() - simulationStartedAt) / 1000).toFixed(1)} s)`);
    }
  }
}
report.timing = { simulationSeconds: (performance.now() - simulationStartedAt) / 1000,
  setupAndCalibrationSeconds: (simulationStartedAt - startedAt) / 1000,
  totalSeconds: (performance.now() - startedAt) / 1000 };
assert.equal(report.matches.length, games);
assert.equal(report.results.old + report.results.new + report.results.draws, games);
assert.equal(report.matches.filter((m) => m.newSide === 'home').length, pairedScenarios);
for (let i = 0; i < report.matches.length; i += 2) {
  assert.equal(report.matches[i].seed, report.matches[i + 1].seed);
  assert.notEqual(report.matches[i].newSide, report.matches[i + 1].newSide);
}

const prefix = resolve(root, reportPrefix ?? `rumbleball/playtests/old-vs-new-${games}-2026-10-17`);
const fmt = (value) => value.toLocaleString('fr-FR');
const resultRows = Object.entries(report.byStrategy).map(([strategy, tally]) =>
  `| ${STRATEGIES[strategy]} | ${tally.games} | ${tally.new} | ${tally.old} | ${tally.draws} |`).join('\n');
const metricLabels = { stripsAttempted: 'Tentatives d’arrachement', stripsCompleted: 'Arrachements réussis',
  passesAttempted: 'Passes tentées', passesCompleted: 'Passes réussies', readyPasses: 'Préparations de passe',
  reactionPasses: 'Passes en réaction déclenchées', attacks: 'Attaques normales',
  grapplesAttempted: 'Tentatives de lutte', grapplesCompleted: 'Luttes réussies', knockouts: 'KO infligés' };
const metricRows = Object.entries(metricLabels).map(([key, label]) =>
  `| ${label} | ${fmt(report.metrics.old[key])} | ${fmt(report.metrics.new[key])} |`).join('\n');
const markdown = `# Ancienne IA contre nouvelle IA — ${fmt(games)} matchs\n\n` +
  `Référence ancienne : \`${report.refs.old}\`. Nouvelle : \`${report.refs.new}\`.\n\n` +
  (variantSource ? `Variante de la nouvelle IA : fichier conservé \`${prefix}.ai.mjs\`, SHA-256 \`${report.variant.sha256}\`. Seul ce module diffère du comparatif de référence.\n\n` : '') +
  `## Résultat\n\nNouvelle IA : **${report.results.new} victoires**. Ancienne IA : **${report.results.old} victoires**. Nuls : **${report.results.draws}**.\n\n` +
  `| Plan collectif commun aux deux équipes | Matchs | Nouvelle IA | Ancienne IA | Nuls |\n| --- | ---: | ---: | ---: | ---: |\n${resultRows}\n\n` +
  `Victoires par côté : nouvelle IA ${report.bySide.new.home} à domicile et ${report.bySide.new.away} à l’extérieur ; ancienne IA ${report.bySide.old.home} à domicile et ${report.bySide.old.away} à l’extérieur.\n\n` +
  `Durée chronométrée : ${report.timing.simulationSeconds.toFixed(1)} secondes de simulation et contrôles, plus ${report.timing.setupAndCalibrationSeconds.toFixed(1)} secondes de préparation et calibration.\n\n` +
  `## Activité cumulée par équipe d’IA sur ${fmt(games)} matchs\n\n| Mesure | Ancienne IA | Nouvelle IA |\n| --- | ---: | ---: |\n${metricRows}\n\n` +
  `## Protocole\n\n` +
  `- ${pairedScenarios} scénarios, joués chacun deux fois en échangeant les côtés : ${pairedScenarios} matchs à domicile et ${pairedScenarios} à l’extérieur par IA.\n` +
  `- Effectifs identiques : Nora (Capitaine/relais), Brique (Bélier/bloqueur), Zip (Escamoteur/porteur), Étau (Bélier/récupérateur), Vigie (Passeur/défenseur). Niveau 1, aucune fatigue, aucun équipement, consignes normales.\n` +
  `- Dans chaque match, même plan collectif et même ouverture pour les deux équipes, déploiements en miroir. Ouvertures par défaut : fuite sous écran, passe en retrait, pressing d’entrée.\n` +
  `- Règles de résolution communes de version 5. Les décisions viennent du module d’IA de chaque version. La nouvelle réévaluation après fin de passe préparée ne s’applique qu’aux tours de la nouvelle IA. Le moteur du jeu sur disque reste inchangé.\n` +
  `- Six matchs de calibration, exclus des ${fmt(games)} duels, vérifient l’égalité exacte de l’état final entre le banc d’essai et chaque moteur natif lorsque les deux équipes utilisent la même IA, pour les trois tactiques.\n` +
  `- La graine est identique au sein d’une paire ; les choix différents peuvent ensuite consommer les dés dans un ordre différent. Aucune progression ni sauvegarde de carrière. Les invariants du moteur sont contrôlés à chaque tour.\n` +
  `- Le JSON voisin contient les ${fmt(games)} résultats, les graines, les côtés et les mesures. Reproduire avec \`node tools/rumbleball-ai-duel.mjs ${prefix.replaceAll('\\', '/')} --matches ${games} --seed-prefix ${seedPrefix}${variantSource ? ` --new-ai ${prefix.replaceAll('\\', '/')}.ai.mjs` : ''}\`.\n\n` +
  `Cet échantillon mesure ces profils et ces tactiques ; il ne couvre pas tous les niveaux, équipements et effectifs possibles.\n`;
mkdirSync(dirname(prefix), { recursive: true });
if (variantSource) { writeFileSync(`${prefix}.ai.mjs`, variantSource); report.variant.snapshotFile = `${prefix}.ai.mjs`; }
writeFileSync(`${prefix}.json`, JSON.stringify(report, null, 2) + '\n');
writeFileSync(`${prefix}.md`, markdown);
console.log(JSON.stringify({ results: report.results, byStrategy: report.byStrategy,
  bySide: report.bySide, metrics: report.metrics, timing: report.timing, report: `${prefix}.md` }, null, 2));
