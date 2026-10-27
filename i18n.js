// Offline localization. Source text stays in French; presentation never changes game data.
(() => {
  const dictionary = window.HUB_EN || { texts: {}, templates: [] };
  const normalize = text => String(text).replace(/\s+/g, ' ').trim();
  const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const texts = dictionary.texts;
  const reverse = new Map();
  for (const [fr, en] of Object.entries(texts)) if (!reverse.has(en)) reverse.set(en, fr);
  const compile = (from, to) => {
    const tokens = [...from.matchAll(/\{\{(\d+)\}\}/g)];
    if (!tokens.length || from.replace(/\{\{\d+\}\}/g, '').replace(/[^a-zÀ-ÿ]/gi, '').length < 5) return null;
    let offset = 0, pattern = '^';
    const ids = [];
    for (const match of tokens) { pattern += escape(from.slice(offset, match.index)) + '(.+?)'; ids.push(match[1]); offset = match.index + match[0].length; }
    pattern += escape(from.slice(offset)) + '$';
    return { re: new RegExp(pattern), to, ids, weight: from.length - tokens.length * 5 };
  };
  const patterns = (dictionary.templates || []).filter(([fr, en]) => fr !== en).map(([fr, en]) => compile(fr, en)).filter(Boolean).sort((a, b) => b.weight - a.weight);
  const backPatterns = (dictionary.templates || []).filter(([fr, en]) => fr !== en).map(([fr, en]) => compile(en, fr)).filter(Boolean).sort((a, b) => b.weight - a.weight);
  const patternText = (text, list) => {
    for (const { re, to, ids } of list) {
      const match = re.exec(text);
      if (match) return to.replace(/\{\{(\d+)\}\}/g, (_, id) => match[ids.indexOf(id) + 1] ?? '');
    }
    return text;
  };
  const translate = (text, lang = 'en', depth = 0) => {
    if (typeof text !== 'string' || !text.trim()) return text;
    const key = normalize(text);
    let value = lang === 'en' ? texts[key] : reverse.get(key);
    if (value == null) value = patternText(key, lang === 'en' ? patterns : backPatterns);
    if (value === key && depth < 2) {
      const decorated = /^([←→↗\s]*)(.*?)([\s←→↗]*)$/.exec(key);
      if (decorated && decorated[2] !== key) value = decorated[1] + translate(decorated[2], lang, depth + 1) + decorated[3];
    }
    if (value === key && depth < 2) {
      value = key.split(/( · | — | → | ↗| \| | \/ |\n)/).map(part => /[a-zÀ-ÿ]/i.test(part) && part !== key ? translate(part, lang, depth + 1) : part).join('');
      if (value === key) {
        const counted = /^(.*?)(\s+[\d.,]+(?:\s*\/\s*[\d.,]+)?)(.*)$/.exec(key);
        if (counted && counted[1]) value = translate(counted[1], lang, depth + 1) + counted[2] + (counted[3] ? translate(counted[3], lang, depth + 1) : '');
      }
    }
    return text.slice(0, text.indexOf(text.trim())) + value + text.slice(text.indexOf(text.trim()) + text.trim().length);
  };
  const records = new WeakMap();
  const attributeRecords = new WeakMap();
  const readonlyRecords = new WeakMap();
  const originalText = text => {
    const key = normalize(text);
    // Source prose must never be mistaken for a loosely matching English template.
    if (Object.hasOwn(texts, key) || patternText(key, patterns) !== key) return text;
    return language === 'en' ? translate(text, 'fr') : text;
  };
  const excluded = 'script, style, code, pre, textarea, [contenteditable], [translate="no"], [data-no-translate], .language-switch';
  const attributes = ['aria-label', 'aria-description', 'aria-valuetext', 'title', 'placeholder', 'alt'];
  let language = window.hubInitialLanguage || 'fr';
  const translateNode = node => {
    if (!node.parentElement || node.parentElement.closest(excluded) || !node.data.trim()) return;
    let record = records.get(node);
    if (!record || (node.data !== record.fr && node.data !== record.en)) {
      const fr = originalText(node.data);
      record = { fr, en: translate(fr) }; records.set(node, record);
    }
    const next = record[language];
    if (node.data !== next) node.data = next;
  };
  const translateAttributes = element => {
    if (element.matches('textarea[readonly]')) {
      let record = readonlyRecords.get(element);
      if (!record) { const fr = element.value; record = { fr, en: fr.split('\n').map(line => translate(line)).join('\n') }; readonlyRecords.set(element, record); }
      if (element.value !== record[language]) element.value = record[language];
      if (element.textContent !== record[language]) element.textContent = record[language];
    }
    if (element.closest(excluded)) return;
    // Translating option text must never change its submitted value.
    if (element.tagName === 'OPTION' && !element.hasAttribute('value')) element.value = element.textContent;
    let saved = attributeRecords.get(element);
    if (!saved) { saved = {}; attributeRecords.set(element, saved); }
    for (const attr of attributes) {
      if (!element.hasAttribute(attr)) continue;
      const current = element.getAttribute(attr);
      if (!saved[attr] || ![saved[attr].fr, saved[attr].en].includes(current)) {
        const fr = originalText(current);
        saved[attr] = { fr, en: translate(fr) };
      }
      const value = saved[attr][language];
      if (value !== current) element.setAttribute(attr, value);
    }
    if (element.matches('meta[name="description"]')) {
      const current = element.content;
      if (!saved.content) saved.content = { fr: current, en: translate(current) };
      element.content = saved.content[language];
    }
  };
  const translateTree = root => {
    if (root.nodeType === Node.TEXT_NODE) return translateNode(root);
    if (!(root instanceof Element) && root !== document) return;
    if (root instanceof Element) translateAttributes(root);
    root.querySelectorAll?.('[aria-label], [aria-description], [aria-valuetext], [title], [placeholder], [alt], option, meta[name="description"], textarea[readonly]').forEach(translateAttributes);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: node => node.parentElement?.closest(excluded) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
    while (walker.nextNode()) translateNode(walker.currentNode);
  };
  const syncButtons = () => document.querySelectorAll('[data-language]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.language === language)));
  const setLanguage = (next, persist = true) => {
    if (!['fr', 'en'].includes(next)) return;
    language = next;
    document.documentElement.lang = next;
    if (persist) {
      try { localStorage.setItem('the-hub-language', next); } catch { /* Site remains usable without storage. */ }
      const url = new URL(location.href); url.searchParams.set('lang', next); history.replaceState(history.state, '', url);
    }
    translateTree(document); syncButtons();
    document.dispatchEvent(new CustomEvent('hub:languagechange', { detail: { language: next } }));
  };
  window.HubI18n = {
    t: text => language === 'en' ? translate(text) : text,
    toEnglish: text => translate(text),
    toFrench: text => translate(text, 'fr'),
    original: node => records.get(node)?.fr || node?.textContent || '',
    get language() { return language; },
    get locale() { return language === 'en' ? 'en-GB' : 'fr-FR'; },
    setLanguage, translateTree,
  };
  document.addEventListener('click', event => { const button = event.target.closest('[data-language]'); if (button) setLanguage(button.dataset.language); });
  // Observe only presentation changes. Values, IDs, datasets, saved names and game state are untouched.
  const observer = new MutationObserver(mutations => {
    const roots = new Set();
    for (const mutation of mutations) {
      if (mutation.type === 'characterData') translateNode(mutation.target);
      else if (mutation.type === 'attributes') translateAttributes(mutation.target);
      else mutation.addedNodes.forEach(node => roots.add(node));
    }
    roots.forEach(translateTree);
  });
  observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: attributes });
  setLanguage(language, false);
  window.addEventListener('storage', event => { if (event.key === 'the-hub-language' && ['fr', 'en'].includes(event.newValue)) setLanguage(event.newValue, false); });
})();
