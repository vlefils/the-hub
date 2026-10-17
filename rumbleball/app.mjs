import { mountCareer } from './career-ui.mjs';
import { mountMatch } from './ui.mjs';

export function mountApp(root) {
  try {
    mountCareer(root, mountMatch);
  } catch (error) {
    const notice = document.createElement('p');
    notice.className = 'rb-error'; notice.setAttribute('role', 'alert');
    notice.textContent = `Le jeu n’a pas pu démarrer. Rechargez la page pour réessayer. ${error.message}`;
    root.replaceChildren(notice);
  }
}

const root = globalThis.document?.querySelector('[data-rumbleball]');
if (root) mountApp(root);
