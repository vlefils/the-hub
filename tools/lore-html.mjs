import { factions, zones, people, technologies } from '../data/lore.mjs';
import { principalPlaces } from '../data/lore-revision.mjs';
import { worldTitle, worldLead, worldIntro, worldSections, hubTruce, streetActorsTitle, streetActors, situationsTitle, situations, welcomeParagraphs, toneSections, lorePageCopy } from '../data/lore-review.mjs';
import { lifeCopy, publicFigures, crews, hubRegulars, sportsProfiles, arche, localDetails } from '../data/lore-life.mjs';
import { socialPlaceCopy } from '../data/lore-social-places.mjs';
import { hubCopy, hubSections, hubStops } from '../data/lore-hub.mjs';
import { leisureCopy, leisureDossiers } from '../data/lore-leisure.mjs';
import { relatedTitle, relatedEntries } from '../data/lore-navigation.mjs';
const esc = text => String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fName = id => factions.find(f => f.id === id)?.name || lorePageCopy.sharedContext;
const accent = id => factions.find(f => f.id === id)?.accent || '#b8c7cb';
const p = (text, cls = '') => `<p${cls ? ` class="${cls}"` : ''}>${esc(text)}</p>`;
const richParagraph = text => `<p>${text.split(/\*\*(.*?)\*\*/g).map((part, i) => i % 2 ? `<strong>${esc(part)}</strong>` : esc(part)).join('')}</p>`;
export const renderLoreWelcome = () => welcomeParagraphs.map(([cls, text]) => p(text, cls)).join('\n');
const h = (text, level = 3) => `<h${level}>${esc(text)}</h${level}>`;
const head = (title, kicker) => `<div class="section-heading">${p(kicker, 'section-kicker')}<div>${h(title, 2)}</div></div>`;
const page = (id, body, attrs = '', cls = '', relatedIds = []) => `<section class="page-section panel ${cls}" id="${id}" data-section data-category="lore" ${attrs}>${body}${relatedArticles(relatedIds, id)}</section>`;
function relatedArticles(ids, currentPage) {
  const entries = relatedEntries(ids, currentPage);
  if (!entries.length) return '';
  const tiles = entries.map(entry => `<li><a class="lore-related-card" href="#${entry.id}"><span class="lore-related-thumb${entry.portrait ? ' lore-related-thumb--portrait' : ''}" style="--panels:${entry.panels};--scene:${entry.scene}"><img src="${entry.src}" alt="" width="${entry.panels * 640}" height="640" loading="lazy" decoding="async"></span><span class="lore-related-copy"><span class="lore-related-kind">${esc(entry.kind)}</span><strong>${esc(entry.title)}</strong></span><span class="lore-related-arrow" aria-hidden="true">→</span></a></li>`).join('');
  return `<nav class="lore-related" aria-label="${relatedTitle}">${h(relatedTitle)}<ul class="lore-related-grid">${tiles}</ul></nav>`;
}
const art = (id, scene, alt, panels = 3, cls = '') => `<figure class="lore-art ${cls}${panels === 1 && cls === 'lore-location-hero' ? ' lore-location-hero--single' : ''}" style="--panels:${panels};--scene:${scene}"><img src="assets/lore/${id}.webp" alt="${esc(alt)}" width="${panels * 640}" height="640" loading="lazy" decoding="async"></figure>`;
const factionArt = f => f.art || `${f.id}-bd`;
const factionMosaic = f => `<div class="lore-dossier-mosaic">${zones.filter(z => z.art === factionArt(f)).sort((a,b) => a.scene-b.scene).map(z => art(z.art,z.scene,z.name,3,'lore-mosaic-panel')).join('')}</div>`;
const pair = (title, copy) => `<div><dt>${esc(title)}</dt><dd>${esc(copy)}</dd></div>`;
const firstSentence = text => text.split(/(?<=\.)\s+/)[0];
const order = z => (z.faction === 'neutre' ? 8 : factions.findIndex(f => f.id === z.faction)) * 10 + (z.id === principalPlaces[z.faction] ? 0 : z.principal ? 1 : 2);
const orderedZones = [...zones].sort((a,b) => order(a) - order(b));
const filters = (id, title) => `<div class="lore-filter" role="search" aria-label="${title}"><label for="${id}-search">${title}</label><input id="${id}-search" type="search" data-lore-search placeholder="Nom, faction, mot-clé…" autocomplete="off"><label for="${id}-faction">Influence</label><select id="${id}-faction" data-lore-faction><option value="all">Toutes les influences</option>${factions.map(f=>`<option value="${f.id}">${f.name}</option>`).join('')}<option value="neutre">${esc(lorePageCopy.sharedPlaces)}</option></select><p class="lore-result-count" data-lore-count role="status"></p></div>`;
const empty = text => `<p class="lore-empty" data-lore-empty hidden>${esc(text)}</p>`;
const readingProfile = (entry, prefix, level = 3) => `<article class="lore-life-entry" id="${prefix}-${entry.id}" data-lore-entry>${h(entry.name, level)}${entry.role ? p(entry.role, 'lore-role') : ''}${entry.paragraphs.map(text => p(text)).join('')}</article>`;
const illustratedProfile = (entry, prefix) => `<article class="lore-person lore-person--embedded" id="${prefix}-${entry.id}" data-lore-entry>${art(entry.art, 0, entry.name, 1, 'lore-single-portrait')}<div>${h(entry.name, 4)}${p(entry.role, 'lore-role')}${entry.paragraphs.map(text => p(text)).join('')}</div></article>`;
function leisureProfiles(kind) {
  if (!kind) return '';
  const sports = kind === 'sports';
  return `<section class="lore-major-people" id="${sports ? 'sport-tribunes' : 'sphere-voix'}">${h(sports ? leisureCopy.teams : socialPlaceCopy.figuresTitle)}${p(sports ? leisureCopy.teamsIntro : socialPlaceCopy.figuresIntro, 'lore-section-intro')}<div class="lore-embedded-people">${(sports ? sportsProfiles : publicFigures).map(entry => illustratedProfile(entry, sports ? 'sport' : 'pnj')).join('')}</div></section>`;
}
function leisurePage(entry) {
  const intro = `<div class="lore-location-intro"><div>${p(entry.level, 'lore-location-level')}${entry.access ? p(entry.access, 'lore-access') : ''}${p(entry.description, 'lore-location-description')}</div>${art(entry.art, entry.scene, entry.name, entry.panels, 'lore-location-hero')}</div>`;
  const sections = `<div class="lore-life">${entry.sections.map(section => `<section id="${section.id}">${h(section.title)}${section.paragraphs.map(text => p(text)).join('')}</section>`).join('')}</div>`;
  const play = entry.tension ? `<div class="lore-location-play"><section>${h('Tension')}${p(entry.tension)}</section><section>${h('Un contrat')}${p(entry.hook)}</section></div>` : '';
  return page(entry.id, `<a class="lore-back" href="#lore-loisirs">${leisureCopy.back}</a>${head(entry.name, leisureCopy.kicker)}${intro}${sections}${leisureProfiles(entry.profiles)}${play}`, 'data-nav-root="lore-loisirs"', 'lore-location-page', [...entry.links, ...(entry.profiles === 'figures' ? publicFigures.flatMap(person => person.links) : [])]);
}
function leisureDirectory() {
  const cards = leisureDossiers.map(entry => `<article class="lore-place lore-place--preview"><a class="lore-place-link" href="#${entry.id}">${art(entry.art, entry.scene, entry.name, entry.panels)}<div class="lore-place-body">${h(entry.name)}${p(entry.level, 'lore-access')}${p(firstSentence(entry.description))}<span class="lore-open">${leisureCopy.open} <span aria-hidden="true">↗</span></span></div></a></article>`).join('');
  return page('lore-loisirs', head(leisureCopy.title, leisureCopy.kicker) + p(leisureCopy.lead, 'lore-lead') + p(leisureCopy.intro) + `<div class="lore-place-grid">${cards}</div>`);
}
function hubCrews() {
  const profiles = crews.map(crew => `<article class="lore-crew" id="crew-${crew.id}" data-lore-entry>${h(crew.name, 4)}${p(crew.role, 'lore-role')}<div class="lore-crew-intro">${p(crew.description)}${art(crew.art, 0, crew.name, 1, 'lore-crew-art')}</div><div class="lore-crew-copy"><section id="pnj-${crew.spokesperson.id}">${h(crew.spokesperson.name, 5)}${p(crew.spokesperson.text)}</section><ul class="lore-life-members" aria-label="${hubCopy.members}">${crew.members.map(member => `<li><strong>${esc(member.name)}</strong>${p(member.text)}</li>`).join('')}</ul><dl class="lore-play">${pair(hubCopy.work, crew.work)}${pair(hubCopy.limits, crew.limits)}${pair(hubCopy.habit, crew.habit)}${pair(hubCopy.encounter, crew.encounter)}</dl></div></article>`).join('');
  return `<section id="hub-crews" class="lore-hub-crews">${h(hubCopy.crewsTitle)}${p(hubCopy.crewsIntro)}${profiles}</section>`;
}
function hubLife() {
  const regulars = hubRegulars.map(person => `<article class="lore-life-entry" id="${person.address ? `adresse-${person.address.id}` : `pnj-${person.id}`}" data-lore-entry>${h(person.address?.name || person.name, 4)}<div${person.address ? ` id="pnj-${person.id}"` : ''}>${p(person.role, 'lore-role')}${person.paragraphs.map(text => p(text)).join('')}</div></article>`).join('');
  const stops = hubStops.map(stop => `<article class="lore-life-entry" id="adresse-${stop.id}" data-lore-entry>${h(stop.name, 4)}${p(stop.role, 'lore-role')}${stop.art ? art(stop.art, stop.scene, stop.name, stop.panels, 'lore-hub-stop-art') : ''}${stop.paragraphs.map(text => p(text)).join('')}</article>`).join('');
  return `<section class="lore-life" id="hub-habitudes">${h(hubCopy.placesTitle)}${p(hubCopy.placesIntro)}${stops}${regulars}</section>`;
}
function hubPage(z) {
  const intro = `<div class="lore-location-intro"><div>${p(z.level, 'lore-location-level')}${p(z.access, 'lore-access')}${p(z.description, 'lore-location-description')}</div>${art(z.art, z.scene, z.name, 3, 'lore-location-hero')}</div>`;
  const sections = `<div class="lore-life">${hubSections.map(section => `<section id="${section.id}">${h(section.title)}${section.paragraphs.map(text => p(text)).join('')}</section>`).join('')}</div>`;
  const truce = `<section class="lore-life" id="${hubTruce.id}">${h(hubTruce.title)}${hubTruce.paragraphs.map(text => p(text)).join('')}</section>`;
  return page('zone-hub-commun', `<a class="lore-back" href="#lore-zones">← Tous les lieux</a>${head(z.name, fName(z.faction))}${intro}${sections}${hubLife()}${truce}${hubCrews()}<div class="lore-location-play"><section>${h('Tension')}${p(z.tension)}</section><section>${h('Un contrat')}${p(z.hook)}</section></div>`, 'data-nav-root="lore-zones" data-place-faction="neutre"', 'lore-location-page', [...hubStops.flatMap(stop=>stop.links), ...hubTruce.links, ...crews.flatMap(crew=>crew.links)]);
}
function placeDetails(id) {
  const details = localDetails.filter(detail => detail.zone === id);
  return details.length ? `<section class="lore-life">${h(lifeCopy.detailTitle)}${details.map(detail => `<article id="repere-${detail.id}" data-lore-entry>${h(detail.title, 4)}${p(detail.text)}</article>`).join('')}</section>` : '';
}
function worldPage() {
  const sections = worldSections.map(s => `<section id="${s.id}">${h(s.title)}${s.paragraphs.map(richParagraph).join('')}${s.subsections.map(sub => `<section>${h(sub.title, 4)}${sub.paragraphs.map(richParagraph).join('')}</section>`).join('')}</section>`).join('');
  return page('lore-paradise', head(worldTitle, 'Lore') + p(worldLead, 'lore-lead') + `<div class="lore-tone">${worldIntro.map(richParagraph).join('')}</div>` + `<div class="lore-tone">${sections}</div>`, '', '', worldSections.flatMap(section=>section.links));
}
function personCard(person) {
  const infrastructure = person.portraitKind === 'infrastructure';
  return `<article class="lore-person lore-person--embedded" id="pnj-${person.id}" data-lore-person data-person-scope="${person.scope}" data-person-faction="${person.faction}">
    ${art(person.art, person.scene, infrastructure ? `${person.name} : infrastructure distribuée` : `Portrait de ${person.name}, ${person.role}`, infrastructure ? 3 : 4, `lore-portrait${infrastructure ? ' lore-portrait--infrastructure' : ''}`)}
    <div>${h(person.name,4)}${p(person.role,'lore-role')}${person.leverage ? `<dl class="lore-play lore-person-power">${pair('Pouvoir réel',person.leverage)}</dl>` : ''}${p(person.description)}${p(person.appearance,'lore-appearance')}<dl class="lore-play">${pair('Ce qu’il propose',person.offer)}${pair('L’aborder',person.approach)}</dl><details class="lore-secret"><summary>Secret · réservé au MJ</summary>${p(person.secret)}</details></div></article>`;
}
const figures = f => people.filter(p=>p.scope==='faction' && p.faction===f.id).sort((a,b)=>(a.id==='coeur-synapse'?-2:a.id===f.contact?-1:0)-(b.id==='coeur-synapse'?-2:b.id===f.contact?-1:0));
function factionPage(f,index) {
  const header = `<a class="lore-back" href="#lore-factions">← Toutes les factions</a><header class="lore-dossier-head">${p(`Dossier ${String(index+1).padStart(2,'0')} / ${f.kind}`,'lore-kicker')}${h(f.name,2)}${p(f.motto,'lore-motto')}<ul class="lore-domains" aria-label="Domaines d’influence">${f.domains.map(d=>`<li>${esc(d)}</li>`).join('')}</ul></header>`;
  const copy = `<div class="lore-dossier-copy">${f.blocks.map(([title,copy],i)=>`<article><span class="lore-index" aria-hidden="true">${String(i+1).padStart(2,'0')}</span><div>${h(title)}${p(copy)}</div></article>`).join('')}</div><dl class="lore-faction-facts">${f.facts.map(([label,value])=>pair(label,value)).join('')}</dl>${f.signature?p(f.signature,'lore-signature'):''}`;
  const members = `<section class="lore-major-people" aria-labelledby="figures-${f.id}"><h3 id="figures-${f.id}">Figures majeures</h3>${p('Les personnes qui engagent la faction, ses ressources et ses décisions.','lore-section-intro')}<div class="lore-embedded-people">${figures(f).map(personCard).join('')}</div></section>`;
  const relatedIds = [...orderedZones.filter(z=>z.faction===f.id).map(z=>`zone-${z.id}`), ...figures(f).map(person=>`zone-${person.zone}`), `tech-${f.tech}`, ...(f.id === 'synapse' ? ['zone-sphere'] : f.id === 'velvet' ? ['loisir-medias-sensoriels'] : [])];
  return page(`faction-${f.id}`,header+factionMosaic(f)+copy+members,`data-nav-root="lore-factions" style="--faction-accent:${f.accent}" data-lore-dossier="${f.id}"`,`lore-dossier lore-theme--${f.mood}`, relatedIds);
}
const directoryCard = z => `<article class="lore-place lore-place--preview" id="place-card-${z.id}" data-lore-card data-lore-target="zone-${z.id}" data-faction="${z.faction}" style="--faction-accent:${accent(z.faction)}"><a class="lore-place-link" href="#zone-${z.id}">${art(z.art,z.scene,z.name,z.panels || 3)}<div class="lore-place-body">${p(fName(z.faction),'lore-kicker')}${h(z.name)}${p(z.level,'lore-access')}${p(firstSentence(z.description))}<span class="lore-open">Explorer le lieu <span aria-hidden="true">↗</span></span></div></a></article>`;
function placePage(z) {
  if (z.id === 'hub-commun') return hubPage(z);
  const locals = people.filter(p=>p.scope==='place'&&p.zone===z.id);
  const leaders = people.filter(p=>p.scope==='faction'&&p.zone===z.id);
  const localCopy = locals.length ? `<section class="lore-local-people" aria-labelledby="contacts-${z.id}"><h3 id="contacts-${z.id}">Sur place</h3><div class="lore-embedded-people">${locals.map(personCard).join('')}</div></section>` : '';
  const intro = `<div class="lore-location-intro"><div>${p(z.level,'lore-location-level')}${p(z.access,'lore-access')}${p(z.description,'lore-location-description')}</div>${art(z.art,z.scene,z.name,z.panels || 3,'lore-location-hero')}</div>`;
  const overview = z.id === arche.zone ? `<div class="lore-life">${readingProfile(arche, 'sport')}</div>` : '';
  const sections = z.sections ? `<div class="lore-life">${z.sections.map(section => `<section id="${section.id}">${h(section.title)}${section.paragraphs.map(text => p(text)).join('')}</section>`).join('')}</div>` : '';
  const groups = streetActors.filter(a => a.zone === z.id);
  const neighborhood = groups.length ? `<section class="lore-life">${h(streetActorsTitle)}${groups.map(a => `<article id="groupe-${a.id}" data-lore-entry>${h(a.name, 4)}${p(a.text)}</article>`).join('')}</section>` : '';
  return page(`zone-${z.id}`,`<a class="lore-back" href="#lore-zones">← Tous les lieux</a>${head(z.name,fName(z.faction))}${intro}${overview}${sections}<div class="lore-location-play"><section>${h('Tension')}${p(z.tension)}</section><section>${h('Un contrat')}${p(z.hook)}</section></div>${localCopy}${placeDetails(z.id)}${neighborhood}`,`data-nav-root="lore-zones" data-place-faction="${z.faction}" style="--faction-accent:${accent(z.faction)}"`,'lore-location-page', [...(z.links || []), ...(z.id === arche.zone ? arche.links : []), ...leaders.map(person=>`pnj-${person.id}`), ...(z.faction !== 'neutre' ? [`faction-${z.faction}`, `zone-${principalPlaces[z.faction]}`] : [])]);
}
const techCard = t => `<article class="lore-technology" id="tech-${t.id}" data-lore-card data-faction="${t.faction}">${art(t.art,t.scene,t.name,4,'lore-tech-art')}<div>${p(fName(t.faction),'lore-kicker')}${h(t.name)}${p(t.lead,'lore-tech-lead')}<dl class="lore-play">${pair('Principe',t.principle)}${pair('Dans la vie courante',t.daily)}${pair('Limites',t.limits)}${pair('Une piste',t.hook)}</dl></div></article>`;
export function renderLore() {
  const cards = factions.map(f=>`<a class="faction-entry lore-theme--${f.mood}" href="#faction-${f.id}" style="--faction-accent:${f.accent}">${art(factionArt(f),0,f.name)}<div>${p(f.kind,'lore-kicker')}${h(f.name)}${p(f.blocks[0][1])}<span class="lore-open">Lire le dossier <span aria-hidden="true">↗</span></span></div></a>`).join('');
  const directory = page('lore-factions',head('Les puissances de Paradise','Lore / Factions')+p(lorePageCopy.factionsLead,'lore-lead')+p(lorePageCopy.factionsIntro)+`<div class="lore-directory">${cards}</div>`);
  const atlas = page('lore-zones',head('Lieux de Paradise','Lore / Atlas urbain')+p(lorePageCopy.placesLead,'lore-lead')+p(lorePageCopy.placesIntro)+filters('zones','Trouver un lieu')+empty('Aucun lieu ne correspond. Essayez un autre mot ou une autre influence.')+`<div class="lore-place-grid">${orderedZones.map(directoryCard).join('')}</div>`,'data-lore-collection');
  const tech = page('lore-technologie',head('Technologies du quotidien','Lore / Systèmes et dépendances')+p('Ce que la technologie permet. Ce qu’elle exige en retour. Qui paie quand elle cesse de fonctionner.','lore-lead')+p('Ces huit dossiers donnent des repères de fiction, des limites et des pistes de jeu. Ils n’ajoutent pas de bonus ou de capacités : les règles des classes, des implants et de Seconde Chance restent la référence mécanique.')+filters('tech','Trouver une technologie')+empty('Aucun dossier ne correspond. Essayez un autre mot ou une autre influence.')+`<div class="lore-tech-grid">${technologies.map(techCard).join('')}</div>`,'data-lore-collection', '', [...technologies.map(t=>`faction-${t.faction}`), 'regles-seconde-chance', 'implant-charge-rules', 'zone-sphere', 'loisir-medias-sensoriels']);
  const conflicts = `<section class="lore-tone">${h(situationsTitle)}${situations.map(s => `<article>${h(s.title, 4)}${p(s.text)}</article>`).join('')}</section>`;
  const tone = page('lore-ton',head('Jouer Paradise','Lore / Tonalité')+p(lorePageCopy.toneLead,'lore-lead')+`<div class="lore-tone">${toneSections.map(s => h(s.title) + p(s.text)).join('')}</div>` + conflicts, '', '', ['lore-zones', 'lore-factions', ...situations.flatMap(s=>s.links)]);
  return `<!-- LORE:START — generated by tools/build-lore.mjs -->\n${[worldPage(),leisureDirectory(),...leisureDossiers.map(leisurePage),directory,...factions.map(factionPage),atlas,...orderedZones.map(placePage),tech,tone].join('\n')}\n<!-- LORE:END -->`;
}
