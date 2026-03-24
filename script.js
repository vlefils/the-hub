const menuToggle = document.querySelector(".menu-toggle");
const menu = document.querySelector("#menu-principal");
const menuLinks = menu ? [...menu.querySelectorAll("a")] : [];
const tocLinks = [...document.querySelectorAll(".toc a")];
const navLinks = [...menuLinks, ...tocLinks];
const sections = [...document.querySelectorAll("[data-section]")];
const anchorLinks = [...document.querySelectorAll(".anchor-link")];

const closeMenu = () => {
  if (!menuToggle || !menu) {
    return;
  }

  menu.classList.remove("is-open");
  menuToggle.setAttribute("aria-expanded", "false");
};

if (menuToggle && menu) {
  menuToggle.addEventListener("click", () => {
    const isOpen = menu.classList.toggle("is-open");
    menuToggle.setAttribute("aria-expanded", String(isOpen));
  });
}

const showSection = (id) => {
  const targetId = sections.some((section) => section.id === id) ? id : "accueil";

  sections.forEach((section) => {
    const isActive = section.id === targetId;
    section.classList.toggle("is-active", isActive);
    section.toggleAttribute("hidden", !isActive);
    if (isActive) {
      section.removeAttribute("aria-hidden");
    } else {
      section.setAttribute("aria-hidden", "true");
    }
  });

  navLinks.forEach((link) => {
    const isActive = link.getAttribute("href") === `#${targetId}`;
    link.classList.toggle("active", isActive);
    if (isActive) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });

  closeMenu();
  window.scrollTo({ top: 0, behavior: "smooth" });
};

const syncFromHash = () => {
  const currentId = window.location.hash.replace("#", "") || "accueil";
  showSection(currentId);
};

navLinks.forEach((link) => {
  link.addEventListener("click", () => {
    window.setTimeout(syncFromHash, 0);
  });
});

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
  history.replaceState(null, "", "#accueil");
}

syncFromHash();
