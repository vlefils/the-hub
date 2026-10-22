// Browser Worker bridge for the real module, used only by Node integration tests.
import { parentPort } from 'node:worker_threads';
globalThis.self = { postMessage: value => parentPort.postMessage(value) };
await import('../simulation-worker.mjs');
parentPort.on('message', data => self.onmessage({ data }));
