"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, Check, ChevronDown, Dna, Loader2, Plus } from "lucide-react";
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let list = await listOrgs();
        if (list.length === 0) list = [await createOrg()];
        if (cancelled) return;
        setOrgs(list);
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
  if (orgs.length === 0) return null;

  const current = orgs.find((o) => o.id === value) ?? orgs[0];

  const addOrg = async () => {
    setCreating(true);
    try {
      const o = await createOrg();
      setOrgs((prev) => [...prev, o]);
      onChange(o.id);
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
        <span className="truncate font-display text-[12px]">{current.name}</span>
        <ChevronDown size={13} className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-50 mt-1.5 w-60 overflow-hidden rounded-xl border border-chalk/12 bg-night-panel p-1.5 shadow-2xl">
            <p className="px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-chalk/40">
              Workspace
            </p>
            {orgs.map((o) => (
              <button
                key={o.id}
                onClick={() => {
                  onChange(o.id);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] text-chalk/85 transition hover:bg-chalk/5"
              >
                <Building2 size={14} className="shrink-0 text-chalk-dim" />
                <span className="min-w-0 flex-1 truncate">{o.name}</span>
                {o.id === current.id && <Check size={14} className="shrink-0 text-shine" />}
              </button>
            ))}
            <div className="my-1 h-px bg-chalk/10" />
            <button
              onClick={() => void addOrg()}
              disabled={creating}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] text-chalk/85 transition hover:bg-chalk/5 disabled:opacity-50"
            >
              {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              สร้าง workspace ใหม่
            </button>
            <Link
              href={`/org/${current.id}`}
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] text-chalk/85 transition hover:bg-chalk/5"
            >
              <Dna size={14} className="text-shine" /> ตั้งค่า Org DNA
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
