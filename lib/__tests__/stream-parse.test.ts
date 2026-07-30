import { describe, expect, it } from "vitest";
import { FileStreamParser, salvageJsonFiles } from "../stream-parse";

describe("FileStreamParser", () => {
  it("emits a file once its closing tag arrives", () => {
    const p = new FileStreamParser();
    expect(p.push('กำลังแก้…\n<file path="src/App.tsx">\nexport default App;')).toEqual({
      files: [],
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
