import { describe, expect, it } from "vitest";
import {
  COST_ESTIMATES, NEXT_PERIOD, actualOf, addCostCenter, assignChannel, closeInternalOrder, companyResult,
  costCenterRows, internalOrder, ioBalance, marginRows, markEstimate, postIoCost, profitCenterRows, raiseIoBudget,
  reconcile, releaseEstimate, runCycle, runEstimate, setBudget, settleInternalOrder,
} from "../../demo/modules/co/data";

const centresTotal = () => profitCenterRows().reduce((n, p) => n + p.result, 0);
const overheadTotal = () => costCenterRows().reduce((n, c) => n + c.actual, 0);

/**
 * Management accounting's buttons, through the functions they call. The cases
 * share the demo's records and run in order; expected figures come from the
 * rule — an allocation empties its sender, a settlement empties its order, the
 * profit centres add up to the ledger's profit — not from calling the code twice.
 */
describe("management accounting actions", () => {
  it("takes revenue from invoices less credit notes, as the ledger does", () => {
    // IV-2569-0908 438,630 + IV-2569-0911 34,629 − CN-2569-0012 12,660
    expect(marginRows().reduce((n, m) => n + m.revenue, 0)).toBe(460599);
  });

  it("ties the profit centres out to the ledger's profit", () => {
    expect(Math.abs(centresTotal() - companyResult())).toBeLessThanOrEqual(1);
    expect(reconcile().tiesOut).toBe(true);
  });

  it("empties the sender of an allocation cycle into its receivers", () => {
    const before = overheadTotal();
    const admin = actualOf("CC-ADM");
    const prod = actualOf("CC-PROD");
    const posting = runCycle("CY-01");
    expect(posting.amount).toBeCloseTo(admin, 6);
    expect(actualOf("CC-ADM")).toBeCloseTo(0, 6);
    // ฝ่ายผลิตรับ 50% ของยอดฝ่ายบริหาร
    expect(actualOf("CC-PROD")).toBeCloseTo(prod + admin * 0.5, 1);
    // ย้ายยอดระหว่างศูนย์ ไม่สร้างหรือทำหาย
    expect(Math.abs(overheadTotal() - before)).toBeLessThanOrEqual(2);
    expect(reconcile().tiesOut).toBe(true);
    expect(() => runCycle("CY-01")).toThrow(/ไม่มียอด/);
  });

  it("refuses a cost that would overrun an internal order's budget", () => {
    // IO-7002 ใช้ไป 194,500 จากงบ 180,000 อยู่แล้ว
    expect(() => postIoCost("IO-7002", { date: "2026-09-24", text: "ค่าขนส่งบูธกลับ", vendor: "ขนส่ง", amount: 8000 })).toThrow(/เกินงบ/);
    raiseIoBudget("IO-7002", 210000, "อนุมัติเพิ่มตามบันทึกผู้บริหาร");
    postIoCost("IO-7002", { date: "2026-09-24", text: "ค่าขนส่งบูธกลับ", vendor: "ขนส่ง", amount: 8000 });
    expect(internalOrder("IO-7002").spent).toBe(202500);
  });

  it("empties an internal order when it is settled, then lets it close", () => {
    const order = internalOrder("IO-7004");
    const admin = actualOf("CC-ADM");
    expect(() => closeInternalOrder("IO-7004")).toThrow(/ยังมียอดค้าง/);
    const s = settleInternalOrder("IO-7004", { receiverType: "ศูนย์ต้นทุน", receiver: "CC-ADM" });
    expect(s.amount).toBe(22000);
    expect(ioBalance(order)).toBe(0);
    expect(actualOf("CC-ADM")).toBeCloseTo(admin + 22000, 6);
    // ต้นทุนนี้บันทึกเฉพาะฝั่งบัญชีบริหาร การกระทบยอดต้องแยกให้เห็นเท่ากับที่ชำระ
    const r = reconcile();
    expect(r.coOnly).toBe(22000);
    expect(r.company - r.centres).toBeCloseTo(22000, 0);
    closeInternalOrder("IO-7004");
    expect(order.status).toBe("ปิดงานแล้ว");
  });

  it("releases a marked cost estimate as next period's standard", () => {
    const e = runEstimate("FG-5001", { materialCost: 7100, labourCost: 1250, note: "เหล็กขึ้นราคา" });
    expect(() => releaseEstimate(e.no)).toThrow(/กำหนดใช้/);
    markEstimate(e.no);
    releaseEstimate(e.no);
    expect(e.status).toBe("ปล่อยใช้แล้ว");
    expect(e.validFrom).toBe(NEXT_PERIOD);
    expect(NEXT_PERIOD).toBe("2026-10-01");
    // ปล่อยใบใหม่แทนที่ใบที่ปล่อยไว้สำหรับงวดเดียวกัน
    const again = runEstimate("FG-5001", { materialCost: 7050, labourCost: 1250, note: "" });
    markEstimate(again.no);
    releaseEstimate(again.no);
    expect(COST_ESTIMATES.find((x) => x.no === e.no)!.status).toBe("ถูกแทนที่");
  });

  it("moves a channel's revenue to the profit centre it is assigned to", () => {
    const shop = marginRows().filter((m) => m.channel === "ขายหน้าร้าน").reduce((n, m) => n + m.revenue, 0);
    const mfg = profitCenterRows().find((p) => p.code === "PC-MFG")!.revenue;
    const total = centresTotal();
    assignChannel("ขายหน้าร้าน", "PC-MFG");
    expect(profitCenterRows().find((p) => p.code === "PC-MFG")!.revenue).toBe(mfg + shop);
    expect(centresTotal()).toBeCloseTo(total, 6);
  });

  it("adds a cost centre and sets its budget with a reason", () => {
    addCostCenter({ code: "CC-QC", name: "ฝ่ายควบคุมคุณภาพ", profitCenter: "PC-MFG", budget: 40000, owner: "หัวหน้า QC" });
    setBudget("CC-QC", 45000, "เพิ่มงบสอบเทียบเครื่องมือ");
    expect(costCenterRows().find((c) => c.code === "CC-QC")!.budget).toBe(45000);
    expect(() => addCostCenter({ code: "CC-QC", name: "ซ้ำ", profitCenter: "PC-MFG", budget: 0, owner: "ใคร" })).toThrow(/มีศูนย์ต้นทุน/);
  });
});
