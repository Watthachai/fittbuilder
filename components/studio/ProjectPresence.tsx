"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface Peer {
  id: string;
  name: string;
  avatar: string | null;
}

/**
 * Realtime "who's here" — Supabase Presence on a per-project channel. Needs no
 * DB schema (Presence is ephemeral over the Realtime socket): each viewer tracks
 * themselves and everyone renders the synced roster. Shows in the studio toolbar.
 */
export default function ProjectPresence({ projectId }: { projectId: string }) {
  const [peers, setPeers] = useState<Peer[]>([]);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      const meta = user.user_metadata ?? {};
      const me: Peer = {
        id: user.id,
        name: (meta.full_name ?? meta.name ?? user.email ?? "ผู้ใช้") as string,
        avatar: (meta.avatar_url ?? meta.picture ?? null) as string | null,
      };

      channel = supabase.channel(`presence:project:${projectId}`, {
        config: { presence: { key: user.id } },
      });

      channel
        .on("presence", { event: "sync" }, () => {
          const state = channel!.presenceState() as Record<string, Peer[]>;
          const byId = new Map<string, Peer>();
          for (const entries of Object.values(state)) {
            for (const p of entries) if (p?.id) byId.set(p.id, p);
          }
          if (!cancelled) setPeers([...byId.values()]);
        })
        .subscribe((status) => {
          if (status === "SUBSCRIBED") void channel!.track(me);
        });
    })();

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [projectId]);

  if (peers.length <= 1) return null; // only show when others are around

  const shown = peers.slice(0, 4);
  const extra = peers.length - shown.length;

  return (
    <div
      className="flex items-center"
      title={`${peers.length} คนกำลังดูโปรเจกต์นี้`}
    >
      <div className="flex -space-x-2">
        {shown.map((p) => (
          <span key={p.id} className="relative" title={p.name}>
            {p.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={p.avatar}
                alt=""
                referrerPolicy="no-referrer"
                className="h-6 w-6 rounded-full border-2 border-night-panel object-cover"
              />
            ) : (
              <span className="grid h-6 w-6 place-items-center rounded-full border-2 border-night-panel bg-chalk/15 text-[10px] font-semibold text-chalk/80">
                {(p.name || "?").charAt(0).toUpperCase()}
              </span>
            )}
            <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-night-panel bg-go" />
          </span>
        ))}
      </div>
      {extra > 0 && (
        <span className="ml-1.5 font-mono text-[11px] text-chalk-dim">+{extra}</span>
      )}
    </div>
  );
}
