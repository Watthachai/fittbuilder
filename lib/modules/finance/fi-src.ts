export const FI_DATA = `import { VENDORS, INVOICES as PURCHASE_INVOICES, vendor } from "../mm/data";
import { CUSTOMERS, SALES_ORDERS, BILLINGS, customer, orderTotal } from "../sd/data";
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

export const monthlyDepreciation = (a) => Math.round(a.cost / a.lifeYears / 12);

export function monthsHeld(a) {
  const d = new Date(a.acquired);
  const end = new Date(PERIOD.to);
  return (end.getFullYear() - d.getFullYear()) * 12 + (end.getMonth() - d.getMonth());
}

export function accumulated(a) {
  return Math.min(a.cost, monthlyDepreciation(a) * monthsHeld(a));
}

const assetCost = ASSETS.reduce((n, a) => n + a.cost, 0);
const accumDep = ASSETS.reduce((n, a) => n + accumulated(a), 0);
const monthDep = ASSETS.reduce((n, a) => n + monthlyDepreciation(a), 0);

/** ต้นทุนขายของใบสั่งขายหนึ่งใบ คิดจากราคามาตรฐานในแฟ้มวัสดุ */
const costOfSale = (so) =>
  so.lines.reduce((n, l) => n + l.qty * (material(l.material)?.price ?? 0), 0);

/**
 * สมุดรายวัน. ทุกรายการต้องลงตัว — เดบิตเป็นบวก เครดิตเป็นลบ รวมกันได้ศูนย์
 * รายการขายและซื้อสร้างจากเอกสารต้นทางจริง ไม่ได้พิมพ์ตัวเลขซ้ำลงมาที่นี่
 */
export const JOURNAL = [
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

export const account = (code) => ACCOUNTS.find((a) => a.code === code);
export const baht = (n) => n.toLocaleString("th-TH", { maximumFractionDigits: 0 }) + " ฿";

export const entryTotal = (e) => e.lines.filter((l) => l.amount > 0).reduce((n, l) => n + l.amount, 0);
export const isBalanced = (e) => e.lines.reduce((n, l) => n + l.amount, 0) === 0;

/** ยอดคงเหลือทุกบัญชี — เดบิตเป็นบวก เครดิตเป็นลบ */
export function trialBalance() {
  return ACCOUNTS.map((a) => ({
    ...a,
    balance: JOURNAL.flatMap((e) => e.lines).filter((l) => l.account === a.code)
      .reduce((n, l) => n + l.amount, 0),
  }));
}

export const balanceOf = (code) => trialBalance().find((a) => a.code === code)?.balance ?? 0;

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

const addDays = (iso, n) => {
  const d = new Date(iso);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);
const termDays = (terms) => Number(terms.match(/\\d+/)?.[0] ?? 0);

/** เจ้าหนี้ที่ยังไม่จ่าย — อ่านผู้ขายจากแฟ้มจัดซื้อ */
export function payables() {
  return PURCHASE_INVOICES.map((iv) => {
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

export function bucketOf(overdueDays) {
  return AGING_BUCKETS.find((b) => overdueDays <= b.max) ?? AGING_BUCKETS[AGING_BUCKETS.length - 1];
}

export { VENDORS, CUSTOMERS };
`;

export const FI_SCREEN = `import { useState } from "react";
import {
  PERIOD, ACCOUNTS, ASSETS, JOURNAL, VENDORS, CUSTOMERS, AGING_BUCKETS,
  account, baht, entryTotal, isBalanced, trialBalance,
  profitAndLoss, balanceSheet, payables, receivables, bucketOf,
  monthlyDepreciation, accumulated, monthsHeld,
} from "./data";

const TABS = [
  "ผังบัญชีและสมุดรายวัน",
  "เจ้าหนี้การค้า",
  "ลูกหนี้การค้า",
  "สินทรัพย์ถาวร",
  "งบการเงิน",
];

export default function FiScreen() {
  const [tab, setTab] = useState(TABS[0]);
  const [openEntry, setOpenEntry] = useState(null);
  const bs = balanceSheet();

  return (
    <div>
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">บัญชีการเงิน</h1>
          <p className="text-sm text-slate-500">
            {PERIOD.label} · {JOURNAL.length} รายการในสมุดรายวัน · {ACCOUNTS.length} บัญชี
          </p>
        </div>
        <span className={"rounded-full px-3 py-1.5 text-xs " + (bs.balances ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700")}>
          {bs.balances ? "งบดุลลงตัว" : "งบดุลไม่ลงตัว"}
        </span>
      </div>

      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={
              t === tab
                ? "whitespace-nowrap border-b-2 border-sky-600 px-3 py-2.5 text-[13px] font-medium text-sky-700"
                : "whitespace-nowrap px-3 py-2.5 text-[13px] text-slate-500 hover:text-slate-800"
            }
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "ผังบัญชีและสมุดรายวัน" && <Ledger onOpen={setOpenEntry} />}
      {tab === "เจ้าหนี้การค้า" && <Payables />}
      {tab === "ลูกหนี้การค้า" && <Receivables />}
      {tab === "สินทรัพย์ถาวร" && <FixedAssets />}
      {tab === "งบการเงิน" && <Statements />}

      {openEntry && <EntryDialog entry={openEntry} onClose={() => setOpenEntry(null)} />}

      <div hidden data-fitt-index>
        <button data-fitt-screen="บัญชีการเงิน" />
        <button data-fitt-screen="รายการบัญชีในสมุดรายวัน" data-fitt-modal onClick={() => setOpenEntry(JOURNAL[0])} />
      </div>
    </div>
  );
}

function Card({ title, children }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      {title && <div className="border-b border-slate-100 px-4 py-3 text-sm font-medium text-slate-800">{title}</div>}
      {children}
    </div>
  );
}

function Stat({ label, value, tone }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={"mt-1 text-lg font-semibold " + (tone === "warn" ? "text-amber-700" : tone === "bad" ? "text-rose-600" : "text-slate-900")}>
        {value}
      </div>
    </div>
  );
}

const TH = "px-4 py-3";
function Head({ cols }) {
  return (
    <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
      <tr>{cols.map((c) => <th key={c.k} className={TH + (c.right ? " text-right" : "")}>{c.k}</th>)}</tr>
    </thead>
  );
}

function Ledger({ onOpen }) {
  const tb = trialBalance();
  const unbalanced = JOURNAL.filter((e) => !isBalanced(e));
  return (
    <div className="space-y-4">
      <Card title="ผังบัญชีและยอดคงเหลือ">
        <table className="w-full text-sm">
          <Head cols={[{ k: "รหัสบัญชี" }, { k: "ชื่อบัญชี" }, { k: "ประเภท" }, { k: "เดบิต", right: true }, { k: "เครดิต", right: true }]} />
          <tbody className="divide-y divide-slate-100">
            {tb.map((a) => (
              <tr key={a.code} className="hover:bg-sky-50">
                <td className={TH + " font-mono text-xs text-slate-500"}>{a.code}</td>
                <td className={TH + " font-medium text-slate-900"}>{a.name}</td>
                <td className={TH + " text-slate-600"}>{a.type}</td>
                <td className={TH + " text-right text-slate-700"}>{a.balance > 0 ? baht(a.balance) : "—"}</td>
                <td className={TH + " text-right text-slate-700"}>{a.balance < 0 ? baht(-a.balance) : "—"}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-50">
            <tr>
              <td colSpan={3} className={TH + " text-right text-slate-600"}>รวม — เดบิตต้องเท่าเครดิต</td>
              <td className={TH + " text-right font-semibold text-slate-900"}>
                {baht(tb.filter((a) => a.balance > 0).reduce((n, a) => n + a.balance, 0))}
              </td>
              <td className={TH + " text-right font-semibold text-slate-900"}>
                {baht(-tb.filter((a) => a.balance < 0).reduce((n, a) => n + a.balance, 0))}
              </td>
            </tr>
          </tfoot>
        </table>
      </Card>

      <Card title={"สมุดรายวัน" + (unbalanced.length ? " — มี " + unbalanced.length + " รายการที่ไม่ลงตัว" : "")}>
        <table className="w-full text-sm">
          <Head cols={[{ k: "เลขที่" }, { k: "วันที่" }, { k: "คำอธิบาย" }, { k: "บรรทัด", right: true }, { k: "จำนวนเงิน", right: true }, { k: "ลงตัว" }, { k: "" }]} />
          <tbody className="divide-y divide-slate-100">
            {JOURNAL.map((e) => (
              <tr key={e.no} className="hover:bg-sky-50">
                <td className={TH + " font-mono text-xs text-slate-500"}>{e.no}</td>
                <td className={TH + " text-slate-600"}>{e.date}</td>
                <td className={TH + " font-medium text-slate-900"}>{e.memo}</td>
                <td className={TH + " text-right text-slate-600"}>{e.lines.length}</td>
                <td className={TH + " text-right font-semibold text-slate-900"}>{baht(entryTotal(e))}</td>
                <td className={TH}>
                  <span className={"rounded-full px-2 py-1 text-xs " + (isBalanced(e) ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700")}>
                    {isBalanced(e) ? "ลงตัว" : "ไม่ลงตัว"}
                  </span>
                </td>
                <td className={TH + " text-right"}>
                  <button onClick={() => onOpen(e)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:border-sky-500 hover:text-sky-700">
                    เปิดดู
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function Aging({ rows, nameKey }) {
  return (
    <Card title="อายุหนี้">
      <table className="w-full text-sm">
        <Head cols={[{ k: "ช่วงอายุ" }, { k: "จำนวนรายการ", right: true }, { k: "ยอดเงิน", right: true }]} />
        <tbody className="divide-y divide-slate-100">
          {AGING_BUCKETS.map((b) => {
            const mine = rows.filter((r) => bucketOf(r.overdueDays).label === b.label);
            return (
              <tr key={b.label} className="hover:bg-sky-50">
                <td className={TH + " font-medium text-slate-900"}>{b.label}</td>
                <td className={TH + " text-right text-slate-700"}>{mine.length}</td>
                <td className={TH + " text-right " + (b.max > 0 && mine.length ? "font-semibold text-amber-700" : "text-slate-700")}>
                  {mine.length ? baht(mine.reduce((n, r) => n + r.amount, 0)) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

function Payables() {
  const rows = payables();
  const total = rows.reduce((n, r) => n + r.amount, 0);
  const late = rows.filter((r) => r.overdueDays > 0);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="เจ้าหนี้คงค้าง" value={baht(total)} />
        <Stat label="ผู้ขายที่มียอดค้าง" value={new Set(rows.map((r) => r.vendor)).size + " ราย"} />
        <Stat label="เลยกำหนดชำระ" value={late.length + " ใบ"} tone={late.length ? "warn" : undefined} />
      </div>

      <Card title="ใบแจ้งหนี้ที่ยังไม่ได้จ่าย — ผู้ขายอ่านจากแฟ้มจัดซื้อ">
        <table className="w-full text-sm">
          <Head cols={[{ k: "ใบแจ้งหนี้" }, { k: "ผู้ขาย" }, { k: "อ้างใบสั่งซื้อ" }, { k: "วันที่" }, { k: "เงื่อนไข" }, { k: "ครบกำหนด" }, { k: "ยอดรวมภาษี", right: true }, { k: "สถานะ" }]} />
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.no} className="hover:bg-sky-50">
                <td className={TH + " font-mono text-xs text-slate-500"}>{r.no}</td>
                <td className={TH + " font-medium text-slate-900"}>{r.vendorName}</td>
                <td className={TH + " text-slate-600"}>{r.po}</td>
                <td className={TH + " text-slate-600"}>{r.date}</td>
                <td className={TH + " text-slate-600"}>{r.terms}</td>
                <td className={TH + " text-slate-600"}>{r.due}</td>
                <td className={TH + " text-right font-semibold text-slate-900"}>{baht(r.amount)}</td>
                <td className={TH}>
                  <span className={"rounded-full px-2 py-1 text-xs " + (r.overdueDays > 0 ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700")}>
                    {r.overdueDays > 0 ? "เลยกำหนด " + r.overdueDays + " วัน" : "ยังไม่ถึงกำหนด"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Aging rows={rows} />
    </div>
  );
}

function Receivables() {
  const rows = receivables();
  const total = rows.reduce((n, r) => n + r.amount, 0);
  const late = rows.filter((r) => r.overdueDays > 0);
  const unbilled = rows.filter((r) => !r.billed);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="ลูกหนี้คงค้าง" value={baht(total)} />
        <Stat label="เลยกำหนดรับชำระ" value={late.length + " ราย"} tone={late.length ? "warn" : undefined} />
        <Stat label="ส่งของแล้วยังไม่ออกใบแจ้งหนี้" value={unbilled.length + " ใบ"} tone={unbilled.length ? "warn" : undefined} />
      </div>

      <Card title="ยอดที่ลูกค้ายังไม่ชำระ — ลูกค้าอ่านจากแฟ้มขาย">
        <table className="w-full text-sm">
          <Head cols={[{ k: "ใบสั่งขาย" }, { k: "ลูกค้า" }, { k: "วันที่" }, { k: "เงื่อนไข" }, { k: "ครบกำหนด" }, { k: "ยอดรวมภาษี", right: true }, { k: "ออกใบแจ้งหนี้" }, { k: "สถานะ" }]} />
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.so} className="hover:bg-sky-50">
                <td className={TH + " font-mono text-xs text-slate-500"}>{r.so}</td>
                <td className={TH + " font-medium text-slate-900"}>{r.customerName}</td>
                <td className={TH + " text-slate-600"}>{r.date}</td>
                <td className={TH + " text-slate-600"}>{r.terms}</td>
                <td className={TH + " text-slate-600"}>{r.due}</td>
                <td className={TH + " text-right font-semibold text-slate-900"}>{baht(r.amount)}</td>
                <td className={TH}>
                  {r.billed ? <span className="text-xs text-emerald-700">ออกแล้ว</span> : <span className="text-xs text-amber-700">ยังไม่ออก</span>}
                </td>
                <td className={TH}>
                  <span className={"rounded-full px-2 py-1 text-xs " + (r.overdueDays > 0 ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700")}>
                    {r.overdueDays > 0 ? "เลยกำหนด " + r.overdueDays + " วัน" : "ยังไม่ถึงกำหนด"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Aging rows={rows} />
    </div>
  );
}

function FixedAssets() {
  const cost = ASSETS.reduce((n, a) => n + a.cost, 0);
  const accum = ASSETS.reduce((n, a) => n + accumulated(a), 0);
  const month = ASSETS.reduce((n, a) => n + monthlyDepreciation(a), 0);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <Stat label="ราคาทุนรวม" value={baht(cost)} />
        <Stat label="ค่าเสื่อมราคาสะสม" value={baht(accum)} />
        <Stat label="มูลค่าตามบัญชี" value={baht(cost - accum)} />
        <Stat label="ค่าเสื่อมราคางวดนี้" value={baht(month)} />
      </div>

      <Card title="ทะเบียนสินทรัพย์ — ค่าเสื่อมราคาวิธีเส้นตรง">
        <table className="w-full text-sm">
          <Head cols={[{ k: "รหัส" }, { k: "สินทรัพย์" }, { k: "วันที่ได้มา" }, { k: "อายุใช้งาน", right: true }, { k: "ราคาทุน", right: true }, { k: "ต่อเดือน", right: true }, { k: "สะสม", right: true }, { k: "คงเหลือตามบัญชี", right: true }]} />
          <tbody className="divide-y divide-slate-100">
            {ASSETS.map((a) => {
              const acc = accumulated(a);
              const nbv = a.cost - acc;
              return (
                <tr key={a.code} className="hover:bg-sky-50">
                  <td className={TH + " font-mono text-xs text-slate-500"}>{a.code}</td>
                  <td className={TH + " font-medium text-slate-900"}>{a.name}</td>
                  <td className={TH + " text-slate-600"}>{a.acquired}</td>
                  <td className={TH + " text-right text-slate-600"}>{a.lifeYears} ปี</td>
                  <td className={TH + " text-right text-slate-700"}>{baht(a.cost)}</td>
                  <td className={TH + " text-right text-slate-600"}>{baht(monthlyDepreciation(a))}</td>
                  <td className={TH + " text-right text-slate-600"}>{baht(acc)}</td>
                  <td className={TH + " text-right font-semibold " + (nbv === 0 ? "text-slate-400" : "text-slate-900")}>
                    {nbv === 0 ? "ตัดค่าเสื่อมครบแล้ว" : baht(nbv)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <Card title="อายุการใช้งานที่ผ่านไปแล้ว">
        <ul className="divide-y divide-slate-100">
          {ASSETS.map((a) => {
            const pct = Math.min(100, Math.round((monthsHeld(a) / (a.lifeYears * 12)) * 100));
            return (
              <li key={a.code} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span className="w-48 shrink-0 text-slate-700">{a.name}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <span className={"block h-full rounded-full " + (pct >= 100 ? "bg-slate-400" : "bg-sky-500")} style={{ width: pct + "%" }} />
                </span>
                <span className="w-28 shrink-0 text-right text-xs text-slate-500">{monthsHeld(a)} เดือน · {pct}%</span>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}

function Statements() {
  const pl = profitAndLoss();
  const bs = balanceSheet();
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <Stat label="รายได้" value={baht(pl.revenue)} />
        <Stat label="ค่าใช้จ่าย" value={baht(pl.expenseTotal)} />
        <Stat label={pl.profit >= 0 ? "กำไรสุทธิ" : "ขาดทุนสุทธิ"} value={baht(Math.abs(pl.profit))} tone={pl.profit < 0 ? "bad" : undefined} />
        <Stat label="อัตรากำไรสุทธิ" value={pl.revenue ? Math.round((pl.profit / pl.revenue) * 100) + "%" : "—"} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card title="งบกำไรขาดทุน">
          <dl className="px-4 py-2 text-sm">
            <Row k="รายได้จากการขาย" v={baht(pl.revenue)} />
            <div className="my-1.5 border-t border-slate-100" />
            {pl.expenses.map((e) => <Row key={e.code} k={e.name} v={"(" + baht(e.balance) + ")"} muted />)}
            <Row k="รวมค่าใช้จ่าย" v={"(" + baht(pl.expenseTotal) + ")"} bold />
            <div className="my-1.5 border-t border-slate-100" />
            <Row k={pl.profit >= 0 ? "กำไรสุทธิ" : "ขาดทุนสุทธิ"} v={baht(Math.abs(pl.profit))} bold />
          </dl>
        </Card>

        <Card title="งบแสดงฐานะการเงิน">
          <dl className="px-4 py-2 text-sm">
            <div className="pt-1 text-xs font-medium uppercase tracking-wide text-slate-400">สินทรัพย์</div>
            {bs.assets.map((a) => <Row key={a.code} k={a.name} v={baht(a.balance)} muted />)}
            <Row k="รวมสินทรัพย์" v={baht(bs.assetTotal)} bold />
            <div className="mt-3 pt-1 text-xs font-medium uppercase tracking-wide text-slate-400">หนี้สินและส่วนของเจ้าของ</div>
            {bs.liabilities.map((a) => <Row key={a.code} k={a.name} v={baht(-a.balance)} muted />)}
            {bs.equity.map((a) => <Row key={a.code} k={a.name} v={baht(-a.balance)} muted />)}
            <Row k="กำไรสะสมงวดนี้" v={baht(bs.profit)} muted />
            <Row k="รวมหนี้สินและส่วนของเจ้าของ" v={baht(bs.liabilityTotal + bs.equityTotal + bs.profit)} bold />
          </dl>
        </Card>
      </div>

      <div className={"rounded-xl px-4 py-3.5 text-sm " + (bs.balances ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800")}>
        {bs.balances
          ? "สินทรัพย์เท่ากับหนี้สินบวกส่วนของเจ้าของบวกกำไรงวดนี้ — งบดุลลงตัว"
          : "สินทรัพย์ไม่เท่ากับหนี้สินบวกส่วนของเจ้าของ ต่างกัน " + baht(Math.abs(bs.assetTotal - (bs.liabilityTotal + bs.equityTotal + bs.profit)))}
      </div>
    </div>
  );
}

function Row({ k, v, bold, muted }) {
  return (
    <div className="flex justify-between py-1.5">
      <dt className={bold ? "font-medium text-slate-900" : muted ? "text-slate-600" : "text-slate-700"}>{k}</dt>
      <dd className={bold ? "font-semibold text-slate-900" : "text-slate-800"}>{v}</dd>
    </div>
  );
}

function EntryDialog({ entry, onClose }) {
  return (
    <div role="dialog" aria-modal="true" onClick={onClose} className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div onClick={(e) => e.stopPropagation()} className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{entry.no}</h2>
            <p className="text-sm text-slate-500">{entry.memo} · {entry.date}</p>
          </div>
          <button onClick={onClose} className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100">✕</button>
        </div>

        <table className="mt-4 w-full text-sm">
          <Head cols={[{ k: "บัญชี" }, { k: "เดบิต", right: true }, { k: "เครดิต", right: true }]} />
          <tbody className="divide-y divide-slate-100">
            {entry.lines.map((l, i) => (
              <tr key={i}>
                <td className="py-2.5">
                  <span className="font-mono text-xs text-slate-500">{l.account}</span>
                  <span className="ml-2 text-slate-800">{account(l.account)?.name}</span>
                </td>
                <td className="py-2.5 text-right text-slate-800">{l.amount > 0 ? baht(l.amount) : "—"}</td>
                <td className="py-2.5 text-right text-slate-800">{l.amount < 0 ? baht(-l.amount) : "—"}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-slate-200">
            <tr>
              <td className="py-2.5 font-medium text-slate-900">รวม</td>
              <td className="py-2.5 text-right font-semibold text-slate-900">{baht(entryTotal(entry))}</td>
              <td className="py-2.5 text-right font-semibold text-slate-900">{baht(entryTotal(entry))}</td>
            </tr>
          </tfoot>
        </table>

        <div className={"mt-5 rounded-xl px-4 py-3 text-sm " + (isBalanced(entry) ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800")}>
          {isBalanced(entry) ? "เดบิตเท่ากับเครดิต รายการนี้ลงตัว" : "เดบิตไม่เท่ากับเครดิต ลงบัญชีไม่ได้"}
        </div>
        {entry.ref && <p className="mt-2 text-xs text-slate-500">อ้างอิงเอกสารต้นทาง {entry.ref}</p>}
      </div>
    </div>
  );
}
`;
