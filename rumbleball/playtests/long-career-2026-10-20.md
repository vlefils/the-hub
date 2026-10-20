# Carrière longue solo — 20 octobre 2026

## Livraison

- Nouveau choix à la création ; les sauvegardes existantes restent classiques.
- Six ligues de six clubs, dix journées puis playoffs des quatre premiers. Les deux finalistes montent et les deux derniers du groupe descendent, dans les limites de la pyramide.
- Adversaires reproductibles par division : dix joueurs, caractéristiques, niveau et équipement fixes. Seule la division active joue ses rencontres.
- Recrues de niveau dépendant uniquement de la ligue. Primes de victoire : 350 / 600 / 900 / 1 300 / 1 800 / 2 400 chromas.
- Participation : 8 XP ; banc : 4 XP ; blessure ou forfait : 0 XP ; bots : aucune XP. Avec deux participations sur trois, un joueur de niveau 1 atteint le niveau 12 après environ 116 rencontres de calendrier, soit environ dix saisons avec playoffs.
- Fatigue sur 10 : vitesse à 3, compétences physiques à 5, attaque à 8, désavantage aux d20 à 10. Constitution et implants interviennent dans la récupération.
- Blessure sur KO : 2 % à fatigue 0, 20 % à fatigue 10, interpolation linéaire et tirage reproductible. Absence pendant les 1d4 prochains matchs du club.
- Forfaits sans simulation ni faux replay, salaires conservés, récupération et règlement idempotent. Les blessés restent consultables et équipables ; les remplaçants disponibles prennent leurs places.
- Vingt objets Prototype / Singularité, disponibles immédiatement dans ce mode, illustrés à partir des familles existantes. Aucun PV d’armure, uniquement des armes contondantes non létales.
- Sauvegardes, imports, reprise de match, cache local et résumés cloud adaptés. Aucun changement de règles en classique, exhibition ou multijoueur.

## Vérifications locales

113 tests ciblés distincts passent :

| Suite | Tests exécutés |
|---|---:|
| long-career | 10 |
| long-career-ui | 7 |
| equipment | 19 |
| identity | 8 |
| career, sélection ciblée | 10 |
| career-ui | 19 |
| online/league, sélection ciblée | 16 |
| online/solo-service | 4 |
| solo-sync | 9 |
| session-ui | 11 |

Exécution par `tools/check-rumbleball.mjs` : un processus à la fois, priorité réduite, mémoire Node limitée à 256 Mo, arrêt après 60 secondes et au premier échec. Le filtre optionnel `--name=...` évite les anciennes boucles de simulation sur plusieurs saisons. Une première sélection trop large a été interrompue par cette limite ; les sélections ciblées ont ensuite réussi. Les tests de pyramide traversent les divisions avec des forfaits contrôlés, sans simulation de centaines de rencontres.

Les deux import maps HTML et `git diff --check` sont valides. La fixture multijoueur du test d’identité utilise désormais le recrutement initial et la date explicite déjà requis par le lobby.

## Supabase

- `rumbleball-api` déployée, ACTIVE, version 16.
- Projection JSON `mode` / `division` vérifiée sur la base existante : HTTP 200. Aucune migration SQL.
- Appel anonyme de l’API : HTTP 401.
- Aucun compte, club ou enregistrement de production créé ou modifié pour ces vérifications.

## Limites du contrôle

Le navigateur de contrôle ne peut pas joindre le serveur local. Le tunnel externe a été refusé par la revue automatique, puis écarté à la demande de l’utilisateur. Aucun contrôle visuel bureau/mobile n’est revendiqué ; les interactions et états UI ont été vérifiés avec le DOM de test local. Le serveur d’aperçu a été arrêté.
