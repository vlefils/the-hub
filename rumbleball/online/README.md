# Multijoueur — ligues Supabase

## État de livraison

Le lot de performance du 22 octobre prépare des lectures légères, le stockage des matchs et rondes hors de la ligue et des délais serveur partagés. Voir [les corrections, les tests et l’ordre d’activation](../playtests/performance-fixes-2026-10-22.md). Le push seul n’applique pas sa migration et ne redéploie pas les fonctions ; déployer les deux lecteurs avant d’activer `RB_SPLIT_MATCH_STORAGE`.

Le multijoueur est ouvert sur `../multi.html`, également accessible par **Multijoueur** dans le jeu. Les tables privées, l’API, le worker et le déclencheur périodique sont installés sur le projet Supabase de Riftbound Tracker. `config.mjs` active maintenant le service.

L’activation du 18 octobre 2026 a été vérifiée avec une vraie soirée de quatre clubs temporaires : deux matchs, deux minutes de pause, verrouillage, salaires, revenus, bonus et progression. Les comptes et la ligue de validation ont ensuite été supprimés. Le [compte rendu](../playtests/online-activation-2026-10-18.md) détaille les contrôles et leurs limites.

Seules les URLs de retour de Rumbleball ont été ajoutées aux réglages Auth ; les réglages et données de Riftbound ont été conservés. Les clés privées restent dans le dossier local ignoré `.local/` et dans les secrets du serveur. Le site utilise uniquement une clé publique.

Le batch replays/KO du 18 octobre est validé localement. Le propriétaire a confirmé l’application de la migration `20261018210000_rumbleball_replays.sql` et le déploiement réussi des deux fonctions. La publication des fichiers du site complète cette mise à jour ; les contrôles locaux ne remplacent pas une nouvelle soirée de validation hébergée.

## Règles retenues

Tout le jeu utilise maintenant la connexion commune : solo, Exhibition et ligues. **Mes parties** ouvre les carrières enregistrées sur le compte ; **Ligues multijoueurs** mène à cet espace. Une carrière locale est sauvegardée automatiquement à la connexion, y compris en arrivant directement par `multi.html`. Les parties solo sont isolées dans `rb_solo_saves` et ne peuvent pas être importées dans une ligue. Appliquer uniquement `20261019200000_rumbleball_solo.sql` puis redéployer l’API pour activer ce stockage ; la migration ne change pas les tables de ligue ni les réglages Auth partagés.

- Ligue privée avec salle d’attente ouverte : aucun nombre de clubs à choisir à la création. Un utilisateur possède un club par ligue. Le créateur partage le code, peut ajouter ou retirer des bots et lance la saison à partir de deux clubs. Le nombre d’inscrits est alors figé ; une limite technique de 128 clubs protège le calendrier et le tableau de playoffs. Les anciennes salles d’attente deviennent également ouvertes.
- Club neuf de six recrues de niveau 1 ; 2 400 chromas moins 1 800 de contrats, soit 600 disponibles. Les carrières locales ne peuvent pas être importées dans une ligue.
- Phase de groupe aller-retour : `2 × (clubs − 1)` journées si le total est pair, `2 × clubs` s’il est impair. Chaque club rencontre les autres à domicile et à l’extérieur ; un total impair donne deux journées de repos par club, avec récupération et XP de banc, sans résultat fictif. Une journée par soirée. Classement 3/1/0, puis victoires, puis ordre d’inscription. Elle est suivie des playoffs ; la nouvelle saison démarre automatiquement après leur finale, avec progression et équipement conservés et fatigue remise à zéro.
- **20 h Europe/Paris**, en tenant compte des changements d’heure. Toutes les équipes sont figées à cette heure, y compris celles qui joueront plus tard.
- Matchs successifs dans chaque ligue. Le match suivant commence deux minutes après la fin du précédent. Les autres ligues peuvent avoir leur propre soirée en parallèle.
- Décompte réservé de 3,5 secondes, puis dix rounds de douze secondes. Les prolongations du moteur prolongent aussi le créneau de diffusion avant la pause.
- Les nouvelles rencontres utilisent les règles v7 : cinq joueurs KO entraînent la défaite immédiate de l’équipe, et Percussion, Exploitation sportive, Appel de jeu et Lecture de trajectoire se débloquent au niveau 3. Les autres techniques sont initiales. Les rencontres et replays v2 à v6 conservent leurs règles. Redéployer `rumbleball-api` et `rumbleball-worker` ; aucun SQL supplémentaire.
- La gestion rouvre après la dernière rencontre de la soirée. Sans nouvelle préparation, le club reconduit automatiquement son équipe.
- **210 chromas par journée**, versés au verrouillage, puis prélèvement des salaires de tout l’effectif. **+100 en cas de victoire**, au terme de sa diffusion ; aucune prime supplémentaire pour nul/défaite ni prime de classement dans ce mode.
- Dix joueurs maximum, dont cinq titulaires. 210 couvre six salaires au niveau 5 ; chaque remplaçant supplémentaire augmente les dépenses. Les achats ne créent pas de découvert ; seuls les salaires peuvent le faire. Le revenu et les ventes réduisent une dette existante.

### Playoffs

Les 50 % premiers sont arrondis au multiple de quatre supérieur, dans la limite des inscrits : **2 qualifiés sur 2**, **3 sur 3**, **4 sur 4 à 8**, **8 sur 9 à 16**. Les places sont signalées dans le classement de groupe avec la légende « Les X premières équipes se qualifient pour les playoffs. » Quatre qualifiés donnent les demi-finales 1er–4e et 2e–3e, puis une finale dans un tableau fixe. Le tableau gère aussi les exemptions des meilleures têtes de série pour un nombre de qualifiés qui n’est pas une puissance de deux.

### Bots

Les bots sont des clubs gérés par le serveur, sans compte Auth ni accès à l’API. Seul le créateur peut les ajouter ou les retirer avant le lancement. Ils sont identifiés dans la salle d’attente, qui se rafraîchit toutes les quatre secondes sans reconstruire la préparation en cours.

Chaque bot commence avec les mêmes six joueurs et 600 chromas qu’un humain. Au verrouillage, il paie les mêmes salaires, reçoit le même revenu, attribue ses gains de caractéristiques, recrute selon les postes disponibles et fait tourner les joueurs selon leur fatigue. Il équipe des armes contondantes gratuites puis achète protections, implants et armes avancées avec la logique commune aux adversaires de campagne. Les prix du catalogue s’appliquent et le budget d’achat réserve la prochaine masse salariale. Les achats ne sont effectués qu’une fois par journée et sont compilés dans les équipes des matchs et replays.

Les bots résident dans le champ JSON `bots`, séparé de `members` réservé aux utilisateurs Auth. Aucune migration SQL supplémentaire : redéployer l’API et le worker. La liste des ligues compte les humains et les bots sans transmettre les clubs privés.

Au règlement de la dernière soirée de groupe, le serveur fige les têtes de série et retire **toute la fatigue de tous les joueurs**, remplaçants compris. Les demi-finales se jouent à 20 h lors de la soirée suivante ; la finale lors de celle d’après. Une ligue de deux clubs passe directement à sa soirée de finale. La fatigue reste acquise entre deux tours. Sans vainqueur après les prolongations habituelles, le meilleur classement de groupe qualifie l’équipe ; le replay conserve le résultat nul.

Les points du groupe ne comptent que les matchs de groupe. Les qualifiés reçoivent l’XP, la fatigue et les primes de victoire habituelles de leurs matchs ; les clubs éliminés ne reçoivent pas d’XP sans match. Le revenu de ligue et les salaires restent appliqués à tous les membres lors de chaque soirée. La préparation reste annulable et le verrouillage de 20 h reste identique.

Le tableau n’expose que les qualifications réglées à l’heure de fin de diffusion, même si le worker a déjà calculé la rencontre. Les replays, le champion et les tableaux des saisons terminées sont conservés ; la saison suivante commence après la finale. Les ligues existantes rejoignent ce cycle à la fin de leur groupe courant. Les métadonnées résident dans le JSON existant : redéployer les deux fonctions, sans nouvelle migration SQL.

Les noms des joueurs et des offres suivent le format `Prénom "Pseudo" Nom`, avec 393 216 combinaisons. Chaque archétype possède seize pseudos cyberpunk dédiés ; les titres genrés sont accordés au portrait, les handles techniques sont épicènes. Les portraits androgynes reçoivent des prénoms épicènes et des pseudos neutres. Les anciens alias sont remplacés en conservant le prénom et le nom conformes ; un changement de rôle tactique ne change pas le pseudo. Leur génération publique est indépendante de la graine secrète des rencontres. La limite de dix et la génération des identités sont également serveur : après cette mise à jour, redéployer `rumbleball-api` et `rumbleball-worker` avec les commandes de la section Installation. Aucune migration SQL supplémentaire n’est nécessaire.

Les caractéristiques suivent les [règles de progression communes](../README.md#carrière) : tirage persistant de 59 points (8–15), tri par classe, niveaux 1–12, maîtrise +2/+3/+4/+5, améliorations au choix aux niveaux 3/6/9/12 et récupération du banc liée à la Constitution. La modale de recrutement affiche les scores avant contrat. Les protections donnent de la CA, jamais de PV. Les anciens clubs reçoivent leur tirage sans recalculer les images des matchs déjà figés. Les champs sont enregistrés dans le JSON existant ; redéployer les deux fonctions suffit, sans SQL supplémentaire.

## Préparation annulable

Chaque membre possède un `club` acquis et une `draft` optionnelle, enregistrée côté serveur. Composition, rôles, consignes, déploiement, couleur, recrutements, cessions, équipement et attribution des points de caractéristiques modifient cette préparation. L’action `advance` accepte seulement l’identifiant d’un joueur du club et deux points légaux ; elle refuse un palier déjà dépensé, un total différent de deux, une caractéristique inconnue ou un dépassement de 20.

L’équipement utilise le même mannequin à sept slots que le solo : tête, torse, gants, bottes, implant et deux mains. Les actions `buy` et `equip` acceptent une `location` ; le serveur vérifie sa compatibilité et résout les conflits d’emplacements. Une arme à deux mains occupe les deux mains, sans cumuler ses bonus deux fois ; un second bouclier remplace le premier. Les pièces remplacées restent en réserve. Les armes et la seconde attaque des armes légères sont compilées dans les effectifs figés et leurs replays. L’interface conserve le joueur, la main sélectionnée et les tactiques non enregistrées après un achat. Les anciens enregistrements restent compatibles par inférence de la zone de protection. Aucune nouvelle table ou migration SQL n’est nécessaire ; les deux fonctions doivent être redéployées avec les nouveaux modules.

Les achats et ventes sont comptabilisés dans le solde prévisionnel. **Annuler la préparation** restaure intégralement le club précédent, y compris les contrats, opérations d’équipement et choix de caractéristiques de cette préparation ; les points redeviennent disponibles. Ce n’est pas une annulation de salaire, d’XP ou de résultat déjà acquis.

Le catalogue partagé propose 29 objets, dont cinq armes de dotation gratuites et 15 nouveaux modèles illustrés. Seules les armes contondantes non létales sont autorisées. L’action `buy` conserve son nom pour équiper une dotation à prix zéro : le serveur impose le prix du catalogue, réutilise la réserve libre et ne crée aucun revenu lors de sa restitution. La dotation reste accessible à découvert, mais le verrouillage de la rencontre s’applique toujours. Les modèles payants ajoutent des bonus propres à l’arme, également calculés pour la main secondaire ; les armures ajoutent de la CA et aucun PV. Aucun SQL supplémentaire : redéployer les deux fonctions suffit.

À 20 h, la préparation entière est adoptée, ou le club précédent est reconduit. Le verrouillage est contrôlé par l’horloge PostgreSQL lors de l’écriture, même si le worker n’a pas encore lancé sa première exécution. Un formulaire ouvert avant 20 h ne donne aucun droit d’enregistrer après cette limite.

## Architecture

`league.mjs` définit les transitions pures. Il réutilise les règles de gestion existantes et le même moteur de match, sans modifier les statistiques. `server.mjs` applique des commandes explicites ; le navigateur ne peut envoyer ni un état de club complet, ni un résultat de match, ni son identité supposée.

`rumbleball-api` vérifie la session auprès de Supabase Auth et l’appartenance à la ligue. `rumbleball-worker` exige un secret distinct, connu uniquement du serveur et de Vault. Une invocation traite **au plus un round d’une ligue** ; cela évite de résoudre toute la soirée sous le budget CPU d’une seule requête Edge.

Le worker remplit les prochains rounds en avance. Leur diffusion dépend de l’heure serveur, pas de la vitesse de calcul ni de la présence de spectateurs. Les salaires sont débités au verrouillage, puis XP, fatigue et bonus sont réglés à l’heure de fin de chaque rencontre. Les appels concurrents utilisent une révision et un verrou de ligne ; un conflit recharge l’état avant de recalculer. Un round déjà enregistré, un salaire ou une récompense ne sont pas rejoués.

Le navigateur demande une projection de la ligue toutes les quatre secondes pendant la soirée. Il reçoit le round en cours, mais aucune préparation adverse, graine privée ou prochain round. Le lecteur utilise les images et événements fournis par le serveur ; il ne simule pas la rencontre. Un spectateur arrivé en cours de round rejoint l’animation à l’instant correspondant. Les contrôles de vitesse, d’avance et de résultat immédiat sont masqués et ne pilotent pas le serveur.

L’animation d’un round implique d’en transmettre les événements au début de ses douze secondes : un client inspectant ses requêtes peut voir ces actions avant leur présentation à l’écran. Le verrouillage empêche d’en tirer parti pour modifier l’équipe. Ce n’est pas un protocole de jeu avec actions secrètes pendant le match.

## Replays

L’onglet **Replays** affiche les rencontres terminées de la ligue, par soirée décroissante. Le lecteur propose lecture, pause à la fin du round courant, vitesses ×1/×2/×4/×8, retour au début et parcours des fins de round. Il lit les images et le journal archivés, sans relancer le moteur, les salaires ou les récompenses. Il reste accessible pendant le verrouillage de la soirée suivante. Sur mobile, Équipement et Replays sont directement visibles dans la navigation ; les réglages individuels se trouvent sous le joueur sélectionné.

La table privée `rb_replays` archive les images au moment où le résultat est réglé, dans la même transaction PostgreSQL. Les archives résistent au remplacement de la soirée courante et ne sont pas réécrites par un nouvel appel du worker. L’action API `replay` vérifie l’appartenance à la ligue et la fin de la rencontre avant de lire l’archive ; elle filtre les graines et l’état du hasard comme la diffusion en direct. Aucun accès navigateur direct n’est accordé à cette table.

### Stockage compact des rencontres

Depuis le 21 octobre 2026, les nouvelles rondes utilisent `rb-round-delta-v1` : un état de départ indépendant par ronde, un dictionnaire de chemins référencés par nombres et les seules modifications de chaque action. Le moteur conserve son dernier état complet pour reprendre le calcul. Le direct décode uniquement la ronde publique courante ; le contrat envoyé au navigateur reste identique. Les rondes historiques avec `before`/`after` complets restent lisibles et peuvent coexister avec de nouvelles rondes compactes dans un match repris.

À la clôture, le serveur compacte et compresse le replay en gzip, dans une enveloppe JSON `rb-replay-gzip-v1` avec identifiant de rencontre, nombre de rondes, taille décompressée et empreinte SHA-256. La taille est bornée à 8 Mio compressés et 32 Mio décompressés ; la lecture contrôle l’empreinte et borne la décompression. L’enveloppe est enregistrée dans `rb_replays` par le trigger, puis retirée de l’état actif dans la même transaction. Un conflit avec une archive différente annule la transaction. Le trigger continue de prendre en charge un ancien worker déjà en cours d’exécution.

Déploiement : appliquer `../../supabase/migrations/20261021220000_rumbleball_compressed_replays.sql`, déployer `rumbleball-api` et `rumbleball-worker`, puis seulement convertir les anciennes archives. La migration ne modifie aucune partie ni archive existante. Une version d’API capable de lire le nouveau format doit rester déployée tant que des archives compressées sont présentes.

L’outil `../../tools/compact-rumbleball-replays.mjs` prépare une sauvegarde dans un nouveau dossier dédié, vérifie tous les états reconstruits, puis permet une conversion séquentielle avec comparaison atomique de chaque original. Il ne modifie ni les ligues ni les sauvegardes solo. Fournir `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` uniquement dans l’environnement serveur local ; le dossier de sauvegarde et les fichiers de clés restent ignorés par Git.

```sh
node --max-old-space-size=128 --env-file=.local/rumbleball-supabase.env tools/compact-rumbleball-replays.mjs --project-ref=PROJECT_REF --backup-dir=.local/replay-backup
node --max-old-space-size=128 --env-file=.local/rumbleball-supabase.env tools/compact-rumbleball-replays.mjs --project-ref=PROJECT_REF --backup-dir=.local/replay-backup --apply
```

La première commande ne fait aucune écriture en base. La seconde conserve les originaux et le manifeste de migration, relit chaque archive convertie et vérifie le résultat complet. Elle peut être relancée avec le même dossier après une réponse perdue. Le nombre de résultats est contrôlé pour refuser une réponse tronquée. Voir le [contrôle du déploiement](../playtests/compressed-replays-2026-10-21.md).

La migration récupère aussi les matchs terminés de la dernière soirée encore stockée. Les soirées plus anciennes dont les images ont déjà été remplacées restent dans l’historique, avec une indication d’indisponibilité. Les replays deviennent durables à partir de l’installation de la migration.

Les tables `rb_leagues` et `rb_memberships` sont isolées par leur préfixe. Leur RLS est active et les rôles navigateur n’ont aucun accès direct. Les états internes contiennent les futurs résultats ; seule la projection filtrée de l’API est consultable. La clé publique ne permet pas de lire ou d’écrire ces états. L’unique fonction d’écriture atomique est réservée au rôle serveur.

## Installation ou réinstallation du projet Supabase

1. Ouvrir le bon projet, puis appliquer dans cet ordre `../../supabase/migrations/20261018090000_rumbleball.sql` et `../../supabase/migrations/20261018210000_rumbleball_replays.sql` dans l’éditeur SQL. Si la base Rumbleball est déjà installée, appliquer seulement la seconde migration. Le projet partagé possède déjà son historique Riftbound : ne pas lancer un reset ou une synchronisation de migrations globale depuis ce dépôt.
2. Avec la CLI Supabase connectée à ce projet, déployer depuis la racine du dépôt :

   ```sh
   supabase functions deploy rumbleball-api --project-ref PROJECT_REF --no-verify-jwt --use-api
   supabase functions deploy rumbleball-worker --project-ref PROJECT_REF --no-verify-jwt --use-api
   ```

   La vérification de session de l’API est explicite dans le code ; le worker vérifie son secret. La désactivation de la vérification JWT du relais ne rend pas ces routes publiques.
   Sous Windows, si `supabase` n’est pas dans le PATH, remplacer ce mot par `npx.cmd --yes supabase` dans les commandes ci-dessus. La CLI peut demander une connexion préalable avec `npx.cmd --yes supabase login`.
3. Générer un secret aléatoire long pour `RB_WORKER_SECRET` et le configurer comme secret de fonction. `RB_ALLOWED_ORIGINS` peut préciser les origines du site et du développement local, séparées par des virgules. Les variables `SUPABASE_*` du serveur sont fournies par Supabase ; ne pas publier le fichier de clés local.
4. Dans Supabase Vault, créer `rb_project_url` avec l’URL du projet et `rb_worker_secret` avec **le même secret** que celui du worker. Puis appliquer `../../supabase/rumbleball-cron.sql` : il appelle le worker pour chaque ligue due, toutes les dix secondes, avec un maximum de dix ligues par passage.
5. Ajouter aux URLs de redirection Auth autorisées, en conservant toutes les URLs existantes de Riftbound :

   ```text
   https://vlefils.github.io/the-hub/rumbleball/multi.html
   https://vlefils.github.io/the-hub/rumbleball/multi.html?recovery=1
   http://127.0.0.1:8765/rumbleball/multi.html
   http://127.0.0.1:8765/rumbleball/multi.html?recovery=1
   ```

   Vérifier aussi la confirmation d’e-mail et l’envoi des messages d’Auth. Ne pas remplacer l’URL principale Auth de Riftbound.
6. Tester avec des comptes de validation identifiés : confirmation, connexion, création/invitation, annulation d’achat, verrouillage et une soirée complète. Une éventuelle échéance avancée doit concerner uniquement une ligue de validation explicitement identifiée. Supprimer ces comptes et cette ligue après le test.
7. Passer `enabled` à `true` dans `config.mjs` et publier le site lorsque ce parcours fonctionne. L’URL et la clé publiable peuvent être changées ici si un projet Supabase séparé est finalement retenu.

Les comptes Auth sont partagés avec Riftbound lorsque le même projet est utilisé. La session du navigateur a une clé Rumbleball distincte et les clubs sont propres aux ligues. Pour des comptes totalement indépendants, utiliser un autre projet Supabase avant l’ouverture.

## Validation locale

Depuis la racine :

```sh
node --test rumbleball/online/league.test.mjs rumbleball/online/ui.test.mjs
cd rumbleball
node --test
```

La migration est également testée dans un vrai moteur PostgreSQL embarqué, sans toucher aux utilisateurs distants :

```sh
npm install --prefix .local/multiplayer-validation --no-save --package-lock=false --ignore-scripts @electric-sql/pglite@0.3.15 deno@2.9.6
node supabase/tests/permissions.mjs .local/multiplayer-validation/node_modules/@electric-sql/pglite/dist/index.js
```

Avec Deno disponible :

```sh
deno check --no-lock supabase/functions/rumbleball-api/index.ts supabase/functions/rumbleball-worker/index.ts
```

Les tests couvrent les changements d’heure, l’annulation, les limites d’effectif reprises du mode solo, l’argent, le calendrier, deux saisons, les appels concurrents, le calcul fractionné équivalent au calcul complet, la projection privée, le mode spectateur et sa reprise en milieu de round. Ils vérifient aussi la consultation des replays après le changement de soirée, les refus d’accès, le filtrage et l’absence de mutation par le lecteur. Le test PostgreSQL contrôle l’archivage atomique, la reprise des anciennes images, l’idempotence et les permissions. Les tests d’interface utilisent le DOM de test existant ; l’inspection visuelle en navigateur est documentée séparément.

## Limites de la première version

- Le serveur a été testé sur Supabase avec quatre clubs et deux matchs. Les temps réseau ne mesurent pas le CPU isolé ; une ouverture à grande échelle demandera une nouvelle mesure de charge.
- Un retard initial du planificateur peut décaler le début de diffusion de quelques secondes ; le verrouillage reste à 20 h. En cas d’indisponibilité prolongée, une seule soirée est reprise et les journées manquées ne s’accumulent pas en saisons et revenus rétroactifs. Un round indisponible affiche une attente explicite, sans inventer un résultat local.
- Les états de diffusion sont stockés dans un document privé par ligue. C’est adapté à cette première version de petites ligues ; pour une ouverture large, séparer les rounds en lignes ou objets de stockage et répartir davantage le travail. La liste des ligues utilise des colonnes légères et ne charge pas ces documents.
- Pas encore de départ de ligue, dissolution, remplacement de participant, ligue publique ou chat. Huit ligues créées maximum par compte. Les images de soirées remplacées avant l’installation de l’archivage ne peuvent pas être récupérées.
- Le protocole d’état est en version 1 ; une migration de données sera nécessaire lors d’un changement incompatible de moteur ou de format de ligue. Ne pas changer le moteur d’une soirée en cours.

Références : [Auth](https://supabase.com/docs/guides/auth/passwords), [permissions RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [planification](https://supabase.com/docs/guides/functions/schedule-functions), [limites Edge](https://supabase.com/docs/guides/functions/limits), [requêtes pg_net](https://supabase.com/docs/guides/database/extensions/pg_net).
