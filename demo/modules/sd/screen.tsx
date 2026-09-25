import { useState } from "react";
import {
  ArrowRight, Banknote, CalendarClock, CircleCheck, Coins, CreditCard, FileMinus, FilePlus, FileText, MapPin, Package,
  Pencil, Percent, Plus, Printer, Receipt, Search as SearchIcon, ShieldAlert, ShieldCheck, ShoppingBag, Tags,
  TriangleAlert, Truck, UserPlus, Users,
} from "lucide-react";
import { material } from "../mm/data";
import {
  BILLINGS, BILLING_NOTES, CATALOG, CREDIT_CHANGES, CREDIT_NOTES, CUSTOMERS, DELIVERIES, PRICE_CHANGES, QUOTATIONS,
  SALES_ORDERS, TODAY, VAT_RATE, activeOrders, amountDue, baht, billingNoteTotal, canEditOrder, canShip,
  channelDiscountOn, creditCheck, creditNoteTotal, customer, heldOrders, invoice, invoiceOf, invoiceTotal, linesTotal,
  listPriceOn, openLines, orderState, orderTotal, quoteState, salesOrder, scheduledChanges, uninvoicedDeliveries,
  volumeBreaksOn,
} from "./data";
import type { Customer, PriceKind, Quotation, SalesOrder } from "./data";
import {
  Avatar, Badge, Bar, Button, Card, Chip, ColumnChart, Donut, Dot, IconButton, Note, PageHead, Progress, Reveal,
  Search, Segmented, Select, StatStrip, Tag,
} from "../ui";
import { DataTable, DetailModal, FormModal, downloadCsv, money, useData } from "../kit";
import type { Column } from "../kit";
import { CHANNELS, ExportButton, OrderBadge, QuoteBadge, channelSwatch, pct, shortName } from "./parts";
import type { Dialog, Open } from "./parts";
import { CustomerRecord, InvoiceRecord, ORDER_FLOW, OrderRecord, QuotationRecord, stageOf } from "./records";
import {
  BillingNoteFormModal, CreditFormModal, CreditNoteFormModal, CustomerFormModal, DeliveryFormModal, OrderFormModal,
  PriceFormModal, conditionText,
} from "./forms";
import {
  CancelOrderDialog, CancelPaymentDialog, CancelQuoteDialog, DeliveredDialog, InvoiceDialog, PaymentDialog, ReleaseDialog,
} from "./dialogs";
import { PrintModal } from "./documents";

const TABS = [
  "ข้อมูลหลักลูกค้า",
  "ราคาและส่วนลด",
  "ใบสั่งขาย",
  "จัดส่งสินค้า",
  "วางบิลและใบแจ้งหนี้",
  "วงเงินเครดิตลูกค้า",
];

const ORDER_STATES = ["ทุกสถานะ", "รอยืนยัน", "รออนุมัติเครดิต", "รอจัดส่ง", "ส่งบางส่วน", "รอวางบิล", "วางบิลแล้ว", "เก็บเงินแล้ว", "ยกเลิก"];

const DELIVERY_TONE: Record<string, "ok" | "warn" | "idle"> = {
  ส่งถึงแล้ว: "ok",
  กำลังจัดส่ง: "warn",
};

/* ----------------------------------------------------------------- screen */

export default function SdScreen({
  section,
  onOpenSection,
}: {
  section?: string;
  onOpenSection?: (index: number) => void;
}) {
  useData();
  const tab = section && TABS.includes(section) ? section : undefined;

  const [q, setQ] = useState("");
  const [channel, setChannel] = useState("ทุกช่องทาง");
  const [state, setState] = useState("ทุกสถานะ");
  const [openOrderAt, setOpenOrderAt] = useState<number | null>(null);
  const [openCustomer, setOpenCustomer] = useState<Customer | null>(null);
  const [openQuote, setOpenQuote] = useState<string | null>(null);
  const [openInvoice, setOpenInvoice] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const open: Open = setDialog;
  const close = () => setDialog(null);

  const needle = q.trim().toLowerCase();
  const orderRows = SALES_ORDERS.filter(
    (so) =>
      (channel === "ทุกช่องทาง" || customer(so.customer).channel === channel) &&
      (state === "ทุกสถานะ" || orderState(so) === state) &&
      (needle === "" || [so.no, customer(so.customer).name, so.customerPo ?? ""].some((t) => t.toLowerCase().includes(needle)))
  );
  const pickedOrder = openOrderAt === null ? null : (orderRows[openOrderAt] ?? null);

  /** เปิดแฟ้มใบสั่งขายจากที่ไหนก็ได้ — ล้างตัวกรองก่อน เพื่อให้ปุ่มเลื่อนใบเดินทั้งทะเบียน */
  const openOrder = (no: string) => {
    setQ("");
    setChannel("ทุกช่องทาง");
    setState("ทุกสถานะ");
    setOpenOrderAt(SALES_ORDERS.findIndex((so) => so.no === no));
  };

  const print = (doc: "DO" | "IV" | "CN" | "BN" | "RE") => (no: string) => setDialog({ kind: "print", doc, no });

  const panels = (
    <>
      <DetailModal
        open={pickedOrder !== null}
        title="ใบสั่งขาย"
        onClose={() => setOpenOrderAt(null)}
        index={openOrderAt ?? 0}
        total={orderRows.length}
        onStep={(d) => setOpenOrderAt((i) => Math.min(orderRows.length - 1, Math.max(0, (i ?? 0) + d)))}
      >
        {pickedOrder && <OrderRecord key={pickedOrder.no} so={pickedOrder} open={open} onOpenInvoice={setOpenInvoice} />}
      </DetailModal>

      <FormModal
        open={openCustomer !== null}
        title="แฟ้มลูกค้า"
        subtitle={openCustomer ? `${openCustomer.code} · ${openCustomer.name}` : undefined}
        onClose={() => {
          setOpenCustomer(null);
        }}
      >
        {openCustomer && (
          <CustomerRecord
            c={openCustomer}
            open={open}
            onOpenOrder={(so) => {
              setOpenCustomer(null);
              openOrder(so.no);
            }}
          />
        )}
      </FormModal>

      <FormModal
        open={openQuote !== null}
        size="lg"
        title="ใบเสนอราคา"
        onClose={() => {
          setOpenQuote(null);
        }}
      >
        {openQuote && (
          <QuotationRecord
            no={openQuote}
            open={open}
            onOpenOrder={(no) => {
              setOpenQuote(null);
              openOrder(no);
            }}
          />
        )}
      </FormModal>

      <FormModal
        open={openInvoice !== null}
        size="lg"
        title={openInvoice ? `ใบกำกับภาษี / ใบแจ้งหนี้ ${openInvoice}` : "ใบกำกับภาษี"}
        onClose={() => {
          setOpenInvoice(null);
        }}
      >
        {openInvoice && (
          <InvoiceRecord
            no={openInvoice}
            open={open}
            onOpenOrder={(no) => {
              setOpenInvoice(null);
              openOrder(no);
            }}
          />
        )}
      </FormModal>

      {dialog?.kind === "customer" && (
        <CustomerFormModal
          code={dialog.code}
          onClose={close}
          onSaved={(code) => {
            close();
            setOpenCustomer(customer(code));
          }}
        />
      )}
      {dialog?.kind === "credit" && <CreditFormModal code={dialog.code} onClose={close} />}
      {dialog?.kind === "price" && <PriceFormModal priceKind={dialog.priceKind} keyValue={dialog.key} onClose={close} />}
      {(dialog?.kind === "order" || dialog?.kind === "quote") && (
        <OrderFormModal
          kind={dialog.kind}
          no={dialog.no}
          customer={dialog.customer}
          quotation={dialog.kind === "order" ? dialog.quotation : undefined}
          onClose={close}
          onSaved={(no) => {
            close();
            if (dialog.kind === "quote") {
              setOpenQuote(no);
              return;
            }
            setOpenQuote(null);
            setOpenCustomer(null);
            openOrder(no);
          }}
        />
      )}
      {dialog?.kind === "cancel-order" && <CancelOrderDialog no={dialog.no} onClose={close} />}
      {dialog?.kind === "cancel-quote" && <CancelQuoteDialog no={dialog.no} onClose={close} />}
      {dialog?.kind === "release" && <ReleaseDialog no={dialog.no} onClose={close} />}
      {dialog?.kind === "delivery" && <DeliveryFormModal so={dialog.so} onClose={close} onSaved={print("DO")} />}
      {dialog?.kind === "delivered" && <DeliveredDialog no={dialog.no} onClose={close} />}
      {dialog?.kind === "invoice" && <InvoiceDialog delivery={dialog.delivery} onClose={close} onIssued={print("IV")} />}
      {dialog?.kind === "payment" && <PaymentDialog no={dialog.no} onClose={close} onPaid={print("RE")} />}
      {dialog?.kind === "cancel-payment" && <CancelPaymentDialog no={dialog.no} onClose={close} />}
      {dialog?.kind === "credit-note" && <CreditNoteFormModal invoice={dialog.invoice} onClose={close} onSaved={print("CN")} />}
      {dialog?.kind === "billing-note" && <BillingNoteFormModal customer={dialog.customer} onClose={close} onSaved={print("BN")} />}
      {dialog?.kind === "print" && <PrintModal doc={dialog.doc} no={dialog.no} onClose={close} />}
    </>
  );

  if (!tab) {
    return (
      <>
        <Overview onOpenSection={onOpenSection} onOpenOrder={(so) => openOrder(so.no)} onOpenCustomer={setOpenCustomer} open={open} />
        {panels}
      </>
    );
  }

  const active = activeOrders();
  const editable = SALES_ORDERS.find(canEditOrder);
  const pendingQuote = QUOTATIONS.find((x) => x.status === "รอลูกค้าตอบ");
  const inTransit = DELIVERIES.find((d) => d.status === "กำลังจัดส่ง");
  const unpaid = BILLINGS.find((b) => !b.paid);
  const receipted = BILLINGS.find((b) => b.receipt);

  return (
    <div>
      <PageHead
        title="ขายและกระจายสินค้า"
        meta={`${tab} · ${CUSTOMERS.length} ลูกค้า · ${active.length} ใบสั่งขาย · ยอดขายรวม ${baht(active.reduce((n, so) => n + orderTotal(so).net, 0))}`}
      />

      {tab === "ข้อมูลหลักลูกค้า" && (
        <Customers q={q} setQ={setQ} channel={channel} setChannel={setChannel} onOpen={setOpenCustomer} open={open} />
      )}
      {tab === "ราคาและส่วนลด" && <Pricing open={open} />}
      {tab === "ใบสั่งขาย" && (
        <Orders
          rows={orderRows}
          q={q}
          setQ={setQ}
          channel={channel}
          setChannel={setChannel}
          state={state}
          setState={setState}
          onOpen={(so) => setOpenOrderAt(orderRows.indexOf(so))}
          onOpenQuote={setOpenQuote}
          open={open}
        />
      )}
      {tab === "จัดส่งสินค้า" && <Shipping onOpenOrder={(so) => openOrder(so.no)} open={open} />}
      {tab === "วางบิลและใบแจ้งหนี้" && <Billing onOpenOrder={(so) => openOrder(so.no)} onOpenInvoice={setOpenInvoice} open={open} />}
      {tab === "วงเงินเครดิตลูกค้า" && <Credit onOpenCustomer={setOpenCustomer} onOpenOrder={(so) => openOrder(so.no)} open={open} />}

      {panels}

      <div hidden data-fitt-index>
        <button data-fitt-screen="ขายและกระจายสินค้า" />
        <button data-fitt-screen="ใบสั่งขาย" data-fitt-modal onClick={() => setOpenOrderAt(0)} />
        <button data-fitt-screen="แฟ้มลูกค้า" data-fitt-modal onClick={() => setOpenCustomer(CUSTOMERS[0])} />
        {tab === "ข้อมูลหลักลูกค้า" && (
          <>
            <button data-fitt-screen="เพิ่มลูกค้า" data-fitt-modal onClick={() => open({ kind: "customer" })} />
            <button data-fitt-screen="แก้ไขข้อมูลลูกค้า" data-fitt-modal onClick={() => open({ kind: "customer", code: CUSTOMERS[0].code })} />
          </>
        )}
        {tab === "ราคาและส่วนลด" && (
          <button data-fitt-screen="เปลี่ยนราคาและส่วนลด" data-fitt-modal onClick={() => open({ kind: "price" })} />
        )}
        {tab === "ใบสั่งขาย" && (
          <>
            <button data-fitt-screen="สร้างใบสั่งขาย" data-fitt-modal onClick={() => open({ kind: "order" })} />
            <button data-fitt-screen="แก้ไขใบสั่งขาย" data-fitt-modal onClick={() => editable && open({ kind: "order", no: editable.no })} />
            <button data-fitt-screen="ยกเลิกใบสั่งขาย" data-fitt-modal onClick={() => editable && open({ kind: "cancel-order", no: editable.no })} />
            <button data-fitt-screen="พิมพ์ใบสั่งขาย" data-fitt-modal onClick={() => open({ kind: "print", doc: "SO", no: SALES_ORDERS[0].no })} />
            <button data-fitt-screen="ใบเสนอราคา" data-fitt-modal onClick={() => setOpenQuote(QUOTATIONS[0].no)} />
            <button data-fitt-screen="สร้างใบเสนอราคา" data-fitt-modal onClick={() => open({ kind: "quote" })} />
            <button data-fitt-screen="แก้ไขใบเสนอราคา" data-fitt-modal onClick={() => pendingQuote && open({ kind: "quote", no: pendingQuote.no })} />
            <button data-fitt-screen="ยกเลิกใบเสนอราคา" data-fitt-modal onClick={() => pendingQuote && open({ kind: "cancel-quote", no: pendingQuote.no })} />
            <button data-fitt-screen="พิมพ์ใบเสนอราคา" data-fitt-modal onClick={() => open({ kind: "print", doc: "QT", no: QUOTATIONS[0].no })} />
          </>
        )}
        {tab === "จัดส่งสินค้า" && (
          <>
            <button data-fitt-screen="เปิดใบส่งของ" data-fitt-modal onClick={() => open({ kind: "delivery" })} />
            <button data-fitt-screen="ยืนยันส่งถึง" data-fitt-modal onClick={() => inTransit && open({ kind: "delivered", no: inTransit.no })} />
            <button data-fitt-screen="พิมพ์ใบส่งของ" data-fitt-modal onClick={() => open({ kind: "print", doc: "DO", no: DELIVERIES[0].no })} />
          </>
        )}
        {tab === "วางบิลและใบแจ้งหนี้" && (
          <>
            <button data-fitt-screen="ใบกำกับภาษี" data-fitt-modal onClick={() => setOpenInvoice(BILLINGS[0].no)} />
            <button data-fitt-screen="ออกใบกำกับภาษี" data-fitt-modal onClick={() => open({ kind: "invoice" })} />
            <button data-fitt-screen="พิมพ์ใบกำกับภาษี" data-fitt-modal onClick={() => open({ kind: "print", doc: "IV", no: BILLINGS[0].no })} />
            <button data-fitt-screen="รับชำระเงิน" data-fitt-modal onClick={() => unpaid && open({ kind: "payment", no: unpaid.no })} />
            <button data-fitt-screen="พิมพ์ใบเสร็จรับเงิน" data-fitt-modal onClick={() => receipted && open({ kind: "print", doc: "RE", no: receipted.no })} />
            <button data-fitt-screen="ยกเลิกใบเสร็จรับเงิน" data-fitt-modal onClick={() => receipted && open({ kind: "cancel-payment", no: receipted.no })} />
            <button data-fitt-screen="ออกใบลดหนี้" data-fitt-modal onClick={() => open({ kind: "credit-note" })} />
            <button data-fitt-screen="พิมพ์ใบลดหนี้" data-fitt-modal onClick={() => open({ kind: "print", doc: "CN", no: CREDIT_NOTES[0].no })} />
            <button data-fitt-screen="ทำใบวางบิล" data-fitt-modal onClick={() => open({ kind: "billing-note" })} />
            <button data-fitt-screen="พิมพ์ใบวางบิล" data-fitt-modal onClick={() => open({ kind: "print", doc: "BN", no: BILLING_NOTES[0].no })} />
          </>
        )}
        {tab === "วงเงินเครดิตลูกค้า" && (
          <>
            <button data-fitt-screen="ปรับวงเงินเครดิต" data-fitt-modal onClick={() => open({ kind: "credit", code: CUSTOMERS[0].code })} />
            <button data-fitt-screen="อนุมัติเครดิต" data-fitt-modal onClick={() => open({ kind: "release" })} />
          </>
        )}
      </div>
    </div>
  );
}

const seeAllButton = (onOpenSection: ((index: number) => void) | undefined, index: number) =>
  onOpenSection ? (
    <button
      onClick={() => onOpenSection(index)}
      className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[12px] text-slate-600 transition hover:border-violet-300 hover:text-violet-700 dark:border-slate-700 dark:text-slate-300"
    >
      ดูทั้งหมด <ArrowRight size={12} />
    </button>
  ) : undefined;

/* ------------------------------------------------------------- overview */

function Overview({
  onOpenSection,
  onOpenOrder,
  onOpenCustomer,
  open,
}: {
  onOpenSection?: (index: number) => void;
  onOpenOrder: (so: SalesOrder) => void;
  onOpenCustomer: (c: Customer) => void;
  open: Open;
}) {
  useData();
  const orders = activeOrders();
  const totals = orders.map((so) => ({ so, t: orderTotal(so) }));
  const net = totals.reduce((n, x) => n + x.t.net, 0);
  // เงินที่รับเข้ามาจริงตามใบเสร็จ กับยอดที่ลูกค้ายังค้าง (ผูกพันแล้วแต่ยังไม่จ่าย)
  const collected = BILLINGS.reduce((n, b) => n + (b.receipt?.amount ?? 0), 0);
  const outstanding = CUSTOMERS.reduce((n, c) => n + creditCheck(c.code).used, 0);
  const both = Math.max(1, collected + outstanding);

  const byChannel = CHANNELS.map((ch) => ({
    label: ch,
    value: totals.filter((x) => customer(x.so.customer).channel === ch).reduce((n, x) => n + x.t.net, 0),
    swatch: channelSwatch(ch),
  })).filter((s) => s.value > 0);

  const byProduct = CATALOG.map((p) => {
    const qty = orders.flatMap((so) => so.lines).filter((l) => l.material === p.code).reduce((n, l) => n + l.qty, 0);
    return { p, qty, list: listPriceOn(p.code, TODAY), value: qty * listPriceOn(p.code, TODAY) };
  }).filter((x) => x.qty > 0);

  const pipeline = orders.map((so) => ({ so, stage: stageOf(so) }));
  const unbilled = uninvoicedDeliveries();
  const overLimit = CUSTOMERS.filter((c) => creditCheck(c.code).blocked);
  const seeAll = (index: number) => seeAllButton(onOpenSection, index);

  return (
    <div>
      <PageHead
        title="ภาพรวมการขาย"
        meta={`${CUSTOMERS.length} ลูกค้า · ${orders.length} ใบสั่งขาย · ข้อมูล ณ ${TODAY}`}
        right={
          <span className="flex flex-wrap gap-2">
            {onOpenSection && (
              <Button variant="secondary" icon={<ShoppingBag size={15} />} onClick={() => onOpenSection(2)}>
                เปิดใบสั่งขาย
              </Button>
            )}
            <Button variant="primary" icon={<Plus size={15} />} onClick={() => open({ kind: "order" })}>
              สร้างใบสั่งขาย
            </Button>
          </span>
        }
      />

      <Reveal>
        <div className="grid gap-3 xl:grid-cols-3">
          <Card
            className="xl:col-span-2"
            title={<span className="flex items-center gap-2"><Coins size={15} className="text-slate-400" />ยอดขายและการเก็บเงิน</span>}
            action={seeAll(2)}
          >
            <div className="p-4">
              <p className="text-[32px] font-semibold leading-none tabular-nums text-slate-900 dark:text-slate-50">{baht(net)}</p>
              <p className="mt-1.5 text-[12.5px] text-slate-500 dark:text-slate-400">
                ยอดก่อนภาษีจาก {orders.length} ใบสั่งขาย · รับเงินแล้วกับยอดค้างรวมภาษี {baht(collected + outstanding)}
              </p>
              <div className="mt-4 space-y-2.5">
                <div className="flex items-center gap-3">
                  <span className="w-28 shrink-0 text-[12.5px] text-slate-600 dark:text-slate-300">เก็บเงินแล้ว</span>
                  <span className="min-w-0 flex-1">
                    <Bar pct={(collected / both) * 100} tone="ok" width="w-full" />
                  </span>
                  <span className="w-32 shrink-0 text-right text-[12.5px] tabular-nums text-slate-700 dark:text-slate-200">{baht(collected)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-28 shrink-0 text-[12.5px] text-slate-600 dark:text-slate-300">ยังไม่เก็บเงิน</span>
                  <span className="min-w-0 flex-1">
                    <Bar pct={(outstanding / both) * 100} tone="warn" width="w-full" />
                  </span>
                  <span className="w-32 shrink-0 text-right text-[12.5px] tabular-nums text-slate-700 dark:text-slate-200">{baht(outstanding)}</span>
                </div>
              </div>

              <div className="mt-5">
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-400">ใบสั่งขายอยู่ขั้นไหน</p>
                <ul className="space-y-1.5">
                  {pipeline.map(({ so, stage }) => (
                    <li key={so.no} className="flex flex-wrap items-center gap-3">
                      <button onClick={() => onOpenOrder(so)} className="w-36 shrink-0 text-left font-mono text-[12px] text-slate-500 transition hover:text-violet-700 dark:text-slate-400">
                        {so.no}
                      </button>
                      <span className="w-40 shrink-0 truncate text-[12.5px] text-slate-700 dark:text-slate-200">
                        {customer(so.customer).name}
                      </span>
                      <span className="min-w-0 flex-1">
                        <Bar pct={((stage + 1) / ORDER_FLOW.length) * 100} tone={stage === 3 ? "ok" : stage === 0 ? "idle" : "accent"} width="w-full" />
                      </span>
                      <span className="w-28 shrink-0 text-right text-[11.5px] text-slate-400">{orderState(so)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>

          <Card
            title={<span className="flex items-center gap-2"><TriangleAlert size={15} className="text-slate-400" />ต้องจัดการ</span>}
            action={seeAll(4)}
          >
            <div className="space-y-2.5 p-4">
              {[
                { icon: <ShieldCheck size={15} />, label: "ใบสั่งขายรออนุมัติเครดิต", value: heldOrders().length, unit: "ใบ", tone: "bad" as const, to: 5 },
                { icon: <Receipt size={15} />, label: "ส่งของแล้วยังไม่วางบิล", value: unbilled.length, unit: "ใบ", tone: "warn" as const, to: 4 },
                { icon: <ShieldAlert size={15} />, label: "ลูกค้าเกินวงเงินเครดิต", value: overLimit.length, unit: "ราย", tone: "bad" as const, to: 5 },
                { icon: <Truck size={15} />, label: "ใบสั่งขายที่ยังค้างส่ง", value: orders.filter(canShip).length, unit: "ใบ", tone: "info" as const, to: 3 },
                { icon: <CreditCard size={15} />, label: "ใบแจ้งหนี้ที่ยังไม่เก็บเงิน", value: BILLINGS.filter((b) => !b.paid).length, unit: "ใบ", tone: "warn" as const, to: 4 },
              ].map((r) => (
                <button
                  key={r.label}
                  onClick={() => onOpenSection?.(r.to)}
                  className="flex w-full items-center gap-3 rounded-xl bg-slate-50 px-3.5 py-3 text-left transition hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-800"
                >
                  <span className="text-slate-400">{r.icon}</span>
                  <span className="min-w-0 flex-1 text-[12.5px] text-slate-700 dark:text-slate-200">{r.label}</span>
                  <Badge tone={r.value > 0 ? r.tone : "ok"}>
                    {r.value} {r.unit}
                  </Badge>
                </button>
              ))}
            </div>
          </Card>
        </div>
      </Reveal>

      <Reveal delay={0.08} className="mt-3">
        <div className="grid gap-3 xl:grid-cols-3">
          <Card title={<span className="flex items-center gap-2"><Tags size={15} className="text-slate-400" />ยอดขายตามช่องทาง</span>} action={seeAll(0)}>
            <div className="p-4">
              <Donut
                segments={byChannel}
                size={128}
                format={(n) => baht(n)}
                center={
                  <span>
                    <span className="block text-[20px] font-semibold leading-none tabular-nums text-slate-900 dark:text-slate-50">
                      {CHANNELS.length}
                    </span>
                    <span className="mt-1 block text-[10.5px] uppercase tracking-wide text-slate-400">ช่องทาง</span>
                  </span>
                }
              />
            </div>
          </Card>

          <Card
            className="xl:col-span-2"
            title={<span className="flex items-center gap-2"><Package size={15} className="text-slate-400" />สินค้าที่ขายได้</span>}
            subtitle="จำนวนและมูลค่าตามราคาตั้ง ก่อนส่วนลดของแต่ละใบ"
            action={seeAll(1)}
          >
            <ColumnChart
              data={byProduct.map((x) => ({ label: x.p.name.slice(0, 12), value: x.qty }))}
              format={(n) => n + " หน่วย"}
              height={160}
            />
            <ul className="divide-y divide-slate-100 border-t border-slate-100 dark:divide-slate-800 dark:border-slate-800">
              {byProduct.map((x) => {
                const margin = x.list - material(x.p.code).price;
                return (
                  <li key={x.p.code} className="flex flex-wrap items-center gap-3 px-4 py-2">
                    <span className="w-52 shrink-0 truncate text-[12.5px] text-slate-800 dark:text-slate-100">{x.p.name}</span>
                    <span className="shrink-0 text-[11.5px] tabular-nums text-slate-400">
                      {x.qty} {x.p.unit}
                    </span>
                    <span className="min-w-0 flex-1">
                      <Bar pct={(margin / x.list) * 100} tone="ok" width="w-full" />
                    </span>
                    <span className="w-40 shrink-0 text-right text-[11.5px] tabular-nums text-slate-500 dark:text-slate-400">
                      กำไรขั้นต้น {baht(margin)}/หน่วย
                    </span>
                    <span className="w-28 shrink-0 text-right text-[12.5px] tabular-nums text-slate-900 dark:text-slate-50">{baht(x.value)}</span>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      </Reveal>

      <Reveal delay={0.16} className="mt-3">
        <Card
          title={<span className="flex items-center gap-2"><ShieldAlert size={15} className="text-slate-400" />วงเงินเครดิตลูกค้า</span>}
          subtitle="ยอดค้างคิดจากใบสั่งขายที่ยังไม่ออกใบกำกับ บวกใบกำกับที่ยังไม่เก็บเงิน ลูกค้าที่ใช้เกินวงเงิน ใบถัดไปจะรออนุมัติ"
          action={seeAll(5)}
        >
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {CUSTOMERS.map((c) => {
              const cr = creditCheck(c.code);
              return (
                <li key={c.code} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                  <Avatar name={shortName(c.name)} size="sm" />
                  <button onClick={() => onOpenCustomer(c)} className="w-52 shrink-0 text-left">
                    <span className="block truncate text-[13px] text-slate-900 dark:text-slate-50">{c.name}</span>
                    <span className="block truncate text-[11px] text-slate-400">{c.channel} · {c.terms}</span>
                  </button>
                  <span className="min-w-0 flex-1">
                    {cr.cashOnly ? (
                      <span className="text-[11.5px] text-slate-400">ขายเงินสดเท่านั้น ไม่มีวงเงิน</span>
                    ) : (
                      <Bar pct={Math.min(100, (cr.used / cr.limit) * 100)} tone={cr.blocked ? "bad" : cr.used / cr.limit > 0.8 ? "warn" : "ok"} width="w-full" />
                    )}
                  </span>
                  <span className="w-48 shrink-0 text-right text-[11.5px] tabular-nums text-slate-500 dark:text-slate-400">
                    {cr.cashOnly ? "—" : `ใช้ ${baht(cr.used)} จาก ${baht(cr.limit)}`}
                  </span>
                  <Badge tone={cr.cashOnly ? "idle" : cr.blocked ? "bad" : "ok"}>
                    {cr.cashOnly ? "เงินสด" : cr.blocked ? "เกินวงเงิน" : "อยู่ในวงเงิน"}
                  </Badge>
                </li>
              );
            })}
          </ul>
        </Card>
      </Reveal>
    </div>
  );
}

/* ------------------------------------------------------------- customers */

function Customers({
  q,
  setQ,
  channel,
  setChannel,
  onOpen,
  open,
}: {
  q: string;
  setQ: (v: string) => void;
  channel: string;
  setChannel: (v: string) => void;
  onOpen: (c: Customer) => void;
  open: Open;
}) {
  useData();
  const needle = q.trim().toLowerCase();
  const rows = CUSTOMERS.filter(
    (c) =>
      (channel === "ทุกช่องทาง" || c.channel === channel) &&
      (needle === "" || [c.code, c.name, c.contact, c.address, c.taxId].some((t) => t.toLowerCase().includes(needle)))
  );

  const columns: Column<Customer>[] = [
    {
      key: "name",
      header: "ลูกค้า",
      width: "30%",
      sort: (a, b) => a.name.localeCompare(b.name, "th"),
      cell: (c) => (
        <span className="flex items-center gap-2.5">
          <Avatar name={shortName(c.name)} size="sm" />
          <span>
            <span className="block font-medium text-slate-900 dark:text-slate-50">{c.name}</span>
            <span className="block font-mono text-[11px] text-slate-400">{c.code}</span>
          </span>
        </span>
      ),
    },
    {
      key: "channel",
      header: "ช่องทาง",
      width: "16%",
      sort: (a, b) => CHANNELS.indexOf(a.channel) - CHANNELS.indexOf(b.channel),
      cell: (c) => <Tag swatch={channelSwatch(c.channel)}>{c.channel}</Tag>,
    },
    { key: "contact", header: "ผู้ติดต่อ", width: "14%", cell: (c) => <span className="text-slate-600 dark:text-slate-300">{c.contact}</span> },
    { key: "address", header: "พื้นที่", width: "12%", cell: (c) => <span className="text-slate-500 dark:text-slate-400">{c.address}</span> },
    { key: "terms", header: "เงื่อนไขชำระ", width: "14%", cell: (c) => <span className="text-slate-600 dark:text-slate-300">{c.terms}</span> },
    {
      key: "limit",
      header: "วงเงินเครดิต",
      align: "right",
      width: "14%",
      sort: (a, b) => a.creditLimit - b.creditLimit,
      cell: (c) => (
        <span className="tabular-nums text-slate-700 dark:text-slate-200">{c.creditLimit ? baht(c.creditLimit) : "เงินสด"}</span>
      ),
    },
  ];

  const exportRows = () =>
    downloadCsv(
      `ลูกค้า-${TODAY}`,
      ["รหัส", "ชื่อลูกค้า", "ช่องทาง", "ผู้ติดต่อ", "โทรศัพท์", "จังหวัด", "สำนักงาน", "เลขผู้เสียภาษี", "ที่อยู่ออกใบกำกับ", "เงื่อนไขชำระ", "วงเงินเครดิต"],
      rows.map((c) => [c.code, c.name, c.channel, c.contact, c.phone, c.address, c.branch, c.taxId, c.billingAddress, c.terms, c.creditLimit])
    );

  return (
    <DataTable
      rows={rows}
      columns={columns}
      getId={(c) => c.code}
      onOpen={onOpen}
      trailing={(c) => (
        <IconButton label="แก้ไขข้อมูลลูกค้า" onClick={() => open({ kind: "customer", code: c.code })} className="border-transparent bg-transparent dark:bg-transparent">
          <Pencil size={14} />
        </IconButton>
      )}
      toolbar={
        <div className="flex flex-wrap items-center gap-2">
          <Search value={q} onChange={setQ} placeholder="ค้นหาชื่อลูกค้า รหัส เลขผู้เสียภาษี หรือพื้นที่" icon={<SearchIcon size={14} />} />
          <Select value={channel} onChange={setChannel} options={["ทุกช่องทาง", ...CHANNELS]} />
          <span className="ml-auto text-[12px] text-slate-400">แสดง {rows.length} ราย</span>
          <ExportButton onClick={exportRows} />
          <Button variant="primary" icon={<UserPlus size={15} />} onClick={() => open({ kind: "customer" })}>
            เพิ่มลูกค้า
          </Button>
        </div>
      }
    />
  );
}

/* --------------------------------------------------------------- pricing */

function Pricing({ open }: { open: Open }) {
  useData();
  const upcoming = scheduledChanges();
  const nextFor = (kind: PriceKind, key: string) => upcoming.filter((c) => c.kind === kind && c.key === key).at(-1);
  const edit = (priceKind: PriceKind, key: string) => (
    <IconButton label="เปลี่ยน" onClick={() => open({ kind: "price", priceKind, key })} className="border-transparent bg-transparent dark:bg-transparent">
      <Pencil size={13} />
    </IconButton>
  );

  const exportRows = () =>
    downloadCsv(
      `ราคาขาย-${TODAY}`,
      ["รหัส", "สินค้า", "หน่วย", "ต้นทุนมาตรฐาน", "ราคาตั้ง", "กำไรต่อหน่วย", "ราคาใหม่", "มีผล"],
      CATALOG.map((p) => {
        const list = listPriceOn(p.code, TODAY);
        const next = nextFor("ราคาตั้ง", p.code);
        return [p.code, p.name, p.unit, material(p.code).price, list, list - material(p.code).price, next?.to ?? "", next?.effective ?? ""];
      })
    );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[12px] text-slate-400">ราคาและส่วนลด ณ {TODAY} · ใบที่ออกไปแล้วถือราคาตามวันของใบ</span>
        <span className="ml-auto" />
        <ExportButton onClick={exportRows} />
        <Button variant="primary" icon={<Tags size={15} />} onClick={() => open({ kind: "price" })}>
          เปลี่ยนราคาและส่วนลด
        </Button>
      </div>

      <Card
        title={<span className="flex items-center gap-2"><Tags size={15} className="text-slate-400" />ราคาตั้ง</span>}
        subtitle="เทียบกับต้นทุนมาตรฐานในแฟ้มวัสดุ เพื่อดูกำไรขั้นต้นต่อหน่วยก่อนส่วนลด"
      >
        <table className="w-full text-[13px]">
          <thead className="bg-slate-50/80 text-left text-[11px] uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">สินค้า</th>
              <th className="px-4 py-3 text-right font-medium">ต้นทุนมาตรฐาน</th>
              <th className="px-4 py-3 text-right font-medium">ราคาตั้ง</th>
              <th className="px-4 py-3 font-medium">อัตรากำไรขั้นต้น</th>
              <th className="px-4 py-3 text-right font-medium">กำไรต่อหน่วย</th>
              <th className="px-4 py-3 font-medium">ประกาศใหม่</th>
              <th className="w-12 px-2 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {CATALOG.map((p) => {
              const cost = material(p.code).price;
              const list = listPriceOn(p.code, TODAY);
              const margin = list - cost;
              const next = nextFor("ราคาตั้ง", p.code);
              return (
                <tr key={p.code} className="transition hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-2.5">
                    <span className="block text-slate-900 dark:text-slate-50">{p.name}</span>
                    <span className="block font-mono text-[11px] text-slate-400">{p.code}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-300">{baht(cost)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-900 dark:text-slate-50">{baht(list)}</td>
                  <td className="px-4 py-2.5">
                    <Bar pct={(margin / list) * 100} tone="ok" width="w-28" />
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">{baht(margin)}</td>
                  <td className="px-4 py-2.5">{next ? <Badge tone="info">{baht(next.to)} มีผล {next.effective}</Badge> : <span className="text-slate-300 dark:text-slate-600">—</span>}</td>
                  <td className="px-2 py-2.5">{edit("ราคาตั้ง", p.code)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card
          title={<span className="flex items-center gap-2"><Users size={15} className="text-slate-400" />ส่วนลดตามช่องทางขาย</span>}
          subtitle="ประกาศไว้ล่วงหน้า ทุกใบสั่งขายคิดตามนี้โดยอัตโนมัติ"
        >
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {CHANNELS.map((ch) => {
              const d = channelDiscountOn(ch, TODAY);
              const next = nextFor("ส่วนลดช่องทาง", ch);
              return (
                <li key={ch} className="flex items-center gap-3 px-4 py-3">
                  <Dot className={channelSwatch(ch).dot} />
                  <span className="min-w-0 flex-1 text-[13px] text-slate-800 dark:text-slate-100">{ch}</span>
                  <span className="shrink-0 text-[11.5px] text-slate-400">
                    {CUSTOMERS.filter((c) => c.channel === ch).length} ลูกค้า
                  </span>
                  {next && <Badge tone="info">ลด {pct(next.to)} มีผล {next.effective}</Badge>}
                  <Badge tone={d > 0 ? "accent" : "idle"}>ลด {pct(d)}</Badge>
                  {edit("ส่วนลดช่องทาง", ch)}
                </li>
              );
            })}
          </ul>
        </Card>

        <Card
          title={<span className="flex items-center gap-2"><Percent size={15} className="text-slate-400" />ส่วนลดตามจำนวนที่สั่ง</span>}
          subtitle="คิดเพิ่มจากส่วนลดช่องทาง โดยดูจำนวนต่อบรรทัด"
        >
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {volumeBreaksOn(TODAY).map((b) => {
              const next = nextFor("ส่วนลดตามจำนวน", String(b.minQty));
              return (
                <li key={b.minQty} className="flex items-center gap-3 px-4 py-3">
                  <span className="min-w-0 flex-1 text-[13px] text-slate-800 dark:text-slate-100">ตั้งแต่ {b.minQty} หน่วยขึ้นไป</span>
                  <span className="min-w-0 flex-1">
                    <Bar pct={b.discount * 1000} tone="accent" width="w-full" />
                  </span>
                  {next && <Badge tone="info">{pct(next.to)} มีผล {next.effective}</Badge>}
                  <Badge tone="accent">ลดเพิ่ม {pct(b.discount)}</Badge>
                  {edit("ส่วนลดตามจำนวน", String(b.minQty))}
                </li>
              );
            })}
          </ul>
          <div className="px-4 pb-4">
            <Note tone="idle">
              ภาษีมูลค่าเพิ่ม {Math.round(VAT_RATE * 100)}% คิดจากยอดหลังหักส่วนลดทั้งสองชั้นแล้ว
            </Note>
          </div>
        </Card>
      </div>

      <Card
        title={<span className="flex items-center gap-2"><CalendarClock size={15} className="text-slate-400" />ประวัติการประกาศราคา</span>}
        subtitle="ไม่มีการเขียนทับ ราคาในวันหนึ่งคือรายการล่าสุดที่มีผลแล้ว ณ วันนั้น"
      >
        {PRICE_CHANGES.length === 0 ? (
          <p className="py-8 text-center text-[12.5px] text-slate-400">ยังไม่มีการเปลี่ยนราคา</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {[...PRICE_CHANGES].reverse().map((c) => (
              <li key={c.no} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-[12.5px]">
                <span className="w-28 shrink-0 font-mono text-[12px] text-slate-500 dark:text-slate-400">{c.no}</span>
                <Chip>{c.kind}</Chip>
                <span className="text-slate-800 dark:text-slate-100">{c.kind === "ส่วนลดตามจำนวน" ? `ตั้งแต่ ${c.key} หน่วย` : c.key}</span>
                <span className="tabular-nums text-slate-500 dark:text-slate-400">
                  {conditionText(c.kind, c.from)} → <b className="text-slate-900 dark:text-slate-50">{conditionText(c.kind, c.to)}</b>
                </span>
                <span className="min-w-0 flex-1 truncate text-slate-400">{c.reason}</span>
                <Badge tone={c.effective > TODAY ? "info" : "ok"}>{c.effective > TODAY ? `มีผล ${c.effective}` : `มีผลแล้ว ${c.effective}`}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/* ---------------------------------------------------------------- orders */

function Orders({
  rows,
  q,
  setQ,
  channel,
  setChannel,
  state,
  setState,
  onOpen,
  onOpenQuote,
  open,
}: {
  rows: SalesOrder[];
  q: string;
  setQ: (v: string) => void;
  channel: string;
  setChannel: (v: string) => void;
  state: string;
  setState: (v: string) => void;
  onOpen: (so: SalesOrder) => void;
  onOpenQuote: (no: string) => void;
  open: Open;
}) {
  useData();
  const [view, setView] = useState("ใบสั่งขาย");

  const columns: Column<SalesOrder>[] = [
    {
      key: "no",
      header: "เลขที่",
      width: "15%",
      sort: (a, b) => a.no.localeCompare(b.no),
      cell: (so) => <span className="font-mono text-[12px] text-slate-500 dark:text-slate-400">{so.no}</span>,
    },
    {
      key: "customer",
      header: "ลูกค้า",
      width: "25%",
      sort: (a, b) => customer(a.customer).name.localeCompare(customer(b.customer).name, "th"),
      cell: (so) => (
        <span className="flex items-center gap-2.5">
          <Avatar name={shortName(customer(so.customer).name)} size="sm" />
          <span>
            <span className="block font-medium text-slate-900 dark:text-slate-50">{customer(so.customer).name}</span>
            <span className="block text-[11px] text-slate-400">{customer(so.customer).channel}</span>
          </span>
        </span>
      ),
    },
    { key: "date", header: "วันที่", width: "11%", sort: (a, b) => a.date.localeCompare(b.date), cell: (so) => <span className="tabular-nums text-slate-500 dark:text-slate-400">{so.date}</span> },
    { key: "lines", header: "รายการ", align: "right", width: "7%", cell: (so) => <span className="tabular-nums text-slate-600 dark:text-slate-300">{so.lines.length}</span> },
    {
      key: "net",
      header: "ก่อนภาษี",
      align: "right",
      width: "13%",
      sort: (a, b) => orderTotal(a).net - orderTotal(b).net,
      cell: (so) => <span className="tabular-nums text-slate-700 dark:text-slate-200">{baht(orderTotal(so).net)}</span>,
    },
    {
      key: "gross",
      header: "รวมภาษี",
      align: "right",
      width: "13%",
      sort: (a, b) => orderTotal(a).gross - orderTotal(b).gross,
      cell: (so) => <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-50">{baht(orderTotal(so).gross)}</span>,
    },
    { key: "stage", header: "สถานะ", width: "14%", cell: (so) => <OrderBadge so={so} /> },
  ];

  const quoteColumns: Column<Quotation>[] = [
    { key: "no", header: "เลขที่", width: "15%", sort: (a, b) => a.no.localeCompare(b.no), cell: (x) => <span className="font-mono text-[12px] text-slate-500 dark:text-slate-400">{x.no}</span> },
    {
      key: "customer",
      header: "ลูกค้า",
      width: "28%",
      cell: (x) => (
        <span className="flex items-center gap-2.5">
          <Avatar name={shortName(customer(x.customer).name)} size="sm" />
          <span className="font-medium text-slate-900 dark:text-slate-50">{customer(x.customer).name}</span>
        </span>
      ),
    },
    { key: "date", header: "วันที่", width: "12%", sort: (a, b) => a.date.localeCompare(b.date), cell: (x) => <span className="tabular-nums text-slate-500 dark:text-slate-400">{x.date}</span> },
    { key: "until", header: "ยืนราคาถึง", width: "12%", cell: (x) => <span className="tabular-nums text-slate-500 dark:text-slate-400">{x.validUntil}</span> },
    { key: "gross", header: "รวมภาษี", align: "right", width: "15%", sort: (a, b) => linesTotal(a.lines).gross - linesTotal(b.lines).gross, cell: (x) => <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-50">{baht(linesTotal(x.lines).gross)}</span> },
    { key: "state", header: "สถานะ", width: "18%", cell: (x) => <span className="flex flex-wrap items-center gap-1.5"><QuoteBadge q={x} />{x.so && <span className="font-mono text-[11px] text-slate-400">{x.so}</span>}</span> },
  ];

  const exportOrders = () =>
    downloadCsv(
      `ใบสั่งขาย-${TODAY}`,
      ["เลขที่", "วันที่", "ลูกค้า", "ช่องทาง", "ใบสั่งซื้อลูกค้า", "รายการ", "ก่อนภาษี", "ภาษีมูลค่าเพิ่ม", "รวมภาษี", "สถานะ"],
      rows.map((so) => {
        const t = orderTotal(so);
        const c = customer(so.customer);
        return [so.no, so.date, c.name, c.channel, so.customerPo ?? "", so.lines.length, t.net, t.vat, t.gross, orderState(so)];
      })
    );
  const exportQuotes = () =>
    downloadCsv(
      `ใบเสนอราคา-${TODAY}`,
      ["เลขที่", "วันที่", "ยืนราคาถึง", "ลูกค้า", "ก่อนภาษี", "ภาษีมูลค่าเพิ่ม", "รวมภาษี", "สถานะ", "ใบสั่งขาย"],
      QUOTATIONS.map((x) => {
        const t = linesTotal(x.lines);
        return [x.no, x.date, x.validUntil, customer(x.customer).name, t.net, t.vat, t.gross, quoteState(x), x.so ?? ""];
      })
    );

  const switcher = (
    <Segmented
      options={["ใบสั่งขาย", "ใบเสนอราคา"]}
      value={view}
      onChange={setView}
      counts={{ ใบสั่งขาย: SALES_ORDERS.length, ใบเสนอราคา: QUOTATIONS.length }}
    />
  );

  if (view === "ใบเสนอราคา") {
    return (
      <DataTable
        rows={[...QUOTATIONS].reverse()}
        columns={quoteColumns}
        getId={(x) => x.no}
        onOpen={(x) => onOpenQuote(x.no)}
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            {switcher}
            <span className="ml-auto text-[12px] text-slate-400">
              รอลูกค้าตอบ {QUOTATIONS.filter((x) => quoteState(x) === "รอลูกค้าตอบ").length} ใบ
            </span>
            <ExportButton onClick={exportQuotes} />
            <Button variant="primary" icon={<FilePlus size={15} />} onClick={() => open({ kind: "quote" })}>
              สร้างใบเสนอราคา
            </Button>
          </div>
        }
      />
    );
  }

  return (
    <DataTable
      rows={rows}
      columns={columns}
      getId={(so) => so.no}
      onOpen={onOpen}
      trailing={(so) => (
        <span className="inline-flex items-center gap-1">
          <IconButton label="พิมพ์ใบสั่งขาย" onClick={() => open({ kind: "print", doc: "SO", no: so.no })} className="border-transparent bg-transparent dark:bg-transparent">
            <Printer size={14} />
          </IconButton>
          {canEditOrder(so) && (
            <IconButton label="แก้ไขใบสั่งขาย" onClick={() => open({ kind: "order", no: so.no })} className="border-transparent bg-transparent dark:bg-transparent">
              <Pencil size={14} />
            </IconButton>
          )}
        </span>
      )}
      toolbar={
        <div className="flex flex-wrap items-center gap-2">
          {switcher}
          <Search value={q} onChange={setQ} placeholder="ค้นหาเลขที่ ลูกค้า หรือเลขใบสั่งซื้อลูกค้า" icon={<SearchIcon size={14} />} className="w-60" />
          <Select value={channel} onChange={setChannel} options={["ทุกช่องทาง", ...CHANNELS]} />
          <Select value={state} onChange={setState} options={ORDER_STATES} />
          <span className="ml-auto text-[12px] text-slate-400">
            รวม {baht(rows.filter((so) => so.status !== "ยกเลิก").reduce((n, so) => n + orderTotal(so).gross, 0))}
          </span>
          <ExportButton onClick={exportOrders} />
          <Button variant="primary" icon={<Plus size={15} />} onClick={() => open({ kind: "order" })}>
            สร้างใบสั่งขาย
          </Button>
        </div>
      }
    />
  );
}

/* -------------------------------------------------------------- shipping */

function Shipping({ onOpenOrder, open }: { onOpenOrder: (so: SalesOrder) => void; open: Open }) {
  useData();
  const pending = activeOrders().filter((so) => openLines(so).some((l) => l.open > 0));

  const exportRows = () =>
    downloadCsv(
      `ใบส่งของ-${TODAY}`,
      ["เลขที่", "วันที่", "ใบสั่งขาย", "ลูกค้า", "ปลายทาง", "ผู้ขนส่ง", "รายการ", "สถานะ", "ผู้รับ", "วันที่ส่งถึง", "ใบกำกับ"],
      DELIVERIES.map((d) => [
        d.no, d.date, d.so, customer(salesOrder(d.so).customer).name, d.route, d.carrier,
        d.lines.map((l) => `${material(l.material).name} × ${l.qty}`).join(" · "), d.status, d.receivedBy ?? "", d.deliveredOn ?? "",
        invoiceOf(d.no)?.no ?? "",
      ])
    );

  return (
    <div className="space-y-3">
      <StatStrip
        title="การจัดส่ง"
        icon={<Truck size={15} />}
        cells={[
          { icon: <Truck size={13} />, label: "ใบส่งของทั้งหมด", value: DELIVERIES.length + " ใบ", sub: "อ้างถึงใบสั่งขายที่เป็นต้นเรื่อง" },
          { icon: <CircleCheck size={13} />, label: "ส่งถึงแล้ว", value: DELIVERIES.filter((d) => d.status === "ส่งถึงแล้ว").length + " ใบ", sub: "พร้อมออกใบกำกับภาษี", tone: "ok" },
          { icon: <MapPin size={13} />, label: "กำลังจัดส่ง", value: DELIVERIES.filter((d) => d.status === "กำลังจัดส่ง").length + " ใบ", sub: "อยู่ระหว่างทาง", tone: "warn" },
          { icon: <Package size={13} />, label: "ใบสั่งขายค้างส่ง", value: pending.length + " ใบ", sub: "ยังมีของที่ยังไม่ได้ส่ง", tone: pending.length > 0 ? "info" : "ok" },
        ]}
      />

      <div className="flex flex-wrap items-center justify-end gap-2">
        <ExportButton onClick={exportRows} />
        <Button variant="primary" icon={<Truck size={15} />} onClick={() => open({ kind: "delivery" })}>
          เปิดใบส่งของ
        </Button>
      </div>

      <Card
        title={<span className="flex items-center gap-2"><Truck size={15} className="text-slate-400" />ใบส่งของ</span>}
        subtitle="เส้นทาง ผู้ขนส่ง และรายการที่ส่งไปในแต่ละเที่ยว"
      >
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {[...DELIVERIES].reverse().map((d) => {
            const so = salesOrder(d.so);
            return (
              <li key={d.no} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className={"grid size-9 shrink-0 place-items-center rounded-xl " + (d.status === "ส่งถึงแล้ว" ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300" : "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300")}>
                  <Truck size={16} />
                </span>
                <span className="w-36 shrink-0">
                  <span className="block font-mono text-[12px] text-slate-500 dark:text-slate-400">{d.no}</span>
                  <span className="block text-[11px] tabular-nums text-slate-400">{d.date}</span>
                </span>
                <button onClick={() => onOpenOrder(so)} className="w-44 shrink-0 text-left">
                  <span className="block truncate text-[13px] text-slate-900 dark:text-slate-50">{customer(so.customer).name}</span>
                  <span className="block font-mono text-[11px] text-violet-700 dark:text-violet-300">{d.so}</span>
                </button>
                <span className="min-w-0 flex-1 text-[12.5px] text-slate-600 dark:text-slate-300">
                  {d.lines.map((l) => `${material(l.material).name} × ${l.qty}`).join(" · ")}
                </span>
                <Chip>
                  <span className="flex items-center gap-1">
                    <MapPin size={11} />
                    {d.route}
                  </span>
                </Chip>
                <span className="w-32 shrink-0 truncate text-[11.5px] text-slate-400">{d.carrier}</span>
                <Badge tone={DELIVERY_TONE[d.status] ?? "idle"} dot>{d.status}</Badge>
                <span className="flex shrink-0 items-center gap-1">
                  <IconButton label="พิมพ์ใบส่งของ" onClick={() => open({ kind: "print", doc: "DO", no: d.no })}>
                    <Printer size={14} />
                  </IconButton>
                  {d.status === "กำลังจัดส่ง" && (
                    <Button variant="secondary" icon={<CircleCheck size={13} />} onClick={() => open({ kind: "delivered", no: d.no })} className="px-2.5 py-1.5 text-[12px]">
                      ยืนยันส่งถึง
                    </Button>
                  )}
                  {d.status === "ส่งถึงแล้ว" && !invoiceOf(d.no) && (
                    <Button variant="primary" icon={<Receipt size={13} />} onClick={() => open({ kind: "invoice", delivery: d.no })} className="px-2.5 py-1.5 text-[12px]">
                      ออกใบกำกับ
                    </Button>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card
        title={<span className="flex items-center gap-2"><Package size={15} className="text-slate-400" />ใบสั่งขายที่ยังค้างส่ง</span>}
        subtitle="ของยังอยู่ในคลัง ยังไม่ถือเป็นการส่งมอบ — ส่งได้เฉพาะใบที่ยืนยันแล้วและผ่านวงเงิน"
      >
        {pending.length === 0 ? (
          <p className="py-10 text-center text-[12.5px] text-slate-400">ทุกใบสั่งขายส่งของครบแล้ว</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {pending.map((so) => (
              <li key={so.no} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                <button onClick={() => onOpenOrder(so)} className="w-36 shrink-0 text-left font-mono text-[12px] text-slate-500 transition hover:text-violet-700 dark:text-slate-400">
                  {so.no}
                </button>
                <span className="w-48 shrink-0 truncate text-[13px] text-slate-900 dark:text-slate-50">{customer(so.customer).name}</span>
                <span className="min-w-0 flex-1 text-[12.5px] text-slate-500 dark:text-slate-400">
                  {openLines(so).filter((l) => l.open > 0).map((l) => `${material(l.material).name} ค้าง ${l.open}`).join(" · ")}
                </span>
                {so.shipBy && <span className="shrink-0 text-[11.5px] tabular-nums text-slate-400">กำหนดส่ง {so.shipBy}</span>}
                <OrderBadge so={so} />
                {canShip(so) && (
                  <Button variant="secondary" icon={<Truck size={13} />} onClick={() => open({ kind: "delivery", so: so.no })} className="px-2.5 py-1.5 text-[12px]">
                    เปิดใบส่งของ
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/* --------------------------------------------------------------- billing */

const BILLING_VIEWS = ["ใบกำกับภาษี", "ใบลดหนี้", "ใบวางบิล"];

function Billing({
  onOpenOrder,
  onOpenInvoice,
  open,
}: {
  onOpenOrder: (so: SalesOrder) => void;
  onOpenInvoice: (no: string) => void;
  open: Open;
}) {
  useData();
  const [view, setView] = useState(BILLING_VIEWS[0]);
  const unbilled = uninvoicedDeliveries();
  const billed = BILLINGS.reduce((n, b) => n + invoiceTotal(b).gross, 0);
  const collected = BILLINGS.reduce((n, b) => n + (b.receipt?.amount ?? 0), 0);
  const unpaid = BILLINGS.filter((b) => !b.paid);
  const due = unpaid.reduce((n, b) => n + amountDue(b), 0);
  const statusOf = (paid: boolean, dueDate: string) =>
    paid ? <Badge tone="ok" dot>เก็บเงินแล้ว</Badge> : dueDate < TODAY ? <Badge tone="bad" dot>เกินกำหนด</Badge> : <Badge tone="warn" dot>ยังไม่เก็บเงิน</Badge>;

  const exportRows = () => {
    if (view === "ใบกำกับภาษี") {
      downloadCsv(
        `ใบกำกับภาษี-${TODAY}`,
        ["เลขที่", "วันที่", "ครบกำหนด", "ใบสั่งขาย", "ใบส่งของ", "ลูกค้า", "เลขผู้เสียภาษี", "ก่อนภาษี", "ภาษีมูลค่าเพิ่ม", "รวม", "ลดหนี้", "คงค้าง", "สถานะ", "ใบเสร็จ"],
        BILLINGS.map((b) => {
          const t = invoiceTotal(b);
          const c = customer(salesOrder(b.so).customer);
          return [b.no, b.date, b.due, b.so, b.delivery, c.name, c.taxId, t.net, t.vat, t.gross, t.gross - amountDue(b), b.paid ? 0 : amountDue(b), b.paid ? "เก็บเงินแล้ว" : "ยังไม่เก็บเงิน", b.receipt?.no ?? ""];
        })
      );
    } else if (view === "ใบลดหนี้") {
      downloadCsv(
        `ใบลดหนี้-${TODAY}`,
        ["เลขที่", "วันที่", "อ้างใบกำกับ", "ลูกค้า", "ประเภท", "เหตุผล", "ก่อนภาษี", "ภาษีมูลค่าเพิ่ม", "รวม"],
        CREDIT_NOTES.map((n) => {
          const t = creditNoteTotal(n);
          return [n.no, n.date, n.invoice, customer(salesOrder(invoice(n.invoice).so).customer).name, n.kind, n.reason, t.net, t.vat, t.gross];
        })
      );
    } else {
      downloadCsv(
        `ใบวางบิล-${TODAY}`,
        ["เลขที่", "วันที่", "ลูกค้า", "ใบกำกับ", "นัดชำระ", "ยอดรวม"],
        BILLING_NOTES.map((n) => [n.no, n.date, customer(n.customer).name, n.invoices.join(" "), n.payOn, billingNoteTotal(n)])
      );
    }
  };

  const th = "px-4 py-3 font-medium";
  const head = "bg-slate-50/80 text-left text-[11px] uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-400";

  return (
    <div className="space-y-3">
      <StatStrip
        title="การวางบิลและเก็บเงิน"
        icon={<Receipt size={15} />}
        cells={[
          { icon: <Receipt size={13} />, label: "ใบกำกับที่ออกแล้ว", value: BILLINGS.length + " ใบ", sub: baht(billed) },
          { icon: <Banknote size={13} />, label: "เก็บเงินแล้ว", value: baht(collected), sub: `${BILLINGS.filter((b) => b.paid).length} ใบ ตามใบเสร็จ`, tone: "ok" },
          { icon: <CalendarClock size={13} />, label: "ยังไม่เก็บเงิน", value: baht(due), sub: `${unpaid.length} ใบ · เกินกำหนด ${unpaid.filter((b) => b.due < TODAY).length} ใบ`, tone: "warn" },
          { icon: <TriangleAlert size={13} />, label: "ส่งของแล้วยังไม่วางบิล", value: unbilled.length + " ใบ", sub: "ยังไม่กลายเป็นรายได้", tone: unbilled.length > 0 ? "bad" : "ok" },
        ]}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          options={BILLING_VIEWS}
          value={view}
          onChange={setView}
          counts={{ ใบกำกับภาษี: BILLINGS.length, ใบลดหนี้: CREDIT_NOTES.length, ใบวางบิล: BILLING_NOTES.length }}
        />
        <span className="ml-auto" />
        <ExportButton onClick={exportRows} />
        <Button variant="secondary" icon={<FileMinus size={14} />} onClick={() => open({ kind: "credit-note" })}>ออกใบลดหนี้</Button>
        <Button variant="secondary" icon={<FileText size={14} />} onClick={() => open({ kind: "billing-note" })}>ทำใบวางบิล</Button>
        <Button variant="primary" icon={<Receipt size={15} />} onClick={() => open({ kind: "invoice" })}>ออกใบกำกับภาษี</Button>
      </div>

      {view === "ใบกำกับภาษี" && (
        <Card
          title={<span className="flex items-center gap-2"><Receipt size={15} className="text-slate-400" />ใบกำกับภาษี / ใบแจ้งหนี้</span>}
          subtitle="หนึ่งใบต่อหนึ่งเที่ยวส่ง แยกก่อนภาษี ภาษี และยอดที่ลูกค้าต้องจ่ายหลังหักใบลดหนี้ — กดแถวเพื่อเปิดใบ"
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-[13px]">
              <thead className={head}>
                <tr>
                  <th className={th}>เลขที่</th>
                  <th className={th}>อ้างใบสั่งขาย</th>
                  <th className={th}>ลูกค้า</th>
                  <th className={th}>ครบกำหนด</th>
                  <th className={th + " text-right"}>ก่อนภาษี</th>
                  <th className={th + " text-right"}>ภาษี</th>
                  <th className={th + " text-right"}>คงค้าง</th>
                  <th className={th}>สถานะ</th>
                  <th className="w-24 px-2 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {[...BILLINGS].reverse().map((b) => {
                  const so = salesOrder(b.so);
                  const t = invoiceTotal(b);
                  return (
                    <tr key={b.no} onClick={() => onOpenInvoice(b.no)} className="cursor-pointer transition hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-2.5 font-mono text-[12px] text-slate-500 dark:text-slate-400">{b.no}<span className="block font-sans text-[11px] text-slate-400">{b.date}</span></td>
                      <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => onOpenOrder(so)} className="font-mono text-[12px] text-violet-700 transition hover:underline dark:text-violet-300">
                          {b.so}
                        </button>
                      </td>
                      <td className="px-4 py-2.5 text-slate-900 dark:text-slate-50">{customer(so.customer).name}</td>
                      <td className="px-4 py-2.5 tabular-nums text-slate-500 dark:text-slate-400">{b.due}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-300">{money(t.net)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-slate-500 dark:text-slate-400">{money(t.vat)}</td>
                      <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-slate-900 dark:text-slate-50">{b.paid ? "—" : money(amountDue(b))}</td>
                      <td className="px-4 py-2.5">{statusOf(b.paid, b.due)}</td>
                      <td className="px-2 py-2.5" onClick={(e) => e.stopPropagation()}>
                        <span className="flex items-center justify-end gap-1">
                          <IconButton label="พิมพ์ใบกำกับภาษี" onClick={() => open({ kind: "print", doc: "IV", no: b.no })}>
                            <Printer size={14} />
                          </IconButton>
                          {!b.paid && (
                            <IconButton label="รับชำระ" onClick={() => open({ kind: "payment", no: b.no })}>
                              <Banknote size={14} />
                            </IconButton>
                          )}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {view === "ใบลดหนี้" && (
        <Card
          title={<span className="flex items-center gap-2"><FileMinus size={15} className="text-slate-400" />ใบลดหนี้</span>}
          subtitle="รับคืนสินค้าหรือลดราคาภายหลัง อ้างใบกำกับเดิมทุกใบ"
        >
          {CREDIT_NOTES.length === 0 ? (
            <p className="py-10 text-center text-[12.5px] text-slate-400">ยังไม่มีใบลดหนี้</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {[...CREDIT_NOTES].reverse().map((n) => (
                <li key={n.no} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-[13px]">
                  <span className="w-32 shrink-0 font-mono text-[12px] text-slate-500 dark:text-slate-400">{n.no}<span className="block font-sans text-[11px] text-slate-400">{n.date}</span></span>
                  <button onClick={() => onOpenInvoice(n.invoice)} className="shrink-0 font-mono text-[12px] text-violet-700 hover:underline dark:text-violet-300">{n.invoice}</button>
                  <span className="w-44 shrink-0 truncate text-slate-900 dark:text-slate-50">{customer(salesOrder(invoice(n.invoice).so).customer).name}</span>
                  <Chip>{n.kind}</Chip>
                  <span className="min-w-0 flex-1 truncate text-[12px] text-slate-500 dark:text-slate-400">{n.reason}</span>
                  <span className="shrink-0 font-semibold tabular-nums text-rose-600 dark:text-rose-400">−{money(creditNoteTotal(n).gross)}</span>
                  <IconButton label="พิมพ์ใบลดหนี้" onClick={() => open({ kind: "print", doc: "CN", no: n.no })}>
                    <Printer size={14} />
                  </IconButton>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {view === "ใบวางบิล" && (
        <Card
          title={<span className="flex items-center gap-2"><FileText size={15} className="text-slate-400" />ใบวางบิล</span>}
          subtitle="รวมใบกำกับที่ยังไม่เก็บเงินของลูกค้ารายเดียว พร้อมวันนัดรับเช็ค"
        >
          {BILLING_NOTES.length === 0 ? (
            <p className="py-10 text-center text-[12.5px] text-slate-400">ยังไม่มีใบวางบิล</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {[...BILLING_NOTES].reverse().map((n) => {
                const settled = n.invoices.every((no) => invoice(no).paid);
                return (
                  <li key={n.no} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-[13px]">
                    <span className="w-32 shrink-0 font-mono text-[12px] text-slate-500 dark:text-slate-400">{n.no}<span className="block font-sans text-[11px] text-slate-400">{n.date}</span></span>
                    <span className="w-44 shrink-0 truncate text-slate-900 dark:text-slate-50">{customer(n.customer).name}</span>
                    <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-slate-500 dark:text-slate-400">{n.invoices.join(" · ")}</span>
                    <span className="shrink-0 text-[11.5px] tabular-nums text-slate-400">นัดชำระ {n.payOn}</span>
                    <span className="shrink-0 font-semibold tabular-nums text-slate-900 dark:text-slate-50">{money(billingNoteTotal(n))}</span>
                    <Badge tone={settled ? "ok" : n.payOn < TODAY ? "bad" : "warn"} dot>{settled ? "รับชำระครบ" : n.payOn < TODAY ? "เลยวันนัด" : "รอรับชำระ"}</Badge>
                    <IconButton label="พิมพ์ใบวางบิล" onClick={() => open({ kind: "print", doc: "BN", no: n.no })}>
                      <Printer size={14} />
                    </IconButton>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}

      <Card
        title={<span className="flex items-center gap-2"><TriangleAlert size={15} className="text-slate-400" />ส่งของแล้วแต่ยังไม่ได้ออกใบกำกับภาษี</span>}
        subtitle="ของออกจากคลังไปแล้ว แต่ยังไม่กลายเป็นรายได้จนกว่าจะออกใบกำกับ — ออกได้เมื่อยืนยันส่งถึงแล้ว"
      >
        {unbilled.length === 0 ? (
          <p className="py-10 text-center text-[12.5px] text-slate-400">ทุกเที่ยวที่ส่งของแล้ววางบิลครบ</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {unbilled.map((d) => {
              const so = salesOrder(d.so);
              const value = linesTotal(d.lines.map((l) => ({ ...l, price: so.lines.find((x) => x.material === l.material)!.price }))).gross;
              return (
                <li key={d.no} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                  <button onClick={() => onOpenOrder(so)} className="w-36 shrink-0 text-left font-mono text-[12px] text-slate-500 transition hover:text-violet-700 dark:text-slate-400">
                    {so.no}
                  </button>
                  <span className="w-48 shrink-0 truncate text-[13px] text-slate-900 dark:text-slate-50">{customer(so.customer).name}</span>
                  <span className="min-w-0 flex-1 text-[12px] text-slate-400">
                    {d.no} ส่งเมื่อ {d.date} · {d.route} · {d.status}
                  </span>
                  <span className="shrink-0 text-[13px] font-semibold tabular-nums text-slate-900 dark:text-slate-50">{baht(value)}</span>
                  {d.status === "ส่งถึงแล้ว" ? (
                    <Button variant="primary" icon={<Receipt size={13} />} onClick={() => open({ kind: "invoice", delivery: d.no })} className="px-2.5 py-1.5 text-[12px]">
                      ออกใบกำกับภาษี
                    </Button>
                  ) : (
                    <Button variant="secondary" icon={<CircleCheck size={13} />} onClick={() => open({ kind: "delivered", no: d.no })} className="px-2.5 py-1.5 text-[12px]">
                      ยืนยันส่งถึง
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

/* ---------------------------------------------------------------- credit */

function Credit({
  onOpenCustomer,
  onOpenOrder,
  open,
}: {
  onOpenCustomer: (c: Customer) => void;
  onOpenOrder: (so: SalesOrder) => void;
  open: Open;
}) {
  useData();
  const [only, setOnly] = useState("ทั้งหมด");
  const held = heldOrders();
  const rows = CUSTOMERS.map((c) => ({ c, cr: creditCheck(c.code) })).filter((x) =>
    only === "ทั้งหมด" ? true : only === "เกินวงเงิน" ? x.cr.blocked : x.cr.cashOnly
  );

  const exportRows = () =>
    downloadCsv(
      `วงเงินเครดิต-${TODAY}`,
      ["รหัส", "ลูกค้า", "เงื่อนไขชำระ", "วงเงิน", "ยอดค้าง", "คงเหลือ", "รออนุมัติ", "สถานะ"],
      CUSTOMERS.map((c) => {
        const cr = creditCheck(c.code);
        return [c.code, c.name, c.terms, cr.limit, cr.used, cr.cashOnly ? 0 : cr.left, cr.held, cr.cashOnly ? "ขายเงินสด" : cr.blocked ? "เกินวงเงิน" : "อยู่ในวงเงิน"];
      })
    );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          options={["ทั้งหมด", "เกินวงเงิน", "ขายเงินสด"]}
          value={only}
          onChange={setOnly}
          counts={{
            ทั้งหมด: CUSTOMERS.length,
            เกินวงเงิน: CUSTOMERS.filter((c) => creditCheck(c.code).blocked).length,
            ขายเงินสด: CUSTOMERS.filter((c) => creditCheck(c.code).cashOnly).length,
          }}
        />
        <span className="ml-auto text-[12px] text-slate-400">ยอดค้าง = ใบสั่งขายที่ยังไม่ออกใบกำกับ + ใบกำกับที่ยังไม่เก็บเงิน</span>
        <ExportButton onClick={exportRows} />
      </div>

      <Card
        title={<span className="flex items-center gap-2"><ShieldCheck size={15} className="text-slate-400" />ใบสั่งขายที่รออนุมัติเครดิต</span>}
        subtitle="บันทึกตอนยอดค้างเกินวงเงิน ส่งของไม่ได้จนกว่าผู้มีอำนาจจะอนุมัติ หรือยกเลิกใบ"
      >
        {held.length === 0 ? (
          <p className="py-8 text-center text-[12.5px] text-slate-400">ไม่มีใบที่รออนุมัติ</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {held.map((so) => {
              const cr = creditCheck(so.customer);
              const gross = linesTotal(so.lines).gross;
              return (
                <li key={so.no} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                  <button onClick={() => onOpenOrder(so)} className="w-36 shrink-0 text-left font-mono text-[12px] text-violet-700 hover:underline dark:text-violet-300">{so.no}</button>
                  <span className="w-48 shrink-0 truncate text-[13px] text-slate-900 dark:text-slate-50">{customer(so.customer).name}</span>
                  <span className="min-w-0 flex-1 text-[12px] tabular-nums text-slate-500 dark:text-slate-400">
                    ยอดค้าง {baht(cr.used)} + ใบนี้ {baht(gross)} · วงเงิน {baht(cr.limit)}
                  </span>
                  <Button variant="ghost" onClick={() => open({ kind: "cancel-order", no: so.no })} className="px-2.5 py-1.5 text-[12px] text-rose-600 dark:text-rose-400">
                    ไม่อนุมัติ
                  </Button>
                  <Button variant="primary" icon={<ShieldCheck size={13} />} onClick={() => open({ kind: "release", no: so.no })} className="px-2.5 py-1.5 text-[12px]">
                    อนุมัติ
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <div className="grid gap-3 lg:grid-cols-2">
        {rows.map(({ c, cr }) => (
          <Card
            key={c.code}
            title={
              <button onClick={() => onOpenCustomer(c)} className="flex items-center gap-2.5 text-left transition hover:text-violet-700">
                <Avatar name={shortName(c.name)} size="sm" />
                {c.name}
              </button>
            }
            subtitle={`${c.channel} · ${c.terms} · ${c.address}`}
            action={
              <span className="flex items-center gap-1.5">
                <Badge tone={cr.cashOnly ? "idle" : cr.blocked ? "bad" : "ok"} dot>
                  {cr.cashOnly ? "ขายเงินสด" : cr.blocked ? "เกินวงเงิน" : "อยู่ในวงเงิน"}
                </Badge>
                <Button variant="secondary" icon={<Coins size={13} />} onClick={() => open({ kind: "credit", code: c.code })} className="px-2.5 py-1.5 text-[12px]">
                  ปรับวงเงิน
                </Button>
              </span>
            }
          >
            <div className="space-y-3 p-4">
              {cr.cashOnly ? (
                <Note tone="idle">ลูกค้ารายนี้ไม่มีวงเงินเครดิต ทุกใบต้องเก็บเงินพร้อมส่งของ</Note>
              ) : (
                <>
                  <Progress done={Math.min(cr.used, cr.limit)} total={cr.limit} label={`ใช้ไป ${baht(cr.used)} จากวงเงิน ${baht(cr.limit)}`} />
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "วงเงิน", value: baht(cr.limit) },
                      { label: "ยอดค้าง", value: baht(cr.used) },
                      { label: "เหลือใช้ได้", value: cr.left > 0 ? baht(cr.left) : "เกินแล้ว" },
                    ].map((x) => (
                      <div key={x.label} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
                        <div className="text-[11.5px] text-slate-500 dark:text-slate-400">{x.label}</div>
                        <div className={"mt-1 text-[14px] font-semibold tabular-nums " + (x.label === "เหลือใช้ได้" && cr.left <= 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-900 dark:text-slate-50")}>
                          {x.value}
                        </div>
                      </div>
                    ))}
                  </div>
                  {cr.blocked && (
                    <Note tone="bad">
                      ยอดค้างเกินวงเงินอยู่ {baht(cr.used - cr.limit)} ใบสั่งขายใบถัดไปของลูกค้ารายนี้จะรออนุมัติเครดิตจนกว่าจะเก็บเงินบางส่วนหรือปรับวงเงิน
                    </Note>
                  )}
                  {cr.held > 0 && <Note tone="warn">รออนุมัติเครดิตอีก {baht(cr.held)}</Note>}
                </>
              )}
            </div>
          </Card>
        ))}
      </div>

      <Card
        title={<span className="flex items-center gap-2"><CalendarClock size={15} className="text-slate-400" />ประวัติการปรับวงเงิน</span>}
        subtitle="ทุกครั้งที่ปรับวงเงินหรือเงื่อนไขชำระ พร้อมเหตุผล"
      >
        {CREDIT_CHANGES.length === 0 ? (
          <p className="py-8 text-center text-[12.5px] text-slate-400">ยังไม่มีการปรับวงเงิน</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {[...CREDIT_CHANGES].reverse().map((x, i) => (
              <li key={i} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-[12.5px]">
                <span className="w-24 shrink-0 tabular-nums text-slate-400">{x.date}</span>
                <span className="w-48 shrink-0 truncate text-slate-900 dark:text-slate-50">{customer(x.customer).name}</span>
                <span className="tabular-nums text-slate-500 dark:text-slate-400">
                  {x.fromLimit ? baht(x.fromLimit) : "เงินสด"} → <b className="text-slate-900 dark:text-slate-50">{x.toLimit ? baht(x.toLimit) : "เงินสด"}</b>
                  {x.fromTerms !== x.toTerms && ` · ${x.fromTerms} → ${x.toTerms}`}
                </span>
                <span className="min-w-0 flex-1 truncate text-slate-400">{x.reason}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
