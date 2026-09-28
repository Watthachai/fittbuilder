import { useState } from "react";
import type { ReactNode } from "react";
import {
  CalendarClock, CircleCheck, ClipboardCheck, FilePlus2, FileSpreadsheet, FileText, FileWarning, Gauge as GaugeIcon,
  ListChecks, MessageSquareWarning, Microscope, Pencil, Play, Plus, Printer, Search as SearchIcon, ShieldCheck, Target,
  TriangleAlert, Users,
} from "lucide-react";
import {
  AUDITS, CAPAS, CLAUSES, DOCUMENTS, DOC_TYPES, GAUGES, LOTS, NCRS, NCR_SOURCES, TODAY, addDays, awaitingApproval,
  calState, clauseName, completeCapaAction, confirmReview, customerName, findingsWithoutCapa, materialName, materialUnit,
  nextDue, objectives, openCapas, overdueActions, pendingInspections, planOf, reviewDue, revLabel, startAudit,
  submitDocument, vendorName, vendorQuality, closeAudit,
} from "./data";
import type { Audit, Capa, Gauge, InspectionLot, Ncr, QmDocument } from "./data";
import { QmActions } from "./forms";
import type { Act } from "./forms";
import {
  Badge, Bar, Button, Card, Chip, Donut, IconRow, Metric, Note, PageHead, Progress, Reveal, Search, Segmented, swatchFor,
} from "../ui";
import type { Tone } from "../ui";
import { DataTable, DetailModal, downloadCsv, notify, useData } from "../kit";
import type { Column } from "../kit";

const TABS = ["ควบคุมเอกสาร", "ตรวจสอบคุณภาพ", "สิ่งที่ไม่เป็นไปตามข้อกำหนด", "การแก้ไขและป้องกัน", "ตรวจติดตามภายใน", "สอบเทียบเครื่องมือวัด"];

type Kind = "doc" | "lot" | "ncr" | "car" | "audit" | "gauge";

const exportIcon = <FileSpreadsheet size={14} />;

/** ตัดสินใจจุดเดียวว่าอะไรเป็นสีอะไร ทุกหน้าจอจึงอ่านสถานะด้วยสีเดียวกัน */
const TONE: Record<string, Tone> = {
  "ร่าง": "idle", "รออนุมัติ": "warn", "ใช้งาน": "ok", "ยกเลิก": "bad",
  "รอตรวจ": "idle", "รอตัดสิน": "warn", "ผ่าน": "ok", "ไม่ผ่าน": "bad", "ยอมรับแบบมีเงื่อนไข": "warn",
  "รอสั่งการ": "bad", "ดำเนินการ": "warn", "ปิดแล้ว": "ok",
  "วิเคราะห์สาเหตุ": "bad", "ติดตามผล": "info",
  "ตามแผน": "idle", "กำลังตรวจ": "info",
  "ปกติ": "ok", "ใกล้ครบ": "warn", "เกินกำหนด": "bad", "พักใช้": "bad",
  "รุนแรง": "bad", "ปานกลาง": "warn", "เล็กน้อย": "idle",
};

const tone = (s: string) => TONE[s] ?? "idle";
/** ทะเบียนเรียงตามเลขที่ล่าสุดก่อน — ลำดับในอาร์เรย์คือลำดับที่บันทึก ไม่ใช่ลำดับเลขที่ */
const newest = <T extends { no: string }>(xs: T[]) => [...xs].sort((a, b) => b.no.localeCompare(a.no));
const lotState = (l: InspectionLot) => (l.status === "ตัดสินแล้ว" ? l.decision! : l.status);
const sourceSwatch = (s: string) => swatchFor(s, NCR_SOURCES);

/* ----------------------------------------------------------------- screen */

export default function QmScreen({ section, onOpenSection }: { section?: string; onOpenSection?: (index: number) => void }) {
  useData();
  const tab = section && TABS.includes(section) ? section : undefined;
  const [act, setAct] = useState<Act | null>(null);
  const [record, setRecord] = useState<{ kind: Kind; key: string } | null>(null);
  const open = (kind: Kind, key: string) => setRecord({ kind, key });

  const keys: Record<Kind, string[]> = {
    doc: DOCUMENTS.map((d) => d.code),
    lot: newest(LOTS).map((l) => l.no),
    ncr: newest(NCRS).map((n) => n.no),
    car: newest(CAPAS).map((c) => c.no),
    audit: AUDITS.map((a) => a.no),
    gauge: GAUGES.map((g) => g.code),
  };
  const list = record ? keys[record.kind] : [];
  const at = record ? list.indexOf(record.key) : -1;
  const TITLES: Record<Kind, string> = { doc: "เอกสารควบคุม", lot: "ล็อตตรวจ", ncr: "สิ่งที่ไม่เป็นไปตามข้อกำหนด", car: "ใบขอให้แก้ไขและป้องกัน", audit: "การตรวจติดตามภายใน", gauge: "เครื่องมือวัด" };

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
        {record && at >= 0 && <RecordView kind={record.kind} id={record.key} onAct={setAct} onOpen={open} />}
      </DetailModal>
      <QmActions act={act} onAct={setAct} onOpen={open} />
    </>
  );

  const index = (
    <div hidden data-fitt-index>
      <button data-fitt-screen="บริหารคุณภาพ" />
      <button data-fitt-screen="เอกสารควบคุม" data-fitt-modal onClick={() => open("doc", DOCUMENTS[0].code)} />
      <button data-fitt-screen="สร้างเอกสารควบคุม" data-fitt-modal onClick={() => setAct({ kind: "doc-new" })} />
      <button data-fitt-screen="แก้ไขเอกสาร" data-fitt-modal onClick={() => setAct({ kind: "doc-revise", code: "QP-01" })} />
      <button data-fitt-screen="อนุมัติเอกสาร" data-fitt-modal onClick={() => setAct({ kind: "doc-approve", code: awaitingApproval()[0]?.code ?? "WI-03" })} />
      <button data-fitt-screen="ยกเลิกเอกสาร" data-fitt-modal onClick={() => setAct({ kind: "doc-obsolete", code: "WI-02" })} />
      <button data-fitt-screen="ล็อตตรวจ" data-fitt-modal onClick={() => open("lot", LOTS[0].no)} />
      <button data-fitt-screen="เปิดล็อตตรวจ" data-fitt-modal onClick={() => setAct({ kind: "lot-new" })} />
      <button data-fitt-screen="บันทึกผลตรวจ" data-fitt-modal onClick={() => setAct({ kind: "lot-results", no: LOTS.find((l) => l.status !== "ตัดสินแล้ว")?.no ?? LOTS[0].no })} />
      <button data-fitt-screen="ตัดสินผลการตรวจ" data-fitt-modal onClick={() => setAct({ kind: "lot-decide", no: LOTS.find((l) => l.status === "รอตัดสิน")?.no ?? LOTS[0].no })} />
      <button data-fitt-screen="สิ่งที่ไม่เป็นไปตามข้อกำหนด" data-fitt-modal onClick={() => open("ncr", NCRS[NCRS.length - 1].no)} />
      <button data-fitt-screen="เปิด NCR" data-fitt-modal onClick={() => setAct({ kind: "ncr-new" })} />
      <button data-fitt-screen="รับเรื่องร้องเรียนจากลูกค้า" data-fitt-modal onClick={() => setAct({ kind: "complaint-new" })} />
      <button data-fitt-screen="สั่งการ NCR" data-fitt-modal onClick={() => setAct({ kind: "ncr-dispose", no: NCRS.find((n) => n.status === "รอสั่งการ")?.no ?? NCRS[0].no })} />
      <button data-fitt-screen="ปิด NCR" data-fitt-modal onClick={() => setAct({ kind: "ncr-close", no: NCRS.find((n) => n.status === "ดำเนินการ")?.no ?? NCRS[0].no })} />
      <button data-fitt-screen="ใบขอให้แก้ไขและป้องกัน" data-fitt-modal onClick={() => open("car", CAPAS[CAPAS.length - 1].no)} />
      <button data-fitt-screen="ออก CAR" data-fitt-modal onClick={() => setAct({ kind: "car-new" })} />
      <button data-fitt-screen="หาสาเหตุราก" data-fitt-modal onClick={() => setAct({ kind: "car-cause", no: CAPAS[CAPAS.length - 1].no })} />
      <button data-fitt-screen="เพิ่มมาตรการ" data-fitt-modal onClick={() => setAct({ kind: "car-action", no: CAPAS[CAPAS.length - 1].no })} />
      <button data-fitt-screen="ติดตามประสิทธิผล" data-fitt-modal onClick={() => setAct({ kind: "car-verify", no: CAPAS[CAPAS.length - 1].no })} />
      <button data-fitt-screen="การตรวจติดตามภายใน" data-fitt-modal onClick={() => open("audit", AUDITS[0].no)} />
      <button data-fitt-screen="วางแผนการตรวจติดตาม" data-fitt-modal onClick={() => setAct({ kind: "audit-new" })} />
      <button data-fitt-screen="บันทึกสิ่งที่พบ" data-fitt-modal onClick={() => setAct({ kind: "audit-finding", no: AUDITS[AUDITS.length - 1].no })} />
      <button data-fitt-screen="เครื่องมือวัด" data-fitt-modal onClick={() => open("gauge", GAUGES[0].code)} />
      <button data-fitt-screen="ขึ้นทะเบียนเครื่องมือวัด" data-fitt-modal onClick={() => setAct({ kind: "gauge-new" })} />
      <button data-fitt-screen="บันทึกผลสอบเทียบ" data-fitt-modal onClick={() => setAct({ kind: "gauge-cal", code: GAUGES[0].code })} />
      <button data-fitt-screen="พิมพ์บัญชีรายชื่อเอกสารควบคุม" data-fitt-modal onClick={() => setAct({ kind: "print", d: { doc: "master-list" }, title: "บัญชีรายชื่อเอกสารควบคุม" })} />
      <button data-fitt-screen="พิมพ์ใบรับรองคุณภาพ" data-fitt-modal onClick={() => setAct({ kind: "print", d: { doc: "lot", no: LOTS.find((l) => l.origin === "ตรวจก่อนส่ง")!.no }, title: "ใบรับรองคุณภาพสินค้า" })} />
      <button data-fitt-screen="พิมพ์ NCR" data-fitt-modal onClick={() => setAct({ kind: "print", d: { doc: "ncr", no: NCRS[0].no }, title: "ใบรายงานสิ่งที่ไม่เป็นไปตามข้อกำหนด" })} />
      <button data-fitt-screen="พิมพ์ CAR" data-fitt-modal onClick={() => setAct({ kind: "print", d: { doc: "car", no: CAPAS[0].no }, title: "ใบขอให้ดำเนินการแก้ไขและป้องกัน" })} />
      <button data-fitt-screen="พิมพ์รายงานการตรวจติดตาม" data-fitt-modal onClick={() => setAct({ kind: "print", d: { doc: "audit", no: AUDITS[1].no }, title: "รายงานการตรวจติดตามภายใน" })} />
      <button data-fitt-screen="พิมพ์ประวัติการสอบเทียบ" data-fitt-modal onClick={() => setAct({ kind: "print", d: { doc: "gauge", code: GAUGES[0].code }, title: "บันทึกประวัติการสอบเทียบ" })} />
    </div>
  );

  if (!tab) {
    return (
      <>
        <Overview onOpenSection={onOpenSection} onAct={setAct} onOpen={open} />
        {panels}
        {index}
      </>
    );
  }

  return (
    <div>
      <PageHead title="บริหารคุณภาพ" meta={`${tab} · ISO 9001:2015 · ข้อมูล ณ ${TODAY}`} />
      {tab === "ควบคุมเอกสาร" && <Documents onAct={setAct} onOpen={open} />}
      {tab === "ตรวจสอบคุณภาพ" && <Inspection onAct={setAct} onOpen={open} />}
      {tab === "สิ่งที่ไม่เป็นไปตามข้อกำหนด" && <Nonconformance onAct={setAct} onOpen={open} />}
      {tab === "การแก้ไขและป้องกัน" && <Corrective onAct={setAct} onOpen={open} />}
      {tab === "ตรวจติดตามภายใน" && <Audits onAct={setAct} onOpen={open} />}
      {tab === "สอบเทียบเครื่องมือวัด" && <Calibration onAct={setAct} onOpen={open} />}
      {panels}
      {index}
    </div>
  );
}

type Handlers = { onAct: (a: Act) => void; onOpen: (kind: Kind, key: string) => void };

/* -------------------------------------------------------------- overview */

function Overview({ onOpenSection, onAct, onOpen }: Handlers & { onOpenSection?: (i: number) => void }) {
  const pending = pendingInspections();
  const waiting = LOTS.filter((l) => l.status !== "ตัดสินแล้ว");
  const openNcrs = NCRS.filter((n) => n.status !== "ปิดแล้ว");
  const cars = openCapas();
  const late = cars.flatMap((c) => overdueActions(c).map((a) => ({ c, a })));
  const gauges = GAUGES.filter((g) => ["เกินกำหนด", "ใกล้ครบ", "พักใช้"].includes(calState(g)));
  const objs = objectives();
  const bySource = NCR_SOURCES.map((s) => ({ label: s, value: NCRS.filter((n) => n.source === s).length, swatch: sourceSwatch(s) })).filter((x) => x.value > 0);
  const vendors = vendorQuality();
  const nextAudit = AUDITS.filter((a) => a.status === "ตามแผน").sort((a, b) => a.planned.localeCompare(b.planned))[0];

  const todo: { icon: ReactNode; text: string; sub: string; go: () => void; tone: Tone }[] = [
    ...pending.map((p) => ({ icon: <Microscope size={15} />, text: `${p.origin} ${materialName(p.material)} ${p.qty.toLocaleString("th-TH")} ${materialUnit(p.material)}`, sub: `${p.source} · ยังไม่เปิดล็อตตรวจ`, go: () => onAct({ kind: "lot-new", source: p.source, material: p.material }), tone: "warn" as Tone })),
    ...waiting.map((l) => ({ icon: <ClipboardCheck size={15} />, text: `${l.no} ${materialName(l.material)}`, sub: l.status === "รอตรวจ" ? "รอบันทึกผลตรวจ" : "รอตัดสินผล", go: () => onOpen("lot", l.no), tone: "warn" as Tone })),
    ...openNcrs.filter((n) => n.status === "รอสั่งการ").map((n) => ({ icon: <FileWarning size={15} />, text: `${n.no} ${n.material ? materialName(n.material) : n.ref}`, sub: `${n.source} · รอสั่งการ`, go: () => onOpen("ncr", n.no), tone: "bad" as Tone })),
    ...late.map(({ c, a }) => ({ icon: <CalendarClock size={15} />, text: `${c.no} ${a.what}`, sub: `${a.owner} · เลยกำหนด ${a.due}`, go: () => onOpen("car", c.no), tone: "bad" as Tone })),
    ...gauges.map((g) => ({ icon: <GaugeIcon size={15} />, text: `${g.code} ${g.name}`, sub: calState(g) === "พักใช้" ? "พักใช้ รอซ่อมหรือสอบเทียบใหม่" : `${calState(g)} · ครบกำหนด ${nextDue(g)}`, go: () => onOpen("gauge", g.code), tone: (calState(g) === "ใกล้ครบ" ? "warn" : "bad") as Tone })),
    ...awaitingApproval().map((d) => ({ icon: <FileText size={15} />, text: `${d.code} ${d.title}`, sub: `รออนุมัติ ${revLabel(d.draft!.rev)}`, go: () => onOpen("doc", d.code), tone: "info" as Tone })),
    ...reviewDue().map((d) => ({ icon: <FileText size={15} />, text: `${d.code} ${d.title}`, sub: `ถึงรอบทบทวน ${d.reviewDue}`, go: () => onOpen("doc", d.code), tone: "info" as Tone })),
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
          <Metric icon={<ListChecks size={17} />} label="CAR เปิดอยู่" value={`${cars.length} ใบ`} deltaLabel={late.length ? `มาตรการเลยกำหนด ${late.length} ข้อ` : "ไม่มีมาตรการเลยกำหนด"} />
          <Metric icon={<GaugeIcon size={17} />} label="เครื่องมือต้องดูแล" value={`${gauges.length} ชิ้น`} deltaLabel={nextAudit ? `ตรวจติดตามถัดไป ${nextAudit.planned} ${nextAudit.area}` : "ไม่มีการตรวจตามแผน"} />
        </div>
      </Reveal>

      <Reveal delay={0.06} className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card title="วัตถุประสงค์คุณภาพ" subtitle="วัดจากงานจริงในระบบ ใช้เป็นข้อมูลทบทวนโดยฝ่ายบริหาร (ข้อ 6.2 และ 9.3)" className="lg:col-span-2">
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {objs.map((o) => (
              <li key={o.name} className="flex items-center gap-3 px-4 py-3">
                <Target size={15} className={o.met ? "shrink-0 text-emerald-500" : "shrink-0 text-rose-500"} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] text-slate-800 dark:text-slate-100">{o.name}</p>
                  <p className="text-[11.5px] text-slate-500 dark:text-slate-400">ข้อ {o.clause} · เป้า {o.better === "higher" ? "≥" : "≤"} {o.target}{o.unit === "%" ? "%" : ` ${o.unit}`}</p>
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
            <p className="px-4 py-8 text-center text-[13px] text-slate-400">ไม่มีงานค้าง</p>
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
        <Card
          title="คุณภาพผู้ขาย"
          subtitle="สัดส่วนล็อตที่ไม่ผ่านการตรวจรับ ใช้ประเมินผู้ขาย (ข้อ 8.4)"
          action={<Button variant="ghost" className="whitespace-nowrap" onClick={() => onOpenSection?.(1)}>ดูล็อตตรวจ</Button>}
        >
          <ul className="space-y-3 p-4">
            {vendors.map((v) => (
              <li key={v.code}>
                <div className="flex items-baseline justify-between gap-2 text-[12.5px]">
                  <span className="truncate text-slate-700 dark:text-slate-200">{v.name}</span>
                  <span className="shrink-0 tabular-nums text-slate-500">ไม่ผ่าน {v.rejected}/{v.lots}</span>
                </div>
                <div className="mt-1"><Bar pct={v.rate} tone={v.rate === 0 ? "ok" : v.rate < 20 ? "warn" : "bad"} width="w-full" /></div>
              </li>
            ))}
          </ul>
        </Card>
      </Reveal>
    </div>
  );
}

/* ------------------------------------------------------------- documents */

function Documents({ onAct, onOpen }: Handlers) {
  const [type, setType] = useState("ทั้งหมด");
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const rows = DOCUMENTS.filter((d) => (type === "ทั้งหมด" || d.type === type) && (!needle || `${d.code} ${d.title}`.toLowerCase().includes(needle)));
  const due = new Set(reviewDue().map((d) => d.code));
  const columns: Column<QmDocument>[] = [
    { key: "code", header: "รหัส", cell: (d) => <span className="font-medium tabular-nums text-slate-800 dark:text-slate-100">{d.code}</span>, sort: (a, b) => a.code.localeCompare(b.code) },
    { key: "title", header: "ชื่อเอกสาร", cell: (d) => d.title, sort: (a, b) => a.title.localeCompare(b.title, "th") },
    { key: "type", header: "ประเภท", cell: (d) => <Chip>{d.type}</Chip> },
    { key: "rev", header: "ฉบับ", cell: (d) => <span className="tabular-nums">{revLabel(d.rev)}</span> },
    { key: "status", header: "สถานะ", cell: (d) => <span className="flex flex-wrap items-center gap-1.5"><Badge dot tone={tone(d.status)}>{d.status}</Badge>{d.draft && d.rev >= 0 && <Badge tone="info">มีฉบับแก้ไข</Badge>}</span> },
    { key: "effective", header: "มีผลเมื่อ", cell: (d) => d.effective ?? "—", sort: (a, b) => (a.effective ?? "").localeCompare(b.effective ?? "") },
    { key: "review", header: "ทบทวนครั้งถัดไป", cell: (d) => <span className={due.has(d.code) ? "font-medium text-rose-600 dark:text-rose-400" : ""}>{d.reviewDue ?? "—"}</span> },
  ];
  return (
    <div className="space-y-4">
      {(awaitingApproval().length > 0 || due.size > 0) && (
        <Note tone="warn">
          {awaitingApproval().length > 0 && `รออนุมัติ ${awaitingApproval().length} ฉบับ`}
          {awaitingApproval().length > 0 && due.size > 0 && " · "}
          {due.size > 0 && `ถึงรอบทบทวนภายใน 30 วัน ${due.size} ฉบับ`}
        </Note>
      )}
      <DataTable
        rows={rows}
        columns={columns}
        getId={(d) => d.code}
        onOpen={(d) => onOpen("doc", d.code)}
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <Segmented options={["ทั้งหมด", ...DOC_TYPES]} value={type} onChange={setType} />
            <Search value={q} onChange={setQ} placeholder="ค้นหารหัสหรือชื่อเอกสาร" icon={<SearchIcon size={14} />} />
            <div className="ml-auto flex gap-2">
              <Button variant="secondary" icon={exportIcon} onClick={() => { downloadCsv("เอกสารควบคุม", ["รหัส", "ชื่อเอกสาร", "ประเภท", "ฉบับ", "สถานะ", "มีผลเมื่อ", "ทบทวนครั้งถัดไป", "ฝ่ายเจ้าของ"], rows.map((d) => [d.code, d.title, d.type, revLabel(d.rev), d.status, d.effective ?? "", d.reviewDue ?? "", d.owner])); notify(`ส่งออกเอกสาร ${rows.length} รายการแล้ว`); }}>ส่งออก Excel</Button>
              <Button variant="secondary" icon={<Printer size={14} />} onClick={() => onAct({ kind: "print", d: { doc: "master-list" }, title: "บัญชีรายชื่อเอกสารควบคุม" })}>พิมพ์บัญชีรายชื่อ</Button>
              <Button icon={<FilePlus2 size={14} />} onClick={() => onAct({ kind: "doc-new" })}>สร้างเอกสาร</Button>
            </div>
          </div>
        }
      />
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
          <p className="px-4 py-5 text-center text-[13px] text-slate-400">เปิดล็อตตรวจครบทุกใบแล้ว</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {pending.map((p) => (
              <li key={`${p.source}-${p.material}`} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                <Chip>{p.origin}</Chip>
                <span className="min-w-0 flex-1 text-[13px] text-slate-700 dark:text-slate-200">
                  {materialName(p.material)} {p.qty.toLocaleString("th-TH")} {materialUnit(p.material)}
                  <span className="ml-2 text-[11.5px] text-slate-400">{p.source} · {p.date}{p.vendor ? ` · ${vendorName(p.vendor)}` : ""}</span>
                </span>
                <Button variant="secondary" icon={<Plus size={14} />} onClick={() => onAct({ kind: "lot-new", source: p.source, material: p.material })}>เปิดล็อตตรวจ</Button>
              </li>
            ))}
          </ul>
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
            <Button className="ml-auto" variant="secondary" icon={exportIcon} onClick={() => { downloadCsv("ล็อตตรวจ", ["เลขที่", "ประเภท", "รายการ", "จำนวน", "ตัวอย่าง", "ต้นทาง", "ผู้ขาย", "ผล", "ผู้ตรวจ", "วันที่ตัดสิน"], rows.map((l) => [l.no, l.origin, materialName(l.material), l.qty, l.sample, l.source, l.vendor ? vendorName(l.vendor) : "ฝ่ายผลิต", lotState(l), l.inspector ?? "", l.decidedOn ?? ""])); notify(`ส่งออกล็อตตรวจ ${rows.length} รายการแล้ว`); }}>ส่งออก Excel</Button>
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
    { key: "car", header: "CAR", cell: (n) => <span className="tabular-nums text-slate-500">{n.capa ?? "—"}</span> },
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
            <Button variant="secondary" icon={exportIcon} onClick={() => { downloadCsv("NCR", ["เลขที่", "วันที่", "พบที่", "อ้างอิง", "รายการ", "จำนวน", "ความรุนแรง", "สถานะ", "การสั่งการ", "CAR"], rows.map((n) => [n.no, n.date, n.source, n.ref, n.material ? materialName(n.material) : "", n.qty, n.severity, n.status, n.disposition ?? "", n.capa ?? ""])); notify(`ส่งออก NCR ${rows.length} รายการแล้ว`); }}>ส่งออก Excel</Button>
            <Button variant="secondary" icon={<MessageSquareWarning size={14} />} onClick={() => onAct({ kind: "complaint-new" })}>รับเรื่องร้องเรียน</Button>
            <Button icon={<FileWarning size={14} />} onClick={() => onAct({ kind: "ncr-new" })}>เปิด NCR</Button>
          </div>
        </div>
      }
    />
  );
}

/* ------------------------------------------------------------------ capa */

function Corrective({ onAct, onOpen }: Handlers) {
  const rows = newest(CAPAS);
  const columns: Column<Capa>[] = [
    { key: "no", header: "เลขที่", cell: (c) => <span className="font-medium tabular-nums text-slate-800 dark:text-slate-100">{c.no}</span>, sort: (a, b) => a.no.localeCompare(b.no) },
    { key: "ref", header: "ต้นเรื่อง", cell: (c) => <span className="tabular-nums text-slate-500">{c.ref}</span> },
    { key: "problem", header: "ปัญหา", cell: (c) => <span className="line-clamp-2">{c.problem}</span> },
    { key: "owner", header: "ผู้รับผิดชอบ", cell: (c) => c.owner },
    { key: "progress", header: "มาตรการ", cell: (c) => <Progress done={c.actions.filter((a) => a.doneOn).length} total={Math.max(1, c.actions.length)} label={c.actions.length ? undefined : "ยังไม่มี"} /> },
    { key: "status", header: "สถานะ", cell: (c) => <span className="flex flex-wrap gap-1.5"><Badge dot tone={tone(c.status)}>{c.status}</Badge>{overdueActions(c).length > 0 && <Badge tone="bad">เลยกำหนด {overdueActions(c).length}</Badge>}</span> },
  ];
  return (
    <DataTable
      rows={rows}
      columns={columns}
      getId={(c) => c.no}
      onOpen={(c) => onOpen("car", c.no)}
      toolbar={
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[12.5px] text-slate-500 dark:text-slate-400">หาสาเหตุราก วางมาตรการ แล้วให้คนอื่นติดตามว่าได้ผลจริงก่อนปิด (ข้อ 10.2)</p>
          <div className="ml-auto flex gap-2">
            <Button variant="secondary" icon={exportIcon} onClick={() => { downloadCsv("CAR", ["เลขที่", "วันที่", "ประเภท", "ต้นเรื่อง", "ปัญหา", "ผู้รับผิดชอบ", "สาเหตุราก", "มาตรการเสร็จ", "สถานะ"], rows.map((c) => [c.no, c.date, c.kind, c.ref, c.problem, c.owner, c.rootCause?.whys.at(-1) ?? "", `${c.actions.filter((a) => a.doneOn).length}/${c.actions.length}`, c.status])); notify(`ส่งออก CAR ${rows.length} รายการแล้ว`); }}>ส่งออก Excel</Button>
            <Button icon={<Plus size={14} />} onClick={() => onAct({ kind: "car-new" })}>ออก CAR</Button>
          </div>
        </div>
      }
    />
  );
}

/* ----------------------------------------------------------------- audit */

function Audits({ onAct, onOpen }: Handlers) {
  const count = (a: Audit, t: string) => a.findings.filter((f) => f.type === t).length;
  const columns: Column<Audit>[] = [
    { key: "no", header: "เลขที่", cell: (a) => <span className="font-medium tabular-nums text-slate-800 dark:text-slate-100">{a.no}</span>, sort: (a, b) => a.no.localeCompare(b.no) },
    { key: "area", header: "ฝ่ายที่ตรวจ", cell: (a) => a.area },
    { key: "clauses", header: "ข้อกำหนด", cell: (a) => <span className="flex flex-wrap gap-1">{a.clauses.map((c) => <Chip key={c}>{c}</Chip>)}</span> },
    { key: "auditor", header: "ผู้ตรวจ", cell: (a) => a.auditor },
    { key: "planned", header: "วันที่", cell: (a) => a.performedOn ?? a.planned, sort: (a, b) => a.planned.localeCompare(b.planned) },
    { key: "findings", header: "ข้อบกพร่อง / ข้อสังเกต", align: "right", cell: (a) => <span className="tabular-nums">{count(a, "ข้อบกพร่องหลัก") + count(a, "ข้อบกพร่องย่อย")} / {count(a, "ข้อสังเกต")}</span> },
    { key: "status", header: "สถานะ", cell: (a) => <Badge dot tone={tone(a.status)}>{a.status}</Badge> },
  ];
  return (
    <DataTable
      rows={AUDITS}
      columns={columns}
      getId={(a) => a.no}
      onOpen={(a) => onOpen("audit", a.no)}
      toolbar={
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[12.5px] text-slate-500 dark:text-slate-400">แผนการตรวจปี {Number(TODAY.slice(0, 4)) + 543} · ผู้ตรวจไม่ตรวจฝ่ายของตัวเอง (ข้อ 9.2)</p>
          <div className="ml-auto flex gap-2">
            <Button variant="secondary" icon={exportIcon} onClick={() => { downloadCsv("แผนตรวจติดตามภายใน", ["เลขที่", "ฝ่าย", "ข้อกำหนด", "ผู้ตรวจ", "วันที่ตามแผน", "วันที่ตรวจ", "ข้อบกพร่อง", "ข้อสังเกต", "สถานะ"], AUDITS.map((a) => [a.no, a.area, a.clauses.join(" "), a.auditor, a.planned, a.performedOn ?? "", count(a, "ข้อบกพร่องหลัก") + count(a, "ข้อบกพร่องย่อย"), count(a, "ข้อสังเกต"), a.status])); notify(`ส่งออกแผนตรวจ ${AUDITS.length} รายการแล้ว`); }}>ส่งออก Excel</Button>
            <Button icon={<Users size={14} />} onClick={() => onAct({ kind: "audit-new" })}>วางแผนการตรวจ</Button>
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
              <Button variant="secondary" icon={exportIcon} onClick={() => { downloadCsv("ทะเบียนเครื่องมือวัด", ["รหัส", "เครื่องมือ", "ช่วงการวัด", "ความละเอียด", "ที่ใช้งาน", "รอบ (เดือน)", "สอบเทียบล่าสุด", "ครบกำหนด", "สถานะ"], GAUGES.map((g) => [g.code, g.name, g.range, g.resolution, g.location, g.intervalMonths, g.lastCal, nextDue(g), calState(g)])); notify(`ส่งออกเครื่องมือวัด ${GAUGES.length} รายการแล้ว`); }}>ส่งออก Excel</Button>
              <Button icon={<Plus size={14} />} onClick={() => onAct({ kind: "gauge-new" })}>ขึ้นทะเบียนเครื่องมือ</Button>
            </div>
          </div>
        }
      />
    </div>
  );
}

/* --------------------------------------------------------------- records */

function Header({ title, meta, badges, actions }: { title: string; meta: string; badges: ReactNode; actions: ReactNode }) {
  return (
    <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[17px] font-semibold text-slate-900 dark:text-slate-50">{title}</p>
          <p className="mt-0.5 text-[12.5px] text-slate-500 dark:text-slate-400">{meta}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">{badges}</div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">{actions}</div>
    </div>
  );
}

const run = (fn: () => void, ok: string) => {
  try {
    fn();
    notify(ok);
  } catch (e) {
    notify(e instanceof Error ? e.message : String(e), "bad");
  }
};

function RecordView({ kind, id, onAct, onOpen }: { kind: Kind; id: string } & Handlers) {
  if (kind === "doc") return <DocRecord d={DOCUMENTS.find((x) => x.code === id)!} onAct={onAct} onOpen={onOpen} />;
  if (kind === "lot") return <LotRecord l={LOTS.find((x) => x.no === id)!} onAct={onAct} onOpen={onOpen} />;
  if (kind === "ncr") return <NcrRecord n={NCRS.find((x) => x.no === id)!} onAct={onAct} onOpen={onOpen} />;
  if (kind === "car") return <CarRecord c={CAPAS.find((x) => x.no === id)!} onAct={onAct} onOpen={onOpen} />;
  if (kind === "audit") return <AuditRecord a={AUDITS.find((x) => x.no === id)!} onAct={onAct} onOpen={onOpen} />;
  return <GaugeRecord g={GAUGES.find((x) => x.code === id)!} onAct={onAct} onOpen={onOpen} />;
}

function Body({ children }: { children: ReactNode }) {
  return <div className="space-y-5 overflow-y-auto px-5 py-4">{children}</div>;
}

function DocRecord({ d, onAct }: { d: QmDocument } & Handlers) {
  const due = d.reviewDue && d.reviewDue <= addDays(TODAY, 30);
  return (
    <div className="flex h-full flex-col">
      <Header
        title={`${d.code} · ${d.title}`}
        meta={`${d.type} · ข้อ ${d.clause} ${clauseName(d.clause)} · ${d.owner}`}
        badges={<><Badge dot tone={tone(d.status)}>{d.status}</Badge><Badge tone="idle">{revLabel(d.rev)}</Badge>{d.draft && <Badge tone={d.draft.submitted ? "warn" : "info"}>{revLabel(d.draft.rev)} {d.draft.submitted ? "รออนุมัติ" : "กำลังแก้ไข"}</Badge>}</>}
        actions={
          <>
            {d.draft && !d.draft.submitted && <Button icon={<CircleCheck size={14} />} onClick={() => run(() => submitDocument(d.code), `ส่ง ${d.code} ${revLabel(d.draft!.rev)} ขออนุมัติแล้ว`)}>ส่งอนุมัติ</Button>}
            {d.draft?.submitted && <Button icon={<ShieldCheck size={14} />} onClick={() => onAct({ kind: "doc-approve", code: d.code })}>อนุมัติ</Button>}
            {d.status === "ใช้งาน" && !d.draft && <Button variant="secondary" icon={<Pencil size={14} />} onClick={() => onAct({ kind: "doc-revise", code: d.code })}>แก้ไขฉบับใหม่</Button>}
            {d.status === "ใช้งาน" && due && !d.draft && <Button variant="secondary" icon={<CircleCheck size={14} />} onClick={() => run(() => confirmReview(d.code), `ทบทวน ${d.code} แล้ว · ใช้ต่ออีกหนึ่งปี`)}>ทบทวนแล้วยังเหมาะสม</Button>}
            {d.status !== "ยกเลิก" && <Button variant="ghost" onClick={() => onAct({ kind: "doc-obsolete", code: d.code })}>ยกเลิกเอกสาร</Button>}
          </>
        }
      />
      <Body>
        <div className="grid gap-x-8 sm:grid-cols-2">
          <IconRow icon={<FileText size={14} />} label="ฉบับที่ใช้">{revLabel(d.rev)}{d.effective ? ` · มีผล ${d.effective}` : ""}</IconRow>
          <IconRow icon={<CalendarClock size={14} />} label="ทบทวนครั้งถัดไป"><span className={due ? "text-rose-600 dark:text-rose-400" : ""}>{d.reviewDue ?? "—"}</span></IconRow>
          {d.obsoleteReason && <IconRow icon={<TriangleAlert size={14} />} label="เหตุผลที่ยกเลิก">{d.obsoleteReason}</IconRow>}
        </div>
        {d.draft && <Note tone="info">{revLabel(d.draft.rev)} โดย {d.draft.by} ({d.draft.date}): {d.draft.change}</Note>}
        <Card title="ประวัติการแก้ไข" subtitle="ทุกฉบับที่เคยออกใช้ พร้อมผู้อนุมัติ">
          {d.history.length === 0 ? (
            <p className="px-4 py-5 text-center text-[13px] text-slate-400">ยังไม่เคยออกใช้</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {[...d.history].reverse().map((h) => (
                <li key={h.rev} className="flex gap-3 px-4 py-2.5 text-[13px]">
                  <span className="w-14 shrink-0 font-medium tabular-nums text-slate-800 dark:text-slate-100">{revLabel(h.rev)}</span>
                  <span className="min-w-0 flex-1 text-slate-700 dark:text-slate-200">{h.change}<span className="block text-[11.5px] text-slate-400">{h.date} · จัดทำ {h.by} · อนุมัติ {h.approvedBy}</span></span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </Body>
    </div>
  );
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
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {plan.map((c) => {
              const r = l.results.find((x) => x.characteristic === c.name);
              const got = !r ? "—" : c.kind === "วัดค่า" ? `${r.min} – ${r.max} ${c.unit ?? ""}` : r.defects === 0 ? "ไม่พบข้อบกพร่อง" : `พบ ${r.defects} ชิ้น`;
              return (
                <li key={c.name} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-[13px]">
                  <span className="min-w-0 flex-1">
                    <span className="block text-slate-800 dark:text-slate-100">{c.name}</span>
                    <span className="block text-[11.5px] text-slate-400">{c.method} · เกณฑ์ {c.kind === "วัดค่า" ? `${c.lsl}–${c.usl} ${c.unit ?? ""}` : "ไม่พบข้อบกพร่อง"}</span>
                  </span>
                  <span className="tabular-nums text-slate-700 dark:text-slate-200">{got}</span>
                  {r && <Badge tone={r.ok ? "ok" : "bad"}>{r.ok ? "ผ่าน" : "ไม่ผ่าน"}</Badge>}
                </li>
              );
            })}
          </ul>
        </Card>
        {l.decision && <Note tone={tone(l.decision)}>ตัดสิน{l.decision} โดย {l.decidedBy} · {l.decidedOn}{l.note ? ` — ${l.note}` : ""}</Note>}
      </Body>
    </div>
  );
}

function NcrRecord({ n, onAct, onOpen }: { n: Ncr } & Handlers) {
  return (
    <div className="flex h-full flex-col">
      <Header
        title={`${n.no} · ${n.material ? materialName(n.material) : n.ref}`}
        meta={`${n.source} · ${n.date} · อ้างอิง ${n.ref}`}
        badges={<><Badge dot tone={tone(n.status)}>{n.status}</Badge><Badge tone={tone(n.severity)}>{n.severity}</Badge>{n.capa && <Badge tone="info">{n.capa}</Badge>}</>}
        actions={
          <>
            {n.status === "รอสั่งการ" && <Button icon={<ShieldCheck size={14} />} onClick={() => onAct({ kind: "ncr-dispose", no: n.no })}>สั่งการ</Button>}
            {!n.capa && n.status !== "ปิดแล้ว" && <Button variant="secondary" icon={<ListChecks size={14} />} onClick={() => onAct({ kind: "car-new", ref: n.no, problem: n.description })}>ออก CAR</Button>}
            {n.capa && <Button variant="secondary" icon={<ListChecks size={14} />} onClick={() => onOpen("car", n.capa!)}>ดู {n.capa}</Button>}
            {n.status === "ดำเนินการ" && <Button variant="secondary" icon={<CircleCheck size={14} />} onClick={() => onAct({ kind: "ncr-close", no: n.no })}>ปิด NCR</Button>}
            <Button variant="secondary" icon={<Printer size={14} />} onClick={() => onAct({ kind: "print", d: { doc: "ncr", no: n.no }, title: "ใบรายงานสิ่งที่ไม่เป็นไปตามข้อกำหนด" })}>พิมพ์</Button>
          </>
        }
      />
      <Body>
        <div className="grid gap-x-8 sm:grid-cols-2">
          <IconRow icon={<FileWarning size={14} />} label="จำนวน">{n.qty.toLocaleString("th-TH")} {n.material ? materialUnit(n.material) : ""}</IconRow>
          <IconRow icon={<Users size={14} />} label={n.customer ? "ลูกค้า" : "ผู้ขาย"}>{n.customer ? customerName(n.customer) : vendorName(n.vendor)}</IconRow>
          <IconRow icon={<Pencil size={14} />} label="ผู้รายงาน">{n.reportedBy}</IconRow>
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
            <p className="px-4 py-5 text-center text-[13px] text-slate-400">ยังไม่สั่งการ</p>
          )}
        </Card>
      </Body>
    </div>
  );
}

function CarRecord({ c, onAct }: { c: Capa } & Handlers) {
  return (
    <div className="flex h-full flex-col">
      <Header
        title={`${c.no} · การ${c.kind}`}
        meta={`ต้นเรื่อง ${c.ref} · ออกเมื่อ ${c.date} · ${c.owner}`}
        badges={<><Badge dot tone={tone(c.status)}>{c.status}</Badge>{overdueActions(c).length > 0 && <Badge tone="bad">มาตรการเลยกำหนด {overdueActions(c).length}</Badge>}</>}
        actions={
          <>
            {c.status !== "ปิดแล้ว" && c.status !== "ติดตามผล" && <Button variant={c.rootCause ? "secondary" : "primary"} icon={<SearchIcon size={14} />} onClick={() => onAct({ kind: "car-cause", no: c.no })}>{c.rootCause ? "แก้สาเหตุราก" : "หาสาเหตุราก"}</Button>}
            {c.status !== "ปิดแล้ว" && c.status !== "ติดตามผล" && <Button variant="secondary" icon={<Plus size={14} />} onClick={() => onAct({ kind: "car-action", no: c.no })}>เพิ่มมาตรการ</Button>}
            {c.status === "ติดตามผล" && <Button icon={<ShieldCheck size={14} />} onClick={() => onAct({ kind: "car-verify", no: c.no })}>ติดตามประสิทธิผล</Button>}
            <Button variant="secondary" icon={<Printer size={14} />} onClick={() => onAct({ kind: "print", d: { doc: "car", no: c.no }, title: "ใบขอให้ดำเนินการแก้ไขและป้องกัน" })}>พิมพ์</Button>
          </>
        }
      />
      <Body>
        <Card title="ปัญหา"><p className="px-4 py-3 text-[13px] text-slate-700 dark:text-slate-200">{c.problem}</p></Card>
        <Card title="สาเหตุราก" subtitle={c.rootCause ? `กลุ่ม${c.rootCause.category} · ถามทำไม ${c.rootCause.whys.length} ชั้น` : "ยังไม่วิเคราะห์"}>
          {c.rootCause && (
            <ol className="space-y-1.5 px-4 py-3 text-[13px] text-slate-700 dark:text-slate-200">
              {c.rootCause.whys.map((w, i) => (
                <li key={i} className="flex gap-2"><span className="w-16 shrink-0 text-slate-400">ทำไม {i + 1}</span><span className={i === c.rootCause!.whys.length - 1 ? "font-medium text-slate-900 dark:text-slate-50" : ""}>{w}</span></li>
              ))}
            </ol>
          )}
        </Card>
        <Card title="มาตรการ" subtitle="ทำเสร็จครบแล้วจึงติดตามผลได้">
          {c.actions.length === 0 ? (
            <p className="px-4 py-5 text-center text-[13px] text-slate-400">ยังไม่มีมาตรการ</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {c.actions.map((a, i) => {
                const late = !a.doneOn && a.due < TODAY;
                return (
                  <li key={i} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-[13px]">
                    <span className="min-w-0 flex-1">
                      <span className="block text-slate-800 dark:text-slate-100">{a.what}</span>
                      <span className={"block text-[11.5px] " + (late ? "text-rose-600 dark:text-rose-400" : "text-slate-400")}>{a.owner} · กำหนด {a.due}{late ? " · เลยกำหนด" : ""}</span>
                    </span>
                    {a.doneOn ? (
                      <Badge tone="ok">เสร็จ {a.doneOn}</Badge>
                    ) : (
                      c.status !== "ปิดแล้ว" && <Button variant="secondary" icon={<CircleCheck size={14} />} onClick={() => run(() => completeCapaAction(c.no, i), `บันทึกว่ามาตรการเสร็จแล้ว · ${c.no}`)}>ทำเสร็จแล้ว</Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        {c.verification && <Note tone={c.verification.effective ? "ok" : "bad"}>ติดตามผล {c.verification.date} โดย {c.verification.by}: {c.verification.effective ? "ได้ผล" : "ไม่ได้ผล"} — {c.verification.note}</Note>}
      </Body>
    </div>
  );
}

function AuditRecord({ a, onAct }: { a: Audit } & Handlers) {
  const missing = findingsWithoutCapa(a);
  return (
    <div className="flex h-full flex-col">
      <Header
        title={`${a.no} · ${a.area}`}
        meta={`ผู้ตรวจ ${a.auditor} · ${a.performedOn ? `ตรวจเมื่อ ${a.performedOn}` : `ตามแผน ${a.planned}`}`}
        badges={<><Badge dot tone={tone(a.status)}>{a.status}</Badge>{a.clauses.map((c) => <Chip key={c}>ข้อ {c}</Chip>)}</>}
        actions={
          <>
            {a.status === "ตามแผน" && <Button icon={<Play size={14} />} onClick={() => run(() => startAudit(a.no), `เริ่มตรวจ ${a.no} ${a.area} แล้ว`)}>เริ่มตรวจ</Button>}
            {a.status === "กำลังตรวจ" && <Button icon={<Plus size={14} />} onClick={() => onAct({ kind: "audit-finding", no: a.no })}>บันทึกสิ่งที่พบ</Button>}
            {a.status === "กำลังตรวจ" && <Button variant="secondary" icon={<CircleCheck size={14} />} onClick={() => run(() => closeAudit(a.no), `ปิดการตรวจ ${a.no} แล้ว`)}>ปิดการตรวจ</Button>}
            <Button variant="secondary" icon={<Printer size={14} />} onClick={() => onAct({ kind: "print", d: { doc: "audit", no: a.no }, title: "รายงานการตรวจติดตามภายใน" })}>พิมพ์รายงาน</Button>
          </>
        }
      />
      <Body>
        {a.status === "กำลังตรวจ" && missing.length > 0 && <Note tone="warn">ข้อบกพร่อง {missing.length} ข้อยังไม่มี CAR — ต้องออกก่อนปิดการตรวจ</Note>}
        <Card title="ขอบเขต">
          <ul className="space-y-1 px-4 py-3 text-[13px] text-slate-700 dark:text-slate-200">
            {a.clauses.map((c) => <li key={c}><span className="tabular-nums text-slate-400">ข้อ {c}</span> {CLAUSES.find((x) => x.code === c)?.name}</li>)}
          </ul>
        </Card>
        <Card title="สิ่งที่พบ" subtitle="ข้อบกพร่องต้องมี CAR · ข้อสังเกตไม่ต้อง">
          {a.findings.length === 0 ? (
            <p className="px-4 py-5 text-center text-[13px] text-slate-400">{a.status === "ตามแผน" ? "ยังไม่ได้ตรวจ" : "ยังไม่พบสิ่งที่ต้องบันทึก"}</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {a.findings.map((f) => (
                <li key={f.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-[13px]">
                  <span className="min-w-0 flex-1">
                    <span className="block text-slate-800 dark:text-slate-100">#{f.id} {f.detail}</span>
                    <span className="block text-[11.5px] text-slate-400">ข้อ {f.clause} {clauseName(f.clause)}</span>
                  </span>
                  <Badge tone={f.type === "ข้อสังเกต" ? "info" : f.type === "ข้อบกพร่องหลัก" ? "bad" : "warn"}>{f.type}</Badge>
                  {f.capa ? <Badge tone="ok">{f.capa}</Badge> : f.type !== "ข้อสังเกต" && <Button variant="secondary" onClick={() => onAct({ kind: "car-new", ref: `${a.no} #${f.id}`, problem: f.detail })}>ออก CAR</Button>}
                </li>
              ))}
            </ul>
          )}
        </Card>
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
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {[...g.records].reverse().map((r, i) => (
              <li key={i} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-[13px]">
                <span className="w-24 shrink-0 tabular-nums text-slate-500">{r.date}</span>
                <span className="min-w-0 flex-1 text-slate-700 dark:text-slate-200">{r.by}<span className="block text-[11.5px] text-slate-400">ใบรับรอง {r.certNo} · คลาดเคลื่อน {r.error}{r.note ? ` · ${r.note}` : ""}</span></span>
                <Badge tone={r.result === "ผ่าน" ? "ok" : "bad"}>{r.result}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      </Body>
    </div>
  );
}
