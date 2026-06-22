"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ArrowRight, FileText, MessagesSquare } from "lucide-react";
import { createProject } from "@/lib/storage";

const MAX_CHARS = 500;

const EXAMPLES = [
  "Landing page สำหรับ coffee shop สไตล์ minimal โทนสีครีม-น้ำตาล",
  "Dashboard ยอดขายร้านออนไลน์ มี KPI cards และกราฟรายเดือน",
  "หน้าจองโต๊ะร้านอาหาร เลือกวัน เวลา จำนวนคน พร้อมหน้า confirm",
  "Kanban board สำหรับทีม marketing ลาก task ระหว่างคอลัมน์ได้",
];

export default function LaunchPad() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Quick path: skip straight to the Build phase with the typed prompt (express).
  const launch = async () => {
    if (!prompt.trim() || launching) return;
    setError(null);
    setLaunching(true);
    try {
      const project = await createProject({
        name: prompt.trim().slice(0, 40),
        pendingPrompt: prompt.trim(),
        phase: "build",
      });
      router.push(`/project/${project.id}`);
    } catch (e) {
      console.error("[launchpad] create failed:", e);
      setError("สร้างโปรเจกต์ไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setLaunching(false);
    }
  };

  const launchSpec = async () => {
    if (launching) return;
    setError(null);
    setLaunching(true);
    try {
      const project = await createProject({ name: "Spec-to-Demo", pendingSpec: true });
      router.push(`/project/${project.id}`);
    } catch (e) {
      console.error("[launchpad] create failed:", e);
      setError("สร้างโปรเจกต์ไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setLaunching(false);
    }
  };

  // Full flow: start at the Define phase — the AI interviewer opens the session.
  const launchInterview = async () => {
    if (launching) return;
    setError(null);
    setLaunching(true);
    try {
      const project = await createProject({ name: "Define Session", phase: "define" });
      router.push(`/project/${project.id}`);
    } catch (e) {
      console.error("[launchpad] create failed:", e);
      setError("สร้างโปรเจกต์ไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setLaunching(false);
    }
  };

  return (
    <div className="w-full max-w-2xl rounded-2xl border border-white/15 bg-white/[0.04] backdrop-blur-sm">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/60">
          FITT-001 · Demo Brief
        </span>
        <span className="font-mono text-[11px] text-white/60">
          {prompt.length}/{MAX_CHARS}
        </span>
      </div>

      <textarea
        ref={textareaRef}
        value={prompt}
        maxLength={MAX_CHARS}
        rows={4}
        onChange={(event) => setPrompt(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            launch();
          }
        }}
        placeholder={'อยากได้เว็บแบบไหน? เช่น "landing page สำหรับ coffee shop สไตล์ minimal"'}
        className="block w-full resize-none bg-transparent px-4 py-4 text-lg leading-relaxed text-white outline-none placeholder:text-white/35"
      />

      <div className="flex flex-wrap items-center gap-2 border-t border-white/10 px-4 py-3">
        <button
          onClick={launch}
          disabled={!prompt.trim() || launching}
          className="group inline-flex items-center gap-2 rounded-full bg-white px-6 py-2.5 font-display font-semibold text-black transition hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {launching ? "กำลังเปิดสตูดิโอ…" : "สร้างเลย"}
          <ArrowRight
            size={17}
            className="transition-transform group-hover:translate-x-0.5"
          />
        </button>
        <button
          onClick={launchInterview}
          disabled={launching}
          className="inline-flex items-center gap-2 rounded-full border border-white/20 px-5 py-2.5 font-display text-sm font-medium text-white/80 transition hover:border-shine hover:text-shine disabled:opacity-40"
        >
          <MessagesSquare size={15} />
          ให้ AI สัมภาษณ์ (Define)
        </button>
        <button
          onClick={launchSpec}
          disabled={launching}
          className="inline-flex items-center gap-2 rounded-full border border-white/20 px-5 py-2.5 font-display text-sm font-medium text-white/80 transition hover:border-shine hover:text-shine disabled:opacity-40"
        >
          <FileText size={15} />
          มีเอกสารแล้ว
        </button>
        <span className="ml-auto hidden font-mono text-[11px] text-white/50 sm:block">
          Enter = สร้าง · Shift+Enter = บรรทัดใหม่
        </span>
      </div>

      {error && (
        <div className="border-t border-white/10 px-4 py-3 text-[13px] text-white/60">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5 border-t border-dashed border-white/10 px-4 py-3">
        {EXAMPLES.map((example) => (
          <button
            key={example}
            onClick={() => {
              setPrompt(example);
              textareaRef.current?.focus();
            }}
            className="rounded-full border border-white/15 px-3 py-1 text-[13px] text-white/60 transition hover:border-shine hover:text-shine"
          >
            {example.length > 42 ? example.slice(0, 42) + "…" : example}
          </button>
        ))}
      </div>
    </div>
  );
}
