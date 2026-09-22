import { useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowRight, Banknote, Building, CalendarClock, CircleCheck, CircleX, Coins, CreditCard,
  FileText, MapPin, Package, Percent, Receipt, Search as SearchIcon, ShieldAlert, ShoppingBag,
  Tags, TrendingUp, TriangleAlert, Truck, Users,
} from "lucide-react";
import { TODAY, material } from "../mm/data";
import {
  BILLINGS, CATALOG, CHANNEL_DISCOUNT, CUSTOMERS, DELIVERIES, PRICE_LIST, SALES_ORDERS, VAT_RATE,
  VOLUME_BREAKS, baht, billingOf, creditCheck, customer, deliveryOf, exposureOf, orderTotal,
  priceLine,
} from "./data";
import type { Customer, SalesOrder } from "./data";
import {
  Avatar, Badge, Bar, Button, Card, Chip, ColumnChart, Donut, Dot, IconRow, Note, PageHead,
  Progress, Reveal, Search, Segmented, Select, StatStrip, Stepper, Tabs, Tag, TintCard, swatchFor,
} from "../ui";
import type { StepState } from "../ui";
import { DataTable, DetailModal, FormModal } from "../kit";
import type { Column } from "../kit";

const TABS = [
  "ข้อมูลหลักลูกค้า",
  "ราคาและส่วนลด",
  "ใบสั่งขาย",
  "จัดส่งสินค้า",
  "วางบิลและใบแจ้งหนี้",
  "วงเงินเครดิตลูกค้า",
];

const CHANNELS = Object.keys(CHANNEL_DISCOUNT);
const channelSwatch = (c: string) => swatchFor(c, CHANNELS);

const ORDER_FLOW = ["รับใบสั่งขาย", "จัดส่ง", "วางบิล", "เก็บเงินแล้ว"];

const ORDER_TABS = ["การคิดราคา", "การจัดส่ง", "การวางบิล", "ลูกค้า"];
const ORDER_ICONS: Record<string, ReactNode> = {
  การคิดราคา: <Percent size={13} />,
  การจัดส่ง: <Truck size={13} />,
  การวางบิล: <Receipt size={13} />,
  ลูกค้า: <Building size={13} />,
};

const DELIVERY_TONE: Record<string, "ok" | "warn" | "idle"> = {
  ส่งถึงแล้ว: "ok",
  กำลังจัดส่ง: "warn",
};

/** ขั้นที่ใบสั่งขายใบหนึ่งไปถึงแล้ว */
function stageOf(so: SalesOrder) {
  const bill = billingOf(so.no);
  if (bill?.paid) return 3;
  if (bill) return 2;
  if (deliveryOf(so.no)) return 1;
  return 0;
}

/* ----------------------------------------------------------------- screen */

export default function SdScreen({
  section,
  onOpenSection,
}: {
  section?: string;
  onOpenSection?: (index: number) => void;
}) {
  const tab = section && TABS.includes(section) ? section : undefined;

  const [q, setQ] = useState("");
  const [channel, setChannel] = useState("ทุกช่องทาง");
  const [openOrderAt, setOpenOrderAt] = useState<number | null>(null);
  const [openCustomer, setOpenCustomer] = useState<Customer | null>(null);

  const needle = q.trim().toLowerCase();
  const orderRows = SALES_ORDERS.filter(
    (so) =>
      (channel === "ทุกช่องทาง" || customer(so.customer).channel === channel) &&
      (needle === "" || [so.no, customer(so.customer).name].some((t) => t.toLowerCase().includes(needle)))
  );
  const pickedOrder = openOrderAt === null ? null : (orderRows[openOrderAt] ?? null);

  const unbilled = SALES_ORDERS.filter((so) => deliveryOf(so.no) && !billingOf(so.no));
  const overLimit = CUSTOMERS.filter((c) => creditCheck(c.code).blocked);

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
        {pickedOrder && <OrderRecord key={pickedOrder.no} so={pickedOrder} />}
      </DetailModal>

      <FormModal
        open={openCustomer !== null}
        title="แฟ้มลูกค้า"
        subtitle={openCustomer ? openCustomer.name : undefined}
        onClose={() => setOpenCustomer(null)}
      >
        {openCustomer && <CustomerRecord c={openCustomer} onOpenOrder={(so) => {
          setOpenCustomer(null);
          setQ("");
          setChannel("ทุกช่องทาง");
          setOpenOrderAt(SALES_ORDERS.indexOf(so));
        }} />}
      </FormModal>
    </>
  );

  if (!tab) {
    return (
      <>
        <Overview
          unbilled={unbilled}
          overLimit={overLimit}
          onOpenSection={onOpenSection}
          onOpenOrder={(so) => {
            setQ("");
            setChannel("ทุกช่องทาง");
            setOpenOrderAt(SALES_ORDERS.indexOf(so));
          }}
          onOpenCustomer={setOpenCustomer}
        />
        {panels}
      </>
    );
  }

  return (
    <div>
      <PageHead
        title="ขายและกระจายสินค้า"
        meta={`${tab} · ${CUSTOMERS.length} ลูกค้า · ${SALES_ORDERS.length} ใบสั่งขาย · ยอดขายรวม ${baht(SALES_ORDERS.reduce((n, so) => n + orderTotal(so).net, 0))}`}
      />

      {tab === "ข้อมูลหลักลูกค้า" && (
        <Customers q={q} setQ={setQ} channel={channel} setChannel={setChannel} onOpen={setOpenCustomer} />
      )}
      {tab === "ราคาและส่วนลด" && <Pricing />}
      {tab === "ใบสั่งขาย" && (
        <Orders
          rows={orderRows}
          q={q}
          setQ={setQ}
          channel={channel}
          setChannel={setChannel}
          onOpen={(so) => setOpenOrderAt(orderRows.indexOf(so))}
        />
      )}
      {tab === "จัดส่งสินค้า" && <Shipping onOpenOrder={(so) => setOpenOrderAt(SALES_ORDERS.indexOf(so))} />}
      {tab === "วางบิลและใบแจ้งหนี้" && (
        <Billing unbilled={unbilled} onOpenOrder={(so) => setOpenOrderAt(SALES_ORDERS.indexOf(so))} />
      )}
      {tab === "วงเงินเครดิตลูกค้า" && <Credit onOpenCustomer={setOpenCustomer} />}

      {panels}

      <div hidden data-fitt-index>
        <button data-fitt-screen="ขายและกระจายสินค้า" />
        <button data-fitt-screen="ใบสั่งขาย" data-fitt-modal onClick={() => setOpenOrderAt(0)} />
        <button data-fitt-screen="แฟ้มลูกค้า" data-fitt-modal onClick={() => setOpenCustomer(CUSTOMERS[0])} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- overview */

function Overview({
  unbilled,
  overLimit,
  onOpenSection,
  onOpenOrder,
  onOpenCustomer,
}: {
  unbilled: SalesOrder[];
  overLimit: Customer[];
  onOpenSection?: (index: number) => void;
  onOpenOrder: (so: SalesOrder) => void;
  onOpenCustomer: (c: Customer) => void;
}) {
  const totals = SALES_ORDERS.map((so) => ({ so, t: orderTotal(so) }));
  const net = totals.reduce((n, x) => n + x.t.net, 0);
  const collected = totals.filter((x) => billingOf(x.so.no)?.paid).reduce((n, x) => n + x.t.gross, 0);
  const outstanding = totals.filter((x) => !billingOf(x.so.no)?.paid).reduce((n, x) => n + x.t.gross, 0);

  const byChannel = CHANNELS.map((ch) => ({
    label: ch,
    value: totals.filter((x) => customer(x.so.customer).channel === ch).reduce((n, x) => n + x.t.net, 0),
    swatch: channelSwatch(ch),
  })).filter((s) => s.value > 0);

  const byProduct = CATALOG.map((p) => {
    const qty = SALES_ORDERS.flatMap((so) => so.lines).filter((l) => l.material === p.code).reduce((n, l) => n + l.qty, 0);
    return { p, qty, value: qty * PRICE_LIST[p.code] };
  }).filter((x) => x.qty > 0);

  const pipeline = SALES_ORDERS.map((so) => ({ so, stage: stageOf(so) }));

  const seeAll = (index: number) =>
    onOpenSection ? (
      <button
        onClick={() => onOpenSection(index)}
        className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[12px] text-slate-600 transition hover:border-violet-300 hover:text-violet-700 dark:border-slate-700 dark:text-slate-300"
      >
        ดูทั้งหมด <ArrowRight size={12} />
      </button>
    ) : undefined;

  return (
    <div>
      <PageHead
        title="ภาพรวมการขาย"
        meta={`${CUSTOMERS.length} ลูกค้า · ${SALES_ORDERS.length} ใบสั่งขาย · ข้อมูล ณ ${TODAY}`}
        right={
          onOpenSection ? (
            <Button variant="primary" icon={<ShoppingBag size={15} />} onClick={() => onOpenSection(2)}>
              เปิดใบสั่งขาย
            </Button>
          ) : undefined
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
                ยอดก่อนภาษีจาก {SALES_ORDERS.length} ใบสั่งขาย · รวมภาษีแล้ว {baht(collected + outstanding)}
              </p>
              <div className="mt-4 space-y-2.5">
                <div className="flex items-center gap-3">
                  <span className="w-28 shrink-0 text-[12.5px] text-slate-600 dark:text-slate-300">เก็บเงินแล้ว</span>
                  <span className="min-w-0 flex-1">
                    <Bar pct={(collected / (collected + outstanding)) * 100} tone="ok" width="w-full" />
                  </span>
                  <span className="w-32 shrink-0 text-right text-[12.5px] tabular-nums text-slate-700 dark:text-slate-200">{baht(collected)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-28 shrink-0 text-[12.5px] text-slate-600 dark:text-slate-300">ยังไม่เก็บเงิน</span>
                  <span className="min-w-0 flex-1">
                    <Bar pct={(outstanding / (collected + outstanding)) * 100} tone="warn" width="w-full" />
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
                      <span className="w-24 shrink-0 text-right text-[11.5px] text-slate-400">{ORDER_FLOW[stage]}</span>
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
                { icon: <Receipt size={15} />, label: "ส่งของแล้วยังไม่วางบิล", value: unbilled.length, unit: "ใบ", tone: "warn" as const, to: 4 },
                { icon: <ShieldAlert size={15} />, label: "ลูกค้าเกินวงเงินเครดิต", value: overLimit.length, unit: "ราย", tone: "bad" as const, to: 5 },
                { icon: <Truck size={15} />, label: "ใบสั่งขายที่ยังไม่ส่งของ", value: SALES_ORDERS.filter((so) => !deliveryOf(so.no)).length, unit: "ใบ", tone: "info" as const, to: 3 },
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
                const cost = material(x.p.code).price;
                const margin = PRICE_LIST[x.p.code] - cost;
                return (
                  <li key={x.p.code} className="flex flex-wrap items-center gap-3 px-4 py-2">
                    <span className="w-52 shrink-0 truncate text-[12.5px] text-slate-800 dark:text-slate-100">{x.p.name}</span>
                    <span className="shrink-0 text-[11.5px] tabular-nums text-slate-400">
                      {x.qty} {x.p.unit}
                    </span>
                    <span className="min-w-0 flex-1">
                      <Bar pct={(margin / PRICE_LIST[x.p.code]) * 100} tone="ok" width="w-full" />
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
          subtitle="ยอดค้างคิดจากใบสั่งขายที่ยังไม่เก็บเงิน ลูกค้าที่ใช้เกินวงเงินจะเปิดใบถัดไปไม่ได้"
          action={seeAll(5)}
        >
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {CUSTOMERS.map((c) => {
              const cr = creditCheck(c.code);
              return (
                <li key={c.code} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                  <Avatar name={c.name.replace(/^(บจก\.|หจก\.|ร้าน)\s*/, "")} size="sm" />
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
}: {
  q: string;
  setQ: (v: string) => void;
  channel: string;
  setChannel: (v: string) => void;
  onOpen: (c: Customer) => void;
}) {
  const needle = q.trim().toLowerCase();
  const rows = CUSTOMERS.filter(
    (c) =>
      (channel === "ทุกช่องทาง" || c.channel === channel) &&
      (needle === "" || [c.code, c.name, c.contact, c.address].some((t) => t.toLowerCase().includes(needle)))
  );

  const columns: Column<Customer>[] = [
    {
      key: "name",
      header: "ลูกค้า",
      width: "30%",
      sort: (a, b) => a.name.localeCompare(b.name, "th"),
      cell: (c) => (
        <span className="flex items-center gap-2.5">
          <Avatar name={c.name.replace(/^(บจก\.|หจก\.|ร้าน)\s*/, "")} size="sm" />
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

  return (
    <DataTable
      rows={rows}
      columns={columns}
      getId={(c) => c.code}
      onOpen={onOpen}
      toolbar={
        <div className="flex flex-wrap items-center gap-2">
          <Search value={q} onChange={setQ} placeholder="ค้นหาชื่อลูกค้า รหัส หรือพื้นที่" icon={<SearchIcon size={14} />} />
          <Select value={channel} onChange={setChannel} options={["ทุกช่องทาง", ...CHANNELS]} />
          <span className="ml-auto text-[12px] text-slate-400">แสดง {rows.length} ราย</span>
        </div>
      }
    />
  );
}

/* --------------------------------------------------------------- pricing */

function Pricing() {
  return (
    <div className="space-y-3">
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
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {CATALOG.map((p) => {
              const cost = material(p.code).price;
              const list = PRICE_LIST[p.code];
              const margin = list - cost;
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
            {CHANNELS.map((ch) => (
              <li key={ch} className="flex items-center gap-3 px-4 py-3">
                <Dot className={channelSwatch(ch).dot} />
                <span className="min-w-0 flex-1 text-[13px] text-slate-800 dark:text-slate-100">{ch}</span>
                <span className="shrink-0 text-[11.5px] text-slate-400">
                  {CUSTOMERS.filter((c) => c.channel === ch).length} ลูกค้า
                </span>
                <Badge tone={CHANNEL_DISCOUNT[ch] > 0 ? "accent" : "idle"}>
                  ลด {Math.round(CHANNEL_DISCOUNT[ch] * 100)}%
                </Badge>
              </li>
            ))}
          </ul>
        </Card>

        <Card
          title={<span className="flex items-center gap-2"><Percent size={15} className="text-slate-400" />ส่วนลดตามจำนวนที่สั่ง</span>}
          subtitle="คิดเพิ่มจากส่วนลดช่องทาง โดยดูจำนวนต่อบรรทัด"
        >
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {VOLUME_BREAKS.map((b) => (
              <li key={b.minQty} className="flex items-center gap-3 px-4 py-3">
                <span className="min-w-0 flex-1 text-[13px] text-slate-800 dark:text-slate-100">ตั้งแต่ {b.minQty} หน่วยขึ้นไป</span>
                <span className="min-w-0 flex-1">
                  <Bar pct={b.discount * 1000} tone="accent" width="w-full" />
                </span>
                <Badge tone="accent">ลดเพิ่ม {Math.round(b.discount * 100)}%</Badge>
              </li>
            ))}
          </ul>
          <div className="px-4 pb-4">
            <Note tone="idle">
              ภาษีมูลค่าเพิ่ม {Math.round(VAT_RATE * 100)}% คิดจากยอดหลังหักส่วนลดทั้งสองชั้นแล้ว
            </Note>
          </div>
        </Card>
      </div>
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
  onOpen,
}: {
  rows: SalesOrder[];
  q: string;
  setQ: (v: string) => void;
  channel: string;
  setChannel: (v: string) => void;
  onOpen: (so: SalesOrder) => void;
}) {
  const columns: Column<SalesOrder>[] = [
    {
      key: "no",
      header: "เลขที่",
      width: "16%",
      sort: (a, b) => a.no.localeCompare(b.no),
      cell: (so) => <span className="font-mono text-[12px] text-slate-500 dark:text-slate-400">{so.no}</span>,
    },
    {
      key: "customer",
      header: "ลูกค้า",
      width: "26%",
      sort: (a, b) => customer(a.customer).name.localeCompare(customer(b.customer).name, "th"),
      cell: (so) => (
        <span className="flex items-center gap-2.5">
          <Avatar name={customer(so.customer).name.replace(/^(บจก\.|หจก\.|ร้าน)\s*/, "")} size="sm" />
          <span>
            <span className="block font-medium text-slate-900 dark:text-slate-50">{customer(so.customer).name}</span>
            <span className="block text-[11px] text-slate-400">{customer(so.customer).channel}</span>
          </span>
        </span>
      ),
    },
    { key: "date", header: "วันที่", width: "12%", sort: (a, b) => a.date.localeCompare(b.date), cell: (so) => <span className="tabular-nums text-slate-500 dark:text-slate-400">{so.date}</span> },
    { key: "lines", header: "รายการ", align: "right", width: "9%", cell: (so) => <span className="tabular-nums text-slate-600 dark:text-slate-300">{so.lines.length}</span> },
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
    {
      key: "stage",
      header: "ขั้น",
      width: "11%",
      cell: (so) => {
        const s = stageOf(so);
        return <Badge tone={s === 3 ? "ok" : s === 0 ? "idle" : "accent"} dot>{ORDER_FLOW[s]}</Badge>;
      },
    },
  ];

  return (
    <DataTable
      rows={rows}
      columns={columns}
      getId={(so) => so.no}
      onOpen={onOpen}
      toolbar={
        <div className="flex flex-wrap items-center gap-2">
          <Search value={q} onChange={setQ} placeholder="ค้นหาเลขที่ใบสั่งขายหรือชื่อลูกค้า" icon={<SearchIcon size={14} />} />
          <Select value={channel} onChange={setChannel} options={["ทุกช่องทาง", ...CHANNELS]} />
          <span className="ml-auto text-[12px] text-slate-400">
            รวม {baht(rows.reduce((n, so) => n + orderTotal(so).gross, 0))}
          </span>
        </div>
      }
    />
  );
}

/* -------------------------------------------------------------- shipping */

function Shipping({ onOpenOrder }: { onOpenOrder: (so: SalesOrder) => void }) {
  const pending = SALES_ORDERS.filter((so) => !deliveryOf(so.no));

  return (
    <div className="space-y-3">
      <StatStrip
        title="การจัดส่ง"
        icon={<Truck size={15} />}
        cells={[
          { icon: <Truck size={13} />, label: "ใบส่งของทั้งหมด", value: DELIVERIES.length + " ใบ", sub: "อ้างถึงใบสั่งขายที่เป็นต้นเรื่อง" },
          { icon: <CircleCheck size={13} />, label: "ส่งถึงแล้ว", value: DELIVERIES.filter((d) => d.status === "ส่งถึงแล้ว").length + " ใบ", sub: "พร้อมออกใบแจ้งหนี้", tone: "ok" },
          { icon: <MapPin size={13} />, label: "กำลังจัดส่ง", value: DELIVERIES.filter((d) => d.status === "กำลังจัดส่ง").length + " ใบ", sub: "อยู่ระหว่างทาง", tone: "warn" },
          { icon: <Package size={13} />, label: "รอเปิดใบส่งของ", value: pending.length + " ใบ", sub: "ใบสั่งขายที่ยังไม่ได้จัดส่ง", tone: pending.length > 0 ? "info" : "ok" },
        ]}
      />

      <Card
        title={<span className="flex items-center gap-2"><Truck size={15} className="text-slate-400" />ใบส่งของ</span>}
        subtitle="เส้นทาง ผู้ขนส่ง และรายการที่ส่งไปในแต่ละเที่ยว"
      >
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {DELIVERIES.map((d) => {
            const so = SALES_ORDERS.find((s) => s.no === d.so)!;
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
                <span className="w-40 shrink-0 truncate text-[11.5px] text-slate-400">{d.carrier}</span>
                <Badge tone={DELIVERY_TONE[d.status] ?? "idle"} dot>{d.status}</Badge>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card
        title={<span className="flex items-center gap-2"><Package size={15} className="text-slate-400" />ใบสั่งขายที่ยังไม่ได้เปิดใบส่งของ</span>}
        subtitle="ของยังอยู่ในคลัง ยังไม่ถือเป็นการส่งมอบ"
      >
        {pending.length === 0 ? (
          <p className="py-10 text-center text-[12.5px] text-slate-400">ทุกใบสั่งขายมีใบส่งของแล้ว</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {pending.map((so) => (
              <li key={so.no} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                <button onClick={() => onOpenOrder(so)} className="w-36 shrink-0 text-left font-mono text-[12px] text-slate-500 transition hover:text-violet-700 dark:text-slate-400">
                  {so.no}
                </button>
                <span className="w-48 shrink-0 truncate text-[13px] text-slate-900 dark:text-slate-50">{customer(so.customer).name}</span>
                <span className="min-w-0 flex-1 text-[12.5px] text-slate-500 dark:text-slate-400">
                  {so.lines.map((l) => `${material(l.material).name} × ${l.qty}`).join(" · ")}
                </span>
                <span className="shrink-0 text-[12.5px] tabular-nums text-slate-700 dark:text-slate-200">{baht(orderTotal(so).gross)}</span>
                <Badge tone="info">รอจัดส่ง</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/* --------------------------------------------------------------- billing */

function Billing({ unbilled, onOpenOrder }: { unbilled: SalesOrder[]; onOpenOrder: (so: SalesOrder) => void }) {
  const rows = BILLINGS.map((b) => {
    const so = SALES_ORDERS.find((s) => s.no === b.so)!;
    return { b, so, t: orderTotal(so) };
  });
  const billed = rows.reduce((n, r) => n + r.t.gross, 0);
  const collected = rows.filter((r) => r.b.paid).reduce((n, r) => n + r.t.gross, 0);

  return (
    <div className="space-y-3">
      <StatStrip
        title="การวางบิลและเก็บเงิน"
        icon={<Receipt size={15} />}
        cells={[
          { icon: <Receipt size={13} />, label: "ใบแจ้งหนี้ที่ออกแล้ว", value: BILLINGS.length + " ใบ", sub: baht(billed) },
          { icon: <Banknote size={13} />, label: "เก็บเงินแล้ว", value: baht(collected), sub: `${rows.filter((r) => r.b.paid).length} ใบ`, tone: "ok" },
          { icon: <CalendarClock size={13} />, label: "ยังไม่เก็บเงิน", value: baht(billed - collected), sub: `${rows.filter((r) => !r.b.paid).length} ใบ`, tone: "warn" },
          { icon: <TriangleAlert size={13} />, label: "ส่งของแล้วยังไม่วางบิล", value: unbilled.length + " ใบ", sub: "ยังไม่กลายเป็นรายได้", tone: unbilled.length > 0 ? "bad" : "ok" },
        ]}
      />

      <Card
        title={<span className="flex items-center gap-2"><Receipt size={15} className="text-slate-400" />ใบแจ้งหนี้</span>}
        subtitle="แยกยอดก่อนภาษี ภาษีมูลค่าเพิ่ม และยอดที่ลูกค้าต้องจ่าย"
      >
        <table className="w-full text-[13px]">
          <thead className="bg-slate-50/80 text-left text-[11px] uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">เลขที่</th>
              <th className="px-4 py-3 font-medium">อ้างใบสั่งขาย</th>
              <th className="px-4 py-3 font-medium">ลูกค้า</th>
              <th className="px-4 py-3 text-right font-medium">ก่อนภาษี</th>
              <th className="px-4 py-3 text-right font-medium">ภาษี</th>
              <th className="px-4 py-3 text-right font-medium">รวม</th>
              <th className="px-4 py-3 font-medium">สถานะ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.map(({ b, so, t }) => (
              <tr key={b.no} className="transition hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <td className="px-4 py-2.5 font-mono text-[12px] text-slate-500 dark:text-slate-400">{b.no}</td>
                <td className="px-4 py-2.5">
                  <button onClick={() => onOpenOrder(so)} className="font-mono text-[12px] text-violet-700 transition hover:underline dark:text-violet-300">
                    {b.so}
                  </button>
                </td>
                <td className="px-4 py-2.5 text-slate-900 dark:text-slate-50">{customer(so.customer).name}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-300">{baht(t.net)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-slate-500 dark:text-slate-400">{baht(t.vat)}</td>
                <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-slate-900 dark:text-slate-50">{baht(t.gross)}</td>
                <td className="px-4 py-2.5">
                  <Badge tone={b.paid ? "ok" : "warn"} dot>{b.paid ? "เก็บเงินแล้ว" : "ยังไม่เก็บเงิน"}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card
        title={<span className="flex items-center gap-2"><TriangleAlert size={15} className="text-slate-400" />ส่งของแล้วแต่ยังไม่ได้ออกใบแจ้งหนี้</span>}
        subtitle="ของออกจากคลังไปแล้ว แต่ยังไม่กลายเป็นรายได้จนกว่าจะออกใบแจ้งหนี้"
      >
        {unbilled.length === 0 ? (
          <p className="py-10 text-center text-[12.5px] text-slate-400">ทุกใบที่ส่งของแล้ววางบิลครบ</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {unbilled.map((so) => {
              const d = deliveryOf(so.no)!;
              return (
                <li key={so.no} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                  <button onClick={() => onOpenOrder(so)} className="w-36 shrink-0 text-left font-mono text-[12px] text-slate-500 transition hover:text-violet-700 dark:text-slate-400">
                    {so.no}
                  </button>
                  <span className="w-48 shrink-0 truncate text-[13px] text-slate-900 dark:text-slate-50">{customer(so.customer).name}</span>
                  <span className="min-w-0 flex-1 text-[12px] text-slate-400">
                    ส่งเมื่อ {d.date} · {d.route} · {d.status}
                  </span>
                  <span className="shrink-0 text-[13px] font-semibold tabular-nums text-slate-900 dark:text-slate-50">
                    {baht(orderTotal(so).gross)}
                  </span>
                  <Badge tone="warn">รอวางบิล</Badge>
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

function Credit({ onOpenCustomer }: { onOpenCustomer: (c: Customer) => void }) {
  const [only, setOnly] = useState("ทั้งหมด");
  const rows = CUSTOMERS.map((c) => ({ c, cr: creditCheck(c.code) })).filter((x) =>
    only === "ทั้งหมด" ? true : only === "เกินวงเงิน" ? x.cr.blocked : x.cr.cashOnly
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
        <span className="ml-auto text-[12px] text-slate-400">ยอดค้างคิดจากใบสั่งขายที่ยังไม่เก็บเงิน</span>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {rows.map(({ c, cr }) => (
          <Card
            key={c.code}
            title={
              <button onClick={() => onOpenCustomer(c)} className="flex items-center gap-2.5 text-left transition hover:text-violet-700">
                <Avatar name={c.name.replace(/^(บจก\.|หจก\.|ร้าน)\s*/, "")} size="sm" />
                {c.name}
              </button>
            }
            subtitle={`${c.channel} · ${c.terms} · ${c.address}`}
            action={
              <Badge tone={cr.cashOnly ? "idle" : cr.blocked ? "bad" : "ok"} dot>
                {cr.cashOnly ? "ขายเงินสด" : cr.blocked ? "เกินวงเงิน" : "อยู่ในวงเงิน"}
              </Badge>
            }
          >
            <div className="space-y-3 p-4">
              {cr.cashOnly ? (
                <Note tone="idle">ลูกค้ารายนี้ไม่มีวงเงินเครดิต ทุกใบต้องเก็บเงินก่อนส่งของ</Note>
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
                      ยอดค้างเกินวงเงินอยู่ {baht(cr.used - cr.limit)} ลูกค้ารายนี้จะเปิดใบสั่งขายใบถัดไปไม่ได้จนกว่าจะเก็บเงินบางส่วนก่อน
                    </Note>
                  )}
                </>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- records */

function OrderRecord({ so }: { so: SalesOrder }) {
  const [tab, setTab] = useState(ORDER_TABS[0]);
  const c = customer(so.customer);
  const t = orderTotal(so);
  const d = deliveryOf(so.no);
  const b = billingOf(so.no);
  const at = stageOf(so);
  const flow: { label: string; state: StepState }[] = ORDER_FLOW.map((s, i) => ({
    label: s,
    state: i < at ? "done" : i === at ? "current" : "todo",
  }));

  return (
    <div>
      <div className="flex flex-wrap items-start gap-4 border-b border-slate-100 px-5 pb-5 dark:border-slate-800">
        <Avatar name={c.name.replace(/^(บจก\.|หจก\.|ร้าน)\s*/, "")} size="xl" />
        <div className="min-w-0 flex-1">
          <h2 className="text-[18px] font-semibold text-slate-900 dark:text-slate-50">{c.name}</h2>
          <p className="mt-0.5 font-mono text-[12.5px] text-slate-500 dark:text-slate-400">
            {so.no} · {so.date}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Tag swatch={channelSwatch(c.channel)}>{c.channel}</Tag>
            <Chip>{c.terms}</Chip>
            <Badge tone={at === 3 ? "ok" : at === 0 ? "idle" : "accent"} dot>{ORDER_FLOW[at]}</Badge>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[11.5px] text-slate-400">ยอดรวมภาษี</p>
          <p className="text-[24px] font-semibold tabular-nums text-slate-900 dark:text-slate-50">{baht(t.gross)}</p>
        </div>
      </div>

      <div className="px-5">
        <Tabs tabs={ORDER_TABS} active={tab} onPick={setTab} icons={ORDER_ICONS} id="so" />
      </div>

      <div className="px-5 py-4">
        {tab === "การคิดราคา" && (
          <div className="space-y-3">
            <Stepper
              steps={flow}
              icons={{
                done: <CircleCheck size={14} />,
                current: <Truck size={14} />,
                todo: <Package size={14} />,
                failed: <CircleX size={14} />,
              }}
            />
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {so.lines.map((l) => {
                const p = priceLine(l, c.channel);
                return (
                  <li key={l.material} className="py-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium text-slate-900 dark:text-slate-50">
                          {material(l.material).name}
                        </span>
                        <span className="block font-mono text-[11px] text-slate-400">{l.material}</span>
                      </span>
                      <span className="shrink-0 text-[11.5px] tabular-nums text-slate-400">
                        {l.qty} × {baht(p.net)}
                      </span>
                      <span className="w-28 shrink-0 text-right text-[13px] font-semibold tabular-nums text-slate-900 dark:text-slate-50">
                        {baht(p.amount)}
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11.5px]">
                      <span className="text-slate-400">ราคาตั้ง {baht(p.list)}</span>
                      {p.chan > 0 && <Badge tone="accent">ช่องทาง −{Math.round(p.chan * 100)}%</Badge>}
                      {p.vol > 0 && <Badge tone="info">จำนวน −{Math.round(p.vol * 100)}%</Badge>}
                      <span className="text-slate-500 dark:text-slate-400">เหลือ {baht(p.net)} ต่อหน่วย</span>
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

        {tab === "การจัดส่ง" &&
          (d ? (
            <div className="space-y-3">
              <div className="space-y-1">
                <IconRow icon={<FileText size={14} />} label="เลขที่ใบส่งของ">{d.no}</IconRow>
                <IconRow icon={<CalendarClock size={14} />} label="วันที่ส่ง">{d.date}</IconRow>
                <IconRow icon={<MapPin size={14} />} label="เส้นทาง">{d.route}</IconRow>
                <IconRow icon={<Truck size={14} />} label="ผู้ขนส่ง">{d.carrier}</IconRow>
              </div>
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {d.lines.map((l) => (
                  <li key={l.material} className="flex items-center gap-3 py-2 text-[13px]">
                    <span className="min-w-0 flex-1 truncate text-slate-800 dark:text-slate-100">{material(l.material).name}</span>
                    <span className="shrink-0 tabular-nums text-slate-600 dark:text-slate-300">
                      {l.qty} {material(l.material).unit}
                    </span>
                  </li>
                ))}
              </ul>
              <Note tone={d.status === "ส่งถึงแล้ว" ? "ok" : "warn"}>
                {d.status === "ส่งถึงแล้ว" ? "ส่งถึงลูกค้าแล้ว พร้อมออกใบแจ้งหนี้" : "อยู่ระหว่างจัดส่ง ยังออกใบแจ้งหนี้ไม่ได้"}
              </Note>
            </div>
          ) : (
            <Note tone="idle">ใบนี้ยังไม่ได้เปิดใบส่งของ ของยังอยู่ในคลัง</Note>
          ))}

        {tab === "การวางบิล" &&
          (b ? (
            <div className="space-y-3">
              <div className="space-y-1">
                <IconRow icon={<Receipt size={14} />} label="เลขที่ใบแจ้งหนี้">{b.no}</IconRow>
                <IconRow icon={<CalendarClock size={14} />} label="วันที่ออก">{b.date}</IconRow>
                <IconRow icon={<Coins size={14} />} label="ยอดก่อนภาษี">{baht(t.net)}</IconRow>
                <IconRow icon={<Percent size={14} />} label="ภาษีมูลค่าเพิ่ม">{baht(t.vat)}</IconRow>
                <IconRow icon={<Banknote size={14} />} label="ยอดที่ต้องเก็บ">{baht(t.gross)}</IconRow>
              </div>
              <Note tone={b.paid ? "ok" : "warn"}>
                {b.paid ? "เก็บเงินเรียบร้อยแล้ว ยอดนี้ไม่กินวงเงินเครดิตของลูกค้า" : `ยังไม่เก็บเงิน ยอดนี้กินวงเงินเครดิตของลูกค้าอยู่ ${baht(t.gross)}`}
              </Note>
            </div>
          ) : (
            <Note tone={d ? "warn" : "idle"}>
              {d ? "ส่งของแล้วแต่ยังไม่ได้ออกใบแจ้งหนี้ ยอดนี้ยังไม่ถือเป็นรายได้" : "ยังไม่ถึงขั้นวางบิล ต้องส่งของก่อน"}
            </Note>
          ))}

        {tab === "ลูกค้า" && <CustomerFacts c={c} />}
      </div>
    </div>
  );
}

function CustomerFacts({ c }: { c: Customer }) {
  const cr = creditCheck(c.code);
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <IconRow icon={<FileText size={14} />} label="รหัสลูกค้า">{c.code}</IconRow>
        <IconRow icon={<Users size={14} />} label="ผู้ติดต่อ">{c.contact}</IconRow>
        <IconRow icon={<Tags size={14} />} label="ช่องทางขาย">{c.channel}</IconRow>
        <IconRow icon={<CreditCard size={14} />} label="เงื่อนไขชำระ">{c.terms}</IconRow>
        <IconRow icon={<MapPin size={14} />} label="พื้นที่">{c.address}</IconRow>
        <IconRow icon={<Building size={14} />} label="เลขผู้เสียภาษี">{c.taxId}</IconRow>
      </div>
      {!cr.cashOnly && <Progress done={Math.min(cr.used, cr.limit)} total={cr.limit} label={`ใช้วงเงิน ${baht(cr.used)} จาก ${baht(cr.limit)}`} />}
    </div>
  );
}

function CustomerRecord({ c, onOpenOrder }: { c: Customer; onOpenOrder: (so: SalesOrder) => void }) {
  const orders = SALES_ORDERS.filter((so) => so.customer === c.code);
  const cr = creditCheck(c.code);

  return (
    <div className="space-y-4">
      <CustomerFacts c={c} />

      <div>
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-400">ใบสั่งขายของลูกค้ารายนี้</p>
        {orders.length === 0 ? (
          <p className="py-4 text-center text-[12.5px] text-slate-400">ยังไม่มีใบสั่งขาย</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {orders.map((so) => {
              const t = orderTotal(so);
              const paid = billingOf(so.no)?.paid;
              return (
                <li key={so.no} className="flex items-center gap-3 py-2 text-[13px]">
                  <button onClick={() => onOpenOrder(so)} className="font-mono text-[12px] text-violet-700 transition hover:underline dark:text-violet-300">
                    {so.no}
                  </button>
                  <span className="tabular-nums text-slate-400">{so.date}</span>
                  <Badge tone={paid ? "ok" : "warn"}>{paid ? "เก็บเงินแล้ว" : "ยังไม่เก็บเงิน"}</Badge>
                  <span className="ml-auto tabular-nums text-slate-900 dark:text-slate-50">{baht(t.gross)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Note tone={cr.cashOnly ? "idle" : cr.blocked ? "bad" : "ok"}>
        {cr.cashOnly
          ? "ลูกค้ารายนี้ขายเงินสดเท่านั้น"
          : cr.blocked
            ? `ยอดค้าง ${baht(cr.used)} เกินวงเงิน ${baht(cr.limit)} อยู่ ${baht(cr.used - cr.limit)}`
            : `ยอดค้าง ${baht(cr.used)} ยังเหลือวงเงินอีก ${baht(cr.left)}`}
      </Note>
    </div>
  );
}
