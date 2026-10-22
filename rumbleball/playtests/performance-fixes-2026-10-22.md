# Optimisations Rumbleball — 22 octobre 2026

Corrections de la [passe d’analyse](performance-audit-2026-10-22.md), comparées au commit `b0665ff9de7fbfea832dfe749cf77b740ba28abe`. Résultats bruts résumés dans [le relevé JSON](performance-fixes-2026-10-22.json).

## Changements livrés dans le code

- **Moteur :** voisins précalculés, occupation indexée pendant chaque recherche et file de priorité. Les coûts, l’ordre des destinations et les départages sont conservés ; aucun cache ne survit à une modification de l’état.
- **Solo :** résultat immédiat, règlement du dernier tour, forfait et simulation des playoffs exécutés dans un module Web Worker lorsque disponible. Création du worker à la demande, délai de 30 secondes, arrêt à la fermeture et réponses périmées ignorées. La dernière sauvegarde reste valide si le calcul échoue ou si le manager ferme la partie avant son résultat.
- **Sauvegarde :** JSON compact pour le stockage et la synchronisation ; export utilisateur toujours indenté, même format importable et mêmes identifiants d’écriture.
- **Lectures :** projection sans animations pour Club/Ligue, historique paginé par 30, compteurs SQL de bots et de mode solo, première lecture réutilisée avant mutation. Les anciennes demandes `get` sans vue restent compatibles.
- **Interface :** Club/Ligue ne se reconstruisent que si leurs données visibles changent. Une ronde calculée en arrière-plan ne détruit plus le classement. Direct conserve ses mises à jour et demande ses frames à l’ouverture. Les vues solo/match/multi sont importées seulement quand elles sont ouvertes.
- **Serveur :** délais réseau sur tous les accès Supabase, échéance partagée de 12 secondes par commande API ou invocation worker, mesures séparées de lecture, projection, calcul et commit.
- **Stockage séparé :** migration `20261022110000_rumbleball_match_storage.sql`, tables privées `rb_matches` et `rb_match_rounds`, checkpoints et rondes enregistrés atomiquement avec la révision de ligue. Les lectures chargent uniquement le match nécessaire au worker, les règlements dus ou la ronde publique demandée. Les anciens replays et le stockage précédent restent lisibles.

La réservation conserve le contrôle de révision existant. Le calcul utilise l’heure SQL ayant servi à hydrater son checkpoint, pour éviter de tenter un règlement dont les données n’ont pas encore été chargées. La séparation complète des clubs et la file de tâches avec jetons restent des évolutions distinctes du [plan de stockage](../online/storage-plan.md).

## Mesures locales

| Mesure | Avant | Après |
| --- | ---: | ---: |
| Calcul de 12 matchs déterministes, mêmes configurations | 5 136 ms | 2 748 ms, soit ×1,87 |
| JSON des commits d’une soirée de 16 clubs, même scénario | 22,42 Mo | 5,03 Mo, −77,5 % |
| JSON des lectures worker du même scénario | 21,99 Mo | 3,95 Mo, −82,0 % |
| Projection courante à huit clubs, avec/sans animations | 291 106 octets | 7 898 octets |
| Graphe statique local de l’entrée du jeu | 57 modules, 563 764 octets | 31 modules, 298 247 octets |

Les événements et tous les champs de l’état final des douze matchs sont identiques, RNG compris. Les versions 4 à 8 et les trois stratégies sont représentées. La suite de chemins compare également la nouvelle recherche à l’ancienne sur des tours réels, différents budgets, des prises et des joueurs KO.

La soirée SQL utilise 16 clubs, huit rencontres et 33 invocations, avec les réveils aux échéances et l’archivage du modèle précédent. L’état de ligue séparé atteint 90 134 octets au maximum dans ce scénario. Les volumes du tableau sont des documents JSON applicatifs ; ils ne mesurent ni WAL, TOAST, compression HTTP ni facturation. Les temps proviennent de Node 24.12.0 sur la machine locale, pas d’un Edge worker ou d’un téléphone. Le graphe statique exclut images, CSS, polices et SDK distant ; les fins de ligne de l’archive Git peuvent différer du relevé initial.

## Validation

- **527 tests réussis, aucun échec, 49 fichiers**, avec le lanceur séquentiel borné à 256 Mo et 60 secondes par fichier.
- **Dix contrôles PostgreSQL locaux** avec PGlite 0.5.11 : toutes les migrations, soirée complète, checkpoints et projections, replays identiques, conflit de révision, refus d’altération d’une ronde, rollback atomique, permissions, suppression en cascade et conversion de données anciennes actives ou déjà archivées.
- Tests du vrai module worker via un pont `worker_threads`, de l’annulation, de la réponse tardive, du règlement unique et de la conservation du dernier checkpoint après fermeture.
- Vérification syntaxique des quatre fichiers TypeScript des Edge Functions. Pas de déploiement Deno ou de requête à la base de production pendant cette passe.

La campagne statistique de 500 matchs reste exclue de cette exécution bornée ; la comparaison complète avant/après de douze matchs est séparée. Cinq anciens scénarios de test ont été actualisés : lancement avec recrutement explicite, adversaire lent défini explicitement depuis la hausse de vitesse v8, création directe d’un match v4, attente de la fin de l’entrée avant comparaison des positions et prise en compte des armes gratuites. Leurs échecs avaient été reproduits sur le commit d’origine ; les règles de production n’ont pas été modifiées pour les faire passer.

```powershell
$rbTests = @(rg --files rumbleball -g '*.test.mjs' | Sort-Object)
node tools/check-rumbleball.mjs --keep-going '--skip=500 matchs' @rbTests
```

Pour les contrôles SQL, installer le moteur de test dans un dossier de sortie jetable, sans ajouter de dépendance au site :

```powershell
npm install --prefix output/rumbleball-db-test --no-save --package-lock=false @electric-sql/pglite@0.5.11
node --max-old-space-size=256 supabase/tests/match-storage.mjs output/rumbleball-db-test/node_modules/@electric-sql/pglite/dist/index.js output/rumbleball-storage-validation.json 16
```

`tools/rumbleball-performance-check.mjs` prend le dossier `rumbleball` d’une archive Git du commit de référence, puis un chemin JSON de sortie facultatif. Il compare intégralement les événements et l’état final, alterne l’ordre des mesures et borne son travail à 55 secondes.

## Activation du backend après le push

Le push publie le code ; il n’applique pas le SQL et ne redéploie pas les Edge Functions. L’activation du stockage séparé est volontairement distincte, afin que les deux lecteurs soient disponibles avant la première conversion.

1. En préparation, appliquer la migration `20261022110000_rumbleball_match_storage.sql`. Elle ajoute les objets Rumbleball sans convertir les états existants, sans modifier Auth ni les données d’autres applications.
2. Déployer **l’API et le worker de ce lot**, en laissant `RB_SPLIT_MATCH_STORAGE` absent ou à `false`. Les nouveaux RPC et colonnes SQL sont nécessaires à ces lecteurs ; la migration doit donc précéder leur déploiement.
3. Une fois les deux lecteurs déployés et les anciennes invocations terminées, définir `RB_SPLIT_MATCH_STORAGE=true` **sur l’API et le worker**. La prochaine écriture d’une ligue la convertit dans la même transaction que ses checkpoints et ses rondes. Une création à révision zéro conserve le chemin initial, puis acquiert le nouveau stockage lors d’une écriture suivante.
4. Contrôler une soirée représentative et les métriques `league.read`, `league.claim`, `league.compute`, `league.projection`, `league.commit` et `command`. Les replays précédents doivent rester consultables et les salaires, revenus et progressions uniques.

Une ligue convertie garde `matchStorage: 2` : remettre le flag à `false` ne la renvoie pas à une ancienne copie. Conserver les nouveaux lecteurs et tables après conversion ; un retour au schéma antérieur nécessite une reconstruction vérifiée. Les clubs et l’historique résumé résident encore dans la ligue, et la capacité de 128 clubs n’est pas validée par ce scénario à 16 clubs.
