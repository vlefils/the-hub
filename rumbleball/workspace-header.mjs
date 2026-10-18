// The same live controls are docked into the application header; no copies.
// Embedded instances and the test DOM keep their ordinary inline navigation.
export function workspaceHeader({ context, navigation, tools } = {}) {
  const slots = { context: document.querySelector('[data-shell-context]'), navigation: document.querySelector('[data-shell-nav]'), tools: document.querySelector('[data-shell-tools]') };
  for (const [key, value] of Object.entries({ context, navigation, tools })) {
    if (!slots[key] || value === undefined) continue;
    slots[key].replaceChildren(...(value ? [value] : [])); slots[key].hidden = !value;
  }
  return Boolean(slots.context && slots.navigation);
}
