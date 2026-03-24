# The Hub - Site statique de regles JDR

Base de site statique responsive en francais pour publier les regles d'un jeu de role papier avec une direction visuelle cyberpunk lisible.

## Structure

- `index.html` contient la page unique et les sections du livre de regles.
- `styles.css` gere le theme, la mise en page responsive et les composants visuels.
- `script.js` simule une navigation par pages via les ancres et n'affiche qu'une section a la fois.
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

- Les chemins sont relatifs, donc le site fonctionne directement sur GitHub Pages.
- Sans JavaScript, tout reste charge dans la page mais la navigation par section visible ne sera pas active.
