import { el } from './career-components.mjs';
import { currentPlayoffRound } from './playoffs.mjs';

export function qualificationLegend(count) {
  return el('p', 'rb-qualification-legend', `Les ${count} premières équipes se qualifient pour les playoffs.`);
}
export function playoffBracket(bracket, clubs, ownId) {
  const root = el('section', 'rb-playoffs'), champion = clubs.find(club => club.id === bracket.championId), current = currentPlayoffRound(bracket);
  root.setAttribute('aria-label', 'Tableau des playoffs');
  root.append(el('h3', '', 'Playoffs'), el('p', 'rb-muted', champion ? `Champion : ${champion.name}` : `${bracket.seeds.length} qualifiés · ${current?.name ?? ''}`));
  const tree = el('div', 'rb-playoff-tree');
  for (const [r, round] of bracket.rounds.entries()) {
    const column = el('section', 'rb-playoff-round'), matches = el('div', 'rb-playoff-round-matches'); column.append(el('h4', '', round.name));
    for (const [i, match] of round.matches.entries()) {
      const card = el('article', `rb-playoff-match${[match.homeId, match.awayId].includes(ownId) ? ' is-own' : ''}`); card.setAttribute('aria-label', `${round.name} · rencontre ${i + 1}`);
      for (const [side, id] of [match.homeId, match.awayId].entries()) {
        const club = clubs.find(club => club.id === id), row = el('div', `rb-playoff-team${id && id === match.winnerId ? ' is-winner' : ''}`);
        row.append(el('small', 'rb-muted', id ? `#${bracket.seeds.indexOf(id) + 1}` : '—'), el('span', '', club?.name ?? (r ? `Vainqueur de la rencontre ${i * 2 + side + 1}` : 'Exempt'))); card.append(row);
      }
      card.append(el('small', 'rb-muted', match.decision === 'double-forfeit' ? 'Double forfait · meilleur classement qualifié' : match.decision === 'forfeit' ? 'Victoire par forfait' : match.decision === 'ranking' ? 'Égalité après prolongations · meilleur classement qualifié' : match.decision === 'bye' ? 'Qualification directe' : match.winnerId ? 'Terminé' : match.homeId && match.awayId ? 'À jouer' : 'En attente'));
      matches.append(card);
    }
    column.append(matches); tree.append(column);
  }
  root.append(tree, el('p', 'rb-muted', 'En cas de nul après les prolongations, l’équipe la mieux classée en phase de groupe se qualifie.')); return root;
}
