import { KIT_COLORS, playerLook, sportingWeapon, visibleGear } from './appearance.mjs';
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
  definitions.append(floor, stripes, wet); background.append(definitions);
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

export function turnMarkerArtwork() {
  const marker = svg('g', { class: 'rb-turn-marker', 'aria-hidden': 'true', visibility: 'hidden' });
  const corners = 'M-28-16V-28H-16M16-28H28V-16M28 16V28H16M-16 28H-28V16';
  marker.append(svg('path', { d: corners, class: 'rb-turn-marker-outline' }), svg('path', { d: corners, class: 'rb-turn-marker-corners' }));
  return marker;
}

export function pawnArtwork(player, color = KIT_COLORS[player.teamId === 'away' ? 1 : 0], { portrait = false } = {}) {
  const look = playerLook(player), gear = visibleGear(player), weapon = sportingWeapon(player);
  const outline = { stroke: '#142022', 'stroke-width': 1.4, 'stroke-linejoin': 'round' };
  const jerseyStroke = [1, 3, 5].reduce((sum, i) => sum + parseInt(color.slice(i, i + 2), 16), 0) < 240 ? '#8c9c9b' : outline.stroke;
  const group = svg('g', { 'aria-hidden': 'true' });
  group.append(svg('circle', { r: 28, fill: 'transparent', class: 'rb-person-hit-area' }), svg('circle', { r: 27, fill: 'none', stroke: 'none', class: 'rb-pawn-ring' }),
    svg('ellipse', { cx: 0, cy: 14, rx: 18, ry: 6, fill: '#050c0d', opacity: .45, class: 'rb-person-shadow' }));
  const body = svg('g', { class: 'rb-person-body' }), facing = svg('g', { class: 'rb-person-facing' });
  for (const side of [-1, 1]) {
    const leg = svg('g', { class: `rb-person-${side < 0 ? 'left' : 'right'}-leg`, transform: `translate(${side * 6} 10)` });
    leg.append(svg('rect', { x: -4, y: 0, width: 8, height: 9, rx: 2, fill: '#26343c', ...outline }),
      svg('rect', { x: -4.5, y: 5, width: 9, height: 7, rx: 2, fill: '#111c22', ...outline }));
    if (gear.implant === 'legs') leg.append(svg('path', { d: 'M-3 1H3V9H-3Z', fill: '#a3b7ba', ...outline }), svg('path', { d: 'M0 2V8', stroke: '#71dfcf', 'stroke-width': 2 }));
    if (gear.protection === 'soles') leg.append(svg('path', { d: 'M-4 11H4', stroke: '#81d6d2', 'stroke-width': 2.5 }));
    facing.append(leg);
  }
  const broad = player.archetype === 'belier';
  facing.append(svg('path', { d: broad ? 'M-15-2Q-20 1-17 9L-10 14H10L17 9Q20 1 15-2Z' : 'M-12-1Q-17 2-14 9L-9 13H9L14 9Q17 2 12-1Z', fill: color, ...outline, stroke: jerseyStroke, class: 'rb-person-jersey' }),
    svg('path', { d: 'M-10 5H10', stroke: '#f4f0da', 'stroke-width': player.teamId === 'away' ? 3 : 1.5, opacity: .7 }));
  if (['vest', 'armor'].includes(gear.protection)) {
    facing.append(svg('path', { d: 'M-9 1H9L8 12H-8Z', fill: gear.protection === 'armor' ? '#71818a' : '#354b50', ...outline }),
      svg('path', { d: 'M-5 3H5M-5 7H5', stroke: color, 'stroke-width': 2 }));
    if (gear.protection === 'armor') for (const x of [-18, 10]) facing.append(svg('rect', { x, y: -2, width: 8, height: 9, rx: 2, fill: '#89969a', ...outline }));
  }
  if (gear.implant === 'regulator') facing.append(svg('rect', { x: -5, y: 6, width: 10, height: 9, rx: 2, fill: '#a8b8b3', ...outline }), svg('rect', { x: -2, y: 8, width: 4, height: 3, fill: '#65e2c6' }));
  for (const side of [-1, 1]) {
    const arm = svg('g', { class: `rb-person-${side < 0 ? 'left' : 'right'}-arm`, transform: `translate(${side * (broad ? 16 : 13)} 0)` });
    arm.append(svg('rect', { x: -3.5, y: 0, width: 7, height: 9, rx: 3, fill: look.skin, ...outline }),
      svg('circle', { cx: 0, cy: 8, r: gear.protection === 'gloves' ? 4.5 : 3.5, fill: gear.protection === 'gloves' ? '#7c8585' : look.skin, ...outline }));
    if (gear.protection === 'gloves') arm.append(svg('path', { d: 'M-2 7H2', stroke: '#e8ca80', 'stroke-width': 2 }));
    if (side < 0 && player.archetype === 'capitaine') arm.append(svg('rect', { x: -4, y: 0, width: 8, height: 3, rx: 1, fill: '#f0d679', ...outline }));
    if (side < 0 && gear.implant === 'fibers') arm.append(svg('path', { d: 'M-4 1H4M-4 4H4M-4 7H4', stroke: '#d58962', 'stroke-width': 2 }));
    if (side > 0) {
      const stick = svg('g', { class: 'rb-person-weapon', 'data-weapon': weapon.id });
      stick.append(svg('rect', { x: 0, y: -17, width: 4, height: 27, rx: 1.5, fill: '#9da8a6', ...outline }), svg('path', { d: 'M0 4H4M0 7H4', stroke: '#273a40', 'stroke-width': 2 }));
      if (weapon.id === 'maul') stick.append(svg('rect', { x: -4, y: -23, width: 13, height: 9, rx: 2, fill: '#66767c', ...outline }), svg('path', { d: 'M0-21V-16M5-21V-16', stroke: '#c2d0ca', 'stroke-width': 1.5 }));
      if (weapon.id === 'tonfa') stick.append(svg('rect', { x: -5, y: -1, width: 10, height: 4, rx: 1, fill: '#667c83', ...outline }));
      arm.append(stick);
    }
    facing.append(arm);
  }
  facing.append(svg('circle', { cx: -9, cy: -6, r: 2.4, fill: look.skin, ...outline }), svg('circle', { cx: 9, cy: -6, r: 2.4, fill: look.skin, ...outline }),
    svg('ellipse', { cx: 0, cy: -6, rx: 10, ry: 9, fill: look.skin, ...outline, class: 'rb-person-skin' }),
    svg('path', { d: 'M-2-14L0-17L2-14', fill: look.skin, ...outline }),
    svg('circle', { cx: -3.5, cy: -13, r: .65, fill: '#172022' }), svg('circle', { cx: 3.5, cy: -13, r: .65, fill: '#172022' }));
  const hair = svg('g', { class: 'rb-person-hair', 'data-hair': look.hairStyle, fill: look.hair, ...outline });
  if (['crop', 'bun', 'braids'].includes(look.hairStyle)) hair.append(svg('path', { d: 'M-9-11Q-12 2-3 4Q11 7 9-11L5-12L0-10L-5-12Z' }));
  if (look.hairStyle === 'sweep') hair.append(svg('path', { d: 'M-9-6Q-12 4 0 4Q12 3 9-12Q3-15-1-11L-4-7Z' }));
  if (look.hairStyle === 'mohawk') hair.append(svg('path', { d: 'M-2-15L2-16L3 3H-3Z' }));
  if (look.hairStyle === 'bun') hair.append(svg('circle', { cx: 0, cy: 5, r: 4 }));
  if (look.hairStyle === 'braids') hair.append(svg('path', { d: 'M-7 0L-8 7M7 0L8 7', 'stroke-width': 4, stroke: look.hair, 'stroke-linecap': 'round' }));
  if (look.hairStyle === 'bald') hair.append(svg('path', { d: 'M-5-6Q-4-9-1-9', fill: 'none', stroke: '#f4e4ca', opacity: .35 }));
  facing.append(hair);
  if (gear.implant === 'interface') facing.append(svg('path', { d: 'M-8-13H8V-9H-8Z', fill: '#273d46', ...outline }), svg('path', { d: 'M-6-11H6', stroke: '#83efe1', 'stroke-width': 1.5 }));
  body.append(facing); group.append(body);
  if (Number.isInteger(player.number)) {
    const badge = player.teamId === 'away' ? svg('path', { d: 'M19 7L30 18L19 29L8 18Z', fill: color, stroke: '#eaf0e4', 'stroke-width': 1 })
      : svg('circle', { cx: 19, cy: 18, r: 10, fill: color, stroke: '#eaf0e4', 'stroke-width': 1 });
    group.append(badge, svg('text', { x: 19, y: 23, 'text-anchor': 'middle', class: 'rb-pawn-number', fill: '#fff8df', stroke: '#132124', 'stroke-width': 2, 'paint-order': 'stroke', 'font-family': 'Arial,sans-serif', 'font-size': 14, 'font-weight': 700 }, String(player.number)));
  }
  if (!portrait) group.append(svg('rect', { x: -16, y: 30, width: 32, height: 3, class: 'rb-pawn-health-track' }), svg('rect', { x: -16, y: 30, width: 32, height: 3, class: 'rb-pawn-health' }));
  return group;
}

export function playerPortrait(player, color = KIT_COLORS[0]) {
  const portrait = svg('svg', { viewBox: '-32 -30 64 62', class: 'rb-player-portrait', role: 'img', 'aria-label': `${player.name} · ${sportingWeapon(player).name}` });
  portrait.append(pawnArtwork({ ...player, teamId: player.teamId ?? 'home' }, color, { portrait: true })); return portrait;
}

export function poseCharacter(node, player, { carrying = false } = {}) {
  const facing = node.querySelector('.rb-person-facing'); if (!facing) return;
  const gesture = player.gesture, wave = gesture ? Math.sin(Math.PI * gesture.progress) : 0;
  const walk = player.walking ? Math.sin(player.walkPhase ?? 0) : 0;
  const broad = player.archetype === 'belier' || node.dataset.broad === 'true', shoulder = broad ? 16 : 13;
  const fallen = player.prone || player.hp === 0;
  let left = carrying ? -35 : 0, right = 0, lean = 0;
  if (gesture?.kind === 'strike') { right = -75 * wave; lean = -2 * wave; }
  if (['throw', 'grapple'].includes(gesture?.kind)) { left = 115 * wave; right = -115 * wave; }
  if (gesture?.kind === 'receive') { left = 55 * wave; right = -55 * wave; }
  if (gesture?.kind === 'signal') left = 155 * wave;
  if (gesture?.kind === 'brace') lean = 2 * wave;
  if (gesture?.kind === 'dodge') lean = -3 * wave;
  facing.setAttribute('transform', `rotate(${player.facing ?? 0})`);
  node.querySelector('.rb-person-body').setAttribute('transform', `translate(0 ${lean - Math.abs(walk) * 1.2}) rotate(${fallen ? 65 : 0}) scale(1 ${fallen ? .65 : 1})`);
  node.querySelector('.rb-person-left-arm').setAttribute('transform', `translate(${-shoulder} 0) rotate(${left + walk * 9})`);
  node.querySelector('.rb-person-right-arm').setAttribute('transform', `translate(${shoulder} 0) rotate(${right - walk * 9})`);
  node.querySelector('.rb-person-left-leg').setAttribute('transform', `translate(-6 ${10 + walk * 2})`);
  node.querySelector('.rb-person-right-leg').setAttribute('transform', `translate(6 ${10 - walk * 2})`);
}
