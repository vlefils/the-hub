import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { factions, zones, people, technologies, baseEnglish } from '../data/lore.mjs';
import { principalPlaces } from '../data/lore-revision.mjs';
import { reviewEnglish, worldSections, streetActors, situations } from '../data/lore-review.mjs';
import { lifeEnglish, publicFigures, crews, hubRegulars, sportsProfiles, arche, localDetails } from '../data/lore-life.mjs';
const root = new URL('../', import.meta.url);
const html = await readFile(new URL('index.html', root), 'utf8');
const dictionary = JSON.parse(await readFile(new URL('i18n/en.json', root), 'utf8'));
const source = JSON.parse(await readFile(new URL('i18n/source-strings.json', root), 'utf8'));
assert.equal(factions.length, 8); assert.equal(zones.length, 36); assert.equal(people.length, 28); assert.equal(technologies.length, 8);
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
assert.equal(new Set(ids).size, ids.length, 'Every HTML id must be unique.');
const known = new Set(ids);
for (const [, id] of html.matchAll(/href="#([^"]+)"/g)) assert.ok(known.has(id), `Broken anchor #${id}`);
for (const f of factions) {
  assert.ok(zones.filter(z => z.faction === f.id).length >= 3, `${f.name} needs at least three places.`);
  assert.ok(zones.some(z => z.id === principalPlaces[f.id] && z.faction === f.id), `${f.name} needs a central place.`);
  assert.ok(people.filter(p => p.faction === f.id && p.scope === 'faction').length >= 2, `${f.name} needs decision makers.`);
  assert.ok(people.some(p => p.id === f.contact)); assert.ok(technologies.some(t => t.id === f.tech));
  assert.ok(known.has(`faction-${f.id}`)); await access(new URL(`assets/factions/${f.archive}.png`, root));
}
for (const person of people) assert.ok(zones.some(z => z.id === person.zone));
const art = new Set([...zones, ...people, ...technologies].map(e => e.art));
assert.equal(art.size, 22);
for (const name of art) await access(new URL(`assets/lore/${name}.webp`, root));
for (const text of source.texts) assert.ok(Object.hasOwn(dictionary.texts, text), `Missing English text: ${text}`);
for (const [fr, en] of [...Object.entries(baseEnglish), ...Object.entries(reviewEnglish), ...Object.entries(lifeEnglish)]) assert.equal(dictionary.texts[fr], en, `Editorial English drift: ${fr}`);
for (const entry of [...worldSections, ...situations, ...publicFigures, ...crews, arche]) for (const id of entry.links) assert.ok(known.has(id), `Unknown editorial reference: ${id}`);
for (const group of streetActors) {
  assert.ok(zones.some(z => z.id === group.zone), `Unknown group location: ${group.id}`);
  assert.ok(known.has(`groupe-${group.id}`), `Missing neighborhood group: ${group.id}`);
}
const token = s => [...s.matchAll(/\{\{(\d+)\}\}/g)].map(m => m[1]).sort().join(',');
for (const [fr, en] of dictionary.templates) assert.equal(token(en), token(fr), `Interpolation changed: ${fr}`);
const dice = s => (s.match(/\b\d+d\d+\b/g) || []).sort().join(',');
for (const [fr, en] of Object.entries(dictionary.texts)) assert.equal(dice(en), dice(fr), `Dice changed: ${fr}`);
const pages = new Map(html.split(/(?=<section class="page-section panel)/).filter(chunk => chunk.startsWith('<section class="page-section panel')).map(chunk => [chunk.match(/\bid="([^"]+)"/)[1], chunk]));
assert.ok(!pages.has('lore-pnj'), 'No dedicated NPC directory.');
for (const z of zones) assert.ok(pages.get(`zone-${z.id}`)?.includes('data-nav-root="lore-zones"'), `Missing location page: ${z.id}`);
for (const person of people) {
  const owner = person.scope === 'faction' ? `faction-${person.faction}` : `zone-${person.zone}`;
  assert.ok(pages.get(owner)?.includes(`id="pnj-${person.id}"`), `${person.name} must appear inside ${owner}.`);
  assert.ok(!pages.has(`pnj-${person.id}`), 'An NPC anchor must not become a dedicated page.');
}
const embedded = (owner, id) => {
  assert.ok(pages.get(owner)?.includes(`id="${id}"`), `${id} must appear inside ${owner}.`);
  assert.ok(!pages.has(id), `${id} must remain an embedded entry.`);
};
for (const person of publicFigures) embedded('lore-vie-publique', `pnj-${person.id}`);
for (const crew of crews) {
  embedded('lore-crews', `crew-${crew.id}`);
  embedded('lore-crews', `pnj-${crew.spokesperson.id}`);
}
for (const person of hubRegulars) {
  embedded('zone-hub-commun', `pnj-${person.id}`);
  if (person.address) embedded('zone-hub-commun', `adresse-${person.address.id}`);
}
for (const team of [...sportsProfiles, arche]) embedded('lore-vie-publique', `sport-${team.id}`);
for (const detail of localDetails) embedded(`zone-${detail.zone}`, `repere-${detail.id}`);
const synapse = factions.find(f => f.id === 'synapse');
assert.ok(synapse.blocks.some(([title]) => title === 'Drones : la ruche'));
assert.ok(synapse.blocks.some(([title]) => title === 'Autonomes : une volonté locale'));
assert.ok(people.filter(p => p.faction === 'synapse').every(p => /Autonome|IA centrale/.test(p.role)), 'Synapse contacts must match the robotic canon.');
assert.equal(people.filter(p=>p.scope==='faction').length,17);
assert.equal(people.filter(p=>p.scope==='place').length,11);
console.log(`Validated: 8 factions, 36 location pages, 17 faction figures, 11 local contacts, 8 technologies, 22 BD atlases; ${worldSections.length} world sections and ${streetActors.length} local groups; ${source.texts.length} texts and ${dictionary.templates.length} templates. Ownership, editorial translations, references, anchors, assets, dice and interpolation tokens are intact.`);
console.log(`Everyday life: ${publicFigures.length} public figures, ${crews.length} crews, ${hubRegulars.length} Hub contacts, ${hubRegulars.filter(p => p.address).length} small addresses, ${localDetails.length} local details and ${sportsProfiles.length} sports teams with the Ark. All are embedded at their intended scale.`);
