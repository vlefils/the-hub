# Ramassage opportuniste — 17 octobre 2026

Le tempo « combat puis ballon » du commit `cffafe0` poussait les joueurs à ignorer des ballons au sol : malus de ramassage pendant les six premiers rounds, mission de combat prioritaire même pour le porteur et les récupérateurs, et relais d’ouverture exclus de certains ramassages. Le moteur ne tentait pas non plus de ramassage après une frappe ayant libéré la balle.

## Comportement corrigé

- Un joueur à portée tente de ramasser une balle au sol avant de dépenser son action ou de partir. Un récupérateur est affecté à la balle libre dès les premiers rounds ; les autres peuvent continuer le combat.
- Hors engagement central, le ramassage utilise l’interaction, y compris en présence d’un adversaire. Le test opposé reste en place, avec égalité au défenseur. L’action, la réaction et le mouvement restant sont conservés, même en cas d’échec. Une seule tentative par tour, sans interaction ajoutée.
- Une fois porteur, le joueur cherche une position sûre et choisit selon la situation : passe immédiate, préparation d’une passe, sprint, déplacement avec esquive ou désengagement. Les partenaires répondent à une préparation réellement disponible, y compris avant le round 7.
- Si une frappe ou une passe ratée laisse le ballon à portée après l’action, une interaction restante permet de tenter le ramassage. Aucune nouvelle action n’est accordée ; le joueur peut encore utiliser le mouvement restant.
- Les règles d’engagement central et les versions 2, 3 et 4 restent conservées. Les jets et les réserves de classe ne sont pas simulés pendant les décisions.

L’aide du jeu décrit le coût du ramassage et les enchaînements possibles.

## Observation avant/après

24 graines identiques : huit matchs pour chacun des plans équilibré, conservation et pressing, appliqué aux deux équipes, avec les profils et ouvertures par défaut. L’instrumentation observe les décisions effectives du moteur, sans inclure les aperçus du capitaine ni consommer de hasard.

| Mesure | Avant (`cffafe0`) | Après |
| --- | ---: | ---: |
| Matchs terminés | 24 | 24 |
| Décisions avec un ramassage au sol immédiatement légal | 379 | 60 |
| Occasion ignorée ou retardée par un déplacement préalable | 344 | 0 |
| Parmi les occasions non contestées, occasions ignorées ou retardées | 69 sur 74 | 0 sur 12 |
| Ramassages non contestés exécutés | 21 | 47 |

Après un ramassage non contesté, la campagne corrigée observe 12 préparations de passe, 6 passes immédiates, 3 esquives, 2 sprints et une frappe. Les ramassages après l’action ne donnent naturellement pas lieu à un nouvel enchaînement d’actions.

Les nombres d’occasions diffèrent car les matchs évoluent autrement après la première décision différente. Ce contrôle vérifie le comportement de ramassage, pas un taux de victoire contre l’ancienne IA. Le comparatif précédent à 82,9 % concerne la variante antérieure, archivée séparément.

## Vérifications et reproduction

14 tests dédiés couvrent tous les rôles, les rounds de combat et de fin de match, les contraintes d’ouverture, les coûts d’interaction, les trois enchaînements demandés, le ramassage contesté réussi et raté, le ramassage après une frappe, l’absence de deuxième action et la conservation des versions antérieures.

Les 251 tests de la suite générale passent, dont les 500 matchs avec contrôle des actions, des opportunités et des invariants, les reprises de carrière et les animations de rounds. Les tests de présentation reposent sur des états et frontières de round réels, y compris les créneaux KO sautés.

```sh
node --test rumbleball/loose-ball-ai.test.mjs
node tools/rumbleball-loose-ball-audit.mjs
```

Depuis `rumbleball/`, lancer la suite générale avec `node --test`.

[Mesures détaillées et empreintes des sources](loose-ball-audit-2026-10-17.json).
