import { defaultDeployment, moveDeployment, validDeployment } from './deployment.mjs';
import { KIT_COLORS } from './appearance.mjs';
import { ballArtwork, playerPortrait, poseCharacter, svg } from './visuals.mjs';

const el = (tag, cls = '', text) => { const n = document.createElement(tag); n.className = cls; if (text !== undefined) n.textContent = text; return n; };
const cellName = ({ x, y }) => `${String.fromCharCode(65 + x)}${y + 1}`;
let instance = 0;

// Shared by career and exhibition. A native selector and buttons work by touch,
// click or keyboard; choosing an occupied cell swaps the two starting positions.
export function deploymentEditor({ players, positions = defaultDeployment(), color = KIT_COLORS[0], disabled = false, selectedPlayerId = null, onSelect = () => {}, onChange = () => {} }) {
  let cells = positions.map((p) => ({ ...p })), selected = Math.max(0, players.findIndex((p) => (p.playerId ?? p.id) === selectedPlayerId)), focusIndex = 0;
  const root = el('section', 'rb-deployment'), title = el('h4', '', 'Déploiement dans votre moitié'), help = el('p', 'rb-muted', 'Choisissez un titulaire puis sa case. Une case occupée échange les deux positions. Flèches pour parcourir le terrain, Entrée pour placer.');
  help.id = `rb-deployment-help-${++instance}`;
  const layout = el('div', 'rb-deployment-layout'), controls = el('div', 'rb-deployment-controls'), field = el('label', 'rb-field', 'Joueur à placer'), select = el('select', 'rb-deployment-player');
  select.setAttribute('aria-label', 'Joueur à placer'); field.append(select);
  const info = el('p', 'rb-muted', 'Placez vos joueurs dans les colonnes A à F. Les colonnes G à L montrent le camp adverse et restent inaccessibles. En F4 et F5, vos joueurs peuvent tenter l’interception à l’engagement.'), status = el('p', 'rb-deployment-status');
  status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite'); controls.append(field, info, status);
  const scroll = el('div', 'rb-deployment-scroll'), board = el('div', 'rb-deployment-board'), columns = el('div', 'rb-deployment-columns'), body = el('div', 'rb-deployment-body'), grid = el('div', 'rb-deployment-grid');
  grid.setAttribute('role', 'group'); grid.setAttribute('aria-label', 'Cases de votre moitié de terrain, A à F. Camp adverse à droite. Zone d’engagement : F4 et F5.'); grid.setAttribute('aria-describedby', help.id);
  columns.append(el('span')); for (let x = 0; x < 12; x++) columns.append(el('span', x >= 6 ? 'rb-deployment-opponent-label' : '', String.fromCharCode(65 + x)));
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
    for (let x = 6; x < 12; x++) {
      const opponent = el('span', `rb-deployment-opponent${x === 6 && [3, 4].includes(y) ? ' is-center' : ''}`);
      opponent.setAttribute('aria-hidden', 'true'); grid.append(opponent);
    }
  }
  const markings = svg('svg', { viewBox: '0 0 720 480', preserveAspectRatio: 'none', class: 'rb-deployment-markings', 'aria-hidden': 'true', focusable: 'false' });
  markings.append(svg('circle', { cx: 360, cy: 240, r: 58, fill: 'none', stroke: '#b0b8ad', 'stroke-width': 1.5, opacity: .5 }),
    svg('line', { x1: 360, y1: 0, x2: 360, y2: 480, stroke: '#dce6d4', 'stroke-width': 3, class: 'rb-deployment-midline' }),
    svg('rect', { x: 300, y: 180, width: 120, height: 120, fill: 'none', stroke: '#f2dc83', 'stroke-width': 2, 'stroke-dasharray': '6 4', class: 'rb-deployment-engagement' }));
  const ball = ballArtwork(); ball.setAttribute('transform', 'translate(360 240) scale(.48)'); ball.querySelector('.rb-ball-halo').setAttribute('visibility', 'hidden'); markings.append(ball);
  const direction = el('p', 'rb-deployment-direction'); direction.append(el('span', '', 'Votre camp'), el('span', '', 'Camp adverse →'));
  const legend = el('div', 'rb-deployment-legend'); legend.append(el('span', 'rb-deployment-key-line', 'Ligne médiane'), el('span', 'rb-deployment-key-zone', 'Zone d’engagement'));
  body.append(grid, markings); board.append(direction, columns, body, legend); scroll.append(board); layout.append(scroll, controls); root.append(title, help, layout);
  function render() {
    select.disabled = disabled;
    select.replaceChildren(...players.map((p, i) => { const option = el('option', '', `${i + 1} · ${p.name} · ${cellName(cells[i])}`); option.value = String(i); option.selected = i === selected; return option; }));
    select.value = String(selected); focusIndex = cells[selected].y * 6 + cells[selected].x;
    for (const [i, button] of buttons.entries()) {
      const x = i % 6, y = Math.floor(i / 6), slot = cells.findIndex((p) => p.x === x && p.y === y);
      button.disabled = disabled; button.classList.toggle('is-selected', slot === selected); button.classList.toggle('is-center', x === 5 && [3, 4].includes(y));
      button.setAttribute('tabindex', i === focusIndex ? 0 : -1); button.setAttribute('aria-pressed', String(slot === selected));
      const label = `${cellName({ x, y })}${slot >= 0 ? ` · ${players[slot].name}` : ' · libre'}${x === 5 && [3, 4].includes(y) ? ' · zone d’engagement' : ''}${disabled ? '' : ` · placer ${players[selected].name}`}`;
      button.setAttribute('aria-label', label); button.title = label;
      if (slot >= 0) {
        const portrait = playerPortrait({ ...players[slot], number: slot + 1 }, color);
        poseCharacter(portrait, { ...players[slot], facing: 90, prone: false, hp: players[slot].maxHp });
        button.replaceChildren(portrait);
      } else button.replaceChildren(el('span', 'rb-deployment-empty', '·'));
    }
  }
  select.addEventListener('change', () => { selected = Number(select.value); render(); onSelect(players[selected].playerId ?? players[selected].id); });
  render();
  return { root, get value() { return cells.map((p) => ({ ...p })); }, update(next) {
    if (next.positions !== undefined) { if (!validDeployment(next.positions)) throw new Error('Déploiement invalide.'); cells = next.positions.map((p) => ({ ...p })); }
    players = next.players ?? players; color = next.color ?? color; disabled = next.disabled ?? disabled;
    if (next.selectedPlayerId !== undefined) { const index = players.findIndex((p) => (p.playerId ?? p.id) === next.selectedPlayerId); if (index >= 0) selected = index; }
    render();
  } };
}
