import assert from "node:assert/strict";
import test from "node:test";
import { createScene, getPlayerLayout, showSceneImage, selectSceneMap, type SceneMap } from "../app/lib/model.ts";
import { preservePlayerDisplay, unifyScenarioMedia, updateScenarioMedia } from "../app/lib/media.ts";
import { createScenario } from "../app/lib/model.ts";

function fixture() {
  const scenario = createScenario("Aventure");
  const maps: SceneMap[] = ["village", "secret"].map((id) => ({
    id, name: id, assetId: id, outsideRevealed: true, zones: [], strokes: [],
    viewport: { zoom: 2, x: 0.1, y: 0 },
  }));
  const base = { ...createScene(), scenarioId: scenario.id, maps,
    galleryAssetIds: ["portrait", "secret", "village"],
    scenarioMarkdown: "# Arrivée\n\n![Portrait](asset:portrait)\n\nLa suite.",
  };
  const first = showSceneImage(selectSceneMap(base, "village"), "portrait");
  const next = { ...showSceneImage(selectSceneMap(base, "secret"), "secret"),
    id: "chapter-2", scenarioMarkdown: "# Le secret", panelWidth: 100 };
  return { ...unifyScenarioMedia(scenario, [first, next]), maps };
}

test("changer de chapitre conserve uniquement le plan et l’image déjà diffusés", () => {
  const { scenes } = fixture();
  const next = preservePlayerDisplay(scenes[1], scenes[0]);
  assert.equal(next.id, scenes[1].id);
  assert.equal(next.scenarioMarkdown, "# Le secret");
  assert.equal(next.activeImageId, "portrait");
  assert.equal(next.activeMapId, "village");
  assert.equal(next.mapAssetId, "village");
  assert.deepEqual(next.viewport, scenes[0].viewport);
  assert.equal(next.panelWidth, scenes[0].panelWidth);
  assert.deepEqual(scenes[1].activeImageId, "secret");
});

test("naviguer depuis un écran masqué ne révèle aucun média mémorisé", () => {
  const { scenes } = fixture();
  const empty = { ...scenes[0], activeMapId: null, mapAssetId: null, activeImageId: null, panelVisible: false };
  const next = preservePlayerDisplay(scenes[1], empty);
  assert.equal(next.activeImageId, null);
  assert.equal(next.activeMapId, null);
  assert.equal(next.mapAssetId, null);
  assert.equal(next.outsideRevealed, false);
  assert.deepEqual(next.zones, []);
});

test("changer de scénario masque les médias même si leurs identifiants sont partagés", () => {
  const { scenes } = fixture();
  const next = preservePlayerDisplay({ ...scenes[1], scenarioId: "autre" }, scenes[0]);
  assert.equal(next.activeImageId, null);
  assert.equal(next.activeMapId, null);
  assert.equal(next.panelVisible, false);
});

test("des diffusions répétées ne dupliquent ni le Markdown ni les médias du scénario", () => {
  let { scenario, scenes } = fixture();
  const originalMarkdown = scenes.map((scene) => scene.scenarioMarkdown);
  const originalGallery = [...scenes[0].galleryAssetIds];
  for (let index = 0; index < 10; index += 1) {
    const updated = updateScenarioMedia(scenario, scenes, showSceneImage(scenes[0], "portrait"));
    scenario = updated.scenario;
    scenes = updated.scenes;
  }
  assert.deepEqual(scenes.map((scene) => scene.scenarioMarkdown), originalMarkdown);
  assert.equal(scenes[0].scenarioMarkdown.match(/!\[/g)?.length, 1);
  assert.deepEqual(scenes[0].galleryAssetIds, originalGallery);
  assert.equal(scenes[0].maps.length, 2);
});

test("choisir une illustration annule le vieux recadrage et réactive l’ajustement auto", () => {
  const scene = { ...createScene(), panelSizing: "manual" as const, panelWidth: 0,
    imageViewports: { portrait: { zoom: 4, x: 1, y: -1 } } };
  const selected = showSceneImage(scene, "portrait");
  assert.equal(selected.panelSizing, "auto");
  assert.equal(selected.panelVisible, true);
  assert.deepEqual(selected.imageViewports.portrait, { zoom: 1, x: 0, y: 0 });
  assert.equal(showSceneImage(selected, null).panelVisible, false);
});

const dimensions = new Map([
  ["portrait", { width: 600, height: 1200 }],
  ["landscape", { width: 2400, height: 1200 }],
  ["map", { width: 1600, height: 1200 }],
]);

test("une illustration seule remplit l’écran, quelle que soit l’ancienne répartition", () => {
  const scene = showSceneImage({ ...createScene(), panelWidth: 0 }, "portrait");
  assert.deepEqual(getPlayerLayout(scene, dimensions), {
    panelWidth: 100, showPanel: true, showMap: false, layout: "image",
  });
});

test("la répartition automatique s’adapte aux portraits et aux paysages", () => {
  const scene = { ...createScene(), mapAssetId: "map" };
  const portrait = getPlayerLayout(showSceneImage(scene, "portrait"), dimensions);
  const landscape = getPlayerLayout(showSceneImage(scene, "landscape"), dimensions);
  assert.equal(portrait.layout, "split");
  assert.equal(portrait.panelWidth, 27);
  assert.equal(landscape.panelWidth, 60);
  assert.equal(getPlayerLayout({ ...showSceneImage(scene, "portrait"), panelSizing: "manual", panelWidth: 40 }, dimensions).panelWidth, 40);
});

test("masquer une illustration ou perdre son fichier rend l’espace au plan", () => {
  const scene = { ...createScene(), mapAssetId: "map", activeImageId: "missing" };
  assert.equal(getPlayerLayout(scene, dimensions).layout, "map");
  assert.equal(getPlayerLayout({ ...scene, activeImageId: "portrait", panelVisible: false }, dimensions).panelWidth, 0);
});
