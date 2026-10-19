import { el, btn, equipmentArtwork } from './career-components.mjs';
import { CATALOGUE, EQUIPMENT_SLOTS, equipmentAt } from './equipment.mjs';
import { playerInventory } from './player-inventory.mjs';
import { playerShop } from './player-shop.mjs';
import { equipmentDialog } from './equipment-dialog.mjs';
import { wideInspector, WIDE_INSPECTOR } from './player-inspector.mjs';

const mannequin = new URL('./assets/equipment/mannequin.svg', import.meta.url).href;
export function playerEquipment(club, player, options = {}) {
  const root = el('section', 'rb-player-equipment'); root.setAttribute('aria-label', `Équipement de ${player.name}`);
  let location = Object.hasOwn(EQUIPMENT_SLOTS, options.selectedSlot) ? options.selectedSlot : 'torso', selectedItem = options.selectedItem;
  function draw(focus = false) {
    const diagram = el('div', 'rb-body-slots'), body = el('img', 'rb-equipment-body'); body.src = mannequin; body.alt = ''; body.setAttribute('aria-hidden', 'true'); diagram.append(body);
    for (const [slot, label] of Object.entries(EQUIPMENT_SLOTS)) {
      const equipped = equipmentAt(player, club.inventory, slot), id = slot === 'implant' ? player.implant : equipped?.itemId, item = CATALOGUE[id];
      const choice = btn('', () => {
        location = slot; selectedItem = undefined; options.onSlot?.(slot);
        if (wideInspector()) {
          const host = root.closest('.rb') ?? root.closest('.rb-online') ?? root;
          const media = window.matchMedia(WIDE_INSPECTOR);
          const resize = () => { if (!wideInspector()) { dialog.close(); draw(true); } };
          const dialog = equipmentDialog(host, club, player, slot, { ...options, selectedItem, onItem: id => { selectedItem = id; options.onItem?.(id); }, onClose: () => media.removeEventListener?.('change', resize) }, choice);
          media.addEventListener?.('change', resize);
          for (const button of root.querySelectorAll('.rb-body-slot')) button.setAttribute('aria-pressed', String(button.dataset.slot === slot));
        } else draw(true);
      });
      choice.classList.add('rb-body-slot'); choice.dataset.slot = slot; choice.dataset.focusKey = `equipment-slot-${slot}`;
      choice.setAttribute('aria-pressed', String(slot === location)); choice.setAttribute('aria-label', `${label} · ${item?.name ?? 'emplacement libre'}${item?.hands === 2 ? ' · deux mains' : ''}`);
      choice.setAttribute('data-readonly-control', 'true');
      choice.title = item ? `${label} · ${item.name} · ${item.effect}` : `${label} · choisir un équipement`;
      choice.append(el('small', 'rb-muted', label));
      if (item) choice.append(equipmentArtwork(id, ''));
      else choice.append(el('span', 'rb-empty-slot', '+'));
      choice.append(el('strong', '', item?.name ?? 'Libre'));
      if (item?.hands === 2) choice.append(el('small', 'rb-muted', 'Deux mains'));
      diagram.append(choice);
    }
    const context = el('div', 'rb-equipment-context'), equipped = equipmentAt(player, club.inventory, location), id = location === 'implant' ? player.implant : equipped?.itemId;
    context.classList.add('rb-equipment-inline');
    context.append(el('h5', '', EQUIPMENT_SLOTS[location]), el('p', 'rb-muted', id ? `${CATALOGUE[id].name} · ${CATALOGUE[id].effect}` : 'Sélectionnez une pièce du club ou achetez un équipement pour cet emplacement.'));
    context.append(playerInventory(club, player, { ...options, location, inline: true }), playerShop(club, player, { ...options, location, selectedItem, onItem: id => { selectedItem = id; options.onItem?.(id); } }));
    const workbench = el('div', 'rb-equipment-workbench'); workbench.append(diagram, context);
    root.replaceChildren(el('h4', '', 'Équipement'), workbench, el('p', 'rb-muted rb-equipment-help', 'Cliquez un emplacement pour gérer son équipement. Les armes de dotation sont gratuites ; les modèles avancés et d’élite s’achètent en chromas. Sans arme équipée, le joueur conserve son matériel d’entraînement.'));
    if (focus) [...root.querySelectorAll('.rb-body-slot')].find(button => button.dataset.slot === location)?.focus({ preventScroll: true });
  }
  draw(); return root;
}
