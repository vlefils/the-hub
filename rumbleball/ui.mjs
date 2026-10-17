import { INSTRUCTIONS, ROLES, ROLE_DESCRIPTIONS, STRATEGIES, WET_CELLS, modifier } from './data.mjs';
import { createMatch, DEFAULT_SEED, stepMatch } from './engine.mjs';
import { cellLabel } from './rules.mjs';
import { arenaBackdrop, pawnArtwork, svg, teamCrest, turnMarkerArtwork } from './visuals.mjs';
import { narrateTurn } from './narration.mjs';
import { courtPoint, createCourtPlayback, nextCourtTurnDelay } from './playback.mjs';
import { drawCourtEffects, drawCourtLinks } from './court-effects.mjs';
import { ARCHETYPES, archetypeLabel, classResources } from './classes.mjs';

const root = document.querySelector('[data-rumbleball]');
const section = root?.closest('[data-section]');
const teamLabel = (id) => id === 'home' ? 'Les Recrues' : 'Les Charognards';
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

if (root) {
  let state = createMatch(), lastConfig = null, started = false, running = false, timer = null;
  let selectedId = null, speed = 1, journalCount = 0, lastTurnEvents = [];
  const visible = () => section.classList.contains('is-active') && !document.hidden;
  root.replaceChildren();
  root.classList.add('rb');

  const setup = element('form', 'rb-setup');
  const setupHead = element('div', 'rb-setup-head');
  const setupCopy = element('div');
  setupCopy.append(element('p', 'rb-eyebrow', 'Le vestiaire'), element('h3', '', 'Préparer les Recrues'), element('p', 'rb-muted', 'Quatre archétypes, cinq joueurs. Choisissez leurs rôles et leurs consignes ; les bots gèrent leurs techniques et leurs ressources.'));
  const strategyLabel = element('label', 'rb-field', 'Plan collectif');
  const strategySelect = element('select'); strategySelect.name = 'rb-strategy'; strategySelect.append(...options(STRATEGIES, 'balanced'));
  strategyLabel.append(strategySelect); setupHead.append(setupCopy, strategyLabel); setup.append(setupHead);
  const setupRows = element('div', 'rb-setup-rows');
  const rowControls = state.players.filter((p) => p.teamId === 'home').map((p, index) => {
    const row = element('div', 'rb-setup-row');
    const identity = element('div', 'rb-identity');
    identity.append(element('span', 'rb-number rb-home', String(p.number)));
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
    return { role, instruction };
  });
  setup.append(setupRows);
  const setupFoot = element('div', 'rb-setup-foot');
  const seedLabel = element('label', 'rb-field rb-seed', 'Code du match');
  const seedInput = element('input'); seedInput.name = 'rb-seed'; seedInput.value = DEFAULT_SEED; seedInput.maxLength = 80; seedInput.required = true;
  seedInput.autocomplete = 'off'; seedInput.setAttribute('aria-describedby', 'rb-seed-help'); seedLabel.append(seedInput);
  const reroll = button('Nouveau tirage', 'rb-button rb-button-quiet');
  const start = button('Lancer le match', 'rb-button rb-button-primary'); start.type = 'submit';
  setupFoot.append(seedLabel, reroll, start);
  const seedHelp = element('p', 'rb-muted', 'Même code et mêmes consignes : le match sera identique. Les consignes sont fixées au coup d’envoi.'); seedHelp.id = 'rb-seed-help';
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
  scoreboard.append(homeScore, timebox, awayScore); root.append(scoreboard);

  const toolbar = element('div', 'rb-toolbar');
  const controls = element('div', 'rb-controls');
  const pause = button('Pause'); const next = button('Tour suivant'); const finish = button('Voir le résultat');
  const speedLabel = element('label', 'rb-speed', 'Vitesse'); const speedSelect = element('select');
  speedSelect.setAttribute('aria-label', 'Vitesse de lecture'); speedSelect.append(...options({ 1: '×1', 2: '×2', 4: '×4', 8: '×8' }, '1')); speedLabel.append(speedSelect);
  controls.append(pause, next, speedLabel, finish);
  const status = element('p', 'rb-playback-status'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  toolbar.append(controls, status); root.append(toolbar);

  const matchLayout = element('div', 'rb-match-layout');
  const fieldColumn = element('div', 'rb-field-column');
  const court = svg('svg', { viewBox: '-30 -38 780 544', class: 'rb-court', role: 'group', 'aria-label': 'Terrain Rumbleball, colonnes A à L, lignes 1 à 8. Sélectionnez un joueur pour consulter sa fiche.' });
  const definitions = svg('defs');
  const arrow = svg('marker', { id: 'rb-opportunity-arrow', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 5, markerHeight: 5, orient: 'auto' });
  arrow.append(svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: '#ffdb78' })); definitions.append(arrow); court.append(definitions);
  court.append(arenaBackdrop(WET_CELLS));
  const trace = svg('g', { class: 'rb-trace', 'aria-hidden': 'true' }); const pawns = svg('g'); const ballLayer = svg('g', { 'aria-hidden': 'true' });
  const links = svg('g', { class: 'rb-court-links', 'aria-hidden': 'true' });
  const effects = svg('g', { class: 'rb-court-effects', 'aria-hidden': 'true' });
  const turnMarker = turnMarkerArtwork();
  const pawnNodes = new Map();
  const ballSprite = svg('g'); const ballHalo = svg('circle', { r: 20, class: 'rb-ball-halo' });
  const ballBody = svg('ellipse', { transform: 'rotate(-35)', class: 'rb-ball' });
  ballSprite.append(ballHalo, ballBody, svg('path', { d: 'M-4,0h8 M0,-4v8', class: 'rb-ball-seam' })); ballLayer.append(ballSprite);
  court.append(trace, links, pawns, turnMarker, ballLayer, effects);
  const courtPlayback = createCourtPlayback(renderCourtFrame);
  const legend = element('div', 'rb-legend');
  for (const [cls, text] of [['home', 'Recrues'], ['away', 'Charognards'], ['ball', 'Ballon'], ['wet', 'Sol humide · coût ×2'], ['impact', 'Impact / dégâts'], ['grapple', 'Lutte']]) {
    const item = element('span'); item.append(element('i', `rb-swatch rb-swatch-${cls}`), document.createTextNode(text)); legend.append(item);
  }
  const initiative = element('div', 'rb-initiative'); initiative.setAttribute('aria-label', 'Ordre d’initiative');
  const opportunityNote = element('p', 'rb-opportunity-note'); opportunityNote.hidden = true;
  const selected = element('div', 'rb-selected');
  fieldColumn.append(court, legend, opportunityNote, initiative, selected);
  const journalPanel = element('section', 'rb-journal-panel');
  const journalHead = element('div', 'rb-journal-head');
  journalHead.append(element('h3', '', 'Le fil du match'));
  const journalCaption = element('span', 'rb-muted', 'Le match raconté · détails dépliables'); journalHead.append(journalCaption);
  const journal = element('ol', 'rb-journal'); journal.setAttribute('aria-label', 'Journal chronologique du match'); journal.tabIndex = 0;
  const emptyJournal = element('li', 'rb-journal-empty', 'Le coup d’envoi approche. Préparez vos cinq joueurs, puis lancez le match.'); journal.append(emptyJournal);
  journalPanel.append(journalHead, journal); matchLayout.append(fieldColumn, journalPanel); root.append(matchLayout);

  const resultPanel = element('section', 'rb-result'); resultPanel.hidden = true; root.append(resultPanel);
  const rosters = element('div', 'rb-rosters'); root.append(rosters);
  const rules = element('details', 'rb-rules'); rules.append(element('summary', '', 'Règles et conventions de ce prototype'));
  const rulesCopy = element('div', 'rb-rules-copy');
  for (const text of [
    '10 rounds de 6 secondes. La possession à la fin du dixième round donne la victoire. Balle libre : deux rounds de prolongation, puis un dernier engagement d’un round. Sans possession, match nul.',
    'Par tour : mouvement, une action et une interaction. Une réaction par round, renouvelée au début du round. Recevoir, intercepter et frapper en opportunité utilisent cette même réaction.',
    'Une attaque d’opportunité est provoquée par un pas volontaire qui fait sortir de l’allonge (une case, diagonales comprises). Elle se résout avant ce pas : un KO laisse donc le joueur dans sa case de départ. Entrer dans l’allonge ou tourner autour sans en sortir ne provoque rien.',
    'Passe : action, 9 m, Acrobaties DD 10 ou 15 sous pression. Interception : résultat strictement supérieur à celui du passeur. Ramassage contesté et arrachement : tests opposés, égalité au défenseur.',
    'Après des dégâts au porteur : sauvegarde de Constitution, DD égal aux dégâts, minimum 10. Un plaquage seul ne fait pas lâcher la balle. À 0 PV : KO stable et sortie du match.',
    'Diagonales : 1,5 m. Cases occupées bloquantes, sol humide difficile. Agripper immobilise la cible ; le lutteur peut l’entraîner à demi-vitesse en maintenant la prise. Les deux joueurs doivent avoir un passage libre. Pas de rebonds ni d’actions préparées.',
    'Trois classes, quatre archétypes : Brute Bélier, Runner Escamoteur, Runner Capitaine et Gâchette Passeur de précision. Une action bonus par tour ; les ressources de classe ne reviennent pas pendant le match. Aucun soin ni retour en jeu après un KO. Rôles et consignes orientent les décisions des bots.',
  ]) rulesCopy.append(element('p', '', text));
  rules.append(rulesCopy); root.append(rules);
  const errorBox = element('p', 'rb-error'); errorBox.setAttribute('role', 'alert'); errorBox.hidden = true; root.prepend(errorBox);

  function config() {
    return { seed: seedInput.value.trim() || DEFAULT_SEED, strategy: strategySelect.value,
      players: rowControls.map(({ role, instruction }) => ({ role: role.value, instruction: instruction.value })) };
  }
  function updatePreview() {
    if (started) return;
    state = createMatch(config()); selectedId = null; render();
  }
  function setRunning(value) {
    running = value && started && !state.finished && visible();
    clearTimeout(timer); timer = null;
    if (!running) courtPlayback.settle();
    pause.textContent = running ? 'Pause' : 'Reprendre';
    renderPlaybackStatus();
    if (running) scheduleNextTurn();
  }
  function renderPlaybackStatus() {
    const actor = state.players.find((p) => p.id === state.activeId);
    if (!started || state.finished || !actor) {
      status.textContent = !started ? 'Prêt au coup d’envoi' : state.finished ? 'Match terminé' : running ? 'Match en cours' : 'Lecture en pause';
      return;
    }
    status.replaceChildren(document.createTextNode(running ? 'Tour de ' : 'Pause · tour de '), element('strong', `rb-${actor.teamId}`, actor.name));
  }
  function scheduleNextTurn() {
    timer = setTimeout(tick, nextCourtTurnDelay(courtPlayback.remaining(), speed));
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
        node.append(pawnArtwork(p));
        node.addEventListener('click', () => selectPlayer(p.id));
        node.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectPlayer(p.id); } });
        pawns.append(node); pawnNodes.set(p.id, node);
      }
      node.setAttribute('class', `rb-pawn rb-${p.teamId}${p.hp === 0 ? ' is-ko' : ''}${state.activeId === p.id ? ' is-active' : ''}${selectedId === p.id ? ' is-selected' : ''}`);
      node.setAttribute('aria-label', `${p.name}, ${teamLabel(p.teamId)}, ${p.hp} PV sur ${p.maxHp}${p.hp === 0 ? ', KO' : ''}${p.grappledBy ? ', agrippé' : ''}${p.prone ? ', à terre' : ''}${state.ball.carrierId === p.id ? ', porte la balle' : ''}${state.activeId === p.id ? ', tour en cours' : ''}`);
      node.setAttribute('aria-current', String(state.activeId === p.id));
      node.setAttribute('aria-pressed', String(selectedId === p.id));
    }
    courtPlayback.show(state);
    trace.replaceChildren();
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
    const actor = frame.players.find((p) => p.id === state.activeId);
    turnMarker.setAttribute('visibility', actor ? 'visible' : 'hidden');
    if (actor) {
      const point = courtPoint(actor.position);
      turnMarker.setAttribute('transform', `translate(${point.x} ${point.y})`);
    }
    for (const p of frame.players) {
      const node = pawnNodes.get(p.id);
      if (!node) continue;
      const point = courtPoint(p.position);
      node.setAttribute('transform', `translate(${point.x} ${point.y})`);
      node.classList.toggle('is-ko', p.hp === 0); node.classList.toggle('is-prone', p.prone);
      node.querySelector('.rb-pawn-number').textContent = p.hp === 0 ? '×' : String(p.number);
      node.querySelector('.rb-pawn-health').setAttribute('width', String(32 * p.hp / p.maxHp));
    }
    ballSprite.setAttribute('transform', `translate(${frame.ballPoint.x} ${frame.ballPoint.y})`);
    const carried = Boolean(frame.ball.carrierId);
    ballHalo.setAttribute('visibility', carried || frame.flying ? 'hidden' : 'visible');
    ballBody.setAttribute('rx', carried ? 11 : 15); ballBody.setAttribute('ry', carried ? 7 : 10);
    drawCourtLinks(links, frame.players); drawCourtEffects(effects, frame.effects);
  }
  function selectPlayer(id) {
    selectedId = selectedId === id ? null : id;
    for (const [playerId, node] of pawnNodes) {
      node.classList.toggle('is-selected', playerId === selectedId); node.setAttribute('aria-pressed', String(playerId === selectedId));
    }
    renderSelected(); renderRosters();
  }
  function renderSelected() {
    selected.replaceChildren();
    const p = state.players.find((p) => p.id === selectedId);
    if (!p) { selected.append(element('p', 'rb-muted', 'Sélectionnez un pion ou un nom pour consulter ses caractéristiques.')); return; }
    const heading = element('div', 'rb-selected-heading'); heading.append(element('strong', `rb-${p.teamId}`, `${p.number} · ${p.name}`), element('span', 'rb-muted', `${ROLES[p.role]} · ${INSTRUCTIONS[p.instruction]}`));
    const stats = element('dl', 'rb-player-stats');
    const speedText = (p.grappling ? p.speed / 2 : p.speed).toLocaleString('fr-FR');
    for (const [name, value] of [['CA', p.armor], ['PV', `${p.hp}/${p.maxHp}`], ['Vitesse', p.grappledBy ? '0 m · agrippé' : `${speedText} m${p.grappling ? ' · lutte' : ''}`], ['FOR', p.abilities.strength], ['DEX', p.abilities.dexterity], ['CON', p.abilities.constitution], ['Lutte', signed(p.skills.wrestling ?? modifier(p.abilities.strength))], ['Acrobaties', signed(p.skills.acrobatics ?? modifier(p.abilities.dexterity))]]) {
      const item = element('div'); item.append(element('dt', '', name), element('dd', '', String(value))); stats.append(item);
    }
    selected.append(heading, element('p', 'rb-archetype', archetypeLabel(p)), stats,
      element('p', 'rb-muted', `Attaque +${p.attack.bonus} · 1d${p.attack.die} + ${p.attack.flat} contondants.`));
    const classCopy = element('div', 'rb-class-details');
    classCopy.append(element('p', 'rb-class-resource', classResources(p, state.players)));
    for (const [name, description] of ARCHETYPES[p.archetype]?.abilities ?? []) {
      const line = element('p'); line.append(element('strong', '', `${name}. `), document.createTextNode(description)); classCopy.append(line);
    }
    const call = state.calls.find((c) => c.targetId === p.id);
    if (call) classCopy.append(element('p', 'rb-ball-text', `Appel de ${state.players.find((q) => q.id === call.sourceId).name} : prochaine passe avec avantage.`));
    selected.append(classCopy);
  }
  function signed(value) { return value >= 0 ? `+${value}` : String(value); }
  function renderRosters() {
    const focusedId = rosters.contains(document.activeElement) ? document.activeElement.dataset.rbPlayer : null;
    rosters.replaceChildren();
    for (const team of state.teams) {
      const block = element('section', `rb-roster rb-roster-${team.id}`); const header = element('div', 'rb-roster-heading');
      const teamTitle = element('div', 'rb-roster-title'); teamTitle.append(teamCrest(team.id), element('h3', `rb-${team.id}`, team.name));
      header.append(teamTitle, element('span', 'rb-muted', `${state.players.filter((p) => p.teamId === team.id && p.hp > 0).length}/5 en jeu`)); block.append(header);
      for (const p of state.players.filter((p) => p.teamId === team.id)) {
        const row = element('div', `rb-roster-row${p.hp === 0 ? ' is-ko' : ''}${selectedId === p.id ? ' is-selected' : ''}`);
        const playerButton = button(`${p.number} · ${p.name}`, 'rb-player-name'); playerButton.setAttribute('aria-pressed', String(selectedId === p.id)); playerButton.addEventListener('click', () => selectPlayer(p.id));
        playerButton.dataset.rbPlayer = p.id;
        const copy = element('div'); copy.append(playerButton, element('small', 'rb-archetype', archetypeLabel(p)), element('small', 'rb-muted', `${ROLES[p.role]} · ${INSTRUCTIONS[p.instruction]}`));
        const health = element('div', 'rb-health'); health.append(element('span', '', `${p.hp}/${p.maxHp} PV`));
        const meter = element('meter'); meter.min = 0; meter.max = p.maxHp; meter.value = p.hp; meter.setAttribute('aria-label', `Points de vie de ${p.name}`); health.append(meter);
        const conditions = p.hp === 0 ? 'KO' : [p.grappledBy ? 'Agrippé' : '', p.grappling ? `Tient ${state.players.find((q) => q.id === p.grappling).name}` : '', p.prone ? 'À terre' : '', p.dodging ? 'Esquive' : '', state.ball.carrierId === p.id ? 'Ballon' : ''].filter(Boolean).join(' · ');
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
    const thead = element('thead'), tr = element('tr'); for (const name of ['Bilan', 'Recrues', 'Charognards']) { const th = element('th', '', name); th.scope = 'col'; tr.append(th); } thead.append(tr); table.append(thead);
    const tbody = element('tbody');
    for (const [label, key] of [['Passes réussies / tentées', 'passes'], ['Récupérations', 'recoveries'], ['KO infligés', 'knockouts']]) {
      const row = element('tr'); const th = element('th', '', label); th.scope = 'row'; row.append(th);
      for (const id of ['home', 'away']) { const stats = state.stats[id]; row.append(element('td', '', key === 'passes' ? `${stats.passesCompleted} / ${stats.passesAttempted}` : String(stats[key]))); }
      tbody.append(row);
    }
    table.append(tbody); resultPanel.append(table);
    const actions = element('div', 'rb-controls');
    const replay = button('Rejouer ce match', 'rb-button rb-button-primary'); replay.addEventListener('click', () => launch(lastConfig));
    const adjust = button('Ajuster les consignes'); adjust.addEventListener('click', prepareAgain);
    actions.append(replay, adjust); resultPanel.append(actions);
  }
  function render(events = []) {
    lastTurnEvents = events;
    renderPlaybackStatus();
    const holder = state.players.find((p) => p.id === state.ball.carrierId);
    phaseText.textContent = state.finished ? 'Coup de sifflet final' : state.phase === 'final' ? 'Dernier engagement' : state.phase === 'overtime' ? `Prolongation ${state.round - 10}/2` : `Round ${state.round}/10`;
    timeText.textContent = state.finished ? '00:00' : state.round > 10 ? '+06' : `00:${String((11 - state.round) * 6).padStart(2, '0')}`;
    if (!state.finished && state.round === 1) timeText.textContent = '01:00';
    possessionText.textContent = holder ? `${holder.name} · ${holder.teamId === 'home' ? 'Recrues' : 'Charognards'}` : 'Balle libre';
    possessionText.className = `rb-possession${holder ? ` rb-${holder.teamId}` : ''}`;
    homeScore.querySelector('small').textContent = `${STRATEGIES[state.teams[0].strategy]} · votre équipe`;
    for (const [teamId, score] of [['home', homeScore], ['away', awayScore]]) {
      const count = state.players.filter((p) => p.teamId === teamId && p.hp > 0).length;
      score.querySelector('.rb-team-count').textContent = `${count} / 5 en jeu`;
    }
    setup.hidden = started;
    toolbar.hidden = !started || state.finished;
    next.disabled = state.finished; finish.disabled = state.finished; pause.disabled = state.finished;
    renderCourt(events); renderSelected(); renderRosters();
    const focusedOrder = initiative.contains(document.activeElement) ? document.activeElement.dataset.rbOrder : null;
    initiative.replaceChildren(element('span', 'rb-muted', 'Initiative'));
    for (const id of state.initiative) {
      const p = state.players.find((q) => q.id === id);
      const chip = button(String(p.number), `rb-order-token rb-${p.teamId}${p.id === state.activeId ? ' is-active' : ''}${p.hp === 0 ? ' is-ko' : ''}`);
      chip.setAttribute('aria-label', `${p.name} : initiative ${p.initiative}${p.id === state.activeId ? ', tour en cours' : ''}`); chip.title = `${p.name} · initiative ${p.initiative}`;
      chip.setAttribute('aria-current', String(p.id === state.activeId));
      chip.dataset.rbOrder = p.id;
      chip.addEventListener('click', () => selectPlayer(p.id)); initiative.append(chip);
    }
    if (focusedOrder) initiative.querySelector(`[data-rb-order="${focusedOrder}"]`)?.focus({ preventScroll: true });
    if (state.finished) renderResult();
  }
  function advance({ animate = true } = {}) {
    try {
      courtPlayback.settle();
      const before = state;
      const turn = stepMatch(state); state = turn.state; appendEvents(turn.events); render(turn.events);
      if (state.finished) { setRunning(false); status.textContent = 'Match terminé'; }
      if (animate && visible()) courtPlayback.play(before, state, turn.events, { speed });
    } catch (error) {
      setRunning(false); errorBox.hidden = false; errorBox.textContent = `La simulation a été interrompue. Code du match : ${state.seed}. ${error.message}`;
    }
  }
  function tick() { timer = null; if (!visible()) { setRunning(false); return; } advance(); if (running) scheduleNextTurn(); }
  function launch(configuration) {
    setRunning(false); lastConfig = structuredClone(configuration); state = createMatch(lastConfig);
    started = true; selectedId = null; journalCount = 0; journal.replaceChildren(); errorBox.hidden = true; resultPanel.hidden = true;
    render(); setRunning(true);
    pause.focus({ preventScroll: true }); scoreboard.scrollIntoView({ block: 'start', behavior: 'instant' });
  }
  function prepareAgain() {
    setRunning(false); started = false; selectedId = null; journalCount = 0; resultPanel.hidden = true; errorBox.hidden = true;
    journal.replaceChildren(element('li', 'rb-journal-empty', 'Ajustez les consignes. Conservez le code pour comparer vos choix sur le même tirage.'));
    updatePreview(); strategySelect.focus(); setup.scrollIntoView({ block: 'start', behavior: 'instant' });
  }
  setup.addEventListener('submit', (event) => { event.preventDefault(); launch(config()); });
  strategySelect.addEventListener('change', updatePreview); seedInput.addEventListener('change', updatePreview);
  reroll.addEventListener('click', () => {
    const value = new Uint32Array(1); crypto.getRandomValues(value); seedInput.value = `arche-${value[0].toString(36)}`; updatePreview();
  });
  pause.addEventListener('click', () => setRunning(!running));
  next.addEventListener('click', () => { setRunning(false); if (started && !state.finished) advance(); });
  speedSelect.addEventListener('change', () => { courtPlayback.settle(); speed = Number(speedSelect.value); if (running) setRunning(true); });
  finish.addEventListener('click', () => {
    setRunning(false);
    while (!state.finished && errorBox.hidden) advance({ animate: false });
    if (state.finished) resultPanel.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  });
  document.addEventListener('hub:sectionchange', (event) => { if (event.detail.id !== 'outils-rumbleball') setRunning(false); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) setRunning(false); });
  render(); setRunning(false);
}
