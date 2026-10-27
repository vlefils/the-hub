import { el, btn, field, select, table } from './career-components.mjs';
import { CRESTS, crestById } from './identity.mjs';
import { teamCrest } from './visuals.mjs';
export { archetypeIcon } from './visuals.mjs';
export { equipmentArtwork } from './career-components.mjs';

export function crestPicker(value, color, disabled = false) {
  const root = el('div', 'rb-crest-picker'), choice = select(Object.fromEntries(CRESTS.map(c => [c.id, c.name])), crestById(value).id), preview = el('span', 'rb-crest-preview');
  choice.disabled = disabled; choice.setAttribute('aria-label', 'Blason du club');
  let currentColor = color;
  const draw = () => preview.replaceChildren(teamCrest({ id: 'club', crestId: choice.value, kitColor: currentColor }));
  choice.addEventListener('change', draw); draw(); root.append(preview, field('Blason du club', choice));
  return { root, choice, get value() { return choice.value; }, updateColor(next) { currentColor = next; draw(); } };
}
export function clubIdentity(club, { compact = false, onClick } = {}) {
  const node = onClick ? btn('', () => onClick(club, node)) : el('span');
  node.className = `rb-club-identity${compact ? ' is-compact' : ''}${onClick ? ' rb-club-link' : ''}`;
  if (onClick) { node.dataset.focusKey = `club-${club.id}`; node.setAttribute('aria-label', `Voir le club ${club.name}`); node.setAttribute('aria-haspopup', 'dialog'); node.setAttribute('data-readonly-control', 'true'); }
  node.title = club.name;
  node.append(teamCrest(club), el('strong', '', club.name)); return node;
}
export function matchBanner(home, away, title, status = '') {
  const banner = el('section', 'rb-broadcast-banner'); banner.setAttribute('aria-label', 'Prochaine rencontre');
  const center = el('div', 'rb-broadcast-versus'), evening = title === '20 h · Paris', day = /^Journée (\d+)$/u.exec(title);
  center.append(el('span', 'rb-eyebrow', evening ? 'Ce soir' : day ? 'Journée' : 'Prochaine rencontre'), el('strong', '', evening ? '20 H' : day ? day[1] : title));
  if (evening) center.append(el('span', 'rb-broadcast-city', 'Paris'));
  banner.append(clubIdentity(home), center, clubIdentity(away));
  if (status) { const note = el('p', 'rb-broadcast-deadline', status); banner.append(note); }
  return banner;
}
export function compositionTabs(root, onChange = () => {}, initial = 'Composition') {
  const nav = el('nav', 'rb-composition-tabs'); nav.setAttribute('aria-label', 'Vues de la préparation');
  const buttons = [];
  function show(value) { root.dataset.teamView = value; for (const b of buttons) b.setAttribute('aria-pressed', String(b.dataset.teamView === value)); onChange(value); }
  for (const label of ['Composition', 'Tactique']) { const b = el('button', 'rb-button', label); b.type = 'button'; b.dataset.teamView = label; b.setAttribute('data-readonly-control', 'true'); b.addEventListener('click', () => show(label)); buttons.push(b); nav.append(b); }
  show(initial); return nav;
}
export function careerContext(career) {
  const root = el('aside', 'rb-broadcast-context'), schedule = el('section'), ranking = el('section');
  schedule.append(el('h4', '', `Journée ${Math.min(10, career.day + 1)}`));
  for (const f of career.schedule[Math.min(9, career.day)] ?? []) {
    const row = el('div', `rb-broadcast-fixture${[f.homeId, f.awayId].includes('club') ? ' is-own' : ''}`);
    row.append(el('small', 'rb-muted', f.result ? f.result.winnerId ? 'Rencontre terminée' : 'Match nul' : 'À jouer'), clubIdentity(career.clubs.find(c => c.id === f.homeId), { compact: true }), clubIdentity(career.clubs.find(c => c.id === f.awayId), { compact: true })); schedule.append(row);
  }
  ranking.append(el('h4', '', 'Classement'), table(['Club', 'Joués', 'Points'], career.table.map((r, i) => {
    const label = el('span'); label.append(el('span', 'rb-muted', `${i + 1}. `), clubIdentity(career.clubs.find(c => c.id === r.clubId), { compact: true })); return [label, r.played, r.points];
  }), { highlight: career.table.findIndex(r => r.clubId === 'club'), caption: 'Classement de la saison' })); root.append(schedule, ranking); return root;
}
