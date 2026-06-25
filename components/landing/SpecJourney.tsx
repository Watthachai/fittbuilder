"use client";

import { useRef, useState } from "react";
import { useMotionValueEvent, useScroll } from "motion/react";
import { Check, FileText, Search, Sparkles } from "lucide-react";
import GlassSurface from "@/components/ui/GlassSurface";

const PHASES = ["Define", "Plan", "Build", "Verify", "Review", "Ship"];

interface Narr {
  k: "type" | "detect" | "define" | "plan" | "build" | "ship";
  label: string;
  desc: string;
  /** How many phase chips are lit at this step. */
  lit: number;
}

const NARR: Narr[] = [
  { k: "type", label: "พิมพ์ไอเดีย", desc: "พิมพ์เป็นภาษาคน เช่น “ระบบจัดซื้อ ERP มีอนุมัติหลายขั้น”", lit: 0 },
  { k: "detect", label: "AI ตรวจจับโดเมน", desc: "ระบบเดาว่าเป็นงาน ERP แล้วสวมบทผู้เชี่ยวชาญโดเมนนั้น", lit: 0 },
  { k: "define", label: "Define → BRD", desc: "สรุปความต้องการเป็นเอกสาร BRD ที่ชัดเจน ไม่มีคำว่า ‘น่าจะ’", lit: 1 },
  { k: "plan", label: "Plan → PRD", desc: "แปลง BRD ที่อนุมัติแล้วเป็น PRD ให้ทีม dev", lit: 2 },
  { k: "build", label: "Build → เว็บจริง", desc: "สร้างเว็บที่รันจริงในเบราว์เซอร์จาก BRD/PRD", lit: 3 },
  { k: "ship", label: "Verify · Review · Ship", desc: "ตรวจสอบ รีวิวคุณภาพ แล้วแชร์ลิงก์ / export ได้เลย", lit: 6 },
];

export default function SpecJourney() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const [active, setActive] = useState(0);

  useMotionValueEvent(scrollYProgress, "change", (v) => {
    setActive(Math.min(NARR.length - 1, Math.max(0, Math.floor(v * NARR.length))));
  });

  const cur = NARR[active];

  return (
    <section id="spec" ref={ref} className="relative" style={{ height: `${NARR.length * 90}vh` }}>
      <div className="sticky top-0 flex h-screen flex-col items-center justify-center overflow-hidden px-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-shine">Spec → Demo</p>
        <h2 className="mt-2 text-center font-display text-3xl font-medium tracking-tight text-chalk">
          จากแชท → เว็บจริง ทีละขั้น
        </h2>

        {/* Phase rail */}
        <div className="mt-8 flex w-full max-w-2xl items-center justify-between gap-1">
          {PHASES.map((p, i) => {
            const lit = i < cur.lit;
            return (
              <div key={p} className="flex flex-1 items-center gap-1">
                {i > 0 && (
                  <span
                    className={`h-px flex-1 transition-colors duration-500 ${
                      i <= cur.lit ? "bg-shine/60" : "bg-chalk/15"
                    }`}
                  />
                )}
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all duration-500 ${
                    lit
                      ? "border-shine/50 bg-shine/15 text-shine"
                      : "border-chalk/15 text-chalk-dim"
                  }`}
                >
                  {lit && <Check size={11} />} {p}
                </span>
              </div>
            );
          })}
        </div>

        {/* Stage canvas — cross-fades content per step */}
        <div className="relative mt-8 h-[340px] w-full max-w-2xl">
          {NARR.map((n, i) => (
            <div
              key={n.k}
              className="absolute inset-0 transition-all duration-500 ease-out"
              style={{
                opacity: i === active ? 1 : 0,
                transform: i === active ? "translateY(0) scale(1)" : "translateY(28px) scale(0.96)",
                pointerEvents: i === active ? "auto" : "none",
              }}
            >
              <GlassSurface className="h-full overflow-hidden rounded-3xl p-6">
                <Stage k={n.k} />
              </GlassSurface>
            </div>
          ))}
        </div>

        {/* Caption */}
        <div className="mt-7 max-w-lg text-center">
          <h3 className="font-display text-lg font-semibold text-chalk">{cur.label}</h3>
          <p className="mt-1 text-sm leading-relaxed text-chalk/70">{cur.desc}</p>
        </div>
      </div>
    </section>
  );
}

function Stage({ k }: { k: Narr["k"] }) {
  if (k === "type") {
    return (
      <div className="flex h-full flex-col justify-center gap-3">
        <div className="glass rounded-2xl px-4 py-3">
          <span className="text-[15px] text-chalk">
            ระบบจัดซื้อ ERP มีขั้นอนุมัติหลายระดับ PR → PO → รับของ
            <span className="caret-blink ml-0.5 inline-block h-[1.05em] w-[2px] bg-shine align-middle" />
          </span>
        </div>
        <div className="self-end rounded-full bg-shine px-4 py-1.5 font-display text-xs font-semibold text-night">
          สร้างเลย →
        </div>
      </div>
    );
  }
  if (k === "detect") {
    return (
      <div className="flex h-full flex-col justify-center gap-3">
        <div className="inline-flex items-center gap-2 self-start rounded-full border border-shine/40 bg-shine/10 px-3 py-1.5">
          <Search size={14} className="text-shine" />
          <span className="text-sm text-chalk">ตรวจจับโดเมน: </span>
          <span className="font-display text-sm font-semibold text-shine">ERP</span>
        </div>
        <div className="glass rounded-2xl px-4 py-3 text-sm leading-relaxed text-chalk/80">
          <Sparkles size={14} className="mr-1.5 inline text-shine" />
          สวมบทผู้เชี่ยวชาญ ERP — รู้จัก PR/PO/GR, ขั้นอนุมัติ, และจะถามคำถามเจาะจงให้ตรงงานจริง
        </div>
        <div className="flex flex-wrap gap-1.5">
          {["จัดซื้อ", "อนุมัติหลายชั้น", "คลังสินค้า", "ผู้ขาย"].map((t) => (
            <span key={t} className="rounded-full border border-chalk/15 px-2.5 py-1 text-[11px] text-chalk-dim">
              {t}
            </span>
          ))}
        </div>
      </div>
    );
  }
  if (k === "define" || k === "plan") {
    const doc = k === "define" ? "docs/BRD.md" : "docs/PRD.md";
    const title = k === "define" ? "Business Requirements" : "Product Requirements";
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-2 text-chalk-dim">
          <FileText size={14} className="text-shine" />
          <span className="font-mono text-xs">{doc}</span>
        </div>
        <h4 className="mt-3 font-display text-lg font-semibold text-chalk">{title}</h4>
        <div className="mt-4 space-y-2.5">
          {[92, 78, 85, 64, 72].map((w, i) => (
            <div
              key={i}
              className="h-2.5 rounded-full bg-chalk/12"
              style={{ width: `${w}%` }}
            />
          ))}
        </div>
        <span className="mt-auto inline-flex items-center gap-1.5 self-start rounded-full bg-go/15 px-3 py-1 text-xs font-medium text-go">
          <Check size={12} /> อนุมัติแล้ว
        </span>
      </div>
    );
  }
  // build / ship → browser mockup
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-halt/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-chalk/30" />
        <span className="h-2.5 w-2.5 rounded-full bg-go/70" />
        <span className="ml-2 rounded-md bg-chalk/10 px-2 py-0.5 font-mono text-[10px] text-chalk-dim">
          localhost:5173
        </span>
        {k === "ship" && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-go/15 px-2.5 py-0.5 text-[11px] font-medium text-go">
            <Check size={11} /> พร้อมแชร์
          </span>
        )}
      </div>
      <div className="mt-3 flex flex-1 gap-3">
        <div className="w-1/4 space-y-2 rounded-xl bg-chalk/[0.06] p-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-2 rounded bg-chalk/15" style={{ width: `${80 - i * 12}%` }} />
          ))}
        </div>
        <div className="flex-1 space-y-2.5">
          <div className="h-7 w-1/2 rounded-lg bg-shine/30" />
          <div className="grid grid-cols-3 gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-14 rounded-lg border border-chalk/10 bg-chalk/[0.05]" />
            ))}
          </div>
          <div className="h-20 rounded-lg border border-chalk/10 bg-chalk/[0.05]" />
        </div>
      </div>
    </div>
  );
}
