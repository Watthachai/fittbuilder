import { describe, expect, it } from "vitest";
import { CAPAS, EMR, carOf, liveAgenda, verifyCapa, addCapaAction, completeCapaAction, recordRootCause } from "../../demo/modules/ims/data";
import {
  ASPECTS, INCIDENTS, RECEIVERS, aspectErrors, chemicalIssues, closeIncidentErrors, closeIncident, disposalErrors, drillErrors,
  drillsOverdue, evaluateObligation, evaluationDue, generationErrors, markReported, monitoringDue, onHand, pendingScrap,
  recordDisposal, recordGeneration, recordMonitoring, reportIncident, significant, uncontrolled, updateSds,
} from "../../demo/modules/em/data";
import { postStockMove } from "../../demo/modules/mm/data";

/**
 * การจัดการสิ่งแวดล้อมตาม ISO 14001:2015 — ทดสอบผ่านงานที่ทำได้จริงในระบบ
 * ค่าที่คาดหวังคิดจากข้อกำหนดและข้อมูลตั้งต้น เทสต์รันตามลำดับบนข้อมูลชุดเดียวกัน
 */

const aspect = { activity: "ล้างถังผสมสี", aspect: "น้ำล้างปนเปื้อนสี", impact: "ปนเปื้อนน้ำทิ้ง", condition: "ปกติ" as const, stage: "ผลิต" as const, severity: 4, frequency: 3, legal: false, owner: EMR };

describe("environmental aspects (6.1.2)", () => {
  it("counts an aspect significant by law or by score", () => {
    expect(significant(ASPECTS.find((a) => a.no === "ASP-007")!)).toBe(false); // 2×5 = 10 ไม่มีกฎหมาย
    expect(significant(ASPECTS.find((a) => a.no === "ASP-004")!)).toBe(true); // 3×5 = 15
    expect(uncontrolled()).toEqual([]);
  });

  it("requires a live operational control for a significant aspect", () => {
    expect(aspectErrors({ ...aspect, control: undefined }).control).toContain("เอกสารควบคุม");
    // WI-03 ยังรออนุมัติในทะเบียนกลาง ใช้เป็นการควบคุมไม่ได้
    expect(aspectErrors({ ...aspect, control: "WI-03" }).control).toContain("ยังไม่ได้ใช้งาน");
    expect(aspectErrors({ ...aspect, control: "SP-15" })).toEqual({});
  });
});

describe("compliance obligations (6.1.3, 9.1.2)", () => {
  it("knows which obligations are due for their yearly evaluation", () => {
    expect(evaluationDue().map((o) => o.no)).toEqual(["LAW-003", "LAW-005"]);
  });

  it("opens a CAR in the integrated system when an evaluation finds non-compliance", () => {
    const { car } = evaluateObligation("LAW-005", { result: "ไม่สอดคล้อง", evidence: "SDS ทินเนอร์เป็นฉบับปี 2563 เกิน 5 ปี", by: EMR });
    expect(car).toMatchObject({ no: "CAR-2569-009", std: "ISO 14001", owner: EMR });
    expect(evaluationDue().map((o) => o.no)).toEqual(["LAW-003"]);
  });
});

describe("waste and chemicals (8.1)", () => {
  it("tracks what is still stored first in, first out", () => {
    // ภาชนะปนเปื้อน: เกิด 85 + 80 + 70 ส่งไป 85 → เหลือ 150 เก่าสุดคือของ 31/07
    expect(onHand("W-02")).toEqual({ kg: 150, oldest: "2026-07-31", days: 53 });
  });

  it("disposes only what is on hand, to a licensed receiver, with a manifest", () => {
    const base = { type: "W-01", kg: 100, receiver: RECEIVERS[0].name, manifest: "สก.3-69-00602", date: "2026-09-22" };
    expect(disposalErrors({ ...base, kg: 500 }).kg).toContain("180");
    expect(disposalErrors({ ...base, receiver: RECEIVERS[2].name }).receiver).toContain("ไม่ได้รับอนุญาตวิธี");
    expect(disposalErrors({ ...base, manifest: "" }).manifest).toContain("ใบกำกับ");
    expect(recordDisposal(base).no).toBe("WD-2569-016");
    expect(onHand("W-01").kg).toBe(80);
  });

  it("brings scrap written off in the materials store onto the waste log", () => {
    expect(pendingScrap()).toEqual([]);
    const move = postStockMove({ kind: "ตัดของเสีย", material: "MAT-1001", qty: 2, department: "ฝ่ายผลิต", reason: "แผ่นเหล็กบิดงอจากการขนย้าย", date: "2026-09-22" });
    expect(pendingScrap().map((m) => m.doc)).toEqual([move.doc]);
    recordGeneration({ type: "W-04", kg: 112, source: move.doc!, date: "2026-09-22" });
    expect(pendingScrap()).toEqual([]);
    expect(generationErrors({ type: "W-04", kg: 112, source: move.doc!, date: "2026-09-22" }).source).toContain("ชั่งเข้าบัญชีแล้ว");
  });

  it("flags a chemical whose safety data sheet is older than five years", () => {
    expect(chemicalIssues().map((c) => c.code)).toEqual(["CH-02"]);
    updateSds("CH-02", "2026-09-22");
    expect(chemicalIssues()).toEqual([]);
  });
});

describe("monitoring and measurement (9.1.1)", () => {
  it("knows which monitoring is late", () => {
    expect(monitoringDue().filter((d) => d.late).map((d) => d.group)).toEqual(["น้ำทิ้ง"]);
  });

  it("opens a CAR when a result exceeds the legal limit", () => {
    const m = recordMonitoring({ group: "น้ำทิ้ง", date: "2026-09-22", lab: "บจก. เอ็นไวรอนเมนทัลแล็บ", values: { "WW-BOD": 16, "WW-COD": 135, "WW-SS": 38, "WW-PH": 7.0 } });
    expect(m.car).toBe("CAR-2569-010");
    expect(CAPAS.find((c) => c.no === m.car)!.problem).toContain("COD 135");
    expect(monitoringDue().filter((d) => d.late)).toEqual([]);
  });
});

describe("emergency preparedness (8.2) and incidents (10.2)", () => {
  it("knows which plan has not been drilled within its cycle", () => {
    expect(drillsOverdue().map((p) => p.code)).toEqual(["EP-03"]);
    expect(drillErrors({ plan: "EP-03", date: "2026-09-22", participants: 8, minutes: 6, result: "ต้องปรับปรุง", findings: "ปิดวาล์วช้าเพราะกุญแจตู้อยู่ที่หัวหน้ากะ", by: EMR }).improvement).toContain("ปรับอะไร");
  });

  it("does not close a severe incident before it is reported and its CAR is closed", () => {
    const { incident, car } = reportIncident({ date: "2026-09-22", plan: "EP-01", description: "น้ำยาฟอสเฟตรั่วจากท่อบ่อล้างประมาณ 50 ลิตร", impact: "ไหลออกรางน้ำฝนนอกรั้ว", containment: "ปิดวาล์ว ใช้ทรายกั้น สูบกลับเข้าบ่อพัก", severity: "รุนแรง" });
    expect(car.no).toBe("CAR-2569-011");
    expect(closeIncidentErrors(incident.no).close).toContain("รายงานหน่วยงานรัฐ");
    markReported(incident.no, "แจ้งอุตสาหกรรมจังหวัดทางโทรศัพท์ 22/09 10:30");
    expect(closeIncidentErrors(incident.no).close).toContain(car.no);
    recordRootCause(car.no, { category: "เครื่องจักร", whys: ["ข้อต่อท่อแตก", "ท่อพีวีซีกรอบจากสารเคมี", "ไม่มีรอบเปลี่ยนท่อในแผน PM"], escape: "" });
    addCapaAction(car.no, { what: "เปลี่ยนเป็นท่อ HDPE และเพิ่มในแผน PM", owner: "ประสิทธิ์ ขยันยิ่ง", due: "2026-10-15", type: "ป้องกันการเกิดซ้ำ" });
    completeCapaAction(car.no, 0);
    verifyCapa(car.no, { effective: true, note: "ตรวจท่อหนึ่งเดือนไม่พบรอยรั่ว", by: "นพดล ศรีวงศ์" });
    closeIncident(incident.no);
    expect(INCIDENTS.find((i) => i.no === incident.no)!.status).toBe("ปิดแล้ว");
    expect(carOf(incident.no)?.status).toBe("ปิดแล้ว");
  });

  it("feeds the management review", () => {
    expect(liveAgenda().map((a) => a.key)).toEqual(expect.arrayContaining(["em-compliance", "em-aspects", "em-monitoring", "em-waste", "em-emergency"]));
  });
});
