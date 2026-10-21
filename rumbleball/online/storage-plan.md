# Multijoueur : séparer la gestion de ligue et les simulations

Décision proposée le 21 octobre 2026, après l’incident de la soirée. Ce document décrit la prochaine évolution ; les tables et API proposées ci-dessous ne sont pas encore implémentées.

## Constat vérifié

`rb_leagues.state` contient les clubs, leurs préparations privées, le calendrier, le classement, les états du moteur et les animations des rencontres. Chaque ronde simulée réécrit cet ensemble. Chaque consultation `get` le charge entièrement avant de filtrer les données visibles par le manager dans l’Edge Function.

Le 21 octobre, les états ont atteint environ 5,1 Mo chacun, dont 4,0 à 4,3 Mo d’animations terminées déjà archivées. Les lectures REST, y compris celles du solo sur le même projet, dépassaient douze secondes. Des transactions abandonnées et des calculs concurrents ont également été observés. Après les protections et la compaction, les lectures mesurées sont revenues à 170 ms pour les ligues et 102 ms pour le solo. Ces observations ne prouvent pas la cause d’un éventuel crash du navigateur.

Contrôle du 21 octobre au soir, heure de Paris, avant nettoyage :

| Ligue | État | Clubs humains + bots | Matchs dans l’historique |
| --- | --- | --- | --- |
| test league | Lobby, aucun traitement programmé | 1 + 0 | 0 |
| La ligue du jeudredi | Préparation | 3 + 5 | 4 |
| Des billes | Préparation | 1 + 15 | 24 |

La ligue automatique de validation du 18 octobre, identifiée par le manifeste local, ne figure plus dans la base. Les noms seuls ne permettent pas de qualifier une autre ligue de donnée jetable : sa suppression doit porter sur un identifiant confirmé par le manager.

Le manager a ensuite explicitement demandé la suppression de « test league » et « Des billes ». Les deux ligues, leurs deux inscriptions et les 24 replays de « Des billes » ont été sauvegardés dans un dossier local ignoré par Git, puis supprimés dans une transaction contrôlant identités et révisions. L’état de « La ligue du jeudredi » et les révisions des neuf sauvegardes solo ont été vérifiés inchangés avant validation de cette transaction.

## Protections déjà actives

- Un seul worker réserve une ligue due ; réservation de 45 secondes et reprise après expiration.
- Une seule ronde calculée par invocation ; pas de quatre recalculs coûteux après un conflit de worker.
- Délais réseau worker de dix secondes et limite transactionnelle locale d’inactivité de trente secondes.
- Archivage atomique des animations terminées, puis retrait des images de l’état actif seulement si l’archive est identique. Les replays existants ont été vérifiés avant/après migration.

Les limites clientes de quinze secondes et le recul des tentatives à 8/16/30 secondes sont encore locales, avec l’onglet Direct, en attente de publication du frontend. Les correctifs serveur sont déployés.

La réservation actuelle utilise `next_tick_at` à la fois comme échéance et comme délai de reprise. Les animations des matchs non terminés restent dans la grosse ligne de ligue. Cette structure conserve donc un risque de nouvelle saturation ; la reprise observée ce soir ne valide pas la charge du lendemain.

## Mesure locale d’un format de replay compact

Le 21 octobre, analyse séquentielle des 24 replays sauvegardés de « Des billes » : 633 tours au total, sans requête réseau ni nouvelle simulation. Processus limité à 128 Mo et à basse priorité. Un prototype conserve l’état initial, les événements inchangés et des opérations de modification pour reconstruire les états suivants.

| Format | Octets cumulés | Taille arrondie |
| --- | ---: | ---: |
| JSON actuel | 18 997 418 | 19,00 Mo |
| JSON actuel, gzip par replay | 449 706 | 450 Ko |
| État initial + changements successifs, JSON | 1 733 731 | 1,73 Mo |
| État initial + changements successifs, gzip par replay | 209 666 | 210 Ko |

Les états `before` et `after` de chacun des 633 tours ont été reconstruits et comparés intégralement aux originaux. Dans cet échantillon, tous les `before` sont déjà identiques à l’état précédent : leur stockage complet est redondant. Les noms, caractéristiques et autres données inchangées des joueurs sont également répétés dans les snapshots actuels. Le prototype conserve les différences arbitraires au lieu d’imposer une liste fragile de champs dynamiques.

Le gain JSON du format différentiel est de 90,87 %. Avec gzip sur chaque replay complet, le volume obtenu représente 1,10 % du JSON initial. Ces mesures ne sont ni un gain d’espace disque PostgreSQL ni une garantie pour tous les futurs matchs : PostgreSQL peut déjà compresser les valeurs avec TOAST, et une compression ronde par ronde n’aura pas le même ratio qu’un replay entier. Le rapport local est `.local/replay-storage-analysis.json` ; le prototype n’est pas utilisé en production.

Application recommandée : état courant complet par match pour reprendre le moteur ; état initial figé et différences par ronde pour le direct ; archives immuables compressées séparées pour les replays terminés. Prévoir un point de reprise au début de chaque ronde pour accéder directement à une ronde sans reconstruire tout le match, puis mesurer à nouveau le coût de cette indépendance. Ajouter une version de format, une empreinte, des bornes de taille décompressée et des lecteurs des anciens replays. Ne pas recompresser une archive entière à chaque tour et ne pas la remettre dans la ligne de ligue. Les références numériques peuvent compléter ce format, avec dictionnaires figés par match ; elles ne doivent pas dépendre d’un catalogue qui change après la rencontre.

### Première réduction déployée

Cette partie est désormais implémentée et déployée : rondes indépendantes au format différentiel avec chemins numériques, archives gzip séparées et vérifiées par SHA-256, lecteurs compatibles avec l’ancien format et archivage atomique. Les quatre archives restantes ont été sauvegardées puis converties sans changer les états de ligue ou de solo. Leurs valeurs JSONB passent de 1 114 472 à 77 664 octets stockés ; le JSON PostgreSQL passe de 4 971 444 à 77 569 octets. La restitution publique des 300 snapshots est identique. Voir [la validation](../playtests/compressed-replays-2026-10-21.md).

Les rondes compactes non terminées restent à ce stade dans `rb_leagues.state` ; cette réduction ne réalise pas encore la séparation en tables de matchs/rondes ni la file de tâches décrites ci-dessous. Le calcul conserve un checkpoint complet, sans reconstruire l’historique. Aucun changement de règles ni de progression n’a été effectué.

## Architecture cible

Conserver Supabase et les Edge Functions. Commencer par retirer les données du moteur du chemin de lecture courant ; ne pas changer le moteur, les règles ou l’interface pour cette migration.

| Données proposées | Contenu | Accès et mutations |
| --- | --- | --- |
| `rb_leagues` | Identité, phase, saison, échéances, version du stockage | Métadonnées légères ; aucune animation |
| `rb_clubs` | Un club par participant, effectif, inventaire, préparation, révision propre | Commandes du manager ; préparation privée |
| `rb_matches` | Identifiants des clubs, horaires, configuration figée privée, état courant du moteur, résultat, version des règles | Un checkpoint borné par match ; le worker charge uniquement son match |
| `rb_match_rounds` | Une ronde immuable, identifiée par `(match_id, round)` ; images et événements | Ajout atomique avec le checkpoint ; lecture ciblée et paginée |
| `rb_jobs` | Type, match ou ligue, échéance, réservation, tentatives, prochaine tentative, dernière erreur | File durable avec concurrence bornée ; une expiration n’annule pas les garde-fous d’écriture |
| `rb_effects` | Clé d’effet unique, montant ou progression appliquée | Salaires, gains et progression appliqués une seule fois, même après reprise |

`rb_memberships` reste la source des autorisations. Garder les anciennes archives `rb_replays` lisibles ; les nouveaux replays réutilisent les rondes immuables. Une lecture complète de replay ne doit charger ni tous les clubs ni toute la ligue.

### Calcul et diffusion

1. À l’échéance, une transaction fige les préparations, complète les recrutements manquants, enregistre les salaires et crée les matchs et tâches de la journée. Une clé unique de journée empêche une seconde initialisation.
2. Le worker réserve une tâche avec un jeton unique et une expiration. Il lit un seul checkpoint et calcule une ronde hors transaction SQL.
3. Une transaction courte vérifie le jeton encore valide et la révision, ajoute la ronde et avance le checkpoint. Une réponse perdue ne doit jamais créer une deuxième ronde ni avancer deux fois le générateur aléatoire.
4. Les horaires du direct restent distincts de l’avancement du calcul. Le moteur peut prendre de l’avance ; les données publiques ne montrent que les rondes dont l’heure de diffusion est atteinte. L’API utilise l’horloge serveur pour cette vérification.
5. À la fin de diffusion, une tâche de clôture applique le résultat, la fatigue, l’XP et les primes dans une transaction avec des clés uniques d’effet. Puis elle programme la suite, avec deux minutes de pause.
6. Une tâche en échec recule sa prochaine tentative. Après un nombre borné d’échecs, elle reste explicitement en erreur avec un motif et une reprise administrative possible, sans boucle de recalcul permanent. L’interface affiche le retard et conserve le dernier état valide.

Le jeton sert de barrière : un ancien worker revenu après expiration ne peut pas écrire après son remplaçant. Une réservation seule ne suffit pas à assurer cela.

Limiter au départ le nombre total de simulations simultanées et le travail par invocation. Mesurer avant d’augmenter cette limite. Une ronde exceptionnellement trop coûteuse doit échouer proprement ; si nécessaire, le checkpoint devra descendre au tour, en conservant l’état exact du moteur et son RNG.

### Lectures des joueurs

- Accueil : résumés des parties et ligues du compte, sans moteur ni images.
- Club : club du manager et métadonnées de ligue, révisions indépendantes des animations.
- Ligue : classement et calendrier paginés, mis à jour à la clôture d’un match.
- Direct : calendrier et ronde publique courante, avec curseur ; seules les nouvelles données sont rechargées.
- Replay : rondes demandées progressivement, sans récupérer tous les matchs.

Une absence de nouvelle révision peut éviter le téléchargement d’un contenu identique, mais l’heure serveur et les changements de fenêtre de diffusion doivent quand même être pris en compte. Changer seulement le polling ou ajouter Realtime ne supprimerait pas le coût de lecture de l’état complet. Garder un rafraîchissement borné avec recul sur erreur comme première solution simple.

Les résultats futurs, les préparations adverses, les seeds et le RNG restent privés côté serveur. Toutes les nouvelles tables sont fermées aux accès directs anon/authenticated ; l’API autorisée renvoie une liste explicite de champs publics. Une commande sur un club ne doit pas invalider le calcul d’une ronde d’un autre match.

## Ordre de livraison

1. **Sortir les images et checkpoints de la ligue.** Ajouter `rb_matches` et `rb_match_rounds`, adapter worker, projection du direct et replay. Conserver temporairement les clubs dans l’état de ligue : c’est l’étape la plus utile pour réduire le volume sans changer toute la persistance à la fois.
2. **Remplacer la réservation de ligue par des tâches explicites.** Jetons, expiration, reprise et clôture atomique avec clés d’effet. Ne pas autoriser plusieurs workers par ligue tant que les écritures de clubs restent partagées.
3. **Séparer les clubs et les résumés de lecture.** Une préparation modifie seulement le club concerné ; une consultation courante ne charge jamais les données privées d’une simulation.
4. **Mesurer une soirée représentative avant de relever les capacités.** Simulations synthétiques locales en série et bornées en mémoire ; aucune campagne de charge sur la base partagée des joueurs.

Chaque étape inclut sa migration SQL, son code lecteur/écrivain, ses contrôles et le déploiement correspondant. Ne pas exposer un schéma à moitié migré à l’ancien worker.

## Migration et retour arrière

- Copier une sauvegarde des seules données Rumbleball avant chaque bascule ; ne pas modifier les autres applications du projet Supabase ni les comptes Auth.
- Basculer d’abord une ligue explicitement dédiée au test, puis une ligue réelle en préparation. La création d’un nouveau test en production doit être intentionnelle, bornée et suivie d’un nettoyage.
- Une ligue conserve une version de stockage explicite. La bascule est atomique avec contrôle de révision : copie des matchs/rondes, vérification des nombres et empreintes, retrait des images du JSON, puis activation de la nouvelle version. Une ancienne tâche ne peut plus modifier cette ligue.
- Garder les lecteurs des anciens replays et sauvegardes. Vérifier l’absence de perte ou de doublon de résultat, solde, fatigue, XP, équipement et archives.
- Après une écriture dans le nouveau stockage, un retour arrière exige une reconstruction vérifiée du format précédent ou une correction en avant. Ne jamais relire une ancienne copie de ligue devenue obsolète.

## Critères de validation

- Le volume d’une lecture Club/Ligue et d’un checkpoint de match ne croît plus avec le nombre de rondes archivées ; les listes historiques sont paginées.
- Deux demandes simultanées, une réponse perdue, une expiration de réservation et une reprise ne peuvent produire ni ronde ni paiement en double. Un worker dont le jeton a expiré est refusé.
- Après reprise, le résultat et les rondes sont identiques à ceux du même match déterministe sans interruption.
- Avant l’heure publique d’une ronde ou d’un résultat, aucune projection ni route de replay ne les expose.
- Supprimer une ligue retire ses tâches et matchs, sans recréation possible par une ancienne tâche et sans toucher les autres ligues ou parties solo.
- Mesurer séparément les durées de réservation, calcul et écriture, les octets par lecture, l’âge de la file, les reprises et erreurs. Un HTTP 200 seul n’atteste pas que la journée avance.
- Le contrôle final porte sur une soirée allant du recrutement à la clôture avec un navigateur déconnecté puis reconnecté. Exécuter les vérifications séquentiellement, avec mémoire et durée bornées.

## Prochaine échéance réelle

Après suppression des deux ligues demandées, « La ligue du jeudredi » reste programmée le 22 octobre 2026 à 20 h, heure de Paris (`18:00 UTC`). La suppression réduit le travail, mais les protections actuelles ne démontrent pas la capacité de l’ancien stockage à supporter cette prochaine soirée. La priorité de développement est l’étape 1, suivie de la reprise fiable des tâches ; cette évolution ne doit pas être présentée comme déjà déployée.
