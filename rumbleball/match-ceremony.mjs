// Shared presentation timings. These never advance the match engine.
export const ENTRY_DURATION = 4500;
export const COUNTDOWN_DURATION = 3500;
export const OPENING_DURATION = ENTRY_DURATION + COUNTDOWN_DURATION;
export const EXIT_DURATION = 7000;

export function openingCue(elapsed, duration = OPENING_DURATION) {
  const countdownAt = Math.max(0, duration - COUNTDOWN_DURATION);
  if (elapsed < countdownAt) return { phase: 'entrance', label: null, ball: false, entryDuration: countdownAt };
  const remaining = duration - Math.max(countdownAt, elapsed);
  return { phase: remaining > 0 ? 'countdown' : 'playing', label: remaining > 500 ? String(Math.ceil((remaining - 500) / 1000)) : remaining > 0 ? 'START' : null,
    ball: remaining <= 500, entryDuration: countdownAt };
}
