"use client";

import { createClient } from "@/lib/supabase/client";
import { currentUser } from "@/lib/current-user";
import { approvalAlerts, type ApprovalAlert } from "./approval-notice";
import type { Json } from "@/lib/db/types";
import type { ApprovalDocKind, ApprovalRow, ApprovalStage, ApprovalStatus } from "./doc-approval";
import type { VersionKey } from "./versions";

/**
 * Reads and writes for approving quotations and proposals (migration 0063).
 * The table has no write policy: every write is one of its functions, which
 * check who is asking.
 */
const TABLE = "fittbuilder_doc_approvals";

type Row = {
  id: string;
  approver_id: string;
  requested_by: string;
  requested_at: string;
  status: string;
  snapshot: Json;
  decided_by: string | null;
  decided_at: string | null;
  comment: string | null;
  reviewer_id: string | null;
  stage: string;
  reviewed_at: string | null;
  review_note: string | null;
};

const toApproval = (r: Row): ApprovalRow => ({
  id: r.id,
  approverId: r.approver_id,
  requestedBy: r.requested_by,
  requestedAt: r.requested_at,
  status: r.status as ApprovalStatus,
  snapshot: r.snapshot,
  decidedBy: r.decided_by,
  decidedAt: r.decided_at,
  comment: r.comment,
  reviewerId: r.reviewer_id,
  stage: r.stage as ApprovalStage,
  reviewedAt: r.reviewed_at,
  reviewNote: r.review_note,
});

const COLUMNS =
  "id, approver_id, requested_by, requested_at, status, snapshot, decided_by, decided_at, comment, reviewer_id, stage, reviewed_at, review_note";

/** Every request made for one document. */
export async function listApprovals(
  projectId: string,
  kind: ApprovalDocKind,
  version: VersionKey
): Promise<ApprovalRow[]> {
  const { data, error } = await createClient()
    .from(TABLE)
    .select(COLUMNS)
    .eq("project_id", projectId)
    .eq("doc_kind", kind)
    .eq("version", version);
  if (error) throw error;
  return (data ?? []).map(toApproval);
}

export interface Approver {
  userId: string;
  email: string;
  name: string | null;
  role: string;
}

/** The people who can approve this project's documents. */
export async function projectApprovers(projectId: string): Promise<Approver[]> {
  const { data, error } = await createClient().rpc("fittbuilder_project_approvers", { pid: projectId });
  if (error) throw error;
  return (data ?? []).map((a) => ({ userId: a.user_id, email: a.email ?? "", name: a.name, role: a.role }));
}

/** Best effort: the move stands, and the page says so, whether or not the mail goes out. */
function mailAboutMove(id: string): void {
  void fetch("/api/approval-notice", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
    keepalive: true,
  }).catch((e) => console.error("[approval] notice failed:", e));
}

export async function requestApproval(
  projectId: string,
  kind: ApprovalDocKind,
  version: VersionKey,
  approverId: string,
  doc: object,
  /** Who checks it first; null sends it straight to the approver. */
  reviewerId: string | null
): Promise<void> {
  const { data: id, error } = await createClient().rpc("fittbuilder_request_approval", {
    pid: projectId,
    kind,
    ver: version,
    approver: approverId,
    snap: doc as unknown as Json,
    reviewer: reviewerId,
  });
  if (error) throw error;
  mailAboutMove(id);
}

/** The owner or an admin approving the document as it stands. */
export async function approveNow(
  projectId: string,
  kind: ApprovalDocKind,
  version: VersionKey,
  doc: object
): Promise<void> {
  const { error } = await createClient().rpc("fittbuilder_approve_now", {
    pid: projectId,
    kind,
    ver: version,
    snap: doc as unknown as Json,
  });
  if (error) throw error;
}

export async function decideApproval(id: string, approve: boolean, note: string): Promise<void> {
  const { error } = await createClient().rpc("fittbuilder_decide_approval", { aid: id, approve, note });
  if (error) throw error;
  mailAboutMove(id);
}

/** Moves on my own requests stay news for this long; what is on my desk stays until it is dealt with. */
const ALERT_DAYS = 7;

/** What the bell and the toasts tell the signed-in person about documents. */
export async function loadApprovalAlerts(): Promise<ApprovalAlert[]> {
  const me = await currentUser();
  if (!me) return [];
  const since = new Date(Date.now() - ALERT_DAYS * 86_400_000).toISOString();
  const supabase = createClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select(
      "id, status, stage, requested_by, requested_at, reviewer_id, reviewed_at, review_note, approver_id, decided_by, decided_at, comment, project_id, doc_kind"
    )
    .or(
      [
        `and(status.eq.pending,stage.eq.review,reviewer_id.eq.${me.id})`,
        `and(status.eq.pending,stage.eq.approve,approver_id.eq.${me.id})`,
        `and(requested_by.eq.${me.id},status.in.(approved,returned),decided_at.gte.${since})`,
        `and(requested_by.eq.${me.id},status.eq.pending,reviewed_at.gte.${since})`,
      ].join(",")
    );
  if (error) throw error;
  const rows = data ?? [];
  const ids = [...new Set(rows.map((r) => r.project_id))];
  const names = new Map<string, string>();
  if (ids.length) {
    const { data: projects } = await supabase.from("fittbuilder_projects").select("id, name").in("id", ids);
    for (const p of projects ?? []) names.set(p.id, p.name);
  }
  return approvalAlerts(
    rows.map((r) => ({
      id: r.id,
      status: r.status as ApprovalStatus,
      stage: r.stage as ApprovalStage,
      requestedBy: r.requested_by,
      requestedAt: r.requested_at,
      reviewerId: r.reviewer_id,
      reviewedAt: r.reviewed_at,
      reviewNote: r.review_note,
      approverId: r.approver_id,
      decidedBy: r.decided_by,
      decidedAt: r.decided_at,
      comment: r.comment,
      kind: r.doc_kind as ApprovalDocKind,
      projectId: r.project_id,
      projectName: names.get(r.project_id) ?? "—",
    })),
    me.id
  );
}

/** One request on the approval page: the document as sent, and where it came from. */
export interface ApprovalItem extends ApprovalRow {
  projectId: string;
  projectName: string;
  kind: ApprovalDocKind;
  version: VersionKey;
}

/**
 * Requests on my desk — to review, or to approve once reviewed — and the ones
 * I acted on most recently: decided, or passed on after review.
 */
export async function myApprovals(meId: string): Promise<{ waiting: ApprovalItem[]; decided: ApprovalItem[] }> {
  const supabase = createClient();
  const select = `${COLUMNS}, project_id, doc_kind, version`;
  const [waiting, decided] = await Promise.all([
    supabase
      .from(TABLE)
      .select(select)
      .eq("status", "pending")
      .or(`and(stage.eq.review,reviewer_id.eq.${meId}),and(stage.eq.approve,approver_id.eq.${meId})`)
      .order("requested_at"),
    supabase
      .from(TABLE)
      .select(select)
      .neq("status", "withdrawn")
      .or(`and(decided_by.eq.${meId},status.neq.pending),and(reviewer_id.eq.${meId},reviewed_at.not.is.null)`)
      .order("requested_at", { ascending: false })
      .limit(20),
  ]);
  if (waiting.error) throw waiting.error;
  if (decided.error) throw decided.error;
  const rows = [...(waiting.data ?? []), ...(decided.data ?? [])];
  const ids = [...new Set(rows.map((r) => r.project_id))];
  const names = new Map<string, string>();
  if (ids.length) {
    const { data } = await supabase.from("fittbuilder_projects").select("id, name").in("id", ids);
    for (const p of data ?? []) names.set(p.id, p.name);
  }
  const item = (r: (typeof rows)[number]): ApprovalItem => ({
    ...toApproval(r),
    projectId: r.project_id,
    projectName: names.get(r.project_id) ?? "—",
    kind: r.doc_kind as ApprovalDocKind,
    version: r.version as VersionKey,
  });
  // Reviewed by me and now mine to approve: on the desk, not in the history.
  const onDesk = new Set((waiting.data ?? []).map((r) => r.id));
  return {
    waiting: (waiting.data ?? []).map(item),
    decided: (decided.data ?? []).filter((r) => !onDesk.has(r.id)).map(item),
  };
}
