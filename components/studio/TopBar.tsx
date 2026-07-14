"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Check,
  Code2,
  Download,
  Eye,
  FileText,
  FileUp,
  Package,
  Rocket,
  Share2,
  Sparkles,
  Undo2,
  Users,
} from "lucide-react";
import { encodeShareUrl } from "@/lib/share";
import DnaMark from "@/components/ui/DnaMark";
import type { OrgRecord, ProjectRecord } from "@/lib/types";
import { downloadZip } from "@/lib/zip";
import { downloadFittcoreSpec, type FittcoreRunnerResult } from "@/lib/fittcore";
import { useOrgSkillName } from "@/lib/skills/use-org-skill";
import FittcoreExportModal from "./FittcoreExportModal";
import ProjectPresence from "./ProjectPresence";
import QuotaChip from "./QuotaChip";
import TeamChat from "./TeamChat";

interface TopBarProps {
  project: ProjectRecord;
  /** The project's workspace (with Org DNA), or null when ส่วนตัว. */
  org: OrgRecord | null;
  /** Open the in-studio Org DNA panel. */
  onOpenDna: () => void;
  view: "preview" | "code";
  busy: boolean;
  /** Viewer (read-only) — shown as a chip instead of the auto-save status. */
  readOnly: boolean;
  /** Save status, shown in the fixed-height bar (no layout shift). */
  saveState: "idle" | "saving" | "saved";
  canUndo: boolean;
  /** A runnable app exists — share links and zip exports make sense. */
  shippable: boolean;
  onRename: (name: string) => void;
  onViewChange: (view: "preview" | "code") => void;
  onUndo: () => void;
  onOpenSpec: () => void;
  onOpenPackages: () => void;
  /** Owner-only: open the team sharing modal. Omit to hide the button. */
  onTeamShare?: () => void;
  /** Persist the durable "sent to Code Runner" chip after a successful hand-off. */
  onRunnerSent?: (result: FittcoreRunnerResult) => void;
}

export default function TopBar({
  project,
  org,
  onOpenDna,
  view,
  busy,
  readOnly,
  saveState,
  canUndo,
  shippable,
  onRename,
  onViewChange,
  onUndo,
  onOpenSpec,
  onOpenPackages,
  onTeamShare,
  onRunnerSent,
}: TopBarProps) {
  const [shared, setShared] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [runnerOpen, setRunnerOpen] = useState(false);
  const specialist = useOrgSkillName(project.orgId);

  const share = async () => {
    if (!project.files) return;
    const url = await encodeShareUrl({ name: project.name, files: project.files });
    await navigator.clipboard.writeText(url);
    setShared(true);
    setTimeout(() => setShared(false), 2000);
  };

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-night-edge bg-night-panel px-3">
      <Link
        href="/"
        className="shrink-0 whitespace-nowrap font-display text-sm font-bold tracking-tight text-chalk transition hover:text-shine"
        title="กลับไปหน้าแรก"
      >
        FITT <span className="text-shine">Builder</span>
      </Link>
      <span className="shrink-0 text-night-edge">/</span>
      <input
        defaultValue={project.name}
        key={project.id + project.name}
        onBlur={(event) => onRename(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") (event.target as HTMLInputElement).blur();
        }}
        className="w-24 min-w-0 shrink rounded-sm border border-transparent bg-transparent px-2 py-1 font-display text-sm text-chalk outline-none transition focus:border-shine sm:w-40 xl:w-48"
        aria-label="ชื่อโปรเจกต์"
      />
      {readOnly ? (
        <span className="hidden shrink-0 items-center gap-1 rounded-full border border-night-edge bg-chalk/[0.04] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-chalk-dim md:inline-flex">
          <Eye size={11} /> ดูอย่างเดียว
        </span>
      ) : (
        <span className="hidden shrink-0 font-mono text-[10px] uppercase tracking-widest text-chalk-dim md:inline">
          {saveState === "saving" ? "กำลังบันทึก…" : saveState === "saved" ? "บันทึกแล้ว" : "เซฟอัตโนมัติ"}
        </span>
      )}

      <button
        onClick={onOpenDna}
        title={org ? `Org DNA · ${org.name} — ดูข้อมูลที่ AI อ้างอิง` : "ผูก workspace เพื่อให้ AI อ้างอิง Org DNA"}
        className={`inline-flex min-w-0 max-w-[160px] items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition ${
          org
            ? "border-shine/40 bg-shine/[0.06] text-chalk hover:border-shine"
            : "border-night-edge text-chalk-dim hover:border-shine hover:text-chalk"
        }`}
      >
        <DnaMark size={16} bars={6} rainbow className="shrink-0" />
        <span className="truncate">{org ? `${org.name} · DNA` : "Org DNA"}</span>
      </button>

      <div className="mx-auto flex shrink-0 items-center rounded-sm border border-night-edge p-0.5">
        <button
          onClick={() => onViewChange("preview")}
          className={`inline-flex items-center gap-1.5 rounded-[2px] px-3 py-1 font-display text-xs font-medium transition ${
            view === "preview" ? "bg-shine text-night" : "text-chalk-dim hover:text-chalk"
          }`}
        >
          <Eye size={13} /> Preview
        </button>
        <button
          onClick={() => onViewChange("code")}
          className={`inline-flex items-center gap-1.5 rounded-[2px] px-3 py-1 font-display text-xs font-medium transition ${
            view === "code" ? "bg-shine text-night" : "text-chalk-dim hover:text-chalk"
          }`}
        >
          <Code2 size={13} /> Code
        </button>
      </div>

      <button
        onClick={onOpenSpec}
        disabled={busy}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-sm border border-night-edge px-2.5 py-1.5 text-xs text-chalk-dim transition hover:border-shine hover:text-chalk disabled:opacity-40"
        title="สร้างจากเอกสาร BRD/PRD"
      >
        <FileText size={13} />
        <span className="hidden lg:inline">Spec</span>
      </button>
      <button
        onClick={onOpenPackages}
        disabled={!shippable || busy}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-sm border border-night-edge px-2.5 py-1.5 text-xs text-chalk-dim transition hover:border-shine hover:text-chalk disabled:opacity-40"
        title="ค้นหาและติดตั้ง npm package"
      >
        <Package size={13} />
        <span className="hidden lg:inline">Packages</span>
      </button>
      <button
        onClick={onUndo}
        disabled={!canUndo || busy}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-sm border border-night-edge px-2.5 py-1.5 text-xs text-chalk-dim transition hover:border-shine hover:text-chalk disabled:opacity-40"
        title="ย้อนกลับ (Cmd/Ctrl+Z)"
      >
        <Undo2 size={13} />
        <span className="hidden lg:inline">Undo</span>
      </button>
      <ProjectPresence projectId={project.id} />
      <TeamChat projectId={project.id} />
      <button
        onClick={() => void share()}
        disabled={!shippable}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-sm border border-night-edge px-2.5 py-1.5 text-xs text-chalk-dim transition hover:border-shine hover:text-chalk disabled:opacity-40"
        title="คัดลอกลิงก์แชร์ — เปิดดูได้โดยไม่ต้อง login"
      >
        {shared ? <Check size={13} className="text-go" /> : <Share2 size={13} />}
        <span className="hidden lg:inline">{shared ? "คัดลอกแล้ว" : "แชร์"}</span>
      </button>
      {onTeamShare && (
        <button
          onClick={onTeamShare}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-sm border border-night-edge px-2.5 py-1.5 text-xs text-chalk-dim transition hover:border-shine hover:text-chalk"
          title="เชิญสมาชิกเข้าทีม"
        >
          <Users size={13} />
          <span className="hidden lg:inline">เชิญทีม</span>
        </button>
      )}
      <QuotaChip refreshKey={project.messages.length} />
      {project.runnerLast && (
        <span
          title={`ส่งไป Code Runner แล้ว · build #${project.runnerLast.buildNo} · branch ${project.runnerLast.branch} · ${project.runnerLast.tag} · ${new Date(project.runnerLast.sentAt).toLocaleString("th-TH")}`}
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-go/40 bg-go/10 px-2 py-1 font-mono text-[10px] text-go"
        >
          <Rocket size={11} />
          <span className="hidden lg:inline">Code Runner</span> #{project.runnerLast.buildNo}
        </span>
      )}
      {specialist && (
        <span
          title={`เดโมใน workspace นี้ขับเคลื่อนโดยผู้เชี่ยวชาญ "${specialist}"`}
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-shine/40 bg-shine/10 px-2 py-1 font-mono text-[10px] text-shine"
        >
          <Sparkles size={11} /> <span className="hidden lg:inline">ขับเคลื่อนโดย</span> {specialist}
        </span>
      )}
      <div className="relative shrink-0">
        <button
          onClick={() => setMoreOpen((v) => !v)}
          disabled={!shippable}
          className={`inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1.5 text-xs font-medium transition disabled:opacity-40 ${
            moreOpen
              ? "bg-chalk/10 text-chalk"
              : "bg-shine text-night hover:brightness-110"
          }`}
          title="ส่งออก"
        >
          <Download size={13} />
          <span className="hidden lg:inline">Export</span>
        </button>
        {moreOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setMoreOpen(false)}
            />
            <div className="absolute right-0 top-full z-50 mt-1 w-56 overflow-hidden rounded-lg border border-night-edge bg-night-panel py-1 shadow-xl">
              <button
                onClick={() => {
                  setMoreOpen(false);
                  if (project.files) void downloadZip(project.files, project.name);
                }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs text-chalk/80 transition hover:bg-chalk/5 hover:text-chalk"
              >
                <Download size={14} /> ดาวน์โหลดโค้ด (.zip)
              </button>
              <button
                onClick={() => {
                  setMoreOpen(false);
                  downloadFittcoreSpec(project);
                }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs text-chalk/80 transition hover:bg-chalk/5 hover:text-chalk"
              >
                <FileUp size={14} className="text-shine" /> Export to FITTCORE V2
              </button>
              <button
                onClick={() => {
                  setMoreOpen(false);
                  setRunnerOpen(true);
                }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs text-chalk/80 transition hover:bg-chalk/5 hover:text-chalk"
              >
                <Rocket size={14} className="text-shine" /> ส่งไป Code Runner
              </button>
            </div>
          </>
        )}
      </div>

      <FittcoreExportModal
        open={runnerOpen}
        onClose={() => setRunnerOpen(false)}
        project={project}
        orgName={org?.name}
        onSent={onRunnerSent}
      />
    </header>
  );
}
