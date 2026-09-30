import { useState } from "react";
import { Printer } from "lucide-react";
import { DOCUMENTS, EMR, TODAY } from "../ims/data";
import { Actions, Area, Choice, Form, Input, people, tryRun } from "../ims/parts";
import {
  CONDITIONS, GROUPS, PARAMETERS, PLANS, RECEIVERS, STAGES, WASTE_TYPES, addAspect, addObligation, aspectErrors, aspectScore,
  chemicalByCode, closeIncident, closeIncidentErrors, disposalErrors, drillErrors, evaluateObligation, evaluationErrors,
  generationErrors, incidentErrors, limitText, markReported, monitoringErrors, obligationByNo, obligationErrors, onHand,
  recordCertificate, recordDisposal, recordDrill, recordGeneration, recordMonitoring, reportIncident, significant, updateSds,
  wasteType, disposalByNo,
} from "./data";
import type { Condition, Drill, Incident, Stage } from "./data";
import { EmPaper } from "./documents";
import type { EmDoc } from "./documents";
import { Badge, Button, Note, Segmented } from "../ui";
import { ConfirmDialog, Field, FormModal, notify, printDocument, useData } from "../kit";

/** ทุกการกระทำของระบบสิ่งแวดล้อม ยกขึ้นแบบเดียวกันจากทุกหน้า */
export type Act =
  | { kind: "aspect-new" }
  | { kind: "obligation-new" }
  | { kind: "obligation-evaluate"; no: string }
  | { kind: "waste-generate"; source?: string }
  | { kind: "waste-dispose"; type?: string }
  | { kind: "waste-certificate"; no: string }
  | { kind: "sds-update"; code: string }
  | { kind: "monitoring-new"; group?: string }
  | { kind: "drill-new"; plan?: string }
  | { kind: "incident-new"; plan?: string }
  | { kind: "incident-report"; no: string }
  | { kind: "incident-close"; no: string }
  | { kind: "print"; d: EmDoc; title: string };

type Of<K extends Act["kind"]> = Extract<Act, { kind: K }>;
export type RecordKind = "aspect" | "obligation" | "waste" | "monitoring" | "plan" | "incident";

const n1to5 = [1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) }));

function AspectForm({ onCancel, onDone }: { onCancel: () => void; onDone: (no: string) => void }) {
  const [v, setV] = useState({ activity: "", aspect: "", impact: "", condition: "ปกติ" as Condition, stage: "ผลิต" as Stage, severity: 3, frequency: 3, legal: false, control: "", owner: EMR });
  const [tried, setTried] = useState(false);
  const input = { ...v, control: v.control || undefined };
  const errors = tried ? aspectErrors(input) : {};
  const set = <K extends keyof typeof v>(k: K) => (x: (typeof v)[K]) => setV((s) => ({ ...s, [k]: x }));
  const sig = significant(v);
  return (
    <Form onSubmit={() => { setTried(true); if (Object.keys(aspectErrors(input)).length) return; const a = addAspect(input); notify(`เพิ่ม ${a.no} แล้ว${sig ? " · มีนัยสำคัญ" : ""}`); onDone(a.no); }}>
      <Field label="กิจกรรม" error={errors.activity}><Input value={v.activity} onChange={set("activity")} error={errors.activity} placeholder="เช่น ล้างถังผสมสี" /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="ประเด็นสิ่งแวดล้อม" error={errors.aspect}><Input value={v.aspect} onChange={set("aspect")} error={errors.aspect} /></Field>
        <Field label="ผลกระทบ" error={errors.impact}><Input value={v.impact} onChange={set("impact")} error={errors.impact} /></Field>
        <Field label="สภาวะ"><Segmented options={CONDITIONS} value={v.condition} onChange={(x) => set("condition")(x as Condition)} /></Field>
        <Field label="ช่วงวัฏจักรชีวิต"><Choice value={v.stage} onChange={(x) => set("stage")(x as Stage)} options={STAGES} /></Field>
        <Field label="ความรุนแรง (1–5)"><Choice value={String(v.severity)} onChange={(x) => set("severity")(Number(x))} options={n1to5} /></Field>
        <Field label="ความถี่ (1–5)"><Choice value={String(v.frequency)} onChange={(x) => set("frequency")(Number(x))} options={n1to5} /></Field>
      </div>
      <label className="flex items-center gap-2 text-[12.5px] text-slate-700 dark:text-slate-200">
        <input type="checkbox" checked={v.legal} onChange={() => set("legal")(!v.legal)} className="size-4 accent-violet-600" />
        มีกฎหมายหรือพันธะที่เกี่ยวข้อง
      </label>
      <Note tone={sig ? "warn" : "idle"}>คะแนน {aspectScore(v)} · {sig ? "มีนัยสำคัญ ต้องมีเอกสารควบคุม" : "ไม่มีนัยสำคัญ"}</Note>
      <Field label="เอกสารควบคุมการปฏิบัติงาน" error={errors.control}>
        <Choice value={v.control} onChange={set("control")} placeholder="ไม่มี" error={errors.control} options={DOCUMENTS.filter((d) => d.standards.includes("ISO 14001") && d.level !== "แบบฟอร์ม").map((d) => ({ value: d.code, label: `${d.code} · ${d.title} (${d.status})` }))} />
      </Field>
      <Field label="ผู้รับผิดชอบ" error={errors.owner}><Choice value={v.owner} onChange={set("owner")} options={people()} /></Field>
      <Actions onCancel={onCancel} label="เพิ่มในทะเบียน" />
    </Form>
  );
}

function ObligationForm({ onCancel, onDone }: { onCancel: () => void; onDone: (no: string) => void }) {
  const [v, setV] = useState({ title: "", authority: "", requirement: "", appliesTo: "" });
  const [tried, setTried] = useState(false);
  const errors = tried ? obligationErrors(v) : {};
  const set = (k: keyof typeof v) => (x: string) => setV((s) => ({ ...s, [k]: x }));
  return (
    <Form onSubmit={() => { setTried(true); if (Object.keys(obligationErrors(v)).length) return; const o = addObligation(v); notify(`เพิ่ม ${o.no} ในทะเบียนกฎหมายแล้ว · ประเมินความสอดคล้องได้เลย`); onDone(o.no); }}>
      <Field label="กฎหมายหรือพันธะ" error={errors.title}><Area value={v.title} onChange={set("title")} error={errors.title} rows={2} /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="หน่วยงานกำกับ" error={errors.authority}><Input value={v.authority} onChange={set("authority")} error={errors.authority} /></Field>
        <Field label="ใช้กับ" error={errors.appliesTo}><Input value={v.appliesTo} onChange={set("appliesTo")} error={errors.appliesTo} /></Field>
      </div>
      <Field label="สิ่งที่ต้องทำให้สอดคล้อง" error={errors.requirement}><Area value={v.requirement} onChange={set("requirement")} error={errors.requirement} /></Field>
      <Actions onCancel={onCancel} label="เพิ่มในทะเบียน" />
    </Form>
  );
}

function EvaluateForm({ no, onCancel, onDone }: { no: string; onCancel: () => void; onDone: () => void }) {
  const o = obligationByNo(no);
  const [result, setResult] = useState<"สอดคล้อง" | "ไม่สอดคล้อง">("สอดคล้อง");
  const [evidence, setEvidence] = useState("");
  const [by, setBy] = useState(EMR);
  const [tried, setTried] = useState(false);
  const input = { result, evidence, by };
  const errors = tried ? evaluationErrors(no, input) : {};
  return (
    <Form onSubmit={() => { setTried(true); if (Object.keys(evaluationErrors(no, input)).length) return; const { car } = evaluateObligation(no, input); notify(car ? `${no} ไม่สอดคล้อง · เปิด ${car.no} แล้ว` : `ประเมิน ${no} แล้ว · สอดคล้อง`, car ? "warn" : "ok"); onDone(); }}>
      <p className="text-[13px] text-slate-600 dark:text-slate-300">{o.requirement}</p>
      <Field label="ผลการประเมิน"><Segmented options={["สอดคล้อง", "ไม่สอดคล้อง"]} value={result} onChange={(v) => setResult(v as "สอดคล้อง" | "ไม่สอดคล้อง")} /></Field>
      {result === "ไม่สอดคล้อง" && <Note tone="warn">จะเปิด CAR ในระบบบริหารบูรณาการให้ผู้แทนฝ่ายบริหารด้านสิ่งแวดล้อม</Note>}
      <Field label="หลักฐาน" error={errors.evidence}><Area value={evidence} onChange={setEvidence} error={errors.evidence} /></Field>
      <Field label="ผู้ประเมิน" error={errors.by}><Choice value={by} onChange={setBy} options={people()} /></Field>
      <Actions onCancel={onCancel} label="บันทึกผลประเมิน" />
    </Form>
  );
}

function GenerationForm({ source: initial, onCancel, onDone }: { source?: string; onCancel: () => void; onDone: () => void }) {
  const [v, setV] = useState({ type: initial ? "W-04" : "W-01", kg: "", source: initial ?? "", date: TODAY });
  const [tried, setTried] = useState(false);
  const input = { ...v, kg: Number(v.kg) };
  const errors = tried ? generationErrors(input) : {};
  const set = (k: keyof typeof v) => (x: string) => setV((s) => ({ ...s, [k]: x }));
  return (
    <Form onSubmit={() => { setTried(true); if (Object.keys(generationErrors(input)).length) return; recordGeneration(input); notify(`บันทึก${wasteType(v.type).name} ${Number(v.kg).toLocaleString("th-TH")} กก. เข้าบัญชีของเสียแล้ว`); onDone(); }}>
      <Field label="ประเภทของเสีย" error={errors.type}><Choice value={v.type} onChange={set("type")} options={WASTE_TYPES.map((w) => ({ value: w.code, label: `${w.code} · ${w.name}${w.hazardous ? " (อันตราย)" : ""}` }))} /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="น้ำหนัก (กก.)" error={errors.kg}><Input type="number" value={v.kg} onChange={set("kg")} error={errors.kg} /></Field>
        <Field label="วันที่" error={errors.date}><Input type="date" value={v.date} onChange={set("date")} error={errors.date} /></Field>
      </div>
      <Field label="ที่มา" error={errors.source} hint="เอกสารตัดสต็อกจากคลังวัสดุ หรือรอบการเก็บรวบรวม"><Input value={v.source} onChange={set("source")} error={errors.source} /></Field>
      <Actions onCancel={onCancel} label="บันทึกเข้าบัญชี" />
    </Form>
  );
}

function DisposalForm({ type: initial, onCancel, onDone }: { type?: string; onCancel: () => void; onDone: () => void }) {
  const [v, setV] = useState({ type: initial ?? "W-01", kg: "", receiver: RECEIVERS[0].name, manifest: "", date: TODAY });
  const [tried, setTried] = useState(false);
  const input = { ...v, kg: Number(v.kg) };
  const errors = tried ? disposalErrors(input) : {};
  const set = (k: keyof typeof v) => (x: string) => setV((s) => ({ ...s, [k]: x }));
  const w = wasteType(v.type);
  return (
    <Form onSubmit={() => { setTried(true); if (Object.keys(disposalErrors(input)).length) return; const d = recordDisposal(input); notify(`บันทึกส่งกำจัด ${d.no} แล้ว · รอใบรับรองการกำจัด`); onDone(); }}>
      <Field label="ประเภทของเสีย" error={errors.type}><Choice value={v.type} onChange={set("type")} options={WASTE_TYPES.map((x) => ({ value: x.code, label: `${x.code} · ${x.name} · เก็บอยู่ ${onHand(x.code).kg.toLocaleString("th-TH")} กก.` }))} /></Field>
      <Note tone="info">วิธีกำจัด {w.method} · รหัสของเสีย {w.wasteCode}</Note>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="น้ำหนัก (กก.)" error={errors.kg}><Input type="number" value={v.kg} onChange={set("kg")} error={errors.kg} /></Field>
        <Field label="วันที่ส่ง" error={errors.date}><Input type="date" value={v.date} onChange={set("date")} error={errors.date} /></Field>
      </div>
      <Field label="ผู้รับกำจัด" error={errors.receiver}><Choice value={v.receiver} onChange={set("receiver")} options={RECEIVERS.map((r) => ({ value: r.name, label: `${r.name} · ใบอนุญาต ${r.license} ถึง ${r.validUntil}` }))} error={errors.receiver} /></Field>
      <Field label="เลขใบกำกับการขนส่ง" error={errors.manifest} hint={w.hazardous ? "ของเสียอันตรายต้องมี" : undefined}><Input value={v.manifest} onChange={set("manifest")} error={errors.manifest} /></Field>
      <Actions onCancel={onCancel} label="บันทึกการส่งกำจัด" />
    </Form>
  );
}

function MonitoringForm({ group: initial, onCancel, onDone }: { group?: string; onCancel: () => void; onDone: (no: string) => void }) {
  const [group, setGroup] = useState(initial ?? GROUPS[0]);
  const [date, setDate] = useState(TODAY);
  const [lab, setLab] = useState("บจก. เอ็นไวรอนเมนทัลแล็บ");
  const [values, setValues] = useState<Record<string, string>>({});
  const [tried, setTried] = useState(false);
  const input = { group, date, lab, values: Object.fromEntries(Object.entries(values).filter(([, x]) => x !== "").map(([k, x]) => [k, Number(x)])) };
  const errors = tried ? monitoringErrors(input) : {};
  return (
    <Form onSubmit={() => { setTried(true); if (Object.keys(monitoringErrors(input)).length) return; const m = recordMonitoring(input); notify(m.car ? `${m.no} เกินค่ามาตรฐาน · เปิด ${m.car} แล้ว` : `บันทึกผลตรวจวัด ${m.no} แล้ว · อยู่ในเกณฑ์`, m.car ? "warn" : "ok"); onDone(m.no); }}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="กลุ่ม"><Choice value={group} onChange={(g) => { setGroup(g); setValues({}); }} options={GROUPS} /></Field>
        <Field label="วันที่เก็บตัวอย่าง" error={errors.date}><Input type="date" value={date} onChange={setDate} error={errors.date} /></Field>
      </div>
      <Field label="ห้องปฏิบัติการ" error={errors.lab}><Input value={lab} onChange={setLab} error={errors.lab} /></Field>
      <Field label="ผลตรวจ" error={errors.values}>
        <div className="grid gap-2 sm:grid-cols-2">
          {PARAMETERS.filter((p) => p.group === group).map((p) => (
            <label key={p.code} className="block text-[12px] text-slate-500">
              {p.name} · เกณฑ์ {limitText(p)}
              <Input type="number" value={values[p.code] ?? ""} onChange={(x) => setValues((s) => ({ ...s, [p.code]: x }))} />
            </label>
          ))}
        </div>
      </Field>
      <Actions onCancel={onCancel} label="บันทึกผลตรวจวัด" />
    </Form>
  );
}

function DrillForm({ plan: initial, onCancel, onDone }: { plan?: string; onCancel: () => void; onDone: () => void }) {
  const [v, setV] = useState({ plan: initial ?? PLANS[0].code, date: TODAY, participants: "", minutes: "", result: "ผ่าน" as Drill["result"], findings: "", improvement: "", by: EMR });
  const [tried, setTried] = useState(false);
  const input = { ...v, participants: Number(v.participants), minutes: Number(v.minutes) };
  const errors = tried ? drillErrors(input) : {};
  const set = (k: keyof typeof v) => (x: string) => setV((s) => ({ ...s, [k]: x }));
  return (
    <Form onSubmit={() => { setTried(true); if (Object.keys(drillErrors(input)).length) return; const d = recordDrill(input); notify(`บันทึกการซ้อม ${d.no} แล้ว`); onDone(); }}>
      <Field label="แผนที่ซ้อม" error={errors.plan}><Choice value={v.plan} onChange={set("plan")} options={PLANS.map((p) => ({ value: p.code, label: `${p.code} · ${p.scenario}` }))} /></Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="วันที่" error={errors.date}><Input type="date" value={v.date} onChange={set("date")} error={errors.date} /></Field>
        <Field label="ผู้เข้าร่วม (คน)" error={errors.participants}><Input type="number" value={v.participants} onChange={set("participants")} error={errors.participants} /></Field>
        <Field label="เวลาที่ใช้ (นาที)" error={errors.minutes}><Input type="number" value={v.minutes} onChange={set("minutes")} error={errors.minutes} /></Field>
      </div>
      <Field label="สิ่งที่พบ" error={errors.findings}><Area value={v.findings} onChange={set("findings")} error={errors.findings} /></Field>
      <Field label="ผลการซ้อม"><Segmented options={["ผ่าน", "ต้องปรับปรุง"]} value={v.result} onChange={set("result")} /></Field>
      {v.result === "ต้องปรับปรุง" && <Field label="สิ่งที่จะปรับปรุง" error={errors.improvement}><Area value={v.improvement} onChange={set("improvement")} error={errors.improvement} rows={2} /></Field>}
      <Field label="ผู้บันทึก" error={errors.by}><Choice value={v.by} onChange={set("by")} options={people()} /></Field>
      <Actions onCancel={onCancel} label="บันทึกการซ้อม" />
    </Form>
  );
}

function IncidentForm({ plan, onCancel, onDone }: { plan?: string; onCancel: () => void; onDone: (no: string) => void }) {
  const [v, setV] = useState({ date: TODAY, plan: plan ?? "", description: "", impact: "", containment: "", severity: "ปานกลาง" as Incident["severity"] });
  const [tried, setTried] = useState(false);
  const input = { ...v, plan: v.plan || undefined };
  const errors = tried ? incidentErrors(input) : {};
  const set = (k: keyof typeof v) => (x: string) => setV((s) => ({ ...s, [k]: x }));
  return (
    <Form onSubmit={() => { setTried(true); if (Object.keys(incidentErrors(input)).length) return; const { incident, car } = reportIncident(input); notify(`บันทึกอุบัติการณ์ ${incident.no} แล้ว · เปิด ${car.no} ให้หาสาเหตุ`, "warn"); onDone(incident.no); }}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="วันที่เกิดเหตุ" error={errors.date}><Input type="date" value={v.date} onChange={set("date")} error={errors.date} /></Field>
        <Field label="ตามแผนฉุกเฉิน"><Choice value={v.plan} onChange={set("plan")} placeholder="ไม่อยู่ในแผน" options={PLANS.map((p) => ({ value: p.code, label: `${p.code} · ${p.scenario}` }))} /></Field>
      </div>
      <Field label="เกิดอะไรขึ้น" error={errors.description}><Area value={v.description} onChange={set("description")} error={errors.description} rows={2} /></Field>
      <Field label="ผลกระทบต่อสิ่งแวดล้อม" error={errors.impact}><Input value={v.impact} onChange={set("impact")} error={errors.impact} /></Field>
      <Field label="การควบคุมเหตุที่ทำไปแล้ว" error={errors.containment}><Area value={v.containment} onChange={set("containment")} error={errors.containment} rows={2} /></Field>
      <Field label="ความรุนแรง" hint={v.severity === "รุนแรง" ? "เหตุรุนแรงต้องรายงานหน่วยงานรัฐก่อนปิด" : undefined}><Segmented options={["รุนแรง", "ปานกลาง", "เล็กน้อย"]} value={v.severity} onChange={set("severity")} /></Field>
      <Actions onCancel={onCancel} label="บันทึกอุบัติการณ์" />
    </Form>
  );
}

function TextForm({ label, hint, button, submit, onCancel, onDone, type = "text" }: { label: string; hint?: string; button: string; submit: (text: string) => void; onCancel: () => void; onDone: () => void; type?: string }) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  return (
    <Form error={error} onSubmit={() => tryRun(() => { submit(text); onDone(); }, setError)}>
      <Field label={label} hint={hint}><Input type={type} value={text} onChange={setText} /></Field>
      <Actions onCancel={onCancel} label={button} />
    </Form>
  );
}

export function EmActions({ act, onAct, onOpen }: { act: Act | null; onAct: (a: Act | null) => void; onOpen: (kind: RecordKind, key: string) => void }) {
  useData();
  const close = () => onAct(null);
  const pick = <K extends Act["kind"]>(kind: K) => (act?.kind === kind ? (act as Of<K>) : null);
  const evaluate = pick("obligation-evaluate");
  const generate = pick("waste-generate");
  const dispose = pick("waste-dispose");
  const cert = pick("waste-certificate");
  const sds = pick("sds-update");
  const monitoring = pick("monitoring-new");
  const drill = pick("drill-new");
  const incident = pick("incident-new");
  const reported = pick("incident-report");
  const incClose = pick("incident-close");
  const print = pick("print");
  const closeProblem = incClose ? closeIncidentErrors(incClose.no).close : undefined;

  return (
    <>
      <FormModal open={act?.kind === "aspect-new"} title="เพิ่มประเด็นสิ่งแวดล้อม" subtitle="ประเมินทั้งสภาวะปกติ ไม่ปกติ ฉุกเฉิน และมุมมองวัฏจักรชีวิต (ข้อ 6.1.2)" onClose={close}>
        {act?.kind === "aspect-new" && <AspectForm onCancel={close} onDone={(no) => { close(); onOpen("aspect", no); }} />}
      </FormModal>
      <FormModal open={act?.kind === "obligation-new"} title="เพิ่มกฎหมายหรือพันธะ" subtitle="ข้อ 6.1.3" onClose={close}>
        {act?.kind === "obligation-new" && <ObligationForm onCancel={close} onDone={(no) => { close(); onOpen("obligation", no); }} />}
      </FormModal>
      <FormModal open={evaluate !== null} title="ประเมินความสอดคล้อง" subtitle={evaluate ? `${evaluate.no} · ข้อ 9.1.2` : undefined} onClose={close}>
        {evaluate && <EvaluateForm key={evaluate.no} no={evaluate.no} onCancel={close} onDone={close} />}
      </FormModal>
      <FormModal open={generate !== null} title="บันทึกของเสียเข้าบัญชี" subtitle="ชั่งน้ำหนักจริง ทั้งรอบเก็บรวบรวมและของที่คลังวัสดุตัดเป็นของเสีย" onClose={close} size="sm">
        {generate && <GenerationForm source={generate.source} onCancel={close} onDone={close} />}
      </FormModal>
      <FormModal open={dispose !== null} title="ส่งของเสียกำจัด" subtitle="ผู้รับกำจัดต้องได้รับอนุญาตและใบอนุญาตยังไม่หมดอายุ" onClose={close}>
        {dispose && <DisposalForm type={dispose.type} onCancel={close} onDone={close} />}
      </FormModal>
      <FormModal open={cert !== null} title="บันทึกใบรับรองการกำจัด" subtitle={cert?.no} onClose={close} size="sm">
        {cert && <TextForm key={cert.no} label={`เลขใบรับรองการกำจัด · ${disposalByNo(cert.no).receiver}`} button="บันทึก" onCancel={close} onDone={close} submit={(t) => { recordCertificate(cert.no, t); notify(`บันทึกใบรับรองของ ${cert.no} แล้ว`); }} />}
      </FormModal>
      <FormModal open={sds !== null} title="ปรับปรุง SDS" subtitle={sds ? chemicalByCode(sds.code).name : undefined} onClose={close} size="sm">
        {sds && <TextForm key={sds.code} type="date" label="วันที่ของ SDS ฉบับใหม่" hint="ต้องใหม่กว่าฉบับเดิม" button="บันทึก SDS ฉบับใหม่" onCancel={close} onDone={close} submit={(t) => { updateSds(sds.code, t); notify(`ปรับปรุง SDS ${sds.code} แล้ว`); }} />}
      </FormModal>
      <FormModal open={monitoring !== null} title="บันทึกผลตรวจวัดสิ่งแวดล้อม" subtitle="เกินค่ามาตรฐานข้อใดจะเปิด CAR ให้เอง (ข้อ 9.1.1)" onClose={close}>
        {monitoring && <MonitoringForm group={monitoring.group} onCancel={close} onDone={(no) => { close(); onOpen("monitoring", no); }} />}
      </FormModal>
      <FormModal open={drill !== null} title="บันทึกการฝึกซ้อมแผนฉุกเฉิน" subtitle="ข้อ 8.2" onClose={close}>
        {drill && <DrillForm plan={drill.plan} onCancel={close} onDone={close} />}
      </FormModal>
      <FormModal open={incident !== null} title="บันทึกอุบัติการณ์สิ่งแวดล้อม" subtitle="ระบบเปิด CAR ให้หาสาเหตุทุกครั้ง (ข้อ 10.2)" onClose={close}>
        {incident && <IncidentForm plan={incident.plan} onCancel={close} onDone={(no) => { close(); onOpen("incident", no); }} />}
      </FormModal>
      <FormModal open={reported !== null} title="บันทึกการรายงานหน่วยงานรัฐ" subtitle={reported?.no} onClose={close} size="sm">
        {reported && <TextForm key={reported.no} label="รายงานหน่วยงานไหน เมื่อไร อย่างไร" button="บันทึก" onCancel={close} onDone={close} submit={(t) => { markReported(reported.no, t); notify(`บันทึกการรายงานของ ${reported.no} แล้ว`); }} />}
      </FormModal>
      <ConfirmDialog
        open={incClose !== null}
        title="ปิดอุบัติการณ์"
        body={closeProblem ?? "รายงานครบและ CAR ปิดแล้ว"}
        subject={incClose ? <Badge tone="warn">{incClose.no}</Badge> : undefined}
        confirmLabel="ปิดอุบัติการณ์"
        disabled={!!closeProblem}
        onCancel={close}
        onConfirm={() => { if (!incClose) return; closeIncident(incClose.no); notify(`ปิด ${incClose.no} แล้ว`); close(); }}
      />
      <FormModal open={print !== null} title={print?.title ?? ""} subtitle="ตัวอย่างก่อนพิมพ์ — กระดาษ A4 พิมพ์เฉพาะเอกสาร" onClose={close} size="lg">
        {print && (
          <div className="space-y-3">
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={close}>ปิด</Button>
              <Button icon={<Printer size={14} />} onClick={printDocument}>พิมพ์</Button>
            </div>
            <EmPaper d={print.d} />
          </div>
        )}
      </FormModal>
    </>
  );
}
