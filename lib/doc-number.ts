/**
 * Formatting a workspace document number and the file it exports as.
 *
 * The number is three parts — a type prefix (decided here), the workspace's
 * own code, and a running sequence (issued once by the DB, see migration 0041).
 * "SQP" + "12605" + 2 → "SQP12605-0002". Pure so the panel and the print path
 * agree and so it can be tested without a database.
 */

export type DocType = "quotation" | "proposal";

/** ใบเสนอราคา → SQP · ข้อเสนอโครงการ → PRP. */
export const DOC_PREFIX: Record<DocType, string> = {
  quotation: "SQP",
  proposal: "PRP",
};

/**
 * "SQP12605-0002". The sequence is zero-padded to four digits — a running
 * number reads as a running number, and it sorts right in a file listing until
 * a workspace passes 9999 (at which point it simply grows, never truncates).
 */
export function formatDocNo(type: DocType, docCode: string, seq: number): string {
  const code = docCode.trim();
  const running = String(Math.max(0, Math.trunc(seq))).padStart(4, "0");
  return `${DOC_PREFIX[type]}${code}-${running}`;
}

/**
 * The .pdf a browser saves is named after document.title, so the export path
 * sets it to this. "SQP12605-0002-บริษัท พิธานไลฟ์ จำกัด" — the number first so
 * files sort by issue order, the customer after so a human can read the list.
 *
 * Characters that break a filename on Windows/macOS (\ / : * ? " < > |) are
 * stripped; Thai and spaces are kept, since every OS in use here allows them.
 * Either part alone when the other is missing: the number when there is no
 * customer yet, the customer when a personal project has issued no number.
 */
export function docFileName(docNo: string, customerName: string): string {
  const safe = (s: string) => s.replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, " ").trim();
  return [safe(docNo), safe(customerName)].filter(Boolean).join("-");
}
