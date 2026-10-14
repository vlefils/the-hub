# Propositions de correction — classes et sous-classes

Suite du [bilan niveau par niveau](BILAN-CLASSES-SOUS-CLASSES.md), établi à partir des [règles du jeu](index.html#personnage-classe-brute). **CON**, **DEX**, **FOR** et **ESP** désignent les modificateurs de caractéristique ; **BM** le bonus de maîtrise.

**État au 14 octobre 2026 :** les corrections **1.1, 1.2, 1.3, 1.5 et 1.6** sont intégrées dans le livre. Pour 1.5, la Surcharge minimale est un seuil d'activation ; l'alternative du plancher de risque n'est pas appliquée. Les anciennes pistes Runner des sections **1.4, 1.7 et 2 sont remplacées par les décisions de la section 4** et la [revue de compatibilité](REVUE-COMPATIBILITE-RUNNER.md). La refonte complète du Runner est désormais intégrée au livre ; les valeurs de voie adaptées restent à éprouver en partie. Les autres pistes de la section 2 restent non appliquées.

## 1. Corrections à faire en premier

### 1.1. Medibot : borner le soin sans lui retirer son rôle

**Proposition pour Assistance d'urgence :**

> Le Medibot peut administrer ce soin un nombre de fois égal à votre bonus de maîtrise. Il récupère toutes ses utilisations à la fin d'un repos long. Une utilisation soigne une créature une fois, avec les dés indiqués selon votre niveau. Stabiliser une créature à 0 point de vie ne consomme pas d'utilisation. Le Medibot ne peut toujours administrer ce soin qu'une fois par tour.

**Effet recherché :** la voie conserve un soin indépendant des dés de vie et de l'action du Ferrailleur, mais ne remet plus tout le groupe à pleine santé gratuitement entre deux rencontres. Au niveau 1, cela donne **2 utilisations de 1d4** par repos long ; au niveau 11, **5 utilisations de 4d4** avant l'aura. C'est un point de départ à tester, surtout au niveau 11 où l'aura ajoute BM à chaque soin reçu.

### 1.2. Brute Chair : fermer la chaîne d'attaques au niveau 11

Conserver Carnage à mains nues au niveau 8. **Remplacer la deuxième phrase de Monstre de chair au niveau 11 par :**

> Une fois par tour, lorsque vous déclenchez Carnage à mains nues en dépensant au moins 3 points d'Adrénaline avec Poings de boucher, vous pouvez effectuer deux attaques à mains nues supplémentaires au lieu d'une. Les attaques accordées par Carnage à mains nues ne peuvent pas déclencher Carnage à mains nues.

**Effet recherché :** Chair reste la voie de la cadence au corps à corps, avec un vrai pic au niveau 11, mais le nombre d'attaques est prévisible : **au plus deux attaques supplémentaires** par tour grâce à cette aptitude. Le seuil de 3 Adrénaline évite que ce pic ne coûte seulement 1 point ; la récupération de BM Adrénaline au contact reste utile.

### 1.3. Viseur : rendre Hit & Run utilisable

**Remplacer Hit & Run au niveau 8 par :**

> Une fois pendant chacun de vos tours, immédiatement après une attaque à distance effectuée en Posture ancrée, vous pouvez vous déplacer de 3 mètres. Ce déplacement est possible même si la posture a réduit votre vitesse à 0. Il ne provoque pas d'attaque d'opportunité de la cible de cette attaque et met fin à votre Posture ancrée, y compris à l'action différée qu'elle vous accordait.

**Effet recherché :** corriger la contradiction actuelle, tout en faisant du repositionnement une décision : tirer depuis un poste fixe, puis le quitter. Le Viseur ne conserve pas simultanément les bénéfices de la posture après ce mouvement.

### 1.4. Runner : définir la durée et la préparation des failles

**Ajouter à Faille :**

> Les niveaux de faille sont propres au Runner qui les a obtenus. Ils persistent jusqu'à la fin de la scène, jusqu'à ce que la cible tombe à 0 point de vie, ou jusqu'à ce que vous perdiez tout contact visuel ou auditif avec elle pendant 1 minute. Une cible ne peut avoir plus de 2 niveaux de faille de votre part avant le début d'un affrontement. Une fois l'affrontement engagé, la limite normale de 6 s'applique. Le début de cet affrontement ne retire pas les failles préparées, même si la scène change de nom. Si une aptitude transfère des failles après la mise à 0 point de vie d'une cible, résolvez ce transfert avant de retirer les failles de la cible vaincue.

**Effet recherché :** éviter les 6 failles préparées gratuitement sur chaque adversaire, sans empêcher la lecture préalable propre au Runner. La limite de 2 avant affrontement laisse un avantage concret à la préparation, et le transfert du Tueur continue de fonctionner.

**Point à décider en jeu :** « affrontement » doit couvrir aussi une confrontation sociale ou une intrusion tendue si les failles y sont utilisées. La fin de scène est alors décidée comme pour les autres effets narratifs.

### 1.5. Neuro : donner un sens mécanique à « Surcharge minimale »

Les protocoles exclusifs d'Overdrive et de Shock indiquent des minima **3, 8 ou 13** sans règle d'application. Le fait qu'Overdrive puisse démarrer à 3 suggère un **seuil d'activation**, cohérent avec sa montée en régime. **Ajouter aux règles de Surcharge neurale :**

> Quand un Protocole indique une Surcharge minimale, votre Surcharge actuelle doit être au moins égale à ce nombre **avant** de lancer le Protocole. Sinon, vous ne pouvez pas le lancer. Une fois ce prérequis vérifié, augmentez la Surcharge du rang de lancement et des éventuels coûts supplémentaires, puis résolvez le Protocole et son test de Surcharge. Un maintien ne demande pas de vérifier à nouveau le prérequis, mais augmente la Surcharge comme indiqué par le Protocole.

**Effet recherché :** un Protocole de rang 2 avec un minimum de 8 demande une préparation et ne peut pas être lancé immédiatement après un repos. Cela donne une vraie valeur à Montée en régime et justifie de ne pas réduire tout de suite les **8d6** de Surcharge plasma. Pour que Shock puisse employer son protocole de voie dès le niveau 2, ramener seulement la Surcharge minimale de **Frappe sismique de 3 à 1** ; ses effets défensifs lui permettent ensuite de monter en charge.

**Coût de cette lecture :** Overdrive, en partant à 3 et en gagnant 2 Surcharge par tour avec son aptitude de niveau 2, n'atteint le seuil 8 qu'après trois tours ; son premier Surcharge plasma arrive donc au **tour 4**. Le seuil 13 peut repousser son protocole de rang 3 au **tour 6**. Si ces délais rendent les nouvelles aptitudes invisibles dans les combats habituels, l'autre solution cohérente est un **plancher de risque** : fixer la Surcharge au minimum indiqué avant d'ajouter le rang, ce qui permet un lancement immédiat mais déclenche un test plus difficile et expose plus vite aux contrecoups. Il faut choisir entre ces deux rythmes avec une rencontre réelle avant d'inscrire la règle dans le livre.

**Clarification liée :** garder la Surcharge à un maximum de 20. Si une activation devait la dépasser, le Protocole se résout, la Surcharge reste à 20 et le test de Surcharge échoue automatiquement. Supprimer la phrase contraire de Rupture thermique au niveau 11 ; son bonus aux dégâts et son surcoût de +2 restent en place. Cela évite un cas spécial où un personnage devrait « tester » une valeur interdite par la règle de base.

### 1.6. Ferrailleur, Dopeur et Neuro : compléter les fiches de classe

Les valeurs suivantes constituent un **socle proposé** ; ce n'est pas un gain de puissance tant que les valeurs manquantes ne sont pas fixées.

| Classe | PV proposés | Maîtrises proposées | Pourquoi |
|---|---|---|---|
| Ferrailleur | d8 ; `8 + CON` au niveau 1, puis `1d8 (ou 5) + CON` | Armures légères ; armes de rue ; sauvegardes DEX et ESP ; choisir 3 parmi Techno, Investigation, Perception, Médecine, Survie, Intuition | Profil mobile et technique ; le compagnon porte une partie de la puissance. |
| Dopeur | d8 ; même formule | Armures légères ; armes de rue ; sauvegardes CON et ESP ; Médecine maîtrisée, puis choisir 2 parmi Investigation, Intuition, Perception, Survie, Techno, Influence | Médecine garantie pour le spécialiste ; résistance aux conditions de soin sous pression. |
| Neuro | d8 ; même formule | Armures légères ; armes de rue ; sauvegardes CON et ESP ; choisir 2 parmi Techno, Investigation, Perception, Intuition, Références | Cohérence avec son équipement léger et ses Protocoles fondés sur ESP. |

**Ajouter aux actes médicaux du Dopeur :** « Pratiquer un acte médical en combat demande une action, sauf indication contraire. Le jet de Sang-froid est effectué pendant cette action. » Les actes accordant ensuite une action bonus conservent leur effet.

**Compagnons :** donner à K9, Recon et Medibot une fiche calculable dès le niveau 1 :

> Chaque compagnon a un dé de vie d6 **par niveau de Ferrailleur**. Ses PV sont `6 + CON` au niveau 1, puis `1d6 (ou 4) + CON` par niveau supplémentaire, avec un gain minimal de 1 PV. Sa CA avant Architecture adaptative est `12 + DEX`. À partir du niveau 2, Architecture adaptative y ajoute BM une fois. Une attaque de morsure du K9 utilise `d20 + BM + FOR` ; un tir de tourelle du Recon utilise `d20 + BM + DEX`. Le DD des modules imposant une sauvegarde est `8 + BM + ESP` du Ferrailleur.

Préciser en outre leurs déplacements (proposition : **K9 9 m au sol ; Recon 9 m en vol ; Medibot 9 m au sol**) et les portées omises des modules. Cette formule de PV remplace la progression actuelle « après le niveau 2 », qui laisse le gain du niveau 2 incertain. **Vérifier la CA et les PV obtenus aux niveaux 1, 5 et 11** avant d'adopter ces nombres : le compagnon agit sans consommer l'action du PJ, mais sa destruction le retire jusqu'au repos long.

Valeurs intégrées : tourelle 18 m, taser 9 m, roquette 36 m, stase 18 m avec sauvegarde de Constitution. Le soin et l'usage hostile d'Injecteur balistique partagent les utilisations d'Assistance d'urgence. Avec les caractéristiques de départ, les gains fixes de PV et **avant toute ASI**, les profils donnent :

| Compagnon | Niveau 1 : PV / CA | Niveau 5 : PV / CA | Niveau 11 : PV / CA |
|---|---:|---:|---:|
| K9 | 7 / 12 | 27 / 15 | 57 / 19, Châssis de guerre compris |
| Recon | 7 / 14 | 27 / 17 | 57 / 19 |
| Medibot | 8 / 13 | 32 / 16 | 68 / 18 |

### 1.7. Hacker : permettre de reconstruire une faille après un Payload

La règle de base interdit d'utiliser Faille sur une cible déjà blessée par le Runner depuis le début de la scène. Après une Décharge neurale, le Hacker de niveau 2 a donc consommé ses failles, infligé des dégâts, puis perdu tout moyen explicite de regagner des failles sur **la même cible**. **Ajouter à Brèche assistée :**

> Vous pouvez utiliser Faille sur une cible équipée d'au moins un système technologique énuméré dans Brèche assistée même si elle a subi vos dégâts depuis le début de la scène ou que vous êtes ouvertement menaçant à son égard. Les autres conditions de Faille, son action bonus et sa sauvegarde s'appliquent normalement.

**Effet recherché :** le Hacker peut refaire un cycle de lecture puis Payload contre sa cible de prédilection. Il doit toujours réussir à placer des failles et consacrer ses actions bonus à ce travail. Au niveau 8, Résidu malveillant accélère ce cycle comme prévu.

## 2. Ajustements ciblés à tester ensuite

Ces propositions traitent des paliers dont l'effet paraît trop large ou trop étroit. Je les appliquerais **après** les corrections de la section 1, pour éviter de régler une puissance calculée avec des règles encore incomplètes.

| Aptitude | Proposition | Effet recherché |
|---|---|---|
| **Tueur à gages, Mise à mort calculée (niv. 5)** | Remplacer le bonus permanent d'ESP à **tous** les jets d'attaque contre une cible avec au moins 1 faille par : « Une fois par tour, après avoir lancé un jet d'attaque contre une cible sur laquelle vous avez au moins 1 faille, mais avant de savoir si l'attaque touche, vous pouvez consommer 1 faille pour ajouter ESP à ce jet. » Garder le bonus ESP aux dégâts à 4 failles, **une fois par tour**. | Garder la précision de l'assassin sans augmenter chaque attaque ni écraser la CA adverse. Consommer une faille crée un choix entre précision et bonus défensifs/offensifs. |
| **Runner Fixeur, Semer le doute (niv. 2)** | Lors d'une utilisation, désigner une des cibles affectées comme cible principale. En cas d'échec à sa sauvegarde, elle gagne **2 failles** ; chaque autre cible en gagne 1 en cas d'échec. | Le Fixeur peut atteindre le seuil de 4 failles en deux actions concentrées, ou une après préparation, et employer Ouvrez-le dans un combat normal. Il conserve son rôle de soutien multicible. |
| **Gâchette Akimbo, Double recharge (niv. 2)** | Remplacer la deuxième phrase, identique à la Posture mobile commune, par : « Une fois par tour, après avoir touché une créature à 3 mètres ou moins en Posture mobile, vous pouvez vous déplacer de 1,5 mètre sans provoquer d'attaque d'opportunité de cette créature. » | Donner un vrai gain de voie sans ajouter de dégâts. |
| **Gâchette Rafale, Feu nourri (niv. 2)** | Si la disponibilité des munitions ne limite pas réellement le mode, ne donner l'avantage qu'à **la première attaque** effectuée sous Feu nourri pendant le tour ; maintenir le double coût en munitions pour cette attaque seulement. Définir les armes compatibles dans le catalogue plutôt que par décision ponctuelle du MJ. | Préserver un tir de suppression fiable ; éviter un avantage gratuit sur deux attaques dès le niveau 8. À ne pas appliquer avant un test avec la vraie cadence de recharge. |
| **Ferrailleur, Liaison défensive (niv. 7)** | Si les essais montrent que l'avantage permanent à toutes les sauvegardes est trop fort : « Quand vous ou votre compagnon, situé à 1,5 mètre de vous, effectuez un jet de sauvegarde, vous pouvez utiliser votre réaction pour lui donner l'avantage. BM utilisations par repos court ou long. » | Conserver la défense coordonnée, avec un coût visible et une décision par tour. Ne changer qu'après avoir fixé les statistiques du compagnon. |
| **Ferrailleur, action du compagnon (niv. 1)** | Si les essais montrent que deux actions libres dominent le niveau 1 : « Le compagnon se déplace librement. Vous utilisez votre action bonus pour lui ordonner une action ; sans ordre, il ne peut que se déplacer et Esquiver. Au niveau 10, un ordre lui permet les deux actions prévues par Surcharge contrôlée. » | Garder un vrai second personnage sur le terrain, mais faire apparaître son coût dans l'économie d'actions du Ferrailleur. À décider seulement après avoir complété sa fiche. |
| **Dopeur Scalpel, Réserve opératoire (niv. 5)** | Autoriser son second dé de vie aussi lors d'un **Soin sous pression réussi** sur une cible disposant d'au moins 2 dés de vie ; conserver l'Opération d'urgence. | Rendre le niveau 5 utile avant qu'un allié ne tombe à 0 PV, sans créer de soin gratuit. |
| **Ferrailleur K9, Mobilité prédatrice (niv. 5)** | Après une morsure réussie, une fois par tour, la cible fait une sauvegarde de FOR contre `8 + BM + FOR du K9` ; en cas d'échec, elle tombe à terre. Garder escalade, nage et déplacements sans attaque d'opportunité. | Donner au K9 un vrai outil de contrôle au palier 5, cohérent avec son rôle de prédateur. |

Je **ne changerais pas encore les dégâts bruts** du Neuro, la deuxième action du compagnon au niveau 10, ni les attaques supplémentaires de niveau 8. Leur écart dépend fortement des seuils de Surcharge, de la CA/PV des compagnons, du coût réel des munitions et de la fréquence des repos.

## 3. Vérification en partie avant adoption

Faire jouer les versions corrigées aux niveaux **2, 5, 8 et 11** sur deux combats de **3** et **5 tours**, avec un repos court entre les combats, les mêmes armes et la même CA adverse. Mesurer séparément : dégâts par tour, dégâts évités, PV rendus, actions retirées à l'ennemi, coût de ressource et valeur hors combat. Ajouter une scène d'infiltration pour Runner/Recon et une scène de soins entre combats pour Dopeur/Medibot.

**Signaux d'alerte concrets :** Medibot remplace encore le Dopeur comme soigneur principal ; Chair dépasse deux attaques supplémentaires par tour ; Faille commence un combat à plus de 2 sans dépense significative ; Overdrive lance trois grosses zones sans risque perceptible ; un compagnon reste plus difficile à neutraliser qu'une Brute tout en conservant son action autonome. Si un de ces cas apparaît, ajuster le coût ou la fréquence de l'aptitude concernée plutôt que de modifier toute la classe.

## 4. Runner : décisions retenues au 12 octobre

Cette section remplace les propositions antérieures sur le Runner, notamment 1.4, 1.7 et les lignes Runner de la section 2. Les décisions ci-dessous ont été intégrées dans `index.html` le 14 octobre 2026, avec les adaptations de voie détaillées dans la [revue de toutes les capacités](REVUE-COMPATIBILITE-RUNNER.md). Ce tableau conserve la trace des choix initiaux ; le livre fait foi pour les valeurs jouables.

### Socle commun

| Étape | Fonctionnement retenu |
|---|---|
| Verrouiller | En combat, une action bonus choisit une cible visible à 18 m. Le verrouillage ne donne **aucune faille** et ne demande aucun jet. |
| Observer | À la fin du tour de la cible verrouillée, gagner **1 faille** si elle est visible à portée ; au plus une fois par round par cette observation. |
| Maximum par cible | **1 aux niveaux 1–3, 2 aux niveaux 4–6, 3 à partir du niveau 7.** Les aptitudes de voie restent aux niveaux 2, 5, 8 et 11. |
| Changer de cible | Action bonus ; le Tueur et le Hacker perdent leur ancien compteur et commencent à zéro sur la nouvelle cible. Le Fixeur conserve ses compteurs sur les autres cibles. Verrouiller à nouveau une même cible ne donne pas de faille. |
| Dépenser | La dépense réduit immédiatement les bonus défensifs associés. Elle ne met pas fin au verrouillage ; l'observation permet de reconstruire la jauge. |
| Couvert | Voir la cible depuis un couvert reste compatible avec l'observation. Une vue coupée empêche le gain sans effacer immédiatement les failles. |
| Fin | Les failles sont personnelles à chaque Runner, disparaissent à la fin du combat et ne se préparent pas hors combat. Le traitement des KO et transferts doit être précisé dans les aptitudes concernées. |

Les défenses restent une raison de conserver des failles. Les anciens seuils 1–2 / 3–4 / 5–6 doivent devenir 1 / 2 / 3. Leurs effets exacts, leur cumul et le remplacement des sauvegardes récurrentes restent à rédiger.

### Moteurs des spécialisations à partir du niveau 2

| Voie | Génération spécifique | Exploitation |
|---|---|---|
| Tueur à gages | Une fois pendant son tour, sur une touche contre sa cible verrouillée : **+1 faille avant le choix de la dépense**. | Sur une touche d'arme, consommer des failles pour **+1d6 dégâts par faille consommée**. |
| Fixeur | Lorsqu'un ennemi visible rate une attaque, utiliser sa **réaction** pour lui ajouter **1 faille**, même sans verrouillage. Il peut conserver des compteurs sur plusieurs ennemis. | La prochaine touche d'un allié sur un ennemi marqué consomme automatiquement **toutes les failles sur cet ennemi** et ajoute **+1d4 dégâts par faille**. Aucune réaction ni action bonus d'exposition. |
| Hacker | **Action bonus d'analyse** sur sa cible déjà verrouillée : **+1 faille**, sans condition d'implant ni jet. | **Action**, dégâts de **1d12 par faille consommée**, JdS d'Esprit pour moitié. La dépense a lieu même sur un JdS réussi. |

Le verrouillage du Fixeur désigne sa seule cible d'observation automatique, mais il peut générer et conserver des failles ailleurs. Il prépare ainsi les ennemis hors du focus ; les alliés les font détonner en changeant de cible. Les bonus défensifs associés à ses compteurs s'appliquent contre chacun des ennemis marqués.

Les portées exactes de la réaction du Fixeur et de son exploitation automatique, la quantité librement dépensable par le Hacker et les limites de fréquence des exploitations doivent être explicitées lors de la rédaction. La revue propose des formulations ; elles ne sont pas encore des décisions supplémentaires.
