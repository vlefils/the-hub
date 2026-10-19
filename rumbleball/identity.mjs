// Stable cosmetic catalogue. Never import the simulation RNG here.
import { normalisePlayerNames } from './player-names.mjs';
const asset = (path) => new URL(`./assets/broadcast/${path}`, import.meta.url).href;
export const PORTRAITS = Object.freeze([
  {
    "id": "p01",
    "gender": "female",
    "skin": "#f2c7a5",
    "hair": "#242525",
    "hairStyle": "crop"
  },
  {
    "id": "p02",
    "gender": "male",
    "skin": "#dca27c",
    "hair": "#513628",
    "hairStyle": "sweep"
  },
  {
    "id": "p03",
    "gender": "neutral",
    "skin": "#bb805b",
    "hair": "#815032",
    "hairStyle": "mohawk"
  },
  {
    "id": "p04",
    "gender": "female",
    "skin": "#975e40",
    "hair": "#cc9b4c",
    "hairStyle": "bald"
  },
  {
    "id": "p05",
    "gender": "male",
    "skin": "#704630",
    "hair": "#b5b2a6",
    "hairStyle": "bun",
    "category": "cyberpunk",
    "faceDetail": "jaw",
    "revision": "v2"
  },
  {
    "id": "p06",
    "gender": "neutral",
    "skin": "#493025",
    "hair": "#b95f42",
    "hairStyle": "braids",
    "category": "fun",
    "faceDetail": "jaw",
    "revision": "v2"
  },
  {
    "id": "p07",
    "gender": "female",
    "skin": "#f2c7a5",
    "hair": "#597b82",
    "hairStyle": "crop",
    "category": "cyberpunk",
    "faceDetail": "optic",
    "revision": "v2"
  },
  {
    "id": "p08",
    "gender": "male",
    "skin": "#dca27c",
    "hair": "#9d577e",
    "hairStyle": "sweep",
    "category": "cyberpunk",
    "faceDetail": "jaw",
    "revision": "v2"
  },
  {
    "id": "p09",
    "gender": "neutral",
    "skin": "#bb805b",
    "hair": "#242525",
    "hairStyle": "mohawk",
    "category": "fun",
    "faceDetail": "paint",
    "revision": "v2"
  },
  {
    "id": "p10",
    "gender": "female",
    "skin": "#975e40",
    "hair": "#513628",
    "hairStyle": "bald",
    "category": "fun",
    "faceDetail": "patch",
    "revision": "v2"
  },
  {
    "id": "p11",
    "gender": "male",
    "skin": "#704630",
    "hair": "#815032",
    "hairStyle": "bun",
    "category": "cyberpunk",
    "faceDetail": "optic",
    "revision": "v2"
  },
  {
    "id": "p12",
    "gender": "neutral",
    "skin": "#493025",
    "hair": "#cc9b4c",
    "hairStyle": "braids",
    "category": "fun",
    "faceDetail": "paint",
    "revision": "v2"
  },
  {
    "id": "p13",
    "gender": "female",
    "skin": "#f2c7a5",
    "hair": "#b5b2a6",
    "hairStyle": "crop",
    "category": "cyberpunk",
    "faceDetail": "optic",
    "revision": "v2"
  },
  {
    "id": "p14",
    "gender": "male",
    "skin": "#dca27c",
    "hair": "#b95f42",
    "hairStyle": "sweep",
    "category": "cyberpunk",
    "faceDetail": "jaw",
    "revision": "v2"
  },
  {
    "id": "p15",
    "gender": "neutral",
    "skin": "#bb805b",
    "hair": "#597b82",
    "hairStyle": "mohawk",
    "category": "fun",
    "faceDetail": "paint",
    "revision": "v2"
  },
  {
    "id": "p16",
    "gender": "female",
    "skin": "#975e40",
    "hair": "#9d577e",
    "hairStyle": "bald",
    "category": "cyberpunk",
    "faceDetail": "optic",
    "revision": "v2"
  },
  {
    "id": "p17",
    "gender": "male",
    "skin": "#704630",
    "hair": "#242525",
    "hairStyle": "bun",
    "category": "cyberpunk",
    "faceDetail": "jaw",
    "revision": "v2"
  },
  {
    "id": "p18",
    "gender": "neutral",
    "skin": "#493025",
    "hair": "#513628",
    "hairStyle": "braids",
    "category": "fun",
    "faceDetail": "visor",
    "revision": "v2"
  },
  {
    "id": "p19",
    "gender": "female",
    "skin": "#f2c7a5",
    "hair": "#815032",
    "hairStyle": "crop",
    "category": "cyberpunk",
    "faceDetail": "visor",
    "revision": "v2"
  },
  {
    "id": "p20",
    "gender": "male",
    "skin": "#dca27c",
    "hair": "#cc9b4c",
    "hairStyle": "sweep",
    "category": "fun",
    "faceDetail": "paint",
    "revision": "v2"
  },
  {
    "id": "p21",
    "gender": "neutral",
    "skin": "#bb805b",
    "hair": "#b5b2a6",
    "hairStyle": "mohawk",
    "category": "cyberpunk",
    "faceDetail": "optic",
    "revision": "v2"
  },
  {
    "id": "p22",
    "gender": "female",
    "skin": "#975e40",
    "hair": "#b95f42",
    "hairStyle": "bald",
    "category": "fun",
    "faceDetail": "patch",
    "revision": "v2"
  },
  {
    "id": "p23",
    "gender": "male",
    "skin": "#704630",
    "hair": "#597b82",
    "hairStyle": "bun",
    "category": "cyberpunk",
    "faceDetail": "jaw",
    "revision": "v2"
  },
  {
    "id": "p24",
    "gender": "neutral",
    "skin": "#493025",
    "hair": "#9d577e",
    "hairStyle": "braids",
    "category": "fun",
    "faceDetail": "paint",
    "revision": "v2"
  },
  {
    "id": "p25",
    "gender": "female",
    "skin": "#f2c7a5",
    "hair": "#242525",
    "hairStyle": "crop",
    "category": "cyberpunk",
    "faceDetail": "optic",
    "revision": "v2"
  },
  {
    "id": "p26",
    "gender": "male",
    "skin": "#dca27c",
    "hair": "#513628",
    "hairStyle": "sweep",
    "category": "cyberpunk",
    "faceDetail": "jaw",
    "revision": "v2"
  },
  {
    "id": "p27",
    "gender": "neutral",
    "skin": "#bb805b",
    "hair": "#815032",
    "hairStyle": "mohawk",
    "category": "fun",
    "faceDetail": "paint",
    "revision": "v2"
  },
  {
    "id": "p28",
    "gender": "female",
    "skin": "#975e40",
    "hair": "#cc9b4c",
    "hairStyle": "bald",
    "category": "cyberpunk",
    "faceDetail": "optic",
    "revision": "v2"
  },
  {
    "id": "p29",
    "gender": "male",
    "skin": "#704630",
    "hair": "#b5b2a6",
    "hairStyle": "bun",
    "category": "cyberpunk",
    "faceDetail": "optic",
    "revision": "v2"
  },
  {
    "id": "p30",
    "gender": "neutral",
    "skin": "#493025",
    "hair": "#b95f42",
    "hairStyle": "braids",
    "category": "fun",
    "faceDetail": "visor",
    "revision": "v2"
  },
  {
    "id": "p31",
    "gender": "female",
    "skin": "#f2c7a5",
    "hair": "#597b82",
    "hairStyle": "crop",
    "category": "cyberpunk",
    "faceDetail": "jaw",
    "revision": "v2"
  },
  {
    "id": "p32",
    "gender": "male",
    "skin": "#dca27c",
    "hair": "#9d577e",
    "hairStyle": "sweep",
    "category": "fun",
    "faceDetail": "optic",
    "revision": "v2"
  }
].map(p => Object.freeze({ ...p, src: asset(`portraits/${p.id}${p.revision ? `-${p.revision}` : ''}.webp`), thumb: asset(`portraits/${p.id}${p.revision ? `-${p.revision}` : ''}-small.webp`) })));
export const CRESTS = Object.freeze([
  {
    "id": "hound",
    "name": "Molosse"
  },
  {
    "id": "helmet",
    "name": "Casque"
  },
  {
    "id": "raven",
    "name": "Corbeau"
  },
  {
    "id": "circuit",
    "name": "Circuit"
  },
  {
    "id": "bolt",
    "name": "Éclair"
  },
  {
    "id": "fist",
    "name": "Poing"
  },
  {
    "id": "skull",
    "name": "Crâne"
  },
  {
    "id": "shark",
    "name": "Requin"
  },
  {
    "id": "cobra",
    "name": "Cobra"
  },
  {
    "id": "ram",
    "name": "Bélier"
  },
  {
    "id": "fox",
    "name": "Renard"
  },
  {
    "id": "gear",
    "name": "Engrenage"
  },
  {
    "id": "wings",
    "name": "Ailes"
  },
  {
    "id": "bull",
    "name": "Taureau"
  },
  {
    "id": "claw",
    "name": "Griffe"
  },
  {
    "id": "comet",
    "name": "Comète"
  }
].map(c => Object.freeze({ ...c, src: asset(`crests/${c.id}.webp`) })));
export const validPortrait = (id) => PORTRAITS.some(p => p.id === id);
export const validCrest = (id) => CRESTS.some(c => c.id === id);
export const portraitById = (id) => PORTRAITS.find(p => p.id === id) ?? null;
export const crestById = (id) => CRESTS.find(c => c.id === id) ?? CRESTS[0];
export const gearImage = id => asset(`equipment/${id}.webp`);
export const gearFallback = id => ['helmet', 'knuckles', 'tonfa', 'bat', 'maul', 'shield'].includes(id) ? new URL(`./assets/equipment/${id}.svg`, import.meta.url).href : null;
export function cosmeticHash(value) {
  let hash = 2166136261;
  for (const char of String(value)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  return hash;
}
// Mutates only a caller-owned copy. Existing identities always take precedence.
function identifyPortraits(club, namespace, market = []) {
  if (!validCrest(club.crestId)) club.crestId = CRESTS[cosmeticHash(`${namespace}:crest`) % CRESTS.length].id;
  const players = [...club.players, ...market], used = new Set(players.filter(p => validPortrait(p.portraitId)).map(p => p.portraitId));
  for (const p of players) {
    if (validPortrait(p.portraitId)) continue;
    let index = cosmeticHash(`${namespace}:portrait:${p.id}`) % PORTRAITS.length;
    const counts = new Map(PORTRAITS.map(p => [p.skin, 0]));
    for (const id of used) { const look = portraitById(id); counts.set(look.skin, counts.get(look.skin) + 1); }
    const available = PORTRAITS.filter(p => !used.has(p.id)), minimum = Math.min(...available.map(p => counts.get(p.skin)));
    if (available.length) while (used.has(PORTRAITS[index].id) || counts.get(PORTRAITS[index].skin) !== minimum) index = (index + 1) % PORTRAITS.length;
    p.portraitId = PORTRAITS[index].id; used.add(p.portraitId);
  }
  return club;
}
export const playerGender = player => portraitById(player.portraitId)?.gender ?? 'neutral';
export function identifyClub(club, namespace, market = []) {
  identifyPortraits(club, namespace, market);
  normalisePlayerNames([...club.players, ...market], namespace, playerGender);
  return club;
}
export function identifyCareer(career) {
  for (const c of career.clubs) identifyPortraits(c, `${career.seed}:${c.id}`, c.id === 'club' ? career.market : []);
  normalisePlayerNames([...career.clubs.flatMap(club => club.players), ...career.market], `${career.seed}:players`, playerGender);
  return career;
}
