import { ROLES, ROLE_DESCRIPTIONS, INSTRUCTIONS, STRATEGIES, STARTS } from './data.mjs';
import { ARCHETYPES, archetypeLabel, classAbilities } from './classes.mjs';
import { XP_THRESHOLDS, compilePlayer, levelOf, salary, recruitmentPrice, MAX_SQUAD_SIZE } from './progression.mjs';
import { createCareer, confirmDraft, configureTeam, setClubColor, setClubCrest, ownedPlayers, payroll, nextFixture, managementLocked, purchaseBlock, recruit, sellPlayer, buyItem, assignProtection, sellProtection, launchCareerMatch, saveCareerTurn, nextSeason, standings } from './career.mjs';
import { CAREER_KEY, loadCareer, persistCareer, exportCareer, importCareer } from './career-storage.mjs';
import { KIT_COLORS, clubKit } from './appearance.mjs';
import { playerPortrait, teamCrest, athletePortrait } from './visuals.mjs';
import { crestPicker, clubIdentity, matchBanner } from './broadcast-components.mjs';
import { deploymentEditor, draggablePlayer, PLAYER_DRAG_TYPE } from './deployment-ui.mjs';
import { clubDeployment, moveDeployment } from './deployment.mjs';
import { workspaceHeader, workspaceNavigation } from './workspace-header.mjs';
import { playerShop } from './player-shop.mjs';
import { playerInventory } from './player-inventory.mjs';
import { managementDialog } from './management-dialog.mjs';
import { clubOpening, openingDeployment } from './openings.mjs';
import { openingPicker } from './opening-ui.mjs';
import { el, btn, field, select, money, signed, keyed, kitPicker, portraitIdentity, pageHeading, metric, table, stats, statList, xpProgress, fatigue, comparison, equipmentSlots, disclosure } from './career-components.mjs';
function download(text, filename) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' })), a = el('a'); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function mountCareer(root, mountMatch) {
  root.replaceChildren(); root.classList.add('rb');
  // Access localStorage lazily, including browsers that reject the property getter.
  const storage = { getItem: (key) => window.localStorage.getItem(key), setItem: (key, value) => window.localStorage.setItem(key, value), removeItem: (key) => window.localStorage.removeItem(key) };
  const loaded = loadCareer(storage);
  let career = loaded.career, tab = 'Club', mode = 'career', unsaved = false, selectedPlayer = null, draftIds = new Set(), pendingImport = null;
  let marketFilter = '', comparePlayer = null, calendarDay = null, formationUndo = null;
  let preparationShopItem, preparationSlotPlayer;
  const sectionScroll = new Map(); let confirmationId = 0, importRequestId = 0;
  const top = el('div', 'rb-career-top'), modes = el('div', 'rb-controls'), tools = el('div', 'rb-controls');
  const careerMode = btn('Carrière', () => showMode('career')), exhibitionMode = btn('Exhibition', () => showMode('exhibition'));
  modes.setAttribute('aria-label', 'Mode de jeu'); modes.append(careerMode, exhibitionMode);
  const onlineLink = el('a', 'rb-button', 'Multijoueur'); onlineLink.href = './multi.html'; modes.append(onlineLink);
  const exportButton = btn('Exporter', () => attempt(() => download(exportCareer(career), `rumbleball-saison-${career.season}.json`)));
  const importInput = el('input'); importInput.type = 'file'; importInput.accept = '.json,application/json'; importInput.hidden = true;
  const importButton = btn('Importer', () => importInput.click());
  const restartButton = keyed(btn('Redémarrer la campagne', () => {
    view.pause();
    showConfirmation('Redémarrer la campagne ? Le club, les joueurs et toute la progression seront supprimés, y compris la rencontre en cours. Vous repartirez de la création d’un club. Exportez votre carrière avant de continuer si vous souhaitez en garder une copie.', restartCareer, 'Redémarrer');
  }), 'restart-career');
  restartButton.classList.add('rb-destructive-action');
  const retry = btn('Réessayer la sauvegarde', () => { save(); renderManagement(); }); retry.hidden = true;
  const saveStatus = el('span', 'rb-save-status', 'Sauvegarde locale automatique'); saveStatus.setAttribute('role', 'status'); saveStatus.setAttribute('aria-live', 'polite');
  const saveActions = el('div', 'rb-controls rb-save-actions'); saveActions.append(exportButton, importButton, restartButton);
  const saveTools = disclosure('Sauvegarde', 'save-tools', el('p', 'rb-muted', 'Cette carrière est conservée dans ce navigateur. Exportez une copie pour la garder sur un autre appareil.'), saveActions, importInput);
  tools.append(saveStatus, saveTools, retry); top.append(modes, tools);
  const notice = el('p', 'rb-career-notice'); notice.setAttribute('role', 'alert'); notice.hidden = !loaded.error; notice.textContent = loaded.error ?? '';
  const importPreview = el('section', 'rb-career-import'); importPreview.hidden = true;
  const manager = el('div', 'rb-career'), matchArea = el('div', 'rb-match-area'), matchActions = el('div', 'rb-controls rb-match-back'), matchRoot = el('div');
  matchActions.append(btn('Retour au club · mettre en pause', () => { view.pause(); matchArea.hidden = true; manager.hidden = false; if (career.current?.settled) tab = 'Bilan'; renderManagement(); }));
  matchArea.append(matchActions, matchRoot); matchArea.hidden = true;
  root.append(top, notice, importPreview, manager, matchArea);
  let modalKind = null;
  const modal = managementDialog(root, () => { modalKind = null; });
  workspaceHeader({ tools: top });
  const view = mountMatch(matchRoot, {
    onTurn(state, events) {
      career = saveCareerTurn(career, state, events);
      if (career.current?.settled) { calendarDay = null; formationUndo = null; }
      return save();
    },
    onReturn() { matchArea.hidden = true; manager.hidden = false; if (career.current?.settled) tab = 'Bilan'; renderManagement(); manager.scrollIntoView({ block: 'start', behavior: 'instant' }); },
  });
  function attempt(action) { if (modal.visible) modal.message(''); try { action(); } catch (error) { notice.hidden = false; notice.textContent = error.message; if (modal.visible) modal.message(error.message); } }
  function save() {
    try { persistCareer(storage, career); unsaved = false; retry.hidden = true; notice.hidden = true; if (saveStatus.textContent !== 'Enregistré dans ce navigateur') saveStatus.textContent = 'Enregistré dans ce navigateur'; return true; }
    catch (error) { unsaved = true; retry.hidden = false; if (saveStatus.textContent !== 'Progression non enregistrée') saveStatus.textContent = 'Progression non enregistrée'; notice.hidden = false; notice.textContent = `Progression non enregistrée : ${error.message} La dernière sauvegarde valide est conservée. Réessayez ou exportez votre progression avant de fermer cette page.`; return false; }
  }
  function update(action) { attempt(() => { career = action(); save(); renderManagement(); }); }
  function restartCareer() {
    attempt(() => {
      try { storage.removeItem(CAREER_KEY); }
      catch (error) { throw new Error(`Redémarrage impossible : ${error.message} Votre campagne est conservée.`); }
      career = null; loaded.hasSave = false; unsaved = false; retry.hidden = true; notice.hidden = true;
      importRequestId++; pendingImport = null; importPreview.replaceChildren(); importPreview.hidden = true; draftIds.clear();
      selectedPlayer = comparePlayer = calendarDay = formationUndo = null;
      preparationShopItem = preparationSlotPlayer = undefined;
      tab = 'Club'; marketFilter = ''; sectionScroll.clear();
      saveStatus.textContent = 'Sauvegarde locale automatique'; saveTools.open = false;
      showMode('career'); manager.querySelector('input')?.focus();
    });
  }
  function blocked(b, reason) { b.disabled = Boolean(reason); if (reason) b.title = reason; return b; }
  function go(nextTab) {
    sectionScroll.set(tab, window.scrollY ?? 0);
    modal.close();
    if (nextTab === 'Bilan') { modalKind = 'summary'; nextTab = 'Club'; }
    tab = nextTab === 'Ligue' ? 'Ligue' : 'Club'; renderManagement(false);
    const heading = manager.querySelector('.rb-section-heading')?.querySelector('h3'); heading?.focus({ preventScroll: true });
    window.scrollTo?.({ top: sectionScroll.get(tab) ?? 0, behavior: 'instant' });
  }
  function showMode(nextMode) {
    modal.close();
    view.pause(); mode = nextMode; importPreview.hidden = true;
    if (mode === 'exhibition') { workspaceHeader({ context: null, navigation: null }); manager.hidden = true; matchArea.hidden = false; matchActions.hidden = true; view.exhibition(); }
    else { matchArea.hidden = true; manager.hidden = false; matchActions.hidden = false; renderManagement(); }
    careerMode.setAttribute('aria-pressed', String(mode === 'career')); exhibitionMode.setAttribute('aria-pressed', String(mode === 'exhibition'));
  }
  importInput.addEventListener('change', async () => {
    const file = importInput.files[0]; importInput.value = ''; if (!file) return;
    const requestId = ++importRequestId;
    try {
      if (managementLocked(career ?? {})) throw new Error('Terminez la rencontre avant de remplacer la carrière.');
      if (file.size > 8_000_000) throw new Error('Fichier JSON trop volumineux.');
      const imported = importCareer(await file.text());
      if (requestId !== importRequestId) return;
      pendingImport = imported;
      if (managementLocked(career ?? {})) throw new Error('Terminez la rencontre avant de remplacer la carrière.');
      importPreview.replaceChildren(el('h3', '', 'Importer cette carrière'), el('p', '', `${pendingImport.clubs[0].name} · saison ${pendingImport.season} · ${money(pendingImport.balance)}. La carrière locale actuelle sera remplacée.`),
        btn('Confirmer le remplacement', () => attempt(() => { if (managementLocked(career ?? {})) throw new Error('Terminez la rencontre avant de remplacer la carrière.'); view.pause(); career = pendingImport; pendingImport = null; draftIds.clear(); selectedPlayer = comparePlayer = calendarDay = formationUndo = null; tab = 'Club'; sectionScroll.clear(); importPreview.hidden = true; save(); showMode('career'); }), true),
        btn('Annuler', () => { pendingImport = null; importPreview.hidden = true; }));
      importPreview.hidden = false;
    } catch (error) { if (requestId !== importRequestId) return; notice.hidden = false; notice.textContent = `Import refusé : ${error.message}`; }
  });
  function renderManagement(preserve = true) {
    if (tab === 'Bilan') { tab = 'Club'; modalKind = 'summary'; }
    const focusRoot = modal.visible ? modal.body : manager;
    const focusKey = preserve && focusRoot.contains(document.activeElement) ? document.activeElement.dataset.focusKey : null;
    const scroll = window.scrollY ?? 0, openKeys = new Set([...manager.querySelectorAll('details')].filter((n) => n.open).map((n) => n.dataset.sectionKey));
    workspaceHeader({ context: null, navigation: null });
    manager.replaceChildren(); exportButton.disabled = !career; importButton.disabled = managementLocked(career ?? {}); restartButton.disabled = !career && !loaded.hasSave;
    if (!career) { renderCreation(); restoreContext(); return; }
    if (career.status === 'draft') { renderDraft(); restoreContext(); return; }
    const locked = managementLocked(career), club = career.clubs[0];
    const header = el('header', 'rb-club-header'), identity = el('div');
    identity.append(el('p', 'rb-eyebrow', `Saison ${career.season} · ${career.day}/10 journées terminées`), el('h3', '', club.name));
    const finances = el('dl', 'rb-career-finances');
    const amounts = [['Solde', money(career.balance), career.balance < 0 ? 'rb-away' : ''], ['Prochains salaires', money(payroll(career)), '']];
    if (career.balance < 0) amounts.push(['Salaires impayés', money(-career.balance), 'rb-away']);
    for (const [label, value, cls] of amounts) {
      const item = el('div'); item.append(el('dt', 'rb-muted', label), el('dd', cls, value)); finances.append(item);
    }
    const headerActions = el('div', 'rb-header-actions'); headerActions.append(finances);
    const badgeIdentity = el('div', 'rb-club-identity'); badgeIdentity.append(teamCrest(club), identity); header.append(badgeIdentity, headerActions); if (!workspaceHeader({ context: header })) manager.append(header);
    if (locked) {
      const matchStrip = el('div', 'rb-next-match');
      matchStrip.append(el('p', '', `Rencontre en cours contre ${career.current.config.teamNames.away}. Gestion en lecture seule. La reprise se fait en pause.`), btn('Reprendre la rencontre', () => openMatch(), true));
      manager.append(matchStrip);
    }
    if (career.balance < 0) manager.append(el('p', 'rb-career-debt', 'Achats bloqués. Primes et ventes remboursent les salaires impayés. Vous pouvez jouer, modifier la composition et transférer vos protections gratuitement.'));
    const tabs = workspaceNavigation(tab, go);
    if (!workspaceHeader({ navigation: tabs })) manager.append(tabs);
    if (tab === 'Club') renderPreparation(locked);
    if (tab === 'Ligue') renderLeague();
    if (modalKind === 'recruitment') { renderMarket(locked, modal.body); modal.show('Recrutement'); }
    if (modalKind === 'summary' && career.current?.settled) { renderSummary(modal.body); modal.show('Bilan de la journée'); }
    restoreContext();
    function restoreContext() {
      if (!preserve) return;
      for (const node of manager.querySelectorAll('details')) if (openKeys.has(node.dataset.sectionKey)) node.open = true;
      if (focusKey) {
        const destination = modal.visible ? modal.body : manager;
        const target = [...destination.querySelectorAll('button'), ...destination.querySelectorAll('select'), ...destination.querySelectorAll('input')].find((node) => node.dataset.focusKey === focusKey);
        (target ?? manager.querySelector('.rb-section-heading')?.querySelector('h3'))?.focus({ preventScroll: true });
      }
      window.scrollTo?.({ top: scroll, behavior: 'instant' });
    }
  }
  function resultLabel() { return career.current.state.result.winnerId === 'home' ? 'Victoire' : career.current.state.result.winnerId === 'away' ? 'Défaite' : 'Match nul'; }
  function renderCreation() {
    const welcome = el('section', 'rb-career-welcome'), introduction = el('div', 'rb-career-introduction');
    introduction.append(el('p', 'rb-eyebrow', 'Bienvenue dans l’arène'), el('h2', '', 'Du chrome. Du contact. Un club à vous.'), el('p', '', 'Recrutez vos cinq titulaires, préparez vos tactiques et regardez-les se disputer le ballon. Deux minutes pour le tenir jusqu’à la sirène.'));
    const steps = el('ol', 'rb-career-steps');
    for (const [title, copy] of [['Recrutez', 'Quatre archétypes, des équipements et des implants.'], ['Préparez', 'Vos rôles, vos consignes, votre placement.'], ['Entrez dans l’arène', 'Les joueurs agissent seuls. Le club progresse avec vous.']]) { const step = el('li'); step.append(el('strong', '', title), el('span', '', copy)); steps.append(step); }
    introduction.append(steps);
    const form = el('form', 'rb-career-create'), input = el('input'); input.required = true; input.maxLength = 80; input.placeholder = 'Les Rebuts du Chrome';
    form.append(el('p', 'rb-eyebrow', 'Rumbleball Manager'), el('h3', '', 'Fonder votre club'), el('p', 'rb-muted', '2 400 chromas pour vos premiers contrats. Cinq titulaires par match et jusqu’à dix joueurs dans le club. Une ligue de six clubs, dix journées par saison. Votre carrière est sauvegardée dans ce navigateur.'), field('Nom du club', input));
    const color = kitPicker(KIT_COLORS[0]), preview = el('div', 'rb-kit-preview');
    const showKit = () => preview.replaceChildren(...[0, 1, 2, 4].map((profile) => playerPortrait(compilePlayer({ id: `preview-${profile}`, name: 'Aperçu', profile, xp: 0, fatigue: 0 }), color.value)));
    color.addEventListener('input', showKit); showKit(); form.append(field('Couleur des maillots', color), preview);
    const crest = crestPicker('hound', color.value); color.addEventListener('input', () => crest.updateColor(color.value)); form.append(crest.root);
    let replace;
    if (loaded.hasSave) { replace = el('input'); replace.type = 'checkbox'; replace.required = true; form.append(field('Remplacer la sauvegarde existante, après avoir conservé une copie si nécessaire.', replace)); }
    const submit = btn('Choisir les premières recrues', () => {}, true); submit.type = 'submit'; form.append(submit);
    form.addEventListener('submit', (event) => { event.preventDefault(); const seed = `club-${crypto.getRandomValues(new Uint32Array(1))[0].toString(36)}`; update(() => setClubCrest(createCareer(input.value, seed, color.value), crest.value)); });
    welcome.append(introduction, form); manager.append(welcome);
  }
  function renderDraft() {
    manager.append(el('p', 'rb-eyebrow', career.clubs[0].name), el('h3', '', 'Choisir votre effectif initial'), el('p', 'rb-muted', 'Sélection réversible. Les contrats sont payés ensemble à la validation. Les cinq premières recrues sélectionnées seront titulaires ; leur ordre restera modifiable.'));
    const color = kitPicker(clubKit(career.clubs[0])); color.addEventListener('change', () => update(() => setClubColor(career, color.value))); manager.append(field('Couleur des maillots', color)); const crest = crestPicker(career.clubs[0].crestId, color.value); crest.choice.addEventListener('change', () => update(() => setClubCrest(career, crest.value))); manager.append(crest.root);
    const list = el('div', 'rb-candidate-list'), footer = el('div', 'rb-draft-total'), total = el('strong'), confirm = btn('Valider les contrats', () => update(() => confirmDraft(career, [...draftIds])), true);
    function totals() { const chosen = career.market.filter((p) => draftIds.has(p.id)), cost = chosen.reduce((sum, p) => sum + recruitmentPrice(p), 0), wages = chosen.reduce((sum, p) => sum + salary(p), 0); total.textContent = `${draftIds.size}/${MAX_SQUAD_SIZE} joueurs · contrats ${money(cost)} · reste ${money(2400 - cost)} · après les premiers salaires : ${money(2400 - cost - wages)}${2400 - cost - wages < 0 ? ' (salaires impayés autorisés)' : ''}`; confirm.disabled = draftIds.size < 5 || draftIds.size > MAX_SQUAD_SIZE || cost > 2400; }
    for (const p of career.market) {
      const row = el('label', 'rb-candidate'), checkbox = el('input'); checkbox.type = 'checkbox'; checkbox.checked = draftIds.has(p.id);
      checkbox.addEventListener('change', () => { if (checkbox.checked) draftIds.add(p.id); else draftIds.delete(p.id); totals(); });
      const compiled = compilePlayer(p), copy = el('div'); copy.append(el('strong', '', p.name), el('span', 'rb-archetype', archetypeLabel(compiled)), el('small', 'rb-muted', stats(compiled)));
      row.append(checkbox, portraitIdentity(compiled, clubKit(career.clubs[0]), copy), el('span', '', money(recruitmentPrice(p)))); list.append(row);
    }
    totals(); footer.append(total, confirm); manager.append(list, footer);
  }
  function renderPreparation(locked) {
    const own = career.clubs[0], fixture = nextFixture(career), other = fixture && career.clubs.find(c => c.id === (fixture.homeId === 'club' ? fixture.awayId : fixture.homeId));
    if (other) manager.append(matchBanner(own, other, 'Journée ' + (career.day + 1), locked ? 'Composition figée pour cette rencontre' : 'Composition enregistrée automatiquement · modifiable avant le lancement'));
    const form = el('form', 'rb-lineup-form'), strategy = keyed(select(STRATEGIES, career.clubs[0].strategy), 'strategy'); strategy.disabled = locked;
    const preparation = el('div', 'rb-preparation rb-sport-preparation'), teamControls = el('div', 'rb-team-controls rb-broadcast-squad'), teamPlans = el('div', 'rb-team-plans');
    const assignments = Object.fromEntries(ownedPlayers(career).map((p) => [p.id, { role: p.role, instruction: p.instruction }]));
    const lineup = el('div', 'rb-lineup-slots'), slotControls = [], slotCopies = [], active = el('section', 'rb-tactical-player'), bench = el('div', 'rb-bench');
    const sidebar = el('aside', 'rb-workspace-sidebar'), inspector = el('section', 'rb-player-inspector'); sidebar.append(inspector);
    bench.setAttribute('aria-label', 'Banc des remplaçants');
    const names = Object.fromEntries(ownedPlayers(career).map((p) => [p.id, p.name]));
    selectedPlayer = ownedPlayers(career).some(p => p.id === selectedPlayer) ? selectedPlayer : career.lineup[0];
    const deploymentPlayers = () => career.lineup.map((id) => compilePlayer(ownedPlayers(career).find((p) => p.id === id), career.inventory));
    const positions = locked ? career.current.config.deployments?.home ?? STARTS.map(([x, y]) => ({ x, y })) : clubDeployment(career.clubs[0]);
    const deployment = deploymentEditor({ players: deploymentPlayers(), positions, color: clubKit(career.clubs[0]), disabled: locked, selectedPlayerId: career.lineup.includes(selectedPlayer) ? selectedPlayer : preparationSlotPlayer, interactivePlayers: true,
      onDropPlayer: (id, position) => attempt(() => {
        if (locked || !ownedPlayers(career).some(p => p.id === id)) return;
        const occupied = deployment.value.findIndex(p => p.x === position.x && p.y === position.y), index = occupied >= 0 ? occupied : Math.max(0, career.lineup.indexOf(deployment.selectedPlayerId));
        deployment.update({ positions: moveDeployment(deployment.value, index, position) }); slotControls[index].value = id; selectedPlayer = id; commitLineup(); renderActive();
      }), onSelect: (id) => { selectedPlayer = preparationSlotPlayer = id; renderActive(); }, onChange: () => attempt(commitLineup) });
    const undo = btn('Rétablir le placement précédent', () => attempt(() => { if (!formationUndo || locked) return; deployment.update({ positions: formationUndo.positions }); opening.update(formationUndo.opening); formationUndo = null; undo.hidden = true; commitLineup(); })); undo.hidden = !formationUndo; undo.disabled = locked;
    const opening = openingPicker({ value: locked ? career.current.config.openings?.home ?? 'none' : clubOpening(career.clubs[0]), disabled: locked, label: 'Ouverture',
      onChange: (value) => attempt(() => { formationUndo = { positions: deployment.value, opening: clubOpening(career.clubs[0]) }; deployment.update({ positions: openingDeployment(value) }); undo.hidden = false; commitLineup(); }) });
    const strategyHelp = el('p', 'rb-muted');
    function describeStrategy() { strategyHelp.textContent = { balanced: 'Une répartition équilibrée entre progression, soutien et défense.', possession: 'Protège le porteur par des blocages, des sorties de pression et des relais sûrs.', pressing: 'Met la pression sur le porteur adverse et conteste les accès au ballon.' }[strategy.value]; }
    describeStrategy(); teamPlans.append(field('Plan collectif', strategy), opening.root, undo);
    const recruitment = btn('Recruter un joueur', () => { modalKind = 'recruitment'; renderMarket(locked, modal.body); modal.show('Recrutement', recruitment); }); recruitment.classList.add('rb-recruit-tile'); recruitment.setAttribute('aria-haspopup', 'dialog');
    teamControls.append(el('h4', '', 'Les cinq titulaires'), lineup, recruitment);
    for (const [index, id] of career.lineup.entries()) {
      const s = keyed(select(names, id), `lineup-${index}`); s.disabled = locked; slotControls.push(s);
      const row = el('div', 'rb-lineup-slot'), copy = el('div', 'rb-slot-copy'), pick = btn('', () => { selectedPlayer = preparationSlotPlayer = s.value; deployment.update({ selectedPlayerId: selectedPlayer }); renderActive(); });
      pick.classList.add('rb-squad-name'); pick.setAttribute('aria-label', `Sélectionner le titulaire ${index + 1} sur le terrain`);
      row.append(copy); lineup.append(row); slotCopies.push({ row, copy, pick });
      s.addEventListener('change', () => attempt(() => {
        const duplicate = slotControls.find((other, otherIndex) => otherIndex !== index && other.value === s.value);
        if (duplicate) duplicate.value = career.lineup[index]; selectedPlayer = preparationSlotPlayer = s.value; commitLineup(); renderActive();
      }));
    }
    const formNotice = el('p', 'rb-form-status', 'Toute modification est enregistrée automatiquement.'); formNotice.setAttribute('role', 'status');
    function refreshSlots() {
      for (const [index, { row, copy, pick }] of slotCopies.entries()) {
        const p = ownedPlayers(career).find((p) => p.id === slotControls[index].value);
        const compiled = compilePlayer(p, career.inventory); pick.textContent = `${index + 1} · ${p.name}`;
        row.classList.toggle('is-selected', p.id === selectedPlayer); copy.replaceChildren(athletePortrait(compiled, clubKit(career.clubs[0])), pick, el('small', 'rb-archetype', `${ARCHETYPES[compiled.archetype].name} · niv. ${compiled.level}`), fatigue(p));
        draggablePlayer(copy.children[0], p.id, locked);
      }
      const target = ownedPlayers(career).find((p) => p.id === (career.lineup.includes(selectedPlayer) ? selectedPlayer : deployment.selectedPlayerId));
      bench.replaceChildren(el('h4', '', 'Banc'));
      const reserves = ownedPlayers(career).filter((p) => !career.lineup.includes(p.id));
      bench.classList.toggle('is-expanded', reserves.length > 3);
      if (!reserves.length) bench.append(el('p', 'rb-muted', 'Aucun remplaçant.'));
      else bench.append(el('p', 'rb-muted', 'Disponibles'));
      for (const p of reserves) {
        const b = keyed(blocked(btn('Faire entrer', () => { const index = Math.max(0, career.lineup.indexOf(deployment.selectedPlayerId)); slotControls[index].value = p.id; selectedPlayer = p.id; attempt(() => { commitLineup(); renderActive(); active.querySelector('select')?.focus({ preventScroll: true }); }); }), locked ? 'Rencontre en cours.' : ''), `bench-${p.id}`); b.setAttribute('aria-label', `Faire entrer ${p.name}`);
        const row = el('div', 'rb-bench-player'), pick = btn('', () => { selectedPlayer = p.id; renderActive(); }); pick.classList.add('rb-bench-name'); pick.setAttribute('aria-label', p.name); pick.title = `Gérer ${p.name} · statistiques, rôle et équipement`; pick.setAttribute('aria-pressed', String(selectedPlayer === p.id)); row.classList.toggle('is-selected', selectedPlayer === p.id);
        pick.append(athletePortrait(compilePlayer(p, career.inventory), clubKit(own)), el('span', '', p.name)); draggablePlayer(pick, p.id, locked);
        b.title = `Remplace ${target.name}`;
        row.addEventListener('click', event => { if (!event.target.closest('button')) pick.click(); });
        row.addEventListener('dragover', event => { if (!locked && [...event.dataTransfer.types].includes(PLAYER_DRAG_TYPE)) event.preventDefault(); });
        row.addEventListener('drop', event => attempt(() => { const index = career.lineup.indexOf(event.dataTransfer.getData(PLAYER_DRAG_TYPE)); if (locked || index < 0) return; event.preventDefault(); slotControls[index].value = p.id; selectedPlayer = p.id; commitLineup(); renderActive(); }));
        row.append(pick, fatigue(p), b); bench.append(row);
      }
    }
    function renderActive() {
      const p = ownedPlayers(career).find((p) => p.id === selectedPlayer); if (!p) return;
      const role = keyed(select(ROLES, assignments[p.id].role), 'active-role'), instruction = keyed(select(INSTRUCTIONS, assignments[p.id].instruction), 'active-instruction'); role.disabled = instruction.disabled = locked;
      active.replaceChildren(el('p', 'rb-eyebrow', 'Réglages du joueur sélectionné'), el('h4', '', p.name), field('Rôle', role), field('Consigne', instruction));
      role.title = ROLE_DESCRIPTIONS[role.value];
      const compiled = compilePlayer(p, career.inventory);
      const progress = el('div', 'rb-player-status-strip'); progress.append(xpProgress(p), fatigue(p));
      inspector.replaceChildren(portraitIdentity(compiled, clubKit(own), el('h3', '', p.name), el('p', 'rb-archetype', archetypeLabel(compiled))), progress, active, statList(compiled), equipmentSlots(p, career.inventory), playerShop({ ...own, balance: career.balance, inventory: career.inventory }, p, {
        locked, selectedItem: preparationShopItem, onItem: id => { preparationShopItem = id; }, onBuy: (id, playerId, confirmed) => update(() => buyItem(career, id, playerId, confirmed))
      }));
      inspector.append(playerInventory({ ...own, inventory: career.inventory }, p, { locked, onAssign: (id, playerId) => update(() => assignProtection(career, id, playerId)), onSell: id => update(() => sellProtection(career, id)) }));
      const slot = career.lineup.indexOf(p.id); if (slot >= 0) inspector.append(field('Remplacer ce titulaire', slotControls[slot]));
      else inspector.append(el('p', 'rb-muted', 'Sur le banc · rôle, consigne et équipement modifiables comme pour un titulaire.'));
      const techniques = disclosure('Techniques et progression', 'player-techniques', el('p', 'rb-muted', `${p.xp} XP cumulée · ${money(salary(p))} par journée`));
      for (const [label, description] of classAbilities(compiled)) techniques.append(el('h4', '', label), el('p', 'rb-muted', description)); inspector.append(techniques);
      const reason = locked ? 'Rencontre en cours.' : ownedPlayers(career).length <= 5 ? 'Cinq joueurs minimum.' : '';
      inspector.append(blocked(btn(`Céder · ${money(recruitmentPrice(p) / 2)}`, () => showConfirmation(`Céder ${p.name} pour ${money(recruitmentPrice(p) / 2)} ? Son implant quitte le club ; sa protection retourne en réserve.`, () => update(() => sellPlayer(career, p.id)))), reason));
      for (const control of [role, instruction]) control.addEventListener('change', () => attempt(() => { assignments[p.id] = { role: role.value, instruction: instruction.value }; commitLineup(); role.title = ROLE_DESCRIPTIONS[role.value]; }));
      refreshSlots();
    }
    function commitLineup() {
      career = setClubCrest(configureTeam(career, slotControls.map((s) => s.value), assignments, strategy.value, deployment.value, opening.value), crest.value);
      const saved = save(); deployment.update({ players: deploymentPlayers(), selectedPlayerId: selectedPlayer }); refreshSlots();
      const message = saved ? 'Composition, placement et consignes enregistrés.' : 'Modifications en mémoire ; sauvegarde à réessayer.'; if (formNotice.textContent !== message) formNotice.textContent = message;
    }
    strategy.addEventListener('change', () => attempt(() => { describeStrategy(); commitLineup(); }));
    const crest = crestPicker(own.crestId, clubKit(own), locked); crest.choice.addEventListener('change', () => attempt(commitLineup));
    const color = kitPicker(clubKit(own), locked); color.addEventListener('change', () => update(() => setClubColor(career, color.value)));
    teamControls.append(disclosure('Identité du club', 'club-identity', field('Couleur des maillots', color), crest.root));
    const court = el('div', 'rb-court-workspace'); court.append(deployment.root, bench);
    const tactics = el('section', 'rb-broadcast-tactics'); tactics.append(court, teamPlans);
    preparation.append(teamControls, tactics, sidebar); form.append(preparation);
    const launch = el('div', 'rb-launch-bar'), copy = el('div');
    copy.append(el('strong', '', locked ? 'Composition figée pour cette rencontre' : !nextFixture(career) ? 'La saison est terminée' : `${money(payroll(career))} de salaires au coup d’envoi`), el('p', 'rb-muted', locked ? 'Terminez le match pour modifier votre équipe.' : !nextFixture(career) ? 'Commencez la saison suivante depuis Club.' : `Solde après prélèvement : ${money(career.balance - payroll(career))}. Les primes seront versées après le match.`));
    launch.append(copy, !nextFixture(career) ? btn('Commencer la saison suivante', () => { calendarDay = null; formationUndo = null; update(() => nextSeason(career)); }, true) : blocked(btn('Lancer la rencontre', () => updateAndPlay(), true), locked ? 'Rencontre déjà en cours.' : '')); tactics.append(formNotice, launch);
    if (career.current?.settled) tactics.append(btn('Voir le bilan', () => go('Bilan')));
    form.addEventListener('submit', (event) => event.preventDefault()); manager.append(form); renderActive();
    manager.append(disclosure('Comprendre la préparation', 'preparation-help', el('p', 'rb-muted', 'L’archétype définit les techniques. Le rôle donne une mission ; la consigne règle le comportement. Le plan collectif guide l’équipe, tandis que l’ouverture fixe le placement et le premier tour. Choisir un titulaire déjà présent échange leurs positions. Aucun remplacement pendant le match.'), strategyHelp, ...opening.root.querySelectorAll('p')));
  }
  function renderMarket(locked, target) {
    target.replaceChildren();
    target.append(pageHeading('Marché des recrues', `${ownedPlayers(career).length}/${MAX_SQUAD_SIZE} places occupées · Offres conservées jusqu’à la fin de la journée, puis six nouvelles recrues.`));
    comparePlayer = ownedPlayers(career).some((p) => p.id === comparePlayer) ? comparePlayer : career.lineup[0];
    const filter = keyed(select({ '': 'Tous les archétypes', ...Object.fromEntries(Object.entries(ARCHETYPES).map(([id, a]) => [id, a.name])) }, marketFilter), 'market-filter');
    const compare = keyed(select(Object.fromEntries(ownedPlayers(career).map((p) => [p.id, p.name])), comparePlayer), 'market-compare');
    filter.addEventListener('change', () => { marketFilter = filter.value; renderManagement(); }); compare.addEventListener('change', () => { comparePlayer = compare.value; renderManagement(); });
    const controls = el('div', 'rb-market-controls'); controls.append(field('Archétype recherché', filter), field('Comparer avec', compare)); target.append(controls);
    const existing = ownedPlayers(career).find((p) => p.id === comparePlayer), reference = compilePlayer(existing, career.inventory), list = el('div', 'rb-career-roster rb-market-list');
    const offers = career.market.filter((p) => !marketFilter || compilePlayer(p).archetype === marketFilter);
    for (const p of offers) {
      const row = el('section', 'rb-career-player'), compiled = compilePlayer(p);
      row.append(portraitIdentity(compiled, clubKit(career.clubs[0]), el('h4', '', p.name), el('span', 'rb-archetype', archetypeLabel(compiled))), el('p', 'rb-muted', `Niveau ${levelOf(p)} · ${money(salary(p))} / journée · Fatigue 0/6`), statList(compiled));
      row.append(disclosure(`Comparer à ${existing.name}`, `offer-${p.id}`, el('p', 'rb-muted', `Votre joueur : niveau ${levelOf(existing)}, fatigue ${existing.fatigue}/6, équipement compris. Recrue : sans équipement et sans fatigue.`), comparison(reference, compiled, existing.implant, p.implant)));
      row.append(el('p', 'rb-purchase-projection', `Après contrat : ${money(career.balance - recruitmentPrice(p))} · Nouveaux salaires : ${money(payroll(career) + salary(p))} / journée.`));
      const reason = locked ? 'Rencontre en cours.' : ownedPlayers(career).length >= MAX_SQUAD_SIZE ? 'Effectif complet : dix joueurs maximum.' : purchaseBlock(career, recruitmentPrice(p));
      row.append(keyed(blocked(btn(`Recruter · ${money(recruitmentPrice(p))}`, () => update(() => recruit(career, p.id))), reason), `recruit-${p.id}`)); if (reason) row.append(el('small', 'rb-muted', reason)); list.append(row);
    }
    if (!offers.length) list.append(el('p', 'rb-empty-state', career.market.length ? 'Aucune offre pour cet archétype. Choisissez un autre filtre.' : 'Toutes les offres ont été recrutées. Le marché sera renouvelé après la journée.'));
    target.append(list);
  }
  function renderLeague() {
    const rows = standings(career), layout = el('div', 'rb-league-layout'), ranking = el('section'), calendar = el('section', 'rb-league-calendar');
    manager.append(pageHeading('La ligue', `Saison ${career.season} · Six clubs, dix journées, une place à prendre.`));
    ranking.append(el('h4', '', 'Classement'), table(['Club', 'Joués', 'V', 'N', 'D', 'Points'], rows.map((r) => [clubIdentity(career.clubs.find(c => c.id === r.clubId), { compact: true }), r.played, r.wins, r.draws, r.losses, r.points]), { highlight: rows.findIndex((r) => r.clubId === 'club'), caption: 'Classement de la saison. V : victoires, N : nuls, D : défaites.' }),
      el('p', 'rb-muted', 'Victoire : 3 points · nul : 1. Départage par victoires, puis ordre fixé en début de saison.'), disclosure('Primes de classement', 'league-prizes', el('p', 'rb-muted', '1er : 600 · 2e : 400 · 3e : 200 · 4e à 6e : 100 chromas.')));
    calendarDay = Math.min(9, Math.max(0, calendarDay ?? career.day));
    const day = keyed(select(Object.fromEntries(career.schedule.map((_, i) => [i, `Journée ${i + 1}${i < career.day ? ' · terminée' : i === career.day ? ' · à jouer' : ''}`])), calendarDay), 'calendar-day');
    day.addEventListener('change', () => { calendarDay = Number(day.value); renderManagement(); }); calendar.append(el('h4', '', 'Calendrier'), field('Journée à consulter', day));
    for (const f of career.schedule[calendarDay]) {
      const home = career.clubs.find((c) => c.id === f.homeId), away = career.clubs.find((c) => c.id === f.awayId), own = [f.homeId, f.awayId].includes('club');
      const row = el('div', `rb-fixture-row${own ? ' is-own' : ''}`);
      row.append(clubIdentity(home, { compact: true }), clubIdentity(away, { compact: true }), el('p', 'rb-muted', !f.result ? 'À jouer' : f.result.winnerId ? `Victoire : ${career.clubs.find((c) => c.id === f.result.winnerId).name}` : 'Match nul')); calendar.append(row);
    } layout.append(ranking, calendar); manager.append(layout);
    const opponents = disclosure('Clubs adverses et rotation', 'league-opponents');
    for (const club of career.clubs.slice(1)) { opponents.append(clubIdentity(club), el('p', 'rb-muted', club.style), table(['Joueur', 'Niveau', 'XP', 'Fatigue'], club.players.map((p) => [portraitIdentity(compilePlayer(p, []), clubKit(club), el('strong', '', p.name)), levelOf(p), p.xp, fatigue(p)]))); }
    manager.append(opponents);
    for (const past of career.seasonHistory) manager.append(disclosure(`Saison ${past.season} · classement final`, `season-${past.season}`, table(['Club', 'Points'], past.table.map((r, i) => [`${i + 1}. ${r.name}`, r.points]), { highlight: past.table.findIndex((r) => r.clubId === 'club') })));
  }
  function renderSummary(target) {
    target.replaceChildren();
    const summary = career.current.summary, panel = el('section', 'rb-career-summary');
    target.append(pageHeading('Bilan de la journée', `Face à ${career.current.config.teamNames.away}`));
    panel.append(el('p', 'rb-eyebrow', `Journée ${career.day} terminée`), el('h4', 'rb-result-title', resultLabel()));
    const metrics = el('div', 'rb-summary-metrics'); metrics.append(metric('Variation après salaires', `${signed(summary.reward + summary.seasonPrize - summary.wages)} chromas`), metric('Disponible à la fin de la journée', money(summary.available)), metric('Niveaux gagnés', String(summary.progress.reduce((sum, p) => sum + p.level - p.beforeLevel, 0)))); panel.append(metrics);
    for (const progress of summary.progress.filter((p) => p.level > p.beforeLevel)) {
      const owner = ownedPlayers(career).find((p) => p.id === progress.playerId), promotion = el('div', 'rb-level-gain');
      const label = el('strong', '', `${progress.name} · niveau ${progress.beforeLevel} → ${progress.level}`);
      promotion.append(owner ? portraitIdentity(compilePlayer(owner, career.inventory), clubKit(career.clubs[0]), label) : label);
      if (owner) {
        const before = compilePlayer({ ...owner, xp: XP_THRESHOLDS[progress.beforeLevel - 1], fatigue: 0, implant: null }), after = compilePlayer({ ...owner, xp: XP_THRESHOLDS[progress.level - 1], fatigue: 0, implant: null });
        promotion.append(comparison(before, after));
        for (const [key, label] of [['adrenaline', 'Adrénaline'], ['calls', 'Appels de jeu'], ['focus', 'Concentration']]) if (after.caps[key] > before.caps[key]) promotion.append(el('p', 'rb-gain', `${label} : ${before.caps[key]} → ${after.caps[key]}`));
      } panel.append(promotion);
    }
    panel.append(table(['Joueur', 'XP gagnée', 'Niveau', 'Fatigue'], summary.progress.map((p) => {
      const owner = ownedPlayers(career).find((player) => player.id === p.playerId);
      const name = owner ? portraitIdentity(compilePlayer(owner, career.inventory), clubKit(career.clubs[0]), el('strong', '', p.name)) : p.name;
      return [name, `+${p.xp}${p.ko ? ' · KO' : ''}`, p.level > p.beforeLevel ? `${p.beforeLevel} → ${p.level}` : p.level, `${p.beforeFatigue} → ${p.fatigue}/6`];
    })));
    panel.append(disclosure('Détail des primes et salaires', 'summary-finances', el('p', '', `Prime brute : ${money(summary.reward)} · Salaires prélevés au coup d’envoi : ${money(summary.wages)}${summary.seasonPrize ? ` · Prime de classement (${summary.rank}e) : ${money(summary.seasonPrize)}` : ''}`), el('p', 'rb-muted', `Dont ${money(summary.debtRepaid)} absorbés par les impayés. Ce remboursement est déjà compris dans le solde. Dette restante : ${money(summary.remainingDebt)}.`)));
    const actions = el('div', 'rb-controls'); actions.append(btn(career.day === 10 ? 'Retour au club · saison terminée' : 'Préparer la prochaine rencontre', () => go('Club'), true), btn('Faire tourner l’effectif', () => go('Club')), btn('Revoir le terrain et le fil du match · sans récompense supplémentaire', () => openMatch())); panel.append(actions); target.append(panel);
  }
  function showConfirmation(text, action, confirmLabel = 'Confirmer') {
    const dialog = el('dialog', 'rb-career-dialog'), actions = el('div', 'rb-controls');
    const originKey = document.activeElement?.dataset.focusKey;
    function close() { dialog.close(); dialog.remove(); if (originKey) [...root.querySelectorAll('button')].find((n) => n.dataset.focusKey === originKey)?.focus({ preventScroll: true }); }
    const copy = el('p', '', text), cancel = btn('Annuler', close); copy.id = `rb-career-confirm-${++confirmationId}`; dialog.setAttribute('aria-label', 'Confirmer cette opération'); dialog.setAttribute('aria-describedby', copy.id);
    dialog.append(copy); actions.append(btn(confirmLabel, () => { close(); action(); }, true), cancel); dialog.append(actions);
    dialog.addEventListener('cancel', (event) => { event.preventDefault(); close(); }); root.append(dialog); dialog.showModal(); cancel.focus();
  }
  function updateAndPlay() {
    attempt(() => {
      // Save the charged, frozen match before allowing the first simulated turn.
      if (unsaved && !save()) return;
      career = launchCareerMatch(career); formationUndo = null; if (save()) openMatch(true); else renderManagement();
    });
  }
  function openMatch(autoplay = false) {
    if (unsaved && !save()) return;
    modal.close();
    workspaceHeader({ navigation: null }); manager.hidden = true; matchArea.hidden = false; matchActions.hidden = false; view.load(career.current, autoplay, { kickoff: autoplay });
    matchArea.scrollIntoView({ block: 'start', behavior: 'instant' });
  }
  showMode('career');
}
