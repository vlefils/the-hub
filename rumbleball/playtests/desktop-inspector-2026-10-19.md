# Fiche joueur et choix d’équipement — 19 octobre 2026

## Structure

La fiche longue réunissait les réglages, toutes les statistiques, la progression, le mannequin, la réserve et le magasin dans la colonne droite. À partir de 1 440 px, trois onglets affichent un seul ensemble à la fois. Identité, XP et fatigue restent communs :

- Joueur : rôle, consigne, caractéristiques et statistiques dérivées.
- Équipement : mannequin et sept emplacements ; la réserve et le magasin sortent de la colonne.
- Progression : points de caractéristiques, informations de progression et cession. L’onglet signale les points disponibles.

Les boutons natifs utilisent les rôles de tabulation, les relations de panneaux et la navigation par flèches, Début et Fin. Le choix est conservé au changement de joueur, aux achats et aux rafraîchissements en ligne. Les onglets restent consultables pendant le verrouillage.

## Modale

Un emplacement ouvre une modale native commune au solo et au multijoueur. Elle distingue matériel du club, dotation gratuite et magasin, avec illustrations, noms, disponibilité ou prix. Les objets portés par un coéquipier sont identifiés ; le bouton annonce explicitement le transfert.

Le survol ou le focus affiche l’effet, la description et la comparaison dans une zone stable. Le survol ne sélectionne pas l’objet et ne présente pas d’action d’achat pour cet aperçu. Cliquer sélectionne l’objet et place le focus sur sa confirmation. Le déplacement de la souris ne remplace pas cette confirmation. Les implants conservent la confirmation de destruction.

Retrait vers la réserve, transfert, achat, dotation et revente réutilisent les commandes existantes. La modale se ferme avant l’opération ; les erreurs restent gérées par les notifications existantes. Un double clic ne déclenche pas deux commandes. Après une mise à jour, le focus peut revenir au nouvel emplacement correspondant.

Escape et Fermer rendent le focus au déclencheur. Les écouteurs de largeur sont nettoyés à la fermeture. Un passage sous le seuil ferme la modale et restitue le choix intégré. Si un rafraîchissement remplace la fiche ou son joueur, la modale se ferme pour éviter une présentation périmée.

## Mobile

Sous 1 440 px, aucune barre d’onglets ni modale d’équipement : les panneaux sont visibles dans la fiche et l’emplacement conserve les listes de matériel du club et du magasin. Le filtrage par emplacement, les confirmations et les actions restent les mêmes. Aucun défilement interne n’est ajouté à la colonne joueur.

## Validation

76 tests d’interface réussis : fiche, clavier, survol sans mutation, achat dans la bonne main, transfert d’un coéquipier, double clic, implant, verrouillage, fermeture et focus, nettoyage et redimensionnement, remplacement de fiche, sauvegarde solo, tactiques non enregistrées en ligne et annulation de préparation.

Commande : `node --test rumbleball/player-inspector.test.mjs rumbleball/career-ui.test.mjs rumbleball/online/broadcast-ui.test.mjs rumbleball/equipment.test.mjs rumbleball/preparation-workspace.test.mjs rumbleball/deployment.test.mjs rumbleball/online/ui.test.mjs`.

La validation est fondée sur les tests DOM et la revue du responsive CSS ; aucune nouvelle capture de navigateur n’est revendiquée. Les règles, le catalogue et le serveur ne changent pas ; aucun SQL ni redéploiement Supabase n’est nécessaire.
