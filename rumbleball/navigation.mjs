// Device navigation is separate from game saves and scoped to the signed-in account.
const key = owner => `rumbleball.navigation.v1:${owner}`;
export function navigation(value) {
  if (value?.mode === 'home') return { mode: 'home' };
  if (!['solo', 'multi'].includes(value?.mode)) return null;
  const id = typeof value.id === 'string' && value.id.length <= 200 ? value.id : null;
  if (value.mode === 'solo' && !id) return null;
  const screens = value.mode === 'solo' ? ['Club', 'Ligue', 'match', 'exhibition'] : ['Club', 'Ligue', 'Direct'];
  const result = { mode: value.mode, id, screen: screens.includes(value.screen) ? value.screen : 'Club' };
  if (value.mode === 'multi' && id && typeof value.replayId === 'string' && value.replayId.length <= 200) {
    result.screen = 'Ligue'; result.replayId = value.replayId;
  }
  return result;
}
export function readNavigation(storage, owner) {
  try { return navigation(JSON.parse(storage.getItem(key(owner)))); } catch { return null; }
}
export function saveNavigation(storage, owner, value) {
  try {
    const next = JSON.stringify(navigation(value));
    if (storage.getItem(key(owner)) !== next) storage.setItem(key(owner), next);
  } catch { /* Navigation must never prevent playing or saving a game. */ }
}
