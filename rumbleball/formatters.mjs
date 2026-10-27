import { damageDice } from './attack-damage.mjs';

export const signed = value => `${value >= 0 ? '+' : '−'}${Math.abs(value).toLocaleString(globalThis.HubI18n?.locale || 'fr-FR')}`;
export const damageText = attack => `${damageDice(attack)}d${attack.die}${attack.flat ? ` ${signed(attack.flat)}` : ''}`;
