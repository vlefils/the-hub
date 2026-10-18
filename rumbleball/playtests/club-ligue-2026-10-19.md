# Club et Ligue — 19 octobre 2026

## Parcours

La préparation solo et multijoueur utilise deux boutons principaux : **Club** et **Ligue**. Club regroupe le terrain, les titulaires, le banc et la fiche du joueur. Les anciennes pages Effectif et Équipement sont supprimées, ainsi que l’ancien tableau de bord du club. Ligue rassemble le classement et le programme ; en ligne, le direct et les replays sont dans cette même vue. Le bilan solo reste accessible dans une modale après une rencontre, avec la suite de saison disponible depuis Club.

Sous les titulaires, une carte **Recruter un joueur** ouvre un dialogue natif. Les offres restent disponibles après un contrat ; la recrue rejoint le banc sans modifier les cinq titulaires. La fermeture avec Échap ou le bouton Fermer rend le focus au déclencheur. Les erreurs des actions sont affichées dans le dialogue. Les limites de places, les fonds et le verrouillage restent appliqués.

Le banc occupe une zone dédiée juste à côté du terrain, avec les portraits circulaires des remplaçants et leur action Faire entrer. La sélection d’un joueur ouvre systématiquement sa fiche à droite. Rôle et consigne sont dans cette fiche, avec statistiques, progression, matériel porté et achat. Un composant partagé conserve le transfert gratuit, la mise en réserve et la revente des protections malgré la suppression de la page Équipement.

Les listes natives utilisent des couleurs de texte et de fond explicites en thème sombre. La fiche droite suit le défilement normal de la page : aucune hauteur maximale ni barre de défilement interne. Le banc passe sous le terrain sur petit écran ; la navigation reste constituée de deux boutons.

## Vérification

- Suite complète : **323 tests réussis, aucun échec**, avec `node --test --test-reporter=spec rumbleball/*.test.mjs rumbleball/online/*.test.mjs`.
- Couverture des deux vues, de la position des contrôles tactiques, du recrutement en dialogue, de l’arrivée sur le banc, des transferts de protection, de l’annulation de préparation et de la lecture des replays.
- Vérification du solo réel à 1920 × 1080 ; ligue locale avec huit joueurs, dont trois remplaçants, à 1920 × 1080 et 2560 × 1440.
- Aucun débordement horizontal observé à 1366 et 390 pixels. Dialogue contenu dans la largeur mobile ; listes natives avec texte clair sur fond sombre. Fiche droite avec `overflow: visible` et sans hauteur maximale.
- Ouverture, filtrage et fermeture du recrutement vérifiés dans le navigateur ; Échap restitue le focus. Aucun avertissement ou erreur JavaScript observé.
- Les contrats et achats sont vérifiés automatiquement sur des données de test ; aucun nouveau contrat ni achat n’a été effectué sur la carrière réelle pendant cette passe. Les interactions de dépôt restent couvertes par les tests d’intégration.
- `git diff --check` sans erreur d’espacement.

Captures locales : `output/rumbleball-club-ligue-2026-10-19/club-solo-1920.jpg`, `recruitment-solo-1920.jpg`, `online-8-players-2560.jpg` et `mobile-390.jpg`. La démonstration multijoueur utilise le service local avec stockage éphémère, sans appel à Supabase.

Cette modification concerne le frontend. Aucune migration SQL ni mise à jour des Edge Functions n’est nécessaire.
