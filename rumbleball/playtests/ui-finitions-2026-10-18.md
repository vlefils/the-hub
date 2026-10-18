# Finitions de l’interface Rumbleball — 18 octobre 2026

La revue conserve la direction Broadcast sportif et complète les écrans qui utilisaient encore des présentations différentes.

## Changements

- Sur téléphone, le menu du club retrouve ses cinq destinations et le bilan. Un menu équivalent dessert la ligue en ligne. Les trois modes tiennent sur une seule rangée.
- Les affiches mobiles placent chaque club sur une ligne distincte, avec son blason. Les noms longs restent lisibles en entier. Les onglets, états sélectionnés et barres de progression partagent la palette commune.
- Protection et implant sont illustrés dans les fiches et l’écran d’équipement. La réserve précède le magasin en solo et en ligne, avec destinataire explicite et transfert gratuit. Les achats affichent leurs effets, comparaisons et solde prévisionnel.
- En ligne, le joueur choisi reste sélectionné après un achat ou une attribution. Le verrouillage conserve la consultation et interdit les mutations.
- Le magasin présente l’objet et ses effets sans répéter le même portrait sur chaque article. Les bilans, promotions et effectifs adverses utilisent les portraits existants.
- La barre de lancement reste dans le contenu et ne recouvre plus le terrain ou les réglages. Export, import et redémarrage sont espacés dans Sauvegarde ; le redémarrage porte une couleur d’action destructive.

## Vérifications

**62 tests ciblés réussis**, couvrant les pages autonomes, la carrière, le déploiement, les identités, l’apparence, la lecture de rencontre et l’interface en ligne. Un scénario ajouté vérifie la conservation du joueur choisi après achat/transfert, le passage en réserve et le verrouillage des opérations.

```sh
node --test rumbleball/app.test.mjs rumbleball/career-ui.test.mjs rumbleball/identity.test.mjs rumbleball/appearance.test.mjs rumbleball/deployment.test.mjs rumbleball/round-ui.test.mjs rumbleball/online/ui.test.mjs rumbleball/online/broadcast-ui.test.mjs
```

Inspection dans le navigateur à **360, 390, 768, 1280, 1440 et 1920 px**, avec mesure de la largeur réelle des documents : aucun débordement horizontal de page pour la préparation solo et l’équipement en ligne avec noms longs. Le terrain conserve son défilement local sur téléphone. Les colonnes de préparation passent de une à deux puis trois selon la largeur.

Parcours solo effectué : six recrutements, achat d’un plastron, préparation, rencontre et bilan. Solde observé : 500 − 90 de salaires + 200 de prime = 610 chromas. Le bilan mobile, les portraits et le menu de sauvegarde ont aussi été inspectés.

Le multijoueur a été vérifié avec le service de démonstration en mémoire de `output/broadcast-browser-qa/multi.html`, sans compte ni ligue de production. Captures et mesures conservées dans `output/rumbleball-ui-review-2026-10-18/`. La suite complète du moteur et une soirée en production n’ont pas été rejouées pour cette passe d’interface.
