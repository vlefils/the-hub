// Presentation only. Match rules and player positions stay in the simulation modules.
export function svg(tag, attributes = {}, text) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attributes)) el.setAttribute(key, value);
  if (text !== undefined) el.textContent = text;
  return el;
}

export function teamCrest(teamId) {
  const crest = svg('svg', { viewBox: '0 0 64 72', class: `rb-crest rb-${teamId}`, 'aria-hidden': 'true', focusable: 'false' });
  crest.append(svg('path', { d: 'M6 5H58V43L32 65 6 43Z', class: 'rb-crest-shield' }));
  if (teamId === 'home') {
    crest.append(svg('path', { d: 'M36 14 18 36H29L25 52 46 28H34Z', fill: 'currentColor' }));
    crest.append(svg('path', { d: 'M14 14V25M50 38V48', class: 'rb-crest-detail' }));
  } else {
    crest.append(svg('path', { d: 'M17 20 32 14 47 20V36L39 42V49H25V42L17 36Z', fill: 'currentColor' }));
    crest.append(svg('path', { d: 'M22 26 29 29 23 33ZM42 26 35 29 41 33ZM32 33 29 39H35Z', fill: '#151b1b' }));
    crest.append(svg('path', { d: 'M29 43V48M35 43V48', stroke: '#151b1b', 'stroke-width': 2 }));
  }
  return crest;
}

export function arenaBackdrop(wetCells) {
  const background = svg('g', { 'aria-hidden': 'true' });
  const definitions = svg('defs');
  const floor = svg('pattern', { id: 'rb-floor', width: 60, height: 60, patternUnits: 'userSpaceOnUse' });
  floor.append(svg('rect', { width: 60, height: 60, fill: '#202a2b' }),
    svg('path', { d: 'M3 3H57V57H3ZM6 53 25 34M37 21 53 5', stroke: '#bac2b1', 'stroke-width': 1, fill: 'none', opacity: .045 }));
  const stripes = svg('pattern', { id: 'rb-hazard', width: 14, height: 14, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' });
  stripes.append(svg('rect', { width: 7, height: 14, fill: '#c8cc78' }));
  const wet = svg('pattern', { id: 'rb-wet-floor', width: 12, height: 12, patternUnits: 'userSpaceOnUse' });
  wet.append(svg('rect', { width: 12, height: 12, fill: '#3e5c66' }), svg('path', { d: 'M0 10 10 0M8 14 14 8', stroke: '#a1c2c5', 'stroke-width': 1, opacity: .18 }));
  const metal = svg('linearGradient', { id: 'rb-pawn-metal', x1: 0, y1: 0, x2: 0, y2: 1 });
  metal.append(svg('stop', { offset: '0%', 'stop-color': '#fff', 'stop-opacity': .2 }), svg('stop', { offset: '100%', 'stop-color': '#000', 'stop-opacity': .18 }));
  definitions.append(floor, stripes, wet, metal); background.append(definitions);
  background.append(svg('rect', { x: -28, y: -36, width: 776, height: 540, fill: '#131a1b', stroke: '#46514e', 'stroke-width': 1 }));
  for (const x of [60, 560]) background.append(svg('rect', { x, y: -33, width: 100, height: 6, fill: 'url(#rb-hazard)', opacity: .6 }));
  for (const [x, y] of [[-21, -29], [741, -29], [-21, 497], [741, 497]]) background.append(svg('circle', { cx: x, cy: y, r: 2, fill: '#68716a' }));
  background.append(svg('rect', { width: 720, height: 480, fill: 'url(#rb-floor)' }));
  background.append(svg('rect', { width: 7, height: 480, class: 'rb-pitch-home' }), svg('rect', { x: 713, width: 7, height: 480, class: 'rb-pitch-away' }));
  for (const [x, y] of wetCells) background.append(svg('rect', { x: x * 60, y: y * 60, width: 60, height: 60, class: 'rb-wet' }));
  for (let x = 0; x <= 12; x++) background.append(svg('line', { x1: x * 60, y1: 0, x2: x * 60, y2: 480, class: 'rb-grid' }));
  for (let y = 0; y <= 8; y++) background.append(svg('line', { x1: 0, y1: y * 60, x2: 720, y2: y * 60, class: 'rb-grid' }));
  background.append(svg('path', { d: 'M24 96V24H120M600 24H696V96M696 384V456H600M120 456H24V384', class: 'rb-pitch-marking' }));
  background.append(svg('line', { x1: 360, y1: 0, x2: 360, y2: 480, class: 'rb-center-line' }), svg('circle', { cx: 360, cy: 240, r: 58, class: 'rb-center-circle' }));
  background.append(svg('text', { x: 360, y: 243, 'text-anchor': 'middle', 'dominant-baseline': 'central', class: 'rb-pitch-stamp' }, 'RB'));
  for (let x = 0; x < 12; x++) background.append(svg('text', { x: x * 60 + 30, y: -14, 'text-anchor': 'middle', 'dominant-baseline': 'central', class: 'rb-axis' }, String.fromCharCode(65 + x)));
  for (let y = 0; y < 8; y++) background.append(svg('text', { x: -14, y: y * 60 + 30, 'text-anchor': 'middle', 'dominant-baseline': 'central', class: 'rb-axis' }, String(y + 1)));
  return background;
}

export function pawnArtwork(player) {
  const group = svg('g', { 'aria-hidden': 'true' });
  group.append(svg('circle', { r: 27, class: 'rb-pawn-ring' }),
    svg('path', { d: 'M-15-24H15L26-12V12L15 24H-15L-26 12V-12Z', class: 'rb-pawn-shell' }));
  const shape = player.teamId === 'home' ? ['circle', { r: 19 }] : ['path', { d: 'M0-22 22 0 0 22-22 0Z' }];
  group.append(svg(shape[0], { ...shape[1], class: 'rb-pawn-disc' }), svg(shape[0], { ...shape[1], fill: 'url(#rb-pawn-metal)' }));
  group.append(svg('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central', class: 'rb-pawn-number' }, String(player.number)),
    svg('rect', { x: -16, y: 26, width: 32, height: 3, class: 'rb-pawn-health-track' }),
    svg('rect', { x: -16, y: 26, width: 32, height: 3, class: 'rb-pawn-health' }));
  return group;
}
