import {
  DEFAULT_SCENARIO_THEME,
  collectAssetIds,
  createId,
  createScenario,
  createScene,
  isScenarioTheme,
  normalizeSceneMaps,
  type AssetRecord,
  type Scene,
  type Scenario,
} from "./model.ts";
import { unifyScenarioMedia } from "./media.ts";

const DATABASE_NAME = "ecran-du-mj";
const DATABASE_VERSION = 2;
const SCENARIOS_STORE = "scenarios";
const SCENES_STORE = "scenes";
const ASSETS_STORE = "assets";
const SETTINGS_STORE = "settings";

type SettingRecord = {
  key: string;
  value: string;
};

type BackupAsset = Omit<AssetRecord, "blob"> & {
  data: string;
};

const SUPPORTED_IMAGE_TYPES = new Map([
  ["image/jpeg", "image/jpeg"],
  ["image/jpg", "image/jpeg"],
  ["image/pjpeg", "image/jpeg"],
  ["image/png", "image/png"],
  ["image/webp", "image/webp"],
]);

const IMAGE_TYPES_BY_EXTENSION = new Map([
  ["jpg", "image/jpeg"],
  ["jpeg", "image/jpeg"],
  ["png", "image/png"],
  ["webp", "image/webp"],
]);

export type BackupManifest = {
  format: "ecran-du-mj";
  version: 1;
  exportedAt: string;
  scenes: Scene[];
  assets: BackupAsset[];
  scenario?: Pick<Scenario, "name" | "lastSceneId">;
};

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(SCENARIOS_STORE)) {
        database.createObjectStore(SCENARIOS_STORE, { keyPath: "id" });
      }
      if (!database.objectStoreNames.contains(SCENES_STORE)) {
        database.createObjectStore(SCENES_STORE, { keyPath: "id" });
      }
      if (!database.objectStoreNames.contains(ASSETS_STORE)) {
        database.createObjectStore(ASSETS_STORE, { keyPath: "id" });
      }
      if (!database.objectStoreNames.contains(SETTINGS_STORE)) {
        database.createObjectStore(SETTINGS_STORE, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function legacySceneOrder(scenes: Scene[]): Scene[] {
  const groups = new Map<string, { anchor: string; scenes: Scene[] }>();
  const units: { anchor: string; scenes: Scene[] }[] = [];
  for (const scene of scenes) {
    const chapter = /^\d{2,}\s*[·.–-]\s/.test(scene.name);
    if (!chapter) {
      units.push({ anchor: scene.updatedAt, scenes: [scene] });
      continue;
    }
    const suffix = scene.name.match(/\s+\(importée(?: \d+)?\)$/)?.[0] ?? "";
    const group = groups.get(suffix);
    if (group) {
      group.scenes.push(scene);
      if (scene.updatedAt < group.anchor) group.anchor = scene.updatedAt;
    } else {
      groups.set(suffix, { anchor: scene.updatedAt, scenes: [scene] });
    }
  }
  for (const group of groups.values()) {
    group.scenes.sort((a, b) => a.name.localeCompare(b.name, "fr", { numeric: true }));
    units.push(group);
  }
  units.sort((a, b) => a.anchor.localeCompare(b.anchor));
  return units.flatMap((unit) => unit.scenes);
}

export async function getScenes(): Promise<Scene[]> {
  const database = await openDatabase();
  const transaction = database.transaction(SCENES_STORE, "readonly");
  const scenes = await requestResult(
    transaction.objectStore(SCENES_STORE).getAll() as IDBRequest<Scene[]>,
  );
  database.close();
  const normalized = scenes
    .map((scene) => normalizeSceneMaps({
      ...scene,
      scenarioMarkdown:
        typeof scene.scenarioMarkdown === "string" ? scene.scenarioMarkdown : "",
      scenarioTheme: isScenarioTheme(scene.scenarioTheme)
        ? scene.scenarioTheme
        : DEFAULT_SCENARIO_THEME,
      imageViewports:
        scene.imageViewports && typeof scene.imageViewports === "object"
          ? scene.imageViewports
          : {},
      outsideRevealed: Boolean(scene.outsideRevealed),
    }));
  if (normalized.some((scene) => !Number.isFinite(scene.sortOrder))) {
    const migrated = legacySceneOrder(normalized).map((scene, index) => ({
      ...scene,
      sortOrder: index,
    }));
    for (const scene of migrated) await putScene(scene);
    return migrated;
  }
  return normalized.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

export async function putScene(scene: Scene): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(SCENES_STORE, "readwrite");
  transaction.objectStore(SCENES_STORE).put(scene);
  await transactionDone(transaction);
  database.close();
}

export async function putScenario(scenario: Scenario): Promise<void> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(SCENARIOS_STORE, "readwrite");
    transaction.objectStore(SCENARIOS_STORE).put(scenario);
    await transactionDone(transaction);
  } finally {
    database.close();
  }
}

export function migrateScenarioLibrary(scenes: Scene[], scenarios: Scenario[]) {
  const knownIds = new Set(scenarios.map((scenario) => scenario.id));
  const unassigned = scenes.filter((scene) => !scene.scenarioId || !knownIds.has(scene.scenarioId));
  if (!unassigned.length && scenarios.length) return { scenes, scenarios };
  const legacy = createScenario(scenes.length ? "Mes scènes" : "Mon premier scénario");
  const unassignedIds = new Set(unassigned.map((scene) => scene.id));
  const migrated = scenes.length
    ? scenes.map((scene) => unassignedIds.has(scene.id) ? { ...scene, scenarioId: legacy.id } : scene)
    : [{ ...createScene(), scenarioId: legacy.id }];
  return { scenes: migrated, scenarios: [...scenarios, legacy] };
}

export async function getLibrary({ allowEmpty = false } = {}): Promise<{ scenes: Scene[]; scenarios: Scenario[] }> {
  // Normalize legacy scenes first, then migrate membership in one transaction.
  await getScenes();
  const database = await openDatabase();
  try {
    const transaction = database.transaction([SCENES_STORE, SCENARIOS_STORE], "readwrite");
    const done = transactionDone(transaction);
    const [scenes, scenarios] = await Promise.all([
      requestResult(transaction.objectStore(SCENES_STORE).getAll() as IDBRequest<Scene[]>),
      requestResult(transaction.objectStore(SCENARIOS_STORE).getAll() as IDBRequest<Scenario[]>),
    ]);
    if (allowEmpty && !scenes.length && !scenarios.length) {
      await done;
      return { scenes, scenarios };
    }
    const library = migrateScenarioLibrary(scenes.map((scene) => normalizeSceneMaps({
      ...scene,
      scenarioMarkdown: typeof scene.scenarioMarkdown === "string" ? scene.scenarioMarkdown : "",
      scenarioTheme: isScenarioTheme(scene.scenarioTheme) ? scene.scenarioTheme : DEFAULT_SCENARIO_THEME,
      imageViewports: scene.imageViewports ?? {},
      outsideRevealed: Boolean(scene.outsideRevealed),
    })), scenarios);
    for (const scenario of library.scenarios) {
      const unified = unifyScenarioMedia(scenario, library.scenes.filter((scene) => scene.scenarioId === scenario.id));
      library.scenarios = library.scenarios.map((item) => item.id === scenario.id ? unified.scenario : item);
      const members = new Map(unified.scenes.map((scene) => [scene.id, scene]));
      library.scenes = library.scenes.map((scene) => members.get(scene.id) ?? scene);
    }
    for (const scene of library.scenes) transaction.objectStore(SCENES_STORE).put(scene);
    for (const scenario of library.scenarios) transaction.objectStore(SCENARIOS_STORE).put(scenario);
    await done;
    library.scenes.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    library.scenarios.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return library;
  } finally {
    database.close();
  }
}

export async function saveScenarioBundle(
  scenario: Scenario,
  scenes: Scene[],
  assets: AssetRecord[] = [],
  keepExisting = false,
): Promise<{ scenario: Scenario; scenes: Scene[] }> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction([SCENARIOS_STORE, SCENES_STORE, ASSETS_STORE], "readwrite");
    const done = transactionDone(transaction);
    // Two consoles can open the same published adventure for the first time.
    // Check inside the write transaction so only one editable copy is created.
    if (keepExisting) {
      const existing: Scenario | undefined = await requestResult(transaction.objectStore(SCENARIOS_STORE).get(scenario.id));
      if (existing) {
        const all: Scene[] = await requestResult(transaction.objectStore(SCENES_STORE).getAll());
        await done;
        return { scenario: existing, scenes: all.filter(scene => scene.scenarioId === existing.id)
          .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)) };
      }
    }
    try {
      transaction.objectStore(SCENARIOS_STORE).put(scenario);
      for (const scene of scenes) transaction.objectStore(SCENES_STORE).put(scene);
      for (const asset of assets) transaction.objectStore(ASSETS_STORE).put(asset);
    } catch (error) {
      transaction.abort();
      await done.catch(() => {});
      throw error;
    }
    await done;
    return { scenario, scenes };
  } finally {
    database.close();
  }
}

export async function removeScenario(scenarioId: string, scenes: Scene[]): Promise<void> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction([SCENARIOS_STORE, SCENES_STORE, ASSETS_STORE], "readwrite");
    transaction.objectStore(SCENARIOS_STORE).delete(scenarioId);
    const keptAssets = new Set(collectAssetIds(scenes.filter((scene) => scene.scenarioId !== scenarioId)));
    const removedAssets = collectAssetIds(scenes.filter((scene) => scene.scenarioId === scenarioId));
    for (const id of removedAssets) {
      if (!keptAssets.has(id)) transaction.objectStore(ASSETS_STORE).delete(id);
    }
    for (const scene of scenes) {
      if (scene.scenarioId === scenarioId) transaction.objectStore(SCENES_STORE).delete(scene.id);
    }
    await transactionDone(transaction);
  } finally {
    database.close();
  }
}

export async function removeScene(sceneId: string): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(SCENES_STORE, "readwrite");
  transaction.objectStore(SCENES_STORE).delete(sceneId);
  await transactionDone(transaction);
  database.close();
}

export async function putAsset(asset: AssetRecord): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(ASSETS_STORE, "readwrite");
  transaction.objectStore(ASSETS_STORE).put(asset);
  await transactionDone(transaction);
  database.close();
}

export async function getAsset(assetId: string): Promise<AssetRecord | null> {
  const database = await openDatabase();
  const transaction = database.transaction(ASSETS_STORE, "readonly");
  const asset = await requestResult(
    transaction.objectStore(ASSETS_STORE).get(assetId) as IDBRequest<
      AssetRecord | undefined
    >,
  );
  database.close();
  return asset ?? null;
}

export async function getSetting(key: string): Promise<string | null> {
  const database = await openDatabase();
  const transaction = database.transaction(SETTINGS_STORE, "readonly");
  const setting = await requestResult(
    transaction.objectStore(SETTINGS_STORE).get(key) as IDBRequest<
      SettingRecord | undefined
    >,
  );
  database.close();
  return setting?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(SETTINGS_STORE, "readwrite");
  transaction.objectStore(SETTINGS_STORE).put({ key, value });
  await transactionDone(transaction);
  database.close();
}

export function getSupportedImageType(
  file: Pick<File, "name" | "type">,
): string | null {
  const declaredType = file.type.toLowerCase().split(";", 1)[0].trim();
  const supportedType = SUPPORTED_IMAGE_TYPES.get(declaredType);
  if (supportedType) return supportedType;

  if (declaredType && declaredType !== "application/octet-stream") return null;

  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return IMAGE_TYPES_BY_EXTENSION.get(extension) ?? null;
}

export async function validateImage(
  file: File,
): Promise<{ width: number; height: number }> {
  if (!getSupportedImageType(file)) {
    throw new Error("Format non pris en charge. Utilisez PNG, JPEG ou WebP.");
  }
  if (file.size > 30 * 1024 * 1024) {
    throw new Error("Cette image dépasse la limite de 30 Mo.");
  }

  const source = URL.createObjectURL(file);
  try {
    const dimensions = await new Promise<{ width: number; height: number }>(
      (resolve, reject) => {
        const image = new Image();
        image.onload = () =>
          resolve({
            width: image.naturalWidth,
            height: image.naturalHeight,
          });
        image.onerror = () => reject(new Error("L’image ne peut pas être lue."));
        image.src = source;
      },
    );
    if (!dimensions.width || !dimensions.height) {
      throw new Error("Les dimensions de l’image sont invalides.");
    }
    return dimensions;
  } finally {
    URL.revokeObjectURL(source);
  }
}

export async function saveImageFile(file: File): Promise<AssetRecord> {
  const dimensions = await validateImage(file);
  const type = getSupportedImageType(file);
  if (!type) {
    throw new Error("Format non pris en charge. Utilisez PNG, JPEG ou WebP.");
  }
  const asset: AssetRecord = {
    id: createId("asset"),
    name: file.name,
    type,
    blob: file.type === type ? file : new Blob([file], { type }),
    width: dimensions.width,
    height: dimensions.height,
    createdAt: new Date().toISOString(),
  };
  await putAsset(asset);
  return asset;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function dataUrlToBlob(data: string): Blob {
  const match = /^data:([^;,]+);base64,([\s\S]+)$/.exec(data);
  if (!match) throw new Error("Une image de la sauvegarde est invalide.");
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: match[1] });
}

export function parseBackupManifest(text: string): BackupManifest {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("Ce fichier n’est pas une sauvegarde valide.");
  }

  const manifest = value as Partial<BackupManifest> | null;
  if (
    !manifest ||
    manifest.format !== "ecran-du-mj" ||
    manifest.version !== 1 ||
    !Array.isArray(manifest.scenes) ||
    !Array.isArray(manifest.assets)
  ) {
    throw new Error("Version de sauvegarde non reconnue.");
  }
  return manifest as BackupManifest;
}

export async function createBackup(scenes: Scene[], scenario: Scenario): Promise<Blob> {
  if (!scenes.length || scenes.some((scene) => scene.scenarioId !== scenario.id)) {
    throw new Error("Un fichier .mjscreen doit contenir les scènes d’un seul scénario.");
  }
  scenes = unifyScenarioMedia(scenario, scenes).scenes;
  const assetIds = collectAssetIds(scenes);
  const assets = (
    await Promise.all(assetIds.map((assetId) => getAsset(assetId)))
  ).filter((asset): asset is AssetRecord => Boolean(asset));
  if (assets.length !== assetIds.length) {
    throw new Error("Une image de ce scénario est introuvable. L’export a été annulé.");
  }
  const encodedAssets: BackupAsset[] = [];
  for (const asset of assets) {
    encodedAssets.push({
      id: asset.id,
      name: asset.name,
      type: asset.type,
      width: asset.width,
      height: asset.height,
      createdAt: asset.createdAt,
      data: await blobToDataUrl(asset.blob),
    });
  }
  const manifest: BackupManifest = {
    format: "ecran-du-mj",
    version: 1,
    exportedAt: new Date().toISOString(),
    scenario: { name: scenario.name, lastSceneId: scenario.lastSceneId },
    scenes,
    assets: encodedAssets,
  };
  return new Blob([JSON.stringify(manifest)], {
    type: "application/x-ecran-du-mj+json",
  });
}

export function prepareScenarioImport(
  manifest: BackupManifest,
  filename: string,
  existingScenarios: Scenario[],
  scenarioId?: string,
): { scenario: Scenario; scenes: Scene[]; assets: AssetRecord[] } {
  if (!manifest.scenes.length) throw new Error("Le fichier ne contient aucune scène.");
  const baseName = (typeof manifest.scenario?.name === "string" && manifest.scenario.name.trim())
    || filename.replace(/\.(mjscreen|json)$/i, "").trim() || "Scénario importé";
  const names = new Set(existingScenarios.map((scenario) => scenario.name));
  let name = baseName;
  let suffix = 2;
  while (names.has(name)) name = `${baseName} (${suffix++})`;
  const scenario = createScenario(name);
  if (scenarioId) scenario.id = scenarioId;
  const assetIdMap = new Map<string, string>();
  const mapIdMap = new Map<string, string>();
  const remapMapId = (id: string) => {
    if (!mapIdMap.has(id)) mapIdMap.set(id, createId("map"));
    return mapIdMap.get(id)!;
  };
  const assets: AssetRecord[] = [];

  for (const asset of manifest.assets) {
    if (
      !asset ||
      typeof asset.id !== "string" ||
      typeof asset.data !== "string" ||
      typeof asset.name !== "string"
    ) {
      throw new Error("Une image de la sauvegarde est incomplète.");
    }
    const newId = createId("asset");
    if (assetIdMap.has(asset.id)) throw new Error("Une image est présente plusieurs fois dans le fichier.");
    assetIdMap.set(asset.id, newId);
    assets.push({
      id: newId,
      name: asset.name,
      type: asset.type,
      width: Number(asset.width) || 1,
      height: Number(asset.height) || 1,
      createdAt: new Date().toISOString(),
      blob: dataUrlToBlob(asset.data),
    });
  }

  const importedScenes: Scene[] = [];
  for (const original of manifest.scenes) {
    if (!original || typeof original.name !== "string" ||
      [original.maps, original.galleryAssetIds, original.zones, original.strokes].some(
        (value) => value !== undefined && !Array.isArray(value),
      )) {
      throw new Error("Une scène de la sauvegarde est invalide.");
    }
    const validViewport = (value: Scene["viewport"] | undefined) => value === undefined ||
      (value && [value.x, value.y, value.zoom].every(Number.isFinite));
    const validFog = (value: Pick<Scene, "zones" | "strokes" | "viewport">) =>
      validViewport(value.viewport) &&
      (value.zones ?? []).every((zone) => zone && typeof zone.id === "string" &&
        typeof zone.name === "string" && ["rect", "polygon"].includes(zone.kind) &&
        Array.isArray(zone.points) && zone.points.length >= (zone.kind === "rect" ? 2 : 3) &&
        zone.points.every((point) => point && Number.isFinite(point.x) && Number.isFinite(point.y))) &&
      (value.strokes ?? []).every((stroke) => stroke && Array.isArray(stroke.points) &&
        Number.isFinite(stroke.radius) && stroke.points.every((point) => point && Number.isFinite(point.x) && Number.isFinite(point.y)));
    if (!validFog(original) || !(original.maps ?? []).every((map) => map &&
      typeof map.id === "string" && typeof map.name === "string" &&
      Array.isArray(map.zones) && Array.isArray(map.strokes) && validFog(map)) ||
      !Object.values(original.imageViewports ?? {}).every(validViewport)) {
      throw new Error("Une carte ou une zone du scénario est invalide.");
    }
    if (collectAssetIds([{ ...original, galleryAssetIds: original.galleryAssetIds ?? [] }]).some((id) => !assetIdMap.has(id))) {
      throw new Error("Une image référencée par le scénario manque dans le fichier.");
    }

    const imageViewports: Scene["imageViewports"] = {};
    for (const [oldAssetId, viewport] of Object.entries(
      original.imageViewports ?? {},
    )) {
      const newAssetId = assetIdMap.get(oldAssetId);
      if (newAssetId) imageViewports[newAssetId] = viewport;
    }

    const scene: Scene = {
      ...createScene(),
      ...structuredClone(original),
      id: createId("scene"),
      scenarioId: scenario.id,
      name: original.name,
      scenarioMarkdown:
        typeof original.scenarioMarkdown === "string"
          ? original.scenarioMarkdown.replace(/asset:([A-Za-z0-9_-]+)/g, (match, id: string) => {
              const mapped = assetIdMap.get(id);
              return mapped ? `asset:${mapped}` : match;
            })
          : "",
      scenarioTheme: isScenarioTheme(original.scenarioTheme)
        ? original.scenarioTheme
        : DEFAULT_SCENARIO_THEME,
      mapAssetId: original.mapAssetId
        ? (assetIdMap.get(original.mapAssetId) ?? null)
        : null,
      maps: (original.maps ?? []).map((map) => ({
        ...map,
        id: remapMapId(map.id),
        assetId: assetIdMap.get(map.assetId) ?? "",
      })).filter((map) => Boolean(map.assetId)),
      activeMapId: null,
      galleryAssetIds: (original.galleryAssetIds ?? [])
        .map((id) => assetIdMap.get(id))
        .filter((id): id is string => Boolean(id)),
      activeImageId: original.activeImageId
        ? (assetIdMap.get(original.activeImageId) ?? null)
        : null,
      imageViewports,
      outsideRevealed: Boolean(original.outsideRevealed),
      sortOrder: importedScenes.length,
      updatedAt: new Date().toISOString(),
    };
    if (original.activeMapId && original.maps?.length) {
      const index = original.maps.findIndex((map) => map.id === original.activeMapId);
      scene.activeMapId = scene.maps[index]?.id ?? scene.maps[0]?.id ?? null;
    }
    const normalized = normalizeSceneMaps(scene);
    importedScenes.push(normalized);
    if (original.id === manifest.scenario?.lastSceneId) scenario.lastSceneId = normalized.id;
  }
  scenario.lastSceneId ??= importedScenes[0].id;
  return { ...unifyScenarioMedia(scenario, importedScenes), assets };
}

export async function importBackup(file: File, existingScenarios: Scenario[]) {
  const bundle = prepareScenarioImport(parseBackupManifest(await file.text()), file.name, existingScenarios);
  await saveScenarioBundle(bundle.scenario, bundle.scenes, bundle.assets);
  return bundle;
}
