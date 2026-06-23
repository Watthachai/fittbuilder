"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import SkillIcon, { SKILL_ICON_NAMES } from "@/components/studio/SkillIcon";
import type { SkillTemplateRow } from "@/lib/skills/db-mapper";
import type { SkillQuestion } from "@/lib/skills/types";

interface QuestionDraft {
  id: string;
  label: string;
  type: "single" | "multi" | "text";
  optionsText: string;
  why: string;
}

function toDraft(q: SkillQuestion): QuestionDraft {
  return {
    id: q.id,
    label: q.label,
    type: q.type,
    optionsText: (q.options ?? []).join(", "),
    why: q.why ?? "",
  };
}

const INPUT =
  "w-full rounded-lg border border-night-edge bg-black/30 px-3 py-2 text-sm text-chalk outline-none focus:border-shine";
const LABEL = "block text-xs font-medium text-chalk-dim";

export default function SkillTemplateForm({
  initial,
  onDone,
  onCancel,
}: {
  initial: SkillTemplateRow | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const editing = Boolean(initial);
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [nameEn, setNameEn] = useState(initial?.name_en ?? "");
  const [tagline, setTagline] = useState(initial?.tagline ?? "");
  const [icon, setIcon] = useState(initial?.icon ?? "Sparkles");
  const [keywordsText, setKeywordsText] = useState((initial?.keywords ?? []).join(", "));
  const [persona, setPersona] = useState(initial?.persona ?? "");
  const [domainKnowledge, setDomainKnowledge] = useState(initial?.domain_knowledge ?? "");
  const [buildGuidance, setBuildGuidance] = useState(initial?.build_guidance ?? "");
  const [seedData, setSeedData] = useState(initial?.seed_data ?? "");
  const [designHints, setDesignHints] = useState(initial?.design_hints ?? "");
  const [questions, setQuestions] = useState<QuestionDraft[]>(
    (initial?.question_bank ?? []).map(toDraft)
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addQuestion() {
    setQuestions((qs) => [
      ...qs,
      { id: crypto.randomUUID().slice(0, 8), label: "", type: "single", optionsText: "", why: "" },
    ]);
  }
  function updateQuestion(i: number, patch: Partial<QuestionDraft>) {
    setQuestions((qs) => qs.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));
  }
  function removeQuestion(i: number) {
    setQuestions((qs) => qs.filter((_, idx) => idx !== i));
  }

  async function submit() {
    setError(null);
    setBusy(true);
    const questionBank: SkillQuestion[] = questions
      .filter((q) => q.label.trim())
      .map((q) => ({
        id: q.id,
        label: q.label.trim(),
        type: q.type,
        options:
          q.type !== "text" && q.optionsText.trim()
            ? q.optionsText.split(",").map((o) => o.trim()).filter(Boolean)
            : undefined,
        why: q.why.trim() || undefined,
      }));
    const payload = {
      name: name.trim(),
      nameEn: nameEn.trim(),
      tagline: tagline.trim(),
      icon,
      keywords: keywordsText.split(",").map((k) => k.trim()).filter(Boolean),
      persona,
      domainKnowledge,
      buildGuidance,
      seedData,
      designHints: designHints.trim() || undefined,
      questionBank,
    };
    try {
      const res = editing
        ? await fetch(`/api/admin/skills/${initial!.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/admin/skills", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...payload, slug: slug.trim() }),
          });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setError(data?.error ?? "บันทึกไม่สำเร็จ");
        return;
      }
      onDone();
    } catch {
      setError("เครือข่ายมีปัญหา ลองใหม่");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-night-edge bg-night-panel p-5">
      <h2 className="font-display text-lg font-semibold text-chalk">
        {editing ? `แก้ไข: ${initial!.name}` : "สร้าง Skill Template ใหม่"}
      </h2>

      {error && (
        <p className="rounded border border-halt/40 bg-halt/10 px-3 py-2 text-xs text-halt">{error}</p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={LABEL}>slug (id ของโดเมน — a-z 0-9 -)</label>
          <input
            className={`${INPUT} ${editing ? "opacity-50" : ""}`}
            value={slug}
            disabled={editing}
            placeholder="logistics"
            onChange={(e) => setSlug(e.target.value)}
          />
        </div>
        <div>
          <label className={LABEL}>ไอคอน</label>
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-night-edge bg-black/30">
              <SkillIcon name={icon} size={18} />
            </span>
            <select className={INPUT} value={icon} onChange={(e) => setIcon(e.target.value)}>
              {SKILL_ICON_NAMES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className={LABEL}>ชื่อ (ไทย)</label>
          <input className={INPUT} value={name} onChange={(e) => setName(e.target.value)} placeholder="โลจิสติกส์" />
        </div>
        <div>
          <label className={LABEL}>ชื่อ (อังกฤษ)</label>
          <input className={INPUT} value={nameEn} onChange={(e) => setNameEn(e.target.value)} placeholder="Logistics" />
        </div>
        <div className="sm:col-span-2">
          <label className={LABEL}>tagline (คำโปรยสั้นๆ)</label>
          <input className={INPUT} value={tagline} onChange={(e) => setTagline(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <label className={LABEL}>keywords (คั่นด้วย ,) — ใช้ตอน AI เดาโดเมน</label>
          <input className={INPUT} value={keywordsText} onChange={(e) => setKeywordsText(e.target.value)} placeholder="logistics, ขนส่ง, คลัง" />
        </div>
      </div>

      <Field label="persona — กรอบผู้เชี่ยวชาญ (ฉีดเข้า interview)" value={persona} onChange={setPersona} rows={3} />
      <Field label="domain knowledge (markdown)" value={domainKnowledge} onChange={setDomainKnowledge} rows={4} />
      <Field label="build guidance — หน้าจอ/สถาปัตยกรรม (markdown)" value={buildGuidance} onChange={setBuildGuidance} rows={4} />
      <Field label="seed data — ข้อมูลตัวอย่างฝังใน demo (markdown)" value={seedData} onChange={setSeedData} rows={4} />
      <Field label="design hints (ไม่บังคับ)" value={designHints} onChange={setDesignHints} rows={2} />

      {/* Question builder */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className={LABEL}>คำถามเชิงลึก (question bank)</span>
          <button
            type="button"
            onClick={addQuestion}
            className="inline-flex items-center gap-1 rounded-lg border border-night-edge px-2.5 py-1 text-xs text-chalk-dim transition hover:text-chalk"
          >
            <Plus size={13} /> เพิ่มคำถาม
          </button>
        </div>
        {questions.map((q, i) => (
          <div key={q.id} className="space-y-2 rounded-lg border border-night-edge bg-black/20 p-3">
            <div className="flex items-center gap-2">
              <input
                className={INPUT}
                value={q.label}
                placeholder={`คำถามที่ ${i + 1}`}
                onChange={(e) => updateQuestion(i, { label: e.target.value })}
              />
              <select
                className="rounded-lg border border-night-edge bg-black/30 px-2 py-2 text-sm text-chalk"
                value={q.type}
                onChange={(e) => updateQuestion(i, { type: e.target.value as QuestionDraft["type"] })}
              >
                <option value="single">single</option>
                <option value="multi">multi</option>
                <option value="text">text</option>
              </select>
              <button
                type="button"
                onClick={() => removeQuestion(i)}
                className="shrink-0 rounded-lg border border-night-edge p-2 text-chalk-dim transition hover:text-halt"
              >
                <Trash2 size={14} />
              </button>
            </div>
            {q.type !== "text" && (
              <input
                className={INPUT}
                value={q.optionsText}
                placeholder="ตัวเลือก คั่นด้วย , (เช่น รถ, เรือ, เครื่องบิน)"
                onChange={(e) => updateQuestion(i, { optionsText: e.target.value })}
              />
            )}
            <input
              className={INPUT}
              value={q.why}
              placeholder="ทำไมถึงถาม (ไม่บังคับ — โชว์ให้ผู้ใช้)"
              onChange={(e) => updateQuestion(i, { why: e.target.value })}
            />
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 pt-2">
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="rounded-lg bg-shine px-4 py-2 font-display text-sm font-semibold text-black transition hover:brightness-110 disabled:opacity-40"
        >
          {busy ? "กำลังบันทึก…" : editing ? "บันทึกการแก้ไข" : "สร้าง (เป็น draft)"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="rounded-lg border border-night-edge px-4 py-2 text-sm text-chalk-dim transition hover:text-chalk disabled:opacity-40"
        >
          ยกเลิก
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  rows,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows: number;
}) {
  return (
    <div>
      <label className={LABEL}>{label}</label>
      <textarea
        className={`${INPUT} resize-y`}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
