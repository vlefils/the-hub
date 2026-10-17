import { COURT } from './data.mjs';

const announcements = new Set(['finish', 'overtime', 'restart', 'engagement-result']);
const boundary = (event) => event.resolvedAction || (event.type === 'class' && ['lock', 'call', 'feint', 'observe'].includes(event.ability))
  || ['move', 'drag', 'opportunity', 'stand', 'hold-position', 'movement-stopped', 'round-end', 'finish', 'overtime', 'restart', 'engagement-result'].includes(event.type);
const metres = (steps) => {
  const distance = steps * COURT.cell;
  return `${distance.toLocaleString('fr-FR')} ${distance < 2 ? 'mètre' : 'mètres'}`;
};

// Pure presentation: only completed events are narrated, never a bot's intended action.
export function narrateTurn(events, players) {
  const name = (id) => players.find((p) => p.id === id)?.name ?? 'Un joueur';
  const to = (id) => name(id).startsWith('Le ') ? `au ${name(id).slice(3)}` : name(id).startsWith('Les ') ? `aux ${name(id).slice(4)}` : `à ${name(id)}`;
  const sentences = [], notices = [];
  let movement = null;
  const movementLead = () => {
    const who = name(movement.playerId);
    const drags = [...movement.drags.entries()];
    if (drags.length === 1 && drags[0][1] === movement.steps) {
      return `${who} a traîné ${name(drags[0][0])} sur ${metres(movement.steps)}`;
    }
    const dragged = drags.map(([id, steps]) => `${metres(steps)} en traînant ${name(id)}`).join(' et ');
    return `${who} a parcouru ${metres(movement.steps)}${dragged ? `, dont ${dragged}` : ''}`;
  };
  const flushMovement = () => {
    if (movement?.steps) sentences.push(`${movementLead()}.`);
    movement = null;
  };
  const describeAction = (action, group, reaction = false) => {
    const who = name(action.playerId), target = name(action.targetId);
    const has = (type) => group.some((e) => e.type === type);
    const damage = group.filter((e) => e.type === 'damage' && e.playerId === action.targetId).reduce((total, e) => total + e.amount, 0);
    const ko = group.some((e) => e.type === 'ko' && e.playerId === action.targetId);
    const possessions = group.filter((e) => e.type === 'possession');
    let alone, goal, outcome;
    switch (action.type) {
      case 'attack': {
        if (reaction) {
          const hit = ko ? `et a provoqué son KO (${damage} dégâts)` : `(${damage} dégâts)`;
          sentences.push(has('miss') ? `${who} a tenté de cueillir ${target} au passage, mais a manqué son coup.` : `${who} a cueilli ${target} au passage ${hit}.`);
        } else {
          goal = `${has('miss') ? 'tenter de ' : ''}mettre une beigne ${to(action.targetId)}`;
          outcome = has('miss') ? 'mais a raté son coup' : ko ? `et a mis sa cible KO (${damage} dégâts)` : `et lui a infligé ${damage} dégâts`;
          alone = has('miss') ? `${who} a tenté de mettre une beigne ${to(action.targetId)}, mais a raté son coup` : ko ? `${who} a mis ${target} KO d’une beigne (${damage} dégâts)` : `${who} a mis une beigne ${to(action.targetId)} (${damage} dégâts)`;
        }
        break;
      }
      case 'pickup': {
        const success = possessions.some((e) => e.playerId === action.playerId);
        if (action.atCenter) {
          goal = 'attraper le ballon au centre'; outcome = success ? 'et l’a attrapé' : 'mais l’a manqué';
          alone = success ? `${who} a attrapé le ballon au centre` : `${who} a tenté d’attraper le ballon au centre, sans succès`; break;
        }
        goal = 'récupérer la balle'; outcome = success ? 'et a pris le contrôle' : 'mais s’est fait barrer la route';
        alone = success ? `${who} a récupéré la balle` : `${who} a tenté de récupérer la balle, sans succès`;
        break;
      }
      case 'strip': {
        const success = possessions.some((e) => e.playerId === action.playerId);
        goal = `arracher la balle ${to(action.targetId)}`; outcome = success ? 'et a pris le contrôle' : `mais ${target} l’a gardée`;
        alone = success ? `${who} a arraché la balle ${to(action.targetId)}` : `${who} a tenté d’arracher la balle ${to(action.targetId)}, sans succès`;
        break;
      }
      case 'grapple':
        goal = `agripper ${target}`; outcome = has('grapple') ? 'et a verrouillé sa prise' : `mais ${target} a résisté`;
        alone = has('grapple') ? `${who} a agrippé ${target}` : `${who} a tenté d’agripper ${target}, sans succès`;
        break;
      case 'shove': {
        const push = action.mode === 'push', success = has(push ? 'push' : 'prone');
        goal = `${push ? 'repousser' : 'plaquer'} ${target}`;
        outcome = success ? push ? 'et l’a fait reculer' : 'et a réussi son plaquage' : push ? 'mais sans parvenir à déplacer sa cible' : 'mais sans parvenir à mettre sa cible au sol';
        alone = success ? `${who} a ${push ? 'repoussé' : 'plaqué'} ${target}` : `${who} a tenté de ${goal}, sans succès`;
        break;
      }
      case 'pass': {
        const received = possessions.some((e) => e.playerId === action.targetId && e.reason === 'reçoit');
        const intercepted = possessions.find((e) => e.reason === 'intercepte');
        goal = `passer la balle ${to(action.targetId)}`;
        outcome = received ? 'et sa passe est arrivée à bon port' : intercepted ? `mais ${name(intercepted.playerId)} l’a interceptée` : 'mais la balle a fini au sol';
        alone = received ? `${who} a passé la balle ${to(action.targetId)}` : `${who} a tenté une passe ${to(action.targetId)}, ${outcome}`;
        break;
      }
      case 'help':
        goal = `prêter main-forte ${to(action.targetId)}`; alone = `${who} a prêté main-forte ${to(action.targetId)}`;
        break;
      case 'escape':
        alone = has('escape') ? `${who} a brisé la prise adverse` : `${who} a tenté de se libérer, sans succès`;
        break;
      case 'dash': alone = `${who} a tenté de sprinter`; break;
      case 'disengage': alone = `${who} a préparé son désengagement`; break;
      case 'dodge': goal = 'se mettre en garde'; alone = `${who} a choisi l’esquive`; break;
      case 'wait': alone = `${who} a gardé sa position`; break;
      case 'drop': alone = `${who} a lâché la balle volontairement`; break;
      case 'release': alone = `${who} a relâché ${target}`; break;
      default: alone = group.filter((e) => e.type !== 'roll').map((e) => e.message).join(' ').replace(/\.$/, '');
    }
    if (!reaction) {
      if (movement?.steps && movement.playerId === action.playerId && goal) {
        sentences.push(`${movementLead()} pour ${goal}${outcome ? `${outcome.startsWith('et ') ? ' ' : ', '}${outcome}` : ''}.`);
        movement = null;
      } else { flushMovement(); if (alone) sentences.push(`${alone}.`); }
    }
    for (const drop of group.filter((e) => e.type === 'drop' && e.playerId && action.type === 'attack')) {
      sentences.push(`${name(drop.playerId)} a lâché la balle.`);
    }
    // Forced separation during an action remains visible; routine hold-position does not.
    for (const release of group.filter((e) => e.type === 'release' && action.type !== 'release')) sentences.push(release.message);
    for (const technique of group.filter((e) => e.type === 'class')) sentences.push(technique.message);
    for (const push of group.filter((e) => e.type === 'push' && action.type === 'attack')) sentences.push(`${name(push.playerId)} a reculé sous la percussion.`);
  };
  for (let i = 0; i < events.length;) {
    const event = events[i];
    if (event.type === 'move') {
      if (movement && movement.playerId !== event.playerId) flushMovement();
      movement ??= { playerId: event.playerId, steps: 0, drags: new Map() };
      movement.steps += event.path.length; i++; continue;
    }
    if (event.type === 'drag') {
      if (movement?.playerId === event.byId) movement.drags.set(event.playerId, (movement.drags.get(event.playerId) ?? 0) + event.path.length);
      i++; continue;
    }
    const reaction = event.type === 'opportunity';
    const action = event.resolvedAction ?? (['attack', 'opportunity'].includes(event.type) ? { type: 'attack', playerId: event.playerId, targetId: event.targetId } : null);
    if (action) {
      let end = i + 1;
      while (end < events.length && !boundary(events[end])) end++;
      const group = events.slice(i, end);
      if (reaction) flushMovement();
      // Sprint/disengage happen before movement; include their actual following path.
      if (['dash', 'disengage'].includes(action.type) && events[end]?.type === 'move') {
        flushMovement();
        const move = events[end], drag = events[end + 1]?.type === 'drag' ? events[end + 1] : null;
        if (drag) {
          sentences.push(`${name(action.playerId)} a traîné ${name(drag.playerId)} sur ${metres(move.path.length)}${action.type === 'disengage' ? ' en évitant les coups gratuits' : ' en sprintant'}.`);
        } else sentences.push(`${name(action.playerId)} ${action.type === 'dash' ? 'a sprinté sur' : 'a parcouru'} ${metres(move.path.length)}${action.type === 'disengage' ? ' en évitant les coups gratuits' : ''}.`);
        end += drag ? 2 : 1;
      } else describeAction(action, group, reaction);
      i = end; continue;
    }
    if (announcements.has(event.type)) { flushMovement(); notices.push({ type: event.type, message: event.message }); }
    else if (event.type === 'stand') { flushMovement(); sentences.push(`${name(event.actorId)} a repris ses appuis.`); }
    else if (event.type === 'release') { flushMovement(); sentences.push(event.message); }
    else if (event.type === 'class') { flushMovement(); sentences.push(event.message); }
    i++;
  }
  flushMovement();
  return { text: sentences.join(' '), announcements: notices };
}
