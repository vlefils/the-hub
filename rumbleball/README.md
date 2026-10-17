# Rumbleball Manager — carrière V1 et exhibition

Accessible dans **Outils → Rumbleball** (`#outils-rumbleball`). Une carrière locale permet de recruter, composer cinq titulaires, acheter des protections et implants et disputer une ligue de six clubs. Le mode **Exhibition** conserve les équipes préfaites et reste indépendant de la carrière. Aucun soin, remplacement ou retour en jeu après un KO pendant une rencontre.

## Carrière

Fonder un club donne 2 400 chromas. Choisir cinq à huit des douze candidats, puis valider les contrats en une fois. Les vues **Effectif**, **Recrutement**, **Équipement** et **Ligue** donnent accès à la composition, aux consignes, aux achats et au calendrier. Composition et consignes sont enregistrées automatiquement ; choisir un titulaire déjà présent échange les deux positions. Les cinq adversaires disposent de sept joueurs fixes, progressent et font tourner leurs titulaires en fonction de leur fatigue ; aucune adaptation à la puissance du club.

Dix journées aller-retour par saison. Les salaires de tout l’effectif sont prélevés une seule fois au lancement, même si le solde devient négatif. Seuls les salaires permettent le découvert : les achats restent bloqués jusqu’au remboursement par primes ou ventes. Prime de match : défaite 200, nul 275, victoire 350 ; classement : 600 / 400 / 200 / 100 / 100 / 100. La nouvelle saison conserve argent, dette, joueurs et équipement et remet la fatigue à zéro.

Niveaux 1 à 5, seuils cumulés 0 / 20 / 50 / 90 / 140 XP. Titulaire : 10 XP, +2 fatigue (+1 en cas de KO). Remplaçant : 4 XP, −3 fatigue. Chaque niveau donne +2 PV ; niveaux 2 et 4 : compétence d’archétype ; niveaux 3 et 5 : réserves ou vitesse d’archétype. À fatigue 3, −1,5 m ; à fatigue 5, également −1 aux trois compétences sportives. Un régulateur réduit seulement la fatigue de participation. Les caractéristiques affichées et utilisées par le moteur viennent du même compilateur, sans modification des profils de base.

Une protection transférable et revendable à moitié prix, un implant attaché au joueur. Remplacer un implant nécessite la confirmation explicite de sa destruction. Les acquisitions n’affectent pas le catalogue du JDR.

La clé navigateur `the-hub.rumbleball.career.v1` contient une seule carrière. Sauvegarde après chaque transition de gestion et chaque tour complet, reprise en pause. Les identifiants des rencontres empêchent le double prélèvement et le double règlement. Marché, calendrier et matchs utilisent des domaines de graines séparés. Export/import JSON avec validation avant remplacement ; un échec d’écriture conserve la sauvegarde précédente et propose de réessayer ou exporter l’état en mémoire. Les sauvegardes locales dépendent de l’origine du site : localhost, 127.0.0.1, les différents ports et GitHub Pages ont chacun leur stockage. Utiliser l’export/import pour transférer une carrière.

Limites : une carrière, huit joueurs, cinq niveaux, aucun intérêt bancaire, blessure permanente, entraînement payant, bâtiment, sponsor négociable, multijoueur ou transfert entre clubs.

## Essayer en local

Depuis la racine du dépôt, avec Node.js 22 ou plus récent :

```sh
node tools/serve.mjs
```

Ouvrir <http://127.0.0.1:8766/#outils-rumbleball>. Arrêter avec Ctrl+C. Le prototype utilise des modules JavaScript : il faut le servir en HTTP, ou l’ouvrir sur GitHub Pages, plutôt que directement en `file://`.

## Vérifier

```sh
node --test rumbleball/engine.test.mjs rumbleball/classes.test.mjs rumbleball/narration.test.mjs rumbleball/playback.test.mjs rumbleball/career.test.mjs rumbleball/career-ui.test.mjs rumbleball/passing.test.mjs rumbleball/appearance.test.mjs
```

Les tests couvrent les règles, les décisions, la reproduction pas à pas, 500 matchs avec classes, 30 matchs de compositions spécialisées ou mixtes, le journal narratif et la chronologie visuelle (trajets, lutte, réactions, KO, passes, techniques, annulation et animations réduites). Le rapport donne victoires par équipe et stratégie, prolongations et actions choisies. Les tests utilisent uniquement les modules intégrés de Node.

Les tests de carrière couvrent aussi trois saisons, une saison de défaites avec huit joueurs coûteux endettés, la progression des adversaires, l’équipement, les sauvegardes corrompues et les erreurs de stockage. Les tests d’événements d’interface utilisent un petit DOM en mémoire et le vrai lecteur de match : ils vérifient les transitions et les erreurs, sans prétendre vérifier le rendu ou le responsive dans un navigateur.

Campagne initiale du 17 octobre 2026, avant l’ajustement de la circulation : 242 victoires des Recrues, 258 des Charognards, 22 prolongations sur les 500 matchs. Les 30 matchs de compositions donnent 13 victoires des Recrues et 17 des Charognards. Le journal compte 295 décisions de passe, hors passes enchaînées après un ramassage. Les tests contrôlés vérifient aussi la concentration partagée et les interceptions. Les résultats de la nouvelle campagne et des deux journées de carrière figurent dans le [compte rendu](playtests/README.md).

## Organisation

- `data.mjs` : profils, rôles, consignes et terrain.
- `classes.mjs` : les quatre archétypes, leurs techniques, ressources initiales et textes partagés avec l’interface.
- `progression.mjs` : compilation pure, niveaux, fatigue, salaires et catalogue sportif.
- `appearance.mjs` : identité visuelle déterministe, couleurs de club, tenue adverse de contraste et armes illustrées ; aucun tirage de la simulation.
- `career.mjs` : transitions pures de carrière, finances, calendrier et règlement des journées.
- `career-storage.mjs` : validation, sauvegarde atomique et export/import JSON.
- `career-ui.mjs` : gestion du club ; utilise le lecteur de match de `ui.mjs` pour préserver terrain, animations et journal.
- `rules.mjs` : actions légales, jets, réactions, mouvements et invariants.
- `ai.mjs` : plan collectif et évaluation des décisions, sans modification des statistiques.
- `engine.mjs` : initialisation et orchestration, indépendantes de l’affichage.
- `ui.mjs` et `rumbleball.css` : préparation, terrain SVG, lecture et journal.
- `narration.mjs` : résumé narratif des événements exécutés, sans accès au hasard ni modification de l’état. Les détails et jets originaux restent dépliables dans leur ordre chronologique. Les distances correspondent aux cases parcourues, pas au coût en mouvement.
- `visuals.mjs` : écussons, marquages du terrain et pions SVG, indépendants des règles.
- `playback.mjs` : chronologie de présentation issue des événements exécutés, interpolée avec une seule boucle d’animation. Les trajets suivent les cases réellement parcourues ; le lutteur, sa cible et leur balle se déplacent ensemble. Les effets apparaissent après l’approche, au moment de l’action.
- `court-effects.mjs` : liens de lutte et effets SVG brefs (frappe, réaction, dégâts, raté, KO, possession et plaquage).
- `assets/arena-banner.webp` : illustration d’arène (154 Ko). Le [prompt de génération](assets/README.md) est conservé avec le visuel.

L’habillage reste limité à `#outils-rumbleball` et aux composants `rb-*`. Les maillots identifient les équipes ; le numéro reste droit, dans un rond pour votre club et un losange pour l’adversaire. Le jaune marque le ballon, la sélection et les réactions. Les PV des joueurs et le nombre de joueurs encore en jeu reprennent l’état de la simulation. La bannière se sépare du texte sur petit écran ; le journal passe sous le terrain. Les illustrations et marquages décoratifs sont ignorés par les lecteurs d’écran.

Les personnages SVG sont dessinés de dessus avec une silhouette compacte : teintes de peau, couleurs et coiffures variées, carrure des Béliers et brassard du Capitaine. L’identité dépend de l’identifiant permanent, sans changer au recrutement, en déplaçant un titulaire, après un achat ou un rechargement. La couleur du club se choisit à la création et dans **Effectif**, gratuitement ; elle se conserve en JSON. L’Exhibition dispose de son propre choix. Si les couleurs sont proches, l’adversaire porte une autre tenue pour cette rencontre. Les anciens exports restent compatibles, avec les couleurs par défaut.

Matraque, massue ou tonfa représentent les attaques de base existantes ; elles n’ajoutent aucune mécanique d’arme. Les quatre protections et quatre implants ont chacun un détail visible : plastron, épaulières, gants, semelles, jambes mécaniques, fibres au bras, viseur ou régulateur dorsal. Les portraits du recrutement, de l’effectif et des comparaisons d’achat utilisent le même dessin que le terrain. Les gestes suivent les événements : course, frappe, lancer, réception, prise et appel. Les personnages s’orientent vers leur déplacement ou leur cible et s’aplatissent au sol. La pause retire les gestes transitoires ; les préférences d’animations réduites sont respectées.

`node tools/rumbleball-character-preview.mjs` génère la [planche SVG des personnages](../mockups/rumbleball-characters.svg), avec les équipements, poses et deux tailles de lecture. C’est un aperçu des dessins seuls, sans navigateur. Les tests d’apparence vérifient identité, équipement transféré, tenue sauvegardée, contraste, actualisation du terrain et conservation du focus. Le rendu complet et le responsive demandent encore une vérification dans un navigateur.

Quatre coins blancs suivent le joueur dont le tour est affiché, y compris pendant ses déplacements et les réactions adverses. Ce repère reste visible si le joueur est sélectionné ou mis KO pendant son tour. Son nom apparaît près des commandes, et sa place dans l’initiative porte le même accent blanc ; les boutons correspondants exposent aussi `aria-current`.

La durée d’un tour dépend de ses actions : chaque réaction et chaque résultat ont leur temps de lecture, sans compression des tours complexes. À ×1, un retour de dégâts ou de possession reste visible 900 ms ; les déplacements gardent leur glissement rapide (95 à 250 ms par tronçon). Le tour suivant attend la fin des effets et une respiration de 300 ms, avec un intervalle minimum de 2 s. Les vitesses ×2, ×4 et ×8 divisent ces durées. Pause, changement de vitesse, navigation et masquage de l’onglet terminent la séquence à l’état réel du tour et retirent les effets. « Voir le résultat » saute les animations ; sélectionner un pion ne les relance pas. La préférence système `prefers-reduced-motion` désactive glissements et effets transitoires. Ces animations ne modifient ni l’état du moteur ni son hasard.

API du moteur : `createMatch(config)` retourne un état ; `stepMatch(state)` retourne `{ state, events }` sans modifier son entrée ; `simulateMatch(config, onTurn?)` retourne le même résultat en une seule exécution. La graine et l’état du générateur aléatoire font partie de l’état du match. L’interface conserve les événements séparément et sa vitesse ne consomme jamais d’aléatoire.

## Règles retenues

Source du socle : `scenario/la-troisieme-mi-temps/04-match.md`. Les profils des Charognards sont transcrits dans les données pour que le jeu ne dépende pas du dossier de scénario à l’exécution. Les Recrues en sont des copies mécaniques. Les capacités particulières du scénario sont remplacées par les adaptations sportives ci-dessous ; elles ne modifient pas les classes du livre. L’attaque du Frigo garde son +5 et son 1d8+3.

## Classes de rumbleball

La classe définit les techniques, le rôle définit les priorités du bot. Les profils préfaits sont symétriques : Nora/Suze — Capitaine ; Brique/Frigo et Étau/Raf — Bélier ; Zip/Miette — Escamoteur ; Vigie/Pépé — Passeur de précision. Les caractéristiques de base restent celles des profils existants.

| Archétype | Ressources et règles |
|---|---|
| **Brute — Bélier d’arène** | 6 Adrénaline par match. **Dur au mal** absorbe automatiquement jusqu’à 3 dégâts par impact, point pour point, sans réaction. Les dégâts restants déterminent KO et DD de tenue ; un impact entièrement absorbé ne provoque pas de test de tenue. **Percussion** coûte 2 Adrénaline dès la tentative d’attaque, après deux pas réellement effectués consécutivement dans la même direction. Sur touche, cible encore en jeu : JS FOR DD 13 ; échec, poussée d’une case. Pas de dégâts supplémentaires ni de lâcher automatique. |
| **Runner — Escamoteur** | **Lecture de cible** : action bonus, ennemi à 9 m. Une faille est acquise à la fin du tour de la cible si elle est encore en jeu et à portée ; maximum une en réserve et une acquisition par round. Conserver la faille donne +1 CA contre cette cible. **Exploitation sportive** dépense la faille pour un arrachement avec avantage, ou une feinte qui évite les seules opportunités de cette cible jusqu’à la fin du tour. Aucun coût d’action supplémentaire ; l’arrachement utilise l’action normale. |
| **Runner — Capitaine** | Même lecture et protection personnelle. **Ouverture collective** : le premier test d’arrachement, d’agrippement ou de plaquage d’un allié contre la cible consomme sa faille pour donner l’avantage. Le capitaine doit être en jeu et à 9 m de sa cible. Il ne consomme pas sa propre ouverture. Un seul capitaine contribue à un test, et une aide déjà présente préserve la faille. **Appel de jeu** : action bonus, autre allié à 9 m, 2 par match ; avantage à sa prochaine passe avant le début du prochain tour du capitaine. |
| **Gâchette — Passeur de précision** | 2 concentration par match, partagées entre **Passe ajustée** (avantage à son jet de passe, dans l’action normale) et **Lecture de trajectoire** (avantage à une interception avec sa réaction habituelle). Le bot réserve la passe ajustée aux situations difficiles ou à la fin du match et n’utilise pas de concentration quand une aide ou un appel donne déjà l’avantage. |

Toutes les tentatives spéciales dépensent leur ressource avant le jet, même en cas d’échec. Les avantages ne se cumulent pas. Verrouillage et appel partagent l’unique action bonus du tour ; la feinte consomme seulement une faille. Les ressources persistent entre les rounds et pendant les prolongations. Changer de cible efface l’ancienne faille sans remettre à zéro la limite d’observation du round. Un KO efface ses verrouillages et les appels le concernant. Le dernier engagement efface les cibles et appels, sans restaurer les ressources.

L’API accepte `players[i].archetype` et `awayPlayers[i].archetype` pour les essais de compositions ; les valeurs invalides retombent sur l’archétype préfait. `classes: false` désactive les classes pour comparer le socle. En Exhibition, le vestiaire conserve les archétypes préfaits et laisse modifier les rôles et consignes. La carrière fournit `rosters.home` et `rosters.away` (cinq profils compilés chacun), `teamNames`, `strategy` et `awayStrategy`. `playerId` reste permanent ; `id` appartient au terrain. Les plafonds et descriptions de ressources s’adaptent au niveau, sans changer les coûts des techniques.

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
- Aucun rebond, protocole Neuro, compagnon, soin, action préparée ou objet consommable pendant le match.

Les bots utilisent un score local explicable par rôle et une coordination recalculée à chaque tour. Pour une passe, ils comparent la possession à l’arrivée à celle du lanceur : DD, avantage, unique intercepteur éligible, réception disponible, défense du receveur et ordre d’initiative. Le calcul parcourt les distributions publiques des dés, sans consommer de hasard ni consulter les jets futurs. L’exposition au trajet reste pénalisée ; les réactions dépensées en opportunité pendant ce trajet ne sont plus comptées comme de futures interceptions. Les adversaires capables de rejoindre le porteur avant son prochain tour réduisent la sécurité estimée. Le bonus de protection d’un équipier ne s’applique pas au porteur lui-même ; esquiver en étant immobilisé ne reçoit plus un bonus défensif suspendu par les règles.

En Conservation, un passeur disponible peut offrir un deuxième relais et réserver sa réaction pour recevoir ; une consigne agressive conserve la priorité aux opportunités. Le capitaine prépare une passe effectivement choisie dans son aperçu local : portée, aide existante, renouvellement des réactions, initiative et fin de round sont pris en compte. Il conserve ses appels si des contestations au contact avant le tour du porteur rendent sa conservation trop incertaine. Les coûts, portées, jets et durées des techniques restent ceux des règles sportives ; ces changements concernent les décisions des bots. Des passes restent rares lorsque le terrain n’offre pas de réception sûre.

Le [compte rendu des deux journées](playtests/README.md) et sa sauvegarde JSON permettent de reprendre la carrière de test. Le script `node tools/rumbleball-two-days.mjs`, lancé depuis la racine d’un dépôt Git complet, reconstruit la première rencontre avec les sources du commit `c966ffc`, puis joue les journées 2 et 3 avec les décisions actuelles. Il écrit uniquement les fichiers de test dans `rumbleball/playtests/`.
