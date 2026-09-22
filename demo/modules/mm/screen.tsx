import { useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowRight, Boxes, Building, CircleCheck, CircleX, ClipboardList, Coins, FileText, Handshake,
  Layers, PackageCheck, PackageSearch, Receipt, Search as SearchIcon, ShoppingCart, Star,
  TrendingDown, TrendingUp, Truck, TriangleAlert, Warehouse,
} from "lucide-react";
import {
  GOODS_RECEIPTS, INFO_RECORDS, INVOICES, MATERIALS, MATERIAL_GROUPS, PURCHASE_ORDERS,
  REQUISITIONS, STOCK_MOVES, TODAY, VENDORS, baht, belowReorder, bestPriceFor, invoicesOf,
  material, movesOf, poTotal, receiptsOf, spendByMonth, stockByGroup, stockValue, threeWayMatch,
  vendor, vendorScore,
} from "./data";
import type { Material, PurchaseOrder, Vendor } from "./data";
import {
  Avatar, Badge, Bar, Button, Card, Chip, ColumnChart, Donut, Dot, FIELD, IconRow, Note, PageHead,
  Progress, Reveal, Search, Segmented, Select, StatStrip, Stepper, Tabs, Tag, TintCard, swatchFor,
} from "../ui";
import type { StepState } from "../ui";
import { ConfirmDialog, DataTable, DetailModal, Field, FormModal } from "../kit";
import type { Column } from "../kit";

const TABS = [
  "ข้อมูลหลักวัสดุและผู้ขาย",
  "ใบขอซื้อและใบสั่งซื้อ",
  "รับของและตรวจสอบใบแจ้งหนี้",
  "บริหารสต็อกวัสดุ",
  "ประเมินผู้ขาย",
];

const MASTER_TABS = ["แฟ้มวัสดุ", "แฟ้มผู้ขาย", "ราคาที่เคยเสนอ"];
const MASTER_ICONS: Record<string, ReactNode> = {
  แฟ้มวัสดุ: <Boxes size={13} />,
  แฟ้มผู้ขาย: <Building size={13} />,
  ราคาที่เคยเสนอ: <Coins size={13} />,
};

const MATERIAL_TABS = ["ข้อมูลวัสดุ", "ระดับสต็อก", "แหล่งซื้อ", "ความเคลื่อนไหว"];
const MATERIAL_ICONS: Record<string, ReactNode> = {
  ข้อมูลวัสดุ: <FileText size={13} />,
  ระดับสต็อก: <Warehouse size={13} />,
  แหล่งซื้อ: <Handshake size={13} />,
  ความเคลื่อนไหว: <TrendingUp size={13} />,
};

const groupSwatch = (g: string) => swatchFor(g, MATERIAL_GROUPS);

const PO_FLOW = ["รอรับของ", "รับของบางส่วน", "รับของครบแล้ว"];
const PO_TONE: Record<string, "idle" | "warn" | "ok"> = {
  รอรับของ: "idle",
  รับของบางส่วน: "warn",
  รับของครบแล้ว: "ok",
};

/* ----------------------------------------------------------------- screen */

export default function MmScreen({
  section,
  onOpenSection,
}: {
  section?: string;
  onOpenSection?: (index: number) => void;
}) {
  const tab = section && TABS.includes(section) ? section : undefined;

  const [approved, setApproved] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [group, setGroup] = useState("ทุกกลุ่ม");
  const [openMaterialAt, setOpenMaterialAt] = useState<number | null>(null);
  const [openPo, setOpenPo] = useState<PurchaseOrder | null>(null);
  const [openVendor, setOpenVendor] = useState<Vendor | null>(null);
  const [ordering, setOrdering] = useState<(typeof REQUISITIONS)[number] | null>(null);

  const statusOf = (no: string, seed: string) => (approved.includes(no) ? "อนุมัติแล้ว" : seed);
  const waiting = REQUISITIONS.filter((r) => statusOf(r.no, r.status) === "รออนุมัติ");

  const needle = q.trim().toLowerCase();
  const materialRows = MATERIALS.filter(
    (m) =>
      (group === "ทุกกลุ่ม" || m.group === group) &&
      (needle === "" || [m.code, m.name, m.bin].some((t) => t.toLowerCase().includes(needle)))
  );
  const pickedMaterial = openMaterialAt === null ? null : (materialRows[openMaterialAt] ?? null);

  const unmatched = PURCHASE_ORDERS.filter((p) => {
    const m = threeWayMatch(p);
    return m.invoice > 0 && !m.matched;
  });

  const panels = (
    <>
      <DetailModal
        open={pickedMaterial !== null}
        title="แฟ้มวัสดุ"
        onClose={() => setOpenMaterialAt(null)}
        index={openMaterialAt ?? 0}
        total={materialRows.length}
        onStep={(d) => setOpenMaterialAt((i) => Math.min(materialRows.length - 1, Math.max(0, (i ?? 0) + d)))}
      >
        {pickedMaterial && <MaterialRecord key={pickedMaterial.code} m={pickedMaterial} />}
      </DetailModal>

      <FormModal
        open={openPo !== null}
        title="ใบสั่งซื้อ"
        subtitle={openPo ? `${openPo.no} · ${vendor(openPo.vendor).name}` : undefined}
        onClose={() => setOpenPo(null)}
        size="lg"
      >
        {openPo && <PoRecord po={openPo} />}
      </FormModal>

      <FormModal
        open={openVendor !== null}
        title="แฟ้มผู้ขาย"
        subtitle={openVendor ? openVendor.name : undefined}
        onClose={() => setOpenVendor(null)}
      >
        {openVendor && <VendorRecord v={openVendor} />}
      </FormModal>

      <ConfirmDialog
        open={ordering !== null}
        title="อนุมัติใบขอซื้อ"
        body="อนุมัติแล้วใบขอซื้อจะพร้อมแปลงเป็นใบสั่งซื้อ ระบบจะเสนอผู้ขายที่เคยให้ราคาดีที่สุดกับวัสดุตัวนี้"
        subject={
          ordering && (
            <span className="block">
              <span className="block text-[13px] font-medium text-slate-900 dark:text-slate-50">
                {ordering.no} · {material(ordering.material).name}
              </span>
              <span className="block text-[11.5px] text-slate-500 dark:text-slate-400">
                {ordering.qty} {material(ordering.material).unit} · ต้องการภายใน {ordering.needBy} · ขอโดย {ordering.requester}
              </span>
            </span>
          )
        }
        confirmLabel="อนุมัติใบขอซื้อ"
        onCancel={() => setOrdering(null)}
        onConfirm={() => {
          if (ordering) setApproved((a) => [...new Set([...a, ordering.no])]);
          setOrdering(null);
        }}
      />
    </>
  );

  if (!tab) {
    return (
      <>
        <Overview
          waiting={waiting.length}
          unmatched={unmatched.length}
          onOpenSection={onOpenSection}
          onOpenMaterial={(m) => {
            setQ("");
            setGroup("ทุกกลุ่ม");
            setOpenMaterialAt(MATERIALS.indexOf(m));
          }}
          onOpenPo={setOpenPo}
        />
        {panels}
      </>
    );
  }

  return (
    <div>
      <PageHead
        title="จัดซื้อและคลังวัสดุ"
        meta={`${tab} · ${MATERIALS.length} รายการวัสดุ · ${VENDORS.length} ผู้ขาย · มูลค่าสต็อก ${baht(stockValue())}`}
      />

      {tab === "ข้อมูลหลักวัสดุและผู้ขาย" && (
        <Master
          rows={materialRows}
          q={q}
          setQ={setQ}
          group={group}
          setGroup={setGroup}
          onOpenMaterial={(m) => setOpenMaterialAt(materialRows.indexOf(m))}
          onOpenVendor={setOpenVendor}
        />
      )}

      {tab === "ใบขอซื้อและใบสั่งซื้อ" && (
        <Ordering statusOf={statusOf} onApprove={setOrdering} onOpenPo={setOpenPo} />
      )}

      {tab === "รับของและตรวจสอบใบแจ้งหนี้" && <Receiving onOpenPo={setOpenPo} />}

      {tab === "บริหารสต็อกวัสดุ" && (
        <Stock onOpenMaterial={(m) => setOpenMaterialAt(MATERIALS.indexOf(m))} />
      )}

      {tab === "ประเมินผู้ขาย" && <VendorReview onOpenVendor={setOpenVendor} />}

      {panels}

      <div hidden data-fitt-index>
        <button data-fitt-screen="จัดซื้อและคลังวัสดุ" />
        <button data-fitt-screen="แฟ้มวัสดุ" data-fitt-modal onClick={() => setOpenMaterialAt(0)} />
        <button data-fitt-screen="ใบสั่งซื้อ" data-fitt-modal onClick={() => setOpenPo(PURCHASE_ORDERS[0])} />
        <button data-fitt-screen="อนุมัติใบขอซื้อ" data-fitt-modal onClick={() => setOrdering(REQUISITIONS[0])} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- overview */

function Overview({
  waiting,
  unmatched,
  onOpenSection,
  onOpenMaterial,
  onOpenPo,
}: {
  waiting: number;
  unmatched: number;
  onOpenSection?: (index: number) => void;
  onOpenMaterial: (m: Material) => void;
  onOpenPo: (p: PurchaseOrder) => void;
}) {
  const groups = stockByGroup();
  const low = belowReorder();
  const spend = spendByMonth();
  const openOrders = PURCHASE_ORDERS.filter((p) => p.status !== "รับของครบแล้ว");

  const byVendor = VENDORS.map((v) => ({ v, ...vendorScore(v.code) }))
    .filter((x) => x.orders > 0)
    .sort((a, b) => b.value - a.value);
  const topValue = Math.max(...byVendor.map((x) => x.value));

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
        title="ภาพรวมจัดซื้อและคลังวัสดุ"
        meta={`${MATERIALS.length} รายการวัสดุ · ${VENDORS.length} ผู้ขาย · ข้อมูล ณ ${TODAY}`}
        right={
          onOpenSection ? (
            <Button variant="primary" icon={<ShoppingCart size={15} />} onClick={() => onOpenSection(1)}>
              เปิดใบขอซื้อและใบสั่งซื้อ
            </Button>
          ) : undefined
        }
      />

      <Reveal>
        <div className="grid gap-3 xl:grid-cols-3">
          <Card
            className="xl:col-span-2"
            title={<span className="flex items-center gap-2"><Warehouse size={15} className="text-slate-400" />มูลค่าสต็อกคงเหลือ</span>}
            action={seeAll(3)}
          >
            <div className="p-4">
              <p className="text-[32px] font-semibold leading-none tabular-nums text-slate-900 dark:text-slate-50">
                {baht(stockValue())}
              </p>
              <p className="mt-1.5 text-[12.5px] text-slate-500 dark:text-slate-400">
                กระจายใน {groups.length} กลุ่มวัสดุ · ต่ำกว่าจุดสั่งซื้อ {low.length} รายการ
              </p>
              <div className="mt-4 space-y-2.5">
                {groups.map((g) => (
                  <div key={g.group} className="flex items-center gap-3">
                    <span className="flex w-32 shrink-0 items-center gap-1.5 text-[12.5px] text-slate-600 dark:text-slate-300">
                      <Dot className={groupSwatch(g.group).dot} />
                      {g.group}
                    </span>
                    <span className="min-w-0 flex-1">
                      <Bar pct={(g.value / stockValue()) * 100} tone="accent" width="w-full" />
                    </span>
                    <span className="w-32 shrink-0 text-right text-[12.5px] tabular-nums text-slate-700 dark:text-slate-200">
                      {baht(g.value)}
                    </span>
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
                { icon: <ClipboardList size={15} />, label: "ใบขอซื้อรออนุมัติ", value: waiting, unit: "ใบ", tone: "warn" as const, to: 1 },
                { icon: <TrendingDown size={15} />, label: "วัสดุต่ำกว่าจุดสั่งซื้อ", value: low.length, unit: "รายการ", tone: "bad" as const, to: 3 },
                { icon: <Receipt size={15} />, label: "ตรวจสามทางไม่ผ่าน", value: unmatched, unit: "ใบ", tone: "bad" as const, to: 2 },
                { icon: <Truck size={15} />, label: "ใบสั่งซื้อที่ยังรับไม่ครบ", value: openOrders.length, unit: "ใบ", tone: "info" as const, to: 2 },
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
            </div>
          </Card>
        </div>
      </Reveal>

      <Reveal delay={0.08} className="mt-3">
        <div className="grid gap-3 xl:grid-cols-3">
          <Card
            className="xl:col-span-2"
            title={<span className="flex items-center gap-2"><TrendingUp size={15} className="text-slate-400" />ยอดสั่งซื้อรายเดือน</span>}
            subtitle="คิดจากมูลค่าในใบสั่งซื้อที่เปิดในเดือนนั้น"
          >
            <ColumnChart
              data={spend.map((s, i) => ({
                label: s.month.slice(5) + "/" + s.month.slice(2, 4),
                value: s.value,
                tone: i === spend.length - 1 ? ("accent" as const) : undefined,
              }))}
              format={(n) => baht(n)}
              height={180}
            />
            <ul className="divide-y divide-slate-100 border-t border-slate-100 dark:divide-slate-800 dark:border-slate-800">
              {spend.map((s) => (
                <li key={s.month} className="flex items-center gap-3 px-4 py-2 text-[12.5px]">
                  <span className="w-20 shrink-0 tabular-nums text-slate-600 dark:text-slate-300">{s.month}</span>
                  <span className="min-w-0 flex-1 text-slate-400">{s.orders} ใบสั่งซื้อ</span>
                  <span className="shrink-0 tabular-nums text-slate-900 dark:text-slate-50">{baht(s.value)}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card
            title={<span className="flex items-center gap-2"><Building size={15} className="text-slate-400" />ผู้ขายตามมูลค่าที่สั่ง</span>}
            action={seeAll(4)}
          >
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {byVendor.map(({ v, value, orders, fillRate }) => (
                <li key={v.code} className="px-4 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={v.name.replace(/^(บจก\.|หจก\.)\s*/, "")} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] text-slate-900 dark:text-slate-50">{v.name}</span>
                      <span className="block text-[11px] text-slate-400">
                        {orders} ใบ · {fillRate === null ? "ยังไม่มีใบที่ปิด" : `ส่งครบ ${fillRate}%`}
                      </span>
                    </span>
                    <span className="shrink-0 text-[12px] tabular-nums text-slate-700 dark:text-slate-200">{baht(value)}</span>
                  </div>
                  <div className="mt-1.5">
                    <Bar pct={(value / topValue) * 100} tone="info" width="w-full" />
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </Reveal>

      <Reveal delay={0.16} className="mt-3">
        <Card
          title={<span className="flex items-center gap-2"><TrendingDown size={15} className="text-slate-400" />วัสดุที่ต่ำกว่าจุดสั่งซื้อ</span>}
          subtitle="ควรเปิดใบขอซื้อก่อนของหมด ระบบเสนอผู้ขายที่เคยให้ราคาดีที่สุดไว้ให้"
          action={seeAll(3)}
        >
          {low.length === 0 ? (
            <p className="py-10 text-center text-[12.5px] text-slate-400">ทุกรายการอยู่เหนือจุดสั่งซื้อ</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {low.map((m) => {
                const best = bestPriceFor(m.code);
                return (
                  <li key={m.code} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                    <Dot className={groupSwatch(m.group).dot} />
                    <button onClick={() => onOpenMaterial(m)} className="w-56 shrink-0 text-left">
                      <span className="block truncate text-[13px] text-slate-900 dark:text-slate-50">{m.name}</span>
                      <span className="block font-mono text-[11px] text-slate-400">{m.code}</span>
                    </button>
                    <span className="min-w-0 flex-1">
                      <Bar pct={(m.stock / m.reorder) * 100} tone="bad" width="w-full" />
                    </span>
                    <span className="w-32 shrink-0 text-right text-[11.5px] tabular-nums text-slate-500 dark:text-slate-400">
                      เหลือ {m.stock} / จุดสั่ง {m.reorder}
                    </span>
                    <span className="w-48 shrink-0 text-right text-[11.5px] text-slate-400">
                      {best ? `${vendor(best.vendor).name} ${baht(best.price)}` : "ยังไม่มีราคาอ้างอิง"}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </Reveal>
    </div>
  );
}

/* ---------------------------------------------------------------- master */

function Master({
  rows,
  q,
  setQ,
  group,
  setGroup,
  onOpenMaterial,
  onOpenVendor,
}: {
  rows: Material[];
  q: string;
  setQ: (v: string) => void;
  group: string;
  setGroup: (v: string) => void;
  onOpenMaterial: (m: Material) => void;
  onOpenVendor: (v: Vendor) => void;
}) {
  const [view, setView] = useState(MASTER_TABS[0]);

  const columns: Column<Material>[] = [
    {
      key: "name",
      header: "วัสดุ",
      width: "28%",
      sort: (a, b) => a.name.localeCompare(b.name, "th"),
      cell: (m) => (
        <span>
          <span className="block font-medium text-slate-900 dark:text-slate-50">{m.name}</span>
          <span className="block font-mono text-[11px] text-slate-400">{m.code}</span>
        </span>
      ),
    },
    {
      key: "group",
      header: "กลุ่ม",
      width: "16%",
      sort: (a, b) => MATERIAL_GROUPS.indexOf(a.group) - MATERIAL_GROUPS.indexOf(b.group),
      cell: (m) => <Tag swatch={groupSwatch(m.group)}>{m.group}</Tag>,
    },
    {
      key: "bin",
      header: "ช่องเก็บ",
      width: "12%",
      cell: (m) => <span className="font-mono text-[12px] text-slate-500 dark:text-slate-400">{m.bin}</span>,
    },
    {
      key: "stock",
      header: "คงเหลือ",
      align: "right",
      width: "14%",
      sort: (a, b) => a.stock - b.stock,
      cell: (m) => (
        <span className={"tabular-nums " + (m.stock < m.reorder ? "font-semibold text-rose-600 dark:text-rose-400" : "text-slate-700 dark:text-slate-200")}>
          {m.stock} {m.unit}
        </span>
      ),
    },
    {
      key: "price",
      header: "ราคาต่อหน่วย",
      align: "right",
      width: "15%",
      sort: (a, b) => a.price - b.price,
      cell: (m) => <span className="tabular-nums text-slate-700 dark:text-slate-200">{baht(m.price)}</span>,
    },
    {
      key: "value",
      header: "มูลค่า",
      align: "right",
      width: "15%",
      sort: (a, b) => a.stock * a.price - b.stock * b.price,
      cell: (m) => <span className="tabular-nums text-slate-900 dark:text-slate-50">{baht(m.stock * m.price)}</span>,
    },
  ];

  return (
    <div className="space-y-3">
      <Tabs tabs={MASTER_TABS} active={view} onPick={setView} icons={MASTER_ICONS} id="master" />

      {view === "แฟ้มวัสดุ" && (
        <DataTable
          rows={rows}
          columns={columns}
          getId={(m) => m.code}
          onOpen={onOpenMaterial}
          toolbar={
            <div className="flex flex-wrap items-center gap-2">
              <Search value={q} onChange={setQ} placeholder="ค้นหาชื่อวัสดุ รหัส หรือช่องเก็บ" icon={<SearchIcon size={14} />} />
              <Select value={group} onChange={setGroup} options={["ทุกกลุ่ม", ...MATERIAL_GROUPS]} />
              <span className="ml-auto text-[12px] text-slate-400">
                แสดง {rows.length} รายการ · มูลค่า {baht(rows.reduce((n, m) => n + m.stock * m.price, 0))}
              </span>
            </div>
          }
        />
      )}

      {view === "แฟ้มผู้ขาย" && (
        <div className="grid gap-3 lg:grid-cols-2">
          {VENDORS.map((v) => {
            const score = vendorScore(v.code);
            return (
              <Card
                key={v.code}
                title={
                  <button onClick={() => onOpenVendor(v)} className="flex items-center gap-2.5 text-left transition hover:text-violet-700">
                    <Avatar name={v.name.replace(/^(บจก\.|หจก\.)\s*/, "")} size="sm" />
                    {v.name}
                  </button>
                }
                subtitle={`${v.code} · เลขผู้เสียภาษี ${v.taxId}`}
                action={<Badge tone={score.fillRate === 100 ? "ok" : score.fillRate === null ? "idle" : "warn"}>
                  {score.fillRate === null ? "ยังไม่มีใบที่ปิด" : `ส่งครบ ${score.fillRate}%`}
                </Badge>}
              >
                <div className="space-y-1 p-4">
                  <IconRow icon={<Handshake size={14} />} label="ผู้ติดต่อ">{v.contact}</IconRow>
                  <IconRow icon={<Receipt size={14} />} label="เงื่อนไขชำระ">{v.terms}</IconRow>
                  <IconRow icon={<Truck size={14} />} label="เวลาส่งของ">{v.leadDays} วัน</IconRow>
                  <IconRow icon={<Coins size={14} />} label="มูลค่าที่สั่งรวม">{baht(score.value)}</IconRow>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {view === "ราคาที่เคยเสนอ" && (
        <Card
          title={<span className="flex items-center gap-2"><Coins size={15} className="text-slate-400" />ราคาที่ผู้ขายเคยเสนอ</span>}
          subtitle="ใช้ประกอบการเลือกแหล่งซื้อในรอบถัดไป แถวที่ทำเครื่องหมายคือราคาดีที่สุดของวัสดุนั้น"
        >
          <table className="w-full text-[13px]">
            <thead className="bg-slate-50/80 text-left text-[11px] uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">วัสดุ</th>
                <th className="px-4 py-3 font-medium">ผู้ขาย</th>
                <th className="px-4 py-3 text-right font-medium">ราคา</th>
                <th className="px-4 py-3 text-right font-medium">เวลาส่ง</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {INFO_RECORDS.map((r, i) => {
                const best = bestPriceFor(r.material)!;
                const isBest = best.vendor === r.vendor && best.price === r.price;
                return (
                  <tr key={i} className="transition hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-2.5 text-slate-900 dark:text-slate-50">{material(r.material).name}</td>
                    <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{vendor(r.vendor).name}</td>
                    <td className={"px-4 py-2.5 text-right tabular-nums " + (isBest ? "font-semibold text-emerald-700 dark:text-emerald-400" : "text-slate-700 dark:text-slate-200")}>
                      {baht(r.price)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-500 dark:text-slate-400">{r.leadDays} วัน</td>
                    <td className="px-4 py-2.5">
                      {isBest && <Badge tone="ok" icon={<Star size={11} />}>ราคาดีที่สุด</Badge>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

/* -------------------------------------------------------------- ordering */

function Ordering({
  statusOf,
  onApprove,
  onOpenPo,
}: {
  statusOf: (no: string, seed: string) => string;
  onApprove: (r: (typeof REQUISITIONS)[number]) => void;
  onOpenPo: (p: PurchaseOrder) => void;
}) {
  return (
    <div className="space-y-3">
      <Card
        title={<span className="flex items-center gap-2"><ClipboardList size={15} className="text-slate-400" />ใบขอซื้อ</span>}
        subtitle="หน่วยงานเปิดใบขอซื้อ จัดซื้ออนุมัติแล้วจึงแปลงเป็นใบสั่งซื้อ"
      >
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {REQUISITIONS.map((r) => {
            const m = material(r.material);
            const status = statusOf(r.no, r.status);
            const best = bestPriceFor(r.material);
            return (
              <li key={r.no} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="w-32 shrink-0 font-mono text-[12px] text-slate-500 dark:text-slate-400">{r.no}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-slate-900 dark:text-slate-50">{m.name}</span>
                  <span className="block truncate text-[11.5px] text-slate-400">
                    {r.qty} {m.unit} · ขอโดย{r.requester} · ต้องการภายใน {r.needBy}
                    {best && ` · ราคาอ้างอิง ${baht(best.price)} จาก${vendor(best.vendor).name}`}
                  </span>
                </span>
                <span className="shrink-0 text-[12.5px] tabular-nums text-slate-600 dark:text-slate-300">
                  {best ? baht(best.price * r.qty) : "—"}
                </span>
                <Badge tone={status === "รออนุมัติ" ? "warn" : status === "อนุมัติแล้ว" ? "info" : "ok"} dot>
                  {status}
                </Badge>
                {status === "รออนุมัติ" && (
                  <Button variant="secondary" onClick={() => onApprove(r)}>
                    อนุมัติ
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </Card>

      <Card
        title={<span className="flex items-center gap-2"><ShoppingCart size={15} className="text-slate-400" />ใบสั่งซื้อ</span>}
        subtitle="กดที่แถวเพื่อดูรายบรรทัด ของที่รับแล้ว และใบแจ้งหนี้ที่ผูกอยู่"
      >
        <table className="w-full text-[13px]">
          <thead className="bg-slate-50/80 text-left text-[11px] uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">เลขที่</th>
              <th className="px-4 py-3 font-medium">ผู้ขาย</th>
              <th className="px-4 py-3 font-medium">วันที่</th>
              <th className="px-4 py-3 text-right font-medium">รายการ</th>
              <th className="px-4 py-3 text-right font-medium">มูลค่า</th>
              <th className="px-4 py-3 font-medium">สถานะ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {[...PURCHASE_ORDERS].reverse().map((po) => (
              <tr
                key={po.no}
                onClick={() => onOpenPo(po)}
                className="cursor-pointer transition hover:bg-slate-50 dark:hover:bg-slate-800/40"
              >
                <td className="px-4 py-2.5 font-mono text-[12px] text-slate-500 dark:text-slate-400">{po.no}</td>
                <td className="px-4 py-2.5 text-slate-900 dark:text-slate-50">{vendor(po.vendor).name}</td>
                <td className="px-4 py-2.5 tabular-nums text-slate-500 dark:text-slate-400">{po.date}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-300">{po.lines.length}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-slate-900 dark:text-slate-50">{baht(poTotal(po))}</td>
                <td className="px-4 py-2.5">
                  <Badge tone={PO_TONE[po.status]} dot>{po.status}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------- receiving */

function Receiving({ onOpenPo }: { onOpenPo: (p: PurchaseOrder) => void }) {
  const rows = PURCHASE_ORDERS.map((po) => ({ po, m: threeWayMatch(po) }));
  const blocked = rows.filter((r) => r.m.invoice > 0 && !r.m.matched);

  return (
    <div className="space-y-3">
      <StatStrip
        title="การรับของและการตรวจสอบ"
        icon={<PackageCheck size={15} />}
        cells={[
          { icon: <Truck size={13} />, label: "ใบรับของ", value: GOODS_RECEIPTS.length + " ใบ", sub: "บันทึกของที่รับเข้าจริง" },
          { icon: <Receipt size={13} />, label: "ใบแจ้งหนี้ที่ตั้งไว้", value: INVOICES.length + " ใบ", sub: "ผู้ขายวางบิลเข้ามาแล้ว", tone: "info" },
          { icon: <CircleCheck size={13} />, label: "ตรวจผ่าน", value: rows.filter((r) => r.m.matched).length + " ใบ", sub: "สั่ง รับ และวางบิลตรงกัน", tone: "ok" },
          { icon: <CircleX size={13} />, label: "ตรวจไม่ผ่าน", value: blocked.length + " ใบ", sub: "ยังอนุมัติจ่ายไม่ได้", tone: blocked.length > 0 ? "bad" : "ok" },
        ]}
      />

      {blocked.length > 0 && (
        <Note tone="bad">
          มี {blocked.length} ใบที่ยอดวางบิลไม่ตรงกับของที่รับจริง ควรให้ผู้ขายออกใบลดหนี้หรือส่งของส่วนที่ขาดก่อนอนุมัติจ่าย
        </Note>
      )}

      <Card
        title={<span className="flex items-center gap-2"><Truck size={15} className="text-slate-400" />ใบรับของ</span>}
        subtitle="แต่ละใบอ้างถึงใบสั่งซื้อที่เป็นต้นเรื่อง"
      >
        <table className="w-full text-[13px]">
          <thead className="bg-slate-50/80 text-left text-[11px] uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">เลขที่</th>
              <th className="px-4 py-3 font-medium">อ้างใบสั่งซื้อ</th>
              <th className="px-4 py-3 font-medium">วันที่</th>
              <th className="px-4 py-3 font-medium">รายการที่รับ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {[...GOODS_RECEIPTS].reverse().map((g) => (
              <tr key={g.no} className="transition hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <td className="px-4 py-2.5 font-mono text-[12px] text-slate-500 dark:text-slate-400">{g.no}</td>
                <td className="px-4 py-2.5">
                  <button
                    onClick={() => onOpenPo(PURCHASE_ORDERS.find((p) => p.no === g.po)!)}
                    className="font-mono text-[12px] text-violet-700 transition hover:underline dark:text-violet-300"
                  >
                    {g.po}
                  </button>
                </td>
                <td className="px-4 py-2.5 tabular-nums text-slate-500 dark:text-slate-400">{g.date}</td>
                <td className="px-4 py-2.5 text-slate-700 dark:text-slate-200">
                  {g.lines.map((l) => `${material(l.material).name} × ${l.qty}`).join(" · ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card
        title={<span className="flex items-center gap-2"><PackageSearch size={15} className="text-slate-400" />ตรวจสามทาง</span>}
        subtitle="เทียบใบสั่งซื้อ ใบรับของ และใบวางบิล ให้ตรงกันก่อนอนุมัติจ่าย"
      >
        <table className="w-full text-[13px]">
          <thead className="bg-slate-50/80 text-left text-[11px] uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">ใบสั่งซื้อ</th>
              <th className="px-4 py-3 text-right font-medium">สั่ง</th>
              <th className="px-4 py-3 text-right font-medium">รับแล้ว</th>
              <th className="px-4 py-3 text-right font-medium">วางบิล</th>
              <th className="px-4 py-3 font-medium">ผล</th>
              <th className="px-4 py-3 text-right font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {[...rows].reverse().map(({ po, m }) => (
              <tr key={po.no} className="transition hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <td className="px-4 py-2.5 font-mono text-[12px] text-slate-500 dark:text-slate-400">{po.no}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-slate-700 dark:text-slate-200">{baht(m.ordered)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-slate-700 dark:text-slate-200">{baht(m.received)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-slate-700 dark:text-slate-200">{m.invoice ? baht(m.invoice) : "—"}</td>
                <td className="px-4 py-2.5">
                  {m.invoice === 0 ? (
                    <Badge tone="idle">ยังไม่วางบิล</Badge>
                  ) : m.matched ? (
                    <Badge tone="ok" dot>ตรงกัน จ่ายได้</Badge>
                  ) : (
                    <Badge tone="bad" dot>ไม่ตรง ยังจ่ายไม่ได้</Badge>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <Button variant="secondary" onClick={() => onOpenPo(po)}>
                    ดูรายละเอียด
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

/* ----------------------------------------------------------------- stock */

function Stock({ onOpenMaterial }: { onOpenMaterial: (m: Material) => void }) {
  const groups = stockByGroup();
  const low = belowReorder();

  return (
    <div className="space-y-3">
      <StatStrip
        title="สต็อกวัสดุ"
        icon={<Warehouse size={15} />}
        cells={[
          { icon: <Coins size={13} />, label: "มูลค่าสต็อกรวม", value: baht(stockValue()), sub: `${MATERIALS.length} รายการในแฟ้มวัสดุ` },
          { icon: <TrendingDown size={13} />, label: "ต่ำกว่าจุดสั่งซื้อ", value: low.length + " รายการ", sub: "ควรเปิดใบขอซื้อ", tone: low.length > 0 ? "bad" : "ok" },
          { icon: <Layers size={13} />, label: "กลุ่มวัสดุ", value: groups.length + " กลุ่ม", sub: "แบ่งตามการใช้งาน", tone: "info" },
          { icon: <TrendingUp size={13} />, label: "ความเคลื่อนไหวสัปดาห์นี้", value: STOCK_MOVES.filter((m) => m.date >= "2026-09-15").length + " รายการ", sub: "รับเข้าและจ่ายออก", tone: "accent" },
        ]}
      />

      <div className="grid gap-3 xl:grid-cols-3">
        <Card
          title={<span className="flex items-center gap-2"><Layers size={15} className="text-slate-400" />มูลค่าตามกลุ่มวัสดุ</span>}
        >
          <div className="p-4">
            <Donut
              segments={groups.map((g) => ({ label: g.group, value: g.value, swatch: groupSwatch(g.group) }))}
              size={128}
              center={
                <span>
                  <span className="block text-[18px] font-semibold leading-none tabular-nums text-slate-900 dark:text-slate-50">
                    {groups.length}
                  </span>
                  <span className="mt-1 block text-[10.5px] uppercase tracking-wide text-slate-400">กลุ่ม</span>
                </span>
              }
            />
          </div>
        </Card>

        <Card
          className="xl:col-span-2"
          title={<span className="flex items-center gap-2"><Boxes size={15} className="text-slate-400" />ระดับสต็อกเทียบจุดสั่งซื้อ</span>}
          subtitle="แถบสีแดงคือรายการที่คงเหลือต่ำกว่าจุดสั่งซื้อแล้ว"
        >
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {[...MATERIALS]
              .sort((a, b) => a.stock / a.reorder - b.stock / b.reorder)
              .map((m) => (
                <li key={m.code} className="flex items-center gap-3 px-4 py-2">
                  <Dot className={groupSwatch(m.group).dot} />
                  <button onClick={() => onOpenMaterial(m)} className="w-52 shrink-0 truncate text-left text-[13px] text-slate-900 hover:text-violet-700 dark:text-slate-50">
                    {m.name}
                  </button>
                  <span className="min-w-0 flex-1">
                    <Bar pct={Math.min(100, (m.stock / m.reorder) * 100)} tone={m.stock < m.reorder ? "bad" : "ok"} width="w-full" />
                  </span>
                  <span className="w-32 shrink-0 text-right text-[11.5px] tabular-nums text-slate-500 dark:text-slate-400">
                    {m.stock} / {m.reorder} {m.unit}
                  </span>
                </li>
              ))}
          </ul>
        </Card>
      </div>

      <Card
        title={<span className="flex items-center gap-2"><TrendingUp size={15} className="text-slate-400" />ความเคลื่อนไหวสต็อก</span>}
        subtitle="รับเข้าเป็นบวก จ่ายออกเป็นลบ ทุกแถวอ้างถึงเอกสารที่เป็นต้นเรื่อง"
      >
        <table className="w-full text-[13px]">
          <thead className="bg-slate-50/80 text-left text-[11px] uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">วันที่</th>
              <th className="px-4 py-3 font-medium">วัสดุ</th>
              <th className="px-4 py-3 text-right font-medium">จำนวน</th>
              <th className="px-4 py-3 font-medium">เหตุผล</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {[...STOCK_MOVES].reverse().map((mv, i) => (
              <tr key={i} className="transition hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <td className="px-4 py-2.5 tabular-nums text-slate-500 dark:text-slate-400">{mv.date}</td>
                <td className="px-4 py-2.5 text-slate-900 dark:text-slate-50">{material(mv.material).name}</td>
                <td className={"px-4 py-2.5 text-right font-semibold tabular-nums " + (mv.qty > 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                  {mv.qty > 0 ? "+" : ""}
                  {mv.qty}
                </td>
                <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{mv.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

/* --------------------------------------------------------- vendor review */

function VendorReview({ onOpenVendor }: { onOpenVendor: (v: Vendor) => void }) {
  const rows = VENDORS.map((v) => ({ v, ...vendorScore(v.code) })).sort((a, b) => b.value - a.value);
  const [sortBy, setSortBy] = useState("มูลค่าที่สั่ง");
  const shown =
    sortBy === "มูลค่าที่สั่ง"
      ? rows
      : sortBy === "อัตราส่งครบ"
        ? [...rows].sort((a, b) => (b.fillRate ?? -1) - (a.fillRate ?? -1))
        : [...rows].sort((a, b) => a.v.leadDays - b.v.leadDays);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented options={["มูลค่าที่สั่ง", "อัตราส่งครบ", "เวลาส่งของ"]} value={sortBy} onChange={setSortBy} />
        <span className="ml-auto text-[12px] text-slate-400">อัตราส่งครบคิดจากใบสั่งซื้อที่ปิดแล้วเท่านั้น</span>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {shown.map(({ v, orders, value, fillRate }) => (
          <Card
            key={v.code}
            title={
              <button onClick={() => onOpenVendor(v)} className="flex items-center gap-2.5 text-left transition hover:text-violet-700">
                <Avatar name={v.name.replace(/^(บจก\.|หจก\.)\s*/, "")} size="sm" />
                {v.name}
              </button>
            }
            subtitle={`${v.contact} · ${v.terms}`}
            action={
              <Badge tone={fillRate === null ? "idle" : fillRate === 100 ? "ok" : "warn"}>
                {fillRate === null ? "ยังไม่มีใบที่ปิด" : `ส่งครบ ${fillRate}%`}
              </Badge>
            }
          >
            <div className="grid grid-cols-3 gap-px bg-slate-100 dark:bg-slate-800">
              {[
                { label: "ใบสั่งซื้อ", value: orders + " ใบ" },
                { label: "มูลค่ารวม", value: baht(value) },
                { label: "เวลาส่ง", value: v.leadDays + " วัน" },
              ].map((c) => (
                <div key={c.label} className="bg-white p-3 dark:bg-slate-900">
                  <div className="text-[11.5px] text-slate-500 dark:text-slate-400">{c.label}</div>
                  <div className="mt-1 text-[15px] font-semibold tabular-nums text-slate-900 dark:text-slate-50">{c.value}</div>
                </div>
              ))}
            </div>
            {fillRate !== null && (
              <div className="px-4 py-3">
                <Progress done={fillRate} total={100} label="อัตราส่งของครบตามใบสั่งซื้อ" />
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- records */

function MaterialRecord({ m }: { m: Material }) {
  const [tab, setTab] = useState(MATERIAL_TABS[0]);
  const sources = INFO_RECORDS.filter((r) => r.material === m.code);
  const best = bestPriceFor(m.code);
  const moves = movesOf(m.code);
  const sw = groupSwatch(m.group);

  return (
    <div>
      <div className="flex flex-wrap items-start gap-4 border-b border-slate-100 px-5 pb-5 dark:border-slate-800">
        <span className={"grid size-14 shrink-0 place-items-center rounded-2xl " + sw.tint}>
          <Boxes size={24} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[18px] font-semibold text-slate-900 dark:text-slate-50">{m.name}</h2>
          <p className="mt-0.5 font-mono text-[12.5px] text-slate-500 dark:text-slate-400">
            {m.code} · ช่องเก็บ {m.bin}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Tag swatch={sw}>{m.group}</Tag>
            <Badge tone={m.stock < m.reorder ? "bad" : "ok"} dot>
              {m.stock < m.reorder ? "ต่ำกว่าจุดสั่งซื้อ" : "สต็อกเพียงพอ"}
            </Badge>
            <Chip>{m.unit}</Chip>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[11.5px] text-slate-400">มูลค่าคงเหลือ</p>
          <p className="text-[22px] font-semibold tabular-nums text-slate-900 dark:text-slate-50">{baht(m.stock * m.price)}</p>
        </div>
      </div>

      <div className="px-5">
        <Tabs tabs={MATERIAL_TABS} active={tab} onPick={setTab} icons={MATERIAL_ICONS} id="material" />
      </div>

      <div className="px-5 py-4">
        {tab === "ข้อมูลวัสดุ" && (
          <div className="space-y-1">
            <IconRow icon={<FileText size={14} />} label="รหัสวัสดุ">{m.code}</IconRow>
            <IconRow icon={<Layers size={14} />} label="กลุ่ม">{m.group}</IconRow>
            <IconRow icon={<Warehouse size={14} />} label="ช่องเก็บ">{m.bin}</IconRow>
            <IconRow icon={<Coins size={14} />} label="ราคาต่อหน่วย">{baht(m.price)} ต่อ {m.unit}</IconRow>
            <IconRow icon={<Boxes size={14} />} label="จุดสั่งซื้อ">{m.reorder} {m.unit}</IconRow>
          </div>
        )}

        {tab === "ระดับสต็อก" && (
          <div className="space-y-3">
            <Progress done={Math.min(m.stock, m.reorder * 2)} total={m.reorder * 2} label={`คงเหลือ ${m.stock} ${m.unit} · จุดสั่งซื้อ ${m.reorder}`} />
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "คงเหลือ", value: m.stock + " " + m.unit },
                { label: "จุดสั่งซื้อ", value: m.reorder + " " + m.unit },
                { label: "มูลค่า", value: baht(m.stock * m.price) },
              ].map((c) => (
                <div key={c.label} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
                  <div className="text-[11.5px] text-slate-500 dark:text-slate-400">{c.label}</div>
                  <div className="mt-1 text-[15px] font-semibold tabular-nums text-slate-900 dark:text-slate-50">{c.value}</div>
                </div>
              ))}
            </div>
            <Note tone={m.stock < m.reorder ? "warn" : "ok"}>
              {m.stock < m.reorder
                ? `คงเหลือต่ำกว่าจุดสั่งซื้ออยู่ ${m.reorder - m.stock} ${m.unit} ควรเปิดใบขอซื้อ`
                : `ยังเหนือจุดสั่งซื้ออยู่ ${m.stock - m.reorder} ${m.unit}`}
            </Note>
          </div>
        )}

        {tab === "แหล่งซื้อ" && (
          <div className="space-y-2">
            {sources.length === 0 ? (
              <p className="py-6 text-center text-[12.5px] text-slate-400">ยังไม่มีผู้ขายรายใดเคยเสนอราคาสำหรับวัสดุตัวนี้</p>
            ) : (
              sources.map((r) => {
                const isBest = best!.vendor === r.vendor && best!.price === r.price;
                return (
                  <div
                    key={r.vendor}
                    className={
                      "flex items-center gap-3 rounded-xl px-3.5 py-2.5 " +
                      (isBest ? "bg-emerald-50 dark:bg-emerald-500/10" : "bg-slate-50 dark:bg-slate-800/50")
                    }
                  >
                    <Avatar name={vendor(r.vendor).name.replace(/^(บจก\.|หจก\.)\s*/, "")} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] text-slate-900 dark:text-slate-50">{vendor(r.vendor).name}</span>
                      <span className="block text-[11.5px] text-slate-400">
                        {vendor(r.vendor).terms} · ส่งภายใน {r.leadDays} วัน
                      </span>
                    </span>
                    <span className="shrink-0 text-[13px] font-semibold tabular-nums text-slate-900 dark:text-slate-50">{baht(r.price)}</span>
                    {isBest && <Badge tone="ok" icon={<Star size={11} />}>ดีที่สุด</Badge>}
                  </div>
                );
              })
            )}
          </div>
        )}

        {tab === "ความเคลื่อนไหว" && (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {moves.length === 0 ? (
              <li className="py-6 text-center text-[12.5px] text-slate-400">ยังไม่มีความเคลื่อนไหวของวัสดุตัวนี้</li>
            ) : (
              [...moves].reverse().map((mv, i) => (
                <li key={i} className="flex items-center gap-3 py-2.5">
                  <span className={"grid size-8 shrink-0 place-items-center rounded-full " + (mv.qty > 0 ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300" : "bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300")}>
                    {mv.qty > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] text-slate-800 dark:text-slate-100">{mv.reason}</span>
                    <span className="block text-[11.5px] tabular-nums text-slate-400">{mv.date}</span>
                  </span>
                  <span className={"shrink-0 text-[13px] font-semibold tabular-nums " + (mv.qty > 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                    {mv.qty > 0 ? "+" : ""}
                    {mv.qty} {m.unit}
                  </span>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    </div>
  );
}

function PoRecord({ po }: { po: PurchaseOrder }) {
  const m = threeWayMatch(po);
  const grs = receiptsOf(po.no);
  const invs = invoicesOf(po.no);
  const at = PO_FLOW.indexOf(po.status);
  const flow: { label: string; state: StepState }[] = PO_FLOW.map((s, i) => ({
    label: s,
    state: i < at ? "done" : i === at ? "current" : "todo",
  }));

  return (
    <div className="space-y-4">
      <Stepper
        steps={flow}
        icons={{
          done: <CircleCheck size={14} />,
          current: <Truck size={14} />,
          todo: <PackageSearch size={14} />,
          failed: <CircleX size={14} />,
        }}
      />

      <div className="space-y-1">
        <IconRow icon={<Building size={14} />} label="ผู้ขาย">{vendor(po.vendor).name}</IconRow>
        <IconRow icon={<Receipt size={14} />} label="เงื่อนไขชำระ">{vendor(po.vendor).terms}</IconRow>
        <IconRow icon={<FileText size={14} />} label="วันที่สั่ง">{po.date}</IconRow>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-400">รายการในใบสั่งซื้อ</p>
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {po.lines.map((l) => {
            const got = grs.reduce((n, g) => n + (g.lines.find((x) => x.material === l.material)?.qty ?? 0), 0);
            return (
              <li key={l.material} className="flex flex-wrap items-center gap-3 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] text-slate-900 dark:text-slate-50">{material(l.material).name}</span>
                  <span className="block font-mono text-[11px] text-slate-400">{l.material}</span>
                </span>
                <span className="w-28 shrink-0 text-right text-[12.5px] tabular-nums text-slate-500 dark:text-slate-400">
                  {baht(l.price)} × {l.qty}
                </span>
                <Badge tone={got >= l.qty ? "ok" : got > 0 ? "warn" : "idle"}>
                  รับแล้ว {got} / {l.qty}
                </Badge>
                <span className="w-28 shrink-0 text-right text-[13px] tabular-nums text-slate-900 dark:text-slate-50">
                  {baht(l.price * l.qty)}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "สั่ง", value: m.ordered },
          { label: "รับแล้ว", value: m.received },
          { label: "วางบิล", value: m.invoice },
        ].map((c) => (
          <div key={c.label} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
            <div className="text-[11.5px] text-slate-500 dark:text-slate-400">{c.label}</div>
            <div className="mt-1 text-[15px] font-semibold tabular-nums text-slate-900 dark:text-slate-50">
              {c.value ? baht(c.value) : "—"}
            </div>
          </div>
        ))}
      </div>

      <Note tone={m.invoice === 0 ? "idle" : m.matched ? "ok" : "bad"}>
        {m.invoice === 0
          ? "ยังไม่มีใบแจ้งหนี้ ตรวจสามทางเมื่อผู้ขายวางบิล"
          : m.matched
            ? "สั่ง รับ และวางบิล ตรงกันทั้งสามทาง อนุมัติจ่ายได้"
            : "ยอดวางบิลยังไม่ตรงกับของที่รับจริง " +
              m.shortLines.map((s) => material(s.material).name + " ขาด " + (s.qty - s.got)).join(", ")}
      </Note>

      {invs.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-400">ใบแจ้งหนี้ที่ผูกอยู่</p>
          <ul className="space-y-1.5">
            {invs.map((i) => (
              <li key={i.no} className="flex items-center gap-3 text-[13px]">
                <span className="font-mono text-[12px] text-slate-500 dark:text-slate-400">{i.no}</span>
                <span className="tabular-nums text-slate-400">{i.date}</span>
                <span className="ml-auto tabular-nums text-slate-900 dark:text-slate-50">{baht(i.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function VendorRecord({ v }: { v: Vendor }) {
  const score = vendorScore(v.code);
  const orders = PURCHASE_ORDERS.filter((p) => p.vendor === v.code);
  const prices = INFO_RECORDS.filter((r) => r.vendor === v.code);

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <IconRow icon={<FileText size={14} />} label="รหัสผู้ขาย">{v.code}</IconRow>
        <IconRow icon={<Handshake size={14} />} label="ผู้ติดต่อ">{v.contact}</IconRow>
        <IconRow icon={<Receipt size={14} />} label="เงื่อนไขชำระ">{v.terms}</IconRow>
        <IconRow icon={<Truck size={14} />} label="เวลาส่งของ">{v.leadDays} วัน</IconRow>
        <IconRow icon={<Building size={14} />} label="เลขผู้เสียภาษี">{v.taxId}</IconRow>
      </div>

      {score.fillRate !== null && <Progress done={score.fillRate} total={100} label="อัตราส่งของครบตามใบสั่งซื้อ" />}

      <div>
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-400">ใบสั่งซื้อที่เปิดกับรายนี้</p>
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {orders.map((p) => (
            <li key={p.no} className="flex items-center gap-3 py-2 text-[13px]">
              <span className="font-mono text-[12px] text-slate-500 dark:text-slate-400">{p.no}</span>
              <span className="tabular-nums text-slate-400">{p.date}</span>
              <Badge tone={PO_TONE[p.status]}>{p.status}</Badge>
              <span className="ml-auto tabular-nums text-slate-900 dark:text-slate-50">{baht(poTotal(p))}</span>
            </li>
          ))}
        </ul>
      </div>

      {prices.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-400">ราคาที่เคยเสนอ</p>
          <ul className="flex flex-wrap gap-1.5">
            {prices.map((r) => (
              <li key={r.material} className={"rounded-full px-2.5 py-1 text-[11.5px] " + groupSwatch(material(r.material).group).tint}>
                {material(r.material).name} {baht(r.price)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
