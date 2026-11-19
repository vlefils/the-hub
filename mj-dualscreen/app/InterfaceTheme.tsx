"use client";

import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
  window.addEventListener("interface-theme-change", onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener("interface-theme-change", onChange);
    window.removeEventListener("storage", onChange);
  };
}

function readTheme(): "light" | "dark" {
  try { return localStorage.getItem("mj-design-theme") === "light" ? "light" : "dark"; }
  catch { return "dark"; }
}

export function useInterfaceTheme() {
  const theme = useSyncExternalStore(subscribe, readTheme, () => "dark" as const);
  return {
    theme,
    toggleTheme() {
      try { localStorage.setItem("mj-design-theme", theme === "dark" ? "light" : "dark"); }
      catch { return; }
      window.dispatchEvent(new Event("interface-theme-change"));
    },
  };
}

export function ThemeSwitch({ theme, onToggle }: { theme: "light" | "dark"; onToggle: () => void }) {
  return <button type="button" className="theme-switch" onClick={onToggle} aria-label={theme === "dark" ? "Passer au thème clair" : "Passer au thème sombre"}>
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      {theme === "dark" ? <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></> : <path d="M20 15A8.5 8.5 0 0 1 9 4a8.5 8.5 0 1 0 11 11Z" />}
    </svg><span>{theme === "dark" ? "Clair" : "Sombre"}</span>
  </button>;
}
