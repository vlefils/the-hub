import { PROFILES, modifier } from './data.mjs';

export const MAX_LEVEL = 12;
export const XP_THRESHOLDS = Array.from({ length: MAX_LEVEL }, (_, i) => 5 * i * (i + 3));
export const ABILITY_LEVELS = [3, 6, 9, 12];
export const ABILITY_LABELS = { strength: 'Force', dexterity: 'Dextérité', constitution: 'Constitution', mind: 'Esprit', charisma: 'Charisme' };
export const ABILITY_PRIORITIES = {
  belier: ['strength', 'constitution', 'dexterity', 'charisma', 'mind'],
  escamoteur: ['dexterity', 'mind', 'constitution', 'charisma', 'strength'],
  capitaine: ['charisma', 'mind', 'dexterity', 'constitution', 'strength'],
  passeur: ['dexterity', 'mind', 'constitution', 'strength', 'charisma'],
};
export const levelOf = player => Math.max(1, XP_THRESHOLDS.filter(xp => player.xp >= xp).length);
export const proficiencyBonus = level => 2 + Math.floor((Math.max(1, Math.min(MAX_LEVEL, level)) - 1) / 3);
const priority = player => ABILITY_PRIORITIES[PROFILES[player.profile]?.archetype] ?? ABILITY_PRIORITIES.capitaine;
function seededRandom(seed) {
  let state = 2166136261;
  for (const char of String(seed)) state = Math.imul(state ^ char.charCodeAt(0), 16777619) >>> 0;
  return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
}

export function rollAbilities(seed, profile) {
  const random = seededRandom(`${seed}:abilities`); let values;
  // Rejection sampling gives every bounded five-score allocation equal chance.
  do { values = Array.from({ length: 4 }, () => 8 + Math.floor(random() * 8)); values.push(59 - values.reduce((sum, n) => sum + n, 0)); } while (values[4] < 8 || values[4] > 15);
  values.sort((a, b) => b - a);
  return Object.fromEntries(priority({ profile }).map((key, i) => [key, values[i]]));
}

export function ensurePlayerDevelopment(player, seed = player.id) {
  player.abilities ??= rollAbilities(seed, player.profile);
  player.advancements ??= [];
  return player;
}
export function effectiveAbilities(player) {
  const scores = { ...(player.abilities ?? rollAbilities(player.id, player.profile)) };
  for (const gain of player.advancements ?? []) for (const [key, amount] of Object.entries(gain.changes)) scores[key] += amount;
  return scores;
}
export const pendingAbilityLevels = player => ABILITY_LEVELS.filter(level => level <= levelOf(player) && !(player.advancements ?? []).some(gain => gain.level === level));
export const fatigueRecovery = player => Math.max(1, 3 + modifier(effectiveAbilities(player).constitution));

export function abilityIncreaseError(player, changes) {
  if (!pendingAbilityLevels(player).length) return 'Aucune amélioration de caractéristiques disponible.';
  if (!changes || typeof changes !== 'object' || Array.isArray(changes)) return 'Choisissez deux points de caractéristiques.';
  const entries = Object.entries(changes), scores = effectiveAbilities(player);
  if (!entries.length || entries.length > 2 || entries.some(([key, amount]) => !Object.hasOwn(ABILITY_LABELS, key) || !Number.isInteger(amount) || amount < 1 || amount > 2) || entries.reduce((sum, [, amount]) => sum + amount, 0) !== 2) return 'Répartissez deux +1 ou un +2.';
  if (entries.some(([key, amount]) => scores[key] + amount > 20)) return 'Une caractéristique ne peut pas dépasser 20.';
  return '';
}
export function applyAbilityIncrease(player, changes) {
  const error = abilityIncreaseError(player, changes); if (error) throw new Error(error);
  ensurePlayerDevelopment(player);
  player.advancements.push({ level: pendingAbilityLevels(player)[0], changes: { ...changes } });
  return player;
}
export function automaticAbilityIncreases(player) {
  ensurePlayerDevelopment(player);
  while (pendingAbilityLevels(player).length) {
    const scores = effectiveAbilities(player), changes = {};
    for (let i = 0; i < 2; i++) {
      const key = priority(player).find(key => scores[key] + (changes[key] ?? 0) < 20);
      if (!key) return player;
      changes[key] = (changes[key] ?? 0) + 1;
    }
    applyAbilityIncrease(player, changes);
  }
  return player;
}
export function ensureClubDevelopment(club, namespace, market = club.market ?? []) {
  for (const player of [...club.players, ...market]) ensurePlayerDevelopment(player, `${namespace}:${player.id}`);
  return club;
}
export function ensureCareerDevelopment(career) {
  for (const [index, club] of career.clubs.entries()) {
    ensureClubDevelopment(club, `${career.seed ?? 'league'}:${club.id}`, index ? [] : career.market);
    if (index) for (const player of club.players) automaticAbilityIncreases(player);
  }
  return career;
}

export function validPlayerDevelopment(player) {
  if (player.abilities === undefined && player.advancements === undefined) return true;
  if (!player.abilities || typeof player.abilities !== 'object' || Array.isArray(player.abilities) || Object.keys(player.abilities).length !== 5 || !Object.keys(ABILITY_LABELS).every(key => Number.isInteger(player.abilities[key]) && player.abilities[key] >= 8 && player.abilities[key] <= 15) || Object.values(player.abilities).reduce((sum, n) => sum + n, 0) !== 59 || !Array.isArray(player.advancements) || player.advancements.length > ABILITY_LEVELS.length) return false;
  const copy = { ...player, advancements: [] };
  for (const [index, gain] of player.advancements.entries()) {
    if (!gain || gain.level !== ABILITY_LEVELS[index] || abilityIncreaseError(copy, gain.changes)) return false;
    copy.advancements.push(gain);
  }
  return true;
}
