"use client";

import { useEffect } from "react";

/**
 * Last-resort boundary: catches crashes in the root layout itself. Replaces the
 * whole document, so it must render its own <html>/<body> and stay
 * self-contained (inline styles — globals.css is not applied here).
 */
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[fitt] global error boundary:", error);
  }, [error]);

  return (
    <html lang="th">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#050505",
          color: "#e8e8e8",
          fontFamily: "'Anuphan', 'Inter', system-ui, sans-serif",
          textAlign: "center",
          padding: "24px",
        }}
      >
        <div
          style={{
            maxWidth: 520,
            width: "100%",
            border: "1px solid #232323",
            borderRadius: 16,
            background: "#101010",
            padding: "28px 32px",
          }}
        >
          <p style={{ margin: 0, fontFamily: "monospace", fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: "#f87171" }}>
            Error
          </p>
          <h1 style={{ margin: "6px 0 0", fontSize: 18, fontWeight: 600 }}>เกิดข้อผิดพลาดที่ไม่คาดคิด</h1>
          <p style={{ margin: "6px 0 0", fontSize: 13, lineHeight: 1.6, color: "#9a9a9a" }}>
            แอปหยุดทำงานกลางคัน — ลองกด “ลองใหม่” ก่อน ถ้ายังไม่หายให้โหลดหน้าใหม่
            แล้วส่งข้อความ error ด้านล่างให้ทีมงานช่วยตรวจ
          </p>
          <pre
            style={{
              margin: "16px 0 0",
              maxHeight: 160,
              overflow: "auto",
              border: "1px solid #232323",
              borderRadius: 8,
              background: "#050505",
              padding: 12,
              textAlign: "left",
              fontFamily: "monospace",
              fontSize: 11,
              lineHeight: 1.6,
              color: "#9a9a9a",
              whiteSpace: "pre-wrap",
            }}
          >
            {error.message}
            {error.digest ? `\n\ndigest: ${error.digest}` : ""}
          </pre>
          <div style={{ marginTop: 20, display: "flex", gap: 8, justifyContent: "center" }}>
            <button
              onClick={() => unstable_retry()}
              style={{
                border: "none",
                borderRadius: 8,
                background: "#64cefb",
                color: "#050505",
                padding: "8px 16px",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              ลองใหม่
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{
                borderRadius: 8,
                border: "1px solid #232323",
                background: "transparent",
                color: "#9a9a9a",
                padding: "8px 16px",
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              โหลดหน้าใหม่
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
