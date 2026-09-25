import { describe, expect, it } from "vitest";
import { hireEmployee } from "../../demo/modules/pa/data";
import {
  LEAVES, PUNCHES, ROSTER, addHoliday, approveLeave, approveOt, approvePunchFix, approveSwap, assignRoster,
  attendanceOf, cancelLeave, fileLeave, isHoliday, judge, leaveBalance, leaveDaysOf, leaveErrors, leaveQuota,
  otErrors, otRateOn, rejectPunchFix, requestOt, requestPunchFix, requestSwap, rosterOf, rostered, setRosterShift, shiftOn,
  unrostered, updateLeave,
} from "../../demo/modules/tm/data";
import type { LeaveDraft } from "../../demo/modules/tm/data";

/**
 * Time and leave, held to the rules a Thai HR officer checks by hand: what a
 * leave request may take, when a corrected punch starts to count, and what the
 * labour law caps. Expected figures come from those rules — the quota, the
 * roster, the calendar — not from the code that applies them.
 *
 * The records are shared arrays and every test changes them, so each test works
 * on its own people and dates.
 */

const leave = (d: Partial<LeaveDraft> & Pick<LeaveDraft, "employeeId" | "type" | "from" | "to">): LeaveDraft => ({
  reason: "ธุระส่วนตัวที่ต้องไปเอง",
  certificate: false,
  ...d,
});

const punch = (employeeId: number, date: string) => {
  const p = PUNCHES.find((x) => x.employeeId === employeeId && x.date === date);
  if (!p) throw new Error(`no punch for ${employeeId} on ${date}`);
  return p;
};

describe("a leave request and the balance it draws on", () => {
  it("is refused when it asks for more days than are left", () => {
    // วิภาดา: ลากิจ 3 วันต่อปี ใช้ไปแล้ว 1 วัน (18 ก.ย.) จึงเหลือ 2 — ขอจันทร์ถึงพุธ 3 วันทำงาน
    const before = LEAVES.length;
    expect(() => fileLeave(leave({ employeeId: 2, type: "ลากิจ", from: "2026-10-19", to: "2026-10-21" }))).toThrow(
      /เกินสิทธิ์คงเหลือ/
    );
    expect(LEAVES).toHaveLength(before);
  });

  it("holds a waiting request against the balance, and approving it uses the days up", () => {
    const filed = fileLeave(leave({ employeeId: 2, type: "ลากิจ", from: "2026-10-19", to: "2026-10-19" }));
    expect(filed.status).toBe("รออนุมัติ");
    expect(leaveBalance(2, "ลากิจ")).toMatchObject({ quota: 3, used: 1, pending: 1, left: 2 });

    // 3 − 1 used − 1 waiting leaves one day; two more is too many even before approval.
    expect(leaveErrors(leave({ employeeId: 2, type: "ลากิจ", from: "2026-10-26", to: "2026-10-27" })).to).toMatch(
      /เกินสิทธิ์คงเหลือ/
    );

    approveLeave(filed.id);
    expect(leaveBalance(2, "ลากิจ")).toMatchObject({ used: 2, pending: 0, left: 1 });
  });

  it("gets its next running number after the last leave filed", () => {
    const top = Math.max(...LEAVES.map((l) => l.id));
    const filed = fileLeave(leave({ employeeId: 4, type: "ลาป่วย", from: "2026-11-09", to: "2026-11-09", reason: "นัดหมอฟันตามนัด" }));
    expect(filed.id).toBe(top + 1);
  });

  it("counts only the days the roster puts the person to work", () => {
    // กมลวรรณหยุดเสาร์อาทิตย์: ศุกร์ถึงจันทร์คือสองวันทำงาน
    expect(leaveDaysOf(6, "ลาป่วย", "2026-10-30", "2026-11-02")).toBe(2);
    // 23 ต.ค. วันปิยมหาราช ไม่หักสิทธิ์
    expect(leaveDaysOf(1, "ลาป่วย", "2026-10-22", "2026-10-23")).toBe(1);
    // ลาคลอดนับต่อเนื่องทุกวันตามกฎหมาย
    expect(leaveDaysOf(6, "ลาคลอด", "2026-10-30", "2026-11-02")).toBe(4);
  });

  it("gives annual leave by length of service", () => {
    expect(leaveQuota(1, "ลาพักร้อน")).toBe(10); // เริ่มงาน มี.ค. 2562 เกินห้าปี
    expect(leaveQuota(5, "ลาพักร้อน")).toBe(8); // เริ่มงาน ก.ย. 2566 ครบสามปี
    expect(leaveQuota(6, "ลาพักร้อน")).toBe(6); // เริ่มงาน ก.พ. 2567 เกินหนึ่งปี
    expect(leaveQuota(6, "ลาป่วย")).toBe(30);
  });

  it("asks for a medical certificate from three working days of sick leave", () => {
    const draft = leave({ employeeId: 7, type: "ลาป่วย", from: "2026-11-02", to: "2026-11-04", reason: "ผ่าตัดไส้ติ่ง" });
    expect(leaveErrors(draft).certificate).toMatch(/ใบรับรองแพทย์/);
    expect(leaveErrors({ ...draft, certificate: true })).toEqual({});
  });

  it("will not overlap another request for the same person", () => {
    // เลขที่ 2: กมลวรรณลาพักร้อน 6–10 ต.ค. รออนุมัติอยู่
    expect(leaveErrors(leave({ employeeId: 6, type: "ลากิจ", from: "2026-10-08", to: "2026-10-08" })).from).toMatch(/ซ้อน/);
  });

  it("can be cancelled before it starts, which gives the days back", () => {
    const filed = fileLeave(leave({ employeeId: 4, type: "ลาป่วย", from: "2026-11-16", to: "2026-11-16", reason: "ตรวจสุขภาพประจำปี" }));
    approveLeave(filed.id);
    const used = leaveBalance(4, "ลาป่วย").used;
    cancelLeave(filed.id, "เลื่อนนัดโรงพยาบาลไปเดือนหน้า");
    expect(filed.status).toBe("ยกเลิก");
    expect(leaveBalance(4, "ลาป่วย").used).toBe(used - 1);
  });

  it("cannot be cancelled once the day has been taken", () => {
    // เลขที่ 5: สมชายลาป่วย 8 ก.ย. อนุมัติแล้ว
    expect(() => cancelLeave(5, "ขอยกเลิกย้อนหลัง")).toThrow(/ยกเลิกไม่ได้/);
  });

  it("can be edited while it waits, and not after", () => {
    const filed = fileLeave(leave({ employeeId: 7, type: "ลากิจ", from: "2026-11-05", to: "2026-11-05" }));
    updateLeave(filed.id, leave({ employeeId: 7, type: "ลากิจ", from: "2026-11-05", to: "2026-11-06" }));
    expect(filed.days).toBe(2);
    approveLeave(filed.id);
    expect(() => updateLeave(filed.id, leave({ employeeId: 7, type: "ลากิจ", from: "2026-11-05", to: "2026-11-05" }))).toThrow();
  });

  it("turns an absence into leave once approved for that day", () => {
    // ณัฐพลขาดงาน 7 ก.ย. แล้วยื่นลาป่วยย้อนหลังสำหรับวันนั้น
    const day = punch(3, "2026-09-07");
    const before = attendanceOf(3);
    expect(judge(day).state).toBe("ขาดงาน");
    const filed = fileLeave(leave({ employeeId: 3, type: "ลาป่วย", from: "2026-09-07", to: "2026-09-07", reason: "ไข้สูง ไปคลินิก" }));
    expect(judge(day).state).toBe("ขาดงาน");
    approveLeave(filed.id);
    expect(judge(day).state).toBe("ลา");
    expect(attendanceOf(3)).toMatchObject({ absent: before.absent - 1, leaveDays: before.leaveDays + 1, scheduled: before.scheduled });
  });
});

describe("a punch correction", () => {
  it("changes nothing until it is approved", () => {
    // สมชายไม่มีการตอกบัตร 16 ก.ย. ทั้งเข้าและออก
    const day = punch(1, "2026-09-16");
    const absent = attendanceOf(1).absent;
    expect(judge(day).state).toBe("ขาดงาน");

    const fix = requestPunchFix({ punchId: day.id, in: "07:58", out: "17:04", reason: "ลืมตอกบัตร หัวหน้ารับรองว่ามาทำงาน" });
    expect(judge(day).state).toBe("ขาดงาน");
    expect(attendanceOf(1).absent).toBe(absent);
    expect(fix.before).toEqual({ in: null, out: null });

    approvePunchFix(fix.id);
    // 07:58 ก่อนกะเช้า 08:00 จึงไม่สาย
    expect(judge(day)).toMatchObject({ state: "ปกติ", lateMin: 0 });
    expect(attendanceOf(1).absent).toBe(absent - 1);
  });

  it("is one at a time per day", () => {
    const day = punch(2, "2026-09-08");
    requestPunchFix({ punchId: day.id, in: "08:00", out: "17:00", reason: "สแกนไม่ติดตอนเช้า" });
    expect(() => requestPunchFix({ punchId: day.id, in: "07:50", out: "17:00", reason: "แก้เวลาอีกครั้ง" })).toThrow(/รออนุมัติ/);
  });

  it("leaves the day as it was when rejected", () => {
    const day = punch(4, "2026-09-08");
    const was = judge(day);
    // คำขอเลขที่ 2 ในข้อมูลตั้งต้น: ปรียาขอแก้เวลาเข้าวันที่ 8 ก.ย.
    rejectPunchFix(2, "ไม่พบบันทึกเครื่องขัดข้องจากฝ่ายอาคาร");
    expect(judge(day)).toEqual(was);
  });
});

describe("overtime", () => {
  it("is paid at 1.5 on a working day and 3 on a day off or a company holiday", () => {
    expect(otRateOn(7, "2026-10-12")).toBe(1.5); // จันทร์ กะเช้า
    expect(otRateOn(7, "2026-10-13")).toBe(3); // วันนวมินทรมหาราช
    expect(otRateOn(7, "2026-10-18")).toBe(3); // อาทิตย์ วันหยุดของกะ
  });

  it("stops at 36 hours in a week", () => {
    for (const date of ["2026-10-05", "2026-10-06", "2026-10-07"]) {
      approveOt(requestOt({ employeeId: 7, date, hours: "12", reason: "ย้ายคลังสินค้า" }).id);
    }
    expect(otErrors({ employeeId: 7, date: "2026-10-08", hours: "1", reason: "ย้ายคลังสินค้า" }).hours).toMatch(/36/);
    // สัปดาห์ถัดไปนับใหม่
    expect(otErrors({ employeeId: 7, date: "2026-10-12", hours: "4", reason: "ย้ายคลังสินค้า" })).toEqual({});
  });
});

describe("the roster", () => {
  it("must leave at least one day off a week", () => {
    expect(() => setRosterShift(1, 5, "A")).not.toThrow();
    // วันอาทิตย์คือวันหยุดสุดท้ายของสมชาย
    expect(() => setRosterShift(1, 6, "A")).toThrow(/วันหยุดประจำสัปดาห์/);
    expect(ROSTER[1][6]).toBe("O");
  });

  it("must stay within 48 hours a week", () => {
    // หกวันกะเช้า 8 ชม. = 48 ชม. พอดี · หกวันกะเช้าเปลี่ยนหนึ่งวันเป็นกะดึกก็ยัง 48
    expect(() => assignRoster(4, ["A", "A", "A", "A", "A", "A", "O"])).not.toThrow();
    expect(() => assignRoster(4, ["A", "A", "A", "A", "A", "A", "S"])).toThrow(/วันหยุดประจำสัปดาห์/);
  });

  it("puts somebody hired through the personnel register on the roster at once, on the days in their contract", () => {
    const hire = hireEmployee({
      name: "ศิริพร ใจดี", nickname: "พร", gender: "หญิง", birthDate: "1998-04-02", nationalId: "1-1037-00123-45-6",
      phone: "089-111-2222", email: "siriporn@example.co.th", address: "12/3 ถนนสุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพฯ 10110",
      position: "พนักงานคลังสินค้า", department: "ฝ่ายคลัง", type: "พนักงานประจำ", startedAt: "2026-09-21", endsAt: null,
      baseSalary: 16000, workDays: "จันทร์–ศุกร์", ssoNumber: "9012345678", bankName: "กรุงไทย", bankAccount: "xxx-x-x4444-1",
      pvdRate: 0, documents: [],
    });

    expect(rostered().map((e) => e.id)).toContain(hire.id);
    // สัญญาจันทร์–ศุกร์ จึงได้กะเช้าจันทร์ถึงศุกร์ หยุดเสาร์อาทิตย์ จนกว่าจะมีคนจัดกะให้
    expect(rosterOf(hire.id)).toEqual(["A", "A", "A", "A", "A", "O", "O"]);
    expect(unrostered().map((e) => e.id)).toContain(hire.id);
    expect(leaveDaysOf(hire.id, "ลาป่วย", "2026-10-30", "2026-11-02")).toBe(2);
    // ยังไม่ครบหนึ่งปีจึงไม่มีสิทธิ์พักร้อน
    expect(leaveErrors(leave({ employeeId: hire.id, type: "ลาพักร้อน", from: "2026-10-01", to: "2026-10-01" })).to).toMatch(/หนึ่งปี/);

    setRosterShift(hire.id, 5, "S");
    expect(ROSTER[hire.id]).toEqual(["A", "A", "A", "A", "A", "S", "O"]);
    expect(unrostered().map((e) => e.id)).not.toContain(hire.id);
  });
});

describe("a shift swap", () => {
  it("swaps the two shifts on that date once approved, and only then", () => {
    // 1 ต.ค. วันพฤหัส: วิภาดากะเช้า ณัฐพลกะบ่าย
    const date = "2026-10-01";
    const swap = requestSwap({ employeeId: 2, withEmployeeId: 3, date, reason: "ต้องไปรับลูกที่โรงเรียนช่วงเย็น" });
    expect([shiftOn(2, date), shiftOn(3, date)]).toEqual(["A", "B"]);
    approveSwap(swap.id);
    expect([shiftOn(2, date), shiftOn(3, date)]).toEqual(["B", "A"]);
    // วันอื่นเป็นไปตามตารางเดิม
    expect(shiftOn(2, "2026-10-02")).toBe("A");
  });
});

describe("a company holiday", () => {
  it("stops counting as a working day for leave", () => {
    expect(leaveDaysOf(2, "ลาพักร้อน", "2026-11-16", "2026-11-17")).toBe(2);
    addHoliday({ date: "2026-11-16", name: "วันหยุดชดเชยประจำปีของบริษัท" });
    expect(isHoliday("2026-11-16")).toBe(true);
    expect(leaveDaysOf(2, "ลาพักร้อน", "2026-11-16", "2026-11-17")).toBe(1);
  });

  it("cannot be added to a day already worked", () => {
    expect(() => addHoliday({ date: "2026-09-10", name: "ย้อนหลัง" })).toThrow();
  });
});
