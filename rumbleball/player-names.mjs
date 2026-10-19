import { PROFILES } from './data.mjs';

const FIRST_NAMES = {
  female: 'Alma Amara Anouk Astrid Ava Ayla Céleste Dalia Élise Esra Hana Iris Jade Jaya Kira Léna Liv Mara Mina Naïma Naya Oona Sana Tess Yara Zora Nora Inès Salomé Thelma Véra Zoé'.split(' '),
  male: 'Arlo Axel Basile Cassian Côme Dario Elio Enzo Finn Gaël Idris Ilyan Ismaël Jaro Kaël Léon Loris Maël Milo Naël Néo Nils Noé Orin Oscar Pavel Rami Tao Vadim Abel Ruben Silas'.split(' '),
  neutral: 'Alix Alex Andrea Ariel Ashley Billie Camille Charlie Chris Claude Dana Dominique Eden Jackie Jessie Jo Jordan Lou Maé Morgan Noa Robin Sam Sasha Sacha Sol Ange Dany Manu Max Swan Yaël'.split(' '),
};
function aliases(shared, forms) {
  return Object.freeze(Object.fromEntries(['male', 'female', 'neutral'].map((gender, index) => [gender, Object.freeze([...shared, ...forms.map(form => form[index])])])));
}
// Technical handles are epicene; titles keep their feminine/masculine variants.
// Each alias belongs to one sporting archetype, independently of tactical role.
export const PLAYER_NICKNAMES = Object.freeze({
  capitaine: aliases(['Mainframe', 'Overmind', 'Vox', 'Root', 'Nexus', 'Synapse', 'Switchboard', 'Backchannel', 'Proxy', 'Crownlink', 'Lockstep', 'Oracle', 'Conclave'], [
    ['Maestro', 'Maestra', 'Orchestra'], ['Le Fixeur', 'La Fixeuse', 'Fix'], ['Le Régent', 'La Régente', 'Régence'],
  ]),
  belier: aliases(['Chromejaw', 'Crashcore', 'Ironclad', 'Overdrive', 'Hardcase', 'Meatgrinder', 'Blacksteel', 'Aftershock', 'Hammerfall', 'Rivet', 'Juggernaut', 'Rupture', 'Béton'], [
    ['Le Broyeur', 'La Broyeuse', 'Grind'], ['Le Ravageur', 'La Ravageuse', 'Carnage'], ['Le Cogneur', 'La Cogneuse', 'Impact'],
  ]),
  escamoteur: aliases(['Ghostwire', 'Nulltrace', 'Glitch', 'Backdoor', 'Phantom', 'Nightshift', 'Ghoststep', 'Softlock', 'Shadewalk', 'Slipstream', 'Zeroday', 'Packetloss', 'Void'], [
    ['Le Fugitif', 'La Fugitive', 'Fugue'], ['Le Brouilleur', 'La Brouilleuse', 'Parasite'], ['Le Dissident', 'La Dissidente', 'Dissidence'],
  ]),
  passeur: aliases(['Deadeye', 'Crosshair', 'Railshot', 'Ricochet', 'Vector', 'Longshot', 'Needle', 'Bullseye', 'Wiretap', 'Lockon', 'Ballistik', 'Killcam', 'Redshift'], [
    ['Le Balisticien', 'La Balisticienne', 'Balistique'], ['Le Franc-Tireur', 'La Franc-Tireuse', 'Tir Fantôme'], ['L’Artilleur', 'L’Artilleuse', 'Artillerie'],
  ]),
});
const LAST_NAMES = 'Ardent Aster Atlas Aube Azur Brume Calde Cendre Chrome Cime Clair Corbeau Corne Craie Crête Dague Dax Dorne Drake Éclat Épine Falk Féral Foudre Frey Givre Grise Hale Havre Haze Holt Kade Kern Kestrel Knox Lame Lark Lynx Mace Marne Mistral Nox Onyx Orage Quartz Ravel Reed Rive Roche Ronce Roux Sable Silex Skarn Slate Solace Soren Steele Thorne Vale Vance Venn Voss Wren'.split(' ');
export const PLAYER_NAME_POOL_SIZE = Object.values(PLAYER_NICKNAMES).reduce((total, pool) => total + Object.keys(FIRST_NAMES).reduce((sum, gender) => sum + FIRST_NAMES[gender].length * pool[gender].length * LAST_NAMES.length, 0), 0);
const namingGender = gender => Object.hasOwn(FIRST_NAMES, gender) ? gender : 'neutral';
const namingClass = archetype => Object.hasOwn(PLAYER_NICKNAMES, archetype) ? archetype : 'capitaine';
export const playerNamingClass = player => namingClass(PROFILES[player.profile]?.archetype ?? player.archetype);
const nameParts = name => typeof name === 'string' && /^([^"\n]+) "([^"\n]+)" ([^"\n]+)$/.exec(name);
function hash(value) { let n = 2166136261; for (const char of value) n = Math.imul(n ^ char.charCodeAt(0), 16777619) >>> 0; return n; }

export function playerName(key, used = new Set(), gender = 'neutral', archetype = 'capitaine') {
  const kind = namingGender(gender), first = FIRST_NAMES[kind], nicknames = PLAYER_NICKNAMES[namingClass(archetype)][kind], size = first.length * nicknames.length * LAST_NAMES.length, start = hash(String(key)) % size;
  for (let offset = 0; offset < size; offset++) {
    const index = (start + offset) % size, name = `${first[index % first.length]} "${nicknames[Math.floor(index / first.length) % nicknames.length]}" ${LAST_NAMES[Math.floor(index / (first.length * nicknames.length))]}`;
    if (!used.has(name)) return name;
  }
  throw new Error('Le pool de noms de joueurs est épuisé.');
}

export function playerNameMatchesGender(name, gender, archetype) {
  const parts = nameParts(name), kind = namingGender(gender), pools = archetype === undefined ? Object.values(PLAYER_NICKNAMES) : [PLAYER_NICKNAMES[namingClass(archetype)]];
  return Boolean(parts && FIRST_NAMES[kind].includes(parts[1]) && pools.some(pool => pool[kind].includes(parts[2])) && LAST_NAMES.includes(parts[3]));
}

function updatedName(previous, key, used, gender, archetype) {
  const parts = nameParts(previous), kind = namingGender(gender), nicknames = PLAYER_NICKNAMES[archetype][kind];
  if (parts && FIRST_NAMES[kind].includes(parts[1]) && LAST_NAMES.includes(parts[3])) {
    const start = hash(`${key}:nickname`) % nicknames.length;
    for (let offset = 0; offset < nicknames.length; offset++) {
      const name = `${parts[1]} "${nicknames[(start + offset) % nicknames.length]}" ${parts[3]}`;
      if (!used.has(name)) return name;
    }
  }
  return playerName(key, used, kind, archetype);
}

// Call after portrait assignment. Existing matching names remain stable.
export function normalisePlayerNames(players, namespace, genderOf) {
  const used = new Set(), pending = [];
  for (const p of players) {
    if (playerNameMatchesGender(p.name, genderOf(p), playerNamingClass(p)) && !used.has(p.name)) used.add(p.name);
    else pending.push(p);
  }
  for (const p of pending) { p.name = updatedName(p.name, `${namespace}:name:${p.id}`, used, genderOf(p), playerNamingClass(p)); used.add(p.name); }
}
