(() => {
  const normalize = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/œ/g, 'oe');
  const header = document.querySelector('.site-header');
  const reader = document.querySelector('[data-reader-tools]');
  const measureClearance = () => {
    const headerHeight = header && getComputedStyle(header).position === 'sticky' ? header.getBoundingClientRect().height : 0;
    const readerHeight = reader?.getBoundingClientRect().height || 0;
    document.documentElement.style.setProperty('--lore-clearance', `${Math.ceil(headerHeight + readerHeight + 20)}px`);
  };
  if (window.ResizeObserver) {
    const observer = new ResizeObserver(measureClearance);
    if (header) observer.observe(header);
    if (reader) observer.observe(reader);
  }
  measureClearance();
  document.querySelectorAll('[data-lore-collection]').forEach(root => {
    const search = root.querySelector('[data-lore-search]');
    const select = root.querySelector('[data-lore-faction]');
    const cards = [...root.querySelectorAll('[data-lore-card]')];
    const count = root.querySelector('[data-lore-count]');
    const empty = root.querySelector('[data-lore-empty]');
    const render = () => {
      const words = normalize(search.value.trim()).split(/\s+/).filter(Boolean);
      let visible = 0;
      cards.forEach(card => {
        // Search only public copy, including its original language. Secrets stay unindexed.
        const copy = card.cloneNode(true);
        copy.querySelectorAll('.lore-secret').forEach(node => node.remove());
        if (!card.dataset.searchEnglish && window.HubI18n) card.dataset.searchEnglish = [...copy.querySelectorAll('h3,p,dt,dd')].map(node => window.HubI18n.toEnglish(node.textContent)).join(' ');
        const haystack = normalize(copy.textContent + ' ' + (card.dataset.searchOriginal || '') + ' ' + (card.dataset.searchEnglish || ''));
        const match = (select.value === 'all' || select.value === card.dataset.faction) && words.every(word => haystack.includes(word));
        card.hidden = !match;
        visible += Number(match);
      });
      const en = document.documentElement.lang === 'en';
      count.textContent = en ? `${visible} of ${cards.length} entries` : `${visible} / ${cards.length} entrées`;
      empty.hidden = visible > 0;
      document.dispatchEvent(new CustomEvent('hub:lorefilter', { detail: { id: root.id } }));
    };
    cards.forEach(card => { const copy = card.cloneNode(true); copy.querySelectorAll('.lore-secret').forEach(n => n.remove()); card.dataset.searchOriginal = copy.textContent; });
    search.addEventListener('input', render);
    select.addEventListener('change', render);
    const reveal = () => {
      const id = decodeURIComponent(location.hash.slice(1));
      const target = document.getElementById(id)?.closest('[data-lore-card]');
      if (target && root.contains(target)) { search.value = ''; select.value = 'all'; render(); }
    };
    window.addEventListener('hashchange', reveal);
    document.addEventListener('hub:languagechange', render);
    render(); reveal();
  });
})();
