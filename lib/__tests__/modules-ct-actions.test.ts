import { describe, expect, it } from "vitest";
import { QMR, liveAgenda } from "../../demo/modules/ims/data";
import {
  CONTROL_PLANS, PROJECTS, actionPriority, addCpRow, addFmeaRow, addSubgroup, addSubgroups, capable, chartByCode,
  completeFmeaAction, cpRowErrors, currentPhase, elementStatus, fmeaByNo, grr, isDone, missingSpecials, openHigh, passGate,
  pendingElements, planOfPhase, promoteToProduction, recordDecision, recordStudy, releasedForProduction, restartChart, setElement,
  stats, studyByNo, submissionOf, submitPpap, gateErrors,
} from "../../demo/modules/ct/data";

/**
 * เครื่องมือหลักยานยนต์ — ทดสอบการเปิดตัวชิ้นส่วนใหม่ตั้งแต่ติดที่ MSA จนผ่านประตู APQP
 * ค่าที่คาดหวังคิดจากคู่มือ AIAG-VDA และ AIAG MSA ไม่ได้คิดแบบเดียวกับโค้ด
 */

const part = "FG-5004";
const ppap = () => submissionOf(part)!;

/** ผลวัดเกจบอร์: 10 ชิ้นห่างกัน 0.004 มม. ผู้วัดและครั้งที่วัดต่างกันไม่เกิน ±0.0005 */
const boreRows = [0, 1, 2]
  .flatMap((a) => [0, 1, 2].map((t) => Array.from({ length: 10 }, (_, i) => (10.54 + i * 0.004 + (((a + t + i) % 3) - 1) * 0.0005).toFixed(4)).join(" ")))
  .join("\n");

/** 25 กลุ่มย่อยหลังเปลี่ยนเครื่องมือวัด — กระจายรอบ 10.553 ไม่เกิน ±0.005 */
const tightGroups = Array.from({ length: 25 }, (_, g) => {
  const base = 10.553 + ((g % 5) - 2) * 0.001;
  return [-0.003, -0.001, 0, 0.001, 0.003].map((d) => (base + d).toFixed(4)).join(" ");
}).join("\n");

describe("FMEA action priority (AIAG-VDA)", () => {
  it("ranks by severity first instead of multiplying into an RPN", () => {
    expect(actionPriority(9, 4, 2)).toBe("สูง"); // ความปลอดภัย เกิดได้บ้าง ตรวจจับอัตโนมัติก็ยังสูง
    expect(actionPriority(9, 2, 3)).toBe("ต่ำ");
    expect(actionPriority(7, 5, 5)).toBe("กลาง");
    expect(actionPriority(5, 4, 3)).toBe("ต่ำ");
    expect(actionPriority(10, 6, 1)).toBe("สูง");
  });

  it("lets a process FMEA lower occurrence and detection, never severity", () => {
    expect(openHigh(fmeaByNo("PF-2569-01"))).toEqual([]);
    expect(() => completeFmeaAction("PF-2569-01", 2, { s: 5, o: 3, d: 3 })).toThrow("ไม่มีมาตรการ");
  });
});

describe("launching the battery bracket", () => {
  it("is held at PPAP by the measurement system and the capability it produced", () => {
    expect(pendingElements(ppap())).toEqual(["ผลการวิเคราะห์ระบบการวัด", "ผลการศึกษากระบวนการเบื้องต้น"]);
    expect(grr(studyByNo("MSA-2569-02"))).toMatchObject({ verdict: "ยอมรับไม่ได้" });
    expect(stats(chartByCode("SPC-02")).ppk).toBeLessThan(1.33);
    expect(() => submitPpap(ppap().no)).toThrow("ยังขาด");
    expect(() => setElement(ppap().no, "ผลการวิเคราะห์ระบบการวัด", "ครบ")).toThrow("ระบบตัดสิน");
    expect(PROJECTS[0].deliverables.filter((d) => !isDone(PROJECTS[0], d) && d.phase === 3).map((d) => d.item)).toEqual([
      "ผลการวิเคราะห์ระบบการวัด", "ความสามารถกระบวนการเบื้องต้นถึงเกณฑ์", "PPAP ได้รับอนุมัติจากลูกค้า",
    ]);
  });

  it("clears the measurement system with a bore gauge study", () => {
    const s = recordStudy({ gauge: "BG-BK220-01", characteristic: "ขนาดรูยึด", lsl: 10.5, usl: 10.6, appraisers: ["สุภาพร แก้วมณี", "ธนพล เจริญผล", "อนุชา ทองดี"], rows: boreRows });
    expect(s.no).toBe("MSA-2569-03");
    const r = grr(s);
    expect(r.verdict).toBe("ยอมรับได้");
    expect(r.pct).toBeLessThan(10);
    expect(pendingElements(ppap())).toEqual(["ผลการศึกษากระบวนการเบื้องต้น"]);
  });

  it("restarts the capability study after the gauge change and needs 25 subgroups", () => {
    restartChart("SPC-02", "เปลี่ยนจากเวอร์เนียร์เป็นเกจวัดรูแบบบอร์ BG-BK220-01");
    const c = chartByCode("SPC-02");
    expect(c.subgroups).toEqual([]);
    expect(c.history).toHaveLength(1);
    addSubgroups("SPC-02", tightGroups.split("\n").slice(0, 10).join("\n"));
    expect(elementStatus(ppap(), "ผลการศึกษากระบวนการเบื้องต้น").why).toContain("10 จาก 25");
    addSubgroups("SPC-02", tightGroups.split("\n").slice(10).join("\n"));
    expect(capable(c)).toBe(true);
    expect(pendingElements(ppap())).toEqual([]);
  });

  it("submits, gets approved, moves the control plan to production and passes the gate", () => {
    expect(planOfPhase(part, "ผลิตจริง")).toBeUndefined();
    expect(() => promoteToProduction(part)).toThrow("อนุมัติ PPAP");
    submitPpap(ppap().no);
    recordDecision(ppap().no, { decision: "อนุมัติ", note: "", interimUntil: "" });
    expect(releasedForProduction(part)).toBe(true);
    const cp = promoteToProduction(part);
    expect(cp).toMatchObject({ no: "CP-BK220-M", phase: "ผลิตจริง" });
    expect(currentPhase(PROJECTS[0])).toBe(3);
    expect(gateErrors(PROJECTS[0].no, { decision: "ผ่าน", note: "", by: "ธนพล เจริญผล" }).by).toContain("ผู้แทนฝ่ายบริหาร");
    passGate(PROJECTS[0].no, { decision: "ผ่าน", note: "PPAP อนุมัติ พร้อมเริ่มผลิต", by: QMR });
    expect(currentPhase(PROJECTS[0])).toBe(4);
  });
});

describe("control plan and SPC rules", () => {
  it("refuses sampling alone on a critical characteristic", () => {
    const row = { op: "0010", characteristic: "ตำแหน่งรูยึด", special: "CC" as const, spec: "120 ± 0.2", gauge: "CMM-FX-01", sample: "1 ชิ้นต่อกะ", control: "สุ่มตรวจ" as const, reaction: "แจ้ง QC ทันที" };
    expect(cpRowErrors("CP-BK220-M", row).control).toContain("CC");
    expect(cpRowErrors("CP-BK220-M", { ...row, op: "9999" }).op).toBeDefined();
  });

  it("notices a special characteristic that the FMEA declares and the control plan lacks", () => {
    addFmeaRow("PF-2569-01", { step: "0020 พ่นสีฝุ่นดำและอบ", failure: "สีไม่ยึดเกาะ", effect: "สีลอก เป็นสนิม", cause: "ผิวมีคราบน้ำมัน", s: 6, o: 3, d: 4, prevention: "ล้างไขมันก่อนพ่น", detection: "ทดสอบขีดตาราง", characteristic: "การยึดเกาะของสี", special: "SC" });
    const cp = CONTROL_PLANS.find((c) => c.no === "CP-BK220-M")!;
    expect(missingSpecials(cp)).toEqual([{ characteristic: "การยึดเกาะของสี", special: "SC" }]);
    addCpRow("CP-BK220-M", { op: "0020", characteristic: "การยึดเกาะของสี", special: "SC", spec: "ระดับ 0–1 ตาม ISO 2409", gauge: "ชุดทดสอบขีดตาราง", sample: "1 ชิ้นต่อล็อตสี", control: "ตรวจชิ้นแรกและชิ้นสุดท้าย", reaction: "หยุดพ่น ตรวจขั้นตอนล้างไขมัน" });
    expect(missingSpecials(cp)).toEqual([]);
    expect(cp.approvedBy).toBeUndefined(); // แก้แล้วต้องอนุมัติใหม่
  });

  it("flags a reading outside the specification", () => {
    expect(addSubgroup("SPC-01", [120.01, 120.02, 119.99, 120.25, 120.0]).outOfSpec).toBe(true);
  });

  it("feeds the management review", () => {
    expect(liveAgenda().map((a) => a.key)).toEqual(expect.arrayContaining(["ct-launch", "ct-capability"]));
  });
});
