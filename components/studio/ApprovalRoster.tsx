"use client";

import { useEffect, useState } from "react";
import { Check, ChevronDown, Clock, Users } from "lucide-react";
import { getApprovalState } from "@/lib/storage";
import { listMembers } from "@/lib/sharing";
import type { PhaseId } from "@/lib/phases";

interface Person {
  id: string;
  name: string;
  approved: boolean;
  isMe: boolean;
  isOwner: boolean;
}

/**
 * "Who has approved this phase" roster — a popover next to the approve button on
 * shared projects. The tally (X/Y) lives on the button; this shows the per-person
 * breakdown the tally can't: each approver (owner + editors) with a ✓ (approved)
 * or ⏳ (pending). Names come from listMembers; the one approver NOT in the
 * members table is the owner (owners aren't stored as member rows). Fetches lazily
 * on open so a closed roster costs nothing.
 */
export default function ApprovalRoster({
  projectId,
  phase,
}: {
  projectId: string;
  phase: PhaseId;
}) {
  const [open, setOpen] = useState(false);
  const [people, setPeople] = useState<Person[] | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      const [state, members] = await Promise.all([
        getApprovalState(projectId, phase),
        listMembers(projectId).catch(() => []),
      ]);
      if (cancelled) return;
      const byId = new Map(members.map((m) => [m.userId, m]));
      const list: Person[] = state.approvers.map((id) => {
        const m = byId.get(id);
        const isOwner = !m; // an approver not in the members table is the owner
        const isMe = id === state.me;
        const name =
          m?.name?.trim() ||
          m?.email ||
          (isMe ? "คุณ" : isOwner ? "เจ้าของโปรเจกต์" : "สมาชิก");
        return { id, name, approved: state.approved.includes(id), isMe, isOwner };
      });
      // Pending first (that's what the viewer is waiting on), then approved.
      list.sort((a, b) => Number(a.approved) - Number(b.approved));
      setPeople(list);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, projectId, phase]);

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => {
          if (!open) setPeople(null); // fresh "loading" each time it opens
          setOpen((v) => !v);
        }}
        title="ดูว่าใครอนุมัติแล้ว / ยังไม่อนุมัติ"
        className={`inline-flex items-center gap-1.5 rounded-sm border px-2 py-1.5 text-xs transition ${
          open
            ? "border-shine/60 text-chalk"
            : "border-night-edge text-chalk-dim hover:border-shine/60 hover:text-chalk"
        }`}
      >
        <Users size={13} />
        <span className="hidden sm:inline">ผู้อนุมัติ</span>
        <ChevronDown size={12} className={`transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1 w-64 overflow-hidden rounded-lg border border-night-edge bg-night-panel shadow-xl">
            <p className="border-b border-night-edge px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-chalk-dim">
              การอนุมัติเฟสนี้
            </p>
            {people === null ? (
              <p className="px-3 py-3 text-[12px] text-chalk-dim">กำลังโหลด…</p>
            ) : people.length === 0 ? (
              <p className="px-3 py-3 text-[12px] text-chalk-dim">ไม่มีผู้อนุมัติ</p>
            ) : (
              <ul className="max-h-72 overflow-y-auto py-1">
                {people.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-3 px-3 py-1.5 text-[13px]"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className={`grid size-5 shrink-0 place-items-center rounded-full ${
                          p.approved ? "bg-go/15 text-go" : "bg-chalk/10 text-chalk-dim"
                        }`}
                      >
                        {p.approved ? <Check size={12} /> : <Clock size={12} />}
                      </span>
                      <span className="truncate text-chalk/90">
                        {p.name}
                        {p.isMe && <span className="text-chalk-dim"> (คุณ)</span>}
                        {p.isOwner && <span className="text-chalk-dim"> · เจ้าของ</span>}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 font-mono text-[10px] uppercase tracking-wider ${
                        p.approved ? "text-go" : "text-chalk-dim"
                      }`}
                    >
                      {p.approved ? "อนุมัติแล้ว" : "รออยู่"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
