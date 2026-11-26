import type { Scenario } from "./model.ts";
import { preservePlayerDisplay } from "./media.ts";
import { parseBackupManifest, prepareScenarioImport, saveScenarioBundle } from "./storage.ts";

export const hubScenarios = [
  { id: "la-troisieme-mi-temps", name: "La Troisième Mi-Temps" },
  { id: "sortie-de-service", name: "Sortie de service" },
  { id: "tout-le-monde-monte-meridien-3", name: "Tout le monde monte — Le siège de Méridien", file: "tout-le-monde-monte.mjscreen?edition=meridien-3" },
  { id: "avant-vingt-deux-heures", name: "Avant vingt-deux heures" },
];

export async function openHubScenario(entry: typeof hubScenarios[number], existingScenarios: Scenario[]) {
  const response = await fetch(`./scenarios/${entry.file ?? entry.id + ".mjscreen"}`);
  if (!response.ok) throw new Error(`Impossible de charger « ${entry.name} ». Sélectionnez-le de nouveau pour réessayer.`);
  const manifest = parseBackupManifest(await response.text());
  const bundle = prepareScenarioImport(manifest, entry.name, existingScenarios, entry.id);
  const scenes = bundle.scenes.map(scene => preservePlayerDisplay(scene, null));
  return saveScenarioBundle(bundle.scenario, scenes, bundle.assets, true);
}
