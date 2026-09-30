import { describe, expect, it } from "vitest";
import { QMR, liveAgenda, openCapa } from "../../demo/modules/ims/data";
import {
  GAUGES, LOTS, NCRS, approvalErrors, calState, carOfNcr, changeErrors, closeNcr, closeNcrErrors, commitments,
  confirmedBeforeReview, createComplaint, createLot, decideLot, decisionErrors, designByNo, disposeNcr, dispositionErrors,
  evaluateSupplier, gaugeByCode, indicators, lotByNo, nextStage, overallSatisfaction, pendingInspections, purchasingGrade,
  recordCalibration, recordResults, recordStage, recordSurvey, requirementErrors, resultErrors, reviewRequirement,
  stageErrors, startDesign, supplierQuality, surveyErrors, unreviewed,
} from "../../demo/modules/qm/data";
import { MATERIALS, STOCK_MOVES, VENDORS, orderProblems, postGoodsReceipt } from "../../demo/modules/mm/data";

/**
 * บริหารคุณภาพตาม ISO 9001:2015 — แต่ละข้อกำหนดทดสอบผ่านงานที่ทำได้จริงในระบบ
 * ค่าที่คาดหวังคิดจากข้อกำหนดและข้อมูลตั้งต้น ไม่ได้คิดแบบเดียวกับโค้ด
 * เทสต์ใช้ข้อมูลชุดเดียวกันและรันตามลำดับ เหมือนหนึ่งวันของฝ่ายประกันคุณภาพ
 */

const stock = (code: string) => MATERIALS.find((m) => m.code === code)!.stock;
const all = { spec: true, capacity: true, delivery: true, legal: true };

describe("the indicators the quality overview and the management review read", () => {
  it("are measured from the work in the system at cold start", () => {
    const o = Object.fromEntries(indicators().map((x) => [x.name, x]));
    // ตรวจรับ: 0041 ผ่าน, 0042 ผ่าน, 0043 ไม่ผ่าน → 2/3
    expect(o["ของเข้าผ่านการตรวจรับ"]).toMatchObject({ actual: 66.7, met: false });
    // ตรวจก่อนส่ง: 0039 ผ่าน, 0040 ยอมรับแบบมีเงื่อนไข → 1/2
    expect(o["สินค้าผ่านการตรวจก่อนส่งครั้งแรก"]).toMatchObject({ actual: 50, met: false });
    expect(o["ข้อร้องเรียนลูกค้าเดือนนี้"]).toMatchObject({ actual: 1, met: true });
    // ใบเสนอราคา 2 ใบ + ใบสั่งขาย 5 ใบ ทบทวนแล้ว 4 → 4/7
    expect(o["ข้อตกลงกับลูกค้าที่ทบทวนแล้ว"]).toMatchObject({ actual: 57.1, met: false });
    // เครื่องมือใช้งาน 5 ตัว ไมโครมิเตอร์เลยรอบ 10/09 → 4/5
    expect(o["เครื่องมือวัดอยู่ในรอบสอบเทียบ"]).toMatchObject({ actual: 80, met: false });
  });

  it("feeds the management review of the integrated system", () => {
    const keys = liveAgenda().map((a) => a.key);
    expect(keys).toEqual(expect.arrayContaining(["ims-audits", "qm-customers", "qm-conformity", "qm-suppliers", "qm-resources"]));
  });
});

describe("customer requirements (8.2)", () => {
  it("lists every commitment nobody has reviewed", () => {
    expect(unreviewed().map((c) => c.doc)).toEqual(["QT-2569-0232", "SO-2569-0416", "SO-2569-0415"]);
    expect(confirmedBeforeReview().map((c) => c.doc)).toEqual(["SO-2569-0416", "SO-2569-0415"]);
    expect(commitments()).toHaveLength(7);
  });

  it("does not accept outright what fails a check", () => {
    const input = { doc: "QT-2569-0232", by: "ชลธิชา มั่นคง", checks: { ...all, capacity: false }, special: "", result: "รับได้" as const, note: "" };
    expect(requirementErrors(input).result).toContain("กำลังการผลิต");
    expect(requirementErrors({ ...input, result: "รับได้แบบมีเงื่อนไข" }).note).toContain("เงื่อนไข");
    reviewRequirement({ ...input, result: "รับได้แบบมีเงื่อนไข", note: "ส่งรถเข็น 2 คันก่อน ที่เหลือส่งตามใน 14 วัน ลูกค้ารับทราบ" });
    expect(unreviewed().map((c) => c.doc)).toEqual(["SO-2569-0416", "SO-2569-0415"]);
    expect(requirementErrors({ ...input, result: "รับได้แบบมีเงื่อนไข", note: "ซ้ำ" }).doc).toContain("ทบทวนแล้ว");
  });
});

describe("design and development (8.3)", () => {
  it("does not skip a stage or let designers verify their own work", () => {
    const d = designByNo("DP-2569-02");
    expect(nextStage(d)).toBe("ทบทวนการออกแบบ");
    expect(stageErrors(d.no, { by: "ศักดิ์ชัย วงศ์ไทย", evidence: "ทบทวนแบบกับทีมแล้วไม่มีข้อแก้", participants: ["ศักดิ์ชัย วงศ์ไทย"] }).participants).toContain("หน้าที่อื่น");
    recordStage(d.no, { by: "ศักดิ์ชัย วงศ์ไทย", evidence: "ย้ายคันโยกไปด้านขวาตามข้อเสนอฝ่ายผลิต", participants: ["ศักดิ์ชัย วงศ์ไทย", "อนุชา ทองดี"] });
    expect(nextStage(d)).toBe("ทวนสอบ");
    expect(stageErrors(d.no, { by: "ศักดิ์ชัย วงศ์ไทย", evidence: "ทดสอบยก 300 กก. 100 รอบ ไม่รั่ว", participants: [] }).by).toContain("ไม่ใช่ผู้ออกแบบ");
  });

  it("controls a change only after the design is released", () => {
    expect(changeErrors("DP-2569-02", { change: "เปลี่ยนล้อเป็นยาง PU", reason: "ลดเสียง", approvedBy: QMR, reverified: false }).change).toContain("ยังไม่ส่งมอบ");
    expect(changeErrors("DP-2569-01", { change: "เปลี่ยนล้อเป็นยาง PU", reason: "ลดเสียง", approvedBy: "ศักดิ์ชัย วงศ์ไทย", reverified: false }).approvedBy).toContain(QMR);
    const d = startDesign({ product: "โต๊ะปรับระดับไฟฟ้า", owner: "ศักดิ์ชัย วงศ์ไทย", target: "2027-03-31", inputs: "ปรับสูง 650–1,250 มม. รับ 80 กก. เสียงมอเตอร์ไม่เกิน 50 dB ตาม มอก. 1167" });
    expect(d).toMatchObject({ no: "DP-2569-03", records: [{ stage: "ข้อมูลเข้า" }] });
  });
});

describe("inspection and release (8.6)", () => {
  it("lists what purchasing received but nobody has inspected yet", () => {
    expect(pendingInspections()).toEqual([
      { origin: "ตรวจรับ", source: "GR-2569-197", ref: "PO-2569-112", material: "MAT-2002", qty: 200, date: "2026-08-28", vendor: "V-004" },
    ]);
  });

  it("picks up a receipt the moment purchasing books it", () => {
    const gr = postGoodsReceipt({ po: "PO-2569-119", date: "2026-09-22", deliveryNote: "DN-5561", receivedBy: "วรวุฒิ พึ่งบุญ", lines: [{ material: "MAT-1003", qty: 6 }] });
    const p = pendingInspections().find((x) => x.source === gr.no)!;
    expect(p).toMatchObject({ origin: "ตรวจรับ", material: "MAT-1003", qty: 6, vendor: "V-003" });
    const l = createLot(p);
    expect(l).toMatchObject({ no: "IL-2569-0045", sample: 6, status: "รอตรวจ" });
    expect(() => createLot(p)).toThrow("เปิดล็อตตรวจไปแล้ว");
  });

  it("judges each characteristic against the plan, not against the inspector", () => {
    expect(resultErrors("IL-2569-0045", [])).toMatchObject({ ความหนืด: expect.any(String) });
    recordResults("IL-2569-0045", [{ characteristic: "ความหนืด", min: 19, max: 25 }, { characteristic: "สีตรงตามแผ่นเทียบ RAL 7035", defects: 0 }], "สุภาพร แก้วมณี");
    const l = lotByNo("IL-2569-0045");
    expect(l.results.map((r) => r.ok)).toEqual([false, true]); // 25 วินาทีเกิน USL 24
    expect(decisionErrors(l.no, "ผ่าน", QMR, "").decision).toContain("ตัดสินผ่านไม่ได้");
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
    const before = stock("FG-5001");
    disposeNcr(c.no, { disposition: "ซ่อมหรือทำใหม่", by: QMR, note: "ส่งช่างขันน็อตใหม่ที่หน้างาน" });
    expect(stock("FG-5001")).toBe(before);
    expect(closeNcrErrors(c.no).close).toContain("CAR");
  });

  it("closes a severe NCR once the integrated system holds a CAR against it", () => {
    const n = NCRS[NCRS.length - 1];
    const car = openCapa({ method: "5 Why", std: "ISO 9001", ref: n.no, problem: "น็อตยึดชั้นหลวมเมื่อถึงมือลูกค้า", owner: "อนุชา ทองดี", team: [] });
    expect(carOfNcr(n)?.no).toBe(car.no);
    closeNcr(n.no, QMR);
    expect(n.status).toBe("ปิดแล้ว");
  });
});

describe("external providers (8.4)", () => {
  it("reads the purchasing grade instead of scoring vendors twice", () => {
    expect(purchasingGrade("V-001")).toBe("A"); // (5+4+4+4)/4 × 20 = 85
    expect(purchasingGrade("V-002")).toBe("B"); // (4+3+5+3)/4 × 20 = 75
    expect(supplierQuality("V-002")).toMatchObject({ lots: 1, accepted: 0, score: 0, ncrs: 1 });
  });

  it("suspends a supplier in purchasing too, so nobody can order from them", () => {
    const input = { vendor: "V-002", status: "อนุมัติ" as const, scope: ["MAT-1002"], note: "ประเมินหลังล็อตไม่ผ่าน", by: QMR };
    expect(approvalErrors(input).status).toContain("ต่ำกว่า 90%");
    evaluateSupplier({ ...input, status: "ระงับ", note: "เหล็กเส้นไม่ได้ขนาดซ้ำ รอผลแก้ไขจากผู้ขาย" });
    expect(VENDORS.find((v) => v.code === "V-002")!.blocked).toBe(true);
    const po = { vendor: "V-002", date: "2026-09-22", deliverBy: "2026-09-30", note: "", lines: [{ material: "MAT-1002", qty: 10, price: 420 }] };
    expect(orderProblems(po).vendor).toContain("ระงับ");
    evaluateSupplier({ ...input, status: "อนุมัติแบบมีเงื่อนไข", note: "ผู้ขายเปลี่ยนแม่พิมพ์รีดแล้ว ให้ส่งผลวัดทุกล็อต" });
    expect(orderProblems(po).vendor).toBeUndefined();
  });
});

describe("customer satisfaction (9.1.2)", () => {
  it("averages each customer's latest survey", () => {
    // 4.4, 3.6, 3.8, 2.8 → 3.65
    expect(overallSatisfaction()).toBe(3.65);
  });

  it("insists on a follow-up when a customer is unhappy", () => {
    const low = { customer: "C-104", period: "ครึ่งปีหลัง 2569", scores: { quality: 3, delivery: 3, price: 4, service: 3, complaint: 3 }, comment: "", by: "ชลธิชา มั่นคง" };
    expect(surveyErrors(low).followUp).toContain("3.5");
    recordSurvey({ ...low, followUp: "เยี่ยมร้านทุกเดือนและส่งของรอบเช้า" });
    expect(surveyErrors({ ...low, followUp: "ซ้ำ ๆ ๆ ๆ ๆ ๆ" }).customer).toContain("ตอบแบบสำรวจ");
  });
});

describe("calibration (7.1.5)", () => {
  it("knows which instruments are overdue or due soon", () => {
    expect(calState(gaugeByCode("QC-MC-01"))).toBe("เกินกำหนด");
    expect(calState(gaugeByCode("QC-CT-01"))).toBe("ใกล้ครบ");
    expect(calState(gaugeByCode("QC-VC-01"))).toBe("ปกติ");
  });

  it("suspends a failed instrument and reopens the results it measured", () => {
    const { gauge, ncr } = recordCalibration("QC-MC-01", {
      date: "2026-09-22", by: "บจก. ไทยแคลิเบรชั่น", certNo: "TC-26-02290", result: "ไม่ผ่าน", error: "+0.021 มม.", note: "ค่าคลาดเคลื่อนเกินเกณฑ์ ±0.004 มม.",
    });
    expect(gauge.status).toBe("พักใช้");
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
