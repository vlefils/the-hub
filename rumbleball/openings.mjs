import { CENTER, defaultDeployment, orientDeployment } from './deployment.mjs';

export const DEFAULT_OPENING = 'breakaway';
export const OPENINGS = {
  breakaway: {
    name: 'Fuite sous écran', rounds: 1, receivers: [],
    cells: [[4, 3], [5, 3], [5, 4], [4, 4], [3, 4]],
    description: 'Les n°2 et 3 disputent l’engagement. Le porteur fuit vers sa moitié ; les trois autres marquent et immobilisent les poursuivants.',
  },
  fallback: {
    name: 'Passe en retrait', rounds: 2, receivers: [5],
    cells: [[4, 2], [5, 3], [5, 4], [4, 5], [2, 3]],
    description: 'Les n°2 et 3 interceptent l’engagement en réaction. Le n°5 reste derrière et garde sa réaction pour recevoir. Le gagnant privilégie une passe sûre vers lui dès son tour ; les autres bloquent les poursuivants.',
  },
  cage: {
    name: 'Cage mobile', rounds: 1, receivers: [],
    cells: [[4, 3], [5, 3], [5, 4], [4, 4], [3, 3]],
    description: 'Les n°2 et 3 disputent l’engagement. Les équipiers entourent le porteur et contiennent les menaces ; il reste à proximité de ses protections.',
  },
  wings: {
    name: 'Double relais sur les ailes', rounds: 2, receivers: [1, 5],
    cells: [[3, 1], [5, 3], [5, 4], [4, 3], [3, 6]],
    description: 'Les n°2 et 3 interceptent l’engagement, le n°4 fait écran. Les n°1 et 5 s’écartent sur les deux ailes et gardent leur réaction ; le porteur cherche le relais le plus sûr dès son tour.',
  },
  press: {
    name: 'Pressing d’entrée', rounds: 1, receivers: [],
    cells: [[5, 2], [5, 3], [5, 4], [4, 3], [5, 5]],
    description: 'Deux joueurs à l’engagement, trois au contact. Si l’adversaire prend la balle, le plus proche tente l’arrachement et les autres ferment ses relais. Si vous la prenez, ils bloquent les poursuivants.',
  },
  none: { name: 'Jeu libre', rounds: 0, receivers: [], description: 'Aucune ouverture imposée. Les rôles, consignes et le plan collectif guident les bots dès le coup d’envoi.' },
};
export const OPENING_IDS = Object.keys(OPENINGS).filter((id) => id !== 'none');
export const OPENING_LABELS = Object.fromEntries(Object.entries(OPENINGS).map(([id, value]) => [id, value.name]));
export const validOpening = (id) => typeof id === 'string' && Object.hasOwn(OPENINGS, id);
export const defaultOpening = (strategy) => strategy === 'possession' ? 'fallback' : strategy === 'pressing' ? 'press' : DEFAULT_OPENING;
export const clubOpening = (club) => club.opening ?? defaultOpening(club.strategy);
export const openingDeployment = (id = DEFAULT_OPENING, side = 'home') => {
  if (!validOpening(id)) throw new Error('Ouverture inconnue.');
  return orientDeployment(OPENINGS[id].cells?.map(([x, y]) => ({ x, y })) ?? defaultDeployment(), side);
};

// Recomputed from public state only. Old saved teams without an opening keep
// their existing AI; no migration, dice, history scan or hidden opponent intent.
export function openingPlan(state, actor) {
  const id = state.teams.find((t) => t.id === actor.teamId)?.opening, spec = OPENINGS[id];
  if (!spec || state.round > spec.rounds || state.version < 3) return null;
  const team = state.players.filter((p) => p.teamId === actor.teamId && p.hp > 0);
  const holder = state.players.find((p) => p.id === state.ball.carrierId);
  if (holder?.teamId !== actor.teamId && holder && id !== 'press') return null;
  if (!holder && (state.ball.position.x !== CENTER.x || state.ball.position.y !== CENTER.y)) return null;
  const contenders = team.filter((p) => [2, 3].includes(p.number)).map((p) => p.id);
  if (!contenders.length) return null;
  const receivers = team.filter((p) => spec.receivers.includes(p.number)).map((p) => p.id);
  if (holder && receivers.includes(holder.id)) return null;
  const anchors = Object.fromEntries(team.map((p) => [p.id, p.startPosition ?? p.position]));
  return { id, contenders, receivers, anchors };
}
