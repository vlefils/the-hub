import assert from "node:assert/strict";
import test from "node:test";
import { createScene } from "../app/lib/model.ts";
import { legacySceneOrder } from "../app/lib/storage.ts";

test("les chapitres d'une ancienne importation retrouvent leur ordre malgré des modifications", () => {
  const scenes = [5, 1, 9, 0, 3, 7, 2, 8, 4, 6].map((number, index) => {
    const scene = createScene();
    scene.name = `${String(number).padStart(2, "0")} · Chapitre ${number}`;
    scene.updatedAt = `2026-10-14T12:${String(index).padStart(2, "0")}:00.000Z`;
    delete scene.sortOrder;
    return scene;
  });
  assert.deepEqual(
    legacySceneOrder(scenes).map((scene) => scene.name.slice(0, 2)),
    ["00", "01", "02", "03", "04", "05", "06", "07", "08", "09"],
  );
});
