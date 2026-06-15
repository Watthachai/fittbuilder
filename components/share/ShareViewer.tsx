"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { decodeShareFragment, type SharePayload } from "@/lib/share";
import type { GenerationPhase } from "@/lib/types";
import { isPreviewSupported, runProject } from "@/lib/webcontainer";

/**
 * Public demo viewer (BR-003) — the entire project travels in the URL
 * fragment, so no account or server storage is needed to view a share.
 */
export default function ShareViewer() {
  const [payload, setPayload] = useState<SharePayload | null>(null);
  const [phase, setPhase] = useState<GenerationPhase | "loading">("loading");
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bootedRef = useRef(false);

  useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;

    void (async () => {
      const fragment = window.location.hash.slice(1);
      if (!fragment) {
        setError("ลิงก์นี้ไม่มีข้อมูล demo");
        return;
      }
      let decoded: SharePayload;
      try {
        decoded = await decodeShareFragment(fragment);
      } catch {
        setError("ลิงก์แชร์เสียหายหรือไม่สมบูรณ์ — ขอลิงก์ใหม่จากผู้ส่ง");
        return;
      }
      setPayload(decoded);
      if (!isPreviewSupported()) {
        setError(
          "เบราว์เซอร์นี้ไม่รองรับ live preview — เปิดด้วย Chrome หรือ Edge เวอร์ชันล่าสุด"
        );
        return;
      }
      setPhase("installing");
      await runProject(decoded.files, {
        onPhase: setPhase,
        onTerminal: () => {},
        onServerReady: setUrl,
        onError: (message) => setError(message),
      });
    })();
  }, []);

  return (
    <div className="flex h-dvh flex-col bg-night text-chalk">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-night-edge bg-night-panel px-4">
        <div className="flex items-center gap-3">
          <span className="font-display text-sm font-bold">
            P<span className="text-shine">B</span>
          </span>
          <span className="text-night-edge">/</span>
          <span className="font-display text-sm">{payload?.name ?? "Demo"}</span>
          {url && <span className="live-dot ml-1 h-1.5 w-1.5 rounded-full bg-go" />}
        </div>
        <Link
          href="/"
          className="rounded-sm bg-shine px-3 py-1.5 font-display text-xs font-semibold text-black transition hover:bg-shine-soft"
        >
          สร้างของคุณเองฟรี →
        </Link>
      </header>

      <div className="bg-grid min-h-0 flex-1">
        {error ? (
          <Center>
            <p className="font-display text-lg text-halt">{error}</p>
          </Center>
        ) : url ? (
          <iframe
            src={url}
            sandbox="allow-scripts allow-same-origin allow-forms"
            className="h-full w-full bg-white"
            title={payload?.name ?? "Shared demo"}
          />
        ) : (
          <Center>
            <p className="animate-pulse font-display text-lg">
              {phase === "loading"
                ? "กำลังเปิด demo…"
                : phase === "installing"
                  ? "กำลังติดตั้ง dependencies…"
                  : "กำลังเปิดเซิร์ฟเวอร์…"}
            </p>
            <p className="mt-2 font-mono text-[11px] text-chalk-dim">
              demo รันในเครื่องคุณ 100% — ไม่มีอะไรถูกอัปโหลด
            </p>
          </Center>
        )}
      </div>
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-8 text-center">
      <div className="rounded-2xl border border-night-edge bg-night-panel px-10 py-8">
        {children}
      </div>
    </div>
  );
}
