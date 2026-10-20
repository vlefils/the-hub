// Explicit policies keep long-career mechanics out of classic and online games.
export const LONG_RULES = 'long-v1';
export const isLongCareer = career => career?.mode === 'long';
export const fatigueLimit = career => isLongCareer(career) ? 10 : 6;
export const injured = player => (player?.injuryMatches ?? 0) > 0;
export const injuryChance = fatigue => (20 + 18 * Math.max(0, Math.min(10, fatigue))) / 1000;
export const DIVISIONS = Object.freeze([
  { level: 1, name: 'Bas-fonds', botLevels: [1, 2], recruitLevels: [1, 2], gear: [0, 1], victory: 350 },
  { level: 2, name: 'Circuit de rue', botLevels: [3, 4], recruitLevels: [2, 4], gear: [1, 2], victory: 600 },
  { level: 3, name: 'District Chrome', botLevels: [5, 6], recruitLevels: [4, 6], gear: [2, 3], victory: 900 },
  { level: 4, name: 'Néon majeur', botLevels: [7, 8], recruitLevels: [6, 8], gear: [3, 4], victory: 1300 },
  { level: 5, name: 'Circuit des Corporations', botLevels: [9, 10], recruitLevels: [8, 10], gear: [4, 5], victory: 1800 },
  { level: 6, name: 'Ligue Singularité', botLevels: [12, 12], recruitLevels: [10, 12], gear: [5, 5], victory: 2400 },
]);
export const divisionOf = career => DIVISIONS[(career?.longCareer?.division ?? 1) - 1];
export function matchReward(career, winnerId, kind = 'played') {
  if (kind === 'double-forfeit' || kind === 'forfeit' && winnerId !== 'home') return 0;
  return winnerId === 'home' ? isLongCareer(career) ? divisionOf(career).victory : 350 : winnerId === 'away' ? 200 : 275;
}
export const fatigueDisadvantage = (state, player) => state?.careerRules === LONG_RULES && player?.fatigue >= 10;
export const fatigueEffect = (value, long = false) => [value >= 3 && 'Vitesse −1,5 m', value >= 5 && 'Compétences physiques −1', long && value >= 8 && 'Attaques −1', long && value >= 10 && 'Désavantage à tous les jets de d20'].filter(Boolean).join(' · ') || 'Aucun malus';
