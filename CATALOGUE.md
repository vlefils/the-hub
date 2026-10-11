# Catalogue shopping du Hub

Le catalogue affiché dans les rubriques **Armes**, **Gadgets**, **Implants** et **Mutations** est lu depuis [`data/catalogue.json`](data/catalogue.json). Chaque objet a un `id` unique, une `family`, un `tier`, un `name`, un `price`, un `summary`, ses `rules` et une `image`. Modifier ces champs suffit à mettre à jour le tableau et la fiche au prochain chargement du site. Les champs spécialisés (`damage`, `range`, `charger`, `reload`, `hands`, `compatibility`, `charge`, `placement`) alimentent les caractéristiques visibles ; `drawback` affiche la contrepartie d'une mutation. `archive` mène à l'ancienne fiche image.

Le tableau permet de rechercher, filtrer et trier les articles par colonne ou par le menu « Trier ». Les implants peuvent aussi être filtrés par zone et charge cybernétique. Un clic sur une ligne ouvre la fiche complète avec l'illustration. Sur téléphone, les colonnes secondaires sont résumées sous le nom pour garder le prix et la description lisibles. `placement` décrit la zone anatomique d'un implant ; ce champ n'impose pas de limite de greffes par zone. La valeur `charge` correspond à la charge cybernétique de l'implant.

Après une modification, lancer `node tools/validate-catalogue.mjs` pour vérifier les références, images et décisions de règles.

Les 117 références de départ proviennent de [`inventaire-shopping-chroma.md`](inventaire-shopping-chroma.md). Pour les gadgets, le texte détaillé de l'ancien HTML a été conservé. Les chargeurs et rechargements des 25 armes à distance ont été vérifiés sur leurs planches. Pour les armes et plusieurs implants, l'inventaire résumait les planches : les autres caractéristiques secondaires non relevées ne sont pas inventées. Leur image d'origine reste accessible dans chaque fiche. Si l'image et le texte divergent, **le texte du nouveau catalogue fait foi**.

## Décisions de règles publiées

- Une attaque avec une arme à feu représente toute sa séquence de tir efficace du tour. Les dégâts indiqués ne sont pas des dégâts par balle. Le jeu n'accorde pas d'Attaque supplémentaire générale.
- Les bonus distincts de précision, de dégâts fixes et d'initiative peuvent se cumuler lorsqu'ils s'appliquent. L'Œil tactique T1 donne **+1** à l'attaque à distance. Les bonus d'initiative principaux de **+5** et les implants donnant également un autre bénéfice à **+2** sont conservés.
- Volk HMG-8, Peau de camouflage active T1 et Queue préhenseuse de colonne conservent leurs effets et leur prix. Les gros dés des armes restent inchangés.
- Les ajustements ciblés du [`rapport d'équilibrage`](rapport-equilibrage-shopping-chroma.md) sont appliqués : Yoru Needle ; Black Tip, Jolt-2, Turret Dock S-4 ; Harnais servo-assisté léger, Gantelet à impulsion, Patch auto-médical régénérant ; les neuf implants ciblés ; les sept mutations ciblées. Le rapport donne le détail « avant / après » et la justification de chacun.
- Kage no Ha-6 inflige `1d6 tranchant`. Siege GL-2 garde sa portée de **3 m** telle qu'écrite sur l'image. Les Jambes de course Raptor ont une charge de **2**. Aucun plafond générique de modules ou de bonus n'est ajouté.
- Pour les effets de poussée et d'entrave qui n'avaient pas de DD, le DD publié est **8 + bonus de maîtrise + modificateur utilisé pour l'attaque**. Le Huolong F-3 utilise **8 + maîtrise + Dextérité**.

Les anciennes planches restent en place comme archives graphiques. Les nouvelles illustrations individuelles se trouvent dans `assets/catalogue/` au format WebP.
