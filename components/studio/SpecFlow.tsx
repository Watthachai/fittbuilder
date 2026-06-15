"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import { getPreset, PRESETS, type Preset } from "@/lib/presets";
import type { SpecAnswers } from "@/lib/types";

export interface SpecResult {
  prompt: string;
  brd?: string;
  prd?: string;
  presetId: string;
  answers: SpecAnswers;
}

type Step = "docs" | "detecting" | "confirm" | "questions" | "summary";

const MAX_DOC_CHARS = 50_000;

interface SpecFlowProps {
  onClose: () => void;
  onComplete: (result: SpecResult) => void;
}

export default function SpecFlow({ onClose, onComplete }: SpecFlowProps) {
  const [step, setStep] = useState<Step>("docs");
  const [brd, setBrd] = useState("");
  const [prd, setPrd] = useState("");
  const [confidence, setConfidence] = useState<"high" | "low">("low");
  const [preset, setPreset] = useState<Preset | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<SpecAnswers>({});
  const [prefilled, setPrefilled] = useState<Set<string>>(new Set());
  const [extraNote, setExtraNote] = useState("");

  const docText = [brd, prd].filter(Boolean).join("\n\n");
  const hasDoc = docText.trim().length >= 20;

  const detect = useCallback(async () => {
    setStep("detecting");
    try {
      const response = await fetch("/api/detect-preset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentText: docText }),
      });
      const data = (await response.json()) as { presetId?: string; confidence?: "high" | "low" };
      const found = data.presetId ? getPreset(data.presetId) : undefined;
      setPreset(found ?? PRESETS[0]);
      setConfidence(found ? (data.confidence ?? "low") : "low");
    } catch {
      setPreset(PRESETS[0]);
      setConfidence("low");
    }
    setStep("confirm");
  }, [docText]);

  const startQuestions = useCallback(
    async (chosen: Preset) => {
      setPreset(chosen);
      setQuestionIndex(0);
      setStep("questions");
      // Best-effort pre-fill from the documents (PRD §9.5 skip logic).
      try {
        const response = await fetch("/api/extract-answers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ documentText: docText, presetId: chosen.id }),
        });
        const data = (await response.json()) as { answers?: SpecAnswers };
        if (data.answers && Object.keys(data.answers).length > 0) {
          setAnswers((prev) => ({ ...data.answers, ...prev }));
          setPrefilled(new Set(Object.keys(data.answers)));
        }
      } catch {
        // Pre-fill is optional.
      }
    },
    [docText]
  );

  const finish = useCallback(() => {
    if (!preset) return;
    onComplete({
      prompt:
        `สร้าง web demo ระดับ production จาก BRD/PRD ที่แนบมา (domain: ${preset.nameEn})` +
        (extraNote.trim() ? ` — หมายเหตุเพิ่มเติม: ${extraNote.trim()}` : ""),
      brd: brd.trim() || undefined,
      prd: prd.trim() || undefined,
      presetId: preset.id,
      answers,
    });
  }, [answers, brd, extraNote, onComplete, prd, preset]);

  const question = preset?.questions[questionIndex];

  const next = useCallback(() => {
    if (!preset) return;
    if (questionIndex < preset.questions.length - 1) {
      setQuestionIndex((i) => i + 1);
    } else {
      setStep("summary");
    }
  }, [preset, questionIndex]);

  const back = useCallback(() => {
    if (step === "questions" && questionIndex > 0) {
      setQuestionIndex((i) => i - 1);
    } else if (step === "questions") {
      setStep("confirm");
    } else if (step === "summary") {
      setStep("questions");
      setQuestionIndex((preset?.questions.length ?? 1) - 1);
    } else if (step === "confirm") {
      setStep("docs");
    }
  }, [preset, questionIndex, step]);

  // Keyboard flow (PRD §9.5): Enter → next, Escape → back.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        if (step === "docs") onClose();
        else back();
      }
      if (event.key === "Enter" && !event.shiftKey && step === "questions") {
        const target = event.target as HTMLElement;
        if (target.tagName !== "TEXTAREA") {
          event.preventDefault();
          next();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [back, next, onClose, step]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-night/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl border border-night-edge bg-night-panel text-chalk shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-night-edge px-5 py-3">
          <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-shine">
            Spec-to-Demo
          </span>
          <div className="flex items-center gap-3">
            {step === "questions" && preset && (
              <div className="flex items-center gap-1.5">
                {preset.questions.map((q, index) => (
                  <span
                    key={q.id}
                    className={`h-1.5 w-1.5 rounded-full transition ${
                      index === questionIndex
                        ? "scale-125 bg-shine"
                        : index < questionIndex
                          ? "bg-go"
                          : "bg-night-edge"
                    }`}
                  />
                ))}
              </div>
            )}
            <button onClick={onClose} className="text-chalk-dim transition hover:text-chalk">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-6">
          {step === "docs" && (
            <div>
              <h2 className="font-display text-xl font-semibold">วางเอกสารของคุณ</h2>
              <p className="mt-1 text-[13px] text-chalk-dim">
                อย่างน้อย 1 อย่าง (BRD หรือ PRD) — ระบบจะอ่านแล้วถามคำถามเจาะจงก่อนสร้าง demo
              </p>
              {(
                [
                  ["BRD — Business Requirements", brd, setBrd],
                  ["PRD — Product Requirements", prd, setPrd],
                ] as const
              ).map(([label, value, setter]) => (
                <div key={label} className="mt-4">
                  <div className="flex items-center justify-between">
                    <label className="font-mono text-[11px] uppercase tracking-wider text-chalk-dim">
                      {label}
                    </label>
                    <span
                      className={`font-mono text-[10px] ${
                        value.length > MAX_DOC_CHARS * 0.9 ? "text-halt" : "text-chalk-dim"
                      }`}
                    >
                      {value.length.toLocaleString()}/{MAX_DOC_CHARS.toLocaleString()}
                    </span>
                  </div>
                  <textarea
                    value={value}
                    maxLength={MAX_DOC_CHARS}
                    onChange={(event) => setter(event.target.value)}
                    rows={5}
                    placeholder="วาง markdown หรือ text ที่นี่…"
                    className="scroll-thin mt-1.5 block w-full resize-y rounded-md border border-night-edge bg-night px-3 py-2.5 font-mono text-[12px] leading-relaxed text-chalk outline-none transition focus:border-shine"
                  />
                </div>
              ))}
              <div className="mt-5 flex justify-end">
                <button
                  onClick={() => void detect()}
                  disabled={!hasDoc}
                  className="inline-flex items-center gap-2 rounded-sm bg-shine px-5 py-2.5 font-display text-sm font-semibold text-black transition hover:bg-shine-soft disabled:opacity-40"
                >
                  อ่านเอกสาร <ArrowRight size={15} />
                </button>
              </div>
            </div>
          )}

          {step === "detecting" && (
            <div className="py-12 text-center">
              <p className="animate-pulse font-display text-lg">กำลังอ่านเอกสาร…</p>
              <p className="mt-2 font-mono text-[11px] text-chalk-dim">
                วิเคราะห์ domain จากเนื้อหา
              </p>
            </div>
          )}

          {step === "confirm" && preset && (
            <div>
              {confidence === "high" ? (
                <>
                  <h2 className="font-display text-xl font-semibold">
                    ดูเหมือนจะเป็น <span className="text-shine">{preset.name}</span> — ใช่ไหม?
                  </h2>
                  <p className="mt-1 text-[13px] text-chalk-dim">{preset.tagline}</p>
                  <div className="mt-5 flex gap-2">
                    <button
                      onClick={() => void startQuestions(preset)}
                      className="inline-flex items-center gap-2 rounded-sm bg-shine px-5 py-2.5 font-display text-sm font-semibold text-black transition hover:bg-shine-soft"
                    >
                      <Check size={15} /> ใช่ ไปต่อ
                    </button>
                    <button
                      onClick={() => setConfidence("low")}
                      className="rounded-sm border border-night-edge px-4 py-2.5 font-display text-sm text-chalk-dim transition hover:border-shine hover:text-chalk"
                    >
                      เลือก preset เอง
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="font-display text-xl font-semibold">เลือก domain ของ demo</h2>
                  <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {PRESETS.map((candidate) => (
                      <button
                        key={candidate.id}
                        onClick={() => void startQuestions(candidate)}
                        className={`rounded-md border p-3 text-left transition hover:border-shine ${
                          preset.id === candidate.id
                            ? "border-shine bg-shine/10"
                            : "border-night-edge"
                        }`}
                      >
                        <p className="font-display text-sm font-semibold">{candidate.name}</p>
                        <p className="mt-0.5 text-[11px] leading-snug text-chalk-dim">
                          {candidate.tagline}
                        </p>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {step === "questions" && preset && question && (
            <div>
              <p className="font-mono text-[11px] uppercase tracking-wider text-shine">
                {preset.name} · คำถาม {questionIndex + 1}/{preset.questions.length}
                {prefilled.has(question.id) && (
                  <span className="ml-2 text-go">· เติมให้จากเอกสารแล้ว</span>
                )}
              </p>
              <h2 className="mt-2 font-display text-xl font-semibold">{question.label}</h2>

              <div className="mt-4">
                {question.type === "text" ? (
                  <input
                    autoFocus
                    value={(answers[question.id] as string) ?? ""}
                    onChange={(event) =>
                      setAnswers((prev) => ({ ...prev, [question.id]: event.target.value }))
                    }
                    placeholder={question.placeholder}
                    className="block w-full rounded-md border border-night-edge bg-night px-3 py-3 text-[15px] text-chalk outline-none transition focus:border-shine"
                  />
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {question.options?.map((option) => {
                      const current = answers[question.id];
                      const isSelected =
                        question.type === "multi"
                          ? Array.isArray(current) && current.includes(option)
                          : current === option;
                      return (
                        <button
                          key={option}
                          onClick={() => {
                            setAnswers((prev) => {
                              if (question.type === "multi") {
                                const list = Array.isArray(prev[question.id])
                                  ? [...(prev[question.id] as string[])]
                                  : [];
                                return {
                                  ...prev,
                                  [question.id]: list.includes(option)
                                    ? list.filter((item) => item !== option)
                                    : [...list, option],
                                };
                              }
                              return { ...prev, [question.id]: option };
                            });
                            if (question.type === "single") setTimeout(next, 180);
                          }}
                          className={`rounded-md border px-4 py-2.5 font-display text-sm transition ${
                            isSelected
                              ? "border-shine bg-shine/15 text-chalk"
                              : "border-night-edge text-chalk-dim hover:border-shine/60 hover:text-chalk"
                          }`}
                        >
                          {isSelected && <Check size={12} className="mr-1.5 inline text-shine" />}
                          {option}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="mt-6 flex items-center justify-between">
                <button
                  onClick={back}
                  className="inline-flex items-center gap-1.5 font-display text-sm text-chalk-dim transition hover:text-chalk"
                >
                  <ArrowLeft size={14} /> ย้อนกลับ
                </button>
                <button
                  onClick={next}
                  className="inline-flex items-center gap-2 rounded-sm bg-shine px-5 py-2 font-display text-sm font-semibold text-black transition hover:bg-shine-soft"
                >
                  {questionIndex === preset.questions.length - 1 ? "สรุป" : "ถัดไป"}
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}

          {step === "summary" && preset && (
            <div>
              <h2 className="font-display text-xl font-semibold">สรุปก่อนสร้าง demo</h2>
              <div className="mt-4 space-y-2.5 rounded-md border border-night-edge bg-night p-4">
                <SummaryRow label="Domain" value={`${preset.name} (${preset.nameEn})`} />
                <SummaryRow label="เอกสาร" value={[brd && "BRD", prd && "PRD"].filter(Boolean).join(" + ") || "—"} />
                {preset.questions.map((q) => {
                  const value = answers[q.id];
                  return (
                    <SummaryRow
                      key={q.id}
                      label={q.label}
                      value={
                        Array.isArray(value) ? value.join(", ") : (value as string) || "— ข้าม —"
                      }
                    />
                  );
                })}
              </div>
              <input
                value={extraNote}
                onChange={(event) => setExtraNote(event.target.value)}
                placeholder="หมายเหตุเพิ่มเติม (ไม่บังคับ) เช่น โทนสีตาม brand"
                className="mt-3 block w-full rounded-md border border-night-edge bg-night px-3 py-2.5 text-[14px] text-chalk outline-none transition focus:border-shine"
              />
              <div className="mt-5 flex items-center justify-between">
                <button
                  onClick={back}
                  className="inline-flex items-center gap-1.5 font-display text-sm text-chalk-dim transition hover:text-chalk"
                >
                  <ArrowLeft size={14} /> แก้คำตอบ
                </button>
                <button
                  onClick={finish}
                  className="inline-flex items-center gap-2 rounded-sm bg-shine px-6 py-2.5 font-display text-sm font-bold text-black transition hover:bg-shine-soft"
                >
                  Generate Demo <ArrowRight size={15} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 text-[13px]">
      <span className="w-44 shrink-0 text-chalk-dim">{label}</span>
      <span className="text-chalk">{value}</span>
    </div>
  );
}
