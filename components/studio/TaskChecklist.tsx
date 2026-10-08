"use client";

import { AlertTriangle, CheckCircle2, Circle, Loader2, Play, XCircle } from "lucide-react";
import { taskProgress, type BuildTask, type TaskStatus } from "@/lib/tasks";

const STATUS: Record<TaskStatus, { label: string; tone: string; Icon: typeof Circle }> = {
  pending: { label: "รอคิว", tone: "text-chalk-dim", Icon: Circle },
  running: { label: "กำลังทำ", tone: "text-shine", Icon: Loader2 },
  done: { label: "เสร็จ", tone: "text-go", Icon: CheckCircle2 },
  partial: { label: "ยังไม่ครบ", tone: "text-amber-300 light:text-amber-700", Icon: AlertTriangle },
  failed: { label: "ไม่สำเร็จ", tone: "text-halt", Icon: XCircle },
};

/**
 * A many-item request as a checklist: how many tasks, which are done, and what
 * each unfinished one still lacks. The list is worked one task per turn
 * (Studio runTaskList); this only shows where it stands and offers to carry on.
 */
export default function TaskChecklist({
  tasks,
  working,
  onResume,
}: {
  tasks: BuildTask[];
  /** A turn is running right now (this list's or anything else's). */
  working: boolean;
  /** Carry on with the open tasks (absent for read-only viewers). */
  onResume?: () => void;
}) {
  const { done, total, open } = taskProgress(tasks);
  return (
    <div className="mt-2 overflow-hidden rounded-lg border border-night-edge bg-night-panel">
      <div className="flex items-center gap-3 border-b border-night-edge px-3.5 py-2.5">
        <span className="font-display text-[13px] font-semibold text-chalk">รายการงาน</span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-chalk/10">
          <div className="h-full rounded-full bg-go transition-all" style={{ width: `${(done / total) * 100}%` }} />
        </div>
        <span className="font-mono text-[11px] text-chalk-dim">
          เสร็จ {done}/{total}
        </span>
      </div>
      <ol className="divide-y divide-night-edge">
        {tasks.map((task, i) => {
          // "running" with no turn running is a task whose turn ended with its tab.
          const status: TaskStatus = task.status === "running" && !working ? "pending" : task.status;
          const { label, tone, Icon } = STATUS[status];
          return (
            <li key={task.id} className="flex gap-2.5 px-3.5 py-2" title={task.detail}>
              <span className="w-5 shrink-0 pt-px text-right font-mono text-[11px] text-chalk-dim">{i + 1}.</span>
              <Icon size={14} className={`mt-0.5 shrink-0 ${tone} ${status === "running" ? "animate-spin" : ""}`} />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] leading-snug text-chalk">{task.title}</p>
                {task.note && status !== "running" && (
                  <p className={`mt-0.5 text-[11.5px] leading-snug ${status === "done" ? "text-chalk-dim" : tone}`}>
                    {task.note}
                  </p>
                )}
              </div>
              <span className={`shrink-0 pt-px font-display text-[11px] ${tone}`}>{label}</span>
            </li>
          );
        })}
      </ol>
      {!working && open.length > 0 && onResume && (
        <div className="border-t border-night-edge px-3.5 py-2.5">
          <button
            onClick={onResume}
            className="inline-flex items-center gap-1.5 rounded-full bg-shine px-3 py-1.5 font-display text-[12px] font-semibold text-night transition hover:brightness-110"
          >
            <Play size={12} /> ทำข้อที่ค้างต่อ ({open.length})
          </button>
        </div>
      )}
    </div>
  );
}
