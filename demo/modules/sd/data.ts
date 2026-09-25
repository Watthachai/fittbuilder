import { FINISHED_GOODS, TODAY, issueForDelivery } from "../mm/data";
import { commit } from "../kit";
import { COMPANY } from "../company";

/**
 * ขายและกระจายสินค้า — ใบเสนอราคา → ใบสั่งขาย → ใบส่งของ → ใบกำกับภาษี → ใบวางบิล → รับชำระ
 *
 * ทุกการเปลี่ยนแปลงผ่านฟังก์ชันในไฟล์นี้ และทุกฟังก์ชันเปลี่ยน array เดิมใน
 * commit() เท่านั้น — ใบแจ้งหนี้ที่ออกที่นี่จึงไปโผล่ในลูกหนี้ของบัญชีเอง
 * โดยไม่มีใครต้องคัดลอกไปเก็บไว้อีกชุด
 */

/** สินค้าที่ขายได้ — อ่านจากแฟ้มวัสดุ ไม่ได้ถือรายการของตัวเอง */
export const CATALOG = FINISHED_GOODS;

export { TODAY };

export { COMPANY };

export const TERMS = ["เงินสด", "เครดิต 7 วัน", "เครดิต 15 วัน", "เครดิต 30 วัน", "เครดิต 45 วัน", "เครดิต 60 วัน", "เครดิต 90 วัน"];

/** "เครดิต 30 วัน" → 30 · "เงินสด" → 0 */
export const termDays = (terms: string) => Number(terms.match(/\d+/)?.[0] ?? 0);

export type Customer = {
  code: string;
  name: string;
  contact: string;
  channel: string;
  terms: string;
  /** ศูนย์คือขายเงินสดเท่านั้น — เงื่อนไขชำระต้องเป็น "เงินสด" ด้วยเสมอ */
  creditLimit: number;
  taxId: string;
  /** จังหวัด — พื้นที่ขายและเส้นทางส่งของ */
  address: string;
  /** "สำนักงานใหญ่" หรือ "สาขาที่ 00001" — ใบกำกับภาษีต้องระบุ */
  branch: string;
  /** ที่อยู่ตามที่จดทะเบียน พิมพ์ลงใบกำกับภาษี */
  billingAddress: string;
  phone: string;
};

export const CUSTOMERS: Customer[] = [
  { code: "C-101", name: "บจก. เจริญคลังสินค้า", contact: "คุณอรุณ", channel: "ขายตรง", terms: "เครดิต 30 วัน", creditLimit: 800000, taxId: "0105544000321", address: "ระยอง", branch: "สำนักงานใหญ่", billingAddress: "99/12 หมู่ 4 ถนนสุขุมวิท ตำบลมาบตาพุด อำเภอเมืองระยอง จังหวัดระยอง 21150", phone: "038-601-222" },
  { code: "C-102", name: "หจก. พาณิชย์ภัณฑ์", contact: "คุณกิตติ", channel: "ตัวแทนจำหน่าย", terms: "เครดิต 60 วัน", creditLimit: 1200000, taxId: "0103550000654", address: "ชลบุรี", branch: "สำนักงานใหญ่", billingAddress: "45/7 ถนนสุขุมวิท ตำบลบ้านสวน อำเภอเมืองชลบุรี จังหวัดชลบุรี 20000", phone: "038-274-310" },
  { code: "C-103", name: "บจก. สำนักงานทันสมัย", contact: "คุณพิมพ์", channel: "ขายตรง", terms: "เครดิต 30 วัน", creditLimit: 400000, taxId: "0105558000147", address: "กรุงเทพฯ", branch: "สำนักงานใหญ่", billingAddress: "1550 อาคารธนภูมิ ชั้น 12 ถนนเพชรบุรีตัดใหม่ แขวงมักกะสัน เขตราชเทวี กรุงเทพมหานคร 10400", phone: "02-652-7788" },
  { code: "C-104", name: "ร้านวัสดุบ้านสวน", contact: "คุณสมหญิง", channel: "ขายหน้าร้าน", terms: "เงินสด", creditLimit: 0, taxId: "3101200456789", address: "นครปฐม", branch: "สำนักงานใหญ่", billingAddress: "12 หมู่ 3 ถนนเพชรเกษม ตำบลสามพราน อำเภอสามพราน จังหวัดนครปฐม 73110", phone: "034-311-456" },
  { code: "C-105", name: "บจก. โลจิสติกส์ตะวันออก", contact: "คุณธนา", channel: "ตัวแทนจำหน่าย", terms: "เครดิต 60 วัน", creditLimit: 600000, taxId: "0105561000258", address: "ฉะเชิงเทรา", branch: "สาขาที่ 00001", billingAddress: "88 หมู่ 9 ถนนบางนา-ตราด ตำบลบางวัว อำเภอบางปะกง จังหวัดฉะเชิงเทรา 24130", phone: "038-531-900" },
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

/** ซื้อเยอะลดเพิ่ม — ขั้นบันไดตามจำนวนต่อบรรทัด เรียงจากขั้นสูงลงมา */
export const VOLUME_BREAKS = [
  { minQty: 30, discount: 0.05 },
  { minQty: 15, discount: 0.03 },
  { minQty: 5, discount: 0.01 },
];

export const VAT_RATE = 0.07;

export type OrderLine = {
  material: string;
  qty: number;
  /**
   * ราคาต่อหน่วยหลังหักส่วนลดที่ตกลงในใบนี้ เก็บไว้กับใบ ไม่ได้คิดใหม่ทุกครั้งที่เปิด —
   * ประกาศราคาใหม่หรือย้ายช่องทางของลูกค้าจึงไม่ไปเปลี่ยนยอดใบกำกับที่ออกไปแล้ว
   */
  price: number;
};

export type OrderStatus = "รอยืนยัน" | "รออนุมัติเครดิต" | "ยืนยันแล้ว" | "ยกเลิก";

export type SalesOrder = {
  no: string;
  customer: string;
  date: string;
  lines: OrderLine[];
  status: OrderStatus;
  /** วันที่ลูกค้าต้องการรับของ */
  shipBy?: string;
  /** เลขที่ใบสั่งซื้อของลูกค้า — ลูกค้านิติบุคคลมักขอให้อ้างในใบกำกับ */
  customerPo?: string;
  note?: string;
  quotation?: string;
  cancelReason?: string;
  creditApproval?: { date: string; note: string };
};

export const SALES_ORDERS: SalesOrder[] = [
  { no: "SO-2569-0412", customer: "C-102", date: "2026-09-14", status: "ยืนยันแล้ว", lines: [{ material: "FG-5001", qty: 30, price: 10401 }, { material: "FG-5002", qty: 10, price: 12660 }] },
  { no: "SO-2569-0413", customer: "C-101", date: "2026-09-17", status: "ยืนยันแล้ว", lines: [{ material: "FG-5003", qty: 6, price: 18711 }] },
  { no: "SO-2569-0414", customer: "C-103", date: "2026-09-19", status: "ยืนยันแล้ว", quotation: "QT-2569-0231", lines: [{ material: "FG-5002", qty: 16, price: 13483 }] },
  { no: "SO-2569-0415", customer: "C-104", date: "2026-09-20", status: "ยืนยันแล้ว", lines: [{ material: "FG-5001", qty: 3, price: 11543 }] },
  { no: "SO-2569-0416", customer: "C-105", date: "2026-09-21", status: "ยืนยันแล้ว", lines: [{ material: "FG-5001", qty: 20, price: 10620 }, { material: "FG-5003", qty: 4, price: 17388 }] },
];

export type QuotationStatus = "รอลูกค้าตอบ" | "ได้ใบสั่งขาย" | "ยกเลิก";

export type Quotation = {
  no: string;
  customer: string;
  date: string;
  /** ยืนราคาถึงวันนี้ — เลยแล้วต้องเสนอใหม่ */
  validUntil: string;
  lines: OrderLine[];
  status: QuotationStatus;
  note?: string;
  so?: string;
  cancelReason?: string;
};

export const QUOTATIONS: Quotation[] = [
  { no: "QT-2569-0231", customer: "C-103", date: "2026-09-16", validUntil: "2026-10-16", status: "ได้ใบสั่งขาย", so: "SO-2569-0414", lines: [{ material: "FG-5002", qty: 16, price: 13483 }] },
  { no: "QT-2569-0232", customer: "C-101", date: "2026-09-21", validUntil: "2026-10-21", status: "รอลูกค้าตอบ", note: "ราคารวมค่าขนส่งในเขตระยอง", lines: [{ material: "FG-5001", qty: 12, price: 11781 }, { material: "FG-5003", qty: 2, price: 18900 }] },
];

export type DeliveryStatus = "กำลังจัดส่ง" | "ส่งถึงแล้ว";

export type Delivery = {
  no: string;
  so: string;
  date: string;
  route: string;
  carrier: string;
  status: DeliveryStatus;
  lines: { material: string; qty: number }[];
  deliveredOn?: string;
  receivedBy?: string;
};

export const DELIVERIES: Delivery[] = [
  { no: "DO-2569-0301", so: "SO-2569-0412", date: "2026-09-18", route: "ชลบุรี", carrier: "ขนส่งเจริญทรัพย์", status: "ส่งถึงแล้ว", lines: [{ material: "FG-5001", qty: 30 }, { material: "FG-5002", qty: 10 }] },
  { no: "DO-2569-0302", so: "SO-2569-0413", date: "2026-09-20", route: "ระยอง", carrier: "ขนส่งเจริญทรัพย์", status: "กำลังจัดส่ง", lines: [{ material: "FG-5003", qty: 6 }] },
  { no: "DO-2569-0303", so: "SO-2569-0415", date: "2026-09-21", route: "นครปฐม", carrier: "รับเองที่โรงงาน", status: "ส่งถึงแล้ว", lines: [{ material: "FG-5001", qty: 3 }] },
];

export const CARRIERS = ["ขนส่งเจริญทรัพย์", "รถของบริษัท", "รับเองที่โรงงาน", "ไปรษณีย์ไทย EMS"];

export const PAY_METHODS = ["โอนเงิน", "เช็ค", "เงินสด"];

/**
 * ใบเสร็จรับเงิน — ที่เดียวที่บันทึกการรับชำระ ทั้งหน้าขายและบัญชีลูกหนี้อ่านจากที่นี่.
 * `amount` คือเงินที่ได้รับจริง `wht` คือภาษีที่ลูกค้าหัก ณ ที่จ่ายไว้ สองยอดรวมกันเท่ายอดคงค้างของใบ
 */
export type Receipt = { no: string; date: string; method: string; ref: string; amount: number; wht: number };

/** ใบเสร็จที่ยกเลิกแล้ว — เก็บไว้พร้อมเหตุผล และเลขใบเสร็จไม่ถูกนำกลับมาใช้ซ้ำ */
export type VoidedReceipt = Receipt & { invoice: string; voidedOn: string; reason: string };

export const VOIDED_RECEIPTS: VoidedReceipt[] = [];

/**
 * ใบกำกับภาษี/ใบแจ้งหนี้ — หนึ่งใบต่อหนึ่งใบส่งของ เพราะจุดความรับผิดทางภาษีของการขาย
 * สินค้าคือตอนส่งมอบ ส่งสองเที่ยวจึงออกสองใบ
 */
export type Billing = {
  no: string;
  so: string;
  customer: string;
  date: string;
  /** ยังไม่เก็บเงินคือยอดค้างที่กินวงเงินเครดิต — บัญชีอ่านค่านี้ทำลูกหนี้ */
  paid: boolean;
  delivery: string;
  due: string;
  /** ยอดตามใบ ณ วันออก — บัญชีลงภาษีขายและรายได้ด้วยตัวเลขชุดนี้ */
  net: number;
  vat: number;
  gross: number;
  receipt?: Receipt;
};

/** ใบแจ้งหนี้ที่ออกแล้ว — ยังไม่เก็บเงินคือยอดค้างที่กินวงเงินเครดิต */
export const BILLINGS: Billing[] = [
  { no: "IV-2569-0908", so: "SO-2569-0412", customer: "C-102", date: "2026-09-18", paid: true, delivery: "DO-2569-0301", due: "2026-11-17", net: 438630, vat: 30704, gross: 469334, receipt: { no: "RE-2569-0146", date: "2026-09-20", method: "โอนเงิน", ref: "ธ.กสิกรไทย อ้างอิง 0920-4471", amount: 469334, wht: 0 } },
  { no: "IV-2569-0911", so: "SO-2569-0415", customer: "C-104", date: "2026-09-21", paid: false, delivery: "DO-2569-0303", due: "2026-09-21", net: 34629, vat: 2424, gross: 37053 },
];

export type CreditNoteKind = "รับคืนสินค้า" | "ลดราคา";

/** ใบลดหนี้ — อ้างใบกำกับเดิมเสมอ ตามที่ประมวลรัษฎากรมาตรา 86/10 กำหนด */
export type CreditNote = {
  no: string;
  invoice: string;
  so: string;
  customer: string;
  date: string;
  kind: CreditNoteKind;
  reason: string;
  /** qty × price คือมูลค่าที่ลดต่อบรรทัด: รับคืนใช้ราคาเดิม ลดราคาใช้ส่วนที่ลดต่อหน่วย */
  lines: OrderLine[];
  /** มูลค่าที่ลด — บัญชีกลับรายได้และภาษีขายด้วยตัวเลขชุดนี้ */
  net: number;
  vat: number;
  gross: number;
};

export const CREDIT_NOTES: CreditNote[] = [
  { no: "CN-2569-0012", invoice: "IV-2569-0908", so: "SO-2569-0412", customer: "C-102", date: "2026-09-21", kind: "รับคืนสินค้า", reason: "โต๊ะทำงานชำรุดจากการขนส่ง 1 ตัว ลูกค้าส่งคืน", lines: [{ material: "FG-5002", qty: 1, price: 12660 }], net: 12660, vat: 886, gross: 13546 },
];

/** ใบวางบิล — รวมใบกำกับของลูกค้ารายเดียวไปนัดรับเช็คครั้งเดียว */
export type BillingNote = { no: string; customer: string; date: string; payOn: string; invoices: string[] };

export const BILLING_NOTES: BillingNote[] = [
  { no: "BN-2569-0031", customer: "C-102", date: "2026-09-18", payOn: "2026-09-20", invoices: ["IV-2569-0908"] },
];

export type PriceKind = "ราคาตั้ง" | "ส่วนลดช่องทาง" | "ส่วนลดตามจำนวน";

/**
 * การเปลี่ยนเงื่อนไขราคาที่มีวันเริ่มผล. ของเดิมไม่ถูกแก้ทับ — ราคาในวันหนึ่งคือค่าตั้งต้น
 * หรือรายการล่าสุดที่มีผลแล้ว ณ วันนั้น จึงย้อนดูได้ว่าใบไหนควรได้ราคาอะไร
 */
export type PriceChange = {
  no: string;
  kind: PriceKind;
  /** รหัสสินค้า · ชื่อช่องทาง · จำนวนขั้นต่ำของขั้นบันได */
  key: string;
  from: number;
  to: number;
  effective: string;
  reason: string;
  recorded: string;
};

export const PRICE_CHANGES: PriceChange[] = [
  { no: "PC-2569-0007", kind: "ราคาตั้ง", key: "FG-5003", from: 18900, to: 19500, effective: "2026-10-01", reason: "ต้นทุนเหล็กและล้อยางปรับขึ้นตั้งแต่ไตรมาสสี่", recorded: "2026-09-15" },
];

export type CreditChange = {
  date: string;
  customer: string;
  fromLimit: number;
  toLimit: number;
  fromTerms: string;
  toTerms: string;
  reason: string;
};

export const CREDIT_CHANGES: CreditChange[] = [
  { date: "2026-08-01", customer: "C-102", fromLimit: 1000000, toLimit: 1200000, fromTerms: "เครดิต 60 วัน", toTerms: "เครดิต 60 วัน", reason: "ยอดสั่งเพิ่มตามฤดูกาล ชำระตรงเวลาครบ 12 เดือน" },
];

/* ================================================================= lookups */

export const customer = (code: string) => {
  const c = CUSTOMERS.find((x) => x.code === code);
  if (!c) throw new Error(`ไม่พบลูกค้า ${code}`);
  return c;
};

export const salesOrder = (no: string) => {
  const so = SALES_ORDERS.find((x) => x.no === no);
  if (!so) throw new Error(`ไม่พบใบสั่งขาย ${no}`);
  return so;
};

export const quotation = (no: string) => {
  const q = QUOTATIONS.find((x) => x.no === no);
  if (!q) throw new Error(`ไม่พบใบเสนอราคา ${no}`);
  return q;
};

export const delivery = (no: string) => {
  const d = DELIVERIES.find((x) => x.no === no);
  if (!d) throw new Error(`ไม่พบใบส่งของ ${no}`);
  return d;
};

export const invoice = (no: string) => {
  const b = BILLINGS.find((x) => x.no === no);
  if (!b) throw new Error(`ไม่พบใบกำกับภาษี ${no}`);
  return b;
};

export const creditNote = (no: string) => {
  const n = CREDIT_NOTES.find((x) => x.no === no);
  if (!n) throw new Error(`ไม่พบใบลดหนี้ ${no}`);
  return n;
};

export const billingNote = (no: string) => {
  const n = BILLING_NOTES.find((x) => x.no === no);
  if (!n) throw new Error(`ไม่พบใบวางบิล ${no}`);
  return n;
};

export const baht = (n: number) => n.toLocaleString("th-TH", { maximumFractionDigits: 0 }) + " ฿";

export function addDays(iso: string, n: number) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

/** เลขถัดไปของชุดเอกสาร นับตามปี พ.ศ. ของวันที่ในเอกสาร: SO-2569-0416 → SO-2569-0417 */
function nextNo(prefix: string, date: string, used: { no: string }[]) {
  const head = `${prefix}-${Number(date.slice(0, 4)) + 543}-`;
  const last = Math.max(0, ...used.filter((d) => d.no.startsWith(head)).map((d) => Number(d.no.slice(head.length))));
  return head + String(last + 1).padStart(4, "0");
}

/** เลขที่ใบสั่งขายหรือใบเสนอราคาที่จะได้ ถ้าบันทึกวันนี้ — ให้คนคีย์เห็นก่อนกดบันทึก */
export const peekNo = (prefix: "SO" | "QT", date: string) =>
  nextNo(prefix, date, prefix === "SO" ? SALES_ORDERS : QUOTATIONS);

export type Errors = Record<string, string>;

/** ข้อผิดพลาดแรกกลายเป็น exception — หน้าจอตรวจด้วยฟังก์ชัน …Errors ก่อนเรียกเสมอ */
function assertValid(errors: Errors) {
  const first = Object.values(errors)[0];
  if (first) throw new Error(first);
}

/* ================================================================= pricing */

function conditionOn(kind: PriceKind, key: string, date: string, base: number) {
  // sort คงลำดับเดิมของรายการที่มีผลวันเดียวกัน ตัวที่บันทึกทีหลังจึงชนะ
  const hit = PRICE_CHANGES.filter((c) => c.kind === kind && c.key === key && c.effective <= date)
    .sort((a, b) => a.effective.localeCompare(b.effective))
    .at(-1);
  return hit ? hit.to : base;
}

export const listPriceOn = (code: string, date: string) => conditionOn("ราคาตั้ง", code, date, PRICE_LIST[code] ?? 0);

export const channelDiscountOn = (channel: string, date: string) =>
  conditionOn("ส่วนลดช่องทาง", channel, date, CHANNEL_DISCOUNT[channel] ?? 0);

export const volumeBreaksOn = (date: string) =>
  VOLUME_BREAKS.map((b) => ({ minQty: b.minQty, discount: conditionOn("ส่วนลดตามจำนวน", String(b.minQty), date, b.discount) }));

export const volumeDiscount = (qty: number, date: string = TODAY) =>
  volumeBreaksOn(date).find((b) => qty >= b.minQty)?.discount ?? 0;

/** ราคาตามเงื่อนไข ณ วันที่ในเอกสาร: ราคาตั้ง → ส่วนลดช่องทาง → ส่วนลดตามจำนวน */
export function rulePrice(code: string, qty: number, channel: string, date: string) {
  const list = listPriceOn(code, date);
  const chan = channelDiscountOn(channel, date);
  const vol = volumeDiscount(qty, date);
  return { list, chan, vol, net: Math.round(list * (1 - chan) * (1 - vol)) };
}

/** ราคาหนึ่งบรรทัด: ที่มาตามเงื่อนไข และราคาที่ใช้จริงในใบ — ไม่ตรงกันคือราคาพิเศษ */
export function priceLine(line: OrderLine, channel: string, date: string = TODAY) {
  const rule = rulePrice(line.material, line.qty, channel, date);
  return {
    list: rule.list, chan: rule.chan, vol: rule.vol, rule: rule.net,
    net: line.price, amount: line.price * line.qty, special: line.price !== rule.net,
  };
}

/** ก่อนภาษี ภาษีมูลค่าเพิ่ม และยอดรวม — ภาษีปัดเป็นบาทต่อใบ ตรงกับที่ลงบัญชีภาษีขาย */
export function linesTotal(lines: OrderLine[]) {
  const net = lines.reduce((n, l) => n + l.qty * l.price, 0);
  const vat = Math.round(net * VAT_RATE);
  return { net, vat, gross: net + vat };
}

/** ทั้งใบ: รวมก่อนภาษี ภาษีมูลค่าเพิ่ม และยอดที่ลูกค้าต้องจ่าย */
export function orderTotal(so: SalesOrder) {
  const c = customer(so.customer);
  const lines = so.lines.map((l) => ({ ...l, ...priceLine(l, c.channel, so.date) }));
  return { lines, ...linesTotal(so.lines) };
}

/* ============================================================== documents */

export const isCancelled = (so: SalesOrder) => so.status === "ยกเลิก";

/** ใบสั่งขายที่ยังนับเป็นยอดขาย — ใบที่ยกเลิกแล้วเก็บไว้ให้เลขเอกสารไม่ขาดช่วง แต่ไม่นับ */
export const activeOrders = () => SALES_ORDERS.filter((so) => !isCancelled(so));

export const deliveriesOf = (soNo: string) => DELIVERIES.filter((d) => d.so === soNo);
export const invoicesOf = (soNo: string) => BILLINGS.filter((b) => b.so === soNo);
export const invoiceOf = (deliveryNo: string) => BILLINGS.find((b) => b.delivery === deliveryNo);
export const creditNotesOf = (invoiceNo: string) => CREDIT_NOTES.filter((n) => n.invoice === invoiceNo);
export const billingNoteOf = (invoiceNo: string) => BILLING_NOTES.find((n) => n.invoices.includes(invoiceNo));

/** ใบส่งของใบแรกของใบสั่งขาย — ส่งหลายเที่ยวใช้ deliveriesOf */
export const deliveryOf = (soNo: string) => DELIVERIES.find((d) => d.so === soNo);
/** ใบแจ้งหนี้ใบแรกของใบสั่งขาย — ส่งหลายเที่ยวใช้ invoicesOf */
export const billingOf = (soNo: string) => BILLINGS.find((b) => b.so === soNo);

export const orderOfInvoice = (inv: Billing) => salesOrder(inv.so);

/** สั่งเท่าไร ส่งไปแล้วเท่าไร เหลือค้างส่งเท่าไร ต่อบรรทัด */
export function openLines(so: SalesOrder) {
  return so.lines.map((l) => {
    const shipped = deliveriesOf(so.no).reduce((n, d) => n + (d.lines.find((x) => x.material === l.material)?.qty ?? 0), 0);
    return { material: l.material, ordered: l.qty, shipped, open: l.qty - shipped };
  });
}

export const fullyShipped = (so: SalesOrder) => openLines(so).every((l) => l.open === 0);

/** รายการในใบกำกับ = ของในใบส่งของ ในราคาที่ตกลงไว้ในใบสั่งขาย */
export function invoiceLines(inv: Billing): OrderLine[] {
  const so = salesOrder(inv.so);
  return delivery(inv.delivery).lines.map((l) => {
    const line = so.lines.find((x) => x.material === l.material);
    if (!line) throw new Error(`ใบส่งของ ${inv.delivery} มี ${l.material} ที่ไม่อยู่ในใบสั่งขาย ${so.no}`);
    return { material: l.material, qty: l.qty, price: line.price };
  });
}

export const invoiceTotal = (inv: Billing) => ({ net: inv.net, vat: inv.vat, gross: inv.gross });
export const creditNoteTotal = (n: CreditNote) => ({ net: n.net, vat: n.vat, gross: n.gross });

/** ยอดที่ลูกค้าต้องจ่ายตามใบนี้ หลังหักใบลดหนี้ที่อ้างถึงใบนี้ */
export const amountDue = (inv: Billing) =>
  invoiceTotal(inv).gross - creditNotesOf(inv.no).reduce((n, cn) => n + creditNoteTotal(cn).gross, 0);

/** ใบส่งของที่ยังไม่ได้ออกใบกำกับ — ของออกจากคลังแล้วแต่ยังไม่กลายเป็นรายได้ */
export const uninvoicedDeliveries = () => DELIVERIES.filter((d) => !invoiceOf(d.no));

/** ส่งถึงลูกค้าแล้วและยังไม่มีใบกำกับ — ออกใบกำกับได้ทันที */
export const readyToInvoice = () => uninvoicedDeliveries().filter((d) => d.status === "ส่งถึงแล้ว");

export const billingNoteTotal = (n: BillingNote) => n.invoices.reduce((s, no) => s + amountDue(invoice(no)), 0);

export type OrderState =
  | "ยกเลิก" | "รออนุมัติเครดิต" | "รอยืนยัน" | "รอจัดส่ง" | "ส่งบางส่วน" | "รอวางบิล" | "วางบิลแล้ว" | "เก็บเงินแล้ว";

/** ใบสั่งขายอยู่ตรงไหนของทางเดินเอกสาร — สถานะที่เก็บไว้ บวกกับของที่ส่งและบิลที่ออกจริง */
export function orderState(so: SalesOrder): OrderState {
  if (so.status !== "ยืนยันแล้ว") return so.status;
  const lines = openLines(so);
  if (lines.every((l) => l.shipped === 0)) return "รอจัดส่ง";
  if (lines.some((l) => l.open > 0)) return "ส่งบางส่วน";
  const invoices = invoicesOf(so.no);
  if (deliveriesOf(so.no).some((d) => !invoiceOf(d.no))) return "รอวางบิล";
  return invoices.every((b) => b.paid) ? "เก็บเงินแล้ว" : "วางบิลแล้ว";
}

export type QuoteState = QuotationStatus | "หมดอายุ";

export const quoteState = (q: Quotation): QuoteState =>
  q.status === "รอลูกค้าตอบ" && q.validUntil < TODAY ? "หมดอายุ" : q.status;

export const canEditOrder = (so: SalesOrder) => so.status !== "ยกเลิก" && deliveriesOf(so.no).length === 0;
export const canCancelOrder = canEditOrder;
export const canShip = (so: SalesOrder) => so.status === "ยืนยันแล้ว" && openLines(so).some((l) => l.open > 0);

/* ================================================================== credit */

/** ใบสั่งขายที่ผูกพันแล้ว — ใบที่รออนุมัติเครดิตยังไม่นับจนกว่าจะอนุมัติ */
const COMMITTED: OrderStatus[] = ["รอยืนยัน", "ยืนยันแล้ว"];

/** มูลค่าส่วนที่ยังไม่ได้ออกใบกำกับของใบสั่งขาย รวมภาษี */
function uninvoicedGross(so: SalesOrder) {
  const billed = invoicesOf(so.no).reduce((n, b) => n + invoiceTotal(b).gross, 0);
  return Math.max(0, linesTotal(so.lines).gross - billed);
}

/**
 * ยอดที่ลูกค้าติดค้างอยู่ตอนนี้ = ใบสั่งขายที่ผูกพันแล้วแต่ยังไม่ออกใบกำกับ
 * บวกใบกำกับที่ยังไม่เก็บเงิน (หักใบลดหนี้แล้ว). `except` ใช้ตอนตรวจใบที่กำลังแก้
 */
export function exposureOf(code: string, except?: string) {
  const open = SALES_ORDERS.filter((so) => so.customer === code && so.no !== except && COMMITTED.includes(so.status))
    .reduce((n, so) => n + uninvoicedGross(so), 0);
  const due = BILLINGS.filter((b) => !b.paid && b.customer === code).reduce((n, b) => n + amountDue(b), 0);
  return open + due;
}

export function creditCheck(code: string) {
  const c = customer(code);
  const used = exposureOf(code);
  return {
    limit: c.creditLimit, used,
    left: c.creditLimit - used,
    blocked: c.creditLimit > 0 && used > c.creditLimit,
    cashOnly: c.creditLimit === 0,
    held: SALES_ORDERS.filter((so) => so.customer === code && so.status === "รออนุมัติเครดิต")
      .reduce((n, so) => n + linesTotal(so.lines).gross, 0),
  };
}

/** ใบนี้ทำให้ยอดค้างเกินวงเงินไหม — ลูกค้าเงินสดไม่มีวงเงินให้ตรวจ */
export function creditVerdict(code: string, gross: number, except?: string) {
  const c = customer(code);
  const used = exposureOf(code, except);
  const projected = used + gross;
  return { limit: c.creditLimit, used, projected, cash: c.creditLimit === 0, over: c.creditLimit > 0 && projected > c.creditLimit };
}

export const heldOrders = () => SALES_ORDERS.filter((so) => so.status === "รออนุมัติเครดิต");

/* =============================================================== customers */

export type CustomerInput = {
  name: string;
  contact: string;
  phone: string;
  channel: string;
  taxId: string;
  branch: string;
  billingAddress: string;
  address: string;
  terms: string;
  creditLimit: number;
};

/** แก้แฟ้มลูกค้าได้ทุกช่อง ยกเว้นเงื่อนไขชำระและวงเงิน ที่ต้องปรับพร้อมเหตุผลที่ adjustCredit */
export type CustomerProfile = Omit<CustomerInput, "terms" | "creditLimit">;

function profileErrors(input: CustomerProfile, code?: string): Errors {
  const e: Errors = {};
  if (input.name.trim().length < 3) e.name = "ใส่ชื่อลูกค้าตามที่จดทะเบียน";
  if (input.contact.trim().length < 2) e.contact = "ใส่ชื่อผู้ติดต่อ";
  if (!/^0\d{1,2}-?\d{3}-?\d{3,4}$/.test(input.phone.trim())) e.phone = "รูปแบบ 02-123-4567 หรือ 081-234-5678";
  if (!(input.channel in CHANNEL_DISCOUNT)) e.channel = "เลือกช่องทางขาย";
  if (!/^\d{13}$/.test(input.taxId)) e.taxId = "เลขประจำตัวผู้เสียภาษีต้องมี 13 หลัก ไม่ต้องใส่ขีด";
  else if (CUSTOMERS.some((c) => c.taxId === input.taxId && c.code !== code)) e.taxId = "เลขนี้มีในแฟ้มลูกค้าแล้ว";
  if (input.branch !== "สำนักงานใหญ่" && !/^สาขาที่ \d{5}$/.test(input.branch)) e.branch = "เลขสาขา 5 หลัก เช่น 00001";
  if (input.billingAddress.trim().length < 15) e.billingAddress = "ใส่ที่อยู่ตามทะเบียนให้ครบ ใช้พิมพ์ลงใบกำกับภาษี";
  if (input.address.trim().length < 2) e.address = "ใส่จังหวัด";
  return e;
}

/** เงื่อนไขชำระกับวงเงินต้องไปด้วยกัน: เงินสดคือวงเงินศูนย์ เครดิตต้องมีวงเงิน */
function creditTermsErrors(terms: string, limit: number): Errors {
  const e: Errors = {};
  if (!TERMS.includes(terms)) e.terms = "เลือกเงื่อนไขชำระ";
  if (!Number.isInteger(limit) || limit < 0) e.creditLimit = "วงเงินเป็นจำนวนเต็มบาท ไม่ติดลบ";
  else if (terms === "เงินสด" && limit !== 0) e.creditLimit = "ลูกค้าเงินสดไม่มีวงเงินเครดิต";
  else if (terms !== "เงินสด" && limit === 0) e.creditLimit = "ขายเชื่อต้องกำหนดวงเงิน";
  return e;
}

export function customerErrors(input: CustomerInput, code?: string): Errors {
  return { ...profileErrors(input, code), ...creditTermsErrors(input.terms, input.creditLimit) };
}

export const customerProfileErrors = (input: CustomerProfile, code: string) => profileErrors(input, code);

const tidy = (p: CustomerProfile): CustomerProfile => ({
  name: p.name.trim(), contact: p.contact.trim(), phone: p.phone.trim(), channel: p.channel, taxId: p.taxId,
  branch: p.branch, billingAddress: p.billingAddress.trim(), address: p.address.trim(),
});

export function createCustomer(input: CustomerInput): Customer {
  assertValid(customerErrors(input));
  return commit(() => {
    const last = Math.max(...CUSTOMERS.map((c) => Number(c.code.slice(2))));
    const c: Customer = { code: `C-${last + 1}`, ...tidy(input), terms: input.terms, creditLimit: input.creditLimit };
    CUSTOMERS.push(c);
    return c;
  });
}

export function updateCustomer(code: string, input: CustomerProfile): Customer {
  const c = customer(code);
  assertValid(profileErrors(input, code));
  return commit(() => Object.assign(c, tidy(input)));
}

export type CreditInput = { limit: number; terms: string; reason: string };

export function creditErrors(code: string, input: CreditInput): Errors {
  const c = customer(code);
  const e = creditTermsErrors(input.terms, input.limit);
  if (input.limit === c.creditLimit && input.terms === c.terms) e.creditLimit = "ยังไม่ได้เปลี่ยนวงเงินหรือเงื่อนไข";
  if (input.reason.trim().length < 5) e.reason = "ใส่เหตุผลอย่างน้อย 5 ตัวอักษร ผู้ตรวจสอบย้อนดูได้";
  return e;
}

/** ปรับวงเงินและเงื่อนไขเครดิต พร้อมบันทึกว่าใครเปลี่ยนจากเท่าไรเป็นเท่าไรเพราะอะไร */
export function adjustCredit(code: string, input: CreditInput): CreditChange {
  const c = customer(code);
  assertValid(creditErrors(code, input));
  return commit(() => {
    const change: CreditChange = {
      date: TODAY, customer: code, fromLimit: c.creditLimit, toLimit: input.limit,
      fromTerms: c.terms, toTerms: input.terms, reason: input.reason.trim(),
    };
    c.creditLimit = input.limit;
    c.terms = input.terms;
    CREDIT_CHANGES.push(change);
    return change;
  });
}

/* ================================================================ pricing */

export type PriceInput = { kind: PriceKind; key: string; to: number; effective: string; reason: string };

/** ค่าที่มีผล ณ วันหนึ่ง ของเงื่อนไขหนึ่ง — ราคาเป็นบาท ส่วนลดเป็นสัดส่วน */
export function conditionValue(kind: PriceKind, key: string, date: string) {
  if (kind === "ราคาตั้ง") return listPriceOn(key, date);
  if (kind === "ส่วนลดช่องทาง") return channelDiscountOn(key, date);
  return volumeBreaksOn(date).find((b) => String(b.minQty) === key)?.discount ?? 0;
}

export function priceErrors(input: PriceInput): Errors {
  const e: Errors = {};
  const known =
    input.kind === "ราคาตั้ง" ? input.key in PRICE_LIST
      : input.kind === "ส่วนลดช่องทาง" ? input.key in CHANNEL_DISCOUNT
        : VOLUME_BREAKS.some((b) => String(b.minQty) === input.key);
  if (!known) e.key = "เลือกรายการที่จะเปลี่ยน";
  if (!isDate(input.effective)) e.effective = "ใส่วันที่มีผล";
  // ย้อนหลังไม่ได้: เอกสารที่ออกไปแล้วถือราคาตามวันของมัน
  else if (input.effective < TODAY) e.effective = "วันที่มีผลต้องไม่ก่อนวันนี้";
  if (input.kind === "ราคาตั้ง") {
    if (!Number.isInteger(input.to) || input.to <= 0) e.to = "ราคาตั้งเป็นจำนวนเต็มบาท มากกว่าศูนย์";
  } else if (!(input.to >= 0 && input.to <= 0.3)) {
    e.to = "ส่วนลด 0–30% ถ้าเกินนั้นให้ทำเป็นราคาพิเศษรายใบ";
  } else if (input.kind === "ส่วนลดตามจำนวน" && known && isDate(input.effective)) {
    // ขั้นบันไดต้องไม่สวนทาง: ซื้อมากกว่าต้องไม่ได้ลดน้อยกว่า
    const tiers = volumeBreaksOn(input.effective);
    const at = tiers.findIndex((b) => String(b.minQty) === input.key);
    const above = tiers[at - 1];
    const below = tiers[at + 1];
    if (above && input.to > above.discount) e.to = `ต้องไม่เกินขั้น ${above.minQty} หน่วยขึ้นไป (${Math.round(above.discount * 1000) / 10}%)`;
    if (below && input.to < below.discount) e.to = `ต้องไม่น้อยกว่าขั้น ${below.minQty} หน่วยขึ้นไป (${Math.round(below.discount * 1000) / 10}%)`;
  }
  if (!e.key && !e.effective && !e.to && conditionValue(input.kind, input.key, input.effective) === input.to) {
    e.to = "เท่ากับค่าที่มีผลอยู่แล้วในวันนั้น";
  }
  if (input.reason.trim().length < 5) e.reason = "ใส่เหตุผลอย่างน้อย 5 ตัวอักษร";
  return e;
}

/** ประกาศราคาหรือส่วนลดใหม่ มีผลกับเอกสารที่ลงวันที่ตั้งแต่วันมีผลเป็นต้นไป */
export function changePrice(input: PriceInput): PriceChange {
  assertValid(priceErrors(input));
  return commit(() => {
    const change: PriceChange = {
      no: nextNo("PC", TODAY, PRICE_CHANGES),
      kind: input.kind, key: input.key,
      from: conditionValue(input.kind, input.key, input.effective), to: input.to,
      effective: input.effective, reason: input.reason.trim(), recorded: TODAY,
    };
    PRICE_CHANGES.push(change);
    return change;
  });
}

/** รายการที่ประกาศไว้แล้วแต่ยังไม่ถึงวันมีผล */
export const scheduledChanges = () => PRICE_CHANGES.filter((c) => c.effective > TODAY);

/* ========================================================== orders, quotes */

export type OrderInput = {
  customer: string;
  date: string;
  shipBy: string;
  customerPo: string;
  note: string;
  lines: OrderLine[];
};

export type QuoteInput = {
  customer: string;
  date: string;
  validUntil: string;
  note: string;
  lines: OrderLine[];
};

function linesError(lines: OrderLine[]): string | undefined {
  const picked = lines.filter((l) => l.material);
  if (picked.length === 0) return "ต้องมีอย่างน้อยหนึ่งรายการ";
  if (picked.length !== lines.length) return "เลือกสินค้าให้ครบทุกบรรทัด หรือลบบรรทัดที่ว่าง";
  if (lines.some((l) => !CATALOG.some((p) => p.code === l.material))) return "มีสินค้าที่ไม่อยู่ในรายการขาย";
  if (new Set(lines.map((l) => l.material)).size !== lines.length) return "สินค้าเดียวกันซ้ำหลายบรรทัด รวมเป็นบรรทัดเดียว";
  if (lines.some((l) => !Number.isInteger(l.qty) || l.qty < 1)) return "จำนวนต้องเป็นจำนวนเต็มตั้งแต่ 1 ขึ้นไป";
  if (lines.some((l) => !Number.isInteger(l.price) || l.price <= 0)) return "ราคาต่อหน่วยเป็นจำนวนเต็มบาท มากกว่าศูนย์";
  return undefined;
}

function headerErrors(input: { customer: string; date: string }): Errors {
  const e: Errors = {};
  if (!CUSTOMERS.some((c) => c.code === input.customer)) e.customer = "เลือกลูกค้า";
  if (!isDate(input.date)) e.date = "ใส่วันที่เอกสาร";
  return e;
}

export function orderErrors(input: OrderInput): Errors {
  const e = headerErrors(input);
  if (!isDate(input.shipBy)) e.shipBy = "ใส่วันที่ลูกค้าต้องการรับของ";
  else if (isDate(input.date) && input.shipBy < input.date) e.shipBy = "กำหนดส่งต้องไม่ก่อนวันที่เอกสาร";
  const lines = linesError(input.lines);
  if (lines) e.lines = lines;
  return e;
}

export function quoteErrors(input: QuoteInput): Errors {
  const e = headerErrors(input);
  if (!isDate(input.validUntil)) e.validUntil = "ใส่วันที่ยืนราคาถึง";
  else if (isDate(input.date) && input.validUntil < input.date) e.validUntil = "ยืนราคาต้องไม่สิ้นสุดก่อนวันที่เอกสาร";
  const lines = linesError(input.lines);
  if (lines) e.lines = lines;
  return e;
}

const copyLines = (lines: OrderLine[]) => lines.map((l) => ({ material: l.material, qty: l.qty, price: l.price }));

/** ผลตรวจวงเงินของใบที่ผูกพัน: เกินวงเงินต้องรออนุมัติก่อนส่งของ */
const verdictStatus = (code: string, lines: OrderLine[], except?: string): OrderStatus =>
  creditVerdict(code, linesTotal(lines).gross, except).over ? "รออนุมัติเครดิต" : "ยืนยันแล้ว";

/**
 * บันทึกใบสั่งขาย. `confirm` คือยืนยันกับลูกค้าเลย — ตรวจวงเงินตอนนั้น เกินก็ยังบันทึกได้
 * แต่ใบจะรออนุมัติเครดิตก่อนส่งของ. ไม่ยืนยันคือเก็บเป็นร่างไว้คุยต่อ
 */
export function createSalesOrder(input: OrderInput, opts: { confirm: boolean; quotation?: string }): SalesOrder {
  assertValid(orderErrors(input));
  const q = opts.quotation ? quotation(opts.quotation) : undefined;
  if (q && quoteState(q) !== "รอลูกค้าตอบ") throw new Error(`ใบเสนอราคา ${q.no} ${quoteState(q)} แล้ว เปิดใบสั่งขายจากใบนี้ไม่ได้`);
  if (q && q.customer !== input.customer) throw new Error(`ใบเสนอราคา ${q.no} เป็นของลูกค้ารายอื่น`);
  return commit(() => {
    const lines = copyLines(input.lines);
    const so: SalesOrder = {
      no: nextNo("SO", input.date, SALES_ORDERS),
      customer: input.customer,
      date: input.date,
      lines,
      status: opts.confirm ? verdictStatus(input.customer, lines) : "รอยืนยัน",
      shipBy: input.shipBy,
      customerPo: input.customerPo.trim() || undefined,
      note: input.note.trim() || undefined,
      quotation: q?.no,
    };
    SALES_ORDERS.push(so);
    if (q) {
      q.status = "ได้ใบสั่งขาย";
      q.so = so.no;
    }
    return so;
  });
}

/** แก้ได้จนกว่าจะส่งของ. ใบที่ผูกพันแล้วตรวจวงเงินใหม่ทุกครั้งที่แก้ — การอนุมัติเดิมไม่ติดไปกับยอดใหม่ */
export function updateSalesOrder(no: string, input: OrderInput): SalesOrder {
  const so = salesOrder(no);
  if (!canEditOrder(so)) throw new Error(`ใบสั่งขาย ${no} ${so.status === "ยกเลิก" ? "ยกเลิกแล้ว" : "ส่งของแล้ว"} แก้ไขไม่ได้`);
  if (input.customer !== so.customer) throw new Error("เปลี่ยนลูกค้าในใบสั่งขายไม่ได้ ให้ยกเลิกแล้วเปิดใบใหม่");
  assertValid(orderErrors(input));
  return commit(() => {
    so.date = input.date;
    so.shipBy = input.shipBy;
    so.customerPo = input.customerPo.trim() || undefined;
    so.note = input.note.trim() || undefined;
    so.lines = copyLines(input.lines);
    if (so.status !== "รอยืนยัน") {
      so.status = verdictStatus(so.customer, so.lines, so.no);
      so.creditApproval = undefined;
    }
    return so;
  });
}

/** ยืนยันใบร่าง — ตรวจวงเงินตอนนี้ คืนสถานะที่ได้ */
export function confirmOrder(no: string): OrderStatus {
  const so = salesOrder(no);
  if (so.status !== "รอยืนยัน") throw new Error(`ใบสั่งขาย ${no} ${so.status} อยู่แล้ว`);
  return commit(() => {
    so.status = verdictStatus(so.customer, so.lines, so.no);
    return so.status;
  });
}

/** ผู้มีอำนาจอนุมัติขายเกินวงเงินเป็นรายใบ ใบนี้จึงส่งของได้ */
export function releaseOrder(no: string, note: string): SalesOrder {
  const so = salesOrder(no);
  if (so.status !== "รออนุมัติเครดิต") throw new Error(`ใบสั่งขาย ${no} ไม่ได้รออนุมัติเครดิต`);
  if (note.trim().length < 5) throw new Error("ใส่เหตุผลที่อนุมัติอย่างน้อย 5 ตัวอักษร");
  return commit(() => {
    so.status = "ยืนยันแล้ว";
    so.creditApproval = { date: TODAY, note: note.trim() };
    return so;
  });
}

/** ยกเลิกได้จนกว่าจะส่งของ ใบยังอยู่ในทะเบียนพร้อมเหตุผล เลขเอกสารจึงไม่ขาดช่วง */
export function cancelOrder(no: string, reason: string): SalesOrder {
  const so = salesOrder(no);
  if (!canCancelOrder(so)) throw new Error(`ใบสั่งขาย ${no} ${so.status === "ยกเลิก" ? "ยกเลิกไปแล้ว" : "ส่งของแล้ว ต้องรับคืนด้วยใบลดหนี้"}`);
  if (reason.trim().length < 5) throw new Error("ใส่เหตุผลการยกเลิกอย่างน้อย 5 ตัวอักษร");
  return commit(() => {
    so.status = "ยกเลิก";
    so.cancelReason = reason.trim();
    return so;
  });
}

export function createQuotation(input: QuoteInput): Quotation {
  assertValid(quoteErrors(input));
  return commit(() => {
    const q: Quotation = {
      no: nextNo("QT", input.date, QUOTATIONS),
      customer: input.customer,
      date: input.date,
      validUntil: input.validUntil,
      lines: copyLines(input.lines),
      status: "รอลูกค้าตอบ",
      note: input.note.trim() || undefined,
    };
    QUOTATIONS.push(q);
    return q;
  });
}

export function updateQuotation(no: string, input: QuoteInput): Quotation {
  const q = quotation(no);
  if (q.status !== "รอลูกค้าตอบ") throw new Error(`ใบเสนอราคา ${no} ${q.status} แล้ว แก้ไขไม่ได้`);
  if (input.customer !== q.customer) throw new Error("เปลี่ยนลูกค้าในใบเสนอราคาไม่ได้ ให้เปิดใบใหม่");
  assertValid(quoteErrors(input));
  return commit(() => {
    q.date = input.date;
    q.validUntil = input.validUntil;
    q.note = input.note.trim() || undefined;
    q.lines = copyLines(input.lines);
    return q;
  });
}

export function cancelQuotation(no: string, reason: string): Quotation {
  const q = quotation(no);
  if (q.status !== "รอลูกค้าตอบ") throw new Error(`ใบเสนอราคา ${no} ${q.status} แล้ว`);
  if (reason.trim().length < 5) throw new Error("ใส่เหตุผลอย่างน้อย 5 ตัวอักษร");
  return commit(() => {
    q.status = "ยกเลิก";
    q.cancelReason = reason.trim();
    return q;
  });
}

/* ============================================================== deliveries */

export type DeliveryInput = {
  so: string;
  date: string;
  route: string;
  carrier: string;
  lines: { material: string; qty: number }[];
};

export function deliveryErrors(input: DeliveryInput): Errors {
  const e: Errors = {};
  const so = SALES_ORDERS.find((x) => x.no === input.so);
  if (!so) {
    e.so = "เลือกใบสั่งขาย";
    return e;
  }
  if (so.status !== "ยืนยันแล้ว") e.so = `ใบสั่งขายนี้${so.status} ยังส่งของไม่ได้`;
  if (!isDate(input.date)) e.date = "ใส่วันที่ส่ง";
  else if (input.date < so.date) e.date = "วันที่ส่งต้องไม่ก่อนวันที่ใบสั่งขาย";
  if (input.route.trim().length < 2) e.route = "ใส่เส้นทางหรือจังหวัดปลายทาง";
  if (input.carrier.trim().length < 2) e.carrier = "เลือกผู้ขนส่ง";
  const open = openLines(so);
  if (input.lines.some((l) => !Number.isInteger(l.qty) || l.qty < 0)) e.lines = "จำนวนส่งเป็นจำนวนเต็ม ไม่ติดลบ";
  else if (input.lines.every((l) => l.qty === 0)) e.lines = "ต้องส่งอย่างน้อยหนึ่งรายการ";
  else {
    const over = input.lines.find((l) => l.qty > (open.find((o) => o.material === l.material)?.open ?? 0));
    // Stock is purchasing's; a delivery takes it out, so it cannot take more than is there.
    const short = input.lines.find((l) => l.qty > (FINISHED_GOODS.find((m) => m.code === l.material)?.stock ?? 0));
    if (over) e.lines = `ส่ง ${over.material} เกินจำนวนที่ค้างส่ง`;
    else if (short) e.lines = `สต็อก ${short.material} คงเหลือไม่พอส่ง`;
  }
  return e;
}

/** เปิดใบส่งของ ส่งครบหรือส่งบางส่วนก็ได้ ส่วนที่เหลือค้างส่งในใบสั่งขาย */
export function createDelivery(input: DeliveryInput): Delivery {
  assertValid(deliveryErrors(input));
  return commit(() => {
    const no = nextNo("DO", input.date, DELIVERIES);
    const lines = input.lines.filter((l) => l.qty > 0).map((l) => ({ material: l.material, qty: l.qty }));
    // The goods leave the warehouse with the delivery note: purchasing's stock
    // and its movement log are cut here, under the same number.
    issueForDelivery({ ref: no, date: input.date, lines });
    const d: Delivery = {
      no,
      so: input.so,
      date: input.date,
      route: input.route.trim(),
      carrier: input.carrier.trim(),
      status: "กำลังจัดส่ง",
      lines,
    };
    DELIVERIES.push(d);
    return d;
  });
}

export function deliveredErrors(no: string, input: { date: string; receivedBy: string }): Errors {
  const d = delivery(no);
  const e: Errors = {};
  if (!isDate(input.date)) e.date = "ใส่วันที่ส่งถึง";
  else if (input.date < d.date) e.date = "วันที่ส่งถึงต้องไม่ก่อนวันที่ออกใบส่งของ";
  if (input.receivedBy.trim().length < 2) e.receivedBy = "ใส่ชื่อผู้รับของตามที่เซ็นในใบส่งของ";
  return e;
}

export function markDelivered(no: string, input: { date: string; receivedBy: string }): Delivery {
  const d = delivery(no);
  if (d.status !== "กำลังจัดส่ง") throw new Error(`ใบส่งของ ${no} ส่งถึงแล้ว`);
  assertValid(deliveredErrors(no, input));
  return commit(() => {
    d.status = "ส่งถึงแล้ว";
    d.deliveredOn = input.date;
    d.receivedBy = input.receivedBy.trim();
    return d;
  });
}

/* ================================================================ invoices */

export function invoiceErrors(deliveryNo: string, date: string): Errors {
  const e: Errors = {};
  const d = DELIVERIES.find((x) => x.no === deliveryNo);
  if (!d) e.delivery = "เลือกใบส่งของ";
  else if (invoiceOf(d.no)) e.delivery = `ใบส่งของนี้ออกใบกำกับ ${invoiceOf(d.no)!.no} ไปแล้ว`;
  else if (d.status !== "ส่งถึงแล้ว") e.delivery = "ของยังไม่ถึงลูกค้า ยืนยันส่งถึงก่อนออกใบกำกับ";
  if (!isDate(date)) e.date = "ใส่วันที่ใบกำกับ";
  else if (d && date < d.date) e.date = "วันที่ใบกำกับต้องไม่ก่อนวันที่ส่งของ";
  return e;
}

/** ออกใบกำกับภาษี/ใบแจ้งหนี้จากใบส่งของ ครบกำหนดชำระตามเงื่อนไขของลูกค้า ณ วันออก */
export function issueInvoice(deliveryNo: string, date: string): Billing {
  assertValid(invoiceErrors(deliveryNo, date));
  const d = delivery(deliveryNo);
  const so = salesOrder(d.so);
  const c = customer(so.customer);
  const total = linesTotal(d.lines.map((l) => ({ ...l, price: so.lines.find((x) => x.material === l.material)!.price })));
  return commit(() => {
    const inv: Billing = {
      no: nextNo("IV", date, BILLINGS),
      so: d.so,
      customer: c.code,
      date,
      paid: false,
      delivery: d.no,
      due: addDays(date, termDays(c.terms)),
      ...total,
    };
    BILLINGS.push(inv);
    return inv;
  });
}

export type PaymentInput = { date: string; method: string; ref: string; /** ภาษีที่ลูกค้าหัก ณ ที่จ่าย — ศูนย์ถ้าไม่หัก */ wht: number };

/** ภาษีหัก ณ ที่จ่ายที่ลูกค้าหักได้ตามปกติ: 3% ของยอดก่อนภาษี (ค่าบริการ) ปัดถึงสตางค์ */
export const suggestedWht = (inv: Billing) => Math.round(inv.net * 3) / 100;

export function paymentErrors(invoiceNo: string, input: PaymentInput): Errors {
  const inv = invoice(invoiceNo);
  const e: Errors = {};
  if (!isDate(input.date)) e.date = "ใส่วันที่รับเงิน";
  else if (input.date < inv.date) e.date = "วันที่รับเงินต้องไม่ก่อนวันที่ใบกำกับ";
  if (!PAY_METHODS.includes(input.method)) e.method = "เลือกวิธีรับชำระ";
  else if (input.method !== "เงินสด" && input.ref.trim().length < 3) e.ref = "ใส่เลขที่เช็คหรือเลขอ้างอิงการโอน";
  // หักได้ไม่เกิน 5% ของยอดก่อนภาษี — อัตราสูงสุดของผู้รับที่เป็นนิติบุคคล (ค่าเช่า)
  if (!(input.wht >= 0) || Math.abs(Math.round(input.wht * 100) - input.wht * 100) > 1e-6) e.wht = "ภาษีหัก ณ ที่จ่ายเป็นบาทและสตางค์ ไม่ติดลบ";
  else if (input.wht > Math.round(inv.net * 5) / 100) e.wht = "หักเกิน 5% ของยอดก่อนภาษี ตรวจหนังสือรับรองการหักภาษีอีกครั้ง";
  return e;
}

const receiptNumbers = () => [...BILLINGS.flatMap((b) => (b.receipt ? [b.receipt] : [])), ...VOIDED_RECEIPTS];

/**
 * รับชำระเต็มยอดคงค้างของใบ (หลังหักใบลดหนี้) ออกใบเสร็จเลขถัดไป และคืนวงเงินให้ลูกค้า.
 * ลูกค้าหักภาษี ณ ที่จ่ายไว้เท่าไร เงินที่รับจริงก็น้อยลงเท่านั้น แต่ใบนี้ถือว่าชำระครบ.
 * รับเป็นงวดไม่ได้ — ใบหนึ่งมีใบเสร็จใบเดียว
 */
export function recordPayment(invoiceNo: string, input: PaymentInput): Receipt {
  const inv = invoice(invoiceNo);
  if (inv.paid) throw new Error(`ใบกำกับ ${invoiceNo} รับชำระไปแล้ว`);
  assertValid(paymentErrors(invoiceNo, input));
  return commit(() => {
    const receipt: Receipt = {
      no: nextNo("RE", input.date, receiptNumbers()),
      date: input.date,
      method: input.method,
      ref: input.ref.trim(),
      amount: Math.round((amountDue(inv) - input.wht) * 100) / 100,
      wht: input.wht,
    };
    inv.receipt = receipt;
    inv.paid = true;
    return receipt;
  });
}

/** ยกเลิกใบเสร็จ (เช็คเด้ง บันทึกผิดใบ) — ใบกำกับกลับเป็นค้างชำระและกินวงเงินอีกครั้ง */
export function cancelPayment(invoiceNo: string, reason: string): VoidedReceipt {
  const inv = invoice(invoiceNo);
  const r = inv.receipt;
  if (!inv.paid || !r) throw new Error(`ใบกำกับ ${invoiceNo} ยังไม่ได้รับชำระ`);
  if (reason.trim().length < 5) throw new Error("ใส่เหตุผลการยกเลิกใบเสร็จอย่างน้อย 5 ตัวอักษร");
  return commit(() => {
    const voided: VoidedReceipt = { ...r, invoice: inv.no, voidedOn: TODAY, reason: reason.trim() };
    VOIDED_RECEIPTS.push(voided);
    inv.paid = false;
    inv.receipt = undefined;
    return voided;
  });
}

export type CreditNoteInput = { invoice: string; date: string; kind: CreditNoteKind; reason: string; lines: OrderLine[] };

/** ลดได้ไม่เกินที่ขายไปในใบนั้น — ต่อบรรทัดและทั้งใบ รวมใบลดหนี้ที่เคยออกไปแล้ว */
export function creditNoteErrors(input: CreditNoteInput): Errors {
  const e: Errors = {};
  const inv = BILLINGS.find((b) => b.no === input.invoice);
  if (!inv) {
    e.invoice = "เลือกใบกำกับภาษีที่จะลดหนี้";
    return e;
  }
  if (!isDate(input.date)) e.date = "ใส่วันที่ใบลดหนี้";
  else if (input.date < inv.date) e.date = "วันที่ใบลดหนี้ต้องไม่ก่อนวันที่ใบกำกับเดิม";
  if (input.reason.trim().length < 5) e.reason = "ใส่เหตุที่ลดหนี้ ใบลดหนี้ต้องระบุเหตุผลเสมอ";
  const sold = invoiceLines(inv);
  const before = creditNotesOf(inv.no).flatMap((n) => n.lines);
  const used = input.lines.filter((l) => l.qty > 0);
  if (used.length === 0) e.lines = "ต้องลดอย่างน้อยหนึ่งรายการ";
  else if (used.some((l) => !Number.isInteger(l.qty) || !Number.isInteger(l.price) || l.price <= 0)) e.lines = "จำนวนและจำนวนเงินเป็นจำนวนเต็ม มากกว่าศูนย์";
  else {
    for (const l of used) {
      const s = sold.find((x) => x.material === l.material);
      if (!s) e.lines = `${l.material} ไม่อยู่ในใบกำกับ ${inv.no}`;
      else if (input.kind === "รับคืนสินค้า" && l.price !== s.price) e.lines = "รับคืนสินค้าใช้ราคาเดิมในใบกำกับ";
      else if (l.price > s.price) e.lines = "ลดต่อหน่วยได้ไม่เกินราคาที่ขาย";
      else if (input.kind === "รับคืนสินค้า" && l.qty + before.filter((b) => b.material === l.material).reduce((n, b) => n + b.qty, 0) > s.qty)
        e.lines = "รับคืนเกินจำนวนที่ขาย (รวมที่เคยรับคืนแล้ว)";
      else if (l.qty > s.qty) e.lines = "จำนวนเกินที่ขายในใบกำกับ";
      else if (l.qty * l.price + before.filter((b) => b.material === l.material).reduce((n, b) => n + b.qty * b.price, 0) > s.qty * s.price)
        e.lines = "ลดเกินมูลค่าที่ขายของรายการนี้ (รวมใบลดหนี้เดิม)";
    }
  }
  return e;
}

export function createCreditNote(input: CreditNoteInput): CreditNote {
  assertValid(creditNoteErrors(input));
  const inv = invoice(input.invoice);
  const lines = input.lines.filter((l) => l.qty > 0).map((l) => ({ material: l.material, qty: l.qty, price: l.price }));
  return commit(() => {
    const n: CreditNote = {
      no: nextNo("CN", input.date, CREDIT_NOTES),
      invoice: inv.no,
      so: inv.so,
      customer: inv.customer,
      date: input.date,
      kind: input.kind,
      reason: input.reason.trim(),
      lines,
      ...linesTotal(lines),
    };
    CREDIT_NOTES.push(n);
    return n;
  });
}

export type BillingNoteInput = { customer: string; date: string; payOn: string; invoices: string[] };

/** ใบที่ยังวางบิลได้: ของลูกค้ารายนั้น ยังไม่เก็บเงิน และยังไม่อยู่ในใบวางบิลใบอื่น */
export const billableInvoices = (code: string) =>
  BILLINGS.filter((b) => !b.paid && !billingNoteOf(b.no) && b.customer === code);

export function billingNoteErrors(input: BillingNoteInput): Errors {
  const e: Errors = {};
  if (!CUSTOMERS.some((c) => c.code === input.customer)) e.customer = "เลือกลูกค้า";
  if (!isDate(input.date)) e.date = "ใส่วันที่วางบิล";
  if (!isDate(input.payOn)) e.payOn = "ใส่วันนัดชำระ";
  else if (isDate(input.date) && input.payOn < input.date) e.payOn = "วันนัดชำระต้องไม่ก่อนวันวางบิล";
  if (input.invoices.length === 0) e.invoices = "เลือกใบกำกับที่จะวางบิลอย่างน้อยหนึ่งใบ";
  else if (!e.customer) {
    const open = billableInvoices(input.customer).map((b) => b.no);
    if (input.invoices.some((no) => !open.includes(no))) e.invoices = "มีใบที่เก็บเงินแล้ว อยู่ในใบวางบิลอื่น หรือเป็นของลูกค้ารายอื่น";
  }
  return e;
}

export function createBillingNote(input: BillingNoteInput): BillingNote {
  assertValid(billingNoteErrors(input));
  return commit(() => {
    const n: BillingNote = {
      no: nextNo("BN", input.date, BILLING_NOTES),
      customer: input.customer,
      date: input.date,
      payOn: input.payOn,
      invoices: [...input.invoices],
    };
    BILLING_NOTES.push(n);
    return n;
  });
}
