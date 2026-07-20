"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ExternalLink,
  Maximize2,
  Minimize2,
  Monitor,
  RotateCw,
  Smartphone,
  Tablet,
} from "lucide-react";
import type { GenerationPhase } from "@/lib/types";
import BuildingLoader from "./BuildingLoader";

type Viewport = "mobile" | "tablet" | "desktop";

const VIEWPORTS: { id: Viewport; label: string; width: number | null; icon: typeof Monitor }[] = [
  { id: "mobile", label: "375px", width: 375, icon: Smartphone },
  { id: "tablet", label: "768px", width: 768, icon: Tablet },
  { id: "desktop", label: "100%", width: null, icon: Monitor },
];

interface PreviewPanelProps {
  url: string | null;
  previewKey: number;
  phase: GenerationPhase;
  supported: boolean;
  /** Runtime error reported from inside the demo iframe (error bridge). */
  runtimeError: { message: string } | null;
  /** Feed the runtime error into an AI fix turn (absent for read-only viewers). */
  onFixError?: () => void;
  onDismissError: () => void;
  onRefresh: () => void;
  /** Open the demo in its own tab (via a portable /share link). */
  onPopOut: () => void;
}

export default function PreviewPanel({
  url,
  previewKey,
  phase,
  supported,
  runtimeError,
  onFixError,
  onDismissError,
  onRefresh,
  onPopOut,
}: PreviewPanelProps) {
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const active = VIEWPORTS.find((v) => v.id === viewport)!;
  const rootRef = useRef<HTMLDivElement>(null);
  const [isFs, setIsFs] = useState(false);
  // During a mid-session reboot (deps install, undo, rework) the old dev server
  // is already dead but `url` still points at it — showing the iframe then is a
  // guaranteed white screen for the whole install. Show the loader instead.
  const busyBoot = phase === "generating" || phase === "installing" || phase === "starting";

  // Network watchdog: server-ready is an in-container event — it fires green
  // even when the user's network (corporate proxy, ad-blocker) blocks
  // *.webcontainer-api.io, leaving a silently white iframe. Probe the preview
  // origin once per (re)load; a stale result never shows because the hint is
  // keyed to the exact url+load it probed.
  const [probeFailed, setProbeFailed] = useState<string | null>(null);
  useEffect(() => {
    if (!url || phase !== "ready") return;
    const key = `${url}#${previewKey}`;
    let cancelled = false;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10_000);
    fetch(url, { mode: "no-cors", cache: "no-store", signal: ctrl.signal })
      .then(() => {
        if (!cancelled) setProbeFailed(null);
      })
      .catch(() => {
        if (!cancelled) setProbeFailed(key);
      })
      .finally(() => clearTimeout(timer));
    return () => {
      cancelled = true;
      ctrl.abort();
      clearTimeout(timer);
    };
  }, [url, previewKey, phase]);
  const netHint = probeFailed !== null && probeFailed === `${url}#${previewKey}`;

  // Fullscreen the whole panel (toolbar stays usable; Esc exits via the browser).
  useEffect(() => {
    const onChange = () => setIsFs(document.fullscreenElement === rootRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  const toggleFs = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void rootRef.current?.requestFullscreen?.();
  };

  return (
    <div ref={rootRef} className="flex min-h-0 flex-1 flex-col bg-night">
      {/* Toolbar */}
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-night-edge bg-night-panel px-3">
        <div className="flex items-center rounded-sm border border-night-edge p-0.5">
          {VIEWPORTS.map((v) => (
            <button
              key={v.id}
              onClick={() => setViewport(v.id)}
              title={v.label}
              className={`rounded-[2px] px-2 py-1 transition ${
                viewport === v.id ? "bg-shine text-night" : "text-chalk-dim hover:text-chalk"
              }`}
            >
              <v.icon size={13} />
            </button>
          ))}
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-sm border border-night-edge bg-night px-2.5 py-1">
          {url && phase === "ready" && (
            <span className="live-dot h-1.5 w-1.5 shrink-0 rounded-full bg-go" />
          )}
          <span className="truncate font-mono text-[11px] text-chalk-dim">
            {url ?? "รอ dev server…"}
          </span>
        </div>
        <button
          onClick={onRefresh}
          disabled={!url}
          title="โหลด preview ใหม่"
          className="rounded-sm border border-night-edge p-1.5 text-chalk-dim transition hover:text-chalk disabled:opacity-40"
        >
          <RotateCw size={13} />
        </button>
        <button
          onClick={toggleFs}
          disabled={!url}
          title={isFs ? "ออกจากเต็มจอ" : "ดูเต็มจอ"}
          className="rounded-sm border border-night-edge p-1.5 text-chalk-dim transition hover:text-chalk disabled:opacity-40"
        >
          {isFs ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
        </button>
        <button
          onClick={onPopOut}
          disabled={!url}
          title="เปิดในแท็บใหม่"
          className="rounded-sm border border-night-edge p-1.5 text-chalk-dim transition hover:text-chalk disabled:opacity-40"
        >
          <ExternalLink size={13} />
        </button>
      </div>

      {/* Runtime error from inside the demo (error bridge) → actionable banner
          instead of a silent white iframe. */}
      {runtimeError && !busyBoot && (
        <div className="flex shrink-0 items-center gap-2.5 border-b border-halt/40 bg-halt/10 px-3 py-2">
          <span className="shrink-0 font-mono text-[11px] font-semibold text-halt">⚠ แอปมี error</span>
          <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-chalk-dim" title={runtimeError.message}>
            {runtimeError.message}
          </span>
          {onFixError && (
            <button
              onClick={onFixError}
              className="shrink-0 rounded-md bg-shine px-2.5 py-1 font-display text-[12px] font-semibold text-night transition hover:brightness-110"
            >
              ✦ ให้ AI แก้เลย
            </button>
          )}
          <button
            onClick={onDismissError}
            aria-label="ปิดแจ้งเตือน"
            className="shrink-0 rounded-md px-1.5 py-1 text-[12px] text-chalk-dim transition hover:text-chalk"
          >
            ✕
          </button>
        </div>
      )}
      {netHint && !runtimeError && !busyBoot && (
        <div className="shrink-0 border-b border-amber-400/30 bg-amber-400/10 px-3 py-2 text-[11px] leading-relaxed text-amber-200">
          เปิด preview ไม่ถึงเซิร์ฟเวอร์ — ถ้าจอว่างเปล่า เครือข่าย/ส่วนขยาย (proxy บริษัท,
          ad-blocker) อาจบล็อกโดเมน <span className="font-mono">webcontainer-api.io</span> ลองปิดตัวบล็อกหรือเปลี่ยนเครือข่ายแล้วโหลดหน้าใหม่
        </div>
      )}

      {/* Stage */}
      <div className="bg-grid flex min-h-0 flex-1 items-stretch justify-center overflow-hidden p-0">
        {!supported ? (
          <CenterNote
            title="เบราว์เซอร์นี้ไม่รองรับ live preview"
            body="ถ้าเพิ่งเปิดหน้านี้ อาจยังโหลดไม่เสร็จ — ลองโหลดหน้าใหม่ดูก่อน ต้องใช้ Chrome/Edge เวอร์ชันล่าสุด (cross-origin isolation) · ระหว่างนี้ดูและแก้โค้ดได้ในแท็บ Code"
            action={
              <button
                onClick={() => window.location.reload()}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-halt px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:brightness-110"
              >
                <RotateCw size={15} /> โหลดหน้าใหม่
              </button>
            }
          />
        ) : url && !busyBoot ? (
          <div
            className="my-0 flex h-full justify-center transition-all"
            style={{ width: isFs || !active.width ? "100%" : `${active.width}px` }}
          >
            <iframe
              key={previewKey}
              src={url}
              sandbox="allow-scripts allow-same-origin allow-forms"
              className={`h-full w-full bg-chalk ${!isFs && active.width ? "border-x border-night-edge" : ""}`}
              title="Demo preview"
            />
          </div>
        ) : phase === "error" ? (
          <CenterNote title="เกิดข้อผิดพลาด — ดูรายละเอียดที่แถบด้านล่าง" />
        ) : (
          <BuildingLoader phase={phase} />
        )}
      </div>
    </div>
  );
}

function CenterNote({
  title,
  body,
  pulse,
  action,
}: {
  title: string;
  body?: string;
  pulse?: boolean;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 self-center px-8 text-center">
      <div className="max-w-sm rounded-2xl border border-night-edge bg-night-panel px-8 py-6">
        <p className={`font-display text-[15px] text-chalk ${pulse ? "animate-pulse" : ""}`}>
          {title}
        </p>
        {body && <p className="mt-1.5 text-[13px] leading-relaxed text-chalk-dim">{body}</p>}
        {action}
      </div>
    </div>
  );
}
