import { useState } from "react";
import type { ReactNode } from "react";
import {
  Award, BookOpenCheck, CalendarClock, CircleCheck, ClipboardList, Compass, FilePlus2, FileSpreadsheet, FileText,
  GraduationCap, Landmark, ListChecks, Pencil, Play, Plus, Printer, Search as SearchIcon, ShieldAlert, Target, TriangleAlert, Users,
} from "lucide-react";
import {
  AUDITS, CAPAS, CONTEXT, COURSES, DOCUMENTS, DOC_LEVELS, ISSUES, OBJECTIVES, PARTIES, POLICIES, REVIEWS, RISKS, SCOPES,
  STAFF, STANDARDS, SWOT, TODAY, TRAININGS, addDays, auditByNo, awaitingApproval, awareness, capaByNo, carOf, clauseLabel,
  clauseName, completeCapaAction, completeReviewOutput, completeRiskTask, confirmReview, courseName, currentScore,
  eightD, expiringSoon, findingRef, findingsWithoutCar, gapsOf, isQualified, latestOf, levelNo, levelOf, liveAgenda, metNow,
  objectiveById, openCapas, openReviewOutputs, overdueActions, overdueTasks, personOf, qualificationsOf, rating, reviewByNo,
  reviewDue, revLabel, riskByNo, score, startAudit, submitDocument, trainingByNo, trainingNeeds, unmanaged,
} from "./data";
import type { Audit, Capa, ControlledDoc, Objective, Risk, Standard, Training } from "./data";
import { ImsActions } from "./forms";
import type { Act, RecordKind } from "./forms";
import { Body, Empty, Header, Line, Lines, STEP_ICONS, StdBadges, newest, run, tone } from "./parts";
import { Badge, Bar, Button, Card, Chip, ColumnChart, IconRow, Metric, Note, PageHead, Reveal, Search, Segmented, Stepper } from "../ui";
import type { Tone } from "../ui";
import { DataTable, DetailModal, downloadCsv, notify, useData } from "../kit";
import type { Column } from "../kit";

const TABS = ["บริบทองค์กร", "ความเสี่ยงและโอกาส", "นโยบายและวัตถุประสงค์", "ควบคุมเอกสาร", "ความสามารถและการฝึกอบรม", "ตรวจติดตามภายใน", "การแก้ไขและป้องกัน", "ทบทวนโดยฝ่ายบริหาร"];

const exportIcon = <FileSpreadsheet size={14} />;
const csv = (name: string, head: string[], rows: (string | number)[][]) => {
  downloadCsv(name, head, rows);
  notify(`ส่งออก${name} ${rows.length} รายการแล้ว`);
};
const levelTone = (s: number): Tone => (levelOf(s) === "สูง" ? "bad" : levelOf(s) === "กลาง" ? "warn" : "ok");

type Handlers = { onAct: (a: Act) => void; onOpen: (kind: RecordKind, key: string) => void };

/* ----------------------------------------------------------------- screen */

export default function ImsScreen({ section, onOpenSection }: { section?: string; onOpenSection?: (index: number) => void }) {
  useData();
  const tab = section && TABS.includes(section) ? section : undefined;
  const [act, setAct] = useState<Act | null>(null);
  const [record, setRecord] = useState<{ kind: RecordKind; key: string } | null>(null);
  const open = (kind: RecordKind, key: string) => setRecord({ kind, key });

  const keys: Record<RecordKind, string[]> = {
    doc: DOCUMENTS.map((d) => d.code),
    risk: RISKS.map((r) => r.no),
    objective: OBJECTIVES.map((o) => String(o.id)),
    person: STAFF.map((p) => p.name),
    training: newest(TRAININGS).map((t) => t.no),
    audit: AUDITS.map((a) => a.no),
    car: newest(CAPAS).map((c) => c.no),
    review: newest(REVIEWS).map((r) => r.no),
  };
  const list = record ? keys[record.kind] : [];
  const at = record ? list.indexOf(record.key) : -1;
  const TITLES: Record<RecordKind, string> = { doc: "เอกสารควบคุม", risk: "ความเสี่ยงและโอกาส", objective: "วัตถุประสงค์", person: "ความสามารถบุคลากร", training: "การฝึกอบรม", audit: "การตรวจติดตามภายใน", car: "การแก้ไขและป้องกัน", review: "การทบทวนโดยฝ่ายบริหาร" };
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
      <ImsActions act={act} onAct={setAct} onOpen={open} />
    </>
  );

  const planned = REVIEWS.find((r) => r.status === "ตามแผน");
  const index = (
    <div hidden data-fitt-index>
      <button data-fitt-screen="ระบบบริหารบูรณาการ" />
      <button data-fitt-screen="เพิ่มประเด็นภายในและภายนอก" data-fitt-modal onClick={() => setAct({ kind: "issue-new" })} />
      <button data-fitt-screen="เพิ่มผู้มีส่วนได้ส่วนเสีย" data-fitt-modal onClick={() => setAct({ kind: "party-new" })} />
      <button data-fitt-screen="ยืนยันการทบทวนบริบทองค์กร" data-fitt-modal onClick={() => setAct({ kind: "context-confirm" })} />
      <button data-fitt-screen="ความเสี่ยงและโอกาส" data-fitt-modal onClick={() => open("risk", RISKS[0].no)} />
      <button data-fitt-screen="เพิ่มความเสี่ยงหรือโอกาส" data-fitt-modal onClick={() => setAct({ kind: "risk-new" })} />
      <button data-fitt-screen="เพิ่มมาตรการความเสี่ยง" data-fitt-modal onClick={() => setAct({ kind: "risk-task", no: RISKS[0].no })} />
      <button data-fitt-screen="ประเมินความเสี่ยงซ้ำ" data-fitt-modal onClick={() => setAct({ kind: "risk-reassess", no: RISKS[0].no })} />
      <button data-fitt-screen="ทบทวนนโยบาย" data-fitt-modal onClick={() => setAct({ kind: "policy-revise", code: POLICIES[0].code })} />
      <button data-fitt-screen="บันทึกการรับทราบนโยบาย" data-fitt-modal onClick={() => setAct({ kind: "policy-ack", code: POLICIES[0].code })} />
      <button data-fitt-screen="วัตถุประสงค์" data-fitt-modal onClick={() => open("objective", String(OBJECTIVES[0].id))} />
      <button data-fitt-screen="ตั้งวัตถุประสงค์" data-fitt-modal onClick={() => setAct({ kind: "objective-new" })} />
      <button data-fitt-screen="บันทึกผลวัตถุประสงค์" data-fitt-modal onClick={() => setAct({ kind: "objective-result", id: OBJECTIVES[0].id })} />
      <button data-fitt-screen="เอกสารควบคุม" data-fitt-modal onClick={() => open("doc", DOCUMENTS[0].code)} />
      <button data-fitt-screen="สร้างเอกสารควบคุม" data-fitt-modal onClick={() => setAct({ kind: "doc-new" })} />
      <button data-fitt-screen="แก้ไขเอกสาร" data-fitt-modal onClick={() => setAct({ kind: "doc-revise", code: "SP-01" })} />
      <button data-fitt-screen="อนุมัติเอกสาร" data-fitt-modal onClick={() => setAct({ kind: "doc-approve", code: awaitingApproval()[0]?.code ?? "WI-03" })} />
      <button data-fitt-screen="ยกเลิกเอกสาร" data-fitt-modal onClick={() => setAct({ kind: "doc-obsolete", code: "WI-02" })} />
      <button data-fitt-screen="ความสามารถบุคลากร" data-fitt-modal onClick={() => open("person", STAFF[1].name)} />
      <button data-fitt-screen="การฝึกอบรม" data-fitt-modal onClick={() => open("training", TRAININGS[0].no)} />
      <button data-fitt-screen="วางแผนฝึกอบรม" data-fitt-modal onClick={() => setAct({ kind: "training-new" })} />
      <button data-fitt-screen="บันทึกผลอบรม" data-fitt-modal onClick={() => setAct({ kind: "training-record", no: TRAININGS.find((t) => t.status === "ตามแผน")?.no ?? TRAININGS[0].no })} />
      <button data-fitt-screen="ประเมินประสิทธิผลการอบรม" data-fitt-modal onClick={() => setAct({ kind: "training-evaluate", no: TRAININGS.find((t) => t.status === "บันทึกผลแล้ว" && !t.evaluation)?.no ?? TRAININGS[0].no })} />
      <button data-fitt-screen="การตรวจติดตามภายใน" data-fitt-modal onClick={() => open("audit", AUDITS[0].no)} />
      <button data-fitt-screen="วางแผนการตรวจติดตาม" data-fitt-modal onClick={() => setAct({ kind: "audit-new" })} />
      <button data-fitt-screen="บันทึกสิ่งที่พบ" data-fitt-modal onClick={() => setAct({ kind: "audit-finding", no: AUDITS[AUDITS.length - 1].no })} />
      <button data-fitt-screen="ปิดการตรวจ" data-fitt-modal onClick={() => setAct({ kind: "audit-close", no: AUDITS.find((a) => a.status === "กำลังตรวจ")?.no ?? AUDITS[0].no })} />
      <button data-fitt-screen="ใบขอให้แก้ไขและป้องกัน" data-fitt-modal onClick={() => open("car", CAPAS[CAPAS.length - 1].no)} />
      <button data-fitt-screen="ออก CAR" data-fitt-modal onClick={() => setAct({ kind: "car-new" })} />
      <button data-fitt-screen="ออก 8D" data-fitt-modal onClick={() => setAct({ kind: "car-new", method: "8D", std: "IATF 16949" })} />
      <button data-fitt-screen="กักกันชั่วคราว" data-fitt-modal onClick={() => setAct({ kind: "car-containment", no: CAPAS[CAPAS.length - 1].no })} />
      <button data-fitt-screen="หาสาเหตุราก" data-fitt-modal onClick={() => setAct({ kind: "car-cause", no: CAPAS[CAPAS.length - 1].no })} />
      <button data-fitt-screen="เพิ่มมาตรการ" data-fitt-modal onClick={() => setAct({ kind: "car-action", no: CAPAS[CAPAS.length - 1].no })} />
      <button data-fitt-screen="ป้องกันการเกิดซ้ำ" data-fitt-modal onClick={() => setAct({ kind: "car-prevention", no: CAPAS[CAPAS.length - 1].no })} />
      <button data-fitt-screen="ติดตามประสิทธิผล" data-fitt-modal onClick={() => setAct({ kind: "car-verify", no: CAPAS[CAPAS.length - 1].no })} />
      <button data-fitt-screen="การทบทวนโดยฝ่ายบริหาร" data-fitt-modal onClick={() => open("review", REVIEWS[0].no)} />
      <button data-fitt-screen="บันทึกการประชุมทบทวน" data-fitt-modal onClick={() => setAct({ kind: "review-minutes", no: planned?.no ?? REVIEWS[REVIEWS.length - 1].no })} />
      <button data-fitt-screen="นัดประชุมทบทวน" data-fitt-modal onClick={() => setAct({ kind: "review-plan" })} />
      <button data-fitt-screen="พิมพ์บัญชีรายชื่อเอกสารควบคุม" data-fitt-modal onClick={() => setAct({ kind: "print", d: { doc: "master-list" }, title: "บัญชีรายชื่อเอกสารควบคุม" })} />
      <button data-fitt-screen="พิมพ์ทะเบียนความเสี่ยง" data-fitt-modal onClick={() => setAct({ kind: "print", d: { doc: "risks" }, title: "ทะเบียนความเสี่ยงและโอกาส" })} />
      <button data-fitt-screen="พิมพ์ประวัติการฝึกอบรม" data-fitt-modal onClick={() => setAct({ kind: "print", d: { doc: "person", name: STAFF[1].name }, title: "บันทึกประวัติการฝึกอบรมรายบุคคล" })} />
      <button data-fitt-screen="พิมพ์รายงานการตรวจติดตาม" data-fitt-modal onClick={() => setAct({ kind: "print", d: { doc: "audit", no: AUDITS[1].no }, title: "รายงานการตรวจติดตามภายใน" })} />
      <button data-fitt-screen="พิมพ์ CAR" data-fitt-modal onClick={() => setAct({ kind: "print", d: { doc: "car", no: CAPAS[0].no }, title: "ใบขอให้ดำเนินการแก้ไขและป้องกัน" })} />
      <button data-fitt-screen="พิมพ์รายงานการประชุมทบทวน" data-fitt-modal onClick={() => setAct({ kind: "print", d: { doc: "review", no: REVIEWS[0].no }, title: "รายงานการประชุมทบทวนโดยฝ่ายบริหาร" })} />
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
      <PageHead title="ระบบบริหารบูรณาการ" meta={`${tab} · ISO 9001 · ISO 14001 · IATF 16949 · ข้อมูล ณ ${TODAY}`} />
      {tab === "บริบทองค์กร" && <Context {...h} />}
      {tab === "ความเสี่ยงและโอกาส" && <Risks {...h} />}
      {tab === "นโยบายและวัตถุประสงค์" && <Policies {...h} />}
      {tab === "ควบคุมเอกสาร" && <Documents {...h} />}
      {tab === "ความสามารถและการฝึกอบรม" && <Competence {...h} />}
      {tab === "ตรวจติดตามภายใน" && <Audits {...h} />}
      {tab === "การแก้ไขและป้องกัน" && <Corrective {...h} />}
      {tab === "ทบทวนโดยฝ่ายบริหาร" && <Reviews {...h} />}
      {panels}
      {index}
    </div>
  );
}

/* -------------------------------------------------------------- overview */

function Overview({ onOpenSection, onAct, onOpen }: Handlers & { onOpenSection?: (i: number) => void }) {
  const measured = OBJECTIVES.filter((o) => latestOf(o));
  const met = measured.filter((o) => metNow(o)).length;
  const high = RISKS.filter((r) => r.kind === "ความเสี่ยง" && levelOf(currentScore(r)) === "สูง");
  const gaps = STAFF.reduce((n, p) => n + gapsOf(p.name).length, 0);
  const late = openCapas().flatMap((c) => overdueActions(c).map((a) => ({ c, a })));
  const nextAudits = AUDITS.filter((a) => a.status !== "ปิดแล้ว").sort((a, b) => a.planned.localeCompare(b.planned));
  const planned = REVIEWS.find((r) => r.status === "ตามแผน");

  const todo: { icon: ReactNode; text: string; sub: string; go: () => void; tone: Tone }[] = [
    ...unmanaged().map((r) => ({ icon: <ShieldAlert size={15} />, text: `${r.no} ${r.description}`, sub: "ความเสี่ยงสูงที่ไม่มีมาตรการค้าง", go: () => onOpen("risk", r.no), tone: "bad" as Tone })),
    ...late.map(({ c, a }) => ({ icon: <CalendarClock size={15} />, text: `${c.no} ${a.what}`, sub: `${a.owner} · เลยกำหนด ${a.due}`, go: () => onOpen("car", c.no), tone: "bad" as Tone })),
    ...RISKS.flatMap((r) => overdueTasks(r.tasks).map((t) => ({ icon: <CalendarClock size={15} />, text: `${r.no} ${t.what}`, sub: `${t.owner} · เลยกำหนด ${t.due}`, go: () => onOpen("risk", r.no), tone: "bad" as Tone }))),
    ...expiringSoon().map((x) => ({ icon: <GraduationCap size={15} />, text: `${x.name} · ${courseName(x.course)}`, sub: `ใบรับรองหมดอายุ ${x.until}`, go: () => onAct({ kind: "training-new", course: x.course, attendees: [x.name] }), tone: "warn" as Tone })),
    ...awaitingApproval().map((d) => ({ icon: <FileText size={15} />, text: `${d.code} ${d.title}`, sub: `รออนุมัติ ${revLabel(d.draft!.rev)}`, go: () => onOpen("doc", d.code), tone: "info" as Tone })),
    ...TRAININGS.filter((t) => t.status === "ตามแผน" && t.date <= TODAY).map((t) => ({ icon: <BookOpenCheck size={15} />, text: `${t.no} ${courseName(t.course)}`, sub: `อบรมวันที่ ${t.date} แล้ว รอบันทึกผล`, go: () => onAct({ kind: "training-record", no: t.no }), tone: "warn" as Tone })),
  ];

  return (
    <div>
      <PageHead
        title="ระบบบริหารบูรณาการ"
        meta={`ISO 9001 · ISO 14001 · IATF 16949 · ข้อมูล ณ ${TODAY}`}
        right={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" icon={<Users size={14} />} onClick={() => onAct({ kind: "audit-new" })}>วางแผนการตรวจ</Button>
            <Button icon={<ListChecks size={14} />} onClick={() => onAct({ kind: "car-new" })}>ออก CAR</Button>
          </div>
        }
      />
      <Reveal>
        <div className="grid gap-4 md:grid-cols-3">
          {SCOPES.map((s) => (
            <div key={s.std} className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[15px] font-semibold text-slate-900 dark:text-slate-50">{s.std}</p>
                <Badge dot tone={tone(s.status)}>{s.status}</Badge>
              </div>
              <p className="mt-1 line-clamp-2 text-[12.5px] text-slate-500 dark:text-slate-400">{s.text}</p>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-slate-600 dark:text-slate-300">
                {s.certNo && <span>ใบรับรอง {s.certNo}</span>}
                {s.validUntil && <span>ถึง {s.validUntil}</span>}
                <span>ตรวจครั้งถัดไป {s.nextAudit}</span>
              </div>
            </div>
          ))}
        </div>
      </Reveal>

      <Reveal delay={0.05}>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Metric icon={<Target size={17} />} label="วัตถุประสงค์ถึงเป้า" value={`${met} จาก ${measured.length}`} deltaLabel="เทียบผลเดือนล่าสุด" />
          <Metric icon={<ShieldAlert size={17} />} label="ความเสี่ยงระดับสูง" value={`${high.length} เรื่อง`} deltaLabel={unmanaged().length ? `ไม่มีมาตรการค้าง ${unmanaged().length} เรื่อง` : "ทุกเรื่องมีมาตรการค้างอยู่"} />
          <Metric icon={<ListChecks size={17} />} label="CAR เปิดอยู่" value={`${openCapas().length} ใบ`} deltaLabel={late.length ? `มาตรการเลยกำหนด ${late.length} ข้อ` : "ไม่มีมาตรการเลยกำหนด"} />
          <Metric icon={<GraduationCap size={17} />} label="หลักสูตรที่ยังขาด" value={`${gaps} รายการ`} deltaLabel={`ใบรับรองหมดใน 60 วัน ${expiringSoon().length}`} />
        </div>
      </Reveal>

      <Reveal delay={0.1} className="mt-4 grid gap-4 lg:grid-cols-3">
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
        <Card title="ตรวจติดตามที่จะมาถึง" subtitle="ตรวจระบบ กระบวนการ และผลิตภัณฑ์" action={<Button variant="ghost" className="whitespace-nowrap" onClick={() => onOpenSection?.(5)}>แผนทั้งปี</Button>}>
          {nextAudits.length === 0 ? (
            <Empty>ตรวจครบตามแผนแล้ว</Empty>
          ) : (
            <Lines>
              {nextAudits.slice(0, 5).map((a) => (
                <li key={a.no}>
                  <button onClick={() => onOpen("audit", a.no)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[13px] transition hover:bg-slate-50 dark:hover:bg-slate-800/60">
                    <span className="min-w-0 flex-1">
                      <span className="block text-slate-800 dark:text-slate-100">{a.planned} · {a.area}</span>
                      <span className="block text-[11.5px] text-slate-400">{a.type} {a.std} · {a.auditor}</span>
                    </span>
                    <Badge dot tone={tone(a.status)}>{a.status}</Badge>
                  </button>
                </li>
              ))}
            </Lines>
          )}
        </Card>
      </Reveal>

      <Reveal delay={0.15} className="mt-4">
        <Card
          title={planned ? `วาระทบทวนโดยฝ่ายบริหาร ${planned.no} · ${planned.planned}` : "ทบทวนโดยฝ่ายบริหาร"}
          subtitle="ข้อมูลเข้าอ่านสดจากทุกระบบที่ติดตั้ง ค่าเดียวกับที่หน้าจอนั้นใช้ทำงาน"
          action={<Button variant="ghost" className="whitespace-nowrap" onClick={() => onOpenSection?.(7)}>เปิดวาระ</Button>}
        >
          <Agenda />
        </Card>
      </Reveal>
    </div>
  );
}

function Agenda() {
  const agenda = liveAgenda();
  return (
    <div className="grid gap-px bg-slate-100 sm:grid-cols-2 xl:grid-cols-3 dark:bg-slate-800">
      {agenda.map((a) => (
        <div key={a.key} className="bg-white p-4 dark:bg-slate-900">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[13px] font-medium text-slate-800 dark:text-slate-100">{a.title}</p>
            <StdBadges standards={a.std.length === STANDARDS.length ? [] : a.std} />
          </div>
          <ul className="mt-2 space-y-1">
            {a.facts.map((f) => (
              <li key={f.label} className="flex items-center justify-between gap-2 text-[12.5px]">
                <span className="text-slate-500 dark:text-slate-400">{f.label}</span>
                <Badge tone={f.tone}>{f.value}</Badge>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/* --------------------------------------------------------------- context */

function Context({ onAct }: Handlers) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[12.5px] text-slate-500 dark:text-slate-400">ทบทวนล่าสุด {CONTEXT.reviewedOn} โดย {CONTEXT.reviewedBy} (ข้อ 4.1–4.3)</p>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="secondary" icon={exportIcon} onClick={() => csv("บริบทองค์กร", ["ประเภท", "มุมมอง", "ประเด็น", "มาตรฐาน"], ISSUES.map((i) => [i.kind, i.lens ?? "", i.text, i.standards.join(" ")]))}>ส่งออก Excel</Button>
          <Button variant="secondary" icon={<Users size={14} />} onClick={() => onAct({ kind: "party-new" })}>เพิ่มผู้มีส่วนได้ส่วนเสีย</Button>
          <Button variant="secondary" icon={<Plus size={14} />} onClick={() => onAct({ kind: "issue-new" })}>เพิ่มประเด็น</Button>
          <Button icon={<CircleCheck size={14} />} onClick={() => onAct({ kind: "context-confirm" })}>ยืนยันการทบทวน</Button>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {SCOPES.map((s) => (
          <Card key={s.std} title={`ขอบเขต ${s.std}`} subtitle={s.sites}>
            <div className="space-y-2 px-4 py-3 text-[12.5px] text-slate-700 dark:text-slate-200">
              <p>{s.text}</p>
              <p className="text-slate-500">{s.status}{s.certNo ? ` · ${s.certNo} ถึง ${s.validUntil}` : ""} · {s.certifiedBy}</p>
              {s.exclusions.map((e) => <Note key={e.clause} tone="info">ยกเว้น {clauseLabel(e.clause)}: {e.reason}</Note>)}
            </div>
          </Card>
        ))}
      </div>
      <Card title="ประเด็นภายในและภายนอก" subtitle="SWOT — ประเด็นภายนอกบอกมุมมองแบบ PESTEL">
        <div className="grid gap-px bg-slate-100 sm:grid-cols-2 dark:bg-slate-800">
          {SWOT.map((k) => (
            <div key={k} className="bg-white p-4 dark:bg-slate-900">
              <p className="text-[13px] font-semibold text-slate-900 dark:text-slate-50">{k}</p>
              <ul className="mt-2 space-y-2">
                {ISSUES.filter((i) => i.kind === k).map((i) => (
                  <li key={i.id} className="text-[12.5px] text-slate-700 dark:text-slate-200">
                    {i.lens && <Chip>{i.lens}</Chip>} {i.text}
                    <div className="mt-1"><StdBadges standards={i.standards} /></div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Card>
      <Card title="ผู้มีส่วนได้ส่วนเสีย" subtitle="ความต้องการที่เกี่ยวข้อง และวิธีที่เราตอบสนอง (ข้อ 4.2)">
        <Lines>
          {PARTIES.map((p) => <Line key={p.id} title={p.name} sub={`ต้องการ: ${p.needs} · เราทำ: ${p.how}`} right={<StdBadges standards={p.standards} />} />)}
        </Lines>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ risk */

function RiskMatrix({ onOpen }: Pick<Handlers, "onOpen">) {
  const cell = (l: number, i: number) => RISKS.filter((r) => r.kind === "ความเสี่ยง" && (r.residual ?? r).likelihood === l && (r.residual ?? r).impact === i);
  const color: Record<Tone, string> = { bad: "bg-rose-500/80", warn: "bg-amber-400/80", ok: "bg-emerald-500/70", idle: "", info: "", accent: "" };
  return (
    <div className="overflow-x-auto px-4 py-4">
      <div className="inline-grid grid-cols-[auto_repeat(5,3rem)] gap-1 text-[11px]">
        {[5, 4, 3, 2, 1].map((l) => (
          <div key={l} className="contents">
            <span className="pr-2 text-right leading-[3rem] text-slate-400">{l}</span>
            {[1, 2, 3, 4, 5].map((i) => {
              const here = cell(l, i);
              return (
                <button
                  key={i}
                  disabled={here.length === 0}
                  onClick={() => onOpen("risk", here[0].no)}
                  title={here.map((r) => `${r.no} ${r.description}`).join("\n")}
                  className={"grid size-12 place-items-center rounded-md font-semibold text-white " + color[levelTone(l * i)] + (here.length ? " ring-2 ring-slate-900/20 dark:ring-white/30" : " opacity-25")}
                >
                  {here.length || ""}
                </button>
              );
            })}
          </div>
        ))}
        <span />
        {[1, 2, 3, 4, 5].map((i) => <span key={i} className="text-center text-slate-400">{i}</span>)}
      </div>
      <p className="mt-2 text-[11.5px] text-slate-400">แนวตั้ง: โอกาสเกิด · แนวนอน: ผลกระทบ · เฉพาะความเสี่ยง นับค่าคงเหลือหลังมาตรการ</p>
    </div>
  );
}

function Risks({ onAct, onOpen }: Handlers) {
  const [kind, setKind] = useState("ทั้งหมด");
  const rows = RISKS.filter((r) => kind === "ทั้งหมด" || r.kind === kind);
  const columns: Column<Risk>[] = [
    { key: "no", header: "เลขที่", cell: (r) => <span className="whitespace-nowrap font-medium tabular-nums text-slate-800 dark:text-slate-100">{r.no}</span>, sort: (a, b) => a.no.localeCompare(b.no) },
    { key: "kind", header: "ประเภท", cell: (r) => <span className="whitespace-nowrap"><Chip>{r.kind}</Chip></span> },
    { key: "desc", header: "เรื่อง", cell: (r) => <span className="line-clamp-2">{r.description}</span> },
    { key: "std", header: "มาตรฐาน", cell: (r) => <StdBadges standards={r.standards} /> },
    { key: "score", header: "คะแนน", align: "right", cell: (r) => <span className="tabular-nums">{r.residual ? `${score(r)} → ${currentScore(r)}` : score(r)}</span>, sort: (a, b) => currentScore(a) - currentScore(b) },
    { key: "level", header: "ระดับ", cell: (r) => (r.kind === "โอกาส" ? <Badge dot tone="info">โอกาส</Badge> : <Badge dot tone={levelTone(currentScore(r))}>{levelOf(currentScore(r))}</Badge>) },
    { key: "tasks", header: "มาตรการ", cell: (r) => <span className="tabular-nums text-slate-500">{r.tasks.filter((t) => t.doneOn).length}/{r.tasks.length}{overdueTasks(r.tasks).length ? " · เลยกำหนด" : ""}</span> },
    { key: "owner", header: "เจ้าของ", cell: (r) => r.owner },
  ];
  return (
    <div className="space-y-4">
      {unmanaged().length > 0 && <Note tone="bad">ความเสี่ยงระดับสูง {unmanaged().length} เรื่องไม่มีมาตรการค้างอยู่ — เพิ่มมาตรการหรือประเมินซ้ำ</Note>}
      <div className="grid gap-4 lg:grid-cols-[auto_1fr]">
        <Card title="แผนที่ความเสี่ยง" subtitle="กดช่องเพื่อเปิดเรื่องนั้น"><RiskMatrix onOpen={onOpen} /></Card>
        <Card title="สรุปตามระดับ">
          <Lines>
            {(["สูง", "กลาง", "ต่ำ"] as const).map((lv) => {
              const n = RISKS.filter((r) => r.kind === "ความเสี่ยง" && levelOf(currentScore(r)) === lv).length;
              return <Line key={lv} title={`ความเสี่ยงระดับ${lv}`} sub={lv === "สูง" ? "15–25 ต้องมีมาตรการ ยอมรับไม่ได้" : lv === "กลาง" ? "8–14 ติดตามทุกไตรมาส" : "1–7 ยอมรับได้"} right={<Badge tone={tone(lv)}>{n} เรื่อง</Badge>} />;
            })}
            <Line title="โอกาส" sub="เรื่องที่ควรลงมือเพื่อรับประโยชน์" right={<Badge tone="info">{RISKS.filter((r) => r.kind === "โอกาส").length} เรื่อง</Badge>} />
          </Lines>
        </Card>
      </div>
      <DataTable
        rows={rows}
        columns={columns}
        getId={(r) => r.no}
        onOpen={(r) => onOpen("risk", r.no)}
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <Segmented options={["ทั้งหมด", "ความเสี่ยง", "โอกาส"]} value={kind} onChange={setKind} />
            <div className="ml-auto flex gap-2">
              <Button variant="secondary" icon={exportIcon} onClick={() => csv("ทะเบียนความเสี่ยง", ["เลขที่", "ประเภท", "กระบวนการ", "เรื่อง", "โอกาส", "ผลกระทบ", "คะแนน", "คงเหลือ", "การจัดการ", "เจ้าของ"], RISKS.map((r) => [r.no, r.kind, r.process, r.description, r.likelihood, r.impact, score(r), currentScore(r), r.treatment, r.owner]))}>ส่งออก Excel</Button>
              <Button variant="secondary" icon={<Printer size={14} />} onClick={() => onAct({ kind: "print", d: { doc: "risks" }, title: "ทะเบียนความเสี่ยงและโอกาส" })}>พิมพ์ทะเบียน</Button>
              <Button icon={<Plus size={14} />} onClick={() => onAct({ kind: "risk-new" })}>เพิ่มความเสี่ยงหรือโอกาส</Button>
            </div>
          </div>
        }
      />
    </div>
  );
}

/* ---------------------------------------------------- policy, objectives */

function Policies({ onAct, onOpen }: Handlers) {
  const [std, setStd] = useState("ทั้งหมด");
  const rows = OBJECTIVES.filter((o) => std === "ทั้งหมด" || o.std === std);
  const columns: Column<Objective>[] = [
    { key: "std", header: "มาตรฐาน", cell: (o) => <StdBadges standards={[o.std]} /> },
    { key: "dept", header: "ฝ่าย", cell: (o) => o.dept },
    { key: "name", header: "วัตถุประสงค์", cell: (o) => o.name },
    { key: "target", header: "เป้า", align: "right", cell: (o) => <span className="tabular-nums">{o.better === "higher" ? "≥" : "≤"} {o.target} {o.unit}</span> },
    { key: "latest", header: "ล่าสุด", align: "right", cell: (o) => <span className="tabular-nums">{latestOf(o) ? `${latestOf(o)!.value} ${o.unit}` : "—"}</span> },
    { key: "met", header: "ผล", cell: (o) => (metNow(o) === undefined ? <Badge tone="idle">ยังไม่มีผล</Badge> : <Badge tone={metNow(o) ? "ok" : "bad"}>{metNow(o) ? "ถึงเป้า" : "ต่ำกว่าเป้า"}</Badge>) },
    { key: "owner", header: "ผู้รับผิดชอบ", cell: (o) => o.owner },
  ];
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        {POLICIES.map((p) => (
          <Card
            key={p.code}
            title={p.title}
            subtitle={`ฉบับที่ ${p.rev} · อนุมัติ ${p.approvedOn}`}
            action={<Button variant="ghost" icon={<Pencil size={13} />} onClick={() => onAct({ kind: "policy-revise", code: p.code })}>ทบทวน</Button>}
          >
            <div className="space-y-3 px-4 py-3">
              <StdBadges standards={p.standards} />
              <ol className="list-decimal space-y-1 pl-5 text-[12.5px] text-slate-700 dark:text-slate-200">
                {p.text.map((t) => <li key={t}>{t}</li>)}
              </ol>
              <div>
                <div className="flex justify-between text-[12px] text-slate-500"><span>รับทราบแล้ว {p.acknowledged.length} จาก {STAFF.length} คน</span><span className="tabular-nums">{awareness(p)}%</span></div>
                <div className="mt-1"><Bar pct={awareness(p)} tone={awareness(p) === 100 ? "ok" : "warn"} width="w-full" /></div>
              </div>
              <Button variant="secondary" icon={<CircleCheck size={14} />} onClick={() => onAct({ kind: "policy-ack", code: p.code })}>บันทึกการรับทราบ</Button>
            </div>
          </Card>
        ))}
      </div>
      <DataTable
        rows={rows}
        columns={columns}
        getId={(o) => String(o.id)}
        onOpen={(o) => onOpen("objective", String(o.id))}
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <Segmented options={["ทั้งหมด", ...STANDARDS]} value={std} onChange={setStd} />
            <div className="ml-auto flex gap-2">
              <Button variant="secondary" icon={exportIcon} onClick={() => csv("วัตถุประสงค์", ["มาตรฐาน", "ฝ่าย", "วัตถุประสงค์", "เป้า", "หน่วย", "ล่าสุด", "ผู้รับผิดชอบ", "แผนบรรลุ"], OBJECTIVES.map((o) => [o.std, o.dept, o.name, o.target, o.unit, latestOf(o)?.value ?? "", o.owner, o.plan]))}>ส่งออก Excel</Button>
              <Button icon={<Target size={14} />} onClick={() => onAct({ kind: "objective-new" })}>ตั้งวัตถุประสงค์</Button>
            </div>
          </div>
        }
      />
    </div>
  );
}

/* ------------------------------------------------------------- documents */

function Documents({ onAct, onOpen }: Handlers) {
  const [level, setLevel] = useState("ทั้งหมด");
  const [std, setStd] = useState("ทั้งหมด");
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const rows = DOCUMENTS.filter((d) => (level === "ทั้งหมด" || d.level === level) && (std === "ทั้งหมด" || d.standards.includes(std as Standard)) && (!needle || `${d.code} ${d.title}`.toLowerCase().includes(needle)))
    .sort((a, b) => levelNo(a.level) - levelNo(b.level) || a.code.localeCompare(b.code));
  const due = new Set(reviewDue().map((d) => d.code));
  const columns: Column<ControlledDoc>[] = [
    { key: "level", header: "ระดับ", cell: (d) => <span className="tabular-nums text-slate-400">L{levelNo(d.level)}</span> },
    { key: "code", header: "รหัส", cell: (d) => <span className="font-medium tabular-nums text-slate-800 dark:text-slate-100">{d.code}</span>, sort: (a, b) => a.code.localeCompare(b.code) },
    { key: "title", header: "ชื่อเอกสาร", cell: (d) => d.title, sort: (a, b) => a.title.localeCompare(b.title, "th") },
    { key: "std", header: "มาตรฐาน", cell: (d) => <StdBadges standards={d.standards} /> },
    { key: "rev", header: "ฉบับ", cell: (d) => <span className="tabular-nums">{revLabel(d.rev)}</span> },
    { key: "status", header: "สถานะ", cell: (d) => <span className="flex flex-wrap items-center gap-1.5"><Badge dot tone={tone(d.status)}>{d.status}</Badge>{d.draft && d.rev >= 0 && <Badge tone="info">มีฉบับแก้ไข</Badge>}</span> },
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
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Segmented options={["ทั้งหมด", ...DOC_LEVELS]} value={level} onChange={setLevel} />
              <Search value={q} onChange={setQ} placeholder="ค้นหารหัสหรือชื่อเอกสาร" icon={<SearchIcon size={14} />} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Segmented options={["ทั้งหมด", ...STANDARDS]} value={std} onChange={setStd} />
              <div className="ml-auto flex gap-2">
                <Button variant="secondary" icon={exportIcon} onClick={() => csv("เอกสารควบคุม", ["ระดับ", "รหัส", "ชื่อเอกสาร", "มาตรฐาน", "ฉบับ", "สถานะ", "มีผลเมื่อ", "ทบทวนครั้งถัดไป", "ฝ่ายเจ้าของ"], rows.map((d) => [levelNo(d.level), d.code, d.title, d.standards.join(" "), revLabel(d.rev), d.status, d.effective ?? "", d.reviewDue ?? "", d.owner]))}>ส่งออก Excel</Button>
                <Button variant="secondary" icon={<Printer size={14} />} onClick={() => onAct({ kind: "print", d: { doc: "master-list" }, title: "บัญชีรายชื่อเอกสารควบคุม" })}>พิมพ์บัญชีรายชื่อ</Button>
                <Button icon={<FilePlus2 size={14} />} onClick={() => onAct({ kind: "doc-new" })}>สร้างเอกสาร</Button>
              </div>
            </div>
          </div>
        }
      />
    </div>
  );
}

/* ------------------------------------------------------------ competence */

function Competence({ onAct, onOpen }: Handlers) {
  const needs = trainingNeeds();
  const soon = new Set(expiringSoon().map((x) => `${x.name}|${x.course}`));
  const columns: Column<Training>[] = [
    { key: "no", header: "เลขที่", cell: (t) => <span className="font-medium tabular-nums text-slate-800 dark:text-slate-100">{t.no}</span>, sort: (a, b) => a.no.localeCompare(b.no) },
    { key: "course", header: "หลักสูตร", cell: (t) => courseName(t.course) },
    { key: "date", header: "วันที่", cell: (t) => t.date, sort: (a, b) => a.date.localeCompare(b.date) },
    { key: "trainer", header: "วิทยากร", cell: (t) => t.trainer },
    { key: "people", header: "ผ่าน / เข้าอบรม", align: "right", cell: (t) => <span className="tabular-nums">{t.attendees.filter((a) => a.result === "ผ่าน").length} / {t.attendees.length}</span> },
    { key: "status", header: "สถานะ", cell: (t) => <span className="flex gap-1.5"><Badge dot tone={tone(t.status)}>{t.status}</Badge>{t.evaluation && <Badge tone={t.evaluation.effective ? "ok" : "bad"}>ประเมินแล้ว</Badge>}</span> },
  ];
  return (
    <div className="space-y-4">
      <Card title="ตารางความสามารถ" subtitle="✓ ผ่านและยังไม่หมดอายุ · ! หมดอายุใน 60 วัน · ✕ ตำแหน่งต้องมีแต่ยังไม่มี · กดชื่อเพื่อดูประวัติ">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-slate-500">
                <th className="sticky left-0 bg-white px-3 py-2 text-left font-medium dark:bg-slate-900">บุคลากร</th>
                {COURSES.map((c) => <th key={c.code} title={c.name} className="px-1.5 py-2 text-center font-medium tabular-nums">{c.code.replace("TR-", "")}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {STAFF.map((p) => (
                <tr key={p.name}>
                  <td className="sticky left-0 bg-white px-3 py-1.5 dark:bg-slate-900">
                    <button onClick={() => onOpen("person", p.name)} className="text-left hover:underline">
                      <span className="block text-slate-800 dark:text-slate-100">{p.name}</span>
                      <span className="block text-[11px] text-slate-400">{p.role}</span>
                    </button>
                  </td>
                  {COURSES.map((c) => {
                    const has = isQualified(p.name, c.code);
                    const need = p.requires.includes(c.code);
                    const expiring = soon.has(`${p.name}|${c.code}`);
                    const mark = has ? (expiring ? "!" : "✓") : need ? "✕" : "";
                    const cls = has ? (expiring ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300") : need ? "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300" : "";
                    return <td key={c.code} className="px-1 py-1 text-center"><span className={"inline-grid size-6 place-items-center rounded font-semibold " + cls}>{mark}</span></td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="px-4 pb-3 text-[11.5px] text-slate-400">{COURSES.map((c) => `${c.code.replace("TR-", "")} ${c.name}`).join(" · ")}</p>
      </Card>
      <Card title="ความต้องการฝึกอบรม" subtitle="หลักสูตรที่ตำแหน่งต้องมีแต่ยังไม่มีหรือหมดอายุ">
        {needs.length === 0 ? (
          <Empty>ทุกคนมีครบตามตำแหน่ง</Empty>
        ) : (
          <Lines>
            {needs.map((n) => <Line key={n.course} title={courseName(n.course)} sub={n.people.join(", ")} right={<Button variant="secondary" icon={<GraduationCap size={14} />} onClick={() => onAct({ kind: "training-new", course: n.course, attendees: n.people })}>วางแผนอบรม {n.people.length} คน</Button>} />)}
          </Lines>
        )}
      </Card>
      <DataTable
        rows={newest(TRAININGS)}
        columns={columns}
        getId={(t) => t.no}
        onOpen={(t) => onOpen("training", t.no)}
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[12.5px] text-slate-500 dark:text-slate-400">ผลอบรมที่ผ่านคือความสามารถในทะเบียน ใช้ตัดสินสิทธิ์ผู้ตรวจติดตามด้วย (ข้อ 7.2, IATF 7.2.3)</p>
            <div className="ml-auto flex gap-2">
              <Button variant="secondary" icon={exportIcon} onClick={() => csv("ประวัติการฝึกอบรม", ["เลขที่", "หลักสูตร", "วันที่", "ชั่วโมง", "วิทยากร", "ผู้เข้าอบรม", "ผล"], TRAININGS.flatMap((t) => t.attendees.map((a) => [t.no, courseName(t.course), t.date, t.hours, t.trainer, a.name, a.result ?? "รออบรม"])))}>ส่งออก Excel</Button>
              <Button icon={<GraduationCap size={14} />} onClick={() => onAct({ kind: "training-new" })}>วางแผนฝึกอบรม</Button>
            </div>
          </div>
        }
      />
    </div>
  );
}

/* ----------------------------------------------------------------- audit */

function Audits({ onAct, onOpen }: Handlers) {
  const [type, setType] = useState("ทั้งหมด");
  const rows = AUDITS.filter((a) => type === "ทั้งหมด" || a.type === type);
  const count = (a: Audit, t: string) => a.findings.filter((f) => f.type === t).length;
  const columns: Column<Audit>[] = [
    { key: "no", header: "เลขที่", cell: (a) => <span className="font-medium tabular-nums text-slate-800 dark:text-slate-100">{a.no}</span>, sort: (a, b) => a.no.localeCompare(b.no) },
    { key: "type", header: "ชนิด", cell: (a) => <Chip>{a.type}</Chip> },
    { key: "std", header: "มาตรฐาน", cell: (a) => <StdBadges standards={[a.std]} /> },
    { key: "area", header: "ฝ่าย / เรื่อง", cell: (a) => (a.subject ? `${a.area} · ${a.subject}` : a.area) },
    { key: "auditor", header: "ผู้ตรวจ", cell: (a) => a.auditor },
    { key: "planned", header: "วันที่", cell: (a) => a.performedOn ?? a.planned, sort: (a, b) => a.planned.localeCompare(b.planned) },
    { key: "findings", header: "บกพร่อง / สังเกต", align: "right", cell: (a) => <span className="tabular-nums">{count(a, "ข้อบกพร่องหลัก") + count(a, "ข้อบกพร่องย่อย")} / {count(a, "ข้อสังเกต")}</span> },
    { key: "status", header: "สถานะ", cell: (a) => <span className="flex gap-1.5"><Badge dot tone={tone(a.status)}>{a.status}</Badge>{a.score !== undefined && <Badge tone={a.score >= 90 ? "ok" : a.score >= 80 ? "warn" : "bad"}>{a.score}% · {rating(a.score)}</Badge>}</span> },
  ];
  return (
    <DataTable
      rows={rows}
      columns={columns}
      getId={(a) => a.no}
      onOpen={(a) => onOpen("audit", a.no)}
      toolbar={
        <div className="flex flex-wrap items-center gap-2">
          <Segmented options={["ทั้งหมด", "ตรวจระบบ", "ตรวจกระบวนการ", "ตรวจผลิตภัณฑ์"]} value={type} onChange={setType} />
          <p className="text-[12.5px] text-slate-500 dark:text-slate-400">ผู้ตรวจต้องมีหลักสูตรตามชนิดการตรวจ และไม่ตรวจฝ่ายตัวเอง</p>
          <div className="ml-auto flex gap-2">
            <Button variant="secondary" icon={exportIcon} onClick={() => csv("แผนตรวจติดตามภายใน", ["เลขที่", "ชนิด", "มาตรฐาน", "ฝ่าย", "เรื่อง", "ข้อกำหนด", "ผู้ตรวจ", "วันที่ตามแผน", "วันที่ตรวจ", "สถานะ", "คะแนน"], AUDITS.map((a) => [a.no, a.type, a.std, a.area, a.subject ?? "", a.clauses.map(clauseLabel).join(" "), a.auditor, a.planned, a.performedOn ?? "", a.status, a.score ?? ""]))}>ส่งออก Excel</Button>
            <Button icon={<Users size={14} />} onClick={() => onAct({ kind: "audit-new" })}>วางแผนการตรวจ</Button>
          </div>
        </div>
      }
    />
  );
}

/* ------------------------------------------------------------------ capa */

function Corrective({ onAct, onOpen }: Handlers) {
  const [status, setStatus] = useState("ยังไม่ปิด");
  const rows = newest(CAPAS).filter((c) => status === "ทั้งหมด" || (status === "ยังไม่ปิด" ? c.status !== "ปิดแล้ว" : c.status === "ปิดแล้ว"));
  const columns: Column<Capa>[] = [
    { key: "no", header: "เลขที่", cell: (c) => <span className="font-medium tabular-nums text-slate-800 dark:text-slate-100">{c.no}</span>, sort: (a, b) => a.no.localeCompare(b.no) },
    { key: "method", header: "วิธี", cell: (c) => <Chip>{c.method}</Chip> },
    { key: "std", header: "มาตรฐาน", cell: (c) => <StdBadges standards={[c.std]} /> },
    { key: "ref", header: "ต้นเรื่อง", cell: (c) => <span className="tabular-nums text-slate-500">{c.ref}</span> },
    { key: "problem", header: "ปัญหา", cell: (c) => <span className="line-clamp-2">{c.problem}</span> },
    { key: "owner", header: "ผู้รับผิดชอบ", cell: (c) => c.owner },
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
          <Segmented options={["ยังไม่ปิด", "ปิดแล้ว", "ทั้งหมด"]} value={status} onChange={setStatus} counts={{ "ยังไม่ปิด": openCapas().length }} />
          <p className="text-[12.5px] text-slate-500 dark:text-slate-400">ปัญหาจากลูกค้ายานยนต์ใช้ 8D นอกนั้นใช้ 5 Why</p>
          <div className="ml-auto flex gap-2">
            <Button variant="secondary" icon={exportIcon} onClick={() => csv("CAR", ["เลขที่", "วันที่", "วิธี", "มาตรฐาน", "ต้นเรื่อง", "ปัญหา", "ผู้รับผิดชอบ", "สาเหตุราก", "มาตรการเสร็จ", "สถานะ"], CAPAS.map((c) => [c.no, c.date, c.method, c.std, c.ref, c.problem, c.owner, c.rootCause?.whys.at(-1) ?? "", `${c.actions.filter((a) => a.doneOn).length}/${c.actions.length}`, c.status]))}>ส่งออก Excel</Button>
            <Button variant="secondary" icon={<ClipboardList size={14} />} onClick={() => onAct({ kind: "car-new", method: "8D", std: "IATF 16949" })}>ออก 8D</Button>
            <Button icon={<Plus size={14} />} onClick={() => onAct({ kind: "car-new" })}>ออก CAR</Button>
          </div>
        </div>
      }
    />
  );
}

/* ---------------------------------------------------- management review */

function Reviews({ onAct, onOpen }: Handlers) {
  const planned = REVIEWS.find((r) => r.status === "ตามแผน");
  const outputs = openReviewOutputs();
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[12.5px] text-slate-500 dark:text-slate-400">ประธานคือผู้บริหารสูงสุด ข้อมูลเข้าเก็บเป็นภาพ ณ วันประชุม (ข้อ 9.3)</p>
        <div className="ml-auto flex gap-2">
          {planned ? (
            <Button icon={<ClipboardList size={14} />} onClick={() => onAct({ kind: "review-minutes", no: planned.no })}>บันทึกการประชุม {planned.no}</Button>
          ) : (
            <Button icon={<CalendarClock size={14} />} onClick={() => onAct({ kind: "review-plan" })}>นัดประชุมครั้งถัดไป</Button>
          )}
        </div>
      </div>
      <Card title={planned ? `วาระ ${planned.no} · ${planned.planned}` : "วาระครั้งถัดไป"} subtitle="อ่านสดจากทุกระบบที่ติดตั้ง">
        <Agenda />
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="ข้อสั่งการที่ยังไม่เสร็จ" subtitle="จากการประชุมทุกครั้ง">
          {outputs.length === 0 ? (
            <Empty>ไม่มีข้อสั่งการค้าง</Empty>
          ) : (
            <Lines>
              {outputs.map((o) => (
                <Line
                  key={`${o.review}-${o.index}`}
                  title={o.decision}
                  sub={`${o.review} · ${o.kind} · ${o.owner} · กำหนด ${o.due}`}
                  subTone={o.due < TODAY ? "bad" : undefined}
                  right={<Button variant="secondary" icon={<CircleCheck size={14} />} onClick={() => run(() => completeReviewOutput(o.review, o.index), `บันทึกว่าข้อสั่งการเสร็จแล้ว · ${o.review}`)}>เสร็จแล้ว</Button>}
                />
              ))}
            </Lines>
          )}
        </Card>
        <Card title="การประชุมที่ผ่านมา">
          <Lines>
            {newest(REVIEWS).map((r) => (
              <li key={r.no}>
                <button onClick={() => onOpen("review", r.no)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[13px] transition hover:bg-slate-50 dark:hover:bg-slate-800/60">
                  <span className="min-w-0 flex-1">
                    <span className="block text-slate-800 dark:text-slate-100">{r.no} · {r.heldOn ?? r.planned}</span>
                    <span className="block text-[11.5px] text-slate-400">{r.attendees.length ? `ผู้เข้าประชุม ${r.attendees.length} คน · ข้อสั่งการ ${r.outputs.length} ข้อ` : "ยังไม่ประชุม"}</span>
                  </span>
                  <Badge dot tone={tone(r.status)}>{r.status}</Badge>
                </button>
              </li>
            ))}
          </Lines>
        </Card>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- records */

function RecordView({ kind, id, ...h }: { kind: RecordKind; id: string } & Handlers) {
  if (kind === "doc") return <DocRecord d={DOCUMENTS.find((x) => x.code === id)!} {...h} />;
  if (kind === "risk") return <RiskRecord r={riskByNo(id)} {...h} />;
  if (kind === "objective") return <ObjectiveRecord o={objectiveById(Number(id))} {...h} />;
  if (kind === "person") return <PersonRecord name={id} {...h} />;
  if (kind === "training") return <TrainingRecord t={trainingByNo(id)} {...h} />;
  if (kind === "audit") return <AuditRecord a={auditByNo(id)} {...h} />;
  if (kind === "car") return <CarRecord c={capaByNo(id)} {...h} />;
  return <ReviewRecord no={id} {...h} />;
}

function DocRecord({ d, onAct }: { d: ControlledDoc } & Handlers) {
  const due = d.reviewDue && d.reviewDue <= addDays(TODAY, 30);
  return (
    <div className="flex h-full flex-col">
      <Header
        title={`${d.code} · ${d.title}`}
        meta={`ระดับ ${levelNo(d.level)} ${d.level} · ${d.owner}`}
        badges={<><Badge dot tone={tone(d.status)}>{d.status}</Badge><Badge tone="idle">{revLabel(d.rev)}</Badge><StdBadges standards={d.standards} />{d.draft && <Badge tone={d.draft.submitted ? "warn" : "info"}>{revLabel(d.draft.rev)} {d.draft.submitted ? "รออนุมัติ" : "กำลังแก้ไข"}</Badge>}</>}
        actions={
          <>
            {d.draft && !d.draft.submitted && <Button icon={<CircleCheck size={14} />} onClick={() => run(() => submitDocument(d.code), `ส่ง ${d.code} ${revLabel(d.draft!.rev)} ขออนุมัติแล้ว`)}>ส่งอนุมัติ</Button>}
            {d.draft?.submitted && <Button icon={<Award size={14} />} onClick={() => onAct({ kind: "doc-approve", code: d.code })}>อนุมัติ</Button>}
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
            <Empty>ยังไม่เคยออกใช้</Empty>
          ) : (
            <Lines>
              {[...d.history].reverse().map((x) => <Line key={x.rev} title={`${revLabel(x.rev)} · ${x.change}`} sub={`${x.date} · จัดทำ ${x.by} · อนุมัติ ${x.approvedBy}`} />)}
            </Lines>
          )}
        </Card>
      </Body>
    </div>
  );
}

function RiskRecord({ r, onAct }: { r: Risk } & Handlers) {
  const s = currentScore(r);
  return (
    <div className="flex h-full flex-col">
      <Header
        title={`${r.no} · ${r.description}`}
        meta={`${r.kind} · ${r.process} · ${r.owner} · ทบทวนล่าสุด ${r.reviewedOn}`}
        badges={<>{r.kind === "โอกาส" ? <Badge dot tone="info">โอกาส · {s}</Badge> : <Badge dot tone={levelTone(s)}>ระดับ{levelOf(s)} · {s}</Badge>}<Badge tone="idle">{r.treatment}</Badge><StdBadges standards={r.standards} /></>}
        actions={
          <>
            <Button icon={<Plus size={14} />} onClick={() => onAct({ kind: "risk-task", no: r.no })}>เพิ่มมาตรการ</Button>
            <Button variant="secondary" icon={<Compass size={14} />} onClick={() => onAct({ kind: "risk-reassess", no: r.no })}>ประเมินซ้ำ</Button>
            <Button variant="secondary" icon={<Printer size={14} />} onClick={() => onAct({ kind: "print", d: { doc: "risks" }, title: "ทะเบียนความเสี่ยงและโอกาส" })}>พิมพ์ทะเบียน</Button>
          </>
        }
      />
      <Body>
        <div className="grid gap-3 sm:grid-cols-2">
          <Metric label="ก่อนมาตรการ" value={`${score(r)} (${r.likelihood}×${r.impact})`} deltaLabel={`ระดับ${levelOf(score(r))}`} />
          <Metric label="คงเหลือ" value={r.residual ? `${currentScore(r)} (${r.residual.likelihood}×${r.residual.impact})` : "ยังไม่ประเมินซ้ำ"} deltaLabel={r.residual ? `ประเมินซ้ำ ${r.residual.date}` : "ทำมาตรการให้ครบแล้วประเมินซ้ำ"} />
        </div>
        <Card title="มาตรการ">
          {r.tasks.length === 0 ? (
            <Empty>ยังไม่มีมาตรการ</Empty>
          ) : (
            <Lines>
              {r.tasks.map((t, i) => {
                const late = !t.doneOn && t.due < TODAY;
                return (
                  <Line
                    key={i}
                    title={t.what}
                    sub={`${t.owner} · กำหนด ${t.due}${late ? " · เลยกำหนด" : ""}`}
                    subTone={late ? "bad" : undefined}
                    right={t.doneOn ? <Badge tone="ok">เสร็จ {t.doneOn}</Badge> : <Button variant="secondary" icon={<CircleCheck size={14} />} onClick={() => run(() => completeRiskTask(r.no, i), `บันทึกว่ามาตรการเสร็จแล้ว · ${r.no}`)}>ทำเสร็จแล้ว</Button>}
                  />
                );
              })}
            </Lines>
          )}
        </Card>
      </Body>
    </div>
  );
}

function ObjectiveRecord({ o, onAct }: { o: Objective } & Handlers) {
  const m = metNow(o);
  return (
    <div className="flex h-full flex-col">
      <Header
        title={o.name}
        meta={`${o.dept} · ${o.owner} · เป้า ${o.better === "higher" ? "≥" : "≤"} ${o.target} ${o.unit}`}
        badges={<><StdBadges standards={[o.std]} />{m === undefined ? <Badge tone="idle">ยังไม่มีผล</Badge> : <Badge tone={m ? "ok" : "bad"}>{m ? "ถึงเป้า" : "ต่ำกว่าเป้า"}</Badge>}</>}
        actions={<Button icon={<Plus size={14} />} onClick={() => onAct({ kind: "objective-result", id: o.id })}>บันทึกผลรายเดือน</Button>}
      />
      <Body>
        <Card title="แผนบรรลุ" subtitle="ข้อ 6.2.2"><p className="px-4 py-3 text-[13px] text-slate-700 dark:text-slate-200">{o.plan}</p></Card>
        <Card title="ผลรายเดือน">
          {o.results.length === 0 ? (
            <Empty>ยังไม่มีผล</Empty>
          ) : (
            <ColumnChart
              data={o.results.map((r) => ({ label: r.month.slice(5), value: r.value, tone: (o.better === "higher" ? r.value >= o.target : r.value <= o.target) ? undefined : "warn" }))}
              format={(n) => `${n} ${o.unit}`}
            />
          )}
        </Card>
      </Body>
    </div>
  );
}

function PersonRecord({ name, onAct }: { name: string } & Handlers) {
  const p = personOf(name)!;
  const quals = qualificationsOf(name);
  const gaps = gapsOf(name);
  const attended = TRAININGS.filter((t) => t.attendees.some((a) => a.name === name));
  return (
    <div className="flex h-full flex-col">
      <Header
        title={p.name}
        meta={`${p.role} · ${p.dept}`}
        badges={<><Badge tone={gaps.length ? "bad" : "ok"}>{gaps.length ? `ขาด ${gaps.length} หลักสูตร` : "ครบตามตำแหน่ง"}</Badge><Badge tone="idle">มี {quals.length} หลักสูตร</Badge></>}
        actions={
          <>
            {gaps.length > 0 && <Button icon={<GraduationCap size={14} />} onClick={() => onAct({ kind: "training-new", course: gaps[0], attendees: [name] })}>วางแผนอบรมที่ขาด</Button>}
            <Button variant="secondary" icon={<Printer size={14} />} onClick={() => onAct({ kind: "print", d: { doc: "person", name }, title: "บันทึกประวัติการฝึกอบรมรายบุคคล" })}>พิมพ์ประวัติ</Button>
          </>
        }
      />
      <Body>
        <Card title="หลักสูตรที่ตำแหน่งต้องมี">
          <Lines>
            {p.requires.map((c) => {
              const q = quals.find((x) => x.course === c);
              return <Line key={c} title={courseName(c)} sub={q ? `ผ่านเมื่อ ${q.since}${q.until ? ` · ใช้ได้ถึง ${q.until}` : ""}` : "ยังไม่มีหรือหมดอายุ"} subTone={q ? undefined : "bad"} right={<Badge tone={q ? "ok" : "bad"}>{q ? "มีแล้ว" : "ขาด"}</Badge>} />;
            })}
          </Lines>
        </Card>
        <Card title="ประวัติการอบรม">
          {attended.length === 0 ? <Empty>ยังไม่เคยอบรม</Empty> : (
            <Lines>
              {attended.map((t) => <Line key={t.no} title={`${t.no} · ${courseName(t.course)}`} sub={`${t.date} · ${t.hours} ชม. · ${t.trainer}`} right={<Badge tone={tone(t.attendees.find((a) => a.name === name)?.result ?? "ตามแผน")}>{t.attendees.find((a) => a.name === name)?.result ?? "ตามแผน"}</Badge>} />)}
            </Lines>
          )}
        </Card>
      </Body>
    </div>
  );
}

function TrainingRecord({ t, onAct, onOpen }: { t: Training } & Handlers) {
  return (
    <div className="flex h-full flex-col">
      <Header
        title={`${t.no} · ${courseName(t.course)}`}
        meta={`${t.date} · ${t.hours} ชั่วโมง · ${t.trainer}`}
        badges={<><Badge dot tone={tone(t.status)}>{t.status}</Badge>{t.evaluation && <Badge tone={t.evaluation.effective ? "ok" : "bad"}>{t.evaluation.effective ? "ได้ผล" : "ไม่ได้ผล"}</Badge>}</>}
        actions={
          <>
            {t.status === "ตามแผน" && <Button icon={<BookOpenCheck size={14} />} onClick={() => onAct({ kind: "training-record", no: t.no })}>บันทึกผลอบรม</Button>}
            {t.status === "บันทึกผลแล้ว" && !t.evaluation && <Button icon={<Award size={14} />} onClick={() => onAct({ kind: "training-evaluate", no: t.no })}>ประเมินประสิทธิผล</Button>}
          </>
        }
      />
      <Body>
        <Card title="ผู้เข้าอบรม">
          <Lines>
            {t.attendees.map((a) => (
              <li key={a.name}>
                <button onClick={() => onOpen("person", a.name)} className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-[13px] hover:bg-slate-50 dark:hover:bg-slate-800/60">
                  <span className="text-slate-800 dark:text-slate-100">{a.name}</span>
                  <Badge tone={tone(a.result ?? "ตามแผน")}>{a.result ?? "รออบรม"}</Badge>
                </button>
              </li>
            ))}
          </Lines>
        </Card>
        {t.evaluation && <Note tone={t.evaluation.effective ? "ok" : "bad"}>ประเมินประสิทธิผล {t.evaluation.date} โดย {t.evaluation.by}: {t.evaluation.note}</Note>}
      </Body>
    </div>
  );
}

function AuditRecord({ a, onAct }: { a: Audit } & Handlers) {
  const missing = findingsWithoutCar(a);
  return (
    <div className="flex h-full flex-col">
      <Header
        title={`${a.no} · ${a.area}${a.subject ? ` · ${a.subject}` : ""}`}
        meta={`${a.type} ${a.std} · ผู้ตรวจ ${a.auditor} · ${a.performedOn ? `ตรวจเมื่อ ${a.performedOn}` : `ตามแผน ${a.planned}`}`}
        badges={<><Badge dot tone={tone(a.status)}>{a.status}</Badge>{a.score !== undefined && <Badge tone={a.score >= 90 ? "ok" : a.score >= 80 ? "warn" : "bad"}>VDA 6.3 {a.score}% · {rating(a.score)}</Badge>}</>}
        actions={
          <>
            {a.status === "ตามแผน" && <Button icon={<Play size={14} />} onClick={() => run(() => startAudit(a.no), `เริ่มตรวจ ${a.no} ${a.area} แล้ว`)}>เริ่มตรวจ</Button>}
            {a.status === "กำลังตรวจ" && <Button icon={<Plus size={14} />} onClick={() => onAct({ kind: "audit-finding", no: a.no })}>บันทึกสิ่งที่พบ</Button>}
            {a.status === "กำลังตรวจ" && <Button variant="secondary" icon={<CircleCheck size={14} />} onClick={() => onAct({ kind: "audit-close", no: a.no })}>ปิดการตรวจ</Button>}
            <Button variant="secondary" icon={<Printer size={14} />} onClick={() => onAct({ kind: "print", d: { doc: "audit", no: a.no }, title: "รายงานการตรวจติดตามภายใน" })}>พิมพ์รายงาน</Button>
          </>
        }
      />
      <Body>
        {a.status === "กำลังตรวจ" && missing.length > 0 && <Note tone="warn">ข้อบกพร่อง {missing.length} ข้อยังไม่มี CAR — ต้องออกก่อนปิดการตรวจ</Note>}
        <Card title="ขอบเขต">
          <Lines>{a.clauses.map((c) => <Line key={c} title={`${clauseLabel(c)} ${clauseName(c)}`} />)}</Lines>
        </Card>
        <Card title="สิ่งที่พบ" subtitle="ข้อบกพร่องต้องมี CAR · ข้อสังเกตไม่ต้อง">
          {a.findings.length === 0 ? (
            <Empty>{a.status === "ตามแผน" ? "ยังไม่ได้ตรวจ" : "ยังไม่พบสิ่งที่ต้องบันทึก"}</Empty>
          ) : (
            <Lines>
              {a.findings.map((f) => {
                const car = carOf(findingRef(a, f));
                return (
                  <Line
                    key={f.id}
                    title={`#${f.id} ${f.detail}`}
                    sub={`${clauseLabel(f.clause)} ${clauseName(f.clause)}`}
                    right={
                      <span className="flex items-center gap-2">
                        <Badge tone={f.type === "ข้อสังเกต" ? "info" : f.type === "ข้อบกพร่องหลัก" ? "bad" : "warn"}>{f.type}</Badge>
                        {car ? <Badge tone="ok">{car.no}</Badge> : f.type !== "ข้อสังเกต" && <Button variant="secondary" onClick={() => onAct({ kind: "car-new", ref: findingRef(a, f), problem: f.detail, std: a.std })}>ออก CAR</Button>}
                      </span>
                    }
                  />
                );
              })}
            </Lines>
          )}
        </Card>
      </Body>
    </div>
  );
}

function CarRecord({ c, onAct }: { c: Capa } & Handlers) {
  const open = c.status !== "ปิดแล้ว" && c.status !== "ติดตามผล";
  const is8D = c.method === "8D";
  const steps = eightD(c);
  return (
    <div className="flex h-full flex-col">
      <Header
        title={`${c.no} · ${c.method}`}
        meta={`ต้นเรื่อง ${c.ref} · ออกเมื่อ ${c.date} · ${c.owner}`}
        badges={<><Badge dot tone={tone(c.status)}>{c.status}</Badge><StdBadges standards={[c.std]} />{overdueActions(c).length > 0 && <Badge tone="bad">มาตรการเลยกำหนด {overdueActions(c).length}</Badge>}</>}
        actions={
          <>
            {is8D && c.status !== "ปิดแล้ว" && <Button variant={c.containment ? "secondary" : "primary"} icon={<ShieldAlert size={14} />} onClick={() => onAct({ kind: "car-containment", no: c.no })}>กักกันชั่วคราว (D3)</Button>}
            {open && <Button variant={c.rootCause ? "secondary" : "primary"} icon={<SearchIcon size={14} />} onClick={() => onAct({ kind: "car-cause", no: c.no })}>{c.rootCause ? "แก้สาเหตุราก" : "หาสาเหตุราก"}</Button>}
            {open && <Button variant="secondary" icon={<Plus size={14} />} onClick={() => onAct({ kind: "car-action", no: c.no })}>เพิ่มมาตรการ</Button>}
            {is8D && c.status !== "ปิดแล้ว" && <Button variant="secondary" icon={<Landmark size={14} />} onClick={() => onAct({ kind: "car-prevention", no: c.no })}>ป้องกันการเกิดซ้ำ (D7)</Button>}
            {c.status === "ติดตามผล" && <Button icon={<Award size={14} />} onClick={() => onAct({ kind: "car-verify", no: c.no })}>ติดตามประสิทธิผล</Button>}
            <Button variant="secondary" icon={<Printer size={14} />} onClick={() => onAct({ kind: "print", d: { doc: "car", no: c.no }, title: is8D ? "รายงานการแก้ปัญหา 8D" : "ใบขอให้ดำเนินการแก้ไขและป้องกัน" })}>พิมพ์</Button>
          </>
        }
      />
      <Body>
        {is8D && <Stepper steps={steps.map((s, i) => ({ label: `${s.step} ${s.name}`, state: s.done ? "done" : i === steps.findIndex((x) => !x.done) ? "current" : "todo" }))} icons={STEP_ICONS} />}
        {is8D && <Card title="ทีม (D1)"><p className="px-4 py-3 text-[13px] text-slate-700 dark:text-slate-200">{c.team.join(" · ")}</p></Card>}
        <Card title="ปัญหา"><p className="px-4 py-3 text-[13px] text-slate-700 dark:text-slate-200">{c.problem}</p></Card>
        {is8D && <Card title="การกักกันชั่วคราว (D3)">{c.containment ? <p className="px-4 py-3 text-[13px] text-slate-700 dark:text-slate-200">{c.containment}</p> : <Empty>ยังไม่กักกัน</Empty>}</Card>}
        <Card title="สาเหตุราก" subtitle={c.rootCause ? `กลุ่ม${c.rootCause.category} · ถามทำไม ${c.rootCause.whys.length} ชั้น` : "ยังไม่วิเคราะห์"}>
          {c.rootCause && (
            <div className="space-y-2 px-4 py-3 text-[13px] text-slate-700 dark:text-slate-200">
              <ol className="space-y-1.5">
                {c.rootCause.whys.map((w, i) => (
                  <li key={i} className="flex gap-2"><span className="w-16 shrink-0 text-slate-400">ทำไม {i + 1}</span><span className={i === c.rootCause!.whys.length - 1 ? "font-medium text-slate-900 dark:text-slate-50" : ""}>{w}</span></li>
                ))}
              </ol>
              {c.rootCause.escape && <p><span className="text-slate-400">ทำไมจึงหลุดถึงลูกค้า:</span> {c.rootCause.escape}</p>}
            </div>
          )}
        </Card>
        <Card title="มาตรการ" subtitle="ทำเสร็จครบแล้วจึงติดตามผลได้">
          {c.actions.length === 0 ? (
            <Empty>ยังไม่มีมาตรการ</Empty>
          ) : (
            <Lines>
              {c.actions.map((a, i) => {
                const late = !a.doneOn && a.due < TODAY;
                return (
                  <Line
                    key={i}
                    title={a.what}
                    sub={`${a.type} · ${a.owner} · กำหนด ${a.due}${late ? " · เลยกำหนด" : ""}`}
                    subTone={late ? "bad" : undefined}
                    right={a.doneOn ? <Badge tone="ok">เสร็จ {a.doneOn}</Badge> : c.status !== "ปิดแล้ว" && <Button variant="secondary" icon={<CircleCheck size={14} />} onClick={() => run(() => completeCapaAction(c.no, i), `บันทึกว่ามาตรการเสร็จแล้ว · ${c.no}`)}>ทำเสร็จแล้ว</Button>}
                  />
                );
              })}
            </Lines>
          )}
        </Card>
        {is8D && <Card title="ป้องกันการเกิดซ้ำ (D7)">{c.prevention ? <p className="px-4 py-3 text-[13px] text-slate-700 dark:text-slate-200">{c.prevention}</p> : <Empty>ยังไม่บันทึก</Empty>}</Card>}
        {c.verification && <Note tone={c.verification.effective ? "ok" : "bad"}>ติดตามผล {c.verification.date} โดย {c.verification.by}: {c.verification.effective ? "ได้ผล" : "ไม่ได้ผล"} — {c.verification.note}</Note>}
      </Body>
    </div>
  );
}

function ReviewRecord({ no, onAct }: { no: string } & Handlers) {
  const r = reviewByNo(no);
  return (
    <div className="flex h-full flex-col">
      <Header
        title={`${r.no} · การทบทวนโดยฝ่ายบริหาร`}
        meta={`${r.heldOn ? `ประชุมเมื่อ ${r.heldOn}` : `ตามแผน ${r.planned}`} · ประธาน ${r.chair}`}
        badges={<Badge dot tone={tone(r.status)}>{r.status}</Badge>}
        actions={
          <>
            {r.status === "ตามแผน" && <Button icon={<ClipboardList size={14} />} onClick={() => onAct({ kind: "review-minutes", no: r.no })}>บันทึกการประชุม</Button>}
            {r.status === "ประชุมแล้ว" && <Button variant="secondary" icon={<Printer size={14} />} onClick={() => onAct({ kind: "print", d: { doc: "review", no: r.no }, title: "รายงานการประชุมทบทวนโดยฝ่ายบริหาร" })}>พิมพ์รายงานการประชุม</Button>}
          </>
        }
      />
      <Body>
        {r.status === "ตามแผน" ? (
          <Card title="ข้อมูลเข้าที่จะนำเข้าที่ประชุม" subtitle="อ่านสดจากทุกระบบ บันทึกการประชุมแล้วจะเก็บเป็นภาพ ณ วันนั้น"><Agenda /></Card>
        ) : (
          <>
            <Card title="ผู้เข้าประชุม"><p className="px-4 py-3 text-[13px] text-slate-700 dark:text-slate-200">{r.attendees.join(" · ")}</p></Card>
            <Card title="ข้อมูลเข้า ณ วันประชุม">
              <Lines>{r.inputs.map((i) => <Line key={i.title} title={i.title} sub={i.facts.map((f) => `${f.label}: ${f.value}`).join(" · ")} />)}</Lines>
            </Card>
            <Card title="ข้อสั่งการ">
              <Lines>
                {r.outputs.map((o, i) => (
                  <Line
                    key={i}
                    title={o.decision}
                    sub={`${o.kind} · ${o.owner} · กำหนด ${o.due}`}
                    right={o.doneOn ? <Badge tone="ok">เสร็จ {o.doneOn}</Badge> : <Button variant="secondary" icon={<CircleCheck size={14} />} onClick={() => run(() => completeReviewOutput(r.no, i), `บันทึกว่าข้อสั่งการเสร็จแล้ว · ${r.no}`)}>เสร็จแล้ว</Button>}
                  />
                ))}
              </Lines>
            </Card>
          </>
        )}
      </Body>
    </div>
  );
}
