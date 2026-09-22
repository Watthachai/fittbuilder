import { VENDORS, INVOICES as PURCHASE_INVOICES, vendor } from "../mm/data";
import { CUSTOMERS, SALES_ORDERS, BILLINGS, customer, orderTotal } from "../sd/data";
import type { SalesOrder } from "../sd/data";
import { material } from "../mm/data";

export const PERIOD = { label: "งวดเดือนกันยายน 2569", from: "2026-09-01", to: "2026-09-30" };
export const VAT_RATE = 0.07;

/** ผังบัญชี — 1 สินทรัพย์ · 2 หนี้สิน · 3 ส่วนของเจ้าของ · 4 รายได้ · 5 ค่าใช้จ่าย */
export const ACCOUNTS = [
  { code: "1010", name: "เงินสดและเงินฝากธนาคาร", type: "สินทรัพย์" },
  { code: "1110", name: "ลูกหนี้การค้า", type: "สินทรัพย์" },
  { code: "1120", name: "ภาษีซื้อ", type: "สินทรัพย์" },
  { code: "1210", name: "สินค้าคงเหลือ", type: "สินทรัพย์" },
  { code: "1310", name: "ที่ดิน อาคารและอุปกรณ์", type: "สินทรัพย์" },
  { code: "1319", name: "ค่าเสื่อมราคาสะสม", type: "สินทรัพย์" },
  { code: "2010", name: "เจ้าหนี้การค้า", type: "หนี้สิน" },
  { code: "2110", name: "ภาษีขายค้างนำส่ง", type: "หนี้สิน" },
  { code: "2210", name: "ภาษีและประกันสังคมค้างนำส่ง", type: "หนี้สิน" },
  { code: "3010", name: "ทุนจดทะเบียน", type: "ส่วนของเจ้าของ" },
  { code: "3110", name: "กำไรสะสม", type: "ส่วนของเจ้าของ" },
  { code: "4010", name: "รายได้จากการขาย", type: "รายได้" },
  { code: "5010", name: "ต้นทุนขาย", type: "ค่าใช้จ่าย" },
  { code: "5110", name: "เงินเดือนและสวัสดิการ", type: "ค่าใช้จ่าย" },
  { code: "5210", name: "ค่าเสื่อมราคา", type: "ค่าใช้จ่าย" },
  { code: "5310", name: "ค่าใช้จ่ายในการขายและบริหาร", type: "ค่าใช้จ่าย" },
];

export const ASSETS = [
  { code: "FA-001", name: "เครื่องตัดเหล็ก CNC", cost: 1800000, lifeYears: 10, acquired: "2023-03-15" },
  { code: "FA-002", name: "รถโฟล์คลิฟท์ 2.5 ตัน", cost: 850000, lifeYears: 8, acquired: "2024-06-01" },
  { code: "FA-003", name: "ระบบพ่นสีอัตโนมัติ", cost: 420000, lifeYears: 5, acquired: "2025-01-10" },
  { code: "FA-004", name: "คอมพิวเตอร์สำนักงาน", cost: 130000, lifeYears: 3, acquired: "2025-08-20" },
];

export type Asset = (typeof ASSETS)[number];

export const monthlyDepreciation = (a: Asset) => Math.round(a.cost / a.lifeYears / 12);

export function monthsHeld(a: Asset) {
  const d = new Date(a.acquired);
  const end = new Date(PERIOD.to);
  return (end.getFullYear() - d.getFullYear()) * 12 + (end.getMonth() - d.getMonth());
}

export function accumulated(a: Asset) {
  return Math.min(a.cost, monthlyDepreciation(a) * monthsHeld(a));
}

const assetCost = ASSETS.reduce((n, a) => n + a.cost, 0);
const accumDep = ASSETS.reduce((n, a) => n + accumulated(a), 0);
const monthDep = ASSETS.reduce((n, a) => n + monthlyDepreciation(a), 0);

/** ต้นทุนขายของใบสั่งขายหนึ่งใบ คิดจากราคามาตรฐานในแฟ้มวัสดุ */
const costOfSale = (so: SalesOrder) =>
  so.lines.reduce((n, l) => n + l.qty * material(l.material).price, 0);

/**
 * สมุดรายวัน. ทุกรายการต้องลงตัว — เดบิตเป็นบวก เครดิตเป็นลบ รวมกันได้ศูนย์
 * รายการขายและซื้อสร้างจากเอกสารต้นทางจริง ไม่ได้พิมพ์ตัวเลขซ้ำลงมาที่นี่
 */
export type JournalLine = { account: string; amount: number };
export type JournalEntry = { no: string; date: string; memo: string; ref?: string; lines: JournalLine[] };

export const JOURNAL: JournalEntry[] = [
  {
    no: "JV-6900", date: "2026-01-01", memo: "ยอดยกมาต้นงวดบัญชี",
    lines: [
      { account: "1010", amount: 2000000 },
      { account: "1210", amount: 1500000 },
      { account: "1310", amount: assetCost },
      { account: "1319", amount: -(accumDep - monthDep) },
      { account: "3010", amount: -5000000 },
      { account: "3110", amount: -(2000000 + 1500000 + assetCost - (accumDep - monthDep) - 5000000) },
    ],
  },
  ...SALES_ORDERS.map((so, i) => {
    const t = orderTotal(so);
    return {
      no: "JV-69" + (10 + i * 2), date: so.date,
      memo: "ขายเชื่อ " + so.no + " — " + customer(so.customer).name,
      ref: so.no,
      lines: [
        { account: "1110", amount: t.gross },
        { account: "4010", amount: -t.net },
        { account: "2110", amount: -t.vat },
      ],
    };
  }),
  ...SALES_ORDERS.map((so, i) => ({
    no: "JV-69" + (11 + i * 2), date: so.date,
    memo: "ตัดต้นทุนขาย " + so.no,
    ref: so.no,
    lines: [
      { account: "5010", amount: costOfSale(so) },
      { account: "1210", amount: -costOfSale(so) },
    ],
  })),
  ...PURCHASE_INVOICES.map((iv, i) => ({
    no: "JV-6930" + i, date: iv.date,
    memo: "ตั้งหนี้ซื้อ " + iv.no + " — " + vendor(iv.vendor).name,
    ref: iv.no,
    lines: [
      { account: "1210", amount: iv.amount },
      { account: "1120", amount: Math.round(iv.amount * VAT_RATE) },
      { account: "2010", amount: -(iv.amount + Math.round(iv.amount * VAT_RATE)) },
    ],
  })),
  ...PURCHASE_INVOICES.filter((iv) => iv.paid).map((iv, i) => {
    const gross = iv.amount + Math.round(iv.amount * VAT_RATE);
    return {
      no: "JV-6935" + i,
      date: iv.date,
      memo: "จ่ายชำระหนี้ " + iv.no + " — " + vendor(iv.vendor).name,
      ref: iv.no,
      lines: [
        { account: "2010", amount: gross },
        { account: "1010", amount: -gross },
      ],
    };
  }),
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
      { account: "5210", amount: monthDep },
      { account: "1319", amount: -monthDep },
    ],
  },
  {
    no: "JV-6942", date: "2026-09-30", memo: "ค่าเช่า ค่าสาธารณูปโภคและค่าใช้จ่ายสำนักงาน",
    lines: [
      { account: "5310", amount: 148000 },
      { account: "1010", amount: -148000 },
    ],
  },
];

export const account = (code: string) => {
  const a = ACCOUNTS.find((x) => x.code === code);
  if (!a) throw new Error(`ไม่มีบัญชี ${code} ในผังบัญชี`);
  return a;
};

export const baht = (n: number) => n.toLocaleString("th-TH", { maximumFractionDigits: 0 }) + " ฿";

export const entryTotal = (e: JournalEntry) =>
  e.lines.filter((l) => l.amount > 0).reduce((n, l) => n + l.amount, 0);
export const isBalanced = (e: JournalEntry) => e.lines.reduce((n, l) => n + l.amount, 0) === 0;

/** ยอดคงเหลือทุกบัญชี — เดบิตเป็นบวก เครดิตเป็นลบ */
export function trialBalance() {
  return ACCOUNTS.map((a) => ({
    ...a,
    balance: JOURNAL.flatMap((e) => e.lines).filter((l) => l.account === a.code)
      .reduce((n, l) => n + l.amount, 0),
  }));
}

export const balanceOf = (code: string) => trialBalance().find((a) => a.code === code)?.balance ?? 0;

/** งบกำไรขาดทุน — รายได้เป็นเครดิตจึงติดลบ กลับเครื่องหมายตอนแสดง */
export function profitAndLoss() {
  const tb = trialBalance();
  const revenue = -tb.filter((a) => a.type === "รายได้").reduce((n, a) => n + a.balance, 0);
  const expenses = tb.filter((a) => a.type === "ค่าใช้จ่าย");
  const expenseTotal = expenses.reduce((n, a) => n + a.balance, 0);
  return { revenue, expenses, expenseTotal, profit: revenue - expenseTotal };
}

export function balanceSheet() {
  const tb = trialBalance();
  const assets = tb.filter((a) => a.type === "สินทรัพย์");
  const liabilities = tb.filter((a) => a.type === "หนี้สิน");
  const equity = tb.filter((a) => a.type === "ส่วนของเจ้าของ");
  const assetTotal = assets.reduce((n, a) => n + a.balance, 0);
  const liabilityTotal = -liabilities.reduce((n, a) => n + a.balance, 0);
  const equityTotal = -equity.reduce((n, a) => n + a.balance, 0);
  const { profit } = profitAndLoss();
  return {
    assets, liabilities, equity, assetTotal, liabilityTotal, equityTotal, profit,
    balances: assetTotal === liabilityTotal + equityTotal + profit,
  };
}

const addDays = (iso: string, n: number) => {
  const d = new Date(iso);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};
const daysBetween = (a: string, b: string) =>
  Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
/** "เครดิต 30 วัน" -> 30 · "เงินสด" -> 0 */
const termDays = (terms: string) => Number(terms.match(/\d+/)?.[0] ?? 0);

/** เจ้าหนี้ที่ยังไม่จ่าย — อ่านผู้ขายจากแฟ้มจัดซื้อ */
export function payables() {
  return PURCHASE_INVOICES.filter((iv) => !iv.paid).map((iv) => {
    const v = vendor(iv.vendor);
    const due = addDays(iv.date, termDays(v.terms));
    const amount = iv.amount + Math.round(iv.amount * VAT_RATE);
    return { ...iv, vendorName: v.name, terms: v.terms, due, amount, overdueDays: Math.max(0, daysBetween(due, PERIOD.to)) };
  });
}

/** ลูกหนี้ที่ยังไม่เก็บเงิน — อ่านลูกค้าจากแฟ้มขาย */
export function receivables() {
  return SALES_ORDERS.map((so) => {
    const c = customer(so.customer);
    const bill = BILLINGS.find((b) => b.so === so.no);
    const due = addDays(so.date, termDays(c.terms));
    return {
      so: so.no, customerName: c.name, terms: c.terms, date: so.date, due,
      amount: orderTotal(so).gross,
      billed: Boolean(bill), paid: Boolean(bill?.paid),
      overdueDays: Math.max(0, daysBetween(due, PERIOD.to)),
    };
  }).filter((r) => !r.paid);
}

export const AGING_BUCKETS = [
  { label: "ยังไม่ถึงกำหนด", max: 0 },
  { label: "เกิน 1–30 วัน", max: 30 },
  { label: "เกิน 31–60 วัน", max: 60 },
  { label: "เกิน 60 วันขึ้นไป", max: Infinity },
];

export function bucketOf(overdueDays: number) {
  return AGING_BUCKETS.find((b) => overdueDays <= b.max) ?? AGING_BUCKETS[AGING_BUCKETS.length - 1];
}

export { VENDORS, CUSTOMERS };
