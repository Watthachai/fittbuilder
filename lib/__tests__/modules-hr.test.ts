import { describe, expect, it } from "vitest";
import { composeModules } from "../modules/compose";
import { MODULES, getModule, modulesOf } from "../modules/registry";

/**
 * The HR family is shipped first because payroll cannot exist without personnel
 * records. That makes it the only family where the `provides`/`needs` contract has
 * something real to fail against on the very first build — three families of
 * unrelated screens would have proved nothing.
 */
const PA = getModule("pa")!;
const PY = getModule("py")!;
const OM = getModule("om")!;
const TM = getModule("tm")!;

describe("the HR family", () => {
  it("is selectable as a whole with nothing missing", () => {
    const out = composeModules(modulesOf("hr"));

    expect(out.missing).toEqual([]);
  });

  it("puts personnel records before payroll, whatever order they were picked", () => {
    const shell = composeModules([PY, PA]).files["src/App.tsx"];

    expect(shell.indexOf("ทะเบียนพนักงาน")).toBeLessThan(shell.indexOf("เงินเดือน"));
  });

  /**
   * The declaration and the code have to agree.
   *
   * A module could say `needs: ["employee"]` and still keep a private staff list —
   * the metadata would look right, the composer would be satisfied, and the two
   * screens would disagree the first time somebody is hired. Nothing catches that
   * except reading what the source actually imports.
   */
  it("makes payroll read the personnel module's data instead of its own", () => {
    const payrollScreen = PY.files["src/modules/py/screen.tsx"];

    expect(payrollScreen).toContain('from "../pa/data"');
    // And it must not have declared a staff list of its own anywhere. Reading PA's
    // list is the point; owning a second one is the regression.
    for (const source of Object.values(PY.files)) {
      expect(source).not.toMatch(/export const EMPLOYEES/);
    }
  });

  it("keeps every module inside its own directory", () => {
    for (const m of MODULES) {
      for (const path of Object.keys(m.files)) {
        expect(path.startsWith(`src/modules/${m.id}/`)).toBe(true);
      }
    }
  });

  it("prices the pair the way a person adding two lines would", () => {
    const out = composeModules([PA, PY]);

    expect(out.totalEffortDays).toBe(PA.effortDays + PY.effortDays);
    expect(out.totalMaPerMonth).toBe(PA.maPerMonth + PY.maPerMonth);
  });

  it("tells the production build who owns the employee record", () => {
    const prd = composeModules([PA, PY]).prdSection;

    expect(prd).toMatch(/เงินเดือน[\s\S]*employee[\s\S]*ทะเบียนพนักงาน/);
  });
});

describe("the rest of the HR family", () => {
  it("ships all four parts a buyer names when they say ระบบ HR", () => {
    expect(modulesOf("hr").map((m) => m.id)).toEqual(["pa", "om", "tm", "py"]);
  });

  it("gives every one of them a SAP code to be found by", () => {
    // A buyer arriving from SAP searches "PA" or "OM". A Thai SME reads the Thai
    // name. Both have to work, and neither claims to be SAP.
    for (const m of modulesOf("hr")) expect(m.sapCode).toMatch(/^[A-Z]{2}$/);
  });

  /**
   * Same contract as payroll, checked the same way: the declaration and the code
   * must agree. An org chart with its own copy of the staff list looks correct
   * until somebody changes department.
   */
  it("makes the org chart read personnel records instead of its own", () => {
    expect(OM.needs).toContain("employee");
    expect(OM.files["src/modules/om/screen.tsx"]).toContain('from "../pa/data"');
  });

  it("makes time and leave read personnel records instead of its own", () => {
    expect(TM.needs).toContain("employee");
    expect(TM.files["src/modules/tm/screen.tsx"]).toContain('from "../pa/data"');
  });

  it("lets a buyer take time tracking without payroll", () => {
    // These are sold separately; needing payroll to use leave would be an
    // invented dependency, not a real one.
    expect(composeModules([PA, TM]).missing).toEqual([]);
  });

  it("prices the whole family as the sum of its parts", () => {
    const out = composeModules(modulesOf("hr"));

    expect(out.quoteLines).toHaveLength(4);
    expect(out.totalEffortDays).toBe(
      modulesOf("hr").reduce((n, m) => n + m.effortDays, 0)
    );
  });
});
