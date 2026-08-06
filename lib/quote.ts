import type { Shot } from "./shots";

/**
 * The quotation: what the screen inventory is FOR.
 *
 * The agreed model is deliberately the one a Thai software house already uses
 * on paper — size → man-day → rate → total + VAT — because the customer has to
 * recognise the arithmetic to trust it. Nothing here is clever: every number on
 * the page can be re-derived by hand from the two numbers above it.
 *
 * Everything in this file is pure. The panel edits a QuoteDoc and the printed
 * page renders one; both call the same functions, so what is quoted on screen
 * and what is signed on paper cannot drift.
 */

/** T-shirt sizing, the estimate a developer can actually give at a glance. */
export type Size = "S" | "M" | "L";

/** Default man-days per size. A starting point — every row stays editable. */
export const SIZE_DAYS: Record<Size, number> = { S: 1, M: 2.5, L: 5 };

export const SIZE_LABEL: Record<Size, string> = {
  S: "เล็ก",
  M: "กลาง",
  L: "ใหญ่",
};

/** What each size means, so two people estimating agree on what they mean. */
export const SIZE_HINT: Record<Size, string> = {
  S: "หน้าแสดงผลอย่างเดียว / modal ยืนยัน — ไม่มีตรรกะซับซ้อน",
  M: "ฟอร์ม ตาราง ค้นหา-กรอง หรือ modal ที่มีการคำนวณ",
  L: "หลายขั้นตอน เชื่อมหลายส่วน คำนวณซับซ้อน หรือมีสิทธิ์เข้ามาเกี่ยว",
};

export const DEFAULT_RATE = 8_000;
export const DEFAULT_VAT = 7;

export interface QuoteRow {
  id: string;
  name: string;
  size: Size;
  /** Man-days. Seeded from the size, then owned by whoever edits it. */
  days: number;
  /**
   * What the screen does, in the customer's words. Written by hand or by
   * "เขียนรายละเอียดด้วย AI", which reads the source — a price with the scope
   * attached is an estimate; a price alone asks for faith.
   */
  note: string;
  /** A modal of another row — printed indented, priced the same. */
  sub: boolean;
  /** The screen this modal belongs to; empty for a top-level screen. */
  parent: string;
}

export interface QuoteDoc {
  /** What the job is, on the paper's subject line. */
  subject: string;
  /** Free-text header fields — whatever the sender puts on their paper. */
  vendor: string;
  customer: string;
  quoteNo: string;
  /** ISO date (yyyy-mm-dd); the printed page formats it Thai. */
  issuedAt: string;
  validDays: number;
  rows: QuoteRow[];
  ratePerDay: number;
  /** Percent. 0 turns the VAT line off entirely. */
  vatPercent: number;
  /** Percent off the subtotal, before VAT. */
  discountPercent: number;
  /**
   * Market rate per man-day to compare against on the paper; 0 hides the
   * comparison entirely.
   *
   * A claim the SENDER makes to their customer, not one we make on their
   * behalf — so it is proposed by the advisor, accepted by hand, printed as
   * "โดยประมาณ", and editable afterwards.
   */
  marketRatePerDay: number;
  /** The sentence printed beside the comparison. */
  marketNote: string;
  terms: string;
}

export const DEFAULT_TERMS = `• ราคานี้รวมการออกแบบ พัฒนา และทดสอบตามขอบเขตหน้าจอข้างต้น
• ยังไม่รวมค่าเซิร์ฟเวอร์ โดเมน และบริการภายนอกที่มีค่าใช้จ่ายรายเดือน
• แก้ไขนอกเหนือขอบเขตคิดเพิ่มตามจริง
• เงื่อนไขชำระเงิน: มัดจำ 50% ก่อนเริ่มงาน ส่วนที่เหลือเมื่อส่งมอบ`;

/** A stable id per row — the shot path when it came from one, else a counter. */
const rowId = (seed: string, i: number) => `${i}:${seed}`;

/**
 * Seed rows from the inventory.
 *
 * A modal is priced as its own line, not folded into its screen: it is a
 * screen someone has to build, and hiding it under a parent is precisely how a
 * quotation ends up short. It is marked `sub` so the paper still shows which
 * screen it belongs to.
 *
 * Sizes are a guess, and the panel says so — a modal defaults small, a screen
 * medium. Nobody should send this without reading it.
 */
export function rowsFromShots(shots: Shot[]): QuoteRow[] {
  return shots
    .slice()
    .sort((a, b) => a.index - b.index)
    .map((s, i) => ({
      id: rowId(s.path, i),
      // The bare name, not "parent — child": the parent is its own column so
      // the table can group and the paper can indent, and a customer reading a
      // line item wants the modal's name, not a breadcrumb.
      name: s.name,
      size: s.parent ? ("S" as Size) : ("M" as Size),
      days: s.parent ? SIZE_DAYS.S : SIZE_DAYS.M,
      note: "",
      sub: Boolean(s.parent),
      parent: s.parent ?? "",
    }));
}

/** Identity of a line item: a modal's name is only unique under its screen. */
const rowKey = (r: { name: string; parent: string }) => `${r.parent}\u0000${r.name}`;

/** Rows in the inventory that the quotation does not price yet. */
export function missingRows(doc: QuoteDoc, shots: Shot[]): QuoteRow[] {
  const have = new Set(doc.rows.map(rowKey));
  return rowsFromShots(shots).filter((r) => !have.has(rowKey(r)));
}

/** Counts for the panel, so "did it take the modals?" is answerable at a glance. */
export function rowCounts(doc: QuoteDoc): { screens: number; modals: number } {
  const modals = doc.rows.filter((r) => r.sub).length;
  return { screens: doc.rows.length - modals, modals };
}

export function newDoc(shots: Shot[], projectName: string, today: string): QuoteDoc {
  return {
    subject: projectName ? `พัฒนาระบบ ${projectName}` : "พัฒนาระบบตามขอบเขตหน้าจอ",
    vendor: "",
    customer: "",
    quoteNo: `Q-${today.replace(/-/g, "")}`,
    issuedAt: today,
    validDays: 30,
    rows: rowsFromShots(shots),
    ratePerDay: DEFAULT_RATE,
    vatPercent: DEFAULT_VAT,
    discountPercent: 0,
    marketRatePerDay: 0,
    marketNote: "",
    terms: DEFAULT_TERMS,
  };
}

/**
 * Parse a stored payload back into a document.
 *
 * The row shape has already changed once during this feature's life, and the
 * table is jsonb — so what comes back is untrusted input, not a QuoteDoc. A
 * missing `rows` array would crash the panel on open; a missing rate would
 * quietly price the whole job at zero. Anything unrecognisable returns null and
 * the caller seeds a fresh document rather than rendering a broken one.
 */
export function parseDoc(payload: unknown, fallbackDate: string): QuoteDoc | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const o = payload as Record<string, unknown>;
  if (!Array.isArray(o.rows)) return null;
  const str = (v: unknown, d = "") => (typeof v === "string" ? v : d);
  const n = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
  const rows: QuoteRow[] = o.rows.map((raw, i) => {
    const r = (raw ?? {}) as Record<string, unknown>;
    const size: Size = r.size === "S" || r.size === "L" ? r.size : "M";
    return {
      id: str(r.id) || rowId("row", i),
      name: str(r.name),
      size,
      days: n(r.days, SIZE_DAYS[size]),
      note: str(r.note),
      sub: r.sub === true,
      parent: str(r.parent),
    };
  });
  return {
    subject: str(o.subject),
    vendor: str(o.vendor),
    customer: str(o.customer),
    quoteNo: str(o.quoteNo),
    issuedAt: str(o.issuedAt) || fallbackDate,
    validDays: n(o.validDays, 30),
    rows,
    ratePerDay: n(o.ratePerDay, DEFAULT_RATE),
    vatPercent: n(o.vatPercent, DEFAULT_VAT),
    discountPercent: n(o.discountPercent, 0),
    marketRatePerDay: n(o.marketRatePerDay, 0),
    marketNote: str(o.marketNote),
    terms: str(o.terms, DEFAULT_TERMS),
  };
}

export function emptyRow(index: number): QuoteRow {
  return {
    id: rowId("custom", index),
    name: "",
    size: "M",
    days: SIZE_DAYS.M,
    note: "",
    sub: false,
    parent: "",
  };
}

/**
 * A half-typed cell ("2." parses to NaN) must not turn the grand total into
 * NaN — the customer's number is the last thing allowed to break while
 * someone is still editing. Sanitising here means every caller inherits it.
 */
const num = (n: number) => (Number.isFinite(n) ? n : 0);

export const lineTotal = (row: QuoteRow, ratePerDay: number): number =>
  num(row.days) * num(ratePerDay);

export interface QuoteTotals {
  days: number;
  subtotal: number;
  discount: number;
  net: number;
  vat: number;
  grand: number;
}

/**
 * Money is rounded once, at each printed line — never accumulated at full
 * float precision and rounded at the end, because then the printed lines do not
 * add up to the printed total and the customer is right to ask why.
 */
export function quoteTotals(doc: QuoteDoc): QuoteTotals {
  const days = round2(doc.rows.reduce((sum, r) => sum + num(r.days), 0));
  const subtotal = round2(
    doc.rows.reduce((sum, r) => sum + round2(lineTotal(r, doc.ratePerDay)), 0)
  );
  const discount = round2((subtotal * clampPercent(doc.discountPercent)) / 100);
  const net = round2(subtotal - discount);
  const vat = round2((net * clampPercent(doc.vatPercent)) / 100);
  return { days, subtotal, discount, net, vat, grand: round2(net + vat) };
}

/**
 * What the same scope would cost at the market rate, and what the customer
 * saves. Derived, never stored: rows change after the advisor runs, and a
 * frozen "market total" would quietly stop matching the lines above it.
 *
 * Returns null when there is nothing honest to show — no market rate set, or
 * the quoted price is not actually below it.
 */
export function marketComparison(
  doc: QuoteDoc
): { market: number; quoted: number; saved: number; percent: number } | null {
  const rate = num(doc.marketRatePerDay);
  if (rate <= 0) return null;
  const { days, net } = quoteTotals(doc);
  const market = round2(days * rate);
  const saved = round2(market - net);
  if (saved <= 0) return null;
  return { market, quoted: net, saved, percent: Math.round((saved / market) * 100) };
}

const clampPercent = (n: number) => Math.min(100, Math.max(0, num(n)));
const round2 = (n: number) => Math.round(n * 100) / 100;

/** ฿ with thousands separators and no decimals unless there are satang. */
export function formatTHB(n: number): string {
  const hasSatang = Math.round(n * 100) % 100 !== 0;
  return n.toLocaleString("th-TH", {
    minimumFractionDigits: hasSatang ? 2 : 0,
    maximumFractionDigits: 2,
  });
}

/** yyyy-mm-dd → "5 สิงหาคม 2569" (Buddhist era, as a Thai quotation is dated). */
export function thaiDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const months = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
  ];
  return `${d} ${months[m - 1]} ${y + 543}`;
}

/** issuedAt + validDays, as an ISO date. */
export function validUntil(doc: QuoteDoc): string {
  const d = new Date(`${doc.issuedAt}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return doc.issuedAt;
  d.setUTCDate(d.getUTCDate() + Math.max(0, doc.validDays));
  return d.toISOString().slice(0, 10);
}
