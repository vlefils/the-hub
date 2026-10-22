import { admin, measured } from './rumbleball.ts';
export const createSoloStore = (client = admin) => ({
  async get(ownerId: string, id: string) { return measured('solo.read', client.from('rb_solo_saves').select('*').eq('owner_id', ownerId).eq('id', id).maybeSingle()); },
  async list(ownerId: string) {
    return measured('solo.list', client.from('rb_solo_saves').select('id,revision,club_name,season,completed_days,status,created_at,updated_at,forked_from,mode:career_mode,division:career_division').eq('owner_id', ownerId).order('updated_at', { ascending: false }));
  },
  async commit(ownerId: string, save: any) {
    return measured('solo.commit', client.rpc('rb_commit_solo', { p_owner_id: ownerId, p_id: save.id, p_expected_revision: save.revision,
      p_state: save.state, p_write_id: save.writeId, p_import_key: save.importKey ?? null, p_forked_from: save.forkedFrom ?? null }));
  },
});
export const soloStore = createSoloStore();
