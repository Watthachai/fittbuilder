import { describe, expect, it } from "vitest";
import {
  AUDITS, CAPAS, DOCUMENTS, GAUGES, LOTS, NCRS, QMR, addCapaAction, addFinding, approveDocument, auditErrors, calState,
  closeAudit, closeNcr, closeNcrErrors, completeCapaAction, createComplaint, createDocument, createLot, decideLot,
  decisionErrors, disposeNcr, dispositionErrors, gaugeByCode, lotByNo, ncrByNo, objectives, obsoleteDocument, openCapa,
  pendingInspections, planAudit, recordCalibration, recordResults, recordRootCause, resultErrors, reviseDocument,
  startAudit, submitDocument, verifyCapa, vendorQuality,
} from "../../demo/modules/qm/data";
import { MATERIALS, STOCK_MOVES, postGoodsReceipt } from "../../demo/modules/mm/data";

/**
 * บริหารคุณภาพตาม ISO 9001:2015 — แต่ละข้อกำหนดทดสอบผ่านงานที่ทำได้จริงในระบบ
 * ค่าที่คาดหวังคิดจากข้อกำหนดและข้อมูลตั้งต้น ไม่ได้คิดแบบเดียวกับโค้ด
 * เทสต์ใช้ข้อมูลชุดเดียวกันและรันตามลำดับ เหมือนหนึ่งวันของฝ่ายประกันคุณภาพ
 */

const stock = (code: string) => MATERIALS.find((m) => m.code === code)!.stock;

describe("the quality objectives the management review reads (6.2, 9.3)", () => {
  it("are measured from the work in the system at cold start", () => {
    const o = Object.fromEntries(objectives().map((x) => [x.name, x]));
    // ตรวจรับ: 0041 ผ่าน, 0042 ผ่าน, 0043 ไม่ผ่าน → 2/3
    expect(o["ของเข้าผ่านการตรวจรับ"]).toMatchObject({ actual: 66.7, met: false });
    // ตรวจก่อนส่ง: 0039 ผ่าน, 0040 ยอมรับแบบมีเงื่อนไข → 1/2
    expect(o["สินค้าผ่านการตรวจก่อนส่งครั้งแรก"]).toMatchObject({ actual: 50, met: false });
    // ข้อร้องเรียนเดือนกันยายน: NCR-2569-013 เรื่องเดียว ≤ 2
    expect(o["ข้อร้องเรียนลูกค้าเดือนนี้"]).toMatchObject({ actual: 1, met: true });
    // มาตรการที่ถึงกำหนดแล้ว 3 ข้อ เสร็จตรงเวลา 2 (ข้อของ CAR-008 เลยกำหนด 20/09)
    expect(o["มาตรการแก้ไขเสร็จตามกำหนด"]).toMatchObject({ actual: 66.7, met: false });
    // เครื่องมือใช้งาน 5 ตัว ไมโครมิเตอร์เลยรอบ 10/09 → 4/5
    expect(o["เครื่องมือวัดอยู่ในรอบสอบเทียบ"]).toMatchObject({ actual: 80, met: false });
  });

  it("rates suppliers by the lots they failed (8.4.1)", () => {
    const v = Object.fromEntries(vendorQuality().map((x) => [x.code, x]));
    expect(v["V-001"]).toMatchObject({ lots: 2, rejected: 0, rate: 0 });
    expect(v["V-002"]).toMatchObject({ lots: 1, rejected: 1, rate: 100 });
  });
});

describe("document control (7.5)", () => {
  it("issues a new procedure only after someone other than its author approves it", () => {
    const d = createDocument({ type: "ขั้นตอนการปฏิบัติงาน", title: "การจัดการข้อร้องเรียนลูกค้า", clause: "9.1.2", owner: "ฝ่ายขาย", by: "ชลธิชา มั่นคง", change: "" });
    expect(d).toMatchObject({ code: "QP-07", status: "ร่าง", rev: -1 });
    submitDocument(d.code);
    expect(d.status).toBe("รออนุมัติ");
    expect(() => approveDocument(d.code, "ชลธิชา มั่นคง")).toThrow("ผู้อนุมัติต้องไม่ใช่ผู้จัดทำ");
    approveDocument(d.code, QMR, "2026-09-22");
    expect(d).toMatchObject({ status: "ใช้งาน", rev: 0, effective: "2026-09-22", reviewDue: "2027-09-22" });
  });

  it("keeps the issued revision in use while the next one is drafted", () => {
    const d = DOCUMENTS.find((x) => x.code === "QP-03")!;
    reviseDocument("QP-03", "เพิ่มการสั่งการกรณีส่งคืนผู้ขาย", "สุภาพร แก้วมณี");
    expect(d).toMatchObject({ rev: 0, status: "ใช้งาน", draft: { rev: 1, submitted: false } });
    expect(() => reviseDocument("QP-03", "แก้อีกรอบ", "สุภาพร แก้วมณี")).toThrow("ค้างอยู่แล้ว");
    submitDocument("QP-03");
    approveDocument("QP-03", QMR);
    expect(d.rev).toBe(1);
    expect(d.history.map((h) => h.rev)).toEqual([0, 1]);
  });

  it("withdraws a document only with a reason", () => {
    expect(() => obsoleteDocument("WI-02", "")).toThrow("เหตุผล");
    obsoleteDocument("WI-02", "รวมเข้ากับแผนการตรวจในระบบแล้ว");
    expect(DOCUMENTS.find((d) => d.code === "WI-02")!.status).toBe("ยกเลิก");
  });
});

describe("inspection and release (8.6)", () => {
  it("lists what purchasing received but nobody has inspected yet", () => {
    // GR-2569-197 (28/08) ตลับลูกปืนมีแผนตรวจแต่ยังไม่เปิดล็อต ผู้ขายตามใบสั่งซื้อ PO-2569-112
    expect(pendingInspections()).toEqual([
      { origin: "ตรวจรับ", source: "GR-2569-197", ref: "PO-2569-112", material: "MAT-2002", qty: 200, date: "2026-08-28", vendor: "V-004" },
    ]);
  });

  it("picks up a receipt the moment purchasing books it", () => {
    const gr = postGoodsReceipt({ po: "PO-2569-119", date: "2026-09-22", deliveryNote: "DN-5561", receivedBy: "วรวุฒิ พึ่งบุญ", lines: [{ material: "MAT-1003", qty: 6 }] });
    const p = pendingInspections().find((x) => x.source === gr.no)!;
    expect(p).toMatchObject({ origin: "ตรวจรับ", material: "MAT-1003", qty: 6, vendor: "V-003" });
    const l = createLot(p);
    // IL ต่อจาก 0044 · ล็อต 6 ถังเล็กกว่า 8 จึงตรวจทุกถัง
    expect(l).toMatchObject({ no: "IL-2569-0045", sample: 6, status: "รอตรวจ" });
    expect(() => createLot(p)).toThrow("เปิดล็อตตรวจไปแล้ว");
  });

  it("judges each characteristic against the plan, not against the inspector", () => {
    expect(resultErrors("IL-2569-0045", [])).toMatchObject({ ความหนืด: expect.any(String) });
    recordResults("IL-2569-0045", [
      { characteristic: "ความหนืด", min: 19, max: 25 },
      { characteristic: "สีตรงตามแผ่นเทียบ RAL 7035", defects: 0 },
    ], "สุภาพร แก้วมณี");
    const l = lotByNo("IL-2569-0045");
    expect(l.results.map((r) => r.ok)).toEqual([false, true]); // 25 วินาทีเกิน USL 24
    expect(decisionErrors(l.no, "ผ่าน", QMR, "").decision).toContain("ตัดสินผ่านไม่ได้");
    // ผ่อนผันต้องเป็น QMR
    expect(decisionErrors(l.no, "ยอมรับแบบมีเงื่อนไข", "สุภาพร แก้วมณี", "ความหนืดสูงเล็กน้อย เจือจางได้").by).toContain("QMR");
  });

  it("opens an NCR by itself when a lot is rejected", () => {
    const { lot, ncr } = decideLot("IL-2569-0045", "ไม่ผ่าน", QMR, "ความหนืด 25 วินาที เกินเกณฑ์ 24");
    expect(ncr).toMatchObject({ no: "NCR-2569-015", source: "ตรวจรับ", ref: "IL-2569-0045", material: "MAT-1003", qty: 6, vendor: "V-003", status: "รอสั่งการ" });
    expect(lot.ncr).toBe("NCR-2569-015");
  });
});

describe("nonconforming outputs (8.7)", () => {
  it("returns rejected goods to the vendor through purchasing's stock", () => {
    const before = stock("MAT-1002");
    expect(dispositionErrors("NCR-2569-014", { disposition: "ใช้ตามสภาพ (ผ่อนผัน)", by: "สุภาพร แก้วมณี", note: "ใช้ทำชิ้นส่วนรอง" }).by).toContain("QMR");
    const n = disposeNcr("NCR-2569-014", { disposition: "ส่งคืนผู้ขาย", by: QMR, note: "ส่งคืน หจก. ศรีชัยค้าวัสดุ ขอเปลี่ยนของ" });
    expect(stock("MAT-1002")).toBe(before - 60);
    expect(STOCK_MOVES.find((m) => m.doc === n.stockDoc)).toMatchObject({ material: "MAT-1002", qty: -60 });
    expect(n.status).toBe("ดำเนินการ");
  });

  it("does not return to a vendor what came from a customer", () => {
    const c = createComplaint({ delivery: "DO-2569-0301", material: "FG-5001", qty: 2, description: "ลูกค้าแจ้งน็อตยึดชั้นหลวม 2 ชุด", severity: "รุนแรง", reportedBy: "ชลธิชา มั่นคง" });
    expect(c).toMatchObject({ source: "ข้อร้องเรียนลูกค้า", customer: "C-102", ref: "DO-2569-0301" });
    expect(dispositionErrors(c.no, { disposition: "ส่งคืนผู้ขาย", by: QMR, note: "ส่งคืน" }).disposition).toContain("การตรวจรับ");
    // ของอยู่ที่ลูกค้า ซ่อมหน้างานไม่ตัดสต็อกเรา
    const before = stock("FG-5001");
    disposeNcr(c.no, { disposition: "ซ่อมหรือทำใหม่", by: QMR, note: "ส่งช่างขันน็อตใหม่ที่หน้างาน" });
    expect(stock("FG-5001")).toBe(before);
    // รุนแรงต้องมี CAR ก่อนปิด
    expect(closeNcrErrors(c.no).close).toContain("CAR");
  });

  it("closes a severe NCR once a corrective action is open against it", () => {
    const n = NCRS[NCRS.length - 1];
    openCapa({ kind: "แก้ไข", ref: n.no, problem: "น็อตยึดชั้นหลวมเมื่อถึงมือลูกค้า", owner: "อนุชา ทองดี" });
    expect(ncrByNo(n.no).capa).toMatch(/^CAR-2569-/);
    closeNcr(n.no, QMR);
    expect(ncrByNo(n.no).status).toBe("ปิดแล้ว");
  });
});

describe("corrective action (10.2)", () => {
  it("asks why three times, closes only after someone else checks it worked", () => {
    const c = CAPAS[CAPAS.length - 1];
    expect(c.status).toBe("วิเคราะห์สาเหตุ");
    expect(() => recordRootCause(c.no, { category: "วิธีการ", whys: ["น็อตหลวม"] })).toThrow("สามชั้น");
    addCapaAction(c.no, { what: "กำหนดแรงขันน็อตในใบงานประกอบ", owner: "อนุชา ทองดี", due: "2026-10-05" });
    expect(() => completeCapaAction(c.no, 0)).toThrow("สาเหตุราก");
    recordRootCause(c.no, { category: "วิธีการ", whys: ["น็อตหลวมระหว่างขนส่ง", "ขันด้วยมือไม่ได้ค่าแรงบิดที่กำหนด", "ใบงานไม่ระบุแรงบิดและไม่มีประแจทอร์ก"] });
    expect(c.status).toBe("ดำเนินการ");
    completeCapaAction(c.no, 0);
    expect(c.status).toBe("ติดตามผล");
    expect(() => verifyCapa(c.no, { effective: true, note: "ตรวจ 20 ชุดไม่พบน็อตหลวม", by: "อนุชา ทองดี" })).toThrow("ต้องไม่ใช่ผู้รับผิดชอบ");
    verifyCapa(c.no, { effective: false, note: "ยังพบน็อตหลวม 1 ใน 20 ชุด", by: QMR });
    expect(c.status).toBe("วิเคราะห์สาเหตุ");
  });
});

describe("internal audit (9.2)", () => {
  it("does not let an auditor audit their own department", () => {
    expect(auditErrors({ area: "ฝ่ายผลิต", clauses: ["8.5"], auditor: "อนุชา ทองดี", planned: "2026-10-20" }).auditor).toContain("ฝ่ายของตัวเอง");
    expect(auditErrors({ area: "ฝ่ายผลิต", clauses: ["8.5"], auditor: "วรวุฒิ พึ่งบุญ", planned: "2026-10-20" }).auditor).toContain("อบรม");
  });

  it("closes an audit only when every nonconformity has a corrective action", () => {
    const a = planAudit({ area: "ฝ่ายผลิต", clauses: ["8.5", "7.5"], auditor: "สุภาพร แก้วมณี", planned: "2026-10-20" });
    expect(a.no).toBe("IA-2569-05");
    startAudit(a.no);
    addFinding(a.no, { clause: "7.5", type: "ข้อบกพร่องย่อย", detail: "ใบงาน WI-01 ที่หน้างานเป็นฉบับ Rev.00 ที่ยกเลิกแล้ว" });
    addFinding(a.no, { clause: "8.5", type: "ข้อสังเกต", detail: "พื้นที่วางงานรอพ่นสีไม่มีเส้นแบ่งชัดเจน" });
    expect(() => closeAudit(a.no)).toThrow("อีก 1 ข้อ");
    openCapa({ kind: "แก้ไข", ref: `${a.no} #1`, problem: "เอกสารฉบับเก่ายังใช้อยู่หน้างาน", owner: "อนุชา ทองดี" });
    expect(AUDITS.find((x) => x.no === a.no)!.findings[0].capa).toMatch(/^CAR-/);
    closeAudit(a.no);
    expect(a.status).toBe("ปิดแล้ว");
  });
});

describe("calibration (7.1.5)", () => {
  it("knows which instruments are overdue or due soon", () => {
    expect(calState(gaugeByCode("QC-MC-01"))).toBe("เกินกำหนด"); // 10/09/2025 + 12 เดือน
    expect(calState(gaugeByCode("QC-CT-01"))).toBe("ใกล้ครบ"); // 05/04 + 6 เดือน = 05/10
    expect(calState(gaugeByCode("QC-VC-01"))).toBe("ปกติ");
  });

  it("suspends a failed instrument and reopens the results it measured", () => {
    const { gauge, ncr } = recordCalibration("QC-MC-01", {
      date: "2026-09-22", by: "บจก. ไทยแคลิเบรชั่น", certNo: "TC-26-02290", result: "ไม่ผ่าน", error: "+0.021 มม.", note: "ค่าคลาดเคลื่อนเกินเกณฑ์ ±0.004 มม.",
    });
    expect(gauge.status).toBe("พักใช้");
    expect(calState(gauge)).toBe("พักใช้");
    // IL-2569-0041 วัดความหนาด้วย QC-MC-01 เมื่อ 03/09 หลังสอบเทียบครั้งก่อน
    expect(ncr).toMatchObject({ source: "สอบเทียบเครื่องมือ", ref: "QC-MC-01" });
    expect(ncr!.description).toContain("IL-2569-0041");
    expect(GAUGES.find((g) => g.code === "QC-MC-01")!.records).toHaveLength(2);
  });

  it("puts a passed instrument back on a fresh cycle", () => {
    const { gauge } = recordCalibration("QC-CT-01", { date: "2026-09-22", by: "ภายใน (แผ่นมาตรฐาน)", certNo: "IC-2569-031", result: "ผ่าน", error: "+1 ไมครอน", note: "" });
    expect(gauge.lastCal).toBe("2026-09-22");
    expect(calState(gauge)).toBe("ปกติ");
  });

  it("keeps the incoming lots it did not touch", () => {
    expect(LOTS.filter((l) => l.origin === "ตรวจรับ").map((l) => l.no)).toEqual(["IL-2569-0041", "IL-2569-0042", "IL-2569-0043", "IL-2569-0044", "IL-2569-0045"]);
  });
});
