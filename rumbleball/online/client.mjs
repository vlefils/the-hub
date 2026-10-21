export async function connectOnline(config, load = () => import('https://esm.sh/@supabase/supabase-js@2.110.8')) {
  if (!config.enabled) throw new Error('Le multijoueur est préparé ; sa base serveur doit encore être activée.');
  const { createClient } = await load();
  const supabase = createClient(config.url, config.publishableKey, { auth: { storageKey: 'rumbleball.auth.v1', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  return {
    auth: supabase.auth,
    async request(action, leagueId, payload = {}) {
      // Bound a stalled backend request; late save acknowledgements remain safe
      // because the solo outbox retries the same writeId and revision.
      const controller = new AbortController(); let timer;
      const timeout = new Promise((_, reject) => { timer = setTimeout(() => {
        controller.abort(); reject(Object.assign(new Error('Supabase ne répond pas à temps. Réessayez dans quelques instants ; votre progression locale est conservée.'), { code: 'BACKEND_TIMEOUT' }));
      }, 15000); });
      let result;
      try { result = await Promise.race([supabase.functions.invoke('rumbleball-api', { body: { action, leagueId, payload }, signal: controller.signal }), timeout]); }
      finally { clearTimeout(timer); }
      const { data, error } = result;
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
