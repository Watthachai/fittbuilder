import { useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowRight, ArrowRightLeft, Boxes, CircleCheck, CircleX, ClipboardCheck, Coins, FileDown, Grid2x2,
  Import, Layers, MapPin, Package, PackageCheck, PackageOpen, Pencil, Plus, Printer, Scale, Search as SearchIcon,
  Send, TrendingDown, TrendingUp, Truck, TriangleAlert, Warehouse, Weight,
} from "lucide-react";
import { TODAY, material } from "../mm/data";
import {
  BINS, COUNTS, COUNT_SHEETS, GOODS_ISSUES, INBOUND, PICKS, STORAGE_TYPES, TRANSFERS, WAREHOUSE, available, baht, bin,
  binLoad, confirmPickList, countKey, freeBins, fullPickProblem, openVariances, pendingReceipts, pickLists, createPutawayTasks,
  reservedIn, storageType, variance, varianceValue,
} from "./data";
import type { Bin, Count } from "./data";
import { WM_CONFIRMS, WmDialogs } from "./forms";
import type { WmDialog } from "./forms";
import {
  Avatar, Badge, Bar, Button, Card, Chip, Donut, Dot, IconRow, Note, PageHead,
  Progress, Reveal, Search, Segmented, Select, StatStrip, Tabs, Tag, swatchFor,
} from "../ui";
import { DataTable, DetailModal, FormModal, downloadCsv, notify, useData } from "../kit";
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
  useData();
  const tab = section && TABS.includes(section) ? section : undefined;

  const [q, setQ] = useState("");
  const [type, setType] = useState("ทุกพื้นที่");
  const [openBinAt, setOpenBinAt] = useState<number | null>(null);
  const [openCount, setOpenCount] = useState<Count | null>(null);
  const [dialog, setDialog] = useState<WmDialog | null>(null);

  const needle = q.trim().toLowerCase();
  const binRows = BINS.filter(
    (b) =>
      (type === "ทุกพื้นที่" || b.type === type) &&
      (needle === "" ||
        [b.code, b.material ? material(b.material).name : ""].some((t) => t.toLowerCase().includes(needle)))
  );
  const pickedBin = openBinAt === null ? null : (binRows[openBinAt] ?? null);

  const waitingIn = INBOUND.filter((i) => i.status === "รอจัดเก็บ");
  const waitingPick = PICKS.filter((p) => p.status === "รอหยิบ");
  const offCount = openVariances();
  const fullBins = BINS.filter((b) => b.material && binLoad(b).pct >= 80);

  // A question about the record opens over it; a new task replaces it.
  const act = (d: WmDialog) => {
    if (!WM_CONFIRMS.includes(d.kind)) {
      setOpenBinAt(null);
      setOpenCount(null);
    }
    setDialog(d);
  };

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
        {pickedBin && <BinRecord key={pickedBin.code} b={pickedBin} onAct={act} />}
      </DetailModal>

      <FormModal
        open={openCount !== null}
        title="ผลการตรวจนับ"
        subtitle={openCount ? `${openCount.bin} · ${material(openCount.material).name}` : undefined}
        onClose={() => setOpenCount(null)}
        size="sm"
      >
        {openCount && <CountRecord c={openCount} onAct={act} />}
      </FormModal>

      <WmDialogs
        dialog={dialog}
        onClose={() => setDialog(null)}
        onSaved={(saved) => {
          setDialog(null);
          // A new pick list or count sheet is walked on paper: open it ready to print.
          if (saved.pickRef) setDialog({ kind: "print", doc: { type: "pick", ref: saved.pickRef } });
          else if (saved.sheet) setDialog({ kind: "print", doc: { type: "count", sheet: saved.sheet } });
        }}
      />
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

  const firstIn = waitingIn[0] ?? INBOUND[0];
  const firstPick = waitingPick[0] ?? PICKS[0];
  const staged = pickLists().find((l) => l.status === "หยิบครบ รอจ่ายออก") ?? pickLists()[0];
  const openSheet = COUNT_SHEETS.find((s) => s.status === "รอนับ") ?? COUNT_SHEETS[0];
  const toApprove = COUNTS.find((c) => c.status === "รออนุมัติ") ?? COUNTS[0];
  const toPost = COUNTS.find((c) => c.status === "อนุมัติแล้ว") ?? COUNTS[0];

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
          onAct={act}
        />
      )}
      {tab === "รับเข้าและจัดเก็บ" && <Inbound onAct={act} />}
      {tab === "หยิบสินค้าและจ่ายออก" && <Picking onAct={act} />}
      {tab === "ย้ายสินค้าภายในคลัง" && <Transfers onAct={act} />}
      {tab === "ตรวจนับสต็อก" && <Counting onOpen={setOpenCount} onAct={act} />}

      {panels}

      <div hidden data-fitt-index>
        <button data-fitt-screen="บริหารคลังสินค้า" />
        <button data-fitt-screen="ช่องเก็บ" data-fitt-modal onClick={() => setOpenBinAt(0)} />
        <button data-fitt-screen="เพิ่มช่องเก็บ" data-fitt-modal onClick={() => act({ kind: "bin" })} />
        <button data-fitt-screen="แก้ไขช่องเก็บ" data-fitt-modal onClick={() => act({ kind: "bin", bin: BINS[0] })} />
        <button data-fitt-screen="ยืนยันการจัดเก็บ" data-fitt-modal onClick={() => act({ kind: "putaway", task: firstIn })} />
        <button data-fitt-screen="สร้างใบหยิบสินค้า" data-fitt-modal onClick={() => act({ kind: "pickList" })} />
        <button data-fitt-screen="ยืนยันการหยิบ" data-fitt-modal onClick={() => act({ kind: "pick", task: firstPick })} />
        <button data-fitt-screen="ตัดจ่ายสินค้าออกจากคลัง" data-fitt-modal onClick={() => act({ kind: "issue", ref: staged.ref })} />
        <button data-fitt-screen="พิมพ์ใบหยิบสินค้า" data-fitt-modal onClick={() => act({ kind: "print", doc: { type: "pick", ref: PICKS[0].ref } })} />
        <button data-fitt-screen="ย้ายสินค้าภายในคลัง" data-fitt-modal onClick={() => act({ kind: "transfer" })} />
        <button data-fitt-screen="สร้างใบตรวจนับ" data-fitt-modal onClick={() => act({ kind: "countSheet" })} />
        <button data-fitt-screen="บันทึกผลตรวจนับ" data-fitt-modal onClick={() => act({ kind: "countEntry", sheet: openSheet })} />
        <button data-fitt-screen="พิมพ์ใบตรวจนับ" data-fitt-modal onClick={() => act({ kind: "print", doc: { type: "count", sheet: COUNT_SHEETS[0] } })} />
        <button data-fitt-screen="ผลการตรวจนับ" data-fitt-modal onClick={() => setOpenCount(COUNTS[0])} />
        <button data-fitt-screen="อนุมัติผลต่างจากการตรวจนับ" data-fitt-modal onClick={() => act({ kind: "approveCount", count: toApprove })} />
        <button data-fitt-screen="ปรับยอดตามผลตรวจนับ" data-fitt-modal onClick={() => act({ kind: "postCount", count: toPost })} />
      </div>
    </div>
  );
}

/** "ส่งออก Excel" — the same small secondary button on every register. */
function ExportButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="secondary" icon={<FileDown size={14} />} onClick={onClick}>
      ส่งออก Excel
    </Button>
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
                { icon: <Truck size={15} />, label: "ใบรับสินค้ารอสั่งจัดเก็บ", value: pendingReceipts().length, unit: "ใบ", tone: "warn" as const, to: 1 },
                { icon: <Import size={15} />, label: "รอจัดเก็บเข้าช่อง", value: waitingIn, unit: "ใบ", tone: "warn" as const, to: 1 },
                { icon: <PackageOpen size={15} />, label: "รอหยิบของ", value: waitingPick, unit: "ใบ", tone: "info" as const, to: 2 },
                { icon: <Weight size={15} />, label: "ช่องที่ใกล้เต็ม", value: fullBins.length, unit: "ช่อง", tone: "warn" as const, to: 0 },
                { icon: <ClipboardCheck size={15} />, label: "ผลต่างรออนุมัติหรือรอปรับยอด", value: offCount.length, unit: "ช่อง", tone: "bad" as const, to: 4 },
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
            {[...COUNTS].reverse().slice(0, 6).map((c) => {
              const diff = variance(c);
              return (
                <li key={countKey(c)} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
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
  onAct,
}: {
  rows: Bin[];
  q: string;
  setQ: (v: string) => void;
  type: string;
  setType: (v: string) => void;
  onOpen: (b: Bin) => void;
  onAct: (d: WmDialog) => void;
}) {
  useData();
  const [view, setView] = useState("ตาราง");
  const exportBins = () =>
    downloadCsv(
      "ผังช่องเก็บ",
      ["ช่องเก็บ", "พื้นที่", "วัสดุ", "จำนวน", "หน่วย", "น้ำหนัก (กก.)", "เพดาน (กก.)", "ใช้ไป (%)", "ล็อตเก่าสุด"],
      rows.map((b) => [
        b.code, storageType(b.type).name, b.material ? material(b.material).name : "ว่าง", b.qty, b.material ? material(b.material).unit : "",
        Math.round(binLoad(b).kg), b.maxKg, binLoad(b).pct, b.since ?? "",
      ])
    );

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
        <ExportButton onClick={exportBins} />
        <Button variant="primary" icon={<Plus size={14} />} onClick={() => onAct({ kind: "bin" })}>
          เพิ่มช่องเก็บ
        </Button>
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

function Inbound({ onAct }: { onAct: (d: WmDialog) => void }) {
  useData();
  const pending = pendingReceipts();
  const waiting = INBOUND.filter((i) => i.status === "รอจัดเก็บ");
  const rows = [...INBOUND].sort((a, b) => Number(a.status === "จัดเก็บแล้ว") - Number(b.status === "จัดเก็บแล้ว") || b.no.localeCompare(a.no));

  const issue = (grNo: string) => {
    const tasks = createPutawayTasks(grNo);
    notify(`ออกใบสั่งจัดเก็บจาก ${grNo} แล้ว · ${tasks.map((t) => t.no).join(", ")}`);
  };
  const exportTasks = () =>
    downloadCsv(
      "ใบสั่งจัดเก็บ",
      ["เลขที่", "ใบรับสินค้า", "วัสดุ", "จำนวน", "หน่วย", "จากท่ารับ", "ช่องที่เสนอ", "ช่องที่เก็บจริง", "สถานะ", "วันที่จัดเก็บ"],
      rows.map((i) => [i.no, i.gr ?? "", material(i.material).name, i.qty, material(i.material).unit, i.from, i.suggestBin, i.bin ?? "", i.status, i.doneAt ?? ""])
    );

  return (
    <div className="space-y-3">
      <StatStrip
        title="การรับเข้าและจัดเก็บ"
        icon={<Import size={15} />}
        cells={[
          { icon: <Truck size={13} />, label: "ใบรับสินค้ารอสั่งจัดเก็บ", value: pending.length + " ใบ", sub: "จัดซื้อรับของเข้ามาแล้ว", tone: pending.length > 0 ? "warn" : "ok" },
          { icon: <PackageCheck size={13} />, label: "จัดเก็บแล้ว", value: INBOUND.filter((i) => i.status === "จัดเก็บแล้ว").length + " ใบ", sub: "เข้าช่องเรียบร้อย", tone: "ok" },
          { icon: <TriangleAlert size={13} />, label: "รอจัดเก็บ", value: waiting.length + " ใบ", sub: "ยังค้างอยู่ที่ท่ารับ", tone: "warn" },
          { icon: <Grid2x2 size={13} />, label: "ช่องที่ยังรับได้", value: BINS.filter((b) => ["BLK", "PCK"].includes(b.type) && (!b.material || binLoad(b).pct < 80)).length + " ช่อง", sub: "ยังไม่ถึง 80% ของเพดาน", tone: "info" },
        ]}
      />

      <Card
        title={<span className="flex items-center gap-2"><Truck size={15} className="text-slate-400" />ใบรับสินค้าจากจัดซื้อ</span>}
        subtitle="จัดซื้อรับของเข้าที่ท่ารับแล้ว ออกใบสั่งจัดเก็บเพื่อบอกคนยกของว่าต้องเอาไปช่องไหน"
      >
        {pending.length === 0 ? (
          <p className="py-8 text-center text-[12.5px] text-slate-400">ไม่มีใบรับสินค้าที่รอสั่งจัดเก็บ</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {pending.map((g) => (
              <li key={g.no} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                <span className="w-32 shrink-0 font-mono text-[12px] text-slate-500 dark:text-slate-400">{g.no}</span>
                <span className="min-w-0 flex-1 truncate text-[13px] text-slate-900 dark:text-slate-50">
                  {g.lines.map((l) => `${material(l.material).name} × ${l.qty}`).join(" · ")}
                </span>
                <span className="shrink-0 text-[11.5px] tabular-nums text-slate-400">
                  {g.po} · {g.date}
                </span>
                <Button variant="primary" icon={<Import size={13} />} onClick={() => issue(g.no)}>
                  ออกใบสั่งจัดเก็บ
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card
        title={<span className="flex items-center gap-2"><Import size={15} className="text-slate-400" />ใบสั่งจัดเก็บ</span>}
        subtitle="ระบบเสนอช่องจากพื้นที่ที่ยังรับน้ำหนักไหว กดจัดเก็บเพื่อเลือกช่องจริงและยืนยัน"
        action={<ExportButton onClick={exportTasks} />}
      >
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {rows.map((i) => {
            const target = bin(i.bin ?? i.suggestBin);
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
                      {i.gr ? ` · ${i.gr}` : ""}
                      {i.doneAt ? ` · เก็บเมื่อ ${i.doneAt}` : ""}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <Tag swatch={typeSwatch(target.type)}>{storageType(target.type).name}</Tag>
                    <span className="font-mono text-[12px] text-slate-700 dark:text-slate-200">{target.code}</span>
                  </span>
                  <span className="w-28 shrink-0">
                    <Bar pct={Math.min(100, l.pct)} tone={l.pct >= 80 ? "warn" : "ok"} width="w-full" />
                  </span>
                  <Badge tone={i.status === "จัดเก็บแล้ว" ? "ok" : "warn"} dot>{i.status}</Badge>
                  {i.status === "รอจัดเก็บ" && (
                    <Button variant="primary" onClick={() => onAct({ kind: "putaway", task: i })}>
                      จัดเก็บ
                    </Button>
                  )}
                </div>
                {i.status === "รอจัดเก็บ" && alternatives.length > 0 && (
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

const LIST_TONE = { รอหยิบ: "warn", "หยิบครบ รอจ่ายออก": "info", จ่ายออกแล้ว: "ok" } as const;

function Picking({ onAct }: { onAct: (d: WmDialog) => void }) {
  useData();
  // Sorting by bin code is the whole point: one walk instead of doubling back.
  const route = PICKS.filter((p) => p.status === "รอหยิบ").sort((a, b) => a.bin.localeCompare(b.bin));
  const lists = pickLists();
  const done = PICKS.filter((p) => p.status !== "รอหยิบ");

  const confirmAll = (ref: string) => {
    const problem = fullPickProblem(ref);
    if (problem) {
      notify(problem, "warn");
      return;
    }
    confirmPickList(ref);
    notify(`ยืนยันหยิบครบทุกงานของ ${ref} แล้ว · พร้อมตัดจ่ายออก`);
  };
  const exportPicks = () =>
    downloadCsv(
      "งานหยิบสินค้า",
      ["เลขที่", "เอกสารต้นเรื่อง", "วัสดุ", "ต้องหยิบ", "หยิบได้จริง", "หน่วย", "จากช่อง", "ไป", "สถานะ", "ใบจ่ายสินค้า"],
      [...PICKS].reverse().map((p) => [p.no, p.ref, material(p.material).name, p.qty, p.picked ?? "", material(p.material).unit, p.bin, p.to, p.status, p.gi ?? ""])
    );

  return (
    <div className="space-y-3">
      <StatStrip
        title="การหยิบของและจ่ายออก"
        icon={<PackageOpen size={15} />}
        cells={[
          { icon: <PackageOpen size={13} />, label: "ใบหยิบสินค้า", value: lists.length + " ใบ", sub: "อ้างถึงใบส่งของหรือใบสั่งผลิต" },
          { icon: <TriangleAlert size={13} />, label: "รอหยิบ", value: route.length + " งาน", sub: "ยังไม่ได้เดินหยิบ", tone: route.length > 0 ? "warn" : "ok" },
          { icon: <Send size={13} />, label: "รอจ่ายออก", value: lists.filter((l) => l.status === "หยิบครบ รอจ่ายออก").length + " ใบ", sub: "หยิบครบ พักที่ท่าจ่าย", tone: "info" },
          { icon: <CircleCheck size={13} />, label: "จ่ายออกแล้ว", value: GOODS_ISSUES.length + " ใบ", sub: "ตัดออกจากคลังแล้ว", tone: "ok" },
        ]}
      />

      <Card
        title={<span className="flex items-center gap-2"><ClipboardCheck size={15} className="text-slate-400" />ใบหยิบสินค้า</span>}
        subtitle="หนึ่งใบต่อหนึ่งเอกสารต้นเรื่อง พิมพ์ไปเดินหยิบ ยืนยันผล แล้วตัดจ่ายออก"
        action={
          <span className="flex gap-2">
            <ExportButton onClick={exportPicks} />
            <Button variant="primary" icon={<Plus size={14} />} onClick={() => onAct({ kind: "pickList" })}>
              สร้างใบหยิบสินค้า
            </Button>
          </span>
        }
      >
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {lists.map((l) => {
            const short = l.tasks.filter((t) => t.picked !== undefined && t.picked < t.qty).length;
            return (
              <li key={l.ref} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="w-32 shrink-0 font-mono text-[12px] text-slate-700 dark:text-slate-200">{l.ref}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] text-slate-900 dark:text-slate-50">
                    {l.tasks.map((t) => `${material(t.material).name} × ${t.qty}`).join(" · ")}
                  </span>
                  <span className="block text-[11.5px] text-slate-400">
                    {l.tasks.length} งาน · ช่อง {[...new Set(l.tasks.map((t) => t.bin))].join(" → ")}
                    {short > 0 && ` · หยิบขาด ${short} งาน`}
                    {l.gi && ` · ${l.gi}`}
                  </span>
                </span>
                <Badge tone={LIST_TONE[l.status]} dot>{l.status}</Badge>
                <span className="flex shrink-0 gap-1.5">
                  <Button variant="ghost" icon={<Printer size={13} />} onClick={() => onAct({ kind: "print", doc: { type: "pick", ref: l.ref } })}>
                    พิมพ์
                  </Button>
                  {l.status === "รอหยิบ" && (
                    <Button variant="secondary" onClick={() => confirmAll(l.ref)}>
                      ยืนยันหยิบครบ
                    </Button>
                  )}
                  {l.status === "หยิบครบ รอจ่ายออก" && (
                    <Button variant="primary" icon={<Send size={13} />} onClick={() => onAct({ kind: "issue", ref: l.ref })}>
                      ตัดจ่ายออก
                    </Button>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card
        title={<span className="flex items-center gap-2"><MapPin size={15} className="text-slate-400" />เส้นทางหยิบ</span>}
        subtitle="งานที่ยังไม่หยิบ เรียงตามลำดับช่องเก็บ เพื่อให้เดินหยิบรอบเดียวจบ"
      >
        {route.length === 0 ? (
          <p className="py-8 text-center text-[12.5px] text-slate-400">ไม่มีงานรอหยิบ</p>
        ) : (
          <ol className="divide-y divide-slate-100 dark:divide-slate-800">
            {route.map((p, i) => {
              const b = bin(p.bin);
              const inBin = b.material === p.material ? b.qty : 0;
              return (
                <li key={p.no} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <span className={"grid size-8 shrink-0 place-items-center rounded-full text-[12px] font-semibold " + typeSwatch(b.type).tint}>{i + 1}</span>
                  <span className="w-28 shrink-0 font-mono text-[12px] text-slate-500 dark:text-slate-400">{p.no}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-slate-900 dark:text-slate-50">
                      {material(p.material).name}
                    </span>
                    <span className="block text-[11.5px] text-slate-400">
                      {p.qty} {material(p.material).unit} · เอกสารต้นเรื่อง {p.ref}
                      {inBin < p.qty && <span className="text-rose-600 dark:text-rose-400"> · ในช่องมีแค่ {inBin}</span>}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5 font-mono text-[12px] text-slate-700 dark:text-slate-200">
                    <MapPin size={12} className="text-slate-400" />
                    {p.bin}
                    <ArrowRight size={12} className="text-slate-300" />
                    {p.to}
                  </span>
                  <Button variant="secondary" onClick={() => onAct({ kind: "pick", task: p })}>
                    บันทึกว่าหยิบแล้ว
                  </Button>
                </li>
              );
            })}
          </ol>
        )}
      </Card>

      {done.length > 0 && (
        <Card title={<span className="flex items-center gap-2"><CircleCheck size={15} className="text-slate-400" />หยิบแล้ว</span>}>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {[...done].reverse().map((p) => (
              <li key={p.no} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-[13px]">
                <span className="w-28 shrink-0 font-mono text-[12px] text-slate-500 dark:text-slate-400">{p.no}</span>
                <span className="min-w-0 flex-1 truncate text-slate-800 dark:text-slate-100">
                  {material(p.material).name} {p.picked ?? p.qty}/{p.qty} {material(p.material).unit}
                </span>
                <span className="shrink-0 font-mono text-[11.5px] text-slate-400">
                  {p.bin} → {p.to} · {p.ref}
                </span>
                <Badge tone={p.status === "จ่ายออกแล้ว" ? "ok" : "info"}>{p.status}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- transfers */

function Transfers({ onAct }: { onAct: (d: WmDialog) => void }) {
  useData();
  const heavy = BINS.filter((b) => b.material && binLoad(b).pct >= 80);
  const exportTransfers = () =>
    downloadCsv(
      "ใบย้ายของภายในคลัง",
      ["เลขที่", "วันที่", "วัสดุ", "จำนวน", "หน่วย", "จากช่อง", "ไปช่อง", "เหตุผล"],
      [...TRANSFERS].reverse().map((t) => [t.no, t.date, material(t.material).name, t.qty, material(t.material).unit, t.from, t.to, t.reason])
    );

  return (
    <div className="space-y-3">
      <Card
        title={<span className="flex items-center gap-2"><ArrowRightLeft size={15} className="text-slate-400" />ใบย้ายของภายในคลัง</span>}
        subtitle="ย้ายเพื่อเติมช่องหยิบ หรือเพื่อลดน้ำหนักในช่องที่ใกล้เต็ม"
        action={
          <span className="flex gap-2">
            <ExportButton onClick={exportTransfers} />
            <Button variant="primary" icon={<ArrowRightLeft size={14} />} onClick={() => onAct({ kind: "transfer" })}>
              ย้ายสินค้า
            </Button>
          </span>
        }
      >
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {[...TRANSFERS].reverse().map((t) => {
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
        subtitle="เกิน 80% ของเพดานน้ำหนัก ระบบเสนอช่องปลายทางที่ยังรับไหว กดย้ายของได้ทันที"
      >
        {heavy.length === 0 ? (
          <p className="py-10 text-center text-[12.5px] text-slate-400">ทุกช่องยังรับน้ำหนักได้ตามปกติ</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {heavy.map((b) => {
              const l = binLoad(b);
              const targets = BINS.filter((x) => x.code !== b.code && ["BLK", "PCK"].includes(x.type) && (x.material === null || x.material === b.material) && binLoad(x).pct < 80);
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
                  <Button
                    variant="secondary"
                    icon={<ArrowRightLeft size={13} />}
                    disabled={available(b) === 0}
                    onClick={() => onAct({ kind: "transfer", from: b.code, to: targets[0]?.code })}
                  >
                    ย้ายของ
                  </Button>
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

const COUNT_TONE = { ตรงกัน: "ok", รออนุมัติ: "warn", อนุมัติแล้ว: "info", ปรับยอดแล้ว: "idle" } as const;

function Counting({ onOpen, onAct }: { onOpen: (c: Count) => void; onAct: (d: WmDialog) => void }) {
  useData();
  const open = openVariances();
  const net = open.reduce((n, c) => n + varianceValue(c), 0);
  const rows = [...COUNTS].reverse();
  const exportCounts = () =>
    downloadCsv(
      "ผลตรวจนับ",
      ["ใบตรวจนับ", "ช่องเก็บ", "วัสดุ", "ระบบบอก", "นับได้จริง", "ผลต่าง", "คิดเป็นเงิน", "ผู้นับ", "วันที่", "สถานะ", "ผู้อนุมัติ", "สาเหตุ"],
      rows.map((c) => [c.doc, c.bin, material(c.material).name, c.system, c.counted, variance(c), varianceValue(c), c.by, c.date, c.status, c.approvedBy ?? "", c.reason ?? ""])
    );

  return (
    <div className="space-y-3">
      <StatStrip
        title="ผลการตรวจนับ"
        icon={<ClipboardCheck size={15} />}
        cells={[
          { icon: <ClipboardCheck size={13} />, label: "ใบตรวจนับ", value: COUNT_SHEETS.length + " ใบ", sub: `รอนับ ${COUNT_SHEETS.filter((s) => s.status === "รอนับ").length} ใบ` },
          { icon: <CircleCheck size={13} />, label: "ตรงกับระบบ", value: COUNTS.filter((c) => variance(c) === 0).length + " ช่อง", sub: "ไม่ต้องปรับปรุงยอด", tone: "ok" },
          { icon: <CircleX size={13} />, label: "ผลต่างที่ค้าง", value: open.length + " ช่อง", sub: "รออนุมัติหรือรอปรับยอด", tone: open.length > 0 ? "bad" : "ok" },
          { icon: <Coins size={13} />, label: "ผลต่างสุทธิที่ค้าง", value: baht(net), sub: net < 0 ? "มูลค่าที่หายไปจากคลัง" : "มูลค่าที่นับได้เกิน", tone: net < 0 ? "bad" : "warn" },
        ]}
      />

      <Card
        title={<span className="flex items-center gap-2"><ClipboardCheck size={15} className="text-slate-400" />ใบตรวจนับ</span>}
        subtitle="ออกใบนับก่อนเดินนับ ใบนับไม่แสดงยอดในระบบ แล้วบันทึกผลกลับเข้ามา"
        action={
          <Button variant="primary" icon={<Plus size={14} />} onClick={() => onAct({ kind: "countSheet" })}>
            สร้างใบตรวจนับ
          </Button>
        }
      >
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {[...COUNT_SHEETS].reverse().map((s) => (
            <li key={s.no} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
              <span className="w-28 shrink-0 font-mono text-[12px] text-slate-500 dark:text-slate-400">{s.no}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] text-slate-900 dark:text-slate-50">{s.scope}</span>
                <span className="block truncate text-[11.5px] text-slate-400">
                  {s.date} · ผู้นับ {s.counter} · {s.lines.length} ช่อง: {s.lines.map((l) => l.bin).join(" · ")}
                </span>
              </span>
              <Badge tone={s.status === "รอนับ" ? "warn" : "ok"} dot>{s.status}</Badge>
              <Button variant="ghost" icon={<Printer size={13} />} onClick={() => onAct({ kind: "print", doc: { type: "count", sheet: s } })}>
                พิมพ์
              </Button>
              {s.status === "รอนับ" && (
                <Button variant="primary" onClick={() => onAct({ kind: "countEntry", sheet: s })}>
                  บันทึกผลนับ
                </Button>
              )}
            </li>
          ))}
        </ul>
      </Card>

      <Card
        title={<span className="flex items-center gap-2"><Scale size={15} className="text-slate-400" />ผลตรวจนับ</span>}
        subtitle="ผลต่างต้องอนุมัติโดยคนที่ไม่ได้นับเองก่อน แล้วจึงปรับยอดเข้าสต็อก กดที่แถวเพื่อดูวิธีคิดผลต่าง"
        action={<ExportButton onClick={exportCounts} />}
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
              <th className="px-4 py-3 font-medium">สถานะ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.map((c) => {
              const diff = variance(c);
              return (
                <tr
                  key={countKey(c)}
                  onClick={() => onOpen(c)}
                  className="cursor-pointer transition hover:bg-slate-50 dark:hover:bg-slate-800/40"
                >
                  <td className="px-4 py-2.5 font-mono text-[12px] text-slate-600 dark:text-slate-300">
                    {c.bin}
                    <span className="block text-[10.5px] text-slate-400">{c.doc}</span>
                  </td>
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
                  <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                    {c.status === "รออนุมัติ" ? (
                      <Button variant="secondary" onClick={() => onAct({ kind: "approveCount", count: c })}>
                        อนุมัติผลต่าง
                      </Button>
                    ) : c.status === "อนุมัติแล้ว" ? (
                      <Button variant="primary" onClick={() => onAct({ kind: "postCount", count: c })}>
                        ปรับยอด
                      </Button>
                    ) : (
                      <Badge tone={COUNT_TONE[c.status]} dot>{c.status}</Badge>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {open.length > 0 && (
        <Note tone="warn">
          ผลต่างที่ค้างอยู่ยังไม่ถูกปรับเข้าสต็อก การอนุมัติควรทำหลังหาสาเหตุแล้ว เช่น หยิบเกิน บันทึกผิดช่อง
          หรือของเสียหายระหว่างจัดเก็บ
        </Note>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- records */

function BinRecord({ b, onAct }: { b: Bin; onAct: (d: WmDialog) => void }) {
  useData();
  const [tab, setTab] = useState(BIN_TABS[0]);
  const l = binLoad(b);
  const t = storageType(b.type);
  const sw = typeSwatch(b.type);
  const picks = PICKS.filter((p) => p.bin === b.code);
  const moves = TRANSFERS.filter((x) => x.from === b.code || x.to === b.code);
  const count = COUNTS.filter((c) => c.bin === b.code).at(-1);
  const inbound = INBOUND.filter((i) => (i.bin ?? i.suggestBin) === b.code);

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
            {b.since && <Chip>ล็อตเก่าสุด {b.since}</Chip>}
          </div>
        </div>
        <div className="flex w-full flex-wrap gap-1.5">
          <Button variant="secondary" icon={<Pencil size={13} />} onClick={() => onAct({ kind: "bin", bin: b })}>
            แก้ไขช่อง
          </Button>
          {b.material && (
            <>
              <Button variant="secondary" icon={<ArrowRightLeft size={13} />} disabled={available(b) === 0} onClick={() => onAct({ kind: "transfer", from: b.code })}>
                ย้ายของออก
              </Button>
              <Button variant="secondary" icon={<ClipboardCheck size={13} />} onClick={() => onAct({ kind: "countSheet", bins: [b.code] })}>
                ตรวจนับช่องนี้
              </Button>
            </>
          )}
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
                <IconRow icon={<Package size={14} />} label="จองให้งานหยิบ">
                  {reservedIn(b)} {material(b.material).unit} · ย้ายหรือหยิบได้อีก {available(b)}
                </IconRow>
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
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-400">ใบสั่งจัดเก็บเข้าช่องนี้</p>
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
                      <Badge tone={p.status === "รอหยิบ" ? "warn" : "ok"}>{p.status}</Badge>
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

function CountRecord({ c, onAct }: { c: Count; onAct: (d: WmDialog) => void }) {
  useData();
  const diff = variance(c);
  const m = material(c.material);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone={COUNT_TONE[c.status]} dot>{c.status}</Badge>
        {c.status === "รออนุมัติ" && (
          <Button variant="primary" onClick={() => onAct({ kind: "approveCount", count: c })}>
            อนุมัติผลต่าง
          </Button>
        )}
        {c.status === "อนุมัติแล้ว" && (
          <Button variant="primary" onClick={() => onAct({ kind: "postCount", count: c })}>
            ปรับยอดเข้าสต็อก
          </Button>
        )}
      </div>
      <div className="space-y-1">
        <IconRow icon={<MapPin size={14} />} label="ช่องเก็บ">{c.bin}</IconRow>
        <IconRow icon={<Package size={14} />} label="วัสดุ">{m.name}</IconRow>
        <IconRow icon={<ClipboardCheck size={14} />} label="วันที่นับ">{c.date}</IconRow>
        <IconRow icon={<Avatar name={c.by} size="sm" />} label="ผู้นับ">{c.by}</IconRow>
        <IconRow icon={<ClipboardCheck size={14} />} label="ใบตรวจนับ">{c.doc}</IconRow>
        {c.approvedBy && <IconRow icon={<CircleCheck size={14} />} label="อนุมัติโดย">{c.approvedBy} · {c.reason}</IconRow>}
        {c.postedAt && <IconRow icon={<Scale size={14} />} label="ปรับยอดเมื่อ">{c.postedAt}</IconRow>}
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
