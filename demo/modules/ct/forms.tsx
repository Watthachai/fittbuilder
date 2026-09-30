import { useState } from "react";
import { Printer } from "lucide-react";
import { PEOPLE, QMR } from "../ims/data";
import { Actions, Area, Checks, Choice, Form, Input, people, tryRun } from "../ims/parts";
import {
  CONTROL_METHODS, GAUGE_OPTIONS, PHASES, AUTO_ELEMENTS, actionPriority, addCpRow, addFmeaAction, addFmeaRow,
  addSubgroup, addSubgroups, approvePlan, approvePlanErrors, chartByCode, completeFmeaAction, cpRowErrors, currentPhase,
  decisionErrors, elementStatus, fmeaActionErrors, fmeaByNo, fmeaRowErrors, gateErrors, passGate, planByNo, projectByNo,
  recordDecision, recordStudy, restartChart, setElement, stepsOf, studyErrors, submissionByNo, subgroupErrors,
} from "./data";
import type { ControlMethod, ElementStatus, Gate, PpapElement, Special, Submission } from "./data";
import { CtPaper } from "./documents";
import type { CtDoc } from "./documents";
import { Badge, Button, Note, Segmented } from "../ui";
import { ConfirmDialog, Field, FormModal, notify, printDocument, useData } from "../kit";

/** ทุกการกระทำของ Core Tools ยกขึ้นแบบเดียวกันจากทุกหน้า */
export type Act =
  | { kind: "fmea-row"; no: string }
  | { kind: "fmea-action"; no: string; id: number }
  | { kind: "fmea-complete"; no: string; id: number }
  | { kind: "cp-row"; no: string }
  | { kind: "cp-approve"; no: string }
  | { kind: "spc-add"; code: string }
  | { kind: "spc-import"; code: string }
  | { kind: "spc-restart"; code: string }
  | { kind: "msa-new"; characteristic?: string }
  | { kind: "ppap-element"; no: string; element: PpapElement }
  | { kind: "ppap-decision"; no: string }
  | { kind: "apqp-gate"; no: string }
  | { kind: "print"; d: CtDoc; title: string };

type Of<K extends Act["kind"]> = Extract<Act, { kind: K }>;
export type RecordKind = "apqp" | "ppap" | "fmea" | "plan" | "spc" | "msa";

const n1to10 = Array.from({ length: 10 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }));

function FmeaRowForm({ no, onCancel, onDone }: { no: string; onCancel: () => void; onDone: () => void }) {
  const f = fmeaByNo(no);
  const steps = f.type === "PFMEA" ? stepsOf(f.part).map((s) => `${s.op} ${s.text}`) : [];
  const [v, setV] = useState({ step: steps[0] ?? "", failure: "", effect: "", cause: "", s: 5, o: 3, d: 5, prevention: "", detection: "", characteristic: "", special: "" as Special | "" });
  const [tried, setTried] = useState(false);
  const input = { ...v, special: v.special || undefined, characteristic: v.characteristic || undefined };
  const errors = tried ? fmeaRowErrors(input) : {};
  const set = <K extends keyof typeof v>(k: K) => (x: (typeof v)[K]) => setV((s) => ({ ...s, [k]: x }));
  const ap = actionPriority(v.s, v.o, v.d);
  return (
    <Form onSubmit={() => { setTried(true); if (Object.keys(fmeaRowErrors(input)).length) return; addFmeaRow(no, input); notify(`เพิ่มแถวใน ${no} แล้ว · AP ${ap}`, ap === "สูง" ? "warn" : "ok"); onDone(); }}>
      <Field label={f.type === "PFMEA" ? "ขั้นตอนการผลิต" : "หน้าที่ของชิ้นส่วน"} error={errors.step}>
        {f.type === "PFMEA" ? <Choice value={v.step} onChange={set("step")} options={steps} /> : <Input value={v.step} onChange={set("step")} error={errors.step} />}
      </Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="ความล้มเหลว" error={errors.failure}><Input value={v.failure} onChange={set("failure")} error={errors.failure} /></Field>
        <Field label="ผลกระทบ" error={errors.effect}><Input value={v.effect} onChange={set("effect")} error={errors.effect} /></Field>
        <Field label="สาเหตุ" error={errors.cause}><Input value={v.cause} onChange={set("cause")} error={errors.cause} /></Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="S ความรุนแรง" error={errors.s}><Choice value={String(v.s)} onChange={(x) => set("s")(Number(x))} options={n1to10} /></Field>
        <Field label="O โอกาสเกิด"><Choice value={String(v.o)} onChange={(x) => set("o")(Number(x))} options={n1to10} /></Field>
        <Field label="D การตรวจจับ"><Choice value={String(v.d)} onChange={(x) => set("d")(Number(x))} options={n1to10} /></Field>
        <Field label="AP"><div className="flex h-9 items-center"><Badge tone={ap === "สูง" ? "bad" : ap === "กลาง" ? "warn" : "ok"}>{ap}</Badge></div></Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="การป้องกันที่มีอยู่"><Input value={v.prevention} onChange={set("prevention")} /></Field>
        <Field label="การตรวจจับที่มีอยู่" error={errors.detection}><Input value={v.detection} onChange={set("detection")} error={errors.detection} /></Field>
        <Field label="คุณลักษณะพิเศษ" error={errors.special}><Segmented options={["ไม่มี", "CC", "SC"]} value={v.special || "ไม่มี"} onChange={(x) => set("special")(x === "ไม่มี" ? "" : (x as Special))} /></Field>
        <Field label="คุณลักษณะ" error={errors.characteristic} hint="ต้องไปอยู่ในแผนควบคุม"><Input value={v.characteristic} onChange={set("characteristic")} error={errors.characteristic} /></Field>
      </div>
      <Actions onCancel={onCancel} label="เพิ่มแถว" />
    </Form>
  );
}

function FmeaActionForm({ no, id, onCancel, onDone }: { no: string; id: number; onCancel: () => void; onDone: () => void }) {
  const [v, setV] = useState({ what: "", owner: fmeaByNo(no).team[0], due: "" });
  const [tried, setTried] = useState(false);
  const [error, setError] = useState("");
  const errors = tried ? fmeaActionErrors(v) : {};
  const set = (k: keyof typeof v) => (x: string) => setV((s) => ({ ...s, [k]: x }));
  return (
    <Form error={error} onSubmit={() => { setTried(true); if (Object.keys(fmeaActionErrors(v)).length) return; tryRun(() => { addFmeaAction(no, id, v); notify(`เพิ่มมาตรการใน ${no} แล้ว`); onDone(); }, setError); }}>
      <Field label="มาตรการ" error={errors.what} hint="ลดโอกาสเกิดก่อน แล้วค่อยเพิ่มการตรวจจับ"><Area value={v.what} onChange={set("what")} error={errors.what} rows={2} /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="ผู้รับผิดชอบ" error={errors.owner}><Choice value={v.owner} onChange={set("owner")} options={people()} /></Field>
        <Field label="กำหนดเสร็จ" error={errors.due}><Input type="date" value={v.due} onChange={set("due")} error={errors.due} /></Field>
      </div>
      <Actions onCancel={onCancel} label="เพิ่มมาตรการ" />
    </Form>
  );
}

function RerateForm({ no, id, onCancel, onDone }: { no: string; id: number; onCancel: () => void; onDone: () => void }) {
  const r = fmeaByNo(no).rows.find((x) => x.id === id)!;
  const [v, setV] = useState({ s: r.s, o: r.o, d: r.d });
  const [error, setError] = useState("");
  const ap = actionPriority(v.s, v.o, v.d);
  return (
    <Form error={error} onSubmit={() => tryRun(() => { completeFmeaAction(no, id, v); notify(`ปิดมาตรการ · AP ใหม่ ${ap}`, ap === "สูง" ? "warn" : "ok"); onDone(); }, setError)}>
      <p className="text-[13px] text-slate-600 dark:text-slate-300">{r.action?.what}</p>
      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="S"><Choice value={String(v.s)} onChange={(x) => setV((s) => ({ ...s, s: Number(x) }))} options={n1to10} /></Field>
        <Field label="O"><Choice value={String(v.o)} onChange={(x) => setV((s) => ({ ...s, o: Number(x) }))} options={n1to10} /></Field>
        <Field label="D"><Choice value={String(v.d)} onChange={(x) => setV((s) => ({ ...s, d: Number(x) }))} options={n1to10} /></Field>
        <Field label="AP ใหม่"><div className="flex h-9 items-center"><Badge tone={ap === "สูง" ? "bad" : ap === "กลาง" ? "warn" : "ok"}>{ap}</Badge></div></Field>
      </div>
      <Actions onCancel={onCancel} label="ปิดมาตรการและประเมินซ้ำ" />
    </Form>
  );
}

function CpRowForm({ no, onCancel, onDone }: { no: string; onCancel: () => void; onDone: () => void }) {
  const cp = planByNo(no);
  const steps = stepsOf(cp.part);
  const [v, setV] = useState({ op: steps[0]?.op ?? "", characteristic: "", special: "" as Special | "", spec: "", gauge: "", sample: "", control: "สุ่มตรวจ" as ControlMethod, reaction: "" });
  const [tried, setTried] = useState(false);
  const input = { ...v, special: v.special || undefined };
  const errors = tried ? cpRowErrors(no, input) : {};
  const set = <K extends keyof typeof v>(k: K) => (x: (typeof v)[K]) => setV((s) => ({ ...s, [k]: x }));
  return (
    <Form onSubmit={() => { setTried(true); if (Object.keys(cpRowErrors(no, input)).length) return; addCpRow(no, input); notify(`เพิ่มแถวใน ${no} แล้ว · ต้องอนุมัติฉบับใหม่`, "info"); onDone(); }}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="ขั้นตอน" error={errors.op}><Choice value={v.op} onChange={set("op")} options={steps.map((s) => ({ value: s.op, label: `${s.op} ${s.text}` }))} /></Field>
        <Field label="คุณลักษณะ" error={errors.characteristic}><Input value={v.characteristic} onChange={set("characteristic")} error={errors.characteristic} /></Field>
        <Field label="คุณลักษณะพิเศษ"><Segmented options={["ไม่มี", "CC", "SC"]} value={v.special || "ไม่มี"} onChange={(x) => set("special")(x === "ไม่มี" ? "" : (x as Special))} /></Field>
        <Field label="เกณฑ์" error={errors.spec}><Input value={v.spec} onChange={set("spec")} error={errors.spec} /></Field>
        <Field label="เครื่องมือวัด" error={errors.gauge}><Input value={v.gauge} onChange={set("gauge")} error={errors.gauge} /></Field>
        <Field label="ขนาดและความถี่" error={errors.sample}><Input value={v.sample} onChange={set("sample")} error={errors.sample} /></Field>
      </div>
      <Field label="วิธีควบคุม" error={errors.control}><Choice value={v.control} onChange={(x) => set("control")(x as ControlMethod)} options={CONTROL_METHODS} error={errors.control} /></Field>
      <Field label="แผนตอบสนอง" error={errors.reaction}><Area value={v.reaction} onChange={set("reaction")} error={errors.reaction} rows={2} /></Field>
      <Actions onCancel={onCancel} label="เพิ่มแถว" />
    </Form>
  );
}

function SubgroupForm({ code, onCancel, onDone }: { code: string; onCancel: () => void; onDone: () => void }) {
  const c = chartByCode(code);
  const [values, setValues] = useState<string[]>(Array(c.n).fill(""));
  const [tried, setTried] = useState(false);
  const nums = values.map((x) => (x === "" ? NaN : Number(x)));
  const errors = tried ? subgroupErrors(code, nums) : {};
  return (
    <Form onSubmit={() => { setTried(true); if (Object.keys(subgroupErrors(code, nums)).length) return; const r = addSubgroup(code, nums); notify(r.outOfSpec ? "มีค่านอกเกณฑ์ · ทำตามแผนตอบสนองในแผนควบคุม" : r.outOfControl ? "จุดหลุดเส้นควบคุม · หาสาเหตุพิเศษ" : `เพิ่มกลุ่มย่อยที่ ${r.chart.subgroups.length} แล้ว`, r.outOfSpec || r.outOfControl ? "warn" : "ok"); onDone(); }}>
      <p className="text-[13px] text-slate-600 dark:text-slate-300">{c.characteristic} · เกณฑ์ {c.lsl}–{c.usl}</p>
      <Field label={`ค่าที่วัดได้ ${c.n} ชิ้น`} error={errors.values}>
        <div className="grid grid-cols-5 gap-2">
          {values.map((x, i) => <Input key={i} type="number" value={x} onChange={(v) => setValues((s) => s.map((y, j) => (j === i ? v : y)))} />)}
        </div>
      </Field>
      <Actions onCancel={onCancel} label="เพิ่มกลุ่มย่อย" />
    </Form>
  );
}

function TextForm({ label, hint, button, rows = 3, submit, onCancel, onDone, placeholder }: { label: string; hint?: string; button: string; rows?: number; submit: (t: string) => void; onCancel: () => void; onDone: () => void; placeholder?: string }) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  return (
    <Form error={error} onSubmit={() => tryRun(() => { submit(text); onDone(); }, setError)}>
      <Field label={label} hint={hint}><Area value={text} onChange={setText} rows={rows} placeholder={placeholder} /></Field>
      <Actions onCancel={onCancel} label={button} />
    </Form>
  );
}

function StudyForm({ characteristic, onCancel, onDone }: { characteristic?: string; onCancel: () => void; onDone: (no: string) => void }) {
  const [v, setV] = useState({ gauge: "BG-BK220-01", characteristic: characteristic ?? "ขนาดรูยึด", lsl: "10.5", usl: "10.6", rows: "" });
  const [appraisers, setAppraisers] = useState<string[]>(["สุภาพร แก้วมณี", "ธนพล เจริญผล", "อนุชา ทองดี"]);
  const [tried, setTried] = useState(false);
  const input = { ...v, lsl: Number(v.lsl), usl: Number(v.usl), appraisers };
  const errors = tried ? studyErrors(input) : {};
  const set = (k: keyof typeof v) => (x: string) => setV((s) => ({ ...s, [k]: x }));
  return (
    <Form onSubmit={() => { setTried(true); if (Object.keys(studyErrors(input)).length) return; const s = recordStudy(input); notify(`บันทึก ${s.no} แล้ว`); onDone(s.no); }}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="เครื่องมือวัด" error={errors.gauge}><Choice value={v.gauge} onChange={set("gauge")} options={GAUGE_OPTIONS()} /></Field>
        <Field label="คุณลักษณะ" error={errors.characteristic}><Input value={v.characteristic} onChange={set("characteristic")} error={errors.characteristic} /></Field>
        <Field label="LSL"><Input type="number" value={v.lsl} onChange={set("lsl")} /></Field>
        <Field label="USL" error={errors.usl}><Input type="number" value={v.usl} onChange={set("usl")} error={errors.usl} /></Field>
      </div>
      <Field label="ผู้วัด 3 คน" error={errors.appraisers}><Checks options={PEOPLE} value={appraisers} onChange={setAppraisers} /></Field>
      <Field label="ผลวัด" error={errors.rows} hint="9 บรรทัด: ผู้วัดคนที่ 1 ครั้งที่ 1–3 แล้วคนที่ 2 และ 3 · บรรทัดละ 10 ค่าตามชิ้นที่ 1–10">
        <Area value={v.rows} onChange={set("rows")} error={errors.rows} rows={9} />
      </Field>
      <Actions onCancel={onCancel} label="คำนวณและบันทึก" />
    </Form>
  );
}

function ElementForm({ no, element, onCancel, onDone }: { no: string; element: PpapElement; onCancel: () => void; onDone: () => void }) {
  const s = submissionByNo(no);
  const [status, setStatus] = useState<ElementStatus>(elementStatus(s, element).status);
  const [error, setError] = useState("");
  return (
    <Form error={error} onSubmit={() => tryRun(() => { setElement(no, element, status); notify(`${element}: ${status}`); onDone(); }, setError)}>
      <Field label="สถานะ"><Segmented options={["ครบ", "ยังไม่ครบ", "ไม่เกี่ยวข้อง"]} value={status} onChange={(x) => setStatus(x as ElementStatus)} /></Field>
      <Actions onCancel={onCancel} label="บันทึก" />
    </Form>
  );
}

function DecisionForm({ no, onCancel, onDone }: { no: string; onCancel: () => void; onDone: () => void }) {
  const [decision, setDecision] = useState<NonNullable<Submission["decision"]>>("อนุมัติ");
  const [note, setNote] = useState("");
  const [interimUntil, setInterimUntil] = useState("");
  const [tried, setTried] = useState(false);
  const input = { decision, note, interimUntil };
  const errors = tried ? decisionErrors(no, input) : {};
  return (
    <Form onSubmit={() => { setTried(true); if (Object.keys(decisionErrors(no, input)).length) return; recordDecision(no, input); notify(`บันทึกผล PPAP ${no}: ${decision}`, decision === "ไม่อนุมัติ" ? "warn" : "ok"); onDone(); }}>
      <Field label="ผลจากลูกค้า" error={errors.decision}><Segmented options={["อนุมัติ", "อนุมัติชั่วคราว", "ไม่อนุมัติ"]} value={decision} onChange={(x) => setDecision(x as NonNullable<Submission["decision"]>)} /></Field>
      {decision === "อนุมัติชั่วคราว" && <Field label="ใช้ได้ถึง" error={errors.interimUntil}><Input type="date" value={interimUntil} onChange={setInterimUntil} error={errors.interimUntil} /></Field>}
      <Field label="ความเห็นหรือเงื่อนไขจากลูกค้า" error={errors.note}><Area value={note} onChange={setNote} error={errors.note} rows={2} /></Field>
      <Actions onCancel={onCancel} label="บันทึกผล" />
    </Form>
  );
}

function GateForm({ no, onCancel, onDone }: { no: string; onCancel: () => void; onDone: () => void }) {
  const p = projectByNo(no);
  const phase = currentPhase(p);
  const [decision, setDecision] = useState<Gate["decision"]>("ผ่าน");
  const [note, setNote] = useState("");
  const [by, setBy] = useState(QMR);
  const [tried, setTried] = useState(false);
  const input = { decision, note, by };
  const errors = tried ? gateErrors(no, input) : {};
  return (
    <Form onSubmit={() => { setTried(true); if (Object.keys(gateErrors(no, input)).length) return; passGate(no, input); notify(`ผ่านประตูเฟส ${phase + 1} ของ ${no} แล้ว`); onDone(); }}>
      <Note tone="info">เฟส {phase + 1} {PHASES[phase]}</Note>
      <Field label="ผล" error={errors.decision}><Segmented options={["ผ่าน", "ผ่านแบบมีเงื่อนไข"]} value={decision} onChange={(x) => setDecision(x as Gate["decision"])} /></Field>
      <Field label="บันทึก" error={errors.note}><Area value={note} onChange={setNote} error={errors.note} rows={2} /></Field>
      <Field label="ผู้อนุมัติ" error={errors.by}><Choice value={by} onChange={setBy} options={people()} error={errors.by} /></Field>
      <Actions onCancel={onCancel} label="บันทึกประตูผ่านเฟส" />
    </Form>
  );
}

export function CtActions({ act, onAct, onOpen }: { act: Act | null; onAct: (a: Act | null) => void; onOpen: (kind: RecordKind, key: string) => void }) {
  useData();
  const close = () => onAct(null);
  const pick = <K extends Act["kind"]>(kind: K) => (act?.kind === kind ? (act as Of<K>) : null);
  const [approver, setApprover] = useState(QMR);
  const fRow = pick("fmea-row");
  const fAct = pick("fmea-action");
  const fDone = pick("fmea-complete");
  const cRow = pick("cp-row");
  const cApprove = pick("cp-approve");
  const sAdd = pick("spc-add");
  const sImport = pick("spc-import");
  const sRestart = pick("spc-restart");
  const msa = pick("msa-new");
  const el = pick("ppap-element");
  const dec = pick("ppap-decision");
  const gate = pick("apqp-gate");
  const print = pick("print");
  const approveProblem = cApprove ? Object.values(approvePlanErrors(cApprove.no, approver))[0] : undefined;

  return (
    <>
      <FormModal open={fRow !== null} title="เพิ่มแถวใน FMEA" subtitle={fRow?.no} onClose={close} size="lg">
        {fRow && <FmeaRowForm key={fRow.no} no={fRow.no} onCancel={close} onDone={close} />}
      </FormModal>
      <FormModal open={fAct !== null} title="เพิ่มมาตรการ" subtitle={fAct ? `${fAct.no} แถว ${fAct.id}` : undefined} onClose={close} size="sm">
        {fAct && <FmeaActionForm key={`${fAct.no}-${fAct.id}`} no={fAct.no} id={fAct.id} onCancel={close} onDone={close} />}
      </FormModal>
      <FormModal open={fDone !== null} title="ปิดมาตรการและประเมินซ้ำ" subtitle={fDone ? `${fDone.no} แถว ${fDone.id}` : undefined} onClose={close} size="sm">
        {fDone && <RerateForm key={`${fDone.no}-${fDone.id}`} no={fDone.no} id={fDone.id} onCancel={close} onDone={close} />}
      </FormModal>
      <FormModal open={cRow !== null} title="เพิ่มแถวในแผนควบคุม" subtitle={cRow?.no} onClose={close}>
        {cRow && <CpRowForm key={cRow.no} no={cRow.no} onCancel={close} onDone={close} />}
      </FormModal>
      <ConfirmDialog
        open={cApprove !== null}
        title="อนุมัติแผนควบคุม"
        body={approveProblem ?? "คุณลักษณะพิเศษจาก PFMEA อยู่ในแผนครบ และ CC ควบคุมด้วยวิธีที่จับของเสียได้"}
        subject={cApprove ? <Badge tone="info">{cApprove.no}</Badge> : undefined}
        fields={<Field label="ผู้อนุมัติ"><Choice value={approver} onChange={setApprover} options={people()} /></Field>}
        confirmLabel="อนุมัติ"
        disabled={!!approveProblem}
        onCancel={close}
        onConfirm={() => { if (!cApprove) return; approvePlan(cApprove.no, approver); notify(`อนุมัติ ${cApprove.no} แล้ว`); close(); }}
      />
      <FormModal open={sAdd !== null} title="เพิ่มกลุ่มย่อย" subtitle={sAdd?.code} onClose={close}>
        {sAdd && <SubgroupForm key={sAdd.code} code={sAdd.code} onCancel={close} onDone={close} />}
      </FormModal>
      <FormModal open={sImport !== null} title="นำเข้าหลายกลุ่มย่อย" subtitle={sImport?.code} onClose={close}>
        {sImport && <TextForm label="ค่าที่วัด" hint={`บรรทัดละหนึ่งกลุ่มย่อย ${chartByCode(sImport.code).n} ค่า`} rows={10} button="นำเข้า" onCancel={close} onDone={close} submit={(t) => { const c = addSubgroups(sImport.code, t); notify(`นำเข้าแล้ว · รวม ${c.subgroups.length} กลุ่มย่อย`); }} />}
      </FormModal>
      <FormModal open={sRestart !== null} title="เริ่มการศึกษาใหม่" subtitle="ข้อมูลเดิมย้ายไปเป็นประวัติ ไม่นำมาคำนวณ" onClose={close} size="sm">
        {sRestart && <TextForm label="เปลี่ยนอะไรในกระบวนการ" button="เริ่มการศึกษาใหม่" onCancel={close} onDone={close} submit={(t) => { restartChart(sRestart.code, t); notify(`เริ่มการศึกษา ${sRestart.code} ใหม่แล้ว · ต้องเก็บ 25 กลุ่มย่อย`, "info"); }} />}
      </FormModal>
      <FormModal open={msa !== null} title="บันทึกการศึกษา Gage R&R" subtitle="10 ชิ้น × 3 ผู้วัด × 3 ครั้ง · วิธีค่าเฉลี่ยและพิสัย" onClose={close} size="lg">
        {msa && <StudyForm characteristic={msa.characteristic} onCancel={close} onDone={(no) => { close(); onOpen("msa", no); }} />}
      </FormModal>
      <FormModal open={el !== null} title={el?.element ?? ""} subtitle={el ? (AUTO_ELEMENTS.includes(el.element) ? "ระบบตัดสินจากข้อมูลจริง" : el.no) : undefined} onClose={close} size="sm">
        {el && <ElementForm key={el.element} no={el.no} element={el.element} onCancel={close} onDone={close} />}
      </FormModal>
      <FormModal open={dec !== null} title="บันทึกผล PPAP จากลูกค้า" subtitle={dec?.no} onClose={close} size="sm">
        {dec && <DecisionForm key={dec.no} no={dec.no} onCancel={close} onDone={close} />}
      </FormModal>
      <FormModal open={gate !== null} title="ประตูผ่านเฟส APQP" subtitle={gate?.no} onClose={close} size="sm">
        {gate && <GateForm key={gate.no} no={gate.no} onCancel={close} onDone={close} />}
      </FormModal>
      <FormModal open={print !== null} title={print?.title ?? ""} subtitle="ตัวอย่างก่อนพิมพ์ — กระดาษ A4 พิมพ์เฉพาะเอกสาร" onClose={close} size="lg">
        {print && (
          <div className="space-y-3">
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={close}>ปิด</Button>
              <Button icon={<Printer size={14} />} onClick={printDocument}>พิมพ์</Button>
            </div>
            <CtPaper d={print.d} />
          </div>
        )}
      </FormModal>
    </>
  );
}

