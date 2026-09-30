import { describe, expect, it } from "vitest";
import { CAPAS, liveAgenda } from "../../demo/modules/ims/data";
import {
  CONTINGENCIES, DEVICES, closeSupplierAudit, coverage, implementCsr, missingChecks, rating, recordScorecard, recordTrace, restoreDevice,
  safetyChecks, supplierAuditErrors, testContingency, testDue, verifyDevice, verifyErrors, certified,
} from "../../demo/modules/iatf/data";

/**
 * ข้อกำหนดเพิ่มเติมของ IATF 16949 — ทุกข้อตัดสินจากข้อมูลของระบบอื่น
 * ค่าที่คาดหวังคิดจากข้อกำหนดและข้อมูลตั้งต้น เทสต์รันตามลำดับบนข้อมูลชุดเดียวกัน
 */

describe("customer-specific requirements (4.3.2)", () => {
  it("counts a requirement covered only when a live controlled document carries it", () => {
    expect(coverage("C-106")).toEqual({ done: 5, total: 8 });
    // WI-03 ยังรออนุมัติในทะเบียนกลาง อ้างเป็นหลักฐานไม่ได้
    expect(() => implementCsr(7, "WI-03")).toThrow("ยังไม่ได้ใช้งาน");
    implementCsr(7, "SP-09");
    expect(coverage("C-106")).toEqual({ done: 6, total: 8 });
  });
});

describe("product safety (4.4.1.2)", () => {
  it("holds a safety part until the customer approves its PPAP", () => {
    const failing = safetyChecks("FG-5004").filter((c) => !c.ok).map((c) => c.item);
    expect(failing).toEqual(["ลูกค้าอนุมัติ PPAP"]);
  });

  it("fails a traceability drill that takes longer than the customer allows", () => {
    recordTrace({ part: "FG-5004", lot: "LOT-BK-260921", tracedTo: "MAT-1004 heat H24-7790 · กะบ่าย 21/09 · ต้องค้นใบรับของที่เป็นกระดาษ", minutes: 300, date: "2026-09-22", by: "ธนพล เจริญผล" });
    expect(safetyChecks("FG-5004").find((c) => c.item.startsWith("ทดสอบสอบกลับ"))).toMatchObject({ ok: false, why: "TRC-2569-02 ใช้ 300 นาที" });
  });
});

describe("contingency plans (6.1.2.3)", () => {
  it("requires a yearly test that passed", () => {
    // BCP-02 และ BCP-04 ยังไม่เคยทดสอบ BCP-03 ทดสอบแล้วต้องปรับปรุง
    expect(CONTINGENCIES.filter(testDue).map((c) => c.code)).toEqual(["BCP-02", "BCP-03", "BCP-04"]);
    testContingency("BCP-02", { result: "ผ่าน", note: "ตัดไฟหลัก 30 นาที เครื่องกำเนิดไฟฟ้ารับโหลดปั๊มลมใน 40 วินาที", by: "ประสิทธิ์ ขยันยิ่ง", date: "2026-09-22" });
    expect(CONTINGENCIES.filter(testDue).map((c) => c.code)).toEqual(["BCP-03", "BCP-04"]);
  });
});

describe("second-party supplier audits (8.4.2.4.1, 7.2.4)", () => {
  it("admits only auditors trained in VDA 6.3 and core tools", () => {
    expect(supplierAuditErrors({ vendor: "V-003", planned: "2026-11-05", auditor: "ปิยะนุช ใจดี" }).auditor).toContain("VDA 6.3");
    expect(supplierAuditErrors({ vendor: "V-002", planned: "2026-11-05", auditor: "ธนพล เจริญผล" }).vendor).toContain("ค้างอยู่แล้ว");
    expect(certified("V-004")).toBe(false);
  });

  it("opens an 8D for supplier development when the score is grade C", () => {
    const { audit, car } = closeSupplierAudit("SA-2569-02", { score: 72, findings: "ไม่มีการควบคุมขนาดเหล็กเส้นระหว่างรีด ของไม่ได้ขนาดหลุดมาถึงเรา" });
    expect(audit.status).toBe("ปิดแล้ว");
    expect(car).toMatchObject({ method: "8D", std: "IATF 16949", ref: "SA-2569-02" });
  });
});

describe("customer scorecard (9.1.2.1)", () => {
  it("grades the customer's own figures", () => {
    expect(rating({ ppm: 0, delivery: 100, disruptions: 0 })).toBe("เขียว");
    expect(rating({ ppm: 0, delivery: 96, disruptions: 0 })).toBe("เหลือง");
    expect(rating({ ppm: 180, delivery: 99, disruptions: 0 })).toBe("แดง");
  });

  it("answers a red month with an 8D", () => {
    const before = CAPAS.length;
    const { rating: r, car } = recordScorecard({ month: "2026-09", customer: "C-106", ppm: 220, delivery: 97, premiumFreight: 0, disruptions: 1 });
    expect(r).toBe("แดง");
    expect(car).toMatchObject({ method: "8D", ref: "SC C-106 2026-09" });
    expect(CAPAS).toHaveLength(before + 1);
  });
});

describe("error-proofing (10.2.4)", () => {
  it("lists every shift today whose device has not been challenged", () => {
    expect(missingChecks()).toEqual([
      { device: "PY-01", shift: "บ่าย" },
      { device: "PY-02", shift: "เช้า" },
      { device: "PY-02", shift: "บ่าย" },
    ]);
    expect(verifyErrors("PY-01", { shift: "เช้า", ok: true, by: "อนุชา ทองดี", note: "" }).shift).toContain("ทวนสอบแล้ว");
  });

  it("stops a device that misses the master part and keeps it stopped until its CAR closes", () => {
    const { car } = verifyDevice("PY-02", { shift: "เช้า", ok: false, by: "อนุชา ทองดี", note: "เซนเซอร์ไม่ตรวจจับแผ่นซ้อน กักชิ้นงานตั้งแต่กะก่อน 1,200 ชิ้น" });
    expect(DEVICES.find((d) => d.code === "PY-02")!.status).toBe("หยุดใช้");
    expect(car?.ref).toBe("PY-02 2026-09-22 เช้า");
    expect(() => restoreDevice("PY-02")).toThrow(car!.no);
    expect(missingChecks().map((m) => m.device)).toEqual(["PY-01"]);
  });

  it("feeds the management review", () => {
    expect(liveAgenda().map((a) => a.key)).toEqual(expect.arrayContaining(["iatf-customer", "iatf-risk"]));
  });
});
