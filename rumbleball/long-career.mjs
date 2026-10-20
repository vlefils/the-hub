import { PROFILES } from './data.mjs';
import { XP_THRESHOLDS, ensurePlayerDevelopment, automaticAbilityIncreases } from './player-development.mjs';
import { identifyClub, cosmeticHash } from './identity.mjs';
import { KIT_COLORS } from './appearance.mjs';
import { openingDeployment } from './openings.mjs';
import { CATALOGUE, equipMutable, ensureClubEquipment } from './equipment.mjs';
import { DIVISIONS, injured, injuryChance, isLongCareer } from './career-rules.mjs';

const CLUB_NAMES = [
  ['Les Charognards', 'Les Brise-Chrome', 'Les Voltigeurs', 'Circuit Ouvert', 'Les Crocs Néon'],
  ['Les Chiens de cuivre', 'Les Sans-Signal', 'Les Marteaux noirs', 'Les Veilleurs', 'Les Échos rouges'],
  ['Chrome Union', 'Les Spectres', 'Les Ferrailleurs', 'Les Affranchis', 'Secteur Neuf'],
  ['Les Gardiens du Flux', 'Les Dissidents', 'Les Revenants', 'Les Cœurs de cobalt', 'Les Ombres du Rail'],
  ['Les Titans Helix', 'Les Sentinelles', 'Les Phalanges Zero', 'Les Héritiers du Chrome', 'Les Cerbères'],
  ['Les Monarques Néon', 'Les Archontes', 'Les Immortels', 'Les Souverains Null', 'Singularité Prime'],
];
const ranged = (seed, [min, max]) => min + cosmeticHash(seed) % (max - min + 1);
export const longRecruitLevel = (career, id) => ranged(`${career.seed}:recruit:${id}`, DIVISIONS[career.longCareer.division - 1].recruitLevels);
function equipmentFor(club, p, tier) {
  const type = PROFILES[p.profile].archetype, suffix = tier === 5 ? 'singularite' : 'prototype';
  const fixed = tier >= 4 ? [`helmet_${suffix}`, `armor_${suffix}`, `gloves_${suffix}`, `boots_${suffix}`, `regulator_${suffix}`]
    : tier === 3 ? ['bastion_helmet', 'bulwark_armor', 'grapple_gloves', 'ghost_boots', type === 'belier' ? 'kinetic_implant' : 'reflex_implant']
    : tier === 2 ? ['optic_visor', 'mesh_armor', 'grapple_gloves', 'ghost_boots', 'regulator']
    : tier === 1 ? ['helmet', 'vest', 'gloves', 'soles', 'regulator'] : [];
  const weapon = tier >= 4 ? `${type === 'belier' ? 'maul' : 'tonfa'}_${suffix}`
    : tier >= 2 ? type === 'belier' ? 'gravity_maul' : tier === 3 ? 'ghost_baton' : 'arc_tonfa'
    : type === 'belier' ? 'maul' : 'tonfa';
  const add = (itemId, location) => {
    if (CATALOGUE[itemId].slot === 'implant') { p.implant = itemId; return; }
    const id = `${p.id}-gear-${club.inventory.length}`;
    club.inventory.push({ id, itemId, playerId: null }); equipMutable(club.inventory, id, p.id, location);
  };
  for (const itemId of fixed) add(itemId);
  add(weapon, 'rightHand');
  if (type !== 'belier') add(tier >= 4 ? `shield_${suffix}` : tier >= 2 ? 'aegis_shield' : 'shield', 'leftHand');
}
// Stable templates: rebuilding after an offseason retains every identity/stat/item.
// Inactive divisions never run match simulations or accumulate progression.
export function createLongOpponents(seed, division) {
  const rules = DIVISIONS[division - 1];
  return CLUB_NAMES[division - 1].map((name, index) => {
    const opening = ['breakaway', 'cage', 'wings', 'fallback', 'press'][index];
    const club = { id: `long-${division}-${index}`, name, kitColor: KIT_COLORS[index + 1], style: `Ligue ${division} · effectif fixe`,
      strategy: ['balanced', 'pressing', 'balanced', 'possession', 'pressing'][index], opening, deployment: openingDeployment(opening), players: [], inventory: [] };
    club.players = Array.from({ length: 10 }, (_, number) => {
      const id = `${club.id}-p${number}`, profile = (number + index) % PROFILES.length;
      const p = ensurePlayerDevelopment({ id, name: '', profile, xp: XP_THRESHOLDS[ranged(`${seed}:${id}:level`, rules.botLevels) - 1], fatigue: 0, injuryMatches: 0,
        role: PROFILES[profile].role, instruction: index === 1 ? 'aggressive' : 'normal', implant: null }, `${seed}:${id}`);
      automaticAbilityIncreases(p); equipmentFor(club, p, ranged(`${seed}:${id}:gear`, rules.gear)); return p;
    });
    return ensureClubEquipment(identifyClub(club, `${seed}:${club.id}`));
  });
}
export function applyInjury(career, player, fixtureId, fatigue) {
  const chance = injuryChance(fatigue), key = `${career.seed}:${fixtureId}:${player.id}:injury`;
  if (cosmeticHash(key) / 4294967296 >= chance) return 0;
  player.injuryMatches = 1 + cosmeticHash(`${key}:duration`) % 4;
  return player.injuryMatches;
}
export const availablePlayers = club => club.players.filter(p => !injured(p));
export function repairLongLineup(career) {
  if (!isLongCareer(career) || career.status !== 'active') return;
  const available = availablePlayers(career.clubs[0]), ids = new Set(available.map(p => p.id));
  const lineup = career.lineup.filter(id => ids.has(id));
  for (const p of available) if (lineup.length < 5 && !lineup.includes(p.id)) lineup.push(p.id);
  // Unavailable placeholders remain visible when the club must forfeit.
  for (const p of career.clubs[0].players) if (lineup.length < 5 && !lineup.includes(p.id)) lineup.push(p.id);
  career.lineup = lineup;
}
export function longSeasonOutcome(career) {
  const division = career.longCareer.division, final = career.playoffs?.rounds.at(-1).matches[0];
  const rank = career.table.findIndex(row => row.clubId === 'club') + 1;
  const promoted = Boolean(final && [final.homeId, final.awayId].includes('club'));
  const nextDivision = promoted ? Math.min(6, division + 1) : rank >= 5 ? Math.max(1, division - 1) : division;
  return { division, nextDivision, movement: nextDivision > division ? 'promotion' : nextDivision < division ? 'relegation' : 'stay', finalists: final ? [final.homeId, final.awayId].filter(Boolean) : [] };
}
