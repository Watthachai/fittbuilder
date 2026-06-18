"use client";

import { useState } from "react";
import { diffLines } from "diff";
import { ChevronDown, ChevronRight, FileMinus, FilePenLine, FilePlus, X } from "lucide-react";
import type { FileChange } from "@/lib/types";

type Status = "added" | "deleted" | "modified";

function statusOf(c: FileChange): Status {
  if (c.before === null) return "added";
  if (c.after === null) return "deleted";
  return "modified";
}

const STATUS_META: Record<Status, { icon: typeof FilePlus; tint: string }> = {
  added: { icon: FilePlus, tint: "text-go" },
  deleted: { icon: FileMinus, tint: "text-halt" },
  modified: { icon: FilePenLine, tint: "text-shine" },
};

/** Split a diff part's value into lines, dropping the trailing empty from the final "\n". */
function toLines(value: string): string[] {
  const lines = value.split("\n");
  if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

function FileDiff({ change }: { change: FileChange }) {
  const [open, setOpen] = useState(true);
  const status = statusOf(change);
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  const parts = diffLines(change.before ?? "", change.after ?? "");
  let added = 0;
  let removed = 0;
  for (const p of parts) {
    if (p.added) added += p.count ?? 0;
    if (p.removed) removed += p.count ?? 0;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-night-edge">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 bg-night px-3 py-2 text-left transition hover:bg-night-edge/30"
      >
        {open ? <ChevronDown size={13} className="shrink-0 text-chalk-dim" /> : <ChevronRight size={13} className="shrink-0 text-chalk-dim" />}
        <Icon size={13} className={`shrink-0 ${meta.tint}`} />
        <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-chalk">{change.path}</span>
        {added > 0 && <span className="shrink-0 font-mono text-[11px] text-go">+{added}</span>}
        {removed > 0 && <span className="shrink-0 font-mono text-[11px] text-halt">−{removed}</span>}
      </button>
      {open && (
        <div className="scroll-thin max-h-[360px] overflow-auto bg-night-panel font-mono text-[12px] leading-relaxed">
          {parts.map((part, pi) =>
            toLines(part.value).map((line, li) => (
              <div
                key={`${pi}:${li}`}
                className={`whitespace-pre px-3 ${
                  part.added
                    ? "bg-go/10 text-go"
                    : part.removed
                      ? "bg-halt/10 text-halt"
                      : "text-chalk-dim"
                }`}
              >
                <span className="select-none opacity-50">{part.added ? "+" : part.removed ? "−" : " "} </span>
                {line || " "}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function DiffViewer({
  changes,
  title,
  onClose,
}: {
  changes: FileChange[];
  title: string;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-night-edge bg-night-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-night-edge px-4 py-3">
          <div className="min-w-0">
            <h2 className="font-display text-[15px] font-semibold text-chalk">ดูการเปลี่ยนแปลง</h2>
            <p className="truncate font-mono text-[11px] text-chalk-dim">
              {changes.length} ไฟล์ · {title}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-sm border border-night-edge p-1.5 text-chalk-dim transition hover:text-chalk"
          >
            <X size={14} />
          </button>
        </div>
        <div className="scroll-thin flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
          {changes.map((change) => (
            <FileDiff key={change.path} change={change} />
          ))}
        </div>
      </div>
    </div>
  );
}
