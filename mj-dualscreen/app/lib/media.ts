import { syncActiveMap, type Scene, type Scenario, type ScenarioMedia } from "./model.ts";

/** Merge legacy chapter libraries once, preserving distinct prepared maps. */
export function collectScenarioMedia(scenes: Scene[]): ScenarioMedia {
  const maps = new Map<string, Scene["maps"][number]>();
  const gallery = new Set<string>();
  const imageViewports: Scene["imageViewports"] = {};
  // Latest state wins when chapters reference the same prepared map.
  for (const scene of [...scenes].sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))) {
    for (const map of syncActiveMap(scene).maps) {
      maps.set(map.id, map);
      gallery.add(map.assetId);
    }
    for (const id of scene.galleryAssetIds) gallery.add(id);
    if (scene.activeImageId) gallery.add(scene.activeImageId);
    Object.assign(imageViewports, scene.imageViewports);
  }
  return { maps: [...maps.values()], galleryAssetIds: [...gallery], imageViewports };
}

/** Project shared media into the scene snapshot used by the editor and player. */
export function withScenarioMedia(scene: Scene, media: ScenarioMedia): Scene {
  const map = media.maps.find((item) => item.id === scene.activeMapId);
  return {
    ...scene,
    ...media,
    activeImageId: scene.activeImageId && media.galleryAssetIds.includes(scene.activeImageId) ? scene.activeImageId : null,
    activeMapId: map?.id ?? null,
    mapAssetId: map?.assetId ?? null,
    outsideRevealed: map?.outsideRevealed ?? false,
    zones: map?.zones ?? [],
    strokes: map?.strokes ?? [],
    viewport: map?.viewport ?? { zoom: 1, x: 0, y: 0 },
  };
}

export function unifyScenarioMedia(scenario: Scenario, scenes: Scene[]) {
  const media = scenario.media ?? collectScenarioMedia(scenes);
  return { scenario: { ...scenario, media }, scenes: scenes.map((scene) => withScenarioMedia(scene, media)) };
}

export function updateScenarioMedia(scenario: Scenario, scenes: Scene[], changed: Scene) {
  const saved = syncActiveMap(changed);
  const media: ScenarioMedia = {
    maps: saved.maps,
    galleryAssetIds: saved.galleryAssetIds,
    imageViewports: saved.imageViewports,
  };
  return unifyScenarioMedia({ ...scenario, media }, scenes.map((scene) => scene.id === saved.id ? saved : scene));
}

export function isScenarioImageUsed(scenes: Scene[], assetId: string): boolean {
  return scenes.some((scene) => scene.maps.some((map) => map.assetId === assetId) ||
    scene.scenarioMarkdown.includes(`asset:${assetId}`));
}

/** Reading another chapter must never reveal that chapter's saved media. */
export function preservePlayerDisplay(target: Scene, current: Scene | null): Scene {
  const previous = current?.scenarioId === target.scenarioId ? current : null;
  return withScenarioMedia({
    ...target,
    activeMapId: previous?.activeMapId ?? null,
    activeImageId: previous?.activeImageId ?? null,
    panelVisible: previous?.panelVisible ?? false,
    panelWidth: previous?.panelWidth ?? target.panelWidth,
    panelSizing: previous?.panelSizing ?? "auto",
  }, { maps: target.maps, galleryAssetIds: target.galleryAssetIds, imageViewports: target.imageViewports });
}
