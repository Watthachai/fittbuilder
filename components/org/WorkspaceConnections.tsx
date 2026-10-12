"use client";

import { useEffect, useState } from "react";
import { Link2, Loader2 } from "lucide-react";
import { confirm } from "@/lib/confirm";
import { toast } from "@/lib/toast";

interface Connection {
  id: string;
  clientName: string;
  createdAt: string;
  lastUsedAt: string | null;
}

const when = (iso: string) =>
  new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(
    new Date(iso)
  );

/**
 * The signed-in person's own FITT Voice connections into this workspace, each
 * with a revoke button (/api/integrations/connections). Renders nothing when
 * they have none — connecting starts in FITT Voice, not here.
 */
export default function WorkspaceConnections({ orgId }: { orgId: string }) {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/integrations/connections?org=${encodeURIComponent(orgId)}`)
      .then((r) => (r.ok ? r.json() : { connections: [] }))
      .then((d: { connections: Connection[] }) => {
        if (!cancelled) setConnections(d.connections);
      });
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  const revoke = async (c: Connection) => {
    const ok = await confirm({
      title: `ถอนการเชื่อม ${c.clientName}?`,
      message: `${c.clientName} จะส่งงานเข้า workspace นี้ในนามคุณไม่ได้อีก โปรเจกต์ที่ส่งมาแล้วยังอยู่ครบ — ถ้าจะใช้อีกให้เชื่อมใหม่จาก ${c.clientName}`,
      confirmLabel: "ถอนการเชื่อม",
      danger: true,
    });
    if (!ok) return;
    setBusy(c.id);
    const res = await fetch(`/api/integrations/connections?id=${encodeURIComponent(c.id)}`, { method: "DELETE" });
    setBusy(null);
    if (!res.ok) {
      toast.error("ถอนการเชื่อมไม่สำเร็จ ลองอีกครั้ง");
      return;
    }
    setConnections((list) => list.filter((x) => x.id !== c.id));
    toast.success(`ถอนการเชื่อม ${c.clientName} แล้ว`);
  };

  if (connections.length === 0) return null;
  return (
    <section className="mt-7 rounded-xl border border-night-edge bg-night-panel p-4">
      <div className="flex items-center gap-2">
        <Link2 size={15} className="text-shine" />
        <h2 className="font-display text-sm font-semibold">แอปที่เชื่อมกับบัญชีของคุณ</h2>
      </div>
      <p className="mt-1 text-[13px] text-chalk-dim">
        ส่งงานเข้า workspace นี้ในนามคุณได้ จนกว่าคุณจะถอน หรือไม่ได้ใช้ 90 วัน
      </p>
      <div className="mt-3 space-y-1.5">
        {connections.map((c) => (
          <div key={c.id} className="flex items-center gap-3 rounded-lg border border-night-edge bg-night px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] text-chalk">{c.clientName}</p>
              <p className="truncate text-[11px] text-chalk-dim">
                เชื่อมเมื่อ {when(c.createdAt)}
                {c.lastUsedAt && ` · ใช้ล่าสุด ${when(c.lastUsedAt)}`}
              </p>
            </div>
            <button
              onClick={() => void revoke(c)}
              disabled={busy === c.id}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-night-edge px-2.5 py-1 text-[11px] text-chalk-dim transition hover:border-halt hover:text-halt disabled:opacity-40"
            >
              {busy === c.id && <Loader2 size={11} className="animate-spin" />}
              ถอนการเชื่อม
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
