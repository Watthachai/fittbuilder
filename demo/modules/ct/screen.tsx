import { useState } from "react";
import type { ReactNode } from "react";
import {
  Activity, CalendarClock, CircleCheck, ClipboardCheck, FileCheck2, FileSpreadsheet, Gauge as GaugeIcon, ListTree, Plus, Printer,
  RotateCcw, Rocket, Ruler, Send, ShieldCheck, Upload,
} from "lucide-react";
import { TODAY } from "../ims/data";
import { Body, Empty, Header, Line, Lines, STEP_ICONS, run } from "../ims/parts";
import {
  AUTO_ELEMENTS, CHARTS, CONTROL_PLANS, FMEAS, MIN_SUBGROUPS, PARTS, PHASES, PPAP_ELEMENTS, PROJECTS, STUDIES, SUBMISSIONS, apOf,
  capabilityTarget, capable, chartByCode, completeDeliverable, currentPhase, customerName, elementStatus, enoughData, fmeaByNo,
  grr, isDone, lateDeliverables, latestStudies, materialName, missingSpecials, msaAcceptable, openHigh, partOf, pendingElements,
  planByNo, planOfPhase, projectByNo, promoteToProduction, rated, releasedForProduction, stats, studyByNo, submissionByNo,
  submitPpap, weakCc,
} from "./data";
import type { ApqpProject, ControlPlan, Fmea, MsaStudy, SpcChart, Submission } from "./data";
import { CtActions } from "./forms";
import type { Act, RecordKind } from "./forms";
import { Badge, Button, Card, Chip, Metric, Note, PageHead, Reveal, Stepper } from "../ui";
import type { Tone } from "../ui";
import { DataTable, DetailModal, downloadCsv, notify, useData } from "../kit";
import type { Column } from "../kit";

const TABS = ["วางแผนคุณภาพผลิตภัณฑ์ (APQP)", "อนุมัติชิ้นส่วนการผลิต (PPAP)", "วิเคราะห์ความล้มเหลว (FMEA)", "แผนควบคุม", "ควบคุมกระบวนการเชิงสถิติ (SPC)", "วิเคราะห์ระบบการวัด (MSA)"];

const exportIcon = <FileSpreadsheet size={14} />;
const csv = (name: string, head: string[], rows: (string | number)[][]) => {
  downloadCsv(name, head, rows);
  notify(`ส่งออก${name} ${rows.length} รายการแล้ว`);
};
const apTone = (ap: string): Tone => (ap === "สูง" ? "bad" : ap === "กลาง" ? "warn" : "ok");
const grrTone = (v: string): Tone => (v === "ยอมรับได้" ? "ok" : v === "ยอมรับไม่ได้" ? "bad" : "warn");
const f2 = (n: number) => (Number.isFinite(n) ? n.toFixed(2) : "—");
const phaseSteps = (p: ApqpProject) =>
  PHASES.map((ph, i) => ({ label: `${i + 1} ${ph}`, state: (p.gates.some((g) => g.phase === i) ? "done" : i === currentPhase(p) ? "current" : "todo") as "done" | "current" | "todo" }));

type Handlers = { onAct: (a: Act) => void; onOpen: (kind: RecordKind, key: string) => void };

export default function CtScreen({ section, onOpenSection }: { section?: string; onOpenSection?: (index: number) => void }) {
  useData();
  const tab = section && TABS.includes(section) ? section : undefined;
  const [act, setAct] = useState<Act | null>(null);
  const [record, setRecord] = useState<{ kind: RecordKind; key: string } | null>(null);
  const open = (kind: RecordKind, key: string) => setRecord({ kind, key });

  const keys: Record<RecordKind, string[]> = {
    apqp: PROJECTS.map((p) => p.no),
    ppap: SUBMISSIONS.map((s) => s.no),
    fmea: FMEAS.map((f) => f.no),
    plan: CONTROL_PLANS.map((c) => c.no),
    spc: CHARTS.map((c) => c.code),
    msa: STUDIES.map((s) => s.no),
  };
  const list = record ? keys[record.kind] : [];
  const at = record ? list.indexOf(record.key) : -1;
  const TITLES: Record<RecordKind, string> = { apqp: "โครงการ APQP", ppap: "PPAP", fmea: "FMEA", plan: "แผนควบคุม", spc: "แผนภูมิควบคุม", msa: "การศึกษา Gage R&R" };
  const h: Handlers = { onAct: setAct, onOpen: open };
  const project = PROJECTS[0];
  const sub = SUBMISSIONS[SUBMISSIONS.length - 1];

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
      <CtActions act={act} onAct={setAct} onOpen={open} />
    </>
  );

  const index = (
    <div hidden data-fitt-index>
      <button data-fitt-screen="เครื่องมือหลักยานยนต์" />
      <button data-fitt-screen="โครงการ APQP" data-fitt-modal onClick={() => open("apqp", project.no)} />
      <button data-fitt-screen="ประตูผ่านเฟส APQP" data-fitt-modal onClick={() => setAct({ kind: "apqp-gate", no: project.no })} />
      <button data-fitt-screen="PPAP" data-fitt-modal onClick={() => open("ppap", sub.no)} />
      <button data-fitt-screen="แก้สถานะองค์ประกอบ PPAP" data-fitt-modal onClick={() => setAct({ kind: "ppap-element", no: sub.no, element: "ผลการวัดขนาด" })} />
      <button data-fitt-screen="บันทึกผล PPAP จากลูกค้า" data-fitt-modal onClick={() => setAct({ kind: "ppap-decision", no: sub.no })} />
      <button data-fitt-screen="FMEA" data-fitt-modal onClick={() => open("fmea", FMEAS[0].no)} />
      <button data-fitt-screen="เพิ่มแถวใน FMEA" data-fitt-modal onClick={() => setAct({ kind: "fmea-row", no: FMEAS[0].no })} />
      <button data-fitt-screen="เพิ่มมาตรการ FMEA" data-fitt-modal onClick={() => setAct({ kind: "fmea-action", no: FMEAS[0].no, id: 2 })} />
      <button data-fitt-screen="แผนควบคุม" data-fitt-modal onClick={() => open("plan", CONTROL_PLANS[CONTROL_PLANS.length - 1].no)} />
      <button data-fitt-screen="เพิ่มแถวในแผนควบคุม" data-fitt-modal onClick={() => setAct({ kind: "cp-row", no: CONTROL_PLANS[CONTROL_PLANS.length - 1].no })} />
      <button data-fitt-screen="อนุมัติแผนควบคุม" data-fitt-modal onClick={() => setAct({ kind: "cp-approve", no: CONTROL_PLANS[CONTROL_PLANS.length - 1].no })} />
      <button data-fitt-screen="แผนภูมิควบคุม" data-fitt-modal onClick={() => open("spc", CHARTS[0].code)} />
      <button data-fitt-screen="เพิ่มกลุ่มย่อย" data-fitt-modal onClick={() => setAct({ kind: "spc-add", code: CHARTS[0].code })} />
      <button data-fitt-screen="นำเข้าหลายกลุ่มย่อย" data-fitt-modal onClick={() => setAct({ kind: "spc-import", code: CHARTS[1].code })} />
      <button data-fitt-screen="เริ่มการศึกษาใหม่" data-fitt-modal onClick={() => setAct({ kind: "spc-restart", code: CHARTS[1].code })} />
      <button data-fitt-screen="การศึกษา Gage R&R" data-fitt-modal onClick={() => open("msa", STUDIES[0].no)} />
      <button data-fitt-screen="บันทึกการศึกษา Gage R&R" data-fitt-modal onClick={() => setAct({ kind: "msa-new" })} />
      <button data-fitt-screen="พิมพ์ PSW" data-fitt-modal onClick={() => setAct({ kind: "print", d: { doc: "psw", no: sub.no }, title: "ใบรับรองการส่งชิ้นส่วน (PSW)" })} />
      <button data-fitt-screen="พิมพ์ FMEA" data-fitt-modal onClick={() => setAct({ kind: "print", d: { doc: "fmea", no: FMEAS[0].no }, title: "FMEA" })} />
      <button data-fitt-screen="พิมพ์แผนควบคุม" data-fitt-modal onClick={() => setAct({ kind: "print", d: { doc: "control-plan", no: CONTROL_PLANS[CONTROL_PLANS.length - 1].no }, title: "แผนควบคุม" })} />
      <button data-fitt-screen="พิมพ์รายงานความสามารถกระบวนการ" data-fitt-modal onClick={() => setAct({ kind: "print", d: { doc: "spc", code: CHARTS[0].code }, title: "รายงานความสามารถของกระบวนการ" })} />
      <button data-fitt-screen="พิมพ์รายงาน Gage R&R" data-fitt-modal onClick={() => setAct({ kind: "print", d: { doc: "msa", no: STUDIES[0].no }, title: "รายงานการวิเคราะห์ระบบการวัด" })} />
      <button data-fitt-screen="พิมพ์รายงานสถานะ APQP" data-fitt-modal onClick={() => setAct({ kind: "print", d: { doc: "apqp", no: project.no }, title: "รายงานสถานะ APQP" })} />
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
      <PageHead title="เครื่องมือหลักยานยนต์" meta={`${tab} · IATF 16949 · AIAG-VDA · ข้อมูล ณ ${TODAY}`} />
      {tab === TABS[0] && <Apqp {...h} />}
      {tab === TABS[1] && <Ppap {...h} />}
      {tab === TABS[2] && <Fmeas {...h} />}
      {tab === TABS[3] && <Plans {...h} />}
      {tab === TABS[4] && <Spc {...h} />}
      {tab === TABS[5] && <Msa {...h} />}
      {panels}
      {index}
    </div>
  );
}

/* -------------------------------------------------------------- overview */

function Overview({ onOpenSection, onAct, onOpen }: Handlers & { onOpenSection?: (i: number) => void }) {
  const p = PROJECTS[0];
  const part = partOf(p.part);
  const s = SUBMISSIONS.find((x) => x.part === p.part)!;
  const days = Math.round((Date.parse(part.sop) - Date.parse(TODAY)) / 86_400_000);
  const highs = FMEAS.reduce((n, f) => n + openHigh(f).length, 0);
  const weak = CHARTS.filter((c) => !capable(c));

  const todo: { icon: ReactNode; text: string; sub: string; go: () => void; tone: Tone }[] = [
    ...lateDeliverables(p).map((d) => ({ icon: <CalendarClock size={15} />, text: d.item, sub: `${d.owner} · กำหนด ${d.due}${d.auto ? " · ระบบตัดสินจากข้อมูล" : ""}`, go: () => onOpen("apqp", p.no), tone: "bad" as Tone })),
    ...pendingElements(s).map((el) => ({ icon: <FileCheck2 size={15} />, text: `PPAP · ${el}`, sub: elementStatus(s, el).why || "ยังไม่ครบ", go: () => onOpen("ppap", s.no), tone: "warn" as Tone })),
    ...weak.map((c) => ({ icon: <Activity size={15} />, text: `${c.code} ${c.characteristic}`, sub: enoughData(c) ? `Ppk ${f2(stats(c).ppk)} ต่ำกว่า ${capabilityTarget(c)}` : `มีข้อมูล ${c.subgroups.length} จาก ${MIN_SUBGROUPS} กลุ่มย่อย`, go: () => onOpen("spc", c.code), tone: "bad" as Tone })),
    ...PARTS.flatMap((x) => latestStudies(x.code)).filter((st) => !msaAcceptable(st)).map((st) => ({ icon: <Ruler size={15} />, text: `${st.no} ${st.gaugeName}`, sub: `%GRR ${grr(st).pct}% ยอมรับไม่ได้ · ${st.characteristic}`, go: () => onAct({ kind: "msa-new", characteristic: st.characteristic }), tone: "bad" as Tone })),
    ...CONTROL_PLANS.filter((c) => missingSpecials(c).length || weakCc(c).length || !c.approvedBy).map((c) => ({ icon: <ListTree size={15} />, text: `${c.no} ${c.phase}`, sub: !c.approvedBy ? "รออนุมัติฉบับใหม่" : "ขาดคุณลักษณะพิเศษจาก PFMEA", go: () => onOpen("plan", c.no), tone: "warn" as Tone })),
  ];

  return (
    <div>
      <PageHead
        title="เครื่องมือหลักยานยนต์"
        meta={`APQP · PPAP · FMEA · แผนควบคุม · SPC · MSA · ข้อมูล ณ ${TODAY}`}
        right={<Button icon={<Printer size={14} />} variant="secondary" onClick={() => onAct({ kind: "print", d: { doc: "apqp", no: p.no }, title: "รายงานสถานะ APQP" })}>พิมพ์รายงานสถานะ</Button>}
      />
      <Reveal>
        <Card title={`${materialName(p.part)} · ${part.customerPart}`} subtitle={`${customerName(part.customer)} · ${part.program} · เริ่มผลิตจริง ${part.sop} (อีก ${days} วัน)${part.safety ? " · ชิ้นส่วนเกี่ยวกับความปลอดภัย" : ""}`} action={<Button variant="ghost" onClick={() => onOpen("apqp", p.no)}>เปิดโครงการ</Button>}>
          <div className="space-y-3 p-4">
            <Stepper steps={phaseSteps(p)} icons={STEP_ICONS} />
            <div className="flex flex-wrap gap-2">
              <Badge dot tone={releasedForProduction(p.part) ? "ok" : s.submittedOn ? "info" : "warn"}>PPAP {s.decision ?? (s.submittedOn ? "รอลูกค้า" : `ขาด ${pendingElements(s).length} องค์ประกอบ`)}</Badge>
              <Badge tone={planOfPhase(p.part, "ผลิตจริง") ? "ok" : "idle"}>แผนควบคุม{planOfPhase(p.part, "ผลิตจริง") ? "ผลิตจริงแล้ว" : "ระยะก่อนผลิต"}</Badge>
            </div>
          </div>
        </Card>
      </Reveal>
      <Reveal delay={0.05}>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Metric icon={<CalendarClock size={17} />} label="รายการส่งมอบเลยกำหนด" value={`${lateDeliverables(p).length} รายการ`} deltaLabel={`เฟสปัจจุบัน ${currentPhase(p) < 0 ? "ครบแล้ว" : PHASES[currentPhase(p)]}`} />
          <Metric icon={<FileCheck2 size={17} />} label="PPAP ขาด" value={`${pendingElements(s).length} จาก 17`} deltaLabel={`ระดับการส่ง ${s.level}`} />
          <Metric icon={<ShieldCheck size={17} />} label="FMEA AP สูงค้าง" value={`${highs} แถว`} deltaLabel={`${FMEAS.length} ฉบับ`} />
          <Metric icon={<Activity size={17} />} label="ความสามารถต่ำกว่าเกณฑ์" value={`${weak.length} จาก ${CHARTS.length}`} deltaLabel="CC ต้อง Ppk ≥ 1.67 · SC ≥ 1.33" />
        </div>
      </Reveal>
      <Reveal delay={0.1} className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card title="ต้องจัดการก่อนเริ่มผลิต" subtitle="กดรายการเพื่อเปิดงานนั้น" className="lg:col-span-2">
          {todo.length === 0 ? <Empty>พร้อมเริ่มผลิต</Empty> : (
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
        <Card title="ความสามารถของกระบวนการ" subtitle="Ppk จากค่าที่วัดจริง" action={<Button variant="ghost" className="whitespace-nowrap" onClick={() => onOpenSection?.(4)}>แผนภูมิ</Button>}>
          <Lines>
            {CHARTS.map((c) => <Line key={c.code} title={`${c.characteristic}${c.special ? ` · ${c.special}` : ""}`} sub={`${c.subgroups.length} กลุ่มย่อย · เป้า ${capabilityTarget(c)}`} right={<Badge tone={capable(c) ? "ok" : "bad"}>Ppk {f2(stats(c).ppk)}</Badge>} />)}
          </Lines>
        </Card>
      </Reveal>
    </div>
  );
}

/* ------------------------------------------------------------------ apqp */

function Apqp({ onAct, onOpen }: Handlers) {
  return (
    <div className="space-y-4">
      {PROJECTS.map((p) => (
        <ApqpBody key={p.no} p={p} onAct={onAct} onOpen={onOpen} />
      ))}
    </div>
  );
}

function ApqpBody({ p, onAct }: { p: ApqpProject } & Handlers) {
  const phase = currentPhase(p);
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[12.5px] text-slate-500 dark:text-slate-400">{p.no} · {materialName(p.part)} · หัวหน้าทีม {p.leader} · รายการที่มีป้ายระบบตัดสิน ปิดได้ด้วยข้อมูลจริงเท่านั้น</p>
        <div className="ml-auto flex gap-2">
          <Button variant="secondary" icon={<Printer size={14} />} onClick={() => onAct({ kind: "print", d: { doc: "apqp", no: p.no }, title: "รายงานสถานะ APQP" })}>พิมพ์รายงาน</Button>
          {phase >= 0 && <Button icon={<Rocket size={14} />} onClick={() => onAct({ kind: "apqp-gate", no: p.no })}>ประตูผ่านเฟส {phase + 1}</Button>}
        </div>
      </div>
      <Stepper steps={phaseSteps(p)} icons={STEP_ICONS} />
      <div className="grid gap-4 lg:grid-cols-2">
        {PHASES.map((ph, i) => {
          const gate = p.gates.find((g) => g.phase === i);
          return (
            <Card key={ph} title={`เฟส ${i + 1} · ${ph}`} subtitle={gate ? `${gate.decision} ${gate.date} · ${gate.note}` : i === phase ? "เฟสปัจจุบัน" : "ยังไม่ถึง"}>
              <Lines>
                {p.deliverables.map((d, idx) => ({ d, idx })).filter((x) => x.d.phase === i).map(({ d, idx }) => {
                  const done = isDone(p, d);
                  const late = !done && d.due < TODAY;
                  return (
                    <Line
                      key={idx}
                      title={d.item}
                      sub={`${d.owner} · กำหนด ${d.due}${late ? " · เลยกำหนด" : ""}`}
                      subTone={late ? "bad" : undefined}
                      right={
                        <span className="flex items-center gap-2">
                          {d.auto && <Chip>ระบบตัดสิน</Chip>}
                          {done ? <Badge tone="ok">เสร็จ</Badge> : d.auto ? <Badge tone="warn">ยังไม่ผ่าน</Badge> : <Button variant="secondary" icon={<CircleCheck size={14} />} onClick={() => run(() => completeDeliverable(p.no, idx), `บันทึกว่า ${d.item} เสร็จแล้ว`)}>เสร็จแล้ว</Button>}
                        </span>
                      }
                    />
                  );
                })}
              </Lines>
            </Card>
          );
        })}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ ppap */

function Ppap({ onAct }: Handlers) {
  return <div className="space-y-4">{SUBMISSIONS.map((s) => <PpapBody key={s.no} s={s} onAct={onAct} />)}</div>;
}

function PpapBody({ s, onAct }: { s: Submission; onAct: (a: Act) => void }) {
  const pending = pendingElements(s);
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[12.5px] text-slate-500 dark:text-slate-400">{s.no} · {materialName(s.part)} · ระดับ {s.level} · {s.reason}</p>
        <Badge dot tone={s.decision === "อนุมัติ" ? "ok" : s.decision === "ไม่อนุมัติ" ? "bad" : s.submittedOn ? "info" : "warn"}>{s.decision ?? (s.submittedOn ? `ส่งแล้ว ${s.submittedOn} รอลูกค้า` : "ยังไม่ส่ง")}</Badge>
        <div className="ml-auto flex gap-2">
          <Button variant="secondary" icon={<Printer size={14} />} onClick={() => onAct({ kind: "print", d: { doc: "psw", no: s.no }, title: "ใบรับรองการส่งชิ้นส่วน (PSW)" })}>พิมพ์ PSW</Button>
          {!s.submittedOn && <Button icon={<Send size={14} />} disabled={pending.length > 0} onClick={() => run(() => submitPpap(s.no), `ส่ง ${s.no} ให้ลูกค้าแล้ว`)}>ส่ง PPAP</Button>}
          {s.submittedOn && !s.decision && <Button icon={<ClipboardCheck size={14} />} onClick={() => onAct({ kind: "ppap-decision", no: s.no })}>บันทึกผลจากลูกค้า</Button>}
        </div>
      </div>
      {pending.length > 0 && <Note tone="warn">ยังขาด {pending.length} องค์ประกอบ: {pending.join(", ")}</Note>}
      <Card title="18 องค์ประกอบ" subtitle="องค์ประกอบที่มีป้ายระบบตัดสินอ่านจาก FMEA แผนควบคุม SPC และ MSA">
        <Lines>
          {PPAP_ELEMENTS.map((el, i) => {
            const st = elementStatus(s, el);
            const auto = AUTO_ELEMENTS.includes(el);
            return (
              <Line
                key={el}
                title={`${i + 1}. ${el}`}
                sub={st.why || undefined}
                right={
                  <span className="flex items-center gap-2">
                    {auto && <Chip>ระบบตัดสิน</Chip>}
                    <Badge tone={st.status === "ครบ" ? "ok" : st.status === "ไม่เกี่ยวข้อง" ? "idle" : "warn"}>{st.status}</Badge>
                    {!auto && !s.submittedOn && <Button variant="ghost" onClick={() => onAct({ kind: "ppap-element", no: s.no, element: el })}>แก้</Button>}
                  </span>
                }
              />
            );
          })}
        </Lines>
      </Card>
    </>
  );
}

/* ------------------------------------------------------------------ fmea */

function Fmeas({ onAct, onOpen }: Handlers) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[12.5px] text-slate-500 dark:text-slate-400">จัดลำดับด้วย Action Priority ตาม AIAG-VDA · AP สูงต้องมีมาตรการ · PFMEA ลดความรุนแรงไม่ได้</p>
        <Button className="ml-auto" variant="secondary" icon={exportIcon} onClick={() => csv("FMEA", ["เลขที่", "ประเภท", "ขั้นตอน", "ความล้มเหลว", "ผลกระทบ", "สาเหตุ", "S", "O", "D", "AP", "พิเศษ", "มาตรการ"], FMEAS.flatMap((f) => f.rows.map((r) => [f.no, f.type, r.step, r.failure, r.effect, r.cause, rated(r).s, rated(r).o, rated(r).d, apOf(r), r.special ?? "", r.action?.what ?? ""])))}>ส่งออก Excel</Button>
      </div>
      {FMEAS.map((f) => (
        <Card key={f.no} title={`${f.no} · ${f.type} · ${materialName(f.part)}`} subtitle={`Rev.${f.rev} · ${f.date} · ทีม ${f.team.join(", ")}`} action={<Button variant="ghost" onClick={() => onOpen("fmea", f.no)}>เปิด</Button>}>
          <FmeaRows f={f} onAct={onAct} />
        </Card>
      ))}
    </div>
  );
}

function FmeaRows({ f, onAct }: { f: Fmea; onAct: (a: Act) => void }) {
  return (
    <Lines>
      {f.rows.map((r) => {
        const x = rated(r);
        const ap = apOf(r);
        return (
          <Line
            key={r.id}
            title={`${r.failure} → ${r.effect}`}
            sub={`${r.step} · สาเหตุ ${r.cause} · S${x.s} O${x.o} D${x.d}${r.special ? ` · ${r.special} ${r.characteristic}` : ""}${r.action ? ` · มาตรการ: ${r.action.what}${r.action.doneOn ? " (เสร็จ)" : ` (กำหนด ${r.action.due})`}` : ""}`}
            right={
              <span className="flex items-center gap-2">
                <Badge tone={apTone(ap)}>AP {ap}</Badge>
                {!r.action && ap !== "ต่ำ" && <Button variant="secondary" onClick={() => onAct({ kind: "fmea-action", no: f.no, id: r.id })}>เพิ่มมาตรการ</Button>}
                {r.action && !r.action.doneOn && <Button variant="secondary" onClick={() => onAct({ kind: "fmea-complete", no: f.no, id: r.id })}>ปิดและประเมินซ้ำ</Button>}
              </span>
            }
          />
        );
      })}
    </Lines>
  );
}

/* ------------------------------------------------------------ control plan */

function Plans({ onAct, onOpen }: Handlers) {
  const columns: Column<ControlPlan>[] = [
    { key: "no", header: "เลขที่", cell: (c) => <span className="whitespace-nowrap font-medium tabular-nums text-slate-800 dark:text-slate-100">{c.no}</span> },
    { key: "phase", header: "ระยะ", cell: (c) => <Chip>{c.phase}</Chip> },
    { key: "part", header: "ชิ้นส่วน", cell: (c) => materialName(c.part) },
    { key: "rev", header: "ฉบับ", cell: (c) => `Rev.${c.rev} · ${c.date}` },
    { key: "rows", header: "คุณลักษณะ", align: "right", cell: (c) => <span className="tabular-nums">{c.rows.length}</span> },
    { key: "status", header: "สถานะ", cell: (c) => <span className="flex flex-wrap gap-1.5">{c.approvedBy ? <Badge tone="ok">อนุมัติแล้ว</Badge> : <Badge tone="warn">รออนุมัติ</Badge>}{missingSpecials(c).length > 0 && <Badge tone="bad">ขาดคุณลักษณะพิเศษ {missingSpecials(c).length}</Badge>}</span> },
  ];
  const canPromote = PARTS.filter((p) => !planOfPhase(p.code, "ผลิตจริง") && releasedForProduction(p.code));
  return (
    <div className="space-y-4">
      {canPromote.map((p) => <Note key={p.code} tone="info">PPAP ของ {materialName(p.code)} อนุมัติแล้ว — ยกแผนก่อนผลิตเป็นแผนผลิตจริงได้</Note>)}
      <DataTable
        rows={CONTROL_PLANS}
        columns={columns}
        getId={(c) => c.no}
        onOpen={(c) => onOpen("plan", c.no)}
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[12.5px] text-slate-500 dark:text-slate-400">สามระยะ: ต้นแบบ ก่อนผลิต ผลิตจริง · ขั้นตอนอ่านจากระบบวางแผนการผลิต · คุณลักษณะพิเศษจาก PFMEA ต้องอยู่ครบ</p>
            <div className="ml-auto flex gap-2">
              <Button variant="secondary" icon={exportIcon} onClick={() => csv("แผนควบคุม", ["แผน", "ระยะ", "ขั้นตอน", "คุณลักษณะ", "พิเศษ", "เกณฑ์", "เครื่องมือวัด", "ความถี่", "วิธีควบคุม", "แผนตอบสนอง"], CONTROL_PLANS.flatMap((c) => c.rows.map((r) => [c.no, c.phase, r.op, r.characteristic, r.special ?? "", r.spec, r.gauge, r.sample, r.control, r.reaction])))}>ส่งออก Excel</Button>
              {canPromote.map((p) => <Button key={p.code} icon={<Rocket size={14} />} onClick={() => run(() => promoteToProduction(p.code), `ใช้แผนควบคุมผลิตจริงของ ${materialName(p.code)} แล้ว`)}>ยกเป็นแผนผลิตจริง</Button>)}
            </div>
          </div>
        }
      />
    </div>
  );
}

/* ------------------------------------------------------------------- spc */

function XbarChart({ c }: { c: SpcChart }) {
  const st = stats(c);
  if (c.subgroups.length < 2) return <Empty>เก็บข้อมูลอย่างน้อย 2 กลุ่มย่อยเพื่อวาดแผนภูมิ</Empty>;
  const W = 640;
  const H = 180;
  const pad = 28;
  const lo = Math.min(st.limits.lclX, ...st.means);
  const hi = Math.max(st.limits.uclX, ...st.means);
  const span = hi - lo || 1;
  const y = (v: number) => H - pad - ((v - lo) / span) * (H - 2 * pad);
  const x = (i: number) => pad + (i / Math.max(1, st.means.length - 1)) * (W - 2 * pad);
  const line = (v: number, cls: string, label: string) => (
    <g>
      <line x1={pad} x2={W - pad} y1={y(v)} y2={y(v)} className={cls} strokeDasharray="4 4" />
      <text x={W - pad + 2} y={y(v) + 3} className="fill-slate-400 text-[9px]">{label}</text>
    </g>
  );
  return (
    <div className="overflow-x-auto px-4 py-3">
      <svg viewBox={`0 0 ${W + 30} ${H}`} className="w-full min-w-[520px]">
        {line(st.limits.uclX, "stroke-rose-400", "UCL")}
        {line(st.xbar, "stroke-slate-400", "X̄")}
        {line(st.limits.lclX, "stroke-rose-400", "LCL")}
        <polyline points={st.means.map((m, i) => `${x(i)},${y(m)}`).join(" ")} className="fill-none stroke-violet-500" strokeWidth={1.5} />
        {st.means.map((m, i) => <circle key={i} cx={x(i)} cy={y(m)} r={3} className={st.outOfControl.includes(i) ? "fill-rose-500" : "fill-violet-500"} />)}
      </svg>
    </div>
  );
}

function Spc({ onAct, onOpen }: Handlers) {
  return (
    <div className="space-y-4">
      <p className="text-[12.5px] text-slate-500 dark:text-slate-400">Cp/Cpk จากความแปรปรวนภายในกลุ่ม Pp/Ppk จากส่วนเบี่ยงเบนรวม · การศึกษาเบื้องต้นต้องมีอย่างน้อย {MIN_SUBGROUPS} กลุ่มย่อย</p>
      {CHARTS.map((c) => {
        const st = stats(c);
        return (
          <Card key={c.code} title={`${c.code} · ${c.characteristic}${c.special ? ` (${c.special})` : ""}`} subtitle={`${materialName(c.part)} · ขั้นตอน ${c.op} · เกณฑ์ ${c.lsl}–${c.usl} · ${c.subgroups.length} กลุ่มย่อย × ${c.n}`} action={<Button variant="ghost" onClick={() => onOpen("spc", c.code)}>เปิด</Button>}>
            <div className="grid gap-3 px-4 pt-3 sm:grid-cols-4">
              {[["Cp", st.cp], ["Cpk", st.cpk], ["Pp", st.pp], ["Ppk", st.ppk]].map(([k, v]) => (
                <div key={k as string} className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/50">
                  <p className="text-[11.5px] text-slate-500">{k}</p>
                  <p className={"text-[18px] font-semibold tabular-nums " + (k === "Ppk" ? (capable(c) ? "text-emerald-600" : "text-rose-600") : "text-slate-900 dark:text-slate-50")}>{f2(v as number)}</p>
                </div>
              ))}
            </div>
            <XbarChart c={c} />
            <div className="flex flex-wrap gap-2 px-4 pb-4">
              <Button variant="secondary" icon={<Plus size={14} />} onClick={() => onAct({ kind: "spc-add", code: c.code })}>เพิ่มกลุ่มย่อย</Button>
              <Button variant="secondary" icon={<Upload size={14} />} onClick={() => onAct({ kind: "spc-import", code: c.code })}>นำเข้าหลายกลุ่ม</Button>
              <Button variant="ghost" icon={<RotateCcw size={14} />} onClick={() => onAct({ kind: "spc-restart", code: c.code })}>เริ่มการศึกษาใหม่</Button>
              <Button variant="ghost" icon={<Printer size={14} />} onClick={() => onAct({ kind: "print", d: { doc: "spc", code: c.code }, title: "รายงานความสามารถของกระบวนการ" })}>พิมพ์</Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------- msa */

function Msa({ onAct, onOpen }: Handlers) {
  const latest = new Set(PARTS.flatMap((p) => latestStudies(p.code)).map((s) => s.no));
  const columns: Column<MsaStudy>[] = [
    { key: "no", header: "เลขที่", cell: (s) => <span className="whitespace-nowrap font-medium tabular-nums text-slate-800 dark:text-slate-100">{s.no}</span> },
    { key: "gauge", header: "เครื่องมือวัด", cell: (s) => `${s.gauge} · ${s.gaugeName}` },
    { key: "char", header: "คุณลักษณะ", cell: (s) => s.characteristic },
    { key: "date", header: "วันที่", cell: (s) => s.date },
    { key: "grr", header: "%GRR", align: "right", cell: (s) => <span className="tabular-nums">{grr(s).pct}%</span> },
    { key: "ndc", header: "ndc", align: "right", cell: (s) => <span className="tabular-nums">{grr(s).ndc}</span> },
    { key: "verdict", header: "ผล", cell: (s) => <span className="flex gap-1.5"><Badge tone={grrTone(grr(s).verdict)}>{grr(s).verdict}</Badge>{latest.has(s.no) ? <Badge tone="info">ใช้อยู่</Badge> : <Badge tone="idle">แทนที่แล้ว</Badge>}</span> },
  ];
  return (
    <DataTable
      rows={STUDIES}
      columns={columns}
      getId={(s) => s.no}
      onOpen={(s) => onOpen("msa", s.no)}
      toolbar={
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[12.5px] text-slate-500 dark:text-slate-400">%GRR ต่ำกว่า 10% และ ndc ≥ 5 ยอมรับได้ · 10–30% มีเงื่อนไข · เกิน 30% ยอมรับไม่ได้ · ผลล่าสุดของแต่ละคุณลักษณะคือผลที่ใช้</p>
          <div className="ml-auto flex gap-2">
            <Button variant="secondary" icon={exportIcon} onClick={() => csv("Gage R&R", ["เลขที่", "เครื่องมือ", "คุณลักษณะ", "วันที่", "%GRR", "ndc", "ผล"], STUDIES.map((s) => [s.no, s.gauge, s.characteristic, s.date, grr(s).pct, grr(s).ndc, grr(s).verdict]))}>ส่งออก Excel</Button>
            <Button icon={<GaugeIcon size={14} />} onClick={() => onAct({ kind: "msa-new" })}>ศึกษาใหม่</Button>
          </div>
        </div>
      }
    />
  );
}

/* --------------------------------------------------------------- records */

function RecordView({ kind, id, ...h }: { kind: RecordKind; id: string } & Handlers) {
  if (kind === "apqp") return <div className="space-y-4 overflow-y-auto px-5 py-4"><ApqpBody p={projectByNo(id)} {...h} /></div>;
  if (kind === "ppap") return <div className="space-y-4 overflow-y-auto px-5 py-4"><PpapBody s={submissionByNo(id)} onAct={h.onAct} /></div>;
  if (kind === "fmea") return <FmeaRecord f={fmeaByNo(id)} {...h} />;
  if (kind === "plan") return <PlanRecord cp={planByNo(id)} {...h} />;
  if (kind === "spc") return <ChartRecord c={chartByCode(id)} {...h} />;
  return <StudyRecord s={studyByNo(id)} {...h} />;
}

function FmeaRecord({ f, onAct }: { f: Fmea } & Handlers) {
  return (
    <div className="flex h-full flex-col">
      <Header
        title={`${f.no} · ${f.type}`}
        meta={`${materialName(f.part)} · Rev.${f.rev} · ${f.date}`}
        badges={<>{openHigh(f).length ? <Badge tone="bad">AP สูงค้าง {openHigh(f).length}</Badge> : <Badge tone="ok">ไม่มี AP สูงค้าง</Badge>}<Badge tone="idle">{f.rows.length} แถว</Badge></>}
        actions={
          <>
            <Button icon={<Plus size={14} />} onClick={() => onAct({ kind: "fmea-row", no: f.no })}>เพิ่มแถว</Button>
            <Button variant="secondary" icon={<Printer size={14} />} onClick={() => onAct({ kind: "print", d: { doc: "fmea", no: f.no }, title: f.type })}>พิมพ์</Button>
          </>
        }
      />
      <Body><Card title="แถววิเคราะห์"><FmeaRows f={f} onAct={onAct} /></Card></Body>
    </div>
  );
}

function PlanRecord({ cp, onAct }: { cp: ControlPlan } & Handlers) {
  const missing = missingSpecials(cp);
  return (
    <div className="flex h-full flex-col">
      <Header
        title={`${cp.no} · ระยะ${cp.phase}`}
        meta={`${materialName(cp.part)} · Rev.${cp.rev} · ${cp.date}`}
        badges={<>{cp.approvedBy ? <Badge tone="ok">อนุมัติโดย {cp.approvedBy}</Badge> : <Badge tone="warn">รออนุมัติ</Badge>}{missing.length > 0 && <Badge tone="bad">ขาดคุณลักษณะพิเศษ {missing.length}</Badge>}</>}
        actions={
          <>
            <Button icon={<Plus size={14} />} onClick={() => onAct({ kind: "cp-row", no: cp.no })}>เพิ่มแถว</Button>
            {!cp.approvedBy && <Button variant="secondary" icon={<ShieldCheck size={14} />} onClick={() => onAct({ kind: "cp-approve", no: cp.no })}>อนุมัติ</Button>}
            <Button variant="secondary" icon={<Printer size={14} />} onClick={() => onAct({ kind: "print", d: { doc: "control-plan", no: cp.no }, title: "แผนควบคุม" })}>พิมพ์</Button>
          </>
        }
      />
      <Body>
        {missing.length > 0 && <Note tone="bad">PFMEA ประกาศคุณลักษณะพิเศษที่แผนนี้ยังไม่มี: {missing.map((m) => `${m.characteristic} (${m.special})`).join(", ")}</Note>}
        <Card title="แถวควบคุม">
          <Lines>
            {cp.rows.map((r, i) => <Line key={i} title={`${r.op} · ${r.characteristic}${r.special ? ` · ${r.special}` : ""}`} sub={`เกณฑ์ ${r.spec} · ${r.gauge} · ${r.sample} · ตอบสนอง: ${r.reaction}`} right={<Badge tone={r.special === "CC" ? "bad" : r.special === "SC" ? "warn" : "idle"}>{r.control}</Badge>} />)}
          </Lines>
        </Card>
      </Body>
    </div>
  );
}

function ChartRecord({ c, onAct }: { c: SpcChart } & Handlers) {
  const st = stats(c);
  return (
    <div className="flex h-full flex-col">
      <Header
        title={`${c.code} · ${c.characteristic}`}
        meta={`${materialName(c.part)} · เกณฑ์ ${c.lsl}–${c.usl} · ${c.subgroups.length} กลุ่มย่อย`}
        badges={<><Badge tone={capable(c) ? "ok" : "bad"}>Ppk {f2(st.ppk)} · เป้า {capabilityTarget(c)}</Badge><Badge tone="idle">Cpk {f2(st.cpk)}</Badge>{st.outOfControl.length > 0 && <Badge tone="warn">หลุดการควบคุม {st.outOfControl.length} จุด</Badge>}</>}
        actions={
          <>
            <Button icon={<Plus size={14} />} onClick={() => onAct({ kind: "spc-add", code: c.code })}>เพิ่มกลุ่มย่อย</Button>
            <Button variant="secondary" icon={<Upload size={14} />} onClick={() => onAct({ kind: "spc-import", code: c.code })}>นำเข้าหลายกลุ่ม</Button>
            <Button variant="secondary" icon={<Printer size={14} />} onClick={() => onAct({ kind: "print", d: { doc: "spc", code: c.code }, title: "รายงานความสามารถของกระบวนการ" })}>พิมพ์</Button>
          </>
        }
      />
      <Body>
        <Card title="แผนภูมิ X̄"><XbarChart c={c} /></Card>
        {c.history.length > 0 && <Card title="การศึกษาก่อนหน้า"><Lines>{c.history.map((x, i) => <Line key={i} title={`ปิด ${x.closedOn}`} sub={`${x.reason} · ${x.subgroups.length} กลุ่มย่อย`} />)}</Lines></Card>}
      </Body>
    </div>
  );
}

function StudyRecord({ s, onAct }: { s: MsaStudy } & Handlers) {
  const r = grr(s);
  return (
    <div className="flex h-full flex-col">
      <Header
        title={`${s.no} · ${s.gaugeName}`}
        meta={`${s.gauge} · ${s.characteristic} · เกณฑ์ ${s.lsl}–${s.usl} · ${s.date}`}
        badges={<><Badge tone={grrTone(r.verdict)}>{r.verdict}</Badge><Badge tone="idle">%GRR {r.pct}% · ndc {r.ndc}</Badge></>}
        actions={
          <>
            {r.verdict === "ยอมรับไม่ได้" && <Button icon={<GaugeIcon size={14} />} onClick={() => onAct({ kind: "msa-new", characteristic: s.characteristic })}>ศึกษาใหม่ด้วยเครื่องมืออื่น</Button>}
            <Button variant="secondary" icon={<Printer size={14} />} onClick={() => onAct({ kind: "print", d: { doc: "msa", no: s.no }, title: "รายงานการวิเคราะห์ระบบการวัด" })}>พิมพ์รายงาน</Button>
          </>
        }
      />
      <Body>
        <div className="grid gap-3 sm:grid-cols-4">
          <Metric label="EV เครื่องมือ" value={r.ev.toFixed(4)} />
          <Metric label="AV ผู้วัด" value={r.av.toFixed(4)} />
          <Metric label="PV ชิ้นงาน" value={r.pv.toFixed(4)} />
          <Metric label="%GRR" value={`${r.pct}%`} deltaLabel={`ndc ${r.ndc}`} />
        </div>
        <Card title="ผู้วัด"><p className="px-4 py-3 text-[13px] text-slate-700 dark:text-slate-200">{s.appraisers.join(" · ")}</p></Card>
      </Body>
    </div>
  );
}
