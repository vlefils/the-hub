import { defaultDeployment, moveDeployment, validDeployment } from './deployment.mjs';
import { KIT_COLORS } from './appearance.mjs';
import { ballArtwork, svg } from './visuals.mjs';
import { portraitById } from './identity.mjs';

const el = (tag, cls = '', text) => { const n = document.createElement(tag); n.className = cls; if (text !== undefined) n.textContent = text; return n; };
const cellName = ({ x, y }) => `${String.fromCharCode(65 + x)}${y + 1}`;
function portraitBubble(player, number, color) {
  const bubble = el('span', 'rb-deployment-portrait'); bubble.setAttribute('aria-hidden', 'true'); bubble.style.setProperty('--rb-portrait-kit', color);
  const initials = player.name.trim().split(/\s+/u).slice(0, 2).map(part => Array.from(part)[0]).join('').toLocaleUpperCase('fr-FR');
  bubble.append(el('span', 'rb-deployment-initials', initials || '?'));
  const portrait = portraitById(player.portraitId);
  if (portrait) {
    const image = el('img'); image.src = portrait.thumb; image.alt = ''; image.width = image.height = 128; image.decoding = 'async'; image.setAttribute('draggable', 'false');
    image.addEventListener('error', () => { image.hidden = true; }); bubble.append(image);
  }
  bubble.append(el('span', 'rb-deployment-number', String(number))); return bubble;
}
let instance = 0;
export const PLAYER_DRAG_TYPE = 'application/x-rumbleball-player';
export function draggablePlayer(node, id, disabled = false) {
  node.setAttribute('draggable', String(!disabled));
  node.addEventListener('dragstart', event => {
    if (disabled) { event.preventDefault(); return; }
    event.dataTransfer.setData(PLAYER_DRAG_TYPE, id); event.dataTransfer.effectAllowed = 'move'; node.classList.add('is-dragging');
  });
  node.addEventListener('dragend', () => node.classList.toggle('is-dragging', false));
}

// Shared by career and exhibition. A native selector and buttons work by touch,
// click or keyboard; choosing an occupied cell swaps the two starting positions.
export function deploymentEditor({ players, positions = defaultDeployment(), color = KIT_COLORS[0], disabled = false, selectedPlayerId = null, onSelect = () => {}, onChange = () => {}, interactivePlayers = false, onDropPlayer = () => {} }) {
  let cells = positions.map((p) => ({ ...p })), selected = Math.max(0, players.findIndex((p) => (p.playerId ?? p.id) === selectedPlayerId)), focusIndex = 0;
  const root = el('section', 'rb-deployment'), title = el('h4', '', 'Déploiement dans votre moitié'), help = el('p', 'rb-muted', 'Choisissez un titulaire puis sa case. Une case occupée échange les deux positions. Flèches pour parcourir le terrain, Entrée pour placer.');
  if (interactivePlayers) { title.textContent = 'Terrain · 12 × 8'; help.textContent = 'Glissez un joueur, ou sélectionnez-le puis sa case. Flèches et Entrée au clavier.'; }
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
        const occupant = cells.findIndex(p => p.x === x && p.y === y);
        if (interactivePlayers && occupant >= 0) { selected = occupant; render(); onSelect(players[selected].playerId ?? players[selected].id); return; }
        const previous = cells[selected], other = cells.findIndex((p) => p.x === x && p.y === y);
        cells = moveDeployment(cells, selected, { x, y }); render();
        status.textContent = `${players[selected].name} en ${cellName(cells[selected])}.${other >= 0 && other !== selected ? ` ${players[other].name} en ${cellName(previous)}.` : ''}`;
        onChange(cells.map((p) => ({ ...p })));
      });
      button.addEventListener('dragstart', event => {
        const slot = cells.findIndex(p => p.x === x && p.y === y);
        if (disabled || !interactivePlayers || slot < 0) { event.preventDefault(); return; }
        event.dataTransfer.setData(PLAYER_DRAG_TYPE, players[slot].playerId ?? players[slot].id); event.dataTransfer.effectAllowed = 'move';
      });
      button.addEventListener('dragover', event => { if (!disabled && interactivePlayers && [...event.dataTransfer.types].includes(PLAYER_DRAG_TYPE)) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; } });
      button.addEventListener('drop', event => {
        if (disabled || !interactivePlayers) return;
        const id = event.dataTransfer.getData(PLAYER_DRAG_TYPE); if (!id) return; event.preventDefault();
        const slot = players.findIndex(p => (p.playerId ?? p.id) === id);
        if (slot < 0) { onDropPlayer(id, { x, y }); return; }
        selected = slot; cells = moveDeployment(cells, slot, { x, y }); render(); onChange(cells.map(p => ({ ...p }))); onSelect(id);
        status.textContent = `${players[slot].name} en ${cellName(cells[slot])}.`;
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
  body.append(grid, markings); board.append(direction, columns, body, legend); scroll.append(board); layout.append(scroll, controls);
  if (interactivePlayers) {
    const heading = el('div', 'rb-deployment-titlebar'); heading.append(title, field);
    info.textContent = 'Votre camp : colonnes A à F. En F4 et F5, vos joueurs peuvent intercepter l’engagement.';
    root.append(heading, help, layout);
  } else root.append(title, help, layout);
  function render() {
    select.disabled = disabled;
    select.replaceChildren(...players.map((p, i) => { const option = el('option', '', `${i + 1} · ${p.name} · ${cellName(cells[i])}`); option.value = String(i); option.selected = i === selected; return option; }));
    select.value = String(selected); focusIndex = cells[selected].y * 6 + cells[selected].x;
    for (const [i, button] of buttons.entries()) {
      const x = i % 6, y = Math.floor(i / 6), slot = cells.findIndex((p) => p.x === x && p.y === y);
      button.disabled = disabled; button.classList.toggle('is-selected', slot === selected); button.classList.toggle('is-center', x === 5 && [3, 4].includes(y));
      button.setAttribute('draggable', String(interactivePlayers && !disabled && slot >= 0));
      button.setAttribute('tabindex', i === focusIndex ? 0 : -1); button.setAttribute('aria-pressed', String(slot === selected));
      const label = `${cellName({ x, y })}${slot >= 0 ? ` · ${players[slot].name}` : ' · libre'}${x === 5 && [3, 4].includes(y) ? ' · zone d’engagement' : ''}${disabled ? '' : ` · placer ${players[selected].name}`}`;
      button.setAttribute('aria-label', label); button.title = label;
      if (slot >= 0) {
        button.replaceChildren(portraitBubble(players[slot], slot + 1, color));
      } else button.replaceChildren(el('span', 'rb-deployment-empty', '·'));
    }
  }
  select.addEventListener('change', () => { selected = Number(select.value); render(); onSelect(players[selected].playerId ?? players[selected].id); });
  render();
  return { root, get value() { return cells.map((p) => ({ ...p })); }, get selectedPlayerId() { return players[selected].playerId ?? players[selected].id; }, update(next) {
    if (next.positions !== undefined) { if (!validDeployment(next.positions)) throw new Error('Déploiement invalide.'); cells = next.positions.map((p) => ({ ...p })); }
    players = next.players ?? players; color = next.color ?? color; disabled = next.disabled ?? disabled;
    if (next.selectedPlayerId !== undefined) { const index = players.findIndex((p) => (p.playerId ?? p.id) === next.selectedPlayerId); if (index >= 0) selected = index; }
    render();
  } };
}
