# Les Rebuts du Chrome — journées 2 et 3

Carrière de test isolée, jouée avec le moteur local. Aucun accès à la sauvegarde du navigateur. La première journée reprend exactement la partie précédemment rapportée : victoire contre les Voltigeurs en prolongation, Étau à 1 PV et solde de 295 chromas. Sa graine de carrière est `partie-retour-17-octobre` ; ses règles sont celles du commit `c966ffc`.

Les deux journées suivantes utilisent l’IA révisée, sans changement des caractéristiques ou des règles de passe.

| Journée | Adversaire | Résultat | Passes de notre club | Salaires | Prime | Solde après match |
|---|---|---|---|---:|---:|---:|
| 2 | Les Crocs Néon | Défaite, round 10 | 1/1 | 105 | 200 | 390 |
| 3 | Les Brise-Chrome | Défaite, round 10 | 0/0 | 135 | 200 | 155 |

## Choix de gestion

- Journée 2 : repos de Zip et Vigie, entrées de Flash et Prisme. Prisme joue relais prudent. Le plastron passe gratuitement de Zip à Flash. Prisme réussit une passe ajustée vers Flash au round 4 et utilise donc sa Concentration. Nora émet un appel ; le jeu change avant qu’il puisse servir.
- Avant la journée 3 : achat d’Echo, un capitaine, pour 300 chromas. Nora se repose ; Zip et Vigie reviennent. Le plastron revient à Zip. Le solde passe de 390 à 90, puis à −45 avec les salaires et à 155 avec la prime de défaite.
- Après la journée 3 : quatrième place, 3 points. Nora, Brique, Zip, Étau et Vigie sont niveau 2. Brique et Étau atteignent fatigue 6 ; il faut maintenant arbitrer entre leur puissance et un cinq plus frais.

## Retour

Les rotations, transferts d’équipement, niveaux et salaires produisent déjà des décisions concrètes. Le passeur a exprimé sa technique lors de la deuxième journée. Sur ces deux rencontres, la circulation reste toutefois limitée à une seule passe : ce résultat ne permet pas de conclure que l’équilibrage des passes est terminé. Les appels sont mieux encadrés par les fenêtres d’initiative et le risque de perdre le ballon, mais aucun appel de notre équipe n’a été consommé sur ces deux journées.

Les reprises JSON ont été testées au tour 12 de chaque match. Le rendu et les animations n’ont pas été observés dans un navigateur.

## Validation globale

132 tests passent, dont les 500 matchs de régression : 248 victoires à gauche, 252 à droite, 12 prolongations. Ces matchs produisent 536 passes tentées, 385 réussies, 244 appels émis, 106 appels consommés par une passe et 72 passes ajustées. Les totaux incluent les passes enchaînées après un ramassage libre ; le journal des décisions seul en compte 315. Ces chiffres constatent l’activité des capacités, sans démontrer à eux seuls que l’équilibrage est terminé.

## Reprendre ou reproduire

- Importer [la sauvegarde après la journée 3](rebuts-s1-j3.json) via le bouton **Importer** de la carrière. L’interface demande confirmation avant de remplacer une autre carrière.
- [Rapport détaillé](two-days-report.json) : compositions compilées, ressources utilisées, bilan financier, fatigue, classement et extraits du journal.
- Reproduire depuis la racine : `node tools/rumbleball-two-days.mjs`. Le script nécessite l’historique Git contenant `c966ffc` et réécrit ces deux fichiers de test. Le dernier match est rejouable avec le moteur de cette version, à partir de sa configuration conservée dans la sauvegarde.
