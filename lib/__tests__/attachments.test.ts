import { describe, expect, it } from "vitest";
import {
  base64ToText,
  cellText,
  csvEscape,
  wasTruncated,
  fileToAttachment,
  TEXT_TRUNCATED_NOTE,
  textToBase64,
} from "@/lib/attachments";
import { ATTACHMENT_TEXT_MAX_CHARS } from "@/lib/limits";
import { buildSpecContext } from "@/lib/context-builder";

describe("csvEscape", () => {
  it("passes plain fields through", () => {
    expect(csvEscape("ยอดขาย")).toBe("ยอดขาย");
  });
  it("quotes fields containing delimiters, quotes, or newlines", () => {
    expect(csvEscape("a,b")).toBe('"a,b"');
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
    expect(csvEscape("two\nlines")).toBe('"two\nlines"');
  });
});

describe("cellText", () => {
  it("handles primitives and empties", () => {
    expect(cellText(null)).toBe("");
    expect(cellText(undefined)).toBe("");
    expect(cellText(42)).toBe("42");
    expect(cellText("x")).toBe("x");
    expect(cellText(true)).toBe("true");
  });
  it("flattens exceljs object cells (rich text, formula, hyperlink text)", () => {
    expect(cellText({ richText: [{ text: "สอง" }, { text: "ส่วน" }] })).toBe("สองส่วน");
    expect(cellText({ result: 7 })).toBe("7");
    expect(cellText({ text: "label", hyperlink: "https://x" })).toBe("label");
  });
  it("formats dates as yyyy-mm-dd", () => {
    expect(cellText(new Date("2026-07-22T10:00:00Z"))).toBe("2026-07-22");
  });
});

describe("textToBase64", () => {
  it("round-trips Thai text (btoa alone would corrupt it)", () => {
    const s = 'สวัสดี, "โลก"\nบรรทัดใหม่';
    expect(Buffer.from(textToBase64(s), "base64").toString("utf8")).toBe(s);
  });
});

describe("fileToAttachment (Excel)", () => {
  it("flattens a real .xlsx workbook to CSV text the model can read", async () => {
    const mod = await import("exceljs");
    const ExcelJS = (mod as unknown as { default?: typeof mod }).default ?? mod;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("ยอดขาย");
    ws.addRow(["เดือน", "ยอด"]);
    ws.addRow(["ม.ค.", 1200]);
    ws.addRow(["ก.พ., โปรพิเศษ", 900]); // comma in cell → must be quoted
    const buf = await wb.xlsx.writeBuffer();
    const file = new File([buf as ArrayBuffer], "sales.xlsx");

    const att = await fileToAttachment(file);
    expect(att.mimeType).toBe("text/csv");
    expect(att.name).toBe("sales.xlsx.csv");
    const text = Buffer.from(att.data, "base64").toString("utf8");
    expect(text).toContain("=== ชีต: ยอดขาย ===");
    expect(text).toContain("เดือน,ยอด");
    expect(text).toContain("ม.ค.,1200");
    expect(text).toContain('"ก.พ., โปรพิเศษ",900');
  });

  it("rejects legacy .xls with a fix-it message", async () => {
    const file = new File([new Uint8Array([1, 2, 3])], "old.xls");
    await expect(fileToAttachment(file)).rejects.toThrow(/\.xlsx หรือ \.csv/);
  });
});

describe("text attachments · cut with a marker, never silently", () => {
  it("base64ToText is the inverse of textToBase64, Thai included", () => {
    const s = 'สเปคหน้าเว็บ — สี #DCFF00, ขนาด 640px\n"บรรทัดใหม่"';
    expect(base64ToText(textToBase64(s))).toBe(s);
  });

  it("says nothing was cut when the whole file fits", () => {
    const text = "a".repeat(500);
    expect(wasTruncated({ name: "spec.md", mimeType: "text/markdown", data: textToBase64(text) })).toBe(
      false
    );
  });

  it("says it was cut when the marker is there", () => {
    const kept = "a".repeat(200) + TEXT_TRUNCATED_NOTE;
    expect(wasTruncated({ name: "spec.md", mimeType: "text/markdown", data: textToBase64(kept) })).toBe(
      true
    );
  });

  it("never claims an image or PDF was cut", () => {
    for (const mimeType of ["image/png", "application/pdf"]) {
      expect(wasTruncated({ name: "x", mimeType, data: "" })).toBe(false);
    }
  });

  it("caps a real oversized workbook and leaves the marker in the text", async () => {
    const mod = await import("exceljs");
    const ExcelJS = (mod as unknown as { default?: typeof mod }).default ?? mod;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("ยาว");
    // 1000 rows is the sheet cap, so the cells carry the length.
    for (let i = 0; i < 1000; i += 1) ws.addRow([`แถวที่ ${i}`, "x".repeat(200)]);
    const file = new File([(await wb.xlsx.writeBuffer()) as ArrayBuffer], "big.xlsx");

    const att = await fileToAttachment(file);
    const text = base64ToText(att.data);
    expect(text.length).toBeLessThanOrEqual(ATTACHMENT_TEXT_MAX_CHARS);
    expect(text.endsWith(TEXT_TRUNCATED_NOTE)).toBe(true);
    expect(wasTruncated(att)).toBe(true);
  });
});

describe("the brief covers what was attached to it", () => {
  const ctx = buildSpecContext({ brief: "สร้างตามไฟล์ที่แนบ" })!;

  it("tells the builder an attached file is part of the brief", () => {
    expect(ctx).toMatch(/Any FILE ATTACHED to this turn is part of this brief/);
    // The whole reason to attach rather than type: length is not a downgrade.
    expect(ctx).toMatch(/whatever its length/);
  });

  it("tells it to admit a cut file rather than fill in the gap", () => {
    expect(ctx).toMatch(/say so in your reply rather than inventing/);
  });
});
