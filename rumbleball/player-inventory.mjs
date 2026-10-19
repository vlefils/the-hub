import { el, btn, field, select, money, disclosure } from './career-components.mjs';
import { CATALOGUE } from './progression.mjs';
import { EQUIPMENT_SLOTS, compatibleLocation, equipmentAt } from './equipment.mjs';

export function playerInventory(club, player, { locked = false, onAssign, onSell, location = 'torso', inline = false } = {}) {
  const items = club.inventory.filter(item => compatibleLocation(item.itemId, location));
  const root = inline ? el('section', 'rb-player-inventory') : disclosure(`Matériel du club · ${items.length}`, 'player-inventory'), equipped = equipmentAt(player, club.inventory, location);
  if (location === 'implant') { root.append(el('p', 'rb-muted', 'L’implant est attaché au joueur. Son remplacement demande une confirmation.')); return root; }
  if (!items.length) { root.append(el('p', 'rb-muted', 'Aucun équipement du club pour cet emplacement.')); return root; }
  const choice = select({ '': 'Emplacement libre', ...Object.fromEntries(items.map(item => [item.id, `${CATALOGUE[item.itemId].name} · ${item.playerId === player.id ? 'équipé' : item.playerId ? club.players.find(p => p.id === item.playerId)?.name ?? 'porté' : 'réserve'}`])) }, equipped?.id ?? '');
  choice.disabled = locked; choice.setAttribute('aria-label', `${EQUIPMENT_SLOTS[location]} · matériel du club pour ${player.name}`);
  choice.dataset.focusKey = location === 'torso' ? 'player-protection' : `player-equipment-${location}`;
  choice.addEventListener('change', async () => {
    const id = choice.value || equipped?.id; if (!id || locked) return;
    const owner = choice.value ? player.id : null; choice.disabled = true;
    try { await onAssign?.(id, owner, location); } finally { choice.value = equipped?.id ?? ''; choice.disabled = locked; }
  });
  root.append(field('Matériel du club · transfert gratuit', choice), el('p', 'rb-muted', 'La pièce remplacée retourne en réserve. Une arme à deux mains libère les deux emplacements quand elle est retirée.'));
  if (equipped) { const sell = btn(CATALOGUE[equipped.itemId].price === 0 ? 'Restituer la dotation gratuite' : `Revendre · ${money(CATALOGUE[equipped.itemId].price / 2)}`, () => onSell?.(equipped.id)); sell.disabled = locked; root.append(sell); }
  return root;
}
