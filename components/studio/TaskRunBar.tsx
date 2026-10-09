"use client";

import { useState } from "react";
import { ChevronDown, ListChecks, Loader2 } from "lucide-react";
import { taskProgress, type BuildTask } from "@/lib/tasks";
import TaskChecklist from "./TaskChecklist";

/**
 * A task list pinned above the chat. Its own message scrolls away as the turns
 * pile up below it, so this keeps where the list stands in sight — and, while
 * the list runs, says the system works every task by itself: people who saw
 * only the first task finish thought it had stopped and sent the request again.
 */
export default function TaskRunBar({
  tasks,
  running,
  working,
  onResume,
}: {
  tasks: BuildTask[];
  /** This list is being worked now. */
  running: boolean;
  /** A turn is running right now (this list's or anything else's). */
  working: boolean;
  /** Carry on with the open tasks (absent for read-only viewers). */
  onResume?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const { done, total, open: left } = taskProgress(tasks);
  const current = tasks.findIndex((t) => t.status === "running");
  const headline = running
    ? current >= 0
      ? `กำลังทำข้อ ${current + 1}/${total} · ${tasks[current].title}`
      : "กำลังไปข้อถัดไป…"
    : `รายการงานค้าง ${left.length} จาก ${total} ข้อ`;

  return (
    <div className="shrink-0 border-b border-night-edge bg-night-panel">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        title={open ? "ซ่อนรายการงาน" : "ดูรายการงานทั้งหมด"}
        className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left transition hover:bg-chalk/[0.03]"
      >
        {running ? (
          <Loader2 size={15} className="shrink-0 animate-spin text-shine" />
        ) : (
          <ListChecks size={15} className="shrink-0 text-amber-300 light:text-amber-700" />
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-chalk">{headline}</span>
          <span className="mt-1.5 flex items-center gap-2">
            <span className="h-1 flex-1 overflow-hidden rounded-full bg-chalk/10">
              <span
                className="block h-full rounded-full bg-go transition-all"
                style={{ width: `${(done / total) * 100}%` }}
              />
            </span>
            <span className="shrink-0 font-mono text-[10.5px] text-chalk-dim">
              เสร็จ {done}/{total}
            </span>
          </span>
        </span>
        <ChevronDown size={15} className={`shrink-0 text-chalk-dim transition ${open ? "rotate-180" : ""}`} />
      </button>
      {running && (
        <p className="-mt-0.5 px-4 pb-2.5 pl-[2.6rem] text-[11.5px] leading-snug text-chalk-dim">
          ระบบทำต่อเองทีละข้อจนครบ ไม่ต้องส่งคำสั่งซ้ำ เปิดหน้านี้ไว้จนครบ ถ้าปิดหรือโหลดใหม่ รายการจะหยุดที่ข้อนั้น อยากเลิกกลางทางกด “หยุด”
        </p>
      )}
      {open && (
        <div className="scroll-thin max-h-[45vh] overflow-y-auto px-3 pb-3">
          <TaskChecklist tasks={tasks} working={working} onResume={onResume} header={false} />
        </div>
      )}
    </div>
  );
}
