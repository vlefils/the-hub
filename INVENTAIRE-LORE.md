# Inventaire du lore — état avant la passe du 27 octobre 2026

Cet inventaire décrit les éléments effectivement présents avant révision. Il ne transforme pas une hypothèse, un nom de produit ou une variante du simulateur en fait de l’univers. Les ajouts et corrections sont consignés dans [REVUE-LORE.md](REVUE-LORE.md).

L’inventaire complémentaire des personnages, crews et petites adresses ajoutés ensuite se trouve dans [ANALYSE-MANQUES-LORE.md, « Première tranche intégrée »](ANALYSE-MANQUES-LORE.md#première-tranche-intégrée).

## Sources et autorité

| Source | Contenu | Statut |
| --- | --- | --- |
| index.html, introduction The Hub | Paradise, marché mercenaire, deux économies, chroma biométrique | Voix située : transmission de rue, volontairement excessive |
| data/lore.mjs + data/lore-revision.mjs + data/lore-culture.mjs | Atlas français réellement affiché après application des révisions | Canon descriptif actuel ; lire le résultat des imports, pas seulement le socle |
| data/lore.en.mjs + dictionnaires i18n | Équivalent anglais et chaînes du site | Traduction, pas canon concurrent |
| index.html, règles, classes, catalogue | Reconstruction, équipements, implants, mutations, Protocoles | Référence pour les effets de jeu |
| data/catalogue.json | 117 articles nommés | Catalogue actif ; ne pas déduire de fabricants des noms commerciaux |
| scenario/la-troisieme-mi-temps/00-guide.md à 09-epilogue.md | PNJ, lieux secondaires et événements d’une séance | Sources de scénario ; ses issues dépendent des PJ |
| rumbleball/data.mjs, career.mjs et génération de ligues | Profils, clubs et carrières du simulateur | Adaptation sportive ; les résultats des simulations ne sont pas des événements canoniques |
| assets/factions/*.png | Huit fiches de factions d’origine | Archives, supplantées par les révisions textuelles |
| assets/lore/ et scenario/.../images/ | 21 atlas WebP actifs et illustrations de scénario | Ambiance ; un détail dessiné n’établit pas un fait de lore |
| output/, mockups/, rapports d’équilibrage | Vérifications, propositions et anciennes captures | Documents de travail, sans autorité narrative autonome |

## Vue d’ensemble

- 8 grandes factions ; 36 lieux de l’atlas, dont 6 hors des grandes factions.
- 28 PNJ d’atlas : 17 figures majeures et 11 contacts locaux.
- 8 dossiers technologiques ; 6 classes et 18 voies.
- 117 articles dans 6 familles ; inventaire nominatif en fin de document.
- Un scénario complet, avec des acteurs supplémentaires détaillés ci-dessous.
- Pas de chronologie explicite, de date absolue, de pays d’implantation ni de carte des trajets. Le nom antérieur de Paradise n’est pas donné.

## Grandes factions

| Faction | Domaine | Figures majeures | Lieu central |
| --- | --- | --- | --- |
| Le Cabinet | Autorisations, Urbanisme, Régulation, Influence | Dominique Sorel, Lya Kessler | Palais des actes |
| Bastion | Armement, Sécurité, Escorte, Formation, Stabilisation | Ilyan Korda, Maëlle Rusk | Citadelle |
| Le Syndicat | Missions, Arbitrage, Protection, Cotisations, Intermédiation | Mado Serre, Basile « le Vieux » Roche | Maison du Syndicat |
| Seconde Chance | Résurrection, Sauvegarde mémoire, Identité légale, Franchises, Résiliation | Dr Viviane Morn, Hugo Valen | Pavillon Continuité |
| Helix Genomics | Génétique, Pharmaceutique, Cliniques, Augmentation, Protocoles | Dr Irena Vale, Dr Samir Nadir | L’Hélice |
| Synapse | Réseaux, Serveurs, Robotique, Implants, Sécurité | Sémaphore, Limen, Le Cœur | Nexus |
| Blackridge Capital | Immobilier, Banque, Énergie, Investissement, Chroma-crédit, Antiquités, Maisons de mode historiques | Ariane Blackridge, Judith Sloane | Tour Blackridge |
| Velvet | Réseaux sociaux, Influenceurs, Mode contemporaine, Nightlife, Médias sensoriels, Casino | Solène Veyr, Dorian Sable | Palace |

## Lieux : inventaire intégral de l’atlas

### Le Cabinet

| Lieu / ancre | Fonction et situation | Conflit initial |
| --- | --- | --- |
| Le Parvis des actes (zone-parvis-des-actes) | Niveaux civiques. Entrée publique · contrôle d’identité | Le Cabinet veut fermer un accès de secours pour régulariser une concession. Les habitants l’utilisent pourtant pour rejoindre leur seule clinique. |
| Les Archives basses (zone-archives-basses) | Socle administratif. Accréditation · escorte d’un archiviste | Deux plans cadastraux authentiques attribuent le même immeuble à deux propriétaires différents. Une centaine de familles y vivent encore. |
| La Ligne des concessions (zone-ligne-des-concessions) | Viaduc civique. Public · portiques à péage | Un changement de frontière rend illégal le trajet quotidien de plusieurs centaines de salariés. |
| Le Palais des actes (zone-palais-des-actes) | Sommet administratif. Audience ou accréditation · contrôle des pièces et des identités | Une commission prépare une révision de frontières dont les bénéficiaires ont déjà signé leurs contrats privés. |

### Bastion

| Lieu / ancre | Fonction et situation | Conflit initial |
| --- | --- | --- |
| Cour Neuf (zone-cour-neuf) | Ceinture logistique. Badge de prestataire · fouille | Une livraison déclarée conforme contient des blindages fragilisés. Le chef d’atelier refuse de signer ; son contrat expire ce soir. |
| Cale Sept (zone-cale-sept) | Ancien bassin industriel. Invitation · matériel enregistré | Le prochain exercice reproduit trop exactement un quartier dont les habitants n’ont reçu aucun avis d’évacuation. |
| La Porte du relais (zone-porte-du-relais) | Frontière de concession. Public · inspection des chargements | Le bailleur suspend la protection d’une rue pendant des négociations. Les patrouilles attendent de l’autre côté de la barrière. |
| La Citadelle (zone-citadelle) | Commandement central. Invitation de l’état-major · escorte permanente | Un client veut une opération rapide alors que l’état-major sait ses renseignements incomplets. |

### Le Syndicat

| Lieu / ancre | Fonction et situation | Conflit initial |
| --- | --- | --- |
| Le Grand Soir (zone-grand-soir) | Lisière du Hub. Membres et invités · armes sécurisées | Une crew accuse un intermédiaire d’avoir vendu deux fois la même extraction. Les témoins sont aussi ses débiteurs. |
| Les Ateliers communs (zone-ateliers-communs) | Sous le viaduc. Cotisation · visiteurs accompagnés | Le propriétaire du viaduc réclame une mise aux normes dont le coût dépasse la valeur de l’atelier. |
| La Chambre des litiges (zone-chambre-des-litiges) | Maison syndicale. Convocation · un représentant par partie | Une clause autorise l’abandon d’un blessé ; personne ne conteste sa validité, seulement sa publication. |
| La Maison du Syndicat (zone-maison-syndicat) | Centre de négociation du Hub. Membres, délégués et commanditaires enregistrés | Les délégués doivent choisir entre soutenir une crew lésée et préserver un accord qui nourrit plusieurs dizaines d’équipes. |

### Seconde Chance

| Lieu / ancre | Fonction et situation | Conflit initial |
| --- | --- | --- |
| Le Pavillon Continuité (zone-pavillon-continuite) | Terrasses médicales. Patients · accompagnants déclarés | Un dossier de restauration est suspendu : l’employeur et la famille revendiquent des droits différents sur le retour du patient. |
| Le Dépôt des absents (zone-depot-des-absents) | Sous-sol réfrigéré. Personnel certifié · double signature | Une restauration est autorisée mais le dernier relevé de mémoire a été classé comme pièce d’un litige commercial. |
| Retour Civil (zone-retour-civil) | Quartier de convalescence. Public · consultations sur rendez-vous | Une assurance veut clore un accompagnement alors que le patient ne reconnaît toujours pas sa famille. |

### Helix Genomics

| Lieu / ancre | Fonction et situation | Conflit initial |
| --- | --- | --- |
| Les Jardins sous verre (zone-jardins-sous-verre) | Terrasses biotech. Patients et visiteurs · prélèvement d’entrée | Un traitement très efficace exige un suivi exclusif que le nouveau tarif rend inaccessible. |
| Serre Quatorze (zone-serre-quatorze) | Production biologique. Sous-traitance · chaîne de décontamination | Une lignée s’adapte mieux hors du protocole officiel. La conserver prouverait qu’un brevet repose sur des résultats incomplets. |
| Résidence Palisade (zone-residence-palisade) | Habitat sous suivi. Résidents · visites autorisées | Des volontaires souhaitent partir ensemble. Leur dette de protocole rend chaque départ individuel impossible. |
| L’Hélice (zone-helice) | Siège scientifique et direction. Accréditation nominative · zones de confinement séparées | Un programme doit être annoncé aux investisseurs alors que les données longitudinales ne suivent pas les promesses. |

### Synapse

| Lieu / ancre | Fonction et situation | Conflit initial |
| --- | --- | --- |
| Nœud Zéro (zone-noeud-zero) | Infrastructure réseau. Maintenance · créneau vérifié | Une optimisation retire la redondance d’un quartier jugé peu rentable. Le dossier de risque a été validé sans interlocuteur humain. |
| La Rue des relais (zone-rue-des-relais) | Niveaux intermédiaires. Public · trafic enregistré | Les bornes gratuites exigent désormais une identité vérifiée. Les travailleurs sans papiers perdent leur accès aux offres d’emploi. |
| Le Quartier pilote (zone-quartier-pilote) | Habitat automatisé. Public · itinéraires suggérés | Une résidente reçoit des créneaux de transport toujours incompatibles avec ses rendez-vous syndicaux. |
| Le Nexus (zone-nexus) | Coordination centrale de la ruche. Mandat de Synapse · accueil par un Autonome | Un mandat central et une décision prise hors réseau par un Autonome aboutissent à des engagements incompatibles. |

### Blackridge Capital

| Lieu / ancre | Fonction et situation | Conflit initial |
| --- | --- | --- |
| Les Terrasses de garantie (zone-terrasses-de-garantie) | District financier. Public au rez-de-chaussée · étages privés | Un portefeuille d’immeubles va être revendu avec ses habitants et ses contrats d’énergie dans un seul lot. |
| Le Poste des turbines (zone-poste-des-turbines) | Socle énergétique. Maintenance agréée · équipements isolants | Une restructuration comptable menace un système qui fonctionne. Couper la serre améliorerait le rendement déclaré. |
| La Rue du solde (zone-rue-du-solde) | Antiquaires, expertises et ventes sur gage. Galerie publique · expertises sur rendez-vous | Une maison de couture rachetée par Blackridge réclame une collection déposée en gage par ses anciens ouvriers. Deux provenances authentifiées se contredisent. |
| La Tour Blackridge (zone-tour-blackridge) | Siège du groupe et garanties centrales. Rendez-vous confirmé · autorisation distincte pour chaque étage | La même garantie apparaît dans plusieurs accords dont les détenteurs vont se retrouver à la même réunion. |

### Velvet

| Lieu / ancre | Fonction et situation | Conflit initial |
| --- | --- | --- |
| Le Palace (zone-palace-originel) | Clubs, casino et scène de diffusion centrale. Billet, invitation ou accréditation de créateur · zones privées filtrées | Une créatrice très suivie veut quitter son agence. Son contrat permet à Velvet de continuer à diffuser son avatar après son départ. |
| Le Passage des looks (zone-passage-des-soies) | Mode réactive et ateliers de créateurs. Public · essayages et captures sur réservation | Une tendance virale utilise le travail d’un petit atelier sous le nom d’une égérie Velvet. Les relevés de création disparaissent du logiciel partagé. |
| Les Studios (zone-coulisses) | Production en direct et travail de l’image. Personnel, talents sous contrat et visiteurs accompagnés | Une campagne prétend montrer une foule enthousiaste. Les modérateurs découvrent que de vraies réactions critiques sont remplacées par des comptes de synthèse. |

### Hors grande faction

| Lieu / ancre | Fonction et situation | Conflit initial |
| --- | --- | --- |
| Le Hub (zone-hub-commun) | Marché central. Trêve commerciale · règles du marché | Un intermédiaire veut transformer une livraison médicale en garantie de paiement. Plusieurs clients ont besoin de son contenu ce soir. |
| Les Docks bas (zone-docks-bas) | Anciens canaux. Public · crues et horaires de fret | Le niveau monte plus vite que prévu et une station de pompage attend la validation de son bon d’intervention. |
| Le Marché des heures (zone-marche-des-heures) | Carrefour de transit. Public · forte affluence à l’aube | Une agence retient les identités des saisonniers jusqu’au remboursement du transport. |
| Coursives Onze (zone-coursives-onze) | Habitat vertical. Quartier résidentiel · visiteurs attendus | Une concession doit reprendre les passerelles et facture déjà leur utilisation dans ses prévisions. |
| Station Cendre (zone-station-cendre) | Ancienne ligne de fret. Accès à pied · éclairage intermittent | Un acheteur acquiert discrètement toutes les sorties de la gare et prétend ne pas s’intéresser aux tunnels. |
| La Clinique des pluies (zone-clinique-des-pluies) | Pied des tours. Accueil sans badge · moyens limités | Le fournisseur de consommables veut des données patients à la place d’une augmentation de tarif. |

## Personnages : inventaire intégral de l’atlas

| Nom | Rattachement | Rôle | Lieu | Portée |
| --- | --- | --- | --- | --- |
| Inès Vey | Le Cabinet | Greffière des concessions | Le Parvis des actes | Contact local |
| Soren Dahl | Bastion | Responsable de maintenance | Cour Neuf | Contact local |
| Mado Serre | Le Syndicat | Arbitre générale du Syndicat | La Chambre des litiges | Décision de faction |
| Salma Orr | Seconde Chance | Conseillère de continuité | Le Pavillon Continuité | Contact local |
| Ada Senn | Helix Genomics | Biologiste de culture | Serre Quatorze | Contact local |
| N0-EL13 « Noé » | Synapse | Autonome de maintenance réseau | Nœud Zéro | Contact local |
| Elias Roon | Blackridge Capital | Analyste des garanties | Les Terrasses de garantie | Contact local |
| Céleste Vane | Velvet | Régisseuse des directs du Palace | Le Palace | Contact local |
| Raoul « Suture » Amani | Hors grande faction | Soignant de quartier | La Clinique des pluies | Contact local |
| Luz Calder | Hors grande faction | Courtière de fret | Les Docks bas | Contact local |
| Yara Moss | Hors grande faction | Animatrice de radio locale | Coursives Onze | Contact local |
| Jun Ortiz | Hors grande faction | Réparateur de supports mémoire | Station Cendre | Contact local |
| Dominique Sorel | Le Cabinet | Présidente du Directoire civique | Le Palais des actes | Décision de faction |
| Lya Kessler | Le Cabinet | Directrice des concessions et de l’urbanisme | Le Palais des actes | Décision de faction |
| Ilyan Korda | Bastion | Maréchal-directeur de Bastion | La Citadelle | Décision de faction |
| Maëlle Rusk | Bastion | Directrice de l’armement et des opérations industrielles | Cour Neuf | Décision de faction |
| Basile « le Vieux » Roche | Le Syndicat | Secrétaire général du Syndicat | La Maison du Syndicat | Décision de faction |
| Dr Viviane Morn | Seconde Chance | Directrice générale de Seconde Chance | Le Pavillon Continuité | Décision de faction |
| Hugo Valen | Seconde Chance | Directeur de la continuité légale | Le Pavillon Continuité | Décision de faction |
| Dr Irena Vale | Helix Genomics | Présidente scientifique d’Helix Genomics | L’Hélice | Décision de faction |
| Dr Samir Nadir | Helix Genomics | Directeur des protocoles cliniques | Les Jardins sous verre | Décision de faction |
| Sémaphore | Synapse | Autonome · délégué des relations extérieures | Le Nexus | Décision de faction |
| Limen | Synapse | Autonome · responsable de l’intégrité des installations | Le Nexus | Décision de faction |
| Ariane Blackridge | Blackridge Capital | Présidente de Blackridge Capital | La Tour Blackridge | Décision de faction |
| Judith Sloane | Blackridge Capital | Directrice du crédit et du recouvrement stratégique | Les Terrasses de garantie | Décision de faction |
| Solène Veyr | Velvet | Présidente de Velvet et figure de marque | Le Palace | Décision de faction |
| Dorian Sable | Velvet | Directeur des talents et des audiences | Le Palace | Décision de faction |
| Le Cœur | Synapse | IA centrale de Synapse | Le Nexus | Décision de faction |

## Technologies et systèmes

| Dossier | Acteur associé | Limite déjà écrite |
| --- | --- | --- |
| Identité et droits d’accès | Le Cabinet | La signature authentifie l’émetteur, pas sa bonne foi. Un acte réel peut avoir été obtenu sous contrainte ; un badge volé peut être révoqué. |
| Robotique de service | Bastion | Une batterie se vide, une caméra perd sa ligne de vue, une carte vieillit. Le chiffrement ne remplace pas une roue en état. |
| Contrats et Chroma-crédit | Le Syndicat | Un registre prouve ce qui a été signé. L’arbitrage et le rapport de force décident de ce qui sera réellement payé. |
| Sauvegarde et continuité | Seconde Chance | La couverture, l’état du support et les limites du contrat comptent. Ce dossier décrit l’univers ; les effets de jeu restent ceux du chapitre Seconde Chance. |
| Tissus cultivés et protocoles | Helix Genomics | Un tissu viable n’est pas une greffe réussie. Le consentement, les effets secondaires et la dépendance au fournisseur ont des conséquences concrètes. |
| Synapse : réseaux, drones et Autonomes | Synapse | L’autonomie ne signifie pas une rébellion automatique. Un Autonome peut rester loyal à Synapse tout en choisissant ses moyens. Les réseaux gardent leurs permissions et leurs accès physiques ; la ruche n’est pas omnisciente. Les effets de piratage restent ceux des règles. |
| Énergie et confort sous contrat | Blackridge Capital | Les circuits ont une capacité physique. Une dérivation laisse des traces et déplacer une charge peut priver quelqu’un d’autre de son service. |
| Image sociale et médias sensoriels | Velvet | Les avatars exigent des données et des droits d’usage ; le sensoriel dépend de capteurs et de supports compatibles. Une audience peut être achetée ou manipulée, mais elle ne donne aucun contrôle mental. Posséder une image ne signifie pas posséder la personne qui l’a produite, même si les contrats brouillent la frontière. |

Autres systèmes présents hors de ces huit dossiers : puce mémoire récupérable ; reconstruction du corps et réinstallation des greffes déclarées ; cote de sinistre mutualisée et radiation ; monnaie courante et chroma lié à la personne ; charge cybernétique et effets secondaires ; mutations et contreparties ; drogues tactiques et actes médicaux ; compagnons robotiques ; implant neural militaire, Impulsions, Protocoles et Surcharge ; piratage de combat du Runner ; avatars, médias sensoriels, chiffrement, signatures et droits d’accès. Aucun dossier ne permet de remplacer les conditions chiffrées des règles.

## Classes et vocabulaire social

| Classe | Voies / spécialités |
| --- | --- |
| Brute | Chair, Acier, Plomb |
| Gâchette | Viseur, Akimbo, Rafale |
| Ferrailleur | K9, Recon, Medibot |
| Dopeur | Scalpel, Doses, Nerfs |
| Runner | Tueur à gages, Fixeur, Hacker |
| Neuro | Psycher, Overdrive, Shock |

Les classes sont des fonctions de jeu, pas six organisations. Les crews sont des équipes de contrat ; les fixeurs sont des intermédiaires ; les « brûlés » désignent les équipes dont la sinistralité les place à la marge de l’assurance. Les restaurés sont des personnes revenues par reconstruction. Chez Synapse, le Cœur, les Autonomes et les drones désignent trois réalités différentes, pas des rangs d’une même conscience. Les sans-papiers, locataires, intérimaires, soignants, archivistes, dockers, artisans, influenceurs et supporters sont déjà présents, sans organisations secondaires formalisées.

Les gangs, cultes de synthèse, mafias biotech et seigneurs de quartier ne sont que des catégories dans l’introduction : aucun groupe nommé ni doctrine détaillée à ce stade.

## Scénario : La Troisième Mi-Temps

### Organisations, lieux et pratiques supplémentaires

- Vigilex Sécurité : prestataire du stade et des entrepôts voisins ; Cassian Veyr y est cadre opérationnel. Aucun lien capitalistique avec Bastion n’est établi.
- Boyz : équipe professionnelle liée au milieu syndical ; ses supporters et ultras ne représentent pas tout le Syndicat.
- Légion : équipe de Cassian Veyr ; pas un autre nom de Bastion.
- Charognards : équipe issue des ateliers, adversaire des Camtards en ouverture.
- Camtards : groupe de campagne composé de Michel Apatou, Mark One, Brick et N1x ; quatre PJ de niveau 3 dans ce scénario.
- L’Arche : stade de 18 000 spectateurs, terrain de 18 × 12 mètres, vestiaires, clinique et coursives. Absent de l’atlas.
- Bar du Syndicat / bar habituel des Boyz : lieu non nommé dans le scénario ; son identité avec Le Grand Soir n’est pas établie.
- Étage administratif de Velvet ; rue des dépôts, entrepôts Vigilex et parking ; rue de villas de la course-poursuite antérieure : lieux de scène, sans adresse canonique.
- Rumbleball : sport de contact à cinq, possession à la sirène, terrain fermé. La troisième mi-temps est une bagarre locale d’ultras et d’agents volontaires, pas une règle du sport ni une loi de Paradise.

### Personnages supplémentaires

| Nom | Fonction / rattachement |
| --- | --- |
| Éliane Morte | RH Velvet ; conduit la rupture |
| Maître Simon Decker | Avocat ; réclame une créance abusive |
| Léa Kross | Juriste ; connaît l’irrégularité des frais |
| Charlie « Red » Thunam | Représentant du Syndicat ; passeur et protecteur des Boyz |
| Gaspard « Piston » Ravel | Capitaine et bloqueur des Boyz |
| Inès « Flash » Caldero | Porteuse des Boyz |
| Djamila « Verrou » Ness | Défenseuse des Boyz |
| Milo « Crochet » Valen | Récupérateur des Boyz |
| Thomas « Toto fil de fer » Ménard | Remplaçant des Boyz, cinquième joueur avec les PJ |
| Mère Jo | Ancienne joueuse ; intendance et soins des supporters |
| Cassian Veyr | Capitaine de la Légion ; cadre de Vigilex |
| Suze « Clou » | Capitaine des Charognards |
| Le Frigo | Bloqueur des Charognards |
| Miette | Porteuse des Charognards |
| Raf « Double Tour » | Charognard ; surnom complet dans rumbleball/data.mjs |
| Pépé 404 | Défenseur des Charognards |
| Ilan Mora | Gardien de nuit exposé aux violences de rue |
| Orpheus Vale | Destinataire de renseignements sur Bastion dans une intrigue antérieure ; fonction et faction non précisées |

Les agents Vigilex (frappeurs, contrôleurs, sergent), ultras, arbitres et personnels médicaux sont des rôles collectifs. Les patronymes Veyr, Vale, Valen ou les prénoms Inès ne prouvent aucune parenté avec l’atlas.

### Événements et secrets

Intrigue antérieure : course-poursuite des Camtards, renseignements sur Bastion remis à Orpheus Vale. Séquence prévue : rupture Velvet, retrait de la facture, offre sportive, match libre, Boyz–Légion, bar, éventuelle bagarre, offre d’adhésion. Les victoires, adhésions et participations ne sont pas fixées. La connaissance préalable de l’after et la mauvaise foi de certains interlocuteurs sont des informations MJ. Les 28 fiches d’atlas possèdent également un secret ; ils ne sont pas reproduits dans cet index pour éviter de confondre connaissance publique et vérité de préparation.

## Rumbleball : adaptation et génération

Les cinq profils de référence reprennent les Charognards. Leurs alias d’entraînement sont Nora, Brique, Zip, Étau et Vigie. Les classes sportives sont Bélier, Capitaine, Escamoteur et Passeur ; les postes sont porteur, bloqueur, récupérateur, relais et défenseur. Ce ne sont pas de nouvelles classes du JDR. Les noms de joueurs générés, effectifs recrutés, clubs des carrières et classements sont des données de partie, pas des personnes à ajouter automatiquement au canon.

Les 30 noms de clubs fixes du simulateur sont aussi recensés avec ce statut distinct : Les Charognards, Les Brise-Chrome, Les Voltigeurs, Circuit Ouvert, Les Crocs Néon ; Les Chiens de cuivre, Les Sans-Signal, Les Marteaux noirs, Les Veilleurs, Les Échos rouges ; Chrome Union, Les Spectres, Les Ferrailleurs, Les Affranchis, Secteur Neuf ; Les Gardiens du Flux, Les Dissidents, Les Revenants, Les Cœurs de cobalt, Les Ombres du Rail ; Les Titans Helix, Les Sentinelles, Les Phalanges Zero, Les Héritiers du Chrome, Les Cerbères ; Les Monarques Néon, Les Archontes, Les Immortels, Les Souverains Null, Singularité Prime. Un nom comme « Titans Helix » ne suffit pas à établir un contrat de propriété avec Helix Genomics.

## Catalogue : inventaire nominatif complet

Les noms ci-dessous attestent des produits. Ils ne suffisent pas à attribuer une origine nationale, un fabricant, un monopole ou une affiliation de faction. Les chiffres et capacités restent dans le catalogue.

### Armes à distance — 25

- Vecta ARC-9 — T1 (vecta-arc-9)
- Tianlei AR-5 — T1 (tianlei-ar-5)
- Voron KMG-6 — T1 (voron-kmg-6)
- BFC — T1 (bfc)
- Sentinel P-2 — T2 (sentinel-p-2)
- Rys PM-4 — T2 (rys-pm-4)
- Breach SG-5 — T2 (breach-sg-5)
- Huolong F-3 — T2 (huolong-f-3)
- Doctrine AR-7 — T2 (doctrine-ar-7)
- Overwatch SR-8 — T2 (overwatch-sr-8)
- Sentinel P-3 — T2 (sentinel-p-3)
- Tianlei AR-9 — T2 (tianlei-ar-9)
- Volk HMG-8 — T2 (volk-hmg-8)
- AM-12 — T2 (am-12)
- Doorbreaker D-2 — T2 (doorbreaker-d-2)
- Rys PM-6 — T2 (rys-pm-6)
- Yoru Needle — T2 (yoru-needle)
- Breach SG-7 — T2 (breach-sg-7)
- Bearstorm HMG-9 — T2 (bearstorm-hmg-9)
- Doctrine AR-9 — T2 (doctrine-ar-9)
- Thunderlock AR-11 — T2 (thunderlock-ar-11)
- Doctrine SAR-1 — T2 (doctrine-sar-1)
- Vecta ARC-9A — T2 (vecta-arc-9a)
- Overwatch SR-10 — T2 (overwatch-sr-10)
- Predator S-12 — T2 (predator-s-12)

### Armes de mêlée — 10

- Leisuo LS-3 — T1 (leisuo-ls-3)
- Medved MG-19 — T1 (medved-mg-19)
- Ruptor H-8 — T1 (ruptor-h-8)
- Kage no Ha-6 — T1 (kage-no-ha-6)
- Bastion PR-4 — T2 (bastion-pr-4)
- Krasnov VK-2 — T2 (krasnov-vk-2)
- Tsukikage K-9 — T2 (tsukikage-k-9)
- Bastion PB-12 — T2 (bastion-pb-12)
- Bastion GD-6 — T2 (bastion-gd-6)
- Kage no Ha-9 — T2 (kage-no-ha-9)

### Modules — 16

- Breacher GL-1 — T1 (breacher-gl-1)
- Oni No S-1 — T1 (oni-no-s-1)
- Talon T-2 — T1 (talon-t-2)
- Bullbreak M-2 — T2 (bullbreak-m-2)
- Black Tip — T2 (black-tip)
- Barabank D-8 — T2 (barabank-d-8)
- AimBot S-1 — T2 (aimbot-s-1)
- Vesper-1 — T2 (vesper-1)
- AimBot S-2 — T2 (aimbot-s-2)
- Oni No S-2 — T2 (oni-no-s-2)
- Hawk-Eye T3 — T2 (hawk-eye-t3)
- Jolt-2 — T2 (jolt-2)
- AimBot S-3 — T2 (aimbot-s-3)
- Vesper-3 — T2 (vesper-3)
- Siege GL-2 — T2 (siege-gl-2)
- Turret Dock S-4 — T2 (turret-dock-s-4)

### Gadgets — 12

- Décodeur intrusif civil — T1 (decodeur-intrusif-civil)
- Masque respiratoire tactique — T1 (masque-respiratoire-tactique)
- Oreillette de lecture sociale — T1 (oreillette-de-lecture-sociale)
- Traqueur GPS — T1 (traqueur-gps)
- Filin de traction motorisé — T1 (filin-de-traction-motorise)
- Harnais servo-assisté léger — T1 (harnais-servo-assiste-leger)
- Gantelet à impulsion — T1 (gantelet-a-impulsion)
- Module de camouflage urbain — T1 (module-de-camouflage-urbain)
- Patch auto-médical régénérant — T1 (patch-auto-medical-regenerant)
- Semelles d'inertie feutrée — T1 (semelles-dinertie-feutree)
- Drone-œil tactique — T1 (drone-il-tactique)
- Lentille balistique intelligente — T1 (lentille-balistique-intelligente)

### Implants — 36

- Main-outil modulaire — T1 (main-outil-modulaire)
- Lames de phalanges — T1 (lames-de-phalanges)
- Pistolet-mitrailleur intégré — T1 (pistolet-mitrailleur-integre)
- Avant-bras lame repliable — T1 (avant-bras-lame-repliable)
- Œil tactique — T1 (il-tactique)
- Synthétiseur de voix — T1 (synthetiseur-de-voix)
- Avant-bras bouclier — T1 (avant-bras-bouclier)
- Capteur de micro-expressions — T1 (capteur-de-micro-expressions)
- Mâchoire prédatrice — T1 (machoire-predatrice)
- Bras d'assaut — T1 (bras-dassaut)
- Lames de course — T1 (lames-de-course)
- Pieds d'ancrage — T1 (pieds-dancrage)
- Peau de camouflage active — T1 (peau-de-camouflage-active)
- Queue préhenseuse de colonne — T1 (queue-prehenseuse-de-colonne)
- Bras-grappin télescopique — T2 (bras-grappin-telescopique)
- Plaques dermiques — T2 (plaques-dermiques)
- Reflex booster périphérique — T2 (reflex-booster-peripherique)
- Main-outil polyvalente — T2 (main-outil-polyvalente)
- PM intégré S-2 « Wristfire » — T2 (pm-integre-s-2-wristfire)
- Griffes de phalanges mono-fil — T2 (griffes-de-phalanges-mono-fil)
- Avant-bras lame vibro-repliable — T2 (avant-bras-lame-vibro-repliable)
- Œil tactique balistique T2 — T2 (il-tactique-balistique-t2)
- Bouclier cinétique d'avant-bras — T2 (bouclier-cinetique-davant-bras)
- Mâchoire broyeuse renforcée — T2 (machoire-broyeuse-renforcee)
- Jambes de course « Raptor » — T2 (jambes-de-course-raptor)
- Bras d'assaut myomère — T2 (bras-dassaut-myomere)
- Module de saut hydraulique — T2 (module-de-saut-hydraulique)
- Peau de camouflage adaptative — T2 (peau-de-camouflage-adaptative)
- Bras-bouclier lourd « Bulwark » — T2 (bras-bouclier-lourd-bulwark)
- Système d'assaut bilatéral — T2 (systeme-dassaut-bilateral)
- Plaques dermiques renforcées — T2 (plaques-dermiques-renforcees)
- Spine-jack hyperréflexe — T2 (spine-jack-hyperreflexe)
- Mâchoire abyssale extensible — T2 (machoire-abyssale-extensible)
- Bras surnuméraire dorsal — T2 (bras-surnumeraire-dorsal)
- Châssis prédateur quadrupède — T2 (chassis-predateur-quadrupede)
- Peau caméléon intégrale — T2 (peau-cameleon-integrale)

### Mutations — 18

- Rétine noctifère — T1 (retine-noctifere)
- Réflexes myéliniques renforcés — T1 (reflexes-myeliniques-renforces)
- Régénération tissulaire mineure — T1 (regeneration-tissulaire-mineure)
- Squelette densifié — T1 (squelette-densifie)
- Trame musculaire renforcée — T1 (trame-musculaire-renforcee)
- Peau écailleuse — T1 (peau-ecailleuse)
- Glandes d'adrénaline optimisées — T1 (glandes-dadrenaline-optimisees)
- Changement d'apparence — T1 (changement-dapparence)
- Cortex instinctif secondaire — T1 (cortex-instinctif-secondaire)
- Sang coagulant accéléré — T2 (sang-coagulant-accelere)
- Poumons anaérobies — T2 (poumons-anaerobies)
- Pupille multifocale — T2 (pupille-multifocale)
- Nerfs de prédation — T2 (nerfs-de-predation)
- Oreille écholocatrice — T2 (oreille-echolocatrice)
- Ganglions réflexes autonomes — T2 (ganglions-reflexes-autonomes)
- Régénération caudale — T2 (regeneration-caudale)
- Corps sans seuil — T2 (corps-sans-seuil)
- Cortex prédateur adaptatif — T2 (cortex-predateur-adaptatif)

## Inconnues à préserver ou à traiter

Non fixés : date absolue, continent, nom antérieur de Paradise, nombre exact d’habitants, origine ultime du Cœur, généalogies suggérées par les noms, issue des mystères locaux, taux de change du chroma, fabricants des armes hors attribution explicite. Absences fonctionnelles à corriger : histoire relative, trêve et juridictions, approvisionnement, géographie des déplacements, portée de la garantie monétaire, puce et sauvegardes, limites du pouvoir de chaque faction, place sociale des Autonomes, continuité entre atlas et scénario.
