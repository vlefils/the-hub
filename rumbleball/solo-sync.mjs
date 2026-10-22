import { CAREER_KEY, serializeCareer, importCareer } from './career-storage.mjs';

const CACHE = 'the-hub.rumbleball.solo-cache.v1:', PENDING = 'the-hub.rumbleball.solo-pending.v1:';
const CLAIM = 'the-hub.rumbleball.legacy-owner.v1';
const keys = storage => Array.from({ length: storage.length }, (_, i) => storage.key(i)).filter(Boolean);
const cacheKey = (owner, id) => `${CACHE}${owner}:${id}`;
const pendingKey = record => `${PENDING}${record.ownerId}:${record.workspaceId}`;
const jsonOf = game => game.state ? serializeCareer(game.state) : null;
const gameOf = record => {
  const state = record.json ? importCareer(record.json) : null;
  return { id: record.id, revision: record.revision, state, clubName: state?.clubs[0].name ?? 'Nouvelle partie', season: state?.season ?? null,
    mode: state?.mode ?? 'classic', division: state?.longCareer?.division ?? null,
    completedDays: state?.completedDays ?? 0, status: state?.status ?? 'empty', updatedAt: record.updatedAt, isCopy: Boolean(record.forkedFrom || record.isCopy), pending: Boolean(record.pending) };
};
export async function accountRequest(client, owner, action, payload = {}) {
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  if (data.session?.user.id !== owner) throw new Error('Reconnectez-vous au compte de cette partie pour la synchroniser.');
  return client.request(action, undefined, { ...payload, accountId: owner });
}
function localRecords(storage, owner) {
  const records = [];
  for (const key of keys(storage).filter(key => key.startsWith(`${CACHE}${owner}:`) || key.startsWith(`${PENDING}${owner}:`))) {
    const record = JSON.parse(storage.getItem(key));
    if (record.ownerId === owner && !record.legacyBackup) records.push(record);
  }
  return records;
}
export function localSoloGames(storage, owner) {
  const games = new Map();
  for (const record of localRecords(storage, owner)) {
    const current = games.get(record.id);
    if (!current || record.pending && !current.record.pending || Boolean(record.pending) === Boolean(current.record.pending) && record.updatedAt > current.record.updatedAt) games.set(record.id, { game: gameOf(record), record });
  }
  return [...games.values()];
}
export function cacheSoloGame(storage, owner, game) {
  storage.setItem(cacheKey(owner, game.id), JSON.stringify({ version: 1, ownerId: owner, id: game.id, revision: game.revision,
    json: jsonOf(game), updatedAt: game.updatedAt, isCopy: game.isCopy, pending: false }));
}

// Each open tab has its own durable outbox. Two tabs cannot replace each other's
// unsent changes; the server revision turns a divergent edit into a separate game.
export function createSoloSync(client, owner, storage, game, { record: restored, uuid = () => crypto.randomUUID(), delay = 400, retryDelay = 15000 } = {}) {
  let record = restored ? structuredClone(restored) : { version: 1, ownerId: owner, workspaceId: uuid(), id: game.id, revision: game.revision,
    json: jsonOf(game), updatedAt: game.updatedAt, pending: false };
  record.workspaceId ??= uuid();
  let timer, running, closed = false, copied = Boolean(record.forkedFrom), status = { kind: record.pending ? 'pending' : 'saved', message: record.pending ? 'Progression locale à synchroniser.' : 'Sauvegardé sur votre compte.' };
  const listeners = new Set();
  const emit = (kind, message) => { status = { kind, message }; if (!closed) for (const listener of listeners) listener(status); };
  const persistPending = next => storage.setItem(pendingKey(next), JSON.stringify(next));
  const schedule = ms => { clearTimeout(timer); if (!closed) timer = setTimeout(() => { void flush(); }, ms); };
  function write(json) {
    if (closed) throw new Error('Cette partie est fermée.');
    if (record.json !== json || !record.pending) {
      if (record.json === json && !record.pending) return;
      const next = { ...record, json, pending: true, writeId: uuid(), updatedAt: new Date().toISOString() };
      persistPending(next); record = next;
    }
    emit('pending', 'Sauvegarde en cours · copie locale conservée.'); schedule(delay);
  }
  async function drain() {
    while (record.pending && !closed) {
      const sent = structuredClone(record);
      try {
        const { saved } = await accountRequest(client, owner, 'solo_save', { id: sent.id, revision: sent.revision, writeId: sent.writeId, json: sent.json, forkedFrom: sent.forkedFrom });
        record.revision = saved.revision;
        if (record.writeId === sent.writeId) {
          record.pending = false; record.updatedAt = saved.updatedAt;
          // The server acknowledged this exact snapshot before its outbox is removed.
          try { storage.removeItem(pendingKey(record)); storage.setItem(cacheKey(owner, record.id), JSON.stringify(record)); } catch { /* The confirmed state remains durable on the server. */ }
          emit('saved', copied ? 'Progression sauvegardée dans une copie : une autre version existait déjà.' : 'Sauvegardé sur votre compte.');
        } else persistPending(record);
      } catch (error) {
        if (error.code === 'SOLO_CONFLICT') {
          const next = { ...record, id: uuid(), revision: 0, writeId: uuid(), forkedFrom: record.forkedFrom ?? record.id };
          persistPending(next); record = next; copied = true;
          emit('pending', 'Une autre version existe. Enregistrement dans une partie séparée…');
          continue;
        }
        emit('error', `Synchronisation en attente : ${error.message} Votre progression reste sur cet appareil.`);
        schedule(retryDelay); return false;
      }
    }
    return !record.pending;
  }
  function flush() {
    clearTimeout(timer);
    if (closed) return Promise.resolve(false);
    if (!running) running = drain().catch(error => { emit('error', `Synchronisation en attente : ${error.message} La copie locale est conservée.`); return false; }).finally(() => { running = null; });
    return running;
  }
  const onOnline = () => { void flush(); };
  globalThis.window?.addEventListener?.('online', onOnline);
  if (record.pending) schedule(delay);
  return { storage: {
    getItem: key => key === CAREER_KEY ? record.json : storage.getItem(key),
    setItem: (key, json) => { if (key === CAREER_KEY) write(json); else storage.setItem(key, json); },
    removeItem: key => { if (key === CAREER_KEY) write(null); else storage.removeItem(key); },
  }, flush, status: () => status, record: () => structuredClone(record),
  subscribe(listener) { listeners.add(listener); listener(status); return () => listeners.delete(listener); },
  stop() { closed = true; clearTimeout(timer); listeners.clear(); globalThis.window?.removeEventListener?.('online', onOnline); } };
}

export async function recoverSoloGames(client, owner, storage) {
  const messages = [];
  for (const record of localRecords(storage, owner).filter(record => record.pending)) {
    const sync = createSoloSync(client, owner, storage, gameOf(record), { record });
    try { await sync.flush(); if (sync.status().kind === 'error' || sync.record().id !== record.id) messages.push(sync.status().message); }
    finally { sync.stop(); }
  }
  const raw = storage.getItem(CAREER_KEY);
  if (!raw) return messages;
  const claim = JSON.parse(storage.getItem(CLAIM) ?? 'null');
  if (claim && claim.ownerId !== owner) { messages.push('Une ancienne partie locale appartient à un autre compte et reste sur cet appareil.'); return messages; }
  importCareer(raw);
  storage.setItem(CLAIM, JSON.stringify({ ownerId: owner }));
  // Keep the original until the upload is acknowledged, including when the
  // browser has insufficient space for a second full local copy.
  const { game } = await accountRequest(client, owner, 'solo_import', { json: raw });
  try { cacheSoloGame(storage, owner, game); } catch { /* Retry after freeing the legacy slot. */ }
  if (storage.getItem(CAREER_KEY) === raw) storage.removeItem(CAREER_KEY);
  try { cacheSoloGame(storage, owner, game); } catch { /* The imported game is already durable on the account. */ }
  messages.push(`La partie locale « ${game.clubName} » a été sauvegardée sur votre compte.`);
  return messages;
}
