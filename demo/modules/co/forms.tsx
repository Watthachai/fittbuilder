import { useState } from "react";
import type { ReactNode } from "react";
import { ChevronDown, Printer } from "lucide-react";
import { ASSETS, PERIOD, TODAY } from "../fi/data";
import { material } from "../mm/data";
import {
  ALLOCATION, CHANNEL_PROFIT_CENTER, COST_CENTERS, COST_ESTIMATES, FINISHED_GOODS, OVERHEAD, PROFIT_CENTERS,
  addCostCenter, addCycle, addProfitCenter, assignChannel, assignCostCenter, baht, closeInternalOrder, costCenter,
  createInternalOrder, currentEstimate, estimateTotals, expenseAccounts, internalOrder, ioBalance, markEstimate,
  nextEstimate, NEXT_PERIOD, postIoCost, previewCycle, raiseIoBudget, releaseEstimate, runCycle, runEstimate,
  setBudget, setDistribution, setOverheadRate, settleInternalOrder, costsOf, settlementsOf,
} from "./data";
import type { CostEstimate, IoSettlement } from "./data";
import { CoReport } from "./print";
import type { CoDoc } from "./print";
import { Badge, Button, FIELD, Note, Progress, SURFACE } from "../ui";
import { ConfirmDialog, Field, FormModal, notify, printDocument, useData } from "../kit";

/** Every act the controller performs here, raised the same way from every section. */
export type Act =
  | { kind: "cc-new" }
  | { kind: "budget"; code: string }
  | { kind: "distribution" }
  | { kind: "cycle-run"; code: string }
  | { kind: "cycle-new" }
  | { kind: "io-new" }
  | { kind: "io-open"; no: string }
  | { kind: "io-cost"; no: string }
  | { kind: "io-budget"; no: string }
  | { kind: "io-settle"; no: string }
  | { kind: "io-close"; no: string }
  | { kind: "rate"; code: string }
  | { kind: "estimate-new"; material: string }
  | { kind: "estimate-mark"; no: string }
  | { kind: "estimate-release"; no: string }
  | { kind: "pc-new" }
  | { kind: "assign" }
  | { kind: "print"; d: CoDoc; title: string };

type Of<K extends Act["kind"]> = Extract<Act, { kind: K }>;

/* ---------------------------------------------------------------- pieces */

function Input({
  value, onChange, error, type = "text", placeholder, disabled,
}: { value: string; onChange: (v: string) => void; error?: string; type?: string; placeholder?: string; disabled?: boolean }) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className={FIELD + " w-full tabular-nums disabled:opacity-60 " + (error ? "border-rose-400 dark:border-rose-500" : "")}
    />
  );
}

function Choice({
  value, onChange, options, disabled,
}: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; disabled?: boolean }) {
  return (
    <span className="relative block">
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={FIELD + " w-full appearance-none pr-8 disabled:opacity-60"}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
    </span>
  );
}

function Actions({ onCancel, onSave, label }: { onCancel: () => void; onSave: () => void; label: string }) {
  return (
    <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
      <Button variant="secondary" onClick={onCancel}>
        ยกเลิก
      </Button>
      <Button variant="primary" onClick={onSave}>
        {label}
      </Button>
    </div>
  );
}

function Lines({ rows }: { rows: [ReactNode, ReactNode][] }) {
  return (
    <ul className={"divide-y divide-slate-100 dark:divide-slate-800 " + SURFACE}>
      {rows.map(([k, v], i) => (
        <li key={i} className="flex items-center justify-between gap-3 px-3.5 py-2 text-[12.5px]">
          <span className="min-w-0 truncate text-slate-600 dark:text-slate-300">{k}</span>
          <span className="shrink-0 font-medium tabular-nums text-slate-900 dark:text-slate-50">{v}</span>
        </li>
      ))}
    </ul>
  );
}

const num = (s: string) => (s.trim() === "" ? NaN : Number(s));
const pctOf = (n: number) => String(Math.round(n * 10000) / 100);
const ccOptions = () => COST_CENTERS.map((c) => ({ value: c.code, label: `${c.code} · ${c.name}` }));
const pcOptions = () => PROFIT_CENTERS.map((p) => ({ value: p.code, label: `${p.code} · ${p.name}` }));

/* ------------------------------------------------------------- the host */

export function CoActions({ act, onAct }: { act: Act | null; onAct: (a: Act | null) => void }) {
  useData();
  const close = () => onAct(null);
  const pick = <K extends Act["kind"]>(kind: K) => (act?.kind === kind ? (act as Of<K>) : null);

  const budget = pick("budget");
  const cycleRun = pick("cycle-run");
  const ioOpen = pick("io-open");
  const ioCost = pick("io-cost");
  const ioBudget = pick("io-budget");
  const ioSettle = pick("io-settle");
  const ioClose = pick("io-close");
  const rate = pick("rate");
  const estimateNew = pick("estimate-new");
  const mark = pick("estimate-mark");
  const release = pick("estimate-release");
  const print = pick("print");

  return (
    <>
      <FormModal open={act?.kind === "cc-new"} title="เพิ่มศูนย์ต้นทุน" subtitle="ศูนย์ใหม่รับค่าใช้จ่ายได้จากสัดส่วนกระจาย การปันส่วน หรือการชำระคำสั่งงาน" onClose={close} size="sm">
        {act?.kind === "cc-new" && <CostCenterForm onCancel={close} onDone={close} />}
      </FormModal>

      <FormModal open={budget !== null} title="ตั้งงบศูนย์ต้นทุน" subtitle={budget ? `${budget.code} · ${costCenter(budget.code).name} · ${PERIOD.label}` : undefined} onClose={close} size="sm">
        {budget && <BudgetForm key={budget.code} code={budget.code} onCancel={close} onDone={close} />}
      </FormModal>

      <FormModal open={act?.kind === "distribution"} title="สัดส่วนกระจายค่าใช้จ่าย" subtitle="แต่ละบัญชีค่าใช้จ่ายกระจายเข้าศูนย์ต้นทุนตามสัดส่วนนี้ ต้องรวมได้ 100%" onClose={close} size="lg">
        {act?.kind === "distribution" && <DistributionForm onCancel={close} onDone={close} />}
      </FormModal>

      <CycleRunDialog code={cycleRun?.code ?? null} onClose={close} onPrint={(no) => onAct({ kind: "print", d: { doc: "allocation", no }, title: "ใบบันทึกการปันส่วนต้นทุน" })} />

      <FormModal open={act?.kind === "cycle-new"} title="เพิ่มรอบปันส่วน" subtitle="ศูนย์ส่งปันยอดทั้งหมดที่มีตอนรัน ให้ศูนย์รับตามสัดส่วน" onClose={close}>
        {act?.kind === "cycle-new" && <CycleForm onCancel={close} onDone={close} />}
      </FormModal>

      <FormModal open={act?.kind === "io-new"} title="เปิดคำสั่งงานภายใน" subtitle="งานชั่วคราวที่เก็บค่าใช้จ่ายแยกจากงบประจำ แล้วชำระเข้าศูนย์ต้นทุนหรือสินทรัพย์เมื่อจบงาน" onClose={close} size="sm">
        {act?.kind === "io-new" && <IoForm onCancel={close} onDone={(no) => onAct({ kind: "io-open", no })} />}
      </FormModal>

      <FormModal open={ioOpen !== null} title="คำสั่งงานภายใน" subtitle={ioOpen ? `${ioOpen.no} · ${internalOrder(ioOpen.no).name}` : undefined} onClose={close} size="lg">
        {ioOpen && <IoRecord no={ioOpen.no} onAct={onAct} />}
      </FormModal>

      <FormModal open={ioCost !== null} title="บันทึกค่าใช้จ่ายเข้าคำสั่งงาน" subtitle={ioCost ? `${ioCost.no} · ${internalOrder(ioCost.no).name}` : undefined} onClose={close} size="sm">
        {ioCost && <IoCostForm key={ioCost.no} no={ioCost.no} onCancel={close} onDone={() => onAct({ kind: "io-open", no: ioCost.no })} />}
      </FormModal>

      <FormModal open={ioBudget !== null} title="อนุมัติงบเพิ่ม" subtitle={ioBudget ? `${ioBudget.no} · ${internalOrder(ioBudget.no).name}` : undefined} onClose={close} size="sm">
        {ioBudget && <IoBudgetForm key={ioBudget.no} no={ioBudget.no} onCancel={close} onDone={() => onAct({ kind: "io-open", no: ioBudget.no })} />}
      </FormModal>

      <SettleDialog no={ioSettle?.no ?? null} onClose={close} />
      <CloseIoDialog no={ioClose?.no ?? null} onClose={close} />

      <FormModal open={rate !== null} title="แก้อัตราค่าใช้จ่ายทางอ้อม" subtitle="มีผลกับต้นทุนผลิตภัณฑ์และกำไรขั้นต้นทันที" onClose={close} size="sm">
        {rate && <RateForm key={rate.code} code={rate.code} onCancel={close} onDone={close} />}
      </FormModal>

      <FormModal open={estimateNew !== null} title="คำนวณต้นทุนผลิตภัณฑ์" subtitle="ใส่ต้นทุนทางตรงต่อหน่วยชุดใหม่ ระบบบวกค่าใช้จ่ายทางอ้อมตามอัตราปัจจุบัน" onClose={close} size="sm">
        {estimateNew && <EstimateForm key={estimateNew.material} code={estimateNew.material} onCancel={close} onDone={close} />}
      </FormModal>

      <EstimateDialog estimate={COST_ESTIMATES.find((e) => e.no === (mark ?? release)?.no) ?? null} step={mark ? "mark" : "release"} onClose={close} />

      <FormModal open={act?.kind === "pc-new"} title="เพิ่มศูนย์กำไร" subtitle="กำหนดช่องทางขายและศูนย์ต้นทุนเข้าสังกัดได้หลังจากสร้าง" onClose={close} size="sm">
        {act?.kind === "pc-new" && <ProfitCenterForm onCancel={close} onDone={() => onAct({ kind: "assign" })} />}
      </FormModal>

      <FormModal open={act?.kind === "assign"} title="กำหนดสังกัดศูนย์กำไร" subtitle="ช่องทางขายนำรายได้เข้าศูนย์กำไรไหน และค่าใช้จ่ายของศูนย์ต้นทุนไปหักที่ศูนย์กำไรไหน" onClose={close}>
        {act?.kind === "assign" && <AssignForm onCancel={close} onDone={close} />}
      </FormModal>

      <FormModal open={print !== null} title={print?.title ?? ""} subtitle="ตัวอย่างก่อนพิมพ์ — พิมพ์เฉพาะตัวเอกสาร" onClose={close} size="lg">
        {print && (
          <>
            <div className="mb-3 flex justify-end">
              <Button variant="primary" icon={<Printer size={14} />} onClick={printDocument}>
                พิมพ์
              </Button>
            </div>
            <CoReport d={print.d} />
          </>
        )}
      </FormModal>
    </>
  );
}

/* ---------------------------------------------------------- cost centres */

function CostCenterForm({ onCancel, onDone }: { onCancel: () => void; onDone: () => void }) {
  const [code, setCode] = useState("CC-");
  const [name, setName] = useState("");
  const [owner, setOwner] = useState("");
  const [pc, setPc] = useState(PROFIT_CENTERS[0].code);
  const [budget, setBudgetText] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const save = () => {
    const e: Record<string, string> = {};
    if (!/^CC-[A-Z0-9]+$/.test(code)) e.code = "ขึ้นต้น CC- ตามด้วยตัวพิมพ์ใหญ่หรือตัวเลข";
    else if (COST_CENTERS.some((c) => c.code === code)) e.code = "รหัสนี้มีแล้ว";
    if (name.trim().length < 2) e.name = "ตั้งชื่อศูนย์ต้นทุน";
    if (owner.trim().length < 2) e.owner = "ระบุผู้รับผิดชอบ";
    if (!(num(budget) >= 0)) e.budget = "ใส่งบเป็นตัวเลข";
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    addCostCenter({ code, name, owner, profitCenter: pc, budget: num(budget) });
    notify(`เพิ่มศูนย์ต้นทุน ${code} ${name.trim()} แล้ว`);
    onDone();
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="รหัส" error={errors.code}>
          <Input value={code} onChange={(v) => setCode(v.toUpperCase())} error={errors.code} />
        </Field>
        <Field label="ศูนย์กำไรที่สังกัด">
          <Choice value={pc} onChange={setPc} options={pcOptions()} />
        </Field>
      </div>
      <Field label="ชื่อศูนย์ต้นทุน" error={errors.name}>
        <Input value={name} onChange={setName} error={errors.name} placeholder="เช่น ฝ่ายควบคุมคุณภาพ" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="ผู้รับผิดชอบ" error={errors.owner}>
          <Input value={owner} onChange={setOwner} error={errors.owner} />
        </Field>
        <Field label={`งบ${PERIOD.label} (บาท)`} error={errors.budget}>
          <Input value={budget} onChange={setBudgetText} error={errors.budget} type="number" />
        </Field>
      </div>
      <Actions onCancel={onCancel} onSave={save} label="เพิ่มศูนย์ต้นทุน" />
    </div>
  );
}

function BudgetForm({ code, onCancel, onDone }: { code: string; onCancel: () => void; onDone: () => void }) {
  const c = costCenter(code);
  const [amount, setAmount] = useState(String(c.budget));
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const save = () => {
    const e: Record<string, string> = {};
    if (!(num(amount) >= 0)) e.amount = "ใส่งบเป็นตัวเลข";
    else if (num(amount) === c.budget) e.amount = "งบเท่าเดิม";
    if (reason.trim().length < 3) e.reason = "ระบุเหตุผลที่ปรับงบ ผู้ตรวจสอบจะถามหา";
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    setBudget(code, num(amount), reason);
    notify(`ตั้งงบ ${code} เป็น ${baht(num(amount))} แล้ว`);
    onDone();
  };

  return (
    <div className="space-y-4">
      <Field label="งบทั้งงวด (บาท)" error={errors.amount} hint={`งบเดิม ${baht(c.budget)}`}>
        <Input value={amount} onChange={setAmount} error={errors.amount} type="number" />
      </Field>
      <Field label="เหตุผล" error={errors.reason}>
        <Input value={reason} onChange={setReason} error={errors.reason} placeholder="เช่น อนุมัติตามที่ประชุมทบทวนงบ ก.ย." />
      </Field>
      <Actions onCancel={onCancel} onSave={save} label="บันทึกงบ" />
    </div>
  );
}

function DistributionForm({ onCancel, onDone }: { onCancel: () => void; onDone: () => void }) {
  const accounts = expenseAccounts();
  const [shares, setShares] = useState<Record<string, Record<string, string>>>(() =>
    Object.fromEntries(
      accounts.map((a) => [a.code, Object.fromEntries(COST_CENTERS.map((c) => [c.code, ALLOCATION[a.code]?.[c.code] ? pctOf(ALLOCATION[a.code][c.code]) : ""]))])
    )
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const totalOf = (acct: string) => Object.values(shares[acct]).reduce((n, v) => n + (num(v) || 0), 0);

  const save = () => {
    const e: Record<string, string> = {};
    for (const a of accounts) {
      const t = totalOf(a.code);
      const touched = Object.values(shares[a.code]).some((v) => v.trim() !== "");
      if (touched && Math.abs(t - 100) > 0.01) e[a.code] = `รวม ${t}% ต้องได้ 100%`;
    }
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    let changed = 0;
    for (const a of accounts) {
      if (!Object.values(shares[a.code]).some((v) => v.trim() !== "")) continue;
      const next = Object.fromEntries(
        Object.entries(shares[a.code]).filter(([, v]) => (num(v) || 0) > 0).map(([cc, v]) => [cc, num(v) / 100])
      );
      const same = JSON.stringify(next) === JSON.stringify(ALLOCATION[a.code] ?? {});
      if (!same) {
        setDistribution(a.code, next);
        changed++;
      }
    }
    notify(changed ? `บันทึกสัดส่วนกระจายค่าใช้จ่าย ${changed} บัญชีแล้ว` : "สัดส่วนไม่เปลี่ยน");
    onDone();
  };

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-[12.5px]">
          <thead className="text-left text-[11px] text-slate-500 dark:text-slate-400">
            <tr>
              <th className="px-2 py-2 font-medium">บัญชี</th>
              {COST_CENTERS.map((c) => (
                <th key={c.code} className="px-2 py-2 text-right font-medium">
                  {c.name}
                </th>
              ))}
              <th className="px-2 py-2 text-right font-medium">รวม</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {accounts.map((a) => (
              <tr key={a.code}>
                <td className="px-2 py-2">
                  <span className="block text-slate-800 dark:text-slate-100">{a.name}</span>
                  <span className="block font-mono text-[11px] text-slate-400">{a.code}</span>
                  {errors[a.code] && <span className="block text-[11px] text-rose-600 dark:text-rose-400">{errors[a.code]}</span>}
                </td>
                {COST_CENTERS.map((c) => (
                  <td key={c.code} className="w-24 px-1 py-2">
                    <Input
                      value={shares[a.code][c.code]}
                      onChange={(v) => setShares({ ...shares, [a.code]: { ...shares[a.code], [c.code]: v } })}
                      type="number"
                      placeholder="0"
                    />
                  </td>
                ))}
                <td className="px-2 py-2 text-right">
                  <Badge tone={Math.abs(totalOf(a.code) - 100) <= 0.01 ? "ok" : totalOf(a.code) === 0 ? "idle" : "bad"}>{totalOf(a.code)}%</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Note tone="idle">
        ใส่เป็นเปอร์เซ็นต์ บัญชีที่เว้นว่างทั้งแถวคือยังไม่กระจาย ยอดของบัญชีนั้นจะแสดงเป็นรายการกระทบยอดในหน้าศูนย์กำไร
      </Note>
      <Actions onCancel={onCancel} onSave={save} label="บันทึกสัดส่วน" />
    </div>
  );
}

function CycleRunDialog({ code, onClose, onPrint }: { code: string | null; onClose: () => void; onPrint: (no: string) => void }) {
  const p = code ? previewCycle(code) : null;
  return (
    <ConfirmDialog
      open={code !== null}
      title="รันรอบปันส่วน"
      body={`ลงรายการปันส่วน ณ วันสิ้นงวด ${PERIOD.to} ศูนย์ส่งจะเหลือศูนย์ ยอดรวมทั้งบริษัทไม่เปลี่ยน`}
      subject={
        p && (
          <span className="block rounded-xl bg-slate-50 px-3.5 py-2.5 dark:bg-slate-800/60">
            <span className="block text-[13px] font-medium text-slate-900 dark:text-slate-50">{p.cycle.name}</span>
            <span className="block text-[11.5px] text-slate-500 dark:text-slate-400">
              ศูนย์ส่ง {costCenter(p.cycle.sender).name} · ยอดที่จะปันออก {baht(p.amount)}
            </span>
          </span>
        )
      }
      fields={
        p &&
        (p.amount > 0.005 ? (
          <Lines rows={p.lines.map((l) => [`${costCenter(l.costCenter).name} (${Math.round((p.cycle.receivers[l.costCenter] ?? 0) * 100)}%)`, baht(l.amount)])} />
        ) : (
          <Note tone="idle">ศูนย์ส่งไม่มียอดให้ปันส่วนแล้ว — รอบนี้รันไปแล้วในงวด</Note>
        ))
      }
      confirmLabel="ลงรายการปันส่วน"
      disabled={!p || p.amount <= 0.005}
      onCancel={onClose}
      onConfirm={() => {
        if (!code) return;
        const posting = runCycle(code);
        notify(`ลงรายการปันส่วน ${posting.no} แล้ว — ${baht(posting.amount)} จาก${costCenter(posting.sender).name}`);
        onPrint(posting.no);
      }}
    />
  );
}

function CycleForm({ onCancel, onDone }: { onCancel: () => void; onDone: () => void }) {
  const [name, setName] = useState("");
  const [sender, setSender] = useState(COST_CENTERS[0].code);
  const [shares, setShares] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const receivers = COST_CENTERS.filter((c) => c.code !== sender);
  const total = receivers.reduce((n, c) => n + (num(shares[c.code] ?? "") || 0), 0);

  const save = () => {
    const e: Record<string, string> = {};
    if (name.trim().length < 3) e.name = "ตั้งชื่อรอบปันส่วน";
    if (Math.abs(total - 100) > 0.01) e.shares = `สัดส่วนศูนย์รับรวม ${total}% ต้องได้ 100%`;
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    const c = addCycle({
      name,
      sender,
      receivers: Object.fromEntries(receivers.filter((r) => (num(shares[r.code] ?? "") || 0) > 0).map((r) => [r.code, num(shares[r.code]) / 100])),
    });
    notify(`เพิ่มรอบปันส่วน ${c.code} แล้ว`);
    onDone();
  };

  return (
    <div className="space-y-4">
      <Field label="ชื่อรอบปันส่วน" error={errors.name}>
        <Input value={name} onChange={setName} error={errors.name} placeholder="เช่น ปันส่วนค่าฝ่ายขายเข้าสายการค้า" />
      </Field>
      <Field label="ศูนย์ส่ง">
        <Choice value={sender} onChange={setSender} options={ccOptions()} />
      </Field>
      <div>
        <p className="mb-1.5 text-[12px] font-medium text-slate-600 dark:text-slate-300">สัดส่วนศูนย์รับ (%)</p>
        <div className="grid grid-cols-2 gap-2">
          {receivers.map((c) => (
            <label key={c.code} className="flex items-center gap-2 text-[12.5px] text-slate-700 dark:text-slate-200">
              <span className="min-w-0 flex-1 truncate">{c.name}</span>
              <span className="w-24">
                <Input value={shares[c.code] ?? ""} onChange={(v) => setShares({ ...shares, [c.code]: v })} type="number" placeholder="0" />
              </span>
            </label>
          ))}
        </div>
        <p className={"mt-1.5 text-[11.5px] " + (errors.shares ? "text-rose-600 dark:text-rose-400" : "text-slate-400")}>{errors.shares ?? `รวม ${total}%`}</p>
      </div>
      <Actions onCancel={onCancel} onSave={save} label="เพิ่มรอบปันส่วน" />
    </div>
  );
}

/* ------------------------------------------------------- internal orders */

function IoForm({ onCancel, onDone }: { onCancel: () => void; onDone: (no: string) => void }) {
  const [name, setName] = useState("");
  const [cc, setCc] = useState(COST_CENTERS[0].code);
  const [budget, setBudgetText] = useState("");
  const [opened, setOpened] = useState(TODAY);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const save = () => {
    const e: Record<string, string> = {};
    if (name.trim().length < 3) e.name = "ตั้งชื่องาน";
    if (!(num(budget) > 0)) e.budget = "งบต้องมากกว่าศูนย์";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(opened)) e.opened = "ใส่วันที่";
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    const o = createInternalOrder({ name, costCenter: cc, budget: num(budget), opened });
    notify(`เปิดคำสั่งงาน ${o.no} ${o.name} แล้ว`);
    onDone(o.no);
  };

  return (
    <div className="space-y-4">
      <Field label="ชื่องาน" error={errors.name}>
        <Input value={name} onChange={setName} error={errors.name} placeholder="เช่น ซ่อมหลังคาโรงงาน" />
      </Field>
      <Field label="ศูนย์ต้นทุนเจ้าของงาน">
        <Choice value={cc} onChange={setCc} options={ccOptions()} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="งบที่อนุมัติ (บาท)" error={errors.budget}>
          <Input value={budget} onChange={setBudgetText} error={errors.budget} type="number" />
        </Field>
        <Field label="วันเปิดงาน" error={errors.opened}>
          <Input value={opened} onChange={setOpened} error={errors.opened} type="date" />
        </Field>
      </div>
      <Actions onCancel={onCancel} onSave={save} label="เปิดคำสั่งงาน" />
    </div>
  );
}

function IoRecord({ no, onAct }: { no: string; onAct: (a: Act) => void }) {
  useData();
  const o = internalOrder(no);
  const balance = ioBalance(o);
  const open = o.status === "กำลังดำเนินการ";
  const rows = [
    ...costsOf(no).map((c) => ({ date: c.date, no: c.no, text: `${c.text}${c.vendor ? " · " + c.vendor : ""}`, amount: c.amount })),
    ...settlementsOf(no).map((s) => ({ date: s.date, no: s.no, text: `ชำระเข้า${s.receiverType} ${s.receiver}`, amount: -s.amount })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {open && <Button variant="primary" onClick={() => onAct({ kind: "io-cost", no })}>บันทึกค่าใช้จ่าย</Button>}
        {open && <Button variant="secondary" onClick={() => onAct({ kind: "io-budget", no })}>อนุมัติงบเพิ่ม</Button>}
        {balance > 0 && <Button variant="secondary" onClick={() => onAct({ kind: "io-settle", no })}>ชำระต้นทุน</Button>}
        {open && <Button variant="secondary" onClick={() => onAct({ kind: "io-close", no })}>ปิดงาน</Button>}
        <Button variant="ghost" icon={<Printer size={14} />} onClick={() => onAct({ kind: "print", d: { doc: "internal-order", no }, title: "รายงานคำสั่งงานภายใน" })}>
          พิมพ์
        </Button>
      </div>
      <Progress done={Math.min(o.spent, o.budget)} total={o.budget} label={`ใช้ไป ${baht(o.spent)} จากงบ ${baht(o.budget)}`} />
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "สถานะ", value: o.status },
          { label: "ศูนย์ต้นทุนเจ้าของงาน", value: costCenter(o.costCenter).name },
          { label: "ยอดค้างรอชำระ", value: baht(balance) },
        ].map((c) => (
          <div key={c.label} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
            <div className="text-[11.5px] text-slate-500 dark:text-slate-400">{c.label}</div>
            <div className="mt-1 text-[14px] font-semibold tabular-nums text-slate-900 dark:text-slate-50">{c.value}</div>
          </div>
        ))}
      </div>
      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
        {rows.map((r) => (
          <li key={r.no} className="flex items-center gap-3 py-2 text-[12.5px]">
            <span className="w-24 shrink-0 tabular-nums text-slate-400">{r.date}</span>
            <span className="w-28 shrink-0 font-mono text-[11.5px] text-slate-500 dark:text-slate-400">{r.no}</span>
            <span className="min-w-0 flex-1 truncate text-slate-800 dark:text-slate-100">{r.text}</span>
            <span className={"shrink-0 tabular-nums " + (r.amount < 0 ? "text-emerald-700 dark:text-emerald-400" : "text-slate-900 dark:text-slate-50")}>
              {baht(r.amount)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function IoCostForm({ no, onCancel, onDone }: { no: string; onCancel: () => void; onDone: () => void }) {
  const o = internalOrder(no);
  const [text, setText] = useState("");
  const [vendor, setVendor] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(TODAY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const room = o.budget - o.spent;

  if (o.status !== "กำลังดำเนินการ") return <Note tone="idle">{no} ปิดงานแล้ว บันทึกค่าใช้จ่ายไม่ได้</Note>;

  const save = () => {
    const e: Record<string, string> = {};
    if (text.trim().length < 3) e.text = "ระบุรายการ";
    if (!(num(amount) > 0)) e.amount = "จำนวนเงินต้องมากกว่าศูนย์";
    else if (num(amount) > room) e.amount = `เกินงบ ${baht(num(amount) - Math.max(0, room))} ต้องอนุมัติงบเพิ่มก่อน`;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) e.date = "ใส่วันที่";
    else if (date > TODAY) e.date = "บันทึกล่วงหน้าไม่ได้";
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    const c = postIoCost(no, { date, text, vendor, amount: num(amount) });
    notify(`บันทึก ${c.no} เข้า ${no} แล้ว ${baht(c.amount)}`);
    onDone();
  };

  return (
    <div className="space-y-4">
      {room <= 0 && <Note tone="bad">ใช้เต็มงบแล้ว ต้องอนุมัติงบเพิ่มก่อนบันทึกค่าใช้จ่ายใหม่</Note>}
      <Field label="รายการ" error={errors.text}>
        <Input value={text} onChange={setText} error={errors.text} placeholder="เช่น ค่าขนส่งอุปกรณ์" />
      </Field>
      <Field label="ผู้ขาย / ผู้รับเงิน">
        <Input value={vendor} onChange={setVendor} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="จำนวนเงิน (บาท)" error={errors.amount} hint={`งบคงเหลือ ${baht(Math.max(0, room))}`}>
          <Input value={amount} onChange={setAmount} error={errors.amount} type="number" />
        </Field>
        <Field label="วันที่" error={errors.date}>
          <Input value={date} onChange={setDate} error={errors.date} type="date" />
        </Field>
      </div>
      <Actions onCancel={onCancel} onSave={save} label="บันทึกค่าใช้จ่าย" />
    </div>
  );
}

function IoBudgetForm({ no, onCancel, onDone }: { no: string; onCancel: () => void; onDone: () => void }) {
  const o = internalOrder(no);
  const [amount, setAmount] = useState(String(Math.max(o.budget, o.spent)));
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const save = () => {
    const e: Record<string, string> = {};
    if (!(num(amount) > o.budget)) e.amount = `ต้องมากกว่างบเดิม ${baht(o.budget)}`;
    if (reason.trim().length < 3) e.reason = "ระบุเหตุผลและผู้อนุมัติ";
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    raiseIoBudget(no, num(amount), reason);
    notify(`อนุมัติงบ ${no} เพิ่มเป็น ${baht(num(amount))} แล้ว`);
    onDone();
  };

  return (
    <div className="space-y-4">
      <Field label="งบใหม่ทั้งงาน (บาท)" error={errors.amount} hint={`งบเดิม ${baht(o.budget)} · ใช้ไป ${baht(o.spent)}`}>
        <Input value={amount} onChange={setAmount} error={errors.amount} type="number" />
      </Field>
      <Field label="เหตุผลและผู้อนุมัติ" error={errors.reason}>
        <Input value={reason} onChange={setReason} error={errors.reason} placeholder="เช่น อนุมัติโดยกรรมการผู้จัดการ ตามบันทึกลงวันที่ ..." />
      </Field>
      <Actions onCancel={onCancel} onSave={save} label="อนุมัติงบเพิ่ม" />
    </div>
  );
}

function SettleDialog({ no, onClose }: { no: string | null; onClose: () => void }) {
  const o = no ? internalOrder(no) : null;
  const [type, setType] = useState<IoSettlement["receiverType"]>("ศูนย์ต้นทุน");
  const [receiver, setReceiver] = useState("");
  const options = type === "ศูนย์ต้นทุน" ? ccOptions() : ASSETS.map((a) => ({ value: a.code, label: `${a.code} · ${a.name}` }));
  const chosen = options.some((x) => x.value === receiver) ? receiver : type === "ศูนย์ต้นทุน" && o ? o.costCenter : (options[0]?.value ?? "");
  const balance = o ? ioBalance(o) : 0;
  const reset = () => {
    setType("ศูนย์ต้นทุน");
    setReceiver("");
  };
  return (
    <ConfirmDialog
      open={o !== null}
      title="ชำระต้นทุนคำสั่งงาน"
      body={`ย้ายยอดค้างทั้งหมด ${baht(balance)} ไปที่ผู้รับ ณ วันสิ้นงวด ${PERIOD.to} คำสั่งงานจะเหลือศูนย์ รายการนี้กลับไม่ได้`}
      subject={
        o && (
          <span className="block rounded-xl bg-slate-50 px-3.5 py-2.5 dark:bg-slate-800/60">
            <span className="block text-[13px] font-medium text-slate-900 dark:text-slate-50">
              {o.no} · {o.name}
            </span>
            <span className="block text-[11.5px] text-slate-500 dark:text-slate-400">
              ใช้ไป {baht(o.spent)} · ชำระแล้ว {baht(o.spent - balance)}
            </span>
          </span>
        )
      }
      fields={
        o && (
          <div className="space-y-3">
            <Field label="ชำระเข้า">
              <Choice
                value={type}
                onChange={(v) => {
                  setType(v as IoSettlement["receiverType"]);
                  setReceiver("");
                }}
                options={[
                  { value: "ศูนย์ต้นทุน", label: "ศูนย์ต้นทุน — เป็นค่าใช้จ่ายของงวด" },
                  { value: "สินทรัพย์", label: "สินทรัพย์ — บันทึกเพิ่มมูลค่าสินทรัพย์" },
                ]}
              />
            </Field>
            <Field label={type === "ศูนย์ต้นทุน" ? "ศูนย์ต้นทุนที่รับ" : "สินทรัพย์ที่รับ"}>
              <Choice value={chosen} onChange={setReceiver} options={options} />
            </Field>
            {type === "สินทรัพย์" && (
              <Note tone="idle">ฝั่งบัญชีการเงินต้องบันทึกเพิ่มราคาทุนของสินทรัพย์นี้ด้วยใบสำคัญ บัญชีบริหารเก็บเฉพาะรายการชำระ</Note>
            )}
          </div>
        )
      }
      confirmLabel="ชำระต้นทุน"
      disabled={balance <= 0}
      onCancel={() => {
        reset();
        onClose();
      }}
      onConfirm={() => {
        if (!o) return;
        const s = settleInternalOrder(o.no, { receiverType: type, receiver: chosen });
        notify(`ชำระ ${o.no} ${baht(s.amount)} เข้า${s.receiverType} ${s.receiver} แล้ว · ${s.no}`);
        reset();
        onClose();
      }}
    />
  );
}

function CloseIoDialog({ no, onClose }: { no: string | null; onClose: () => void }) {
  const o = no ? internalOrder(no) : null;
  const balance = o ? ioBalance(o) : 0;
  return (
    <ConfirmDialog
      open={o !== null}
      title="ปิดคำสั่งงานภายใน"
      body="ปิดแล้วบันทึกค่าใช้จ่ายหรือชำระต้นทุนเพิ่มไม่ได้ ใช้เมื่องานจบและยอดค้างเป็นศูนย์"
      subject={o && <span className="block rounded-xl bg-slate-50 px-3.5 py-2.5 text-[13px] text-slate-900 dark:bg-slate-800/60 dark:text-slate-50">{o.no} · {o.name}</span>}
      fields={balance !== 0 ? <Note tone="bad">ยังมียอดค้าง {baht(balance)} ชำระต้นทุนก่อนปิดงาน</Note> : undefined}
      confirmLabel="ปิดงาน"
      disabled={!o || balance !== 0}
      onCancel={onClose}
      onConfirm={() => {
        if (!o) return;
        closeInternalOrder(o.no);
        notify(`ปิดคำสั่งงาน ${o.no} แล้ว`);
        onClose();
      }}
    />
  );
}

/* ------------------------------------------------------- product costs */

function RateForm({ code, onCancel, onDone }: { code: string; onCancel: () => void; onDone: () => void }) {
  const o = OVERHEAD.find((x) => x.code === code)!;
  const [rate, setRate] = useState(pctOf(o.rate));
  const [error, setError] = useState<string>();

  const save = () => {
    const n = num(rate);
    if (!(n >= 0 && n < 100)) {
      setError("ใส่ 0 ถึงน้อยกว่า 100");
      return;
    }
    setOverheadRate(code, n / 100);
    notify(`ปรับอัตรา${o.name}เป็น ${n}% แล้ว`);
    onDone();
  };

  return (
    <div className="space-y-4">
      <Field label={`${o.name} (% ของ${o.base})`} error={error} hint={`อัตราเดิม ${pctOf(o.rate)}%`}>
        <Input value={rate} onChange={setRate} error={error} type="number" />
      </Field>
      <Note tone="idle">ต้นทุนมาตรฐานที่ปล่อยใช้ไปแล้วเก็บอัตราของตัวเองไว้ ไม่เปลี่ยนตาม</Note>
      <Actions onCancel={onCancel} onSave={save} label="บันทึกอัตรา" />
    </div>
  );
}

function EstimateForm({ code, onCancel, onDone }: { code: string; onCancel: () => void; onDone: () => void }) {
  const base = currentEstimate(code);
  const m = material(code);
  const [product, setProduct] = useState(code);
  const [mat, setMat] = useState(String(base?.materialCost ?? m.price));
  const [lab, setLab] = useState(String(base?.labourCost ?? 0));
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const direct = (num(mat) || 0) + (num(lab) || 0);
  const overhead = OVERHEAD.reduce((n, o) => n + Math.round(direct * o.rate), 0);

  const save = () => {
    const e: Record<string, string> = {};
    if (!(num(mat) > 0)) e.mat = "ค่าวัตถุดิบต้องมากกว่าศูนย์";
    if (!(num(lab) >= 0)) e.lab = "ค่าแรงต้องไม่ติดลบ";
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    const est = runEstimate(product, { materialCost: num(mat), labourCost: num(lab), note });
    notify(`คำนวณต้นทุน ${est.no} แล้ว — กำหนดใช้แล้วปล่อยใช้เพื่อให้มีผลงวดถัดไป`);
    onDone();
  };

  return (
    <div className="space-y-4">
      <Field label="สินค้า">
        <Choice
          value={product}
          onChange={(v) => {
            setProduct(v);
            const b = currentEstimate(v);
            setMat(String(b?.materialCost ?? material(v).price));
            setLab(String(b?.labourCost ?? 0));
          }}
          options={FINISHED_GOODS.map((g) => ({ value: g.code, label: `${g.code} · ${g.name}` }))}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="วัตถุดิบต่อหน่วย (บาท)" error={errors.mat}>
          <Input value={mat} onChange={setMat} error={errors.mat} type="number" />
        </Field>
        <Field label="ค่าแรงและเครื่องจักรต่อหน่วย" error={errors.lab}>
          <Input value={lab} onChange={setLab} error={errors.lab} type="number" />
        </Field>
      </div>
      <Field label="หมายเหตุ">
        <Input value={note} onChange={setNote} placeholder="เช่น ราคาเหล็กเส้นขึ้น 5%" />
      </Field>
      <Lines
        rows={[
          ["ต้นทุนทางตรง", baht(direct)],
          ...OVERHEAD.map((o): [ReactNode, ReactNode] => [`${o.name} ${pctOf(o.rate)}%`, baht(Math.round(direct * o.rate))]),
          ["ต้นทุนรวมต่อหน่วย", baht(direct + overhead)],
          ["มาตรฐานในแฟ้มวัสดุตอนนี้", baht(material(product).price)],
        ]}
      />
      <Actions onCancel={onCancel} onSave={save} label="คำนวณต้นทุน" />
    </div>
  );
}

function EstimateDialog({ estimate: e, step, onClose }: { estimate: CostEstimate | null; step: "mark" | "release"; onClose: () => void }) {
  const t = e ? estimateTotals(e) : null;
  const m = e ? material(e.material) : null;
  const replaced = e ? nextEstimate(e.material) : undefined;
  const ok = e !== null && (step === "mark" ? e.status === "คำนวณแล้ว" : e.status === "กำหนดใช้แล้ว");
  return (
    <ConfirmDialog
      open={e !== null}
      title={step === "mark" ? "กำหนดใช้ต้นทุน" : "ปล่อยใช้ต้นทุนมาตรฐาน"}
      body={
        step === "mark"
          ? `กำหนดให้แผ่นนี้เป็นต้นทุนมาตรฐานของงวดถัดไป (${NEXT_PERIOD}) ใบที่กำหนดไว้ก่อนหน้าของสินค้าเดียวกันจะกลับเป็นคำนวณแล้ว`
          : `ปล่อยใช้แล้วมีผลตั้งแต่ ${NEXT_PERIOD} ย้อนกลับไม่ได้ ถ้าต้องเปลี่ยนให้คำนวณและปล่อยใบใหม่แทนที่`
      }
      subject={
        e &&
        t &&
        m && (
          <span className="block rounded-xl bg-slate-50 px-3.5 py-2.5 dark:bg-slate-800/60">
            <span className="block text-[13px] font-medium text-slate-900 dark:text-slate-50">
              {e.no} · {m.name}
            </span>
            <span className="block text-[11.5px] text-slate-500 dark:text-slate-400">
              ทางตรง {baht(t.direct)} · รวม {baht(t.total)} · มาตรฐานปัจจุบัน {baht(m.price)} ({t.direct >= m.price ? "+" : ""}
              {(((t.direct - m.price) / m.price) * 100).toFixed(1)}%)
            </span>
          </span>
        )
      }
      fields={
        step === "release" && replaced ? <Note tone="warn">จะแทนที่ {replaced.no} ที่ปล่อยไว้สำหรับงวดเดียวกัน</Note> : !ok && e ? <Note tone="idle">สถานะ{e.status} ทำขั้นนี้ไม่ได้</Note> : undefined
      }
      confirmLabel={step === "mark" ? "กำหนดใช้" : "ปล่อยใช้"}
      confirmWord={step === "release" ? "ปล่อยใช้" : undefined}
      disabled={!ok}
      onCancel={onClose}
      onConfirm={() => {
        if (!e) return;
        if (step === "mark") {
          markEstimate(e.no);
          notify(`กำหนดใช้ ${e.no} แล้ว`);
        } else {
          releaseEstimate(e.no);
          notify(`ปล่อยใช้ ${e.no} เป็นต้นทุนมาตรฐานตั้งแต่ ${NEXT_PERIOD} แล้ว`);
        }
        onClose();
      }}
    />
  );
}

/* -------------------------------------------------------- profit centres */

function ProfitCenterForm({ onCancel, onDone }: { onCancel: () => void; onDone: () => void }) {
  const [code, setCode] = useState("PC-");
  const [name, setName] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const save = () => {
    const e: Record<string, string> = {};
    if (!/^PC-[A-Z0-9]+$/.test(code)) e.code = "ขึ้นต้น PC- ตามด้วยตัวพิมพ์ใหญ่หรือตัวเลข";
    else if (PROFIT_CENTERS.some((p) => p.code === code)) e.code = "รหัสนี้มีแล้ว";
    if (name.trim().length < 2) e.name = "ตั้งชื่อศูนย์กำไร";
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    addProfitCenter({ code, name });
    notify(`เพิ่มศูนย์กำไร ${code} ${name.trim()} แล้ว — กำหนดช่องทางและศูนย์ต้นทุนเข้าสังกัดต่อ`);
    onDone();
  };

  return (
    <div className="space-y-4">
      <Field label="รหัส" error={errors.code}>
        <Input value={code} onChange={(v) => setCode(v.toUpperCase())} error={errors.code} />
      </Field>
      <Field label="ชื่อศูนย์กำไร" error={errors.name}>
        <Input value={name} onChange={setName} error={errors.name} placeholder="เช่น สายส่งออก" />
      </Field>
      <Actions onCancel={onCancel} onSave={save} label="เพิ่มศูนย์กำไร" />
    </div>
  );
}

function AssignForm({ onCancel, onDone }: { onCancel: () => void; onDone: () => void }) {
  const [channels, setChannels] = useState<Record<string, string>>({ ...CHANNEL_PROFIT_CENTER });
  const [centres, setCentres] = useState<Record<string, string>>(Object.fromEntries(COST_CENTERS.map((c) => [c.code, c.profitCenter])));

  const save = () => {
    let changed = 0;
    for (const [ch, pc] of Object.entries(channels)) {
      if (CHANNEL_PROFIT_CENTER[ch] !== pc) {
        assignChannel(ch, pc);
        changed++;
      }
    }
    for (const [cc, pc] of Object.entries(centres)) {
      if (costCenter(cc).profitCenter !== pc) {
        assignCostCenter(cc, pc);
        changed++;
      }
    }
    notify(changed ? `ปรับสังกัดศูนย์กำไร ${changed} รายการแล้ว` : "สังกัดไม่เปลี่ยน");
    onDone();
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">ช่องทางขาย → รายได้เข้า</p>
        <div className="space-y-2">
          {Object.keys(channels).map((ch) => (
            <label key={ch} className="grid grid-cols-[10rem_1fr] items-center gap-3 text-[13px] text-slate-700 dark:text-slate-200">
              {ch}
              <Choice value={channels[ch]} onChange={(v) => setChannels({ ...channels, [ch]: v })} options={pcOptions()} />
            </label>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">ศูนย์ต้นทุน → ค่าใช้จ่ายไปหักที่</p>
        <div className="space-y-2">
          {COST_CENTERS.map((c) => (
            <label key={c.code} className="grid grid-cols-[10rem_1fr] items-center gap-3 text-[13px] text-slate-700 dark:text-slate-200">
              {c.name}
              <Choice value={centres[c.code]} onChange={(v) => setCentres({ ...centres, [c.code]: v })} options={pcOptions()} />
            </label>
          ))}
        </div>
      </div>
      <Note tone="idle">ย้ายสังกัดเปลี่ยนผลของแต่ละศูนย์กำไร แต่ผลรวมทุกศูนย์ยังเท่ากับงบการเงินเสมอ</Note>
      <Actions onCancel={onCancel} onSave={save} label="บันทึกสังกัด" />
    </div>
  );
}

