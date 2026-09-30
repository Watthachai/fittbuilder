"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { thaiDateShort } from "@/lib/quote";

/**
 * A phase document (BRD, PRD, …) on paper. Same construction as QuotationPrint —
 * a portal onto document.body, the fixed light palette of `.fitt-paper`, and one
 * <table> so the running head repeats on every printed page.
 *
 * The markdown is rendered with plain elements, not the chat renderer: that one
 * is styled for the midnight theme, and a document someone hands to a customer
 * must not change when the app's theme does.
 */
export default function DocPrint({
  label,
  projectName,
  printedAt,
  content,
}: {
  label: string;
  projectName: string;
  /** ISO date the sheet was printed. */
  printedAt: string;
  content: string;
}) {
  return (
    <div id="fitt-print-root" className="fitt-paper">
      <table className="q-sheet">
        <thead>
          <tr>
            <td>
              <div className="d-head">
                <span>{projectName}</span>
                <span>
                  {label} · พิมพ์ {thaiDateShort(printedAt)}
                </span>
              </div>
            </td>
          </tr>
        </thead>
        <tfoot>
          <tr>
            <td />
          </tr>
        </tfoot>
        <tbody>
          <tr>
            <td>
              <div className="d-doc">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
