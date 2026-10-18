import { ONLINE_CONFIG } from './config.mjs';
import { connectOnline } from './client.mjs';
import { mountOnline } from './ui.mjs';
const root = globalThis.document?.querySelector('[data-online]');
if (root) mountOnline(root, ONLINE_CONFIG, connectOnline);
