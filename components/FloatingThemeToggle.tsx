"use client";

import { useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useDismiss } from "@/lib/useDismiss";

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

/** Floating glass theme switcher, bottom-right on every page. */
export default function FloatingThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [open, setOpen] = useState(false);
  const Current = (OPTIONS.find((o) => o.key === theme) ?? OPTIONS[0]).Icon;

  useDismiss(open, () => setOpen(false));

  const choose = (t: Theme) => {
    try {
      localStorage.setItem("fitt-theme", t);
    } catch {
      /* private mode — non-fatal */
    }
    applyTheme(t);
    window.dispatchEvent(new Event(THEME_EVENT));
    setOpen(false);
  };

  return (
    <div className="fixed bottom-5 right-5 z-[60] flex flex-col items-end gap-2 print:hidden">
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 -z-10" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16, ease: "easeOut" }}
              className="glass flex flex-col gap-1 rounded-2xl p-1.5 shadow-xl"
            >
              {OPTIONS.map(({ key, Icon, label }) => (
                <button
                  key={key}
                  onClick={() => choose(key)}
                  className={`flex items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition ${
                    theme === key
                      ? "bg-shine text-night"
                      : "text-chalk-dim hover:bg-chalk/10 hover:text-chalk"
                  }`}
                >
                  <Icon size={15} />
                  {label}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="สลับธีม"
        className="glass grid h-11 w-11 place-items-center rounded-full text-chalk shadow-lg transition hover:text-shine"
      >
        <Current size={18} />
      </button>
    </div>
  );
}
