# Mise en service des optimisations Rumbleball — 22 octobre 2026

Le backend du commit `1ae701d` est déployé et le stockage séparé est actif depuis le 22 octobre 2026, vérifications terminées à 12 h 30, heure de Paris. Voir le [relevé JSON](performance-deployment-2026-10-22.json) et les [mesures locales du correctif](performance-fixes-2026-10-22.md).

## Déploiement

- Sauvegarde locale vérifiée avant intervention : une ligue, trois adhésions, quatre replays et neuf sauvegardes solo, soit 1 597 532 octets. Les données et identifiants de connexion restent dans le dossier ignoré `.local/`.
- Migration additive `20261022110000_rumbleball_match_storage.sql` appliquée avant le déploiement des lecteurs. Les données applicatives ont été comparées intégralement avant et après la migration.
- Déploiement ciblé de `rumbleball-api` et `rumbleball-worker`, puis vérification des lecteurs avec le flag encore absent. Activation de `RB_SPLIT_MATCH_STORAGE=true` après expiration de la fenêtre des anciennes invocations.
- Versions finales actives : API **24**, worker **23**. La mise à jour du secret Supabase incrémente également les versions de configuration des autres fonctions ; leurs empreintes de code, leur contrôle JWT et les autres secrets ont été vérifiés identiques.
- Conversion atomique de la ligue en préparation : `matchStorage: 2`, révision 92 → 93, quatre checkpoints conservés. Aucun match supplémentaire calculé pour cette ligue. Le prochain réveil reste fixé au **22 octobre à 20 h, heure de Paris**.

## Contrôles en production

Les appels authentifiés aux listes multijoueur et solo passent. L’API refuse une requête sans session et les permissions interdisent aux rôles navigateur l’accès aux nouvelles tables privées et aux RPC internes.

Une ligue temporaire de quatre clubs a joué une soirée accélérée de deux rencontres à travers les fonctions déployées, en neuf invocations worker. Les résultats, revenus, salaires, progressions et projections Club/Ligue/Direct correspondent à la simulation de référence. Chaque image publique des deux nouveaux replays est identique. Un nouvel appel worker après la soirée ignore la ligue sans écrire ni payer une seconde fois.

La ligue temporaire, ses checkpoints et ses rondes, ainsi que le compte de validation créé sans envoi d’email, ont été supprimés et leur absence a été vérifiée. La ligue réelle et les sauvegardes existantes sont restées identiques pendant cet essai.

Après conversion de la ligue réelle, six projections ont été comparées : les trois participants, avec et sans animations. Les quatre anciennes archives sont identiques, leurs replays restent lisibles et 300 images publiques ont été comparées. Les neuf sauvegardes solo et les trois adhésions sont inchangées. Le worker déployé ignore correctement cette ligue en préparation sans nouvelle écriture.

Le contrôle final constate cinq exécutions cron récentes réussies, aucune ligue en retard et aucune transaction Rumbleball abandonnée.

## Portée des mesures

Les neuf appels HTTP worker de la soirée de test prennent **300 à 1 106 ms**, avec une médiane de **415 ms**. Ces temps comprennent le réseau et les démarrages à froid ; ils ne constituent pas une comparaison avant/après en production.

Cette soirée accélérée à quatre clubs vérifie le fonctionnement du backend déployé. Elle ne valide pas la capacité maximale ou la charge simultanée. Les mesures par étape sont présentes dans les logs des fonctions, mais n’ont pas été exportées pendant cette validation. Les résultats locaux à seize clubs et la comparaison du moteur restent documentés séparément.

Une ligue convertie doit continuer à utiliser les nouveaux lecteurs et tables, même si le flag est ultérieurement désactivé. Un retour au stockage précédent nécessite une reconstruction et une vérification des données.
