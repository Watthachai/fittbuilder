"use client";

import { useEffect, useState } from "react";
import { Boxes, Check, FileText, Loader2, Package, Rocket, Server, Terminal } from "lucide-react";
import { PHASES, phaseIndex, type PhaseId } from "@/lib/phases";
import type { AgentAction, GenerationPhase } from "@/lib/types";

/**
 * What the studio shows while a build is running.
 *
 * The cat and the tips were the whole screen, and they said nothing about the
 * thing being waited for. They are still here — a minute of waiting is nicer
 * with them and the cat is the product's face — but they no longer carry it
 * alone. Everything worth showing was already in hand: which documents this
 * build was written from, which of the four runtime steps it is on, and the
 * files and packages as they arrive. A person who can see that can tell a slow
 * build from a stuck one without opening the terminal.
 */

/** The headline over the cat — the one-line answer to "what is it doing". */
const HEADLINE: Record<GenerationPhase, string> = {
  idle: "กำลังเตรียมเวที…",
  generating: "AI กำลังเขียนโค้ด…",
  installing: "กำลังติดตั้งแพ็กเกจ…",
  starting: "กำลังเปิดเซิร์ฟเวอร์…",
  ready: "พร้อมแล้ว",
  error: "เกิดข้อผิดพลาด",
};

/** The four runtime steps, in the order the container goes through them. */
const STEPS: { id: GenerationPhase; label: string; icon: typeof Terminal }[] = [
  { id: "generating", label: "เขียนโค้ด", icon: Terminal },
  { id: "installing", label: "ติดตั้งแพ็กเกจ", icon: Package },
  { id: "starting", label: "เปิดเซิร์ฟเวอร์", icon: Server },
  { id: "ready", label: "พร้อมใช้งาน", icon: Rocket },
];

const STEP_ORDER = STEPS.map((s) => s.id);

/** The documents a build reads from, and the phase each one belongs to. */
const SOURCES: { phase: PhaseId; doc: string; label: string }[] = [
  { phase: "define", doc: "BRD.md", label: "BRD" },
  { phase: "plan", doc: "PRD.md", label: "PRD" },
];

const TIPS = [
  "พิมพ์ภาษาธรรมดาได้เลย เช่น “เพิ่มปุ่มเข้าสู่ระบบ” หรือ “เปลี่ยนสีหลักเป็นเขียว”",
  "กดแท็บ Code เพื่อดูและแก้ไฟล์ทั้งหมดได้โดยตรง",
  "AI ติดตั้งแพ็กเกจที่ต้องใช้ให้อัตโนมัติ ไม่ต้องพิมพ์ install เอง",
  "ใช้ปุ่มมือถือและแท็บเล็ตด้านบน เพื่อดูว่าเว็บหน้าตาเป็นอย่างไรบนจอเล็ก",
  "บอกให้ละเอียดขึ้น เช่น “ตารางสินค้า มีค้นหาและแบ่งหน้า” จะได้ผลตรงใจกว่า",
  "กดแชร์เพื่อส่งลิงก์ให้คนอื่นเปิดดูตัวอย่างได้ทันที",
];

const TIP_INTERVAL_MS = 6000;

interface BuildFlowProps {
  /** Where the container is in its four runtime steps. */
  phase: GenerationPhase;
  /** Which workflow phase the project is in (Define → Ship). */
  workflow: PhaseId;
  /** Workflow phases the user has already approved. */
  approved: PhaseId[];
  /** Which source documents exist in the project right now. */
  has: { brd: boolean; prd: boolean };
  /** The live turn's action chips — files written and packages installed. */
  actions: AgentAction[];
}

export default function BuildFlow({ phase, workflow, approved, has, actions }: BuildFlowProps) {
  const [tip, setTip] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTip((t) => (t + 1) % TIPS.length), TIP_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  const at = STEP_ORDER.indexOf(phase);
  const files = actions.filter((a) => a.icon === "file");
  const deps = actions.filter((a) => a.icon === "deps");
  // The last few, newest first: a feed that scrolls itself is harder to read
  // than one that simply shows what just happened.
  const recent = [...actions].filter((a) => a.icon === "file" || a.icon === "deps").slice(-5).reverse();

  return (
    <div className="flex w-full max-w-lg flex-col gap-3 self-center px-6">
      {/* The cat stays. A build takes a minute and the person is watching it —
          the panels below say how it is going, and this says it is going. */}
      <div className="flex flex-col items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/cat_playing_animation.svg"
          alt=""
          className="loader-float w-44 select-none opacity-90"
          draggable={false}
        />
        <p className="-mt-1 font-display text-[14px] text-chalk">{HEADLINE[phase]}</p>
        <span className="mt-1.5 flex items-center gap-1.5">
          <span className="loader-dot size-1.5 rounded-full bg-shine" style={{ animationDelay: "0ms" }} />
          <span className="loader-dot size-1.5 rounded-full bg-shine" style={{ animationDelay: "150ms" }} />
          <span className="loader-dot size-1.5 rounded-full bg-shine" style={{ animationDelay: "300ms" }} />
        </span>
      </div>

      {/* Where this build came from. A build is not a thing that happens on its
          own — it is the third step of a chain, and the two documents above it
          are what it was written from. */}
      <div className="rounded-xl border border-night-edge bg-night-panel px-4 py-3">
        <p className="mb-2.5 font-mono text-[10px] uppercase tracking-[0.2em] text-chalk-dim/60">
          สร้างจากเอกสาร
        </p>
        <ol className="flex items-center gap-2">
          {SOURCES.map((s, i) => {
            const exists = s.phase === "define" ? has.brd : has.prd;
            const done = approved.includes(s.phase) || phaseIndex(workflow) > phaseIndex(s.phase);
            return (
              <li key={s.phase} className="flex min-w-0 items-center gap-2">
                {i > 0 && <span className="h-px w-4 shrink-0 bg-night-edge" />}
                <span className="flex min-w-0 items-center gap-1.5">
                  <span
                    className={`grid size-5 shrink-0 place-items-center rounded-full ${
                      done ? "bg-go/20 text-go" : exists ? "bg-shine/15 text-shine" : "border border-night-edge text-chalk-dim/40"
                    }`}
                  >
                    {done ? <Check size={11} /> : <FileText size={11} />}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-display text-[12.5px] text-chalk">{s.label}</span>
                    <span className="block truncate font-mono text-[10.5px] text-chalk-dim/60">
                      {exists ? s.doc : "ยังไม่มีเอกสาร"}
                    </span>
                  </span>
                </span>
              </li>
            );
          })}
          <li className="flex min-w-0 flex-1 items-center gap-2">
            <span className="h-px w-4 shrink-0 bg-shine/50" />
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-shine text-night">
                <Loader2 size={11} className="animate-spin" />
              </span>
              <span className="min-w-0">
                <span className="block font-display text-[12.5px] font-semibold text-shine">Build</span>
                <span className="block truncate text-[10.5px] text-chalk-dim/60">กำลังสร้าง</span>
              </span>
            </span>
          </li>
        </ol>
      </div>

      {/* The four runtime steps, with the one in progress named in full. */}
      <div className="rounded-xl border border-night-edge bg-night-panel px-4 py-3.5">
        <ol className="flex items-center">
          {STEPS.map((step, i) => {
            const done = at > i;
            const active = at === i;
            const Icon = step.icon;
            return (
              <li key={step.id} className="flex min-w-0 flex-1 items-center last:flex-none">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span
                    className={`grid size-6 shrink-0 place-items-center rounded-full transition ${
                      done
                        ? "bg-go/20 text-go"
                        : active
                          ? "bg-shine text-night"
                          : "border border-night-edge text-chalk-dim/40"
                    }`}
                  >
                    {done ? <Check size={12} /> : active ? <Loader2 size={12} className="animate-spin" /> : <Icon size={12} />}
                  </span>
                  <span
                    className={`truncate text-[12px] transition ${
                      active ? "font-semibold text-chalk" : done ? "text-go" : "text-chalk-dim/50"
                    }`}
                  >
                    {step.label}
                  </span>
                </span>
                {i < STEPS.length - 1 && (
                  <span className={`mx-2 h-px min-w-3 flex-1 ${done ? "bg-go/40" : "bg-night-edge"}`} />
                )}
              </li>
            );
          })}
        </ol>

        <div className="mt-3 flex items-center gap-3">
          <span className="h-1 flex-1 overflow-hidden rounded-full bg-night">
            <span
              className="block h-full rounded-full bg-shine transition-[width] duration-500"
              style={{ width: `${((at + 1) / STEPS.length) * 100}%` }}
            />
          </span>
          <span className="shrink-0 font-mono text-[10.5px] tabular-nums text-chalk-dim">
            {files.length > 0 ? `${files.length} ไฟล์` : "เริ่มต้น"}
          </span>
        </div>
      </div>

      {/* What just landed. Empty until the first file arrives, which is itself
          the answer to "is it doing anything yet". */}
      <div className="min-h-[7.5rem] rounded-xl border border-night-edge bg-night-panel px-4 py-3">
        <div className="mb-2 flex items-center gap-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-chalk-dim/60">กำลังทำ</p>
          {deps.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-shine/10 px-2 py-0.5 font-mono text-[10px] text-shine">
              <Boxes size={9} /> {deps.length} ชุดแพ็กเกจ
            </span>
          )}
        </div>
        {recent.length === 0 ? (
          <p className="py-4 text-center text-[12px] text-chalk-dim/50">
            AI กำลังอ่านเอกสารและวางโครงไฟล์
          </p>
        ) : (
          <ul className="space-y-1">
            {recent.map((a, i) => (
              <li
                key={`${a.icon}-${a.label}-${i}`}
                className={`flex items-center gap-2 text-[12px] transition ${i === 0 ? "text-chalk" : "text-chalk-dim/70"}`}
              >
                <span className={a.icon === "deps" ? "text-shine" : "text-chalk-dim/50"}>
                  {a.icon === "deps" ? <Package size={12} /> : <FileText size={12} />}
                </span>
                <span className="min-w-0 flex-1 truncate font-mono text-[11.5px]">{a.label}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p key={tip} className="tip-fade px-1 text-center text-[11.5px] leading-relaxed text-chalk-dim/60">
        {TIPS[tip]}
      </p>
    </div>
  );
}
