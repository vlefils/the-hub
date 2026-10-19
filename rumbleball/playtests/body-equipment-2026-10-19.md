# Mannequin d’équipement et armes — 19 octobre 2026

## Interface

La fiche du joueur utilise un mannequin SVG commun à tous les personnages. Sept emplacements restent visibles et cliquables : tête, torse, gants, bottes, implant, main droite et main gauche. Les noms longs sont repris intégralement dans le contexte du slot sélectionné et son nom accessible. La sélection fonctionne aussi au clavier avec les boutons natifs et conserve le focus.

Chaque emplacement regroupe sa pièce portée, le matériel du club compatible et le magasin filtré. La réserve précède le magasin. L’aperçu inclut les variations de CA, compétences, vitesse, attaque et dégâts, ainsi que l’apparition ou la disparition de la seconde attaque. Le corps et les contrôles se placent côte à côte lorsque la largeur le permet, ou se suivent dans la colonne ; aucun défilement interne à la fiche n’est ajouté.

La même interface est utilisée en solo et en ligne, y compris pour les remplaçants. Les achats conservent le joueur et la main sélectionnée. Les tactiques en cours de saisie survivent à l’achat en ligne. Pendant une rencontre, les slots restent consultables et les achats, transferts et ventes sont désactivés.

## Équipement et combat

- Les protections appartiennent à une zone précise. Torse, casque, gants et bottes peuvent se cumuler ; une nouvelle pièce ne retire que celles dont l’emplacement entre en conflit.
- Les nouvelles pièces sont le casque (+1 CA), les poings chromés (1d4, légers/finesse), le tonfa (1d6, léger/finesse), la batte (1d8 ou 1d10 avec l’autre main libre), le marteau (1d10, deux mains) et le bouclier (+1 CA, un seul).
- Une arme peut être attribuée à gauche ou à droite. Le marteau occupe les deux mains. Remplacer une pièce rend les anciennes à la réserve sans les détruire ; retirer le marteau libère les deux mains. Les bonus d’un objet à deux mains ne sont calculés qu’une fois.
- Le toucher et les dégâts utilisent la Force ; la finesse utilise le meilleur de Force/Dextérité. La maîtrise s’ajoute au toucher. La main droite est l’arme principale lorsque les deux mains portent des armes, sinon l’arme disponible est utilisée.
- Deux armes légères autorisent une attaque secondaire après une attaque normale, en consommant l’action bonus. Les modificateurs positifs ne s’ajoutent pas aux dégâts secondaires. La réaction d’opportunité reste une attaque unique ; les techniques partageant l’action bonus restent concurrentes de la seconde attaque. Le journal identifie cette attaque et les prévisions défensives des bots en tiennent compte.
- Sans arme achetée, les profils conservent leur matériel d’entraînement initial. Les clubs IA achètent aussi des armes lorsque leurs budgets permettent de conserver les prochains salaires et contrats.

## Persistance et serveur

Le catalogue, les emplacements et leurs conflits sont partagés entre les deux modes. Le serveur valide la zone envoyée par `buy` ou `equip`, la propriété du joueur et les identifiants d’articles. Les imports refusent les collisions, les deux boucliers, les implants stockés comme objets transférables et les identifiants inconnus ou hérités du prototype JavaScript.

Les anciens objets sans zone explicite retrouvent leur emplacement d’après leur type. Les enregistrements et matchs déjà commencés restent inchangés. Les nouvelles configurations figent armes et attaque secondaire, de sorte qu’une reprise ou un replay conserve les mêmes jets. L’annulation d’une préparation en ligne restaure armes, mains et solde antérieurs. Les implants restent attachés au joueur et leur remplacement garde sa confirmation de destruction.

Les champs utilisent les JSON existants, sans migration SQL. Le déploiement nécessite les fichiers statiques et les deux fonctions Supabase. Les pictogrammes et le mannequin sont des SVG originaux dans `assets/equipment/`, les illustrations d’équipement existantes restent dans `assets/broadcast/`.

## Vérifications

Suite complète : `node --test --test-reporter=spec rumbleball/*.test.mjs rumbleball/online/*.test.mjs` — **384 tests réussis**, aucun échec. Les dernières finitions de validation, structure du mannequin et illustration des armes ont aussi été contrôlées par **47 tests ciblés**.

Couverture ajoutée : cumul entre zones sans gain de PV, remplacement dans une zone unique, finesse/Force et dés d’armes connus, polyvalence de la batte, condition des deux armes légères, occupation des deux mains, retrait et transfert sans duplication, bouclier unique, revente et cession du joueur, sauvegarde et reprise, charges mal formées, attaque secondaire unique en action bonus, absence de seconde attaque après réaction, usage réel par les bots, calcul du danger, corps commun, sept slots accessibles, filtrage du magasin, priorité à la réserve, achat à un remplaçant, conservation de la sélection et verrouillage.

Les scénarios serveur couvrent les deux mains avec des protections distinctes, le refus d’une zone incompatible sans débit, l’annulation intégrale, la confidentialité du brouillon adverse et les armes figées au coup d’envoi. Les nouveaux assets sont vérifiés sur disque par les tests du catalogue.

Limite : le DOM de test valide les interactions, pas le rendu. Computer Use ne fournit aucun navigateur disponible ; aucune vérification visuelle dans un navigateur n’est revendiquée.
