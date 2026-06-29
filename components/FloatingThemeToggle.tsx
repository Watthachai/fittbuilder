"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useDismiss } from "@/lib/useDismiss";
import { THEME_OPTIONS, useTheme, type Theme } from "@/lib/useTheme";

/**
 * Floating glass theme switcher. To stay out of the way it hides at the right
 * edge, peeking just enough to find, and slides fully out on hover/focus (or
 * while its menu is open). Reduced-motion users get it fully revealed.
 */
export default function FloatingThemeToggle() {
  const [theme, setTheme] = useTheme();
  const [open, setOpen] = useState(false);
  const Current = (THEME_OPTIONS.find((o) => o.key === theme) ?? THEME_OPTIONS[0]).Icon;

  useDismiss(open, () => setOpen(false));

  const choose = (t: Theme) => {
    setTheme(t);
    setOpen(false);
  };

  return (
    <div className="group fixed bottom-6 right-0 z-[60] print:hidden">
      <div
        className={`flex flex-col items-end gap-2 pr-5 transition-transform duration-300 ease-out motion-reduce:!translate-x-0 ${
          open
            ? "translate-x-0"
            : "translate-x-[58%] group-hover:translate-x-0 group-focus-within:translate-x-0"
        }`}
      >
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16, ease: "easeOut" }}
              className="glass flex flex-col gap-1 rounded-2xl p-1.5 shadow-xl"
            >
              {THEME_OPTIONS.map(({ key, Icon, label }) => (
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
    </div>
  );
}
