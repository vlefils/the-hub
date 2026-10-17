import { ROLES, ROLE_DESCRIPTIONS, INSTRUCTIONS, STRATEGIES, STARTS } from './data.mjs';
import { ARCHETYPES, archetypeLabel, classAbilities } from './classes.mjs';
import { CATALOGUE, XP_THRESHOLDS, compilePlayer, levelOf, salary, recruitmentPrice } from './progression.mjs';
import { createCareer, confirmDraft, configureTeam, setClubColor, ownedPlayers, payroll, nextFixture, managementLocked, purchaseBlock, recruit, sellPlayer, buyItem, assignProtection, sellProtection, launchCareerMatch, saveCareerTurn, nextSeason, standings } from './career.mjs';
import { loadCareer, persistCareer, exportCareer, importCareer } from './career-storage.mjs';
import { KIT_COLORS, clubKit } from './appearance.mjs';
import { playerPortrait } from './visuals.mjs';
import { deploymentEditor } from './deployment-ui.mjs';
import { clubDeployment } from './deployment.mjs';
import { clubOpening, openingDeployment } from './openings.mjs';
import { openingPicker } from './opening-ui.mjs';
import { el, btn, field, select, money, signed, keyed, kitPicker, portraitIdentity, pageHeading, metric, table, stats, statList, xpProgress, fatigue, comparison, equipmentSlots, disclosure } from './career-components.mjs';
function download(text, filename) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' })), a = el('a'); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function mountCareer(root, mountMatch) {
  root.replaceChildren(); root.classList.add('rb');
  // Access localStorage lazily, including browsers that reject the property getter.
  const storage = { getItem: (key) => window.localStorage.getItem(key), setItem: (key, value) => window.localStorage.setItem(key, value) };
  const loaded = loadCareer(storage);
  let career = loaded.career, tab = 'Club', teamView = 'Effectif', mode = 'career', unsaved = false, selectedPlayer = null, selectedShopPlayer = null, draftIds = new Set(), pendingImport = null;
  let rosterSort = 'lineup', rosterDetailOpen = false, rosterScroll = 0, marketFilter = '', comparePlayer = null, calendarDay = null, formationUndo = null;
  const sectionScroll = new Map(); let confirmationId = 0;
  const top = el('div', 'rb-career-top'), modes = el('div', 'rb-controls'), tools = el('div', 'rb-controls');
  const careerMode = btn('Carrière', () => showMode('career')), exhibitionMode = btn('Exhibition', () => showMode('exhibition'));
  modes.setAttribute('aria-label', 'Mode de jeu'); modes.append(careerMode, exhibitionMode);
  const exportButton = btn('Exporter', () => attempt(() => download(exportCareer(career), `rumbleball-saison-${career.season}.json`)));
  const importInput = el('input'); importInput.type = 'file'; importInput.accept = '.json,application/json'; importInput.hidden = true;
  const importButton = btn('Importer', () => importInput.click());
  const retry = btn('Réessayer la sauvegarde', () => { save(); renderManagement(); }); retry.hidden = true;
  const saveStatus = el('span', 'rb-save-status', 'Sauvegarde locale automatique'); saveStatus.setAttribute('role', 'status'); saveStatus.setAttribute('aria-live', 'polite');
  const saveTools = disclosure('Sauvegarde', 'save-tools', el('p', 'rb-muted', 'Cette carrière est conservée dans ce navigateur. Exportez une copie pour la garder sur un autre appareil.'), exportButton, importButton, importInput);
  tools.append(saveStatus, saveTools, retry); top.append(modes, tools);
  const notice = el('p', 'rb-career-notice'); notice.setAttribute('role', 'alert'); notice.hidden = !loaded.error; notice.textContent = loaded.error ?? '';
  const importPreview = el('section', 'rb-career-import'); importPreview.hidden = true;
  const manager = el('div', 'rb-career'), matchArea = el('div', 'rb-match-area'), matchActions = el('div', 'rb-controls rb-match-back'), matchRoot = el('div');
  matchActions.append(btn('Retour au club · mettre en pause', () => { view.pause(); matchArea.hidden = true; manager.hidden = false; if (career.current?.settled) tab = 'Bilan'; renderManagement(); }));
  matchArea.append(matchActions, matchRoot); matchArea.hidden = true;
  root.append(top, notice, importPreview, manager, matchArea);
  const view = mountMatch(matchRoot, {
    onTurn(state, events) {
      career = saveCareerTurn(career, state, events);
      if (career.current?.settled) { calendarDay = null; formationUndo = null; }
      return save();
    },
    onReturn() { matchArea.hidden = true; manager.hidden = false; if (career.current?.settled) tab = 'Bilan'; renderManagement(); manager.scrollIntoView({ block: 'start', behavior: 'instant' }); },
  });
  function attempt(action) { try { action(); } catch (error) { notice.hidden = false; notice.textContent = error.message; } }
  function save() {
    try { persistCareer(storage, career); unsaved = false; retry.hidden = true; notice.hidden = true; if (saveStatus.textContent !== 'Enregistré dans ce navigateur') saveStatus.textContent = 'Enregistré dans ce navigateur'; return true; }
    catch (error) { unsaved = true; retry.hidden = false; if (saveStatus.textContent !== 'Progression non enregistrée') saveStatus.textContent = 'Progression non enregistrée'; notice.hidden = false; notice.textContent = `Progression non enregistrée : ${error.message} La dernière sauvegarde valide est conservée. Réessayez ou exportez votre progression avant de fermer cette page.`; return false; }
  }
  function update(action) { attempt(() => { career = action(); save(); renderManagement(); }); }
  function blocked(b, reason) { b.disabled = Boolean(reason); if (reason) b.title = reason; return b; }
  function go(nextTab, nextTeamView = teamView) {
    sectionScroll.set(`${tab}:${teamView}`, window.scrollY ?? 0);
    tab = nextTab; teamView = nextTeamView; renderManagement(false);
    const heading = manager.querySelector('.rb-section-heading')?.querySelector('h3'); heading?.focus({ preventScroll: true });
    window.scrollTo?.({ top: sectionScroll.get(`${tab}:${teamView}`) ?? 0, behavior: 'instant' });
  }
  function showMode(nextMode) {
    view.pause(); mode = nextMode; importPreview.hidden = true;
    if (mode === 'exhibition') { manager.hidden = true; matchArea.hidden = false; matchActions.hidden = true; view.exhibition(); }
    else { matchArea.hidden = true; manager.hidden = false; matchActions.hidden = false; renderManagement(); }
    careerMode.setAttribute('aria-pressed', String(mode === 'career')); exhibitionMode.setAttribute('aria-pressed', String(mode === 'exhibition'));
  }
  importInput.addEventListener('change', async () => {
    const file = importInput.files[0]; importInput.value = ''; if (!file) return;
    try {
      if (managementLocked(career ?? {})) throw new Error('Terminez la rencontre avant de remplacer la carrière.');
      if (file.size > 8_000_000) throw new Error('Fichier JSON trop volumineux.');
      pendingImport = importCareer(await file.text());
      if (managementLocked(career ?? {})) throw new Error('Terminez la rencontre avant de remplacer la carrière.');
      importPreview.replaceChildren(el('h3', '', 'Importer cette carrière'), el('p', '', `${pendingImport.clubs[0].name} · saison ${pendingImport.season} · ${money(pendingImport.balance)}. La carrière locale actuelle sera remplacée.`),
        btn('Confirmer le remplacement', () => attempt(() => { if (managementLocked(career ?? {})) throw new Error('Terminez la rencontre avant de remplacer la carrière.'); view.pause(); career = pendingImport; pendingImport = null; draftIds.clear(); selectedPlayer = selectedShopPlayer = comparePlayer = calendarDay = formationUndo = null; tab = 'Club'; teamView = 'Effectif'; sectionScroll.clear(); importPreview.hidden = true; save(); showMode('career'); }), true),
        btn('Annuler', () => { pendingImport = null; importPreview.hidden = true; }));
      importPreview.hidden = false;
    } catch (error) { notice.hidden = false; notice.textContent = `Import refusé : ${error.message}`; }
  });
  function renderManagement(preserve = true) {
    const focusKey = preserve && manager.contains(document.activeElement) ? document.activeElement.dataset.focusKey : null;
    const scroll = window.scrollY ?? 0, openKeys = new Set([...manager.querySelectorAll('details')].filter((n) => n.open).map((n) => n.dataset.sectionKey));
    manager.replaceChildren(); exportButton.disabled = !career; importButton.disabled = managementLocked(career ?? {});
    if (!career) { renderCreation(); restoreContext(); return; }
    if (career.status === 'draft') { renderDraft(); restoreContext(); return; }
    const locked = managementLocked(career), club = career.clubs[0], fixture = nextFixture(career);
    const opponent = fixture ? career.clubs.find((c) => c.id === (fixture.homeId === 'club' ? fixture.awayId : fixture.homeId)) : null;
    const header = el('header', 'rb-club-header'), identity = el('div');
    identity.append(el('p', 'rb-eyebrow', `Saison ${career.season} · ${career.day}/10 journées terminées`), el('h3', '', club.name));
    const finances = el('dl', 'rb-career-finances');
    const amounts = [['Solde', money(career.balance), career.balance < 0 ? 'rb-away' : ''], ['Prochains salaires', money(payroll(career)), '']];
    if (career.balance < 0) amounts.push(['Salaires impayés', money(-career.balance), 'rb-away']);
    for (const [label, value, cls] of amounts) {
      const item = el('div'); item.append(el('dt', 'rb-muted', label), el('dd', cls, value)); finances.append(item);
    }
    const headerActions = el('div', 'rb-header-actions'); headerActions.append(finances);
    if (!locked && opponent && tab !== 'Club' && !(tab === 'Équipe' && teamView === 'Préparation') && tab !== 'Bilan') headerActions.append(btn('Préparer le match', () => go('Équipe', 'Préparation')));
    header.append(identity, headerActions); manager.append(header);
    if (locked) {
      const matchStrip = el('div', 'rb-next-match');
      matchStrip.append(el('p', '', `Rencontre en cours contre ${career.current.config.teamNames.away}. Gestion en lecture seule. La reprise se fait en pause.`), btn('Reprendre la rencontre', () => openMatch(), true));
      manager.append(matchStrip);
    }
    if (career.balance < 0) manager.append(el('p', 'rb-career-debt', 'Achats bloqués. Primes et ventes remboursent les salaires impayés. Vous pouvez jouer, modifier la composition et transférer vos protections gratuitement.'));
    const destinations = ['Club', 'Équipe', 'Recrutement', 'Équipement', 'Ligue'];
    const tabs = el('nav', 'rb-career-tabs'); tabs.setAttribute('aria-label', 'Gestion du club');
    for (const label of destinations) { const b = keyed(btn(label, () => go(label)), `nav-${label}`); b.setAttribute('aria-current', tab === label ? 'page' : 'false'); tabs.append(b); }
    const mobileDestinations = Object.fromEntries(destinations.map((label) => [label, label])); if (tab === 'Bilan') mobileDestinations.Bilan = 'Bilan de la journée';
    const mobileNav = keyed(select(mobileDestinations, tab), 'mobile-section');
    mobileNav.addEventListener('change', () => go(mobileNav.value)); const mobileField = field('Menu du club', mobileNav); mobileField.classList.add('rb-mobile-nav'); manager.append(tabs, mobileField);
    if (tab === 'Club') renderClub(locked, fixture, opponent);
    if (tab === 'Équipe') {
      const subnav = el('nav', 'rb-team-tabs'); subnav.setAttribute('aria-label', 'Vues de l’équipe');
      for (const label of ['Effectif', 'Préparation']) { const b = btn(label, () => go('Équipe', label)); b.setAttribute('aria-current', teamView === label ? 'page' : 'false'); subnav.append(b); } manager.append(subnav);
      if (teamView === 'Effectif') renderRoster(locked); else renderPreparation(locked);
    }
    if (tab === 'Recrutement') renderMarket(locked);
    if (tab === 'Équipement') renderEquipment(locked);
    if (tab === 'Ligue') renderLeague();
    if (tab === 'Bilan' && career.current?.settled) renderSummary();
    restoreContext();
    function restoreContext() {
      if (!preserve) return;
      for (const node of manager.querySelectorAll('details')) if (openKeys.has(node.dataset.sectionKey)) node.open = true;
      if (focusKey) {
        const target = [...manager.querySelectorAll('button'), ...manager.querySelectorAll('select'), ...manager.querySelectorAll('input')].find((node) => node.dataset.focusKey === focusKey);
        (target ?? manager.querySelector('.rb-section-heading')?.querySelector('h3'))?.focus({ preventScroll: true });
      }
      window.scrollTo?.({ top: scroll, behavior: 'instant' });
    }
  }
  function renderClub(locked, fixture, opponent) {
    manager.append(pageHeading('Le club', 'Votre équipe, la prochaine affiche et les décisions de la journée.'));
    const layout = el('div', 'rb-club-overview'), hero = el('section', 'rb-fixture-hero');
    hero.append(el('p', 'rb-eyebrow', locked ? 'Rencontre en cours' : opponent ? `Prochaine affiche · Journée ${career.day + 1}` : 'Saison terminée'));
    if (opponent || locked) {
      hero.append(el('h4', '', locked ? career.current.config.teamNames.away : opponent.name), el('p', 'rb-muted', locked ? 'Retrouvez votre rencontre en pause. Les réglages sont figés jusqu’au bilan.' : `${fixture.homeId === 'club' ? 'À domicile' : 'À l’extérieur'} · ${opponent.style} · match de 2 minutes`));
      if (!locked) hero.append(btn('Préparer le match', () => go('Équipe', 'Préparation'), true));
      const line = el('div', 'rb-team-preview');
      for (const [index, id] of career.lineup.entries()) {
        const p = ownedPlayers(career).find((p) => p.id === id), b = btn('', () => { selectedPlayer = id; rosterDetailOpen = true; go('Équipe', 'Effectif'); });
        b.setAttribute('aria-label', `Voir ${p.name}, titulaire ${index + 1}`); b.append(playerPortrait({ ...compilePlayer(p, career.inventory), number: index + 1 }, clubKit(career.clubs[0])), el('small', '', p.name)); line.append(b);
      } hero.append(line);
    } else {
      const rank = standings(career).findIndex((r) => r.clubId === 'club') + 1;
      hero.append(el('h4', '', `${rank}${rank === 1 ? 'er' : 'e'} de la ligue`), el('p', 'rb-muted', 'Une nouvelle saison vous attend. Joueurs, niveaux, matériel et solde sont conservés ; la fatigue revient à zéro.'), btn('Commencer la saison suivante', () => { calendarDay = null; formationUndo = null; update(() => nextSeason(career)); }, true));
    }
    const side = el('section', 'rb-season-overview'), rows = standings(career), own = rows.find((r) => r.clubId === 'club'), rank = rows.indexOf(own) + 1;
    side.append(el('p', 'rb-eyebrow', `Saison ${career.season}`), metric('Votre classement', `${rank}${rank === 1 ? 'er' : 'e'} / 6`, `${own.points} points · ${own.wins} victoire${own.wins > 1 ? 's' : ''}`));
    const seasonProgress = el('progress'); seasonProgress.max = 10; seasonProgress.value = career.day; seasonProgress.setAttribute('aria-label', `${career.day} journées terminées sur 10`);
    side.append(seasonProgress, el('p', 'rb-muted', `${career.day}/10 journées terminées`), btn('Consulter la ligue', () => go('Ligue')));
    layout.append(hero, side); manager.append(layout);
    const attention = el('div', 'rb-club-attention'), tired = ownedPlayers(career).filter((p) => career.lineup.includes(p.id) && p.fatigue >= 3);
    if (tired.length) attention.append(el('p', '', `${tired.length} titulaire${tired.length > 1 ? 's' : ''} ralenti${tired.length > 1 ? 's' : ''} par la fatigue.`), btn('Faire tourner l’équipe', () => go('Équipe', 'Préparation')));
    else attention.append(el('p', '', 'Vos cinq titulaires jouent sans malus de fatigue.'), btn('Voir l’effectif', () => go('Équipe', 'Effectif')));
    manager.append(attention);
    if (career.current?.settled) {
      const summary = career.current.summary, last = el('section', 'rb-last-result');
      last.append(el('p', 'rb-eyebrow', 'Dernière rencontre'), el('h4', '', `${resultLabel()} face à ${career.current.config.teamNames.away}`), el('p', 'rb-muted', `${signed(summary.reward + summary.seasonPrize - summary.wages)} chromas après salaires · ${summary.progress.filter((p) => p.level > p.beforeLevel).length} montée(s) de niveau`), btn('Voir le bilan', () => go('Bilan'))); manager.append(last);
    }
    const finances = el('div', 'rb-finance-overview'); finances.append(metric('Solde actuel', money(career.balance)), metric('Prochaine masse salariale', money(payroll(career)), `${ownedPlayers(career).length} joueurs, remplaçants compris`), metric('Après les prochains salaires', money(career.balance - payroll(career)), 'Avant toute prime de match'));
    const ledger = table(['Opération', 'Montant', 'Solde'], [...career.transactions].reverse().map((t) => [t.label, `${signed(t.amount)} chromas`, money(t.balance)]));
    manager.append(disclosure('Finances du club', 'club-finances', finances, ledger));
    const color = kitPicker(clubKit(career.clubs[0]), locked), kitPreview = el('div', 'rb-kit-preview');
    function updateKitPreview() { kitPreview.replaceChildren(...career.lineup.slice(0, 4).map((id) => playerPortrait(compilePlayer(ownedPlayers(career).find((p) => p.id === id), career.inventory), color.value))); }
    updateKitPreview(); color.addEventListener('input', updateKitPreview); color.addEventListener('change', () => attempt(() => { career = setClubColor(career, color.value); save(); renderManagement(); }));
    manager.append(disclosure('Identité du club', 'club-identity', field('Couleur des maillots', color), kitPreview, el('p', 'rb-muted', 'Le changement de tenue est gratuit. Les apparences des joueurs sont conservées.')));
  }
  function resultLabel() { return career.current.state.result.winnerId === 'home' ? 'Victoire' : career.current.state.result.winnerId === 'away' ? 'Défaite' : 'Match nul'; }
  function renderCreation() {
    const welcome = el('section', 'rb-career-welcome'), introduction = el('div', 'rb-career-introduction');
    introduction.append(el('p', 'rb-eyebrow', 'Bienvenue dans l’arène'), el('h2', '', 'Du chrome. Du contact. Un club à vous.'), el('p', '', 'Recrutez vos cinq titulaires, préparez vos tactiques et regardez-les se disputer le ballon. Deux minutes pour le tenir jusqu’à la sirène.'));
    const steps = el('ol', 'rb-career-steps');
    for (const [title, copy] of [['Recrutez', 'Quatre archétypes, des équipements et des implants.'], ['Préparez', 'Vos rôles, vos consignes, votre placement.'], ['Entrez dans l’arène', 'Les joueurs agissent seuls. Le club progresse avec vous.']]) { const step = el('li'); step.append(el('strong', '', title), el('span', '', copy)); steps.append(step); }
    introduction.append(steps);
    const form = el('form', 'rb-career-create'), input = el('input'); input.required = true; input.maxLength = 80; input.placeholder = 'Les Rebuts du Chrome';
    form.append(el('p', 'rb-eyebrow', 'Rumbleball Manager'), el('h3', '', 'Fonder votre club'), el('p', 'rb-muted', '2 400 chromas pour recruter cinq à huit joueurs. Une ligue de six clubs, dix journées par saison, cinq titulaires par match. Votre carrière est sauvegardée dans ce navigateur.'), field('Nom du club', input));
    const color = kitPicker(KIT_COLORS[0]), preview = el('div', 'rb-kit-preview');
    const showKit = () => preview.replaceChildren(...[0, 1, 2, 4].map((profile) => playerPortrait(compilePlayer({ id: `preview-${profile}`, name: 'Aperçu', profile, xp: 0, fatigue: 0 }), color.value)));
    color.addEventListener('input', showKit); showKit(); form.append(field('Couleur des maillots', color), preview);
    let replace;
    if (loaded.hasSave) { replace = el('input'); replace.type = 'checkbox'; replace.required = true; form.append(field('Remplacer la sauvegarde existante, après avoir conservé une copie si nécessaire.', replace)); }
    const submit = btn('Choisir les premières recrues', () => {}, true); submit.type = 'submit'; form.append(submit);
    form.addEventListener('submit', (event) => { event.preventDefault(); const seed = `club-${crypto.getRandomValues(new Uint32Array(1))[0].toString(36)}`; update(() => createCareer(input.value, seed, color.value)); });
    welcome.append(introduction, form); manager.append(welcome);
  }
  function renderDraft() {
    manager.append(el('p', 'rb-eyebrow', career.clubs[0].name), el('h3', '', 'Choisir votre effectif initial'), el('p', 'rb-muted', 'Sélection réversible. Les contrats sont payés ensemble à la validation. Les cinq premières recrues sélectionnées seront titulaires ; leur ordre restera modifiable.'));
    const color = kitPicker(clubKit(career.clubs[0])); color.addEventListener('change', () => update(() => setClubColor(career, color.value))); manager.append(field('Couleur des maillots', color));
    const list = el('div', 'rb-candidate-list'), footer = el('div', 'rb-draft-total'), total = el('strong'), confirm = btn('Valider les contrats', () => update(() => confirmDraft(career, [...draftIds])), true);
    function totals() { const chosen = career.market.filter((p) => draftIds.has(p.id)), cost = chosen.reduce((sum, p) => sum + recruitmentPrice(p), 0), wages = chosen.reduce((sum, p) => sum + salary(p), 0); total.textContent = `${draftIds.size}/8 joueurs · contrats ${money(cost)} · reste ${money(2400 - cost)} · après les premiers salaires : ${money(2400 - cost - wages)}${2400 - cost - wages < 0 ? ' (salaires impayés autorisés)' : ''}`; confirm.disabled = draftIds.size < 5 || draftIds.size > 8 || cost > 2400; }
    for (const p of career.market) {
      const row = el('label', 'rb-candidate'), checkbox = el('input'); checkbox.type = 'checkbox'; checkbox.checked = draftIds.has(p.id);
      checkbox.addEventListener('change', () => { if (checkbox.checked) draftIds.add(p.id); else draftIds.delete(p.id); totals(); });
      const compiled = compilePlayer(p), copy = el('div'); copy.append(el('strong', '', p.name), el('span', 'rb-archetype', archetypeLabel(compiled)), el('small', 'rb-muted', stats(compiled)));
      row.append(checkbox, portraitIdentity(compiled, clubKit(career.clubs[0]), copy), el('span', '', money(recruitmentPrice(p)))); list.append(row);
    }
    totals(); footer.append(total, confirm); manager.append(list, footer);
  }
  function renderRoster(locked) {
    const players = ownedPlayers(career);
    selectedPlayer = players.some((p) => p.id === selectedPlayer) ? selectedPlayer : career.lineup[0];
    manager.append(pageHeading(`Effectif · ${players.length}/8`, 'Comparez vos joueurs, surveillez leur fatigue et préparez la rotation.'));
    const sort = keyed(select({ lineup: 'Titulaires d’abord', fatigue: 'Fatigue croissante', level: 'Niveau décroissant' }, rosterSort), 'roster-sort');
    sort.addEventListener('change', () => { rosterSort = sort.value; renderManagement(); });
    const toolbar = el('div', 'rb-roster-toolbar'); toolbar.append(field('Ordre des joueurs', sort), btn('Préparer l’équipe', () => go('Équipe', 'Préparation'))); manager.append(toolbar);
    const workspace = el('div', `rb-roster-workspace${rosterDetailOpen ? ' is-detail-open' : ''}`), detail = el('section', 'rb-player-detail'), rowButtons = new Map();
    const sorted = [...players].sort((a, b) => rosterSort === 'fatigue' ? a.fatigue - b.fatigue : rosterSort === 'level' ? b.xp - a.xp : (career.lineup.indexOf(a.id) < 0 ? 9 : career.lineup.indexOf(a.id)) - (career.lineup.indexOf(b.id) < 0 ? 9 : career.lineup.indexOf(b.id)));
    const rows = sorted.map((p) => {
      const index = career.lineup.indexOf(p.id), compiled = compilePlayer(p, career.inventory), pick = keyed(btn('', () => {
        rosterScroll = window.scrollY ?? 0;
        selectedPlayer = p.id; rosterDetailOpen = true; workspace.classList.add('is-detail-open'); renderDetail();
        for (const [id, b] of rowButtons) b.setAttribute('aria-pressed', String(id === selectedPlayer));
        if (globalThis.matchMedia?.('(max-width: 1250px)').matches) detail.scrollIntoView({ block: 'start', behavior: 'instant' });
        detail.querySelector('h4')?.focus({ preventScroll: true });
      }), `player-${p.id}`);
      pick.setAttribute('aria-pressed', String(p.id === selectedPlayer)); pick.append(portraitIdentity(compiled, clubKit(career.clubs[0]), el('strong', '', p.name), el('small', 'rb-muted', ARCHETYPES[compiled.archetype].name))); rowButtons.set(p.id, pick);
      return [pick, el('span', 'rb-player-status', index < 0 ? 'Remplaçant' : `Titulaire ${index + 1}`), xpProgress(p), fatigue(p), el('span', 'rb-salary', money(salary(p)))];
    });
    const list = table(['Joueur', 'Place', 'Progression', 'Fatigue', 'Salaire / j.'], rows, { caption: 'Effectif du club : sélectionnez un joueur pour consulter sa fiche.' }); list.classList.add('rb-roster-table');
    workspace.append(list, detail); manager.append(workspace); renderDetail();
    function renderDetail() {
      const p = ownedPlayers(career).find((p) => p.id === selectedPlayer), compiled = compilePlayer(p, career.inventory), title = el('h4', '', p.name); title.setAttribute('tabindex', '-1');
      detail.replaceChildren(); const back = btn('← Retour à l’effectif', () => { rosterDetailOpen = false; workspace.classList.toggle('is-detail-open', false); rowButtons.get(p.id)?.focus({ preventScroll: true }); window.scrollTo?.({ top: rosterScroll, behavior: 'instant' }); }); back.classList.add('rb-detail-back');
      detail.append(back, el('p', 'rb-eyebrow', 'Fiche joueur'), portraitIdentity(compiled, clubKit(career.clubs[0]), title, el('p', 'rb-archetype', archetypeLabel(compiled))), xpProgress(p), el('small', 'rb-muted', `${p.xp} XP cumulée · ${money(salary(p))} par journée`), fatigue(p), statList(compiled), el('p', 'rb-muted', `Mission : ${ROLES[p.role]} · ${INSTRUCTIONS[p.instruction]}`), equipmentSlots(p, career.inventory));
      const actions = el('div', 'rb-controls'); actions.append(btn('Gérer son équipement', () => { selectedShopPlayer = p.id; go('Équipement'); }), btn('Ouvrir la préparation', () => go('Équipe', 'Préparation'))); detail.append(actions);
      const techniques = disclosure('Techniques et réserves de classe', `techniques-${p.id}`); for (const [label, description] of classAbilities(compiled)) techniques.append(el('h4', '', label), el('p', 'rb-muted', description)); detail.append(techniques);
      const fresh = compilePlayer({ ...p, fatigue: 0, implant: null }), effective = comparison(fresh, compiled, null, p.implant);
      detail.append(disclosure('Origine des modificateurs', `modifiers-${p.id}`, el('p', 'rb-muted', 'Écart avec ce même joueur à son niveau actuel, sans équipement et sans fatigue.'), effective));
      const reason = locked ? 'Rencontre en cours.' : players.length <= 5 ? 'Cinq joueurs minimum.' : '';
      const sell = keyed(blocked(btn(`Céder · ${money(recruitmentPrice(p) / 2)}`, () => showConfirmation(`Céder ${p.name} pour ${money(recruitmentPrice(p) / 2)} ? Son implant quitte le club ; sa protection retourne en réserve.`, () => update(() => sellPlayer(career, p.id)))), reason), `sell-${p.id}`); sell.classList.add('rb-quiet-action'); detail.append(sell); if (reason) detail.append(el('small', 'rb-muted', reason));
    }
  }
  function renderPreparation(locked) {
    manager.append(pageHeading('Préparer la rencontre', 'Cinq titulaires, un plan collectif et votre placement au coup d’envoi.'));
    const form = el('form', 'rb-lineup-form'), strategy = keyed(select(STRATEGIES, career.clubs[0].strategy), 'strategy'); strategy.disabled = locked;
    const preparation = el('div', 'rb-preparation'), teamControls = el('div', 'rb-team-controls'), teamPlans = el('div', 'rb-team-plans');
    const assignments = Object.fromEntries(ownedPlayers(career).map((p) => [p.id, { role: p.role, instruction: p.instruction }]));
    const lineup = el('div', 'rb-lineup-slots'), slotControls = [], slotCopies = [], active = el('section', 'rb-tactical-player'), bench = el('div', 'rb-bench');
    const names = Object.fromEntries(ownedPlayers(career).map((p) => [p.id, p.name]));
    selectedPlayer = career.lineup.includes(selectedPlayer) ? selectedPlayer : career.lineup[0];
    const deploymentPlayers = () => career.lineup.map((id) => compilePlayer(ownedPlayers(career).find((p) => p.id === id), career.inventory));
    const positions = locked ? career.current.config.deployments?.home ?? STARTS.map(([x, y]) => ({ x, y })) : clubDeployment(career.clubs[0]);
    const deployment = deploymentEditor({ players: deploymentPlayers(), positions, color: clubKit(career.clubs[0]), disabled: locked, selectedPlayerId: selectedPlayer,
      onSelect: (id) => { selectedPlayer = id; renderActive(); }, onChange: () => attempt(commitLineup) });
    const undo = btn('Rétablir le placement précédent', () => attempt(() => { if (!formationUndo || locked) return; deployment.update({ positions: formationUndo.positions }); opening.update(formationUndo.opening); formationUndo = null; undo.hidden = true; commitLineup(); })); undo.hidden = !formationUndo; undo.disabled = locked;
    const opening = openingPicker({ value: locked ? career.current.config.openings?.home ?? 'none' : clubOpening(career.clubs[0]), disabled: locked,
      onChange: (value) => attempt(() => { formationUndo = { positions: deployment.value, opening: clubOpening(career.clubs[0]) }; deployment.update({ positions: openingDeployment(value) }); undo.hidden = false; commitLineup(); }) });
    const strategyHelp = el('p', 'rb-muted');
    function describeStrategy() { strategyHelp.textContent = { balanced: 'Une répartition équilibrée entre progression, soutien et défense.', possession: 'Privilégie la conservation du ballon et les relais entre partenaires.', pressing: 'Met la pression sur le porteur adverse et conteste les accès au ballon.' }[strategy.value]; }
    describeStrategy(); teamPlans.append(field('Plan collectif', strategy), strategyHelp, opening.root, undo); form.append(teamPlans);
    teamControls.append(el('h4', '', 'Les cinq titulaires'), lineup, active, bench);
    for (const [index, id] of career.lineup.entries()) {
      const s = keyed(select(names, id), `lineup-${index}`); s.disabled = locked; slotControls.push(s);
      const row = el('div', 'rb-lineup-slot'), copy = el('div', 'rb-slot-copy'), pick = btn('Régler', () => { selectedPlayer = s.value; deployment.update({ selectedPlayerId: selectedPlayer }); renderActive(); });
      pick.classList.add('rb-slot-select'); pick.setAttribute('aria-label', `Sélectionner le titulaire ${index + 1} sur le terrain`);
      row.append(field(`Titulaire ${index + 1}`, s), copy, pick); lineup.append(row); slotCopies.push({ row, copy });
      s.addEventListener('change', () => attempt(() => {
        const duplicate = slotControls.find((other, otherIndex) => otherIndex !== index && other.value === s.value);
        if (duplicate) duplicate.value = career.lineup[index]; selectedPlayer = s.value; commitLineup(); renderActive();
      }));
    }
    const formNotice = el('p', 'rb-form-status', 'Toute modification est enregistrée automatiquement.'); formNotice.setAttribute('role', 'status');
    function refreshSlots() {
      for (const [index, { row, copy }] of slotCopies.entries()) {
        const p = ownedPlayers(career).find((p) => p.id === slotControls[index].value);
        row.classList.toggle('is-selected', p.id === selectedPlayer); copy.replaceChildren(portraitIdentity(compilePlayer(p, career.inventory), clubKit(career.clubs[0]), el('small', 'rb-muted', `${ROLES[p.role]} · ${INSTRUCTIONS[p.instruction]}`)), fatigue(p));
      }
      const target = ownedPlayers(career).find((p) => p.id === selectedPlayer);
      bench.replaceChildren(el('h4', '', 'Remplaçants'));
      const reserves = ownedPlayers(career).filter((p) => !career.lineup.includes(p.id));
      if (!reserves.length) bench.append(el('p', 'rb-muted', 'Aucun remplaçant. Un joueur au repos récupère 3 fatigue et gagne 4 XP.'));
      else bench.append(el('p', 'rb-muted', `Entrer à la place de ${target.name}. Sélectionnez un autre titulaire avec « Régler » pour changer la cible.`));
      for (const p of reserves) {
        const b = keyed(blocked(btn(`Faire entrer ${p.name}`, () => { const index = Math.max(0, career.lineup.indexOf(selectedPlayer)); slotControls[index].value = p.id; selectedPlayer = p.id; attempt(() => { commitLineup(); renderActive(); active.querySelector('select')?.focus({ preventScroll: true }); }); }), locked ? 'Rencontre en cours.' : ''), `bench-${p.id}`);
        const row = el('div', 'rb-bench-player'); row.append(portraitIdentity(compilePlayer(p, career.inventory), clubKit(career.clubs[0]), el('strong', '', p.name)), fatigue(p), b); bench.append(row);
      }
    }
    function renderActive() {
      const p = ownedPlayers(career).find((p) => p.id === selectedPlayer); if (!p) return;
      const role = keyed(select(ROLES, assignments[p.id].role), 'active-role'), instruction = keyed(select(INSTRUCTIONS, assignments[p.id].instruction), 'active-instruction'); role.disabled = instruction.disabled = locked;
      const help = el('p', 'rb-muted', ROLE_DESCRIPTIONS[role.value]);
      active.replaceChildren(el('p', 'rb-eyebrow', 'Réglages du joueur sélectionné'), el('h4', '', p.name), field('Rôle · sa mission', role), field('Consigne · son comportement', instruction), help);
      for (const control of [role, instruction]) control.addEventListener('change', () => attempt(() => { assignments[p.id] = { role: role.value, instruction: instruction.value }; commitLineup(); help.textContent = ROLE_DESCRIPTIONS[role.value]; }));
      refreshSlots();
    }
    function commitLineup() {
      career = configureTeam(career, slotControls.map((s) => s.value), assignments, strategy.value, deployment.value, opening.value);
      const saved = save(); deployment.update({ players: deploymentPlayers(), selectedPlayerId: selectedPlayer }); refreshSlots();
      const message = saved ? 'Composition, placement et consignes enregistrés.' : 'Modifications en mémoire ; sauvegarde à réessayer.'; if (formNotice.textContent !== message) formNotice.textContent = message;
    }
    strategy.addEventListener('change', () => attempt(() => { describeStrategy(); commitLineup(); }));
    preparation.append(deployment.root, teamControls); form.append(preparation, formNotice);
    const launch = el('div', 'rb-launch-bar'), copy = el('div');
    copy.append(el('strong', '', locked ? 'Composition figée pour cette rencontre' : !nextFixture(career) ? 'La saison est terminée' : `${money(payroll(career))} de salaires au coup d’envoi`), el('p', 'rb-muted', locked ? 'Terminez le match pour modifier votre équipe.' : !nextFixture(career) ? 'Commencez la saison suivante depuis Club.' : `Solde après prélèvement : ${money(career.balance - payroll(career))}. Les primes seront versées après le match.`));
    launch.append(copy, blocked(btn('Lancer la rencontre', () => updateAndPlay(), true), locked ? 'Rencontre déjà en cours.' : !nextFixture(career) ? 'La saison est terminée. Commencez la suivante depuis Club.' : '')); form.append(launch);
    form.addEventListener('submit', (event) => event.preventDefault()); manager.append(form); renderActive();
    manager.append(disclosure('Comprendre la préparation', 'preparation-help', el('p', 'rb-muted', 'L’archétype définit les techniques. Le rôle donne une mission ; la consigne règle le comportement. Le plan collectif guide l’équipe, tandis que l’ouverture fixe le placement et le premier tour. Choisir un titulaire déjà présent échange leurs positions. Aucun remplacement pendant le match.')));
  }
  function renderMarket(locked) {
    manager.append(pageHeading('Marché des recrues', `${ownedPlayers(career).length}/8 places occupées · Offres conservées jusqu’à la fin de la journée, puis six nouvelles recrues.`));
    comparePlayer = ownedPlayers(career).some((p) => p.id === comparePlayer) ? comparePlayer : career.lineup[0];
    const filter = keyed(select({ '': 'Tous les archétypes', ...Object.fromEntries(Object.entries(ARCHETYPES).map(([id, a]) => [id, a.name])) }, marketFilter), 'market-filter');
    const compare = keyed(select(Object.fromEntries(ownedPlayers(career).map((p) => [p.id, p.name])), comparePlayer), 'market-compare');
    filter.addEventListener('change', () => { marketFilter = filter.value; renderManagement(); }); compare.addEventListener('change', () => { comparePlayer = compare.value; renderManagement(); });
    const controls = el('div', 'rb-market-controls'); controls.append(field('Archétype recherché', filter), field('Comparer avec', compare)); manager.append(controls);
    const existing = ownedPlayers(career).find((p) => p.id === comparePlayer), reference = compilePlayer(existing, career.inventory), list = el('div', 'rb-career-roster rb-market-list');
    const offers = career.market.filter((p) => !marketFilter || compilePlayer(p).archetype === marketFilter);
    for (const p of offers) {
      const row = el('section', 'rb-career-player'), compiled = compilePlayer(p);
      row.append(portraitIdentity(compiled, clubKit(career.clubs[0]), el('h4', '', p.name), el('span', 'rb-archetype', archetypeLabel(compiled))), el('p', 'rb-muted', `Niveau ${levelOf(p)} · ${money(salary(p))} / journée · Fatigue 0/6`), statList(compiled));
      row.append(disclosure(`Comparer à ${existing.name}`, `offer-${p.id}`, el('p', 'rb-muted', `Votre joueur : niveau ${levelOf(existing)}, fatigue ${existing.fatigue}/6, équipement compris. Recrue : sans équipement et sans fatigue.`), comparison(reference, compiled, existing.implant, p.implant)));
      row.append(el('p', 'rb-purchase-projection', `Après contrat : ${money(career.balance - recruitmentPrice(p))} · Nouveaux salaires : ${money(payroll(career) + salary(p))} / journée.`));
      const reason = locked ? 'Rencontre en cours.' : ownedPlayers(career).length === 8 ? 'Effectif complet : huit joueurs maximum.' : purchaseBlock(career, recruitmentPrice(p));
      row.append(keyed(blocked(btn(`Recruter · ${money(recruitmentPrice(p))}`, () => update(() => recruit(career, p.id))), reason), `recruit-${p.id}`)); if (reason) row.append(el('small', 'rb-muted', reason)); list.append(row);
    }
    if (!offers.length) list.append(el('p', 'rb-empty-state', career.market.length ? 'Aucune offre pour cet archétype. Choisissez un autre filtre.' : 'Toutes les offres ont été recrutées. Le marché sera renouvelé après la journée.'));
    if (ownedPlayers(career).length === 8) manager.append(btn('Gérer les places de l’effectif', () => go('Équipe', 'Effectif')));
    manager.append(list);
  }
  function renderEquipment(locked) {
    const players = ownedPlayers(career); selectedShopPlayer = players.some((p) => p.id === selectedShopPlayer) ? selectedShopPlayer : players[0].id;
    const picker = keyed(select(Object.fromEntries(players.map((p) => [p.id, p.name])), selectedShopPlayer), 'equipment-player');
    picker.addEventListener('change', () => { selectedShopPlayer = picker.value; renderManagement(); });
    const p = players.find((p) => p.id === selectedShopPlayer), before = compilePlayer(p, career.inventory);
    manager.append(pageHeading('Équipement sportif', 'Équipez un joueur, faites circuler les protections ou investissez dans un implant.'), field('Joueur à équiper', picker));
    const identity = el('section', 'rb-equipment-player'); identity.append(portraitIdentity(before, clubKit(career.clubs[0]), el('h4', '', p.name), el('span', 'rb-archetype', archetypeLabel(before))), equipmentSlots(p, career.inventory), statList(before)); manager.append(identity);
    manager.append(el('h4', '', 'Protections du club'), el('p', 'rb-muted', 'Les transferts sont gratuits. Attribuer une protection remet en réserve celle déjà portée par le destinataire.'));
    const inventory = el('div', 'rb-club-inventory');
    if (!career.inventory.length) inventory.append(el('p', 'rb-empty-state', 'Votre réserve est vide. Les protections achetées pourront être réattribuées à tout moment entre deux matchs.'));
    for (const item of career.inventory) {
      const row = el('div', 'rb-inventory-row'), assignment = keyed(select({ '': 'Réserve', ...Object.fromEntries(players.map((p) => [p.id, p.name])) }, item.playerId ?? ''), `gear-${item.id}`); assignment.disabled = locked;
      assignment.addEventListener('change', () => update(() => assignProtection(career, item.id, assignment.value || null)));
      const transfer = el('div'); transfer.append(el('strong', '', CATALOGUE[item.itemId].name), field('Attribuer à · transfert gratuit', assignment));
      row.append(transfer, keyed(blocked(btn(`Revendre · ${money(CATALOGUE[item.itemId].price / 2)}`, () => update(() => sellProtection(career, item.id))), locked ? 'Rencontre en cours.' : ''), `resell-${item.id}`)); inventory.append(row);
    }
    manager.append(inventory, el('h4', '', 'Magasin'), el('p', 'rb-muted', `Les achats sont équipés sur ${p.name}. Un implant est attaché au joueur ; son remplacement détruit l’ancien.`));
    for (const slot of ['protection', 'implant']) {
      manager.append(el('p', 'rb-eyebrow', slot === 'protection' ? 'Protections · transférables' : 'Implants · personnels'));
      const list = el('div', 'rb-shop');
      for (const [id, item] of Object.entries(CATALOGUE).filter(([, item]) => item.slot === slot)) {
        const row = el('section', 'rb-career-player'), afterPlayer = structuredClone(p), afterInventory = structuredClone(career.inventory);
        if (item.slot === 'implant') afterPlayer.implant = id;
        else { for (const old of afterInventory) if (old.playerId === p.id) old.playerId = null; afterInventory.push({ id: 'preview', itemId: id, playerId: p.id }); }
        row.append(portraitIdentity(compilePlayer(afterPlayer, afterInventory), clubKit(career.clubs[0]), el('h4', '', item.name), el('small', 'rb-muted', 'Aperçu sur le joueur')), el('p', '', item.effect), comparison(before, compilePlayer(afterPlayer, afterInventory), p.implant, afterPlayer.implant));
        if (p.implant && item.slot === 'implant' && p.implant !== id) row.append(el('p', 'rb-loss', `Remplace et détruit : ${CATALOGUE[p.implant].name}.`));
        const available = career.inventory.find((i) => i.itemId === id && i.playerId !== p.id);
        if (available) row.append(blocked(btn('Utiliser un exemplaire du club · gratuit', () => update(() => assignProtection(career, available.id, p.id))), locked ? 'Rencontre en cours.' : ''));
        const reason = p.implant === id ? 'Cet implant est déjà équipé.' : purchaseBlock(career, item.price);
        row.append(el('p', 'rb-purchase-projection', `Après achat : ${money(career.balance - item.price)}`));
        row.append(keyed(blocked(btn(`Acheter et équiper · ${money(item.price)}`, () => {
          if (item.slot === 'implant' && p.implant) showConfirmation(`Acheter ${item.name} pour ${money(item.price)} détruit définitivement l’implant ${CATALOGUE[p.implant].name} de ${p.name}.`, () => update(() => buyItem(career, id, p.id, true)));
          else update(() => buyItem(career, id, p.id));
        }), reason), `buy-${id}`)); if (reason) row.append(el('small', 'rb-muted', reason)); list.append(row);
      } manager.append(list);
    }
  }
  function renderLeague() {
    const rows = standings(career), layout = el('div', 'rb-league-layout'), ranking = el('section'), calendar = el('section', 'rb-league-calendar');
    manager.append(pageHeading('La ligue', `Saison ${career.season} · Six clubs, dix journées, une place à prendre.`));
    ranking.append(el('h4', '', 'Classement'), table(['Club', 'Joués', 'V', 'N', 'D', 'Points'], rows.map((r, i) => [`${i + 1}. ${r.name}`, r.played, r.wins, r.draws, r.losses, r.points]), { highlight: rows.findIndex((r) => r.clubId === 'club'), caption: 'Classement de la saison. V : victoires, N : nuls, D : défaites.' }),
      el('p', 'rb-muted', 'Victoire : 3 points · nul : 1. Départage par victoires, puis ordre fixé en début de saison.'), disclosure('Primes de classement', 'league-prizes', el('p', 'rb-muted', '1er : 600 · 2e : 400 · 3e : 200 · 4e à 6e : 100 chromas.')));
    calendarDay = Math.min(9, Math.max(0, calendarDay ?? career.day));
    const day = keyed(select(Object.fromEntries(career.schedule.map((_, i) => [i, `Journée ${i + 1}${i < career.day ? ' · terminée' : i === career.day ? ' · à jouer' : ''}`])), calendarDay), 'calendar-day');
    day.addEventListener('change', () => { calendarDay = Number(day.value); renderManagement(); }); calendar.append(el('h4', '', 'Calendrier'), field('Journée à consulter', day));
    for (const f of career.schedule[calendarDay]) {
      const home = career.clubs.find((c) => c.id === f.homeId), away = career.clubs.find((c) => c.id === f.awayId), own = [f.homeId, f.awayId].includes('club');
      const row = el('div', `rb-fixture-row${own ? ' is-own' : ''}`);
      row.append(el('strong', '', `${home.name} — ${away.name}`), el('p', 'rb-muted', !f.result ? 'À jouer' : f.result.winnerId ? `Victoire : ${career.clubs.find((c) => c.id === f.result.winnerId).name}` : 'Match nul')); calendar.append(row);
    } layout.append(ranking, calendar); manager.append(layout);
    const opponents = disclosure('Clubs adverses et rotation', 'league-opponents');
    for (const club of career.clubs.slice(1)) { opponents.append(el('h4', '', `${club.name} · ${club.style}`), table(['Joueur', 'Niveau', 'XP', 'Fatigue'], club.players.map((p) => [p.name, levelOf(p), p.xp, `${p.fatigue}/6`]))); }
    manager.append(opponents);
    for (const past of career.seasonHistory) manager.append(disclosure(`Saison ${past.season} · classement final`, `season-${past.season}`, table(['Club', 'Points'], past.table.map((r, i) => [`${i + 1}. ${r.name}`, r.points]), { highlight: past.table.findIndex((r) => r.clubId === 'club') })));
  }
  function renderSummary() {
    const summary = career.current.summary, panel = el('section', 'rb-career-summary');
    manager.append(pageHeading('Bilan de la journée', `Face à ${career.current.config.teamNames.away}`));
    panel.append(el('p', 'rb-eyebrow', `Journée ${career.day} terminée`), el('h4', 'rb-result-title', resultLabel()));
    const metrics = el('div', 'rb-summary-metrics'); metrics.append(metric('Variation après salaires', `${signed(summary.reward + summary.seasonPrize - summary.wages)} chromas`), metric('Disponible à la fin de la journée', money(summary.available)), metric('Niveaux gagnés', String(summary.progress.reduce((sum, p) => sum + p.level - p.beforeLevel, 0)))); panel.append(metrics);
    for (const progress of summary.progress.filter((p) => p.level > p.beforeLevel)) {
      const owner = ownedPlayers(career).find((p) => p.id === progress.playerId), promotion = el('div', 'rb-level-gain');
      promotion.append(el('strong', '', `${progress.name} · niveau ${progress.beforeLevel} → ${progress.level}`));
      if (owner) {
        const before = compilePlayer({ ...owner, xp: XP_THRESHOLDS[progress.beforeLevel - 1], fatigue: 0, implant: null }), after = compilePlayer({ ...owner, xp: XP_THRESHOLDS[progress.level - 1], fatigue: 0, implant: null });
        promotion.append(comparison(before, after));
        for (const [key, label] of [['adrenaline', 'Adrénaline'], ['calls', 'Appels de jeu'], ['focus', 'Concentration']]) if (after.caps[key] > before.caps[key]) promotion.append(el('p', 'rb-gain', `${label} : ${before.caps[key]} → ${after.caps[key]}`));
      } panel.append(promotion);
    }
    panel.append(table(['Joueur', 'XP gagnée', 'Niveau', 'Fatigue'], summary.progress.map((p) => [p.name, `+${p.xp}${p.ko ? ' · KO' : ''}`, p.level > p.beforeLevel ? `${p.beforeLevel} → ${p.level}` : p.level, `${p.beforeFatigue} → ${p.fatigue}/6`])));
    panel.append(disclosure('Détail des primes et salaires', 'summary-finances', el('p', '', `Prime brute : ${money(summary.reward)} · Salaires prélevés au coup d’envoi : ${money(summary.wages)}${summary.seasonPrize ? ` · Prime de classement (${summary.rank}e) : ${money(summary.seasonPrize)}` : ''}`), el('p', 'rb-muted', `Dont ${money(summary.debtRepaid)} absorbés par les impayés. Ce remboursement est déjà compris dans le solde. Dette restante : ${money(summary.remainingDebt)}.`)));
    const actions = el('div', 'rb-controls'); actions.append(btn(career.day === 10 ? 'Retour au club · saison terminée' : 'Préparer la prochaine rencontre', () => go(career.day === 10 ? 'Club' : 'Équipe', 'Préparation'), true), btn('Faire tourner l’effectif', () => go('Équipe', 'Effectif')), btn('Revoir le terrain et le fil du match · sans récompense supplémentaire', () => openMatch())); panel.append(actions); manager.append(panel);
  }
  function showConfirmation(text, action) {
    const dialog = el('dialog', 'rb-career-dialog'), actions = el('div', 'rb-controls');
    const originKey = document.activeElement?.dataset.focusKey;
    function close() { dialog.close(); dialog.remove(); if (originKey) [...root.querySelectorAll('button')].find((n) => n.dataset.focusKey === originKey)?.focus({ preventScroll: true }); }
    const copy = el('p', '', text), cancel = btn('Annuler', close); copy.id = `rb-career-confirm-${++confirmationId}`; dialog.setAttribute('aria-label', 'Confirmer cette opération'); dialog.setAttribute('aria-describedby', copy.id);
    dialog.append(copy); actions.append(btn('Confirmer', () => { close(); action(); }, true), cancel); dialog.append(actions);
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
    manager.hidden = true; matchArea.hidden = false; matchActions.hidden = false; view.load(career.current, autoplay, { kickoff: autoplay });
    matchArea.scrollIntoView({ block: 'start', behavior: 'instant' });
  }
  showMode('career');
}
