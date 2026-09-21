export const PP_DATA = `import { FINISHED_GOODS, material } from "../mm/data";

/** สินค้าที่ผลิต — อ่านจากแฟ้มวัสดุ ไม่ได้ถือรายการของตัวเอง */
export const PRODUCTS = FINISHED_GOODS;

/** สูตรการผลิต — ผลิตหนึ่งหน่วยต้องใช้วัสดุอะไรเท่าไร */
export const BOM = {
  "FG-5001": [
    { material: "MAT-1001", qty: 2 },
    { material: "MAT-1002", qty: 6 },
    { material: "MAT-2001", qty: 0.5 },
    { material: "MAT-1003", qty: 0.15 },
  ],
  "FG-5002": [
    { material: "MAT-1001", qty: 3 },
    { material: "MAT-1002", qty: 4 },
    { material: "MAT-2001", qty: 0.4 },
    { material: "MAT-1003", qty: 0.2 },
  ],
  "FG-5003": [
    { material: "MAT-1001", qty: 1 },
    { material: "MAT-1002", qty: 8 },
    { material: "MAT-2002", qty: 4 },
    { material: "MAT-4001", qty: 1 },
  ],
};

export const WORK_CENTERS = [
  { code: "WC-CUT", name: "ตัดและขึ้นรูป", capacityHrs: 80, costPerHr: 420 },
  { code: "WC-WELD", name: "เชื่อมประกอบ", capacityHrs: 120, costPerHr: 520 },
  { code: "WC-PAINT", name: "พ่นสีและอบ", capacityHrs: 60, costPerHr: 380 },
  { code: "WC-ASM", name: "ประกอบขั้นสุดท้าย", capacityHrs: 100, costPerHr: 350 },
];

/** ขั้นตอนการผลิต — ผ่านศูนย์งานไหน ใช้เวลากี่ชั่วโมงต่อหน่วย */
export const ROUTING = {
  "FG-5001": [
    { wc: "WC-CUT", hrs: 0.6 }, { wc: "WC-WELD", hrs: 1.2 },
    { wc: "WC-PAINT", hrs: 0.5 }, { wc: "WC-ASM", hrs: 0.4 },
  ],
  "FG-5002": [
    { wc: "WC-CUT", hrs: 0.8 }, { wc: "WC-WELD", hrs: 1.5 },
    { wc: "WC-PAINT", hrs: 0.6 }, { wc: "WC-ASM", hrs: 0.5 },
  ],
  "FG-5003": [
    { wc: "WC-CUT", hrs: 0.5 }, { wc: "WC-WELD", hrs: 2.0 },
    { wc: "WC-ASM", hrs: 1.0 },
  ],
};

/** ความต้องการที่รับมา — ป้อน MRP */
export const DEMAND = [
  { product: "FG-5001", qty: 40, dueDate: "2026-10-10" },
  { product: "FG-5002", qty: 25, dueDate: "2026-10-17" },
  { product: "FG-5003", qty: 12, dueDate: "2026-10-24" },
];

export const ORDERS = [
  { no: "PO-P-3301", product: "FG-5001", qty: 40, start: "2026-09-28", due: "2026-10-10", done: 28, status: "กำลังผลิต" },
  { no: "PO-P-3302", product: "FG-5002", qty: 25, start: "2026-10-05", due: "2026-10-17", done: 0, status: "ปล่อยงานแล้ว" },
  { no: "PO-P-3303", product: "FG-5003", qty: 12, start: "2026-10-14", due: "2026-10-24", done: 0, status: "วางแผนไว้" },
  { no: "PO-P-3298", product: "FG-5001", qty: 30, start: "2026-09-08", due: "2026-09-19", done: 30, status: "ปิดงานแล้ว" },
  { no: "PO-P-3299", product: "FG-5002", qty: 18, start: "2026-09-10", due: "2026-09-20", done: 16, status: "ปิดงานแล้ว" },
];

export const product = (code) => material(code);
export const workCenter = (code) => WORK_CENTERS.find((w) => w.code === code);
export const baht = (n) => n.toLocaleString("th-TH", { maximumFractionDigits: 0 }) + " ฿";

/**
 * กางสูตรการผลิตออกเป็นความต้องการวัสดุ แล้วหักสต็อกที่มีอยู่
 * ที่เหลือคือของที่ต้องซื้อ — ตัวเลขเดียวกับที่ฝ่ายจัดซื้อเอาไปเปิดใบขอซื้อ
 */
export function runMrp() {
  const need = {};
  for (const d of DEMAND) {
    for (const line of BOM[d.product]) {
      need[line.material] = (need[line.material] ?? 0) + line.qty * d.qty;
    }
  }
  return Object.entries(need).map(([code, required]) => {
    const m = material(code);
    const onHand = m?.stock ?? 0;
    return {
      code, name: m?.name ?? code, unit: m?.unit ?? "",
      required: Math.ceil(required), onHand,
      shortage: Math.max(0, Math.ceil(required) - onHand),
      price: m?.price ?? 0,
    };
  });
}

/** ชั่วโมงที่แต่ละศูนย์งานถูกจองไว้จากใบสั่งผลิตที่ยังไม่ปิด */
export function loadOf(code) {
  return ORDERS.filter((o) => o.status !== "ปิดงานแล้ว").reduce((hrs, o) => {
    const step = ROUTING[o.product].find((r) => r.wc === code);
    return hrs + (step ? step.hrs * (o.qty - o.done) : 0);
  }, 0);
}

/** ต้นทุนต่อหน่วย = วัสดุตามสูตร + ค่าแรงตามขั้นตอน */
export function unitCost(code) {
  const mat = BOM[code].reduce((n, l) => n + l.qty * (material(l.material)?.price ?? 0), 0);
  const lab = ROUTING[code].reduce((n, r) => n + r.hrs * workCenter(r.wc).costPerHr, 0);
  return { material: mat, labour: lab, total: mat + lab };
}
`;

export const PP_SCREEN = `import { useState } from "react";
import { material } from "../mm/data";
import {
  PRODUCTS, BOM, WORK_CENTERS, ROUTING, DEMAND, ORDERS,
  product, workCenter, baht, runMrp, loadOf, unitCost,
} from "./data";

const TABS = [
  "ข้อมูลหลักการผลิต",
  "วางแผนความต้องการวัสดุ",
  "วางแผนกำลังการผลิต",
  "ใบสั่งผลิต",
  "รายงานผลการผลิต",
];

export default function PpScreen() {
  const [tab, setTab] = useState(TABS[0]);
  const [openOrder, setOpenOrder] = useState(null);
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
      <div className={"mt-1 text-lg font-semibold " + (tone === "warn" ? "text-amber-700" : "text-slate-900")}>{value}</div>
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

function Orders({ onOpen }) {
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

function OrderDialog({ order, onClose }) {
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
          <Line k="ต้นทุนวัสดุทั้งใบ" v={baht(c.material * order.qty)} />
          <Line k="ค่าแรงทั้งใบ" v={baht(c.labour * order.qty)} />
        </dl>
        <div className="mt-4 flex items-center justify-between rounded-xl bg-sky-50 px-4 py-3.5">
          <span className="text-sm font-medium text-sky-900">ต้นทุนรวมทั้งใบ</span>
          <span className="text-xl font-semibold text-sky-900">{baht(c.total * order.qty)}</span>
        </div>
      </div>
    </div>
  );
}

function Line({ k, v }) {
  return (
    <div className="flex justify-between py-2">
      <dt className="text-slate-500">{k}</dt>
      <dd className="text-slate-900">{v}</dd>
    </div>
  );
}
`;
