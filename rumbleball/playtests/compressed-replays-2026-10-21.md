# Stockage compact des rondes et replays — 21 octobre 2026

## Changement livré

- `online/replay-codec.mjs` encode une ronde avec un état de départ, un dictionnaire de chemins numériques et les seules modifications par action. Les ajouts, suppressions, changements de tableaux et éventuelles discontinuités sont conservés.
- Chaque ronde se lit indépendamment. Le dernier état complet, son RNG et les règles du moteur restent le checkpoint de calcul ; aucune simulation n’est relancée pour décoder les animations.
- Les anciennes rondes et archives restent lisibles. Une ronde historique peut être suivie d’une ronde compacte lors d’une reprise.
- Une rencontre terminée est compressée en gzip, avec format versionné, identifiant, taille et SHA-256. Le trigger archive l’enveloppe et la retire du live dans la même transaction, avec contrôle d’une archive préexistante.
- La décompression est bornée ; format, identité, empreinte et taille sont vérifiés. Les chemins dangereux et références invalides sont refusés.
- L’API renvoie les mêmes états publics au navigateur, après filtrage des seeds/RNG et de l’heure de diffusion. Aucun frontend à publier pour bénéficier de cette réduction côté serveur.

## Vérifications locales

45 tests réussis avec le lanceur séquentiel, limite de 256 Mo et priorité réduite :

- replay-codec : 5 ; compacted-replay : 1 ; worker-claim : 3 ; replay : 2 ; online/ui : 13 ; broadcast-ui : 17.
- sélection de league : 4 (`soirée`, `diffusion`, `worker fractionné`, `service`).

Ces tests couvrent la restitution exacte des états, les champs ajoutés/supprimés, les tableaux, les données corrompues, les références numériques, les anciennes sauvegardes, la reprise du calcul, le direct, la consultation de replays et les protections de progression. Aucune simulation de saison ni test de charge.

## Vérification SQL

Une ligue temporaire a été créée dans une seule transaction puis entièrement annulée. Contrôles : archivage atomique, retrait de l’enveloppe du live, appel répété sans doublon, corruption refusée, archive différente refusée, révision inchangée après échec, ancienne archive et compaction compatibles, conversion idempotente, absence de droits navigateur, isolation des données réelles. Après rollback : aucune ligue de test persistante, une ligue réelle, quatre replays et neuf sauvegardes solo.

## Déploiement et conversion réelle

- Migration appliquée : `supabase/migrations/20261021220000_rumbleball_compressed_replays.sql`.
- `rumbleball-api` version 21 ACTIVE ; `rumbleball-worker` version 20 ACTIVE.
- L’API compatible a été déployée avant toute conversion des archives.
- Les quatre archives de « La ligue du jeudredi » ont été sauvegardées et vérifiées avant conversion avec `tools/compact-rumbleball-replays.mjs`. Chaque écriture compare l’original attendu, puis le replay est relu et reconstruit intégralement. Les originaux et le manifeste restent dans `.local/replay-compression-20261021`, ignoré par Git.

| Mesure des quatre archives | Avant | Après |
| --- | ---: | ---: |
| JSON PostgreSQL (`octet_length(replay::text)`) | 4 971 444 octets | 77 569 octets |
| Valeurs stockées (`pg_column_size(replay)`) | 1 114 472 octets | 77 664 octets |

Environ 93 % de réduction des valeurs stockées. Ce relevé ne mesure pas la taille totale des fichiers de la base ou des index, ni la libération physique immédiate des anciennes versions de lignes.

Les 300 snapshots publics des quatre replays reconstruits depuis la base ont été comparés aux projections des originaux : identiques, seed publique égale à l’identifiant de rencontre, RNG public nul. Ce contrôle utilise le service de projection local avec les données réelles relues, sans connexion au compte d’un manager. Les contrôles UI utilisent le DOM de test ; aucune nouvelle validation visuelle en navigateur connecté n’a été réalisée.

Au contrôle de 21 h 47, heure de Paris : lecture REST légère des ligues 49 ms et du solo 79 ms ; API anonyme HTTP 401 ; worker déployé appelé avant l’échéance HTTP 200, traitement ignoré sans écriture. L’état complet de ligue est identique à la sauvegarde ; les neuf sauvegardes solo et leurs révisions sont inchangées. La ligue reste à la révision 87, prochain match le 22 octobre à 20 h Paris. Aucun match réel avancé pour le contrôle.

## Limite restante

Le format réduit le volume, mais les rondes non terminées sont encore contenues dans l’état de ligue partagé. La séparation des matchs en tables et la file de tâches avec jetons de réservation restent décrites dans `online/storage-plan.md`. Les anciens clients restent compatibles avec la nouvelle API ; un retour à une API qui ignore le format gzip demanderait d’abord une restauration vérifiée des archives originales.
