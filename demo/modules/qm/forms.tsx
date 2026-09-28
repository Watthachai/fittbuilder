import { useState } from "react";
import type { ReactNode } from "react";
import { Printer } from "lucide-react";
import {
  CAUSE_CATEGORIES, CLAUSES, DECISIONS, DELIVERY_OPTIONS, DEPARTMENTS, DISPOSITIONS, DOC_TYPES, FINDING_TYPES,
  NCR_SOURCES, QMR, QM_TEAM, SEVERITIES, TODAY, actionErrors, addCapaAction, addFinding, addGauge, approveDocument,
  auditByNo, auditErrors, calErrors, capaByNo, capaErrors, closeNcr, closeNcrErrors, complaintErrors, createComplaint,
  createDocument, createLot, createNcr, decideLot, decisionErrors, disposeNcr, dispositionErrors, docByCode, docErrors,
  findingErrors, gaugeByCode, gaugeErrors, lotByNo, materialName, ncrByNo, ncrErrors, nextDocCode, obsoleteDocument,
  openCapa, pendingInspections, planAudit, planOf, recordCalibration, recordResults, recordRootCause, resultErrors,
  returnDocument, reviseDocument, revLabel, rootCauseErrors, verifyCapa,
} from "./data";
import type {
  CalInput, CapaInput, CauseCategory, Decision, Disposition, DocType, FindingType, NcrSource, Pending, Severity,
} from "./data";
import { MATERIALS } from "../mm/data";
import { DELIVERIES } from "../sd/data";
import { QmPaper } from "./documents";
import type { QmDoc } from "./documents";
import { Badge, Button, FIELD, Note, Segmented } from "../ui";
import { ConfirmDialog, Field, FormModal, notify, printDocument, useData } from "../kit";

/** ทุกการกระทำของฝ่ายคุณภาพ ยกขึ้นแบบเดียวกันจากทุกหน้า */
export type Act =
  | { kind: "doc-new" }
  | { kind: "doc-revise"; code: string }
  | { kind: "doc-approve"; code: string }
  | { kind: "doc-obsolete"; code: string }
  | { kind: "lot-new"; source?: string; material?: string }
  | { kind: "lot-results"; no: string }
  | { kind: "lot-decide"; no: string }
  | { kind: "ncr-new" }
  | { kind: "complaint-new" }
  | { kind: "ncr-dispose"; no: string }
  | { kind: "ncr-close"; no: string }
  | { kind: "car-new"; ref?: string; problem?: string }
  | { kind: "car-cause"; no: string }
  | { kind: "car-action"; no: string }
  | { kind: "car-verify"; no: string }
  | { kind: "audit-new" }
  | { kind: "audit-finding"; no: string }
  | { kind: "gauge-new" }
  | { kind: "gauge-cal"; code: string }
  | { kind: "print"; d: QmDoc; title: string };

type Of<K extends Act["kind"]> = Extract<Act, { kind: K }>;

/* ---------------------------------------------------------------- pieces */

const bad = (error?: string) => (error ? " border-rose-400 dark:border-rose-500" : "");

function Input({ value, onChange, error, type = "text", placeholder }: { value: string; onChange: (v: string) => void; error?: string; type?: string; placeholder?: string }) {
  return <input type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={FIELD + " w-full tabular-nums" + bad(error)} />;
}

function Area({ value, onChange, error, placeholder, rows = 3 }: { value: string; onChange: (v: string) => void; error?: string; placeholder?: string; rows?: number }) {
  return <textarea value={value} rows={rows} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={FIELD + " w-full resize-none" + bad(error)} />;
}

function Choice({ value, onChange, options, error, placeholder }: { value: string; onChange: (v: string) => void; options: readonly (string | { value: string; label: string })[]; error?: string; placeholder?: string }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={FIELD + " w-full" + bad(error)}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => {
        const opt = typeof o === "string" ? { value: o, label: o } : o;
        return <option key={opt.value} value={opt.value}>{opt.label}</option>;
      })}
    </select>
  );
}

function Actions({ onCancel, label, disabled }: { onCancel: () => void; label: string; disabled?: boolean }) {
  return (
    <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
      <Button variant="secondary" onClick={onCancel}>ยกเลิก</Button>
      <Button type="submit" disabled={disabled}>{label}</Button>
    </div>
  );
}

/** ฟอร์มที่ส่งแล้วเรียกฟังก์ชันของ data.ts — ข้อผิดพลาดจากกฎธุรกิจขึ้นใต้ฟอร์ม ไม่ใช่หน้าจอพัง */
function Form({ children, onSubmit, error }: { children: ReactNode; onSubmit: () => void; error?: string }) {
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      {children}
      {error && <Note tone="bad">{error}</Note>}
    </form>
  );
}

const people = (filter?: (p: (typeof QM_TEAM)[number]) => boolean) => QM_TEAM.filter(filter ?? (() => true)).map((p) => ({ value: p.name, label: `${p.name} · ${p.role}` }));
const tryRun = (fn: () => void, setError: (e: string) => void) => {
  try {
    fn();
  } catch (e) {
    setError(e instanceof Error ? e.message : String(e));
  }
};

/* ------------------------------------------------------------- documents */

function DocForm({ onCancel, onDone }: { onCancel: () => void; onDone: (code: string) => void }) {
  const [type, setType] = useState<DocType>("ขั้นตอนการปฏิบัติงาน");
  const [title, setTitle] = useState("");
  const [clause, setClause] = useState("");
  const [owner, setOwner] = useState("ฝ่ายประกันคุณภาพ");
  const [by, setBy] = useState("สุภาพร แก้วมณี");
  const [change, setChange] = useState("");
  const [tried, setTried] = useState(false);
  const input = { type, title, clause, owner, by, change };
  const errors = tried ? docErrors(input) : {};
  return (
    <Form
      onSubmit={() => {
        setTried(true);
        if (Object.keys(docErrors(input)).length) return;
        const d = createDocument(input);
        notify(`สร้างร่างเอกสาร ${d.code} แล้ว · ส่งอนุมัติเมื่อเขียนเสร็จ`);
        onDone(d.code);
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="ประเภท" hint={`รหัสที่จะได้ ${nextDocCode(type)}`}>
          <Choice value={type} onChange={(v) => setType(v as DocType)} options={DOC_TYPES} />
        </Field>
        <Field label="รองรับข้อกำหนด" error={errors.clause}>
          <Choice value={clause} onChange={setClause} placeholder="เลือกข้อกำหนด…" error={errors.clause} options={CLAUSES.map((c) => ({ value: c.code, label: `${c.code} ${c.name}` }))} />
        </Field>
      </div>
      <Field label="ชื่อเอกสาร" error={errors.title}>
        <Input value={title} onChange={setTitle} error={errors.title} placeholder="เช่น การจัดการข้อร้องเรียนลูกค้า" />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="ฝ่ายเจ้าของ" error={errors.owner}>
          <Choice value={owner} onChange={setOwner} options={DEPARTMENTS} />
        </Field>
        <Field label="ผู้จัดทำ" error={errors.by}>
          <Choice value={by} onChange={setBy} options={people()} />
        </Field>
      </div>
      <Field label="รายละเอียดการออกใช้" hint="ว่างไว้จะบันทึกเป็น “ออกใช้ครั้งแรก”">
        <Input value={change} onChange={setChange} placeholder="ออกใช้ครั้งแรก" />
      </Field>
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
      <Field label="แก้อะไร">
        <Area value={change} onChange={setChange} placeholder="เช่น เพิ่มขั้นตอนประเมินผู้ขายใหม่" />
      </Field>
      <Field label="ผู้จัดทำ">
        <Choice value={by} onChange={setBy} options={people()} />
      </Field>
      <Actions onCancel={onCancel} label={`เปิดฉบับ ${revLabel(d.rev + 1)}`} />
    </Form>
  );
}

function ApproveForm({ code, onCancel, onDone }: { code: string; onCancel: () => void; onDone: () => void }) {
  const d = docByCode(code);
  const [approver, setApprover] = useState(QMR);
  const [error, setError] = useState("");
  if (!d.draft) return <Note tone="idle">ไม่มีฉบับที่รออนุมัติ</Note>;
  return (
    <Form error={error} onSubmit={() => tryRun(() => { approveDocument(code, approver); notify(`อนุมัติ ${code} ${revLabel(d.rev)} แล้ว · มีผลวันนี้`); onDone(); }, setError)}>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px]">
        <dt className="text-slate-500">ฉบับ</dt>
        <dd>{revLabel(d.draft.rev)}</dd>
        <dt className="text-slate-500">รายละเอียด</dt>
        <dd>{d.draft.change}</dd>
        <dt className="text-slate-500">ผู้จัดทำ</dt>
        <dd>{d.draft.by} · {d.draft.date}</dd>
      </dl>
      <Field label="ผู้อนุมัติ" hint="ต้องไม่ใช่ผู้จัดทำ">
        <Choice value={approver} onChange={setApprover} options={people()} />
      </Field>
      <div className="flex justify-between gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
        <Button variant="ghost" onClick={() => tryRun(() => { returnDocument(code); notify(`ส่ง ${code} กลับไปแก้แล้ว`, "info"); onDone(); }, setError)}>
          ส่งกลับไปแก้
        </Button>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onCancel}>ยกเลิก</Button>
          <Button type="submit">อนุมัติและออกใช้</Button>
        </div>
      </div>
    </Form>
  );
}

/* ------------------------------------------------------------ inspection */

function LotNewForm({ source, material, onCancel, onDone }: { source?: string; material?: string; onCancel: () => void; onDone: (no: string) => void }) {
  const pending = pendingInspections();
  const keyOf = (p: Pending) => `${p.source}|${p.material}`;
  const [pick, setPick] = useState(source && material ? `${source}|${material}` : pending[0] ? keyOf(pending[0]) : "");
  const [error, setError] = useState("");
  const chosen = pending.find((p) => keyOf(p) === pick);
  if (pending.length === 0) return <Note tone="ok">ทุกใบรับของและทุกการรับสินค้าผลิตเสร็จเปิดล็อตตรวจแล้ว</Note>;
  return (
    <Form error={error} onSubmit={() => tryRun(() => { const l = createLot(chosen!); notify(`เปิดล็อตตรวจ ${l.no} แล้ว · สุ่ม ${l.sample} ตัวอย่าง`); onDone(l.no); }, setError)}>
      <Field label="ของที่รอตรวจ">
        <Choice value={pick} onChange={setPick} options={pending.map((p) => ({ value: keyOf(p), label: `${p.origin} · ${p.source} · ${materialName(p.material)} ${p.qty.toLocaleString("th-TH")}` }))} />
      </Field>
      {chosen && (
        <div className="rounded-xl bg-slate-50 p-3 text-[12.5px] text-slate-600 dark:bg-slate-800/50 dark:text-slate-300">
          ตรวจตามแผน {planOf(chosen.material).length} คุณลักษณะ: {planOf(chosen.material).map((c) => c.name).join(" · ")}
        </div>
      )}
      <Actions onCancel={onCancel} label="เปิดล็อตตรวจ" disabled={!chosen} />
    </Form>
  );
}

function ResultsForm({ no, onCancel, onDone }: { no: string; onCancel: () => void; onDone: () => void }) {
  const l = lotByNo(no);
  const plan = planOf(l.material);
  const [values, setValues] = useState<Record<string, { min: string; max: string; defects: string }>>(() =>
    Object.fromEntries(plan.map((c) => {
      const r = l.results.find((x) => x.characteristic === c.name);
      return [c.name, { min: r?.min?.toString() ?? "", max: r?.max?.toString() ?? "", defects: r?.defects?.toString() ?? "" }];
    })),
  );
  const [inspector, setInspector] = useState("สุภาพร แก้วมณี");
  const [tried, setTried] = useState(false);
  const input = plan.map((c) => {
    const v = values[c.name];
    return c.kind === "วัดค่า"
      ? { characteristic: c.name, min: v.min === "" ? undefined : Number(v.min), max: v.max === "" ? undefined : Number(v.max) }
      : { characteristic: c.name, defects: v.defects === "" ? undefined : Number(v.defects) };
  });
  const errors = tried ? resultErrors(no, input) : {};
  const set = (name: string, key: "min" | "max" | "defects", v: string) => setValues((s) => ({ ...s, [name]: { ...s[name], [key]: v } }));
  return (
    <Form
      onSubmit={() => {
        setTried(true);
        if (Object.keys(resultErrors(no, input)).length) return;
        const saved = recordResults(no, input, inspector);
        const failed = saved.results.filter((r) => !r.ok).length;
        notify(failed ? `บันทึกผล ${no} แล้ว · ไม่ผ่านเกณฑ์ ${failed} คุณลักษณะ` : `บันทึกผล ${no} แล้ว · ผ่านทุกคุณลักษณะ`, failed ? "warn" : "ok");
        onDone();
      }}
    >
      <p className="text-[12.5px] text-slate-500 dark:text-slate-400">สุ่ม {l.sample} จาก {l.qty.toLocaleString("th-TH")} · วัดค่าให้ใส่ค่าต่ำสุดและสูงสุดที่วัดได้ ตรวจพินิจให้ใส่จำนวนชิ้นที่พบข้อบกพร่อง</p>
      {plan.map((c) => (
        <Field key={c.name} label={`${c.name} · ${c.kind === "วัดค่า" ? `เกณฑ์ ${c.lsl}–${c.usl} ${c.unit ?? ""}` : "ต้องไม่พบข้อบกพร่อง"}`} hint={c.method} error={errors[c.name]}>
          {c.kind === "วัดค่า" ? (
            <div className="grid grid-cols-2 gap-2">
              <Input type="number" value={values[c.name].min} onChange={(v) => set(c.name, "min", v)} placeholder="ต่ำสุด" error={errors[c.name]} />
              <Input type="number" value={values[c.name].max} onChange={(v) => set(c.name, "max", v)} placeholder="สูงสุด" error={errors[c.name]} />
            </div>
          ) : (
            <Input type="number" value={values[c.name].defects} onChange={(v) => set(c.name, "defects", v)} placeholder="0" error={errors[c.name]} />
          )}
        </Field>
      ))}
      <Field label="ผู้ตรวจ">
        <Choice value={inspector} onChange={setInspector} options={people()} />
      </Field>
      <Actions onCancel={onCancel} label="บันทึกผลตรวจ" />
    </Form>
  );
}

function DecideForm({ no, onCancel, onDone }: { no: string; onCancel: () => void; onDone: (ncr?: string) => void }) {
  const l = lotByNo(no);
  const failing = l.results.filter((r) => !r.ok);
  const [decision, setDecision] = useState<Decision>(failing.length ? "ไม่ผ่าน" : "ผ่าน");
  const [by, setBy] = useState(failing.length ? QMR : "สุภาพร แก้วมณี");
  const [note, setNote] = useState("");
  const [tried, setTried] = useState(false);
  const errors = tried ? decisionErrors(no, decision, by, note) : {};
  return (
    <Form
      onSubmit={() => {
        setTried(true);
        if (Object.keys(decisionErrors(no, decision, by, note)).length) return;
        const { ncr } = decideLot(no, decision, by, note);
        notify(ncr ? `${no} ไม่ผ่าน · เปิด ${ncr.no} ให้สั่งการแล้ว` : `ตัดสิน ${no} แล้ว · ${decision}`, ncr ? "warn" : "ok");
        onDone(ncr?.no);
      }}
    >
      {failing.length > 0 ? (
        <Note tone="warn">ไม่ผ่านเกณฑ์: {failing.map((r) => r.characteristic).join(", ")}</Note>
      ) : (
        <Note tone="ok">ผ่านเกณฑ์ทุกคุณลักษณะ</Note>
      )}
      <Field label="ผลการตัดสิน" error={errors.decision}>
        <Segmented options={DECISIONS} value={decision} onChange={(v) => setDecision(v as Decision)} />
      </Field>
      <Field label="ผู้ตัดสิน" error={errors.by} hint={decision === "ยอมรับแบบมีเงื่อนไข" ? "การผ่อนผันต้องอนุมัติโดย QMR" : undefined}>
        <Choice value={by} onChange={setBy} options={people()} error={errors.by} />
      </Field>
      <Field label={decision === "ผ่าน" ? "หมายเหตุ (ถ้ามี)" : "สิ่งที่พบและเหตุผล"} error={errors.note}>
        <Area value={note} onChange={setNote} error={errors.note} placeholder={decision === "ไม่ผ่าน" ? "ไม่ผ่านจะเปิด NCR ให้อัตโนมัติ" : ""} />
      </Field>
      <Actions onCancel={onCancel} label="บันทึกผลการตัดสิน" />
    </Form>
  );
}

/* ------------------------------------------------------------------- ncr */

function NcrForm({ onCancel, onDone }: { onCancel: () => void; onDone: (no: string) => void }) {
  const [source, setSource] = useState<NcrSource>("ระหว่างผลิต");
  const [ref, setRef] = useState("");
  const [material, setMaterial] = useState("");
  const [qty, setQty] = useState("1");
  const [severity, setSeverity] = useState<Severity>("ปานกลาง");
  const [description, setDescription] = useState("");
  const [reportedBy, setReportedBy] = useState("อนุชา ทองดี");
  const [tried, setTried] = useState(false);
  const input = { source, ref, material, qty: Number(qty), description, severity, reportedBy };
  const errors = tried ? ncrErrors(input) : {};
  return (
    <Form
      onSubmit={() => {
        setTried(true);
        if (Object.keys(ncrErrors(input)).length) return;
        const n = createNcr(input);
        notify(`เปิด ${n.no} แล้ว · รอสั่งการ`, "warn");
        onDone(n.no);
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="พบที่">
          <Choice value={source} onChange={(v) => setSource(v as NcrSource)} options={NCR_SOURCES.filter((s) => s !== "ข้อร้องเรียนลูกค้า" && s !== "สอบเทียบเครื่องมือ")} />
        </Field>
        <Field label="เอกสารอ้างอิง" error={errors.ref} hint={source === "ระหว่างผลิต" ? "เลขใบสั่งผลิต เช่น PO-P-3301" : undefined}>
          <Input value={ref} onChange={setRef} error={errors.ref} placeholder={source === "ระหว่างผลิต" ? "PO-P-3301" : ""} />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
        <Field label="วัสดุหรือสินค้า" error={errors.material}>
          <Choice value={material} onChange={setMaterial} placeholder="เลือก…" options={MATERIALS.map((m) => ({ value: m.code, label: `${m.code} · ${m.name}` }))} />
        </Field>
        <Field label="จำนวน" error={errors.qty}>
          <Input type="number" value={qty} onChange={setQty} error={errors.qty} />
        </Field>
      </div>
      <Field label="ความรุนแรง">
        <Segmented options={SEVERITIES} value={severity} onChange={(v) => setSeverity(v as Severity)} />
      </Field>
      <Field label="สิ่งที่พบ" error={errors.description}>
        <Area value={description} onChange={setDescription} error={errors.description} />
      </Field>
      <Field label="ผู้รายงาน" error={errors.reportedBy}>
        <Choice value={reportedBy} onChange={setReportedBy} options={people()} />
      </Field>
      <Actions onCancel={onCancel} label="เปิด NCR" />
    </Form>
  );
}

function ComplaintForm({ onCancel, onDone }: { onCancel: () => void; onDone: (no: string) => void }) {
  const [delivery, setDelivery] = useState("");
  const d = DELIVERIES.find((x) => x.no === delivery);
  const [material, setMaterial] = useState("");
  const [qty, setQty] = useState("1");
  const [severity, setSeverity] = useState<Severity>("ปานกลาง");
  const [description, setDescription] = useState("");
  const [reportedBy, setReportedBy] = useState("ชลธิชา มั่นคง");
  const [tried, setTried] = useState(false);
  const input = { delivery, material, qty: Number(qty), description, severity, reportedBy };
  const errors = tried ? complaintErrors(input) : {};
  return (
    <Form
      onSubmit={() => {
        setTried(true);
        if (Object.keys(complaintErrors(input)).length) return;
        const n = createComplaint(input);
        notify(`รับเรื่องร้องเรียนเป็น ${n.no} แล้ว`, "warn");
        onDone(n.no);
      }}
    >
      <Field label="ใบส่งของที่ลูกค้าร้องเรียน" error={errors.delivery}>
        <Choice value={delivery} onChange={(v) => { setDelivery(v); setMaterial(""); }} placeholder="เลือกใบส่งของ…" error={errors.delivery} options={DELIVERY_OPTIONS()} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
        <Field label="สินค้า" error={errors.material}>
          <Choice value={material} onChange={setMaterial} placeholder="เลือก…" error={errors.material} options={(d?.lines ?? []).map((l) => ({ value: l.material, label: `${materialName(l.material)} · ส่ง ${l.qty}` }))} />
        </Field>
        <Field label="จำนวน" error={errors.qty}>
          <Input type="number" value={qty} onChange={setQty} error={errors.qty} />
        </Field>
      </div>
      <Field label="ความรุนแรง">
        <Segmented options={SEVERITIES} value={severity} onChange={(v) => setSeverity(v as Severity)} />
      </Field>
      <Field label="สิ่งที่ลูกค้าแจ้ง" error={errors.description}>
        <Area value={description} onChange={setDescription} error={errors.description} />
      </Field>
      <Field label="ผู้รับเรื่อง">
        <Choice value={reportedBy} onChange={setReportedBy} options={people()} />
      </Field>
      <Actions onCancel={onCancel} label="รับเรื่องร้องเรียน" />
    </Form>
  );
}

function DisposeForm({ no, onCancel, onDone }: { no: string; onCancel: () => void; onDone: () => void }) {
  const n = ncrByNo(no);
  const [disposition, setDisposition] = useState<Disposition>(n.vendor ? "ส่งคืนผู้ขาย" : "ซ่อมหรือทำใหม่");
  const [by, setBy] = useState(QMR);
  const [note, setNote] = useState("");
  const [tried, setTried] = useState(false);
  const input = { disposition, by, note };
  const errors = tried ? dispositionErrors(no, input) : {};
  const cutsStock = (disposition === "ทำลาย" || disposition === "ส่งคืนผู้ขาย") && ["ตรวจรับ", "ระหว่างผลิต", "ตรวจก่อนส่ง"].includes(n.source) && n.material;
  return (
    <Form
      onSubmit={() => {
        setTried(true);
        if (Object.keys(dispositionErrors(no, input)).length) return;
        const saved = disposeNcr(no, input);
        notify(saved.stockDoc ? `สั่งการ ${no} แล้ว · ตัดสต็อกตาม ${saved.stockDoc}` : `สั่งการ ${no} แล้ว`);
        onDone();
      }}
    >
      <p className="text-[13px] text-slate-600 dark:text-slate-300">{n.description}</p>
      <Field label="การสั่งการ" error={errors.disposition}>
        <Choice value={disposition} onChange={(v) => setDisposition(v as Disposition)} options={DISPOSITIONS} error={errors.disposition} />
      </Field>
      {cutsStock && <Note tone="info">ตัดสต็อก {materialName(n.material!)} ออก {n.qty.toLocaleString("th-TH")} ในคลังวัสดุ ใต้เลข {no}</Note>}
      <Field label="ผู้สั่งการ" error={errors.by}>
        <Choice value={by} onChange={setBy} options={people()} error={errors.by} />
      </Field>
      <Field label="สิ่งที่ต้องทำ" error={errors.note}>
        <Area value={note} onChange={setNote} error={errors.note} />
      </Field>
      <Actions onCancel={onCancel} label="บันทึกการสั่งการ" />
    </Form>
  );
}

/* ------------------------------------------------------------------ capa */

function CarForm({ refNo, problem: initial, onCancel, onDone }: { refNo?: string; problem?: string; onCancel: () => void; onDone: (no: string) => void }) {
  const [kind, setKind] = useState<CapaInput["kind"]>("แก้ไข");
  const [ref, setRef] = useState(refNo ?? "");
  const [problem, setProblem] = useState(initial ?? "");
  const [owner, setOwner] = useState("อนุชา ทองดี");
  const [tried, setTried] = useState(false);
  const input = { kind, ref, problem, owner };
  const errors = tried ? capaErrors(input) : {};
  return (
    <Form
      onSubmit={() => {
        setTried(true);
        if (Object.keys(capaErrors(input)).length) return;
        const c = openCapa(input);
        notify(`ออก ${c.no} ให้ ${owner} แล้ว · เริ่มจากหาสาเหตุราก`);
        onDone(c.no);
      }}
    >
      <Field label="ประเภท">
        <Segmented options={["แก้ไข", "ป้องกัน"]} value={kind} onChange={(v) => setKind(v as CapaInput["kind"])} />
      </Field>
      <Field label="ต้นเรื่อง" error={errors.ref} hint="เลข NCR หรือผลตรวจติดตาม เช่น IA-2569-03 #1">
        <Input value={ref} onChange={setRef} error={errors.ref} />
      </Field>
      <Field label="ปัญหาที่ต้องแก้" error={errors.problem}>
        <Area value={problem} onChange={setProblem} error={errors.problem} />
      </Field>
      <Field label="ผู้รับผิดชอบ" error={errors.owner}>
        <Choice value={owner} onChange={setOwner} options={people()} />
      </Field>
      <Actions onCancel={onCancel} label="ออกใบขอให้แก้ไข" />
    </Form>
  );
}

function CauseForm({ no, onCancel, onDone }: { no: string; onCancel: () => void; onDone: () => void }) {
  const c = capaByNo(no);
  const [category, setCategory] = useState<CauseCategory>(c.rootCause?.category ?? "วิธีการ");
  const [whys, setWhys] = useState<string[]>(() => [...(c.rootCause?.whys ?? []), "", "", "", "", ""].slice(0, 5));
  const [tried, setTried] = useState(false);
  const errors = tried ? rootCauseErrors({ category, whys }) : {};
  return (
    <Form
      onSubmit={() => {
        setTried(true);
        if (Object.keys(rootCauseErrors({ category, whys })).length) return;
        recordRootCause(no, { category, whys });
        notify(`บันทึกสาเหตุรากของ ${no} แล้ว`);
        onDone();
      }}
    >
      <p className="text-[13px] text-slate-600 dark:text-slate-300">{c.problem}</p>
      <Field label="กลุ่มสาเหตุ (ผังก้างปลา)">
        <Segmented options={CAUSE_CATEGORIES} value={category} onChange={(v) => setCategory(v as CauseCategory)} />
      </Field>
      <Field label="ถามทำไม 5 ชั้น" error={errors.whys} hint="ชั้นสุดท้ายที่ตอบได้คือสาเหตุราก อย่างน้อยสามชั้น">
        <div className="space-y-2">
          {whys.map((w, i) => (
            <Input key={i} value={w} onChange={(v) => setWhys((s) => s.map((x, j) => (j === i ? v : x)))} placeholder={`ทำไมครั้งที่ ${i + 1}`} error={i < 3 ? errors.whys : undefined} />
          ))}
        </div>
      </Field>
      <Actions onCancel={onCancel} label="บันทึกสาเหตุราก" />
    </Form>
  );
}

function ActionForm({ no, onCancel, onDone }: { no: string; onCancel: () => void; onDone: () => void }) {
  const c = capaByNo(no);
  const [what, setWhat] = useState("");
  const [owner, setOwner] = useState(c.owner);
  const [due, setDue] = useState("");
  const [tried, setTried] = useState(false);
  const input = { what, owner, due };
  const errors = tried ? actionErrors(input) : {};
  return (
    <Form
      onSubmit={() => {
        setTried(true);
        if (Object.keys(actionErrors(input)).length) return;
        addCapaAction(no, input);
        notify(`เพิ่มมาตรการใน ${no} แล้ว · กำหนดเสร็จ ${due}`);
        onDone();
      }}
    >
      <Field label="มาตรการ" error={errors.what}>
        <Area value={what} onChange={setWhat} error={errors.what} rows={2} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="ผู้รับผิดชอบ" error={errors.owner}>
          <Choice value={owner} onChange={setOwner} options={people()} />
        </Field>
        <Field label="กำหนดเสร็จ" error={errors.due}>
          <Input type="date" value={due} onChange={setDue} error={errors.due} />
        </Field>
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
  const [error, setError] = useState("");
  return (
    <Form
      error={error}
      onSubmit={() => tryRun(() => {
        const ok = effective === "ได้ผล";
        verifyCapa(no, { effective: ok, note, by });
        notify(ok ? `ปิด ${no} แล้ว · มาตรการได้ผล` : `${no} ยังไม่ได้ผล · กลับไปหาสาเหตุใหม่`, ok ? "ok" : "warn");
        onDone();
      }, setError)}
    >
      <Field label="ผลการติดตาม">
        <Segmented options={["ได้ผล", "ไม่ได้ผล"]} value={effective} onChange={setEffective} />
      </Field>
      <Field label="หลักฐาน" hint="เช่น สุ่มตรวจ 20 ชุดหลังแก้ ไม่พบปัญหาซ้ำ">
        <Area value={note} onChange={setNote} />
      </Field>
      <Field label="ผู้ติดตามผล" hint="ต้องไม่ใช่ผู้รับผิดชอบ CAR">
        <Choice value={by} onChange={setBy} options={people()} />
      </Field>
      <Actions onCancel={onCancel} label="บันทึกผลการติดตาม" />
    </Form>
  );
}

/* ----------------------------------------------------------------- audit */

function AuditForm({ onCancel, onDone }: { onCancel: () => void; onDone: (no: string) => void }) {
  const [area, setArea] = useState("ฝ่ายผลิต");
  const [clauses, setClauses] = useState<string[]>(["8.5"]);
  const [auditor, setAuditor] = useState("สุภาพร แก้วมณี");
  const [planned, setPlanned] = useState("");
  const [tried, setTried] = useState(false);
  const input = { area, clauses, auditor, planned };
  const errors = tried ? auditErrors(input) : {};
  const toggle = (c: string) => setClauses((s) => (s.includes(c) ? s.filter((x) => x !== c) : [...s, c]));
  return (
    <Form
      onSubmit={() => {
        setTried(true);
        if (Object.keys(auditErrors(input)).length) return;
        const a = planAudit(input);
        notify(`วางแผนตรวจ ${a.no} ${area} วันที่ ${planned} แล้ว`);
        onDone(a.no);
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="ฝ่ายที่จะตรวจ" error={errors.area}>
          <Choice value={area} onChange={setArea} options={DEPARTMENTS} />
        </Field>
        <Field label="วันที่ตรวจ" error={errors.planned}>
          <Input type="date" value={planned} onChange={setPlanned} error={errors.planned} />
        </Field>
      </div>
      <Field label="ผู้ตรวจ" error={errors.auditor} hint="ต้องผ่านการอบรม และไม่ตรวจฝ่ายของตัวเอง">
        <Choice value={auditor} onChange={setAuditor} options={people()} error={errors.auditor} />
      </Field>
      <Field label="ข้อกำหนดที่จะตรวจ" error={errors.clauses}>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {CLAUSES.map((c) => (
            <label key={c.code} className="flex items-center gap-2 text-[12.5px] text-slate-700 dark:text-slate-200">
              <input type="checkbox" checked={clauses.includes(c.code)} onChange={() => toggle(c.code)} className="size-4 accent-violet-600" />
              <span className="tabular-nums text-slate-400">{c.code}</span> {c.name}
            </label>
          ))}
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
  return (
    <Form
      onSubmit={() => {
        setTried(true);
        if (Object.keys(findingErrors(no, input)).length) return;
        addFinding(no, input);
        notify(`บันทึก${type}ใน ${no} แล้ว`, type === "ข้อสังเกต" ? "info" : "warn");
        onDone();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="ข้อกำหนด" error={errors.clause}>
          <Choice value={clause} onChange={setClause} options={CLAUSES.map((c) => ({ value: c.code, label: `${c.code} ${c.name}` }))} />
        </Field>
        <Field label="ประเภท">
          <Choice value={type} onChange={(v) => setType(v as FindingType)} options={FINDING_TYPES} />
        </Field>
      </div>
      <Field label="สิ่งที่พบและหลักฐาน" error={errors.detail}>
        <Area value={detail} onChange={setDetail} error={errors.detail} />
      </Field>
      <Actions onCancel={onCancel} label="บันทึกสิ่งที่พบ" />
    </Form>
  );
}

/* ----------------------------------------------------------- calibration */

function GaugeForm({ onCancel, onDone }: { onCancel: () => void; onDone: (code: string) => void }) {
  const [v, setV] = useState({ code: "QC-", name: "", range: "", resolution: "", location: "ห้อง QC", intervalMonths: 12, lastCal: TODAY });
  const [tried, setTried] = useState(false);
  const errors = tried ? gaugeErrors(v) : {};
  const set = (k: keyof typeof v) => (x: string) => setV((s) => ({ ...s, [k]: k === "intervalMonths" ? Number(x) : x }));
  return (
    <Form
      onSubmit={() => {
        setTried(true);
        if (Object.keys(gaugeErrors(v)).length) return;
        const g = addGauge(v);
        notify(`ขึ้นทะเบียนเครื่องมือ ${g.code} แล้ว`);
        onDone(g.code);
      }}
    >
      <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
        <Field label="รหัส" error={errors.code}><Input value={v.code} onChange={set("code")} error={errors.code} placeholder="QC-XX-00" /></Field>
        <Field label="ชื่อเครื่องมือ" error={errors.name}><Input value={v.name} onChange={set("name")} error={errors.name} /></Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="ช่วงการวัด" error={errors.range}><Input value={v.range} onChange={set("range")} error={errors.range} placeholder="0–150 มม." /></Field>
        <Field label="ความละเอียด"><Input value={v.resolution} onChange={set("resolution")} placeholder="0.01 มม." /></Field>
        <Field label="ที่ใช้งาน" error={errors.location}><Input value={v.location} onChange={set("location")} error={errors.location} /></Field>
        <Field label="รอบสอบเทียบ" error={errors.intervalMonths}>
          <Choice value={String(v.intervalMonths)} onChange={set("intervalMonths")} options={[3, 6, 12, 24].map((n) => ({ value: String(n), label: `ทุก ${n} เดือน` }))} />
        </Field>
      </div>
      <Field label="สอบเทียบล่าสุด" error={errors.lastCal}><Input type="date" value={v.lastCal} onChange={set("lastCal")} error={errors.lastCal} /></Field>
      <Actions onCancel={onCancel} label="ขึ้นทะเบียน" />
    </Form>
  );
}

function CalForm({ code, onCancel, onDone }: { code: string; onCancel: () => void; onDone: (ncr?: string) => void }) {
  const g = gaugeByCode(code);
  const [v, setV] = useState<CalInput>({ date: TODAY, by: g.records[g.records.length - 1]?.by ?? "", certNo: "", result: "ผ่าน", error: "", note: "" });
  const [tried, setTried] = useState(false);
  const errors = tried ? calErrors(code, v) : {};
  const set = (k: keyof CalInput) => (x: string) => setV((s) => ({ ...s, [k]: x }));
  return (
    <Form
      onSubmit={() => {
        setTried(true);
        if (Object.keys(calErrors(code, v)).length) return;
        const { ncr } = recordCalibration(code, v);
        notify(ncr ? `${code} ไม่ผ่าน · พักใช้และเปิด ${ncr.no} ให้ทบทวนผลการวัดแล้ว` : `บันทึกผลสอบเทียบ ${code} แล้ว · เริ่มรอบใหม่`, ncr ? "warn" : "ok");
        onDone(ncr?.no);
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="วันที่สอบเทียบ" error={errors.date}><Input type="date" value={v.date} onChange={set("date")} error={errors.date} /></Field>
        <Field label="ผล">
          <Segmented options={["ผ่าน", "ไม่ผ่าน"]} value={v.result} onChange={(x) => setV((s) => ({ ...s, result: x as CalInput["result"] }))} />
        </Field>
        <Field label="ผู้สอบเทียบ / ห้องปฏิบัติการ" error={errors.by}><Input value={v.by} onChange={set("by")} error={errors.by} /></Field>
        <Field label="เลขที่ใบรับรองผล" error={errors.certNo}><Input value={v.certNo} onChange={set("certNo")} error={errors.certNo} /></Field>
      </div>
      <Field label="ค่าคลาดเคลื่อนที่วัดได้" error={errors.error}><Input value={v.error} onChange={set("error")} error={errors.error} placeholder="+0.01 มม." /></Field>
      <Field label={v.result === "ไม่ผ่าน" ? "สิ่งที่พบ" : "หมายเหตุ (ถ้ามี)"} error={errors.note} hint={v.result === "ไม่ผ่าน" ? "ไม่ผ่านจะพักใช้เครื่องมือ และเปิด NCR ให้ทบทวนล็อตที่วัดด้วยเครื่องนี้" : undefined}>
        <Area value={v.note} onChange={set("note")} error={errors.note} rows={2} />
      </Field>
      <Actions onCancel={onCancel} label="บันทึกผลสอบเทียบ" />
    </Form>
  );
}

/* --------------------------------------------------------------- actions */

export function QmActions({ act, onAct, onOpen }: {
  act: Act | null;
  onAct: (a: Act | null) => void;
  /** เปิดแฟ้มของสิ่งที่เพิ่งสร้าง — ล็อต NCR หรือ CAR */
  onOpen: (kind: "lot" | "ncr" | "car" | "audit" | "doc" | "gauge", key: string) => void;
}) {
  useData();
  const close = () => onAct(null);
  const pick = <K extends Act["kind"]>(kind: K) => (act?.kind === kind ? (act as Of<K>) : null);
  const [obsReason, setObsReason] = useState("");
  const [closeBy, setCloseBy] = useState(QMR);

  const revise = pick("doc-revise");
  const approve = pick("doc-approve");
  const obsolete = pick("doc-obsolete");
  const lotNew = pick("lot-new");
  const results = pick("lot-results");
  const decide = pick("lot-decide");
  const dispose = pick("ncr-dispose");
  const ncrClose = pick("ncr-close");
  const carNew = pick("car-new");
  const cause = pick("car-cause");
  const action = pick("car-action");
  const verify = pick("car-verify");
  const finding = pick("audit-finding");
  const cal = pick("gauge-cal");
  const print = pick("print");
  const closeProblem = ncrClose ? closeNcrErrors(ncrClose.no).close : undefined;

  return (
    <>
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
        onConfirm={() => {
          if (!obsolete) return;
          obsoleteDocument(obsolete.code, obsReason);
          notify(`ยกเลิก ${obsolete.code} แล้ว`, "info");
          setObsReason("");
          close();
        }}
      />

      <FormModal open={lotNew !== null} title="เปิดล็อตตรวจ" subtitle="ของที่รับเข้ามาแล้วแต่ยังไม่ได้ตรวจ จากใบรับของและการรับสินค้าผลิตเสร็จ" onClose={close} size="sm">
        {lotNew && <LotNewForm source={lotNew.source} material={lotNew.material} onCancel={close} onDone={(no) => { close(); onOpen("lot", no); }} />}
      </FormModal>
      <FormModal open={results !== null} title="บันทึกผลตรวจ" subtitle={results ? `${results.no} · ${materialName(lotByNo(results.no).material)}` : undefined} onClose={close}>
        {results && <ResultsForm key={results.no} no={results.no} onCancel={close} onDone={close} />}
      </FormModal>
      <FormModal open={decide !== null} title="ตัดสินผลการตรวจ" subtitle={decide ? `${decide.no} · ${materialName(lotByNo(decide.no).material)}` : undefined} onClose={close} size="sm">
        {decide && <DecideForm key={decide.no} no={decide.no} onCancel={close} onDone={(ncr) => { close(); if (ncr) onOpen("ncr", ncr); }} />}
      </FormModal>

      <FormModal open={act?.kind === "ncr-new"} title="เปิดรายงานสิ่งที่ไม่เป็นไปตามข้อกำหนด" subtitle="พบของเสียระหว่างผลิตหรือจากการตรวจติดตาม" onClose={close}>
        {act?.kind === "ncr-new" && <NcrForm onCancel={close} onDone={(no) => { close(); onOpen("ncr", no); }} />}
      </FormModal>
      <FormModal open={act?.kind === "complaint-new"} title="รับเรื่องร้องเรียนจากลูกค้า" subtitle="อ้างใบส่งของจริงของฝ่ายขาย แล้วดำเนินการเป็น NCR" onClose={close}>
        {act?.kind === "complaint-new" && <ComplaintForm onCancel={close} onDone={(no) => { close(); onOpen("ncr", no); }} />}
      </FormModal>
      <FormModal open={dispose !== null} title="สั่งการ" subtitle={dispose?.no} onClose={close} size="sm">
        {dispose && <DisposeForm key={dispose.no} no={dispose.no} onCancel={close} onDone={close} />}
      </FormModal>
      <ConfirmDialog
        open={ncrClose !== null}
        title="ปิด NCR"
        body={closeProblem ?? "ยืนยันว่าดำเนินการตามที่สั่งการครบแล้ว"}
        subject={ncrClose ? <Badge tone="warn">{ncrClose.no}</Badge> : undefined}
        fields={<Field label="ผู้ปิดเรื่อง"><Choice value={closeBy} onChange={setCloseBy} options={people()} /></Field>}
        confirmLabel="ปิด NCR"
        disabled={!!closeProblem}
        onCancel={close}
        onConfirm={() => {
          if (!ncrClose) return;
          closeNcr(ncrClose.no, closeBy);
          notify(`ปิด ${ncrClose.no} แล้ว`);
          close();
        }}
      />

      <FormModal open={carNew !== null} title="ออกใบขอให้แก้ไขและป้องกัน (CAR)" subtitle="หาสาเหตุราก วางมาตรการ แล้วติดตามว่าได้ผลจริง" onClose={close}>
        {carNew && <CarForm refNo={carNew.ref} problem={carNew.problem} onCancel={close} onDone={(no) => { close(); onOpen("car", no); }} />}
      </FormModal>
      <FormModal open={cause !== null} title="หาสาเหตุราก" subtitle={cause?.no} onClose={close}>
        {cause && <CauseForm key={cause.no} no={cause.no} onCancel={close} onDone={close} />}
      </FormModal>
      <FormModal open={action !== null} title="เพิ่มมาตรการ" subtitle={action?.no} onClose={close} size="sm">
        {action && <ActionForm key={action.no} no={action.no} onCancel={close} onDone={close} />}
      </FormModal>
      <FormModal open={verify !== null} title="ติดตามประสิทธิผล" subtitle={verify?.no} onClose={close} size="sm">
        {verify && <VerifyForm key={verify.no} no={verify.no} onCancel={close} onDone={close} />}
      </FormModal>

      <FormModal open={act?.kind === "audit-new"} title="วางแผนการตรวจติดตามภายใน" subtitle="ระบบตรวจความเป็นอิสระของผู้ตรวจให้" onClose={close}>
        {act?.kind === "audit-new" && <AuditForm onCancel={close} onDone={(no) => { close(); onOpen("audit", no); }} />}
      </FormModal>
      <FormModal open={finding !== null} title="บันทึกสิ่งที่พบ" subtitle={finding ? `${finding.no} · ${auditByNo(finding.no).area}` : undefined} onClose={close}>
        {finding && <FindingForm key={finding.no} no={finding.no} onCancel={close} onDone={close} />}
      </FormModal>

      <FormModal open={act?.kind === "gauge-new"} title="ขึ้นทะเบียนเครื่องมือวัด" onClose={close}>
        {act?.kind === "gauge-new" && <GaugeForm onCancel={close} onDone={(code) => { close(); onOpen("gauge", code); }} />}
      </FormModal>
      <FormModal open={cal !== null} title="บันทึกผลสอบเทียบ" subtitle={cal ? `${cal.code} · ${gaugeByCode(cal.code).name}` : undefined} onClose={close}>
        {cal && <CalForm key={cal.code} code={cal.code} onCancel={close} onDone={(ncr) => { close(); if (ncr) onOpen("ncr", ncr); }} />}
      </FormModal>

      <FormModal open={print !== null} title={print?.title ?? ""} subtitle="ตัวอย่างก่อนพิมพ์ — กระดาษ A4 พิมพ์เฉพาะเอกสาร" onClose={close} size="lg">
        {print && (
          <div className="space-y-3">
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={close}>ปิด</Button>
              <Button icon={<Printer size={14} />} onClick={printDocument}>พิมพ์</Button>
            </div>
            <QmPaper d={print.d} />
          </div>
        )}
      </FormModal>
    </>
  );
}

