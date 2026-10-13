// Editorial playtest notes. These proposals never replace the published rules above them.
const playtestClassNotes = [
  {
    panel: 'runner-base', ability: 'Faille', status: 'Décision retenue · à intégrer',
    paragraphs: [
      'En combat, une action bonus verrouille une cible visible à 18 m, sans jet et sans gagner de faille. À la fin du tour de cette cible, si vous la voyez toujours à portée, vous gagnez 1 faille, au plus une fois par round. Le plafond est de 1 faille aux niveaux 1–3, 2 aux niveaux 4–6, puis 3 à partir du niveau 7. Les failles sont personnelles, disparaissent à la fin du combat et ne se préparent pas avant celui-ci.',
      'Défenses à tester, cumulatives tant que les failles sont conservées : à 1 faille, +1 CA contre cette cible ; à 2, ses attaques d’opportunité contre vous ont le désavantage ; à 3, sa première attaque contre vous à chacun de ses tours a le désavantage. Une faille dépensée retire aussitôt le bénéfice du seuil perdu. La sauvegarde demandée à chaque tentative de vous cibler disparaîtrait.',
    ],
  },
  {
    panel: 'runner-base', ability: 'Opportuniste', status: 'Proposition à tester',
    paragraphs: ['Conserver la réaction avant de savoir si l’attaque touche, sans consommer de faille. Soustraire 1d6, 1d8 ou 1d10 au jet d’attaque ennemi selon que vous avez 1, 2 ou 3 failles sur lui. Le Fixeur choisit entre cette réaction et Semer le doute ; il ne peut pas utiliser les deux sur la même attaque.'],
  },
  {
    panel: 'runner-base', ability: 'Intouchable', status: 'Proposition à tester',
    paragraphs: ['À 1 faille, le bonus contre cette cible passerait à +2 CA ; à 2, elle ne pourrait plus effectuer d’attaque d’opportunité contre vous ; à 3, toutes ses attaques contre vous auraient le désavantage. Ces effets remplaceraient les sauvegardes répétées, l’interdiction de ciblage et la perte d’action.'],
  },
  {
    panel: 'runner-tueur', ability: 'Exploitation letale', status: 'Décision retenue · à intégrer',
    paragraphs: ['Une fois par tour, sur une touche d’arme contre la cible verrouillée, choisissez de consommer de 1 à 3 failles disponibles : l’attaque inflige +1d6 dégâts par faille consommée. Le plafond réel dépend de votre niveau. Dépensez les failles avant les dégâts ; les défenses liées au compteur diminuent immédiatement.'],
  },
  {
    panel: 'runner-tueur', ability: 'Predateur methodique', status: 'Décision retenue · à intégrer',
    paragraphs: ['Une fois pendant votre propre tour, une touche contre la cible verrouillée donne 1 faille avant le choix de dépense d’Exploitation létale. Le gain conditionnel de 2 failles serait supprimé. Une faille gagnée après le jet ne modifie pas rétroactivement ce jet d’attaque.'],
  },
  {
    panel: 'runner-tueur', ability: 'Mise a mort calculee', status: 'Proposition à tester',
    paragraphs: ['Retirer le bonus permanent d’Esprit à tous les jets d’attaque. Lorsqu’Exploitation létale consomme au moins 2 failles, ajouter une seule fois votre modificateur d’Esprit à ses dégâts supplémentaires.'],
  },
  {
    panel: 'runner-tueur', ability: 'Meurtre violent', status: 'Proposition à tester',
    paragraphs: ['Si une Exploitation létale consommant au moins 2 failles met la cible à 0 PV, verrouillez gratuitement un autre ennemi visible à 9 m de la victime et placez-y 1 faille, ou 2 si 3 failles ont été consommées. Aucun jet de sauvegarde de transfert. Résolvez ce transfert avant de retirer l’ancien compteur.'],
  },
  {
    panel: 'runner-tueur', ability: 'Carnage methodique', status: 'Proposition à tester',
    paragraphs: ['Exploitation létale passerait à +2d6 par faille consommée. Le transfert à toutes les cibles serait retiré ; le transfert du niveau 8 pourrait aussi s’appliquer à un KO sans exploitation, à partir des failles encore présentes avant le KO. Jamais deux transferts pour le même KO.'],
  },
  {
    panel: 'runner-fixeur', ability: 'Semer le doute', status: 'Décision retenue · à intégrer',
    paragraphs: ['Lorsqu’un ennemi visible rate une attaque, utilisez votre réaction pour lui ajouter 1 faille, même s’il n’est pas verrouillé. Vous pouvez garder des compteurs sur plusieurs ennemis ; votre verrouillage ne désigne que la cible qui gagne une faille par observation. La prochaine touche d’un allié sur un ennemi marqué consomme automatiquement toutes ses failles et ajoute +1d4 dégâts par faille, sans réaction ni action bonus supplémentaire.'],
  },
  {
    panel: 'runner-fixeur', ability: 'Ouvrez-le', status: 'Proposition à tester',
    paragraphs: ['L’avantage donné avant le jet ne fonctionne plus avec l’exploitation automatique après une touche. À la place, lorsqu’un allié consomme au moins 2 failles, la cible ne pourrait plus prendre de réaction jusqu’au début de son prochain tour. Les +1d4 dégâts par faille seraient conservés.'],
  },
  {
    panel: 'runner-fixeur', ability: 'Paranoia', status: 'Proposition à tester',
    paragraphs: ['Lorsqu’un allié consomme 3 failles, la cible ferait un seul jet de sauvegarde d’Esprit. Sur un échec, sa prochaine attaque avant la fin de son prochain tour devrait viser une autre créature désignée par le Fixeur, parmi les cibles légales à portée. Aucun déplacement ni attaque supplémentaire ne serait imposé. L’autre piste est de conserver une dépense active de 3 failles ; ce choix reste ouvert.'],
  },
  {
    panel: 'runner-fixeur', ability: 'Finissez-le', status: 'Proposition à tester',
    paragraphs: ['À partir du niveau 11, l’exploitation automatique de la touche alliée infligerait +1d8 par faille consommée au lieu de +1d4. Le supplément hérité de l’ancien Ouvrez-le à 6 failles serait retiré. Restent à fixer : portée de la réaction, portée de l’allié et exclusion du Fixeur de ses propres exploitations.'],
  },
  {
    panel: 'runner-hacker', ability: 'Breche assistee', status: 'Décision retenue · à intégrer',
    paragraphs: ['Sur une cible déjà verrouillée, une action bonus d’analyse donne 1 faille sans jet ni condition d’équipement technologique. Le verrouillage initial et cette analyse sont deux actions bonus distinctes. Les conditions technologiques pourraient rester utiles aux aptitudes d’intrusion hors combat.'],
  },
  {
    panel: 'runner-hacker', ability: 'Payload : Decharge neurale', status: 'Décision et précision à tester',
    paragraphs: ['La décharge devient une action infligeant 1d12 par faille consommée, avec sauvegarde d’Esprit pour moitié. Proposition : choisir librement de dépenser entre 1 faille et le compteur disponible, avant le jet de sauvegarde ; une réussite adverse ne rembourse aucune faille.'],
  },
  {
    panel: 'runner-hacker', ability: 'Payload : Parasite sensoriel', status: 'Proposition à tester',
    paragraphs: ['Coût fixe de 2 failles, en action, avec sauvegarde d’Esprit. Sur échec : pas de réaction et désavantage aux attaques ainsi qu’aux tests de Perception et de Techno jusqu’à la fin de votre prochain tour. Sur réussite : seule la réaction est perdue jusqu’à la fin du tour en cours. Aucun dégât de Décharge ajouté gratuitement.'],
  },
  {
    panel: 'runner-hacker', ability: 'Residu malveillant', status: 'Proposition à tester',
    paragraphs: ['Une fois pendant votre tour, après un Payload ayant consommé au moins 2 failles, regagnez 1 faille sur la même cible si elle est encore valide. Un Payload à 1 faille n’est pas remboursé ; le plafond normal reste applicable.'],
  },
  {
    panel: 'runner-hacker', ability: 'Payload : Explosion d’implant', status: 'Proposition à calibrer',
    paragraphs: ['Déclenchement envisagé : Décharge consommant 3 failles. Conserver les 3d12 dégâts principaux et ajouter une zone dont les dégâts restent à fixer. Si l’effet s’applique à toute cible, renommer l’aptitude ; la destruction d’un implant mémoire ne s’appliquerait que si la cible en porte un. Le rythme possible d’une décharge maximale à chaque tour impose un test des dégâts de zone.'],
  },
  {
    panel: 'gachette-akimbo', ability: 'Double recharge', status: 'Proposition à tester',
    paragraphs: ['Conserver la recharge de deux armes. Remplacer la seconde phrase, déjà couverte par la Posture mobile : une fois par tour, après avoir touché une créature à 3 m ou moins dans cette posture, vous pourriez vous déplacer de 1,50 m sans provoquer d’attaque d’opportunité de cette créature.'],
  },
  {
    panel: 'gachette-rafale', ability: 'Feu nourri', status: 'Proposition conditionnelle',
    paragraphs: ['Si le coût en munitions ne limite pas réellement le mode en partie, donner l’avantage seulement à la première attaque sous Feu nourri du tour ; elle seule consommerait le double de munitions. Définir dans le catalogue les armes compatibles. Tester la cadence de recharge avant de retenir cette réduction.'],
  },
  {
    panel: 'ferailleur-base', ability: 'Compagnon mecanique', status: 'Proposition conditionnelle',
    paragraphs: ['Si l’action autonome domine les rencontres de niveau 1, le compagnon pourrait se déplacer librement mais demander votre action bonus pour recevoir l’ordre d’effectuer une action ; sans ordre, il ne ferait que se déplacer et Esquiver. Au niveau 10, un ordre permettrait les deux actions de Surcharge contrôlée. À tester avec les statistiques de compagnon maintenant écrites.'],
  },
  {
    panel: 'ferailleur-base', ability: 'Liaison defensive', status: 'Proposition conditionnelle',
    paragraphs: ['Si l’avantage permanent à toutes les sauvegardes est trop fort, lorsqu’un de vous deux effectue une sauvegarde à 1,50 m de l’autre, vous pourriez utiliser votre réaction pour lui donner l’avantage. Nombre d’utilisations égal au bonus de maîtrise par repos court ou long.'],
  },
  {
    panel: 'ferailleur-k9', ability: 'Mobilite predatrice', status: 'Proposition à tester',
    paragraphs: ['Conserver l’escalade, la nage et le déplacement sans attaque d’opportunité. Après une morsure réussie, une fois par tour, la cible ferait une sauvegarde de Force contre un DD de 8 + bonus de maîtrise + modificateur de Force du K9 ; sur échec, elle tomberait à terre.'],
  },
  {
    panel: 'dopeur-scalpel', ability: 'Reserve operatoire', status: 'Proposition à tester',
    paragraphs: ['Autoriser le second dé de vie également lors d’un Soin sous pression réussi, si la cible possède au moins 2 dés de vie. L’Opération d’urgence conserverait ce bénéfice.'],
  },
];

const playtestShopNotes = {
  'kage-no-ha-6': ['Point à trancher', 'Les sources se contredisent sur le type de dégâts de cette lame : perforants ou tranchants. La fiche actuelle indique tranchants ; vérifier la version jouée avant de fixer le type.'],
  'siege-gl-2': ['Point à vérifier', 'La portée actuellement écrite est de 3 m. Vérifier cette valeur dans la source textuelle avant toute modification du profil.'],
  'jambes-de-course-raptor': ['Point à trancher', 'La charge cybernétique de ces jambes est encore à confirmer. La fiche actuelle affiche 2 ; comparer avec la source retenue et le coût de charge des autres implants de mobilité.'],
  'breacher-gl-1': ['Point à trancher', 'Préciser si le tir de grenade remplace l’attaque de l’action Attaquer ou s’il demande une action entière. Le texte actuel donne la recharge, mais pas ce coût de tir.'],
  'barabank-d-8': ['Point à trancher', 'Préciser si les quatre tirs supplémentaires sont ajoutés avant ou après les autres modifications de capacité du chargeur, en respectant toujours le maximum de douze tirs.'],
  'oreille-echolocatrice': ['Point à trancher', 'Préciser si la vision aveugle de 9 m permet de percevoir à travers une couverture solide. La fiche actuelle ne règle pas ce cas.'],
};

const playtestNote = (status, paragraphs) => {
  const note = document.createElement('aside');
  note.className = 'playtest-note';
  note.setAttribute('aria-label', status);
  const label = document.createElement('h4');
  label.className = 'playtest-note-label';
  label.textContent = status;
  note.append(label);
  for (const paragraph of paragraphs) {
    const text = document.createElement('p');
    text.textContent = paragraph;
    note.append(text);
  }
  return note;
};

window.playtestShopNotes = playtestShopNotes;
window.createPlaytestNote = playtestNote;

const normalizePlaytestTitle = (value) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const sectionsWithPlaytestNotes = new Set();
for (const entry of playtestClassNotes) {
  const panel = document.getElementById(entry.panel);
  const callout = [...(panel?.querySelectorAll('.level-block > .callout') || [])]
    .find((candidate) => normalizePlaytestTitle(candidate.querySelector(':scope > strong')?.textContent || '') === normalizePlaytestTitle(entry.ability));
  if (!callout) continue;
  callout.parentElement.classList.add('has-playtest-note');
  callout.insertAdjacentElement('afterend', playtestNote(entry.status, entry.paragraphs));
  sectionsWithPlaytestNotes.add(panel.closest('.page-section'));
}

for (const section of [...sectionsWithPlaytestNotes, document.getElementById('chroma-catalogue')]) {
  const lead = section?.querySelector(':scope > .section-heading');
  if (!lead) continue;
  const legend = document.createElement('p');
  legend.className = 'playtest-legend';
  legend.textContent = 'Notes en cyan et en italique : propositions à comparer en partie. Le texte normal reste la règle actuelle.';
  lead.insertAdjacentElement('afterend', legend);
}

const chroma = document.getElementById('chroma-catalogue');
const chromaLegend = chroma?.querySelector(':scope > .playtest-legend');
if (chromaLegend) chromaLegend.insertAdjacentElement('afterend', playtestNote('Point à trancher · modules d’arme', [
  'Définir combien de modules peuvent être installés sur une même arme et comment les incompatibilités se résolvent. Le catalogue précise déjà les compatibilités de chaque module, mais ne fixe pas de limite générale.',
]));
