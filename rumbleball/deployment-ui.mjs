import { defaultDeployment, moveDeployment } from './deployment.mjs';
import { KIT_COLORS } from './appearance.mjs';
import { playerPortrait } from './visuals.mjs';

const el = (tag, cls = '', text) => { const n = document.createElement(tag); n.className = cls; if (text !== undefined) n.textContent = text; return n; };
const cellName = ({ x, y }) => `${String.fromCharCode(65 + x)}${y + 1}`;
let instance = 0;

// Shared by career and exhibition. A native selector and buttons work by touch,
// click or keyboard; choosing an occupied cell swaps the two starting positions.
export function deploymentEditor({ players, positions = defaultDeployment(), color = KIT_COLORS[0], disabled = false, onChange = () => {} }) {
  let cells = positions.map((p) => ({ ...p })), selected = 0, focusIndex = 0;
  const root = el('section', 'rb-deployment'), title = el('h4', '', 'Déploiement dans votre moitié'), help = el('p', 'rb-muted', 'Choisissez un titulaire puis sa case. Une case occupée échange les deux positions. Flèches pour parcourir le terrain, Entrée pour placer.');
  help.id = `rb-deployment-help-${++instance}`;
  const layout = el('div', 'rb-deployment-layout'), controls = el('div', 'rb-deployment-controls'), field = el('label', 'rb-field', 'Joueur à placer'), select = el('select', 'rb-deployment-player');
  select.setAttribute('aria-label', 'Joueur à placer'); field.append(select);
  const info = el('p', 'rb-muted', 'Votre moitié : colonnes A à F. Le ballon apparaît à l’intersection de F4, F5, G4 et G5 ; vos deux cases d’engagement sont sur le bord droit.'), status = el('p', 'rb-deployment-status');
  status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite'); controls.append(field, info, status);
  const scroll = el('div', 'rb-deployment-scroll'), board = el('div', 'rb-deployment-board'), columns = el('div', 'rb-deployment-columns'), body = el('div', 'rb-deployment-body'), grid = el('div', 'rb-deployment-grid');
  grid.setAttribute('role', 'group'); grid.setAttribute('aria-label', 'Cases de votre moitié de terrain'); grid.setAttribute('aria-describedby', help.id);
  columns.append(el('span')); for (let x = 0; x < 6; x++) columns.append(el('span', '', String.fromCharCode(65 + x)));
  const buttons = [];
  for (let y = 0; y < 8; y++) {
    grid.append(el('span', 'rb-deployment-row-number', String(y + 1)));
    for (let x = 0; x < 6; x++) {
      const button = el('button', 'rb-deployment-cell'); button.type = 'button'; button.dataset.cell = `${x},${y}`;
      button.addEventListener('click', () => {
        if (disabled) return;
        const previous = cells[selected], other = cells.findIndex((p) => p.x === x && p.y === y);
        cells = moveDeployment(cells, selected, { x, y }); render();
        status.textContent = `${players[selected].name} en ${cellName(cells[selected])}.${other >= 0 && other !== selected ? ` ${players[other].name} en ${cellName(previous)}.` : ''}`;
        onChange(cells.map((p) => ({ ...p })));
      });
      button.addEventListener('keydown', (event) => {
        if (disabled || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
        event.preventDefault();
        const nx = Math.max(0, Math.min(5, x + (event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0)));
        const ny = Math.max(0, Math.min(7, y + (event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0)));
        focusIndex = ny * 6 + nx; buttons.forEach((b, i) => b.setAttribute('tabindex', i === focusIndex ? 0 : -1)); buttons[focusIndex].focus();
      });
      grid.append(button); buttons.push(button);
    }
  }
  const ball = el('span', 'rb-deployment-ball'); ball.setAttribute('aria-hidden', 'true'); body.append(grid, ball);
  board.append(columns, body); scroll.append(board); layout.append(scroll, controls); root.append(title, help, layout);
  function render() {
    select.disabled = disabled;
    select.replaceChildren(...players.map((p, i) => { const option = el('option', '', `${i + 1} · ${p.name} · ${cellName(cells[i])}`); option.value = String(i); option.selected = i === selected; return option; }));
    select.value = String(selected); focusIndex = cells[selected].y * 6 + cells[selected].x;
    for (const [i, button] of buttons.entries()) {
      const x = i % 6, y = Math.floor(i / 6), slot = cells.findIndex((p) => p.x === x && p.y === y);
      button.disabled = disabled; button.classList.toggle('is-selected', slot === selected); button.classList.toggle('is-center', x === 5 && [3, 4].includes(y));
      button.setAttribute('tabindex', i === focusIndex ? 0 : -1); button.setAttribute('aria-pressed', String(slot === selected));
      const label = `${cellName({ x, y })}${slot >= 0 ? ` · ${players[slot].name}` : ' · libre'}${disabled ? '' : ` · placer ${players[selected].name}`}`;
      button.setAttribute('aria-label', label); button.title = label;
      button.replaceChildren(...(slot >= 0 ? [playerPortrait({ ...players[slot], number: slot + 1 }, color)] : [el('span', 'rb-deployment-empty', '·')]));
    }
  }
  select.addEventListener('change', () => { selected = Number(select.value); render(); });
  render();
  return { root, get value() { return cells.map((p) => ({ ...p })); }, update(next) { players = next.players ?? players; color = next.color ?? color; disabled = next.disabled ?? disabled; render(); } };
}
