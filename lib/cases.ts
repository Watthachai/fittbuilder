/**
 * Cases — a person reports a problem and the team answers in a thread until it
 * is fixed (migration 0047). Shared by the /api/cases routes and the pages, so
 * both sides agree on the words and the shapes.
 *
 * The team is the ADMIN_EMAILS list (lib/admin.ts): they see every case, answer
 * it and move its status. Everyone else sees only the cases they reported.
 */

export const CASE_STATUSES = ["new", "investigating", "need_info", "fixed", "released", "not_bug"] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];

/** Nothing left to do: shipped, or looked at and found not to be ours to fix. */
export function isClosed(status: CaseStatus): boolean {
  return status === "released" || status === "not_bug";
}

export const CASE_KINDS = ["preview", "runtime", "generation", "ai_reply", "other"] as const;
export type CaseKind = (typeof CASE_KINDS)[number];

export const CASE_STATUS: Record<CaseStatus, { label: string; hint: string }> = {
  new: { label: "รอตรวจสอบ", hint: "ส่งถึงทีมแล้ว รอทีมรับเรื่อง" },
  investigating: { label: "กำลังตรวจสอบ", hint: "ทีมกำลังหาสาเหตุ" },
  need_info: { label: "รอข้อมูลเพิ่ม", hint: "ทีมต้องการข้อมูลเพิ่มจากผู้แจ้ง ตอบในเคสนี้ได้เลย" },
  fixed: { label: "แก้แล้ว รอปล่อย", hint: "แก้ในระบบแล้ว รอขึ้นเวอร์ชันใหม่" },
  released: { label: "ปล่อยแล้ว", hint: "ขึ้นเวอร์ชันใหม่แล้ว โหลดหน้าใหม่แล้วลองอีกครั้ง" },
  not_bug: { label: "ไม่ใช่บั๊ก", hint: "ตรวจแล้วไม่ใช่ปัญหาของระบบ ไม่ต้องแก้ ดูเหตุผลในเคส" },
};

export const CASE_KIND: Record<CaseKind, string> = {
  preview: "Preview เปิดไม่ขึ้น",
  runtime: "แอปมี error",
  generation: "สร้างไม่สำเร็จ",
  ai_reply: "AI ตอบผิดปกติ",
  other: "อื่น ๆ",
};

/** Log lines kept with a case — the tail is where a failure explains itself. */
export const CASE_LOG_LINES = 40;
const LOG_LINE_CHARS = 400;
const ERROR_CHARS = 4_000;
export const AI_REPLY_CHARS = 2_000;
const TITLE_CHARS = 120;

/** The chat reply a case was reported from — which turn, and what it said. */
export interface CaseAiReply {
  /** ChatMessage id, to find the turn in the project's chat. */
  id: string;
  text: string;
}

/**
 * What the reporter's screen knew when they pressed the button. Everything a
 * developer would otherwise ask for, and nothing more: no source code and no
 * project data, only the error and the log around it.
 */
export interface CaseContext {
  /** The studio's preview phase (idle/generating/installing/starting/ready/error). */
  phase: string | null;
  error: string | null;
  log: string[];
  fileCount: number | null;
  appVersion: string;
  userAgent: string;
  page: string;
  /** Reported from an AI reply in the chat (absent on cases from before 0.98.0). */
  aiReply?: CaseAiReply | null;
}

export function buildCaseContext(input: {
  phase?: string | null;
  error?: string | null;
  log?: readonly string[];
  fileCount?: number | null;
  appVersion: string;
  userAgent: string;
  page: string;
  aiReply?: CaseAiReply | null;
}): CaseContext {
  const error = input.error?.trim();
  return {
    phase: input.phase ?? null,
    error: error ? error.slice(0, ERROR_CHARS) : null,
    log: (input.log ?? []).slice(-CASE_LOG_LINES).map((line) => line.slice(0, LOG_LINE_CHARS)),
    fileCount: input.fileCount ?? null,
    appVersion: input.appVersion,
    userAgent: input.userAgent,
    page: input.page,
    aiReply: input.aiReply
      ? { id: input.aiReply.id, text: input.aiReply.text.trim().slice(0, AI_REPLY_CHARS) }
      : null,
  };
}

/**
 * A title the reporter can keep: what kind of failure, and its first line.
 * "อื่น ๆ" with nothing behind it says nothing, so that one is left for them to write.
 */
export function suggestCaseTitle(kind: CaseKind, error: string | null | undefined): string {
  const first = (error ?? "").split("\n").map((l) => l.trim()).find(Boolean);
  if (!first && kind === "other") return "";
  const title = first ? `${CASE_KIND[kind]}: ${first}` : CASE_KIND[kind];
  return title.length > TITLE_CHARS ? `${title.slice(0, TITLE_CHARS - 1)}…` : title;
}

export interface CaseAttachment {
  path: string;
  name: string;
  type: string;
  size: number;
  /** Signed for this response only; never stored. */
  url?: string;
}

/** An attachment may only come from its author's own folder in case-files. */
export function ownsAttachmentPath(userId: string, path: string): boolean {
  return (
    path.startsWith(`${userId}/`) &&
    !path.includes("..") &&
    /^[0-9a-f-]{36}\/[\w.\-]+$/.test(path)
  );
}

export interface CasePerson {
  name: string | null;
  email: string | null;
}

export interface CaseSummary {
  id: string;
  number: number;
  title: string;
  kind: CaseKind;
  status: CaseStatus;
  fixedIn: string | null;
  project: { id: string; name: string } | null;
  reporter: CasePerson;
  createdAt: string;
  updatedAt: string;
  /** Something new on the viewer's side: a team answer for the reporter, a case to look at for the team. */
  unread: boolean;
}

export interface CaseMessage {
  id: string;
  authorKind: "reporter" | "team";
  author: CasePerson | null;
  body: string;
  attachments: CaseAttachment[];
  statusTo: CaseStatus | null;
  fixedIn: string | null;
  createdAt: string;
}

export interface CaseDetail extends CaseSummary {
  context: CaseContext;
  messages: CaseMessage[];
}

/** The activity columns the unread rules read. */
export interface CaseActivity {
  status: CaseStatus;
  last_reporter_at: string;
  last_team_at: string | null;
  reporter_seen_at: string;
  team_seen_at: string | null;
}

/**
 * Who a message speaks for. On your own case you are the reporter, even when
 * you are also on the team — case #3's follow-up from an admin was filed as a
 * team answer, so the case looked answered and nobody picked it up.
 */
export function authorKindFor(viewer: { id: string; team: boolean }, reporterId: string): "reporter" | "team" {
  return viewer.id === reporterId || !viewer.team ? "reporter" : "team";
}

/** The team answered since the reporter last opened the case. */
export function unreadForReporter(c: CaseActivity): boolean {
  return c.last_team_at !== null && Date.parse(c.last_team_at) > Date.parse(c.reporter_seen_at);
}

/** Nobody on the team has looked yet, or the reporter wrote since they did. */
export function needsTeam(c: CaseActivity): boolean {
  if (c.team_seen_at === null) return true;
  return Date.parse(c.last_reporter_at) > Date.parse(c.team_seen_at);
}

/** Why a case wants this person now: the team answered them, or — for the team — a new case or a reporter's reply. */
export type CaseAlertReason = "answered" | "new" | "reporter";

/** One case waiting on the viewer — the bell's count, a toast, a desktop notification. */
export interface CaseAlert {
  id: string;
  number: number;
  title: string;
  status: CaseStatus;
  reason: CaseAlertReason;
  /** When the thing the alert is about happened; with the id, it names the event. */
  at: string;
}

/**
 * What a case wants from this viewer, or null. The same rule as the unread
 * count: on your own case you hear when the team answers; on anyone else's,
 * only the team hears, about a case nobody opened or a reporter writing again.
 */
export function alertFor(
  viewer: { id: string; team: boolean },
  row: { id: string; number: number; title: string; reporter_id: string } & CaseActivity
): CaseAlert | null {
  const base = { id: row.id, number: row.number, title: row.title, status: row.status };
  if (row.reporter_id === viewer.id) {
    return unreadForReporter(row) ? { ...base, reason: "answered", at: row.last_team_at! } : null;
  }
  if (!viewer.team || !needsTeam(row)) return null;
  return { ...base, reason: row.team_seen_at === null ? "new" : "reporter", at: row.last_reporter_at };
}

export const alertKey = (a: CaseAlert): string => `${a.id}@${a.at}`;

/** The alerts not shown yet — a second answer on the same case counts as new again. */
export function freshAlerts(seen: ReadonlySet<string>, alerts: readonly CaseAlert[]): CaseAlert[] {
  return alerts.filter((a) => !seen.has(alertKey(a)));
}

const ALERT_TITLE: Record<CaseAlertReason, (n: number) => string> = {
  answered: (n) => `ทีมตอบเคส #${n} แล้ว`,
  new: (n) => `มีเคสใหม่ #${n}`,
  reporter: (n) => `ผู้แจ้งตอบในเคส #${n}`,
};

export function alertMessage(a: CaseAlert): { title: string; body: string } {
  return { title: ALERT_TITLE[a.reason](a.number), body: a.title };
}
