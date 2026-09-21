"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronDown, Sparkles } from "lucide-react";
import { useSkills } from "@/lib/skills/use-skills";
import SkillIcon from "./SkillIcon";

interface SkillDropdownProps {
  /** Selected skill id, or null = Auto (let the AI detect). */
  value: string | null;
  onChange: (id: string | null) => void;
}

/** Tallest the menu may be, however much room the side it opens on has. */
const MENU_MAX_PX = 360;
/** Kept clear of the fixed header, which the viewport alone knows nothing about. */
const HEADER_PX = 64;
/** Breathing room between the pill and the menu. */
const GAP_PX = 10;

/**
 * AI-Studio-style domain selector: a pill button that opens a rich dropdown of
 * skill templates (icon + name + tagline + checkmark), with an "Auto" option.
 */
export default function SkillDropdown({ value, onChange }: SkillDropdownProps) {
  const [open, setOpen] = useState(false);
  const skills = useSkills();
  const selected = skills.find((s) => s.id === value);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [place, setPlace] = useState({ drop: false, max: MENU_MAX_PX });

  /**
   * Open on whichever side has more room, and never grow past it.
   *
   * The menu opened upwards unconditionally, which is right in the studio where
   * this pill sits at the bottom of the chat box, and wrong on the landing page
   * where the same pill sits high and the list ran off the top of the screen with
   * its first items unreachable.
   *
   * "Does it fit?" turned out to be the wrong question: a menu can fit the viewport
   * and still tuck under the fixed header, which is what happened on the first
   * attempt at this fix. Choosing the roomier side and capping the height to that
   * room answers the question that actually matters, and needs no caller to pass a
   * hint that it could get wrong.
   */
  useLayoutEffect(() => {
    if (!open) return;
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const above = rect.top - HEADER_PX - GAP_PX;
    const below = window.innerHeight - rect.bottom - GAP_PX;
    const drop = below > above;
    setPlace({ drop, max: Math.max(160, Math.min(MENU_MAX_PX, drop ? below : above)) });
  }, [open]);

  function pick(id: string | null) {
    onChange(id);
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-full border border-chalk/15 bg-chalk/5 px-3 py-1.5 text-sm text-chalk/85 transition hover:border-chalk/30"
      >
        {selected ? (
          <SkillIcon name={selected.icon} size={14} />
        ) : (
          <Sparkles size={14} className="text-shine" />
        )}
        <span className="max-w-[12rem] truncate">{selected ? selected.name : "เลือกประเภท (Auto)"}</span>
        <ChevronDown size={14} className={`transition ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: place.drop ? -8 : 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: place.drop ? -8 : 8, scale: 0.96 }}
              transition={{ duration: 0.16, ease: "easeOut" }}
              style={{ maxHeight: place.max }}
              className={
                "scroll-thin absolute left-0 z-50 w-80 max-w-[90vw] overflow-y-auto rounded-2xl border border-chalk/12 bg-night-panel p-1.5 shadow-2xl " +
                (place.drop ? "top-full mt-2 origin-top-left" : "bottom-full mb-2 origin-bottom-left")
              }
            >
            <Row
              icon={<Sparkles size={18} className="text-shine" />}
              title="ให้ AI เดาให้ (Auto)"
              desc="ตรวจจับโดเมนจากสิ่งที่คุณพิมพ์ แล้วถามแบบผู้เชี่ยวชาญ"
              selected={value === null}
              onClick={() => pick(null)}
            />
            <div className="my-1 h-px bg-chalk/8" />
            {skills.map((s) => (
              <Row
                key={s.id}
                icon={<SkillIcon name={s.icon} size={18} />}
                title={s.name}
                desc={s.tagline}
                selected={value === s.id}
                onClick={() => pick(s.id)}
              />
            ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function Row({
  icon,
  title,
  desc,
  selected,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition ${
        selected ? "bg-chalk/10 light:bg-selected light:text-selected-ink" : "hover:bg-chalk/5"
      }`}
    >
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-sm font-medium text-chalk">{title}</span>
        <span className="mt-0.5 block text-xs leading-snug text-chalk/55 light:text-chalk-dim">{desc}</span>
      </span>
      {selected && <Check size={16} className="mt-0.5 shrink-0 text-chalk/80 light:text-selected-ink" />}
    </button>
  );
}
