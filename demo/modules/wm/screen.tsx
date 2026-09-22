import { useState } from "react";
import { material } from "../mm/data";
import {
  WAREHOUSE, STORAGE_TYPES, BINS, INBOUND, PICKS, TRANSFERS, COUNTS,
  bin, storageType, baht, binLoad, freeBins, variance, varianceValue,
} from "./data";
import type { Bin } from "./data";
import { Card, Stat, Head, Row, TH } from "../ui";

const TABS = [
  "ผังคลังและช่องเก็บ",
  "รับเข้าและจัดเก็บ",
  "หยิบสินค้าและจ่ายออก",
  "ย้ายสินค้าภายในคลัง",
  "ตรวจนับสต็อก",
];

export default function WmScreen({ section }: { section?: string }) {
  // Which capability to show is the navigation's decision, not this screen's.
  const tab = section && TABS.includes(section) ? section : TABS[0];
  const [openBin, setOpenBin] = useState<Bin | null>(null);
  const used = BINS.filter((b) => b.material);

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-slate-900">บริหารคลังสินค้า</h1>
        <p className="text-sm text-slate-500">
          {WAREHOUSE.name} · {STORAGE_TYPES.length} พื้นที่ · {BINS.length} ช่องเก็บ · ใช้อยู่ {used.length} ช่อง
        </p>
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

function Layout({ onOpen }: { onOpen: (b: Bin) => void }) {
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
  const done = (no: string, target: string) =>
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
  const take = (no: string) => setJobs((all) => all.map((j) => (j.no === no ? { ...j, status: "หยิบแล้ว" } : j)));
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

function BinDialog({ b, onClose }: { b: Bin; onClose: () => void }) {
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
              <Row k="วัสดุที่เก็บ" v={m.name} />
              <Row k="จำนวน" v={b.qty.toLocaleString("th-TH") + " " + m.unit} />
              <Row k="น้ำหนักต่อหน่วย" v={b.kgPerUnit + " กก."} />
              <Row k="น้ำหนักที่รับอยู่" v={l.kg.toLocaleString("th-TH", { maximumFractionDigits: 1 }) + " กก."} />
              <Row k="เพดานของช่อง" v={b.maxKg.toLocaleString("th-TH") + " กก."} />
              <Row k="มูลค่าที่เก็บอยู่" v={baht(b.qty * m.price)} />
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

