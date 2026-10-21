import { el, btn, field } from '../career-components.mjs';
import { clubIdentity } from '../broadcast-components.mjs';
import { parisDateTime } from './schedule.mjs';

export function waitingRoom(league, userId, { onAdd, onRemove, onStart, onCopy, scheduleValue, onSchedule = () => {} }) {
  const root = el('section', 'rb-waiting-room'), invitation = el('div'), roster = el('div'), owner = league.ownerId === userId;
  root.setAttribute('aria-label', 'Salle d’attente');
  invitation.append(el('p', 'rb-eyebrow', 'Salle d’attente'), el('h2', '', `${league.members.length} club${league.members.length > 1 ? 's' : ''} inscrit${league.members.length > 1 ? 's' : ''}`),
    el('p', 'rb-muted', owner ? 'Invitez vos amis ou ajoutez des bots. Lancez la saison quand tout le monde est prêt, à partir de deux clubs.' : 'La ligue est ouverte. Le créateur lancera la saison quand tout le monde sera prêt.'),
    el('small', 'rb-muted', 'Code d’invitation'), el('p', 'rb-online-code', league.inviteCode), btn('Copier le code', onCopy));
  const list = el('ul', 'rb-waiting-clubs');
  list.setAttribute('aria-label', 'Clubs inscrits');
  for (const member of league.members) {
    const row = el('li'), identity = el('div');
    identity.append(clubIdentity(member, { compact: true }), el('small', 'rb-muted', member.isBot ? 'Bot · gestion automatique' : member.userId === league.ownerId ? 'Créateur' : 'Joueur'));
    row.append(identity);
    if (owner && member.isBot) {
      const remove = btn('Retirer', () => onRemove(member.userId));
      remove.setAttribute('aria-label', `Retirer le bot ${member.name}`); remove.dataset.focusKey = member.userId; row.append(remove);
    }
    list.append(row);
  }
  roster.append(list);
  const guide = el('div', 'rb-waiting-guide');
  guide.append(el('h3', '', 'Comment se déroule la saison ?'), el('p', '', '1. Le créateur rassemble les managers et les bots, puis lance la saison.'),
    el('p', '', '2. Journée 1 : chacun dispose de 2 400 chromas pour choisir ses premières recrues et préparer cinq titulaires.'),
    el('p', '', '3. À l’heure du premier match, une équipe équilibrée est recrutée automatiquement pour les managers qui n’ont pas validé leur effectif, avec leur budget initial. Les journées suivantes ont lieu à 20 h, heure de Paris.'));
  roster.append(guide);
  if (owner) {
    const date = el('input'); date.type = 'datetime-local'; date.required = true; date.value = scheduleValue || parisDateTime(league.suggestedFirstMatchAt); date.setAttribute('aria-label', 'Premier match · heure de Paris'); date.dataset.focusKey = 'first-match-at';
    date.addEventListener('input', () => onSchedule(date.value));
    const actions = el('div', 'rb-online-actions'), add = btn('Ajouter un bot', onAdd), start = btn('Lancer la saison', () => onStart(date.value), true);
    add.disabled = league.members.length >= league.maxClubs;
    start.disabled = league.members.length < 2;
    actions.append(add, start); roster.append(field('Premier match · heure de Paris', date), el('p', 'rb-muted', 'Lancer la saison ouvre immédiatement le recrutement et ferme les inscriptions. Chaque manager choisit ses joueurs avant le premier match ; sans validation à l’échéance, le recrutement est automatique.'), actions);
  }
  root.append(invitation, roster); return root;
}
