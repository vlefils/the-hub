# Rumbleball — 1000 matchs entre stratégies, ouvertures mélangées

Moteur : `de5e2fea6b1b43e5f19a322afef4ce86120f8f41`. Simulation : **257,0 secondes**.

## Protocole

1000 matchs, 500 scénarios joués deux fois avec stratégie et ouverture échangées entre les côtés. Équilibrée, Conservation et Pressing s'affrontent ; aucun match n'oppose une stratégie à elle-même. Les trois duels reçoivent chacun 166 / 167 / 167 scénarios. Le nombre d'apparitions diffère donc légèrement ; les comparaisons utilisent des taux et des moyennes par match.

Les 25 combinaisons d'ouvertures sont toutes utilisées, chacune sur 20 scénarios. Chacune des cinq ouvertures compte 400 apparitions au total. Chaque duel de stratégies rencontre chacune des 25 combinaisons d'ouvertures sur 6 à 7 scénarios. La répartition stratégie–ouverture reste aussi proche que possible ; le détail est donné plus bas. Les deux matchs d'un scénario ont la même graine.

Mêmes profils des deux côtés : Nora (Capitaine/relais), Brique (Bélier/bloqueur), Zip (Escamoteur/porteur), Étau (Bélier/récupérateur), Vigie (Passeur/défenseur). Niveau 1, consignes normales, aucune fatigue ni équipement, aucune progression entre rencontres. Le moteur vérifie les invariants à chaque tour.

## Résultats

| Stratégie | Matchs joués | V | N | D | Victoires brutes | Taux à pondération égale | Dont cinq adversaires KO |
|---|---:|---:|---:|---:|---:|---:|---:|
| Pressing | 666 | 377 | 0 | 289 | 56,6 % | 56,6 % | 128 |
| Équilibrée | 668 | 359 | 0 | 309 | 53,7 % | 53,5 % | 101 |
| Conservation | 666 | 264 | 0 | 402 | 39,6 % | 39,9 % | 57 |

Le taux à pondération égale donne le même poids à chacun des deux adversaires et à chacune des 25 combinaisons d'ouvertures : moyenne de 50 taux de victoire, pour corriger le léger déséquilibre entre sous-groupes. Il n'est calculé que si les 50 sous-groupes sont présents.

La colonne KO compte les victoires à la possession où les cinq adversaires sont KO à la fin. Le moteur n'accorde aucune victoire automatique par KO. Un match alimente les statistiques de ses deux équipes : les apparitions totalisent 2000.

## Ballon et démarquage

| Stratégie | Passes réussies/tentées | Réussite | Passes tentées/match | Préparations | Passes en réaction | Courses de démarquage | Passe après course | Récupérations | Arrachements réussis/tentés |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Pressing | 965/1309 | 73,7 % | 1,97 | 1131 | 921 | 427 | 318 | 2507 | 307/613 |
| Équilibrée | 983/1353 | 72,7 % | 2,03 | 1235 | 1003 | 675 | 467 | 2527 | 342/650 |
| Conservation | 709/1037 | 68,4 % | 1,56 | 826 | 597 | 527 | 306 | 2397 | 343/715 |

Les passes incluent les actions directes, les réactions et les suivis de ramassage. Une course de démarquage est un tour affecté au relais avec un déplacement réel. « Passe après course » compte un déclenchement en réaction après ce déplacement, même si le jet échoue. Récupérations = prises hors réception de passe, dont engagement, interception, arrachement et ramassage.

## Combat

| Stratégie | KO infligés | KO subis | KO infligés/match | Attaques normales/match | Opportunités | Frappes qui touchent | PV retirés/match | Luttes réussies/tentées | Survivants moyens |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Pressing | 2089 | 1765 | 3,14 | 22,6 | 4709 | 54,1 % | 85,9 | 461/1003 | 2,35 |
| Équilibrée | 1941 | 1897 | 2,91 | 21,4 | 4687 | 54,0 % | 82,4 | 475/984 | 2,16 |
| Conservation | 1705 | 2073 | 2,56 | 20,8 | 4018 | 53,5 % | 77,5 | 410/873 | 1,89 |

Les PV retirés sont les pertes effectives, après absorption et sans surcompter les dégâts excédant les PV restants. Le taux de frappe inclut les attaques normales et les opportunités.

## Confrontations directes

| Taux de victoire de la ligne contre la colonne | Équilibrée | Conservation | Pressing |
|---|---:|---:|---:|
| Équilibrée | — | 59,3 % (198/334) | 48,2 % (161/334) |
| Conservation | 40,7 % (136/334) | — | 38,6 % (128/332) |
| Pressing | 51,8 % (173/334) | 61,4 % (204/332) | — |

## Stratégies selon l'ouverture

| Stratégie | Ouverture | Matchs joués | Victoires | Dont cinq adversaires KO | Passes réussies/tentées | Courses de démarquage |
|---|---|---:|---:|---:|---:|---:|
| Équilibrée | Fuite sous écran | 134 | 53,7 % (72) | 19 | 226/294 | 139 |
| Équilibrée | Passe en retrait | 134 | 50,7 % (68) | 12 | 187/264 | 125 |
| Équilibrée | Cage mobile | 132 | 50,8 % (67) | 21 | 191/260 | 120 |
| Équilibrée | Double relais sur les ailes | 134 | 56,7 % (76) | 20 | 180/248 | 147 |
| Équilibrée | Pressing d’entrée | 134 | 56,7 % (76) | 29 | 199/287 | 144 |
| Conservation | Fuite sous écran | 134 | 35,8 % (48) | 7 | 97/136 | 71 |
| Conservation | Passe en retrait | 132 | 36,4 % (48) | 14 | 175/262 | 130 |
| Conservation | Cage mobile | 134 | 40,3 % (54) | 12 | 150/218 | 111 |
| Conservation | Double relais sur les ailes | 134 | 41,0 % (55) | 7 | 121/178 | 96 |
| Conservation | Pressing d’entrée | 132 | 44,7 % (59) | 17 | 166/243 | 119 |
| Pressing | Fuite sous écran | 132 | 54,5 % (72) | 25 | 206/269 | 83 |
| Pressing | Passe en retrait | 134 | 56,0 % (75) | 14 | 189/248 | 92 |
| Pressing | Cage mobile | 134 | 60,4 % (81) | 33 | 170/233 | 70 |
| Pressing | Double relais sur les ailes | 132 | 57,6 % (76) | 29 | 213/298 | 90 |
| Pressing | Pressing d’entrée | 134 | 54,5 % (73) | 27 | 187/261 | 92 |

Ces sous-groupes décrivent les interactions observées avec les ouvertures ; leurs adversaires et graines diffèrent. Ils ne suffisent pas à prouver isolément qu'une ouverture cause un meilleur résultat. Les matchs d'une paire partagent la graine et ne doivent pas être considérés comme indépendants.

## Totaux et reproduction

495 victoires à domicile, 505 à l'extérieur, 0 nuls ; 286 victoires avec cinq adversaires KO, 58 prolongations. Rounds moyens : 10,06 ; tours joués moyens : 67,03.

Reproduction : `node tools/rumbleball-strategy-benchmark.mjs --matches 1000 --out rumbleball/playtests/strategies-mixed-openings-1000-2026-10-17`, avec les sources de jeu du commit indiqué. Le JSON voisin conserve le plan d'expérience, les empreintes des sources et les 1000 résultats.
