"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, Code2, Download, Eye, FileText, Share2, Undo2 } from "lucide-react";
import { encodeShareUrl } from "@/lib/share";
import type { ProjectRecord } from "@/lib/types";
import { downloadZip } from "@/lib/zip";

interface TopBarProps {
  project: ProjectRecord;
  view: "preview" | "code";
  busy: boolean;
  canUndo: boolean;
  /** A runnable app exists — share links and zip exports make sense. */
  shippable: boolean;
  onRename: (name: string) => void;
  onViewChange: (view: "preview" | "code") => void;
  onUndo: () => void;
  onOpenSpec: () => void;
}

export default function TopBar({
  project,
  view,
  busy,
  canUndo,
  shippable,
  onRename,
  onViewChange,
  onUndo,
  onOpenSpec,
}: TopBarProps) {
  const [shared, setShared] = useState(false);

  const share = async () => {
    if (!project.files) return;
    const url = await encodeShareUrl({ name: project.name, files: project.files });
    await navigator.clipboard.writeText(url);
    setShared(true);
    setTimeout(() => setShared(false), 2000);
  };

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-night-edge bg-night-panel px-3">
      <Link
        href="/projects"
        className="font-display text-sm font-bold tracking-tight text-chalk transition hover:text-shine"
        title="กลับไปหน้าผลงาน"
      >
        FITT <span className="text-shine">Builder</span>
      </Link>
      <span className="text-night-edge">/</span>
      <input
        defaultValue={project.name}
        key={project.id + project.name}
        onBlur={(event) => onRename(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") (event.target as HTMLInputElement).blur();
        }}
        className="w-48 rounded-sm border border-transparent bg-transparent px-2 py-1 font-display text-sm text-chalk outline-none transition focus:border-shine"
        aria-label="ชื่อโปรเจกต์"
      />
      <span className="font-mono text-[10px] uppercase tracking-widest text-chalk-dim">
        เซฟอัตโนมัติ
      </span>

      <div className="mx-auto flex items-center rounded-sm border border-night-edge p-0.5">
        <button
          onClick={() => onViewChange("preview")}
          className={`inline-flex items-center gap-1.5 rounded-[2px] px-3 py-1 font-display text-xs font-medium transition ${
            view === "preview" ? "bg-shine text-black" : "text-chalk-dim hover:text-chalk"
          }`}
        >
          <Eye size={13} /> Preview
        </button>
        <button
          onClick={() => onViewChange("code")}
          className={`inline-flex items-center gap-1.5 rounded-[2px] px-3 py-1 font-display text-xs font-medium transition ${
            view === "code" ? "bg-shine text-black" : "text-chalk-dim hover:text-chalk"
          }`}
        >
          <Code2 size={13} /> Code
        </button>
      </div>

      <button
        onClick={onOpenSpec}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-sm border border-night-edge px-2.5 py-1.5 text-xs text-chalk-dim transition hover:border-shine hover:text-chalk disabled:opacity-40"
        title="สร้างจากเอกสาร BRD/PRD"
      >
        <FileText size={13} /> Spec
      </button>
      <button
        onClick={onUndo}
        disabled={!canUndo || busy}
        className="inline-flex items-center gap-1.5 rounded-sm border border-night-edge px-2.5 py-1.5 text-xs text-chalk-dim transition hover:border-shine hover:text-chalk disabled:opacity-40"
        title="ย้อนกลับ (Cmd/Ctrl+Z)"
      >
        <Undo2 size={13} /> Undo
      </button>
      <button
        onClick={() => void share()}
        disabled={!shippable}
        className="inline-flex items-center gap-1.5 rounded-sm border border-night-edge px-2.5 py-1.5 text-xs text-chalk-dim transition hover:border-shine hover:text-chalk disabled:opacity-40"
        title="คัดลอกลิงก์แชร์ — เปิดดูได้โดยไม่ต้อง login"
      >
        {shared ? <Check size={13} className="text-go" /> : <Share2 size={13} />}
        {shared ? "คัดลอกแล้ว" : "แชร์"}
      </button>
      <button
        onClick={() => project.files && void downloadZip(project.files, project.name)}
        disabled={!shippable}
        className="inline-flex items-center gap-1.5 rounded-sm bg-shine px-2.5 py-1.5 text-xs font-medium text-black transition hover:brightness-110 disabled:opacity-40"
        title="ดาวน์โหลดโค้ดเป็น .zip"
      >
        <Download size={13} /> Export
      </button>
    </header>
  );
}
