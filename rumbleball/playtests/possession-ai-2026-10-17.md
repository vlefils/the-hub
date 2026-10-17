# Démarquages et arrachements — 17 octobre 2026

## Changements

Le démarquage de la version 5 dépend désormais d’une préparation de passe réellement exécutable : porteur vivant, possession conservée, réaction disponible et action déjà dépensée pour la préparation. L’exécution des passes et les décisions des bots utilisent ce même contrôle.

Sans préparation, les joueurs affectés à l’attente conservent leur position, même si une case voisine obtient un meilleur score de sécurité. Ils peuvent agir au contact. Le protecteur et les bloqueurs continuent de remplir leurs missions. Les relais d’ouverture attendent également la possession et la préparation avant de chercher une nouvelle position.

Annulation, expiration, perte de balle, réaction dépensée ou KO suppriment le motif du démarquage. Une passe ratée pendant la course interrompt celle-ci et provoque une nouvelle décision à la case atteinte, avec le mouvement restant correctement décompté.

La lecture simultanée respecte aussi cette dépendance : les animations de soutien attendent la préparation et se terminent avant son annulation ou son déclenchement. Plusieurs soutiens peuvent courir en parallèle pendant cette fenêtre. Les anciens journaux de version 5 sans métadonnées de mission disposent d’un repli fondé sur leur état initial. La durée du round reste de douze secondes.

L’arrachement n’a plus un bonus fixe écrasant pour tous les joueurs. Son score prend en compte la probabilité du test opposé, les aides et ouvertures de classe, l’affectation à la récupération, le rôle de récupérateur, la fin de match et le risque de reperdre immédiatement la balle. Les autres joueurs valorisent davantage leurs actions de soutien et de contact. Les jets et la légalité de l’arrachement restent ceux du jeu.

## Échantillon reproductible

Référence avant correction : commit `514181f`.

Commande depuis la racine :

```sh
node tools/rumbleball-possession-audit.mjs
```

24 matchs : huit avec chaque stratégie, appliquée aux deux équipes, en conservant profils et ouvertures par défaut. Graines `possession-audit-balanced-0` à `-7`, puis les mêmes suffixes pour `possession` et `pressing`. Les mêmes configurations sont utilisées avant et après la correction.

| Mesure | Avant | Après |
| --- | ---: | ---: |
| Tours de joueurs vivants | 2 239 | 2 234 |
| Tentatives d’arrachement | 591 | 159 |
| Arrachements réussis | 251 | 79 |
| Changements de possession consécutifs par arrachement | 203 | 34 |
| Plus longue série de tours contenant un arrachement | 5 | 2 |
| Passes tentées | 65 | 111 |
| Préparations de passe | 23 | 52 |
| Frappes normales | 327 | 511 |
| Agrippements réussis | 164 | 129 |

Les « changements consécutifs » comptent deux prises par arrachement sans passe, récupération d’une balle libre ou perte de balle entre les deux ; ils ne sont pas nécessairement sur deux tours adjacents. Les tentatives sont comptées via les actions effectivement résolues, y compris les actions de suivi.

Dans cet échantillon, les tentatives d’arrachement baissent d’environ 73 % et les passes augmentent d’environ 71 %. La baisse des arrachements s’accompagne aussi de davantage de frappes. Ces chiffres décrivent l’activité de cette campagne ; ils ne démontrent pas un équilibrage définitif.

## Régressions ciblées

- Attente immobile sans passe préparée, malgré un déplacement qui améliorerait la sécurité.
- Démarquage autorisé après préparation, puis abandonné après ses différentes causes d’annulation.
- Réaction indisponible et ancien indicateur de préparation inutilisable.
- Relais d’ouverture sans porteur : aucune course vers une ancienne ancre.
- Test opposé : égalité au défenseur, avantages des deux côtés et absence de consommation de hasard lors de la décision.
- Récupérateur bien placé : arrachement conservé ; bloqueur de soutien : autre choix au contact.
- Récupérateur sans chance de gagner : autre action pertinente.
- Passe ratée pendant le démarquage : interruption et nouvelle décision, plutôt que poursuite de l’ancien plan.
- Animation : préparation avant les courses, soutiens simultanés entre eux, annulation ou déclenchement après leurs courses, sans mutation des événements ni du moteur.

Les anciennes versions 2, 3 et 4 conservent leurs règles et leur coordination antérieures. Les nouvelles rencontres utilisent la version 5 ; les corrections s’appliquent aussi aux rencontres de cette version déjà sauvegardées.
