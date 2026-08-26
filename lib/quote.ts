import type { Shot } from "./shots";
import type { OrgBrand } from "./types";

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

/** Days to pay after an instalment falls due, unless someone changes it. */
export const PAY_NET_DAYS = 30;
/** Days the customer gets to test and raise defects before UAT is deemed accepted. */
export const REVIEW_DAYS = 30;

/** The floor under maintenance: below this a month of support does not pay for itself. */
export const MA_MIN_MONTHLY = 15_000;
/** Year-2-onward maintenance, once the first year's warranty runs out. */
export const MA_DEFAULT_ANNUAL = 90_000;
/** Months of maintenance already paid for inside the project price. */
export const MA_INCLUDED_MONTHS = 12;

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

/**
 * One instalment: what has to happen for it to fall due, and what share of the
 * total it is.
 *
 * Percent is the stored number and the amount is derived — never the other way
 * round. The scope changes right up to the day the quotation is sent, and a
 * stored baht figure would quietly stop matching the lines above it.
 */
export interface PaymentTerm {
  id: string;
  /** What makes this instalment due, in the customer's words. */
  when: string;
  /** Share of the grand total. The schedule is only valid summing to 100. */
  percent: number;
  /** Days to pay once it falls due. */
  netDays: number;
}

/**
 * The acceptance deal, as fields rather than prose.
 *
 * These four numbers are the entire input to the printed clauses — which is the
 * point: a customer who does not test for `reviewDays` is agreeing to something,
 * and what they are agreeing to must be derived from the same figures printed in
 * the payment table, not typed a second time beside it.
 */
export interface Acceptance {
  enabled: boolean;
  /** Days to test and raise defects, counted from the delivery notice. */
  reviewDays: number;
  /** Silence past the window counts as acceptance. */
  deemedAccepted: boolean;
  /** Where the work is handed over — named in the clause. */
  channel: string;
  /**
   * Clauses the sender rewrote by hand, keyed by their position in the
   * generated list.
   *
   * An override is a deliberate break from the rule that every number on the
   * paper is computed: the generated sentence recalculates when the payment
   * table changes, an overridden one does not. It exists because real deals
   * carry conditions no formula knows — a named acceptor, a site visit, a
   * customer's own wording — and the alternative was people retyping the whole
   * block into the free-text terms, where it agreed with nothing.
   *
   * Keyed by index so an untouched clause keeps following the numbers, and so
   * "reset this one" stays possible.
   */
  overrides?: Record<string, string>;
  /** Extra clauses appended after the generated ones, in order. */
  extra?: string[];
  /**
   * Generated clauses the sender removed entirely, by their index in the
   * generated list. A removed clause is neither printed nor edited — distinct
   * from an override (which replaces the wording) and from a reset (which
   * resumes tracking the numbers). Kept by index so it survives the payment
   * table changing, and so "restore this one" stays possible.
   */
  excluded?: number[];
}

/** Maintenance: quoted with the build, billed separately, never inside `grand`. */
export interface Maintenance {
  enabled: boolean;
  modules: number;
  /** ฿ per module per month. Clamped up to MA_MIN_MONTHLY when it prints. */
  perModuleMonthly: number;
  /** Months already covered by the project price (the warranty). */
  includedMonths: number;
  /** The annual fee from year 2 on. */
  annualFromYear2: number;
  note: string;
}

/**
 * The letterhead — the quoting company's own identity.
 *
 * Copied INTO the document rather than joined from the workspace at render
 * time: a quotation already sent to a customer must not change its letterhead
 * because someone uploaded a new logo afterwards. The panel has a button to
 * pull the current one in again.
 */
export interface QuoteBrand {
  logoUrl: string;
  name: string;
  taxId: string;
  address: string;
  contact: string;
  /** Printed under the name in the page footer, e.g. "Upgrade Your Business". */
  tagline: string;
  /**
   * The one colour on the paper — rules, labels, the footer mark.
   *
   * A brand field rather than a constant because the whole point of the partner
   * programme is that this is not our document. Hex only; it is written straight
   * into an inline style on the printed page.
   */
  accent: string;
  /** Partner workspaces print their own paper; everyone else carries our mark. */
  poweredBy: boolean;
}

/** Amber. Reads on paper, survives a black-and-white printer as a mid grey. */
export const DEFAULT_ACCENT = "#f59e0b";
/** Anything else could be injected into the printed page's inline style. */
const HEX = /^#[0-9a-fA-F]{6}$/;
export const safeAccent = (v: string): string => (HEX.test(v) ? v : DEFAULT_ACCENT);

/**
 * Quote the whole job as one line at one agreed figure.
 *
 * Some customers do not want to see the scope priced screen by screen. Not
 * because the breakdown is wrong, but because a per-item price invites a
 * per-item negotiation — and because the number was usually agreed as a round
 * one ("สามแสน") long before anyone counted man-days. Printing 27 lines that add
 * up to 312,400 makes the sender look like they reverse-engineered the figure,
 * which is exactly what happened, and exactly what should not show.
 *
 * The rows are still there and still edited — they are what the scope text is
 * built from. Only the arithmetic is replaced.
 */
export interface LumpSum {
  enabled: boolean;
  /** The agreed figure, BEFORE VAT — VAT is computed from it as usual. */
  amount: number;
  /** The single line's heading, e.g. "PHITHANLIFE VENDOR CENTER". */
  title: string;
}

export const emptyLumpSum = (): LumpSum => ({ enabled: false, amount: 0, title: "" });

/**
 * The scope, as the one paragraph that sits under the single line.
 *
 * Numbered in the order the rows are in, one blank line between entries, each
 * row's own description kept verbatim underneath its heading — the shape of the
 * document this replaces. Modals are indented under the screen they belong to
 * rather than getting a number of their own, because they are not systems.
 */
export function lumpSumScope(doc: QuoteDoc): string {
  // A single top-level system IS the description, not "item 1 of a list". The
  // leading "1." then reads as noise — and collides with the table's own row
  // number "1" — so number only when there are several systems to tell apart.
  const topCount = doc.rows.filter((r) => !r.sub).length;
  const out: string[] = [];
  let n = 0;
  for (const r of doc.rows) {
    const name = r.name.trim() || "—";
    if (r.sub) {
      out.push(`    · ${name}${r.note.trim() ? `\n      ${r.note.trim()}` : ""}`);
      continue;
    }
    n += 1;
    const prefix = topCount > 1 ? `${n}. ` : "";
    out.push(`${prefix}${name}${r.note.trim() ? `\n${r.note.trim()}` : ""}`);
  }
  return out.join("\n\n");
}

/** How many top-level systems the scope lists — the "11 ระบบ" on the paper. */
export function lumpSumSystemCount(doc: QuoteDoc): number {
  return doc.rows.filter((r) => !r.sub).length;
}

export interface QuoteDoc {
  /** What the job is, on the paper's subject line. */
  subject: string;
  /**
   * Who the customer is, as four labelled lines — เรียน / ชื่อ / ที่อยู่ / โทร.
   *
   * Split rather than one textarea because a Thai quotation's recipient block is
   * read as a form: the accounts department looks for "ชื่อ" to check the legal
   * entity and "ที่อยู่" to check the tax address. A free-text blob puts the
   * burden of that layout on whoever is typing at 6pm.
   */
  customerAttn: string;
  customerName: string;
  customerAddress: string;
  customerPhone: string;
  /** The person sending it — printed under "นำเสนอโดย". */
  presentedBy: string;
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
  /** How the total is paid. Empty means the paper prints no schedule at all. */
  payment: PaymentTerm[];
  acceptance: Acceptance;
  ma: Maintenance;
  brand: QuoteBrand;
  /** Print one line at one agreed figure instead of pricing row by row. */
  lumpSum: LumpSum;
  terms: string;
}

// Payment now has its own table and its own generated clauses, so the free-text
// block is what is left: scope, exclusions, and anything the sender wants to add.
export const DEFAULT_TERMS = `• ราคานี้รวมการออกแบบ พัฒนา และทดสอบตามขอบเขตหน้าจอข้างต้น
• ยังไม่รวมค่าเซิร์ฟเวอร์ โดเมน และบริการภายนอกที่มีค่าใช้จ่ายรายเดือน
• แก้ไขนอกเหนือขอบเขตคิดเพิ่มตามจริง`;

/** The deal as agreed with FITT Code Runner: 60 on UAT delivery, 40 on acceptance. */
export function presetUat(): PaymentTerm[] {
  return [
    {
      id: "pay-uat",
      when: "เมื่อส่งมอบระบบขึ้น UAT ให้ผู้ว่าจ้างตรวจรับ",
      percent: 60,
      netDays: PAY_NET_DAYS,
    },
    {
      id: "pay-accept",
      when: "เมื่อตรวจรับงานเรียบร้อย หรือครบกำหนดตรวจรับโดยไม่มีข้อทักท้วง",
      percent: 40,
      netDays: PAY_NET_DAYS,
    },
  ];
}

/** The other common shape: money on signature, the balance on delivery. */
export function presetSigning(): PaymentTerm[] {
  return [
    { id: "pay-sign", when: "เมื่อลงนามในสัญญา", percent: 60, netDays: 7 },
    { id: "pay-deliver", when: "เมื่อส่งมอบงานครบตามขอบเขต", percent: 40, netDays: PAY_NET_DAYS },
  ];
}

/**
 * n equal instalments.
 *
 * Each share is rounded DOWN to two decimals and the remainder lands on the last
 * one, so the column still sums to exactly 100% — twelve rows of 8.33 add up to
 * 99.96, and a schedule that does not reach 100 is a schedule that under-bills.
 */
export function presetEqual(count: number): PaymentTerm[] {
  const n = Math.max(1, Math.floor(num(count)));
  const each = Math.floor(10_000 / n) / 100;
  return Array.from({ length: n }, (_, i) => ({
    id: `pay-${i + 1}`,
    when: i === 0 ? "งวดแรก — เมื่อลงนามในสัญญา" : `งวดที่ ${i + 1}`,
    percent: i === n - 1 ? round2(100 - each * (n - 1)) : each,
    netDays: PAY_NET_DAYS,
  }));
}

export function emptyTerm(index: number): PaymentTerm {
  return { id: `pay-${index + 1}-${index}`, when: "", percent: 0, netDays: PAY_NET_DAYS };
}

/** Keep only string→string pairs; anything else in the jsonb is not an override. */
function parseOverrides(raw: unknown): Record<string, string> | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "string" && v.trim()) out[k] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

export function defaultAcceptance(): Acceptance {
  return {
    enabled: true,
    reviewDays: REVIEW_DAYS,
    deemedAccepted: true,
    channel: "สภาพแวดล้อมทดสอบ (UAT) ผ่าน FITT Code Runner",
  };
}

export function defaultMaintenance(): Maintenance {
  return {
    enabled: false,
    modules: 1,
    perModuleMonthly: MA_MIN_MONTHLY,
    includedMonths: MA_INCLUDED_MONTHS,
    annualFromYear2: MA_DEFAULT_ANNUAL,
    note: "",
  };
}

/**
 * Copy a workspace's company identity into a document's letterhead.
 *
 * `poweredBy` is derived from the workspace's partner status and is never typed
 * by whoever is editing — white-label is granted to the company, not chosen per
 * quotation. The one function both the seeding path and the "ดึงจาก workspace"
 * button call, so those two can never disagree about what a pull means.
 */
export function brandFromOrg(brand: OrgBrand, isPartner: boolean): QuoteBrand {
  return {
    logoUrl: brand.logoUrl ?? "",
    name: brand.name ?? "",
    taxId: brand.taxId ?? "",
    address: brand.address ?? "",
    contact: brand.contact ?? "",
    tagline: brand.tagline ?? "",
    accent: safeAccent(brand.accent ?? ""),
    poweredBy: !isPartner,
  };
}

/** A letterhead nobody has filled in yet — and therefore one that carries our mark. */
export function emptyBrand(): QuoteBrand {
  return {
    logoUrl: "",
    name: "",
    taxId: "",
    address: "",
    contact: "",
    tagline: "",
    accent: DEFAULT_ACCENT,
    poweredBy: true,
  };
}

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
    customerAttn: "",
    customerName: "",
    customerAddress: "",
    customerPhone: "",
    presentedBy: "",
    quoteNo: `Q-${today.replace(/-/g, "")}`,
    issuedAt: today,
    validDays: 30,
    rows: rowsFromShots(shots),
    ratePerDay: DEFAULT_RATE,
    vatPercent: DEFAULT_VAT,
    discountPercent: 0,
    marketRatePerDay: 0,
    marketNote: "",
    payment: presetUat(),
    acceptance: defaultAcceptance(),
    ma: defaultMaintenance(),
    brand: emptyBrand(),
    lumpSum: emptyLumpSum(),
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
  const bool = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
  const obj = (v: unknown): Record<string, unknown> =>
    v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
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
  // Every quotation written before this feature existed has none of the four
  // blocks below. They are backfilled with working defaults rather than
  // rejected: a stored document is somebody's priced work, and losing it to a
  // schema change is the one outcome worse than showing them a default.
  const acc = obj(o.acceptance);
  const ma = obj(o.ma);
  const brand = obj(o.brand);
  const lump = obj(o.lumpSum);
  const fallbackMa = defaultMaintenance();
  // Documents written before the letterhead existed kept both parties as one
  // free-text blob each. Neither is dropped: the vendor blob's first line is a
  // company name and the rest is an address often enough to be the right guess,
  // and a wrong guess is a field someone retypes — a dropped one is a document
  // that silently lost who it was addressed to.
  const [legacyName = "", ...legacyRest] = str(o.vendor)
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    subject: str(o.subject),
    customerAttn: str(o.customerAttn),
    customerName: str(o.customerName) || str(o.customer),
    customerAddress: str(o.customerAddress),
    customerPhone: str(o.customerPhone),
    presentedBy: str(o.presentedBy),
    quoteNo: str(o.quoteNo),
    issuedAt: str(o.issuedAt) || fallbackDate,
    validDays: n(o.validDays, 30),
    rows,
    ratePerDay: n(o.ratePerDay, DEFAULT_RATE),
    vatPercent: n(o.vatPercent, DEFAULT_VAT),
    discountPercent: n(o.discountPercent, 0),
    marketRatePerDay: n(o.marketRatePerDay, 0),
    marketNote: str(o.marketNote),
    // An empty array is a real state — someone deleted every instalment — so
    // only a MISSING schedule gets seeded with the default one.
    payment: Array.isArray(o.payment)
      ? o.payment.map((raw, i) => {
          const t = obj(raw);
          return {
            id: str(t.id) || `pay-${i + 1}`,
            when: str(t.when),
            percent: n(t.percent, 0),
            netDays: n(t.netDays, PAY_NET_DAYS),
          };
        })
      : presetUat(),
    acceptance: {
      enabled: bool(acc.enabled, true),
      reviewDays: n(acc.reviewDays, REVIEW_DAYS),
      deemedAccepted: bool(acc.deemedAccepted, true),
      channel: str(acc.channel) || defaultAcceptance().channel,
      // Older documents predate both fields; absent is the same as "none
      // overridden", never a reason to reject the document.
      overrides: parseOverrides(acc.overrides),
      extra: Array.isArray(acc.extra)
        ? acc.extra.map((x) => str(x)).filter(Boolean)
        : undefined,
      excluded: Array.isArray(acc.excluded)
        ? acc.excluded.map((x) => Number(x)).filter((x) => Number.isInteger(x) && x >= 0)
        : undefined,
    },
    ma: {
      enabled: bool(ma.enabled, false),
      modules: n(ma.modules, fallbackMa.modules),
      perModuleMonthly: n(ma.perModuleMonthly, fallbackMa.perModuleMonthly),
      includedMonths: n(ma.includedMonths, fallbackMa.includedMonths),
      annualFromYear2: n(ma.annualFromYear2, fallbackMa.annualFromYear2),
      note: str(ma.note),
    },
    brand: {
      logoUrl: str(brand.logoUrl),
      name: str(brand.name) || legacyName,
      taxId: str(brand.taxId),
      address: str(brand.address) || legacyRest.join("\n"),
      contact: str(brand.contact),
      tagline: str(brand.tagline),
      accent: safeAccent(str(brand.accent)),
      // Defaults to ON: a document whose brand block predates the partner flag
      // must not silently print as white-label.
      poweredBy: bool(brand.poweredBy, true),
    },
    // Off for every document written before this existed — a quotation that was
    // priced row by row must keep printing that way when it is reopened.
    lumpSum: {
      enabled: bool(lump.enabled, false),
      amount: n(lump.amount, 0),
      title: str(lump.title),
    },
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
  // A lump sum REPLACES the arithmetic, it does not adjust it: the agreed figure
  // is the subtotal, and discount and VAT run from there exactly as they would
  // otherwise. Man-days stay counted because the market comparison and the MA
  // sizing still read them.
  const subtotal = doc.lumpSum.enabled
    ? round2(num(doc.lumpSum.amount))
    : round2(doc.rows.reduce((sum, r) => sum + round2(lineTotal(r, doc.ratePerDay)), 0));
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

export interface PaymentLine {
  term: PaymentTerm;
  amount: number;
}

export interface PaymentPlan {
  rows: PaymentLine[];
  /** What the shares actually add up to — 100 when the schedule is complete. */
  percentSum: number;
  balanced: boolean;
}

/**
 * The instalment table: each share turned into money.
 *
 * The remainder left by rounding lands on the last instalment, so the column
 * adds up to the grand total exactly — the same discipline `quoteTotals` uses
 * on the line items, for the same reason.
 *
 * It does that ONLY when the shares sum to 100. When they do not, the gap is
 * real, and folding it into the last row would hide a schedule that bills less
 * (or more) than the price agreed above it. The panel warns instead.
 */
export function paymentSchedule(doc: QuoteDoc): PaymentPlan {
  const { grand } = quoteTotals(doc);
  const percentSum = round2(doc.payment.reduce((sum, t) => sum + num(t.percent), 0));
  const balanced = percentSum === 100;
  const rows: PaymentLine[] = doc.payment.map((term) => ({
    term,
    amount: round2((grand * num(term.percent)) / 100),
  }));
  if (balanced && rows.length > 0) {
    const printed = round2(rows.reduce((sum, r) => sum + r.amount, 0));
    const last = rows[rows.length - 1];
    rows[rows.length - 1] = { ...last, amount: round2(last.amount + (grand - printed)) };
  }
  return { rows, percentSum, balanced };
}

export interface MaintenanceTotals {
  /** Modules billed, after the "at least one" floor. */
  modules: number;
  /** Per module per month, after the floor is applied — the printed rate. */
  perModule: number;
  /** Per month across every module. */
  monthly: number;
  /** Whole months included, after flooring — the number the paper prints. */
  includedMonths: number;
  /** What the included months are worth — the warranty, priced. */
  includedValue: number;
  /** The year-2-onward annual fee. */
  annual: number;
  /** The entered rate was below the floor and was raised. The panel says so. */
  clamped: boolean;
}

/**
 * Maintenance, with the per-module floor applied here and nowhere else.
 *
 * A rate typed below MA_MIN_MONTHLY is raised rather than rejected, because the
 * floor is a commercial rule and the person quoting should see the corrected
 * number, not a blocked form. `clamped` is how the panel tells them it happened
 * — the alternative is a paper that quietly disagrees with the screen.
 */
export function maintenanceTotals(ma: Maintenance): MaintenanceTotals {
  const entered = num(ma.perModuleMonthly);
  const modules = Math.max(1, Math.floor(num(ma.modules)));
  const perModule = Math.max(MA_MIN_MONTHLY, entered);
  const monthly = round2(perModule * modules);
  // Whole months only, and never negative: the figure is printed beside the
  // money it is worth, so "12.7 เดือนแรก" priced at twelve months' worth would
  // be an inconsistency a customer can spot on the page.
  const includedMonths = Math.max(0, Math.floor(num(ma.includedMonths)));
  return {
    modules,
    perModule,
    monthly,
    includedMonths,
    includedValue: round2(monthly * includedMonths),
    annual: round2(num(ma.annualFromYear2)),
    clamped: entered < MA_MIN_MONTHLY,
  };
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

/** yyyy-mm-dd → "13/08/2569" — the compact form a header block wants. */
export function thaiDateShort(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d)}/${pad(m)}/${y + 543}`;
}

/** issuedAt + validDays, as an ISO date. */
export function validUntil(doc: QuoteDoc): string {
  const d = new Date(`${doc.issuedAt}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return doc.issuedAt;
  d.setUTCDate(d.getUTCDate() + Math.max(0, doc.validDays));
  return d.toISOString().slice(0, 10);
}
