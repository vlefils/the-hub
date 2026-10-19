# Caractéristiques et progression — validation locale du 19 octobre 2026

## Comportement livré

- Chaque joueur et chaque offre reçoit une fois cinq scores totalisant 59, de 8 à 15, triés par priorité de classe. Le tirage possède son domaine de graine et ne consomme aucun jet de match.
- Les offres initiales et la modale de recrutement affichent les scores, modificateurs, maîtrise, récupération et statistiques de jeu avant tout contrat.
- Niveaux 1–12 ; maîtrise +2/+3/+4/+5 aux niveaux 1/4/7/10. Les paliers d’amélioration du livre sont 3/6/9/12 : deux +1 ou un +2, plafond 20.
- Les points en attente sont signalés sur les titulaires et les remplaçants. La fiche droite propose les deux choix et l’aperçu de leurs effets avant validation. Un joueur humain conserve le choix de tous ses paliers ; les clubs IA les attribuent par priorité de classe.
- Les compétences entraînées et l’attaque ajoutent la maîtrise au modificateur pertinent. PV de Brute/Runner/Gâchette, CA sans armure et DD de percussion suivent les formules communes du livre. Les réserves restent des adaptations sportives, désormais calculées avec Constitution, Esprit ou Charisme et maîtrise ; leurs formules sont dans le README.
- Constitution : récupération du banc `max(1, 3 + mod. CON)` par journée. Les augmentations de Constitution recalculent les PV de tous les niveaux.
- Plastron : +1 CA ; armure renforcée : +2 CA et −1,5 m. Aucun gain de PV par armure.
- En ligne, `advance` contrôle les points côté serveur, conserve les autres saisies locales et s’intègre à la préparation annulable avant 20 h. Une annulation restitue les points disponibles, sans ajouter de palier.

## Sauvegardes et compatibilité

Les bases et augmentations sont enregistrées séparément. L’import refuse les scores hors limites, les totaux autres que 59, les paliers précoces ou répétés, les caractéristiques inconnues et les dépassements de 20. Les anciens joueurs reçoivent un tirage déterministe ; leurs points humains débloqués restent à distribuer.

Les configurations et états de rencontres commencées ne sont pas recompilés. Les profils dépourvus des nouveaux champs gardent leurs anciennes réserves et leur DD 13 ; leur version de règles et leur hasard restent inchangés. Les profils prédéfinis d’Exhibition restent indépendants. Le prochain match de carrière utilise les nouvelles valeurs.

Le stockage utilise les JSON existants, sans migration SQL. La publication nécessite les fichiers statiques et le redéploiement de `rumbleball-api` et `rumbleball-worker`.

## Vérifications

`node --test --test-reporter=spec rumbleball/*.test.mjs rumbleball/online/*.test.mjs` : **353 tests réussis**, aucun échec. Les dernières finitions de formulaire sont aussi vérifiées par 40 tests ciblés de développement/interface. Les 12 tests de ligue incluent un contrôle supplémentaire de récupération en ligne : Constitution 8 récupère 2, Constitution 15 récupère 5. Ce dernier contrôle porte la suite disponible à 354 tests.

Couverture ajoutée : 10 000 tirages sur les cinq profils, diversité et priorités, absence de nouveau tirage au contrat/rechargement, seuils de niveau et maîtrise, valeurs dérivées connues, réserves initialisées dans le moteur, CA sans PV, récupération et PV rétroactifs, deux formes d’amélioration, plafond et validation de charges mal formées, copie immuable, migration d’une rencontre figée et reprise identique.

Parcours UI : caractéristiques avant achat, attribution à un remplaçant sans toucher la composition, aperçu Constitution/PV/récupération, échec de stockage conservant la dernière sauvegarde puis réessai, plafond 20, lecture seule en match, attribution en ligne sans effacer une tactique non enregistrée, annulation de préparation.

L’audit de vingt journées vérifie désormais aussi la stabilité des bases IA et l’attribution de tous les paliers débloqués. Un scénario distinct doté d’un budget suffisant vérifie les achats d’implants sans consommer la réserve des prochains salaires ; l’audit ordinaire ne suppose pas qu’un club puisse toujours financer un implant.

Limite : le DOM de test valide les interactions, pas le rendu. L’inventaire Computer Use renvoie aucun navigateur disponible ; aucune validation visuelle supplémentaire n’est revendiquée.
