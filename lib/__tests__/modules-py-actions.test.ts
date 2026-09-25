import { describe, expect, it } from "vitest";
import { EMPLOYEES, hireEmployee } from "../../demo/modules/pa/data";
import { commit } from "../../demo/modules/kit";
import {
  CLAIMS, addAdjustment, approveClaim, approvePeriod, bankFile, bankOf, cert50, createPeriod, defaultPayDate,
  fileClaim, markPaid, missingFrom, periodById, periodCost, reopenPeriod, runPayroll, setVariable, slipsFor,
  workDaysOf,
} from "../../demo/modules/py/data";
import type { VariableDraft } from "../../demo/modules/py/data";

/**
 * Payroll, held to the figures a Thai payroll officer works out by hand. The
 * expected numbers below are worked from the rules — social security 5% of at
 * most 15,000, the annual tax table after the 50%/100,000 expense deduction and
 * the 60,000 personal allowance, the provident fund rate on the personnel file —
 * and written down, not produced by calling the code under test.
 *
 * The tests run in order and share the demo's records: September is closed
 * first, which is what lets October open.
 */

const quiet: VariableDraft = {
  absentDays: "0",
  unpaidDays: "0",
  lateMinutes: "0",
  otHours: "0",
  holidayOtHours: "0",
  note: "ตรวจกับใบลงเวลาแล้ว",
};

const slipOf = (periodId: number, employeeId: number) => {
  const s = slipsFor(periodId).find((x) => x.employeeId === employeeId);
  if (!s) throw new Error(`no slip for ${employeeId} in ${periodId}`);
  return s;
};

describe("closing September", () => {
  it("will not open October while September is still under review", () => {
    expect(() => createPeriod({ month: "2026-10", payDate: "2026-10-23" })).toThrow(/อนุมัติ/);
  });

  it("will not approve a period with benefit claims still waiting", () => {
    expect(() => approvePeriod(1)).toThrow(/ใบเบิกสวัสดิการ/);
  });

  it("adds an approved claim to the slip as tax-free income", () => {
    // ณัฐพล ค่ารักษาพยาบาล 1,650 บาท รออนุมัติในงวดกันยายน — ยกเว้นภาษี
    const before = slipOf(1, 3);
    approveClaim(3);
    const after = slipOf(1, 3);
    expect(after.netPay - before.netPay).toBe(1650);
    expect(after.tax).toBe(before.tax);
    approveClaim(4);
  });

  it("freezes the slips when the period is approved", () => {
    approvePeriod(1);
    expect(periodById(1).status).toBe("อนุมัติแล้ว");

    const net = slipOf(1, 4).netPay;
    const ปรียา = EMPLOYEES.find((e) => e.id === 4)!;
    const was = ปรียา.contract.baseSalary;
    commit(() => (ปรียา.contract.baseSalary = 30000));
    try {
      expect(slipOf(1, 4).netPay).toBe(net);
    } finally {
      commit(() => (ปรียา.contract.baseSalary = was));
    }
  });

  it("refuses every edit once locked", () => {
    expect(() => setVariable(1, 1, { ...quiet, lateMinutes: "5" })).toThrow(/ล็อก/);
    expect(() => addAdjustment({ periodId: 1, employeeId: 1, kind: "โบนัส", amount: "1000", note: "ปิดงวดแล้ว" })).toThrow(/ล็อก/);
    expect(() =>
      fileClaim({ periodId: 1, employeeId: 1, type: "ค่าทันตกรรม", amount: "500", receiptDate: "2026-09-20", detail: "ขูดหินปูน" })
    ).toThrow(/ล็อก/);
    // สิงหาคมจ่ายไปแล้ว
    expect(() => setVariable(2, 1, quiet)).toThrow(/ล็อก/);
  });

  it("makes a bank file whose total is the net pay of everyone paid by transfer", () => {
    const file = bankFile(1);
    const slips = slipsFor(1);
    const byTransfer = slips.filter((s) => bankOf(s.employeeId).method === "โอนเข้าบัญชี");
    // ธีรศักดิ์รับเงินสด ไม่อยู่ในไฟล์โอน
    expect(file.rows.map((r) => r.code)).not.toContain("EMP-0007");
    expect(file.count).toBe(byTransfer.length);
    for (const r of file.rows) expect(r.amount).toBe(slips.find((s) => s.employee.code === r.code)!.netPay);
    expect(file.total).toBe(file.rows.reduce((n, r) => n + r.amount, 0));
    expect(file.total + slipOf(1, 7).netPay).toBe(periodCost(1).net);
  });

  it("can be reopened with a reason, and locked again", () => {
    reopenPeriod(1, "แก้ค่าล่วงเวลาที่คีย์ผิดของฝ่ายคลัง");
    expect(periodById(1).status).toBe("รอตรวจสอบ");
    expect(() => bankFile(1)).toThrow(/อนุมัติ/);
    setVariable(1, 3, { ...quiet, otHours: "16", absentDays: "1", note: "แก้ล่วงเวลาตามใบลงเวลาที่หัวหน้าเซ็น" });
    approvePeriod(1);
  });

  it("is paid only once approved, and then counts on the annual certificate", () => {
    expect(cert50(1, "2026").periods.map((p) => p.month)).toEqual(["2026-07", "2026-08"]);
    markPaid(1);
    expect(periodById(1).status).toBe("จ่ายแล้ว");
    expect(cert50(1, "2026").periods.map((p) => p.month)).toEqual(["2026-07", "2026-08", "2026-09"]);
  });
});

describe("running payroll for October", () => {
  let october = 0;

  it("opens the next month with the working days and the usual pay date", () => {
    // ต.ค. 2569 มีวันจันทร์ถึงศุกร์ 22 วัน · 25 ต.ค. เป็นวันอาทิตย์ จ่ายวันศุกร์ที่ 23
    expect(workDaysOf("2026-10")).toBe(22);
    expect(defaultPayDate("2026-10")).toBe("2026-10-23");
    const p = createPeriod({ month: "2026-10", payDate: defaultPayDate("2026-10") });
    october = p.id;
    expect(p).toMatchObject({ label: "งวดเดือนตุลาคม 2569", status: "กำลังคำนวณ", workDays: 22 });
    expect(() => bankFile(october)).toThrow(/อนุมัติ/);
  });

  it("gives net pay = gross − social security − tax − provident fund, with social security capped at 750", () => {
    runPayroll(october);
    expect(periodById(october).status).toBe("รอตรวจสอบ");

    // สมชาย: เงินเดือน 45,000 ค่าตำแหน่ง 5,000 (คิดภาษี) ค่าน้ำมัน 3,000 (ยกเว้น) กองทุน 5%
    // ประกันสังคม 5% ของ 15,000 = 750 (ไม่ใช่ 5% ของ 45,000 = 2,250)
    // เงินได้ทั้งปี 600,000 − ค่าใช้จ่าย 100,000 − ลดหย่อน 60,000 − ประกันสังคม 9,000
    // − กองทุน 27,000 = 404,000 → ภาษี 7,500 + 10,400 = 17,900 ต่อปี = 1,492 ต่อเดือน
    const s = slipOf(october, 1);
    expect(s.gross).toBe(53000);
    expect(s.sso).toBe(750);
    expect(s.pvd).toBe(2250);
    expect(s.tax).toBe(1492);
    expect(s.netPay).toBe(53000 - 750 - 1492 - 2250);
  });

  it("taxes a bonus by what it adds to the year, not as if it came every month", () => {
    // วิภาดา: เงินเดือน 38,000 ค่าวิชาชีพ 2,000 กองทุน 5% (1,900)
    // ปกติ: 480,000 − 100,000 − 60,000 − 9,000 − 22,800 = 288,200 → ภาษีปีละ 6,910 → เดือนละ 576
    // โบนัส 30,000: 318,200 → ภาษีปีละ 9,320 → ส่วนเพิ่ม 2,410
    addAdjustment({ periodId: october, employeeId: 2, kind: "โบนัส", amount: "30000", note: "โบนัสผลงานครึ่งปีแรก" });
    const s = slipOf(october, 2);
    expect(s.tax).toBe(576 + 2410);
    expect(s.gross).toBe(70000);
    expect(s.netPay).toBe(70000 - 750 - 2986 - 1900);
  });

  it("keeps deductions from wages within a fifth of the wage", () => {
    // ณัฐพล เงินเดือน 18,000 หักได้รวมไม่เกิน 3,600
    expect(() =>
      addAdjustment({ periodId: october, employeeId: 3, kind: "หักอื่น ๆ", amount: "4000", note: "ค่าเสียหายสินค้าแตก" })
    ).toThrow(/หนึ่งในห้า/);
  });

  it("deducts an absent day at the salary divided by the period's working days", () => {
    // ปรียา 25,000 / 22 วัน = 1,136.36 → 1,136
    setVariable(october, 4, { ...quiet, absentDays: "1", note: "ขาดงาน 5 ต.ค. ไม่แจ้ง" });
    const s = slipOf(october, 4);
    expect(s.absenceCut).toBe(1136);
    expect(s.netPay).toBe(s.gross - s.absenceCut - s.sso - s.pvd - s.tax);
  });

  it("refuses a claim beyond the yearly limit", () => {
    expect(() =>
      fileClaim({ periodId: october, employeeId: 1, type: "ค่าตัดแว่นสายตา", amount: "3500", receiptDate: "2026-09-20", detail: "แว่นกรองแสง" })
    ).toThrow(/เกินวงเงิน/);
  });

  it("picks up somebody hired through the personnel register at once, on a pro-rated salary", () => {
    const hire = hireEmployee({
      name: "ทดสอบ รับใหม่", nickname: "ใหม่", gender: "ชาย", birthDate: "1999-05-05", nationalId: "1-1037-00999-45-1",
      phone: "081-555-6666", email: "new@example.co.th", address: "45 ถนนพหลโยธิน แขวงสามเสนใน เขตพญาไท กรุงเทพฯ 10400",
      position: "พนักงานขาย", department: "ฝ่ายขาย", type: "พนักงานประจำ", startedAt: "2026-10-16", endsAt: null,
      baseSalary: 20000, workDays: "จันทร์–ศุกร์", ssoNumber: "9876543210", bankName: "กรุงศรีอยุธยา",
      bankAccount: "xxx-x-x5555-0", pvdRate: 0, documents: [],
    });

    // อยู่ในงวดที่ยังเปิดทันที ไม่ต้องคีย์ซ้ำ · งวดที่จ่ายไปแล้วไม่เปลี่ยน
    expect(slipsFor(october).map((s) => s.employeeId)).toContain(hire.id);
    expect(slipsFor(1).map((s) => s.employeeId)).not.toContain(hire.id);
    expect(missingFrom(october).map((e) => e.id)).toEqual([hire.id]);
    expect(runPayroll(october).added.map((e) => e.id)).toEqual([hire.id]);

    // เงินเดือนจากสัญญาในทะเบียนพนักงาน 20,000 · 16–31 ต.ค. คือ 16 จาก 31 วัน
    // 20,000 × 16 / 31 = 10,322.58 → 10,323 · ประกันสังคม 5% ของ 10,323 = 516.15 → 516
    const s = slipOf(october, hire.id);
    expect(s.base).toBe(10323);
    expect(s.sso).toBe(516);
    expect(bankOf(hire.id)).toEqual({ bank: "กรุงศรีอยุธยา", account: "xxx-x-x5555-0", method: "โอนเข้าบัญชี" });
  });

  it("pays everyone in the bank file once approved", () => {
    approvePeriod(october);
    const file = bankFile(october);
    expect(file.rows.map((r) => r.name)).toContain("ทดสอบ รับใหม่");
    expect(file.total).toBe(periodCost(october).net - slipOf(october, 7).netPay);
    expect(CLAIMS.filter((c) => c.periodId === october)).toEqual([]);
  });
});
