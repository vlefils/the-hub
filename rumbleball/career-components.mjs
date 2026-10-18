import { CATALOGUE, XP_THRESHOLDS, levelOf } from './progression.mjs';
import { athletePortrait } from './visuals.mjs';
import { gearImage } from './identity.mjs';

export const el = (tag, cls = '', text) => { const node = document.createElement(tag); node.className = cls; if (text !== undefined) node.textContent = text; return node; };
export const btn = (text, action, primary = false) => { const b = el('button', `rb-button${primary ? ' rb-button-primary' : ''}` , text); b.type = 'button'; b.addEventListener('click', action); return b; };
export const field = (label, control) => { const node = el('label', 'rb-field', label); node.append(control); return node; };
export const select = (values, value) => { const node = el('select'); for (const [key, text] of Object.entries(values)) { const option = el('option', '', text); option.value = key; option.selected = key === String(value); node.append(option); } node.value = String(value); return node; };
export const money = (n) => `${n.toLocaleString('fr-FR')} chromas`;
export const signed = (n) => `${n >= 0 ? '+' : '−'}${Math.abs(n).toLocaleString('fr-FR')}`;
export const keyed = (node, key) => { node.dataset.focusKey = key; return node; };

export function kitPicker(value, disabled = false) {
  const input = el('input', 'rb-kit-color'); input.type = 'color'; input.value = value; input.disabled = disabled; input.setAttribute('aria-label', 'Couleur des maillots'); return keyed(input, 'club-color');
}
export function portraitIdentity(p, color, ...copy) {
  const identity = el('div', 'rb-person-identity'), text = el('div'); text.append(...copy);
  const portrait = athletePortrait(p, color);
  if (text.textContent.includes(p.name)) portrait.setAttribute('aria-hidden', 'true');
  identity.append(portrait, text); return identity;
}
export function pageHeading(title, description = '') {
  const head = el('div', 'rb-section-heading'), h = el('h3', '', title); h.setAttribute('tabindex', '-1'); head.append(h);
  if (description) head.append(el('p', 'rb-muted', description)); return head;
}
export function metric(label, value, context = '') {
  const block = el('div', 'rb-metric'); block.append(el('span', 'rb-muted', label), el('strong', '', value));
  if (context) block.append(el('small', 'rb-muted', context)); return block;
}
export function table(headers, rows, { highlight = -1, caption = '' } = {}) {
  const wrap = el('div', 'rb-table-scroll'), t = el('table', 'rb-stats-table'), head = el('thead'), body = el('tbody'), hr = el('tr');
  if (caption) t.append(el('caption', 'rb-sr-only', caption));
  for (const text of headers) { const th = el('th', '', text); th.scope = 'col'; hr.append(th); } head.append(hr);
  for (const [index, values] of rows.entries()) {
    const row = el('tr', index === highlight ? 'rb-own-club' : '');
    for (const [i, value] of values.entries()) { const cell = el(i ? 'td' : 'th'); if (!i) cell.scope = 'row'; if (value instanceof Node) cell.append(value); else cell.textContent = String(value); row.append(cell); } body.append(row);
  }
  t.append(head, body); wrap.append(t); return wrap;
}
export function stats(p) { return `${p.maxHp} PV · CA ${p.armor} · ${p.speed.toLocaleString('fr-FR')} m · Lutte ${signed(p.skills.wrestling)} · Acrobaties ${signed(p.skills.acrobatics)}`; }
export function statList(p) {
  const list = el('dl', 'rb-player-stats');
  for (const [label, value] of [['PV max.', p.maxHp], ['Armure', p.armor], ['Vitesse', `${p.speed.toLocaleString('fr-FR')} m`], ['Lutte', signed(p.skills.wrestling)], ['Athlétisme', signed(p.skills.athletics)], ['Acrobaties', signed(p.skills.acrobatics)]]) {
    const group = el('div'); group.append(el('dt', 'rb-muted', label), el('dd', '', String(value))); list.append(group);
  } return list;
}
export function xpProgress(p) {
  const level = levelOf(p), start = XP_THRESHOLDS[level - 1], max = level === 5 ? 1 : XP_THRESHOLDS[level] - start;
  const root = el('div', 'rb-player-xp'), progress = el('progress'); progress.max = max; progress.value = level === 5 ? 1 : p.xp - start;
  progress.setAttribute('aria-label', `XP de ${p.name} : ${level === 5 ? 'niveau maximum' : `${p.xp - start} sur ${max} vers le niveau ${level + 1}`}`);
  root.append(el('span', '', `Niv. ${level}`), progress, el('small', 'rb-muted', level === 5 ? 'Maximum' : `${p.xp - start}/${max} XP`)); return root;
}
export function fatigue(p) {
  const root = el('div', `rb-fatigue${p.fatigue >= 5 ? ' is-exhausted' : p.fatigue >= 3 ? ' is-tired' : ''}`), meter = el('span', 'rb-fatigue-meter'); meter.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 6; i++) meter.append(el('i', i < p.fatigue ? 'is-filled' : ''));
  const effect = p.fatigue >= 5 ? '−1,5 m · −1 aux compétences physiques' : p.fatigue >= 3 ? 'Vitesse −1,5 m' : 'Aucun malus';
  root.append(el('span', '', `${p.fatigue}/6`), meter, el('small', 'rb-muted', effect)); return root;
}
export function comparison(before, after, beforeImplant = null, afterImplant = null) {
  const root = el('dl', 'rb-stat-comparison');
  const entries = [['PV max.', before.maxHp, after.maxHp], ['Armure', before.armor, after.armor], ['Vitesse', before.speed, after.speed], ['Lutte', before.skills.wrestling, after.skills.wrestling], ['Athlétisme', before.skills.athletics, after.skills.athletics], ['Acrobaties', before.skills.acrobatics, after.skills.acrobatics]];
  for (const [label, a, b] of entries) if (a !== b) {
    const row = el('div'); row.append(el('dt', '', label), el('dd', b > a ? 'rb-gain' : 'rb-loss', `${a.toLocaleString('fr-FR')} → ${b.toLocaleString('fr-FR')}${label === 'Vitesse' ? ' m' : ''}`)); root.append(row);
  }
  if (beforeImplant !== afterImplant && [beforeImplant, afterImplant].includes('regulator')) {
    const row = el('div'); row.append(el('dt', '', 'Fatigue de participation'), el('dd', afterImplant === 'regulator' ? 'rb-gain' : 'rb-loss', `+${beforeImplant === 'regulator' ? 1 : 2} → +${afterImplant === 'regulator' ? 1 : 2}`)); root.append(row);
  }
  if (!root.children.length) root.append(el('p', 'rb-muted', 'Aucune variation des caractéristiques.'));
  return root;
}
export function equipmentSlots(p, inventory) {
  const slots = el('dl', 'rb-equipment-slots'), protection = inventory.find((i) => i.playerId === p.id);
  for (const [label, id] of [['Protection', protection?.itemId], ['Implant', p.implant]]) {
    const row = el('div'), value = el('dd'), item = CATALOGUE[id];
    row.dataset.slot = label === 'Protection' ? 'protection' : 'implant';
    if (item) { const art = equipmentArtwork(id, ''); value.append(art, el('span', '', item.name)); }
    else { row.classList.add('is-empty'); value.append(el('span', 'rb-muted', 'Emplacement libre')); }
    row.append(el('dt', 'rb-muted', label), value); slots.append(row);
  } return slots;
}
export function equipmentArtwork(id, name) {
  const image = el('img', 'rb-equipment-art'); image.src = gearImage(id); image.alt = name; image.width = image.height = 128; image.loading = 'lazy'; image.decoding = 'async';
  image.addEventListener('error', () => { image.hidden = true; }); return image;
}
export function disclosure(label, key, ...children) {
  const details = el('details', 'rb-career-disclosure'); details.dataset.sectionKey = key; details.append(el('summary', '', label), ...children); return details;
}
