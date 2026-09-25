import { useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowRight, ArrowRightLeft, Ban, Boxes, CalendarClock, CircleCheck, CirclePlay, ClipboardCheck, ClipboardList,
  Cog, Coins, Factory, FileSpreadsheet, FileText, Gauge as GaugeIcon, Hammer, Layers, Lock, PackageCheck,
  PackagePlus, Pencil, Play, Plus, Printer, RefreshCw, Search as SearchIcon, Send, ShoppingCart, Trash2,
  TrendingUp, TriangleAlert, Wrench,
} from "lucide-react";
import { TODAY, material } from "../mm/data";
import {
  BUCKETS, CONFIRMATIONS, DEMAND, MRP_RUNS, ORDERS, ORDER_FLOW, ORDER_STATUSES, PLANNED_ORDERS, PP_MOVEMENTS,
  PURCHASE_PROPOSALS, WORK_CENTERS, availabilityOf, baht, bomOf, bucketOf, can, confirmationsOf, costOf, isOpen,
  loadOf, movementsOf, opLoadOf, overloads, planFinished, product, products, progressOf, removeBomLine,
  removeDemand, removeOperation, removePlannedOrder, routingOf, runMrp, scrapOf, unitCost, workCenter,
} from "./data";
import type { MrpRow, OrderStatus, ProductionOrder } from "./data";
import { PpActions } from "./forms";
import type { Act } from "./forms";
import {
  Badge, Bar, Button, Card, Chip, ColumnChart, Donut, Dot, Gauge, IconButton, IconRow, Note, PageHead, Progress,
  Reveal, Search, Segmented, StatStrip, Stepper, Tabs, Tag, TintCard, swatchFor,
} from "../ui";
import type { StepState } from "../ui";
import { DataTable, DetailModal, downloadCsv, notify, useData } from "../kit";
import type { Column } from "../kit";

const TABS = [
  "ข้อมูลหลักการผลิต",
  "วางแผนความต้องการวัสดุ",
  "วางแผนกำลังการผลิต",
  "ใบสั่งผลิต",
  "รายงานผลการผลิต",
];

const ORDER_TONE: Record<OrderStatus, "idle" | "info" | "warn" | "ok" | "accent" | "bad"> = {
  วางแผนไว้: "idle",
  ปล่อยงานแล้ว: "info",
  กำลังผลิต: "warn",
  ผลิตครบแล้ว: "accent",
  ปิดงานแล้ว: "ok",
  ยกเลิก: "bad",
};

const ORDER_TABS = ["ความคืบหน้า", "วัสดุที่ต้องเบิก", "ขั้นตอนการผลิต", "ต้นทุน", "เอกสาร"];
const ORDER_ICONS: Record<string, ReactNode> = {
  ความคืบหน้า: <GaugeIcon size={13} />,
  วัสดุที่ต้องเบิก: <Boxes size={13} />,
  ขั้นตอนการผลิต: <Cog size={13} />,
  ต้นทุน: <Coins size={13} />,
  เอกสาร: <FileText size={13} />,
};

const STATUS_FILTER = ["ทั้งหมด", ...ORDER_STATUSES];

// Swatches follow the catalogue order of the moment, so a product or a work
// centre added while the demo runs gets the next colour rather than a clash.
const productSwatch = (code: string) => swatchFor(code, products().map((p) => p.code));
const wcSwatch = (code: string) => swatchFor(code, WORK_CENTERS.map((w) => w.code));

/** The small icon buttons at the end of a row: edit, remove, print. */
function RowButton({ label, onClick, children, tone = "violet" }: { label: string; onClick: () => void; children: ReactNode; tone?: "violet" | "rose" | "emerald" }) {
  const hover =
    tone === "rose"
      ? "hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/15 dark:hover:text-rose-300"
      : tone === "emerald"
        ? "hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-500/15 dark:hover:text-emerald-300"
        : "hover:bg-violet-50 hover:text-violet-600 dark:hover:bg-violet-500/15 dark:hover:text-violet-300";
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={"grid size-7 shrink-0 place-items-center rounded-lg text-slate-400 transition dark:text-slate-500 " + hover}
    >
      {children}
    </button>
  );
}

const exportIcon = <FileSpreadsheet size={14} />;

/* ----------------------------------------------------------------- screen */

export default function PpScreen({
  section,
  onOpenSection,
}: {
  section?: string;
  onOpenSection?: (index: number) => void;
}) {
  useData();
  const tab = section && TABS.includes(section) ? section : undefined;

  const [openNo, setOpenNo] = useState<string | null>(null);
  const [act, setAct] = useState<Act | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("ทั้งหมด");

  const needle = q.trim().toLowerCase();
  const rows = ORDERS.filter(
    (o) =>
      (status === "ทั้งหมด" || o.status === status) &&
      (needle === "" || [o.no, product(o.product).name].some((t) => t.toLowerCase().includes(needle)))
  );
  const picked = openNo === null ? null : (ORDERS.find((o) => o.no === openNo) ?? null);
  const pickedAt = picked ? rows.indexOf(picked) : -1;

  const mrp = runMrp();
  const shortages = mrp.filter((m) => m.shortage > 0);

  const openOrder = (no: string) => {
    setQ("");
    setStatus("ทั้งหมด");
    setOpenNo(no);
  };

  const panels = (
    <>
      <DetailModal
        open={picked !== null}
        title="ใบสั่งผลิต"
        onClose={() => setOpenNo(null)}
        index={pickedAt}
        total={rows.length}
        onStep={
          pickedAt >= 0
            ? (d) => {
                const next = rows[pickedAt + d];
                if (next) setOpenNo(next.no);
              }
            : undefined
        }
      >
        {picked && <OrderRecord key={picked.no} order={picked} onAct={setAct} />}
      </DetailModal>

      <PpActions act={act} onAct={setAct} onOpenOrder={openOrder} />
    </>
  );

  if (!tab) {
    return (
      <>
        <Overview shortages={shortages} onOpenSection={onOpenSection} onOpenOrder={(o) => openOrder(o.no)} onAct={setAct} />
        {panels}
      </>
    );
  }

  const first = <T,>(list: T[], test: (x: T) => boolean) => list.find(test) ?? list[0];

  return (
    <div>
      <PageHead
        title="วางแผนการผลิต"
        meta={`${tab} · ${products().length} สินค้า · ${ORDERS.filter(isOpen).length} ใบสั่งผลิตที่เปิดอยู่`}
      />

      {tab === "ข้อมูลหลักการผลิต" && <MasterData onAct={setAct} />}
      {tab === "วางแผนความต้องการวัสดุ" && <Mrp mrp={mrp} onAct={setAct} onOpenOrder={openOrder} />}
      {tab === "วางแผนกำลังการผลิต" && <Capacity onAct={setAct} onOpen={(o) => setOpenNo(o.no)} />}
      {tab === "ใบสั่งผลิต" && (
        <Orders
          rows={rows}
          q={q}
          setQ={setQ}
          status={status}
          setStatus={setStatus}
          onOpen={(o) => setOpenNo(o.no)}
          onAct={setAct}
        />
      )}
      {tab === "รายงานผลการผลิต" && <Report onAct={setAct} onOpen={(o) => openOrder(o.no)} />}

      {panels}

      <div hidden data-fitt-index>
        <button data-fitt-screen="วางแผนการผลิต" />
        <button data-fitt-screen="ใบสั่งผลิต" data-fitt-modal onClick={() => setOpenNo(ORDERS[0].no)} />
        <button data-fitt-screen="สร้างใบสั่งผลิต" data-fitt-modal onClick={() => setAct({ kind: "order-new" })} />
        <button data-fitt-screen="แก้ไขใบสั่งผลิต" data-fitt-modal onClick={() => setAct({ kind: "order-edit", order: first(ORDERS, can.edit) })} />
        <button data-fitt-screen="ปล่อยงานเข้าสายการผลิต" data-fitt-modal onClick={() => setAct({ kind: "release", order: first(ORDERS, can.release) })} />
        <button data-fitt-screen="เบิกวัสดุเข้าใบสั่งผลิต" data-fitt-modal onClick={() => setAct({ kind: "issue", order: first(ORDERS, can.issue) })} />
        <button data-fitt-screen="บันทึกผลผลิต" data-fitt-modal onClick={() => setAct({ kind: "confirm", order: ORDERS.find(can.confirm) ?? null })} />
        <button data-fitt-screen="รับสินค้าเข้าคลัง" data-fitt-modal onClick={() => setAct({ kind: "receipt", order: first(ORDERS, can.receive) })} />
        <button data-fitt-screen="ปิดงานใบสั่งผลิต" data-fitt-modal onClick={() => setAct({ kind: "teco", order: first(ORDERS, can.complete) })} />
        <button data-fitt-screen="ยกเลิกใบสั่งผลิต" data-fitt-modal onClick={() => setAct({ kind: "cancel", order: first(ORDERS, can.cancel) })} />
        <button data-fitt-screen="เลื่อนวันผลิต" data-fitt-modal onClick={() => setAct({ kind: "reschedule", order: first(ORDERS, can.reschedule) })} />
        <button data-fitt-screen="ย้ายศูนย์งาน" data-fitt-modal onClick={() => setAct({ kind: "move", order: first(ORDERS, can.move) })} />
        <button data-fitt-screen="พิมพ์ใบสั่งผลิต" data-fitt-modal onClick={() => setAct({ kind: "print-order", order: ORDERS[0] })} />
        <button
          data-fitt-screen="พิมพ์ใบเบิกวัสดุ"
          data-fitt-modal
          onClick={() => {
            const mv = PP_MOVEMENTS[PP_MOVEMENTS.length - 1];
            setAct(
              mv
                ? { kind: "print-slip", order: ORDERS.find((o) => o.no === mv.order)!, movement: mv }
                : { kind: "print-slip", order: first(ORDERS, (o) => o.components.some((c) => c.qty > c.issued)) }
            );
          }}
        />
        <button data-fitt-screen="เพิ่มวัสดุในสูตรการผลิต" data-fitt-modal onClick={() => setAct({ kind: "bom", product: products()[0].code, line: null })} />
        <button data-fitt-screen="เพิ่มขั้นตอนการผลิต" data-fitt-modal onClick={() => setAct({ kind: "op", product: products()[0].code, op: null })} />
        <button data-fitt-screen="เพิ่มศูนย์งาน" data-fitt-modal onClick={() => setAct({ kind: "wc", wc: null })} />
        <button data-fitt-screen="เพิ่มความต้องการ" data-fitt-modal onClick={() => setAct({ kind: "demand" })} />
        <button data-fitt-screen="รัน MRP" data-fitt-modal onClick={() => setAct({ kind: "mrp" })} />
        <button
          data-fitt-screen="แปลงเป็นใบสั่งผลิต"
          data-fitt-modal
          onClick={() => {
            const p = PLANNED_ORDERS.find((x) => x.status === "ตามแผน");
            if (p) setAct({ kind: "convert", planned: p });
          }}
        />
        <button data-fitt-screen="ส่งข้อเสนอซื้อให้ฝ่ายจัดซื้อ" data-fitt-modal onClick={() => setAct({ kind: "send" })} />
        <button data-fitt-screen="พิมพ์ใบเสนอซื้อ" data-fitt-modal onClick={() => setAct({ kind: "print-proposals" })} />
        <button data-fitt-screen="พิมพ์รายงานผลการผลิต" data-fitt-modal onClick={() => setAct({ kind: "print-report" })} />
        <button
          data-fitt-screen="ลบความต้องการ"
          data-fitt-modal
          onClick={() => {
            const d = DEMAND[DEMAND.length - 1];
            if (d) setAct(removeDemandAct(d.no));
          }}
        />
      </div>
    </div>
  );
}

function removeDemandAct(no: string): Act {
  const d = DEMAND.find((x) => x.no === no)!;
  return {
    kind: "remove",
    title: "ลบความต้องการ",
    body: "ความต้องการนี้จะไม่ถูกนำไปวางแผนในการรัน MRP รอบถัดไป ใบสั่งผลิตที่เปิดไปแล้วไม่ถูกกระทบ",
    subject: `${d.no} · ${product(d.product).name} ${d.qty} ${product(d.product).unit} · ส่ง ${d.dueDate}`,
    confirmLabel: "ลบความต้องการ",
    run: () => {
      removeDemand(no);
      return `ลบความต้องการ ${no} แล้ว`;
    },
  };
}

/* ------------------------------------------------------------- overview */

function Overview({
  shortages,
  onOpenSection,
  onOpenOrder,
  onAct,
}: {
  shortages: MrpRow[];
  onOpenSection?: (index: number) => void;
  onOpenOrder: (o: ProductionOrder) => void;
  onAct: (a: Act) => void;
}) {
  useData();
  const open = ORDERS.filter(isOpen);
  const planned = open.reduce((n, o) => n + o.qty, 0);
  const made = open.reduce((n, o) => n + o.done, 0);

  const load = WORK_CENTERS.map((w) => {
    const hrs = loadOf(w.code);
    return { w, hrs, pct: Math.round((hrs / w.capacityHrs) * 100) };
  });
  const over = overloads();
  const coverage = planFinished();

  const seeAll = (index: number) =>
    onOpenSection ? (
      <button
        onClick={() => onOpenSection(index)}
        className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[12px] text-slate-600 transition hover:border-violet-300 hover:text-violet-700 dark:border-slate-700 dark:text-slate-300"
      >
        ดูทั้งหมด <ArrowRight size={12} />
      </button>
    ) : undefined;

  return (
    <div>
      <PageHead
        title="ภาพรวมการผลิต"
        meta={`${open.length} ใบสั่งผลิตที่เปิดอยู่ · ${WORK_CENTERS.length} ศูนย์งาน · ข้อมูล ณ ${TODAY}`}
        right={
          <span className="flex flex-wrap gap-2">
            <Button variant="secondary" icon={<Plus size={15} />} onClick={() => onAct({ kind: "order-new" })}>
              สร้างใบสั่งผลิต
            </Button>
            {onOpenSection && (
              <Button variant="primary" icon={<Factory size={15} />} onClick={() => onOpenSection(3)}>
                เปิดใบสั่งผลิต
              </Button>
            )}
          </span>
        }
      />

      <Reveal>
        <div className="grid gap-3 xl:grid-cols-3">
          <Card
            title={<span className="flex items-center gap-2"><GaugeIcon size={15} className="text-slate-400" />ผลิตได้เทียบแผน</span>}
            action={seeAll(4)}
          >
            <div className="px-4 pt-3">
              <Gauge value={made} max={planned} label={`ตามแผน ${planned} หน่วย`} hex="#7c3aed" size={210} />
            </div>
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {open.map((o) => (
                <li key={o.no} className="flex items-center gap-3 px-4 py-2">
                  <Dot className={productSwatch(o.product).dot} />
                  <button onClick={() => onOpenOrder(o)} className="min-w-0 flex-1 truncate text-left text-[12.5px] text-slate-800 hover:text-violet-700 dark:text-slate-100">
                    {o.no}
                  </button>
                  <span className="shrink-0 text-[11.5px] tabular-nums text-slate-500 dark:text-slate-400">
                    {o.done}/{o.qty}
                  </span>
                  <Badge tone={ORDER_TONE[o.status]}>{o.status}</Badge>
                </li>
              ))}
            </ul>
          </Card>

          <Card
            title={<span className="flex items-center gap-2"><Factory size={15} className="text-slate-400" />ภาระงานต่อศูนย์งาน</span>}
            subtitle={`รอบ ${BUCKETS[0].label}`}
            action={seeAll(2)}
          >
            <div className="space-y-3 p-4">
              {load.map((l) => (
                <div key={l.w.code}>
                  <div className="mb-1 flex items-center gap-2 text-[12.5px]">
                    <Dot className={wcSwatch(l.w.code).dot} />
                    <span className="min-w-0 flex-1 truncate text-slate-700 dark:text-slate-200">{l.w.name}</span>
                    <span className={"tabular-nums " + (l.pct > 100 ? "font-semibold text-rose-600 dark:text-rose-400" : "text-slate-500 dark:text-slate-400")}>
                      {l.hrs.toFixed(1)} / {l.w.capacityHrs} ชม.
                    </span>
                  </div>
                  <Bar pct={Math.min(100, l.pct)} tone={l.pct > 100 ? "bad" : l.pct > 80 ? "warn" : "ok"} width="w-full" />
                </div>
              ))}
              {over.length > 0 && (
                <Note tone="bad">
                  {over.map((l) => `${l.w.name} รอบ ${l.bucket.label} (${l.pct}%)`).join(" · ")} รับงานเกินกำลัง
                  ต้องย้ายศูนย์งาน เลื่อนใบสั่งผลิตออกไป หรือเพิ่มกะ
                </Note>
              )}
            </div>
          </Card>

          <Card
            title={<span className="flex items-center gap-2"><ShoppingCart size={15} className="text-slate-400" />วัสดุที่ต้องซื้อเพิ่ม</span>}
            action={seeAll(1)}
          >
            <div className="space-y-3 p-4">
              {shortages.length === 0 ? (
                <p className="py-10 text-center text-[12.5px] text-slate-400">วัสดุในคลังและที่สั่งไว้พอสำหรับแผนทั้งหมด</p>
              ) : (
                shortages.slice(0, 3).map((m) => {
                  const sw = swatchFor(m.code);
                  return (
                    <TintCard key={m.code} swatch={sw}>
                      <div className="flex items-start justify-between gap-2">
                        <span className="min-w-0">
                          <span className="block truncate text-[13.5px] font-semibold">{m.name}</span>
                          <span className="block font-mono text-[11.5px] opacity-75">{m.code}</span>
                        </span>
                        <Tag swatch={sw}>ขาด {m.shortage}</Tag>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-2 text-[11.5px] opacity-75">
                        <span>
                          ต้องใช้ {m.required} · มีอยู่ {m.onHand} · สั่งไว้ {m.onOrder + m.proposed} {m.unit}
                        </span>
                        <span className="tabular-nums">{baht(m.shortage * m.price)}</span>
                      </div>
                    </TintCard>
                  );
                })
              )}
            </div>
          </Card>
        </div>
      </Reveal>

      <Reveal delay={0.08} className="mt-3">
        <div className="grid gap-3 xl:grid-cols-2">
          <Card
            title={<span className="flex items-center gap-2"><Coins size={15} className="text-slate-400" />ต้นทุนต่อหน่วยรายสินค้า</span>}
            subtitle="วัสดุตามสูตรการผลิต บวกค่าแรงตามขั้นตอนที่ผ่าน"
          >
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {products().map((p) => {
                const c = unitCost(p.code);
                if (bomOf(p.code).length === 0) {
                  return (
                    <li key={p.code} className="flex items-center gap-2.5 px-4 py-3">
                      <Dot className={productSwatch(p.code).dot} />
                      <span className="min-w-0 flex-1 truncate text-[13px] text-slate-900 dark:text-slate-50">{p.name}</span>
                      <Badge tone="warn">ยังไม่มีสูตรการผลิต</Badge>
                    </li>
                  );
                }
                return (
                  <li key={p.code} className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <Dot className={productSwatch(p.code).dot} />
                      <span className="min-w-0 flex-1 truncate text-[13px] text-slate-900 dark:text-slate-50">{p.name}</span>
                      <span className="shrink-0 text-[13px] font-semibold tabular-nums text-slate-900 dark:text-slate-50">
                        {baht(c.total)}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="w-14 shrink-0 text-[11px] text-slate-400">วัสดุ</span>
                      <span className="min-w-0 flex-1">
                        <Bar pct={(c.material / c.total) * 100} tone="accent" width="w-full" />
                      </span>
                      <span className="w-24 shrink-0 text-right text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
                        {baht(c.material)}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="w-14 shrink-0 text-[11px] text-slate-400">ค่าแรง</span>
                      <span className="min-w-0 flex-1">
                        <Bar pct={(c.labour / c.total) * 100} tone="info" width="w-full" />
                      </span>
                      <span className="w-24 shrink-0 text-right text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
                        {baht(c.labour)}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card
            title={<span className="flex items-center gap-2"><CalendarClock size={15} className="text-slate-400" />ความต้องการที่ต้องส่ง</span>}
            subtitle="ยอดเหล่านี้คือสิ่งที่ป้อนเข้าการวางแผนความต้องการวัสดุ"
            action={seeAll(1)}
          >
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {coverage.map(({ demand: d, short }) => {
                const p = product(d.product);
                const sw = productSwatch(d.product);
                const plan = PLANNED_ORDERS.find((x) => x.demand === d.no);
                return (
                  <li key={d.no} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <span className={"grid size-9 shrink-0 place-items-center rounded-xl " + sw.tint}>
                      <Hammer size={16} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] text-slate-900 dark:text-slate-50">{p.name}</span>
                      <span className="block text-[11.5px] text-slate-400">
                        {d.qty} {p.unit} · ต้องส่ง {d.dueDate} · {d.source}
                      </span>
                    </span>
                    {short === 0 ? (
                      <Badge tone="ok" dot>ครอบคลุมแล้ว</Badge>
                    ) : plan?.order ? (
                      <button onClick={() => onOpenOrder(ORDERS.find((o) => o.no === plan.order)!)} className="shrink-0">
                        <Badge tone="info" dot>{plan.order}</Badge>
                      </button>
                    ) : (
                      <Badge tone="warn">ต้องผลิตเพิ่ม {short}</Badge>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      </Reveal>
    </div>
  );
}

/* ------------------------------------------------------------ master data */

function MasterData({ onAct }: { onAct: (a: Act) => void }) {
  useData();
  const list = products();
  const [pick, setPick] = useState(list[0].code);
  const p = product(pick);
  const cost = unitCost(pick);
  const sw = productSwatch(pick);
  const bom = bomOf(pick);
  const routing = routingOf(pick);

  const exportBom = () => {
    downloadCsv(
      `สูตรการผลิต-${pick}`,
      ["สินค้า", "รหัสวัสดุ", "วัสดุ", "ใช้ต่อหน่วย", "หน่วย", "เผื่อสูญเสีย %", "ราคาต่อหน่วย", "เป็นเงิน"],
      bom.map((l) => {
        const m = material(l.material);
        return [p.name, l.material, m.name, l.qty, m.unit, l.scrap, m.price, Math.round(l.qty * (1 + l.scrap / 100) * m.price * 100) / 100];
      })
    );
    notify(`ส่งออกสูตรการผลิต${p.name} ${bom.length} บรรทัดแล้ว`);
  };

  const removeLine = (code: string): Act => ({
    kind: "remove",
    title: "ลบวัสดุออกจากสูตร",
    body: "ใบสั่งผลิตที่เปิดไปแล้วยังใช้สูตรเดิมที่คัดลอกไว้ ใบที่เปิดใหม่และการวางแผนวัสดุจะไม่มีวัสดุนี้",
    subject: `${material(code).name} ใน${p.name}`,
    confirmLabel: "ลบออกจากสูตร",
    run: () => {
      removeBomLine(pick, code);
      return `ลบ${material(code).name}ออกจากสูตร${p.name}แล้ว`;
    },
  });

  const removeOp = (op: string): Act => ({
    kind: "remove",
    title: "ลบขั้นตอนการผลิต",
    body: "ใบสั่งผลิตที่เปิดไปแล้วยังใช้ขั้นตอนเดิม ใบที่เปิดใหม่จะไม่ผ่านขั้นตอนนี้",
    subject: `ขั้นตอน ${op} ของ${p.name}`,
    confirmLabel: "ลบขั้นตอน",
    run: () => {
      removeOperation(pick, op);
      return `ลบขั้นตอน ${op} ของ${p.name}แล้ว`;
    },
  });

  return (
    <div className="space-y-3">
      <Segmented options={list.map((x) => x.name)} value={p.name} onChange={(name) => setPick(list.find((x) => x.name === name)!.code)} />

      <div className="grid gap-3 xl:grid-cols-3">
        <Card
          className="xl:col-span-2"
          title={<span className="flex items-center gap-2"><Layers size={15} className="text-slate-400" />สูตรการผลิต</span>}
          subtitle="ผลิตหนึ่งหน่วยต้องใช้วัสดุอะไรบ้าง ราคาอ่านจากแฟ้มวัสดุ"
          action={
            <span className="flex gap-1.5">
              <Button variant="ghost" icon={exportIcon} onClick={exportBom} disabled={bom.length === 0}>
                ส่งออก Excel
              </Button>
              <Button variant="secondary" icon={<Plus size={14} />} onClick={() => onAct({ kind: "bom", product: pick, line: null })}>
                เพิ่มวัสดุ
              </Button>
            </span>
          }
        >
          {bom.length === 0 ? (
            <div className="space-y-3 px-4 py-10 text-center">
              <p className="text-[13px] text-slate-500 dark:text-slate-400">{p.name} ยังไม่มีสูตรการผลิต เปิดใบสั่งผลิตไม่ได้จนกว่าจะมีสูตร</p>
              <Button variant="primary" icon={<Plus size={14} />} onClick={() => onAct({ kind: "bom", product: pick, line: null })}>
                สร้างสูตรการผลิต
              </Button>
            </div>
          ) : (
            <table className="w-full text-[13px]">
              <thead className="bg-slate-50/80 text-left text-[11px] uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">วัสดุ</th>
                  <th className="px-4 py-3 text-right font-medium">ใช้ต่อหน่วย</th>
                  <th className="px-4 py-3 text-right font-medium">เผื่อสูญเสีย</th>
                  <th className="px-4 py-3 text-right font-medium">ราคาต่อหน่วย</th>
                  <th className="px-4 py-3 text-right font-medium">เป็นเงิน</th>
                  <th className="w-20 px-2 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {bom.map((l) => {
                  const m = material(l.material);
                  return (
                    <tr key={l.material} className="transition hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-2.5">
                        <span className="block text-slate-900 dark:text-slate-50">{m.name}</span>
                        <span className="block font-mono text-[11px] text-slate-400">{l.material}</span>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-300">
                        {l.qty} {m.unit}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-slate-500 dark:text-slate-400">{l.scrap ? l.scrap + "%" : "—"}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-300">{baht(m.price)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-slate-900 dark:text-slate-50">
                        {baht(l.qty * (1 + l.scrap / 100) * m.price)}
                      </td>
                      <td className="px-2 py-2.5">
                        <span className="flex justify-end gap-0.5">
                          <RowButton label="แก้ไข" onClick={() => onAct({ kind: "bom", product: pick, line: l })}>
                            <Pencil size={14} />
                          </RowButton>
                          <RowButton label="ลบออกจากสูตร" tone="rose" onClick={() => onAct(removeLine(l.material))}>
                            <Trash2 size={14} />
                          </RowButton>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-50/80 dark:bg-slate-800/60">
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-right font-medium text-slate-600 dark:text-slate-300">
                    รวมค่าวัสดุต่อหน่วย
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-900 dark:text-slate-50">{baht(cost.material)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          )}
        </Card>

        <Card
          title={<span className="flex items-center gap-2"><Coins size={15} className="text-slate-400" />ต้นทุนต่อหน่วย</span>}
          subtitle={p.name}
        >
          <div className="space-y-4 p-4">
            <div className={"rounded-2xl p-4 " + sw.tint}>
              <p className="text-[11.5px] opacity-75">ต้นทุนรวมต่อหน่วย</p>
              <p className="mt-1 text-[26px] font-semibold tabular-nums">{baht(cost.total)}</p>
              <p className="mt-1 text-[11.5px] opacity-75">ต้นทุนมาตรฐานในแฟ้มวัสดุ {baht(p.price)}</p>
            </div>
            {cost.total > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[12.5px]">
                  <span className="w-16 shrink-0 text-slate-600 dark:text-slate-300">วัสดุ</span>
                  <span className="min-w-0 flex-1">
                    <Bar pct={(cost.material / cost.total) * 100} tone="accent" width="w-full" />
                  </span>
                  <span className="w-24 shrink-0 text-right tabular-nums text-slate-700 dark:text-slate-200">{baht(cost.material)}</span>
                </div>
                <div className="flex items-center gap-2 text-[12.5px]">
                  <span className="w-16 shrink-0 text-slate-600 dark:text-slate-300">ค่าแรง</span>
                  <span className="min-w-0 flex-1">
                    <Bar pct={(cost.labour / cost.total) * 100} tone="info" width="w-full" />
                  </span>
                  <span className="w-24 shrink-0 text-right tabular-nums text-slate-700 dark:text-slate-200">{baht(cost.labour)}</span>
                </div>
              </div>
            )}
            <Note tone={Math.abs(p.price - cost.total) < 1 ? "ok" : "warn"}>
              {Math.abs(p.price - cost.total) < 1
                ? "ต้นทุนที่คำนวณจากสูตรตรงกับต้นทุนมาตรฐานที่ใช้ตีมูลค่าสต็อก"
                : `ต้นทุนที่คำนวณต่างจากต้นทุนมาตรฐาน ${baht(Math.abs(p.price - cost.total))} ควรปรับต้นทุนมาตรฐานให้ตรงกับสูตรปัจจุบัน`}
            </Note>
          </div>
        </Card>
      </div>

      <Card
        title={<span className="flex items-center gap-2"><Cog size={15} className="text-slate-400" />ขั้นตอนการผลิตและศูนย์งาน</span>}
        subtitle="เรียงตามลำดับที่ของต้องผ่าน ชั่วโมงคิดต่อหนึ่งหน่วย"
        action={
          <Button variant="secondary" icon={<Plus size={14} />} onClick={() => onAct({ kind: "op", product: pick, op: null })}>
            เพิ่มขั้นตอน
          </Button>
        }
      >
        {routing.length === 0 ? (
          <p className="px-4 py-10 text-center text-[13px] text-slate-400">ยังไม่มีขั้นตอนการผลิต</p>
        ) : (
          <ol className="divide-y divide-slate-100 dark:divide-slate-800">
            {routing.map((r) => {
              const w = workCenter(r.wc);
              return (
                <li key={r.op} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <span className={"grid h-8 w-12 shrink-0 place-items-center rounded-full font-mono text-[11px] font-semibold " + wcSwatch(r.wc).tint}>
                    {r.op}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-slate-900 dark:text-slate-50">{r.text}</span>
                    <span className="block text-[11.5px] text-slate-400">
                      {w.name} · <span className="font-mono">{w.code}</span>
                    </span>
                  </span>
                  <Chip>{r.hrs} ชม./หน่วย</Chip>
                  <span className="w-28 shrink-0 text-right text-[12.5px] tabular-nums text-slate-500 dark:text-slate-400">
                    {baht(w.costPerHr)}/ชม.
                  </span>
                  <span className="w-24 shrink-0 text-right text-[13px] tabular-nums text-slate-900 dark:text-slate-50">
                    {baht(r.hrs * w.costPerHr)}
                  </span>
                  <span className="flex gap-0.5">
                    <RowButton label="แก้ไขขั้นตอน" onClick={() => onAct({ kind: "op", product: pick, op: r })}>
                      <Pencil size={14} />
                    </RowButton>
                    <RowButton label="ลบขั้นตอน" tone="rose" onClick={() => onAct(removeOp(r.op))}>
                      <Trash2 size={14} />
                    </RowButton>
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </Card>

      <Card
        title={<span className="flex items-center gap-2"><Wrench size={15} className="text-slate-400" />ศูนย์งาน</span>}
        subtitle="กำลังการผลิตต่อรอบวางแผนสองสัปดาห์ และอัตราค่าแรงรวมเครื่องจักรที่ใช้คิดต้นทุน"
        action={
          <Button variant="secondary" icon={<Plus size={14} />} onClick={() => onAct({ kind: "wc", wc: null })}>
            เพิ่มศูนย์งาน
          </Button>
        }
      >
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {WORK_CENTERS.map((w) => (
            <li key={w.code} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
              <Dot className={wcSwatch(w.code).dot} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] text-slate-900 dark:text-slate-50">{w.name}</span>
                <span className="block font-mono text-[11px] text-slate-400">{w.code}</span>
              </span>
              <Tag swatch={wcSwatch(w.code)}>{w.kind}</Tag>
              <span className="w-28 shrink-0 text-right text-[12.5px] tabular-nums text-slate-600 dark:text-slate-300">{w.capacityHrs} ชม./รอบ</span>
              <span className="w-24 shrink-0 text-right text-[12.5px] tabular-nums text-slate-600 dark:text-slate-300">{baht(w.costPerHr)}/ชม.</span>
              <RowButton label="แก้ไขศูนย์งาน" onClick={() => onAct({ kind: "wc", wc: w })}>
                <Pencil size={14} />
              </RowButton>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

/* -------------------------------------------------------------------- mrp */

function Mrp({ mrp, onAct, onOpenOrder }: { mrp: MrpRow[]; onAct: (a: Act) => void; onOpenOrder: (no: string) => void }) {
  useData();
  const short = mrp.filter((m) => m.shortage > 0);
  const buyValue = short.reduce((n, m) => n + m.shortage * m.price, 0);
  const coverage = planFinished();
  const lastRun = MRP_RUNS[MRP_RUNS.length - 1];
  const waiting = PURCHASE_PROPOSALS.filter((p) => p.status === "เสนอซื้อ");

  const exportMrp = () => {
    downloadCsv(
      "ผลการวางแผนความต้องการวัสดุ",
      ["รหัส", "วัสดุ", "ต้องใช้", "มีในคลัง", "สั่งไว้แล้ว", "ต้องซื้อเพิ่ม", "หน่วย", "เป็นเงิน", "ต้องการภายใน"],
      mrp.map((m) => [m.code, m.name, m.required, m.onHand, m.onOrder + m.proposed, m.shortage, m.unit, m.shortage * m.price, m.needBy])
    );
    notify(`ส่งออกผลการกางสูตร ${mrp.length} รายการแล้ว`);
  };

  const exportProposals = () => {
    downloadCsv(
      "ข้อเสนอซื้อจาก MRP",
      ["เลขที่", "รอบ MRP", "รหัส", "วัสดุ", "จำนวน", "หน่วย", "ต้องการภายใน", "สถานะ"],
      PURCHASE_PROPOSALS.map((p) => [p.no, p.run, p.material, material(p.material).name, p.qty, material(p.material).unit, p.needBy, p.status])
    );
    notify(`ส่งออกข้อเสนอซื้อ ${PURCHASE_PROPOSALS.length} รายการแล้ว`);
  };

  return (
    <div className="space-y-3">
      <StatStrip
        title="ผลการกางสูตรและหักสต็อก"
        icon={<ClipboardList size={15} />}
        cells={[
          { icon: <CalendarClock size={13} />, label: "ความต้องการที่ป้อนเข้า", value: DEMAND.length + " รายการ", sub: `ต้องผลิตเพิ่ม ${coverage.filter((c) => c.short > 0).length} รายการ` },
          { icon: <Boxes size={13} />, label: "วัสดุที่ต้องใช้", value: mrp.length + " รายการ", sub: "จากใบสั่งผลิตที่เปิดอยู่และส่วนที่ต้องผลิตเพิ่ม", tone: "info" },
          { icon: <TriangleAlert size={13} />, label: "ขาดสต็อก", value: short.length + " รายการ", sub: "หักสต็อกและของที่สั่งไว้แล้ว", tone: short.length > 0 ? "warn" : "ok" },
          { icon: <Coins size={13} />, label: "มูลค่าที่ต้องซื้อ", value: baht(buyValue), sub: "คิดจากราคาต่อหน่วยในแฟ้มวัสดุ", tone: "accent" },
        ]}
      />

      <div className="grid gap-3 xl:grid-cols-2">
        <Card
          title={<span className="flex items-center gap-2"><CalendarClock size={15} className="text-slate-400" />ความต้องการที่ป้อนเข้า</span>}
          subtitle="เรียงตามวันส่ง ส่วนที่สต็อกและใบสั่งผลิตที่เปิดอยู่ไม่พอคือส่วนที่ต้องผลิตเพิ่ม"
          action={
            <Button variant="secondary" icon={<Plus size={14} />} onClick={() => onAct({ kind: "demand" })}>
              เพิ่มความต้องการ
            </Button>
          }
        >
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {coverage.map(({ demand: d, covered, short: need }) => {
              const p = product(d.product);
              return (
                <li key={d.no} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                  <span className="w-16 shrink-0 font-mono text-[11.5px] text-slate-400">{d.no}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] text-slate-900 dark:text-slate-50">
                      {p.name} · {d.qty} {p.unit}
                    </span>
                    <span className="block truncate text-[11.5px] text-slate-400">
                      ส่ง {d.dueDate} · {d.source}
                    </span>
                  </span>
                  {need === 0 ? <Badge tone="ok">ครอบคลุม</Badge> : <Badge tone="warn">มี {covered} · ต้องผลิต {need}</Badge>}
                  <RowButton label="ลบความต้องการ" tone="rose" onClick={() => onAct(removeDemandAct(d.no))}>
                    <Trash2 size={14} />
                  </RowButton>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card
          title={<span className="flex items-center gap-2"><RefreshCw size={15} className="text-slate-400" />ผลรัน MRP ล่าสุด</span>}
          subtitle={lastRun ? `${lastRun.no} เมื่อ ${lastRun.date} · ใบสั่งตามแผน ${lastRun.planned} ใบ · ข้อเสนอซื้อ ${lastRun.proposals} รายการ` : "ยังไม่เคยรัน MRP"}
          action={
            <Button variant="primary" icon={<RefreshCw size={14} />} onClick={() => onAct({ kind: "mrp" })}>
              รัน MRP
            </Button>
          }
        >
          <p className="px-4 pt-3 text-[11px] font-medium uppercase tracking-wide text-slate-400">ใบสั่งผลิตตามแผน</p>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {PLANNED_ORDERS.length === 0 && <li className="px-4 py-4 text-[12.5px] text-slate-400">ไม่มีส่วนที่ต้องผลิตเพิ่ม</li>}
            {PLANNED_ORDERS.map((pl) => {
              const p = product(pl.product);
              return (
                <li key={pl.no} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                  <span className="w-20 shrink-0 font-mono text-[11.5px] text-slate-400">{pl.no}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] text-slate-900 dark:text-slate-50">
                      {p.name} · {pl.qty} {p.unit}
                    </span>
                    <span className="block text-[11.5px] text-slate-400">
                      เริ่ม {pl.start} · ส่ง {pl.due} · ตาม {pl.demand}
                    </span>
                  </span>
                  {pl.status === "ตามแผน" ? (
                    <span className="flex items-center gap-1">
                      <Button variant="secondary" icon={<ArrowRightLeft size={13} />} onClick={() => onAct({ kind: "convert", planned: pl })}>
                        แปลงเป็นใบสั่งผลิต
                      </Button>
                      <RowButton
                        label="ลบใบสั่งตามแผน"
                        tone="rose"
                        onClick={() =>
                          onAct({
                            kind: "remove",
                            title: "ลบใบสั่งตามแผน",
                            body: "ถ้าความต้องการยังอยู่ การรัน MRP รอบถัดไปจะเสนอกลับมาอีก",
                            subject: `${pl.no} · ${p.name} ${pl.qty} ${p.unit}`,
                            confirmLabel: "ลบใบสั่งตามแผน",
                            run: () => {
                              removePlannedOrder(pl.no);
                              return `ลบใบสั่งตามแผน ${pl.no} แล้ว`;
                            },
                          })
                        }
                      >
                        <Trash2 size={14} />
                      </RowButton>
                    </span>
                  ) : (
                    <button onClick={() => pl.order && onOpenOrder(pl.order)}>
                      <Badge tone="ok" dot>แปลงเป็น {pl.order}</Badge>
                    </button>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-4 pt-3 dark:border-slate-800">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">ข้อเสนอซื้อ</p>
            <span className="ml-auto flex flex-wrap gap-1">
              <Button variant="ghost" icon={exportIcon} onClick={exportProposals} disabled={PURCHASE_PROPOSALS.length === 0}>
                ส่งออก Excel
              </Button>
              <Button variant="ghost" icon={<Printer size={14} />} onClick={() => onAct({ kind: "print-proposals" })} disabled={PURCHASE_PROPOSALS.length === 0}>
                พิมพ์
              </Button>
              <Button variant="secondary" icon={<Send size={14} />} onClick={() => onAct({ kind: "send" })} disabled={waiting.length === 0}>
                ส่งฝ่ายจัดซื้อ
              </Button>
            </span>
          </div>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {PURCHASE_PROPOSALS.length === 0 && <li className="px-4 py-4 text-[12.5px] text-slate-400">ไม่มีวัสดุที่ต้องเสนอซื้อ</li>}
            {PURCHASE_PROPOSALS.map((s) => {
              const m = material(s.material);
              return (
                <li key={s.no} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                  <span className="w-20 shrink-0 font-mono text-[11.5px] text-slate-400">{s.no}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] text-slate-900 dark:text-slate-50">{m.name}</span>
                    <span className="block text-[11.5px] text-slate-400">
                      {s.qty} {m.unit} · ต้องการภายใน {s.needBy} · {baht(s.qty * m.price)}
                    </span>
                  </span>
                  <Badge tone={s.status === "เสนอซื้อ" ? "warn" : "ok"}>{s.status === "เสนอซื้อ" ? "รอส่ง" : `ส่งแล้ว ${s.sentOn}`}</Badge>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      <Card
        title={<span className="flex items-center gap-2"><Layers size={15} className="text-slate-400" />กางสูตรแล้วหักสต็อก</span>}
        subtitle="คำนวณใหม่ทุกครั้งที่ข้อมูลเปลี่ยน ส่วนที่ยังขาดคือของที่ MRP จะเสนอซื้อ"
        action={
          <Button variant="ghost" icon={exportIcon} onClick={exportMrp}>
            ส่งออก Excel
          </Button>
        }
      >
        <table className="w-full text-[13px]">
          <thead className="bg-slate-50/80 text-left text-[11px] uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">วัสดุ</th>
              <th className="px-4 py-3 text-right font-medium">ต้องใช้</th>
              <th className="px-4 py-3 text-right font-medium">มีในคลัง</th>
              <th className="px-4 py-3 text-right font-medium">สั่งไว้แล้ว</th>
              <th className="px-4 py-3 font-medium">ความพอเพียง</th>
              <th className="px-4 py-3 text-right font-medium">ต้องซื้อเพิ่ม</th>
              <th className="px-4 py-3 text-right font-medium">เป็นเงิน</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {mrp.map((m) => (
              <tr key={m.code} className="transition hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <td className="px-4 py-2.5">
                  <span className="block text-slate-900 dark:text-slate-50">{m.name}</span>
                  <span className="block font-mono text-[11px] text-slate-400">
                    {m.code} · ต้องการภายใน {m.needBy}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-slate-700 dark:text-slate-200">
                  {m.required} {m.unit}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-300">{m.onHand}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-300">{m.onOrder + m.proposed || "—"}</td>
                <td className="px-4 py-2.5">
                  <Bar pct={Math.min(100, ((m.onHand + m.onOrder + m.proposed) / m.required) * 100)} tone={m.shortage > 0 ? "bad" : "ok"} width="w-24" />
                </td>
                <td className={"px-4 py-2.5 text-right font-semibold tabular-nums " + (m.shortage > 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-300 dark:text-slate-600")}>
                  {m.shortage || "—"}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-slate-700 dark:text-slate-200">
                  {m.shortage ? baht(m.shortage * m.price) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Note tone="idle">
        ข้อเสนอซื้อเป็นเอกสารของฝ่ายวางแผน ส่งให้ฝ่ายจัดซื้อพิจารณาเปิดใบขอซื้อในโมดูลจัดซื้อ "สั่งไว้แล้ว" นับใบสั่งซื้อที่ค้างรับ
        ใบขอซื้อที่ยังไม่แปลง และข้อเสนอที่ส่งไปแล้ว เพื่อไม่ให้เสนอซื้อซ้ำ
      </Note>
    </div>
  );
}

/* --------------------------------------------------------------- capacity */

function Capacity({ onAct, onOpen }: { onAct: (a: Act) => void; onOpen: (o: ProductionOrder) => void }) {
  useData();
  const [label, setLabel] = useState(() => (overloads()[0]?.bucket ?? BUCKETS[0]).label);
  const bucket = BUCKETS.find((b) => b.label === label) ?? BUCKETS[0];

  const load = WORK_CENTERS.map((w) => {
    const hrs = loadOf(w.code, bucket);
    return { w, hrs, pct: Math.round((hrs / w.capacityHrs) * 100) };
  });
  const totalCapacity = WORK_CENTERS.reduce((n, w) => n + w.capacityHrs, 0);
  const totalLoad = load.reduce((n, l) => n + l.hrs, 0);
  const inBucket = ORDERS.filter((o) => isOpen(o) && bucketOf(o.start) === bucket);
  const over = overloads();

  const exportLoad = () => {
    downloadCsv(
      `ภาระงานศูนย์งาน-${bucket.from}`,
      ["รหัส", "ศูนย์งาน", "ประเภท", "ชั่วโมงที่จอง", "กำลัง", "อัตราการใช้ %"],
      load.map((l) => [l.w.code, l.w.name, l.w.kind, Math.round(l.hrs * 10) / 10, l.w.capacityHrs, l.pct])
    );
    notify(`ส่งออกภาระงานรอบ ${bucket.label} แล้ว`);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented options={BUCKETS.map((b) => b.label)} value={bucket.label} onChange={setLabel} />
        <span className="ml-auto" />
        <Button variant="ghost" icon={exportIcon} onClick={exportLoad}>
          ส่งออก Excel
        </Button>
      </div>

      {over.length > 0 && (
        <Note tone="bad">
          เกินกำลัง: {over.map((l) => `${l.w.name} รอบ ${l.bucket.label} ${l.pct}%`).join(" · ")} — ย้ายขั้นตอนไปศูนย์งานที่ทำงานแบบเดียวกัน
          เลื่อนวันผลิตไปรอบที่ว่าง หรือเพิ่มกะที่ศูนย์งานนั้น
        </Note>
      )}

      <StatStrip
        title={`กำลังการผลิตทั้งโรงงาน · รอบ ${bucket.label}`}
        icon={<Factory size={15} />}
        cells={[
          { icon: <Cog size={13} />, label: "กำลังทั้งหมด", value: totalCapacity + " ชม.", sub: `${WORK_CENTERS.length} ศูนย์งาน รอบละสองสัปดาห์` },
          { icon: <Hammer size={13} />, label: "ถูกจองไปแล้ว", value: totalLoad.toFixed(1) + " ชม.", sub: `จาก ${inBucket.length} ใบสั่งผลิตที่เริ่มในรอบนี้`, tone: "info" },
          { icon: <GaugeIcon size={13} />, label: "อัตราการใช้กำลัง", value: Math.round((totalLoad / totalCapacity) * 100) + "%", sub: "เฉลี่ยทั้งโรงงาน", tone: "accent" },
          { icon: <TriangleAlert size={13} />, label: "ศูนย์งานที่เกินกำลัง", value: load.filter((l) => l.pct > 100).length + " แห่ง", sub: "ต้องย้าย เลื่อน หรือเพิ่มกะ", tone: load.some((l) => l.pct > 100) ? "bad" : "ok" },
        ]}
      />

      <div className="grid gap-3 xl:grid-cols-3">
        <Card
          className="xl:col-span-2"
          title={<span className="flex items-center gap-2"><Factory size={15} className="text-slate-400" />ภาระงานเทียบกำลังการผลิต</span>}
          subtitle="ศูนย์งานที่เกิน 100% ต้องย้ายหรือเลื่อนใบสั่งผลิต หรือเพิ่มกะด้วยปุ่มปรับกำลัง"
        >
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {load.map((l) => (
              <li key={l.w.code} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className={"grid size-9 shrink-0 place-items-center rounded-xl " + wcSwatch(l.w.code).tint}>
                    <Wrench size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-slate-900 dark:text-slate-50">{l.w.name}</span>
                    <span className="block font-mono text-[11px] text-slate-400">
                      {l.w.code} · {l.w.kind} · {baht(l.w.costPerHr)}/ชม.
                    </span>
                  </span>
                  <span className="shrink-0 text-[12.5px] tabular-nums text-slate-600 dark:text-slate-300">
                    {l.hrs.toFixed(1)} จาก {l.w.capacityHrs} ชม.
                  </span>
                  <Badge tone={l.pct > 100 ? "bad" : l.pct > 80 ? "warn" : "ok"}>{l.pct}%</Badge>
                  <RowButton label="ปรับกำลังการผลิต" onClick={() => onAct({ kind: "wc", wc: l.w })}>
                    <Pencil size={14} />
                  </RowButton>
                </div>
                <div className="mt-2">
                  <Bar pct={Math.min(100, l.pct)} tone={l.pct > 100 ? "bad" : l.pct > 80 ? "warn" : "ok"} width="w-full" />
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card title={<span className="flex items-center gap-2"><Layers size={15} className="text-slate-400" />สัดส่วนชั่วโมงที่จอง</span>}>
          <div className="p-4">
            {totalLoad === 0 ? (
              <p className="py-10 text-center text-[12.5px] text-slate-400">รอบนี้ยังไม่มีงาน</p>
            ) : (
              <Donut
                segments={load.filter((l) => l.hrs > 0).map((l) => ({ label: l.w.name, value: Math.round(l.hrs), swatch: wcSwatch(l.w.code) }))}
                size={128}
                center={
                  <span>
                    <span className="block text-[20px] font-semibold leading-none tabular-nums text-slate-900 dark:text-slate-50">
                      {Math.round(totalLoad)}
                    </span>
                    <span className="mt-1 block text-[10.5px] uppercase tracking-wide text-slate-400">ชม.</span>
                  </span>
                }
              />
            )}
          </div>
        </Card>
      </div>

      <Card
        title={<span className="flex items-center gap-2"><ClipboardList size={15} className="text-slate-400" />ใบสั่งผลิตที่จองกำลังในรอบนี้</span>}
        subtitle="เฉพาะส่วนที่ยังผลิตไม่เสร็จของแต่ละขั้นตอน นับเข้ารอบตามวันเริ่มผลิต"
      >
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {inBucket.length === 0 && <li className="px-4 py-8 text-center text-[12.5px] text-slate-400">ไม่มีใบสั่งผลิตที่เริ่มในรอบนี้</li>}
          {inBucket.map((o) => {
            const ops = opLoadOf(o).filter((r) => r.load > 0);
            const hrs = ops.reduce((n, r) => n + r.load, 0);
            return (
              <li key={o.no} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                <button onClick={() => onOpen(o)} className="w-24 shrink-0 text-left font-mono text-[12px] text-slate-500 hover:text-violet-700 dark:text-slate-400">
                  {o.no}
                </button>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] text-slate-900 dark:text-slate-50">{product(o.product).name}</span>
                  <span className="block text-[11.5px] tabular-nums text-slate-400">
                    เริ่ม {o.start} · ส่ง {o.due}
                  </span>
                </span>
                <span className="flex flex-wrap gap-1">
                  {ops.map((r) => (
                    <Tag key={r.op} swatch={wcSwatch(r.wc)}>
                      {workCenter(r.wc).name} {r.load.toFixed(1)} ชม.
                    </Tag>
                  ))}
                </span>
                <span className="w-20 shrink-0 text-right text-[13px] font-semibold tabular-nums text-slate-900 dark:text-slate-50">
                  {hrs.toFixed(1)} ชม.
                </span>
                <span className="flex gap-0.5">
                  {can.reschedule(o) && (
                    <RowButton label="เลื่อนวันผลิต" onClick={() => onAct({ kind: "reschedule", order: o })}>
                      <CalendarClock size={14} />
                    </RowButton>
                  )}
                  {can.move(o) && (
                    <RowButton label="ย้ายศูนย์งาน" onClick={() => onAct({ kind: "move", order: o })}>
                      <ArrowRightLeft size={14} />
                    </RowButton>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}

/* --------------------------------------------------------------- orders */

function Orders({
  rows,
  q,
  setQ,
  status,
  setStatus,
  onOpen,
  onAct,
}: {
  rows: ProductionOrder[];
  q: string;
  setQ: (v: string) => void;
  status: string;
  setStatus: (v: string) => void;
  onOpen: (o: ProductionOrder) => void;
  onAct: (a: Act) => void;
}) {
  useData();
  const counts = Object.fromEntries(
    STATUS_FILTER.map((s) => [s, s === "ทั้งหมด" ? ORDERS.length : ORDERS.filter((o) => o.status === s).length])
  );

  const columns: Column<ProductionOrder>[] = [
    {
      key: "no",
      header: "เลขที่",
      width: "13%",
      sort: (a, b) => a.no.localeCompare(b.no),
      cell: (o) => <span className="font-mono text-[12px] text-slate-500 dark:text-slate-400">{o.no}</span>,
    },
    {
      key: "product",
      header: "สินค้า",
      width: "22%",
      sort: (a, b) => product(a.product).name.localeCompare(product(b.product).name, "th"),
      cell: (o) => (
        <span className="flex items-center gap-2">
          <Dot className={productSwatch(o.product).dot} />
          <span className="font-medium text-slate-900 dark:text-slate-50">{product(o.product).name}</span>
        </span>
      ),
    },
    {
      key: "qty",
      header: "จำนวน",
      align: "right",
      width: "10%",
      sort: (a, b) => a.qty - b.qty,
      cell: (o) => (
        <span className="tabular-nums text-slate-700 dark:text-slate-200">
          {o.qty} {product(o.product).unit}
        </span>
      ),
    },
    {
      key: "dates",
      header: "เริ่ม – ส่ง",
      width: "19%",
      sort: (a, b) => a.due.localeCompare(b.due),
      cell: (o) => (
        <span className="tabular-nums text-slate-500 dark:text-slate-400">
          {o.start} → {o.due}
        </span>
      ),
    },
    {
      key: "progress",
      header: "ความคืบหน้า",
      width: "16%",
      sort: (a, b) => a.done / a.qty - b.done / b.qty,
      cell: (o) => <Bar pct={(o.done / o.qty) * 100} tone={o.done >= o.qty ? "ok" : "accent"} width="w-24" />,
    },
    {
      key: "status",
      header: "สถานะ",
      width: "13%",
      sort: (a, b) => ORDER_STATUSES.indexOf(a.status) - ORDER_STATUSES.indexOf(b.status),
      cell: (o) => <Badge tone={ORDER_TONE[o.status]} dot>{o.status}</Badge>,
    },
  ];

  const exportRows = () => {
    downloadCsv(
      "ทะเบียนใบสั่งผลิต",
      ["เลขที่", "รหัสสินค้า", "สินค้า", "จำนวน", "หน่วย", "เริ่ม", "ส่ง", "ของดี", "ของเสีย", "รับเข้าคลัง", "สถานะ"],
      rows.map((o) => {
        const p = product(o.product);
        return [o.no, o.product, p.name, o.qty, p.unit, o.start, o.due, o.done, scrapOf(o), o.received, o.status];
      })
    );
    notify(`ส่งออกทะเบียนใบสั่งผลิต ${rows.length} ใบแล้ว`);
  };

  return (
    <DataTable
      rows={rows}
      columns={columns}
      getId={(o) => o.no}
      onOpen={onOpen}
      toolbar={
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Search value={q} onChange={setQ} placeholder="ค้นหาเลขที่ใบสั่งผลิตหรือชื่อสินค้า" icon={<SearchIcon size={14} />} />
            <span className="ml-auto text-[12px] text-slate-400">แสดง {rows.length} ใบ</span>
            <Button variant="ghost" icon={exportIcon} onClick={exportRows}>
              ส่งออก Excel
            </Button>
            <Button variant="primary" icon={<Plus size={15} />} onClick={() => onAct({ kind: "order-new" })}>
              สร้างใบสั่งผลิต
            </Button>
          </div>
          <div className="overflow-x-auto">
            <Segmented options={STATUS_FILTER} value={status} onChange={setStatus} counts={counts} />
          </div>
        </div>
      }
      trailing={(o) => (
        <span className="flex items-center justify-end gap-1">
          {can.release(o) && (
            <RowButton label="ปล่อยงานเข้าสายการผลิต" onClick={() => onAct({ kind: "release", order: o })}>
              <Play size={15} />
            </RowButton>
          )}
          {can.confirm(o) && (
            <RowButton label="บันทึกผลผลิต" tone="emerald" onClick={() => onAct({ kind: "confirm", order: o })}>
              <PackageCheck size={15} />
            </RowButton>
          )}
          <RowButton label="พิมพ์ใบสั่งผลิต" onClick={() => onAct({ kind: "print-order", order: o })}>
            <Printer size={15} />
          </RowButton>
        </span>
      )}
    />
  );
}

/* --------------------------------------------------------------- report */

function Report({ onAct, onOpen }: { onAct: (a: Act) => void; onOpen: (o: ProductionOrder) => void }) {
  useData();
  const live = ORDERS.filter((o) => o.status !== "ยกเลิก");
  const closed = ORDERS.filter((o) => o.status === "ปิดงานแล้ว");
  const planned = closed.reduce((n, o) => n + o.qty, 0);
  const made = closed.reduce((n, o) => n + o.done, 0);
  const good = CONFIRMATIONS.reduce((n, c) => n + c.yield, 0);
  const scrap = CONFIRMATIONS.reduce((n, c) => n + c.scrap, 0);
  const variance = closed.reduce((n, o) => n + costOf(o).variance, 0);

  const byProduct = products()
    .map((p) => {
      const mine = live.filter((o) => o.product === p.code);
      const output = mine.reduce((n, o) => n + o.done, 0);
      const cost = mine.reduce((n, o) => n + costOf(o).actual, 0);
      return { p, output, cost };
    })
    .filter((x) => x.output > 0);

  const columns: Column<(typeof CONFIRMATIONS)[number]>[] = [
    { key: "date", header: "วันที่", width: "11%", sort: (a, b) => a.date.localeCompare(b.date), cell: (c) => <span className="tabular-nums">{c.date}</span> },
    { key: "no", header: "เลขที่", width: "13%", cell: (c) => <span className="font-mono text-[12px] text-slate-500 dark:text-slate-400">{c.no}</span> },
    {
      key: "order",
      header: "ใบสั่งผลิต",
      width: "20%",
      sort: (a, b) => a.order.localeCompare(b.order),
      cell: (c) => {
        const o = ORDERS.find((x) => x.no === c.order)!;
        return (
          <span className="block">
            <span className="block font-mono text-[12px] text-slate-700 dark:text-slate-200">{c.order}</span>
            <span className="block truncate text-[11.5px] text-slate-400">{product(o.product).name}</span>
          </span>
        );
      },
    },
    { key: "op", header: "ขั้นตอน", width: "17%", cell: (c) => <span>{c.op} · {workCenter(c.wc).name}</span> },
    { key: "yield", header: "ของดี", align: "right", width: "8%", sort: (a, b) => a.yield - b.yield, cell: (c) => <span className="tabular-nums">{c.yield}</span> },
    {
      key: "scrap",
      header: "ของเสีย",
      align: "right",
      width: "8%",
      sort: (a, b) => a.scrap - b.scrap,
      cell: (c) => <span className={"tabular-nums " + (c.scrap ? "font-semibold text-rose-600 dark:text-rose-400" : "text-slate-300 dark:text-slate-600")}>{c.scrap || "—"}</span>,
    },
    { key: "hrs", header: "ชั่วโมง", align: "right", width: "8%", sort: (a, b) => a.hrs - b.hrs, cell: (c) => <span className="tabular-nums">{c.hrs}</span> },
    { key: "note", header: "หมายเหตุ", cell: (c) => <span className="text-slate-500 dark:text-slate-400">{c.note || "—"}</span> },
  ];

  const exportConfirmations = () => {
    downloadCsv(
      "บันทึกผลผลิต",
      ["วันที่", "เลขที่", "ใบสั่งผลิต", "สินค้า", "ขั้นตอน", "ศูนย์งาน", "ของดี", "ของเสีย", "ชั่วโมง", "หมายเหตุ"],
      [...CONFIRMATIONS].reverse().map((c) => [
        c.date, c.no, c.order, product(ORDERS.find((o) => o.no === c.order)!.product).name, c.op, workCenter(c.wc).name, c.yield, c.scrap, c.hrs, c.note,
      ])
    );
    notify(`ส่งออกบันทึกผลผลิต ${CONFIRMATIONS.length} รายการแล้ว`);
  };

  return (
    <div className="space-y-3">
      <StatStrip
        title="ผลการผลิต"
        icon={<TrendingUp size={15} />}
        cells={[
          { icon: <CircleCheck size={13} />, label: "ทำได้ตามแผน", value: planned ? Math.round((made / planned) * 100) + "%" : "—", sub: `จากใบที่ปิดแล้ว ${closed.length} ใบ`, tone: "ok" },
          { icon: <PackageCheck size={13} />, label: "ผลผลิตรวม", value: byProduct.reduce((n, x) => n + x.output, 0) + " หน่วย", sub: "ของดีที่ผ่านขั้นตอนสุดท้าย" },
          { icon: <TriangleAlert size={13} />, label: "อัตราของเสีย", value: good + scrap ? ((scrap / (good + scrap)) * 100).toFixed(1) + "%" : "—", sub: `เสีย ${scrap} จากที่ยืนยัน ${good + scrap} หน่วย-ขั้นตอน`, tone: scrap > 0 ? "warn" : "ok" },
          { icon: <Coins size={13} />, label: "ผลต่างต้นทุนใบที่ปิดแล้ว", value: baht(variance), sub: variance > 0 ? "ใช้เกินมาตรฐาน" : "ต่ำกว่ามาตรฐาน", tone: variance > 0 ? "bad" : "ok" },
        ]}
      />

      <div className="grid gap-3 xl:grid-cols-2">
        <Card
          title={<span className="flex items-center gap-2"><PackageCheck size={15} className="text-slate-400" />ผลผลิตรายสินค้า</span>}
          subtitle="ของดีที่บันทึกผลแล้ว รวมทุกใบสั่งผลิต พร้อมต้นทุนจริงที่เกิด"
        >
          <ColumnChart
            data={byProduct.map((x) => ({ label: x.p.name.slice(0, 10), value: x.output }))}
            format={(n) => n + " หน่วย"}
            height={170}
          />
          <ul className="divide-y divide-slate-100 border-t border-slate-100 dark:divide-slate-800 dark:border-slate-800">
            {byProduct.map((x) => (
              <li key={x.p.code} className="flex items-center gap-3 px-4 py-2 text-[12.5px]">
                <Dot className={productSwatch(x.p.code).dot} />
                <span className="min-w-0 flex-1 truncate text-slate-700 dark:text-slate-200">{x.p.name}</span>
                <span className="shrink-0 tabular-nums text-slate-400">
                  {x.output} {x.p.unit}
                </span>
                <span className="w-28 shrink-0 text-right tabular-nums text-slate-900 dark:text-slate-50">{baht(x.cost)}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card
          title={<span className="flex items-center gap-2"><Factory size={15} className="text-slate-400" />ชั่วโมงจริงต่อศูนย์งาน</span>}
          subtitle="ชั่วโมงที่ยืนยันงานแล้วทั้งหมด คูณอัตราของศูนย์งาน"
        >
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {WORK_CENTERS.map((w) => {
              const hrs = CONFIRMATIONS.filter((c) => c.wc === w.code).reduce((n, c) => n + c.hrs, 0);
              return (
                <li key={w.code} className="flex items-center gap-3 px-4 py-2.5">
                  <Dot className={wcSwatch(w.code).dot} />
                  <span className="w-36 shrink-0 truncate text-[13px] text-slate-900 dark:text-slate-50">{w.name}</span>
                  <span className="min-w-0 flex-1">
                    <Bar pct={(hrs / w.capacityHrs) * 100} tone="info" width="w-full" />
                  </span>
                  <span className="w-24 shrink-0 text-right text-[11.5px] tabular-nums text-slate-500 dark:text-slate-400">
                    {hrs.toFixed(1)} ชม.
                  </span>
                  <span className="w-24 shrink-0 text-right text-[12.5px] tabular-nums text-slate-700 dark:text-slate-200">
                    {baht(hrs * w.costPerHr)}
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      <Card
        title={<span className="flex items-center gap-2"><ClipboardCheck size={15} className="text-slate-400" />บันทึกผลผลิต</span>}
        subtitle="ทุกการยืนยันงาน: ขั้นตอนไหน ของดี ของเสีย และชั่วโมงที่ใช้จริง"
        action={
          <span className="flex flex-wrap gap-1.5">
            <Button variant="ghost" icon={exportIcon} onClick={exportConfirmations}>
              ส่งออก Excel
            </Button>
            <Button variant="ghost" icon={<Printer size={14} />} onClick={() => onAct({ kind: "print-report" })}>
              พิมพ์รายงาน
            </Button>
            <Button variant="primary" icon={<Plus size={14} />} onClick={() => onAct({ kind: "confirm", order: null })}>
              บันทึกผลผลิต
            </Button>
          </span>
        }
      >
        <div className="p-3">
          <DataTable rows={[...CONFIRMATIONS].reverse()} columns={columns} getId={(c) => c.no} />
        </div>
      </Card>

      <Card
        title={<span className="flex items-center gap-2"><ClipboardList size={15} className="text-slate-400" />ใบสั่งผลิตทั้งหมด</span>}
        subtitle="จำนวนที่สั่งเทียบของดีที่ทำได้ และผลต่างต้นทุนจริงกับมาตรฐาน"
      >
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {ORDERS.map((o) => {
            const c = costOf(o);
            return (
              <li key={o.no} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                <button onClick={() => onOpen(o)} className="w-24 shrink-0 text-left font-mono text-[12px] text-slate-500 hover:text-violet-700 dark:text-slate-400">
                  {o.no}
                </button>
                <span className="w-44 shrink-0 truncate text-[13px] text-slate-900 dark:text-slate-50">{product(o.product).name}</span>
                <span className="min-w-0 flex-1">
                  <Bar pct={(o.done / o.qty) * 100} tone={o.done >= o.qty ? "ok" : o.status === "ปิดงานแล้ว" ? "warn" : "accent"} width="w-full" />
                </span>
                <span className="w-20 shrink-0 text-right text-[11.5px] tabular-nums text-slate-500 dark:text-slate-400">
                  {o.done} / {o.qty}
                </span>
                <span
                  className={
                    "w-28 shrink-0 text-right text-[12px] tabular-nums " +
                    (o.status !== "ปิดงานแล้ว" ? "text-slate-400" : c.variance > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-700 dark:text-emerald-400")
                  }
                  title={o.status === "ปิดงานแล้ว" ? "ผลต่างต้นทุน" : "ต้นทุนงานระหว่างทำ"}
                >
                  {o.status === "ปิดงานแล้ว" ? (c.variance > 0 ? "+" : "") + baht(c.variance) : "—"}
                </span>
                <Badge tone={ORDER_TONE[o.status]}>{o.status}</Badge>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}

/* --------------------------------------------------------------- record */

function OrderRecord({ order, onAct }: { order: ProductionOrder; onAct: (a: Act) => void }) {
  useData();
  const [tab, setTab] = useState(ORDER_TABS[0]);
  const p = product(order.product);
  const sw = productSwatch(order.product);
  const cost = costOf(order);
  const cancelled = order.status === "ยกเลิก";
  const at = ORDER_FLOW.indexOf(order.status);
  const flow: { label: string; state: StepState }[] = ORDER_FLOW.map((s, i) => ({
    label: s,
    state: cancelled ? (i === 0 ? "failed" : "todo") : i < at ? "done" : i === at ? (s === "ปิดงานแล้ว" ? "done" : "current") : "todo",
  }));
  const loads = opLoadOf(order);
  const remainingHrs = loads.reduce((n, r) => n + r.load, 0);
  const avail = availabilityOf(order);
  const docs = [
    ...confirmationsOf(order).map((c) => ({ date: c.date, no: c.no, text: `ยืนยันงาน ${c.op} · ของดี ${c.yield} เสีย ${c.scrap} · ${c.hrs} ชม.`, movement: undefined })),
    ...movementsOf(order).map((m) => ({
      date: m.date,
      no: m.no,
      text: `${m.kind} ${m.lines.length} รายการ · คลัง ${m.stockDocs.join(", ")}`,
      movement: m,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date) || b.no.localeCompare(a.no));

  const actions: { show: boolean; label: string; icon: ReactNode; act: Act; variant?: "primary" | "secondary" | "danger" }[] = [
    { show: can.release(order), label: "ปล่อยงาน", icon: <Play size={14} />, act: { kind: "release", order }, variant: "primary" },
    { show: can.issue(order), label: "เบิกวัสดุ", icon: <PackagePlus size={14} />, act: { kind: "issue", order } },
    { show: can.confirm(order), label: "บันทึกผลผลิต", icon: <ClipboardCheck size={14} />, act: { kind: "confirm", order }, variant: "primary" },
    { show: can.receive(order), label: "รับเข้าคลัง", icon: <PackageCheck size={14} />, act: { kind: "receipt", order } },
    { show: can.edit(order), label: "แก้ไข", icon: <Pencil size={14} />, act: { kind: "order-edit", order } },
    { show: can.reschedule(order), label: "เลื่อนวันผลิต", icon: <CalendarClock size={14} />, act: { kind: "reschedule", order } },
    { show: can.move(order), label: "ย้ายศูนย์งาน", icon: <ArrowRightLeft size={14} />, act: { kind: "move", order } },
    { show: true, label: "พิมพ์ใบสั่งผลิต", icon: <Printer size={14} />, act: { kind: "print-order", order } },
    { show: can.complete(order), label: "ปิดงาน", icon: <Lock size={14} />, act: { kind: "teco", order } },
    { show: can.cancel(order), label: "ยกเลิก", icon: <Ban size={14} />, act: { kind: "cancel", order } },
  ];

  return (
    <div className="h-full overflow-y-auto">
      <div className="flex flex-wrap items-start gap-4 border-b border-slate-100 px-5 py-5 dark:border-slate-800">
        <span className={"grid size-14 shrink-0 place-items-center rounded-2xl " + sw.tint}>
          <Hammer size={24} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[18px] font-semibold text-slate-900 dark:text-slate-50">{p.name}</h2>
          <p className="mt-0.5 font-mono text-[12.5px] text-slate-500 dark:text-slate-400">
            {order.no} · เริ่ม {order.start} · ส่ง {order.due}
            {order.source ? ` · แปลงจาก ${order.source}` : ""}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge tone={ORDER_TONE[order.status]} dot>{order.status}</Badge>
            <Chip>
              {order.qty} {p.unit}
            </Chip>
            {bucketOf(order.start) && isOpen(order) && <Chip>รอบ {bucketOf(order.start)!.label}</Chip>}
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {actions
              .filter((a) => a.show)
              .map((a) => (
                <Button key={a.label} variant={a.variant ?? "secondary"} icon={a.icon} onClick={() => onAct(a.act)}>
                  {a.label}
                </Button>
              ))}
          </div>
        </div>
      </div>

      <div className="px-5">
        <Tabs tabs={ORDER_TABS} active={tab} onPick={setTab} icons={ORDER_ICONS} id="order" />
      </div>

      <div className="px-5 py-4">
        {tab === "ความคืบหน้า" && (
          <div className="space-y-4">
            <Stepper
              steps={flow}
              icons={{
                done: <CircleCheck size={14} />,
                current: <CirclePlay size={14} />,
                todo: <Cog size={14} />,
                failed: <TriangleAlert size={14} />,
              }}
            />
            <Progress done={order.done} total={order.qty} label={`ผลิตแล้ว ${order.done} จาก ${order.qty} ${p.unit} · เสีย ${scrapOf(order)} · รับเข้าคลัง ${order.received}`} />
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "เหลือผลิต", value: Math.max(0, order.qty - order.done - scrapOf(order)) + " " + p.unit },
                { label: "ชั่วโมงที่เหลือ", value: remainingHrs.toFixed(1) + " ชม." },
                { label: "ต้นทุนที่เกิดแล้ว", value: baht(cost.actual) },
              ].map((c) => (
                <div key={c.label} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
                  <div className="text-[11.5px] text-slate-500 dark:text-slate-400">{c.label}</div>
                  <div className="mt-1 text-[15px] font-semibold tabular-nums text-slate-900 dark:text-slate-50">{c.value}</div>
                </div>
              ))}
            </div>
            {cancelled && <Note tone="bad">ยกเลิกเมื่อ {order.closedOn} · {order.cancelReason}</Note>}
            {order.status === "ผลิตครบแล้ว" && order.received < order.done && (
              <Note tone="warn">ผลิตครบแล้ว รอรับเข้าคลังอีก {order.done - order.received} {p.unit} ก่อนปิดงาน</Note>
            )}
          </div>
        )}

        {tab === "วัสดุที่ต้องเบิก" && (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {avail.map((c) => {
              const m = material(c.material);
              return (
                <li key={c.material} className="flex flex-wrap items-center gap-3 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] text-slate-900 dark:text-slate-50">{m.name}</span>
                    <span className="block font-mono text-[11px] text-slate-400">
                      {c.material} · {c.per} × {order.qty}
                      {c.scrap ? ` + เผื่อ ${c.scrap}%` : ""} · ที่เก็บ {m.bin}
                    </span>
                  </span>
                  <span className="shrink-0 text-[11.5px] tabular-nums text-slate-500 dark:text-slate-400">เบิกแล้ว {c.issued}</span>
                  {c.open > 0 && isOpen(order) ? (
                    <Badge tone={c.short > 0 ? "bad" : "ok"}>
                      {c.short > 0 ? `ขาด ${c.short}` : `ใช้ได้ ${Math.max(0, c.available)}`}
                    </Badge>
                  ) : (
                    <Badge tone="idle">{c.open > 0 ? `ค้าง ${c.open}` : "ครบ"}</Badge>
                  )}
                  <span className="w-24 shrink-0 text-right text-[13px] font-semibold tabular-nums text-slate-900 dark:text-slate-50">
                    {c.qty} {m.unit}
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        {tab === "ขั้นตอนการผลิต" && (
          <ol className="space-y-2">
            {loads.map((r, i) => {
              const w = workCenter(r.wc);
              const done = progressOf(order, r.op);
              return (
                <li key={r.op} className="flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 px-3.5 py-2.5 dark:bg-slate-800/50">
                  <span className={"grid h-7 w-11 shrink-0 place-items-center rounded-full font-mono text-[10.5px] font-semibold " + wcSwatch(r.wc).tint}>
                    {r.op}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] text-slate-800 dark:text-slate-100">{r.text}</span>
                    <span className="block text-[11.5px] text-slate-400">
                      {w.name} · {r.hrs} ชม./หน่วย · จริง {done.hrs} ชม.
                    </span>
                  </span>
                  <span className="shrink-0 text-[12px] tabular-nums text-slate-600 dark:text-slate-300">
                    ดี {done.yield} · เสีย {done.scrap} · เหลือ {r.left}
                  </span>
                  {can.confirm(order) && r.left > 0 && i >= 0 && (
                    <RowButton label={`ยืนยันงานขั้นตอน ${r.op}`} tone="emerald" onClick={() => onAct({ kind: "confirm", order, op: r.op })}>
                      <ClipboardCheck size={14} />
                    </RowButton>
                  )}
                </li>
              );
            })}
          </ol>
        )}

        {tab === "ต้นทุน" && (
          <div className="space-y-3">
            <div className="space-y-1">
              <IconRow icon={<Boxes size={14} />} label="วัสดุที่เบิกจริง">{baht(cost.material)}</IconRow>
              <IconRow icon={<Wrench size={14} />} label="ค่าแรงจากชั่วโมงจริง">{baht(cost.labour)}</IconRow>
              <IconRow icon={<Coins size={14} />} label="ต้นทุนจริง">{baht(cost.actual)}</IconRow>
              <IconRow icon={<FileText size={14} />} label="มาตรฐานของที่รับเข้า">
                {baht(cost.standard)} ({order.received} × {baht(p.price)})
              </IconRow>
              <IconRow icon={<ClipboardList size={14} />} label="ต้นทุนตามแผนทั้งใบ">{baht(cost.planned)}</IconRow>
            </div>
            <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/50">
              <p className="text-[11.5px] text-slate-500 dark:text-slate-400">
                {order.status === "ปิดงานแล้ว" ? "ผลต่างต้นทุน (จริง − มาตรฐาน)" : "ต้นทุนงานระหว่างทำ (จริง − มาตรฐานของที่รับเข้าแล้ว)"}
              </p>
              <p
                className={
                  "mt-1 text-[24px] font-semibold tabular-nums " +
                  (cost.variance > 0 && order.status === "ปิดงานแล้ว" ? "text-rose-600 dark:text-rose-400" : "text-slate-900 dark:text-slate-50")
                }
              >
                {baht(cost.variance)}
              </p>
            </div>
            <Note tone="idle">
              ต้นทุนนี้เป็นต้นทุนการผลิต ยังไม่รวมค่าใช้จ่ายทางอ้อมที่โมดูลบัญชีบริหารและต้นทุนปันส่วนให้
              ผลต่างบวกคือใช้วัสดุหรือชั่วโมงเกินมาตรฐาน เช่นจากของเสีย
            </Note>
          </div>
        )}

        {tab === "เอกสาร" && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              <Button variant="secondary" icon={<Printer size={14} />} onClick={() => onAct({ kind: "print-order", order })}>
                พิมพ์ใบสั่งผลิต / ใบงาน
              </Button>
              {isOpen(order) && order.components.some((c) => c.qty > c.issued) && (
                <Button variant="secondary" icon={<Printer size={14} />} onClick={() => onAct({ kind: "print-slip", order })}>
                  พิมพ์ใบจ่ายวัสดุ
                </Button>
              )}
            </div>
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {docs.length === 0 && <li className="py-6 text-center text-[12.5px] text-slate-400">ยังไม่มีเอกสารของใบนี้</li>}
              {docs.map((d) => (
                <li key={d.no} className="flex items-center gap-3 py-2.5">
                  <span className="w-24 shrink-0 text-[11.5px] tabular-nums text-slate-400">{d.date}</span>
                  <span className="w-28 shrink-0 font-mono text-[12px] text-slate-600 dark:text-slate-300">{d.no}</span>
                  <span className="min-w-0 flex-1 truncate text-[12.5px] text-slate-700 dark:text-slate-200">{d.text}</span>
                  {d.movement && (
                    <IconButton label="พิมพ์เอกสาร" onClick={() => onAct({ kind: "print-slip", order, movement: d.movement })}>
                      <Printer size={14} />
                    </IconButton>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
