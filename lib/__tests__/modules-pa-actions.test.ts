import { describe, expect, it } from "vitest";
import {
  EMPLOYEES, PERSONNEL_ACTIONS, approveAction, documentsOf, employeeOf, hireEmployee, issueLetter, nextLetterNo,
  passProbation, recordSeparation, rejectAction, renewContract, requestAction, requestRaises, setDocumentReceived,
  severanceDaysFor, ssoContribution, updateAdmin, updatePersonal,
} from "../../demo/modules/pa/data";
import type { HireInput } from "../../demo/modules/pa/data";

/**
 * The personnel register's buttons, held to the rules an HR officer would check
 * them against: the Labour Protection Act's severance tiers, a 119-day probation,
 * running employee codes, and an approval that changes only what it approved.
 * Every expected figure is worked out from the rule, not from the code.
 */

const hire = (over: Partial<HireInput> = {}): HireInput => ({
  name: "ศิริพร ใจดี",
  nickname: "พร",
  gender: "หญิง",
  birthDate: "1998-04-12",
  nationalId: "1-1037-00123-45-6",
  phone: "081-555-0101",
  email: "siriporn@example.co.th",
  address: "12/3 ถ.สุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพฯ 10110",
  position: "เจ้าหน้าที่จัดซื้อ",
  department: "ฝ่ายจัดซื้อ",
  type: "พนักงานประจำ",
  startedAt: "2026-10-01",
  endsAt: null,
  baseSalary: 23000,
  workDays: "จันทร์–ศุกร์",
  ssoNumber: "9012345678",
  bankName: "กสิกรไทย",
  bankAccount: "xxx-x-x4455-6",
  pvdRate: 3,
  documents: ["สำเนาบัตรประชาชน"],
  ...over,
});

describe("hiring", () => {
  it("gives the next employee code and puts the person in the list every module reads", () => {
    const list = EMPLOYEES;
    const e = hireEmployee(hire());

    expect(e.code).toBe("EMP-0009");
    expect(EMPLOYEES).toBe(list);
    expect(EMPLOYEES.find((x) => x.code === "EMP-0009")?.name).toBe("ศิริพร ใจดี");
    expect(hireEmployee(hire({ name: "ธนวัฒน์ มีสุข", nationalId: "1-1037-00999-45-1", startedAt: "2026-07-01" })).code).toBe("EMP-0010");
  });

  it("starts on a 119-day probation, day one being the first day at work", () => {
    const e = EMPLOYEES.find((x) => x.code === "EMP-0009")!;
    // 1 Oct + 118 days: 30 left in October, 30 in November, 31 in December, 27 in January.
    expect(e.status).toBe("ทดลองงาน");
    expect(e.contract.probationUntil).toBe("2027-01-27");
  });

  it("files the tax id as the national id and flags the documents not handed in", () => {
    const e = EMPLOYEES.find((x) => x.code === "EMP-0009")!;
    expect(e.admin.taxId).toBe("1103700123456");
    expect(e.benefits).toContain("กองทุนสำรองเลี้ยงชีพ 3%");
    expect(documentsOf(e).filter((d) => d.done).map((d) => d.name)).toEqual(["สำเนาบัตรประชาชน"]);
  });

  it("refuses a hire without a surname and adds nobody", () => {
    const before = EMPLOYEES.length;
    expect(() => hireEmployee(hire({ name: "สมหญิง" }))).toThrow();
    expect(EMPLOYEES.length).toBe(before);
  });

  it("confirms a probationer once they have started, and only once", () => {
    // EMP-0009 starts on 1 Oct; nobody passes probation before their first day.
    expect(() => passProbation(EMPLOYEES.find((x) => x.code === "EMP-0009")!.id)).toThrow();
    const e = EMPLOYEES.find((x) => x.code === "EMP-0010")!;
    passProbation(e.id);
    expect(e.status).toBe("ทำงานอยู่");
    expect(e.events.at(-1)?.type).toBe("ผ่านทดลองงาน");
    expect(() => passProbation(e.id)).toThrow();
  });
});

describe("personnel actions", () => {
  it("records a transfer only when approved, as an event dated when it takes effect", () => {
    const a = requestAction({
      employeeId: 3,
      kind: "ย้ายแผนก",
      effectiveDate: "2026-10-01",
      to: { department: "ฝ่ายจัดซื้อ", position: "เจ้าหน้าที่จัดซื้อ", salary: 18000 },
      reason: "เสริมงานจัดซื้อที่ขาดคน",
    });
    // The year's requests so far run to HR-2569-0015.
    expect(a.id).toBe("HR-2569-0016");
    expect(employeeOf(3).department).toBe("ฝ่ายคลัง");

    approveAction(a.id);
    const e = employeeOf(3);
    expect(e.department).toBe("ฝ่ายจัดซื้อ");
    expect(e.position).toBe("เจ้าหน้าที่จัดซื้อ");
    expect(e.contract.baseSalary).toBe(18000);
    expect(e.events.find((ev) => ev.type === "ย้ายแผนก")).toEqual({
      date: "2026-10-01",
      type: "ย้ายแผนก",
      detail: "ฝ่ายคลัง → ฝ่ายจัดซื้อ · ตำแหน่ง พนักงานคลังสินค้า → เจ้าหน้าที่จัดซื้อ",
    });
  });

  it("changes only what a request asked for, even when approved after another", () => {
    // The raise was filed while the person was still in the warehouse; approving it
    // after the transfer must not move them back.
    approveAction("HR-2569-0014");
    const e = employeeOf(3);
    expect(e.contract.baseSalary).toBe(19500);
    expect(e.department).toBe("ฝ่ายจัดซื้อ");
    expect(() => approveAction("HR-2569-0014")).toThrow();
  });

  it("needs a reason to decline, and declining leaves the record alone", () => {
    const a = requestAction({
      employeeId: 4,
      kind: "ปรับเงินเดือน",
      effectiveDate: "2026-10-01",
      to: { department: "ฝ่ายบุคคล", position: "เจ้าหน้าที่บุคคล", salary: 40000 },
      reason: "ขอปรับตามตลาด",
    });
    expect(() => rejectAction(a.id, "")).toThrow();
    rejectAction(a.id, "เกินกรอบของระดับ");
    expect(employeeOf(4).contract.baseSalary).toBe(25000);
    expect(PERSONNEL_ACTIONS.find((x) => x.id === a.id)?.status).toBe("ไม่อนุมัติ");
  });

  it("files an annual raise per person, rounded to ten baht, skipping anyone with one pending", () => {
    const made = requestRaises([4, 5], 5, "2026-10-01", "ปรับเงินเดือนประจำปี 2570");
    // 25,000 + 5% = 26,250 · 21,000 + 5% = 22,050
    expect(made.map((a) => a.to.salary)).toEqual([26250, 22050]);
    expect(requestRaises([4], 5, "2026-10-01", "ปรับเงินเดือนประจำปี 2570")).toEqual([]);
  });
});

describe("leaving", () => {
  it.each([
    ["2026-01-01", "2026-04-29", 0], // day 119: still inside probation
    ["2026-01-01", "2026-04-30", 30], // day 120
    ["2020-03-04", "2021-03-02", 30],
    ["2020-03-04", "2021-03-03", 90], // one full year
    ["2020-03-04", "2023-03-02", 90],
    ["2020-03-04", "2023-03-03", 180],
    ["2020-03-04", "2026-03-03", 240],
    ["2010-01-01", "2019-12-31", 300],
    ["2000-01-01", "2019-12-30", 300],
    ["2000-01-01", "2019-12-31", 400],
  ])("started %s, last day %s → %i days' severance (section 118)", (start, last, days) => {
    expect(severanceDaysFor(start, last)).toBe(days);
  });

  it("pays severance for the tenure when the company terminates with full notice", () => {
    // Started 4 Mar 2019, last day 22 Oct 2026: seven full years → 240 days at 45,000 / 30.
    const s = recordSeparation(1, { kind: "เลิกจ้าง", noticeDate: "2026-09-22", lastDay: "2026-10-22", reason: "ปรับโครงสร้างองค์กร" });
    expect(s.severanceDays).toBe(240);
    expect(s.severance).toBe(360000);
    expect(s.noticePay).toBe(0);
    const e = employeeOf(1);
    expect(e.status).toBe("ลาออก");
    expect(e.events.at(-1)).toMatchObject({ date: "2026-10-22", type: "เลิกจ้าง" });
  });

  it("adds a month's pay in lieu when the company lets someone go without notice", () => {
    // Six full years (15 Jul 2020 – 22 Sep 2026) → 240 days at 38,000 / 30; no notice → 30 days' pay.
    const s = recordSeparation(2, { kind: "เลิกจ้าง", noticeDate: "2026-09-22", lastDay: "2026-09-22", reason: "ยุบหน่วยงาน" });
    expect(s.severance).toBe(304000);
    expect(s.noticePay).toBe(38000);
  });

  it("owes nothing to someone dismissed for cause under section 119", () => {
    const s = recordSeparation(7, { kind: "เลิกจ้างตามมาตรา 119", noticeDate: "2026-09-22", lastDay: "2026-09-22", reason: "ทุจริตต่อหน้าที่" });
    expect(s.severance + s.noticePay).toBe(0);
  });

  it("owes nothing to someone who resigns, and closes what they had pending", () => {
    const s = recordSeparation(6, { kind: "ลาออก", noticeDate: "2026-09-22", lastDay: "2026-10-22", reason: "ได้งานใหม่" });
    expect(s.severance + s.noticePay).toBe(0);
    expect(PERSONNEL_ACTIONS.find((a) => a.id === "HR-2569-0015")?.status).toBe("ไม่อนุมัติ");
    expect(() => recordSeparation(6, { kind: "ลาออก", noticeDate: "2026-09-22", lastDay: "2026-10-22", reason: "ซ้ำ" })).toThrow();
  });
});

describe("contracts, records and letters", () => {
  it("renews a fixed-term contract forward only", () => {
    renewContract(5, "2028-09-17");
    expect(employeeOf(5).contract.endsAt).toBe("2028-09-17");
    expect(employeeOf(5).events.at(-1)?.type).toBe("ต่อสัญญา");
    expect(() => renewContract(5, "2028-01-01")).toThrow();
  });

  it("keeps the tax id with the national id when personal data is corrected", () => {
    const e = employeeOf(4);
    updatePersonal(4, {
      name: "ปรียา แก้วใส", nickname: "ยา", gender: "หญิง", birthDate: "1993-05-19", nationalId: "1-1005-00778-33-8",
      phone: "086-111-2233", email: "preeya@example.co.th", address: e.personal.address,
    });
    expect(e.admin.taxId).toBe("1100500778338");
    expect(() => updatePersonal(4, { ...e.personal, name: e.name, nickname: e.nickname, gender: "หญิง", phone: "1234" })).toThrow();
  });

  it("shows the provident fund in the benefits at the rate on file", () => {
    updateAdmin(4, { ...employeeOf(4).admin, pvdRate: 3 });
    expect(employeeOf(4).benefits).toContain("กองทุนสำรองเลี้ยงชีพ 3%");
    expect(employeeOf(4).benefits).not.toContain("กองทุนสำรองเลี้ยงชีพ 5%");
  });

  it("marks a document received", () => {
    setDocumentReceived(5, "ผลตรวจสุขภาพ", true);
    expect(documentsOf(employeeOf(5)).filter((d) => !d.done).map((d) => d.name)).toEqual(["หนังสือรับรองการทำงานเดิม"]);
  });

  it("numbers letters on from the last one issued this year", () => {
    expect(nextLetterNo()).toBe("HR 042/2569");
    expect(issueLetter(3, "หนังสือรับรองเงินเดือน", "ประกอบการขอสินเชื่อ").no).toBe("HR 042/2569");
    expect(nextLetterNo()).toBe("HR 043/2569");
    // A salary certificate says what someone earns now — a leaver earns nothing here.
    expect(() => issueLetter(8, "หนังสือรับรองเงินเดือน", "ประกอบการขอสินเชื่อ")).toThrow();
  });

  it("caps social security at 5% of a 15,000 baht base", () => {
    expect(ssoContribution(45000)).toBe(750);
    expect(ssoContribution(12000)).toBe(600);
    expect(ssoContribution(1000)).toBe(83);
  });
});
