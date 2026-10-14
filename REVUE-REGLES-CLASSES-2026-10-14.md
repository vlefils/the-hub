# Revue des règles et des classes — 14 octobre 2026

Cette passe a lu le texte publié avant les corrections du 14 octobre 2026. Elle distingue les contradictions ou règles incomplètes des questions d'équilibrage qui demandent un essai en partie. Les points **1 à 4 et 6** ont depuis été corrigés dans `index.html` ; les points 5 et 7 à 10 restent des constats ou propositions.

Les corrections antérieures (soin limité du Medibot, chaîne d'attaques de la Brute Chair, déplacement du Viseur, fiches de classe et seuil de Surcharge minimale du Neuro) ne sont pas redemandées ici. La refonte du Runner est également documentée dans `PROPOSITIONS-EQUILIBRAGE-CLASSES.md` et `REVUE-COMPATIBILITE-RUNNER.md`.

## Priorité 1 — règles qui changent réellement une partie

### 1. Le Runner publié et le Runner retenu sont deux systèmes différents

**Constat.** Le livre conserve Faille sur action bonus avec sauvegarde, maximum de 6, seuils 1–2 / 3–4 / 5–6 et acquisition conditionnée par l'absence de dégâts ou de menace ouverte (`index.html`, lignes 3321–3334). Les trois voies utilisent toujours ces seuils et ces déclenchements (lignes 3422–3584). La section 4 des propositions retient au contraire verrouillage, observation en fin de tour, plafonds 1/2/3 et dépense des failles.

**Effet.** Une fiche créée aujourd'hui avec le livre ne joue pas le Runner décidé. Modifier seulement la capacité de base casserait les seuils 4 et 6, les transferts après KO et les Payloads.

**Suite.** Intégrer la refonte en une seule passe sur la progression, le socle, les trois voies et les exemples ; vérifier ensuite quatre tours types aux niveaux 2, 5, 8 et 11.

### 2. Chargeur : « par attaque » et « par action » se contredisent

**Constat.** Le résumé des règles dit « 1 usage de chargeur par attaque efficace » (ligne 432). Le chapitre Armes définit le chargeur comme un nombre « d'actions d'attaque efficaces » (lignes 1133–1137). Rafale consomme deux munitions *par attaque*, puis gagne une attaque dans la même action (lignes 2444–2461). Akimbo gagne aussi une attaque dans cette action (lignes 2418–2420), et la Brute Plomb peut en faire une autre en action bonus (ligne 2172).

**Effet.** Selon la phrase appliquée, une action avec deux attaques peut coûter un ou deux usages, avant même Feu nourri. Cela change la cadence et le coût des voies de tir.

**Suite.** Définir un « usage de chargeur » par **attaque effectuée avec l'arme**, y compris les attaques supplémentaires et les réactions ; Feu nourri en consomme deux pour chaque attaque concernée. Harmoniser ensuite le chapitre Armes et le catalogue. Si l'intention est plutôt un coût par action, il faut réécrire explicitement Feu nourri et les attaques supplémentaires autour de cette unité.

### 3. Le maintien d'Électrocution augmente la Surcharge sans test clairement imposé

**Constat.** La règle générale déclenche un test « chaque fois que vous lancez un Protocole » de rang 1 ou supérieur (lignes 3715–3717). Électrocution se lance une fois, puis se **maintient** avec une action et augmente encore la Surcharge à chaque maintien (lignes 4656–4663). La règle du seuil minimal évoque le maintien, sans dire s'il compte comme un lancement pour le test et le refroidissement (ligne 3701). Le plafond de 20 est rédigé pour « l'activation d'un Protocole » (ligne 3709).

**Effet.** Une lecture littérale permet des dégâts croissants sans nouveau test de contrecoup, tandis qu'une autre impose un test à chaque tour. Le risque central de la classe dépend de cette décision.

**Suite.** Ajouter une règle générale : chaque maintien qui augmente la Surcharge provoque un test après son effet, utilise le plafond de 20 et empêche le refroidissement de fin de tour. Préciser si « nombre de maintiens déjà effectués » compte le maintien en cours ou les précédents.

### 4. Le Dopeur peut relever une cible qui n'a plus de dé de vie, mais le soin demande quand même le résultat d'un dé

**Constat.** Opération d'urgence autorise explicitement une tentative à désavantage si la cible n'a aucun dé de vie, puis la réussite rend « le résultat d'1 dé de vie + Esprit » (lignes 2965–2970).

**Effet.** Aucun dé n'est disponible pour calculer les PV. La règle peut être lue comme un soin gratuit, une simple stabilisation, ou une impossibilité de réussir pleinement.

**Suite.** Décider le résultat sans dé disponible. Option simple : une réussite stabilise et rend un montant fixe explicite, ou bien relève à 1 PV ; un échec stabilise seulement. Garder distincte l'exception de Piqûre de reprise, qui relève à 1 PV sans dé de vie (ligne 3128).

### 5. Deux capacités des Doses n'ont pas de coût d'activation

**Constat.** Préparateur clandestin indique qu'une créature « utilise » une dose et se soigne immédiatement, sans action, action bonus ni interaction (lignes 3133–3138). Surcharge chimique indique une injection une fois par repos court et donne une action supplémentaire pendant une minute, mais ne précise pas l'action nécessaire pour injecter, ni quand elle est effectuée (lignes 3152–3161).

**Effet.** La voie peut obtenir des soins sans coût en combat et déclencher son grand bonus d'action gratuitement, selon la lecture de table.

**Suite.** Fixer le coût et le destinataire : par exemple une action pour administrer une dose préparée, et une action bonus pour injecter Surcharge chimique à soi-même ou à une cible consentante au contact. Ces valeurs sont des propositions de rédaction à tester ; le point indispensable est de nommer le coût.

## Priorité 2 — ambiguïtés locales et vocabulaire

### 6. La Posture ancrée autorise une « action bonus » pendant une réaction

**Constat.** La posture permet une action différée via réaction sans déclencheur annoncé, puis liste « utiliser une action bonus de classe ou d'arme applicable » parmi les réponses possibles (lignes 2290–2300). Les règles communes décrivent l'action bonus comme un coût propre (ligne 791) et Préparer une action comme une réaction à un déclencheur (lignes 815–816).

**Effet.** On ne sait ni à quel instant le tireur peut agir, ni si cette action bonus hors tour remplace celle de son tour, ni quelles capacités sont « applicables ». La valeur de la Posture ancrée et du Viseur varie donc beaucoup.

**Suite.** Garder une seule grammaire : réaction avec une fenêtre ou un déclencheur défini, pour une liste d'effets qui se résolvent comme réactions. Retirer « action bonus » de cette liste ou nommer précisément les exceptions autorisées.

### 7. Les sauvegardes d'« Agilité » n'existent pas dans le système à cinq caractéristiques

**Constat.** Le socle définit les sauvegardes Force, Dextérité, Constitution, Esprit et Charisme (ligne 474). Les protocoles exclusifs d'Overdrive et de Shock demandent pourtant une sauvegarde d'Agilité (lignes 4659, 4675, 4690 et 4703).

**Suite.** Remplacer Agilité par Dextérité dans ces quatre protocoles, si c'est bien l'intention. Rechercher ensuite les anciens noms de compétences dans les origines : Perspicacité, Technologie, Persuasion et Histoire apparaissent encore alors que le référentiel et la fiche utilisent Intuition, Techno, Influence et Références (lignes 506–551, 1633–1870).

### 8. La stabilisation du Medibot impose un test sans DD

**Constat.** Assistance d'urgence décrit une action et un test de Médecine avec les bons modificateurs, mais ne donne pas de DD (ligne 2791). La règle générale de stabilisation laisse au MJ la décision de demander un test, sans valeur chiffrée (ligne 880).

**Effet.** L'action spécifique du compagnon n'est pas résoluble de façon uniforme.

**Suite.** Définir un DD de stabilisation commun pour toute la table, puis y renvoyer depuis le Medibot ; ou rendre explicitement sa stabilisation automatique.

### 9. La progression du Neuro omet une aptitude de voie au niveau 5

**Constat.** Le texte de Voie neurale donne des aptitudes aux niveaux 2, 5, 8 et 11 (ligne 3743) et chaque voie a bien un niveau 5 (Psycher 4373, Overdrive 4468, Shock 4558). La ligne 5 du tableau de progression ne mentionne que l'accès aux Protocoles de rang 2 (ligne 3654).

**Suite.** Ajouter « aptitude de voie » à cette ligne. C'est une correction de lecture, sans modification de puissance.

### 10. Certaines limites de Surcharge ne couvrent que les Protocoles

**Constat.** Le maximum de 20 et l'échec automatique sont formulés pour l'activation d'un Protocole (ligne 3709). Parasitage, Montée en régime, Champ de force et Surcharge vitale peuvent aussi augmenter la Surcharge (lignes 4363–4367, 4462–4464, 4552–4563). Le texte ne dit pas si ces hausses sont plafonnées, interdites à 20 ou déclenchent l'échec automatique.

**Suite.** Définir le plafond pour **toute** augmentation de Surcharge ; réserver le test automatique au lancement ou au maintien d'un Protocole si c'est l'intention. Indiquer si une capacité peut être activée quand sa hausse est entièrement absorbée par le plafond.

## Équilibrage à mesurer après ces clarifications

- **Viseur / Akimbo / Rafale.** Au niveau 8, Akimbo et Rafale gagnent une attaque dans l'action Attaquer (lignes 2418–2461), Viseur gagne un déplacement après son tir (ligne 2379). Le critique automatique du Viseur n'arrive qu'au niveau 11 (ligne 2386). Mesurer dégâts et protection sur 3 et 5 tours, en incluant chargeur, couvert, réaction et déplacement ; ne pas compenser par intuition seule.
- **Ferrailleur.** Le compagnon a une action indépendante dès le niveau 1 (lignes 2565–2568), puis deux actions au niveau 10 (lignes 2623–2628). Mesurer sa contribution en dégâts, contrôle, soins et actions évitées, pas seulement ses PV/CA. Liaison défensive donne un avantage très large aux sauvegardes au niveau 7 (lignes 2614–2619).
- **Dopeur Scalpel.** Son aptitude de niveau 5 ne s'active que lors d'une Opération d'urgence sur une cible avec au moins deux dés de vie (lignes 3066–3070). Tester sa fréquence réelle avant de renforcer sa valeur.
- **Neuro Overdrive / Shock.** Le seuil d'activation 8/13 est désormais défini (ligne 3701), mais la vitesse de montée doit être observée sur la durée réelle des combats. Une capacité de niveau 5 ou 8 qui n'arrive qu'après la fin habituelle du combat existe surtout sur le papier.

## Ordre conseillé

1. Fixer la grammaire commune : unité de chargeur, action bonus/réaction, sauvegardes et plafond/test de Surcharge.
2. Fermer les trous de procédure : Opération d'urgence, doses, injection et stabilisation du Medibot.
3. Intégrer la refonte complète du Runner déjà décidée.
4. Corriger le tableau du Neuro et les anciens noms de compétences.
5. Tester les écarts de puissance restants avec les mêmes armes, CA, durées de combat et fréquence de repos.
