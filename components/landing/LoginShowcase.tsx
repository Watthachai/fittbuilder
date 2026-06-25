"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowRight,
  Check,
  MousePointer2,
  Send,
  Share2,
  Sparkles,
} from "lucide-react";

/**
 * Login showcase — the full FITT magic as a looping story drawn in code:
 *   type a brief → A.R.I.A reads it → a REAL prototype builds (you see it) →
 *   click it → ask for a change in plain words → it re-conjures the edit →
 *   share with friends.
 * Light cards on a black stage with the #64cefb accent. Reduced motion shows the
 * finished, shared frame. (Decorative stage → literal colors, not theme tokens.)
 */

const ACCENT = "#64cefb";
const INK = "#1b1b1b";
const CARD = "#f5f3ee";
// the generated coffee-shop demo's own palette (warm, per the brief)
const CREAM = "#efe7da";
const BROWN = "#6f4e37";

const BRIEF = "Landing page ร้านกาแฟ สไตล์ minimal โทนครีม-น้ำตาล";
const EDIT_REQ = 'เพิ่มปุ่ม "สั่งออนไลน์" สีฟ้า';

type Stage = "brief" | "analyze" | "build" | "interact" | "edit" | "share";

export default function LoginShowcase() {
  const [loop, setLoop] = useState(0);
  const [stage, setStage] = useState<Stage>("brief");
  const [brief, setBrief] = useState("");
  const [editReq, setEditReq] = useState("");
  const [edited, setEdited] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [toast, setToast] = useState(false);
  const reduce = useRef(false);

  useEffect(() => {
    reduce.current =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce.current) {
      setBrief(BRIEF);
      setEditReq(EDIT_REQ);
      setEdited(true);
      setToast(true);
      setStage("share");
    }
  }, []);

  useEffect(() => {
    if (reduce.current) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (fn: () => void, ms: number) => timers.push(setTimeout(fn, ms));
    let editTyper: ReturnType<typeof setInterval>;

    setStage("brief");
    setBrief("");
    setEditReq("");
    setEdited(false);
    setPressed(false);
    setToast(false);

    let i = 0;
    const briefTyper = setInterval(() => {
      i += 1;
      setBrief(BRIEF.slice(0, i));
      if (i >= BRIEF.length) clearInterval(briefTyper);
    }, 40);
    const t = BRIEF.length * 40 + 500; // brief typed + cursor reaches CTA

    at(() => setStage("analyze"), t);
    at(() => setStage("build"), t + 1400);
    at(() => setStage("interact"), t + 3000);
    at(() => setPressed(true), t + 3300);
    at(() => setPressed(false), t + 3600);

    const editStart = t + 3900;
    at(() => {
      setStage("edit");
      let j = 0;
      editTyper = setInterval(() => {
        j += 1;
        setEditReq(EDIT_REQ.slice(0, j));
        if (j >= EDIT_REQ.length) clearInterval(editTyper);
      }, 40);
    }, editStart);
    const editTyped = EDIT_REQ.length * 40;
    at(() => setEdited(true), editStart + editTyped + 600);

    const shareStart = editStart + editTyped + 1500;
    at(() => setStage("share"), shareStart);
    at(() => setToast(true), shareStart + 900);
    at(() => setLoop((l) => l + 1), shareStart + 3200);

    return () => {
      clearInterval(briefTyper);
      clearInterval(editTyper);
      timers.forEach(clearTimeout);
    };
  }, [loop]);

  const onLauncher = stage === "brief" || stage === "analyze";

  return (
    <div className="relative flex h-full items-center overflow-hidden bg-black px-12 xl:px-20">
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-20 blur-3xl"
        style={{ background: `radial-gradient(circle, ${ACCENT}, transparent 70%)` }}
      />

      <div className="relative w-full max-w-md">
        <AnimatePresence mode="wait">
          {onLauncher ? (
            <Launcher key="launcher" stage={stage} brief={brief} />
          ) : (
            <Studio
              key="studio"
              stage={stage}
              editReq={editReq}
              edited={edited}
              pressed={pressed}
              toast={toast}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ─── Act 1–2: brief + A.R.I.A reads it ─────────────────────────────── */
function Launcher({ stage, brief }: { stage: Stage; brief: string }) {
  const analyzing = stage === "analyze";
  const typed = brief.length >= BRIEF.length;
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em]" style={{ color: "rgba(0,0,0,0.5)" }}>
          FITT-001 · Demo Brief
        </span>
        <span className="inline-flex items-center gap-1 font-mono text-[10px]" style={{ color: ACCENT }}>
          <Sparkles size={11} /> A.R.I.A
        </span>
      </div>

      <p className="min-h-[3rem] text-[15px] leading-relaxed">
        {brief}
        {!analyzing && (
          <span className="caret-blink ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[2px] align-middle" style={{ background: ACCENT }} />
        )}
      </p>

      <div className="relative mt-4 flex h-7 items-center justify-end">
        <AnimatePresence mode="wait">
          {analyzing ? (
            <motion.span
              key="read"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="inline-flex items-center gap-2 text-[12px]"
              style={{ color: "rgba(0,0,0,0.6)" }}
            >
              <Sparkles size={13} style={{ color: ACCENT }} className="animate-pulse" />
              A.R.I.A กำลังอ่านโจทย์ + วางโครง…
            </motion.span>
          ) : (
            <motion.span
              key="cta"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, scale: typed ? 0.94 : 1 }}
              exit={{ opacity: 0 }}
              className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[13px] font-semibold"
              style={{ background: ACCENT, color: "#06283a" }}
            >
              สร้างเลย <ArrowRight size={14} />
            </motion.span>
          )}
        </AnimatePresence>

        {/* cursor parks at the CTA once the brief is typed */}
        {!analyzing && (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute"
            initial={false}
            animate={typed ? { right: 4, bottom: -6 } : { right: 120, bottom: 26 }}
            transition={{ type: "spring", stiffness: 200, damping: 22 }}
          >
            <MousePointer2 size={20} style={{ fill: INK, color: CARD }} />
          </motion.div>
        )}
      </div>
    </Card>
  );
}

/* ─── Act 3–6: live prototype → edit → share ────────────────────────── */
function Studio({
  stage,
  editReq,
  edited,
  pressed,
  toast,
}: {
  stage: Stage;
  editReq: string;
  edited: boolean;
  pressed: boolean;
  toast: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ type: "spring", stiffness: 240, damping: 26 }}
      className="space-y-3"
    >
      {/* the real prototype, in a browser frame */}
      <div className="relative overflow-hidden rounded-2xl shadow-2xl" style={{ background: CREAM }}>
        {/* chrome */}
        <div className="flex items-center gap-2 px-3 py-2" style={{ background: "rgba(0,0,0,0.06)" }}>
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#e06a5a" }} />
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#e0b34a" }} />
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#5aa86a" }} />
          <span className="ml-2 flex items-center gap-1.5 font-mono text-[10px]" style={{ color: "rgba(0,0,0,0.45)" }}>
            <span className="live-dot h-1.5 w-1.5 rounded-full" style={{ background: "#3a9a4a" }} />
            cafe-bloom.fitt.app
          </span>
          <span
            className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold"
            style={{
              background: stage === "share" ? ACCENT : "rgba(0,0,0,0.08)",
              color: stage === "share" ? "#06283a" : "rgba(0,0,0,0.6)",
              transition: "all .3s",
            }}
          >
            <Share2 size={11} /> แชร์
          </span>
        </div>

        {/* generated coffee-shop landing */}
        <div className="relative p-5" style={{ color: BROWN }}>
          <PrototypeBody edited={edited} pressed={pressed} buildIn={stage === "build"} />

          {/* a tap ripple when "tried" */}
          <AnimatePresence>
            {stage === "interact" && (
              <motion.span
                aria-hidden
                initial={{ opacity: 0.5, scale: 0 }}
                animate={{ opacity: 0, scale: 2.4 }}
                transition={{ duration: 0.7 }}
                className="pointer-events-none absolute left-6 top-[6.2rem] h-10 w-10 rounded-full"
                style={{ background: BROWN }}
              />
            )}
          </AnimatePresence>
        </div>

        {/* cursor visits the demo button, then the share button */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute z-10"
          initial={false}
          animate={
            stage === "share"
              ? { right: 14, top: 6 }
              : stage === "interact" || stage === "edit"
                ? { left: 24, top: 96 }
                : { left: 24, top: 130 }
          }
          transition={{ type: "spring", stiffness: 180, damping: 22 }}
        >
          <MousePointer2 size={20} style={{ fill: INK, color: CREAM }} />
        </motion.div>

        {/* "link copied" toast */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute right-3 top-10 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium shadow-lg"
              style={{ background: INK, color: "#fff" }}
            >
              <Check size={12} style={{ color: ACCENT }} /> คัดลอกลิงก์แล้ว — ส่งให้เพื่อนได้เลย
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* chat / revise bar — the "ask for a change" magic */}
      <div className="flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: CARD, color: INK }}>
        <Sparkles size={15} style={{ color: ACCENT }} className={stage === "edit" && !edited ? "animate-pulse" : ""} />
        <span className="min-w-0 flex-1 truncate text-[13px]">
          {stage === "edit" || edited ? (
            <>
              {editReq}
              {stage === "edit" && !edited && (
                <span className="caret-blink ml-0.5 inline-block h-[1em] w-[2px] translate-y-[2px] align-middle" style={{ background: ACCENT }} />
              )}
            </>
          ) : (
            <span style={{ color: "rgba(0,0,0,0.4)" }}>บอกสิ่งที่อยากแก้ เช่น “เปลี่ยนสีปุ่ม”…</span>
          )}
        </span>
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg" style={{ background: ACCENT, color: "#06283a" }}>
          <Send size={13} />
        </span>
      </div>
    </motion.div>
  );
}

/** The rendered mini coffee-shop page; elements stagger in on build, and the
 *  blue "สั่งออนไลน์" button appears once the edit is applied. */
function PrototypeBody({ edited, pressed, buildIn }: { edited: boolean; pressed: boolean; buildIn: boolean }) {
  const item = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } };
  return (
    <motion.div
      initial={buildIn ? "hidden" : "show"}
      animate="show"
      transition={{ staggerChildren: 0.1 }}
      className="space-y-3"
    >
      <motion.div variants={item} className="flex items-center justify-between">
        <span className="text-[13px] font-bold tracking-tight">☕ Café Bloom</span>
        <span className="flex gap-2 text-[9px]" style={{ color: "rgba(111,78,55,0.7)" }}>
          <span>เมนู</span>
          <span>เกี่ยวกับ</span>
          <span>ติดต่อ</span>
        </span>
      </motion.div>

      <motion.p variants={item} className="text-[17px] font-bold leading-tight">
        กาแฟดีๆ เริ่มต้นเช้าของคุณ
      </motion.p>
      <motion.p variants={item} className="text-[10px]" style={{ color: "rgba(111,78,55,0.7)" }}>
        คั่วสดทุกวัน · ส่งถึงบ้าน
      </motion.p>

      <motion.div variants={item} className="flex items-center gap-2">
        <span
          className="rounded-lg px-3 py-1.5 text-[11px] font-semibold text-white"
          style={{ background: BROWN, transform: pressed ? "scale(0.94)" : "none", transition: "transform .2s" }}
        >
          สั่งเลย
        </span>
        <AnimatePresence>
          {edited && (
            <motion.span
              initial={{ opacity: 0, scale: 0.7, x: -6 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 18 }}
              className="rounded-lg px-3 py-1.5 text-[11px] font-semibold"
              style={{ background: ACCENT, color: "#06283a" }}
            >
              สั่งออนไลน์
            </motion.span>
          )}
        </AnimatePresence>
      </motion.div>

      <motion.div variants={item} className="grid grid-cols-3 gap-2 pt-1">
        {[
          ["Latte", "฿85"],
          ["Americano", "฿70"],
          ["Mocha", "฿95"],
        ].map(([n, p]) => (
          <div key={n} className="rounded-lg p-2" style={{ background: "rgba(111,78,55,0.08)" }}>
            <div className="mb-1.5 h-8 rounded-md" style={{ background: "rgba(111,78,55,0.18)" }} />
            <div className="text-[9px] font-medium">{n}</div>
            <div className="text-[9px]" style={{ color: "rgba(111,78,55,0.6)" }}>{p}</div>
          </div>
        ))}
      </motion.div>
    </motion.div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.98 }}
      transition={{ type: "spring", stiffness: 240, damping: 26 }}
      className="rounded-2xl p-5 shadow-2xl"
      style={{ background: CARD, color: INK }}
    >
      {children}
    </motion.div>
  );
}
