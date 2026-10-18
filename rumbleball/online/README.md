# Multijoueur — socle préparé

## État de livraison

Le code du navigateur, les transitions de ligue, les fonctions Edge, la migration et le déclencheur périodique sont préparés. L’interface est accessible par `../multi.html` et par **Multijoueur** dans le jeu.

**Les ligues en ligne ne sont pas encore ouvertes.** `config.mjs` conserve `enabled: false` jusqu’à l’installation du serveur. L’écran l’annonce ; il ne propose pas de créer des comptes pour un service indisponible.

La configuration publique et les accès API ont été récupérés du projet local Riftbound Tracker. Le contrôle distant du 18 octobre 2026 confirme Auth HTTP 200 et l’absence de `rb_leagues` HTTP 404. Aucune table distante, aucun compte utilisateur, aucun réglage Auth de Riftbound n’a été modifié. Les clés privées sont uniquement dans le dossier local ignoré `.local/` et ne doivent jamais être placées dans le code du site.

La CLI Supabase 2.121.0 a ensuite retrouvé une session donnant accès au projet ; la lecture SQL via Management API a confirmé l’absence de Rumbleball et la disponibilité de Vault. L’installation distante n’a pas été exécutée : la vérification automatique a refusé la commande de migration/déploiement avec `--no-verify-jwt`, en demandant une autorisation explicite au-delà de la préparation. Il reste donc à autoriser puis appliquer la migration, déployer les deux fonctions et configurer le déclencheur.

## Règles retenues

- Ligue privée de 2, 4, 6 ou 8 clubs, six par défaut ; un utilisateur possède un club par ligue. Le créateur partage un code et lance la saison lorsque tous les clubs sont présents.
- Club neuf de six recrues de niveau 1 ; 2 400 chromas moins 1 800 de contrats, soit 600 disponibles. Les carrières locales ne peuvent pas être importées dans une ligue.
- Saison aller-retour : `2 × (clubs − 1)` journées. Une journée par soirée. Classement 3/1/0, puis victoires, puis ordre d’inscription. Nouvelle saison automatique, progression et équipement conservés, fatigue remise à zéro.
- **20 h Europe/Paris**, en tenant compte des changements d’heure. Toutes les équipes sont figées à cette heure, y compris celles qui joueront plus tard.
- Matchs successifs dans chaque ligue. Le match suivant commence deux minutes après la fin du précédent. Les autres ligues peuvent avoir leur propre soirée en parallèle.
- Décompte réservé de 3,5 secondes, puis dix rounds de douze secondes. Les prolongations du moteur prolongent aussi le créneau de diffusion avant la pause.
- La gestion rouvre après la dernière rencontre de la soirée. Sans nouvelle préparation, le club reconduit automatiquement son équipe.
- **210 chromas par journée**, versés au verrouillage, puis prélèvement des salaires de tout l’effectif. **+100 en cas de victoire**, au terme de sa diffusion ; aucune prime supplémentaire pour nul/défaite ni prime de classement dans ce mode.
- 210 couvre six salaires au niveau 5. Les septième et huitième joueurs augmentent les dépenses. Les achats ne créent pas de découvert ; seuls les salaires peuvent le faire. Le revenu et les ventes réduisent une dette existante.

## Préparation annulable

Chaque membre possède un `club` acquis et une `draft` optionnelle, enregistrée côté serveur. Composition, rôles, consignes, déploiement, couleur, recrutements, cessions et équipement modifient cette préparation.

Les achats et ventes sont comptabilisés dans le solde prévisionnel. **Annuler la préparation** restaure intégralement le club précédent, y compris les contrats et opérations d’équipement de cette préparation. Ce n’est pas une annulation de salaire, d’XP ou de résultat déjà acquis.

À 20 h, la préparation entière est adoptée, ou le club précédent est reconduit. Le verrouillage est contrôlé par l’horloge PostgreSQL lors de l’écriture, même si le worker n’a pas encore lancé sa première exécution. Un formulaire ouvert avant 20 h ne donne aucun droit d’enregistrer après cette limite.

## Architecture

`league.mjs` définit les transitions pures. Il réutilise les règles de gestion existantes et le même moteur de match, sans modifier les statistiques. `server.mjs` applique des commandes explicites ; le navigateur ne peut envoyer ni un état de club complet, ni un résultat de match, ni son identité supposée.

`rumbleball-api` vérifie la session auprès de Supabase Auth et l’appartenance à la ligue. `rumbleball-worker` exige un secret distinct, connu uniquement du serveur et de Vault. Une invocation traite **au plus un round d’une ligue** ; cela évite de résoudre toute la soirée sous le budget CPU d’une seule requête Edge.

Le worker remplit les prochains rounds en avance. Leur diffusion dépend de l’heure serveur, pas de la vitesse de calcul ni de la présence de spectateurs. Les salaires sont débités au verrouillage, puis XP, fatigue et bonus sont réglés à l’heure de fin de chaque rencontre. Les appels concurrents utilisent une révision et un verrou de ligne ; un conflit recharge l’état avant de recalculer. Un round déjà enregistré, un salaire ou une récompense ne sont pas rejoués.

Le navigateur demande une projection de la ligue toutes les quatre secondes pendant la soirée. Il reçoit le round en cours, mais aucune préparation adverse, graine privée ou prochain round. Le lecteur utilise les images et événements fournis par le serveur ; il ne simule pas la rencontre. Un spectateur arrivé en cours de round rejoint l’animation à l’instant correspondant. Les contrôles de vitesse, d’avance et de résultat immédiat sont masqués et ne pilotent pas le serveur.

L’animation d’un round implique d’en transmettre les événements au début de ses douze secondes : un client inspectant ses requêtes peut voir ces actions avant leur présentation à l’écran. Le verrouillage empêche d’en tirer parti pour modifier l’équipe. Ce n’est pas un protocole de jeu avec actions secrètes pendant le match.

Les tables `rb_leagues` et `rb_memberships` sont isolées par leur préfixe. Leur RLS est active et les rôles navigateur n’ont aucun accès direct. Les états internes contiennent les futurs résultats ; seule la projection filtrée de l’API est consultable. La clé publique ne permet pas de lire ou d’écrire ces états. L’unique fonction d’écriture atomique est réservée au rôle serveur.

## Activation du projet Supabase

1. Ouvrir le bon projet, puis appliquer **uniquement** `../../supabase/migrations/20261018090000_rumbleball.sql` dans l’éditeur SQL. Le projet partagé possède déjà son historique Riftbound : ne pas lancer un reset ou une synchronisation de migrations globale depuis ce dépôt.
2. Avec la CLI Supabase connectée à ce projet, déployer depuis la racine du dépôt :

   ```sh
   supabase functions deploy rumbleball-api --project-ref PROJECT_REF --no-verify-jwt --use-api
   supabase functions deploy rumbleball-worker --project-ref PROJECT_REF --no-verify-jwt --use-api
   ```

   La vérification de session de l’API est explicite dans le code ; le worker vérifie son secret. La désactivation de la vérification JWT du relais ne rend pas ces routes publiques.
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
6. Tester avec deux comptes : inscription, confirmation, connexion, création/invitation, annulation d’achat, verrouillage et une soirée complète. Ne pas utiliser de faux comptes ou un raccourci de simulation en production pour valider les finances.
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

Les tests couvrent les changements d’heure, l’annulation, les limites d’effectif reprises du mode solo, l’argent, le calendrier, deux saisons, les appels concurrents, le calcul fractionné équivalent au calcul complet, la projection privée, le mode spectateur et sa reprise en milieu de round. Les tests d’interface utilisent le DOM de test existant ; ils ne constituent pas une inspection visuelle en navigateur.

## Limites avant ouverture

- Le serveur n’a pas encore été déployé ou testé sur le projet Supabase distant. La mesure CPU et les délais réels du worker devront être contrôlés lors du premier essai hébergé.
- Un retard initial du planificateur peut décaler le début de diffusion de quelques secondes ; le verrouillage reste à 20 h. En cas d’indisponibilité prolongée, une seule soirée est reprise et les journées manquées ne s’accumulent pas en saisons et revenus rétroactifs. Un round indisponible affiche une attente explicite, sans inventer un résultat local.
- Les états de diffusion sont stockés dans un document privé par ligue. C’est adapté à cette première version de petites ligues ; pour une ouverture large, séparer les rounds en lignes ou objets de stockage et répartir davantage le travail. La liste des ligues utilise des colonnes légères et ne charge pas ces documents.
- Pas encore de départ de ligue, dissolution, remplacement de participant, ligue publique ou chat. Huit ligues créées maximum par compte. L’historique conserve les scores, mais le lecteur ne propose pas encore les replays d’anciennes soirées.
- Le protocole d’état est en version 1 ; une migration de données sera nécessaire lors d’un changement incompatible de moteur ou de format de ligue. Ne pas changer le moteur d’une soirée en cours.

Références : [Auth](https://supabase.com/docs/guides/auth/passwords), [permissions RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [planification](https://supabase.com/docs/guides/functions/schedule-functions), [limites Edge](https://supabase.com/docs/guides/functions/limits), [requêtes pg_net](https://supabase.com/docs/guides/database/extensions/pg_net).
