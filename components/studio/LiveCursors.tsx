"use client";

import { useEffect, useState } from "react";
import { motion, useSpring } from "motion/react";
import { createClient } from "@/lib/supabase/client";

const TTL = 5000; // drop a cursor this long after its last move
const THROTTLE = 40; // ms between broadcasts (~25/s)
const SPRING = { stiffness: 600, damping: 45, mass: 0.6 };

interface Peer {
  name: string;
  color: string;
  /** Viewport-normalized position (0..1). */
  x: number;
  y: number;
  t: number;
}

/** Deterministic, legible hue from a client id. */
function colorFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
  return `hsl(${h} 75% 58%)`;
}

/**
 * Multiplayer live cursors over the studio. Each client broadcasts its pointer
 * (viewport-normalized) on a per-project channel; everyone renders everyone
 * else's with a spring-smoothed pointer + name tag. The preview is a
 * cross-origin iframe, so the parent can't see mousemove over it — the scaffold
 * index.html forwards pointer positions via postMessage, which we map through the
 * iframe's rect into the same viewport space. Own cursor stays native.
 */
export default function LiveCursors({ projectId }: { projectId: string }) {
  const [peers, setPeers] = useState<Map<string, Peer>>(new Map());

  useEffect(() => {
    const supabase = createClient();
    const clientId =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `c-${Math.random().toString(36).slice(2)}`;
    const color = colorFor(clientId);
    let name = "ผู้ใช้";
    let lastSent = 0;

    void supabase.auth.getUser().then(({ data: { user } }) => {
      const meta = user?.user_metadata ?? {};
      name = (meta.full_name ?? meta.name ?? user?.email ?? "ผู้ใช้") as string;
    });

    const channel = supabase.channel(`cursor:project:${projectId}`, {
      config: { broadcast: { self: false } },
    });
    channel
      .on("broadcast", { event: "move" }, ({ payload }) => {
        const p = payload as { id: string; name: string; color: string; x: number; y: number };
        if (p.id === clientId) return;
        setPeers((prev) =>
          new Map(prev).set(p.id, { name: p.name, color: p.color, x: p.x, y: p.y, t: Date.now() })
        );
      })
      .on("broadcast", { event: "leave" }, ({ payload }) => {
        const id = (payload as { id: string }).id;
        setPeers((prev) => {
          const m = new Map(prev);
          m.delete(id);
          return m;
        });
      })
      .subscribe();

    const send = (x: number, y: number) => {
      const now = Date.now();
      if (now - lastSent < THROTTLE) return;
      lastSent = now;
      channel.send({ type: "broadcast", event: "move", payload: { id: clientId, name, color, x, y } });
    };
    const leave = () =>
      channel.send({ type: "broadcast", event: "leave", payload: { id: clientId } });

    const onMove = (e: MouseEvent) => send(e.clientX / window.innerWidth, e.clientY / window.innerHeight);
    const onLeave = () => leave();

    // Pointer forwarded from inside the preview iframe → map via its rect.
    const onMessage = (e: MessageEvent) => {
      const d = e.data as { __fittCursor?: boolean; x?: number; y?: number; leave?: boolean };
      if (!d || !d.__fittCursor) return;
      if (d.leave) return leave();
      const iframe = document.querySelector<HTMLIFrameElement>('iframe[title="Demo preview"]');
      if (!iframe || d.x == null || d.y == null) return;
      const r = iframe.getBoundingClientRect();
      send((r.left + d.x * r.width) / window.innerWidth, (r.top + d.y * r.height) / window.innerHeight);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseleave", onLeave);
    window.addEventListener("message", onMessage);
    const gc = setInterval(() => {
      setPeers((prev) => {
        const now = Date.now();
        let changed = false;
        const m = new Map(prev);
        for (const [id, p] of m) {
          if (now - p.t > TTL) {
            m.delete(id);
            changed = true;
          }
        }
        return changed ? m : prev;
      });
    }, 2000);

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("message", onMessage);
      clearInterval(gc);
      leave();
      void supabase.removeChannel(channel);
    };
  }, [projectId]);

  if (peers.size === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[90] overflow-hidden">
      {[...peers.entries()].map(([id, p]) => (
        <RemoteCursor key={id} peer={p} />
      ))}
    </div>
  );
}

function RemoteCursor({ peer }: { peer: Peer }) {
  const vw = typeof window === "undefined" ? 0 : window.innerWidth;
  const vh = typeof window === "undefined" ? 0 : window.innerHeight;
  const x = useSpring(peer.x * vw, SPRING);
  const y = useSpring(peer.y * vh, SPRING);

  useEffect(() => {
    x.set(peer.x * window.innerWidth);
  }, [peer.x, x]);
  useEffect(() => {
    y.set(peer.y * window.innerHeight);
  }, [peer.y, y]);

  return (
    <motion.div style={{ x, y }} className="absolute left-0 top-0 will-change-transform">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="drop-shadow">
        <path
          d="M5.5 3.2 19 11.2l-6.6 1.2 -2.4 6.3z"
          fill={peer.color}
          stroke="#fff"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
      </svg>
      <span
        className="ml-3.5 -mt-1 inline-block w-fit whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold text-white shadow-lg"
        style={{ background: peer.color }}
      >
        {peer.name}
      </span>
    </motion.div>
  );
}
