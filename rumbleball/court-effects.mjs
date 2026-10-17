import { courtPoint } from './playback.mjs';
import { svg } from './visuals.mjs';

export function drawCourtLinks(layer, players) {
  layer.replaceChildren();
  for (const p of players) {
    const held = players.find((q) => q.id === p.grappling && q.hp > 0);
    if (!held || p.hp <= 0) continue;
    const from = courtPoint(p.position), to = courtPoint(held.position);
    const x = (from.x + to.x) / 2, y = (from.y + to.y) / 2 - 16;
    layer.append(svg('path', { d: `M${from.x},${from.y} Q${x},${y} ${to.x},${to.y}`, class: 'rb-grapple-link' }),
      svg('circle', { cx: x - 3, cy: y + 8, r: 5, class: 'rb-chain-link' }),
      svg('circle', { cx: x + 3, cy: y + 8, r: 5, class: 'rb-chain-link' }));
  }
}

export function drawCourtEffects(layer, effects) {
  layer.replaceChildren();
  // Keep the newest feedback of each kind on a pawn; repeated hits do not pile up.
  const latest = new Map(effects.map((e) => [`${e.playerId}:${e.kind}`, e]));
  const slots = new Map();
  for (const e of latest.values()) {
    const point = courtPoint(e.position), progress = e.progress;
    const group = svg('g', { class: `rb-map-effect rb-effect-${e.kind}`, opacity: Math.min(1, (1 - progress) * 2.2) });
    if (e.source) {
      const source = courtPoint(e.source);
      const dx = point.x - source.x, dy = point.y - source.y, distance = Math.hypot(dx, dy);
      const trim = Math.min(27, distance * .4), inset = distance ? trim / distance : 0;
      group.append(svg('line', { x1: source.x + dx * inset, y1: source.y + dy * inset,
        x2: point.x - dx * inset, y2: point.y - dy * inset, class: 'rb-impact-line' }));
      if (e.kind === 'opportunity') group.append(svg('text', { x: source.x, y: Math.max(5, source.y - 32), 'text-anchor': 'middle', class: 'rb-effect-label' }, '!'));
    }
    group.append(svg('circle', { cx: point.x, cy: point.y, r: 23 + progress * 17, class: 'rb-effect-ring' }));
    if (e.kind === 'attack') group.append(svg('path', { d: `M${point.x + 29},${point.y - 12}l7,-5M${point.x + 32},${point.y}h10M${point.x + 29},${point.y + 12}l7,5`, class: 'rb-impact-slash' }));
    if (e.label) {
      const slot = slots.get(e.playerId) ?? 0; slots.set(e.playerId, slot + 1);
      const y = point.y < 85 ? point.y + 43 + slot * 24 : point.y - 33 - slot * 24;
      const nearLeft = point.x < 100, nearRight = point.x > 620;
      group.append(svg('text', { x: nearLeft ? Math.max(5, point.x - 25) : nearRight ? Math.min(715, point.x + 25) : point.x,
        y: Math.max(-14, Math.min(487, y - progress * 10)), 'text-anchor': nearLeft ? 'start' : nearRight ? 'end' : 'middle', class: 'rb-effect-label' }, e.label));
    }
    layer.append(group);
  }
}
