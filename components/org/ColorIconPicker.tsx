"use client";

import { Check } from "lucide-react";
import { WORKSPACE_COLORS, WORKSPACE_ICON_KEYS, WorkspaceIcon } from "@/lib/workspace-style";

/** Color + icon chooser for a workspace's visual identity. */
export default function ColorIconPicker({
  color,
  icon,
  onColor,
  onIcon,
}: {
  color: string;
  icon: string;
  onColor: (c: string) => void;
  onIcon: (i: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-1.5 font-mono text-[11px] uppercase tracking-wider text-chalk-dim">สี</p>
        <div className="flex flex-wrap gap-2">
          {WORKSPACE_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onColor(c)}
              className="grid h-7 w-7 place-items-center rounded-full transition hover:scale-110"
              style={{ background: c }}
              title={c}
            >
              {color === c && <Check size={14} className="text-night" />}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-1.5 font-mono text-[11px] uppercase tracking-wider text-chalk-dim">ไอคอน</p>
        <div className="flex flex-wrap gap-1.5">
          {WORKSPACE_ICON_KEYS.map((key) => {
            const active = icon === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onIcon(key)}
                className={`grid h-9 w-9 place-items-center rounded-lg border transition ${
                  active ? "border-transparent" : "border-night-edge text-chalk-dim hover:text-chalk"
                }`}
                style={active ? { background: color, color: "#0b0b0f" } : undefined}
              >
                <WorkspaceIcon icon={key} size={17} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
