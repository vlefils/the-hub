import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { IDBFactory } from "fake-indexeddb";
import { hubScenarios, openHubScenario } from "../app/lib/catalog.ts";
import { getAsset, getLibrary, saveScenarioBundle } from "../app/lib/storage.ts";
import { collectAssetIds } from "../app/lib/model.ts";

test("les aventures publiées sont complètes et ouvrables dans une bibliothèque vide", async t => {
  globalThis.indexedDB = new IDBFactory();
  t.mock.method(globalThis, "fetch", async (url: string) =>
    new Response(await readFile(new URL("../" + url, import.meta.url))));
  assert.deepEqual(await getLibrary({ allowEmpty: true }), { scenes: [], scenarios: [] });
  for (const entry of hubScenarios) {
    const { scenario, scenes } = await openHubScenario(entry, []);
    assert.equal(scenario.name, entry.name);
    assert.ok(scenes.length > 0 && scenes.every(scene => scene.scenarioMarkdown));
    assert.ok(scenes.every(scene => !scene.activeMapId && !scene.activeImageId));
    for (const id of collectAssetIds(scenes)) assert.ok((await getAsset(id))?.blob.size);
  }
  assert.equal((await getLibrary()).scenarios.length, hubScenarios.length);
});

test("deux ouvertures simultanées puis une réouverture préservent la même partie", async t => {
  globalThis.indexedDB = new IDBFactory();
  const entry = hubScenarios[0];
  const bytes = await readFile(new URL(`../scenarios/${entry.id}.mjscreen`, import.meta.url));
  t.mock.method(globalThis, "fetch", async () => new Response(bytes));
  const [first, other] = await Promise.all([openHubScenario(entry, []), openHubScenario(entry, [])]);
  assert.deepEqual(first, other);
  first.scenes[0].scenarioMarkdown = "Notes de table";
  first.scenario.lastSceneId = first.scenes[1].id;
  await saveScenarioBundle(first.scenario, first.scenes);
  assert.deepEqual(await openHubScenario(entry, []), first);
  const library = await getLibrary();
  assert.equal(library.scenarios.length, 1);
  assert.equal(library.scenes.length, first.scenes.length);
  assert.equal(library.scenes[0].scenarioMarkdown, "Notes de table");
});

test("une aventure indisponible ne crée pas de copie incomplète", async t => {
  globalThis.indexedDB = new IDBFactory();
  t.mock.method(globalThis, "fetch", async () => new Response(null, { status: 404 }));
  await assert.rejects(openHubScenario(hubScenarios[1], []), /réessayer/);
  assert.deepEqual(await getLibrary({ allowEmpty: true }), { scenes: [], scenarios: [] });
});
