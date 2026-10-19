import { createSoloService } from '../online/solo-service.mjs';
export class MemoryStorage {
  constructor() { this.map = new Map(); this.failing = false; }
  get length() { return this.map.size; }
  key(index) { return [...this.map.keys()][index] ?? null; }
  getItem(key) { return this.map.get(key) ?? null; }
  setItem(key, value) { if (this.failing) throw new Error('Quota dépassé'); this.map.set(key, value); }
  removeItem(key) { if (this.failing) throw new Error('Stockage indisponible'); this.map.delete(key); }
}
export function soloTestService() {
  const rows = new Map();
  const store = {
    async get(owner, id) { const row = rows.get(id); return row?.owner_id === owner ? structuredClone(row) : null; },
    async list(owner) { return [...rows.values()].filter(row => row.owner_id === owner).map(row => structuredClone(row)); },
    async commit(owner, p) {
      if (p.importKey) {
        const imported = [...rows.values()].find(row => row.owner_id === owner && row.import_key === p.importKey);
        if (imported) return { id: imported.id, revision: imported.revision, updatedAt: imported.updated_at, alreadyImported: true };
      }
      const old = rows.get(p.id);
      if (old && old.owner_id !== owner) throw new Error('RB_SOLO_NOT_FOUND');
      if (old?.last_write_id === p.writeId) return { id: old.id, revision: old.revision, updatedAt: old.updated_at };
      if (old && old.revision !== p.revision) throw new Error('RB_SOLO_CONFLICT');
      if (!old && p.revision !== 0) throw new Error('RB_SOLO_NOT_FOUND');
      if (p.forkedFrom && rows.get(p.forkedFrom)?.owner_id !== owner) throw new Error('RB_SOLO_NOT_FOUND');
      const row = { id: p.id, owner_id: owner, state: structuredClone(p.state), revision: (old?.revision ?? 0) + 1,
        import_key: old?.import_key ?? p.importKey, forked_from: old?.forked_from ?? p.forkedFrom,
        last_write_id: p.writeId, created_at: old?.created_at ?? new Date().toISOString(), updated_at: new Date().toISOString() };
      rows.set(p.id, row); return { id: row.id, revision: row.revision, updatedAt: row.updated_at };
    },
  };
  const service = createSoloService(store);
  const command = (owner, action, payload = {}) => service.command(owner, { action, payload: { ...payload, accountId: owner } });
  const client = owner => ({ auth: { async getSession() { return { data: { session: { user: { id: owner } } } }; } }, request: (action, id, payload) => service.command(owner, { action, payload }) });
  return { rows, store, service, command, client };
}
