// Editorial playtest notes. These proposals never replace the published rules above them.
const playtestClassNotes = [
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
