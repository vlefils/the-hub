# Accueil, reprise et échéance du recrutement — 21 octobre 2026

Les ligues rejointes figurent dans Mes parties avec leur état et leur nombre de clubs. Chaque entrée ouvre directement la ligue. Les erreurs de liste solo et multijoueur sont indépendantes.

La navigation est conservée par compte et par onglet du navigateur, après authentification : accueil, carrière et Club/Ligue, rencontre solo en pause, préparation d’Exhibition, liste des ligues, ligue et replay. Une rencontre reprise ne prélève pas de salaires et ne démarre pas automatiquement. Les modales temporaires et la position de lecture d’un replay ne sont pas restaurées. Un identifiant inaccessible revient à la liste avec une explication.

À l’horaire du premier match, le worker recrute automatiquement les effectifs humains non validés : six contrats du marché initial, un capitaine, deux béliers, deux escamoteurs et un passeur. Les cinq premiers sont titulaires. Les contrats utilisent le budget du club et les armes de base habituelles. Un effectif déjà validé est conservé. Le verrouillage serveur s’applique également au recrutement ; les réessais de concurrence ne doublent ni contrats ni salaires. Un worker retardé démarre une seule soirée au moment de son passage.

## Validation locale

78 tests réussis, avec exécution séquentielle limitée à 256 Mo par processus et 60 secondes par fichier :

```powershell
node tools/check-rumbleball.mjs rumbleball/navigation.test.mjs rumbleball/session-ui.test.mjs rumbleball/career-ui.test.mjs rumbleball/online/recruitment.test.mjs rumbleball/online/ui.test.mjs rumbleball/online/broadcast-ui.test.mjs
```

Le dernier ajout, l’isolation entre onglets, a été contrôlé en relançant seulement session-ui.test.mjs (17 tests réussis). Aucun tunnel externe, aucune simulation de saison complète supplémentaire. Les parcours d’interface ont été contrôlés sur le DOM de test ; pas de validation visuelle navigateur pour cette passe.

## Supabase

Projet existant : `yvzshvqmgpjkixoxddng`.

- API version 19 et worker version 17 déployés, tous deux ACTIVE.
- Migration `20261021090000_rumbleball_recruitment_deadline.sql` appliquée via la Management API. La fonction de commit programme les états recruitment et preparation ; les ligues existantes en recrutement sont reprogrammées.
- Vérification SQL : aucun recrutement sans next_tick_at ; cron rumbleball-evenings actif ; seul service_role peut appeler la fonction de commit.
- Projection cloud HTTP 200, API anonyme HTTP 401.

Les modifications de l’interface et les versions des imports sont livrées avec ce changement.
