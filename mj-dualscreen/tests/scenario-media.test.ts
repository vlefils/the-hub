import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { IDBFactory } from "fake-indexeddb";
import { createScene, createScenario, selectSceneMap, type SceneMap } from "../app/lib/model.ts";
import { collectScenarioMedia, isScenarioImageUsed, unifyScenarioMedia, updateScenarioMedia, withScenarioMedia } from "../app/lib/media.ts";
import { getLibrary, prepareScenarioImport, removeScene, saveScenarioBundle } from "../app/lib/storage.ts";

beforeEach(() => { globalThis.indexedDB = new IDBFactory(); });

function fixture() {
  const scenario = createScenario("La forteresse");
  const map: SceneMap = { id: "plan-village", name: "Village", assetId: "image-plan", outsideRevealed: true,
    zones: [{ id: "zone", name: "Place", kind: "rect", points: [{ x: 0, y: 0 }, { x: 0.5, y: 0.5 }], revealed: true }],
    strokes: [], viewport: { zoom: 2, x: 0.2, y: 0 } };
  const first = selectSceneMap({ ...createScene(), scenarioId: scenario.id, maps: [map], galleryAssetIds: ["portrait", "image-plan"] }, map.id);
  first.scenarioMarkdown = "![Ancien portrait](asset:portrait)";
  const second = { ...createScene(2), scenarioId: scenario.id, galleryAssetIds: ["taverne"], scenarioMarkdown: "# Chapitre 2" };
  return { scenario, scenes: [first, second], map };
}

test("les médias de tous les chapitres sont disponibles sans modifier leur texte ni la sélection", () => {
  const { scenario, scenes } = fixture();
  const unified = unifyScenarioMedia(scenario, scenes);
  assert.deepEqual(new Set(unified.scenes[1].galleryAssetIds), new Set(["portrait", "image-plan", "taverne"]));
  assert.equal(unified.scenes[1].maps.length, 1);
  assert.equal(unified.scenes[1].activeMapId, null);
  const displayed = selectSceneMap(unified.scenes[1], "plan-village");
  assert.equal(displayed.id, scenes[1].id);
  assert.equal(displayed.scenarioMarkdown, "# Chapitre 2");
  assert.equal(displayed.zones[0].revealed, true);
  assert.equal(displayed.viewport.zoom, 2);
});

test("le brouillard d’un plan reste commun après modification depuis un autre chapitre", () => {
  const { scenario, scenes } = fixture();
  const unified = unifyScenarioMedia(scenario, scenes);
  const displayed = selectSceneMap(unified.scenes[1], "plan-village");
  const changed = updateScenarioMedia(unified.scenario, unified.scenes, {
    ...displayed, outsideRevealed: false, zones: displayed.zones.map((zone) => ({ ...zone, revealed: false })),
    viewport: { zoom: 3, x: 0, y: 0 },
  });
  assert.equal(changed.scenes[0].zones[0].revealed, false);
  assert.equal(changed.scenes[0].viewport.zoom, 3);
  assert.equal(changed.scenes[0].outsideRevealed, false);
  assert.equal(changed.scenes[0].scenarioMarkdown, scenes[0].scenarioMarkdown);
});

test("la suppression d’une image commune désactive son affichage dans toutes les scènes", () => {
  const { scenario, scenes } = fixture();
  scenes[1].activeImageId = "taverne";
  const unified = unifyScenarioMedia(scenario, scenes);
  const result = updateScenarioMedia(unified.scenario, unified.scenes, {
    ...unified.scenes[0], galleryAssetIds: unified.scenes[0].galleryAssetIds.filter((id) => id !== "taverne"),
  });
  assert.equal(result.scenes[1].activeImageId, null);
  assert.ok(!result.scenes[1].galleryAssetIds.includes("taverne"));
  assert.equal(isScenarioImageUsed(result.scenes, "portrait"), true);
  assert.equal(isScenarioImageUsed(result.scenes, "image-plan"), true);
});

test("la migration persiste et supprimer le chapitre d’origine conserve ses médias", async () => {
  const { scenario, scenes } = fixture();
  await saveScenarioBundle(scenario, scenes);
  const migrated = await getLibrary();
  assert.equal(migrated.scenarios[0].media?.maps.length, 1);
  await removeScene(scenes[0].id);
  const reloaded = await getLibrary();
  assert.equal(reloaded.scenes.length, 1);
  assert.equal(reloaded.scenes[0].maps[0].id, "plan-village");
  assert.ok(reloaded.scenes[0].galleryAssetIds.includes("portrait"));
  assert.equal(reloaded.scenes[0].activeMapId, null);
  assert.deepEqual(await getLibrary(), reloaded);
});

test("un média retiré ne revient pas depuis une ancienne copie de scène", async () => {
  const { scenario, scenes } = fixture();
  const media = collectScenarioMedia(scenes);
  media.galleryAssetIds = ["image-plan"];
  await saveScenarioBundle({ ...scenario, media }, scenes);
  const reloaded = await getLibrary();
  assert.deepEqual(reloaded.scenes[1].galleryAssetIds, ["image-plan"]);
});

test("la bibliothèque est isolée par scénario et une nouvelle scène l’hérite", async () => {
  const { scenario, scenes } = fixture();
  const other = createScenario("Autre histoire");
  await saveScenarioBundle(scenario, scenes);
  await saveScenarioBundle(other, [{ ...createScene(), scenarioId: other.id }]);
  const library = await getLibrary();
  assert.deepEqual(library.scenes.find((scene) => scene.scenarioId === other.id)?.galleryAssetIds, []);
  const media = library.scenarios.find((item) => item.id === scenario.id)!.media!;
  const added = withScenarioMedia(createScene(3), media);
  assert.equal(added.maps.length, 1);
  assert.equal(added.activeMapId, null);
  assert.ok(added.galleryAssetIds.includes("portrait"));
});

test("réimporter des scènes partageant un plan ne duplique pas ce plan", () => {
  const { scenario, scenes, map } = fixture();
  const unified = unifyScenarioMedia(scenario, scenes);
  const assets = ["portrait", "image-plan", "taverne"].map((id) => ({ id, name: id, type: "image/png",
    width: 1, height: 1, createdAt: "2026-01-01", data: "data:image/png;base64,aGVsbG8=" }));
  const imported = prepareScenarioImport({ format: "ecran-du-mj", version: 1, exportedAt: "2026-01-01",
    scenes: unified.scenes, assets }, "Partie.mjscreen", []);
  assert.equal(imported.scenario.media?.maps.length, 1);
  assert.equal(imported.scenes[0].maps[0].id, imported.scenes[1].maps[0].id);
  assert.notEqual(imported.scenes[0].maps[0].id, map.id);
  assert.equal(imported.scenes[0].maps[0].zones[0].revealed, true);
});
