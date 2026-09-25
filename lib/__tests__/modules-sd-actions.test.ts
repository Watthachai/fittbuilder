import { describe, expect, it } from "vitest";
import {
  BILLINGS, BILLING_NOTES, CREDIT_CHANGES, CUSTOMERS, DELIVERIES, QUOTATIONS, SALES_ORDERS, activeOrders, adjustCredit,
  amountDue, canShip, cancelOrder, changePrice, confirmOrder, createBillingNote, createCreditNote, createCustomer,
  createDelivery, createQuotation, createSalesOrder, creditCheck, customerErrors, deliveryErrors, exposureOf,
  heldOrders, invoiceErrors, invoiceTotal, invoicesOf, issueInvoice, markDelivered, openLines, orderErrors,
  orderState, orderTotal, priceErrors, quotation, recordPayment, releaseOrder, rulePrice, salesOrder,
  uninvoicedDeliveries, updateSalesOrder, cancelPayment, VOIDED_RECEIPTS, paymentErrors,
} from "../../demo/modules/sd/data";
import type { OrderInput } from "../../demo/modules/sd/data";

/**
 * The sales flow a Thai SME keys every day: quotation → sales order → delivery →
 * tax invoice → billing note → receipt, with the credit check in the middle.
 *
 * Every expected figure is worked from the business rule by hand — list price,
 * channel discount, volume break, 7% VAT rounded to the baht per document —
 * never recomputed the way the code does it. The tests share one set of records
 * and run in order, like a day of keying.
 */

const order = (customer: string, lines: OrderInput["lines"], extra: Partial<OrderInput> = {}): OrderInput => ({
  customer, date: "2026-09-22", shipBy: "2026-09-29", customerPo: "", note: "", lines, ...extra,
});

describe("the records other modules already read", () => {
  it("keep their totals — the ledger posts these figures", () => {
    // SO-0412: ตัวแทนจำหน่าย 8%, 30 ชั้นวาง (−5%) and 10 โต๊ะ (−1%)
    expect(orderTotal(salesOrder("SO-2569-0412"))).toMatchObject({ net: 438630, vat: 30704, gross: 469334 });
    expect(orderTotal(salesOrder("SO-2569-0413")).gross).toBe(120125);
    expect(orderTotal(salesOrder("SO-2569-0414")).gross).toBe(230829);
    expect(orderTotal(salesOrder("SO-2569-0415")).gross).toBe(37053);
    expect(orderTotal(salesOrder("SO-2569-0416")).gross).toBe(301689);
  });

  it("price a line by list price, then channel discount, then volume break", () => {
    expect(rulePrice("FG-5001", 30, "ตัวแทนจำหน่าย", "2026-09-22").net).toBe(10401); // 11,900 × 0.92 × 0.95
    expect(rulePrice("FG-5001", 4, "ขายตรง", "2026-09-22").net).toBe(11900);
    expect(rulePrice("FG-5001", 10, "ขายตรง", "2026-09-22").net).toBe(11781); // −1% from 5 units
  });
});

describe("keying a sales order", () => {
  it("refuses an order that cannot be saved, and says which field", () => {
    const e = orderErrors(order("", [{ material: "FG-5001", qty: 2, price: 11900 }, { material: "FG-5001", qty: 1, price: 11900 }], { shipBy: "2026-09-01" }));
    expect(Object.keys(e).sort()).toEqual(["customer", "lines", "shipBy"]);
    expect(orderErrors(order("C-103", [])).lines).toBeDefined();
    expect(() => createSalesOrder(order("C-103", [{ material: "FG-5001", qty: 0, price: 11900 }]), { confirm: true })).toThrow();
  });

  it("saves with the next number, the rule price and 7% VAT, and confirms within the limit", () => {
    const before = SALES_ORDERS.length;
    const so = createSalesOrder(order("C-103", [{ material: "FG-5001", qty: 10, price: 11781 }]), { confirm: true });
    expect(so.no).toBe("SO-2569-0417");
    expect(SALES_ORDERS).toHaveLength(before + 1);
    expect(SALES_ORDERS.at(-1)).toBe(so);
    // 10 × 11,781 = 117,810 · VAT 8,246.70 → 8,247 · 126,057
    expect(orderTotal(so)).toMatchObject({ net: 117810, vat: 8247, gross: 126057 });
    // C-103: 230,829 already owed + 126,057 = 356,886 ≤ 400,000
    expect(so.status).toBe("ยืนยันแล้ว");
    expect(orderState(so)).toBe("รอจัดส่ง");
    expect(exposureOf("C-103")).toBe(356886);
  });

  it("re-checks credit when an order is edited, and will not change its customer", () => {
    // 20 units → −3%: 11,543 × 20 = 230,860 · VAT 16,160 · 247,020; 230,829 + 247,020 > 400,000
    const up = updateSalesOrder("SO-2569-0417", order("C-103", [{ material: "FG-5001", qty: 20, price: 11543 }]));
    expect(up.status).toBe("รออนุมัติเครดิต");
    const back = updateSalesOrder("SO-2569-0417", order("C-103", [{ material: "FG-5001", qty: 10, price: 11781 }]));
    expect(back.status).toBe("ยืนยันแล้ว");
    expect(() => updateSalesOrder("SO-2569-0417", order("C-101", [{ material: "FG-5001", qty: 10, price: 11781 }]))).toThrow();
  });

  it("holds an order that takes the customer over the limit until someone approves it", () => {
    // 3 รถเข็น × 18,900 = 56,700 · VAT 3,969 · 60,669; 356,886 + 60,669 = 417,555 > 400,000
    const so = createSalesOrder(order("C-103", [{ material: "FG-5003", qty: 3, price: 18900 }]), { confirm: true });
    expect(so.no).toBe("SO-2569-0418");
    expect(so.status).toBe("รออนุมัติเครดิต");
    expect(heldOrders()).toContain(so);
    expect(canShip(so)).toBe(false);
    expect(creditCheck("C-103").held).toBe(60669);
    expect(exposureOf("C-103")).toBe(356886); // a held order is not yet owed
    expect(() => releaseOrder(so.no, "ok")).toThrow(); // needs a reason
    releaseOrder(so.no, "ลูกค้าโอนมัดจำครึ่งหนึ่งแล้ว");
    expect(so.status).toBe("ยืนยันแล้ว");
    expect(so.creditApproval?.note).toBe("ลูกค้าโอนมัดจำครึ่งหนึ่งแล้ว");
    expect(exposureOf("C-103")).toBe(417555);
  });

  it("keeps a draft until it is confirmed, then checks credit", () => {
    const so = createSalesOrder(order("C-101", [{ material: "FG-5002", qty: 2, price: 13900 }]), { confirm: false });
    expect(so.status).toBe("รอยืนยัน");
    expect(canShip(so)).toBe(false);
    expect(confirmOrder(so.no)).toBe("ยืนยันแล้ว"); // 120,125 + 29,746 ≤ 800,000
    expect(() => confirmOrder(so.no)).toThrow();
  });
});

describe("delivery → tax invoice → credit note → receipt", () => {
  it("ships part of an order and keeps the rest outstanding", () => {
    expect(deliveryErrors({ so: "SO-2569-0417", date: "2026-09-22", route: "กรุงเทพฯ", carrier: "รถของบริษัท", lines: [{ material: "FG-5001", qty: 11 }] }).lines).toBeDefined();
    const d = createDelivery({ so: "SO-2569-0417", date: "2026-09-22", route: "กรุงเทพฯ", carrier: "รถของบริษัท", lines: [{ material: "FG-5001", qty: 4 }] });
    expect(d.no).toBe("DO-2569-0304");
    expect(d.status).toBe("กำลังจัดส่ง");
    expect(openLines(salesOrder("SO-2569-0417"))[0]).toMatchObject({ ordered: 10, shipped: 4, open: 6 });
    expect(orderState(salesOrder("SO-2569-0417"))).toBe("ส่งบางส่วน");
    // shipped goods cannot be cancelled away — they come back on a credit note
    expect(() => cancelOrder("SO-2569-0417", "ลูกค้าเปลี่ยนใจ")).toThrow();
    expect(() => updateSalesOrder("SO-2569-0417", order("C-103", [{ material: "FG-5001", qty: 10, price: 11781 }]))).toThrow();
  });

  it("will not invoice goods still on the road", () => {
    expect(invoiceErrors("DO-2569-0304", "2026-09-22").delivery).toBeDefined();
    expect(() => issueInvoice("DO-2569-0304", "2026-09-22")).toThrow();
  });

  it("issues the tax invoice with the next number and a due date from the credit term", () => {
    markDelivered("DO-2569-0304", { date: "2026-09-22", receivedBy: "คุณพิมพ์" });
    expect(uninvoicedDeliveries().map((d) => d.no)).toContain("DO-2569-0304");
    const owedBefore = exposureOf("C-103");
    const inv = issueInvoice("DO-2569-0304", "2026-09-22");
    expect(inv.no).toBe("IV-2569-0912");
    expect(inv.due).toBe("2026-10-22"); // เครดิต 30 วัน
    // 4 × 11,781 = 47,124 · VAT 3,298.68 → 3,299 · 50,423
    expect(invoiceTotal(inv)).toMatchObject({ net: 47124, vat: 3299, gross: 50423 });
    // it leaves the unbilled list and is where the ledger reads receivables
    expect(uninvoicedDeliveries().map((d) => d.no)).not.toContain("DO-2569-0304");
    expect(BILLINGS).toContain(inv);
    expect(invoicesOf("SO-2569-0417")).toEqual([inv]);
    // moving value from "ordered" to "invoiced" does not change what the customer owes
    expect(exposureOf("C-103")).toBe(owedBefore);
    expect(() => issueInvoice("DO-2569-0304", "2026-09-22")).toThrow();
  });

  it("credits a return against the invoice, never more than was sold", () => {
    expect(() =>
      createCreditNote({ invoice: "IV-2569-0912", date: "2026-09-22", kind: "รับคืนสินค้า", reason: "คืน", lines: [{ material: "FG-5001", qty: 1, price: 11781 }] })
    ).toThrow(); // reason too short
    const cn = createCreditNote({
      invoice: "IV-2569-0912", date: "2026-09-22", kind: "รับคืนสินค้า", reason: "ชั้นวางบุบจากการขนส่ง 1 ชุด",
      lines: [{ material: "FG-5001", qty: 1, price: 11781 }],
    });
    expect(cn.no).toBe("CN-2569-0013");
    // 11,781 · VAT 824.67 → 825 · 12,606; 50,423 − 12,606 = 37,817
    expect(amountDue(BILLINGS.find((b) => b.no === "IV-2569-0912")!)).toBe(37817);
    expect(() =>
      createCreditNote({ invoice: "IV-2569-0912", date: "2026-09-22", kind: "รับคืนสินค้า", reason: "รับคืนเพิ่มอีกสี่ชุด", lines: [{ material: "FG-5001", qty: 4, price: 11781 }] })
    ).toThrow(); // 1 + 4 > 4 sold
  });

  it("groups a customer's open invoices on one billing note", () => {
    const bn = createBillingNote({ customer: "C-103", date: "2026-09-22", payOn: "2026-09-30", invoices: ["IV-2569-0912"] });
    expect(bn.no).toBe("BN-2569-0032");
    expect(BILLING_NOTES).toContain(bn);
    expect(() => createBillingNote({ customer: "C-103", date: "2026-09-22", payOn: "2026-09-30", invoices: ["IV-2569-0912"] })).toThrow();
    expect(() => createBillingNote({ customer: "C-103", date: "2026-09-22", payOn: "2026-09-30", invoices: ["IV-2569-0911"] })).toThrow(); // another customer's
  });

  it("receives the amount due, issues a receipt and frees the credit", () => {
    const owed = exposureOf("C-103");
    const r = recordPayment("IV-2569-0912", { date: "2026-09-30", method: "โอนเงิน", ref: "ธ.กรุงเทพ 3009-5521", wht: 0 });
    expect(r.no).toBe("RE-2569-0147");
    expect(r.amount).toBe(37817);
    expect(BILLINGS.find((b) => b.no === "IV-2569-0912")!.paid).toBe(true);
    expect(exposureOf("C-103")).toBe(owed - 37817);
    expect(() => recordPayment("IV-2569-0912", { date: "2026-09-30", method: "เงินสด", ref: "", wht: 0 })).toThrow();
  });

  it("voids a receipt with a reason, puts the invoice back on the customer, and never reuses the number", () => {
    const owed = exposureOf("C-103");
    expect(() => cancelPayment("IV-2569-0912", "")).toThrow();
    const v = cancelPayment("IV-2569-0912", "เช็คคืน ธนาคารปฏิเสธการจ่าย");
    expect(v).toMatchObject({ no: "RE-2569-0147", invoice: "IV-2569-0912", reason: "เช็คคืน ธนาคารปฏิเสธการจ่าย" });
    expect(VOIDED_RECEIPTS).toContain(v);
    const inv = BILLINGS.find((b) => b.no === "IV-2569-0912")!;
    expect(inv.paid).toBe(false);
    expect(inv.receipt).toBeUndefined();
    expect(exposureOf("C-103")).toBe(owed + 37817);
  });

  it("takes a payment net of the customer's withholding tax as settled in full", () => {
    // 3% of the pre-VAT value still owed (47,124 − 11,781 = 35,343) = 1,060.29
    expect(paymentErrors("IV-2569-0912", { date: "2026-09-30", method: "เงินสด", ref: "", wht: 5000 }).wht).toBeDefined();
    const r = recordPayment("IV-2569-0912", { date: "2026-09-30", method: "เช็ค", ref: "กรุงเทพ 0012345", wht: 1060.29 });
    expect(r.no).toBe("RE-2569-0148");
    expect(r.amount).toBe(36756.71); // 37,817 − 1,060.29
    expect(r.amount + r.wht).toBe(37817);
    expect(BILLINGS.find((b) => b.no === "IV-2569-0912")!.paid).toBe(true);
  });
});

describe("cancelling", () => {
  it("keeps the cancelled order for the numbering but stops counting it", () => {
    expect(() => cancelOrder("SO-2569-0418", "")).toThrow();
    const owed = exposureOf("C-103");
    cancelOrder("SO-2569-0418", "ลูกค้าขอเลื่อนไปไตรมาสหน้า");
    const so = salesOrder("SO-2569-0418");
    expect(so.status).toBe("ยกเลิก");
    expect(SALES_ORDERS).toContain(so);
    expect(activeOrders()).not.toContain(so);
    expect(exposureOf("C-103")).toBe(owed - 60669);
    expect(() => cancelOrder("SO-2569-0418", "ยกเลิกซ้ำอีกครั้ง")).toThrow();
  });
});

describe("price changes", () => {
  it("take effect from their date and leave keyed documents alone", () => {
    const keyed = salesOrder("SO-2569-0417").lines[0].price;
    changePrice({ kind: "ราคาตั้ง", key: "FG-5001", to: 12500, effective: "2026-10-01", reason: "ต้นทุนเหล็กปรับขึ้น" });
    expect(rulePrice("FG-5001", 1, "ขายตรง", "2026-09-30").net).toBe(11900);
    expect(rulePrice("FG-5001", 1, "ขายตรง", "2026-10-01").net).toBe(12500);
    expect(salesOrder("SO-2569-0417").lines[0].price).toBe(keyed);
  });

  it("refuse a backdated change and a volume ladder that runs backwards", () => {
    expect(priceErrors({ kind: "ราคาตั้ง", key: "FG-5002", to: 14500, effective: "2026-09-01", reason: "ปรับราคาย้อนหลัง" }).effective).toBeDefined();
    // 15 units cannot earn more than 30 units (5%)
    expect(priceErrors({ kind: "ส่วนลดตามจำนวน", key: "15", to: 0.06, effective: "2026-10-01", reason: "โปรโมชั่นปลายปี" }).to).toBeDefined();
  });
});

describe("customers and credit", () => {
  it("adds a customer with the next code, and refuses a duplicate tax id or a cash customer with a limit", () => {
    const base = {
      name: "บจก. ตัวอย่างการค้า", contact: "คุณสมศรี", phone: "02-555-1234", channel: "ขายตรง", taxId: "0105567000111",
      branch: "สำนักงานใหญ่", billingAddress: "10 ถนนสาทร แขวงยานนาวา เขตสาทร กรุงเทพมหานคร 10120", address: "กรุงเทพฯ",
      terms: "เครดิต 30 วัน", creditLimit: 250000,
    };
    expect(customerErrors({ ...base, taxId: CUSTOMERS[0].taxId }).taxId).toBeDefined();
    expect(customerErrors({ ...base, terms: "เงินสด" }).creditLimit).toBeDefined();
    const c = createCustomer(base);
    expect(c.code).toBe("C-106");
    expect(CUSTOMERS).toContain(c);
  });

  it("logs every limit change with its reason", () => {
    expect(() => adjustCredit("C-101", { limit: 900000, terms: "เครดิต 30 วัน", reason: "" })).toThrow();
    const log = adjustCredit("C-101", { limit: 900000, terms: "เครดิต 30 วัน", reason: "ยอดซื้อเพิ่มตามฤดูกาล" });
    expect(log).toMatchObject({ customer: "C-101", fromLimit: 800000, toLimit: 900000 });
    expect(CREDIT_CHANGES.at(-1)).toBe(log);
    expect(creditCheck("C-101").limit).toBe(900000);
  });
});

describe("quotation → sales order", () => {
  it("turns an accepted quotation into an order at the quoted price, once", () => {
    const q = createQuotation({ customer: "C-105", date: "2026-09-22", validUntil: "2026-10-22", note: "", lines: [{ material: "FG-5002", qty: 5, price: 12000 }] });
    expect(q.no).toBe("QT-2569-0233");
    expect(QUOTATIONS).toContain(q);
    const so = createSalesOrder(order("C-105", q.lines), { confirm: true, quotation: q.no });
    expect(so.quotation).toBe(q.no);
    expect(quotation(q.no)).toMatchObject({ status: "ได้ใบสั่งขาย", so: so.no });
    // a special price keeps what was agreed, not the rule: 5 × 12,000 = 60,000 · VAT 4,200
    expect(orderTotal(so)).toMatchObject({ net: 60000, vat: 4200, gross: 64200 });
    expect(orderTotal(so).lines[0].special).toBe(true);
    expect(() => createSalesOrder(order("C-105", q.lines), { confirm: true, quotation: q.no })).toThrow();
  });

  it("has every new document in the arrays other modules read", () => {
    expect(DELIVERIES.some((d) => d.no === "DO-2569-0304")).toBe(true);
    expect(SALES_ORDERS.map((so) => so.no)).toEqual(expect.arrayContaining(["SO-2569-0417", "SO-2569-0418", "SO-2569-0419", "SO-2569-0420"]));
  });
});

describe("a delivery and purchasing's stock", () => {
  it("takes the goods out of stock under the delivery number, and refuses more than is there", async () => {
    const { MATERIALS, STOCK_MOVES } = await import("../../demo/modules/mm/data");
    const shelf = MATERIALS.find((m) => m.code === "FG-5001")!;
    const so = createSalesOrder(order("C-101", [{ material: "FG-5001", qty: 3, price: 11900 }]), { confirm: true });
    const before = shelf.stock;

    const d = createDelivery({ so: so.no, date: "2026-09-23", route: "กรุงเทพฯ", carrier: "รถของบริษัท", lines: [{ material: "FG-5001", qty: 3 }] });

    expect(shelf.stock).toBe(before - 3);
    expect(STOCK_MOVES.filter((m) => m.doc === d.no).map((m) => m.qty)).toEqual([-3]);

    const big = createSalesOrder(order("C-101", [{ material: "FG-5001", qty: shelf.stock + 1, price: 1 }]), { confirm: true });
    expect(deliveryErrors({ so: big.no, date: "2026-09-23", route: "กรุงเทพฯ", carrier: "รถของบริษัท", lines: [{ material: "FG-5001", qty: shelf.stock + 1 }] }).lines)
      .toContain("คงเหลือไม่พอส่ง");
  });
});
