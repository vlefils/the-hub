// Persistence only. The API still returns the original public before/after frames.
export const ROUND_FORMAT = 'rb-round-delta-v1';
export const ARCHIVE_FORMAT = 'rb-replay-gzip-v1';
export const MAX_ARCHIVE_BYTES = 32 * 1024 * 1024;
const MAX_COMPRESSED_BYTES = 8 * 1024 * 1024;
const need = ok => { if (!ok) throw new Error('Archive de rencontre invalide ou endommagée.'); };
const clone = value => structuredClone(value);
const unsafeKey = key => ['__proto__', 'constructor', 'prototype'].includes(key);

function changes(before, after, intern, path = [], out = []) {
  if (Object.is(before, after)) return out;
  if (before === null || after === null || typeof before !== 'object' || typeof after !== 'object'
    || Array.isArray(before) !== Array.isArray(after)
    || Array.isArray(before) && before.length !== after.length) {
    out.push([intern(path), after]); return out;
  }
  for (const key of Object.keys(before)) if (!Object.hasOwn(after, key)) out.push([intern([...path, key])]);
  for (const key of Object.keys(after)) {
    const at = Array.isArray(after) ? Number(key) : key;
    if (!Object.hasOwn(before, key)) out.push([intern([...path, at]), after[key]]);
    else changes(before[key], after[key], intern, [...path, at], out);
  }
  return out;
}

export function encodeRound(input) {
  if (input.format === ROUND_FORMAT) return input;
  need(input.format === undefined && Array.isArray(input.turns) && input.turns.length <= 128);
  // Database JSON has no undefined properties. Normalize before making patches.
  const { round, turns, ...metadata } = JSON.parse(JSON.stringify(input));
  const paths = [], ids = new Map();
  const intern = path => {
    const key = JSON.stringify(path);
    if (!ids.has(key)) { ids.set(key, paths.length); paths.push(path); }
    return ids.get(key);
  };
  let prior = turns[0]?.before ?? null;
  const packed = turns.map(({ before, after, events, ...extra }) => {
    const gap = changes(prior, before, intern), delta = changes(before, after, intern);
    prior = after;
    return { ...extra, ...(gap.length ? { b: gap } : {}), d: delta, e: events };
  });
  return { ...metadata, format: ROUND_FORMAT, round, base: turns[0]?.before ?? null, paths, turns: packed };
}

function apply(state, patches, paths) {
  need(Array.isArray(patches) && patches.length <= 20000);
  let next = clone(state);
  for (const patch of patches) {
    need(Array.isArray(patch) && [1, 2].includes(patch.length) && Number.isSafeInteger(patch[0]) && patch[0] >= 0 && patch[0] < paths.length);
    const path = paths[patch[0]];
    if (!path.length) { need(patch.length === 2); next = clone(patch[1]); continue; }
    let target = next;
    for (const key of path.slice(0, -1)) {
      need(target !== null && typeof target === 'object' && Object.hasOwn(target, key)); target = target[key];
    }
    need(target !== null && typeof target === 'object');
    const key = path.at(-1);
    if (Array.isArray(target)) need(Number.isSafeInteger(key) && key >= 0 && key < target.length && patch.length === 2);
    if (patch.length === 1) delete target[key]; else target[key] = clone(patch[1]);
  }
  return next;
}

export function decodeRound(input) {
  if (input.format === undefined) return input;
  need(input.format === ROUND_FORMAT && Array.isArray(input.paths) && input.paths.length <= 20000 && Array.isArray(input.turns) && input.turns.length <= 128);
  const { format, round, base, paths, turns, ...metadata } = input;
  for (const path of paths) need(Array.isArray(path) && path.length <= 32 && path.every(key => typeof key === 'string' ? !unsafeKey(key) : Number.isSafeInteger(key) && key >= 0));
  let prior = base;
  const expanded = turns.map(({ b, d, e, ...extra }) => {
    const before = b ? apply(prior, b, paths) : clone(prior), after = apply(before, d, paths);
    prior = after; return { ...extra, before, after, events: clone(e) };
  });
  return { ...metadata, round, turns: expanded };
}

export function compactReplay(replay) {
  need(replay?.initial && Array.isArray(replay.rounds) && replay.rounds.length <= 32);
  return { ...replay, rounds: replay.rounds.map(encodeRound) };
}

async function bytesFrom(stream, limit) {
  const reader = stream.getReader(), chunks = []; let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); need(false); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}
const hash = async bytes => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(n => n.toString(16).padStart(2, '0')).join('');
function base64(bytes) {
  let text = '';
  for (let at = 0; at < bytes.length; at += 32768) text += String.fromCharCode(...bytes.subarray(at, at + 32768));
  return btoa(text);
}

export async function encodeReplayArchive(replay, matchId) {
  need(typeof matchId === 'string' && matchId.length > 0 && matchId.length <= 200);
  const packed = compactReplay(replay), raw = new TextEncoder().encode(JSON.stringify(packed));
  need(raw.byteLength <= MAX_ARCHIVE_BYTES);
  const compressed = await bytesFrom(new Blob([raw]).stream().pipeThrough(new CompressionStream('gzip')), MAX_COMPRESSED_BYTES);
  return { format: ARCHIVE_FORMAT, matchId, rounds: packed.rounds.length, rawBytes: raw.byteLength, sha256: await hash(compressed), data: base64(compressed) };
}

export async function decodeReplayArchive(archive, matchId) {
  if (!archive || archive.format === undefined) return archive;
  need(archive.format === ARCHIVE_FORMAT && archive.matchId === matchId && Number.isSafeInteger(archive.rounds) && archive.rounds >= 0 && archive.rounds <= 32
    && Number.isSafeInteger(archive.rawBytes) && archive.rawBytes > 0 && archive.rawBytes <= MAX_ARCHIVE_BYTES
    && typeof archive.data === 'string' && archive.data.length <= Math.ceil(MAX_COMPRESSED_BYTES / 3) * 4
    && /^[A-Za-z0-9+/]*={0,2}$/.test(archive.data) && typeof archive.sha256 === 'string' && /^[a-f0-9]{64}$/.test(archive.sha256));
  const compressed = Uint8Array.from(atob(archive.data), ch => ch.charCodeAt(0));
  need(compressed.length <= MAX_COMPRESSED_BYTES && await hash(compressed) === archive.sha256);
  const raw = await bytesFrom(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip')), archive.rawBytes);
  need(raw.byteLength === archive.rawBytes);
  const replay = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(raw));
  need(replay?.initial && Array.isArray(replay.rounds) && replay.rounds.length === archive.rounds);
  return replay;
}

// The SQL trigger inserts this envelope and removes it from the live state in
// the same transaction. A failed commit leaves both the old state and archive.
export async function prepareLeagueCommit(state) {
  const games = state.night?.games ?? [];
  if (!games.some(game => game.settled && game.broadcast.rounds.length)) return state;
  const next = clone(state);
  for (const game of next.night.games) if (game.settled && game.broadcast.rounds.length) {
    game.broadcast.archive = await encodeReplayArchive({ initial: game.broadcast.initial, rounds: game.broadcast.rounds }, game.id);
    game.broadcast.rounds = [];
  }
  return next;
}
