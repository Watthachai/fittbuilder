"use client";

import { useMemo, useState } from "react";
import { ArrowRight, ImagePlus, X } from "lucide-react";
import {
  composeTemplateBrief,
  DESIGN_TEMPLATES,
  missingRequired,
  type DesignTemplate,
} from "@/lib/design-templates";
import { MESSAGE_MAX_CHARS } from "@/lib/limits";

/**
 * Pick a curated look, and the form tells you exactly what to go find —
 * "sky, full frame, nothing prominent in it" — instead of leaving the person
 * to guess what a cinematic scroll page needs. Submitting composes the
 * template's recipe with the filled slots and hands the result to the same
 * express-build path as the main prompt box.
 */
export default function TemplateGallery({
  disabled,
  onCreate,
}: {
  disabled: boolean;
  onCreate: (brief: string) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const open = DESIGN_TEMPLATES.find((t) => t.id === openId) ?? null;

  const pick = (t: DesignTemplate) => {
    setValues({});
    setOpenId(t.id);
  };

  return (
    <>
      <div className="border-t border-dashed border-chalk/10 px-4 py-3">
        <p className="mb-2 font-display text-[11.5px] uppercase tracking-widest text-chalk/50">
          หรือเริ่มจากเทมเพลตดีไซน์ — เลือกแล้วแค่หารูปมาวางตามโครง
        </p>
        <div className="flex flex-wrap gap-2">
          {DESIGN_TEMPLATES.map((t) => (
            <button
              key={t.id}
              onClick={() => pick(t)}
              disabled={disabled}
              className="group flex min-w-[220px] flex-1 items-start gap-2.5 rounded-xl border border-chalk/15 px-3 py-2.5 text-left transition hover:border-shine/60 disabled:opacity-40"
            >
              <span className="text-xl leading-none">{t.emoji}</span>
              <span className="min-w-0">
                <span className="block font-display text-[13.5px] font-semibold text-chalk group-hover:text-shine">
                  {t.name}
                </span>
                <span className="mt-0.5 block text-[12px] leading-snug text-chalk/55">
                  {t.tagline}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>

      {open && (
        <TemplateForm
          template={open}
          values={values}
          setValues={setValues}
          disabled={disabled}
          onClose={() => setOpenId(null)}
          onCreate={onCreate}
        />
      )}
    </>
  );
}

function TemplateForm({
  template,
  values,
  setValues,
  disabled,
  onClose,
  onCreate,
}: {
  template: DesignTemplate;
  values: Record<string, string>;
  setValues: (v: Record<string, string>) => void;
  disabled: boolean;
  onClose: () => void;
  onCreate: (brief: string) => void;
}) {
  const missing = missingRequired(template, values);
  const brief = useMemo(() => composeTemplateBrief(template, values), [template, values]);
  const tooLong = brief.length > MESSAGE_MAX_CHARS;

  const inputCls =
    "w-full rounded-lg border border-chalk/15 bg-night/80 px-2.5 py-1.5 text-[13.5px] text-chalk outline-none placeholder:text-chalk/30 focus:border-shine/60";

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label={`เทมเพลต ${template.name}`}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-chalk/15 bg-night"
      >
        <div className="flex items-start gap-2.5 border-b border-chalk/10 px-4 py-3">
          <span className="text-2xl leading-none">{template.emoji}</span>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-[15px] font-semibold text-chalk">{template.name}</h2>
            <p className="text-[12.5px] leading-snug text-chalk/55">{template.tagline}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="ปิด"
            className="rounded-md p-1 text-chalk/50 transition hover:text-chalk"
          >
            <X size={16} />
          </button>
        </div>

        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <div className="flex flex-col gap-3">
            {template.slots.map((slot) => (
              <label key={slot.id} className="block">
                <span className="mb-1 flex items-baseline gap-1.5">
                  {slot.kind === "image" && (
                    <ImagePlus size={12} className="translate-y-0.5 text-shine" />
                  )}
                  <span className="font-display text-[12.5px] text-chalk">
                    {slot.label}
                    {slot.required && <span className="text-halt"> *</span>}
                  </span>
                </span>
                <span className="mb-1 block text-[11.5px] leading-snug text-chalk/50">
                  {slot.hint}
                </span>
                {slot.kind === "textarea" ? (
                  <textarea
                    value={values[slot.id] ?? ""}
                    onChange={(e) => setValues({ ...values, [slot.id]: e.target.value })}
                    rows={3}
                    placeholder={slot.placeholder}
                    className={`${inputCls} resize-y`}
                  />
                ) : (
                  <input
                    value={values[slot.id] ?? ""}
                    onChange={(e) => setValues({ ...values, [slot.id]: e.target.value })}
                    placeholder={slot.placeholder}
                    inputMode={slot.kind === "image" ? "url" : undefined}
                    className={inputCls}
                  />
                )}
              </label>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 border-t border-chalk/10 px-4 py-3">
          <p className="min-w-0 flex-1 text-[11.5px] leading-snug text-chalk/45">
            {tooLong
              ? `ยาวเกินเพดาน ${MESSAGE_MAX_CHARS.toLocaleString()} ตัวอักษร — ตัดเนื้อหาบางช่องลง`
              : "ช่องที่เว้นไว้ เทมเพลตมีทางลงของมันเอง · สร้างแล้วคุยแก้ต่อในสตูดิโอได้ทุกอย่าง"}
          </p>
          <button
            onClick={() => onCreate(brief)}
            disabled={disabled || missing.length > 0 || tooLong}
            title={missing.length > 0 ? "กรอกช่องที่มี * ให้ครบก่อน" : undefined}
            className="inline-flex shrink-0 items-center gap-2 rounded-full bg-chalk px-5 py-2 font-display text-[14px] font-semibold text-night transition hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {disabled ? "กำลังเปิดสตูดิโอ…" : "สร้างจากเทมเพลตนี้"}
            <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
