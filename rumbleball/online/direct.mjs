// Only published fixtures and frames drive this clock. No local match simulation.
const time = value => value ? Date.parse(value) : NaN;
export function directState(league, now) {
  const games = league.games ?? [], broadcasting = league.status === 'broadcast';
  const previous = [...games].reverse().find(game => time(game.endsAt) <= now);
  const active = broadcasting && games.find(game => time(game.startsAt) <= now && !(time(game.endsAt) <= now));
  const next = broadcasting ? games.find(game => time(game.startsAt) > now) : league.upcoming?.[0];
  if (active) return { phase: now < time(active.playsAt) ? 'entrance' : league.waitingForServer || !league.broadcast ? 'delayed' : 'live',
    match: active, previous, deadline: now < time(active.playsAt) ? active.playsAt : null };
  if (broadcasting && previous && next) return { phase: 'break', match: next, previous, deadline: next.startsAt };
  if (broadcasting) return { phase: 'ended', previous, match: null, deadline: null };
  return { phase: time(league.nextLockAt) <= now ? 'delayed' : 'before', match: next, previous, deadline: league.nextLockAt };
}
export function countdown(deadline, now) {
  const seconds = Math.max(0, Math.ceil((time(deadline) - now) / 1000));
  if (!Number.isFinite(seconds)) return '—';
  const h = Math.floor(seconds / 3600), m = Math.floor(seconds / 60) % 60, s = seconds % 60;
  return `${h ? `${h}:` : ''}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
