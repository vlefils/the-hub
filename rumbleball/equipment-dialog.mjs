import { el, btn, money, comparison, equipmentArtwork } from './career-components.mjs';
import { CATALOGUE, EQUIPMENT_SLOTS, equipmentAt, compatibleLocation, equipMutable, equipmentTier, EQUIPMENT_TIERS, equipmentAvailable } from './equipment.mjs';
import { compilePlayer } from './progression.mjs';
import { managementDialog } from './management-dialog.mjs';
import { playerShop } from './player-shop.mjs';

// This dialog lives only while open, outside the inspector that purchases redraw.
export function equipmentDialog(host, club, player, location, options, trigger) {
  let observer;
  const modal = managementDialog(host, () => { observer?.disconnect(); modal.root.remove(); options.onClose?.(); });
  if (globalThis.MutationObserver && trigger) {
    observer = new MutationObserver(() => { if (!host.contains(trigger)) modal.close(); });
    observer.observe(host, { childList: true, subtree: true });
  }
  modal.root.classList.add('rb-equipment-dialog');
  const layout = el('div', 'rb-gear-browser'), collection = el('div', 'rb-gear-collection'), preview = el('aside', 'rb-gear-preview');
  const carried = equipmentAt(player, club.inventory, location), cards = [], entries = [];
  let selected, displayed, pending = false;
  const budget = el('p', 'rb-gear-budget'); budget.append(el('span', 'rb-muted', player.name), el('strong', '', `Solde · ${money(club.balance)}`));
  const message = el('p', 'rb-muted', 'Cliquez sur un objet pour comparer ses effets, puis choisissez de l’équiper ou de l’acheter.');
  collection.append(message);

  async function act(action) {
    if (pending || options.locked) return;
    pending = true; modal.close();
    try { await action(); } finally {
      if (document.activeElement === trigger || !host.contains(document.activeElement)) {
        const next = [...host.querySelectorAll('.rb-body-slot')].find(button => button.dataset.slot === location);
        if (next?.closest('.rb-inspector-panel')?.dataset.active !== 'false') next?.focus({ preventScroll: true });
      }
    }
  }
  function show(entry) {
    const item = CATALOGUE[entry.itemId];
    if (displayed === entry) return;
    displayed = entry;
    preview.scrollTop = 0;
    if (entry.source === 'catalogue') {
      preview.replaceChildren(playerShop(club, player, { ...options, location, selectedItem: entry.itemId, showPicker: false,
        onBuy: (...args) => act(() => options.onBuy?.(...args)) }));
      return;
    }
    const heading = el('div', 'rb-equipment-heading'), copy = el('div');
    copy.append(el('small', 'rb-muted', EQUIPMENT_TIERS[equipmentTier(item)]), el('h3', '', item.name), el('p', '', item.effect));
    heading.append(equipmentArtwork(entry.itemId, ''), copy);
    const inventory = structuredClone(club.inventory);
    const after = structuredClone(player);
    if (entry.inventoryId) equipMutable(inventory, entry.inventoryId, player.id, location, after);
    preview.replaceChildren(heading, el('p', 'rb-muted', entry.owner), comparison(compilePlayer(player, club.inventory, club), compilePlayer(after, inventory, club)));
    if (item.description) preview.append(el('p', 'rb-muted', item.description));
    if (options.locked) { preview.append(el('p', 'rb-muted', 'Équipe verrouillée · consultation uniquement.')); return; }
    if (!entry.inventoryId) { preview.append(el('p', 'rb-muted', 'Implant déjà installé. Choisissez un modèle du magasin pour le remplacer.')); return; }
    const equipped = carried?.id === entry.inventoryId;
    const action = btn(equipped ? 'Retirer vers la réserve' : entry.playerId && entry.playerId !== player.id ? 'Transférer et équiper' : 'Équiper depuis la réserve',
      () => act(() => options.onAssign?.(entry.inventoryId, equipped ? null : player.id, location)), !equipped);
    preview.append(el('p', 'rb-muted', equipped ? 'Le retrait libère cet emplacement sans détruire l’objet.' : 'Transfert gratuit. L’objet remplacé retourne dans la réserve du club.'), action);
    if (equipped) preview.append(btn(item.price === 0 ? 'Restituer la dotation gratuite' : `Revendre · ${money(item.price / 2)}`, () => act(() => options.onSell?.(entry.inventoryId))));
  }
  function choose(entry) {
    selected = entry; options.onItem?.(entry.itemId);
    for (const [card, item] of cards) card.setAttribute('aria-pressed', String(item === selected));
    show(entry);
  }
  function section(title, items, empty) {
    const group = el('section', 'rb-gear-group'), grid = el('div', 'rb-gear-grid');
    group.append(el('h3', '', title));
    if (!items.length) group.append(el('p', 'rb-muted', empty));
    for (const entry of items) {
      const item = CATALOGUE[entry.itemId], card = btn('', () => { choose(entry); (preview.querySelector('input') ?? [...preview.querySelectorAll('button')].find(button => !button.disabled))?.focus({ preventScroll: true }); }); card.classList.add('rb-gear-card');
      card.dataset.itemId = entry.itemId; card.dataset.source = entry.source; card.dataset.inventoryId = entry.inventoryId ?? '';
      card.setAttribute('aria-label', `${item.name} · ${entry.owner} · ${item.effect}`);
      card.append(equipmentArtwork(entry.itemId, ''), el('strong', '', item.name), el('small', 'rb-muted', entry.owner));
      entries.push(entry); cards.push([card, entry]); grid.append(card);
    }
    if (items.length) group.append(grid); collection.append(group);
  }
  const owned = location === 'implant'
    ? player.implant ? [{ source: 'owned', itemId: player.implant, owner: 'Implant installé' }] : []
    : club.inventory.filter(item => CATALOGUE[item.itemId].price > 0 && compatibleLocation(item.itemId, location)).map(item => ({ source: 'owned', itemId: item.itemId, inventoryId: item.id, playerId: item.playerId,
      owner: carried?.id === item.id ? 'Équipé ici' : item.playerId === player.id ? 'Porté dans l’autre main' : item.playerId ? `Porté par ${club.players.find(p => p.id === item.playerId)?.name ?? 'un coéquipier'}` : 'Réserve du club' }));
  const catalogue = Object.entries(CATALOGUE).filter(([id]) => equipmentAvailable(id, club.mode) && compatibleLocation(id, location)).sort(([, a], [, b]) => equipmentTier(a) - equipmentTier(b) || a.price - b.price)
    .map(([itemId, item]) => ({ source: 'catalogue', itemId, owner: item.price === 0 ? carried?.itemId === itemId ? 'Équipé · gratuit et illimité' : 'Gratuit · disponible à volonté' : `${EQUIPMENT_TIERS[equipmentTier(item)]} · ${money(item.price)}` }));
  section(location === 'implant' ? 'Implant actuel' : 'Matériel du club', owned, location === 'implant' ? 'Aucun implant installé.' : 'Aucune pièce du club pour cet emplacement.');
  const free = catalogue.filter(entry => CATALOGUE[entry.itemId].price === 0);
  if (free.length) section('Dotation gratuite · illimitée', free);
  section('Magasin', catalogue.filter(entry => CATALOGUE[entry.itemId].price > 0), 'Aucun modèle payant pour cet emplacement.');
  layout.append(collection, preview); modal.body.append(budget, layout);
  choose(entries.find(entry => entry.itemId === options.selectedItem) ?? entries.find(entry => entry.inventoryId === carried?.id && entry.inventoryId || entry.source === 'catalogue' && carried?.issued && entry.itemId === carried.itemId) ?? entries[0]);
  modal.show(`${EQUIPMENT_SLOTS[location]} · équipement`, trigger);
  return modal;
}
