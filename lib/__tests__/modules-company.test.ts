import { expect, it } from "vitest";
import { COMPANY } from "../../demo/modules/company";
import { COMPANY as CO } from "../../demo/modules/co/data";
import { COMPANY as FI } from "../../demo/modules/fi/data";
import { COMPANY as MM } from "../../demo/modules/mm/data";
import { COMPANY as PA } from "../../demo/modules/pa/data";
import { COMPANY as PP } from "../../demo/modules/pp/data";
import { COMPANY as PY } from "../../demo/modules/py/data";
import { COMPANY as SD } from "../../demo/modules/sd/data";
import { COMPANY as TM } from "../../demo/modules/tm/data";
import { SHARED_SOURCES } from "../modules/sources";

/**
 * A receipt from accounting printed a different tax id from the tax invoice it
 * paid, because four modules each wrote the company down themselves. Every
 * document in the demo is issued by one company.
 */
it("prints every module's documents under one company", () => {
  for (const [module, c] of Object.entries({ CO, FI, MM, PA, PP, SD, TM })) expect(c, module).toBe(COMPANY);
  // Payroll adds its employer accounts on top; who the employer is stays the same.
  expect(PY).toMatchObject({ name: COMPANY.name, address: COMPANY.address, taxId: COMPANY.taxId });
});

it("ships the company with every module-built project", () => {
  expect(SHARED_SOURCES["src/modules/company.ts"]).toContain(COMPANY.taxId);
});
