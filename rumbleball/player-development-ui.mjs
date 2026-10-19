import { el, btn, field, select, signed, comparison, disclosure } from './career-components.mjs';
import { modifier } from './data.mjs';
import { classAbilities } from './classes.mjs';
import { compilePlayer } from './progression.mjs';
import { ABILITY_LABELS, ABILITY_LEVELS, MAX_LEVEL, proficiencyBonus, pendingAbilityLevels, abilityIncreaseError, applyAbilityIncrease } from './player-development.mjs';

export function abilitySummary(compiled) {
  const root = el('section', 'rb-ability-summary'), list = el('dl', 'rb-ability-scores'); root.setAttribute('aria-label', 'Caractéristiques et maîtrise');
  for (const [key, label] of Object.entries(ABILITY_LABELS)) {
    const score = compiled.abilities[key], row = el('div'), value = el('dd');
    const name = el('dt', 'rb-muted'), short = el('abbr', 'rb-ability-short', { strength: 'FOR', dexterity: 'DEX', constitution: 'CON', mind: 'ESP', charisma: 'CHA' }[key]); short.title = label; name.setAttribute('aria-label', label); name.append(el('span', 'rb-ability-full', label), short);
    value.append(el('strong', '', String(score)), el('small', 'rb-muted', signed(modifier(score)))); row.append(name, value); list.append(row);
  }
  root.append(list, el('p', 'rb-muted', `Maîtrise ${signed(compiled.proficiencyBonus)} · Récupération sur le banc : ${compiled.recovery} fatigue / journée`));
  if (compiled.pendingAbilityIncreases) root.append(el('p', 'rb-development-count', `${compiled.pendingAbilityIncreases * 2} points de caractéristiques à répartir`));
  return root;
}
export function abilityPendingBadge(player) {
  const count = pendingAbilityLevels(player).length, badge = el('small', 'rb-development-count', count ? `${count * 2} points à attribuer` : ''); badge.hidden = !count; return badge;
}
export function playerTechniques(compiled) {
  const root = el('section', 'rb-player-techniques'), list = el('div', 'rb-technique-list');
  root.setAttribute('aria-label', 'Techniques de classe');
  root.append(el('h4', '', 'Techniques de classe'));
  for (const [name, description, unlock] of classAbilities(compiled)) {
    const technique = el('article', `rb-technique${unlock.unlocked ? '' : ' is-locked'}`);
    technique.append(el('h5', '', name), el('small', 'rb-muted', `Niveau ${unlock.level} · ${unlock.unlocked ? 'Disponible' : 'À débloquer'}`), el('p', '', description)); list.append(technique);
  }
  root.append(list); return root;
}
export function playerMilestones(compiled) {
  const root = disclosure('Autres paliers de progression', 'player-milestones'), list = el('ol', 'rb-milestone-list'); root.classList.add('rb-player-milestones');
  root.setAttribute('aria-label', 'Paliers de progression');
  for (let level = 2; level <= MAX_LEVEL; level++) {
    const gains = [];
    if (ABILITY_LEVELS.includes(level)) gains.push('Caractéristiques : deux +1 ou un +2 à attribuer.');
    const mastery = proficiencyBonus(level);
    if (mastery > proficiencyBonus(level - 1)) {
      gains.push(`Maîtrise ${signed(mastery)} sur les attaques et les compétences entraînées.`);
      const resource = { belier: 'Réserve d’Adrénaline +2.', passeur: 'Réserve de concentration +1.', capitaine: 'Réserve d’appels +1.' }[compiled.archetype];
      if (resource) gains.push(resource);
      if (compiled.archetype === 'belier') gains.push('DD de percussion +1.');
    }
    if (compiled.archetype === 'escamoteur' && [3, 5].includes(level)) gains.push('Vitesse +1,5 m.');
    if (!gains.length) continue;
    const unlocked = compiled.level >= level, step = el('li', `rb-milestone${unlocked ? '' : ' is-locked'}`), copy = el('div');
    step.dataset.level = String(level); step.dataset.unlocked = String(unlocked);
    copy.append(el('small', '', unlocked ? 'Débloqué' : 'À débloquer'), el('p', '', gains.join(' ')));
    step.append(el('strong', '', `Niv. ${level}`), copy); list.append(step);
  }
  root.append(list); return root;
}
export function playerAdvancement(club, player, { locked = false, onAdvance } = {}) {
  const root = el('section', 'rb-player-advancement'), pending = pendingAbilityLevels(player);
  if (!pending.length) { root.hidden = true; return root; }
  const first = select({ '': 'Choisir une caractéristique', ...ABILITY_LABELS }, ''), second = select({ '': 'Choisir une caractéristique', ...ABILITY_LABELS }, ''), preview = el('div', 'rb-advancement-preview');
  first.setAttribute('aria-label', 'Premier point de caractéristique'); second.setAttribute('aria-label', 'Second point de caractéristique'); first.disabled = second.disabled = locked;
  let busy = false;
  const changes = () => { const result = {}; for (const value of [first.value, second.value]) if (value) result[value] = (result[value] ?? 0) + 1; return result; };
  const confirm = btn('Valider les 2 points', async () => {
    const gains = changes(); if (locked || busy || !first.value || !second.value || abilityIncreaseError(player, gains)) return;
    busy = true; draw(); try { await onAdvance?.(player.id, gains); } finally { busy = false; draw(); }
  }, true);
  function draw() {
    const gains = changes(), error = abilityIncreaseError(player, gains); preview.replaceChildren();
    first.disabled = second.disabled = locked || busy;
    confirm.disabled = locked || busy || !first.value || !second.value || Boolean(error);
    if (locked) preview.append(el('p', 'rb-muted', 'Équipe verrouillée. Attribuez ces points à la prochaine préparation.'));
    else if (first.value && second.value) {
      if (error) preview.append(el('p', 'rb-loss', error));
      else { const next = structuredClone(player); applyAbilityIncrease(next, gains); preview.append(comparison(compilePlayer(player, club.inventory), compilePlayer(next, club.inventory))); }
    }
  }
  root.append(el('h4', '', `Amélioration du niveau ${pending[0]}`), el('p', 'rb-muted', 'Deux caractéristiques différentes : +1 chacune. La même deux fois : +2. Maximum 20.'), field('Premier point', first), field('Second point', second), preview, confirm);
  for (const choice of [first, second]) choice.addEventListener('change', draw); draw(); return root;
}
