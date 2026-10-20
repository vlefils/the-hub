import { PROFILES } from './data.mjs';

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
  maul: { name: 'Marteau d’arène', slot: 'weapon', price: 0, effect: '2d6 · deux mains · Force', die: 6, count: 2, hands: 2 },
  shield: { name: 'Bouclier de contact', slot: 'weapon', price: 0, effect: '+2 CA · une main · un seul bouclier', hands: 1, armor: 2, shield: true },
  pulse_knuckles: { name: 'Poings Pulse', slot: 'weapon', tier: 2, appearance: 'knuckles', price: 250, effect: '1d4 · +1 toucher et dégâts · légère · finesse', description: 'Des bobines d’impact renforcent chaque frappe sans encombrer la seconde main.', die: 4, enhancement: 1, hands: 1, light: true, finesse: true },
  arc_tonfa: { name: 'Tonfa Arc', slot: 'weapon', tier: 2, appearance: 'tonfa', price: 400, effect: '1d6 · +1 toucher et dégâts · légère · finesse', description: 'Un bâton à induction pour les duellistes mobiles et le combat à deux armes.', die: 6, enhancement: 1, hands: 1, light: true, finesse: true },
  shock_bat: { name: 'Batte Aftershock', slot: 'weapon', tier: 2, appearance: 'bat', price: 450, effect: '1d8 · 1d10 si l’autre main est libre · +1 toucher et dégâts · Force', description: 'Son noyau cinétique récompense les frappes lourdes. Se combine aussi avec un bouclier.', die: 8, versatile: 10, enhancement: 1, hands: 1 },
  gravity_maul: { name: 'Marteau Gravité', slot: 'weapon', tier: 2, appearance: 'maul', price: 600, effect: '2d6 · +1 toucher et dégâts · deux mains · Force', description: 'Toute la puissance dans un seul impact, au prix des deux emplacements de main.', die: 6, count: 2, enhancement: 1, hands: 2 },
  aegis_shield: { name: 'Bouclier Égide', slot: 'weapon', tier: 2, appearance: 'shield', price: 450, effect: '+3 CA · une main · un seul bouclier', description: 'Un écran de contact renforcé pour tenir la ligne et protéger le porteur.', hands: 1, armor: 3, shield: true },
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
// Long-career variants share their family's artwork and contact-safe mechanics.
const longFamilies = {
  knuckles: ['pulse_knuckles', 'Poings', 'knuckles'], tonfa: ['arc_tonfa', 'Tonfa', 'tonfa'],
  bat: ['shock_bat', 'Batte', 'bat'], maul: ['gravity_maul', 'Marteau', 'maul'],
  shield: ['aegis_shield', 'Bouclier', 'shield'], helmet: ['bastion_helmet', 'Casque', 'helmet'],
  armor: ['bulwark_armor', 'Plastron', 'armor'], gloves: ['grapple_gloves', 'Gantelets', 'gloves'],
  boots: ['ghost_boots', 'Bottes', 'soles'], regulator: ['regulator', 'Régulateur', 'regulator'],
};
for (const [tier, suffix, multiplier] of [[4, 'Prototype', 2], [5, 'Singularité', 4]]) for (const [family, [baseId, label, appearance]] of Object.entries(longFamilies)) {
  const base = CATALOGUE[baseId], item = { ...base, name: `${label} ${suffix}`, tier, longOnly: true, appearance, artwork: baseId, price: base.price * multiplier,
    description: `Série ${suffix} du circuit longue carrière. ${base.slot === 'weapon' ? 'Contact contondant, exclusivement non létal.' : 'Équipement de compétition du circuit supérieur.'}` };
  if (base.die) { item.enhancement = tier - 1; item.effect = `${base.count ?? 1}d${base.die}${base.versatile ? ` · 1d${base.versatile} à deux mains` : ''} · +${item.enhancement} toucher et dégâts · ${base.hands === 2 ? 'deux mains · Force' : base.finesse ? 'légère · finesse' : 'Force'}`; }
  else if (family === 'shield') { item.armor = tier; item.effect = `+${tier} CA · une main · un seul bouclier`; }
  else if (family === 'helmet') { item.armor = tier - 2; item.acrobatics = tier - 3; item.effect = `+${item.armor} CA · +${item.acrobatics} Acrobaties`; }
  else if (family === 'armor') { item.armor = tier; item.effect = `+${tier} CA · −1,5 m`; }
  else if (family === 'gloves') { item.wrestling = tier - 1; item.effect = `+${item.wrestling} Lutte`; }
  else if (family === 'boots') { item.acrobatics = tier - 1; item.effect = `+${item.acrobatics} Acrobaties`; }
  else { item.participationFatigue = 1; item.recovery = tier - 3; item.effect = `Participation : +1 fatigue · récupération au repos +${item.recovery} · KO : +1 conservé`; }
  CATALOGUE[`${family}_${suffix.toLowerCase().replace('é', 'e')}`] = item;
}
export const EQUIPMENT_TIERS = ['Dotation gratuite', 'Standard', 'Avancé', 'Élite', 'Prototype', 'Singularité'];
export const equipmentTier = item => item.price === 0 ? 0 : item.tier ?? 1;
export const equipmentAvailable = (id, mode = 'classic') => Boolean(equipmentDefinition(id)) && (!CATALOGUE[id].longOnly || mode === 'long');
export const ARENA_WEAPON_RULE = 'Armes de contact contondantes et non létales uniquement. Armes tranchantes et perforantes interdites.';
const need = (ok, text) => { if (!ok) throw new Error(text); };
export const equipmentDefinition = id => typeof id === 'string' && Object.hasOwn(CATALOGUE, id) ? CATALOGUE[id] : null;
export const itemLocation = item => equipmentDefinition(item.itemId)?.slot === 'weapon' ? item.location ?? 'rightHand' : equipmentDefinition(item.itemId)?.location;
export const compatibleLocation = (id, location) => Boolean(equipmentDefinition(id)) && (CATALOGUE[id].slot === 'weapon' ? HAND_SLOTS.includes(location) : CATALOGUE[id].location === location);
export const occupiedSlots = (item, location = itemLocation(item)) => equipmentDefinition(item.itemId)?.hands === 2 ? HAND_SLOTS : [location];
export const isIssuedWeapon = id => equipmentDefinition(id)?.slot === 'weapon' && CATALOGUE[id].price === 0;
export const defaultIssuedWeapons = player => ({ rightHand: PROFILES[player.profile]?.archetype === 'belier' ? 'maul' : 'tonfa', leftHand: null });
function initialIssuedWeapons(player, inventory) {
  const held = inventory.filter(item => item.playerId === player.id && CATALOGUE[item.itemId]?.slot === 'weapon');
  if (!held.length) return PROFILES[player.profile] ? defaultIssuedWeapons(player) : { rightHand: null, leftHand: null };
  return Object.fromEntries(HAND_SLOTS.map(slot => [slot, held.find(item => isIssuedWeapon(item.itemId) && itemLocation(item) === slot)?.itemId ?? null]));
}
export function validIssuedWeapons(weapons) {
  if (!weapons || typeof weapons !== 'object' || Array.isArray(weapons) || Object.keys(weapons).length !== 2 || !HAND_SLOTS.every(slot => Object.hasOwn(weapons, slot) && (weapons[slot] === null || isIssuedWeapon(weapons[slot])))) return false;
  const held = HAND_SLOTS.map(slot => weapons[slot]).filter(Boolean);
  return !(held.length > 1 && (held.some(id => CATALOGUE[id].hands === 2) || held.every(id => CATALOGUE[id].shield)));
}
export function ensureClubEquipment(club, market = [], inventory = club.inventory ?? []) {
  for (const p of [...club.players, ...market]) p.issuedWeapons ??= initialIssuedWeapons(p, inventory);
  // Legacy free copies become personal choices, never a finite club reserve.
  for (let i = inventory.length - 1; i >= 0; i--) if (isIssuedWeapon(inventory[i].itemId)) inventory.splice(i, 1);
  return club;
}
export function ensureCareerEquipment(career) {
  for (const [i, club] of career.clubs.entries()) ensureClubEquipment(club, i === 0 ? career.market : [], i === 0 ? career.inventory : club.inventory ?? []);
  return career;
}
export function issuedEquipment(player, inventory = []) {
  const choices = player.issuedWeapons ?? initialIssuedWeapons(player, inventory);
  return HAND_SLOTS.filter(slot => choices[slot]).map(slot => ({ id: `issued:${player.id}:${slot}`, itemId: choices[slot], playerId: player.id, location: slot, issued: true }));
}
export function equippedItems(player, inventory = []) {
  const owned = inventory.filter(item => item.playerId === player.id);
  const issued = issuedEquipment(player, inventory).filter(item => !owned.some(old => occupiedSlots(old).some(slot => occupiedSlots(item).includes(slot)) || CATALOGUE[old.itemId]?.shield && CATALOGUE[item.itemId]?.shield));
  return [...owned, ...issued];
}
export function equipmentAt(player, inventory, location) {
  return equippedItems(player, inventory).find(item => occupiedSlots(item).includes(location)) ?? null;
}
function clearIssuedSlots(player, inventory, slots, shield = false) {
  player.issuedWeapons ??= initialIssuedWeapons(player, inventory);
  for (const item of issuedEquipment(player, inventory)) if (occupiedSlots(item).some(slot => slots.includes(slot)) || shield && CATALOGUE[item.itemId].shield) player.issuedWeapons[item.location] = null;
}
export function equipIssuedWeapon(player, inventory, itemId, location = 'rightHand') {
  need(isIssuedWeapon(itemId), 'Arme de dotation inconnue.'); need(HAND_SLOTS.includes(location), 'Emplacement incompatible.');
  const item = { itemId, location }, slots = occupiedSlots(item), shield = CATALOGUE[itemId].shield;
  clearIssuedSlots(player, inventory, slots, shield);
  for (const old of inventory) if (old.playerId === player.id && (occupiedSlots(old).some(slot => slots.includes(slot)) || shield && CATALOGUE[old.itemId]?.shield)) old.playerId = null;
  player.issuedWeapons[location] = itemId;
}
export function removeIssuedWeapon(player, inventory, location) { clearIssuedSlots(player, inventory, [location]); }
export function equipMutable(inventory, id, playerId, location, player) {
  const item = inventory.find(item => item.id === id), definition = equipmentDefinition(item?.itemId);
  need(definition && definition.slot !== 'implant', 'Équipement inconnu.');
  const target = location ?? itemLocation(item); need(compatibleLocation(item.itemId, target), 'Emplacement incompatible.');
  if (playerId !== null && player) clearIssuedSlots(player, inventory, occupiedSlots(item, target), definition.shield);
  if (playerId !== null) for (const old of inventory) if (old.id !== id && old.playerId === playerId && (occupiedSlots(old).some(slot => occupiedSlots(item, target).includes(slot)) || definition.shield && CATALOGUE[old.itemId]?.shield)) old.playerId = null;
  item.playerId = playerId; if (definition.slot === 'weapon') item.location = target;
  return item;
}
export function previewEquipment(player, inventory, itemId, location) {
  const next = structuredClone(player), items = structuredClone(inventory ?? []);
  need(equipmentDefinition(itemId), 'Équipement inconnu.');
  if (CATALOGUE[itemId].slot === 'implant') next.implant = itemId;
  else if (isIssuedWeapon(itemId)) equipIssuedWeapon(next, items, itemId, location);
  else { let id = '__preview__'; while (items.some(item => item.id === id)) id += '_'; items.push({ id, itemId, playerId: null }); equipMutable(items, id, player.id, location, next); }
  return { player: next, inventory: items };
}
export function validEquipmentInventory(inventory, playerIds, players = []) {
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
  for (const p of players) if (p.issuedWeapons !== undefined) {
    if (!validIssuedWeapons(p.issuedWeapons)) return false;
    for (const item of issuedEquipment(p)) {
      for (const slot of occupiedSlots(item)) { const key = `${p.id}:${slot}`; if (occupied.has(key)) return false; occupied.add(key); }
      if (CATALOGUE[item.itemId].shield) { if (shields.has(p.id)) return false; shields.add(p.id); }
    }
  }
  return true;
}
