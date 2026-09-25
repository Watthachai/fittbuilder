import { VENDORS, INVOICES as PURCHASE_INVOICES, TODAY, vendor } from "../mm/data";
import {
  CUSTOMERS, BILLINGS, CREDIT_NOTES, VOIDED_RECEIPTS, amountDue, customer, invoice as salesInvoice, invoiceLines,
} from "../sd/data";
import type { Billing, Receipt as SalesReceipt } from "../sd/data";
import { material } from "../mm/data";
import { commit } from "../kit";
import { COMPANY } from "../company";

export const PERIOD = { label: "งวดเดือนกันยายน 2569", from: "2026-09-01", to: "2026-09-30" };
export const VAT_RATE = 0.07;
export { TODAY };

/** ปีบัญชีแบบพุทธศักราช — "2569" — ใช้ขึ้นต้นเลขเอกสารทุกชุด */
const BE = String(Number(PERIOD.to.slice(0, 4)) + 543);

export { COMPANY };

/* ------------------------------------------------------------- numbers */

/** ปัดเป็นสตางค์ — ทุกยอดที่ลงบัญชีผ่านตรงนี้ เดบิตกับเครดิตจึงเทียบกันได้ตรง ๆ */
const round2 = (n: number) => Math.round(n * 100) / 100;
const sumOf = (ns: number[]) => round2(ns.reduce((n, x) => n + x, 0));

/* --------------------------------------------------------------- dates */

const THAI_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

/** "2026-09" -> "ก.ย. 2569" */
export const thaiMonth = (key: string) => `${THAI_MONTHS[Number(key.slice(5, 7)) - 1]} ${Number(key.slice(0, 4)) + 543}`;
/** "2026-09-22" -> "22 ก.ย. 2569" — วันที่ตามที่พิมพ์ลงเอกสาร */
export const thaiDate = (iso: string) => `${Number(iso.slice(8, 10))} ${thaiMonth(iso.slice(0, 7))}`;

const monthKey = (iso: string) => iso.slice(0, 7);
/** "2026-09" -> "2026-09-30" */
const monthEnd = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
};
const nextMonth = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
};
const isIsoDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(s).getTime());

const addDays = (iso: string, n: number) => {
  const d = new Date(iso);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};
const daysBetween = (a: string, b: string) =>
  Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
/** "เครดิต 30 วัน" -> 30 · "เงินสด" -> 0 */
const termDays = (terms: string) => Number(terms.match(/\d+/)?.[0] ?? 0);

/** เลขถัดไปของเอกสารชุดหนึ่ง ต่อจากเลขสูงสุดที่ออกไปแล้ว */
function nextNo(prefix: string, taken: string[], width: number) {
  const used = taken.filter((no) => no.startsWith(prefix)).map((no) => Number(no.slice(prefix.length)));
  return prefix + String(Math.max(0, ...used.filter(Number.isFinite)) + 1).padStart(width, "0");
}

/* ---------------------------------------------------------- chart of accounts */

export const ACCOUNT_TYPES = ["สินทรัพย์", "หนี้สิน", "ส่วนของเจ้าของ", "รายได้", "ค่าใช้จ่าย"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];
export type Account = { code: string; name: string; type: AccountType };

/** หมวดของบัญชีอ่านจากเลขตัวแรกของรหัส ผังบัญชีทุกเล่มในไทยเรียงแบบนี้ */
export const TYPE_DIGIT: Record<AccountType, string> = {
  สินทรัพย์: "1",
  หนี้สิน: "2",
  ส่วนของเจ้าของ: "3",
  รายได้: "4",
  ค่าใช้จ่าย: "5",
};

/** ผังบัญชี — 1 สินทรัพย์ · 2 หนี้สิน · 3 ส่วนของเจ้าของ · 4 รายได้ · 5 ค่าใช้จ่าย */
export const ACCOUNTS: Account[] = [
  { code: "1010", name: "เงินสดและเงินฝากธนาคาร", type: "สินทรัพย์" },
  { code: "1110", name: "ลูกหนี้การค้า", type: "สินทรัพย์" },
  { code: "1120", name: "ภาษีซื้อ", type: "สินทรัพย์" },
  { code: "1130", name: "ภาษีเงินได้ถูกหัก ณ ที่จ่าย", type: "สินทรัพย์" },
  { code: "1210", name: "สินค้าคงเหลือ", type: "สินทรัพย์" },
  { code: "1310", name: "ที่ดิน อาคารและอุปกรณ์", type: "สินทรัพย์" },
  { code: "1319", name: "ค่าเสื่อมราคาสะสม", type: "สินทรัพย์" },
  { code: "2010", name: "เจ้าหนี้การค้า", type: "หนี้สิน" },
  { code: "2110", name: "ภาษีขายค้างนำส่ง", type: "หนี้สิน" },
  { code: "2120", name: "ภาษีเงินได้หัก ณ ที่จ่ายค้างนำส่ง", type: "หนี้สิน" },
  { code: "2130", name: "ค่าใช้จ่ายค้างจ่าย", type: "หนี้สิน" },
  { code: "2210", name: "ภาษีและประกันสังคมค้างนำส่ง", type: "หนี้สิน" },
  { code: "3010", name: "ทุนจดทะเบียน", type: "ส่วนของเจ้าของ" },
  { code: "3110", name: "กำไรสะสม", type: "ส่วนของเจ้าของ" },
  { code: "4010", name: "รายได้จากการขาย", type: "รายได้" },
  { code: "4020", name: "รับคืนและส่วนลดจ่าย", type: "รายได้" },
  { code: "4110", name: "กำไรจากการจำหน่ายสินทรัพย์", type: "รายได้" },
  { code: "5010", name: "ต้นทุนขาย", type: "ค่าใช้จ่าย" },
  { code: "5110", name: "เงินเดือนและสวัสดิการ", type: "ค่าใช้จ่าย" },
  { code: "5210", name: "ค่าเสื่อมราคา", type: "ค่าใช้จ่าย" },
  { code: "5310", name: "ค่าใช้จ่ายในการขายและบริหาร", type: "ค่าใช้จ่าย" },
  { code: "5410", name: "ขาดทุนจากการจำหน่ายสินทรัพย์", type: "ค่าใช้จ่าย" },
];

export const account = (code: string) => {
  const a = ACCOUNTS.find((x) => x.code === code);
  if (!a) throw new Error(`ไม่มีบัญชี ${code} ในผังบัญชี`);
  return a;
};

/** รหัสที่ว่างถัดไปในหมวด — เว้นทีละสิบ ให้แทรกบัญชีย่อยได้ภายหลัง */
export function nextAccountCode(type: AccountType) {
  const digit = TYPE_DIGIT[type];
  const used = ACCOUNTS.filter((a) => a.code.startsWith(digit)).map((a) => Number(a.code));
  const next = used.length ? Math.floor(Math.max(...used) / 10) * 10 + 10 : Number(digit + "010");
  return String(next);
}

export function addAccount(input: Account): Account {
  const code = input.code.trim();
  const name = input.name.trim();
  if (!/^\d{4}$/.test(code)) throw new Error("รหัสบัญชีต้องเป็นตัวเลขสี่หลัก");
  if (!code.startsWith(TYPE_DIGIT[input.type])) throw new Error(`บัญชีหมวด${input.type}ต้องขึ้นต้นด้วยเลข ${TYPE_DIGIT[input.type]}`);
  if (ACCOUNTS.some((a) => a.code === code)) throw new Error(`รหัส ${code} มีอยู่แล้วในผังบัญชี`);
  if (name.length < 2) throw new Error("ต้องมีชื่อบัญชี");
  const created: Account = { code, name, type: input.type };
  return commit(() => {
    // เรียงตามรหัสเสมอ งบทดลองจึงออกมาเป็นลำดับหมวดเหมือนผังบัญชีบนกระดาษ
    const at = ACCOUNTS.findIndex((a) => a.code > code);
    ACCOUNTS.splice(at === -1 ? ACCOUNTS.length : at, 0, created);
    return created;
  });
}

/** รหัสและหมวดผูกกับรายการที่ลงไปแล้ว เปลี่ยนได้แค่ชื่อ */
export function renameAccount(code: string, name: string) {
  const a = account(code);
  if (name.trim().length < 2) throw new Error("ต้องมีชื่อบัญชี");
  commit(() => {
    a.name = name.trim();
  });
}

/* ------------------------------------------------------------ fixed assets */

export type Asset = {
  code: string;
  name: string;
  cost: number;
  lifeYears: number;
  acquired: string;
  /** ราคาซาก — มูลค่าที่คาดว่าจะเหลือเมื่อหมดอายุ ไม่ถูกตัดเป็นค่าเสื่อม */
  salvage: number;
  /** ใบสำคัญที่ลงทะเบียนสินทรัพย์นี้ ไม่มีคือยกมาพร้อมยอดต้นงวด */
  jv?: string;
};

export const ASSETS: Asset[] = [
  { code: "FA-001", name: "เครื่องตัดเหล็ก CNC", cost: 1800000, lifeYears: 10, acquired: "2023-03-15", salvage: 0 },
  { code: "FA-002", name: "รถโฟล์คลิฟท์ 2.5 ตัน", cost: 850000, lifeYears: 8, acquired: "2024-06-01", salvage: 0 },
  { code: "FA-003", name: "ระบบพ่นสีอัตโนมัติ", cost: 420000, lifeYears: 5, acquired: "2025-01-10", salvage: 0 },
  { code: "FA-004", name: "คอมพิวเตอร์สำนักงาน", cost: 130000, lifeYears: 3, acquired: "2025-08-20", salvage: 0 },
];

/** ค่าเสื่อมราคาวิธีเส้นตรงต่อเดือน ปัดเป็นบาท: (ราคาทุน − ราคาซาก) ÷ อายุ ÷ 12 */
export const monthlyDepreciation = (a: Asset) => Math.round((a.cost - a.salvage) / a.lifeYears / 12);

/** ยอดค่าเสื่อมของสินทรัพย์ที่ยกมาพร้อมยอดต้นงวด ตัดไว้ถึงสิ้นเดือนสิงหาคม */
const BROUGHT_FORWARD_TO = "2026-08-31";

/** เดือนที่ถือครองมาจนถึงวันหนึ่ง — เริ่มนับค่าเสื่อมเดือนถัดจากเดือนที่ได้มา */
export function monthsHeld(a: Asset, asOf: string = depreciatedThrough()) {
  const d = new Date(a.acquired);
  const end = new Date(asOf);
  return Math.max(0, (end.getFullYear() - d.getFullYear()) * 12 + (end.getMonth() - d.getMonth()));
}

const accumulatedAt = (a: Asset, asOf: string) =>
  Math.min(a.cost - a.salvage, monthlyDepreciation(a) * monthsHeld(a, asOf));

/** ค่าเสื่อมสะสมที่ยกมาพร้อมยอดต้นงวด — สินทรัพย์ที่ลงทะเบียนในระบบนี้เริ่มจากศูนย์ */
const broughtForward = (a: Asset) => (a.jv ? 0 : accumulatedAt(a, BROUGHT_FORWARD_TO));

export type DepreciationRun = {
  /** "2026-09" */
  period: string;
  date: string;
  jv: string;
  lines: { asset: string; amount: number }[];
};

/** การตัดค่าเสื่อมที่ลงบัญชีแล้ว งวดละหนึ่งใบสำคัญ */
export const DEPRECIATION_RUNS: DepreciationRun[] = [
  {
    period: "2026-09",
    date: "2026-09-30",
    jv: "JV-6941",
    lines: ASSETS.map((a) => ({ asset: a.code, amount: monthlyDepreciation(a) })),
  },
];

export type Disposal = {
  asset: string;
  date: string;
  /** ราคาขายก่อนภาษี ศูนย์คือตัดจำหน่ายโดยไม่มีรายรับ */
  price: number;
  vat: number;
  accumulated: number;
  bookValue: number;
  /** บวกคือกำไร ลบคือขาดทุน */
  gain: number;
  buyer?: string;
  reason: string;
  jv: string;
};

export const DISPOSALS: Disposal[] = [];

/* ------------------------------------------------------------ journal */

/** สมุดรายวันแยกตามลักษณะรายการ แบบที่โปรแกรมบัญชีไทยใช้กัน */
export type JournalBook = "ทั่วไป" | "ขาย" | "ซื้อ" | "รับเงิน" | "จ่ายเงิน";
export const JOURNAL_BOOKS: JournalBook[] = ["ทั่วไป", "ขาย", "ซื้อ", "รับเงิน", "จ่ายเงิน"];

/**
 * สมุดรายวัน. ทุกรายการต้องลงตัว — เดบิตเป็นบวก เครดิตเป็นลบ รวมกันได้ศูนย์
 * รายการขายและซื้อสร้างจากเอกสารต้นทางจริง ไม่ได้พิมพ์ตัวเลขซ้ำลงมาที่นี่
 */
export type JournalLine = { account: string; amount: number; note?: string };
export type JournalEntry = {
  no: string;
  date: string;
  memo: string;
  ref?: string;
  lines: JournalLine[];
  /** ไม่ระบุคือสมุดรายวันทั่วไป */
  book?: JournalBook;
  /** ไม่ระบุคือผ่านรายการแล้ว — รายการตั้งต้นทั้งหมดลงบัญชีไปแล้ว */
  status?: "ร่าง" | "ผ่านรายการแล้ว";
  /** รายการที่บัญชีอ่านมาจากระบบอื่น แก้หรือยกเลิกต้องทำที่ต้นทาง */
  origin?: "ระบบขาย" | "ระบบจัดซื้อ";
  /** ใบสำคัญที่กลับรายการนี้ */
  reversedBy?: string;
  /** ใบสำคัญที่รายการนี้กลับ */
  reverses?: string;
  reason?: string;
};

export type EntryStatus = "ร่าง" | "ผ่านรายการแล้ว" | "กลับรายการแล้ว" | "รายการกลับ";

export const isPosted = (e: JournalEntry) => e.status !== "ร่าง";
export function statusOf(e: JournalEntry): EntryStatus {
  if (e.status === "ร่าง") return "ร่าง";
  if (e.reversedBy) return "กลับรายการแล้ว";
  if (e.reverses) return "รายการกลับ";
  return "ผ่านรายการแล้ว";
}

export const baht = (n: number) => n.toLocaleString("th-TH", { maximumFractionDigits: 0 }) + " ฿";
/** ยอดถึงสตางค์ — ใช้กับยอดชำระ ยอดหัก ณ ที่จ่าย และบรรทัดในใบสำคัญ */
export const satang = (n: number) =>
  n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ฿";

export const entryTotal = (e: JournalEntry) => sumOf(e.lines.filter((l) => l.amount > 0).map((l) => l.amount));
export const entryDifference = (e: { lines: JournalLine[] }) => sumOf(e.lines.map((l) => l.amount));
export const isBalanced = (e: { lines: JournalLine[] }) => Math.abs(entryDifference(e)) < 0.005;

/* ------------------------------------------------------ withholding tax */

/** อัตราหัก ณ ที่จ่ายตามคำสั่งกรมสรรพากรที่ออกตามมาตรา 3 เตรส */
export const WHT_RATES = [
  { rate: 0, label: "ไม่หัก ณ ที่จ่าย", income: "" },
  { rate: 0.01, label: "1% ค่าขนส่ง", income: "ค่าขนส่ง" },
  { rate: 0.02, label: "2% ค่าโฆษณา", income: "ค่าโฆษณา" },
  { rate: 0.03, label: "3% ค่าบริการ / ค่าจ้างทำของ", income: "ค่าบริการ / ค่าจ้างทำของ" },
  { rate: 0.05, label: "5% ค่าเช่า", income: "ค่าเช่าทรัพย์สิน" },
] as const;

export function whtType(rate: number) {
  const t = WHT_RATES.find((w) => w.rate === rate);
  if (!t) throw new Error(`ไม่มีอัตราหัก ณ ที่จ่าย ${rate * 100}%`);
  return t;
}

/** นิติบุคคลยื่น ภ.ง.ด.53 บุคคลธรรมดายื่น ภ.ง.ด.3 — เลขผู้เสียภาษีนิติบุคคลขึ้นต้นด้วย 0 */
export const whtForm = (taxId: string) => (taxId.startsWith("0") ? "ภ.ง.ด.53" : "ภ.ง.ด.3");

/**
 * ภาษีหัก ณ ที่จ่ายของยอดที่ชำระครั้งหนึ่ง.
 * ฐานภาษีคือส่วนก่อนภาษีมูลค่าเพิ่มของยอดที่ตัดหนี้ ชำระบางส่วนก็หักตามสัดส่วนที่ชำระ
 */
export function withholding(settle: number, doc: { base: number; amount: number }, rate: number) {
  const base = round2((settle * doc.base) / doc.amount);
  const wht = round2(base * rate);
  return { base, wht, net: round2(settle - wht) };
}

export type PayMethod = "โอนเงิน" | "เช็ค" | "เงินสด";
export const PAY_METHODS: PayMethod[] = ["โอนเงิน", "เช็ค", "เงินสด"];

/* ----------------------------------------------------- payables records */

/** ใบแจ้งหนี้ค่าบริการและค่าใช้จ่ายที่บัญชีตั้งหนี้เอง ของที่ซื้อผ่านใบสั่งซื้ออยู่ในแฟ้มจัดซื้อ */
export type ServiceBill = {
  no: string;
  date: string;
  vendor: string;
  /** เลขที่ใบแจ้งหนี้ของผู้ขาย */
  vendorInvoice: string;
  description: string;
  account: string;
  base: number;
  vat: number;
  whtRate: number;
};

export const SERVICE_BILLS: ServiceBill[] = [
  {
    no: `AP-${BE}-0001`, date: "2026-09-10", vendor: "V-003", vendorInvoice: "IS-6909-0215",
    description: "ค่าจ้างพ่นสีชิ้นงานภายนอก ล็อตชั้นวางเหล็ก", account: "1210", base: 36000, vat: 2520, whtRate: 0.03,
  },
  {
    no: `AP-${BE}-0002`, date: "2026-09-20", vendor: "V-001", vendorInvoice: "TR-2569/0918",
    description: "ค่าขนส่งเหล็กแผ่นจากคลังผู้ขาย", account: "1210", base: 6500, vat: 455, whtRate: 0.01,
  },
];

export type Payment = {
  no: string;
  date: string;
  /** เลขที่ใบแจ้งหนี้ที่ตัดหนี้ */
  invoice: string;
  vendor: string;
  /** ยอดหนี้ที่ตัดครั้งนี้ รวมภาษีมูลค่าเพิ่ม */
  settle: number;
  whtRate: number;
  whtBase: number;
  wht: number;
  /** ยอดที่จ่ายออกจริง = ยอดตัดหนี้ − ภาษีหัก ณ ที่จ่าย */
  net: number;
  method: PayMethod;
  bankRef?: string;
};

const serviceGross = (b: ServiceBill) => round2(b.base + b.vat);

type PurchaseInvoice = (typeof PURCHASE_INVOICES)[number];
const purchaseVat = (iv: PurchaseInvoice) => Math.round(iv.amount * VAT_RATE);
const purchaseGross = (iv: PurchaseInvoice) => iv.amount + purchaseVat(iv);
const purchaseInvoice = (no: string) => {
  const iv = PURCHASE_INVOICES.find((x) => x.no === no);
  if (!iv) throw new Error(`ไม่พบใบแจ้งหนี้ ${no} ในแฟ้มจัดซื้อ`);
  return iv;
};

/** ตัวเลขภาษีของรายการตั้งต้นคิดด้วยกฎเดียวกับที่หน้าจอใช้ ไม่ได้พิมพ์ลงไปเอง */
const withTax = <T extends { settle: number; whtRate: number }>(doc: T, of: { base: number; amount: number }) => {
  const w = withholding(doc.settle, of, doc.whtRate);
  return { ...doc, whtBase: w.base, wht: w.wht, net: w.net };
};

export const PAYMENTS: Payment[] = [
  withTax(
    {
      no: `PV-${BE}-0001`, date: "2026-09-18", invoice: `AP-${BE}-0001`, vendor: "V-003",
      settle: 38520, whtRate: 0.03, method: "โอนเงิน" as PayMethod, bankRef: "KBANK 180969-0412",
    },
    { base: SERVICE_BILLS[0].base, amount: serviceGross(SERVICE_BILLS[0]) }
  ),
  withTax(
    {
      no: `PV-${BE}-0002`, date: "2026-09-21", invoice: "INV-88214", vendor: "V-001",
      settle: 40000, whtRate: 0, method: "เช็ค" as PayMethod, bankRef: "เช็คเลขที่ 0012457",
    },
    { base: purchaseInvoice("INV-88214").amount, amount: purchaseGross(purchaseInvoice("INV-88214")) }
  ),
];

/* ------------------------------------------------ postings of FI documents */

function billEntry(b: ServiceBill): JournalEntry {
  return {
    no: b.no, date: b.date, book: "ซื้อ", ref: b.vendorInvoice,
    memo: "ตั้งหนี้ค่าบริการ " + b.vendorInvoice + " — " + vendor(b.vendor).name,
    lines: [
      { account: b.account, amount: b.base, note: b.description },
      ...(b.vat > 0 ? [{ account: "1120", amount: b.vat, note: "ภาษีซื้อ 7%" }] : []),
      { account: "2010", amount: -serviceGross(b) },
    ],
  };
}

function paymentEntry(p: Payment): JournalEntry {
  return {
    no: p.no, date: p.date, book: "จ่ายเงิน", ref: p.invoice,
    memo: "จ่ายชำระหนี้ " + p.invoice + " — " + vendor(p.vendor).name,
    lines: [
      { account: "2010", amount: p.settle },
      { account: "1010", amount: -p.net, note: p.method + (p.bankRef ? " " + p.bankRef : "") },
      ...(p.wht > 0 ? [{ account: "2120", amount: -p.wht, note: `หัก ณ ที่จ่าย ${p.whtRate * 100}%` }] : []),
    ],
  };
}

const openingAssets = ASSETS.filter((a) => !a.jv);
const assetCost = openingAssets.reduce((n, a) => n + a.cost, 0);
const accumBroughtForward = openingAssets.reduce((n, a) => n + broughtForward(a), 0);
const firstRunTotal = DEPRECIATION_RUNS[0].lines.reduce((n, l) => n + l.amount, 0);

/** ใบสำคัญยอดยกมา ต้นทางของยอดคงเหลือทุกบัญชี กลับรายการไม่ได้ */
export const OPENING_NO = "JV-6900";

/**
 * ใบสำคัญที่บัญชีเป็นเจ้าของ: ยอดยกมา รายการที่คีย์เอง และรายการที่เอกสารของบัญชี
 * (ใบตั้งหนี้ ใบสำคัญจ่าย ใบเสร็จ สินทรัพย์ ค่าเสื่อม) ลงไว้ตอนบันทึก
 * รายการขายและซื้ออ่านสดจากระบบขายและจัดซื้อ — ดู ledger()
 */
export const JOURNAL: JournalEntry[] = [
  {
    no: OPENING_NO, date: "2026-01-01", memo: "ยอดยกมาต้นงวดบัญชี",
    lines: [
      { account: "1010", amount: 2000000 },
      { account: "1210", amount: 1500000 },
      { account: "1310", amount: assetCost },
      { account: "1319", amount: -accumBroughtForward },
      { account: "3010", amount: -5000000 },
      { account: "3110", amount: -(2000000 + 1500000 + assetCost - accumBroughtForward - 5000000) },
    ],
  },
  ...SERVICE_BILLS.map(billEntry),
  ...PAYMENTS.map(paymentEntry),
  {
    no: "JV-6940", date: "2026-09-25", memo: "ตั้งค่าใช้จ่ายเงินเดือนประจำงวด",
    lines: [
      { account: "5110", amount: 260000 },
      { account: "1010", amount: -240000 },
      { account: "2210", amount: -20000 },
    ],
  },
  {
    no: "JV-6941", date: "2026-09-30", memo: "ค่าเสื่อมราคาประจำงวด",
    lines: [
      { account: "5210", amount: firstRunTotal },
      { account: "1319", amount: -firstRunTotal },
    ],
  },
  {
    no: "JV-6942", date: "2026-09-30", memo: "ค่าเช่า ค่าสาธารณูปโภคและค่าใช้จ่ายสำนักงาน",
    lines: [
      { account: "5310", amount: 148000 },
      { account: "1010", amount: -148000 },
    ],
  },
  {
    no: "JV-6943", date: "2026-09-30", memo: "ตั้งค่าไฟฟ้าโรงงานค้างจ่ายเดือนกันยายน", status: "ร่าง",
    lines: [
      { account: "5310", amount: 18500, note: "ค่าไฟฟ้าโรงงาน ก.ย. 2569 ตามมิเตอร์" },
      { account: "2130", amount: -18500, note: "จ่ายจริงเมื่อได้รับใบแจ้งหนี้เดือนหน้า" },
    ],
  },
];

/* ----------------------------------------- postings read from other modules */

/** ต้นทุนของสินค้าในเอกสารขาย คิดจากราคามาตรฐานในแฟ้มวัสดุ */
const costOf = (lines: { material: string; qty: number }[]) =>
  lines.reduce((n, l) => n + l.qty * material(l.material).price, 0);

const isReversed = (no: string) => Boolean(JOURNAL.find((e) => e.no === no)?.reversedBy);
const activePayments = () => PAYMENTS.filter((p) => !isReversed(p.no));
const activeBills = () => SERVICE_BILLS.filter((b) => !isReversed(b.no));
const paidAgainst = (invoice: string) => sumOf(activePayments().filter((p) => p.invoice === invoice).map((p) => p.settle));

/** จ่ายก่อนหรือตรงวันครบกำหนด แต่ไม่ก่อนวันที่ของเอกสาร */
const settledOn = (date: string, due: string) => {
  const d = due < TODAY ? due : TODAY;
  return d < date ? date : d;
};

/** ใบเสร็จหนึ่งใบ: เงินเข้าเท่าที่ได้รับ ภาษีที่ลูกค้าหักไว้เป็นเครดิตภาษี ตัดลูกหนี้เต็มยอด */
function receiptPosting(inv: Billing, r: SalesReceipt): JournalEntry {
  return {
    no: "RV-" + r.no.replace(/^RE-/, ""), date: r.date, book: "รับเงิน", origin: "ระบบขาย", ref: inv.no,
    memo: "รับชำระหนี้ " + inv.no + " ใบเสร็จ " + r.no + " — " + customer(inv.customer).name,
    lines: [
      { account: "1010", amount: r.amount, note: r.method + (r.ref ? " " + r.ref : "") },
      ...(r.wht > 0 ? [{ account: "1130", amount: r.wht, note: "ลูกค้าหัก ณ ที่จ่าย" }] : []),
      { account: "1110", amount: -round2(r.amount + r.wht) },
    ],
  };
}

/**
 * รายการที่เกิดจากเอกสารของระบบขายและจัดซื้อ อ่านใหม่ทุกครั้ง ใบสั่งขายหรือ
 * ใบแจ้งหนี้ที่อีกฝ่ายเพิ่งบันทึกจึงเข้าบัญชีทันทีโดยไม่มีใครคีย์ซ้ำ
 */
function sourcePostings(): JournalEntry[] {
  // รายได้รับรู้ตามใบกำกับภาษีที่ฝ่ายขายออก ณ วันที่ในใบ ใบสั่งขายที่ยังไม่ออกใบกำกับไม่ลงอะไร
  const sales = BILLINGS.map((inv): JournalEntry => {
    const cost = costOf(invoiceLines(inv));
    return {
      no: "SJ-" + inv.no.replace(/^IV-/, ""), date: inv.date, book: "ขาย", origin: "ระบบขาย", ref: inv.no,
      memo: "ขายเชื่อ " + inv.no + " (" + inv.so + ") — " + customer(inv.customer).name,
      lines: [
        { account: "1110", amount: inv.gross },
        { account: "4010", amount: -inv.net },
        { account: "2110", amount: -inv.vat, note: "ภาษีขาย 7%" },
        { account: "5010", amount: cost, note: "ต้นทุนสินค้าที่ส่งมอบ" },
        { account: "1210", amount: -cost },
      ],
    };
  });

  // ใบลดหนี้กลับรายได้และภาษีขาย ของที่รับคืนกลับเข้าคลังที่ราคาทุน
  const returns = CREDIT_NOTES.map((cn): JournalEntry => {
    const cost = cn.kind === "รับคืนสินค้า" ? costOf(cn.lines) : 0;
    return {
      no: "SR-" + cn.no.replace(/^CN-/, ""), date: cn.date, book: "ขาย", origin: "ระบบขาย", ref: cn.no,
      memo: "ลดหนี้ " + cn.no + " อ้าง " + cn.invoice + " — " + cn.reason,
      lines: [
        { account: "4020", amount: cn.net, note: cn.kind },
        { account: "2110", amount: cn.vat, note: "ลดภาษีขาย 7%" },
        { account: "1110", amount: -cn.gross },
        ...(cost > 0 ? [{ account: "1210", amount: cost, note: "สินค้ารับคืน" }, { account: "5010", amount: -cost }] : []),
      ],
    };
  });

  const purchases = PURCHASE_INVOICES.map((iv): JournalEntry => ({
    no: "PJ-" + iv.no.replace(/^INV-/, ""), date: iv.date, book: "ซื้อ", origin: "ระบบจัดซื้อ", ref: iv.no,
    memo: "ตั้งหนี้ซื้อ " + iv.no + " — " + vendor(iv.vendor).name,
    lines: [
      { account: "1210", amount: iv.amount },
      { account: "1120", amount: purchaseVat(iv), note: "ภาษีซื้อ 7%" },
      { account: "2010", amount: -purchaseGross(iv) },
    ],
  }));

  // ใบที่ฝ่ายจัดซื้อบันทึกว่าจ่ายแล้วโดยไม่ผ่านใบสำคัญจ่ายของบัญชี — จ่ายก่อนเริ่มใช้ระบบ
  const paidOutside = PURCHASE_INVOICES.filter((iv) => iv.paid).flatMap((iv): JournalEntry[] => {
    const rest = round2(purchaseGross(iv) - paidAgainst(iv.no));
    if (rest <= 0) return [];
    const v = vendor(iv.vendor);
    return [{
      no: "PV-" + iv.no.replace(/^INV-/, ""), date: settledOn(iv.date, addDays(iv.date, termDays(v.terms))),
      book: "จ่ายเงิน", origin: "ระบบจัดซื้อ", ref: iv.no,
      memo: "จ่ายชำระหนี้ " + iv.no + " — " + v.name,
      lines: [
        { account: "2010", amount: rest },
        { account: "1010", amount: -rest },
      ],
    }];
  });

  // ใบเสร็จของฝ่ายขาย — ที่เดียวที่บันทึกการรับชำระ ยกเลิกแล้วลงรายการกลับไว้ให้ตรวจย้อน
  const receipts = BILLINGS.flatMap((inv) => (inv.receipt ? [receiptPosting(inv, inv.receipt)] : []));
  const voided = VOIDED_RECEIPTS.flatMap((v): JournalEntry[] => {
    const original = receiptPosting(salesInvoice(v.invoice), v);
    const cancel: JournalEntry = {
      no: "VR-" + v.no.replace(/^RE-/, ""), date: v.voidedOn > v.date ? v.voidedOn : v.date, book: "รับเงิน",
      origin: "ระบบขาย", ref: original.no, reverses: original.no, reason: v.reason,
      memo: "ยกเลิกใบเสร็จ " + v.no + " — " + v.reason,
      lines: original.lines.map((l) => ({ ...l, amount: -l.amount })),
    };
    return [{ ...original, reversedBy: cancel.no }, cancel];
  });

  return [...sales, ...returns, ...purchases, ...paidOutside, ...receipts, ...voided];
}

/** สมุดรายวันทั้งเล่ม — รายการจากเอกสารต้นทางและรายการของบัญชี เรียงตามวันที่ */
export function ledger(): JournalEntry[] {
  return [...sourcePostings(), ...JOURNAL].sort((a, b) => a.date.localeCompare(b.date) || a.no.localeCompare(b.no));
}

export function entryByNo(no: string): JournalEntry {
  const e = ledger().find((x) => x.no === no);
  if (!e) throw new Error(`ไม่พบใบสำคัญ ${no}`);
  return e;
}

/* ----------------------------------------------------------- balances */

export type Range = { from?: string; to?: string };
const inRange = (date: string, r?: Range) => (!r?.from || date >= r.from) && (!r?.to || date <= r.to);

/** ยอดคงเหลือทุกบัญชีจากรายการที่ผ่านแล้ว — เดบิตเป็นบวก เครดิตเป็นลบ */
export function trialBalance(range?: Range) {
  const sums = new Map<string, number>();
  for (const e of ledger()) {
    if (!isPosted(e) || !inRange(e.date, range)) continue;
    for (const l of e.lines) sums.set(l.account, (sums.get(l.account) ?? 0) + l.amount);
  }
  return ACCOUNTS.map((a) => ({ ...a, balance: round2(sums.get(a.code) ?? 0) }));
}

export const balanceOf = (code: string, range?: Range) =>
  trialBalance(range).find((a) => a.code === code)?.balance ?? 0;

/** บัญชีแยกประเภท: ทุกรายการที่ผ่านแล้วของบัญชีหนึ่ง พร้อมยอดสะสม */
export function accountLedger(code: string) {
  let running = 0;
  return ledger()
    .filter((e) => isPosted(e) && e.lines.some((l) => l.account === code))
    .map((e) => {
      const amount = sumOf(e.lines.filter((l) => l.account === code).map((l) => l.amount));
      running = round2(running + amount);
      return { entry: e, amount, running };
    });
}

/** งบกำไรขาดทุน — รายได้เป็นเครดิตจึงติดลบ กลับเครื่องหมายตอนแสดง */
export function profitAndLoss(range?: Range) {
  const tb = trialBalance(range);
  const revenues = tb.filter((a) => a.type === "รายได้");
  const revenue = -sumOf(revenues.map((a) => a.balance));
  const expenses = tb.filter((a) => a.type === "ค่าใช้จ่าย");
  const expenseTotal = sumOf(expenses.map((a) => a.balance));
  return { revenue, revenues, expenses, expenseTotal, profit: round2(revenue - expenseTotal) };
}

/** งบแสดงฐานะการเงิน ณ วันหนึ่ง ไม่ระบุคือรวมทุกรายการที่ผ่านแล้ว */
export function balanceSheet(asOf?: string) {
  const range = asOf ? { to: asOf } : undefined;
  const tb = trialBalance(range);
  const assets = tb.filter((a) => a.type === "สินทรัพย์");
  const liabilities = tb.filter((a) => a.type === "หนี้สิน");
  const equity = tb.filter((a) => a.type === "ส่วนของเจ้าของ");
  const assetTotal = sumOf(assets.map((a) => a.balance));
  const liabilityTotal = -sumOf(liabilities.map((a) => a.balance));
  const equityTotal = -sumOf(equity.map((a) => a.balance));
  const { profit } = profitAndLoss(range);
  return {
    assets, liabilities, equity, assetTotal, liabilityTotal, equityTotal, profit,
    balances: Math.abs(assetTotal - (liabilityTotal + equityTotal + profit)) < 0.005,
  };
}

export type StatementPeriod = { key: string; label: string; from?: string; to?: string };

/** งวดที่เลือกดูงบได้: ตั้งแต่ต้นปี และทุกเดือนที่มีรายการผ่านแล้ว ใหม่สุดก่อน */
export function statementPeriods(): StatementPeriod[] {
  const months = [...new Set(ledger().filter((e) => isPosted(e) && e.no !== OPENING_NO).map((e) => monthKey(e.date)))]
    .sort()
    .reverse();
  return [
    { key: "ytd", label: `ตั้งแต่ต้นปีบัญชี ${BE}` },
    ...months.map((m) => ({ key: m, label: `เดือน ${thaiMonth(m)}`, from: m + "-01", to: monthEnd(m) })),
  ];
}

/* ------------------------------------------------------- journal entries */

export type JournalInput = { date: string; memo: string; ref?: string; lines: JournalLine[] };

export const nextJournalNo = () => nextNo("JV-" + BE.slice(2), JOURNAL.map((e) => e.no), 2);

function checkJournal(input: JournalInput, post: boolean) {
  if (!isIsoDate(input.date)) throw new Error("ต้องระบุวันที่ของใบสำคัญ");
  if (input.date < "2026-01-01") throw new Error("วันที่อยู่ก่อนยอดยกมาต้นงวดบัญชี");
  if (input.memo.trim().length < 3) throw new Error("ต้องมีคำอธิบายรายการ");
  if (input.lines.length < 2) throw new Error("ใบสำคัญต้องมีอย่างน้อยสองบรรทัด");
  for (const l of input.lines) {
    account(l.account);
    if (!Number.isFinite(l.amount) || l.amount === 0) throw new Error(`บรรทัดบัญชี ${l.account} ต้องมีจำนวนเงิน`);
  }
  if (!input.lines.some((l) => l.amount > 0) || !input.lines.some((l) => l.amount < 0)) {
    throw new Error("ใบสำคัญต้องมีทั้งด้านเดบิตและด้านเครดิต");
  }
  if (post && !isBalanced(input)) {
    throw new Error(`เดบิตไม่เท่าเครดิต ต่างกัน ${satang(Math.abs(entryDifference(input)))} ผ่านรายการไม่ได้`);
  }
}

const cleanLines = (lines: JournalLine[]) =>
  lines.map((l) => ({ account: l.account, amount: round2(l.amount), ...(l.note?.trim() ? { note: l.note.trim() } : {}) }));

function ownEntry(no: string): JournalEntry {
  const e = JOURNAL.find((x) => x.no === no);
  if (!e) throw new Error(`ไม่พบใบสำคัญ ${no} ในสมุดรายวันทั่วไป`);
  return e;
}

/** บันทึกใบสำคัญทั่วไปใหม่ — เป็นร่างก็ได้ ผ่านรายการเลยก็ได้ ถ้าผ่านต้องลงตัว */
export function createJournal(input: JournalInput, post: boolean): JournalEntry {
  checkJournal(input, post);
  return commit(() => {
    const e: JournalEntry = {
      no: nextJournalNo(), date: input.date, memo: input.memo.trim(), book: "ทั่วไป",
      ...(input.ref?.trim() ? { ref: input.ref.trim() } : {}),
      lines: cleanLines(input.lines),
      status: post ? "ผ่านรายการแล้ว" : "ร่าง",
    };
    JOURNAL.push(e);
    return e;
  });
}

/** แก้ได้เฉพาะร่าง ใบที่ผ่านรายการแล้วแก้ด้วยการกลับรายการ */
export function updateJournalDraft(no: string, input: JournalInput): JournalEntry {
  const e = ownEntry(no);
  if (e.status !== "ร่าง") throw new Error(`${no} ผ่านรายการแล้ว แก้ไม่ได้ ต้องกลับรายการ`);
  checkJournal(input, false);
  return commit(() => {
    e.date = input.date;
    e.memo = input.memo.trim();
    e.ref = input.ref?.trim() || undefined;
    e.lines = cleanLines(input.lines);
    return e;
  });
}

export function postJournal(no: string): JournalEntry {
  const e = ownEntry(no);
  if (e.status !== "ร่าง") throw new Error(`${no} ผ่านรายการไปแล้ว`);
  checkJournal(e, true);
  return commit(() => {
    e.status = "ผ่านรายการแล้ว";
    return e;
  });
}

/** ร่างยังไม่เข้าบัญชี จึงลบทิ้งได้โดยไม่ทิ้งร่องรอยในงบ */
export function deleteJournalDraft(no: string) {
  const e = ownEntry(no);
  if (e.status !== "ร่าง") throw new Error(`${no} ผ่านรายการแล้ว ลบไม่ได้ ต้องกลับรายการ`);
  commit(() => {
    JOURNAL.splice(JOURNAL.indexOf(e), 1);
  });
}

const latestActiveRun = () => {
  const runs = DEPRECIATION_RUNS.filter((r) => !isReversed(r.jv));
  return runs.length ? runs.reduce((a, b) => (a.period > b.period ? a : b)) : undefined;
};
const recordedAt = (no: string) => JOURNAL.findIndex((e) => e.no === no);

/**
 * ทำไมใบสำคัญใบนี้กลับรายการไม่ได้ — null คือกลับได้.
 * ใบที่เป็นของเอกสารอื่นกลับได้เมื่อไม่ทิ้งเอกสารนั้นไว้ครึ่ง ๆ กลาง ๆ
 */
export function reversalBlocker(no: string): string | null {
  const e = entryByNo(no);
  if (e.status === "ร่าง") return "ใบนี้ยังเป็นร่าง ยังไม่เข้าบัญชี ลบร่างได้เลยโดยไม่ต้องกลับรายการ";
  if (e.reversedBy) return `กลับรายการไปแล้วด้วย ${e.reversedBy}`;
  if (e.reverses) return `ใบนี้เป็นรายการกลับของ ${e.reverses} อยู่แล้ว`;
  if (e.origin) return `รายการนี้บันทึกอัตโนมัติจาก${e.origin} ต้องยกเลิกที่เอกสาร ${e.ref ?? "ต้นทาง"}`;
  if (e.no === OPENING_NO) return "ใบสำคัญยอดยกมาเป็นจุดเริ่มของทุกบัญชี กลับรายการไม่ได้";

  const bill = SERVICE_BILLS.find((b) => b.no === no);
  if (bill && paidAgainst(bill.no) > 0) return "ใบตั้งหนี้นี้มีการจ่ายชำระแล้ว ยกเลิกใบสำคัญจ่ายก่อน";

  const asset = ASSETS.find((a) => a.jv === no);
  if (asset && (postedDepreciation(asset) > 0 || activeDisposal(asset))) {
    return "สินทรัพย์นี้ตัดค่าเสื่อมหรือจำหน่ายไปแล้ว กลับรายการค่าเสื่อมหรือการจำหน่ายก่อน";
  }

  const run = DEPRECIATION_RUNS.find((r) => r.jv === no);
  if (run) {
    if (latestActiveRun() !== run) return "กลับรายการได้เฉพาะค่าเสื่อมงวดล่าสุด";
    const disposedAfter = DISPOSALS.some(
      (d) => !isReversed(d.jv) && recordedAt(d.jv) > recordedAt(run.jv) && run.lines.some((l) => l.asset === d.asset)
    );
    if (disposedAfter) return "มีสินทรัพย์ในงวดนี้ที่จำหน่ายไปแล้ว กลับรายการการจำหน่ายก่อน";
  }

  const disposal = DISPOSALS.find((d) => d.jv === no);
  if (disposal) {
    const runAfter = DEPRECIATION_RUNS.some((r) => !isReversed(r.jv) && recordedAt(r.jv) > recordedAt(disposal.jv));
    if (runAfter) return "ตัดค่าเสื่อมงวดถัดไปแล้ว กลับรายการค่าเสื่อมงวดนั้นก่อน";
  }
  return null;
}

/**
 * กลับรายการ: ออกใบสำคัญใหม่ที่เดบิตเครดิตสลับกัน ใบเดิมยังอยู่พร้อมเหตุผล
 * เอกสารที่ผูกกับใบนั้น — ใบสำคัญจ่าย ใบเสร็จ สินทรัพย์ — ถือว่ายกเลิกไปด้วย
 */
export function reverseJournal(no: string, reason: string, date: string): JournalEntry {
  const blocker = reversalBlocker(no);
  if (blocker) throw new Error(blocker);
  const e = ownEntry(no);
  if (reason.trim().length < 3) throw new Error("ต้องระบุเหตุผลที่กลับรายการ");
  if (!isIsoDate(date) || date < e.date) throw new Error("วันที่กลับรายการต้องไม่ก่อนวันที่ของใบเดิม");
  return commit(() => {
    const r: JournalEntry = {
      no: nextJournalNo(), date, book: "ทั่วไป", ref: e.no, reverses: e.no, reason: reason.trim(),
      memo: `กลับรายการ ${e.no} — ${reason.trim()}`,
      lines: e.lines.map((l) => ({ ...l, amount: -l.amount })),
      status: "ผ่านรายการแล้ว",
    };
    JOURNAL.push(r);
    e.reversedBy = r.no;
    return r;
  });
}

/* --------------------------------------------------------------- payables */

export type Payable = {
  no: string;
  source: "ใบแจ้งหนี้ซื้อสินค้า" | "ใบตั้งหนี้ค่าบริการ";
  vendor: string;
  vendorName: string;
  taxId: string;
  terms: string;
  date: string;
  due: string;
  description: string;
  po?: string;
  /** ยอดก่อนภาษีมูลค่าเพิ่ม — ฐานของภาษีหัก ณ ที่จ่าย */
  base: number;
  vat: number;
  /** ยอดตามใบแจ้งหนี้ รวมภาษีมูลค่าเพิ่ม */
  amount: number;
  paidAmount: number;
  open: number;
  overdueDays: number;
  /** อัตราหัก ณ ที่จ่ายที่ตั้งไว้กับใบนี้ ซื้อสินค้าไม่ต้องหัก */
  whtRate: number;
  /** เหตุที่ฝ่ายจัดซื้อระงับการจ่าย — ใบที่รับของไม่ตรงกับที่วางบิลห้ามจ่าย */
  blocked?: string;
};

function payableItems(): Payable[] {
  const fromPurchasing = PURCHASE_INVOICES.map((iv): Payable => {
    const v = vendor(iv.vendor);
    const amount = purchaseGross(iv);
    const paidAmount = iv.paid ? amount : paidAgainst(iv.no);
    const due = addDays(iv.date, termDays(v.terms));
    return {
      no: iv.no, source: "ใบแจ้งหนี้ซื้อสินค้า", vendor: v.code, vendorName: v.name, taxId: v.taxId, terms: v.terms,
      date: iv.date, due, description: "ซื้อวัตถุดิบตามใบสั่งซื้อ " + iv.po, po: iv.po,
      base: iv.amount, vat: purchaseVat(iv), amount, paidAmount, open: round2(amount - paidAmount),
      overdueDays: Math.max(0, daysBetween(due, PERIOD.to)), whtRate: 0,
      ...(iv.blocked ? { blocked: iv.blockReason ?? "ฝ่ายจัดซื้อระงับการจ่าย" } : {}),
    };
  });
  const fromBills = activeBills().map((b): Payable => {
    const v = vendor(b.vendor);
    const amount = serviceGross(b);
    const paidAmount = paidAgainst(b.no);
    const due = addDays(b.date, termDays(v.terms));
    return {
      no: b.no, source: "ใบตั้งหนี้ค่าบริการ", vendor: v.code, vendorName: v.name, taxId: v.taxId, terms: v.terms,
      date: b.date, due, description: b.description,
      base: b.base, vat: b.vat, amount, paidAmount, open: round2(amount - paidAmount),
      overdueDays: Math.max(0, daysBetween(due, PERIOD.to)), whtRate: b.whtRate,
    };
  });
  return [...fromPurchasing, ...fromBills];
}

/** เจ้าหนี้ที่ยังค้างจ่าย — ใบแจ้งหนี้จากแฟ้มจัดซื้อและใบตั้งหนี้ค่าบริการของบัญชี */
export function payables() {
  return payableItems().filter((p) => p.open > 0.004);
}

export function payable(no: string): Payable {
  const p = payableItems().find((x) => x.no === no);
  if (!p) throw new Error(`ไม่พบใบแจ้งหนี้ ${no}`);
  return p;
}

export const nextBillNo = () => nextNo(`AP-${BE}-`, SERVICE_BILLS.map((b) => b.no), 4);

export type ServiceBillInput = {
  date: string;
  vendor: string;
  vendorInvoice: string;
  description: string;
  account: string;
  base: number;
  withVat: boolean;
  whtRate: number;
};

/** บัญชีที่ใบตั้งหนี้ค่าบริการลงได้: ค่าใช้จ่ายทุกบัญชี หรือรวมเป็นต้นทุนสินค้า */
export const billAccounts = () => ACCOUNTS.filter((a) => a.type === "ค่าใช้จ่าย" || a.code === "1210");

export function createServiceBill(input: ServiceBillInput): ServiceBill {
  const v = vendor(input.vendor);
  const ref = input.vendorInvoice.trim();
  if (!isIsoDate(input.date)) throw new Error("ต้องระบุวันที่ใบแจ้งหนี้");
  if (ref.length < 2) throw new Error("ต้องระบุเลขที่ใบแจ้งหนี้ของผู้ขาย");
  const duplicate =
    SERVICE_BILLS.some((b) => b.vendor === v.code && b.vendorInvoice === ref && !isReversed(b.no)) ||
    PURCHASE_INVOICES.some((iv) => iv.vendor === v.code && iv.no === ref);
  if (duplicate) throw new Error(`ใบแจ้งหนี้ ${ref} ของ ${v.name} ตั้งหนี้ไปแล้ว`);
  if (input.description.trim().length < 3) throw new Error("ต้องระบุรายการค่าบริการ");
  if (!billAccounts().some((a) => a.code === input.account)) throw new Error("เลือกบัญชีค่าใช้จ่ายที่จะลง");
  if (!(input.base > 0)) throw new Error("ยอดก่อนภาษีต้องมากกว่าศูนย์");
  whtType(input.whtRate);
  return commit(() => {
    const b: ServiceBill = {
      no: nextBillNo(), date: input.date, vendor: v.code, vendorInvoice: ref, description: input.description.trim(),
      account: input.account, base: round2(input.base), vat: input.withVat ? round2(input.base * VAT_RATE) : 0,
      whtRate: input.whtRate,
    };
    SERVICE_BILLS.push(b);
    JOURNAL.push(billEntry(b));
    return b;
  });
}

export const nextPaymentNo = () => nextNo(`PV-${BE}-`, PAYMENTS.map((p) => p.no), 4);

export type PaymentInput = {
  invoice: string;
  date: string;
  settle: number;
  whtRate: number;
  method: PayMethod;
  bankRef?: string;
};

/**
 * จ่ายชำระหนี้หนึ่งใบ เต็มจำนวนหรือบางส่วน. ตัดเจ้าหนี้เท่ายอดที่ชำระ จ่ายเงินออก
 * เท่ายอดหลังหัก ณ ที่จ่าย ส่วนที่หักไว้เป็นหนี้ที่ต้องนำส่งสรรพากร
 */
export function recordPayment(input: PaymentInput): Payment {
  const p = payable(input.invoice);
  if (p.open <= 0) throw new Error(`${p.no} ชำระครบแล้ว`);
  if (p.blocked) throw new Error(`${p.no} ถูกระงับการจ่าย: ${p.blocked}`);
  if (!isIsoDate(input.date) || input.date < p.date) throw new Error("วันที่จ่ายต้องไม่ก่อนวันที่ใบแจ้งหนี้");
  if (!(input.settle > 0)) throw new Error("ยอดที่จ่ายต้องมากกว่าศูนย์");
  if (input.settle > p.open + 0.004) throw new Error(`ยอดที่จ่ายเกินยอดค้าง ${satang(p.open)}`);
  whtType(input.whtRate);
  if (input.method === "เช็ค" && !input.bankRef?.trim()) throw new Error("จ่ายด้วยเช็คต้องระบุเลขที่เช็ค");
  const settle = round2(input.settle);
  const w = withholding(settle, p, input.whtRate);
  return commit(() => {
    const pay: Payment = {
      no: nextPaymentNo(), date: input.date, invoice: p.no, vendor: p.vendor, settle,
      whtRate: input.whtRate, whtBase: w.base, wht: w.wht, net: w.net, method: input.method,
      ...(input.bankRef?.trim() ? { bankRef: input.bankRef.trim() } : {}),
    };
    PAYMENTS.push(pay);
    JOURNAL.push(paymentEntry(pay));
    return pay;
  });
}

/** ใบสำคัญจ่ายยังใช้อยู่ไหม — ยกเลิกคือใบสำคัญของมันถูกกลับรายการ */
export const isVoided = (no: string) => isReversed(no);

/* ------------------------------------------------------------- receivables */

/** ลูกหนี้หนึ่งใบกำกับ: ยอดตามใบ หักใบลดหนี้ หักที่รับชำระแล้ว */
export type Receivable = {
  invoice: string;
  so: string;
  customer: string;
  customerName: string;
  taxId: string;
  address: string;
  terms: string;
  date: string;
  due: string;
  amount: number;
  net: number;
  vat: number;
  /** ใบลดหนี้ที่อ้างใบนี้ รวม VAT */
  credited: number;
  /** รับชำระแล้ว รวมภาษีที่ลูกค้าหักไว้ */
  received: number;
  /** ติดลบคือลดหนี้หลังรับเงินแล้ว ต้องคืนเงินหรือหักกับใบถัดไป */
  open: number;
  paid: boolean;
  receipt?: SalesReceipt;
  overdueDays: number;
};

function receivableItems(): Receivable[] {
  return BILLINGS.map((inv) => {
    const c = customer(inv.customer);
    const due = amountDue(inv);
    const received = inv.receipt ? round2(inv.receipt.amount + inv.receipt.wht) : 0;
    const open = round2(due - received);
    return {
      invoice: inv.no, so: inv.so, customer: c.code, customerName: c.name, taxId: c.taxId, address: c.address,
      terms: c.terms, date: inv.date, due: inv.due, amount: inv.gross, net: inv.net, vat: inv.vat,
      credited: round2(inv.gross - due), received, open, paid: inv.paid, receipt: inv.receipt,
      overdueDays: open > 0 ? Math.max(0, daysBetween(inv.due, PERIOD.to)) : 0,
    };
  });
}

/** ลูกหนี้ที่ยังมียอดค้างตามใบกำกับ — รวมใบที่ลดหนี้หลังรับเงินจนเหลือยอดเครดิต */
export function receivables() {
  return receivableItems().filter((r) => Math.abs(r.open) > 0.004);
}

export function receivable(invoiceNo: string): Receivable {
  const r = receivableItems().find((x) => x.invoice === invoiceNo);
  if (!r) throw new Error(`ไม่พบใบกำกับ ${invoiceNo}`);
  return r;
}

/** ใบเสร็จทั้งหมดของฝ่ายขาย ที่ใช้อยู่และที่ยกเลิกแล้ว ใหม่สุดก่อน */
export function salesReceipts() {
  const live = BILLINGS.flatMap((inv) => (inv.receipt ? [{ ...inv.receipt, invoice: inv.no, voided: false as const }] : []));
  const voided = VOIDED_RECEIPTS.map((v) => ({ ...v, voided: true as const }));
  return [...live, ...voided].sort((a, b) => b.no.localeCompare(a.no));
}

/* ---------------------------------------------------------------- aging */

export const AGING_BUCKETS = [
  { label: "ยังไม่ถึงกำหนด", max: 0 },
  { label: "เกิน 1–30 วัน", max: 30 },
  { label: "เกิน 31–60 วัน", max: 60 },
  { label: "เกิน 60 วันขึ้นไป", max: Infinity },
];

export function bucketOf(overdueDays: number) {
  return AGING_BUCKETS.find((b) => overdueDays <= b.max) ?? AGING_BUCKETS[AGING_BUCKETS.length - 1];
}

/** รายงานอายุหนี้แยกรายคู่ค้า: ยอดค้างของแต่ละรายกระจายลงช่วงอายุ */
export function agingByParty(rows: { party: string; open: number; overdueDays: number }[]) {
  const parties = [...new Set(rows.map((r) => r.party))];
  return parties
    .map((party) => {
      const mine = rows.filter((r) => r.party === party);
      const buckets = AGING_BUCKETS.map((b) =>
        sumOf(mine.filter((r) => bucketOf(r.overdueDays).label === b.label).map((r) => r.open))
      );
      return { party, documents: mine.length, buckets, total: sumOf(buckets) };
    })
    .sort((a, b) => b.total - a.total);
}

/* ---------------------------------------------------- fixed-asset register */

/** งวดล่าสุดที่ตัดค่าเสื่อมแล้ว — ค่าเสื่อมสะสมและเดือนที่ถือครองนับถึงวันนี้ */
export function depreciatedThrough() {
  const run = latestActiveRun();
  return run ? monthEnd(run.period) : BROUGHT_FORWARD_TO;
}

/** ค่าเสื่อมที่ลงบัญชีไปแล้วของสินทรัพย์หนึ่ง ในระบบนี้ ไม่นับยอดยกมา */
export const postedDepreciation = (a: Asset) =>
  sumOf(
    DEPRECIATION_RUNS.filter((r) => !isReversed(r.jv)).flatMap((r) =>
      r.lines.filter((l) => l.asset === a.code).map((l) => l.amount)
    )
  );

export const activeDisposal = (a: Asset) => DISPOSALS.find((d) => d.asset === a.code && !isReversed(d.jv));

/** ค่าเสื่อมสะสมตามบัญชี: ยอดยกมาบวกทุกงวดที่ลงแล้ว สินทรัพย์ที่จำหน่ายแล้วหยุดที่วันจำหน่าย */
export function accumulated(a: Asset) {
  const sold = activeDisposal(a);
  return sold ? sold.accumulated : round2(broughtForward(a) + postedDepreciation(a));
}

export const bookValue = (a: Asset) => round2(a.cost - accumulated(a));

export type AssetStatus = "ใช้งาน" | "ตัดค่าเสื่อมครบแล้ว" | "จำหน่ายแล้ว";
export function assetStatus(a: Asset): AssetStatus {
  if (activeDisposal(a)) return "จำหน่ายแล้ว";
  return accumulated(a) >= a.cost - a.salvage ? "ตัดค่าเสื่อมครบแล้ว" : "ใช้งาน";
}

/** ทะเบียนสินทรัพย์ — ไม่รวมใบที่ลงทะเบียนผิดแล้วกลับรายการทิ้ง */
export const assetRegister = () => ASSETS.filter((a) => !a.jv || !isReversed(a.jv));
const inService = () => assetRegister().filter((a) => !activeDisposal(a));

export function asset(code: string): Asset {
  const a = ASSETS.find((x) => x.code === code);
  if (!a) throw new Error(`ไม่พบสินทรัพย์ ${code}`);
  return a;
}

export const nextAssetCode = () => nextNo("FA-", ASSETS.map((a) => a.code), 3);

/** งวดที่ตัดค่าเสื่อมได้ถัดไป — ต่อจากงวดล่าสุดที่ลงแล้ว ข้ามเดือนไม่ได้ */
export function nextDepreciationPeriod() {
  const run = latestActiveRun();
  return run ? nextMonth(run.period) : monthKey(PERIOD.to);
}

/** ค่าเสื่อมที่จะลงในงวดถัดไป รายสินทรัพย์ — เดือนสุดท้ายตัดเท่าที่เหลือถึงราคาซาก */
export function depreciationPreview() {
  const period = nextDepreciationPeriod();
  const lines = inService()
    .filter((a) => monthKey(a.acquired) < period)
    .map((a) => ({ asset: a.code, amount: Math.min(monthlyDepreciation(a), round2(a.cost - a.salvage - accumulated(a))) }))
    .filter((l) => l.amount > 0);
  return { period, date: monthEnd(period), lines, total: sumOf(lines.map((l) => l.amount)) };
}

/** ลงค่าเสื่อมราคาประจำงวด: เดบิตค่าเสื่อมราคา เครดิตค่าเสื่อมราคาสะสม */
export function runDepreciation(): DepreciationRun {
  const p = depreciationPreview();
  if (p.total <= 0) throw new Error(`ไม่มีสินทรัพย์ที่ต้องตัดค่าเสื่อมในงวด ${thaiMonth(p.period)}`);
  return commit(() => {
    const jv = nextJournalNo();
    JOURNAL.push({
      no: jv, date: p.date, book: "ทั่วไป", status: "ผ่านรายการแล้ว",
      memo: "ค่าเสื่อมราคาประจำงวด " + thaiMonth(p.period),
      lines: [
        { account: "5210", amount: p.total, note: `สินทรัพย์ ${p.lines.length} รายการ วิธีเส้นตรง` },
        { account: "1319", amount: -p.total },
      ],
    });
    const run: DepreciationRun = { period: p.period, date: p.date, jv, lines: p.lines };
    DEPRECIATION_RUNS.push(run);
    return run;
  });
}

export type AssetInput = {
  name: string;
  cost: number;
  acquired: string;
  lifeYears: number;
  salvage: number;
  /** ซื้อพร้อมใบกำกับภาษี ขอคืนภาษีซื้อได้ */
  withVat: boolean;
};

/** วันที่ได้มาเร็วสุดที่ลงทะเบียนได้ — งวดที่ตัดค่าเสื่อมไปแล้วเพิ่มสินทรัพย์ย้อนหลังไม่ได้ */
export const earliestAcquisition = () => (latestActiveRun()?.period ?? monthKey(PERIOD.to)) + "-01";

export function registerAsset(input: AssetInput): Asset {
  const name = input.name.trim();
  if (name.length < 2) throw new Error("ต้องมีชื่อสินทรัพย์");
  if (!(input.cost > 0)) throw new Error("ราคาทุนต้องมากกว่าศูนย์");
  if (!Number.isInteger(input.lifeYears) || input.lifeYears < 1 || input.lifeYears > 50) {
    throw new Error("อายุการใช้งานต้องเป็นจำนวนปีเต็ม 1–50 ปี");
  }
  if (!(input.salvage >= 0) || input.salvage >= input.cost) throw new Error("ราคาซากต้องไม่ติดลบและน้อยกว่าราคาทุน");
  if (!isIsoDate(input.acquired)) throw new Error("ต้องระบุวันที่ได้มา");
  if (input.acquired < earliestAcquisition()) throw new Error("วันที่ได้มาอยู่ในงวดที่ตัดค่าเสื่อมไปแล้ว");
  const cost = round2(input.cost);
  const vat = input.withVat ? round2(cost * VAT_RATE) : 0;
  return commit(() => {
    const jv = nextJournalNo();
    const a: Asset = {
      code: nextAssetCode(), name, cost, lifeYears: input.lifeYears, acquired: input.acquired,
      salvage: round2(input.salvage), jv,
    };
    JOURNAL.push({
      no: jv, date: a.acquired, book: "ทั่วไป", status: "ผ่านรายการแล้ว", ref: a.code,
      memo: "ซื้อสินทรัพย์ " + a.code + " " + a.name,
      lines: [
        { account: "1310", amount: cost, note: a.name },
        ...(vat > 0 ? [{ account: "1120", amount: vat, note: "ภาษีซื้อ 7%" }] : []),
        { account: "1010", amount: -round2(cost + vat) },
      ],
    });
    ASSETS.push(a);
    return a;
  });
}

/** แก้ข้อมูลหลักของสินทรัพย์ อายุและราคาซากเปลี่ยนได้เฉพาะตัวที่ยังไม่เคยตัดค่าเสื่อม */
export function updateAsset(code: string, patch: { name: string; lifeYears: number; salvage: number }) {
  const a = asset(code);
  if (patch.name.trim().length < 2) throw new Error("ต้องมีชื่อสินทรัพย์");
  const changesDepreciation = patch.lifeYears !== a.lifeYears || patch.salvage !== a.salvage;
  if (changesDepreciation && (!a.jv || postedDepreciation(a) > 0)) {
    throw new Error("สินทรัพย์นี้ตัดค่าเสื่อมไปแล้ว เปลี่ยนอายุหรือราคาซากไม่ได้");
  }
  if (!Number.isInteger(patch.lifeYears) || patch.lifeYears < 1 || patch.lifeYears > 50) {
    throw new Error("อายุการใช้งานต้องเป็นจำนวนปีเต็ม 1–50 ปี");
  }
  if (!(patch.salvage >= 0) || patch.salvage >= a.cost) throw new Error("ราคาซากต้องไม่ติดลบและน้อยกว่าราคาทุน");
  commit(() => {
    a.name = patch.name.trim();
    a.lifeYears = patch.lifeYears;
    a.salvage = round2(patch.salvage);
  });
}

export const canChangeDepreciation = (a: Asset) => Boolean(a.jv) && postedDepreciation(a) === 0;

export type DisposalInput = {
  asset: string;
  date: string;
  price: number;
  withVat: boolean;
  buyer?: string;
  reason: string;
};

/** ผลของการจำหน่ายก่อนลงบัญชี: มูลค่าตามบัญชี ภาษีขาย และกำไรหรือขาดทุน */
export function disposalPreview(code: string, price: number, withVat: boolean) {
  const a = asset(code);
  const acc = accumulated(a);
  const nbv = round2(a.cost - acc);
  const vat = withVat && price > 0 ? round2(price * VAT_RATE) : 0;
  return { accumulated: acc, bookValue: nbv, vat, gain: round2(price - nbv) };
}

/**
 * จำหน่ายหรือขายสินทรัพย์. ล้างราคาทุนและค่าเสื่อมสะสมออกจากบัญชี รับเงินค่าขาย
 * ส่วนต่างกับมูลค่าตามบัญชีเป็นกำไรหรือขาดทุนจากการจำหน่าย
 */
export function disposeAsset(input: DisposalInput): Disposal {
  const a = asset(input.asset);
  if (!assetRegister().includes(a)) throw new Error(`${a.code} ถูกยกเลิกไปแล้ว`);
  if (activeDisposal(a)) throw new Error(`${a.code} จำหน่ายไปแล้ว`);
  if (!isIsoDate(input.date) || input.date < a.acquired) throw new Error("วันที่จำหน่ายต้องไม่ก่อนวันที่ได้มา");
  if (!(input.price >= 0)) throw new Error("ราคาขายต้องไม่ติดลบ");
  if (input.reason.trim().length < 2) throw new Error("ต้องระบุเหตุผลที่จำหน่าย");
  const price = round2(input.price);
  const p = disposalPreview(a.code, price, input.withVat);
  return commit(() => {
    const jv = nextJournalNo();
    JOURNAL.push({
      no: jv, date: input.date, book: "ทั่วไป", status: "ผ่านรายการแล้ว", ref: a.code,
      memo: (price > 0 ? "ขายสินทรัพย์ " : "ตัดจำหน่ายสินทรัพย์ ") + a.code + " " + a.name,
      lines: [
        ...(price > 0 ? [{ account: "1010", amount: round2(price + p.vat), note: input.buyer?.trim() || undefined }] : []),
        ...(p.accumulated > 0 ? [{ account: "1319", amount: p.accumulated }] : []),
        { account: "1310", amount: -a.cost, note: a.name },
        ...(p.vat > 0 ? [{ account: "2110", amount: -p.vat, note: "ภาษีขาย 7%" }] : []),
        ...(p.gain > 0 ? [{ account: "4110", amount: -p.gain }] : []),
        ...(p.gain < 0 ? [{ account: "5410", amount: -p.gain }] : []),
      ],
    });
    const d: Disposal = {
      asset: a.code, date: input.date, price, vat: p.vat, accumulated: p.accumulated, bookValue: p.bookValue,
      gain: p.gain, reason: input.reason.trim(), jv, ...(input.buyer?.trim() ? { buyer: input.buyer.trim() } : {}),
    };
    DISPOSALS.push(d);
    return d;
  });
}

export { VENDORS, CUSTOMERS };
