import { el, btn, field, select, money, disclosure } from './career-components.mjs';
import { CATALOGUE } from './progression.mjs';

export function playerInventory(club, player, { locked = false, onAssign, onSell } = {}) {
  const root = disclosure(`Protections du club · ${club.inventory.length}`, 'player-inventory'), equipped = club.inventory.find(item => item.playerId === player.id);
  if (!club.inventory.length) { root.append(el('p', 'rb-muted', 'Aucune protection en réserve. Vos achats sont équipés directement sur ce joueur.')); return root; }
  const choice = select({ '': 'Aucune protection', ...Object.fromEntries(club.inventory.map(item => [item.id, `${CATALOGUE[item.itemId].name} · ${item.playerId === player.id ? 'équipée' : item.playerId ? club.players.find(p => p.id === item.playerId)?.name ?? 'portée' : 'réserve'}`])) }, equipped?.id ?? '');
  choice.disabled = locked; choice.setAttribute('aria-label', `Protection du club pour ${player.name}`);
  choice.dataset.focusKey = 'player-protection';
  choice.addEventListener('change', async () => {
    const id = choice.value || equipped?.id; if (!id || locked) return;
    const owner = choice.value ? player.id : null; choice.disabled = true;
    try { await onAssign?.(id, owner); } finally { choice.value = equipped?.id ?? ''; choice.disabled = locked; }
  });
  root.append(field('Attribuer une protection · gratuit', choice), el('p', 'rb-muted', 'Un transfert remet gratuitement l’ancienne protection en réserve.'));
  if (equipped) { const sell = btn(`Revendre · ${money(CATALOGUE[equipped.itemId].price / 2)}`, () => onSell?.(equipped.id)); sell.disabled = locked; root.append(sell); }
  return root;
}
