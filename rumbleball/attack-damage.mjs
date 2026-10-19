// Old frozen rosters omit count and retain their original single damage die.
export const damageDice = attack => attack.count ?? 1;
export const averageDamage = attack => damageDice(attack) * (attack.die + 1) / 2 + attack.flat;

// Probability of reaching a damage threshold on a normal hit, without RNG.
export function damageChance(attack, threshold) {
  if (damageDice(attack) === 1) return Math.max(0, Math.min(1, (attack.die + attack.flat - threshold + 1) / attack.die));
  let distribution = [1];
  for (let n = 0; n < damageDice(attack); n++) {
    const next = Array(distribution.length + attack.die).fill(0);
    for (let total = 0; total < distribution.length; total++) for (let face = 1; face <= attack.die; face++) next[total + face] += distribution[total] / attack.die;
    distribution = next;
  }
  return distribution.reduce((chance, weight, total) => chance + (total + attack.flat >= threshold ? weight : 0), 0);
}
