import { useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowRight, ArrowRightLeft, Boxes, CircleCheck, CircleX, ClipboardCheck, Coins, Grid2x2,
  Import, Layers, MapPin, Package, PackageCheck, PackageOpen, Scale, Search as SearchIcon,
  Send, TrendingDown, TrendingUp, TriangleAlert, Warehouse, Weight,
} from "lucide-react";
import { TODAY, material } from "../mm/data";
import {
  BINS, COUNTS, INBOUND, PICKS, STORAGE_TYPES, TRANSFERS, WAREHOUSE, baht, bin, binLoad, freeBins,
  storageType, variance, varianceValue,
} from "./data";
import type { Bin, Count } from "./data";
import {
  Avatar, Badge, Bar, Button, Card, Chip, ColumnChart, Donut, Dot, IconRow, Note, PageHead,
  Progress, Reveal, Search, Segmented, Select, StatStrip, Tabs, Tag, TintCard, swatchFor,
} from "../ui";
import { ConfirmDialog, DataTable, DetailModal, FormModal } from "../kit";
import type { Column } from "../kit";

const TABS = [
  "ผังคลังและช่องเก็บ",
  "รับเข้าและจัดเก็บ",
  "หยิบสินค้าและจ่ายออก",
  "ย้ายสินค้าภายในคลัง",
  "ตรวจนับสต็อก",
];

const TYPE_CODES = STORAGE_TYPES.map((t) => t.code);
const typeSwatch = (code: string) => swatchFor(code, TYPE_CODES);

const TYPE_ICON: Record<string, ReactNode> = {
  REC: <Import size={15} />,
  BLK: <Boxes size={15} />,
  PCK: <PackageOpen size={15} />,
  SHP: <Send size={15} />,
};

const BIN_TABS = ["สภาพช่อง", "ของที่เก็บอยู่", "งานที่เกี่ยวข้อง"];
const BIN_ICONS: Record<string, ReactNode> = {
  สภาพช่อง: <Weight size={13} />,
  ของที่เก็บอยู่: <Package size={13} />,
  งานที่เกี่ยวข้อง: <ClipboardCheck size={13} />,
};

/* ----------------------------------------------------------------- screen */

export default function WmScreen({
  section,
  onOpenSection,
}: {
  section?: string;
  onOpenSection?: (index: number) => void;
}) {
  const tab = section && TABS.includes(section) ? section : undefined;

  const [storedAway, setStoredAway] = useState<string[]>([]);
  const [pickedUp, setPickedUp] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [type, setType] = useState("ทุกพื้นที่");
  const [openBinAt, setOpenBinAt] = useState<number | null>(null);
  const [storing, setStoring] = useState<(typeof INBOUND)[number] | null>(null);
  const [openCount, setOpenCount] = useState<Count | null>(null);

  const inboundStatus = (no: string, seed: string) => (storedAway.includes(no) ? "จัดเก็บแล้ว" : seed);
  const pickStatus = (no: string, seed: string) => (pickedUp.includes(no) ? "หยิบแล้ว" : seed);

  const needle = q.trim().toLowerCase();
  const binRows = BINS.filter(
    (b) =>
      (type === "ทุกพื้นที่" || b.type === type) &&
      (needle === "" ||
        [b.code, b.material ? material(b.material).name : ""].some((t) => t.toLowerCase().includes(needle)))
  );
  const pickedBin = openBinAt === null ? null : (binRows[openBinAt] ?? null);

  const waitingIn = INBOUND.filter((i) => inboundStatus(i.no, i.status) === "รอจัดเก็บ");
  const waitingPick = PICKS.filter((p) => pickStatus(p.no, p.status) === "รอหยิบ");
  const offCount = COUNTS.filter((c) => variance(c) !== 0);
  const fullBins = BINS.filter((b) => b.material && binLoad(b).pct >= 80);

  const panels = (
    <>
      <DetailModal
        open={pickedBin !== null}
        title="ช่องเก็บ"
        onClose={() => setOpenBinAt(null)}
        index={openBinAt ?? 0}
        total={binRows.length}
        onStep={(d) => setOpenBinAt((i) => Math.min(binRows.length - 1, Math.max(0, (i ?? 0) + d)))}
      >
        {pickedBin && <BinRecord key={pickedBin.code} b={pickedBin} />}
      </DetailModal>

      <ConfirmDialog
        open={storing !== null}
        title="ยืนยันการจัดเก็บ"
        body="ยืนยันแล้วของจะถูกบันทึกเข้าช่องที่เลือก และหายจากคิวท่ารับของ"
        subject={
          storing && (
            <span className="block">
              <span className="block text-[13px] font-medium text-slate-900 dark:text-slate-50">
                {material(storing.material).name} × {storing.qty}
              </span>
              <span className="block text-[11.5px] text-slate-500 dark:text-slate-400">
                จาก {storing.from} ไปช่อง {storing.suggestBin} · {storageType(bin(storing.suggestBin).type).name}
              </span>
            </span>
          )
        }
        confirmLabel="จัดเก็บเข้าช่อง"
        onCancel={() => setStoring(null)}
        onConfirm={() => {
          if (storing) setStoredAway((s) => [...new Set([...s, storing.no])]);
          setStoring(null);
        }}
      />

      <FormModal
        open={openCount !== null}
        title="ผลการตรวจนับ"
        subtitle={openCount ? `${openCount.bin} · ${material(openCount.material).name}` : undefined}
        onClose={() => setOpenCount(null)}
        size="sm"
      >
        {openCount && <CountRecord c={openCount} />}
      </FormModal>
    </>
  );

  if (!tab) {
    return (
      <>
        <Overview
          waitingIn={waitingIn.length}
          waitingPick={waitingPick.length}
          offCount={offCount}
          fullBins={fullBins}
          onOpenSection={onOpenSection}
          onOpenBin={(b) => {
            setQ("");
            setType("ทุกพื้นที่");
            setOpenBinAt(BINS.indexOf(b));
          }}
          onOpenCount={setOpenCount}
        />
        {panels}
      </>
    );
  }

  return (
    <div>
      <PageHead
        title="บริหารคลังสินค้า"
        meta={`${tab} · ${WAREHOUSE.code} ${WAREHOUSE.name} · ${BINS.length} ช่องเก็บ ใน ${STORAGE_TYPES.length} พื้นที่`}
      />

      {tab === "ผังคลังและช่องเก็บ" && (
        <Layout
          rows={binRows}
          q={q}
          setQ={setQ}
          type={type}
          setType={setType}
          onOpen={(b) => setOpenBinAt(binRows.indexOf(b))}
        />
      )}
      {tab === "รับเข้าและจัดเก็บ" && <Inbound statusOf={inboundStatus} onStore={setStoring} />}
      {tab === "หยิบสินค้าและจ่ายออก" && (
        <Picking statusOf={pickStatus} onPick={(no) => setPickedUp((p) => [...new Set([...p, no])])} />
      )}
      {tab === "ย้ายสินค้าภายในคลัง" && <Transfers />}
      {tab === "ตรวจนับสต็อก" && <Counting onOpen={setOpenCount} />}

      {panels}

      <div hidden data-fitt-index>
        <button data-fitt-screen="บริหารคลังสินค้า" />
        <button data-fitt-screen="ช่องเก็บ" data-fitt-modal onClick={() => setOpenBinAt(0)} />
        <button data-fitt-screen="ยืนยันการจัดเก็บ" data-fitt-modal onClick={() => setStoring(INBOUND[0])} />
        <button data-fitt-screen="ผลการตรวจนับ" data-fitt-modal onClick={() => setOpenCount(COUNTS[0])} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- overview */

function Overview({
  waitingIn,
  waitingPick,
  offCount,
  fullBins,
  onOpenSection,
  onOpenBin,
  onOpenCount,
}: {
  waitingIn: number;
  waitingPick: number;
  offCount: Count[];
  fullBins: Bin[];
  onOpenSection?: (index: number) => void;
  onOpenBin: (b: Bin) => void;
  onOpenCount: (c: Count) => void;
}) {
  const used = BINS.filter((b) => b.material);
  const stockValue = used.reduce((n, b) => n + b.qty * material(b.material!).price, 0);
  const totalKg = used.reduce((n, b) => n + binLoad(b).kg, 0);
  const capacityKg = BINS.reduce((n, b) => n + b.maxKg, 0);

  const byType = STORAGE_TYPES.map((t) => ({
    label: t.name,
    value: BINS.filter((b) => b.type === t.code).reduce((n, b) => n + binLoad(b).kg, 0),
    swatch: typeSwatch(t.code),
  })).filter((s) => s.value > 0);

  const varianceValueTotal = offCount.reduce((n, c) => n + varianceValue(c), 0);

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
        title="ภาพรวมคลังสินค้า"
        meta={`${WAREHOUSE.code} ${WAREHOUSE.name} · ${BINS.length} ช่องเก็บ · ข้อมูล ณ ${TODAY}`}
        right={
          onOpenSection ? (
            <Button variant="primary" icon={<Grid2x2 size={15} />} onClick={() => onOpenSection(0)}>
              เปิดผังคลัง
            </Button>
          ) : undefined
        }
      />

      <Reveal>
        <div className="grid gap-3 xl:grid-cols-3">
          <Card
            className="xl:col-span-2"
            title={<span className="flex items-center gap-2"><Warehouse size={15} className="text-slate-400" />การใช้พื้นที่จัดเก็บ</span>}
            action={seeAll(0)}
          >
            <div className="p-4">
              <p className="text-[32px] font-semibold leading-none tabular-nums text-slate-900 dark:text-slate-50">
                {Math.round(totalKg).toLocaleString("th-TH")} กก.
              </p>
              <p className="mt-1.5 text-[12.5px] text-slate-500 dark:text-slate-400">
                จากเพดานรวม {capacityKg.toLocaleString("th-TH")} กก. · ใช้ช่องอยู่ {used.length} จาก {BINS.length} ช่อง ·
                มูลค่าของในคลัง {baht(stockValue)}
              </p>
              <div className="mt-4 space-y-2.5">
                {STORAGE_TYPES.map((t) => {
                  const list = BINS.filter((b) => b.type === t.code);
                  const kg = list.reduce((n, b) => n + binLoad(b).kg, 0);
                  const max = list.reduce((n, b) => n + b.maxKg, 0);
                  return (
                    <div key={t.code} className="flex items-center gap-3">
                      <span className="flex w-36 shrink-0 items-center gap-1.5 text-[12.5px] text-slate-600 dark:text-slate-300">
                        <Dot className={typeSwatch(t.code).dot} />
                        {t.name}
                      </span>
                      <span className="min-w-0 flex-1">
                        <Bar pct={(kg / max) * 100} tone={kg / max > 0.8 ? "warn" : "ok"} width="w-full" />
                      </span>
                      <span className="w-36 shrink-0 text-right text-[11.5px] tabular-nums text-slate-500 dark:text-slate-400">
                        {Math.round(kg).toLocaleString("th-TH")} / {max.toLocaleString("th-TH")} กก.
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>

          <Card
            title={<span className="flex items-center gap-2"><TriangleAlert size={15} className="text-slate-400" />งานค้างในคลัง</span>}
            action={seeAll(1)}
          >
            <div className="space-y-2.5 p-4">
              {[
                { icon: <Import size={15} />, label: "รอจัดเก็บเข้าช่อง", value: waitingIn, unit: "ใบ", tone: "warn" as const, to: 1 },
                { icon: <PackageOpen size={15} />, label: "รอหยิบของ", value: waitingPick, unit: "ใบ", tone: "info" as const, to: 2 },
                { icon: <Weight size={15} />, label: "ช่องที่ใกล้เต็ม", value: fullBins.length, unit: "ช่อง", tone: "warn" as const, to: 0 },
                { icon: <ClipboardCheck size={15} />, label: "ตรวจนับพบผลต่าง", value: offCount.length, unit: "ช่อง", tone: "bad" as const, to: 4 },
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
              {offCount.length > 0 && (
                <Note tone={varianceValueTotal < 0 ? "bad" : "warn"}>
                  ผลต่างจากการตรวจนับคิดเป็น {baht(Math.abs(varianceValueTotal))}
                  {varianceValueTotal < 0 ? " ที่หายไปจากคลัง" : " ที่นับได้เกินจากที่ระบบบันทึกไว้"}
                </Note>
              )}
            </div>
          </Card>
        </div>
      </Reveal>

      <Reveal delay={0.08} className="mt-3">
        <div className="grid gap-3 xl:grid-cols-3">
          <Card title={<span className="flex items-center gap-2"><Layers size={15} className="text-slate-400" />น้ำหนักตามพื้นที่</span>}>
            <div className="p-4">
              <Donut
                segments={byType}
                size={128}
                format={(n) => Math.round(n).toLocaleString("th-TH") + " กก."}
                center={
                  <span>
                    <span className="block text-[18px] font-semibold leading-none tabular-nums text-slate-900 dark:text-slate-50">
                      {Math.round((totalKg / capacityKg) * 100)}%
                    </span>
                    <span className="mt-1 block text-[10.5px] uppercase tracking-wide text-slate-400">ของเพดาน</span>
                  </span>
                }
              />
            </div>
          </Card>

          <Card
            className="xl:col-span-2"
            title={<span className="flex items-center gap-2"><Weight size={15} className="text-slate-400" />ช่องเก็บที่รับน้ำหนักมากที่สุด</span>}
            subtitle="ช่องที่เกิน 80% ของเพดานควรย้ายของบางส่วนลงพื้นที่เก็บกอง"
            action={seeAll(3)}
          >
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {[...used]
                .sort((a, b) => binLoad(b).pct - binLoad(a).pct)
                .slice(0, 6)
                .map((b) => {
                  const l = binLoad(b);
                  return (
                    <li key={b.code} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                      <Dot className={typeSwatch(b.type).dot} />
                      <button onClick={() => onOpenBin(b)} className="w-28 shrink-0 text-left font-mono text-[12px] text-slate-600 transition hover:text-violet-700 dark:text-slate-300">
                        {b.code}
                      </button>
                      <span className="w-48 shrink-0 truncate text-[13px] text-slate-900 dark:text-slate-50">
                        {material(b.material!).name}
                      </span>
                      <span className="min-w-0 flex-1">
                        <Bar pct={Math.min(100, l.pct)} tone={l.full ? "bad" : l.pct >= 80 ? "warn" : "ok"} width="w-full" />
                      </span>
                      <span className="w-40 shrink-0 text-right text-[11.5px] tabular-nums text-slate-500 dark:text-slate-400">
                        {Math.round(l.kg).toLocaleString("th-TH")} / {b.maxKg.toLocaleString("th-TH")} กก.
                      </span>
                    </li>
                  );
                })}
            </ul>
          </Card>
        </div>
      </Reveal>

      <Reveal delay={0.16} className="mt-3">
        <Card
          title={<span className="flex items-center gap-2"><ClipboardCheck size={15} className="text-slate-400" />ผลการตรวจนับล่าสุด</span>}
          subtitle="ผลต่างตีเป็นเงินด้วยราคาต่อหน่วยจากแฟ้มวัสดุ"
          action={seeAll(4)}
        >
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {COUNTS.map((c) => {
              const diff = variance(c);
              return (
                <li key={c.bin} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                  <span className={"grid size-8 shrink-0 place-items-center rounded-full " + (diff === 0 ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300" : diff < 0 ? "bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300" : "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300")}>
                    {diff === 0 ? <CircleCheck size={14} /> : diff < 0 ? <TrendingDown size={14} /> : <TrendingUp size={14} />}
                  </span>
                  <button onClick={() => onOpenCount(c)} className="w-28 shrink-0 text-left font-mono text-[12px] text-slate-600 transition hover:text-violet-700 dark:text-slate-300">
                    {c.bin}
                  </button>
                  <span className="min-w-0 flex-1 truncate text-[13px] text-slate-900 dark:text-slate-50">
                    {material(c.material).name}
                  </span>
                  <span className="shrink-0 text-[11.5px] tabular-nums text-slate-400">
                    ระบบ {c.system} · นับได้ {c.counted}
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5 text-[11.5px] text-slate-400">
                    <Avatar name={c.by} size="sm" />
                    {c.date}
                  </span>
                  <Badge tone={diff === 0 ? "ok" : diff < 0 ? "bad" : "warn"}>
                    {diff === 0 ? "ตรงกัน" : `${diff > 0 ? "+" : ""}${diff} · ${baht(Math.abs(varianceValue(c)))}`}
                  </Badge>
                </li>
              );
            })}
          </ul>
        </Card>
      </Reveal>
    </div>
  );
}

/* ---------------------------------------------------------------- layout */

function Layout({
  rows,
  q,
  setQ,
  type,
  setType,
  onOpen,
}: {
  rows: Bin[];
  q: string;
  setQ: (v: string) => void;
  type: string;
  setType: (v: string) => void;
  onOpen: (b: Bin) => void;
}) {
  const [view, setView] = useState("ตาราง");

  const columns: Column<Bin>[] = [
    {
      key: "code",
      header: "ช่องเก็บ",
      width: "16%",
      sort: (a, b) => a.code.localeCompare(b.code),
      cell: (b) => (
        <span className="flex items-center gap-2">
          <Dot className={typeSwatch(b.type).dot} />
          <span className="font-mono text-[12.5px] text-slate-900 dark:text-slate-50">{b.code}</span>
        </span>
      ),
    },
    {
      key: "type",
      header: "พื้นที่",
      width: "18%",
      sort: (a, b) => TYPE_CODES.indexOf(a.type) - TYPE_CODES.indexOf(b.type),
      cell: (b) => <Tag swatch={typeSwatch(b.type)}>{storageType(b.type).name}</Tag>,
    },
    {
      key: "material",
      header: "ของที่เก็บ",
      width: "26%",
      cell: (b) =>
        b.material ? (
          <span className="text-slate-900 dark:text-slate-50">{material(b.material).name}</span>
        ) : (
          <span className="text-slate-400">ช่องว่าง</span>
        ),
    },
    {
      key: "qty",
      header: "จำนวน",
      align: "right",
      width: "12%",
      sort: (a, b) => a.qty - b.qty,
      cell: (b) => (
        <span className="tabular-nums text-slate-700 dark:text-slate-200">
          {b.material ? `${b.qty} ${material(b.material).unit}` : "—"}
        </span>
      ),
    },
    {
      key: "load",
      header: "น้ำหนักเทียบเพดาน",
      width: "28%",
      sort: (a, b) => binLoad(a).pct - binLoad(b).pct,
      cell: (b) => {
        const l = binLoad(b);
        return (
          <span className="flex items-center gap-2">
            <Bar pct={Math.min(100, l.pct)} tone={l.full ? "bad" : l.pct >= 80 ? "warn" : "ok"} width="w-24" />
            <span className="text-[11px] tabular-nums text-slate-400">{b.maxKg.toLocaleString("th-TH")} กก.</span>
          </span>
        );
      },
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented options={["ตาราง", "ผังพื้นที่"]} value={view} onChange={setView} />
        <span className="ml-auto flex items-center gap-3 text-[11.5px] text-slate-500 dark:text-slate-400">
          {STORAGE_TYPES.map((t) => (
            <span key={t.code} className="flex items-center gap-1.5">
              <Dot className={typeSwatch(t.code).dot} />
              {t.name}
            </span>
          ))}
        </span>
      </div>

      {view === "ตาราง" ? (
        <DataTable
          rows={rows}
          columns={columns}
          getId={(b) => b.code}
          onOpen={onOpen}
          toolbar={
            <div className="flex flex-wrap items-center gap-2">
              <Search value={q} onChange={setQ} placeholder="ค้นหารหัสช่องหรือชื่อของ" icon={<SearchIcon size={14} />} />
              <Select value={type} onChange={setType} options={["ทุกพื้นที่", ...TYPE_CODES]} />
              <span className="ml-auto text-[12px] text-slate-400">
                แสดง {rows.length} ช่อง · ว่าง {rows.filter((b) => !b.material).length} ช่อง
              </span>
            </div>
          }
        />
      ) : (
        <div className="space-y-3">
          {STORAGE_TYPES.map((t) => {
            const list = BINS.filter((b) => b.type === t.code);
            const sw = typeSwatch(t.code);
            return (
              <Card
                key={t.code}
                title={
                  <span className="flex items-center gap-2">
                    <span className={"grid size-7 place-items-center rounded-lg " + sw.tint}>{TYPE_ICON[t.code]}</span>
                    {t.name}
                  </span>
                }
                subtitle={t.purpose}
                action={<Chip>{list.length} ช่อง</Chip>}
              >
                <div className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {list.map((b) => {
                    const l = binLoad(b);
                    return (
                      <button
                        key={b.code}
                        onClick={() => onOpen(b)}
                        className={
                          "rounded-xl border p-3 text-left transition " +
                          (b.material
                            ? "border-slate-200 bg-white hover:border-violet-300 dark:border-slate-700 dark:bg-slate-900"
                            : "border-dashed border-slate-300 bg-slate-50 hover:border-violet-300 dark:border-slate-700 dark:bg-slate-800/40")
                        }
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-[12px] text-slate-900 dark:text-slate-50">{b.code}</span>
                          {b.material ? (
                            <Badge tone={l.full ? "bad" : l.pct >= 80 ? "warn" : "ok"}>{l.pct}%</Badge>
                          ) : (
                            <Badge tone="idle">ว่าง</Badge>
                          )}
                        </div>
                        <p className="mt-1.5 truncate text-[12.5px] text-slate-700 dark:text-slate-200">
                          {b.material ? material(b.material).name : "ยังไม่มีของ"}
                        </p>
                        <p className="mt-0.5 text-[11px] tabular-nums text-slate-400">
                          {b.material ? `${b.qty} ${material(b.material).unit} · ${Math.round(l.kg)} กก.` : `เพดาน ${b.maxKg} กก.`}
                        </p>
                        <div className="mt-2">
                          <Bar pct={Math.min(100, l.pct)} tone={l.full ? "bad" : l.pct >= 80 ? "warn" : "ok"} width="w-full" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- inbound */

function Inbound({
  statusOf,
  onStore,
}: {
  statusOf: (no: string, seed: string) => string;
  onStore: (i: (typeof INBOUND)[number]) => void;
}) {
  return (
    <div className="space-y-3">
      <StatStrip
        title="การรับเข้าและจัดเก็บ"
        icon={<Import size={15} />}
        cells={[
          { icon: <Import size={13} />, label: "ใบสั่งจัดเก็บ", value: INBOUND.length + " ใบ", sub: "ของที่มาถึงท่ารับแล้ว" },
          { icon: <PackageCheck size={13} />, label: "จัดเก็บแล้ว", value: INBOUND.filter((i) => statusOf(i.no, i.status) === "จัดเก็บแล้ว").length + " ใบ", sub: "เข้าช่องเรียบร้อย", tone: "ok" },
          { icon: <TriangleAlert size={13} />, label: "รอจัดเก็บ", value: INBOUND.filter((i) => statusOf(i.no, i.status) === "รอจัดเก็บ").length + " ใบ", sub: "ยังค้างอยู่ที่ท่ารับ", tone: "warn" },
          { icon: <Grid2x2 size={13} />, label: "ช่องที่ยังรับได้", value: BINS.filter((b) => !b.material || binLoad(b).pct < 80).length + " ช่อง", sub: "ยังไม่ถึง 80% ของเพดาน", tone: "info" },
        ]}
      />

      <Card
        title={<span className="flex items-center gap-2"><Import size={15} className="text-slate-400" />ใบสั่งจัดเก็บ</span>}
        subtitle="ระบบเสนอช่องเก็บจากพื้นที่ที่ยังรับน้ำหนักได้ พร้อมช่องสำรองให้เลือก"
      >
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {INBOUND.map((i) => {
            const status = statusOf(i.no, i.status);
            const target = bin(i.suggestBin);
            const l = binLoad(target);
            const alternatives = freeBins(target.type).filter((b) => b.code !== target.code);
            return (
              <li key={i.no} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="w-28 shrink-0 font-mono text-[12px] text-slate-500 dark:text-slate-400">{i.no}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-slate-900 dark:text-slate-50">
                      {material(i.material).name}
                    </span>
                    <span className="block text-[11.5px] text-slate-400">
                      {i.qty} {material(i.material).unit} · มาจากท่ารับ {i.from}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <Tag swatch={typeSwatch(target.type)}>{storageType(target.type).name}</Tag>
                    <span className="font-mono text-[12px] text-slate-700 dark:text-slate-200">{i.suggestBin}</span>
                  </span>
                  <span className="w-28 shrink-0">
                    <Bar pct={Math.min(100, l.pct)} tone={l.pct >= 80 ? "warn" : "ok"} width="w-full" />
                  </span>
                  <Badge tone={status === "จัดเก็บแล้ว" ? "ok" : "warn"} dot>{status}</Badge>
                  {status === "รอจัดเก็บ" && (
                    <Button variant="primary" onClick={() => onStore(i)}>
                      จัดเก็บ
                    </Button>
                  )}
                </div>
                {status === "รอจัดเก็บ" && alternatives.length > 0 && (
                  <p className="mt-1.5 pl-[7.5rem] text-[11.5px] text-slate-400">
                    ช่องสำรองที่ยังรับไหว: {alternatives.map((b) => b.code).join(" · ")}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}

/* --------------------------------------------------------------- picking */

function Picking({
  statusOf,
  onPick,
}: {
  statusOf: (no: string, seed: string) => string;
  onPick: (no: string) => void;
}) {
  // Sorting by bin code is the whole point: one walk instead of doubling back.
  const route = [...PICKS].sort((a, b) => a.bin.localeCompare(b.bin));
  const waiting = route.filter((p) => statusOf(p.no, p.status) === "รอหยิบ");

  return (
    <div className="space-y-3">
      <StatStrip
        title="การหยิบของและจ่ายออก"
        icon={<PackageOpen size={15} />}
        cells={[
          { icon: <PackageOpen size={13} />, label: "ใบสั่งหยิบ", value: PICKS.length + " ใบ", sub: "อ้างถึงใบส่งของหรือใบสั่งผลิต" },
          { icon: <CircleCheck size={13} />, label: "หยิบแล้ว", value: (PICKS.length - waiting.length) + " ใบ", sub: "ย้ายไปพื้นที่จ่ายออกแล้ว", tone: "ok" },
          { icon: <TriangleAlert size={13} />, label: "รอหยิบ", value: waiting.length + " ใบ", sub: "ยังไม่ได้เดินหยิบ", tone: waiting.length > 0 ? "warn" : "ok" },
          { icon: <MapPin size={13} />, label: "ช่องที่ต้องแวะ", value: new Set(waiting.map((p) => p.bin)).size + " ช่อง", sub: "เรียงตามลำดับช่องให้เดินรอบเดียว", tone: "info" },
        ]}
      />

      <Card
        title={<span className="flex items-center gap-2"><PackageOpen size={15} className="text-slate-400" />ใบสั่งหยิบ</span>}
        subtitle="เรียงตามลำดับช่องเก็บ เพื่อให้เดินหยิบรอบเดียวจบ"
      >
        <ol className="divide-y divide-slate-100 dark:divide-slate-800">
          {route.map((p, i) => {
            const status = statusOf(p.no, p.status);
            const b = bin(p.bin);
            return (
              <li key={p.no} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className={"grid size-8 shrink-0 place-items-center rounded-full text-[12px] font-semibold " + (status === "หยิบแล้ว" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" : typeSwatch(b.type).tint)}>
                  {status === "หยิบแล้ว" ? <CircleCheck size={15} /> : i + 1}
                </span>
                <span className="w-28 shrink-0 font-mono text-[12px] text-slate-500 dark:text-slate-400">{p.no}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-slate-900 dark:text-slate-50">
                    {material(p.material).name}
                  </span>
                  <span className="block text-[11.5px] text-slate-400">
                    {p.qty} {material(p.material).unit} · เอกสารต้นเรื่อง {p.ref}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5 font-mono text-[12px] text-slate-700 dark:text-slate-200">
                  <MapPin size={12} className="text-slate-400" />
                  {p.bin}
                  <ArrowRight size={12} className="text-slate-300" />
                  {p.to}
                </span>
                <Badge tone={status === "หยิบแล้ว" ? "ok" : "warn"} dot>{status}</Badge>
                {status === "รอหยิบ" && (
                  <Button variant="secondary" onClick={() => onPick(p.no)}>
                    บันทึกว่าหยิบแล้ว
                  </Button>
                )}
              </li>
            );
          })}
        </ol>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------- transfers */

function Transfers() {
  return (
    <div className="space-y-3">
      <Card
        title={<span className="flex items-center gap-2"><ArrowRightLeft size={15} className="text-slate-400" />ใบย้ายของภายในคลัง</span>}
        subtitle="ย้ายเพื่อเติมช่องหยิบ หรือเพื่อลดน้ำหนักในช่องที่ใกล้เต็ม"
      >
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {TRANSFERS.map((t) => {
            const from = bin(t.from);
            const to = bin(t.to);
            return (
              <li key={t.no} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="w-28 shrink-0 font-mono text-[12px] text-slate-500 dark:text-slate-400">{t.no}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-slate-900 dark:text-slate-50">
                    {material(t.material).name}
                  </span>
                  <span className="block truncate text-[11.5px] text-slate-400">{t.reason}</span>
                </span>
                <span className="shrink-0 text-[12.5px] tabular-nums text-slate-600 dark:text-slate-300">
                  {t.qty} {material(t.material).unit}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="flex items-center gap-1.5">
                    <Dot className={typeSwatch(from.type).dot} />
                    <span className="font-mono text-[12px] text-slate-700 dark:text-slate-200">{t.from}</span>
                  </span>
                  <ArrowRight size={13} className="text-slate-300" />
                  <span className="flex items-center gap-1.5">
                    <Dot className={typeSwatch(to.type).dot} />
                    <span className="font-mono text-[12px] text-slate-700 dark:text-slate-200">{t.to}</span>
                  </span>
                </span>
                <span className="w-24 shrink-0 text-right text-[11.5px] tabular-nums text-slate-400">{t.date}</span>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card
        title={<span className="flex items-center gap-2"><Weight size={15} className="text-slate-400" />ช่องที่ควรย้ายของออก</span>}
        subtitle="เกิน 80% ของเพดานน้ำหนัก ระบบเสนอช่องปลายทางที่ยังรับไหว"
      >
        {BINS.filter((b) => b.material && binLoad(b).pct >= 80).length === 0 ? (
          <p className="py-10 text-center text-[12.5px] text-slate-400">ทุกช่องยังรับน้ำหนักได้ตามปกติ</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {BINS.filter((b) => b.material && binLoad(b).pct >= 80).map((b) => {
              const l = binLoad(b);
              const targets = freeBins("BLK").filter((x) => x.code !== b.code);
              return (
                <li key={b.code} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                  <Dot className={typeSwatch(b.type).dot} />
                  <span className="w-28 shrink-0 font-mono text-[12px] text-slate-700 dark:text-slate-200">{b.code}</span>
                  <span className="w-48 shrink-0 truncate text-[13px] text-slate-900 dark:text-slate-50">
                    {material(b.material!).name}
                  </span>
                  <span className="min-w-0 flex-1">
                    <Bar pct={Math.min(100, l.pct)} tone={l.full ? "bad" : "warn"} width="w-full" />
                  </span>
                  <span className="w-44 shrink-0 text-right text-[11.5px] text-slate-400">
                    {targets.length > 0 ? `ย้ายไป ${targets[0].code} ได้` : "ยังไม่มีช่องปลายทางที่ว่างพอ"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

/* -------------------------------------------------------------- counting */

function Counting({ onOpen }: { onOpen: (c: Count) => void }) {
  const off = COUNTS.filter((c) => variance(c) !== 0);
  const net = COUNTS.reduce((n, c) => n + varianceValue(c), 0);

  return (
    <div className="space-y-3">
      <StatStrip
        title="ผลการตรวจนับ"
        icon={<ClipboardCheck size={15} />}
        cells={[
          { icon: <ClipboardCheck size={13} />, label: "ช่องที่ตรวจนับ", value: COUNTS.length + " ช่อง", sub: "รอบล่าสุด" },
          { icon: <CircleCheck size={13} />, label: "ตรงกับระบบ", value: (COUNTS.length - off.length) + " ช่อง", sub: "ไม่ต้องปรับปรุงยอด", tone: "ok" },
          { icon: <CircleX size={13} />, label: "พบผลต่าง", value: off.length + " ช่อง", sub: "ต้องหาสาเหตุก่อนปรับยอด", tone: off.length > 0 ? "bad" : "ok" },
          { icon: <Coins size={13} />, label: "ผลต่างสุทธิ", value: baht(net), sub: net < 0 ? "มูลค่าที่หายไปจากคลัง" : "มูลค่าที่นับได้เกิน", tone: net < 0 ? "bad" : "warn" },
        ]}
      />

      <Card
        title={<span className="flex items-center gap-2"><Scale size={15} className="text-slate-400" />ผลตรวจนับ</span>}
        subtitle="เทียบจำนวนที่นับได้จริงกับจำนวนที่ระบบบันทึกไว้ กดที่แถวเพื่อดูวิธีคิดผลต่าง"
      >
        <table className="w-full text-[13px]">
          <thead className="bg-slate-50/80 text-left text-[11px] uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">ช่องเก็บ</th>
              <th className="px-4 py-3 font-medium">วัสดุ</th>
              <th className="px-4 py-3 text-right font-medium">ระบบบอก</th>
              <th className="px-4 py-3 text-right font-medium">นับได้จริง</th>
              <th className="px-4 py-3 text-right font-medium">ผลต่าง</th>
              <th className="px-4 py-3 text-right font-medium">คิดเป็นเงิน</th>
              <th className="px-4 py-3 font-medium">ผู้นับ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {COUNTS.map((c) => {
              const diff = variance(c);
              return (
                <tr
                  key={c.bin}
                  onClick={() => onOpen(c)}
                  className="cursor-pointer transition hover:bg-slate-50 dark:hover:bg-slate-800/40"
                >
                  <td className="px-4 py-2.5 font-mono text-[12px] text-slate-600 dark:text-slate-300">{c.bin}</td>
                  <td className="px-4 py-2.5 text-slate-900 dark:text-slate-50">{material(c.material).name}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-300">{c.system}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-900 dark:text-slate-50">{c.counted}</td>
                  <td className={"px-4 py-2.5 text-right font-semibold tabular-nums " + (diff === 0 ? "text-slate-300 dark:text-slate-600" : diff < 0 ? "text-rose-600 dark:text-rose-400" : "text-amber-700 dark:text-amber-400")}>
                    {diff === 0 ? "—" : (diff > 0 ? "+" : "") + diff}
                  </td>
                  <td className={"px-4 py-2.5 text-right tabular-nums " + (diff === 0 ? "text-slate-300 dark:text-slate-600" : "text-slate-700 dark:text-slate-200")}>
                    {diff === 0 ? "—" : baht(varianceValue(c))}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                      <Avatar name={c.by} size="sm" />
                      {c.by}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {off.length > 0 && (
        <Note tone="warn">
          ผลต่างที่พบยังไม่ถูกปรับเข้าสต็อก การปรับยอดควรทำหลังหาสาเหตุแล้ว เช่น หยิบเกิน บันทึกผิดช่อง
          หรือของเสียหายระหว่างจัดเก็บ
        </Note>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- records */

function BinRecord({ b }: { b: Bin }) {
  const [tab, setTab] = useState(BIN_TABS[0]);
  const l = binLoad(b);
  const t = storageType(b.type);
  const sw = typeSwatch(b.type);
  const picks = PICKS.filter((p) => p.bin === b.code);
  const moves = TRANSFERS.filter((x) => x.from === b.code || x.to === b.code);
  const count = COUNTS.find((c) => c.bin === b.code);
  const inbound = INBOUND.filter((i) => i.suggestBin === b.code);

  return (
    <div>
      <div className="flex flex-wrap items-start gap-4 border-b border-slate-100 px-5 pb-5 dark:border-slate-800">
        <span className={"grid size-14 shrink-0 place-items-center rounded-2xl " + sw.tint}>{TYPE_ICON[b.type]}</span>
        <div className="min-w-0 flex-1">
          <h2 className="font-mono text-[18px] font-semibold text-slate-900 dark:text-slate-50">{b.code}</h2>
          <p className="mt-0.5 text-[13px] text-slate-500 dark:text-slate-400">
            {WAREHOUSE.code} {WAREHOUSE.name} · {t.name}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Tag swatch={sw}>{t.name}</Tag>
            <Badge tone={!b.material ? "idle" : l.full ? "bad" : l.pct >= 80 ? "warn" : "ok"} dot>
              {!b.material ? "ช่องว่าง" : l.full ? "เกินเพดาน" : l.pct >= 80 ? "ใกล้เต็ม" : "รับได้อีก"}
            </Badge>
            <Chip>เพดาน {b.maxKg.toLocaleString("th-TH")} กก.</Chip>
          </div>
        </div>
      </div>

      <div className="px-5">
        <Tabs tabs={BIN_TABS} active={tab} onPick={setTab} icons={BIN_ICONS} id="bin" />
      </div>

      <div className="px-5 py-4">
        {tab === "สภาพช่อง" && (
          <div className="space-y-3">
            <Progress done={Math.round(l.kg)} total={b.maxKg} label={`รับน้ำหนักอยู่ ${Math.round(l.kg).toLocaleString("th-TH")} จากเพดาน ${b.maxKg.toLocaleString("th-TH")} กก.`} />
            <div className="space-y-1">
              <IconRow icon={<Warehouse size={14} />} label="พื้นที่จัดเก็บ">{t.name}</IconRow>
              <IconRow icon={<MapPin size={14} />} label="หน้าที่ของพื้นที่">{t.purpose}</IconRow>
              <IconRow icon={<Weight size={14} />} label="เพดานน้ำหนัก">{b.maxKg.toLocaleString("th-TH")} กก.</IconRow>
              <IconRow icon={<Scale size={14} />} label="น้ำหนักปัจจุบัน">{Math.round(l.kg).toLocaleString("th-TH")} กก.</IconRow>
            </div>
            <Note tone={!b.material ? "idle" : l.full ? "bad" : l.pct >= 80 ? "warn" : "ok"}>
              {!b.material
                ? "ช่องนี้ยังว่าง พร้อมรับของใหม่เต็มเพดาน"
                : l.full
                  ? `น้ำหนักเกินเพดานอยู่ ${Math.round(l.kg - b.maxKg)} กก. ต้องย้ายของบางส่วนออก`
                  : `ยังรับน้ำหนักเพิ่มได้อีก ${Math.round(b.maxKg - l.kg).toLocaleString("th-TH")} กก.`}
            </Note>
          </div>
        )}

        {tab === "ของที่เก็บอยู่" &&
          (b.material ? (
            <div className="space-y-3">
              <div className="space-y-1">
                <IconRow icon={<Package size={14} />} label="วัสดุ">{material(b.material).name}</IconRow>
                <IconRow icon={<Boxes size={14} />} label="จำนวน">{b.qty} {material(b.material).unit}</IconRow>
                <IconRow icon={<Weight size={14} />} label="น้ำหนักต่อหน่วย">{b.kgPerUnit} กก.</IconRow>
                <IconRow icon={<Coins size={14} />} label="มูลค่าของในช่อง">{baht(b.qty * material(b.material).price)}</IconRow>
              </div>
              {count && (
                <Note tone={variance(count) === 0 ? "ok" : "warn"}>
                  ตรวจนับล่าสุด {count.date} โดย{count.by} · {variance(count) === 0 ? "ตรงกับระบบ" : `ผลต่าง ${variance(count) > 0 ? "+" : ""}${variance(count)} คิดเป็น ${baht(varianceValue(count))}`}
                </Note>
              )}
            </div>
          ) : (
            <Note tone="idle">ช่องนี้ยังไม่มีของ ระบบจะเสนอช่องนี้เมื่อมีของเข้ามาที่พื้นที่{t.name}</Note>
          ))}

        {tab === "งานที่เกี่ยวข้อง" && (
          <div className="space-y-4">
            {inbound.length > 0 && (
              <div>
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-400">ใบสั่งจัดเก็บที่เล็งช่องนี้</p>
                <ul className="space-y-1.5">
                  {inbound.map((i) => (
                    <li key={i.no} className="flex items-center gap-3 text-[13px]">
                      <span className="font-mono text-[12px] text-slate-500 dark:text-slate-400">{i.no}</span>
                      <span className="min-w-0 flex-1 truncate text-slate-800 dark:text-slate-100">
                        {material(i.material).name} × {i.qty}
                      </span>
                      <Badge tone={i.status === "จัดเก็บแล้ว" ? "ok" : "warn"}>{i.status}</Badge>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div>
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-400">ใบสั่งหยิบจากช่องนี้</p>
              {picks.length === 0 ? (
                <p className="text-[12.5px] text-slate-400">ยังไม่มีงานหยิบจากช่องนี้</p>
              ) : (
                <ul className="space-y-1.5">
                  {picks.map((p) => (
                    <li key={p.no} className="flex items-center gap-3 text-[13px]">
                      <span className="font-mono text-[12px] text-slate-500 dark:text-slate-400">{p.no}</span>
                      <span className="min-w-0 flex-1 truncate text-slate-800 dark:text-slate-100">
                        {material(p.material).name} × {p.qty}
                      </span>
                      <span className="shrink-0 font-mono text-[11px] text-slate-400">{p.ref}</span>
                      <Badge tone={p.status === "หยิบแล้ว" ? "ok" : "warn"}>{p.status}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-400">การย้ายของที่เกี่ยวข้อง</p>
              {moves.length === 0 ? (
                <p className="text-[12.5px] text-slate-400">ยังไม่มีการย้ายของเข้าออกช่องนี้</p>
              ) : (
                <ul className="space-y-1.5">
                  {moves.map((m) => (
                    <li key={m.no} className="flex items-center gap-3 text-[13px]">
                      <span className="font-mono text-[12px] text-slate-500 dark:text-slate-400">{m.no}</span>
                      <span className="min-w-0 flex-1 truncate text-slate-800 dark:text-slate-100">{m.reason}</span>
                      <span className="shrink-0 font-mono text-[11px] text-slate-400">
                        {m.from} → {m.to}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CountRecord({ c }: { c: Count }) {
  const diff = variance(c);
  const m = material(c.material);
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <IconRow icon={<MapPin size={14} />} label="ช่องเก็บ">{c.bin}</IconRow>
        <IconRow icon={<Package size={14} />} label="วัสดุ">{m.name}</IconRow>
        <IconRow icon={<ClipboardCheck size={14} />} label="วันที่นับ">{c.date}</IconRow>
        <IconRow icon={<Avatar name={c.by} size="sm" />} label="ผู้นับ">{c.by}</IconRow>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "ระบบบอก", value: c.system + " " + m.unit },
          { label: "นับได้จริง", value: c.counted + " " + m.unit },
          { label: "ผลต่าง", value: diff === 0 ? "ไม่มี" : (diff > 0 ? "+" : "") + diff },
        ].map((x) => (
          <div key={x.label} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
            <div className="text-[11.5px] text-slate-500 dark:text-slate-400">{x.label}</div>
            <div className={"mt-1 text-[15px] font-semibold tabular-nums " + (x.label === "ผลต่าง" && diff !== 0 ? (diff < 0 ? "text-rose-600 dark:text-rose-400" : "text-amber-700 dark:text-amber-400") : "text-slate-900 dark:text-slate-50")}>
              {x.value}
            </div>
          </div>
        ))}
      </div>

      <Note tone={diff === 0 ? "ok" : diff < 0 ? "bad" : "warn"}>
        {diff === 0
          ? "จำนวนที่นับได้ตรงกับที่ระบบบันทึกไว้ ไม่ต้องปรับปรุงยอด"
          : `ผลต่าง ${Math.abs(diff)} ${m.unit} คิดด้วยราคาต่อหน่วย ${baht(m.price)} เป็นเงิน ${baht(Math.abs(varianceValue(c)))} ${diff < 0 ? "ที่หายไปจากคลัง" : "ที่นับได้เกินจากระบบ"}`}
      </Note>
    </div>
  );
}
