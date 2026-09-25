import { useState } from "react";
import type { ReactNode } from "react";
import { motion } from "motion/react";
import { Sparkles } from "lucide-react";
import {
  ACTION_KINDS, BANKS, BENEFIT_CATALOG, CONTRACT_TYPES, DOCUMENT_KINDS, EMPLOYEES, NOTICE_DAYS, PROBATION_DAYS,
  PVD_RATES, SEPARATION_KINDS, TODAY, WORK_WEEKS, actionErrors, actionOf, addDays, addMonths, addYears, adminErrors,
  approveAction, baht, changeContract, contractErrors, daysBetween, departments, employeeOf, employmentErrors,
  hireEmployee, isActive, isFixedTerm, isPvdBenefit, nextEmployeeCode, passProbation, personalErrors, personalOf,
  positionTitles, probationEnd, raiseBlocked, raiseErrors, raisedSalary, rejectAction, recordSeparation, renewContract,
  renewErrors, requestAction, requestRaises, separationErrors, separationPay, serviceYears, setBenefits, thaiDate,
  updateAdmin, updatePersonal, valuesOf,
} from "./data";
import type {
  ActionKind, AdminInput, ContractInput, Employee, HireInput, LetterKind, PersonalInput, PersonnelAction,
  SeparationInput, SeparationKind,
} from "./data";
import { Avatar, Badge, Note, SURFACE, Tag, swatchFor } from "../ui";
import { ConfirmDialog, Field, FormModal, Wizard, money, notify, useData } from "../kit";
import type { Step } from "../kit";
import { CertificateSheet, ContractSheet, OrderSheet } from "./documents";
import {
  CheckList, Choice, EmployeeSubject, FormFooter, LongText, OptionCards, RowButton, TextInput, actionSummary,
} from "./parts";

/**
 * Every dialog that changes a personnel record, raised from one place.
 *
 * The screen keeps a single `Sheet` saying which is open and for whom, so the
 * register, the overview and a record opened over either can all raise the same
 * form — and the hidden screen index can open any of them from a cold start.
 */
export type Sheet =
  | { kind: "hire" }
  | { kind: "personal"; id: number }
  | { kind: "contract"; id: number }
  | { kind: "renew"; id: number }
  | { kind: "probation"; id: number }
  | { kind: "admin"; id: number }
  | { kind: "benefits"; id: number }
  | { kind: "action"; id: number | null; preset: ActionKind }
  | { kind: "raise"; ids: number[] }
  | { kind: "decide"; actionId: string; approve: boolean }
  | { kind: "separate"; id: number; preset?: { kind: SeparationKind; reason: string } }
  | { kind: "certificate"; id: number; letter: LetterKind }
  | { kind: "contractDoc"; id: number }
  | { kind: "order"; actionId: string };

type Of<K extends Sheet["kind"]> = Extract<Sheet, { kind: K }>;

export function PaSheets({
  sheet,
  onSheet,
  onHired,
}: {
  sheet: Sheet | null;
  onSheet: (s: Sheet | null) => void;
  onHired: (e: Employee) => void;
}) {
  useData();
  const close = () => onSheet(null);
  const pick = <K extends Sheet["kind"]>(kind: K): Of<K> | null => (sheet?.kind === kind ? (sheet as Of<K>) : null);
  const person = (s: { id: number } | null) => (s ? employeeOf(s.id) : null);

  const action = pick("action");
  const decide = pick("decide");
  const separate = pick("separate");
  const certificate = pick("certificate");
  const order = pick("order");

  return (
    <>
      <FormModal
        open={pick("hire") !== null}
        title="เพิ่มพนักงานใหม่"
        subtitle={`กรอกสามขั้นตอน ระบบตรวจความถูกต้องให้ก่อนไปขั้นถัดไป · จะได้รหัส ${nextEmployeeCode()}`}
        onClose={close}
      >
        {pick("hire") && (
          <HireWizard
            onCancel={close}
            onDone={(e) => {
              close();
              onHired(e);
            }}
          />
        )}
      </FormModal>

      <PersonalForm employee={person(pick("personal"))} onClose={close} />
      <ContractForm employee={person(pick("contract"))} onClose={close} />
      <RenewForm employee={person(pick("renew"))} onClose={close} />
      <ProbationDialog
        employee={person(pick("probation"))}
        onClose={close}
        onFail={(e) => onSheet({ kind: "separate", id: e.id, preset: { kind: "เลิกจ้าง", reason: "ไม่ผ่านการทดลองงาน" } })}
      />
      <AdminForm employee={person(pick("admin"))} onClose={close} />
      <BenefitsForm employee={person(pick("benefits"))} onClose={close} />
      <ActionForm
        open={action !== null}
        employee={action?.id ? employeeOf(action.id) : null}
        preset={action?.preset ?? "ย้ายแผนก"}
        onClose={close}
      />
      <RaiseForm ids={pick("raise")?.ids ?? null} onClose={close} />
      <DecisionDialog
        action={decide ? actionOf(decide.actionId) : null}
        approve={decide?.approve ?? true}
        onClose={close}
      />
      <SeparationForm employee={person(separate)} preset={separate?.preset} onClose={close} />
      <CertificateSheet
        employee={person(certificate)}
        preset={certificate?.letter ?? "หนังสือรับรองการทำงาน"}
        onClose={close}
      />
      <ContractSheet employee={person(pick("contractDoc"))} onClose={close} />
      <OrderSheet action={order ? actionOf(order.actionId) : null} onClose={close} />
    </>
  );
}

const hasErrors = (e: Record<string, string>) => Object.keys(e).length > 0;

/** The first of next month — when a change agreed this month normally takes effect. */
const nextMonthStart = () => addMonths(TODAY.slice(0, 7), 1) + "-01";

const pvdLabel = (r: number) => (r === 0 ? "ไม่สะสม" : `${r}%`);
const PVD_LABELS = PVD_RATES.map(pvdLabel);
const pvdOf = (label: string) => PVD_RATES[PVD_LABELS.indexOf(label)];

/* -------------------------------------------------------------- new hire */

type HireDraft = Omit<HireInput, "baseSalary" | "endsAt" | "pvdRate"> & { baseSalary: string; endsAt: string; pvdRate: string };

const freshHire = (): HireDraft => ({
  name: "", nickname: "", gender: "ชาย", birthDate: "", nationalId: "", phone: "", email: "", address: "",
  position: "", department: "ฝ่ายขาย", type: "พนักงานประจำ", startedAt: TODAY, endsAt: addDays(addYears(TODAY, 1), -1),
  baseSalary: "", workDays: "จันทร์–ศุกร์",
  ssoNumber: "", bankName: "กสิกรไทย", bankAccount: "", pvdRate: "3%",
  documents: ["สำเนาบัตรประชาชน", "สำเนาทะเบียนบ้าน", "วุฒิการศึกษา"],
});

const toHire = (d: HireDraft): HireInput => ({
  ...d,
  baseSalary: Number(d.baseSalary),
  endsAt: isFixedTerm(d.type) ? d.endsAt : null,
  pvdRate: pvdOf(d.pvdRate),
});

function HireWizard({ onDone, onCancel }: { onDone: (e: Employee) => void; onCancel: () => void }) {
  const [d, setD] = useState<HireDraft>(freshHire);
  const set = <K extends keyof HireDraft>(k: K) => (v: HireDraft[K]) => setD((x) => ({ ...x, [k]: v }));
  const toggleDoc = (doc: string) =>
    setD((x) => ({ ...x, documents: x.documents.includes(doc) ? x.documents.filter((y) => y !== doc) : [...x.documents, doc] }));

  const steps: Step[] = [
    {
      title: "ข้อมูลส่วนตัว",
      validate: () => personalErrors(d),
      render: (errors) => <PersonalFields d={d} set={set} errors={errors} />,
    },
    {
      title: "ข้อมูลการจ้าง",
      validate: () => employmentErrors(toHire(d)),
      render: (errors) => (
        <>
          <TextInput label="ตำแหน่ง" value={d.position} onChange={set("position")} list="pa-positions" placeholder="พนักงานขาย" error={errors.position} />
          <PositionList />
          <div className="grid grid-cols-2 gap-3">
            <Choice label="แผนก" value={d.department} onChange={set("department")} options={departments()} error={errors.department} />
            <Choice label="ประเภทการจ้าง" value={d.type} onChange={set("type")} options={CONTRACT_TYPES} error={errors.type} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <TextInput label="วันเริ่มงาน" type="date" value={d.startedAt} onChange={set("startedAt")} error={errors.startedAt} />
            {isFixedTerm(d.type) ? (
              <TextInput label="วันสิ้นสุดสัญญา" type="date" value={d.endsAt} onChange={set("endsAt")} error={errors.endsAt} />
            ) : (
              <Choice label="วันทำงาน" value={d.workDays} onChange={set("workDays")} options={WORK_WEEKS} />
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <TextInput label="เงินเดือนฐาน (บาท)" type="number" value={d.baseSalary} onChange={set("baseSalary")} placeholder="22000" error={errors.baseSalary} />
            {isFixedTerm(d.type) && <Choice label="วันทำงาน" value={d.workDays} onChange={set("workDays")} options={WORK_WEEKS} />}
          </div>
          {/^\d{4}-\d{2}-\d{2}$/.test(d.startedAt) && (
            <Note tone="accent">
              ทดลองงาน {PROBATION_DAYS} วัน ถึงวันที่ {thaiDate(probationEnd(d.startedAt))} — ประเมินและบรรจุก่อนวันนั้น
              เพราะทำงานครบ 120 วันแล้วเลิกจ้างต้องจ่ายค่าชดเชยตามมาตรา 118
            </Note>
          )}
        </>
      ),
    },
    {
      title: "ข้อมูลทางปกครอง",
      validate: () => adminErrors({ ...toHire(d), taxId: d.nationalId.replace(/\D/g, "") }),
      render: (errors) => (
        <>
          <TextInput label="เลขประกันสังคม" value={d.ssoNumber} onChange={set("ssoNumber")} hint="10 หลัก ไม่ต้องใส่ขีด" placeholder="1234567890" error={errors.ssoNumber} />
          <div className="grid grid-cols-2 gap-3">
            <Choice label="ธนาคาร" value={d.bankName} onChange={set("bankName")} options={BANKS} />
            <TextInput label="เลขบัญชี" value={d.bankAccount} onChange={set("bankAccount")} placeholder="xxx-x-x1234-5" error={errors.bankAccount} />
          </div>
          <Choice label="กองทุนสำรองเลี้ยงชีพ" value={d.pvdRate} onChange={set("pvdRate")} options={PVD_LABELS} hint="ร้อยละของเงินเดือนที่พนักงานสะสม บริษัทสมทบเท่ากัน" />
          <div>
            <p className="mb-1.5 text-[12px] font-medium text-slate-600 dark:text-slate-300">เอกสารที่ยื่นแล้ว</p>
            <CheckList items={DOCUMENT_KINDS} checked={d.documents} onToggle={toggleDoc} />
          </div>
          <Note tone="accent">
            เลขผู้เสียภาษีใช้เลขบัตรประชาชนที่กรอกไว้ เอกสารที่ยังไม่ติ๊กจะขึ้นเป็นรอเอกสารในข้อมูลทางปกครอง
          </Note>
        </>
      ),
    },
  ];

  return (
    <Wizard
      steps={steps}
      onCancel={onCancel}
      doneLabel="เพิ่มพนักงาน"
      onDone={() => {
        const e = hireEmployee(toHire(d));
        notify(`รับ ${e.name} เข้าทะเบียนแล้ว · ${e.code}`);
        onDone(e);
      }}
    />
  );
}

function PositionList() {
  return (
    <datalist id="pa-positions">
      {positionTitles().map((p) => <option key={p} value={p} />)}
    </datalist>
  );
}

/** The personal fields, shared by the new-hire wizard and the edit form so they cannot drift apart. */
function PersonalFields<D extends PersonalInput>({
  d,
  set,
  errors,
}: {
  d: D;
  set: <K extends keyof D>(k: K) => (v: D[K]) => void;
  errors: Record<string, string>;
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <TextInput label="ชื่อ-นามสกุล" value={d.name} onChange={set("name") as (v: string) => void} placeholder="สมชาย รักดี" error={errors.name} />
        <TextInput label="ชื่อเล่น" value={d.nickname} onChange={set("nickname") as (v: string) => void} placeholder="ชาย" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Choice label="เพศ" value={d.gender} onChange={set("gender") as (v: string) => void} options={["ชาย", "หญิง"]} />
        <TextInput label="วันเกิด" type="date" value={d.birthDate} onChange={set("birthDate") as (v: string) => void} error={errors.birthDate} />
      </div>
      <TextInput label="เลขบัตรประชาชน" value={d.nationalId} onChange={set("nationalId") as (v: string) => void} hint="ใส่ขีดตามบัตร" placeholder="1-2345-67890-12-3" error={errors.nationalId} />
      <div className="grid grid-cols-2 gap-3">
        <TextInput label="โทรศัพท์" value={d.phone} onChange={set("phone") as (v: string) => void} hint="รูปแบบ 08X-XXX-XXXX" placeholder="081-234-5678" error={errors.phone} />
        <TextInput label="อีเมล" type="email" value={d.email} onChange={set("email") as (v: string) => void} placeholder="somchai@example.co.th" error={errors.email} />
      </div>
      <LongText label="ที่อยู่ตามทะเบียนบ้าน" value={d.address} onChange={set("address") as (v: string) => void} rows={2} error={errors.address} />
    </>
  );
}

/* --------------------------------------------------------- personal data */

function PersonalForm({ employee, onClose }: { employee: Employee | null; onClose: () => void }) {
  return (
    <FormModal open={employee !== null} title="แก้ไขข้อมูลส่วนตัว" subtitle={employee ? `${employee.name} · ${employee.code}` : undefined} onClose={onClose}>
      {employee && <PersonalBody key={employee.id} e={employee} onClose={onClose} />}
    </FormModal>
  );
}

function PersonalBody({ e, onClose }: { e: Employee; onClose: () => void }) {
  const [d, setD] = useState<PersonalInput>(() => personalOf(e));
  const [tried, setTried] = useState(false);
  const errors = tried ? personalErrors(d) : {};
  const set = <K extends keyof PersonalInput>(k: K) => (v: PersonalInput[K]) => setD((x) => ({ ...x, [k]: v }));

  const save = () => {
    setTried(true);
    if (hasErrors(personalErrors(d))) return;
    updatePersonal(e.id, d);
    notify(`บันทึกข้อมูลส่วนตัวของ ${d.name.trim()} แล้ว`);
    onClose();
  };

  return (
    <div className="space-y-4">
      <PersonalFields d={d} set={set} errors={errors} />
      <FormFooter onCancel={onClose} onSave={save} />
    </div>
  );
}

/* ---------------------------------------------------------------- contract */

function ContractForm({ employee, onClose }: { employee: Employee | null; onClose: () => void }) {
  return (
    <FormModal open={employee !== null} title="แก้ไขเงื่อนไขการจ้าง" subtitle={employee ? `${employee.name} · เริ่มงาน ${employee.contract.startedAt}` : undefined} onClose={onClose}>
      {employee && <ContractBody key={employee.id} e={employee} onClose={onClose} />}
    </FormModal>
  );
}

function ContractBody({ e, onClose }: { e: Employee; onClose: () => void }) {
  const [type, setType] = useState(e.contract.type);
  const [endsAt, setEndsAt] = useState(e.contract.endsAt ?? addDays(addYears(TODAY, 1), -1));
  const [workDays, setWorkDays] = useState(e.contract.workDays);
  const [tried, setTried] = useState(false);
  const input: ContractInput = { type, endsAt: isFixedTerm(type) ? endsAt : null, workDays };
  const errors = tried ? contractErrors(e, input) : {};

  const save = () => {
    setTried(true);
    if (hasErrors(contractErrors(e, input))) return;
    changeContract(e.id, input);
    notify(type !== e.contract.type ? `เปลี่ยน ${e.name} เป็น${type}แล้ว` : `บันทึกเงื่อนไขการจ้างของ ${e.name} แล้ว`);
    onClose();
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Choice label="ประเภทการจ้าง" value={type} onChange={setType} options={CONTRACT_TYPES} error={errors.type} />
        <Choice label="วันทำงาน" value={workDays} onChange={setWorkDays} options={WORK_WEEKS} error={errors.workDays} />
      </div>
      {isFixedTerm(type) ? (
        <TextInput label="วันสิ้นสุดสัญญา" type="date" value={endsAt} onChange={setEndsAt} error={errors.endsAt} />
      ) : (
        <Note tone="idle">สัญญาไม่มีกำหนดระยะเวลา สิ้นสุดเมื่อฝ่ายใดฝ่ายหนึ่งบอกเลิกล่วงหน้าหนึ่งงวดค่าจ้าง</Note>
      )}
      {type !== e.contract.type && (
        <Note tone="accent">การเปลี่ยนประเภทการจ้างจะบันทึกเป็นเหตุการณ์ในประวัติ วันที่ {thaiDate(TODAY)}</Note>
      )}
      <Note tone="idle">เงินเดือนปรับผ่านคำขอปรับเงินเดือน เพื่อให้มีผู้อนุมัติและพิมพ์คำสั่งได้</Note>
      <FormFooter onCancel={onClose} onSave={save} />
    </div>
  );
}

function RenewForm({ employee, onClose }: { employee: Employee | null; onClose: () => void }) {
  return (
    <FormModal open={employee !== null} title="ต่อสัญญาจ้าง" subtitle={employee ? `${employee.name} · ${employee.contract.type}` : undefined} onClose={onClose} size="sm">
      {employee && <RenewBody key={employee.id} e={employee} onClose={onClose} />}
    </FormModal>
  );
}

function RenewBody({ e, onClose }: { e: Employee; onClose: () => void }) {
  const current = e.contract.endsAt ?? TODAY;
  const TERMS = ["ต่อ 1 ปี", "ต่อ 2 ปี", "กำหนดเอง"];
  const [term, setTerm] = useState(TERMS[0]);
  const [endsAt, setEndsAt] = useState(addYears(current, 1));
  const [tried, setTried] = useState(false);
  const errors = tried ? renewErrors(e, endsAt) : {};

  const choose = (t: string) => {
    setTerm(t);
    if (t === TERMS[0]) setEndsAt(addYears(current, 1));
    if (t === TERMS[1]) setEndsAt(addYears(current, 2));
  };

  const save = () => {
    setTried(true);
    if (hasErrors(renewErrors(e, endsAt))) return;
    renewContract(e.id, endsAt);
    notify(`ต่อสัญญาของ ${e.name} ถึง ${thaiDate(endsAt)} แล้ว`);
    onClose();
  };

  return (
    <div className="space-y-4">
      <Note tone={daysBetween(TODAY, current) <= 90 ? "warn" : "idle"}>
        สัญญาปัจจุบันสิ้นสุด {thaiDate(current)} · อีก {Math.max(0, daysBetween(TODAY, current))} วัน
      </Note>
      <OptionCards label="ระยะเวลา" options={TERMS} value={term} onChange={choose} />
      <TextInput
        label="สิ้นสุดสัญญาใหม่"
        type="date"
        value={endsAt}
        onChange={(v) => {
          setTerm(TERMS[2]);
          setEndsAt(v);
        }}
        error={errors.endsAt}
      />
      <FormFooter onCancel={onClose} onSave={save} saveLabel="ต่อสัญญา" />
    </div>
  );
}

function ProbationDialog({
  employee: e,
  onClose,
  onFail,
}: {
  employee: Employee | null;
  onClose: () => void;
  onFail: (e: Employee) => void;
}) {
  const worked = e ? daysBetween(e.contract.startedAt, TODAY) + 1 : 0;
  const started = worked > 0;
  return (
    <ConfirmDialog
      open={e !== null}
      title="ผ่านการทดลองงาน"
      body={started ? "บรรจุเป็นพนักงานและปิดช่วงทดลองงาน บันทึกเป็นเหตุการณ์ในประวัติ" : "ยังไม่ถึงวันเริ่มงาน ประเมินผ่านทดลองงานได้หลังเริ่มงานแล้ว"}
      confirmLabel="ยืนยันผ่านทดลองงาน"
      disabled={!started}
      subject={e && <EmployeeSubject e={e} />}
      fields={
        e && (
          <div className="space-y-3">
            <dl className="grid grid-cols-2 gap-2 text-[12.5px]">
              <div className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
                <dt className="text-slate-500 dark:text-slate-400">ทำงานมาแล้ว</dt>
                <dd className="font-medium text-slate-900 dark:text-slate-50">{started ? `${worked} วัน` : `เริ่ม ${e.contract.startedAt}`}</dd>
              </div>
              <div className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
                <dt className="text-slate-500 dark:text-slate-400">ครบกำหนดทดลองงาน</dt>
                <dd className="font-medium text-slate-900 dark:text-slate-50">{e.contract.probationUntil}</dd>
              </div>
            </dl>
            {worked > PROBATION_DAYS && (
              <Note tone="warn">ทำงานเกิน {PROBATION_DAYS} วันแล้ว หากเลิกจ้างจากนี้ต้องจ่ายค่าชดเชยตามอายุงาน</Note>
            )}
            <button
              onClick={() => onFail(e)}
              className="text-[12px] text-rose-600 underline decoration-rose-300 underline-offset-2 hover:text-rose-700 dark:text-rose-400"
            >
              ไม่ผ่านทดลองงาน — บันทึกเลิกจ้างแทน
            </button>
          </div>
        )
      }
      onCancel={onClose}
      onConfirm={() => {
        if (!e) return;
        passProbation(e.id);
        notify(`บรรจุ ${e.name} เป็นพนักงานแล้ว`);
        onClose();
      }}
    />
  );
}

/* ---------------------------------------------------------- admin data */

function AdminForm({ employee, onClose }: { employee: Employee | null; onClose: () => void }) {
  return (
    <FormModal open={employee !== null} title="แก้ไขข้อมูลทางปกครอง" subtitle={employee ? `${employee.name} · ภาษี ประกันสังคม บัญชีรับเงินเดือน` : undefined} onClose={onClose}>
      {employee && <AdminBody key={employee.id} e={employee} onClose={onClose} />}
    </FormModal>
  );
}

function AdminBody({ e, onClose }: { e: Employee; onClose: () => void }) {
  const [d, setD] = useState({ ...e.admin, pvd: pvdLabel(e.admin.pvdRate) });
  const [tried, setTried] = useState(false);
  const input: AdminInput = { ssoNumber: d.ssoNumber, taxId: d.taxId, bankName: d.bankName, bankAccount: d.bankAccount, pvdRate: pvdOf(d.pvd) };
  const errors = tried ? adminErrors(input) : {};
  const set = (k: keyof typeof d) => (v: string) => setD((x) => ({ ...x, [k]: v }));

  const save = () => {
    setTried(true);
    if (hasErrors(adminErrors(input))) return;
    updateAdmin(e.id, input);
    notify(`บันทึกข้อมูลทางปกครองของ ${e.name} แล้ว`);
    onClose();
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <TextInput label="เลขประกันสังคม" value={d.ssoNumber} onChange={set("ssoNumber")} hint="10 หลัก" error={errors.ssoNumber} />
        <TextInput label="เลขผู้เสียภาษี" value={d.taxId} onChange={set("taxId")} hint="13 หลัก ตรงกับเลขบัตรประชาชน" error={errors.taxId} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Choice label="ธนาคารรับเงินเดือน" value={d.bankName} onChange={set("bankName")} options={BANKS} error={errors.bankName} />
        <TextInput label="เลขบัญชี" value={d.bankAccount} onChange={set("bankAccount")} error={errors.bankAccount} />
      </div>
      <Choice label="กองทุนสำรองเลี้ยงชีพ" value={d.pvd} onChange={set("pvd")} options={PVD_LABELS} hint="เปลี่ยนอัตราแล้วรายการสวัสดิการจะเปลี่ยนตาม" error={errors.pvdRate} />
      <Note tone="idle">บัญชีใหม่มีผลกับรอบเงินเดือนถัดไป ฝ่ายบัญชีจะเห็นในไฟล์โอนเงินเดือน</Note>
      <FormFooter onCancel={onClose} onSave={save} />
    </div>
  );
}

/* ------------------------------------------------------------- benefits */

function BenefitsForm({ employee, onClose }: { employee: Employee | null; onClose: () => void }) {
  return (
    <FormModal open={employee !== null} title="ลงทะเบียนสวัสดิการ" subtitle={employee ? `${employee.name} · ${employee.position}` : undefined} onClose={onClose}>
      {employee && <BenefitsBody key={employee.id} e={employee} onClose={onClose} />}
    </FormModal>
  );
}

function BenefitsBody({ e, onClose }: { e: Employee; onClose: () => void }) {
  const current = e.benefits.filter((b) => !isPvdBenefit(b));
  const [chosen, setChosen] = useState(current);
  const catalog = [...new Set([...BENEFIT_CATALOG, ...current])];

  const save = () => {
    const { added, removed } = setBenefits(e.id, chosen);
    if (added.length === 0 && removed.length === 0) notify("สวัสดิการไม่มีการเปลี่ยนแปลง", "idle");
    else notify(`ลงทะเบียน ${added.length} รายการ · ยกเลิก ${removed.length} รายการ ของ ${e.name}`);
    onClose();
  };

  return (
    <div className="space-y-4">
      <CheckList
        items={catalog}
        checked={chosen}
        onToggle={(b) => setChosen((x) => (x.includes(b) ? x.filter((y) => y !== b) : [...x, b]))}
        locked={e.benefits.filter(isPvdBenefit)}
      />
      <p className="text-[11.5px] text-slate-400 dark:text-slate-500">
        กองทุนสำรองเลี้ยงชีพเปลี่ยนอัตราได้ที่ข้อมูลทางปกครอง สวัสดิการใหม่มีผลกับรอบเงินเดือนถัดไป
      </p>
      <FormFooter onCancel={onClose} onSave={save} />
    </div>
  );
}

/* ------------------------------------------------------ personnel actions */

function ActionForm({
  open,
  employee,
  preset,
  onClose,
}: {
  open: boolean;
  employee: Employee | null;
  preset: ActionKind;
  onClose: () => void;
}) {
  return (
    <FormModal
      open={open}
      title="ขอเปลี่ยนแปลงทางบุคคล"
      subtitle="โยกย้าย เลื่อนตำแหน่ง ปรับเงินเดือน หรือตักเตือน — แฟ้มเปลี่ยนเมื่อผู้มีอำนาจอนุมัติ"
      onClose={onClose}
    >
      {open && <ActionBody key={(employee?.id ?? 0) + preset} fixed={employee} preset={preset} onClose={onClose} />}
    </FormModal>
  );
}

const labelOf = (e: Employee) => `${e.code} · ${e.name}`;

function ActionBody({ fixed, preset, onClose }: { fixed: Employee | null; preset: ActionKind; onClose: () => void }) {
  const staff = EMPLOYEES.filter(isActive);
  const [who, setWho] = useState<Employee>(fixed ?? staff[0]);
  const [kind, setKind] = useState<ActionKind>(preset);
  const [effectiveDate, setEffectiveDate] = useState(nextMonthStart);
  const [to, setTo] = useState({ ...valuesOf(who), salary: String(who.contract.baseSalary) });
  const [reason, setReason] = useState("");
  const [tried, setTried] = useState(false);

  const input = { employeeId: who.id, kind, effectiveDate, to: { ...to, salary: Number(to.salary) }, reason };
  const errors = tried ? actionErrors(input) : {};
  const setTo_ = (k: keyof typeof to) => (v: string) => setTo((x) => ({ ...x, [k]: v }));

  const choose = (label: string) => {
    const e = staff.find((x) => labelOf(x) === label)!;
    setWho(e);
    setTo({ ...valuesOf(e), salary: String(e.contract.baseSalary) });
  };

  const bump = (pct: number) => setTo((x) => ({ ...x, salary: String(raisedSalary(who.contract.baseSalary, pct)) }));

  const preview: PersonnelAction = {
    id: "", employeeId: who.id, kind, effectiveDate, from: valuesOf(who), reason, requestedAt: TODAY, requestedBy: "คุณ",
    status: "รออนุมัติ",
    to: kind === "ตักเตือน" ? valuesOf(who) : kind === "ปรับเงินเดือน" ? { ...valuesOf(who), salary: Number(to.salary) || 0 } : input.to,
  };

  const save = () => {
    setTried(true);
    if (hasErrors(actionErrors(input))) return;
    const a = requestAction(input);
    notify(`ยื่นคำขอ${a.kind}ของ ${who.name} แล้ว · ${a.id} รออนุมัติ`);
    onClose();
  };

  return (
    <div className="space-y-4">
      {fixed ? (
        <EmployeeSubject e={fixed} />
      ) : (
        <Choice label="พนักงาน" value={labelOf(who)} onChange={choose} options={staff.map(labelOf)} error={errors.employeeId} />
      )}
      <OptionCards label="ประเภทคำขอ" options={ACTION_KINDS} value={kind} onChange={(v) => setKind(v as ActionKind)} error={errors.kind} />

      {(kind === "ย้ายแผนก" || kind === "เลื่อนตำแหน่ง") && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Choice
              label={kind === "ย้ายแผนก" ? "ย้ายไปแผนก" : "แผนก"}
              value={to.department}
              onChange={setTo_("department")}
              options={departments()}
              error={errors.department}
            />
            <TextInput
              label={kind === "เลื่อนตำแหน่ง" ? "ตำแหน่งใหม่" : "ตำแหน่งในแผนกใหม่"}
              value={to.position}
              onChange={setTo_("position")}
              list="pa-positions"
              error={errors.position}
            />
          </div>
          <PositionList />
          <TextInput label="เงินเดือน (บาท)" type="number" value={to.salary} onChange={setTo_("salary")} hint={`ปัจจุบัน ${baht(who.contract.baseSalary)} บาท`} error={errors.salary} />
        </>
      )}

      {kind === "ปรับเงินเดือน" && (
        <div>
          <TextInput label="เงินเดือนใหม่ (บาท)" type="number" value={to.salary} onChange={setTo_("salary")} hint={`ปัจจุบัน ${baht(who.contract.baseSalary)} บาท`} error={errors.salary} />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[3, 5, 7, 10].map((p) => (
              <RowButton key={p} onClick={() => bump(p)}>+{p}%</RowButton>
            ))}
          </div>
          {Number(to.salary) > 0 && Number(to.salary) < who.contract.baseSalary && (
            <div className="mt-3">
              <Note tone="warn">การลดค่าจ้างต้องได้รับความยินยอมเป็นหนังสือจากพนักงาน แนบหนังสือยินยอมก่อนส่งอนุมัติ</Note>
            </div>
          )}
        </div>
      )}

      <TextInput label="วันที่มีผล" type="date" value={effectiveDate} onChange={setEffectiveDate} error={errors.effectiveDate} />
      <LongText
        label={kind === "ตักเตือน" ? "การกระทำผิด" : "เหตุผล"}
        value={reason}
        onChange={setReason}
        placeholder={kind === "ตักเตือน" ? "เช่น มาสายเกินสามครั้งในเดือนกันยายน หลังได้รับการตักเตือนด้วยวาจาแล้ว" : "เช่น ผลประเมินประจำปีระดับ A"}
        error={errors.reason}
      />

      {kind !== "ตักเตือน" && actionSummary(preview) && (
        <div className={"flex items-center gap-2 p-3 text-[12.5px] " + SURFACE}>
          <Tag swatch={swatchFor(kind, ACTION_KINDS)}>{kind}</Tag>
          <span className="text-slate-700 dark:text-slate-200">{actionSummary(preview)}</span>
        </div>
      )}
      <FormFooter onCancel={onClose} onSave={save} saveLabel="ส่งขออนุมัติ" />
    </div>
  );
}

function RaiseForm({ ids, onClose }: { ids: number[] | null; onClose: () => void }) {
  return (
    <FormModal
      open={ids !== null}
      title="ปรับเงินเดือนประจำปี"
      subtitle={ids ? `${ids.length} คนที่เลือกไว้ · ยื่นเป็นคำขอปรับเงินเดือนรายคน รออนุมัติ` : undefined}
      onClose={onClose}
    >
      {ids && <RaiseBody ids={ids} onClose={onClose} />}
    </FormModal>
  );
}

function RaiseBody({ ids, onClose }: { ids: number[]; onClose: () => void }) {
  const [percent, setPercent] = useState("5");
  const [effectiveDate, setEffectiveDate] = useState(nextMonthStart);
  const [reason, setReason] = useState(`ปรับเงินเดือนประจำปี ${Number(TODAY.slice(0, 4)) + 544}`);
  const [tried, setTried] = useState(false);
  const errors = tried ? raiseErrors(Number(percent), effectiveDate, reason) : {};
  const people = ids.map(employeeOf);
  const pct = Number(percent);

  const save = () => {
    setTried(true);
    if (hasErrors(raiseErrors(pct, effectiveDate, reason))) return;
    const made = requestRaises(ids, pct, effectiveDate, reason);
    const skipped = ids.length - made.length;
    notify(`ยื่นคำขอปรับเงินเดือน ${made.length} คน รออนุมัติ` + (skipped ? ` · ข้าม ${skipped} คน` : ""), made.length ? "ok" : "warn");
    onClose();
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <TextInput label="ปรับขึ้นร้อยละ" type="number" value={percent} onChange={setPercent} hint="ปัดเงินเดือนใหม่เป็นหลักสิบบาท" error={errors.percent} />
        <TextInput label="วันที่มีผล" type="date" value={effectiveDate} onChange={setEffectiveDate} error={errors.effectiveDate} />
      </div>
      <TextInput label="เหตุผล" value={reason} onChange={setReason} error={errors.reason} />
      <ul className={"divide-y divide-slate-100 dark:divide-slate-800 " + SURFACE}>
        {people.map((e) => {
          const blocked = raiseBlocked(e);
          return (
            <li key={e.id} className="flex items-center gap-3 px-3 py-2 text-[12.5px]">
              <Avatar name={e.name} size="sm" />
              <span className="min-w-0 flex-1 truncate text-slate-800 dark:text-slate-100">{e.name}</span>
              {blocked ? (
                <Badge tone="idle">{isActive(e) ? "มีคำขอค้างอยู่ ข้าม" : "พ้นสภาพ ข้าม"}</Badge>
              ) : (
                <span className="tabular-nums text-slate-500 dark:text-slate-400">
                  {baht(e.contract.baseSalary)} →{" "}
                  <b className="text-slate-900 dark:text-slate-50">{pct >= 0.5 ? baht(raisedSalary(e.contract.baseSalary, pct)) : "—"}</b>
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <FormFooter onCancel={onClose} onSave={save} saveLabel="ส่งขออนุมัติ" />
    </div>
  );
}

/** Approving changes the record; declining closes the request with the reason on file. */
function DecisionDialog({
  action: a,
  approve,
  onClose,
}: {
  action: PersonnelAction | null;
  approve: boolean;
  onClose: () => void;
}) {
  const [note, setNote] = useState("");
  const done = () => {
    setNote("");
    onClose();
  };
  const e = a ? employeeOf(a.employeeId) : null;

  return (
    <ConfirmDialog
      open={a !== null}
      title={approve ? "อนุมัติคำขอ" : "ไม่อนุมัติคำขอ"}
      body={
        approve
          ? "แฟ้มพนักงานเปลี่ยนตามคำขอทันที บันทึกเป็นเหตุการณ์ในประวัติ และพิมพ์คำสั่งได้"
          : "คำขอปิดโดยไม่เปลี่ยนแฟ้ม ผู้ยื่นจะเห็นเหตุผลนี้"
      }
      confirmLabel={approve ? "อนุมัติ" : "ไม่อนุมัติ"}
      disabled={!approve && note.trim().length < 5}
      subject={
        a && e && (
          <div className={"space-y-1.5 p-3 " + SURFACE}>
            <div className="flex items-center gap-2">
              <Avatar name={e.name} size="sm" />
              <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-slate-900 dark:text-slate-50">{e.name}</span>
              <Tag swatch={swatchFor(a.kind, ACTION_KINDS)}>{a.kind}</Tag>
            </div>
            <p className="text-[12.5px] text-slate-700 dark:text-slate-200">{actionSummary(a)}</p>
            <p className="text-[11.5px] text-slate-500 dark:text-slate-400">
              {a.id} · มีผล {a.effectiveDate} · ยื่นโดย {a.requestedBy}
              {a.kind !== "ตักเตือน" && <> · {a.reason}</>}
            </p>
          </div>
        )
      }
      fields={
        <LongText
          label={approve ? "หมายเหตุ (ถ้ามี)" : "เหตุผลที่ไม่อนุมัติ"}
          value={note}
          onChange={setNote}
          rows={2}
          hint={approve ? undefined : "อย่างน้อย 5 ตัวอักษร"}
        />
      }
      onCancel={done}
      onConfirm={() => {
        if (!a || !e) return;
        if (approve) {
          approveAction(a.id, note);
          notify(`อนุมัติ${a.kind}ของ ${e.name} แล้ว · ${a.id}`);
        } else {
          rejectAction(a.id, note);
          notify(`ไม่อนุมัติ${a.kind}ของ ${e.name} · ${a.id}`, "warn");
        }
        done();
      }}
    />
  );
}

/* -------------------------------------------------------------- leaving */

const REASONS: Record<SeparationKind, string[]> = {
  ลาออก: ["ลาออกตามความสมัครใจ", "ได้งานใหม่", "ย้ายภูมิลำเนา", "ปัญหาสุขภาพ", "ศึกษาต่อ", "ดูแลครอบครัว"],
  เลิกจ้าง: ["ไม่ผ่านการทดลองงาน", "ปรับโครงสร้างองค์กร", "ยุบหน่วยงาน", "ผลงานไม่เป็นไปตามเป้าหมาย", "เกษียณอายุ"],
  "เลิกจ้างตามมาตรา 119": [
    "ทุจริตต่อหน้าที่",
    "จงใจทำให้นายจ้างได้รับความเสียหาย",
    "ประมาทเลินเล่อเป็นเหตุให้นายจ้างเสียหายร้ายแรง",
    "ฝ่าฝืนข้อบังคับซ้ำหลังได้รับหนังสือเตือน",
    "ละทิ้งหน้าที่ 3 วันทำงานติดต่อกัน",
    "ได้รับโทษจำคุกตามคำพิพากษาถึงที่สุด",
  ],
  สิ้นสุดสัญญาจ้าง: ["ครบกำหนดสัญญาจ้าง ไม่ต่อสัญญา"],
};

/** The last day a kind of leaving normally lands on, counted from today. */
const lastDayFor = (e: Employee, kind: SeparationKind) =>
  kind === "สิ้นสุดสัญญาจ้าง" && e.contract.endsAt
    ? e.contract.endsAt
    : kind === "เลิกจ้างตามมาตรา 119"
      ? TODAY
      : addDays(TODAY, NOTICE_DAYS);

function SeparationForm({
  employee,
  preset,
  onClose,
}: {
  employee: Employee | null;
  preset?: { kind: SeparationKind; reason: string };
  onClose: () => void;
}) {
  return (
    <FormModal
      open={employee !== null}
      title="บันทึกการพ้นสภาพ"
      subtitle="ลาออก เลิกจ้าง หรือครบสัญญา — ระบบคิดค่าชดเชยและค่าจ้างแทนการบอกกล่าวตามกฎหมายคุ้มครองแรงงาน"
      onClose={onClose}
    >
      {employee && <SeparationBody key={employee.id} e={employee} preset={preset} onClose={onClose} />}
    </FormModal>
  );
}

function SeparationBody({
  e,
  preset,
  onClose,
}: {
  e: Employee;
  preset?: { kind: SeparationKind; reason: string };
  onClose: () => void;
}) {
  const start = preset?.kind ?? "ลาออก";
  const [kind, setKind] = useState<SeparationKind>(start);
  const [noticeDate, setNoticeDate] = useState(TODAY);
  const [lastDay, setLastDay] = useState(lastDayFor(e, start));
  const [reason, setReason] = useState(preset?.reason ?? REASONS[start][0]);
  const [message, setMessage] = useState("");
  const [tried, setTried] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const input: SeparationInput = { kind, noticeDate, lastDay, reason };
  const found = separationErrors(e, input);
  const errors = tried ? found : {};
  const datesOk = !found.noticeDate && !found.lastDay;
  const pay = datesOk ? separationPay(e, kind, noticeDate, lastDay) : null;
  const shortNotice = datesOk && daysBetween(noticeDate, lastDay) < NOTICE_DAYS;
  const involuntary = kind === "เลิกจ้าง" || kind === "เลิกจ้างตามมาตรา 119";

  const choose = (k: string) => {
    const next = k as SeparationKind;
    setKind(next);
    setReason(REASONS[next][0]);
    setLastDay(lastDayFor(e, next));
  };

  // A courteous note drafted from the reason — a template filled in, not a
  // model call, and labelled as such so nobody mistakes it for one.
  const draft = () =>
    setMessage(
      kind === "ลาออก"
        ? `เรียน คุณ${e.nickname}\n\nบริษัทรับทราบการลาออกของท่าน (${reason}) มีผลหลังวันทำงานสุดท้าย ${thaiDate(lastDay)} และขอขอบคุณสำหรับการทำงานที่ผ่านมา ฝ่ายบุคคลจะติดต่อเรื่องการส่งมอบงาน ทรัพย์สินของบริษัท และเอกสารสิทธิประโยชน์ภายใน 3 วันทำการ\n\nขอให้ท่านประสบความสำเร็จในเส้นทางต่อไป`
        : `เรียน คุณ${e.nickname}\n\nบริษัทขอแจ้งการสิ้นสุดการจ้างของท่าน (${reason}) โดยมีวันทำงานวันสุดท้ายคือ ${thaiDate(lastDay)}` +
            (pay && pay.severance + pay.noticePay > 0 ? ` บริษัทจะจ่ายค่าชดเชยและเงินตามกฎหมายรวม ${money(pay.severance + pay.noticePay)} บาท พร้อมค่าจ้างงวดสุดท้าย` : "") +
            `\n\nฝ่ายบุคคลจะนัดหมายเรื่องการส่งมอบงานและหนังสือรับรองการทำงานต่อไป`
    );

  const review = () => {
    setTried(true);
    if (hasErrors(found)) return;
    setConfirming(true);
  };

  const record = () => {
    const s = recordSeparation(e.id, input, message.trim() !== "");
    notify(
      `บันทึก${s.kind}ของ ${e.name} แล้ว` + (s.severance + s.noticePay > 0 ? ` · ต้องจ่าย ${money(s.severance + s.noticePay)} บาท` : "")
    );
    setConfirming(false);
    onClose();
  };

  return (
    <div className="space-y-4">
      <EmployeeSubject e={e} />
      <OptionCards label="ลักษณะการพ้นสภาพ" options={SEPARATION_KINDS} value={kind} onChange={choose} error={errors.kind} />
      <div className="grid grid-cols-2 gap-3">
        <TextInput label={kind === "ลาออก" ? "วันที่ยื่นใบลาออก" : "วันที่แจ้ง"} type="date" value={noticeDate} onChange={setNoticeDate} error={errors.noticeDate} />
        <TextInput label="วันทำงานวันสุดท้าย" type="date" value={lastDay} onChange={setLastDay} error={errors.lastDay} />
      </div>
      <Choice label="เหตุผล" value={reason} onChange={setReason} options={REASONS[kind]} error={errors.reason} />

      {pay && (
        <div className={"divide-y divide-slate-100 text-[12.5px] dark:divide-slate-800 " + SURFACE}>
          <PayRow label="อายุงานถึงวันสุดท้าย" value={`${pay.serviceDays.toLocaleString("th-TH")} วัน · ${serviceYears(e.contract.startedAt, lastDay)} ปีเต็ม`} />
          <PayRow
            label="ค่าชดเชย (มาตรา 118)"
            value={pay.severanceDays ? `${pay.severanceDays} วัน = ${money(pay.severance)} บาท` : "ไม่มี"}
            sub={
              kind === "ลาออก"
                ? "ลาออกเองไม่มีสิทธิได้รับค่าชดเชย"
                : kind === "เลิกจ้างตามมาตรา 119"
                  ? "เลิกจ้างด้วยเหตุตามมาตรา 119 ไม่ต้องจ่ายค่าชดเชย"
                  : pay.severanceDays === 0
                    ? "ทำงานไม่ถึง 120 วัน"
                    : `ค่าจ้างวันละ ${money(e.contract.baseSalary / 30)} บาท`
            }
          />
          <PayRow
            label="ค่าจ้างแทนการบอกกล่าวล่วงหน้า"
            value={pay.noticePay ? `${money(pay.noticePay)} บาท` : "ไม่มี"}
            sub={kind === "เลิกจ้าง" ? `ต้องแจ้งล่วงหน้า ${NOTICE_DAYS} วัน แจ้งแล้ว ${Math.max(0, daysBetween(noticeDate, lastDay))} วัน` : undefined}
          />
          <PayRow label="รวมที่ต้องจ่ายเพิ่มจากค่าจ้างงวดสุดท้าย" value={`${money(pay.severance + pay.noticePay)} บาท`} strong />
        </div>
      )}
      {kind === "ลาออก" && shortNotice && (
        <Note tone="warn">ยื่นล่วงหน้าไม่ถึง {NOTICE_DAYS} วัน ตามระเบียบควรแจ้งล่วงหน้าหนึ่งงวดค่าจ้าง ตกลงวันสุดท้ายกับหัวหน้างานก่อนบันทึก</Note>
      )}

      <Field label="ข้อความถึงพนักงาน">
        <div className={"relative overflow-hidden " + SURFACE}>
          <textarea
            value={message}
            onChange={(ev) => setMessage(ev.target.value)}
            rows={4}
            placeholder="พิมพ์ข้อความ…"
            className="w-full resize-none bg-transparent px-3.5 py-3 pb-12 text-[13px] leading-relaxed text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100"
          />
          <motion.button
            type="button"
            whileTap={{ scale: 0.96 }}
            onClick={draft}
            className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-fuchsia-500 to-orange-400 px-3 py-1.5 text-[12px] font-medium text-white shadow-sm"
          >
            <Sparkles size={13} />
            ร่างข้อความอัตโนมัติ
          </motion.button>
        </div>
      </Field>

      <FormFooter onCancel={onClose} onSave={review} saveLabel="ตรวจสอบแล้วบันทึก" />

      <ConfirmDialog
        open={confirming}
        title={`ยืนยัน${kind}`}
        body="แฟ้มจะปิด พนักงานคนนี้ออกจากรอบเงินเดือน ตารางกะ และผังองค์กร คำขอที่ค้างอยู่จะถูกปิด ย้อนกลับไม่ได้"
        subject={<EmployeeSubject e={e} />}
        fields={
          <p className="text-center text-[12.5px] text-slate-600 dark:text-slate-300">
            วันสุดท้าย {thaiDate(lastDay)} · {reason}
            {pay && pay.severance + pay.noticePay > 0 && <> · ต้องจ่าย <b>{money(pay.severance + pay.noticePay)} บาท</b></>}
          </p>
        }
        confirmWord={involuntary ? "เลิกจ้าง" : undefined}
        confirmLabel={`บันทึก${kind}`}
        onCancel={() => setConfirming(false)}
        onConfirm={record}
      />
    </div>
  );
}

function PayRow({ label, value, sub, strong }: { label: string; value: ReactNode; sub?: string; strong?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 px-3 py-2">
      <span>
        <span className={"block " + (strong ? "font-medium text-slate-900 dark:text-slate-50" : "text-slate-600 dark:text-slate-300")}>{label}</span>
        {sub && <span className="block text-[11px] text-slate-400 dark:text-slate-500">{sub}</span>}
      </span>
      <span className={"shrink-0 text-right tabular-nums " + (strong ? "font-semibold text-slate-900 dark:text-slate-50" : "text-slate-800 dark:text-slate-100")}>
        {value}
      </span>
    </div>
  );
}
