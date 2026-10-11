const shopRoot = document.querySelector('[data-shop-catalogue="all"]');
const shopGroups = {
  armes: ['distance', 'melee', 'module'],
  gadgets: ['gadget'],
  implants: ['implant'],
  mutations: ['mutation'],
};
const shopGroupNames = { armes: 'Armes', gadgets: 'Gadgets', implants: 'Implants', mutations: 'Mutations' };
const shopFamilyNames = {
  distance: 'Arme à distance',
  melee: 'Arme de mêlée',
  module: 'Module',
  gadget: 'Gadget',
  implant: 'Implant',
  mutation: 'Mutation',
};
const shopColumns = [
  ['name', 'Nom'],
  ['family', 'Famille'],
  ['price', 'Prix'],
  ['summary', 'Effet'],
  ['specifics', 'Spécificités'],
];
const shopGroup = (item) => Object.keys(shopGroups).find((group) => shopGroups[group].includes(item.family));
const shopNormalize = (value) => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/œ/g, 'oe')
  .replace(/æ/g, 'ae');
const shopPrice = (price) => new Intl.NumberFormat('fr-FR').format(price);
const shopElement = (tag, className, content) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (content !== undefined) element.textContent = content;
  return element;
};
const shopDetailUrl = (id) => {
  const url = new URL(window.location.href);
  url.searchParams.set('article', id);
  url.hash = 'chroma-catalogue';
  return url.href;
};
const shopCatalogueUrl = () => {
  const url = new URL(window.location.href);
  url.searchParams.delete('article');
  url.hash = 'chroma-catalogue';
  return url.href;
};
const shopSpecifics = (item) => {
  if (item.family === 'implant') return [item.placement, item.charge == null ? null : 'Charge ' + item.charge].filter(Boolean).join(' · ');
  if (item.family === 'mutation') return item.drawback || '—';
  if (item.family === 'gadget') return 'T' + item.tier;
  return [item.hands || item.compatibility, item.damage].filter(Boolean).join(' · ') || '—';
};
const shopFact = (label, value) => {
  const pair = shopElement('div', 'shop-sheet-fact');
  pair.append(shopElement('dt', '', label), shopElement('dd', '', String(value)));
  return pair;
};

const shopSheet = (item, close, direct = false) => {
  const sheet = shopElement('article', 'shop-sheet shop-sheet--' + item.family + ' shop-family--' + shopGroup(item));
  const header = shopElement('header', 'shop-sheet-header');
  const heading = shopElement('div', 'shop-sheet-heading');
  const title = shopElement(direct ? 'h2' : 'h3', '', item.name);
  title.id = 'shop-title-' + item.id;
  heading.append(
    shopElement('p', 'shop-sheet-kicker', shopFamilyNames[item.family] + ' · T' + item.tier),
    title,
    shopElement('strong', 'shop-sheet-price', shopPrice(item.price) + ' chromas'),
  );
  const actions = shopElement('div', 'shop-sheet-actions');
  if (direct) {
    const back = shopElement('a', 'shop-sheet-back', '← Retour au catalogue');
    back.href = shopCatalogueUrl();
    actions.append(back);
  } else {
    const newTab = shopElement('a', 'shop-sheet-new-tab', 'Ouvrir dans un nouvel onglet ↗');
    newTab.href = shopDetailUrl(item.id);
    newTab.target = '_blank';
    newTab.rel = 'noopener';
    const closeButton = shopElement('button', 'shop-sheet-close', 'Fermer ×');
    closeButton.type = 'button';
    closeButton.addEventListener('click', close);
    actions.append(newTab, closeButton);
  }
  header.append(heading, actions);

  const art = shopElement('figure', 'shop-sheet-art');
  const image = document.createElement('img');
  image.src = item.image;
  image.alt = 'Illustration de ' + item.name;
  image.loading = direct ? 'eager' : 'lazy';
  image.addEventListener('error', () => {
    art.replaceChildren(shopElement('p', 'shop-image-error', 'Illustration indisponible'));
  });
  art.append(image);

  const content = shopElement('div', 'shop-sheet-content');
  content.append(shopElement('p', 'shop-sheet-summary', item.summary));
  const facts = shopElement('dl', 'shop-sheet-facts');
  if (item.placement) facts.append(shopFact('Zone', item.placement));
  if (item.charge !== undefined && item.charge !== null) facts.append(shopFact('Charge cyber', item.charge));
  if (item.hands) facts.append(shopFact('Prise en main', item.hands));
  if (item.damage) facts.append(shopFact('Dégâts', item.damage));
  if (item.range) facts.append(shopFact('Portée', item.range));
  if (item.charger) facts.append(shopFact('Chargeur', item.charger.replace(/^chargeur\s*/i, '')));
  if (item.reload) facts.append(shopFact('Rechargement', item.reload.replace(/^rechargement\s*/i, '')));
  if (item.compatibility) facts.append(shopFact('Compatibilité', item.compatibility));
  if (facts.childElementCount) content.append(facts);

  const rules = shopElement('section', 'shop-sheet-rules');
  rules.append(shopElement('h4', '', 'Règles détaillées'));
  for (const paragraph of item.rules.split(/\n\s*\n/)) {
    if (paragraph.trim()) rules.append(shopElement('p', '', paragraph.trim()));
  }
  content.append(rules);
  if (item.drawback) {
    const drawback = shopElement('section', 'shop-sheet-drawback');
    drawback.append(shopElement('h4', '', 'Contrepartie'), shopElement('p', '', item.drawback));
    content.append(drawback);
  }
  if (item.family === 'implant') {
    const ruleLink = shopElement('a', 'shop-charge-link', 'Comprendre la charge des implants');
    ruleLink.href = '#implant-charge-rules';
    if (!direct) ruleLink.addEventListener('click', close);
    content.append(ruleLink);
  }
  if (item.archive) {
    const archive = shopElement('a', 'shop-archive-link', 'Voir la fiche image d’origine');
    archive.href = item.archive;
    archive.target = '_blank';
    archive.rel = 'noopener';
    content.append(archive, shopElement('p', 'shop-archive-note', 'Archive visuelle : le texte de cette fiche fait foi si les chiffres diffèrent.'));
  }
  const body = shopElement('div', 'shop-sheet-body');
  body.append(art, content);
  sheet.append(header, body);
  return sheet;
};

const shopCompare = (a, b, key, direction) => {
  const left = key === 'family' ? shopGroupNames[shopGroup(a)] : key === 'specifics' ? shopSpecifics(a) : a[key];
  const right = key === 'family' ? shopGroupNames[shopGroup(b)] : key === 'specifics' ? shopSpecifics(b) : b[key];
  const comparison = typeof left === 'number' && typeof right === 'number'
    ? left - right
    : String(left ?? '').localeCompare(String(right ?? ''), 'fr', { numeric: true, sensitivity: 'base' });
  return (direction === 'desc' ? -comparison : comparison) || a.name.localeCompare(b.name, 'fr');
};

const setupShop = (root, items) => {
  const search = root.querySelector('[data-shop-search]');
  const families = root.querySelector('[data-shop-families]');
  const tier = root.querySelector('[data-shop-tier]');
  const price = root.querySelector('[data-shop-price]');
  const type = root.querySelector('[data-shop-type]');
  const hands = root.querySelector('[data-shop-hands]');
  const placement = root.querySelector('[data-shop-placement]');
  const charge = root.querySelector('[data-shop-charge]');
  const sort = root.querySelector('[data-shop-sort]');
  const count = root.querySelector('[data-shop-count]');
  const results = root.querySelector('[data-shop-results]');
  const mobileResults = root.querySelector('[data-shop-mobile-results]');
  const browser = root.querySelector('[data-shop-browser]');
  const detail = root.querySelector('[data-shop-detail]');
  let selectedFamily = window.shopInitialFamily || 'all';
  let lastTrigger;

  for (const zone of [...new Set(items.map((item) => item.placement).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'))) {
    const option = shopElement('option', '', zone);
    option.value = zone;
    placement.append(option);
  }
  for (const value of [...new Set(items.map((item) => item.charge).filter((value) => value != null))].sort((a, b) => a - b)) {
    const option = shopElement('option', '', String(value));
    option.value = String(value);
    charge.append(option);
  }
  for (const [key, label] of shopColumns) {
    for (const direction of ['asc', 'desc']) {
      const option = shopElement('option', '', label + ' ' + (direction === 'asc' ? 'croissant' : 'décroissant'));
      option.value = key + ':' + direction;
      sort.append(option);
    }
  }
  sort.value = 'name:asc';

  const dialog = shopElement('dialog', 'shop-dialog');
  root.append(dialog);
  const close = () => { if (dialog.open) dialog.close(); };
  const open = (item, trigger) => {
    lastTrigger = trigger;
    dialog.replaceChildren(shopSheet(item, close));
    dialog.setAttribute('aria-labelledby', 'shop-title-' + item.id);
    dialog.showModal();
    dialog.querySelector('.shop-sheet-close').focus();
  };
  dialog.addEventListener('click', (event) => { if (event.target === dialog) close(); });
  dialog.addEventListener('close', () => { if (lastTrigger?.isConnected) lastTrigger.focus(); });

  const table = shopElement('table', 'shop-table');
  table.append(shopElement('caption', 'shop-visually-hidden', 'Catalogue Chroma : sélectionner un nom pour ouvrir sa fiche complète'));
  const head = document.createElement('thead');
  const headRow = document.createElement('tr');
  const headCells = new Map();
  const body = document.createElement('tbody');
  for (const [key, label] of shopColumns) {
    const cell = shopElement('th', 'shop-col-' + key);
    cell.scope = 'col';
    const button = shopElement('button', 'shop-sort-button', label);
    button.type = 'button';
    button.append(shopElement('span', 'shop-sort-arrow'));
    button.addEventListener('click', () => {
      const [currentKey, currentDirection] = sort.value.split(':');
      sort.value = key + ':' + (currentKey === key && currentDirection === 'asc' ? 'desc' : 'asc');
      render();
    });
    cell.append(button);
    headCells.set(key, cell);
    headRow.append(cell);
  }
  head.append(headRow);
  table.append(head, body);
  results.replaceChildren(table);

  const syncFamily = () => {
    for (const button of families.querySelectorAll('button')) {
      const active = button.dataset.family === selectedFamily;
      button.setAttribute('aria-pressed', String(active));
      button.classList.toggle('is-active', active);
    }
    for (const control of root.querySelectorAll('[data-shop-context]')) {
      control.hidden = control.dataset.shopContext === 'weapons'
        ? selectedFamily !== 'armes'
        : selectedFamily !== 'implants';
    }
  };
  const setFamily = (family) => {
    selectedFamily = family in shopGroups ? family : 'all';
    type.value = 'all';
    hands.value = 'all';
    placement.value = 'all';
    charge.value = 'all';
    syncFamily();
    render();
  };
  window.shopSetFamily = setFamily;
  for (const family of ['all', ...Object.keys(shopGroups)]) {
    const total = family === 'all' ? items.length : items.filter((item) => shopGroup(item) === family).length;
    const button = shopElement('button', 'shop-family shop-family--' + family, (family === 'all' ? 'Tous' : shopGroupNames[family]) + ' ' + total);
    button.type = 'button';
    button.dataset.family = family;
    button.addEventListener('click', () => setFamily(selectedFamily === family ? 'all' : family));
    families.append(button);
  }

  const render = () => {
    const term = shopNormalize(search.value.trim());
    const visible = items.filter((item) => {
      if (selectedFamily !== 'all' && shopGroup(item) !== selectedFamily) return false;
      if (tier.value !== 'all' && Number(tier.value) !== item.tier) return false;
      if (price.value === '500' && item.price > 500) return false;
      if (price.value === '1000' && (item.price <= 500 || item.price > 1000)) return false;
      if (price.value === 'over1000' && item.price <= 1000) return false;
      if (selectedFamily === 'armes' && type.value !== 'all' && item.family !== type.value) return false;
      if (selectedFamily === 'armes' && hands.value !== 'all' && item.hands !== hands.value) return false;
      if (selectedFamily === 'implants' && placement.value !== 'all' && item.placement !== placement.value) return false;
      if (selectedFamily === 'implants' && charge.value !== 'all' && item.charge !== Number(charge.value)) return false;
      return !term || shopNormalize([
        item.name, item.summary, item.rules, item.damage, item.compatibility,
        item.placement, item.drawback,
      ].join(' ')).includes(term);
    });
    const [key, direction] = sort.value.split(':');
    visible.sort((a, b) => shopCompare(a, b, key, direction));
    for (const [columnKey, cell] of headCells) {
      cell.setAttribute('aria-sort', columnKey === key ? (direction === 'asc' ? 'ascending' : 'descending') : 'none');
    }
    const fragment = document.createDocumentFragment();
    const mobileFragment = document.createDocumentFragment();
    for (const item of visible) {
      const row = shopElement('tr', 'shop-row shop-family--' + shopGroup(item));
      row.id = 'achat-' + item.id;
      let trigger;
      for (const [columnKey] of shopColumns) {
        const cell = shopElement(columnKey === 'name' ? 'th' : 'td', 'shop-col-' + columnKey);
        if (columnKey === 'name') {
          cell.scope = 'row';
          trigger = shopElement('a', 'shop-row-open', item.name);
          trigger.href = shopDetailUrl(item.id);
          trigger.addEventListener('click', (event) => {
            if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            open(item, trigger);
          });
          const mobileMeta = shopElement('small', 'shop-row-meta', shopFamilyNames[item.family] + ' · T' + item.tier);
          cell.append(trigger, mobileMeta);
        } else if (columnKey === 'family') {
          cell.append(shopElement('span', 'shop-family-label', shopFamilyNames[item.family]));
        } else if (columnKey === 'price') {
          cell.textContent = shopPrice(item.price);
        } else if (columnKey === 'summary') {
          cell.append(shopElement('span', 'shop-row-description', item.summary));
        } else {
          cell.append(shopElement('span', 'shop-row-description', shopSpecifics(item)));
        }
        row.append(cell);
      }
      row.addEventListener('click', (event) => {
        if (!event.target.closest('a, button')) open(item, trigger);
      });
      fragment.append(row);

      const mobileRow = shopElement('article', 'shop-mobile-row shop-family--' + shopGroup(item));
      const mobileHeader = shopElement('div', 'shop-mobile-row-head');
      const mobileLink = shopElement('a', 'shop-mobile-row-link', item.name);
      mobileLink.href = shopDetailUrl(item.id);
      mobileLink.addEventListener('click', (event) => {
        if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        open(item, mobileLink);
      });
      mobileHeader.append(mobileLink, shopElement('strong', 'shop-mobile-price', shopPrice(item.price)));
      mobileRow.append(
        mobileHeader,
        shopElement('small', 'shop-mobile-meta', shopFamilyNames[item.family] + ' · T' + item.tier),
        shopElement('p', 'shop-mobile-summary', item.summary),
      );
      mobileRow.addEventListener('click', (event) => {
        if (!event.target.closest('a, button')) open(item, mobileLink);
      });
      mobileFragment.append(mobileRow);
    }
    if (!visible.length) {
      const row = document.createElement('tr');
      const cell = shopElement('td', 'shop-empty', 'Aucun article ne correspond à ces critères.');
      cell.colSpan = shopColumns.length;
      row.append(cell);
      fragment.append(row);
      mobileFragment.append(shopElement('p', 'shop-empty', 'Aucun article ne correspond à ces critères.'));
    }
    body.replaceChildren(fragment);
    mobileResults.replaceChildren(mobileFragment);
    count.textContent = visible.length + ' article' + (visible.length !== 1 ? 's' : '') + ' sur ' + items.length + ' · Prix en chromas';
  };

  const syncDirect = () => {
    let id = new URLSearchParams(window.location.search).get('article');
    if (id && window.location.hash !== '#chroma-catalogue') {
      const url = new URL(window.location.href);
      url.searchParams.delete('article');
      history.replaceState(null, '', url);
      id = null;
    }
    const active = Boolean(id) && window.location.hash === '#chroma-catalogue';
    browser.hidden = active;
    detail.hidden = !active;
    root.classList.toggle('shop-detail-mode', active);
    root.closest('[data-section]')?.classList.toggle('shop-detail-active', active);
    if (!active) return;
    const item = items.find((entry) => entry.id === id);
    if (item) {
      detail.replaceChildren(shopSheet(item, null, true));
    } else {
      const message = shopElement('p', 'shop-empty', 'Cette fiche est introuvable.');
      const back = shopElement('a', '', 'Retour au catalogue');
      back.href = shopCatalogueUrl();
      detail.replaceChildren(message, back);
    }
  };
  window.shopSyncDirect = syncDirect;
  root.querySelectorAll('.shop-controls input, .shop-controls select').forEach((control) => {
    control.addEventListener(control === search ? 'input' : 'change', render);
  });
  root.querySelector('[data-shop-reset]').addEventListener('click', () => {
    search.value = '';
    tier.value = 'all';
    price.value = 'all';
    sort.value = 'name:asc';
    setFamily('all');
    search.focus();
  });
  syncFamily();
  render();
  syncDirect();
  window.addEventListener('hashchange', syncDirect);
  window.addEventListener('popstate', syncDirect);
};

if (shopRoot) {
  fetch('data/catalogue.json')
    .then((response) => {
      if (!response.ok) throw new Error('Catalogue HTTP ' + response.status);
      return response.json();
    })
    .then((items) => setupShop(shopRoot, items))
    .catch((error) => {
      console.error(error);
      shopRoot.querySelector('[data-shop-count]').textContent = 'Le catalogue est momentanément indisponible. Rechargez la page.';
      const detail = shopRoot.querySelector('[data-shop-detail]');
      detail.replaceChildren(shopElement('p', 'shop-empty', 'La fiche ne peut pas être chargée pour le moment.'));
      if (new URLSearchParams(window.location.search).has('article')) {
        shopRoot.querySelector('[data-shop-browser]').hidden = true;
        detail.hidden = false;
      }
    });
}
