// Presentation only: the countdown never advances the engine or its random state.
const cues = [
  { label: '3', duration: 1000 },
  { label: '2', duration: 1000 },
  { label: '1', duration: 1000 },
  { label: 'START', duration: 500, ball: true },
];

export function createKickoff(onCue, onComplete) {
  let index = -1, timer = null, generation = 0, playing = false, remaining = 0, due = 0;
  const active = () => index >= 0;
  function clear() { generation++; clearTimeout(timer); timer = null; }
  function schedule() {
    clear(); due = performance.now() + remaining;
    const token = generation;
    timer = setTimeout(() => {
      if (token !== generation || !playing) return;
      timer = null; index++;
      if (index === cues.length) { index = -1; playing = false; onComplete(); return; }
      remaining = cues[index].duration; onCue(cues[index]); schedule();
    }, remaining);
  }
  function cancel() { clear(); index = -1; playing = false; }
  return {
    get active() { return active(); },
    get cue() { return cues[index]; },
    start() { cancel(); index = 0; remaining = cues[0].duration; onCue(cues[0]); },
    pause() { if (playing) remaining = Math.max(0, due - performance.now()); playing = false; clear(); },
    resume() { if (active() && !playing) { playing = true; schedule(); } },
    cancel,
  };
}
