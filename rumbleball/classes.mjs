// Sporting adaptations of The Hub classes; level changes reserves, never technique costs.
export const ARCHETYPES = {
  belier: { className: 'Brute', name: 'Bélier d’arène',
    description: 'Encaisse les chocs et ouvre un passage au contact.',
    abilities: [
      ['Dur au mal', '6 Adrénaline par match. Absorbe jusqu’à 3 dégâts par impact, avant le test de tenue de balle.'],
      ['Percussion', '2 Adrénaline, dans l’action Attaquer. Après deux pas consécutifs en ligne droite (3 m), une touche impose un JS FOR DD 13 : sur échec, la cible recule d’une case.'],
    ] },
  escamoteur: { className: 'Runner', name: 'Escamoteur',
    description: 'Observe un adversaire puis exploite son ouverture pour récupérer la balle ou se dégager.',
    abilities: [
      ['Lecture de cible', 'Action bonus, ennemi à 9 m. Gagne une faille à la fin du tour observé, au plus une par round et une en réserve. Conserver la faille donne +1 CA contre cette cible. Changer de cible efface la faille.'],
      ['Exploitation sportive', 'Dépense sa faille pour avoir l’avantage à un arrachement contre sa cible, ou pour éviter ses seules opportunités jusqu’à la fin de son tour. Aucun coût d’action supplémentaire.'],
    ] },
  capitaine: { className: 'Runner', name: 'Capitaine',
    description: 'Variante du Fixeur : prépare les arrachements, les prises et les passes de ses équipiers.',
    abilities: [
      ['Ouverture collective', 'Même lecture de cible que l’Escamoteur. Un allié consomme automatiquement la faille pour avoir l’avantage à un arrachement, agrippement ou plaquage contre cette cible, si le capitaine la voit à 9 m. Dépensée même en cas d’échec ; les avantages ne se cumulent pas.'],
      ['Appel de jeu', 'Action bonus, autre allié à 9 m, 2 appels par match. Avantage à sa prochaine passe avant le début du prochain tour du capitaine. Un seul appel en attente par allié.'],
    ] },
  passeur: { className: 'Gâchette', name: 'Passeur de précision',
    description: 'Fiabilise les passes difficiles et les interceptions décisives.',
    abilities: [
      ['Passe ajustée', 'Avantage au jet de passe, dans l’action Passer. Partage 2 points de concentration par match avec Lecture de trajectoire.'],
      ['Lecture de trajectoire', 'Avantage à une interception, avec la réaction habituelle et 1 concentration. Recevoir, intercepter et frapper en opportunité partagent toujours la même réaction.'],
    ] },
};

export const isRunner = (p) => ['escamoteur', 'capitaine'].includes(p.archetype);
export const archetypeLabel = (p) => ARCHETYPES[p.archetype]
  ? `${ARCHETYPES[p.archetype].className} · ${ARCHETYPES[p.archetype].name}` : 'Sans classe';
export function classCaps(p) {
  const tiers = Number((p.level ?? 1) >= 3) + Number((p.level ?? 1) >= 5);
  return { adrenaline: p.archetype === 'belier' ? 6 + 2 * tiers : 0,
    focus: p.archetype === 'passeur' ? 2 + tiers : 0,
    calls: p.archetype === 'capitaine' ? 2 + tiers : 0, flaw: isRunner(p) ? 1 : 0 };
}
export function classAbilities(p) {
  const caps = classCaps(p);
  return (ARCHETYPES[p.archetype]?.abilities ?? []).map(([name, description]) => [name, description
    .replace('6 Adrénaline', `${caps.adrenaline} Adrénaline`)
    .replace('2 appels par match', `${caps.calls} appels par match`)
    .replace('2 points de concentration', `${caps.focus} points de concentration`)]);
}
export function initialClassState(archetype, level = 1) {
  const { flaw, ...resources } = classCaps({ archetype, level });
  return { ...resources, targetId: null, flaw: 0, observedRound: 0 };
}
export function classResources(p, players = []) {
  const r = p.classState;
  if (!r) return '';
  const caps = classCaps(p);
  if (p.archetype === 'belier') return `Adrénaline ${r.adrenaline}/${caps.adrenaline}`;
  if (p.archetype === 'passeur') return `Concentration ${r.focus}/${caps.focus}`;
  if (isRunner(p)) {
    const target = players.find((q) => q.id === r.targetId);
    return [`Faille ${r.flaw}/1${target ? ` sur ${target.name}` : ' · aucune cible'}`,
      p.archetype === 'capitaine' ? `Appels ${r.calls}/${caps.calls}` : ''].filter(Boolean).join(' · ');
  }
  return '';
}
