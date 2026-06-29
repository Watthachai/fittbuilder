"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2 } from "lucide-react";
import { createOrg } from "@/lib/orgs";
import { resolveCreateWorkspace, subscribeCreateWorkspace } from "@/lib/workspace-modal";
import { toast } from "@/lib/toast";
import { DEFAULT_COLOR, DEFAULT_ICON, WorkspaceIcon } from "@/lib/workspace-style";
import ColorIconPicker from "./ColorIconPicker";

/** Renders the imperative create-workspace modal (name + color + icon). */
export default function CreateWorkspaceHost() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [icon, setIcon] = useState(DEFAULT_ICON);
  const [saving, setSaving] = useState(false);

  useEffect(() => subscribeCreateWorkspace(setOpen), []);

  // Reset fields each time the modal opens.
  const [wasOpen, setWasOpen] = useState(false);
  if (open && !wasOpen) {
    setWasOpen(true);
    setName("");
    setColor(DEFAULT_COLOR);
    setIcon(DEFAULT_ICON);
    setSaving(false);
  } else if (!open && wasOpen) {
    setWasOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") resolveCreateWorkspace(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (typeof document === "undefined" || !open) return null;

  const create = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      const org = await createOrg(name, { color, icon });
      resolveCreateWorkspace(org);
    } catch (e) {
      toast.error("สร้าง workspace ไม่สำเร็จ", {
        description: e instanceof Error ? e.message : undefined,
      });
      setSaving(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) resolveCreateWorkspace(null);
      }}
    >
      <div className="glass-strong w-[min(92vw,28rem)] rounded-2xl border border-night-edge p-5 shadow-2xl">
        <div className="flex items-center gap-3">
          <span
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl"
            style={{ background: color, color: "#0b0b0f" }}
          >
            <WorkspaceIcon icon={icon} size={22} />
          </span>
          <div>
            <h2 className="font-display text-base font-semibold text-chalk">สร้าง workspace ใหม่</h2>
            <p className="text-[12px] text-chalk-dim">ตั้งชื่อ สี และไอคอน เพื่อแยกหมวดหมู่</p>
          </div>
        </div>

        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void create();
          }}
          placeholder="ชื่อ workspace — เช่น ทีมการตลาด"
          className="mt-4 w-full rounded-lg border border-night-edge bg-night px-3 py-2.5 text-[14px] text-chalk outline-none focus:border-shine"
        />

        <div className="mt-4">
          <ColorIconPicker color={color} icon={icon} onColor={setColor} onIcon={setIcon} />
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={() => resolveCreateWorkspace(null)}
            className="rounded-lg border border-night-edge px-4 py-2 font-display text-sm text-chalk-dim transition hover:text-chalk"
          >
            ยกเลิก
          </button>
          <button
            onClick={() => void create()}
            disabled={!name.trim() || saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-shine px-4 py-2 font-display text-sm font-semibold text-night transition hover:brightness-110 disabled:opacity-40"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            สร้าง
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
