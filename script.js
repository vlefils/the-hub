const menuToggle = document.querySelector(".menu-toggle");
const categoryLinks = [...document.querySelectorAll("[data-category-link]")];
const sidebarTitle = document.querySelector("[data-sidebar-title]");
const sidebarNavs = [...document.querySelectorAll("[data-sidebar-nav]")];
sidebarNavs.forEach((nav) => { nav.id ||= `sidebar-nav-${nav.dataset.sidebarNav}`; });
const sidebarLinks = [...document.querySelectorAll(".sidebar-nav a")];
const sidebar = document.querySelector('.sidebar');
const sidebarClose = document.querySelector('.sidebar-close');
const sections = [...document.querySelectorAll("[data-section]")];
const subtabs = [...document.querySelectorAll("[data-subtabs]")];
const sidebarSubgroups = [...document.querySelectorAll(".sidebar-subgroup")];
const defaultSection = sections.find((section) => section.id === "lore-the-hub") || sections[0];
const sectionNavRoots = new Map(
  sections
    .filter((section) => section.dataset.navRoot)
    .map((section) => [section.id, section.dataset.navRoot]),
);
sidebarSubgroups.forEach((group) => {
  group.querySelectorAll('a[href^="#"]').forEach((link) => {
    sectionNavRoots.set(link.hash.slice(1), group.dataset.contextParent);
  });
});
const subtabParentSections = new Map();
const subtabActivators = new Map();
const sectionSubtabActivators = new Map();
const sectionDefaultSubtabs = new Map();

const sectionLandmarkGroups = [
  {
    family: "Règles",
    source: "assets/landmarks/rules-principles.webp",
    alt: "Table de briefing avec un de a vingt faces, cinq marqueurs de caracteristique et une interface de contrat",
    accent: "#67d7ff",
    ids: [
      "regles-overview",
      "regles-principes-resolution",
      "regles-principes-personnage",
      "regles-principes-rythme",
      "regles-principes-progression",
    ],
  },
  {
    family: "Système",
    source: "assets/landmarks/rules-system.webp",
    alt: "Operateur calibrant un de a vingt faces sur un scanner tactique",
    accent: "#7dff65",
    ids: [
      "regles-systeme",
      "regles-systeme-tests",
      "regles-systeme-sauvegardes",
      "regles-systeme-avantage",
      "regles-systeme-fiction",
    ],
  },
  {
    family: "Combat",
    source: "assets/landmarks/rules-combat.webp",
    alt: "Equipe de mercenaires prise dans un echange de tirs au milieu d'un couloir industriel",
    accent: "#ff875c",
    ids: [
      "regles-combat",
      "regles-combat-initiative",
      "regles-combat-actions",
      "regles-combat-degats",
      "regles-combat-survie",
      "regles-combat-conditions",
    ],
  },
  {
    family: "Règles",
    source: "assets/landmarks/rules-second-chance.webp",
    alt: "Mercenaire reconstruit dans une capsule clinique sous surveillance automatisee",
    accent: "#cf76ff",
    ids: ["regles-seconde-chance"],
  },
  {
    family: "Équipement",
    source: "assets/landmarks/rules-equipment.webp",
    alt: "Armurerie du Hub avec protection, fusil, kit medical, harnais et caisse d'extraction",
    accent: "#ffc75c",
    ids: [
      "regles-equipement",
      "regles-equipement-armures",
      "regles-equipement-armes",
      "regles-equipement-materiel",
      "regles-equipement-charge",
      "regles-equipement-transport",
    ],
  },
  {
    family: "Personnage",
    source: "assets/landmarks/character-origins.webp",
    alt: "Objets personnels evoquant plusieurs origines de survivants de Paradise",
    accent: "#cf76ff",
    ids: ["personnage-origines"],
  },
  {
    family: "Chroma",
    source: "assets/landmarks/chroma-catalogue.webp",
    alt: "Comptoir securise presentant implants, modules, gadgets et echantillons biotech",
    accent: "#ff875c",
    ids: ["chroma-catalogue"],
  },
  {
    family: "Chroma",
    source: "assets/landmarks/chroma-implant-load.webp",
    alt: "Banc de test montrant des modules cybernetiques passant du bleu stable a l'orange de surchauffe",
    accent: "#67d7ff",
    ids: ["implant-charge-rules"],
  },
  {
    family: "Outils",
    source: "assets/landmarks/tools-overview.webp",
    alt: "Table de jeu avec fiche de personnage, tablette, des, carte tactique et imprimante",
    accent: "#c3ff39",
    ids: [
      "outils-overview",
      "outils-pretires",
      "pretire-mara-rail-voss",
      "outils-fiche",
      "outils-tables",
      "outils-mj",
    ],
  },
];

const injectSectionLandmarks = () => {
  sectionLandmarkGroups.forEach((group) => {
    group.ids.forEach((sectionId, index) => {
      const section = document.getElementById(sectionId);

      if (!section || section.querySelector(":scope > .section-landmark")) {
        return;
      }

      const overviewHero = section.querySelector(":scope > .overview-hero");
      const directHeading = section.querySelector(":scope > .section-heading");
      const insertionPoint = overviewHero || directHeading;
      const heading = section.querySelector("h1, h2");

      if (!insertionPoint || !heading) {
        return;
      }

      const figure = document.createElement("figure");
      const image = document.createElement("img");
      const caption = document.createElement("figcaption");
      const code = document.createElement("span");
      const title = document.createElement("strong");

      figure.className = "section-landmark";
      if (index > 0 || section.dataset.category === "chroma" || section.hasAttribute("data-page-pending")) {
        figure.classList.add("section-landmark--compact");
      }
      figure.style.setProperty("--landmark-accent", group.accent);

      image.src = group.source;
      image.alt = group.alt;
      image.loading = "lazy";
      image.decoding = "async";
      image.width = 1600;
      image.height = 534;

      code.className = "section-landmark-code";
      code.textContent = `${group.family} / ${String(index + 1).padStart(2, "0")}`;
      title.textContent = heading.textContent.trim();

      caption.append(code, title);
      figure.append(image, caption);
      insertionPoint.after(figure);
    });
  });
};

injectSectionLandmarks();

const setMenuBackgroundInert = (active) => {
  document.querySelectorAll(".site-header, main, [data-skip-content]").forEach((element) => { element.inert = active; });
};

const closeMenu = (restoreFocus = false) => {
  sidebar?.classList.remove('sidebar-open');
  document.body.classList.remove('nav-open');
  menuToggle?.setAttribute('aria-expanded', 'false');
  setMenuBackgroundInert(false);
  if (restoreFocus) menuToggle?.focus();
};

if (menuToggle && sidebar) {
  menuToggle.addEventListener('click', () => {
    sidebar.classList.add('sidebar-open');
    sidebar.scrollTop = 0;
    document.body.classList.add('nav-open');
    menuToggle.setAttribute('aria-expanded', 'true');
    setMenuBackgroundInert(true);
    sidebarClose?.focus();
  });
  sidebarClose?.addEventListener('click', () => closeMenu(true));
  sidebar.addEventListener('keydown', (event) => {
    if (!sidebar.classList.contains('sidebar-open')) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeMenu(true);
    }
    if (event.key !== 'Tab') return;
    const focusable = [...sidebar.querySelectorAll('a, button, input, select')].filter((element) => element.getClientRects().length);
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  sidebar.addEventListener('click', (event) => {
    const link = event.target.closest('a[href^="#"]');
    if (link?.hash === '#chroma-catalogue') {
      window.shopInitialFamily = 'all';
      window.shopSetFamily?.('all');
      if (new URLSearchParams(window.location.search).has('article')) {
        const url = new URL(window.location.href);
        url.searchParams.delete('article');
        history.replaceState(null, '', url);
        window.shopSyncDirect?.();
      }
    }
    if (link && link.hash === window.location.hash && sidebar.classList.contains('sidebar-open')) closeMenu(true);
  });
  window.matchMedia('(min-width: 961px)').addEventListener('change', (event) => {
    if (event.matches) closeMenu();
  });
}

const labels = {
  news: "News",
  lore: "Lore",
  regles: "Règles",
  personnage: "Personnage",
  chroma: "Chroma Shop",
  outils: "Outils",
};

const sectionTitle = (section) => section?.querySelector("h1, h2")?.textContent.trim() || "The Hub";
const categoryHome = (category) => categoryLinks.find((link) => link.dataset.categoryLink === category)?.hash.slice(1);
const readerTools = document.querySelector("[data-reader-tools]");
const breadcrumb = document.querySelector("[data-breadcrumb]");
const readerJump = document.querySelector("[data-reader-jump]");
const pageJump = document.querySelector("[data-page-jump]");
let pageJumpTargets = [];
const scrollToReadingTarget = (element) => {
  element.tabIndex = -1;
  element.focus({ preventScroll: true });
  const section = element.closest('.page-section');
  // Section entrance transforms temporarily shift anchor geometry.
  const layoutReady = (section?.getAnimations?.() || []).map(animation => animation.finished);
  if (document.fonts?.ready) layoutReady.push(document.fonts.ready);
  Promise.allSettled(layoutReady).then(() => requestAnimationFrame(() => {
    if (section && !section.classList.contains('is-active')) return;
    element.scrollIntoView({ block: "start", behavior: "instant" });
  }));
};

const updateReadingNavigation = (section, currentId = section.id) => {
  const category = section.dataset.category;
  const homeId = categoryHome(category);
  const parentId = sectionNavRoots.get(currentId);
  const subtab = subtabParentSections.has(currentId) ? document.getElementById(currentId) : null;
  const currentTitle = subtab
    ? document.getElementById(subtab.getAttribute("aria-labelledby"))?.textContent.trim()
    : currentId === section.id ? sectionTitle(section) : sidebarLinks.find((link) => link.hash === `#${currentId}`)?.textContent.trim();
  const title = currentTitle || sectionTitle(section);
  document.title = title === "The Hub" ? "The Hub — Livre de règles" : `${subtab ? `${sectionTitle(section)} — ` : ""}${title} · The Hub`;

  if (breadcrumb) {
    const path = [{ id: homeId, title: labels[category] || "The Hub" }];
    if (parentId && parentId !== homeId) path.push({ id: parentId, title: sectionTitle(document.getElementById(parentId)) });
    if (subtab && section.id !== homeId) path.push({ id: section.id, title: sectionTitle(section) });
    path.push({ id: currentId, title });
    breadcrumb.replaceChildren();
    path.forEach((entry, index) => {
      const item = document.createElement("li");
      const node = document.createElement(index === path.length - 1 ? "span" : "a");
      node.textContent = entry.title;
      if (node.tagName === "A") node.href = `#${entry.id}`;
      else node.setAttribute("aria-current", "page");
      item.append(node);
      breadcrumb.append(item);
    });
  }

  pageJumpTargets = [];
  const addJump = (element, title) => {
    if (element && !element.closest("[hidden]") && !pageJumpTargets.some((entry) => entry.element === element)) {
      pageJumpTargets.push({ element, title });
    }
  };
  if (section.id.startsWith("personnage-classe-")) {
    addJump(section.querySelector(".class-intro"), "Présentation de la classe");
    addJump(section.querySelector(".table-wrap"), "Tableau de progression");
    addJump(section.querySelector(".subtabs-nav"), "Choisir une voie");
    section.querySelectorAll(".subtab-panel:not([hidden]) .level-block").forEach((block) => {
      addJump(block, [block.querySelector(".level-banner")?.textContent, block.querySelector("strong")?.textContent].filter(Boolean).join(" — "));
    });
    section.querySelectorAll(".subtab-panel:not([hidden]) .protocol-rank-heading").forEach((heading) => addJump(heading, heading.textContent.trim()));
  } else if (section.id === "lore-factions") {
    sidebarLinks.filter((link) => sectionNavRoots.get(link.hash.slice(1)) === section.id).forEach((link) => addJump(document.getElementById(link.hash.slice(1)), link.textContent.trim()));
  } else {
    if (!section.hasAttribute("data-reader-app")) {
      section.querySelectorAll("h3").forEach((heading) => addJump(heading, heading.textContent.trim()));
    }
  }
  if (pageJump) {
    pageJump.replaceChildren(new Option("Aller à…", ""));
    pageJumpTargets.forEach((entry, index) => pageJump.append(new Option(entry.title, String(index))));
  }
  if (readerJump) readerJump.hidden = pageJumpTargets.length < 3;
  if (readerTools) readerTools.hidden = false;
};

document.addEventListener('hub:lorefilter', event => {
  const section = document.getElementById(event.detail.id);
  if (section?.classList.contains('is-active')) updateReadingNavigation(section);
});

pageJump?.addEventListener("change", () => {
  if (pageJump.value === "") return;
  const target = pageJumpTargets[Number(pageJump.value)]?.element;
  if (target) scrollToReadingTarget(target);
  pageJump.value = "";
});
document.querySelector("[data-skip-content]")?.addEventListener("click", (event) => {
  event.preventDefault();
  scrollToReadingTarget(document.querySelector(".page-section.is-active h1, .page-section.is-active h2") || document.getElementById("contenu"));
});

const setupBookSearch = () => {
  const input = document.getElementById("site-search-input");
  const results = document.getElementById("site-search-results");
  const status = document.getElementById("site-search-status");
  const clear = document.querySelector("[data-clear-search]");
  if (!input || !results || !status || !clear) return;
  const normalize = (text) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/œ/g, "oe");
  const entries = [];
  const addEntry = (id, title, rawContext, text) => {
    const context = window.HubI18n?.t(rawContext) || rawContext;
    entries.push({ id, title, context, titleKey: normalize(title), textKey: normalize(`${title} ${context} ${text}`) });
  };
  const buildIndex = () => {
    entries.length = 0;
    sections.filter((section) => section.dataset.category !== "news" && !section.hasAttribute("data-page-pending")).forEach((section) => {
      const copy = section.cloneNode(true);
      copy.querySelectorAll(".subtabs, .section-landmark, form, nav, .lore-secret, [data-lore-card]").forEach((element) => element.remove());
      const title = sectionTitle(section);
      addEntry(section.id, title, labels[section.dataset.category], copy.textContent);
      section.querySelectorAll("[data-subtab-panel]").forEach((panel) => {
        const tabTitle = document.getElementById(panel.getAttribute("aria-labelledby"))?.textContent.trim() || "Base";
        addEntry(panel.id, `${title} · ${tabTitle}`, labels[section.dataset.category], panel.textContent);
      });
      section.querySelectorAll('[data-lore-card]').forEach(card => {
        if (card.dataset.loreTarget) return;
        const copy = card.cloneNode(true);
        copy.querySelectorAll('.lore-secret').forEach(node => node.remove());
        addEntry(card.id, card.querySelector('h3').textContent.trim(), sectionTitle(section), copy.textContent);
      });
      section.querySelectorAll('[data-lore-person], [data-lore-entry]').forEach(person => {
        const copy = person.cloneNode(true);
        copy.querySelectorAll('.lore-secret').forEach(node => node.remove());
        addEntry(person.id, person.querySelector('h3, h4').textContent.trim(), sectionTitle(section), copy.textContent);
      });
    });
    sidebarLinks.forEach((link) => {
      const id = link.hash.slice(1);
      const element = document.getElementById(id);
      if (element && !element.matches("[data-section]") && !entries.some((entry) => entry.id === id)) {
        addEntry(id, link.textContent.trim(), "Lore · Factions", element.querySelector("img")?.alt || element.textContent);
      }
    });
  };
  buildIndex();
  const reset = () => {
    input.value = "";
    results.replaceChildren();
    results.hidden = true;
    status.hidden = true;
    clear.hidden = true;
    sidebar.classList.remove("is-searching");
  };
  const render = () => {
    const term = normalize(input.value.trim());
    if (!term) return reset();
    sidebar.classList.add("is-searching");
    clear.hidden = false;
    status.hidden = false;
    results.hidden = false;
    results.replaceChildren();
    if (term.length < 2) {
      status.textContent = "Saisissez au moins 2 caractères.";
      return;
    }
    const words = term.split(/\s+/);
    const score = (entry) => Number(entry.titleKey.includes(term)) * 100 + Number(entry.textKey.includes(term)) * 20;
    const matches = entries.filter((entry) => words.every((word) => entry.textKey.includes(word)))
      .sort((a, b) => score(b) - score(a) || a.title.localeCompare(b.title, window.HubI18n?.locale || 'fr'));
    const english = document.documentElement.lang === 'en';
    status.textContent = english
      ? matches.length ? `${matches.length} result${matches.length > 1 ? 's' : ''}${matches.length > 8 ? ' · first 8 shown' : ''}` : 'No results. Try another word or clear the search.'
      : matches.length ? `${matches.length} résultat${matches.length > 1 ? "s" : ""}${matches.length > 8 ? " · 8 premiers affichés" : ""}` : "Aucun résultat. Essayez un autre mot ou effacez la recherche.";
    matches.slice(0, 8).forEach((entry) => {
      const item = document.createElement("li");
      const link = document.createElement("a");
      const context = document.createElement("small");
      const title = document.createElement("strong");
      link.href = `#${entry.id}`;
      context.textContent = entry.context;
      title.textContent = entry.title;
      link.append(context, title);
      item.append(link);
      results.append(item);
    });
  };
  input.addEventListener("input", render);
  document.addEventListener('hub:languagechange', () => { buildIndex(); if (input.value.trim()) render(); });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") { event.stopPropagation(); reset(); input.focus(); }
    if (event.key === "ArrowDown") { event.preventDefault(); results.querySelector("a")?.focus(); }
    if (event.key === "Enter") { event.preventDefault(); results.querySelector("a")?.click(); }
  });
  clear.addEventListener("click", () => { reset(); input.focus(); });
  results.addEventListener("click", (event) => {
    const link = event.target.closest("a");
    if (!link || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    event.stopPropagation();
    const id = link.hash.slice(1);
    reset();
    input.focus();
    if (window.location.hash === `#${id}`) showSection(id);
    else window.location.hash = id;
  });
};

const setupReadingFooters = () => {
  for (const category of Object.keys(labels)) {
    const pages = sections.filter((section) => section.dataset.category === category && !section.hasAttribute("data-page-pending"));
    pages.forEach((section, index) => {
      if (category === "news") return;
      const nav = document.createElement("nav");
      nav.className = "page-pager";
      nav.setAttribute("aria-label", "Continuer la lecture");
      [[pages[index - 1], "Page précédente"], [pages[index + 1], "Page suivante"]].forEach(([page, label], direction) => {
        if (!page) return;
        const link = document.createElement("a");
        const caption = document.createElement("small");
        const title = document.createElement("strong");
        link.href = `#${page.id}`;
        link.className = direction ? "page-pager-next" : "page-pager-previous";
        caption.textContent = label;
        title.textContent = `${direction ? "" : "← "}${sectionTitle(page)}${direction ? " →" : ""}`;
        link.append(caption, title);
        nav.append(link);
      });
      section.append(nav);
    });
  }
};

const activateCategory = (category) => {
  categoryLinks.forEach((link) => {
    const active = link.dataset.categoryLink === category;
    link.classList.toggle("active", active);
    if (active) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });

  sidebarNavs.forEach((nav) => {
    nav.hidden = nav.dataset.sidebarNav !== category;
  });
  if (sidebarTitle) {
    sidebarTitle.textContent = labels[category] || "Navigation";
  }
};

const activateSidebarLink = (id) => {
  const parentSectionId = sectionNavRoots.get(id) || subtabParentSections.get(id);

  sidebarLinks.forEach((link) => {
    const href = link.getAttribute("href");
    const exact = href === `#${id}`;
    const parent = !exact && parentSectionId && href === `#${parentSectionId}`;

    link.classList.toggle("active", exact);
    link.classList.toggle("active-parent", Boolean(parent));

    if (exact || parent) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });
};

const syncSidebarSubgroups = (id) => {
  const contextualParentId = sectionNavRoots.get(id) || subtabParentSections.get(id) || id;

  sidebarSubgroups.forEach((group) => {
    group.hidden = group.dataset.contextParent !== contextualParentId;
  });
};

const resolveSectionTarget = (id) => {
  const parentSectionId = subtabParentSections.get(id);

  if (parentSectionId) {
    return {
      target: sections.find((section) => section.id === parentSectionId) || defaultSection,
      activeNavId: id,
      subtabId: id,
    };
  }

  const anchor = document.getElementById(id);
  const containingSection = anchor?.closest("[data-section]");
  if (containingSection && anchor !== containingSection) {
    return { target: containingSection, activeNavId: id, subtabId: anchor.closest("[data-subtab-panel]")?.id || null, anchor };
  }

  const target = sections.find((section) => section.id === id) || defaultSection;

  return {
    target,
    activeNavId: target.id,
    subtabId: null,
  };
};

const showSection = (id, scroll = true) => {
  const { target, activeNavId, subtabId, anchor } = resolveSectionTarget(id);
  const fromMobileMenu = sidebar?.classList.contains('sidebar-open');
  const fromNavigation = fromMobileMenu || sidebar?.contains(document.activeElement) || document.activeElement?.closest("a[href], [data-page-jump]");

  sections.forEach((section) => {
    const active = section === target;
    section.classList.toggle("is-active", active);
    section.toggleAttribute("hidden", !active);
    section.setAttribute("aria-hidden", String(!active));
  });

  if (subtabId && subtabActivators.has(subtabId)) {
    subtabActivators.get(subtabId)(subtabId);
  } else if (sectionDefaultSubtabs.has(target.id) && sectionSubtabActivators.has(target.id)) {
    sectionSubtabActivators.get(target.id)(sectionDefaultSubtabs.get(target.id));
  }

  activateCategory(target.dataset.category || "news");
  activateSidebarLink(activeNavId);
  syncSidebarSubgroups(activeNavId);
  updateReadingNavigation(target, activeNavId);
  document.dispatchEvent(new CustomEvent('hub:sectionchange', { detail: { id: target.id } }));
  closeMenu();
  if (fromNavigation) {
    const heading = target.querySelector('h1, h2');
    if (heading) {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
  }
  if (scroll) {
    window.requestAnimationFrame(() => {
      if (!target.classList.contains("is-active")) return;
      if (anchor) scrollToReadingTarget(anchor);
      else window.scrollTo({ top: 0, behavior: "instant" });
    });
  }
};

const syncFromHash = () => {
  const requestedId = window.location.hash.replace("#", "") || "lore-the-hub";
  const oldShopFamilies = {
    'personnage-hub-armes': 'armes',
    'personnage-hub-gadgets': 'gadgets',
    'personnage-hub-implants': 'implants',
    'personnage-hub-mutations': 'mutations',
  };
  const shopFamily = oldShopFamilies[requestedId];
  const legacyCatalogue = requestedId === 'personnage-hub-catalogue';
  if (shopFamily) {
    window.shopInitialFamily = shopFamily;
    window.shopSetFamily?.(shopFamily);
  }
  const id =
    shopFamily || legacyCatalogue
      ? 'chroma-catalogue'
      : requestedId === "lore-pnj"
      ? "lore-factions"
      : requestedId === "lore-overview"
      ? "lore-the-hub"
      : requestedId === "pretire-general"
        ? "outils-pretires"
        : requestedId;

  if (requestedId !== id) {
    history.replaceState(null, "", `#${id}`);
  }

  showSection(id);
};

window.addEventListener("hashchange", syncFromHash);

subtabs.forEach((subtabRoot) => {
  const buttons = [...subtabRoot.querySelectorAll("[data-subtab-target]")];
  const panels = [...subtabRoot.querySelectorAll("[data-subtab-panel]")];
  const parentSection = subtabRoot.closest("[data-section]");

  const activateSubtab = (targetId) => {
    buttons.forEach((button) => {
      const active = button.dataset.subtabTarget === targetId;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
      button.tabIndex = active ? 0 : -1;
    });

    panels.forEach((panel) => {
      const active = panel.id === targetId;
      panel.classList.toggle("is-active", active);
      panel.hidden = !active;
    });
  };

  panels.forEach((panel) => {
    if (!parentSection) {
      return;
    }

    subtabParentSections.set(panel.id, parentSection.id);
    subtabActivators.set(panel.id, activateSubtab);
  });

  if (parentSection && buttons[0]) {
    sectionSubtabActivators.set(parentSection.id, activateSubtab);
    sectionDefaultSubtabs.set(parentSection.id, buttons[0].dataset.subtabTarget);
  }

  buttons.forEach((button, index) => {
    button.tabIndex = index === 0 ? 0 : -1;

    button.addEventListener("click", () => {
      const targetId = button.dataset.subtabTarget;
      activateSubtab(targetId);
      history.replaceState(null, "", `#${targetId}`);
      activateSidebarLink(targetId);
      if (parentSection) updateReadingNavigation(parentSection, targetId);
    });

    button.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowRight" && event.key !== "ArrowLeft" && event.key !== "Home" && event.key !== "End") {
        return;
      }

      event.preventDefault();

      let nextIndex = index;

      if (event.key === "ArrowRight") {
        nextIndex = (index + 1) % buttons.length;
      } else if (event.key === "ArrowLeft") {
        nextIndex = (index - 1 + buttons.length) % buttons.length;
      } else if (event.key === "Home") {
        nextIndex = 0;
      } else if (event.key === "End") {
        nextIndex = buttons.length - 1;
      }

      const nextButton = buttons[nextIndex];
      const targetId = nextButton.dataset.subtabTarget;
      activateSubtab(targetId);
      history.replaceState(null, "", `#${targetId}`);
      activateSidebarLink(targetId);
      if (parentSection) updateReadingNavigation(parentSection, targetId);
      nextButton.focus();
    });
  });
});

if (!window.location.hash) {
  history.replaceState(null, "", "#lore-the-hub");
}

setupBookSearch();
setupReadingFooters();
syncFromHash();

const protocolModal = document.querySelector("[data-protocol-modal]");
const protocolTriggers = [...document.querySelectorAll("[data-protocol-trigger]")];

if (protocolModal && protocolTriggers.length) {
  const protocolModalCard = protocolModal.querySelector(".protocol-modal-card");
  const protocolModalTitle = protocolModal.querySelector("[data-protocol-title]");
  const protocolModalMeta = protocolModal.querySelector("[data-protocol-meta]");
  const protocolModalContent = protocolModal.querySelector("[data-protocol-content]");
  let lastProtocolTrigger = null;

  const buildProtocolHeading = (trigger) => {
    const name = trigger.textContent.trim();
    const meta = trigger.dataset.protocolMeta?.trim() || "";
    const rankMatch = meta.match(/rang\s+\d+/i);

    if (!rankMatch) {
      return name;
    }

    return `${rankMatch[0].toLowerCase()} - ${name}`;
  };

  const stripProtocolLeadMeta = (container) => {
    while (container.firstElementChild?.matches("p")) {
      const raw = container.firstElementChild.textContent;
      const leadText = (window.HubI18n?.toFrench(raw) || raw).trim().toLowerCase();

      if (
        leadText.startsWith("impulsion de rang")
        || leadText.startsWith("protocole")
        || /^niveau\s+\d+/.test(leadText)
      ) {
        container.firstElementChild.remove();
        continue;
      }

      break;
    }
  };

  const closeProtocolModal = () => {
    if (protocolModal.hidden) {
      return;
    }

    protocolModal.hidden = true;
    document.body.classList.remove("protocol-modal-open");
    protocolModalContent.replaceChildren();
    protocolModalMeta.textContent = "";
    protocolModalMeta.hidden = true;
    document.removeEventListener("keydown", handleProtocolModalKeydown);

    if (lastProtocolTrigger) {
      lastProtocolTrigger.focus();
      lastProtocolTrigger = null;
    }
  };

  function handleProtocolModalKeydown(event) {
    if (event.key !== "Escape") {
      return;
    }

    event.preventDefault();
    closeProtocolModal();
  }

  const openProtocolModal = (trigger) => {
    const templateId = trigger.dataset.protocolTrigger;
    const template = document.getElementById(templateId);

    if (!template) {
      return;
    }

    lastProtocolTrigger = trigger;
    protocolModalTitle.textContent = buildProtocolHeading(trigger);

    const contentWrapper = document.createElement("div");
    contentWrapper.append(template.content.cloneNode(true));
    stripProtocolLeadMeta(contentWrapper);

    protocolModalMeta.textContent = "";
    protocolModalMeta.hidden = true;
    protocolModalContent.replaceChildren(...contentWrapper.childNodes);
    protocolModal.hidden = false;
    document.body.classList.add("protocol-modal-open");
    document.addEventListener("keydown", handleProtocolModalKeydown);
    window.requestAnimationFrame(() => protocolModalCard.focus());
  };

  protocolTriggers.forEach((trigger) => {
    trigger.addEventListener("click", (event) => {
      event.preventDefault();
      openProtocolModal(trigger);
    });
  });

  protocolModal.addEventListener("click", (event) => {
    if (!event.target.closest("[data-protocol-close]")) {
      return;
    }

    closeProtocolModal();
  });
}

const characterSheet = document.querySelector("[data-character-sheet]");

if (characterSheet) {
  const storageKey = "the-hub-character-sheet-v1";
  const editableControls = [...characterSheet.querySelectorAll("input, select, textarea")].filter((control) => {
    if (!control.name) {
      return false;
    }

    if (control.disabled || control.readOnly) {
      return false;
    }

    return control.type !== "button" && control.type !== "submit" && control.type !== "reset";
  });

  const abilityScoreInputs = new Map(
    [...characterSheet.querySelectorAll("[data-ability-score]")].map((input) => [input.dataset.abilityScore, input]),
  );
  const abilityModOutputs = new Map(
    [...characterSheet.querySelectorAll("[data-ability-mod]")].map((output) => [output.dataset.abilityMod, output]),
  );
  const saveProfInputs = new Map(
    [...characterSheet.querySelectorAll("[data-save-prof]")].map((input) => [input.dataset.saveProf, input]),
  );
  const saveTotalOutputs = new Map(
    [...characterSheet.querySelectorAll("[data-save-total]")].map((output) => [output.dataset.saveTotal, output]),
  );
  const skillRows = [...characterSheet.querySelectorAll("[data-skill]")];
  const skillProfInputs = new Map(
    [...characterSheet.querySelectorAll("[data-skill-prof]")].map((input) => [input.dataset.skillProf, input]),
  );
  const skillExpertiseInputs = new Map(
    [...characterSheet.querySelectorAll("[data-skill-expertise]")].map((input) => [input.dataset.skillExpertise, input]),
  );
  const skillTotalOutputs = new Map(
    [...characterSheet.querySelectorAll("[data-skill-total]")].map((output) => [output.dataset.skillTotal, output]),
  );
  const levelInput = characterSheet.querySelector("[data-level]");
  const proficiencyBonusOutput = characterSheet.querySelector("[data-proficiency-bonus]");
  const passivePerceptionOutput = characterSheet.querySelector("[data-passive-perception]");
  const initiativeTotalOutput = characterSheet.querySelector("[data-initiative-total]");
  const armorTypeSelect = characterSheet.querySelector("[data-armor-type]");
  const armorShieldInput = characterSheet.querySelector("[data-armor-shield]");
  const acTotalOutput = characterSheet.querySelector("[data-ac-total]");
  const acMiscInput = characterSheet.querySelector('[name="ac_misc"]');
  const acOverrideInput = characterSheet.querySelector('[name="ac_override"]');
  const printButtons = [...document.querySelectorAll("[data-print-target]")];
  const blankSheetButton = document.querySelector("[data-export-blank-sheet]");
  const resetButton = document.querySelector("[data-reset-sheet]");
  const sheetSaveStatus = document.querySelector("[data-sheet-save-status]");
  let blankSheetSnapshot = null;
  let printCleanupTimer = null;

  const clampLevel = (value) => Math.min(12, Math.max(1, value));
  const parseNumber = (value, fallback = 0) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const formatSigned = (value) => (value >= 0 ? `+${value}` : `${value}`);
  const getAbilityModifier = (score) => Math.floor((score - 10) / 2);
  const getProficiencyBonus = (level) => {
    if (level <= 3) {
      return 2;
    }

    if (level <= 6) {
      return 3;
    }

    if (level <= 9) {
      return 4;
    }

    return 5;
  };
  const readArmorClass = (dexterityModifier) => {
    const miscBonus = acMiscInput ? parseNumber(acMiscInput.value, 0) : 0;
    const overrideRaw = acOverrideInput ? acOverrideInput.value.trim() : "";

    if (overrideRaw) {
      return parseNumber(overrideRaw, 0);
    }

    let armorBase = 10;

    if (armorTypeSelect) {
      if (armorTypeSelect.value === "light") {
        armorBase = 12 + dexterityModifier;
      } else if (armorTypeSelect.value === "medium") {
        armorBase = 14 + Math.min(dexterityModifier, 2);
      } else if (armorTypeSelect.value === "heavy") {
        armorBase = 17;
      }
    }

    if (armorShieldInput?.checked) {
      armorBase += 2;
    }

    return armorBase + miscBonus;
  };

  const persistSheet = () => {
    try {
      const payload = {};

      editableControls.forEach((control) => {
        payload[control.name] = control.type === "checkbox" ? control.checked : control.value;
      });

      window.localStorage.setItem(storageKey, JSON.stringify(payload));
      if (sheetSaveStatus) {
        sheetSaveStatus.textContent = "Fiche enregistrée dans ce navigateur.";
        sheetSaveStatus.classList.remove("is-error");
      }
    } catch (error) {
      if (sheetSaveStatus) {
        sheetSaveStatus.textContent = "Sauvegarde locale indisponible. Exportez votre fiche avant de quitter.";
        sheetSaveStatus.classList.add("is-error");
      }
      console.warn("Unable to persist character sheet", error);
    }
  };

  const mergeLegacyText = (currentValue, sections) => {
    const existingText = typeof currentValue === "string" ? currentValue.trim() : "";
    const mergedParts = existingText ? [existingText] : [];

    sections.forEach(({ label, value }) => {
      const trimmedValue = typeof value === "string" ? value.trim() : "";

      if (!trimmedValue || existingText.includes(trimmedValue)) {
        return;
      }

      mergedParts.push(`${label} : ${trimmedValue}`);
    });

    return mergedParts.join("\n");
  };

  const restoreSheet = () => {
    try {
      const raw = window.localStorage.getItem(storageKey);

      if (!raw) {
        return;
      }

      const payload = JSON.parse(raw);

      editableControls.forEach((control) => {
        if (!(control.name in payload)) {
          return;
        }

        if (control.type === "checkbox") {
          control.checked = Boolean(payload[control.name]);
        } else {
          control.value = payload[control.name];
        }
      });

      const featuresInput = characterSheet.querySelector('[name="features"]');
      const notesInput = characterSheet.querySelector('[name="notes"]');

      if (notesInput) {
        notesInput.value = mergeLegacyText(notesInput.value, [
          { label: "Contact", value: payload.hook_contact },
          { label: "Dette", value: payload.hook_debt },
          { label: "Raison", value: payload.hook_reason },
          { label: "Ligne rouge", value: payload.hook_line },
          { label: "Signe distinctif", value: payload.hook_signature },
        ]);
      }
    } catch (error) {
      console.warn("Unable to restore character sheet", error);
    }
  };

  const recalculateSheet = () => {
    const level = clampLevel(parseNumber(levelInput?.value, 1));

    if (levelInput) {
      levelInput.value = String(level);
    }

    const proficiencyBonus = getProficiencyBonus(level);
    const abilityModifiers = {};

    abilityScoreInputs.forEach((input, ability) => {
      const score = parseNumber(input.value, 10);
      const modifier = getAbilityModifier(score);

      abilityModifiers[ability] = modifier;

      if (abilityModOutputs.has(ability)) {
        abilityModOutputs.get(ability).textContent = formatSigned(modifier);
      }

      if (saveTotalOutputs.has(ability)) {
        const saveTotal = modifier + (saveProfInputs.get(ability)?.checked ? proficiencyBonus : 0);
        saveTotalOutputs.get(ability).textContent = formatSigned(saveTotal);
      }
    });

    skillExpertiseInputs.forEach((input, skill) => {
      if (input.checked && skillProfInputs.has(skill)) {
        skillProfInputs.get(skill).checked = true;
      }
    });

    skillRows.forEach((row) => {
      const skill = row.dataset.skill;
      const linkedAbility = row.dataset.skillAbility;
      const modifier = abilityModifiers[linkedAbility] ?? 0;
      const isProficient = skillProfInputs.get(skill)?.checked ?? false;
      const hasExpertise = skillExpertiseInputs.get(skill)?.checked ?? false;
      const total = modifier + (isProficient ? proficiencyBonus : 0) + (hasExpertise ? proficiencyBonus : 0);

      if (skillTotalOutputs.has(skill)) {
        skillTotalOutputs.get(skill).textContent = formatSigned(total);
      }
    });

    if (proficiencyBonusOutput) {
      proficiencyBonusOutput.textContent = formatSigned(proficiencyBonus);
    }

    if (initiativeTotalOutput) {
      initiativeTotalOutput.textContent = formatSigned(abilityModifiers.dexterite ?? 0);
    }

    if (passivePerceptionOutput) {
      const perceptionText = skillTotalOutputs.get("perception")?.textContent ?? "0";
      const perceptionTotal = Number.parseInt(perceptionText, 10) || 0;
      passivePerceptionOutput.textContent = String(10 + perceptionTotal);
    }

    if (acTotalOutput) {
      acTotalOutput.textContent = String(readArmorClass(abilityModifiers.dexterite ?? 0));
    }

    persistSheet();
  };

  const restoreBlankSheet = () => {
    if (!blankSheetSnapshot) {
      return;
    }

    blankSheetSnapshot.controls.forEach(({ control, value, checked, selectedIndex }) => {
      if (control.type === "checkbox") {
        control.checked = checked;
      } else if (control.tagName === "SELECT") {
        control.selectedIndex = selectedIndex;
      } else {
        control.value = value;
      }
    });

    blankSheetSnapshot.outputs.forEach(({ output, text }) => {
      output.textContent = text;
    });

    blankSheetSnapshot = null;
    document.body.classList.remove("sheet-blank-print-mode");
  };

  const prepareBlankSheet = () => {
    const outputs = [...characterSheet.querySelectorAll("output")];

    blankSheetSnapshot = {
      controls: editableControls.map((control) => ({
        control,
        value: control.value,
        checked: control.checked,
        selectedIndex: control.selectedIndex,
      })),
      outputs: outputs.map((output) => ({ output, text: output.textContent })),
    };

    editableControls.forEach((control) => {
      if (control.type === "checkbox") {
        control.checked = false;
      } else if (control.tagName === "SELECT") {
        control.selectedIndex = -1;
      } else {
        control.value = "";
      }
    });

    outputs.forEach((output) => {
      output.textContent = "";
    });

    document.body.classList.add("sheet-blank-print-mode");
  };

  const clearPrintMode = () => {
    if (printCleanupTimer) {
      window.clearTimeout(printCleanupTimer);
      printCleanupTimer = null;
    }

    restoreBlankSheet();
    document.body.classList.remove("sheet-print-mode");
    delete document.body.dataset.printTarget;
    document.querySelectorAll(".print-target-section").forEach((element) => element.classList.remove("print-target-section"));
    document.querySelectorAll(".print-target-sheet").forEach((element) => element.classList.remove("print-target-sheet"));
  };

  const printSheet = (targetId, { blank = false } = {}) => {
    const targetSheet = targetId ? document.getElementById(targetId) : null;
    const targetSection = targetSheet?.closest("[data-section]");

    if (!targetId || !targetSheet) {
      return;
    }

    clearPrintMode();

    if (blank) {
      prepareBlankSheet();
    }

    document.body.classList.add("sheet-print-mode");
    document.body.dataset.printTarget = targetId;
    targetSheet.classList.add("print-target-sheet");
    targetSection?.classList.add("print-target-section");

    window.requestAnimationFrame(() => {
      window.print();
      printCleanupTimer = window.setTimeout(clearPrintMode, 1500);
    });
  };

  editableControls.forEach((control) => {
    control.addEventListener("input", recalculateSheet);
    control.addEventListener("change", recalculateSheet);
  });

  if (resetButton) {
    resetButton.addEventListener("click", () => {
      const message = "Effacer la fiche et supprimer les donnees locales ?";
      const confirmed = window.confirm(window.HubI18n?.t(message) || message);

      if (!confirmed) {
        return;
      }

      characterSheet.reset();

      try {
        window.localStorage.removeItem(storageKey);
      } catch (error) {
        console.warn("Unable to clear character sheet storage", error);
      }

      recalculateSheet();
    });
  }

  printButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const targetId = button.dataset.printTarget?.trim();
      printSheet(targetId);
    });
  });

  if (blankSheetButton) {
    blankSheetButton.addEventListener("click", () => {
      const targetId = blankSheetButton.dataset.exportBlankSheet?.trim();
      printSheet(targetId, { blank: true });
    });
  }

  window.addEventListener("afterprint", clearPrintMode);

  restoreSheet();
  recalculateSheet();
}
