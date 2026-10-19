import { el, btn, field, select, money, comparison, equipmentArtwork } from './career-components.mjs';
import { CATALOGUE, compilePlayer } from './progression.mjs';
import { compatibleLocation, equipmentAt, previewEquipment, HAND_SLOTS } from './equipment.mjs';

// One compact, real purchase flow, shared by the solo and online inspectors.
export function playerShop(club, player, { locked = false, onBuy, selectedItem, onItem, location } = {}) {
  const available = Object.entries(CATALOGUE).filter(([id]) => !location || compatibleLocation(id, location));
  const root = el('section', 'rb-player-shop'), choice = select(Object.fromEntries(available.map(([id, item]) => [id, `${item.name} · ${money(item.price)}`])), available.some(([id]) => id === selectedItem) ? selectedItem : available[0][0]);
  choice.setAttribute('aria-label', `Équipement pour ${player.name}`);
  choice.disabled = locked;
  const hand = select({ rightHand: 'Main droite', leftHand: 'Main gauche' }, HAND_SLOTS.includes(location) ? location : 'rightHand'); hand.disabled = locked;
  const preview = el('div', 'rb-player-shop-preview');
  root.append(el('h4', '', location ? 'Magasin' : 'Équiper ce joueur'), field('Choisir un équipement', choice), preview);
  function draw() {
    const id = choice.value, item = CATALOGUE[id], target = item.slot === 'weapon' ? hand.value : item.location;
    const before = compilePlayer(player, club.inventory), after = previewEquipment(player, club.inventory, id, target);
    const heading = el('div', 'rb-equipment-heading'); heading.append(equipmentArtwork(id, ''), el('div', '', item.effect));
    const replace = el('input'); replace.type = 'checkbox';
    const replacing = item.slot === 'implant' && player.implant && player.implant !== id;
    const equipped = item.slot === 'implant' ? player.implant === id : equipmentAt(player, club.inventory, target)?.itemId === id;
    const reason = locked ? 'Équipe verrouillée.' : equipped ? 'Cet équipement est déjà porté.' : club.balance < 0 ? 'Achats bloqués : salaires impayés.' : club.balance < item.price ? `Il manque ${item.price - club.balance} chromas.` : '';
    const buy = btn(`Acheter et équiper · ${money(item.price)}`, async () => {
      if (replacing && !replace.checked) return;
      buy.disabled = true;
      try { if (item.slot === 'weapon') await onBuy?.(id, player.id, Boolean(replace.checked), target); else await onBuy?.(id, player.id, Boolean(replace.checked)); } finally { buy.disabled = Boolean(reason) || Boolean(replacing && !replace.checked); }
    }, true);
    buy.disabled = Boolean(reason) || Boolean(replacing); replace.disabled = locked;
    replace.addEventListener('change', () => { buy.disabled = Boolean(reason) || !replace.checked; });
    preview.replaceChildren(); if (item.slot === 'weapon' && !location) preview.append(field('Main à équiper', hand));
    preview.append(heading, comparison(before, compilePlayer(after.player, after.inventory), player.implant, after.player.implant));
    if (replacing) preview.append(field(`Détruire ${CATALOGUE[player.implant].name} pour le remplacer`, replace));
    preview.append(el('p', reason ? 'rb-loss' : 'rb-muted', reason || `Après achat : ${money(club.balance - item.price)}`), buy);
  }
  hand.addEventListener('change', draw); choice.addEventListener('change', () => { onItem?.(choice.value); draw(); }); draw(); return root;
}
