import { describe, expect, it } from "vitest";
import {
  FINISHED_GOODS, INVOICES, MATERIALS, PURCHASE_ORDERS, REQUISITIONS, STOCK_MOVES, TODAY, addMaterial,
  approveRequisition, blockVendor, canRelease, convertRequisition, createRequisition, issueForDelivery, material, onOrderQty,
  orderProblems, outstandingQty, postGoodsReceipt, postStockMove, purchaseOrder, recordInvoice, recordVendorReview,
  rejectRequisition, releaseInvoice, reorderPlan, requisitionFromReorder, reverseDeliveryIssue, reviewScore,
  sendPurchaseOrder, unblockVendor,
} from "../../demo/modules/mm/data";

/**
 * The purchasing moves a prospect keys in front of us: a requisition, its
 * approval, the order it becomes, the goods that arrive short, the bill that
 * arrives in full. Expected figures are worked out from the business rule by
 * hand — the approval limits, VAT-exclusive values, a 1% / 1,000-baht match
 * tolerance — not recomputed the way the code computes them.
 *
 * The records are module state shared by the whole file, so each test works on
 * orders and materials the others leave alone.
 */

describe("requisition to purchase order", () => {
  it("goes to the approver its value needs, then becomes the next purchase order number", () => {
    // 40 sheets × 1,850 = 74,000 baht: over the 50,000 head of purchasing, within the 200,000 manager.
    const pr = createRequisition({
      requester: "ฝ่ายผลิต",
      needBy: "2026-10-10",
      note: "",
      lines: [{ material: "MAT-1001", qty: 40, price: 1850 }],
    });
    expect(pr.no).toBe("PR-2569-045");
    expect(pr.status).toBe("รออนุมัติ");
    expect(REQUISITIONS).toContain(pr);

    expect(() => approveRequisition(pr.no, "สุรชัย แสงทอง")).toThrow(/วงเงิน/);
    expect(pr.status).toBe("รออนุมัติ");

    approveRequisition(pr.no, "วรรณา ศรีสวัสดิ์");
    expect(pr.status).toBe("อนุมัติแล้ว");

    const po = convertRequisition(pr.no, {
      vendor: "V-001",
      date: TODAY,
      deliverBy: "2026-09-29",
      note: "",
      lines: [{ material: "MAT-1001", qty: 40, price: 1850 }],
    });
    expect(po.no).toBe("PO-2569-122");
    expect(po.status).toBe("ร่าง");
    expect(po.pr).toBe(pr.no);
    expect(pr.status).toBe("แปลงเป็นใบสั่งซื้อแล้ว");
    expect(pr.po).toBe("PO-2569-122");
    expect(PURCHASE_ORDERS).toContain(po);
    expect(() => convertRequisition(pr.no, { vendor: "V-001", date: TODAY, deliverBy: TODAY, note: "", lines: po.lines })).toThrow();

    // The order needs a signature within the same limits before it goes out.
    expect(() => sendPurchaseOrder(po.no, "สุรชัย แสงทอง")).toThrow(/วงเงิน/);
    sendPurchaseOrder(po.no, "วรรณา ศรีสวัสดิ์");
    expect(po.status).toBe("รอรับของ");
  });

  it("keeps a rejected requisition out of purchasing", () => {
    const pr = createRequisition({ requester: "ฝ่ายคลัง", needBy: "2026-10-20", note: "", lines: [{ material: "MAT-3001", qty: 100, price: 35 }] });
    expect(() => rejectRequisition(pr.no, "")).toThrow();
    rejectRequisition(pr.no, "ของในคลังยังพอใช้ถึงสิ้นเดือน");
    expect(pr.status).toBe("ไม่อนุมัติ");
    expect(() => approveRequisition(pr.no, "ประเสริฐ วงศ์ใหญ่")).toThrow();
  });

  it("refuses an order to a blocked vendor", () => {
    blockVendor("V-002", "ส่งของไม่ครบติดกันสองงวด");
    const problems = orderProblems({ vendor: "V-002", date: TODAY, deliverBy: "2026-10-01", note: "", lines: [{ material: "MAT-2001", qty: 10, price: 380 }] });
    expect(problems.vendor).toMatch(/ระงับ/);
    unblockVendor("V-002");
  });
});

describe("goods receipt and the three-way match", () => {
  it("leaves a partly received order open with what is still owed", () => {
    // PO-2569-120 ordered 100 bearings and 4 motors; 60 bearings and all 4 motors arrive.
    const po = purchaseOrder("PO-2569-120");
    const gr = postGoodsReceipt({
      po: po.no,
      date: TODAY,
      deliveryNote: "DN-5501",
      receivedBy: "ณัฐพล ทองดี",
      lines: [
        { material: "MAT-2002", qty: 60 },
        { material: "MAT-4001", qty: 4 },
      ],
    });
    expect(gr.no).toBe("GR-2569-208");
    expect(po.status).toBe("รับของบางส่วน");
    expect(outstandingQty(po, "MAT-2002")).toBe(40);
    expect(outstandingQty(po, "MAT-4001")).toBe(0);
    expect(material("MAT-2002").stock).toBe(320 + 60);
    expect(material("MAT-4001").stock).toBe(6 + 4);
    expect(STOCK_MOVES.filter((m) => m.doc === "GR-2569-208").map((m) => m.qty)).toEqual([60, 4]);

    // More than is owed cannot be received against the order.
    expect(() =>
      postGoodsReceipt({ po: po.no, date: TODAY, deliveryNote: "DN-5502", receivedBy: "ณัฐพล ทองดี", lines: [{ material: "MAT-2002", qty: 41 }] })
    ).toThrow(/ค้างรับ/);
  });

  it("blocks an invoice for more than was received, and releases it once the rest arrives", () => {
    // Received so far on PO-2569-120: 60 × 145 + 4 × 5,600 = 31,100. The vendor bills the full 36,900.
    const inv = recordInvoice({ no: "INV-90001", po: "PO-2569-120", date: TODAY, amount: 36900 });
    expect(inv.blocked).toBe(true);
    expect(inv.paid).toBe(false);
    expect(inv.vendor).toBe("V-004");
    expect(INVOICES).toContain(inv);
    expect(canRelease(inv)).toBe(false);
    expect(() => releaseInvoice(inv.no)).toThrow();
    expect(() => recordInvoice({ no: "INV-90001", po: "PO-2569-120", date: TODAY, amount: 1 })).toThrow(/ตั้งหนี้ซ้ำ/);

    // The remaining 40 bearings arrive: received becomes 36,900 and the bill matches.
    postGoodsReceipt({ po: "PO-2569-120", date: TODAY, deliveryNote: "DN-5503", receivedBy: "ณัฐพล ทองดี", lines: [{ material: "MAT-2002", qty: 40 }] });
    expect(purchaseOrder("PO-2569-120").status).toBe("รับของครบแล้ว");
    expect(canRelease(inv)).toBe(true);
    releaseInvoice(inv.no);
    expect(inv.blocked).toBe(false);
    expect(inv.paid).toBe(false);
  });

  it("lets a bill through when it differs from the receipt by less than the tolerance", () => {
    // PO-2569-121: 40 boxes × 380 = 15,200 received; 1% is 152, so a bill of 15,300 (100 over) passes.
    postGoodsReceipt({ po: "PO-2569-121", date: TODAY, deliveryNote: "DN-7701", receivedBy: "ณัฐพล ทองดี", lines: [{ material: "MAT-2001", qty: 40 }] });
    const within = recordInvoice({ no: "INV-90002", po: "PO-2569-121", date: TODAY, amount: 15300 });
    expect(within.blocked).toBe(false);
  });
});

describe("stock", () => {
  it("never issues more than is on hand", () => {
    // MAT-4001 now holds 10 after the receipt above.
    expect(() => postStockMove({ kind: "เบิกใช้", material: "MAT-4001", qty: 11, department: "ฝ่ายซ่อมบำรุง", reason: "เปลี่ยนมอเตอร์สายพาน", date: TODAY })).toThrow(/ติดลบ/);
    const move = postStockMove({ kind: "เบิกใช้", material: "MAT-4001", qty: 3, department: "ฝ่ายซ่อมบำรุง", reason: "เปลี่ยนมอเตอร์สายพาน", date: TODAY });
    expect(move.doc).toBe("IS-2569-001");
    expect(move.qty).toBe(-3);
    expect(material("MAT-4001").stock).toBe(7);
  });

  it("suggests ordering up to twice the reorder point, net of what is already coming, in one click", () => {
    // MAT-1002: 86 on hand, reorder point 150, nothing on order → order 2 × 150 − 86 = 214.
    const before = reorderPlan().find((p) => p.m.code === "MAT-1002")!;
    expect(before.qty).toBe(214);
    // MAT-2001 was 18 against a point of 40; the 40 received above make it 58, so it is off the list.
    expect(reorderPlan().find((p) => p.m.code === "MAT-2001")).toBeUndefined();

    const pr = requisitionFromReorder(["MAT-1002"]);
    expect(pr.status).toBe("รออนุมัติ");
    expect(pr.lines).toEqual([{ material: "MAT-1002", qty: 214, price: 420 }]);
    expect(onOrderQty("MAT-1002")).toBe(214);
    expect(reorderPlan().find((p) => p.m.code === "MAT-1002")!.qty).toBe(0);
  });
});

describe("master data", () => {
  it("adds a finished good to the list sales and production read, not a copy of it", () => {
    const fg = addMaterial({ name: "ตู้เก็บเอกสารเหล็ก 4 ลิ้นชัก", group: "สินค้าสำเร็จรูป", unit: "ตัว", price: 6500, reorder: 8, safety: 4, bin: "E-02-05" });
    expect(fg.code).toBe("FG-5004");
    expect(fg.stock).toBe(0);
    expect(MATERIALS).toContain(fg);
    expect(FINISHED_GOODS).toContain(fg);
  });

  it("grades a vendor review from four 1–5 scores and refuses a second review for the same period", () => {
    // (4 + 3 + 5 + 3) / 4 = 3.75 → 75 out of 100 → grade B.
    const r = recordVendorReview({ vendor: "V-002", period: "ไตรมาส 3/2569", quality: 4, delivery: 3, price: 5, service: 3, note: "", by: "วรรณา ศรีสวัสดิ์" });
    expect(r.no).toBe("VE-2569-005");
    expect(reviewScore(r)).toBe(75);
    expect(() =>
      recordVendorReview({ vendor: "V-002", period: "ไตรมาส 3/2569", quality: 5, delivery: 5, price: 5, service: 5, note: "", by: "วรรณา ศรีสวัสดิ์" })
    ).toThrow(/ประเมิน/);
  });
});

describe("goods issued for a sales delivery", () => {
  it("takes every line off stock or none, and puts it back when the delivery is reversed", () => {
    // FG-5001 holds 34, FG-5002 holds 12. Asking for 13 of FG-5002 must leave FG-5001 untouched too.
    expect(() =>
      issueForDelivery({ ref: "DO-2569-0410", date: TODAY, lines: [{ material: "FG-5001", qty: 4 }, { material: "FG-5002", qty: 13 }] })
    ).toThrow(/ไม่พอ/);
    expect(material("FG-5001").stock).toBe(34);

    const moves = issueForDelivery({ ref: "DO-2569-0410", date: TODAY, lines: [{ material: "FG-5001", qty: 4 }, { material: "FG-5002", qty: 2 }] });
    expect(moves.map((m) => [m.material, m.qty, m.doc])).toEqual([["FG-5001", -4, "DO-2569-0410"], ["FG-5002", -2, "DO-2569-0410"]]);
    expect(material("FG-5001").stock).toBe(30);
    expect(material("FG-5002").stock).toBe(10);
    expect(() => issueForDelivery({ ref: "DO-2569-0410", date: TODAY, lines: [{ material: "FG-5001", qty: 1 }] })).toThrow(/ตัดสต็อกไปแล้ว/);

    reverseDeliveryIssue("DO-2569-0410");
    expect(material("FG-5001").stock).toBe(34);
    expect(material("FG-5002").stock).toBe(12);
    expect(() => reverseDeliveryIssue("DO-2569-0410")).toThrow();
  });
});
