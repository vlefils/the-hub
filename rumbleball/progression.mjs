import { PROFILES, clone, modifier } from './data.mjs';
import { classCaps } from './classes.mjs';
import { MAX_LEVEL, XP_THRESHOLDS, levelOf, proficiencyBonus, effectiveAbilities, fatigueRecovery, ensurePlayerDevelopment, pendingAbilityLevels } from './player-development.mjs';
import { CATALOGUE, equippedItems, itemLocation } from './equipment.mjs';
export { MAX_LEVEL, XP_THRESHOLDS, levelOf, proficiencyBonus, effectiveAbilities, fatigueRecovery, CATALOGUE };

export const MAX_SQUAD_SIZE = 10;
export const recruitmentPrice = (p) => 300 + 150 * (levelOf(p) - 1);
export const salary = (p) => 15 + 5 * (levelOf(p) - 1);

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
  const worn = equippedItems(player, inventory), protection = worn.find(item => CATALOGUE[item.itemId]?.slot === 'protection');
  result.visualGear = { protection: protection?.itemId ?? null, implant: player.implant ?? null,
    ...Object.fromEntries(['head', 'torso', 'gloves', 'feet', 'rightHand', 'leftHand'].map(location => [location, worn.find(item => itemLocation(item) === location || CATALOGUE[item.itemId]?.hands === 2 && ['rightHand', 'leftHand'].includes(location))?.itemId ?? null])) };
  for (const id of [...worn.map(item => item.itemId), player.implant]) {
    const item = CATALOGUE[id];
    if (!item) continue;
    for (const key of ['maxHp', 'armor', 'speed']) result[key] += item[key] ?? 0;
    for (const key of ['wrestling', 'acrobatics']) result.skills[key] += item[key] ?? 0;
  }
  const weapons = worn.filter(item => CATALOGUE[item.itemId]?.die), main = weapons.find(item => itemLocation(item) === 'rightHand') ?? weapons[0], secondary = weapons.find(item => item !== main);
  result.offhandAttack = null;
  if (main) {
    const weapon = CATALOGUE[main.itemId], attackMod = modifier(weapon.finesse ? Math.max(abilities.strength, abilities.dexterity) : abilities.strength);
    const other = worn.find(item => CATALOGUE[item.itemId]?.slot === 'weapon' && item !== main);
    result.attack = { bonus: attackMod + mastery + (weapon.enhancement ?? 0), die: weapon.versatile && !other ? weapon.versatile : weapon.die, ...(weapon.count ? { count: weapon.count } : {}), flat: attackMod + (weapon.enhancement ?? 0) };
    result.weapon = { id: main.itemId, name: weapon.name, location: itemLocation(main) };
    if (secondary && weapon.light && CATALOGUE[secondary.itemId].light) {
      const off = CATALOGUE[secondary.itemId], mod = modifier(off.finesse ? Math.max(abilities.strength, abilities.dexterity) : abilities.strength);
      result.offhandAttack = { bonus: mod + mastery + (off.enhancement ?? 0), die: off.die, flat: Math.min(0, mod) + (off.enhancement ?? 0) };
    }
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
