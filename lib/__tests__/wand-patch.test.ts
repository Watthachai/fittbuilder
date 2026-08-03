import { describe, expect, it } from "vitest";
import {
  bgAction,
  mergeClasses,
  patchClassName,
  patchText,
  textColorAction,
  textSizeAction,
} from "../wand-patch";
import { parseLoc, shortLoc, buildWandPrompt } from "../wand";

// Column is 0-based (Babel), line 1-based — the exact shape data-fitt-loc carries.
const FILE = `export default function Card() {
  return (
    <div className="rounded-xl bg-white p-4 text-sm text-slate-900">
      <button className="bg-blue-500 text-white">บันทึก</button>
    </div>
  );
}
`;
const DIV = "src/Card.tsx:3:4";
const BTN = "src/Card.tsx:4:6";

describe("parseLoc / shortLoc", () => {
  it("splits path, line and column", () => {
    expect(parseLoc("src/components/orders/OrderTable.tsx:64:8")).toEqual({
      path: "src/components/orders/OrderTable.tsx",
      line: 64,
    });
    expect(shortLoc("src/components/orders/OrderTable.tsx:64:8")).toBe("OrderTable.tsx:64");
  });
});

describe("mergeClasses", () => {
  it("replaces the conflicting family and keeps the rest", () => {
    expect(mergeClasses("rounded-xl bg-white p-4 text-sm", bgAction("bg-red-500", "แดง"))).toBe(
      "rounded-xl p-4 text-sm bg-red-500"
    );
  });

  it("does not treat a text size as a text colour", () => {
    const out = mergeClasses("text-sm text-slate-900", textColorAction("text-red-600", "แดง"));
    expect(out).toContain("text-sm");
    expect(out).not.toContain("text-slate-900");
  });

  it("does not treat a text colour as a text size", () => {
    const out = mergeClasses("text-sm text-slate-900", textSizeAction("text-lg"));
    expect(out).toContain("text-slate-900");
    expect(out).not.toContain("text-sm");
  });
});

describe("patchClassName", () => {
  it("patches the element at the given line/column, not the first match in the file", () => {
    const out = patchClassName(FILE, BTN, bgAction("bg-red-500", "แดง"))!;
    expect(out).toContain('<button className="text-white bg-red-500">');
    expect(out).toContain('<div className="rounded-xl bg-white p-4 text-sm text-slate-900">');
  });

  it("adds className when the element has none", () => {
    const src = `const A = () => <span>hi</span>;\n`;
    expect(patchClassName(src, "src/A.tsx:1:16", bgAction("bg-red-500", "แดง"))).toBe(
      `const A = () => <span className="bg-red-500">hi</span>;\n`
    );
  });

  it("refuses a dynamic className instead of guessing", () => {
    const src = `const A = () => <span className={cx("a", b)}>hi</span>;\n`;
    expect(patchClassName(src, "src/A.tsx:1:16", bgAction("bg-red-500", "แดง"))).toBeNull();
  });

  it("returns null when the position does not point at a tag", () => {
    expect(patchClassName(FILE, "src/Card.tsx:99:0", bgAction("bg-red-500", "แดง"))).toBeNull();
  });
});

describe("patchText", () => {
  it("replaces literal text children", () => {
    expect(patchText(FILE, BTN, "ยืนยัน")).toContain(">ยืนยัน</button>");
  });

  it("refuses children that contain markup or expressions", () => {
    expect(patchText(FILE, DIV, "nope")).toBeNull();
  });
});

describe("buildWandPrompt", () => {
  it("names the file, line and element so the model edits one place", () => {
    const p = buildWandPrompt(
      {
        loc: "src/components/orders/OrderTable.tsx:64:8",
        tag: "button",
        className: "bg-blue-500",
        text: "บันทึก",
        rect: { x: 0, y: 0, w: 0.2, h: 0.1 },
      },
      "ทำให้เป็นปุ่มไล่เฉดแดง-ส้ม"
    );
    expect(p).toContain("src/components/orders/OrderTable.tsx (บรรทัด 64)");
    expect(p).toContain("<button>");
    expect(p).toContain("ทำให้เป็นปุ่มไล่เฉดแดง-ส้ม");
    expect(p).toContain("ห้ามแตะส่วนอื่นของแอป");
  });
});
