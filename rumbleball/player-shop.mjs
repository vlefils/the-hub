import { el, btn, field, select, money, comparison, equipmentArtwork } from './career-components.mjs';
import { CATALOGUE, compilePlayer } from './progression.mjs';

// One compact, real purchase flow, shared by the solo and online inspectors.
export function playerShop(club, player, { locked = false, onBuy, selectedItem, onItem } = {}) {
  const root = el('section', 'rb-player-shop'), choice = select(Object.fromEntries(Object.entries(CATALOGUE).map(([id, item]) => [id, `${item.name} · ${money(item.price)}`])), selectedItem ?? Object.keys(CATALOGUE)[0]);
  choice.setAttribute('aria-label', `Équipement pour ${player.name}`);
  const preview = el('div', 'rb-player-shop-preview');
  root.append(el('h4', '', 'Équiper ce joueur'), field('Choisir un équipement', choice), preview);
  function draw() {
    const id = choice.value, item = CATALOGUE[id], before = compilePlayer(player, club.inventory), after = { ...player, implant: item.slot === 'implant' ? id : player.implant };
    const inventory = item.slot === 'protection' ? [...club.inventory.filter(g => g.playerId !== player.id), { itemId: id, playerId: player.id }] : club.inventory;
    const heading = el('div', 'rb-equipment-heading'); heading.append(equipmentArtwork(id, ''), el('div', '', item.effect));
    const replace = el('input'); replace.type = 'checkbox';
    const replacing = item.slot === 'implant' && player.implant && player.implant !== id;
    const equipped = item.slot === 'implant' ? player.implant === id : club.inventory.some(g => g.playerId === player.id && g.itemId === id);
    const reason = locked ? 'Équipe verrouillée.' : equipped ? 'Cet équipement est déjà porté.' : club.balance < 0 ? 'Achats bloqués : salaires impayés.' : club.balance < item.price ? `Il manque ${item.price - club.balance} chromas.` : '';
    const buy = btn(`Acheter et équiper · ${money(item.price)}`, async () => {
      if (replacing && !replace.checked) return;
      buy.disabled = true;
      try { await onBuy?.(id, player.id, Boolean(replace.checked)); } finally { buy.disabled = Boolean(reason) || Boolean(replacing && !replace.checked); }
    }, true);
    buy.disabled = Boolean(reason) || Boolean(replacing); replace.disabled = locked;
    replace.addEventListener('change', () => { buy.disabled = Boolean(reason) || !replace.checked; });
    preview.replaceChildren(heading, comparison(before, compilePlayer(after, inventory), player.implant, after.implant));
    if (replacing) preview.append(field(`Détruire ${CATALOGUE[player.implant].name} pour le remplacer`, replace));
    preview.append(el('p', reason ? 'rb-loss' : 'rb-muted', reason || `Après achat : ${money(club.balance - item.price)}`), buy);
  }
  choice.addEventListener('change', () => { onItem?.(choice.value); draw(); }); draw(); return root;
}
