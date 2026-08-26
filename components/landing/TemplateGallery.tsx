"use client";

import { useMemo, useRef, useState } from "react";
import { ArrowRight, ImageOff, Loader2, Upload, X } from "lucide-react";
import {
  composeTemplateBrief,
  DESIGN_TEMPLATES,
  missingRequired,
  type DesignTemplate,
  type TemplateSlot,
} from "@/lib/design-templates";
import { MESSAGE_MAX_CHARS } from "@/lib/limits";
import { uploadUserImage } from "@/lib/user-brand";

/**
 * Pick a curated look, and the form tells you exactly what to go find —
 * "sky, full frame, nothing prominent in it" — instead of leaving the person
 * to guess what a cinematic scroll page needs. Image slots take a pasted URL
 * or a file straight off the disk (uploaded to public storage, so the
 * generated code can reference it forever), and show a live thumbnail so you
 * see what you're building with. Submitting composes the template's recipe
 * with the filled slots and hands the result to the same express-build path
 * as the main prompt box.
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

  return (
    <>
      <div className="border-t border-dashed border-chalk/10 px-4 py-3">
        <p className="mb-2 font-display text-[11.5px] uppercase tracking-widest text-chalk/50">
          หรือเริ่มจากเทมเพลตดีไซน์ — เลือกลุค แล้วแค่หารูปมาวางตามโครง
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {DESIGN_TEMPLATES.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setValues({});
                setOpenId(t.id);
              }}
              disabled={disabled}
              className="group overflow-hidden rounded-xl border border-chalk/15 text-left transition hover:border-shine/60 disabled:opacity-40"
            >
              <CoverArt id={t.id} />
              <div className="flex items-start gap-2 px-3 py-2.5">
                <span className="text-base leading-none">{t.emoji}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-[13.5px] font-semibold text-chalk group-hover:text-shine">
                    {t.name}
                  </span>
                  <span className="mt-0.5 block text-[12px] leading-snug text-chalk/55">
                    {t.tagline}
                  </span>
                </span>
              </div>
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

/**
 * A still cover for each template card — a poster, not a screenshot and not the
 * animated mockup that read as broken. Just a gradient in the look's palette
 * with its display word centred, so the card carries a visual without claiming
 * to be a live preview.
 */
function CoverArt({ id }: { id: string }) {
  if (id === "cinematic-scroll") {
    return (
      <div className="relative aspect-video overflow-hidden bg-[#0d1615]" aria-hidden="true">
        <div className="absolute inset-0 bg-gradient-to-b from-[#7fb4d4] via-[#436d7c] to-[#0d1615]" />
        <div className="absolute inset-x-0 bottom-0 h-1/4 bg-[#0d1615]" />
        <span className="absolute inset-0 grid place-items-center font-serif text-2xl tracking-[0.22em] text-[#fdf1e1]">
          CINEMATIC
        </span>
      </div>
    );
  }
  if (id === "spotlight-hero") {
    return (
      <div className="relative aspect-video overflow-hidden bg-[#08090b]" aria-hidden="true">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 42% 52%, rgba(232,170,110,0.55) 0, rgba(150,90,55,0.28) 26%, transparent 52%)",
          }}
        />
        <span className="absolute inset-0 grid place-items-center font-serif text-2xl italic text-[#f4ede2]">
          Spotlight
        </span>
      </div>
    );
  }
  return <div className="aspect-video bg-night" aria-hidden="true" />;
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
  const images = template.slots.filter((s) => s.kind === "image");
  const texts = template.slots.filter((s) => s.kind !== "image");

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label={`เทมเพลต ${template.name}`}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-chalk/15 bg-night"
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
          {/* Images first: they are the part the person has to go hunting for. */}
          <p className="mb-2 font-display text-[11.5px] uppercase tracking-widest text-chalk/50">
            รูปที่ต้องหามาวาง
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {images.map((slot) => (
              <ImageSlotField
                key={slot.id}
                slot={slot}
                value={values[slot.id] ?? ""}
                onChange={(v) => setValues({ ...values, [slot.id]: v })}
              />
            ))}
          </div>

          <p className="mb-2 mt-5 font-display text-[11.5px] uppercase tracking-widest text-chalk/50">
            เนื้อหา
          </p>
          <div className="flex flex-col gap-3">
            {texts.map((slot) => (
              <label key={slot.id} className="block">
                <span className="mb-0.5 block font-display text-[12.5px] text-chalk">
                  {slot.label}
                  {slot.required && <span className="text-halt"> *</span>}
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
                    className="w-full resize-y rounded-lg border border-chalk/15 bg-night/80 px-2.5 py-1.5 text-[13.5px] text-chalk outline-none placeholder:text-chalk/30 focus:border-shine/60"
                  />
                ) : (
                  <input
                    value={values[slot.id] ?? ""}
                    onChange={(e) => setValues({ ...values, [slot.id]: e.target.value })}
                    placeholder={slot.placeholder}
                    className="w-full rounded-lg border border-chalk/15 bg-night/80 px-2.5 py-1.5 text-[13.5px] text-chalk outline-none placeholder:text-chalk/30 focus:border-shine/60"
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

/**
 * One image slot: paste a URL or upload a file, and see a live thumbnail of
 * whatever ends up there. The thumbnail is the honesty check — a broken link
 * shows itself here, not on the generated page.
 */
function ImageSlotField({
  slot,
  value,
  onChange,
}: {
  slot: TemplateSlot;
  value: string;
  onChange: (v: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [broken, setBroken] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      onChange(await uploadUserImage(file, "tpl"));
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "อัปโหลดไม่สำเร็จ");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="rounded-lg border border-chalk/15 p-2.5">
      <p className="font-display text-[12.5px] text-chalk">
        {slot.label}
        {slot.required && <span className="text-halt"> *</span>}
      </p>
      <p className="mt-0.5 text-[11.5px] leading-snug text-chalk/50">{slot.hint}</p>

      <div className="mt-2 flex items-start gap-2">
        {/* Thumbnail — what will actually be built with. */}
        <div className="grid h-14 w-20 shrink-0 place-items-center overflow-hidden rounded-md border border-chalk/10 bg-night/60">
          {value.trim() && !broken ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={value.trim()}
              alt=""
              className="h-full w-full object-cover"
              onError={() => setBroken(true)}
              onLoad={() => setBroken(false)}
            />
          ) : value.trim() && broken ? (
            <ImageOff size={16} className="text-halt/70" />
          ) : (
            <span className="text-[10px] text-chalk/30">ยังไม่มีรูป</span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <input
            value={value}
            onChange={(e) => {
              setBroken(false);
              onChange(e.target.value);
            }}
            placeholder={slot.placeholder ?? "https://…"}
            inputMode="url"
            className="w-full rounded-lg border border-chalk/15 bg-night/80 px-2.5 py-1.5 text-[12.5px] text-chalk outline-none placeholder:text-chalk/30 focus:border-shine/60"
          />
          <div className="mt-1.5 flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-1 rounded-md border border-chalk/15 px-2 py-0.5 font-display text-[11.5px] text-chalk/70 transition hover:border-shine/60 hover:text-chalk disabled:opacity-40"
            >
              {uploading ? (
                <Loader2 size={10} className="animate-spin" />
              ) : (
                <Upload size={10} />
              )}
              อัปโหลดไฟล์
            </button>
            <span className="text-[10.5px] text-chalk/35">หรือวางลิงก์รูปจากเว็บไหนก็ได้</span>
          </div>
          {broken && value.trim() && (
            <p className="mt-1 text-[11px] text-halt/80">ลิงก์นี้เปิดเป็นรูปไม่ได้ — ตรวจ URL อีกที</p>
          )}
          {uploadError && <p className="mt-1 text-[11px] text-halt/80">{uploadError}</p>}
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          void pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}
