import { CAREER_KEY, importCareer } from '../career-storage.mjs';

// Small in-memory DOM for event/transition tests. No browser, server or layout engine.
export class TestNode {
  constructor(tag = '#text', text = '') { this.tagName = tag; this._text = text; this.children = []; this.dataset = {}; this.attributes = {}; this.listeners = {}; this.className = ''; this.hidden = false; this.style = { values: {}, setProperty(key, value) { this.values[key] = value; }, getPropertyValue(key) { return this.values[key] ?? ''; } }; }
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
  querySelectorAll(selector) { return descendants(this).filter((n) => n.matches(selector)); }
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
export const descendants = (node) => node.children.flatMap((n) => [n, ...descendants(n)]);
export const button = (root, text) => descendants(root).find((n) => n.tagName === 'button' && n.textContent === text);
export const classNode = (root, cls) => root.querySelector(`.${cls}`);
export function installTestDOM() {
  globalThis.Node = TestNode;
  globalThis.document = { createElement: (tag) => new TestNode(tag), createElementNS: (_, tag) => new TestNode(tag), createTextNode: (text) => new TestNode('#text', text), querySelector: () => null, addEventListener() {}, hidden: false, activeElement: null };
}
export function serializeSVG(node) {
  const escape = (text) => String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
  if (node.tagName === '#text') return escape(node.textContent);
  const attributes = { ...node.attributes }; if (node.className) attributes.class = node.className;
  return `<${node.tagName}${Object.entries(attributes).map(([k, v]) => ` ${k}="${escape(v)}"`).join('')}>${escape(node._text)}${node.children.map(serializeSVG).join('')}</${node.tagName}>`;
}
export function environment(saved = null) {
  const map = new Map(saved ? [[CAREER_KEY, saved]] : []);
  const storage = { failing: false, getItem: (key) => map.get(key) ?? null, setItem(key, value) { if (this.failing) throw new Error('QuotaExceededError'); map.set(key, value); }, removeItem(key) { if (this.failing) throw new Error('SecurityError'); map.delete(key); } };
  installTestDOM();
  globalThis.window = { localStorage: storage }; globalThis.matchMedia = () => ({ matches: true });
  const section = new TestNode('section'); section.setAttribute('data-section', ''); section.classList.add('is-active'); const root = new TestNode('div'); section.append(root);
  return { root, storage, saved: () => importCareer(storage.getItem(CAREER_KEY)) };
}
