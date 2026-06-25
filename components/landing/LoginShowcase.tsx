"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Check, Sparkles } from "lucide-react";

/**
 * Self-running showcase for the login page's right panel — tells the FITT story
 * (type a brief → AI builds → a real demo runs) as a looping ~9s sequence, drawn
 * entirely in code (no external video). Honours prefers-reduced-motion by showing
 * the finished "ready" frame statically.
 *
 * INVARIANT: the frosted "brief" card must not carry a transform (that disables
 * its backdrop blur), so only its CONTENTS animate; the solid demo window — not
 * glass — is free to animate with transform.
 */

const BRIEFS = [
  { prompt: "Landing page ร้านกาแฟ สไตล์ minimal โทนครีม-น้ำตาล", url: "coffee-shop.fitt.app" },
  { prompt: "Dashboard ยอดขาย มี KPI cards และกราฟรายเดือน", url: "sales-dashboard.fitt.app" },
  { prompt: "หน้าจองโต๊ะร้านอาหาร เลือกวัน เวลา จำนวนคน", url: "table-booking.fitt.app" },
];

type Phase = "typing" | "submit" | "generating" | "installing" | "ready";

export default function LoginShowcase() {
  const [round, setRound] = useState(0);
  const [phase, setPhase] = useState<Phase>("typing");
  const [typed, setTyped] = useState("");
  const reduce = useRef(false);
  const brief = BRIEFS[round % BRIEFS.length];

  useEffect(() => {
    reduce.current =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce.current) {
      setTyped(BRIEFS[0].prompt);
      setPhase("ready");
    }
  }, []);

  useEffect(() => {
    if (reduce.current) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (fn: () => void, ms: number) => timers.push(setTimeout(fn, ms));

    setTyped("");
    setPhase("typing");

    const full = brief.prompt;
    let i = 0;
    const typer = setInterval(() => {
      i += 1;
      setTyped(full.slice(0, i));
      if (i >= full.length) clearInterval(typer);
    }, 45);

    const typeMs = full.length * 45 + 350;
    at(() => setPhase("submit"), typeMs);
    at(() => setPhase("generating"), typeMs + 650);
    at(() => setPhase("installing"), typeMs + 1850);
    at(() => setPhase("ready"), typeMs + 2900);
    at(() => setRound((r) => r + 1), typeMs + 6400);

    return () => {
      clearInterval(typer);
      timers.forEach(clearTimeout);
    };
  }, [round, brief.prompt]);

  const showDemo = phase === "generating" || phase === "installing" || phase === "ready";
  const ready = phase === "ready";

  return (
    <div className="bg-grid relative h-full overflow-hidden">
      {/* ambient accent glow */}
      <div
        className="pointer-events-none absolute -right-20 top-1/4 h-[28rem] w-[28rem] rounded-full opacity-20 blur-3xl"
        style={{ background: "radial-gradient(circle, var(--shine), transparent 70%)" }}
      />

      <div className="relative flex h-full flex-col justify-center gap-7 px-12 xl:px-20">
        {/* ── 1. The brief (frosted glass — no transform) ── */}
        <div className="glass w-full max-w-md rounded-2xl p-5 shadow-2xl">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-chalk/60">
              FITT-001 · Demo Brief
            </span>
            <span className="flex items-center gap-1 font-mono text-[10px] text-chalk/40">
              <Sparkles size={11} className="text-shine" /> Auto
            </span>
          </div>

          <p className="min-h-[3.25rem] text-[15px] leading-relaxed text-chalk">
            {typed || " "}
            {!ready && (
              <span className="caret-blink ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[2px] bg-shine align-middle" />
            )}
          </p>

          <div className="mt-4 flex h-7 items-center justify-end">
            <AnimatePresence mode="wait" initial={false}>
              {phase === "typing" || phase === "submit" ? (
                <motion.span
                  key="cta"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, scale: phase === "submit" ? 0.94 : 1 }}
                  exit={{ opacity: 0 }}
                  className="inline-flex items-center gap-1.5 rounded-full bg-shine px-3.5 py-1.5 font-display text-xs font-semibold text-night"
                >
                  สร้างเลย <ArrowRight size={13} />
                </motion.span>
              ) : ready ? (
                <motion.span
                  key="done"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="inline-flex items-center gap-1.5 font-mono text-[11px] text-go"
                >
                  <Check size={13} /> พร้อมแล้ว
                </motion.span>
              ) : (
                <motion.span
                  key="building"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="inline-flex items-center gap-2 font-mono text-[11px] text-chalk-dim"
                >
                  {phase === "generating" ? "AI กำลังเขียนโค้ด…" : "กำลังติดตั้ง…"}
                  <span className="flex items-center gap-1">
                    {[0, 150, 300].map((d) => (
                      <span
                        key={d}
                        className="loader-dot h-1 w-1 rounded-full bg-shine"
                        style={{ animationDelay: `${d}ms` }}
                      />
                    ))}
                  </span>
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ── 2. The running demo (solid — transform OK) ── */}
        <AnimatePresence>
          {showDemo && (
            <motion.div
              key={round}
              initial={{ opacity: 0, y: 18, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 240, damping: 26 }}
              className="ml-12 w-full max-w-md overflow-hidden rounded-2xl border border-night-edge bg-night shadow-2xl xl:ml-20"
            >
              {/* browser chrome */}
              <div className="flex items-center gap-2 border-b border-night-edge bg-night-panel px-3 py-2">
                <span className="h-2.5 w-2.5 rounded-full bg-halt/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-shine/40" />
                <span className="h-2.5 w-2.5 rounded-full bg-go/70" />
                <span className="ml-2 flex items-center gap-1.5 font-mono text-[10px] text-chalk-dim">
                  {ready ? (
                    <span className="live-dot h-1.5 w-1.5 rounded-full bg-go" />
                  ) : (
                    <span className="h-2.5 w-2.5 animate-spin rounded-full border border-chalk/20 border-t-shine" />
                  )}
                  {brief.url}
                </span>
              </div>

              {/* page body: skeleton while building, real content when ready */}
              <div className="space-y-3 p-5">
                {ready ? (
                  <DemoContent />
                ) : (
                  <div className="animate-pulse space-y-3">
                    <div className="flex justify-between">
                      <span className="h-2.5 w-16 rounded-full bg-chalk/15" />
                      <span className="h-2.5 w-10 rounded-full bg-chalk/10" />
                    </div>
                    <div className="h-4 w-3/4 rounded bg-chalk/12" />
                    <div className="h-3 w-1/2 rounded bg-chalk/10" />
                    <div className="grid grid-cols-3 gap-2 pt-1">
                      <div className="h-12 rounded-lg bg-chalk/[0.06]" />
                      <div className="h-12 rounded-lg bg-chalk/[0.06]" />
                      <div className="h-12 rounded-lg bg-chalk/[0.06]" />
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/** The "finished" mini landing page, with elements staggering in. */
function DemoContent() {
  const item = {
    hidden: { opacity: 0, y: 8 },
    show: { opacity: 1, y: 0 },
  };
  return (
    <motion.div
      initial="hidden"
      animate="show"
      transition={{ staggerChildren: 0.08 }}
      className="space-y-3"
    >
      <motion.div variants={item} className="flex items-center justify-between">
        <span className="h-2.5 w-16 rounded-full bg-chalk/25" />
        <span className="h-2.5 w-10 rounded-full bg-shine/70" />
      </motion.div>
      <motion.div variants={item} className="h-4 w-3/4 rounded bg-chalk/30" />
      <motion.div variants={item} className="h-3 w-1/2 rounded bg-chalk/15" />
      <motion.span
        variants={item}
        className="inline-block rounded-md bg-shine px-3 py-1.5 text-[10px] font-semibold text-night"
      >
        เริ่มเลย
      </motion.span>
      <motion.div variants={item} className="grid grid-cols-3 gap-2 pt-1">
        <div className="h-12 rounded-lg bg-chalk/[0.07]" />
        <div className="h-12 rounded-lg bg-chalk/[0.07]" />
        <div className="h-12 rounded-lg bg-chalk/[0.07]" />
      </motion.div>
    </motion.div>
  );
}
