import { useState } from "react";
import type { ReactNode } from "react";
import {
  Banknote, Building, CircleCheck, CircleX, Coins, CreditCard, FileMinus, FileText, MapPin,
  Package, Pencil, Percent, Phone, Printer, Receipt, ShieldCheck, ShoppingBag, Tags, Truck, Users,
} from "lucide-react";
import { material } from "../mm/data";
import { Avatar, Badge, Bar, Button, Chip, IconRow, Note, Progress, Stepper, Tabs, Tag } from "../ui";
import type { StepState } from "../ui";
import { money, notify, useData } from "../kit";
import {
  SALES_ORDERS, TODAY, VAT_RATE, amountDue, baht, billingNoteOf, canCancelOrder, canEditOrder, canShip, confirmOrder,
  creditCheck, creditNoteTotal, creditNotesOf, creditVerdict, customer, deliveriesOf, invoice, invoiceLines,
  invoiceOf, invoiceTotal, invoicesOf, linesTotal, openLines, orderState, orderTotal, priceLine, quotation,
  quoteState, salesOrder,
} from "./data";
import type { Customer, SalesOrder } from "./data";
import { Actions, Fact, OrderBadge, QuoteBadge, channelSwatch, shortName } from "./parts";
import type { Open } from "./parts";

export const ORDER_FLOW = ["รับใบสั่งขาย", "จัดส่ง", "วางบิล", "เก็บเงินแล้ว"];

/** ขั้นที่ใบสั่งขายใบหนึ่งไปถึงแล้ว */
export function stageOf(so: SalesOrder) {
  if (orderState(so) === "เก็บเงินแล้ว") return 3;
  if (invoicesOf(so.no).length > 0) return 2;
  if (deliveriesOf(so.no).length > 0) return 1;
  return 0;
}

const ORDER_TABS = ["การคิดราคา", "การจัดส่ง", "การวางบิล", "ลูกค้า"];
const ORDER_ICONS: Record<string, ReactNode> = {
  การคิดราคา: <Percent size={13} />,
  การจัดส่ง: <Truck size={13} />,
  การวางบิล: <Receipt size={13} />,
  ลูกค้า: <Building size={13} />,
};

const DELIVERY_TONE: Record<string, "ok" | "warn"> = { ส่งถึงแล้ว: "ok", กำลังจัดส่ง: "warn" };

const SmallAction = ({ icon, children, onClick }: { icon: ReactNode; children: ReactNode; onClick: () => void }) => (
  <Button variant="ghost" icon={icon} onClick={onClick} className="px-2.5 py-1.5 text-[12px]">
    {children}
  </Button>
);

/* ---------------------------------------------------------- sales order */

export function OrderRecord({ so, open, onOpenInvoice }: { so: SalesOrder; open: Open; onOpenInvoice: (no: string) => void }) {
  useData();
  const [tab, setTab] = useState(ORDER_TABS[0]);
  const c = customer(so.customer);
  const t = orderTotal(so);
  const at = stageOf(so);
  const flow: { label: string; state: StepState }[] = ORDER_FLOW.map((s, i) => ({
    label: s,
    state: so.status === "ยกเลิก" ? (i === 0 ? "failed" : "todo") : i < at ? "done" : i === at ? "current" : "todo",
  }));
  const dels = deliveriesOf(so.no);
  const invs = invoicesOf(so.no);
  const ready = dels.find((d) => d.status === "ส่งถึงแล้ว" && !invoiceOf(d.no));
  const held = so.status === "รออนุมัติเครดิต" ? creditVerdict(so.customer, t.gross, so.no) : undefined;

  const confirm = () => {
    const s = confirmOrder(so.no);
    if (s === "ยืนยันแล้ว") notify(`ยืนยันใบสั่งขาย ${so.no} แล้ว · ส่งของได้`);
    else notify(`ใบสั่งขาย ${so.no} เกินวงเงิน · รออนุมัติเครดิต`, "warn");
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="flex flex-wrap items-start gap-4 border-b border-slate-100 px-5 pb-5 pt-5 dark:border-slate-800">
        <Avatar name={shortName(c.name)} size="xl" />
        <div className="min-w-0 flex-1">
          <h2 className="text-[18px] font-semibold text-slate-900 dark:text-slate-50">{c.name}</h2>
          <p className="mt-0.5 font-mono text-[12.5px] text-slate-500 dark:text-slate-400">
            {so.no} · {so.date}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Tag swatch={channelSwatch(c.channel)}>{c.channel}</Tag>
            <Chip>{c.terms}</Chip>
            <OrderBadge so={so} />
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[11.5px] text-slate-400">ยอดรวมภาษี</p>
          <p className="text-[24px] font-semibold tabular-nums text-slate-900 dark:text-slate-50">{baht(t.gross)}</p>
        </div>
      </div>

      <div className="space-y-3 border-b border-slate-100 px-5 py-3 dark:border-slate-800">
        <Actions>
          {so.status === "รอยืนยัน" && (
            <Button variant="primary" icon={<CircleCheck size={14} />} onClick={confirm}>ยืนยันใบสั่งขาย</Button>
          )}
          {so.status === "รออนุมัติเครดิต" && (
            <Button variant="primary" icon={<ShieldCheck size={14} />} onClick={() => open({ kind: "release", no: so.no })}>อนุมัติเครดิต</Button>
          )}
          {canShip(so) && (
            <Button variant={ready ? "secondary" : "primary"} icon={<Truck size={14} />} onClick={() => open({ kind: "delivery", so: so.no })}>
              เปิดใบส่งของ
            </Button>
          )}
          {ready && (
            <Button variant="primary" icon={<Receipt size={14} />} onClick={() => open({ kind: "invoice", delivery: ready.no })}>
              ออกใบกำกับภาษี
            </Button>
          )}
          {canEditOrder(so) && (
            <Button variant="secondary" icon={<Pencil size={14} />} onClick={() => open({ kind: "order", no: so.no })}>แก้ไข</Button>
          )}
          <Button variant="secondary" icon={<Printer size={14} />} onClick={() => open({ kind: "print", doc: "SO", no: so.no })}>พิมพ์ใบสั่งขาย</Button>
          {canCancelOrder(so) && (
            <Button variant="ghost" icon={<CircleX size={14} />} onClick={() => open({ kind: "cancel-order", no: so.no })} className="text-rose-600 dark:text-rose-400">
              ยกเลิกใบสั่งขาย
            </Button>
          )}
        </Actions>
        {so.status === "รอยืนยัน" && <Note tone="warn">ใบร่าง ยังไม่ได้ยืนยันกับลูกค้า — ยืนยันแล้วระบบตรวจวงเงินและส่งของได้</Note>}
        {held && (
          <Note tone="bad">
            เกินวงเงิน: ยอดค้าง {baht(held.used)} + ใบนี้ {baht(t.gross)} = {baht(held.projected)} จากวงเงิน {baht(held.limit)} — ต้องให้ผู้มีอำนาจอนุมัติก่อนส่งของ
          </Note>
        )}
        {so.status === "ยกเลิก" && <Note tone="idle">ยกเลิกแล้ว · {so.cancelReason}</Note>}
        {so.creditApproval && <Note tone="accent">อนุมัติขายเกินวงเงินเมื่อ {so.creditApproval.date} · {so.creditApproval.note}</Note>}
      </div>

      <div className="px-5">
        <Tabs tabs={ORDER_TABS} active={tab} onPick={setTab} icons={ORDER_ICONS} id="so" />
      </div>

      <div className="px-5 py-4">
        {tab === "การคิดราคา" && (
          <div className="space-y-3">
            <Stepper
              steps={flow}
              icons={{ done: <CircleCheck size={14} />, current: <Truck size={14} />, todo: <Package size={14} />, failed: <CircleX size={14} /> }}
            />
            {(so.shipBy || so.customerPo || so.quotation || so.note) && (
              <dl className="grid gap-2 sm:grid-cols-4">
                {so.shipBy && <Fact label="กำหนดส่ง">{so.shipBy}</Fact>}
                {so.customerPo && <Fact label="ใบสั่งซื้อลูกค้า">{so.customerPo}</Fact>}
                {so.quotation && <Fact label="จากใบเสนอราคา">{so.quotation}</Fact>}
                {so.note && <Fact label="หมายเหตุ">{so.note}</Fact>}
              </dl>
            )}
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {so.lines.map((l) => {
                const p = priceLine(l, c.channel, so.date);
                return (
                  <li key={l.material} className="py-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium text-slate-900 dark:text-slate-50">{material(l.material).name}</span>
                        <span className="block font-mono text-[11px] text-slate-400">{l.material}</span>
                      </span>
                      <span className="shrink-0 text-[11.5px] tabular-nums text-slate-400">
                        {l.qty} × {baht(p.net)}
                      </span>
                      <span className="w-28 shrink-0 text-right text-[13px] font-semibold tabular-nums text-slate-900 dark:text-slate-50">{baht(p.amount)}</span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11.5px]">
                      <span className="text-slate-400">ราคาตั้ง {baht(p.list)}</span>
                      {p.chan > 0 && <Badge tone="accent">ช่องทาง −{Math.round(p.chan * 100)}%</Badge>}
                      {p.vol > 0 && <Badge tone="info">จำนวน −{Math.round(p.vol * 100)}%</Badge>}
                      <span className="text-slate-500 dark:text-slate-400">ตามเงื่อนไข {baht(p.rule)} ต่อหน่วย</span>
                      {p.special && <Badge tone="warn">ราคาพิเศษ {baht(p.net)}</Badge>}
                    </div>
                  </li>
                );
              })}
            </ul>
            <ul className="space-y-1.5 border-t border-slate-100 pt-3 text-[13px] dark:border-slate-800">
              <li className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-300">รวมก่อนภาษี</span>
                <span className="tabular-nums text-slate-900 dark:text-slate-50">{baht(t.net)}</span>
              </li>
              <li className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-300">ภาษีมูลค่าเพิ่ม {Math.round(VAT_RATE * 100)}%</span>
                <span className="tabular-nums text-slate-900 dark:text-slate-50">{baht(t.vat)}</span>
              </li>
              <li className="flex justify-between border-t border-slate-100 pt-1.5 font-semibold dark:border-slate-800">
                <span className="text-slate-900 dark:text-slate-50">ยอดที่ลูกค้าต้องจ่าย</span>
                <span className="tabular-nums text-slate-900 dark:text-slate-50">{baht(t.gross)}</span>
              </li>
            </ul>
          </div>
        )}

        {tab === "การจัดส่ง" && (
          <div className="space-y-4">
            <ul className="space-y-2">
              {openLines(so).map((l) => (
                <li key={l.material} className="flex flex-wrap items-center gap-3 text-[13px]">
                  <span className="w-52 shrink-0 truncate text-slate-800 dark:text-slate-100">{material(l.material).name}</span>
                  <span className="min-w-0 flex-1">
                    <Bar pct={(l.shipped / l.ordered) * 100} tone={l.open === 0 ? "ok" : "accent"} width="w-full" />
                  </span>
                  <span className="w-44 shrink-0 text-right text-[12px] tabular-nums text-slate-500 dark:text-slate-400">
                    ส่งแล้ว {l.shipped} จาก {l.ordered} · ค้าง {l.open}
                  </span>
                </li>
              ))}
            </ul>
            {dels.length === 0 ? (
              <Note tone="idle">ใบนี้ยังไม่ได้เปิดใบส่งของ ของยังอยู่ในคลัง</Note>
            ) : (
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100 dark:divide-slate-800 dark:border-slate-800">
                {dels.map((d) => (
                  <li key={d.no} className="space-y-2 px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[12.5px] text-slate-700 dark:text-slate-200">{d.no}</span>
                      <span className="text-[12px] tabular-nums text-slate-400">{d.date}</span>
                      <Chip><span className="flex items-center gap-1"><MapPin size={11} />{d.route}</span></Chip>
                      <span className="text-[12px] text-slate-400">{d.carrier}</span>
                      <Badge tone={DELIVERY_TONE[d.status]} dot>{d.status}</Badge>
                      <span className="ml-auto flex flex-wrap gap-1">
                        <SmallAction icon={<Printer size={13} />} onClick={() => open({ kind: "print", doc: "DO", no: d.no })}>พิมพ์ใบส่งของ</SmallAction>
                        {d.status === "กำลังจัดส่ง" && (
                          <SmallAction icon={<CircleCheck size={13} />} onClick={() => open({ kind: "delivered", no: d.no })}>ยืนยันส่งถึง</SmallAction>
                        )}
                      </span>
                    </div>
                    <p className="text-[12.5px] text-slate-600 dark:text-slate-300">
                      {d.lines.map((l) => `${material(l.material).name} × ${l.qty}`).join(" · ")}
                      {d.receivedBy && <span className="text-slate-400"> · ผู้รับ {d.receivedBy} เมื่อ {d.deliveredOn}</span>}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {tab === "การวางบิล" && (
          <div className="space-y-3">
            {invs.length === 0 ? (
              <Note tone={dels.length ? "warn" : "idle"}>
                {ready ? "ส่งของถึงแล้วแต่ยังไม่ได้ออกใบกำกับภาษี ยอดนี้ยังไม่ถือเป็นรายได้" : dels.length ? "ของอยู่ระหว่างจัดส่ง ยืนยันส่งถึงก่อนออกใบกำกับ" : "ยังไม่ถึงขั้นวางบิล ต้องส่งของก่อน"}
              </Note>
            ) : (
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100 dark:divide-slate-800 dark:border-slate-800">
                {invs.map((b) => (
                  <li key={b.no} className="flex flex-wrap items-center gap-2 px-4 py-3">
                    <button onClick={() => onOpenInvoice(b.no)} className="font-mono text-[12.5px] text-violet-700 hover:underline dark:text-violet-300">{b.no}</button>
                    <span className="text-[12px] tabular-nums text-slate-400">{b.date} · ครบกำหนด {b.due}</span>
                    <Badge tone={b.paid ? "ok" : b.due < TODAY ? "bad" : "warn"} dot>{b.paid ? "เก็บเงินแล้ว" : b.due < TODAY ? "เกินกำหนด" : "ยังไม่เก็บเงิน"}</Badge>
                    <span className="ml-auto text-[13px] font-semibold tabular-nums text-slate-900 dark:text-slate-50">{baht(amountDue(b))}</span>
                    <span className="flex w-full flex-wrap gap-1">
                      <SmallAction icon={<Printer size={13} />} onClick={() => open({ kind: "print", doc: "IV", no: b.no })}>พิมพ์ใบกำกับ</SmallAction>
                      {!b.paid && <SmallAction icon={<Banknote size={13} />} onClick={() => open({ kind: "payment", no: b.no })}>รับชำระ</SmallAction>}
                      <SmallAction icon={<FileMinus size={13} />} onClick={() => open({ kind: "credit-note", invoice: b.no })}>ออกใบลดหนี้</SmallAction>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {ready && invs.length > 0 && <Note tone="warn">{ready.no} ส่งถึงแล้วแต่ยังไม่ได้ออกใบกำกับภาษี</Note>}
          </div>
        )}

        {tab === "ลูกค้า" && <CustomerFacts c={c} />}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ quotation */

export function QuotationRecord({ no, open, onOpenOrder }: { no: string; open: Open; onOpenOrder: (no: string) => void }) {
  useData();
  const q = quotation(no);
  const c = customer(q.customer);
  const t = linesTotal(q.lines);
  const state = quoteState(q);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start gap-3">
        <Avatar name={shortName(c.name)} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-slate-900 dark:text-slate-50">{c.name}</p>
          <p className="font-mono text-[12px] text-slate-500 dark:text-slate-400">{q.no} · {q.date} · ยืนราคาถึง {q.validUntil}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5"><QuoteBadge q={q} /><Chip>{c.terms}</Chip></div>
        </div>
        <p className="text-right text-[22px] font-semibold tabular-nums text-slate-900 dark:text-slate-50">{baht(t.gross)}</p>
      </div>
      <Actions>
        {state === "รอลูกค้าตอบ" && (
          <Button variant="primary" icon={<ShoppingBag size={14} />} onClick={() => open({ kind: "order", quotation: q.no })}>สร้างใบสั่งขายจากใบนี้</Button>
        )}
        {q.status === "รอลูกค้าตอบ" && (
          <Button variant="secondary" icon={<Pencil size={14} />} onClick={() => open({ kind: "quote", no: q.no })}>แก้ไข</Button>
        )}
        <Button variant="secondary" icon={<Printer size={14} />} onClick={() => open({ kind: "print", doc: "QT", no: q.no })}>พิมพ์ใบเสนอราคา</Button>
        {q.status === "รอลูกค้าตอบ" && (
          <Button variant="ghost" icon={<CircleX size={14} />} onClick={() => open({ kind: "cancel-quote", no: q.no })} className="text-rose-600 dark:text-rose-400">
            ลูกค้าไม่ตกลง
          </Button>
        )}
      </Actions>
      {state === "หมดอายุ" && <Note tone="warn">เลยวันยืนราคาแล้ว — แก้วันยืนราคาแล้วส่งใหม่ หรือบันทึกว่าลูกค้าไม่ตกลง</Note>}
      {q.so && (
        <Note tone="ok">
          ลูกค้าตกลงแล้ว เปิดเป็นใบสั่งขาย{" "}
          <button onClick={() => onOpenOrder(q.so!)} className="font-mono underline">{q.so}</button>
        </Note>
      )}
      {q.cancelReason && <Note tone="idle">ลูกค้าไม่ตกลง · {q.cancelReason}</Note>}
      <DocLines lines={q.lines} />
      {q.note && <p className="text-[12.5px] text-slate-500 dark:text-slate-400">หมายเหตุ: {q.note}</p>}
    </div>
  );
}

function DocLines({ lines, extra }: { lines: { material: string; qty: number; price: number }[]; extra?: ReactNode }) {
  const t = linesTotal(lines);
  return (
    <div className="overflow-hidden rounded-xl border border-slate-100 dark:border-slate-800">
      <table className="w-full text-[13px]">
        <thead className="bg-slate-50/80 text-left text-[11px] text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
          <tr>
            <th className="px-3 py-2 font-medium">สินค้า</th>
            <th className="px-3 py-2 text-right font-medium">จำนวน</th>
            <th className="px-3 py-2 text-right font-medium">ราคาต่อหน่วย</th>
            <th className="px-3 py-2 text-right font-medium">จำนวนเงิน</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {lines.map((l) => (
            <tr key={l.material}>
              <td className="px-3 py-2 text-slate-800 dark:text-slate-100">{material(l.material).name}</td>
              <td className="px-3 py-2 text-right tabular-nums text-slate-600 dark:text-slate-300">{l.qty} {material(l.material).unit}</td>
              <td className="px-3 py-2 text-right tabular-nums text-slate-600 dark:text-slate-300">{money(l.price)}</td>
              <td className="px-3 py-2 text-right tabular-nums text-slate-900 dark:text-slate-50">{money(l.qty * l.price)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl className="ml-auto max-w-xs space-y-1 border-t border-slate-100 px-3 py-3 text-[13px] dark:border-slate-800">
        <div className="flex justify-between text-slate-500 dark:text-slate-400"><dt>รวมก่อนภาษี</dt><dd className="tabular-nums">{money(t.net)}</dd></div>
        <div className="flex justify-between text-slate-500 dark:text-slate-400"><dt>ภาษีมูลค่าเพิ่ม 7%</dt><dd className="tabular-nums">{money(t.vat)}</dd></div>
        <div className="flex justify-between font-semibold text-slate-900 dark:text-slate-50"><dt>รวมทั้งสิ้น</dt><dd className="tabular-nums">{money(t.gross)}</dd></div>
        {extra}
      </dl>
    </div>
  );
}

/* -------------------------------------------------------------- invoice */

export function InvoiceRecord({ no, open, onOpenOrder }: { no: string; open: Open; onOpenOrder: (no: string) => void }) {
  useData();
  const inv = invoice(no);
  const so = salesOrder(inv.so);
  const c = customer(so.customer);
  const notes = creditNotesOf(no);
  const bn = billingNoteOf(no);
  const overdue = !inv.paid && inv.due < TODAY;
  return (
    <div className="space-y-4">
      <dl className="grid gap-2 sm:grid-cols-4">
        <Fact label="ลูกค้า" wide>{c.name}</Fact>
        <Fact label="ลงวันที่">{inv.date}</Fact>
        <Fact label="ครบกำหนด">{inv.due}</Fact>
        <Fact label="ใบสั่งขาย">
          <button onClick={() => onOpenOrder(so.no)} className="font-mono text-violet-700 hover:underline dark:text-violet-300">{so.no}</button>
        </Fact>
        <Fact label="ใบส่งของ">{inv.delivery}</Fact>
        <Fact label="ใบวางบิล">{bn ? `${bn.no} · นัด ${bn.payOn}` : "ยังไม่วางบิล"}</Fact>
        <Fact label="สถานะ">
          <Badge tone={inv.paid ? "ok" : overdue ? "bad" : "warn"} dot>{inv.paid ? "เก็บเงินแล้ว" : overdue ? "เกินกำหนด" : "ยังไม่เก็บเงิน"}</Badge>
        </Fact>
      </dl>
      <Actions>
        {!inv.paid && <Button variant="primary" icon={<Banknote size={14} />} onClick={() => open({ kind: "payment", no })}>รับชำระ</Button>}
        <Button variant="secondary" icon={<Printer size={14} />} onClick={() => open({ kind: "print", doc: "IV", no })}>พิมพ์ใบกำกับภาษี</Button>
        {inv.receipt && <Button variant="secondary" icon={<Printer size={14} />} onClick={() => open({ kind: "print", doc: "RE", no })}>พิมพ์ใบเสร็จ {inv.receipt.no}</Button>}
        {inv.receipt && (
          <Button variant="ghost" icon={<CircleX size={14} />} onClick={() => open({ kind: "cancel-payment", no })} className="text-rose-600 dark:text-rose-400">
            ยกเลิกใบเสร็จ
          </Button>
        )}
        <Button variant="secondary" icon={<FileMinus size={14} />} onClick={() => open({ kind: "credit-note", invoice: no })}>ออกใบลดหนี้</Button>
      </Actions>
      <DocLines
        lines={invoiceLines(inv)}
        extra={
          <>
            {notes.map((n) => (
              <div key={n.no} className="flex justify-between text-rose-600 dark:text-rose-400">
                <dt>
                  <button onClick={() => open({ kind: "print", doc: "CN", no: n.no })} className="hover:underline">ลดหนี้ {n.no}</button>
                </dt>
                <dd className="tabular-nums">−{money(creditNoteTotal(n).gross)}</dd>
              </div>
            ))}
            {notes.length > 0 && (
              <div className="flex justify-between border-t border-slate-100 pt-1 font-semibold text-slate-900 dark:border-slate-800 dark:text-slate-50">
                <dt>ยอดตามใบหลังลดหนี้</dt>
                <dd className="tabular-nums">{money(amountDue(inv))}</dd>
              </div>
            )}
          </>
        }
      />
      {inv.receipt ? (
        <Note tone="ok">
          รับชำระ {money(inv.receipt.amount)} เมื่อ {inv.receipt.date} โดย{inv.receipt.method}
          {inv.receipt.wht > 0 && <> · ลูกค้าหัก ณ ที่จ่าย {money(inv.receipt.wht)}</>}
          {inv.receipt.ref && <> · {inv.receipt.ref}</>} · ใบเสร็จ {inv.receipt.no}
        </Note>
      ) : (
        <Note tone={overdue ? "bad" : "warn"}>
          ยังไม่เก็บเงิน ยอดนี้กินวงเงินเครดิตของลูกค้าอยู่ {money(amountDue(inv))}
          {overdue && ` · เกินกำหนดมาแล้ว`}
        </Note>
      )}
      {inv.paid && notes.some((n) => inv.receipt && n.date >= inv.receipt.date) && (
        <Note tone="idle">ใบลดหนี้ออกหลังลูกค้าชำระแล้ว ส่วนที่ลดต้องคืนเงินหรือหักในบิลถัดไป</Note>
      )}
      <p className="text-[11.5px] text-slate-400">ยอดใบกำกับก่อนลดหนี้ {money(invoiceTotal(inv).gross)}</p>
    </div>
  );
}

/* ------------------------------------------------------------- customer */

export function CustomerFacts({ c }: { c: Customer }) {
  useData();
  const cr = creditCheck(c.code);
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <IconRow icon={<FileText size={14} />} label="รหัสลูกค้า">{c.code}</IconRow>
        <IconRow icon={<Users size={14} />} label="ผู้ติดต่อ">{c.contact}</IconRow>
        <IconRow icon={<Phone size={14} />} label="โทรศัพท์">{c.phone}</IconRow>
        <IconRow icon={<Tags size={14} />} label="ช่องทางขาย">{c.channel}</IconRow>
        <IconRow icon={<CreditCard size={14} />} label="เงื่อนไขชำระ">{c.terms}</IconRow>
        <IconRow icon={<Building size={14} />} label="เลขผู้เสียภาษี">{c.taxId} · {c.branch}</IconRow>
        <IconRow icon={<MapPin size={14} />} label="ที่อยู่ออกใบกำกับ">{c.billingAddress}</IconRow>
      </div>
      {!cr.cashOnly && <Progress done={Math.min(cr.used, cr.limit)} total={cr.limit} label={`ใช้วงเงิน ${baht(cr.used)} จาก ${baht(cr.limit)}`} />}
    </div>
  );
}

export function CustomerRecord({ c, open, onOpenOrder }: { c: Customer; open: Open; onOpenOrder: (so: SalesOrder) => void }) {
  useData();
  const orders = SALES_ORDERS.filter((so) => so.customer === c.code);
  const cr = creditCheck(c.code);

  return (
    <div className="space-y-4">
      <Actions>
        <Button variant="primary" icon={<ShoppingBag size={14} />} onClick={() => open({ kind: "order", customer: c.code })}>สร้างใบสั่งขาย</Button>
        <Button variant="secondary" icon={<Pencil size={14} />} onClick={() => open({ kind: "customer", code: c.code })}>แก้ไขข้อมูล</Button>
        <Button variant="secondary" icon={<Coins size={14} />} onClick={() => open({ kind: "credit", code: c.code })}>ปรับวงเงิน</Button>
      </Actions>

      <CustomerFacts c={c} />

      <div>
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-400">ใบสั่งขายของลูกค้ารายนี้</p>
        {orders.length === 0 ? (
          <p className="py-4 text-center text-[12.5px] text-slate-400">ยังไม่มีใบสั่งขาย</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {orders.map((so) => (
              <li key={so.no} className="flex items-center gap-3 py-2 text-[13px]">
                <button onClick={() => onOpenOrder(so)} className="font-mono text-[12px] text-violet-700 transition hover:underline dark:text-violet-300">
                  {so.no}
                </button>
                <span className="tabular-nums text-slate-400">{so.date}</span>
                <OrderBadge so={so} />
                <span className="ml-auto tabular-nums text-slate-900 dark:text-slate-50">{baht(orderTotal(so).gross)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Note tone={cr.cashOnly ? "idle" : cr.blocked ? "bad" : "ok"}>
        {cr.cashOnly
          ? "ลูกค้ารายนี้ขายเงินสดเท่านั้น"
          : cr.blocked
            ? `ยอดค้าง ${baht(cr.used)} เกินวงเงิน ${baht(cr.limit)} อยู่ ${baht(cr.used - cr.limit)}`
            : `ยอดค้าง ${baht(cr.used)} ยังเหลือวงเงินอีก ${baht(cr.left)}`}
        {cr.held > 0 && ` · รออนุมัติเครดิต ${baht(cr.held)}`}
      </Note>
    </div>
  );
}

