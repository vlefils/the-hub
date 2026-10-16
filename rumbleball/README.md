# Rumbleball — prototype V1

Accessible dans **Outils → Rumbleball** (`#outils-rumbleball`). Deux équipes fixes, rôles et consignes avant le match, puis simulation automatique. Pas de recrutement, de progression ni de capacités spéciales.

## Essayer en local

Depuis la racine du dépôt, avec Node.js 22 ou plus récent :

```sh
node tools/serve.mjs
```

Ouvrir <http://127.0.0.1:8766/#outils-rumbleball>. Arrêter avec Ctrl+C. Le prototype utilise des modules JavaScript : il faut le servir en HTTP, ou l’ouvrir sur GitHub Pages, plutôt que directement en `file://`.

## Vérifier

```sh
node --test rumbleball/engine.test.mjs
```

Les tests couvrent les règles, les décisions, la reproduction pas à pas et 500 matchs. Le rapport donne victoires par équipe et stratégie, prolongations et actions choisies. Les tests utilisent uniquement les modules intégrés de Node.

## Organisation

- `data.mjs` : profils, rôles, consignes et terrain.
- `rules.mjs` : actions légales, jets, réactions, mouvements et invariants.
- `ai.mjs` : plan collectif et évaluation des décisions, sans modification des statistiques.
- `engine.mjs` : initialisation et orchestration, indépendantes de l’affichage.
- `ui.mjs` et `rumbleball.css` : préparation, terrain SVG, lecture et journal.
- `visuals.mjs` : écussons, marquages du terrain et pions SVG, indépendants des règles.
- `assets/arena-banner.webp` : illustration d’arène (154 Ko). Le [prompt de génération](assets/README.md) est conservé avec le visuel.

L’habillage reste limité à `#outils-rumbleball` et aux composants `rb-*`. Turquoise et orange identifient les équipes ; les pions ont également des formes différentes. Le jaune marque le ballon, la sélection et les réactions. Les PV des pions et le nombre de joueurs encore en jeu reprennent l’état de la simulation. La bannière se sépare du texte sur petit écran ; le journal passe sous le terrain. Les illustrations et marquages décoratifs sont ignorés par les lecteurs d’écran.

API du moteur : `createMatch(config)` retourne un état ; `stepMatch(state)` retourne `{ state, events }` sans modifier son entrée ; `simulateMatch(config, onTurn?)` retourne le même résultat en une seule exécution. La graine et l’état du générateur aléatoire font partie de l’état du match. L’interface conserve les événements séparément et sa vitesse ne consomme jamais d’aléatoire.

## Règles retenues

Source : `scenario/la-troisieme-mi-temps/04-match.md`. Les profils des Charognards sont transcrits dans les données pour que le jeu ne dépende pas du dossier de scénario à l’exécution. Les Recrues en sont des copies mécaniques. Retraits explicites : Capitaine, Pas de côté, Lecture de trajectoire et effet supplémentaire de Charge d’épaule. L’attaque du Frigo garde son +5 et son 1d8+3.

Une minute représente dix rounds. La possession en fin de round 10 gagne ; sinon deux rounds de prolongation, avec victoire au premier contrôle de fin de round. Si la balle reste libre, un dernier engagement d’un round conserve initiative, PV et KO ; il replace les joueurs et supprime les agrippements. Sans contrôle à la fin du round 13, match nul. Les KO seuls ne décident jamais du vainqueur.

Conventions du prototype :

- Grille 12 × 8, coordonnées depuis zéro ; zones humides x=3–4/y=1–2 et x=7–8/y=5–6. Déplacement et portée mesurés en cases, diagonales comprises. Une diagonale entre deux cases occupées est bloquée. Les joueurs actifs bloquent les cases, les KO non.
- Départ des Recrues en (1,1), (1,2), (1,3), (1,5), (1,6), adversaires par rotation de 180°. Balle tirée parmi les quatre cases centrales. Égalité complète d’initiative : tirage déterministe.
- Réactions renouvelées au début du round, jamais au début du tour individuel. Une réception, une interception ou une opportunité utilise la même ressource. Les relais et joueurs prudents peuvent réserver leur réaction lorsque leur équipe porte ; ils contestent toujours un porteur adverse quittant leur allonge.
- Une opportunité exige un pas volontaire allant d’une case adjacente à une case hors allonge. Entrer dans l’allonge ou rester adjacent (diagonales comprises) ne la provoque pas. L’attaque est résolue avant le pas : un KO peut empêcher toute sortie effective. Le journal conserve les cases du déclenchement ; les déplacements antérieurs sont publiés avant la réaction. Le terrain trace tous les tronçons du tour et marque en jaune le pas déclencheur, même interrompu.
- Ramassage à une case ou moins : interaction sans opposition adjacente à la balle ; sinon action contre le meilleur opposant adjacent. Un seul ramassage par tour. Porter n’interdit pas l’attaque de base à une main.
- Interception après un test de passe réussi : une seule tentative, par proximité à la trajectoire puis Acrobaties puis initiative. Une égalité laisse la passe suivre son cours. La trajectoire traverse les intérieurs des cases ; une simple tangence de coin n’ajoute pas de case.
- Plaquer et agripper : Lutte contre Athlétisme ou Acrobaties. Arracher : Lutte contre Lutte ou Acrobaties. Se libérer : Athlétisme ou Acrobaties contre Lutte. Les défenses choisissent leur meilleur bonus ; égalité au défenseur.
- Aider : avantage non cumulable à un prochain test d’un allié adjacent, ou à sa prochaine attaque contre une cible adjacente à l’aidant. Expiration au début du prochain tour de l’aidant. L’aide ne donne pas l’avantage aux sauvegardes de Constitution.
- Une sauvegarde de tenue n’inflige pas de dégâts supplémentaires. Sur KO, la balle tombe aux pieds, sans sauvegarde. Sinon, l’attaquant choisit la case adjacente libre la plus proche de lui, puis ordre y/x pour départager.
- À terre : attaques de contact reçues avec avantage, attaques effectuées avec désavantage, déplacement coûteux et relevé à moitié de la vitesse. Esquive : désavantage aux attaques reçues jusqu’au prochain tour, suspendu si agrippé.
- Agripper immobilise la cible. Le lutteur peut l’entraîner en maintenant leur position relative : chaque pas coûte le double, avec terrain difficile si l’un des deux traverse du sol humide. Les parois et obstacles sont vérifiés pour les deux joueurs ; aucun ne se déplace si le passage est bloqué. La cible est déplacée de force et ne provoque pas d’opportunité ; le lutteur reste exposé aux autres adversaires, mais pas à sa propre cible qui reste au contact.
- Une prise ne se termine que par libération réussie, relâchement volontaire gratuit, KO ou éloignement dû à un déplacement forcé. Après un agrippement réussi, le bot conserve sa position et la prise ; il ne dépense pas son mouvement restant pour se replacer. Aux tours suivants, un entraînement éventuel est évalué avec le coût et la position des deux joueurs.
- Aucun rebond, capacité spéciale, pouvoir, action préparée ou inventaire dans cette V1.

Les bots utilisent un score local explicable par rôle et une coordination recalculée à chaque tour. Ils n’effectuent pas de recherche tactique sur plusieurs tours ; la qualité compétitive et les stratégies de conservation restent à éprouver en jeu.
