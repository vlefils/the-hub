# Noms complets et portraits — 19 octobre 2026

Tous les joueurs de carrière et des ligues, y compris les premières recrues, utilisent `Prénom "Pseudo" Nom`. Le pool contient **196 608 combinaisons**, réparties en trois ensembles de 65 536 : prénoms féminins avec pseudos féminins, prénoms masculins avec pseudos masculins, et prénoms épicènes avec pseudos neutres.

Les 32 portraits portent une métadonnée explicite `gender` dans le catalogue. Elle correspond aux descriptions d’origine des images livrées, en tenant compte de leur révision actuelle : `female`, `male` ou `neutral` pour les personnages androgynes. La planche existante `output/broadcast-browser-qa/evidence/portraits-v2.png` a été inspectée. Les images restent inchangées.

Le nom est normalisé après attribution du portrait. Un nom déjà conforme au format et au genre reste stable ; les doublons dans le groupe sont évités. L’import valide d’abord les données puis complète l’identité du club et du marché, sans modifier les identifiants, les statistiques ou l’équipement. Tous les anciens formats sont concernés, y compris les noms simples et les anciens noms à deux éléments. Une rencontre déjà commencée ou archivée conserve ses états et noms enregistrés.

En ligne, les noms et portraits sont attribués ensemble à partir du domaine public de la ligue et du membre, sans utiliser la graine secrète des rencontres. La projection et la préparation appliquent la même normalisation ; les nouvelles offres sont accordées à leurs portraits après chaque soirée. Les recrues des adversaires en campagne sont nommées avant d’inscrire leur contrat au journal financier.

Les tests couvrent les accords attendus sur des exemples explicites, 6 144 noms distincts générés, les 32 descriptions de portraits, les collisions, la stabilité d’un nom conforme, la correction après changement de portrait, les anciennes sauvegardes, le gel d’une rencontre commencée et les offres renouvelées en ligne. Les parcours d’interface utilisent le DOM de test et les services réels.

Suite complète : **333 tests réussis, aucun échec**, avec `node --test --test-reporter=spec rumbleball/*.test.mjs rumbleball/online/*.test.mjs`. `git diff --check` sans erreur d’espacement.

Pour appliquer le changement en multijoueur hébergé, redéployer `rumbleball-api` et `rumbleball-worker`. Aucune migration SQL n’est nécessaire.
