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

const protocolModal = document.querySelector("[data-protocol-modal]");
const protocolTriggers = [...document.querySelectorAll("[data-protocol-trigger]")];
const hubWeaponModal = document.querySelector("[data-hub-weapon-modal]");
const hubWeaponTriggers = [...document.querySelectorAll("[data-hub-weapon-trigger]")];

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
      const leadText = container.firstElementChild.textContent.trim().toLowerCase();

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

if (hubWeaponModal && hubWeaponTriggers.length) {
  const hubWeaponModalCard = hubWeaponModal.querySelector(".protocol-modal-card");
  const hubWeaponModalTitle = hubWeaponModal.querySelector("[data-hub-weapon-title]");
  const hubWeaponModalMeta = hubWeaponModal.querySelector("[data-hub-weapon-meta]");
  const hubWeaponModalContent = hubWeaponModal.querySelector("[data-hub-weapon-content]");
  let lastHubWeaponTrigger = null;

  const closeHubWeaponModal = () => {
    if (hubWeaponModal.hidden) {
      return;
    }

    hubWeaponModal.hidden = true;
    document.body.classList.remove("protocol-modal-open");
    hubWeaponModalContent.replaceChildren();
    hubWeaponModalMeta.textContent = "";
    hubWeaponModalMeta.hidden = true;
    document.removeEventListener("keydown", handleHubWeaponModalKeydown);

    if (lastHubWeaponTrigger) {
      lastHubWeaponTrigger.focus();
      lastHubWeaponTrigger = null;
    }
  };

  function handleHubWeaponModalKeydown(event) {
    if (event.key !== "Escape") {
      return;
    }

    event.preventDefault();
    closeHubWeaponModal();
  }

  const openHubWeaponModal = (trigger) => {
    const templateId = trigger.dataset.hubWeaponTrigger;
    const template = document.getElementById(templateId);

    if (!template) {
      return;
    }

    lastHubWeaponTrigger = trigger;
    hubWeaponModalTitle.textContent = trigger.dataset.hubWeaponTitle?.trim() || "Arme du Hub";

    const meta = trigger.dataset.hubWeaponMeta?.trim() || "";
    hubWeaponModalMeta.textContent = meta;
    hubWeaponModalMeta.hidden = !meta;
    hubWeaponModalContent.replaceChildren(template.content.cloneNode(true));
    hubWeaponModal.hidden = false;
    document.body.classList.add("protocol-modal-open");
    document.addEventListener("keydown", handleHubWeaponModalKeydown);
    window.requestAnimationFrame(() => hubWeaponModalCard.focus());
  };

  hubWeaponTriggers.forEach((trigger) => {
    trigger.addEventListener("click", (event) => {
      event.preventDefault();
      openHubWeaponModal(trigger);
    });
  });

  hubWeaponModal.addEventListener("click", (event) => {
    if (!event.target.closest("[data-hub-weapon-close]")) {
      return;
    }

    closeHubWeaponModal();
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
  const exportButton = document.querySelector("[data-export-sheet]");
  const resetButton = document.querySelector("[data-reset-sheet]");

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
    } catch (error) {
      console.warn("Unable to persist character sheet", error);
    }
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

  const clearPrintMode = () => {
    document.body.classList.remove("sheet-print-mode");
  };

  editableControls.forEach((control) => {
    control.addEventListener("input", recalculateSheet);
    control.addEventListener("change", recalculateSheet);
  });

  if (resetButton) {
    resetButton.addEventListener("click", () => {
      const confirmed = window.confirm("Effacer la fiche et supprimer les donnees locales ?");

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

  if (exportButton) {
    exportButton.addEventListener("click", () => {
      document.body.classList.add("sheet-print-mode");
      window.requestAnimationFrame(() => window.print());
      window.setTimeout(clearPrintMode, 1500);
    });
  }

  window.addEventListener("afterprint", clearPrintMode);

  restoreSheet();
  recalculateSheet();
}
