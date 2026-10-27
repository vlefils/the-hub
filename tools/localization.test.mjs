import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const init = await readFile(new URL('i18n-init.js', root), 'utf8');
const engine = await readFile(new URL('i18n.js', root), 'utf8');
const dictionary = JSON.parse(await readFile(new URL('i18n/en.json', root), 'utf8'));
const detection = ({ browser = 'en-US', saved, query = '', unavailable = false } = {}) => {
  const context = { document: { documentElement: {} }, window: {}, navigator: { language: browser, languages: [browser] }, URLSearchParams, location: { search: query }, localStorage: { getItem() { if (unavailable) throw new Error('denied'); return saved; } } };
  vm.runInNewContext(init, context); return context.document.documentElement.lang;
};
test('language: explicit URL, saved preference, browser language, unavailable storage', () => {
  assert.equal(detection({ browser: 'fr-CA' }), 'fr'); assert.equal(detection(), 'en');
  assert.equal(detection({ browser: 'de-DE' }), 'en'); assert.equal(detection({ browser: 'en-US', saved: 'fr' }), 'fr');
  assert.equal(detection({ saved: 'fr', query: '?lang=en' }), 'en'); assert.equal(detection({ saved: 'en', query: '?lang=xx' }), 'en');
  assert.equal(detection({ browser: 'fr-FR', unavailable: true }), 'fr');
});
function fixture(language = 'fr') {
  class Element {
    constructor(tag = 'DIV', attrs = {}) { this.tagName = tag; this.attrs = attrs; this.children = []; this.dataset = {}; this.value = ''; }
    closest(selector) { if (this.attrs.translate === 'no' && selector.includes('[translate="no"]')) return this; return null; }
    matches(selector) { return selector === 'textarea[readonly]' ? this.tagName === 'TEXTAREA' && 'readonly' in this.attrs : false; }
    hasAttribute(key) { return key in this.attrs; } getAttribute(key) { return this.attrs[key]; } setAttribute(key, value) { this.attrs[key] = value; }
    querySelectorAll() { return []; } get textContent() { return this.children.map(c => c.data).join(''); }
  }
  const docNodes = [], events = [], saved = new Map();
  const document = { documentElement: { lang: language }, querySelectorAll: () => [], addEventListener() {}, dispatchEvent: e => events.push(e), createTreeWalker: root => { const nodes = root === document ? docNodes : root.children || []; let i = 0; return { currentNode: null, nextNode() { this.currentNode = nodes[i++]; return Boolean(this.currentNode); } }; } };
  const context = { document, Element, Node: { TEXT_NODE: 3 }, NodeFilter: { SHOW_TEXT: 4, FILTER_REJECT: 2, FILTER_ACCEPT: 1 }, MutationObserver: class { observe() {} }, CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init.detail; } }, URL, location: { href: 'https://example.test/hub/?article=abc#lore-zones' }, localStorage: { setItem: (k, v) => saved.set(k, v) }, history: { state: null, replaceState(state, title, url) { context.location.href = String(url); } }, window: { HUB_EN: dictionary, hubInitialLanguage: language, addEventListener() {} } };
  vm.runInNewContext(engine, context);
  const text = value => { const node = { nodeType: 3, data: value, parentElement: new Element() }; docNodes.push(node); return node; };
  return { api: context.window.HubI18n, context, text, Element, events, saved };
}
test('language: rules, authored lore, decorated links and dynamic counts', () => {
  const { api } = fixture('en');
  assert.equal(api.t('Règles'), 'Rules'); assert.equal(api.t('Sauvegardes'), 'Saving throws');
  assert.equal(api.t('← Les puissances de Paradise'), '← The powers of Paradise');
  assert.equal(api.t('3 / 30 entrées'), '3 of 30 entries');
  assert.equal(api.t('2d6 + 3'), '2d6 + 3');
  assert.equal(api.t('Mara “Rail” Voss'), 'Mara “Rail” Voss');
});
test('language: round trip restores original prose and preserves URL state', () => {
  const { api, text, context, saved } = fixture();
  const node = text('  Les puissances de Paradise  '); api.translateTree(node);
  api.setLanguage('en'); assert.equal(node.data, '  The powers of Paradise  ');
  assert.equal(context.document.documentElement.lang, 'en'); assert.equal(api.locale, 'en-GB');
  const url = new URL(context.location.href); assert.equal(url.hash, '#lore-zones'); assert.equal(url.searchParams.get('article'), 'abc'); assert.equal(url.searchParams.get('lang'), 'en');
  assert.equal(saved.get('the-hub-language'), 'en');
  api.setLanguage('fr'); assert.equal(node.data, '  Les puissances de Paradise  '); assert.equal(api.locale, 'fr-FR');
});
test('language: dynamic content, accessible labels, option values and excluded player text', () => {
  const { api, text, Element } = fixture('en');
  const dynamic = text('Règles'); api.translateTree(dynamic); assert.equal(dynamic.data, 'Rules');
  dynamic.data = 'Lutte'; api.translateTree(dynamic); assert.equal(dynamic.data, 'Grappling');
  const field = new Element('INPUT', { placeholder: 'Nom, faction, mot-clé…' }); field.value = 'Mon personnage'; api.translateTree(field);
  assert.equal(field.attrs.placeholder, 'Name, faction, keyword…'); assert.equal(field.value, 'Mon personnage');
  const option = new Element('OPTION'); option.children = [{ nodeType: 3, data: 'Règles', parentElement: option }]; api.translateTree(option);
  assert.equal(option.value, 'Règles'); assert.equal(option.children[0].data, 'Rules');
  const userText = text('Règles'); userText.parentElement.attrs.translate = 'no'; api.translateTree(userText); assert.equal(userText.data, 'Règles');
});
test('language: French rule prose is never reverse-matched as an English template', () => {
  const { api, text } = fixture('en');
  const fr = 'Une attaque touche si le resultat egale ou depasse la CA de la cible. En cas de touche, on jette les des de degats puis on ajoute le modificateur approprie si la regle de l’arme le permet.';
  const node = text(fr); api.translateTree(node);
  assert.equal(node.data, dictionary.texts[fr]);
  api.setLanguage('fr'); assert.equal(node.data, fr);
});
