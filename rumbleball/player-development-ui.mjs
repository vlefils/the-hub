import { el, btn, field, select, signed, comparison } from './career-components.mjs';
import { modifier } from './data.mjs';
import { compilePlayer } from './progression.mjs';
import { ABILITY_LABELS, pendingAbilityLevels, abilityIncreaseError, applyAbilityIncrease } from './player-development.mjs';

export function abilitySummary(compiled) {
  const root = el('section', 'rb-ability-summary'), list = el('dl', 'rb-ability-scores'); root.setAttribute('aria-label', 'Caractéristiques et maîtrise');
  for (const [key, label] of Object.entries(ABILITY_LABELS)) {
    const score = compiled.abilities[key], row = el('div'), value = el('dd');
    value.append(el('strong', '', String(score)), el('small', 'rb-muted', signed(modifier(score)))); row.append(el('dt', 'rb-muted', label), value); list.append(row);
  }
  root.append(list, el('p', 'rb-muted', `Maîtrise ${signed(compiled.proficiencyBonus)} · Récupération sur le banc : ${compiled.recovery} fatigue / journée`));
  if (compiled.pendingAbilityIncreases) root.append(el('p', 'rb-development-count', `${compiled.pendingAbilityIncreases * 2} points de caractéristiques à répartir`));
  return root;
}
export function abilityPendingBadge(player) {
  const count = pendingAbilityLevels(player).length, badge = el('small', 'rb-development-count', count ? `${count * 2} points à attribuer` : ''); badge.hidden = !count; return badge;
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
