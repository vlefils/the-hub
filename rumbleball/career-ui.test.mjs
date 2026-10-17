import test from 'node:test';
import assert from 'node:assert/strict';
import { mountCareer } from './career-ui.mjs';
import { CAREER_KEY, importCareer } from './career-storage.mjs';

// Small in-memory DOM for event/transition tests. No browser, server or layout engine.
class TestNode {
  constructor(tag = '#text', text = '') { this.tagName = tag; this._text = text; this.children = []; this.dataset = {}; this.attributes = {}; this.listeners = {}; this.className = ''; this.hidden = false; }
  get textContent() { return this._text + this.children.map((c) => c.textContent).join(''); }
  set textContent(text) { this._text = String(text); this.children = []; }
  get lastChild() { return this.children.at(-1); }
  get value() { return this._value ?? (this.tagName === 'select' ? (this.children.find((c) => c.selected) ?? this.children[0])?.value : '') ?? ''; }
  set value(value) { this._value = String(value); }
  get classList() { return { contains: (c) => this.className.split(' ').includes(c), add: (...cs) => { for (const c of cs) if (!this.classList.contains(c)) this.className += ` ${c}`; }, toggle: (c, value) => { const set = new Set(this.className.split(' ').filter(Boolean)); if (value ?? !set.has(c)) set.add(c); else set.delete(c); this.className = [...set].join(' '); } }; }
  append(...nodes) { for (let node of nodes) { if (!(node instanceof TestNode)) node = new TestNode('#text', String(node)); node.parentNode = this; this.children.push(node); } }
  prepend(node) { node.parentNode = this; this.children.unshift(node); }
  replaceChildren(...nodes) { this._text = ''; this.children = []; this.append(...nodes); }
  setAttribute(key, value) { this.attributes[key] = String(value); if (key === 'class') this.className = String(value); }
  getAttribute(key) { return this.attributes[key]; }
  matches(selector) { return selector[0] === '.' ? this.classList.contains(selector.slice(1)) : selector === '[hidden]' ? this.hidden : selector[0] === '[' ? Object.hasOwn(this.attributes, selector.slice(1, -1)) : this.tagName === selector; }
  querySelector(selector) { return descendants(this).find((n) => n.matches(selector)) ?? null; }
  closest(selector) { return this.matches(selector) ? this : this.parentNode?.closest(selector) ?? null; }
  contains(node) { return node === this || descendants(this).includes(node); }
  addEventListener(type, action) { (this.listeners[type] ??= []).push(action); }
  emit(type, extra = {}) {
    const event = { type, target: this, preventDefault() {}, ...extra }, pending = [];
    for (let node = this; node; node = node.parentNode) for (const listener of node.listeners[type] ?? []) pending.push(listener(event));
    return Promise.all(pending);
  }
  click() { if (!this.disabled) return this.emit('click'); }
  focus() { document.activeElement = this; }
  scrollIntoView() {}
  showModal() { this.open = true; }
  close() { this.open = false; }
  remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter((n) => n !== this); }
}
const descendants = (node) => node.children.flatMap((n) => [n, ...descendants(n)]);
const button = (root, text) => descendants(root).find((n) => n.tagName === 'button' && n.textContent === text);
const classNode = (root, cls) => root.querySelector(`.${cls}`);
function environment(saved = null) {
  const map = new Map(saved ? [[CAREER_KEY, saved]] : []);
  const storage = { failing: false, getItem: (key) => map.get(key) ?? null, setItem(key, value) { if (this.failing) throw new Error('QuotaExceededError'); map.set(key, value); } };
  globalThis.Node = TestNode;
  globalThis.document = { createElement: (tag) => new TestNode(tag), createElementNS: (_, tag) => new TestNode(tag), createTextNode: (text) => new TestNode('#text', text), querySelector: () => null, addEventListener() {}, hidden: false, activeElement: null };
  globalThis.window = { localStorage: storage }; globalThis.matchMedia = () => ({ matches: true });
  const section = new TestNode('section'); section.setAttribute('data-section', ''); section.classList.add('is-active'); const root = new TestNode('div'); section.append(root);
  return { root, storage, saved: () => importCareer(storage.getItem(CAREER_KEY)) };
}
async function foundClub(root) {
  const form = classNode(root, 'rb-career-create'); form.querySelector('input').value = 'Un nom de club très long pour tester la vraie composition de gestion'; await form.emit('submit');
  const checks = descendants(classNode(root, 'rb-candidate-list')).filter((n) => n.type === 'checkbox');
  for (const check of checks.slice(0, 5)) { check.checked = true; await check.emit('change'); }
  await button(root, 'Valider les contrats').click();
}

test('parcours UI : création, échange de titulaires, consignes, équipement et lecture seule en match', async () => {
  const e = environment(); const { mountMatch } = await import('./ui.mjs'); mountCareer(e.root, mountMatch); await foundClub(e.root);
  let c = e.saved(); assert.equal(c.balance, 900); assert.equal(c.lineup.length, 5);
  const form = classNode(e.root, 'rb-lineup-form'), slots = descendants(classNode(e.root, 'rb-lineup-slots')).filter((n) => n.tagName === 'select');
  const [first, second] = c.lineup; slots[0].value = second; await slots[0].emit('change');
  c = e.saved(); assert.deepEqual(c.lineup.slice(0, 2), [second, first]);
  const strategy = form.querySelector('select'); strategy.value = 'pressing'; await strategy.emit('change'); assert.equal(e.saved().clubs[0].strategy, 'pressing');
  await button(e.root, 'Équipement').click();
  const buyVest = descendants(e.root).find((n) => n.tagName === 'button' && n.textContent.startsWith('Acheter pour') && n.textContent.endsWith('100 chromas'));
  await buyVest.click(); assert.equal(e.saved().inventory.length, 1); assert.equal(e.saved().balance, 800);
  const play = descendants(e.root).find((n) => n.tagName === 'button' && n.textContent.startsWith('Jouer ·')); await play.click();
  assert.equal(e.saved().balance, 725); assert.equal(e.saved().current.state.turns, 0);
  // The real match reader receives the club names and compiled stats.
  assert.match(classNode(e.root, 'rb-scoreboard').textContent, /Un nom de club/);
  await button(e.root, 'Tour suivant').click(); assert.equal(e.saved().current.state.turns, 1);
  await button(e.root, 'Retour au club · mettre en pause').click();
  assert.match(classNode(e.root, 'rb-next-match').textContent, /lecture seule/);
  assert.ok(descendants(classNode(e.root, 'rb-shop')).filter((n) => n.tagName === 'button').every((n) => n.disabled));
  await button(e.root, 'Reprendre la rencontre').click(); assert.equal(e.saved().balance, 725);
  assert.match(classNode(e.root, 'rb-playback-status').textContent, /Pause/);
  await button(e.root, 'Voir le résultat').click(); c = e.saved(); assert.equal(c.current.settled, true); assert.equal(c.day, 1);
  const rewarded = c.balance; await button(e.root, 'Voir le bilan de la journée').click();
  await button(e.root, 'Revoir le terrain et le fil du match · sans récompense supplémentaire').click(); assert.equal(e.saved().balance, rewarded);
  await button(e.root, 'Voir le bilan de la journée').click(); await button(e.root, 'Exhibition').click();
  assert.equal(classNode(e.root, 'rb-setup').hidden, false); assert.equal(e.saved().balance, rewarded);
  await button(e.root, 'Carrière').click(); assert.equal(e.saved().day, 1);
});

test('UI : échec de sauvegarde visible, reprise en pause et remplacement JSON explicite', async () => {
  const e = environment(); const { mountMatch } = await import('./ui.mjs'); mountCareer(e.root, mountMatch); await foundClub(e.root);
  let play = descendants(e.root).find((n) => n.tagName === 'button' && n.textContent.startsWith('Jouer ·')); await play.click();
  const valid = e.storage.getItem(CAREER_KEY); e.storage.failing = true;
  await button(e.root, 'Tour suivant').click(); assert.equal(e.storage.getItem(CAREER_KEY), valid);
  assert.match(classNode(e.root, 'rb-career-notice').textContent, /Progression non enregistrée/); assert.match(classNode(e.root, 'rb-error').textContent, /non enregistrée/);
  await button(e.root, 'Retour au club · mettre en pause').click(); e.storage.failing = false; await button(e.root, 'Réessayer la sauvegarde').click();
  assert.equal(e.saved().current.state.turns, 1); assert.equal(e.saved().transactions.filter((t) => t.label === 'Salaires de la journée').length, 1);
  const save = e.storage.getItem(CAREER_KEY); const restored = environment(save); mountCareer(restored.root, mountMatch);
  await button(restored.root, 'Reprendre la rencontre').click(); assert.match(classNode(restored.root, 'rb-playback-status').textContent, /Pause/);
  await button(restored.root, 'Voir le résultat').click(); await button(restored.root, 'Voir le bilan de la journée').click();
  const fileInput = descendants(restored.root).find((n) => n.type === 'file'), before = restored.storage.getItem(CAREER_KEY);
  fileInput.files = [{ size: before.length, text: async () => before }]; await fileInput.emit('change');
  assert.equal(classNode(restored.root, 'rb-career-import').hidden, false); assert.equal(restored.storage.getItem(CAREER_KEY), before);
  await button(restored.root, 'Annuler').click(); assert.equal(restored.storage.getItem(CAREER_KEY), before);
  fileInput.files = [{ size: before.length, text: async () => before }]; await fileInput.emit('change'); await button(restored.root, 'Confirmer le remplacement').click();
  assert.equal(restored.saved().balance, importCareer(before).balance); assert.equal(classNode(restored.root, 'rb-career-import').hidden, true);
  fileInput.files = [{ size: 2, text: async () => '{}' }]; await fileInput.emit('change'); assert.match(classNode(restored.root, 'rb-career-notice').textContent, /Import refusé/);
});
