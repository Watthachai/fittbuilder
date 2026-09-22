import { useState } from "react";
import {
  MATERIALS, VENDORS, INFO_RECORDS, REQUISITIONS, PURCHASE_ORDERS,
  GOODS_RECEIPTS, INVOICES, STOCK_MOVES,
  material, vendor, baht, poTotal, threeWayMatch, vendorScore,
} from "./data";
import type { PurchaseOrder } from "./data";
import { Card, Stat, Head, Row, TH } from "../ui";

const TABS = [
  "ข้อมูลหลักวัสดุและผู้ขาย",
  "ใบขอซื้อและใบสั่งซื้อ",
  "รับของและตรวจสอบใบแจ้งหนี้",
  "บริหารสต็อกวัสดุ",
  "ประเมินผู้ขาย",
];

export default function MmScreen({ section }: { section?: string }) {
  // Which capability to show is the navigation's decision, not this screen's.
  const tab = section && TABS.includes(section) ? section : TABS[0];
  const [openPo, setOpenPo] = useState<PurchaseOrder | null>(null);
  const low = MATERIALS.filter((m) => m.stock < m.reorder);

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-slate-900">จัดซื้อและคลังวัสดุ</h1>
        <p className="text-sm text-slate-500">
          {MATERIALS.length} รายการวัสดุ · {VENDORS.length} ผู้ขาย · ต่ำกว่าจุดสั่งซื้อ {low.length} รายการ
        </p>
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

      <Card title="แฟ้มวัสดุ" subtitle={rows.length + " รายการ"}>
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

      <Card title="ราคาที่ผู้ขายเคยเสนอ" subtitle="ใช้ประกอบการเลือกแหล่งซื้อในรอบถัดไป">
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

function Purchasing({ onOpen }: { onOpen: (po: PurchaseOrder) => void }) {
  const [prs, setPrs] = useState(REQUISITIONS);
  const approve = (no: string) =>
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

function Receiving({ onOpen }: { onOpen: (po: PurchaseOrder) => void }) {
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

      <Card title="ตรวจสามทาง" subtitle="เทียบใบสั่งซื้อ ใบรับของ และใบวางบิล ให้ตรงกันก่อนอนุมัติจ่าย">
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
                    : <span className="rounded-full bg-rose-50 px-2 py-1 text-xs text-rose-700">ไม่ตรง ยังจ่ายไม่ได้</span>}
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
    <Card title="ผลงานผู้ขาย" subtitle="ใช้ประกอบการตัดสินใจว่าจะสั่งกับรายใดในรอบถัดไป">
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

function PoDialog({ po, onClose }: { po: PurchaseOrder; onClose: () => void }) {
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
          <Row k="มูลค่าที่สั่ง" v={baht(m.ordered)} />
          <Row k="มูลค่าที่รับแล้ว" v={baht(m.received)} />
          <Row k="ใบแจ้งหนี้" v={m.invoice ? baht(m.invoice) : "ยังไม่วางบิล"} />
        </dl>

        <div className={"mt-5 rounded-xl px-4 py-3.5 text-sm " + (
          m.invoice === 0 ? "bg-slate-50 text-slate-600"
          : m.matched ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"
        )}>
          {m.invoice === 0 ? "ยังไม่มีใบแจ้งหนี้ ตรวจสามทางเมื่อผู้ขายวางบิล"
            : m.matched ? "สั่ง รับ และวางบิล ตรงกันทั้งสามทาง อนุมัติจ่ายได้"
            : "ยอดวางบิลยังไม่ตรงกับของที่รับจริง " + m.shortLines.map((s) => material(s.material)?.name + " ขาด " + (s.qty - s.got)).join(", ")}
        </div>
      </div>
    </div>
  );
}

