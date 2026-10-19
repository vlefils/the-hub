# Fiche joueur et choix d’équipement — 19 octobre 2026

## Structure

La fiche longue réunissait les réglages, toutes les statistiques, la progression, le mannequin, la réserve et le magasin dans la colonne droite. À partir de 1 200 px, trois onglets affichent un seul ensemble à la fois. Identité, XP et fatigue restent communs :

- Joueur : rôle, consigne, caractéristiques, statistiques dérivées et cession du joueur.
- Équipement : mannequin et sept emplacements ; la réserve et le magasin sortent de la colonne.
- Progression : points de caractéristiques et informations de progression. L’onglet signale les points disponibles.

Sur ordinateur, le contenu de Progression peut défiler dans la fiche. La hauteur disponible suit les autres colonnes de préparation ; déplier les paliers ne doit pas agrandir la page. Identité, XP, fatigue et onglets restent hors de cette zone. Le panneau accepte le focus clavier et garde le défilement de molette à l’intérieur. La fiche conserve son déroulement habituel sur mobile. Tous les compteurs et barres de fatigue portent désormais un libellé visible « Fatigue », dans la fiche, les titulaires, le banc et les détails des clubs.

Les techniques de classe sont affichées directement dans Progression, avec leurs effets et leurs réserves actuelles, en solo comme en ligne. Une technique est acquise au départ ; Percussion, Exploitation sportive, Appel de jeu et Lecture de trajectoire se débloquent au niveau 3. Les techniques verrouillées sont grises et indiquent leur niveau requis. Une liste séparée présente les autres paliers : caractéristiques aux niveaux 3, 6, 9 et 12 ; maîtrise et réserves aux niveaux 4, 7 et 10 ; vitesse de l’Escamoteur aux niveaux 3 et 5. Les nouveaux matchs utilisent les règles v7 ; les rencontres et replays v2 à v6 restent inchangés. L’Exhibition sans niveaux conserve toutes les techniques.

Les boutons natifs utilisent les rôles de tabulation, les relations de panneaux et la navigation par flèches, Début et Fin. Le choix est conservé au changement de joueur, aux achats et aux rafraîchissements en ligne. Les onglets restent consultables pendant le verrouillage.

## Modale

Un emplacement ouvre une modale native commune au solo et au multijoueur. Elle distingue matériel du club, dotation gratuite et magasin, avec illustrations, noms, disponibilité ou prix. Les objets portés par un coéquipier sont identifiés ; le bouton annonce explicitement le transfert.

Le survol ou le focus affiche l’effet, la description et la comparaison dans une zone stable. Le survol ne sélectionne pas l’objet et ne présente pas d’action d’achat pour cet aperçu. Cliquer sélectionne l’objet et place le focus sur sa confirmation. Le déplacement de la souris ne remplace pas cette confirmation. Les implants conservent la confirmation de destruction.

La fenêtre conserve une largeur et une hauteur indépendantes de l’objet affiché, dans les limites de l’écran. L’en-tête et le solde restent visibles ; la collection et l’aperçu disposent chacun de leur défilement avec une place réservée à la barre. Un nouvel aperçu revient en haut sans déplacer la fenêtre ni la liste d’objets.

Les cinq armes gratuites et le casque possèdent désormais une illustration WebP transparente, comme les 23 autres objets. Les SVG précédents restent disponibles en secours.

Retrait vers la réserve, transfert, achat, dotation et revente réutilisent les commandes existantes. La modale se ferme avant l’opération ; les erreurs restent gérées par les notifications existantes. Un double clic ne déclenche pas deux commandes. Après une mise à jour, le focus peut revenir au nouvel emplacement correspondant.

Escape et Fermer rendent le focus au déclencheur. Les écouteurs de largeur sont nettoyés à la fermeture. Un passage sous le seuil ferme la modale et restitue le choix intégré. Si un rafraîchissement remplace la fiche ou son joueur, la modale se ferme pour éviter une présentation périmée.

## Mobile

Sous 1 200 px, aucune barre d’onglets ni modale d’équipement : les panneaux sont visibles dans la fiche et l’emplacement conserve les listes de matériel du club et du magasin. Le filtrage par emplacement, les confirmations et les actions restent les mêmes. Aucun défilement interne n’est ajouté à la colonne joueur.

## Densité et détails de Ligue

Sur ordinateur, l’en-tête, le bandeau, les cartes, le banc et les champs réservent moins de hauteur ; la taille du terrain dépend également de la hauteur disponible. La fiche conserve son contenu, ses cibles de clic et ses onglets dès 1 200 px. Aucun masquage du débordement de la page n’empêche de lire un contenu long ou une erreur.

Dans la carrière, le classement et le calendrier ouvrent l’effectif du club cliqué en modale : titulaires calculés par la vraie rotation IA, banc, niveaux, XP, fatigue et équipement. Les archives de saisons et l’aide à la préparation s’ouvrent aussi en modale. En ligne, les replays passent dans une liste en modale, accessible pendant le verrouillage et stable pendant les rafraîchissements. Les données privées des adversaires en ligne ne sont pas exposées.

## Validation

84 tests réussis : fiche, clavier, survol sans mutation, achat dans la bonne main, transfert d’un coéquipier, double clic, implant, verrouillage, fermeture et focus, nettoyage et redimensionnement, remplacement de fiche, sauvegarde solo, tactiques non enregistrées en ligne et annulation de préparation, identités et présence de tous les visuels. Les 29 équipements WebP ont également été décodés et contrôlés : 256 × 256 avec canal alpha transparent.

Commandes : `node --test rumbleball/player-inspector.test.mjs rumbleball/career-ui.test.mjs rumbleball/online/broadcast-ui.test.mjs rumbleball/equipment.test.mjs rumbleball/preparation-workspace.test.mjs rumbleball/deployment.test.mjs rumbleball/online/ui.test.mjs`, puis `node --test rumbleball/identity.test.mjs`.

Les validations de structure utilisent les tests DOM et la revue du responsive CSS. Aucun SQL supplémentaire n’est nécessaire ; le déblocage de techniques nécessite le redéploiement de `rumbleball-api` et `rumbleball-worker`.

Après l’affichage des techniques et des paliers, les 45 tests de `player-inspector.test.mjs`, `career-ui.test.mjs`, `online/broadcast-ui.test.mjs` et `online/ui.test.mjs` ont été relancés avec succès.

Pour le compactage et les déblocages v7 : 400 tests exécutés, dont le test d’ouverture initialement figé sur v6 actualisé puis repassé avec ses tests voisins. Les 39 tests des vues modifiées et les 33 tests d’ouverture/fiche/multijoueur ont également été relancés. `deno check --no-lock` réussit pour les deux fonctions Supabase. Les cas ajoutés couvrent la modale de rotation et son focus, les techniques refusées sans jet ni dépense aux niveaux 1–2, l’interception automatique au niveau 3 et la conservation des règles v6.
