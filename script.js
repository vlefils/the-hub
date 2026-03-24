const menuToggle = document.querySelector(".menu-toggle");
const categoryMenu = document.querySelector("#menu-categories");
const categoryLinks = [...document.querySelectorAll("[data-category-link]")];
const sidebarTitle = document.querySelector("[data-sidebar-title]");
const sidebarNavs = [...document.querySelectorAll("[data-sidebar-nav]")];
const sidebarLinks = [...document.querySelectorAll(".sidebar a")];
const sections = [...document.querySelectorAll("[data-section]")];
const anchorLinks = [...document.querySelectorAll(".anchor-link")];

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
  sidebarLinks.forEach((link) => {
    const active = link.getAttribute("href") === `#${id}`;
    link.classList.toggle("active", active);
    if (active) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });
};

const showSection = (id) => {
  const fallback = sections[0];
  const target = sections.find((section) => section.id === id) || fallback;

  sections.forEach((section) => {
    const active = section === target;
    section.classList.toggle("is-active", active);
    section.toggleAttribute("hidden", !active);
    section.setAttribute("aria-hidden", String(!active));
  });

  activateCategory(target.dataset.category || "news");
  activateSidebarLink(target.id);
  closeMenu();
  window.scrollTo({ top: 0, behavior: "smooth" });
};

const syncFromHash = () => {
  const id = window.location.hash.replace("#", "") || "news-overview";
  showSection(id);
};

window.addEventListener("hashchange", syncFromHash);

anchorLinks.forEach((link) => {
  link.addEventListener("click", async (event) => {
    const href = link.getAttribute("href");
    if (!href) {
      return;
    }

    const absoluteUrl = new URL(href, window.location.href).toString();

    if (navigator.clipboard?.writeText) {
      event.preventDefault();
      history.replaceState(null, "", href);
      showSection(href.slice(1));

      try {
        await navigator.clipboard.writeText(absoluteUrl);
        link.textContent = "Lien copie";
        window.setTimeout(() => {
          link.textContent = "Lien direct";
        }, 1400);
      } catch {
        syncFromHash();
      }
    }
  });
});

if (!window.location.hash) {
  history.replaceState(null, "", "#news-overview");
}

syncFromHash();
