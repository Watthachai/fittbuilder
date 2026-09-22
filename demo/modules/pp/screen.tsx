import { useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowRight, Boxes, CalendarClock, CircleCheck, CirclePlay, ClipboardList, Cog, Coins, Factory,
  FileText, Gauge as GaugeIcon, Hammer, Layers, PackageCheck, Play, Search as SearchIcon,
  ShoppingCart, TrendingUp, TriangleAlert, Wrench,
} from "lucide-react";
import { TODAY } from "../mm/data";
import {
  BOM, DEMAND, ORDERS, PRODUCTS, ROUTING, WORK_CENTERS, baht, loadOf, product, runMrp, unitCost,
  workCenter,
} from "./data";
import type { ProductionOrder } from "./data";
import {
  Avatar, Badge, Bar, Button, Card, Chip, ColumnChart, Donut, Dot, FIELD, Gauge, IconRow, Note,
  PageHead, Progress, Reveal, Search, Segmented, StatStrip, Stepper, Tabs, Tag, TintCard, swatchFor,
} from "../ui";
import type { StepState } from "../ui";
import { ConfirmDialog, DataTable, DetailModal, Field, FormModal } from "../kit";
import type { Column } from "../kit";

const TABS = [
  "ข้อมูลหลักการผลิต",
  "วางแผนความต้องการวัสดุ",
  "วางแผนกำลังการผลิต",
  "ใบสั่งผลิต",
  "รายงานผลการผลิต",
];

const ORDER_FLOW = ["วางแผนไว้", "ปล่อยงานแล้ว", "กำลังผลิต", "ปิดงานแล้ว"];
const ORDER_TONE: Record<string, "idle" | "info" | "warn" | "ok"> = {
  วางแผนไว้: "idle",
  ปล่อยงานแล้ว: "info",
  กำลังผลิต: "warn",
  ปิดงานแล้ว: "ok",
};

const ORDER_TABS = ["ความคืบหน้า", "วัสดุที่ต้องเบิก", "ขั้นตอนการผลิต", "ต้นทุน"];
const ORDER_ICONS: Record<string, ReactNode> = {
  ความคืบหน้า: <GaugeIcon size={13} />,
  วัสดุที่ต้องเบิก: <Boxes size={13} />,
  ขั้นตอนการผลิต: <Cog size={13} />,
  ต้นทุน: <Coins size={13} />,
};

const PRODUCT_CODES = PRODUCTS.map((p) => p.code);
const productSwatch = (code: string) => swatchFor(code, PRODUCT_CODES);

const WC_CODES = WORK_CENTERS.map((w) => w.code);
const wcSwatch = (code: string) => swatchFor(code, WC_CODES);

/* ----------------------------------------------------------------- screen */

export default function PpScreen({
  section,
  onOpenSection,
}: {
  section?: string;
  onOpenSection?: (index: number) => void;
}) {
  const tab = section && TABS.includes(section) ? section : undefined;

  const [released, setReleased] = useState<string[]>([]);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [openAt, setOpenAt] = useState<number | null>(null);
  const [releasing, setReleasing] = useState<ProductionOrder | null>(null);
  const [recording, setRecording] = useState<ProductionOrder | null>(null);
  const [q, setQ] = useState("");

  const orderOf = (o: ProductionOrder): ProductionOrder => ({
    ...o,
    done: progress[o.no] ?? o.done,
    status: released.includes(o.no) ? "ปล่อยงานแล้ว" : o.status,
  });

  const orders = ORDERS.map(orderOf);
  const needle = q.trim().toLowerCase();
  const rows = orders.filter(
    (o) => needle === "" || [o.no, product(o.product).name].some((t) => t.toLowerCase().includes(needle))
  );
  const picked = openAt === null ? null : (rows[openAt] ?? null);

  const mrp = runMrp();
  const shortages = mrp.filter((m) => m.shortage > 0);

  const panels = (
    <>
      <DetailModal
        open={picked !== null}
        title="ใบสั่งผลิต"
        onClose={() => setOpenAt(null)}
        index={openAt ?? 0}
        total={rows.length}
        onStep={(d) => setOpenAt((i) => Math.min(rows.length - 1, Math.max(0, (i ?? 0) + d)))}
      >
        {picked && <OrderRecord key={picked.no} order={picked} onRecord={() => setRecording(picked)} />}
      </DetailModal>

      <ConfirmDialog
        open={releasing !== null}
        title="ปล่อยงานเข้าสายการผลิต"
        body="ปล่อยงานแล้วศูนย์งานจะเห็นใบนี้ในคิว และชั่วโมงที่ใบนี้ใช้จะถูกจองในแผนกำลังการผลิตทันที"
        subject={
          releasing && (
            <span className="block">
              <span className="block text-[13px] font-medium text-slate-900 dark:text-slate-50">
                {releasing.no} · {product(releasing.product).name}
              </span>
              <span className="block text-[11.5px] text-slate-500 dark:text-slate-400">
                {releasing.qty} {product(releasing.product).unit} · เริ่ม {releasing.start} · ส่ง {releasing.due}
              </span>
            </span>
          )
        }
        confirmLabel="ปล่อยงาน"
        onCancel={() => setReleasing(null)}
        onConfirm={() => {
          if (releasing) setReleased((r) => [...new Set([...r, releasing.no])]);
          setReleasing(null);
        }}
      />

      <ProgressForm
        order={recording}
        onCancel={() => setRecording(null)}
        onSave={(no, done) => {
          setProgress((p) => ({ ...p, [no]: done }));
          setRecording(null);
        }}
      />
    </>
  );

  if (!tab) {
    return (
      <>
        <Overview
          orders={orders}
          shortages={shortages}
          onOpenSection={onOpenSection}
          onOpenOrder={(o) => {
            setQ("");
            setOpenAt(orders.indexOf(o));
          }}
        />
        {panels}
      </>
    );
  }

  return (
    <div>
      <PageHead
        title="วางแผนการผลิต"
        meta={`${tab} · ${PRODUCTS.length} สินค้า · ${orders.filter((o) => o.status !== "ปิดงานแล้ว").length} ใบสั่งผลิตที่เปิดอยู่`}
      />

      {tab === "ข้อมูลหลักการผลิต" && <MasterData />}
      {tab === "วางแผนความต้องการวัสดุ" && <Mrp mrp={mrp} />}
      {tab === "วางแผนกำลังการผลิต" && <Capacity orders={orders} />}
      {tab === "ใบสั่งผลิต" && (
        <Orders
          rows={rows}
          q={q}
          setQ={setQ}
          onOpen={(o) => setOpenAt(rows.indexOf(o))}
          onRelease={setReleasing}
          onRecord={setRecording}
        />
      )}
      {tab === "รายงานผลการผลิต" && <Report orders={orders} />}

      {panels}

      <div hidden data-fitt-index>
        <button data-fitt-screen="วางแผนการผลิต" />
        <button data-fitt-screen="ใบสั่งผลิต" data-fitt-modal onClick={() => setOpenAt(0)} />
        <button data-fitt-screen="ปล่อยงานเข้าสายการผลิต" data-fitt-modal onClick={() => setReleasing(orders[2])} />
        <button data-fitt-screen="บันทึกผลผลิต" data-fitt-modal onClick={() => setRecording(orders[0])} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- overview */

function Overview({
  orders,
  shortages,
  onOpenSection,
  onOpenOrder,
}: {
  orders: ProductionOrder[];
  shortages: ReturnType<typeof runMrp>;
  onOpenSection?: (index: number) => void;
  onOpenOrder: (o: ProductionOrder) => void;
}) {
  const open = orders.filter((o) => o.status !== "ปิดงานแล้ว");
  const planned = open.reduce((n, o) => n + o.qty, 0);
  const made = open.reduce((n, o) => n + o.done, 0);

  const load = WORK_CENTERS.map((w) => {
    const hrs = loadOf(w.code);
    return { w, hrs, pct: Math.round((hrs / w.capacityHrs) * 100) };
  });
  const over = load.filter((l) => l.pct > 100);

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
          onOpenSection ? (
            <Button variant="primary" icon={<Factory size={15} />} onClick={() => onOpenSection(3)}>
              เปิดใบสั่งผลิต
            </Button>
          ) : undefined
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
                  {over.map((l) => l.w.name).join(" และ ")} รับงานเกินกำลัง ต้องเลื่อนใบสั่งผลิตออกไปหรือเพิ่มกะ
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
                <p className="py-10 text-center text-[12.5px] text-slate-400">วัสดุในคลังพอสำหรับแผนทั้งหมด</p>
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
                          ต้องใช้ {m.required} · มีอยู่ {m.onHand} {m.unit}
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
              {PRODUCTS.map((p) => {
                const c = unitCost(p.code);
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
              {DEMAND.map((d) => {
                const p = product(d.product);
                const sw = productSwatch(d.product);
                const order = orders.find((o) => o.product === d.product && o.status !== "ปิดงานแล้ว");
                return (
                  <li key={d.product} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <span className={"grid size-9 shrink-0 place-items-center rounded-xl " + sw.tint}>
                      <Hammer size={16} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] text-slate-900 dark:text-slate-50">{p.name}</span>
                      <span className="block text-[11.5px] text-slate-400">
                        {d.qty} {p.unit} · ต้องส่ง {d.dueDate}
                      </span>
                    </span>
                    {order ? (
                      <button onClick={() => onOpenOrder(order)} className="shrink-0">
                        <Badge tone={ORDER_TONE[order.status]} dot>{order.no}</Badge>
                      </button>
                    ) : (
                      <Badge tone="idle">ยังไม่มีใบสั่งผลิต</Badge>
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

function MasterData() {
  const [pick, setPick] = useState(PRODUCTS[0].code);
  const p = product(pick);
  const cost = unitCost(pick);
  const sw = productSwatch(pick);

  return (
    <div className="space-y-3">
      <Segmented options={PRODUCTS.map((x) => x.name)} value={p.name} onChange={(name) => setPick(PRODUCTS.find((x) => x.name === name)!.code)} />

      <div className="grid gap-3 xl:grid-cols-3">
        <Card
          className="xl:col-span-2"
          title={<span className="flex items-center gap-2"><Layers size={15} className="text-slate-400" />สูตรการผลิต</span>}
          subtitle="ผลิตหนึ่งหน่วยต้องใช้วัสดุอะไรบ้าง ราคาอ่านจากแฟ้มวัสดุ"
        >
          <table className="w-full text-[13px]">
            <thead className="bg-slate-50/80 text-left text-[11px] uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">วัสดุ</th>
                <th className="px-4 py-3 text-right font-medium">ใช้ต่อหน่วย</th>
                <th className="px-4 py-3 text-right font-medium">ราคาต่อหน่วย</th>
                <th className="px-4 py-3 text-right font-medium">เป็นเงิน</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {BOM[pick].map((l) => {
                const m = product(l.material);
                return (
                  <tr key={l.material} className="transition hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-2.5">
                      <span className="block text-slate-900 dark:text-slate-50">{m.name}</span>
                      <span className="block font-mono text-[11px] text-slate-400">{l.material}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-300">
                      {l.qty} {m.unit}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-300">{baht(m.price)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-900 dark:text-slate-50">{baht(l.qty * m.price)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-slate-50/80 dark:bg-slate-800/60">
              <tr>
                <td colSpan={3} className="px-4 py-3 text-right font-medium text-slate-600 dark:text-slate-300">
                  รวมค่าวัสดุต่อหน่วย
                </td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-900 dark:text-slate-50">{baht(cost.material)}</td>
              </tr>
            </tfoot>
          </table>
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
      >
        <ol className="divide-y divide-slate-100 dark:divide-slate-800">
          {ROUTING[pick].map((r, i) => {
            const w = workCenter(r.wc);
            const wsw = wcSwatch(r.wc);
            return (
              <li key={r.wc} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className={"grid size-8 shrink-0 place-items-center rounded-full text-[12px] font-semibold " + wsw.tint}>
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-slate-900 dark:text-slate-50">{w.name}</span>
                  <span className="block font-mono text-[11px] text-slate-400">{w.code}</span>
                </span>
                <Chip>{r.hrs} ชม./หน่วย</Chip>
                <span className="w-28 shrink-0 text-right text-[12.5px] tabular-nums text-slate-500 dark:text-slate-400">
                  {baht(w.costPerHr)}/ชม.
                </span>
                <span className="w-24 shrink-0 text-right text-[13px] tabular-nums text-slate-900 dark:text-slate-50">
                  {baht(r.hrs * w.costPerHr)}
                </span>
              </li>
            );
          })}
        </ol>
      </Card>
    </div>
  );
}

/* -------------------------------------------------------------------- mrp */

function Mrp({ mrp }: { mrp: ReturnType<typeof runMrp> }) {
  const [ordering, setOrdering] = useState(false);
  const short = mrp.filter((m) => m.shortage > 0);
  const buyValue = short.reduce((n, m) => n + m.shortage * m.price, 0);

  return (
    <div className="space-y-3">
      <StatStrip
        title="ผลการกางสูตรและหักสต็อก"
        icon={<ClipboardList size={15} />}
        cells={[
          { icon: <CalendarClock size={13} />, label: "ความต้องการที่ป้อนเข้า", value: DEMAND.length + " รายการ", sub: DEMAND.map((d) => product(d.product).name).join(" · ") },
          { icon: <Boxes size={13} />, label: "วัสดุที่ต้องใช้", value: mrp.length + " รายการ", sub: "กางจากสูตรการผลิตของทุกสินค้า", tone: "info" },
          { icon: <TriangleAlert size={13} />, label: "ขาดสต็อก", value: short.length + " รายการ", sub: "ต้องเปิดใบขอซื้อเพิ่ม", tone: short.length > 0 ? "warn" : "ok" },
          { icon: <Coins size={13} />, label: "มูลค่าที่ต้องซื้อ", value: baht(buyValue), sub: "คิดจากราคาต่อหน่วยในแฟ้มวัสดุ", tone: "accent" },
        ]}
      />

      <Card
        title={<span className="flex items-center gap-2"><Layers size={15} className="text-slate-400" />กางสูตรแล้วหักสต็อก</span>}
        subtitle="ส่วนที่ยังขาดคือของที่ต้องเปิดใบขอซื้อ"
        action={
          short.length > 0 ? (
            <Button variant="primary" icon={<ShoppingCart size={15} />} onClick={() => setOrdering(true)}>
              เปิดใบขอซื้อจากรายการที่ขาด
            </Button>
          ) : undefined
        }
      >
        <table className="w-full text-[13px]">
          <thead className="bg-slate-50/80 text-left text-[11px] uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">วัสดุ</th>
              <th className="px-4 py-3 text-right font-medium">ต้องใช้</th>
              <th className="px-4 py-3 text-right font-medium">มีในคลัง</th>
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
                  <span className="block font-mono text-[11px] text-slate-400">{m.code}</span>
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-slate-700 dark:text-slate-200">
                  {m.required} {m.unit}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-300">{m.onHand}</td>
                <td className="px-4 py-2.5">
                  <Bar pct={Math.min(100, (m.onHand / m.required) * 100)} tone={m.shortage > 0 ? "bad" : "ok"} width="w-24" />
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

      <ConfirmDialog
        open={ordering}
        title="เปิดใบขอซื้อจากรายการที่ขาด"
        body={`ระบบจะสร้างใบขอซื้อให้วัสดุ ${short.length} รายการที่ยังขาด รวมเป็นเงิน ${baht(buyValue)} ส่งต่อให้ฝ่ายจัดซื้อพิจารณา`}
        subject={
          <ul className="space-y-1">
            {short.map((m) => (
              <li key={m.code} className="flex items-center gap-2 text-[12.5px]">
                <span className="min-w-0 flex-1 truncate text-slate-800 dark:text-slate-100">{m.name}</span>
                <span className="shrink-0 tabular-nums text-slate-500 dark:text-slate-400">
                  {m.shortage} {m.unit}
                </span>
              </li>
            ))}
          </ul>
        }
        confirmLabel="เปิดใบขอซื้อ"
        onCancel={() => setOrdering(false)}
        onConfirm={() => setOrdering(false)}
      />
    </div>
  );
}

/* --------------------------------------------------------------- capacity */

function Capacity({ orders }: { orders: ProductionOrder[] }) {
  const load = WORK_CENTERS.map((w) => {
    const hrs = loadOf(w.code);
    return { w, hrs, pct: Math.round((hrs / w.capacityHrs) * 100) };
  });
  const totalCapacity = WORK_CENTERS.reduce((n, w) => n + w.capacityHrs, 0);
  const totalLoad = load.reduce((n, l) => n + l.hrs, 0);

  return (
    <div className="space-y-3">
      <StatStrip
        title="กำลังการผลิตทั้งโรงงาน"
        icon={<Factory size={15} />}
        cells={[
          { icon: <Cog size={13} />, label: "กำลังทั้งหมด", value: totalCapacity + " ชม.", sub: `${WORK_CENTERS.length} ศูนย์งานในรอบวางแผน` },
          { icon: <Hammer size={13} />, label: "ถูกจองไปแล้ว", value: totalLoad.toFixed(1) + " ชม.", sub: "จากใบสั่งผลิตที่ยังไม่ปิด", tone: "info" },
          { icon: <GaugeIcon size={13} />, label: "อัตราการใช้กำลัง", value: Math.round((totalLoad / totalCapacity) * 100) + "%", sub: "เฉลี่ยทั้งโรงงาน", tone: "accent" },
          { icon: <TriangleAlert size={13} />, label: "ศูนย์งานที่เกินกำลัง", value: load.filter((l) => l.pct > 100).length + " แห่ง", sub: "ต้องเลื่อนงานหรือเพิ่มกะ", tone: load.some((l) => l.pct > 100) ? "bad" : "ok" },
        ]}
      />

      <div className="grid gap-3 xl:grid-cols-3">
        <Card
          className="xl:col-span-2"
          title={<span className="flex items-center gap-2"><Factory size={15} className="text-slate-400" />ภาระงานเทียบกำลังการผลิต</span>}
          subtitle="ศูนย์งานที่เกิน 100% ต้องเลื่อนใบสั่งผลิตออกไปหรือเพิ่มกะ"
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
                      {l.w.code} · {baht(l.w.costPerHr)}/ชม.
                    </span>
                  </span>
                  <span className="shrink-0 text-[12.5px] tabular-nums text-slate-600 dark:text-slate-300">
                    {l.hrs.toFixed(1)} จาก {l.w.capacityHrs} ชม.
                  </span>
                  <Badge tone={l.pct > 100 ? "bad" : l.pct > 80 ? "warn" : "ok"}>{l.pct}%</Badge>
                </div>
                <div className="mt-2">
                  <Bar pct={Math.min(100, l.pct)} tone={l.pct > 100 ? "bad" : l.pct > 80 ? "warn" : "ok"} width="w-full" />
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card
          title={<span className="flex items-center gap-2"><Layers size={15} className="text-slate-400" />สัดส่วนชั่วโมงที่จอง</span>}
        >
          <div className="p-4">
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
          </div>
        </Card>
      </div>

      <Card
        title={<span className="flex items-center gap-2"><ClipboardList size={15} className="text-slate-400" />ใบสั่งผลิตที่จองกำลังอยู่</span>}
        subtitle="เฉพาะส่วนที่ยังผลิตไม่เสร็จของแต่ละใบ"
      >
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {orders
            .filter((o) => o.status !== "ปิดงานแล้ว")
            .map((o) => {
              const remaining = o.qty - o.done;
              const hrs = ROUTING[o.product].reduce((n, r) => n + r.hrs * remaining, 0);
              return (
                <li key={o.no} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                  <span className="w-28 shrink-0 font-mono text-[12px] text-slate-500 dark:text-slate-400">{o.no}</span>
                  <span className="min-w-0 flex-1 truncate text-[13px] text-slate-900 dark:text-slate-50">
                    {product(o.product).name}
                  </span>
                  <span className="shrink-0 text-[11.5px] tabular-nums text-slate-400">
                    เหลือผลิต {remaining} {product(o.product).unit}
                  </span>
                  <span className="flex flex-wrap gap-1">
                    {ROUTING[o.product].map((r) => (
                      <Tag key={r.wc} swatch={wcSwatch(r.wc)}>
                        {workCenter(r.wc).name} {(r.hrs * remaining).toFixed(1)} ชม.
                      </Tag>
                    ))}
                  </span>
                  <span className="w-24 shrink-0 text-right text-[13px] font-semibold tabular-nums text-slate-900 dark:text-slate-50">
                    {hrs.toFixed(1)} ชม.
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
  onOpen,
  onRelease,
  onRecord,
}: {
  rows: ProductionOrder[];
  q: string;
  setQ: (v: string) => void;
  onOpen: (o: ProductionOrder) => void;
  onRelease: (o: ProductionOrder) => void;
  onRecord: (o: ProductionOrder) => void;
}) {
  const columns: Column<ProductionOrder>[] = [
    {
      key: "no",
      header: "เลขที่",
      width: "14%",
      sort: (a, b) => a.no.localeCompare(b.no),
      cell: (o) => <span className="font-mono text-[12px] text-slate-500 dark:text-slate-400">{o.no}</span>,
    },
    {
      key: "product",
      header: "สินค้า",
      width: "24%",
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
      width: "11%",
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
      width: "18%",
      sort: (a, b) => a.done / a.qty - b.done / b.qty,
      cell: (o) => <Bar pct={(o.done / o.qty) * 100} tone={o.done >= o.qty ? "ok" : "accent"} width="w-24" />,
    },
    {
      key: "status",
      header: "สถานะ",
      width: "14%",
      cell: (o) => <Badge tone={ORDER_TONE[o.status]} dot>{o.status}</Badge>,
    },
  ];

  return (
    <DataTable
      rows={rows}
      columns={columns}
      getId={(o) => o.no}
      onOpen={onOpen}
      toolbar={
        <div className="flex flex-wrap items-center gap-2">
          <Search value={q} onChange={setQ} placeholder="ค้นหาเลขที่ใบสั่งผลิตหรือชื่อสินค้า" icon={<SearchIcon size={14} />} />
          <span className="ml-auto text-[12px] text-slate-400">แสดง {rows.length} ใบ</span>
        </div>
      }
      trailing={(o) => (
        <span className="flex items-center justify-end gap-1">
          {o.status === "วางแผนไว้" && (
            <button
              onClick={() => onRelease(o)}
              title="ปล่อยงานเข้าสายการผลิต"
              aria-label="ปล่อยงานเข้าสายการผลิต"
              className="grid size-7 place-items-center rounded-lg text-slate-400 transition hover:bg-violet-50 hover:text-violet-600 dark:hover:bg-violet-500/15 dark:hover:text-violet-300"
            >
              <Play size={15} />
            </button>
          )}
          {o.status !== "ปิดงานแล้ว" && (
            <button
              onClick={() => onRecord(o)}
              title="บันทึกผลผลิต"
              aria-label="บันทึกผลผลิต"
              className="grid size-7 place-items-center rounded-lg text-slate-400 transition hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-500/15 dark:hover:text-emerald-300"
            >
              <PackageCheck size={15} />
            </button>
          )}
        </span>
      )}
    />
  );
}

/* --------------------------------------------------------------- report */

function Report({ orders }: { orders: ProductionOrder[] }) {
  const closed = orders.filter((o) => o.status === "ปิดงานแล้ว");
  const planned = closed.reduce((n, o) => n + o.qty, 0);
  const made = closed.reduce((n, o) => n + o.done, 0);

  const byProduct = PRODUCTS.map((p) => {
    const mine = orders.filter((o) => o.product === p.code);
    const output = mine.reduce((n, o) => n + o.done, 0);
    return { p, output, value: output * unitCost(p.code).material, cost: output * unitCost(p.code).labour };
  }).filter((x) => x.output > 0);

  return (
    <div className="space-y-3">
      <StatStrip
        title="ผลการผลิต"
        icon={<TrendingUp size={15} />}
        cells={[
          { icon: <CircleCheck size={13} />, label: "ทำได้ตามแผน", value: planned ? Math.round((made / planned) * 100) + "%" : "—", sub: `จากใบที่ปิดแล้ว ${closed.length} ใบ`, tone: "ok" },
          { icon: <PackageCheck size={13} />, label: "ผลผลิตรวม", value: byProduct.reduce((n, x) => n + x.output, 0) + " หน่วย", sub: "นับทุกใบสั่งผลิตที่บันทึกผลแล้ว" },
          { icon: <Boxes size={13} />, label: "ค่าวัสดุที่ใช้ไป", value: baht(byProduct.reduce((n, x) => n + x.value, 0)), sub: "กางจากสูตรการผลิตของที่ผลิตได้จริง", tone: "accent" },
          { icon: <Hammer size={13} />, label: "ค่าแรงที่ใช้ไป", value: baht(byProduct.reduce((n, x) => n + x.cost, 0)), sub: "ชั่วโมงตามขั้นตอนคูณค่าแรงของศูนย์งาน", tone: "warn" },
        ]}
      />

      <div className="grid gap-3 xl:grid-cols-2">
        <Card
          title={<span className="flex items-center gap-2"><PackageCheck size={15} className="text-slate-400" />ผลผลิตรายสินค้า</span>}
          subtitle="จำนวนที่บันทึกผลแล้ว รวมทุกใบสั่งผลิต"
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
                <span className="w-28 shrink-0 text-right tabular-nums text-slate-900 dark:text-slate-50">{baht(x.value + x.cost)}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card
          title={<span className="flex items-center gap-2"><Factory size={15} className="text-slate-400" />ภาระงานสะสมต่อศูนย์งาน</span>}
          subtitle="ชั่วโมงที่ใบสั่งผลิตทั้งหมดใช้ไป รวมใบที่ปิดแล้ว"
        >
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {WORK_CENTERS.map((w) => {
              const hrs = orders.reduce((n, o) => {
                const step = ROUTING[o.product].find((r) => r.wc === w.code);
                return n + (step ? step.hrs * o.done : 0);
              }, 0);
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
        title={<span className="flex items-center gap-2"><ClipboardList size={15} className="text-slate-400" />ใบสั่งผลิตทั้งหมด</span>}
        subtitle="ใบที่ปิดแล้วเทียบจำนวนที่สั่งกับที่ทำได้จริง"
      >
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {orders.map((o) => (
            <li key={o.no} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
              <span className="w-28 shrink-0 font-mono text-[12px] text-slate-500 dark:text-slate-400">{o.no}</span>
              <span className="w-48 shrink-0 truncate text-[13px] text-slate-900 dark:text-slate-50">{product(o.product).name}</span>
              <span className="min-w-0 flex-1">
                <Bar pct={(o.done / o.qty) * 100} tone={o.done >= o.qty ? "ok" : o.status === "ปิดงานแล้ว" ? "warn" : "accent"} width="w-full" />
              </span>
              <span className="w-28 shrink-0 text-right text-[11.5px] tabular-nums text-slate-500 dark:text-slate-400">
                {o.done} / {o.qty}
              </span>
              <Badge tone={ORDER_TONE[o.status]}>{o.status}</Badge>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

/* --------------------------------------------------------------- record */

function OrderRecord({ order, onRecord }: { order: ProductionOrder; onRecord: () => void }) {
  const [tab, setTab] = useState(ORDER_TABS[0]);
  const p = product(order.product);
  const sw = productSwatch(order.product);
  const remaining = order.qty - order.done;
  const cost = unitCost(order.product);
  const at = ORDER_FLOW.indexOf(order.status);
  const flow: { label: string; state: StepState }[] = ORDER_FLOW.map((s, i) => ({
    label: s,
    state: i < at ? "done" : i === at ? "current" : "todo",
  }));

  return (
    <div>
      <div className="flex flex-wrap items-start gap-4 border-b border-slate-100 px-5 pb-5 dark:border-slate-800">
        <span className={"grid size-14 shrink-0 place-items-center rounded-2xl " + sw.tint}>
          <Hammer size={24} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[18px] font-semibold text-slate-900 dark:text-slate-50">{p.name}</h2>
          <p className="mt-0.5 font-mono text-[12.5px] text-slate-500 dark:text-slate-400">
            {order.no} · เริ่ม {order.start} · ส่ง {order.due}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge tone={ORDER_TONE[order.status]} dot>{order.status}</Badge>
            <Chip>
              {order.qty} {p.unit}
            </Chip>
          </div>
        </div>
        {order.status !== "ปิดงานแล้ว" && (
          <Button variant="secondary" icon={<PackageCheck size={15} />} onClick={onRecord}>
            บันทึกผลผลิต
          </Button>
        )}
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
            <Progress done={order.done} total={order.qty} label={`ผลิตแล้ว ${order.done} จาก ${order.qty} ${p.unit}`} />
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "เหลือผลิต", value: remaining + " " + p.unit },
                { label: "ชั่วโมงที่เหลือ", value: ROUTING[order.product].reduce((n, r) => n + r.hrs * remaining, 0).toFixed(1) + " ชม." },
                { label: "ต้นทุนที่เกิดแล้ว", value: baht(order.done * cost.total) },
              ].map((c) => (
                <div key={c.label} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
                  <div className="text-[11.5px] text-slate-500 dark:text-slate-400">{c.label}</div>
                  <div className="mt-1 text-[15px] font-semibold tabular-nums text-slate-900 dark:text-slate-50">{c.value}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "วัสดุที่ต้องเบิก" && (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {BOM[order.product].map((l) => {
              const m = product(l.material);
              const need = Math.ceil(l.qty * order.qty);
              return (
                <li key={l.material} className="flex flex-wrap items-center gap-3 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] text-slate-900 dark:text-slate-50">{m.name}</span>
                    <span className="block font-mono text-[11px] text-slate-400">{l.material}</span>
                  </span>
                  <span className="shrink-0 text-[11.5px] tabular-nums text-slate-400">
                    {l.qty} × {order.qty}
                  </span>
                  <Badge tone={m.stock >= need ? "ok" : "bad"}>
                    ในคลัง {m.stock} {m.unit}
                  </Badge>
                  <span className="w-24 shrink-0 text-right text-[13px] font-semibold tabular-nums text-slate-900 dark:text-slate-50">
                    {need} {m.unit}
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        {tab === "ขั้นตอนการผลิต" && (
          <ol className="space-y-2">
            {ROUTING[order.product].map((r, i) => {
              const w = workCenter(r.wc);
              return (
                <li key={r.wc} className="flex items-center gap-3 rounded-xl bg-slate-50 px-3.5 py-2.5 dark:bg-slate-800/50">
                  <span className={"grid size-7 shrink-0 place-items-center rounded-full text-[11px] font-semibold " + wcSwatch(r.wc).tint}>
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 text-[13px] text-slate-800 dark:text-slate-100">{w.name}</span>
                  <span className="shrink-0 text-[11.5px] tabular-nums text-slate-400">{r.hrs} ชม./หน่วย</span>
                  <span className="w-24 shrink-0 text-right text-[12.5px] tabular-nums text-slate-700 dark:text-slate-200">
                    {(r.hrs * order.qty).toFixed(1)} ชม.
                  </span>
                </li>
              );
            })}
          </ol>
        )}

        {tab === "ต้นทุน" && (
          <div className="space-y-3">
            <div className="space-y-1">
              <IconRow icon={<Boxes size={14} />} label="ค่าวัสดุต่อหน่วย">{baht(cost.material)}</IconRow>
              <IconRow icon={<Wrench size={14} />} label="ค่าแรงต่อหน่วย">{baht(cost.labour)}</IconRow>
              <IconRow icon={<Coins size={14} />} label="ต้นทุนต่อหน่วย">{baht(cost.total)}</IconRow>
              <IconRow icon={<FileText size={14} />} label="ต้นทุนมาตรฐาน">{baht(p.price)}</IconRow>
            </div>
            <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/50">
              <p className="text-[11.5px] text-slate-500 dark:text-slate-400">ต้นทุนทั้งใบ ({order.qty} {p.unit})</p>
              <p className="mt-1 text-[24px] font-semibold tabular-nums text-slate-900 dark:text-slate-50">
                {baht(cost.total * order.qty)}
              </p>
            </div>
            <Note tone="idle">
              ต้นทุนนี้เป็นต้นทุนการผลิต ยังไม่รวมค่าใช้จ่ายทางอ้อมที่โมดูลบัญชีบริหารและต้นทุนปันส่วนให้
              ราคาขายจริงกำหนดไว้ในโมดูลขายและกระจายสินค้า
            </Note>
          </div>
        )}
      </div>
    </div>
  );
}

function ProgressForm({
  order,
  onCancel,
  onSave,
}: {
  order: ProductionOrder | null;
  onCancel: () => void;
  onSave: (no: string, done: number) => void;
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string>();

  return (
    <FormModal
      open={order !== null}
      title="บันทึกผลผลิต"
      subtitle={order ? `${order.no} · ${product(order.product).name}` : undefined}
      onClose={onCancel}
      size="sm"
    >
      {order && (
        <div className="space-y-3">
          <Progress done={order.done} total={order.qty} label={`ตอนนี้ผลิตแล้ว ${order.done} จาก ${order.qty} ${product(order.product).unit}`} />
          <Field label="จำนวนที่ผลิตได้สะสม" error={error} hint={`กรอกได้ไม่เกิน ${order.qty} ${product(order.product).unit}`}>
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={String(order.done)}
              className={FIELD + " w-full tabular-nums"}
            />
          </Field>
          <Note tone="idle">
            ยอดที่บันทึกคือจำนวนสะสมของทั้งใบ ไม่ใช่จำนวนที่เพิ่งผลิตรอบนี้
            ชั่วโมงที่จองในแผนกำลังการผลิตจะลดลงตามส่วนที่ผลิตเสร็จแล้ว
          </Note>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onCancel}>
              ยกเลิก
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                const n = Number(value);
                if (!Number.isFinite(n) || n < 0 || n > order.qty) {
                  setError(`กรอกเป็นตัวเลขระหว่าง 0 ถึง ${order.qty}`);
                  return;
                }
                setError(undefined);
                onSave(order.no, n);
                setValue("");
              }}
            >
              บันทึก
            </Button>
          </div>
        </div>
      )}
    </FormModal>
  );
}
