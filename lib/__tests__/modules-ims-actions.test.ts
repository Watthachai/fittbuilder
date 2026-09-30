import { describe, expect, it } from "vitest";
import {
  AUDITS, CAPAS, DOCUMENTS, OBJECTIVES, POLICIES, QMR, REVIEWS, TOP, acknowledgePolicy, addCapaAction, addFinding, addRisk,
  approveDocument, auditErrors, awareness, capaErrors, clauseLabel, closeAudit, completeCapaAction, completeRiskTask,
  createDocument, eightD, evaluateTraining, expiringSoon, findingsWithoutCar, gapsOf, isQualified, liveAgenda, metNow,
  minutesErrors, openCapa, planAudit, planReview, planTraining, reassessErrors, reassessRisk, recordContainment,
  recordMinutes, recordObjectiveResult, recordPrevention, recordRootCause, recordTraining, resultErrors, reviseDocument,
  revisePolicy, riskByNo, riskErrors, startAudit, submitDocument, unmanaged, verifyCapa, verifyCapaErrors,
} from "../../demo/modules/ims/data";

/**
 * ระบบบริหารบูรณาการ — ส่วนที่ ISO 9001, ISO 14001 และ IATF 16949 ใช้ร่วมกัน
 * ค่าที่คาดหวังคิดจากข้อกำหนดและข้อมูลตั้งต้น ไม่ได้คิดแบบเดียวกับโค้ด
 * เทสต์ใช้ข้อมูลชุดเดียวกันและรันตามลำดับ
 */

describe("clauses across three standards", () => {
  it("says which standard a clause belongs to", () => {
    expect(clauseLabel("IATF:10.2.3")).toBe("IATF ข้อ 10.2.3");
    expect(clauseLabel("14001:6.1.2")).toBe("14001 ข้อ 6.1.2");
  });
});

describe("risks and opportunities (6.1)", () => {
  it("does not accept a high risk", () => {
    const input = { kind: "ความเสี่ยง" as const, standards: ["ISO 9001" as const], process: "การผลิต", description: "ไฟฟ้าดับทั้งนิคม สายการผลิตหยุด", likelihood: 4, impact: 4, treatment: "ยอมรับ" as const, owner: "อนุชา ทองดี" };
    expect(riskErrors(input).treatment).toContain("ยอมรับไม่ได้");
    expect(addRisk({ ...input, treatment: "ลดความเสี่ยง" }).no).toBe("RSK-007");
  });

  it("flags a high risk once nothing is being done about it", () => {
    // RSK-001 คะแนน 3×5 = 15 ยังมีงานสำรองอะไหล่ค้างอยู่ จึงยังมีคนดูแล
    // RSK-007 ที่เพิ่งเพิ่ม 4×4 = 16 ยังไม่มีมาตรการเลย
    expect(unmanaged().map((r) => r.no)).toEqual(["RSK-007"]);
    completeRiskTask("RSK-001", 1);
    expect(unmanaged().map((r) => r.no)).toEqual(["RSK-001", "RSK-007"]);
  });

  it("reassesses only after the plan is done, and then uses what is left", () => {
    expect(reassessErrors("RSK-002", { likelihood: 1, impact: 3 }).likelihood).toContain("ทำมาตรการให้เสร็จ");
    reassessRisk("RSK-001", { likelihood: 2, impact: 5 });
    expect(riskByNo("RSK-001").residual).toMatchObject({ likelihood: 2, impact: 5 });
    // 2×5 = 10 ระดับกลาง ไม่ใช่ความเสี่ยงสูงที่ไม่มีใครดูแลอีกต่อไป
    expect(unmanaged().map((r) => r.no)).toEqual(["RSK-007"]);
  });
});

describe("policy and objectives (5.2, 6.2, 7.3)", () => {
  it("counts who has acknowledged the current policy", () => {
    const q = POLICIES.find((p) => p.code === "POL-Q")!;
    expect(awareness(q)).toBe(76.9); // 10 จาก 13 คน
    acknowledgePolicy("POL-Q", "มานพ รุ่งเรือง");
    expect(awareness(q)).toBe(84.6);
    expect(() => acknowledgePolicy("POL-Q", "มานพ รุ่งเรือง")).toThrow("รับทราบ");
  });

  it("lets only top management issue a new policy, and restarts acknowledgement", () => {
    expect(() => revisePolicy("POL-E", ["ป้องกันมลพิษ", "ลดพลังงาน"], QMR)).toThrow(TOP);
    const p = revisePolicy("POL-E", ["ป้องกันมลพิษจากทุกกระบวนการ", "ลดพลังงานต่อหน่วยผลิตปีละ 5%"], TOP);
    expect(p).toMatchObject({ rev: 1, acknowledged: [TOP] });
  });

  it("judges an objective by its latest month", () => {
    expect(metNow(OBJECTIVES[0])).toBe(true); // ของเสีย 1.4% ≤ 1.5%
    expect(metNow(OBJECTIVES[2])).toBe(false); // ผ่านตรวจรับ 90% < 95%
    expect(metNow(OBJECTIVES[5])).toBeUndefined(); // PPM ยังไม่มีผลเพราะยังไม่ส่งชิ้นส่วนยานยนต์
  });

  it("records a month once and never ahead of time", () => {
    expect(resultErrors(1, { month: "2026-10", value: 1.2 }).month).toContain("ล่วงหน้า");
    recordObjectiveResult(1, { month: "2026-09", value: 1.3 });
    expect(resultErrors(1, { month: "2026-09", value: 1.2 }).month).toContain("บันทึกผลแล้ว");
  });
});

describe("documented information (7.5)", () => {
  it("numbers a new procedure in the shared register", () => {
    const d = createDocument({ level: "ระเบียบปฏิบัติ", title: "การจัดการข้อร้องเรียนชุมชน", standards: ["ISO 14001"], owner: "ฝ่ายความปลอดภัยและสิ่งแวดล้อม", by: "กาญจนา บุญมา", change: "" });
    expect(d).toMatchObject({ code: "SP-22", status: "ร่าง", rev: -1 });
    submitDocument(d.code);
    expect(() => approveDocument(d.code, "กาญจนา บุญมา")).toThrow("ผู้อนุมัติต้องไม่ใช่ผู้จัดทำ");
    approveDocument(d.code, QMR);
    expect(d).toMatchObject({ status: "ใช้งาน", rev: 0, reviewDue: "2027-09-22" });
  });

  it("has the system manual approved by top management only", () => {
    reviseDocument("IM-01", "เพิ่มแผนผังกระบวนการรวมสามมาตรฐาน", QMR);
    submitDocument("IM-01");
    expect(() => approveDocument("IM-01", "สุภาพร แก้วมณี")).toThrow(TOP);
    approveDocument("IM-01", TOP);
    expect(DOCUMENTS.find((x) => x.code === "IM-01")!.rev).toBe(3);
  });
});

describe("competence (7.2, IATF 7.2.3)", () => {
  it("derives what each person lacks from training results and expiry dates", () => {
    // มานพ: ขาดจรรยาบรรณ ดับเพลิงหมดอายุ 20/08/2569 และสารเคมีสอบไม่ผ่าน
    expect(gapsOf("มานพ รุ่งเรือง")).toEqual(["TR-12", "TR-10", "TR-07"]);
    // บัตรช่างเชื่อมสองปีจาก 30/10/2567 หมด 30/10/2569 — ภายใน 60 วัน
    expect(isQualified("สมปอง ใจกล้า", "TR-08")).toBe(true);
    expect(expiringSoon()).toContainEqual({ name: "สมปอง ใจกล้า", course: "TR-08", until: "2026-10-30" });
  });

  it("qualifies someone the day their training result is recorded", () => {
    expect(() => recordTraining("TRN-2569-008", { "ประสิทธิ์ ขยันยิ่ง": "ผ่าน", "อนุชา ทองดี": "ผ่าน" })).toThrow("ยังไม่ถึงวันอบรม");
    recordTraining("TRN-2569-009", { "มานพ รุ่งเรือง": "ผ่าน" });
    expect(gapsOf("มานพ รุ่งเรือง")).toEqual(["TR-12", "TR-10"]);
  });

  it("has effectiveness judged by someone other than the trainer", () => {
    expect(() => evaluateTraining("TRN-2569-009", { effective: true, note: "ถ่ายทินเนอร์ถูกวิธีทุกครั้งที่สุ่มดู", by: "กาญจนา บุญมา" })).toThrow("วิทยากร");
    expect(evaluateTraining("TRN-2569-009", { effective: true, note: "ถ่ายทินเนอร์ถูกวิธีทุกครั้งที่สุ่มดู", by: "อนุชา ทองดี" }).evaluation?.by).toBe("อนุชา ทองดี");
    expect(planTraining({ course: "TR-10", date: "2026-10-05", hours: 3, trainer: "สถานีดับเพลิงในพื้นที่", attendees: ["มานพ รุ่งเรือง", "สมปอง ใจกล้า"] }).no).toBe("TRN-2569-010");
  });
});

describe("internal audit (9.2, IATF 9.2.2)", () => {
  const base = { type: "ตรวจระบบ" as const, std: "ISO 9001" as const, area: "ฝ่ายผลิต" as const, subject: "", clauses: ["9001:8.5"], planned: "2026-10-20" };

  it("admits only trained auditors, and never to their own department", () => {
    expect(auditErrors({ ...base, auditor: "วรวุฒิ พึ่งบุญ" }).auditor).toContain("ผู้ตรวจติดตามภายใน ISO 9001");
    expect(auditErrors({ ...base, auditor: "อนุชา ทองดี" }).auditor).toContain("ฝ่ายของตัวเอง");
    // การตรวจกระบวนการต้องมี VDA 6.3 — QMR มี Core Tools แต่ยังไม่มี VDA 6.3
    expect(auditErrors({ ...base, type: "ตรวจกระบวนการ", std: "IATF 16949", subject: "ปั๊มขึ้นรูป", clauses: ["IATF:9.2.2.3"], auditor: QMR }).auditor).toContain("VDA 6.3");
    expect(auditErrors({ ...base, type: "ตรวจกระบวนการ", std: "ISO 9001", subject: "ปั๊มขึ้นรูป", auditor: "ธนพล เจริญผล" }).type).toContain("IATF");
    expect(auditErrors({ ...base, std: "ISO 14001", clauses: ["14001:8.1"], auditor: QMR })).toEqual({});
  });

  it("closes a system audit only when every nonconformity has a CAR", () => {
    const a = planAudit({ ...base, clauses: ["9001:8.5", "9001:7.5"], auditor: "สุภาพร แก้วมณี" });
    expect(a.no).toBe("IA-2569-07");
    startAudit(a.no);
    addFinding(a.no, { clause: "9001:7.5", type: "ข้อบกพร่องย่อย", detail: "ใบงาน WI-01 ที่หน้างานเป็นฉบับ Rev.00 ที่ยกเลิกแล้ว" });
    addFinding(a.no, { clause: "9001:8.5", type: "ข้อสังเกต", detail: "พื้นที่วางงานรอพ่นสีไม่มีเส้นแบ่งชัดเจน" });
    expect(() => closeAudit(a.no)).toThrow("อีก 1 ข้อ");
    openCapa({ method: "5 Why", std: "ISO 9001", ref: `${a.no} #1`, problem: "เอกสารฉบับเก่ายังใช้อยู่หน้างาน", owner: "อนุชา ทองดี", team: [] });
    expect(findingsWithoutCar(a)).toEqual([]);
    closeAudit(a.no);
    expect(a.status).toBe("ปิดแล้ว");
  });

  it("scores a process audit before closing it", () => {
    startAudit("IA-2569-05");
    expect(() => closeAudit("IA-2569-05")).toThrow("VDA 6.3");
    closeAudit("IA-2569-05", 86);
    expect(AUDITS.find((x) => x.no === "IA-2569-05")).toMatchObject({ status: "ปิดแล้ว", score: 86 });
  });
});

describe("corrective action (10.2)", () => {
  it("asks why three times and closes only after someone else checks it worked", () => {
    const c = openCapa({ method: "5 Why", std: "ISO 9001", ref: "NCR-2569-090", problem: "น็อตยึดชั้นหลวมเมื่อถึงมือลูกค้า", owner: "อนุชา ทองดี", team: [] });
    expect(() => recordRootCause(c.no, { category: "วิธีการ", whys: ["น็อตหลวม"], escape: "" })).toThrow("สามชั้น");
    addCapaAction(c.no, { what: "กำหนดแรงขันน็อตในใบงานประกอบ", owner: "อนุชา ทองดี", due: "2026-10-05", type: "ป้องกันการเกิดซ้ำ" });
    expect(() => completeCapaAction(c.no, 0)).toThrow("สาเหตุราก");
    recordRootCause(c.no, { category: "วิธีการ", whys: ["น็อตหลวมระหว่างขนส่ง", "ขันด้วยมือไม่ได้ค่าแรงบิดที่กำหนด", "ใบงานไม่ระบุแรงบิดและไม่มีประแจทอร์ก"], escape: "" });
    completeCapaAction(c.no, 0);
    expect(c.status).toBe("ติดตามผล");
    expect(verifyCapaErrors(c.no, { effective: true, note: "ตรวจ 20 ชุดไม่พบน็อตหลวม", by: "อนุชา ทองดี" }).by).toContain("ต้องไม่ใช่ผู้รับผิดชอบ");
    verifyCapa(c.no, { effective: false, note: "ยังพบน็อตหลวม 1 ใน 20 ชุด", by: QMR });
    expect(c.status).toBe("วิเคราะห์สาเหตุ");
  });

  it("runs 8D as a team, contains first, and closes only with prevention on file", () => {
    const input = { method: "8D" as const, std: "IATF 16949" as const, ref: "NCR-2569-091", problem: "รูยึดขายึดแบตเตอรี่เยื้องศูนย์ 0.3 มม. ลูกค้าพบที่สายประกอบ", owner: "ธนพล เจริญผล", team: [] };
    expect(capaErrors(input).team).toContain("ทีม");
    const c = openCapa({ ...input, team: ["ศักดิ์ชัย วงศ์ไทย", "อนุชา ทองดี"] });
    expect(c.team).toEqual(["ธนพล เจริญผล", "ศักดิ์ชัย วงศ์ไทย", "อนุชา ทองดี"]);
    expect(() => recordRootCause(c.no, { category: "เครื่องจักร", whys: ["ไกด์พินแม่พิมพ์สึก", "ไม่มีรอบเปลี่ยนไกด์พิน", "แผน PM ไม่รวมแม่พิมพ์"], escape: "" })).toThrow("หลุด");
    recordRootCause(c.no, { category: "เครื่องจักร", whys: ["ไกด์พินแม่พิมพ์สึก", "ไม่มีรอบเปลี่ยนไกด์พิน", "แผน PM ไม่รวมแม่พิมพ์"], escape: "ตรวจชิ้นแรกทุกกะ แต่ไม่ตรวจกลางกะ ของที่เยื้องจึงหลุดทั้งล็อต" });
    addCapaAction(c.no, { what: "ติดตั้งเกจตรวจรู Go/No-Go ที่เครื่องปั๊ม", owner: "ศักดิ์ชัย วงศ์ไทย", due: "2026-10-10", type: "ป้องกันความผิดพลาด (Poka-Yoke)" });
    expect(() => completeCapaAction(c.no, 0)).toThrow("D3");
    recordContainment(c.no, "คัดแยก 100% ที่คลังเราและที่ลูกค้า 1,200 ชิ้น พบเสีย 36 ชิ้น");
    completeCapaAction(c.no, 0);
    expect(verifyCapaErrors(c.no, { effective: true, note: "ผลิต 3 ล็อตหลังแก้ไม่พบรูเยื้อง", by: QMR }).note).toContain("D7");
    recordPrevention(c.no, "เพิ่มไกด์พินใน PFMEA และแผน PM แม่พิมพ์ทุก 50,000 ครั้ง");
    verifyCapa(c.no, { effective: true, note: "ผลิต 3 ล็อตหลังแก้ไม่พบรูเยื้อง", by: QMR });
    expect(eightD(c).every((s) => s.done)).toBe(true);
  });

  it("keeps one CAR per source", () => {
    expect(capaErrors({ method: "5 Why", std: "ISO 9001", ref: "NCR-2569-013", problem: "สีถลอกซ้ำอีกครั้ง", owner: "วรวุฒิ พึ่งบุญ", team: [] }).ref).toContain("CAR-2569-008");
    expect(CAPAS.map((c) => c.no).at(-1)).toBe("CAR-2569-011");
  });
});

describe("management review (9.3)", () => {
  it("gathers inputs from each installed system", () => {
    expect(liveAgenda().map((a) => a.key)).toEqual(["ims-audits", "ims-capa", "ims-objectives", "ims-risks", "ims-competence", "ims-previous"]);
  });

  it("requires top management, keeps a snapshot of the inputs, and then schedules the next", () => {
    const outputs = [{ decision: "จัดงบซื้อเกจตรวจรูสำหรับสายปั๊มทุกเครื่อง", kind: "ทรัพยากร" as const, owner: "อนุชา ทองดี", due: "2026-11-30" }];
    expect(minutesErrors("MR-2569-02", { attendees: [QMR], outputs }).attendees).toContain(TOP);
    const r = recordMinutes("MR-2569-02", { attendees: [TOP, QMR, "อนุชา ทองดี"], outputs });
    expect(r).toMatchObject({ status: "ประชุมแล้ว", heldOn: "2026-09-22" });
    expect(r.inputs).toHaveLength(6);
    expect(planReview("2027-04-20").no).toBe("MR-2569-03");
    expect(() => planReview("2027-05-01")).toThrow("วางแผนไว้แล้ว");
    expect(REVIEWS).toHaveLength(3);
  });
});
