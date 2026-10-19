import { mountSession } from '../session-ui.mjs';
const root = globalThis.document?.querySelector('[data-online]');
if (root) void mountSession(root, { initialMode: 'multi' });
