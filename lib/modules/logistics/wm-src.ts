export const WM_DATA = `import { MATERIALS, material } from "../mm/data";

/** ผังคลัง — เลขคลัง → ประเภทพื้นที่ → ช่องเก็บ ตามลำดับชั้นที่ SAP ใช้ */
export const WAREHOUSE = { code: "WH-01", name: "คลังกลาง บางพลี" };

export const STORAGE_TYPES = [
  { code: "REC", name: "พื้นที่รับของ", purpose: "พักของที่เพิ่งรับเข้า รอจัดเก็บ" },
  { code: "BLK", name: "พื้นที่เก็บกอง", purpose: "ของหนักปริมาณมาก หยิบเป็นพาเลท" },
  { code: "PCK", name: "พื้นที่หยิบของ", purpose: "ชั้นหยิบทีละชิ้น เติมของอัตโนมัติ" },
  { code: "SHP", name: "พื้นที่จ่ายออก", purpose: "พักของที่หยิบแล้ว รอขึ้นรถ" },
];

/** ช่องเก็บแต่ละช่องมีเพดานน้ำหนักของตัวเอง — เกินคือห้ามจัดเก็บ */
export const BINS = [
  { code: "A-01-03", type: "BLK", maxKg: 2000, material: "MAT-1001", qty: 240, kgPerUnit: 7.2 },
  { code: "A-01-07", type: "BLK", maxKg: 2000, material: "MAT-1002", qty: 86, kgPerUnit: 8.9 },
  { code: "B-02-01", type: "BLK", maxKg: 1200, material: "MAT-1003", qty: 34, kgPerUnit: 18 },
  { code: "C-01-12", type: "PCK", maxKg: 300, material: "MAT-2001", qty: 18, kgPerUnit: 4.5 },
  { code: "C-02-04", type: "PCK", maxKg: 300, material: "MAT-2002", qty: 320, kgPerUnit: 0.11 },
  { code: "C-03-02", type: "PCK", maxKg: 300, material: "MAT-4001", qty: 6, kgPerUnit: 12 },
  { code: "D-01-01", type: "PCK", maxKg: 200, material: "MAT-3001", qty: 640, kgPerUnit: 0.08 },
  { code: "D-02-06", type: "BLK", maxKg: 800, material: "MAT-3002", qty: 1420, kgPerUnit: 0.25 },
  { code: "E-01-01", type: "BLK", maxKg: 2500, material: "FG-5001", qty: 34, kgPerUnit: 28 },
  { code: "E-01-04", type: "BLK", maxKg: 2500, material: "FG-5002", qty: 12, kgPerUnit: 41 },
  { code: "E-02-02", type: "BLK", maxKg: 2500, material: "FG-5003", qty: 5, kgPerUnit: 62 },
  { code: "REC-01", type: "REC", maxKg: 3000, material: null, qty: 0, kgPerUnit: 0 },
  { code: "REC-02", type: "REC", maxKg: 3000, material: null, qty: 0, kgPerUnit: 0 },
  { code: "SHP-01", type: "SHP", maxKg: 3000, material: null, qty: 0, kgPerUnit: 0 },
];

/** ของที่มาถึงท่ารับ รอสั่งจัดเก็บเข้าช่อง */
export const INBOUND = [
  { no: "TO-IN-4401", material: "MAT-1002", qty: 200, from: "REC-01", suggestBin: "A-01-07", status: "รอจัดเก็บ" },
  { no: "TO-IN-4402", material: "MAT-1003", qty: 14, from: "REC-01", suggestBin: "B-02-01", status: "รอจัดเก็บ" },
  { no: "TO-IN-4399", material: "MAT-2002", qty: 100, from: "REC-02", suggestBin: "C-02-04", status: "จัดเก็บแล้ว" },
];

/** งานหยิบของ — ไล่ตามลำดับช่องเพื่อไม่ต้องเดินย้อน */
export const PICKS = [
  { no: "TO-PK-7712", ref: "DO-2569-0302", material: "FG-5003", qty: 6, bin: "E-02-02", to: "SHP-01", status: "รอหยิบ" },
  { no: "TO-PK-7711", ref: "DO-2569-0303", material: "FG-5001", qty: 3, bin: "E-01-01", to: "SHP-01", status: "หยิบแล้ว" },
  { no: "TO-PK-7710", ref: "PO-P-3301", material: "MAT-1001", qty: 40, bin: "A-01-03", to: "SHP-01", status: "หยิบแล้ว" },
  { no: "TO-PK-7713", ref: "PO-P-3301", material: "MAT-1002", qty: 114, bin: "A-01-07", to: "SHP-01", status: "รอหยิบ" },
];

export const TRANSFERS = [
  { no: "TO-MV-2201", material: "MAT-2002", qty: 80, from: "C-02-04", to: "D-02-06", reason: "ย้ายลงพื้นที่เก็บกอง ช่องหยิบเต็ม", date: "2026-09-19" },
  { no: "TO-MV-2202", material: "MAT-3001", qty: 200, from: "D-02-06", to: "D-01-01", reason: "เติมของเข้าช่องหยิบ", date: "2026-09-20" },
];

/** ตรวจนับ — นับจริงเทียบกับที่ระบบบอก */
export const COUNTS = [
  { bin: "C-01-12", material: "MAT-2001", system: 18, counted: 15, date: "2026-09-20", by: "อนุชา" },
  { bin: "C-02-04", material: "MAT-2002", system: 320, counted: 320, date: "2026-09-20", by: "อนุชา" },
  { bin: "D-01-01", material: "MAT-3001", system: 640, counted: 652, date: "2026-09-21", by: "ธีรศักดิ์" },
  { bin: "E-01-04", material: "FG-5002", system: 12, counted: 12, date: "2026-09-21", by: "ธีรศักดิ์" },
];

export const bin = (code) => BINS.find((b) => b.code === code);
export const storageType = (code) => STORAGE_TYPES.find((t) => t.code === code);
export const baht = (n) => n.toLocaleString("th-TH", { maximumFractionDigits: 0 }) + " ฿";

/** น้ำหนักที่ช่องรับอยู่ตอนนี้ เทียบเพดานของช่องนั้น */
export function binLoad(b) {
  const kg = b.qty * b.kgPerUnit;
  return { kg, pct: Math.round((kg / b.maxKg) * 100), full: kg > b.maxKg };
}

/** ช่องว่างในพื้นที่เดียวกันที่ยังรับน้ำหนักไหว — ใช้เสนอที่จัดเก็บ */
export function freeBins(typeCode) {
  return BINS.filter((b) => b.type === typeCode && (!b.material || binLoad(b).pct < 80));
}

export const variance = (c) => c.counted - c.system;
export function varianceValue(c) {
  return variance(c) * (material(c.material)?.price ?? 0);
}
`;

export const WM_SCREEN = `import { useState } from "react";
import { material } from "../mm/data";
import {
  WAREHOUSE, STORAGE_TYPES, BINS, INBOUND, PICKS, TRANSFERS, COUNTS,
  bin, storageType, baht, binLoad, freeBins, variance, varianceValue,
} from "./data";

const TABS = [
  "ผังคลังและช่องเก็บ",
  "รับเข้าและจัดเก็บ",
  "หยิบสินค้าและจ่ายออก",
  "ย้ายสินค้าภายในคลัง",
  "ตรวจนับสต็อก",
];

export default function WmScreen() {
  const [tab, setTab] = useState(TABS[0]);
  const [openBin, setOpenBin] = useState(null);
  const used = BINS.filter((b) => b.material);

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-slate-900">บริหารคลังสินค้า</h1>
        <p className="text-sm text-slate-500">
          {WAREHOUSE.name} · {STORAGE_TYPES.length} พื้นที่ · {BINS.length} ช่องเก็บ · ใช้อยู่ {used.length} ช่อง
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

      {tab === "ผังคลังและช่องเก็บ" && <Layout onOpen={setOpenBin} />}
      {tab === "รับเข้าและจัดเก็บ" && <Putaway />}
      {tab === "หยิบสินค้าและจ่ายออก" && <Picking />}
      {tab === "ย้ายสินค้าภายในคลัง" && <Transfers />}
      {tab === "ตรวจนับสต็อก" && <Counting />}

      {openBin && <BinDialog b={openBin} onClose={() => setOpenBin(null)} />}

      <div hidden data-fitt-index>
        <button data-fitt-screen="บริหารคลังสินค้า" />
        <button data-fitt-screen="รายละเอียดช่องเก็บ" data-fitt-modal onClick={() => setOpenBin(BINS[0])} />
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

function Layout({ onOpen }) {
  return (
    <div className="space-y-3">
      {STORAGE_TYPES.map((t) => {
        const mine = BINS.filter((b) => b.type === t.code);
        return (
          <Card key={t.code}>
            <div className="flex items-start justify-between border-b border-slate-100 px-4 py-3">
              <div>
                <div className="font-medium text-slate-900">{t.name}</div>
                <div className="text-xs text-slate-500">{t.purpose}</div>
              </div>
              <div className="text-sm text-slate-600">
                {mine.filter((b) => b.material).length}/{mine.length} ช่องมีของ
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2 p-3">
              {mine.map((b) => {
                const l = binLoad(b);
                return (
                  <button
                    key={b.code}
                    onClick={() => onOpen(b)}
                    className={"rounded-lg border px-3 py-2.5 text-left transition hover:border-sky-500 " + (
                      !b.material ? "border-dashed border-slate-300 bg-slate-50"
                      : l.full ? "border-rose-300 bg-rose-50" : "border-slate-200 bg-white"
                    )}
                  >
                    <div className="font-mono text-xs text-slate-500">{b.code}</div>
                    <div className="mt-0.5 truncate text-sm text-slate-800">
                      {b.material ? material(b.material)?.name : "ว่าง"}
                    </div>
                    {b.material && (
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                          <span
                            className={"block h-full rounded-full " + (l.full ? "bg-rose-500" : l.pct > 80 ? "bg-amber-500" : "bg-emerald-500")}
                            style={{ width: Math.min(100, l.pct) + "%" }}
                          />
                        </span>
                        <span className="text-[11px] text-slate-500">{l.pct}%</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function Putaway() {
  const [jobs, setJobs] = useState(INBOUND);
  const done = (no, target) =>
    setJobs((all) => all.map((j) => (j.no === no ? { ...j, status: "จัดเก็บแล้ว", suggestBin: target } : j)));
  const waiting = jobs.filter((j) => j.status === "รอจัดเก็บ");
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="งานรอจัดเก็บ" value={waiting.length + " งาน"} tone={waiting.length ? "warn" : undefined} />
        <Stat label="จัดเก็บแล้ววันนี้" value={jobs.filter((j) => j.status === "จัดเก็บแล้ว").length + " งาน"} />
        <Stat label="ช่องพักรับของ" value={BINS.filter((b) => b.type === "REC").length + " ช่อง"} />
      </div>

      <Card title="ใบสั่งจัดเก็บ — ระบบเสนอช่องให้จากพื้นที่ที่ยังรับน้ำหนักไหว">
        <table className="w-full text-sm">
          <Head cols={[{ k: "เลขที่" }, { k: "วัสดุ" }, { k: "จำนวน", right: true }, { k: "จากช่องพัก" }, { k: "ช่องที่เสนอ" }, { k: "สถานะ" }, { k: "" }]} />
          <tbody className="divide-y divide-slate-100">
            {jobs.map((j) => {
              const target = bin(j.suggestBin);
              const alt = target ? freeBins(target.type).filter((b) => b.code !== target.code) : [];
              return (
                <tr key={j.no} className="hover:bg-sky-50">
                  <td className={TH + " font-mono text-xs text-slate-500"}>{j.no}</td>
                  <td className={TH + " font-medium text-slate-900"}>{material(j.material)?.name}</td>
                  <td className={TH + " text-right text-slate-700"}>{j.qty}</td>
                  <td className={TH + " font-mono text-xs text-slate-500"}>{j.from}</td>
                  <td className={TH}>
                    <span className="font-mono text-xs text-slate-700">{j.suggestBin}</span>
                    {j.status === "รอจัดเก็บ" && alt.length > 0 && (
                      <span className="ml-2 text-[11px] text-slate-400">หรือ {alt.slice(0, 2).map((b) => b.code).join(", ")}</span>
                    )}
                  </td>
                  <td className={TH}>
                    <span className={"rounded-full px-2 py-1 text-xs " + (
                      j.status === "จัดเก็บแล้ว" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                    )}>{j.status}</span>
                  </td>
                  <td className={TH + " text-right"}>
                    {j.status === "รอจัดเก็บ" && (
                      <button onClick={() => done(j.no, j.suggestBin)} className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs text-white hover:bg-sky-700">
                        ยืนยันจัดเก็บ
                      </button>
                    )}
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

function Picking() {
  const [jobs, setJobs] = useState(PICKS);
  const take = (no) => setJobs((all) => all.map((j) => (j.no === no ? { ...j, status: "หยิบแล้ว" } : j)));
  const waiting = jobs.filter((j) => j.status === "รอหยิบ");
  // เรียงตามรหัสช่องเพื่อให้เดินไล่ทางเดียว ไม่ต้องย้อนกลับ
  const route = [...jobs].sort((a, b) => a.bin.localeCompare(b.bin));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="งานรอหยิบ" value={waiting.length + " งาน"} tone={waiting.length ? "warn" : undefined} />
        <Stat label="หยิบแล้ว" value={jobs.filter((j) => j.status === "หยิบแล้ว").length + " งาน"} />
        <Stat label="ช่องที่ต้องเดินผ่าน" value={new Set(waiting.map((j) => j.bin)).size + " ช่อง"} />
      </div>

      <Card title="ใบสั่งหยิบ — เรียงตามลำดับช่องเพื่อเดินทางเดียวจบ">
        <table className="w-full text-sm">
          <Head cols={[{ k: "ลำดับเดิน" }, { k: "เลขที่" }, { k: "อ้างถึง" }, { k: "วัสดุ" }, { k: "จำนวน", right: true }, { k: "หยิบจากช่อง" }, { k: "ไปพักที่" }, { k: "สถานะ" }, { k: "" }]} />
          <tbody className="divide-y divide-slate-100">
            {route.map((j, i) => (
              <tr key={j.no} className="hover:bg-sky-50">
                <td className={TH + " text-slate-400"}>{i + 1}</td>
                <td className={TH + " font-mono text-xs text-slate-500"}>{j.no}</td>
                <td className={TH + " text-slate-600"}>{j.ref}</td>
                <td className={TH + " font-medium text-slate-900"}>{material(j.material)?.name}</td>
                <td className={TH + " text-right text-slate-700"}>{j.qty}</td>
                <td className={TH + " font-mono text-xs text-slate-700"}>{j.bin}</td>
                <td className={TH + " font-mono text-xs text-slate-500"}>{j.to}</td>
                <td className={TH}>
                  <span className={"rounded-full px-2 py-1 text-xs " + (
                    j.status === "หยิบแล้ว" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                  )}>{j.status}</span>
                </td>
                <td className={TH + " text-right"}>
                  {j.status === "รอหยิบ" && (
                    <button onClick={() => take(j.no)} className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs text-white hover:bg-sky-700">
                      ยืนยันหยิบ
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function Transfers() {
  return (
    <Card title="ใบย้ายของภายในคลัง">
      <table className="w-full text-sm">
        <Head cols={[{ k: "เลขที่" }, { k: "วันที่" }, { k: "วัสดุ" }, { k: "จำนวน", right: true }, { k: "จากช่อง" }, { k: "ไปช่อง" }, { k: "เหตุผล" }]} />
        <tbody className="divide-y divide-slate-100">
          {TRANSFERS.map((t) => (
            <tr key={t.no} className="hover:bg-sky-50">
              <td className={TH + " font-mono text-xs text-slate-500"}>{t.no}</td>
              <td className={TH + " text-slate-600"}>{t.date}</td>
              <td className={TH + " font-medium text-slate-900"}>{material(t.material)?.name}</td>
              <td className={TH + " text-right text-slate-700"}>{t.qty}</td>
              <td className={TH + " font-mono text-xs text-slate-700"}>{t.from}</td>
              <td className={TH + " font-mono text-xs text-slate-700"}>{t.to}</td>
              <td className={TH + " text-slate-600"}>{t.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function Counting() {
  const off = COUNTS.filter((c) => variance(c) !== 0);
  const value = COUNTS.reduce((n, c) => n + varianceValue(c), 0);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="ช่องที่นับแล้ว" value={COUNTS.length + " ช่อง"} />
        <Stat label="ช่องที่ยอดไม่ตรง" value={off.length + " ช่อง"} tone={off.length ? "warn" : undefined} />
        <Stat label="ผลต่างเป็นเงิน" value={(value >= 0 ? "+" : "") + baht(value)} tone={value < 0 ? "warn" : undefined} />
      </div>

      <Card title="ผลตรวจนับ — นับจริงเทียบกับที่ระบบบอก">
        <table className="w-full text-sm">
          <Head cols={[{ k: "ช่องเก็บ" }, { k: "วัสดุ" }, { k: "ระบบบอก", right: true }, { k: "นับได้จริง", right: true }, { k: "ผลต่าง", right: true }, { k: "เป็นเงิน", right: true }, { k: "ผู้นับ" }, { k: "วันที่" }]} />
          <tbody className="divide-y divide-slate-100">
            {COUNTS.map((c) => {
              const v = variance(c);
              return (
                <tr key={c.bin} className="hover:bg-sky-50">
                  <td className={TH + " font-mono text-xs text-slate-700"}>{c.bin}</td>
                  <td className={TH + " font-medium text-slate-900"}>{material(c.material)?.name}</td>
                  <td className={TH + " text-right text-slate-600"}>{c.system.toLocaleString("th-TH")}</td>
                  <td className={TH + " text-right text-slate-700"}>{c.counted.toLocaleString("th-TH")}</td>
                  <td className={TH + " text-right font-semibold " + (v === 0 ? "text-slate-400" : v > 0 ? "text-emerald-700" : "text-rose-600")}>
                    {v === 0 ? "ตรง" : (v > 0 ? "+" : "") + v}
                  </td>
                  <td className={TH + " text-right " + (v === 0 ? "text-slate-400" : "text-slate-700")}>
                    {v === 0 ? "—" : (v > 0 ? "+" : "") + baht(varianceValue(c))}
                  </td>
                  <td className={TH + " text-slate-600"}>{c.by}</td>
                  <td className={TH + " text-slate-600"}>{c.date}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function BinDialog({ b, onClose }) {
  const l = binLoad(b);
  const t = storageType(b.type);
  const m = b.material ? material(b.material) : null;
  return (
    <div role="dialog" aria-modal="true" onClick={onClose} className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-mono text-lg font-semibold text-slate-900">{b.code}</h2>
            <p className="text-sm text-slate-500">{t.name} · {WAREHOUSE.name}</p>
          </div>
          <button onClick={onClose} className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100">✕</button>
        </div>

        {m ? (
          <>
            <dl className="mt-4 divide-y divide-slate-100 text-sm">
              <Line k="วัสดุที่เก็บ" v={m.name} />
              <Line k="จำนวน" v={b.qty.toLocaleString("th-TH") + " " + m.unit} />
              <Line k="น้ำหนักต่อหน่วย" v={b.kgPerUnit + " กก."} />
              <Line k="น้ำหนักที่รับอยู่" v={l.kg.toLocaleString("th-TH", { maximumFractionDigits: 1 }) + " กก."} />
              <Line k="เพดานของช่อง" v={b.maxKg.toLocaleString("th-TH") + " กก."} />
              <Line k="มูลค่าที่เก็บอยู่" v={baht(b.qty * m.price)} />
            </dl>
            <div className={"mt-5 rounded-xl px-4 py-3.5 text-sm " + (
              l.full ? "bg-rose-50 text-rose-800" : l.pct > 80 ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800"
            )}>
              {l.full ? "เกินเพดานน้ำหนักของช่องนี้ ต้องย้ายบางส่วนออก"
                : l.pct > 80 ? "ใช้ไป " + l.pct + "% ของเพดาน ใกล้เต็ม เตรียมช่องสำรอง"
                : "ใช้ไป " + l.pct + "% ของเพดาน ยังรับเพิ่มได้"}
            </div>
          </>
        ) : (
          <div className="mt-5 rounded-xl bg-slate-50 px-4 py-3.5 text-sm text-slate-600">
            ช่องว่าง รับได้ถึง {b.maxKg.toLocaleString("th-TH")} กก.
          </div>
        )}
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
