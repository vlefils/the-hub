import { factions, zones, people, technologies } from './lore.mjs';
import { leisureDossiers } from './lore-leisure.mjs';
import { publicFigures, hubRegulars } from './lore-life.mjs';
import { hubCopy, hubSections, hubStops } from './lore-hub.mjs';

export const navigationEnglish = {};
const L = (fr, en) => { navigationEnglish[fr] = en; return fr; };
export const relatedTitle = L('Articles connexes', 'Related articles');
const kinds = {
  place: L('Lieu', 'Place'), faction: L('Faction', 'Faction'), technology: L('Technologie', 'Technology'),
  leisure: L('Loisir', 'Leisure'), person: L('Personnalité', 'Public figure'),
  contact: L('Contact', 'Contact'), directory: L('Collection', 'Collection'),
  hub: L('Au Hub', 'At the Hub'), rules: L('Règles', 'Rules'), tool: L('Outil', 'Tool'),
};
const entries = new Map();
const add = (id, title, kind, image, owner = id) => entries.set(id, { id, title, kind, owner, ...image });
const visual = (entry, panels = 3) => ({ src: `assets/lore/${entry.art}.webp`, scene: entry.scene || 0, panels: entry.panels || panels });
for (const z of zones) add(`zone-${z.id}`, z.name, kinds.place, visual(z));
for (const f of factions) add(`faction-${f.id}`, f.name, kinds.faction, visual({art:f.art || `${f.id}-bd`}));
for (const t of technologies) add(`tech-${t.id}`, t.name, kinds.technology, visual(t, 4), 'lore-technologie');
for (const entry of leisureDossiers) add(entry.id, entry.name, kinds.leisure, visual(entry, 1));
for (const person of people) add(`pnj-${person.id}`, person.name, kinds.contact, {...visual(person, person.portraitKind === 'infrastructure' ? 3 : 4), portrait: true}, person.scope === 'faction' ? `faction-${person.faction}` : `zone-${person.zone}`);
for (const person of publicFigures) add(`pnj-${person.id}`, person.name, kinds.person, visual(person, 1), 'zone-sphere');
const hubImage = visual(zones.find(z=>z.id === 'hub-commun'));
for (const stop of hubStops) add(`adresse-${stop.id}`, stop.name, kinds.hub, stop.art ? visual(stop) : hubImage, 'zone-hub-commun');
for (const person of hubRegulars) {
  add(`pnj-${person.id}`, person.name, kinds.contact, hubImage, 'zone-hub-commun');
  if (person.address) add(`adresse-${person.address.id}`, person.address.name, kinds.hub, hubImage, 'zone-hub-commun');
}
for (const section of hubSections) add(section.id, section.title, kinds.hub, hubImage, 'zone-hub-commun');
add('hub-crews', hubCopy.crewsTitle, kinds.hub, {src:'assets/lore/crew-mastiff-bd-v2.webp',scene:0,panels:1}, 'zone-hub-commun');
add('lore-zones', L('Lieux de Paradise', 'Places of Paradise'), kinds.directory, hubImage);
add('lore-factions', L('Les puissances de Paradise', 'The powers of Paradise'), kinds.directory, visual(zones.find(z=>z.id === 'palais-des-actes')));
add('lore-technologie', L('Technologies du quotidien', 'Everyday technology'), kinds.directory, visual(technologies[0],4));
const landmark = file => ({src:`assets/landmarks/${file}.webp`,scene:0,panels:1});
add('chroma-catalogue', 'Chroma Shop', kinds.tool, landmark('chroma-catalogue'));
add('regles-seconde-chance', L('Règles Seconde Chance', 'Second Chance rules'), kinds.rules, landmark('rules-second-chance'));
add('personnage-classe-neuro', 'Neuro', kinds.rules, landmark('neuro-base'));
add('runner-hacker', 'Hacker', kinds.rules, landmark('tools-overview'), 'personnage-classe-runner');
add('implant-charge-rules', L('Charge des implants', 'Implant load'), kinds.rules, landmark('chroma-implant-load'), 'chroma-catalogue');
add('outils-rumbleball', L('Rumbleball Manager', 'Rumbleball Manager'), kinds.tool, {src:'assets/lore/arche-stadium-bd.webp',scene:0,panels:1});

export function relatedEntries(ids, currentPage) {
  return [...new Set(ids)].map(id => {
    const entry = entries.get(id);
    if (!entry) throw new Error(`Missing related article metadata: ${id}`);
    return entry;
  }).filter(entry => entry.owner !== currentPage);
}
