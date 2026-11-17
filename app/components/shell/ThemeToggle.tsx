"use client";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { followsSystem, setTheme, type Theme } from "./theme";

/** One button: light ⇄ dark. Until it's first pressed, the site follows the operating system. */
export default function ThemeToggle() {
  const [theme, setT] = useState<Theme | null>(null);

  useEffect(() => {
    const mq = matchMedia("(prefers-color-scheme: dark)");
    // Re-apply the saved (or system) theme in case a re-render dropped the attribute set before paint
    let saved: string | null = null;
    try { saved = localStorage.getItem("tt-theme"); } catch { /* private mode */ }
    const initial: Theme = saved === "light" || saved === "dark" ? saved : mq.matches ? "dark" : "light";
    document.documentElement.dataset.theme = initial;
    setT(initial);
    const onTheme = (e: Event) => setT((e as CustomEvent<Theme>).detail);
    const onSystem = () => {
      if (!followsSystem()) return;
      const t: Theme = mq.matches ? "dark" : "light";
      document.documentElement.dataset.theme = t;
      setT(t);
    };
    window.addEventListener("tt:theme", onTheme);
    mq.addEventListener("change", onSystem);
    return () => { window.removeEventListener("tt:theme", onTheme); mq.removeEventListener("change", onSystem); };
  }, []);

  const dark = theme === "dark";
  const label = dark ? "Switch to light mode" : "Switch to dark mode";
  return (
    <button type="button" className="btn btn-ghost btn-icon tb-icon theme-toggle" onClick={() => setTheme(dark ? "light" : "dark")} aria-label={label} title={label}>
      {/* Both icons render; CSS shows the right one so there's no flash before hydration */}
      <Sun className="i-sun" aria-hidden="true" />
      <Moon className="i-moon" aria-hidden="true" />
    </button>
  );
}
