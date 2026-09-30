import type { ReactNode } from "react";
import { CircleCheck, CircleDashed, CircleX } from "lucide-react";
import { COMPANY, STAFF, TODAY } from "./data";
import type { Standard } from "./data";
import { Badge, Button, FIELD, Note } from "../ui";
import type { Tone } from "../ui";
import { notify } from "../kit";

/**
 * ชิ้นส่วนหน้าจอที่ระบบมาตรฐานทุกตัวใช้ร่วมกัน — ฟอร์ม หัวแฟ้ม และกระดาษเอกสารควบคุม
 * อยู่ที่ระบบบริหารบูรณาการเพราะทุกระบบมาตรฐานต้องมีระบบนี้อยู่แล้ว
 */

/* ------------------------------------------------------------------ tone */

/** สถานะเดียวกันสีเดียวกันทุกหน้าจอของทุกมาตรฐาน */
const TONES: Record<string, Tone> = {
  "ร่าง": "idle", "รออนุมัติ": "warn", "ใช้งาน": "ok", "ยกเลิก": "bad",
  "รอตรวจ": "idle", "รอตัดสิน": "warn", "ผ่าน": "ok", "ไม่ผ่าน": "bad", "ยอมรับแบบมีเงื่อนไข": "warn",
  "รอสั่งการ": "bad", "ดำเนินการ": "warn", "ปิดแล้ว": "ok",
  "วิเคราะห์สาเหตุ": "bad", "ติดตามผล": "info",
  "ตามแผน": "idle", "กำลังตรวจ": "info", "ประชุมแล้ว": "ok", "บันทึกผลแล้ว": "ok",
  "ปกติ": "ok", "ใกล้ครบ": "warn", "เกินกำหนด": "bad", "พักใช้": "bad",
  "รุนแรง": "bad", "ปานกลาง": "warn", "เล็กน้อย": "idle",
  "สูง": "bad", "กลาง": "warn", "ต่ำ": "ok",
  "อนุมัติ": "ok", "อนุมัติแบบมีเงื่อนไข": "warn", "ระงับ": "bad", "รอประเมิน": "idle",
  "รับได้": "ok", "รับได้แบบมีเงื่อนไข": "warn", "รับไม่ได้": "bad",
  "ได้รับการรับรอง": "ok", "กำลังขอรับรอง": "info",
};

export const tone = (s: string): Tone => TONES[s] ?? "idle";

/** ไอคอนของขั้นตอนที่ทุกระบบมาตรฐานใช้วาดลำดับงาน — ออกแบบ 8D APQP */
export const STEP_ICONS = {
  done: <CircleCheck size={15} />,
  current: <CircleDashed size={15} className="animate-[spin_3s_linear_infinite]" />,
  todo: <CircleDashed size={15} />,
  failed: <CircleX size={15} />,
};

/** ทะเบียนเรียงตามเลขที่ล่าสุดก่อน — ลำดับในอาร์เรย์คือลำดับที่บันทึก ไม่ใช่ลำดับเลขที่ */
export const newest = <T extends { no: string }>(xs: T[]) => [...xs].sort((a, b) => b.no.localeCompare(a.no));

const STD_TONE: Record<Standard, Tone> = { "ISO 9001": "accent", "ISO 14001": "ok", "IATF 16949": "info" };

export function StdBadges({ standards }: { standards: readonly Standard[] }) {
  return (
    <span className="flex flex-wrap gap-1">
      {standards.map((s) => (
        <Badge key={s} tone={STD_TONE[s]}>{s.replace("ISO ", "").replace("IATF 16949", "IATF")}</Badge>
      ))}
    </span>
  );
}

/* ----------------------------------------------------------------- forms */

const bad = (error?: string) => (error ? " border-rose-400 dark:border-rose-500" : "");

export function Input({ value, onChange, error, type = "text", placeholder }: { value: string; onChange: (v: string) => void; error?: string; type?: string; placeholder?: string }) {
  return <input type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={FIELD + " w-full tabular-nums" + bad(error)} />;
}

export function Area({ value, onChange, error, placeholder, rows = 3 }: { value: string; onChange: (v: string) => void; error?: string; placeholder?: string; rows?: number }) {
  return <textarea value={value} rows={rows} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={FIELD + " w-full resize-none" + bad(error)} />;
}

export function Choice({ value, onChange, options, error, placeholder }: { value: string; onChange: (v: string) => void; options: readonly (string | { value: string; label: string })[]; error?: string; placeholder?: string }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={FIELD + " w-full" + bad(error)}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => {
        const opt = typeof o === "string" ? { value: o, label: o } : o;
        return <option key={opt.value} value={opt.value}>{opt.label}</option>;
      })}
    </select>
  );
}

/** เลือกได้หลายข้อ — มาตรฐาน ผู้เข้าร่วม ข้อกำหนด */
export function Checks<T extends string>({ options, value, onChange, columns = 2 }: { options: readonly (T | { value: T; label: string })[]; value: T[]; onChange: (v: T[]) => void; columns?: 1 | 2 | 3 }) {
  const cols = columns === 1 ? "" : columns === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2";
  return (
    <div className={"grid gap-1.5 " + cols}>
      {options.map((o) => {
        const opt = typeof o === "string" ? { value: o, label: o } : o;
        const on = value.includes(opt.value);
        return (
          <label key={opt.value} className="flex items-center gap-2 text-[12.5px] text-slate-700 dark:text-slate-200">
            <input type="checkbox" checked={on} onChange={() => onChange(on ? value.filter((x) => x !== opt.value) : [...value, opt.value])} className="size-4 accent-violet-600" />
            {opt.label}
          </label>
        );
      })}
    </div>
  );
}

export function Actions({ onCancel, label, disabled }: { onCancel: () => void; label: string; disabled?: boolean }) {
  return (
    <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
      <Button variant="secondary" onClick={onCancel}>ยกเลิก</Button>
      <Button type="submit" disabled={disabled}>{label}</Button>
    </div>
  );
}

/** ฟอร์มที่ส่งแล้วเรียกฟังก์ชันของ data.ts — ข้อผิดพลาดจากกฎธุรกิจขึ้นใต้ฟอร์ม ไม่ใช่หน้าจอพัง */
export function Form({ children, onSubmit, error }: { children: ReactNode; onSubmit: () => void; error?: string }) {
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      {children}
      {error && <Note tone="bad">{error}</Note>}
    </form>
  );
}

export const people = (filter?: (p: (typeof STAFF)[number]) => boolean) =>
  STAFF.filter(filter ?? (() => true)).map((p) => ({ value: p.name, label: `${p.name} · ${p.role}` }));

export const tryRun = (fn: () => void, setError: (e: string) => void) => {
  try {
    fn();
  } catch (e) {
    setError(e instanceof Error ? e.message : String(e));
  }
};

/** ปุ่มที่เรียกฟังก์ชันตรง ๆ ไม่มีฟอร์ม — สำเร็จแจ้งผล ไม่สำเร็จแจ้งเหตุผล */
export const run = (fn: () => void, ok: string) => {
  try {
    fn();
    notify(ok);
  } catch (e) {
    notify(e instanceof Error ? e.message : String(e), "bad");
  }
};

/* --------------------------------------------------------------- records */

export function Header({ title, meta, badges, actions }: { title: string; meta: string; badges: ReactNode; actions: ReactNode }) {
  return (
    <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
      <p className="text-[17px] font-semibold text-slate-900 dark:text-slate-50">{title}</p>
      <p className="mt-0.5 text-[12.5px] text-slate-500 dark:text-slate-400">{meta}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">{badges}</div>
      <div className="mt-3 flex flex-wrap gap-2">{actions}</div>
    </div>
  );
}

export function Body({ children }: { children: ReactNode }) {
  return <div className="space-y-5 overflow-y-auto px-5 py-4">{children}</div>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="px-4 py-6 text-center text-[13px] text-slate-400">{children}</p>;
}

/** รายการในการ์ด: ซ้ายคือเรื่อง ขวาคือสถานะหรือปุ่ม */
export function Line({ title, sub, right, subTone }: { title: ReactNode; sub?: ReactNode; right?: ReactNode; subTone?: "bad" }) {
  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-[13px]">
      <span className="min-w-0 flex-1">
        <span className="block text-slate-800 dark:text-slate-100">{title}</span>
        {sub && <span className={"block text-[11.5px] " + (subTone === "bad" ? "text-rose-600 dark:text-rose-400" : "text-slate-400")}>{sub}</span>}
      </span>
      {right}
    </li>
  );
}

export function Lines({ children }: { children: ReactNode }) {
  return <ul className="divide-y divide-slate-100 dark:divide-slate-800">{children}</ul>;
}

/* ----------------------------------------------------------------- paper */

export function PaperHead({ title, form, number }: { title: string; form: string; number?: string }) {
  return (
    <div className="flex items-start justify-between gap-6 border-b-2 border-slate-800 pb-3">
      <div>
        <p className="text-[15px] font-bold text-slate-900">{COMPANY.name}</p>
        <p className="max-w-sm leading-relaxed text-slate-600">{COMPANY.address}</p>
      </div>
      <div className="text-right">
        <p className="text-[16px] font-bold text-slate-900">{title}</p>
        {number && <p className="mt-0.5 font-semibold tabular-nums text-slate-900">{number}</p>}
        <p className="mt-1 text-[10.5px] text-slate-500">{form}</p>
      </div>
    </div>
  );
}

export function Facts({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="mt-4 grid grid-cols-[auto_1fr_auto_1fr] gap-x-4 gap-y-1.5 rounded-md border border-slate-300 p-3">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-slate-500">{k}</dt>
          <dd className="text-slate-900">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function PaperTable({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <table className="mt-4 w-full border-collapse">
      <thead>
        <tr className="bg-slate-100 text-[11.5px] text-slate-600">
          {head.map((h) => (
            <th key={h} className="border border-slate-300 px-2 py-1.5 text-left font-medium">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && (
          <tr>
            <td colSpan={head.length} className="border border-slate-300 px-2 py-3 text-center text-slate-400">ไม่มีรายการ</td>
          </tr>
        )}
        {rows.map((r, i) => (
          <tr key={i}>
            {r.map((c, j) => (
              <td key={j} className="border border-slate-300 px-2 py-1.5 align-top">{c}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-4">
      <p className="font-semibold text-slate-900">{title}</p>
      <div className="mt-1 rounded-md border border-slate-300 p-3 leading-relaxed text-slate-700">{children}</div>
    </div>
  );
}

export function Signatures({ names }: { names: [string, string?][] }) {
  return (
    <div className="mt-10 grid gap-8" style={{ gridTemplateColumns: `repeat(${names.length}, minmax(0, 1fr))` }}>
      {names.map(([role, name]) => (
        <div key={role} className="text-center">
          <div className="mx-auto h-9 w-40 border-b border-dotted border-slate-500" />
          <p className="mt-1.5 text-slate-700">{name ? `( ${name} )` : "(............................)"}</p>
          <p className="text-slate-500">{role}</p>
        </div>
      ))}
    </div>
  );
}

export function Foot({ system }: { system: string }) {
  return (
    <p className="mt-8 border-t border-slate-200 pt-2 text-[10.5px] text-slate-400">
      เอกสารควบคุมตาม{system} · พิมพ์จากระบบเมื่อ {TODAY}
    </p>
  );
}
