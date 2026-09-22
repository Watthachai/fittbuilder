import { FINISHED_GOODS, material } from "../mm/data";

/** สินค้าที่ขายได้ — อ่านจากแฟ้มวัสดุ ไม่ได้ถือรายการของตัวเอง */
export const CATALOG = FINISHED_GOODS;

export const CUSTOMERS = [
  { code: "C-101", name: "บจก. เจริญคลังสินค้า", contact: "คุณอรุณ", channel: "ขายตรง", terms: "เครดิต 30 วัน", creditLimit: 800000, taxId: "0105544000321", address: "ระยอง" },
  { code: "C-102", name: "หจก. พาณิชย์ภัณฑ์", contact: "คุณกิตติ", channel: "ตัวแทนจำหน่าย", terms: "เครดิต 60 วัน", creditLimit: 1200000, taxId: "0103550000654", address: "ชลบุรี" },
  { code: "C-103", name: "บจก. สำนักงานทันสมัย", contact: "คุณพิมพ์", channel: "ขายตรง", terms: "เครดิต 30 วัน", creditLimit: 400000, taxId: "0105558000147", address: "กรุงเทพฯ" },
  { code: "C-104", name: "ร้านวัสดุบ้านสวน", contact: "คุณสมหญิง", channel: "ขายหน้าร้าน", terms: "เงินสด", creditLimit: 0, taxId: "3101200456789", address: "นครปฐม" },
  { code: "C-105", name: "บจก. โลจิสติกส์ตะวันออก", contact: "คุณธนา", channel: "ตัวแทนจำหน่าย", terms: "เครดิต 60 วัน", creditLimit: 600000, taxId: "0105561000258", address: "ฉะเชิงเทรา" },
];

/** ราคาขายและส่วนลดตามช่องทาง — เงื่อนไขที่ประกาศไว้ ไม่ใช่ราคาที่พิมพ์ลงใบสั่งขายทีละใบ */
export const PRICE_LIST: Record<string, number> = {
  "FG-5001": 11900,
  "FG-5002": 13900,
  "FG-5003": 18900,
};

export const CHANNEL_DISCOUNT: Record<string, number> = {
  "ขายตรง": 0,
  "ตัวแทนจำหน่าย": 0.08,
  "ขายหน้าร้าน": 0.03,
};

/** ซื้อเยอะลดเพิ่ม — ขั้นบันไดตามจำนวนต่อบรรทัด */
export const VOLUME_BREAKS = [
  { minQty: 30, discount: 0.05 },
  { minQty: 15, discount: 0.03 },
  { minQty: 5, discount: 0.01 },
];

export const VAT_RATE = 0.07;

export const SALES_ORDERS = [
  { no: "SO-2569-0412", customer: "C-102", date: "2026-09-14", lines: [{ material: "FG-5001", qty: 30 }, { material: "FG-5002", qty: 10 }] },
  { no: "SO-2569-0413", customer: "C-101", date: "2026-09-17", lines: [{ material: "FG-5003", qty: 6 }] },
  { no: "SO-2569-0414", customer: "C-103", date: "2026-09-19", lines: [{ material: "FG-5002", qty: 16 }] },
  { no: "SO-2569-0415", customer: "C-104", date: "2026-09-20", lines: [{ material: "FG-5001", qty: 3 }] },
  { no: "SO-2569-0416", customer: "C-105", date: "2026-09-21", lines: [{ material: "FG-5001", qty: 20 }, { material: "FG-5003", qty: 4 }] },
];

export const DELIVERIES = [
  { no: "DO-2569-0301", so: "SO-2569-0412", date: "2026-09-18", route: "ชลบุรี", carrier: "ขนส่งเจริญทรัพย์", status: "ส่งถึงแล้ว", lines: [{ material: "FG-5001", qty: 30 }, { material: "FG-5002", qty: 10 }] },
  { no: "DO-2569-0302", so: "SO-2569-0413", date: "2026-09-20", route: "ระยอง", carrier: "ขนส่งเจริญทรัพย์", status: "กำลังจัดส่ง", lines: [{ material: "FG-5003", qty: 6 }] },
  { no: "DO-2569-0303", so: "SO-2569-0415", date: "2026-09-21", route: "นครปฐม", carrier: "รับเองที่โรงงาน", status: "ส่งถึงแล้ว", lines: [{ material: "FG-5001", qty: 3 }] },
];

/** ใบแจ้งหนี้ที่ออกแล้ว — ยังไม่เก็บเงินคือยอดค้างที่กินวงเงินเครดิต */
export const BILLINGS = [
  { no: "IV-2569-0908", so: "SO-2569-0412", date: "2026-09-18", paid: true },
  { no: "IV-2569-0911", so: "SO-2569-0415", date: "2026-09-21", paid: false },
];

export type Customer = (typeof CUSTOMERS)[number];
export type SalesOrder = (typeof SALES_ORDERS)[number];
export type OrderLine = SalesOrder["lines"][number];

export const customer = (code: string) => {
  const c = CUSTOMERS.find((x) => x.code === code);
  if (!c) throw new Error(`ไม่พบลูกค้า ${code}`);
  return c;
};

export const baht = (n: number) => n.toLocaleString("th-TH", { maximumFractionDigits: 0 }) + " ฿";

export const volumeDiscount = (qty: number) =>
  VOLUME_BREAKS.find((b) => qty >= b.minQty)?.discount ?? 0;

/** ราคาหนึ่งบรรทัด: ราคาตั้ง → ส่วนลดช่องทาง → ส่วนลดตามจำนวน */
export function priceLine(line: OrderLine, channel: string) {
  const list = PRICE_LIST[line.material] ?? 0;
  const chan = CHANNEL_DISCOUNT[channel] ?? 0;
  const vol = volumeDiscount(line.qty);
  const net = Math.round(list * (1 - chan) * (1 - vol));
  return { list, chan, vol, net, amount: net * line.qty };
}

/** ทั้งใบ: รวมก่อนภาษี ภาษีมูลค่าเพิ่ม และยอดที่ลูกค้าต้องจ่าย */
export function orderTotal(so: SalesOrder) {
  const c = customer(so.customer);
  const lines = so.lines.map((l) => ({ ...l, ...priceLine(l, c.channel) }));
  const net = lines.reduce((n, l) => n + l.amount, 0);
  const vat = Math.round(net * VAT_RATE);
  return { lines, net, vat, gross: net + vat };
}

export const deliveryOf = (soNo: string) => DELIVERIES.find((d) => d.so === soNo);
export const billingOf = (soNo: string) => BILLINGS.find((b) => b.so === soNo);

/** ยอดที่ลูกค้าติดค้างอยู่ตอนนี้ = ใบสั่งขายที่ยังไม่เก็บเงิน */
export function exposureOf(code: string) {
  return SALES_ORDERS.filter((so) => so.customer === code)
    .filter((so) => !billingOf(so.no)?.paid)
    .reduce((n, so) => n + orderTotal(so).gross, 0);
}

export function creditCheck(code: string) {
  const c = customer(code);
  const used = exposureOf(code);
  return {
    limit: c.creditLimit, used,
    left: c.creditLimit - used,
    blocked: c.creditLimit > 0 && used > c.creditLimit,
    cashOnly: c.creditLimit === 0,
  };
}
