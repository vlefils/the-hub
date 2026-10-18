import { INSTRUCTIONS, ROLES, ROLE_DESCRIPTIONS, STRATEGIES, WET_CELLS, modifier } from './data.mjs';
import { createMatch, CURRENT_RULES, DEFAULT_SEED, seedHash, stepMatch } from './engine.mjs';
import { cellLabel } from './rules.mjs';
import { arenaBackdrop, ballArtwork, pawnArtwork, playerPortrait, poseCharacter, svg, teamCrest, turnMarkerArtwork } from './visuals.mjs';
import { KIT_COLORS, characterKey, readableKit, sportingWeapon, visibleGear } from './appearance.mjs';
import { CATALOGUE } from './progression.mjs';
import { narrateTurn } from './narration.mjs';
import { courtPoint, createCourtPlayback, nextCourtTurnDelay, ROUND_DURATION } from './playback.mjs';
import { drawCourtEffects, drawCourtLinks } from './court-effects.mjs';
import { ARCHETYPES, archetypeLabel, classResources, classAbilities } from './classes.mjs';
import { deploymentEditor } from './deployment-ui.mjs';
import { defaultDeployment, isCenterBall } from './deployment.mjs';
import { createKickoff } from './kickoff.mjs';
import { DEFAULT_OPENING, OPENINGS, OPENING_IDS, openingDeployment } from './openings.mjs';
import { openingPicker } from './opening-ui.mjs';

const element = (tag, cls, text) => {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text !== undefined) el.textContent = text;
  return el;
};
const options = (values, selected) => Object.entries(values).map(([value, label]) => {
  const option = element('option', '', label); option.value = value; option.selected = value === selected; return option;
});
const button = (text, cls = 'rb-button') => { const el = element('button', cls, text); el.type = 'button'; return el; };

export function mountMatch(root, callbacks = {}) {
  const section = root.closest('[data-section]');
  let state = createMatch(), lastConfig = null, started = false, running = false, timer = null, nextRoundAt = 0;
  let context = 'exhibition', ballReady = false;
  const teamLabel = (id) => state.teams.find((t) => t.id === id)?.name ?? '';
  let selectedId = null, speed = 1, journalCount = 0, lastTurnEvents = [], playbackMode = 'round', displayFrame = null, healthSignature = '';
  const visible = () => !root.closest('[hidden]') && (!section || section.classList.contains('is-active')) && !document.hidden;
  root.replaceChildren();
  root.classList.add('rb', 'rb-match');

  const setup = element('form', 'rb-setup');
  const setupHead = element('div', 'rb-setup-head');
  const setupCopy = element('div', 'rb-setup-copy');
  setupCopy.append(element('p', 'rb-eyebrow', 'Le vestiaire'), element('h3', '', 'Préparer les Recrues'), element('p', 'rb-muted', 'Quatre archétypes, cinq joueurs. Choisissez leurs rôles et leurs consignes ; les bots gèrent leurs techniques et leurs ressources.'));
  const quickStart = button('Lancer le match', 'rb-button rb-button-primary rb-setup-start'); quickStart.type = 'submit'; setupCopy.append(quickStart);
  const strategyLabel = element('label', 'rb-field', 'Plan collectif');
  const strategySelect = element('select'); strategySelect.name = 'rb-strategy'; strategySelect.append(...options(STRATEGIES, 'balanced'));
  strategyLabel.append(strategySelect);
  const colorLabel = element('label', 'rb-field', 'Couleur des maillots'), colorInput = element('input', 'rb-kit-color');
  colorInput.type = 'color'; colorInput.value = KIT_COLORS[0]; colorInput.setAttribute('aria-label', 'Couleur des maillots'); colorLabel.append(colorInput);
  const setupOptions = element('div', 'rb-kit-options'); setupOptions.append(strategyLabel, colorLabel); setupHead.append(setupCopy, setupOptions); setup.append(setupHead);
  const setupRows = element('div', 'rb-setup-rows');
  const rowControls = state.players.filter((p) => p.teamId === 'home').map((p, index) => {
    const row = element('div', 'rb-setup-row');
    const identity = element('div', 'rb-identity');
    const portrait = element('div', 'rb-portrait-wrap'); portrait.append(playerPortrait(p, colorInput.value)); identity.append(portrait);
    const copy = element('div'); copy.append(element('strong', '', p.name), element('span', 'rb-archetype', archetypeLabel(p)), element('small', '', `CA ${p.armor} · ${p.maxHp} PV · ${p.speed.toLocaleString('fr-FR')} m · attaque +${p.attack.bonus}, 1d${p.attack.die}+${p.attack.flat}`));
    identity.append(copy);
    const roleLabel = element('label', 'rb-field', 'Rôle'); const role = element('select'); role.name = `rb-role-${index}`;
    role.setAttribute('aria-label', `Rôle de ${p.name}`); role.append(...options(ROLES, p.role)); roleLabel.append(role);
    const instructionLabel = element('label', 'rb-field', 'Consigne'); const instruction = element('select'); instruction.name = `rb-instruction-${index}`;
    instruction.setAttribute('aria-label', `Consigne de ${p.name}`); instruction.append(...options(INSTRUCTIONS, 'normal')); instructionLabel.append(instruction);
    const description = element('p', 'rb-role-description', ROLE_DESCRIPTIONS[p.role]);
    role.addEventListener('change', () => { description.textContent = ROLE_DESCRIPTIONS[role.value]; updatePreview(); });
    instruction.addEventListener('change', updatePreview);
    row.append(identity, roleLabel, instructionLabel, description); setupRows.append(row);
    return { role, instruction, portrait };
  });
  const preparation = element('div', 'rb-preparation'); preparation.append(setupRows);
  const deployment = deploymentEditor({ players: state.players.filter((p) => p.teamId === 'home'), positions: defaultDeployment(), color: colorInput.value, onChange: updatePreview });
  const opening = openingPicker({ value: DEFAULT_OPENING, onChange: (value) => { deployment.update({ positions: openingDeployment(value) }); updatePreview(); } });
  setupRows.prepend(opening.root);
  preparation.append(deployment.root); setup.append(preparation);
  const setupFoot = element('div', 'rb-setup-foot');
  const seedLabel = element('label', 'rb-field rb-seed', 'Code du match');
  const seedInput = element('input'); seedInput.name = 'rb-seed'; seedInput.value = DEFAULT_SEED; seedInput.maxLength = 80; seedInput.required = true;
  seedInput.autocomplete = 'off'; seedInput.setAttribute('aria-describedby', 'rb-seed-help'); seedLabel.append(seedInput);
  const reroll = button('Nouveau tirage', 'rb-button rb-button-quiet');
  const start = button('Lancer le match', 'rb-button rb-button-primary'); start.type = 'submit';
  setupFoot.append(seedLabel, reroll, start);
  const seedHelp = element('p', 'rb-muted', 'Même code, ouverture et consignes : le match sera identique. Le code fixe aussi l’ouverture adverse. Les choix sont figés au coup d’envoi.'); seedHelp.id = 'rb-seed-help';
  setup.append(setupFoot, seedHelp);
  const classGuide = element('details', 'rb-rules rb-class-guide');
  classGuide.append(element('summary', '', 'Les classes et leurs techniques de rumbleball'));
  const classGuideCopy = element('div', 'rb-rules-copy');
  for (const archetype of Object.values(ARCHETYPES)) {
    const block = element('section'); block.append(element('h4', '', `${archetype.className} · ${archetype.name}`), element('p', 'rb-muted', archetype.description));
    for (const [name, description] of archetype.abilities) {
      const line = element('p'); line.append(element('strong', '', `${name}. `), document.createTextNode(description)); block.append(line);
    }
    classGuideCopy.append(block);
  }
  classGuide.append(classGuideCopy); setup.append(classGuide); root.append(setup);

  const scoreboard = element('div', 'rb-scoreboard');
  const homeScore = element('div', 'rb-team-name rb-home');
  const homeCopy = element('div', 'rb-team-copy');
  homeCopy.append(element('strong', '', 'Les Recrues'), element('small', '', 'Votre équipe'), element('span', 'rb-team-count'));
  homeScore.append(teamCrest('home'), homeCopy);
  const timebox = element('div', 'rb-timebox');
  const phaseText = element('span', 'rb-phase'); const timeText = element('strong', 'rb-clock'); const possessionText = element('span', 'rb-possession');
  timebox.append(phaseText, timeText, possessionText);
  const awayScore = element('div', 'rb-team-name rb-away');
  const awayCopy = element('div', 'rb-team-copy');
  awayCopy.append(element('strong', '', 'Les Charognards'), element('small', '', 'Plan équilibré'), element('span', 'rb-team-count'));
  awayScore.append(teamCrest('away'), awayCopy);
  const stage = element('section', 'rb-match-stage'); stage.setAttribute('aria-label', 'La rencontre');
  scoreboard.append(homeScore, timebox, awayScore); stage.append(scoreboard); root.append(stage);

  const toolbar = element('div', 'rb-toolbar');
  const controls = element('div', 'rb-controls');
  const pause = button('Pause'); const next = button('Round suivant'); const finish = button('Voir le résultat');
  const modeLabel = element('label', 'rb-speed rb-reading', 'Lecture'), modeSelect = element('select', 'rb-reading-mode');
  modeSelect.setAttribute('aria-label', 'Mode de lecture'); modeSelect.append(...options({ round: `Round simultané · ${ROUND_DURATION / 1000} s à ×1`, turn: 'Détail des tours' }, 'round')); modeLabel.append(modeSelect);
  const speedLabel = element('label', 'rb-speed', 'Vitesse'); const speedSelect = element('select');
  speedSelect.setAttribute('aria-label', 'Vitesse de lecture'); speedSelect.append(...options({ 1: '×1', 2: '×2', 4: '×4', 8: '×8' }, '1')); speedLabel.append(speedSelect);
  controls.append(pause, next, modeLabel, speedLabel, finish);
  const status = element('p', 'rb-playback-status'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  toolbar.append(controls, status); stage.append(toolbar);

  const matchLayout = element('div', 'rb-match-layout');
  const fieldColumn = element('div', 'rb-field-column');
  const court = svg('svg', { viewBox: '-30 -38 780 544', class: 'rb-court', role: 'group', 'aria-label': 'Terrain Rumbleball, colonnes A à L, lignes 1 à 8. Sélectionnez un joueur pour consulter sa fiche.' });
  const definitions = svg('defs');
  const arrow = svg('marker', { id: 'rb-opportunity-arrow', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 5, markerHeight: 5, orient: 'auto' });
  arrow.append(svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: '#ffdb78' })); definitions.append(arrow); court.append(definitions);
  court.append(arenaBackdrop(WET_CELLS));
  const trace = svg('g', { class: 'rb-trace', 'aria-hidden': 'true' }); const pawns = svg('g'); const ballLayer = svg('g', { class: 'rb-ball-layer', 'aria-hidden': 'true' });
  const centerZone = svg('rect', { x: 300, y: 180, width: 120, height: 120, class: 'rb-center-zone', 'aria-hidden': 'true', visibility: 'hidden' });
  const links = svg('g', { class: 'rb-court-links', 'aria-hidden': 'true' });
  const effects = svg('g', { class: 'rb-court-effects', 'aria-hidden': 'true' });
  const turnMarkers = svg('g', { 'aria-hidden': 'true' });
  const pawnNodes = new Map(), markerNodes = new Map();
  const ballSprite = ballArtwork(); const ballHalo = ballSprite.querySelector('.rb-ball-halo');
  const ballBody = ballSprite.querySelector('.rb-ball');
  const ballDrop = svg('g', { class: 'rb-ball-drop' });
  ballDrop.append(ballSprite); ballLayer.append(ballDrop);
  court.append(trace, centerZone, links, pawns, turnMarkers, ballLayer, effects);
  const courtPlayback = createCourtPlayback(renderCourtFrame);
  const courtStage = element('div', 'rb-court-stage'), kickoffOverlay = element('div', 'rb-kickoff'), kickoffCopy = element('div', 'rb-kickoff-copy'), kickoffValue = element('div');
  kickoffOverlay.hidden = true; kickoffOverlay.setAttribute('aria-hidden', 'true');
  kickoffCopy.append(element('p', 'rb-eyebrow', 'Coup d’envoi'), kickoffValue); kickoffOverlay.append(kickoffCopy); courtStage.append(court, kickoffOverlay);
  const kickoff = createKickoff((cue) => {
    kickoffOverlay.hidden = false; kickoffOverlay.dataset.cue = cue.label;
    kickoffValue.replaceChildren(element('strong', 'rb-kickoff-number', cue.label));
    if (cue.ball) { ballReady = true; ballDrop.classList.add('is-arriving'); }
    renderCourtFrame(displayFrame);
  }, () => {
    kickoffOverlay.hidden = true; ballDrop.classList.toggle('is-arriving', false);
    if (running) tick(); else renderPlaybackStatus();
  });
  const legend = element('div', 'rb-legend');
  for (const [cls, text] of [['home', 'Recrues'], ['away', 'Charognards'], ['ball', 'Ballon'], ['wet', 'Sol humide · coût ×2'], ['impact', 'Impact / dégâts'], ['grapple', 'Lutte']]) {
    const item = element('span'); item.append(element('i', `rb-swatch rb-swatch-${cls}`), document.createTextNode(text)); legend.append(item);
  }
  const initiative = element('div', 'rb-initiative'); initiative.setAttribute('aria-label', 'Ordre d’initiative');
  const opportunityNote = element('p', 'rb-opportunity-note'); opportunityNote.hidden = true;
  const selected = element('div', 'rb-selected');
  fieldColumn.append(courtStage, legend, opportunityNote, initiative, selected);
  const journalPanel = element('section', 'rb-journal-panel');
  const journalHead = element('div', 'rb-journal-head');
  journalHead.append(element('h3', '', 'Le fil du match'));
  const journalCaption = element('span', 'rb-muted', 'Le match raconté · détails dépliables'); journalHead.append(journalCaption);
  const journal = element('ol', 'rb-journal'); journal.setAttribute('aria-label', 'Journal chronologique du match'); journal.tabIndex = 0;
  const emptyJournal = element('li', 'rb-journal-empty', 'Le coup d’envoi approche. Préparez vos cinq joueurs, puis lancez le match.'); journal.append(emptyJournal);
  const rosters = element('div', 'rb-rosters'); rosters.tabIndex = 0; rosters.setAttribute('role', 'region'); rosters.setAttribute('aria-label', 'Effectifs sur le terrain');
  journalPanel.append(journalHead, journal); matchLayout.append(fieldColumn, journalPanel, rosters); stage.append(matchLayout);

  const resultPanel = element('section', 'rb-result'); resultPanel.hidden = true; root.append(resultPanel);
  const rules = element('details', 'rb-rules'); rules.append(element('summary', '', 'Règles et conventions de ce prototype'));
  const rulesCopy = element('div', 'rb-rules-copy');
  for (const text of [
    `10 rounds de ${ROUND_DURATION / 1000} secondes, soit deux minutes à ×1. La possession à la fin du dixième round donne la victoire. Balle libre : deux rounds de prolongation, puis un dernier engagement d’un round. Sans possession, match nul.`,
    'Engagement : après le décompte, les joueurs des quatre cases F4, G4, F5 et G5 peuvent intercepter le ballon en réaction avant les déplacements. Lutte ou Acrobaties : DD 10 sans adversaire, meilleur jet opposé si les deux équipes contestent ; égalité départagée par l’initiative. Les jets se font par ordre d’initiative. Chaque participant dépense sa réaction, conserve son action et son mouvement et peut passer, fuir ou frapper pendant son tour.',
    `Lecture simultanée : un round dure ${ROUND_DURATION / 1000} secondes à ×1. Les actions indépendantes se chevauchent ; les contacts et échanges de balle gardent leur ordre. La lecture « Détail des tours » permet d’examiner chaque tour séparément.`,
    'Par tour : mouvement, une action et une interaction. Une réaction par round, renouvelée au début du round. Recevoir une passe est une action libre. Intercepter, passer en réaction et frapper en opportunité partagent la même réaction.',
    'Balle au sol : une tentative de ramassage utilise l’interaction du tour, même si elle est contestée. Elle conserve l’action, la réaction et le mouvement restant, même en cas d’échec. On peut ensuite préparer une passe, sprinter ou se déplacer et esquiver. Après une frappe, une interaction encore disponible permet aussi de ramasser à portée, sans rendre l’action déjà dépensée.',
    'Une attaque d’opportunité est provoquée par un pas volontaire qui fait sortir de l’allonge (une case, diagonales comprises). Elle se résout avant ce pas : un KO laisse donc le joueur dans sa case de départ. Entrer dans l’allonge ou tourner autour sans en sortir ne provoque rien.',
    'Passe : action, 9 m, Acrobaties DD 10 ou 15 sous pression. Interception : résultat strictement supérieur à celui du passeur. Ramassage contesté et arrachement : tests opposés, égalité au défenseur.',
    'Après des dégâts au porteur : sauvegarde de Constitution, DD égal aux dégâts, minimum 10. Un plaquage seul ne fait pas lâcher la balle. À 0 PV : KO stable et sortie du match.',
    'Préparer une passe utilise l’action du porteur, sans lui donner l’esquive. Ses partenaires cherchent alors à se démarquer. Un allié disponible à son tour ou après un pas, sans adversaire au contact et avec un couloir libre à 9 m maximum, déclenche la passe avec la réaction du porteur. La préparation expire au prochain tour du porteur ou dès qu’il perd la balle. Le receveur peut préparer une nouvelle passe avec son action encore disponible.',
    'Diagonales : 1,5 m. Cases occupées bloquantes, sol humide difficile. Agripper immobilise la cible ; le lutteur peut l’entraîner à demi-vitesse en maintenant la prise. Les deux joueurs doivent avoir un passage libre. Pas de rebonds.',
    'Trois classes, quatre archétypes : Brute Bélier, Runner Escamoteur, Runner Capitaine et Gâchette Passeur de précision. Une action bonus par tour ; les ressources de classe ne reviennent pas pendant le match. Aucun soin ni retour en jeu après un KO. Rôles et consignes orientent les décisions des bots.',
  ]) rulesCopy.append(element('p', '', text));
  rules.append(rulesCopy); root.append(rules);
  const errorBox = element('p', 'rb-error'); errorBox.setAttribute('role', 'alert'); errorBox.hidden = true; root.prepend(errorBox);

  function config() {
    const seed = seedInput.value.trim() || DEFAULT_SEED;
    return { seed, rulesVersion: CURRENT_RULES, openings: { home: opening.value, away: OPENING_IDS[seedHash(`${seed}:opening:away`) % OPENING_IDS.length] }, deployments: { home: deployment.value }, strategy: strategySelect.value, kitColors: { home: colorInput.value },
      players: rowControls.map(({ role, instruction }) => ({ role: role.value, instruction: instruction.value })) };
  }
  function updatePreview() {
    if (started) return;
    state = createMatch(config()); selectedId = null; render();
    deployment.update({ players: state.players.filter((p) => p.teamId === 'home'), color: colorInput.value });
  }
  function setRunning(value) {
    running = value && started && !state.finished && visible();
    clearTimeout(timer); timer = null;
    if (!running) { nextRoundAt = 0; kickoff.pause(); courtPlayback.settle(); ballDrop.classList.toggle('is-arriving', false); }
    pause.textContent = running ? 'Pause' : 'Reprendre';
    renderPlaybackStatus();
    if (running) { if (kickoff.active) kickoff.resume(); else scheduleNextTurn(); }
  }
  function renderPlaybackStatus() {
    if (kickoff.active) {
      status.textContent = `${running ? 'Coup d’envoi' : 'Pause · coup d’envoi'}${kickoff.cue.ball ? ' · START' : ` dans ${kickoff.cue.label}…`}`;
      return;
    }
    if (playbackMode === 'round' && started && !state.finished) {
      const active = displayFrame?.animating;
      const text = active ? `Round ${displayFrame.round} · actions simultanées` : `${running ? 'Lecture' : 'Pause'} · round ${state.round} · ${ROUND_DURATION / 1000} s à ×1`;
      if (status.textContent !== text) status.textContent = text;
      return;
    }
    const actor = state.players.find((p) => p.id === state.activeId);
    if (!started || state.finished || !actor) {
      status.textContent = !started ? 'Prêt au coup d’envoi' : state.finished ? 'Match terminé' : running ? 'Match en cours' : 'Lecture en pause';
      return;
    }
    status.replaceChildren(document.createTextNode(running ? 'Tour de ' : 'Pause · tour de '), element('strong', `rb-${actor.teamId}`, actor.name));
  }
  function scheduleNextTurn() {
    timer = setTimeout(tick, playbackMode === 'round' ? Math.max(courtPlayback.remaining(), nextRoundAt - performance.now(), 0) : nextCourtTurnDelay(courtPlayback.remaining(), speed));
  }
  function resetKickoff() {
    kickoff.cancel(); kickoffOverlay.hidden = true; ballDrop.classList.toggle('is-arriving', false); ballReady = false;
  }
  function appendEvents(events) {
    if (!events.length) return;
    if (journalCount === 0) journal.replaceChildren();
    const follow = journal.scrollHeight - journal.scrollTop - journal.clientHeight < 70;
    const decision = events.find((e) => e.type === 'decision');
    const first = decision ?? events[0];
    const item = element('li', 'rb-turn');
    const heading = element('div', 'rb-turn-heading');
    const actor = state.players.find((p) => p.id === decision?.playerId);
    heading.append(element('span', actor ? `rb-${actor.teamId}` : '', actor ? actor.name : 'Arbitrage'), element('small', '', `R${first.round} · ${String(++journalCount).padStart(2, '0')}`));
    item.append(heading);
    const narrative = narrateTurn(events, state.players);
    if (narrative.text) item.append(element('p', 'rb-narrative', narrative.text));
    for (const event of narrative.announcements) {
      const line = element('p', 'rb-event-important', event.message);
      line.dataset.event = event.type; item.append(line);
    }
    const details = element('details', 'rb-rolls rb-turn-details');
    details.append(element('summary', '', 'Détails et jets'));
    for (const event of events) {
      const line = element('p', event.type === 'decision' ? 'rb-intention' : '', event.message);
      line.dataset.event = event.type; details.append(line);
    }
    item.append(details);
    journal.append(item);
    if (follow) journal.scrollTop = journal.scrollHeight;
  }
  function renderCourt(events = lastTurnEvents) {
    // Reuse pawn nodes: preserve keyboard focus and keep SVG updates inexpensive.
    for (const p of state.players) {
      let node = pawnNodes.get(p.id);
      if (!node) {
        node = svg('g', { 'data-player': p.id, role: 'button', tabindex: 0 });
        node.addEventListener('click', () => selectPlayer(p.id));
        node.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectPlayer(p.id); } });
        pawns.append(node); pawnNodes.set(p.id, node);
        const marker = turnMarkerArtwork(); turnMarkers.append(marker); markerNodes.set(p.id, marker);
      }
      const color = state.teams.find((t) => t.id === p.teamId)?.kitColor ?? KIT_COLORS[p.teamId === 'home' ? 0 : 1];
      const lookKey = characterKey(p, color);
      if (node.dataset.lookKey !== lookKey) { node.replaceChildren(pawnArtwork(p, color)); node.dataset.lookKey = lookKey; node.dataset.broad = String(p.archetype === 'belier'); }
      node.setAttribute('class', `rb-pawn rb-${p.teamId}${p.hp === 0 ? ' is-ko' : ''}${state.activeId === p.id ? ' is-active' : ''}${selectedId === p.id ? ' is-selected' : ''}`);
      node.setAttribute('aria-label', `${p.name}, ${teamLabel(p.teamId)}, ${p.hp} PV sur ${p.maxHp}${p.hp === 0 ? ', KO' : ''}${p.grappledBy ? ', agrippé' : ''}${p.prone ? ', à terre' : ''}${state.ball.carrierId === p.id ? ', porte la balle' : ''}${state.activeId === p.id ? ', tour en cours' : ''}`);
      node.setAttribute('aria-current', String(state.activeId === p.id));
      node.setAttribute('aria-pressed', String(selectedId === p.id));
    }
    courtPlayback.show(state);
    trace.replaceChildren();
    if (playbackMode === 'round') { opportunityNote.hidden = true; return; }
    for (const movement of events.filter((e) => e.type === 'move' || e.type === 'drag')) {
      const points = [movement.from, ...movement.path].map((p) => `${p.x * 60 + 30},${p.y * 60 + 30}`).join(' ');
      trace.append(svg('polyline', { points, class: movement.type === 'drag' ? 'rb-drag-line' : 'rb-move-line' }));
    }
    const pass = events.find((e) => e.type === 'pass');
    if (pass) trace.append(svg('line', { x1: pass.from.x * 60 + 30, y1: pass.from.y * 60 + 30, x2: pass.position.x * 60 + 30, y2: pass.position.y * 60 + 30, class: 'rb-pass-line' }));
    const opportunities = events.filter((e) => e.type === 'opportunity' && e.trigger);
    const departures = new Set();
    for (const event of opportunities) {
      const { from, to } = event.trigger;
      const key = `${event.targetId}:${from.x},${from.y}:${to.x},${to.y}`;
      if (departures.has(key)) continue;
      departures.add(key);
      const line = svg('line', { x1: from.x * 60 + 30, y1: from.y * 60 + 30, x2: to.x * 60 + 30, y2: to.y * 60 + 30, class: 'rb-opportunity-line', 'marker-end': 'url(#rb-opportunity-arrow)' });
      line.append(svg('title', {}, `Sortie d’allonge tentée : ${cellLabel(from)} → ${cellLabel(to)}`)); trace.append(line);
      trace.append(svg('rect', { x: to.x * 60 + 4, y: to.y * 60 + 4, width: 52, height: 52, rx: 3, class: 'rb-attempt-cell' }));
    }
    opportunityNote.hidden = opportunities.length === 0;
    opportunityNote.textContent = opportunities.map((e) => {
      const mover = state.players.find((p) => p.id === e.targetId);
      const stopped = events.some((q) => q.type === 'movement-stopped' && q.playerId === e.targetId && q.attemptedTo.x === e.trigger.to.x && q.attemptedTo.y === e.trigger.to.y);
      return `${mover.name} : ${cellLabel(e.trigger.from)} → ${cellLabel(e.trigger.to)}${stopped ? ' tenté, interrompu par le KO' : ', sortie d’allonge'}.`;
    }).join(' ') + (opportunities.length ? ' La flèche jaune montre le pas déclencheur ; la réaction précède ce pas.' : '');
  }
  function renderCourtFrame(frame) {
    displayFrame = frame;
    centerZone.setAttribute('visibility', ballReady && isCenterBall(frame) ? 'visible' : 'hidden');
    ballLayer.setAttribute('display', ballReady ? 'inline' : 'none');
    const activeIds = new Set(started ? playbackMode === 'round' ? frame.activeIds ?? [] : [state.activeId] : []);
    for (const p of frame.players) {
      const node = pawnNodes.get(p.id);
      if (!node) continue;
      const point = courtPoint(p.position);
      const active = activeIds.has(p.id), marker = markerNodes.get(p.id);
      marker.setAttribute('visibility', active ? 'visible' : 'hidden'); marker.setAttribute('transform', `translate(${point.x} ${point.y})`);
      node.setAttribute('transform', `translate(${point.x} ${point.y})`);
      node.classList.toggle('is-ko', p.hp === 0); node.classList.toggle('is-prone', p.prone);
      node.classList.toggle('is-ready', Boolean(p.readiedPass));
      node.classList.toggle('is-active', active); node.setAttribute('aria-current', String(active));
      const full = state.players.find((q) => q.id === p.id);
      node.setAttribute('aria-label', `${full.name}, ${teamLabel(p.teamId)}, ${p.hp} PV sur ${p.maxHp}${p.hp === 0 ? ', KO' : ''}${p.grappledBy ? ', agrippé' : ''}${p.prone ? ', à terre' : ''}${frame.ball.carrierId === p.id ? ', porte la balle' : ''}${p.readiedPass ? ', passe préparée' : ''}${active ? ', action en cours' : ''}`);
      node.querySelector('.rb-pawn-number').textContent = p.hp === 0 ? '×' : String(p.number);
      node.querySelector('.rb-pawn-health').setAttribute('width', String(32 * p.hp / p.maxHp));
      poseCharacter(node, p, { carrying: frame.ball.carrierId === p.id });
    }
    ballSprite.setAttribute('transform', `translate(${frame.ballPoint.x} ${frame.ballPoint.y})`);
    const carried = Boolean(frame.ball.carrierId);
    ballHalo.setAttribute('visibility', carried || frame.flying ? 'hidden' : 'visible');
    ballBody.setAttribute('transform', carried && !frame.flying ? 'scale(.76)' : 'scale(1)');
    drawCourtLinks(links, frame.players); drawCourtEffects(effects, frame.effects);
    for (const chip of initiative.children) if (chip.dataset.rbOrder) {
      const p = state.players.find((p) => p.id === chip.dataset.rbOrder), active = activeIds.has(p.id);
      chip.classList.toggle('is-active', active); chip.setAttribute('aria-current', String(active));
      chip.classList.toggle('is-ko', frame.players.find((q) => q.id === p.id).hp === 0);
      chip.setAttribute('aria-label', `${p.name} : initiative ${p.initiative}${active ? ', action en cours' : ''}`);
    }
    const holder = frame.players.find((p) => p.id === frame.ball.carrierId), name = (id) => state.players.find((p) => p.id === id)?.name;
    const roundSeconds = ROUND_DURATION / 1000;
    const remaining = Math.max(0, (11 - frame.round) * roundSeconds - (frame.roundProgress ?? 0) * roundSeconds);
    const seconds = Math.ceil(remaining);
    phaseText.textContent = !ballReady ? 'Avant le coup d’envoi' : frame.finished ? 'Coup de sifflet final' : frame.phase === 'final' ? 'Dernier engagement' : frame.phase === 'overtime' ? `Prolongation ${frame.round - 10}/2` : `Round ${frame.round}/10`;
    timeText.textContent = frame.finished ? '00:00' : frame.round > 10 ? `+${String(Math.ceil(roundSeconds * (1 - (frame.roundProgress ?? 0)))).padStart(2, '0')}` : `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    possessionText.textContent = !ballReady ? 'Ballon attendu au centre' : frame.flying ? 'Ballon en vol' : holder ? `${name(holder.id)} · ${teamLabel(holder.teamId)}` : isCenterBall(frame) ? 'Engagement · ballon à l’intersection centrale' : 'Balle libre';
    possessionText.className = `rb-possession${holder ? ` rb-${holder.teamId}` : ''}`;
    for (const [teamId, score] of [['home', homeScore], ['away', awayScore]]) score.querySelector('.rb-team-count').textContent = `${frame.players.filter((p) => p.teamId === teamId && p.hp > 0).length} / 5 en jeu`;
    toolbar.hidden = !started || state.finished && !frame.animating;
    if (context === 'broadcast') toolbar.hidden = true;
    resultPanel.hidden = !state.finished || Boolean(frame.animating);
    pause.disabled = state.finished && !frame.animating;
    pause.textContent = frame.animating || running ? 'Pause' : 'Reprendre';
    const signature = JSON.stringify([frame.ball.carrierId, frame.players.map((p) => [p.id, p.hp, p.prone, p.grappledBy, p.grappling, p.readiedPass, p.reaction])]);
    if (signature !== healthSignature) { healthSignature = signature; renderSelected(); renderRosters(); }
    if (frame.animating) {
      const text = `Round ${frame.round} · actions simultanées`;
      if (status.textContent !== text) status.textContent = text;
    } else renderPlaybackStatus();
  }
  const visiblePlayers = () => state.players.map((p) => ({ ...p, ...displayFrame?.players.find((q) => q.id === p.id) }));
  function selectPlayer(id) {
    selectedId = selectedId === id ? null : id;
    for (const [playerId, node] of pawnNodes) {
      node.classList.toggle('is-selected', playerId === selectedId); node.setAttribute('aria-pressed', String(playerId === selectedId));
    }
    renderSelected(); renderRosters();
  }
  function renderSelected() {
    selected.replaceChildren();
    const p = visiblePlayers().find((p) => p.id === selectedId);
    if (!p) { selected.append(element('p', 'rb-muted', 'Sélectionnez un pion ou un nom pour consulter ses caractéristiques.')); return; }
    const heading = element('div', 'rb-selected-heading'); heading.append(element('strong', `rb-${p.teamId}`, `${p.number} · ${p.name}`), element('span', 'rb-muted', `${ROLES[p.role]} · ${INSTRUCTIONS[p.instruction]}`));
    const stats = element('dl', 'rb-player-stats');
    const speedText = (p.grappling ? p.speed / 2 : p.speed).toLocaleString('fr-FR');
    for (const [name, value] of [['CA', p.armor], ['PV', `${p.hp}/${p.maxHp}`], ['Vitesse', p.grappledBy ? '0 m · agrippé' : `${speedText} m${p.grappling ? ' · lutte' : ''}`], ['FOR', p.abilities.strength], ['DEX', p.abilities.dexterity], ['CON', p.abilities.constitution], ['Lutte', signed(p.skills.wrestling ?? modifier(p.abilities.strength))], ['Acrobaties', signed(p.skills.acrobatics ?? modifier(p.abilities.dexterity))]]) {
      const item = element('div'); item.append(element('dt', '', name), element('dd', '', String(value))); stats.append(item);
    }
    selected.append(heading, element('p', 'rb-archetype', archetypeLabel(p)), stats,
      element('p', 'rb-muted', `${sportingWeapon(p).name} · attaque +${p.attack.bonus} · 1d${p.attack.die} + ${p.attack.flat} contondants.`));
    const gear = visibleGear(p);
    if (gear.protection || gear.implant) selected.append(element('p', 'rb-muted', `Protection : ${CATALOGUE[gear.protection]?.name ?? 'aucune'} · Implant : ${CATALOGUE[gear.implant]?.name ?? 'aucun'}.`));
    const classCopy = element('div', 'rb-class-details');
    classCopy.append(element('p', 'rb-class-resource', classResources(p, state.players)));
    for (const [name, description] of classAbilities(p)) {
      const line = element('p'); line.append(element('strong', '', `${name}. `), document.createTextNode(description)); classCopy.append(line);
    }
    const call = state.calls.find((c) => c.targetId === p.id);
    if (call) classCopy.append(element('p', 'rb-ball-text', `Appel de ${state.players.find((q) => q.id === call.sourceId).name} : prochaine passe avec avantage.`));
    if (p.readiedPass) classCopy.append(element('p', 'rb-ball-text', 'Passe prête : attend un partenaire démarqué pour passer en réaction.'));
    selected.append(classCopy);
  }
  function signed(value) { return value >= 0 ? `+${value}` : String(value); }
  function renderRosters() {
    const focusedId = rosters.contains(document.activeElement) ? document.activeElement.dataset.rbPlayer : null;
    rosters.replaceChildren();
    for (const team of state.teams) {
      const block = element('section', `rb-roster rb-roster-${team.id}`); const header = element('div', 'rb-roster-heading');
      const teamTitle = element('div', 'rb-roster-title'); teamTitle.append(teamCrest(team.id), element('h3', `rb-${team.id}`, team.name));
      header.append(teamTitle, element('span', 'rb-muted', `${visiblePlayers().filter((p) => p.teamId === team.id && p.hp > 0).length}/5 en jeu`)); block.append(header);
      for (const p of visiblePlayers().filter((p) => p.teamId === team.id)) {
        const row = element('div', `rb-roster-row${p.hp === 0 ? ' is-ko' : ''}${selectedId === p.id ? ' is-selected' : ''}`);
        const playerButton = button(`${p.number} · ${p.name}`, 'rb-player-name'); playerButton.setAttribute('aria-pressed', String(selectedId === p.id)); playerButton.addEventListener('click', () => selectPlayer(p.id));
        playerButton.dataset.rbPlayer = p.id;
        const copy = element('div'); copy.append(playerButton, element('small', 'rb-archetype', archetypeLabel(p)), element('small', 'rb-muted', `${ROLES[p.role]} · ${INSTRUCTIONS[p.instruction]}`));
        const health = element('div', 'rb-health'); health.append(element('span', '', `${p.hp}/${p.maxHp} PV`));
        const meter = element('meter'); meter.min = 0; meter.max = p.maxHp; meter.value = p.hp; meter.setAttribute('aria-label', `Points de vie de ${p.name}`); health.append(meter);
        const conditions = p.hp === 0 ? 'KO' : [p.grappledBy ? 'Agrippé' : '', p.grappling ? `Tient ${state.players.find((q) => q.id === p.grappling).name}` : '', p.prone ? 'À terre' : '', p.dodging ? 'Esquive' : '', p.readiedPass ? 'Passe prête' : '', (displayFrame?.ball ?? state.ball).carrierId === p.id ? 'Ballon' : ''].filter(Boolean).join(' · ');
        const resource = element('small', 'rb-resource', p.hp === 0 ? 'Hors jeu' : p.reaction ? 'Réaction disponible' : 'Réaction dépensée');
        row.append(copy, health, element('span', conditions.includes('Ballon') ? 'rb-conditions rb-ball-text' : 'rb-conditions', conditions || '—'), resource,
          element('small', 'rb-class-resource', classResources(p, state.players))); block.append(row);
      }
      rosters.append(block);
    }
    if (focusedId) rosters.querySelector(`[data-rb-player="${focusedId}"]`)?.focus({ preventScroll: true });
  }
  function renderResult() {
    resultPanel.hidden = !state.finished;
    if (!state.finished) return;
    resultPanel.replaceChildren();
    const winner = state.teams.find((t) => t.id === state.result.winnerId);
    const holder = state.players.find((p) => p.id === state.result.carrierId);
    resultPanel.dataset.winner = winner?.id ?? 'draw';
    resultPanel.append(element('p', 'rb-eyebrow', 'À la sirène'), element('h3', '', winner ? `${winner.name} remportent le match` : 'Match nul'),
      element('p', '', holder ? `${holder.name} tient la balle à la fin du round ${state.result.round}.` : 'La balle reste libre après le dernier engagement.'));
    const table = element('table', 'rb-stats-table');
    const caption = element('caption', 'rb-sr-only', 'Bilan des deux équipes'); table.append(caption);
    const thead = element('thead'), tr = element('tr'); for (const name of ['Bilan', ...state.teams.map((t) => t.name)]) { const th = element('th', '', name); th.scope = 'col'; tr.append(th); } thead.append(tr); table.append(thead);
    const tbody = element('tbody');
    for (const [label, key] of [['Passes réussies / tentées', 'passes'], ['Récupérations', 'recoveries'], ['KO infligés', 'knockouts']]) {
      const row = element('tr'); const th = element('th', '', label); th.scope = 'row'; row.append(th);
      for (const id of ['home', 'away']) { const stats = state.stats[id]; row.append(element('td', '', key === 'passes' ? `${stats.passesCompleted} / ${stats.passesAttempted}` : String(stats[key]))); }
      tbody.append(row);
    }
    table.append(tbody); const statsWrap = element('div', 'rb-table-scroll'); statsWrap.append(table); resultPanel.append(statsWrap);
    const actions = element('div', 'rb-controls');
    if (context === 'broadcast') return;
    if (context === 'career') {
      const back = button('Voir le bilan de la journée', 'rb-button rb-button-primary'); back.addEventListener('click', () => { setRunning(false); callbacks.onReturn?.(); });
      actions.append(back); resultPanel.append(actions); return;
    }
    const replay = button('Rejouer ce match', 'rb-button rb-button-primary'); replay.addEventListener('click', () => launch(lastConfig));
    const adjust = button('Ajuster les consignes'); adjust.addEventListener('click', prepareAgain);
    actions.append(replay, adjust); resultPanel.append(actions);
  }
  function render(events = []) {
    lastTurnEvents = events;
    renderPlaybackStatus();
    for (const [index, team] of state.teams.entries()) {
      const color = team.kitColor ?? KIT_COLORS[index];
      root.style.setProperty(`--rb-${team.id}`, readableKit(color)); root.style.setProperty(`--rb-kit-${team.id}`, color);
    }
    if (!started) for (const [i, p] of state.players.filter((p) => p.teamId === 'home').entries()) rowControls[i].portrait.replaceChildren(playerPortrait(p, colorInput.value));
    homeScore.querySelector('small').textContent = `${STRATEGIES[state.teams[0].strategy]} · ${OPENINGS[state.teams[0].opening]?.name ?? 'votre équipe'}`;
    awayScore.querySelector('small').textContent = `${STRATEGIES[state.teams[1].strategy]} · ${OPENINGS[state.teams[1].opening]?.name ?? 'adversaire'}`;
    for (const [index, score] of [homeScore, awayScore].entries()) score.querySelector('strong').textContent = state.teams[index].name;
    for (const [index, id] of ['home', 'away'].entries()) legend.children[index].lastChild.textContent = teamLabel(id);
    setup.hidden = started;
    toolbar.hidden = !started || state.finished;
    if (context === 'broadcast') toolbar.hidden = true;
    next.disabled = state.finished; finish.disabled = state.finished; pause.disabled = state.finished;
    next.textContent = playbackMode === 'round' ? 'Round suivant' : 'Tour suivant';
    renderCourt(events); renderSelected(); renderRosters();
    const focusedOrder = initiative.contains(document.activeElement) ? document.activeElement.dataset.rbOrder : null;
    initiative.replaceChildren(element('span', 'rb-muted', 'Initiative'));
    for (const id of state.initiative) {
      const p = state.players.find((q) => q.id === id);
      const active = playbackMode === 'turn' && p.id === state.activeId;
      const chip = button(String(p.number), `rb-order-token rb-${p.teamId}${active ? ' is-active' : ''}${p.hp === 0 ? ' is-ko' : ''}`);
      chip.setAttribute('aria-label', `${p.name} : initiative ${p.initiative}${active ? ', action en cours' : ''}`); chip.title = `${p.name} · initiative ${p.initiative}`;
      chip.setAttribute('aria-current', String(active));
      chip.dataset.rbOrder = p.id;
      chip.addEventListener('click', () => selectPlayer(p.id)); initiative.append(chip);
    }
    if (focusedOrder) initiative.querySelector(`[data-rb-order="${focusedOrder}"]`)?.focus({ preventScroll: true });
    if (state.finished) renderResult();
  }
  function advance({ animate = true } = {}) {
    if (context === 'broadcast') return;
    if (!errorBox.hidden) return;
    try {
      if (kickoff.active) resetKickoff();
      ballReady = true;
      courtPlayback.settle();
      const round = state.round, turns = []; let saved = true;
      do {
        const before = state, turn = stepMatch(state, { stopAtRoundEnd: playbackMode === 'round' }); state = turn.state;
        turns.push({ before, after: state, events: turn.events });
        saved = context !== 'career' || callbacks.onTurn?.(state, turn.events) !== false;
        appendEvents(turn.events);
      } while (saved && playbackMode === 'round' && !state.finished && state.round === round);
      render(turns.at(-1).events);
      nextRoundAt = performance.now() + ROUND_DURATION / speed;
      if (!saved) { setRunning(false); errorBox.hidden = false; errorBox.textContent = 'Progression non enregistrée. Revenez au club pour réessayer la sauvegarde ou exporter votre carrière.'; }
      if (state.finished) { setRunning(false); status.textContent = 'Match terminé'; }
      if (saved && animate && visible()) {
        if (playbackMode === 'round') courtPlayback.playRound(turns, { speed });
        else courtPlayback.play(turns[0].before, state, turns[0].events, { speed });
      }
    } catch (error) {
      setRunning(false); errorBox.hidden = false; errorBox.textContent = `La simulation a été interrompue. Code du match : ${state.seed}. ${error.message}`;
    }
  }
  function tick() { timer = null; if (!visible()) { setRunning(false); return; } advance(); if (running) scheduleNextTurn(); }
  function launch(configuration) {
    context = 'exhibition';
    setRunning(false); resetKickoff(); lastConfig = structuredClone(configuration); state = createMatch(lastConfig);
    started = true; selectedId = null; journalCount = 0; journal.replaceChildren(); errorBox.hidden = true; resultPanel.hidden = true;
    render(); kickoff.start(); setRunning(true);
    pause.focus({ preventScroll: true }); scoreboard.scrollIntoView({ block: 'start', behavior: 'instant' });
  }
  function prepareAgain() {
    setRunning(false); resetKickoff(); started = false; selectedId = null; journalCount = 0; resultPanel.hidden = true; errorBox.hidden = true;
    journal.replaceChildren(element('li', 'rb-journal-empty', 'Ajustez les consignes. Conservez le code pour comparer vos choix sur le même tirage.'));
    updatePreview(); strategySelect.focus(); setup.scrollIntoView({ block: 'start', behavior: 'instant' });
  }
  setup.addEventListener('submit', (event) => { event.preventDefault(); launch(config()); });
  strategySelect.addEventListener('change', updatePreview); seedInput.addEventListener('change', updatePreview);
  colorInput.addEventListener('input', updatePreview);
  reroll.addEventListener('click', () => {
    const value = new Uint32Array(1); crypto.getRandomValues(value); seedInput.value = `arche-${value[0].toString(36)}`; updatePreview();
  });
  pause.addEventListener('click', () => setRunning(displayFrame?.animating ? false : !running));
  next.addEventListener('click', () => { setRunning(false); if (started && !state.finished) advance(); });
  speedSelect.addEventListener('change', () => { courtPlayback.settle(); nextRoundAt = 0; speed = Number(speedSelect.value); if (running) setRunning(true); });
  modeSelect.addEventListener('change', () => { courtPlayback.settle(); nextRoundAt = 0; playbackMode = modeSelect.value; render(lastTurnEvents); setRunning(running); });
  finish.addEventListener('click', () => {
    if (context === 'broadcast') return;
    setRunning(false);
    while (!state.finished && errorBox.hidden) advance({ animate: false });
    if (state.finished) resultPanel.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) setRunning(false); });
  window.addEventListener?.('pagehide', () => setRunning(false));
  updatePreview(); setRunning(false);
  return {
    pause: () => setRunning(false),
    exhibition() { context = 'exhibition'; prepareAgain(); },
    broadcast(frame, elapsed = 0) {
      setRunning(false); resetKickoff(); context = 'broadcast'; started = true; ballReady = Boolean(frame.turns.length);
      state = structuredClone(frame.turns.at(-1)?.after ?? frame.initial);
      selectedId = state.players.some((p) => p.id === selectedId) ? selectedId : null;
      journalCount = 0; journal.replaceChildren(); errorBox.hidden = true; resultPanel.hidden = true;
      for (const turn of frame.turns) appendEvents(turn.events);
      render(frame.turns.at(-1)?.events ?? []);
      if (frame.turns.length) courtPlayback.playRound(frame.turns, { speed: 1, elapsed });
      toolbar.hidden = true;
    },
    load(current, autoplay = false, { kickoff: freshKickoff = false } = {}) {
      setRunning(false); resetKickoff(); context = 'career'; lastConfig = structuredClone(current.config); state = structuredClone(current.state);
      ballReady = state.turns > 0 || state.finished;
      started = true; selectedId = null; journalCount = 0; journal.replaceChildren(); errorBox.hidden = true; resultPanel.hidden = true;
      for (const events of current.turns) appendEvents(events);
      render(current.turns.at(-1) ?? []);
      if (freshKickoff && state.turns === 0 && !state.finished) kickoff.start();
      setRunning(autoplay);
    },
  };
}
