import { useState } from "react";
import type { ReactNode } from "react";
import {
  CalendarClock, CircleCheck, ClipboardCheck, FilePlus2, FileSpreadsheet, FileWarning, Gauge as GaugeIcon, Handshake,
  ListChecks, MessageSquareWarning, Microscope, PencilRuler, Plus, Printer, ShieldCheck, Smile, Target, Truck, Users,
} from "lucide-react";
import { TODAY, capaByNo } from "../ims/data";
import { ImsActions } from "../ims/forms";
import type { Act as ImsAct } from "../ims/forms";
import { Body, Empty, Header, Line, Lines, STEP_ICONS, newest, tone } from "../ims/parts";
import {
  APPROVALS, DESIGNS, DESIGN_STAGES, GAUGES, LOTS, NCRS, NCR_SOURCES, SATISFACTION_CRITERIA, SURVEYS, approvalDue,
  awaitingApproval, calState, carOfNcr, commitments, confirmedBeforeReview, customerName, designByNo, indicators,
  materialName, materialUnit, nextDue, nextStage, overallSatisfaction, pendingInspections, planOf, released, reviewOf,
  satisfactionByCustomer, supplierRegister, unreviewed, vendorName,
} from "./data";
import type { DesignProject, Gauge, InspectionLot, Ncr } from "./data";
import { QmActions } from "./forms";
import type { Act, RecordKind } from "./forms";
import { Badge, Bar, Button, Card, Chip, Donut, IconRow, Metric, Note, PageHead, Reveal, Segmented, Stepper, swatchFor } from "../ui";
import type { Tone } from "../ui";
import { DataTable, DetailModal, downloadCsv, notify, useData } from "../kit";
import type { Column } from "../kit";

const TABS = ["ตรวจสอบคุณภาพ", "สิ่งที่ไม่เป็นไปตามข้อกำหนด", "สอบเทียบเครื่องมือวัด", "ทบทวนข้อกำหนดลูกค้า", "ออกแบบและพัฒนา", "ผู้ส่งมอบที่อนุมัติ", "ความพึงพอใจลูกค้า"];

const exportIcon = <FileSpreadsheet size={14} />;
const lotState = (l: InspectionLot) => (l.status === "ตัดสินแล้ว" ? l.decision! : l.status);
const sourceSwatch = (s: string) => swatchFor(s, NCR_SOURCES);
const csv = (name: string, head: string[], rows: (string | number)[][]) => {
  downloadCsv(name, head, rows);
  notify(`ส่งออก${name} ${rows.length} รายการแล้ว`);
};
const designSteps = (d: DesignProject) =>
  DESIGN_STAGES.map((s, i) => ({ label: s, state: (i < d.records.length ? "done" : i === d.records.length ? "current" : "todo") as "done" | "current" | "todo" }));

type Handlers = { onAct: (a: Act) => void; onOpen: (kind: RecordKind, key: string) => void; onIms: (a: ImsAct) => void };

/* ----------------------------------------------------------------- screen */

export default function QmScreen({ section, onOpenSection }: { section?: string; onOpenSection?: (index: number) => void }) {
  useData();
  const tab = section && TABS.includes(section) ? section : undefined;
  const [act, setAct] = useState<Act | null>(null);
  const [imsAct, setImsAct] = useState<ImsAct | null>(null);
  const [record, setRecord] = useState<{ kind: RecordKind; key: string } | null>(null);
  const open = (kind: RecordKind, key: string) => setRecord({ kind, key });

  const keys: Record<RecordKind, string[]> = {
    lot: newest(LOTS).map((l) => l.no),
    ncr: newest(NCRS).map((n) => n.no),
    gauge: GAUGES.map((g) => g.code),
    design: newest(DESIGNS).map((d) => d.no),
    supplier: supplierRegister().map((s) => s.vendor.code),
    survey: newest(SURVEYS).map((s) => s.no),
  };
  const list = record ? keys[record.kind] : [];
  const at = record ? list.indexOf(record.key) : -1;
  const TITLES: Record<RecordKind, string> = { lot: "ล็อตตรวจ", ncr: "สิ่งที่ไม่เป็นไปตามข้อกำหนด", gauge: "เครื่องมือวัด", design: "โครงการออกแบบ", supplier: "ผู้ส่งมอบ", survey: "แบบสำรวจความพึงพอใจ" };
  const h: Handlers = { onAct: setAct, onOpen: open, onIms: setImsAct };

  const panels = (
    <>
      <DetailModal
        open={record !== null && at >= 0}
        title={record ? TITLES[record.kind] : ""}
        onClose={() => setRecord(null)}
        index={at}
        total={list.length}
        onStep={(d) => record && setRecord({ kind: record.kind, key: list[Math.min(list.length - 1, Math.max(0, at + d))] })}
      >
        {record && at >= 0 && <RecordView kind={record.kind} id={record.key} {...h} />}
      </DetailModal>
      <QmActions act={act} onAct={setAct} onOpen={open} />
      <ImsActions act={imsAct} onAct={setImsAct} onOpen={(kind, no) => kind === "car" && notify(`ติดตาม ${no} ได้ที่ระบบบริหารบูรณาการ · การแก้ไขและป้องกัน`, "info")} />
    </>
  );

  const firstPending = unreviewed()[0]?.doc ?? commitments()[0].doc;
  const index = (
    <div hidden data-fitt-index>
      <button data-fitt-screen="บริหารคุณภาพ" />
      <button data-fitt-screen="ล็อตตรวจ" data-fitt-modal onClick={() => open("lot", LOTS[0].no)} />
      <button data-fitt-screen="เปิดล็อตตรวจ" data-fitt-modal onClick={() => setAct({ kind: "lot-new" })} />
      <button data-fitt-screen="บันทึกผลตรวจ" data-fitt-modal onClick={() => setAct({ kind: "lot-results", no: LOTS.find((l) => l.status !== "ตัดสินแล้ว")?.no ?? LOTS[0].no })} />
      <button data-fitt-screen="ตัดสินผลการตรวจ" data-fitt-modal onClick={() => setAct({ kind: "lot-decide", no: LOTS.find((l) => l.status === "รอตัดสิน")?.no ?? LOTS[0].no })} />
      <button data-fitt-screen="สิ่งที่ไม่เป็นไปตามข้อกำหนด" data-fitt-modal onClick={() => open("ncr", NCRS[NCRS.length - 1].no)} />
      <button data-fitt-screen="เปิด NCR" data-fitt-modal onClick={() => setAct({ kind: "ncr-new" })} />
      <button data-fitt-screen="รับเรื่องร้องเรียนจากลูกค้า" data-fitt-modal onClick={() => setAct({ kind: "complaint-new" })} />
      <button data-fitt-screen="สั่งการ NCR" data-fitt-modal onClick={() => setAct({ kind: "ncr-dispose", no: NCRS.find((n) => n.status === "รอสั่งการ")?.no ?? NCRS[0].no })} />
      <button data-fitt-screen="ปิด NCR" data-fitt-modal onClick={() => setAct({ kind: "ncr-close", no: NCRS.find((n) => n.status === "ดำเนินการ")?.no ?? NCRS[0].no })} />
      <button data-fitt-screen="ออก CAR จาก NCR" data-fitt-modal onClick={() => setImsAct({ kind: "car-new", ref: NCRS[NCRS.length - 1].no, problem: NCRS[NCRS.length - 1].description })} />
      <button data-fitt-screen="เครื่องมือวัด" data-fitt-modal onClick={() => open("gauge", GAUGES[0].code)} />
      <button data-fitt-screen="ขึ้นทะเบียนเครื่องมือวัด" data-fitt-modal onClick={() => setAct({ kind: "gauge-new" })} />
      <button data-fitt-screen="บันทึกผลสอบเทียบ" data-fitt-modal onClick={() => setAct({ kind: "gauge-cal", code: GAUGES[0].code })} />
      <button data-fitt-screen="ทบทวนข้อกำหนดลูกค้า" data-fitt-modal onClick={() => setAct({ kind: "req-review", doc: firstPending })} />
      <button data-fitt-screen="โครงการออกแบบ" data-fitt-modal onClick={() => open("design", DESIGNS[0].no)} />
      <button data-fitt-screen="เปิดโครงการออกแบบ" data-fitt-modal onClick={() => setAct({ kind: "design-new" })} />
      <button data-fitt-screen="บันทึกขั้นการออกแบบ" data-fitt-modal onClick={() => setAct({ kind: "design-stage", no: DESIGNS.find((d) => nextStage(d))?.no ?? DESIGNS[0].no })} />
      <button data-fitt-screen="ควบคุมการเปลี่ยนแปลงแบบ" data-fitt-modal onClick={() => setAct({ kind: "design-change", no: DESIGNS.find(released)?.no ?? DESIGNS[0].no })} />
      <button data-fitt-screen="ผู้ส่งมอบ" data-fitt-modal onClick={() => open("supplier", APPROVALS[0].vendor)} />
      <button data-fitt-screen="ประเมินผู้ส่งมอบ" data-fitt-modal onClick={() => setAct({ kind: "supplier-evaluate", code: APPROVALS[0].vendor })} />
      <button data-fitt-screen="แบบสำรวจความพึงพอใจ" data-fitt-modal onClick={() => open("survey", SURVEYS[0].no)} />
      <button data-fitt-screen="บันทึกแบบสำรวจความพึงพอใจ" data-fitt-modal onClick={() => setAct({ kind: "survey-new" })} />
      <button data-fitt-screen="พิมพ์ใบรับรองคุณภาพ" data-fitt-modal onClick={() => setAct({ kind: "print", d: { doc: "lot", no: LOTS.find((l) => l.origin === "ตรวจก่อนส่ง")!.no }, title: "ใบรับรองคุณภาพสินค้า" })} />
      <button data-fitt-screen="พิมพ์ NCR" data-fitt-modal onClick={() => setAct({ kind: "print", d: { doc: "ncr", no: NCRS[0].no }, title: "ใบรายงานสิ่งที่ไม่เป็นไปตามข้อกำหนด" })} />
      <button data-fitt-screen="พิมพ์ประวัติการสอบเทียบ" data-fitt-modal onClick={() => setAct({ kind: "print", d: { doc: "gauge", code: GAUGES[0].code }, title: "บันทึกประวัติการสอบเทียบ" })} />
      <button data-fitt-screen="พิมพ์ใบทบทวนข้อกำหนดลูกค้า" data-fitt-modal onClick={() => setAct({ kind: "print", d: { doc: "requirement", no: commitments()[0].doc }, title: "ใบทบทวนข้อกำหนดลูกค้า" })} />
      <button data-fitt-screen="พิมพ์บันทึกการออกแบบ" data-fitt-modal onClick={() => setAct({ kind: "print", d: { doc: "design", no: DESIGNS[0].no }, title: "บันทึกการออกแบบและพัฒนา" })} />
      <button data-fitt-screen="พิมพ์ใบประเมินผู้ส่งมอบ" data-fitt-modal onClick={() => setAct({ kind: "print", d: { doc: "supplier", code: APPROVALS[0].vendor }, title: "ใบประเมินผู้ส่งมอบประจำปี" })} />
      <button data-fitt-screen="พิมพ์สรุปความพึงพอใจลูกค้า" data-fitt-modal onClick={() => setAct({ kind: "print", d: { doc: "satisfaction" }, title: "สรุปผลสำรวจความพึงพอใจลูกค้า" })} />
    </div>
  );

  if (!tab) {
    return (
      <>
        <Overview onOpenSection={onOpenSection} {...h} />
        {panels}
        {index}
      </>
    );
  }

  return (
    <div>
      <PageHead title="บริหารคุณภาพ" meta={`${tab} · ISO 9001:2015 · ข้อมูล ณ ${TODAY}`} />
      {tab === "ตรวจสอบคุณภาพ" && <Inspection {...h} />}
      {tab === "สิ่งที่ไม่เป็นไปตามข้อกำหนด" && <Nonconformance {...h} />}
      {tab === "สอบเทียบเครื่องมือวัด" && <Calibration {...h} />}
      {tab === "ทบทวนข้อกำหนดลูกค้า" && <Requirements {...h} />}
      {tab === "ออกแบบและพัฒนา" && <Designs {...h} />}
      {tab === "ผู้ส่งมอบที่อนุมัติ" && <Suppliers {...h} />}
      {tab === "ความพึงพอใจลูกค้า" && <Satisfaction {...h} />}
      {panels}
      {index}
    </div>
  );
}

/* -------------------------------------------------------------- overview */

function Overview({ onOpenSection, onAct, onOpen }: Handlers & { onOpenSection?: (i: number) => void }) {
  const pending = pendingInspections();
  const waiting = LOTS.filter((l) => l.status !== "ตัดสินแล้ว");
  const openNcrs = NCRS.filter((n) => n.status !== "ปิดแล้ว");
  const gauges = GAUGES.filter((g) => ["เกินกำหนด", "ใกล้ครบ", "พักใช้"].includes(calState(g)));
  const kpis = indicators();
  const bySource = NCR_SOURCES.map((s) => ({ label: s, value: NCRS.filter((n) => n.source === s).length, swatch: sourceSwatch(s) })).filter((x) => x.value > 0);
  const suppliers = supplierRegister().filter((s) => s.quality.lots > 0);
  const avg = overallSatisfaction();

  const todo: { icon: ReactNode; text: string; sub: string; go: () => void; tone: Tone }[] = [
    ...pending.map((p) => ({ icon: <Microscope size={15} />, text: `${p.origin} ${materialName(p.material)} ${p.qty.toLocaleString("th-TH")} ${materialUnit(p.material)}`, sub: `${p.source} · ยังไม่เปิดล็อตตรวจ`, go: () => onAct({ kind: "lot-new", source: p.source, material: p.material }), tone: "warn" as Tone })),
    ...waiting.map((l) => ({ icon: <ClipboardCheck size={15} />, text: `${l.no} ${materialName(l.material)}`, sub: l.status === "รอตรวจ" ? "รอบันทึกผลตรวจ" : "รอตัดสินผล", go: () => onOpen("lot", l.no), tone: "warn" as Tone })),
    ...openNcrs.filter((n) => n.status === "รอสั่งการ").map((n) => ({ icon: <FileWarning size={15} />, text: `${n.no} ${n.material ? materialName(n.material) : n.ref}`, sub: `${n.source} · รอสั่งการ`, go: () => onOpen("ncr", n.no), tone: "bad" as Tone })),
    ...confirmedBeforeReview().map((c) => ({ icon: <Handshake size={15} />, text: `${c.doc} ${customerName(c.customer)}`, sub: "ยืนยันกับลูกค้าแล้วแต่ยังไม่ได้ทบทวนข้อกำหนด", go: () => onAct({ kind: "req-review", doc: c.doc }), tone: "bad" as Tone })),
    ...gauges.map((g) => ({ icon: <GaugeIcon size={15} />, text: `${g.code} ${g.name}`, sub: calState(g) === "พักใช้" ? "พักใช้ รอซ่อมหรือสอบเทียบใหม่" : `${calState(g)} · ครบกำหนด ${nextDue(g)}`, go: () => onOpen("gauge", g.code), tone: (calState(g) === "ใกล้ครบ" ? "warn" : "bad") as Tone })),
    ...awaitingApproval().map((s) => ({ icon: <Truck size={15} />, text: s.vendor.name, sub: "ผู้ขายใหม่ยังไม่ผ่านการประเมิน", go: () => onAct({ kind: "supplier-evaluate", code: s.vendor.code }), tone: "bad" as Tone })),
    ...approvalDue().map((a) => ({ icon: <Truck size={15} />, text: vendorName(a.vendor), sub: `ถึงรอบประเมินผู้ส่งมอบ ${a.nextReview}`, go: () => onOpen("supplier", a.vendor), tone: "info" as Tone })),
  ];

  return (
    <div>
      <PageHead
        title="บริหารคุณภาพ"
        meta={`ISO 9001:2015 · ข้อมูล ณ ${TODAY}`}
        right={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" icon={<MessageSquareWarning size={14} />} onClick={() => onAct({ kind: "complaint-new" })}>รับเรื่องร้องเรียน</Button>
            <Button icon={<FileWarning size={14} />} onClick={() => onAct({ kind: "ncr-new" })}>เปิด NCR</Button>
          </div>
        }
      />
      <Reveal>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Metric icon={<Microscope size={17} />} label="ของรอตรวจ" value={`${pending.length + waiting.length} รายการ`} deltaLabel={`เปิดล็อตแล้ว ${waiting.length} · ยังไม่เปิด ${pending.length}`} />
          <Metric icon={<FileWarning size={17} />} label="NCR เปิดอยู่" value={`${openNcrs.length} เรื่อง`} deltaLabel={`รอสั่งการ ${openNcrs.filter((n) => n.status === "รอสั่งการ").length}`} />
          <Metric icon={<Handshake size={17} />} label="ข้อตกลงรอทบทวน" value={`${unreviewed().length} ใบ`} deltaLabel={`ยืนยันก่อนทบทวน ${confirmedBeforeReview().length} ใบ`} />
          <Metric icon={<Smile size={17} />} label="ความพึงพอใจลูกค้า" value={avg === undefined ? "—" : `${avg} / 5`} deltaLabel={`สำรวจแล้ว ${satisfactionByCustomer().filter((x) => x.last).length} ราย`} />
        </div>
      </Reveal>

      <Reveal delay={0.06} className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card title="ตัวชี้วัดคุณภาพ" subtitle="วัดจากงานจริงในระบบ และส่งเข้าวาระทบทวนโดยฝ่ายบริหาร" className="lg:col-span-2">
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {kpis.map((o) => (
              <li key={o.name} className="flex items-center gap-3 px-4 py-3">
                <Target size={15} className={o.met ? "shrink-0 text-emerald-500" : "shrink-0 text-rose-500"} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] text-slate-800 dark:text-slate-100">{o.name}</p>
                  <p className="text-[11.5px] text-slate-500 dark:text-slate-400">เป้า {o.better === "higher" ? "≥" : "≤"} {o.target}{o.unit === "%" ? "%" : ` ${o.unit}`}</p>
                </div>
                <span className="w-20 text-right text-[14px] font-semibold tabular-nums text-slate-900 dark:text-slate-50">{o.actual}{o.unit === "%" ? "%" : ` ${o.unit}`}</span>
                <Badge tone={o.met ? "ok" : "bad"}>{o.met ? "ถึงเป้า" : "ต่ำกว่าเป้า"}</Badge>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="NCR ตามแหล่งที่พบ" subtitle="พบเองก่อนถึงลูกค้าดีกว่าลูกค้าเป็นคนพบ">
          <div className="p-4">
            <Donut segments={bySource} center={<span className="text-[20px] font-semibold tabular-nums">{NCRS.length}</span>} format={(n) => `${n} เรื่อง`} />
          </div>
        </Card>
      </Reveal>

      <Reveal delay={0.12} className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card title="ต้องจัดการ" subtitle="กดรายการเพื่อเปิดงานนั้น" className="lg:col-span-2">
          {todo.length === 0 ? (
            <Empty>ไม่มีงานค้าง</Empty>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {todo.slice(0, 10).map((t, i) => (
                <li key={i}>
                  <button onClick={t.go} className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/60">
                    <span className={t.tone === "bad" ? "text-rose-500" : t.tone === "warn" ? "text-amber-500" : "text-sky-500"}>{t.icon}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] text-slate-800 dark:text-slate-100">{t.text}</span>
                      <span className="block text-[11.5px] text-slate-500 dark:text-slate-400">{t.sub}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="คุณภาพผู้ส่งมอบ" subtitle="ล็อตผ่านการตรวจรับครั้งแรก (ข้อ 8.4)" action={<Button variant="ghost" className="whitespace-nowrap" onClick={() => onOpenSection?.(5)}>ดูทะเบียน</Button>}>
          <ul className="space-y-3 p-4">
            {suppliers.map((s) => (
              <li key={s.vendor.code}>
                <div className="flex items-baseline justify-between gap-2 text-[12.5px]">
                  <span className="truncate text-slate-700 dark:text-slate-200">{s.vendor.name}</span>
                  <span className="shrink-0 tabular-nums text-slate-500">{s.quality.accepted}/{s.quality.lots}</span>
                </div>
                <div className="mt-1"><Bar pct={s.quality.score} tone={s.quality.score >= 90 ? "ok" : s.quality.score >= 70 ? "warn" : "bad"} width="w-full" /></div>
              </li>
            ))}
          </ul>
        </Card>
      </Reveal>
    </div>
  );
}

/* ------------------------------------------------------------ inspection */

function Inspection({ onAct, onOpen }: Handlers) {
  const [origin, setOrigin] = useState("ทั้งหมด");
  const pending = pendingInspections();
  const rows = newest(LOTS).filter((l) => origin === "ทั้งหมด" || l.origin === origin);
  const columns: Column<InspectionLot>[] = [
    { key: "no", header: "เลขที่", cell: (l) => <span className="font-medium tabular-nums text-slate-800 dark:text-slate-100">{l.no}</span>, sort: (a, b) => a.no.localeCompare(b.no) },
    { key: "origin", header: "ประเภท", cell: (l) => <Chip>{l.origin}</Chip> },
    { key: "item", header: "รายการ", cell: (l) => materialName(l.material) },
    { key: "qty", header: "จำนวน / ตัวอย่าง", align: "right", cell: (l) => <span className="tabular-nums">{l.qty.toLocaleString("th-TH")} / {l.sample}</span> },
    { key: "source", header: "ต้นทาง", cell: (l) => <span className="tabular-nums text-slate-500">{l.source}</span> },
    { key: "vendor", header: "ผู้ขาย", cell: (l) => (l.vendor ? vendorName(l.vendor) : "ฝ่ายผลิต") },
    { key: "state", header: "ผล", cell: (l) => <Badge dot tone={tone(lotState(l))}>{lotState(l)}</Badge> },
  ];
  return (
    <div className="space-y-4">
      <Card title="ของที่รับเข้ามาแต่ยังไม่ได้ตรวจ" subtitle="อ่านจากใบรับของของจัดซื้อและการรับสินค้าผลิตเสร็จ บันทึกที่ระบบอื่นแล้วขึ้นที่นี่ทันที">
        {pending.length === 0 ? (
          <Empty>เปิดล็อตตรวจครบทุกใบแล้ว</Empty>
        ) : (
          <Lines>
            {pending.map((p) => (
              <Line
                key={`${p.source}-${p.material}`}
                title={`${materialName(p.material)} ${p.qty.toLocaleString("th-TH")} ${materialUnit(p.material)}`}
                sub={`${p.origin} · ${p.source} · ${p.date}${p.vendor ? ` · ${vendorName(p.vendor)}` : ""}`}
                right={<Button variant="secondary" icon={<Plus size={14} />} onClick={() => onAct({ kind: "lot-new", source: p.source, material: p.material })}>เปิดล็อตตรวจ</Button>}
              />
            ))}
          </Lines>
        )}
      </Card>
      <DataTable
        rows={rows}
        columns={columns}
        getId={(l) => l.no}
        onOpen={(l) => onOpen("lot", l.no)}
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <Segmented options={["ทั้งหมด", "ตรวจรับ", "ตรวจก่อนส่ง"]} value={origin} onChange={setOrigin} />
            <Button className="ml-auto" variant="secondary" icon={exportIcon} onClick={() => csv("ล็อตตรวจ", ["เลขที่", "ประเภท", "รายการ", "จำนวน", "ตัวอย่าง", "ต้นทาง", "ผู้ขาย", "ผล", "ผู้ตรวจ", "วันที่ตัดสิน"], rows.map((l) => [l.no, l.origin, materialName(l.material), l.qty, l.sample, l.source, l.vendor ? vendorName(l.vendor) : "ฝ่ายผลิต", lotState(l), l.inspector ?? "", l.decidedOn ?? ""]))}>ส่งออก Excel</Button>
          </div>
        }
      />
    </div>
  );
}

/* ------------------------------------------------------------------- ncr */

function Nonconformance({ onAct, onOpen }: Handlers) {
  const [status, setStatus] = useState("ยังไม่ปิด");
  const rows = newest(NCRS).filter((n) => status === "ทั้งหมด" || (status === "ยังไม่ปิด" ? n.status !== "ปิดแล้ว" : n.status === "ปิดแล้ว"));
  const columns: Column<Ncr>[] = [
    { key: "no", header: "เลขที่", cell: (n) => <span className="font-medium tabular-nums text-slate-800 dark:text-slate-100">{n.no}</span>, sort: (a, b) => a.no.localeCompare(b.no) },
    { key: "date", header: "วันที่", cell: (n) => n.date, sort: (a, b) => a.date.localeCompare(b.date) },
    { key: "source", header: "พบที่", cell: (n) => <span className="flex items-center gap-1.5"><span className={"size-2 rounded-full " + sourceSwatch(n.source).dot} />{n.source}</span> },
    { key: "item", header: "รายการ", cell: (n) => (n.material ? materialName(n.material) : n.ref) },
    { key: "party", header: "ผู้ขาย / ลูกค้า", cell: (n) => (n.customer ? customerName(n.customer) : n.vendor ? vendorName(n.vendor) : "—") },
    { key: "severity", header: "ความรุนแรง", cell: (n) => <Badge tone={tone(n.severity)}>{n.severity}</Badge> },
    { key: "status", header: "สถานะ", cell: (n) => <Badge dot tone={tone(n.status)}>{n.status}</Badge> },
    { key: "car", header: "CAR", cell: (n) => <span className="tabular-nums text-slate-500">{carOfNcr(n)?.no ?? "—"}</span> },
  ];
  return (
    <DataTable
      rows={rows}
      columns={columns}
      getId={(n) => n.no}
      onOpen={(n) => onOpen("ncr", n.no)}
      toolbar={
        <div className="flex flex-wrap items-center gap-2">
          <Segmented options={["ยังไม่ปิด", "ปิดแล้ว", "ทั้งหมด"]} value={status} onChange={setStatus} counts={{ "ยังไม่ปิด": NCRS.filter((n) => n.status !== "ปิดแล้ว").length }} />
          <div className="ml-auto flex flex-wrap gap-2">
            <Button variant="secondary" icon={exportIcon} onClick={() => csv("NCR", ["เลขที่", "วันที่", "พบที่", "อ้างอิง", "รายการ", "จำนวน", "ความรุนแรง", "สถานะ", "การสั่งการ", "CAR"], rows.map((n) => [n.no, n.date, n.source, n.ref, n.material ? materialName(n.material) : "", n.qty, n.severity, n.status, n.disposition ?? "", carOfNcr(n)?.no ?? ""]))}>ส่งออก Excel</Button>
            <Button variant="secondary" icon={<MessageSquareWarning size={14} />} onClick={() => onAct({ kind: "complaint-new" })}>รับเรื่องร้องเรียน</Button>
            <Button icon={<FileWarning size={14} />} onClick={() => onAct({ kind: "ncr-new" })}>เปิด NCR</Button>
          </div>
        </div>
      }
    />
  );
}

/* ----------------------------------------------------------- calibration */

function Calibration({ onAct, onOpen }: Handlers) {
  const columns: Column<Gauge>[] = [
    { key: "code", header: "รหัส", cell: (g) => <span className="font-medium tabular-nums text-slate-800 dark:text-slate-100">{g.code}</span>, sort: (a, b) => a.code.localeCompare(b.code) },
    { key: "name", header: "เครื่องมือ", cell: (g) => g.name },
    { key: "range", header: "ช่วงการวัด", cell: (g) => g.range },
    { key: "location", header: "ที่ใช้งาน", cell: (g) => g.location },
    { key: "interval", header: "รอบ", cell: (g) => `${g.intervalMonths} เดือน` },
    { key: "last", header: "สอบเทียบล่าสุด", cell: (g) => g.lastCal, sort: (a, b) => a.lastCal.localeCompare(b.lastCal) },
    { key: "due", header: "ครบกำหนด", cell: (g) => nextDue(g), sort: (a, b) => nextDue(a).localeCompare(nextDue(b)) },
    { key: "state", header: "สถานะ", cell: (g) => <Badge dot tone={tone(calState(g))}>{calState(g)}</Badge> },
  ];
  const states = ["ปกติ", "ใกล้ครบ", "เกินกำหนด", "พักใช้"] as const;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        {states.map((s) => (
          <div key={s} className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <Badge dot tone={tone(s)}>{s}</Badge>
            <p className="mt-2 text-[22px] font-semibold tabular-nums text-slate-900 dark:text-slate-50">{GAUGES.filter((g) => calState(g) === s).length}</p>
          </div>
        ))}
      </div>
      <DataTable
        rows={GAUGES}
        columns={columns}
        getId={(g) => g.code}
        onOpen={(g) => onOpen("gauge", g.code)}
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[12.5px] text-slate-500 dark:text-slate-400">เครื่องมือที่ไม่ผ่านถูกพักใช้ และเปิด NCR ให้ทบทวนผลการวัดที่ผ่านมา (ข้อ 7.1.5)</p>
            <div className="ml-auto flex gap-2">
              <Button variant="secondary" icon={exportIcon} onClick={() => csv("ทะเบียนเครื่องมือวัด", ["รหัส", "เครื่องมือ", "ช่วงการวัด", "ความละเอียด", "ที่ใช้งาน", "รอบ (เดือน)", "สอบเทียบล่าสุด", "ครบกำหนด", "สถานะ"], GAUGES.map((g) => [g.code, g.name, g.range, g.resolution, g.location, g.intervalMonths, g.lastCal, nextDue(g), calState(g)]))}>ส่งออก Excel</Button>
              <Button icon={<Plus size={14} />} onClick={() => onAct({ kind: "gauge-new" })}>ขึ้นทะเบียนเครื่องมือ</Button>
            </div>
          </div>
        }
      />
    </div>
  );
}

/* ================================================ customer requirements */

type Commitment = ReturnType<typeof commitments>[number];

function Requirements({ onAct }: Handlers) {
  const [show, setShow] = useState("รอทบทวน");
  const all = commitments();
  const rows = all.filter((c) => show === "ทั้งหมด" || (show === "รอทบทวน" ? !reviewOf(c.doc) : !!reviewOf(c.doc)));
  const late = new Set(confirmedBeforeReview().map((c) => c.doc));
  const printIt = (doc: string) => onAct({ kind: "print", d: { doc: "requirement", no: doc }, title: "ใบทบทวนข้อกำหนดลูกค้า" });
  const columns: Column<Commitment>[] = [
    { key: "doc", header: "เอกสาร", cell: (c) => <span className="font-medium tabular-nums text-slate-800 dark:text-slate-100">{c.doc}</span>, sort: (a, b) => a.doc.localeCompare(b.doc) },
    { key: "kind", header: "ประเภท", cell: (c) => <Chip>{c.kind}</Chip> },
    { key: "customer", header: "ลูกค้า", cell: (c) => customerName(c.customer) },
    { key: "date", header: "วันที่", cell: (c) => c.date, sort: (a, b) => a.date.localeCompare(b.date) },
    { key: "items", header: "รายการ", cell: (c) => <span className="text-slate-500">{c.lines.map((l) => `${materialName(l.material)} ×${l.qty}`).join(", ")}</span> },
    {
      key: "result", header: "ผลทบทวน",
      cell: (c) => {
        const r = reviewOf(c.doc);
        if (r) return <Badge dot tone={tone(r.result)}>{r.result}</Badge>;
        return <Badge dot tone={late.has(c.doc) ? "bad" : "idle"}>{late.has(c.doc) ? "ยืนยันก่อนทบทวน" : "รอทบทวน"}</Badge>;
      },
    },
  ];
  return (
    <div className="space-y-4">
      {late.size > 0 && <Note tone="bad">ใบสั่งขาย {late.size} ใบยืนยันกับลูกค้าไปแล้วโดยยังไม่ทบทวนข้อกำหนด — ผู้ตรวจประเมินจะถามทุกใบ (ข้อ 8.2.3)</Note>}
      <DataTable
        rows={rows}
        columns={columns}
        getId={(c) => c.doc}
        onOpen={(c) => (reviewOf(c.doc) ? printIt(c.doc) : onAct({ kind: "req-review", doc: c.doc }))}
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <Segmented options={["รอทบทวน", "ทบทวนแล้ว", "ทั้งหมด"]} value={show} onChange={setShow} counts={{ "รอทบทวน": unreviewed().length }} />
            <p className="text-[12.5px] text-slate-500 dark:text-slate-400">กดแถวที่รอเพื่อทบทวน กดแถวที่ทบทวนแล้วเพื่อพิมพ์</p>
            <Button className="ml-auto" variant="secondary" icon={exportIcon} onClick={() => csv("การทบทวนข้อกำหนดลูกค้า", ["เอกสาร", "ประเภท", "ลูกค้า", "วันที่", "ผล", "ผู้ทบทวน", "เงื่อนไข"], all.map((c) => [c.doc, c.kind, customerName(c.customer), c.date, reviewOf(c.doc)?.result ?? "รอทบทวน", reviewOf(c.doc)?.by ?? "", reviewOf(c.doc)?.note ?? ""]))}>ส่งออก Excel</Button>
          </div>
        }
      />
    </div>
  );
}

/* ================================================== design and development */

function Designs({ onAct, onOpen }: Handlers) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[12.5px] text-slate-500 dark:text-slate-400">ออกแบบทีละขั้น ข้ามขั้นไม่ได้ ทวนสอบและรับรองโดยคนที่ไม่ใช่ผู้ออกแบบ (ข้อ 8.3)</p>
        <div className="ml-auto flex gap-2">
          <Button variant="secondary" icon={exportIcon} onClick={() => csv("โครงการออกแบบ", ["เลขที่", "ผลิตภัณฑ์", "ผู้รับผิดชอบ", "เริ่ม", "กำหนดเสร็จ", "ขั้นล่าสุด", "การเปลี่ยนแปลง"], DESIGNS.map((d) => [d.no, d.product, d.owner, d.started, d.target, d.records.at(-1)?.stage ?? "", d.changes.length]))}>ส่งออก Excel</Button>
          <Button icon={<PencilRuler size={14} />} onClick={() => onAct({ kind: "design-new" })}>เปิดโครงการออกแบบ</Button>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {newest(DESIGNS).map((d) => (
          <Card key={d.no} title={`${d.no} · ${d.product}`} subtitle={`${d.owner} · กำหนดเสร็จ ${d.target}`} action={<Button variant="ghost" onClick={() => onOpen("design", d.no)}>เปิด</Button>}>
            <div className="p-4">
              <Stepper steps={designSteps(d)} icons={STEP_ICONS} />
              <p className="mt-3 text-[12.5px] text-slate-500 dark:text-slate-400">{released(d) ? `ส่งมอบสู่การผลิตแล้ว · เปลี่ยนแปลงแบบ ${d.changes.length} ครั้ง` : `ขั้นถัดไป: ${nextStage(d)}`}</p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ================================================== approved suppliers */

type SupplierRow = ReturnType<typeof supplierRegister>[number];

function Suppliers({ onOpen }: Handlers) {
  const rows = supplierRegister();
  const columns: Column<SupplierRow>[] = [
    { key: "code", header: "รหัส", cell: (s) => <span className="font-medium tabular-nums text-slate-800 dark:text-slate-100">{s.vendor.code}</span> },
    { key: "name", header: "ผู้ขาย", cell: (s) => s.vendor.name },
    { key: "scope", header: "อนุมัติให้ส่ง", cell: (s) => <span className="text-slate-500">{s.approval?.scope.map(materialName).join(", ") || "—"}</span> },
    { key: "quality", header: "ล็อตผ่าน", align: "right", cell: (s) => <span className="tabular-nums">{s.quality.lots ? `${s.quality.score}%` : "—"}</span> },
    { key: "delivery", header: "ส่งตรงเวลา", align: "right", cell: (s) => <span className="tabular-nums">{s.delivery === null ? "—" : `${s.delivery}%`}</span> },
    { key: "grade", header: "เกรดจัดซื้อ", cell: (s) => (s.grade ? <Badge tone={s.grade === "A" ? "ok" : s.grade === "B" ? "warn" : "bad"}>{s.grade}</Badge> : "—") },
    { key: "status", header: "สถานะ", cell: (s) => <span className="flex flex-wrap gap-1.5"><Badge dot tone={tone(s.approval?.status ?? "รอประเมิน")}>{s.approval?.status ?? "รอประเมิน"}</Badge>{s.vendor.blocked && <Badge tone="bad">ระงับสั่งซื้อ</Badge>}</span> },
    { key: "next", header: "ประเมินครั้งถัดไป", cell: (s) => s.approval?.nextReview ?? "ก่อนสั่งซื้อครั้งแรก" },
  ];
  return (
    <div className="space-y-4">
      {awaitingApproval().length > 0 && <Note tone="bad">ผู้ขาย {awaitingApproval().length} รายยังไม่ผ่านการประเมิน — ต้องประเมินก่อนสั่งซื้อครั้งแรก (SP-07)</Note>}
      <DataTable
        rows={rows}
        columns={columns}
        getId={(s) => s.vendor.code}
        onOpen={(s) => onOpen("supplier", s.vendor.code)}
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[12.5px] text-slate-500 dark:text-slate-400">ผู้ขายอ่านจากระบบจัดซื้อ คุณภาพจากล็อตตรวจรับ เกรดจากการประเมินของฝ่ายจัดซื้อ ระงับที่นี่แล้วสั่งซื้อไม่ได้</p>
            <Button className="ml-auto" variant="secondary" icon={exportIcon} onClick={() => csv("ทะเบียนผู้ส่งมอบ", ["รหัส", "ผู้ขาย", "สถานะ", "อนุมัติให้ส่ง", "ล็อตผ่าน %", "ส่งตรงเวลา %", "เกรดจัดซื้อ", "ประเมินครั้งถัดไป"], rows.map((s) => [s.vendor.code, s.vendor.name, s.approval?.status ?? "รอประเมิน", s.approval?.scope.join(" ") ?? "", s.quality.score, s.delivery ?? "", s.grade ?? "", s.approval?.nextReview ?? ""]))}>ส่งออก Excel</Button>
          </div>
        }
      />
    </div>
  );
}

/* =================================================== customer satisfaction */

function Satisfaction({ onAct, onOpen }: Handlers) {
  const rows = satisfactionByCustomer();
  const avg = overallSatisfaction();
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[12.5px] text-slate-500 dark:text-slate-400">คะแนนที่ลูกค้าให้ วางคู่ข้อร้องเรียนที่ระบบนับเอง · เฉลี่ยทุกรายล่าสุด {avg ?? "—"} / 5</p>
        <div className="ml-auto flex gap-2">
          <Button variant="secondary" icon={<Printer size={14} />} onClick={() => onAct({ kind: "print", d: { doc: "satisfaction" }, title: "สรุปผลสำรวจความพึงพอใจลูกค้า" })}>พิมพ์สรุป</Button>
          <Button variant="secondary" icon={exportIcon} onClick={() => csv("แบบสำรวจความพึงพอใจ", ["เลขที่", "ลูกค้า", "รอบ", ...SATISFACTION_CRITERIA.map((c) => c.label), "ความเห็น", "สิ่งที่จะทำต่อ"], SURVEYS.map((v) => [v.no, customerName(v.customer), v.period, ...SATISFACTION_CRITERIA.map((c) => v.scores[c.key]), v.comment, v.followUp ?? ""]))}>ส่งออก Excel</Button>
          <Button icon={<Smile size={14} />} onClick={() => onAct({ kind: "survey-new" })}>บันทึกแบบสำรวจ</Button>
        </div>
      </div>
      <Card title="รายลูกค้า" subtitle="ผลรอบล่าสุดของแต่ละราย">
        <Lines>
          {rows.map((x) => (
            <Line
              key={x.customer.code}
              title={x.customer.name}
              sub={x.last ? `${x.last.period} · ${x.last.comment || "ไม่มีความเห็น"}` : "ยังไม่สำรวจ"}
              right={
                <span className="flex items-center gap-2">
                  {x.complaints > 0 && <Badge tone="warn">ร้องเรียน {x.complaints}</Badge>}
                  {x.score !== undefined && <Badge tone={x.score < 3.5 ? "bad" : x.score < 4 ? "warn" : "ok"}>{x.score} / 5</Badge>}
                  {x.last ? <Button variant="ghost" onClick={() => onOpen("survey", x.last!.no)}>ดู</Button> : <Button variant="secondary" onClick={() => onAct({ kind: "survey-new", customer: x.customer.code })}>สำรวจ</Button>}
                </span>
              }
            />
          ))}
        </Lines>
      </Card>
    </div>
  );
}

/* --------------------------------------------------------------- records */

function RecordView({ kind, id, ...h }: { kind: RecordKind; id: string } & Handlers) {
  if (kind === "lot") return <LotRecord l={LOTS.find((x) => x.no === id)!} {...h} />;
  if (kind === "ncr") return <NcrRecord n={NCRS.find((x) => x.no === id)!} {...h} />;
  if (kind === "gauge") return <GaugeRecord g={GAUGES.find((x) => x.code === id)!} {...h} />;
  if (kind === "design") return <DesignRecord no={id} {...h} />;
  if (kind === "supplier") return <SupplierRecord code={id} {...h} />;
  return <SurveyRecord no={id} {...h} />;
}

function LotRecord({ l, onAct, onOpen }: { l: InspectionLot } & Handlers) {
  const plan = planOf(l.material);
  const certificate = l.origin === "ตรวจก่อนส่ง" && l.decision && l.decision !== "ไม่ผ่าน";
  return (
    <div className="flex h-full flex-col">
      <Header
        title={`${l.no} · ${materialName(l.material)}`}
        meta={`${l.origin} · ${l.source} · ${l.ref}${l.vendor ? ` · ${vendorName(l.vendor)}` : ""}`}
        badges={<><Badge dot tone={tone(lotState(l))}>{lotState(l)}</Badge><Badge tone="idle">ล็อต {l.qty.toLocaleString("th-TH")} · ตัวอย่าง {l.sample}</Badge></>}
        actions={
          <>
            {l.status !== "ตัดสินแล้ว" && <Button icon={<ClipboardCheck size={14} />} variant={l.status === "รอตรวจ" ? "primary" : "secondary"} onClick={() => onAct({ kind: "lot-results", no: l.no })}>{l.status === "รอตรวจ" ? "บันทึกผลตรวจ" : "แก้ผลตรวจ"}</Button>}
            {l.status === "รอตัดสิน" && <Button icon={<ShieldCheck size={14} />} onClick={() => onAct({ kind: "lot-decide", no: l.no })}>ตัดสินผล</Button>}
            {l.ncr && <Button variant="secondary" icon={<FileWarning size={14} />} onClick={() => onOpen("ncr", l.ncr!)}>ดู {l.ncr}</Button>}
            <Button variant="secondary" icon={<Printer size={14} />} onClick={() => onAct({ kind: "print", d: { doc: "lot", no: l.no }, title: certificate ? "ใบรับรองคุณภาพสินค้า" : "ใบรายงานผลการตรวจสอบ" })}>{certificate ? "พิมพ์ใบรับรองคุณภาพ" : "พิมพ์รายงาน"}</Button>
          </>
        }
      />
      <Body>
        <Card title="ผลตรวจตามแผน" subtitle={l.inspector ? `ตรวจโดย ${l.inspector} · ${l.inspectedOn}` : "ยังไม่ได้บันทึกผล"}>
          <Lines>
            {plan.map((c) => {
              const r = l.results.find((x) => x.characteristic === c.name);
              const got = !r ? "—" : c.kind === "วัดค่า" ? `${r.min} – ${r.max} ${c.unit ?? ""}` : r.defects === 0 ? "ไม่พบข้อบกพร่อง" : `พบ ${r.defects} ชิ้น`;
              return (
                <Line
                  key={c.name}
                  title={c.name}
                  sub={`${c.method} · เกณฑ์ ${c.kind === "วัดค่า" ? `${c.lsl}–${c.usl} ${c.unit ?? ""}` : "ไม่พบข้อบกพร่อง"}`}
                  right={<span className="flex items-center gap-3"><span className="tabular-nums text-slate-700 dark:text-slate-200">{got}</span>{r && <Badge tone={r.ok ? "ok" : "bad"}>{r.ok ? "ผ่าน" : "ไม่ผ่าน"}</Badge>}</span>}
                />
              );
            })}
          </Lines>
        </Card>
        {l.decision && <Note tone={tone(l.decision)}>ตัดสิน{l.decision} โดย {l.decidedBy} · {l.decidedOn}{l.note ? ` — ${l.note}` : ""}</Note>}
      </Body>
    </div>
  );
}

function NcrRecord({ n, onAct, onIms }: { n: Ncr } & Handlers) {
  const car = carOfNcr(n);
  return (
    <div className="flex h-full flex-col">
      <Header
        title={`${n.no} · ${n.material ? materialName(n.material) : n.ref}`}
        meta={`${n.source} · ${n.date} · อ้างอิง ${n.ref}`}
        badges={<><Badge dot tone={tone(n.status)}>{n.status}</Badge><Badge tone={tone(n.severity)}>{n.severity}</Badge>{car && <Badge tone="info">{car.no} · {car.status}</Badge>}</>}
        actions={
          <>
            {n.status === "รอสั่งการ" && <Button icon={<ShieldCheck size={14} />} onClick={() => onAct({ kind: "ncr-dispose", no: n.no })}>สั่งการ</Button>}
            {!car && n.status !== "ปิดแล้ว" && <Button variant="secondary" icon={<ListChecks size={14} />} onClick={() => onIms({ kind: "car-new", ref: n.no, problem: n.description })}>ออก CAR</Button>}
            {n.status === "ดำเนินการ" && <Button variant="secondary" icon={<CircleCheck size={14} />} onClick={() => onAct({ kind: "ncr-close", no: n.no })}>ปิด NCR</Button>}
            <Button variant="secondary" icon={<Printer size={14} />} onClick={() => onAct({ kind: "print", d: { doc: "ncr", no: n.no }, title: "ใบรายงานสิ่งที่ไม่เป็นไปตามข้อกำหนด" })}>พิมพ์</Button>
          </>
        }
      />
      <Body>
        <div className="grid gap-x-8 sm:grid-cols-2">
          <IconRow icon={<FileWarning size={14} />} label="จำนวน">{n.qty.toLocaleString("th-TH")} {n.material ? materialUnit(n.material) : ""}</IconRow>
          <IconRow icon={<Users size={14} />} label={n.customer ? "ลูกค้า" : "ผู้ขาย"}>{n.customer ? customerName(n.customer) : vendorName(n.vendor)}</IconRow>
          <IconRow icon={<Users size={14} />} label="ผู้รายงาน">{n.reportedBy}</IconRow>
          {n.closedOn && <IconRow icon={<CircleCheck size={14} />} label="ปิดเมื่อ">{n.closedOn} · {n.closedBy}</IconRow>}
        </div>
        <Card title="สิ่งที่พบ"><p className="px-4 py-3 text-[13px] leading-relaxed text-slate-700 dark:text-slate-200">{n.description}</p></Card>
        <Card title="การสั่งการ" subtitle="ข้อ 8.7 — ทำอะไรกับของที่ไม่เป็นไปตามข้อกำหนด">
          {n.disposition ? (
            <div className="px-4 py-3 text-[13px] text-slate-700 dark:text-slate-200">
              <p className="font-medium text-slate-900 dark:text-slate-50">{n.disposition}</p>
              <p>{n.dispositionNote}</p>
              {n.stockDoc && <p className="mt-1 text-[12px] text-slate-500">ตัดสต็อกในคลังวัสดุแล้ว เอกสาร {n.stockDoc}</p>}
              <p className="mt-1 text-[12px] text-slate-400">สั่งการโดย {n.dispositionBy}</p>
            </div>
          ) : (
            <Empty>ยังไม่สั่งการ</Empty>
          )}
        </Card>
        {car && (
          <Card title="การแก้ไขที่สาเหตุ" subtitle="ติดตามต่อที่ระบบบริหารบูรณาการ">
            <Lines>
              <Line title={`${car.no} · ${car.method} · ${car.owner}`} sub={capaByNo(car.no).rootCause?.whys.at(-1) ?? "ยังไม่หาสาเหตุราก"} right={<Badge dot tone={tone(car.status)}>{car.status}</Badge>} />
            </Lines>
          </Card>
        )}
      </Body>
    </div>
  );
}

function GaugeRecord({ g, onAct }: { g: Gauge } & Handlers) {
  return (
    <div className="flex h-full flex-col">
      <Header
        title={`${g.code} · ${g.name}`}
        meta={`${g.range} · ความละเอียด ${g.resolution} · ${g.location}`}
        badges={<><Badge dot tone={tone(calState(g))}>{calState(g)}</Badge><Badge tone="idle">ทุก {g.intervalMonths} เดือน</Badge></>}
        actions={
          <>
            <Button icon={<GaugeIcon size={14} />} onClick={() => onAct({ kind: "gauge-cal", code: g.code })}>บันทึกผลสอบเทียบ</Button>
            <Button variant="secondary" icon={<Printer size={14} />} onClick={() => onAct({ kind: "print", d: { doc: "gauge", code: g.code }, title: "บันทึกประวัติการสอบเทียบ" })}>พิมพ์ประวัติ</Button>
          </>
        }
      />
      <Body>
        <div className="grid gap-x-8 sm:grid-cols-2">
          <IconRow icon={<CalendarClock size={14} />} label="สอบเทียบล่าสุด">{g.lastCal}</IconRow>
          <IconRow icon={<CalendarClock size={14} />} label="ครบกำหนด">{g.status === "พักใช้" ? "พักใช้" : nextDue(g)}</IconRow>
        </div>
        <Card title="ประวัติการสอบเทียบ">
          <Lines>
            {[...g.records].reverse().map((r, i) => (
              <Line key={i} title={`${r.date} · ${r.by}`} sub={`ใบรับรอง ${r.certNo} · คลาดเคลื่อน ${r.error}${r.note ? ` · ${r.note}` : ""}`} right={<Badge tone={r.result === "ผ่าน" ? "ok" : "bad"}>{r.result}</Badge>} />
            ))}
          </Lines>
        </Card>
      </Body>
    </div>
  );
}

function DesignRecord({ no, onAct }: { no: string } & Handlers) {
  const d = designByNo(no);
  const stage = nextStage(d);
  return (
    <div className="flex h-full flex-col">
      <Header
        title={`${d.no} · ${d.product}`}
        meta={`${d.owner} · เริ่ม ${d.started} · กำหนดเสร็จ ${d.target}`}
        badges={<Badge dot tone={released(d) ? "ok" : "info"}>{released(d) ? "ส่งมอบสู่การผลิตแล้ว" : `ขั้นถัดไป: ${stage}`}</Badge>}
        actions={
          <>
            {stage && <Button icon={<PencilRuler size={14} />} onClick={() => onAct({ kind: "design-stage", no: d.no })}>บันทึกขั้น{stage}</Button>}
            {released(d) && <Button variant="secondary" icon={<FilePlus2 size={14} />} onClick={() => onAct({ kind: "design-change", no: d.no })}>เปลี่ยนแปลงแบบ</Button>}
            <Button variant="secondary" icon={<Printer size={14} />} onClick={() => onAct({ kind: "print", d: { doc: "design", no: d.no }, title: "บันทึกการออกแบบและพัฒนา" })}>พิมพ์บันทึก</Button>
          </>
        }
      />
      <Body>
        <Stepper steps={designSteps(d)} icons={STEP_ICONS} />
        <Card title="บันทึกแต่ละขั้น">
          <Lines>
            {d.records.map((r) => <Line key={r.stage} title={`${r.stage} · ${r.date} · ${r.by}`} sub={`${r.evidence}${r.participants ? ` · ผู้เข้าร่วม ${r.participants.join(", ")}` : ""}`} />)}
          </Lines>
        </Card>
        {d.changes.length > 0 && (
          <Card title="การเปลี่ยนแปลงแบบหลังส่งมอบ" subtitle="ข้อ 8.3.6">
            <Lines>
              {d.changes.map((c, i) => <Line key={i} title={c.change} sub={`${c.date} · ${c.reason} · อนุมัติ ${c.approvedBy}`} right={<Badge tone={c.reverified ? "ok" : "warn"}>{c.reverified ? "ทวนสอบซ้ำแล้ว" : "ไม่กระทบ"}</Badge>} />)}
            </Lines>
          </Card>
        )}
      </Body>
    </div>
  );
}

function SupplierRecord({ code, onAct }: { code: string } & Handlers) {
  const s = supplierRegister().find((x) => x.vendor.code === code)!;
  const status = s.approval?.status ?? "รอประเมิน";
  return (
    <div className="flex h-full flex-col">
      <Header
        title={`${s.vendor.code} · ${s.vendor.name}`}
        meta={`ส่งได้ ${s.supplies.map(materialName).join(", ") || "—"} · ${s.vendor.terms}`}
        badges={<><Badge dot tone={tone(status)}>{status}</Badge>{s.grade && <Badge tone="idle">เกรดจัดซื้อ {s.grade}</Badge>}{s.vendor.blocked && <Badge tone="bad">ระงับสั่งซื้อ</Badge>}</>}
        actions={
          <>
            <Button icon={<ShieldCheck size={14} />} onClick={() => onAct({ kind: "supplier-evaluate", code })}>ประเมินผู้ส่งมอบ</Button>
            <Button variant="secondary" icon={<Printer size={14} />} onClick={() => onAct({ kind: "print", d: { doc: "supplier", code }, title: "ใบประเมินผู้ส่งมอบประจำปี" })}>พิมพ์ใบประเมิน</Button>
          </>
        }
      />
      <Body>
        <div className="grid gap-3 sm:grid-cols-3">
          <Metric icon={<Microscope size={16} />} label="ล็อตผ่านครั้งแรก" value={s.quality.lots ? `${s.quality.score}%` : "—"} deltaLabel={`${s.quality.accepted} จาก ${s.quality.lots} ล็อต`} />
          <Metric icon={<Truck size={16} />} label="ส่งตรงเวลา" value={s.delivery === null ? "—" : `${s.delivery}%`} deltaLabel="จากใบรับของของจัดซื้อ" />
          <Metric icon={<FileWarning size={16} />} label="NCR" value={`${s.quality.ncrs} เรื่อง`} deltaLabel="ที่เปิดกับผู้ขายรายนี้" />
        </div>
        <Card title="ประวัติการประเมิน">
          {s.approval ? (
            <Lines>
              {[...s.approval.history].reverse().map((h, i) => <Line key={i} title={`${h.date} · ${h.status}`} sub={`${h.note} · ${h.by}`} right={<span className="tabular-nums text-[12.5px] text-slate-500">คุณภาพ {h.quality}%{h.grade ? ` · ${h.grade}` : ""}</span>} />)}
            </Lines>
          ) : (
            <Empty>ยังไม่เคยประเมิน — ต้องประเมินก่อนสั่งซื้อครั้งแรก</Empty>
          )}
        </Card>
      </Body>
    </div>
  );
}

function SurveyRecord({ no, onAct }: { no: string } & Handlers) {
  const v = SURVEYS.find((x) => x.no === no)!;
  const avg = Math.round((SATISFACTION_CRITERIA.reduce((n, c) => n + v.scores[c.key], 0) / SATISFACTION_CRITERIA.length) * 100) / 100;
  return (
    <div className="flex h-full flex-col">
      <Header
        title={`${v.no} · ${customerName(v.customer)}`}
        meta={`${v.period} · บันทึก ${v.date} · ${v.by}`}
        badges={<Badge tone={avg < 3.5 ? "bad" : avg < 4 ? "warn" : "ok"}>เฉลี่ย {avg} / 5</Badge>}
        actions={<Button variant="secondary" icon={<Printer size={14} />} onClick={() => onAct({ kind: "print", d: { doc: "satisfaction" }, title: "สรุปผลสำรวจความพึงพอใจลูกค้า" })}>พิมพ์สรุป</Button>}
      />
      <Body>
        <Card title="คะแนน">
          <ul className="space-y-3 p-4">
            {SATISFACTION_CRITERIA.map((c) => (
              <li key={c.key}>
                <div className="flex justify-between text-[12.5px]"><span className="text-slate-700 dark:text-slate-200">{c.label}</span><span className="tabular-nums text-slate-500">{v.scores[c.key]} / 5</span></div>
                <div className="mt-1"><Bar pct={v.scores[c.key] * 20} tone={v.scores[c.key] <= 2 ? "bad" : v.scores[c.key] === 3 ? "warn" : "ok"} width="w-full" /></div>
              </li>
            ))}
          </ul>
        </Card>
        {v.comment && <Card title="ความเห็นของลูกค้า"><p className="px-4 py-3 text-[13px] text-slate-700 dark:text-slate-200">{v.comment}</p></Card>}
        {v.followUp && <Note tone="warn">สิ่งที่จะทำต่อ: {v.followUp}</Note>}
      </Body>
    </div>
  );
}
