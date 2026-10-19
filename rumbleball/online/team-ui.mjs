import { el, btn, field, select, money, statList, xpProgress, fatigue, equipmentSlots, portraitIdentity, table, disclosure } from '../career-components.mjs';
import { ARCHETYPES } from '../classes.mjs';
import { STRATEGIES, ROLES, INSTRUCTIONS } from '../data.mjs';
import { compilePlayer, salary, recruitmentPrice } from '../progression.mjs';
import { OPENINGS, openingDeployment } from '../openings.mjs';
import { deploymentEditor, draggablePlayer, PLAYER_DRAG_TYPE } from '../deployment-ui.mjs';
import { moveDeployment } from '../deployment.mjs';
import { playerShop } from '../player-shop.mjs';
import { playerInventory } from '../player-inventory.mjs';
import { athletePortrait } from '../visuals.mjs';
import { crestPicker, clubIdentity, archetypeIcon } from '../broadcast-components.mjs';

export function preparationDraft(club) {
  return structuredClone({ lineup: club.lineup, assignments: Object.fromEntries(club.players.map(p => [p.id, { role: p.role, instruction: p.instruction }])), strategy: club.strategy, opening: club.opening, deployment: club.deployment, color: club.kitColor, crestId: club.crestId });
}
export function leagueContext(league) {
  const root = el('aside', 'rb-broadcast-context'), schedule = el('section'), ranking = el('section');
  schedule.append(el('h4', '', 'Programme de la soirée'));
  const member = id => league.members.find(m => m.userId === id);
  if (league.status === 'broadcast') {
    for (const g of league.games) {
      const row = el('div', `rb-broadcast-fixture${[g.homeId, g.awayId].includes(league.club.id) ? ' is-own' : ''}`);
      const time = g.startsAt ? new Date(g.startsAt).toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' }) : 'Après le match précédent + 2 min';
      row.append(el('small', '', `${time} · ${g.status === 'live' ? 'En direct' : g.status === 'finished' ? 'Terminé' : 'À suivre'}`), clubIdentity(member(g.homeId), { compact: true }), clubIdentity(member(g.awayId), { compact: true })); schedule.append(row);
    }
  } else {
    for (const [i, f] of league.upcoming.entries()) {
      const row = el('div', `rb-broadcast-fixture${[f.homeId, f.awayId].includes(league.club.id) ? ' is-own' : ''}`);
      row.append(el('small', '', league.status === 'lobby' ? 'Après le lancement de la saison' : i ? 'À suivre · pause de 2 min' : '20 h · heure de Paris'), clubIdentity(member(f.homeId), { compact: true }), clubIdentity(member(f.awayId), { compact: true })); schedule.append(row);
    }
  }
  ranking.append(el('h4', '', 'Classement'), table(['Club', 'Joués', 'Points'], league.table.map((r, i) => {
    const label = el('span'); label.append(el('span', 'rb-muted', `${i + 1}. `), clubIdentity(member(r.id), { compact: true })); return [label, r.played, r.points];
  }), { highlight: league.table.findIndex(r => r.id === league.club.id), caption: 'Classement de la ligue' }));
  root.append(schedule, ranking); return root;
}
export function mountTeamEditor({ club, league, draft, locked, hasDraft, onSave, onSell, onDirty, onBuy, onAssign, onSellGear, onRecruit }) {
  const ids = new Set(club.players.map(p => p.id));
  draft.lineup = draft.lineup.filter(id => ids.has(id));
  for (const p of club.players) {
    draft.assignments[p.id] ??= { role: p.role, instruction: p.instruction };
    if (draft.lineup.length < 5 && !draft.lineup.includes(p.id)) draft.lineup.push(p.id);
  }
  let selected = ids.has(draft.selected) ? draft.selected : draft.lineup[0];
  const root = el('form', 'rb-broadcast-preparation'), squad = el('section', 'rb-broadcast-squad'), slots = el('div'), detail = el('section', 'rb-squad-detail'), bench = el('section', 'rb-broadcast-bench'), tactics = el('section', 'rb-broadcast-tactics');
  const sidebar = el('aside', 'rb-workspace-sidebar'), inspector = el('section', 'rb-player-inspector');
  bench.setAttribute('aria-label', 'Banc des remplaçants');
  const playerTactics = el('div', 'rb-player-tactics');
  const strategy = select(STRATEGIES, draft.strategy), opening = select(Object.fromEntries(Object.entries(OPENINGS).map(([id, v]) => [id, v.name])), draft.opening), color = el('input', 'rb-kit-color'); color.type = 'color'; color.value = draft.color;
  const crest = crestPicker(draft.crestId, draft.color, locked);
  const deployed = () => draft.lineup.map((id, i) => ({ ...compilePlayer(club.players.find(p => p.id === id), club.inventory), id, number: i + 1 }));
  const editor = deploymentEditor({ players: deployed(), positions: draft.deployment, color: draft.color, disabled: locked, selectedPlayerId: draft.lineup.includes(selected) ? selected : draft.slotSelected,
    interactivePlayers: true, onDropPlayer(id, position) {
      if (!ids.has(id) || locked) return;
      const occupied = editor.value.findIndex(p => p.x === position.x && p.y === position.y), index = occupied >= 0 ? occupied : Math.max(0, draft.lineup.indexOf(editor.selectedPlayerId));
      draft.deployment = moveDeployment(editor.value, index, position); editor.update({ positions: draft.deployment }); replaceAt(index, id);
    }, onSelect(id) { selected = draft.selected = draft.slotSelected = id; drawDetail(); highlight(); }, onChange(positions) { draft.deployment = positions; changed(); } });
  const selectors = el('div', 'rb-broadcast-selectors'); selectors.append(field('Plan collectif', strategy), field('Ouverture', opening));
  const kit = disclosure('Identité du club', 'club-identity', field('Couleur des maillots', color), crest.root);
  const saveBar = el('div', 'rb-broadcast-save'), save = el('button', 'rb-button rb-button-primary', 'Enregistrer la préparation'), status = el('p', 'rb-form-status'); save.type = 'submit'; status.setAttribute('role', 'status');
  const court = el('div', 'rb-court-workspace'); court.append(editor.root, bench);
  saveBar.append(save, status); tactics.append(court, selectors);
  const recruit = btn('Recruter un joueur', onRecruit); recruit.classList.add('rb-recruit-tile'); recruit.setAttribute('aria-haspopup', 'dialog'); recruit.setAttribute('data-readonly-control', 'true');
  squad.append(el('h4', '', 'Les cinq titulaires'), slots, recruit, kit);
  sidebar.append(inspector); root.append(squad, tactics, saveBar, sidebar);
  const baseline = JSON.stringify(preparationDraft(club));
  function read() {
    draft.strategy = strategy.value; draft.opening = opening.value; draft.color = color.value; draft.crestId = crest.value; draft.deployment = editor.value;
    return { lineup: [...draft.lineup], assignments: structuredClone(draft.assignments), strategy: draft.strategy, opening: draft.opening, deployment: structuredClone(draft.deployment), color: draft.color, crestId: draft.crestId };
  }
  function changed() {
    const dirty = JSON.stringify(read()) !== baseline; draft.dirty = dirty; onDirty(dirty); save.disabled = locked || !dirty; saveBar.dataset.dirty = String(dirty && !locked);
    status.textContent = locked ? 'Équipes verrouillées pour la soirée.' : dirty ? 'Modifications non enregistrées.' : hasDraft ? 'Préparation enregistrée · modifiable avant le verrouillage.' : 'Composition actuelle · modifiable avant le verrouillage.';
  }
  function highlight() {
    for (const row of slots.children) row.classList.toggle('is-selected', row.dataset.playerId === selected);
    for (const row of bench.children) if (row.dataset.playerId) { const active = row.dataset.playerId === selected; row.classList.toggle('is-selected', active); row.querySelector('.rb-bench-name').setAttribute('aria-pressed', String(active)); }
    editor.update({ selectedPlayerId: selected });
  }
  function drawDetail() {
    const p = club.players.find(p => p.id === selected), compiled = compilePlayer(p, club.inventory), role = select(ROLES, draft.assignments[p.id].role), instruction = select(INSTRUCTIONS, draft.assignments[p.id].instruction);
    const replacement = select(Object.fromEntries(club.players.map(p => [p.id, p.name])), selected); replacement.disabled = locked;
    replacement.addEventListener('change', () => replaceAt(draft.lineup.indexOf(selected), replacement.value));
    const order = el('div', 'rb-controls'), index = draft.lineup.indexOf(selected);
    for (const [text, offset] of [['Monter', -1], ['Descendre', 1]]) {
      const move = btn(text, () => { const next = index + offset; [draft.lineup[index], draft.lineup[next]] = [draft.lineup[next], draft.lineup[index]]; editor.update({ players: deployed(), selectedPlayerId: selected }); drawSquad(); drawDetail(); changed(); });
      move.disabled = locked || index + offset < 0 || index + offset >= 5; order.append(move);
    }
    role.disabled = instruction.disabled = locked;
    const label = el('span', 'rb-archetype'); label.append(archetypeIcon(compiled.archetype), ` ${ARCHETYPES[compiled.archetype].name}`);
    playerTactics.replaceChildren(field('Rôle', role), field('Consigne', instruction));
    const progress = el('div', 'rb-player-status-strip'); progress.append(xpProgress(p), fatigue(p));
    detail.replaceChildren(portraitIdentity(compiled, draft.color, el('h3', '', p.name), label), progress, playerTactics, statList(compiled), equipmentSlots(p, club.inventory), playerShop(club, p, { locked, onBuy, selectedItem: draft.shopItem, onItem: id => { draft.shopItem = id; } }), playerInventory(club, p, { locked, onAssign, onSell: onSellGear }));
    if (index >= 0) detail.append(field('Remplacer ce titulaire', replacement), order);
    else detail.append(el('p', 'rb-muted', 'Sur le banc · rôle, consigne et équipement modifiables comme pour un titulaire.'));
    detail.append(el('small', 'rb-muted', `${money(salary(p))} / journée`));
    inspector.replaceChildren(detail);
    highlight();
    if (club.players.length > 5) { const sell = btn(`Céder ${p.name} · ${money(recruitmentPrice(p) / 2)}`, () => onSell(p.id)); sell.disabled = locked; detail.append(sell); }
    for (const control of [role, instruction]) control.addEventListener('change', () => { draft.assignments[p.id] = { role: role.value, instruction: instruction.value }; changed(); });
  }
  function replaceAt(index, id) {
    const previous = draft.lineup[index], other = draft.lineup.indexOf(id); if (other >= 0 && other !== index) draft.lineup[other] = previous;
    draft.lineup[index] = id; selected = draft.selected = draft.slotSelected = id; editor.update({ players: deployed(), selectedPlayerId: selected }); drawSquad(); drawDetail(); changed();
    detail.querySelector('select')?.focus({ preventScroll: true });
  }
  function drawSquad() {
    slots.replaceChildren(); bench.replaceChildren(el('h4', '', 'Banc'));
    for (const [i, id] of draft.lineup.entries()) {
      const p = club.players.find(p => p.id === id), compiled = compilePlayer(p, club.inventory), row = el('div', 'rb-squad-slot'); row.dataset.playerId = id;
      const pick = btn(`${i + 1} · ${p.name}`, () => { selected = draft.selected = draft.slotSelected = id; drawDetail(); highlight(); }); pick.classList.add('rb-squad-name'); pick.setAttribute('aria-label', `Détails de ${p.name}`); pick.setAttribute('data-readonly-control', 'true');
      const portrait = athletePortrait(compiled, draft.color); draggablePlayer(portrait, id, locked); draggablePlayer(pick, id, locked);
      row.append(portrait, pick, el('small', 'rb-archetype', `${ARCHETYPES[compiled.archetype].name} · niv. ${compiled.level}`), fatigue(p)); slots.append(row);
    }
    const reserves = club.players.filter(p => !draft.lineup.includes(p.id));
    bench.classList.toggle('is-expanded', reserves.length > 3);
    if (!reserves.length) bench.append(el('p', 'rb-muted', 'Aucun remplaçant.'));
    else bench.append(el('p', 'rb-muted', 'Disponibles'));
    for (const p of reserves) {
      const row = el('div', 'rb-bench-entry'), controls = el('div', 'rb-controls'), enter = btn('Faire entrer', () => {
        const i = Math.max(0, draft.lineup.indexOf(editor.selectedPlayerId)); replaceAt(i, p.id);
      }); enter.disabled = locked; enter.setAttribute('aria-label', `Faire entrer ${p.name}`);
      controls.append(enter);
      const pick = btn('', () => { selected = draft.selected = p.id; drawDetail(); highlight(); }); pick.setAttribute('data-readonly-control', 'true'); pick.classList.add('rb-bench-name'); pick.setAttribute('aria-label', p.name);
      pick.title = `Gérer ${p.name} · statistiques, rôle et équipement`; row.dataset.playerId = p.id;
      pick.append(athletePortrait(compilePlayer(p, club.inventory), draft.color), el('span', '', p.name)); draggablePlayer(pick, p.id, locked);
      row.addEventListener('click', event => { if (!event.target.closest('button')) pick.click(); });
      row.addEventListener('dragover', event => { if (!locked && [...event.dataTransfer.types].includes(PLAYER_DRAG_TYPE)) event.preventDefault(); });
      row.addEventListener('drop', event => { const index = draft.lineup.indexOf(event.dataTransfer.getData(PLAYER_DRAG_TYPE)); if (locked || index < 0) return; event.preventDefault(); replaceAt(index, p.id); });
      row.append(pick, fatigue(p), controls); bench.append(row);
    }
    highlight();
  }
  strategy.addEventListener('change', changed);
  opening.addEventListener('change', () => { editor.update({ positions: openingDeployment(opening.value) }); changed(); });
  color.addEventListener('input', () => { draft.color = color.value; editor.update({ color: draft.color }); crest.updateColor(draft.color); drawSquad(); changed(); });
  crest.choice.addEventListener('change', changed);
  root.addEventListener('input', changed);
  root.addEventListener('submit', async event => {
    event.preventDefault(); if (locked) return;
    save.disabled = true; root.setAttribute('aria-busy', 'true');
    let saved = false;
    try { saved = Boolean(await onSave(read())); } finally { root.setAttribute('aria-busy', 'false'); if (!saved) changed(); }
  });
  strategy.disabled = opening.disabled = color.disabled = locked; drawSquad(); drawDetail(); changed();
  return { root, read };
}
