# Dotation personnelle illimitée — 20 octobre 2026

Chaque personnage reçoit par défaut un marteau d’arène s’il est Bélier, sinon un tonfa. Candidats, nouvelles recrues, titulaires, remplaçants et bots utilisent la même dotation. Les cinq modèles gratuits peuvent être sélectionnés à volonté pour chaque joueur, sans stock partagé, transfert, dépense ni nouvelle transaction.

La sélection est conservée dans `player.issuedWeapons` (main droite/main gauche). Le stock du club contient les objets achetés. Remplacer un objet payé par une dotation gratuite le remet en réserve. Les deux mains, armes à deux mains et bouclier unique restent cohérents entre aperçu, équipement visible et moteur. Un joueur sans arme offensive utilise ses poings ; aucun ancien dégât de marteau ne subsiste derrière un emplacement vide.

Les anciennes copies gratuites sont converties à la lecture et retirées du stock partagé. Les choix de mains déjà équipées sont conservés. Les configurations et états des rencontres enregistrées restent inchangés. Les imports valident les dotations, les identifiants et les collisions avec les objets achetés.

140 tests ciblés réussis via `tools/check-rumbleball.mjs`, séquentiels et bornés à 256 Mo :

- 10 nouveaux tests `issued-weapons.test.mjs` : équipement initial, vingt tonfas simultanés, absence de transfert/comptabilité, remplacement du matériel payant, prévisions, bouclier sans marteau caché, migration, validation, modale, brouillon multijoueur.
- 19 équipement ; 19 UI carrière ; 16 UI multijoueur ; 6 inspecteur ; 10 carrière longue ; 7 UI carrière longue ; 12 progression ; 8 identités ; 7 apparence ; 9 lecture du match ; 4 application.
- 7 tests filtrés de `online/league.test.mjs` et 6 de `career.test.mjs` sur préparation, équipement, bots et sauvegarde.

La livraison associe l’interface aux fonctions `rumbleball-api` et `rumbleball-worker`, pour partager les mêmes choix de dotation entre client et serveur. Aucune migration SQL.
