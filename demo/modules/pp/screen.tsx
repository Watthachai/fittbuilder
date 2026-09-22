import { useState } from "react";
import { material } from "../mm/data";
import {
  PRODUCTS, BOM, WORK_CENTERS, ROUTING, DEMAND, ORDERS,
  product, workCenter, baht, runMrp, loadOf, unitCost,
} from "./data";
import type { ProductionOrder } from "./data";
import { Card, Stat, Head, Row, TH } from "../ui";

const TABS = [
  "ข้อมูลหลักการผลิต",
  "วางแผนความต้องการวัสดุ",
  "วางแผนกำลังการผลิต",
  "ใบสั่งผลิต",
  "รายงานผลการผลิต",
];

export default function PpScreen() {
  const [tab, setTab] = useState(TABS[0]);
  const [openOrder, setOpenOrder] = useState<ProductionOrder | null>(null);
  const short = runMrp().filter((r) => r.shortage > 0);

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-slate-900">วางแผนการผลิต</h1>
        <p className="text-sm text-slate-500">
          {PRODUCTS.length} สินค้า · {ORDERS.filter((o) => o.status !== "ปิดงานแล้ว").length} ใบสั่งผลิตที่เปิดอยู่ · วัสดุขาด {short.length} รายการ
        </p>
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

      {tab === "ข้อมูลหลักการผลิต" && <MasterData />}
      {tab === "วางแผนความต้องการวัสดุ" && <Mrp />}
      {tab === "วางแผนกำลังการผลิต" && <Capacity />}
      {tab === "ใบสั่งผลิต" && <Orders onOpen={setOpenOrder} />}
      {tab === "รายงานผลการผลิต" && <Reports />}

      {openOrder && <OrderDialog order={openOrder} onClose={() => setOpenOrder(null)} />}

      <div hidden data-fitt-index>
        <button data-fitt-screen="วางแผนการผลิต" />
        <button data-fitt-screen="ใบสั่งผลิตและต้นทุน" data-fitt-modal onClick={() => setOpenOrder(ORDERS[0])} />
      </div>
    </div>
  );
}

function MasterData() {
  const [pick, setPick] = useState(PRODUCTS[0].code);
  const cost = unitCost(pick);
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {PRODUCTS.map((p) => (
          <button
            key={p.code}
            onClick={() => setPick(p.code)}
            className={"rounded-lg px-3 py-2 text-sm " + (p.code === pick ? "bg-sky-600 text-white" : "border border-slate-300 text-slate-600 hover:border-sky-400")}
          >
            {p.name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="ต้นทุนวัสดุต่อหน่วย" value={baht(cost.material)} />
        <Stat label="ค่าแรงต่อหน่วย" value={baht(cost.labour)} />
        <Stat label="ต้นทุนรวมต่อหน่วย" value={baht(cost.total)} />
      </div>

      <Card title="สูตรการผลิต — ผลิตหนึ่งหน่วยใช้อะไรบ้าง">
        <table className="w-full text-sm">
          <Head cols={[{ k: "วัสดุ" }, { k: "ใช้ต่อหน่วย", right: true }, { k: "ราคาวัสดุ", right: true }, { k: "เป็นเงิน", right: true }]} />
          <tbody className="divide-y divide-slate-100">
            {BOM[pick].map((l) => {
              const m = material(l.material);
              return (
                <tr key={l.material} className="hover:bg-sky-50">
                  <td className={TH + " font-medium text-slate-900"}>{m?.name}</td>
                  <td className={TH + " text-right text-slate-700"}>{l.qty} {m?.unit}</td>
                  <td className={TH + " text-right text-slate-600"}>{baht(m?.price ?? 0)}</td>
                  <td className={TH + " text-right text-slate-900"}>{baht(l.qty * (m?.price ?? 0))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <Card title="ขั้นตอนการผลิตและศูนย์งาน">
        <table className="w-full text-sm">
          <Head cols={[{ k: "ลำดับ" }, { k: "ศูนย์งาน" }, { k: "ชั่วโมงต่อหน่วย", right: true }, { k: "ค่าแรงต่อชั่วโมง", right: true }, { k: "เป็นเงิน", right: true }]} />
          <tbody className="divide-y divide-slate-100">
            {ROUTING[pick].map((r, i) => {
              const w = workCenter(r.wc);
              return (
                <tr key={r.wc} className="hover:bg-sky-50">
                  <td className={TH + " text-slate-500"}>{i + 1}</td>
                  <td className={TH + " font-medium text-slate-900"}>{w.name}</td>
                  <td className={TH + " text-right text-slate-700"}>{r.hrs}</td>
                  <td className={TH + " text-right text-slate-600"}>{baht(w.costPerHr)}</td>
                  <td className={TH + " text-right text-slate-900"}>{baht(r.hrs * w.costPerHr)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function Mrp() {
  const rows = runMrp();
  const toBuy = rows.filter((r) => r.shortage > 0);
  const cost = toBuy.reduce((n, r) => n + r.shortage * r.price, 0);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="ความต้องการที่รับมา" value={DEMAND.reduce((n, d) => n + d.qty, 0) + " หน่วย"} />
        <Stat label="วัสดุที่ต้องซื้อเพิ่ม" value={toBuy.length + " รายการ"} tone={toBuy.length ? "warn" : undefined} />
        <Stat label="เงินที่ต้องเตรียม" value={baht(cost)} />
      </div>

      <Card title="ความต้องการที่ป้อนเข้าแผน">
        <table className="w-full text-sm">
          <Head cols={[{ k: "สินค้า" }, { k: "จำนวน", right: true }, { k: "กำหนดส่ง" }]} />
          <tbody className="divide-y divide-slate-100">
            {DEMAND.map((d) => (
              <tr key={d.product} className="hover:bg-sky-50">
                <td className={TH + " font-medium text-slate-900"}>{product(d.product)?.name}</td>
                <td className={TH + " text-right text-slate-700"}>{d.qty} {product(d.product)?.unit}</td>
                <td className={TH + " text-slate-600"}>{d.dueDate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card title="กางสูตรแล้วหักสต็อก — ที่เหลือคือของที่ต้องเปิดใบขอซื้อ">
        <table className="w-full text-sm">
          <Head cols={[{ k: "วัสดุ" }, { k: "ต้องใช้", right: true }, { k: "มีในคลัง", right: true }, { k: "ต้องซื้อเพิ่ม", right: true }, { k: "เป็นเงิน", right: true }]} />
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.code} className="hover:bg-sky-50">
                <td className={TH + " font-medium text-slate-900"}>{r.name}</td>
                <td className={TH + " text-right text-slate-700"}>{r.required.toLocaleString("th-TH")} {r.unit}</td>
                <td className={TH + " text-right text-slate-600"}>{r.onHand.toLocaleString("th-TH")}</td>
                <td className={TH + " text-right " + (r.shortage ? "font-semibold text-amber-700" : "text-slate-400")}>
                  {r.shortage ? r.shortage.toLocaleString("th-TH") : "พอ"}
                </td>
                <td className={TH + " text-right text-slate-700"}>{r.shortage ? baht(r.shortage * r.price) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function Capacity() {
  const rows = WORK_CENTERS.map((w) => {
    const load = loadOf(w.code);
    return { w, load, pct: Math.round((load / w.capacityHrs) * 100) };
  });
  const over = rows.filter((r) => r.pct > 100);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="กำลังการผลิตรวม" value={WORK_CENTERS.reduce((n, w) => n + w.capacityHrs, 0) + " ชม."} />
        <Stat label="ชั่วโมงที่ถูกจองแล้ว" value={Math.round(rows.reduce((n, r) => n + r.load, 0)) + " ชม."} />
        <Stat label="ศูนย์งานที่เกินกำลัง" value={over.length + " แห่ง"} tone={over.length ? "warn" : undefined} />
      </div>

      <Card title="ภาระงานเทียบกำลังการผลิต — เกิน 100% ต้องเลื่อนใบสั่งผลิตหรือเพิ่มกะ">
        <table className="w-full text-sm">
          <Head cols={[{ k: "ศูนย์งาน" }, { k: "กำลังต่อสัปดาห์", right: true }, { k: "ถูกจองแล้ว", right: true }, { k: "การใช้กำลัง" }, { k: "ผล" }]} />
          <tbody className="divide-y divide-slate-100">
            {rows.map(({ w, load, pct }) => (
              <tr key={w.code} className="hover:bg-sky-50">
                <td className={TH + " font-medium text-slate-900"}>{w.name}</td>
                <td className={TH + " text-right text-slate-600"}>{w.capacityHrs} ชม.</td>
                <td className={TH + " text-right text-slate-700"}>{load.toFixed(1)} ชม.</td>
                <td className={TH}>
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-28 overflow-hidden rounded-full bg-slate-100">
                      <span
                        className={"block h-full rounded-full " + (pct > 100 ? "bg-rose-500" : pct > 85 ? "bg-amber-500" : "bg-emerald-500")}
                        style={{ width: Math.min(100, pct) + "%" }}
                      />
                    </span>
                    <span className="text-xs text-slate-600">{pct}%</span>
                  </span>
                </td>
                <td className={TH}>
                  {pct > 100
                    ? <span className="rounded-full bg-rose-50 px-2 py-1 text-xs text-rose-700">เกินกำลัง</span>
                    : <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-700">รับไหว</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function Orders({ onOpen }: { onOpen: (o: ProductionOrder) => void }) {
  return (
    <Card title="ใบสั่งผลิต">
      <table className="w-full text-sm">
        <Head cols={[{ k: "เลขที่" }, { k: "สินค้า" }, { k: "จำนวน", right: true }, { k: "เริ่ม" }, { k: "กำหนดเสร็จ" }, { k: "ความคืบหน้า" }, { k: "สถานะ" }, { k: "" }]} />
        <tbody className="divide-y divide-slate-100">
          {ORDERS.map((o) => {
            const pct = Math.round((o.done / o.qty) * 100);
            return (
              <tr key={o.no} className="hover:bg-sky-50">
                <td className={TH + " font-mono text-xs text-slate-500"}>{o.no}</td>
                <td className={TH + " font-medium text-slate-900"}>{product(o.product)?.name}</td>
                <td className={TH + " text-right text-slate-700"}>{o.qty}</td>
                <td className={TH + " text-slate-600"}>{o.start}</td>
                <td className={TH + " text-slate-600"}>{o.due}</td>
                <td className={TH}>
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-20 overflow-hidden rounded-full bg-slate-100">
                      <span className="block h-full rounded-full bg-sky-500" style={{ width: pct + "%" }} />
                    </span>
                    <span className="text-xs text-slate-600">{o.done}/{o.qty}</span>
                  </span>
                </td>
                <td className={TH}>
                  <span className={"rounded-full px-2 py-1 text-xs " + (
                    o.status === "ปิดงานแล้ว" ? "bg-slate-100 text-slate-600"
                    : o.status === "กำลังผลิต" ? "bg-sky-50 text-sky-700"
                    : o.status === "ปล่อยงานแล้ว" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                  )}>{o.status}</span>
                </td>
                <td className={TH + " text-right"}>
                  <button onClick={() => onOpen(o)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:border-sky-500 hover:text-sky-700">
                    เปิดดู
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

function Reports() {
  const closed = ORDERS.filter((o) => o.status === "ปิดงานแล้ว");
  const planned = closed.reduce((n, o) => n + o.qty, 0);
  const made = closed.reduce((n, o) => n + o.done, 0);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <Stat label="ใบสั่งผลิตที่ปิดแล้ว" value={closed.length + " ใบ"} />
        <Stat label="วางแผนไว้" value={planned + " หน่วย"} />
        <Stat label="ผลิตได้จริง" value={made + " หน่วย"} />
        <Stat label="ทำได้ตามแผน" value={planned ? Math.round((made / planned) * 100) + "%" : "—"} />
      </div>

      <Card title="ผลผลิตรายสินค้า">
        <table className="w-full text-sm">
          <Head cols={[{ k: "สินค้า" }, { k: "สั่งผลิต", right: true }, { k: "ผลิตได้", right: true }, { k: "ต้นทุนต่อหน่วย", right: true }, { k: "มูลค่าที่ผลิต", right: true }]} />
          <tbody className="divide-y divide-slate-100">
            {PRODUCTS.map((p) => {
              const mine = ORDERS.filter((o) => o.product === p.code);
              const qty = mine.reduce((n, o) => n + o.qty, 0);
              const done = mine.reduce((n, o) => n + o.done, 0);
              const c = unitCost(p.code);
              return (
                <tr key={p.code} className="hover:bg-sky-50">
                  <td className={TH + " font-medium text-slate-900"}>{p.name}</td>
                  <td className={TH + " text-right text-slate-700"}>{qty}</td>
                  <td className={TH + " text-right text-slate-700"}>{done}</td>
                  <td className={TH + " text-right text-slate-600"}>{baht(c.total)}</td>
                  <td className={TH + " text-right font-semibold text-slate-900"}>{baht(done * c.total)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <Card title="ภาระงานสะสมต่อศูนย์งาน">
        <ul className="divide-y divide-slate-100">
          {WORK_CENTERS.map((w) => {
            const load = loadOf(w.code);
            return (
              <li key={w.code} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span className="w-36 shrink-0 text-slate-700">{w.name}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <span className="block h-full rounded-full bg-sky-500" style={{ width: Math.min(100, (load / w.capacityHrs) * 100) + "%" }} />
                </span>
                <span className="w-20 shrink-0 text-right text-slate-600">{load.toFixed(1)} ชม.</span>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}

function OrderDialog({ order, onClose }: { order: ProductionOrder; onClose: () => void }) {
  const c = unitCost(order.product);
  const remaining = order.qty - order.done;
  return (
    <div role="dialog" aria-modal="true" onClick={onClose} className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div onClick={(e) => e.stopPropagation()} className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">ใบสั่งผลิต {order.no}</h2>
            <p className="text-sm text-slate-500">{product(order.product)?.name} · {order.start} → {order.due}</p>
          </div>
          <button onClick={onClose} className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100">✕</button>
        </div>

        <div className="mt-4 text-xs font-medium uppercase tracking-wide text-slate-400">วัสดุที่ต้องเบิกทั้งใบ</div>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-slate-100">
            {BOM[order.product].map((l) => {
              const m = material(l.material);
              return (
                <tr key={l.material}>
                  <td className="py-2.5 text-slate-800">{m?.name}</td>
                  <td className="py-2.5 text-right text-slate-700">{(l.qty * order.qty).toLocaleString("th-TH")} {m?.unit}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="mt-4 text-xs font-medium uppercase tracking-wide text-slate-400">ขั้นตอนและชั่วโมงงานที่เหลือ</div>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-slate-100">
            {ROUTING[order.product].map((r) => (
              <tr key={r.wc}>
                <td className="py-2.5 text-slate-800">{workCenter(r.wc).name}</td>
                <td className="py-2.5 text-right text-slate-700">{(r.hrs * remaining).toFixed(1)} ชม.</td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl className="mt-4 divide-y divide-slate-100 text-sm">
          <Row k="ต้นทุนวัสดุทั้งใบ" v={baht(c.material * order.qty)} />
          <Row k="ค่าแรงทั้งใบ" v={baht(c.labour * order.qty)} />
        </dl>
        <div className="mt-4 flex items-center justify-between rounded-xl bg-sky-50 px-4 py-3.5">
          <span className="text-sm font-medium text-sky-900">ต้นทุนรวมทั้งใบ</span>
          <span className="text-xl font-semibold text-sky-900">{baht(c.total * order.qty)}</span>
        </div>
      </div>
    </div>
  );
}

