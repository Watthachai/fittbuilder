"use client";

import { useEffect, useRef, useState } from "react";
import { bootFiles } from "@/lib/files";
import { decodeShareFragment, getSharedDemo, type SharePayload } from "@/lib/share";
import type { GenerationPhase } from "@/lib/types";
import { isPreviewSupported, runProject } from "@/lib/webcontainer";

/**
 * Public demo viewer — rebuilds a shared demo in a WebContainer, no account
 * needed. The payload arrives one of two ways:
 *
 * - `token` (short link `/share/<token>`): fetched from the database.
 * - URL fragment (`/share#…`): the whole project rides in the fragment
 *   (BR-003) — still produced by pop-out-in-a-new-tab and older links.
 */
export default function ShareViewer({ token }: { token?: string }) {
  const [payload, setPayload] = useState<SharePayload | null>(null);
  const [phase, setPhase] = useState<GenerationPhase | "loading">("loading");
  const [url, setUrl] = useState<string | null>(null);
  // The server is up seconds before the demo has drawn anything; the loading
  // card stays over the frame until the demo says it has (or that it failed).
  const [loaded, setLoaded] = useState(false);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [error, setError] = useState<string | null>(null);
  const bootedRef = useRef(false);

  useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;

    void (async () => {
      let decoded: SharePayload;
      if (token) {
        try {
          decoded = await getSharedDemo(token);
        } catch {
          setError("ลิงก์แชร์ไม่ถูกต้องหรือหมดอายุ — ขอลิงก์ใหม่จากผู้ส่ง");
          return;
        }
      } else {
        const fragment = window.location.hash.slice(1);
        if (!fragment) {
          setError("ลิงก์นี้ไม่มีข้อมูลโปรเจกต์");
          return;
        }
        try {
          decoded = await decodeShareFragment(fragment);
        } catch {
          setError("ลิงก์แชร์เสียหายหรือไม่สมบูรณ์ — ขอลิงก์ใหม่จากผู้ส่ง");
          return;
        }
      }
      setPayload(decoded);
      if (!isPreviewSupported()) {
        setError(
          "เบราว์เซอร์นี้ไม่รองรับ live preview — เปิดด้วย Chrome หรือ Edge เวอร์ชันล่าสุด"
        );
        return;
      }
      setPhase("installing");
      // The studio's boot, so the customer sees the demo the sender saw.
      await runProject(bootFiles(decoded.files), {
        onPhase: setPhase,
        onTerminal: () => {},
        onServerReady: setUrl,
        onError: (message) => setError(message),
      });
    })();
  }, [token]);

  // The demo's injected scripts post __fittRendered once its first screen is
  // drawn, and __fittPreviewError when it fails — after either, the card has
  // nothing left to wait for and would only hide what the demo shows.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frameRef.current?.contentWindow) return;
      const data = event.data as { __fittRendered?: boolean; __fittPreviewError?: boolean } | null;
      if (data?.__fittRendered || data?.__fittPreviewError) setLoaded(true);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
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
      </header>

      <div className="bg-grid relative min-h-0 flex-1">
        {error ? (
          <Center>
            <p className="font-display text-lg text-halt">{error}</p>
          </Center>
        ) : (
          <>
            {url && (
              <iframe
                src={url}
                sandbox="allow-scripts allow-same-origin allow-forms"
                className="h-full w-full bg-chalk"
                title={payload?.name ?? "Shared demo"}
                ref={frameRef}
              />
            )}
            {!loaded && (
              <div className="bg-grid absolute inset-0">
                <Center>
                  <Steps current={phase === "loading" ? 0 : phase === "installing" ? 1 : 2} />
                  <p className="mt-5 max-w-xs text-xs leading-relaxed text-chalk-dim">
                    ครั้งแรกอาจใช้เวลา 20–60 วินาที ขึ้นกับความเร็วอินเทอร์เน็ต
                    <br />
                    เดโมทำงานในเบราว์เซอร์ของคุณ ไม่มีข้อมูลถูกส่งออกไป
                  </p>
                </Center>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const STEPS = ["เตรียมเดโม", "ติดตั้งส่วนประกอบ", "เปิดระบบ"];

/** Where the demo is on its way up, so a minute of waiting reads as progress. */
function Steps({ current }: { current: number }) {
  return (
    <ol className="space-y-2.5 text-left">
      {STEPS.map((label, i) => (
        <li key={label} className="flex items-center gap-3 font-display text-sm">
          <span
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
              i < current ? "bg-go text-night" : i === current ? "bg-shine text-night" : "border border-night-edge text-chalk-dim"
            }`}
          >
            {i < current ? "✓" : i + 1}
          </span>
          <span className={i === current ? "animate-pulse text-chalk" : i < current ? "text-chalk/70" : "text-chalk-dim"}>
            {label}
            {i === current && "…"}
          </span>
        </li>
      ))}
    </ol>
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
