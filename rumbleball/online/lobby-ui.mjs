import { el, btn } from '../career-components.mjs';
import { clubIdentity } from '../broadcast-components.mjs';

export function waitingRoom(league, userId, { onAdd, onRemove, onStart, onCopy }) {
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
  if (owner) {
    const actions = el('div', 'rb-online-actions'), add = btn('Ajouter un bot', onAdd), start = btn('Lancer la saison', onStart, true);
    add.disabled = league.members.length >= league.maxClubs;
    start.disabled = league.members.length < 2;
    actions.append(add, start); roster.append(actions);
  }
  root.append(invitation, roster); return root;
}
