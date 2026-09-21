export const MM_DATA = `export const MATERIALS = [
  { code: "MAT-1001", name: "เหล็กแผ่นรีดร้อน 3 มม.", group: "วัตถุดิบ", unit: "แผ่น", price: 1850, stock: 240, reorder: 120, bin: "A-01-03" },
  { code: "MAT-1002", name: "เหล็กเส้นกลม 12 มม.", group: "วัตถุดิบ", unit: "เส้น", price: 420, stock: 86, reorder: 150, bin: "A-01-07" },
  { code: "MAT-1003", name: "สีพ่นอุตสาหกรรม สีเทา", group: "วัตถุดิบ", unit: "ถัง", price: 2400, stock: 34, reorder: 20, bin: "B-02-01" },
  { code: "MAT-2001", name: "น็อตหัวหกเหลี่ยม M8", group: "อะไหล่", unit: "กล่อง", price: 380, stock: 18, reorder: 40, bin: "C-01-12" },
  { code: "MAT-2002", name: "ตลับลูกปืน 6204", group: "อะไหล่", unit: "ตัว", price: 145, stock: 320, reorder: 100, bin: "C-02-04" },
  { code: "MAT-3001", name: "ถุงมือผ้าเคลือบยาง", group: "วัสดุสิ้นเปลือง", unit: "คู่", price: 35, stock: 640, reorder: 200, bin: "D-01-01" },
  { code: "MAT-3002", name: "กล่องกระดาษลูกฟูก 40x30", group: "บรรจุภัณฑ์", unit: "ใบ", price: 12, stock: 1420, reorder: 500, bin: "D-02-06" },
  { code: "MAT-4001", name: "มอเตอร์ไฟฟ้า 1 แรงม้า", group: "อะไหล่", unit: "ตัว", price: 5600, stock: 6, reorder: 10, bin: "C-03-02" },
  { code: "FG-5001", name: "ชั้นวางเหล็ก 4 ชั้น", group: "สินค้าสำเร็จรูป", unit: "ชุด", price: 7976, stock: 34, reorder: 15, bin: "E-01-01" },
  { code: "FG-5002", name: "โต๊ะทำงานเหล็ก 120 ซม.", group: "สินค้าสำเร็จรูป", unit: "ตัว", price: 9381, stock: 12, reorder: 10, bin: "E-01-04" },
  { code: "FG-5003", name: "รถเข็นอุตสาหกรรม", group: "สินค้าสำเร็จรูป", unit: "คัน", price: 12990, stock: 5, reorder: 6, bin: "E-02-02" },
];

/** สินค้าที่ขายได้ — ชนิดหนึ่งในแฟ้มวัสดุ ไม่ใช่รายการแยกอีกชุด */
export const FINISHED_GOODS = MATERIALS.filter((m) => m.group === "สินค้าสำเร็จรูป");

export const VENDORS = [
  { code: "V-001", name: "บจก. เหล็กไทยรุ่งเรือง", contact: "คุณสมศักดิ์", terms: "เครดิต 30 วัน", leadDays: 7, taxId: "0105542000123" },
  { code: "V-002", name: "หจก. ศรีชัยค้าวัสดุ", contact: "คุณมาลี", terms: "เครดิต 45 วัน", leadDays: 10, taxId: "0103548000987" },
  { code: "V-003", name: "บจก. อุตสาหกรรมสีไทย", contact: "คุณวิชัย", terms: "เงินสด", leadDays: 3, taxId: "0105535000456" },
  { code: "V-004", name: "บจก. ยนต์ภัณฑ์สากล", contact: "คุณนภา", terms: "เครดิต 30 วัน", leadDays: 14, taxId: "0105551000789" },
];

/** ราคาและเวลาส่งที่ผู้ขายแต่ละรายเคยให้ไว้กับวัสดุตัวหนึ่ง */
export const INFO_RECORDS = [
  { material: "MAT-1001", vendor: "V-001", price: 1850, leadDays: 7 },
  { material: "MAT-1001", vendor: "V-002", price: 1920, leadDays: 5 },
  { material: "MAT-1002", vendor: "V-001", price: 420, leadDays: 7 },
  { material: "MAT-1003", vendor: "V-003", price: 2400, leadDays: 3 },
  { material: "MAT-2001", vendor: "V-002", price: 380, leadDays: 10 },
  { material: "MAT-2002", vendor: "V-004", price: 145, leadDays: 14 },
  { material: "MAT-4001", vendor: "V-004", price: 5600, leadDays: 14 },
];

export const REQUISITIONS = [
  { no: "PR-2569-041", material: "MAT-2001", qty: 60, needBy: "2026-10-02", requester: "ฝ่ายผลิต", status: "รออนุมัติ" },
  { no: "PR-2569-042", material: "MAT-4001", qty: 8, needBy: "2026-10-09", requester: "ฝ่ายซ่อมบำรุง", status: "รออนุมัติ" },
  { no: "PR-2569-043", material: "MAT-1002", qty: 200, needBy: "2026-09-30", requester: "ฝ่ายผลิต", status: "แปลงเป็นใบสั่งซื้อแล้ว" },
  { no: "PR-2569-044", material: "MAT-3002", qty: 800, needBy: "2026-10-15", requester: "ฝ่ายคลัง", status: "รออนุมัติ" },
];

export const PURCHASE_ORDERS = [
  { no: "PO-2569-118", vendor: "V-001", date: "2026-09-12", lines: [{ material: "MAT-1002", qty: 200, price: 420 }], status: "รับของครบแล้ว" },
  { no: "PO-2569-119", vendor: "V-003", date: "2026-09-15", lines: [{ material: "MAT-1003", qty: 20, price: 2400 }], status: "รับของบางส่วน" },
  { no: "PO-2569-120", vendor: "V-004", date: "2026-09-18", lines: [{ material: "MAT-2002", qty: 100, price: 145 }, { material: "MAT-4001", qty: 4, price: 5600 }], status: "รอรับของ" },
  { no: "PO-2569-121", vendor: "V-002", date: "2026-09-19", lines: [{ material: "MAT-2001", qty: 40, price: 380 }], status: "รอรับของ" },
];

/** ของที่รับเข้าจริงต่อใบสั่งซื้อ — เทียบกับที่สั่งเพื่อจับของขาด */
export const GOODS_RECEIPTS = [
  { no: "GR-2569-206", po: "PO-2569-118", date: "2026-09-19", lines: [{ material: "MAT-1002", qty: 200 }] },
  { no: "GR-2569-207", po: "PO-2569-119", date: "2026-09-20", lines: [{ material: "MAT-1003", qty: 14 }] },
];

export const INVOICES = [
  { no: "INV-88214", po: "PO-2569-118", vendor: "V-001", date: "2026-09-20", amount: 84000 },
  { no: "INV-88301", po: "PO-2569-119", vendor: "V-003", date: "2026-09-21", amount: 48000 },
];

/** การเคลื่อนไหวสต็อก — รับเข้าเป็นบวก จ่ายออกเป็นลบ */
export const STOCK_MOVES = [
  { date: "2026-09-19", material: "MAT-1002", qty: 200, reason: "รับจากใบสั่งซื้อ PO-2569-118" },
  { date: "2026-09-19", material: "MAT-1001", qty: -40, reason: "เบิกเข้าสายการผลิต" },
  { date: "2026-09-20", material: "MAT-1003", qty: 14, reason: "รับจากใบสั่งซื้อ PO-2569-119" },
  { date: "2026-09-20", material: "MAT-3001", qty: -60, reason: "เบิกใช้ประจำเดือน" },
  { date: "2026-09-21", material: "MAT-1002", qty: -114, reason: "เบิกเข้าสายการผลิต" },
  { date: "2026-09-21", material: "MAT-2001", qty: -22, reason: "เบิกซ่อมบำรุง" },
];

export const material = (code) => MATERIALS.find((m) => m.code === code);
export const vendor = (code) => VENDORS.find((v) => v.code === code);
export const baht = (n) => n.toLocaleString("th-TH", { maximumFractionDigits: 0 }) + " ฿";
export const poTotal = (po) => po.lines.reduce((n, l) => n + l.qty * l.price, 0);

/** สามทางตรง: สั่งเท่าไร รับเท่าไร วางบิลเท่าไร — ไม่ตรงคือห้ามจ่าย */
export function threeWayMatch(po) {
  const ordered = poTotal(po);
  const gr = GOODS_RECEIPTS.filter((g) => g.po === po.no);
  const receivedQty = (code) =>
    gr.reduce((n, g) => n + (g.lines.find((l) => l.material === code)?.qty ?? 0), 0);
  const received = po.lines.reduce((n, l) => n + receivedQty(l.material) * l.price, 0);
  const invoice = INVOICES.filter((i) => i.po === po.no).reduce((n, i) => n + i.amount, 0);
  return {
    ordered, received, invoice,
    shortLines: po.lines.filter((l) => receivedQty(l.material) < l.qty)
      .map((l) => ({ ...l, got: receivedQty(l.material) })),
    matched: invoice > 0 && invoice === received,
  };
}

/** คะแนนผู้ขาย: ส่งตรงเวลากี่ครั้ง ส่งของครบกี่ครั้ง */
export function vendorScore(code) {
  const pos = PURCHASE_ORDERS.filter((p) => p.vendor === code);
  const complete = pos.filter((p) => threeWayMatch(p).shortLines.length === 0 && p.status !== "รอรับของ");
  const closed = pos.filter((p) => p.status !== "รอรับของ");
  return {
    orders: pos.length,
    value: pos.reduce((n, p) => n + poTotal(p), 0),
    fillRate: closed.length ? Math.round((complete.length / closed.length) * 100) : null,
  };
}
`;

export const MM_SCREEN = `import { useState } from "react";
import {
  MATERIALS, VENDORS, INFO_RECORDS, REQUISITIONS, PURCHASE_ORDERS,
  GOODS_RECEIPTS, INVOICES, STOCK_MOVES,
  material, vendor, baht, poTotal, threeWayMatch, vendorScore,
} from "./data";

const TABS = [
  "ข้อมูลหลักวัสดุและผู้ขาย",
  "ใบขอซื้อและใบสั่งซื้อ",
  "รับของและตรวจสอบใบแจ้งหนี้",
  "บริหารสต็อกวัสดุ",
  "ประเมินผู้ขาย",
];

export default function MmScreen() {
  const [tab, setTab] = useState(TABS[0]);
  const [openPo, setOpenPo] = useState(null);
  const low = MATERIALS.filter((m) => m.stock < m.reorder);

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-slate-900">จัดซื้อและคลังวัสดุ</h1>
        <p className="text-sm text-slate-500">
          {MATERIALS.length} รายการวัสดุ · {VENDORS.length} ผู้ขาย · ต่ำกว่าจุดสั่งซื้อ {low.length} รายการ
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

      {tab === "ข้อมูลหลักวัสดุและผู้ขาย" && <MasterData />}
      {tab === "ใบขอซื้อและใบสั่งซื้อ" && <Purchasing onOpen={setOpenPo} />}
      {tab === "รับของและตรวจสอบใบแจ้งหนี้" && <Receiving onOpen={setOpenPo} />}
      {tab === "บริหารสต็อกวัสดุ" && <Stock />}
      {tab === "ประเมินผู้ขาย" && <VendorRating />}

      {openPo && <PoDialog po={openPo} onClose={() => setOpenPo(null)} />}

      <div hidden data-fitt-index>
        <button data-fitt-screen="จัดซื้อและคลังวัสดุ" />
        <button data-fitt-screen="ใบสั่งซื้อและการตรวจสามทาง" data-fitt-modal onClick={() => setOpenPo(PURCHASE_ORDERS[0])} />
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
  const [q, setQ] = useState("");
  const [group, setGroup] = useState("ทุกกลุ่ม");
  const groups = ["ทุกกลุ่ม", ...new Set(MATERIALS.map((m) => m.group))];
  const rows = MATERIALS.filter(
    (m) => (group === "ทุกกลุ่ม" || m.group === group) && (m.name.includes(q) || m.code.includes(q))
  );
  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <select
          value={group}
          onChange={(e) => setGroup(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-sky-500"
        >
          {groups.map((g) => <option key={g}>{g}</option>)}
        </select>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ค้นหาชื่อหรือรหัสวัสดุ"
          className="w-64 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-sky-500"
        />
      </div>

      <Card title={"แฟ้มวัสดุ — " + rows.length + " รายการ"}>
        <table className="w-full text-sm">
          <Head cols={[{ k: "รหัส" }, { k: "ชื่อวัสดุ" }, { k: "กลุ่ม" }, { k: "หน่วย" }, { k: "ราคามาตรฐาน", right: true }, { k: "คงเหลือ", right: true }]} />
          <tbody className="divide-y divide-slate-100">
            {rows.map((m) => (
              <tr key={m.code} className="hover:bg-sky-50">
                <td className={TH + " font-mono text-xs text-slate-500"}>{m.code}</td>
                <td className={TH + " font-medium text-slate-900"}>{m.name}</td>
                <td className={TH + " text-slate-600"}>{m.group}</td>
                <td className={TH + " text-slate-600"}>{m.unit}</td>
                <td className={TH + " text-right text-slate-700"}>{baht(m.price)}</td>
                <td className={TH + " text-right " + (m.stock < m.reorder ? "font-semibold text-amber-700" : "text-slate-700")}>
                  {m.stock.toLocaleString("th-TH")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card title="แฟ้มผู้ขาย">
        <table className="w-full text-sm">
          <Head cols={[{ k: "รหัส" }, { k: "ชื่อผู้ขาย" }, { k: "ผู้ติดต่อ" }, { k: "เงื่อนไขชำระ" }, { k: "เลขผู้เสียภาษี" }, { k: "รอของ (วัน)", right: true }]} />
          <tbody className="divide-y divide-slate-100">
            {VENDORS.map((v) => (
              <tr key={v.code} className="hover:bg-sky-50">
                <td className={TH + " font-mono text-xs text-slate-500"}>{v.code}</td>
                <td className={TH + " font-medium text-slate-900"}>{v.name}</td>
                <td className={TH + " text-slate-600"}>{v.contact}</td>
                <td className={TH + " text-slate-600"}>{v.terms}</td>
                <td className={TH + " font-mono text-xs text-slate-500"}>{v.taxId}</td>
                <td className={TH + " text-right text-slate-700"}>{v.leadDays}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card title="ราคาที่ผู้ขายเคยเสนอ — ใช้เลือกแหล่งซื้อ">
        <table className="w-full text-sm">
          <Head cols={[{ k: "วัสดุ" }, { k: "ผู้ขาย" }, { k: "ราคา", right: true }, { k: "รอของ (วัน)", right: true }]} />
          <tbody className="divide-y divide-slate-100">
            {INFO_RECORDS.map((r, i) => {
              const cheapest = Math.min(...INFO_RECORDS.filter((x) => x.material === r.material).map((x) => x.price));
              return (
                <tr key={i} className="hover:bg-sky-50">
                  <td className={TH + " text-slate-800"}>{material(r.material)?.name}</td>
                  <td className={TH + " text-slate-600"}>{vendor(r.vendor)?.name}</td>
                  <td className={TH + " text-right " + (r.price === cheapest ? "font-semibold text-emerald-700" : "text-slate-700")}>
                    {baht(r.price)}
                  </td>
                  <td className={TH + " text-right text-slate-700"}>{r.leadDays}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function Purchasing({ onOpen }) {
  const [prs, setPrs] = useState(REQUISITIONS);
  const approve = (no) =>
    setPrs((all) => all.map((p) => (p.no === no ? { ...p, status: "อนุมัติแล้ว" } : p)));
  return (
    <div className="space-y-4">
      <Card title="ใบขอซื้อ">
        <table className="w-full text-sm">
          <Head cols={[{ k: "เลขที่" }, { k: "วัสดุ" }, { k: "จำนวน", right: true }, { k: "ต้องการใช้" }, { k: "ผู้ขอ" }, { k: "สถานะ" }, { k: "" }]} />
          <tbody className="divide-y divide-slate-100">
            {prs.map((p) => (
              <tr key={p.no} className="hover:bg-sky-50">
                <td className={TH + " font-mono text-xs text-slate-500"}>{p.no}</td>
                <td className={TH + " font-medium text-slate-900"}>{material(p.material)?.name}</td>
                <td className={TH + " text-right text-slate-700"}>{p.qty} {material(p.material)?.unit}</td>
                <td className={TH + " text-slate-600"}>{p.needBy}</td>
                <td className={TH + " text-slate-600"}>{p.requester}</td>
                <td className={TH}>
                  <span className={"rounded-full px-2 py-1 text-xs " + (
                    p.status === "รออนุมัติ" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"
                  )}>{p.status}</span>
                </td>
                <td className={TH + " text-right"}>
                  {p.status === "รออนุมัติ" && (
                    <button onClick={() => approve(p.no)} className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs text-white hover:bg-sky-700">
                      อนุมัติ
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card title="ใบสั่งซื้อ">
        <table className="w-full text-sm">
          <Head cols={[{ k: "เลขที่" }, { k: "ผู้ขาย" }, { k: "วันที่" }, { k: "รายการ", right: true }, { k: "มูลค่า", right: true }, { k: "สถานะ" }, { k: "" }]} />
          <tbody className="divide-y divide-slate-100">
            {PURCHASE_ORDERS.map((po) => (
              <tr key={po.no} className="hover:bg-sky-50">
                <td className={TH + " font-mono text-xs text-slate-500"}>{po.no}</td>
                <td className={TH + " font-medium text-slate-900"}>{vendor(po.vendor)?.name}</td>
                <td className={TH + " text-slate-600"}>{po.date}</td>
                <td className={TH + " text-right text-slate-700"}>{po.lines.length}</td>
                <td className={TH + " text-right font-semibold text-slate-900"}>{baht(poTotal(po))}</td>
                <td className={TH}>
                  <span className={"rounded-full px-2 py-1 text-xs " + (
                    po.status === "รับของครบแล้ว" ? "bg-emerald-50 text-emerald-700"
                    : po.status === "รับของบางส่วน" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"
                  )}>{po.status}</span>
                </td>
                <td className={TH + " text-right"}>
                  <button onClick={() => onOpen(po)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:border-sky-500 hover:text-sky-700">
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

function Receiving({ onOpen }) {
  const checked = PURCHASE_ORDERS.map((po) => ({ po, m: threeWayMatch(po) }));
  const blocked = checked.filter((c) => c.m.invoice > 0 && !c.m.matched);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="ใบรับของ" value={GOODS_RECEIPTS.length + " ใบ"} />
        <Stat label="ใบแจ้งหนี้ที่ตั้งไว้" value={INVOICES.length + " ใบ"} />
        <Stat label="ติดตรวจสามทาง" value={blocked.length + " ใบ"} tone={blocked.length ? "warn" : undefined} />
      </div>

      <Card title="ใบรับของ">
        <table className="w-full text-sm">
          <Head cols={[{ k: "เลขที่" }, { k: "อ้างใบสั่งซื้อ" }, { k: "วันที่" }, { k: "รายการที่รับ" }]} />
          <tbody className="divide-y divide-slate-100">
            {GOODS_RECEIPTS.map((g) => (
              <tr key={g.no} className="hover:bg-sky-50">
                <td className={TH + " font-mono text-xs text-slate-500"}>{g.no}</td>
                <td className={TH + " font-medium text-slate-900"}>{g.po}</td>
                <td className={TH + " text-slate-600"}>{g.date}</td>
                <td className={TH + " text-slate-700"}>
                  {g.lines.map((l) => material(l.material)?.name + " × " + l.qty).join(" · ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card title="ตรวจสามทาง — สั่ง เทียบ รับ เทียบ วางบิล">
        <table className="w-full text-sm">
          <Head cols={[{ k: "ใบสั่งซื้อ" }, { k: "สั่ง", right: true }, { k: "รับแล้ว", right: true }, { k: "วางบิล", right: true }, { k: "ผล" }, { k: "" }]} />
          <tbody className="divide-y divide-slate-100">
            {checked.map(({ po, m }) => (
              <tr key={po.no} className="hover:bg-sky-50">
                <td className={TH + " font-mono text-xs text-slate-500"}>{po.no}</td>
                <td className={TH + " text-right text-slate-700"}>{baht(m.ordered)}</td>
                <td className={TH + " text-right text-slate-700"}>{baht(m.received)}</td>
                <td className={TH + " text-right text-slate-700"}>{m.invoice ? baht(m.invoice) : "—"}</td>
                <td className={TH}>
                  {m.invoice === 0 ? <span className="text-xs text-slate-400">ยังไม่วางบิล</span>
                    : m.matched ? <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-700">ตรงกัน จ่ายได้</span>
                    : <span className="rounded-full bg-rose-50 px-2 py-1 text-xs text-rose-700">ไม่ตรง ห้ามจ่าย</span>}
                </td>
                <td className={TH + " text-right"}>
                  <button onClick={() => onOpen(po)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:border-sky-500 hover:text-sky-700">
                    ดูรายละเอียด
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

function Stock() {
  const value = MATERIALS.reduce((n, m) => n + m.stock * m.price, 0);
  const low = MATERIALS.filter((m) => m.stock < m.reorder);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="มูลค่าสต็อกรวม" value={baht(value)} />
        <Stat label="ต่ำกว่าจุดสั่งซื้อ" value={low.length + " รายการ"} tone={low.length ? "warn" : undefined} />
        <Stat label="ความเคลื่อนไหวสัปดาห์นี้" value={STOCK_MOVES.length + " รายการ"} />
      </div>

      <Card title="ระดับสต็อกเทียบจุดสั่งซื้อ">
        <table className="w-full text-sm">
          <Head cols={[{ k: "วัสดุ" }, { k: "ช่องเก็บ" }, { k: "คงเหลือ", right: true }, { k: "จุดสั่งซื้อ", right: true }, { k: "มูลค่า", right: true }, { k: "ระดับ" }]} />
          <tbody className="divide-y divide-slate-100">
            {MATERIALS.map((m) => {
              const pct = Math.min(100, Math.round((m.stock / (m.reorder * 2)) * 100));
              return (
                <tr key={m.code} className="hover:bg-sky-50">
                  <td className={TH + " font-medium text-slate-900"}>{m.name}</td>
                  <td className={TH + " font-mono text-xs text-slate-500"}>{m.bin}</td>
                  <td className={TH + " text-right text-slate-700"}>{m.stock.toLocaleString("th-TH")}</td>
                  <td className={TH + " text-right text-slate-500"}>{m.reorder.toLocaleString("th-TH")}</td>
                  <td className={TH + " text-right text-slate-700"}>{baht(m.stock * m.price)}</td>
                  <td className={TH}>
                    <span className="h-2 block w-24 overflow-hidden rounded-full bg-slate-100">
                      <span className={"block h-full rounded-full " + (m.stock < m.reorder ? "bg-amber-500" : "bg-emerald-500")} style={{ width: pct + "%" }} />
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <Card title="ความเคลื่อนไหวสต็อก">
        <table className="w-full text-sm">
          <Head cols={[{ k: "วันที่" }, { k: "วัสดุ" }, { k: "จำนวน", right: true }, { k: "เหตุผล" }]} />
          <tbody className="divide-y divide-slate-100">
            {STOCK_MOVES.map((s, i) => (
              <tr key={i} className="hover:bg-sky-50">
                <td className={TH + " text-slate-600"}>{s.date}</td>
                <td className={TH + " font-medium text-slate-900"}>{material(s.material)?.name}</td>
                <td className={TH + " text-right font-semibold " + (s.qty > 0 ? "text-emerald-700" : "text-rose-600")}>
                  {s.qty > 0 ? "+" : ""}{s.qty}
                </td>
                <td className={TH + " text-slate-600"}>{s.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function VendorRating() {
  return (
    <Card title="ผลงานผู้ขาย — ใช้ตัดสินว่าจะสั่งกับใครรอบหน้า">
      <table className="w-full text-sm">
        <Head cols={[{ k: "ผู้ขาย" }, { k: "เงื่อนไขชำระ" }, { k: "ใบสั่งซื้อ", right: true }, { k: "มูลค่ารวม", right: true }, { k: "ส่งของครบ" }]} />
        <tbody className="divide-y divide-slate-100">
          {VENDORS.map((v) => {
            const s = vendorScore(v.code);
            return (
              <tr key={v.code} className="hover:bg-sky-50">
                <td className={TH + " font-medium text-slate-900"}>{v.name}</td>
                <td className={TH + " text-slate-600"}>{v.terms}</td>
                <td className={TH + " text-right text-slate-700"}>{s.orders}</td>
                <td className={TH + " text-right text-slate-700"}>{baht(s.value)}</td>
                <td className={TH}>
                  {s.fillRate === null ? <span className="text-xs text-slate-400">ยังไม่มีใบที่ปิด</span> : (
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-20 overflow-hidden rounded-full bg-slate-100">
                        <span className={"block h-full rounded-full " + (s.fillRate === 100 ? "bg-emerald-500" : "bg-amber-500")} style={{ width: s.fillRate + "%" }} />
                      </span>
                      <span className="text-xs text-slate-600">{s.fillRate}%</span>
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

function PoDialog({ po, onClose }) {
  const m = threeWayMatch(po);
  return (
    <div role="dialog" aria-modal="true" onClick={onClose} className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div onClick={(e) => e.stopPropagation()} className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">ใบสั่งซื้อ {po.no}</h2>
            <p className="text-sm text-slate-500">{vendor(po.vendor)?.name} · {po.date}</p>
          </div>
          <button onClick={onClose} className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100">✕</button>
        </div>

        <table className="mt-4 w-full text-sm">
          <Head cols={[{ k: "วัสดุ" }, { k: "สั่ง", right: true }, { k: "รับแล้ว", right: true }, { k: "รวม", right: true }]} />
          <tbody className="divide-y divide-slate-100">
            {po.lines.map((l) => {
              const short = m.shortLines.find((s) => s.material === l.material);
              return (
                <tr key={l.material}>
                  <td className="py-2.5 text-slate-800">{material(l.material)?.name}</td>
                  <td className="py-2.5 text-right text-slate-700">{l.qty}</td>
                  <td className={"py-2.5 text-right " + (short ? "font-semibold text-amber-700" : "text-slate-700")}>
                    {short ? short.got : l.qty}
                  </td>
                  <td className="py-2.5 text-right text-slate-900">{baht(l.qty * l.price)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <dl className="mt-4 divide-y divide-slate-100 text-sm">
          <Line k="มูลค่าที่สั่ง" v={baht(m.ordered)} />
          <Line k="มูลค่าที่รับแล้ว" v={baht(m.received)} />
          <Line k="ใบแจ้งหนี้" v={m.invoice ? baht(m.invoice) : "ยังไม่วางบิล"} />
        </dl>

        <div className={"mt-5 rounded-xl px-4 py-3.5 text-sm " + (
          m.invoice === 0 ? "bg-slate-50 text-slate-600"
          : m.matched ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"
        )}>
          {m.invoice === 0 ? "ยังไม่มีใบแจ้งหนี้ ตรวจสามทางเมื่อผู้ขายวางบิล"
            : m.matched ? "สั่ง รับ และวางบิล ตรงกันทั้งสามทาง อนุมัติจ่ายได้"
            : "ยอดวางบิลไม่ตรงกับของที่รับจริง — " + m.shortLines.map((s) => material(s.material)?.name + " ขาด " + (s.qty - s.got)).join(", ")}
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
