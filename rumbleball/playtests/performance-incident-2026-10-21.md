# Incident de lenteur — 21 octobre 2026, soirée de Paris

## Mesures

- GitHub Pages : HTML HTTP 200 en 110 ms ; JS mesurés en 9–13 ms, réponses mises en cache et compressées.
- SDK esm.sh : HTTP 200 en 135 ms. Navigateur public : connexion affichée, aucune erreur console au démarrage. Aucune session du manager utilisée pour ce contrôle.
- Supabase Auth health HTTP 200 en 731 ms ; requête API sans utilisateur HTTP 401 en 911 ms.
- Deux lectures REST avec `select=status&limit=1` (ligues puis solo) dépassent chacune 12 secondes. Même constat lors d’une seconde mesure.
- Diagnostic agrégé : deux ligues broadcast, jusqu’à 2 708 057 octets JSON par état et huit rencontres par soirée. Ce volume seul ne démontre pas une saturation mémoire.
- PostgreSQL : cinq connexions authenticator `idle in transaction`, opération rb_commit_league, inactives depuis plus de deux minutes, sans bloqueur entrant. Elles peuvent conserver des verrous et occuper le pool REST.
- Journaux fournis par le manager : 57014 statement timeout, cron job startup timeout et RB_CONFLICT autour de 20 h 03. Les réponses pg_net des cinq dernières minutes observées comportent 40 timeouts sans statut et dix HTTP 500.
- Le statut Management API ACTIVE_HEALTHY ne reflète pas la disponibilité constatée des lectures REST. Aucune preuve d’une panne générale GitHub Pages ni d’un manque de RAM du navigateur n’a été obtenue.

## Correction et état réel

La migration `20261021210000_rumbleball_worker_claim.sql` est appliquée. Le worker déployé réserve désormais une ligue due avant de lire son état : pas de calcul simultané sur la même ligue, une lecture au lieu de deux, abandon sans quatre recalculs sur conflit. La réservation expire après 45 secondes ; lectures et écritures worker ont un délai réseau de dix secondes.

La correction cliente locale borne les requêtes à quinze secondes et espace le polling à 8/16/30 secondes après des erreurs. La copie locale et les identifiants de sauvegarde sont conservés. Les modifications frontend ne sont pas encore commit/push.

Le nettoyage des transactions abandonnées a d’abord été bloqué : création du rôle de connexion d’administration refusée avec HTTP 544 / connection timeout. Le manager a ensuite exécuté le SQL et obtenu zéro connexion libérée. Les anciennes transactions avaient disparu, mais les lectures REST dépassaient encore douze secondes : le seul nettoyage ne démontrait pas un rétablissement.

Protection appliquée après récupération de l’accès SQL :

1. `supabase/rumbleball-recover-stale-transactions.sql` : exécuté par le manager, résultat zéro.
2. `supabase/migrations/20261021211000_rumbleball_transaction_timeouts.sql` : appliquée, limite transactionnelle locale de trente secondes d’inactivité uniquement pour les fonctions Rumbleball.
3. `supabase/migrations/20261021212000_rumbleball_compact_archived_frames.sql` : appliquée, archivage atomique puis retrait des animations terminées de l’état actif. Une animation n’est retirée que si son archive contient exactement les mêmes images et le même état initial. La migration vérifie par empreintes que tous les replays préexistants sont conservés à l’identique ; sinon elle est annulée intégralement.

## Rétablissement vérifié à 20 h 44, heure de Paris

Les états avaient atteint environ 5,1 Mo chacun, dont 4,0–4,3 Mo de matchs terminés déjà archivés. Après compaction, l’état actif observé descend à 794 646 octets (177 898 stockés), sans ancien match terminé encore transporté.

Les lectures REST mesurées après compaction répondent HTTP 200 en 170 ms (ligue) et 102 ms (solo), contre les timeouts de douze secondes précédents. Les six dernières réponses du worker sont HTTP 200. Les deux ligues ont repris leur progression puis atteint preparation ; aucune transaction Rumbleball inactive depuis plus de trente secondes n’est observée. La réservation reste inaccessible au rôle anon.

Le correctif serveur est actif. Les protections clientes de quinze secondes et le backoff restent locales, en attente de commit/push avec l’interface Direct. Aucun redémarrage du projet ni augmentation de ressources payantes n’a été effectué. Ces mesures prouvent la reprise du service observé ; elles ne remplacent pas une reproduction du plantage du navigateur du manager.

## Contrôles locaux légers

34 tests réussis via le lanceur séquentiel limité à 256 Mo : network-resilience (3), solo-sync (9), online/ui (13), worker-claim (3), sélection league (5), compacted-replay (1). Aucun test de charge ni simulation de saison lancé pour ce diagnostic.

## Publication et stockage compact

Le lot Git de publication du 21 octobre inclut les protections clientes auparavant locales et l’onglet Direct. Les archives ont ensuite acquis le format gzip versionné, avec les rondes différentielles et les contrôles détaillés dans `compressed-replays-2026-10-21.md` : API version 21 et worker version 20 actifs, quatre archives converties après sauvegarde, états des parties préservés. Ce changement réduit aussi les valeurs stockées des quatre archives de 1 114 472 à 77 664 octets. La séparation complète des matchs et des tâches reste décrite dans `../online/storage-plan.md`.
