import { getApprovalState } from "./storage";
import { listMembers } from "./sharing";

/** One approver's status for the current phase (for the approval modal). */
export interface ApprovalPerson {
  id: string;
  name: string;
  approved: boolean;
  isMe: boolean;
  isOwner: boolean;
}

/**
 * Who must approve `phase` and who already has, resolved to display names.
 * Names come from listMembers (editors/viewers); the one approver NOT in the
 * members table is the project owner (owners aren't stored as member rows).
 * Pending approvers sort first — that's who a waiting viewer cares about.
 */
export async function fetchApprovalRoster(
  projectId: string,
  phase: string
): Promise<ApprovalPerson[]> {
  const [state, members] = await Promise.all([
    getApprovalState(projectId, phase),
    listMembers(projectId).catch(() => []),
  ]);
  const byId = new Map(members.map((m) => [m.userId, m]));
  const list: ApprovalPerson[] = state.approvers.map((id) => {
    const m = byId.get(id);
    const isOwner = !m; // an approver not in the members table is the owner
    const isMe = id === state.me;
    const name =
      m?.name?.trim() ||
      m?.email ||
      (isMe ? "คุณ" : isOwner ? "เจ้าของโปรเจกต์" : "สมาชิก");
    return { id, name, approved: state.approved.includes(id), isMe, isOwner };
  });
  list.sort((a, b) => Number(a.approved) - Number(b.approved));
  return list;
}
