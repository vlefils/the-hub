import { runSimulationJob } from './simulation-jobs.mjs';

self.onmessage = ({ data: { id, type, payload } }) => {
  try { self.postMessage({ id, result: runSimulationJob(type, payload) }); }
  catch (error) { self.postMessage({ id, error: error.message }); }
};
