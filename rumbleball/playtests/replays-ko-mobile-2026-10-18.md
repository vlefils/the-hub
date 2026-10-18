# Replays, KO et composition mobile — 18 octobre 2026

## Périmètre

- Replays des rencontres de ligue terminées : images archivées, lecture, pause à la fin du round courant, vitesses ×1/×2/×4/×8, retour au début et parcours des fins de round. Lecture disponible pendant le verrouillage, sans recalcul de match ni récompense.
- Règles v6 : une équipe entièrement KO perd immédiatement. Les rencontres v2 à v5 commencées conservent leurs règles. Les résultats anticipés restent sauvegardables en carrière ; le bilan attend la fin de l’animation du dernier KO.
- Rôles et consignes sous le joueur sélectionné en composition solo et multijoueur. Accès à l’équipement du même joueur.
- Navigation mobile visible : Équipement en solo et en ligne, Replays en ligne. Champs tactiques solo sur une colonne sur petit écran.

## Contrôles automatiques

```sh
node --test --test-reporter=spec rumbleball/*.test.mjs rumbleball/online/*.test.mjs
node supabase/tests/permissions.mjs .local/multiplayer-validation/node_modules/@electric-sql/pglite/dist/index.js
deno check --no-lock supabase/functions/rumbleball-api/index.ts supabase/functions/rumbleball-worker/index.ts
```

Résultats : **316 tests réussis, aucun échec**. Après les derniers ajustements de chargement et de défilement, les huit tests ciblés du lecteur et de la composition en ligne passent également. PostgreSQL vérifie le règlement et l’archivage dans la même transaction, le backfill idempotent, les marqueurs d’historique après remplacement de soirée, les conflits de révision, l’absence de réécriture des archives et les permissions. Les deux fonctions passent la vérification Deno.

Les cas KO couvrent les deux équipes, quatre joueurs KO sans élimination, le dernier KO pendant une attaque, l’absence d’action supplémentaire après la victoire, le nul si aucune équipe ne reste en jeu, l’export/import du résultat anticipé et son animation différée. Les replays sont contrôlés après la soirée suivante, avec refus des non-membres et des rencontres futures, suppression des graines privées et absence de mutation de ligue.

## Contrôles dans le navigateur

Serveur statique local et vraie interface. La ligue de démonstration utilise deux clubs synthétiques et les véritables transitions, moteur, service et lecteur ; les réponses Auth et le stockage sont locaux en mémoire. Aucune donnée de production modifiée.

- Multijoueur : 360 × 800 et 390 × 844, noms de clubs longs ; les six onglets restent visibles et aucun débordement horizontal n’est détecté.
- Composition : changement de joueur, contrôles sous sa ligne, fiche accessible et lien d’équipement pointant sur le bon joueur.
- Replay : avance d’un round, lecture à ×8, curseur jusqu’au résultat, journal et retour. Le match de démonstration se termine par élimination au round 9 ; le bilan affiche cinq KO adverses et la victoire immédiate.
- Ordinateur : lecteur à 1280 × 960, commandes, terrain et journal visibles.
- Solo : 390 × 844, réglages de Brique sous sa ligne sur toute la largeur, puis ouverture de son équipement. Les cinq onglets de gestion restent visibles. Aucun avertissement ni erreur JavaScript relevé pendant ces parcours.

Captures locales et journal de tests : `output/rumbleball-batch-2026-10-18/` (non versionné).

## Publication et limites

Les contrôles décrits dans ce rapport sont **locaux**. Le propriétaire a ensuite confirmé l’application de `supabase/migrations/20261018210000_rumbleball_replays.sql` et le déploiement réussi de `rumbleball-api` et `rumbleball-worker` sur le projet existant. La publication des fichiers du site complète ce batch. Aucune nouvelle soirée hébergée n’a été utilisée pour valider ces changements.

La migration récupère les images de la dernière soirée conservée et marque leur disponibilité dans l’historique avec une nouvelle révision. Les images des soirées déjà remplacées avant l’archivage restent indisponibles ; l’interface le précise. Les nouvelles archives persistent au changement de soirée. La pause rejoint la fin du round déjà calculé, comme le lecteur de rencontre existant.
