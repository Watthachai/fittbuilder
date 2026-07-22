import type { ChatAttachmentInput } from "@/lib/types";

/** Max size for a single uploaded attachment (routes cap the base64 payload separately). */
export const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024;

/** Shared accept list for every attachment picker (chat, LaunchPad, Org DNA). */
export const ATTACHMENT_ACCEPT = "image/*,application/pdf,text/*,.md,.json,.csv,.xlsx";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
/** Rows kept per sheet / total text kept when flattening a workbook to CSV. */
const SHEET_ROW_LIMIT = 1_000;
const SHEET_TEXT_LIMIT = 200_000;

/** Flatten an exceljs cell value (rich text, formula result, hyperlink, Date) to plain text. */
export function cellText(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    const o = v as {
      richText?: { text: string }[];
      text?: unknown;
      result?: unknown;
      error?: unknown;
    };
    if (Array.isArray(o.richText)) return o.richText.map((r) => r.text).join("");
    if (o.text !== undefined) return String(o.text);
    if (o.result !== undefined) return cellText(o.result);
    if (o.error !== undefined) return String(o.error);
    return "";
  }
  return String(v);
}

/** Quote a CSV field when it contains a delimiter, quote, or newline. */
export function csvEscape(s: string): string {
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** UTF-8 text → base64 (btoa alone corrupts non-ASCII, e.g. Thai). */
export function textToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/**
 * Excel → CSV text. Gemini cannot read spreadsheet binaries inline (the model
 * would see only bytes, not data — users reported "แนบ Excel แล้ว AI ไม่อ่าน"),
 * so workbooks are flattened to CSV in the browser before upload. exceljs is
 * dynamically imported to keep it out of the initial bundle.
 */
async function xlsxToCsvAttachment(file: File): Promise<ChatAttachmentInput> {
  // exceljs is CJS — with bundler interop the namespace may or may not carry
  // a `default`, so resolve whichever is present.
  const mod = await import("exceljs");
  const ExcelJS = (mod as unknown as { default?: typeof mod }).default ?? mod;
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(await file.arrayBuffer());
  } catch {
    throw new Error(`อ่าน "${file.name}" ไม่สำเร็จ — ไฟล์อาจเสียหายหรือติดรหัสผ่าน`);
  }
  let out = "";
  let truncated = false;
  for (const ws of wb.worksheets) {
    if (out.length >= SHEET_TEXT_LIMIT) {
      truncated = true;
      break;
    }
    out += `=== ชีต: ${ws.name} ===\n`;
    let rows = 0;
    ws.eachRow({ includeEmpty: false }, (row) => {
      if (rows >= SHEET_ROW_LIMIT || out.length >= SHEET_TEXT_LIMIT) {
        truncated = true;
        return;
      }
      rows += 1;
      const values = Array.isArray(row.values) ? row.values.slice(1) : [];
      out += values.map((v) => csvEscape(cellText(v))).join(",") + "\n";
    });
    out += "\n";
  }
  if (truncated)
    out += `(ข้อมูลยาวเกิน — แสดงสูงสุด ${SHEET_ROW_LIMIT.toLocaleString()} แถวต่อชีต ส่วนเกินถูกตัดออก)\n`;
  return { name: `${file.name}.csv`, mimeType: "text/csv", data: textToBase64(out) };
}

/**
 * Read a browser File into the base64 ChatAttachmentInput the AI routes accept.
 * Excel files are transparently converted to CSV text (see xlsxToCsvAttachment);
 * legacy .xls is rejected with a fix-it message. May throw a user-facing (Thai)
 * Error — pickers surface it as a toast/inline error.
 */
export async function fileToAttachment(file: File): Promise<ChatAttachmentInput> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".xlsx") || file.type === XLSX_MIME) return xlsxToCsvAttachment(file);
  if (lower.endsWith(".xls"))
    throw new Error(
      `"${file.name}" เป็น Excel รุ่นเก่า (.xls) — เปิดใน Excel แล้ว Save As เป็น .xlsx หรือ .csv ก่อนแนบ`
    );
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
  return {
    name: file.name,
    mimeType: file.type || "application/octet-stream",
    data: dataUrl.split(",")[1] ?? "",
  };
}
