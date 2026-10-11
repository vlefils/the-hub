const shopKinds = {
  armes: new Set(['distance', 'melee', 'module']),
  gadgets: new Set(['gadget']),
  implants: new Set(['implant']),
  mutations: new Set(['mutation']),
};

const shopFamilyNames = {
  distance: 'Arme à distance',
  melee: 'Arme de mêlée',
  module: 'Module d’arme',
  gadget: 'Gadget',
  implant: 'Implant',
  mutation: 'Mutation Helix',
};

const shopNormalize = (text) => String(text ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const shopPrice = (price) => `${new Intl.NumberFormat('fr-FR').format(price)} chromas`;

const shopElement = (tag, className, content) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (content !== undefined) element.textContent = content;
  return element;
};

const shopFact = (label, value) => {
  const fact = shopElement('span', 'shop-fact');
  fact.append(shopElement('strong', '', label), document.createTextNode(value));
  return fact;
};

const shopCard = (item, eager = false) => {
  const card = shopElement('article', `shop-card shop-card--${item.family}`);
  card.id = `achat-${item.id}`;

  const art = shopElement('div', 'shop-card-art');
  const image = document.createElement('img');
  image.src = item.image;
  image.alt = `Illustration de ${item.name}`;
  image.loading = eager ? 'eager' : 'lazy';
  image.decoding = 'async';
  image.width = 1024;
  image.height = 1024;
  art.append(image);

  const body = shopElement('div', 'shop-card-body');
  const meta = shopElement('div', 'shop-card-meta');
  meta.append(shopElement('span', '', `${shopFamilyNames[item.family]} · T${item.tier}`));
  meta.append(shopElement('strong', 'shop-card-price', shopPrice(item.price)));
  body.append(meta, shopElement('h3', 'shop-card-title', item.name));

  const facts = shopElement('div', 'shop-card-facts');
  if (item.damage) facts.append(shopFact('Dégâts', item.damage));
  if (item.range) facts.append(shopFact('Portée', item.range));
  if (item.charge) facts.append(shopFact('Charge', String(item.charge)));
  if (item.hands) facts.append(shopFact('Prise', item.hands));
  if (facts.childElementCount) body.append(facts);

  body.append(shopElement('p', 'shop-card-summary', item.summary));
  if (item.drawback) {
    const drawback = shopElement('p', 'shop-card-drawback');
    drawback.append(shopElement('strong', '', 'Contrepartie · '), document.createTextNode(item.drawback));
    body.append(drawback);
  }
  const details = shopElement('details', 'shop-card-details');
  details.append(shopElement('summary', '', 'Règles et source'));
  const detailBody = shopElement('div', 'shop-card-detail-body');
  detailBody.append(shopElement('p', '', item.rules));
  if (item.compatibility) detailBody.append(shopFact('Compatibilité', item.compatibility));
  if (item.charger) detailBody.append(shopFact('Chargeur', item.charger.replace(/^chargeur\s*/i, '')));
  if (item.reload) detailBody.append(shopFact('Rechargement', item.reload.replace(/^rechargement\s*/i, '')));
  if (item.archive) {
    const archive = shopElement('a', 'shop-archive-link', 'Voir la fiche image d’origine');
    archive.href = item.archive;
    archive.target = '_blank';
    archive.rel = 'noopener';
    detailBody.append(archive, shopElement('p', 'shop-archive-note', 'Archive visuelle : le texte de cette fiche fait foi si les chiffres diffèrent.'));
  }
  details.append(detailBody);
  body.append(details);
  card.append(art, body);
  return card;
};

const setupShop = (root, items) => {
  const search = root.querySelector('[data-shop-search]');
  const family = root.querySelector('[data-shop-family]');
  const tier = root.querySelector('[data-shop-tier]');
  const hands = root.querySelector('[data-shop-hands]');
  const sort = root.querySelector('[data-shop-sort]');
  const count = root.querySelector('[data-shop-count]');
  const results = root.querySelector('[data-shop-results]');

  const render = () => {
    const term = shopNormalize(search.value.trim());
    const visible = items.filter((item) => {
      if (family && family.value !== 'all' && family.value !== item.family) return false;
      if (tier && tier.value !== 'all' && Number(tier.value) !== item.tier) return false;
      if (hands && hands.value !== 'all' && hands.value !== item.hands) return false;
      return !term || shopNormalize([item.name, item.summary, item.rules, item.damage, item.compatibility].join(' ')).includes(term);
    });
    visible.sort((a, b) => sort.value === 'category'
      ? (['distance', 'melee', 'module'].indexOf(a.family) - ['distance', 'melee', 'module'].indexOf(b.family)) || a.price - b.price || a.name.localeCompare(b.name, 'fr')
      : sort.value === 'name'
      ? a.name.localeCompare(b.name, 'fr')
      : sort.value === 'price-desc'
        ? b.price - a.price || a.name.localeCompare(b.name, 'fr')
        : a.price - b.price || a.name.localeCompare(b.name, 'fr'));

    const fragment = document.createDocumentFragment();
    visible.forEach((item, index) => fragment.append(shopCard(item, index < 2)));
    if (!visible.length) fragment.append(shopElement('p', 'shop-empty', 'Aucun article ne correspond à ces critères.'));
    results.replaceChildren(fragment);
    count.textContent = `${visible.length} article${visible.length > 1 ? 's' : ''} sur ${items.length}`;
  };

  root.querySelectorAll('input, select').forEach((control) => control.addEventListener(control === search ? 'input' : 'change', render));
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
