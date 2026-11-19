import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { IDBFactory } from "fake-indexeddb";
import { createScene, createScenario, type Scene } from "../app/lib/model.ts";
import {
  createBackup, getAsset, getLibrary, getScenes, importBackup, migrateScenarioLibrary,
  openDatabase, parseBackupManifest, prepareScenarioImport, putScenario,
  removeScenario, saveScenarioBundle, type BackupManifest,
} from "../app/lib/storage.ts";

beforeEach(() => { globalThis.indexedDB = new IDBFactory(); });

function manifest(scenes = [createScene(1), createScene(2)]): BackupManifest {
  return { format: "ecran-du-mj", version: 1, exportedAt: new Date().toISOString(), scenes, assets: [] };
}

test("un ancien fichier devient un scénario distinct avec ses scènes dans l’ordre du fichier", () => {
  const source = manifest();
  source.scenes[0].sortOrder = 15;
  source.scenes[1].sortOrder = 2;
  const first = prepareScenarioImport(source, "La tour.mjscreen", []);
  const second = prepareScenarioImport(source, "La tour.mjscreen", [first.scenario]);
  assert.equal(first.scenario.name, "La tour");
  assert.equal(second.scenario.name, "La tour (2)");
  assert.notEqual(first.scenario.id, second.scenario.id);
  assert.deepEqual(first.scenes.map((scene) => scene.name), source.scenes.map((scene) => scene.name));
  assert.deepEqual(first.scenes.map((scene) => scene.sortOrder), [0, 1]);
  assert.ok(first.scenes.every((scene) => scene.scenarioId === first.scenario.id));
  assert.ok(second.scenes.every((scene) => !first.scenes.some((other) => other.id === scene.id)));
});

test("les cartes, liens Markdown, cadrages et dernière scène sont réassociés à l’import", () => {
  const source = manifest();
  source.assets = [{ id: "old-image", name: "plan.png", type: "image/png", width: 1, height: 1,
    createdAt: "2026-01-01", data: "data:image/png;base64,aGVsbG8=" }];
  source.scenario = { name: "Le donjon", lastSceneId: source.scenes[1].id };
  Object.assign(source.scenes[1], {
    galleryAssetIds: ["old-image"], activeImageId: "old-image",
    scenarioMarkdown: "![Plan](asset:old-image)",
    imageViewports: { "old-image": { zoom: 2, x: 0.2, y: 0 } },
    maps: [{ id: "old-map", name: "Niveau 1", assetId: "old-image", outsideRevealed: true,
      zones: [], strokes: [], viewport: { zoom: 1.5, x: 0, y: 0 } }], activeMapId: "old-map",
  });
  const imported = prepareScenarioImport(source, "autre-nom.mjscreen", []);
  const scene = imported.scenes[1];
  const asset = imported.assets[0];
  assert.equal(imported.scenario.name, "Le donjon");
  assert.equal(imported.scenario.lastSceneId, scene.id);
  assert.equal(scene.scenarioMarkdown, `![Plan](asset:${asset.id})`);
  assert.equal(scene.activeImageId, asset.id);
  assert.equal(scene.mapAssetId, asset.id);
  assert.notEqual(scene.activeMapId, "old-map");
  assert.equal(scene.outsideRevealed, true);
  assert.equal(scene.imageViewports[asset.id].zoom, 2);
});

test("la migration conserve toutes les scènes et ne crée pas de scénario en double", () => {
  const scenes = [createScene(), createScene(2)];
  const migrated = migrateScenarioLibrary(scenes, []);
  assert.equal(migrated.scenarios[0].name, "Mes scènes");
  assert.deepEqual(migrated.scenes.map((scene) => scene.id), scenes.map((scene) => scene.id));
  assert.deepEqual(migrateScenarioLibrary(migrated.scenes, migrated.scenarios), migrated);
});

test("la base v1 est migrée durablement, sans perdre les données existantes", async () => {
  const oldScene = createScene();
  delete oldScene.sortOrder;
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open("ecran-du-mj", 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("scenes", { keyPath: "id" }).put(oldScene);
      request.result.createObjectStore("assets", { keyPath: "id" });
      request.result.createObjectStore("settings", { keyPath: "key" });
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => { request.result.close(); resolve(); };
  });
  const library = await getLibrary();
  assert.equal(library.scenes[0].id, oldScene.id);
  assert.equal(library.scenes[0].scenarioId, library.scenarios[0].id);
  assert.deepEqual(await getLibrary(), library);
  const database = await openDatabase();
  assert.equal(database.version, 2);
  database.close();
});

test("deux initialisations simultanées ne dupliquent pas le scénario initial", async () => {
  await Promise.all([getLibrary(), getLibrary()]);
  const library = await getLibrary();
  assert.equal(library.scenarios.length, 1);
  assert.equal(library.scenes.length, 1);
});

test("export puis réimport n’inclut que le scénario choisi et conserve la dernière scène", async () => {
  const first = await importBackup(new File([JSON.stringify(manifest())], "Tour.mjscreen"), []);
  await importBackup(new File([JSON.stringify(manifest())], "Forêt.mjscreen"), [first.scenario]);
  first.scenario.lastSceneId = first.scenes[1].id;
  await putScenario(first.scenario);
  const library = await getLibrary();
  const blob = await createBackup(library.scenes.filter((scene) => scene.scenarioId === first.scenario.id), first.scenario);
  const exported = parseBackupManifest(await blob.text());
  assert.equal(exported.scenes.length, 2);
  assert.equal(exported.scenario?.name, "Tour");
  const imported = await importBackup(new File([blob], "Tour.mjscreen"), library.scenarios);
  assert.equal(imported.scenario.lastSceneId, imported.scenes[1].id);
  assert.equal((await getLibrary()).scenarios.length, 3);
  await assert.rejects(createBackup(library.scenes, first.scenario), /seul scénario/);
});

test("un import invalide ou vide laisse la bibliothèque intacte", async () => {
  const before = await getLibrary();
  const invalid = manifest();
  invalid.scenes.push(null as unknown as Scene);
  await assert.rejects(importBackup(new File([JSON.stringify(invalid)], "Invalide.mjscreen"), before.scenarios));
  await assert.rejects(importBackup(new File([JSON.stringify(manifest([]))], "Vide.mjscreen"), before.scenarios), /aucune scène/);
  await assert.rejects(importBackup(new File(["null"], "Invalide.mjscreen"), before.scenarios), /non reconnue/);
  assert.deepEqual(await getLibrary(), before);
});

test("une erreur de stockage annule aussi les écritures déjà préparées", async () => {
  const scenario = createScenario("Échec");
  const scene = { ...createScene(), scenarioId: scenario.id };
  // Structured clone cannot store functions: failure occurs after the scenario put.
  const invalid = { ...createScene(2), scenarioId: scenario.id, uncloneable: () => {} };
  await assert.rejects(saveScenarioBundle(scenario, [scene, invalid]));
  assert.deepEqual(await getScenes(), []);
  const library = await getLibrary();
  assert.ok(library.scenarios.every((item) => item.name !== "Échec"));
});

test("supprimer un scénario conserve les autres scènes et leurs images partagées", async () => {
  const first = createScenario("A");
  const second = createScenario("B");
  const sceneA = { ...createScene(), scenarioId: first.id, galleryAssetIds: ["shared", "only-a"] };
  const sceneB = { ...createScene(), scenarioId: second.id, galleryAssetIds: ["shared"] };
  const assets = ["shared", "only-a"].map((id) => ({ id, name: id, type: "image/png",
    width: 1, height: 1, createdAt: "2026-01-01", blob: new Blob(["image"]) }));
  await saveScenarioBundle(first, [sceneA], assets);
  await saveScenarioBundle(second, [sceneB]);
  await removeScenario(first.id, [sceneA, sceneB]);
  const library = await getLibrary();
  assert.equal(library.scenarios.length, 1);
  assert.equal(library.scenarios[0].id, second.id);
  assert.deepEqual(library.scenarios[0].media?.galleryAssetIds, ["shared"]);
  assert.equal(library.scenes[0].id, sceneB.id);
  assert.ok(await getAsset("shared"));
  assert.equal(await getAsset("only-a"), null);
});

test("les références manquantes et cartes malformées sont refusées avant écriture", () => {
  const source = manifest();
  source.scenes[0].galleryAssetIds = ["absent"];
  assert.throws(() => prepareScenarioImport(source, "Erreur.mjscreen", []), /manque/);
  source.scenes[0].galleryAssetIds = [];
  source.scenes[0].zones = [null as unknown as Scene["zones"][number]];
  assert.throws(() => prepareScenarioImport(source, "Erreur.mjscreen", []), /invalide/);
});
