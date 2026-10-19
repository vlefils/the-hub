# Catalogue d’arène — 19 octobre 2026

29 objets au total : 14 références conservées et 15 nouveautés. Le catalogue du JDR n’est pas modifié. Tous les achats et effets passent par les mêmes règles en solo et en ligne.

## Règle de contact

Uniquement du contondant non létal. Aucune arme tranchante ou perforante. Les rencontres continuent à gérer des KO.

## Dotation gratuite

Poings chromés, tonfa d’arène, batte renforcée, marteau d’arène et bouclier de contact : 0 chroma. Disponibles même à découvert, avec les mêmes restrictions d’emplacements et de verrouillage que les achats. Le bouton indique « Équiper gratuitement ». Les réserves sont réutilisées et une demande identique ne duplique pas la pièce portée ; les deux mains peuvent recevoir un exemplaire. Restituer une dotation ne génère aucun revenu. Le prix de restitution des anciennes armes désormais gratuites est aussi nul.

## Nouveaux modèles

Le marteau de dotation inflige 2d6 et le bouclier de contact apporte +2 CA. Le Marteau Gravité conserve ces 2d6 et ajoute +1 au toucher et aux dégâts ; l’Égide apporte +3 CA. Les critiques doublent le nombre de dés, soit 4d6 pour les marteaux, sans doubler le bonus fixe.

| Emplacement | Objet | Prix | Effet |
| --- | --- | ---: | --- |
| Main | Poings Pulse | 250 | 1d4, +1 toucher/dégâts, légère, finesse |
| Main | Tonfa Arc | 400 | 1d6, +1 toucher/dégâts, légère, finesse |
| Main | Batte Aftershock | 450 | 1d8 ou 1d10 main libre, +1 toucher/dégâts, Force |
| Deux mains | Marteau Gravité | 600 | 2d6, +1 toucher/dégâts, Force |
| Main | Bouclier Égide | 450 | +3 CA, un seul bouclier |
| Main | Matraque Nulltrace | 850 | 1d6, +2 toucher/dégâts, légère, finesse |
| Tête | Visière Spectre | 350 | +1 CA, +1 Acrobaties |
| Tête | Casque Bastion | 350 | +2 CA |
| Torse | Veste Nightweave | 450 | +2 CA sans ralentissement |
| Torse | Plastron Citadelle | 650 | +3 CA, −1,5 m |
| Gants | Gantelets Vicegrip | 350 | +2 Lutte |
| Bottes | Bottes Overdrive | 400 | +1,5 m |
| Bottes | Bottes Slipstream | 350 | +2 Acrobaties |
| Implant | Faisceau Kinetic | 600 | +1,5 m, +1 Lutte |
| Implant | Noyau Synapse | 600 | +1 CA, +1 Acrobaties |

Les armes ajoutent uniquement leur propre bonus : aucune addition du bonus de main droite à l’attaque secondaire. Le modificateur positif de caractéristique reste exclu des dégâts secondaires. Aucun équipement n’ajoute de PV. Les nouveaux modèles conservent les règles de conflit, de transfert, de destruction d’implant et de revente à moitié prix pour le matériel payant. Les IA de campagne peuvent acheter les nouveaux tonfas et marteaux en gardant leur réserve de salaires et contrats.

## Interface et illustrations

Le magasin reste filtré par emplacement, ordonné par qualité puis prix, avec description et comparaison des statistiques avant achat. Le joueur, la main sélectionnée et les tactiques non enregistrées sont conservés. Le sélecteur « Remplacer ce titulaire » et les boutons de réorganisation sont retirés de la fiche ; la composition reste gérée sur le terrain et le banc.

15 nouvelles illustrations sont livrées en WebP de 256 × 256, chargées à la demande. Les illustrations ont été inspectées ensemble à petite taille sur fond bleu nuit. Les fonds d’atelier indésirables ont été retirés avec imagegen. Les prompts et sources retenues sont dans [catalogue-generation.json](../assets/broadcast/equipment/catalogue-generation.json). Les dessins de joueurs utilisent les familles visuelles existantes pour représenter le nouveau matériel en jeu.

## Compatibilité et validation

Les identifiants existants sont conservés. Les anciens effectifs figés et replays gardent leurs statistiques. Aucun changement de table ou SQL : les modules partagés nécessitent le redéploiement de `rumbleball-api` et `rumbleball-worker`.

Les tests couvrent dotation répétée, réutilisation, dette, restitution sans revenu, prix imposés par le serveur, emplacements et deux mains, bonus distincts des armes, aperçus, implants, absence de PV d’armure, sauvegardes, annulation et compilation des effectifs en ligne. La sélection des joueurs et les remplacements par terrain/banc sont conservés après retrait du contrôle redondant.

Validation : suite complète de 389 tests réussie, puis 39 tests ciblés réussis après l’ajustement final du tarif des bottes et de leur revente. Les 15 WebP ont été inspectés sur une planche à petite taille ; tous disposent d’un canal alpha transparent. La prévisualisation UI locale a été refusée par la politique du navigateur disponible ; les interactions sont couvertes par les tests DOM, sans revendication de validation visuelle complète de la page.
