"use client";

import { useState } from "react";
import { ExternalLink, Monitor, RotateCw, Smartphone, Tablet } from "lucide-react";
import type { GenerationPhase } from "@/lib/types";

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
  hasFiles: boolean;
  onRefresh: () => void;
}

export default function PreviewPanel({
  url,
  previewKey,
  phase,
  supported,
  hasFiles,
  onRefresh,
}: PreviewPanelProps) {
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const active = VIEWPORTS.find((v) => v.id === viewport)!;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Toolbar */}
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-night-edge bg-night-panel px-3">
        <div className="flex items-center rounded-sm border border-night-edge p-0.5">
          {VIEWPORTS.map((v) => (
            <button
              key={v.id}
              onClick={() => setViewport(v.id)}
              title={v.label}
              className={`rounded-[2px] px-2 py-1 transition ${
                viewport === v.id ? "bg-shine text-black" : "text-chalk-dim hover:text-chalk"
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
          onClick={() => url && window.open(url, "_blank")}
          disabled={!url}
          title="เปิดในแท็บใหม่"
          className="rounded-sm border border-night-edge p-1.5 text-chalk-dim transition hover:text-chalk disabled:opacity-40"
        >
          <ExternalLink size={13} />
        </button>
      </div>

      {/* Stage */}
      <div className="bg-grid flex min-h-0 flex-1 items-stretch justify-center overflow-hidden p-0">
        {!supported ? (
          <CenterNote
            title="เบราว์เซอร์นี้ไม่รองรับ live preview"
            body="ต้องการ Chrome หรือ Edge เวอร์ชันล่าสุด (cross-origin isolation) — ยังดูและแก้โค้ดได้ในแท็บ Code"
          />
        ) : url ? (
          <div
            className="my-0 flex h-full justify-center transition-all"
            style={{ width: active.width ? `${active.width}px` : "100%" }}
          >
            <iframe
              key={previewKey}
              src={url}
              sandbox="allow-scripts allow-same-origin allow-forms"
              className={`h-full w-full bg-white ${active.width ? "border-x border-night-edge" : ""}`}
              title="Demo preview"
            />
          </div>
        ) : hasFiles || phase !== "idle" ? (
          <CenterNote
            title={
              phase === "generating"
                ? "AI กำลังเขียนโค้ด…"
                : phase === "installing"
                  ? "กำลังติดตั้ง dependencies…"
                  : phase === "starting"
                    ? "กำลังเปิด dev server…"
                    : phase === "error"
                      ? "เกิดข้อผิดพลาด — ดูรายละเอียดที่แถบด้านล่าง"
                      : "กำลังเตรียม preview…"
            }
            body={phase === "error" ? undefined : "preview จะเปิดอัตโนมัติเมื่อพร้อม"}
            pulse={phase !== "error"}
          />
        ) : (
          <CenterNote title="กำลังเตรียมเวที…" body="โปรเจกต์กำลังเริ่มรันในเบราว์เซอร์" pulse />
        )}
      </div>
    </div>
  );
}

function CenterNote({
  title,
  body,
  pulse,
}: {
  title: string;
  body?: string;
  pulse?: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 self-center px-8 text-center">
      <div className="rounded-2xl border border-night-edge bg-night-panel px-8 py-6">
        <p className={`font-display text-[15px] text-chalk ${pulse ? "animate-pulse" : ""}`}>
          {title}
        </p>
        {body && <p className="mt-1.5 text-[13px] text-chalk-dim">{body}</p>}
      </div>
    </div>
  );
}
