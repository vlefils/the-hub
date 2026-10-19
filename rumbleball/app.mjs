import { mountSession } from './session-ui.mjs';

export const mountApp = (root, options) => mountSession(root, options);

const root = globalThis.document?.querySelector('[data-rumbleball]');
if (root) void mountApp(root);
