"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, Loader2, Plus, Settings2, Star, User } from "lucide-react";
import { listOrgs } from "@/lib/orgs";
import { openCreateWorkspace } from "@/lib/workspace-modal";
import { WorkspaceIcon } from "@/lib/workspace-style";
import type { OrgRecord } from "@/lib/types";

/**
 * Compact workspace picker. Loads the user's orgs (no auto-create), shows each
 * workspace's color + icon for quick categorization, lets them switch, open a
 * workspace's info/Org DNA, or create a new one via the rich create modal.
 */
/** localStorage key: the workspace preselected on load ("personal" or an org id). */
const DEFAULT_KEY = "fittbuilder:default-workspace";

export default function OrgSelect({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (orgId: string | null) => void;
}) {
  const [orgs, setOrgs] = useState<OrgRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [defaultSel, setDefaultSel] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await listOrgs();
        if (cancelled) return;
        setOrgs(list);
        // Apply the saved default workspace (set via the ★ in this menu). The
        // parent's initial state is always "ส่วนตัว" (null), so this never
        // overrides an explicit user choice.
        const def = localStorage.getItem(DEFAULT_KEY);
        if (def && def !== "personal" && list.some((o) => o.id === def)) onChange(def);
      } catch {
        /* signed-out / offline → leave empty */
      } finally {
        if (!cancelled) {
          setDefaultSel(localStorage.getItem(DEFAULT_KEY));
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // Load workspaces once on mount (onChange is a stable setState from the parent).
  }, [onChange]);

  /** Toggle a row as the default workspace (★). Clicking the active ★ clears it. */
  const toggleDefault = (id: string) => {
    if (defaultSel === id) {
      localStorage.removeItem(DEFAULT_KEY);
      setDefaultSel(null);
    } else {
      localStorage.setItem(DEFAULT_KEY, id);
      setDefaultSel(id);
    }
  };

  if (loading) {
    return (
      <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-chalk/50">
        <Loader2 size={12} className="animate-spin" /> workspace…
      </span>
    );
  }
  const current = value ? orgs.find((o) => o.id === value) ?? null : null;

  const handleCreate = async () => {
    setOpen(false);
    const o = await openCreateWorkspace();
    if (o) {
      setOrgs((prev) => [...prev, o]);
      onChange(o.id);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex max-w-[220px] items-center gap-1.5 rounded-full border border-chalk/15 bg-chalk/5 px-2.5 py-1 text-chalk/80 transition hover:border-chalk/30"
        title="เลือก workspace ของโปรเจกต์นี้"
      >
        {current ? (
          <WorkspaceIcon icon={current.icon} size={13} className="shrink-0" style={{ color: current.color }} />
        ) : (
          <User size={13} className="shrink-0 text-chalk-dim" />
        )}
        <span className="truncate font-display text-[12px]">
          {current ? current.name : "ส่วนตัว"}
        </span>
        <ChevronDown size={13} className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-50 mt-1.5 w-64 overflow-hidden rounded-xl border border-chalk/12 bg-night-panel p-1.5 shadow-2xl">
            <p className="px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-chalk/40">
              Workspace
            </p>
            <div className="group flex items-center gap-1 rounded-lg pr-1 transition hover:bg-chalk/5">
              <button
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
                className="flex min-w-0 flex-1 items-center gap-2 px-2.5 py-2 text-left text-[13px] text-chalk/85"
              >
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-chalk/10 text-chalk-dim">
                  <User size={14} />
                </span>
                <span className="min-w-0 flex-1 truncate">ส่วนตัว (ไม่ใช้ workspace)</span>
                {!value && <Check size={14} className="shrink-0 text-shine" />}
              </button>
              <button
                onClick={() => toggleDefault("personal")}
                title={defaultSel === "personal" ? "เลิกตั้งเป็นค่าเริ่มต้น" : "ตั้งเป็นค่าเริ่มต้น"}
                aria-label="ตั้งเป็นค่าเริ่มต้น"
                className="grid h-7 w-7 shrink-0 place-items-center rounded-md transition hover:bg-chalk/10"
              >
                <Star
                  size={13}
                  fill={defaultSel === "personal" ? "currentColor" : "none"}
                  className={defaultSel === "personal" ? "text-shine" : "text-chalk-dim/60"}
                />
              </button>
            </div>
            {orgs.map((o) => (
              <div
                key={o.id}
                className="group flex items-center gap-1 rounded-lg pr-1 transition hover:bg-chalk/5"
              >
                <button
                  onClick={() => {
                    onChange(o.id);
                    setOpen(false);
                  }}
                  className="flex min-w-0 flex-1 items-center gap-2 px-2.5 py-2 text-left text-[13px] text-chalk/85"
                >
                  <span
                    className="grid h-6 w-6 shrink-0 place-items-center rounded-md"
                    style={{ background: `${o.color}22`, color: o.color }}
                  >
                    <WorkspaceIcon icon={o.icon} size={14} />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{o.name}</span>
                  {o.id === current?.id && <Check size={14} className="shrink-0 text-shine" />}
                </button>
                <button
                  onClick={() => toggleDefault(o.id)}
                  title={defaultSel === o.id ? "เลิกตั้งเป็นค่าเริ่มต้น" : "ตั้งเป็นค่าเริ่มต้น"}
                  aria-label="ตั้งเป็นค่าเริ่มต้น"
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-md transition hover:bg-chalk/10"
                >
                  <Star
                    size={13}
                    fill={defaultSel === o.id ? "currentColor" : "none"}
                    className={defaultSel === o.id ? "text-shine" : "text-chalk-dim/60"}
                  />
                </button>
                <Link
                  href={`/org/${o.id}`}
                  onClick={() => setOpen(false)}
                  title="ข้อมูล workspace · Org DNA"
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-chalk-dim transition hover:bg-chalk/10 hover:text-shine"
                >
                  <Settings2 size={14} />
                </Link>
              </div>
            ))}
            <div className="my-1 h-px bg-chalk/10" />
            <button
              onClick={() => void handleCreate()}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] text-chalk/85 transition hover:bg-chalk/5"
            >
              <Plus size={14} /> สร้าง workspace ใหม่
            </button>
          </div>
        </>
      )}
    </div>
  );
}
