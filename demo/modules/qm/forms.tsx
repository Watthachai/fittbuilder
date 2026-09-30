import { useState } from "react";
import { Printer } from "lucide-react";
import { PEOPLE, QMR, TODAY } from "../ims/data";
import { Actions, Area, Checks, Choice, Form, Input, people, tryRun } from "../ims/parts";
import {
  DECISIONS, DELIVERY_OPTIONS, DISPOSITIONS, NCR_SOURCES, REVIEW_CHECKS, SATISFACTION_CRITERIA, SEVERITIES, addGauge,
  approvalErrors, approvalOf, average, calErrors, changeDesign, changeErrors, closeNcr, closeNcrErrors, commitments,
  complaintErrors, createComplaint, createLot, createNcr, currentHalf, customerName, decideLot, decisionErrors,
  designByNo, designErrors, disposeNcr, dispositionErrors, evaluateSupplier, gaugeByCode, gaugeErrors, lotByNo,
  materialName, ncrByNo, ncrErrors, nextStage, pendingInspections, planOf, recordCalibration, recordResults, recordStage,
  recordSurvey, requirementErrors, resultErrors, reviewRequirement, stageErrors, startDesign, stockCover, supplierQuality,
  purchasingGrade, surveyErrors, vendorName,
} from "./data";
import type { CalInput, CheckKey, CriterionKey, Decision, Disposition, NcrSource, Pending, RequirementReview, Severity, SupplierStatus } from "./data";
import { MATERIALS } from "../mm/data";
import { CUSTOMERS, DELIVERIES } from "../sd/data";
import { QmPaper } from "./documents";
import type { QmDoc } from "./documents";
import { Badge, Button, Note, Segmented } from "../ui";
import { ConfirmDialog, Field, FormModal, notify, printDocument, useData } from "../kit";

/** ทุกการกระทำของฝ่ายคุณภาพ ยกขึ้นแบบเดียวกันจากทุกหน้า */
export type Act =
  | { kind: "lot-new"; source?: string; material?: string }
  | { kind: "lot-results"; no: string }
  | { kind: "lot-decide"; no: string }
  | { kind: "ncr-new" }
  | { kind: "complaint-new" }
  | { kind: "ncr-dispose"; no: string }
  | { kind: "ncr-close"; no: string }
  | { kind: "gauge-new" }
  | { kind: "gauge-cal"; code: string }
  | { kind: "req-review"; doc: string }
  | { kind: "design-new" }
  | { kind: "design-stage"; no: string }
  | { kind: "design-change"; no: string }
  | { kind: "supplier-evaluate"; code: string }
  | { kind: "survey-new"; customer?: string }
  | { kind: "print"; d: QmDoc; title: string };

type Of<K extends Act["kind"]> = Extract<Act, { kind: K }>;
export type RecordKind = "lot" | "ncr" | "gauge" | "design" | "supplier" | "survey";

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
      <Field label="ผู้ตรวจ"><Choice value={inspector} onChange={setInspector} options={people()} /></Field>
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
      {failing.length > 0 ? <Note tone="warn">ไม่ผ่านเกณฑ์: {failing.map((r) => r.characteristic).join(", ")}</Note> : <Note tone="ok">ผ่านเกณฑ์ทุกคุณลักษณะ</Note>}
      <Field label="ผลการตัดสิน" error={errors.decision}><Segmented options={DECISIONS} value={decision} onChange={(v) => setDecision(v as Decision)} /></Field>
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
    <Form onSubmit={() => { setTried(true); if (Object.keys(ncrErrors(input)).length) return; const n = createNcr(input); notify(`เปิด ${n.no} แล้ว · รอสั่งการ`, "warn"); onDone(n.no); }}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="พบที่"><Choice value={source} onChange={(v) => setSource(v as NcrSource)} options={NCR_SOURCES.filter((s) => s !== "ข้อร้องเรียนลูกค้า" && s !== "สอบเทียบเครื่องมือ")} /></Field>
        <Field label="เอกสารอ้างอิง" error={errors.ref} hint={source === "ระหว่างผลิต" ? "เลขใบสั่งผลิต เช่น PO-P-3301" : undefined}>
          <Input value={ref} onChange={setRef} error={errors.ref} placeholder={source === "ระหว่างผลิต" ? "PO-P-3301" : ""} />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
        <Field label="วัสดุหรือสินค้า" error={errors.material}><Choice value={material} onChange={setMaterial} placeholder="เลือก…" options={MATERIALS.map((m) => ({ value: m.code, label: `${m.code} · ${m.name}` }))} /></Field>
        <Field label="จำนวน" error={errors.qty}><Input type="number" value={qty} onChange={setQty} error={errors.qty} /></Field>
      </div>
      <Field label="ความรุนแรง"><Segmented options={SEVERITIES} value={severity} onChange={(v) => setSeverity(v as Severity)} /></Field>
      <Field label="สิ่งที่พบ" error={errors.description}><Area value={description} onChange={setDescription} error={errors.description} /></Field>
      <Field label="ผู้รายงาน" error={errors.reportedBy}><Choice value={reportedBy} onChange={setReportedBy} options={people()} /></Field>
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
    <Form onSubmit={() => { setTried(true); if (Object.keys(complaintErrors(input)).length) return; const n = createComplaint(input); notify(`รับเรื่องร้องเรียนเป็น ${n.no} แล้ว`, "warn"); onDone(n.no); }}>
      <Field label="ใบส่งของที่ลูกค้าร้องเรียน" error={errors.delivery}>
        <Choice value={delivery} onChange={(v) => { setDelivery(v); setMaterial(""); }} placeholder="เลือกใบส่งของ…" error={errors.delivery} options={DELIVERY_OPTIONS()} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
        <Field label="สินค้า" error={errors.material}><Choice value={material} onChange={setMaterial} placeholder="เลือก…" error={errors.material} options={(d?.lines ?? []).map((l) => ({ value: l.material, label: `${materialName(l.material)} · ส่ง ${l.qty}` }))} /></Field>
        <Field label="จำนวน" error={errors.qty}><Input type="number" value={qty} onChange={setQty} error={errors.qty} /></Field>
      </div>
      <Field label="ความรุนแรง"><Segmented options={SEVERITIES} value={severity} onChange={(v) => setSeverity(v as Severity)} /></Field>
      <Field label="สิ่งที่ลูกค้าแจ้ง" error={errors.description}><Area value={description} onChange={setDescription} error={errors.description} /></Field>
      <Field label="ผู้รับเรื่อง"><Choice value={reportedBy} onChange={setReportedBy} options={people()} /></Field>
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
    <Form onSubmit={() => { setTried(true); if (Object.keys(dispositionErrors(no, input)).length) return; const saved = disposeNcr(no, input); notify(saved.stockDoc ? `สั่งการ ${no} แล้ว · ตัดสต็อกตาม ${saved.stockDoc}` : `สั่งการ ${no} แล้ว`); onDone(); }}>
      <p className="text-[13px] text-slate-600 dark:text-slate-300">{n.description}</p>
      <Field label="การสั่งการ" error={errors.disposition}><Choice value={disposition} onChange={(v) => setDisposition(v as Disposition)} options={DISPOSITIONS} error={errors.disposition} /></Field>
      {cutsStock && <Note tone="info">ตัดสต็อก {materialName(n.material!)} ออก {n.qty.toLocaleString("th-TH")} ในคลังวัสดุ ใต้เลข {no}</Note>}
      <Field label="ผู้สั่งการ" error={errors.by}><Choice value={by} onChange={setBy} options={people()} error={errors.by} /></Field>
      <Field label="สิ่งที่ต้องทำ" error={errors.note}><Area value={note} onChange={setNote} error={errors.note} /></Field>
      <Actions onCancel={onCancel} label="บันทึกการสั่งการ" />
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
    <Form onSubmit={() => { setTried(true); if (Object.keys(gaugeErrors(v)).length) return; const g = addGauge(v); notify(`ขึ้นทะเบียนเครื่องมือ ${g.code} แล้ว`); onDone(g.code); }}>
      <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
        <Field label="รหัส" error={errors.code}><Input value={v.code} onChange={set("code")} error={errors.code} placeholder="QC-XX-00" /></Field>
        <Field label="ชื่อเครื่องมือ" error={errors.name}><Input value={v.name} onChange={set("name")} error={errors.name} /></Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="ช่วงการวัด" error={errors.range}><Input value={v.range} onChange={set("range")} error={errors.range} placeholder="0–150 มม." /></Field>
        <Field label="ความละเอียด"><Input value={v.resolution} onChange={set("resolution")} placeholder="0.01 มม." /></Field>
        <Field label="ที่ใช้งาน" error={errors.location}><Input value={v.location} onChange={set("location")} error={errors.location} /></Field>
        <Field label="รอบสอบเทียบ" error={errors.intervalMonths}><Choice value={String(v.intervalMonths)} onChange={set("intervalMonths")} options={[3, 6, 12, 24].map((n) => ({ value: String(n), label: `ทุก ${n} เดือน` }))} /></Field>
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
    <Form onSubmit={() => { setTried(true); if (Object.keys(calErrors(code, v)).length) return; const { ncr } = recordCalibration(code, v); notify(ncr ? `${code} ไม่ผ่าน · พักใช้และเปิด ${ncr.no} ให้ทบทวนผลการวัดแล้ว` : `บันทึกผลสอบเทียบ ${code} แล้ว · เริ่มรอบใหม่`, ncr ? "warn" : "ok"); onDone(ncr?.no); }}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="วันที่สอบเทียบ" error={errors.date}><Input type="date" value={v.date} onChange={set("date")} error={errors.date} /></Field>
        <Field label="ผล"><Segmented options={["ผ่าน", "ไม่ผ่าน"]} value={v.result} onChange={(x) => setV((s) => ({ ...s, result: x as CalInput["result"] }))} /></Field>
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

/* ================================================ customer requirements */

function RequirementForm({ doc, onCancel, onDone }: { doc: string; onCancel: () => void; onDone: () => void }) {
  const c = commitments().find((x) => x.doc === doc)!;
  const cover = stockCover(c.lines);
  const [checks, setChecks] = useState<Record<CheckKey, boolean>>({ spec: true, capacity: cover.every((l) => l.stock >= l.qty), delivery: true, legal: true });
  const [special, setSpecial] = useState("");
  const [result, setResult] = useState<RequirementReview["result"]>("รับได้");
  const [note, setNote] = useState("");
  const [by, setBy] = useState("ชลธิชา มั่นคง");
  const [tried, setTried] = useState(false);
  const input = { doc, by, checks, special, result, note };
  const errors = tried ? requirementErrors(input) : {};
  return (
    <Form onSubmit={() => { setTried(true); if (Object.keys(requirementErrors(input)).length) return; reviewRequirement(input); notify(`ทบทวน ${doc} แล้ว · ${result}`, result === "รับไม่ได้" ? "warn" : "ok"); onDone(); }}>
      <p className="text-[13px] text-slate-600 dark:text-slate-300">{c.kind} ของ {customerName(c.customer)} · {c.date}{c.shipBy ? ` · ต้องการรับ ${c.shipBy}` : ""}</p>
      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 text-[12.5px] dark:divide-slate-800 dark:border-slate-800">
        {cover.map((l) => (
          <li key={l.material} className="flex items-center justify-between gap-3 px-3 py-2">
            <span>{materialName(l.material)} · {l.qty.toLocaleString("th-TH")}</span>
            <Badge tone={l.stock >= l.qty ? "ok" : "warn"}>{l.stock >= l.qty ? `มีในคลัง ${l.stock}` : `คลังมี ${l.stock} ต้องผลิตเพิ่ม`}</Badge>
          </li>
        ))}
      </ul>
      <Field label="หัวข้อทบทวน (ข้อ 8.2.3)">
        <div className="space-y-1.5">
          {REVIEW_CHECKS.map((k) => (
            <label key={k.key} className="flex items-center gap-2 text-[12.5px] text-slate-700 dark:text-slate-200">
              <input type="checkbox" checked={checks[k.key]} onChange={() => setChecks((s) => ({ ...s, [k.key]: !s[k.key] }))} className="size-4 accent-violet-600" />
              {k.label}
            </label>
          ))}
        </div>
      </Field>
      <Field label="ข้อกำหนดพิเศษของลูกค้า (ถ้ามี)"><Input value={special} onChange={setSpecial} placeholder="เช่น ต้องการใบรับรองคุณภาพทุกล็อต" /></Field>
      <Field label="ผลการทบทวน" error={errors.result}><Segmented options={["รับได้", "รับได้แบบมีเงื่อนไข", "รับไม่ได้"]} value={result} onChange={(v) => setResult(v as RequirementReview["result"])} /></Field>
      <Field label="เงื่อนไขหรือเหตุผล" error={errors.note}><Area value={note} onChange={setNote} error={errors.note} rows={2} /></Field>
      <Field label="ผู้ทบทวน" error={errors.by}><Choice value={by} onChange={setBy} options={people()} /></Field>
      <Actions onCancel={onCancel} label="บันทึกการทบทวน" />
    </Form>
  );
}

/* ================================================== design and development */

function DesignForm({ onCancel, onDone }: { onCancel: () => void; onDone: (no: string) => void }) {
  const [v, setV] = useState({ product: "", owner: "ศักดิ์ชัย วงศ์ไทย", target: "", inputs: "" });
  const [tried, setTried] = useState(false);
  const errors = tried ? designErrors(v) : {};
  const set = (k: keyof typeof v) => (x: string) => setV((s) => ({ ...s, [k]: x }));
  return (
    <Form onSubmit={() => { setTried(true); if (Object.keys(designErrors(v)).length) return; const d = startDesign(v); notify(`เปิดโครงการออกแบบ ${d.no} แล้ว · บันทึกข้อมูลเข้าแล้ว`); onDone(d.no); }}>
      <Field label="ผลิตภัณฑ์" error={errors.product}><Input value={v.product} onChange={set("product")} error={errors.product} /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="ผู้รับผิดชอบ" error={errors.owner}><Choice value={v.owner} onChange={set("owner")} options={people()} /></Field>
        <Field label="กำหนดเสร็จ" error={errors.target}><Input type="date" value={v.target} onChange={set("target")} error={errors.target} /></Field>
      </div>
      <Field label="ข้อมูลเข้า (ข้อ 8.3.3)" error={errors.inputs} hint="หน้าที่ใช้งาน สมรรถนะ กฎหมายและมาตรฐาน บทเรียนจากแบบเดิม"><Area value={v.inputs} onChange={set("inputs")} error={errors.inputs} rows={4} /></Field>
      <Actions onCancel={onCancel} label="เปิดโครงการ" />
    </Form>
  );
}

function StageForm({ no, onCancel, onDone }: { no: string; onCancel: () => void; onDone: () => void }) {
  const d = designByNo(no);
  const stage = nextStage(d);
  const [by, setBy] = useState(stage === "ทวนสอบ" ? "สุภาพร แก้วมณี" : stage === "รับรองความใช้ได้" ? "ชลธิชา มั่นคง" : d.owner);
  const [evidence, setEvidence] = useState("");
  const [participants, setParticipants] = useState<string[]>([d.owner]);
  const [tried, setTried] = useState(false);
  const input = { by, evidence, participants };
  const errors = tried ? stageErrors(no, input) : {};
  return (
    <Form onSubmit={() => { setTried(true); if (Object.keys(stageErrors(no, input)).length) return; recordStage(no, input); notify(`บันทึกขั้น${stage} ของ ${no} แล้ว`); onDone(); }}>
      <Note tone="info">ขั้นนี้: {stage}</Note>
      <Field label="หลักฐาน" error={errors.evidence}><Area value={evidence} onChange={setEvidence} error={errors.evidence} /></Field>
      {stage === "ทบทวนการออกแบบ" && <Field label="ผู้เข้าร่วมทบทวน" error={errors.participants}><Checks options={PEOPLE} value={participants} onChange={setParticipants} /></Field>}
      <Field label="ผู้บันทึก" error={errors.by}><Choice value={by} onChange={setBy} options={people()} error={errors.by} /></Field>
      <Actions onCancel={onCancel} label={`บันทึกขั้น${stage}`} />
    </Form>
  );
}

function ChangeForm({ no, onCancel, onDone }: { no: string; onCancel: () => void; onDone: () => void }) {
  const [change, setChange] = useState("");
  const [reason, setReason] = useState("");
  const [approvedBy, setApprovedBy] = useState(QMR);
  const [reverified, setReverified] = useState("ทวนสอบซ้ำแล้ว");
  const [tried, setTried] = useState(false);
  const input = { change, reason, approvedBy, reverified: reverified === "ทวนสอบซ้ำแล้ว" };
  const errors = tried ? changeErrors(no, input) : {};
  return (
    <Form onSubmit={() => { setTried(true); if (Object.keys(changeErrors(no, input)).length) return; changeDesign(no, input); notify(`บันทึกการเปลี่ยนแปลงแบบ ${no} แล้ว`); onDone(); }}>
      <Field label="สิ่งที่เปลี่ยน" error={errors.change}><Area value={change} onChange={setChange} error={errors.change} rows={2} /></Field>
      <Field label="เหตุผล" error={errors.reason}><Input value={reason} onChange={setReason} error={errors.reason} /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="ผู้อนุมัติ" error={errors.approvedBy}><Choice value={approvedBy} onChange={setApprovedBy} options={people()} error={errors.approvedBy} /></Field>
        <Field label="ทวนสอบ"><Segmented options={["ทวนสอบซ้ำแล้ว", "ไม่กระทบ"]} value={reverified} onChange={setReverified} /></Field>
      </div>
      <Actions onCancel={onCancel} label="บันทึกการเปลี่ยนแปลง" />
    </Form>
  );
}

/* ================================================== approved suppliers */

function SupplierForm({ code, onCancel, onDone }: { code: string; onCancel: () => void; onDone: () => void }) {
  const a = approvalOf(code);
  const q = supplierQuality(code);
  const [status, setStatus] = useState<SupplierStatus>(a?.status ?? "อนุมัติแบบมีเงื่อนไข");
  const [scope, setScope] = useState<string[]>(a?.scope ?? []);
  const [note, setNote] = useState("");
  const [by, setBy] = useState(QMR);
  const [tried, setTried] = useState(false);
  const input = { vendor: code, status, scope, note, by };
  const errors = tried ? approvalErrors(input) : {};
  const materials = MATERIALS.filter((m) => m.group !== "สินค้าสำเร็จรูป");
  return (
    <Form onSubmit={() => { setTried(true); if (Object.keys(approvalErrors(input)).length) return; evaluateSupplier(input); notify(status === "ระงับ" ? `ระงับ ${vendorName(code)} แล้ว · สั่งซื้อไม่ได้จนกว่าจะอนุมัติใหม่` : `บันทึกผลประเมิน ${vendorName(code)} แล้ว · ${status}`, status === "ระงับ" ? "warn" : "ok"); onDone(); }}>
      <div className="grid gap-2 rounded-xl bg-slate-50 p-3 text-[12.5px] text-slate-600 sm:grid-cols-3 dark:bg-slate-800/50 dark:text-slate-300">
        <span>ล็อตผ่านครั้งแรก <b className="text-slate-900 dark:text-slate-50">{q.score}%</b> ({q.accepted}/{q.lots})</span>
        <span>เกรดจัดซื้อ <b className="text-slate-900 dark:text-slate-50">{purchasingGrade(code) ?? "—"}</b></span>
        <span>NCR <b className="text-slate-900 dark:text-slate-50">{q.ncrs}</b> เรื่อง</span>
      </div>
      <Field label="ผลการตัดสิน" error={errors.status}><Segmented options={["อนุมัติ", "อนุมัติแบบมีเงื่อนไข", "ระงับ"]} value={status} onChange={(v) => setStatus(v as SupplierStatus)} /></Field>
      {status === "ระงับ" && <Note tone="warn">ระงับแล้วระบบจัดซื้อจะออกใบสั่งซื้อให้ผู้ขายรายนี้ไม่ได้</Note>}
      {status !== "ระงับ" && <Field label="วัสดุที่อนุมัติให้ส่ง" error={errors.scope}><Checks options={materials.map((m) => ({ value: m.code, label: m.name }))} value={scope} onChange={setScope} /></Field>}
      <Field label="เหตุผล" error={errors.note}><Area value={note} onChange={setNote} error={errors.note} rows={2} /></Field>
      <Field label="ผู้ประเมิน" error={errors.by}><Choice value={by} onChange={setBy} options={people()} error={errors.by} /></Field>
      <Actions onCancel={onCancel} label="บันทึกผลประเมิน" />
    </Form>
  );
}

/* =================================================== customer satisfaction */

function SurveyForm({ customer: initial, onCancel, onDone }: { customer?: string; onCancel: () => void; onDone: () => void }) {
  const [customer, setCustomer] = useState(initial ?? "");
  const [period, setPeriod] = useState(currentHalf());
  const [scores, setScores] = useState<Record<CriterionKey, number>>({ quality: 4, delivery: 4, price: 4, service: 4, complaint: 4 });
  const [comment, setComment] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [by, setBy] = useState("ชลธิชา มั่นคง");
  const [tried, setTried] = useState(false);
  const input = { customer, period, scores, comment, followUp, by };
  const errors = tried ? surveyErrors(input) : {};
  const avg = average(scores);
  return (
    <Form onSubmit={() => { setTried(true); if (Object.keys(surveyErrors(input)).length) return; const v = recordSurvey(input); notify(`บันทึกแบบสำรวจ ${v.no} แล้ว · เฉลี่ย ${avg}`, avg < 3.5 ? "warn" : "ok"); onDone(); }}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="ลูกค้า" error={errors.customer}><Choice value={customer} onChange={setCustomer} placeholder="เลือกลูกค้า…" options={CUSTOMERS.map((c) => ({ value: c.code, label: c.name }))} error={errors.customer} /></Field>
        <Field label="รอบ"><Input value={period} onChange={setPeriod} /></Field>
      </div>
      <Field label="คะแนน 1–5" error={errors.scores}>
        <div className="space-y-2">
          {SATISFACTION_CRITERIA.map((c) => (
            <div key={c.key} className="flex items-center justify-between gap-3 text-[12.5px]">
              <span className="text-slate-700 dark:text-slate-200">{c.label}</span>
              <Segmented options={["1", "2", "3", "4", "5"]} value={String(scores[c.key])} onChange={(v) => setScores((s) => ({ ...s, [c.key]: Number(v) }))} />
            </div>
          ))}
        </div>
      </Field>
      <Note tone={avg < 3.5 ? "bad" : avg < 4 ? "warn" : "ok"}>เฉลี่ย {avg}</Note>
      <Field label="ความเห็นของลูกค้า"><Area value={comment} onChange={setComment} rows={2} /></Field>
      <Field label="สิ่งที่จะทำต่อ" error={errors.followUp} hint="เฉลี่ยต่ำกว่า 3.5 ต้องมี"><Area value={followUp} onChange={setFollowUp} error={errors.followUp} rows={2} /></Field>
      <Field label="ผู้บันทึก" error={errors.by}><Choice value={by} onChange={setBy} options={people()} /></Field>
      <Actions onCancel={onCancel} label="บันทึกแบบสำรวจ" />
    </Form>
  );
}

/* --------------------------------------------------------------- actions */

export function QmActions({ act, onAct, onOpen }: { act: Act | null; onAct: (a: Act | null) => void; onOpen: (kind: RecordKind, key: string) => void }) {
  useData();
  const close = () => onAct(null);
  const pick = <K extends Act["kind"]>(kind: K) => (act?.kind === kind ? (act as Of<K>) : null);
  const [closeBy, setCloseBy] = useState(QMR);

  const lotNew = pick("lot-new");
  const results = pick("lot-results");
  const decide = pick("lot-decide");
  const dispose = pick("ncr-dispose");
  const ncrClose = pick("ncr-close");
  const cal = pick("gauge-cal");
  const req = pick("req-review");
  const stage = pick("design-stage");
  const change = pick("design-change");
  const supplier = pick("supplier-evaluate");
  const survey = pick("survey-new");
  const print = pick("print");
  const closeProblem = ncrClose ? closeNcrErrors(ncrClose.no).close : undefined;

  return (
    <>
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
        onConfirm={() => { if (!ncrClose) return; closeNcr(ncrClose.no, closeBy); notify(`ปิด ${ncrClose.no} แล้ว`); close(); }}
      />

      <FormModal open={act?.kind === "gauge-new"} title="ขึ้นทะเบียนเครื่องมือวัด" onClose={close}>
        {act?.kind === "gauge-new" && <GaugeForm onCancel={close} onDone={(code) => { close(); onOpen("gauge", code); }} />}
      </FormModal>
      <FormModal open={cal !== null} title="บันทึกผลสอบเทียบ" subtitle={cal ? `${cal.code} · ${gaugeByCode(cal.code).name}` : undefined} onClose={close}>
        {cal && <CalForm key={cal.code} code={cal.code} onCancel={close} onDone={(ncr) => { close(); if (ncr) onOpen("ncr", ncr); }} />}
      </FormModal>

      <FormModal open={req !== null} title="ทบทวนข้อกำหนดลูกค้า" subtitle={req ? `${req.doc} · ทบทวนก่อนผูกพันกับลูกค้า` : undefined} onClose={close}>
        {req && <RequirementForm key={req.doc} doc={req.doc} onCancel={close} onDone={close} />}
      </FormModal>

      <FormModal open={act?.kind === "design-new"} title="เปิดโครงการออกแบบและพัฒนา" subtitle="เริ่มจากข้อมูลเข้า แล้วเดินทีละขั้นจนส่งมอบสู่การผลิต" onClose={close}>
        {act?.kind === "design-new" && <DesignForm onCancel={close} onDone={(no) => { close(); onOpen("design", no); }} />}
      </FormModal>
      <FormModal open={stage !== null} title="บันทึกขั้นการออกแบบ" subtitle={stage ? `${stage.no} · ${designByNo(stage.no).product}` : undefined} onClose={close}>
        {stage && <StageForm key={stage.no} no={stage.no} onCancel={close} onDone={close} />}
      </FormModal>
      <FormModal open={change !== null} title="ควบคุมการเปลี่ยนแปลงแบบ" subtitle={change ? `${change.no} · ข้อ 8.3.6` : undefined} onClose={close} size="sm">
        {change && <ChangeForm key={change.no} no={change.no} onCancel={close} onDone={close} />}
      </FormModal>

      <FormModal open={supplier !== null} title="ประเมินผู้ส่งมอบ" subtitle={supplier ? `${vendorName(supplier.code)} · ข้อ 8.4.1` : undefined} onClose={close}>
        {supplier && <SupplierForm key={supplier.code} code={supplier.code} onCancel={close} onDone={close} />}
      </FormModal>

      <FormModal open={survey !== null} title="บันทึกแบบสำรวจความพึงพอใจ" subtitle="ข้อ 9.1.2" onClose={close}>
        {survey && <SurveyForm customer={survey.customer} onCancel={close} onDone={close} />}
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
