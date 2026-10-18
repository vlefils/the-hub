export async function connectOnline(config, load = () => import('https://esm.sh/@supabase/supabase-js@2.110.8')) {
  if (!config.enabled) throw new Error('Le multijoueur est préparé ; sa base serveur doit encore être activée.');
  const { createClient } = await load();
  const supabase = createClient(config.url, config.publishableKey, { auth: { storageKey: 'rumbleball.auth.v1', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  return {
    auth: supabase.auth,
    async request(action, leagueId, payload = {}) {
      const { data, error } = await supabase.functions.invoke('rumbleball-api', { body: { action, leagueId, payload } });
      if (error) {
        let message = error.message;
        try { message = (await error.context.json()).error ?? message; } catch {}
        throw new Error(message);
      }
      if (data.error) throw new Error(data.error);
      return data;
    },
  };
}
