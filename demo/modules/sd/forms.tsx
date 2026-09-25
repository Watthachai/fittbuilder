import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { material } from "../mm/data";
import { Badge, Button, Note, Segmented, SURFACE } from "../ui";
import { Field, FormModal, LineItems, money, newLine, notify, useData } from "../kit";
import type { LineItem } from "../kit";
import {
  BILLINGS, CATALOG, CUSTOMERS, CARRIERS, SALES_ORDERS, TERMS, TODAY, VOLUME_BREAKS, addDays, adjustCredit,
  amountDue, baht, billableInvoices, billingNoteErrors, canShip, changePrice, conditionValue, createBillingNote,
  createCreditNote, createCustomer, createDelivery, createQuotation, createSalesOrder, creditErrors,
  creditNoteErrors, creditVerdict, customer, customerErrors, customerProfileErrors, deliveryErrors, exposureOf,
  fullyShipped, invoice, invoiceLines, invoiceTotal, linesTotal, openLines, orderErrors, peekNo, priceErrors,
  quotation, quoteErrors, rulePrice, salesOrder, updateCustomer, updateQuotation, updateSalesOrder,
} from "./data";
import type { CreditNoteKind, Errors, OrderLine, PriceKind } from "./data";
import { CHANNELS, Choice, FormFoot, Input, pct } from "./parts";

/**
 * ฟอร์มที่สร้างและแก้เอกสาร. ทุกฟอร์มตรวจด้วยฟังก์ชัน …Errors ของ data.ts ก่อนบันทึก
 * กฎเดียวกับที่ฟังก์ชันบันทึกบังคับ — หน้าจอจึงบอกช่องที่ผิดได้ แทนที่จะรอให้ล้ม
 */

const has = (e: Errors) => Object.keys(e).length > 0;
const customerOptions = () => CUSTOMERS.map((c) => ({ value: c.code, label: `${c.code} · ${c.name}` }));

/* ============================================================== customer */

export function CustomerFormModal({
  code,
  onSaved,
  onClose,
}: {
  code?: string;
  onSaved: (code: string) => void;
  onClose: () => void;
}) {
  const was = code ? customer(code) : undefined;
  const [name, setName] = useState(was?.name ?? "");
  const [contact, setContact] = useState(was?.contact ?? "");
  const [phone, setPhone] = useState(was?.phone ?? "");
  const [channel, setChannel] = useState(was?.channel ?? CHANNELS[0]);
  const [taxId, setTaxId] = useState(was?.taxId ?? "");
  const [branchMode, setBranchMode] = useState(was && was.branch !== "สำนักงานใหญ่" ? "สาขา" : "สำนักงานใหญ่");
  const [branchNo, setBranchNo] = useState(was && was.branch !== "สำนักงานใหญ่" ? was.branch.replace("สาขาที่ ", "") : "");
  const [billingAddress, setBillingAddress] = useState(was?.billingAddress ?? "");
  const [address, setAddress] = useState(was?.address ?? "");
  const [terms, setTerms] = useState("เครดิต 30 วัน");
  const [limit, setLimit] = useState("300000");
  const [errors, setErrors] = useState<Errors>({});

  const save = () => {
    const profile = {
      name, contact, phone, channel, taxId: taxId.replace(/[-\s]/g, ""),
      branch: branchMode === "สำนักงานใหญ่" ? "สำนักงานใหญ่" : `สาขาที่ ${branchNo.trim()}`,
      billingAddress, address,
    };
    if (was) {
      const e = customerProfileErrors(profile, was.code);
      setErrors(e);
      if (has(e)) return;
      updateCustomer(was.code, profile);
      notify(`บันทึกแฟ้มลูกค้า ${was.code} ${profile.name.trim()} แล้ว`);
      onSaved(was.code);
      return;
    }
    const input = { ...profile, terms, creditLimit: terms === "เงินสด" ? 0 : Number(limit) };
    const e = customerErrors(input);
    setErrors(e);
    if (has(e)) return;
    const c = createCustomer(input);
    notify(`เพิ่มลูกค้า ${c.code} ${c.name} แล้ว`);
    onSaved(c.code);
  };

  return (
    <FormModal
      open
      title={was ? `แก้ไขข้อมูลลูกค้า ${was.code}` : "เพิ่มลูกค้าใหม่"}
      subtitle="ข้อมูลตามหนังสือรับรองบริษัท ใช้พิมพ์ลงใบกำกับภาษีทุกใบ"
      onClose={onClose}
    >
      <div className="space-y-3">
        <Field label="ชื่อลูกค้า" error={errors.name}>
          <Input value={name} onChange={setName} placeholder="บจก. ตัวอย่างการค้า" error={!!errors.name} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="ช่องทางขาย" error={errors.channel} hint={`ส่วนลดช่องทางนี้ ${pct(conditionValue("ส่วนลดช่องทาง", channel, TODAY))}`}>
            <Choice value={channel} onChange={setChannel} options={CHANNELS.map((c) => ({ value: c, label: c }))} />
          </Field>
          <Field label="เลขประจำตัวผู้เสียภาษี" error={errors.taxId} hint="13 หลัก">
            <Input value={taxId} onChange={setTaxId} placeholder="0105561234567" error={!!errors.taxId} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="สำนักงาน" hint="ใบกำกับภาษีต้องระบุสำนักงานใหญ่หรือเลขสาขา">
            <Choice value={branchMode} onChange={setBranchMode} options={[{ value: "สำนักงานใหญ่", label: "สำนักงานใหญ่" }, { value: "สาขา", label: "สาขา" }]} />
          </Field>
          {branchMode === "สาขา" && (
            <Field label="เลขที่สาขา" error={errors.branch}>
              <Input value={branchNo} onChange={setBranchNo} placeholder="00001" error={!!errors.branch} />
            </Field>
          )}
        </div>
        <Field label="ที่อยู่ออกใบกำกับภาษี" error={errors.billingAddress}>
          <Input value={billingAddress} onChange={setBillingAddress} placeholder="เลขที่ ถนน ตำบล อำเภอ จังหวัด รหัสไปรษณีย์" error={!!errors.billingAddress} />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="จังหวัด" error={errors.address} hint="ใช้เป็นเส้นทางส่งของ">
            <Input value={address} onChange={setAddress} placeholder="ชลบุรี" error={!!errors.address} />
          </Field>
          <Field label="ผู้ติดต่อ" error={errors.contact}>
            <Input value={contact} onChange={setContact} placeholder="คุณสมศรี" error={!!errors.contact} />
          </Field>
          <Field label="โทรศัพท์" error={errors.phone}>
            <Input value={phone} onChange={setPhone} placeholder="02-123-4567" error={!!errors.phone} />
          </Field>
        </div>
        {was ? (
          <Note tone="idle">
            เงื่อนไขชำระ {was.terms} · วงเงิน {was.creditLimit ? baht(was.creditLimit) : "ขายเงินสด"} — ปรับได้ที่เมนูวงเงินเครดิตลูกค้า พร้อมเหตุผล
          </Note>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Field label="เงื่อนไขชำระ" error={errors.terms}>
              <Choice value={terms} onChange={setTerms} options={TERMS.map((t) => ({ value: t, label: t }))} />
            </Field>
            <Field label="วงเงินเครดิต (บาท)" error={errors.creditLimit} hint={terms === "เงินสด" ? "ลูกค้าเงินสดไม่มีวงเงิน" : "ยอดค้างเกินนี้ ใบสั่งขายจะรออนุมัติ"}>
              <Input type="number" value={terms === "เงินสด" ? "0" : limit} onChange={setLimit} disabled={terms === "เงินสด"} error={!!errors.creditLimit} />
            </Field>
          </div>
        )}
        <FormFoot>
          <Button variant="secondary" onClick={onClose}>ยกเลิก</Button>
          <Button variant="primary" onClick={save}>{was ? "บันทึกการแก้ไข" : "เพิ่มลูกค้า"}</Button>
        </FormFoot>
      </div>
    </FormModal>
  );
}

/* ================================================================ credit */

export function CreditFormModal({ code, onClose }: { code: string; onClose: () => void }) {
  useData();
  const c = customer(code);
  const [limit, setLimit] = useState(String(c.creditLimit));
  const [terms, setTerms] = useState(c.terms);
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const used = exposureOf(code);

  const save = () => {
    const input = { limit: Number(limit), terms, reason };
    const e = creditErrors(code, input);
    setErrors(e);
    if (has(e)) return;
    adjustCredit(code, input);
    notify(input.limit === 0 ? `เปลี่ยน ${c.name} เป็นขายเงินสดแล้ว` : `ปรับวงเงิน ${c.name} เป็น ${baht(input.limit)} แล้ว`);
    onClose();
  };

  return (
    <FormModal open title="ปรับวงเงินเครดิต" subtitle={`${c.code} · ${c.name}`} onClose={onClose} size="sm">
      <div className="space-y-3">
        <div className={"grid grid-cols-3 gap-2 p-3 text-center " + SURFACE}>
          {[
            ["วงเงินเดิม", c.creditLimit ? baht(c.creditLimit) : "เงินสด"],
            ["ยอดค้างตอนนี้", baht(used)],
            ["เงื่อนไขเดิม", c.terms],
          ].map(([k, v]) => (
            <div key={k}>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">{k}</p>
              <p className="text-[13px] font-semibold tabular-nums text-slate-900 dark:text-slate-50">{v}</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="วงเงินใหม่ (บาท)" error={errors.creditLimit} hint="ศูนย์คือขายเงินสดเท่านั้น">
            <Input type="number" value={limit} onChange={setLimit} error={!!errors.creditLimit} />
          </Field>
          <Field label="เงื่อนไขชำระ" error={errors.terms}>
            <Choice value={terms} onChange={setTerms} options={TERMS.map((t) => ({ value: t, label: t }))} />
          </Field>
        </div>
        {Number(limit) > 0 && used > Number(limit) && (
          <Note tone="warn">ยอดค้าง {baht(used)} เกินวงเงินใหม่ — ใบสั่งขายใบถัดไปของลูกค้ารายนี้จะรออนุมัติเครดิต</Note>
        )}
        <Field label="เหตุผล" error={errors.reason} hint="เก็บไว้ในประวัติการปรับวงเงิน">
          <Input value={reason} onChange={setReason} placeholder="เช่น ชำระตรงเวลาครบ 12 เดือน ยอดสั่งเพิ่ม" error={!!errors.reason} />
        </Field>
        <FormFoot>
          <Button variant="secondary" onClick={onClose}>ยกเลิก</Button>
          <Button variant="primary" onClick={save}>บันทึกวงเงิน</Button>
        </FormFoot>
      </div>
    </FormModal>
  );
}

/* ================================================================ prices */

const PRICE_KINDS: PriceKind[] = ["ราคาตั้ง", "ส่วนลดช่องทาง", "ส่วนลดตามจำนวน"];

const keysOf = (kind: PriceKind) =>
  kind === "ราคาตั้ง"
    ? CATALOG.map((p) => ({ value: p.code, label: `${p.code} · ${p.name}` }))
    : kind === "ส่วนลดช่องทาง"
      ? CHANNELS.map((c) => ({ value: c, label: c }))
      : VOLUME_BREAKS.map((b) => ({ value: String(b.minQty), label: `ตั้งแต่ ${b.minQty} หน่วยขึ้นไป` }));

/** ราคาเป็นบาท ส่วนลดกรอกเป็นเปอร์เซ็นต์ เก็บเป็นสัดส่วน */
const shown = (kind: PriceKind, v: number) => (kind === "ราคาตั้ง" ? String(v) : String(Math.round(v * 1000) / 10));
const stored = (kind: PriceKind, s: string) => (kind === "ราคาตั้ง" ? Number(s) : Number((Number(s) / 100).toFixed(4)));
export const conditionText = (kind: PriceKind, v: number) => (kind === "ราคาตั้ง" ? baht(v) : "ลด " + pct(v));

export function PriceFormModal({ priceKind, keyValue, onClose }: { priceKind?: PriceKind; keyValue?: string; onClose: () => void }) {
  useData();
  const [kind, setKind] = useState<PriceKind>(priceKind ?? "ราคาตั้ง");
  const [key, setKey] = useState(keyValue ?? keysOf(priceKind ?? "ราคาตั้ง")[0].value);
  const [effective, setEffective] = useState(TODAY);
  const [value, setValue] = useState(shown(priceKind ?? "ราคาตั้ง", conditionValue(priceKind ?? "ราคาตั้ง", keyValue ?? keysOf(priceKind ?? "ราคาตั้ง")[0].value, TODAY)));
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const current = conditionValue(kind, key, effective);
  const label = keysOf(kind).find((k) => k.value === key)?.label ?? key;

  const pickKind = (k: string) => {
    const next = k as PriceKind;
    const first = keysOf(next)[0].value;
    setKind(next);
    setKey(first);
    setValue(shown(next, conditionValue(next, first, effective)));
    setErrors({});
  };
  const pickKey = (k: string) => {
    setKey(k);
    setValue(shown(kind, conditionValue(kind, k, effective)));
  };

  const save = () => {
    const input = { kind, key, to: stored(kind, value), effective, reason };
    const e = priceErrors(input);
    setErrors(e);
    if (has(e)) return;
    const ch = changePrice(input);
    notify(`ประกาศ${kind} ${label} เป็น ${conditionText(kind, ch.to)} มีผล ${ch.effective} แล้ว`);
    onClose();
  };

  return (
    <FormModal open title="เปลี่ยนราคาและส่วนลด" subtitle="มีผลกับเอกสารที่ลงวันที่ตั้งแต่วันมีผล ใบที่ออกไปแล้วยังถือราคาเดิม" onClose={onClose}>
      <div className="space-y-3">
        <Segmented options={PRICE_KINDS} value={kind} onChange={pickKind} />
        <Field label="รายการ" error={errors.key}>
          <Choice value={key} onChange={pickKey} options={keysOf(kind)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="วันที่มีผล" error={errors.effective} hint="ย้อนหลังไม่ได้">
            <Input type="date" value={effective} onChange={setEffective} error={!!errors.effective} />
          </Field>
          <Field
            label={kind === "ราคาตั้ง" ? "ราคาตั้งใหม่ (บาท)" : "ส่วนลดใหม่ (%)"}
            error={errors.to}
            hint={`ค่าที่มีผล ณ วันนั้น ${conditionText(kind, current)}`}
          >
            <Input type="number" value={value} onChange={setValue} error={!!errors.to} />
          </Field>
        </div>
        <Field label="เหตุผล" error={errors.reason}>
          <Input value={reason} onChange={setReason} placeholder="เช่น ต้นทุนวัตถุดิบปรับขึ้น" error={!!errors.reason} />
        </Field>
        <FormFoot>
          <Button variant="secondary" onClick={onClose}>ยกเลิก</Button>
          <Button variant="primary" onClick={save}>ประกาศใช้</Button>
        </FormFoot>
      </div>
    </FormModal>
  );
}

/* ======================================================= orders & quotes */

const toLineItems = (lines: OrderLine[]): LineItem[] =>
  lines.map((l) => ({ ...newLine(), code: l.material, name: material(l.material).name, unit: material(l.material).unit, qty: l.qty, price: l.price }));

const toOrderLines = (lines: LineItem[]): OrderLine[] => lines.map((l) => ({ material: l.code, qty: l.qty, price: l.price }));

/**
 * ใบสั่งขายและใบเสนอราคาใช้ฟอร์มเดียวกัน. ราคาต่อหน่วยตามเงื่อนไขของลูกค้าและวันที่
 * ในเอกสาร และตามจำนวนเมื่อจำนวนเปลี่ยน — จนกว่าคนคีย์จะพิมพ์ราคาเอง บรรทัดนั้นจึงถือ
 * เป็นราคาพิเศษและไม่ถูกคิดทับอีก
 */
export function OrderFormModal({
  kind,
  no,
  customer: preset,
  quotation: fromQuote,
  onSaved,
  onClose,
}: {
  kind: "order" | "quote";
  no?: string;
  customer?: string;
  quotation?: string;
  onSaved: (no: string) => void;
  onClose: () => void;
}) {
  useData();
  const so = kind === "order" && no ? salesOrder(no) : undefined;
  const qt = kind === "quote" && no ? quotation(no) : undefined;
  const source = fromQuote ? quotation(fromQuote) : undefined;
  const editing = so ?? qt;

  const [cust, setCust] = useState(editing?.customer ?? source?.customer ?? preset ?? "");
  const [date, setDate] = useState(editing?.date ?? TODAY);
  const [until, setUntil] = useState(so?.shipBy ?? qt?.validUntil ?? addDays(TODAY, kind === "order" ? 7 : 30));
  const [po, setPo] = useState(so?.customerPo ?? "");
  const [note, setNote] = useState(so?.note ?? qt?.note ?? source?.note ?? "");
  const [lines, setLines] = useState<LineItem[]>(() => {
    const from = editing?.lines ?? source?.lines;
    return from ? toLineItems(from) : [newLine()];
  });
  const [errors, setErrors] = useState<Errors>({});

  const c = cust ? customer(cust) : undefined;
  // ก่อนเลือกลูกค้า ราคาคือราคาตั้ง — เลือกแล้วค่อยหักส่วนลดช่องทาง
  const channel = c?.channel ?? "ขายตรง";
  const rule = (code: string, qty: number, ch = channel, d = date) => rulePrice(code, qty, ch, d).net;
  const follows = (l: LineItem, ch = channel, d = date) => !l.code || l.price === rule(l.code, l.qty, ch, d);

  const onLines = (next: LineItem[]) =>
    setLines(
      next.map((l) => {
        const prev = lines.find((p) => p.key === l.key);
        if (!l.code) return l;
        // สินค้าใหม่ได้ราคาตามเงื่อนไขเสมอ · เปลี่ยนจำนวนคิดขั้นบันไดใหม่ถ้ายังไม่ได้ตั้งราคาพิเศษ
        // · พิมพ์ราคาเองคือราคาพิเศษ ปล่อยไว้ตามนั้น
        if (!prev || prev.code !== l.code) return { ...l, price: rule(l.code, l.qty) };
        if (prev.qty !== l.qty && follows(prev)) return { ...l, price: rule(l.code, l.qty) };
        return l;
      })
    );
  const reprice = (ch: string, d: string) =>
    setLines(lines.map((l) => (l.code && follows(l) ? { ...l, price: rule(l.code, l.qty, ch, d) } : l)));

  const catalog = CATALOG.map((p) => ({ code: p.code, name: p.name, unit: p.unit, price: rule(p.code, 1) }));
  const priced = lines.filter((l) => l.code);
  const total = linesTotal(toOrderLines(priced));
  const verdict = kind === "order" && c && total.gross > 0 ? creditVerdict(c.code, total.gross, so?.no) : undefined;

  const title = so
    ? `แก้ไขใบสั่งขาย ${so.no}`
    : qt
      ? `แก้ไขใบเสนอราคา ${qt.no}`
      : kind === "order"
        ? source ? `สร้างใบสั่งขายจากใบเสนอราคา ${source.no}` : "สร้างใบสั่งขาย"
        : "สร้างใบเสนอราคา";

  const save = (confirm: boolean) => {
    if (kind === "order") {
      const input = { customer: cust, date, shipBy: until, customerPo: po, note, lines: toOrderLines(lines) };
      const e = orderErrors(input);
      setErrors(e);
      if (has(e)) return;
      if (so) {
        const saved = updateSalesOrder(so.no, input);
        if (saved.status === "รออนุมัติเครดิต") notify(`บันทึกการแก้ไขใบสั่งขาย ${saved.no} แล้ว · เกินวงเงิน รออนุมัติเครดิต`, "warn");
        else notify(`บันทึกการแก้ไขใบสั่งขาย ${saved.no} แล้ว`);
        onSaved(saved.no);
        return;
      }
      const saved = createSalesOrder(input, { confirm, quotation: source?.no });
      const from = source ? ` จากใบเสนอราคา ${source.no}` : "";
      if (saved.status === "รออนุมัติเครดิต") notify(`บันทึกใบสั่งขาย ${saved.no}${from} แล้ว · เกินวงเงิน รออนุมัติเครดิต`, "warn");
      else if (saved.status === "รอยืนยัน") notify(`บันทึกร่างใบสั่งขาย ${saved.no}${from} แล้ว`);
      else notify(`บันทึกใบสั่งขาย ${saved.no}${from} แล้ว · ยืนยันกับลูกค้าแล้ว`);
      onSaved(saved.no);
      return;
    }
    const input = { customer: cust, date, validUntil: until, note, lines: toOrderLines(lines) };
    const e = quoteErrors(input);
    setErrors({ ...e, shipBy: e.validUntil });
    if (has(e)) return;
    const saved = qt ? updateQuotation(qt.no, input) : createQuotation(input);
    notify(qt ? `บันทึกการแก้ไขใบเสนอราคา ${saved.no} แล้ว` : `บันทึกใบเสนอราคา ${saved.no} แล้ว`);
    onSaved(saved.no);
  };

  return (
    <FormModal
      open
      size="lg"
      title={title}
      subtitle={
        editing
          ? "แก้ได้จนกว่าจะส่งของ ราคาที่พิมพ์เองจะถูกเก็บไว้ตามที่ตกลง"
          : `เลขที่ที่จะได้ ${peekNo(kind === "order" ? "SO" : "QT", date)} · ราคาคิดตามเงื่อนไขให้เอง แก้ราคาต่อหน่วยได้`
      }
      onClose={onClose}
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[1.4fr_1fr_1fr]">
          <Field label="ลูกค้า" error={errors.customer}>
            <Choice
              value={cust}
              onChange={(v) => {
                reprice(v ? customer(v).channel : "ขายตรง", date);
                setCust(v);
              }}
              options={customerOptions()}
              placeholder="เลือกลูกค้า…"
              disabled={!!editing || !!source}
              error={!!errors.customer}
            />
          </Field>
          <Field label="วันที่เอกสาร" error={errors.date}>
            <Input
              type="date"
              value={date}
              onChange={(v) => {
                reprice(channel, v);
                setDate(v);
              }}
              error={!!errors.date}
            />
          </Field>
          <Field label={kind === "order" ? "กำหนดส่ง" : "ยืนราคาถึง"} error={errors.shipBy}>
            <Input type="date" value={until} onChange={setUntil} error={!!errors.shipBy} />
          </Field>
        </div>

        {c && (
          <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-slate-500 dark:text-slate-400">
            <Badge tone="accent">{c.channel} ลด {pct(conditionValue("ส่วนลดช่องทาง", c.channel, date))}</Badge>
            <Badge tone="idle">{c.terms}</Badge>
            <Badge tone="idle">{c.branch}</Badge>
            <span className="ml-1">{c.billingAddress}</span>
          </div>
        )}

        <LineItems
          lines={lines}
          onChange={onLines}
          catalog={catalog}
          error={errors.lines}
          totals={{ subtotal: total.net, vat: total.vat, total: total.gross }}
        />

        {priced.length > 0 && (
          <div className={"overflow-x-auto " + SURFACE}>
            <p className="border-b border-slate-100 px-3 py-2 text-[12px] font-medium text-slate-600 dark:border-slate-800 dark:text-slate-300">
              ที่มาของราคา ณ {date}
            </p>
            <table className="w-full min-w-[640px] text-[12.5px]">
              <thead className="text-left text-[11px] text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-3 py-2 font-medium">สินค้า</th>
                  <th className="px-3 py-2 text-right font-medium">ราคาตั้ง</th>
                  <th className="px-3 py-2 text-right font-medium">ช่องทาง</th>
                  <th className="px-3 py-2 text-right font-medium">ตามจำนวน</th>
                  <th className="px-3 py-2 text-right font-medium">ตามเงื่อนไข</th>
                  <th className="px-3 py-2 text-right font-medium">ในใบนี้</th>
                  <th className="px-3 py-2 text-right font-medium">คงคลัง</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {priced.map((l) => {
                  const r = rulePrice(l.code, l.qty, channel, date);
                  const stock = material(l.code).stock;
                  return (
                    <tr key={l.key}>
                      <td className="px-3 py-2 text-slate-800 dark:text-slate-100">{l.name}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-500 dark:text-slate-400">{money(r.list)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-500 dark:text-slate-400">{r.chan ? "−" + pct(r.chan) : "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-500 dark:text-slate-400">{r.vol ? "−" + pct(r.vol) : "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-700 dark:text-slate-200">{money(r.net)}</td>
                      <td className="px-3 py-2 text-right">
                        {l.price === r.net ? (
                          <span className="tabular-nums text-slate-900 dark:text-slate-50">{money(l.price)}</span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5">
                            <Badge tone="warn">ราคาพิเศษ {money(l.price)}</Badge>
                            <button
                              type="button"
                              title="ใช้ราคาตามเงื่อนไข"
                              aria-label="ใช้ราคาตามเงื่อนไข"
                              onClick={() => setLines(lines.map((x) => (x.key === l.key ? { ...x, price: r.net } : x)))}
                              className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                            >
                              <RotateCcw size={12} />
                            </button>
                          </span>
                        )}
                      </td>
                      <td className={"px-3 py-2 text-right tabular-nums " + (l.qty > stock ? "text-amber-600 dark:text-amber-400" : "text-slate-500 dark:text-slate-400")}>
                        {stock} {material(l.code).unit}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {kind === "order" && (
            <Field label="เลขที่ใบสั่งซื้อของลูกค้า" hint="ถ้ามี จะพิมพ์อ้างในใบกำกับภาษี">
              <Input value={po} onChange={setPo} placeholder="PO-66-0912" />
            </Field>
          )}
          <Field label="หมายเหตุ">
            <Input value={note} onChange={setNote} placeholder={kind === "order" ? "เช่น ส่งก่อน 10 โมง" : "เช่น ราคารวมค่าขนส่ง"} />
          </Field>
        </div>

        {verdict &&
          (verdict.cash ? (
            <Note tone="idle">ลูกค้าเงินสด ไม่มีวงเงินให้ตรวจ — เก็บเงินพร้อมส่งของ</Note>
          ) : verdict.over ? (
            <Note tone="warn">
              ยอดค้าง {baht(verdict.used)} + ใบนี้ {baht(total.gross)} = {baht(verdict.projected)} เกินวงเงิน {baht(verdict.limit)} อยู่{" "}
              {baht(verdict.projected - verdict.limit)} — บันทึกได้ แต่ใบจะรออนุมัติเครดิตก่อนส่งของ
            </Note>
          ) : (
            <Note tone="ok">
              หลังบันทึกใบนี้ ใช้วงเงิน {baht(verdict.projected)} จาก {baht(verdict.limit)} เหลือ {baht(verdict.limit - verdict.projected)}
            </Note>
          ))}

        <FormFoot>
          <Button variant="secondary" onClick={onClose}>ยกเลิก</Button>
          {kind === "order" && !so ? (
            <>
              <Button variant="secondary" onClick={() => save(false)}>บันทึกร่าง</Button>
              <Button variant="primary" onClick={() => save(true)}>บันทึกและยืนยัน</Button>
            </>
          ) : (
            <Button variant="primary" onClick={() => save(false)}>
              {editing ? "บันทึกการแก้ไข" : "บันทึกใบเสนอราคา"}
            </Button>
          )}
        </FormFoot>
      </div>
    </FormModal>
  );
}

/* ============================================================== delivery */

const openQty = (soNo: string) => {
  const so = SALES_ORDERS.find((x) => x.no === soNo);
  return so ? openLines(so).map((l) => ({ material: l.material, qty: l.open })) : [];
};

export function DeliveryFormModal({ so: preset, onSaved, onClose }: { so?: string; onSaved: (no: string) => void; onClose: () => void }) {
  useData();
  const shippable = SALES_ORDERS.filter(canShip);
  const [soNo, setSoNo] = useState(preset ?? shippable[0]?.no ?? "");
  const [date, setDate] = useState(TODAY);
  const [route, setRoute] = useState(soNo ? customer(salesOrder(soNo).customer).address : "");
  const [carrier, setCarrier] = useState(CARRIERS[0]);
  const [lines, setLines] = useState(() => openQty(soNo));
  const [errors, setErrors] = useState<Errors>({});
  const so = SALES_ORDERS.find((x) => x.no === soNo);

  const pick = (no: string) => {
    setSoNo(no);
    setLines(openQty(no));
    setRoute(no ? customer(salesOrder(no).customer).address : "");
  };

  const save = () => {
    const input = { so: soNo, date, route, carrier, lines };
    const e = deliveryErrors(input);
    setErrors(e);
    if (has(e)) return;
    const d = createDelivery(input);
    notify(`เปิดใบส่งของ ${d.no} แล้ว · ${fullyShipped(salesOrder(d.so)) ? "ส่งครบตามใบสั่งขาย" : "ส่งบางส่วน ที่เหลือค้างส่งในใบสั่งขาย"}`);
    onSaved(d.no);
  };

  return (
    <FormModal open size="lg" title="เปิดใบส่งของ" subtitle="ส่งครบหรือส่งบางส่วนก็ได้ ส่วนที่เหลือค้างส่งอยู่ในใบสั่งขาย" onClose={onClose}>
      {shippable.length === 0 && !so ? (
        <div className="space-y-3">
          <Note tone="idle">ไม่มีใบสั่งขายที่ยืนยันแล้วและยังค้างส่ง — ใบร่างต้องยืนยัน และใบที่เกินวงเงินต้องอนุมัติเครดิตก่อน</Note>
          <FormFoot>
            <Button variant="secondary" onClick={onClose}>ปิด</Button>
          </FormFoot>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[1.5fr_1fr]">
            <Field label="ใบสั่งขาย" error={errors.so}>
              <Choice
                value={soNo}
                onChange={pick}
                options={shippable.map((x) => ({ value: x.no, label: `${x.no} · ${customer(x.customer).name}` }))}
                placeholder="เลือกใบสั่งขาย…"
                error={!!errors.so}
              />
            </Field>
            <Field label="วันที่ส่ง" error={errors.date}>
              <Input type="date" value={date} onChange={setDate} error={!!errors.date} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="ปลายทาง" error={errors.route}>
              <Input value={route} onChange={setRoute} error={!!errors.route} />
            </Field>
            <Field label="ผู้ขนส่ง" error={errors.carrier}>
              <Choice value={carrier} onChange={setCarrier} options={CARRIERS.map((x) => ({ value: x, label: x }))} />
            </Field>
          </div>
          {so && (
            <div className={"overflow-x-auto " + SURFACE}>
              <table className="w-full min-w-[600px] text-[13px]">
                <thead className="border-b border-slate-100 bg-slate-50/60 text-left text-[11.5px] text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
                  <tr>
                    <th className="px-3 py-2.5 font-medium">สินค้า</th>
                    <th className="px-3 py-2.5 text-right font-medium">สั่ง</th>
                    <th className="px-3 py-2.5 text-right font-medium">ส่งแล้ว</th>
                    <th className="px-3 py-2.5 text-right font-medium">ค้างส่ง</th>
                    <th className="px-3 py-2.5 text-right font-medium">คงคลัง</th>
                    <th className="w-32 px-3 py-2.5 text-right font-medium">ส่งครั้งนี้</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {openLines(so).map((l) => {
                    const m = material(l.material);
                    const qty = lines.find((x) => x.material === l.material)?.qty ?? 0;
                    return (
                      <tr key={l.material}>
                        <td className="px-3 py-2 text-slate-800 dark:text-slate-100">
                          {m.name} <span className="font-mono text-[11px] text-slate-400">{l.material}</span>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-600 dark:text-slate-300">{l.ordered}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-600 dark:text-slate-300">{l.shipped}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-medium text-slate-900 dark:text-slate-50">{l.open}</td>
                        <td className={"px-3 py-2 text-right tabular-nums " + (qty > m.stock ? "text-amber-600 dark:text-amber-400" : "text-slate-500 dark:text-slate-400")}>
                          {m.stock} {m.unit}
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            type="number"
                            value={String(qty)}
                            onChange={(v) => setLines(lines.map((x) => (x.material === l.material ? { ...x, qty: Number(v) } : x)))}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {errors.lines && <p className="px-3 py-2 text-[11.5px] text-rose-600 dark:text-rose-400">{errors.lines}</p>}
            </div>
          )}
          <FormFoot>
            <Button variant="ghost" onClick={() => setLines(openQty(soNo))} className="mr-auto">ส่งครบทุกรายการ</Button>
            <Button variant="secondary" onClick={onClose}>ยกเลิก</Button>
            <Button variant="primary" onClick={save}>บันทึกใบส่งของ</Button>
          </FormFoot>
        </div>
      )}
    </FormModal>
  );
}

/* =========================================================== credit note */

const KINDS: CreditNoteKind[] = ["รับคืนสินค้า", "ลดราคา"];

const creditRows = (invNo: string, kind: CreditNoteKind): OrderLine[] =>
  invNo ? invoiceLines(invoice(invNo)).map((l) => ({ material: l.material, qty: 0, price: kind === "รับคืนสินค้า" ? l.price : 0 })) : [];

export function CreditNoteFormModal({ invoice: preset, onSaved, onClose }: { invoice?: string; onSaved: (no: string) => void; onClose: () => void }) {
  useData();
  const options = [...BILLINGS].sort((a, b) => Number(a.paid) - Number(b.paid));
  const [invNo, setInvNo] = useState(preset ?? options[0]?.no ?? "");
  const [kind, setKind] = useState<CreditNoteKind>("รับคืนสินค้า");
  const [date, setDate] = useState(TODAY);
  const [reason, setReason] = useState("");
  const [lines, setLines] = useState<OrderLine[]>(() => creditRows(invNo, "รับคืนสินค้า"));
  const [errors, setErrors] = useState<Errors>({});
  const inv = invNo ? invoice(invNo) : undefined;
  const cut = linesTotal(lines.filter((l) => l.qty > 0));
  const set = (code: string, patch: Partial<OrderLine>) => setLines(lines.map((l) => (l.material === code ? { ...l, ...patch } : l)));

  const save = () => {
    const input = { invoice: invNo, date, kind, reason, lines };
    const e = creditNoteErrors(input);
    setErrors(e);
    if (has(e)) return;
    const cn = createCreditNote(input);
    notify(`ออกใบลดหนี้ ${cn.no} อ้างใบกำกับ ${cn.invoice} แล้ว`);
    onSaved(cn.no);
  };

  return (
    <FormModal open size="lg" title="ออกใบลดหนี้" subtitle="รับคืนสินค้าหรือลดราคาภายหลัง อ้างใบกำกับภาษีเดิมเสมอ" onClose={onClose}>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[1.6fr_1fr]">
          <Field label="อ้างใบกำกับภาษี" error={errors.invoice}>
            <Choice
              value={invNo}
              onChange={(v) => {
                setInvNo(v);
                setLines(creditRows(v, kind));
              }}
              options={options.map((b) => ({
                value: b.no,
                label: `${b.no} · ${customer(salesOrder(b.so).customer).name} · ${money(invoiceTotal(b).gross)}${b.paid ? " · เก็บเงินแล้ว" : ""}`,
              }))}
            />
          </Field>
          <Field label="วันที่ใบลดหนี้" error={errors.date}>
            <Input type="date" value={date} onChange={setDate} error={!!errors.date} />
          </Field>
        </div>
        <Segmented
          options={KINDS}
          value={kind}
          onChange={(k) => {
            setKind(k as CreditNoteKind);
            setLines(creditRows(invNo, k as CreditNoteKind));
          }}
        />
        {inv && (
          <div className={"overflow-x-auto " + SURFACE}>
            <table className="w-full min-w-[600px] text-[13px]">
              <thead className="border-b border-slate-100 bg-slate-50/60 text-left text-[11.5px] text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
                <tr>
                  <th className="px-3 py-2.5 font-medium">สินค้า</th>
                  <th className="px-3 py-2.5 text-right font-medium">ขายในใบ</th>
                  <th className="w-28 px-3 py-2.5 text-right font-medium">{kind === "รับคืนสินค้า" ? "รับคืน" : "จำนวนที่ลด"}</th>
                  <th className="w-32 px-3 py-2.5 text-right font-medium">{kind === "รับคืนสินค้า" ? "ราคาต่อหน่วย" : "ลดต่อหน่วย"}</th>
                  <th className="px-3 py-2.5 text-right font-medium">มูลค่าที่ลด</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {invoiceLines(inv).map((s) => {
                  const l = lines.find((x) => x.material === s.material) ?? { material: s.material, qty: 0, price: 0 };
                  return (
                    <tr key={s.material}>
                      <td className="px-3 py-2 text-slate-800 dark:text-slate-100">{material(s.material).name}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-500 dark:text-slate-400">
                        {s.qty} × {money(s.price)}
                      </td>
                      <td className="px-3 py-2">
                        <Input type="number" value={String(l.qty)} onChange={(v) => set(s.material, { qty: Number(v) })} />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          value={String(l.price)}
                          onChange={(v) => set(s.material, { price: Number(v) })}
                          disabled={kind === "รับคืนสินค้า"}
                        />
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-900 dark:text-slate-50">{money(l.qty * l.price)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {errors.lines && <p className="px-3 py-2 text-[11.5px] text-rose-600 dark:text-rose-400">{errors.lines}</p>}
            <dl className="ml-auto max-w-xs space-y-1 border-t border-slate-100 px-3 py-3 text-[13px] dark:border-slate-800">
              <div className="flex justify-between text-slate-500 dark:text-slate-400"><dt>ลดก่อนภาษี</dt><dd className="tabular-nums">{money(cut.net)}</dd></div>
              <div className="flex justify-between text-slate-500 dark:text-slate-400"><dt>ภาษีมูลค่าเพิ่ม</dt><dd className="tabular-nums">{money(cut.vat)}</dd></div>
              <div className="flex justify-between font-semibold text-slate-900 dark:text-slate-50"><dt>ลดหนี้รวม</dt><dd className="tabular-nums">{money(cut.gross)}</dd></div>
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <dt>ยอดตามใบกำกับหลังลดหนี้</dt>
                <dd className="tabular-nums">{money(amountDue(inv) - cut.gross)}</dd>
              </div>
            </dl>
          </div>
        )}
        {inv?.paid && <Note tone="warn">ใบนี้เก็บเงินแล้ว ยอดลดหนี้ต้องคืนเงินให้ลูกค้าหรือหักในบิลถัดไป</Note>}
        <Field label="เหตุที่ลดหนี้" error={errors.reason}>
          <Input value={reason} onChange={setReason} placeholder="เช่น สินค้าชำรุดจากการขนส่ง ลูกค้าส่งคืน" error={!!errors.reason} />
        </Field>
        <FormFoot>
          <Button variant="secondary" onClick={onClose}>ยกเลิก</Button>
          <Button variant="primary" onClick={save}>ออกใบลดหนี้</Button>
        </FormFoot>
      </div>
    </FormModal>
  );
}

/* ========================================================== billing note */

export function BillingNoteFormModal({ customer: preset, onSaved, onClose }: { customer?: string; onSaved: (no: string) => void; onClose: () => void }) {
  useData();
  const withOpen = CUSTOMERS.filter((c) => billableInvoices(c.code).length > 0);
  const [cust, setCust] = useState(preset ?? withOpen[0]?.code ?? "");
  const [date, setDate] = useState(TODAY);
  const [payOn, setPayOn] = useState(addDays(TODAY, 7));
  const [picked, setPicked] = useState<string[]>(() => (cust ? billableInvoices(cust).map((b) => b.no) : []));
  const [errors, setErrors] = useState<Errors>({});
  const open = cust ? billableInvoices(cust) : [];
  const total = open.filter((b) => picked.includes(b.no)).reduce((n, b) => n + amountDue(b), 0);

  const save = () => {
    const input = { customer: cust, date, payOn, invoices: picked };
    const e = billingNoteErrors(input);
    setErrors(e);
    if (has(e)) return;
    const bn = createBillingNote(input);
    notify(`ทำใบวางบิล ${bn.no} แล้ว · ${bn.invoices.length} ใบ รวม ${money(total)}`);
    onSaved(bn.no);
  };

  return (
    <FormModal open title="ทำใบวางบิล" subtitle="รวมใบกำกับที่ยังไม่เก็บเงินของลูกค้ารายเดียว ไปนัดรับเช็คครั้งเดียว" onClose={onClose}>
      <div className="space-y-3">
        <Field label="ลูกค้า" error={errors.customer}>
          <Choice
            value={cust}
            onChange={(v) => {
              setCust(v);
              setPicked(v ? billableInvoices(v).map((b) => b.no) : []);
            }}
            options={CUSTOMERS.map((c) => ({ value: c.code, label: `${c.name} · ค้างวางบิล ${billableInvoices(c.code).length} ใบ` }))}
            placeholder="เลือกลูกค้า…"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="วันที่วางบิล" error={errors.date}>
            <Input type="date" value={date} onChange={setDate} error={!!errors.date} />
          </Field>
          <Field label="วันนัดชำระ" error={errors.payOn}>
            <Input type="date" value={payOn} onChange={setPayOn} error={!!errors.payOn} />
          </Field>
        </div>
        {/* Not a Field: a <label> around several checkboxes forwards stray clicks to the first one. */}
        <div>
          <p className="text-[12px] font-medium text-slate-600 dark:text-slate-300">ใบกำกับที่วางบิล</p>
          {open.length === 0 ? (
            <p className="py-3 text-[12.5px] text-slate-400">ลูกค้ารายนี้ไม่มีใบกำกับที่ค้างวางบิล</p>
          ) : (
            <ul className={"mt-1 divide-y divide-slate-100 dark:divide-slate-800 " + SURFACE}>
              {open.map((b) => (
                <li key={b.no} className="flex items-center gap-3 px-3 py-2 text-[13px]">
                  <input
                    type="checkbox"
                    checked={picked.includes(b.no)}
                    onChange={() => setPicked(picked.includes(b.no) ? picked.filter((x) => x !== b.no) : [...picked, b.no])}
                    className="size-3.5 accent-violet-600"
                    aria-label={`วางบิล ${b.no}`}
                  />
                  <span className="font-mono text-[12px] text-slate-600 dark:text-slate-300">{b.no}</span>
                  <span className="text-[11.5px] tabular-nums text-slate-400">ครบกำหนด {b.due}</span>
                  <span className="ml-auto tabular-nums text-slate-900 dark:text-slate-50">{money(amountDue(b))}</span>
                </li>
              ))}
            </ul>
          )}
          {errors.invoices && <p className="mt-1 text-[11.5px] text-rose-600 dark:text-rose-400">{errors.invoices}</p>}
        </div>
        <p className="text-right text-[13px] font-semibold tabular-nums text-slate-900 dark:text-slate-50">รวมวางบิล {money(total)}</p>
        <FormFoot>
          <Button variant="secondary" onClick={onClose}>ยกเลิก</Button>
          <Button variant="primary" onClick={save}>บันทึกใบวางบิล</Button>
        </FormFoot>
      </div>
    </FormModal>
  );
}
