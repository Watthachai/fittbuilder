import { useState } from "react";
import { Printer, Plus, Trash2 } from "lucide-react";
import {
  ACTION_TYPES, AUDIT_TYPES, CAUSE_CATEGORIES, COURSES, DEPARTMENTS, DOC_LEVELS, FINDING_TYPES, METHODS, PESTEL, PEOPLE, QMR,
  STANDARDS, SWOT, TODAY, TOP, TREATMENTS, actionErrors, addCapaAction, addFinding, addIssue, addObjective, addParty, addRisk,
  addRiskTask, approveDocument, auditByNo, auditErrors, auditorNeeds, capaByNo, capaErrors, clausesOf, closeAudit,
  closeAuditErrors, confirmContext, courseName, createDocument, docByCode, docErrors, evaluateTraining, findingErrors,
  issueErrors, levelOf, minutesErrors, nextDocCode, objectiveById, objectiveErrors, obsoleteDocument, partyErrors, planAudit,
  planReview, planTraining, policyByCode, reassessErrors, reassessRisk, recordContainment, recordMinutes, recordObjectiveResult,
  recordPrevention, recordRootCause, recordTraining, recordTrainingErrors, resultErrors, returnDocument, reviewByNo,
  reviseDocument, revisePolicy, revLabel, riskByNo, riskErrors, rootCauseErrors, score, taskErrors, trainingByNo,
  trainingErrors, verifyCapa, verifyCapaErrors, acknowledgePolicy, openCapa,
} from "./data";
import type {
  ActionType, AuditType, CauseCategory, CourseCode, Department, DocLevel, FindingType, Lens, Method, ReviewOutput, RiskKind,
  Standard, SwotKind, Treatment,
} from "./data";
import { ImsPaper } from "./documents";
import type { ImsDoc } from "./documents";
import { Actions, Area, Checks, Choice, Form, Input, people, tryRun } from "./parts";
import { Badge, Button, Note, Segmented } from "../ui";
import { ConfirmDialog, Field, FormModal, notify, printDocument, useData } from "../kit";

/** ทุกการกระทำของระบบบริหารบูรณาการ ยกขึ้นแบบเดียวกันจากทุกหน้า */
export type Act =
  | { kind: "issue-new" }
  | { kind: "party-new" }
  | { kind: "context-confirm" }
  | { kind: "risk-new" }
  | { kind: "risk-task"; no: string }
  | { kind: "risk-reassess"; no: string }
  | { kind: "policy-revise"; code: string }
  | { kind: "policy-ack"; code: string }
  | { kind: "objective-new" }
  | { kind: "objective-result"; id: number }
  | { kind: "doc-new" }
  | { kind: "doc-revise"; code: string }
  | { kind: "doc-approve"; code: string }
  | { kind: "doc-obsolete"; code: string }
  | { kind: "training-new"; course?: CourseCode; attendees?: string[] }
  | { kind: "training-record"; no: string }
  | { kind: "training-evaluate"; no: string }
  | { kind: "audit-new" }
  | { kind: "audit-finding"; no: string }
  | { kind: "audit-close"; no: string }
  | { kind: "car-new"; ref?: string; problem?: string; method?: Method; std?: Standard }
  | { kind: "car-containment"; no: string }
  | { kind: "car-cause"; no: string }
  | { kind: "car-action"; no: string }
  | { kind: "car-prevention"; no: string }
  | { kind: "car-verify"; no: string }
  | { kind: "review-minutes"; no: string }
  | { kind: "review-plan" }
  | { kind: "print"; d: ImsDoc; title: string };

type Of<K extends Act["kind"]> = Extract<Act, { kind: K }>;
export type RecordKind = "doc" | "risk" | "objective" | "person" | "training" | "audit" | "car" | "review";

const n1to5 = [1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) }));

/* --------------------------------------------------------------- context */

function IssueForm({ onCancel, onDone }: { onCancel: () => void; onDone: () => void }) {
  const [kind, setKind] = useState<SwotKind>("โอกาส");
  const [lens, setLens] = useState<Lens>("เศรษฐกิจ");
  const [text, setText] = useState("");
  const [standards, setStandards] = useState<Standard[]>(["ISO 9001"]);
  const [tried, setTried] = useState(false);
  const external = kind === "โอกาส" || kind === "อุปสรรค";
  const input = { kind, lens: external ? lens : undefined, text, standards };
  const errors = tried ? issueErrors(input) : {};
  return (
    <Form onSubmit={() => { setTried(true); if (Object.keys(issueErrors(input)).length) return; addIssue(input); notify(`เพิ่ม${kind}ในบริบทองค์กรแล้ว`); onDone(); }}>
      <Field label="ประเภท"><Segmented options={SWOT} value={kind} onChange={(v) => setKind(v as SwotKind)} /></Field>
      {external && <Field label="มุมมอง (PESTEL)" error={errors.lens}><Choice value={lens} onChange={(v) => setLens(v as Lens)} options={PESTEL} /></Field>}
      <Field label="ประเด็น" error={errors.text}><Area value={text} onChange={setText} error={errors.text} /></Field>
      <Field label="มาตรฐานที่เกี่ยวข้อง" error={errors.standards}><Checks options={STANDARDS} value={standards} onChange={setStandards} columns={3} /></Field>
      <Actions onCancel={onCancel} label="เพิ่มประเด็น" />
    </Form>
  );
}

function PartyForm({ onCancel, onDone }: { onCancel: () => void; onDone: () => void }) {
  const [v, setV] = useState({ name: "", needs: "", how: "" });
  const [standards, setStandards] = useState<Standard[]>(["ISO 9001"]);
  const [tried, setTried] = useState(false);
  const input = { ...v, standards };
  const errors = tried ? partyErrors(input) : {};
  const set = (k: keyof typeof v) => (x: string) => setV((s) => ({ ...s, [k]: x }));
  return (
    <Form onSubmit={() => { setTried(true); if (Object.keys(partyErrors(input)).length) return; addParty(input); notify(`เพิ่ม ${v.name} ในทะเบียนผู้มีส่วนได้ส่วนเสียแล้ว`); onDone(); }}>
      <Field label="ผู้มีส่วนได้ส่วนเสีย" error={errors.name}><Input value={v.name} onChange={set("name")} error={errors.name} placeholder="เช่น บริษัทประกันภัย" /></Field>
      <Field label="เขาต้องการอะไรจากเรา" error={errors.needs}><Area value={v.needs} onChange={set("needs")} error={errors.needs} rows={2} /></Field>
      <Field label="เราตอบสนองและติดตามอย่างไร" error={errors.how}><Area value={v.how} onChange={set("how")} error={errors.how} rows={2} /></Field>
      <Field label="มาตรฐานที่เกี่ยวข้อง" error={errors.standards}><Checks options={STANDARDS} value={standards} onChange={setStandards} columns={3} /></Field>
      <Actions onCancel={onCancel} label="เพิ่มในทะเบียน" />
    </Form>
  );
}

/* ------------------------------------------------------------------ risk */

function RiskForm({ onCancel, onDone }: { onCancel: () => void; onDone: (no: string) => void }) {
  const [kind, setKind] = useState<RiskKind>("ความเสี่ยง");
  const [standards, setStandards] = useState<Standard[]>(["ISO 9001"]);
  const [process, setProcess] = useState("");
  const [description, setDescription] = useState("");
  const [likelihood, setLikelihood] = useState(3);
  const [impact, setImpact] = useState(3);
  const [treatment, setTreatment] = useState<Treatment>("ลดความเสี่ยง");
  const [owner, setOwner] = useState(QMR);
  const [tried, setTried] = useState(false);
  const input = { kind, standards, process, description, likelihood, impact, treatment: kind === "โอกาส" ? "ใช้โอกาส" as Treatment : treatment, owner };
  const errors = tried ? riskErrors(input) : {};
  const s = score({ likelihood, impact });
  return (
    <Form onSubmit={() => { setTried(true); if (Object.keys(riskErrors(input)).length) return; const r = addRisk(input); notify(`เพิ่ม ${r.no} แล้ว · ระดับ${levelOf(s)}`); onDone(r.no); }}>
      <Field label="ประเภท"><Segmented options={["ความเสี่ยง", "โอกาส"]} value={kind} onChange={(v) => setKind(v as RiskKind)} /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="กระบวนการ" error={errors.process}><Input value={process} onChange={setProcess} error={errors.process} placeholder="เช่น การจัดซื้อ" /></Field>
        <Field label="เจ้าของ" error={errors.owner}><Choice value={owner} onChange={setOwner} options={people()} /></Field>
      </div>
      <Field label="เรื่อง" error={errors.description}><Area value={description} onChange={setDescription} error={errors.description} rows={2} /></Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="โอกาสเกิด (1–5)" error={errors.likelihood}><Choice value={String(likelihood)} onChange={(v) => setLikelihood(Number(v))} options={n1to5} /></Field>
        <Field label="ผลกระทบ (1–5)" error={errors.impact}><Choice value={String(impact)} onChange={(v) => setImpact(Number(v))} options={n1to5} /></Field>
        <Field label="คะแนน"><div className="flex h-9 items-center gap-2"><span className="text-[15px] font-semibold tabular-nums">{s}</span><Badge tone={levelOf(s) === "สูง" ? "bad" : levelOf(s) === "กลาง" ? "warn" : "ok"}>{levelOf(s)}</Badge></div></Field>
      </div>
      {kind === "ความเสี่ยง" && <Field label="การจัดการ" error={errors.treatment}><Choice value={treatment} onChange={(v) => setTreatment(v as Treatment)} options={TREATMENTS.filter((t) => t !== "ใช้โอกาส")} error={errors.treatment} /></Field>}
      <Field label="มาตรฐานที่เกี่ยวข้อง" error={errors.standards}><Checks options={STANDARDS} value={standards} onChange={setStandards} columns={3} /></Field>
      <Actions onCancel={onCancel} label="เพิ่มในทะเบียน" />
    </Form>
  );
}

function TaskForm({ owner: initial, onSubmit, onCancel, label }: { owner: string; onSubmit: (t: { what: string; owner: string; due: string }) => void; onCancel: () => void; label: string }) {
  const [what, setWhat] = useState("");
  const [owner, setOwner] = useState(initial);
  const [due, setDue] = useState("");
  const [tried, setTried] = useState(false);
  const input = { what, owner, due };
  const errors = tried ? taskErrors(input) : {};
  return (
    <Form onSubmit={() => { setTried(true); if (Object.keys(taskErrors(input)).length) return; onSubmit(input); }}>
      <Field label="มาตรการ" error={errors.what}><Area value={what} onChange={setWhat} error={errors.what} rows={2} /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="ผู้รับผิดชอบ" error={errors.owner}><Choice value={owner} onChange={setOwner} options={people()} /></Field>
        <Field label="กำหนดเสร็จ" error={errors.due}><Input type="date" value={due} onChange={setDue} error={errors.due} /></Field>
      </div>
      <Actions onCancel={onCancel} label={label} />
    </Form>
  );
}

function ReassessForm({ no, onCancel, onDone }: { no: string; onCancel: () => void; onDone: () => void }) {
  const r = riskByNo(no);
  const [likelihood, setLikelihood] = useState(r.residual?.likelihood ?? r.likelihood);
  const [impact, setImpact] = useState(r.residual?.impact ?? r.impact);
  const [tried, setTried] = useState(false);
  const errors = tried ? reassessErrors(no, { likelihood, impact }) : {};
  const s = score({ likelihood, impact });
  return (
    <Form onSubmit={() => { setTried(true); if (Object.keys(reassessErrors(no, { likelihood, impact })).length) return; reassessRisk(no, { likelihood, impact }); notify(`ประเมิน ${no} ซ้ำแล้ว · คงเหลือ ${s} ระดับ${levelOf(s)}`); onDone(); }}>
      <p className="text-[13px] text-slate-600 dark:text-slate-300">ก่อนมาตรการ {score(r)} ({r.likelihood}×{r.impact}) ระดับ{levelOf(score(r))}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="โอกาสเกิดหลังมาตรการ" error={errors.likelihood}><Choice value={String(likelihood)} onChange={(v) => setLikelihood(Number(v))} options={n1to5} /></Field>
        <Field label="ผลกระทบหลังมาตรการ" error={errors.impact}><Choice value={String(impact)} onChange={(v) => setImpact(Number(v))} options={n1to5} /></Field>
      </div>
      <Note tone={levelOf(s) === "สูง" ? "bad" : levelOf(s) === "กลาง" ? "warn" : "ok"}>คงเหลือ {s} ระดับ{levelOf(s)}</Note>
      <Actions onCancel={onCancel} label="บันทึกผลประเมินซ้ำ" />
    </Form>
  );
}

/* ---------------------------------------------------- policy, objectives */

function PolicyForm({ code, onCancel, onDone }: { code: string; onCancel: () => void; onDone: () => void }) {
  const p = policyByCode(code);
  const [text, setText] = useState(p.text.join("\n"));
  const [by, setBy] = useState(TOP);
  const [error, setError] = useState("");
  return (
    <Form error={error} onSubmit={() => tryRun(() => { const x = revisePolicy(code, text.split("\n"), by); notify(`ออก${x.title} ฉบับที่ ${x.rev} แล้ว · ทุกคนต้องรับทราบใหม่`); onDone(); }, setError)}>
      <Note tone="info">ออกฉบับใหม่แล้วการรับทราบเริ่มนับใหม่ทั้งหมด (ข้อ 7.3)</Note>
      <Field label="ข้อความนโยบาย" hint="หนึ่งบรรทัดต่อหนึ่งข้อ"><Area value={text} onChange={setText} rows={6} /></Field>
      <Field label="ผู้อนุมัติ" hint="นโยบายอนุมัติได้เฉพาะผู้บริหารสูงสุด"><Choice value={by} onChange={setBy} options={people()} /></Field>
      <Actions onCancel={onCancel} label={`ออกฉบับที่ ${p.rev + 1}`} />
    </Form>
  );
}

function AckForm({ code, onCancel, onDone }: { code: string; onCancel: () => void; onDone: () => void }) {
  const p = policyByCode(code);
  const pending = PEOPLE.filter((n) => !p.acknowledged.includes(n));
  const [name, setName] = useState(pending[0] ?? "");
  const [error, setError] = useState("");
  if (pending.length === 0) return <Note tone="ok">ทุกคนรับทราบ{p.title}ฉบับนี้แล้ว</Note>;
  return (
    <Form error={error} onSubmit={() => tryRun(() => { acknowledgePolicy(code, name); notify(`${name} รับทราบ${p.title}แล้ว`); onDone(); }, setError)}>
      <Field label="ผู้รับทราบ" hint={`ยังไม่รับทราบ ${pending.length} คน`}><Choice value={name} onChange={setName} options={people((x) => pending.includes(x.name))} /></Field>
      <Actions onCancel={onCancel} label="บันทึกการรับทราบ" />
    </Form>
  );
}

function ObjectiveForm({ onCancel, onDone }: { onCancel: () => void; onDone: (id: number) => void }) {
  const [std, setStd] = useState<Standard>("ISO 9001");
  const [dept, setDept] = useState<Department>("ฝ่ายผลิต");
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [unit, setUnit] = useState("%");
  const [better, setBetter] = useState<"higher" | "lower">("higher");
  const [plan, setPlan] = useState("");
  const [owner, setOwner] = useState("อนุชา ทองดี");
  const [tried, setTried] = useState(false);
  const input = { std, dept, name, target: Number(target), unit, better, plan, owner };
  const errors = tried ? objectiveErrors(input) : {};
  return (
    <Form onSubmit={() => { setTried(true); if (Object.keys(objectiveErrors(input)).length) return; const o = addObjective(input); notify(`ตั้งวัตถุประสงค์ ${o.name} แล้ว`); onDone(o.id); }}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="มาตรฐาน"><Choice value={std} onChange={(v) => setStd(v as Standard)} options={STANDARDS} /></Field>
        <Field label="ฝ่าย"><Choice value={dept} onChange={(v) => setDept(v as Department)} options={DEPARTMENTS} /></Field>
      </div>
      <Field label="สิ่งที่วัด" error={errors.name}><Input value={name} onChange={setName} error={errors.name} placeholder="เช่น เวลาตอบข้อร้องเรียนลูกค้า" /></Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="เป้าหมาย" error={errors.target}><Input type="number" value={target} onChange={setTarget} error={errors.target} /></Field>
        <Field label="หน่วย" error={errors.unit}><Input value={unit} onChange={setUnit} error={errors.unit} /></Field>
        <Field label="ทิศทาง"><Segmented options={["ยิ่งมากยิ่งดี", "ยิ่งน้อยยิ่งดี"]} value={better === "higher" ? "ยิ่งมากยิ่งดี" : "ยิ่งน้อยยิ่งดี"} onChange={(v) => setBetter(v === "ยิ่งมากยิ่งดี" ? "higher" : "lower")} /></Field>
      </div>
      <Field label="แผนบรรลุ" error={errors.plan} hint="ทำอะไร ใช้ทรัพยากรอะไร เสร็จเมื่อไร ประเมินผลอย่างไร (ข้อ 6.2.2)"><Area value={plan} onChange={setPlan} error={errors.plan} rows={2} /></Field>
      <Field label="ผู้รับผิดชอบ" error={errors.owner}><Choice value={owner} onChange={setOwner} options={people()} /></Field>
      <Actions onCancel={onCancel} label="ตั้งวัตถุประสงค์" />
    </Form>
  );
}

function ResultForm({ id, onCancel, onDone }: { id: number; onCancel: () => void; onDone: () => void }) {
  const o = objectiveById(id);
  const [month, setMonth] = useState(TODAY.slice(0, 7));
  const [value, setValue] = useState("");
  const [tried, setTried] = useState(false);
  const input = { month, value: value === "" ? NaN : Number(value) };
  const errors = tried ? resultErrors(id, input) : {};
  return (
    <Form onSubmit={() => { setTried(true); if (Object.keys(resultErrors(id, input)).length) return; recordObjectiveResult(id, input); notify(`บันทึกผล ${o.name} เดือน ${month} แล้ว`); onDone(); }}>
      <p className="text-[13px] text-slate-600 dark:text-slate-300">เป้า {o.better === "higher" ? "≥" : "≤"} {o.target} {o.unit}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="เดือน" error={errors.month}><Input type="month" value={month} onChange={setMonth} error={errors.month} /></Field>
        <Field label={`ผลที่วัดได้ (${o.unit})`} error={errors.value}><Input type="number" value={value} onChange={setValue} error={errors.value} /></Field>
      </div>
      <Actions onCancel={onCancel} label="บันทึกผล" />
    </Form>
  );
}

/* ------------------------------------------------------------- documents */

function DocForm({ onCancel, onDone }: { onCancel: () => void; onDone: (code: string) => void }) {
  const [level, setLevel] = useState<DocLevel>("ระเบียบปฏิบัติ");
  const [title, setTitle] = useState("");
  const [standards, setStandards] = useState<Standard[]>(["ISO 9001"]);
  const [owner, setOwner] = useState<Department>("ฝ่ายประกันคุณภาพ");
  const [by, setBy] = useState("สุภาพร แก้วมณี");
  const [change, setChange] = useState("");
  const [tried, setTried] = useState(false);
  const input = { level, title, standards, owner, by, change };
  const errors = tried ? docErrors(input) : {};
  return (
    <Form onSubmit={() => { setTried(true); if (Object.keys(docErrors(input)).length) return; const d = createDocument(input); notify(`สร้างร่างเอกสาร ${d.code} แล้ว · ส่งอนุมัติเมื่อเขียนเสร็จ`); onDone(d.code); }}>
      <Field label="ระดับเอกสาร" hint={`รหัสที่จะได้ ${nextDocCode(level)}`}>
        <Segmented options={DOC_LEVELS} value={level} onChange={(v) => setLevel(v as DocLevel)} />
      </Field>
      <Field label="ชื่อเอกสาร" error={errors.title}><Input value={title} onChange={setTitle} error={errors.title} placeholder="เช่น การจัดการข้อร้องเรียนลูกค้า" /></Field>
      <Field label="ใช้กับมาตรฐาน" error={errors.standards} hint="ระเบียบกลางเลือกได้หลายมาตรฐาน"><Checks options={STANDARDS} value={standards} onChange={setStandards} columns={3} /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="ฝ่ายเจ้าของ" error={errors.owner}><Choice value={owner} onChange={(v) => setOwner(v as Department)} options={DEPARTMENTS} /></Field>
        <Field label="ผู้จัดทำ" error={errors.by}><Choice value={by} onChange={setBy} options={people()} /></Field>
      </div>
      <Field label="รายละเอียดการออกใช้" hint="ว่างไว้จะบันทึกเป็น “ออกใช้ครั้งแรก”"><Input value={change} onChange={setChange} placeholder="ออกใช้ครั้งแรก" /></Field>
      <Actions onCancel={onCancel} label="สร้างร่างเอกสาร" />
    </Form>
  );
}

function ReviseForm({ code, onCancel, onDone }: { code: string; onCancel: () => void; onDone: () => void }) {
  const d = docByCode(code);
  const [change, setChange] = useState("");
  const [by, setBy] = useState("สุภาพร แก้วมณี");
  const [error, setError] = useState("");
  return (
    <Form error={error} onSubmit={() => tryRun(() => { reviseDocument(code, change, by); notify(`เปิดฉบับแก้ไข ${code} ${revLabel(d.rev + 1)} แล้ว · ฉบับ ${revLabel(d.rev)} ยังใช้อยู่จนกว่าจะอนุมัติ`); onDone(); }, setError)}>
      <Note tone="info">ฉบับที่ใช้อยู่ ({revLabel(d.rev)}) ใช้ต่อที่หน้างานจนกว่าฉบับใหม่จะได้รับอนุมัติ</Note>
      <Field label="แก้อะไร"><Area value={change} onChange={setChange} placeholder="เช่น เพิ่มขั้นตอนประเมินผู้ขายใหม่" /></Field>
      <Field label="ผู้จัดทำ"><Choice value={by} onChange={setBy} options={people()} /></Field>
      <Actions onCancel={onCancel} label={`เปิดฉบับ ${revLabel(d.rev + 1)}`} />
    </Form>
  );
}

function ApproveForm({ code, onCancel, onDone }: { code: string; onCancel: () => void; onDone: () => void }) {
  const d = docByCode(code);
  const [approver, setApprover] = useState(d.level === "คู่มือระบบ" ? TOP : QMR);
  const [error, setError] = useState("");
  if (!d.draft) return <Note tone="idle">ไม่มีฉบับที่รออนุมัติ</Note>;
  const draft = d.draft;
  return (
    <Form error={error} onSubmit={() => tryRun(() => { approveDocument(code, approver); notify(`อนุมัติ ${code} ${revLabel(draft.rev)} แล้ว · มีผลวันนี้`); onDone(); }, setError)}>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px]">
        <dt className="text-slate-500">ฉบับ</dt><dd>{revLabel(draft.rev)}</dd>
        <dt className="text-slate-500">รายละเอียด</dt><dd>{draft.change}</dd>
        <dt className="text-slate-500">ผู้จัดทำ</dt><dd>{draft.by} · {draft.date}</dd>
      </dl>
      <Field label="ผู้อนุมัติ" hint={d.level === "คู่มือระบบ" ? "คู่มือระบบอนุมัติโดยผู้บริหารสูงสุด" : "ต้องไม่ใช่ผู้จัดทำ"}><Choice value={approver} onChange={setApprover} options={people()} /></Field>
      <div className="flex justify-between gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
        <Button variant="ghost" onClick={() => tryRun(() => { returnDocument(code); notify(`ส่ง ${code} กลับไปแก้แล้ว`, "info"); onDone(); }, setError)}>ส่งกลับไปแก้</Button>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onCancel}>ยกเลิก</Button>
          <Button type="submit">อนุมัติและออกใช้</Button>
        </div>
      </div>
    </Form>
  );
}

/* -------------------------------------------------------------- training */

function TrainingForm({ course: initial, attendees: invited, onCancel, onDone }: { course?: CourseCode; attendees?: string[]; onCancel: () => void; onDone: (no: string) => void }) {
  const [course, setCourse] = useState<CourseCode>(initial ?? "TR-10");
  const [date, setDate] = useState("");
  const [hours, setHours] = useState("3");
  const [trainer, setTrainer] = useState("");
  const [attendees, setAttendees] = useState<string[]>(invited ?? []);
  const [tried, setTried] = useState(false);
  const input = { course, date, hours: Number(hours), trainer, attendees };
  const errors = tried ? trainingErrors(input) : {};
  return (
    <Form onSubmit={() => { setTried(true); if (Object.keys(trainingErrors(input)).length) return; const t = planTraining(input); notify(`วางแผนอบรม ${t.no} วันที่ ${date} แล้ว · ${attendees.length} คน`); onDone(t.no); }}>
      <Field label="หลักสูตร" error={errors.course}><Choice value={course} onChange={(v) => setCourse(v as CourseCode)} options={COURSES.map((c) => ({ value: c.code, label: `${c.code} · ${c.name}` }))} /></Field>
      <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
        <Field label="วันที่อบรม" error={errors.date}><Input type="date" value={date} onChange={setDate} error={errors.date} /></Field>
        <Field label="ชั่วโมง" error={errors.hours}><Input type="number" value={hours} onChange={setHours} error={errors.hours} /></Field>
      </div>
      <Field label="วิทยากรหรือสถาบัน" error={errors.trainer}><Input value={trainer} onChange={setTrainer} error={errors.trainer} /></Field>
      <Field label="ผู้เข้าอบรม" error={errors.attendees}><Checks options={PEOPLE} value={attendees} onChange={setAttendees} /></Field>
      <Actions onCancel={onCancel} label="วางแผนอบรม" />
    </Form>
  );
}

function RecordTrainingForm({ no, onCancel, onDone }: { no: string; onCancel: () => void; onDone: () => void }) {
  const t = trainingByNo(no);
  const [results, setResults] = useState<Record<string, "ผ่าน" | "ไม่ผ่าน" | undefined>>(() => Object.fromEntries(t.attendees.map((a) => [a.name, "ผ่าน" as const])));
  const [tried, setTried] = useState(false);
  const errors = tried ? recordTrainingErrors(no, results) : {};
  return (
    <Form error={errors.results} onSubmit={() => { setTried(true); if (Object.keys(recordTrainingErrors(no, results)).length) return; recordTraining(no, results); const passed = Object.values(results).filter((r) => r === "ผ่าน").length; notify(`บันทึกผล ${no} แล้ว · ผ่าน ${passed} จาก ${t.attendees.length} คน`); onDone(); }}>
      <p className="text-[13px] text-slate-600 dark:text-slate-300">{courseName(t.course)} · {t.date} · {t.trainer}</p>
      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
        {t.attendees.map((a) => (
          <li key={a.name} className="flex items-center justify-between gap-3 px-3 py-2 text-[13px]">
            <span>{a.name}</span>
            <Segmented options={["ผ่าน", "ไม่ผ่าน"]} value={results[a.name] ?? "ผ่าน"} onChange={(v) => setResults((s) => ({ ...s, [a.name]: v as "ผ่าน" | "ไม่ผ่าน" }))} />
          </li>
        ))}
      </ul>
      <Actions onCancel={onCancel} label="บันทึกผลอบรม" />
    </Form>
  );
}

function EvaluateForm({ no, onCancel, onDone }: { no: string; onCancel: () => void; onDone: () => void }) {
  const t = trainingByNo(no);
  const [effective, setEffective] = useState("ได้ผล");
  const [note, setNote] = useState("");
  const [by, setBy] = useState(t.trainer === QMR ? "สุภาพร แก้วมณี" : QMR);
  const [error, setError] = useState("");
  return (
    <Form error={error} onSubmit={() => tryRun(() => { evaluateTraining(no, { effective: effective === "ได้ผล", note, by }); notify(`ประเมินประสิทธิผล ${no} แล้ว`); onDone(); }, setError)}>
      <Field label="ผลจากงานจริง"><Segmented options={["ได้ผล", "ไม่ได้ผล"]} value={effective} onChange={setEffective} /></Field>
      <Field label="หลักฐาน" hint="เช่น สุ่มสังเกตการทำงาน 5 ครั้ง ทำถูกวิธีทุกครั้ง"><Area value={note} onChange={setNote} /></Field>
      <Field label="ผู้ประเมิน" hint="หัวหน้างาน ไม่ใช่วิทยากร"><Choice value={by} onChange={setBy} options={people()} /></Field>
      <Actions onCancel={onCancel} label="บันทึกผลประเมิน" />
    </Form>
  );
}

/* ----------------------------------------------------------------- audit */

function AuditForm({ onCancel, onDone }: { onCancel: () => void; onDone: (no: string) => void }) {
  const [type, setType] = useState<AuditType>("ตรวจระบบ");
  const [std, setStd] = useState<Standard>("ISO 9001");
  const [area, setArea] = useState<Department>("ฝ่ายผลิต");
  const [subject, setSubject] = useState("");
  const [clauses, setClauses] = useState<string[]>([]);
  const [auditor, setAuditor] = useState("สุภาพร แก้วมณี");
  const [planned, setPlanned] = useState("");
  const [tried, setTried] = useState(false);
  const input = { type, std, area, subject, clauses, auditor, planned };
  const errors = tried ? auditErrors(input) : {};
  const pool = std === "IATF 16949" ? [...clausesOf("ISO 9001"), ...clausesOf("IATF 16949")] : clausesOf(std);
  return (
    <Form onSubmit={() => { setTried(true); if (Object.keys(auditErrors(input)).length) return; const a = planAudit(input); notify(`วางแผนตรวจ ${a.no} ${area} วันที่ ${planned} แล้ว`); onDone(a.no); }}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="ชนิดการตรวจ" error={errors.type}><Choice value={type} onChange={(v) => setType(v as AuditType)} options={AUDIT_TYPES} error={errors.type} /></Field>
        <Field label="มาตรฐาน"><Choice value={std} onChange={(v) => { setStd(v as Standard); setClauses([]); }} options={STANDARDS} /></Field>
        <Field label="ฝ่ายที่จะตรวจ" error={errors.area}><Choice value={area} onChange={(v) => setArea(v as Department)} options={DEPARTMENTS} /></Field>
        <Field label="วันที่ตรวจ" error={errors.planned}><Input type="date" value={planned} onChange={setPlanned} error={errors.planned} /></Field>
      </div>
      {type !== "ตรวจระบบ" && <Field label={type === "ตรวจกระบวนการ" ? "กระบวนการที่ตรวจ" : "ชิ้นส่วนที่ตรวจ"} error={errors.subject}><Input value={subject} onChange={setSubject} error={errors.subject} /></Field>}
      <Field label="ผู้ตรวจ" error={errors.auditor} hint={`ต้องผ่าน ${auditorNeeds(type, std).map(courseName).join(" + ")} และไม่ตรวจฝ่ายของตัวเอง`}>
        <Choice value={auditor} onChange={setAuditor} options={people()} error={errors.auditor} />
      </Field>
      <Field label="ข้อกำหนดที่จะตรวจ" error={errors.clauses}>
        <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 p-2 dark:border-slate-800">
          <Checks options={pool.map((c) => ({ value: c.id, label: `${c.std === "IATF 16949" ? "IATF " : ""}${c.code} ${c.name}` }))} value={clauses} onChange={setClauses} columns={1} />
        </div>
      </Field>
      <Actions onCancel={onCancel} label="วางแผนการตรวจ" />
    </Form>
  );
}

function FindingForm({ no, onCancel, onDone }: { no: string; onCancel: () => void; onDone: () => void }) {
  const a = auditByNo(no);
  const [clause, setClause] = useState(a.clauses[0] ?? "");
  const [type, setType] = useState<FindingType>("ข้อบกพร่องย่อย");
  const [detail, setDetail] = useState("");
  const [tried, setTried] = useState(false);
  const input = { clause, type, detail };
  const errors = tried ? findingErrors(no, input) : {};
  const pool = a.std === "IATF 16949" ? [...clausesOf("ISO 9001"), ...clausesOf("IATF 16949")] : clausesOf(a.std);
  return (
    <Form onSubmit={() => { setTried(true); if (Object.keys(findingErrors(no, input)).length) return; addFinding(no, input); notify(`บันทึก${type}ใน ${no} แล้ว`, type === "ข้อสังเกต" ? "info" : "warn"); onDone(); }}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="ข้อกำหนด" error={errors.clause}><Choice value={clause} onChange={setClause} options={pool.map((c) => ({ value: c.id, label: `${c.code} ${c.name}` }))} /></Field>
        <Field label="ประเภท"><Choice value={type} onChange={(v) => setType(v as FindingType)} options={FINDING_TYPES} /></Field>
      </div>
      <Field label="สิ่งที่พบและหลักฐาน" error={errors.detail}><Area value={detail} onChange={setDetail} error={errors.detail} /></Field>
      <Actions onCancel={onCancel} label="บันทึกสิ่งที่พบ" />
    </Form>
  );
}

/* ------------------------------------------------------------------ capa */

function CarForm({ refNo, problem: initial, method: m, std: s, onCancel, onDone }: { refNo?: string; problem?: string; method?: Method; std?: Standard; onCancel: () => void; onDone: (no: string) => void }) {
  const [method, setMethod] = useState<Method>(m ?? "5 Why");
  const [std, setStd] = useState<Standard>(s ?? "ISO 9001");
  const [ref, setRef] = useState(refNo ?? "");
  const [problem, setProblem] = useState(initial ?? "");
  const [owner, setOwner] = useState("อนุชา ทองดี");
  const [team, setTeam] = useState<string[]>([]);
  const [tried, setTried] = useState(false);
  const input = { method, std, ref, problem, owner, team };
  const errors = tried ? capaErrors(input) : {};
  return (
    <Form onSubmit={() => { setTried(true); if (Object.keys(capaErrors(input)).length) return; const c = openCapa(input); notify(`ออก ${c.no} ให้ ${owner} แล้ว · ${method === "8D" ? "เริ่มจากกักกันชั่วคราว" : "เริ่มจากหาสาเหตุราก"}`); onDone(c.no); }}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="วิธีแก้ปัญหา" hint={method === "8D" ? "ปัญหาจากลูกค้ายานยนต์ใช้ 8D (IATF 10.2.3)" : undefined}><Segmented options={METHODS} value={method} onChange={(v) => setMethod(v as Method)} /></Field>
        <Field label="มาตรฐาน"><Choice value={std} onChange={(v) => setStd(v as Standard)} options={STANDARDS} /></Field>
      </div>
      <Field label="ต้นเรื่อง" error={errors.ref} hint="เลข NCR ผลตรวจติดตาม เช่น IA-2569-04 #1 หรืออุบัติการณ์"><Input value={ref} onChange={setRef} error={errors.ref} /></Field>
      <Field label="ปัญหาที่ต้องแก้" error={errors.problem}><Area value={problem} onChange={setProblem} error={errors.problem} /></Field>
      <Field label="ผู้รับผิดชอบ" error={errors.owner}><Choice value={owner} onChange={setOwner} options={people()} /></Field>
      {method === "8D" && <Field label="ทีม (D1)" error={errors.team}><Checks options={PEOPLE.filter((p) => p !== owner)} value={team} onChange={setTeam} /></Field>}
      <Actions onCancel={onCancel} label="ออกใบขอให้แก้ไข" />
    </Form>
  );
}

function TextForm({ label, hint, initial, submit, onCancel, onDone, button }: { label: string; hint?: string; initial?: string; submit: (text: string) => void; onCancel: () => void; onDone: () => void; button: string }) {
  const [text, setText] = useState(initial ?? "");
  const [error, setError] = useState("");
  return (
    <Form error={error} onSubmit={() => tryRun(() => { submit(text); onDone(); }, setError)}>
      <Field label={label} hint={hint}><Area value={text} onChange={setText} rows={3} /></Field>
      <Actions onCancel={onCancel} label={button} />
    </Form>
  );
}

function CauseForm({ no, onCancel, onDone }: { no: string; onCancel: () => void; onDone: () => void }) {
  const c = capaByNo(no);
  const [category, setCategory] = useState<CauseCategory>(c.rootCause?.category ?? "วิธีการ");
  const [whys, setWhys] = useState<string[]>(() => [...(c.rootCause?.whys ?? []), "", "", "", "", ""].slice(0, 5));
  const [escape, setEscape] = useState(c.rootCause?.escape ?? "");
  const [tried, setTried] = useState(false);
  const input = { category, whys, escape };
  const errors = tried ? rootCauseErrors(no, input) : {};
  return (
    <Form onSubmit={() => { setTried(true); if (Object.keys(rootCauseErrors(no, input)).length) return; recordRootCause(no, input); notify(`บันทึกสาเหตุรากของ ${no} แล้ว`); onDone(); }}>
      <p className="text-[13px] text-slate-600 dark:text-slate-300">{c.problem}</p>
      <Field label="กลุ่มสาเหตุ (ผังก้างปลา)"><Segmented options={CAUSE_CATEGORIES} value={category} onChange={(v) => setCategory(v as CauseCategory)} /></Field>
      <Field label="ทำไมจึงเกิด — ถามทำไม 5 ชั้น" error={errors.whys} hint="ชั้นสุดท้ายที่ตอบได้คือสาเหตุราก อย่างน้อยสามชั้น">
        <div className="space-y-2">
          {whys.map((w, i) => <Input key={i} value={w} onChange={(v) => setWhys((s) => s.map((x, j) => (j === i ? v : x)))} placeholder={`ทำไมครั้งที่ ${i + 1}`} error={i < 3 ? errors.whys : undefined} />)}
        </div>
      </Field>
      {c.method === "8D" && <Field label="ทำไมจึงหลุดไปถึงลูกค้า" error={errors.escape}><Area value={escape} onChange={setEscape} error={errors.escape} rows={2} /></Field>}
      <Actions onCancel={onCancel} label="บันทึกสาเหตุราก" />
    </Form>
  );
}

function ActionForm({ no, onCancel, onDone }: { no: string; onCancel: () => void; onDone: () => void }) {
  const c = capaByNo(no);
  const [what, setWhat] = useState("");
  const [owner, setOwner] = useState(c.owner);
  const [due, setDue] = useState("");
  const [type, setType] = useState<ActionType>("แก้ไข");
  const [tried, setTried] = useState(false);
  const input = { what, owner, due, type };
  const errors = tried ? actionErrors(input) : {};
  return (
    <Form onSubmit={() => { setTried(true); if (Object.keys(actionErrors(input)).length) return; addCapaAction(no, input); notify(`เพิ่มมาตรการใน ${no} แล้ว · กำหนดเสร็จ ${due}`); onDone(); }}>
      <Field label="ชนิด" hint={type === "ป้องกันความผิดพลาด (Poka-Yoke)" ? "อุปกรณ์ที่ทำให้ทำผิดไม่ได้ ต้องทวนสอบว่าใช้งานได้ทุกกะ (IATF 10.2.4)" : undefined}><Choice value={type} onChange={(v) => setType(v as ActionType)} options={ACTION_TYPES} /></Field>
      <Field label="มาตรการ" error={errors.what}><Area value={what} onChange={setWhat} error={errors.what} rows={2} /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="ผู้รับผิดชอบ" error={errors.owner}><Choice value={owner} onChange={setOwner} options={people()} /></Field>
        <Field label="กำหนดเสร็จ" error={errors.due}><Input type="date" value={due} onChange={setDue} error={errors.due} /></Field>
      </div>
      <Actions onCancel={onCancel} label="เพิ่มมาตรการ" />
    </Form>
  );
}

function VerifyForm({ no, onCancel, onDone }: { no: string; onCancel: () => void; onDone: () => void }) {
  const c = capaByNo(no);
  const [effective, setEffective] = useState("ได้ผล");
  const [note, setNote] = useState("");
  const [by, setBy] = useState(c.owner === QMR ? "สุภาพร แก้วมณี" : QMR);
  const [tried, setTried] = useState(false);
  const input = { effective: effective === "ได้ผล", note, by };
  const errors = tried ? verifyCapaErrors(no, input) : {};
  return (
    <Form onSubmit={() => { setTried(true); if (Object.keys(verifyCapaErrors(no, input)).length) return; verifyCapa(no, input); notify(input.effective ? `ปิด ${no} แล้ว · มาตรการได้ผล` : `${no} ยังไม่ได้ผล · กลับไปหาสาเหตุใหม่`, input.effective ? "ok" : "warn"); onDone(); }}>
      <Field label="ผลการติดตาม"><Segmented options={["ได้ผล", "ไม่ได้ผล"]} value={effective} onChange={setEffective} /></Field>
      <Field label="หลักฐาน" error={errors.note} hint="เช่น สุ่มตรวจ 20 ชุดหลังแก้ ไม่พบปัญหาซ้ำ"><Area value={note} onChange={setNote} error={errors.note} /></Field>
      <Field label="ผู้ติดตามผล" error={errors.by} hint="ต้องไม่ใช่ผู้รับผิดชอบ CAR"><Choice value={by} onChange={setBy} options={people()} error={errors.by} /></Field>
      <Actions onCancel={onCancel} label="บันทึกผลการติดตาม" />
    </Form>
  );
}

/* ---------------------------------------------------- management review */

function MinutesForm({ no, onCancel, onDone }: { no: string; onCancel: () => void; onDone: () => void }) {
  const [attendees, setAttendees] = useState<string[]>([TOP, QMR]);
  const [outputs, setOutputs] = useState<Omit<ReviewOutput, "doneOn">[]>([{ decision: "", kind: "โอกาสปรับปรุง", owner: QMR, due: "" }]);
  const [tried, setTried] = useState(false);
  const input = { attendees, outputs };
  const errors = tried ? minutesErrors(no, input) : {};
  const set = (i: number, patch: Partial<Omit<ReviewOutput, "doneOn">>) => setOutputs((s) => s.map((o, j) => (j === i ? { ...o, ...patch } : o)));
  return (
    <Form onSubmit={() => { setTried(true); if (Object.keys(minutesErrors(no, input)).length) return; recordMinutes(no, input); notify(`บันทึกการประชุม ${no} แล้ว · ข้อสั่งการ ${outputs.length} ข้อ`); onDone(); }}>
      <Note tone="info">ข้อมูลเข้าจากทุกระบบ ณ วันนี้จะถูกเก็บไว้กับรายงานการประชุม</Note>
      <Field label="ผู้เข้าประชุม" error={errors.attendees}><Checks options={PEOPLE} value={attendees} onChange={setAttendees} /></Field>
      <Field label="ผลการทบทวนและข้อสั่งการ" error={errors.outputs}>
        <div className="space-y-3">
          {outputs.map((o, i) => (
            <div key={i} className="space-y-2 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
              <div className="flex gap-2">
                <Input value={o.decision} onChange={(v) => set(i, { decision: v })} placeholder="ข้อสั่งการ" />
                {outputs.length > 1 && <Button variant="ghost" icon={<Trash2 size={14} />} onClick={() => setOutputs((s) => s.filter((_, j) => j !== i))}>ลบ</Button>}
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <Choice value={o.kind} onChange={(v) => set(i, { kind: v as ReviewOutput["kind"] })} options={["โอกาสปรับปรุง", "เปลี่ยนแปลงระบบ", "ทรัพยากร"]} />
                <Choice value={o.owner} onChange={(v) => set(i, { owner: v })} options={people()} />
                <Input type="date" value={o.due} onChange={(v) => set(i, { due: v })} />
              </div>
            </div>
          ))}
          <Button variant="secondary" icon={<Plus size={14} />} onClick={() => setOutputs((s) => [...s, { decision: "", kind: "โอกาสปรับปรุง", owner: QMR, due: "" }])}>เพิ่มข้อสั่งการ</Button>
        </div>
      </Field>
      <Actions onCancel={onCancel} label="บันทึกการประชุม" />
    </Form>
  );
}

function PlanReviewForm({ onCancel, onDone }: { onCancel: () => void; onDone: (no: string) => void }) {
  const [planned, setPlanned] = useState("");
  const [error, setError] = useState("");
  return (
    <Form error={error} onSubmit={() => tryRun(() => { const r = planReview(planned); notify(`นัดประชุม ${r.no} วันที่ ${planned} แล้ว`); onDone(r.no); }, setError)}>
      <Field label="วันประชุม"><Input type="date" value={planned} onChange={setPlanned} /></Field>
      <Actions onCancel={onCancel} label="นัดประชุม" />
    </Form>
  );
}

/* --------------------------------------------------------------- actions */

export function ImsActions({ act, onAct, onOpen }: { act: Act | null; onAct: (a: Act | null) => void; onOpen: (kind: RecordKind, key: string) => void }) {
  useData();
  const close = () => onAct(null);
  const pick = <K extends Act["kind"]>(kind: K) => (act?.kind === kind ? (act as Of<K>) : null);
  const [obsReason, setObsReason] = useState("");
  const [score, setScore] = useState("");

  const riskTask = pick("risk-task");
  const reassess = pick("risk-reassess");
  const polRevise = pick("policy-revise");
  const polAck = pick("policy-ack");
  const objResult = pick("objective-result");
  const revise = pick("doc-revise");
  const approve = pick("doc-approve");
  const obsolete = pick("doc-obsolete");
  const trNew = pick("training-new");
  const trRecord = pick("training-record");
  const trEval = pick("training-evaluate");
  const finding = pick("audit-finding");
  const auditClose = pick("audit-close");
  const carNew = pick("car-new");
  const containment = pick("car-containment");
  const cause = pick("car-cause");
  const action = pick("car-action");
  const prevention = pick("car-prevention");
  const verify = pick("car-verify");
  const minutes = pick("review-minutes");
  const print = pick("print");
  const closing = auditClose ? auditByNo(auditClose.no) : null;
  const closeProblem = auditClose ? Object.values(closeAuditErrors(auditClose.no, closing?.type === "ตรวจกระบวนการ" ? (score === "" ? undefined : Number(score)) : undefined))[0] : undefined;

  return (
    <>
      <FormModal open={act?.kind === "issue-new"} title="เพิ่มประเด็นภายในและภายนอก" subtitle="SWOT สำหรับประเด็นภายใน PESTEL สำหรับประเด็นภายนอก (ข้อ 4.1)" onClose={close}>
        {act?.kind === "issue-new" && <IssueForm onCancel={close} onDone={close} />}
      </FormModal>
      <FormModal open={act?.kind === "party-new"} title="เพิ่มผู้มีส่วนได้ส่วนเสีย" subtitle="ข้อ 4.2" onClose={close}>
        {act?.kind === "party-new" && <PartyForm onCancel={close} onDone={close} />}
      </FormModal>
      <ConfirmDialog
        open={act?.kind === "context-confirm"}
        title="ยืนยันการทบทวนบริบทองค์กร"
        body={`ผู้บริหารสูงสุด (${TOP}) ยืนยันว่าประเด็นภายในภายนอก ผู้มีส่วนได้ส่วนเสีย และขอบเขตยังเป็นปัจจุบัน`}
        confirmLabel="ยืนยันการทบทวน"
        onCancel={close}
        onConfirm={() => { confirmContext(TOP); notify("บันทึกการทบทวนบริบทองค์กรแล้ว"); close(); }}
      />

      <FormModal open={act?.kind === "risk-new"} title="เพิ่มความเสี่ยงหรือโอกาส" subtitle="ประเมินโอกาสเกิด × ผลกระทบ ระดับสูงยอมรับไม่ได้" onClose={close}>
        {act?.kind === "risk-new" && <RiskForm onCancel={close} onDone={(no) => { close(); onOpen("risk", no); }} />}
      </FormModal>
      <FormModal open={riskTask !== null} title="เพิ่มมาตรการ" subtitle={riskTask?.no} onClose={close} size="sm">
        {riskTask && <TaskForm key={riskTask.no} owner={riskByNo(riskTask.no).owner} label="เพิ่มมาตรการ" onCancel={close} onSubmit={(t) => { addRiskTask(riskTask.no, t); notify(`เพิ่มมาตรการใน ${riskTask.no} แล้ว`); close(); }} />}
      </FormModal>
      <FormModal open={reassess !== null} title="ประเมินซ้ำหลังมาตรการ" subtitle={reassess?.no} onClose={close} size="sm">
        {reassess && <ReassessForm key={reassess.no} no={reassess.no} onCancel={close} onDone={close} />}
      </FormModal>

      <FormModal open={polRevise !== null} title="ทบทวนนโยบาย" subtitle={polRevise ? policyByCode(polRevise.code).title : undefined} onClose={close}>
        {polRevise && <PolicyForm key={polRevise.code} code={polRevise.code} onCancel={close} onDone={close} />}
      </FormModal>
      <FormModal open={polAck !== null} title="บันทึกการรับทราบนโยบาย" subtitle={polAck ? policyByCode(polAck.code).title : undefined} onClose={close} size="sm">
        {polAck && <AckForm key={polAck.code} code={polAck.code} onCancel={close} onDone={close} />}
      </FormModal>
      <FormModal open={act?.kind === "objective-new"} title="ตั้งวัตถุประสงค์" subtitle="วัดได้ มีแผนบรรลุ และมีผู้รับผิดชอบ (ข้อ 6.2)" onClose={close}>
        {act?.kind === "objective-new" && <ObjectiveForm onCancel={close} onDone={(id) => { close(); onOpen("objective", String(id)); }} />}
      </FormModal>
      <FormModal open={objResult !== null} title="บันทึกผลรายเดือน" subtitle={objResult ? objectiveById(objResult.id).name : undefined} onClose={close} size="sm">
        {objResult && <ResultForm key={objResult.id} id={objResult.id} onCancel={close} onDone={close} />}
      </FormModal>

      <FormModal open={act?.kind === "doc-new"} title="สร้างเอกสารควบคุม" subtitle="เริ่มเป็นร่าง ส่งอนุมัติเมื่อเขียนเสร็จ ออกใช้เมื่อได้รับอนุมัติ" onClose={close}>
        {act?.kind === "doc-new" && <DocForm onCancel={close} onDone={(code) => { close(); onOpen("doc", code); }} />}
      </FormModal>
      <FormModal open={revise !== null} title="แก้ไขเอกสาร" subtitle={revise ? `${revise.code} · ${docByCode(revise.code).title}` : undefined} onClose={close} size="sm">
        {revise && <ReviseForm key={revise.code} code={revise.code} onCancel={close} onDone={close} />}
      </FormModal>
      <FormModal open={approve !== null} title="อนุมัติเอกสาร" subtitle={approve ? `${approve.code} · ${docByCode(approve.code).title}` : undefined} onClose={close} size="sm">
        {approve && <ApproveForm key={approve.code} code={approve.code} onCancel={close} onDone={close} />}
      </FormModal>
      <ConfirmDialog
        open={obsolete !== null}
        title="ยกเลิกเอกสาร"
        body="เอกสารที่ยกเลิกต้องเก็บออกจากหน้างานทั้งหมด และจะแสดงในบัญชีรายชื่อว่ายกเลิกแล้ว"
        subject={obsolete ? <Badge tone="bad">{obsolete.code} · {docByCode(obsolete.code).title}</Badge> : undefined}
        fields={<Field label="เหตุผล"><Input value={obsReason} onChange={setObsReason} /></Field>}
        confirmLabel="ยกเลิกเอกสาร"
        disabled={obsReason.trim().length < 5}
        onCancel={() => { setObsReason(""); close(); }}
        onConfirm={() => { if (!obsolete) return; obsoleteDocument(obsolete.code, obsReason); notify(`ยกเลิก ${obsolete.code} แล้ว`, "info"); setObsReason(""); close(); }}
      />

      <FormModal open={trNew !== null} title="วางแผนฝึกอบรม" subtitle="ผ่านแล้วความสามารถขึ้นในทะเบียนทันที ใช้ตัดสินสิทธิ์ผู้ตรวจติดตามด้วย" onClose={close}>
        {trNew && <TrainingForm course={trNew.course} attendees={trNew.attendees} onCancel={close} onDone={(no) => { close(); onOpen("training", no); }} />}
      </FormModal>
      <FormModal open={trRecord !== null} title="บันทึกผลอบรม" subtitle={trRecord?.no} onClose={close}>
        {trRecord && <RecordTrainingForm key={trRecord.no} no={trRecord.no} onCancel={close} onDone={close} />}
      </FormModal>
      <FormModal open={trEval !== null} title="ประเมินประสิทธิผลการอบรม" subtitle={trEval ? `${trEval.no} · ข้อ 7.2 ค` : undefined} onClose={close} size="sm">
        {trEval && <EvaluateForm key={trEval.no} no={trEval.no} onCancel={close} onDone={close} />}
      </FormModal>

      <FormModal open={act?.kind === "audit-new"} title="วางแผนการตรวจติดตามภายใน" subtitle="ระบบตรวจคุณสมบัติและความเป็นอิสระของผู้ตรวจให้" onClose={close}>
        {act?.kind === "audit-new" && <AuditForm onCancel={close} onDone={(no) => { close(); onOpen("audit", no); }} />}
      </FormModal>
      <FormModal open={finding !== null} title="บันทึกสิ่งที่พบ" subtitle={finding ? `${finding.no} · ${auditByNo(finding.no).area}` : undefined} onClose={close}>
        {finding && <FindingForm key={finding.no} no={finding.no} onCancel={close} onDone={close} />}
      </FormModal>
      <ConfirmDialog
        open={auditClose !== null}
        title="ปิดการตรวจ"
        body={closeProblem ?? "ข้อบกพร่องทุกข้อมี CAR แล้ว"}
        subject={auditClose ? <Badge tone="info">{auditClose.no}</Badge> : undefined}
        fields={closing?.type === "ตรวจกระบวนการ" ? <Field label="คะแนน VDA 6.3 (%)" hint="90 ขึ้นไป A · 80–89 B · ต่ำกว่า 80 C"><Input type="number" value={score} onChange={setScore} /></Field> : undefined}
        confirmLabel="ปิดการตรวจ"
        disabled={!!closeProblem}
        onCancel={() => { setScore(""); close(); }}
        onConfirm={() => { if (!auditClose) return; closeAudit(auditClose.no, score === "" ? undefined : Number(score)); notify(`ปิดการตรวจ ${auditClose.no} แล้ว`); setScore(""); close(); }}
      />

      <FormModal open={carNew !== null} title="ออกใบขอให้แก้ไขและป้องกัน (CAR)" subtitle="หาสาเหตุราก วางมาตรการ แล้วติดตามว่าได้ผลจริง" onClose={close}>
        {carNew && <CarForm refNo={carNew.ref} problem={carNew.problem} method={carNew.method} std={carNew.std} onCancel={close} onDone={(no) => { close(); onOpen("car", no); }} />}
      </FormModal>
      <FormModal open={containment !== null} title="กักกันชั่วคราว (D3)" subtitle={containment?.no} onClose={close} size="sm">
        {containment && <TextForm key={containment.no} label="กักกันอะไร ที่ไหน กี่ชิ้น" initial={capaByNo(containment.no).containment} button="บันทึกการกักกัน" onCancel={close} onDone={close} submit={(t) => { recordContainment(containment.no, t); notify(`บันทึกการกักกันใน ${containment.no} แล้ว`); }} />}
      </FormModal>
      <FormModal open={cause !== null} title="หาสาเหตุราก" subtitle={cause?.no} onClose={close}>
        {cause && <CauseForm key={cause.no} no={cause.no} onCancel={close} onDone={close} />}
      </FormModal>
      <FormModal open={action !== null} title="เพิ่มมาตรการ" subtitle={action?.no} onClose={close} size="sm">
        {action && <ActionForm key={action.no} no={action.no} onCancel={close} onDone={close} />}
      </FormModal>
      <FormModal open={prevention !== null} title="ป้องกันการเกิดซ้ำ (D7)" subtitle={prevention?.no} onClose={close} size="sm">
        {prevention && <TextForm key={prevention.no} label="เอกสารที่แก้" hint="เช่น PFMEA แผนควบคุม WI ฉบับใหม่" initial={capaByNo(prevention.no).prevention} button="บันทึก" onCancel={close} onDone={close} submit={(t) => { recordPrevention(prevention.no, t); notify(`บันทึกการป้องกันการเกิดซ้ำใน ${prevention.no} แล้ว`); }} />}
      </FormModal>
      <FormModal open={verify !== null} title="ติดตามประสิทธิผล" subtitle={verify?.no} onClose={close} size="sm">
        {verify && <VerifyForm key={verify.no} no={verify.no} onCancel={close} onDone={close} />}
      </FormModal>

      <FormModal open={minutes !== null} title="บันทึกการประชุมทบทวนโดยฝ่ายบริหาร" subtitle={minutes ? `${minutes.no} · ${reviewByNo(minutes.no).planned}` : undefined} onClose={close} size="lg">
        {minutes && <MinutesForm key={minutes.no} no={minutes.no} onCancel={close} onDone={close} />}
      </FormModal>
      <FormModal open={act?.kind === "review-plan"} title="นัดประชุมทบทวนครั้งถัดไป" onClose={close} size="sm">
        {act?.kind === "review-plan" && <PlanReviewForm onCancel={close} onDone={(no) => { close(); onOpen("review", no); }} />}
      </FormModal>

      <FormModal open={print !== null} title={print?.title ?? ""} subtitle="ตัวอย่างก่อนพิมพ์ — กระดาษ A4 พิมพ์เฉพาะเอกสาร" onClose={close} size="lg">
        {print && (
          <div className="space-y-3">
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={close}>ปิด</Button>
              <Button icon={<Printer size={14} />} onClick={printDocument}>พิมพ์</Button>
            </div>
            <ImsPaper d={print.d} />
          </div>
        )}
      </FormModal>
    </>
  );
}

