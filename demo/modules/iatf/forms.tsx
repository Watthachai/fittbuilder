import { useState } from "react";
import { Printer } from "lucide-react";
import { DOCUMENTS, TODAY } from "../ims/data";
import { Actions, Area, Choice, Form, Input, people, tryRun } from "../ims/parts";
import {
  PSR, SHIFTS, TRACE_LIMIT_MINUTES, addCsr, automotiveCustomers, closeSupplierAudit, contingencyByCode, csrById,
  csrErrors, customerName, deviceByCode, implementCsr, planSupplierAudit, rating, recordScorecard, recordTrace, scorecardErrors,
  supplierAuditByNo, supplierAuditErrors, testContingency, testErrors, traceErrors, vendorName, verifyDevice, verifyErrors,
} from "./data";
import type { Shift } from "./data";
import { PARTS } from "../ct/data";
import { VENDORS } from "../mm/data";
import { IatfPaper } from "./documents";
import type { IatfDoc } from "./documents";
import { Button, Note, Segmented } from "../ui";
import { Field, FormModal, notify, printDocument, useData } from "../kit";

/** ทุกการกระทำของข้อกำหนด IATF ยกขึ้นแบบเดียวกันจากทุกหน้า */
export type Act =
  | { kind: "csr-new" }
  | { kind: "csr-implement"; id: number }
  | { kind: "trace-new" }
  | { kind: "contingency-test"; code: string }
  | { kind: "supplier-audit-new"; vendor?: string }
  | { kind: "supplier-audit-close"; no: string }
  | { kind: "scorecard-new" }
  | { kind: "device-verify"; code: string; shift?: Shift }
  | { kind: "print"; d: IatfDoc; title: string };

type Of<K extends Act["kind"]> = Extract<Act, { kind: K }>;
export type RecordKind = "contingency" | "supplier-audit" | "device";

function CsrForm({ onCancel, onDone }: { onCancel: () => void; onDone: () => void }) {
  const [v, setV] = useState({ customer: automotiveCustomers()[0] ?? "", source: "", clause: "", requirement: "", owner: "ธนพล เจริญผล" });
  const [tried, setTried] = useState(false);
  const errors = tried ? csrErrors(v) : {};
  const set = (k: keyof typeof v) => (x: string) => setV((s) => ({ ...s, [k]: x }));
  return (
    <Form onSubmit={() => { setTried(true); if (Object.keys(csrErrors(v)).length) return; addCsr(v); notify("เพิ่มข้อกำหนดเฉพาะลูกค้าแล้ว · ยังไม่ได้ทำ"); onDone(); }}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="ลูกค้า" error={errors.customer}><Choice value={v.customer} onChange={set("customer")} options={automotiveCustomers().map((c) => ({ value: c, label: customerName(c) }))} /></Field>
        <Field label="ข้อ IATF" error={errors.clause}><Input value={v.clause} onChange={set("clause")} error={errors.clause} placeholder="8.5.2.1" /></Field>
      </div>
      <Field label="เอกสารต้นทางของลูกค้า" error={errors.source}><Input value={v.source} onChange={set("source")} error={errors.source} placeholder="คู่มือคุณภาพผู้ส่งมอบของลูกค้า" /></Field>
      <Field label="ข้อกำหนด" error={errors.requirement}><Area value={v.requirement} onChange={set("requirement")} error={errors.requirement} rows={2} /></Field>
      <Field label="ผู้รับผิดชอบ" error={errors.owner}><Choice value={v.owner} onChange={set("owner")} options={people()} /></Field>
      <Actions onCancel={onCancel} label="เพิ่มข้อกำหนด" />
    </Form>
  );
}

function ImplementForm({ id, onCancel, onDone }: { id: number; onCancel: () => void; onDone: () => void }) {
  const c = csrById(id);
  const [doc, setDoc] = useState(c.doc ?? "");
  const [error, setError] = useState("");
  return (
    <Form error={error} onSubmit={() => tryRun(() => { implementCsr(id, doc); notify(`นำข้อกำหนดไปใช้ใน ${doc} แล้ว`); onDone(); }, setError)}>
      <p className="text-[13px] text-slate-600 dark:text-slate-300">{c.requirement}</p>
      <Field label="เอกสารควบคุมที่รองรับ" hint="ต้องเป็นเอกสารที่ใช้งานอยู่ในทะเบียนกลาง"><Choice value={doc} onChange={setDoc} placeholder="เลือกเอกสาร…" options={DOCUMENTS.filter((d) => d.level !== "แบบฟอร์ม").map((d) => ({ value: d.code, label: `${d.code} · ${d.title} (${d.status})` }))} /></Field>
      <Actions onCancel={onCancel} label="นำไปใช้" />
    </Form>
  );
}

function TraceForm({ onCancel, onDone }: { onCancel: () => void; onDone: () => void }) {
  const [v, setV] = useState({ part: PARTS[0]?.code ?? "", lot: "", tracedTo: "", minutes: "", date: TODAY, by: PSR });
  const [tried, setTried] = useState(false);
  const input = { ...v, minutes: Number(v.minutes) };
  const errors = tried ? traceErrors(input) : {};
  const set = (k: keyof typeof v) => (x: string) => setV((s) => ({ ...s, [k]: x }));
  return (
    <Form onSubmit={() => { setTried(true); if (Object.keys(traceErrors(input)).length) return; const d = recordTrace(input); notify(d.minutes <= TRACE_LIMIT_MINUTES ? `บันทึก ${d.no} แล้ว · ผ่าน` : `${d.no} ใช้เวลาเกิน ${TRACE_LIMIT_MINUTES} นาที`, d.minutes <= TRACE_LIMIT_MINUTES ? "ok" : "warn"); onDone(); }}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="ชิ้นส่วน" error={errors.part}><Choice value={v.part} onChange={set("part")} options={PARTS.map((p) => ({ value: p.code, label: `${p.code} · ${p.customerPart}` }))} /></Field>
        <Field label="ล็อตที่ทดสอบ" error={errors.lot}><Input value={v.lot} onChange={set("lot")} error={errors.lot} /></Field>
        <Field label="เวลาที่ใช้ (นาที)" error={errors.minutes} hint={`ลูกค้ากำหนดไม่เกิน ${TRACE_LIMIT_MINUTES} นาที`}><Input type="number" value={v.minutes} onChange={set("minutes")} error={errors.minutes} /></Field>
        <Field label="วันที่" error={errors.date}><Input type="date" value={v.date} onChange={set("date")} error={errors.date} /></Field>
      </div>
      <Field label="สอบกลับไปถึง" error={errors.tracedTo}><Area value={v.tracedTo} onChange={set("tracedTo")} error={errors.tracedTo} rows={2} /></Field>
      <Field label="ผู้ทดสอบ" error={errors.by}><Choice value={v.by} onChange={set("by")} options={people()} /></Field>
      <Actions onCancel={onCancel} label="บันทึกผลทดสอบ" />
    </Form>
  );
}

function TestForm({ code, onCancel, onDone }: { code: string; onCancel: () => void; onDone: () => void }) {
  const c = contingencyByCode(code);
  const [v, setV] = useState({ result: "ผ่าน" as "ผ่าน" | "ต้องปรับปรุง", note: "", by: c.owner, date: TODAY });
  const [tried, setTried] = useState(false);
  const errors = tried ? testErrors(code, v) : {};
  return (
    <Form onSubmit={() => { setTried(true); if (Object.keys(testErrors(code, v)).length) return; testContingency(code, v); notify(`บันทึกผลทดสอบ ${code} แล้ว · ${v.result}`, v.result === "ผ่าน" ? "ok" : "warn"); onDone(); }}>
      <p className="text-[13px] text-slate-600 dark:text-slate-300">{c.scenario}</p>
      <Field label="ผล"><Segmented options={["ผ่าน", "ต้องปรับปรุง"]} value={v.result} onChange={(x) => setV((s) => ({ ...s, result: x as "ผ่าน" | "ต้องปรับปรุง" }))} /></Field>
      <Field label="วิธีทดสอบและสิ่งที่พบ" error={errors.note}><Area value={v.note} onChange={(x) => setV((s) => ({ ...s, note: x }))} error={errors.note} /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="ผู้ทดสอบ" error={errors.by}><Choice value={v.by} onChange={(x) => setV((s) => ({ ...s, by: x }))} options={people()} /></Field>
        <Field label="วันที่" error={errors.date}><Input type="date" value={v.date} onChange={(x) => setV((s) => ({ ...s, date: x }))} error={errors.date} /></Field>
      </div>
      <Actions onCancel={onCancel} label="บันทึกผลทดสอบ" />
    </Form>
  );
}

function AuditForm({ vendor, onCancel, onDone }: { vendor?: string; onCancel: () => void; onDone: (no: string) => void }) {
  const [v, setV] = useState({ vendor: vendor ?? VENDORS[0].code, planned: "", auditor: "ธนพล เจริญผล" });
  const [tried, setTried] = useState(false);
  const errors = tried ? supplierAuditErrors(v) : {};
  const set = (k: keyof typeof v) => (x: string) => setV((s) => ({ ...s, [k]: x }));
  return (
    <Form onSubmit={() => { setTried(true); if (Object.keys(supplierAuditErrors(v)).length) return; const a = planSupplierAudit(v); notify(`วางแผนตรวจ ${a.no} ${vendorName(a.vendor)} แล้ว`); onDone(a.no); }}>
      <Field label="ผู้ส่งมอบ" error={errors.vendor}><Choice value={v.vendor} onChange={set("vendor")} options={VENDORS.map((x) => ({ value: x.code, label: `${x.code} · ${x.name}` }))} error={errors.vendor} /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="วันที่ตรวจ" error={errors.planned}><Input type="date" value={v.planned} onChange={set("planned")} error={errors.planned} /></Field>
        <Field label="ผู้ตรวจ" error={errors.auditor} hint="ต้องผ่าน VDA 6.3 และ Core Tools"><Choice value={v.auditor} onChange={set("auditor")} options={people()} error={errors.auditor} /></Field>
      </div>
      <Actions onCancel={onCancel} label="วางแผนการตรวจ" />
    </Form>
  );
}

function CloseAuditForm({ no, onCancel, onDone }: { no: string; onCancel: () => void; onDone: () => void }) {
  const [score, setScore] = useState("");
  const [findings, setFindings] = useState("");
  const [error, setError] = useState("");
  return (
    <Form error={error} onSubmit={() => tryRun(() => { const { car } = closeSupplierAudit(no, { score: Number(score), findings }); notify(car ? `ปิด ${no} แล้ว · เกรด C เปิด ${car.no} ให้พัฒนาผู้ส่งมอบ` : `ปิด ${no} แล้ว`, car ? "warn" : "ok"); onDone(); }, setError)}>
      <p className="text-[13px] text-slate-600 dark:text-slate-300">{vendorName(supplierAuditByNo(no).vendor)}</p>
      <Field label="คะแนน VDA 6.3 (%)" hint="90 ขึ้นไป A · 80–89 B · ต่ำกว่า 80 C เปิด 8D ให้ผู้ส่งมอบ"><Input type="number" value={score} onChange={setScore} /></Field>
      <Field label="สิ่งที่พบ"><Area value={findings} onChange={setFindings} /></Field>
      <Actions onCancel={onCancel} label="บันทึกผลตรวจ" />
    </Form>
  );
}

function ScorecardForm({ onCancel, onDone }: { onCancel: () => void; onDone: () => void }) {
  const [v, setV] = useState({ month: TODAY.slice(0, 7), customer: automotiveCustomers()[0] ?? "", ppm: "0", delivery: "100", premiumFreight: "0", disruptions: "0" });
  const [tried, setTried] = useState(false);
  const input = { month: v.month, customer: v.customer, ppm: Number(v.ppm), delivery: Number(v.delivery), premiumFreight: Number(v.premiumFreight), disruptions: Number(v.disruptions) };
  const errors = tried ? scorecardErrors(input) : {};
  const set = (k: keyof typeof v) => (x: string) => setV((s) => ({ ...s, [k]: x }));
  const r = rating(input);
  return (
    <Form onSubmit={() => { setTried(true); if (Object.keys(scorecardErrors(input)).length) return; const { car } = recordScorecard(input); notify(car ? `ระดับแดง · เปิด ${car.no} (8D) แล้ว` : `บันทึก scorecard ${v.month} แล้ว · ${r}`, car ? "warn" : "ok"); onDone(); }}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="ลูกค้า" error={errors.customer}><Choice value={v.customer} onChange={set("customer")} options={automotiveCustomers().map((c) => ({ value: c, label: customerName(c) }))} /></Field>
        <Field label="เดือน" error={errors.month}><Input type="month" value={v.month} onChange={set("month")} error={errors.month} /></Field>
        <Field label="PPM ที่ลูกค้ารายงาน" error={errors.ppm}><Input type="number" value={v.ppm} onChange={set("ppm")} error={errors.ppm} /></Field>
        <Field label="ส่งตรงเวลา (%)" error={errors.delivery}><Input type="number" value={v.delivery} onChange={set("delivery")} error={errors.delivery} /></Field>
        <Field label="ขนส่งด่วนพิเศษ (ครั้ง)" error={errors.premiumFreight}><Input type="number" value={v.premiumFreight} onChange={set("premiumFreight")} error={errors.premiumFreight} /></Field>
        <Field label="กระทบสายการผลิตลูกค้า (ครั้ง)" error={errors.disruptions}><Input type="number" value={v.disruptions} onChange={set("disruptions")} error={errors.disruptions} /></Field>
      </div>
      <Note tone={r === "เขียว" ? "ok" : r === "เหลือง" ? "warn" : "bad"}>ระดับ{r}{r === "แดง" ? " — จะเปิด 8D ให้ทันที" : ""}</Note>
      <Actions onCancel={onCancel} label="บันทึก scorecard" />
    </Form>
  );
}

function VerifyForm({ code, shift: initial, onCancel, onDone }: { code: string; shift?: Shift; onCancel: () => void; onDone: () => void }) {
  const d = deviceByCode(code);
  const [v, setV] = useState({ shift: initial ?? ("เช้า" as Shift), ok: "จับได้", by: "อนุชา ทองดี", note: "" });
  const [tried, setTried] = useState(false);
  const input = { shift: v.shift, ok: v.ok === "จับได้", by: v.by, note: v.note };
  const errors = tried ? verifyErrors(code, input) : {};
  return (
    <Form onSubmit={() => { setTried(true); if (Object.keys(verifyErrors(code, input)).length) return; const { car } = verifyDevice(code, input); notify(car ? `${code} ไม่จับชิ้นต้นแบบเสีย · หยุดใช้และเปิด ${car.no}` : `ทวนสอบ ${code} กะ${v.shift}แล้ว`, car ? "bad" : "ok"); onDone(); }}>
      <p className="text-[13px] text-slate-600 dark:text-slate-300">{d.name} · ทดสอบด้วย {d.master}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="กะ" error={errors.shift}><Segmented options={SHIFTS} value={v.shift} onChange={(x) => setV((s) => ({ ...s, shift: x as Shift }))} /></Field>
        <Field label="ผล"><Segmented options={["จับได้", "ไม่จับ"]} value={v.ok} onChange={(x) => setV((s) => ({ ...s, ok: x }))} /></Field>
      </div>
      {v.ok === "ไม่จับ" && <Note tone="bad">อุปกรณ์จะหยุดใช้ ต้องตรวจ 100% ด้วยมือและกักชิ้นงานตั้งแต่ครั้งทวนสอบก่อน</Note>}
      <Field label="หมายเหตุ" error={errors.note}><Area value={v.note} onChange={(x) => setV((s) => ({ ...s, note: x }))} error={errors.note} rows={2} /></Field>
      <Field label="ผู้ทวนสอบ" error={errors.by}><Choice value={v.by} onChange={(x) => setV((s) => ({ ...s, by: x }))} options={people()} /></Field>
      <Actions onCancel={onCancel} label="บันทึกการทวนสอบ" />
    </Form>
  );
}

export function IatfActions({ act, onAct, onOpen }: { act: Act | null; onAct: (a: Act | null) => void; onOpen: (kind: RecordKind, key: string) => void }) {
  useData();
  const close = () => onAct(null);
  const pick = <K extends Act["kind"]>(kind: K) => (act?.kind === kind ? (act as Of<K>) : null);
  const impl = pick("csr-implement");
  const test = pick("contingency-test");
  const aNew = pick("supplier-audit-new");
  const aClose = pick("supplier-audit-close");
  const verify = pick("device-verify");
  const print = pick("print");
  return (
    <>
      <FormModal open={act?.kind === "csr-new"} title="เพิ่มข้อกำหนดเฉพาะลูกค้า" subtitle="IATF 4.3.2" onClose={close}>
        {act?.kind === "csr-new" && <CsrForm onCancel={close} onDone={close} />}
      </FormModal>
      <FormModal open={impl !== null} title="นำข้อกำหนดไปใช้" subtitle={impl ? `ข้อ ${csrById(impl.id).clause} · ${customerName(csrById(impl.id).customer)}` : undefined} onClose={close} size="sm">
        {impl && <ImplementForm key={impl.id} id={impl.id} onCancel={close} onDone={close} />}
      </FormModal>
      <FormModal open={act?.kind === "trace-new"} title="ทดสอบการสอบกลับ" subtitle="จากชิ้นงานถึงล็อตวัตถุดิบ ภายในเวลาที่ลูกค้ากำหนด" onClose={close}>
        {act?.kind === "trace-new" && <TraceForm onCancel={close} onDone={close} />}
      </FormModal>
      <FormModal open={test !== null} title="ทดสอบแผนฉุกเฉิน" subtitle={test?.code} onClose={close}>
        {test && <TestForm key={test.code} code={test.code} onCancel={close} onDone={close} />}
      </FormModal>
      <FormModal open={aNew !== null} title="วางแผนตรวจประเมินผู้ส่งมอบ" subtitle="IATF 8.4.2.4.1 · ผู้ตรวจตาม 7.2.4" onClose={close} size="sm">
        {aNew && <AuditForm vendor={aNew.vendor} onCancel={close} onDone={(no) => { close(); onOpen("supplier-audit", no); }} />}
      </FormModal>
      <FormModal open={aClose !== null} title="บันทึกผลตรวจผู้ส่งมอบ" subtitle={aClose?.no} onClose={close} size="sm">
        {aClose && <CloseAuditForm key={aClose.no} no={aClose.no} onCancel={close} onDone={close} />}
      </FormModal>
      <FormModal open={act?.kind === "scorecard-new"} title="บันทึก scorecard จากลูกค้า" subtitle="IATF 9.1.2.1" onClose={close}>
        {act?.kind === "scorecard-new" && <ScorecardForm onCancel={close} onDone={close} />}
      </FormModal>
      <FormModal open={verify !== null} title="ทวนสอบอุปกรณ์ป้องกันความผิดพลาด" subtitle={verify?.code} onClose={close} size="sm">
        {verify && <VerifyForm key={`${verify.code}-${verify.shift}`} code={verify.code} shift={verify.shift} onCancel={close} onDone={close} />}
      </FormModal>
      <FormModal open={print !== null} title={print?.title ?? ""} subtitle="ตัวอย่างก่อนพิมพ์ — กระดาษ A4 พิมพ์เฉพาะเอกสาร" onClose={close} size="lg">
        {print && (
          <div className="space-y-3">
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={close}>ปิด</Button>
              <Button icon={<Printer size={14} />} onClick={printDocument}>พิมพ์</Button>
            </div>
            <IatfPaper d={print.d} />
          </div>
        )}
      </FormModal>
    </>
  );
}

