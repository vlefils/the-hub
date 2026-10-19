# Pseudos cyberpunk par classe — 19 octobre 2026

Les anciens qualificatifs génériques sont remplacés par quatre bibliothèques de seize pseudos, avec variantes de genre quand le titre le demande. Les alias techniques sans marque de genre sont disponibles pour tous les portraits. Le format reste `Prénom "Pseudo" Nom`, avec **393 216 combinaisons**.

| Classe | Univers | Exemples |
| --- | --- | --- |
| Capitaine | Réseaux, influence et commandement | Mainframe, Overmind, Vox, Synapse, Oracle, La Fixeuse |
| Bélier | Chrome, blindage et impact | Chromejaw, Crashcore, Ironclad, Aftershock, Hammerfall, La Broyeuse |
| Escamoteur | Intrusion, traces effacées et esquive | Ghostwire, Nulltrace, Backdoor, Glitch, Ghoststep, La Fugitive |
| Passeur | Acquisition de cible et trajectoires | Deadeye, Crosshair, Railshot, Ricochet, Vector, La Franc-Tireuse |

Chaque alias appartient à une seule classe. La classe est déterminée par le profil sportif, indépendamment du rôle tactique. Les deux profils de Bélier partagent donc la même bibliothèque. Les accords restent liés au genre déclaré du portrait : par exemple Le Broyeur / La Broyeuse, avec Grind comme alternative neutre. Le catalogue est figé pour éviter les modifications accidentelles.

La normalisation remplace un ancien pseudo générique ou celui d’une autre classe en conservant le prénom et le nom déjà conformes. Les identifiants, portraits, statistiques, contrats et équipements restent acquis. Un alias déjà adapté ne change pas lors des rafraîchissements ou d’un changement de rôle tactique. Les rencontres commencées et les replays conservent leurs identités enregistrées. Les premières recrues, les nouveaux marchés et les recrutements des adversaires suivent tous la classe réelle du joueur.

Les tests vérifient les quatre bibliothèques, seize choix par classe et genre, l’absence de chevauchement entre classes, les accords sur des exemples explicites, 12 288 noms générés sans doublon, la migration limitée au pseudo et le changement de classe. Les vérifications de campagne sur vingt journées contrôlent aussi les noms des nouvelles recrues adverses. Les contrôles de confidentialité des identités publiques et de conservation des rencontres restent inclus.

Suite complète : **335 tests réussis, aucun échec**, avec `node --test --test-reporter=spec rumbleball/*.test.mjs rumbleball/online/*.test.mjs`. `git diff --check` sans erreur d’espacement.

La mise à jour nécessite un déploiement des deux Edge Functions pour les ligues hébergées ; aucune migration SQL n’est requise.
