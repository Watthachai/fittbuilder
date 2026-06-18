"use client";

import type { DesignOption } from "@/lib/design";

/**
 * "Design previews are ready" step (Google AI Studio style). Each card renders a
 * faux-UI preview built from the option's palette — a cheap, instant stand-in for
 * a real build — plus the name and Thai description. Picking one steers the single
 * build that follows; "ข้าม" builds with no style directive.
 */
export default function DesignPicker({
  options,
  onSelect,
  onSkip,
}: {
  options: DesignOption[];
  onSelect: (option: DesignOption) => void;
  onSkip: () => void;
}) {
  return (
    <div className="scroll-thin h-full w-full overflow-y-auto px-6 py-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-chalk">ดีไซน์พร้อมให้เลือกแล้ว</h2>
            <p className="mt-0.5 text-[13px] text-chalk-dim">
              เลือกแนวทางที่ชอบ แล้ว AI จะสร้าง demo ตามสไตล์นั้น — หรือกดข้ามเพื่อให้ AI เลือกให้
            </p>
          </div>
          <button
            onClick={onSkip}
            className="shrink-0 rounded-sm border border-night-edge px-3 py-1.5 font-display text-xs text-chalk-dim transition hover:text-chalk"
          >
            ข้าม
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {options.map((option, i) => (
            <button
              key={`${option.name}-${i}`}
              onClick={() => onSelect(option)}
              className="group flex flex-col overflow-hidden rounded-xl border border-night-edge bg-night-panel text-left transition hover:border-shine"
            >
              <Swatch option={option} />
              <div className="flex flex-1 flex-col gap-1 px-3.5 py-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-display text-[14px] font-semibold text-chalk">{option.name}</span>
                  <span
                    className="h-3.5 w-3.5 shrink-0 rounded-full ring-1 ring-night-edge"
                    style={{ background: option.palette.primary }}
                  />
                </div>
                <p className="text-[12px] leading-relaxed text-chalk-dim">{option.description}</p>
                <span className="mt-2 font-mono text-[10px] uppercase tracking-wider text-shine opacity-0 transition group-hover:opacity-100">
                  เลือกดีไซน์นี้ →
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** A tiny mock interface painted with the option's palette. */
function Swatch({ option }: { option: DesignOption }) {
  const { bg, surface, primary, text } = option.palette;
  return (
    <div className="flex h-32 flex-col gap-2 p-3" style={{ background: bg }}>
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full" style={{ background: primary }} />
        <span className="h-1.5 w-12 rounded-full" style={{ background: text, opacity: 0.8 }} />
        <span className="ml-auto h-3 w-10 rounded" style={{ background: primary }} />
      </div>
      <div className="flex flex-1 gap-2">
        <div className="flex flex-[2] flex-col gap-1.5 rounded-md p-2" style={{ background: surface }}>
          <span className="h-1.5 w-3/4 rounded-full" style={{ background: text, opacity: 0.7 }} />
          <span className="h-1.5 w-1/2 rounded-full" style={{ background: text, opacity: 0.45 }} />
          <span className="mt-auto h-4 w-14 rounded" style={{ background: primary }} />
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <div className="flex-1 rounded-md" style={{ background: surface }} />
          <div className="flex-1 rounded-md" style={{ background: surface }} />
        </div>
      </div>
    </div>
  );
}
