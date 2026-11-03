"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BadgeCheck, Clock, Loader2, Send, Undo2 } from "lucide-react";
import { currentUser } from "@/lib/current-user";
import { approvalState, canExport, type ApprovalDocKind, type ApprovalState } from "@/lib/doc-approval";
import {
  approveNow,
  listApprovals,
  projectApprovers,
  requestApproval,
  type Approver,
} from "@/lib/doc-approval-store";
import { thaiDateShort } from "@/lib/quote";
import { toast } from "@/lib/toast";
import type { VersionKey } from "@/lib/versions";

const ROLE_LABEL: Record<string, string> = { owner: "เจ้าของ", admin: "ผู้ดูแล", approver: "ผู้อนุมัติ" };

/**
 * Where a quotation or proposal stands in its approval, and whether it may be
 * printed (docs/superpowers/specs/2026-11-03-document-approval-design.md).
 * Outside a workspace there is nothing to approve and printing is open.
 */
export function useDocApproval(
  projectId: string,
  kind: ApprovalDocKind,
  version: VersionKey,
  doc: object | null,
  inWorkspace: boolean
) {
  const [approvers, setApprovers] = useState<Approver[]>([]);
  const [meId, setMeId] = useState<string | null>(null);
  const [rows, setRows] = useState<Awaited<ReturnType<typeof listApprovals>> | null>(null);

  const reload = useCallback(async () => {
    if (!inWorkspace) return;
    const [found, people, me] = await Promise.all([
      listApprovals(projectId, kind, version),
      projectApprovers(projectId).catch(() => [] as Approver[]),
      currentUser(),
    ]);
    setRows(found);
    setApprovers(people);
    setMeId(me?.id ?? null);
  }, [projectId, kind, version, inWorkspace]);

  useEffect(() => {
    reload().catch((e) => console.error("[approval] load failed:", e));
  }, [reload]);

  // The live document against the snapshot approved decides "approved" or "edited since".
  const state: ApprovalState = useMemo(
    () => (doc && rows ? approvalState(rows, doc) : { kind: "none" }),
    [doc, rows]
  );

  return {
    state,
    approvers,
    meId,
    reload,
    exportAllowed: canExport(state, inWorkspace),
  };
}

/** The status line above the print buttons, with sending for approval. */
export function ApprovalBar({
  projectId,
  kind,
  version,
  doc,
  readOnly,
  approval,
}: {
  projectId: string;
  kind: ApprovalDocKind;
  version: VersionKey;
  doc: object;
  readOnly: boolean;
  approval: ReturnType<typeof useDocApproval>;
}) {
  const { state, approvers, meId, reload } = approval;
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const nameOf = (id: string) => {
    const a = approvers.find((p) => p.userId === id);
    return a ? a.name || a.email : "ผู้อนุมัติ";
  };
  const mine = approvers.find((a) => a.userId === meId);
  const canApproveNow = mine !== undefined && (mine.role === "owner" || mine.role === "admin");

  const send = async (approverId: string) => {
    setBusy(true);
    try {
      await requestApproval(projectId, kind, version, approverId, doc);
      toast.success(`ส่งให้ ${nameOf(approverId)} อนุมัติแล้ว`);
      setPicking(false);
      await reload();
    } catch (e) {
      toast.error("ส่งอนุมัติไม่สำเร็จ", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  };
  const approveSelf = async () => {
    setBusy(true);
    try {
      await approveNow(projectId, kind, version, doc);
      toast.success("อนุมัติแล้ว");
      await reload();
    } catch (e) {
      toast.error("อนุมัติไม่สำเร็จ", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  const line = (() => {
    switch (state.kind) {
      case "none":
        return { icon: Clock, tone: "text-chalk-dim", text: "ยังไม่ได้ส่งอนุมัติ — ต้องอนุมัติก่อนพิมพ์หรือบันทึก Word" };
      case "pending":
        return {
          icon: Clock,
          tone: "text-shine",
          text: `รออนุมัติจาก ${nameOf(state.request.approverId)} · ส่งเมื่อ ${thaiDateShort(state.request.requestedAt.slice(0, 10))}`,
        };
      case "approved":
        return {
          icon: BadgeCheck,
          tone: "text-go",
          text: `อนุมัติแล้วโดย ${nameOf(state.request.decidedBy ?? state.request.approverId)}${
            state.request.decidedAt ? ` · ${thaiDateShort(state.request.decidedAt.slice(0, 10))}` : ""
          }`,
        };
      case "changed":
        return { icon: Clock, tone: "text-halt", text: "แก้ไขหลังอนุมัติแล้ว — ต้องส่งอนุมัติใหม่ก่อนพิมพ์" };
      case "returned":
        return {
          icon: Undo2,
          tone: "text-halt",
          text: `ส่งกลับให้แก้โดย ${nameOf(state.request.decidedBy ?? state.request.approverId)}: ${state.request.comment ?? ""}`,
        };
    }
  })();
  const Icon = line.icon;
  const needsSending = state.kind !== "approved" && state.kind !== "pending";

  return (
    <div className="mt-3 rounded-lg border border-night-edge p-2.5">
      <p className={`flex items-start gap-1.5 text-[12.5px] leading-relaxed ${line.tone}`}>
        <Icon size={13} className="mt-0.5 shrink-0" />
        <span>{line.text}</span>
      </p>
      {!readOnly && (needsSending || state.kind === "pending") && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          <button
            onClick={() => setPicking((v) => !v)}
            disabled={busy || approvers.length === 0}
            className="inline-flex items-center gap-1 rounded-lg border border-night-edge px-2 py-1 font-display text-[12.5px] text-chalk transition hover:border-shine/60 disabled:opacity-50"
          >
            <Send size={12} /> {state.kind === "pending" ? "ส่งให้คนอื่นแทน" : "ส่งอนุมัติ"}
          </button>
          {canApproveNow && (
            <button
              onClick={() => void approveSelf()}
              disabled={busy}
              className="inline-flex items-center gap-1 rounded-lg border border-go/50 px-2 py-1 font-display text-[12.5px] text-go transition hover:bg-go/10 disabled:opacity-50"
            >
              {busy ? <Loader2 size={12} className="animate-spin" /> : <BadgeCheck size={12} />} อนุมัติเอง
            </button>
          )}
        </div>
      )}
      {picking && (
        <ul className="mt-2 space-y-1">
          {approvers.map((a) => (
            <li key={a.userId}>
              <button
                onClick={() => void send(a.userId)}
                disabled={busy}
                className="flex w-full items-center justify-between gap-2 rounded-md border border-night-edge px-2 py-1.5 text-left text-[12.5px] text-chalk transition hover:border-shine/60 disabled:opacity-50"
              >
                <span className="min-w-0 truncate">{a.name || a.email}</span>
                <span className="shrink-0 text-[11px] text-chalk-dim">{ROLE_LABEL[a.role] ?? a.role}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
