// Created lazily: opening a club or following a live match starts no worker.
export function createBackgroundSimulation({ createWorker = globalThis.Worker
  ? () => new Worker(new URL('./simulation-worker.mjs?v=20261022-performance', import.meta.url), { type: 'module' }) : null } = {}) {
  let worker, serial = 0, stopped = false;
  const pending = new Map();
  function fail(error) {
    const previous = worker; worker = null; previous?.terminate();
    for (const { reject, timer } of pending.values()) { clearTimeout(timer); reject(error); }
    pending.clear();
  }
  return {
    available: Boolean(createWorker),
    run(type, payload) {
      if (stopped) return Promise.reject(new Error('Cette partie est fermée.'));
      if (!createWorker) return Promise.reject(new Error('Les calculs en arrière-plan ne sont pas disponibles.'));
      return new Promise((resolve, reject) => {
        try {
          if (!worker) {
            const instance = worker = createWorker();
            instance.onmessage = ({ data }) => {
              if (worker !== instance) return;
              const job = pending.get(data?.id); if (!job) return;
              clearTimeout(job.timer); pending.delete(data.id);
              if (data.error) job.reject(new Error(data.error)); else job.resolve(data.result);
            };
            instance.onerror = () => { if (worker === instance) fail(new Error('Le calcul a été interrompu. Votre dernière sauvegarde est conservée.')); };
            instance.onmessageerror = () => { if (worker === instance) fail(new Error('Résultat de calcul illisible. Votre dernière sauvegarde est conservée.')); };
          }
          const id = ++serial, timer = setTimeout(() => { if (pending.has(id)) fail(new Error('Le calcul a dépassé son délai. Réessayez depuis votre dernière sauvegarde.')); }, 30000);
          pending.set(id, { resolve, reject, timer }); worker.postMessage({ id, type, payload });
        } catch (error) { fail(error); reject(error); }
      });
    },
    stop() { stopped = true; fail(new Error('Cette partie est fermée.')); },
  };
}
