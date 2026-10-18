import { DEFAULT_OPENING, OPENINGS, validOpening } from './openings.mjs';

let instance = 0;
export function openingPicker({ value = DEFAULT_OPENING, disabled = false, label: labelText = 'Ouverture · placement et premier tour', onChange = () => {} } = {}) {
  const root = document.createElement('div'); root.className = 'rb-opening-picker';
  const label = document.createElement('label'); label.className = 'rb-field'; label.textContent = labelText;
  const select = document.createElement('select'); select.className = 'rb-opening-select'; select.name = 'rb-opening'; select.disabled = disabled;
  for (const [id, spec] of Object.entries(OPENINGS)) { const option = document.createElement('option'); option.value = id; option.textContent = spec.name; select.append(option); }
  select.value = validOpening(value) ? value : DEFAULT_OPENING;
  const description = document.createElement('p'); description.className = 'rb-muted'; description.id = `rb-opening-help-${++instance}`;
  const note = document.createElement('p'); note.className = 'rb-muted'; note.textContent = 'Changer l’ouverture applique son placement. Vous pouvez ensuite ajuster les cases. Les numéros correspondent aux cinq titulaires.';
  select.setAttribute('aria-describedby', description.id); label.append(select); root.append(label, description, note);
  const render = () => { description.textContent = OPENINGS[select.value].description; };
  select.addEventListener('change', () => { if (!select.disabled) { render(); onChange(select.value); } }); render();
  return { root, get value() { return select.value; }, update(value) { if (validOpening(value)) { select.value = value; render(); } } };
}
