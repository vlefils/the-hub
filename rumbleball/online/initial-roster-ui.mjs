import { el, btn, money, portraitIdentity } from '../career-components.mjs';
import { compilePlayer, recruitmentPrice, salary, MAX_SQUAD_SIZE } from '../progression.mjs';
import { abilitySummary } from '../player-development-ui.mjs';
import { archetypeLabel } from '../classes.mjs';

export function initialRoster(club, selected, { onSelect, onConfirm }) {
  const root = el('section', 'rb-initial-roster'), list = el('div', 'rb-initial-candidates'), footer = el('div', 'rb-initial-total');
  root.append(el('p', 'rb-eyebrow', 'Journée 1 · Recrutement'), el('h2', '', 'Choisissez vos premières recrues'),
    el('p', 'rb-muted', 'Comparez leurs caractéristiques. Les cinq premières recrues sélectionnées seront titulaires, les suivantes rejoindront le banc. Les contrats sont payés ensemble à la validation.'), list, footer);
  const checks = [];
  for (const p of club.market) {
    const row = el('label', 'rb-initial-candidate'), choice = el('input'), compiled = compilePlayer(p);
    choice.type = 'checkbox'; choice.checked = selected.has(p.id); choice.setAttribute('aria-label', `Recruter ${p.name}`);
    row.classList.toggle('is-selected', choice.checked);
    row.append(choice, portraitIdentity(compiled, club.kitColor, el('h3', '', p.name), el('span', 'rb-muted', archetypeLabel(compiled))), abilitySummary(compiled), el('p', '', `${money(recruitmentPrice(p))} · ${money(salary(p))} de salaire / journée`));
    choice.addEventListener('change', () => { choice.checked ? selected.add(p.id) : selected.delete(p.id); row.classList.toggle('is-selected', choice.checked); onSelect(); refresh(); });
    checks.push([p, choice]); list.append(row);
  }
  const summary = el('p'), confirm = btn('Valider mon effectif', async () => { confirm.disabled = true; try { await onConfirm([...selected]); } finally { refresh(); } }, true); footer.append(summary, confirm);
  function refresh() {
    const cost = club.market.filter(p => selected.has(p.id)).reduce((sum, p) => sum + recruitmentPrice(p), 0);
    summary.textContent = `${selected.size}/${MAX_SQUAD_SIZE} joueurs · Contrats : ${money(cost)} · Reste : ${money(club.balance - cost)} · 5 joueurs minimum`;
    confirm.disabled = selected.size < 5 || selected.size > MAX_SQUAD_SIZE || cost > club.balance;
    for (const [p, checkbox] of checks) checkbox.disabled = !selected.has(p.id) && (selected.size >= MAX_SQUAD_SIZE || cost + recruitmentPrice(p) > club.balance);
  }
  refresh(); return root;
}
