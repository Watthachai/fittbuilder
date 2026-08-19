import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * The brief has to be able to catch up with the build.
 *
 * BRD/PRD are written at Define/Plan time and then the demo moves on — pages
 * added, a tier built, menus grown — while the docs keep describing what was
 * originally asked for. Everything downstream reads them: the Code Runner
 * hand-off, the quotation's scope, the premium analysis. A stale brief becomes a
 * wrong deliverable without anyone editing it.
 */
const studio = readFileSync("components/studio/Studio.tsx", "utf8");
const stepper = readFileSync("components/studio/PhaseStepper.tsx", "utf8");

describe("updating the docs from the built project", () => {
  // Bounded at its own closing deps array — a longer window runs into the next
  // callback, which legitimately calls generate() and made this pass vacuously.
  const start = studio.indexOf("const syncDocsFromProject");
  const sync = studio.slice(start, studio.indexOf("}, [busy, readOnly, persist, reviseDoc]);", start));

  it("describes what the demo actually contains", () => {
    const body = sync;
    expect(body).toContain("screenIndexEntries");
    expect(body).toContain("src\\/pages\\/");
    expect(body).toContain("extraDepsOf");
  });

  it("goes through the doc path, so it cannot touch application code", () => {
    // reviseDoc runs the phase agent, which writes docs/ and chains BRD → PRD.
    // Reaching for generate() here would put the whole file map in play for a
    // change that is meant to be prose only.
    expect(sync).toContain('reviseDoc(\n      "define"');
    expect(sync).not.toMatch(/\bgenerate\(/);
  });

  it("is offered wherever the opposite direction already is", () => {
    // "สร้างใหม่จากเอกสาร" rebuilds the app FROM the docs; this is the same
    // relationship read the other way, so it belongs beside it.
    expect(stepper).toContain("onSyncDocs");
    expect(stepper).toContain("อัปเดตเอกสารจากของจริง");
  });

  /**
   * Updating prose about finished work is not a decision to redo the plan.
   *
   * reviseDoc walks the project back to the phase that owns the doc — correct
   * when you are reworking that phase, wrong here: pressing "อัปเดตเอกสาร" sent a
   * project sitting in Build back to Plan, which reads as "everything has to be
   * built again".
   */
  it("puts the phase back where it was", () => {
    expect(sync).toContain("const wasPhase = current.phase");
    expect(sync).toContain("phase: wasPhase");
    expect(sync).toContain("approvedPhases: wasApproved");
  });
});

describe("where a written doc opens", () => {
  it("opens the reader, not the code panel", () => {
    // A brief is a document. Dropping the user into raw Markdown in the Code
    // panel shows them the file instead of what the file says.
    const write = studio.slice(studio.indexOf("files[DOC_PATHS[kind]] = contents"));
    expect(write.slice(0, 700)).toContain("setPreviewPhase(");
    expect(write.slice(0, 700)).not.toContain('setView("code")');
  });
});
