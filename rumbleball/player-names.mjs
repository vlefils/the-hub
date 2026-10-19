const FIRST_NAMES = {
  female: 'Alma Amara Anouk Astrid Ava Ayla Céleste Dalia Élise Esra Hana Iris Jade Jaya Kira Léna Liv Mara Mina Naïma Naya Oona Sana Tess Yara Zora Nora Inès Salomé Thelma Véra Zoé'.split(' '),
  male: 'Arlo Axel Basile Cassian Côme Dario Elio Enzo Finn Gaël Idris Ilyan Ismaël Jaro Kaël Léon Loris Maël Milo Naël Néo Nils Noé Orin Oscar Pavel Rami Tao Vadim Abel Ruben Silas'.split(' '),
  neutral: 'Alix Alex Andrea Ariel Ashley Billie Camille Charlie Chris Claude Dana Dominique Eden Jackie Jessie Jo Jordan Lou Maé Morgan Noa Robin Sam Sasha Sacha Sol Ange Dany Manu Max Swan Yaël'.split(' '),
};
const NICKNAME_PAIRS = [
  ['Le Vif', 'La Vive'], ['Le Rusé', 'La Rusée'], ['Le Fulgurant', 'La Fulgurante'], ['Le Tenace', 'La Tenace'],
  ['Le Silencieux', 'La Silencieuse'], ['Le Sauvage', 'La Sauvage'], ['Le Coriace', 'La Coriace'], ['Le Rapide', 'La Rapide'],
  ['Le Costaud', 'La Costaude'], ['Le Futé', 'La Futée'], ['Le Malin', 'La Maligne'], ['Le Voltigeur', 'La Voltigeuse'],
  ['Le Fonceur', 'La Fonceuse'], ['Le Téméraire', 'La Téméraire'], ['Le Redoutable', 'La Redoutable'], ['Le Mystérieux', 'La Mystérieuse'],
  ['Le Briseur', 'La Briseuse'], ['Le Frondeur', 'La Frondeuse'], ['Le Rebelle', 'La Rebelle'], ['Le Précis', 'La Précise'],
  ['Le Loyal', 'La Loyale'], ['Le Farouche', 'La Farouche'], ['Le Féroce', 'La Féroce'], ['Le Vaillant', 'La Vaillante'],
  ['Le Bourru', 'La Bourrue'], ['Le Fougueux', 'La Fougueuse'], ['Le Vigilant', 'La Vigilante'], ['Le Farceur', 'La Farceuse'],
  ['Le Rieur', 'La Rieuse'], ['Le Brave', 'La Brave'], ['Le Tranchant', 'La Tranchante'], ['Le Solide', 'La Solide'],
];
const NICKNAMES = {
  female: NICKNAME_PAIRS.map(pair => pair[1]), male: NICKNAME_PAIRS.map(pair => pair[0]),
  neutral: 'Écho Pixel Chrome Cobalt Glitch Prisme Radar Quartz Mirage Silex Brume Étincelle Tempo Nexus Azur Flash Sillage Éclipse Braise Comète Horizon Spectre Nitro Vortex Signal Orage Opale Laser Pulse Nova Impact Zénith'.split(' '),
};
const LAST_NAMES = 'Ardent Aster Atlas Aube Azur Brume Calde Cendre Chrome Cime Clair Corbeau Corne Craie Crête Dague Dax Dorne Drake Éclat Épine Falk Féral Foudre Frey Givre Grise Hale Havre Haze Holt Kade Kern Kestrel Knox Lame Lark Lynx Mace Marne Mistral Nox Onyx Orage Quartz Ravel Reed Rive Roche Ronce Roux Sable Silex Skarn Slate Solace Soren Steele Thorne Vale Vance Venn Voss Wren'.split(' ');
export const PLAYER_NAME_POOL_SIZE = Object.keys(FIRST_NAMES).reduce((total, gender) => total + FIRST_NAMES[gender].length * NICKNAMES[gender].length * LAST_NAMES.length, 0);
const namingGender = gender => Object.hasOwn(FIRST_NAMES, gender) ? gender : 'neutral';
function hash(value) { let n = 2166136261; for (const char of value) n = Math.imul(n ^ char.charCodeAt(0), 16777619) >>> 0; return n; }

export function playerName(key, used = new Set(), gender = 'neutral') {
  const kind = namingGender(gender), first = FIRST_NAMES[kind], nicknames = NICKNAMES[kind], size = first.length * nicknames.length * LAST_NAMES.length, start = hash(String(key)) % size;
  for (let offset = 0; offset < size; offset++) {
    const index = (start + offset) % size, name = `${first[index % first.length]} "${nicknames[Math.floor(index / first.length) % nicknames.length]}" ${LAST_NAMES[Math.floor(index / (first.length * nicknames.length))]}`;
    if (!used.has(name)) return name;
  }
  throw new Error('Le pool de noms de joueurs est épuisé.');
}

export function playerNameMatchesGender(name, gender) {
  const parts = typeof name === 'string' && /^([^"\n]+) "([^"\n]+)" ([^"\n]+)$/.exec(name), kind = namingGender(gender);
  return Boolean(parts && FIRST_NAMES[kind].includes(parts[1]) && NICKNAMES[kind].includes(parts[2]) && LAST_NAMES.includes(parts[3]));
}

// Call after portrait assignment. Existing matching names remain stable.
export function normalisePlayerNames(players, namespace, genderOf) {
  const used = new Set(), pending = [];
  for (const p of players) {
    if (playerNameMatchesGender(p.name, genderOf(p)) && !used.has(p.name)) used.add(p.name);
    else pending.push(p);
  }
  for (const p of pending) { p.name = playerName(`${namespace}:name:${p.id}`, used, genderOf(p)); used.add(p.name); }
}
