"use client";

import { useEffect } from "react";

/**
 * Route-level error boundary (wraps every page below the root layout). Without
 * this, any uncaught render error unmounts the React tree into a silent white
 * page — and if the crashing state is persisted (e.g. a chat message that the
 * renderer trips on), reloading crashes again forever. This turns that into a
 * recoverable screen that shows the real error.
 */
export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[fitt] route error boundary:", error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-night px-6 text-center">
      <div className="w-full max-w-lg rounded-2xl border border-night-edge bg-night-panel px-8 py-7">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-halt">Error</p>
        <h1 className="mt-1.5 font-display text-lg font-semibold text-chalk">
          เกิดข้อผิดพลาดที่ไม่คาดคิด
        </h1>
        <p className="mt-1.5 text-[13px] leading-relaxed text-chalk-dim">
          หน้านี้หยุดทำงานกลางคัน — ลองกด “ลองใหม่” ก่อน ถ้ายังไม่หายให้โหลดหน้าใหม่
          แล้วส่งข้อความ error ด้านล่างให้ทีมงานช่วยตรวจได้เลย
        </p>
        <pre className="scroll-thin mt-4 max-h-40 overflow-auto rounded-lg border border-night-edge bg-night p-3 text-left font-mono text-[11px] leading-relaxed text-chalk-dim">
          {error.message}
          {error.digest ? `\n\ndigest: ${error.digest}` : ""}
        </pre>
        <div className="mt-5 flex items-center justify-center gap-2">
          <button
            onClick={() => unstable_retry()}
            className="rounded-lg bg-shine px-4 py-2 font-display text-sm font-semibold text-night transition hover:brightness-110"
          >
            ลองใหม่
          </button>
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg border border-night-edge px-4 py-2 text-sm text-chalk-dim transition hover:text-chalk"
          >
            โหลดหน้าใหม่
          </button>
        </div>
      </div>
    </main>
  );
}
