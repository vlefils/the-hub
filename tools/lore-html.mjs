import { factions, zones, people, technologies } from '../data/lore.mjs';
import { principalPlaces } from '../data/lore-revision.mjs';
import { worldTitle, worldLead, worldSections, streetActorsTitle, streetActors, situationsTitle, situations, welcomeParagraphs, toneSections } from '../data/lore-review.mjs';
import { lifeCopy, publicFigures, crews, hubRegulars, sportsProfiles, arche, localDetails } from '../data/lore-life.mjs';
const esc = text => String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fName = id => factions.find(f => f.id === id)?.name || 'Paradise · zones neutres';
const accent = id => factions.find(f => f.id === id)?.accent || '#b8c7cb';
const link = (id, text) => `<a href="#${id}">${esc(text)} <span aria-hidden="true">↗</span></a>`;
const p = (text, cls = '') => `<p${cls ? ` class="${cls}"` : ''}>${esc(text)}</p>`;
export const renderLoreWelcome = () => welcomeParagraphs.map(([cls, text]) => p(text, cls)).join('\n');
const h = (text, level = 3) => `<h${level}>${esc(text)}</h${level}>`;
const head = (title, kicker) => `<div class="section-heading">${p(kicker, 'section-kicker')}<div>${h(title, 2)}</div></div>`;
const page = (id, body, attrs = '', cls = '') => `<section class="page-section panel ${cls}" id="${id}" data-section data-category="lore" ${attrs}>${body}</section>`;
const art = (id, scene, alt, panels = 3, cls = '') => `<figure class="lore-art ${cls}" style="--panels:${panels};--scene:${scene}"><img src="assets/lore/${id}.webp" alt="${esc(alt)}" width="${panels * 640}" height="640" loading="lazy" decoding="async"></figure>`;
const factionArt = f => f.art || `${f.id}-bd`;
const factionMosaic = f => `<div class="lore-dossier-mosaic">${zones.filter(z => z.art === factionArt(f)).sort((a,b) => a.scene-b.scene).map(z => art(z.art,z.scene,z.name,3,'lore-mosaic-panel')).join('')}</div>`;
const pair = (title, copy) => `<div><dt>${esc(title)}</dt><dd>${esc(copy)}</dd></div>`;
const firstSentence = text => text.split(/(?<=\.)\s+/)[0];
const order = z => (z.faction === 'neutre' ? 8 : factions.findIndex(f => f.id === z.faction)) * 10 + (z.id === principalPlaces[z.faction] ? 0 : z.principal ? 1 : 2);
const orderedZones = [...zones].sort((a,b) => order(a) - order(b));
const filters = (id, title) => `<div class="lore-filter" role="search" aria-label="${title}"><label for="${id}-search">${title}</label><input id="${id}-search" type="search" data-lore-search placeholder="Nom, faction, mot-clé…" autocomplete="off"><label for="${id}-faction">Influence</label><select id="${id}-faction" data-lore-faction><option value="all">Toutes les influences</option>${factions.map(f=>`<option value="${f.id}">${f.name}</option>`).join('')}<option value="neutre">Zones neutres</option></select><p class="lore-result-count" data-lore-count role="status"></p></div>`;
const empty = text => `<p class="lore-empty" data-lore-empty hidden>${esc(text)}</p>`;
const loreLabel = id => zones.find(z => `zone-${z.id}` === id)?.name
  || factions.find(f => `faction-${f.id}` === id)?.name
  || technologies.find(t => `tech-${t.id}` === id)?.name
  || ({ 'lore-factions': 'Les puissances de Paradise', 'lore-vie-publique': lifeCopy.title, 'lore-crews': lifeCopy.crewsTitle, 'regles-seconde-chance': 'Règles Seconde Chance', 'personnage-classe-neuro': 'Neuro', 'runner-hacker': 'Hacker', 'implant-charge-rules': 'Charge des implants', 'outils-rumbleball': 'Rumbleball' })[id];
const loreLinks = ids => `<p class="lore-place-links">${ids.map(id => link(id, loreLabel(id))).join('')}</p>`;
const readingProfile = (entry, prefix, level = 3) => `<article class="lore-life-entry" id="${prefix}-${entry.id}" data-lore-entry>${h(entry.name, level)}${entry.role ? p(entry.role, 'lore-role') : ''}${entry.paragraphs.map(text => p(text)).join('')}${entry.links ? loreLinks(entry.links) : ''}</article>`;
function publicLifePage() {
  const contents = `<nav class="lore-place-links" aria-label="${lifeCopy.title}">${publicFigures.map(person => link(`pnj-${person.id}`, person.name)).join('')}${link('sport-tribunes', lifeCopy.sportsTitle)}</nav>`;
  const sports = `<section id="sport-tribunes">${h(lifeCopy.sportsTitle)}${p(lifeCopy.sportsIntro)}${sportsProfiles.map(team => readingProfile(team, 'sport', 4)).join('')}${readingProfile(arche, 'sport', 4)}</section>`;
  return page('lore-vie-publique', head(lifeCopy.title, 'Lore') + p(lifeCopy.lead, 'lore-lead') + p(lifeCopy.intro) + contents + `<div class="lore-life">${publicFigures.map(person => readingProfile(person, 'pnj')).join('')}${sports}</div>`);
}
function crewsPage() {
  const contents = `<nav class="lore-place-links" aria-label="${lifeCopy.crewsTitle}">${crews.map(crew => link(`crew-${crew.id}`, crew.name)).join('')}</nav>`;
  const profiles = crews.map(crew => `<article class="lore-life-entry" id="crew-${crew.id}" data-lore-entry>${h(crew.name)}${p(crew.role, 'lore-role')}${p(crew.description)}<section id="pnj-${crew.spokesperson.id}">${h(crew.spokesperson.name, 4)}${p(crew.spokesperson.text)}</section>${h(lifeCopy.members, 4)}<ul class="lore-life-members">${crew.members.map(member => `<li><strong>${esc(member.name)}</strong>${p(member.text)}</li>`).join('')}</ul><dl class="lore-play">${pair(lifeCopy.work, crew.work)}${pair(lifeCopy.limits, crew.limits)}${pair(lifeCopy.offDuty, crew.habit)}</dl>${loreLinks(crew.links)}</article>`).join('');
  return page('lore-crews', head(lifeCopy.crewsTitle, 'Lore') + p(lifeCopy.crewsLead, 'lore-lead') + p(lifeCopy.crewsIntro) + contents + `<div class="lore-life">${profiles}</div>` + loreLinks(['zone-hub-commun']));
}
function hubLife() {
  const regulars = hubRegulars.map(person => `<article class="lore-life-entry" id="${person.address ? `adresse-${person.address.id}` : `pnj-${person.id}`}" data-lore-entry>${h(person.address?.name || person.name, 4)}<div${person.address ? ` id="pnj-${person.id}"` : ''}>${p(person.role, 'lore-role')}${person.paragraphs.map(text => p(text)).join('')}</div></article>`).join('');
  return `<section class="lore-life" id="hub-habitudes">${h(lifeCopy.hubTitle)}${p(lifeCopy.hubIntro)}${regulars}${loreLinks(['lore-crews'])}</section>`;
}
function placeDetails(id) {
  const details = localDetails.filter(detail => detail.zone === id);
  return details.length ? `<section class="lore-life">${h(lifeCopy.detailTitle)}${details.map(detail => `<article id="repere-${detail.id}" data-lore-entry>${h(detail.title, 4)}${p(detail.text)}</article>`).join('')}</section>` : '';
}
function worldPage() {
  const contents = `<nav class="lore-place-links" aria-label="Comprendre Paradise">${worldSections.map(s => link(s.id, s.title)).join('')}${link('paradise-quartiers', streetActorsTitle)}</nav>`;
  const sections = worldSections.map(s => `<section id="${s.id}">${h(s.title)}${s.paragraphs.map(text => p(text)).join('')}${loreLinks(s.links)}</section>`).join('');
  const actors = `<section id="paradise-quartiers">${h(streetActorsTitle)}${streetActors.map(a => `<article id="groupe-${a.id}">${h(a.name, 4)}${p(a.text)}${loreLinks([`zone-${a.zone}`])}</article>`).join('')}</section>`;
  return page('lore-paradise', head(worldTitle, 'Lore') + p(worldLead, 'lore-lead') + contents + `<div class="lore-tone">${sections}${actors}</div>` + loreLinks(['lore-vie-publique', 'lore-crews']));
}
function personCard(person) {
  const infrastructure = person.portraitKind === 'infrastructure';
  return `<article class="lore-person lore-person--embedded" id="pnj-${person.id}" data-lore-person data-person-scope="${person.scope}" data-person-faction="${person.faction}">
    ${art(person.art, person.scene, infrastructure ? `${person.name} : infrastructure distribuée` : `Portrait de ${person.name}, ${person.role}`, infrastructure ? 3 : 4, `lore-portrait${infrastructure ? ' lore-portrait--infrastructure' : ''}`)}
    <div>${h(person.name,4)}${p(person.role,'lore-role')}${person.leverage ? `<dl class="lore-play lore-person-power">${pair('Pouvoir réel',person.leverage)}</dl>` : ''}${p(person.description)}${p(person.appearance,'lore-appearance')}<dl class="lore-play">${pair('Ce qu’il propose',person.offer)}${pair('L’aborder',person.approach)}</dl><details class="lore-secret"><summary>Secret · réservé au MJ</summary>${p(person.secret)}</details>${person.scope === 'faction' ? `<p class="lore-place-links">${link(`zone-${person.zone}`,zones.find(z=>z.id===person.zone).name)}</p>` : ''}</div></article>`;
}
const figures = f => people.filter(p=>p.scope==='faction' && p.faction===f.id).sort((a,b)=>(a.id==='coeur-synapse'?-2:a.id===f.contact?-1:0)-(b.id==='coeur-synapse'?-2:b.id===f.contact?-1:0));
function factionPage(f,index) {
  const header = `<a class="lore-back" href="#lore-factions">← Toutes les factions</a><header class="lore-dossier-head">${p(`Dossier ${String(index+1).padStart(2,'0')} / ${f.kind}`,'lore-kicker')}${h(f.name,2)}${p(f.motto,'lore-motto')}<ul class="lore-domains" aria-label="Domaines d’influence">${f.domains.map(d=>`<li>${esc(d)}</li>`).join('')}</ul></header>`;
  const copy = `<div class="lore-dossier-copy">${f.blocks.map(([title,copy],i)=>`<article><span class="lore-index" aria-hidden="true">${String(i+1).padStart(2,'0')}</span><div>${h(title)}${p(copy)}</div></article>`).join('')}</div><dl class="lore-faction-facts">${f.facts.map(([label,value])=>pair(label,value)).join('')}</dl>${f.signature?p(f.signature,'lore-signature'):''}`;
  const members = `<section class="lore-major-people" aria-labelledby="figures-${f.id}"><h3 id="figures-${f.id}">Figures majeures</h3>${p('Les personnes qui engagent la faction, ses ressources et ses décisions.','lore-section-intro')}<div class="lore-embedded-people">${figures(f).map(personCard).join('')}</div></section>`;
  const sites = `<div class="lore-related">${h('Lieux et implantations')}<div class="lore-related-grid">${orderedZones.filter(z=>z.faction===f.id).map(z=>`<div>${link(`zone-${z.id}`,z.name)}${p(z.id===principalPlaces[f.id]?'Lieu central de la faction':z.level)}</div>`).join('')}</div><p>${link(`tech-${f.tech}`,technologies.find(t=>t.id===f.tech).name)}</p></div>`;
  const source = `<details class="lore-source"><summary>Fiche visuelle d’origine</summary>${p('Archive de faction conservée. Le texte HTML intègre les mises à jour du lore.')}<a href="assets/factions/${f.archive}.png" target="_blank" rel="noopener">Consulter l’archive en français ↗</a></details>`;
  return page(`faction-${f.id}`,header+factionMosaic(f)+copy+members+sites+source,`data-nav-root="lore-factions" style="--faction-accent:${f.accent}" data-lore-dossier="${f.id}"`,`lore-dossier lore-theme--${f.mood}`);
}
const directoryCard = z => `<article class="lore-place lore-place--preview" id="place-card-${z.id}" data-lore-card data-lore-target="zone-${z.id}" data-faction="${z.faction}" style="--faction-accent:${accent(z.faction)}"><a class="lore-place-link" href="#zone-${z.id}">${art(z.art,z.scene,z.name)}<div class="lore-place-body">${p(fName(z.faction),'lore-kicker')}${h(z.name)}${p(z.level,'lore-access')}${p(firstSentence(z.description))}<span class="lore-open">Explorer le lieu <span aria-hidden="true">↗</span></span></div></a></article>`;
function placePage(z) {
  const locals = people.filter(p=>p.scope==='place'&&p.zone===z.id);
  const leaders = people.filter(p=>p.scope==='faction'&&p.zone===z.id);
  const localCopy = locals.length ? `<section class="lore-local-people" aria-labelledby="contacts-${z.id}"><h3 id="contacts-${z.id}">Sur place</h3><div class="lore-embedded-people">${locals.map(personCard).join('')}</div></section>` : '';
  const powers = leaders.length ? `<aside class="lore-location-decision-makers">${h('Décideurs liés à ce lieu')}${p('Leur présentation figure dans le dossier de la faction.','lore-section-intro')}<div class="lore-place-links">${leaders.map(person=>link(`pnj-${person.id}`,person.name)).join('')}</div></aside>` : '';
  const related = z.faction!=='neutre' ? `<p class="lore-place-links">${link(`faction-${z.faction}`,fName(z.faction))}${z.id!==principalPlaces[z.faction]?link(`zone-${principalPlaces[z.faction]}`,zones.find(other=>other.id===principalPlaces[z.faction]).name):''}</p>` : '';
  const intro = `<div class="lore-location-intro"><div>${p(z.level,'lore-location-level')}${p(z.access,'lore-access')}${p(z.description,'lore-location-description')}</div>${art(z.art,z.scene,z.name,3,'lore-location-hero')}</div>`;
  const neighborhood = streetActors.filter(a => a.zone === z.id).map(a => `<p class="lore-place-links">${link(`groupe-${a.id}`,a.name)}</p>`).join('');
  const context = z.id === 'hub-commun' ? `<p class="lore-place-links">${link('paradise-treve','La trêve du Hub')}</p>` : '';
  return page(`zone-${z.id}`,`<a class="lore-back" href="#lore-zones">← Tous les lieux</a>${head(z.name,fName(z.faction))}${intro}<div class="lore-location-play"><section>${h('Tension')}${p(z.tension)}</section><section>${h('Un contrat')}${p(z.hook)}</section></div>${localCopy}${z.id === 'hub-commun' ? hubLife() : ''}${placeDetails(z.id)}${powers}${neighborhood}${context}${related}`,`data-nav-root="lore-zones" data-place-faction="${z.faction}" style="--faction-accent:${accent(z.faction)}"`,'lore-location-page');
}
const techCard = t => `<article class="lore-technology" id="tech-${t.id}" data-lore-card data-faction="${t.faction}">${art(t.art,t.scene,t.name,4,'lore-tech-art')}<div>${p(fName(t.faction),'lore-kicker')}${h(t.name)}${p(t.lead,'lore-tech-lead')}<dl class="lore-play">${pair('Principe',t.principle)}${pair('Dans la vie courante',t.daily)}${pair('Limites',t.limits)}${pair('Une piste',t.hook)}</dl><p class="lore-place-links">${link(`faction-${t.faction}`,fName(t.faction))}${t.id==='memoire'?link('regles-seconde-chance','Règles Seconde Chance'):t.id==='reseau'?link('implant-charge-rules','Charge des implants'):''}</p></div></article>`;
export function renderLore() {
  const cards = factions.map(f=>`<a class="faction-entry lore-theme--${f.mood}" href="#faction-${f.id}" style="--faction-accent:${f.accent}">${art(factionArt(f),0,f.name)}<div>${p(f.kind,'lore-kicker')}${h(f.name)}${p(f.blocks[0][1])}<span class="lore-open">Lire le dossier <span aria-hidden="true">↗</span></span></div></a>`).join('');
  const directory = page('lore-factions',head('Les puissances de Paradise','Lore / Factions')+p('Huit puissances, huit façons de tenir la ville. Leurs services font fonctionner Paradise ; leurs contrats en dessinent les frontières.','lore-lead')+p('Paradise ne tient pas par un gouvernement unique ni par une guerre ouverte permanente. Ces factions se partagent l’administration, la sécurité, la dette, la résurrection, la biotech, les réseaux, le luxe et le marché de la violence. Elles coopèrent, se disputent les concessions et recrutent au Hub pour les opérations qu’elles préfèrent ne pas signer.')+`<div class="lore-directory">${cards}</div>`);
  const atlas = page('lore-zones',head('Lieux de Paradise','Lore / Atlas urbain')+p('Les centres de pouvoir, leurs implantations et les quartiers qui vivent entre les concessions.','lore-lead')+p('Chaque lieu possède son propre dossier. Les décideurs sont présentés dans leur faction ; les contacts locaux se trouvent sur la page du lieu où ils interviennent.')+filters('zones','Trouver un lieu')+empty('Aucun lieu ne correspond. Essayez un autre mot ou une autre influence.')+`<div class="lore-place-grid">${orderedZones.map(directoryCard).join('')}</div>`,'data-lore-collection');
  const tech = page('lore-technologie',head('Technologies du quotidien','Lore / Systèmes et dépendances')+p('Ce que la technologie permet. Ce qu’elle exige en retour. Qui paie quand elle cesse de fonctionner.','lore-lead')+p('Ces huit dossiers donnent des repères de fiction, des limites et des pistes de jeu. Ils n’ajoutent pas de bonus ou de capacités : les règles des classes, des implants et de Seconde Chance restent la référence mécanique.')+filters('tech','Trouver une technologie')+empty('Aucun dossier ne correspond. Essayez un autre mot ou une autre influence.')+`<div class="lore-tech-grid">${technologies.map(techCard).join('')}</div>`,'data-lore-collection');
  const conflicts = `<section class="lore-tone">${h(situationsTitle)}${situations.map(s => `<article>${h(s.title, 4)}${p(s.text)}${loreLinks(s.links)}</article>`).join('')}</section>`;
  const tone = page('lore-ton',head('Jouer Paradise','Lore / Tonalité')+p('Une ville qui fonctionne assez pour que chacun ait quelque chose à y défendre.','lore-lead')+`<div class="lore-tone">${toneSections.map(s => h(s.title) + p(s.text)).join('')}</div><p class="lore-place-links">${link('lore-zones','Choisir un lieu')}${link('lore-factions','Découvrir les figures des factions')}</p>` + conflicts);
  return `<!-- LORE:START — generated by tools/build-lore.mjs -->\n${[worldPage(),publicLifePage(),crewsPage(),directory,...factions.map(factionPage),atlas,...orderedZones.map(placePage),tech,tone].join('\n')}\n<!-- LORE:END -->`;
}
