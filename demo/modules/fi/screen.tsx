import { useState } from "react";
import {
  PERIOD, ACCOUNTS, ASSETS, JOURNAL, VENDORS, CUSTOMERS, AGING_BUCKETS,
  account, baht, entryTotal, isBalanced, trialBalance,
  profitAndLoss, balanceSheet, payables, receivables, bucketOf,
  monthlyDepreciation, accumulated, monthsHeld,
} from "./data";
import type { JournalEntry } from "./data";

type Aged = { amount: number; overdueDays: number };
import { Card, Stat, Head, Row, TH } from "../ui";

const TABS = [
  "ผังบัญชีและสมุดรายวัน",
  "เจ้าหนี้การค้า",
  "ลูกหนี้การค้า",
  "สินทรัพย์ถาวร",
  "งบการเงิน",
];

export default function FiScreen() {
  const [tab, setTab] = useState(TABS[0]);
  const [openEntry, setOpenEntry] = useState<JournalEntry | null>(null);
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

function Ledger({ onOpen }: { onOpen: (e: JournalEntry) => void }) {
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

function Aging({ rows }: { rows: Aged[] }) {
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

function EntryDialog({ entry, onClose }: { entry: JournalEntry; onClose: () => void }) {
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
