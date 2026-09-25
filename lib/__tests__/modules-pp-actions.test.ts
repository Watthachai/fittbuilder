import { describe, expect, it } from "vitest";
import { material } from "../../demo/modules/mm/data";
import {
  BUCKETS, CONFIRMATIONS, ORDERS, PLANNED_ORDERS, PURCHASE_PROPOSALS, cancelOrder, completeOrder,
  confirmOperation, costOf, createOrder, issueComponents, loadOf, moveOperation, orderByNo, planFinished,
  progressOf, receiveOutput, releaseOrder, requirement, runMrp, runMrpPlanning, updateBomLine,
} from "../../demo/modules/pp/data";

/**
 * Production planning's buttons, through the functions they call.
 *
 * The cases run in order against the one set of demo records, the way a planner
 * would click through them: plan, release, issue, confirm, receive, close. Every
 * expected figure is worked out from the rule a planner states — BOM × quantity,
 * less stock, less what is already coming — not by calling the code twice.
 */
describe("production planning actions", () => {
  it("keeps each seeded order's output equal to what its last operation confirmed", () => {
    for (const o of ORDERS) {
      const last = o.operations[o.operations.length - 1];
      expect(o.done, o.no).toBe(CONFIRMATIONS.filter((c) => c.order === o.no && c.op === last.op).reduce((n, c) => n + c.yield, 0));
    }
  });

  it("plans only the demand that stock and open orders cannot cover", () => {
    // ชั้นวาง: สต็อก 34 + ใบ PO-P-3301 ยังจะส่งได้อีก 40 − 28 = 12 → 46
    // DM-0041 ต้องการ 40 เหลือ 6 · DM-0045 ต้องการ 60 จึงขาด 54
    const shelf = planFinished().find((c) => c.demand.no === "DM-0045")!;
    expect(shelf.covered).toBe(6);
    expect(shelf.short).toBe(54);
  });

  it("proposes buying exactly the component shortfall", () => {
    // เหล็กเส้น: PO-P-3303 ยังไม่เบิก 12 × 8 = 96 · ผลิตเพิ่มชั้นวาง 54 × 6 = 324 · โต๊ะ 18 × 4 = 72
    // ต้องใช้ 492 มีในคลัง 86 ไม่มีของค้างรับ → ขาด 406
    const rod = runMrp().find((r) => r.code === "MAT-1002")!;
    expect(rod.required).toBe(492);
    expect(rod.shortage).toBe(406);

    const run = runMrpPlanning();
    expect(run.planned.map((p) => [p.product, p.qty])).toEqual([
      ["FG-5001", 54],
      ["FG-5002", 18],
    ]);
    expect(run.proposals.map((p) => [p.material, p.qty])).toEqual([["MAT-1002", 406]]);
    // รันซ้ำแทนที่ของเดิมที่ยังไม่ใช้ ไม่ซ้อนเพิ่ม
    expect(PLANNED_ORDERS.filter((p) => p.status === "ตามแผน")).toHaveLength(2);
    expect(PURCHASE_PROPOSALS.filter((p) => p.status === "เสนอซื้อ")).toHaveLength(1);
  });

  it("adds component scrap to the explosion", () => {
    expect(requirement(2, 54, 5)).toBe(114); // 2 × 54 × 1.05 = 113.4 ปัดขึ้น
    updateBomLine("FG-5001", "MAT-1001", { qty: 2, scrap: 5 });
    // เหล็กแผ่น: PO-P-3303 12 + ชั้นวาง 114 + โต๊ะ 3 × 18 = 54
    expect(runMrp().find((r) => r.code === "MAT-1001")!.required).toBe(180);
    updateBomLine("FG-5001", "MAT-1001", { qty: 2, scrap: 0 });
  });

  it("refuses to release an order whose components are short", () => {
    // รถเข็น 12 คันต้องใช้เหล็กเส้น 96 แต่มี 86 และมอเตอร์ 12 แต่มี 6
    expect(() => releaseOrder("PO-P-3303")).toThrow(/วัสดุไม่พอ/);
    expect(orderByNo("PO-P-3303").status).toBe("วางแผนไว้");
  });

  it("releases, issues against warehouse stock, confirms, receives and closes an order", () => {
    const o = createOrder({ product: "FG-5001", qty: 10, start: "2026-09-28", due: "2026-10-09" });
    expect(o.no).toBe("PO-P-3304");
    expect(o.status).toBe("วางแผนไว้");

    releaseOrder(o.no);
    expect(o.status).toBe("ปล่อยงานแล้ว");

    issueComponents(o.no, o.components.map((c) => ({ material: c.material, qty: c.qty })));
    // เหล็กเส้น 10 × 6 = 60 ออกจากคลังวัสดุจริง
    expect(material("MAT-1002").stock).toBe(86 - 60);

    confirmOperation(o.no, { op: "0010", yield: 10, scrap: 0, hrs: 6.5, note: "" });
    expect(o.status).toBe("กำลังผลิต");
    confirmOperation(o.no, { op: "0020", yield: 9, scrap: 1, hrs: 12, note: "แนวเชื่อมไม่ผ่าน" });
    expect(() => confirmOperation(o.no, { op: "0020", yield: 1, scrap: 0, hrs: 1, note: "" })).toThrow(/ไม่เกิน 0/);
    confirmOperation(o.no, { op: "0030", yield: 9, scrap: 0, hrs: 4.5, note: "" });
    confirmOperation(o.no, { op: "0040", yield: 9, scrap: 0, hrs: 3.6, note: "" });
    expect(o.status).toBe("ผลิตครบแล้ว");
    expect(o.done).toBe(9);
    expect(progressOf(o, "0020").scrap).toBe(1);

    expect(() => completeOrder(o.no)).toThrow(/รับสินค้าเข้าคลัง/);
    receiveOutput(o.no, 9);
    expect(material("FG-5001").stock).toBe(34 + 9);

    // วัสดุ 20 × 1,850 + 60 × 420 + 5 × 380 + 2 × 2,400 = 68,900
    // ค่าแรง 6.5 × 420 + 12 × 520 + 4.5 × 380 + 3.6 × 350 = 11,940
    // มาตรฐาน 9 × 7,976 = 71,784 → ผลต่าง 80,840 − 71,784 = 9,056
    const c = costOf(o);
    expect(c.material).toBe(68900);
    expect(c.labour).toBeCloseTo(11940, 6);
    expect(c.standard).toBe(71784);
    expect(c.variance).toBeCloseTo(9056, 6);

    completeOrder(o.no);
    expect(o.status).toBe("ปิดงานแล้ว");
  });

  it("levels an overloaded work centre by moving an operation to its alternative", () => {
    const bucket = BUCKETS[1];
    // รอบ 5–18 ต.ค.: โต๊ะ 25 × 1.5 + รถเข็น 12 × 2.0 = 61.5 ชม. เกินกำลัง 48
    expect(loadOf("WC-WELD", bucket)).toBeCloseTo(61.5, 6);
    expect(() => moveOperation("PO-P-3302", "0020", "WC-PAINT")).toThrow();
    moveOperation("PO-P-3302", "0020", "WC-WELD2");
    expect(loadOf("WC-WELD", bucket)).toBeCloseTo(24, 6);
    expect(loadOf("WC-WELD2", bucket)).toBeCloseTo(37.5, 6);
  });

  it("cancels only orders that have not started", () => {
    expect(() => cancelOrder("PO-P-3301", "เปลี่ยนแผน")).toThrow(/ยกเลิกไม่ได้/);
    cancelOrder("PO-P-3303", "เปลี่ยนแผนการผลิต");
    expect(orderByNo("PO-P-3303").status).toBe("ยกเลิก");
  });
});
