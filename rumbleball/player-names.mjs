import { PROFILES } from './data.mjs';

const FIRST_NAMES = 'Alix Alma Amara Anouk Arlo Astrid Ava Axel Ayla Basile Cassian Céleste Côme Dalia Dario Éden Elia Elio Élise Enzo Esra Ezra Finn Gaël Hana Idris Ilyan Iris Ismaël Jade Jaro Jaya Kaël Kira Léna Léon Lio Liv Loris Lou Maël Mara Milo Mina Naël Naïma Naya Néo Nils Noé Oona Orin Oscar Pavel Rami Romy Sacha Sana Sol Tao Tess Vadim Yara Zora'.split(' ');
const LAST_NAMES = 'Ardent Aster Atlas Aube Azur Brume Calde Cendre Chrome Cime Clair Corbeau Corne Craie Crête Dague Dax Dorne Drake Éclat Épine Falk Féral Foudre Frey Givre Grise Hale Havre Haze Holt Kade Kern Kestrel Knox Lame Lark Lynx Mace Marne Mistral Nox Onyx Orage Quartz Ravel Reed Rive Roche Ronce Roux Sable Silex Skarn Slate Solace Soren Steele Thorne Vale Vance Venn Voss Wren'.split(' ');
export const PLAYER_NAME_POOL_SIZE = FIRST_NAMES.length * LAST_NAMES.length;
const LEGACY_NAMES = new Set([...PROFILES.map(p => p.name), 'Echo', 'Magma', 'Pixel', 'Crank', 'Lentille', 'Boussole', 'Cobalt', 'Marteau', 'Flash', 'Glitch', 'Prisme', 'Radar']);
const legacyName = name => typeof name === 'string' && / \d+$/.test(name) && LEGACY_NAMES.has(name.replace(/ \d+$/, ''));
function hash(value) { let n = 2166136261; for (const char of value) n = Math.imul(n ^ char.charCodeAt(0), 16777619) >>> 0; return n; }

export function playerName(key, used = new Set()) {
  const start = hash(String(key)) % PLAYER_NAME_POOL_SIZE;
  for (let offset = 0; offset < PLAYER_NAME_POOL_SIZE; offset++) {
    const index = (start + offset) % PLAYER_NAME_POOL_SIZE, name = `${FIRST_NAMES[index % FIRST_NAMES.length]} ${LAST_NAMES[Math.floor(index / FIRST_NAMES.length)]}`;
    if (!used.has(name)) return name;
  }
  throw new Error('Le pool de noms de joueurs est épuisé.');
}

// Preserve existing identities; only replace the old generated numeric suffixes.
export function replaceLegacyPlayerNames(players, namespace) {
  const used = new Set(players.filter(p => !legacyName(p.name)).map(p => p.name));
  for (const p of players) if (legacyName(p.name)) { p.name = playerName(`${namespace}:name:${p.id}`, used); used.add(p.name); }
}
