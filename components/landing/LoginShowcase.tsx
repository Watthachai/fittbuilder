"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  Check,
  ChevronDown,
  ClipboardList,
  KanbanSquare,
  LayoutTemplate,
  MousePointer2,
  Plus,
  ShoppingBag,
  Sparkles,
} from "lucide-react";

/**
 * Login showcase — a homage to the Anthropic "type a task → agent works a
 * checklist" hero, rebuilt as FITT's own: a launcher card (web-type chips + a
 * typed brief + CTA, with a cursor) that hands off to a Progress card running
 * FITT's real phases (Define → Plan → Build → Ship). Light cards on a black
 * stage, sky-blue (#64cefb) accent. Loops; static "done" frame for reduced motion.
 *
 * It is a self-contained decorative stage (fixed dark canvas, light cards), so
 * it intentionally uses literal colors rather than the theme tokens.
 */

const ACCENT = "#64cefb";
const CARD = "#f5f3ee"; // soft warm-neutral, like the reference
const INK = "#1b1b1b";

const CHIPS = [
  { icon: LayoutTemplate, label: "Landing page" },
  { icon: BarChart3, label: "Dashboard" },
  { icon: CalendarDays, label: "หน้าจอง" },
  { icon: KanbanSquare, label: "Kanban" },
  { icon: ClipboardList, label: "ฟอร์ม" },
  { icon: ShoppingBag, label: "ร้านค้า" },
];

const BRIEF = "Landing page ร้านกาแฟ สไตล์ minimal โทนครีม-น้ำตาล";

const PHASES = [
  { name: "Define", detail: "สรุปไอเดียเป็นสเปก" },
  { name: "Plan", detail: "วางโครงหน้า + ดีไซน์" },
  { name: "Build", detail: "เขียนโค้ด + รันใน browser" },
  { name: "Ship", detail: "พร้อมแชร์ลิงก์" },
];

type Stage = "type" | "aim" | "click" | "progress";

export default function LoginShowcase() {
  const [loop, setLoop] = useState(0);
  const [stage, setStage] = useState<Stage>("type");
  const [typed, setTyped] = useState("");
  const [done, setDone] = useState(0);
  const reduce = useRef(false);

  useEffect(() => {
    reduce.current =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce.current) {
      setTyped(BRIEF);
      setStage("progress");
      setDone(PHASES.length);
    }
  }, []);

  useEffect(() => {
    if (reduce.current) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (fn: () => void, ms: number) => timers.push(setTimeout(fn, ms));

    setStage("type");
    setTyped("");
    setDone(0);

    let i = 0;
    const typer = setInterval(() => {
      i += 1;
      setTyped(BRIEF.slice(0, i));
      if (i >= BRIEF.length) clearInterval(typer);
    }, 42);
    const typeMs = BRIEF.length * 42 + 400;

    at(() => setStage("aim"), typeMs);
    at(() => setStage("click"), typeMs + 700);
    at(() => setStage("progress"), typeMs + 1050);
    PHASES.forEach((_, idx) =>
      at(() => setDone(idx + 1), typeMs + 1500 + idx * 520),
    );
    at(() => setLoop((l) => l + 1), typeMs + 1500 + PHASES.length * 520 + 1800);

    return () => {
      clearInterval(typer);
      timers.forEach(clearTimeout);
    };
  }, [loop]);

  const showProgress = stage === "progress";

  return (
    <div className="relative flex h-full items-center overflow-hidden bg-black px-12 xl:px-20">
      {/* ambient accent glow */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-20 blur-3xl"
        style={{ background: `radial-gradient(circle, ${ACCENT}, transparent 70%)` }}
      />

      <div className="relative w-full max-w-md">
        <AnimatePresence mode="wait">
          {showProgress ? (
            <ProgressCard key="progress" done={done} />
          ) : (
            <LauncherCard key="launcher" typed={typed} stage={stage} />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function LauncherCard({ typed, stage }: { typed: string; stage: Stage }) {
  const aiming = stage === "aim" || stage === "click";
  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.98 }}
      transition={{ type: "spring", stiffness: 240, damping: 26 }}
      className="relative rounded-2xl p-2.5 shadow-2xl"
      style={{ background: CARD, color: INK }}
    >
      {/* action chips */}
      <div className="grid grid-cols-2 gap-2">
        {CHIPS.map((c, idx) => (
          <div
            key={c.label}
            className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px]"
            style={{
              border: "1px solid rgba(0,0,0,0.08)",
              background: idx === 0 ? "rgba(0,0,0,0.05)" : "transparent",
            }}
          >
            <c.icon size={15} style={{ color: "rgba(0,0,0,0.45)" }} />
            <span>{c.label}</span>
          </div>
        ))}
      </div>

      {/* typed brief */}
      <div
        className="mt-2.5 rounded-xl px-3.5 pb-3 pt-3"
        style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}
      >
        <p className="min-h-[2.5rem] text-[15px] leading-relaxed">
          {typed}
          <span
            className="caret-blink ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[2px] align-middle"
            style={{ background: ACCENT }}
          />
        </p>
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[12px]" style={{ color: "rgba(0,0,0,0.55)" }}>
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1"
              style={{ border: "1px solid rgba(0,0,0,0.12)" }}
            >
              <Sparkles size={12} /> เลือกประเภท
            </span>
            <Plus size={15} />
          </div>
          <motion.span
            animate={{ scale: stage === "click" ? 0.93 : 1 }}
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[13px] font-semibold"
            style={{ background: ACCENT, color: "#06283a" }}
          >
            สร้างเลย <ArrowRight size={14} />
          </motion.span>
        </div>
      </div>

      {/* cursor: hovers the first chip, then glides to the CTA */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute z-10"
        initial={false}
        animate={aiming ? { left: "84%", top: "86%" } : { left: "26%", top: "20%" }}
        transition={{ type: "spring", stiffness: 200, damping: 22 }}
      >
        <MousePointer2 size={20} className="drop-shadow" style={{ fill: INK, color: CARD }} />
      </motion.div>
    </motion.div>
  );
}

function ProgressCard({ done }: { done: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.98 }}
      transition={{ type: "spring", stiffness: 240, damping: 26 }}
      className="rounded-2xl p-5 shadow-2xl"
      style={{ background: CARD, color: INK }}
    >
      <div className="mb-4 flex items-center justify-between">
        <span className="text-[15px] font-medium">ความคืบหน้า</span>
        <ChevronDown size={16} style={{ color: "rgba(0,0,0,0.4)" }} />
      </div>
      <div className="space-y-3.5">
        {PHASES.map((p, idx) => {
          const checked = idx < done;
          return (
            <div key={p.name} className="flex items-center gap-3">
              <motion.span
                initial={false}
                animate={{ scale: checked ? 1 : 0.6, opacity: checked ? 1 : 0.35 }}
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
                className="grid h-6 w-6 shrink-0 place-items-center rounded-full"
                style={{ background: checked ? ACCENT : "rgba(0,0,0,0.1)" }}
              >
                {checked && <Check size={14} color="#06283a" strokeWidth={3} />}
              </motion.span>
              <span
                className="text-[14px] transition-colors"
                style={{
                  color: checked ? "rgba(0,0,0,0.4)" : INK,
                  textDecoration: checked ? "line-through" : "none",
                }}
              >
                <b className="font-semibold" style={{ color: checked ? "rgba(0,0,0,0.4)" : INK }}>
                  {p.name}
                </b>{" "}
                · {p.detail}
              </span>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
