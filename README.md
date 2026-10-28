# The Hub - Site statique de regles JDR

Site statique responsive bilingue français / anglais pour publier les règles et le lore d’un jeu de rôle papier, avec une direction visuelle cyberpunk lisible.

## Structure

- `index.html` contient la page unique et les sections du livre de regles.
- `styles.css` gere le theme, la mise en page responsive et les composants visuels.
- `script.js` simule une navigation par pages via les ancres et n'affiche qu'une section a la fois.
- `data/lore.mjs`, `data/lore-revision.mjs` et `data/lore-social-places.mjs` contiennent huit factions, trente-huit lieux et espaces, dix-sept figures majeures, onze contacts locaux et huit dossiers technologiques. `tools/build-lore.mjs` produit les dossiers de faction et les pages de lieux dans `index.html`. Les PNJ sont intégrés à leur faction ou à leur lieu.
- `data/lore.en.mjs` contient la version anglaise éditoriale du nouvel atlas. `i18n/` et `i18n.js` assurent la traduction locale du livre, du catalogue et de Rumbleball.
- `assets/` est prevu pour les images, PDF, feuilles de personnage ou icones supplementaires.
- `.nojekyll` force GitHub Pages a servir le site comme contenu statique simple.

## Publication sur GitHub Pages

1. Cree un depot GitHub et pousse ce dossier.
2. Ouvre `Settings` > `Pages`.
3. Dans `Build and deployment`, choisis `Deploy from a branch`.
4. Selectionne la branche principale puis le dossier racine `/`.
5. Sauvegarde et attends la publication.

## Personnalisation rapide

- Remplace les textes `Placeholder` dans `index.html` par tes vraies regles.
- Ajoute tes illustrations ou ressources dans `assets/`.
- Ajuste les couleurs dans `:root` de `styles.css` si tu veux une autre variante cyberpunk.
- Duplique une section existante dans `index.html` pour ajouter de nouveaux chapitres.

## Notes

- **Lore et langues** : voir [LORE-LOCALIZATION.md](LORE-LOCALIZATION.md) pour les sources, les visuels, la maintenance et les vérifications. La langue du navigateur est détectée à la première visite ; les drapeaux FR/EN mémorisent ensuite le choix. Les liens `?lang=fr` et `?lang=en` permettent d’ouvrir une langue précise.

- **Passe éditoriale du lore** : [inventaire complet](INVENTAIRE-LORE.md) et [critique, décisions et corrections](REVUE-LORE.md). `data/lore-review.mjs` porte les précisions bilingues et la page « Comprendre Paradise », notamment les trois offres de résurrection, les copies interdites, le circuit fermé du chroma et les docks du fleuve souterrain.
- **Canon courant** : les deux textes de l’auteur, « Dossier The Hub » et « Comprendre Paradise », font foi. La [revue de concordance page par page](ACCORD-LORE.md) documente l’accord des 50 autres pages et des illustrations avec cette base ; [AGENTS.md](AGENTS.md) en fixe les consignes de maintenance.
- **Vie sociale de Paradise** : [analyse initiale des manques](ANALYSE-MANQUES-LORE.md). `data/lore-life.mjs` contient les créateurs et voix publiques, les contacts du Raccord et du Repli, des repères locaux et les présentations publiques du Rumbleball. La rubrique **Loisirs** rassemble le Rumbleball avec ses équipes illustrées, les Médias sensoriels et La Sphère avec ses personnalités illustrées ; voir `data/lore-leisure.mjs` et [LOISIRS-DEVELOPPEMENT.md](LOISIRS-DEVELOPPEMENT.md). L’Arche reste un stade de l’atlas lié depuis le sport. La Sphère, propriété de Synapse, détaille aussi la sécurité et les affrontements numériques. **Le Hub** rassemble désormais huit crews illustrées, les boutiques et les rendez-vous du marché, avec le Grand Soir ; voir [HUB-DEVELOPPEMENT.md](HUB-DEVELOPPEMENT.md) et `data/lore-hub.mjs`. L’accueil s’intitule **Bienvenue au Hub**. Le tout est bilingue et accessible depuis l’atlas et la recherche.

- **Outils → Rumbleball** présente le jeu et ouvre sa [page dédiée](rumbleball/index.html), avec gestion du club et matchs à cinq contre cinq. Lancer `node tools/serve.mjs` pour l’essayer en local ; voir [sa documentation](rumbleball/README.md) pour les règles et les tests.

- Les chemins sont relatifs, donc le site fonctionne directement sur GitHub Pages.
- Sans JavaScript, tout reste charge dans la page mais la navigation par section visible ne sera pas active.
