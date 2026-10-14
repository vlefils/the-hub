# Runner — revue de compatibilité de toutes les capacités

Revue du 12 octobre 2026, à partir de l'ancien Runner et des décisions de la conversation. **Le socle et les moteurs retenus sont consignés en section 4 des [propositions d'équilibrage](PROPOSITIONS-EQUILIBRAGE-CLASSES.md).** Les adaptations ci-dessous ont servi à la refonte intégrée au livre le 14 octobre 2026. Ce document garde la trace des pistes et de leurs risques ; `index.html` fait foi pour la règle actuelle, notamment les portées et les dégâts de zone fixés lors de l'intégration.

## 1. Cadre de la revue

- Verrouillage par action bonus, à zéro ; observation : +1 en fin de tour de la cible, une fois par round.
- Plafond par cible : 1 aux niveaux 1–3, 2 aux niveaux 4–6, 3 aux niveaux 7–12.
- Une cible pour le Tueur et le Hacker ; plusieurs compteurs possibles pour le Fixeur, avec une seule cible d'observation.
- Tueur : +1 sur une touche, avant dépense ; exploitation à +1d6 par faille.
- Fixeur : réaction sur une attaque ennemie ratée, +1 sur cet ennemi ; prochaine touche alliée, consommation automatique de toutes ses failles à +1d4 chacune.
- Hacker : +1 par action bonus d'analyse ; décharge par action à 1d12 par faille, JdS pour moitié.
- Conserver les défenses liées aux compteurs, les pics de voie à 5/8/11 et une génération assez régulière pour reconstruire après consommation.

**Compatible** signifie que la capacité fonctionne avec ce cadre. Cela ne garantit pas que ses valeurs sont équilibrées. **À adapter** conserve sa fonction ; **à remplacer** change son déclenchement ou une partie essentielle de son effet.

## 2. Classe de base

| Niveau | Capacité actuelle | Verdict | Adaptation proposée |
|---|---|---|---|
| Châssis | PV d8, maîtrises, équipement | Compatible | Conserver. |
| Châssis | DD : 8 + BM + CHA | Compatible | Aucun problème de fonctionnement. Conserver provisoirement ; le Hacker continue donc d'utiliser CHA pour ses sauvegardes. Ne pas basculer silencieusement son DD vers ESP. |
| 1 | Faille : acquisition | À remplacer, décision actée | Retirer la sauvegarde, la condition « aucun dégât infligé » et l'interdiction d'être menaçant. Appliquer verrouillage et observation. |
| 1 | Faille : défenses | À adapter | Passer aux seuils 1/2/3, préciser leur cumul et retirer les sauvegardes de ciblage répétées. Proposition détaillée ci-dessous. |
| 1 et 9 | Expertise | Compatible | Conserver les deux choix au niveau 1 et les deux supplémentaires au niveau 9. |
| 2 | Voie de Runner | Compatible | Conserver le choix au niveau 2 et les gains de voie à 5/8/11. |
| 3/6/9/12 | Amélioration de caractéristique | Compatible | Conserver. |
| 4 | Couverture et planque | Compatible | Conserver déguisements et planque. Ajouter le nouveau plafond de 2 failles à la progression du niveau 4. |
| 7 | Opportuniste | À adapter | Dés 1d6/1d8/1d10 pour 1/2/3 failles. Conserver la réaction, sans consommation de faille. Simplifier les deux options équivalentes en un malus au jet d'attaque. Ajouter le plafond de 3 à la progression du niveau 7. |
| 10 | Intouchable | À remplacer en partie | Conserver l'amélioration des défenses, remplacer l'interdiction de ciblage et la perte d'action sur sauvegarde ratée par des effets sans jet récurrent. |

### Proposition de défenses cumulatives

| Failles conservées | Faille, niveau 1 | Intouchable, niveau 10 |
|---|---|---|
| Au moins 1 | +1 CA contre cet ennemi. | Le bonus passe à +2 CA. |
| Au moins 2 | Désavantage à ses attaques d'opportunité contre le Runner. | Cet ennemi ne peut plus effectuer d'attaque d'opportunité contre le Runner. |
| 3 | Sa première attaque contre le Runner à chacun de ses tours a le désavantage. | Toutes ses attaques contre le Runner ont le désavantage. |

Ces effets sont **des propositions**, pas une validation des valeurs. Ils évitent une sauvegarde à chaque ciblage et font conserver un intérêt aux paliers précédents. La dépense des failles retire immédiatement les bénéfices dont le seuil n'est plus atteint. Les avantages et désavantages suivent les règles générales du livre.

Pour le Fixeur, ces défenses s'appliquent contre chaque ennemi porteur de son compteur. C'est un avantage réel de sa voie : il faut l'inclure dans le bilan de puissance, en plus des dégâts gratuits pour les alliés.

### Opportuniste et réaction du Fixeur

La concurrence fonctionne bien : le Fixeur peut utiliser Opportuniste avant de connaître le résultat pour protéger un allié, ou attendre de savoir si une attaque échoue et utiliser Semer le doute. **Il ne peut pas faire les deux avec la même réaction**, même si son malus transforme la touche en échec. Conserver ici les règles du livre : au plus une réaction par round.

## 3. Tueur à gages

| Niveau | Capacité actuelle | Verdict | Adaptation proposée |
|---|---|---|---|
| 2 | Exploitation létale | À adapter, dépense actée | Une fois par tour, sur une touche d'arme contre la cible verrouillée, choisir de consommer 1 à 3 failles disponibles ; +1d6 par faille consommée. La quantité dépend du plafond de niveau. |
| 2 | Prédateur méthodique | À adapter, timing acté | Une fois pendant son propre tour, gagner 1 faille sur une touche contre la cible verrouillée, **avant** Exploitation létale. Proposition : supprimer le gain conditionnel de 2 ; il vient de l'ancienne échelle sur 6 et remplit maintenant tout le plafond du niveau 4. |
| 5 | Mise à mort calculée | À remplacer en partie | Retirer le bonus permanent d'ESP à tous les jets d'attaque. Proposition : lorsqu'Exploitation létale consomme au moins 2 failles, ajouter ESP à ses dégâts supplémentaires, une seule fois pour cette exploitation. Cela conserve un lien avec ESP et récompense une dépense groupée. |
| 8 | Meurtre violent | À adapter fortement | Conserver le changement de victime après un KO, mais tenir compte des failles qui viennent d'être consommées. Proposition : si une Exploitation létale consommant au moins 2 failles met la cible à 0 PV, verrouiller gratuitement un autre ennemi visible à 9 m de la victime et y placer 1 faille ; 2 si 3 ont été consommées. Aucun JdS de transfert. |
| 11 | Carnage méthodique | Partiellement compatible | Le doublement peut devenir **+2d6 par faille consommée**. Retirer le transfert vers toutes les cibles : il rendrait le Tueur multicible comme le Fixeur. Proposition pour son second effet : étendre le transfert de niveau 8 aux KO sans exploitation, en utilisant les failles encore présentes avant le KO ; jamais deux transferts pour un même KO. |

### Ordre de résolution indispensable

1. Le jet d'attaque est effectué avec les bénéfices déjà présents avant le jet.
2. Si l'attaque touche, Prédateur méthodique peut ajouter 1 faille, dans la limite du plafond.
3. Le Tueur choisit sa dépense pour Exploitation létale ; le compteur et ses défenses diminuent immédiatement.
4. L'attaque inflige ses dégâts, dont les dégâts supplémentaires.
5. Si la victime tombe à 0 PV, résoudre un éventuel transfert en tenant compte de la dépense de cette attaque, puis retirer l'ancien verrouillage.

**Aucune faille regagnée après la détonation par cette même touche.** Une faille gagnée après le jet ne peut pas améliorer rétroactivement ce jet d'attaque.

Le nouveau gain du Tueur doit rester limité à sa cible verrouillée. Sinon, des attaques sur plusieurs adversaires recréent des compteurs multiples. La limitation d'Exploitation létale à une fois par tour est conservée de l'existant ; son usage éventuel sur une attaque hors de son tour reste possible, mais Prédateur ne produit alors pas de faille supplémentaire.

Le transfert proposé est une exception explicite au verrouillage initial à zéro. Il crée une transition récompensant une exécution préparée, sans banc de failles sur plusieurs cibles. Les valeurs exactes des transferts et le doublement du niveau 11 restent à tester ensemble.

## 4. Fixeur

| Niveau | Capacité actuelle | Verdict | Adaptation proposée |
|---|---|---|---|
| 2 | Semer le doute | À remplacer, moteur acté | Lorsqu'un ennemi visible rate une attaque, utiliser sa réaction pour lui ajouter 1 faille. L'ennemi peut être différent de la cible verrouillée ; aucun changement de verrouillage requis. Retirer l'action de zone et les sauvegardes d'acquisition. |
| 2 | Exploitation alliée, nouvelle capacité | À ajouter, décision actée | Lorsqu'un allié touche un ennemi porteur de ses failles, consommer automatiquement **tout le compteur de cet ennemi** et ajouter +1d4 dégâts par faille. Ne consomme aucune réaction. |
| 5 | Ouvrez-le | À remplacer en partie | L'avantage accordé avant le jet ne fonctionne pas avec le déclenchement automatique après la touche. Proposition : lorsqu'un allié consomme au moins 2 failles, la cible ne peut plus prendre de réaction jusqu'au début de son prochain tour. Les +1d4 par faille restent acquis. |
| 8 | Paranoïa | À refaire | L'action, le seuil 6 et les nouvelles sauvegardes à chaque dégât demandent une réécriture. Proposition cohérente avec la nouvelle voie : lorsqu'un allié consomme 3 failles, la cible fait un unique JdS d'ESP ; sur échec, sa prochaine attaque avant la fin de son prochain tour doit viser une autre créature désignée par le Fixeur, parmi les cibles légales à portée. Aucun déplacement ni attaque imposée, aucune nouvelle sauvegarde à chaque dégât. Conserver l'immunité des créatures immunisées à Effrayé si l'effet garde cette nature. |
| 11 | Finissez-le | À adapter | Remplacer **+1d4 par faille** par **+1d8 par faille**, toujours automatiquement sur une touche alliée. Supprimer l'ancien supplément de +1d8 à 6 failles d'Ouvrez-le pour éviter un cumul hérité de l'ancienne rédaction. |

Les effets de niveaux 5 et 8 s'ajoutent aux dégâts de l'exploitation. Une consommation de 3 remplit aussi la condition « au moins 2 ». La proposition de Paranoïa est une nouvelle version plus bornée de l'effet, à discuter ; la capacité actuelle peut aussi être conservée comme dépense active alternative à 3 failles, mais ce serait une autre direction que l'exploitation entièrement automatique.

### Contraintes de rédaction

- Le verrouillage ne détermine que l'observation automatique. Les autres compteurs sont alimentés par la réaction, sauf future aptitude contraire.
- Changer le verrouillage ne supprime aucun compteur du Fixeur ; verrouiller une cible déjà marquée ne remet pas son compteur à zéro et n'ajoute rien.
- Chaque compteur a son propre plafond 1/2/3. Les bonus défensifs s'appliquent contre l'ennemi concerné.
- Proposition de portée : réaction sur un ennemi visible à 18 m ; exploitation pour un allié visible à 9 m, en reprenant la portée d'Ouvrez-le. Ces portées ne sont pas encore validées.
- « Allié » doit exclure le Fixeur lui-même pour qu'il ne déclenche pas son propre soutien avec ses attaques.
- L'exploitation consomme le compteur entier une seule fois sur la touche concernée. Une deuxième attaque ne retrouve pas les failles consommées. Les attaques des ennemis sous Paranoïa ne deviennent pas des attaques alliées.
- Ne pas ajouter une limitation globale « une exploitation par round » : plusieurs alliés peuvent faire détonner des compteurs préparés sur des ennemis différents. La génération, les plafonds et le caractère automatique régulent ce cas.

**La patience du Fixeur dépend de la répartition du focus.** Sur une cible attaquée constamment par les alliés, il déclenche surtout à une faille. Sur un ennemi laissé de côté, il peut préparer les effets à 2 ou 3. Cela correspond à l'intention retenue ; il ne choisit pas de préserver un compteur au moment d'une touche alliée éligible.

## 5. Hacker

| Niveau | Capacité actuelle | Verdict | Adaptation proposée |
|---|---|---|---|
| 2 | Brèche assistée | À remplacer, moteur acté | Action bonus sur la cible déjà verrouillée : +1 faille, sans JdS et sans liste d'équipements requis. Le verrouillage initial et l'analyse restent deux usages distincts de l'action bonus. |
| 2 | Payload : Décharge neurale | À adapter, d12 acté | Action ; 1d12 par faille consommée, JdS d'ESP pour moitié. Proposition : choisir de consommer entre 1 et le nombre disponible, plutôt que forcer toute la jauge. Dépenser avant le JdS ; aucun remboursement en cas de réussite adverse. |
| 5 | Payload : Parasite sensoriel | À adapter | Le rôle de contrôle reste pertinent. Proposition : coût fixe **2 failles**, action et JdS d'ESP. Conserver l'absence de réaction, le désavantage aux attaques et aux tests de Perception/Techno jusqu'à la fin du prochain tour du Hacker sur échec ; sur réussite, conserver seulement l'absence de réaction jusqu'à la fin du tour en cours. Aucun dégât de Décharge ajouté gratuitement. |
| 8 | Résidu malveillant | À remplacer en partie | « Retomber à 2 » peut créer des failles ou annuler le coût d'un petit Payload. Proposition : une fois pendant son tour, après la résolution d'un Payload consommant au moins 2 failles, regagner **1 faille** sur la même cible, si elle est encore une cible valide. Aucun remboursement d'un Payload à 1 faille. |
| 11 | Payload : Explosion d'implant | À adapter fortement | Déclenchement proposé : Décharge consommant **3 failles**. Conserver les 3d12 principaux comme base et ajouter une zone, plutôt que reprendre mécaniquement « 8d8 au lieu des dégâts normaux ». La valeur des dégâts de zone reste à calibrer. Renommer l'aptitude si elle fonctionne sur toute cible ; la destruction d'un implant mémoire devient un effet conditionnel à sa présence, pas un prérequis de dégâts. |

Parasite consomme exactement 2 failles dans cette proposition ; si le Hacker en conserve une troisième, elle continue d'accorder ses défenses. Le remboursement de Résidu intervient après l'effet et respecte le plafond. La jauge restant verrouillée, analyse et observation peuvent ensuite continuer normalement.

### Rythme à surveiller

Avec Résidu, une décharge à 3 failles laisse 1 ; la fin du tour adverse peut remonter à 2 ; l'analyse suivante remonte à 3. **Le Hacker pourrait donc répéter sa décharge maximale à chaque tour** si les conditions sont remplies. Ce rythme résulte directement de la recharge voulue ; il faut calibrer les dégâts de la zone de niveau 11 pour ce rythme régulier, et ne pas les traiter comme un effet rare.

Les dégâts du Hacker ne doivent pas dépendre d'une vérification permanente de la fiche technique adverse. Ses outils d'intrusion hors combat peuvent conserver leurs conditions technologiques, à écrire séparément si nécessaire.

## 6. Compatibilité transversale et bilan

| Interaction | Conclusion |
|---|---|
| Défenses et consommation | Compatible si le compteur est mis à jour immédiatement, même hors du tour du Runner. |
| Génération et plafond à 1 | Un gain peut être perdu lorsque le compteur est plein. La touche du Tueur avant dépense corrige son premier coup à vide ; elle ne supprime pas tous les gains perdus. Ne pas ajouter de surplus implicite. |
| Fixeur multicible et Tueur/Hacker monocible | Asymétrie intentionnelle ; préciser l'exception Fixeur dans la règle de base et ne pas lui ajouter un deuxième verrouillage automatique. |
| Opportuniste et Semer le doute | Concurrence intéressante pour la réaction du Fixeur. Une attaque transformée en échec par Opportuniste ne donne pas une deuxième réaction gratuite. |
| Exploitation et transfert après KO | Déclencher le transfert depuis les failles consommées ou leur état avant le KO ; les tester uniquement après dépense supprimerait le déclencheur. Un seul transfert par KO. |
| Consommation automatique du Fixeur et avantage à l'attaque | Incompatible sur un même déclenchement après la touche ; transformer le niveau 5 en effet après touche. |
| Fixeur à trois failles et patience | Fonctionne surtout sur les ennemis hors du focus. C'est la fonction attendue de ses compteurs multiples. |
| Critiques | Le livre double les dés de dégâts de l'attaque. Les dés supplémentaires du Tueur et du Fixeur suivent cette règle si intégrés à l'attaque ; un Payload avec JdS n'en bénéficie pas. Ce point doit figurer dans la comparaison des dégâts et être explicite dans la rédaction. |
| Dégâts et ordre des effets | Consommer les failles avant d'infliger les dégâts. Pour Paranoïa, résoudre le JdS et appliquer l'effet après les dégâts de la touche déclenchante. |
| Plusieurs Runners | Compteurs personnels ; chaque Runner ne consomme que ses propres failles. Les cumuls de plusieurs Fixeurs méritent une règle explicite au moment de l'intégration. |
| Fin de combat et cible à 0 PV | Aucun stock hors combat. Résoudre d'abord une éventuelle aptitude de transfert, puis retirer les compteurs de la cible vaincue. |

### Bilan

Le châssis, Expertise, les ASI, Couverture et planque et le calendrier des voies fonctionnent. Les failles et leurs défenses demandent une réécriture commune, pas seulement une division par deux des anciens seuils.

Les identités restent nettes : **Tueur**, toucher puis choisir sa dépense et enchaîner les victimes ; **Fixeur**, préparer plusieurs adversaires pendant que ses alliés combattent ailleurs ; **Hacker**, alimenter une cible puis arbitrer entre dégâts et contrôle.

Les changements les plus structurants concernent **Mise à mort calculée**, les **transferts du Tueur**, **Ouvrez-le**, **Paranoïa**, **Résidu malveillant** et les sauvegardes répétées de **Faille/Intouchable**. Les nouvelles versions proposées doivent être discutées avant intégration de l'ensemble dans le livre. Aucun gain de génération supplémentaire ni limitation de fréquence nouvelle n'est considéré comme validé par cette revue.
