import { describe, expect, it } from "vitest";
import {
  composeTemplateBrief,
  DESIGN_TEMPLATES,
  getDesignTemplate,
  missingRequired,
} from "@/lib/design-templates";
import { MESSAGE_MAX_CHARS } from "@/lib/limits";

const cinematic = getDesignTemplate("cinematic-scroll")!;

describe("design templates registry", () => {
  it("every template fits the chat limit even with generous slot values", () => {
    for (const t of DESIGN_TEMPLATES) {
      const values = Object.fromEntries(t.slots.map((s) => [s.id, "ค".repeat(400)]));
      expect(composeTemplateBrief(t, values).length).toBeLessThan(MESSAGE_MAX_CHARS);
    }
  });

  it("every template names at least one image slot with a concrete hint", () => {
    for (const t of DESIGN_TEMPLATES) {
      const images = t.slots.filter((s) => s.kind === "image");
      expect(images.length).toBeGreaterThan(0);
      for (const s of images) expect(s.hint.length).toBeGreaterThan(10);
    }
  });
});

describe("missingRequired", () => {
  it("lists exactly the required slots that are empty or whitespace", () => {
    expect(missingRequired(cinematic, {})).toEqual([
      "subject",
      "heroWord",
      "imgSky",
      "imgMid",
      "imgHero",
    ]);
    expect(
      missingRequired(cinematic, {
        subject: "เชียงใหม่",
        heroWord: "  ",
        imgSky: "https://a",
        imgMid: "https://b",
        imgHero: "https://c",
      })
    ).toEqual(["heroWord"]);
  });
});

describe("composeTemplateBrief", () => {
  const filled = {
    subject: "เชียงใหม่",
    heroWord: "CHIANG MAI",
    imgSky: "https://img.example/sky.jpg",
    imgMid: "https://img.example/city.jpg",
    imgHero: "https://img.example/wat.png",
  };

  it("puts the filled values before the recipe, under their labels", () => {
    const brief = composeTemplateBrief(cinematic, filled);
    expect(brief.indexOf("CHIANG MAI")).toBeLessThan(brief.indexOf("Scroll rig"));
    expect(brief).toContain("https://img.example/sky.jpg");
    expect(brief).toContain(cinematic.recipe);
  });

  /**
   * An absent image is an instruction, not a silence — silence invites the
   * model to invent a URL for the empty layer.
   */
  it("states an empty image slot as absent instead of dropping it", () => {
    const brief = composeTemplateBrief(cinematic, filled);
    expect(brief).toContain("รูป SPLIT ซ้าย");
    expect(brief).toContain("ไม่มีรูปช่องนี้");
  });

  it("drops an empty optional text slot entirely — nothing to degrade", () => {
    const brief = composeTemplateBrief(cinematic, filled);
    expect(brief).not.toContain("### การ์ดไฮไลต์ 4–6 ใบ");
  });
});
