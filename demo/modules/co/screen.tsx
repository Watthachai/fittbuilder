import { useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowRight, Boxes, Building, Calculator, CalendarClock, CircleCheck, CircleX, ClipboardList,
  Coins, Factory, FileText, Layers, Percent, PieChart, Receipt, Scale, Search as SearchIcon,
  Target, TrendingDown, TrendingUp, TriangleAlert, Wallet,
} from "lucide-react";
import { account, balanceOf, PERIOD } from "../fi/data";
import {
  ALLOCATION, COST_CENTERS, FINISHED_GOODS, INTERNAL_ORDERS, OVERHEAD, PROFIT_CENTERS, baht,
  byChannel, companyResult, costCenterRows, marginRows, productCost, profitCenterRows,
} from "./data";
import {
  Avatar, Badge, Bar, Button, Card, Chip, ColumnChart, Donut, Dot, IconRow, Note, PageHead,
  Progress, Reveal, Search, Segmented, StatStrip, Tabs, Tag, TintCard, swatchFor,
} from "../ui";
import { DataTable, FormModal } from "../kit";
import type { Column } from "../kit";

const TABS = ["ศูนย์ต้นทุน", "คำสั่งงานภายใน", "ต้นทุนผลิตภัณฑ์", "วิเคราะห์กำไรขั้นต้น", "ศูนย์กำไร"];

const CC_CODES = COST_CENTERS.map((c) => c.code);
const ccSwatch = (code: string) => swatchFor(code, CC_CODES);

const PC_CODES = PROFIT_CENTERS.map((p) => p.code);
const pcSwatch = (code: string) => swatchFor(code, PC_CODES);

type CostCenterRow = ReturnType<typeof costCenterRows>[number];
type MarginRow = ReturnType<typeof marginRows>[number];

/* ----------------------------------------------------------------- screen */

export default function CoScreen({
  section,
  onOpenSection,
}: {
  section?: string;
  onOpenSection?: (index: number) => void;
}) {
  const tab = section && TABS.includes(section) ? section : undefined;

  const [q, setQ] = useState("");
  const [openCenter, setOpenCenter] = useState<CostCenterRow | null>(null);
  const [openProduct, setOpenProduct] = useState<string | null>(null);

  const centers = costCenterRows();
  const margins = marginRows();
  const profits = profitCenterRows();
  const overBudget = centers.filter((c) => c.over);
  const overOrders = INTERNAL_ORDERS.filter((o) => o.spent > o.budget);

  const panels = (
    <>
      <FormModal
        open={openCenter !== null}
        title="ศูนย์ต้นทุน"
        subtitle={openCenter ? `${openCenter.code} · ${openCenter.name}` : undefined}
        onClose={() => setOpenCenter(null)}
      >
        {openCenter && <CenterRecord c={openCenter} />}
      </FormModal>

      <FormModal
        open={openProduct !== null}
        title="แผ่นคำนวณต้นทุน"
        subtitle={openProduct ? productCost(openProduct).name : undefined}
        onClose={() => setOpenProduct(null)}
        size="sm"
      >
        {openProduct && <CostSheet code={openProduct} />}
      </FormModal>
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
          onOpenCenter={setOpenCenter}
          onOpenProduct={setOpenProduct}
        />
        {panels}
      </>
    );
  }

  return (
    <div>
      <PageHead
        title="บัญชีบริหารและต้นทุน"
        meta={`${tab} · ${PERIOD.label} · ${COST_CENTERS.length} ศูนย์ต้นทุน · ${PROFIT_CENTERS.length} ศูนย์กำไร`}
      />

      {tab === "ศูนย์ต้นทุน" && <CostCenters centers={centers} onOpen={setOpenCenter} />}
      {tab === "คำสั่งงานภายใน" && <InternalOrders />}
      {tab === "ต้นทุนผลิตภัณฑ์" && <ProductCosts q={q} setQ={setQ} onOpen={setOpenProduct} />}
      {tab === "วิเคราะห์กำไรขั้นต้น" && <Margins margins={margins} />}
      {tab === "ศูนย์กำไร" && <ProfitCenters profits={profits} />}

      {panels}

      <div hidden data-fitt-index>
        <button data-fitt-screen="บัญชีบริหารและต้นทุน" />
        <button data-fitt-screen="ศูนย์ต้นทุน" data-fitt-modal onClick={() => setOpenCenter(centers[0])} />
        <button data-fitt-screen="แผ่นคำนวณต้นทุน" data-fitt-modal onClick={() => setOpenProduct(FINISHED_GOODS[0].code)} />
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
  const budget = centers.reduce((n, c) => n + c.budget, 0);
  const actual = centers.reduce((n, c) => n + c.actual, 0);
  const revenue = margins.reduce((n, m) => n + m.revenue, 0);
  const margin = margins.reduce((n, m) => n + m.margin, 0);
  const worst = [...margins].sort((a, b) => a.pct - b.pct)[0];
  const company = companyResult();
  const total = profits.reduce((n, p) => n + p.result, 0);

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
              <p className="text-[32px] font-semibold leading-none tabular-nums text-slate-900 dark:text-slate-50">
                {baht(actual)}
              </p>
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
              ].map((r) => (
                <button
                  key={r.label}
                  onClick={() => onOpenSection?.(r.to)}
                  className="flex w-full items-center gap-3 rounded-xl bg-slate-50 px-3.5 py-3 text-left transition hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-800"
                >
                  <span className="text-slate-400">{r.icon}</span>
                  <span className="min-w-0 flex-1 text-[12.5px] text-slate-700 dark:text-slate-200">{r.label}</span>
                  <Badge tone={r.value > 0 ? r.tone : "ok"}>
                    {r.value} {r.unit}
                  </Badge>
                </button>
              ))}
              <Note tone={Math.abs(total - company) <= 1 ? "ok" : "warn"}>
                {Math.abs(total - company) <= 1
                  ? "ผลรวมของทุกศูนย์กำไรตรงกับผลประกอบการในงบการเงิน ปันส่วนครบถ้วน"
                  : `ผลรวมของทุกศูนย์กำไรต่างจากงบการเงิน ${baht(Math.abs(total - company))} ควรตรวจสัดส่วนการปันส่วน`}
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
                segments={centers.map((c) => ({ label: c.name, value: c.actual, swatch: ccSwatch(c.code) }))}
                size={128}
                format={(n) => baht(n)}
                center={
                  <span>
                    <span className="block text-[18px] font-semibold leading-none tabular-nums text-slate-900 dark:text-slate-50">
                      {Math.round((actual / budget) * 100)}%
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
            subtitle="รายได้จริงจากใบสั่งขาย ลบต้นทุนผลิตภัณฑ์ที่รวมค่าใช้จ่ายทางอ้อมแล้ว"
            action={seeAll(3)}
          >
            <ColumnChart
              data={byChannel().map((c) => ({ label: c.channel, value: c.margin, tone: c.margin < 0 ? ("warn" as const) : undefined }))}
              format={(n) => baht(n)}
              height={160}
            />
            <ul className="divide-y divide-slate-100 border-t border-slate-100 dark:divide-slate-800 dark:border-slate-800">
              {byChannel().map((c) => (
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
            subtitle={`รวมทุกศูนย์ ${baht(total)} เทียบกับผลประกอบการในงบการเงิน ${baht(company)}`}
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
                    {p.unabsorbed !== 0 && <Chip>ทางอ้อมที่เหลือ {baht(p.unabsorbed)}</Chip>}
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

function CostCenters({ centers, onOpen }: { centers: CostCenterRow[]; onOpen: (c: CostCenterRow) => void }) {
  const budget = centers.reduce((n, c) => n + c.budget, 0);
  const actual = centers.reduce((n, c) => n + c.actual, 0);

  return (
    <div className="space-y-3">
      <StatStrip
        title="งบและยอดใช้จริง"
        icon={<Target size={15} />}
        cells={[
          { icon: <Wallet size={13} />, label: "งบรวมทั้งงวด", value: baht(budget), sub: `${COST_CENTERS.length} ศูนย์ต้นทุน` },
          { icon: <Coins size={13} />, label: "ใช้จริง", value: baht(actual), sub: "กระจายมาจากบัญชีค่าใช้จ่าย", tone: "info" },
          { icon: <Scale size={13} />, label: actual > budget ? "เกินงบ" : "เหลืองบ", value: baht(Math.abs(budget - actual)), sub: `คิดเป็น ${Math.round((actual / budget) * 100)}% ของงบ`, tone: actual > budget ? "bad" : "ok" },
          { icon: <TriangleAlert size={13} />, label: "ศูนย์ที่ใช้เกินงบ", value: centers.filter((c) => c.over).length + " ศูนย์", sub: "ต้องอธิบายส่วนที่เกิน", tone: centers.some((c) => c.over) ? "bad" : "ok" },
        ]}
      />

      <Card
        title={<span className="flex items-center gap-2"><Target size={15} className="text-slate-400" />ศูนย์ต้นทุน</span>}
        subtitle="ยอดใช้จริงกระจายมาจากบัญชีค่าใช้จ่ายตามสัดส่วนที่ประกาศไว้ กดที่แถวเพื่อดูว่ารับมาจากบัญชีไหนบ้าง"
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
              <tr
                key={c.code}
                onClick={() => onOpen(c)}
                className="cursor-pointer transition hover:bg-slate-50 dark:hover:bg-slate-800/40"
              >
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
                  <Tag swatch={pcSwatch(c.profitCenter)}>{PROFIT_CENTERS.find((p) => p.code === c.profitCenter)!.name}</Tag>
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

      <Note tone="idle">
        ต้นทุนขายไม่ถูกปันส่วนเข้าศูนย์ต้นทุน เพราะเป็นต้นทุนของผลิตภัณฑ์ที่ไปปรากฏในกำไรขั้นต้น
        ไม่ใช่ค่าใช้จ่ายที่หัวหน้าหน่วยงานควบคุมได้
      </Note>
    </div>
  );
}

/* ------------------------------------------------------- internal orders */

function InternalOrders() {
  const budget = INTERNAL_ORDERS.reduce((n, o) => n + o.budget, 0);
  const spent = INTERNAL_ORDERS.reduce((n, o) => n + o.spent, 0);

  return (
    <div className="space-y-3">
      <StatStrip
        title="คำสั่งงานภายใน"
        icon={<ClipboardList size={15} />}
        cells={[
          { icon: <ClipboardList size={13} />, label: "งานที่เปิดไว้", value: INTERNAL_ORDERS.length + " งาน", sub: `${INTERNAL_ORDERS.filter((o) => o.status === "กำลังดำเนินการ").length} งานยังไม่ปิด` },
          { icon: <Wallet size={13} />, label: "งบรวม", value: baht(budget), sub: "แยกจากงบประจำของศูนย์ต้นทุน", tone: "info" },
          { icon: <Coins size={13} />, label: "ใช้ไปแล้ว", value: baht(spent), sub: `คิดเป็น ${Math.round((spent / budget) * 100)}% ของงบ`, tone: "accent" },
          { icon: <TriangleAlert size={13} />, label: "งานที่ใช้เกินงบ", value: INTERNAL_ORDERS.filter((o) => o.spent > o.budget).length + " งาน", sub: "ต้องขออนุมัติงบเพิ่ม", tone: INTERNAL_ORDERS.some((o) => o.spent > o.budget) ? "bad" : "ok" },
        ]}
      />

      <div className="grid gap-3 lg:grid-cols-2">
        {INTERNAL_ORDERS.map((o) => {
          const cc = COST_CENTERS.find((c) => c.code === o.costCenter)!;
          const over = o.spent > o.budget;
          const sw = ccSwatch(o.costCenter);
          return (
            <Card
              key={o.no}
              title={
                <span className="flex items-center gap-2.5">
                  <span className={"grid size-8 place-items-center rounded-lg " + sw.tint}>
                    <ClipboardList size={15} />
                  </span>
                  {o.name}
                </span>
              }
              subtitle={`${o.no} · ${cc.name} · เปิดงานเมื่อ ${o.opened}`}
              action={<Badge tone={o.status === "ปิดงานแล้ว" ? "ok" : over ? "bad" : "warn"} dot>{o.status}</Badge>}
            >
              <div className="space-y-3 p-4">
                <Progress done={Math.min(o.spent, o.budget)} total={o.budget} label={`ใช้ไป ${baht(o.spent)} จากงบ ${baht(o.budget)}`} />
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "งบที่อนุมัติ", value: baht(o.budget) },
                    { label: "ใช้ไปแล้ว", value: baht(o.spent) },
                    { label: over ? "เกินงบ" : "เหลืองบ", value: baht(Math.abs(o.budget - o.spent)) },
                  ].map((c) => (
                    <div key={c.label} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
                      <div className="text-[11.5px] text-slate-500 dark:text-slate-400">{c.label}</div>
                      <div className={"mt-1 text-[14px] font-semibold tabular-nums " + (c.label === "เกินงบ" ? "text-rose-600 dark:text-rose-400" : "text-slate-900 dark:text-slate-50")}>
                        {c.value}
                      </div>
                    </div>
                  ))}
                </div>
                {over && (
                  <Note tone="bad">
                    ใช้เกินงบที่อนุมัติไว้ {baht(o.spent - o.budget)} ต้องขออนุมัติงบเพิ่มก่อนเบิกจ่ายรอบถัดไป
                  </Note>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/* --------------------------------------------------------- product costs */

function ProductCosts({ q, setQ, onOpen }: { q: string; setQ: (v: string) => void; onOpen: (code: string) => void }) {
  const needle = q.trim().toLowerCase();
  const rows = FINISHED_GOODS.filter(
    (p) => needle === "" || [p.code, p.name].some((t) => t.toLowerCase().includes(needle))
  ).map((p) => ({ p, c: productCost(p.code) }));

  const columns: Column<(typeof rows)[number]>[] = [
    {
      key: "name",
      header: "สินค้า",
      width: "32%",
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
      width: "17%",
      sort: (a, b) => a.c.direct - b.c.direct,
      cell: (r) => <span className="tabular-nums text-slate-700 dark:text-slate-200">{baht(r.c.direct)}</span>,
    },
    ...OVERHEAD.map((o) => ({
      key: o.code,
      header: `${o.name} ${Math.round(o.rate * 100)}%`,
      align: "right" as const,
      width: "17%",
      cell: (r: (typeof rows)[number]) => (
        <span className="tabular-nums text-slate-600 dark:text-slate-300">
          {baht(r.c.lines.find((l) => l.code === o.code)!.amount)}
        </span>
      ),
    })),
    {
      key: "total",
      header: "ต้นทุนรวม",
      align: "right",
      width: "17%",
      sort: (a, b) => a.c.total - b.c.total,
      cell: (r) => <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-50">{baht(r.c.total)}</span>,
    },
  ];

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
              <Badge tone="accent">{Math.round(o.rate * 100)}%</Badge>
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
          </div>
        }
      />
    </div>
  );
}

/* -------------------------------------------------------------- margins */

function Margins({ margins }: { margins: MarginRow[] }) {
  const [sortBy, setSortBy] = useState("อัตรากำไรต่ำสุดก่อน");
  const rows =
    sortBy === "อัตรากำไรต่ำสุดก่อน"
      ? [...margins].sort((a, b) => a.pct - b.pct)
      : sortBy === "รายได้สูงสุดก่อน"
        ? [...margins].sort((a, b) => b.revenue - a.revenue)
        : [...margins].sort((a, b) => b.margin - a.margin);

  const revenue = margins.reduce((n, m) => n + m.revenue, 0);
  const cost = margins.reduce((n, m) => n + m.cost, 0);

  return (
    <div className="space-y-3">
      <StatStrip
        title="กำไรขั้นต้น"
        icon={<Percent size={15} />}
        cells={[
          { icon: <Receipt size={13} />, label: "รายได้จากใบสั่งขาย", value: baht(revenue), sub: `${margins.length} ใบในงวดนี้` },
          { icon: <Boxes size={13} />, label: "ต้นทุนผลิตภัณฑ์", value: baht(cost), sub: "รวมค่าใช้จ่ายทางอ้อมตามอัตราแล้ว", tone: "warn" },
          { icon: <TrendingUp size={13} />, label: "กำไรขั้นต้น", value: baht(revenue - cost), sub: `คิดเป็น ${Math.round(((revenue - cost) / revenue) * 100)}% ของรายได้`, tone: "ok" },
          { icon: <TrendingDown size={13} />, label: "อัตรากำไรต่ำสุด", value: Math.min(...margins.map((m) => m.pct)) + "%", sub: [...margins].sort((a, b) => a.pct - b.pct)[0].so, tone: "bad" },
        ]}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Segmented options={["อัตรากำไรต่ำสุดก่อน", "รายได้สูงสุดก่อน", "กำไรสูงสุดก่อน"]} value={sortBy} onChange={setSortBy} />
        <span className="ml-auto text-[12px] text-slate-400">ต้นทุนคิดจากต้นทุนมาตรฐานบวกค่าใช้จ่ายทางอ้อม</span>
      </div>

      <Card
        title={<span className="flex items-center gap-2"><Percent size={15} className="text-slate-400" />กำไรขั้นต้นรายใบสั่งขาย</span>}
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
            {rows.map((m) => (
              <tr key={m.so} className="transition hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <td className="px-4 py-2.5 font-mono text-[12px] text-slate-500 dark:text-slate-400">{m.so}</td>
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
                  <span className="flex items-center gap-2">
                    <Bar pct={Math.max(0, m.pct)} tone={m.pct < 20 ? "bad" : m.pct < 35 ? "warn" : "ok"} width="w-20" />
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="grid gap-3 lg:grid-cols-3">
        {byChannel().map((c) => (
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

function ProfitCenters({ profits }: { profits: ReturnType<typeof profitCenterRows> }) {
  const total = profits.reduce((n, p) => n + p.result, 0);
  const company = companyResult();
  const tiesOut = Math.abs(total - company) <= 1;

  return (
    <div className="space-y-3">
      <StatStrip
        title="ผลของศูนย์กำไร"
        icon={<PieChart size={15} />}
        cells={[
          { icon: <Building size={13} />, label: "ศูนย์กำไร", value: PROFIT_CENTERS.length + " ศูนย์", sub: "แต่ละศูนย์รับช่องทางขายของตัวเอง" },
          { icon: <TrendingUp size={13} />, label: "รวมผลทุกศูนย์", value: baht(total), sub: "กำไรขั้นต้นหักค่าใช้จ่ายทางอ้อมที่เหลือ", tone: total >= 0 ? "ok" : "bad" },
          { icon: <Receipt size={13} />, label: "ผลประกอบการในงบการเงิน", value: baht(company), sub: "คำนวณจากสมุดรายวันทั้งหมด", tone: "info" },
          { icon: tiesOut ? <CircleCheck size={13} /> : <CircleX size={13} />, label: "ผลการกระทบยอด", value: tiesOut ? "ตรงกัน" : "ต่างกัน", sub: tiesOut ? "ปันส่วนครบถ้วน" : `ต่างกัน ${baht(Math.abs(total - company))}`, tone: tiesOut ? "ok" : "bad" },
        ]}
      />

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
                      <span className="block font-mono text-[11px] text-slate-400">{p.code}</span>
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

      <Note tone={tiesOut ? "ok" : "warn"}>
        {tiesOut
          ? `ผลรวมของทุกศูนย์กำไร ${baht(total)} ตรงกับ${company >= 0 ? "กำไร" : "ขาดทุน"}สุทธิในงบการเงิน ปันส่วนครบถ้วน ไม่มีค่าใช้จ่ายตกหล่นหรือนับซ้ำ`
          : `ผลรวมของทุกศูนย์กำไร ${baht(total)} ต่างจากงบการเงิน ${baht(Math.abs(total - company))} ควรตรวจสัดส่วนการปันส่วนอีกครั้ง`}
      </Note>
    </div>
  );
}

/* --------------------------------------------------------------- records */

function CenterRecord({ c }: { c: CostCenterRow }) {
  const sources = Object.entries(ALLOCATION)
    .map(([code, shares]) => ({ code, share: shares[c.code] ?? 0, total: balanceOf(code) }))
    .filter((x) => x.share > 0);

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <IconRow icon={<FileText size={14} />} label="รหัสศูนย์ต้นทุน">{c.code}</IconRow>
        <IconRow icon={<Avatar name={c.owner} size="sm" />} label="ผู้รับผิดชอบ">{c.owner}</IconRow>
        <IconRow icon={<Building size={14} />} label="ศูนย์กำไรที่สังกัด">
          {PROFIT_CENTERS.find((p) => p.code === c.profitCenter)!.name}
        </IconRow>
        <IconRow icon={<Wallet size={14} />} label="งบทั้งงวด">{baht(c.budget)}</IconRow>
        <IconRow icon={<Coins size={14} />} label="ใช้จริง">{baht(c.actual)}</IconRow>
      </div>

      <Progress done={Math.min(c.actual, c.budget)} total={c.budget} label={`ใช้ไป ${c.pct}% ของงบ`} />

      <div>
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-400">รับส่วนแบ่งมาจากบัญชีไหนบ้าง</p>
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {sources.map((s) => (
            <li key={s.code} className="flex flex-wrap items-center gap-3 py-2.5 text-[13px]">
              <span className="font-mono text-[11.5px] text-slate-400">{s.code}</span>
              <span className="min-w-0 flex-1 truncate text-slate-800 dark:text-slate-100">{account(s.code).name}</span>
              <Badge tone="accent">{Math.round(s.share * 100)}%</Badge>
              <span className="w-28 shrink-0 text-right tabular-nums text-slate-500 dark:text-slate-400">
                จาก {baht(s.total)}
              </span>
              <span className="w-28 shrink-0 text-right font-medium tabular-nums text-slate-900 dark:text-slate-50">
                {baht(Math.round(s.total * s.share))}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <Note tone={c.over ? "bad" : "ok"}>
        {c.over
          ? `ใช้เกินงบอยู่ ${baht(Math.abs(c.variance))} หัวหน้าศูนย์ต้องอธิบายส่วนที่เกินในรอบทบทวนงบ`
          : `ยังเหลืองบอีก ${baht(c.variance)} จากงบทั้งงวด ${baht(c.budget)}`}
      </Note>
    </div>
  );
}

function CostSheet({ code }: { code: string }) {
  const c = productCost(code);
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

      <Note tone="idle">
        ค่าใช้จ่ายทางอ้อมที่บวกเข้าต้นทุนตรงนี้คือส่วนที่ถูกดูดเข้าต้นทุนสินค้าแล้ว
        จึงไม่ถูกนำไปหักซ้ำอีกครั้งในหน้าศูนย์กำไร
      </Note>
    </div>
  );
}
