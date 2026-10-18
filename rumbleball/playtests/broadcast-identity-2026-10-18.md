# Validation de l’identité Broadcast sportif — 18 octobre 2026

## Périmètre livré

Direction commune solo, exhibition et ligues : bleu nuit, orange sportif, cobalt, Rajdhani et Space Grotesk. Préparation centrée sur le terrain complet, avec effectif et contexte de ligue. Les commandes existantes de jeu, animations, vitesses et journaux sont conservées.

32 portraits illustrés : quatre profils classiques, seize visages cyberpunk et douze personnages décalés. Peau, cheveux et principaux traits du visage sont repris sur les pions. Ces traits ne donnent aucun bonus. Seize emblèmes composés avec la couleur du club, huit équipements et un bandeau d’arène complètent la banque. Sources PNG conservées localement ; prompts et empreintes dans `assets/broadcast/generation.json`.

## Vérifications automatisées

- Suite complète : **303 tests réussis, zéro échec**, en 149 secondes, avant la dernière révision des illustrations.
- Après la révision cyberpunk : **46 tests ciblés réussis**, couvrant catalogue, apparence, préparation, carrière et déploiement. Vérification Deno des deux Edge Functions réussie.
- Neutralité de la simulation : mêmes événements, jets et résultat avec ou sans identifiants cosmétiques.
- Anciennes sauvegardes acceptées, identités conservées après recrutement, achat et export/import ; configuration des matchs commencés préservée.
- En ligne : choix préparés privés, annulation, verrouillage, identités figées et absence de dépendance à la graine secrète.
- Préservation des saisies après rafraîchissement, achat et erreur réseau ; enregistrement réussi libérant le rafraîchissement normal.
- Fichiers du catalogue présents ; portrait SVG de secours en cas d’image indisponible.

## Inspection dans le navigateur

Sur serveur local isolé, sans mutation de comptes ou de ligues de production :

- Formats 360, 390, 768, 960, 1 024, 1 280, 1 440, 1 920 et 2 560 px ; aucune largeur de page excessive. Le terrain possède un défilement horizontal local sur téléphone pour conserver des cases utilisables.
- Trois colonnes dès 1 440 px, deux dès 1 024 px, sous-vues Composition/Tactique sur téléphone ; textes secondaires mesurés à 14 px minimum.
- Noms longs de clubs et de joueurs, détails de joueur, changement de stratégie et de blason, enregistrement mobile et retour à la préparation confirmée.
- Connexion réelle inspectée sans saisir de compte ; ligue de démonstration utilisant les véritables composants et règles avec un service en mémoire.
- Carrière locale : création, six recrutements, préparation, lancement, pause, match terminé et bilan. Solde vérifié : 600 − 90 de salaires + 350 de prime = 860 chromas.
- Bouton de lancement d’exhibition visible sur téléphone.

Les captures et relevés de géométrie sont conservés dans `output/broadcast-browser-qa/evidence/`. Le test à 960 px couvre le repli de mise en page correspondant à un écran de 1 920 px à 200 %. Le zoom natif du navigateur n’a pas pu être confirmé ; il reste une vérification manuelle distincte. Aucun nouveau test de soirée réelle à 20 h ni de nouveau compte en production n’a été réalisé dans cette passe graphique.

## Compatibilité de publication

Aucune nouvelle table Supabase ni migration de base. Les identifiants sont optionnels et validés côté serveur. Les deux Edge Functions doivent être publiées avant le front, car elles partagent le catalogue et la projection des clubs. Les règles sportives et économiques restent celles de chaque mode.
