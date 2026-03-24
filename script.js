const menuToggle = document.querySelector(".menu-toggle");
const menu = document.querySelector("#menu-principal");
const menuLinks = menu ? menu.querySelectorAll("a") : [];
const tocLinks = document.querySelectorAll(".toc a");
const sectionLinks = [...menuLinks, ...tocLinks];
const sections = document.querySelectorAll("[data-section]");

if (menuToggle && menu) {
  menuToggle.addEventListener("click", () => {
    const isOpen = menu.classList.toggle("is-open");
    menuToggle.setAttribute("aria-expanded", String(isOpen));
  });

  sectionLinks.forEach((link) => {
    link.addEventListener("click", () => {
      menu.classList.remove("is-open");
      menuToggle.setAttribute("aria-expanded", "false");
    });
  });
}

const setActiveLink = (id) => {
  tocLinks.forEach((link) => {
    const isActive = link.getAttribute("href") === `#${id}`;
    link.classList.toggle("active", isActive);
    if (isActive) {
      link.setAttribute("aria-current", "true");
    } else {
      link.removeAttribute("aria-current");
    }
  });
};

if ("IntersectionObserver" in window && sections.length > 0) {
  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

      if (visible) {
        setActiveLink(visible.target.id);
      }
    },
    {
      rootMargin: "-30% 0px -55% 0px",
      threshold: [0.2, 0.4, 0.7],
    }
  );

  sections.forEach((section) => observer.observe(section));
}

const anchorLinks = document.querySelectorAll(".anchor-link");

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

      try {
        await navigator.clipboard.writeText(absoluteUrl);
        link.textContent = "Lien copie";
        window.setTimeout(() => {
          link.textContent = "Lien direct";
        }, 1400);
      } catch {
        window.location.hash = href.slice(1);
      }
    }
  });
});

const initialHash = window.location.hash.replace("#", "");
if (initialHash) {
  setActiveLink(initialHash);
} else if (sections[0]) {
  setActiveLink(sections[0].id);
}
