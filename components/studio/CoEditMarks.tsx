"use client";

import { useLayoutEffect, useState } from "react";
import type { RefObject } from "react";
import { Users } from "lucide-react";
import { fieldAt, type CoEditor } from "./useSharedDoc";

interface Box {
  editor: CoEditor;
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * An outline in each co-editor's colour around the field they are in, with
 * their name on it — so two people do not type into the same box at once.
 *
 * Rendered inside the panel's scrolling root (which must be `relative`), placed
 * in that root's content coordinates, so it scrolls with the field it marks.
 * `layout` is anything whose change can move fields: the document itself.
 */
export function CoEditMarks({
  root,
  editors,
  layout,
}: {
  root: RefObject<HTMLElement | null>;
  editors: CoEditor[];
  layout: unknown;
}) {
  const [boxes, setBoxes] = useState<Box[]>([]);

  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const measure = () => {
      const frame = el.getBoundingClientRect();
      setBoxes(
        editors.flatMap((editor) => {
          const field = editor.field ? fieldAt(el, editor.field) : null;
          if (!field) return [];
          const r = field.getBoundingClientRect();
          return [
            {
              editor,
              top: r.top - frame.top + el.scrollTop,
              left: r.left - frame.left + el.scrollLeft,
              width: r.width,
              height: r.height,
            },
          ];
        })
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [root, editors, layout]);

  return (
    <>
      {boxes.map((b) => (
        <div
          key={b.editor.id}
          aria-hidden
          className="pointer-events-none absolute z-10 rounded-lg"
          style={{
            top: b.top - 2,
            left: b.left - 2,
            width: b.width + 4,
            height: b.height + 4,
            boxShadow: `0 0 0 2px ${b.editor.color}`,
          }}
        >
          <span
            className="absolute -top-[18px] left-0 whitespace-nowrap rounded px-1.5 py-px text-[11px] font-medium text-white"
            style={{ background: b.editor.color }}
          >
            {b.editor.name}
          </span>
        </div>
      ))}
    </>
  );
}

/** Who else has this document open right now. Nothing when it is only you. */
export function CoEditors({ editors }: { editors: CoEditor[] }) {
  if (editors.length === 0) return null;
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-night-edge bg-night/40 px-3 py-2 text-[12.5px] text-chalk-dim">
      <Users size={13} className="text-shine" />
      <span>แก้ไขพร้อมกันอยู่ตอนนี้</span>
      {editors.map((e) => (
        <span key={e.id} className="inline-flex items-center gap-1.5 text-chalk">
          <span className="size-2 rounded-full" style={{ background: e.color }} />
          {e.name}
        </span>
      ))}
      <span className="ml-auto">เห็นสิ่งที่อีกฝ่ายพิมพ์ทันที</span>
    </div>
  );
}
