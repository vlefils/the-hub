# Loisirs, Sphère et corps augmentés

Révision du 28 octobre 2026, à la suite des retours de l’auteur. Les deux textes de référence restent inchangés.

## Parcours de lecture

`#lore-loisirs` reprend la grille illustrée de l’atlas avec trois entrées : Rumbleball, Médias sensoriels et La Sphère. Les dossiers utilisent l’introduction des lieux, puis des sections rédigées et, lorsque pertinent, les profils illustrés employés dans les factions.

- `#loisir-rumbleball` présente le sport, les clubs, les publics et les trois équipes illustrées. Les ancres `sport-boyz`, `sport-legion`, `sport-charognards` et `sport-tribunes` sont conservées. L’Arche reste une adresse de l’atlas, accessible depuis le sport ; elle n’a plus d’entrée privilégiée dans le menu principal. Ses équipes ne sont plus enfermées dans le dossier d’un stade particulier.
- `#loisir-medias-sensoriels` présente les formats, l’expérience du public, les métiers, les droits et les lieux de diffusion. Le dossier technique `#tech-sensoriel` reste distinct et lié.
- `#zone-sphere` conserve son ancre historique, mais appartient désormais aux Loisirs. Nacre, Romy, Miloque et Dalia y gardent leurs ancres et reçoivent des portraits individuels. La Sphère n’est plus une carte de l’atlas physique.

Le site comporte 37 pages de lieux physiques, trois dossiers de loisirs et leur index. `data/lore-leisure.mjs` porte les nouveaux dossiers ; `data/lore-social-places.mjs` conserve la Sphère et l’Arche, en exportant séparément l’espace numérique. Les rattachements des profils et leurs illustrations figurent dans `data/lore-life.mjs`.

## Propriété et sécurité de la Sphère

La Sphère appartient à Synapse. Le Cœur fait tourner ses services dans les datacenters de la corporation, administre son architecture et ses accès, et la protège. Velvet, les producteurs indépendants et les particuliers exploitent leurs services et espaces dans cette infrastructure. Le Cabinet conserve l’autorité du droit de Paradise.

La section `sphere-securite` décrit les défenses et les interventions de Synapse, mais aussi les hackers, les comptes volés, le chantage, les arnaques et les affrontements. Cette puissance technique n’implique ni omniscience ni disparition de la fraude. Les effets de piratage restent ceux des règles existantes.

## Crews du Hub

Les huit équipes comptent désormais 33 membres : Costa 3, Darzi Extraction 4, Morant Protection 5, Mastiff 6, Rook 3, Nadir 3, Sillage 4 et Voss 5. Les nouveaux membres occupent des fonctions de transport, de préparation, de couverture ou de renseignement, rédigées avec leurs habitudes et leurs relations de travail.

Le chrome est visible chez les crews, avec une intensité adaptée à leurs métiers. Les mutations biologiques restent ponctuelles chez Nils, Branko et Nora ; Nadir est le trio spécialisé dont tous les membres ont choisi une adaptation biologique. Les équipements de sécurité restent nécessaires. Il ne s’agit pas de nouveaux bonus mécaniques.

## Illustrations

Seize images ont été créées ou éditées avec l’outil intégré `image_gen`, inspectées puis intégrées en WebP dans `assets/lore/` : huit variantes `crew-*-bd-v2`, trois `sport-*-bd`, quatre `sphere-*-bd` et `leisure-sensory-bd.webp`. Les originaux des crews sont conservés. Les compositions des variantes suivent leurs effectifs et préservent les identités des membres déjà présents.

Les prompts complets et les sources de référence des éditions sont conservés dans [prompts-leisure-crews-v2.json](assets/lore/prompts-leisure-crews-v2.json). Le corpus rendu utilise 43 fichiers d’illustration distincts.

À la demande de l’auteur, L’Arche est perchée comme un nid au sommet d’un building, au milieu de tours encore plus grandes. Son parvis est une terrasse en toiture, desservie par ascenseurs et passerelles. Le nouveau visuel extérieur `arche-exterior-bd.webp` remplace l’intérieur sur la page du lieu ; le dossier Rumbleball conserve la scène intérieure. Le prompt de génération est conservé dans [prompts-arche-exterior.json](assets/lore/prompts-arche-exterior.json).

Les renvois entre dossiers sont réunis en bas de page dans « Articles connexes », avec une miniature et un libellé de catégorie. Ce composant est partagé avec les factions, les lieux et les autres dossiers du lore. Les liens vers la page courante sont filtrés ; les identifiants restent disponibles pour les liens entrants.

## Vérification

Les contrôles de localisation couvrent les nouvelles traductions, les images, les liens, la diversité des effectifs et les propriétaires des ancres. Les tests existants de langue et les vérifications des deux textes d’auteur complètent la validation. Les pages restent bilingues et réutilisent les règles d’empilement mobile du site.
