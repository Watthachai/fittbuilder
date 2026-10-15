import { describe, expect, it } from "vitest";
import { applyEdit, buildEditRepairPrompt, unplacedNote, type FailedEdit } from "../apply-edit";

/**
 * An edit turn changes the lines it means to and nothing else.
 *
 * The model names the text it is replacing; the server swaps exactly that text.
 * Everything outside it stays byte for byte as it was — and an edit that cannot
 * be placed exactly changes nothing at all, rather than land somewhere close.
 */
const FILE = [
  'import { Card } from "./ui";',
  "",
  "export default function Dashboard() {",
  "  return (",
  "    <Card>",
  '      <h1 className="text-2xl font-bold">ภาพรวม</h1>',
  "      <p>ยอดขายวันนี้</p>",
  "    </Card>",
  "  );",
  "}",
  "",
].join("\n");

describe("applyEdit", () => {
  it("replaces the text it names, and leaves every other character as it was", () => {
    const out = applyEdit(FILE, [
      {
        find: '      <h1 className="text-2xl font-bold">ภาพรวม</h1>',
        replace: '      <h1 className="text-3xl font-bold tracking-tight">ภาพรวมวันนี้</h1>',
      },
    ]);
    expect(out).toEqual({
      ok: true,
      content: FILE.replace("text-2xl font-bold\">ภาพรวม", "text-3xl font-bold tracking-tight\">ภาพรวมวันนี้"),
    });
  });

  it("changes nothing when the text is not in the file", () => {
    const out = applyEdit(FILE, [{ find: "      <h1>ภาพรวม</h1>", replace: "      <h1>x</h1>" }]);
    expect(out).toEqual({ ok: false, pair: 0, reason: "not-found" });
  });

  it("changes nothing when the text is in the file more than once", () => {
    const twice = `${FILE}\n${FILE}`;
    const out = applyEdit(twice, [{ find: "      <p>ยอดขายวันนี้</p>", replace: "      <p>x</p>" }]);
    expect(out).toEqual({ ok: false, pair: 0, reason: "ambiguous" });
  });

  it("applies its pairs in order, each against what the one before left", () => {
    const out = applyEdit(FILE, [
      { find: "      <p>ยอดขายวันนี้</p>", replace: "      <p>ยอดขายเดือนนี้</p>" },
      { find: "      <p>ยอดขายเดือนนี้</p>", replace: "      <p>ยอดขายเดือนนี้</p>\n      <p>เป้า 1 ล้าน</p>" },
    ]);
    expect(out.ok && out.content).toContain("      <p>ยอดขายเดือนนี้</p>\n      <p>เป้า 1 ล้าน</p>\n    </Card>");
  });

  it("is all or nothing: one pair that cannot be placed undoes the ones that could", () => {
    const out = applyEdit(FILE, [
      { find: "      <p>ยอดขายวันนี้</p>", replace: "      <p>x</p>" },
      { find: "does not exist", replace: "y" },
    ]);
    expect(out).toEqual({ ok: false, pair: 1, reason: "not-found" });
  });

  it("removes whole lines, line break included, when the replacement is empty", () => {
    const out = applyEdit(FILE, [{ find: "      <p>ยอดขายวันนี้</p>", replace: "" }]);
    expect(out.ok && out.content).toContain('ภาพรวม</h1>\n    </Card>');
  });

  it("refuses an empty find, which would match everywhere", () => {
    expect(applyEdit(FILE, [{ find: "", replace: "x" }])).toEqual({ ok: false, pair: 0, reason: "empty" });
  });

  it("refuses an edit with no pairs", () => {
    expect(applyEdit(FILE, [])).toEqual({ ok: false, pair: 0, reason: "empty" });
  });
});

/**
 * An edit that could not be placed gets one more try: the model sees what it
 * sent, which <find> missed and why, and the file exactly as it is now — and is
 * asked for the same change as an edit again, never as the whole file.
 */
describe("buildEditRepairPrompt", () => {
  const miss: FailedEdit = {
    path: "src/pages/Dashboard.tsx",
    pairs: [
      { find: "      <p>ยอดขาย</p>", replace: "      <p>ยอดขายวันนี้</p>" },
      { find: "      <h1>ภาพรวม</h1>", replace: "      <h1>ภาพรวมวันนี้</h1>" },
    ],
    pair: 1,
    reason: "not-found",
  };
  const prompt = buildEditRepairPrompt([miss], { "src/pages/Dashboard.tsx": FILE });

  it("shows the edit it sent, and which find missed", () => {
    expect(prompt).toContain('<edit path="src/pages/Dashboard.tsx">');
    expect(prompt).toContain("<find>\n      <h1>ภาพรวม</h1>\n</find>");
    expect(prompt).toContain("<find> #2 is not in the file");
  });

  it("shows the file exactly as it is now", () => {
    expect(prompt).toContain(`--- src/pages/Dashboard.tsx ---\n${FILE}`);
  });

  it("says why a find that matched twice failed", () => {
    expect(buildEditRepairPrompt([{ ...miss, reason: "ambiguous" }], { "src/pages/Dashboard.tsx": FILE })).toMatch(
      /<find> #2 matches more than one place/
    );
  });

  it("asks for edits only — no whole files, nothing else", () => {
    expect(prompt).toMatch(/ONE <edit> block per file/);
    expect(prompt).toMatch(/no <file> blocks/);
  });
});

describe("unplacedNote", () => {
  it("names the files left as they were, and that nothing in them changed", () => {
    const note = unplacedNote(["src/App.tsx", "src/pages/Dashboard.tsx"]);
    expect(note).toContain("`src/App.tsx`");
    expect(note).toContain("`src/pages/Dashboard.tsx`");
    expect(note).toContain("เหมือนเดิมทุกตัวอักษร");
  });
});
