"use client";

import { useMemo, useRef, useState } from "react";
import { Maximize2, Minus, Plus } from "lucide-react";
import type { Shot } from "@/lib/shots";

/**
 * The inventory as a prototype canvas: every screen a frame, every recorded
 * click an arrow between frames, labelled with the control that was pressed.
 *
 * A list answers "how many screens"; this answers "how do they connect", which
 * is the thing a customer reads a quotation against. Layout is by depth from
 * the entry screens, so the canvas reads left to right the way the app is
 * actually walked.
 */

const NODE_W = 230;
const NODE_H = 150;
const GAP_X = 130;
const GAP_Y = 40;

interface Node {
  shot: Shot;
  x: number;
  y: number;
}
interface Edge {
  from: Node;
  to: Node;
  label: string | null;
}

function layout(shots: Shot[]): { nodes: Node[]; edges: Edge[]; w: number; h: number } {
  // First capture of a name owns the node; a screen revisited later is the same
  // frame, and the second visit becomes another arrow into it.
  const byName = new Map<string, Shot>();
  for (const s of shots) if (!byName.has(s.name)) byName.set(s.name, s);
  const unique = [...byName.values()];

  const depth = new Map<string, number>();
  const depthOf = (s: Shot, guard = 0): number => {
    if (depth.has(s.name)) return depth.get(s.name)!;
    if (!s.parent || guard > 20 || !byName.has(s.parent)) {
      depth.set(s.name, 0);
      return 0;
    }
    const d = depthOf(byName.get(s.parent)!, guard + 1) + 1;
    depth.set(s.name, d);
    return d;
  };
  for (const s of unique) depthOf(s);

  const columns = new Map<number, Shot[]>();
  for (const s of unique) {
    const d = depth.get(s.name) ?? 0;
    columns.set(d, [...(columns.get(d) ?? []), s]);
  }

  const nodes: Node[] = [];
  const byShot = new Map<string, Node>();
  for (const [d, list] of [...columns.entries()].sort((a, b) => a[0] - b[0])) {
    list.forEach((s, i) => {
      const node = { shot: s, x: d * (NODE_W + GAP_X), y: i * (NODE_H + GAP_Y + 22) };
      nodes.push(node);
      byShot.set(s.name, node);
    });
  }

  const edges: Edge[] = [];
  for (const s of shots) {
    if (!s.parent) continue;
    const from = byShot.get(s.parent);
    const to = byShot.get(s.name);
    if (!from || !to || from === to) continue;
    if (edges.some((e) => e.from === from && e.to === to && e.label === (s.via ?? null))) continue;
    edges.push({ from, to, label: s.via ?? null });
  }

  const w = Math.max(...nodes.map((n) => n.x + NODE_W), NODE_W) + 80;
  const h = Math.max(...nodes.map((n) => n.y + NODE_H), NODE_H) + 80;
  return { nodes, edges, w, h };
}

/** Figma-ish connector: leaves the right edge, arrives at the left edge. */
function path(e: Edge): string {
  const x1 = e.from.x + NODE_W;
  const y1 = e.from.y + NODE_H / 2;
  const x2 = e.to.x;
  const y2 = e.to.y + NODE_H / 2;
  const dx = Math.max(60, Math.abs(x2 - x1) / 2);
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

export default function FlowMap({ shots, onZoom }: { shots: Shot[]; onZoom: (url: string) => void }) {
  const { nodes, edges, w, h } = useMemo(() => layout(shots), [shots]);
  const [view, setView] = useState({ x: 24, y: 24, k: 0.6 });
  const drag = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);

  if (nodes.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-chalk-dim">
        ยังไม่มีหน้าจอให้วางผัง
      </div>
    );
  }

  const zoomBy = (f: number) =>
    setView((v) => ({ ...v, k: Math.min(1.6, Math.max(0.2, v.k * f)) }));

  return (
    <div
      // CSS owns the cursor: reading the drag ref during render is exactly the
      // kind of tearing the refs lint rule exists to prevent.
      className="bg-grid relative min-h-0 flex-1 cursor-grab overflow-hidden active:cursor-grabbing"
      onPointerDown={(e) => {
        drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        setView((v) => ({ ...v, x: d.vx + (e.clientX - d.x), y: d.vy + (e.clientY - d.y) }));
      }}
      onPointerUp={() => {
        drag.current = null;
      }}
      onWheel={(e) => {
        if (!e.ctrlKey && !e.metaKey) return;
        e.preventDefault();
        zoomBy(e.deltaY < 0 ? 1.1 : 0.9);
      }}
    >
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`, width: w, height: h }}
      >
        <svg width={w} height={h} className="pointer-events-none absolute left-0 top-0">
          <defs>
            <marker id="fm-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#64cefb" />
            </marker>
          </defs>
          {edges.map((e, i) => {
            const mid = { x: (e.from.x + NODE_W + e.to.x) / 2, y: (e.from.y + e.to.y) / 2 + NODE_H / 2 };
            return (
              <g key={i}>
                <path
                  d={path(e)}
                  fill="none"
                  stroke="#64cefb"
                  strokeWidth={2}
                  strokeOpacity={0.75}
                  markerEnd="url(#fm-arrow)"
                />
                {e.label && (
                  <text
                    x={mid.x}
                    y={mid.y - 6}
                    textAnchor="middle"
                    className="fill-chalk-dim"
                    style={{ fontSize: 11, paintOrder: "stroke", stroke: "#0a0a0a", strokeWidth: 4 }}
                  >
                    {e.label.length > 26 ? `${e.label.slice(0, 26)}…` : e.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {nodes.map((n) => (
          <div key={n.shot.path} className="absolute" style={{ left: n.x, top: n.y, width: NODE_W }}>
            <p className="mb-1 truncate font-display text-[12px] text-chalk-dim" title={n.shot.name}>
              {n.shot.name}
            </p>
            <button
              onClick={() => onZoom(n.shot.url)}
              onPointerDown={(e) => e.stopPropagation()}
              className="block overflow-hidden rounded-lg border-2 border-night-edge bg-white transition hover:border-shine"
              style={{ width: NODE_W, height: NODE_H }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={n.shot.url} alt={n.shot.name} className="h-full w-full object-cover object-top" />
            </button>
          </div>
        ))}
      </div>

      <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-full border border-night-edge bg-night-panel/90 px-1.5 py-1 backdrop-blur">
        <button onClick={() => zoomBy(0.9)} aria-label="ย่อ" className="rounded-full p-1 text-chalk-dim hover:text-chalk">
          <Minus size={13} />
        </button>
        <span className="w-10 text-center font-mono text-[11px] text-chalk-dim">
          {Math.round(view.k * 100)}%
        </span>
        <button onClick={() => zoomBy(1.1)} aria-label="ขยาย" className="rounded-full p-1 text-chalk-dim hover:text-chalk">
          <Plus size={13} />
        </button>
        <button
          onClick={() => setView({ x: 24, y: 24, k: 0.6 })}
          title="จัดให้พอดี"
          className="rounded-full p-1 text-chalk-dim hover:text-chalk"
        >
          <Maximize2 size={13} />
        </button>
      </div>

      <p className="pointer-events-none absolute bottom-3 left-4 font-mono text-[10px] text-chalk-dim">
        ลากเพื่อเลื่อน · Ctrl/⌘ + ล้อเมาส์ เพื่อซูม · คลิกเฟรมเพื่อดูเต็ม
      </p>
    </div>
  );
}
