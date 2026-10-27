# Atlas de Paradise et langues

L’intégration conserve le site statique et sa navigation par ancres. Aucun framework, serveur applicatif ou service de traduction n’est nécessaire pendant la consultation.

## Contenu

- Huit dossiers HTML de faction, avec les textes des fiches originales, leurs domaines, leurs signatures et leurs repères. Chaque dossier possède sa palette, sa typographie et une illustration de ses territoires. Les archives PNG originales restent accessibles.
- Trente-six lieux, dont les centres de pouvoir des huit factions et six zones neutres de Paradise. Chaque lieu possède sa propre page avec son accès, sa description, une tension et un contrat possible.
- Dix-sept figures majeures intégrées aux dossiers des factions, avec leur pouvoir de décision explicite. Onze contacts locaux apparaissent uniquement dans la page de leur lieu. Tous possèdent un portrait, une proposition, des conseils d’approche et un secret replié pour le MJ. Il n’existe pas de page PNJ dédiée.
- Huit dossiers technologiques décrivant principes, usages, limites et pistes de jeu. Ils ne modifient pas les règles mécaniques.
- Deux pages de vie sociale : « Visages et rendez-vous » (quatre personnalités, trois équipes sportives existantes et l’Arche) et « Crews du Hub » (trois équipes, trois interlocuteurs développés et six équipiers esquissés). Trois contacts ordinaires, dont les hôtes du Raccord et du Repli, sont intégrés à la page du Hub. Quatre repères ou usages enrichissent les lieux existants. Ces entrées utilisent des fiches de lecture sans portrait ni secret obligatoires.
- Des liens directs relient factions, lieux, PNJ et technologies. Les filtres des collections sont utilisables au clavier et la recherche n’indexe pas les secrets.

Les lieux, PNJ et technologies développent le cadre existant ; ils sont du nouveau matériel de jeu. Les passages des factions proviennent des huit images dans `assets/factions/`.

Le canon Synapse est mis à jour dans les dossiers, lieux, personnages et technologies : une IA centrale a pris le contrôle de la société et remplacé presque tous ses employés par des robots. Les drones suivent leurs programmes sans volonté propre ; les Autonomes disposent d’une IA locale et d’une volonté indépendante, y compris hors de la ruche. Le Cœur est l’IA centrale distribuée ; les autres figures et le contact local de Synapse sont des Autonomes.

## Sources et génération

La passe du 27 octobre 2026 est documentée dans [INVENTAIRE-LORE.md](INVENTAIRE-LORE.md) et [REVUE-LORE.md](REVUE-LORE.md). `data/lore-review.mjs` s’applique après les révisions de culture ; il ajoute huit repères sur Paradise, trois groupes locaux et trois conflits facultatifs, puis précise les dossiers existants. Ses nouvelles chaînes ont un anglais éditorial local. La résurrection comporte trois offres (standard avec puce, sauvegarde distante plus chère, synchronisation en temps réel) ; les PJ conservent l’offre standard. Les copies sont possibles mais interdites ; une seule continuité légale est reconnue. Le chroma reste fermé, le passé indéterminé et les lieux secondaires à leur échelle. Les Docks enfouis bordent un fleuve recouvert par la ville. Les noms de lieux révisés conservent leurs anciennes ancres.

Le socle français est dans `data/lore.mjs`. Les corrections de canon, les nouveaux lieux centraux et les figures majeures sont dans `data/lore-revision.mjs`, qui contient aussi leur anglais éditorial. `data/lore-culture.mjs` précise Velvet et Blackridge : désir, influenceurs et plateformes sociales chez Velvet ; luxe patrimonial, antiquaires et maisons historiques chez Blackridge. Ces révisions s’appliquent au socle à l’import. Le rendu HTML est dans `tools/lore-html.mjs`. Régénérer avec :

```powershell
node tools/build-lore.mjs
```

La partie comprise entre `LORE:START` et `LORE:END` dans `index.html` est générée. Les autres chapitres restent éditables normalement.
Le texte de transmission de l’accueil, dans `.long-copy.tablet-copy`, est également généré depuis `welcomeParagraphs` dans `data/lore-review.mjs`. Son habillage reste dans `index.html`. Les conseils de « Jouer Paradise » viennent de `toneSections` dans le même module.

`data/lore-life.mjs` contient la tranche de vie sociale décrite dans [ANALYSE-MANQUES-LORE.md](ANALYSE-MANQUES-LORE.md), avec son anglais éditorial. Elle complète les collections de l’atlas sans changer leurs identifiants ni ajouter de pages de quartiers. Le Raccord et Le Repli restent dans la page du Hub ; les quatre repères restent dans leurs lieux. Les attributs `data-lore-entry` permettent à la recherche de mener directement à ces fiches. Le contrôle de localisation vérifie également leur rattachement, leurs liens et leurs traductions.

Les visuels actuels ont été créés avec l’outil intégré `image_gen`, en prenant les bannières des règles comme références de style BD : contours encrés, hachures et ombres graphiques. Vingt-deux planches WebP actives dans `assets/lore/` fournissent les scènes de lieux, portraits et illustrations technologiques. Les prompts complets et les références sont conservés dans `assets/lore/prompts-bd.json`. Les cinq variantes `-bd-v2` de Velvet, Blackridge et des planches partagées sont documentées dans `assets/lore/prompts-culture.json` ; Velvet y adopte une lumière framboise, violette et cyan, tandis que Blackridge conserve l’ambre et les matériaux anciens. Les anciennes planches restent archivées.

`assets/lore/paradise-river-bd-v2.webp` remplace uniquement la scène utilisée par les Docks enfouis. Son panneau central représente le fleuve sous les voûtes et les piles de la ville, sans ciel ouvert. Les scènes du Hub et du Marché des heures continuent d’utiliser la planche précédente. L’édition a été faite avec l’outil intégré `image_gen` ; son prompt intégral et sa référence sont dans [assets/lore/prompts-river.json](assets/lore/prompts-river.json).

Le site affiche chaque scène par cadrage CSS. Les mosaïques des huit factions utilisent le même composant à trois vignettes : le cadrage écarte les bordures intégrées aux images, puis la grille applique un espacement sombre uniforme de 4 px. Les portraits restent cadrés depuis le haut pour préserver les visages. Le Cœur est représenté par son infrastructure, sans visage humanoïde.

Sur les pages de lieux, le texte d’introduction est à gauche et l’illustration au format 4:5 à droite. Sous 650 px, le texte et l’image s’empilent ; les tensions, contrats et contacts restent ensuite en pleine largeur.

`tools/pack-lore-art.mjs` permet de recompresser les originaux si le manifeste local est disponible. Il utilise `sharp` et conserve l’intégralité des planches. Pour la série BD :

```powershell
node tools/pack-lore-art.mjs .local/lore-bd-sources.json assets/lore/prompts-bd.json
```

## Français et anglais

`i18n-init.js` choisit la langue avant le chargement des interfaces : paramètre `lang` valide, choix mémorisé, puis langue du navigateur. Les navigateurs francophones démarrent en français ; les autres en anglais. Un refus du stockage local ne bloque pas la lecture.

`i18n.js` traduit les textes affichés, les libellés accessibles, les textes d’aide, les options et les contenus injectés après le chargement. Les valeurs des formulaires, les identifiants, les règles numériques et les sauvegardes du jeu sont conservés. Les champs éditables ne sont pas traduits. Les champs en lecture seule du personnage pré-tiré disposent d’une version anglaise.

Le livre, le catalogue Chroma et les deux entrées Rumbleball utilisent le même choix. Les formats de nombres et de dates des interfaces suivent cette langue ; les calendriers du jeu gardent leur fuseau et leur logique.

La version anglaise de l’atlas est assemblée dans `data/lore.en.mjs`. Les passages polis du socle portent leur anglais au même endroit que leur français, dans des appels `L(fr, en)` de `data/lore.mjs` ; `baseEnglish` est fusionné avec les dictionnaires des révisions et de la vie sociale avant les extraits dérivés. La traduction initiale du corpus existant a été préparée uniquement depuis les 72 fichiers déjà publiés, vérifiés anonymement contre GitHub. Le nouveau lore inédit n’a pas été envoyé à un service de traduction. Les traductions sont désormais stockées dans le projet ; le site ne contacte aucun service de traduction pendant la lecture.

Le dictionnaire lisible est `i18n/en.json` ; `i18n/en.js` est sa version chargée par les pages. Pour réextraire les chaînes et compiler localement :

```powershell
npm install --prefix .local/lore-tooling --no-audit --no-fund acorn
node tools/build-translations.mjs --compile-only
```

La compilation est locale par défaut. Les corrections éditoriales de `data/lore.en.mjs` priment sur le cache. Les nouvelles chaînes absentes du dictionnaire sont signalées dans `.local/translation-coverage.json` et doivent être traduites avant livraison.
Les textes anglais éditoriaux sont repris tels quels : les substitutions heuristiques réservées au cache ne doivent pas modifier un terme comme « backup » dans une description de sauvegarde mémoire.

Le mode réseau `--published-only` est réservé aux sources déjà publiques : il nécessite l’audit `tools/audit-translation-sources.mjs` et vérifie les empreintes des fichiers avant tout envoi. Après son utilisation, recompiler sans ce mode pour intégrer le contenu courant.

## Vérification

```powershell
node tools/check-lore-localization.mjs
node tools/validate-catalogue.mjs
node --test tools/localization.test.mjs rumbleball/preparation-workspace.test.mjs rumbleball/navigation.test.mjs rumbleball/session-ui.test.mjs rumbleball/round-ui.test.mjs rumbleball/narration.test.mjs rumbleball/online/direct.test.mjs
node tools/serve.mjs
```

Le contrôle de l’atlas vérifie les quantités, le rattachement des PNJ à leur faction ou à leur lieu, les lieux centraux, le canon Synapse, les ancres, les fichiers d’illustration, la présence des traductions, les dés et les paramètres des phrases dynamiques. Les tests de langue vérifient la détection, la priorité des préférences, les allers-retours, la conservation des valeurs et la traduction des contenus injectés. Les tests Rumbleball ciblent la navigation, la session, la préparation, la narration et le direct.

Les archives visuelles d’origine restent en français et sont présentées comme telles dans les dossiers et les liens d’archive. Elles ne remplacent pas les textes HTML bilingues.
