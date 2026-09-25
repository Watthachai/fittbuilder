import { describe, expect, it } from "vitest";
import { approveAction, hireEmployee } from "../../demo/modules/pa/data";
import {
  ORG_UNITS, POSITIONS, REQUISITIONS, actingFor, approveRequisition, assignActing, assignHolder, createPosition,
  createUnit, holderFor, openRequisition, positionOf, rejectRequisition, releaseHolder, unitOf, updatePosition,
  updateUnit, vacancies,
} from "../../demo/modules/om/data";

/**
 * The org chart's buttons. A seat outlives whoever sits in it, the register
 * belongs to personnel records, and a vacancy is a seat with nobody in it — so
 * these check that filling, emptying and requesting seats move the counts a
 * manpower review reads, and that a change keyed in personnel shows up here.
 */

const seat = (code: string) => POSITIONS.find((p) => p.code === code)!;

describe("filling seats", () => {
  it("starts with the three seats nobody in the register holds", () => {
    // กรรมการผู้จัดการ, หัวหน้าสายการผลิต, and เจ้าหน้าที่จัดซื้อ since its holder resigned.
    expect(vacancies()).toBe(3);
    expect(holderFor(seat("POS-041"))).toBeUndefined();
  });

  it("assigns a new hire from the register, drops the vacancy count and closes the request", () => {
    const e = hireEmployee({
      name: "ศิริพร ใจดี", nickname: "พร", gender: "หญิง", birthDate: "1998-04-12", nationalId: "1-1037-00123-45-6",
      phone: "081-555-0101", email: "siriporn@example.co.th", address: "12/3 ถ.สุขุมวิท แขวงคลองเตย กรุงเทพฯ 10110",
      position: "เจ้าหน้าที่จัดซื้อ", department: "ฝ่ายจัดซื้อ", type: "พนักงานประจำ", startedAt: "2026-10-01", endsAt: null,
      baseSalary: 23000, workDays: "จันทร์–ศุกร์", ssoNumber: "9012345678", bankName: "กสิกรไทย", bankAccount: "xxx-x-x4455-6",
      pvdRate: 3, documents: [],
    });

    assignHolder(seat("POS-041").id, e.id);

    expect(holderFor(seat("POS-041"))?.id).toBe(e.id);
    expect(vacancies()).toBe(2);
    expect(REQUISITIONS.find((r) => r.id === "REQ-2569-004")).toMatchObject({ status: "ปิดแล้ว", filledBy: e.id });
  });

  it("moves a person out of their old seat — one person, one seat", () => {
    // ปรียา holds เจ้าหน้าที่บุคคล by job title; putting her in the production seat empties it.
    assignHolder(seat("POS-021").id, 4);
    expect(holderFor(seat("POS-021"))?.id).toBe(4);
    expect(holderFor(seat("POS-061"))).toBeUndefined();
    expect(vacancies()).toBe(2);
  });

  it("empties a seat on release", () => {
    releaseHolder(seat("POS-021").id);
    expect(holderFor(seat("POS-021"))).toBeUndefined();
    expect(vacancies()).toBe(3);
    expect(() => releaseHolder(seat("POS-021").id)).toThrow();
  });

  it("lets someone act in a vacant seat without counting it as filled", () => {
    assignActing(seat("POS-021").id, 5, "2026-12-31");
    expect(actingFor(seat("POS-021"))?.employee.id).toBe(5);
    expect(vacancies()).toBe(3);
    expect(() => assignActing(seat("POS-031").id, 5, "2026-12-31")).toThrow();
  });

  it("follows a promotion approved in the personnel register", () => {
    // กมลวรรณ sits in พนักงานขาย by her job title; once promoted, that seat is empty.
    expect(holderFor(seat("POS-012"))?.id).toBe(6);
    approveAction("HR-2569-0015");
    expect(holderFor(seat("POS-012"))).toBeUndefined();
    expect(vacancies()).toBe(4);
  });
});

describe("units and positions", () => {
  it("adds a unit with the next code and moves it, but never under itself", () => {
    const u = createUnit({ name: "ฝ่ายการตลาด", parentId: 7, plannedHeadcount: 2, costCentre: "CC-230" });
    expect(u.code).toBe("ORG-230");
    expect(ORG_UNITS).toContain(u);

    updateUnit(u.id, { name: "ฝ่ายการตลาดและขาย", parentId: 1, plannedHeadcount: 2, costCentre: "CC-230" });
    expect(unitOf(u.id)).toMatchObject({ name: "ฝ่ายการตลาดและขาย", parentId: 1 });
    // ฝ่ายขาย cannot move under the unit that now sits beneath it.
    expect(() => updateUnit(1, { name: "ฝ่ายขาย", parentId: u.id, plannedHeadcount: 2, costCentre: "CC-110" })).toThrow();
  });

  it("creates a seat empty even when its title matches someone in the register", () => {
    const p = createPosition({
      unitId: 1, title: "หัวหน้าฝ่ายขาย", level: "หัวหน้างาน", reportsTo: 10,
      duties: ["ดูแลลูกค้าภาคตะวันออก"], qualifications: ["ประสบการณ์ขาย 5 ปี"],
    });
    expect(p.code).toBe("POS-062");
    expect(holderFor(p)).toBeUndefined();
  });

  it("keeps the holder when a seat is renamed", () => {
    const warehouse = seat("POS-031");
    const holder = holderFor(warehouse)!.id;
    updatePosition(warehouse.id, { ...warehouse, title: "ผู้จัดการคลังและจัดส่ง" });
    expect(holderFor(positionOf(warehouse.id))?.id).toBe(holder);
    // A seat cannot report to someone who reports to it.
    expect(() => updatePosition(warehouse.id, { ...warehouse, reportsTo: seat("POS-032").id })).toThrow();
  });
});

describe("headcount requests", () => {
  it("numbers on, and an approved extra headcount becomes an empty seat and a bigger plan", () => {
    const sales = seat("POS-011");
    const planned = unitOf(sales.unitId).plannedHeadcount;
    const seatsBefore = POSITIONS.length;
    const r = openRequisition({ positionId: sales.id, kind: "อัตราเพิ่ม", wantedBy: "2026-12-01", reason: "เปิดตลาดภาคเหนือต้องมีหัวหน้าทีมเพิ่ม" });
    expect(r.id).toBe("REQ-2569-007");

    approveRequisition(r.id);
    expect(POSITIONS.length).toBe(seatsBefore + 1);
    expect(unitOf(sales.unitId).plannedHeadcount).toBe(planned + 1);
    expect(r.positionId).not.toBe(sales.id);
    expect(holderFor(positionOf(r.positionId))).toBeUndefined();
  });

  it("will not ask to fill a seat that is already filled", () => {
    expect(() =>
      openRequisition({ positionId: seat("POS-051").id, kind: "ตำแหน่งว่าง", wantedBy: "2026-12-01", reason: "ทดแทนตำแหน่งที่มีคนอยู่แล้ว" })
    ).toThrow();
  });

  it("needs a reason to decline", () => {
    expect(() => rejectRequisition("REQ-2569-006", "")).toThrow();
    expect(rejectRequisition("REQ-2569-006", "ยังไม่ถึงรอบแผนสืบทอด").status).toBe("ไม่อนุมัติ");
  });
});
