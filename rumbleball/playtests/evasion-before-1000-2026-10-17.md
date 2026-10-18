# Rumbleball — 1000 matchs entre stratégies, ouvertures mélangées

Moteur : `d3b17d71d7d5acebf42f5a3aede9ef5f54367f32`. Simulation : **356,9 secondes**.

## Protocole

1000 matchs, 500 scénarios joués deux fois avec stratégie et ouverture échangées entre les côtés. Équilibrée, Conservation et Pressing s'affrontent ; aucun match n'oppose une stratégie à elle-même. Les trois duels reçoivent chacun 166 / 167 / 167 scénarios. Le nombre d'apparitions diffère donc légèrement ; les comparaisons utilisent des taux et des moyennes par match.

Les 25 combinaisons d'ouvertures sont toutes utilisées, chacune sur 20 scénarios. Chacune des cinq ouvertures compte 400 apparitions au total. Chaque duel de stratégies rencontre chacune des 25 combinaisons d'ouvertures sur 6 à 7 scénarios. La répartition stratégie–ouverture reste aussi proche que possible ; le détail est donné plus bas. Les deux matchs d'un scénario ont la même graine.

Mêmes profils des deux côtés : Nora (Capitaine/relais), Brique (Bélier/bloqueur), Zip (Escamoteur/porteur), Étau (Bélier/récupérateur), Vigie (Passeur/défenseur). Niveau 1, consignes normales, aucune fatigue ni équipement, aucune progression entre rencontres. Le moteur vérifie les invariants à chaque tour.

## Résultats

| Stratégie | Matchs joués | V | N | D | Victoires brutes | Taux à pondération égale | Dont cinq adversaires KO |
|---|---:|---:|---:|---:|---:|---:|---:|
| Pressing | 666 | 383 | 0 | 283 | 57,5 % | 57,4 % | 145 |
| Équilibrée | 668 | 337 | 0 | 331 | 50,4 % | 50,6 % | 101 |
| Conservation | 666 | 280 | 0 | 386 | 42,0 % | 42,0 % | 66 |

Le taux à pondération égale donne le même poids à chacun des deux adversaires et à chacune des 25 combinaisons d'ouvertures : moyenne de 50 taux de victoire, pour corriger le léger déséquilibre entre sous-groupes. Il n'est calculé que si les 50 sous-groupes sont présents.

La colonne KO compte les victoires à la possession où les cinq adversaires sont KO à la fin. Le moteur n'accorde aucune victoire automatique par KO. Un match alimente les statistiques de ses deux équipes : les apparitions totalisent 2000.

## Ballon et démarquage

| Stratégie | Passes réussies/tentées | Réussite | Passes tentées/match | Préparations | Passes en réaction | Courses de démarquage | Passe après course | Récupérations | Arrachements réussis/tentés |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Pressing | 1023/1370 | 74,7 % | 2,06 | 1200 | 971 | 440 | 315 | 2583 | 328/626 |
| Équilibrée | 980/1375 | 71,3 % | 2,06 | 1220 | 973 | 631 | 419 | 2588 | 324/696 |
| Conservation | 943/1320 | 71,4 % | 1,98 | 1148 | 729 | 783 | 392 | 2658 | 348/752 |

Les passes incluent les actions directes, les réactions et les suivis de ramassage. Une course de démarquage est un tour affecté au relais avec un déplacement réel. « Passe après course » compte un déclenchement en réaction après ce déplacement, même si le jet échoue. Récupérations = prises hors réception de passe, dont engagement, interception, arrachement et ramassage.

## Choix avec ballon

| Stratégie | Actions avec ballon | Passes directes ou préparations | Part de ces actions |
|---|---:|---:|---:|
| Pressing | 4131 | 1599 | 38,7 % |
| Équilibrée | 3963 | 1622 | 40,9 % |
| Conservation | 3323 | 1739 | 52,3 % |

Actions réellement dépensées par le porteur, après ramassage ou réception le cas échéant. Les passes en réaction ne sont pas comptées une deuxième fois : la préparation a déjà coûté l'action. Cette mesure distingue le choix de jeu avec ballon du volume total de passes, qui dépend aussi des occasions de possession. La possession est reconstruite à partir des événements et vérifiée contre l'état réel après chaque tour.

## Combat

| Stratégie | KO infligés | KO subis | KO infligés/match | Attaques normales/match | Opportunités | Frappes qui touchent | PV retirés/match | Luttes réussies/tentées | Survivants moyens |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Pressing | 2066 | 1793 | 3,10 | 22,2 | 4787 | 54,5 % | 85,6 | 402/895 | 2,31 |
| Équilibrée | 1960 | 1893 | 2,93 | 21,5 | 4648 | 54,4 % | 82,9 | 453/965 | 2,17 |
| Conservation | 1764 | 2104 | 2,65 | 20,3 | 3912 | 54,9 % | 78,0 | 377/770 | 1,84 |

Les PV retirés sont les pertes effectives, après absorption et sans surcompter les dégâts excédant les PV restants. Le taux de frappe inclut les attaques normales et les opportunités.

## Confrontations directes

| Taux de victoire de la ligne contre la colonne | Équilibrée | Conservation | Pressing |
|---|---:|---:|---:|
| Équilibrée | — | 55,7 % (186/334) | 45,2 % (151/334) |
| Conservation | 44,3 % (148/334) | — | 39,8 % (132/332) |
| Pressing | 54,8 % (183/334) | 60,2 % (200/332) | — |

## Stratégies selon l'ouverture

| Stratégie | Ouverture | Matchs joués | Victoires | Dont cinq adversaires KO | Passes réussies/tentées | Courses de démarquage |
|---|---|---:|---:|---:|---:|---:|
| Équilibrée | Fuite sous écran | 134 | 52,2 % (70) | 18 | 194/269 | 115 |
| Équilibrée | Passe en retrait | 134 | 49,3 % (66) | 19 | 206/302 | 152 |
| Équilibrée | Cage mobile | 132 | 52,3 % (69) | 22 | 208/281 | 120 |
| Équilibrée | Double relais sur les ailes | 134 | 54,5 % (73) | 24 | 185/259 | 100 |
| Équilibrée | Pressing d’entrée | 134 | 44,0 % (59) | 18 | 187/264 | 144 |
| Conservation | Fuite sous écran | 134 | 40,3 % (54) | 14 | 180/259 | 182 |
| Conservation | Passe en retrait | 132 | 40,9 % (54) | 9 | 168/221 | 150 |
| Conservation | Cage mobile | 134 | 44,8 % (60) | 16 | 189/286 | 139 |
| Conservation | Double relais sur les ailes | 134 | 47,0 % (63) | 14 | 208/284 | 132 |
| Conservation | Pressing d’entrée | 132 | 37,1 % (49) | 13 | 198/270 | 180 |
| Pressing | Fuite sous écran | 132 | 54,5 % (72) | 26 | 180/244 | 78 |
| Pressing | Passe en retrait | 134 | 59,0 % (79) | 29 | 218/296 | 90 |
| Pressing | Cage mobile | 134 | 58,2 % (78) | 28 | 200/268 | 82 |
| Pressing | Double relais sur les ailes | 132 | 55,3 % (73) | 26 | 187/247 | 78 |
| Pressing | Pressing d’entrée | 134 | 60,4 % (81) | 36 | 238/315 | 112 |

Ces sous-groupes décrivent les interactions observées avec les ouvertures ; leurs adversaires et graines diffèrent. Ils ne suffisent pas à prouver isolément qu'une ouverture cause un meilleur résultat. Les matchs d'une paire partagent la graine et ne doivent pas être considérés comme indépendants.

## Totaux et reproduction

517 victoires à domicile, 483 à l'extérieur, 0 nuls ; 312 victoires avec cinq adversaires KO, 55 prolongations. Rounds moyens : 10,06 ; tours joués moyens : 66,52.

Reproduction : `node tools/rumbleball-strategy-benchmark.mjs --matches 1000 --seed-prefix evasion-holdout-2026-10-17-a --source-ref d3b17d71d7d5acebf42f5a3aede9ef5f54367f32 --out rumbleball/playtests/evasion-before-1000-2026-10-17`, avec les sources de jeu du commit indiqué. Le JSON voisin conserve le plan d'expérience, les empreintes des sources et les 1000 résultats.
