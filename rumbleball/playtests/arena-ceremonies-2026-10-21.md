# Direct et cérémonies de match — 21 octobre 2026

## Changements

- Le Direct affiche désormais le même SVG d’arène que les matchs, même avant le coup d’envoi et pendant les pauses. La grande affiche de remplacement est supprimée.
- Le bandeau compact du Direct réutilise celui du match. La colonne du logo prend sa largeur de contenu au lieu d’être forcée à neuf rems, et les contrôles du compte restent alignés à droite. La duplication des règles de bandeau dans le CSS du Direct est retirée.
- L’ouverture dure huit secondes : entrée des équipes, puis 3–2–1 et START. Les durées sont partagées entre serveur et présentation. Les matchs déjà figés conservent leur date de démarrage.
- Après la dernière animation, les joueurs debout repartent vers leur côté du terrain. Deux soigneurs avec un brancard prennent en charge chaque joueur KO ; le terrain est vide à la fin des sept secondes de sortie. Les silhouettes médicales utilisent les primitives SVG existantes.
- L’entrée et la sortie sont aussi intégrées aux matchs de carrière et d’Exhibition. Une reprise de sauvegarde ne rejoue pas l’entrée ; les commandes manuelles et le résultat immédiat permettent de passer la présentation. La pause pendant l’entrée conserve le temps et la position affichée.
- Le Direct reçoit l’état final public seulement pendant les sept secondes suivant la fin du match. Une connexion tardive reprend la sortie à l’instant approprié. L’évacuation occupe le début de la pause existante de deux minutes et n’en modifie pas la durée.
- Une attente de calcul conserve la dernière vue disponible. Un ancien frame d’une autre rencontre ne peut pas être rejoué lors du passage à la suivante.
- Aucun jet, salaire, blessure de carrière ou effet de progression n’est ajouté. Le brancard illustre les KO existants. Le mode de mouvement réduit conserve le décompte sans animation de marche et évite les boucles RAF.

## Contrôles

84 tests ciblés réussis, exécutés en série avec le lanceur limité à 256 Mo : playback 21, direct 6, online/ui 13, app 4, broadcast-ui 18, round-ui 10, match-workspace 4, replay-codec 5, worker-claim 3.

Vérifiés notamment : terrain présent avant le recrutement, sortie avant retour au terrain vide, préservation de l’état serveur, confidentialité avant l’heure du résultat, reprise tardive, décompte absolu, annulation des rappels, pause/reprise de l’entrée, transport des KO, absence de joueurs et de ballon après la sortie, restitution des replays et absence d’effet sur le RNG ou les sauvegardes.

Les ressources et import maps des deux pages ont été contrôlées. Les modules modifiés et les feuilles de style concernées utilisent la version de cache `20261021-ceremony`.

## Contrôle visuel : incomplet

Le bandeau publié précédemment a été observé dans Chrome maximisé à 1920 × 1080. Une démonstration locale avec des joueurs fictifs et aucun appel à Supabase a été préparée pour vérifier la correction. Le premier serveur était inaccessible depuis Chrome à cause des restrictions réseau du bac à sable. Le second serveur, lié uniquement à 127.0.0.1 hors du bac à sable, répondait HTTP 200.

Lors de la navigation vers cette démonstration, Computer Use a arrêté la session parce qu’il ne pouvait pas déterminer l’URL courante avec assez de certitude pour appliquer ses contrôles. Aucune autre entrée navigateur n’a été effectuée. Le rendu corrigé et l’animation des brancards ne sont donc pas déclarés validés visuellement. Les contrôles de code ont été terminés indépendamment. Les deux serveurs de démonstration ont été arrêtés ; aucun tunnel ni exposition externe créé.

## Déploiement

L’API et le worker Rumbleball ont été redéployés pour partager les durées et exposer la sortie après le résultat. Aucune migration SQL n’est nécessaire. Aucun match réel n’a été avancé pour la validation. La publication Git inclut le frontend et ses versions de cache ; la démonstration dans `output/` reste hors du commit.
