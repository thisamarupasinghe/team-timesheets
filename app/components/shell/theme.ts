"use client";

export type Theme = "light" | "dark";
const KEY = "tt-theme";

export function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

/** Applies and remembers a theme, and tells every toggle on the page. */
export function setTheme(t: Theme) {
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem(KEY, t); } catch { /* private mode */ }
  window.dispatchEvent(new CustomEvent<Theme>("tt:theme", { detail: t }));
}

/** True while the person hasn't picked a theme, so the site follows the operating system. */
export function followsSystem() {
  try { const t = localStorage.getItem(KEY); return t !== "light" && t !== "dark"; } catch { return true; }
}
