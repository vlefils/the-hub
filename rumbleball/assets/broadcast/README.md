# Broadcast sportif

Identité commune aux ligues en ligne, à la carrière solo et à l’exhibition : bleu nuit, orange sportif, accents cobalt. Les dessins du terrain restent en SVG et utilisent la même peau et coiffure que les portraits.

## Illustrations livrées

- 32 portraits de 512 × 512 et 32 miniatures de 128 × 128, en WebP : quatre profils classiques, seize cyberpunk et douze personnages décalés.
- 16 emblèmes blancs sur fond transparent, 256 × 256. Le composant SVG compose l’écusson et applique la couleur du club par masque ; la couleur ne fait pas partie du fichier.
- 29 équipements sur fond transparent, 256 × 256, dont les 15 modèles avancés et les six équipements de base illustrés le 19 octobre.
- 1 bandeau d’arène et de ville, 1 600 × 480.
- 4 symboles d’archétypes dessinés dans le code SVG partagé.

Le lot initial de 57 fichiers principaux occupe 1,68 Mo, ou 1,77 Mo avec les miniatures. Les 15 nouveaux équipements ajoutent environ 315 Ko, et les six illustrations de base 89 Ko. Les images hors écran sont chargées à la demande et réservent leur place. Si un portrait est indisponible, le personnage SVG conserve sa fonction de secours.

## Génération et sources

Outil : **image_gen intégré**, sans CLI/API de génération externe. [generation.json](generation.json) conserve les prompts exacts et les métadonnées. Les maîtres PNG originaux sont conservés localement dans `output/rumbleball-broadcast-sources/` à la racine du workspace ; ils ne sont pas nécessaires au site publié.

Les prompts et les noms des sources du nouveau catalogue se trouvent dans [equipment/catalogue-generation.json](equipment/catalogue-generation.json). Les maîtres de ce lot restent dans le répertoire de génération imagegen. Les armes illustrées sont exclusivement contondantes et non létales ; les fonds d’atelier ont été retirés avec imagegen avant réduction et encodage en WebP.

[equipment/base-generation.json](equipment/base-generation.json) documente les six illustrations de base : protège-poing, tonfa, batte, maillet, bouclier et casque. Leurs maîtres PNG restent dans le répertoire de génération imagegen ; les WebP conservent la transparence. Les anciens SVG servent de secours en cas de chargement impossible.

Les premières productions ont porté sur quatre portraits, quatre emblèmes et deux équipements. La banque a été complétée après leur inspection, puis redimensionnée et encodée en WebP. À la demande du joueur, les 28 portraits suivants ont été remplacés par des profils plus cyberpunk et funs ; les versions PNG et leurs prompts restent conservés. Aucun contenu des captures de maquettes n’est utilisé comme interface : tous les textes et contrôles du jeu restent du HTML/SVG.

## Identités et extension

`portraitId` et `crestId` sont des références stables au catalogue de `identity.mjs`. Ne pas renommer un identifiant déjà utilisé dans une sauvegarde. Ajouter un nouveau visuel avec un nouvel identifiant et ses métadonnées de peau, de cheveux, de coiffure et de genre (`female`, `male`, `neutral`). Le genre correspond à la description d’origine du personnage illustré ; il n’est pas déduit de sa coiffure. L’identité `Prénom "Pseudo" Nom` est générée après l’attribution du portrait pour accorder le prénom et le pseudo. Les personnages androgynes utilisent des prénoms épicènes et des pseudos neutres.

Les nouvelles attributions évitent les doublons et équilibrent les peaux au sein de l’effectif et du marché. Le portrait ne dépend ni de la classe ni des achats. Les traits permanents du visage (mâchoire, optique, visière, peinture ou patch) sont cosmétiques et repris sur les pions ; ils n’accordent aucun bonus. Les équipements sportifs réellement achetés restent représentés séparément par le dessin du pion et par les emplacements de la fiche.

En ligne, les choix automatiques utilisent uniquement des identifiants publics de ligue, de club et de joueur, jamais la graine secrète du moteur. Les adversaires ne voient pas les changements de blason préparés avant le verrouillage. Les identités d’une rencontre sont figées avec sa configuration.
