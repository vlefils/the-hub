# Activation du multijoueur — 18 octobre 2026

Le service Rumbleball a été installé sur le projet Supabase déjà utilisé par Riftbound Tracker. Les deux tables privées `rb_leagues` et `rb_memberships`, la fonction d’écriture atomique, l’API et le worker sont déployés. Le déclencheur `rumbleball-evenings` est actif toutes les dix secondes.

Seules les URLs de retour de Rumbleball ont été ajoutées à Auth. Les deux entrées Riftbound, l’URL principale, la confirmation des e-mails et les autres réglages existants ont été conservés. La CLI a confirmé la modification d’une seule propriété. La session du site utilise sa propre clé de stockage ; les comptes Auth restent partagés avec Riftbound.

## Essai hébergé

Une ligue temporaire de quatre clubs a joué deux rencontres avec la stratégie Conservation et des effectifs identiques de six joueurs niveau 1. Seule cette ligue de validation avait une échéance avancée : les ligues normales restent à 20 h Europe/Paris.

- Quatre comptes temporaires ont été créés et confirmés via des liens générés par l’administration Auth, sans envoyer d’e-mail. Connexion par mot de passe réussie.
- Création, invitation, achat dans la préparation, annulation et restitution intégrale du solde vérifiés par l’API déployée.
- Requêtes anonymes refusées par les deux fonctions. Accès à une ligue sans en être membre refusé. Lecture directe des états privés et écriture RPC depuis un rôle navigateur refusées.
- Le vrai déclencheur périodique a démarré la soirée, figé tous les clubs et appliqué le revenu et les salaires une seule fois.
- Les deux rencontres ont été calculées par le worker, un round par appel. Deux spectateurs ont reçu le même match en cours, sans graine privée ni résultat du match suivant.
- Premier coup d’envoi : **09:58:36,895**, fin **10:00:40,395**. Deuxième coup d’envoi : **10:02:40,395**, fin **10:04:43,895**, heure de Paris. La pause réelle était donc de **120 secondes**. Chaque match comptait dix rounds de douze secondes, plus les 3,5 secondes d’introduction.
- Le déclencheur a réglé les deux rencontres puis rouvert la gestion : 210 chromas de revenu, 90 de salaires, 100 de bonus pour chacun des deux vainqueurs. Soldes finaux : deux clubs à 720, deux à 820, depuis un solde initial de 600 chacun.
- XP des titulaires et remplaçants, fatigue selon la participation et les KO vérifiées. Deux appels supplémentaires du worker n’ont modifié ni argent, ni progression, ni résultats.
- Récupération de mot de passe vérifiée : bon retour sur Rumbleball, changement du mot de passe et nouvelle connexion réussie, sans envoi d’e-mail.
- La ligue et les quatre comptes temporaires ont été supprimés après l’essai. Aucun compte existant de Riftbound n’a été utilisé ou modifié.

Les [données de validation](online-activation-2026-10-18.json) conservent les horaires, contrôles, temps de réponse des appels worker et empreintes des sources. Ces temps mesurent les appels réseau complets, pas le temps CPU isolé. Le test ne valide pas la délivrance réelle des e-mails par le fournisseur de messagerie : les confirmations et récupérations ont été exercées sans messages sortants.

## Interface et tests locaux

Le salon actualise les arrivées sans reconstruire un formulaire inchangé et suspend cette actualisation pendant la saisie. Les modifications restent enregistrables et annulables avant l’échéance. Le lecteur reprend à la bonne position dans un round reçu en cours de lecture.

Les 17 tests ciblés du multi passent après activation. La suite de non-régression de 289 tests, la migration dans PostgreSQL embarqué et la vérification Deno des deux fonctions avaient été validées lors de la préparation. Aucun code du moteur de jeu n’a changé pendant cette activation. Les tests de rendu utilisent le DOM de test ; ils ne constituent pas une inspection visuelle en navigateur.
