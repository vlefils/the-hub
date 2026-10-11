const shopKinds = {
  armes: new Set(['distance', 'melee', 'module']),
  gadgets: new Set(['gadget']),
  implants: new Set(['implant']),
  mutations: new Set(['mutation']),
};

const shopFamilyNames = {
  distance: 'Distance', melee: 'Mêlée', module: 'Module',
  gadget: 'Gadget', implant: 'Implant', mutation: 'Mutation',
};

const shopColumns = {
  armes: [
    ['name', 'Nom'], ['price', 'Prix'], ['summary', 'Description'],
    ['family', 'Type'], ['hands', 'Prise / compatibilité'], ['damage', 'Dégâts'],
  ],
  gadgets: [['name', 'Nom'], ['price', 'Prix'], ['summary', 'Description'], ['tier', 'Tier']],
  implants: [
    ['name', 'Nom'], ['price', 'Prix'], ['summary', 'Description'],
    ['placement', 'Zone'], ['charge', 'Charge'],
  ],
  mutations: [
    ['name', 'Nom'], ['price', 'Prix'], ['summary', 'Description'],
    ['tier', 'Tier'], ['drawback', 'Contrepartie'],
  ],
};

const shopNormalize = (value) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const shopPrice = (price) => `${new Intl.NumberFormat('fr-FR').format(price)} chromas`;
const shopElement = (tag, className, content) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (content !== undefined) element.textContent = content;
  return element;
};

const shopValue = (item, key) => {
  if (key === 'family') return shopFamilyNames[item.family];
  if (key === 'hands') return item.hands || item.compatibility || '—';
  if (key === 'price') return new Intl.NumberFormat('fr-FR').format(item.price);
  if (key === 'tier') return `T${item.tier}`;
  return item[key] ?? '—';
};

const shopFact = (label, value) => {
  const pair = shopElement('div', 'shop-sheet-fact');
  pair.append(shopElement('dt', '', label), shopElement('dd', '', String(value)));
  return pair;
};

const shopSheet = (item, close) => {
  const sheet = shopElement('article', `shop-sheet shop-sheet--${item.family}`);
  const header = shopElement('header', 'shop-sheet-header');
  const heading = shopElement('div', 'shop-sheet-heading');
  const title = shopElement('h3', '', item.name);
  title.id = `shop-title-${item.id}`;
  heading.append(shopElement('p', 'shop-sheet-kicker', `${shopFamilyNames[item.family]} · T${item.tier}`), title);
  const closeButton = shopElement('button', 'shop-sheet-close', 'Fermer ×');
  closeButton.type = 'button';
  closeButton.addEventListener('click', close);
  header.append(heading, closeButton);

  const art = shopElement('figure', 'shop-sheet-art');
  const image = document.createElement('img');
  image.src = item.image;
  image.alt = `Illustration de ${item.name}`;
  image.width = 1024;
  image.height = 1024;
  art.append(image);

  const content = shopElement('div', 'shop-sheet-content');
  const intro = shopElement('div', 'shop-sheet-intro');
  intro.append(shopElement('strong', 'shop-sheet-price', shopPrice(item.price)), shopElement('p', 'shop-sheet-summary', item.summary));
  content.append(intro);

  const facts = shopElement('dl', 'shop-sheet-facts');
  if (item.placement) facts.append(shopFact('Zone', item.placement));
  if (item.charge !== undefined) facts.append(shopFact('Charge cyber', item.charge));
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

const shopSort = (a, b, key, direction) => {
  const left = key === 'family' ? ['distance', 'melee', 'module'].indexOf(a.family)
    : key === 'hands' ? a.hands || a.compatibility : a[key];
  const right = key === 'family' ? ['distance', 'melee', 'module'].indexOf(b.family)
    : key === 'hands' ? b.hands || b.compatibility : b[key];
  if (left == null) return right == null ? a.name.localeCompare(b.name, 'fr') : 1;
  if (right == null) return -1;
  const result = typeof left === 'number' && typeof right === 'number'
    ? left - right
    : String(left).localeCompare(String(right), 'fr', { numeric: true, sensitivity: 'base' });
  return (direction === 'desc' ? -result : result) || a.price - b.price || a.name.localeCompare(b.name, 'fr');
};

const setupShop = (root, items) => {
  const kind = root.dataset.shopCatalogue;
  const columns = shopColumns[kind];
  const search = root.querySelector('[data-shop-search]');
  const family = root.querySelector('[data-shop-family]');
  const tier = root.querySelector('[data-shop-tier]');
  const hands = root.querySelector('[data-shop-hands]');
  const placement = root.querySelector('[data-shop-placement]');
  const charge = root.querySelector('[data-shop-charge]');
  const sort = root.querySelector('[data-shop-sort]');
  const count = root.querySelector('[data-shop-count]');
  const results = root.querySelector('[data-shop-results]');

  if (placement) {
    for (const zone of [...new Set(items.map((item) => item.placement))].sort((a, b) => a.localeCompare(b, 'fr'))) {
      const option = shopElement('option', '', zone);
      option.value = zone;
      placement.append(option);
    }
  }
  if (charge) {
    for (const value of [...new Set(items.map((item) => item.charge))].sort((a, b) => a - b)) {
      const option = shopElement('option', '', String(value));
      option.value = String(value);
      charge.append(option);
    }
  }

  for (const [key, label] of columns) {
    for (const direction of ['asc', 'desc']) {
      const option = document.createElement('option');
      option.value = `${key}:${direction}`;
      option.textContent = key === 'price' || key === 'charge'
        ? `${label} ${direction === 'asc' ? 'croissant' : 'décroissant'}`
        : `${label} ${direction === 'asc' ? 'A–Z' : 'Z–A'}`;
      sort.append(option);
    }
  }
  sort.value = kind === 'armes' ? 'family:asc' : 'price:asc';

  const dialog = shopElement('dialog', 'shop-dialog');
  root.append(dialog);
  let lastTrigger;
  const close = () => dialog.close();
  const open = (item, trigger) => {
    lastTrigger = trigger;
    dialog.replaceChildren(shopSheet(item, close));
    dialog.setAttribute('aria-labelledby', `shop-title-${item.id}`);
    dialog.showModal();
    dialog.querySelector('.shop-sheet-close').focus();
  };
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) close();
  });
  dialog.addEventListener('close', () => {
    if (lastTrigger?.isConnected) lastTrigger.focus();
  });

  const table = shopElement('table', 'shop-table');
  const caption = shopElement('caption', 'shop-visually-hidden', `Catalogue ${kind} : sélectionner un nom pour ouvrir sa fiche complète`);
  const head = document.createElement('thead');
  const headRow = document.createElement('tr');
  const headCells = new Map();
  const body = document.createElement('tbody');
  for (const [key, label] of columns) {
    const cell = shopElement('th', `shop-col-${key}`);
    cell.scope = 'col';
    const button = shopElement('button', 'shop-sort-button', label);
    button.type = 'button';
    const arrow = shopElement('span', 'shop-sort-arrow');
    arrow.setAttribute('aria-hidden', 'true');
    button.append(arrow);
    button.addEventListener('click', () => {
      const [currentKey, currentDirection] = sort.value.split(':');
      sort.value = `${key}:${currentKey === key && currentDirection === 'asc' ? 'desc' : 'asc'}`;
      render();
    });
    cell.append(button);
    headCells.set(key, cell);
    headRow.append(cell);
  }
  head.append(headRow);
  table.append(caption, head, body);
  results.replaceChildren(table);

  const render = () => {
    const term = shopNormalize(search.value.trim());
    const visible = items.filter((item) => {
      if (family && family.value !== 'all' && family.value !== item.family) return false;
      if (tier && tier.value !== 'all' && Number(tier.value) !== item.tier) return false;
      if (hands && hands.value !== 'all' && hands.value !== item.hands) return false;
      if (placement && placement.value !== 'all' && placement.value !== item.placement) return false;
      if (charge && charge.value !== 'all' && Number(charge.value) !== item.charge) return false;
      return !term || shopNormalize([
        item.name, item.summary, item.rules, item.damage, item.compatibility,
        item.placement, item.drawback,
      ].join(' ')).includes(term);
    });
    const [key, direction] = sort.value.split(':');
    visible.sort((a, b) => shopSort(a, b, key, direction));
    for (const [columnKey, cell] of headCells) {
      cell.setAttribute('aria-sort', columnKey === key ? (direction === 'asc' ? 'ascending' : 'descending') : 'none');
    }

    const fragment = document.createDocumentFragment();
    for (const item of visible) {
      const row = shopElement('tr', 'shop-row');
      row.id = `achat-${item.id}`;
      let trigger;
      for (const [columnKey] of columns) {
        const cell = shopElement(columnKey === 'name' ? 'th' : 'td', `shop-col-${columnKey}`);
        if (columnKey === 'name') {
          cell.scope = 'row';
          trigger = shopElement('button', 'shop-row-open', item.name);
          trigger.type = 'button';
          trigger.setAttribute('aria-label', `Voir la fiche de ${item.name}`);
          trigger.addEventListener('click', () => open(item, trigger));
          const mobileMeta = shopElement('small', 'shop-row-meta', [
            `T${item.tier}`,
            kind === 'armes' ? shopFamilyNames[item.family] : null,
            kind === 'armes' ? item.hands || item.compatibility : null,
            kind === 'implants' ? item.placement : null,
            kind === 'implants' ? `Charge ${item.charge}` : null,
          ].filter(Boolean).join(' · '));
          cell.append(trigger, mobileMeta);
        } else {
          if (columnKey === 'summary') {
            cell.append(shopElement('span', 'shop-row-description', String(shopValue(item, columnKey))));
          } else {
            cell.textContent = String(shopValue(item, columnKey));
          }
          if (columnKey === 'summary' && item.drawback) {
            cell.append(shopElement('small', 'shop-row-subnote', `Contrepartie : ${item.drawback}`));
          }
        }
        row.append(cell);
      }
      row.addEventListener('click', (event) => {
        if (!event.target.closest('button')) open(item, trigger);
      });
      fragment.append(row);
    }
    if (!visible.length) {
      const row = document.createElement('tr');
      const cell = shopElement('td', 'shop-empty', 'Aucun article ne correspond à ces critères.');
      cell.colSpan = columns.length;
      row.append(cell);
      fragment.append(row);
    }
    body.replaceChildren(fragment);
    count.textContent = `${visible.length} article${visible.length > 1 ? 's' : ''} sur ${items.length} · Prix en chromas`;
  };

  root.querySelectorAll('.shop-controls input, .shop-controls select').forEach((control) => {
    control.addEventListener(control === search ? 'input' : 'change', render);
  });
  render();
};

fetch('data/catalogue.json')
  .then((response) => {
    if (!response.ok) throw new Error(`Catalogue HTTP ${response.status}`);
    return response.json();
  })
  .then((items) => {
    document.querySelectorAll('[data-shop-catalogue]').forEach((root) => {
      const allowed = shopKinds[root.dataset.shopCatalogue];
      setupShop(root, items.filter((item) => allowed?.has(item.family)));
    });
  })
  .catch((error) => {
    console.error(error);
    document.querySelectorAll('[data-shop-count]').forEach((status) => {
      status.textContent = 'Le catalogue est momentanément indisponible. Rechargez la page.';
    });
  });
