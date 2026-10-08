"use client";

import { useCallback, useState, type ClipboardEvent } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { CASE_KIND, CASE_STATUS, type CaseAttachment, type CaseKind, type CaseStatus } from "@/lib/cases";
import { CASE_IMAGE_ACCEPT, uploadCaseImage } from "@/lib/cases-client";
import { toast } from "@/lib/toast";

/** Pills, people and pictures shared by the report dialog and the cases page. */

/**
 * Every status and kind has its own colour, so a list of cases reads at a
 * glance: orange waits on the team, violet waits on the reporter, blue is being
 * worked, green is fixed.
 */
const STATUS_TONE: Record<CaseStatus, string> = {
  new: "border-orange-400/50 bg-orange-400/10 text-orange-300 light:text-orange-700",
  investigating: "border-sky-400/50 bg-sky-400/10 text-sky-300 light:text-sky-700",
  need_info: "border-violet-400/50 bg-violet-400/10 text-violet-300 light:text-violet-700",
  fixed: "border-emerald-400/50 bg-emerald-400/10 text-emerald-300 light:text-emerald-700",
  released: "border-emerald-500 bg-emerald-500 text-night light:text-white",
};

const KIND_TONE: Record<CaseKind, string> = {
  preview: "border-amber-400/50 bg-amber-400/10 text-amber-300 light:text-amber-700",
  runtime: "border-rose-400/50 bg-rose-400/10 text-rose-300 light:text-rose-700",
  generation: "border-fuchsia-400/50 bg-fuchsia-400/10 text-fuchsia-300 light:text-fuchsia-700",
  other: "border-chalk/25 bg-chalk/5 text-chalk-dim",
};

export function StatusPill({ status }: { status: CaseStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 font-display text-[11px] font-semibold ${STATUS_TONE[status]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {CASE_STATUS[status].label}
    </span>
  );
}

export function KindPill({ kind }: { kind: CaseKind }) {
  return (
    <span
      className={`whitespace-nowrap rounded-full border px-2 py-0.5 font-display text-[11px] font-medium ${KIND_TONE[kind]}`}
    >
      {CASE_KIND[kind]}
    </span>
  );
}

/** A person keeps one colour across the list and the thread. */
const PERSON_TONES = [
  "bg-amber-400/20 text-amber-300 light:text-amber-700",
  "bg-violet-400/20 text-violet-300 light:text-violet-700",
  "bg-sky-400/20 text-sky-300 light:text-sky-700",
  "bg-emerald-400/20 text-emerald-300 light:text-emerald-700",
  "bg-rose-400/20 text-rose-300 light:text-rose-700",
  "bg-orange-400/20 text-orange-300 light:text-orange-700",
];

function toneOf(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  return PERSON_TONES[h % PERSON_TONES.length];
}

export function Initial({ name, team = false }: { name: string; team?: boolean }) {
  return (
    <span
      className={`grid h-8 w-8 shrink-0 place-items-center rounded-full font-display text-[13px] font-semibold ${
        team ? "bg-shine text-night" : toneOf(name)
      }`}
    >
      {(name.trim().charAt(0) || "?").toUpperCase()}
    </span>
  );
}

export const personName = (p: { name: string | null; email: string | null } | null): string =>
  p?.name || p?.email || "ไม่ทราบชื่อ";

export const when = (iso: string) =>
  new Date(iso).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" });

/** "เมื่อสักครู่", "3 ชม.ที่แล้ว", "เมื่อวาน", or the date. */
export function ago(iso: string, now: number): string {
  const min = Math.floor((now - Date.parse(iso)) / 60_000);
  if (min < 1) return "เมื่อสักครู่";
  if (min < 60) return `${min} นาทีที่แล้ว`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} ชม.ที่แล้ว`;
  if (hours < 48) return "เมื่อวาน";
  return new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short", timeZone: "Asia/Bangkok" });
}

/**
 * Pictures being attached: each uploads as soon as it is picked or pasted, so
 * sending never waits on a slow upload it could have started earlier.
 */
export function useCaseImages() {
  const [images, setImages] = useState<CaseAttachment[]>([]);
  const [uploading, setUploading] = useState(0);

  const add = useCallback(async (files: File[]) => {
    const pictures = files.filter((f) => f.type.startsWith("image/"));
    if (pictures.length === 0) return;
    setUploading((n) => n + pictures.length);
    await Promise.all(
      pictures.map(async (file) => {
        try {
          const done = await uploadCaseImage(file);
          setImages((prev) => [...prev, done]);
        } catch (e) {
          toast.error("แนบรูปไม่สำเร็จ", { description: e instanceof Error ? e.message : undefined });
        } finally {
          setUploading((n) => n - 1);
        }
      })
    );
  }, []);

  const onPaste = useCallback(
    (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData.files);
      if (files.some((f) => f.type.startsWith("image/"))) {
        e.preventDefault();
        void add(files);
      }
    },
    [add]
  );

  const remove = (path: string) => setImages((prev) => prev.filter((a) => a.path !== path));
  const clear = () => setImages([]);

  return { images, uploading, add, onPaste, remove, clear };
}

export function ImagePickButton({ onFiles, disabled }: { onFiles: (files: File[]) => void; disabled?: boolean }) {
  return (
    <label
      className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 font-display text-[12px] text-chalk-dim transition hover:bg-chalk/5 hover:text-chalk ${
        disabled ? "pointer-events-none opacity-50" : ""
      }`}
    >
      <ImagePlus size={14} /> แนบรูป
      <input
        type="file"
        accept={CASE_IMAGE_ACCEPT}
        multiple
        className="hidden"
        onChange={(e) => {
          onFiles(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
    </label>
  );
}

export function PendingImages({
  images,
  uploading,
  onRemove,
}: {
  images: CaseAttachment[];
  uploading: number;
  onRemove: (path: string) => void;
}) {
  if (images.length === 0 && uploading === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {images.map((a) => (
        <span
          key={a.path}
          className="inline-flex max-w-[14rem] items-center gap-1.5 rounded-md border border-night-edge bg-night px-2 py-1 text-[11px] text-chalk-dim"
        >
          <span className="truncate">{a.name}</span>
          <button onClick={() => onRemove(a.path)} aria-label={`เอา ${a.name} ออก`} className="hover:text-chalk">
            <X size={12} />
          </button>
        </span>
      ))}
      {uploading > 0 && (
        <span className="inline-flex items-center gap-1.5 rounded-md border border-night-edge px-2 py-1 text-[11px] text-chalk-dim">
          <Loader2 size={12} className="animate-spin" /> กำลังอัปโหลด {uploading} รูป
        </span>
      )}
    </div>
  );
}
