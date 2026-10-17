# Rumbleball — 1000 matchs entre stratégies, ouvertures mélangées

Moteur : `ca40ab819521c16a1b93a22665331613449c5083`. Simulation : **299,1 secondes**.

## Protocole

1000 matchs, 500 scénarios joués deux fois avec stratégie et ouverture échangées entre les côtés. Équilibrée, Conservation et Pressing s'affrontent ; aucun match n'oppose une stratégie à elle-même. Les trois duels reçoivent chacun 166 / 167 / 167 scénarios. Le nombre d'apparitions diffère donc légèrement ; les comparaisons utilisent des taux et des moyennes par match.

Les 25 combinaisons d'ouvertures sont toutes utilisées, chacune sur 20 scénarios. Chacune des cinq ouvertures compte 400 apparitions au total. Chaque duel de stratégies rencontre chacune des 25 combinaisons d'ouvertures sur 6 à 7 scénarios. La répartition stratégie–ouverture reste aussi proche que possible ; le détail est donné plus bas. Les deux matchs d'un scénario ont la même graine.

Mêmes profils des deux côtés : Nora (Capitaine/relais), Brique (Bélier/bloqueur), Zip (Escamoteur/porteur), Étau (Bélier/récupérateur), Vigie (Passeur/défenseur). Niveau 1, consignes normales, aucune fatigue ni équipement, aucune progression entre rencontres. Le moteur vérifie les invariants à chaque tour.

## Résultats

| Stratégie | Matchs joués | V | N | D | Victoires brutes | Taux à pondération égale | Dont cinq adversaires KO |
|---|---:|---:|---:|---:|---:|---:|---:|
| Pressing | 666 | 380 | 0 | 286 | 57,1 % | 57,1 % | 131 |
| Équilibrée | 668 | 362 | 0 | 306 | 54,2 % | 54,1 % | 97 |
| Conservation | 666 | 258 | 0 | 408 | 38,7 % | 38,8 % | 48 |

Le taux à pondération égale donne le même poids à chacun des deux adversaires et à chacune des 25 combinaisons d'ouvertures : moyenne de 50 taux de victoire, pour corriger le léger déséquilibre entre sous-groupes. Il n'est calculé que si les 50 sous-groupes sont présents.

La colonne KO compte les victoires à la possession où les cinq adversaires sont KO à la fin. Le moteur n'accorde aucune victoire automatique par KO. Un match alimente les statistiques de ses deux équipes : les apparitions totalisent 2000.

## Ballon et démarquage

| Stratégie | Passes réussies/tentées | Réussite | Passes tentées/match | Préparations | Passes en réaction | Courses de démarquage | Passe après course | Récupérations | Arrachements réussis/tentés |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Pressing | 937/1282 | 73,1 % | 1,92 | 1127 | 906 | 428 | 310 | 2564 | 292/603 |
| Équilibrée | 954/1316 | 72,5 % | 1,97 | 1197 | 982 | 646 | 456 | 2568 | 346/711 |
| Conservation | 796/1139 | 69,9 % | 1,71 | 979 | 612 | 706 | 350 | 2589 | 353/738 |

Les passes incluent les actions directes, les réactions et les suivis de ramassage. Une course de démarquage est un tour affecté au relais avec un déplacement réel. « Passe après course » compte un déclenchement en réaction après ce déplacement, même si le jet échoue. Récupérations = prises hors réception de passe, dont engagement, interception, arrachement et ramassage.

## Choix avec ballon

| Stratégie | Actions avec ballon | Passes directes ou préparations | Part de ces actions |
|---|---:|---:|---:|
| Pressing | 4119 | 1503 | 36,5 % |
| Équilibrée | 3880 | 1531 | 39,5 % |
| Conservation | 3132 | 1506 | 48,1 % |

Actions réellement dépensées par le porteur, après ramassage ou réception le cas échéant. Les passes en réaction ne sont pas comptées une deuxième fois : la préparation a déjà coûté l'action. Cette mesure distingue le choix de jeu avec ballon du volume total de passes, qui dépend aussi des occasions de possession. La possession est reconstruite à partir des événements et vérifiée contre l'état réel après chaque tour.

## Combat

| Stratégie | KO infligés | KO subis | KO infligés/match | Attaques normales/match | Opportunités | Frappes qui touchent | PV retirés/match | Luttes réussies/tentées | Survivants moyens |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Pressing | 2108 | 1756 | 3,17 | 22,6 | 4705 | 54,6 % | 86,5 | 435/952 | 2,36 |
| Équilibrée | 1966 | 1871 | 2,94 | 21,6 | 4598 | 54,4 % | 83,3 | 484/984 | 2,20 |
| Conservation | 1670 | 2117 | 2,51 | 20,6 | 3932 | 53,6 % | 76,7 | 391/799 | 1,82 |

Les PV retirés sont les pertes effectives, après absorption et sans surcompter les dégâts excédant les PV restants. Le taux de frappe inclut les attaques normales et les opportunités.

## Confrontations directes

| Taux de victoire de la ligne contre la colonne | Équilibrée | Conservation | Pressing |
|---|---:|---:|---:|
| Équilibrée | — | 60,2 % (201/334) | 48,2 % (161/334) |
| Conservation | 39,8 % (133/334) | — | 37,7 % (125/332) |
| Pressing | 51,8 % (173/334) | 62,3 % (207/332) | — |

## Stratégies selon l'ouverture

| Stratégie | Ouverture | Matchs joués | Victoires | Dont cinq adversaires KO | Passes réussies/tentées | Courses de démarquage |
|---|---|---:|---:|---:|---:|---:|
| Équilibrée | Fuite sous écran | 134 | 56,7 % (76) | 17 | 219/286 | 135 |
| Équilibrée | Passe en retrait | 134 | 53,0 % (71) | 11 | 193/269 | 127 |
| Équilibrée | Cage mobile | 132 | 50,0 % (66) | 24 | 178/246 | 109 |
| Équilibrée | Double relais sur les ailes | 134 | 55,2 % (74) | 18 | 167/234 | 130 |
| Équilibrée | Pressing d’entrée | 134 | 56,0 % (75) | 27 | 197/281 | 145 |
| Conservation | Fuite sous écran | 134 | 38,1 % (51) | 6 | 139/187 | 118 |
| Conservation | Passe en retrait | 132 | 31,1 % (41) | 9 | 155/229 | 126 |
| Conservation | Cage mobile | 134 | 39,6 % (53) | 9 | 165/231 | 147 |
| Conservation | Double relais sur les ailes | 134 | 35,8 % (48) | 9 | 143/209 | 140 |
| Conservation | Pressing d’entrée | 132 | 49,2 % (65) | 15 | 194/283 | 175 |
| Pressing | Fuite sous écran | 132 | 54,5 % (72) | 24 | 200/261 | 85 |
| Pressing | Passe en retrait | 134 | 52,2 % (70) | 17 | 171/234 | 95 |
| Pressing | Cage mobile | 134 | 62,7 % (84) | 31 | 168/240 | 73 |
| Pressing | Double relais sur les ailes | 132 | 62,9 % (83) | 34 | 210/294 | 85 |
| Pressing | Pressing d’entrée | 134 | 53,0 % (71) | 25 | 188/253 | 90 |

Ces sous-groupes décrivent les interactions observées avec les ouvertures ; leurs adversaires et graines diffèrent. Ils ne suffisent pas à prouver isolément qu'une ouverture cause un meilleur résultat. Les matchs d'une paire partagent la graine et ne doivent pas être considérés comme indépendants.

## Totaux et reproduction

491 victoires à domicile, 509 à l'extérieur, 0 nuls ; 276 victoires avec cinq adversaires KO, 56 prolongations. Rounds moyens : 10,06 ; tours joués moyens : 66,78.

Reproduction : `node tools/rumbleball-strategy-benchmark.mjs --matches 1000 --out rumbleball/playtests/conservation-passing-1000-2026-10-17`, avec les sources de jeu du commit indiqué. Le JSON voisin conserve le plan d'expérience, les empreintes des sources et les 1000 résultats.
