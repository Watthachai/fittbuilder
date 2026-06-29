"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, Loader2, Plus, Settings2 } from "lucide-react";
import { listOrgs } from "@/lib/orgs";
import { openCreateWorkspace } from "@/lib/workspace-modal";
import { WorkspaceIcon } from "@/lib/workspace-style";
import type { OrgRecord } from "@/lib/types";

/**
 * Compact workspace picker. Loads the user's orgs (no auto-create), shows each
 * workspace's color + icon for quick categorization, lets them switch, open a
 * workspace's info/Org DNA, or create a new one via the rich create modal.
 */
export default function OrgSelect({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (orgId: string) => void;
}) {
  const [orgs, setOrgs] = useState<OrgRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await listOrgs();
        if (cancelled) return;
        setOrgs(list);
        if (!value && list[0]) onChange(list[0].id);
      } catch {
        /* signed-out / offline → leave empty */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [value, onChange]);

  if (loading) {
    return (
      <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-chalk/50">
        <Loader2 size={12} className="animate-spin" /> workspace…
      </span>
    );
  }
  const current = orgs.find((o) => o.id === value) ?? orgs[0] ?? null;

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
        <WorkspaceIcon icon={current?.icon} size={13} className="shrink-0" style={{ color: current?.color }} />
        <span className="truncate font-display text-[12px]">
          {current ? current.name : "เลือก/สร้าง workspace"}
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
            {orgs.length === 0 && (
              <p className="px-2.5 py-1.5 text-[12px] text-chalk-dim">
                ยังไม่มี workspace — สร้างใหม่ได้เลย
              </p>
            )}
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
