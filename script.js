const menuToggle = document.querySelector(".menu-toggle");
const categoryMenu = document.querySelector("#menu-categories");
const categoryLinks = [...document.querySelectorAll("[data-category-link]")];
const sidebarTitle = document.querySelector("[data-sidebar-title]");
const sidebarNavs = [...document.querySelectorAll("[data-sidebar-nav]")];
const sidebarLinks = [...document.querySelectorAll(".sidebar a")];
const sections = [...document.querySelectorAll("[data-section]")];
const subtabs = [...document.querySelectorAll("[data-subtabs]")];
const sidebarSubgroups = [...document.querySelectorAll(".sidebar-subgroup")];
const defaultSection = sections.find((section) => section.id === "lore-the-hub") || sections[0];
const sectionNavRoots = new Map(
  sections
    .filter((section) => section.dataset.navRoot)
    .map((section) => [section.id, section.dataset.navRoot]),
);
const subtabParentSections = new Map();
const subtabActivators = new Map();
const sectionSubtabActivators = new Map();
const sectionDefaultSubtabs = new Map();

const closeMenu = () => {
  if (!menuToggle || !categoryMenu) {
    return;
  }

  categoryMenu.classList.remove("is-open");
  menuToggle.setAttribute("aria-expanded", "false");
};

if (menuToggle && categoryMenu) {
  menuToggle.addEventListener("click", () => {
    const isOpen = categoryMenu.classList.toggle("is-open");
    menuToggle.setAttribute("aria-expanded", String(isOpen));
  });
}

const labels = {
  news: "News",
  lore: "Lore",
  regles: "Regles",
  personnage: "Personnage",
  outils: "Outils",
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

  const target = sections.find((section) => section.id === id) || defaultSection;

  return {
    target,
    activeNavId: target.id,
    subtabId: null,
  };
};

const showSection = (id) => {
  const { target, activeNavId, subtabId } = resolveSectionTarget(id);

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
  closeMenu();
  window.scrollTo({ top: 0, behavior: "smooth" });
};

const syncFromHash = () => {
  const requestedId = window.location.hash.replace("#", "") || "lore-the-hub";
  const id = requestedId === "lore-overview" ? "lore-the-hub" : requestedId;

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
      nextButton.focus();
    });
  });
});

if (!window.location.hash) {
  history.replaceState(null, "", "#lore-the-hub");
}

syncFromHash();
