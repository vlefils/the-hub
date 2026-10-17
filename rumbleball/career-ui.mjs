import { ROLES, INSTRUCTIONS, STRATEGIES, STARTS } from './data.mjs';
import { archetypeLabel, classAbilities } from './classes.mjs';
import { CATALOGUE, XP_THRESHOLDS, compilePlayer, levelOf, salary, recruitmentPrice } from './progression.mjs';
import { createCareer, confirmDraft, configureTeam, setClubColor, ownedPlayers, payroll, nextFixture, managementLocked, purchaseBlock, recruit, sellPlayer, buyItem, assignProtection, sellProtection, launchCareerMatch, saveCareerTurn, nextSeason, standings } from './career.mjs';
import { loadCareer, persistCareer, exportCareer, importCareer } from './career-storage.mjs';
import { KIT_COLORS, clubKit } from './appearance.mjs';
import { playerPortrait } from './visuals.mjs';
import { deploymentEditor } from './deployment-ui.mjs';
import { clubDeployment } from './deployment.mjs';

const el = (tag, cls = '', text) => { const node = document.createElement(tag); node.className = cls; if (text !== undefined) node.textContent = text; return node; };
const btn = (text, action, primary = false) => { const b = el('button', `rb-button${primary ? ' rb-button-primary' : ''}`, text); b.type = 'button'; b.addEventListener('click', action); return b; };
const field = (label, control) => { const node = el('label', 'rb-field', label); node.append(control); return node; };
const select = (values, value) => { const node = el('select'); for (const [key, text] of Object.entries(values)) { const option = el('option', '', text); option.value = key; option.selected = key === String(value); node.append(option); } return node; };
const money = (n) => `${n.toLocaleString('fr-FR')} chromas`;
const signed = (n) => `${n >= 0 ? '+' : ''}${n}`;
function kitPicker(value, disabled = false) {
  const input = el('input', 'rb-kit-color'); input.type = 'color'; input.value = value; input.disabled = disabled; input.setAttribute('aria-label', 'Couleur des maillots'); return input;
}
function portraitIdentity(p, color, ...copy) {
  const identity = el('div', 'rb-person-identity'), text = el('div'); text.append(...copy);
  identity.append(playerPortrait(p, color), text); return identity;
}
function table(headers, rows) {
  const wrap = el('div', 'rb-table-scroll'), t = el('table', 'rb-stats-table'), head = el('thead'), body = el('tbody'), hr = el('tr');
  for (const text of headers) { const th = el('th', '', text); th.scope = 'col'; hr.append(th); } head.append(hr);
  for (const values of rows) { const row = el('tr'); for (const [i, value] of values.entries()) { const cell = el(i ? 'td' : 'th'); if (!i) cell.scope = 'row'; if (value instanceof Node) cell.append(value); else cell.textContent = String(value); row.append(cell); } body.append(row); }
  t.append(head, body); wrap.append(t); return wrap;
}
function stats(p) { return `${p.maxHp} PV · CA ${p.armor} · ${p.speed.toLocaleString('fr-FR')} m · Lutte ${signed(p.skills.wrestling)} · Acrobaties ${signed(p.skills.acrobatics)}`; }
function comparison(before, after) {
  const changes = [];
  for (const [label, a, b] of [['PV', before.maxHp, after.maxHp], ['CA', before.armor, after.armor], ['Vitesse (m)', before.speed, after.speed], ['Lutte', before.skills.wrestling, after.skills.wrestling], ['Acrobaties', before.skills.acrobatics, after.skills.acrobatics]]) if (a !== b) changes.push(`${label} : ${a} → ${b}`);
  return changes.join(' · ') || 'Caractéristiques de terrain inchangées.';
}
function download(text, filename) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' })), a = el('a'); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function mountCareer(root, mountMatch) {
  root.replaceChildren(); root.classList.add('rb');
  // Access localStorage lazily, including browsers that reject the property getter.
  const storage = { getItem: (key) => window.localStorage.getItem(key), setItem: (key, value) => window.localStorage.setItem(key, value) };
  const loaded = loadCareer(storage);
  let career = loaded.career, tab = 'Effectif', mode = 'career', unsaved = false, selectedShopPlayer = null, draftIds = new Set(), pendingImport = null;
  const top = el('div', 'rb-career-top'), modes = el('div', 'rb-controls'), tools = el('div', 'rb-controls');
  const careerMode = btn('Carrière', () => showMode('career')), exhibitionMode = btn('Exhibition', () => showMode('exhibition'));
  modes.setAttribute('aria-label', 'Mode de jeu'); modes.append(careerMode, exhibitionMode);
  const exportButton = btn('Exporter', () => attempt(() => download(exportCareer(career), `rumbleball-saison-${career.season}.json`)));
  const importInput = el('input'); importInput.type = 'file'; importInput.accept = '.json,application/json'; importInput.hidden = true;
  const importButton = btn('Importer', () => importInput.click());
  const retry = btn('Réessayer la sauvegarde', () => { save(); renderManagement(); }); retry.hidden = true;
  tools.append(exportButton, importButton, retry, importInput); top.append(modes, tools);
  const notice = el('p', 'rb-career-notice'); notice.setAttribute('role', 'alert'); notice.hidden = !loaded.error; notice.textContent = loaded.error ?? '';
  const importPreview = el('section', 'rb-career-import'); importPreview.hidden = true;
  const manager = el('div', 'rb-career'), matchArea = el('div', 'rb-match-area'), matchActions = el('div', 'rb-controls rb-match-back'), matchRoot = el('div');
  matchActions.append(btn('Retour au club · mettre en pause', () => { view.pause(); matchArea.hidden = true; manager.hidden = false; renderManagement(); }));
  matchArea.append(matchActions, matchRoot); matchArea.hidden = true;
  root.append(top, notice, importPreview, manager, matchArea);
  const view = mountMatch(matchRoot, {
    onTurn(state, events) {
      career = saveCareerTurn(career, state, events);
      return save();
    },
    onReturn() { matchArea.hidden = true; manager.hidden = false; renderManagement(); },
  });
  function attempt(action) { try { action(); } catch (error) { notice.hidden = false; notice.textContent = error.message; } }
  function save() {
    try { persistCareer(storage, career); unsaved = false; retry.hidden = true; notice.hidden = true; return true; }
    catch (error) { unsaved = true; retry.hidden = false; notice.hidden = false; notice.textContent = `Progression non enregistrée : ${error.message} La dernière sauvegarde valide est conservée. Réessayez ou exportez votre progression avant de fermer cette page.`; return false; }
  }
  function update(action) { attempt(() => { career = action(); save(); renderManagement(); }); }
  function blocked(b, reason) { b.disabled = Boolean(reason); if (reason) b.title = reason; return b; }
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
        btn('Confirmer le remplacement', () => attempt(() => { if (managementLocked(career ?? {})) throw new Error('Terminez la rencontre avant de remplacer la carrière.'); view.pause(); career = pendingImport; pendingImport = null; draftIds.clear(); importPreview.hidden = true; save(); showMode('career'); }), true),
        btn('Annuler', () => { pendingImport = null; importPreview.hidden = true; }));
      importPreview.hidden = false;
    } catch (error) { notice.hidden = false; notice.textContent = `Import refusé : ${error.message}`; }
  });
  function renderManagement() {
    manager.replaceChildren(); exportButton.disabled = !career; importButton.disabled = managementLocked(career ?? {});
    if (!career) { renderCreation(); return; }
    if (career.status === 'draft') { renderDraft(); return; }
    const locked = managementLocked(career), club = career.clubs[0], fixture = nextFixture(career);
    const opponent = fixture ? career.clubs.find((c) => c.id === (fixture.homeId === 'club' ? fixture.awayId : fixture.homeId)) : null;
    const header = el('header', 'rb-club-header'), identity = el('div');
    identity.append(el('p', 'rb-eyebrow', `Saison ${career.season} · ${career.day}/10 journées terminées`), el('h3', '', club.name));
    const finances = el('dl', 'rb-career-finances');
    for (const [label, value, cls] of [['Solde', money(career.balance), career.balance < 0 ? 'rb-away' : 'rb-home'], ['Salaires impayés', money(Math.max(0, -career.balance)), ''], ['Prochaine masse salariale', money(payroll(career)), '']]) {
      const item = el('div'); item.append(el('dt', 'rb-muted', label), el('dd', cls, value)); finances.append(item);
    }
    header.append(identity, finances); manager.append(header);
    const matchStrip = el('div', 'rb-next-match');
    if (locked) {
      matchStrip.append(el('p', '', `Rencontre en cours contre ${career.current.config.teamNames.away}. Gestion en lecture seule. La reprise se fait en pause.`), btn('Reprendre la rencontre', () => openMatch(), true));
    } else if (opponent) {
      matchStrip.append(el('div', '', `Journée ${career.day + 1} · ${fixture.homeId === 'club' ? 'Domicile' : 'Extérieur'} contre ${opponent.name} · ${opponent.style}`), btn(`Jouer · ${money(payroll(career))} de salaires`, () => updateAndPlay(), true));
    } else {
      matchStrip.append(el('p', '', 'Saison terminée. Joueurs, niveaux, équipement et solde sont conservés ; la fatigue revient à zéro.'), btn('Commencer la saison suivante', () => update(() => nextSeason(career)), true));
    }
    manager.append(matchStrip);
    if (career.balance < 0) manager.append(el('p', 'rb-career-debt', 'Achats bloqués. Primes et ventes remboursent les salaires impayés. Vous pouvez jouer, modifier la composition et transférer vos protections gratuitement.'));
    if (career.current?.settled) renderSummary();
    const tabs = el('div', 'rb-career-tabs'); tabs.setAttribute('aria-label', 'Gestion du club');
    for (const label of ['Effectif', 'Recrutement', 'Équipement', 'Ligue']) { const b = btn(label, () => { tab = label; renderManagement(); }); b.setAttribute('aria-pressed', String(tab === label)); tabs.append(b); }
    manager.append(tabs);
    if (tab === 'Effectif') renderRoster(locked);
    if (tab === 'Recrutement') renderMarket(locked);
    if (tab === 'Équipement') renderEquipment(locked);
    if (tab === 'Ligue') renderLeague();
  }
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
    function totals() { const cost = career.market.filter((p) => draftIds.has(p.id)).reduce((sum, p) => sum + recruitmentPrice(p), 0); total.textContent = `${draftIds.size}/8 joueurs · ${money(cost)} · reste ${money(2400 - cost)}`; confirm.disabled = draftIds.size < 5 || draftIds.size > 8 || cost > 2400; }
    for (const p of career.market) {
      const row = el('label', 'rb-candidate'), checkbox = el('input'); checkbox.type = 'checkbox'; checkbox.checked = draftIds.has(p.id);
      checkbox.addEventListener('change', () => { if (checkbox.checked) draftIds.add(p.id); else draftIds.delete(p.id); totals(); });
      const compiled = compilePlayer(p), copy = el('div'); copy.append(el('strong', '', p.name), el('span', 'rb-archetype', archetypeLabel(compiled)), el('small', 'rb-muted', stats(compiled)));
      row.append(checkbox, portraitIdentity(compiled, clubKit(career.clubs[0]), copy), el('span', '', money(recruitmentPrice(p)))); list.append(row);
    }
    totals(); footer.append(total, confirm); manager.append(list, footer);
  }
  function renderRoster(locked) {
    manager.append(el('h3', '', `Effectif · ${ownedPlayers(career).length}/8 joueurs`), el('p', 'rb-muted', 'Cinq titulaires dans l’ordre de leur position de départ. Les remplaçants récupèrent 3 fatigue et gagnent 4 XP ; les titulaires gagnent 10 XP. Aucun remplacement pendant le match.'), el('p', 'rb-muted', 'Fatigue 3–4 : −1,5 m. Fatigue 5–6 : même réduction et −1 en Lutte, Athlétisme et Acrobaties. Un KO ajoute 1 fatigue.'));
    const form = el('form', 'rb-lineup-form'), strategy = select(STRATEGIES, career.clubs[0].strategy); strategy.disabled = locked;
    const preparation = el('div', 'rb-preparation'), teamControls = el('div', 'rb-team-controls');
    const color = kitPicker(clubKit(career.clubs[0]), locked), kitOptions = el('div', 'rb-kit-options'); kitOptions.append(field('Plan collectif', strategy), field('Couleur des maillots', color)); teamControls.append(kitOptions);
    const lineup = el('div', 'rb-lineup-slots'), slotControls = [];
    const names = Object.fromEntries(ownedPlayers(career).map((p) => [p.id, p.name]));
    for (const [i, id] of career.lineup.entries()) { const s = select(names, id); s.disabled = locked; slotControls.push(s); lineup.append(field(`Titulaire ${i + 1}`, s)); }
    teamControls.append(lineup);
    const deploymentPlayers = () => career.lineup.map((id) => compilePlayer(ownedPlayers(career).find((p) => p.id === id), career.inventory));
    const positions = locked ? career.current.config.deployments?.home ?? STARTS.map(([x, y]) => ({ x, y })) : clubDeployment(career.clubs[0]);
    const deployment = deploymentEditor({ players: deploymentPlayers(), positions, color: color.value, disabled: locked, onChange: () => attempt(commitLineup) });
    preparation.append(teamControls, deployment.root); form.append(preparation);
    const assignments = {}, statusLabels = new Map(), portraits = new Map(), list = el('div', 'rb-career-roster');
    for (const p of ownedPlayers(career)) {
      const compiled = compilePlayer(p, career.inventory), level = levelOf(p), row = el('section', 'rb-career-player'), heading = el('div', 'rb-career-player-head'), info = el('div');
      const index = career.lineup.indexOf(p.id);
      const statusLabel = el('small', 'rb-muted', index < 0 ? 'Remplaçant' : `Titulaire ${index + 1}`); statusLabels.set(p.id, statusLabel);
      info.append(el('h4', '', p.name), el('span', 'rb-archetype', archetypeLabel(compiled)), statusLabel);
      const portrait = el('div', 'rb-portrait-wrap'); portrait.append(playerPortrait(compiled, color.value)); portraits.set(p.id, portrait);
      const identity = el('div', 'rb-person-identity'); identity.append(portrait, info); heading.append(identity, el('strong', '', `Niveau ${level}`)); row.append(heading);
      const xp = el('progress'); xp.max = level === 5 ? 140 : XP_THRESHOLDS[level]; xp.value = Math.min(p.xp, xp.max); xp.setAttribute('aria-label', `XP de ${p.name}`);
      row.append(el('p', 'rb-muted', `${p.xp} XP${level === 5 ? ' · niveau maximum' : ` / ${XP_THRESHOLDS[level]} pour le niveau ${level + 1}`} · Fatigue ${p.fatigue}/6 · Salaire ${money(salary(p))}`), xp, el('p', '', stats(compiled)));
      const protection = career.inventory.find((item) => item.playerId === p.id);
      row.append(el('p', 'rb-muted', `Protection : ${CATALOGUE[protection?.itemId]?.name ?? 'aucune'} · Implant : ${CATALOGUE[p.implant]?.name ?? 'aucun'}`));
      const controls = el('div', 'rb-controls'), role = select(ROLES, p.role), instruction = select(INSTRUCTIONS, p.instruction); role.disabled = instruction.disabled = locked; assignments[p.id] = { role, instruction };
      controls.append(field('Rôle', role), field('Consigne', instruction)); row.append(controls);
      const details = el('details', 'rb-player-techniques'); details.append(el('summary', '', 'Techniques et réserves de classe'));
      for (const [label, description] of classAbilities(compiled)) details.append(el('p', 'rb-muted', `${label}. ${description}`)); row.append(details);
      const sellReason = locked ? 'Rencontre en cours.' : ownedPlayers(career).length <= 5 ? 'Cinq joueurs minimum.' : '';
      row.append(blocked(btn(`Céder · ${money(recruitmentPrice(p) / 2)}`, () => { showConfirmation(`Céder ${p.name} pour ${money(recruitmentPrice(p) / 2)} ? Son implant quitte le club ; sa protection retourne en réserve.`, () => update(() => sellPlayer(career, p.id))); }), sellReason));
      if (sellReason) row.append(el('small', 'rb-muted', sellReason)); list.append(row);
    }
    form.append(list); const submit = btn('Enregistrer la composition et les consignes', () => {}, true); submit.type = 'submit'; submit.disabled = locked; form.append(submit);
    const formNotice = el('p', 'rb-muted', 'Composition et consignes sont enregistrées automatiquement. Choisir un titulaire déjà présent échange leurs positions.'); form.append(formNotice);
    function commitLineup() {
      career = configureTeam(career, slotControls.map((s) => s.value), Object.fromEntries(Object.entries(assignments).map(([id, controls]) => [id, { role: controls.role.value, instruction: controls.instruction.value }])), strategy.value, deployment.value);
      career = setClubColor(career, color.value);
      const saved = save();
      for (const [id, label] of statusLabels) { const index = career.lineup.indexOf(id); label.textContent = index < 0 ? 'Remplaçant' : `Titulaire ${index + 1}`; }
      for (const p of ownedPlayers(career)) portraits.get(p.id).replaceChildren(playerPortrait(compilePlayer(p, career.inventory), color.value));
      deployment.update({ players: deploymentPlayers(), color: color.value });
      formNotice.textContent = saved ? 'Composition et consignes enregistrées.' : 'Composition modifiée en mémoire ; sauvegarde à réessayer.';
    }
    for (const [index, control] of slotControls.entries()) control.addEventListener('change', () => {
      const duplicate = slotControls.find((other, otherIndex) => otherIndex !== index && other.value === control.value);
      if (duplicate) duplicate.value = career.lineup[index];
    });
    form.addEventListener('change', (event) => { if (!deployment.root.contains(event.target)) attempt(commitLineup); });
    form.addEventListener('submit', (event) => { event.preventDefault(); attempt(commitLineup); });
    manager.append(form);
  }
  function renderMarket(locked) {
    manager.append(el('h3', '', 'Marché des recrues'), el('p', 'rb-muted', 'Les offres restent identiques jusqu’à la fin de la journée. Six nouvelles offres après chaque rencontre ; leur niveau dépend uniquement des journées terminées.'));
    const list = el('div', 'rb-career-roster');
    for (const p of career.market) {
      const row = el('section', 'rb-career-player'), compiled = compilePlayer(p);
      row.append(portraitIdentity(compiled, clubKit(career.clubs[0]), el('h4', '', p.name), el('span', 'rb-archetype', archetypeLabel(compiled))), el('p', '', `Niveau ${levelOf(p)} · ${stats(compiled)}`), el('p', 'rb-muted', `Salaire : ${money(salary(p))} par journée. Arrive avec une fatigue de 0/6 et sans équipement.`));
      const reason = locked ? 'Rencontre en cours.' : ownedPlayers(career).length === 8 ? 'Effectif complet : huit joueurs maximum.' : purchaseBlock(career, recruitmentPrice(p));
      row.append(blocked(btn(`Recruter · ${money(recruitmentPrice(p))}`, () => update(() => recruit(career, p.id)), true), reason)); if (reason) row.append(el('small', 'rb-muted', reason)); list.append(row);
    }
    if (!career.market.length) list.append(el('p', 'rb-muted', 'Toutes les offres ont été recrutées. Le marché sera renouvelé après la journée.'));
    manager.append(list);
  }
  function renderEquipment(locked) {
    const players = ownedPlayers(career); selectedShopPlayer = players.some((p) => p.id === selectedShopPlayer) ? selectedShopPlayer : players[0].id;
    const picker = select(Object.fromEntries(players.map((p) => [p.id, p.name])), selectedShopPlayer);
    picker.addEventListener('change', () => { selectedShopPlayer = picker.value; renderManagement(); });
    const p = players.find((p) => p.id === selectedShopPlayer), before = compilePlayer(p, career.inventory);
    manager.append(el('h3', '', 'Équipement sportif'), field('Joueur pour la comparaison et l’achat', picker), el('p', 'rb-muted', 'Un emplacement de protection et un implant par joueur. Les protections se transfèrent gratuitement. Les implants sont attachés au joueur et ne se revendent pas séparément.'));
    manager.append(portraitIdentity(before, clubKit(career.clubs[0]), el('strong', '', p.name), el('small', 'rb-muted', 'Équipement actuel')));
    const list = el('div', 'rb-shop');
    for (const [id, item] of Object.entries(CATALOGUE)) {
      const row = el('section', 'rb-career-player'), afterPlayer = structuredClone(p), afterInventory = structuredClone(career.inventory);
      if (item.slot === 'implant') afterPlayer.implant = id;
      else { for (const old of afterInventory) if (old.playerId === p.id) old.playerId = null; afterInventory.push({ id: 'preview', itemId: id, playerId: p.id }); }
      row.append(portraitIdentity(compilePlayer(afterPlayer, afterInventory), clubKit(career.clubs[0]), el('small', 'rb-eyebrow', item.slot === 'implant' ? 'Implant · après achat' : 'Protection · après achat'), el('h4', '', item.name)), el('p', '', item.effect), el('p', 'rb-muted', comparison(before, compilePlayer(afterPlayer, afterInventory))));
      if (p.implant && item.slot === 'implant') row.append(el('p', 'rb-career-debt', `Remplace et détruit : ${CATALOGUE[p.implant].name}.`));
      const reason = purchaseBlock(career, item.price);
      row.append(blocked(btn(`Acheter pour ${p.name} · ${money(item.price)}`, () => {
        if (item.slot === 'implant' && p.implant) showConfirmation(`Acheter ${item.name} pour ${money(item.price)} détruit définitivement l’implant ${CATALOGUE[p.implant].name} de ${p.name}.`, () => update(() => buyItem(career, id, p.id, true)));
        else update(() => buyItem(career, id, p.id));
      }), reason)); if (reason) row.append(el('small', 'rb-muted', reason)); list.append(row);
    }
    manager.append(list, el('h3', '', 'Protections du club'));
    if (!career.inventory.length) manager.append(el('p', 'rb-muted', 'Aucune protection achetée.'));
    for (const item of career.inventory) {
      const row = el('div', 'rb-inventory-row'), assignment = select({ '': 'Réserve', ...Object.fromEntries(players.map((p) => [p.id, p.name])) }, item.playerId ?? ''); assignment.disabled = locked;
      assignment.addEventListener('change', () => update(() => assignProtection(career, item.id, assignment.value || null)));
      const transfer = el('div'); transfer.append(el('strong', '', CATALOGUE[item.itemId].name), field('Attribuer à · transfert gratuit', assignment));
      row.append(transfer, blocked(btn(`Revendre · ${money(CATALOGUE[item.itemId].price / 2)}`, () => update(() => sellProtection(career, item.id))), locked ? 'Rencontre en cours.' : '')); manager.append(row);
    }
  }
  function renderLeague() {
    manager.append(el('h3', '', 'Classement'), el('p', 'rb-muted', 'Victoire : 3 points · nul : 1. Départage par victoires, puis ordre tiré au début de la saison. Primes de classement : 600 / 400 / 200 / 100 / 100 / 100 chromas.'),
      table(['Club', 'J', 'V', 'N', 'D', 'Points'], standings(career).map((r, i) => [`${i + 1}. ${r.name}`, r.played, r.wins, r.draws, r.losses, r.points])));
    manager.append(el('h3', '', 'Calendrier'));
    for (const [i, fixtures] of career.schedule.entries()) {
      const details = el('details', 'rb-calendar-day'); details.open = i === Math.min(9, career.day); details.append(el('summary', '', `Journée ${i + 1}${i < career.day ? ' · terminée' : ''}`));
      for (const f of fixtures) { const home = career.clubs.find((c) => c.id === f.homeId), away = career.clubs.find((c) => c.id === f.awayId); details.append(el('p', '', `${home.name} — ${away.name} · ${!f.result ? 'À jouer' : f.result.winnerId ? `Victoire : ${career.clubs.find((c) => c.id === f.result.winnerId).name}` : 'Nul'}`)); }
      manager.append(details);
    }
    const opponents = el('details', 'rb-calendar-day'); opponents.append(el('summary', '', 'Clubs adverses et rotation'));
    for (const club of career.clubs.slice(1)) { opponents.append(el('h4', '', `${club.name} · ${club.style}`), table(['Joueur', 'Niveau', 'XP', 'Fatigue'], club.players.map((p) => [p.name, levelOf(p), p.xp, `${p.fatigue}/6`]))); }
    manager.append(opponents);
    const ledger = el('details', 'rb-calendar-day'); ledger.append(el('summary', '', 'Historique financier'), table(['Opération', 'Montant', 'Solde'], [...career.transactions].reverse().map((t) => [t.label, signed(t.amount), money(t.balance)]))); manager.append(ledger);
    for (const past of career.seasonHistory) { const history = el('details', 'rb-calendar-day'); history.append(el('summary', '', `Saison ${past.season} · classement final`), table(['Club', 'Points'], past.table.map((r, i) => [`${i + 1}. ${r.name}`, r.points]))); manager.append(history); }
  }
  function renderSummary() {
    const summary = career.current.summary, panel = el('details', 'rb-career-summary'); panel.open = true;
    panel.append(el('summary', '', 'Bilan de la dernière journée'), el('p', '', `Prime brute : ${money(summary.reward)} · Salaires prélevés au coup d’envoi : ${money(summary.wages)}${summary.seasonPrize ? ` · Prime de classement (${summary.rank}e) : ${money(summary.seasonPrize)}` : ''}`),
      el('p', '', `Remboursement des salaires impayés : ${money(summary.debtRepaid)} · Dette restante : ${money(summary.remainingDebt)} · Disponible après la journée : ${money(summary.available)}`),
      table(['Joueur', 'XP', 'Niveau', 'Fatigue'], summary.progress.map((p) => [p.name, `+${p.xp}${p.ko ? ' · KO' : ''}`, p.level > p.beforeLevel ? `${p.beforeLevel} → ${p.level}` : p.level, `${p.beforeFatigue} → ${p.fatigue}/6`])),
      btn('Revoir le terrain et le fil du match · sans récompense supplémentaire', () => openMatch())); manager.append(panel);
  }
  function showConfirmation(text, action) {
    const dialog = el('dialog', 'rb-career-dialog'), actions = el('div', 'rb-controls');
    dialog.append(el('p', '', text)); actions.append(btn('Confirmer', () => { dialog.close(); dialog.remove(); action(); }, true), btn('Annuler', () => { dialog.close(); dialog.remove(); })); dialog.append(actions);
    dialog.addEventListener('cancel', () => dialog.remove()); root.append(dialog); dialog.showModal();
  }
  function updateAndPlay() {
    attempt(() => {
      // Save the charged, frozen match before allowing the first simulated turn.
      if (unsaved && !save()) return;
      career = launchCareerMatch(career); if (save()) openMatch(true); else renderManagement();
    });
  }
  function openMatch(autoplay = false) {
    if (unsaved && !save()) return;
    manager.hidden = true; matchArea.hidden = false; matchActions.hidden = false; view.load(career.current, autoplay);
    matchArea.scrollIntoView({ block: 'start', behavior: 'instant' });
  }
  showMode('career');
}
