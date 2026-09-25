import { useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowRight, Ban, Boxes, Building, CircleCheck, CircleX, ClipboardList, Coins, FileDown, FilePlus2, FileText,
  Handshake, Layers, Pencil, PackageCheck, PackagePlus, PackageSearch, Plus, Printer, Receipt, Search as SearchIcon,
  Send, ShoppingCart, SlidersHorizontal, Star, TrendingDown, TrendingUp, Truck, TriangleAlert, Warehouse,
} from "lucide-react";
import {
  GOODS_RECEIPTS, INFO_RECORDS, INVOICES, MATERIALS, MATERIAL_GROUPS, PURCHASE_ORDERS, RECEIVABLE, REQUISITIONS,
  STOCK_MOVES, TODAY, VENDORS, VENDOR_REVIEWS, approver, approverFor, baht, belowReorder, bestPriceFor, canCancel, gradeOf,
  invoicesOf, latestReview, material, matchStatusOf, movesOf, outstandingQty, poTotal, receiptsOf, reorderPlan,
  requisitionFromReorder, requisitionValue, reviewScore, spendByMonth, stockByGroup, stockValue, threeWayMatch,
  vendor, vendorScore, GRADE_MEANING,
} from "./data";
import type { Material, PurchaseOrder, Requisition, Vendor } from "./data";
import { CONFIRMS, MmDialogs, invoiceBadge } from "./forms";
import type { Dialog } from "./forms";
import {
  Avatar, Badge, Bar, Button, Card, Chip, ColumnChart, Donut, Dot, IconRow, Note, PageHead,
  Progress, Reveal, Search, Segmented, Select, StatStrip, Stepper, Tabs, Tag, swatchFor,
} from "../ui";
import type { StepState } from "../ui";
import { DataTable, DetailModal, FormModal, downloadCsv, notify, useData } from "../kit";
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

const PO_FLOW = ["ร่าง", "รอรับของ", "รับของบางส่วน", "รับของครบแล้ว"];
const PO_TONE: Record<PurchaseOrder["status"], "idle" | "warn" | "ok" | "info" | "bad"> = {
  ร่าง: "info",
  รอรับของ: "idle",
  รับของบางส่วน: "warn",
  รับของครบแล้ว: "ok",
  ปิดยอดค้างรับ: "ok",
  ยกเลิก: "bad",
};

/* ----------------------------------------------------------------- screen */

export default function MmScreen({
  section,
  onOpenSection,
}: {
  section?: string;
  onOpenSection?: (index: number) => void;
}) {
  useData();
  const tab = section && TABS.includes(section) ? section : undefined;

  const [q, setQ] = useState("");
  const [group, setGroup] = useState("ทุกกลุ่ม");
  const [openMaterialAt, setOpenMaterialAt] = useState<number | null>(null);
  const [openPo, setOpenPo] = useState<PurchaseOrder | null>(null);
  const [openPr, setOpenPr] = useState<Requisition | null>(null);
  const [openVendor, setOpenVendor] = useState<Vendor | null>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);

  const waiting = REQUISITIONS.filter((r) => r.status === "รออนุมัติ");

  const needle = q.trim().toLowerCase();
  const materialRows = MATERIALS.filter(
    (m) =>
      (group === "ทุกกลุ่ม" || m.group === group) &&
      (needle === "" || [m.code, m.name, m.bin].some((t) => t.toLowerCase().includes(needle)))
  );
  const pickedMaterial = openMaterialAt === null ? null : (materialRows[openMaterialAt] ?? null);

  const unmatched = PURCHASE_ORDERS.filter((p) => invoicesOf(p.no).some((i) => i.blocked));

  // A question about the record opens over it; a new task replaces it, so two
  // forms are never stacked with the record half-visible behind both.
  const act = (d: Dialog) => {
    if (!CONFIRMS.includes(d.kind)) {
      setOpenPo(null);
      setOpenPr(null);
      setOpenVendor(null);
      setOpenMaterialAt(null);
    }
    setDialog(d);
  };

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
        {pickedMaterial && <MaterialRecord key={pickedMaterial.code} m={pickedMaterial} onAct={act} />}
      </DetailModal>

      <FormModal
        open={openPo !== null}
        title="ใบสั่งซื้อ"
        subtitle={openPo ? `${openPo.no} · ${vendor(openPo.vendor).name}` : undefined}
        onClose={() => setOpenPo(null)}
        size="lg"
      >
        {openPo && <PoRecord po={openPo} onAct={act} />}
      </FormModal>

      <FormModal
        open={openPr !== null}
        title="ใบขอซื้อ"
        subtitle={openPr ? `${openPr.no} · ${openPr.requester}` : undefined}
        onClose={() => setOpenPr(null)}
        size="lg"
      >
        {openPr && <PrRecord pr={openPr} onAct={act} onOpenPo={(p) => { setOpenPr(null); setOpenPo(p); }} />}
      </FormModal>

      <FormModal
        open={openVendor !== null}
        title="แฟ้มผู้ขาย"
        subtitle={openVendor ? openVendor.name : undefined}
        onClose={() => setOpenVendor(null)}
      >
        {openVendor && <VendorRecord v={openVendor} onAct={act} />}
      </FormModal>

      <MmDialogs
        dialog={dialog}
        onClose={() => setDialog(null)}
        onSaved={(saved) => {
          setDialog(null);
          // Take the person to the next step of what they just saved.
          if (saved.po) setOpenPo(saved.po);
          else if (saved.pr) setOpenPr(saved.pr);
          else if (saved.gr) setDialog({ kind: "print", doc: { type: "gr", gr: saved.gr } });
          else if (saved.move?.kind === "เบิกใช้") setDialog({ kind: "print", doc: { type: "move", move: saved.move } });
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
          onAct={act}
        />
        {panels}
      </>
    );
  }

  const firstWaiting = waiting[0] ?? REQUISITIONS[0];
  const approvedPr = REQUISITIONS.find((r) => r.status === "อนุมัติแล้ว") ?? REQUISITIONS[0];
  const draftPo = PURCHASE_ORDERS.find((p) => p.status === "ร่าง") ?? PURCHASE_ORDERS[0];
  const partialPo = PURCHASE_ORDERS.find((p) => p.status === "รับของบางส่วน") ?? PURCHASE_ORDERS[0];
  const blockedInv = INVOICES.find((i) => i.blocked) ?? INVOICES[0];

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
          onAct={act}
        />
      )}

      {tab === "ใบขอซื้อและใบสั่งซื้อ" && <Ordering onOpenPr={setOpenPr} onOpenPo={setOpenPo} onAct={act} />}

      {tab === "รับของและตรวจสอบใบแจ้งหนี้" && <Receiving onOpenPo={setOpenPo} onAct={act} />}

      {tab === "บริหารสต็อกวัสดุ" && (
        <Stock onOpenMaterial={(m) => setOpenMaterialAt(MATERIALS.indexOf(m))} onAct={act} onOpenPr={setOpenPr} />
      )}

      {tab === "ประเมินผู้ขาย" && <VendorReview onOpenVendor={setOpenVendor} onAct={act} />}

      {panels}

      <div hidden data-fitt-index>
        <button data-fitt-screen="จัดซื้อและคลังวัสดุ" />
        <button data-fitt-screen="แฟ้มวัสดุ" data-fitt-modal onClick={() => setOpenMaterialAt(0)} />
        <button data-fitt-screen="เพิ่มวัสดุ" data-fitt-modal onClick={() => act({ kind: "material" })} />
        <button data-fitt-screen="แก้ไขข้อมูลวัสดุ" data-fitt-modal onClick={() => act({ kind: "material", material: MATERIALS[0] })} />
        <button data-fitt-screen="แฟ้มผู้ขาย" data-fitt-modal onClick={() => setOpenVendor(VENDORS[0])} />
        <button data-fitt-screen="เพิ่มผู้ขาย" data-fitt-modal onClick={() => act({ kind: "vendor" })} />
        <button data-fitt-screen="แก้ไขข้อมูลผู้ขาย" data-fitt-modal onClick={() => act({ kind: "vendor", vendor: VENDORS[0] })} />
        <button data-fitt-screen="ระงับการสั่งซื้อกับผู้ขาย" data-fitt-modal onClick={() => act({ kind: "blockVendor", vendor: VENDORS[0] })} />
        <button data-fitt-screen="บันทึกราคาที่ผู้ขายเสนอ" data-fitt-modal onClick={() => act({ kind: "quote" })} />
        <button data-fitt-screen="ใบขอซื้อ" data-fitt-modal onClick={() => setOpenPr(REQUISITIONS[0])} />
        <button data-fitt-screen="เปิดใบขอซื้อ" data-fitt-modal onClick={() => act({ kind: "pr" })} />
        <button data-fitt-screen="แก้ไขใบขอซื้อ" data-fitt-modal onClick={() => act({ kind: "pr", pr: firstWaiting })} />
        <button data-fitt-screen="อนุมัติใบขอซื้อ" data-fitt-modal onClick={() => act({ kind: "approvePr", pr: firstWaiting })} />
        <button data-fitt-screen="ไม่อนุมัติใบขอซื้อ" data-fitt-modal onClick={() => act({ kind: "rejectPr", pr: firstWaiting })} />
        <button data-fitt-screen="แปลงใบขอซื้อเป็นใบสั่งซื้อ" data-fitt-modal onClick={() => act({ kind: "convertPr", pr: approvedPr })} />
        <button data-fitt-screen="พิมพ์ใบขอซื้อ" data-fitt-modal onClick={() => act({ kind: "print", doc: { type: "pr", pr: REQUISITIONS[0] } })} />
        <button data-fitt-screen="ใบสั่งซื้อ" data-fitt-modal onClick={() => setOpenPo(PURCHASE_ORDERS[0])} />
        <button data-fitt-screen="สร้างใบสั่งซื้อ" data-fitt-modal onClick={() => act({ kind: "po" })} />
        <button data-fitt-screen="แก้ไขใบสั่งซื้อ" data-fitt-modal onClick={() => act({ kind: "po", po: draftPo })} />
        <button data-fitt-screen="ส่งใบสั่งซื้อให้ผู้ขาย" data-fitt-modal onClick={() => act({ kind: "sendPo", po: draftPo })} />
        <button data-fitt-screen="ยกเลิกใบสั่งซื้อ" data-fitt-modal onClick={() => act({ kind: "cancelPo", po: draftPo })} />
        <button data-fitt-screen="ปิดยอดค้างรับ" data-fitt-modal onClick={() => act({ kind: "closePo", po: partialPo })} />
        <button data-fitt-screen="พิมพ์ใบสั่งซื้อ" data-fitt-modal onClick={() => act({ kind: "print", doc: { type: "po", po: PURCHASE_ORDERS[0] } })} />
        <button data-fitt-screen="รับของตามใบสั่งซื้อ" data-fitt-modal onClick={() => act({ kind: "gr" })} />
        <button data-fitt-screen="พิมพ์ใบรับสินค้า" data-fitt-modal onClick={() => act({ kind: "print", doc: { type: "gr", gr: GOODS_RECEIPTS[0] } })} />
        <button data-fitt-screen="บันทึกใบแจ้งหนี้จากผู้ขาย" data-fitt-modal onClick={() => act({ kind: "invoice" })} />
        <button data-fitt-screen="ปลดระงับจ่าย" data-fitt-modal onClick={() => act({ kind: "release", invoice: blockedInv })} />
        <button data-fitt-screen="เบิกและปรับยอดสต็อก" data-fitt-modal onClick={() => act({ kind: "move" })} />
        <button data-fitt-screen="พิมพ์ใบเบิกวัสดุ" data-fitt-modal onClick={() => act({ kind: "print", doc: { type: "move", move: STOCK_MOVES.find((m) => m.doc) ?? STOCK_MOVES[0] } })} />
        <button data-fitt-screen="บันทึกผลประเมินผู้ขาย" data-fitt-modal onClick={() => act({ kind: "review" })} />
      </div>
    </div>
  );
}

/** One click from a reorder suggestion to a requisition waiting for approval. */
function orderFromPlan(codes: string[]) {
  const pr = requisitionFromReorder(codes);
  notify(`เปิดใบขอซื้อ ${pr.no} จากรายการเสนอสั่งซื้อแล้ว · ${pr.lines.length} รายการ รออนุมัติ`);
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
  waiting,
  unmatched,
  onOpenSection,
  onOpenMaterial,
  onAct,
}: {
  waiting: number;
  unmatched: number;
  onOpenSection?: (index: number) => void;
  onOpenMaterial: (m: Material) => void;
  onAct: (d: Dialog) => void;
}) {
  const groups = stockByGroup();
  const low = belowReorder();
  const plan = reorderPlan();
  const spend = spendByMonth();
  const openOrders = PURCHASE_ORDERS.filter((p) => RECEIVABLE.includes(p.status));

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
          <span className="flex flex-wrap gap-2">
            <Button variant="secondary" icon={<PackagePlus size={15} />} onClick={() => onAct({ kind: "gr" })}>
              รับของ
            </Button>
            <Button variant="secondary" icon={<FilePlus2 size={15} />} onClick={() => onAct({ kind: "pr" })}>
              เปิดใบขอซื้อ
            </Button>
            {onOpenSection && (
              <Button variant="primary" icon={<ShoppingCart size={15} />} onClick={() => onOpenSection(1)}>
                เปิดใบขอซื้อและใบสั่งซื้อ
              </Button>
            )}
          </span>
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
          subtitle="ควรเปิดใบขอซื้อก่อนของหมด ระบบหักของที่สั่งไว้แล้วออกก่อนเสนอจำนวน กดครั้งเดียวได้ใบขอซื้อ"
          action={seeAll(3)}
        >
          {low.length === 0 ? (
            <p className="py-10 text-center text-[12.5px] text-slate-400">ทุกรายการอยู่เหนือจุดสั่งซื้อ</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {plan.map(({ m, qty, made, onOrder }) => {
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
                    <span className="w-40 shrink-0 text-right">
                      {made ? (
                        <Badge tone="idle">ผลิตเอง</Badge>
                      ) : qty > 0 ? (
                        <Button variant="secondary" icon={<FilePlus2 size={13} />} onClick={() => orderFromPlan([m.code])}>
                          ขอซื้อ {qty} {m.unit}
                        </Button>
                      ) : (
                        <Badge tone="info">สั่งไว้แล้ว {onOrder}</Badge>
                      )}
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
  onAct,
}: {
  rows: Material[];
  q: string;
  setQ: (v: string) => void;
  group: string;
  setGroup: (v: string) => void;
  onOpenMaterial: (m: Material) => void;
  onOpenVendor: (v: Vendor) => void;
  onAct: (d: Dialog) => void;
}) {
  useData();
  const [view, setView] = useState(MASTER_TABS[0]);

  const exportMaterials = () =>
    downloadCsv(
      "แฟ้มวัสดุ",
      ["รหัส", "วัสดุ", "กลุ่ม", "ช่องเก็บ", "คงเหลือ", "หน่วย", "ราคาต่อหน่วย", "มูลค่า", "จุดสั่งซื้อ", "สต็อกขั้นต่ำ"],
      rows.map((m) => [m.code, m.name, m.group, m.bin, m.stock, m.unit, m.price, m.stock * m.price, m.reorder, m.safety])
    );
  const exportVendors = () =>
    downloadCsv(
      "แฟ้มผู้ขาย",
      ["รหัส", "ผู้ขาย", "เลขประจำตัวผู้เสียภาษี", "ผู้ติดต่อ", "โทรศัพท์", "เงื่อนไขชำระ", "เวลาส่งของ (วัน)", "ที่อยู่", "สถานะ"],
      VENDORS.map((v) => [v.code, v.name, v.taxId, v.contact, v.phone, v.terms, v.leadDays, v.address, v.blocked ? "ระงับ" : "ใช้งาน"])
    );
  const exportQuotes = () =>
    downloadCsv(
      "ราคาที่ผู้ขายเคยเสนอ",
      ["รหัสวัสดุ", "วัสดุ", "ผู้ขาย", "ราคา", "เวลาส่ง (วัน)"],
      INFO_RECORDS.map((r) => [r.material, material(r.material).name, vendor(r.vendor).name, r.price, r.leadDays])
    );

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
              <ExportButton onClick={exportMaterials} />
              <Button variant="primary" icon={<Plus size={14} />} onClick={() => onAct({ kind: "material" })}>
                เพิ่มวัสดุ
              </Button>
            </div>
          }
        />
      )}

      {view === "แฟ้มผู้ขาย" && (
        <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12px] text-slate-400">
            {VENDORS.length} ผู้ขาย · ระงับอยู่ {VENDORS.filter((v) => v.blocked).length} ราย
          </span>
          <span className="ml-auto flex gap-2">
            <ExportButton onClick={exportVendors} />
            <Button variant="primary" icon={<Plus size={14} />} onClick={() => onAct({ kind: "vendor" })}>
              เพิ่มผู้ขาย
            </Button>
          </span>
        </div>
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
                action={
                  v.blocked ? (
                    <Badge tone="bad" icon={<Ban size={11} />}>ระงับการสั่งซื้อ</Badge>
                  ) : (
                    <Badge tone={score.fillRate === 100 ? "ok" : score.fillRate === null ? "idle" : "warn"}>
                      {score.fillRate === null ? "ยังไม่มีใบที่ปิด" : `ส่งครบ ${score.fillRate}%`}
                    </Badge>
                  )
                }
              >
                <div className="space-y-1 p-4">
                  <IconRow icon={<Handshake size={14} />} label="ผู้ติดต่อ">{v.contact}</IconRow>
                  <IconRow icon={<Receipt size={14} />} label="เงื่อนไขชำระ">{v.terms}</IconRow>
                  <IconRow icon={<Truck size={14} />} label="เวลาส่งของ">{v.leadDays} วัน</IconRow>
                  <IconRow icon={<Coins size={14} />} label="มูลค่าที่สั่งรวม">{baht(score.value)}</IconRow>
                </div>
                <div className="flex flex-wrap gap-1.5 border-t border-slate-100 px-4 py-2.5 dark:border-slate-800">
                  <Button variant="ghost" icon={<Pencil size={13} />} onClick={() => onAct({ kind: "vendor", vendor: v })}>
                    แก้ไข
                  </Button>
                  <Button variant="ghost" icon={<ShoppingCart size={13} />} onClick={() => onAct({ kind: "po", vendor: v.code })} disabled={v.blocked}>
                    สร้างใบสั่งซื้อ
                  </Button>
                  <Button variant="ghost" icon={<Coins size={13} />} onClick={() => onAct({ kind: "quote", vendor: v.code })}>
                    บันทึกราคาที่เสนอ
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
        </div>
      )}

      {view === "ราคาที่เคยเสนอ" && (
        <Card
          title={<span className="flex items-center gap-2"><Coins size={15} className="text-slate-400" />ราคาที่ผู้ขายเคยเสนอ</span>}
          subtitle="ใช้ประกอบการเลือกแหล่งซื้อในรอบถัดไป แถวที่ทำเครื่องหมายคือราคาดีที่สุดของวัสดุนั้น"
          action={
            <span className="flex gap-2">
              <ExportButton onClick={exportQuotes} />
              <Button variant="primary" icon={<Plus size={14} />} onClick={() => onAct({ kind: "quote" })}>
                บันทึกราคาที่เสนอ
              </Button>
            </span>
          }
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

const PR_TONE: Record<Requisition["status"], "warn" | "info" | "ok" | "bad"> = {
  รออนุมัติ: "warn",
  อนุมัติแล้ว: "info",
  แปลงเป็นใบสั่งซื้อแล้ว: "ok",
  ไม่อนุมัติ: "bad",
};

const PO_FILTERS = ["ทั้งหมด", "ร่าง", "รอรับของ", "รับของบางส่วน", "ปิดแล้ว"];

function Ordering({
  onOpenPr,
  onOpenPo,
  onAct,
}: {
  onOpenPr: (r: Requisition) => void;
  onOpenPo: (p: PurchaseOrder) => void;
  onAct: (d: Dialog) => void;
}) {
  useData();
  const [filter, setFilter] = useState(PO_FILTERS[0]);
  const orders = [...PURCHASE_ORDERS].reverse().filter((p) =>
    filter === "ทั้งหมด"
      ? true
      : filter === "ปิดแล้ว"
        ? ["รับของครบแล้ว", "ปิดยอดค้างรับ", "ยกเลิก"].includes(p.status)
        : p.status === filter
  );
  const counts = {
    ทั้งหมด: PURCHASE_ORDERS.length,
    ร่าง: PURCHASE_ORDERS.filter((p) => p.status === "ร่าง").length,
    รอรับของ: PURCHASE_ORDERS.filter((p) => p.status === "รอรับของ").length,
    รับของบางส่วน: PURCHASE_ORDERS.filter((p) => p.status === "รับของบางส่วน").length,
    ปิดแล้ว: PURCHASE_ORDERS.filter((p) => ["รับของครบแล้ว", "ปิดยอดค้างรับ", "ยกเลิก"].includes(p.status)).length,
  };

  const exportPrs = () =>
    downloadCsv(
      "ใบขอซื้อ",
      ["เลขที่", "วันที่", "หน่วยงาน", "รายการ", "ต้องการภายใน", "มูลค่าประมาณ", "สถานะ", "ผู้อนุมัติ", "ใบสั่งซื้อ"],
      [...REQUISITIONS].reverse().map((r) => [
        r.no, r.date, r.requester, r.lines.map((l) => `${material(l.material).name} ${l.qty}`).join(" / "), r.needBy,
        requisitionValue(r), r.status, r.approvedBy ?? "", r.po ?? "",
      ])
    );
  const exportPos = () =>
    downloadCsv(
      "ใบสั่งซื้อ",
      ["เลขที่", "ผู้ขาย", "วันที่", "กำหนดส่ง", "รายการ", "มูลค่า", "สถานะ", "อ้างอิงใบขอซื้อ"],
      orders.map((p) => [p.no, vendor(p.vendor).name, p.date, p.deliverBy, p.lines.length, poTotal(p), p.status, p.pr ?? ""])
    );

  return (
    <div className="space-y-3">
      <Card
        title={<span className="flex items-center gap-2"><ClipboardList size={15} className="text-slate-400" />ใบขอซื้อ</span>}
        subtitle="หน่วยงานเปิดใบขอซื้อ ผู้มีอำนาจอนุมัติตามวงเงิน แล้วจัดซื้อแปลงเป็นใบสั่งซื้อ กดที่แถวเพื่อเปิดใบ"
        action={
          <span className="flex gap-2">
            <ExportButton onClick={exportPrs} />
            <Button variant="primary" icon={<Plus size={14} />} onClick={() => onAct({ kind: "pr" })}>
              เปิดใบขอซื้อ
            </Button>
          </span>
        }
      >
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {[...REQUISITIONS].reverse().map((r) => {
            const value = requisitionValue(r);
            return (
              <li
                key={r.no}
                onClick={() => onOpenPr(r)}
                className="flex cursor-pointer flex-wrap items-center gap-3 px-4 py-3 transition hover:bg-slate-50 dark:hover:bg-slate-800/40"
              >
                <span className="w-32 shrink-0 font-mono text-[12px] text-slate-500 dark:text-slate-400">{r.no}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-slate-900 dark:text-slate-50">
                    {material(r.material).name}
                    {r.lines.length > 1 && <span className="font-normal text-slate-400"> และอีก {r.lines.length - 1} รายการ</span>}
                  </span>
                  <span className="block truncate text-[11.5px] text-slate-400">
                    {r.qty} {material(r.material).unit} · ขอโดย{r.requester} · ต้องการภายใน {r.needBy}
                    {r.approvedBy && ` · อนุมัติโดย ${r.approvedBy}`}
                  </span>
                </span>
                <span className="shrink-0 text-[12.5px] tabular-nums text-slate-600 dark:text-slate-300">{baht(value)}</span>
                <Badge tone={PR_TONE[r.status]} dot>
                  {r.status}
                </Badge>
                <span className="flex shrink-0 gap-1.5" onClick={(e) => e.stopPropagation()}>
                  {r.status === "รออนุมัติ" && (
                    <Button variant="secondary" onClick={() => onAct({ kind: "approvePr", pr: r })}>
                      อนุมัติ
                    </Button>
                  )}
                  {r.status === "อนุมัติแล้ว" && (
                    <Button variant="primary" icon={<ShoppingCart size={13} />} onClick={() => onAct({ kind: "convertPr", pr: r })}>
                      แปลงเป็นใบสั่งซื้อ
                    </Button>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card
        title={<span className="flex items-center gap-2"><ShoppingCart size={15} className="text-slate-400" />ใบสั่งซื้อ</span>}
        subtitle="กดที่แถวเพื่อดูรายบรรทัด ของที่รับแล้ว ใบแจ้งหนี้ที่ผูกอยู่ และปุ่มส่ง รับของ พิมพ์"
        action={
          <span className="flex gap-2">
            <ExportButton onClick={exportPos} />
            <Button variant="primary" icon={<Plus size={14} />} onClick={() => onAct({ kind: "po" })}>
              สร้างใบสั่งซื้อ
            </Button>
          </span>
        }
      >
        <div className="border-b border-slate-100 px-4 py-2.5 dark:border-slate-800">
          <Segmented options={PO_FILTERS} value={filter} onChange={setFilter} counts={counts} />
        </div>
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
            {orders.map((po) => (
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
            {orders.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-[12.5px] text-slate-400">ไม่มีใบสั่งซื้อในสถานะนี้</td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------- receiving */

function Receiving({ onOpenPo, onAct }: { onOpenPo: (p: PurchaseOrder) => void; onAct: (d: Dialog) => void }) {
  useData();
  const rows = PURCHASE_ORDERS.filter((po) => po.status !== "ร่าง" && po.status !== "ยกเลิก").map((po) => ({
    po,
    m: threeWayMatch(po),
    status: matchStatusOf(po),
  }));
  const blocked = INVOICES.filter((i) => i.blocked);
  const waitingGoods = PURCHASE_ORDERS.filter((p) => RECEIVABLE.includes(p.status));

  const exportReceipts = () =>
    downloadCsv(
      "ใบรับสินค้า",
      ["เลขที่", "อ้างใบสั่งซื้อ", "ผู้ขาย", "วันที่", "ใบส่งของผู้ขาย", "รายการที่รับ"],
      [...GOODS_RECEIPTS].reverse().map((g) => [
        g.no, g.po, vendor(PURCHASE_ORDERS.find((p) => p.no === g.po)!.vendor).name, g.date, g.deliveryNote ?? "",
        g.lines.map((l) => `${material(l.material).name} × ${l.qty}`).join(" / "),
      ])
    );
  const exportInvoices = () =>
    downloadCsv(
      "ใบแจ้งหนี้จากผู้ขาย",
      ["เลขที่", "ใบสั่งซื้อ", "ผู้ขาย", "วันที่", "มูลค่าก่อนภาษี", "ภาษีมูลค่าเพิ่ม", "รวม", "สถานะ", "เหตุที่ระงับ"],
      [...INVOICES].reverse().map((i) => [
        i.no, i.po, vendor(i.vendor).name, i.date, i.amount, Math.round(i.amount * 7) / 100, Math.round(i.amount * 107) / 100,
        invoiceBadge(i).label, i.blockReason ?? "",
      ])
    );
  const exportMatch = () =>
    downloadCsv(
      "ตรวจสามทาง",
      ["ใบสั่งซื้อ", "ผู้ขาย", "สั่ง", "รับแล้ว", "วางบิล", "ผล"],
      [...rows].reverse().map(({ po, m, status }) => [po.no, vendor(po.vendor).name, m.ordered, m.received, m.invoice, status.label])
    );

  return (
    <div className="space-y-3">
      <StatStrip
        title="การรับของและการตรวจสอบ"
        icon={<PackageCheck size={15} />}
        cells={[
          { icon: <Truck size={13} />, label: "ใบรับสินค้า", value: GOODS_RECEIPTS.length + " ใบ", sub: `รอรับของอีก ${waitingGoods.length} ใบสั่งซื้อ` },
          { icon: <Receipt size={13} />, label: "ใบแจ้งหนี้ที่ตั้งไว้", value: INVOICES.length + " ใบ", sub: "ผู้ขายวางบิลเข้ามาแล้ว", tone: "info" },
          { icon: <CircleCheck size={13} />, label: "ตรวจผ่าน", value: rows.filter((r) => r.status.tone === "ok").length + " ใบ", sub: "สั่ง รับ และวางบิลตรงกัน", tone: "ok" },
          { icon: <CircleX size={13} />, label: "ระงับจ่าย", value: blocked.length + " ใบ", sub: "ยังอนุมัติจ่ายไม่ได้", tone: blocked.length > 0 ? "bad" : "ok" },
        ]}
      />

      {blocked.length > 0 && (
        <Note tone="bad">
          มี {blocked.length} ใบที่ยอดวางบิลเกินของที่รับจริง ระบบระงับจ่ายไว้ ให้ผู้ขายส่งของส่วนที่ขาดหรือออกใบลดหนี้ แล้วกดปลดระงับ
        </Note>
      )}

      <Card
        title={<span className="flex items-center gap-2"><PackagePlus size={15} className="text-slate-400" />ใบสั่งซื้อที่รอรับของ</span>}
        subtitle="ของมาถึงแล้วกดรับของ ใส่จำนวนที่นับได้จริง รับบางส่วนได้"
      >
        {waitingGoods.length === 0 ? (
          <p className="py-8 text-center text-[12.5px] text-slate-400">ไม่มีใบสั่งซื้อที่รอรับของ</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {waitingGoods.map((po) => (
              <li key={po.no} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                <button onClick={() => onOpenPo(po)} className="w-32 shrink-0 text-left font-mono text-[12px] text-violet-700 hover:underline dark:text-violet-300">
                  {po.no}
                </button>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] text-slate-900 dark:text-slate-50">{vendor(po.vendor).name}</span>
                  <span className="block truncate text-[11.5px] text-slate-400">
                    ค้างรับ {po.lines.filter((l) => outstandingQty(po, l.material) > 0).map((l) => `${material(l.material).name} ${outstandingQty(po, l.material)} ${material(l.material).unit}`).join(" · ")}
                  </span>
                </span>
                <span className={"shrink-0 text-[11.5px] tabular-nums " + (po.deliverBy < TODAY ? "text-rose-600 dark:text-rose-400" : "text-slate-400")}>
                  กำหนดส่ง {po.deliverBy}{po.deliverBy < TODAY ? " · เลยกำหนด" : ""}
                </span>
                <Badge tone={PO_TONE[po.status]} dot>{po.status}</Badge>
                <Button variant="primary" icon={<PackagePlus size={13} />} onClick={() => onAct({ kind: "gr", po })}>
                  รับของ
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card
        title={<span className="flex items-center gap-2"><Truck size={15} className="text-slate-400" />ใบรับสินค้า</span>}
        subtitle="แต่ละใบอ้างถึงใบสั่งซื้อที่เป็นต้นเรื่อง พิมพ์ให้ผู้ส่งของและผู้ตรวจรับลงนามได้"
        action={
          <span className="flex gap-2">
            <ExportButton onClick={exportReceipts} />
            <Button variant="primary" icon={<PackagePlus size={14} />} onClick={() => onAct({ kind: "gr" })}>
              รับของ
            </Button>
          </span>
        }
      >
        <table className="w-full text-[13px]">
          <thead className="bg-slate-50/80 text-left text-[11px] uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">เลขที่</th>
              <th className="px-4 py-3 font-medium">อ้างใบสั่งซื้อ</th>
              <th className="px-4 py-3 font-medium">วันที่</th>
              <th className="px-4 py-3 font-medium">รายการที่รับ</th>
              <th className="px-4 py-3 font-medium" />
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
                <td className="px-4 py-2.5 text-right">
                  <Button variant="ghost" icon={<Printer size={13} />} onClick={() => onAct({ kind: "print", doc: { type: "gr", gr: g } })}>
                    พิมพ์
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card
        title={<span className="flex items-center gap-2"><Receipt size={15} className="text-slate-400" />ใบแจ้งหนี้จากผู้ขาย</span>}
        subtitle="ตั้งหนี้ตามใบกำกับภาษี ระบบตรวจสามทางตอนบันทึก ใบที่ระงับจ่ายฝ่ายบัญชีจ่ายไม่ได้จนกว่าจะปลด"
        action={
          <span className="flex gap-2">
            <ExportButton onClick={exportInvoices} />
            <Button variant="primary" icon={<Plus size={14} />} onClick={() => onAct({ kind: "invoice" })}>
              บันทึกใบแจ้งหนี้
            </Button>
          </span>
        }
      >
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {[...INVOICES].reverse().map((i) => {
            const b = invoiceBadge(i);
            return (
              <li key={i.no} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                <span className="w-24 shrink-0 font-mono text-[12px] text-slate-500 dark:text-slate-400">{i.no}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] text-slate-900 dark:text-slate-50">
                    {vendor(i.vendor).name} · {i.po}
                  </span>
                  <span className="block truncate text-[11.5px] text-slate-400">{i.blockReason ?? `วันที่ ${i.date}`}</span>
                </span>
                <span className="shrink-0 text-[12.5px] tabular-nums text-slate-900 dark:text-slate-50">{baht(i.amount)}</span>
                <Badge tone={b.tone} dot>{b.label}</Badge>
                {i.blocked && (
                  <Button variant="secondary" onClick={() => onAct({ kind: "release", invoice: i })}>
                    ปลดระงับ
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </Card>

      <Card
        title={<span className="flex items-center gap-2"><PackageSearch size={15} className="text-slate-400" />ตรวจสามทาง</span>}
        subtitle="เทียบใบสั่งซื้อ ใบรับสินค้า และใบวางบิล ยอมให้ต่างได้ 1% ไม่เกิน 1,000 บาท เกินนั้นระงับจ่าย"
        action={<ExportButton onClick={exportMatch} />}
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
            {[...rows].reverse().map(({ po, m, status }) => (
              <tr key={po.no} className="transition hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <td className="px-4 py-2.5 font-mono text-[12px] text-slate-500 dark:text-slate-400">{po.no}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-slate-700 dark:text-slate-200">{baht(m.ordered)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-slate-700 dark:text-slate-200">{baht(m.received)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-slate-700 dark:text-slate-200">{m.invoice ? baht(m.invoice) : "—"}</td>
                <td className="px-4 py-2.5">
                  <Badge tone={status.tone} dot={status.tone !== "idle"}>{status.label}</Badge>
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

function Stock({
  onOpenMaterial,
  onAct,
  onOpenPr,
}: {
  onOpenMaterial: (m: Material) => void;
  onAct: (d: Dialog) => void;
  onOpenPr: (r: Requisition) => void;
}) {
  useData();
  const groups = stockByGroup();
  const low = belowReorder();
  const plan = reorderPlan();
  const toOrder = plan.filter((p) => p.qty > 0);

  const orderAll = () => {
    const pr = requisitionFromReorder(toOrder.map((p) => p.m.code));
    notify(`เปิดใบขอซื้อ ${pr.no} รวม ${pr.lines.length} รายการจากรายการเสนอสั่งซื้อแล้ว`);
    onOpenPr(pr);
  };
  const exportLevels = () =>
    downloadCsv(
      "ระดับสต็อกวัสดุ",
      ["รหัส", "วัสดุ", "กลุ่ม", "คงเหลือ", "หน่วย", "สต็อกขั้นต่ำ", "จุดสั่งซื้อ", "กำลังมา", "มูลค่า"],
      MATERIALS.map((m) => [m.code, m.name, m.group, m.stock, m.unit, m.safety, m.reorder, plan.find((p) => p.m === m)?.onOrder ?? "", m.stock * m.price])
    );
  const exportMoves = () =>
    downloadCsv(
      "ความเคลื่อนไหวสต็อก",
      ["วันที่", "เลขที่เอกสาร", "รหัส", "วัสดุ", "จำนวน", "หน่วย", "เหตุผล"],
      [...STOCK_MOVES].reverse().map((mv) => [mv.date, mv.doc ?? "", mv.material, material(mv.material).name, mv.qty, material(mv.material).unit, mv.reason])
    );

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

      <Card
        title={<span className="flex items-center gap-2"><FilePlus2 size={15} className="text-slate-400" />รายการเสนอสั่งซื้อ</span>}
        subtitle="วัสดุที่ต่ำกว่าจุดสั่งซื้อ หักของที่สั่งไว้แล้วออกก่อน แล้วเสนอสั่งเติมให้ถึงสองเท่าของจุดสั่งซื้อ"
        action={
          <Button variant="primary" icon={<FilePlus2 size={14} />} onClick={orderAll} disabled={toOrder.length === 0}>
            เปิดใบขอซื้อรวม {toOrder.length} รายการ
          </Button>
        }
      >
        {plan.length === 0 ? (
          <p className="py-8 text-center text-[12.5px] text-slate-400">ทุกรายการอยู่เหนือจุดสั่งซื้อ</p>
        ) : (
          <table className="w-full text-[13px]">
            <thead className="bg-slate-50/80 text-left text-[11px] uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">วัสดุ</th>
                <th className="px-4 py-3 text-right font-medium">คงเหลือ</th>
                <th className="px-4 py-3 text-right font-medium">ขั้นต่ำ / จุดสั่ง</th>
                <th className="px-4 py-3 text-right font-medium">กำลังมา</th>
                <th className="px-4 py-3 text-right font-medium">เสนอสั่ง</th>
                <th className="px-4 py-3 font-medium">ผู้ขายที่เสนอ</th>
                <th className="px-4 py-3 text-right font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {plan.map(({ m, onOrder, qty, made, urgent, best }) => (
                <tr key={m.code}>
                  <td className="px-4 py-2.5">
                    <button onClick={() => onOpenMaterial(m)} className="text-left text-slate-900 hover:text-violet-700 dark:text-slate-50">
                      {m.name}
                    </button>
                    <span className="block font-mono text-[11px] text-slate-400">{m.code}</span>
                  </td>
                  <td className={"px-4 py-2.5 text-right font-semibold tabular-nums " + (urgent ? "text-rose-600 dark:text-rose-400" : "text-amber-700 dark:text-amber-400")}>
                    {m.stock} {m.unit}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-500 dark:text-slate-400">
                    {m.safety} / {m.reorder}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-300">{onOrder || "—"}</td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-slate-900 dark:text-slate-50">{qty > 0 ? `${qty} ${m.unit}` : "—"}</td>
                  <td className="px-4 py-2.5 text-[12px] text-slate-500 dark:text-slate-400">
                    {best ? `${vendor(best.vendor).name} ${baht(best.price)}` : made ? "—" : "ยังไม่มีราคาอ้างอิง"}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {made ? (
                      <Badge tone="idle">ผลิตเอง ดูแผนการผลิต</Badge>
                    ) : qty > 0 ? (
                      <Button variant="secondary" icon={<FilePlus2 size={13} />} onClick={() => orderFromPlan([m.code])}>
                        เปิดใบขอซื้อ
                      </Button>
                    ) : (
                      <Badge tone="info">ของที่สั่งไว้พอแล้ว</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <div className="grid gap-3 xl:grid-cols-3">
        <Card
          title={<span className="flex items-center gap-2"><Layers size={15} className="text-slate-400" />มูลค่าตามกลุ่มวัสดุ</span>}
        >
          <div className="p-4">
            <Donut
              segments={groups.map((g) => ({ label: g.group, value: g.value, swatch: groupSwatch(g.group) }))}
              size={128}
              format={(n) => baht(n)}
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
          action={<ExportButton onClick={exportLevels} />}
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
        action={
          <span className="flex gap-2">
            <ExportButton onClick={exportMoves} />
            <Button variant="secondary" icon={<SlidersHorizontal size={14} />} onClick={() => onAct({ kind: "move", moveKind: "ปรับยอดลด" })}>
              ปรับยอดสต็อก
            </Button>
            <Button variant="primary" icon={<Plus size={14} />} onClick={() => onAct({ kind: "move", moveKind: "เบิกใช้" })}>
              เบิกวัสดุ
            </Button>
          </span>
        }
      >
        <table className="w-full text-[13px]">
          <thead className="bg-slate-50/80 text-left text-[11px] uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">วันที่</th>
              <th className="px-4 py-3 font-medium">เอกสาร</th>
              <th className="px-4 py-3 font-medium">วัสดุ</th>
              <th className="px-4 py-3 text-right font-medium">จำนวน</th>
              <th className="px-4 py-3 font-medium">เหตุผล</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {[...STOCK_MOVES].reverse().map((mv, i) => (
              <tr key={i} className="transition hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <td className="px-4 py-2.5 tabular-nums text-slate-500 dark:text-slate-400">{mv.date}</td>
                <td className="px-4 py-2.5 font-mono text-[12px] text-slate-500 dark:text-slate-400">{mv.doc ?? "—"}</td>
                <td className="px-4 py-2.5 text-slate-900 dark:text-slate-50">{material(mv.material).name}</td>
                <td className={"px-4 py-2.5 text-right font-semibold tabular-nums " + (mv.qty > 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                  {mv.qty > 0 ? "+" : ""}
                  {mv.qty}
                </td>
                <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{mv.reason}</td>
                <td className="px-4 py-2.5 text-right">
                  {mv.doc && (mv.doc.startsWith("IS-") || mv.doc.startsWith("AJ-")) && (
                    <Button variant="ghost" icon={<Printer size={13} />} onClick={() => onAct({ kind: "print", doc: { type: "move", move: mv } })}>
                      พิมพ์
                    </Button>
                  )}
                  {mv.doc?.startsWith("GR-") && (
                    <Button
                      variant="ghost"
                      icon={<Printer size={13} />}
                      onClick={() => onAct({ kind: "print", doc: { type: "gr", gr: GOODS_RECEIPTS.find((g) => g.no === mv.doc)! } })}
                    >
                      พิมพ์
                    </Button>
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

/* --------------------------------------------------------- vendor review */

function VendorReview({ onOpenVendor, onAct }: { onOpenVendor: (v: Vendor) => void; onAct: (d: Dialog) => void }) {
  useData();
  const rows = VENDORS.map((v) => ({ v, ...vendorScore(v.code) })).sort((a, b) => b.value - a.value);
  const history = [...VENDOR_REVIEWS].sort((a, b) => b.date.localeCompare(a.date) || b.no.localeCompare(a.no));
  const exportReviews = () =>
    downloadCsv(
      "ผลประเมินผู้ขาย",
      ["เลขที่", "วันที่", "งวด", "ผู้ขาย", "คุณภาพ", "ส่งมอบ", "ราคา", "บริการ", "คะแนน", "เกรด", "ผู้ประเมิน", "ข้อสังเกต"],
      history.map((r) => [r.no, r.date, r.period, vendor(r.vendor).name, r.quality, r.delivery, r.price, r.service, reviewScore(r), gradeOf(reviewScore(r)), r.by, r.note])
    );
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
        <ExportButton onClick={exportReviews} />
        <Button variant="primary" icon={<Star size={14} />} onClick={() => onAct({ kind: "review" })}>
          บันทึกผลประเมิน
        </Button>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {shown.map(({ v, orders, value, fillRate, onTime }) => {
          const last = latestReview(v.code);
          const grade = last ? gradeOf(reviewScore(last)) : null;
          return (
          <Card
            key={v.code}
            title={
              <button onClick={() => onOpenVendor(v)} className="flex items-center gap-2.5 text-left transition hover:text-violet-700">
                <Avatar name={v.name.replace(/^(บจก\.|หจก\.)\s*/, "")} size="sm" />
                {v.name}
              </button>
            }
            subtitle={`${v.contact} · ${v.terms}${last ? ` · ประเมินล่าสุด ${last.period}` : ""}`}
            action={
              <span className="flex items-center gap-1.5">
                {v.blocked && <Badge tone="bad" icon={<Ban size={11} />}>ระงับ</Badge>}
                {grade && (
                  <Badge tone={grade === "A" ? "ok" : grade === "B" ? "warn" : "bad"}>
                    เกรด {grade} · {reviewScore(last!)}
                  </Badge>
                )}
                <Badge tone={fillRate === null ? "idle" : fillRate === 100 ? "ok" : "warn"}>
                  {fillRate === null ? "ยังไม่มีใบที่ปิด" : `ส่งครบ ${fillRate}%`}
                </Badge>
              </span>
            }
          >
            <div className="grid grid-cols-4 gap-px bg-slate-100 dark:bg-slate-800">
              {[
                { label: "ใบสั่งซื้อ", value: orders + " ใบ" },
                { label: "มูลค่ารวม", value: baht(value) },
                { label: "เวลาส่ง", value: v.leadDays + " วัน" },
                { label: "ส่งตรงเวลา", value: onTime === null ? "—" : onTime + "%" },
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
            <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-100 px-4 py-2.5 dark:border-slate-800">
              {grade && <span className="mr-auto text-[11.5px] text-slate-400">{GRADE_MEANING[grade]}</span>}
              <Button variant="ghost" icon={<Star size={13} />} onClick={() => onAct({ kind: "review", vendor: v.code })}>
                ประเมิน
              </Button>
              <Button variant="ghost" icon={<Ban size={13} />} onClick={() => onAct({ kind: "blockVendor", vendor: v })}>
                {v.blocked ? "ยกเลิกการระงับ" : "ระงับการสั่งซื้อ"}
              </Button>
            </div>
          </Card>
          );
        })}
      </div>

      <Card
        title={<span className="flex items-center gap-2"><Star size={15} className="text-slate-400" />ประวัติการประเมิน</span>}
        subtitle="คะแนนสี่ด้าน ด้านละ 1–5 คิดเป็นคะแนนเต็มร้อย · A 80 ขึ้นไป · B 60–79 · C ต่ำกว่า 60"
      >
        <table className="w-full text-[13px]">
          <thead className="bg-slate-50/80 text-left text-[11px] uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">เลขที่</th>
              <th className="px-4 py-3 font-medium">งวด</th>
              <th className="px-4 py-3 font-medium">ผู้ขาย</th>
              <th className="px-4 py-3 text-right font-medium">คุณภาพ · ส่งมอบ · ราคา · บริการ</th>
              <th className="px-4 py-3 text-right font-medium">คะแนน</th>
              <th className="px-4 py-3 font-medium">ผู้ประเมิน</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {history.map((r) => {
              const score = reviewScore(r);
              const g = gradeOf(score);
              return (
                <tr key={r.no}>
                  <td className="px-4 py-2.5 font-mono text-[12px] text-slate-500 dark:text-slate-400">{r.no}</td>
                  <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{r.period}</td>
                  <td className="px-4 py-2.5 text-slate-900 dark:text-slate-50">
                    {vendor(r.vendor).name}
                    {r.note && <span className="block text-[11.5px] text-slate-400">{r.note}</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-300">
                    {r.quality} · {r.delivery} · {r.price} · {r.service}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Badge tone={g === "A" ? "ok" : g === "B" ? "warn" : "bad"}>
                      {score} · {g}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{r.by}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

/* --------------------------------------------------------------- records */

function MaterialRecord({ m, onAct }: { m: Material; onAct: (d: Dialog) => void }) {
  useData();
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
        <div className="flex w-full flex-wrap gap-1.5">
          <Button variant="secondary" icon={<Pencil size={13} />} onClick={() => onAct({ kind: "material", material: m })}>
            แก้ไขข้อมูล
          </Button>
          {m.group !== "สินค้าสำเร็จรูป" && (
            <Button
              variant="secondary"
              icon={<FilePlus2 size={13} />}
              onClick={() => onAct({ kind: "pr", lines: [{ material: m.code, qty: Math.max(1, m.reorder * 2 - m.stock), price: bestPriceFor(m.code)?.price ?? m.price }] })}
            >
              เปิดใบขอซื้อ
            </Button>
          )}
          <Button variant="secondary" icon={<Plus size={13} />} onClick={() => onAct({ kind: "move", material: m.code, moveKind: "เบิกใช้" })}>
            เบิกวัสดุ
          </Button>
          <Button variant="secondary" icon={<SlidersHorizontal size={13} />} onClick={() => onAct({ kind: "move", material: m.code, moveKind: "ปรับยอดลด" })}>
            ปรับยอด
          </Button>
          {m.group !== "สินค้าสำเร็จรูป" && (
            <Button variant="ghost" icon={<Coins size={13} />} onClick={() => onAct({ kind: "quote", material: m.code })}>
              บันทึกราคาที่เสนอ
            </Button>
          )}
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
            <IconRow icon={<TriangleAlert size={14} />} label="สต็อกขั้นต่ำ">{m.safety} {m.unit}</IconRow>
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

function PoRecord({ po, onAct }: { po: PurchaseOrder; onAct: (d: Dialog) => void }) {
  useData();
  const m = threeWayMatch(po);
  const grs = receiptsOf(po.no);
  const invs = invoicesOf(po.no);
  const labels = po.status === "ปิดยอดค้างรับ" ? [...PO_FLOW.slice(0, 3), "ปิดยอดค้างรับ"] : PO_FLOW;
  const at = labels.indexOf(po.status);
  const flow: { label: string; state: StepState }[] =
    po.status === "ยกเลิก"
      ? [{ label: "ร่าง", state: "done" }, { label: "ยกเลิก", state: "failed" }]
      : labels.map((s, i) => ({ label: s, state: i < at ? "done" : i === at ? "current" : "todo" }));
  const billable = m.received - m.invoice > 0 && po.status !== "ร่าง" && po.status !== "ยกเลิก";

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

      <div className="flex flex-wrap gap-1.5">
        {po.status === "ร่าง" && (
          <>
            <Button variant="primary" icon={<Send size={13} />} onClick={() => onAct({ kind: "sendPo", po })}>
              ลงนามและส่งผู้ขาย
            </Button>
            <Button variant="secondary" icon={<Pencil size={13} />} onClick={() => onAct({ kind: "po", po })}>
              แก้ไข
            </Button>
          </>
        )}
        {RECEIVABLE.includes(po.status) && (
          <Button variant="primary" icon={<PackagePlus size={13} />} onClick={() => onAct({ kind: "gr", po })}>
            รับของ
          </Button>
        )}
        {billable && (
          <Button variant="secondary" icon={<Receipt size={13} />} onClick={() => onAct({ kind: "invoice", po })}>
            บันทึกใบแจ้งหนี้
          </Button>
        )}
        {po.status !== "ยกเลิก" && (
          <Button variant="secondary" icon={<Printer size={13} />} onClick={() => onAct({ kind: "print", doc: { type: "po", po } })}>
            พิมพ์ใบสั่งซื้อ
          </Button>
        )}
        {po.status === "รับของบางส่วน" && (
          <Button variant="ghost" onClick={() => onAct({ kind: "closePo", po })}>
            ปิดยอดค้างรับ
          </Button>
        )}
        {canCancel(po) && (
          <Button variant="ghost" icon={<CircleX size={13} />} onClick={() => onAct({ kind: "cancelPo", po })}>
            ยกเลิกใบสั่งซื้อ
          </Button>
        )}
      </div>

      {po.status === "ยกเลิก" && <Note tone="bad">ยกเลิกแล้ว · {po.cancelReason}</Note>}
      {po.status === "ปิดยอดค้างรับ" && <Note tone="idle">ปิดยอดค้างรับแล้ว · {po.closeReason}</Note>}

      <div className="space-y-1">
        <IconRow icon={<Building size={14} />} label="ผู้ขาย">{vendor(po.vendor).name}</IconRow>
        <IconRow icon={<Receipt size={14} />} label="เงื่อนไขชำระ">{vendor(po.vendor).terms}</IconRow>
        <IconRow icon={<FileText size={14} />} label="วันที่สั่ง">{po.date}</IconRow>
        <IconRow icon={<Truck size={14} />} label="กำหนดส่ง">{po.deliverBy}</IconRow>
        <IconRow icon={<CircleCheck size={14} />} label="ผู้ลงนาม">
          {po.approvedBy ? `${po.approvedBy} · ${approver(po.approvedBy).role}` : "ยังไม่ได้ลงนาม"}
        </IconRow>
        {po.pr && <IconRow icon={<ClipboardList size={14} />} label="อ้างอิงใบขอซื้อ">{po.pr}</IconRow>}
        {po.note && <IconRow icon={<FileText size={14} />} label="หมายเหตุ">{po.note}</IconRow>}
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

      <Note tone={m.invoice === 0 ? "idle" : m.matched ? "ok" : m.invoice < m.received ? "idle" : "bad"}>
        {m.invoice === 0
          ? "ยังไม่มีใบแจ้งหนี้ ตรวจสามทางเมื่อผู้ขายวางบิล"
          : m.matched
            ? "สั่ง รับ และวางบิล ตรงกันทั้งสามทาง อนุมัติจ่ายได้"
            : m.invoice < m.received
              ? `ผู้ขายวางบิลไปแล้ว ${baht(m.invoice)} จากของที่รับ ${baht(m.received)} รอบิลส่วนที่เหลือ`
              : "ยอดวางบิลเกินของที่รับจริง " +
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
                <Badge tone={invoiceBadge(i).tone}>{invoiceBadge(i).label}</Badge>
                {i.blocked && (
                  <Button variant="ghost" onClick={() => onAct({ kind: "release", invoice: i })}>
                    ปลดระงับ
                  </Button>
                )}
                <span className="ml-auto tabular-nums text-slate-900 dark:text-slate-50">{baht(i.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function VendorRecord({ v, onAct }: { v: Vendor; onAct: (d: Dialog) => void }) {
  useData();
  const score = vendorScore(v.code);
  const last = latestReview(v.code);
  const orders = PURCHASE_ORDERS.filter((p) => p.vendor === v.code);
  const prices = INFO_RECORDS.filter((r) => r.vendor === v.code);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        <Button variant="secondary" icon={<Pencil size={13} />} onClick={() => onAct({ kind: "vendor", vendor: v })}>
          แก้ไข
        </Button>
        <Button variant="secondary" icon={<ShoppingCart size={13} />} disabled={v.blocked} onClick={() => onAct({ kind: "po", vendor: v.code })}>
          สร้างใบสั่งซื้อ
        </Button>
        <Button variant="secondary" icon={<Star size={13} />} onClick={() => onAct({ kind: "review", vendor: v.code })}>
          ประเมิน
        </Button>
        <Button variant="ghost" icon={<Ban size={13} />} onClick={() => onAct({ kind: "blockVendor", vendor: v })}>
          {v.blocked ? "ยกเลิกการระงับ" : "ระงับการสั่งซื้อ"}
        </Button>
      </div>
      {v.blocked && <Note tone="bad">ระงับการสั่งซื้อ · {v.blockReason}</Note>}
      <div className="space-y-1">
        <IconRow icon={<FileText size={14} />} label="รหัสผู้ขาย">{v.code}</IconRow>
        <IconRow icon={<Handshake size={14} />} label="ผู้ติดต่อ">{v.contact}</IconRow>
        <IconRow icon={<Receipt size={14} />} label="เงื่อนไขชำระ">{v.terms}</IconRow>
        <IconRow icon={<Truck size={14} />} label="เวลาส่งของ">{v.leadDays} วัน</IconRow>
        <IconRow icon={<Building size={14} />} label="เลขผู้เสียภาษี">{v.taxId}</IconRow>
        <IconRow icon={<Handshake size={14} />} label="โทรศัพท์">{v.phone}</IconRow>
        <IconRow icon={<Warehouse size={14} />} label="ที่อยู่">{v.address}</IconRow>
        {last && (
          <IconRow icon={<Star size={14} />} label="ผลประเมินล่าสุด">
            {last.period} · {reviewScore(last)} คะแนน เกรด {gradeOf(reviewScore(last))}
          </IconRow>
        )}
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

function PrRecord({
  pr,
  onAct,
  onOpenPo,
}: {
  pr: Requisition;
  onAct: (d: Dialog) => void;
  onOpenPo: (p: PurchaseOrder) => void;
}) {
  useData();
  const value = requisitionValue(pr);
  const po = pr.po ? PURCHASE_ORDERS.find((p) => p.no === pr.po) : undefined;
  const flow: { label: string; state: StepState }[] =
    pr.status === "ไม่อนุมัติ"
      ? [{ label: "รออนุมัติ", state: "done" }, { label: "ไม่อนุมัติ", state: "failed" }]
      : ["รออนุมัติ", "อนุมัติแล้ว", "แปลงเป็นใบสั่งซื้อแล้ว"].map((s, i, all) => {
          const at = all.indexOf(pr.status);
          return { label: s, state: i < at ? "done" : i === at ? "current" : "todo" };
        });

  return (
    <div className="space-y-4">
      <Stepper
        steps={flow}
        icons={{
          done: <CircleCheck size={14} />,
          current: <ClipboardList size={14} />,
          todo: <ClipboardList size={14} />,
          failed: <CircleX size={14} />,
        }}
      />

      <div className="flex flex-wrap gap-1.5">
        {pr.status === "รออนุมัติ" && (
          <>
            <Button variant="primary" icon={<CircleCheck size={13} />} onClick={() => onAct({ kind: "approvePr", pr })}>
              อนุมัติ
            </Button>
            <Button variant="secondary" icon={<Pencil size={13} />} onClick={() => onAct({ kind: "pr", pr })}>
              แก้ไข
            </Button>
            <Button variant="ghost" icon={<CircleX size={13} />} onClick={() => onAct({ kind: "rejectPr", pr })}>
              ไม่อนุมัติ
            </Button>
          </>
        )}
        {pr.status === "อนุมัติแล้ว" && (
          <Button variant="primary" icon={<ShoppingCart size={13} />} onClick={() => onAct({ kind: "convertPr", pr })}>
            แปลงเป็นใบสั่งซื้อ
          </Button>
        )}
        {po && (
          <Button variant="secondary" icon={<ShoppingCart size={13} />} onClick={() => onOpenPo(po)}>
            เปิด {po.no}
          </Button>
        )}
        <Button variant="secondary" icon={<Printer size={13} />} onClick={() => onAct({ kind: "print", doc: { type: "pr", pr } })}>
          พิมพ์ใบขอซื้อ
        </Button>
      </div>

      {pr.status === "ไม่อนุมัติ" && <Note tone="bad">ไม่อนุมัติ · {pr.rejectReason}</Note>}

      <div className="space-y-1">
        <IconRow icon={<Building size={14} />} label="หน่วยงานที่ขอ">{pr.requester}</IconRow>
        <IconRow icon={<FileText size={14} />} label="วันที่เปิด">{pr.date}</IconRow>
        <IconRow icon={<Truck size={14} />} label="ต้องการภายใน">{pr.needBy}</IconRow>
        <IconRow icon={<CircleCheck size={14} />} label="ผู้อนุมัติ">
          {pr.approvedBy
            ? `${pr.approvedBy} · ${approver(pr.approvedBy).role}`
            : `รอ${approverFor(value).role} (${approverFor(value).name}) อนุมัติ`}
        </IconRow>
        {pr.note && <IconRow icon={<FileText size={14} />} label="หมายเหตุ">{pr.note}</IconRow>}
      </div>

      <div>
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-400">รายการที่ขอซื้อ</p>
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {pr.lines.map((l) => {
            const m = material(l.material);
            return (
              <li key={l.material} className="flex flex-wrap items-center gap-3 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] text-slate-900 dark:text-slate-50">{m.name}</span>
                  <span className="block font-mono text-[11px] text-slate-400">
                    {l.material} · คงเหลือ {m.stock} {m.unit}
                  </span>
                </span>
                <span className="w-36 shrink-0 text-right text-[12.5px] tabular-nums text-slate-500 dark:text-slate-400">
                  {baht(l.price)} × {l.qty} {m.unit}
                </span>
                <span className="w-28 shrink-0 text-right text-[13px] tabular-nums text-slate-900 dark:text-slate-50">
                  {baht(l.price * l.qty)}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-right text-[13px] font-semibold tabular-nums text-slate-900 dark:text-slate-50">
          มูลค่าก่อนภาษี {baht(value)}
        </p>
      </div>
    </div>
  );
}
