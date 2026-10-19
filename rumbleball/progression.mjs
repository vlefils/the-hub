import { PROFILES, clone, modifier } from './data.mjs';
import { classCaps } from './classes.mjs';
import { MAX_LEVEL, XP_THRESHOLDS, levelOf, proficiencyBonus, effectiveAbilities, fatigueRecovery, ensurePlayerDevelopment, pendingAbilityLevels } from './player-development.mjs';
export { MAX_LEVEL, XP_THRESHOLDS, levelOf, proficiencyBonus, effectiveAbilities, fatigueRecovery };

export const MAX_SQUAD_SIZE = 10;
export const recruitmentPrice = (p) => 300 + 150 * (levelOf(p) - 1);
export const salary = (p) => 15 + 5 * (levelOf(p) - 1);
export const CATALOGUE = {
  vest: { name: 'Plastron léger', slot: 'protection', price: 100, effect: '+1 CA', armor: 1 },
  armor: { name: 'Armure renforcée', slot: 'protection', price: 150, effect: '+2 CA · −1,5 m', armor: 2, speed: -1.5 },
  gloves: { name: 'Gants de lutte', slot: 'protection', price: 150, effect: '+1 Lutte', wrestling: 1 },
  soles: { name: 'Semelles adhérentes', slot: 'protection', price: 150, effect: '+1 Acrobaties', acrobatics: 1 },
  legs: { name: 'Jambes augmentées', slot: 'implant', price: 300, effect: '+1,5 m', speed: 1.5 },
  fibers: { name: 'Fibres contractiles', slot: 'implant', price: 300, effect: '+1 Lutte', wrestling: 1 },
  interface: { name: 'Interface visuomotrice', slot: 'implant', price: 300, effect: '+1 Acrobaties', acrobatics: 1 },
  regulator: { name: 'Régulateur d’effort', slot: 'implant', price: 300, effect: 'Participation : +1 fatigue au lieu de +2 ; KO : +1 conservé' },
};

// Always start from immutable base data; never recompile an already modified profile.
export function compilePlayer(player, inventory = []) {
  const base = clone(PROFILES[player.profile]);
  if (!base) throw new Error('Profil de joueur inconnu.');
  const level = levelOf(player), tiers = Number(level >= 3) + Number(level >= 5), abilities = effectiveAbilities(player), mastery = proficiencyBonus(level);
  const result = { ...base, name: player.name, playerId: player.id, level, ...(player.portraitId ? { portraitId: player.portraitId } : {}),
    role: player.role, instruction: player.instruction, fatigue: player.fatigue, abilities, proficiencyBonus: mastery, recovery: fatigueRecovery(player), pendingAbilityIncreases: pendingAbilityLevels(player).length };
  const brute = base.archetype === 'belier', constitution = modifier(abilities.constitution), attackStat = modifier(abilities[brute ? 'strength' : 'dexterity']);
  result.maxHp = Math.max(1, (brute ? 12 : 8) + (level - 1) * (brute ? 7 : 5) + level * constitution);
  result.armor = 10 + modifier(abilities.dexterity);
  result.attack = { ...base.attack, bonus: attackStat + mastery, flat: attackStat };
  result.chargeDC = 8 + mastery + modifier(abilities.strength);
  result.skills = {};
  for (const key of ['wrestling', 'athletics', 'acrobatics']) {
    result.skills[key] = modifier(abilities[key === 'acrobatics' ? 'dexterity' : 'strength']) + (Object.hasOwn(base.skills, key) ? mastery : 0);
  }
  result.trainedSkills = Object.keys(base.skills);
  if (base.archetype === 'escamoteur') result.speed += 1.5 * tiers;
  const protection = inventory.find((item) => item.playerId === player.id);
  result.visualGear = { protection: protection?.itemId ?? null, implant: player.implant ?? null };
  for (const id of [protection?.itemId, player.implant]) {
    const item = CATALOGUE[id];
    if (!item) continue;
    for (const key of ['maxHp', 'armor', 'speed']) result[key] += item[key] ?? 0;
    for (const key of ['wrestling', 'acrobatics']) result.skills[key] += item[key] ?? 0;
  }
  if (player.fatigue >= 3) result.speed -= 1.5;
  if (player.fatigue >= 5) for (const key of ['wrestling', 'athletics', 'acrobatics']) result.skills[key]--;
  result.caps = classCaps(result);
  return result;
}

export function progressPlayer(player, starter, ko = false) {
  ensurePlayerDevelopment(player);
  const beforeLevel = levelOf(player), beforeFatigue = player.fatigue;
  player.xp += starter ? 10 : 4;
  player.fatigue = starter ? Math.min(6, player.fatigue + (player.implant === 'regulator' ? 1 : 2) + Number(ko)) : Math.max(0, player.fatigue - fatigueRecovery(player));
  return { playerId: player.id, name: player.name, xp: starter ? 10 : 4, beforeLevel, level: levelOf(player), beforeFatigue, fatigue: player.fatigue, ko };
}
