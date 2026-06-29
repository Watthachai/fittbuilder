"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";

export type Theme = "system" | "light" | "dark";

const THEME_EVENT = "fitt-theme-change";

/** The three theme choices, shared by the floating pill and the account menu. */
export const THEME_OPTIONS: { key: Theme; Icon: typeof Monitor; label: string }[] = [
  { key: "system", Icon: Monitor, label: "ตามเครื่อง" },
  { key: "light", Icon: Sun, label: "สว่าง" },
  { key: "dark", Icon: Moon, label: "มืด" },
];

function applyTheme(theme: Theme) {
  const cls = document.documentElement.classList;
  cls.remove("light", "dark");
  if (theme === "light" || theme === "dark") cls.add(theme);
}
function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(THEME_EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(THEME_EVENT, cb);
  };
}
function getSnapshot(): Theme {
  const t = localStorage.getItem("fitt-theme");
  return t === "light" || t === "dark" ? t : "system";
}
const getServerSnapshot = (): Theme => "system";

/**
 * Theme state backed by localStorage + a window event, so every mount (the
 * floating pill, the account menu) stays in sync. The no-FOUC bootstrap in
 * app/layout.tsx applies the saved theme before paint using the same key.
 */
export function useTheme(): [Theme, (t: Theme) => void] {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const setTheme = (t: Theme) => {
    try {
      localStorage.setItem("fitt-theme", t);
    } catch {
      /* private mode — non-fatal */
    }
    applyTheme(t);
    window.dispatchEvent(new Event(THEME_EVENT));
  };
  return [theme, setTheme];
}
