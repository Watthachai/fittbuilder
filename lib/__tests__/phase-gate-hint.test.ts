import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import PhaseStepper from "@/components/studio/PhaseStepper";
import type { PhaseId } from "@/lib/phases";

/**
 * A FITT Voice project lands in Define with only its summary, and "อนุมัติ &
 * ไปต่อ" sat grey with its reason in a tooltip nobody hovers — the tester asked
 * whether the button was broken. The reason is printed beside it now.
 */
const stepper = (phase: PhaseId, canAdvance: boolean, busy = false) =>
  renderToStaticMarkup(
    createElement(PhaseStepper, {
      phase,
      busy,
      canAdvance,
      canRework: false,
      approval: null,
      onAdvance: () => {},
      onStep: () => {},
      onGenerateDoc: () => {},
      onRework: () => {},
      onSyncDocs: () => {},
      undocumented: [],
    })
  );

describe("why the approve button is grey", () => {
  it("says it beside the button, not only in a tooltip", () => {
    expect(stepper("define", false)).toContain(">ยังไม่มี BRD — คุยกับ AI ให้ช่วยร่างก่อน<");
    expect(stepper("plan", false)).toContain(">ยังไม่มี PRD — คุยกับ AI ให้ช่วยร่างก่อน<");
  });

  it("says nothing once the phase can advance, even while the AI is busy", () => {
    expect(stepper("define", true)).not.toContain("ยังไม่มี BRD");
    expect(stepper("define", true, true)).not.toContain("ยังไม่มี BRD");
  });
});
