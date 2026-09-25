import type { ReactNode } from "react";
import { ChevronDown, Download } from "lucide-react";
import { Badge, Button, FIELD, swatchFor } from "../ui";
import type { Tone } from "../ui";
import { CHANNEL_DISCOUNT, orderState, quoteState } from "./data";
import type { OrderState, PriceKind, Quotation, QuoteState, SalesOrder } from "./data";

/**
 * ชิ้นเล็กที่ทุกไฟล์ของโมดูลขายใช้ร่วมกัน: สีของช่องทาง ป้ายสถานะ และชนิดของหน้าต่าง
 * ที่เปิดได้ — หน้าต่างทุกบานเปิดผ่านค่าเดียว (Dialog) จากหน้าจอหลัก ปุ่มในแฟ้มเอกสาร
 * จึงสั่งเปิดฟอร์มได้โดยไม่ต้องถือ state ของตัวเอง
 */

export const CHANNELS = Object.keys(CHANNEL_DISCOUNT);
export const channelSwatch = (c: string) => swatchFor(c, CHANNELS);

/** ชื่อไม่มีคำนำหน้านิติบุคคล — ใช้ทำอักษรย่อบนวงกลม */
export const shortName = (name: string) => name.replace(/^(บจก\.|หจก\.|ร้าน)\s*/, "");

/** 0.08 → "8%" · 0.075 → "7.5%" */
export const pct = (f: number) => `${Math.round(f * 1000) / 10}%`;

const ORDER_TONE: Record<OrderState, Tone> = {
  ยกเลิก: "idle",
  รออนุมัติเครดิต: "bad",
  รอยืนยัน: "warn",
  รอจัดส่ง: "info",
  ส่งบางส่วน: "accent",
  รอวางบิล: "warn",
  วางบิลแล้ว: "accent",
  เก็บเงินแล้ว: "ok",
};

export function OrderBadge({ so }: { so: SalesOrder }) {
  const s = orderState(so);
  return <Badge tone={ORDER_TONE[s]} dot>{s}</Badge>;
}

const QUOTE_TONE: Record<QuoteState, Tone> = {
  รอลูกค้าตอบ: "info",
  ได้ใบสั่งขาย: "ok",
  ยกเลิก: "idle",
  หมดอายุ: "warn",
};

export function QuoteBadge({ q }: { q: Quotation }) {
  const s = quoteState(q);
  return <Badge tone={QUOTE_TONE[s]} dot>{s}</Badge>;
}

/** เอกสารที่พิมพ์ได้ — RE ใช้เลขใบกำกับที่รับชำระ เพราะใบเสร็จอยู่กับใบกำกับ */
export type PrintKind = "SO" | "QT" | "DO" | "IV" | "CN" | "BN" | "RE";

export type Dialog =
  | { kind: "customer"; code?: string }
  | { kind: "credit"; code: string }
  | { kind: "price"; priceKind?: PriceKind; key?: string }
  | { kind: "order"; no?: string; customer?: string; quotation?: string }
  | { kind: "quote"; no?: string; customer?: string }
  | { kind: "cancel-order"; no: string }
  | { kind: "cancel-quote"; no: string }
  | { kind: "release"; no?: string }
  | { kind: "delivery"; so?: string }
  | { kind: "delivered"; no: string }
  | { kind: "invoice"; delivery?: string }
  | { kind: "payment"; no: string }
  | { kind: "cancel-payment"; no: string }
  | { kind: "credit-note"; invoice?: string }
  | { kind: "billing-note"; customer?: string }
  | { kind: "print"; doc: PrintKind; no: string };

export type Open = (d: Dialog) => void;

export function ExportButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="secondary" icon={<Download size={14} />} onClick={onClick}>
      ส่งออก Excel
    </Button>
  );
}

/** A row of record actions: the next step first, the rest after it. */
export function Actions({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2">{children}</div>;
}

/**
 * A select whose value is a code and whose options read as names — the kit's
 * Select shows the value itself, which for a customer would be "C-103".
 */
export function Choice({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  disabled?: boolean;
  error?: boolean;
}) {
  return (
    <span className="relative block">
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={
          FIELD + " w-full appearance-none pr-8 disabled:opacity-60 " + (error ? "border-rose-400 dark:border-rose-500" : "")
        }
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
    </span>
  );
}

/** A plain text/number/date input in the kit's field style, red when its Field has an error. */
export function Input({
  value,
  onChange,
  type = "text",
  placeholder,
  error,
  disabled,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  type?: "text" | "number" | "date";
  placeholder?: string;
  error?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={
        FIELD + " w-full disabled:opacity-60 " + (type === "number" ? "text-right tabular-nums " : "") +
        (error ? "border-rose-400 dark:border-rose-500 " : "") + className
      }
    />
  );
}

/** The bar at the foot of a long form, kept in reach while the lines scroll. */
export function FormFoot({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-0 -mx-5 -mb-5 mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 bg-white px-5 py-3 dark:border-slate-800 dark:bg-slate-900">
      {children}
    </div>
  );
}

/** A labelled figure inside a record — the grey tile the PA record uses. */
export function Fact({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={"rounded-xl bg-slate-50 px-3.5 py-2.5 dark:bg-slate-800/60 " + (wide ? "sm:col-span-2" : "")}>
      <dt className="text-[11.5px] text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-[13.5px] text-slate-900 dark:text-slate-50">{children}</dd>
    </div>
  );
}
