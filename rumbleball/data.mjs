// Profiles from La Troisième Mi-Temps, with dedicated sporting archetypes.
export const ROLES = {
  carrier: 'Porteur', blocker: 'Bloqueur', retriever: 'Récupérateur',
  relay: 'Relais', defender: 'Défenseur',
};
export const INSTRUCTIONS = { normal: 'Normal', cautious: 'Prudent', aggressive: 'Agressif' };
export const STRATEGIES = { balanced: 'Équilibrée', possession: 'Conservation', pressing: 'Pressing' };
export const ROLE_DESCRIPTIONS = {
  carrier: 'Prend et sécurise la balle ; offre un relais si un équipier porte.',
  blocker: 'Ferme les accès et immobilise les adversaires menaçants.',
  retriever: 'Conteste la balle libre et privilégie les arrachements.',
  relay: 'Se démarque quand une passe est préparée et garde sa réaction pour la relancer.',
  defender: 'Marque les adversaires dangereux et coupe les lignes de passe.',
};
// Class movement is shared by new players. Legacy profiles remain frozen below
// so recorded matches can still be reconstructed under their original rules.
export const CLASS_SPEEDS = Object.freeze({ belier: 9, capitaine: 9, escamoteur: 12, passeur: 9 });
export const PROFILES = [
  { name: 'Suze « Clou »', trainingName: 'Nora', archetype: 'capitaine', role: 'relay', armor: 14, maxHp: 23, speed: 9,
    abilities: { strength: 12, dexterity: 14, constitution: 14, mind: 13, charisma: 14 },
    skills: { acrobatics: 4, wrestling: 3 }, attack: { bonus: 4, die: 6, flat: 2 } },
  { name: 'Le Frigo', trainingName: 'Brique', archetype: 'belier', role: 'blocker', armor: 15, maxHp: 29, speed: 7.5,
    abilities: { strength: 17, dexterity: 10, constitution: 15, mind: 9, charisma: 10 },
    skills: { athletics: 5, wrestling: 5 }, attack: { bonus: 5, die: 8, flat: 3 } },
  { name: 'Miette', trainingName: 'Zip', archetype: 'escamoteur', role: 'carrier', armor: 13, maxHp: 17, speed: 12,
    abilities: { strength: 9, dexterity: 17, constitution: 12, mind: 12, charisma: 13 },
    skills: { acrobatics: 5 }, attack: { bonus: 5, die: 6, flat: 3 } },
  { name: 'Raf « Double Tour »', trainingName: 'Étau', archetype: 'belier', role: 'retriever', armor: 14, maxHp: 24, speed: 9,
    abilities: { strength: 15, dexterity: 13, constitution: 14, mind: 10, charisma: 11 },
    skills: { wrestling: 4, athletics: 4 }, attack: { bonus: 4, die: 6, flat: 2 } },
  { name: 'Pépé 404', trainingName: 'Vigie', archetype: 'passeur', role: 'defender', armor: 13, maxHp: 20, speed: 9,
    abilities: { strength: 11, dexterity: 14, constitution: 12, mind: 15, charisma: 13 },
    skills: { acrobatics: 4 }, attack: { bonus: 4, die: 6, flat: 2 } },
];
export const COURT = { width: 12, height: 8, cell: 1.5 };
export const WET_CELLS = [[3, 1], [4, 1], [3, 2], [4, 2], [7, 5], [8, 5], [7, 6], [8, 6]];
export const STARTS = [[1, 1], [1, 2], [1, 3], [1, 5], [1, 6]];
export const modifier = (score) => Math.floor((score - 10) / 2);
export const clone = (value) => structuredClone(value);
