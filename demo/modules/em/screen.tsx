import { useState } from "react";
import type { ReactNode } from "react";
import {
  AlarmSmoke, CircleCheck, Droplets, FileSpreadsheet, FlaskConical, Leaf, Plus, Printer, Recycle, Scale,
  Scroll, ShieldAlert, Siren, Trash2, Truck,
} from "lucide-react";
import { TODAY, addDays, capaByNo, carOf, docByCode, revLabel } from "../ims/data";
import { Body, Empty, Header, Line, Lines, newest, tone } from "../ims/parts";
import {
  ASPECTS, CHEMICALS, DISPOSALS, DRILLS, GENERATIONS, INCIDENTS, MONITORINGS, OBLIGATIONS, PARAMETERS, PLANS, RECEIVERS,
  WASTE_TYPES, aspectScore, chemicalIssues, drillDue, drillsOverdue, evaluationDue, exceedancesOf, exceeds, incidentByNo,
  lastDrill, lastEvaluation, limitText, monitoringDue, nextEvaluation, obligationByNo, onHand, overStored, pendingScrap,
  planByCode, qtyOf, sdsExpired, significant, storedTooLong, uncontrolled, wasteType, aspectByNo,
} from "./data";
import type { Aspect, Monitoring, Obligation } from "./data";
import { EmActions } from "./forms";
import type { Act, RecordKind } from "./forms";
import { Badge, Button, Card, Chip, ColumnChart, Metric, Note, PageHead, Reveal } from "../ui";
import type { Tone } from "../ui";
import { DataTable, DetailModal, downloadCsv, notify, useData } from "../kit";
import type { Column } from "../kit";

const TABS = ["ประเด็นสิ่งแวดล้อม", "กฎหมายสิ่งแวดล้อม", "ของเสียและสารเคมี", "การตรวจวัดสิ่งแวดล้อม", "เหตุฉุกเฉินและการซ้อม"];

const exportIcon = <FileSpreadsheet size={14} />;
const csv = (name: string, head: string[], rows: (string | number)[][]) => {
  downloadCsv(name, head, rows);
  notify(`ส่งออก${name} ${rows.length} รายการแล้ว`);
};
const kg = (n: number) => `${n.toLocaleString("th-TH")} กก.`;

type Handlers = { onAct: (a: Act) => void; onOpen: (kind: RecordKind, key: string) => void };

export default function EmScreen({ section, onOpenSection }: { section?: string; onOpenSection?: (index: number) => void }) {
  useData();
  const tab = section && TABS.includes(section) ? section : undefined;
  const [act, setAct] = useState<Act | null>(null);
  const [record, setRecord] = useState<{ kind: RecordKind; key: string } | null>(null);
  const open = (kind: RecordKind, key: string) => setRecord({ kind, key });

  const keys: Record<RecordKind, string[]> = {
    aspect: ASPECTS.map((a) => a.no),
    obligation: OBLIGATIONS.map((o) => o.no),
    waste: WASTE_TYPES.map((w) => w.code),
    monitoring: newest(MONITORINGS).map((m) => m.no),
    plan: PLANS.map((p) => p.code),
    incident: newest(INCIDENTS).map((i) => i.no),
  };
  const list = record ? keys[record.kind] : [];
  const at = record ? list.indexOf(record.key) : -1;
  const TITLES: Record<RecordKind, string> = { aspect: "ประเด็นสิ่งแวดล้อม", obligation: "กฎหมายและพันธะ", waste: "ของเสีย", monitoring: "ผลตรวจวัด", plan: "แผนฉุกเฉิน", incident: "อุบัติการณ์" };
  const h: Handlers = { onAct: setAct, onOpen: open };

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
      <EmActions act={act} onAct={setAct} onOpen={open} />
    </>
  );

  const index = (
    <div hidden data-fitt-index>
      <button data-fitt-screen="การจัดการสิ่งแวดล้อม" />
      <button data-fitt-screen="ประเด็นสิ่งแวดล้อม" data-fitt-modal onClick={() => open("aspect", ASPECTS[0].no)} />
      <button data-fitt-screen="เพิ่มประเด็นสิ่งแวดล้อม" data-fitt-modal onClick={() => setAct({ kind: "aspect-new" })} />
      <button data-fitt-screen="กฎหมายและพันธะ" data-fitt-modal onClick={() => open("obligation", OBLIGATIONS[0].no)} />
      <button data-fitt-screen="เพิ่มกฎหมายหรือพันธะ" data-fitt-modal onClick={() => setAct({ kind: "obligation-new" })} />
      <button data-fitt-screen="ประเมินความสอดคล้อง" data-fitt-modal onClick={() => setAct({ kind: "obligation-evaluate", no: OBLIGATIONS[0].no })} />
      <button data-fitt-screen="ของเสีย" data-fitt-modal onClick={() => open("waste", WASTE_TYPES[0].code)} />
      <button data-fitt-screen="บันทึกของเสียเข้าบัญชี" data-fitt-modal onClick={() => setAct({ kind: "waste-generate" })} />
      <button data-fitt-screen="ส่งของเสียกำจัด" data-fitt-modal onClick={() => setAct({ kind: "waste-dispose" })} />
      <button data-fitt-screen="บันทึกใบรับรองการกำจัด" data-fitt-modal onClick={() => setAct({ kind: "waste-certificate", no: DISPOSALS.find((d) => !d.certificate)?.no ?? DISPOSALS[0].no })} />
      <button data-fitt-screen="ปรับปรุง SDS" data-fitt-modal onClick={() => setAct({ kind: "sds-update", code: CHEMICALS[1].code })} />
      <button data-fitt-screen="ผลตรวจวัด" data-fitt-modal onClick={() => open("monitoring", MONITORINGS[0].no)} />
      <button data-fitt-screen="บันทึกผลตรวจวัดสิ่งแวดล้อม" data-fitt-modal onClick={() => setAct({ kind: "monitoring-new" })} />
      <button data-fitt-screen="แผนฉุกเฉิน" data-fitt-modal onClick={() => open("plan", PLANS[0].code)} />
      <button data-fitt-screen="บันทึกการฝึกซ้อม" data-fitt-modal onClick={() => setAct({ kind: "drill-new" })} />
      <button data-fitt-screen="อุบัติการณ์" data-fitt-modal onClick={() => open("incident", INCIDENTS[0].no)} />
      <button data-fitt-screen="บันทึกอุบัติการณ์สิ่งแวดล้อม" data-fitt-modal onClick={() => setAct({ kind: "incident-new" })} />
      <button data-fitt-screen="บันทึกการรายงานหน่วยงานรัฐ" data-fitt-modal onClick={() => setAct({ kind: "incident-report", no: INCIDENTS[INCIDENTS.length - 1].no })} />
      <button data-fitt-screen="ปิดอุบัติการณ์" data-fitt-modal onClick={() => setAct({ kind: "incident-close", no: INCIDENTS[INCIDENTS.length - 1].no })} />
      <button data-fitt-screen="พิมพ์ทะเบียนประเด็นสิ่งแวดล้อม" data-fitt-modal onClick={() => setAct({ kind: "print", d: { doc: "aspects" }, title: "ทะเบียนประเด็นสิ่งแวดล้อม" })} />
      <button data-fitt-screen="พิมพ์ทะเบียนกฎหมาย" data-fitt-modal onClick={() => setAct({ kind: "print", d: { doc: "obligations" }, title: "ทะเบียนกฎหมายและผลการประเมินความสอดคล้อง" })} />
      <button data-fitt-screen="พิมพ์บัญชีของเสีย" data-fitt-modal onClick={() => setAct({ kind: "print", d: { doc: "waste" }, title: "บัญชีของเสียและการส่งกำจัด" })} />
      <button data-fitt-screen="พิมพ์ผลตรวจวัด" data-fitt-modal onClick={() => setAct({ kind: "print", d: { doc: "monitoring", no: MONITORINGS[0].no }, title: "รายงานผลการตรวจวัดสิ่งแวดล้อม" })} />
      <button data-fitt-screen="พิมพ์รายงานการซ้อม" data-fitt-modal onClick={() => setAct({ kind: "print", d: { doc: "drill", no: DRILLS[0].no }, title: "รายงานการฝึกซ้อมแผนฉุกเฉิน" })} />
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
      <PageHead title="การจัดการสิ่งแวดล้อม" meta={`${tab} · ISO 14001:2015 · ข้อมูล ณ ${TODAY}`} />
      {tab === "ประเด็นสิ่งแวดล้อม" && <Aspects {...h} />}
      {tab === "กฎหมายสิ่งแวดล้อม" && <Obligations {...h} />}
      {tab === "ของเสียและสารเคมี" && <Waste {...h} />}
      {tab === "การตรวจวัดสิ่งแวดล้อม" && <Measurements {...h} />}
      {tab === "เหตุฉุกเฉินและการซ้อม" && <Emergency {...h} />}
      {panels}
      {index}
    </div>
  );
}

/* -------------------------------------------------------------- overview */

function Overview({ onOpenSection, onAct, onOpen }: Handlers & { onOpenSection?: (i: number) => void }) {
  const sig = ASPECTS.filter(significant);
  const hazOnHand = WASTE_TYPES.filter((w) => w.hazardous).reduce((n, w) => n + onHand(w.code).kg, 0);
  const oldest = Math.max(0, ...WASTE_TYPES.filter((w) => w.hazardous).map((w) => onHand(w.code).days));
  const late = monitoringDue().filter((d) => d.late);
  const months = [...new Set(GENERATIONS.map((g) => g.date.slice(0, 7)))].sort();
  const cod = MONITORINGS.filter((m) => m.values["WW-COD"] !== undefined);
  const expiring = RECEIVERS.filter((r) => r.validUntil <= addDays(TODAY, 30));

  const todo: { icon: ReactNode; text: string; sub: string; go: () => void; tone: Tone }[] = [
    ...late.map((d) => ({ icon: <Droplets size={15} />, text: `ตรวจวัด${d.group}`, sub: `เลยรอบ ${d.due}`, go: () => onAct({ kind: "monitoring-new", group: d.group }), tone: "bad" as Tone })),
    ...uncontrolled().map((a) => ({ icon: <Leaf size={15} />, text: `${a.no} ${a.aspect}`, sub: "มีนัยสำคัญแต่ไม่มีเอกสารควบคุมที่ใช้งาน", go: () => onOpen("aspect", a.no), tone: "bad" as Tone })),
    ...evaluationDue().map((o) => ({ icon: <Scroll size={15} />, text: `${o.no} ${o.title.slice(0, 60)}`, sub: `ถึงรอบประเมินความสอดคล้อง ${nextEvaluation(o)}`, go: () => onAct({ kind: "obligation-evaluate", no: o.no }), tone: "warn" as Tone })),
    ...pendingScrap().map((m) => ({ icon: <Scale size={15} />, text: `${m.doc} ${m.reason}`, sub: "คลังวัสดุตัดเป็นของเสียแล้ว รอชั่งเข้าบัญชี", go: () => onAct({ kind: "waste-generate", source: m.doc }), tone: "warn" as Tone })),
    ...storedTooLong().map((w) => ({ icon: <Trash2 size={15} />, text: w.name, sub: `เก็บมาแล้ว ${onHand(w.code).days} วัน (กฎหมายไม่เกิน 90 วัน)`, go: () => onAct({ kind: "waste-dispose", type: w.code }), tone: "bad" as Tone })),
    ...chemicalIssues().map((c) => ({ icon: <FlaskConical size={15} />, text: c.name, sub: sdsExpired(c) ? `SDS ฉบับ ${c.sdsDate} เกิน 5 ปี` : `เก็บเกินที่ขออนุญาต ${c.maxQty} ${c.unit}`, go: () => onAct({ kind: "sds-update", code: c.code }), tone: "warn" as Tone })),
    ...drillsOverdue().map((p) => ({ icon: <Siren size={15} />, text: `${p.code} ${p.scenario}`, sub: `เลยรอบซ้อม ${drillDue(p)}`, go: () => onAct({ kind: "drill-new", plan: p.code }), tone: "bad" as Tone })),
    ...expiring.map((r) => ({ icon: <Truck size={15} />, text: r.name, sub: `ใบอนุญาต ${r.license} หมดอายุ ${r.validUntil}`, go: () => onOpenSection?.(2), tone: "warn" as Tone })),
  ];

  return (
    <div>
      <PageHead
        title="การจัดการสิ่งแวดล้อม"
        meta={`ISO 14001:2015 · ข้อมูล ณ ${TODAY}`}
        right={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" icon={<AlarmSmoke size={14} />} onClick={() => onAct({ kind: "incident-new" })}>บันทึกอุบัติการณ์</Button>
            <Button icon={<Droplets size={14} />} onClick={() => onAct({ kind: "monitoring-new" })}>บันทึกผลตรวจวัด</Button>
          </div>
        }
      />
      <Reveal>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Metric icon={<Leaf size={17} />} label="ประเด็นที่มีนัยสำคัญ" value={`${sig.length} จาก ${ASPECTS.length}`} deltaLabel={uncontrolled().length ? `ไม่มีเอกสารควบคุม ${uncontrolled().length}` : "มีเอกสารควบคุมครบ"} />
          <Metric icon={<Scroll size={17} />} label="กฎหมายที่ถึงรอบประเมิน" value={`${evaluationDue().length} ฉบับ`} deltaLabel={`ในทะเบียน ${OBLIGATIONS.length} ฉบับ`} />
          <Metric icon={<Trash2 size={17} />} label="ของเสียอันตรายที่เก็บอยู่" value={kg(hazOnHand)} deltaLabel={`เก็บนานสุด ${oldest} วัน · กฎหมาย 90 วัน`} />
          <Metric icon={<Droplets size={17} />} label="ตรวจวัดเลยรอบ" value={`${late.length} กลุ่ม`} deltaLabel={`เกินมาตรฐานปีนี้ ${MONITORINGS.filter((m) => m.date.slice(0, 4) === TODAY.slice(0, 4) && exceedancesOf(m).length).length} ครั้ง`} />
        </div>
      </Reveal>
      <Reveal delay={0.06} className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card title="ต้องจัดการ" subtitle="กดรายการเพื่อเปิดงานนั้น" className="lg:col-span-2">
          {todo.length === 0 ? (
            <Empty>ไม่มีงานค้าง</Empty>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {todo.slice(0, 9).map((t, i) => (
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
        <Card title="COD น้ำทิ้ง" subtitle="เกณฑ์ไม่เกิน 120 mg/L · แท่งเหลืองคือเกินเกณฑ์" action={<Button variant="ghost" className="whitespace-nowrap" onClick={() => onOpenSection?.(3)}>ผลทั้งหมด</Button>}>
          <ColumnChart data={cod.map((m) => ({ label: m.date.slice(5), value: m.values["WW-COD"], tone: m.values["WW-COD"] > 120 ? "warn" : undefined }))} format={(n) => `${n} mg/L`} />
        </Card>
      </Reveal>
      <Reveal delay={0.12} className="mt-4">
        <Card title="ของเสียอันตรายที่เกิดรายเดือน" subtitle="ใช้ติดตามวัตถุประสงค์ลดของเสียอันตราย">
          <ColumnChart data={months.map((m) => ({ label: m.slice(5), value: GENERATIONS.filter((g) => g.date.slice(0, 7) === m && wasteType(g.type).hazardous).reduce((n, g) => n + g.kg, 0) }))} format={kg} />
        </Card>
      </Reveal>
    </div>
  );
}

/* --------------------------------------------------------------- aspects */

function Aspects({ onAct, onOpen }: Handlers) {
  const columns: Column<Aspect>[] = [
    { key: "no", header: "เลขที่", cell: (a) => <span className="whitespace-nowrap font-medium tabular-nums text-slate-800 dark:text-slate-100">{a.no}</span>, sort: (a, b) => a.no.localeCompare(b.no) },
    { key: "activity", header: "กิจกรรม", cell: (a) => a.activity },
    { key: "aspect", header: "ประเด็น → ผลกระทบ", cell: (a) => <span><span className="text-slate-800 dark:text-slate-100">{a.aspect}</span><span className="block text-[11.5px] text-slate-400">{a.impact}</span></span> },
    { key: "condition", header: "สภาวะ", cell: (a) => <span className="whitespace-nowrap"><Chip>{a.condition}</Chip></span> },
    { key: "stage", header: "วัฏจักร", cell: (a) => a.stage },
    { key: "score", header: "ร×ถ", align: "right", cell: (a) => <span className="tabular-nums">{aspectScore(a)}</span>, sort: (a, b) => aspectScore(a) - aspectScore(b) },
    { key: "sig", header: "นัยสำคัญ", cell: (a) => (significant(a) ? <Badge tone="warn">{a.legal ? "มี · กฎหมาย" : "มี"}</Badge> : <Badge tone="idle">ไม่มี</Badge>) },
    { key: "control", header: "การควบคุม", cell: (a) => (a.control ? <Badge tone={tone(docByCode(a.control).status)}>{a.control}</Badge> : "—") },
  ];
  return (
    <div className="space-y-4">
      {uncontrolled().length > 0 && <Note tone="bad">ประเด็นที่มีนัยสำคัญ {uncontrolled().length} ข้อยังไม่มีเอกสารควบคุมที่ใช้งาน</Note>}
      <DataTable
        rows={ASPECTS}
        columns={columns}
        getId={(a) => a.no}
        onOpen={(a) => onOpen("aspect", a.no)}
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[12.5px] text-slate-500 dark:text-slate-400">มีนัยสำคัญเมื่อมีกฎหมายเกี่ยวข้อง หรือความรุนแรง × ความถี่ตั้งแต่ 12 — ต้องชี้ไปที่เอกสารควบคุมในทะเบียนกลาง</p>
            <div className="ml-auto flex gap-2">
              <Button variant="secondary" icon={exportIcon} onClick={() => csv("ทะเบียนประเด็นสิ่งแวดล้อม", ["เลขที่", "กิจกรรม", "ประเด็น", "ผลกระทบ", "สภาวะ", "วัฏจักร", "ความรุนแรง", "ความถี่", "กฎหมาย", "นัยสำคัญ", "การควบคุม"], ASPECTS.map((a) => [a.no, a.activity, a.aspect, a.impact, a.condition, a.stage, a.severity, a.frequency, a.legal ? "มี" : "", significant(a) ? "มี" : "", a.control ?? ""]))}>ส่งออก Excel</Button>
              <Button variant="secondary" icon={<Printer size={14} />} onClick={() => onAct({ kind: "print", d: { doc: "aspects" }, title: "ทะเบียนประเด็นสิ่งแวดล้อม" })}>พิมพ์ทะเบียน</Button>
              <Button icon={<Plus size={14} />} onClick={() => onAct({ kind: "aspect-new" })}>เพิ่มประเด็น</Button>
            </div>
          </div>
        }
      />
    </div>
  );
}

/* ----------------------------------------------------------- obligations */

function Obligations({ onAct, onOpen }: Handlers) {
  const due = new Set(evaluationDue().map((o) => o.no));
  const columns: Column<Obligation>[] = [
    { key: "no", header: "เลขที่", cell: (o) => <span className="whitespace-nowrap font-medium tabular-nums text-slate-800 dark:text-slate-100">{o.no}</span> },
    { key: "title", header: "กฎหมาย / พันธะ", cell: (o) => <span className="line-clamp-2">{o.title}</span> },
    { key: "authority", header: "หน่วยงาน", cell: (o) => o.authority },
    { key: "last", header: "ประเมินล่าสุด", cell: (o) => lastEvaluation(o)?.date ?? "—" },
    { key: "result", header: "ผล", cell: (o) => (lastEvaluation(o) ? <Badge dot tone={lastEvaluation(o)!.result === "สอดคล้อง" ? "ok" : "bad"}>{lastEvaluation(o)!.result}</Badge> : <Badge tone="idle">ยังไม่ประเมิน</Badge>) },
    { key: "next", header: "ประเมินครั้งถัดไป", cell: (o) => <span className={due.has(o.no) ? "font-medium text-rose-600 dark:text-rose-400" : ""}>{nextEvaluation(o)}</span> },
  ];
  return (
    <div className="space-y-4">
      {due.size > 0 && <Note tone="warn">ถึงรอบประเมินความสอดคล้องภายใน 30 วัน {due.size} ฉบับ</Note>}
      <DataTable
        rows={OBLIGATIONS}
        columns={columns}
        getId={(o) => o.no}
        onOpen={(o) => onOpen("obligation", o.no)}
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[12.5px] text-slate-500 dark:text-slate-400">ประเมินความสอดคล้องอย่างน้อยปีละครั้ง ไม่สอดคล้องเปิด CAR ให้เอง (ข้อ 9.1.2)</p>
            <div className="ml-auto flex gap-2">
              <Button variant="secondary" icon={exportIcon} onClick={() => csv("ทะเบียนกฎหมาย", ["เลขที่", "กฎหมาย", "หน่วยงาน", "สิ่งที่ต้องทำ", "ใช้กับ", "ประเมินล่าสุด", "ผล", "ครั้งถัดไป"], OBLIGATIONS.map((o) => [o.no, o.title, o.authority, o.requirement, o.appliesTo, lastEvaluation(o)?.date ?? "", lastEvaluation(o)?.result ?? "", nextEvaluation(o)]))}>ส่งออก Excel</Button>
              <Button variant="secondary" icon={<Printer size={14} />} onClick={() => onAct({ kind: "print", d: { doc: "obligations" }, title: "ทะเบียนกฎหมายและผลการประเมินความสอดคล้อง" })}>พิมพ์ทะเบียน</Button>
              <Button icon={<Plus size={14} />} onClick={() => onAct({ kind: "obligation-new" })}>เพิ่มกฎหมาย</Button>
            </div>
          </div>
        }
      />
    </div>
  );
}

/* ----------------------------------------------------------------- waste */

function Waste({ onAct, onOpen }: Handlers) {
  const scrap = pendingScrap();
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[12.5px] text-slate-500 dark:text-slate-400">ส่งกำจัดได้ไม่เกินที่เก็บอยู่ ให้ผู้รับที่ใบอนุญาตยังไม่หมดอายุ ของเสียอันตรายเก็บไม่เกิน 90 วัน</p>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="secondary" icon={exportIcon} onClick={() => csv("การส่งกำจัดของเสีย", ["เลขที่", "วันที่", "ของเสีย", "กก.", "ผู้รับ", "ใบกำกับ", "ใบรับรอง"], DISPOSALS.map((d) => [d.no, d.date, wasteType(d.type).name, d.kg, d.receiver, d.manifest, d.certificate ?? ""]))}>ส่งออก Excel</Button>
          <Button variant="secondary" icon={<Printer size={14} />} onClick={() => onAct({ kind: "print", d: { doc: "waste" }, title: "บัญชีของเสียและการส่งกำจัด" })}>พิมพ์บัญชีของเสีย</Button>
          <Button variant="secondary" icon={<Scale size={14} />} onClick={() => onAct({ kind: "waste-generate" })}>บันทึกของเสีย</Button>
          <Button icon={<Truck size={14} />} onClick={() => onAct({ kind: "waste-dispose" })}>ส่งกำจัด</Button>
        </div>
      </div>
      {scrap.length > 0 && (
        <Card title="ของที่คลังวัสดุตัดเป็นของเสีย รอชั่งเข้าบัญชี" subtitle="อ่านจากความเคลื่อนไหวสต็อกของระบบจัดซื้อ">
          <Lines>
            {scrap.map((m) => <Line key={m.doc} title={`${m.doc} · ${m.reason}`} sub={`${m.date} · ${Math.abs(m.qty)} หน่วย`} right={<Button variant="secondary" icon={<Scale size={14} />} onClick={() => onAct({ kind: "waste-generate", source: m.doc })}>ชั่งเข้าบัญชี</Button>} />)}
          </Lines>
        </Card>
      )}
      <Card title="ของเสียที่เก็บอยู่" subtitle="กดเพื่อดูประวัติเกิดและส่งกำจัด">
        <Lines>
          {WASTE_TYPES.map((w) => {
            const h = onHand(w.code);
            const t: Tone = !w.hazardous || h.kg === 0 ? "idle" : h.days > 90 ? "bad" : h.days > 60 ? "warn" : "ok";
            return (
              <li key={w.code}>
                <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-[13px]">
                  <button onClick={() => onOpen("waste", w.code)} className="min-w-0 flex-1 text-left">
                    <span className="block text-slate-800 dark:text-slate-100">{w.code} · {w.name} {w.hazardous && <Badge tone="bad">อันตราย</Badge>}</span>
                    <span className="block text-[11.5px] text-slate-400">{w.storage} · {w.method}</span>
                  </button>
                  <span className="tabular-nums text-slate-700 dark:text-slate-200">{kg(h.kg)}</span>
                  {h.kg > 0 && <Badge tone={t}>{h.days} วัน</Badge>}
                  <Button variant="secondary" icon={<Truck size={14} />} onClick={() => onAct({ kind: "waste-dispose", type: w.code })}>ส่งกำจัด</Button>
                </div>
              </li>
            );
          })}
        </Lines>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="การส่งกำจัด" subtitle="ใบรับรองการกำจัดปิดวงจรว่ากำจัดจริง">
          <Lines>
            {newest(DISPOSALS).map((d) => <Line key={d.no} title={`${d.no} · ${wasteType(d.type).name} ${kg(d.kg)}`} sub={`${d.date} · ${d.receiver} · ${d.manifest}`} right={d.certificate ? <Badge tone="ok">{d.certificate}</Badge> : <Button variant="secondary" onClick={() => onAct({ kind: "waste-certificate", no: d.no })}>รับใบรับรอง</Button>} />)}
          </Lines>
        </Card>
        <Card title="สารเคมี" subtitle="ปริมาณของสารที่ซื้อผ่านระบบจัดซื้ออ่านจากคลังวัสดุ · SDS ทบทวนทุก 5 ปี">
          <Lines>
            {CHEMICALS.map((c) => (
              <Line
                key={c.code}
                title={`${c.code} · ${c.name}`}
                sub={`${c.hazard} · ${c.location} · คงเหลือ ${qtyOf(c)} / ${c.maxQty} ${c.unit}${c.material ? ` (${c.material})` : ""}`}
                right={
                  <span className="flex items-center gap-2">
                    {overStored(c) && <Badge tone="bad">เก็บเกิน</Badge>}
                    <Badge tone={sdsExpired(c) ? "bad" : "ok"}>SDS {c.sdsDate}</Badge>
                    {sdsExpired(c) && <Button variant="secondary" onClick={() => onAct({ kind: "sds-update", code: c.code })}>ปรับปรุง SDS</Button>}
                  </span>
                }
              />
            ))}
          </Lines>
        </Card>
      </div>
      <Card title="ผู้รับกำจัดที่ได้รับอนุญาต">
        <Lines>
          {RECEIVERS.map((r) => <Line key={r.name} title={r.name} sub={`ใบอนุญาต ${r.license} · ${r.methods.join(", ")}`} right={<Badge tone={r.validUntil < TODAY ? "bad" : r.validUntil <= addDays(TODAY, 30) ? "warn" : "ok"}>ถึง {r.validUntil}</Badge>} />)}
        </Lines>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------ monitoring */

function Measurements({ onAct, onOpen }: Handlers) {
  const columns: Column<Monitoring>[] = [
    { key: "no", header: "เลขที่", cell: (m) => <span className="whitespace-nowrap font-medium tabular-nums text-slate-800 dark:text-slate-100">{m.no}</span>, sort: (a, b) => a.no.localeCompare(b.no) },
    { key: "date", header: "วันที่", cell: (m) => m.date, sort: (a, b) => a.date.localeCompare(b.date) },
    { key: "group", header: "กลุ่ม", cell: (m) => <Chip>{m.group}</Chip> },
    { key: "values", header: "ผล", cell: (m) => <span className="text-slate-600 dark:text-slate-300">{Object.entries(m.values).map(([code, v]) => `${PARAMETERS.find((p) => p.code === code)!.name} ${v}`).join(" · ")}</span> },
    { key: "state", header: "ผลเทียบเกณฑ์", cell: (m) => (exceedancesOf(m).length ? <Badge tone="bad">เกิน {exceedancesOf(m).length} ค่า</Badge> : <Badge tone="ok">ผ่านทุกค่า</Badge>) },
    { key: "car", header: "CAR", cell: (m) => <span className="tabular-nums text-slate-500">{m.car ?? "—"}</span> },
  ];
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        {monitoringDue().map((d) => (
          <div key={d.group} className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[14px] font-semibold text-slate-900 dark:text-slate-50">{d.group}</p>
              <Badge dot tone={d.late ? "bad" : d.soon ? "warn" : "ok"}>{d.late ? "เลยรอบ" : d.soon ? "ใกล้ถึงรอบ" : "ตามรอบ"}</Badge>
            </div>
            <p className="mt-1 text-[12.5px] text-slate-500">ล่าสุด {d.last ?? "—"} · ครั้งถัดไป {d.due}</p>
            <p className="mt-1 text-[11.5px] text-slate-400">{PARAMETERS.filter((p) => p.group === d.group).map((p) => `${p.name} ${limitText(p)}`).join(" · ")}</p>
            <Button className="mt-3" variant={d.late ? "primary" : "secondary"} icon={<Droplets size={14} />} onClick={() => onAct({ kind: "monitoring-new", group: d.group })}>บันทึกผล</Button>
          </div>
        ))}
      </div>
      <DataTable
        rows={newest(MONITORINGS)}
        columns={columns}
        getId={(m) => m.no}
        onOpen={(m) => onOpen("monitoring", m.no)}
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[12.5px] text-slate-500 dark:text-slate-400">ผลที่เกินค่ามาตรฐานเปิด CAR ในระบบบริหารบูรณาการให้เอง (ข้อ 9.1.1)</p>
            <Button className="ml-auto" variant="secondary" icon={exportIcon} onClick={() => csv("ผลตรวจวัดสิ่งแวดล้อม", ["เลขที่", "วันที่", "กลุ่ม", "พารามิเตอร์", "ผล", "เกณฑ์", "เกิน"], MONITORINGS.flatMap((m) => Object.entries(m.values).map(([code, v]) => { const p = PARAMETERS.find((x) => x.code === code)!; return [m.no, m.date, m.group, p.name, v, limitText(p), exceeds(p, v) ? "เกิน" : ""]; })))}>ส่งออก Excel</Button>
          </div>
        }
      />
    </div>
  );
}

/* ------------------------------------------------------------- emergency */

function Emergency({ onAct, onOpen }: Handlers) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[12.5px] text-slate-500 dark:text-slate-400">ซ้อมทุกแผนตามรอบ ซ้อมแล้วต้องปรับปรุงต้องบอกสิ่งที่จะปรับ อุบัติการณ์เปิด CAR ทุกครั้ง</p>
        <div className="ml-auto flex gap-2">
          <Button variant="secondary" icon={exportIcon} onClick={() => csv("การฝึกซ้อมแผนฉุกเฉิน", ["เลขที่", "แผน", "วันที่", "ผู้เข้าร่วม", "นาที", "ผล", "สิ่งที่พบ", "ปรับปรุง"], DRILLS.map((d) => [d.no, d.plan, d.date, d.participants, d.minutes, d.result, d.findings, d.improvement ?? ""]))}>ส่งออก Excel</Button>
          <Button variant="secondary" icon={<AlarmSmoke size={14} />} onClick={() => onAct({ kind: "incident-new" })}>บันทึกอุบัติการณ์</Button>
          <Button icon={<Siren size={14} />} onClick={() => onAct({ kind: "drill-new" })}>บันทึกการซ้อม</Button>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {PLANS.map((p) => {
          const last = lastDrill(p.code);
          const late = drillDue(p) < TODAY;
          return (
            <Card key={p.code} title={`${p.code} · ${p.scenario}`} subtitle={p.area} action={<Button variant="ghost" onClick={() => onOpen("plan", p.code)}>เปิด</Button>}>
              <div className="space-y-2 px-4 py-3 text-[12.5px]">
                <p className="text-slate-600 dark:text-slate-300">ซ้อมล่าสุด {last?.date ?? "ยังไม่เคย"}{last ? ` · ${last.result}` : ""}</p>
                <Badge dot tone={late ? "bad" : "ok"}>{late ? `เลยรอบซ้อม ${drillDue(p)}` : `ซ้อมครั้งถัดไป ${drillDue(p)}`}</Badge>
                <div><Button variant={late ? "primary" : "secondary"} icon={<Siren size={14} />} onClick={() => onAct({ kind: "drill-new", plan: p.code })}>บันทึกการซ้อม</Button></div>
              </div>
            </Card>
          );
        })}
      </div>
      <Card title="อุบัติการณ์สิ่งแวดล้อม" subtitle="ข้อ 10.2">
        {INCIDENTS.length === 0 ? <Empty>ไม่มีอุบัติการณ์</Empty> : (
          <Lines>
            {newest(INCIDENTS).map((i) => (
              <li key={i.no}>
                <button onClick={() => onOpen("incident", i.no)} className="flex w-full flex-wrap items-center gap-3 px-4 py-2.5 text-left text-[13px] hover:bg-slate-50 dark:hover:bg-slate-800/60">
                  <span className="min-w-0 flex-1">
                    <span className="block text-slate-800 dark:text-slate-100">{i.no} · {i.description}</span>
                    <span className="block text-[11.5px] text-slate-400">{i.date} · {i.impact}</span>
                  </span>
                  <Badge tone={tone(i.severity)}>{i.severity}</Badge>
                  <Badge dot tone={i.status === "ปิดแล้ว" ? "ok" : "warn"}>{i.status}</Badge>
                </button>
              </li>
            ))}
          </Lines>
        )}
      </Card>
    </div>
  );
}

/* --------------------------------------------------------------- records */

function RecordView({ kind, id, ...h }: { kind: RecordKind; id: string } & Handlers) {
  if (kind === "aspect") return <AspectRecord a={aspectByNo(id)} {...h} />;
  if (kind === "obligation") return <ObligationRecord o={obligationByNo(id)} {...h} />;
  if (kind === "waste") return <WasteRecord code={id} {...h} />;
  if (kind === "monitoring") return <MonitoringRecord m={MONITORINGS.find((x) => x.no === id)!} {...h} />;
  if (kind === "plan") return <PlanRecord code={id} {...h} />;
  return <IncidentRecord no={id} {...h} />;
}

function AspectRecord({ a, onAct }: { a: Aspect } & Handlers) {
  const doc = a.control ? docByCode(a.control) : undefined;
  return (
    <div className="flex h-full flex-col">
      <Header
        title={`${a.no} · ${a.aspect}`}
        meta={`${a.activity} · ${a.condition} · ${a.stage} · ${a.owner}`}
        badges={<>{significant(a) ? <Badge tone="warn">มีนัยสำคัญ</Badge> : <Badge tone="idle">ไม่มีนัยสำคัญ</Badge>}{a.legal && <Badge tone="info">มีกฎหมายเกี่ยวข้อง</Badge>}<Badge tone="idle">{a.severity} × {a.frequency} = {aspectScore(a)}</Badge></>}
        actions={<Button variant="secondary" icon={<Printer size={14} />} onClick={() => onAct({ kind: "print", d: { doc: "aspects" }, title: "ทะเบียนประเด็นสิ่งแวดล้อม" })}>พิมพ์ทะเบียน</Button>}
      />
      <Body>
        <Card title="ผลกระทบ"><p className="px-4 py-3 text-[13px] text-slate-700 dark:text-slate-200">{a.impact}</p></Card>
        <Card title="การควบคุมการปฏิบัติงาน" subtitle="ข้อ 8.1 — เอกสารในทะเบียนกลาง">
          {doc ? <Lines><Line title={`${doc.code} · ${doc.title}`} sub={`${revLabel(doc.rev)} · ${doc.owner}`} right={<Badge dot tone={tone(doc.status)}>{doc.status}</Badge>} /></Lines> : <Empty>{significant(a) ? "ยังไม่มี — ต้องมีเพราะมีนัยสำคัญ" : "ไม่ต้องมีเพราะไม่มีนัยสำคัญ"}</Empty>}
        </Card>
      </Body>
    </div>
  );
}

function ObligationRecord({ o, onAct }: { o: Obligation } & Handlers) {
  return (
    <div className="flex h-full flex-col">
      <Header
        title={`${o.no} · ${o.authority}`}
        meta={o.title}
        badges={<>{lastEvaluation(o) ? <Badge dot tone={lastEvaluation(o)!.result === "สอดคล้อง" ? "ok" : "bad"}>{lastEvaluation(o)!.result}</Badge> : <Badge tone="idle">ยังไม่ประเมิน</Badge>}<Badge tone="idle">ครั้งถัดไป {nextEvaluation(o)}</Badge></>}
        actions={<Button icon={<CircleCheck size={14} />} onClick={() => onAct({ kind: "obligation-evaluate", no: o.no })}>ประเมินความสอดคล้อง</Button>}
      />
      <Body>
        <Card title="สิ่งที่ต้องทำให้สอดคล้อง" subtitle={`ใช้กับ ${o.appliesTo}`}><p className="px-4 py-3 text-[13px] text-slate-700 dark:text-slate-200">{o.requirement}</p></Card>
        <Card title="ประวัติการประเมิน">
          {o.evaluations.length === 0 ? <Empty>ยังไม่เคยประเมิน</Empty> : (
            <Lines>
              {[...o.evaluations].reverse().map((e) => {
                const car = carOf(`${o.no} ${e.date}`);
                return <Line key={e.date} title={`${e.date} · ${e.result}`} sub={`${e.evidence} · ${e.by}`} right={car ? <Badge tone={tone(car.status)}>{car.no} · {car.status}</Badge> : undefined} />;
              })}
            </Lines>
          )}
        </Card>
      </Body>
    </div>
  );
}

function WasteRecord({ code, onAct }: { code: string } & Handlers) {
  const w = wasteType(code);
  const h = onHand(code);
  const history = [
    ...GENERATIONS.filter((g) => g.type === code).map((g) => ({ date: g.date, text: `เกิด ${kg(g.kg)}`, sub: g.source, tone: "idle" as Tone })),
    ...DISPOSALS.filter((d) => d.type === code).map((d) => ({ date: d.date, text: `ส่งกำจัด ${kg(d.kg)} · ${d.no}`, sub: `${d.receiver} · ${d.manifest}`, tone: (d.certificate ? "ok" : "warn") as Tone })),
  ].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <div className="flex h-full flex-col">
      <Header
        title={`${w.code} · ${w.name}`}
        meta={`รหัสของเสีย ${w.wasteCode} · ${w.storage} · ${w.method}`}
        badges={<>{w.hazardous && <Badge tone="bad">ของเสียอันตราย</Badge>}<Badge tone="idle">เก็บอยู่ {kg(h.kg)}</Badge>{h.kg > 0 && <Badge tone={h.days > 90 ? "bad" : h.days > 60 ? "warn" : "ok"}>เก็บนานสุด {h.days} วัน</Badge>}</>}
        actions={
          <>
            <Button icon={<Truck size={14} />} onClick={() => onAct({ kind: "waste-dispose", type: code })}>ส่งกำจัด</Button>
            <Button variant="secondary" icon={<Recycle size={14} />} onClick={() => onAct({ kind: "waste-generate" })}>บันทึกของเสีย</Button>
          </>
        }
      />
      <Body>
        <Card title="ประวัติ">
          <Lines>{history.map((x, i) => <Line key={i} title={`${x.date} · ${x.text}`} sub={x.sub} right={<Badge tone={x.tone}>{x.tone === "warn" ? "รอใบรับรอง" : x.tone === "ok" ? "กำจัดแล้ว" : "เข้าบัญชี"}</Badge>} />)}</Lines>
        </Card>
      </Body>
    </div>
  );
}

function MonitoringRecord({ m, onAct }: { m: Monitoring } & Handlers) {
  const car = m.car ? capaByNo(m.car) : undefined;
  return (
    <div className="flex h-full flex-col">
      <Header
        title={`${m.no} · ${m.group}`}
        meta={`${m.date} · ${m.lab}`}
        badges={<>{exceedancesOf(m).length ? <Badge tone="bad">เกินค่ามาตรฐาน {exceedancesOf(m).length} ค่า</Badge> : <Badge tone="ok">ผ่านทุกค่า</Badge>}{car && <Badge tone={tone(car.status)}>{car.no} · {car.status}</Badge>}</>}
        actions={<Button variant="secondary" icon={<Printer size={14} />} onClick={() => onAct({ kind: "print", d: { doc: "monitoring", no: m.no }, title: "รายงานผลการตรวจวัดสิ่งแวดล้อม" })}>พิมพ์รายงาน</Button>}
      />
      <Body>
        <Card title="ผลเทียบค่ามาตรฐาน">
          <Lines>
            {Object.entries(m.values).map(([code, v]) => {
              const p = PARAMETERS.find((x) => x.code === code)!;
              return <Line key={code} title={p.name} sub={`${p.point} · เกณฑ์ ${limitText(p)} · ${p.law}`} right={<span className="flex items-center gap-2"><span className="tabular-nums">{v}{p.unit ? ` ${p.unit}` : ""}</span><Badge tone={exceeds(p, v) ? "bad" : "ok"}>{exceeds(p, v) ? "เกิน" : "ผ่าน"}</Badge></span>} />;
            })}
          </Lines>
        </Card>
      </Body>
    </div>
  );
}

function PlanRecord({ code, onAct }: { code: string } & Handlers) {
  const p = planByCode(code);
  const drills = DRILLS.filter((d) => d.plan === code).sort((a, b) => b.date.localeCompare(a.date));
  return (
    <div className="flex h-full flex-col">
      <Header
        title={`${p.code} · ${p.scenario}`}
        meta={`${p.area} · ซ้อมทุก ${p.everyMonths} เดือน`}
        badges={<Badge dot tone={drillDue(p) < TODAY ? "bad" : "ok"}>{drillDue(p) < TODAY ? `เลยรอบซ้อม ${drillDue(p)}` : `ซ้อมครั้งถัดไป ${drillDue(p)}`}</Badge>}
        actions={
          <>
            <Button icon={<Siren size={14} />} onClick={() => onAct({ kind: "drill-new", plan: code })}>บันทึกการซ้อม</Button>
            <Button variant="secondary" icon={<AlarmSmoke size={14} />} onClick={() => onAct({ kind: "incident-new", plan: code })}>บันทึกอุบัติการณ์</Button>
          </>
        }
      />
      <Body>
        <Card title="ขั้นตอนตอบสนอง"><ol className="list-decimal space-y-1 py-3 pl-9 pr-4 text-[13px] text-slate-700 dark:text-slate-200">{p.response.map((r) => <li key={r}>{r}</li>)}</ol></Card>
        <Card title="อุปกรณ์"><p className="px-4 py-3 text-[13px] text-slate-700 dark:text-slate-200">{p.equipment}</p></Card>
        <Card title="ประวัติการซ้อม">
          {drills.length === 0 ? <Empty>ยังไม่เคยซ้อม</Empty> : (
            <Lines>
              {drills.map((d) => <Line key={d.no} title={`${d.no} · ${d.date} · ${d.participants} คน · ${d.minutes} นาที`} sub={`${d.findings}${d.improvement ? ` · ปรับปรุง: ${d.improvement}` : ""}`} right={<span className="flex items-center gap-2"><Badge tone={d.result === "ผ่าน" ? "ok" : "warn"}>{d.result}</Badge><Button variant="ghost" icon={<Printer size={13} />} onClick={() => onAct({ kind: "print", d: { doc: "drill", no: d.no }, title: "รายงานการฝึกซ้อมแผนฉุกเฉิน" })}>พิมพ์</Button></span>} />)}
            </Lines>
          )}
        </Card>
      </Body>
    </div>
  );
}

function IncidentRecord({ no, onAct }: { no: string } & Handlers) {
  const i = incidentByNo(no);
  const car = carOf(i.no);
  return (
    <div className="flex h-full flex-col">
      <Header
        title={`${i.no} · ${i.description}`}
        meta={`${i.date}${i.plan ? ` · ${i.plan} ${planByCode(i.plan).scenario}` : ""}`}
        badges={<><Badge tone={tone(i.severity)}>{i.severity}</Badge><Badge dot tone={i.status === "ปิดแล้ว" ? "ok" : "warn"}>{i.status}</Badge>{car && <Badge tone={tone(car.status)}>{car.no} · {car.status}</Badge>}</>}
        actions={
          i.status === "เปิด" ? (
            <>
              {!i.reported && <Button variant={i.severity === "รุนแรง" ? "primary" : "secondary"} icon={<ShieldAlert size={14} />} onClick={() => onAct({ kind: "incident-report", no: i.no })}>บันทึกการรายงานหน่วยงานรัฐ</Button>}
              <Button variant="secondary" icon={<CircleCheck size={14} />} onClick={() => onAct({ kind: "incident-close", no: i.no })}>ปิดอุบัติการณ์</Button>
            </>
          ) : null
        }
      />
      <Body>
        <Card title="ผลกระทบ"><p className="px-4 py-3 text-[13px] text-slate-700 dark:text-slate-200">{i.impact}</p></Card>
        <Card title="การควบคุมเหตุ"><p className="px-4 py-3 text-[13px] text-slate-700 dark:text-slate-200">{i.containment}</p></Card>
        {i.reported && <Note tone="info">รายงานแล้ว: {i.reported}</Note>}
        {car && (
          <Card title="การแก้ไขที่สาเหตุ" subtitle="ติดตามต่อที่ระบบบริหารบูรณาการ">
            <Lines><Line title={`${car.no} · ${car.owner}`} sub={car.rootCause?.whys.at(-1) ?? "ยังไม่หาสาเหตุราก"} right={<Badge dot tone={tone(car.status)}>{car.status}</Badge>} /></Lines>
          </Card>
        )}
        {!car && <Note tone="idle">บันทึกไว้ก่อนระบบเปิด CAR ให้อุบัติการณ์อัตโนมัติ</Note>}
      </Body>
    </div>
  );
}
