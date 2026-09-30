import { describe, expect, it } from "vitest";
import { liveAgenda } from "../../demo/modules/ims/data";
import {
  MACHINES, breakdownErrors, completeRepair, machineByCode, oee, pmDue, pmErrors, pmOverdue, planByCode, recordPm, recordShots,
  reliability, repairErrors, reportBreakdown, requestByNo, requestSpare, sparesBelow, startRepair, addSpare,
} from "../../demo/modules/tpm/data";
import { MATERIALS, REQUISITIONS, STOCK_MOVES } from "../../demo/modules/mm/data";

/**
 * การบำรุงรักษาเชิงป้องกันแบบทั่วถึง (TPM) — OEE จากการยืนยันงานจริงของฝ่ายผลิต
 * อะไหล่เบิกจากคลังวัสดุจริง ค่าที่คาดหวังคิดจากข้อมูลตั้งต้น ไม่ได้คิดแบบเดียวกับโค้ด
 */

const stock = (code: string) => MATERIALS.find((m) => m.code === code)!.stock;

describe("overall equipment effectiveness (IATF 8.5.1.5)", () => {
  it("measures a work centre from production's own confirmations", () => {
    // ตัดและขึ้นรูป 14 วัน: หยุด 6 ชม. จาก 80 → ความพร้อม 92.5%
    // ชั่วโมงมาตรฐาน 0.6×30 + 0.8×18 + 0.6×40 = 56.4 จากชั่วโมงจริง 19 + 15 + 25 = 59 → 95.6%
    // ของดีทุกชิ้น → คุณภาพ 100% · OEE 92.5 × 95.6 × 100 ≈ 88.4%
    expect(oee("WC-CUT")).toMatchObject({ availability: 92.5, performance: 95.6, quality: 100, oee: 88.4 });
    // เชื่อม: ใบสั่ง PO-P-3299 เสีย 2 จาก 18 ที่ขั้นตอนเชื่อม
    expect(oee("WC-WELD").quality).toBe(97.6);
    // เครื่องปั๊มยังไม่มีงานผลิตจริง จึงยังไม่มี OEE
    expect(oee("WC-PRESS").oee).toBeUndefined();
  });

  it("reports mean time between failures and to repair", () => {
    // ปั๊มลมเสียครั้งเดียว 4 ชั่วโมงใน 90 วัน (1,440 ชม.) → MTBF 1,436 · MTTR 4
    expect(reliability("M-AC-01")).toEqual({ failures: 1, downtime: 4, mttr: 4, mtbf: 1436 });
  });
});

describe("preventive maintenance", () => {
  it("counts a die by strokes, not by days", () => {
    expect(pmDue(planByCode("PM-DIE-01"))).toMatchObject({ pct: 92, late: false, soon: true });
    expect(() => recordShots("DIE-BK220", 40000)).toThrow("ไม่น้อยกว่าเดิม");
    recordShots("DIE-BK220", 50120);
    expect(pmDue(planByCode("PM-DIE-01")).late).toBe(true);
    recordPm("PM-DIE-01", { by: "ประสิทธิ์ ขยันยิ่ง", checked: [true, true, true, true], findings: "", date: "2026-09-22" });
    expect(pmDue(planByCode("PM-DIE-01"))).toMatchObject({ pct: 0, late: false });
  });

  it("knows which plan is overdue and needs findings for a failed check", () => {
    expect(pmOverdue().map((p) => p.code)).toEqual(["PM-LS-01"]);
    expect(pmErrors("PM-LS-01", { by: "ประสิทธิ์ ขยันยิ่ง", checked: [true, false, true], findings: "", date: "2026-09-22" }).findings).toBeDefined();
    recordPm("PM-LS-01", { by: "ประสิทธิ์ ขยันยิ่ง", checked: [true, false, true], findings: "หัวฉีดก๊าซสึก สั่งหัวใหม่แล้ว เปลี่ยนสัปดาห์หน้า", date: "2026-09-22" });
    expect(pmOverdue()).toEqual([]);
  });
});

describe("breakdowns", () => {
  it("keeps one open request per machine and takes spare parts out of the store", () => {
    expect(breakdownErrors({ machine: "M-OV-01", symptom: "เสียงดัง", reportedBy: "มานพ รุ่งเรือง" }).machine).toContain("ค้างอยู่แล้ว");
    const r = reportBreakdown({ machine: "M-PR-01", symptom: "น้ำมันไฮดรอลิกรั่วที่กระบอกสูบ", reportedBy: "อนุชา ทองดี" });
    expect(r.no).toBe("WR-2569-032");
    expect(machineByCode("M-PR-01").status).toBe("รอซ่อม");
    startRepair(r.no, "ประสิทธิ์ ขยันยิ่ง");
    expect(repairErrors(r.no, { cause: "ซีลกระบอกสูบเสื่อม", fix: "เปลี่ยนซีล", hours: 3, parts: [{ material: "MAT-2001", qty: 99 }] }).parts).toContain("เหลือ");
    const before = stock("MAT-2001");
    completeRepair(r.no, { cause: "ซีลกระบอกสูบเสื่อม", fix: "เปลี่ยนซีลและขันน็อตยึดใหม่", hours: 3, parts: [{ material: "MAT-2001", qty: 2 }] });
    expect(stock("MAT-2001")).toBe(before - 2);
    const doc = requestByNo(r.no).parts[0].doc!;
    expect(STOCK_MOVES.find((m) => m.doc === doc)).toMatchObject({ material: "MAT-2001", qty: -2, department: "ฝ่ายซ่อมบำรุง" });
    expect(MACHINES.find((m) => m.code === "M-PR-01")!.status).toBe("ใช้งาน");
    expect(oee("WC-PRESS").availability).toBe(96.3); // หยุด 3 จาก 80 ชั่วโมง
  });
});

describe("critical spares", () => {
  it("raises a purchase requisition in purchasing when a spare runs below its minimum", () => {
    // น็อต M8 ต่ำกว่าขั้นต่ำแล้ว แต่ฝ่ายผลิตขอซื้อไว้ใน PR-2569-041 — ไม่เปิดซ้ำ
    expect(sparesBelow().map((s) => s.material)).toEqual(["MAT-2001"]);
    expect(() => requestSpare("MAT-2001")).toThrow("PR-2569-041");
    // ตลับลูกปืนวิกฤตทั้งปั๊มลม (10) และเครื่องปั๊ม (400) → ขั้นต่ำรวม 410 คงเหลือ 320 → เติมถึง 820 = 500 ตัว
    addSpare({ material: "MAT-2002", machine: "M-PR-01", min: 400 });
    const pr = requestSpare("MAT-2002");
    expect(pr).toMatchObject({ no: "PR-2569-045", requester: "ฝ่ายซ่อมบำรุง", status: "รออนุมัติ", lines: [{ material: "MAT-2002", qty: 500 }] });
    expect(REQUISITIONS).toContain(pr);
  });

  it("feeds the management review", () => {
    expect(liveAgenda().map((a) => a.key)).toContain("tpm-equipment");
  });
});
