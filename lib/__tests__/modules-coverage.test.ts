import { describe, expect, it } from "vitest";
import { MODULES } from "../modules/registry";

/**
 * Every module must actually contain what it says it contains.
 *
 * The first version of this catalogue shipped one table per module and called the
 * result an HR system. It was not: SAP's PA alone covers personal data, contract
 * data, administrative records, HR events and compensation, and only the first of
 * those existed. Nobody noticed from the code — the modules looked finished, the
 * tests were green, and the gap appeared only when a person read the source
 * document and asked whether we had.
 *
 * So the expected capabilities are data on the module, and these tests hold the
 * module's own screen against them. A feature that is listed but not built fails
 * here rather than in front of a customer.
 */
describe("module coverage", () => {
  for (const m of MODULES) {
    describe(`${m.name} (SAP ${m.sapCode})`, () => {
      it("lists what the SAP module it is named after covers", () => {
        expect(m.keyFeatures.length).toBeGreaterThanOrEqual(4);
      });

      it("builds every capability it claims", () => {
        const source = Object.values(m.files).join("\n");
        const absent = m.keyFeatures.filter((f) => !source.includes(f));
        expect(absent).toEqual([]);
      });

      it("says what it builds in terms a buyer reads on a quotation", () => {
        for (const f of m.keyFeatures) expect(m.build).toContain(f);
      });
    });
  }
});
