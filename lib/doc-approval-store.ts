"use client";

import { createClient } from "@/lib/supabase/client";
import type { Json } from "@/lib/db/types";
import type { ApprovalDocKind, ApprovalRow, ApprovalStatus } from "./doc-approval";
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
});

const COLUMNS = "id, approver_id, requested_by, requested_at, status, snapshot, decided_by, decided_at, comment";

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

export async function requestApproval(
  projectId: string,
  kind: ApprovalDocKind,
  version: VersionKey,
  approverId: string,
  doc: object
): Promise<void> {
  const { error } = await createClient().rpc("fittbuilder_request_approval", {
    pid: projectId,
    kind,
    ver: version,
    approver: approverId,
    snap: doc as unknown as Json,
  });
  if (error) throw error;
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
}

/** One request on the approval page: the document as sent, and where it came from. */
export interface ApprovalItem extends ApprovalRow {
  projectId: string;
  projectName: string;
  kind: ApprovalDocKind;
  version: VersionKey;
}

/** Requests waiting on me, and the ones I decided most recently. */
export async function myApprovals(meId: string): Promise<{ waiting: ApprovalItem[]; decided: ApprovalItem[] }> {
  const supabase = createClient();
  const select = `${COLUMNS}, project_id, doc_kind, version`;
  const [waiting, decided] = await Promise.all([
    supabase.from(TABLE).select(select).eq("approver_id", meId).eq("status", "pending").order("requested_at"),
    supabase
      .from(TABLE)
      .select(select)
      .eq("decided_by", meId)
      .in("status", ["approved", "returned"])
      .order("decided_at", { ascending: false })
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
  return { waiting: (waiting.data ?? []).map(item), decided: (decided.data ?? []).map(item) };
}
