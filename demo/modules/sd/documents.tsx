import { Printer } from "lucide-react";
import { material } from "../mm/data";
import { Button } from "../ui";
import { DocumentSheet, FormModal, Paper, bahtText, money, printDocument, useData } from "../kit";
import {
  COMPANY, amountDue, creditNoteTotal, billingNote, creditNote, creditNotesOf, customer, delivery, invoice,
  invoiceLines, invoiceTotal, linesTotal, quotation, salesOrder,
} from "./data";
import type { Customer, OrderLine } from "./data";
import type { PrintKind } from "./parts";

/**
 * เอกสารขายตามที่พิมพ์ส่งลูกค้า. เอกสารมีราคา (ใบสั่งขาย ใบเสนอราคา ใบกำกับ ใบลดหนี้
 * ใบเสร็จ) ใช้ DocumentSheet ของ kit ส่วนใบส่งของและใบวางบิลไม่มีรายการราคาแบบนั้น
 * จึงจัดหน้าเองบน Paper
 */

const TITLES: Record<PrintKind, string> = {
  SO: "ใบสั่งขาย",
  QT: "ใบเสนอราคา",
  DO: "ใบส่งของ",
  IV: "ใบกำกับภาษี / ใบแจ้งหนี้",
  CN: "ใบลดหนี้ / ใบกำกับภาษี",
  BN: "ใบวางบิล",
  RE: "ใบเสร็จรับเงิน",
};

const party = (c: Customer) => ({
  label: "ลูกค้า",
  name: `${c.name} (${c.branch})`,
  address: c.billingAddress,
  taxId: c.taxId,
});

const sheetLines = (lines: OrderLine[]) =>
  lines.map((l) => ({ name: `${l.material} ${material(l.material).name}`, qty: l.qty, unit: material(l.material).unit, price: l.price }));

/** ยอดที่ลงบัญชีไว้แล้ว (ภาษีปัดเป็นบาทต่อใบ) — ใบที่ลูกค้าถือต้องตรงกับบัญชีภาษีขาย */
const booked = (t: { net: number; vat: number; gross: number }) => ({ subtotal: t.net, vat: t.vat, total: t.gross });

export function PrintModal({ doc, no, onClose }: { doc: PrintKind; no: string; onClose: () => void }) {
  return (
    <FormModal open title={`${TITLES[doc]} ${doc === "RE" ? (invoice(no).receipt?.no ?? "") : no}`} subtitle="ตัวอย่างก่อนพิมพ์ — กระดาษ A4 พิมพ์เฉพาะเอกสาร ไม่รวมหน้าจอรอบข้าง" onClose={onClose} size="lg">
      <div className="mb-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>ปิด</Button>
        <Button variant="primary" icon={<Printer size={14} />} onClick={printDocument}>พิมพ์</Button>
      </div>
      <PrintedDoc doc={doc} no={no} />
    </FormModal>
  );
}

function PrintedDoc({ doc, no }: { doc: PrintKind; no: string }) {
  useData();
  if (doc === "SO") {
    const so = salesOrder(no);
    const c = customer(so.customer);
    return (
      <DocumentSheet
        title={TITLES.SO + (so.status === "ยกเลิก" ? " (ยกเลิก)" : "")}
        number={so.no}
        date={so.date}
        company={COMPANY}
        party={party(c)}
        lines={sheetLines(so.lines)}
        totals={booked(linesTotal(so.lines))}
        notes={
          <>
            เงื่อนไขชำระ {c.terms}
            {so.shipBy && <> · กำหนดส่ง {so.shipBy}</>}
            {so.customerPo && <> · อ้างอิงใบสั่งซื้อลูกค้า {so.customerPo}</>}
            {so.quotation && <> · ตามใบเสนอราคา {so.quotation}</>}
            {so.note && <><br />{so.note}</>}
          </>
        }
        signatures={["ผู้สั่งซื้อ", "ผู้อนุมัติขาย"]}
      />
    );
  }
  if (doc === "QT") {
    const q = quotation(no);
    const c = customer(q.customer);
    return (
      <DocumentSheet
        title={TITLES.QT}
        number={q.no}
        date={q.date}
        company={COMPANY}
        party={party(c)}
        lines={sheetLines(q.lines)}
        totals={booked(linesTotal(q.lines))}
        notes={
          <>
            ยืนราคาถึง {q.validUntil} · เงื่อนไขชำระ {c.terms}
            {q.note && <><br />{q.note}</>}
          </>
        }
        signatures={["ผู้เสนอราคา", "ผู้อนุมัติสั่งซื้อ"]}
      />
    );
  }
  if (doc === "IV") {
    const inv = invoice(no);
    const so = salesOrder(inv.so);
    const c = customer(so.customer);
    const lines = invoiceLines(inv);
    return (
      <DocumentSheet
        title={TITLES.IV}
        number={inv.no}
        date={inv.date}
        dueDate={inv.due}
        company={COMPANY}
        party={party(c)}
        lines={sheetLines(lines)}
        totals={booked(invoiceTotal(inv))}
        notes={
          <>
            อ้างอิงใบสั่งขาย {so.no} · ใบส่งของ {inv.delivery} · เงื่อนไขชำระ {c.terms}
            {so.customerPo && <> · ใบสั่งซื้อลูกค้า {so.customerPo}</>}
          </>
        }
        signatures={["ผู้รับสินค้า", "ผู้มีอำนาจลงนาม"]}
      />
    );
  }
  if (doc === "CN") {
    const cn = creditNote(no);
    const inv = invoice(cn.invoice);
    const c = customer(salesOrder(inv.so).customer);
    const before = invoiceTotal(inv).net;
    const cut = cn.net;
    return (
      <DocumentSheet
        title={TITLES.CN}
        number={cn.no}
        date={cn.date}
        company={COMPANY}
        party={party(c)}
        lines={cn.lines.map((l) => ({
          name: (cn.kind === "ลดราคา" ? "ลดราคา " : "รับคืน ") + `${l.material} ${material(l.material).name}`,
          qty: l.qty,
          unit: material(l.material).unit,
          price: l.price,
        }))}
        totals={booked(creditNoteTotal(cn))}
        notes={
          <>
            อ้างถึงใบกำกับภาษีเลขที่ {inv.no} ลงวันที่ {inv.date}
            <br />
            มูลค่าตามใบกำกับเดิม {money(before)} · มูลค่าที่ถูกต้อง {money(before - cut)} · ผลต่าง {money(cut)}
            <br />
            เหตุที่ลดหนี้: {cn.kind} — {cn.reason}
          </>
        }
      />
    );
  }
  if (doc === "RE") {
    const inv = invoice(no);
    const r = inv.receipt;
    if (!r) throw new Error(`ใบกำกับ ${no} ยังไม่ได้รับชำระ`);
    const c = customer(salesOrder(inv.so).customer);
    return (
      <DocumentSheet
        title={TITLES.RE}
        number={r.no}
        date={r.date}
        company={COMPANY}
        party={party(c)}
        lines={[{ name: `ชำระค่าสินค้าตามใบกำกับภาษีเลขที่ ${inv.no} ลงวันที่ ${inv.date}`, qty: 1, unit: "ใบ", price: r.amount + r.wht }]}
        vatRate={0}
        notes={
          <>
            รับชำระโดย {r.method}{r.ref && <> · {r.ref}</>}
            {r.wht > 0 && <><br />รับเงิน {money(r.amount)} + ภาษีหัก ณ ที่จ่าย {money(r.wht)} = {money(r.amount + r.wht)}</>}
            <br />ภาษีมูลค่าเพิ่มแสดงไว้ในใบกำกับภาษีแล้ว
          </>
        }
        signatures={["ผู้จ่ายเงิน", "ผู้รับเงิน"]}
      />
    );
  }
  if (doc === "DO") return <DeliveryNote no={no} />;
  return <BillingNoteSheet no={no} />;
}

/* ----------------------------------------------------- the unpriced ones */

const TD = "border border-slate-300 px-2 py-1.5";

function SheetHead({ title, meta, who }: { title: string; meta: [string, string][]; who: Customer }) {
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-6 border-b-2 border-slate-800 pb-4">
        <div className="min-w-0">
          <p className="text-[16px] font-bold text-slate-900">{COMPANY.name}</p>
          <p className="mt-1 max-w-sm leading-relaxed text-slate-600">{COMPANY.address}</p>
          <p className="text-slate-600">เลขประจำตัวผู้เสียภาษี {COMPANY.taxId} · โทร {COMPANY.phone}</p>
        </div>
        <p className="text-[18px] font-bold text-slate-900">{title}</p>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto]">
        <div className="rounded-md border border-slate-300 p-3">
          <p className="text-[11px] text-slate-500">ลูกค้า</p>
          <p className="font-semibold text-slate-900">{who.name} ({who.branch})</p>
          <p className="leading-relaxed text-slate-600">{who.billingAddress}</p>
          <p className="text-slate-600">โทร {who.phone} · ผู้ติดต่อ {who.contact}</p>
        </div>
        <dl className="grid min-w-52 grid-cols-[auto_1fr] content-start gap-x-4 gap-y-1 rounded-md border border-slate-300 p-3">
          {meta.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-slate-500">{k}</dt>
              <dd className="text-right tabular-nums text-slate-900">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </>
  );
}

function Signatures({ names }: { names: string[] }) {
  return (
    <div className="mt-12 grid gap-8" style={{ gridTemplateColumns: `repeat(${names.length}, minmax(0, 1fr))` }}>
      {names.map((s) => (
        <div key={s} className="text-center">
          <div className="mx-auto h-10 w-36 border-b border-dotted border-slate-500" />
          <p className="mt-1.5 text-slate-600">{s}</p>
          <p className="text-[11px] text-slate-400">วันที่ ____/____/______</p>
        </div>
      ))}
    </div>
  );
}

function DeliveryNote({ no }: { no: string }) {
  const d = delivery(no);
  const so = salesOrder(d.so);
  const c = customer(so.customer);
  return (
    <Paper>
      <SheetHead
        title={TITLES.DO}
        who={c}
        meta={[["เลขที่", d.no], ["วันที่", d.date], ["อ้างใบสั่งขาย", so.no], ["ผู้ขนส่ง", d.carrier], ["ปลายทาง", d.route]]}
      />
      <table className="mt-4 w-full border-collapse">
        <thead>
          <tr className="bg-slate-100 text-[11.5px] text-slate-600">
            <th className={TD + " text-center font-medium"}>ลำดับ</th>
            <th className={TD + " text-left font-medium"}>รหัส</th>
            <th className={TD + " text-left font-medium"}>รายการ</th>
            <th className={TD + " text-right font-medium"}>จำนวน</th>
            <th className={TD + " text-left font-medium"}>หน่วย</th>
          </tr>
        </thead>
        <tbody>
          {d.lines.map((l, i) => (
            <tr key={l.material}>
              <td className={TD + " text-center tabular-nums"}>{i + 1}</td>
              <td className={TD + " font-mono"}>{l.material}</td>
              <td className={TD}>{material(l.material).name}</td>
              <td className={TD + " text-right tabular-nums"}>{l.qty.toLocaleString("th-TH")}</td>
              <td className={TD}>{material(l.material).unit}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 leading-relaxed text-slate-600">
        ได้รับสินค้าตามรายการข้างต้นไว้ถูกต้องในสภาพเรียบร้อยแล้ว
        {so.customerPo && <> · อ้างอิงใบสั่งซื้อลูกค้า {so.customerPo}</>}
        {d.receivedBy && <> · ผู้รับ {d.receivedBy} เมื่อ {d.deliveredOn}</>}
      </p>
      <Signatures names={["ผู้จัดสินค้า", "ผู้ส่งของ", "ผู้รับของ"]} />
    </Paper>
  );
}

function BillingNoteSheet({ no }: { no: string }) {
  const bn = billingNote(no);
  const c = customer(bn.customer);
  const rows = bn.invoices.map((n) => invoice(n));
  const total = rows.reduce((s, inv) => s + amountDue(inv), 0);
  return (
    <Paper>
      <SheetHead title={TITLES.BN} who={c} meta={[["เลขที่", bn.no], ["วันที่", bn.date], ["นัดชำระ", bn.payOn]]} />
      <table className="mt-4 w-full border-collapse">
        <thead>
          <tr className="bg-slate-100 text-[11.5px] text-slate-600">
            <th className={TD + " text-center font-medium"}>ลำดับ</th>
            <th className={TD + " text-left font-medium"}>เลขที่ใบกำกับภาษี</th>
            <th className={TD + " text-left font-medium"}>ลงวันที่</th>
            <th className={TD + " text-left font-medium"}>ครบกำหนด</th>
            <th className={TD + " text-right font-medium"}>จำนวนเงิน</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((inv, i) => (
            <tr key={inv.no}>
              <td className={TD + " text-center tabular-nums"}>{i + 1}</td>
              <td className={TD + " font-mono"}>
                {inv.no}
                {creditNotesOf(inv.no).length > 0 && <span className="font-sans text-slate-500"> (หักใบลดหนี้ {creditNotesOf(inv.no).map((n) => n.no).join(", ")})</span>}
              </td>
              <td className={TD + " tabular-nums"}>{inv.date}</td>
              <td className={TD + " tabular-nums"}>{inv.due}</td>
              <td className={TD + " text-right tabular-nums"}>{money(amountDue(inv))}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <p className="min-w-0 flex-1 rounded-md bg-slate-100 px-3 py-2 font-medium text-slate-800">({bahtText(total)})</p>
        <p className="min-w-60 border-t border-slate-800 pt-1 text-right font-bold tabular-nums text-slate-900">
          รวม {rows.length} ใบ · {money(total)}
        </p>
      </div>
      <p className="mt-3 text-slate-600">ได้รับเอกสารตามรายการข้างต้นไว้เพื่อตรวจสอบ และจะชำระเงินภายในวันที่ {bn.payOn}</p>
      <Signatures names={["ผู้วางบิล", "ผู้รับวางบิล"]} />
    </Paper>
  );
}
