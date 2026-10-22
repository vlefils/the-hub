import { stepMatch } from './engine.mjs';
import { saveCareerTurn, advanceCareerPlayoffs, launchCareerMatch } from './career.mjs';

// Pure jobs shared by the browser worker and deterministic tests. The caller
// retains its last durable snapshot until the complete result is acknowledged.
export function runSimulationJob(type, payload) {
  if (type === 'save-turn') return saveCareerTurn(payload.career, payload.state, payload.events);
  if (type === 'playoffs') return advanceCareerPlayoffs(payload.career);
  if (type === 'launch') return launchCareerMatch(payload.career);
  if (type === 'finish-career') {
    let career = payload.career;
    while (!career.current.state.finished) {
      const step = stepMatch(career.current.state);
      career = saveCareerTurn(career, step.state, step.events);
    }
    return career;
  }
  if (type === 'finish-match') {
    let state = payload.state; const turns = [];
    while (!state.finished) { const step = stepMatch(state); state = step.state; turns.push(step.events); }
    return { state, turns };
  }
  throw new Error('Calcul de rencontre inconnu.');
}
