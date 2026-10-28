import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { factions, zones, people, technologies, baseEnglish } from '../data/lore.mjs';
import { principalPlaces } from '../data/lore-revision.mjs';
import { reviewEnglish, worldSections, streetActors, situations } from '../data/lore-review.mjs';
import { lifeEnglish, publicFigures, crews, hubRegulars, sportsProfiles, arche, localDetails } from '../data/lore-life.mjs';
import { socialPlaces, socialPlacesEnglish } from '../data/lore-social-places.mjs';
import { hubCopy, hubSections, hubStops, hubEnglish } from '../data/lore-hub.mjs';
import { leisureDossiers, leisureEnglish } from '../data/lore-leisure.mjs';
import { navigationEnglish } from '../data/lore-navigation.mjs';
const root = new URL('../', import.meta.url);
const html = await readFile(new URL('index.html', root), 'utf8');
const dictionary = JSON.parse(await readFile(new URL('i18n/en.json', root), 'utf8'));
const source = JSON.parse(await readFile(new URL('i18n/source-strings.json', root), 'utf8'));
assert.equal(factions.length, 8); assert.equal(zones.length, 37); assert.equal(people.length, 28); assert.equal(technologies.length, 8);
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
const art = new Set([...zones, ...people, ...technologies, ...crews, ...leisureDossiers, ...publicFigures, ...sportsProfiles, ...hubStops.filter(stop => stop.art)].map(e => e.art));
assert.equal(art.size, 43);
for (const name of art) await access(new URL(`assets/lore/${name}.webp`, root));
for (const [fr,en] of Object.entries(navigationEnglish)) assert.equal(dictionary.texts[fr], en);
for (const text of source.texts) assert.ok(Object.hasOwn(dictionary.texts, text), `Missing English text: ${text}`);
for (const [fr, en] of [...Object.entries(baseEnglish), ...Object.entries(reviewEnglish), ...Object.entries(lifeEnglish), ...Object.entries(socialPlacesEnglish), ...Object.entries(hubEnglish), ...Object.entries(leisureEnglish)]) assert.equal(dictionary.texts[fr], en, `Editorial English drift: ${fr}`);
for (const entry of [...worldSections, ...situations, ...publicFigures, ...crews, arche, ...socialPlaces, ...hubStops, ...leisureDossiers]) for (const id of entry.links) assert.ok(known.has(id), `Unknown editorial reference: ${id}`);
for (const group of streetActors) {
  assert.ok(zones.some(z => z.id === group.zone), `Unknown group location: ${group.id}`);
  assert.ok(known.has(`groupe-${group.id}`), `Missing neighborhood group: ${group.id}`);
}
const token = s => [...s.matchAll(/\{\{(\d+)\}\}/g)].map(m => m[1]).sort().join(',');
for (const [fr, en] of dictionary.templates) assert.equal(token(en), token(fr), `Interpolation changed: ${fr}`);
const dice = s => (s.match(/\b\d+d\d+\b/g) || []).sort().join(',');
for (const [fr, en] of Object.entries(dictionary.texts)) assert.equal(dice(en), dice(fr), `Dice changed: ${fr}`);
const pages = new Map(html.split(/(?=<section class="page-section panel)/).filter(chunk => chunk.startsWith('<section class="page-section panel')).map(chunk => [chunk.match(/\bid="([^"]+)"/)[1], chunk]));
for (const [pageId, body] of pages) {
  if (!body.slice(0, body.indexOf('>')).includes('data-category="lore"')) continue;
  const localIds = new Set([...body.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]));
  for (const [,target] of body.matchAll(/href="#([^"]+)"/g)) assert.ok(!localIds.has(target), `${pageId} must not link to itself or one of its own sections: ${target}`);
  assert.ok(!body.includes('class="lore-place-links"'), 'Inline related links have been consolidated into the footer.');
  const related = body.match(/<nav class="lore-related"[\s\S]*?<\/nav>/g) || [];
  assert.ok(related.length <= 1, `${pageId} must have at most one related articles footer.`);
  if (related.length) {
    const targets = [...related[0].matchAll(/href="#([^"]+)"/g)].map(match=>match[1]);
    assert.equal(new Set(targets).size, targets.length, `Duplicate related article in ${pageId}`);
    assert.equal((related[0].match(/<img /g) || []).length, targets.length, 'Every related tile has a thumbnail.');
    for (const [,src] of related[0].matchAll(/src="([^"]+)"/g)) await access(new URL(src, root));
    assert.ok(body.slice(body.indexOf(related[0]) + related[0].length).startsWith('</section>'), 'Related articles must end the dossier.');
  }
}
assert.ok(!pages.has('lore-pnj'), 'No dedicated NPC directory.');
assert.ok(!known.has('lore-vie-publique'), 'Public figures now belong to places, not a separate directory.');
assert.ok(!known.has('lore-crews'), 'Crews belong to the Hub location.');
assert.ok(pages.get('lore-the-hub').includes(`<h2>${hubCopy.welcome}</h2>`), 'Welcome and Hub location have distinct titles.');
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
for (const person of publicFigures) {
  assert.equal(person.zone, 'sphere');
  embedded(`zone-${person.zone}`, `pnj-${person.id}`);
}
assert.equal(crews.length, 8);
assert.deepEqual([...new Set(crews.map(crew => crew.members.length + 1))].sort(), [3, 4, 5, 6]);
assert.equal(crews.reduce((total, crew) => total + crew.members.length + 1, 0), 33);
assert.equal(new Set(crews.map(crew => crew.art)).size, crews.length);
for (const crew of crews) {
  embedded('zone-hub-commun', `crew-${crew.id}`);
  embedded('zone-hub-commun', `pnj-${crew.spokesperson.id}`);
  assert.ok(crew.encounter && crew.members.length >= 2);
  assert.ok(pages.get('zone-hub-commun').includes(`src="assets/lore/${crew.art}.webp"`));
}
embedded('zone-hub-commun', 'hub-crews');
for (const section of hubSections) embedded('zone-hub-commun', section.id);
for (const stop of hubStops) embedded('zone-hub-commun', `adresse-${stop.id}`);
for (const person of hubRegulars) {
  embedded('zone-hub-commun', `pnj-${person.id}`);
  if (person.address) embedded('zone-hub-commun', `adresse-${person.address.id}`);
}
for (const team of sportsProfiles) {
  assert.equal(team.leisure, 'loisir-rumbleball');
  embedded(team.leisure, `sport-${team.id}`);
  assert.ok(pages.get(team.leisure).includes(`src="assets/lore/${team.art}.webp"`));
}
embedded('zone-arche', 'sport-arche');
for (const entry of leisureDossiers) {
  assert.ok(pages.get(entry.id)?.includes('data-nav-root="lore-loisirs"'));
  assert.ok(pages.get('lore-loisirs').includes(`href="#${entry.id}"`));
  for (const section of entry.sections) embedded(entry.id, section.id);
}
for (const person of publicFigures) assert.ok(pages.get('zone-sphere').includes(`src="assets/lore/${person.art}.webp"`));
assert.ok(!pages.get('lore-zones').includes('place-card-sphere'), 'The Sphere belongs to leisure, not the physical atlas.');
assert.ok(!pages.get('zone-arche').includes('id="sport-boyz"'), 'Teams belong to the sport, not to a single stadium.');
for (const place of socialPlaces) {
  for (const section of place.sections) embedded(`zone-${place.id}`, section.id);
  assert.ok(pages.get(`zone-${place.id}`).includes('--panels:1'), 'Standalone illustrations must not be cropped as an atlas.');
}
embedded('loisir-rumbleball', 'sport-tribunes');
embedded('zone-sphere', 'sphere-voix');
for (const detail of localDetails) embedded(`zone-${detail.zone}`, `repere-${detail.id}`);
const synapse = factions.find(f => f.id === 'synapse');
assert.ok(synapse.blocks.some(([title]) => title === 'Drones : la ruche'));
assert.ok(synapse.blocks.some(([title]) => title === 'Autonomes : une volonté locale'));
assert.ok(people.filter(p => p.faction === 'synapse').every(p => /Autonome|IA centrale/.test(p.role)), 'Synapse contacts must match the robotic canon.');
assert.equal(people.filter(p=>p.scope==='faction').length,17);
assert.equal(people.filter(p=>p.scope==='place').length,11);
console.log(`Validated: 8 factions, ${zones.length} location pages, 17 faction figures, 11 local contacts, 8 technologies, ${art.size} BD image files; ${worldSections.length} world sections and ${streetActors.length} local groups; ${source.texts.length} texts and ${dictionary.templates.length} templates. Ownership, editorial translations, references, anchors, assets, dice and interpolation tokens are intact.`);
console.log(`Everyday life: ${publicFigures.length} public figures, ${crews.length} crews, ${hubRegulars.length} Hub contacts, ${hubRegulars.filter(p => p.address).length} small addresses, ${localDetails.length} local details and ${sportsProfiles.length} sports teams with the Ark. All are embedded at their intended scale.`);
