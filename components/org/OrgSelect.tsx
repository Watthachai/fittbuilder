"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, Check, ChevronDown, Loader2, Plus, Settings2 } from "lucide-react";
import { createOrg, listOrgs } from "@/lib/orgs";
import type { OrgRecord } from "@/lib/types";

/**
 * Compact workspace picker. Loads the user's orgs (creating a default if none),
 * defaults the selection, lets them switch/create, and links to the Org DNA page.
 * Used on the landing brief card so a new project lands in the chosen workspace.
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
  const [creating, setCreating] = useState(false);
  const [naming, setNaming] = useState(false);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await listOrgs();
        if (cancelled) return;
        setOrgs(list);
        // No auto-create — default to the first workspace only if one exists.
        if (!value && list[0]) onChange(list[0].id);
      } catch {
        /* signed-out / offline → leave empty, picker stays hidden */
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

  const addOrg = async () => {
    const name = newName.trim();
    if (!name || creating) return;
    setCreating(true);
    try {
      const o = await createOrg(name);
      setOrgs((prev) => [...prev, o]);
      onChange(o.id);
      setNaming(false);
      setNewName("");
      setOpen(false);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex max-w-[200px] items-center gap-1.5 rounded-full border border-chalk/15 bg-chalk/5 px-2.5 py-1 text-chalk/80 transition hover:border-chalk/30"
        title="เลือก workspace ของโปรเจกต์นี้"
      >
        <Building2 size={12} className="shrink-0 text-shine" />
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
                  <Building2 size={14} className="shrink-0 text-chalk-dim" />
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
            {naming ? (
              <div className="flex items-center gap-1 px-1 py-1">
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void addOrg();
                    if (e.key === "Escape") {
                      setNaming(false);
                      setNewName("");
                    }
                  }}
                  placeholder="ชื่อ workspace ใหม่"
                  className="min-w-0 flex-1 rounded-md border border-chalk/15 bg-night px-2 py-1.5 text-[13px] text-chalk outline-none focus:border-shine"
                />
                <button
                  onClick={() => void addOrg()}
                  disabled={!newName.trim() || creating}
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-shine text-night transition hover:brightness-110 disabled:opacity-40"
                  title="สร้าง"
                >
                  {creating ? <Loader2 size={13} className="animate-spin" /> : <Check size={14} />}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setNaming(true)}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] text-chalk/85 transition hover:bg-chalk/5"
              >
                <Plus size={14} /> สร้าง workspace ใหม่
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
