# Rumbleball Manager — analyse du code et des performances

Date : 22 octobre 2026. Révision examinée : `b0665ff9de7fbfea832dfe749cf77b740ba28abe`.

Ce document conserve le diagnostic initial. Les corrections demandées ensuite, leurs mesures et leur activation backend sont décrites dans [le compte rendu de réalisation](performance-fixes-2026-10-22.md).

## Conclusion

La priorité est de réduire les données lues et réécrites par le service. La compression des replays traite bien une partie du problème, mais les clubs, les checkpoints et les rondes actives partagent encore la même ligne de ligue. Le navigateur reçoit également les animations dans des vues qui ne les utilisent pas.

Le second problème mesuré concerne la réactivité du solo : le dernier tour déclenche le calcul synchrone des autres rencontres. Le moteur présente un point chaud identifiable dans la recherche des déplacements. Ces sujets justifient des corrections ciblées ; une réécriture générale de l’interface n’est pas nécessaire.

Cette passe ajoute uniquement le présent rapport et des outils de mesure sous `output/rumbleball-performance-audit-2026-10-22/`. Aucun code de fonctionnement, migration, donnée distante ou déploiement n’a été modifié. Les recommandations ne sont pas encore implémentées.

## Méthode et limites

- Lecture du moteur, de l’IA, des parcours solo et multi, de la synchronisation, des Edge Functions et des migrations SQL, y compris les correctifs du 21 octobre.
- Mesures hors ligne sous Node `v24.12.0`, Windows, Intel Core i5-10400F, processus séquentiels, priorité réduite et tas borné à 256 Mo. Le benchmark final a pris environ 16 secondes.
- Ligues synthétiques de 2, 8 et 16 clubs, avec un humain et des bots. Deux modèles : pré-calcul à horloge figée pour observer l’accumulation ; soirée avec grille cron de dix secondes et réveils aux échéances, archivage et retrait des rondes terminées.
- Le second modèle appelle le vrai `prepareLeagueCommit`, puis retire l’enveloppe d’archive comme le ferait le trigger SQL. Il ne reproduit pas les transactions, TOAST, WAL, latences HTTP ou contrôles SQL d’intégrité.
- Profil V8 sur trois matchs déterministes, après un échauffement. Les temps varient avec le JIT et la charge de la machine ; les tailles JSON sont plus directement comparables. Les cas de ligue sont exécutés dans l’ordre 2/8/16.
- Reproduction d’un rafraîchissement UI avec le DOM de test du dépôt. Aucun FPS, rendu CSS, accès disque de localStorage ou comportement d’appareil mobile n’a été mesuré.
- Aucune requête à la production. L’incident documenté le 21 octobre apporte un contexte historique, pas une mesure de l’état du service le 22 octobre. La capacité maximale autorisée de 128 clubs n’a pas été testée.

Mesures reproductibles : [benchmark](E:/antigravity/the-hub/output/rumbleball-performance-audit-2026-10-22/benchmark.mjs), [résultats JSON](E:/antigravity/the-hub/output/rumbleball-performance-audit-2026-10-22/measurements.json), [profil CPU](E:/antigravity/the-hub/output/rumbleball-performance-audit-2026-10-22/engine.cpuprofile), [reproduction UI](E:/antigravity/the-hub/output/rumbleball-performance-audit-2026-10-22/ui-probe.mjs).

```powershell
node --max-old-space-size=256 output/rumbleball-performance-audit-2026-10-22/benchmark.mjs
node --max-old-space-size=256 output/rumbleball-performance-audit-2026-10-22/ui-probe.mjs
```

## Constats prioritaires

P1 : travail structurant à traiter en premier pour le service ou la réactivité. P2 : coût confirmé ou exposition à la saturation à corriger ensuite. Il ne s’agit pas d’affirmer une panne actuelle de la production.

### 1. P1 — Chaque ronde transporte et réécrit toute la ligue

Sources : [lecture de stockage](E:/antigravity/the-hub/supabase/functions/_shared/rumbleball.ts:14), [copie avant avancement](E:/antigravity/the-hub/rumbleball/online/league.mjs:254), [commit SQL](E:/antigravity/the-hub/supabase/migrations/20261021211000_rumbleball_transaction_timeouts.sql:14).

Le worker réserve une ligue et récupère son état complet. `advanceLeague` clone cet ensemble, ajoute au maximum une ronde et renvoie l’ensemble au RPC. Le verrou et la révision portent sur la ligne entière. Les checkpoints et les rondes des autres rencontres sont donc recopiés sans avoir changé. Les préparations utilisent la même unité d’écriture.

La simulation avec échéances et archivage produit les volumes suivants, en unités décimales :

| Clubs | Matchs | Invocations | Pic de l’état actif | JSON lu cumulé | JSON des commits cumulé |
| --- | ---: | ---: | ---: | ---: | ---: |
| 2 | 1 | 5 | 159 Ko | 0,50 Mo | 0,55 Mo |
| 8 | 4 | 25 | 610 Ko | 9,82 Mo | 10,03 Mo |
| 16 | 8 | 53 | 1,27 Mo | 40,98 Mo | 41,42 Mo |

Ce sont des tailles de documents applicatifs, hors enveloppes RPC et compression HTTP ; elles ne représentent ni le trafic réseau effectivement facturé ni les écritures physiques PostgreSQL. L’augmentation confirme néanmoins l’amplification du travail partagé, malgré l’archivage des matchs terminés.

**Correction recommandée :** sortir d’abord les checkpoints et les rondes vers `rb_matches` et `rb_match_rounds`. Une transaction courte doit enregistrer la nouvelle ronde et son checkpoint avec contrôle de révision. Conserver provisoirement les clubs dans la ligue pour limiter la migration. Le [plan de stockage existant](E:/antigravity/the-hub/rumbleball/online/storage-plan.md) décrit déjà cette direction ; l’audit la confirme.

**Validation attendue :** lire Club ou avancer un match ne transporte plus les rondes des autres rencontres. Vérifier les reprises, les révisions et l’application unique des résultats, salaires et progressions. La compression seule ne fournit pas cette séparation.

### 2. P1 — Le règlement d’un match solo bloque l’appel de l’interface

Sources : [callback de sauvegarde](E:/antigravity/the-hub/rumbleball/career-ui.mjs:74), [sauvegarde du tour](E:/antigravity/the-hub/rumbleball/career.mjs:342), [règlement](E:/antigravity/the-hub/rumbleball/career.mjs:314), [simulation des autres rencontres](E:/antigravity/the-hub/rumbleball/career.mjs:297), [résultat immédiat](E:/antigravity/the-hub/rumbleball/ui.mjs:600).

`saveCareerTurn` appelle directement `settleCareerMatch` quand le match finit. Cette fonction simule les deux autres rencontres de la journée avant de rendre la main. L’appel est synchrone dans le parcours navigateur. Le bouton de résultat immédiat exécute également sa boucle complète dans le même gestionnaire d’événement.

Sur la carrière synthétique mesurée, un `saveCareerTurn` ordinaire prend environ **1,45 ms en médiane**, contre **325 ms pour le dernier**, hors rendu et stockage réel du navigateur. Les premières exécutions du même scénario donnaient environ 400 ms. Les trois matchs moteur profilés prennent entre 373 et 586 ms chacun ; ce sont d’autres compositions et tirages.

**Correction recommandée :** exécuter les calculs de fin de journée et le résultat immédiat dans un Web Worker. Conserver une transition explicite « règlement en cours », un résultat déterministe et un seul enregistrement final. Pour les tours ordinaires, éviter de refaire les migrations d’identité, de progression et d’équipement sur toute la carrière à chaque étape lorsque le format est déjà normalisé.

**Validation attendue :** la page continue à répondre pendant le calcul ; résultats, RNG, XP, fatigue, salaires, primes et reprise après interruption restent identiques.

### 3. P2 — La route de consultation inclut les animations sans connaître la vue affichée

Sources : [commande get](E:/antigravity/the-hub/rumbleball/online/server.mjs:28), [projection](E:/antigravity/the-hub/rumbleball/online/league.mjs:310), [décodage des rondes](E:/antigravity/the-hub/rumbleball/online/league.mjs:329), [polling](E:/antigravity/the-hub/rumbleball/online/ui.mjs:289).

La même commande `get` sert Club, Ligue et Direct. Pendant un match, elle décode la ronde courante et clone ses états `before`/`after` avant de les renvoyer. Le format différentiel de stockage est ainsi réexpansé sur chaque lecture, même si l’utilisateur consulte seulement son club ou le classement.

Pour le cas à huit clubs : **316 929 octets** pour une projection en direct, contre **8 211 octets** si les seuls champs `broadcast` et `closing` sont retirés, soit **97,4 % de volume JSON en moins** pour une vue qui n’affiche pas le terrain. Ce dernier chiffre est une comparaison de contenu, pas le résultat d’une route optimisée déjà implémentée. La projection complète prend environ 8,2 ms en médiane dans ce scénario, hors lecture DB et sérialisation HTTP.

Le polling peut repartir toutes les quatre secondes après réponse : une même ronde de douze secondes est donc susceptible d’être renvoyée plusieurs fois. L’historique et les tableaux de playoffs de toutes les saisons restent également inclus ; l’affichage des replays par tranches de 30 ne constitue pas une pagination serveur.

**Correction recommandée :** une projection légère pour Club/Ligue, une lecture dédiée au Direct avec curseur de ronde, et une pagination serveur pour les historiques. Une réponse « inchangée » doit tenir compte de l’heure de diffusion et des transitions de match, pas uniquement de la révision SQL. Garder côté serveur le filtrage des seeds, du RNG et des données futures.

### 4. P2 — Les recherches de déplacements concentrent le calcul moteur

Sources : [reachableCells](E:/antigravity/the-hub/rumbleball/rules.mjs:202), [occupation et mouvement](E:/antigravity/the-hub/rumbleball/rules.mjs:157), [évaluation des destinations](E:/antigravity/the-hub/rumbleball/ai.mjs:323), [appels de décision](E:/antigravity/the-hub/rumbleball/engine.mjs:136).

Dans le profil des trois matchs, `reachableCells` et ses appels internes représentent environ **57 % des échantillons attribués à `simulateMatch`**. Il s’agit d’un coût inclusif : il ne faut pas additionner ce pourcentage avec ceux de ses sous-fonctions.

La recherche trie toute la liste ouverte à chaque extraction, construit à nouveau les voisins, alloue des chemins et rescane les joueurs actifs pour tester les obstacles. Ces opérations sont répétées au cours des évaluations de l’IA. Le terrain contient seulement 96 cases : des structures simples et bornées suffisent.

**Correction recommandée, par petites étapes :** pré-calculer les voisins des cases ; construire un index d’occupation pour une évaluation donnée ; remplacer le tri répété par une file de priorité conservant exactement les critères de départage ; ensuite seulement examiner les recherches identiques répétées. Un cache doit être invalidé dès qu’un déplacement, une réaction, un KO ou une prise change l’état pertinent.

**Validation attendue :** comparer intégralement les événements, états et RNG sur les mêmes seeds avant/après, y compris diagonales, terrain humide et déplacements de joueurs agrippés. Aucun gain de CPU d’une nouvelle implémentation n’a encore été mesuré.

### 5. P2 — Plusieurs accès serveur chargent plus de données que nécessaire

Sources : [lecture d’autorisation](E:/antigravity/the-hub/rumbleball/online/server.mjs:28), [nouvelle lecture dans update](E:/antigravity/the-hub/rumbleball/online/server.mjs:7), [résumés de ligues](E:/antigravity/the-hub/supabase/functions/_shared/rumbleball.ts:24).

Une commande de préparation lit l’état pour vérifier l’appartenance, puis `update` le relit avant sa première tentative. La reproduction avec un stockage factice confirme **deux lectures pour un seul changement de couleur et un commit**, sans conflit. Pour rejoindre, le résultat de la recherche par invitation est également relu.

La liste des ligues demande `bots:state->bots` : elle récupère les clubs complets des bots pour calculer seulement `bots.length`. Une liste de résumés ne devrait pas transporter effectifs, marchés et transactions des bots entre PostgreSQL et l’Edge Function.

**Correction recommandée :** réutiliser la ligne déjà lue pour la première tentative, puis relire seulement sur conflit en revérifiant les conditions de la commande. Exposer un `bot_count` scalaire dans la projection SQL des résumés. Garder les vérifications d’accès et le compare-and-swap existants.

### 6. P2 — L’onglet Ligue se reconstruit même sans changement

Sources : [condition de rendu](E:/antigravity/the-hub/rumbleball/online/ui.mjs:55), [reconstruction](E:/antigravity/the-hub/rumbleball/online/ui.mjs:144).

`tab === 'Ligue'` force `renderLeague()` à chaque `get`, même quand `changed` est faux. Cette fonction remplace tout le contenu. Avec deux clubs et une révision fixe, le [scénario de reproduction](E:/antigravity/the-hub/output/rumbleball-performance-audit-2026-10-22/ui-probe.json) constate **68 éléments HTML créés pour un seul polling inchangé**, avec remplacement du nœud de classement.

**Correction recommandée :** comparer une signature des données réellement affichées et conserver les nœuds tant qu’elles sont identiques. Mettre à jour séparément les horaires et statuts qui peuvent changer avec l’heure serveur. Vérifier focus, défilement et modales dans un vrai navigateur. Le Direct dispose déjà d’une mise à jour dédiée et d’une clé de frame ; préserver ce fonctionnement.

### 7. P2 — Les délais serveur et les mesures de coût restent incomplets

Sources : [stockage ligue](E:/antigravity/the-hub/supabase/functions/_shared/rumbleball.ts:6), [stockage solo](E:/antigravity/the-hub/supabase/functions/_shared/solo.ts:3), [API](E:/antigravity/the-hub/supabase/functions/rumbleball-api/index.ts:12).

Les appels worker de réservation et commit ont un délai explicite de dix secondes. Les autres lectures et écritures applicatives n’en définissent pas dans ces adaptateurs. Le délai client de quinze secondes borne l’attente de l’interface ; le code ne propage pas cette échéance à l’ensemble des accès Auth/DB de l’API. La limite SQL de trente secondes vise les transactions inactives et ne constitue pas un budget global pour une commande.

Le code ne mesure pas séparément les temps d’authentification, lecture, projection, calcul et commit. Le [diagnostic SQL manuel existant](E:/antigravity/the-hub/supabase/rumbleball-health.sql) reste utile, mais ne donne pas ces distributions par requête.

**Correction recommandée :** budgets serveur explicites et cohérents avec le client, puis mesures structurées des étapes, tailles de documents, conflits, erreurs et retard des échéances. Une écriture dont la réponse est perdue reste d’issue inconnue : préserver les identifiants d’écriture idempotents du solo et ne pas ajouter de retries automatiques à des mutations qui n’ont pas cette garantie.

## Optimisations secondaires

- **Sauvegardes solo :** `persistCareer` réutilise l’export JSON indenté destiné à l’utilisateur. Sur la carrière mesurée, il pèse 172 566 octets contre 85 657 pour le même document compact, soit environ 50 % de moins avant compression. Séparer export lisible et sérialisation interne. Le délai de synchronisation de 400 ms regroupe déjà des changements ; il ne supprime pas la validation, la sérialisation et l’écriture de la copie locale à chaque tour. Conserver la durabilité immédiate de l’outbox.
- **Chargement initial :** le graphe statique de `app.mjs` atteint 57 modules locaux, 556 559 octets de JS et dix feuilles CSS totalisant 172 846 octets avant compression, hors images, polices et SDK externe. `session-ui.mjs` importe statiquement solo, match et multi. Des imports différés après connexion et par mode peuvent réduire le coût d’ouverture ; mesurer d’abord le démarrage avec cache froid. La taille seule n’établit pas un problème de latence actuel.
- **Animation :** l’échantillonnage d’une frame prend environ 0,05 ms en médiane ; construire un plan de ronde prend 4,5 ms dans le scénario mesuré. Ces mesures excluent SVG, style et peinture. Elles ne justifient pas de réécrire le lecteur avant les problèmes précédents. Le code réutilise déjà les pions, évite plusieurs rendus via des signatures et suspend des traitements quand la page est cachée.

## Ordre de travail proposé

| Lot | Contenu | Critère de résultat |
| --- | --- | --- |
| 1 — Réductions ciblées | Projection sans animations hors Direct ; suppression de la double lecture ; compteur de bots ; arrêt des rendus inchangés | Mesurer les octets et accès supprimés, conserver navigation, focus et horaires exacts |
| 2 — Persistance des matchs | `rb_matches` et `rb_match_rounds`, API et worker adaptés, migration vérifiée | Coût d’un checkpoint indépendant des rondes des autres matchs ; intégrité des replays et des règlements |
| 3 — Réactivité solo et moteur | Calculs longs dans un Web Worker ; optimisation des déplacements sous comparaison déterministe | Interface disponible pendant le règlement ; temps CPU inférieur à résultats strictement identiques |
| 4 — Exploitation et historique | Échéances serveur, métriques, pagination, puis file de tâches bornée et reprise explicite | Identifier le poste lent et le retard réel ; limiter les tentatives et le volume historique |

Des mesures minimales par étape sont à ajouter dès le premier lot. La séparation complète des clubs et une file de tâches plus élaborée peuvent suivre la séparation des matchs. La révision actuelle protège déjà les commits concurrents ; une future réservation par tâche devra en plus refuser explicitement le jeton d’un worker expiré.

## Vérifications exécutées

**55 tests ciblés réussis**, en série via `tools/check-rumbleball.mjs` :

| Fichier | Réussis |
| --- | ---: |
| `online/network-resilience.test.mjs` | 3 |
| `online/worker-claim.test.mjs` | 3 |
| `online/replay-codec.test.mjs` | 5 |
| `online/compacted-replay.test.mjs` | 1 |
| `solo-sync.test.mjs` | 9 |
| `round-playback.test.mjs` | 17 |
| `online/ui.test.mjs` | 13 |
| `online/solo-service.test.mjs` | 4 |

Le benchmark et la reproduction UI terminent également avec un code de sortie nul. Les tests utilisent notamment les vrais états et événements pour vérifier les codecs, les reprises, les conflits et les animations.

La suite `engine.test.mjs`, qui contient une campagne de 500 matchs, n’a pas été validée intégralement : deux tentatives, dont une avec filtre d’exclusion, ont été arrêtées par le garde-fou de 60 secondes du lanceur. Elles ne sont pas comptées parmi les tests réussis. Les suites suivantes de ces commandes n’ont pas été exécutées ; UI et service solo ont ensuite été relancés séparément avec succès. Aucun test de charge distant ni benchmark mobile n’a été effectué.
