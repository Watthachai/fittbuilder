import { useState } from "react";
import type { ReactNode } from "react";
import { FIELD, SURFACE } from "../ui";
import { ConfirmDialog, Field, money, notify, useData } from "../kit";
import {
  PAY_METHODS, TODAY, amountDue, baht, billingNoteOf, cancelOrder, cancelQuotation, creditNotesOf, creditVerdict,
  customer, delivery, deliveredErrors, heldOrders, invoice, invoiceErrors, invoiceTotal, issueInvoice, linesTotal,
  markDelivered, paymentErrors, quotation, readyToInvoice, recordPayment, releaseOrder, salesOrder, addDays,
  termDays, cancelPayment, suggestedWht,
} from "./data";
import type { Billing, Errors } from "./data";
import { Choice, Input } from "./parts";

/**
 * การเดินเอกสารที่ย้อนไม่ได้: ยกเลิก อนุมัติ ยืนยันส่งถึง ออกใบกำกับ รับชำระ —
 * ผ่าน ConfirmDialog ทุกครั้ง พร้อมช่องที่การกระทำนั้นต้องบันทึก
 */

const has = (e: Errors) => Object.keys(e).length > 0;

/** The record about to be acted on, so nobody confirms the wrong one. */
function Subject({ title, rows }: { title: ReactNode; rows: [string, ReactNode][] }) {
  return (
    <div className={"p-3 " + SURFACE}>
      <p className="text-[13px] font-semibold text-slate-900 dark:text-slate-50">{title}</p>
      <dl className="mt-1.5 space-y-1 text-[12.5px]">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3">
            <dt className="text-slate-500 dark:text-slate-400">{k}</dt>
            <dd className="text-right tabular-nums text-slate-800 dark:text-slate-100">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function ReasonField({ value, onChange, label, placeholder, error }: { value: string; onChange: (v: string) => void; label: string; placeholder: string; error?: string }) {
  return (
    <Field label={label} error={error}>
      <textarea
        value={value}
        rows={3}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={FIELD + " w-full resize-none " + (error ? "border-rose-400 dark:border-rose-500" : "")}
      />
    </Field>
  );
}

const SHORT = "ใส่เหตุผลอย่างน้อย 5 ตัวอักษร";

export function CancelOrderDialog({ no, onClose }: { no: string; onClose: () => void }) {
  const so = salesOrder(no);
  const [reason, setReason] = useState("");
  const [tried, setTried] = useState(false);
  const bad = reason.trim().length < 5;
  return (
    <ConfirmDialog
      open
      title="ยกเลิกใบสั่งขาย"
      body="ใบยังอยู่ในทะเบียนพร้อมเหตุผล เลขเอกสารจึงไม่ขาดช่วง และยอดจะไม่นับเป็นยอดขายหรือยอดค้าง"
      confirmLabel="ยกเลิกใบสั่งขาย"
      onCancel={onClose}
      onConfirm={() => {
        setTried(true);
        if (bad) return;
        cancelOrder(no, reason);
        notify(`ยกเลิกใบสั่งขาย ${no} แล้ว`);
        onClose();
      }}
      subject={<Subject title={`${so.no} · ${customer(so.customer).name}`} rows={[["วันที่", so.date], ["ยอดรวมภาษี", baht(linesTotal(so.lines).gross)], ["สถานะ", so.status]]} />}
      fields={<ReasonField value={reason} onChange={setReason} label="เหตุผลการยกเลิก" placeholder="เช่น ลูกค้าขอยกเลิก เปลี่ยนรุ่นสินค้า" error={tried && bad ? SHORT : undefined} />}
    />
  );
}

export function CancelQuoteDialog({ no, onClose }: { no: string; onClose: () => void }) {
  const q = quotation(no);
  const [reason, setReason] = useState("");
  const [tried, setTried] = useState(false);
  const bad = reason.trim().length < 5;
  return (
    <ConfirmDialog
      open
      title="ยกเลิกใบเสนอราคา"
      body="ใช้เมื่อลูกค้าไม่ตกลง เหตุผลช่วยให้ฝ่ายขายเห็นว่าแพ้เพราะอะไร"
      confirmLabel="ยกเลิกใบเสนอราคา"
      onCancel={onClose}
      onConfirm={() => {
        setTried(true);
        if (bad) return;
        cancelQuotation(no, reason);
        notify(`ยกเลิกใบเสนอราคา ${no} แล้ว`);
        onClose();
      }}
      subject={<Subject title={`${q.no} · ${customer(q.customer).name}`} rows={[["ยืนราคาถึง", q.validUntil], ["ยอดรวมภาษี", baht(linesTotal(q.lines).gross)]]} />}
      fields={<ReasonField value={reason} onChange={setReason} label="เหตุที่ลูกค้าไม่ตกลง" placeholder="เช่น คู่แข่งให้ราคาต่ำกว่า" error={tried && bad ? SHORT : undefined} />}
    />
  );
}

/** อนุมัติขายเกินวงเงินเป็นรายใบ — ไม่มีใบรออนุมัติก็บอกว่าไม่มี */
export function ReleaseDialog({ no, onClose }: { no?: string; onClose: () => void }) {
  useData();
  const held = heldOrders();
  const [pick, setPick] = useState(no ?? held[0]?.no ?? "");
  const [note, setNote] = useState("");
  const [tried, setTried] = useState(false);
  const so = held.find((x) => x.no === pick);
  const gross = so ? linesTotal(so.lines).gross : 0;
  const v = so ? creditVerdict(so.customer, gross, so.no) : undefined;
  const bad = note.trim().length < 5;
  return (
    <ConfirmDialog
      open
      title="อนุมัติเครดิต"
      body={held.length === 0 ? "ตอนนี้ไม่มีใบสั่งขายที่รออนุมัติเครดิต" : "อนุมัติให้ใบนี้ส่งของได้ทั้งที่ยอดค้างเกินวงเงิน การอนุมัติบันทึกไว้กับใบพร้อมเหตุผล"}
      confirmLabel="อนุมัติ"
      disabled={!so}
      onCancel={onClose}
      onConfirm={() => {
        setTried(true);
        if (!so || bad) return;
        releaseOrder(so.no, note);
        notify(`อนุมัติเครดิตใบสั่งขาย ${so.no} แล้ว · ส่งของได้`);
        onClose();
      }}
      subject={
        so && v && (
          <Subject
            title={`${so.no} · ${customer(so.customer).name}`}
            rows={[["วงเงิน", baht(v.limit)], ["ยอดค้างเดิม", baht(v.used)], ["ใบนี้", baht(gross)], ["เกินวงเงิน", baht(Math.max(0, v.projected - v.limit))]]}
          />
        )
      }
      fields={
        held.length > 0 && (
          <>
            {held.length > 1 && (
              <Field label="ใบสั่งขาย">
                <Choice value={pick} onChange={setPick} options={held.map((x) => ({ value: x.no, label: `${x.no} · ${customer(x.customer).name}` }))} />
              </Field>
            )}
            <ReasonField value={note} onChange={setNote} label="เหตุผลที่อนุมัติ" placeholder="เช่น ลูกค้าโอนมัดจำแล้ว ชำระตรงเวลาตลอด" error={tried && bad ? SHORT : undefined} />
          </>
        )
      }
    />
  );
}

export function DeliveredDialog({ no, onClose }: { no: string; onClose: () => void }) {
  const d = delivery(no);
  const [date, setDate] = useState(TODAY);
  const [receivedBy, setReceivedBy] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  return (
    <ConfirmDialog
      open
      title="ยืนยันส่งถึงลูกค้า"
      body="บันทึกผู้เซ็นรับตามใบส่งของ หลังจากนี้ออกใบกำกับภาษีได้"
      confirmLabel="ยืนยันส่งถึง"
      onCancel={onClose}
      onConfirm={() => {
        const input = { date, receivedBy };
        const e = deliveredErrors(no, input);
        setErrors(e);
        if (has(e)) return;
        markDelivered(no, input);
        notify(`ยืนยันส่งถึง ${no} แล้ว · พร้อมออกใบกำกับภาษี`);
        onClose();
      }}
      subject={<Subject title={`${d.no} · ${customer(salesOrder(d.so).customer).name}`} rows={[["ออกเมื่อ", d.date], ["ปลายทาง", d.route], ["ผู้ขนส่ง", d.carrier]]} />}
      fields={
        <div className="grid grid-cols-2 gap-3">
          <Field label="วันที่ส่งถึง" error={errors.date}>
            <Input type="date" value={date} onChange={setDate} error={!!errors.date} />
          </Field>
          <Field label="ผู้รับของ" error={errors.receivedBy}>
            <Input value={receivedBy} onChange={setReceivedBy} placeholder="ชื่อผู้เซ็นรับ" error={!!errors.receivedBy} />
          </Field>
        </div>
      }
    />
  );
}

/** ออกใบกำกับภาษีจากใบส่งของที่ส่งถึงแล้ว — ออกแล้วแก้ไม่ได้ ผิดต้องออกใบลดหนี้ */
export function InvoiceDialog({ delivery: preset, onIssued, onClose }: { delivery?: string; onIssued: (no: string) => void; onClose: () => void }) {
  useData();
  const ready = readyToInvoice();
  const [pick, setPick] = useState(preset ?? ready[0]?.no ?? "");
  const [date, setDate] = useState(TODAY);
  const [errors, setErrors] = useState<Errors>({});
  const d = ready.find((x) => x.no === pick);
  const so = d ? salesOrder(d.so) : undefined;
  const c = so ? customer(so.customer) : undefined;
  // ตัวอย่างยอดก่อนออก: ของในใบส่งของ ในราคาที่ตกลงในใบสั่งขาย
  const preview = d && so ? linesTotal(d.lines.map((l) => ({ ...l, price: so.lines.find((x) => x.material === l.material)!.price }))) : undefined;
  return (
    <ConfirmDialog
      open
      title="ออกใบกำกับภาษี / ใบแจ้งหนี้"
      body={ready.length === 0 ? "ยังไม่มีใบส่งของที่ส่งถึงแล้วและรอออกใบกำกับ — ยืนยันส่งถึงก่อน" : "ออกแล้วแก้ไม่ได้ ถ้าผิดต้องออกใบลดหนี้ ครบกำหนดชำระนับจากวันที่ใบกำกับตามเงื่อนไขของลูกค้า"}
      confirmLabel="ออกใบกำกับภาษี"
      disabled={!d}
      onCancel={onClose}
      onConfirm={() => {
        const e = invoiceErrors(pick, date);
        setErrors(e);
        if (has(e)) return;
        const inv = issueInvoice(pick, date);
        notify(`ออกใบกำกับภาษี ${inv.no} แล้ว · ครบกำหนด ${inv.due}`);
        onIssued(inv.no);
      }}
      subject={
        d && so && c && preview && (
          <Subject
            title={`${c.name} · ${so.no}`}
            rows={[
              ["ใบส่งของ", `${d.no} (${d.lines.length} รายการ)`],
              ["ก่อนภาษี", money(preview.net)],
              ["ภาษีมูลค่าเพิ่ม 7%", money(preview.vat)],
              ["รวมทั้งสิ้น", money(preview.gross)],
              ["ครบกำหนด", `${addDays(date, termDays(c.terms))} (${c.terms})`],
            ]}
          />
        )
      }
      fields={
        ready.length > 0 && (
          <div className="grid grid-cols-[1.4fr_1fr] gap-3">
            <Field label="ใบส่งของ" error={errors.delivery}>
              <Choice value={pick} onChange={setPick} options={ready.map((x) => ({ value: x.no, label: `${x.no} · ${customer(salesOrder(x.so).customer).name}` }))} />
            </Field>
            <Field label="วันที่ใบกำกับ" error={errors.date}>
              <Input type="date" value={date} onChange={setDate} error={!!errors.date} />
            </Field>
          </div>
        )
      }
    />
  );
}

const dueLine = (inv: Billing) => {
  const cn = creditNotesOf(inv.no);
  return cn.length ? `${money(invoiceTotal(inv).gross)} หักลดหนี้ ${cn.map((n) => n.no).join(", ")}` : money(invoiceTotal(inv).gross);
};

export function PaymentDialog({ no, onPaid, onClose }: { no: string; onPaid: (no: string) => void; onClose: () => void }) {
  const inv = invoice(no);
  const [date, setDate] = useState(TODAY);
  const [method, setMethod] = useState(PAY_METHODS[0]);
  const [ref, setRef] = useState("");
  const [withheld, setWithheld] = useState(false);
  const [wht, setWht] = useState(String(suggestedWht(inv)));
  const [errors, setErrors] = useState<Errors>({});
  const bn = billingNoteOf(no);
  const whtValue = withheld ? Number(wht) : 0;
  return (
    <ConfirmDialog
      open
      title="รับชำระเงิน"
      body="รับเต็มยอดคงค้างของใบ ออกใบเสร็จรับเงินเลขถัดไป และคืนวงเงินให้ลูกค้า — ถ้าลูกค้าหักภาษี ณ ที่จ่าย (ค่าบริการ 3%) ใบนี้ยังถือว่าชำระครบ"
      confirmLabel="บันทึกรับชำระ"
      onCancel={onClose}
      onConfirm={() => {
        const input = { date, method, ref, wht: whtValue };
        const e = paymentErrors(no, input);
        setErrors(e);
        if (has(e)) return;
        const r = recordPayment(no, input);
        notify(`รับชำระ ${no} แล้ว · ออกใบเสร็จ ${r.no}`);
        onPaid(no);
      }}
      subject={
        <Subject
          title={`${inv.no} · ${customer(salesOrder(inv.so).customer).name}`}
          rows={[
            ["ตามใบกำกับ", dueLine(inv)],
            ["ครบกำหนด", inv.due],
            ...(bn ? ([["ใบวางบิล", `${bn.no} นัดชำระ ${bn.payOn}`]] as [string, string][]) : []),
            ...(whtValue > 0 ? ([["หัก ณ ที่จ่าย", `−${money(whtValue)}`]] as [string, string][]) : []),
            ["เงินที่รับ", <b key="due">{money(amountDue(inv) - whtValue)}</b>],
          ]}
        />
      }
      fields={
        <div className="grid grid-cols-2 gap-3">
          <Field label="วันที่รับเงิน" error={errors.date}>
            <Input type="date" value={date} onChange={setDate} error={!!errors.date} />
          </Field>
          <Field label="วิธีรับชำระ" error={errors.method}>
            <Choice value={method} onChange={setMethod} options={PAY_METHODS.map((m) => ({ value: m, label: m }))} />
          </Field>
          <label className="col-span-2 flex items-center gap-2 text-[12.5px] text-slate-600 dark:text-slate-300">
            <input type="checkbox" checked={withheld} onChange={() => setWithheld(!withheld)} className="size-3.5 accent-violet-600" />
            ลูกค้าหักภาษี ณ ที่จ่าย (ต้องได้หนังสือรับรองการหักภาษี 50 ทวิ)
          </label>
          {withheld && (
            <div className="col-span-2">
              <Field label="ภาษีหัก ณ ที่จ่าย (บาท)" error={errors.wht} hint={`3% ของยอดก่อนภาษี ${money(inv.net)} = ${money(suggestedWht(inv))}`}>
                <Input type="number" value={wht} onChange={setWht} error={!!errors.wht} />
              </Field>
            </div>
          )}
          {method !== "เงินสด" && (
            <div className="col-span-2">
              <Field label={method === "เช็ค" ? "เลขที่เช็ค / ธนาคาร" : "เลขอ้างอิงการโอน"} error={errors.ref}>
                <Input value={ref} onChange={setRef} placeholder={method === "เช็ค" ? "กรุงเทพ 0012345" : "ธ.กสิกรไทย 0922-1180"} error={!!errors.ref} />
              </Field>
            </div>
          )}
        </div>
      }
    />
  );
}


/** เช็คเด้งหรือบันทึกผิดใบ — ใบเสร็จถูกยกเลิกพร้อมเหตุผล ใบกำกับกลับเป็นค้างชำระ */
export function CancelPaymentDialog({ no, onClose }: { no: string; onClose: () => void }) {
  const inv = invoice(no);
  const r = inv.receipt;
  const [reason, setReason] = useState("");
  const [tried, setTried] = useState(false);
  const bad = reason.trim().length < 5;
  return (
    <ConfirmDialog
      open
      title="ยกเลิกใบเสร็จรับเงิน"
      body="เลขใบเสร็จไม่ถูกนำกลับมาใช้ ใบกำกับจะกลับเป็นค้างชำระและกินวงเงินของลูกค้าอีกครั้ง"
      confirmLabel="ยกเลิกใบเสร็จ"
      disabled={!r}
      onCancel={onClose}
      onConfirm={() => {
        setTried(true);
        if (bad || !r) return;
        cancelPayment(no, reason);
        notify(`ยกเลิกใบเสร็จ ${r.no} แล้ว · ${no} กลับเป็นค้างชำระ`);
        onClose();
      }}
      subject={
        r && (
          <Subject
            title={`${r.no} · ${customer(inv.customer).name}`}
            rows={[["อ้างใบกำกับ", no], ["รับเมื่อ", `${r.date} โดย${r.method}`], ["เงินที่รับ", money(r.amount)], ...(r.wht ? ([["หัก ณ ที่จ่าย", money(r.wht)]] as [string, string][]) : [])]}
          />
        )
      }
      fields={<ReasonField value={reason} onChange={setReason} label="เหตุผล" placeholder="เช่น เช็คคืน ธนาคารปฏิเสธการจ่าย" error={tried && bad ? SHORT : undefined} />}
    />
  );
}
