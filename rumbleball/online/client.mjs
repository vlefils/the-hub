export async function connectOnline(config, load = () => import('https://esm.sh/@supabase/supabase-js@2.110.8')) {
  if (!config.enabled) throw new Error('Le multijoueur est préparé ; sa base serveur doit encore être activée.');
  const { createClient } = await load();
  const supabase = createClient(config.url, config.publishableKey, { auth: { storageKey: 'rumbleball.auth.v1', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  return {
    auth: supabase.auth,
    async request(action, leagueId, payload = {}) {
      const { data, error } = await supabase.functions.invoke('rumbleball-api', { body: { action, leagueId, payload } });
      if (error) {
        let message = error.message, code;
        try { const details = await error.context.json(); message = details.error ?? message; code = details.code; } catch {}
        throw Object.assign(new Error(message), { code });
      }
      if (data.error) throw new Error(data.error);
      return data;
    },
  };
}
