"use client";

import { useState } from "react";
import {
  CalendarCheck,
  Factory,
  LayoutDashboard,
  Loader2,
  Rocket,
  ShoppingCart,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";
import { SKILLS, getSkill } from "@/lib/skills/registry";

const ICONS: Record<string, LucideIcon> = {
  Factory,
  Users,
  ShoppingCart,
  LayoutDashboard,
  CalendarCheck,
  Rocket,
};

function SkillIcon({ name, size = 18 }: { name: string; size?: number }) {
  const Icon = ICONS[name] ?? Sparkles;
  return <Icon size={size} className="text-shine" />;
}

interface SkillPickerProps {
  /** Detected skill id (null = no clear match → show gallery directly). */
  detectedId: string | null;
  busy?: boolean;
  onSelect: (skillId: string) => void;
  onSkip?: () => void;
}

/**
 * The "wow" domain moment: a confirm card for the detected skill, with a
 * fallback gallery of all templates. Shown once per project before the Define
 * interview when no skill is chosen yet.
 */
export default function SkillPicker({ detectedId, busy, onSelect, onSkip }: SkillPickerProps) {
  const detected = getSkill(detectedId);
  const [showGallery, setShowGallery] = useState(!detected);

  if (busy) {
    return (
      <div className="flex items-center gap-2.5 rounded-xl border border-night-edge bg-night-panel px-4 py-3 text-sm text-chalk-dim">
        <Loader2 size={15} className="animate-spin text-shine" />
        กำลังวิเคราะห์โดเมนของไอเดียคุณ…
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-night-edge bg-night-panel p-4">
      {detected && !showGallery ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-night-edge bg-black/30">
              <SkillIcon name={detected.icon} size={20} />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-shine">
                <Sparkles size={11} /> ตรวจพบโดเมน
              </div>
              <h3 className="mt-0.5 font-display text-base font-semibold text-chalk">{detected.name}</h3>
              <p className="mt-0.5 text-xs text-chalk-dim">
                ผมจะสวมบทผู้เชี่ยวชาญ {detected.nameEn} — {detected.tagline}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onSelect(detected.id)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-shine px-3.5 py-2 font-display text-sm font-semibold text-black transition hover:brightness-110"
            >
              ✓ ใช่ ลุยเลย
            </button>
            <button
              onClick={() => setShowGallery(true)}
              className="rounded-lg border border-night-edge px-3 py-2 text-sm text-chalk-dim transition hover:text-chalk"
            >
              เปลี่ยนโดเมน ▾
            </button>
            {onSkip && (
              <button
                onClick={onSkip}
                className="ml-auto text-xs text-chalk-dim underline-offset-2 transition hover:text-chalk hover:underline"
              >
                ข้าม
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-sm font-semibold text-chalk">เลือกโดเมนของ demo</h3>
            {onSkip && (
              <button
                onClick={onSkip}
                className="text-xs text-chalk-dim underline-offset-2 transition hover:text-chalk hover:underline"
              >
                ข้าม
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {SKILLS.map((s) => (
              <button
                key={s.id}
                onClick={() => onSelect(s.id)}
                className={`flex flex-col gap-1.5 rounded-lg border p-3 text-left transition hover:-translate-y-0.5 hover:border-shine/50 ${
                  s.id === detectedId ? "border-shine/60 bg-shine/5" : "border-night-edge bg-black/20"
                }`}
              >
                <SkillIcon name={s.icon} />
                <span className="font-display text-sm font-medium text-chalk">{s.name}</span>
                <span className="text-[11px] leading-snug text-chalk-dim">{s.tagline}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
