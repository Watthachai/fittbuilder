import { useState } from "react";
import { Search as SearchIcon } from "lucide-react";
import { EMPLOYEES } from "../pa/data";
import type { Employee } from "../pa/data";
import {
  BANDS, LEVELS, ORG_UNITS, POSITIONS, REQ_KINDS, REQUISITIONS, TODAY, actingErrors, approveRequisition, assignActing,
  assignHolder, bandOf, createPosition, createUnit, gapsOf, holderFor, nextUnitCode, openRequisition,
  positionErrors, positionOf, rejectRequisition, releaseHolder, reportsUnder, requisitionErrors,
  setPlannedHeadcount, setQualifications, unitErrors, unitOf, unitsUnder, updatePosition, updateUnit,
} from "./data";
import type { Level, PositionInput, Requisition, RequisitionKind, UnitInput } from "./data";
import { Avatar, Badge, FIELD, Note, SURFACE, Search } from "../ui";
import { ConfirmDialog, Field, FormModal, Wizard, notify, useData } from "../kit";
import type { Step } from "../kit";
import { Choice, FormFooter, LongText, OptionCards, TextInput } from "../pa/parts";
import { OrgReportSheet } from "./report";

/**
 * Every dialog that changes the organisation, raised from one place so the
 * chart, the registers, a seat opened over any of them and the hidden screen
 * index all open the same form.
 */
export type OmSheet =
  | { kind: "unit"; id: number | null }
  | { kind: "position"; id: number | null; unitId?: number }
  | { kind: "assign"; positionId: number }
  | { kind: "acting"; positionId: number }
  | { kind: "release"; positionId: number }
  | { kind: "requisition"; positionId?: number; reqKind?: RequisitionKind }
  | { kind: "decideReq"; id: string; approve: boolean }
  | { kind: "planned"; unitId: number }
  | { kind: "quals"; positionId: number }
  | { kind: "report" };

type Of<K extends OmSheet["kind"]> = Extract<OmSheet, { kind: K }>;

const hasErrors = (e: Record<string, string>) => Object.keys(e).length > 0;
const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

export function OmSheets({ sheet, onSheet }: { sheet: OmSheet | null; onSheet: (s: OmSheet | null) => void }) {
  useData();
  const close = () => onSheet(null);
  const pick = <K extends OmSheet["kind"]>(kind: K): Of<K> | null => (sheet?.kind === kind ? (sheet as Of<K>) : null);
  const unit = pick("unit");
  const position = pick("position");
  const assign = pick("assign");
  const acting = pick("acting");
  const release = pick("release");
  const req = pick("requisition");
  const decide = pick("decideReq");
  const planned = pick("planned");
  const quals = pick("quals");
  const releasing = release ? positionOf(release.positionId) : null;

  return (
    <>
      <FormModal
        open={unit !== null}
        title={unit?.id ? "แก้ไขหรือย้ายหน่วยงาน" : "เพิ่มหน่วยงาน"}
        subtitle={unit?.id ? `${unitOf(unit.id).code} · ${unitOf(unit.id).name}` : `จะได้รหัส ${nextUnitCode()}`}
        onClose={close}
      >
        {unit && <UnitBody key={unit.id ?? 0} id={unit.id} onClose={close} />}
      </FormModal>

      <FormModal
        open={position !== null}
        title={position?.id ? "แก้ไขตำแหน่ง" : "สร้างตำแหน่ง"}
        subtitle={position?.id ? positionOf(position.id).code : "ตำแหน่งใหม่เริ่มว่าง มอบหมายผู้ดำรงได้หลังบันทึก"}
        onClose={close}
      >
        {position && <PositionBody key={position.id ?? 0} id={position.id} unitId={position.unitId} onClose={close} />}
      </FormModal>

      <AssignDialog positionId={assign?.positionId ?? null} onClose={close} />

      <FormModal
        open={acting !== null}
        size="sm"
        title="มอบหมายรักษาการ"
        subtitle={acting ? `${positionOf(acting.positionId).title} · ตำแหน่งยังนับเป็นว่างในแผนอัตรากำลัง` : undefined}
        onClose={close}
      >
        {acting && <ActingBody positionId={acting.positionId} onClose={close} />}
      </FormModal>

      <ConfirmDialog
        open={releasing !== null}
        title="ปลดผู้ดำรงตำแหน่ง"
        body="ตำแหน่งจะกลายเป็นว่างทันที และจะขึ้นในรายการที่ต้องเปิดคำขออัตรากำลัง ประวัติของพนักงานในทะเบียนไม่ถูกแตะต้อง"
        subject={
          releasing && (
            <span className="flex items-center gap-2.5">
              <Avatar name={holderFor(releasing)?.name ?? ""} size="sm" />
              <span>
                <span className="block text-[13px] font-medium text-slate-900 dark:text-slate-50">{holderFor(releasing)?.name}</span>
                <span className="block text-[11.5px] text-slate-500 dark:text-slate-400">{releasing.title}</span>
              </span>
            </span>
          )
        }
        confirmLabel="ปลดออกจากตำแหน่ง"
        onCancel={close}
        onConfirm={() => {
          if (!releasing) return;
          const name = holderFor(releasing)?.name;
          releaseHolder(releasing.id);
          notify(`ปลด ${name} ออกจาก${releasing.title}แล้ว ตำแหน่งว่าง`, "warn");
          close();
        }}
      />

      <FormModal open={req !== null} title="เปิดคำขออัตรากำลัง" subtitle="กรอกสามขั้นตอน ระบบตรวจความถูกต้องให้ก่อนไปขั้นถัดไป" onClose={close}>
        {req && <RequisitionWizard positionId={req.positionId} reqKind={req.reqKind} onClose={close} />}
      </FormModal>

      <ReqDecision req={decide ? REQUISITIONS.find((r) => r.id === decide.id) ?? null : null} approve={decide?.approve ?? true} onClose={close} />

      <FormModal open={planned !== null} size="sm" title="แก้อัตรากำลังตามแผน" subtitle={planned ? unitOf(planned.unitId).name : undefined} onClose={close}>
        {planned && <PlannedBody unitId={planned.unitId} onClose={close} />}
      </FormModal>

      <FormModal open={quals !== null} title="คุณสมบัติประจำตำแหน่ง" subtitle={quals ? positionOf(quals.positionId).title : undefined} onClose={close}>
        {quals && <QualsBody positionId={quals.positionId} onClose={close} />}
      </FormModal>

      <OrgReportSheet open={pick("report") !== null} onClose={close} />
    </>
  );
}

/* ----------------------------------------------------------------- units */

function UnitBody({ id, onClose }: { id: number | null; onClose: () => void }) {
  const was = id === null ? null : unitOf(id);
  const [d, setD] = useState({
    name: was?.name ?? "",
    parent: unitOf(was?.parentId ?? ORG_UNITS.find((u) => u.parentId === null)!.id).name,
    planned: String(was?.plannedHeadcount ?? 1),
    costCentre: was?.costCentre ?? "CC-" + nextUnitCode().slice(4),
  });
  const [tried, setTried] = useState(false);
  // A unit cannot move under itself or anything beneath it.
  const barred = id === null ? [] : [id, ...unitsUnder(id).map((u) => u.id)];
  const parents = ORG_UNITS.filter((u) => !barred.includes(u.id));
  const input: UnitInput = {
    name: d.name,
    parentId: parents.find((u) => u.name === d.parent)?.id ?? -1,
    plannedHeadcount: Number(d.planned),
    costCentre: d.costCentre.trim(),
  };
  const errors = tried ? unitErrors(input, id ?? undefined) : {};
  const set = (k: keyof typeof d) => (v: string) => setD((x) => ({ ...x, [k]: v }));

  const save = () => {
    setTried(true);
    if (hasErrors(unitErrors(input, id ?? undefined))) return;
    if (id === null) {
      const u = createUnit(input);
      notify(`เพิ่มหน่วยงาน ${u.name} (${u.code}) ใต้${d.parent}แล้ว`);
    } else {
      updateUnit(id, input);
      notify(was!.parentId !== input.parentId ? `ย้าย ${input.name.trim()} ไปอยู่ใต้${d.parent}แล้ว` : `บันทึกหน่วยงาน ${input.name.trim()} แล้ว`);
    }
    onClose();
  };

  return (
    <div className="space-y-4">
      <TextInput label="ชื่อหน่วยงาน" value={d.name} onChange={set("name")} placeholder="ฝ่ายการตลาด" error={errors.name} />
      <Choice label="ขึ้นตรงต่อ" value={d.parent} onChange={set("parent")} options={parents.map((u) => u.name)} error={errors.parentId} />
      <div className="grid grid-cols-2 gap-3">
        <TextInput label="อัตรากำลังตามแผน (คน)" type="number" value={d.planned} onChange={set("planned")} error={errors.plannedHeadcount} />
        <TextInput label="ศูนย์ต้นทุน" value={d.costCentre} onChange={set("costCentre")} hint="ใช้ปันส่วนเงินเดือนในบัญชี" error={errors.costCentre} />
      </div>
      {was && was.name !== d.name.trim() && (
        <Note tone="idle">ชื่อแผนกในทะเบียนพนักงานเป็นของฝ่ายบุคคล เปลี่ยนชื่อที่นี่แล้วแจ้งฝ่ายบุคคลให้ย้ายแผนกของพนักงานตาม</Note>
      )}
      <FormFooter onCancel={onClose} onSave={save} />
    </div>
  );
}

function PlannedBody({ unitId, onClose }: { unitId: number; onClose: () => void }) {
  const u = unitOf(unitId);
  const have = POSITIONS.filter((p) => p.unitId === unitId && holderFor(p)).length;
  const [planned, setPlanned] = useState(String(u.plannedHeadcount));
  const [tried, setTried] = useState(false);
  const n = Number(planned);
  const error = tried && !(Number.isInteger(n) && n >= 0) ? "อัตรากำลังเป็นจำนวนเต็มตั้งแต่ 0" : undefined;

  const save = () => {
    setTried(true);
    if (!(Number.isInteger(n) && n >= 0)) return;
    setPlannedHeadcount(unitId, n);
    notify(`ตั้งแผนอัตรากำลัง${u.name}เป็น ${n} คนแล้ว`);
    onClose();
  };

  return (
    <div className="space-y-4">
      <TextInput label="อัตรากำลังตามแผน (คน)" type="number" value={planned} onChange={setPlanned} hint={`มีอยู่จริง ${have} คน`} error={error} />
      {Number.isInteger(n) && n > have && <Note tone="warn">ต้องรับเพิ่ม {n - have} คน เปิดคำขออัตรากำลังได้จากหน้านี้</Note>}
      <FormFooter onCancel={onClose} onSave={save} />
    </div>
  );
}

/* ------------------------------------------------------------- positions */

const TOP = "— ไม่มี (รายงานต่อคณะกรรมการ)";

function PositionBody({ id, unitId, onClose }: { id: number | null; unitId?: number; onClose: () => void }) {
  const was = id === null ? null : positionOf(id);
  const barred = id === null ? [] : [id, ...reportsUnder(id).map((p) => p.id)];
  const bosses = POSITIONS.filter((p) => !barred.includes(p.id));
  const bossLabel = (pid: number | null) => (pid === null ? TOP : `${positionOf(pid).title} · ${positionOf(pid).code}`);
  const [d, setD] = useState({
    unit: unitOf(was?.unitId ?? unitId ?? ORG_UNITS[1].id).name,
    title: was?.title ?? "",
    level: (was?.level ?? "ปฏิบัติการ") as string,
    boss: bossLabel(was ? was.reportsTo : (POSITIONS.find((p) => p.reportsTo === null)?.id ?? null)),
    duties: was?.duties.join("\n") ?? "",
    quals: was?.qualifications.join("\n") ?? "",
  });
  const [tried, setTried] = useState(false);
  const input: PositionInput = {
    unitId: ORG_UNITS.find((u) => u.name === d.unit)?.id ?? -1,
    title: d.title,
    level: d.level as Level,
    reportsTo: d.boss === TOP ? null : (bosses.find((p) => bossLabel(p.id) === d.boss)?.id ?? -1),
    duties: lines(d.duties),
    qualifications: lines(d.quals),
  };
  const errors = tried ? positionErrors(input, id ?? undefined) : {};
  const set = (k: keyof typeof d) => (v: string) => setD((x) => ({ ...x, [k]: v }));
  const band = BANDS[d.level as Level];

  const save = () => {
    setTried(true);
    if (hasErrors(positionErrors(input, id ?? undefined))) return;
    if (id === null) {
      const p = createPosition(input);
      notify(`สร้างตำแหน่ง ${p.title} (${p.code}) แล้ว ตำแหน่งว่างรอมอบหมาย`);
    } else {
      updatePosition(id, input);
      notify(`บันทึกตำแหน่ง ${input.title.trim()} แล้ว`);
    }
    onClose();
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <TextInput label="ชื่อตำแหน่ง" value={d.title} onChange={set("title")} placeholder="เจ้าหน้าที่การตลาด" error={errors.title} />
        <Choice label="หน่วยงาน" value={d.unit} onChange={set("unit")} options={ORG_UNITS.map((u) => u.name)} error={errors.unitId} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Choice
          label="ระดับ"
          value={d.level}
          onChange={set("level")}
          options={LEVELS}
          hint={`กรอบเงินเดือน ${band.min.toLocaleString("th-TH")}–${band.max.toLocaleString("th-TH")} บาท`}
          error={errors.level}
        />
        <Choice label="รายงานต่อ" value={d.boss} onChange={set("boss")} options={[TOP, ...bosses.map((p) => bossLabel(p.id))]} error={errors.reportsTo} />
      </div>
      <LongText label="หน้าที่หลัก" value={d.duties} onChange={set("duties")} rows={4} hint="บรรทัดละหนึ่งข้อ" error={errors.duties} />
      <LongText label="คุณสมบัติประจำตำแหน่ง" value={d.quals} onChange={set("quals")} rows={3} hint="บรรทัดละหนึ่งข้อ ใช้เทียบกับทักษะของผู้ดำรงตำแหน่ง" />
      {was && was.title !== d.title.trim() && (
        <Note tone="idle">ผู้ดำรงตำแหน่งเดิมยังอยู่ในตำแหน่งนี้ ชื่อตำแหน่งในทะเบียนพนักงานเปลี่ยนผ่านคำขอเลื่อนตำแหน่งของฝ่ายบุคคล</Note>
      )}
      <FormFooter onCancel={onClose} onSave={save} />
    </div>
  );
}

function QualsBody({ positionId, onClose }: { positionId: number; onClose: () => void }) {
  const p = positionOf(positionId);
  const [text, setText] = useState(p.qualifications.join("\n"));
  const [tried, setTried] = useState(false);
  const error = tried && lines(text).length === 0 ? "ใส่คุณสมบัติอย่างน้อยหนึ่งข้อ" : undefined;
  const holder = holderFor(p);

  const save = () => {
    setTried(true);
    if (lines(text).length === 0) return;
    setQualifications(p.id, lines(text));
    notify(`บันทึกคุณสมบัติของ${p.title} ${lines(text).length} ข้อแล้ว`);
    onClose();
  };

  return (
    <div className="space-y-4">
      <LongText label="คุณสมบัติ" value={text} onChange={setText} rows={6} hint="บรรทัดละหนึ่งข้อ" error={error} />
      {holder && (
        <Note tone="idle">
          {holder.name} จะขาดคุณสมบัติ {gapsOf({ ...p, qualifications: lines(text) }, holder).length} ข้อตามรายการใหม่
        </Note>
      )}
      <FormFooter onCancel={onClose} onSave={save} />
    </div>
  );
}

/* ------------------------------------------------------------ assignment */

/** The seat each person holds today, so the picker can say who would be moved. */
const seatHeldBy = (e: Employee) => POSITIONS.find((p) => holderFor(p)?.id === e.id);

function AssignDialog({ positionId, onClose }: { positionId: number | null; onClose: () => void }) {
  const [q, setQ] = useState("");
  const position = positionId === null ? null : positionOf(positionId);
  const needle = q.trim().toLowerCase();
  const candidates = EMPLOYEES.filter(
    (e) =>
      e.status !== "ลาออก" &&
      (needle === "" || [e.name, e.nickname, e.code, e.department].some((t) => t.toLowerCase().includes(needle)))
  );

  return (
    <FormModal
      open={position !== null}
      title="มอบหมายผู้ดำรงตำแหน่ง"
      subtitle={position ? `${position.title} · ${unitOf(position.unitId).name}` : undefined}
      onClose={() => {
        setQ("");
        onClose();
      }}
    >
      <div className="space-y-3">
        <Search value={q} onChange={setQ} placeholder="ค้นหาชื่อ ชื่อเล่น หรือรหัสพนักงาน" icon={<SearchIcon size={14} />} className="w-full" />
        <ul className="max-h-72 space-y-1 overflow-y-auto">
          {candidates.map((e) => {
            const fits = position ? gapsOf(position, e).length === 0 : false;
            const held = seatHeldBy(e);
            const here = held?.id === position?.id;
            return (
              <li key={e.id}>
                <button
                  disabled={here}
                  onClick={() => {
                    if (!position) return;
                    assignHolder(position.id, e.id);
                    notify(`มอบหมาย ${e.name} เป็น${position.title}แล้ว` + (held ? ` · ${held.title}ว่างลง` : ""));
                    setQ("");
                    onClose();
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-violet-50 disabled:cursor-default disabled:opacity-50 dark:hover:bg-violet-500/10"
                >
                  <Avatar name={e.name} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] text-slate-900 dark:text-slate-50">{e.name}</span>
                    <span className="block truncate text-[11.5px] text-slate-400">
                      {here ? "ดำรงตำแหน่งนี้อยู่แล้ว" : held ? `ตอนนี้: ${held.title} — จะว่างลง` : `${e.position} · ยังไม่มีที่นั่งในผัง`}
                    </span>
                  </span>
                  <Badge tone={fits ? "ok" : "warn"}>{fits ? "คุณสมบัติครบ" : "คุณสมบัติไม่ครบ"}</Badge>
                </button>
              </li>
            );
          })}
          {candidates.length === 0 && (
            <li className="py-8 text-center text-[12.5px] text-slate-400">ไม่พบพนักงานที่ตรงกับ “{q}”</li>
          )}
        </ul>
        <p className="text-[11.5px] text-slate-400">
          รายชื่ออ่านจากทะเบียนพนักงาน คนที่ลาออกแล้วจะไม่ขึ้นในรายการนี้ คำขออัตรากำลังของตำแหน่งนี้ปิดเองเมื่อมอบหมาย
        </p>
      </div>
    </FormModal>
  );
}

const labelOf = (e: Employee) => `${e.code} · ${e.name}`;

function ActingBody({ positionId, onClose }: { positionId: number; onClose: () => void }) {
  const staff = EMPLOYEES.filter((e) => e.status !== "ลาออก");
  const [who, setWho] = useState(labelOf(staff[0]));
  const [until, setUntil] = useState(() => {
    const d = new Date(TODAY);
    d.setUTCMonth(d.getUTCMonth() + 3);
    return d.toISOString().slice(0, 10);
  });
  const [tried, setTried] = useState(false);
  const employee = staff.find((e) => labelOf(e) === who)!;
  const errors = tried ? actingErrors(positionId, employee.id, until) : {};

  const save = () => {
    setTried(true);
    if (hasErrors(actingErrors(positionId, employee.id, until))) return;
    assignActing(positionId, employee.id, until);
    notify(`มอบหมาย ${employee.name} รักษาการ${positionOf(positionId).title}ถึง ${until} แล้ว`);
    onClose();
  };

  return (
    <div className="space-y-4">
      {errors.positionId && <Note tone="warn">{errors.positionId}</Note>}
      <Choice label="ผู้รักษาการ" value={who} onChange={setWho} options={staff.map(labelOf)} error={errors.employeeId} hint="ยังดำรงตำแหน่งเดิมของตัวเองอยู่" />
      <TextInput label="รักษาการถึงวันที่" type="date" value={until} onChange={setUntil} error={errors.until} />
      <FormFooter onCancel={onClose} onSave={save} saveLabel="มอบหมายรักษาการ" />
    </div>
  );
}

/* ---------------------------------------------------------- requisitions */

function RequisitionWizard({
  positionId,
  reqKind,
  onClose,
}: {
  positionId?: number;
  reqKind?: RequisitionKind;
  onClose: () => void;
}) {
  const vacantFirst = [...POSITIONS].sort((a, b) => Number(!!holderFor(a)) - Number(!!holderFor(b)));
  const label = (id: number) => `${positionOf(id).title} · ${unitOf(positionOf(id).unitId).name} · ${holderFor(positionOf(id)) ? "มีผู้ดำรง" : "ว่าง"}`;
  const first = positionId ?? vacantFirst[0].id;
  const [chosen, setChosen] = useState(label(first));
  const [kind, setKind] = useState<RequisitionKind>(reqKind ?? (holderFor(positionOf(first)) ? "อัตราเพิ่ม" : "ตำแหน่งว่าง"));
  const [wantedBy, setWantedBy] = useState("");
  const [reason, setReason] = useState("");
  const p = vacantFirst.find((x) => label(x.id) === chosen)!;
  const input = { positionId: p.id, kind, wantedBy, reason };
  const all = requisitionErrors(input);
  const only = (keys: string[]) => Object.fromEntries(Object.entries(all).filter(([k]) => keys.includes(k)));

  const steps: Step[] = [
    {
      title: "ตำแหน่ง",
      validate: () => only(["positionId"]),
      render: (errors) => (
        <div className="space-y-3">
          <Choice label="ตำแหน่งที่ขออัตรากำลัง" value={chosen} onChange={setChosen} options={vacantFirst.map((x) => label(x.id))} error={errors.positionId} />
          <OptionCards
            label="ประเภทคำขอ"
            options={REQ_KINDS}
            value={kind}
            onChange={(v) => setKind(v as RequisitionKind)}
            hint={kind === "อัตราเพิ่ม" ? "อนุมัติแล้วได้ตำแหน่งใหม่แบบเดียวกันในหน่วยงานนี้ และแผนเพิ่มหนึ่งอัตรา" : "หาคนมาดำรงตำแหน่งที่ว่างอยู่"}
          />
          <Note tone="idle">
            ระดับ {p.level} · กรอบค่าตอบแทน {bandOf(p).min.toLocaleString("th-TH")}–{bandOf(p).max.toLocaleString("th-TH")} บาท/เดือน
          </Note>
        </div>
      ),
    },
    {
      title: "กำหนดเวลา",
      validate: () => only(["wantedBy"]),
      render: (errors) => (
        <Field label="ต้องการคนภายในวันที่" error={errors.wantedBy} hint="ใช้กำหนดลำดับความเร่งด่วนในการสรรหา">
          <input type="date" value={wantedBy} min={TODAY} onChange={(e) => setWantedBy(e.target.value)} className={FIELD + " w-full"} />
        </Field>
      ),
    },
    {
      title: "เหตุผล",
      validate: () => only(["reason"]),
      render: (errors) => (
        <LongText
          label="เหตุผลที่ต้องเพิ่มอัตรา"
          value={reason}
          onChange={setReason}
          rows={4}
          placeholder="เช่น ผู้ดำรงตำแหน่งเดิมลาออก งานค้างอยู่ที่หน่วยงานอื่น"
          error={errors.reason}
        />
      ),
    },
  ];

  return (
    <Wizard
      steps={steps}
      onCancel={onClose}
      doneLabel="เปิดคำขอ"
      onDone={() => {
        const r = openRequisition(input);
        notify(`เปิดคำขออัตรากำลัง ${r.id} (${r.kind}) แล้ว รออนุมัติ`);
        onClose();
      }}
    />
  );
}

function ReqDecision({ req, approve, onClose }: { req: Requisition | null; approve: boolean; onClose: () => void }) {
  const [note, setNote] = useState("");
  const done = () => {
    setNote("");
    onClose();
  };
  const p = req ? positionOf(req.positionId) : null;
  return (
    <ConfirmDialog
      open={req !== null}
      title={approve ? "อนุมัติคำขออัตรากำลัง" : "ไม่อนุมัติคำขออัตรากำลัง"}
      body={
        approve
          ? req?.kind === "อัตราเพิ่ม"
            ? "ได้ตำแหน่งใหม่ที่ว่างอยู่ในหน่วยงานนี้ และแผนอัตรากำลังเพิ่มหนึ่งอัตรา ฝ่ายบุคคลเริ่มสรรหาได้"
            : "ฝ่ายบุคคลเริ่มสรรหาได้ คำขอปิดเองเมื่อมอบหมายผู้ดำรงตำแหน่ง"
          : "คำขอปิดโดยไม่เปลี่ยนแผน ผู้ขอจะเห็นเหตุผลนี้"
      }
      confirmLabel={approve ? "อนุมัติ" : "ไม่อนุมัติ"}
      disabled={!approve && note.trim().length < 5}
      subject={
        req && p && (
          <div className={"space-y-1 p-3 text-[12.5px] " + SURFACE}>
            <p className="font-semibold text-slate-900 dark:text-slate-50">{p.title} · {unitOf(p.unitId).name}</p>
            <p className="text-slate-600 dark:text-slate-300">{req.reason}</p>
            <p className="text-[11.5px] text-slate-500 dark:text-slate-400">{req.id} · {req.kind} · ต้องการภายใน {req.wantedBy}</p>
          </div>
        )
      }
      fields={
        !approve && (
          <LongText label="เหตุผลที่ไม่อนุมัติ" value={note} onChange={setNote} rows={2} hint="อย่างน้อย 5 ตัวอักษร" />
        )
      }
      onCancel={done}
      onConfirm={() => {
        if (!req) return;
        if (approve) {
          const r = approveRequisition(req.id);
          notify(`อนุมัติคำขอ ${r.id} แล้ว` + (r.kind === "อัตราเพิ่ม" ? ` · ได้ตำแหน่ง ${positionOf(r.positionId).code}` : ""));
        } else {
          rejectRequisition(req.id, note);
          notify(`ไม่อนุมัติคำขอ ${req.id}`, "warn");
        }
        done();
      }}
    />
  );
}

