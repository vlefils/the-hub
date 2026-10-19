import { el, btn } from './career-components.mjs';

export const WIDE_INSPECTOR = '(min-width: 1200px)';
export const wideInspector = () => Boolean(globalThis.window?.matchMedia?.(WIDE_INSPECTOR).matches);
let sequence = 0;

// CSS exposes the full existing document on small screens; desktop shows one panel.
export function inspectorPanels(host, { overview, equipment, progression, points = 0, selected = 'player', onSelect = () => {} }) {
  host.classList.add('rb-inspector-content');
  const entries = [['player', 'Joueur', overview], ['equipment', 'Équipement', equipment], ['progression', `Progression${points ? ` · ${points}` : ''}`, progression]];
  const id = `rb-inspector-${++sequence}`, tabs = el('div', 'rb-inspector-tabs'), panels = [];
  tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', 'Fiche du joueur');
  function activate(key, focus = false) {
    for (const [name, button, panel] of panels) {
      const active = name === key;
      button.setAttribute('aria-selected', String(active)); button.setAttribute('tabindex', active ? '0' : '-1');
      panel.dataset.active = String(active);
      if (active && focus) button.focus({ preventScroll: true });
    }
    onSelect(key);
  }
  for (const [key, label, nodes] of entries) {
    const panel = el('section', 'rb-inspector-panel'), button = btn(label, () => activate(key));
    button.id = `${id}-tab-${key}`; panel.id = `${id}-panel-${key}`; panel.dataset.panel = key;
    button.setAttribute('role', 'tab'); button.setAttribute('aria-controls', panel.id); button.setAttribute('data-readonly-control', 'true');
    button.dataset.focusKey = `inspector-tab-${key}`;
    panel.setAttribute('role', 'tabpanel'); panel.setAttribute('aria-labelledby', button.id);
    if (key === 'progression') panel.setAttribute('tabindex', '0');
    panel.append(...nodes); tabs.append(button); panels.push([key, button, panel]);
    button.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault(); const index = entries.findIndex(([name]) => name === key);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? entries.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + entries.length) % entries.length;
      activate(entries[next][0], true);
    });
  }
  host.append(tabs, ...panels.map(([, , panel]) => panel));
  activate(entries.some(([key]) => key === selected) ? selected : 'player');
}
