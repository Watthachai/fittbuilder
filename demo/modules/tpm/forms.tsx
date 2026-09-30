import { useState } from "react";
import { Plus, Printer, Trash2 } from "lucide-react";
import { TODAY } from "../ims/data";
import { Actions, Area, Choice, Form, Input, people, tryRun } from "../ims/parts";
import { MATERIALS } from "../mm/data";
import { WORK_CENTERS } from "../pp/data";
import {
  KINDS, MACHINES, addMachine, addSpare, breakdownErrors, completeRepair, machineByCode, machineErrors, planByCode, pmErrors, recordPm,
  recordShots, repairErrors, reportBreakdown, requestByNo, spareErrors, startRepair,
} from "./data";
import type { Kind } from "./data";
import { TpmPaper } from "./documents";
import type { TpmDoc } from "./documents";
import { Button, Note, Segmented } from "../ui";
import { Field, FormModal, notify, printDocument, useData } from "../kit";

/** ทุกการกระทำของงานบำรุงรักษายกขึ้นแบบเดียวกันจากทุกหน้า */
export type Act =
  | { kind: "machine-new" }
  | { kind: "shots"; code: string }
  | { kind: "pm-record"; code: string }
  | { kind: "breakdown"; machine?: string }
  | { kind: "repair-start"; no: string }
  | { kind: "repair-complete"; no: string }
  | { kind: "spare-new" }
  | { kind: "print"; d: TpmDoc; title: string };

type Of<K extends Act["kind"]> = Extract<Act, { kind: K }>;
export type RecordKind = "machine" | "request";

const machineOptions = () => MACHINES.map((m) => ({ value: m.code, label: `${m.code} · ${m.name}` }));
const materialOptions = () => MATERIALS.map((m) => ({ value: m.code, label: `${m.code} · ${m.name} (คงเหลือ ${m.stock} ${m.unit})` }));

function MachineForm({ onCancel, onDone }: { onCancel: () => void; onDone: (code: string) => void }) {
  const [v, setV] = useState({ code: "", name: "", kind: "เครื่องจักร" as Kind, wc: WORK_CENTERS[0].code, critical: "ไม่ใช่", maker: "", installed: TODAY });
  const [tried, setTried] = useState(false);
  const input = { code: v.code, name: v.name, kind: v.kind, wc: v.wc, critical: v.critical === "ใช่", maker: v.maker, installed: v.installed };
  const errors = tried ? machineErrors(input) : {};
  const set = (k: keyof typeof v) => (x: string) => setV((s) => ({ ...s, [k]: x }));
  return (
    <Form onSubmit={() => { setTried(true); if (Object.keys(machineErrors(input)).length) return; const m = addMachine(input); notify(`ขึ้นทะเบียน ${m.code} แล้ว`); onDone(m.code); }}>
      <Field label="ประเภท"><Segmented options={KINDS} value={v.kind} onChange={(x) => setV((s) => ({ ...s, kind: x as Kind }))} /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="รหัส" error={errors.code}><Input value={v.code} onChange={set("code")} error={errors.code} placeholder={v.kind === "แม่พิมพ์" ? "DIE-XXXX" : "M-XX-00"} /></Field>
        <Field label="ชื่อ" error={errors.name}><Input value={v.name} onChange={set("name")} error={errors.name} /></Field>
        {v.kind !== "ระบบสนับสนุน" && <Field label="ศูนย์งาน" error={errors.wc}><Choice value={v.wc} onChange={set("wc")} options={WORK_CENTERS.map((w) => ({ value: w.code, label: `${w.code} · ${w.name}` }))} error={errors.wc} /></Field>}
        <Field label="ยี่ห้อและรุ่น"><Input value={v.maker} onChange={set("maker")} /></Field>
        <Field label="วันที่ติดตั้ง" error={errors.installed}><Input type="date" value={v.installed} onChange={set("installed")} error={errors.installed} /></Field>
        <Field label="เครื่องหลัก" hint="หยุดแล้วกระทบการส่งมอบลูกค้า"><Segmented options={["ไม่ใช่", "ใช่"]} value={v.critical} onChange={set("critical")} /></Field>
      </div>
      <Actions onCancel={onCancel} label="ขึ้นทะเบียน" />
    </Form>
  );
}

function ShotsForm({ code, onCancel, onDone }: { code: string; onCancel: () => void; onDone: () => void }) {
  const m = machineByCode(code);
  const [shots, setShots] = useState(String(m.shots ?? 0));
  const [error, setError] = useState("");
  return (
    <Form error={error} onSubmit={() => tryRun(() => { recordShots(code, Number(shots)); notify(`บันทึกมิเตอร์ ${code} แล้ว`); onDone(); }, setError)}>
      <p className="text-[13px] text-slate-600 dark:text-slate-300">{m.name} · มิเตอร์เดิม {(m.shots ?? 0).toLocaleString("th-TH")} ครั้ง</p>
      <Field label="จำนวนครั้งปั๊มสะสม"><Input type="number" value={shots} onChange={setShots} /></Field>
      <Actions onCancel={onCancel} label="บันทึกมิเตอร์" />
    </Form>
  );
}

function PmForm({ code, onCancel, onDone }: { code: string; onCancel: () => void; onDone: () => void }) {
  const p = planByCode(code);
  const [checked, setChecked] = useState<boolean[]>(p.checklist.map(() => true));
  const [v, setV] = useState({ by: p.type === "AM" ? "อนุชา ทองดี" : "ประสิทธิ์ ขยันยิ่ง", findings: "", date: TODAY });
  const [tried, setTried] = useState(false);
  const input = { ...v, checked };
  const errors = tried ? pmErrors(code, input) : {};
  return (
    <Form onSubmit={() => { setTried(true); if (Object.keys(pmErrors(code, input)).length) return; recordPm(code, input); notify(checked.every(Boolean) ? `บันทึก ${code} แล้ว · เริ่มรอบใหม่` : `บันทึก ${code} แล้ว · มีข้อไม่ผ่าน`, checked.every(Boolean) ? "ok" : "warn"); onDone(); }}>
      <p className="text-[13px] text-slate-600 dark:text-slate-300">{machineByCode(p.machine).name} · {p.task}</p>
      <Field label="รายการตรวจ" error={errors.checked}>
        <div className="space-y-1.5">
          {p.checklist.map((c, i) => (
            <div key={c} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-1.5 dark:bg-slate-800/50">
              <span className="text-[12.5px] text-slate-700 dark:text-slate-200">{c}</span>
              <Segmented options={["ผ่าน", "ไม่ผ่าน"]} value={checked[i] ? "ผ่าน" : "ไม่ผ่าน"} onChange={(x) => setChecked((s) => s.map((y, j) => (j === i ? x === "ผ่าน" : y)))} />
            </div>
          ))}
        </div>
      </Field>
      <Field label="สิ่งที่พบ" error={errors.findings}><Area value={v.findings} onChange={(x) => setV((s) => ({ ...s, findings: x }))} error={errors.findings} rows={2} /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="ผู้ทำ" error={errors.by}><Choice value={v.by} onChange={(x) => setV((s) => ({ ...s, by: x }))} options={people()} /></Field>
        <Field label="วันที่" error={errors.date}><Input type="date" value={v.date} onChange={(x) => setV((s) => ({ ...s, date: x }))} error={errors.date} /></Field>
      </div>
      <Actions onCancel={onCancel} label="บันทึกผล" />
    </Form>
  );
}

function BreakdownForm({ machine, onCancel, onDone }: { machine?: string; onCancel: () => void; onDone: (no: string) => void }) {
  const [v, setV] = useState({ machine: machine ?? MACHINES[0].code, symptom: "", reportedBy: "อนุชา ทองดี" });
  const [tried, setTried] = useState(false);
  const errors = tried ? breakdownErrors(v) : {};
  const set = (k: keyof typeof v) => (x: string) => setV((s) => ({ ...s, [k]: x }));
  return (
    <Form onSubmit={() => { setTried(true); if (Object.keys(breakdownErrors(v)).length) return; const r = reportBreakdown(v); notify(`แจ้งซ่อม ${r.no} แล้ว`, "warn"); onDone(r.no); }}>
      <Field label="เครื่องจักร" error={errors.machine}><Choice value={v.machine} onChange={set("machine")} options={machineOptions()} error={errors.machine} /></Field>
      <Field label="อาการ" error={errors.symptom}><Area value={v.symptom} onChange={set("symptom")} error={errors.symptom} rows={2} /></Field>
      <Field label="ผู้แจ้ง" error={errors.reportedBy}><Choice value={v.reportedBy} onChange={set("reportedBy")} options={people()} /></Field>
      <Actions onCancel={onCancel} label="แจ้งซ่อม" />
    </Form>
  );
}

function StartForm({ no, onCancel, onDone }: { no: string; onCancel: () => void; onDone: () => void }) {
  const [tech, setTech] = useState("ประสิทธิ์ ขยันยิ่ง");
  const [error, setError] = useState("");
  const r = requestByNo(no);
  return (
    <Form error={error} onSubmit={() => tryRun(() => { startRepair(no, tech); notify(`เริ่มซ่อม ${no} แล้ว`); onDone(); }, setError)}>
      <p className="text-[13px] text-slate-600 dark:text-slate-300">{machineByCode(r.machine).name} · {r.symptom}</p>
      <Field label="ช่างผู้ซ่อม"><Choice value={tech} onChange={setTech} options={people()} /></Field>
      <Actions onCancel={onCancel} label="เริ่มซ่อม" />
    </Form>
  );
}

function CompleteForm({ no, onCancel, onDone }: { no: string; onCancel: () => void; onDone: () => void }) {
  const r = requestByNo(no);
  const [v, setV] = useState({ cause: "", fix: "", hours: "" });
  const [parts, setParts] = useState<{ material: string; qty: string }[]>([]);
  const [tried, setTried] = useState(false);
  const input = { cause: v.cause, fix: v.fix, hours: Number(v.hours), parts: parts.map((p) => ({ material: p.material, qty: Number(p.qty) })) };
  const errors = tried ? repairErrors(no, input) : {};
  const set = (k: keyof typeof v) => (x: string) => setV((s) => ({ ...s, [k]: x }));
  return (
    <Form onSubmit={() => { setTried(true); if (Object.keys(repairErrors(no, input)).length) return; const done = completeRepair(no, input); notify(done.parts.length ? `ปิด ${no} แล้ว · เบิกอะไหล่ ${done.parts.map((p) => p.doc).join(", ")}` : `ปิด ${no} แล้ว · เครื่องกลับมาใช้งาน`); onDone(); }}>
      <p className="text-[13px] text-slate-600 dark:text-slate-300">{machineByCode(r.machine).name} · {r.symptom}</p>
      <Field label="สาเหตุ" error={errors.cause}><Area value={v.cause} onChange={set("cause")} error={errors.cause} rows={2} /></Field>
      <Field label="สิ่งที่ทำ" error={errors.fix}><Area value={v.fix} onChange={set("fix")} error={errors.fix} rows={2} /></Field>
      <Field label="เวลาเครื่องหยุด (ชั่วโมง)" error={errors.hours} hint="ใช้คำนวณ OEE MTBF และ MTTR"><Input type="number" value={v.hours} onChange={set("hours")} error={errors.hours} /></Field>
      <Field label="อะไหล่ที่ใช้" error={errors.parts} hint="เบิกจากคลังวัสดุจริงใต้เลขใบแจ้งซ่อม">
        <div className="space-y-2">
          {parts.map((p, i) => (
            <div key={i} className="flex gap-2">
              <div className="min-w-0 flex-1"><Choice value={p.material} onChange={(x) => setParts((s) => s.map((y, j) => (j === i ? { ...y, material: x } : y)))} options={materialOptions()} /></div>
              <div className="w-24"><Input type="number" value={p.qty} onChange={(x) => setParts((s) => s.map((y, j) => (j === i ? { ...y, qty: x } : y)))} /></div>
              <Button variant="ghost" icon={<Trash2 size={14} />} onClick={() => setParts((s) => s.filter((_, j) => j !== i))}>ลบ</Button>
            </div>
          ))}
          <Button variant="secondary" icon={<Plus size={14} />} onClick={() => setParts((s) => [...s, { material: MATERIALS[0].code, qty: "1" }])}>เพิ่มอะไหล่</Button>
        </div>
      </Field>
      <Actions onCancel={onCancel} label="ปิดงานซ่อม" />
    </Form>
  );
}

function SpareForm({ onCancel, onDone }: { onCancel: () => void; onDone: () => void }) {
  const [v, setV] = useState({ material: MATERIALS[0].code, machine: MACHINES[0].code, min: "1" });
  const [tried, setTried] = useState(false);
  const input = { material: v.material, machine: v.machine, min: Number(v.min) };
  const errors = tried ? spareErrors(input) : {};
  const set = (k: keyof typeof v) => (x: string) => setV((s) => ({ ...s, [k]: x }));
  return (
    <Form onSubmit={() => { setTried(true); if (Object.keys(spareErrors(input)).length) return; addSpare(input); notify("เพิ่มอะไหล่วิกฤตแล้ว"); onDone(); }}>
      <Field label="อะไหล่จากคลังวัสดุ" error={errors.material}><Choice value={v.material} onChange={set("material")} options={materialOptions()} error={errors.material} /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="ใช้กับเครื่อง" error={errors.machine}><Choice value={v.machine} onChange={set("machine")} options={machineOptions()} error={errors.machine} /></Field>
        <Field label="ขั้นต่ำที่ต้องมี" error={errors.min}><Input type="number" value={v.min} onChange={set("min")} error={errors.min} /></Field>
      </div>
      <Note tone="info">ถ้าอะไหล่ชิ้นเดียวใช้กับหลายเครื่อง ขั้นต่ำจะรวมกันทุกเครื่อง</Note>
      <Actions onCancel={onCancel} label="เพิ่มอะไหล่วิกฤต" />
    </Form>
  );
}

export function TpmActions({ act, onAct, onOpen }: { act: Act | null; onAct: (a: Act | null) => void; onOpen: (kind: RecordKind, key: string) => void }) {
  useData();
  const close = () => onAct(null);
  const pick = <K extends Act["kind"]>(kind: K) => (act?.kind === kind ? (act as Of<K>) : null);
  const shots = pick("shots");
  const pm = pick("pm-record");
  const bd = pick("breakdown");
  const start = pick("repair-start");
  const complete = pick("repair-complete");
  const print = pick("print");
  return (
    <>
      <FormModal open={act?.kind === "machine-new"} title="ขึ้นทะเบียนเครื่องจักร" subtitle="เครื่องจักร แม่พิมพ์ หรือระบบสนับสนุน" onClose={close}>
        {act?.kind === "machine-new" && <MachineForm onCancel={close} onDone={(code) => { close(); onOpen("machine", code); }} />}
      </FormModal>
      <FormModal open={shots !== null} title="บันทึกมิเตอร์แม่พิมพ์" subtitle={shots?.code} onClose={close} size="sm">
        {shots && <ShotsForm key={shots.code} code={shots.code} onCancel={close} onDone={close} />}
      </FormModal>
      <FormModal open={pm !== null} title="บันทึกผลบำรุงรักษา" subtitle={pm?.code} onClose={close}>
        {pm && <PmForm key={pm.code} code={pm.code} onCancel={close} onDone={close} />}
      </FormModal>
      <FormModal open={bd !== null} title="แจ้งซ่อม" subtitle="เครื่องจะเปลี่ยนสถานะเป็นรอซ่อม" onClose={close} size="sm">
        {bd && <BreakdownForm machine={bd.machine} onCancel={close} onDone={(no) => { close(); onOpen("request", no); }} />}
      </FormModal>
      <FormModal open={start !== null} title="เริ่มซ่อม" subtitle={start?.no} onClose={close} size="sm">
        {start && <StartForm key={start.no} no={start.no} onCancel={close} onDone={close} />}
      </FormModal>
      <FormModal open={complete !== null} title="ปิดงานซ่อม" subtitle={complete?.no} onClose={close}>
        {complete && <CompleteForm key={complete.no} no={complete.no} onCancel={close} onDone={close} />}
      </FormModal>
      <FormModal open={act?.kind === "spare-new"} title="เพิ่มอะไหล่วิกฤต" subtitle="อ่านคงเหลือจากคลังวัสดุ" onClose={close} size="sm">
        {act?.kind === "spare-new" && <SpareForm onCancel={close} onDone={close} />}
      </FormModal>
      <FormModal open={print !== null} title={print?.title ?? ""} subtitle="ตัวอย่างก่อนพิมพ์ — กระดาษ A4 พิมพ์เฉพาะเอกสาร" onClose={close} size="lg">
        {print && (
          <div className="space-y-3">
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={close}>ปิด</Button>
              <Button icon={<Printer size={14} />} onClick={printDocument}>พิมพ์</Button>
            </div>
            <TpmPaper d={print.d} />
          </div>
        )}
      </FormModal>
    </>
  );
}
