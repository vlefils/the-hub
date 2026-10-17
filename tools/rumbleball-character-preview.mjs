// Standalone SVG asset sheet; does not launch, inspect or capture a browser.
import fs from 'node:fs';
import { installTestDOM, serializeSVG } from '../rumbleball/test-support/dom.mjs';
import { pawnArtwork, poseCharacter, svg } from '../rumbleball/visuals.mjs';
import { KIT_COLORS } from '../rumbleball/appearance.mjs';
import { createCareer } from '../rumbleball/career.mjs';
import { CATALOGUE, compilePlayer } from '../rumbleball/progression.mjs';

installTestDOM();
const source = createCareer('Aperçu', 'characters').market;
const sheet = svg('svg', { xmlns: 'http://www.w3.org/2000/svg', width: 960, height: 690, viewBox: '0 0 960 690' });
sheet.append(svg('rect', { width: 960, height: 690, fill: '#182425' }));
const label = (x, y, text, size = 14, color = '#b8c8c5') => sheet.append(svg('text', { x, y, fill: color, 'font-family': 'Arial,sans-serif', 'font-size': size }, text));
label(30, 36, 'RUMBLEBALL / JOUEURS VUS DU DESSUS', 22, '#e9efe2');
label(30, 62, 'Identités stables · maillots du club · armes de contact · équipement visible');
function person(p, x, y, scale, color, frame = {}) {
  const node = svg('g', { transform: `translate(${x} ${y}) scale(${scale})` });
  node.dataset.broad = String(p.archetype === 'belier'); node.append(pawnArtwork(p, color, { portrait: true }));
  poseCharacter(node, { ...p, hp: p.maxHp, facing: 0, ...frame }); sheet.append(node);
}
for (let i = 0; i < 6; i++) {
  const p = { ...compilePlayer(source[i]), number: i + 1, teamId: i < 3 ? 'home' : 'away' };
  person(p, 80 + i * 160, 139, 1.8, KIT_COLORS[i]); label(35 + i * 160, 211, source[i].name, 15, '#e9efe2');
}
label(30, 259, 'PROTECTIONS ET IMPLANTS', 17, '#e9efe2');
for (const [i, [id, item]] of Object.entries(CATALOGUE).entries()) {
  const p = { ...compilePlayer(source[0]), visualGear: { protection: item.slot === 'protection' ? id : null, implant: item.slot === 'implant' ? id : null } };
  person(p, 65 + i * 118, 313, 1.5, KIT_COLORS[0]);
  label(15 + i * 118, 368, ['Plastron', 'Armure', 'Gants', 'Semelles', 'Jambes', 'Fibres', 'Viseur', 'Régulateur'][i], 13);
}
label(30, 416, 'GESTES DE JEU', 17, '#e9efe2');
for (const [i, kind] of ['walk', 'strike', 'throw', 'grapple', 'signal', 'down'].entries()) {
  const p = { ...compilePlayer(source[i % 5]), number: i + 1, teamId: 'home' };
  person(p, 80 + i * 160, 466, 1.5, KIT_COLORS[0], { walking: kind === 'walk', walkPhase: Math.PI / 2, prone: kind === 'down', gesture: { kind, progress: .5 } });
  label(35 + i * 160, 525, ['Course', 'Frappe', 'Passe', 'Prise', 'Appel', 'Au sol'][i], 14);
}
label(30, 577, 'TAILLES DE LECTURE', 17, '#e9efe2');
for (let i = 0; i < 5; i++) person({ ...compilePlayer(source[i]), number: i + 1, teamId: 'home' }, 60 + i * 70, 628, 1, KIT_COLORS[0], { facing: 90 });
for (let i = 0; i < 5; i++) person({ ...compilePlayer(source[i]), number: i + 1, teamId: 'away' }, 530 + i * 45, 628, .55, KIT_COLORS[1], { facing: 270 });
label(35, 675, 'Terrain · case de 60 px', 12); label(500, 675, 'Vue réduite · case de 33 px', 12);
fs.writeFileSync('mockups/rumbleball-characters.svg', serializeSVG(sheet));
