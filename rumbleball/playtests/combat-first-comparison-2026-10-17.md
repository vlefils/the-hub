# Combat puis ballon — comparaison du 17 octobre 2026

Deux séries de 1 000 matchs opposent l’ancienne IA (`514181f`) à la nouvelle (`b8276fa`), avant puis après l’ajout d’un tempo de match. La première série confirme le résultat du premier échantillon de 100 matchs. La variante inverse nettement l’avantage sur ce protocole.

| Nouvelle IA opposée à l’ancienne | Victoires | Défaites | Nuls | Taux de victoire | Intervalle à 95 % |
| --- | ---: | ---: | ---: | ---: | --- |
| Avant le changement de tempo | 400 | 600 | 0 | 40,0 % | 37,1–42,9 % |
| Combat puis ballon | 829 | 171 | 0 | 82,9 % | 80,6–85,2 % |

Gain de **42,9 points**, avec un intervalle avant/après à 95 % de **39,2 à 46,6 points**. Test de permutation par paire : p ≈ 1,34 × 10⁻⁷² pour le gain. Les deux matchs d’une même graine sont gardés ensemble, aussi bien pour la variance que pour le test.

489 résultats passent en faveur de la variante, 60 se dégradent et 451 restent identiques.

## Changement appliqué

- Rounds 1 à 6 inclus : priorité au combat. Les joueurs convergent vers le porteur adverse et privilégient les frappes sur lui pour provoquer son jet de tenue de balle. Les arrachements et la circulation du ballon deviennent secondaires. Un porteur allié peut également se battre sans abandon volontaire de sa balle.
- Dès le round 7, prolongations comprises : retour aux missions de récupération, conservation, couverture et passes préparées de la nouvelle IA précédente.
- En l’absence d’adversaire debout, la récupération du ballon reste possible avant le round 7.
- Les déploiements, profils, caractéristiques, règles, jets, classes, animations et durées restent ceux du comparatif précédent. Les versions de règles 2, 3 et 4 gardent leur comportement antérieur.

Les bonus de décision de la phase combat sont fixes avant le lancement : attaque +60, lutte/projection +20, prise/arrachement/passe/préparation −80, et +40 supplémentaires pour une attaque du porteur. Le positionnement cherche le contact du porteur adverse, ou d’un adversaire proche si l’équipe possède déjà la balle ou si elle est libre. Aucun ajustement n’a été fait pendant les 1 000 matchs.

## Résultats par plan collectif

Les deux équipes emploient le même plan et son ouverture par défaut dans chaque match.

| Plan | Matchs | Victoires de la nouvelle IA avant | Victoires de la variante | Taux de la variante |
| --- | ---: | ---: | ---: | ---: |
| Équilibré | 334 | 145 | 280 | 83,8 % |
| Conservation | 334 | 118 | 276 | 82,6 % |
| Pressing | 332 | 137 | 273 | 82,2 % |

La variante remporte 410 matchs à domicile et 419 à l’extérieur, sur 500 joués de chaque côté.

## Activité de l’équipe utilisant la nouvelle IA

| Mesure cumulée sur 1 000 matchs | Avant | Variante |
| --- | ---: | ---: |
| Attaques normales | 10 664 | 30 416 |
| KO infligés | 1 453 | 4 089 |
| Tentatives d’arrachement | 4 829 | 947 |
| Passes tentées | 1 453 | 4 077 |
| Passes réussies | 1 025 | 3 180 |
| Passes en réaction déclenchées | 460 | 3 767 |

Cette priorité augmente fortement les frappes et les KO, réduit les arrachements et s’accompagne de davantage de passes sur l’ensemble des rencontres. Les totaux ne permettent pas d’isoler l’effet du tempo de celui de la concentration des attaques sur le porteur : ils font partie de la même variante demandée.

## Protocole et limites

500 graines, chacune jouée deux fois avec les côtés des IA inversés. Les deux campagnes de 1 000 matchs reprennent exactement les mêmes graines, côtés, tactiques et effectifs. Elles utilisent des graines différentes du premier test de 100 matchs.

Cinq profils symétriques : Nora, Brique, Zip, Étau et Vigie. Niveau 1, aucune fatigue, aucun équipement, consignes normales. Aucune progression entre les matchs. Les différentes décisions peuvent modifier l’ordre de consommation des dés après l’initialisation.

Seul le module de la nouvelle IA change entre les deux campagnes. Le moteur de résolution reste commun et la correction de réévaluation d’un soutien après une passe préparée reste réservée aux tours de la nouvelle IA. Six matchs de calibration exclus des résultats reproduisent les états finaux des moteurs natifs sur les trois tactiques. Les invariants et la légalité des actions sont vérifiés pendant les simulations.

Durées chronométrées, contrôles compris : **332,1 secondes** avant et **235,9 secondes** pour la variante. Préparation et calibration : respectivement 5,4 et 4,7 secondes. Ces durées ont été mesurées pendant le travail local, avec d’autres tests en parallèle ; elles ne constituent pas un test de performances comparables.

L’écart dépasse nettement l’incertitude estimée sur ce protocole. Il ne prouve pas un avantage identique à tous les niveaux, avec tous les équipements ou toutes les compositions, ni un meilleur équilibre entre deux équipes employant toutes deux la variante.

## Vérifications

- Sept régressions dédiées au tempo, à la frontière 6/7, aux prolongations, à la cible porteuse et au maintien des règles de lutte.
- 236 tests de régression validés avec `node --test --test-skip-pattern='500 matchs' --test-reporter=dot` depuis `rumbleball/`.
- Le test de 500 matchs avec vérification des actions, opportunités et invariants a également réussi avec le module d’IA final. Les scénarios de passe et de couverture vérifient désormais la phase ballon ; les anciens scénarios d’ouverture sont conservés dans leur version de règles.
- Résultats et mesures des 1 000 matchs réagrégés et vérifiés ; mêmes graines et mêmes côtés avant/après ; copie exacte du module d’IA archivée et identifiée par SHA-256.

## Reproduction et données

```sh
node tools/rumbleball-ai-duel.mjs rumbleball/playtests/old-vs-new-1000-2026-10-17 --matches 1000 --seed-prefix ai-duel-confirm-2026-10-17
node tools/rumbleball-ai-duel.mjs rumbleball/playtests/combat-first-1000-2026-10-17 --matches 1000 --seed-prefix ai-duel-confirm-2026-10-17 --new-ai rumbleball/playtests/combat-first-1000-2026-10-17.ai.mjs
node tools/rumbleball-duel-statistics.mjs rumbleball/playtests/combat-first-1000-2026-10-17.json --same-seeds rumbleball/playtests/old-vs-new-1000-2026-10-17.json
```

- [Première campagne de 1 000 matchs](old-vs-new-1000-2026-10-17.json)
- [Campagne de la variante et comparaison appariée](combat-first-1000-2026-10-17.json)
- [Module de la variante testé](combat-first-1000-2026-10-17.ai.mjs)
