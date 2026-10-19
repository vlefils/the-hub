import { el, btn } from './career-components.mjs';

let sequence = 0;
export function managementDialog(host, onClose = () => {}) {
  const root = el('dialog', 'rb-management-dialog'), heading = el('h2'), header = el('header', 'rb-modal-header'), body = el('div', 'rb-modal-body'), notice = el('p', 'rb-modal-notice');
  heading.id = `rb-modal-title-${++sequence}`; root.setAttribute('aria-labelledby', heading.id); notice.setAttribute('role', 'alert'); notice.hidden = root.hidden = true;
  let visible = false, opener;
  function finish() {
    if (!visible) return;
    visible = false; root.hidden = true; onClose();
    const replacement = opener?.dataset.focusKey && [...host.querySelectorAll('button')].find(button => button.dataset.focusKey === opener.dataset.focusKey);
    const connected = opener?.isConnected ?? host.contains(opener);
    (connected && !opener.closest('[hidden]') ? opener : replacement ?? host.querySelector('.rb-recruit-tile'))?.focus({ preventScroll: true });
  }
  function close() { if (root.open) root.close(); finish(); }
  const dismiss = btn('Fermer', close); dismiss.classList.add('rb-modal-close');
  header.append(heading, dismiss); root.append(header, notice, body); host.append(root);
  root.addEventListener('cancel', event => { event.preventDefault(); close(); }); root.addEventListener('close', finish);
  root.addEventListener('click', event => { if (event.target === root) close(); });
  return { root, body, close, get visible() { return visible; }, show(title, trigger = document.activeElement) {
    heading.textContent = title; if (visible) return;
    opener = trigger; visible = true; root.hidden = false; notice.hidden = true;
    if (root.showModal) root.showModal(); else { root.open = true; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); }
    dismiss.focus();
  }, message(text) { notice.textContent = text; notice.hidden = !text; } };
}
