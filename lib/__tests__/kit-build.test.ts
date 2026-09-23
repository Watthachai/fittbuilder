import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { oversizedFiles, OVERSIZE_LINES, SHIPPED_KIT_PATHS } from "../code-health";
import { KIT_SOURCES, SHARED_SOURCES } from "../modules/sources";
import { buildGenerationSystemPrompt } from "../prompts";
import { BASE_DEP_NAMES, SCAFFOLD_REQUIRED } from "../scaffold";
import { getSkill, SKILLS } from "../skills/registry";

/**
 * A generated ERP came back looking nothing like the HR system it was meant to
 * resemble: a dark sidebar, a blue accent, a card and a badge of its own making.
 * The prompt asked for a kit and the model wrote one — a different one every
 * build. Back-office builds now start with the studio's own kit in the project,
 * and these are the promises that makes.
 */

const route = readFileSync("app/api/generate/route.ts", "utf8");
const erp = getSkill("erp")!;
const kitSource = Object.values(KIT_SOURCES).join("\n");

describe("the kit a back-office build starts with", () => {
  it("lands where the structure contract keeps its primitives", () => {
    expect(Object.keys(KIT_SOURCES).sort()).toEqual([
      "src/components/ui/kit.tsx",
      "src/components/ui/shell.tsx",
      "src/components/ui/ui.tsx",
    ]);
  });

  it("is the same code the HR system renders, not a copy of it", () => {
    for (const [path, content] of Object.entries(KIT_SOURCES)) {
      const name = path.split("/").pop()!;
      expect(content).toBe(readFileSync(`demo/modules/${name}`, "utf8"));
    }
  });

  it("resolves every relative import inside itself", () => {
    // A kit file reaching into a module (../pa/data) would work on the HR pages
    // and be a white screen in every generated app.
    for (const [path, content] of Object.entries(KIT_SOURCES)) {
      const dir = path.slice(0, path.lastIndexOf("/") + 1);
      for (const [, spec] of content.matchAll(/from "(\.[^"]+)"/g)) {
        expect(KIT_SOURCES, `${path} imports ${spec}`).toHaveProperty(`${dir}${spec.replace("./", "")}.tsx`);
      }
    }
  });

  it("needs no package the scaffold does not already have", () => {
    // Anything else would mean a <deps> install and a container reboot on every
    // kit build, or an import that fails outright.
    for (const content of Object.values(KIT_SOURCES)) {
      for (const [, spec] of content.matchAll(/from "([^".][^"]*)"/g)) {
        const pkg = spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0];
        expect(BASE_DEP_NAMES.has(pkg), `kit imports ${spec}`).toBe(true);
      }
    }
  });

  it("renders every dialog through the portal", () => {
    // The generator is held to this for every modal it writes. A kit dialog that
    // skipped it would be clipped to the first card that lifts on hover.
    expect(kitSource).toContain("createPortal(children, document.body)");
    const components = kitSource.split(/\nexport function /).slice(1);
    const dialogs = components.filter((c) => /role="(alert)?dialog"/.test(c));
    expect(dialogs.map((c) => c.slice(0, c.indexOf("("))).sort()).toEqual([
      "ConfirmDialog",
      "DetailModal",
      "Drawer",
      "FormModal",
      "Modal",
    ]);
    for (const dialog of dialogs) expect(dialog).toContain("<Overlay>");
  });
});

describe("the generation prompt when a build starts with the kit", () => {
  const withKit = buildGenerationSystemPrompt("SPEC", "PERSONA", erp, KIT_SOURCES);

  it("carries the kit's whole source, so the API it describes cannot drift from the files", () => {
    for (const content of Object.values(KIT_SOURCES)) expect(withKit).toContain(content);
  });

  it("names only components the kit actually exports", () => {
    const promised = [
      "Shell", "Card", "Badge", "Button", "Avatar", "Metric", "StatStrip", "PageHead", "Tabs", "Segmented",
      "Select", "Search", "Timeline", "Stepper", "IconRow", "ColumnChart", "Donut", "Gauge", "Heatmap", "Bar",
      "Progress", "WeekStrip", "Reveal", "Tag", "TintCard", "Dot", "swatchFor", "DataTable", "DetailModal",
      "FormModal", "Drawer", "ConfirmDialog", "Field", "Wizard", "Modal", "FIELD", "SURFACE",
    ];
    const block = withKit.slice(withKit.indexOf("THE STUDIO KIT"), withKit.indexOf("--- src/components/ui/"));
    for (const name of promised) {
      expect(block, name).toContain(name);
      expect(kitSource, name).toMatch(new RegExp(`export (function|const) ${name}\\b`));
    }
  });

  it("has the last word over the domain template on how things look", () => {
    expect(withKit.indexOf("ERP Build Guidance")).toBeGreaterThan(-1);
    expect(withKit.indexOf("THE STUDIO KIT")).toBeGreaterThan(withKit.indexOf("ERP Build Guidance"));
  });

  it("forbids re-sending the files and re-inventing their pieces", () => {
    expect(withKit).toContain("NEVER output these three files");
    expect(withKit).toContain("Do not write Card.tsx");
    expect(withKit).toContain("wraps the active page in <Shell>");
  });

  it("gives a brand colour one place to go instead of a second palette", () => {
    expect(withKit).toContain("--color-violet-50");
    expect(withKit).toContain("src/index.css");
  });

  it("is absent when the build does not start with the kit", () => {
    expect(buildGenerationSystemPrompt("SPEC", "PERSONA", erp)).not.toContain("THE STUDIO KIT");
    expect(buildGenerationSystemPrompt("SPEC", "PERSONA")).not.toContain("THE STUDIO KIT");
  });
});

describe("the generate route", () => {
  it("ships the kit on a first build of a back-office template only", () => {
    expect(route).toContain("const kit = !iteration && skill?.kit ? KIT_SOURCES : undefined;");
    expect(route).toMatch(/persona,\s*skill,\s*kit\s*\)/);
  });

  it("writes the kit before the model's first file", () => {
    const shippedAt = route.indexOf("for (const [path, content] of Object.entries(kit)) send(");
    expect(shippedAt).toBeGreaterThan(-1);
    expect(shippedAt).toBeLessThan(route.indexOf("for await (const part of streamParts({"));
  });

  it("keeps the model from overwriting or deleting the kit in that turn", () => {
    // Stream files and deletes, salvaged files and deletes.
    expect(route.match(/!isSafePath\(path\) \|\| shipped\(path\)\) continue;/g)).toHaveLength(4);
  });

  it("does not mistake the kit for screens the model wrote", () => {
    // Otherwise a build that stopped before any page would still send the
    // shell retry off to write an App.tsx around nothing.
    const at = route.indexOf("const wroteScreens");
    expect(route.slice(at, at + 200)).toContain("!shipped(path)");
  });
});

describe("which templates start with the kit", () => {
  it("is the back-office ones, and nothing a customer browses", () => {
    expect(SKILLS.filter((s) => s.kit).map((s) => s.id).sort()).toEqual(["crm", "dashboard", "erp"]);
  });

  it("do not send the model to a second chart library or a second look", () => {
    for (const skill of SKILLS.filter((s) => s.kit)) {
      const guidance = `${skill.buildGuidance}\n${skill.designHints ?? ""}`;
      expect(guidance, skill.id).not.toContain("recharts");
    }
    // The line behind the dark sidebar and blue accent in the build that started this.
    expect(erp.designHints).not.toContain("sidebar เข้ม");
    expect(erp.designHints).not.toContain("น้ำเงิน");
  });
});

describe("the size audit and the kit", () => {
  const lines = (n: number) => Array.from({ length: n }, (_, i) => `const x${i} = ${i};`).join("\n");

  it("covers every place the kit lands, and nothing else", () => {
    expect([...SHIPPED_KIT_PATHS].sort()).toEqual(
      [...Object.keys(SHARED_SOURCES), ...Object.keys(KIT_SOURCES)].sort()
    );
  });

  it("does not report the shipped kit as structure debt", () => {
    // A kit-built project would otherwise open with a debt banner, and the
    // reorganize button would ask the model to cut the kit into forty files.
    expect(oversizedFiles({ ...KIT_SOURCES, ...SHARED_SOURCES })).toEqual([]);
  });

  it("still reports a long file the model wrote, even beside the kit", () => {
    const found = oversizedFiles({ ...KIT_SOURCES, "src/components/ui/Card.tsx": lines(OVERSIZE_LINES + 1) });
    expect(found.map((f) => f.path)).toEqual(["src/components/ui/Card.tsx"]);
  });
});

describe("dark mode in a generated index.html", () => {
  it("is asked for the same class-based variant the scaffold uses", () => {
    // Without it Tailwind v4 reads dark: as the OS setting, and the kit — which
    // declares both themes on every surface — turns dark inside a light page.
    const line = "@custom-variant dark (&:where(.dark, .dark *));";
    expect(SCAFFOLD_REQUIRED["index.html"]).toContain(line);
    expect(buildGenerationSystemPrompt()).toContain(`<style type="text/tailwindcss">${line}</style>`);
  });
});
