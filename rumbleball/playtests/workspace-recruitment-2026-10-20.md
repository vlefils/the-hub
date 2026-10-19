# Workspace et recrutement multijoueur — 20 octobre 2026

## Structure et usage

- Identité et finances regroupées dans le bandeau ; navigation Club/Ligue visible.
- Sauvegarde dans une fenêtre distincte, sans agrandir le bandeau ; retour du focus au bouton d’ouverture.
- Terrain au centre, banc et tactiques dans la colonne adjacente, actions de lancement toujours accessibles.
- La hauteur est répartie depuis le shell. Les listes longues et les panneaux du joueur défilent localement.
- Vérification navigateur avec dix joueurs, un bilan disponible et des points de progression : pas de débordement global à 1920 × 1080, 1536 × 864 et 1280 × 720. Club et Ligue contrôlés ; mobile 390 px sans débordement horizontal.
- Multijoueur : banc, tactiques et validation accessibles à 1280 × 720, y compris après enregistrement avec l’action d’annulation.

## Parcours multijoueur

- Nouveau lobby sans effectif humain imposé et sans éditeur de composition ; explication des étapes, invitation et bots.
- Le créateur lance la saison avec un premier horaire futur saisi en heure de Paris.
- Journée 1 : choix des candidats et de leurs caractéristiques, cinq joueurs minimum, budget de 2 400 chromas, contrats validés ensemble. Les cinq premiers sélectionnés composent la première équipe.
- Aucun salaire ni match avant la confirmation de tous les effectifs. Si l’horaire est dépassé, la première soirée démarre après la dernière confirmation ; les journées suivantes restent à 20 h à Paris.
- Les anciens salons encore en attente rouvrent le recrutement au lancement, avec 2 400 chromas. Les saisons déjà lancées conservent leurs joueurs et leur progression.
- Parcours navigateur réel avec données fictives en mémoire : ajout d’un bot, horaire à 21 h 15, choix de six recrues, 1 800 chromas débités et 600 restants, préparation et enregistrement.

## Vérification sans surcharge

- 95 tests ciblés distincts réussis, dont les transitions serveur, l’isolation des préparations, les horaires été/hiver, les bots, les replays, les playoffs et les actions solo.
- API et worker vérifiés avec Deno.
- Les assertions de parenté DOM passent par des booléens ; la représentation des éléments de test est compacte.
- `node tools/check-rumbleball.mjs rumbleball/fichier.test.mjs` exécute les fichiers successivement, sans sous-processus de test supplémentaire, avec un plafond V8 de 256 Mo, une priorité réduite et une limite de 60 secondes par fichier. Une interruption arrête le test courant.
- La batterie générale de 500 simulations n’a pas été relancée. Aucun compte Auth ni aucune partie réelle n’ont été créés ou modifiés pour ce contrôle visuel.

Le changement utilise le JSON de ligue existant ; aucune migration SQL n’est nécessaire. L’API et le worker doivent être déployés ensemble.
