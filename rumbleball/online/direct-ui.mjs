import { el } from '../career-components.mjs';
import { clubIdentity } from '../broadcast-components.mjs';
import { directState, countdown } from './direct.mjs';

const date = value => value ? new Date(value).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'À suivre';
const titles = { before: 'Avant-match', entrance: 'Entrée des équipes', live: 'En direct', break: 'Pause entre les rencontres', delayed: 'En attente du serveur', ended: 'Soirée terminée' };
export function createDirectDesk(live, { clock, onFrame }) {
  const root = el('section', 'rb-direct'), header = el('header', 'rb-direct-heading'), identity = el('div'), status = el('p', 'rb-eyebrow'), title = el('h2'), timer = el('time', 'rb-direct-clock');
  const stage = el('div', 'rb-direct-stage'), poster = el('div', 'rb-direct-poster'), recap = el('p', 'rb-direct-recap'), programme = el('ol', 'rb-direct-programme');
  status.setAttribute('role', 'status'); timer.setAttribute('aria-live', 'off'); programme.setAttribute('aria-label', 'Programme du direct'); programme.setAttribute('tabindex', '0');
  identity.append(status, title); header.append(identity, timer); stage.append(poster, live); root.append(header, stage, recap, programme);
  let league, interval, stopped = false, signature = '', frameKey = '', programmeKey = '';
  const member = id => league.members.find(member => member.userId === id) ?? { name: 'Club', id };
  function result(game) {
    if (!game) return '';
    if (!game.result) return `${member(game.homeId).name} — ${member(game.awayId).name} · Résultat en cours de confirmation`;
    const winner = game.result?.winnerId;
    return `${member(game.homeId).name} — ${member(game.awayId).name} · ${winner ? `Victoire : ${member(winner).name}` : 'Match nul'}`;
  }
  function render() {
    if (!league || stopped || document.hidden) return;
    const now = clock(), state = directState(league, now), match = state.match;
    const key = JSON.stringify([state.phase, match?.id, match?.homeId, match?.awayId, state.previous?.id, state.previous?.result, league.season, league.day, league.members]);
    root.dataset.phase = state.phase;
    status.textContent = `${league.name} · ${titles[state.phase]}`;
    timer.textContent = countdown(state.deadline, now); timer.hidden = !state.deadline;
    if (state.deadline) timer.setAttribute('datetime', state.deadline);
    timer.setAttribute('aria-label', `${state.phase === 'break' ? 'Prochain match' : 'Coup d’envoi'} dans ${timer.textContent}`);
    if (key !== signature) {
      signature = key;
      title.textContent = state.phase === 'break' ? 'Prochaine rencontre' : state.phase === 'before' ? `Rendez-vous le ${date(state.deadline)} · Paris` : titles[state.phase];
      const hasCourt = ['entrance', 'live', 'delayed'].includes(state.phase) && league.status === 'broadcast';
      live.hidden = !hasCourt; poster.hidden = hasCourt;
      poster.replaceChildren();
      if (match) {
        const versus = el('div', 'rb-direct-versus'); versus.append(clubIdentity(member(match.homeId)), el('span', '', 'VS'), clubIdentity(member(match.awayId))); poster.append(versus);
      }
      poster.append(el('p', 'rb-muted', state.phase === 'break' ? 'Deux minutes pour souffler. Les prochaines équipes vont entrer en piste.' : state.phase === 'ended' ? 'Les résultats et les replays sont disponibles dans Ligue.' : state.phase === 'delayed' ? 'Le serveur prépare le coup d’envoi. La diffusion reprendra automatiquement.' : 'Les équipes entreront sur le terrain au coup d’envoi. Vous pouvez laisser cet écran ouvert.'));
      recap.textContent = result(state.previous); recap.hidden = !state.previous;
    }
    const frame = league.broadcast;
    const keyFrame = frame ? `${frame.id}:${frame.roundStartsAt}:${frame.turns.length}` : '';
    if (frame && keyFrame !== frameKey) {
      frameKey = keyFrame;
      onFrame(frame, Math.max(0, now - Date.parse(frame.roundStartsAt)), state.phase === 'entrance' ? {
        duration: Date.parse(frame.playsAt) - Date.parse(frame.startsAt ?? match.startsAt), elapsed: Math.max(0, now - Date.parse(frame.startsAt ?? match.startsAt)),
      } : null);
    }
    if (league.status === 'broadcast' && !frame) onFrame(null);
  }
  function schedule() {
    clearTimeout(interval);
    if (stopped) return;
    render(); interval = setTimeout(schedule, 1000);
  }
  return { root, update(next) {
    league = next;
    const fixtures = league.status === 'broadcast' ? league.games : league.upcoming;
    const nextProgramme = JSON.stringify([fixtures, league.nextLockAt, league.members]);
    if (nextProgramme !== programmeKey) {
      programmeKey = nextProgramme;
      const scroll = programme.scrollLeft ?? 0;
      programme.replaceChildren();
      for (const [index, game] of (fixtures ?? []).entries()) {
        const item = el('li'); item.dataset.status = game.status ?? 'scheduled';
        item.append(el('span', 'rb-direct-order', String(index + 1)), clubIdentity(member(game.homeId), { compact: true }), el('span', 'rb-muted', 'vs'), clubIdentity(member(game.awayId), { compact: true }),
          el('small', 'rb-muted', game.status === 'finished' ? 'Terminé' : game.status === 'live' ? 'En cours' : date(game.startsAt ?? (index === 0 ? league.nextLockAt : null)))); programme.append(item);
      }
      programme.scrollLeft = scroll;
    }
    schedule();
  }, resume() { frameKey = ''; render(); }, stop() { stopped = true; clearTimeout(interval); } };
}
