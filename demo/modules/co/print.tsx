import type { ReactNode } from "react";
import { PERIOD, TODAY, account } from "../fi/data";
import {
  ALLOCATIONS, ALLOCATION, COMPANY, COST_ESTIMATES, PROFIT_CENTERS, baht, costCenter, costCenterRows, costsOf,
  estimateTotals, internalOrder, ioBalance, marginRows, profitCenterRows, reconcile, settlementsOf,
} from "./data";
import { material } from "../mm/data";
import { Paper } from "../kit";

/**
 * Management reports as the controller files them: a header, one table, the
 * totals, and the lines people sign. Every one of them is built from the same
 * functions the screens call, so the printout and the screen cannot disagree.
 */

export type CoDoc =
  | { doc: "cost-centres" }
  | { doc: "cost-centre"; code: string }
  | { doc: "allocation"; no: string }
  | { doc: "internal-order"; no: string }
  | { doc: "estimate"; no: string }
  | { doc: "margins"; rows: ReturnType<typeof marginRows> }
  | { doc: "profit-centres" };

type Sheet = {
  title: string;
  number: string;
  sub: string;
  facts?: [string, ReactNode][];
  head: string[];
  right: number[];
  rows: ReactNode[][];
  totals?: [string, ReactNode][];
  note?: string;
  signatures: string[];
};

function ReportSheet({ s }: { s: Sheet }) {
  return (
    <Paper>
      <div className="flex flex-wrap items-start justify-between gap-6 border-b-2 border-slate-800 pb-4">
        <div className="min-w-0">
          <p className="text-[16px] font-bold text-slate-900">{COMPANY.name}</p>
          <p className="mt-1 max-w-sm leading-relaxed text-slate-600">{COMPANY.address}</p>
          <p className="text-slate-600">เลขประจำตัวผู้เสียภาษี {COMPANY.taxId}</p>
        </div>
        <div className="text-right">
          <p className="text-[18px] font-bold text-slate-900">{s.title}</p>
          <p className="mt-0.5 text-[11.5px] text-slate-500">{s.sub}</p>
          <dl className="mt-2 grid grid-cols-[auto_auto] justify-end gap-x-3 gap-y-0.5">
            <dt className="text-slate-500">เลขที่</dt>
            <dd className="font-semibold tabular-nums text-slate-900">{s.number}</dd>
            <dt className="text-slate-500">วันที่พิมพ์</dt>
            <dd className="tabular-nums">{TODAY}</dd>
          </dl>
        </div>
      </div>

      {s.facts && (
        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 rounded-md border border-slate-300 p-3 sm:grid-cols-3">
          {s.facts.map(([k, v]) => (
            <div key={k} className="min-w-0">
              <dt className="text-[11px] text-slate-500">{k}</dt>
              <dd className="truncate font-medium text-slate-900">{v}</dd>
            </div>
          ))}
        </dl>
      )}

      <table className="mt-4 w-full border-collapse">
        <thead>
          <tr className="bg-slate-100 text-[11.5px] text-slate-600">
            {s.head.map((h, i) => (
              <th key={h + i} className={"border border-slate-300 px-2 py-1.5 font-medium " + (s.right.includes(i) ? "text-right" : "text-left")}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {s.rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} className={"border border-slate-300 px-2 py-1.5" + (s.right.includes(j) ? " text-right tabular-nums" : "")}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
          {s.rows.length === 0 && (
            <tr>
              <td colSpan={s.head.length} className="border border-slate-300 px-2 py-3 text-center text-slate-500">
                ไม่มีรายการ
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {s.totals && (
        <dl className="ml-auto mt-3 grid max-w-sm grid-cols-[1fr_auto] gap-x-6 gap-y-1">
          {s.totals.map(([k, v], i) => (
            <div key={k} className="contents">
              <dt className={i === s.totals!.length - 1 ? "border-t border-slate-800 pt-1 font-bold text-slate-900" : "text-slate-600"}>{k}</dt>
              <dd className={"text-right tabular-nums " + (i === s.totals!.length - 1 ? "border-t border-slate-800 pt-1 font-bold text-slate-900" : "")}>{v}</dd>
            </div>
          ))}
        </dl>
      )}
      {s.note && <p className="mt-3 leading-relaxed text-slate-600">{s.note}</p>}

      <div className="mt-12 grid gap-8" style={{ gridTemplateColumns: `repeat(${s.signatures.length}, minmax(0, 1fr))` }}>
        {s.signatures.map((n) => (
          <div key={n} className="text-center">
            <div className="mx-auto h-10 w-36 border-b border-dotted border-slate-500" />
            <p className="mt-1.5 text-slate-600">{n}</p>
            <p className="text-[11px] text-slate-400">วันที่ ____/____/______</p>
          </div>
        ))}
      </div>
    </Paper>
  );
}

const stamp = (prefix: string) => `${prefix}-${PERIOD.to.slice(0, 7).replace("-", "")}`;

function sheetFor(d: CoDoc): Sheet {
  if (d.doc === "cost-centres") {
    const rows = costCenterRows();
    const budget = rows.reduce((n, c) => n + c.budget, 0);
    const actual = rows.reduce((n, c) => n + c.actual, 0);
    return {
      title: "รายงานงบเทียบใช้จริงรายศูนย์ต้นทุน", number: stamp("RPT-CC"), sub: PERIOD.label,
      head: ["รหัส", "ศูนย์ต้นทุน", "ผู้รับผิดชอบ", "งบ", "รับตรง", "ปันส่วนเข้า/ออก", "ชำระจากคำสั่งงาน", "ใช้จริง", "ผลต่าง"],
      right: [3, 4, 5, 6, 7, 8],
      rows: rows.map((c) => [c.code, c.name, c.owner, baht(c.budget), baht(c.primary), baht(c.allocIn - c.allocOut), baht(c.settled), baht(c.actual), baht(c.variance)]),
      totals: [["งบรวม", baht(budget)], ["ใช้จริงรวม", baht(actual)], [actual > budget ? "เกินงบ" : "เหลืองบ", baht(Math.abs(budget - actual))]],
      note: "ผลต่าง = งบ − ใช้จริง ติดลบคือใช้เกินงบ ยอดรับตรงกระจายจากบัญชีค่าใช้จ่ายในสมุดรายวันตามสัดส่วนที่ประกาศไว้",
      signatures: ["ผู้จัดทำ (บัญชีบริหาร)", "ผู้อนุมัติ"],
    };
  }
  if (d.doc === "cost-centre") {
    const c = costCenterRows().find((x) => x.code === d.code)!;
    const sources = Object.entries(ALLOCATION)
      .filter(([, shares]) => (shares[c.code] ?? 0) > 0)
      .map(([code, shares]) => [code, account(code).name, Math.round((shares[c.code] ?? 0) * 100) + "%", "รับตรงจากสมุดรายวัน"]);
    const allocs = ALLOCATIONS.flatMap((a) => [
      ...(a.sender === c.code ? [[a.no, "ปันส่วนออก " + a.cycle, "", baht(-a.amount)]] : []),
      ...a.lines.filter((l) => l.costCenter === c.code).map((l) => [a.no, "รับปันส่วนจาก " + costCenter(a.sender).name, "", baht(l.amount)]),
    ]);
    return {
      title: "รายงานศูนย์ต้นทุน", number: `${stamp("RPT")}-${c.code}`, sub: PERIOD.label,
      facts: [["ศูนย์ต้นทุน", `${c.code} · ${c.name}`], ["ผู้รับผิดชอบ", c.owner], ["ศูนย์กำไร", PROFIT_CENTERS.find((p) => p.code === c.profitCenter)?.name ?? c.profitCenter]],
      head: ["อ้างอิง", "รายการ", "สัดส่วน", "จำนวนเงิน"],
      right: [3],
      rows: [...sources.map((r) => [...r.slice(0, 3), ""]), ...allocs],
      totals: [["รับตรงจากบัญชี", baht(c.primary)], ["ปันส่วนสุทธิ", baht(c.allocIn - c.allocOut)], ["ชำระจากคำสั่งงาน", baht(c.settled)], ["งบ", baht(c.budget)], ["ใช้จริง", baht(c.actual)]],
      note: c.over ? `ใช้เกินงบ ${baht(-c.variance)} หัวหน้าศูนย์ต้องชี้แจงในรอบทบทวนงบ` : `เหลืองบ ${baht(c.variance)}`,
      signatures: ["หัวหน้าศูนย์ต้นทุน", "ผู้จัดทำ", "ผู้อนุมัติ"],
    };
  }
  if (d.doc === "allocation") {
    const a = ALLOCATIONS.find((x) => x.no === d.no)!;
    return {
      title: "ใบบันทึกการปันส่วนต้นทุน", number: a.no, sub: `รอบ ${a.cycle} · ${PERIOD.label}`,
      facts: [["ศูนย์ส่ง", `${a.sender} · ${costCenter(a.sender).name}`], ["ยอดที่ปันออก", baht(a.amount)], ["วันที่ลงรายการ", a.date]],
      head: ["ศูนย์รับ", "ชื่อ", "สัดส่วน", "จำนวนเงิน"],
      right: [2, 3],
      rows: a.lines.map((l) => [l.costCenter, costCenter(l.costCenter).name, ((l.amount / a.amount) * 100).toFixed(1) + "%", baht(l.amount)]),
      totals: [["รวมที่ศูนย์รับได้", baht(a.lines.reduce((n, l) => n + l.amount, 0))], ["ยอดของศูนย์ส่งหลังปันส่วน", baht(0)]],
      note: "การปันส่วนย้ายยอดระหว่างศูนย์ต้นทุนภายในบัญชีบริหาร ไม่กระทบยอดในงบการเงิน",
      signatures: ["ผู้จัดทำ", "ผู้ตรวจสอบ"],
    };
  }
  if (d.doc === "internal-order") {
    const o = internalOrder(d.no);
    const rows: ReactNode[][] = [
      ...costsOf(o.no).map((c) => [c.date, c.no, c.text + (c.vendor ? ` · ${c.vendor}` : ""), baht(c.amount)]),
      ...settlementsOf(o.no).map((s) => [s.date, s.no, `ชำระเข้า${s.receiverType} ${s.receiver}`, baht(-s.amount)]),
    ];
    return {
      title: "รายงานคำสั่งงานภายใน", number: o.no, sub: o.status,
      facts: [["ชื่องาน", o.name], ["ศูนย์ต้นทุนเจ้าของงาน", `${o.costCenter} · ${costCenter(o.costCenter).name}`], ["เปิดงาน", o.opened + (o.closedOn ? ` · ปิด ${o.closedOn}` : "")]],
      head: ["วันที่", "เลขที่", "รายการ", "จำนวนเงิน"],
      right: [3],
      rows,
      totals: [["งบที่อนุมัติ", baht(o.budget)], ["ค่าใช้จ่ายสะสม", baht(o.spent)], ["ยอดค้างรอชำระ", baht(ioBalance(o))]],
      signatures: ["ผู้รับผิดชอบงาน", "ผู้จัดทำ", "ผู้อนุมัติ"],
    };
  }
  if (d.doc === "estimate") {
    const e = COST_ESTIMATES.find((x) => x.no === d.no)!;
    const t = estimateTotals(e);
    const m = material(e.material);
    return {
      title: "แผ่นคำนวณต้นทุนผลิตภัณฑ์", number: e.no, sub: e.status + (e.validFrom ? ` · มีผล ${e.validFrom}` : ""),
      facts: [["สินค้า", `${m.code} · ${m.name}`], ["หน่วย", m.unit], ["คำนวณเมื่อ", e.date]],
      head: ["องค์ประกอบ", "ฐาน", "อัตรา", "ต่อหน่วย"],
      right: [2, 3],
      rows: [
        ["วัตถุดิบ", "สูตรการผลิต", "", baht(e.materialCost)],
        ["ค่าแรงและเครื่องจักร", "ขั้นตอนการผลิต", "", baht(e.labourCost)],
        ...t.lines.map((l) => [l.name, "ต้นทุนทางตรง", Math.round(l.rate * 100) + "%", baht(l.amount)]),
      ],
      totals: [["ต้นทุนทางตรง", baht(t.direct)], ["ค่าใช้จ่ายทางอ้อม", baht(t.overhead)], ["ต้นทุนรวมต่อหน่วย", baht(t.total)]],
      note: e.note || undefined,
      signatures: ["ผู้คำนวณ", "ผู้อนุมัติต้นทุนมาตรฐาน"],
    };
  }
  if (d.doc === "margins") {
    const revenue = d.rows.reduce((n, m) => n + m.revenue, 0);
    const cost = d.rows.reduce((n, m) => n + m.cost, 0);
    return {
      title: "รายงานกำไรขั้นต้นรายใบสั่งขาย", number: stamp("RPT-GM"), sub: PERIOD.label,
      head: ["ใบสั่งขาย", "ลูกค้า", "ช่องทาง", "รายได้สุทธิ", "ต้นทุน", "กำไรขั้นต้น", "อัตรา"],
      right: [3, 4, 5, 6],
      rows: d.rows.map((m) => [m.so, m.customerName, m.channel, baht(m.revenue), baht(m.cost), baht(m.margin), m.pct + "%"]),
      totals: [["รายได้สุทธิ", baht(revenue)], ["ต้นทุนผลิตภัณฑ์", baht(cost)], ["กำไรขั้นต้น", baht(revenue - cost)]],
      note: "รายได้จากใบกำกับภาษีหักใบลดหนี้ ต้นทุนคือต้นทุนมาตรฐานบวกค่าใช้จ่ายทางอ้อมตามอัตรา",
      signatures: ["ผู้จัดทำ", "ผู้จัดการฝ่ายขาย"],
    };
  }
  const rows = profitCenterRows();
  const r = reconcile();
  return {
    title: "งบกำไรขาดทุนตามศูนย์กำไร", number: stamp("RPT-PC"), sub: PERIOD.label,
    head: ["ศูนย์กำไร", "รายได้", "ต้นทุนสินค้า", "กำไรขั้นต้น", "ทางอ้อมที่เหลือ", "ผลสุทธิ"],
    right: [1, 2, 3, 4, 5],
    rows: rows.map((p) => [`${p.code} · ${p.name}`, baht(p.revenue), baht(p.productCost), baht(p.grossMargin), baht(p.unabsorbed), baht(p.result)]),
    totals: [["รวมทุกศูนย์กำไร", baht(r.centres)], ["กำไร (ขาดทุน) สุทธิในงบการเงิน", baht(r.company)], ["ผลต่าง", baht(r.company - r.centres)]],
    note: r.tiesOut ? "ผลรวมทุกศูนย์กำไรตรงกับงบการเงิน" : "มีผลต่างกับงบการเงิน ดูรายการกระทบยอดในหน้าศูนย์กำไร",
    signatures: ["ผู้จัดทำ", "ผู้อนุมัติ"],
  };
}

export function CoReport({ d }: { d: CoDoc }) {
  return <ReportSheet s={sheetFor(d)} />;
}
