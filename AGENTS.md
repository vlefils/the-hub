# Références du lore

Depuis la décision de l’auteur du 28 octobre 2026, les deux textes qu’il a fournis font foi :

- **Dossier The Hub**, la transmission d’accueil : `welcomeParagraphs` dans `data/lore-review.mjs`, rendu dans `#lore-the-hub`.
- **Comprendre Paradise** : `worldTitle`, `worldLead`, `worldIntro` et `worldSections` dans le même fichier, rendu dans `#lore-paradise`.

La page d’accueil porte désormais le titre **Bienvenue au Hub**, à la demande de l’auteur. Le dossier et le corps de la transmission gardent leur texte ; la page de lieu **Le Hub** est distincte (`#zone-hub-commun`).

Ces textes priment sur les anciennes fiches de factions, les passes éditoriales et les décisions historiques devenues incompatibles. Ne pas les réécrire, les raccourcir ou les corriger sans demande de l’auteur. Accorder les autres dossiers, traductions et illustrations avec eux. Les précisions antérieures compatibles restent valables, notamment les copies possibles mais interdites et la continuité légale unique.

Consulter `ACCORD-LORE.md` pour la revue page par page et `LORE-LOCALIZATION.md` pour les sources, la génération et les vérifications. Les images dans `assets/factions/` sont des archives de conception, pas une autorité canonique ; elles ne sont plus liées depuis les dossiers de lecture.

Respecter les échelles : une adresse locale n’a pas besoin de devenir un lieu majeur, d’être citée dans l’introduction ou de posséder sa propre page. Une affiliation n’implique ni propriété exclusive ni souveraineté territoriale. Le Hub est un marché dirigé par huit fondateurs ; le Cabinet gouverne Paradise.

Les crews, boutiques et rendez-vous du Hub sont intégrés à sa page de lieu, avec leurs sources bilingues dans `data/lore-hub.mjs`. Utiliser avec parcimonie les noms d’équipes construits comme « Les + nom commun » ; préférer des noms crédibles dans le milieu mercenaire, distinctifs et justifiés par leur histoire ou leurs membres. Conserver les anciennes ancres lors des renommages.

Les loisirs sont réunis dans `#lore-loisirs` : Rumbleball, Médias sensoriels et La Sphère. Leurs sources sont dans `data/lore-leisure.mjs`. L’Arche reste un lieu lié depuis le sport ; les équipes appartiennent au dossier Rumbleball. La Sphère conserve l’ancre `#zone-sphere`, mais ne fait plus partie de l’atlas physique. Elle appartient à Synapse : le Cœur héberge tous ses services dans les datacenters de la corporation, administre l’architecture et les accès et protège le réseau. Les hackers, les fraudes et les conflits continuent d’y exister. Les crews du Hub ont des effectifs variés, du chrome visible et des mutations ponctuelles ; Nadir est l’équipe spécialisée entièrement adaptée biologiquement. Voir `LOISIRS-DEVELOPPEMENT.md`.

# Interface

Privilégier la clarté, la hiérarchie visuelle, la lisibilité et la robustesse. Préserver ce qui fonctionne ; corriger structure, proportions et densité avant le style. Éviter les effets gratuits, la multiplication des cadres et les exceptions CSS fragiles. Prévoir les textes longs, les états vides et les petites largeurs. Travailler par changements ciblés et choisir la solution la plus simple et maintenable.

Dans les dossiers du lore, regrouper les liens connexes en bas de page dans le composant de tuiles illustrées « Articles connexes ». Les métadonnées sont centralisées dans `data/lore-navigation.mjs`. Ne pas ajouter de renvois vers des sections de la page courante ; conserver leurs identifiants pour les liens entrants.

L’Arche est un stade perché comme un nid au sommet d’un building, entouré de tours plus hautes. Son parvis occupe une terrasse en toiture, accessible par ascenseurs et passerelles. Le dossier du lieu utilise le visuel extérieur ; le dossier Rumbleball conserve l’illustration intérieure.
