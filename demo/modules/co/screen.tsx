import { useState } from "react";
import {
  PROFIT_CENTERS, COST_CENTERS, ALLOCATION, INTERNAL_ORDERS, OVERHEAD, FINISHED_GOODS,
  baht, costCenterRows, productCost, marginRows, byChannel, profitCenterRows, companyResult,
} from "./data";

type CostCentre = ReturnType<typeof costCenterRows>[number];
import { Card, Stat, Head, Row, TH } from "../ui";

const TABS = [
  "ศูนย์ต้นทุน",
  "คำสั่งงานภายใน",
  "ต้นทุนผลิตภัณฑ์",
  "วิเคราะห์กำไรขั้นต้น",
  "ศูนย์กำไร",
];

export default function CoScreen({ section }: { section?: string }) {
  // Which capability to show is the navigation's decision, not this screen's.
  const tab = section && TABS.includes(section) ? section : TABS[0];
  const [openCc, setOpenCc] = useState<CostCentre | null>(null);
  const over = costCenterRows().filter((c) => c.over);

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-slate-900">บัญชีบริหารและต้นทุน</h1>
        <p className="text-sm text-slate-500">
          {COST_CENTERS.length} ศูนย์ต้นทุน · {PROFIT_CENTERS.length} ศูนย์กำไร · เกินงบ {over.length} ศูนย์
        </p>
      </div>

      {tab === "ศูนย์ต้นทุน" && <CostCenters onOpen={setOpenCc} />}
      {tab === "คำสั่งงานภายใน" && <InternalOrders />}
      {tab === "ต้นทุนผลิตภัณฑ์" && <ProductCosting />}
      {tab === "วิเคราะห์กำไรขั้นต้น" && <Profitability />}
      {tab === "ศูนย์กำไร" && <ProfitCenters />}

      {openCc && <CcDialog cc={openCc} onClose={() => setOpenCc(null)} />}

      <div hidden data-fitt-index>
        <button data-fitt-screen="บัญชีบริหารและต้นทุน" />
        <button data-fitt-screen="ที่มาของต้นทุนศูนย์" data-fitt-modal onClick={() => setOpenCc(costCenterRows()[0])} />
      </div>
    </div>
  );
}

function CostCenters({ onOpen }: { onOpen: (cc: CostCentre) => void }) {
  const rows = costCenterRows();
  const budget = rows.reduce((n, r) => n + r.budget, 0);
  const actual = rows.reduce((n, r) => n + r.actual, 0);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="งบที่ตั้งไว้" value={baht(budget)} />
        <Stat label="ใช้จริงจากสมุดรายวัน" value={baht(actual)} />
        <Stat
          label={actual > budget ? "เกินงบ" : "เหลืองบ"}
          value={baht(Math.abs(budget - actual))}
          tone={actual > budget ? "bad" : undefined}
        />
      </div>

      <Card title="ศูนย์ต้นทุน — ยอดใช้จริงกระจายมาจากบัญชีค่าใช้จ่ายตามสัดส่วนที่ประกาศไว้">
        <table className="w-full text-sm">
          <Head cols={[{ k: "รหัส" }, { k: "ศูนย์ต้นทุน" }, { k: "ผู้รับผิดชอบ" }, { k: "ศูนย์กำไร" }, { k: "งบ", right: true }, { k: "ใช้จริง", right: true }, { k: "ต่าง", right: true }, { k: "การใช้งบ" }, { k: "" }]} />
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.code} className="hover:bg-sky-50">
                <td className={TH + " font-mono text-xs text-slate-500"}>{r.code}</td>
                <td className={TH + " font-medium text-slate-900"}>{r.name}</td>
                <td className={TH + " text-slate-600"}>{r.owner}</td>
                <td className={TH + " text-slate-600"}>{PROFIT_CENTERS.find((p) => p.code === r.profitCenter)?.name}</td>
                <td className={TH + " text-right text-slate-600"}>{baht(r.budget)}</td>
                <td className={TH + " text-right text-slate-700"}>{baht(r.actual)}</td>
                <td className={TH + " text-right font-semibold " + (r.over ? "text-rose-600" : "text-emerald-700")}>
                  {(r.variance >= 0 ? "+" : "−") + baht(Math.abs(r.variance))}
                </td>
                <td className={TH}>
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-20 overflow-hidden rounded-full bg-slate-100">
                      <span
                        className={"block h-full rounded-full " + (r.pct > 100 ? "bg-rose-500" : r.pct > 85 ? "bg-amber-500" : "bg-emerald-500")}
                        style={{ width: Math.min(100, r.pct) + "%" }}
                      />
                    </span>
                    <span className="text-xs text-slate-600">{r.pct}%</span>
                  </span>
                </td>
                <td className={TH + " text-right"}>
                  <button onClick={() => onOpen(r)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:border-sky-500 hover:text-sky-700">
                    ที่มา
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

function InternalOrders() {
  const open = INTERNAL_ORDERS.filter((o) => o.status !== "ปิดงานแล้ว");
  const over = INTERNAL_ORDERS.filter((o) => o.spent > o.budget);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="งานที่เปิดอยู่" value={open.length + " งาน"} />
        <Stat label="งบที่จองไว้ทั้งหมด" value={baht(INTERNAL_ORDERS.reduce((n, o) => n + o.budget, 0))} />
        <Stat label="งานที่ใช้เกินงบ" value={over.length + " งาน"} tone={over.length ? "bad" : undefined} />
      </div>

      <Card title="คำสั่งงานภายใน — เก็บค่าใช้จ่ายของงานชั่วคราวแยกจากงบประจำ">
        <table className="w-full text-sm">
          <Head cols={[{ k: "เลขที่" }, { k: "ชื่องาน" }, { k: "ศูนย์ต้นทุน" }, { k: "เปิดงาน" }, { k: "งบ", right: true }, { k: "ใช้ไป", right: true }, { k: "คงเหลือ", right: true }, { k: "สถานะ" }]} />
          <tbody className="divide-y divide-slate-100">
            {INTERNAL_ORDERS.map((o) => {
              const left = o.budget - o.spent;
              return (
                <tr key={o.no} className="hover:bg-sky-50">
                  <td className={TH + " font-mono text-xs text-slate-500"}>{o.no}</td>
                  <td className={TH + " font-medium text-slate-900"}>{o.name}</td>
                  <td className={TH + " text-slate-600"}>{COST_CENTERS.find((c) => c.code === o.costCenter)?.name}</td>
                  <td className={TH + " text-slate-600"}>{o.opened}</td>
                  <td className={TH + " text-right text-slate-600"}>{baht(o.budget)}</td>
                  <td className={TH + " text-right text-slate-700"}>{baht(o.spent)}</td>
                  <td className={TH + " text-right font-semibold " + (left < 0 ? "text-rose-600" : "text-slate-900")}>
                    {(left >= 0 ? "" : "−") + baht(Math.abs(left))}
                  </td>
                  <td className={TH}>
                    <span className={"rounded-full px-2 py-1 text-xs " + (
                      o.spent > o.budget ? "bg-rose-50 text-rose-700"
                      : o.status === "ปิดงานแล้ว" ? "bg-slate-100 text-slate-600" : "bg-sky-50 text-sky-700"
                    )}>
                      {o.spent > o.budget ? "เกินงบ" : o.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function ProductCosting() {
  const [pick, setPick] = useState(FINISHED_GOODS[0]?.code);
  const c = productCost(pick);
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {FINISHED_GOODS.map((m) => (
          <button
            key={m.code}
            onClick={() => setPick(m.code)}
            className={"rounded-lg px-3 py-2 text-sm " + (m.code === pick ? "bg-sky-600 text-white" : "border border-slate-300 text-slate-600 hover:border-sky-400")}
          >
            {m.name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="ต้นทุนทางตรง" value={baht(c.direct)} />
        <Stat label="ค่าใช้จ่ายทางอ้อม" value={baht(c.overhead)} />
        <Stat label="ต้นทุนรวมต่อหน่วย" value={baht(c.total)} />
      </div>

      <Card title="แผ่นคำนวณต้นทุน">
        <table className="w-full text-sm">
          <Head cols={[{ k: "รายการ" }, { k: "ฐานคำนวณ" }, { k: "อัตรา", right: true }, { k: "จำนวนเงิน", right: true }]} />
          <tbody className="divide-y divide-slate-100">
            <tr className="hover:bg-sky-50">
              <td className={TH + " font-medium text-slate-900"}>ต้นทุนทางตรง (ราคามาตรฐานจากแฟ้มวัสดุ)</td>
              <td className={TH + " text-slate-500"}>—</td>
              <td className={TH + " text-right text-slate-500"}>—</td>
              <td className={TH + " text-right text-slate-900"}>{baht(c.direct)}</td>
            </tr>
            {c.lines.map((l) => (
              <tr key={l.code} className="hover:bg-sky-50">
                <td className={TH + " font-medium text-slate-900"}>{l.name}</td>
                <td className={TH + " text-slate-600"}>{l.base}</td>
                <td className={TH + " text-right text-slate-600"}>{(l.rate * 100).toFixed(0)}%</td>
                <td className={TH + " text-right text-slate-900"}>{baht(l.amount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-50">
            <tr>
              <td colSpan={3} className={TH + " text-right font-medium text-slate-900"}>ต้นทุนรวมต่อ 1 {c.unit}</td>
              <td className={TH + " text-right text-base font-semibold text-slate-900"}>{baht(c.total)}</td>
            </tr>
          </tfoot>
        </table>
      </Card>

      <Card title="ต้นทุนทุกสินค้า">
        <table className="w-full text-sm">
          <Head cols={[{ k: "สินค้า" }, { k: "ทางตรง", right: true }, ...OVERHEAD.map((o) => ({ k: o.name, right: true })), { k: "รวม", right: true }]} />
          <tbody className="divide-y divide-slate-100">
            {FINISHED_GOODS.map((m) => {
              const pc = productCost(m.code);
              return (
                <tr key={m.code} className="hover:bg-sky-50">
                  <td className={TH + " font-medium text-slate-900"}>{m.name}</td>
                  <td className={TH + " text-right text-slate-700"}>{baht(pc.direct)}</td>
                  {pc.lines.map((l) => <td key={l.code} className={TH + " text-right text-slate-600"}>{baht(l.amount)}</td>)}
                  <td className={TH + " text-right font-semibold text-slate-900"}>{baht(pc.total)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function Profitability() {
  const rows = marginRows();
  const channels = byChannel();
  const revenue = rows.reduce((n, r) => n + r.revenue, 0);
  const margin = rows.reduce((n, r) => n + r.margin, 0);
  const worst = rows.reduce((a, b) => (b.pct < a.pct ? b : a), rows[0]);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="รายได้ก่อนภาษี" value={baht(revenue)} />
        <Stat label="กำไรขั้นต้น" value={baht(margin)} tone={margin < 0 ? "bad" : undefined} />
        <Stat label="ใบที่กำไรต่ำที่สุด" value={worst ? worst.pct + "% · " + worst.so : "—"} tone={worst && worst.pct < 15 ? "warn" : undefined} />
      </div>

      <Card title="กำไรขั้นต้นตามช่องทางขาย">
        <table className="w-full text-sm">
          <Head cols={[{ k: "ช่องทาง" }, { k: "ใบสั่งขาย", right: true }, { k: "รายได้", right: true }, { k: "ต้นทุน", right: true }, { k: "กำไรขั้นต้น", right: true }, { k: "อัตรากำไร" }]} />
          <tbody className="divide-y divide-slate-100">
            {channels.map((c) => (
              <tr key={c.channel} className="hover:bg-sky-50">
                <td className={TH + " font-medium text-slate-900"}>{c.channel}</td>
                <td className={TH + " text-right text-slate-700"}>{c.orders}</td>
                <td className={TH + " text-right text-slate-700"}>{baht(c.revenue)}</td>
                <td className={TH + " text-right text-slate-600"}>{baht(c.cost)}</td>
                <td className={TH + " text-right font-semibold " + (c.margin < 0 ? "text-rose-600" : "text-slate-900")}>{baht(c.margin)}</td>
                <td className={TH}>
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-20 overflow-hidden rounded-full bg-slate-100">
                      <span
                        className={"block h-full rounded-full " + (c.pct < 0 ? "bg-rose-500" : c.pct < 15 ? "bg-amber-500" : "bg-emerald-500")}
                        style={{ width: Math.max(0, Math.min(100, c.pct)) + "%" }}
                      />
                    </span>
                    <span className="text-xs text-slate-600">{c.pct}%</span>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card title="กำไรขั้นต้นรายใบสั่งขาย">
        <table className="w-full text-sm">
          <Head cols={[{ k: "ใบสั่งขาย" }, { k: "ลูกค้า" }, { k: "ช่องทาง" }, { k: "รายได้", right: true }, { k: "ต้นทุน", right: true }, { k: "กำไรขั้นต้น", right: true }, { k: "อัตรา", right: true }]} />
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.so} className="hover:bg-sky-50">
                <td className={TH + " font-mono text-xs text-slate-500"}>{r.so}</td>
                <td className={TH + " font-medium text-slate-900"}>{r.customerName}</td>
                <td className={TH + " text-slate-600"}>{r.channel}</td>
                <td className={TH + " text-right text-slate-700"}>{baht(r.revenue)}</td>
                <td className={TH + " text-right text-slate-600"}>{baht(r.cost)}</td>
                <td className={TH + " text-right font-semibold " + (r.margin < 0 ? "text-rose-600" : "text-slate-900")}>{baht(r.margin)}</td>
                <td className={TH + " text-right " + (r.pct < 15 ? "font-semibold text-amber-700" : "text-slate-700")}>{r.pct}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function ProfitCenters() {
  const rows = profitCenterRows();
  const company = companyResult();
  const total = Math.round(rows.reduce((n, r) => n + r.result, 0));
  // ปัดเศษต่อหน่วยทำให้ต่างได้ไม่กี่บาท ถือว่าตรงถ้าไม่เกินหนึ่งในพัน
  const tiesOut = Math.abs(total - company) <= Math.max(100, Math.abs(company) * 0.001);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="กำไรขั้นต้นรวม" value={baht(rows.reduce((n, r) => n + r.grossMargin, 0))} />
        <Stat label="ทางอ้อมที่ยังไม่ถูกดูดเข้าต้นทุน" value={baht(Math.round(rows.reduce((n, r) => n + r.unabsorbed, 0)))} />
        <Stat
          label={company >= 0 ? "กำไรสุทธิทั้งบริษัท" : "ขาดทุนสุทธิทั้งบริษัท"}
          value={baht(Math.abs(company))}
          tone={company < 0 ? "bad" : undefined}
        />
      </div>

      <Card title="ศูนย์กำไร — กำไรขั้นต้นที่ช่องทางนำมาให้ ลบค่าใช้จ่ายทางอ้อมของศูนย์ต้นทุนที่สังกัดอยู่">
        <table className="w-full text-sm">
          <Head cols={[{ k: "ศูนย์กำไร" }, { k: "ศูนย์ต้นทุนที่สังกัด" }, { k: "รายได้", right: true }, { k: "ต้นทุนสินค้า", right: true }, { k: "กำไรขั้นต้น", right: true }, { k: "ทางอ้อมที่ปันเข้า", right: true }, { k: "คิดกลับเข้าต้นทุนแล้ว", right: true }, { k: "ผลการดำเนินงาน", right: true }]} />
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.code} className="hover:bg-sky-50">
                <td className={TH + " font-medium text-slate-900"}>{r.name}</td>
                <td className={TH + " text-slate-600"}>
                  {COST_CENTERS.filter((c) => c.profitCenter === r.code).map((c) => c.name).join(", ") || "—"}
                </td>
                <td className={TH + " text-right text-slate-700"}>{r.revenue ? baht(r.revenue) : "—"}</td>
                <td className={TH + " text-right text-slate-600"}>{r.productCost ? baht(r.productCost) : "—"}</td>
                <td className={TH + " text-right text-slate-700"}>{r.grossMargin ? baht(r.grossMargin) : "—"}</td>
                <td className={TH + " text-right text-slate-600"}>{baht(Math.round(r.overhead))}</td>
                <td className={TH + " text-right text-slate-500"}>{r.absorbed ? "(" + baht(Math.round(r.absorbed)) + ")" : "—"}</td>
                <td className={TH + " text-right font-semibold " + (r.result < 0 ? "text-rose-600" : "text-emerald-700")}>
                  {(r.result >= 0 ? "" : "−") + baht(Math.abs(Math.round(r.result)))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className={"rounded-xl px-4 py-3.5 text-sm " + (tiesOut ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800")}>
        {tiesOut
          ? "ผลรวมของทุกศูนย์กำไร " + baht(total) + " ตรงกับ" + (company >= 0 ? "กำไร" : "ขาดทุน") + "สุทธิในงบการเงิน — ปันส่วนครบ ไม่มีค่าใช้จ่ายตกหล่นหรือนับซ้ำ"
          : "ผลรวมของทุกศูนย์กำไร " + baht(total) + " ต่างจากงบการเงิน " + baht(Math.abs(total - company)) + " — ตรวจสัดส่วนการปันส่วน"}
      </div>
    </div>
  );
}

function CcDialog({ cc, onClose }: { cc: CostCentre; onClose: () => void }) {
  const lines = Object.entries(ALLOCATION)
    .map(([account, shares]) => ({ account, share: shares[cc.code] ?? 0 }))
    .filter((l) => l.share > 0);
  return (
    <div role="dialog" aria-modal="true" onClick={onClose} className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{cc.name}</h2>
            <p className="text-sm text-slate-500">{cc.code} · {cc.owner}</p>
          </div>
          <button onClick={onClose} className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100">✕</button>
        </div>

        <div className="mt-4 text-xs font-medium uppercase tracking-wide text-slate-400">ที่มาของยอดใช้จริง</div>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-slate-100">
            {lines.map((l) => (
              <tr key={l.account}>
                <td className="py-2.5">
                  <span className="font-mono text-xs text-slate-500">{l.account}</span>
                </td>
                <td className="py-2.5 text-right text-slate-600">รับมา {(l.share * 100).toFixed(0)}%</td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl className="mt-4 divide-y divide-slate-100 text-sm">
          <Row k="งบที่ตั้งไว้" v={baht(cc.budget)} />
          <Row k="ใช้จริง" v={baht(cc.actual)} />
        </dl>
        <div className={"mt-4 rounded-xl px-4 py-3.5 text-sm " + (cc.over ? "bg-rose-50 text-rose-800" : "bg-emerald-50 text-emerald-800")}>
          {cc.over
            ? "ใช้เกินงบไป " + baht(-cc.variance) + " คิดเป็น " + (cc.pct - 100) + "% ของงบที่ตั้งไว้"
            : "ยังเหลืองบอีก " + baht(cc.variance) + " ใช้ไปแล้ว " + cc.pct + "%"}
        </div>
      </div>
    </div>
  );
}

