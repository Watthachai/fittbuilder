import { describe, expect, it } from "vitest";
import { composeModules } from "../modules/compose";
import type { Module } from "../modules/types";

/**
 * Selecting payroll without personnel records must SAY SO.
 *
 * The only merge this codebase had before was "later wins" over a flat path map,
 * which loses whatever it overwrites with no error and no log — the same shape of
 * silent failure that hid a truncated document for two months and a dead build for
 * two weeks. A module whose data source is missing is exactly that shape: the demo
 * still renders, the payroll screen just quietly has nothing behind it.
 *
 * So the composer reports. It does not repair, and it does not drop.
 */
const PA: Module = {
  id: "pa",
  name: "ทะเบียนพนักงาน",
  family: "hr",
  tier: "base",
  pitch: "ประวัติพนักงานอยู่ที่เดียว ไม่ต้องตามหาในไฟล์ Excel หลายใบ",
  keyFeatures: ["ค้นหา"],
  provides: ["employee"],
  needs: [],
  effortDays: 4,
  maPerMonth: 2000,
  build: "หน้าทะเบียนพนักงาน: ค้นหา เพิ่ม แก้ไข ดูประวัติการเปลี่ยนตำแหน่ง",
  files: { "src/modules/pa/EmployeeList.tsx": "// pa" },
};

const PY: Module = {
  id: "py",
  name: "เงินเดือน",
  family: "hr",
  tier: "base",
  pitch: "คำนวณเงินเดือนจากข้อมูลพนักงานที่มีอยู่แล้ว ไม่ต้องคีย์ซ้ำ",
  keyFeatures: ["คำนวณ"],
  provides: ["payslip"],
  needs: ["employee"],
  effortDays: 8,
  maPerMonth: 4000,
  build: "หน้าคำนวณเงินเดือน: รอบจ่าย รายการหักลด สลิป",
  files: { "src/modules/py/PayrollRun.tsx": "// py" },
};

describe("composeModules · dependencies", () => {
  it("reports the entity a selected module needs and nobody provides", () => {
    const out = composeModules([PY]);

    expect(out.missing).toEqual([{ moduleId: "py", entity: "employee" }]);
  });

  it("reports nothing once the provider is selected too", () => {
    const out = composeModules([PA, PY]);

    expect(out.missing).toEqual([]);
  });
});

describe("composeModules · files", () => {
  it("keeps each module's own files and adds the shell neither of them owns", () => {
    const out = composeModules([PA, PY]);

    expect(out.files["src/modules/pa/EmployeeList.tsx"]).toBe("// pa");
    expect(out.files["src/modules/py/PayrollRun.tsx"]).toBe("// py");
    // The shell is the composer's, so two modules can sit in one app without
    // either of them having to know the other exists.
    expect(out.files["src/App.tsx"]).toBeDefined();
  });

  it("makes every selected module reachable from the shell", () => {
    const out = composeModules([PA, PY]);
    const shell = out.files["src/App.tsx"];

    // Reachable by the name the buyer chose, not by the module id.
    expect(shell).toContain("ทะเบียนพนักงาน");
    expect(shell).toContain("เงินเดือน");
  });
});

describe("composeModules · territory", () => {
  /**
   * A module that writes outside its own directory is a mistake made by whoever
   * wrote the module, not by whoever selected it. It fails loudly at test time so
   * it cannot reach a customer's demo, where it would look like the other module
   * simply vanished.
   */
  it("refuses a module that writes outside its own directory", () => {
    const rogue: Module = { ...PA, id: "rogue", files: { "src/App.tsx": "// mine now" } };

    expect(() => composeModules([rogue])).toThrow(/src\/modules\/rogue/);
  });

  it("names the offending path so the author knows what to move", () => {
    const rogue: Module = {
      ...PA,
      id: "rogue",
      files: { "src/modules/rogue/ok.tsx": "// fine", "src/shared/theme.css": "// not fine" },
    };

    expect(() => composeModules([rogue])).toThrow(/src\/shared\/theme\.css/);
  });
});

describe("composeModules · pricing", () => {
  it("gives the quotation one line per module, priced as the module is priced", () => {
    const out = composeModules([PA, PY]);

    expect(out.quoteLines).toEqual([
      { moduleId: "pa", name: "ทะเบียนพนักงาน", effortDays: 4, maPerMonth: 2000 },
      { moduleId: "py", name: "เงินเดือน", effortDays: 8, maPerMonth: 4000 },
    ]);
  });

  /**
   * No shared-infrastructure discount: adding a second module does not make the
   * first one cheaper. A discount rule invented before a customer has asked for
   * one would be priced from a guess, and a quotation nobody can check by hand is
   * worse than one that is simply the sum.
   */
  it("does not make the first module cheaper when a second is added", () => {
    const alone = composeModules([PA]).quoteLines;
    const withPayroll = composeModules([PA, PY]).quoteLines;

    expect(withPayroll[0]).toEqual(alone[0]);
  });

  it("totals what a person adding the lines by hand would get", () => {
    const out = composeModules([PA, PY]);

    expect(out.totalEffortDays).toBe(12);
    expect(out.totalMaPerMonth).toBe(6000);
  });
});

describe("composeModules · the PRD section", () => {
  /**
   * This is the part that outlives the demo. CRN rebuilds the production app from
   * the documents, not from the prototype's source, so the scope the customer
   * approved reaches the real build through this text or not at all.
   */
  it("names each module and what it is for", () => {
    const prd = composeModules([PA, PY]).prdSection;

    expect(prd).toContain("ทะเบียนพนักงาน");
    expect(prd).toContain("เงินเดือน");
    expect(prd).toContain("คำนวณเงินเดือนจากข้อมูลพนักงานที่มีอยู่แล้ว");
  });

  it("writes down which module owns the data another one reads", () => {
    const prd = composeModules([PA, PY]).prdSection;

    // Without this, a production build is free to give payroll its own employee
    // table, and the two screens drift apart on the first edit.
    expect(prd).toMatch(/เงินเดือน[\s\S]*employee[\s\S]*ทะเบียนพนักงาน/);
  });
});

describe("composeModules · determinism", () => {
  it("gives the same answer for the same selection", () => {
    expect(composeModules([PA, PY])).toEqual(composeModules([PA, PY]));
  });

  it("does not care what order they were picked in", () => {
    // The picker is a grid of checkboxes; click order is not a design decision.
    expect(composeModules([PY, PA]).files).toEqual(composeModules([PA, PY]).files);
  });
});
