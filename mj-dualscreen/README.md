# MJ Dualscreen

Depuis **Outils → MJ Dualscreen**, le MJ peut lire un chapitre, préparer ses plans et ouvrir la fenêtre **Écran joueurs** sur un second écran. Les deux fenêtres utilisent le même navigateur.

Le menu **Scénario** contient **La Troisième Mi-Temps**, **Sortie de service**, **Tout le monde monte** et **Avant vingt-deux heures**. Sur une table neuve, la console ouvre La Troisième Mi-Temps. Chaque aventure se charge depuis le site à sa première ouverture. Les textes, images, modifications, brouillard et dernier chapitre restent ensuite dans IndexedDB sur cet appareil. Supprimer une copie locale permet de rouvrir l’original depuis le menu. **Importer** et **Gérer → Exporter ce scénario** permettent de transférer une partie entre navigateurs.

**Avant vingt-deux heures — L’hôtel Velvet (illustrations révisées)** comporte trois rencontres illustrées, dans les étages, les cuisines et le vestibule des livraisons. Les copies des éditions précédentes sont accessibles dans **Mes scénarios**.

## Développement

Les sources de la console, adaptées du projet Écran du MJ sous licence MIT, sont dans `app/`. Depuis ce dossier, avec Node.js 22.13 ou ultérieur, exécuter `npm ci`, `npm test`, puis `npm run build`. Versionner les fichiers produits dans `assets/` avec les sources. GitHub Pages sert directement `index.html`. Pour vérifier le site en local, lancer `node tools/serve.mjs` depuis la racine de The Hub.

Le catalogue est défini dans `app/lib/catalog.ts`. Les fichiers de `scenarios/` sont des sauvegardes autonomes au format v1 du lecteur. Pour préparer une édition web, exécuter `python pack_scenario.py original.mjscreen scenarios/identifiant.mjscreen` avec Pillow. Le script conserve les chapitres et les plans et compresse les illustrations à leurs dimensions d’origine.

L’édition **Tout le monde monte — Le siège de Méridien** possède son propre identifiant de bibliothèque. Les tables qui avaient déjà ouvert une édition précédente retrouvent leur copie dans **Mes scénarios**. Les [fiches MJ imprimables](scenarios/tout-le-monde-monte-fiches.pdf) accompagnent les quatre rencontres.
