import { describe, expect, it } from "vitest";
import { applyOps, diffDoc } from "../co-edit";

/**
 * Two people on one quotation. Each local edit travels as the smallest change
 * that describes it, so applying it on the other screen cannot undo what that
 * person typed somewhere else in the meantime.
 */

type Row = { id: string; name: string; days: number; note: string };
type Doc = {
  customerName: string;
  presentedBy: string;
  brand: { name: string; address: string };
  rows: Row[];
  excluded: string[];
};

const base: Doc = {
  customerName: "",
  presentedBy: "",
  brand: { name: "บริษัท ดิจิทัล แวลู จำกัด", address: "" },
  rows: [
    { id: "r1", name: "หน้ารายการ BOQ", days: 3, note: "" },
    { id: "r2", name: "ฟอร์มเพิ่มรายการ", days: 2, note: "" },
  ],
  excluded: ["ย้ายข้อมูลเก่า"],
};

describe("diffDoc", () => {
  it("names only the field that changed", () => {
    expect(diffDoc(base, { ...base, customerName: "บจก. สยามพูลส์" })).toEqual([
      { kind: "set", path: ["customerName"], value: "บจก. สยามพูลส์" },
    ]);
  });

  it("reaches into an object and into one line item by its id", () => {
    const next = {
      ...base,
      brand: { ...base.brand, address: "กรุงเทพฯ" },
      rows: base.rows.map((r) => (r.id === "r2" ? { ...r, days: 4 } : r)),
    };
    expect(diffDoc(base, next)).toEqual([
      { kind: "set", path: ["brand", "address"], value: "กรุงเทพฯ" },
      { kind: "set", path: ["rows", "#r2", "days"], value: 4 },
    ]);
  });

  it("sends an added or removed line with the new order", () => {
    const added = { id: "r3", name: "หน้ารายงาน", days: 2, note: "" };
    expect(diffDoc(base, { ...base, rows: [base.rows[0], added, base.rows[1]] })).toEqual([
      { kind: "set", path: ["rows", "#r3"], value: added },
      { kind: "order", path: ["rows"], ids: ["r1", "r3", "r2"] },
    ]);
    expect(diffDoc(base, { ...base, rows: [base.rows[1]] })).toEqual([
      { kind: "remove", path: ["rows", "#r1"] },
      { kind: "order", path: ["rows"], ids: ["r2"] },
    ]);
  });

  it("replaces a list without ids whole", () => {
    expect(diffDoc(base, { ...base, excluded: ["ย้ายข้อมูลเก่า", "อบรมผู้ใช้"] })).toEqual([
      { kind: "set", path: ["excluded"], value: ["ย้ายข้อมูลเก่า", "อบรมผู้ใช้"] },
    ]);
  });

  it("finds nothing when nothing changed", () => {
    expect(diffDoc(base, structuredClone(base))).toEqual([]);
  });
});

describe("applyOps", () => {
  it("keeps what the other person typed elsewhere", () => {
    // A priced row 2 while B was typing the customer's name.
    const mine = { ...base, customerName: "บจก. สยามพูลส์" };
    const theirs = diffDoc(base, { ...base, rows: base.rows.map((r) => (r.id === "r2" ? { ...r, days: 4 } : r)) });
    const { doc, complete } = applyOps(mine, theirs);
    expect(complete).toBe(true);
    expect(doc.customerName).toBe("บจก. สยามพูลส์");
    expect(doc.rows.map((r) => r.days)).toEqual([3, 4]);
  });

  it("merges edits to different lines and to different fields of one object", () => {
    const mine = { ...base, brand: { ...base.brand, name: "ดิจิทัล แวลู" }, rows: base.rows.map((r) => (r.id === "r1" ? { ...r, note: "ค้นหาและกรอง" } : r)) };
    const theirs = diffDoc(base, { ...base, brand: { ...base.brand, address: "กรุงเทพฯ" }, rows: base.rows.map((r) => (r.id === "r2" ? { ...r, note: "บันทึกแล้วกลับหน้ารายการ" } : r)) });
    const { doc } = applyOps(mine, theirs);
    expect(doc.brand).toEqual({ name: "ดิจิทัล แวลู", address: "กรุงเทพฯ" });
    expect(doc.rows.map((r) => r.note)).toEqual(["ค้นหาและกรอง", "บันทึกแล้วกลับหน้ารายการ"]);
  });

  it("places an added line where its author put it and keeps a line only this side has", () => {
    const mine = { ...base, rows: [...base.rows, { id: "r9", name: "ของฉัน", days: 1, note: "" }] };
    const added = { id: "r3", name: "หน้ารายงาน", days: 2, note: "" };
    const theirs = diffDoc(base, { ...base, rows: [base.rows[0], added, base.rows[1]] });
    expect(applyOps(mine, theirs).doc.rows.map((r) => r.id)).toEqual(["r1", "r3", "r2", "r9"]);
  });

  it("removes a line the other person deleted", () => {
    const theirs = diffDoc(base, { ...base, rows: [base.rows[1]] });
    expect(applyOps(base, theirs).doc.rows.map((r) => r.id)).toEqual(["r2"]);
  });

  it("reports an edit to a line this side has never seen, so the caller reloads", () => {
    const theirs = [{ kind: "set" as const, path: ["rows", "#r7", "days"], value: 5 }];
    const { doc, complete } = applyOps(base, theirs);
    expect(complete).toBe(false);
    expect(doc).toEqual(base);
  });
});
