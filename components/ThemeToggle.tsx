"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";

type Theme = "system" | "light" | "dark";

const THEME_EVENT = "fitt-theme-change";

/** Apply the theme by toggling the <html> class (CSS @media handles "system"). */
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

const OPTIONS: { key: Theme; Icon: typeof Monitor; label: string }[] = [
  { key: "system", Icon: Monitor, label: "ตามเครื่อง" },
  { key: "light", Icon: Sun, label: "สว่าง" },
  { key: "dark", Icon: Moon, label: "มืด" },
];

/** Segmented System / Light / Dark control. Persists choice in localStorage. */
export default function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const choose = (t: Theme) => {
    try {
      localStorage.setItem("fitt-theme", t);
    } catch {
      /* private mode — non-fatal */
    }
    applyTheme(t);
    window.dispatchEvent(new Event(THEME_EVENT));
  };

  return (
    <div className="inline-flex items-center gap-0.5 rounded-full border border-night-edge bg-night p-0.5">
      {OPTIONS.map(({ key, Icon, label }) => (
        <button
          key={key}
          type="button"
          onClick={() => choose(key)}
          title={label}
          aria-label={label}
          aria-pressed={theme === key}
          className={`grid h-7 w-7 place-items-center rounded-full transition ${
            theme === key ? "bg-shine text-night" : "text-chalk-dim hover:text-chalk"
          }`}
        >
          <Icon size={14} />
        </button>
      ))}
    </div>
  );
}
