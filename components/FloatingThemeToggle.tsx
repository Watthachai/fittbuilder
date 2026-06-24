"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";

type Theme = "system" | "light" | "dark";

const THEME_EVENT = "fitt-theme-change";

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

/** Small hover tooltip (liquid glass), positioned above its child. */
function Tip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="group/tip relative inline-flex">
      {children}
      <span className="glass pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg px-2.5 py-1 text-xs text-chalk opacity-0 transition-opacity duration-150 group-hover/tip:opacity-100">
        {label}
      </span>
    </span>
  );
}

/** Floating Liquid-Glass cluster (bottom-right): version → changelog + theme switcher. */
export default function FloatingThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const activeIndex = Math.max(0, OPTIONS.findIndex((o) => o.key === theme));

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
    <div className="fixed bottom-5 right-5 z-[60] flex items-center gap-2 print:hidden">
      {/* Theme switcher — liquid glass pill with sliding indicator */}
      <div className="glass relative flex items-center rounded-full p-1">
        {/* sliding indicator */}
        <span
          aria-hidden
          className="absolute left-1 top-1 h-9 w-9 rounded-full bg-chalk/12 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)] transition-transform duration-300 ease-[cubic-bezier(0.5,0,0,1)]"
          style={{ transform: `translateX(${activeIndex * 36}px)` }}
        />
        {OPTIONS.map(({ key, Icon, label }) => (
          <Tip key={key} label={label}>
            <button
              type="button"
              onClick={() => choose(key)}
              aria-label={label}
              aria-pressed={theme === key}
              className={`relative z-10 grid h-9 w-9 place-items-center rounded-full transition-all duration-200 ${
                theme === key ? "text-chalk" : "text-chalk-dim hover:scale-110 hover:text-shine"
              }`}
            >
              <Icon size={16} />
            </button>
          </Tip>
        ))}
      </div>
    </div>
  );
}
