// Cosmetic identity has its own hash and never consumes the match RNG.
export const KIT_COLORS = ['#79decb', '#f4a070', '#b8a0e8', '#76b9ed', '#e4cc6d', '#e789ab'];
export const SKIN_COLORS = ['#f2c7a5', '#dca27c', '#bb805b', '#975e40', '#704630', '#493025'];
export const HAIR_COLORS = ['#242525', '#513628', '#815032', '#cc9b4c', '#b5b2a6', '#b95f42', '#597b82', '#9d577e'];
export const HAIR_STYLES = ['crop', 'sweep', 'mohawk', 'bald', 'bun', 'braids'];
export const validKitColor = (color) => typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color);
export const clubKit = (club, index = 0) => validKitColor(club?.kitColor) ? club.kitColor : KIT_COLORS[index % KIT_COLORS.length];
const rgb = (color) => [1, 3, 5].map((index) => parseInt(color.slice(index, index + 2), 16));
const colorDistance = (a, b) => Math.hypot(...rgb(a).map((n, i) => n - rgb(b)[i]));
export function matchKits(home = KIT_COLORS[0], away = KIT_COLORS[1]) {
  home = validKitColor(home) ? home : KIT_COLORS[0]; away = validKitColor(away) ? away : KIT_COLORS[1];
  if (colorDistance(home, away) < 115) away = [...KIT_COLORS].sort((a, b) => colorDistance(home, b) - colorDistance(home, a))[0];
  return { home, away };
}
export function readableKit(color) {
  return `#${rgb(validKitColor(color) ? color : KIT_COLORS[0]).map((n) => Math.max(140, n).toString(16).padStart(2, '0')).join('')}`;
}
export function playerLook(player) {
  let hash = 2166136261;
  for (const char of String(player.playerId ?? player.id ?? player.name)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  return { skin: SKIN_COLORS[hash % SKIN_COLORS.length], hair: HAIR_COLORS[(hash >>> 5) % HAIR_COLORS.length],
    hairStyle: HAIR_STYLES[(hash >>> 12) % HAIR_STYLES.length] };
}
export function visibleGear(player) {
  return { protection: player.visualGear?.protection ?? null, implant: player.visualGear?.implant ?? null };
}
export function sportingWeapon(player) {
  if (player.archetype === 'belier' && player.attack?.die >= 8) return { id: 'maul', name: 'Massue d’arène' };
  if (player.archetype === 'escamoteur') return { id: 'tonfa', name: 'Tonfa d’arène' };
  return { id: 'baton', name: 'Matraque d’arène' };
}
export const characterKey = (player, color) => JSON.stringify([playerLook(player), visibleGear(player), sportingWeapon(player).id, player.archetype, color, player.teamId, player.number]);
