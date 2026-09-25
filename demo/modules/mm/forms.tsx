import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { ChevronDown, Printer } from "lucide-react";
import {
  APPROVERS, GRADE_MEANING, INFO_RECORDS, MADE_IN_HOUSE, MATERIALS, MATERIAL_GROUPS, MOVE_KINDS,
  PAYMENT_TERMS, PURCHASE_ORDERS, RECEIVABLE, INVOICEABLE, REQUESTERS, REVIEW_CRITERIA, TODAY, UNITS, VENDORS,
  addDays, addMaterial, addVendor, approvalProblem, approveRequisition, approverFor, baht, bestPriceFor, blockVendor, canCancel, canRelease,
  cancelPurchaseOrder, checkInvoice, closePurchaseOrder, convertRequisition, createPurchaseOrder, createRequisition,
  currentPeriod, gradeOf, invoicedValue, invoiceProblems, limitText, material, materialProblems, moveProblems,
  nextMaterialCode, nextOrderNo, nextReceiptNo, nextRequisitionNo, orderProblems, outstandingQty, poTotal,
  postGoodsReceipt, postStockMove, priceFrom, quoteProblems, receiptProblems, receivedQty, receivedValue,
  recordInvoice, recordVendorReview, rejectRequisition, releaseInvoice, requisitionProblems, requisitionValue,
  reviewProblems, reviewScore, saveQuote, sendPurchaseOrder, suggestedDeliveryScore, unblockVendor, unitLocked,
  updateMaterial, updatePurchaseOrder, updateRequisition, updateVendor, vendor, vendorProblems,
} from "./data";
import type {
  GoodsReceipt, Material, MoveKind, PoLine, PrLine, PurchaseOrder, Requisition, StockMove, SupplierInvoice,
  Vendor, VendorReview,
} from "./data";
import { GrDocument, MoveSlip, PoDocument, PrDocument } from "./documents";
import { Button, FIELD, Note, SURFACE } from "../ui";
import { ConfirmDialog, Field, FormModal, LineItems, newLine, notify, printDocument, totalsOf, useData } from "../kit";
import type { CatalogItem, LineItem } from "../kit";

/**
 * Every create, edit and workflow move the purchasing screens offer.
 *
 * The rules live in data.ts: each form asks the same `…Problems` function the
 * mutation checks, so what the form marks wrong is exactly what the save would
 * refuse, and the save cannot be reached with anything the form let through.
 */

export type PrintDoc =
  | { type: "pr"; pr: Requisition }
  | { type: "po"; po: PurchaseOrder }
  | { type: "gr"; gr: GoodsReceipt }
  | { type: "move"; move: StockMove };

export type Dialog =
  | { kind: "material"; material?: Material }
  | { kind: "vendor"; vendor?: Vendor }
  | { kind: "blockVendor"; vendor: Vendor }
  | { kind: "quote"; material?: string; vendor?: string }
  | { kind: "pr"; pr?: Requisition; lines?: PrLine[] }
  | { kind: "approvePr"; pr: Requisition }
  | { kind: "rejectPr"; pr: Requisition }
  | { kind: "convertPr"; pr: Requisition }
  | { kind: "po"; po?: PurchaseOrder; vendor?: string }
  | { kind: "sendPo"; po: PurchaseOrder }
  | { kind: "cancelPo"; po: PurchaseOrder }
  | { kind: "closePo"; po: PurchaseOrder }
  | { kind: "gr"; po?: PurchaseOrder }
  | { kind: "invoice"; po?: PurchaseOrder }
  | { kind: "release"; invoice: SupplierInvoice }
  | { kind: "move"; material?: string; moveKind?: MoveKind }
  | { kind: "review"; vendor?: string }
  | { kind: "print"; doc: PrintDoc };

/** Dialogs that sit on top of a record instead of replacing it — a question about the record, not a new task. */
export const CONFIRMS: Dialog["kind"][] = ["approvePr", "rejectPr", "sendPo", "cancelPo", "closePo", "release", "blockVendor"];

/* ------------------------------------------------------------ form bits */

export const num = (s: string) => (s.trim() === "" ? NaN : Number(s));
export const inputCls = (error?: string) => FIELD + " w-full " + (error ? "border-rose-400 dark:border-rose-500" : "");
const purchasable = () => MATERIALS.filter((m) => m.group !== MADE_IN_HOUSE);

/** A select whose value is a code and whose text is a name — the ui Select shows its value, which is the code. */
export function Choice({
  value,
  onChange,
  options,
  disabled,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
  error?: string;
}) {
  return (
    <span className="relative block">
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={inputCls(error) + " appearance-none pr-8 disabled:opacity-60"}
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

/** Declared out here so typing does not remount the input and lose the caret. */
export function Text({
  label,
  value,
  onChange,
  error,
  hint,
  placeholder,
  type = "text",
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  hint?: string;
  placeholder?: string;
  type?: "text" | "number" | "date";
  disabled?: boolean;
}) {
  return (
    <Field label={label} error={error} hint={hint}>
      <input
        type={type}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={inputCls(error) + (type === "number" ? " tabular-nums" : "") + " disabled:opacity-60"}
      />
    </Field>
  );
}

function Area({ label, value, onChange, error, hint, placeholder }: { label: string; value: string; onChange: (v: string) => void; error?: string; hint?: string; placeholder?: string }) {
  return (
    <Field label={label} error={error} hint={hint}>
      <textarea
        value={value}
        rows={3}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={inputCls(error) + " resize-none leading-relaxed"}
      />
    </Field>
  );
}

/** Kept reachable at the foot of a long form, the way the kit's Wizard keeps its actions. */
export function Footer({ onCancel, children }: { onCancel: () => void; children: ReactNode }) {
  return (
    <div className="sticky bottom-0 -mx-5 -mb-5 mt-5 flex items-center justify-between gap-3 border-t border-slate-100 bg-white px-5 py-3 dark:border-slate-800 dark:bg-slate-900">
      <Button variant="secondary" onClick={onCancel}>
        ยกเลิก
      </Button>
      <span className="flex items-center gap-2">{children}</span>
    </div>
  );
}

/** The document number the save will issue, shown before saving so nobody has to guess it. */
export function DocNo({ label, no, note }: { label: string; no: string; note?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 px-3.5 py-2.5 text-[12.5px] dark:bg-slate-800/50">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span className="font-mono font-semibold text-slate-900 dark:text-slate-50">{no}</span>
      {note && <span className="text-slate-400 dark:text-slate-500">· {note}</span>}
    </div>
  );
}

const toItems = (lines: PrLine[]): LineItem[] =>
  lines.map((l) => {
    const m = material(l.material);
    return { ...newLine(), code: l.material, name: m.name, unit: m.unit, qty: l.qty, price: l.price };
  });

const fromItems = (items: LineItem[]): PrLine[] => items.map((l) => ({ material: l.code, qty: l.qty, price: l.price }));

const approverOptions = APPROVERS.map((a) => ({ value: a.name, label: `${a.name} · ${a.role} · ${limitText(a)}` }));

const vendorOptions = (keep?: string) =>
  VENDORS.filter((v) => !v.blocked || v.code === keep).map((v) => ({ value: v.code, label: `${v.code} · ${v.name}${v.blocked ? " (ระงับ)" : ""}` }));

/* ----------------------------------------------------------- the dialogs */

/**
 * All of them, driven by one piece of state in the screen. `onDone` receives
 * what was saved so the screen can take the person to the next step: a draft
 * order opens so it can be sent, a goods receipt opens ready to print.
 */
export function MmDialogs({
  dialog,
  onClose,
  onSaved,
}: {
  dialog: Dialog | null;
  onClose: () => void;
  onSaved: (saved: { material?: Material; pr?: Requisition; po?: PurchaseOrder; gr?: GoodsReceipt; move?: StockMove }) => void;
}) {
  useData();
  const d = dialog;

  return (
    <>
      <FormModal
        open={d?.kind === "material"}
        title={d?.kind === "material" && d.material ? "แก้ไขข้อมูลวัสดุ" : "เพิ่มวัสดุ"}
        subtitle={d?.kind === "material" && d.material ? `${d.material.code} · ${d.material.name}` : "รหัสออกให้ตามกลุ่มวัสดุ คงเหลือเริ่มที่ศูนย์"}
        onClose={onClose}
      >
        {d?.kind === "material" && <MaterialForm m={d.material} onCancel={onClose} onDone={(m) => onSaved({ material: m })} />}
      </FormModal>

      <FormModal
        open={d?.kind === "vendor"}
        title={d?.kind === "vendor" && d.vendor ? "แก้ไขข้อมูลผู้ขาย" : "เพิ่มผู้ขาย"}
        subtitle={d?.kind === "vendor" && d.vendor ? `${d.vendor.code} · ${d.vendor.name}` : "ข้อมูลตามหนังสือรับรองและใบกำกับภาษี ใช้พิมพ์บนใบสั่งซื้อ"}
        onClose={onClose}
      >
        {d?.kind === "vendor" && <VendorForm v={d.vendor} onCancel={onClose} onDone={() => onSaved({})} />}
      </FormModal>

      <FormModal open={d?.kind === "quote"} title="บันทึกราคาที่ผู้ขายเสนอ" subtitle="ใช้เสนอราคาและผู้ขายตอนเปิดใบขอซื้อและใบสั่งซื้อ" onClose={onClose} size="sm">
        {d?.kind === "quote" && <QuoteForm initialMaterial={d.material} initialVendor={d.vendor} onCancel={onClose} onDone={() => onSaved({})} />}
      </FormModal>

      <FormModal
        open={d?.kind === "pr"}
        title={d?.kind === "pr" && d.pr ? "แก้ไขใบขอซื้อ" : "เปิดใบขอซื้อ"}
        subtitle={d?.kind === "pr" && d.pr ? `${d.pr.no} · แก้ได้จนกว่าจะอนุมัติ` : "ราคาเป็นราคาประมาณจากราคาดีที่สุดที่เคยได้ ใช้กำหนดผู้อนุมัติ"}
        onClose={onClose}
        size="lg"
      >
        {d?.kind === "pr" && <RequisitionForm pr={d.pr} preset={d.lines} onCancel={onClose} onDone={(pr) => onSaved({ pr })} />}
      </FormModal>

      <FormModal
        open={d?.kind === "po" || d?.kind === "convertPr"}
        title={d?.kind === "convertPr" ? "แปลงใบขอซื้อเป็นใบสั่งซื้อ" : d?.kind === "po" && d.po ? "แก้ไขใบสั่งซื้อ" : "สร้างใบสั่งซื้อ"}
        subtitle={
          d?.kind === "convertPr"
            ? `${d.pr.no} · ${d.pr.requester} · อนุมัติโดย ${d.pr.approvedBy}`
            : d?.kind === "po" && d.po
              ? `${d.po.no} · แก้ได้จนกว่าจะส่งผู้ขาย`
              : "บันทึกเป็นร่างก่อน ส่งผู้ขายเมื่อผู้มีอำนาจลงนาม"
        }
        onClose={onClose}
        size="lg"
      >
        {d?.kind === "po" && <OrderForm po={d.po} initialVendor={d.vendor} onCancel={onClose} onDone={(po) => onSaved({ po })} />}
        {d?.kind === "convertPr" && <OrderForm pr={d.pr} onCancel={onClose} onDone={(po) => onSaved({ po })} />}
      </FormModal>

      <FormModal open={d?.kind === "gr"} title="รับของตามใบสั่งซื้อ" subtitle="นับของจริงก่อนใส่จำนวน รับบางส่วนได้ ส่วนที่ค้างยังรอรับในใบเดิม" onClose={onClose} size="lg">
        {d?.kind === "gr" && <ReceiptForm po={d.po} onCancel={onClose} onDone={(gr) => onSaved({ gr })} />}
      </FormModal>

      <FormModal open={d?.kind === "invoice"} title="บันทึกใบแจ้งหนี้จากผู้ขาย" subtitle="ระบบตรวจสามทางให้ทันที ยอดเกินของที่รับจริงจะถูกระงับจ่าย" onClose={onClose}>
        {d?.kind === "invoice" && <InvoiceForm po={d.po} onCancel={onClose} onDone={() => onSaved({})} />}
      </FormModal>

      <FormModal open={d?.kind === "move"} title="เบิกและปรับยอดสต็อก" subtitle="ทุกรายการออกเลขที่เอกสารและบันทึกเหตุผลไว้ให้ตรวจย้อนหลัง" onClose={onClose}>
        {d?.kind === "move" && <MoveForm initialMaterial={d.material} initialKind={d.moveKind} onCancel={onClose} onDone={(move) => onSaved({ move })} />}
      </FormModal>

      <FormModal open={d?.kind === "review"} title="บันทึกผลประเมินผู้ขาย" subtitle="ให้คะแนน 1–5 สี่ด้าน ระบบคิดคะแนนเต็มร้อยและเกรดให้" onClose={onClose}>
        {d?.kind === "review" && <ReviewForm initialVendor={d.vendor} onCancel={onClose} onDone={() => onSaved({})} />}
      </FormModal>

      <FormModal
        open={d?.kind === "print"}
        title={d?.kind === "print" ? printTitle(d.doc) : ""}
        subtitle="ตัวอย่างก่อนพิมพ์ ขนาด A4"
        onClose={onClose}
        size="lg"
      >
        {d?.kind === "print" && <PrintPreview doc={d.doc} />}
      </FormModal>

      <ApproveDialog dialog={d?.kind === "approvePr" ? d : null} onClose={onClose} />
      <RejectDialog dialog={d?.kind === "rejectPr" ? d : null} onClose={onClose} />
      <SendDialog dialog={d?.kind === "sendPo" ? d : null} onClose={onClose} />
      <ReasonDialog
        open={d?.kind === "cancelPo"}
        title="ยกเลิกใบสั่งซื้อ"
        body="ยกเลิกแล้วใช้ใบนี้ต่อไม่ได้ ถ้ามาจากใบขอซื้อ ใบขอซื้อจะกลับไปรอหาผู้ขายใหม่"
        subject={d?.kind === "cancelPo" ? <PoSubject po={d.po} /> : null}
        locked={d?.kind === "cancelPo" && !canCancel(d.po) ? `${d.po.no} ${d.po.status} มีการรับของหรือวางบิลแล้ว ยกเลิกไม่ได้` : undefined}
        label="เหตุผลที่ยกเลิก"
        placeholder="เช่น ผู้ขายแจ้งว่าของหมด ไม่สามารถส่งได้"
        confirmLabel="ยกเลิกใบสั่งซื้อ"
        onClose={onClose}
        onConfirm={(reason) => {
          if (d?.kind !== "cancelPo") return;
          cancelPurchaseOrder(d.po.no, reason);
          notify(`ยกเลิกใบสั่งซื้อ ${d.po.no} แล้ว`, "warn");
          onClose();
        }}
      />
      <ReasonDialog
        open={d?.kind === "closePo"}
        title="ปิดยอดค้างรับ"
        body="ผู้ขายส่งส่วนที่เหลือไม่ได้ ปิดใบไว้ที่ยอดที่รับจริง ของที่ค้างจะไม่นับเป็นของที่กำลังมาอีก"
        subject={d?.kind === "closePo" ? <PoSubject po={d.po} showOutstanding /> : null}
        locked={d?.kind === "closePo" && d.po.status !== "รับของบางส่วน" ? `${d.po.no} ${d.po.status} ปิดยอดค้างรับได้เฉพาะใบที่รับของบางส่วน` : undefined}
        label="เหตุผลที่ปิดยอด"
        placeholder="เช่น ผู้ขายเลิกผลิตรุ่นนี้ ตกลงรับเท่าที่ส่งมา"
        confirmLabel="ปิดยอดค้างรับ"
        onClose={onClose}
        onConfirm={(reason) => {
          if (d?.kind !== "closePo") return;
          closePurchaseOrder(d.po.no, reason);
          notify(`ปิดยอดค้างรับของ ${d.po.no} แล้ว`);
          onClose();
        }}
      />
      <ReleaseDialog dialog={d?.kind === "release" ? d : null} onClose={onClose} />
      <BlockDialog dialog={d?.kind === "blockVendor" ? d : null} onClose={onClose} />
    </>
  );
}

const printTitle = (doc: PrintDoc) =>
  doc.type === "pr"
    ? "พิมพ์ใบขอซื้อ"
    : doc.type === "po"
      ? "พิมพ์ใบสั่งซื้อ"
      : doc.type === "gr"
        ? "พิมพ์ใบรับสินค้า"
        : doc.move.kind === "เบิกใช้"
          ? "พิมพ์ใบเบิกวัสดุ"
          : "พิมพ์ใบปรับปรุงสต็อก";

function PrintPreview({ doc }: { doc: PrintDoc }) {
  return (
    <PrintFrame>
      {doc.type === "pr" && <PrDocument pr={doc.pr} />}
      {doc.type === "po" && <PoDocument po={doc.po} />}
      {doc.type === "gr" && <GrDocument gr={doc.gr} />}
      {doc.type === "move" && <MoveSlip move={doc.move} />}
    </PrintFrame>
  );
}

/** A sheet on a grey desk with the print button above it — every print preview in the purchasing and warehouse screens. */
export function PrintFrame({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12px] text-slate-500 dark:text-slate-400">พิมพ์เฉพาะตัวเอกสาร ไม่รวมหน้าจอรอบ ๆ</p>
        <Button variant="primary" icon={<Printer size={14} />} onClick={printDocument}>
          พิมพ์
        </Button>
      </div>
      <div className="rounded-xl bg-slate-100 p-3 dark:bg-slate-800/60">{children}</div>
    </div>
  );
}

/* --------------------------------------------------------------- master */

function MaterialForm({ m, onDone, onCancel }: { m?: Material; onDone: (m: Material) => void; onCancel: () => void }) {
  const [name, setName] = useState(m?.name ?? "");
  const [group, setGroup] = useState(m?.group ?? MATERIAL_GROUPS[0]);
  const [unit, setUnit] = useState(m?.unit ?? UNITS[0]);
  const [price, setPrice] = useState(m ? String(m.price) : "");
  const [reorder, setReorder] = useState(m ? String(m.reorder) : "");
  const [safety, setSafety] = useState(m ? String(m.safety) : "");
  const [bin, setBin] = useState(m?.bin ?? "");
  const [tried, setTried] = useState(false);

  const input = { name, group, unit, price: num(price), reorder: num(reorder), safety: num(safety), bin: bin.trim().toUpperCase() };
  const problems = materialProblems(input, m?.code);
  const e = tried ? problems : {};
  const locked = m ? unitLocked(m.code) : false;
  // A finished good is what sales sells and production makes; moving a code in
  // or out of that group would pull it out from under their documents.
  const groups = m ? (m.group === MADE_IN_HOUSE ? [MADE_IN_HOUSE] : MATERIAL_GROUPS.filter((g) => g !== MADE_IN_HOUSE)) : MATERIAL_GROUPS;

  const save = () => {
    setTried(true);
    if (Object.keys(problems).length > 0) return;
    if (m) {
      updateMaterial(m.code, input);
      notify(`บันทึกการแก้ไข ${m.code} ${input.name.trim()} แล้ว`);
      onDone(m);
    } else {
      const created = addMaterial(input);
      notify(`เพิ่มวัสดุ ${created.code} ${created.name} แล้ว`);
      onDone(created);
    }
  };

  return (
    <div className="space-y-4">
      <DocNo label="รหัสวัสดุ" no={m ? m.code : nextMaterialCode(group)} note={m ? `คงเหลือ ${m.stock} ${m.unit}` : "ออกให้ตามกลุ่มที่เลือก"} />
      <Text label="ชื่อวัสดุ" value={name} onChange={setName} error={e.name} placeholder="เช่น เหล็กฉาก 40x40 มม." hint="ใส่ขนาดหรือรุ่นให้ครบ ฝ่ายจัดซื้อจะสั่งถูกตัว" />
      <div className="grid grid-cols-2 gap-3">
        <Field label="กลุ่มวัสดุ" error={e.group} hint={m ? "สินค้าสำเร็จรูปย้ายกลุ่มไม่ได้" : undefined}>
          <Choice value={group} onChange={setGroup} options={groups.map((g) => ({ value: g, label: g }))} />
        </Field>
        <Field label="หน่วยนับ" error={e.unit} hint={locked ? "มีของหรือเอกสารอ้างถึงแล้ว เปลี่ยนหน่วยไม่ได้" : undefined}>
          <Choice value={unit} onChange={setUnit} disabled={locked} options={UNITS.map((u) => ({ value: u, label: u }))} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Text label="ราคามาตรฐานต่อหน่วย (บาท)" type="number" value={price} onChange={setPrice} error={e.price} placeholder="0.00" hint="ใช้ตีมูลค่าสต็อก" />
        <Text label="ช่องเก็บ" value={bin} onChange={setBin} error={e.bin} placeholder="A-01-03" hint="พื้นที่-แถว-ช่อง" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Text label="จุดสั่งซื้อ" type="number" value={reorder} onChange={setReorder} error={e.reorder} hint="คงเหลือต่ำกว่านี้ ระบบเสนอให้เปิดใบขอซื้อ" />
        <Text label="สต็อกขั้นต่ำ" type="number" value={safety} onChange={setSafety} error={e.safety} hint="ต่ำกว่านี้ขึ้นเป็นรายการด่วน" />
      </div>
      {group === MADE_IN_HOUSE && !m && (
        <Note tone="warn">สินค้าสำเร็จรูปจะขึ้นในรายการขายและรายการผลิตทันที ต้องกำหนดสูตรการผลิตและราคาขายต่อในระบบนั้น</Note>
      )}
      <Footer onCancel={onCancel}>
        <Button variant="primary" onClick={save}>
          {m ? "บันทึกการแก้ไข" : "เพิ่มวัสดุ"}
        </Button>
      </Footer>
    </div>
  );
}

function VendorForm({ v, onDone, onCancel }: { v?: Vendor; onDone: () => void; onCancel: () => void }) {
  const [name, setName] = useState(v?.name ?? "");
  const [taxId, setTaxId] = useState(v?.taxId ?? "");
  const [contact, setContact] = useState(v?.contact ?? "");
  const [phone, setPhone] = useState(v?.phone ?? "");
  const [address, setAddress] = useState(v?.address ?? "");
  const [terms, setTerms] = useState(v?.terms ?? PAYMENT_TERMS[1]);
  const [leadDays, setLeadDays] = useState(v ? String(v.leadDays) : "7");
  const [tried, setTried] = useState(false);

  const input = { name, taxId: taxId.replace(/\D/g, ""), contact, phone: phone.trim(), address, terms, leadDays: num(leadDays) };
  const problems = vendorProblems(input, v?.code);
  const e = tried ? problems : {};

  const save = () => {
    setTried(true);
    if (Object.keys(problems).length > 0) return;
    if (v) {
      updateVendor(v.code, input);
      notify(`บันทึกการแก้ไขผู้ขาย ${v.code} แล้ว`);
    } else {
      const created = addVendor(input);
      notify(`เพิ่มผู้ขาย ${created.code} ${created.name} แล้ว`);
    }
    onDone();
  };

  return (
    <div className="space-y-4">
      <DocNo label="รหัสผู้ขาย" no={v ? v.code : "ออกให้เมื่อบันทึก"} />
      <Text label="ชื่อผู้ขาย" value={name} onChange={setName} error={e.name} placeholder="บจก. ตัวอย่างวัสดุ" />
      <div className="grid grid-cols-2 gap-3">
        <Text label="เลขประจำตัวผู้เสียภาษี" value={taxId} onChange={setTaxId} error={e.taxId} placeholder="0105560000000" hint="13 หลัก" />
        <Field label="เงื่อนไขชำระ" error={e.terms}>
          <Choice value={terms} onChange={setTerms} options={PAYMENT_TERMS.map((t) => ({ value: t, label: t }))} />
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Text label="ผู้ติดต่อ" value={contact} onChange={setContact} error={e.contact} placeholder="คุณสมชาย" />
        <Text label="โทรศัพท์" value={phone} onChange={setPhone} error={e.phone} placeholder="02-123-4567" />
        <Text label="เวลาส่งของ (วัน)" type="number" value={leadDays} onChange={setLeadDays} error={e.leadDays} />
      </div>
      <Area label="ที่อยู่ตามใบกำกับภาษี" value={address} onChange={setAddress} error={e.address} placeholder="เลขที่ ถนน แขวง/ตำบล เขต/อำเภอ จังหวัด รหัสไปรษณีย์" />
      <Footer onCancel={onCancel}>
        <Button variant="primary" onClick={save}>
          {v ? "บันทึกการแก้ไข" : "เพิ่มผู้ขาย"}
        </Button>
      </Footer>
    </div>
  );
}

function QuoteForm({ initialMaterial, initialVendor, onDone, onCancel }: { initialMaterial?: string; initialVendor?: string; onDone: () => void; onCancel: () => void }) {
  const [code, setCode] = useState(initialMaterial ?? purchasable()[0].code);
  const [vendorCode, setVendorCode] = useState(initialVendor ?? VENDORS[0].code);
  const existing = INFO_RECORDS.find((r) => r.material === code && r.vendor === vendorCode);
  const [price, setPrice] = useState(existing ? String(existing.price) : "");
  const [leadDays, setLeadDays] = useState(String(existing?.leadDays ?? vendor(vendorCode).leadDays));
  const [tried, setTried] = useState(false);

  const input = { material: code, vendor: vendorCode, price: num(price), leadDays: num(leadDays) };
  const problems = quoteProblems(input);
  const e = tried ? problems : {};
  const best = bestPriceFor(code);

  const save = () => {
    setTried(true);
    if (Object.keys(problems).length > 0) return;
    saveQuote(input);
    notify(`บันทึกราคา ${material(code).name} จาก${vendor(vendorCode).name} แล้ว`);
    onDone();
  };

  return (
    <div className="space-y-4">
      <Field label="วัสดุ" error={e.material}>
        <Choice value={code} onChange={setCode} options={purchasable().map((m) => ({ value: m.code, label: `${m.code} · ${m.name}` }))} />
      </Field>
      <Field label="ผู้ขาย" error={e.vendor}>
        <Choice value={vendorCode} onChange={setVendorCode} options={VENDORS.map((v) => ({ value: v.code, label: `${v.code} · ${v.name}` }))} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Text
          label={`ราคาต่อ${material(code).unit} (บาท)`}
          type="number"
          value={price}
          onChange={setPrice}
          error={e.price}
          hint={existing ? `ราคาเดิม ${baht(existing.price)} บันทึกแล้วจะแทนที่` : undefined}
        />
        <Text label="เวลาส่งของ (วัน)" type="number" value={leadDays} onChange={setLeadDays} error={e.leadDays} />
      </div>
      {best && <Note tone="idle">ราคาดีที่สุดตอนนี้ {baht(best.price)} จาก{vendor(best.vendor).name}</Note>}
      <Footer onCancel={onCancel}>
        <Button variant="primary" onClick={save}>
          บันทึกราคา
        </Button>
      </Footer>
    </div>
  );
}

/* ---------------------------------------------------------- requisition */

function RequisitionForm({ pr, preset, onDone, onCancel }: { pr?: Requisition; preset?: PrLine[]; onDone: (pr: Requisition) => void; onCancel: () => void }) {
  const [requester, setRequester] = useState(pr?.requester ?? REQUESTERS[0]);
  const [needBy, setNeedBy] = useState(pr?.needBy ?? addDays(TODAY, 7));
  const [note, setNote] = useState(pr?.note ?? "");
  const [items, setItems] = useState<LineItem[]>(() => {
    const lines = pr?.lines ?? preset;
    return lines && lines.length > 0 ? toItems(lines) : [newLine()];
  });
  const [tried, setTried] = useState(false);

  const input = { requester, needBy, note, lines: fromItems(items) };
  const problems = requisitionProblems(input);
  const e = tried ? problems : {};
  const value = requisitionValue(input);
  const route = approverFor(value);
  const catalog: CatalogItem[] = purchasable().map((m) => ({ code: m.code, name: m.name, unit: m.unit, price: bestPriceFor(m.code)?.price ?? m.price }));
  const locked = pr && pr.status !== "รออนุมัติ" ? `${pr.no} ${pr.status}แล้ว แก้ไขไม่ได้` : undefined;

  const save = () => {
    setTried(true);
    if (Object.keys(problems).length > 0 || locked) return;
    if (pr) {
      updateRequisition(pr.no, input);
      notify(`บันทึกการแก้ไขใบขอซื้อ ${pr.no} แล้ว`);
      onDone(pr);
    } else {
      const created = createRequisition(input);
      notify(`เปิดใบขอซื้อ ${created.no} แล้ว · รอ${approverFor(requisitionValue(created)).role}อนุมัติ`);
      onDone(created);
    }
  };

  return (
    <div className="space-y-4">
      <DocNo label="เลขที่ใบขอซื้อ" no={pr ? pr.no : nextRequisitionNo()} note={pr ? `เปิดเมื่อ ${pr.date}` : `วันที่ ${TODAY}`} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="หน่วยงานที่ขอซื้อ" error={e.requester}>
          <Choice value={requester} onChange={setRequester} options={REQUESTERS.map((r) => ({ value: r, label: r }))} />
        </Field>
        <Text label="ต้องการใช้ภายใน" type="date" value={needBy} onChange={setNeedBy} error={e.needBy} />
      </div>
      <LineItems lines={items} onChange={setItems} catalog={catalog} error={e.lines} />
      <Text label="หมายเหตุ" value={note} onChange={setNote} placeholder="เช่น ใช้กับงานซ่อมเครื่องตัด CNC" />
      <Note tone={locked ? "bad" : "accent"}>
        {locked ?? `มูลค่าก่อนภาษี ${baht(value)} · ต้องให้${route.role} (${route.name}) อนุมัติ ตาม${limitText(route)}`}
      </Note>
      <Footer onCancel={onCancel}>
        <Button variant="primary" onClick={save} disabled={locked !== undefined}>
          {pr ? "บันทึกการแก้ไข" : "บันทึกใบขอซื้อ"}
        </Button>
      </Footer>
    </div>
  );
}

function PrSubject({ pr }: { pr: Requisition }) {
  return (
    <div className={"p-3 text-left " + SURFACE}>
      <p className="text-[13px] font-medium text-slate-900 dark:text-slate-50">
        {pr.no} · {pr.requester}
      </p>
      <p className="mt-0.5 text-[11.5px] text-slate-500 dark:text-slate-400">
        {pr.lines.map((l) => `${material(l.material).name} ${l.qty} ${material(l.material).unit}`).join(" · ")}
      </p>
      <p className="mt-1 text-[12px] font-semibold tabular-nums text-slate-800 dark:text-slate-100">
        มูลค่าก่อนภาษี {baht(requisitionValue(pr))} · ต้องการภายใน {pr.needBy}
      </p>
    </div>
  );
}

function ApproveDialog({ dialog, onClose }: { dialog: { pr: Requisition } | null; onClose: () => void }) {
  const [who, setWho] = useState(APPROVERS[0].name);
  const value = dialog ? requisitionValue(dialog.pr) : 0;
  useEffect(() => {
    if (dialog) setWho(approverFor(requisitionValue(dialog.pr)).name);
  }, [dialog]);
  const problem = !dialog
    ? undefined
    : dialog.pr.status !== "รออนุมัติ"
      ? `${dialog.pr.no} ${dialog.pr.status}แล้ว`
      : approvalProblem(who, value);

  return (
    <ConfirmDialog
      open={dialog !== null}
      title="อนุมัติใบขอซื้อ"
      body="อนุมัติแล้วใบขอซื้อจะพร้อมแปลงเป็นใบสั่งซื้อ ผู้อนุมัติต้องมีวงเงินครอบคลุมมูลค่าของใบ"
      subject={dialog && <PrSubject pr={dialog.pr} />}
      fields={
        <Field label="ผู้อนุมัติ" error={problem}>
          <Choice value={who} onChange={setWho} options={approverOptions} error={problem} />
        </Field>
      }
      confirmLabel="อนุมัติใบขอซื้อ"
      disabled={problem !== undefined}
      onCancel={onClose}
      onConfirm={() => {
        if (!dialog) return;
        approveRequisition(dialog.pr.no, who);
        notify(`อนุมัติใบขอซื้อ ${dialog.pr.no} แล้ว · พร้อมแปลงเป็นใบสั่งซื้อ`);
        onClose();
      }}
    />
  );
}

function RejectDialog({ dialog, onClose }: { dialog: { pr: Requisition } | null; onClose: () => void }) {
  return (
    <ReasonDialog
      open={dialog !== null}
      title="ไม่อนุมัติใบขอซื้อ"
      body="ผู้ขอจะเห็นเหตุผลนี้ในใบขอซื้อ ถ้ายังต้องการของให้เปิดใบใหม่"
      subject={dialog && <PrSubject pr={dialog.pr} />}
      locked={dialog && dialog.pr.status !== "รออนุมัติ" ? `${dialog.pr.no} ${dialog.pr.status}แล้ว` : undefined}
      label="เหตุผลที่ไม่อนุมัติ"
      placeholder="เช่น ยังมีของในคลังพอใช้ถึงสิ้นเดือน"
      confirmLabel="ไม่อนุมัติ"
      onClose={onClose}
      onConfirm={(reason) => {
        if (!dialog) return;
        rejectRequisition(dialog.pr.no, reason);
        notify(`ไม่อนุมัติใบขอซื้อ ${dialog.pr.no}`, "warn");
        onClose();
      }}
    />
  );
}

/** A confirmation that must say why — cancel, close short, reject, block. */
export function ReasonDialog({
  open,
  title,
  body,
  subject,
  label,
  placeholder,
  confirmLabel,
  locked,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  body: string;
  subject: ReactNode;
  /** Why this move is not open to the record right now — shown instead of the field. */
  locked?: string;
  label: string;
  placeholder: string;
  confirmLabel: string;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  useEffect(() => {
    if (open) setReason("");
  }, [open]);
  const short = reason.trim().length < 5;

  return (
    <ConfirmDialog
      open={open}
      title={title}
      body={body}
      subject={subject}
      fields={
        locked ? (
          <Note tone="bad">{locked}</Note>
        ) : (
        <Field label={label} hint="อย่างน้อย 5 ตัวอักษร เก็บไว้ในประวัติของเอกสาร">
          <textarea
            value={reason}
            rows={3}
            placeholder={placeholder}
            onChange={(e) => setReason(e.target.value)}
            className={FIELD + " w-full resize-none leading-relaxed"}
          />
        </Field>
        )
      }
      confirmLabel={confirmLabel}
      disabled={short || locked !== undefined}
      onCancel={onClose}
      onConfirm={() => {
        if (!short && !locked) onConfirm(reason);
      }}
    />
  );
}

/* ---------------------------------------------------------------- order */

function OrderForm({
  po,
  pr,
  initialVendor,
  onDone,
  onCancel,
}: {
  po?: PurchaseOrder;
  pr?: Requisition;
  initialVendor?: string;
  onDone: (po: PurchaseOrder) => void;
  onCancel: () => void;
}) {
  const firstActive = VENDORS.find((v) => !v.blocked)?.code ?? VENDORS[0].code;
  const suggested = pr ? bestPriceFor(pr.lines[0].material)?.vendor : undefined;
  const startVendor = po?.vendor ?? initialVendor ?? (suggested && !vendor(suggested).blocked ? suggested : firstActive);
  const startDate = po?.date ?? TODAY;

  const [vendorCode, setVendorCode] = useState(startVendor);
  const [date, setDate] = useState(startDate);
  const [deliverBy, setDeliverBy] = useState(po?.deliverBy ?? addDays(startDate, vendor(startVendor).leadDays));
  const [note, setNote] = useState(po?.note ?? "");
  const [items, setItems] = useState<LineItem[]>(() => {
    if (po) return toItems(po.lines);
    if (pr) return toItems(pr.lines.map((l) => ({ ...l, price: priceFrom(startVendor, l.material) })));
    return [newLine()];
  });
  const [tried, setTried] = useState(false);

  const v = vendor(vendorCode);
  const lines: PoLine[] = fromItems(items);
  const input = { vendor: vendorCode, date, deliverBy, note, lines };
  const problems = orderProblems(input);
  const e = tried ? problems : {};
  const total = poTotal({ lines });
  const route = approverFor(total);
  const catalog: CatalogItem[] = purchasable().map((m) => ({ code: m.code, name: m.name, unit: m.unit, price: priceFrom(vendorCode, m.code) }));
  const locked =
    po && po.status !== "ร่าง"
      ? `${po.no} ${po.status} ส่งผู้ขายไปแล้ว แก้ไขไม่ได้`
      : pr && pr.status !== "อนุมัติแล้ว"
        ? `${pr.no} ${pr.status} แปลงเป็นใบสั่งซื้อได้เฉพาะใบที่อนุมัติแล้ว`
        : undefined;

  // Changing the vendor reprices the lines at what that vendor quoted and moves
  // the delivery date by its lead time — the two things a buyer re-keys by hand.
  const pickVendor = (code: string) => {
    setVendorCode(code);
    setItems((prev) => prev.map((l) => (l.code ? { ...l, price: priceFrom(code, l.code) } : l)));
    setDeliverBy(addDays(date, vendor(code).leadDays));
  };

  const save = () => {
    setTried(true);
    if (Object.keys(problems).length > 0 || locked) return;
    if (po) {
      updatePurchaseOrder(po.no, input);
      notify(`บันทึกการแก้ไขใบสั่งซื้อ ${po.no} แล้ว`);
      onDone(po);
    } else if (pr) {
      const created = convertRequisition(pr.no, input);
      notify(`แปลง ${pr.no} เป็นใบสั่งซื้อ ${created.no} แล้ว · ส่งผู้ขายได้เมื่อผู้มีอำนาจลงนาม`);
      onDone(created);
    } else {
      const created = createPurchaseOrder(input);
      notify(`บันทึกร่างใบสั่งซื้อ ${created.no} แล้ว`);
      onDone(created);
    }
  };

  return (
    <div className="space-y-4">
      <DocNo label="เลขที่ใบสั่งซื้อ" no={po ? po.no : nextOrderNo()} note={pr ? `อ้างอิง ${pr.no}` : po ? "ร่าง" : "บันทึกเป็นร่าง"} />
      <Field label="ผู้ขาย" error={e.vendor} hint={`${v.terms} · ส่งของภายใน ${v.leadDays} วัน · ผู้ติดต่อ ${v.contact} ${v.phone}`}>
        <Choice value={vendorCode} onChange={pickVendor} options={vendorOptions(po?.vendor)} error={e.vendor} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Text label="วันที่สั่ง" type="date" value={date} onChange={setDate} error={e.date} />
        <Text label="กำหนดส่งของ" type="date" value={deliverBy} onChange={setDeliverBy} error={e.deliverBy} hint="ใช้วัดว่าผู้ขายส่งตรงเวลาหรือไม่" />
      </div>
      <LineItems lines={items} onChange={setItems} catalog={catalog} error={e.lines} />
      <Text label="หมายเหตุถึงผู้ขาย" value={note} onChange={setNote} placeholder="เช่น ส่งของที่คลังบางพลี เวลา 08:00–16:00 น." />
      {pr && (
        <Note tone={total > requisitionValue(pr) ? "warn" : "idle"}>
          ใบขอซื้อประมาณไว้ {baht(requisitionValue(pr))} · ใบสั่งซื้อนี้ {baht(total)}
          {total > requisitionValue(pr) ? " สูงกว่าที่อนุมัติไว้ ผู้ลงนามจะเห็นส่วนต่างนี้" : ""}
        </Note>
      )}
      <Note tone={locked ? "bad" : "accent"}>
        {locked ?? `บันทึกเป็นร่าง แก้ได้จนกว่าจะส่ง · มูลค่าก่อนภาษี ${baht(total)} ต้องให้${route.role}ลงนามก่อนส่งผู้ขาย`}
      </Note>
      <Footer onCancel={onCancel}>
        <Button variant="primary" onClick={save} disabled={locked !== undefined}>
          {po ? "บันทึกการแก้ไข" : pr ? "สร้างใบสั่งซื้อ" : "บันทึกร่างใบสั่งซื้อ"}
        </Button>
      </Footer>
    </div>
  );
}

function PoSubject({ po, showOutstanding }: { po: PurchaseOrder; showOutstanding?: boolean }) {
  return (
    <div className={"p-3 text-left " + SURFACE}>
      <p className="text-[13px] font-medium text-slate-900 dark:text-slate-50">
        {po.no} · {vendor(po.vendor).name}
      </p>
      <p className="mt-0.5 text-[11.5px] text-slate-500 dark:text-slate-400">
        {po.lines
          .map((l) =>
            showOutstanding
              ? `${material(l.material).name} ค้าง ${outstandingQty(po, l.material)} จาก ${l.qty}`
              : `${material(l.material).name} ${l.qty} ${material(l.material).unit}`
          )
          .join(" · ")}
      </p>
      <p className="mt-1 text-[12px] font-semibold tabular-nums text-slate-800 dark:text-slate-100">มูลค่าก่อนภาษี {baht(poTotal(po))}</p>
    </div>
  );
}

function SendDialog({ dialog, onClose }: { dialog: { po: PurchaseOrder } | null; onClose: () => void }) {
  const [who, setWho] = useState(APPROVERS[0].name);
  useEffect(() => {
    if (dialog) setWho(approverFor(poTotal(dialog.po)).name);
  }, [dialog]);
  const problem = !dialog
    ? undefined
    : dialog.po.status !== "ร่าง"
      ? `${dialog.po.no} ${dialog.po.status} ส่งผู้ขายไปแล้ว`
      : vendor(dialog.po.vendor).blocked
        ? `${vendor(dialog.po.vendor).name} ถูกระงับการสั่งซื้อ`
        : approvalProblem(who, poTotal(dialog.po));

  return (
    <ConfirmDialog
      open={dialog !== null}
      title="ส่งใบสั่งซื้อให้ผู้ขาย"
      body="ผู้มีอำนาจลงนามตามวงเงินก่อนส่ง ส่งแล้วแก้ไขไม่ได้ ของที่รับเข้าจะเทียบกับใบนี้"
      subject={dialog && <PoSubject po={dialog.po} />}
      fields={
        <Field label="ผู้ลงนาม" error={problem}>
          <Choice value={who} onChange={setWho} options={approverOptions} error={problem} />
        </Field>
      }
      confirmLabel="ลงนามและส่งผู้ขาย"
      disabled={problem !== undefined}
      onCancel={onClose}
      onConfirm={() => {
        if (!dialog) return;
        sendPurchaseOrder(dialog.po.no, who);
        notify(`ส่งใบสั่งซื้อ ${dialog.po.no} ให้${vendor(dialog.po.vendor).name}แล้ว`);
        onClose();
      }}
    />
  );
}

/* -------------------------------------------------------------- receipt */

function ReceiptForm({ po, onDone, onCancel }: { po?: PurchaseOrder; onDone: (gr: GoodsReceipt) => void; onCancel: () => void }) {
  const open = PURCHASE_ORDERS.filter((p) => RECEIVABLE.includes(p.status));
  const outstandingOf = (p: PurchaseOrder | undefined) =>
    Object.fromEntries((p?.lines ?? []).map((l) => [l.material, String(outstandingQty(p!, l.material))]));

  const [poNo, setPoNo] = useState(po?.no ?? open[0]?.no ?? "");
  const [date, setDate] = useState(TODAY);
  const [deliveryNote, setDeliveryNote] = useState("");
  const [receivedBy, setReceivedBy] = useState("ณัฐพล ทองดี");
  const [qty, setQty] = useState<Record<string, string>>(() => outstandingOf(PURCHASE_ORDERS.find((p) => p.no === (po?.no ?? open[0]?.no))));
  const [tried, setTried] = useState(false);

  const current = PURCHASE_ORDERS.find((p) => p.no === poNo);
  const input = {
    po: poNo,
    date,
    deliveryNote,
    receivedBy,
    lines: (current?.lines ?? []).map((l) => ({ material: l.material, qty: num(qty[l.material] ?? "0") })),
  };
  const problems = receiptProblems(input);
  const e = tried ? problems : {};

  const pickPo = (no: string) => {
    setPoNo(no);
    setQty(outstandingOf(PURCHASE_ORDERS.find((p) => p.no === no)));
  };

  const leftAfter = current
    ? current.lines.filter((l) => outstandingQty(current, l.material) - (num(qty[l.material] ?? "0") || 0) > 0).length
    : 0;

  const save = () => {
    setTried(true);
    if (Object.keys(problems).length > 0) return;
    const gr = postGoodsReceipt(input);
    const after = PURCHASE_ORDERS.find((p) => p.no === gr.po)!;
    notify(`รับของตาม ${gr.po} แล้ว · ออกใบรับสินค้า ${gr.no}${after.status === "รับของครบแล้ว" ? " · รับครบทั้งใบ" : ""}`);
    onDone(gr);
  };

  if (open.length === 0 && !po) {
    return (
      <div className="space-y-4">
        <Note tone="idle">ไม่มีใบสั่งซื้อที่รอรับของ ใบสั่งซื้อต้องส่งผู้ขายก่อนจึงรับของได้</Note>
        <Footer onCancel={onCancel}>
          <span />
        </Footer>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <DocNo label="เลขที่ใบรับสินค้า" no={nextReceiptNo()} note={`วันที่ ${date}`} />
      <Field label="ใบสั่งซื้อ" error={e.po}>
        <Choice
          value={poNo}
          onChange={pickPo}
          error={e.po}
          options={(current && !open.includes(current) ? [current, ...open] : open).map((p) => ({ value: p.no, label: `${p.no} · ${vendor(p.vendor).name} · ${p.status}` }))}
        />
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Text label="วันที่รับ" type="date" value={date} onChange={setDate} error={e.date} />
        <Text label="เลขที่ใบส่งของผู้ขาย" value={deliveryNote} onChange={setDeliveryNote} error={e.deliveryNote} placeholder="DN-..." />
        <Text label="ผู้ตรวจรับ" value={receivedBy} onChange={setReceivedBy} error={e.receivedBy} />
      </div>

      {current && (
        <div className={"overflow-hidden " + SURFACE}>
          <table className="w-full text-[13px]">
            <thead className="bg-slate-50/80 text-left text-[11.5px] text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
              <tr>
                <th className="px-3 py-2.5 font-medium">รายการ</th>
                <th className="px-3 py-2.5 text-right font-medium">สั่ง</th>
                <th className="px-3 py-2.5 text-right font-medium">รับแล้ว</th>
                <th className="px-3 py-2.5 text-right font-medium">ค้างรับ</th>
                <th className="w-32 px-3 py-2.5 text-right font-medium">รับครั้งนี้</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {current.lines.map((l) => {
                const m = material(l.material);
                const err = e["line:" + l.material];
                return (
                  <tr key={l.material}>
                    <td className="px-3 py-2">
                      <span className="block text-slate-900 dark:text-slate-50">{m.name}</span>
                      <span className="block font-mono text-[11px] text-slate-400">
                        {l.material} · ช่อง {m.bin}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-600 dark:text-slate-300">{l.qty}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-600 dark:text-slate-300">{receivedQty(current.no, l.material)}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium text-slate-900 dark:text-slate-50">
                      {outstandingQty(current, l.material)} {m.unit}
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={0}
                        value={qty[l.material] ?? ""}
                        onChange={(ev) => setQty((q) => ({ ...q, [l.material]: ev.target.value }))}
                        aria-label={`จำนวนที่รับ ${m.name}`}
                        className={inputCls(err) + " py-2 text-right tabular-nums"}
                      />
                      {err && <span className="mt-1 block text-right text-[11px] text-rose-600 dark:text-rose-400">{err}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-3 py-2.5 dark:border-slate-800">
            <span className="flex gap-1.5">
              <Button variant="ghost" onClick={() => setQty(outstandingOf(current))}>
                รับครบตามยอดค้าง
              </Button>
              <Button variant="ghost" onClick={() => setQty(Object.fromEntries(current.lines.map((l) => [l.material, "0"])))}>
                ล้างจำนวน
              </Button>
            </span>
            {e.lines ? (
              <span className="text-[11.5px] text-rose-600 dark:text-rose-400">{e.lines}</span>
            ) : (
              <span className="text-[11.5px] text-slate-500 dark:text-slate-400">
                {leftAfter === 0 ? "รับครั้งนี้แล้วครบทั้งใบ" : `รับครั้งนี้แล้วยังค้าง ${leftAfter} รายการ ใบสั่งซื้อเปิดรอรับต่อ`}
              </span>
            )}
          </div>
        </div>
      )}

      <Footer onCancel={onCancel}>
        <Button variant="primary" onClick={save}>
          บันทึกรับของ
        </Button>
      </Footer>
    </div>
  );
}

/* -------------------------------------------------------------- invoice */

function InvoiceForm({ po, onDone, onCancel }: { po?: PurchaseOrder; onDone: () => void; onCancel: () => void }) {
  const candidates = PURCHASE_ORDERS.filter((p) => INVOICEABLE.includes(p.status));
  const unbilled = (p: PurchaseOrder) => Math.max(0, receivedValue(p) - invoicedValue(p.no));
  const start = po ?? candidates.find((p) => unbilled(p) > 0) ?? candidates[0];

  const [poNo, setPoNo] = useState(start?.no ?? "");
  const [no, setNo] = useState("");
  const [date, setDate] = useState(TODAY);
  const [amount, setAmount] = useState(start ? String(unbilled(start)) : "");
  const [tried, setTried] = useState(false);

  const current = PURCHASE_ORDERS.find((p) => p.no === poNo);
  const input = { no, po: poNo, date, amount: num(amount) };
  const problems = invoiceProblems(input);
  const e = tried ? problems : {};
  const check = current && input.amount > 0 ? checkInvoice(current.no, input.amount) : null;
  const vat = totalsOf([{ qty: 1, price: input.amount > 0 ? input.amount : 0 }]);

  const pickPo = (next: string) => {
    setPoNo(next);
    const p = PURCHASE_ORDERS.find((x) => x.no === next);
    setAmount(p ? String(unbilled(p)) : "");
  };

  const save = () => {
    setTried(true);
    if (Object.keys(problems).length > 0) return;
    const inv = recordInvoice(input);
    if (inv.blocked) notify(`บันทึกใบแจ้งหนี้ ${inv.no} แล้ว · ระงับจ่ายเพราะยอดเกินของที่รับจริง`, "warn");
    else notify(`บันทึกใบแจ้งหนี้ ${inv.no} แล้ว · ตรวจสามทางผ่าน รอจ่ายตามเครดิต`);
    onDone();
  };

  return (
    <div className="space-y-4">
      <Field label="ใบสั่งซื้อ" error={e.po}>
        <Choice
          value={poNo}
          onChange={pickPo}
          error={e.po}
          options={candidates.map((p) => ({ value: p.no, label: `${p.no} · ${vendor(p.vendor).name} · ยังไม่วางบิล ${baht(unbilled(p))}` }))}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Text label="เลขที่ใบกำกับภาษีของผู้ขาย" value={no} onChange={setNo} error={e.no} placeholder="INV-88420" />
        <Text label="วันที่ในใบกำกับภาษี" type="date" value={date} onChange={setDate} error={e.date} />
      </div>
      <Text label="มูลค่าก่อนภาษีมูลค่าเพิ่ม (บาท)" type="number" value={amount} onChange={setAmount} error={e.amount} hint="ตามยอดในใบกำกับภาษี ไม่รวมภาษี" />

      {current && (
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "สั่ง", value: baht(poTotal(current)) },
            { label: "รับจริง", value: baht(receivedValue(current)) },
            { label: "วางบิลแล้ว", value: baht(invoicedValue(current.no)) },
            { label: "ใบนี้รวมภาษี", value: baht(vat.total) },
          ].map((c) => (
            <div key={c.label} className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/50">
              <div className="text-[11px] text-slate-500 dark:text-slate-400">{c.label}</div>
              <div className="mt-0.5 text-[13px] font-semibold tabular-nums text-slate-900 dark:text-slate-50">{c.value}</div>
            </div>
          ))}
        </div>
      )}

      {check && (
        <Note tone={check.ok ? "ok" : "bad"}>
          {check.ok
            ? `ตรวจสามทางผ่าน วางบิลรวม ${baht(check.billed)} เทียบของที่รับจริง ${baht(check.received)} ต่างไม่เกิน ${baht(check.tolerance)} ตั้งหนี้รอจ่ายตามเครดิต`
            : check.received === 0
              ? "ยังไม่มีการรับของตามใบสั่งซื้อนี้ บันทึกได้แต่จะถูกระงับจ่ายจนกว่าจะรับของ"
              : `วางบิลรวม ${baht(check.billed)} เกินของที่รับจริง ${baht(check.received)} อยู่ ${baht(check.over)} (ยอมให้ต่างได้ ${baht(check.tolerance)}) บันทึกได้แต่จะถูกระงับจ่าย`}
        </Note>
      )}

      <Footer onCancel={onCancel}>
        <Button variant="primary" onClick={save}>
          บันทึกใบแจ้งหนี้
        </Button>
      </Footer>
    </div>
  );
}

function ReleaseDialog({ dialog, onClose }: { dialog: { invoice: SupplierInvoice } | null; onClose: () => void }) {
  const inv = dialog?.invoice;
  const ok = inv ? canRelease(inv) : false;
  const check = inv ? checkInvoice(inv.po, 0) : null;

  return (
    <ConfirmDialog
      open={dialog !== null}
      title="ปลดระงับจ่าย"
      body={
        ok
          ? "ยอดวางบิลกลับมาตรงกับของที่รับจริงแล้ว ปลดแล้วฝ่ายบัญชีจ่ายตามเครดิตได้"
          : "สาเหตุยังไม่หมด ต้องรับของส่วนที่ขาดให้ครบ หรือให้ผู้ขายออกใบลดหนี้ก่อนจึงปลดได้"
      }
      subject={
        inv &&
        check && (
          <div className={"p-3 text-left " + SURFACE}>
            <p className="text-[13px] font-medium text-slate-900 dark:text-slate-50">
              {inv.no} · {vendor(inv.vendor).name}
            </p>
            <p className="mt-0.5 text-[11.5px] text-slate-500 dark:text-slate-400">{inv.blockReason}</p>
            <p className="mt-1 text-[12px] tabular-nums text-slate-700 dark:text-slate-200">
              ตอนนี้: วางบิล {baht(check.billed)} · รับจริง {baht(check.received)}
            </p>
          </div>
        )
      }
      confirmLabel="ปลดระงับจ่าย"
      disabled={!ok}
      onCancel={onClose}
      onConfirm={() => {
        if (!inv) return;
        releaseInvoice(inv.no);
        notify(`ปลดระงับจ่ายใบแจ้งหนี้ ${inv.no} แล้ว`);
        onClose();
      }}
    />
  );
}

/* ---------------------------------------------------------------- stock */

function MoveForm({ initialMaterial, initialKind, onDone, onCancel }: { initialMaterial?: string; initialKind?: MoveKind; onDone: (m: StockMove) => void; onCancel: () => void }) {
  const [kind, setKind] = useState<MoveKind>(initialKind ?? "เบิกใช้");
  const [code, setCode] = useState(initialMaterial ?? MATERIALS[0].code);
  const [qty, setQty] = useState("");
  const [department, setDepartment] = useState(REQUESTERS[0]);
  const [reason, setReason] = useState("");
  const [date, setDate] = useState(TODAY);
  const [tried, setTried] = useState(false);

  const m = material(code);
  const input = { kind, material: code, qty: num(qty), department, reason, date };
  const problems = moveProblems(input);
  const e = tried ? problems : {};
  const outward = kind !== "ปรับยอดเพิ่ม";
  const after = m.stock + (outward ? -1 : 1) * (input.qty > 0 ? input.qty : 0);

  const save = () => {
    setTried(true);
    if (Object.keys(problems).length > 0) return;
    const move = postStockMove(input);
    notify(`บันทึก${kind} ${m.name} ${Math.abs(move.qty)} ${m.unit} แล้ว · ${move.doc}`);
    onDone(move);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {MOVE_KINDS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={
              "rounded-lg border px-3 py-1.5 text-[12.5px] transition " +
              (k === kind
                ? "border-violet-300 bg-violet-50 font-medium text-violet-700 dark:border-violet-500/40 dark:bg-violet-500/15 dark:text-violet-200"
                : "border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-300")
            }
          >
            {k}
          </button>
        ))}
      </div>
      <Field label="วัสดุ" error={e.material}>
        <Choice value={code} onChange={setCode} options={MATERIALS.map((x) => ({ value: x.code, label: `${x.code} · ${x.name} · คงเหลือ ${x.stock} ${x.unit}` }))} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Text label={`จำนวน (${m.unit})`} type="number" value={qty} onChange={setQty} error={e.qty} />
        <Text label="วันที่" type="date" value={date} onChange={setDate} error={e.date} />
      </div>
      {kind === "เบิกใช้" && (
        <Field label="หน่วยงานที่เบิก" error={e.department}>
          <Choice value={department} onChange={setDepartment} options={REQUESTERS.map((r) => ({ value: r, label: r }))} />
        </Field>
      )}
      <Text
        label={kind === "เบิกใช้" ? "เบิกไปใช้ทำอะไร" : "สาเหตุ"}
        value={reason}
        onChange={setReason}
        error={e.reason}
        placeholder={kind === "เบิกใช้" ? "เช่น ผลิตชั้นวางตามใบสั่งผลิต PO-P-3302" : kind === "ตัดของเสีย" ? "เช่น สีหมดอายุ เปิดใช้ไม่ได้" : "เช่น นับจริงไม่ตรงกับระบบ ตรวจแล้วพบบันทึกผิด"}
      />
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
          <div className="text-[11.5px] text-slate-500 dark:text-slate-400">คงเหลือตอนนี้</div>
          <div className="mt-1 text-[15px] font-semibold tabular-nums text-slate-900 dark:text-slate-50">
            {m.stock} {m.unit}
          </div>
        </div>
        <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
          <div className="text-[11.5px] text-slate-500 dark:text-slate-400">หลังบันทึก</div>
          <div
            className={
              "mt-1 text-[15px] font-semibold tabular-nums " +
              (after < 0 ? "text-rose-600 dark:text-rose-400" : after < m.reorder ? "text-amber-700 dark:text-amber-400" : "text-slate-900 dark:text-slate-50")
            }
          >
            {after} {m.unit}
            {after >= 0 && after < m.reorder && <span className="ml-1.5 text-[11px] font-normal">ต่ำกว่าจุดสั่งซื้อ</span>}
          </div>
        </div>
      </div>
      <Footer onCancel={onCancel}>
        <Button variant="primary" onClick={save}>
          {kind === "เบิกใช้" ? "บันทึกใบเบิกวัสดุ" : `บันทึก${kind}`}
        </Button>
      </Footer>
    </div>
  );
}

/* --------------------------------------------------------------- review */

/** The period being closed and the one before it — a late review still has somewhere to go. */
function periods() {
  const now = currentPeriod();
  const [q, y] = now.replace("ไตรมาส ", "").split("/").map(Number);
  const prev = q === 1 ? `ไตรมาส 4/${y - 1}` : `ไตรมาส ${q - 1}/${y}`;
  return [now, prev];
}

function ScorePicker({ value, onChange, error }: { value: number; onChange: (n: number) => void; error?: string }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          aria-label={`${n} คะแนน`}
          className={
            "grid size-9 place-items-center rounded-lg border text-[13px] font-medium tabular-nums transition " +
            (n === value
              ? "border-violet-400 bg-violet-600 text-white dark:border-violet-400"
              : error
                ? "border-rose-300 text-slate-600 hover:bg-slate-50 dark:border-rose-500/50 dark:text-slate-300 dark:hover:bg-slate-800"
                : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800")
          }
        >
          {n}
        </button>
      ))}
    </div>
  );
}

function ReviewForm({ initialVendor, onDone, onCancel }: { initialVendor?: string; onDone: (r: VendorReview) => void; onCancel: () => void }) {
  const [vendorCode, setVendorCode] = useState(initialVendor ?? VENDORS[0].code);
  const [period, setPeriod] = useState(periods()[0]);
  const [scores, setScores] = useState<Record<(typeof REVIEW_CRITERIA)[number]["key"], number>>(() => ({
    quality: 0,
    delivery: suggestedDeliveryScore(initialVendor ?? VENDORS[0].code) ?? 0,
    price: 0,
    service: 0,
  }));
  const [note, setNote] = useState("");
  const [by, setBy] = useState(APPROVERS[1].name);
  const [tried, setTried] = useState(false);

  const input = { vendor: vendorCode, period, ...scores, note, by };
  const problems = reviewProblems(input);
  const e = tried ? problems : {};
  const complete = REVIEW_CRITERIA.every((c) => scores[c.key] > 0);
  const score = reviewScore(scores);
  const grade = gradeOf(score);
  const hint = suggestedDeliveryScore(vendorCode);

  const pickVendor = (code: string) => {
    setVendorCode(code);
    setScores((s) => ({ ...s, delivery: suggestedDeliveryScore(code) ?? s.delivery }));
  };

  const save = () => {
    setTried(true);
    if (Object.keys(problems).length > 0) return;
    const r = recordVendorReview(input);
    notify(`บันทึกผลประเมิน ${vendor(r.vendor).name} ${r.period} แล้ว · เกรด ${gradeOf(reviewScore(r))}`);
    onDone(r);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="ผู้ขาย" error={e.vendor}>
          <Choice value={vendorCode} onChange={pickVendor} error={e.vendor} options={VENDORS.map((v) => ({ value: v.code, label: `${v.code} · ${v.name}` }))} />
        </Field>
        <Field label="งวดประเมิน">
          <Choice value={period} onChange={setPeriod} options={periods().map((p) => ({ value: p, label: p }))} />
        </Field>
      </div>
      <div className={"divide-y divide-slate-100 dark:divide-slate-800 " + SURFACE}>
        {REVIEW_CRITERIA.map((c) => (
          <div key={c.key} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <span>
              <span className="block text-[13px] font-medium text-slate-800 dark:text-slate-100">{c.label}</span>
              {c.key === "delivery" && hint !== null && (
                <span className="block text-[11.5px] text-slate-400">ประวัติส่งตรงเวลาและส่งครบชี้ที่ {hint} คะแนน</span>
              )}
              {e[c.key] && <span className="block text-[11.5px] text-rose-600 dark:text-rose-400">{e[c.key]}</span>}
            </span>
            <ScorePicker value={scores[c.key]} onChange={(n) => setScores((s) => ({ ...s, [c.key]: n }))} error={e[c.key]} />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="ผู้ประเมิน" error={e.by}>
          <Choice value={by} onChange={setBy} options={APPROVERS.map((a) => ({ value: a.name, label: `${a.name} · ${a.role}` }))} />
        </Field>
        <Text label="ข้อสังเกต" value={note} onChange={setNote} placeholder="เช่น ใบกำกับภาษีมาช้า" />
      </div>
      <Note tone={!complete ? "idle" : grade === "A" ? "ok" : grade === "B" ? "warn" : "bad"}>
        {complete ? (
          <>
            คะแนน <b>{score}</b> จาก 100 · เกรด <b>{grade}</b> — {GRADE_MEANING[grade]}
          </>
        ) : (
          "ให้คะแนนครบสี่ด้านแล้วระบบจะคิดเกรดให้"
        )}
      </Note>
      <Footer onCancel={onCancel}>
        <Button variant="primary" onClick={save}>
          บันทึกผลประเมิน
        </Button>
      </Footer>
    </div>
  );
}

function BlockDialog({ dialog, onClose }: { dialog: { vendor: Vendor } | null; onClose: () => void }) {
  const v = dialog?.vendor;
  const open = PURCHASE_ORDERS.filter((p) => v && p.vendor === v.code && RECEIVABLE.includes(p.status));
  if (v?.blocked) {
    return (
      <ConfirmDialog
        open
        title="ยกเลิกการระงับผู้ขาย"
        body="ยกเลิกแล้วเลือกผู้ขายรายนี้ในใบสั่งซื้อใหม่ได้ตามปกติ"
        subject={
          <div className={"p-3 text-left " + SURFACE}>
            <p className="text-[13px] font-medium text-slate-900 dark:text-slate-50">{v.name}</p>
            <p className="mt-0.5 text-[11.5px] text-slate-500 dark:text-slate-400">ระงับไว้เพราะ {v.blockReason}</p>
          </div>
        }
        confirmLabel="ยกเลิกการระงับ"
        onCancel={onClose}
        onConfirm={() => {
          unblockVendor(v.code);
          notify(`ยกเลิกการระงับ ${v.name} แล้ว`);
          onClose();
        }}
      />
    );
  }
  return (
    <ReasonDialog
      open={dialog !== null}
      title="ระงับการสั่งซื้อกับผู้ขาย"
      body={
        open.length > 0
          ? `ใบสั่งซื้อใหม่จะเลือกรายนี้ไม่ได้ ใบที่ส่งไปแล้ว ${open.length} ใบยังรับของได้ตามปกติ`
          : "ใบสั่งซื้อใหม่จะเลือกผู้ขายรายนี้ไม่ได้ จนกว่าจะยกเลิกการระงับ"
      }
      subject={
        v && (
          <div className={"p-3 text-left " + SURFACE}>
            <p className="text-[13px] font-medium text-slate-900 dark:text-slate-50">{v.name}</p>
            <p className="mt-0.5 text-[11.5px] text-slate-500 dark:text-slate-400">
              {v.code} · {v.terms} · เลขผู้เสียภาษี {v.taxId}
            </p>
          </div>
        )
      }
      label="เหตุผลที่ระงับ"
      placeholder="เช่น ผลประเมินเกรด C สองงวดติด ส่งของไม่ครบซ้ำ"
      confirmLabel="ระงับผู้ขาย"
      onClose={onClose}
      onConfirm={(reason) => {
        if (!v) return;
        blockVendor(v.code, reason);
        notify(`ระงับการสั่งซื้อกับ${v.name}แล้ว`, "warn");
        onClose();
      }}
    />
  );
}

/** Badge text and tone for a supplier invoice — the three states accounting acts on. */
export function invoiceBadge(inv: SupplierInvoice): { label: string; tone: "ok" | "bad" | "warn" | "idle" } {
  if (inv.paid) return { label: "จ่ายแล้ว", tone: "ok" };
  if (inv.blocked) return canRelease(inv) ? { label: "ระงับจ่าย · ปลดได้แล้ว", tone: "warn" } : { label: "ระงับจ่าย", tone: "bad" };
  return { label: "รอจ่าย", tone: "idle" };
}


