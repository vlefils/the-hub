# Le Hub : première version développée

Version du 28 octobre 2026, à la demande de l’auteur. Le texte d’accueil fait toujours autorité ; sa page prend le titre **Bienvenue au Hub**. Le marché lui-même est développé dans **Le Hub**, sur l’ancre existante `#zone-hub-commun`.

## Organisation

- Circulation, galeries, fret et espaces de repos.
- Halle des contrats, fixeurs et paiements ; distinction entre chroma agréé et monnaie courante.
- Préparation, achats, essais, soins et départs.
- Retours de mission et vie quotidienne.
- Sept adresses et le fixeur Sacha Dervin.
- Trêve du Hub, direction commune et limites des pouvoirs locaux.
- Huit crews illustrées, avec leurs trente-trois membres, façons de travailler, limites, habitudes et propositions de rencontre.

Les sept adresses sont le Grand Soir, Havel, la clinique Varga, Azimut, le Quai des départs, le Raccord et le Repli. Le Grand Soir reste à la lisière du marché : il possède ici une présentation développée et un lien vers son dossier existant. Le Quai des départs est une aire de fret routier intérieure, distincte des Docks enfouis sur le fleuve.

## Crews et illustrations

| Équipe | Activité | Illustration intégrée |
| --- | --- | --- |
| Costa | Petits contrats, escorte et polyvalence ; Alma, Léon et Sana | [crew-costa-bd-v2.webp](assets/lore/crew-costa-bd-v2.webp) |
| Darzi Extraction | Blessés et récupération de puces ; Ivo, Inga, Nils et Yara | [crew-darzi-bd-v2.webp](assets/lore/crew-darzi-bd-v2.webp) |
| Morant Protection | Protection rapprochée et événements ; Ève, Mina, Loïc, Hadrien et Tess | [crew-morant-bd-v2.webp](assets/lore/crew-morant-bd-v2.webp) |
| Mastiff | Ouvertures forcées et intervention lourde ; Dorian, Sef, Anton, Branko, Leda et Omar | [crew-mastiff-bd-v2.webp](assets/lore/crew-mastiff-bd-v2.webp) |
| Rook | Surveillance et accès discrets ; Mara, Bastian et Ada | [crew-rook-bd-v2.webp](assets/lore/crew-rook-bd-v2.webp) |
| Nadir | Reconnaissance industrielle en profondeur ; Salma, Borel et Jace | [crew-nadir-bd-v2.webp](assets/lore/crew-nadir-bd-v2.webp) |
| Sillage | Escorte sur le fleuve couvert ; Ana, Pavel, Lio et Nora | [crew-sillage-bd-v2.webp](assets/lore/crew-sillage-bd-v2.webp) |
| Voss | Opérations sensibles coordonnées ; Ilse, Malik, Petra, Oren et Célia | [crew-voss-bd-v2.webp](assets/lore/crew-voss-bd-v2.webp) |

Les portraits ont été générés avec l’outil intégré `image_gen`, inspectés puis compressés en WebP. Ils représentent des groupes au travail et gardent des silhouettes, équipements et environnements distincts. Sillage apparaît sous les voûtes des docks. Les variantes actuelles ajoutent du chrome visible et des mutations mesurées : Nils, Branko et Nora, ainsi que le trio spécialisé Nadir. Les prompts complets sont dans [prompts-leisure-crews-v2.json](assets/lore/prompts-leisure-crews-v2.json). Voir [LOISIRS-DEVELOPPEMENT.md](LOISIRS-DEVELOPPEMENT.md) pour les nouveaux effectifs et la passe visuelle.

## Sources et compatibilité

Le texte bilingue du marché et les crews sont dans `data/lore-hub.mjs`. Les contacts déjà présents restent dans `data/lore-life.mjs`, qui réexporte également `crews`. Le rendu est dans `tools/lore-html.mjs` ; les styles propres aux groupes sont dans `lore.css`.

Les anciens identifiants `crew-rapieces`, `crew-ligne-de-vie` et `crew-vernis` sont conservés, même si les noms affichés changent. `#lore-crews` redirige vers `#hub-crews`, à l’intérieur du marché. Il n’y a plus de page autonome des crews. Les ancres des interlocuteurs restent accessibles à la recherche.

Les deux textes de référence sont vérifiés à l’identique dans le corps du HTML. Les contrôles couvrent les traductions, les ancres, les huit images distinctes et le rattachement de toutes les crews à la page du Hub. La navigation et le rendu ont été contrôlés en français et en anglais, ainsi que l’empilement sur petit écran sans débordement horizontal.
