# Arène et vitesse des Béliers — 20 octobre 2026

Les joueurs gérés utilisent une vitesse de classe : 9 m pour les Béliers, Capitaines et Passeurs, 12 m pour les Escamoteurs avant progression. Les deux anciens profils de Bélier avaient respectivement 7,5 et 9 m. La fatigue et le matériel continuent à modifier la vitesse. Les règles v8 normalisent les nouveaux matchs ; les versions précédentes et les effectifs déjà figés gardent leurs valeurs, y compris après export/import.

Sur ordinateur (largeur >= 1100 px), le match utilise les cinq joueurs à gauche et à droite, le terrain métallique au centre et les commandes et le journal dessous. Les conteneurs transmettent la hauteur disponible au terrain ; le texte du journal possède son propre défilement. Les fiches, règles et résultats sont dans des dialogues. Les replays utilisent la même disposition. Pendant le direct multijoueur, classement, programme et replays se consultent dans une fenêtre séparée.

94 tests ciblés réussis, exécutés séquentiellement avec le lanceur borné `tools/check-rumbleball.mjs` (256 Mo par processus, priorité abaissée, délai maximal de 60 s par fichier) :

- `movement.test.mjs` : 4
- `match-workspace.test.mjs` : 4
- `round-ui.test.mjs` : 9
- `app.test.mjs` : 4
- `career-ui.test.mjs` : 19
- `long-career-ui.test.mjs` : 7
- `equipment.test.mjs` : 19
- `identity.test.mjs` : 8
- `online/broadcast-ui.test.mjs` : 16
- `online/replay.test.mjs` : 2
- `engine.test.mjs` : 2, filtrés sur initialisation et symétrie des profils.

Ces tests vérifient la structure DOM, les interactions, le focus après actualisation, le dernier geste avant résultat, la sauvegarde, les anciens profils et les images de replay. Ils ne mesurent pas les dimensions réelles dans un navigateur.

Le contrôle visuel local n’a pas abouti : la revue automatique a refusé la capture de la fenêtre Chrome hors tâche, puis Computer Use s’est arrêté faute de pouvoir déterminer l’URL du nouvel onglet dédié. Le serveur de démonstration sur 127.0.0.1:8768 a été arrêté. Aucun tunnel n’a été ouvert. Le cadrage réel et l’absence de débordement restent à confirmer visuellement.

Lors du contrôle initial : `rumbleball-api` v17 et `rumbleball-worker` v15 déployés et ACTIVE. Projection JSON mode/division : HTTP 200 ; appel API anonyme : HTTP 401. Aucune migration SQL. La dotation personnelle, ajoutée ensuite, est documentée dans `issued-weapons-2026-10-20.md` et nécessite la livraison conjointe de l’interface et des fonctions.
