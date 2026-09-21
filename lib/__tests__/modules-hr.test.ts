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
    // And it must not have shipped a staff list of its own alongside it.
    expect(PY.files["src/modules/py/data.ts"]).not.toContain("EMPLOYEES");
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
