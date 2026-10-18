# Préparation et direction graphique desktop — 18 octobre 2026

## Intention et résultat

Reprendre la hiérarchie de la référence « Broadcast sportif » : en-tête compact, navigation visible, bandeau de rencontre, terrain central, banc adjacent et portraits lisibles. Le terrain reçoit une surface SVG texturée. En préparation, les joueurs sont représentés par leurs portraits dans des bulles numérotées ; les personnages apparaissent pendant les rencontres. Les règles restent conservées.

La sélection d’un joueur sur le terrain ouvre sa fiche à droite sans déplacer les autres. Elle contient ses caractéristiques, sa progression, sa fatigue, son équipement et un achat avec aperçu des effets et du solde. Le rôle et la consigne restent sous sa carte dans la composition. Un remplaçant peut être consulté et équipé avant d’entrer, en conservant la place précédemment sélectionnée.

Le glisser-déposer déplace ou échange un titulaire, fait entrer un remplaçant sur une case, ou échange un titulaire avec une carte du banc. Le clic et le clavier restent disponibles. Le verrouillage interdit les changements de préparation.

En solo, Équipe ouvre directement la préparation et Effectif reste accessible dans la navigation principale. Les remplacements par sélecteur sont regroupés dans la fiche. Les explications détaillées du plan et de l’ouverture sont réunies dans « Comprendre la préparation ». En ligne, l’annulation et son explication sont regroupées avec l’enregistrement.

## Architecture

- `studio.css` : thème commun et adaptation des proportions selon la largeur et la hauteur disponibles.
- `workspace-header.mjs` : déplacement des contrôles existants dans les emplacements de l’en-tête, sans duplication ; affichage intégré conservé hors de ce shell.
- `player-shop.mjs` : achat compact partagé par les deux modes, avec refus du matériel déjà porté, des achats sans fonds et des modifications verrouillées ; remplacement d’implant explicite.
- `deployment-ui.mjs` : interactions activées pour la préparation, avec comportement historique conservé pour l’exhibition et les autres intégrations.

Ce lot ne modifie ni le schéma Supabase, ni les règles, ni les Edge Functions. Aucun déploiement Supabase supplémentaire n’est nécessaire pour ces modifications d’interface.

## Vérification

- Suite complète pendant la passe : **320 tests réussis, aucun échec**.
- Après les dernières modifications du solo et de la navigation : **54 tests ciblés réussis, aucun échec**. Ils couvrent carrière, préparation, équipement, ouvertures, déploiement et ligues en ligne.
- Après le passage aux portraits en bulles : **70 tests ciblés réussis, aucun échec**, avec la couverture de l’apparence et de la lecture des rounds. Le portrait reste lié au bon joueur après déplacement ; une image absente laisse ses initiales. Le terrain de match de l’exhibition est masqué avant le lancement, puis les personnages sont affichés au coup d’envoi.
- Couverture ajoutée : clic de sélection sans déplacement, échanges avec cinq positions uniques, dépôt depuis le banc en solo et en ligne, refus pendant le verrouillage, achat pour un remplaçant sans changer la composition, conservation de la place cible après achat et refus d’un achat identique.
- `git diff --check` : aucune erreur d’espacement.

## Inspection du navigateur

Rendu vérifié en 1920 × 1080 et 2560 × 1440, puis absence de débordement horizontal à 1366 et 390 pixels. Le solo a aussi été inspecté avec un nom de club long. À 1920 × 1080, les cinq titulaires, le banc, le terrain et le bouton de lancement sont visibles ensemble ; l’achat dans la fiche reste visible. La colonne de fiche possède son propre défilement pour ses actions secondaires.

La navigation déplacée dans l’en-tête et l’accès direct à l’effectif fonctionnent dans le véritable écran solo. Aucun avertissement ni erreur JavaScript observé pendant ces contrôles.

Dans une ligue locale utilisant le service réel avec un stockage éphémère en mémoire, l’achat fictif autorisé d’un plastron pour Brique a été vérifié dans le navigateur : **720 → 620 chromas**, **29 → 32 PV**, équipement porté et composition inchangée. Cette démonstration n’appelle pas Supabase et ne comporte aucun paiement. Après ce test, le refus d’acheter à nouveau un équipement déjà porté a été ajouté et vérifié automatiquement.

Le glisser-déposer est couvert par les tests d’événements et d’intégration ; le geste de souris complet n’a pas été exécuté dans le navigateur d’automatisation. Les contrôles alternatifs et la sélection des pions ont été utilisés dans le navigateur.

Captures locales dans `output/rumbleball-studio-2026-10-18/` : `portraits-solo-1920.jpg` pour la préparation finale et `characters-in-match.jpg` pour les personnages après lancement. Les captures `solo-1920.jpg`, `desktop-1920.jpg`, `desktop-2560.jpg` précèdent le remplacement des pions par les bulles. `purchase-confirmed.jpg` précède aussi les finitions de densité et le déplacement de l’annulation.

Lot limité à l’interface et destiné à la publication du frontend.
