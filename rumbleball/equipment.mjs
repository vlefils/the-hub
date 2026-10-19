export const EQUIPMENT_SLOTS = { head: 'Tête', torso: 'Torse', gloves: 'Gants', feet: 'Bottes', implant: 'Implant', rightHand: 'Main droite', leftHand: 'Main gauche' };
export const HAND_SLOTS = ['rightHand', 'leftHand'];
export const CATALOGUE = {
  vest: { name: 'Plastron léger', slot: 'protection', location: 'torso', price: 100, effect: '+1 CA', armor: 1 },
  armor: { name: 'Armure renforcée', slot: 'protection', location: 'torso', price: 150, effect: '+2 CA · −1,5 m', armor: 2, speed: -1.5 },
  gloves: { name: 'Gants de lutte', slot: 'protection', location: 'gloves', price: 150, effect: '+1 Lutte', wrestling: 1 },
  soles: { name: 'Semelles adhérentes', slot: 'protection', location: 'feet', price: 150, effect: '+1 Acrobaties', acrobatics: 1 },
  helmet: { name: 'Casque d’arène', slot: 'protection', location: 'head', price: 100, effect: '+1 CA', armor: 1 },
  legs: { name: 'Jambes augmentées', slot: 'implant', location: 'implant', price: 300, effect: '+1,5 m', speed: 1.5 },
  fibers: { name: 'Fibres contractiles', slot: 'implant', location: 'implant', price: 300, effect: '+1 Lutte', wrestling: 1 },
  interface: { name: 'Interface visuomotrice', slot: 'implant', location: 'implant', price: 300, effect: '+1 Acrobaties', acrobatics: 1 },
  regulator: { name: 'Régulateur d’effort', slot: 'implant', location: 'implant', price: 300, effect: 'Participation : +1 fatigue au lieu de +2 ; KO : +1 conservé' },
  knuckles: { name: 'Poings chromés', slot: 'weapon', price: 0, effect: '1d4 · légère · finesse', die: 4, hands: 1, light: true, finesse: true },
  tonfa: { name: 'Tonfa d’arène', slot: 'weapon', price: 0, effect: '1d6 · légère · finesse', die: 6, hands: 1, light: true, finesse: true },
  bat: { name: 'Batte renforcée', slot: 'weapon', price: 0, effect: '1d8 · 1d10 si l’autre main est libre · Force', die: 8, versatile: 10, hands: 1 },
  maul: { name: 'Marteau d’arène', slot: 'weapon', price: 0, effect: '1d10 · deux mains · Force', die: 10, hands: 2 },
  shield: { name: 'Bouclier de contact', slot: 'weapon', price: 0, effect: '+1 CA · une main · un seul bouclier', hands: 1, armor: 1, shield: true },
  pulse_knuckles: { name: 'Poings Pulse', slot: 'weapon', tier: 2, appearance: 'knuckles', price: 250, effect: '1d4 · +1 toucher et dégâts · légère · finesse', description: 'Des bobines d’impact renforcent chaque frappe sans encombrer la seconde main.', die: 4, enhancement: 1, hands: 1, light: true, finesse: true },
  arc_tonfa: { name: 'Tonfa Arc', slot: 'weapon', tier: 2, appearance: 'tonfa', price: 400, effect: '1d6 · +1 toucher et dégâts · légère · finesse', description: 'Un bâton à induction pour les duellistes mobiles et le combat à deux armes.', die: 6, enhancement: 1, hands: 1, light: true, finesse: true },
  shock_bat: { name: 'Batte Aftershock', slot: 'weapon', tier: 2, appearance: 'bat', price: 450, effect: '1d8 · 1d10 si l’autre main est libre · +1 toucher et dégâts · Force', description: 'Son noyau cinétique récompense les frappes lourdes. Se combine aussi avec un bouclier.', die: 8, versatile: 10, enhancement: 1, hands: 1 },
  gravity_maul: { name: 'Marteau Gravité', slot: 'weapon', tier: 2, appearance: 'maul', price: 600, effect: '1d12 · +1 toucher et dégâts · deux mains · Force', description: 'Toute la puissance dans un seul impact, au prix des deux emplacements de main.', die: 12, enhancement: 1, hands: 2 },
  aegis_shield: { name: 'Bouclier Égide', slot: 'weapon', tier: 2, appearance: 'shield', price: 450, effect: '+2 CA · une main · un seul bouclier', description: 'Un écran de contact renforcé pour tenir la ligne et protéger le porteur.', hands: 1, armor: 2, shield: true },
  ghost_baton: { name: 'Matraque Nulltrace', slot: 'weapon', tier: 3, appearance: 'bat', price: 850, effect: '1d6 · +2 toucher et dégâts · légère · finesse', description: 'Une matraque à capteurs et tête amortie, conçue pour des impacts précis et non létaux.', die: 6, enhancement: 2, hands: 1, light: true, finesse: true },
  optic_visor: { name: 'Visière Spectre', slot: 'protection', location: 'head', tier: 2, appearance: 'helmet', price: 350, effect: '+1 CA · +1 Acrobaties', description: 'L’affichage prédictif aide à lire les trajectoires sans alourdir le joueur.', armor: 1, acrobatics: 1 },
  bastion_helmet: { name: 'Casque Bastion', slot: 'protection', location: 'head', tier: 2, appearance: 'helmet', price: 350, effect: '+2 CA', description: 'Une coque multicouche pour les joueurs qui s’exposent au contact.', armor: 2 },
  mesh_armor: { name: 'Veste Nightweave', slot: 'protection', location: 'torso', tier: 2, appearance: 'vest', price: 450, effect: '+2 CA · aucune pénalité de vitesse', description: 'Un tissage balistique souple qui conserve la mobilité des coureurs.', armor: 2 },
  bulwark_armor: { name: 'Plastron Citadelle', slot: 'protection', location: 'torso', tier: 3, appearance: 'armor', price: 650, effect: '+3 CA · −1,5 m', description: 'Des plaques lourdes pour verrouiller une zone ; le poids ralentit les courses.', armor: 3, speed: -1.5 },
  grapple_gloves: { name: 'Gantelets Vicegrip', slot: 'protection', location: 'gloves', tier: 2, appearance: 'gloves', price: 350, effect: '+2 Lutte', description: 'Des doigts assistés pour les prises, les plaquages et les arrachements.', wrestling: 2 },
  sprint_boots: { name: 'Bottes Overdrive', slot: 'protection', location: 'feet', tier: 2, appearance: 'soles', price: 400, effect: '+1,5 m', description: 'Des semelles à détente pour gagner du terrain à chaque déplacement.', speed: 1.5 },
  ghost_boots: { name: 'Bottes Slipstream', slot: 'protection', location: 'feet', tier: 2, appearance: 'soles', price: 350, effect: '+2 Acrobaties', description: 'Des appuis articulés pour esquiver et résister aux prises.', acrobatics: 2 },
  kinetic_implant: { name: 'Faisceau Kinetic', slot: 'implant', location: 'implant', tier: 3, appearance: 'fibers', price: 600, effect: '+1,5 m · +1 Lutte', description: 'Des fibres neuromusculaires qui combinent propulsion et puissance de préhension.', speed: 1.5, wrestling: 1 },
  reflex_implant: { name: 'Noyau Synapse', slot: 'implant', location: 'implant', tier: 3, appearance: 'interface', price: 600, effect: '+1 CA · +1 Acrobaties', description: 'Une interface réflexe pour anticiper le contact et conserver son équilibre.', armor: 1, acrobatics: 1 },
};
export const EQUIPMENT_TIERS = ['Dotation gratuite', 'Standard', 'Avancé', 'Élite'];
export const equipmentTier = item => item.price === 0 ? 0 : item.tier ?? 1;
export const ARENA_WEAPON_RULE = 'Armes de contact contondantes et non létales uniquement. Armes tranchantes et perforantes interdites.';
const need = (ok, text) => { if (!ok) throw new Error(text); };
export const equipmentDefinition = id => typeof id === 'string' && Object.hasOwn(CATALOGUE, id) ? CATALOGUE[id] : null;
export const itemLocation = item => equipmentDefinition(item.itemId)?.slot === 'weapon' ? item.location ?? 'rightHand' : equipmentDefinition(item.itemId)?.location;
export const compatibleLocation = (id, location) => Boolean(equipmentDefinition(id)) && (CATALOGUE[id].slot === 'weapon' ? HAND_SLOTS.includes(location) : CATALOGUE[id].location === location);
export const occupiedSlots = (item, location = itemLocation(item)) => equipmentDefinition(item.itemId)?.hands === 2 ? HAND_SLOTS : [location];
export function equippedItems(player, inventory = []) { return inventory.filter(item => item.playerId === player.id); }
export function equipmentAt(player, inventory, location) {
  return equippedItems(player, inventory).find(item => occupiedSlots(item).includes(location)) ?? null;
}
export function equipMutable(inventory, id, playerId, location) {
  const item = inventory.find(item => item.id === id), definition = equipmentDefinition(item?.itemId);
  need(definition && definition.slot !== 'implant', 'Équipement inconnu.');
  const target = location ?? itemLocation(item); need(compatibleLocation(item.itemId, target), 'Emplacement incompatible.');
  if (playerId !== null) for (const old of inventory) if (old.id !== id && old.playerId === playerId && (occupiedSlots(old).some(slot => occupiedSlots(item, target).includes(slot)) || definition.shield && CATALOGUE[old.itemId]?.shield)) old.playerId = null;
  item.playerId = playerId; if (definition.slot === 'weapon') item.location = target;
  return item;
}
export function previewEquipment(player, inventory, itemId, location) {
  const next = structuredClone(player), items = structuredClone(inventory ?? []);
  need(equipmentDefinition(itemId), 'Équipement inconnu.');
  if (CATALOGUE[itemId].slot === 'implant') next.implant = itemId;
  else { let id = '__preview__'; while (items.some(item => item.id === id)) id += '_'; items.push({ id, itemId, playerId: null }); equipMutable(items, id, player.id, location); }
  return { player: next, inventory: items };
}
export function validEquipmentInventory(inventory, playerIds) {
  if (!Array.isArray(inventory)) return false;
  const ids = new Set(), occupied = new Set(), shields = new Set();
  for (const item of inventory) {
    const definition = equipmentDefinition(item?.itemId);
    if (!item || typeof item.id !== 'string' || !item.id.length || item.id.length > 80 || ids.has(item.id) || !definition || definition.slot === 'implant' || item.playerId !== null && !playerIds.includes(item.playerId) || !compatibleLocation(item.itemId, itemLocation(item))) return false;
    if (item.location !== undefined && !compatibleLocation(item.itemId, item.location)) return false;
    ids.add(item.id);
    if (item.playerId !== null) {
      for (const slot of occupiedSlots(item)) { const key = `${item.playerId}:${slot}`; if (occupied.has(key)) return false; occupied.add(key); }
      if (definition.shield) { if (shields.has(item.playerId)) return false; shields.add(item.playerId); }
    }
  }
  return true;
}
