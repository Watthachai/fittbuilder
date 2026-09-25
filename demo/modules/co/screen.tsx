import { useState } from "react";
import {
  ArrowRight, Boxes, Building, Calculator, CircleCheck, CircleX, ClipboardList, Coins, FileSpreadsheet, FileText,
  Layers, Link2, Pencil, Percent, PieChart, Play, Plus, Printer, Receipt, Scale, Search as SearchIcon, Share2,
  Split, Target, TrendingDown, TrendingUp, TriangleAlert, Wallet,
} from "lucide-react";
import { account, PERIOD } from "../fi/data";
import {
  ALLOCATION, ALLOCATIONS, CHANNEL_PROFIT_CENTER, COST_CENTERS, COST_ESTIMATES, CYCLES, FINISHED_GOODS,
  INTERNAL_ORDERS, NEXT_PERIOD, OVERHEAD, PROFIT_CENTERS, baht, byChannel, costCenter, costCenterRows,
  currentEstimate, estimateTotals, expenseAccounts, ioBalance, marginRows, nextEstimate, previewCycle, productCost,
  profitCenterRows, reconcile,
} from "./data";
import { CoActions } from "./forms";
import type { Act } from "./forms";
import {
  Avatar, Badge, Bar, Button, Card, Chip, ColumnChart, Donut, Dot, IconRow, Note, PageHead,
  Progress, Reveal, Search, Segmented, Select, StatStrip, Tag, TintCard, swatchFor,
} from "../ui";
import { DataTable, FormModal, downloadCsv, notify, useData } from "../kit";
import type { Column } from "../kit";

const TABS = ["ศูนย์ต้นทุน", "คำสั่งงานภายใน", "ต้นทุนผลิตภัณฑ์", "วิเคราะห์กำไรขั้นต้น", "ศูนย์กำไร"];

// Colours follow the catalogue of the moment, so a centre added mid-demo gets the next hue.
const ccSwatch = (code: string) => swatchFor(code, COST_CENTERS.map((c) => c.code));
const pcSwatch = (code: string) => swatchFor(code, PROFIT_CENTERS.map((p) => p.code));
const pcName = (code: string) => PROFIT_CENTERS.find((p) => p.code === code)?.name ?? code;

type CostCenterRow = ReturnType<typeof costCenterRows>[number];
type MarginRow = ReturnType<typeof marginRows>[number];

const exportIcon = <FileSpreadsheet size={14} />;

/* ----------------------------------------------------------------- screen */

export default function CoScreen({
  section,
  onOpenSection,
}: {
  section?: string;
  onOpenSection?: (index: number) => void;
}) {
  useData();
  const tab = section && TABS.includes(section) ? section : undefined;

  const [q, setQ] = useState("");
  const [openCenter, setOpenCenter] = useState<string | null>(null);
  const [openProduct, setOpenProduct] = useState<string | null>(null);
  const [act, setAct] = useState<Act | null>(null);

  const centers = costCenterRows();
  const margins = marginRows();
  const profits = profitCenterRows();
  const overBudget = centers.filter((c) => c.over);
  const overOrders = INTERNAL_ORDERS.filter((o) => o.spent > o.budget);
  const center = openCenter === null ? null : (centers.find((c) => c.code === openCenter) ?? null);

  const panels = (
    <>
      <FormModal
        open={center !== null}
        title="ศูนย์ต้นทุน"
        subtitle={center ? `${center.code} · ${center.name}` : undefined}
        onClose={() => setOpenCenter(null)}
      >
        {center && <CenterRecord c={center} onAct={setAct} />}
      </FormModal>

      <FormModal
        open={openProduct !== null}
        title="แผ่นคำนวณต้นทุน"
        subtitle={openProduct ? productCost(openProduct).name : undefined}
        onClose={() => setOpenProduct(null)}
        size="sm"
      >
        {openProduct && <CostSheet code={openProduct} onAct={setAct} />}
      </FormModal>

      <CoActions act={act} onAct={setAct} />
    </>
  );

  if (!tab) {
    return (
      <>
        <Overview
          centers={centers}
          margins={margins}
          profits={profits}
          overBudget={overBudget.length}
          overOrders={overOrders.length}
          onOpenSection={onOpenSection}
          onOpenCenter={(c) => setOpenCenter(c.code)}
          onOpenProduct={setOpenProduct}
        />
        {panels}
      </>
    );
  }

  const openIo = INTERNAL_ORDERS.find((o) => o.status === "กำลังดำเนินการ") ?? INTERNAL_ORDERS[0];

  return (
    <div>
      <PageHead
        title="บัญชีบริหารและต้นทุน"
        meta={`${tab} · ${PERIOD.label} · ${COST_CENTERS.length} ศูนย์ต้นทุน · ${PROFIT_CENTERS.length} ศูนย์กำไร`}
      />

      {tab === "ศูนย์ต้นทุน" && <CostCenters centers={centers} onOpen={(c) => setOpenCenter(c.code)} onAct={setAct} />}
      {tab === "คำสั่งงานภายใน" && <InternalOrders onAct={setAct} />}
      {tab === "ต้นทุนผลิตภัณฑ์" && <ProductCosts q={q} setQ={setQ} onOpen={setOpenProduct} onAct={setAct} />}
      {tab === "วิเคราะห์กำไรขั้นต้น" && <Margins margins={margins} onAct={setAct} />}
      {tab === "ศูนย์กำไร" && <ProfitCenters profits={profits} onAct={setAct} />}

      {panels}

      <div hidden data-fitt-index>
        <button data-fitt-screen="บัญชีบริหารและต้นทุน" />
        <button data-fitt-screen="ศูนย์ต้นทุน" data-fitt-modal onClick={() => setOpenCenter(centers[0].code)} />
        <button data-fitt-screen="แผ่นคำนวณต้นทุน" data-fitt-modal onClick={() => setOpenProduct(FINISHED_GOODS[0].code)} />
        <button data-fitt-screen="เพิ่มศูนย์ต้นทุน" data-fitt-modal onClick={() => setAct({ kind: "cc-new" })} />
        <button data-fitt-screen="ตั้งงบศูนย์ต้นทุน" data-fitt-modal onClick={() => setAct({ kind: "budget", code: centers[0].code })} />
        <button data-fitt-screen="สัดส่วนกระจายค่าใช้จ่าย" data-fitt-modal onClick={() => setAct({ kind: "distribution" })} />
        <button data-fitt-screen="รันรอบปันส่วน" data-fitt-modal onClick={() => setAct({ kind: "cycle-run", code: CYCLES[0].code })} />
        <button data-fitt-screen="เพิ่มรอบปันส่วน" data-fitt-modal onClick={() => setAct({ kind: "cycle-new" })} />
        <button data-fitt-screen="เปิดคำสั่งงานภายใน" data-fitt-modal onClick={() => setAct({ kind: "io-new" })} />
        <button data-fitt-screen="คำสั่งงานภายใน" data-fitt-modal onClick={() => setAct({ kind: "io-open", no: openIo.no })} />
        <button data-fitt-screen="บันทึกค่าใช้จ่ายเข้าคำสั่งงาน" data-fitt-modal onClick={() => setAct({ kind: "io-cost", no: openIo.no })} />
        <button data-fitt-screen="อนุมัติงบเพิ่ม" data-fitt-modal onClick={() => setAct({ kind: "io-budget", no: openIo.no })} />
        <button data-fitt-screen="ชำระต้นทุนคำสั่งงาน" data-fitt-modal onClick={() => setAct({ kind: "io-settle", no: openIo.no })} />
        <button data-fitt-screen="ปิดคำสั่งงานภายใน" data-fitt-modal onClick={() => setAct({ kind: "io-close", no: openIo.no })} />
        <button data-fitt-screen="แก้อัตราค่าใช้จ่ายทางอ้อม" data-fitt-modal onClick={() => setAct({ kind: "rate", code: OVERHEAD[0].code })} />
        <button data-fitt-screen="คำนวณต้นทุนผลิตภัณฑ์" data-fitt-modal onClick={() => setAct({ kind: "estimate-new", material: FINISHED_GOODS[0].code })} />
        <button data-fitt-screen="กำหนดใช้ต้นทุน" data-fitt-modal onClick={() => setAct({ kind: "estimate-mark", no: COST_ESTIMATES[COST_ESTIMATES.length - 1].no })} />
        <button data-fitt-screen="ปล่อยใช้ต้นทุนมาตรฐาน" data-fitt-modal onClick={() => setAct({ kind: "estimate-release", no: COST_ESTIMATES[COST_ESTIMATES.length - 1].no })} />
        <button data-fitt-screen="เพิ่มศูนย์กำไร" data-fitt-modal onClick={() => setAct({ kind: "pc-new" })} />
        <button data-fitt-screen="กำหนดสังกัดศูนย์กำไร" data-fitt-modal onClick={() => setAct({ kind: "assign" })} />
        <button data-fitt-screen="พิมพ์รายงานศูนย์ต้นทุน" data-fitt-modal onClick={() => setAct({ kind: "print", d: { doc: "cost-centres" }, title: "รายงานงบเทียบใช้จริง" })} />
        <button data-fitt-screen="พิมพ์งบศูนย์กำไร" data-fitt-modal onClick={() => setAct({ kind: "print", d: { doc: "profit-centres" }, title: "งบกำไรขาดทุนตามศูนย์กำไร" })} />
        <button data-fitt-screen="พิมพ์รายงานกำไรขั้นต้น" data-fitt-modal onClick={() => setAct({ kind: "print", d: { doc: "margins", rows: margins }, title: "รายงานกำไรขั้นต้น" })} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- overview */

function Overview({
  centers,
  margins,
  profits,
  overBudget,
  overOrders,
  onOpenSection,
  onOpenCenter,
  onOpenProduct,
}: {
  centers: CostCenterRow[];
  margins: MarginRow[];
  profits: ReturnType<typeof profitCenterRows>;
  overBudget: number;
  overOrders: number;
  onOpenSection?: (index: number) => void;
  onOpenCenter: (c: CostCenterRow) => void;
  onOpenProduct: (code: string) => void;
}) {
  useData();
  const budget = centers.reduce((n, c) => n + c.budget, 0);
  const actual = centers.reduce((n, c) => n + c.actual, 0);
  const worst = [...margins].sort((a, b) => a.pct - b.pct)[0];
  const r = reconcile();
  const channels = byChannel();

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
        title="ภาพรวมบัญชีบริหารและต้นทุน"
        meta={`${PERIOD.label} · ${COST_CENTERS.length} ศูนย์ต้นทุน · ${PROFIT_CENTERS.length} ศูนย์กำไร`}
        right={
          onOpenSection ? (
            <Button variant="primary" icon={<PieChart size={15} />} onClick={() => onOpenSection(4)}>
              เปิดศูนย์กำไร
            </Button>
          ) : undefined
        }
      />

      <Reveal>
        <div className="grid gap-3 xl:grid-cols-3">
          <Card
            className="xl:col-span-2"
            title={<span className="flex items-center gap-2"><Target size={15} className="text-slate-400" />งบเทียบยอดใช้จริงรายศูนย์ต้นทุน</span>}
            action={seeAll(0)}
          >
            <div className="p-4">
              <p className="text-[32px] font-semibold leading-none tabular-nums text-slate-900 dark:text-slate-50">{baht(actual)}</p>
              <p className="mt-1.5 text-[12.5px] text-slate-500 dark:text-slate-400">
                ใช้จริงจากงบรวม {baht(budget)} · {actual > budget ? `เกินงบ ${baht(actual - budget)}` : `เหลืองบ ${baht(budget - actual)}`}
              </p>
              <div className="mt-4 space-y-2.5">
                {centers.map((c) => (
                  <div key={c.code} className="flex items-center gap-3">
                    <span className="flex w-36 shrink-0 items-center gap-1.5 truncate text-[12.5px] text-slate-600 dark:text-slate-300">
                      <Dot className={ccSwatch(c.code).dot} />
                      {c.name}
                    </span>
                    <span className="min-w-0 flex-1">
                      <Bar pct={Math.min(100, c.pct)} tone={c.over ? "bad" : c.pct > 90 ? "warn" : "ok"} width="w-full" />
                    </span>
                    <span className="w-40 shrink-0 text-right text-[11.5px] tabular-nums text-slate-500 dark:text-slate-400">
                      {baht(c.actual)} จาก {baht(c.budget)}
                    </span>
                    <button onClick={() => onOpenCenter(c)} className="shrink-0">
                      <Badge tone={c.over ? "bad" : "ok"}>{c.pct}%</Badge>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card
            title={<span className="flex items-center gap-2"><TriangleAlert size={15} className="text-slate-400" />ต้องจัดการ</span>}
            action={seeAll(1)}
          >
            <div className="space-y-2.5 p-4">
              {[
                { icon: <Target size={15} />, label: "ศูนย์ต้นทุนที่ใช้เกินงบ", value: overBudget, unit: "ศูนย์", tone: "bad" as const, to: 0 },
                { icon: <ClipboardList size={15} />, label: "คำสั่งงานที่ใช้เกินงบ", value: overOrders, unit: "งาน", tone: "bad" as const, to: 1 },
                { icon: <TrendingDown size={15} />, label: "ใบสั่งขายที่อัตรากำไรต่ำสุด", value: worst ? worst.pct : 0, unit: "%", tone: "warn" as const, to: 3 },
                { icon: <Scale size={15} />, label: "ศูนย์กำไรที่ขาดทุน", value: profits.filter((p) => p.result < 0).length, unit: "ศูนย์", tone: "warn" as const, to: 4 },
              ].map((x) => (
                <button
                  key={x.label}
                  onClick={() => onOpenSection?.(x.to)}
                  className="flex w-full items-center gap-3 rounded-xl bg-slate-50 px-3.5 py-3 text-left transition hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-800"
                >
                  <span className="text-slate-400">{x.icon}</span>
                  <span className="min-w-0 flex-1 text-[12.5px] text-slate-700 dark:text-slate-200">{x.label}</span>
                  <Badge tone={x.value > 0 ? x.tone : "ok"}>
                    {x.value} {x.unit}
                  </Badge>
                </button>
              ))}
              <Note tone={r.tiesOut ? "ok" : "warn"}>
                {r.tiesOut
                  ? "ผลรวมของทุกศูนย์กำไรตรงกับผลประกอบการในงบการเงิน ปันส่วนครบถ้วน"
                  : `ผลรวมของทุกศูนย์กำไรต่างจากงบการเงิน ${baht(Math.abs(r.company - r.centres))} ดูรายการกระทบยอดในหน้าศูนย์กำไร`}
              </Note>
            </div>
          </Card>
        </div>
      </Reveal>

      <Reveal delay={0.08} className="mt-3">
        <div className="grid gap-3 xl:grid-cols-3">
          <Card title={<span className="flex items-center gap-2"><Layers size={15} className="text-slate-400" />ค่าใช้จ่ายตามศูนย์ต้นทุน</span>} action={seeAll(0)}>
            <div className="p-4">
              <Donut
                segments={centers.filter((c) => c.actual > 0).map((c) => ({ label: c.name, value: c.actual, swatch: ccSwatch(c.code) }))}
                size={128}
                format={(n) => baht(n)}
                center={
                  <span>
                    <span className="block text-[18px] font-semibold leading-none tabular-nums text-slate-900 dark:text-slate-50">
                      {budget ? Math.round((actual / budget) * 100) : 0}%
                    </span>
                    <span className="mt-1 block text-[10.5px] uppercase tracking-wide text-slate-400">ของงบ</span>
                  </span>
                }
              />
            </div>
          </Card>

          <Card
            className="xl:col-span-2"
            title={<span className="flex items-center gap-2"><Percent size={15} className="text-slate-400" />กำไรขั้นต้นตามช่องทางขาย</span>}
            subtitle="รายได้จากใบกำกับภาษีหักใบลดหนี้ ลบต้นทุนผลิตภัณฑ์ที่รวมค่าใช้จ่ายทางอ้อมแล้ว"
            action={seeAll(3)}
          >
            <ColumnChart
              data={channels.map((c) => ({ label: c.channel, value: c.margin, tone: c.margin < 0 ? ("warn" as const) : undefined }))}
              format={(n) => baht(n)}
              height={160}
            />
            <ul className="divide-y divide-slate-100 border-t border-slate-100 dark:divide-slate-800 dark:border-slate-800">
              {channels.map((c) => (
                <li key={c.channel} className="flex flex-wrap items-center gap-3 px-4 py-2">
                  <span className="w-32 shrink-0 truncate text-[12.5px] text-slate-800 dark:text-slate-100">{c.channel}</span>
                  <span className="shrink-0 text-[11.5px] text-slate-400">{c.orders} ใบ</span>
                  <span className="min-w-0 flex-1">
                    <Bar pct={Math.max(0, c.pct)} tone={c.pct < 20 ? "warn" : "ok"} width="w-full" />
                  </span>
                  <span className="w-28 shrink-0 text-right text-[11.5px] tabular-nums text-slate-400">รายได้ {baht(c.revenue)}</span>
                  <span className="w-28 shrink-0 text-right text-[12.5px] tabular-nums text-slate-900 dark:text-slate-50">{baht(c.margin)}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </Reveal>

      <Reveal delay={0.16} className="mt-3">
        <div className="grid gap-3 xl:grid-cols-2">
          <Card
            title={<span className="flex items-center gap-2"><Boxes size={15} className="text-slate-400" />ต้นทุนผลิตภัณฑ์</span>}
            subtitle="ต้นทุนทางตรงจากแฟ้มวัสดุ บวกค่าใช้จ่ายทางอ้อมตามอัตราที่ประกาศไว้"
            action={seeAll(2)}
          >
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {FINISHED_GOODS.map((p) => {
                const c = productCost(p.code);
                return (
                  <li key={p.code} className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <Dot className={swatchFor(p.code).dot} />
                      <button onClick={() => onOpenProduct(p.code)} className="min-w-0 flex-1 truncate text-left text-[13px] text-slate-900 transition hover:text-violet-700 dark:text-slate-50">
                        {c.name}
                      </button>
                      <span className="shrink-0 text-[13px] font-semibold tabular-nums text-slate-900 dark:text-slate-50">{baht(c.total)}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="w-20 shrink-0 text-[11px] text-slate-400">ทางตรง</span>
                      <span className="min-w-0 flex-1">
                        <Bar pct={(c.direct / c.total) * 100} tone="accent" width="w-full" />
                      </span>
                      <span className="w-24 shrink-0 text-right text-[11px] tabular-nums text-slate-500 dark:text-slate-400">{baht(c.direct)}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="w-20 shrink-0 text-[11px] text-slate-400">ทางอ้อม</span>
                      <span className="min-w-0 flex-1">
                        <Bar pct={(c.overhead / c.total) * 100} tone="warn" width="w-full" />
                      </span>
                      <span className="w-24 shrink-0 text-right text-[11px] tabular-nums text-slate-500 dark:text-slate-400">{baht(c.overhead)}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card
            title={<span className="flex items-center gap-2"><PieChart size={15} className="text-slate-400" />ผลของแต่ละศูนย์กำไร</span>}
            subtitle={`รวมทุกศูนย์ ${baht(r.centres)} เทียบกับผลประกอบการในงบการเงิน ${baht(r.company)}`}
            action={seeAll(4)}
          >
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {profits.map((p) => (
                <li key={p.code} className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <span className={"grid size-8 shrink-0 place-items-center rounded-lg " + pcSwatch(p.code).tint}>
                      <Building size={15} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] text-slate-900 dark:text-slate-50">{p.name}</span>
                      <span className="block font-mono text-[11px] text-slate-400">{p.code}</span>
                    </span>
                    <span className={"shrink-0 text-[14px] font-semibold tabular-nums " + (p.result >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                      {baht(p.result)}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11.5px] text-slate-400">
                    <Chip>รายได้ {baht(p.revenue)}</Chip>
                    <Chip>กำไรขั้นต้น {baht(p.grossMargin)}</Chip>
                    {Math.round(p.unabsorbed) !== 0 && <Chip>ทางอ้อมที่เหลือ {baht(p.unabsorbed)}</Chip>}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </Reveal>
    </div>
  );
}

/* ---------------------------------------------------------- cost centres */

function CostCenters({ centers, onOpen, onAct }: { centers: CostCenterRow[]; onOpen: (c: CostCenterRow) => void; onAct: (a: Act) => void }) {
  useData();
  const budget = centers.reduce((n, c) => n + c.budget, 0);
  const actual = centers.reduce((n, c) => n + c.actual, 0);

  const exportRows = () => {
    downloadCsv(
      "ศูนย์ต้นทุน-" + PERIOD.to.slice(0, 7),
      ["รหัส", "ศูนย์ต้นทุน", "ผู้รับผิดชอบ", "ศูนย์กำไร", "งบ", "รับตรง", "ปันส่วนเข้า", "ปันส่วนออก", "ชำระจากคำสั่งงาน", "ใช้จริง", "ผลต่าง"],
      centers.map((c) => [c.code, c.name, c.owner, pcName(c.profitCenter), c.budget, Math.round(c.primary), Math.round(c.allocIn), Math.round(c.allocOut), c.settled, c.actual, c.variance])
    );
    notify(`ส่งออกศูนย์ต้นทุน ${centers.length} ศูนย์แล้ว`);
  };

  return (
    <div className="space-y-3">
      <StatStrip
        title="งบและยอดใช้จริง"
        icon={<Target size={15} />}
        cells={[
          { icon: <Wallet size={13} />, label: "งบรวมทั้งงวด", value: baht(budget), sub: `${COST_CENTERS.length} ศูนย์ต้นทุน` },
          { icon: <Coins size={13} />, label: "ใช้จริง", value: baht(actual), sub: "กระจายมาจากบัญชีค่าใช้จ่าย", tone: "info" },
          { icon: <Scale size={13} />, label: actual > budget ? "เกินงบ" : "เหลืองบ", value: baht(Math.abs(budget - actual)), sub: `คิดเป็น ${budget ? Math.round((actual / budget) * 100) : 0}% ของงบ`, tone: actual > budget ? "bad" : "ok" },
          { icon: <TriangleAlert size={13} />, label: "ศูนย์ที่ใช้เกินงบ", value: centers.filter((c) => c.over).length + " ศูนย์", sub: "ต้องอธิบายส่วนที่เกิน", tone: centers.some((c) => c.over) ? "bad" : "ok" },
        ]}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" icon={<Plus size={15} />} onClick={() => onAct({ kind: "cc-new" })}>
          เพิ่มศูนย์ต้นทุน
        </Button>
        <Button variant="secondary" icon={<Split size={14} />} onClick={() => onAct({ kind: "distribution" })}>
          สัดส่วนกระจายค่าใช้จ่าย
        </Button>
        <span className="ml-auto" />
        <Button variant="ghost" icon={exportIcon} onClick={exportRows}>
          ส่งออก Excel
        </Button>
        <Button variant="ghost" icon={<Printer size={14} />} onClick={() => onAct({ kind: "print", d: { doc: "cost-centres" }, title: "รายงานงบเทียบใช้จริง" })}>
          พิมพ์รายงาน
        </Button>
      </div>

      <Card
        title={<span className="flex items-center gap-2"><Target size={15} className="text-slate-400" />ศูนย์ต้นทุน</span>}
        subtitle="ยอดใช้จริงกระจายมาจากบัญชีค่าใช้จ่ายตามสัดส่วนที่ประกาศไว้ บวกลบการปันส่วน กดที่แถวเพื่อดูที่มาและตั้งงบ"
      >
        <table className="w-full text-[13px]">
          <thead className="bg-slate-50/80 text-left text-[11px] uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">ศูนย์ต้นทุน</th>
              <th className="px-4 py-3 font-medium">ผู้รับผิดชอบ</th>
              <th className="px-4 py-3 font-medium">ศูนย์กำไรที่สังกัด</th>
              <th className="px-4 py-3 text-right font-medium">งบ</th>
              <th className="px-4 py-3 text-right font-medium">ใช้จริง</th>
              <th className="px-4 py-3 font-medium">สัดส่วนที่ใช้</th>
              <th className="px-4 py-3 text-right font-medium">ผลต่าง</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {centers.map((c) => (
              <tr key={c.code} onClick={() => onOpen(c)} className="cursor-pointer transition hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <td className="px-4 py-2.5">
                  <span className="flex items-center gap-2">
                    <Dot className={ccSwatch(c.code).dot} />
                    <span>
                      <span className="block font-medium text-slate-900 dark:text-slate-50">{c.name}</span>
                      <span className="block font-mono text-[11px] text-slate-400">{c.code}</span>
                    </span>
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                    <Avatar name={c.owner} size="sm" />
                    {c.owner}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <Tag swatch={pcSwatch(c.profitCenter)}>{pcName(c.profitCenter)}</Tag>
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-300">{baht(c.budget)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-slate-900 dark:text-slate-50">{baht(c.actual)}</td>
                <td className="px-4 py-2.5">
                  <Bar pct={Math.min(100, c.pct)} tone={c.over ? "bad" : c.pct > 90 ? "warn" : "ok"} width="w-24" />
                </td>
                <td className={"px-4 py-2.5 text-right font-semibold tabular-nums " + (c.over ? "text-rose-600 dark:text-rose-400" : "text-emerald-700 dark:text-emerald-400")}>
                  {c.over ? "−" : "+"}
                  {baht(Math.abs(c.variance))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="grid gap-3 xl:grid-cols-2">
        <Card
          title={<span className="flex items-center gap-2"><Share2 size={15} className="text-slate-400" />รอบปันส่วน</span>}
          subtitle="ศูนย์ส่งปันยอดทั้งหมดให้ศูนย์รับตามสัดส่วน รันตอนปิดงวด"
          action={
            <Button variant="secondary" icon={<Plus size={14} />} onClick={() => onAct({ kind: "cycle-new" })}>
              เพิ่มรอบปันส่วน
            </Button>
          }
        >
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {CYCLES.map((cy) => {
              const amount = previewCycle(cy.code).amount;
              return (
                <li key={cy.code} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] text-slate-900 dark:text-slate-50">{cy.name}</span>
                    <span className="block text-[11.5px] text-slate-400">
                      <span className="font-mono">{cy.code}</span> · {costCenter(cy.sender).name} →{" "}
                      {Object.entries(cy.receivers).map(([cc, s]) => `${costCenter(cc).name} ${Math.round(s * 100)}%`).join(" · ")}
                    </span>
                  </span>
                  <span className="shrink-0 text-[12.5px] tabular-nums text-slate-600 dark:text-slate-300">{baht(amount)}</span>
                  <Button variant="secondary" icon={<Play size={13} />} onClick={() => onAct({ kind: "cycle-run", code: cy.code })} disabled={amount <= 0.005}>
                    รัน
                  </Button>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card
          title={<span className="flex items-center gap-2"><FileText size={15} className="text-slate-400" />รายการปันส่วนในงวด</span>}
          subtitle="ทุกครั้งที่รันรอบปันส่วน พร้อมใบบันทึกให้พิมพ์"
        >
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {ALLOCATIONS.length === 0 && <li className="px-4 py-8 text-center text-[12.5px] text-slate-400">ยังไม่ได้รันรอบปันส่วนในงวดนี้</li>}
            {ALLOCATIONS.map((a) => (
              <li key={a.no} className="flex items-center gap-3 px-4 py-2.5">
                <span className="w-24 shrink-0 font-mono text-[12px] text-slate-500 dark:text-slate-400">{a.no}</span>
                <span className="min-w-0 flex-1 truncate text-[12.5px] text-slate-800 dark:text-slate-100">
                  {costCenter(a.sender).name} → {a.lines.map((l) => costCenter(l.costCenter).name).join(", ")}
                </span>
                <span className="shrink-0 text-[12.5px] tabular-nums text-slate-900 dark:text-slate-50">{baht(a.amount)}</span>
                <button
                  onClick={() => onAct({ kind: "print", d: { doc: "allocation", no: a.no }, title: "ใบบันทึกการปันส่วนต้นทุน" })}
                  aria-label="พิมพ์ใบบันทึก"
                  title="พิมพ์ใบบันทึก"
                  className="grid size-7 place-items-center rounded-lg text-slate-400 transition hover:bg-violet-50 hover:text-violet-600 dark:hover:bg-violet-500/15 dark:hover:text-violet-300"
                >
                  <Printer size={14} />
                </button>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Note tone="idle">
        ต้นทุนขายไม่ถูกปันส่วนเข้าศูนย์ต้นทุน เพราะเป็นต้นทุนของผลิตภัณฑ์ที่ไปปรากฏในกำไรขั้นต้น
        ไม่ใช่ค่าใช้จ่ายที่หัวหน้าหน่วยงานควบคุมได้
      </Note>
    </div>
  );
}

/* ------------------------------------------------------- internal orders */

function InternalOrders({ onAct }: { onAct: (a: Act) => void }) {
  useData();
  const budget = INTERNAL_ORDERS.reduce((n, o) => n + o.budget, 0);
  const spent = INTERNAL_ORDERS.reduce((n, o) => n + o.spent, 0);

  const exportRows = () => {
    downloadCsv(
      "คำสั่งงานภายใน",
      ["เลขที่", "ชื่องาน", "ศูนย์ต้นทุน", "เปิดงาน", "งบ", "ใช้ไป", "ยอดค้างรอชำระ", "สถานะ"],
      INTERNAL_ORDERS.map((o) => [o.no, o.name, costCenter(o.costCenter).name, o.opened, o.budget, o.spent, ioBalance(o), o.status])
    );
    notify(`ส่งออกคำสั่งงานภายใน ${INTERNAL_ORDERS.length} งานแล้ว`);
  };

  return (
    <div className="space-y-3">
      <StatStrip
        title="คำสั่งงานภายใน"
        icon={<ClipboardList size={15} />}
        cells={[
          { icon: <ClipboardList size={13} />, label: "งานที่เปิดไว้", value: INTERNAL_ORDERS.length + " งาน", sub: `${INTERNAL_ORDERS.filter((o) => o.status === "กำลังดำเนินการ").length} งานยังไม่ปิด` },
          { icon: <Wallet size={13} />, label: "งบรวม", value: baht(budget), sub: "แยกจากงบประจำของศูนย์ต้นทุน", tone: "info" },
          { icon: <Coins size={13} />, label: "ใช้ไปแล้ว", value: baht(spent), sub: `คิดเป็น ${budget ? Math.round((spent / budget) * 100) : 0}% ของงบ`, tone: "accent" },
          { icon: <TriangleAlert size={13} />, label: "งานที่ใช้เกินงบ", value: INTERNAL_ORDERS.filter((o) => o.spent > o.budget).length + " งาน", sub: "ต้องขออนุมัติงบเพิ่ม", tone: INTERNAL_ORDERS.some((o) => o.spent > o.budget) ? "bad" : "ok" },
        ]}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" icon={<Plus size={15} />} onClick={() => onAct({ kind: "io-new" })}>
          เปิดคำสั่งงานภายใน
        </Button>
        <span className="ml-auto" />
        <Button variant="ghost" icon={exportIcon} onClick={exportRows}>
          ส่งออก Excel
        </Button>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {INTERNAL_ORDERS.map((o) => {
          const over = o.spent > o.budget;
          const sw = ccSwatch(o.costCenter);
          const open = o.status === "กำลังดำเนินการ";
          const balance = ioBalance(o);
          return (
            <Card
              key={o.no}
              title={
                <span className="flex items-center gap-2.5">
                  <span className={"grid size-8 place-items-center rounded-lg " + sw.tint}>
                    <ClipboardList size={15} />
                  </span>
                  <button onClick={() => onAct({ kind: "io-open", no: o.no })} className="text-left hover:text-violet-700">
                    {o.name}
                  </button>
                </span>
              }
              subtitle={`${o.no} · ${costCenter(o.costCenter).name} · เปิดงานเมื่อ ${o.opened}`}
              action={<Badge tone={o.status === "ปิดงานแล้ว" ? "ok" : over ? "bad" : "warn"} dot>{o.status}</Badge>}
            >
              <div className="space-y-3 p-4">
                <Progress done={Math.min(o.spent, o.budget)} total={o.budget} label={`ใช้ไป ${baht(o.spent)} จากงบ ${baht(o.budget)}`} />
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "งบที่อนุมัติ", value: baht(o.budget), bad: false },
                    { label: over ? "เกินงบ" : "เหลืองบ", value: baht(Math.abs(o.budget - o.spent)), bad: over },
                    { label: "ยอดค้างรอชำระ", value: baht(balance), bad: false },
                  ].map((c) => (
                    <div key={c.label} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
                      <div className="text-[11.5px] text-slate-500 dark:text-slate-400">{c.label}</div>
                      <div className={"mt-1 text-[14px] font-semibold tabular-nums " + (c.bad ? "text-rose-600 dark:text-rose-400" : "text-slate-900 dark:text-slate-50")}>
                        {c.value}
                      </div>
                    </div>
                  ))}
                </div>
                {over && open && (
                  <Note tone="bad">ใช้เกินงบที่อนุมัติไว้ {baht(o.spent - o.budget)} ต้องอนุมัติงบเพิ่มก่อนบันทึกค่าใช้จ่ายรอบถัดไป</Note>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {open && (
                    <Button variant="secondary" icon={<Plus size={13} />} onClick={() => onAct({ kind: "io-cost", no: o.no })}>
                      บันทึกค่าใช้จ่าย
                    </Button>
                  )}
                  {open && over && (
                    <Button variant="secondary" onClick={() => onAct({ kind: "io-budget", no: o.no })}>
                      อนุมัติงบเพิ่ม
                    </Button>
                  )}
                  {balance > 0 && (
                    <Button variant="secondary" onClick={() => onAct({ kind: "io-settle", no: o.no })}>
                      ชำระต้นทุน
                    </Button>
                  )}
                  {open && balance === 0 && (
                    <Button variant="secondary" onClick={() => onAct({ kind: "io-close", no: o.no })}>
                      ปิดงาน
                    </Button>
                  )}
                  <Button variant="ghost" onClick={() => onAct({ kind: "io-open", no: o.no })}>
                    รายละเอียด
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/* --------------------------------------------------------- product costs */

function ProductCosts({ q, setQ, onOpen, onAct }: { q: string; setQ: (v: string) => void; onOpen: (code: string) => void; onAct: (a: Act) => void }) {
  useData();
  const needle = q.trim().toLowerCase();
  const rows = FINISHED_GOODS.filter(
    (p) => needle === "" || [p.code, p.name].some((t) => t.toLowerCase().includes(needle))
  ).map((p) => ({ p, c: productCost(p.code), next: nextEstimate(p.code) }));

  const columns: Column<(typeof rows)[number]>[] = [
    {
      key: "name",
      header: "สินค้า",
      width: "28%",
      sort: (a, b) => a.c.name.localeCompare(b.c.name, "th"),
      cell: (r) => (
        <span className="flex items-center gap-2">
          <Dot className={swatchFor(r.p.code).dot} />
          <span>
            <span className="block font-medium text-slate-900 dark:text-slate-50">{r.c.name}</span>
            <span className="block font-mono text-[11px] text-slate-400">{r.p.code}</span>
          </span>
        </span>
      ),
    },
    {
      key: "direct",
      header: "ต้นทุนทางตรง",
      align: "right",
      width: "14%",
      sort: (a, b) => a.c.direct - b.c.direct,
      cell: (r) => <span className="tabular-nums text-slate-700 dark:text-slate-200">{baht(r.c.direct)}</span>,
    },
    ...OVERHEAD.map((o) => ({
      key: o.code,
      header: `${o.name} ${Math.round(o.rate * 100)}%`,
      align: "right" as const,
      width: "14%",
      cell: (r: (typeof rows)[number]) => (
        <span className="tabular-nums text-slate-600 dark:text-slate-300">{baht(r.c.lines.find((l) => l.code === o.code)!.amount)}</span>
      ),
    })),
    {
      key: "total",
      header: "ต้นทุนรวม",
      align: "right",
      width: "14%",
      sort: (a, b) => a.c.total - b.c.total,
      cell: (r) => <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-50">{baht(r.c.total)}</span>,
    },
    {
      key: "next",
      header: `มาตรฐาน ${NEXT_PERIOD}`,
      align: "right",
      width: "16%",
      cell: (r) =>
        r.next ? (
          <span className="tabular-nums text-violet-700 dark:text-violet-300">{baht(estimateTotals(r.next).direct)}</span>
        ) : (
          <span className="text-slate-300 dark:text-slate-600">ไม่เปลี่ยน</span>
        ),
    },
  ];

  const exportRows = () => {
    downloadCsv(
      "ต้นทุนผลิตภัณฑ์",
      ["รหัส", "สินค้า", "ต้นทุนทางตรง", ...OVERHEAD.map((o) => o.name), "ต้นทุนรวม", `มาตรฐานตั้งแต่ ${NEXT_PERIOD}`],
      rows.map((r) => [r.p.code, r.c.name, r.c.direct, ...r.c.lines.map((l) => l.amount), r.c.total, r.next ? estimateTotals(r.next).direct : ""])
    );
    notify(`ส่งออกต้นทุนผลิตภัณฑ์ ${rows.length} รายการแล้ว`);
  };

  const estimates = [...COST_ESTIMATES].reverse();

  return (
    <div className="space-y-3">
      <Card
        title={<span className="flex items-center gap-2"><Calculator size={15} className="text-slate-400" />อัตราค่าใช้จ่ายทางอ้อม</span>}
        subtitle="บวกเข้าต้นทุนผลิตภัณฑ์ทุกหน่วยตามฐานที่กำหนด"
      >
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {OVERHEAD.map((o) => (
            <li key={o.code} className="flex items-center gap-3 px-4 py-3">
              <span className="font-mono text-[11.5px] text-slate-400">{o.code}</span>
              <span className="min-w-0 flex-1 text-[13px] text-slate-900 dark:text-slate-50">{o.name}</span>
              <span className="shrink-0 text-[11.5px] text-slate-400">ฐาน: {o.base}</span>
              <Badge tone="accent">{Math.round(o.rate * 10000) / 100}%</Badge>
              <button
                onClick={() => onAct({ kind: "rate", code: o.code })}
                aria-label={`แก้อัตรา${o.name}`}
                title="แก้อัตรา"
                className="grid size-7 place-items-center rounded-lg text-slate-400 transition hover:bg-violet-50 hover:text-violet-600 dark:hover:bg-violet-500/15 dark:hover:text-violet-300"
              >
                <Pencil size={14} />
              </button>
            </li>
          ))}
        </ul>
      </Card>

      <DataTable
        rows={rows}
        columns={columns}
        getId={(r) => r.p.code}
        onOpen={(r) => onOpen(r.p.code)}
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <Search value={q} onChange={setQ} placeholder="ค้นหาชื่อสินค้าหรือรหัส" icon={<SearchIcon size={14} />} />
            <span className="ml-auto text-[12px] text-slate-400">กดที่แถวเพื่อเปิดแผ่นคำนวณต้นทุน</span>
            <Button variant="ghost" icon={exportIcon} onClick={exportRows}>
              ส่งออก Excel
            </Button>
            <Button variant="primary" icon={<Calculator size={14} />} onClick={() => onAct({ kind: "estimate-new", material: FINISHED_GOODS[0].code })}>
              คำนวณต้นทุนใหม่
            </Button>
          </div>
        }
      />

      <Card
        title={<span className="flex items-center gap-2"><FileText size={15} className="text-slate-400" />แผ่นคำนวณต้นทุนมาตรฐาน</span>}
        subtitle={`คำนวณ → กำหนดใช้ → ปล่อยใช้ ต้นทุนที่ปล่อยใช้มีผลตั้งแต่ ${NEXT_PERIOD} งวดปัจจุบันไม่เปลี่ยนย้อนหลัง`}
      >
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {estimates.map((e) => {
            const t = estimateTotals(e);
            const m = productCost(e.material);
            return (
              <li key={e.no} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                <span className="w-28 shrink-0 font-mono text-[12px] text-slate-500 dark:text-slate-400">{e.no}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] text-slate-900 dark:text-slate-50">{m.name}</span>
                  <span className="block text-[11.5px] text-slate-400">
                    คำนวณ {e.date} · ทางตรง {baht(t.direct)} · รวม {baht(t.total)}
                    {e.validFrom ? ` · มีผล ${e.validFrom}` : ""}
                  </span>
                </span>
                <Badge tone={e.status === "ปล่อยใช้แล้ว" ? "ok" : e.status === "กำหนดใช้แล้ว" ? "info" : e.status === "ถูกแทนที่" ? "idle" : "warn"}>{e.status}</Badge>
                {e.status === "คำนวณแล้ว" && (
                  <Button variant="secondary" onClick={() => onAct({ kind: "estimate-mark", no: e.no })}>
                    กำหนดใช้
                  </Button>
                )}
                {e.status === "กำหนดใช้แล้ว" && (
                  <Button variant="primary" onClick={() => onAct({ kind: "estimate-release", no: e.no })}>
                    ปล่อยใช้
                  </Button>
                )}
                <button
                  onClick={() => onAct({ kind: "print", d: { doc: "estimate", no: e.no }, title: "แผ่นคำนวณต้นทุนผลิตภัณฑ์" })}
                  aria-label="พิมพ์แผ่นคำนวณ"
                  title="พิมพ์แผ่นคำนวณ"
                  className="grid size-7 place-items-center rounded-lg text-slate-400 transition hover:bg-violet-50 hover:text-violet-600 dark:hover:bg-violet-500/15 dark:hover:text-violet-300"
                >
                  <Printer size={14} />
                </button>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}

/* -------------------------------------------------------------- margins */

const SORTS = ["อัตรากำไรต่ำสุดก่อน", "รายได้สูงสุดก่อน", "กำไรสูงสุดก่อน"];

function Margins({ margins, onAct }: { margins: MarginRow[]; onAct: (a: Act) => void }) {
  useData();
  const [sortBy, setSortBy] = useState(SORTS[0]);
  const [channel, setChannel] = useState("ทุกช่องทาง");
  const [pc, setPc] = useState("ทุกศูนย์กำไร");
  const [q, setQ] = useState("");

  const needle = q.trim().toLowerCase();
  const filtered = margins.filter(
    (m) =>
      (channel === "ทุกช่องทาง" || m.channel === channel) &&
      (pc === "ทุกศูนย์กำไร" || pcName(m.profitCenter) === pc) &&
      (needle === "" || [m.so, m.customerName, ...m.invoices].some((t) => t.toLowerCase().includes(needle)))
  );
  const rows =
    sortBy === SORTS[0]
      ? [...filtered].sort((a, b) => a.pct - b.pct)
      : sortBy === SORTS[1]
        ? [...filtered].sort((a, b) => b.revenue - a.revenue)
        : [...filtered].sort((a, b) => b.margin - a.margin);

  const revenue = rows.reduce((n, m) => n + m.revenue, 0);
  const cost = rows.reduce((n, m) => n + m.cost, 0);
  const worst = [...rows].sort((a, b) => a.pct - b.pct)[0];
  const channels = byChannel();

  const exportRows = () => {
    downloadCsv(
      "กำไรขั้นต้นรายใบสั่งขาย",
      ["ใบสั่งขาย", "ใบกำกับ", "ใบลดหนี้", "ลูกค้า", "ช่องทาง", "ศูนย์กำไร", "รายได้สุทธิ", "ต้นทุน", "กำไรขั้นต้น", "อัตรากำไร %"],
      rows.map((m) => [m.so, m.invoices.join(" "), m.credits.join(" "), m.customerName, m.channel, pcName(m.profitCenter), m.revenue, Math.round(m.cost), Math.round(m.margin), m.pct])
    );
    notify(`ส่งออกกำไรขั้นต้น ${rows.length} ใบสั่งขายแล้ว`);
  };

  return (
    <div className="space-y-3">
      <StatStrip
        title="กำไรขั้นต้น"
        icon={<Percent size={15} />}
        cells={[
          { icon: <Receipt size={13} />, label: "รายได้สุทธิ", value: baht(revenue), sub: `${rows.length} ใบสั่งขายที่ออกใบกำกับแล้ว` },
          { icon: <Boxes size={13} />, label: "ต้นทุนผลิตภัณฑ์", value: baht(cost), sub: "รวมค่าใช้จ่ายทางอ้อมตามอัตราแล้ว", tone: "warn" },
          { icon: <TrendingUp size={13} />, label: "กำไรขั้นต้น", value: baht(revenue - cost), sub: `คิดเป็น ${revenue ? Math.round(((revenue - cost) / revenue) * 100) : 0}% ของรายได้`, tone: "ok" },
          { icon: <TrendingDown size={13} />, label: "อัตรากำไรต่ำสุด", value: worst ? worst.pct + "%" : "—", sub: worst?.so ?? "ไม่มีรายการ", tone: "bad" },
        ]}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Segmented options={SORTS} value={sortBy} onChange={setSortBy} />
        <Select value={channel} onChange={setChannel} options={["ทุกช่องทาง", ...Object.keys(CHANNEL_PROFIT_CENTER)]} className="w-40" />
        <Select value={pc} onChange={setPc} options={["ทุกศูนย์กำไร", ...PROFIT_CENTERS.map((p) => p.name)]} className="w-40" />
        <Search value={q} onChange={setQ} placeholder="ค้นหาลูกค้า ใบสั่งขาย ใบกำกับ" icon={<SearchIcon size={14} />} className="w-56" />
        <span className="ml-auto" />
        <Button variant="ghost" icon={exportIcon} onClick={exportRows}>
          ส่งออก Excel
        </Button>
        <Button variant="ghost" icon={<Printer size={14} />} onClick={() => onAct({ kind: "print", d: { doc: "margins", rows }, title: "รายงานกำไรขั้นต้น" })}>
          พิมพ์
        </Button>
      </div>

      <Card
        title={<span className="flex items-center gap-2"><Percent size={15} className="text-slate-400" />กำไรขั้นต้นรายใบสั่งขาย</span>}
        subtitle="รายได้จากใบกำกับภาษีหักใบลดหนี้ ชุดเดียวกับที่บัญชีลงรายได้ ใบสั่งขายที่ยกเลิกไม่นับ"
      >
        <table className="w-full text-[13px]">
          <thead className="bg-slate-50/80 text-left text-[11px] uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">ใบสั่งขาย</th>
              <th className="px-4 py-3 font-medium">ลูกค้า</th>
              <th className="px-4 py-3 font-medium">ช่องทาง</th>
              <th className="px-4 py-3 text-right font-medium">รายได้</th>
              <th className="px-4 py-3 text-right font-medium">ต้นทุน</th>
              <th className="px-4 py-3 text-right font-medium">กำไรขั้นต้น</th>
              <th className="px-4 py-3 font-medium">อัตรากำไร</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                  ไม่มีใบสั่งขายที่ตรงกับเงื่อนไข
                </td>
              </tr>
            )}
            {rows.map((m) => (
              <tr key={m.so} className="transition hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <td className="px-4 py-2.5">
                  <span className="block font-mono text-[12px] text-slate-500 dark:text-slate-400">{m.so}</span>
                  <span className="block text-[11px] text-slate-400">
                    {m.invoices.join(", ")}
                    {m.credits.length > 0 ? ` · ลดหนี้ ${m.credits.join(", ")}` : ""}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <span className="flex items-center gap-2.5">
                    <Avatar name={m.customerName.replace(/^(บจก\.|หจก\.|ร้าน)\s*/, "")} size="sm" />
                    <span className="text-slate-900 dark:text-slate-50">{m.customerName}</span>
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <Tag swatch={pcSwatch(m.profitCenter)}>{m.channel}</Tag>
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-slate-700 dark:text-slate-200">{baht(m.revenue)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-300">{baht(m.cost)}</td>
                <td className={"px-4 py-2.5 text-right font-semibold tabular-nums " + (m.margin >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                  {baht(m.margin)}
                </td>
                <td className="px-4 py-2.5">
                  <Bar pct={Math.max(0, m.pct)} tone={m.pct < 20 ? "bad" : m.pct < 35 ? "warn" : "ok"} width="w-20" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="grid gap-3 lg:grid-cols-3">
        {channels.map((c) => (
          <TintCard key={c.channel} swatch={swatchFor(c.channel)}>
            <div className="flex items-start justify-between gap-2">
              <span className="text-[13.5px] font-semibold">{c.channel}</span>
              <Tag swatch={swatchFor(c.channel)}>{c.pct}%</Tag>
            </div>
            <p className="mt-2 text-[20px] font-semibold tabular-nums">{baht(c.margin)}</p>
            <p className="mt-1 text-[11.5px] opacity-75">
              จาก {c.orders} ใบ · รายได้ {baht(c.revenue)} ต้นทุน {baht(c.cost)}
            </p>
          </TintCard>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------- profit centres */

function ProfitCenters({ profits, onAct }: { profits: ReturnType<typeof profitCenterRows>; onAct: (a: Act) => void }) {
  useData();
  const r = reconcile();
  const total = r.centres;
  const company = r.company;

  const exportRows = () => {
    downloadCsv(
      "ศูนย์กำไร-" + PERIOD.to.slice(0, 7),
      ["รหัส", "ศูนย์กำไร", "รายได้", "ต้นทุนสินค้า", "กำไรขั้นต้น", "ทางอ้อมของศูนย์ต้นทุน", "ดูดเข้าต้นทุนแล้ว", "ผลสุทธิ"],
      profits.map((p) => [p.code, p.name, p.revenue, Math.round(p.productCost), Math.round(p.grossMargin), Math.round(p.overhead), Math.round(p.absorbed), Math.round(p.result)])
    );
    notify(`ส่งออกศูนย์กำไร ${profits.length} ศูนย์แล้ว`);
  };

  const items = [
    { label: "รายได้ที่ไม่ได้มาจากใบกำกับของฝ่ายขาย", value: r.otherRevenue },
    { label: "ต้นทุนขายที่ไม่ได้มาจากใบกำกับ", value: -r.otherCogs },
    { label: "ค่าใช้จ่ายที่ยังไม่กำหนดศูนย์ต้นทุน", value: -r.undistributed },
    { label: "ต้นทุนคำสั่งงานที่ชำระเข้าศูนย์ต้นทุน (บันทึกเฉพาะบัญชีบริหาร)", value: r.coOnly },
  ].filter((x) => Math.abs(x.value) > 0.5);

  return (
    <div className="space-y-3">
      <StatStrip
        title="ผลของศูนย์กำไร"
        icon={<PieChart size={15} />}
        cells={[
          { icon: <Building size={13} />, label: "ศูนย์กำไร", value: PROFIT_CENTERS.length + " ศูนย์", sub: "แต่ละศูนย์รับช่องทางขายของตัวเอง" },
          { icon: <TrendingUp size={13} />, label: "รวมผลทุกศูนย์", value: baht(total), sub: "กำไรขั้นต้นหักค่าใช้จ่ายทางอ้อมที่เหลือ", tone: total >= 0 ? "ok" : "bad" },
          { icon: <Receipt size={13} />, label: "ผลประกอบการในงบการเงิน", value: baht(company), sub: "คำนวณจากสมุดรายวันทั้งหมด", tone: "info" },
          { icon: r.tiesOut ? <CircleCheck size={13} /> : <CircleX size={13} />, label: "ผลการกระทบยอด", value: r.tiesOut ? "ตรงกัน" : "ต่างกัน", sub: r.tiesOut ? "ปันส่วนครบถ้วน" : `ต่างกัน ${baht(Math.abs(total - company))}`, tone: r.tiesOut ? "ok" : "bad" },
        ]}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" icon={<Plus size={15} />} onClick={() => onAct({ kind: "pc-new" })}>
          เพิ่มศูนย์กำไร
        </Button>
        <Button variant="secondary" icon={<Link2 size={14} />} onClick={() => onAct({ kind: "assign" })}>
          กำหนดสังกัด
        </Button>
        <span className="ml-auto" />
        <Button variant="ghost" icon={exportIcon} onClick={exportRows}>
          ส่งออก Excel
        </Button>
        <Button variant="ghost" icon={<Printer size={14} />} onClick={() => onAct({ kind: "print", d: { doc: "profit-centres" }, title: "งบกำไรขาดทุนตามศูนย์กำไร" })}>
          พิมพ์งบศูนย์กำไร
        </Button>
      </div>

      <Card
        title={<span className="flex items-center gap-2"><PieChart size={15} className="text-slate-400" />ศูนย์กำไร</span>}
        subtitle="กำไรขั้นต้นที่แต่ละช่องทางทำได้ หักด้วยค่าใช้จ่ายทางอ้อมส่วนที่ยังไม่ถูกดูดเข้าต้นทุนสินค้า"
      >
        <table className="w-full text-[13px]">
          <thead className="bg-slate-50/80 text-left text-[11px] uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">ศูนย์กำไร</th>
              <th className="px-4 py-3 text-right font-medium">รายได้</th>
              <th className="px-4 py-3 text-right font-medium">ต้นทุนสินค้า</th>
              <th className="px-4 py-3 text-right font-medium">กำไรขั้นต้น</th>
              <th className="px-4 py-3 text-right font-medium">ทางอ้อมของศูนย์ต้นทุน</th>
              <th className="px-4 py-3 text-right font-medium">ดูดเข้าต้นทุนแล้ว</th>
              <th className="px-4 py-3 text-right font-medium">ผลสุทธิ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {profits.map((p) => (
              <tr key={p.code} className="transition hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <td className="px-4 py-2.5">
                  <span className="flex items-center gap-2">
                    <Dot className={pcSwatch(p.code).dot} />
                    <span>
                      <span className="block font-medium text-slate-900 dark:text-slate-50">{p.name}</span>
                      <span className="block font-mono text-[11px] text-slate-400">
                        {p.code} · {COST_CENTERS.filter((c) => c.profitCenter === p.code).map((c) => c.name).join(", ") || "ไม่มีศูนย์ต้นทุน"}
                      </span>
                    </span>
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-slate-700 dark:text-slate-200">{p.revenue ? baht(p.revenue) : "—"}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-300">{p.productCost ? baht(p.productCost) : "—"}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-slate-900 dark:text-slate-50">{p.grossMargin ? baht(p.grossMargin) : "—"}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-300">{p.overhead ? baht(Math.round(p.overhead)) : "—"}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-slate-500 dark:text-slate-400">{p.absorbed ? baht(p.absorbed) : "—"}</td>
                <td className={"px-4 py-2.5 text-right font-semibold tabular-nums " + (p.result >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                  {baht(p.result)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-50/80 dark:bg-slate-800/60">
            <tr>
              <td colSpan={6} className="px-4 py-3 text-right font-medium text-slate-600 dark:text-slate-300">
                รวมทุกศูนย์กำไร
              </td>
              <td className={"px-4 py-3 text-right font-semibold tabular-nums " + (total >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                {baht(total)}
              </td>
            </tr>
          </tfoot>
        </table>
      </Card>

      {r.tiesOut ? (
        <Note tone="ok">
          ผลรวมของทุกศูนย์กำไร {baht(total)} ตรงกับ{company >= 0 ? "กำไร" : "ขาดทุน"}สุทธิในงบการเงิน ปันส่วนครบถ้วน ไม่มีค่าใช้จ่ายตกหล่นหรือนับซ้ำ
        </Note>
      ) : (
        <Card
          title={<span className="flex items-center gap-2"><Scale size={15} className="text-slate-400" />กระทบยอดกับงบการเงิน</span>}
          subtitle={`ผลรวมทุกศูนย์กำไร ${baht(total)} ต่างจากงบการเงิน ${baht(company)} อยู่ ${baht(company - total)} ด้วยรายการเหล่านี้`}
        >
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {items.map((x) => (
              <li key={x.label} className="flex items-center justify-between gap-3 px-4 py-2.5 text-[13px]">
                <span className="text-slate-700 dark:text-slate-200">{x.label}</span>
                <span className="tabular-nums text-slate-900 dark:text-slate-50">{baht(x.value)}</span>
              </li>
            ))}
          </ul>
          {r.undistributed > 0.5 && (
            <div className="border-t border-slate-100 px-4 py-3 dark:border-slate-800">
              <Button variant="secondary" icon={<Split size={14} />} onClick={() => onAct({ kind: "distribution" })}>
                กำหนดสัดส่วนให้บัญชีที่ยังไม่กระจาย
              </Button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- records */

function CenterRecord({ c, onAct }: { c: CostCenterRow; onAct: (a: Act) => void }) {
  useData();
  const sources = expenseAccounts()
    .map((a) => ({ code: a.code, share: ALLOCATION[a.code]?.[c.code] ?? 0 }))
    .filter((x) => x.share > 0);
  const moves = ALLOCATIONS.flatMap((a) => [
    ...(a.sender === c.code ? [{ no: a.no, text: `ปันส่วนออก (${a.cycle})`, amount: -a.amount }] : []),
    ...a.lines.filter((l) => l.costCenter === c.code).map((l) => ({ no: a.no, text: `รับปันส่วนจาก${costCenter(a.sender).name}`, amount: l.amount })),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        <Button variant="primary" icon={<Target size={14} />} onClick={() => onAct({ kind: "budget", code: c.code })}>
          ตั้งงบ
        </Button>
        <Button variant="secondary" icon={<Printer size={14} />} onClick={() => onAct({ kind: "print", d: { doc: "cost-centre", code: c.code }, title: "รายงานศูนย์ต้นทุน" })}>
          พิมพ์รายงานศูนย์
        </Button>
      </div>

      <div className="space-y-1">
        <IconRow icon={<FileText size={14} />} label="รหัสศูนย์ต้นทุน">{c.code}</IconRow>
        <IconRow icon={<Avatar name={c.owner} size="sm" />} label="ผู้รับผิดชอบ">{c.owner}</IconRow>
        <IconRow icon={<Building size={14} />} label="ศูนย์กำไรที่สังกัด">{pcName(c.profitCenter)}</IconRow>
        <IconRow icon={<Wallet size={14} />} label="งบทั้งงวด">{baht(c.budget)}</IconRow>
        <IconRow icon={<Coins size={14} />} label="ใช้จริง">{baht(c.actual)}</IconRow>
      </div>

      <Progress done={Math.min(c.actual, c.budget)} total={c.budget || 1} label={`ใช้ไป ${c.pct}% ของงบ`} />

      <div>
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-400">รับส่วนแบ่งมาจากบัญชีไหนบ้าง</p>
        {sources.length === 0 ? (
          <p className="text-[12.5px] text-slate-400">ยังไม่รับค่าใช้จ่ายจากบัญชีใดโดยตรง กำหนดได้ที่สัดส่วนกระจายค่าใช้จ่าย</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {sources.map((s) => (
              <li key={s.code} className="flex flex-wrap items-center gap-3 py-2.5 text-[13px]">
                <span className="font-mono text-[11.5px] text-slate-400">{s.code}</span>
                <span className="min-w-0 flex-1 truncate text-slate-800 dark:text-slate-100">{account(s.code).name}</span>
                <Badge tone="accent">{Math.round(s.share * 100)}%</Badge>
              </li>
            ))}
            <li className="flex items-center justify-between py-2.5 text-[13px]">
              <span className="text-slate-600 dark:text-slate-300">รับตรงจากสมุดรายวัน</span>
              <span className="font-medium tabular-nums text-slate-900 dark:text-slate-50">{baht(c.primary)}</span>
            </li>
          </ul>
        )}
      </div>

      {(moves.length > 0 || c.settled > 0) && (
        <div>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-400">ปันส่วนและชำระในงวด</p>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {moves.map((m, i) => (
              <li key={m.no + i} className="flex items-center gap-3 py-2 text-[13px]">
                <span className="w-24 shrink-0 font-mono text-[11.5px] text-slate-400">{m.no}</span>
                <span className="min-w-0 flex-1 truncate text-slate-800 dark:text-slate-100">{m.text}</span>
                <span className="shrink-0 tabular-nums text-slate-900 dark:text-slate-50">{baht(m.amount)}</span>
              </li>
            ))}
            {c.settled > 0 && (
              <li className="flex items-center gap-3 py-2 text-[13px]">
                <span className="w-24 shrink-0 font-mono text-[11.5px] text-slate-400">IO</span>
                <span className="min-w-0 flex-1 truncate text-slate-800 dark:text-slate-100">ชำระจากคำสั่งงานภายใน</span>
                <span className="shrink-0 tabular-nums text-slate-900 dark:text-slate-50">{baht(c.settled)}</span>
              </li>
            )}
          </ul>
        </div>
      )}

      <Note tone={c.over ? "bad" : "ok"}>
        {c.over
          ? `ใช้เกินงบอยู่ ${baht(Math.abs(c.variance))} หัวหน้าศูนย์ต้องอธิบายส่วนที่เกินในรอบทบทวนงบ`
          : `ยังเหลืองบอีก ${baht(c.variance)} จากงบทั้งงวด ${baht(c.budget)}`}
      </Note>
    </div>
  );
}

function CostSheet({ code, onAct }: { code: string; onAct: (a: Act) => void }) {
  useData();
  const c = productCost(code);
  const current = currentEstimate(code);
  const next = nextEstimate(code);
  return (
    <div className="space-y-3">
      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
        <li className="flex items-center justify-between py-2.5">
          <span className="text-[13px] text-slate-800 dark:text-slate-100">ต้นทุนทางตรง</span>
          <span className="text-[13px] tabular-nums text-slate-900 dark:text-slate-50">{baht(c.direct)}</span>
        </li>
        {c.lines.map((l) => (
          <li key={l.code} className="flex items-start justify-between gap-3 py-2.5">
            <span className="min-w-0">
              <span className="block text-[13px] text-slate-800 dark:text-slate-100">{l.name}</span>
              <span className="block text-[11.5px] text-slate-400">
                {Math.round(l.rate * 100)}% ของ{l.base}
              </span>
            </span>
            <span className="shrink-0 text-[13px] tabular-nums text-slate-900 dark:text-slate-50">{baht(l.amount)}</span>
          </li>
        ))}
        <li className="flex items-center justify-between border-t border-slate-100 py-2.5 dark:border-slate-800">
          <span className="text-[13px] font-semibold text-slate-900 dark:text-slate-50">ต้นทุนรวมต่อ{c.unit}</span>
          <span className="text-[16px] font-semibold tabular-nums text-slate-900 dark:text-slate-50">{baht(c.total)}</span>
        </li>
      </ul>

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-[12.5px]">
          <span className="w-20 shrink-0 text-slate-600 dark:text-slate-300">ทางตรง</span>
          <span className="min-w-0 flex-1">
            <Bar pct={(c.direct / c.total) * 100} tone="accent" width="w-full" />
          </span>
        </div>
        <div className="flex items-center gap-2 text-[12.5px]">
          <span className="w-20 shrink-0 text-slate-600 dark:text-slate-300">ทางอ้อม</span>
          <span className="min-w-0 flex-1">
            <Bar pct={(c.overhead / c.total) * 100} tone="warn" width="w-full" />
          </span>
        </div>
      </div>

      {current && (
        <p className="text-[11.5px] text-slate-500 dark:text-slate-400">
          แผ่นที่ใช้อยู่ {current.no} · วัตถุดิบ {baht(current.materialCost)} ค่าแรง {baht(current.labourCost)}
          {next ? ` · งวดถัดไปใช้ ${next.no} ทางตรง ${baht(estimateTotals(next).direct)}` : ""}
        </p>
      )}

      <div className="flex flex-wrap gap-1.5">
        <Button variant="primary" icon={<Calculator size={14} />} onClick={() => onAct({ kind: "estimate-new", material: code })}>
          คำนวณต้นทุนใหม่
        </Button>
        {current && (
          <Button variant="secondary" icon={<Printer size={14} />} onClick={() => onAct({ kind: "print", d: { doc: "estimate", no: (next ?? current).no }, title: "แผ่นคำนวณต้นทุนผลิตภัณฑ์" })}>
            พิมพ์แผ่นคำนวณ
          </Button>
        )}
      </div>

      <Note tone="idle">
        ค่าใช้จ่ายทางอ้อมที่บวกเข้าต้นทุนตรงนี้คือส่วนที่ถูกดูดเข้าต้นทุนสินค้าแล้ว
        จึงไม่ถูกนำไปหักซ้ำอีกครั้งในหน้าศูนย์กำไร
      </Note>
    </div>
  );
}
