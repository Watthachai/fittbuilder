import { useState } from "react";
import {
  ADJUSTMENT_KINDS, BENEFITS, BENEFIT_PLANS, CLAIM_TYPES, TODAY, addAdjustment, adjustmentErrors, adjustmentKindOf,
  baht, claimErrors, claimUsage, createPeriod, defaultPayDate, empName, fileClaim, latestPeriod, nextMonthOf,
  periodById, periodErrors, planOf, setBenefits, setVariable, slipsFor, updateAdjustment, variableErrors,
} from "./data";
import type { Adjustment, AdjustmentDraft, ClaimDraft, Payslip, Period, VariableDraft } from "./data";
import { Button, FIELD, Note } from "../ui";
import { Field, FormModal } from "../kit";
import { attempt } from "./shared";

/**
 * Every form payroll opens. Each validates through the rule functions in data.ts
 * — the same ones the save calls — so what the form lets through is what the
 * period accepts, and each one ends in a notification of what happened.
 */

function Actions({ onCancel, onSave, label }: { onCancel: () => void; onSave: () => void; label: string }) {
  return (
    <div className="flex justify-end gap-2 pt-1">
      <Button variant="secondary" onClick={onCancel}>
        ยกเลิก
      </Button>
      <Button variant="primary" onClick={onSave}>
        {label}
      </Button>
    </div>
  );
}

/** Who a form is about, from the people the period pays. By id, so namesakes stay apart. */
function MemberSelect({ periodId, value, onChange }: { periodId: number; value: number; onChange: (id: number) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(Number(e.target.value))} className={FIELD + " w-full"}>
      {slipsFor(periodId).map((s) => (
        <option key={s.employeeId} value={s.employeeId}>
          {s.employee.name} · {s.employee.code}
        </option>
      ))}
    </select>
  );
}

const Num = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
  <input value={value} onChange={(e) => onChange(e.target.value)} inputMode="decimal" className={FIELD + " w-full tabular-nums"} />
);

const Area = ({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) => (
  <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={2} placeholder={placeholder} className={FIELD + " w-full resize-none"} />
);

/* ------------------------------------------------------------- periods */

/** เปิดงวดใหม่ — ต่อจากงวดล่าสุด เมื่องวดนั้นอนุมัติแล้ว */
export function PeriodForm({ onClose, onCreated }: { onClose: () => void; onCreated: (p: Period) => void }) {
  const month = nextMonthOf(latestPeriod().month);
  const [d, setD] = useState({ month, payDate: defaultPayDate(month) });
  const [tried, setTried] = useState(false);
  const errors = tried ? periodErrors(d) : {};
  return (
    <FormModal open title="เปิดงวดเงินเดือนใหม่" subtitle="ทุกคนที่ทำงานอยู่ถูกดึงเข้างวด ตัวเลขขาดลามาสายเริ่มที่ศูนย์" onClose={onClose} size="sm">
      <div className="space-y-3">
        <Field label="เดือนของงวด" error={errors.month}>
          <input
            type="month"
            value={d.month}
            onChange={(e) => setD({ month: e.target.value, payDate: /^\d{4}-\d{2}$/.test(e.target.value) ? defaultPayDate(e.target.value) : d.payDate })}
            className={FIELD + " w-full"}
          />
        </Field>
        <Field label="วันจ่าย" error={errors.payDate} hint="ทุกวันที่ 25 ถ้าตรงวันหยุดเลื่อนมาวันศุกร์ก่อนหน้า">
          <input type="date" value={d.payDate} onChange={(e) => setD({ ...d, payDate: e.target.value })} className={FIELD + " w-full"} />
        </Field>
        <Actions
          onCancel={onClose}
          label="เปิดงวด"
          onSave={() => {
            setTried(true);
            if (Object.keys(periodErrors(d)).length) return;
            const made = attempt(() => createPeriod(d), (p) => `เปิด${p.label}แล้ว ${slipsFor(p.id).length} คน วันทำงาน ${p.workDays} วัน`);
            if (made) onCreated(made);
          }}
        />
      </div>
    </FormModal>
  );
}

/* -------------------------------------------------------- attendance */

/** แก้ขาด ลา มาสาย และล่วงเวลาของงวด — ต้องบอกเหตุผล ผู้ตรวจงวดจะเห็น */
export function AttendanceForm({ slip, onClose }: { slip: Payslip; onClose: () => void }) {
  const period = periodById(slip.periodId);
  const [d, setD] = useState<VariableDraft>({
    absentDays: String(slip.absentDays),
    unpaidDays: String(slip.unpaidDays),
    lateMinutes: String(slip.lateMinutes),
    otHours: String(slip.otHours),
    holidayOtHours: String(slip.holidayOtHours),
    note: "",
  });
  const [tried, setTried] = useState(false);
  const errors = tried ? variableErrors(slip.periodId, d) : {};
  const set = (k: keyof VariableDraft) => (v: string) => setD({ ...d, [k]: v });

  return (
    <FormModal
      open
      title="แก้ขาดลามาสาย"
      subtitle={`${slip.employee.name} · ${period.label} · ฐานต่อวัน ${baht(Math.round(slip.perDay))} ต่อชั่วโมง ${baht(Math.round(slip.perHour))}`}
      onClose={onClose}
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label="วันขาดงาน" error={errors.absentDays} hint="หักเต็มวัน และตัดเบี้ยขยัน">
            <Num value={d.absentDays} onChange={set("absentDays")} />
          </Field>
          <Field label="ลาไม่รับค่าจ้าง (วัน)" error={errors.unpaidDays}>
            <Num value={d.unpaidDays} onChange={set("unpaidDays")} />
          </Field>
          <Field label="นาทีที่มาสาย" error={errors.lateMinutes} hint="หักตามสัดส่วนชั่วโมง">
            <Num value={d.lateMinutes} onChange={set("lateMinutes")} />
          </Field>
          <Field label="ล่วงเวลาวันทำงาน (ชม.)" error={errors.otHours} hint="1.5 เท่า">
            <Num value={d.otHours} onChange={set("otHours")} />
          </Field>
          <Field label="ล่วงเวลาวันหยุด (ชม.)" error={errors.holidayOtHours} hint="3 เท่า">
            <Num value={d.holidayOtHours} onChange={set("holidayOtHours")} />
          </Field>
        </div>
        <Field label="เหตุผลที่แก้" error={errors.note} hint={slip.note ? `ครั้งก่อน: ${slip.note}` : undefined}>
          <Area value={d.note} onChange={set("note")} placeholder="เช่น ปรับตามใบลงเวลาที่หัวหน้าแผนกเซ็นแล้ว" />
        </Field>
        <Actions
          onCancel={onClose}
          label="บันทึกและคำนวณใหม่"
          onSave={() => {
            setTried(true);
            if (Object.keys(variableErrors(slip.periodId, d)).length) return;
            const ok = attempt(
              () => setVariable(slip.periodId, slip.employeeId, d),
              `บันทึกขาดลามาสายของ${slip.employee.name}แล้ว สลิปคำนวณใหม่เรียบร้อย`
            );
            if (ok) onClose();
          }}
        />
      </div>
    </FormModal>
  );
}

/* ------------------------------------------------------- adjustments */

/** เพิ่มหรือแก้รายการเงินได้/เงินหักครั้งคราวของงวด: โบนัส คอมมิชชั่น เบิกล่วงหน้า กยศ. */
export function AdjustmentForm({
  periodId,
  employeeId,
  item,
  onClose,
}: {
  periodId: number;
  employeeId?: number;
  item?: Adjustment;
  onClose: () => void;
}) {
  const first = item?.employeeId ?? employeeId ?? slipsFor(periodId)[0]?.employeeId ?? 0;
  const [d, setD] = useState<AdjustmentDraft>({
    periodId,
    employeeId: first,
    kind: item?.kind ?? ADJUSTMENT_KINDS[0].name,
    amount: item ? String(item.amount) : "",
    note: item?.note ?? "",
  });
  const [tried, setTried] = useState(false);
  const errors = tried ? adjustmentErrors(d, item?.id) : {};
  const kind = adjustmentKindOf(d.kind);

  return (
    <FormModal
      open
      title={item ? "แก้รายการเงินได้/เงินหัก" : "เพิ่มรายการเงินได้/เงินหัก"}
      subtitle={`${periodById(periodId).label} · รายการจะเข้าสลิปทันทีและคำนวณภาษีใหม่`}
      onClose={onClose}
    >
      <div className="space-y-3">
        <Field label="พนักงาน" error={errors.employeeId}>
          <MemberSelect periodId={periodId} value={d.employeeId} onChange={(v) => setD({ ...d, employeeId: v })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="รายการ" error={errors.kind} hint={kind.note}>
            <select value={d.kind} onChange={(e) => setD({ ...d, kind: e.target.value })} className={FIELD + " w-full"}>
              <optgroup label="เงินได้">
                {ADJUSTMENT_KINDS.filter((k) => k.sign > 0).map((k) => (
                  <option key={k.name}>{k.name}</option>
                ))}
              </optgroup>
              <optgroup label="เงินหัก">
                {ADJUSTMENT_KINDS.filter((k) => k.sign < 0).map((k) => (
                  <option key={k.name}>{k.name}</option>
                ))}
              </optgroup>
            </select>
          </Field>
          <Field label="จำนวนเงิน (บาท)" error={errors.amount} hint={kind.sign > 0 ? (kind.taxable ? "นำไปคำนวณภาษี" : "ไม่นำไปคำนวณภาษี") : "หักรวมไม่เกินหนึ่งในห้าของค่าจ้าง"}>
            <Num value={d.amount} onChange={(v) => setD({ ...d, amount: v })} />
          </Field>
        </div>
        <Field label="ที่มาของรายการ" error={errors.note}>
          <Area value={d.note} onChange={(v) => setD({ ...d, note: v })} placeholder="เช่น โบนัสผลงานครึ่งปีแรก ตามมติผู้บริหาร" />
        </Field>
        <Actions
          onCancel={onClose}
          label={item ? "บันทึกการแก้ไข" : "เพิ่มรายการ"}
          onSave={() => {
            setTried(true);
            if (Object.keys(adjustmentErrors(d, item?.id)).length) return;
            const ok = attempt(
              () => (item ? updateAdjustment(item.id, d) : addAdjustment(d)),
              `${item ? "แก้" : "เพิ่ม"}${d.kind} ${baht(Number(d.amount))} ของ${empName(d.employeeId)}แล้ว`
            );
            if (ok) onClose();
          }}
        />
      </div>
    </FormModal>
  );
}

/* ------------------------------------------------------------ benefits */

/** บันทึกเบิกสวัสดิการตามใบเสร็จ — ตรวจวงเงินคงเหลือของปีให้ระหว่างกรอก */
export function ClaimForm({ periodId, onClose }: { periodId: number; onClose: () => void }) {
  const [d, setD] = useState<ClaimDraft>({
    periodId,
    employeeId: slipsFor(periodId)[0]?.employeeId ?? 0,
    type: CLAIM_TYPES[0].name,
    amount: "",
    receiptDate: TODAY,
    detail: "",
  });
  const [tried, setTried] = useState(false);
  const errors = tried ? claimErrors(d) : {};
  const u = claimUsage(d.employeeId, d.type);

  return (
    <FormModal open title="บันทึกเบิกสวัสดิการ" subtitle={`จ่ายรวมในสลิป${periodById(periodId).label}เมื่ออนุมัติ`} onClose={onClose}>
      <div className="space-y-3">
        <Field label="พนักงาน" error={errors.employeeId}>
          <MemberSelect periodId={periodId} value={d.employeeId} onChange={(v) => setD({ ...d, employeeId: v })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="ประเภทสวัสดิการ" error={errors.type} hint={`เบิกได้อีก ${baht(Math.max(0, u.left))} จาก ${baht(u.limit)}`}>
            <select value={d.type} onChange={(e) => setD({ ...d, type: e.target.value })} className={FIELD + " w-full"}>
              {CLAIM_TYPES.map((t) => (
                <option key={t.name}>{t.name}</option>
              ))}
            </select>
          </Field>
          <Field label="ยอดตามใบเสร็จ (บาท)" error={errors.amount}>
            <Num value={d.amount} onChange={(v) => setD({ ...d, amount: v })} />
          </Field>
        </div>
        <Field label="วันที่ในใบเสร็จ" error={errors.receiptDate}>
          <input type="date" value={d.receiptDate} onChange={(e) => setD({ ...d, receiptDate: e.target.value })} className={FIELD + " w-full"} />
        </Field>
        <Field label="รายละเอียดและสถานที่" error={errors.detail}>
          <Area value={d.detail} onChange={(v) => setD({ ...d, detail: v })} placeholder="เช่น ตรวจรักษาไข้หวัด คลินิกเวชกรรมบางพลี" />
        </Field>
        <Actions
          onCancel={onClose}
          label="บันทึกใบเบิก"
          onSave={() => {
            setTried(true);
            if (Object.keys(claimErrors(d)).length) return;
            const ok = attempt(
              () => fileClaim(d),
              (c) => `บันทึกใบเบิก ${c.no} ${c.type} ${baht(c.amount)} ของ${empName(c.employeeId)}แล้ว รออนุมัติ`
            );
            if (ok) onClose();
          }}
        />
      </div>
    </FormModal>
  );
}

/** ปรับสวัสดิการประจำของคนหนึ่ง — มีผลกับงวดที่ยังไม่ล็อก */
export function BenefitForm({ employeeId, onClose }: { employeeId: number; onClose: () => void }) {
  const current = BENEFITS[employeeId] ?? {};
  const [d, setD] = useState<Record<string, string>>(() =>
    Object.fromEntries(BENEFIT_PLANS.map((p) => [p.code, current[p.code] ? String(current[p.code]) : ""]))
  );
  const [tried, setTried] = useState(false);
  const bad = (v: string) => v.trim() !== "" && !(Number(v) >= 0);
  const errors = tried ? Object.fromEntries(Object.entries(d).filter(([, v]) => bad(v)).map(([k]) => [k, "กรอกตัวเลขไม่ติดลบ"])) : {};

  return (
    <FormModal open title="ปรับสวัสดิการประจำ" subtitle={`${empName(employeeId)} · มีผลกับงวดที่ยังไม่อนุมัติ สลิปที่อนุมัติแล้วไม่เปลี่ยน`} onClose={onClose}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          {BENEFIT_PLANS.map((p) => (
            <Field key={p.code} label={`${p.name} (บาท/เดือน)`} error={errors[p.code]} hint={p.taxable ? "คิดภาษี" : "ยกเว้นภาษี"}>
              <Num value={d[p.code]} onChange={(v) => setD({ ...d, [p.code]: v })} />
            </Field>
          ))}
        </div>
        <Note tone="idle">เว้นว่างหรือใส่ 0 คือไม่ได้รับสวัสดิการนั้น · {planOf("DILI").name}ถูกตัดทั้งก้อนเมื่อขาดงานในงวด</Note>
        <Actions
          onCancel={onClose}
          label="บันทึกสวัสดิการ"
          onSave={() => {
            setTried(true);
            if (Object.values(d).some(bad)) return;
            if (attempt(() => setBenefits(employeeId, d), `ปรับสวัสดิการประจำของ${empName(employeeId)}แล้ว`)) onClose();
          }}
        />
      </div>
    </FormModal>
  );
}
