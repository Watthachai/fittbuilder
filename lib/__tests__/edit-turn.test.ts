import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * The server half of an edit turn (lib/apply-edit): the model names the lines
 * it changes, the server places them into the file as the turn has it so far
 * and sends the whole file on — so the preview, the draft, history and a studio
 * waiting on a dropped connection all see a finished file, as before.
 */
const route = readFileSync("app/api/generate/route.ts", "utf8");
const usage = readFileSync("lib/ai-usage.ts", "utf8");
const migration = readFileSync("supabase/migrations/0058_edit_stats.sql", "utf8").replace(/\s+/g, " ");

describe("an edit turn on the server", () => {
  it("places an edit into the file as this turn has left it: written this turn, else the project's", () => {
    expect(route).toContain("path in produced ? produced[path]");
    expect(route).toContain("applyEdit(before, pairs)");
  });

  it("sends a placed edit on as the whole file, like any file the turn wrote", () => {
    const place = route.slice(route.indexOf("const placeEdit = "));
    expect(place.slice(0, 700)).toContain('send({ type: "file", path, content: prepare(path, out.content) })');
  });

  it("tries the edits it could not place once more, taking only edits to those files", () => {
    const repair = route.slice(route.indexOf("buildEditRepairPrompt("));
    const loop = repair.slice(0, 1200);
    expect(loop).toContain(".edits");
    expect(loop).not.toContain(".files");
    expect(loop).toContain("thinking: false");
  });

  it("names the files it still could not place, and tells a task list the task is not done", () => {
    expect(route).toContain("unplacedNote(");
    expect(route).toContain("markIncomplete(");
  });

  it("adds the second try's tokens to the turn's, rather than replace them", () => {
    const repair = route.slice(route.indexOf("buildEditRepairPrompt("));
    expect(repair.slice(0, 1200)).toContain("addUsage(");
  });

  it("records how its edits went with the turn", () => {
    expect(route).toContain("edits: iteration ? editStats : null");
    expect(usage).toContain("edit_stats: params.turn?.edits ?? null");
  });
});

describe("migration 0058", () => {
  it("gives the usage ledger a place for each turn's edit counts, and can run again", () => {
    expect(migration).toContain("alter table fittbuilder_ai_usage add column if not exists edit_stats jsonb;");
    expect(migration).toContain("notify pgrst, 'reload schema';");
  });
});
