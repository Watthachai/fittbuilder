"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronDown, Sparkles } from "lucide-react";
import { SKILLS, getSkill } from "@/lib/skills/registry";
import SkillIcon from "./SkillIcon";

interface SkillDropdownProps {
  /** Selected skill id, or null = Auto (let the AI detect). */
  value: string | null;
  onChange: (id: string | null) => void;
}

/**
 * AI-Studio-style domain selector: a pill button that opens a rich dropdown of
 * skill templates (icon + name + tagline + checkmark), with an "Auto" option.
 */
export default function SkillDropdown({ value, onChange }: SkillDropdownProps) {
  const [open, setOpen] = useState(false);
  const selected = getSkill(value);

  function pick(id: string | null) {
    onChange(id);
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-white/85 transition hover:border-white/30"
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
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ duration: 0.16, ease: "easeOut" }}
              className="absolute bottom-full left-0 z-50 mb-2 w-80 max-w-[90vw] origin-bottom-left overflow-hidden rounded-2xl border border-white/12 bg-[#15151c] p-1.5 shadow-2xl"
            >
            <Row
              icon={<Sparkles size={18} className="text-shine" />}
              title="ให้ AI เดาให้ (Auto)"
              desc="ตรวจจับโดเมนจากสิ่งที่คุณพิมพ์ แล้วถามแบบผู้เชี่ยวชาญ"
              selected={value === null}
              onClick={() => pick(null)}
            />
            <div className="my-1 h-px bg-white/8" />
            {SKILLS.map((s) => (
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
        selected ? "bg-white/10" : "hover:bg-white/5"
      }`}
    >
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-sm font-medium text-white">{title}</span>
        <span className="mt-0.5 block text-xs leading-snug text-white/55">{desc}</span>
      </span>
      {selected && <Check size={16} className="mt-0.5 shrink-0 text-white/80" />}
    </button>
  );
}
