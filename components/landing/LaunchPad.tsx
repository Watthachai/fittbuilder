"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, FileText, MessagesSquare, Paperclip, Plus, X } from "lucide-react";
import { createProject } from "@/lib/storage";
import { setPendingAction, setPendingAttachments } from "@/lib/pending-action";
import { ATTACHMENT_ACCEPT, fileToAttachment, MAX_ATTACHMENT_BYTES } from "@/lib/attachments";
import SkillPicker from "@/components/studio/SkillPicker";
import SkillDropdown from "@/components/studio/SkillDropdown";
import OrgSelect from "@/components/org/OrgSelect";
import type { ChatAttachmentInput } from "@/lib/types";

const MAX_CHARS = 10_000;
// Mirrors /api/agent's attachment schema: max 5 files, ≤4MB each.
const MAX_FILES = 5;

const EXAMPLES = [
  "Landing page สำหรับ coffee shop สไตล์ minimal โทนสีครีม-น้ำตาล",
  "Dashboard ยอดขายร้านออนไลน์ มี KPI cards และกราฟรายเดือน",
  "หน้าจองโต๊ะร้านอาหาร เลือกวัน เวลา จำนวนคน พร้อมหน้า confirm",
  "Kanban board สำหรับทีม marketing ลาก task ระหว่างคอลัมน์ได้",
];

export default function LaunchPad({
  onLaunch,
}: {
  /** Plays the dive-into-the-screen transition just before navigating. */
  onLaunch?: () => Promise<void>;
}) {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [detectedSkillId, setDetectedSkillId] = useState<string | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [plusOpen, setPlusOpen] = useState(false);
  const [attachments, setAttachments] = useState<ChatAttachmentInput[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onPickFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);
    let count = attachments.length; // setState is async — track the running total locally
    for (const file of Array.from(files)) {
      if (count >= MAX_FILES) {
        setError(`แนบได้สูงสุด ${MAX_FILES} ไฟล์`);
        break;
      }
      if (file.size > MAX_ATTACHMENT_BYTES) {
        setError(`"${file.name}" ใหญ่เกิน 4MB — ข้ามไฟล์นี้`);
        continue;
      }
      try {
        const att = await fileToAttachment(file);
        count++;
        setAttachments((prev) => [...prev, att]);
      } catch (e) {
        // Conversion failures (e.g. legacy .xls) carry a user-facing message.
        setError(e instanceof Error ? e.message : `แนบ "${file.name}" ไม่สำเร็จ`);
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

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
      // Start at Define: the brief is complete, so the studio auto-pilots the
      // full flow (BRD → PRD → build) instead of jumping straight to Build.
      const project = await createProject({
        // Leave the name as the default placeholder; the studio replaces it with
        // the generated product name (from the demo's <title>) on first build.
        phase: "define",
        skillId: skillId ?? undefined,
        orgId: selectedOrgId ?? undefined,
      });
      // Note the attached files in the prompt (same convention as ChatPanel) so
      // they're visible in the transcript; the payloads themselves are too big
      // for sessionStorage and ride IndexedDB to the studio.
      const fullPrompt = attachments.length
        ? `${prompt.trim()}\n\n🖼️ แนบ: ${attachments.map((a) => a.name).join(", ")}`
        : prompt.trim();
      setPendingAction(project.id, { kind: "express", prompt: fullPrompt });
      if (attachments.length) await setPendingAttachments(project.id, attachments);
      await onLaunch?.();
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
      const project = await createProject({ name: "Spec-to-Demo", orgId: selectedOrgId ?? undefined });
      setPendingAction(project.id, { kind: "spec" });
      await onLaunch?.();
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
      const project = await createProject({ name: "Define Session", phase: "define", orgId: selectedOrgId ?? undefined });
      await onLaunch?.();
      router.push(`/project/${project.id}`);
    } catch (e) {
      console.error("[launchpad] create failed:", e);
      setError("สร้างโปรเจกต์ไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setLaunching(false);
    }
  };

  return (
    <div className="glass w-full max-w-2xl rounded-2xl">
      <div className="flex items-center justify-between gap-2 border-b border-chalk/10 px-3 py-2">
        <OrgSelect value={selectedOrgId} onChange={setSelectedOrgId} />
        <span className="shrink-0 font-mono text-[11px] text-chalk/60">
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
            className="mt-3 text-xs text-chalk/50 transition hover:text-chalk disabled:opacity-40"
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
        className="block w-full resize-none bg-transparent px-4 py-4 text-lg leading-relaxed text-chalk outline-none placeholder:text-chalk/35"
      />

      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-4 pb-2">
          {attachments.map((a, i) => (
            <span
              key={`${a.name}-${i}`}
              className="inline-flex max-w-[220px] items-center gap-1.5 rounded-full border border-chalk/15 bg-chalk/5 py-1 pl-2.5 pr-1 text-[12px] text-chalk/75"
            >
              <Paperclip size={11} className="shrink-0 text-shine" />
              <span className="truncate">{a.name}</span>
              <button
                onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))}
                aria-label={`ลบ ${a.name}`}
                className="grid h-5 w-5 shrink-0 place-items-center rounded-full transition hover:bg-chalk/10 hover:text-chalk"
              >
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-chalk/10 px-4 py-3">
        <div className="relative">
          <motion.button
            type="button"
            whileTap={{ scale: 0.92 }}
            onClick={() => setPlusOpen((v) => !v)}
            disabled={launching}
            aria-label="ตัวเลือกเพิ่มเติม"
            className="grid h-9 w-9 place-items-center rounded-full border border-chalk/15 bg-chalk/5 text-chalk/80 transition hover:border-chalk/30 disabled:opacity-40"
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
                  className="absolute bottom-full left-0 z-50 mb-2 w-64 origin-bottom-left overflow-hidden rounded-2xl border border-chalk/12 bg-night-panel p-1.5 shadow-2xl"
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

        <input
          ref={fileInputRef}
          type="file"
          hidden
          multiple
          accept={ATTACHMENT_ACCEPT}
          onChange={(e) => void onPickFiles(e.target.files)}
        />
        <motion.button
          type="button"
          whileTap={{ scale: 0.92 }}
          onClick={() => fileInputRef.current?.click()}
          disabled={launching}
          aria-label="แนบไฟล์"
          title="แนบไฟล์ (รูป/PDF/เอกสาร) ให้ AI ใช้ประกอบการสร้าง"
          className="grid h-9 w-9 place-items-center rounded-full border border-chalk/15 bg-chalk/5 text-chalk/80 transition hover:border-chalk/30 disabled:opacity-40"
        >
          <Paperclip size={16} />
        </motion.button>

        <SkillDropdown value={selectedSkillId} onChange={setSelectedSkillId} />

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={launch}
          disabled={!prompt.trim() || launching}
          className="group ml-auto inline-flex items-center gap-2 rounded-full bg-chalk px-6 py-2.5 font-display font-semibold text-night transition hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {launching ? "กำลังเปิดสตูดิโอ…" : "สร้างเลย"}
          <ArrowRight size={17} className="transition-transform group-hover:translate-x-0.5" />
        </motion.button>
      </div>

      {error && (
        <div className="border-t border-chalk/10 px-4 py-3 text-[13px] text-chalk/60">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5 border-t border-dashed border-chalk/10 px-4 py-3">
        {EXAMPLES.map((example) => (
          <button
            key={example}
            onClick={() => {
              setPrompt(example);
              textareaRef.current?.focus();
            }}
            className="rounded-full border border-chalk/15 px-3 py-1 text-[13px] text-chalk/60 transition hover:border-shine hover:text-shine"
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
      className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-chalk/5"
    >
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-sm font-medium text-chalk">{title}</span>
        <span className="mt-0.5 block text-xs leading-snug text-chalk/55">{desc}</span>
      </span>
    </button>
  );
}
