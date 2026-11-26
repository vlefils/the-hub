import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, extname } from 'node:path';

const root = new URL('./', import.meta.url);
const book = readFileSync(new URL('seance-mj.md', root), 'utf8');
const title = 'Avant vingt-deux heures';
const timestamp = '2026-11-26T00:00:00.000Z';
const viewport = { zoom: 1, x: 0, y: 0 };
const assets = new Map();

function loadAsset(path) {
  const name = basename(path);
  const extension = extname(name);
  const id = 'asset-avant22-' + basename(name, extension);
  if (assets.has(id)) return id;
  const bytes = readFileSync(new URL(path, root));
  const type = extension === '.png' ? 'image/png' : 'image/jpeg';
  const [width, height] = type === 'image/png'
    ? [bytes.readUInt32BE(16), bytes.readUInt32BE(20)]
    : jpegSize(bytes);
  assert.ok(width > 0 && height > 0, name);
  assets.set(id, { id, name, type, width, height, createdAt: timestamp,
    data: 'data:' + type + ';base64,' + bytes.toString('base64') });
  return id;
}

function jpegSize(bytes) {
  assert.equal(bytes.readUInt16BE(0), 0xffd8);
  for (let offset = 2; offset < bytes.length - 9;) {
    assert.equal(bytes[offset], 0xff);
    if (bytes[offset + 1] === 0xc0 || bytes[offset + 1] === 0xc2) {
      return [bytes.readUInt16BE(offset + 7), bytes.readUInt16BE(offset + 5)];
    }
    offset += 2 + bytes.readUInt16BE(offset + 2);
  }
  throw new Error('Dimensions JPEG introuvables');
}

const [, ...chapters] = book.trim().split(/(?=^## \d{2} · )/mu);
const scenes = chapters.map((chapter, sortOrder) => {
  const name = chapter.split(/\r?\n/u)[0].slice(3);
  const id = 'scene-avant22-' + (sortOrder + 1);
  const galleryAssetIds = [];
  const maps = [];
  const scenarioMarkdown = chapter.trim().replace(
    /!\[([^\]\n]+)\]\((images\/[^)]+)\)|^\[plan-[\w-]+\]: (images\/\S+) "([^"\n]+)"\r?$/gmu,
    (_, inlineAlt, inlinePath, mapPath, mapName) => {
      const assetId = loadAsset(inlinePath ?? mapPath);
      if (inlinePath) {
        galleryAssetIds.push(assetId);
        return '![' + inlineAlt + '](asset:' + assetId + ')';
      }
      maps.push({ id: 'map-' + id, name: mapName, assetId,
        outsideRevealed: true, zones: [], strokes: [], viewport });
      return '';
    },
  );
  return {
    id, name, sortOrder, scenarioTheme: 'cyberpunk',
    scenarioMarkdown: sortOrder === 0 ? '*Trois PJ de niveau 3 · 2 h à 2 h 45*\n\n' + scenarioMarkdown : scenarioMarkdown,
    mapAssetId: maps[0]?.assetId ?? null, maps, activeMapId: null,
    galleryAssetIds, activeImageId: null, imageViewports: {}, panelVisible: true,
    panelWidth: 38, outsideRevealed: true, zones: [], strokes: [], viewport, updatedAt: timestamp,
  };
});

assert.equal(scenes.length, 6);
assert.equal(assets.size, 7);
assert.equal(scenes[4].maps.length, 1);
const manifest = {
  format: 'ecran-du-mj', version: 1, exportedAt: timestamp,
  scenario: { name: title, lastSceneId: scenes[0].id }, scenes, assets: [...assets.values()],
};
writeFileSync(new URL('../../mj-dualscreen/scenarios/avant-vingt-deux-heures.mjscreen', root), JSON.stringify(manifest));
