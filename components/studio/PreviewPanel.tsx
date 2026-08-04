"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  ExternalLink,
  Maximize2,
  Minimize2,
  Monitor,
  RotateCw,
  Smartphone,
  Tablet,
  Wand2,
} from "lucide-react";
import type { GenerationPhase } from "@/lib/types";
import type { WandTarget } from "@/lib/wand";
import type { MissingImport } from "@/lib/import-check";
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
  /* ——— Wand (absent for read-only viewers) ——— */
  wandOn?: boolean;
  /** True while an AI wand turn is running — the in-iframe frame pulses. */
  wandBusy?: boolean;
  onToggleWand?: () => void;
  /** An element was picked; `anchor` is already in page pixels. */
  onWandPick?: (target: WandTarget, anchor: { x: number; y: number; w: number; h: number }) => void;
  /** Leave wand mode entirely (Esc anywhere, or the ✕ on the mode bar). */
  onWandExit?: () => void;
  /** Bumped by the studio to clear a stale selection / re-measure after a patch. */
  wandNudge?: { clear: number; repaint: number };
  /** Imports with no file behind them — a guaranteed white screen. */
  missingFiles?: MissingImport[];
  onCreateMissingFiles?: () => void;
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
  wandOn = false,
  wandBusy = false,
  onToggleWand,
  onWandPick,
  onWandExit,
  wandNudge,
  missingFiles = [],
  onCreateMissingFiles,
}: PreviewPanelProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);
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

  // ——— Wand bridge ———
  // The preview is cross-origin, so selection lives in the iframe (the script the
  // canonical vite.config injects) and only crosses back as normalized rects.
  const tell = useCallback((msg: Record<string, unknown>) => {
    frameRef.current?.contentWindow?.postMessage(msg, "*");
  }, []);

  // Re-announce on every (re)load too: a fresh document starts with the wand off.
  useEffect(() => {
    tell({ __fittWand: wandOn });
  }, [wandOn, previewKey, url, tell]);
  useEffect(() => {
    tell({ __fittWandBusy: wandBusy });
  }, [wandBusy, tell]);

  // Esc must work from the studio side too — the iframe only sees it when the
  // demo has focus, and a user who just clicked the composer does not.
  useEffect(() => {
    if (!wandOn || !onWandExit) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      tell({ __fittWand: false });
      onWandExit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [wandOn, onWandExit, tell]);

  useEffect(() => {
    if (!onWandPick && !onWandExit) return;
    const onMessage = (e: MessageEvent) => {
      const d = e.data as
        | { __fittWandPick?: boolean; __fittWandExit?: boolean; rect?: WandTarget["rect"] }
        | null;
      if (!d) return;
      if (d.__fittWandExit) {
        onWandExit?.();
        return;
      }
      if (!d.__fittWandPick || !d.rect) return;
      const frame = frameRef.current?.getBoundingClientRect();
      if (!frame) return;
      // Normalized inside the iframe → page pixels, so the composer lands on the
      // element even with the panel resized or a banner pushing things down.
      onWandPick?.(d as unknown as WandTarget, {
        x: frame.left + d.rect.x * frame.width,
        y: frame.top + d.rect.y * frame.height,
        w: d.rect.w * frame.width,
        h: d.rect.h * frame.height,
      });
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onWandPick, onWandExit]);

  // Selection housekeeping driven by the studio (composer closed / patch applied).
  const nudge = wandNudge?.clear ?? 0;
  useEffect(() => {
    if (nudge) tell({ __fittWandClear: true });
  }, [nudge, tell]);
  const repaint = wandNudge?.repaint ?? 0;
  useEffect(() => {
    if (repaint) tell({ __fittWandRepaint: true });
  }, [repaint, tell]);

  // Highest-priority problem only. Missing files outrank the compile error they
  // cause (naming the files is what the user can act on); a runtime error
  // outranks the network hint, which is a guess.
  const [showAlso, setShowAlso] = useState(false);
  const liveError = runtimeError && !busyBoot ? runtimeError : null;
  const problem: {
    tone: "halt" | "warn";
    title: string;
    body: string;
    detail?: string;
    also?: string;
    action?: { label: string; run: () => void };
    dismiss?: () => void;
  } | null = missingFiles.length
    ? {
        tone: "warn",
        title: `ไฟล์หาย ${missingFiles.length}`,
        body: `${missingFiles.map((m) => m.expected).join(" · ")} — ถูก import ไว้แต่ยังไม่ถูกสร้าง`,
        detail: missingFiles.map((m) => `${m.expected}  ← ${m.from}`).join("\n"),
        also: liveError?.message,
        action: onCreateMissingFiles
          ? { label: "สร้างไฟล์ที่ขาด", run: onCreateMissingFiles }
          : undefined,
      }
    : liveError
      ? {
          tone: "halt",
          title: "แอปมี error",
          body: liveError.message,
          detail: liveError.message,
          action: onFixError ? { label: "ให้ AI แก้เลย", run: onFixError } : undefined,
          dismiss: onDismissError,
        }
      : netHint
        ? {
            tone: "warn",
            title: "เปิด preview ไม่ถึงเซิร์ฟเวอร์",
            body: "ถ้าจอว่างเปล่า เครือข่าย/ส่วนขยาย (proxy บริษัท, ad-blocker) อาจบล็อก webcontainer-api.io — ลองปิดตัวบล็อกหรือเปลี่ยนเครือข่ายแล้วโหลดหน้าใหม่",
          }
        : null;

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
        {onToggleWand && (
          <button
            onClick={onToggleWand}
            disabled={!url || phase !== "ready"}
            title="Wand — ชี้ element ในเดโมแล้วแก้ตรงจุด"
            className={`flex items-center gap-1.5 rounded-sm border px-2 py-1.5 font-display text-[11px] transition disabled:opacity-40 ${
              wandOn
                ? "border-shine bg-shine text-night"
                : "border-night-edge text-chalk-dim hover:text-shine"
            }`}
          >
            <Wand2 size={13} />
            Wand
          </button>
        )}
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

      {/* Wand mode is a modal state over someone's app — say so, and always show
          the way out (Esc is the shortcut, this is the affordance). */}
      {wandOn && (
        <div className="flex shrink-0 items-center gap-2.5 border-b border-shine/30 bg-shine/10 px-3 py-2">
          <Wand2 size={13} className="shrink-0 text-shine" />
          <span className="min-w-0 flex-1 text-[11px] leading-relaxed text-chalk">
            {wandBusy ? (
              <>กำลังเสก… แก้ไขเฉพาะจุดที่เลือกอยู่</>
            ) : (
              <>
                โหมด Wand — เลื่อนเมาส์บนเดโมแล้ว<b className="text-shine">คลิก element</b>ที่อยากแก้
              </>
            )}
          </span>
          <button
            onClick={onWandExit}
            className="shrink-0 rounded-md border border-shine/40 px-2 py-0.5 font-display text-[11px] text-chalk transition hover:bg-shine hover:text-night"
          >
            ออก (Esc)
          </button>
        </div>
      )}

      {/* ONE problem bar. A missing file and the compile error it causes are the
          same problem stated twice, and stacking bars pushes the demo off screen —
          so the most actionable diagnosis wins the slot and the rest stays one
          click away. */}
      {problem && (
        <div
          className={`flex shrink-0 items-center gap-2.5 border-b px-3 py-2 ${
            problem.tone === "halt"
              ? "border-halt/40 bg-halt/10"
              : "border-amber-400/40 bg-amber-400/10"
          }`}
        >
          <span
            className={`shrink-0 font-mono text-[11px] font-semibold ${
              problem.tone === "halt" ? "text-halt" : "text-amber-300"
            }`}
          >
            ⚠ {problem.title}
          </span>
          <span
            className="min-w-0 flex-1 truncate font-mono text-[11px] text-chalk-dim"
            title={problem.detail}
          >
            {problem.body}
          </span>
          {/* The cause we suppressed is still one click away, never lost. */}
          {problem.also && (
            <button
              onClick={() => setShowAlso((v) => !v)}
              className="shrink-0 rounded-md border border-night-edge px-2 py-0.5 font-display text-[11px] text-chalk-dim transition hover:text-chalk"
            >
              {showAlso ? "ซ่อน error" : "ดู error"}
            </button>
          )}
          {problem.action && (
            <button
              onClick={problem.action.run}
              className="shrink-0 rounded-md bg-shine px-2.5 py-1 font-display text-[12px] font-semibold text-night transition hover:brightness-110"
            >
              ✦ {problem.action.label}
            </button>
          )}
          {problem.dismiss && (
            <button
              onClick={problem.dismiss}
              aria-label="ปิดแจ้งเตือน"
              className="shrink-0 rounded-md px-1.5 py-1 text-[12px] text-chalk-dim transition hover:text-chalk"
            >
              ✕
            </button>
          )}
        </div>
      )}
      {problem?.also && showAlso && (
        <pre className="scroll-thin max-h-28 shrink-0 overflow-auto border-b border-night-edge bg-night px-3 py-2 font-mono text-[10px] leading-relaxed text-chalk-dim">
          {problem.also}
        </pre>
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
              ref={frameRef}
              key={previewKey}
              src={url}
              onLoad={() => tell({ __fittWand: wandOn })}
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
