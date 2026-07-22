import { describe, expect, it } from "vitest";
import { cellText, csvEscape, fileToAttachment, textToBase64 } from "@/lib/attachments";

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
