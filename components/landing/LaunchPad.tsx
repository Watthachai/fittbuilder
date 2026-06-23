"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, FileText, MessagesSquare, Plus } from "lucide-react";
import { createProject } from "@/lib/storage";
import { setPendingAction } from "@/lib/pending-action";
import SkillPicker from "@/components/studio/SkillPicker";
import SkillDropdown from "@/components/studio/SkillDropdown";

const MAX_CHARS = 10_000;

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
  const [picking, setPicking] = useState(false);
  const [detectedSkillId, setDetectedSkillId] = useState<string | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [plusOpen, setPlusOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Quick path: detect the domain, show the skill confirm card, then build.
  const launch = async () => {
    if (!prompt.trim() || launching || picking) return;
    // Explicit choice → build straight away with that skill (skip the detect card).
    if (selectedSkillId) {
      void createWithSkill(selectedSkillId);
      return;
    }
    setError(null);
    setPicking(true);
    setDetecting(true);
    try {
      const res = await fetch("/api/detect-skill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: prompt.trim() }),
      });
      const data = (await res.json().catch(() => null)) as { skillId?: string | null } | null;
      setDetectedSkillId(data?.skillId ?? null);
    } catch {
      setDetectedSkillId(null);
    } finally {
      setDetecting(false);
    }
  };

  // Create the express-build project with the chosen domain skill (or none).
  const createWithSkill = async (skillId: string | null) => {
    if (launching) return;
    setLaunching(true);
    try {
      const project = await createProject({
        name: prompt.trim().slice(0, 40),
        phase: "build",
        skillId: skillId ?? undefined,
      });
      setPendingAction(project.id, { kind: "build", prompt: prompt.trim() });
      router.push(`/project/${project.id}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[launchpad] create failed:", msg);
      setError(`สร้างโปรเจกต์ไม่สำเร็จ: ${msg}`);
      setLaunching(false);
      setPicking(false);
    }
  };

  const launchSpec = async () => {
    if (launching) return;
    setError(null);
    setLaunching(true);
    try {
      const project = await createProject({ name: "Spec-to-Demo" });
      setPendingAction(project.id, { kind: "spec" });
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

      {picking ? (
        <div className="p-4">
          <SkillPicker
            detectedId={detectedSkillId}
            busy={detecting}
            onSelect={(id) => void createWithSkill(id)}
            onSkip={() => void createWithSkill(null)}
          />
          <button
            onClick={() => setPicking(false)}
            disabled={launching}
            className="mt-3 text-xs text-white/50 transition hover:text-white disabled:opacity-40"
          >
            ← กลับไปแก้ prompt
          </button>
        </div>
      ) : (
        <>
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
        <div className="relative">
          <motion.button
            type="button"
            whileTap={{ scale: 0.92 }}
            onClick={() => setPlusOpen((v) => !v)}
            disabled={launching}
            aria-label="ตัวเลือกเพิ่มเติม"
            className="grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-white/5 text-white/80 transition hover:border-white/30 disabled:opacity-40"
          >
            <Plus size={18} className={`transition-transform ${plusOpen ? "rotate-45" : ""}`} />
          </motion.button>
          <AnimatePresence>
            {plusOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setPlusOpen(false)} />
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.96 }}
                  transition={{ duration: 0.16, ease: "easeOut" }}
                  className="absolute bottom-full left-0 z-50 mb-2 w-64 origin-bottom-left overflow-hidden rounded-2xl border border-white/12 bg-[#15151c] p-1.5 shadow-2xl"
                >
                  <MenuItem
                    icon={<MessagesSquare size={16} className="text-shine" />}
                    title="ให้ AI สัมภาษณ์ (Define)"
                    desc="เริ่มจากสัมภาษณ์ → BRD/PRD แบบมีโครง"
                    onClick={() => {
                      setPlusOpen(false);
                      void launchInterview();
                    }}
                  />
                  <MenuItem
                    icon={<FileText size={16} className="text-shine" />}
                    title="มีเอกสารแล้ว"
                    desc="วาง BRD/PRD → ตอบคำถามสั้นๆ → demo"
                    onClick={() => {
                      setPlusOpen(false);
                      void launchSpec();
                    }}
                  />
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        <SkillDropdown value={selectedSkillId} onChange={setSelectedSkillId} />

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={launch}
          disabled={!prompt.trim() || launching}
          className="group ml-auto inline-flex items-center gap-2 rounded-full bg-white px-6 py-2.5 font-display font-semibold text-black transition hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {launching ? "กำลังเปิดสตูดิโอ…" : "สร้างเลย"}
          <ArrowRight size={17} className="transition-transform group-hover:translate-x-0.5" />
        </motion.button>
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
        </>
      )}
    </div>
  );
}

function MenuItem({
  icon,
  title,
  desc,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-white/5"
    >
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-sm font-medium text-white">{title}</span>
        <span className="mt-0.5 block text-xs leading-snug text-white/55">{desc}</span>
      </span>
    </button>
  );
}
