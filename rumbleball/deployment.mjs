import { COURT } from './data.mjs';

// Coordinates are cell centres. This point is the intersection of F4/G4/F5/G5.
export const CENTER = Object.freeze({ x: (COURT.width - 1) / 2, y: (COURT.height - 1) / 2 });
export const CENTER_CELLS = Object.freeze([{ x: 5, y: 3 }, { x: 6, y: 3 }, { x: 5, y: 4 }, { x: 6, y: 4 }].map(Object.freeze));
const FORMATIONS = {
  balanced: [[4, 3], [5, 3], [5, 4], [4, 4], [3, 4]],
  pressing: [[4, 2], [5, 3], [4, 4], [5, 4], [4, 5]],
  possession: [[3, 3], [5, 3], [4, 4], [4, 2], [3, 5]],
};
export const inHalf = (p, side = 'home') => p && Number.isInteger(p.x) && Number.isInteger(p.y)
  && p.y >= 0 && p.y < COURT.height && p.x >= (side === 'away' ? COURT.width / 2 : 0) && p.x < (side === 'away' ? COURT.width : COURT.width / 2);
export const validDeployment = (cells, side = 'home') => Array.isArray(cells) && cells.length === 5
  && cells.every((p) => inHalf(p, side)) && new Set(cells.map((p) => `${p.x},${p.y}`)).size === 5;
export const orientDeployment = (cells, side = 'home') => cells.map(({ x, y }) => side === 'away' ? { x: COURT.width - 1 - x, y: COURT.height - 1 - y } : { x, y });
export const defaultDeployment = (strategy = 'balanced', side = 'home') => orientDeployment((FORMATIONS[strategy] ?? FORMATIONS.balanced).map(([x, y]) => ({ x, y })), side);
export const clubDeployment = (club, side = 'home') => orientDeployment(club.deployment ?? defaultDeployment(club.strategy), side);
export const isCenterBall = (state) => !state.ball.carrierId && state.ball.position.x === CENTER.x && state.ball.position.y === CENTER.y;

export function moveDeployment(cells, slot, position) {
  if (!validDeployment(cells) || !Number.isInteger(slot) || slot < 0 || slot >= 5 || !inHalf(position)) throw new Error('Placez cinq joueurs distincts dans votre moitié de terrain.');
  const next = cells.map((p) => ({ ...p })), occupied = next.findIndex((p) => p.x === position.x && p.y === position.y);
  if (occupied >= 0) next[occupied] = next[slot];
  next[slot] = { x: position.x, y: position.y }; return next;
}
