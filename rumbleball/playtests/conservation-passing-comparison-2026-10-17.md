# Conservation — circulation et démarquage

## Comportement

Conservation privilégie un relais libre capable d'enchaîner. Si aucun relais utile n'est disponible, le porteur cherche une position sans contact pour préparer la passe. Le déplacement vers cette préparation ne doit provoquer aucune opportunité. Le porteur reste à portée de ses receveurs, au lieu de maximiser uniquement sa sécurité individuelle.

Une préparation mobilise jusqu'à trois soutiens ; ils privilégient l'ouverture d'une ligne de passe sur une lutte secondaire. Aucun démarquage coordonné ne démarre sans passe préparée. Les cibles marquées, à terre ou immobilisées restent exclues, les passes courtes directes restent possibles et la priorité de circulation s'arrête avant les derniers rounds pour protéger la possession à la sirène.

## Même banc de 1 000 matchs avant/après

| Mesure | Avant | Après |
|---|---:|---:|
| Matchs joués par Conservation | 666 | 666 |
| Victoires | 264 | 258 |
| Passes tentées | 1037 | 1139 |
| Passes réussies | 709 | 796 |
| Préparations | 826 | 979 |
| Passes en réaction | 597 | 612 |
| Courses de démarquage | 527 | 706 |
| Passes déclenchées après une course | 306 | 350 |
| KO subis | 2073 | 2117 |

Passes tentées par match de Conservation : **1,56 → 1,71**. Courses de démarquage par match : **0,79 → 1,06**. Victoires : **39,6 % → 38,7 %**.

Les 334 matchs Équilibrée–Pressing reproduisent exactement leur résultat, leurs rounds, leurs tours, leurs survivants et tous les anciens compteurs. Les règles et les profils ont les mêmes empreintes ; seule la politique de décision change. Les adversaires de Conservation peuvent naturellement produire d'autres actions après ses nouveaux choix.

## Partie non utilisée pour l'ajustement

Les 150 premiers matchs ont servi à ajuster le comportement. Les 850 suivants étaient réservés à la vérification :

| Mesure | Avant | Après |
|---|---:|---:|
| Matchs joués par Conservation | 566 | 566 |
| Victoires | 224 | 222 |
| Passes tentées | 878 | 956 |
| Passes réussies | 601 | 672 |
| Préparations | 691 | 816 |
| Passes en réaction | 499 | 505 |
| Courses de démarquage | 441 | 592 |
| Passes déclenchées après une course | 258 | 296 |
| KO subis | 1762 | 1814 |

Ces mesures décrivent cette configuration ; elles ne sont pas une preuve de supériorité générale ou un test statistique du taux de victoire.

## Décisions lorsque le porteur peut dépenser son action

| Stratégie | Actions avec ballon | Passes directes ou préparations | Part |
|---|---:|---:|---:|
| Équilibrée | 3880 | 1531 | 39,5 % |
| Conservation | 3132 | 1506 | 48,1 % |
| Pressing | 4119 | 1503 | 36,5 % |

Les réactions sont exclues de ce dénominateur : la préparation a déjà consommé l'action. Les ramassages gratuits sont également exclus. Le volume total de passes dépend aussi du nombre de possessions et de joueurs encore debout ; ce tableau mesure le choix du porteur lorsqu'il peut agir.

Reproduction de cette comparaison : `node tools/rumbleball-conservation-comparison.mjs`. Le rapport du banc et son JSON conservent les configurations, les graines et tous les résultats.

## Lecture et validation

Conservation choisit une passe directe ou une préparation dans 48,1 % des actions de son porteur, contre 39,5 % en Équilibrée et 36,5 % en Pressing. Elle effectue aussi le plus de courses de démarquage sur ce banc : 706, contre 646 et 428.

Son volume total de passes demeure inférieur aux deux autres stratégies : ses porteurs disposent de 3 132 actions avec ballon, contre 3 880 et 4 119. Le changement confirme donc l'orientation collective et augmente les passes de Conservation ; il ne résout pas à lui seul son déficit de contrôle et de survie. Ses victoires passent de 264 à 258 sur les mêmes 666 apparitions ; aucune amélioration du taux de victoire n'est revendiquée.

Validation : **267 tests réussis**, aucun échec ni test ignoré, en 169,0 secondes avec le comparatif lancé en parallèle. La suite comprend les 500 matchs de vérification, les sauvegardes, les saisons et les animations. Les 10 nouvelles régressions couvrent la circulation, la fenêtre d'initiative, les cibles marquées, la remise à un meilleur passeur, la fin de match, les trois soutiens après préparation, le mouvement réellement suivi d'une passe et la compatibilité des anciennes versions.
