# Rumbleball Manager — analyse et plan UX de la carrière

17 octobre 2026 · Proposition de conception, avant implémentation.

## 1. Intention

Faire de la carrière un espace où l’on comprend immédiatement l’état du club, où l’on compare facilement ses joueurs et où l’on prépare le prochain match avec plaisir.

L’identité recherchée est celle d’un **club de sport cyberpunk** : un vestiaire et une table tactique, avec des personnages reconnaissables, une typographie sportive et des informations très lisibles. Le soin doit venir des proportions, de la composition et des interactions, puis des détails graphiques.

Le moteur, les règles, les sauvegardes et les animations du match sont conservés. La proposition porte sur la présentation et l’organisation des décisions de carrière.

## 2. Ce que l’existant permet déjà

L’audit porte sur `career-ui.mjs`, les styles de carrière dans `rumbleball.css` et `app.css`, l’éditeur de déploiement et les données de carrière. Un parcours avec huit joueurs a aussi été monté dans le DOM de test en mémoire. Cette vérification confirme les contenus et les interactions ; elle ne mesure pas le rendu dans un navigateur ni le comportement à chaque largeur.

À conserver :

- La page dédiée et le retour vers The Hub, en haut à droite.
- La palette sombre, les accents sportifs, les polices existantes et les portraits personnalisés.
- Les cinq titulaires visibles sur le terrain, la ligne médiane et la zone d’engagement.
- La sauvegarde automatique, la reprise en pause et les explications en cas d’échec de sauvegarde.
- Les motifs de blocage déjà affichés à proximité des achats.
- La comparaison d’équipement avant/après et la confirmation du remplacement destructif d’un implant.
- Le placement au clic et au clavier, avec échange de deux joueurs sur une case occupée.

Le socle fonctionnel est complet. L’enjeu consiste surtout à mieux distribuer les informations et les actions.

## 3. Diagnostic précis

| Constat vérifié | Conséquence UX | Réponse proposée |
| --- | --- | --- |
| Effectif regroupe titulaires, plan collectif, couleur, ouverture, déploiement, fiches, rôles, consignes et cessions. | Plusieurs tâches différentes se disputent la même page. | Séparer la consultation de l’effectif et la préparation du match. |
| Avec huit joueurs, le formulaire contient 24 menus déroulants et un sélecteur de couleur. | La page demande un effort de lecture important avant de savoir quoi régler. | Afficher les contrôles dans le contexte du joueur ou de la tâche sélectionnée. |
| Les changements de composition sont automatiques, mais un bouton principal « Enregistrer la composition et les consignes » reste présent. | Le statut réel des modifications peut sembler ambigu ; deux actions principales se concurrencent. | Un statut discret « Enregistré dans ce navigateur » et une action principale adaptée à la vue. |
| Le bilan de la dernière journée est ouvert par défaut, avant tous les onglets, tant que cette rencontre est la dernière enregistrée. | Le passé occupe durablement l’accès à la gestion suivante. | Un vrai bilan à la sortie du match, puis un résumé compact dans Club. |
| Les joueurs sont présentés en fiches de hauteur variable, avec plusieurs statistiques dans une phrase. | Comparer fatigue, niveaux et salaires demande de parcourir plusieurs blocs. | Une liste comparative sur ordinateur et une fiche détaillée pour le joueur sélectionné. |
| Fatigue, XP et salaire partagent une même ligne secondaire. | Le coût sportif de la fatigue ressort peu dans la hiérarchie. | Fatigue accompagnée de son effet, XP distincte et salaire aligné. |
| À 20 XP, un joueur de niveau 2 a une barre à 20/50. | La barre ne représente pas l’avancement du palier qui vient de commencer. | Barre de 0 à 30 XP vers le niveau 3 ; XP cumulée disponible en détail. |
| L’équipement affiche les huit articles, puis les protections possédées. | Le catalogue prend le pas sur le matériel déjà utilisable gratuitement. | Montrer le joueur et ses deux emplacements, puis la réserve, puis le magasin. |
| Le régulateur d’effort peut afficher « Caractéristiques de terrain inchangées » dans la comparaison, malgré son effet sur la fatigue. | Le bénéfice de certains achats est moins évident. | Comparer aussi les effets de participation et pas seulement les statistiques de terrain. |
| Ligue contient classement, calendrier, adversaires, historique financier et anciennes saisons. | Les finances n’ont pas de destination évidente. | Rapprocher l’historique financier du solde, dans Club. |
| La carrière peut s’étendre à 118 rem, alors que le terrain de préparation est plafonné à 26 rem. | La largeur disponible est peu reliée à l’importance de la tâche. | Donner plus de place au terrain ; limiter la longueur des lignes et des fiches selon leur contenu. |
| Plusieurs mutations reconstruisent entièrement la vue de gestion. | Risque de perdre le focus, une section ouverte ou le contexte de lecture. | Conserver la sélection et le contexte ; mettre à jour localement les éléments concernés. |

La longueur réelle des pages, la facilité à trouver la bonne action et la densité sur téléphone restent à valider visuellement pendant la phase de conception.

## 4. Architecture proposée

Navigation principale : **Club · Équipe · Recrutement · Équipement · Ligue**.

- **Club** : prochaine rencontre, situation du club, dernier résultat et finances.
- **Équipe** : deux vues locales, **Effectif** et **Préparation**.
- **Recrutement** : offres et comparaison avec le club.
- **Équipement** : matériel d’un joueur, réserve et achats.
- **Ligue** : classement, journées et saisons précédentes.

Le bouton **Préparer le match** ouvre directement Équipe → Préparation. On peut conserver sa composition et lancer la rencontre sans refaire les réglages. Le passage en préparation n’impose aucune nouvelle confirmation modale.

L’en-tête partagé reste compact : identité du club, saison/journée, solde et prochaine masse salariale. Les salaires impayés apparaissent seulement lorsqu’ils existent. Le détail « Après les prochains salaires » permet de comprendre un risque de découvert sans annoncer une prime encore inconnue.

La couleur des maillots rejoint les options d’identité du club. Export/import restent accessibles dans une zone « Sauvegarde » clairement nommée. L’erreur de sauvegarde, elle, demeure visible et persistante jusqu’à sa résolution.

Carrière et Exhibition restent deux modes distincts. En match, l’interface actuelle reprend l’espace disponible.

## 5. Proposition écran par écran

### A. Club — savoir quoi faire ensuite

**Question à laquelle la page répond : « Où en est mon club, et que dois-je préparer ? »**

Ordre de lecture :

1. Prochaine rencontre : adversaire, journée, domicile/extérieur, orientation adverse et action « Préparer le match ».
2. Points d’attention utiles : par exemple « 2 titulaires ralentis par la fatigue », avec accès à l’équipe.
3. Situation dans la ligue : place, points et accès au classement complet.
4. Dernier résultat compact : victoire, nul ou défaite, changement financier de la rencontre et niveaux gagnés.
5. Finances détaillées et historique, à la demande.

Sur grand écran, prochaine rencontre et situation sportive partagent la première rangée, avec une nette priorité à la rencontre. Les points d’attention ne deviennent pas une grille de petits indicateurs tous aussi visibles.

Les alertes s’appuient uniquement sur des données réelles : fatigue, impayés, erreur de sauvegarde. Aucun indicateur artificiel de « puissance », de « moral » ou de « qualité de composition ».

### B. Équipe → Effectif — comparer et s’attacher aux joueurs

Sur ordinateur, remplacer les grandes fiches simultanées par une liste comparative et un panneau de détail lié à la sélection.

La liste présente :

- Portrait, nom et archétype.
- Statut titulaire/remplaçant.
- Niveau et avancement vers le niveau suivant.
- Fatigue et effet actuel.
- Salaire par journée.

Titularisation, fatigue et salaire restent comparables sans ouvrir chaque fiche. Le tri « Fatigue » facilite la rotation ; avec huit joueurs maximum, une recherche et de nombreux filtres seraient superflus.

Le panneau de détail montre un portrait plus grand, les statistiques effectives, les deux emplacements d’équipement et les techniques repliables. Pour une statistique modifiée, le détail peut expliquer : profil de base + niveau + équipement − fatigue. La fiche et le moteur continuent d’utiliser le même compilateur.

Les actions contextuelles sont explicites : **Préparer avec ce joueur**, **Gérer son équipement**, puis **Céder le joueur** en bas, avec la valeur de cession. Les actions de cession conservent leur confirmation et la limite de cinq joueurs.

La fatigue utilise une jauge courte de six unités accompagnée d’un texte : « 4/6 · vitesse −1,5 m ». À 5–6, les malus de compétences sont accessibles immédiatement. La couleur seule ne porte jamais l’information. Tous les joueurs restent sélectionnables, conformément aux règles.

### C. Équipe → Préparation — une véritable table tactique

**C’est l’écran à travailler le plus soigneusement après la structure générale.** Il relie les décisions du manager aux personnages qui vont jouer.

Sur grand écran :

- Une zone majeure pour le demi-terrain, son centre et les cinq personnages.
- À côté, les cinq titulaires sous forme de lignes cohérentes : numéro, portrait, nom, fatigue, rôle et consigne.
- Les remplaçants juste sous les titulaires, pour effectuer un échange clairement identifié.
- Le plan collectif et l’ouverture au-dessus du terrain, avec une explication courte de leur effet.
- Un récapitulatif de lancement et le bouton principal « Lancer la rencontre ».

Sélectionner un joueur dans la liste sélectionne son pion ; sélectionner son pion retrouve sa ligne. Les numéros et couleurs restent cohérents avec le match. Le placement au clic et au clavier est conservé. Un éventuel glisser-déposer restera un raccourci facultatif.

Ne pas afficher en permanence les techniques complètes des huit joueurs sur cet écran. Un joueur sélectionné donne accès à son détail, sans faire perdre le placement en cours.

Les notions sont expliquées là où elles sont utilisées :

- **Archétype** : capacités et ressources du personnage.
- **Rôle** : mission tactique du joueur.
- **Consigne** : comportement individuel.
- **Plan collectif** : orientation de l’équipe.
- **Ouverture** : placement et comportement au premier tour.

Changer d’ouverture indique clairement que son placement sera appliqué. Une possibilité de revenir au placement précédent protège les ajustements manuels, sans imposer une boîte de confirmation à chaque choix.

Le lancement affiche les salaires à prélever et le solde prévisionnel après ce prélèvement. Une dette annoncée ne bloque pas le match. Pendant une rencontre en cours, cette vue devient explicitement consultative et propose « Reprendre la rencontre ».

### D. Recrutement — décider avec le coût complet

Conserver les portraits et la personnalité des candidats, avec une présentation plus courte et comparable : archétype, niveau, statistiques utiles, contrat et salaire.

L’espace de comparaison permet de rapprocher un candidat d’un joueur du club, sans quitter le marché. Les différences de niveau, fatigue et équipement doivent rester explicites : comparer deux valeurs effectives ne doit pas masquer pourquoi elles diffèrent.

Avant l’achat, afficher : coût du contrat, solde restant et nouvelle masse salariale. Les motifs de blocage déjà présents restent près de l’action. Un accès à l’effectif aide à libérer une place lorsque le club est complet.

Un filtre par archétype suffit au départ. Aucun besoin d’un moteur de recherche pour six à douze offres. Le renouvellement « après la journée » reste visible une fois, au niveau de la page.

Pour les premiers contrats, garder un récapitulatif de sélection accessible : joueurs choisis, coût total, argent restant et salaires prévus. Exemple : huit recrues coûtent 2 400 chromas et laissent 0 ; les premiers salaires de 120 entraîneront un découvert. L’interface informe et laisse ce choix autorisé par les règles.

### E. Équipement — partir du joueur et de ce que l’on possède

Organisation :

1. Joueur sélectionné, portrait et statistiques actuelles.
2. Emplacement Protection et emplacement Implant, avec l’objet réellement équipé.
3. Protections du club disponibles ou transférables gratuitement.
4. Magasin, séparé en protections et implants.

La sélection d’un objet affiche les changements à proximité : « CA 14 → 15 » et « Vitesse 9 → 7,5 m », ou « Fatigue de participation +2 → +1 ». Le compromis d’une armure reste aussi lisible que son bénéfice.

Les actions indiquent leur portée : acheter et équiper, attribuer une protection, remettre en réserve, revendre. Le remplacement d’un implant garde sa confirmation spécifique, nomme l’ancien implant détruit et rappelle le prix. Une protection disponible en réserve peut être proposée avant l’achat d’un exemplaire supplémentaire.

Le joueur sélectionné reste le même lors du passage depuis sa fiche et après un transfert. Son portrait utilise les variantes visuelles existantes pour rendre le changement concret.

### F. Ligue — situer la saison

Le classement met en évidence notre club et aligne correctement les valeurs numériques. Les abréviations disposent d’un libellé compréhensible.

Le calendrier se concentre sur la journée actuelle : notre rencontre, les deux autres affiches et leurs résultats lorsqu’ils existent. Les journées passées et futures restent consultables sans dix blocs de même poids visuel.

Les saisons précédentes et les effectifs adverses restent secondaires. L’historique financier rejoint Club → Finances.

Les résultats respectent le jeu actuel : victoire, défaite ou nul. Ne pas ajouter un score de buts ou des statistiques de match qui ne sont pas réellement calculées et conservées.

### G. Bilan — rendre la progression satisfaisante

À la sortie du match, présenter dans cet ordre :

1. Résultat et adversaire.
2. Variation financière de la rencontre, avec accès au détail prime/salaires/dette.
3. Joueurs ayant gagné un niveau et bonus obtenus.
4. Fatigue gagnée ou récupérée, avec accès à la rotation.
5. Action principale « Préparer la prochaine rencontre » ; relecture en action secondaire.

Le remboursement d’une dette n’est pas une nouvelle dépense. Exemple : solde initial 40, salaires −100, prime +200, solde final 140. Le bilan explique les 60 d’impayés absorbés par la prime, sans les déduire à nouveau. La variation de trésorerie de la rencontre est bien +100.

Après avoir quitté ce bilan, Club en conserve une synthèse ; les autres pages ne sont plus précédées du tableau complet. En fin de saison, le classement final et la prime de classement prennent la place de l’action de journée suivante.

## 6. Direction visuelle

**Conserver la matière actuelle, mieux la composer.**

- Fonds charbon et pétrole sombre ; deux ou trois niveaux de surface clairement distincts.
- Texte ivoire, texte secondaire suffisamment contrasté.
- Accent jaune pâle pour les actions principales ; couleur du club réservée aux maillots et à quelques repères d’identité.
- Couleur d’alerte réservée aux conséquences à comprendre : dette, forte fatigue, destruction d’implant, sauvegarde en échec.
- Rajdhani pour les titres sportifs et grands résultats ; Space Grotesk pour les textes, tableaux et contrôles.
- Texte courant confortable, autour de 16 px ; données denses autour de 14–16 px ; libellés secondaires autour de 12–14 px. À vérifier au zoom et sur téléphone.
- Chiffres tabulaires pour argent, XP et classement.
- Rythme d’espacement commun : 4, 8, 12, 16, 24 et 32 px, exprimé avec des unités adaptables dans les composants.
- Alignements et séparateurs légers avant les encadrements. Une surface surélevée doit exprimer un vrai regroupement ou une sélection.
- Portraits petits dans les listes, plus grands dans la fiche. Les personnages apportent l’identité visuelle sans multiplier les illustrations de fond.
- Transitions courtes et discrètes pour sélection, échange et variation de statistiques ; respecter la réduction des animations.

Pas de nouveaux visuels générés nécessaires pour cette première passe : les personnages, maillots, équipements et éléments d’arène existants fournissent déjà une base forte.

## 7. Responsive et robustesse

### Grand écran

Une navigation de carrière horizontale et stable. Utiliser la largeur pour juxtaposer comparaison et détail, ou terrain et composition. Les textes explicatifs conservent une longueur de ligne limitée. Le terrain gagne de l’espace sans étirer les boutons et les fiches.

### Tablette

Retirer le panneau de détail permanent quand il comprime la liste. Le détail devient une vue dédiée avec retour au contexte. La préparation passe sur une colonne dès que les contrôles et le terrain ne tiennent plus confortablement côte à côte.

### Téléphone

Un accès compact « Menu du club » conserve les cinq destinations avec leur libellé complet et affiche la section actuelle. Les deux sous-vues d’Équipe restent visibles localement.

Les lignes d’effectif deviennent des éléments empilés : identité et statut, puis fatigue/niveau/salaire. L’ouverture du détail conserve sélection et position de défilement au retour. Les tâches principales restent réalisables sans défilement horizontal de page.

Le terrain peut conserver un défilement local clairement identifiable si les cases ne peuvent pas rester manipulables à cette largeur. Les sélecteurs et commandes clavier constituent une alternative. Ne pas réduire le texte ou les cibles uniquement pour faire rentrer tout le terrain.

L’action de lancement peut rester accessible en bas de l’écran de préparation, avec une zone réservée dans le contenu et prise en compte des zones sûres. Elle ne masque ni les derniers réglages ni les messages d’erreur.

### États à concevoir explicitement

- Club de cinq joueurs et de huit joueurs ; noms de club ou de joueur longs.
- Aucun équipement, réserve vide, recrutement complet, filtre sans résultat.
- Solde nul, dette, remboursement partiel et achat inaccessible.
- Titulaire très fatigué et remplaçant fatigué ; niveau maximum.
- Match en cours, reprise en pause, dernier bilan et fin de saison.
- Sauvegarde réussie, sauvegarde indisponible, import invalide et remplacement de carrière.
- Navigation clavier, focus après mise à jour, zoom, réduction des animations.
- Couleur de maillot très sombre ou très claire : elle ne doit pas compromettre la lisibilité des contrôles.

## 8. Composants et organisation technique

Créer un petit système commun à la carrière : identité de joueur, ligne d’effectif, progression d’XP, fatigue, valeur monétaire, comparaison de caractéristiques, état vide, message d’erreur et barre d’actions.

Décomposer progressivement `career-ui.mjs` par vues et composants. Conserver le DOM natif et les fonctions métier existantes ; cette amélioration ne nécessite pas de migration de framework.

Séparer l’état de navigation — section, joueur sélectionné, détail ouvert — de l’état sauvegardé du club. Les changements locaux de présentation ne doivent pas modifier les règles ni multiplier les écritures de sauvegarde.

Isoler les styles de gestion pour éviter qu’une amélioration de tableau ou de bouton ne modifie accidentellement la lecture du match et l’Exhibition. Garder des tokens communs pour l’identité, puis des compositions adaptées à chaque usage.

## 9. Ordre de réalisation

| Lot | Travail | Livrable vérifiable |
| --- | --- | --- |
| 1 — Structure | Installer Club et Équipe avec Effectif/Préparation ; déplacer finances et bilan ; clarifier sauvegarde/action principale. | Parcours navigable avec toutes les fonctions actuelles accessibles. |
| 2 — Conception visuelle | Détailler Club, Effectif et Préparation avec des données réalistes, en ordinateur et téléphone ; fixer typographie, espacements et états. | Trois écrans cohérents à revoir avant de décliner les autres. |
| 3 — Équipe | Liste comparative, fiche joueur, fatigue explicite, XP par palier, liens contextuels, sélection synchronisée avec le terrain. | Préparer puis jouer une journée complète sans perdre le contexte. |
| 4 — Décisions économiques | Recrutement, réserve et magasin ; projections de trésorerie et de salaire ; comparaisons complètes. | Recruter, transférer une protection et remplacer un implant avec conséquences lisibles. |
| 5 — Rythme de saison | Bilan de progression, Club, classement et calendrier ; fin de saison. | Deux journées successives et passage de saison avec une continuité claire. |
| 6 — Finitions | Responsive, noms longs, navigation clavier, erreurs, contrastes, sélection et défilement restaurés. | Contrôle à 360/390, 768, 1280/1440 et 1920 px, plus zoom à 200 %. |

Chaque lot reste utilisable. Le premier ensemble à finaliser visuellement est **Club → Équipe → Préparation → Match → Bilan** ; il constitue le cœur de l’expérience.

## 10. Critères d’acceptation

- En arrivant, on identifie la prochaine rencontre, le solde et l’action suivante sans ouvrir un détail.
- On compare les fatigues et les salaires des huit joueurs dans une même vue d’ensemble.
- On échange un titulaire et un remplaçant sans recopier leurs rôles ni perdre le déploiement.
- On comprend ce que modifient plan collectif, ouverture, rôle et consigne.
- Une action de préparation n’exige pas une sauvegarde manuelle et son statut est perceptible.
- Avant un recrutement ou un achat, coût immédiat et conséquences pertinentes sont visibles.
- La dette bloque uniquement les actions prévues par les règles et ne fait pas disparaître l’accès au match.
- La nouvelle barre d’XP montre le bon palier ; fatigue et statistiques détaillées correspondent au moteur.
- Les protections possédées sont accessibles avant de devoir parcourir tout le catalogue.
- Le bilan distingue prime, salaires, remboursement d’impayés et solde final, sans double déduction.
- Aucun grand bilan ne repousse systématiquement la navigation lors de la préparation suivante.
- Sur téléphone, aucune action essentielle ne dépend du survol ou du glisser-déposer.
- Les mises à jour conservent un focus utile et le contexte ; les erreurs restent perceptibles et actionnables.
- Les scénarios existants de carrière, de reprise et de récompense unique continuent de passer après implémentation.

La revue finale devra être visuelle et fondée sur des tâches complètes, en plus des tests fonctionnels. Les points non observés en navigateur dans cet audit seront vérifiés à ce moment-là.
