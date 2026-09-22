"use client";

/**
 * The demo system's own theme, independent of FITT Builder's.
 *
 * `dark:` resolves against a `.dark` ancestor, and the app's own theme sits on
 * <html> — so a class on the ERP wrapper could turn dark on but never off. The
 * page takes the root over while it is mounted and hands it back on the way out.
 */
const KEY = "fitt-erp-theme";
export type Theme = "light" | "dark";

export function readTheme(): Theme {
  try {
    const saved = window.localStorage.getItem(KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    // Blocked storage just means the session starts on the system preference.
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.classList.toggle("light", theme === "light");
  try {
    window.localStorage.setItem(KEY, theme);
  } catch {
    // The class is already applied; only the memory of it is lost.
  }
}

/** Puts back whatever FITT Builder had on the root before /erp took it over. */
export function captureRoot() {
  const root = document.documentElement;
  const had = { dark: root.classList.contains("dark"), light: root.classList.contains("light") };
  return () => {
    root.classList.toggle("dark", had.dark);
    root.classList.toggle("light", had.light);
  };
}
