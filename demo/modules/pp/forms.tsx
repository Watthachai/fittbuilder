import { useState } from "react";
import type { ReactNode } from "react";
import { ChevronDown, Printer } from "lucide-react";
import { TODAY, material } from "../mm/data";
import {
  BUCKETS, PLANNED_ORDERS, PURCHASE_PROPOSALS, WORK_KINDS, addBomLine, addDays, addDemand, addOperation,
  addWorkCenter, alternativesFor, availabilityOf, baht, bomOf, bucketOf, can, cancelOrder, completeOrder,
  componentMaterials, confirmOperation, convertPlannedOrder, costOf, createOrder, inputOf, issueComponents,
  loadOf, moveOperation, opLoadOf, product, products, progressOf, receiveOutput, releaseOrder, rescheduleOrder,
  routingOf, runMrpPlanning, scrapOf, sendProposals, startFor, stockOf, updateBomLine, updateOperation,
  updateOrder, updateWorkCenter, workCenter, WORK_CENTERS, ORDERS,
} from "./data";
import type { BomLine, GoodsMovement, PlannedOrder, ProductionOrder, RoutingOp, WorkCenter } from "./data";
import { MovementSlip, OrderTicket, ProductionReportSheet, ProposalSheet } from "./print";
import { Badge, Button, FIELD, Note, Progress, SURFACE } from "../ui";
import { ConfirmDialog, Field, FormModal, notify, printDocument, useData } from "../kit";

/**
 * Every act a planner or a supervisor performs on this module, as one list.
 *
 * The screen holds at most one of them at a time and every section raises them
 * the same way, so the button on a table row and the button inside a record
 * open the same form and run the same rule in data.ts.
 */
export type Act =
  | { kind: "order-new"; product?: string }
  | { kind: "order-edit"; order: ProductionOrder }
  | { kind: "convert"; planned: PlannedOrder }
  | { kind: "release"; order: ProductionOrder }
  | { kind: "issue"; order: ProductionOrder }
  | { kind: "confirm"; order: ProductionOrder | null; op?: string }
  | { kind: "receipt"; order: ProductionOrder }
  | { kind: "teco"; order: ProductionOrder }
  | { kind: "cancel"; order: ProductionOrder }
  | { kind: "reschedule"; order: ProductionOrder }
  | { kind: "move"; order: ProductionOrder; op?: string }
  | { kind: "bom"; product: string; line: BomLine | null }
  | { kind: "op"; product: string; op: RoutingOp | null }
  | { kind: "wc"; wc: WorkCenter | null }
  | { kind: "demand" }
  | { kind: "mrp" }
  | { kind: "send" }
  | { kind: "remove"; title: string; body: string; subject: string; confirmLabel: string; run: () => string }
  | { kind: "print-order"; order: ProductionOrder }
  | { kind: "print-slip"; order: ProductionOrder; movement?: GoodsMovement }
  | { kind: "print-proposals" }
  | { kind: "print-report" };

type Of<K extends Act["kind"]> = Extract<Act, { kind: K }>;

const CANCEL_REASONS = ["เลือกเหตุผล", "ลูกค้ายกเลิกคำสั่งซื้อ", "เปลี่ยนแผนการผลิต", "เปิดใบซ้ำ", "วัสดุไม่พอ เลื่อนไปรอบถัดไป", "อื่น ๆ"];

/* ---------------------------------------------------------------- pieces */

function Input({
  value, onChange, error, type = "text", placeholder,
}: { value: string; onChange: (v: string) => void; error?: string; type?: string; placeholder?: string }) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={FIELD + " w-full tabular-nums " + (error ? "border-rose-400 dark:border-rose-500" : "")}
    />
  );
}

/** A select whose values are codes and whose labels are what a person reads. */
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

function Actions({ onCancel, onSave, label, disabled }: { onCancel: () => void; onSave: () => void; label: string; disabled?: boolean }) {
  return (
    <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
      <Button variant="secondary" onClick={onCancel}>
        ยกเลิก
      </Button>
      <Button variant="primary" onClick={onSave} disabled={disabled}>
        {label}
      </Button>
    </div>
  );
}

/** A small read-only table inside a form or a dialog. */
function MiniTable({ head, rows, right = [] }: { head: string[]; rows: ReactNode[][]; right?: number[] }) {
  return (
    <div className={"overflow-hidden " + SURFACE}>
      <table className="w-full text-[12.5px]">
        <thead className="bg-slate-50/80 text-left text-[11px] text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
          <tr>
            {head.map((h, i) => (
              <th key={h} className={"px-3 py-2 font-medium" + (right.includes(i) ? " text-right" : "")}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} className={"px-3 py-2 text-slate-700 dark:text-slate-200" + (right.includes(j) ? " text-right tabular-nums" : "")}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const num = (s: string) => (s.trim() === "" ? NaN : Number(s));
const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

function OrderSubject({ o }: { o: ProductionOrder }) {
  const p = product(o.product);
  return (
    <span className="block rounded-xl bg-slate-50 px-3.5 py-2.5 dark:bg-slate-800/60">
      <span className="block text-[13px] font-medium text-slate-900 dark:text-slate-50">
        {o.no} · {p.name}
      </span>
      <span className="block text-[11.5px] text-slate-500 dark:text-slate-400">
        {o.qty} {p.unit} · เริ่ม {o.start} · ส่ง {o.due} · {o.status}
      </span>
    </span>
  );
}

/* ------------------------------------------------------------- the host */

export function PpActions({
  act,
  onAct,
  onOpenOrder,
}: {
  act: Act | null;
  onAct: (a: Act | null) => void;
  onOpenOrder: (no: string) => void;
}) {
  useData();
  const close = () => onAct(null);
  const pick = <K extends Act["kind"]>(kind: K) => (act?.kind === kind ? (act as Of<K>) : null);

  const orderNew = pick("order-new");
  const orderEdit = pick("order-edit");
  const convert = pick("convert");
  const release = pick("release");
  const issue = pick("issue");
  const confirm = pick("confirm");
  const receipt = pick("receipt");
  const teco = pick("teco");
  const cancel = pick("cancel");
  const reschedule = pick("reschedule");
  const move = pick("move");
  const bom = pick("bom");
  const op = pick("op");
  const wc = pick("wc");
  const remove = pick("remove");
  const printOrder = pick("print-order");
  const printSlip = pick("print-slip");

  const orderTitle = orderEdit ? "แก้ไขใบสั่งผลิต" : convert ? "แปลงเป็นใบสั่งผลิต" : "สร้างใบสั่งผลิต";
  const orderKey = orderEdit ? orderEdit.order.no : convert ? convert.planned.no : "new-" + (orderNew?.product ?? "");

  return (
    <>
      <FormModal
        open={orderNew !== null || orderEdit !== null || convert !== null}
        title={orderTitle}
        subtitle={
          convert
            ? `${convert.planned.no} จาก ${convert.planned.run} · ปรับจำนวนและวันได้ก่อนแปลง`
            : "วัสดุและขั้นตอนคัดลอกจากข้อมูลหลัก ณ วันนี้ แก้ข้อมูลหลักภายหลังไม่กระทบใบนี้"
        }
        onClose={close}
      >
        {(orderNew || orderEdit || convert) && (
          <OrderForm
            key={orderKey}
            order={orderEdit?.order}
            planned={convert?.planned}
            initialProduct={orderNew?.product}
            onCancel={close}
            onDone={(no) => {
              close();
              onOpenOrder(no);
            }}
          />
        )}
      </FormModal>

      <ReleaseDialog order={release?.order ?? null} onClose={close} />

      <FormModal open={issue !== null} title="เบิกวัสดุเข้าใบสั่งผลิต" subtitle={issue ? `${issue.order.no} · ${product(issue.order.product).name}` : undefined} onClose={close}>
        {issue && (
          <IssueForm
            key={issue.order.no}
            order={issue.order}
            onCancel={close}
            onDone={(mv) => onAct({ kind: "print-slip", order: issue.order, movement: mv })}
          />
        )}
      </FormModal>

      <FormModal open={confirm !== null} title="บันทึกผลผลิต" subtitle="ยืนยันงานทีละขั้นตอน: ของดี ของเสีย และชั่วโมงที่ใช้จริง" onClose={close}>
        {confirm && <ConfirmForm key={(confirm.order?.no ?? "") + (confirm.op ?? "")} order={confirm.order} op={confirm.op} onCancel={close} onDone={close} />}
      </FormModal>

      <FormModal open={receipt !== null} title="รับสินค้าเข้าคลัง" subtitle={receipt ? `${receipt.order.no} · ${product(receipt.order.product).name}` : undefined} onClose={close} size="sm">
        {receipt && (
          <ReceiptForm
            key={receipt.order.no}
            order={receipt.order}
            onCancel={close}
            onDone={(mv) => onAct({ kind: "print-slip", order: receipt.order, movement: mv })}
          />
        )}
      </FormModal>

      <TecoDialog order={teco?.order ?? null} onClose={close} />
      <CancelDialog order={cancel?.order ?? null} onClose={close} />

      <FormModal open={reschedule !== null} title="เลื่อนวันผลิต" subtitle="ชั่วโมงของใบนี้ย้ายไปอยู่รอบวางแผนของวันเริ่มใหม่" onClose={close} size="sm">
        {reschedule && <RescheduleForm key={reschedule.order.no} order={reschedule.order} onCancel={close} onDone={close} />}
      </FormModal>

      <FormModal open={move !== null} title="ย้ายศูนย์งาน" subtitle="ย้ายขั้นตอนที่ยังไม่เริ่มไปศูนย์งานที่ทำงานแบบเดียวกัน เพื่อเกลี่ยภาระงาน" onClose={close} size="sm">
        {move && <MoveForm key={move.order.no} order={move.order} initialOp={move.op} onCancel={close} onDone={close} />}
      </FormModal>

      <FormModal
        open={bom !== null}
        title={bom?.line ? "แก้ไขวัสดุในสูตร" : "เพิ่มวัสดุในสูตรการผลิต"}
        subtitle={bom ? product(bom.product).name : undefined}
        onClose={close}
        size="sm"
      >
        {bom && <BomForm key={bom.product + (bom.line?.material ?? "")} productCode={bom.product} line={bom.line} onCancel={close} onDone={close} />}
      </FormModal>

      <FormModal
        open={op !== null}
        title={op?.op ? `แก้ไขขั้นตอน ${op.op.op}` : "เพิ่มขั้นตอนการผลิต"}
        subtitle={op ? product(op.product).name : undefined}
        onClose={close}
        size="sm"
      >
        {op && <OperationForm key={op.product + (op.op?.op ?? "")} productCode={op.product} op={op.op} onCancel={close} onDone={close} />}
      </FormModal>

      <FormModal open={wc !== null} title={wc?.wc ? "แก้ไขศูนย์งาน" : "เพิ่มศูนย์งาน"} subtitle="กำลังการผลิตนับเป็นชั่วโมงต่อรอบวางแผนสองสัปดาห์" onClose={close} size="sm">
        {wc && <WorkCenterForm key={wc.wc?.code ?? "new"} wc={wc.wc} onCancel={close} onDone={close} />}
      </FormModal>

      <FormModal open={act?.kind === "demand"} title="เพิ่มความต้องการ" subtitle="ยอดที่ต้องส่ง ป้อนเข้าการวางแผนความต้องการวัสดุรอบถัดไป" onClose={close} size="sm">
        {act?.kind === "demand" && <DemandForm onCancel={close} onDone={close} />}
      </FormModal>

      <MrpDialog open={act?.kind === "mrp"} onClose={close} />
      <SendDialog open={act?.kind === "send"} onClose={close} />

      <ConfirmDialog
        open={remove !== null}
        title={remove?.title ?? ""}
        body={remove?.body ?? ""}
        subject={remove && <span className="block rounded-xl bg-slate-50 px-3.5 py-2.5 text-[13px] text-slate-800 dark:bg-slate-800/60 dark:text-slate-100">{remove.subject}</span>}
        confirmLabel={remove?.confirmLabel}
        onCancel={close}
        onConfirm={() => {
          if (!remove) return;
          notify(remove.run());
          close();
        }}
      />

      <PrintModal open={printOrder !== null} title="ใบสั่งผลิต / ใบงาน" onClose={close}>
        {printOrder && <OrderTicket order={printOrder.order} />}
      </PrintModal>
      <PrintModal
        open={printSlip !== null}
        title={printSlip?.movement?.kind === "รับเข้าคลัง" ? "ใบรับสินค้าเข้าคลัง" : "ใบเบิกวัสดุ"}
        onClose={close}
      >
        {printSlip && <MovementSlip order={printSlip.order} movement={printSlip.movement} />}
      </PrintModal>
      <PrintModal open={act?.kind === "print-proposals"} title="ใบเสนอซื้อจากการวางแผนวัสดุ" onClose={close}>
        {act?.kind === "print-proposals" && <ProposalSheet proposals={PURCHASE_PROPOSALS} />}
      </PrintModal>
      <PrintModal open={act?.kind === "print-report"} title="รายงานผลการผลิต" onClose={close}>
        {act?.kind === "print-report" && <ProductionReportSheet />}
      </PrintModal>
    </>
  );
}

function PrintModal({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  return (
    <FormModal open={open} title={title} subtitle="ตัวอย่างก่อนพิมพ์ — พิมพ์เฉพาะตัวเอกสาร" onClose={onClose} size="lg">
      <div className="mb-3 flex justify-end">
        <Button variant="primary" icon={<Printer size={14} />} onClick={printDocument}>
          พิมพ์
        </Button>
      </div>
      {children}
    </FormModal>
  );
}

/* ---------------------------------------------------------------- orders */

function OrderForm({
  order,
  planned,
  initialProduct,
  onCancel,
  onDone,
}: {
  order?: ProductionOrder;
  planned?: PlannedOrder;
  initialProduct?: string;
  onCancel: () => void;
  onDone: (no: string) => void;
}) {
  const list = products();
  const [code, setCode] = useState(order?.product ?? planned?.product ?? initialProduct ?? list[0].code);
  const [qty, setQty] = useState(String(order?.qty ?? planned?.qty ?? ""));
  const [due, setDue] = useState(order?.due ?? planned?.due ?? addDays(TODAY, 21));
  const [start, setStart] = useState(order?.start ?? planned?.start ?? TODAY);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const p = product(code);
  const n = num(qty);
  const ok = Number.isInteger(n) && n > 0;
  const bom = bomOf(code);
  const routing = routingOf(code);
  const suggested = ok && isDate(due) ? startFor(code, n, due) : undefined;

  const save = () => {
    const e: Record<string, string> = {};
    if (!ok) e.qty = "จำนวนผลิตต้องเป็นจำนวนเต็มมากกว่าศูนย์";
    if (!isDate(start)) e.start = "ใส่วันเริ่มผลิต";
    if (!isDate(due)) e.due = "ใส่วันส่ง";
    else if (isDate(start) && due < start) e.due = "วันส่งต้องไม่ก่อนวันเริ่มผลิต";
    if (bom.length === 0) e.product = "สินค้านี้ยังไม่มีสูตรการผลิต เพิ่มได้ที่ข้อมูลหลักการผลิต";
    else if (routing.length === 0) e.product = "สินค้านี้ยังไม่มีขั้นตอนการผลิต เพิ่มได้ที่ข้อมูลหลักการผลิต";
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    if (order) {
      updateOrder(order.no, { qty: n, start, due });
      notify(`แก้ไขใบสั่งผลิต ${order.no} แล้ว`);
      onDone(order.no);
    } else if (planned) {
      const o = convertPlannedOrder(planned.no, { qty: n, start, due });
      notify(`แปลง ${planned.no} เป็นใบสั่งผลิต ${o.no} แล้ว`);
      onDone(o.no);
    } else {
      const o = createOrder({ product: code, qty: n, start, due });
      notify(`สร้างใบสั่งผลิต ${o.no} แล้ว — ${p.name} ${n} ${p.unit}`);
      onDone(o.no);
    }
  };

  return (
    <div className="space-y-4">
      <Field label="สินค้าที่ผลิต" error={errors.product}>
        <Choice
          value={code}
          onChange={setCode}
          disabled={Boolean(order || planned)}
          options={list.map((x) => ({ value: x.code, label: `${x.code} · ${x.name}` }))}
        />
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label={`จำนวน (${p.unit})`} error={errors.qty}>
          <Input value={qty} onChange={setQty} error={errors.qty} type="number" placeholder="เช่น 20" />
        </Field>
        <Field label="วันเริ่มผลิต" error={errors.start} hint={suggested ? `แนะนำไม่ช้ากว่า ${suggested}` : undefined}>
          <Input value={start} onChange={setStart} error={errors.start} type="date" />
        </Field>
        <Field label="วันส่ง" error={errors.due}>
          <Input value={due} onChange={setDue} error={errors.due} type="date" />
        </Field>
      </div>

      {ok && bom.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">วัสดุที่ใบนี้ต้องใช้</p>
          <MiniTable
            head={["วัสดุ", "ต้องใช้", "มีในคลัง"]}
            right={[1, 2]}
            rows={bom.map((l) => {
              const m = material(l.material);
              const need = Math.ceil(Math.round(l.qty * n * (1 + l.scrap / 100) * 1000) / 1000);
              return [
                m.name,
                `${need} ${m.unit}`,
                <Badge key="s" tone={stockOf(l.material) >= need ? "ok" : "bad"}>{stockOf(l.material)}</Badge>,
              ];
            })}
          />
          <p className="text-[11.5px] text-slate-500 dark:text-slate-400">
            ชั่วโมงตามขั้นตอน {routing.reduce((h, r) => h + r.hrs * n, 0).toFixed(1)} ชม. · ต้นทุนมาตรฐาน {baht(n * p.price)} ·
            วัสดุที่ขาดจะถูกตรวจอีกครั้งตอนปล่อยงาน
          </p>
        </div>
      )}

      <Actions onCancel={onCancel} onSave={save} label={order ? "บันทึก" : planned ? "แปลงเป็นใบสั่งผลิต" : "สร้างใบสั่งผลิต"} />
    </div>
  );
}

function ReleaseDialog({ order: o, onClose }: { order: ProductionOrder | null; onClose: () => void }) {
  const rows = o ? availabilityOf(o) : [];
  const short = rows.filter((r) => r.short > 0);
  const allowed = o !== null && can.release(o);
  return (
    <ConfirmDialog
      open={o !== null}
      title="ปล่อยงานเข้าสายการผลิต"
      body="ปล่อยงานแล้วศูนย์งานจะเห็นใบนี้ในคิว วัสดุที่ต้องใช้ถูกจองไว้ให้ใบนี้ และเริ่มเบิกของได้"
      subject={o && <OrderSubject o={o} />}
      fields={
        o && (
          <div className="space-y-3">
            <MiniTable
              head={["วัสดุ", "ต้องเบิก", "ใช้ได้", ""]}
              right={[1, 2]}
              rows={rows.map((r) => {
                const m = material(r.material);
                return [
                  m.name,
                  `${r.open} ${m.unit}`,
                  Math.max(0, r.available),
                  <Badge key="b" tone={r.short > 0 ? "bad" : "ok"}>{r.short > 0 ? `ขาด ${r.short}` : "พอ"}</Badge>,
                ];
              })}
            />
            {!allowed ? (
              <Note tone="idle">ใบนี้สถานะ{o.status} ปล่อยงานไปแล้วหรือปิดไปแล้ว</Note>
            ) : short.length > 0 ? (
              <Note tone="bad">
                วัสดุไม่พอ ปล่อยงานไม่ได้ — "ใช้ได้" คือสต็อกหักส่วนที่ใบอื่นที่ปล่อยงานแล้วจองไว้ รอรับของหรือเลื่อนใบนี้ออกไป
              </Note>
            ) : (
              <Note tone="ok">วัสดุพอทุกรายการ</Note>
            )}
          </div>
        )
      }
      confirmLabel="ปล่อยงาน"
      disabled={!allowed || short.length > 0}
      onCancel={onClose}
      onConfirm={() => {
        if (!o) return;
        releaseOrder(o.no);
        notify(`ปล่อยงาน ${o.no} เข้าสายการผลิตแล้ว`);
        onClose();
      }}
    />
  );
}

function IssueForm({ order: o, onCancel, onDone }: { order: ProductionOrder; onCancel: () => void; onDone: (mv: GoodsMovement) => void }) {
  const [qty, setQty] = useState<Record<string, string>>(() =>
    Object.fromEntries(o.components.map((c) => [c.material, String(Math.max(0, Math.min(c.qty - c.issued, stockOf(c.material))))]))
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const allowed = can.issue(o);

  const save = () => {
    const e: Record<string, string> = {};
    for (const c of o.components) {
      const v = num(qty[c.material] || "0");
      if (!(v >= 0)) e[c.material] = "ใส่ตัวเลข";
      else if (v > c.qty - c.issued) e[c.material] = `ค้างเบิก ${c.qty - c.issued}`;
      else if (v > stockOf(c.material)) e[c.material] = `ในคลังมี ${stockOf(c.material)}`;
    }
    if (Object.keys(e).length === 0 && o.components.every((c) => num(qty[c.material] || "0") === 0)) {
      e.form = "ใส่จำนวนเบิกอย่างน้อยหนึ่งรายการ";
    }
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    const mv = issueComponents(o.no, o.components.map((c) => ({ material: c.material, qty: num(qty[c.material] || "0") })));
    notify(`บันทึกใบเบิกวัสดุ ${mv.no} เข้า ${o.no} แล้ว — ตัดสต็อกคลังวัสดุ ${mv.stockDocs.join(", ")}`);
    onDone(mv);
  };

  if (!allowed) {
    return <Note tone="idle">{o.no} ไม่มีวัสดุค้างเบิก หรือยังไม่ได้ปล่อยงาน (สถานะ{o.status})</Note>;
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2.5">
        {o.components.map((c) => {
          const m = material(c.material);
          const open = c.qty - c.issued;
          return (
            <div key={c.material} className="grid grid-cols-[1fr_8rem] items-start gap-3">
              <div className="min-w-0 pt-1.5">
                <p className="truncate text-[13px] text-slate-900 dark:text-slate-50">{m.name}</p>
                <p className="text-[11.5px] text-slate-500 dark:text-slate-400">
                  ต้องใช้ {c.qty} · เบิกแล้ว {c.issued} · ค้าง {open} {m.unit} · ในคลัง {stockOf(c.material)} · ที่เก็บ {m.bin}
                </p>
              </div>
              <Field label="เบิกครั้งนี้" error={errors[c.material]}>
                <Input value={qty[c.material]} onChange={(v) => setQty({ ...qty, [c.material]: v })} error={errors[c.material]} type="number" />
              </Field>
            </div>
          );
        })}
      </div>
      {errors.form && <Note tone="bad">{errors.form}</Note>}
      <Note tone="idle">บันทึกแล้วสต็อกในคลังวัสดุลดลงทันที และเปิดใบเบิกให้พิมพ์ลงชื่อ</Note>
      <Actions onCancel={onCancel} onSave={save} label="บันทึกการเบิก" />
    </div>
  );
}

function ConfirmForm({
  order: initial, op: initialOp, onCancel, onDone,
}: { order: ProductionOrder | null; op?: string; onCancel: () => void; onDone: () => void }) {
  const choices = ORDERS.filter(can.confirm);
  const [no, setNo] = useState(initial?.no ?? choices[0]?.no ?? "");
  const o = ORDERS.find((x) => x.no === no) ?? null;
  const open = o ? o.operations.map((r, i) => ({ r, i, room: inputOf(o, i) - progressOf(o, r.op).yield - progressOf(o, r.op).scrap })).filter((x) => x.room > 0) : [];
  const [op, setOp] = useState(initialOp ?? open[0]?.r.op ?? "");
  const [good, setGood] = useState("");
  const [bad, setBad] = useState("0");
  const [hrs, setHrs] = useState("");
  const [hrsTouched, setHrsTouched] = useState(false);
  const [note, setNote] = useState("");
  const [date, setDate] = useState(TODAY);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const step = open.find((x) => x.r.op === op) ?? open[0];
  const standardHrs = (g: string, b: string) => (step ? step.r.hrs * ((num(g) || 0) + (num(b) || 0)) : 0);
  const setCounts = (g: string, b: string) => {
    setGood(g);
    setBad(b);
    if (!hrsTouched) setHrs(standardHrs(g, b) ? String(Math.round(standardHrs(g, b) * 10) / 10) : "");
  };

  if (!o || !can.confirm(o)) {
    return <Note tone="idle">ยังไม่มีใบสั่งผลิตที่ปล่อยงานแล้วและรอยืนยันงาน ปล่อยงานใบที่วางแผนไว้ก่อน</Note>;
  }

  const save = () => {
    const e: Record<string, string> = {};
    const g = num(good);
    const b = num(bad || "0");
    if (!step) e.op = "ทุกขั้นตอนยืนยันครบแล้ว";
    if (!(Number.isInteger(g) && g >= 0)) e.good = "ใส่จำนวนเต็ม";
    if (!(Number.isInteger(b) && b >= 0)) e.bad = "ใส่จำนวนเต็ม";
    if (!e.good && !e.bad && g + b === 0) e.good = "ใส่ของดีหรือของเสียอย่างน้อยหนึ่งหน่วย";
    if (step && !e.good && !e.bad && g + b > step.room) e.good = `ขั้นนี้ยืนยันได้อีกไม่เกิน ${step.room} หน่วย`;
    if (!(num(hrs) > 0)) e.hrs = "ใส่ชั่วโมงที่ใช้จริง";
    if (b > 0 && note.trim() === "") e.note = "มีของเสีย ต้องระบุสาเหตุ";
    if (!isDate(date)) e.date = "ใส่วันที่";
    else if (date > TODAY) e.date = "ยืนยันงานล่วงหน้าไม่ได้";
    setErrors(e);
    if (Object.keys(e).length > 0 || !step) return;
    const cf = confirmOperation(o.no, { op: step.r.op, yield: g, scrap: b, hrs: num(hrs), note, date });
    notify(
      `ยืนยันงาน ${cf.no} · ${o.no} ขั้นตอน ${cf.op} ของดี ${g} เสีย ${b}` +
        (o.status === "ผลิตครบแล้ว" ? " — ผลิตครบแล้ว รอรับเข้าคลัง" : "")
    );
    onDone();
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="ใบสั่งผลิต">
          <Choice
            value={no}
            onChange={(v) => {
              setNo(v);
              setOp("");
            }}
            disabled={Boolean(initial)}
            options={(initial ? [initial] : choices).map((x) => ({ value: x.no, label: `${x.no} · ${product(x.product).name}` }))}
          />
        </Field>
        <Field label="ขั้นตอน" error={errors.op}>
          <Choice
            value={step?.r.op ?? ""}
            onChange={setOp}
            options={open.map((x) => ({ value: x.r.op, label: `${x.r.op} · ${workCenter(x.r.wc).name} (เหลือ ${x.room})` }))}
          />
        </Field>
      </div>

      {step && (
        <Progress
          done={progressOf(o, step.r.op).yield}
          total={o.qty}
          label={`${step.r.text} · ผ่านแล้ว ${progressOf(o, step.r.op).yield} จาก ${o.qty} ${product(o.product).unit} · เข้าขั้นนี้ได้อีก ${step.room}`}
        />
      )}

      <div className="grid grid-cols-3 gap-3">
        <Field label="ของดี" error={errors.good}>
          <Input value={good} onChange={(v) => setCounts(v, bad)} error={errors.good} type="number" />
        </Field>
        <Field label="ของเสีย" error={errors.bad}>
          <Input value={bad} onChange={(v) => setCounts(good, v)} error={errors.bad} type="number" />
        </Field>
        <Field label="ชั่วโมงที่ใช้จริง" error={errors.hrs} hint={step ? `มาตรฐาน ${step.r.hrs} ชม./หน่วย` : undefined}>
          <Input
            value={hrs}
            onChange={(v) => {
              setHrsTouched(true);
              setHrs(v);
            }}
            error={errors.hrs}
            type="number"
          />
        </Field>
      </div>
      <div className="grid grid-cols-[1fr_10rem] gap-3">
        <Field label="สาเหตุของเสีย / หมายเหตุ" error={errors.note} hint="จำเป็นเมื่อมีของเสีย">
          <Input value={note} onChange={setNote} error={errors.note} placeholder="เช่น รอยเชื่อมร้าว ตรวจไม่ผ่าน" />
        </Field>
        <Field label="วันที่" error={errors.date}>
          <Input value={date} onChange={setDate} error={errors.date} type="date" />
        </Field>
      </div>
      <Actions onCancel={onCancel} onSave={save} label="ยืนยันงาน" />
    </div>
  );
}

function ReceiptForm({ order: o, onCancel, onDone }: { order: ProductionOrder; onCancel: () => void; onDone: (mv: GoodsMovement) => void }) {
  const waiting = o.done - o.received;
  const [qty, setQty] = useState(String(Math.max(0, waiting)));
  const [error, setError] = useState<string>();
  const p = product(o.product);

  if (!can.receive(o)) {
    return <Note tone="idle">{o.no} ไม่มีของดีที่รอรับเข้าคลัง — ยืนยันงานขั้นสุดท้ายก่อน</Note>;
  }

  const save = () => {
    const n = num(qty);
    if (!(Number.isInteger(n) && n > 0 && n <= waiting)) {
      setError(`ใส่จำนวนเต็มระหว่าง 1 ถึง ${waiting}`);
      return;
    }
    const mv = receiveOutput(o.no, n);
    notify(`รับ${p.name} ${n} ${p.unit} เข้าคลังแล้ว · ${mv.no} (คลัง ${mv.stockDocs.join(", ")})`);
    onDone(mv);
  };

  return (
    <div className="space-y-4">
      <Progress done={o.received} total={o.done || 1} label={`รับเข้าแล้ว ${o.received} จากของดี ${o.done} ${p.unit}`} />
      <Field label={`จำนวนรับเข้า (${p.unit})`} error={error} hint={`รอรับอีก ${waiting} ${p.unit} · ที่เก็บ ${p.bin}`}>
        <Input value={qty} onChange={setQty} error={error} type="number" />
      </Field>
      <Actions onCancel={onCancel} onSave={save} label="รับเข้าคลัง" />
    </div>
  );
}

function TecoDialog({ order: o, onClose }: { order: ProductionOrder | null; onClose: () => void }) {
  const c = o ? costOf(o) : null;
  const allowed = o !== null && can.complete(o);
  const pending = o ? o.done - o.received : 0;
  return (
    <ConfirmDialog
      open={o !== null}
      title="ปิดงานใบสั่งผลิต"
      body="ปิดงานแล้วจะเบิกวัสดุ ยืนยันงาน หรือรับเข้าคลังเพิ่มไม่ได้ ส่วนที่ยังไม่ผลิตหลุดจากแผนกำลังการผลิต และผลต่างต้นทุนถือเป็นตัวเลขสุดท้าย"
      subject={o && <OrderSubject o={o} />}
      fields={
        o &&
        c && (
          <div className="space-y-3">
            <MiniTable
              head={["", "จำนวน / บาท"]}
              right={[1]}
              rows={[
                ["ของดี / สั่งผลิต", `${o.done} / ${o.qty}`],
                ["ของเสีย", scrapOf(o)],
                ["รับเข้าคลังแล้ว", o.received],
                ["ต้นทุนจริง", baht(c.actual)],
                ["มาตรฐานของที่รับเข้า", baht(c.standard)],
                ["ผลต่าง", baht(c.variance)],
              ]}
            />
            {!allowed ? (
              <Note tone="idle">ใบนี้สถานะ{o.status} ปิดงานไม่ได้</Note>
            ) : pending > 0 ? (
              <Note tone="bad">ยังมีของดี {pending} หน่วยที่ยังไม่รับเข้าคลัง รับเข้าให้ครบก่อนปิดงาน</Note>
            ) : null}
          </div>
        )
      }
      confirmLabel="ปิดงาน"
      disabled={!allowed || pending > 0}
      onCancel={onClose}
      onConfirm={() => {
        if (!o) return;
        completeOrder(o.no);
        notify(`ปิดงานใบสั่งผลิต ${o.no} แล้ว`);
        onClose();
      }}
    />
  );
}

function CancelDialog({ order: o, onClose }: { order: ProductionOrder | null; onClose: () => void }) {
  const [reason, setReason] = useState(CANCEL_REASONS[0]);
  const [detail, setDetail] = useState("");
  const allowed = o !== null && can.cancel(o);
  const ready = allowed && reason !== CANCEL_REASONS[0] && (reason !== "อื่น ๆ" || detail.trim().length >= 3);
  const reset = () => {
    setReason(CANCEL_REASONS[0]);
    setDetail("");
  };
  return (
    <ConfirmDialog
      open={o !== null}
      title="ยกเลิกใบสั่งผลิต"
      body="ยกเลิกแล้วใบนี้ไม่นับในแผนการผลิตและไม่จองวัสดุอีก เลขที่ใบยังอยู่ในทะเบียนพร้อมเหตุผล"
      subject={o && <OrderSubject o={o} />}
      fields={
        o && (
          <div className="space-y-3">
            {!allowed && <Note tone="bad">ใบนี้เริ่มเบิกวัสดุหรือยืนยันงานแล้ว ยกเลิกไม่ได้ ให้ปิดงานแทน</Note>}
            <Field label="เหตุผล">
              <Choice value={reason} onChange={setReason} options={CANCEL_REASONS.map((r) => ({ value: r, label: r }))} />
            </Field>
            <Field label="รายละเอียด" hint={reason === "อื่น ๆ" ? "จำเป็นเมื่อเลือก อื่น ๆ" : "ไม่บังคับ"}>
              <Input value={detail} onChange={setDetail} />
            </Field>
          </div>
        )
      }
      confirmLabel="ยกเลิกใบสั่งผลิต"
      disabled={!ready}
      onCancel={() => {
        reset();
        onClose();
      }}
      onConfirm={() => {
        if (!o || !ready) return;
        cancelOrder(o.no, detail.trim() ? `${reason} · ${detail.trim()}` : reason);
        notify(`ยกเลิกใบสั่งผลิต ${o.no} แล้ว`);
        reset();
        onClose();
      }}
    />
  );
}

/** How a work centre's load in one bucket would read after a change. */
function LoadLine({ wc, bucket, add }: { wc: string; bucket: (typeof BUCKETS)[number] | undefined; add: number }) {
  const w = workCenter(wc);
  if (!bucket) return <li className="text-[12px] text-slate-500 dark:text-slate-400">{w.name}: เกินรอบที่วางแผนไว้</li>;
  const hrs = loadOf(wc, bucket) + add;
  const pct = Math.round((hrs / w.capacityHrs) * 100);
  return (
    <li className="flex items-center gap-2 text-[12.5px]">
      <span className="min-w-0 flex-1 truncate text-slate-700 dark:text-slate-200">
        {w.name} · {bucket.label}
      </span>
      <span className="tabular-nums text-slate-500 dark:text-slate-400">
        {hrs.toFixed(1)} / {w.capacityHrs} ชม.
      </span>
      <Badge tone={pct > 100 ? "bad" : pct > 80 ? "warn" : "ok"}>{pct}%</Badge>
    </li>
  );
}

function RescheduleForm({ order: o, onCancel, onDone }: { order: ProductionOrder; onCancel: () => void; onDone: () => void }) {
  const [start, setStart] = useState(o.start);
  const [due, setDue] = useState(o.due);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const allowed = can.reschedule(o);
  const from = bucketOf(o.start);
  const to = isDate(start) ? bucketOf(start) : undefined;
  const loads = opLoadOf(o).filter((r) => r.load > 0);

  if (!allowed) return <Note tone="idle">{o.no} สถานะ{o.status} เลื่อนวันไม่ได้</Note>;

  const save = () => {
    const e: Record<string, string> = {};
    if (!isDate(start)) e.start = "ใส่วันเริ่มผลิต";
    if (!isDate(due)) e.due = "ใส่วันส่ง";
    else if (isDate(start) && due < start) e.due = "วันส่งต้องไม่ก่อนวันเริ่มผลิต";
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    rescheduleOrder(o.no, start, due);
    notify(`เลื่อน ${o.no} เป็นเริ่ม ${start} ส่ง ${due} แล้ว`);
    onDone();
  };

  return (
    <div className="space-y-4">
      <OrderSubject o={o} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="วันเริ่มผลิตใหม่" error={errors.start}>
          <Input value={start} onChange={setStart} error={errors.start} type="date" />
        </Field>
        <Field label="วันส่งใหม่" error={errors.due}>
          <Input value={due} onChange={setDue} error={errors.due} type="date" />
        </Field>
      </div>
      {loads.length > 0 && (
        <div>
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">ภาระงานหลังเลื่อน</p>
          <ul className="space-y-1.5">
            {loads.map((r) => (
              <LoadLine key={r.op} wc={r.wc} bucket={to} add={to === from ? 0 : r.load} />
            ))}
          </ul>
        </div>
      )}
      <Actions onCancel={onCancel} onSave={save} label="เลื่อนวัน" />
    </div>
  );
}

function MoveForm({ order: o, initialOp, onCancel, onDone }: { order: ProductionOrder; initialOp?: string; onCancel: () => void; onDone: () => void }) {
  const movable = can.reschedule(o)
    ? o.operations.filter((r) => progressOf(o, r.op).yield + progressOf(o, r.op).scrap === 0 && alternativesFor(r.wc).length > 0)
    : [];
  const [op, setOp] = useState(initialOp && movable.some((r) => r.op === initialOp) ? initialOp : (movable[0]?.op ?? ""));
  const step = movable.find((r) => r.op === op);
  const targets = step ? alternativesFor(step.wc) : [];
  const [wc, setWc] = useState(targets[0]?.code ?? "");
  const target = targets.find((w) => w.code === wc) ?? targets[0];
  const bucket = bucketOf(o.start);
  const load = step ? (opLoadOf(o).find((r) => r.op === step.op)?.load ?? 0) : 0;

  if (!step || !target) {
    return <Note tone="idle">{o.no} ไม่มีขั้นตอนที่ยังไม่เริ่มและมีศูนย์งานอื่นทำแทนได้</Note>;
  }

  return (
    <div className="space-y-4">
      <OrderSubject o={o} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="ขั้นตอน">
          <Choice
            value={step.op}
            onChange={(v) => {
              setOp(v);
              setWc("");
            }}
            options={movable.map((r) => ({ value: r.op, label: `${r.op} · ${workCenter(r.wc).name}` }))}
          />
        </Field>
        <Field label="ย้ายไปศูนย์งาน">
          <Choice value={target.code} onChange={setWc} options={targets.map((w) => ({ value: w.code, label: `${w.name} (${baht(w.costPerHr)}/ชม.)` }))} />
        </Field>
      </div>
      <div>
        <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">ภาระงานหลังย้าย ({load.toFixed(1)} ชม.)</p>
        <ul className="space-y-1.5">
          <LoadLine wc={step.wc} bucket={bucket} add={-load} />
          <LoadLine wc={target.code} bucket={bucket} add={load} />
        </ul>
      </div>
      {target.costPerHr !== workCenter(step.wc).costPerHr && (
        <Note tone="warn">
          อัตราค่าแรงต่างกัน {baht(Math.abs(target.costPerHr - workCenter(step.wc).costPerHr))}/ชม. ต้นทุนจริงของใบนี้จะ
          {target.costPerHr > workCenter(step.wc).costPerHr ? "สูงขึ้น" : "ต่ำลง"}ประมาณ {baht(Math.abs(target.costPerHr - workCenter(step.wc).costPerHr) * load)}
        </Note>
      )}
      <Actions
        onCancel={onCancel}
        onSave={() => {
          moveOperation(o.no, step.op, target.code);
          notify(`ย้ายขั้นตอน ${step.op} ของ ${o.no} ไป${target.name}แล้ว`);
          onDone();
        }}
        label="ย้ายศูนย์งาน"
      />
    </div>
  );
}

/* ----------------------------------------------------------- master data */

function BomForm({ productCode, line, onCancel, onDone }: { productCode: string; line: BomLine | null; onCancel: () => void; onDone: () => void }) {
  const used = bomOf(productCode).map((l) => l.material);
  const options = line ? [material(line.material)] : componentMaterials().filter((m) => !used.includes(m.code));
  const [code, setCode] = useState(line?.material ?? options[0]?.code ?? "");
  const [qty, setQty] = useState(line ? String(line.qty) : "");
  const [scrap, setScrap] = useState(line ? String(line.scrap) : "0");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const m = code ? material(code) : null;

  if (!m) return <Note tone="idle">วัสดุทุกรายการในแฟ้มวัสดุอยู่ในสูตรนี้แล้ว</Note>;

  const save = () => {
    const e: Record<string, string> = {};
    if (!(num(qty) > 0)) e.qty = "ปริมาณต่อหน่วยต้องมากกว่าศูนย์";
    if (!(num(scrap) >= 0 && num(scrap) < 100)) e.scrap = "ใส่ 0 ถึงน้อยกว่า 100";
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    if (line) {
      updateBomLine(productCode, code, { qty: num(qty), scrap: num(scrap) });
      notify(`แก้${m.name}ในสูตร${product(productCode).name}แล้ว`);
    } else {
      addBomLine(productCode, { material: code, qty: num(qty), scrap: num(scrap) });
      notify(`เพิ่ม${m.name}ในสูตร${product(productCode).name}แล้ว`);
    }
    onDone();
  };

  const cost = (num(qty) || 0) * (1 + (num(scrap) || 0) / 100) * m.price;
  return (
    <div className="space-y-4">
      <Field label="วัสดุ">
        <Choice value={code} onChange={setCode} disabled={Boolean(line)} options={options.map((x) => ({ value: x.code, label: `${x.code} · ${x.name}` }))} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={`ใช้ต่อหน่วย (${m.unit})`} error={errors.qty}>
          <Input value={qty} onChange={setQty} error={errors.qty} type="number" placeholder="เช่น 2" />
        </Field>
        <Field label="เผื่อสูญเสีย (%)" error={errors.scrap} hint="เศษจากการตัด ชิ้นงานเสีย">
          <Input value={scrap} onChange={setScrap} error={errors.scrap} type="number" />
        </Field>
      </div>
      <Note tone="idle">
        ราคาในแฟ้มวัสดุ {baht(m.price)}/{m.unit} · เป็นเงินต่อหน่วยสินค้า {baht(cost)} · มีผลกับใบสั่งผลิตที่เปิดใหม่และการวางแผนวัสดุ
      </Note>
      <Actions onCancel={onCancel} onSave={save} label={line ? "บันทึก" : "เพิ่มในสูตร"} />
    </div>
  );
}

function OperationForm({ productCode, op, onCancel, onDone }: { productCode: string; op: RoutingOp | null; onCancel: () => void; onDone: () => void }) {
  const [wc, setWc] = useState(op?.wc ?? WORK_CENTERS[0].code);
  const [text, setText] = useState(op?.text ?? "");
  const [hrs, setHrs] = useState(op ? String(op.hrs) : "");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const save = () => {
    const e: Record<string, string> = {};
    if (text.trim().length < 3) e.text = "อธิบายงานของขั้นตอนนี้";
    if (!(num(hrs) > 0)) e.hrs = "ชั่วโมงต่อหน่วยต้องมากกว่าศูนย์";
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    if (op) {
      updateOperation(productCode, op.op, { wc, hrs: num(hrs), text });
      notify(`แก้ขั้นตอน ${op.op} ของ${product(productCode).name}แล้ว`);
    } else {
      const r = addOperation(productCode, { wc, hrs: num(hrs), text });
      notify(`เพิ่มขั้นตอน ${r.op} ใน${product(productCode).name}แล้ว`);
    }
    onDone();
  };

  return (
    <div className="space-y-4">
      <Field label="ศูนย์งาน">
        <Choice value={wc} onChange={setWc} options={WORK_CENTERS.map((w) => ({ value: w.code, label: `${w.name} · ${baht(w.costPerHr)}/ชม.` }))} />
      </Field>
      <Field label="งานที่ทำ" error={errors.text}>
        <Input value={text} onChange={setText} error={errors.text} placeholder="เช่น เชื่อมโครงและเจียรแนว" />
      </Field>
      <Field label="ชั่วโมงต่อหน่วย" error={errors.hrs} hint={num(hrs) > 0 ? `ค่าแรงต่อหน่วย ${baht(num(hrs) * workCenter(wc).costPerHr)}` : undefined}>
        <Input value={hrs} onChange={setHrs} error={errors.hrs} type="number" placeholder="เช่น 0.5" />
      </Field>
      <Actions onCancel={onCancel} onSave={save} label={op ? "บันทึก" : "เพิ่มขั้นตอน"} />
    </div>
  );
}

function WorkCenterForm({ wc, onCancel, onDone }: { wc: WorkCenter | null; onCancel: () => void; onDone: () => void }) {
  const [code, setCode] = useState(wc?.code ?? "WC-");
  const [name, setName] = useState(wc?.name ?? "");
  const [kind, setKind] = useState(wc?.kind ?? WORK_KINDS[0]);
  const [cap, setCap] = useState(wc ? String(wc.capacityHrs) : "");
  const [rate, setRate] = useState(wc ? String(wc.costPerHr) : "");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const save = () => {
    const e: Record<string, string> = {};
    if (!wc) {
      if (!/^WC-[A-Z0-9]+$/.test(code)) e.code = "ขึ้นต้น WC- ตามด้วยตัวพิมพ์ใหญ่หรือตัวเลข";
      else if (WORK_CENTERS.some((w) => w.code === code)) e.code = "รหัสนี้มีแล้ว";
    }
    if (name.trim().length < 2) e.name = "ตั้งชื่อศูนย์งาน";
    if (!(num(cap) > 0)) e.cap = "ใส่ชั่วโมงต่อรอบ";
    if (!(num(rate) > 0)) e.rate = "ใส่อัตราต่อชั่วโมง";
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    if (wc) {
      updateWorkCenter(wc.code, { name, capacityHrs: num(cap), costPerHr: num(rate) });
      notify(`แก้ศูนย์งาน ${wc.code} แล้ว — กำลัง ${num(cap)} ชม./รอบ`);
    } else {
      addWorkCenter({ code, name, kind, capacityHrs: num(cap), costPerHr: num(rate) });
      notify(`เพิ่มศูนย์งาน ${code} ${name.trim()} แล้ว`);
    }
    onDone();
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="รหัส" error={errors.code}>
          {wc ? (
            <span className={FIELD + " block w-full font-mono opacity-60"}>{wc.code}</span>
          ) : (
            <Input value={code} onChange={(v) => setCode(v.toUpperCase())} error={errors.code} />
          )}
        </Field>
        <Field label="ประเภทงาน" hint="ย้ายงานได้ระหว่างศูนย์ประเภทเดียวกัน">
          <Choice value={kind} onChange={setKind} disabled={Boolean(wc)} options={WORK_KINDS.map((k) => ({ value: k, label: k }))} />
        </Field>
      </div>
      <Field label="ชื่อศูนย์งาน" error={errors.name}>
        <Input value={name} onChange={setName} error={errors.name} placeholder="เช่น เชื่อมประกอบ สาย 3" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="กำลัง (ชม./รอบสองสัปดาห์)" error={errors.cap} hint="เพิ่มกะ = เพิ่มชั่วโมง">
          <Input value={cap} onChange={setCap} error={errors.cap} type="number" />
        </Field>
        <Field label="อัตราค่าแรงและเครื่องจักร (บาท/ชม.)" error={errors.rate}>
          <Input value={rate} onChange={setRate} error={errors.rate} type="number" />
        </Field>
      </div>
      <Actions onCancel={onCancel} onSave={save} label={wc ? "บันทึก" : "เพิ่มศูนย์งาน"} />
    </div>
  );
}

/* ------------------------------------------------------------------ mrp */

function DemandForm({ onCancel, onDone }: { onCancel: () => void; onDone: () => void }) {
  const list = products();
  const [code, setCode] = useState(list[0].code);
  const [qty, setQty] = useState("");
  const [due, setDue] = useState(addDays(TODAY, 30));
  const [source, setSource] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const save = () => {
    const e: Record<string, string> = {};
    if (!(Number.isInteger(num(qty)) && num(qty) > 0)) e.qty = "ใส่จำนวนเต็มมากกว่าศูนย์";
    if (!isDate(due)) e.due = "ใส่วันที่ต้องส่ง";
    else if (due < TODAY) e.due = "วันที่ต้องส่งผ่านไปแล้ว";
    if (source.trim().length < 3) e.source = "ระบุที่มา เช่น เลขที่ใบสั่งขายหรือประมาณการ";
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    const d = addDemand({ product: code, qty: num(qty), dueDate: due, source: source.trim() });
    notify(`เพิ่มความต้องการ ${d.no} แล้ว — รัน MRP เพื่อวางแผนใหม่`);
    onDone();
  };

  return (
    <div className="space-y-4">
      <Field label="สินค้า">
        <Choice value={code} onChange={setCode} options={list.map((x) => ({ value: x.code, label: `${x.code} · ${x.name}` }))} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={`จำนวน (${product(code).unit})`} error={errors.qty}>
          <Input value={qty} onChange={setQty} error={errors.qty} type="number" />
        </Field>
        <Field label="ต้องส่งภายใน" error={errors.due}>
          <Input value={due} onChange={setDue} error={errors.due} type="date" />
        </Field>
      </div>
      <Field label="ที่มา" error={errors.source}>
        <Input value={source} onChange={setSource} error={errors.source} placeholder="เช่น ใบสั่งขาย SO-2569-0420 หรือ ประมาณการขาย ธ.ค." />
      </Field>
      <Actions onCancel={onCancel} onSave={save} label="เพิ่มความต้องการ" />
    </div>
  );
}

function MrpDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const planned = PLANNED_ORDERS.filter((p) => p.status === "ตามแผน").length;
  const proposals = PURCHASE_PROPOSALS.filter((p) => p.status === "เสนอซื้อ").length;
  return (
    <ConfirmDialog
      open={open}
      title="รัน MRP"
      body="กางสูตรจากความต้องการทั้งหมด หักสต็อก ใบสั่งผลิตที่เปิดอยู่ และของที่สั่งซื้อไว้แล้ว เสนอใบสั่งผลิตตามแผนและข้อเสนอซื้อชุดใหม่"
      fields={
        <Note tone="warn">
          ใบสั่งตามแผนที่ยังไม่แปลง {planned} ใบ และข้อเสนอซื้อที่ยังไม่ส่ง {proposals} รายการจะถูกแทนที่ด้วยผลรอบนี้
          ส่วนที่แปลงหรือส่งฝ่ายจัดซื้อไปแล้วยังอยู่
        </Note>
      }
      confirmLabel="รัน MRP"
      onCancel={onClose}
      onConfirm={() => {
        const r = runMrpPlanning();
        notify(`รัน MRP ${r.run.no} แล้ว · ใบสั่งตามแผน ${r.planned.length} ใบ · ข้อเสนอซื้อ ${r.proposals.length} รายการ`);
        onClose();
      }}
    />
  );
}

function SendDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const waiting = PURCHASE_PROPOSALS.filter((p) => p.status === "เสนอซื้อ");
  const value = waiting.reduce((n, p) => n + p.qty * material(p.material).price, 0);
  return (
    <ConfirmDialog
      open={open}
      title="ส่งข้อเสนอซื้อให้ฝ่ายจัดซื้อ"
      body={`ส่งข้อเสนอ ${waiting.length} รายการ มูลค่าประมาณ ${baht(value)} ให้ฝ่ายจัดซื้อพิจารณาเปิดใบขอซื้อ รอบ MRP ถัดไปจะนับเป็นของที่กำลังมา`}
      subject={
        waiting.length === 0 ? (
          <Note tone="idle">ไม่มีข้อเสนอซื้อที่รอส่ง</Note>
        ) : (
          <ul className="space-y-1">
            {waiting.map((p) => {
              const m = material(p.material);
              return (
                <li key={p.no} className="flex items-center gap-2 text-[12.5px]">
                  <span className="font-mono text-[11.5px] text-slate-400">{p.no}</span>
                  <span className="min-w-0 flex-1 truncate text-slate-800 dark:text-slate-100">{m.name}</span>
                  <span className="shrink-0 tabular-nums text-slate-500 dark:text-slate-400">
                    {p.qty} {m.unit} · ภายใน {p.needBy}
                  </span>
                </li>
              );
            })}
          </ul>
        )
      }
      confirmLabel="ส่งฝ่ายจัดซื้อ"
      disabled={waiting.length === 0}
      onCancel={onClose}
      onConfirm={() => {
        const sent = sendProposals(waiting.map((p) => p.no));
        notify(`ส่งข้อเสนอซื้อ ${sent.map((p) => p.no).join(", ")} ให้ฝ่ายจัดซื้อแล้ว`);
        onClose();
      }}
    />
  );
}
