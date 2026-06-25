"use client";

import { useEffect, useState } from "react";
import { motion, useMotionValue, useSpring } from "motion/react";
import { createClient } from "@/lib/supabase/client";

const TTL = 5000; // drop a cursor this long after its last move
const THROTTLE = 40; // ms between broadcasts (~25/s)
const SPRING = { stiffness: 600, damping: 45, mass: 0.6 };

/** Which coordinate space a cursor's (x,y) is normalized against. "preview" is
 *  relative to the prototype iframe's content (identical for everyone, so it
 *  aligns regardless of banners/panel sizes); "viewport" is the whole window. */
type CursorSpace = "viewport" | "preview";

interface Peer {
  name: string;
  color: string;
  space: CursorSpace;
  /** Normalized position (0..1) within `space`. */
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
        const p = payload as {
          id: string;
          name: string;
          color: string;
          space: CursorSpace;
          x: number;
          y: number;
        };
        if (p.id === clientId) return;
        setPeers((prev) =>
          new Map(prev).set(p.id, {
            name: p.name,
            color: p.color,
            space: p.space ?? "viewport",
            x: p.x,
            y: p.y,
            t: Date.now(),
          })
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

    const send = (space: CursorSpace, x: number, y: number) => {
      const now = Date.now();
      if (now - lastSent < THROTTLE) return;
      lastSent = now;
      channel.send({
        type: "broadcast",
        event: "move",
        payload: { id: clientId, name, color, space, x, y },
      });
    };
    const leave = () =>
      channel.send({ type: "broadcast", event: "leave", payload: { id: clientId } });

    const onMove = (e: MouseEvent) =>
      send("viewport", e.clientX / window.innerWidth, e.clientY / window.innerHeight);
    const onLeave = () => leave();

    // Pointer forwarded from inside the preview iframe is already normalized to
    // the iframe's own content — broadcast it AS preview-space (don't fold in the
    // sender's layout), so every receiver maps it onto their own iframe.
    const onMessage = (e: MessageEvent) => {
      const d = e.data as { __fittCursor?: boolean; x?: number; y?: number; leave?: boolean };
      if (!d || !d.__fittCursor) return;
      if (d.leave) return leave();
      if (d.x == null || d.y == null) return;
      send("preview", d.x, d.y);
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

/** Map a peer's normalized position into viewport pixels, against the receiver's
 *  OWN layout — preview-space goes through the local iframe rect so the prototype
 *  surface aligns even when banners/panels differ between users. */
function resolve(peer: Peer): { px: number; py: number; visible: boolean } {
  if (peer.space === "preview") {
    const iframe = document.querySelector<HTMLIFrameElement>('iframe[title="Demo preview"]');
    if (!iframe) return { px: 0, py: 0, visible: false }; // not on the Preview tab
    const r = iframe.getBoundingClientRect();
    return { px: r.left + peer.x * r.width, py: r.top + peer.y * r.height, visible: true };
  }
  return { px: peer.x * window.innerWidth, py: peer.y * window.innerHeight, visible: true };
}

function RemoteCursor({ peer }: { peer: Peer }) {
  const initial = typeof window === "undefined" ? { px: 0, py: 0, visible: false } : resolve(peer);
  const x = useSpring(initial.px, SPRING);
  const y = useSpring(initial.py, SPRING);
  const opacity = useMotionValue(initial.visible ? 1 : 0);

  useEffect(() => {
    const { px, py, visible } = resolve(peer);
    x.set(px);
    y.set(py);
    opacity.set(visible ? 1 : 0); // motion value, not React state — fine in an effect
  }, [peer, x, y, opacity]);

  return (
    <motion.div style={{ x, y, opacity }} className="absolute left-0 top-0 will-change-transform">
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
