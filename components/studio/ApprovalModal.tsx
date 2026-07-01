"use client";

import { useEffect, useState } from "react";
import { Check, Clock, Send, Users, X } from "lucide-react";
import Overlay from "@/components/ui/Overlay";
import GlassSurface from "@/components/ui/GlassSurface";
import { fetchApprovalRoster, type ApprovalPerson } from "@/lib/approval-roster";
import type { PhaseId } from "@/lib/phases";

/**
 * Confirm-before-approve modal for shared projects. Opening it shows WHO has
 * already approved this phase (✓) and who is still pending (⏳); confirming
 * records the current user's approval (the phase advances once everyone has).
 * If the user has already approved, it's a read-only "waiting on N others" view.
 * Roster is fetched fresh each open.
 */
export default function ApprovalModal({
  open,
  onClose,
  projectId,
  phase,
  phaseLabel,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  phase: PhaseId;
  phaseLabel: string;
  /** Records this user's approval + advances if everyone has approved. */
  onConfirm: () => void | Promise<void>;
}) {
  const [people, setPeople] = useState<ApprovalPerson[] | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      const list = await fetchApprovalRoster(projectId, phase).catch(() => []);
      if (!cancelled) setPeople(list);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, projectId, phase]);

  if (!open) return null;

  const mineApproved = people?.some((p) => p.isMe && p.approved) ?? false;
  const approvedCount = people?.filter((p) => p.approved).length ?? 0;
  const total = people?.length ?? 0;
  const remaining = total - approvedCount;

  const confirm = async () => {
    setSubmitting(true);
    try {
      await onConfirm(); // Studio records the approval and closes this modal
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Overlay open onClose={onClose} placement="center">
      <GlassSurface strong className="flex w-full max-w-md flex-col overflow-hidden rounded-xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-night-edge px-5 py-3.5">
          <div className="flex items-center gap-3">
            <span className="grid size-8 place-items-center rounded-lg bg-shine/10 text-shine">
              <Users size={16} />
            </span>
            <div>
              <p className="font-display text-sm font-semibold text-chalk">อนุมัติเฟส “{phaseLabel}”</p>
              <p className="font-mono text-[11px] text-chalk-dim">
                {people === null ? "กำลังโหลด…" : `อนุมัติแล้ว ${approvedCount}/${total} คน`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="ปิด"
            className="shrink-0 text-chalk-dim transition hover:text-chalk"
          >
            <X size={18} />
          </button>
        </div>

        {/* Roster */}
        <div className="scroll-thin max-h-72 min-h-0 overflow-y-auto px-2 py-2">
          {people === null ? (
            <p className="px-3 py-3 text-[13px] text-chalk-dim">กำลังโหลดรายชื่อ…</p>
          ) : people.length === 0 ? (
            <p className="px-3 py-3 text-[13px] text-chalk-dim">ไม่มีผู้อนุมัติ</p>
          ) : (
            <ul>
              {people.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-3 rounded-md px-3 py-2 text-[13px]"
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span
                      className={`grid size-6 shrink-0 place-items-center rounded-full ${
                        p.approved ? "bg-go/15 text-go" : "bg-chalk/10 text-chalk-dim"
                      }`}
                    >
                      {p.approved ? <Check size={13} /> : <Clock size={13} />}
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

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-night-edge bg-night px-5 py-3">
          <p className="text-[11px] text-chalk-dim">
            {mineApproved
              ? remaining > 0
                ? `คุณอนุมัติแล้ว — รออีก ${remaining} คน`
                : "อนุมัติครบทุกคนแล้ว"
              : "เฟสจะไปต่อเมื่อทุกคนอนุมัติครบ"}
          </p>
          {mineApproved ? (
            <button
              onClick={onClose}
              className="rounded-lg border border-night-edge px-4 py-2 text-sm text-chalk-dim transition hover:border-shine hover:text-chalk"
            >
              ปิด
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                disabled={submitting}
                className="rounded-lg border border-night-edge px-4 py-2 text-sm text-chalk-dim transition hover:border-shine hover:text-chalk disabled:opacity-40"
              >
                ยกเลิก
              </button>
              <button
                onClick={() => void confirm()}
                disabled={submitting || people === null}
                className="inline-flex items-center gap-1.5 rounded-lg bg-shine px-4 py-2 font-display text-sm font-semibold text-night transition hover:bg-shine-soft disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Send size={14} /> {submitting ? "กำลังยืนยัน…" : "ยืนยันการอนุมัติ"}
              </button>
            </div>
          )}
        </div>
      </GlassSurface>
    </Overlay>
  );
}
