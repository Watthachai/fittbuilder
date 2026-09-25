import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { MATERIALS, TODAY, material } from "../mm/data";
import { Choice, Footer, PrintFrame, Text, inputCls, num } from "../mm/forms";
import {
  BINS, COUNTERS, COUNT_APPROVERS, PICKS, STORABLE, STORAGE_TYPES, UNIT_WEIGHTS, addBin, allocate,
  approveCount, available, bin, binLoad, binProblems, binsUnderCount, canHold, confirmPick, confirmPutaway,
  countApprovalProblem, countEntryProblems, countSheetProblems, createCountSheet, createPickList, enterCounts, kgAfter, pickListProblems,
  pickProblem, postCountAdjustment, postGoodsIssue, putawayCandidates, putawayProblem, reservedIn, stockInWarehouse,
  storageType, transferProblems, transferStock, updateBin, variance, varianceValue, baht,
} from "./data";
import type { Bin, Count, CountSheet, PickTask, PutawayTask } from "./data";
import { CountSheetDocument, PickListDocument } from "./documents";
import { Button, FIELD, Note, SURFACE } from "../ui";
import { ConfirmDialog, Field, FormModal, notify, useData } from "../kit";

/**
 * Every create and every move the warehouse screens offer. As in purchasing,
 * the forms ask data.ts the same `…Problem(s)` the mutation checks, so a form
 * can never save what the rule would refuse.
 */

export type WmDialog =
  | { kind: "bin"; bin?: Bin }
  | { kind: "putaway"; task: PutawayTask }
  | { kind: "pickList" }
  | { kind: "pick"; task: PickTask }
  | { kind: "issue"; ref: string }
  | { kind: "transfer"; from?: string; to?: string }
  | { kind: "countSheet"; bins?: string[] }
  | { kind: "countEntry"; sheet: CountSheet }
  | { kind: "approveCount"; count: Count }
  | { kind: "postCount"; count: Count }
  | { kind: "print"; doc: { type: "pick"; ref: string } | { type: "count"; sheet: CountSheet } };

/** Questions about a record, asked over it rather than instead of it. */
export const WM_CONFIRMS: WmDialog["kind"][] = ["issue", "approveCount", "postCount"];

const binLabel = (b: Bin) => `${b.code} · ${storageType(b.type).name} · ${b.material ? material(b.material).name : "ว่าง"}`;

export function WmDialogs({
  dialog,
  onClose,
  onSaved,
}: {
  dialog: WmDialog | null;
  onClose: () => void;
  onSaved: (saved: { pickRef?: string; sheet?: CountSheet }) => void;
}) {
  useData();
  const d = dialog;

  return (
    <>
      <FormModal
        open={d?.kind === "bin"}
        title={d?.kind === "bin" && d.bin ? "แก้ไขช่องเก็บ" : "เพิ่มช่องเก็บ"}
        subtitle={d?.kind === "bin" && d.bin ? d.bin.code : "ช่องใหม่เริ่มว่าง ระบบจะเสนอให้จัดเก็บเมื่อมีของเข้า"}
        onClose={onClose}
        size="sm"
      >
        {d?.kind === "bin" && <BinForm b={d.bin} onCancel={onClose} onDone={() => onSaved({})} />}
      </FormModal>

      <FormModal
        open={d?.kind === "putaway"}
        title="ยืนยันการจัดเก็บ"
        subtitle={d?.kind === "putaway" ? `${d.task.no} · ${material(d.task.material).name} × ${d.task.qty}` : undefined}
        onClose={onClose}
      >
        {d?.kind === "putaway" && <PutawayForm task={d.task} onCancel={onClose} onDone={() => onSaved({})} />}
      </FormModal>

      <FormModal open={d?.kind === "pickList"} title="สร้างใบหยิบสินค้า" subtitle="ระบบแบ่งงานหยิบลงช่องให้เอง ล็อตเก่าออกก่อน และไม่แตะของที่จองให้งานอื่นไว้" onClose={onClose} size="lg">
        {d?.kind === "pickList" && <PickListForm onCancel={onClose} onDone={(ref) => onSaved({ pickRef: ref })} />}
      </FormModal>

      <FormModal
        open={d?.kind === "pick"}
        title="ยืนยันการหยิบ"
        subtitle={d?.kind === "pick" ? `${d.task.no} · ${d.task.ref}` : undefined}
        onClose={onClose}
        size="sm"
      >
        {d?.kind === "pick" && <PickForm task={d.task} onCancel={onClose} onDone={() => onSaved({})} />}
      </FormModal>

      <FormModal open={d?.kind === "transfer"} title="ย้ายสินค้าภายในคลัง" subtitle="ยอดรวมในคลังไม่เปลี่ยน ของที่จองให้งานหยิบไว้ย้ายไม่ได้" onClose={onClose}>
        {d?.kind === "transfer" && <TransferForm initialFrom={d.from} initialTo={d.to} onCancel={onClose} onDone={() => onSaved({})} />}
      </FormModal>

      <FormModal open={d?.kind === "countSheet"} title="สร้างใบตรวจนับ" subtitle="เลือกช่องที่จะนับ ใบนับไม่แสดงยอดในระบบ ผู้นับต้องนับจริง" onClose={onClose}>
        {d?.kind === "countSheet" && <CountSheetForm initialBins={d.bins} onCancel={onClose} onDone={(sheet) => onSaved({ sheet })} />}
      </FormModal>

      <FormModal
        open={d?.kind === "countEntry"}
        title="บันทึกผลตรวจนับ"
        subtitle={d?.kind === "countEntry" ? `${d.sheet.no} · ${d.sheet.scope} · ผู้นับ ${d.sheet.counter}` : undefined}
        onClose={onClose}
        size="lg"
      >
        {d?.kind === "countEntry" && <CountEntryForm sheet={d.sheet} onCancel={onClose} onDone={() => onSaved({})} />}
      </FormModal>

      <FormModal
        open={d?.kind === "print"}
        title={d?.kind === "print" ? (d.doc.type === "pick" ? "พิมพ์ใบหยิบสินค้า" : "พิมพ์ใบตรวจนับ") : ""}
        subtitle="ตัวอย่างก่อนพิมพ์ ขนาด A4"
        onClose={onClose}
        size="lg"
      >
        {d?.kind === "print" && (
          <PrintFrame>
            {d.doc.type === "pick" ? <PickListDocument docRef={d.doc.ref} /> : <CountSheetDocument sheet={d.doc.sheet} />}
          </PrintFrame>
        )}
      </FormModal>

      <IssueDialog dialog={d?.kind === "issue" ? d : null} onClose={onClose} />
      <ApproveCountDialog dialog={d?.kind === "approveCount" ? d : null} onClose={onClose} />
      <PostCountDialog dialog={d?.kind === "postCount" ? d : null} onClose={onClose} />
    </>
  );
}

/* ------------------------------------------------------------------ bins */

function BinForm({ b, onDone, onCancel }: { b?: Bin; onDone: () => void; onCancel: () => void }) {
  const [code, setCode] = useState(b?.code ?? "");
  const [type, setType] = useState(b?.type ?? "BLK");
  const [maxKg, setMaxKg] = useState(b ? String(b.maxKg) : "2000");
  const [tried, setTried] = useState(false);

  const input = { code, type, maxKg: num(maxKg) };
  const problems = binProblems(input, b);
  const e = tried ? problems : {};

  const save = () => {
    setTried(true);
    if (Object.keys(problems).length > 0) return;
    if (b) {
      updateBin(b.code, { type, maxKg: input.maxKg });
      notify(`บันทึกการแก้ไขช่อง ${b.code} แล้ว`);
    } else {
      const created = addBin(input);
      notify(`เพิ่มช่องเก็บ ${created.code} ใน${storageType(created.type).name}แล้ว`);
    }
    onDone();
  };

  return (
    <div className="space-y-4">
      <Field label="พื้นที่จัดเก็บ" error={e.type}>
        <Choice value={type} onChange={setType} options={STORAGE_TYPES.map((t) => ({ value: t.code, label: `${t.code} · ${t.name}` }))} />
      </Field>
      <Text label="รหัสช่อง" value={code} onChange={(v) => setCode(v.toUpperCase())} error={e.code} disabled={b !== undefined} placeholder={STORABLE.includes(type) ? "A-02-03" : "REC-03"} />
      <Text label="เพดานน้ำหนัก (กก.)" type="number" value={maxKg} onChange={setMaxKg} error={e.maxKg} hint={b ? `ตอนนี้รับอยู่ ${Math.round(binLoad(b).kg)} กก.` : "ตามป้ายรับน้ำหนักของชั้นวาง"} />
      <Footer onCancel={onCancel}>
        <Button variant="primary" onClick={save}>
          {b ? "บันทึกการแก้ไข" : "เพิ่มช่องเก็บ"}
        </Button>
      </Footer>
    </div>
  );
}

/* --------------------------------------------------------------- putaway */

function PutawayForm({ task, onDone, onCancel }: { task: PutawayTask; onDone: () => void; onCancel: () => void }) {
  const known = UNIT_WEIGHTS[task.material];
  const [kg, setKg] = useState(known === undefined ? "" : String(known));
  const w = known ?? num(kg);
  const candidates = putawayCandidates(task.material, task.qty, w > 0 ? w : 0);
  // The suggestion was made when the task was issued; if the bin has filled up
  // since, start from the best bin now rather than one that will be refused.
  const [binCode, setBinCode] = useState(
    putawayProblem(task, task.suggestBin, known) === undefined ? task.suggestBin : (candidates[0]?.bin.code ?? task.suggestBin)
  );
  const [tried, setTried] = useState(false);
  const problem = putawayProblem(task, binCode, known === undefined ? num(kg) : undefined);
  const target = BINS.find((b) => b.code === binCode);
  const m = material(task.material);

  const save = () => {
    setTried(true);
    if (problem) return;
    confirmPutaway(task.no, binCode, known === undefined ? num(kg) : undefined);
    notify(`จัดเก็บ ${m.name} ${task.qty} ${m.unit} เข้าช่อง ${binCode} แล้ว · ${task.no}`);
    onDone();
  };

  return (
    <div className="space-y-4">
      <div className={"p-3 " + SURFACE}>
        <p className="text-[13px] font-medium text-slate-900 dark:text-slate-50">
          {m.name} × {task.qty} {m.unit}
        </p>
        <p className="mt-0.5 text-[11.5px] text-slate-500 dark:text-slate-400">
          จากท่ารับ {task.from}
          {task.gr ? ` · ใบรับสินค้า ${task.gr}` : ""} · ระบบเสนอช่อง {task.suggestBin}
        </p>
      </div>
      {known === undefined && (
        <Text
          label={`น้ำหนักต่อ${m.unit} (กก.)`}
          type="number"
          value={kg}
          onChange={setKg}
          error={tried && !(num(kg) > 0) ? "ใส่น้ำหนักต่อหน่วย วัสดุนี้เข้าคลังเป็นครั้งแรก" : undefined}
          hint="วัสดุนี้ยังไม่เคยเข้าคลัง ระบบจะจำน้ำหนักนี้ไว้ใช้คิดเพดานช่อง"
        />
      )}
      <Field label="ช่องที่จัดเก็บ" error={tried ? problem : undefined}>
        <Choice
          value={binCode}
          onChange={setBinCode}
          options={candidates.map((c) => ({
            value: c.bin.code,
            label: `${binLabel(c.bin)} · หลังเก็บ ${Math.round(c.kg).toLocaleString("th-TH")}/${c.bin.maxKg.toLocaleString("th-TH")} กก.${c.fits ? "" : " · เกินเพดาน"}`,
          }))}
        />
      </Field>
      {target && w > 0 && (
        <Note tone={problem ? "bad" : "ok"}>
          {problem ?? `หลังจัดเก็บช่อง ${target.code} รับน้ำหนัก ${Math.round(kgAfter(target, task.qty, w)).toLocaleString("th-TH")} จาก ${target.maxKg.toLocaleString("th-TH")} กก.`}
        </Note>
      )}
      <Footer onCancel={onCancel}>
        <Button variant="primary" onClick={save}>
          จัดเก็บเข้าช่อง
        </Button>
      </Footer>
    </div>
  );
}

/* --------------------------------------------------------------- picking */

type Line = { key: number; material: string; qty: string };
let lineSeq = 0;
const newPickLine = (): Line => ({ key: ++lineSeq, material: "", qty: "" });

function PickListForm({ onDone, onCancel }: { onDone: (ref: string) => void; onCancel: () => void }) {
  const [ref, setRef] = useState("");
  const [lines, setLines] = useState<Line[]>(() => [newPickLine()]);
  const [tried, setTried] = useState(false);

  const stocked = MATERIALS.filter((m) => stockInWarehouse(m.code) > 0);
  const input = { ref, lines: lines.map((l) => ({ material: l.material, qty: num(l.qty) })) };
  const problems = pickListProblems(input);
  const e = tried ? problems : {};
  const update = (key: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const save = () => {
    setTried(true);
    if (Object.keys(problems).length > 0) return;
    const tasks = createPickList(input);
    notify(`สร้างใบหยิบของ ${ref.trim()} แล้ว · ${tasks.length} งานหยิบ`);
    onDone(ref.trim());
  };

  return (
    <div className="space-y-4">
      <Text
        label="เอกสารต้นเรื่อง"
        value={ref}
        onChange={setRef}
        error={e.ref}
        placeholder="DO-2569-0304 หรือ PO-P-3302"
        hint="เลขที่ใบส่งของของฝ่ายขาย หรือใบสั่งผลิตที่ต้องเบิกวัตถุดิบ"
      />
      <div className={"overflow-hidden " + SURFACE}>
        <table className="w-full text-[13px]">
          <thead className="bg-slate-50/80 text-left text-[11.5px] text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
            <tr>
              <th className="px-3 py-2.5 font-medium">รายการ</th>
              <th className="w-28 px-3 py-2.5 text-right font-medium">จำนวน</th>
              <th className="px-3 py-2.5 font-medium">หยิบจากช่อง (ล็อตเก่าก่อน)</th>
              <th className="w-10 px-2 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {lines.map((l, i) => {
              const qty = num(l.qty);
              const plan = l.material && qty > 0 ? allocate(l.material, qty) : null;
              const err = l.material ? e["line:" + l.material] : undefined;
              return (
                <tr key={l.key}>
                  <td className="px-3 py-2">
                    <Choice
                      value={l.material}
                      onChange={(v) => update(l.key, { material: v })}
                      options={[
                        { value: "", label: "เลือกรายการ…" },
                        ...stocked.map((m) => ({ value: m.code, label: `${m.code} · ${m.name} · มี ${stockInWarehouse(m.code)} ${m.unit}` })),
                      ]}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={1}
                      value={l.qty}
                      onChange={(ev) => update(l.key, { qty: ev.target.value })}
                      aria-label={`จำนวนรายการที่ ${i + 1}`}
                      className={inputCls(err) + " py-2 text-right tabular-nums"}
                    />
                  </td>
                  <td className="px-3 py-2 text-[12px]">
                    {err ? (
                      <span className="text-rose-600 dark:text-rose-400">{err}</span>
                    ) : plan ? (
                      <span className="font-mono text-slate-600 dark:text-slate-300">
                        {plan.picks.map((p) => `${p.bin} × ${p.qty}`).join(" · ")}
                        {plan.short > 0 && <span className="text-rose-600 dark:text-rose-400"> · ขาด {plan.short}</span>}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    <button
                      type="button"
                      onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
                      disabled={lines.length === 1}
                      aria-label={`ลบรายการที่ ${i + 1}`}
                      className="grid size-8 place-items-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30 dark:hover:bg-rose-500/10"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="border-t border-slate-100 px-3 py-2.5 dark:border-slate-800">
          <Button variant="ghost" icon={<Plus size={14} />} onClick={() => setLines((ls) => [...ls, newPickLine()])}>
            เพิ่มรายการ
          </Button>
          {e.lines && <p className="mt-1 px-1 text-[11.5px] text-rose-600 dark:text-rose-400">{e.lines}</p>}
        </div>
      </div>
      <Footer onCancel={onCancel}>
        <Button variant="primary" onClick={save}>
          สร้างใบหยิบและพิมพ์
        </Button>
      </Footer>
    </div>
  );
}

function PickForm({ task, onDone, onCancel }: { task: PickTask; onDone: () => void; onCancel: () => void }) {
  const b = bin(task.bin);
  const inBin = b.material === task.material ? b.qty : 0;
  const [picked, setPicked] = useState(String(Math.min(task.qty, inBin)));
  const [tried, setTried] = useState(false);
  const n = num(picked);
  const problem = pickProblem(task, n);
  const m = material(task.material);

  const save = () => {
    setTried(true);
    if (problem) return;
    confirmPick(task.no, n);
    notify(n < task.qty ? `บันทึกหยิบ ${task.no} แล้ว · หยิบขาด ${task.qty - n} ${m.unit}` : `บันทึกหยิบ ${task.no} ครบ ${n} ${m.unit} แล้ว`, n < task.qty ? "warn" : "ok");
    onDone();
  };

  return (
    <div className="space-y-4">
      <div className={"p-3 " + SURFACE}>
        <p className="text-[13px] font-medium text-slate-900 dark:text-slate-50">
          {m.name} × {task.qty} {m.unit}
        </p>
        <p className="mt-0.5 text-[11.5px] text-slate-500 dark:text-slate-400">
          จากช่อง {task.bin} ไป {task.to} · ในช่องมีอยู่ {inBin} {m.unit}
        </p>
      </div>
      <Text label={`หยิบได้จริง (${m.unit})`} type="number" value={picked} onChange={setPicked} error={tried ? problem : undefined} />
      {n >= 0 && n < task.qty && !problem && (
        <Note tone="warn">หยิบขาด {task.qty - n} {m.unit} ระบบจะจ่ายออกเท่าที่หยิบได้จริง แจ้งฝ่ายที่เปิดเอกสารให้ตามส่วนที่ขาด</Note>
      )}
      <Footer onCancel={onCancel}>
        <Button variant="primary" onClick={save}>
          บันทึกว่าหยิบแล้ว
        </Button>
      </Footer>
    </div>
  );
}

function IssueDialog({ dialog, onClose }: { dialog: { ref: string } | null; onClose: () => void }) {
  const tasks = dialog ? PICKS.filter((p) => p.ref === dialog.ref && p.status === "หยิบแล้ว") : [];
  return (
    <ConfirmDialog
      open={dialog !== null}
      title="ตัดจ่ายสินค้าออกจากคลัง"
      body="ของที่หยิบมาพักที่ท่าจ่ายจะออกจากคลังตามจำนวนที่หยิบได้จริง และออกใบจ่ายสินค้า"
      subject={
        dialog && (
          <div className={"p-3 text-left " + SURFACE}>
            <p className="text-[13px] font-medium text-slate-900 dark:text-slate-50">{dialog.ref}</p>
            <ul className="mt-1 space-y-0.5 text-[11.5px] text-slate-500 dark:text-slate-400">
              {tasks.map((t) => (
                <li key={t.no}>
                  {material(t.material).name} {t.picked ?? t.qty} {material(t.material).unit}
                  {(t.picked ?? t.qty) < t.qty ? ` (สั่ง ${t.qty})` : ""}
                </li>
              ))}
            </ul>
          </div>
        )
      }
      confirmLabel="ตัดจ่ายออก"
      disabled={tasks.length === 0}
      onCancel={onClose}
      onConfirm={() => {
        if (!dialog) return;
        const gi = postGoodsIssue(dialog.ref);
        notify(`ตัดจ่าย ${dialog.ref} ออกจากคลังแล้ว · ใบจ่ายสินค้า ${gi.no}`);
        onClose();
      }}
    />
  );
}

/* ------------------------------------------------------------- transfers */

const TRANSFER_REASONS = ["เติมของเข้าช่องหยิบ", "ลดน้ำหนักช่องที่ใกล้เต็ม", "รวมล็อตเดียวกันไว้ช่องเดียว", "ย้ายออกเพื่อซ่อมชั้นวาง"];

function TransferForm({ initialFrom, initialTo, onDone, onCancel }: { initialFrom?: string; initialTo?: string; onDone: () => void; onCancel: () => void }) {
  const sources = BINS.filter((b) => b.material && b.qty > 0);
  const [from, setFrom] = useState(initialFrom ?? sources[0]?.code ?? "");
  const src = BINS.find((b) => b.code === from);
  const targetsOf = (s: Bin | undefined) => (s?.material ? BINS.filter((b) => b.code !== s.code && canHold(b, s.material!)) : []);
  const [to, setTo] = useState(initialTo ?? targetsOf(src)[0]?.code ?? "");
  const [qty, setQty] = useState(src ? String(available(src)) : "");
  const [reason, setReason] = useState("");
  const [tried, setTried] = useState(false);

  const input = { from, to, qty: num(qty), reason };
  const problems = transferProblems(input);
  const e = tried ? problems : {};
  const dst = BINS.find((b) => b.code === to);
  const n = input.qty > 0 ? input.qty : 0;

  const pickFrom = (code: string) => {
    setFrom(code);
    const s = BINS.find((b) => b.code === code);
    setTo(targetsOf(s)[0]?.code ?? "");
    setQty(s ? String(available(s)) : "");
  };

  const save = () => {
    setTried(true);
    if (Object.keys(problems).length > 0) return;
    const t = transferStock(input);
    notify(`ย้าย ${material(t.material).name} ${t.qty} จาก ${t.from} ไป ${t.to} แล้ว · ${t.no}`);
    onDone();
  };

  return (
    <div className="space-y-4">
      <Field label="ช่องต้นทาง" error={e.from}>
        <Choice
          value={from}
          onChange={pickFrom}
          options={sources.map((b) => ({ value: b.code, label: `${binLabel(b)} · ย้ายได้ ${available(b)}${reservedIn(b) ? ` (จอง ${reservedIn(b)})` : ""}` }))}
        />
      </Field>
      <Field label="ช่องปลายทาง" error={e.to}>
        <Choice
          value={to}
          onChange={setTo}
          error={e.to}
          options={targetsOf(src).map((b) => ({ value: b.code, label: `${binLabel(b)} · รับอยู่ ${binLoad(b).pct}%` }))}
        />
      </Field>
      <Text label={src?.material ? `จำนวน (${material(src.material).unit})` : "จำนวน"} type="number" value={qty} onChange={setQty} error={e.qty} />
      <Field label="เหตุผล" error={e.reason}>
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {TRANSFER_REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                className={
                  "rounded-lg border px-2.5 py-1 text-[12px] transition " +
                  (reason === r
                    ? "border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-500/40 dark:bg-violet-500/15 dark:text-violet-200"
                    : "border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-300")
                }
              >
                {r}
              </button>
            ))}
          </div>
          <input value={reason} onChange={(ev) => setReason(ev.target.value)} placeholder="หรือพิมพ์เหตุผลเอง" className={inputCls(e.reason)} />
        </div>
      </Field>
      {src && dst && src.material && (
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: `${src.code} หลังย้าย`, qty: src.qty - n, kg: (src.qty - n) * src.kgPerUnit, max: src.maxKg },
            { label: `${dst.code} หลังย้าย`, qty: dst.qty + n, kg: kgAfter(dst, n, src.kgPerUnit), max: dst.maxKg },
          ].map((c) => (
            <div key={c.label} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
              <div className="text-[11.5px] text-slate-500 dark:text-slate-400">{c.label}</div>
              <div className={"mt-1 text-[15px] font-semibold tabular-nums " + (c.kg > c.max ? "text-rose-600 dark:text-rose-400" : "text-slate-900 dark:text-slate-50")}>
                {c.qty} {material(src.material!).unit}
              </div>
              <div className="text-[11px] tabular-nums text-slate-400">
                {Math.round(c.kg).toLocaleString("th-TH")} / {c.max.toLocaleString("th-TH")} กก.
              </div>
            </div>
          ))}
        </div>
      )}
      <Footer onCancel={onCancel}>
        <Button variant="primary" onClick={save}>
          บันทึกการย้าย
        </Button>
      </Footer>
    </div>
  );
}

/* --------------------------------------------------------------- counting */

function CountSheetForm({ initialBins, onDone, onCancel }: { initialBins?: string[]; onDone: (s: CountSheet) => void; onCancel: () => void }) {
  const locked = binsUnderCount();
  const countable = BINS.filter((b) => b.material && !locked.has(b.code));
  const [picked, setPicked] = useState<string[]>(() => (initialBins ?? []).filter((c) => countable.some((b) => b.code === c)));
  const [scope, setScope] = useState(`นับวนรอบ ${TODAY}`);
  const [counter, setCounter] = useState(COUNTERS[2]);
  const [tried, setTried] = useState(false);

  const input = { bins: picked, scope, counter };
  const problems = countSheetProblems(input);
  const e = tried ? problems : {};
  const toggle = (code: string) => setPicked((p) => (p.includes(code) ? p.filter((x) => x !== code) : [...p, code]));

  const save = () => {
    setTried(true);
    if (Object.keys(problems).length > 0) return;
    const sheet = createCountSheet(input);
    notify(`สร้างใบตรวจนับ ${sheet.no} แล้ว · ${sheet.lines.length} ช่อง`);
    onDone(sheet);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Text label="รอบนับ" value={scope} onChange={setScope} error={e.scope} />
        <Field label="ผู้นับ" error={e.counter}>
          <Choice value={counter} onChange={setCounter} options={COUNTERS.map((c) => ({ value: c, label: c }))} />
        </Field>
      </div>
      <Field label={`ช่องที่จะนับ · เลือกแล้ว ${picked.length} ช่อง`} error={e.bins}>
        <div className={"divide-y divide-slate-100 dark:divide-slate-800 " + SURFACE}>
          {STORAGE_TYPES.filter((t) => countable.some((b) => b.type === t.code)).map((t) => {
            const list = countable.filter((b) => b.type === t.code);
            const all = list.every((b) => picked.includes(b.code));
            return (
              <div key={t.code} className="px-3 py-2.5">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-[12px] font-medium text-slate-600 dark:text-slate-300">{t.name}</span>
                  <button
                    type="button"
                    onClick={() => setPicked((p) => (all ? p.filter((c) => !list.some((b) => b.code === c)) : [...new Set([...p, ...list.map((b) => b.code)])]))}
                    className="text-[11.5px] text-violet-700 hover:underline dark:text-violet-300"
                  >
                    {all ? "ไม่เลือกทั้งพื้นที่" : "เลือกทั้งพื้นที่"}
                  </button>
                </div>
                <div className="grid gap-1 sm:grid-cols-2">
                  {list.map((b) => (
                    <label key={b.code} className="flex items-center gap-2 text-[12.5px] text-slate-700 dark:text-slate-200">
                      <input type="checkbox" checked={picked.includes(b.code)} onChange={() => toggle(b.code)} className="size-3.5 rounded accent-violet-600" />
                      <span className="font-mono text-[12px]">{b.code}</span>
                      <span className="truncate text-slate-500 dark:text-slate-400">{material(b.material!).name}</span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Field>
      {locked.size > 0 && <Note tone="idle">ช่องที่อยู่ในใบตรวจนับที่ยังไม่ได้นับ ({[...locked].join(" · ")}) เลือกซ้ำไม่ได้</Note>}
      <Footer onCancel={onCancel}>
        <Button variant="primary" onClick={save}>
          สร้างใบตรวจนับและพิมพ์
        </Button>
      </Footer>
    </div>
  );
}

function CountEntryForm({ sheet, onDone, onCancel }: { sheet: CountSheet; onDone: () => void; onCancel: () => void }) {
  const [counted, setCounted] = useState<Record<string, string>>(() => Object.fromEntries(sheet.lines.map((l) => [l.bin, ""])));
  const [tried, setTried] = useState(false);
  const values = Object.fromEntries(Object.entries(counted).map(([k, v]) => [k, num(v)]));
  const problems = countEntryProblems(sheet.no, values);
  const e = tried ? problems : {};

  const save = () => {
    setTried(true);
    if (Object.keys(problems).length > 0) return;
    const rows = enterCounts(sheet.no, values);
    const off = rows.filter((r) => variance(r) !== 0).length;
    notify(off > 0 ? `บันทึกผลนับ ${sheet.no} แล้ว · พบผลต่าง ${off} ช่อง รออนุมัติ` : `บันทึกผลนับ ${sheet.no} แล้ว · ตรงกับระบบทุกช่อง`, off > 0 ? "warn" : "ok");
    onDone();
  };

  return (
    <div className="space-y-4">
      <Note tone="idle">ใส่จำนวนที่นับได้จริงตามใบนับ ระบบจะเทียบกับยอดในระบบหลังบันทึก ผลต่างต้องให้ผู้อนุมัติที่ไม่ใช่ผู้นับยืนยันก่อนปรับยอด</Note>
      {problems.sheet && <Note tone="bad">{problems.sheet}</Note>}
      <div className={"overflow-hidden " + SURFACE}>
        <table className="w-full text-[13px]">
          <thead className="bg-slate-50/80 text-left text-[11.5px] text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
            <tr>
              <th className="px-3 py-2.5 font-medium">ช่องเก็บ</th>
              <th className="px-3 py-2.5 font-medium">รายการ</th>
              <th className="px-3 py-2.5 font-medium">หน่วย</th>
              <th className="w-36 px-3 py-2.5 text-right font-medium">นับได้</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {sheet.lines.map((l) => {
              const err = e["bin:" + l.bin];
              return (
                <tr key={l.bin}>
                  <td className="px-3 py-2 font-mono text-[12px] text-slate-600 dark:text-slate-300">{l.bin}</td>
                  <td className="px-3 py-2 text-slate-900 dark:text-slate-50">{material(l.material).name}</td>
                  <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{material(l.material).unit}</td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={0}
                      value={counted[l.bin]}
                      onChange={(ev) => setCounted((c) => ({ ...c, [l.bin]: ev.target.value }))}
                      aria-label={`จำนวนที่นับได้ช่อง ${l.bin}`}
                      className={inputCls(err) + " py-2 text-right tabular-nums"}
                    />
                    {err && <span className="mt-1 block text-right text-[11px] text-rose-600 dark:text-rose-400">{err}</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Footer onCancel={onCancel}>
        <Button variant="primary" onClick={save} disabled={problems.sheet !== undefined}>
          บันทึกผลนับ
        </Button>
      </Footer>
    </div>
  );
}

function CountSubject({ c }: { c: Count }) {
  const m = material(c.material);
  const diff = variance(c);
  return (
    <div className={"p-3 text-left " + SURFACE}>
      <p className="text-[13px] font-medium text-slate-900 dark:text-slate-50">
        {c.bin} · {m.name}
      </p>
      <p className="mt-0.5 text-[11.5px] text-slate-500 dark:text-slate-400">
        {c.doc} · นับโดย {c.by} วันที่ {c.date} · ระบบ {c.system} นับได้ {c.counted} {m.unit}
      </p>
      <p className={"mt-1 text-[12px] font-semibold tabular-nums " + (diff < 0 ? "text-rose-600 dark:text-rose-400" : "text-amber-700 dark:text-amber-400")}>
        ผลต่าง {diff > 0 ? "+" : ""}
        {diff} {m.unit} · {baht(varianceValue(c))}
      </p>
    </div>
  );
}

function ApproveCountDialog({ dialog, onClose }: { dialog: { count: Count } | null; onClose: () => void }) {
  const [who, setWho] = useState(COUNT_APPROVERS[0].name);
  const [reason, setReason] = useState("");
  useEffect(() => {
    if (!dialog) return;
    setWho(COUNT_APPROVERS.find((a) => a.name !== dialog.count.by)!.name);
    setReason("");
  }, [dialog]);
  const problem = dialog ? countApprovalProblem(dialog.count, who, reason) : undefined;
  const whoProblem = dialog && who === dialog.count.by ? problem : undefined;

  return (
    <ConfirmDialog
      open={dialog !== null}
      title="อนุมัติผลต่างจากการตรวจนับ"
      body="อนุมัติแล้วจึงปรับยอดในช่องได้ ผู้อนุมัติต้องไม่ใช่คนที่นับช่องนี้เอง"
      subject={dialog && <CountSubject c={dialog.count} />}
      fields={
        <>
          <Field label="ผู้อนุมัติ" error={whoProblem}>
            <Choice value={who} onChange={setWho} options={COUNT_APPROVERS.map((a) => ({ value: a.name, label: `${a.name} · ${a.role}` }))} error={whoProblem} />
          </Field>
          <Field label="สาเหตุของผลต่าง" hint="อย่างน้อย 5 ตัวอักษร เช่น หยิบเกินรอบก่อน บันทึกผิดช่อง ของเสียหาย">
            <textarea value={reason} rows={3} onChange={(ev) => setReason(ev.target.value)} className={FIELD + " w-full resize-none leading-relaxed"} />
          </Field>
        </>
      }
      confirmLabel="อนุมัติผลต่าง"
      disabled={problem !== undefined}
      onCancel={onClose}
      onConfirm={() => {
        if (!dialog) return;
        approveCount(dialog.count.doc, dialog.count.bin, who, reason);
        notify(`อนุมัติผลต่างช่อง ${dialog.count.bin} (${dialog.count.doc}) แล้ว · พร้อมปรับยอด`);
        onClose();
      }}
    />
  );
}

function PostCountDialog({ dialog, onClose }: { dialog: { count: Count } | null; onClose: () => void }) {
  const c = dialog?.count;
  const b = c ? bin(c.bin) : null;
  const now = c && b && b.material === c.material ? b.qty : 0;
  return (
    <ConfirmDialog
      open={dialog !== null}
      title="ปรับยอดตามผลตรวจนับ"
      body={
        !c
          ? ""
          : c.status === "อนุมัติแล้ว"
            ? `ปรับยอดช่อง ${c.bin} จาก ${now} เป็น ${now + variance(c)} ${material(c.material).unit} ตามผลต่างที่อนุมัติโดย ${c.approvedBy}`
            : `ผลนับนี้${c.status} ปรับยอดได้เฉพาะผลต่างที่อนุมัติแล้ว`
      }
      subject={c && <CountSubject c={c} />}
      confirmLabel="ปรับยอดเข้าสต็อก"
      disabled={c?.status !== "อนุมัติแล้ว"}
      onCancel={onClose}
      onConfirm={() => {
        if (!c) return;
        postCountAdjustment(c.doc, c.bin);
        notify(`ปรับยอดช่อง ${c.bin} ตามผลนับ ${c.doc} แล้ว`);
        onClose();
      }}
    />
  );
}


