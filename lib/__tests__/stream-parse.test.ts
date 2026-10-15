import { describe, expect, it } from "vitest";
import { FileStreamParser, salvageJsonFiles } from "../stream-parse";

describe("FileStreamParser", () => {
  it("emits a file once its closing tag arrives", () => {
    const p = new FileStreamParser();
    expect(p.push('กำลังแก้…\n<file path="src/App.tsx">\nexport default App;')).toEqual({
      files: [],
      edits: [],
      deletes: [],
      deps: [],
    });
    const out = p.push("\n</file>\nสรุป: แก้แล้ว");
    expect(out.files).toEqual([{ path: "src/App.tsx", content: "export default App;" }]);
    expect(p.getReply()).toBe("สรุป: แก้แล้ว");
  });

  it("picks up deletes and deps directives", () => {
    const p = new FileStreamParser();
    const out = p.push('<deps>recharts lucide-react</deps><delete path="src/Old.tsx"/>');
    expect(out.deps).toEqual(["recharts", "lucide-react"]);
    expect(out.deletes).toEqual(["src/Old.tsx"]);
  });
});

/**
 * An edit turn names what it replaces instead of writing the file again
 * (lib/apply-edit). The block is parsed as it closes, like a <file> block.
 */
describe("FileStreamParser — edit blocks", () => {
  const block = [
    '<edit path="src/pages/Dashboard.tsx">',
    "<find>",
    '      <h1 className="text-2xl">ภาพรวม</h1>',
    "</find>",
    "<replace>",
    '      <h1 className="text-3xl">ภาพรวมวันนี้</h1>',
    "</replace>",
    "<find>",
    "      <p>เก่า</p>",
    "</find>",
    "<replace>",
    "</replace>",
    "</edit>",
  ].join("\n");

  it("emits an edit once its closing tag arrives, with every pair in order", () => {
    const p = new FileStreamParser();
    const cut = block.indexOf("<replace>\n</replace>");
    expect(p.push(`แก้หัวข้อ\n${block.slice(0, cut)}`).edits).toEqual([]);
    const out = p.push(`${block.slice(cut)}\nสรุป: เปลี่ยนหัวข้อแล้ว`);
    expect(out.edits).toEqual([
      {
        path: "src/pages/Dashboard.tsx",
        pairs: [
          { find: '      <h1 className="text-2xl">ภาพรวม</h1>', replace: '      <h1 className="text-3xl">ภาพรวมวันนี้</h1>' },
          { find: "      <p>เก่า</p>", replace: "" },
        ],
      },
    ]);
    expect(p.getReply()).toBe("สรุป: เปลี่ยนหัวข้อแล้ว");
  });

  it("keeps files, edits and deletes apart when they come in one chunk", () => {
    const p = new FileStreamParser();
    const out = p.push(`<file path="src/New.tsx">\nx\n</file>\n${block}\n<delete path="src/Old.tsx"/>`);
    expect(out.files.map((f) => f.path)).toEqual(["src/New.tsx"]);
    expect(out.edits.map((e) => e.path)).toEqual(["src/pages/Dashboard.tsx"]);
    expect(out.deletes).toEqual(["src/Old.tsx"]);
  });

  it("does not show a half-written edit as the reply", () => {
    const p = new FileStreamParser();
    p.push(`${block}\nเสร็จแล้ว\n<edit path="src/A.tsx">\n<find>\nx`);
    expect(p.getReply()).toBe("เสร็จแล้ว");
  });

  it("an edit with no pairs in it still arrives, and fails where it is applied", () => {
    const p = new FileStreamParser();
    expect(p.push('<edit path="src/A.tsx">\nเปลี่ยนสี\n</edit>').edits).toEqual([{ path: "src/A.tsx", pairs: [] }]);
  });
});

describe("salvageJsonFiles", () => {
  // The exact shape a drifting model produced in production: files as an ARRAY
  // of {path, content}. Zero <file> blocks parsed → the edit silently no-op'd.
  it("recovers files from the array shape and keeps the note", () => {
    const raw = JSON.stringify({
      files: [{ path: "src/components/Sidebar.tsx", content: "import { ScrollText } from 'x';" }],
      note: "ทำการลบเมนู BUDGET CONTROL แล้ว",
    });
    const out = salvageJsonFiles(raw);
    expect(out?.files).toEqual([
      { path: "src/components/Sidebar.tsx", content: "import { ScrollText } from 'x';" },
    ]);
    expect(out?.note).toBe("ทำการลบเมนู BUDGET CONTROL แล้ว");
  });

  it("recovers the {path: contents} map shape, deletes, and a markdown fence", () => {
    const raw = '```json\n' + JSON.stringify({
      files: { "src/App.tsx": "export default App;" },
      deleted: ["src/Old.tsx"],
    }) + "\n```";
    const out = salvageJsonFiles(raw);
    expect(out?.files).toEqual([{ path: "src/App.tsx", content: "export default App;" }]);
    expect(out?.deletes).toEqual(["src/Old.tsx"]);
    expect(out?.note).toBe("");
  });

  it("leaves normal prose alone", () => {
    expect(salvageJsonFiles("อยากให้แก้ตรงไหนครับ: สี หรือ เลย์เอาต์?")).toBeNull();
    expect(salvageJsonFiles("")).toBeNull();
  });

  it("does not treat a JSON object without files as a salvage", () => {
    expect(salvageJsonFiles('{"note":"ไม่มีอะไรต้องแก้"}')).toBeNull();
    expect(salvageJsonFiles('{"files":[{"path":"a.tsx"}]}')).toBeNull();
  });
});
