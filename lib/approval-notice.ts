import { waitingOn, type ApprovalDocKind, type ApprovalRow } from "./doc-approval";

/** A request on a document, with what its notices name. */
export type ApprovalEvent = Omit<ApprovalRow, "snapshot"> & {
  kind: ApprovalDocKind;
  projectId: string;
  projectName: string;
};

/** One person told about a move on a request. `path` is where the notice takes them. */
export interface ApprovalNotice {
  to: string;
  subject: string;
  heading: string;
  message: string;
  actionLabel: string;
  path: string;
}

/** The bell's and the toasts' version of a notice. `waiting` means it is on this person's desk. */
export interface ApprovalAlert {
  key: string;
  title: string;
  body: string;
  href: string;
  waiting: boolean;
}

const KIND_LABEL: Record<ApprovalDocKind, string> = { quote: "ใบเสนอราคา", proposal: "ข้อเสนอโครงการ" };

/** The browser asks for the notices straight after a move: long enough for a slow network, too short to re-send one later. */
const MOVE_WINDOW_MS = 2 * 60_000;

const about = (r: ApprovalEvent) => `${KIND_LABEL[r.kind]} · ${r.projectName}`;
const desk = "/approvals";
const paper = (r: ApprovalEvent) => `/project/${r.projectId}`;

/** Who made a request's latest move, and when. A withdrawn request has no move worth telling. */
function lastMove(r: ApprovalEvent): { by: string; at: string } | null {
  if (r.status === "withdrawn") return null;
  if (r.status !== "pending") return r.decidedBy && r.decidedAt ? { by: r.decidedBy, at: r.decidedAt } : null;
  if (r.reviewerId && r.reviewedAt) return { by: r.reviewerId, at: r.reviewedAt };
  return { by: r.requestedBy, at: r.requestedAt };
}

/**
 * The people to tell about a request's latest move, the one who must act first.
 * Whoever made the move already knows, and one person holding two parts hears once.
 */
export function approvalNotices(r: ApprovalEvent, nameOf: (id: string) => string): ApprovalNotice[] {
  const move = lastMove(r);
  if (!move) return [];
  const told = new Set([move.by]);
  return draftNotices(r, nameOf).filter((notice) => {
    if (told.has(notice.to)) return false;
    told.add(notice.to);
    return true;
  });
}

function draftNotices(r: ApprovalEvent, nameOf: (id: string) => string): ApprovalNotice[] {
  const doc = `${KIND_LABEL[r.kind]}ของโปรเจกต์ ${r.projectName}`;
  const toDesk = { actionLabel: "เปิดหน้าอนุมัติเอกสาร", path: desk };
  const toPaper = { actionLabel: "เปิดเอกสาร", path: paper(r) };
  const sender = nameOf(r.requestedBy);

  if (r.status === "approved") {
    const note = r.comment ? ` หมายเหตุ: ${r.comment}` : "";
    return [
      {
        to: r.requestedBy,
        subject: `อนุมัติแล้ว: ${about(r)}`,
        heading: "เอกสารอนุมัติแล้ว",
        message: `${nameOf(r.decidedBy ?? r.approverId)} อนุมัติ${doc}แล้ว พิมพ์ PDF หรือบันทึก Word ส่งลูกค้าได้เลย${note}`,
        ...toPaper,
      },
    ];
  }
  if (r.status === "returned") {
    return [
      {
        to: r.requestedBy,
        subject: `ส่งกลับให้แก้: ${about(r)}`,
        heading: "เอกสารถูกส่งกลับให้แก้",
        message: `${nameOf(r.decidedBy ?? r.approverId)} ส่ง${doc}กลับให้แก้ เหตุผล: ${r.comment ?? "-"}`,
        ...toPaper,
      },
    ];
  }
  if (r.stage === "review" && r.reviewerId) {
    return [
      {
        to: r.reviewerId,
        subject: `รอคุณตรวจ: ${about(r)}`,
        heading: "มีเอกสารรอคุณตรวจ",
        message: `${sender} ส่ง${doc}ให้คุณตรวจ เมื่อตรวจแล้วจะส่งต่อให้ ${nameOf(r.approverId)} อนุมัติ`,
        ...toDesk,
      },
    ];
  }
  if (r.reviewerId && r.reviewedAt) {
    const reviewer = nameOf(r.reviewerId);
    const note = r.reviewNote ? ` หมายเหตุจากผู้ตรวจ: ${r.reviewNote}` : "";
    return [
      {
        to: r.approverId,
        subject: `รอคุณอนุมัติ: ${about(r)}`,
        heading: "มีเอกสารรอคุณอนุมัติ",
        message: `${reviewer} ตรวจ${doc}แล้ว และส่งต่อให้คุณอนุมัติ${note}`,
        ...toDesk,
      },
      {
        to: r.requestedBy,
        subject: `ตรวจแล้ว: ${about(r)}`,
        heading: "ผู้ตรวจส่งต่อเอกสารแล้ว",
        message: `${reviewer} ตรวจ${doc}แล้ว และส่งต่อให้ ${nameOf(r.approverId)} อนุมัติ${note}`,
        ...toPaper,
      },
    ];
  }
  return [
    {
      to: r.approverId,
      subject: `รอคุณอนุมัติ: ${about(r)}`,
      heading: "มีเอกสารรอคุณอนุมัติ",
      message: `${sender} ส่ง${doc}ให้คุณอนุมัติ`,
      ...toDesk,
    },
  ];
}

/**
 * The notices a caller may set off: only for their own move, just made. Anyone
 * who can read a project can name its requests, and must not be able to mail
 * its people with them.
 */
export function noticesFor(
  r: ApprovalEvent,
  callerId: string,
  now: number,
  nameOf: (id: string) => string
): ApprovalNotice[] {
  const move = lastMove(r);
  if (!move || move.by !== callerId || now - Date.parse(move.at) > MOVE_WINDOW_MS) return [];
  return approvalNotices(r, nameOf);
}

/** What this person should hear about these requests. The key changes as a request moves on, so each move is news once. */
export function approvalAlerts(rows: readonly ApprovalEvent[], me: string): ApprovalAlert[] {
  const alerts: ApprovalAlert[] = [];
  for (const r of rows) {
    const move = lastMove(r);
    if (!move) continue;
    if (r.status === "pending" && waitingOn(r) === me) {
      alerts.push({
        key: `${r.id}:${r.stage}`,
        title: r.stage === "review" ? "มีเอกสารรอคุณตรวจ" : "มีเอกสารรอคุณอนุมัติ",
        body: about(r),
        href: desk,
        waiting: true,
      });
      continue;
    }
    if (r.requestedBy !== me || move.by === me) continue;
    const told = { body: about(r), href: paper(r), waiting: false };
    if (r.status === "approved") alerts.push({ ...told, key: `${r.id}:approved`, title: "เอกสารอนุมัติแล้ว" });
    else if (r.status === "returned")
      alerts.push({
        ...told,
        key: `${r.id}:returned`,
        title: "เอกสารถูกส่งกลับให้แก้",
        body: `${about(r)} เหตุผล: ${r.comment ?? "-"}`,
      });
    else if (r.reviewedAt) alerts.push({ ...told, key: `${r.id}:forwarded`, title: "ผู้ตรวจส่งต่อเอกสารแล้ว" });
  }
  return alerts;
}
