export const SD_DATA = `import { FINISHED_GOODS, material } from "../mm/data";

/** สินค้าที่ขายได้ — อ่านจากแฟ้มวัสดุ ไม่ได้ถือรายการของตัวเอง */
export const CATALOG = FINISHED_GOODS;

export const CUSTOMERS = [
  { code: "C-101", name: "บจก. เจริญคลังสินค้า", contact: "คุณอรุณ", channel: "ขายตรง", terms: "เครดิต 30 วัน", creditLimit: 800000, taxId: "0105544000321", address: "ระยอง" },
  { code: "C-102", name: "หจก. พาณิชย์ภัณฑ์", contact: "คุณกิตติ", channel: "ตัวแทนจำหน่าย", terms: "เครดิต 60 วัน", creditLimit: 1200000, taxId: "0103550000654", address: "ชลบุรี" },
  { code: "C-103", name: "บจก. สำนักงานทันสมัย", contact: "คุณพิมพ์", channel: "ขายตรง", terms: "เครดิต 30 วัน", creditLimit: 400000, taxId: "0105558000147", address: "กรุงเทพฯ" },
  { code: "C-104", name: "ร้านวัสดุบ้านสวน", contact: "คุณสมหญิง", channel: "ขายหน้าร้าน", terms: "เงินสด", creditLimit: 0, taxId: "3101200456789", address: "นครปฐม" },
  { code: "C-105", name: "บจก. โลจิสติกส์ตะวันออก", contact: "คุณธนา", channel: "ตัวแทนจำหน่าย", terms: "เครดิต 60 วัน", creditLimit: 600000, taxId: "0105561000258", address: "ฉะเชิงเทรา" },
];

/** ราคาขายและส่วนลดตามช่องทาง — เงื่อนไขที่ประกาศไว้ ไม่ใช่ราคาที่พิมพ์ลงใบสั่งขายทีละใบ */
export const PRICE_LIST = {
  "FG-5001": 11900,
  "FG-5002": 13900,
  "FG-5003": 18900,
};

export const CHANNEL_DISCOUNT = {
  "ขายตรง": 0,
  "ตัวแทนจำหน่าย": 0.08,
  "ขายหน้าร้าน": 0.03,
};

/** ซื้อเยอะลดเพิ่ม — ขั้นบันไดตามจำนวนต่อบรรทัด */
export const VOLUME_BREAKS = [
  { minQty: 30, discount: 0.05 },
  { minQty: 15, discount: 0.03 },
  { minQty: 5, discount: 0.01 },
];

export const VAT_RATE = 0.07;

export const SALES_ORDERS = [
  { no: "SO-2569-0412", customer: "C-102", date: "2026-09-14", lines: [{ material: "FG-5001", qty: 30 }, { material: "FG-5002", qty: 10 }] },
  { no: "SO-2569-0413", customer: "C-101", date: "2026-09-17", lines: [{ material: "FG-5003", qty: 6 }] },
  { no: "SO-2569-0414", customer: "C-103", date: "2026-09-19", lines: [{ material: "FG-5002", qty: 16 }] },
  { no: "SO-2569-0415", customer: "C-104", date: "2026-09-20", lines: [{ material: "FG-5001", qty: 3 }] },
  { no: "SO-2569-0416", customer: "C-105", date: "2026-09-21", lines: [{ material: "FG-5001", qty: 20 }, { material: "FG-5003", qty: 4 }] },
];

export const DELIVERIES = [
  { no: "DO-2569-0301", so: "SO-2569-0412", date: "2026-09-18", route: "ชลบุรี", carrier: "ขนส่งเจริญทรัพย์", status: "ส่งถึงแล้ว", lines: [{ material: "FG-5001", qty: 30 }, { material: "FG-5002", qty: 10 }] },
  { no: "DO-2569-0302", so: "SO-2569-0413", date: "2026-09-20", route: "ระยอง", carrier: "ขนส่งเจริญทรัพย์", status: "กำลังจัดส่ง", lines: [{ material: "FG-5003", qty: 6 }] },
  { no: "DO-2569-0303", so: "SO-2569-0415", date: "2026-09-21", route: "นครปฐม", carrier: "รับเองที่โรงงาน", status: "ส่งถึงแล้ว", lines: [{ material: "FG-5001", qty: 3 }] },
];

/** ใบแจ้งหนี้ที่ออกแล้ว — ยังไม่เก็บเงินคือยอดค้างที่กินวงเงินเครดิต */
export const BILLINGS = [
  { no: "IV-2569-0908", so: "SO-2569-0412", date: "2026-09-18", paid: true },
  { no: "IV-2569-0911", so: "SO-2569-0415", date: "2026-09-21", paid: false },
];

export const customer = (code) => CUSTOMERS.find((c) => c.code === code);
export const baht = (n) => n.toLocaleString("th-TH", { maximumFractionDigits: 0 }) + " ฿";

export const volumeDiscount = (qty) =>
  VOLUME_BREAKS.find((b) => qty >= b.minQty)?.discount ?? 0;

/** ราคาหนึ่งบรรทัด: ราคาตั้ง → ส่วนลดช่องทาง → ส่วนลดตามจำนวน */
export function priceLine(line, channel) {
  const list = PRICE_LIST[line.material] ?? 0;
  const chan = CHANNEL_DISCOUNT[channel] ?? 0;
  const vol = volumeDiscount(line.qty);
  const net = Math.round(list * (1 - chan) * (1 - vol));
  return { list, chan, vol, net, amount: net * line.qty };
}

/** ทั้งใบ: รวมก่อนภาษี ภาษีมูลค่าเพิ่ม และยอดที่ลูกค้าต้องจ่าย */
export function orderTotal(so) {
  const c = customer(so.customer);
  const lines = so.lines.map((l) => ({ ...l, ...priceLine(l, c.channel) }));
  const net = lines.reduce((n, l) => n + l.amount, 0);
  const vat = Math.round(net * VAT_RATE);
  return { lines, net, vat, gross: net + vat };
}

export const deliveryOf = (soNo) => DELIVERIES.find((d) => d.so === soNo);
export const billingOf = (soNo) => BILLINGS.find((b) => b.so === soNo);

/** ยอดที่ลูกค้าติดค้างอยู่ตอนนี้ = ใบสั่งขายที่ยังไม่เก็บเงิน */
export function exposureOf(code) {
  return SALES_ORDERS.filter((so) => so.customer === code)
    .filter((so) => !billingOf(so.no)?.paid)
    .reduce((n, so) => n + orderTotal(so).gross, 0);
}

export function creditCheck(code) {
  const c = customer(code);
  const used = exposureOf(code);
  return {
    limit: c.creditLimit, used,
    left: c.creditLimit - used,
    blocked: c.creditLimit > 0 && used > c.creditLimit,
    cashOnly: c.creditLimit === 0,
  };
}
`;

export const SD_SCREEN = `import { useState } from "react";
import { material } from "../mm/data";
import {
  CATALOG, CUSTOMERS, PRICE_LIST, CHANNEL_DISCOUNT, VOLUME_BREAKS, VAT_RATE,
  SALES_ORDERS, DELIVERIES, BILLINGS,
  customer, baht, priceLine, orderTotal, deliveryOf, billingOf, creditCheck,
} from "./data";

const TABS = [
  "ข้อมูลหลักลูกค้า",
  "ราคาและส่วนลด",
  "ใบสั่งขาย",
  "จัดส่งสินค้า",
  "วางบิลและใบแจ้งหนี้",
  "วงเงินเครดิตลูกค้า",
];

export default function SdScreen() {
  const [tab, setTab] = useState(TABS[0]);
  const [openSo, setOpenSo] = useState(null);
  const revenue = SALES_ORDERS.reduce((n, so) => n + orderTotal(so).gross, 0);

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-slate-900">ขายและกระจายสินค้า</h1>
        <p className="text-sm text-slate-500">
          {CUSTOMERS.length} ลูกค้า · {SALES_ORDERS.length} ใบสั่งขาย · มูลค่ารวม {baht(revenue)}
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

      {tab === "ข้อมูลหลักลูกค้า" && <Customers />}
      {tab === "ราคาและส่วนลด" && <Pricing />}
      {tab === "ใบสั่งขาย" && <Orders onOpen={setOpenSo} />}
      {tab === "จัดส่งสินค้า" && <Shipping />}
      {tab === "วางบิลและใบแจ้งหนี้" && <Billing />}
      {tab === "วงเงินเครดิตลูกค้า" && <Credit />}

      {openSo && <SoDialog so={openSo} onClose={() => setOpenSo(null)} />}

      <div hidden data-fitt-index>
        <button data-fitt-screen="ขายและกระจายสินค้า" />
        <button data-fitt-screen="ใบสั่งขายและการคิดราคา" data-fitt-modal onClick={() => setOpenSo(SALES_ORDERS[0])} />
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

function Customers() {
  const [channel, setChannel] = useState("ทุกช่องทาง");
  const channels = ["ทุกช่องทาง", ...Object.keys(CHANNEL_DISCOUNT)];
  const rows = CUSTOMERS.filter((c) => channel === "ทุกช่องทาง" || c.channel === channel);
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <select
          value={channel}
          onChange={(e) => setChannel(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-sky-500"
        >
          {channels.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>
      <Card title={"แฟ้มลูกค้า — " + rows.length + " ราย"}>
        <table className="w-full text-sm">
          <Head cols={[{ k: "รหัส" }, { k: "ชื่อลูกค้า" }, { k: "ผู้ติดต่อ" }, { k: "ช่องทาง" }, { k: "เงื่อนไขชำระ" }, { k: "จังหวัด" }, { k: "เลขผู้เสียภาษี" }]} />
          <tbody className="divide-y divide-slate-100">
            {rows.map((c) => (
              <tr key={c.code} className="hover:bg-sky-50">
                <td className={TH + " font-mono text-xs text-slate-500"}>{c.code}</td>
                <td className={TH + " font-medium text-slate-900"}>{c.name}</td>
                <td className={TH + " text-slate-600"}>{c.contact}</td>
                <td className={TH + " text-slate-600"}>{c.channel}</td>
                <td className={TH + " text-slate-600"}>{c.terms}</td>
                <td className={TH + " text-slate-600"}>{c.address}</td>
                <td className={TH + " font-mono text-xs text-slate-500"}>{c.taxId}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function Pricing() {
  return (
    <div className="space-y-4">
      <Card title="ราคาตั้ง">
        <table className="w-full text-sm">
          <Head cols={[{ k: "สินค้า" }, { k: "หน่วย" }, { k: "ต้นทุนมาตรฐาน", right: true }, { k: "ราคาตั้ง", right: true }, { k: "กำไรขั้นต้น", right: true }]} />
          <tbody className="divide-y divide-slate-100">
            {CATALOG.map((m) => {
              const list = PRICE_LIST[m.code] ?? 0;
              const margin = list ? Math.round(((list - m.price) / list) * 100) : 0;
              return (
                <tr key={m.code} className="hover:bg-sky-50">
                  <td className={TH + " font-medium text-slate-900"}>{m.name}</td>
                  <td className={TH + " text-slate-600"}>{m.unit}</td>
                  <td className={TH + " text-right text-slate-600"}>{baht(m.price)}</td>
                  <td className={TH + " text-right font-semibold text-slate-900"}>{baht(list)}</td>
                  <td className={TH + " text-right text-emerald-700"}>{margin}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Card title="ส่วนลดตามช่องทางขาย">
          <ul className="divide-y divide-slate-100">
            {Object.entries(CHANNEL_DISCOUNT).map(([k, v]) => (
              <li key={k} className="flex justify-between px-4 py-2.5 text-sm">
                <span className="text-slate-800">{k}</span>
                <span className="text-slate-900">{v ? (v * 100).toFixed(0) + "%" : "ไม่ลด"}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="ส่วนลดตามจำนวนที่สั่ง">
          <ul className="divide-y divide-slate-100">
            {VOLUME_BREAKS.map((b) => (
              <li key={b.minQty} className="flex justify-between px-4 py-2.5 text-sm">
                <span className="text-slate-800">ตั้งแต่ {b.minQty} หน่วยขึ้นไป</span>
                <span className="text-slate-900">{(b.discount * 100).toFixed(0)}%</span>
              </li>
            ))}
            <li className="flex justify-between px-4 py-2.5 text-sm">
              <span className="text-slate-500">ภาษีมูลค่าเพิ่ม</span>
              <span className="text-slate-900">{(VAT_RATE * 100).toFixed(0)}%</span>
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
}

function Orders({ onOpen }) {
  return (
    <Card title="ใบสั่งขาย">
      <table className="w-full text-sm">
        <Head cols={[{ k: "เลขที่" }, { k: "ลูกค้า" }, { k: "วันที่" }, { k: "รายการ", right: true }, { k: "ก่อนภาษี", right: true }, { k: "รวมภาษี", right: true }, { k: "ขั้นตอน" }, { k: "" }]} />
        <tbody className="divide-y divide-slate-100">
          {SALES_ORDERS.map((so) => {
            const t = orderTotal(so);
            const d = deliveryOf(so.no);
            const b = billingOf(so.no);
            const step = b?.paid ? "เก็บเงินแล้ว" : b ? "วางบิลแล้ว" : d ? "จัดส่งแล้ว" : "รอจัดส่ง";
            return (
              <tr key={so.no} className="hover:bg-sky-50">
                <td className={TH + " font-mono text-xs text-slate-500"}>{so.no}</td>
                <td className={TH + " font-medium text-slate-900"}>{customer(so.customer)?.name}</td>
                <td className={TH + " text-slate-600"}>{so.date}</td>
                <td className={TH + " text-right text-slate-700"}>{so.lines.length}</td>
                <td className={TH + " text-right text-slate-700"}>{baht(t.net)}</td>
                <td className={TH + " text-right font-semibold text-slate-900"}>{baht(t.gross)}</td>
                <td className={TH}>
                  <span className={"rounded-full px-2 py-1 text-xs " + (
                    step === "เก็บเงินแล้ว" ? "bg-emerald-50 text-emerald-700"
                    : step === "รอจัดส่ง" ? "bg-amber-50 text-amber-700" : "bg-sky-50 text-sky-700"
                  )}>{step}</span>
                </td>
                <td className={TH + " text-right"}>
                  <button onClick={() => onOpen(so)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:border-sky-500 hover:text-sky-700">
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

function Shipping() {
  const waiting = SALES_ORDERS.filter((so) => !deliveryOf(so.no));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="ใบส่งของ" value={DELIVERIES.length + " ใบ"} />
        <Stat label="ส่งถึงแล้ว" value={DELIVERIES.filter((d) => d.status === "ส่งถึงแล้ว").length + " ใบ"} />
        <Stat label="ใบสั่งขายที่ยังไม่ได้จัดส่ง" value={waiting.length + " ใบ"} tone={waiting.length ? "warn" : undefined} />
      </div>

      <Card title="ใบส่งของ">
        <table className="w-full text-sm">
          <Head cols={[{ k: "เลขที่" }, { k: "อ้างใบสั่งขาย" }, { k: "วันที่" }, { k: "เส้นทาง" }, { k: "ผู้ขนส่ง" }, { k: "รายการที่ส่ง" }, { k: "สถานะ" }]} />
          <tbody className="divide-y divide-slate-100">
            {DELIVERIES.map((d) => (
              <tr key={d.no} className="hover:bg-sky-50">
                <td className={TH + " font-mono text-xs text-slate-500"}>{d.no}</td>
                <td className={TH + " text-slate-700"}>{d.so}</td>
                <td className={TH + " text-slate-600"}>{d.date}</td>
                <td className={TH + " text-slate-600"}>{d.route}</td>
                <td className={TH + " text-slate-600"}>{d.carrier}</td>
                <td className={TH + " text-slate-700"}>
                  {d.lines.map((l) => material(l.material)?.name + " × " + l.qty).join(" · ")}
                </td>
                <td className={TH}>
                  <span className={"rounded-full px-2 py-1 text-xs " + (
                    d.status === "ส่งถึงแล้ว" ? "bg-emerald-50 text-emerald-700" : "bg-sky-50 text-sky-700"
                  )}>{d.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {waiting.length > 0 && (
        <Card title="รอเปิดใบส่งของ">
          <ul className="divide-y divide-slate-100">
            {waiting.map((so) => (
              <li key={so.no} className="flex justify-between px-4 py-2.5 text-sm">
                <span className="text-slate-800">{so.no} · {customer(so.customer)?.name}</span>
                <span className="text-slate-500">{customer(so.customer)?.address}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function Billing() {
  const billed = BILLINGS.reduce((n, b) => n + orderTotal(SALES_ORDERS.find((s) => s.no === b.so)).gross, 0);
  const collected = BILLINGS.filter((b) => b.paid).reduce((n, b) => n + orderTotal(SALES_ORDERS.find((s) => s.no === b.so)).gross, 0);
  const shippedNotBilled = DELIVERIES.filter((d) => !billingOf(d.so));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="วางบิลแล้ว" value={baht(billed)} />
        <Stat label="เก็บเงินแล้ว" value={baht(collected)} />
        <Stat label="ส่งของแล้วแต่ยังไม่วางบิล" value={shippedNotBilled.length + " ใบ"} tone={shippedNotBilled.length ? "warn" : undefined} />
      </div>

      <Card title="ใบแจ้งหนี้">
        <table className="w-full text-sm">
          <Head cols={[{ k: "เลขที่" }, { k: "ลูกค้า" }, { k: "อ้างใบสั่งขาย" }, { k: "วันที่" }, { k: "ก่อนภาษี", right: true }, { k: "ภาษี", right: true }, { k: "รวม", right: true }, { k: "สถานะ" }]} />
          <tbody className="divide-y divide-slate-100">
            {BILLINGS.map((b) => {
              const so = SALES_ORDERS.find((s) => s.no === b.so);
              const t = orderTotal(so);
              return (
                <tr key={b.no} className="hover:bg-sky-50">
                  <td className={TH + " font-mono text-xs text-slate-500"}>{b.no}</td>
                  <td className={TH + " font-medium text-slate-900"}>{customer(so.customer)?.name}</td>
                  <td className={TH + " text-slate-600"}>{b.so}</td>
                  <td className={TH + " text-slate-600"}>{b.date}</td>
                  <td className={TH + " text-right text-slate-700"}>{baht(t.net)}</td>
                  <td className={TH + " text-right text-slate-600"}>{baht(t.vat)}</td>
                  <td className={TH + " text-right font-semibold text-slate-900"}>{baht(t.gross)}</td>
                  <td className={TH}>
                    <span className={"rounded-full px-2 py-1 text-xs " + (b.paid ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")}>
                      {b.paid ? "เก็บเงินแล้ว" : "ค้างชำระ"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {shippedNotBilled.length > 0 && (
        <Card title="ส่งของแล้วแต่ยังไม่ได้ออกใบแจ้งหนี้ — เงินยังไม่เข้า">
          <ul className="divide-y divide-slate-100">
            {shippedNotBilled.map((d) => {
              const so = SALES_ORDERS.find((s) => s.no === d.so);
              return (
                <li key={d.no} className="flex justify-between px-4 py-2.5 text-sm">
                  <span className="text-slate-800">{d.no} → {so.no} · {customer(so.customer)?.name}</span>
                  <span className="font-medium text-amber-700">{baht(orderTotal(so).gross)}</span>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}

function Credit() {
  const rows = CUSTOMERS.map((c) => ({ c, k: creditCheck(c.code) }));
  const blocked = rows.filter((r) => r.k.blocked);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="วงเงินที่ให้ไว้รวม" value={baht(CUSTOMERS.reduce((n, c) => n + c.creditLimit, 0))} />
        <Stat label="ยอดค้างชำระรวม" value={baht(rows.reduce((n, r) => n + r.k.used, 0))} />
        <Stat label="ลูกค้าที่เกินวงเงิน" value={blocked.length + " ราย"} tone={blocked.length ? "warn" : undefined} />
      </div>

      <Card title="วงเงินเครดิต — เกินวงเงินคือห้ามเปิดใบสั่งขายใบถัดไป">
        <table className="w-full text-sm">
          <Head cols={[{ k: "ลูกค้า" }, { k: "เงื่อนไขชำระ" }, { k: "วงเงิน", right: true }, { k: "ใช้ไป", right: true }, { k: "เหลือ", right: true }, { k: "การใช้วงเงิน" }, { k: "ผล" }]} />
          <tbody className="divide-y divide-slate-100">
            {rows.map(({ c, k }) => {
              const pct = k.limit ? Math.round((k.used / k.limit) * 100) : 0;
              return (
                <tr key={c.code} className="hover:bg-sky-50">
                  <td className={TH + " font-medium text-slate-900"}>{c.name}</td>
                  <td className={TH + " text-slate-600"}>{c.terms}</td>
                  <td className={TH + " text-right text-slate-600"}>{k.cashOnly ? "—" : baht(k.limit)}</td>
                  <td className={TH + " text-right text-slate-700"}>{baht(k.used)}</td>
                  <td className={TH + " text-right " + (k.blocked ? "font-semibold text-rose-600" : "text-slate-700")}>
                    {k.cashOnly ? "—" : baht(k.left)}
                  </td>
                  <td className={TH}>
                    {k.cashOnly ? <span className="text-xs text-slate-400">ขายเงินสด</span> : (
                      <span className="h-2 block w-24 overflow-hidden rounded-full bg-slate-100">
                        <span
                          className={"block h-full rounded-full " + (pct > 100 ? "bg-rose-500" : pct > 80 ? "bg-amber-500" : "bg-emerald-500")}
                          style={{ width: Math.min(100, pct) + "%" }}
                        />
                      </span>
                    )}
                  </td>
                  <td className={TH}>
                    {k.cashOnly ? <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">เงินสด</span>
                      : k.blocked ? <span className="rounded-full bg-rose-50 px-2 py-1 text-xs text-rose-700">เกินวงเงิน</span>
                      : <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-700">ขายต่อได้</span>}
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

function SoDialog({ so, onClose }) {
  const c = customer(so.customer);
  const t = orderTotal(so);
  const k = creditCheck(so.customer);
  const d = deliveryOf(so.no);
  return (
    <div role="dialog" aria-modal="true" onClick={onClose} className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div onClick={(e) => e.stopPropagation()} className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">ใบสั่งขาย {so.no}</h2>
            <p className="text-sm text-slate-500">{c.name} · {c.channel} · {so.date}</p>
          </div>
          <button onClick={onClose} className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100">✕</button>
        </div>

        <table className="mt-4 w-full text-sm">
          <Head cols={[{ k: "สินค้า" }, { k: "จำนวน", right: true }, { k: "ราคาตั้ง", right: true }, { k: "ส่วนลด", right: true }, { k: "ราคาสุทธิ", right: true }, { k: "รวม", right: true }]} />
          <tbody className="divide-y divide-slate-100">
            {t.lines.map((l) => (
              <tr key={l.material}>
                <td className="py-2.5 text-slate-800">{material(l.material)?.name}</td>
                <td className="py-2.5 text-right text-slate-700">{l.qty}</td>
                <td className="py-2.5 text-right text-slate-500">{baht(l.list)}</td>
                <td className="py-2.5 text-right text-slate-600">
                  {l.chan || l.vol
                    ? [l.chan && (l.chan * 100).toFixed(0) + "% ช่องทาง", l.vol && (l.vol * 100).toFixed(0) + "% จำนวน"].filter(Boolean).join(" + ")
                    : "—"}
                </td>
                <td className="py-2.5 text-right text-slate-700">{baht(l.net)}</td>
                <td className="py-2.5 text-right font-medium text-slate-900">{baht(l.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl className="mt-4 divide-y divide-slate-100 text-sm">
          <Line k="รวมก่อนภาษี" v={baht(t.net)} />
          <Line k={"ภาษีมูลค่าเพิ่ม " + (VAT_RATE * 100).toFixed(0) + "%"} v={baht(t.vat)} />
        </dl>
        <div className="mt-4 flex items-center justify-between rounded-xl bg-sky-50 px-4 py-3.5">
          <span className="text-sm font-medium text-sky-900">ยอดที่ลูกค้าต้องชำระ</span>
          <span className="text-xl font-semibold text-sky-900">{baht(t.gross)}</span>
        </div>

        <p className="mt-2 text-xs text-slate-500">
          {k.cashOnly ? "ลูกค้าเงินสด ไม่มีวงเงินเครดิต" : "ใช้วงเงินไปแล้ว " + baht(k.used) + " จาก " + baht(k.limit)}
          {d ? " · จัดส่งทาง " + d.carrier + " (" + d.status + ")" : " · ยังไม่ได้เปิดใบส่งของ"}
        </p>
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
