import type { PhaseId } from "./phases";

/** Flat map of file path → file contents for a generated project. */
export type ProjectFiles = Record<string, string>;

/** WebContainer build/run status (distinct from the workflow PhaseId). */
export type GenerationPhase =
  | "idle"
  | "generating"
  | "installing"
  | "starting"
  | "ready"
  | "error";

/** Interactive quick-reply the agent can attach to a question (clickable choices). */
export interface AgentAsk {
  /** Short echo of the question (the full prompt is in the message text). */
  question: string;
  /** 2–5 concrete choices the user can click instead of typing. */
  options: string[];
  /** Allow selecting more than one option (joined on submit). */
  multi?: boolean;
  /** Show the free-text box alongside the choices (default true). */
  allowText?: boolean;
}

/** A compact "what the AI did" chip shown inline in chat. */
export interface AgentAction {
  icon: string;
  label: string;
}

/** The in-progress assistant turn, held in React state (not persisted) while streaming. */
export interface LiveMessage {
  thinking: string;
  content: string;
  actions: AgentAction[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  /** Workflow phase this turn belongs to (scopes the per-agent transcript). */
  phase?: PhaseId;
  /** Clickable choices offered with this (assistant) message. */
  ask?: AgentAsk;
  /** Gemini thought summary for this assistant turn (collapsible in the UI). */
  thinking?: string;
  /** Inline action chips for what the AI did this turn. */
  actions?: AgentAction[];
  /** Per-file before/after for this build turn, for the "ดูการเปลี่ยนแปลง" diff viewer. */
  changes?: FileChange[];
  /** This turn produced/updated this phase's doc → show a "ดูเอกสาร" button. */
  hasDoc?: boolean;
  /** Org DNA aspects this turn drew on → shown as citation chips. */
  citations?: string[];
}

/** One of the 7 Org DNA archetypes (Strategy& / PwC). */
export type OrgArchetype =
  | "resilient"
  | "military-precision"
  | "just-in-time"
  | "passive-aggressive"
  | "fits-and-starts"
  | "overmanaged"
  | "outgrown";

/** Org DNA profile — the 4 building blocks + archetype + notes. Every field is
 *  optional and filled progressively; missing fields are simply omitted from the
 *  AI context (never fabricated). */
export interface OrgDna {
  decisionRights?: string;
  information?: string;
  motivators?: string;
  structure?: string;
  archetype?: OrgArchetype | null;
  notes?: string;
  /** Raw source text the DNA was distilled from (paste + extracted files) — kept
   *  so each block can cite the passage it came from (NotebookLM-style). */
  sources?: string;
  /** Per-block verbatim source quote (the citation into `sources`). */
  cites?: {
    decisionRights?: string;
    information?: string;
    motivators?: string;
    structure?: string;
  };
  /** Saved snapshots of the DNA (each AI draft / save) — newest first, capped. */
  versions?: OrgDnaVersion[];
}

/** A kept snapshot of an Org DNA draft, so the user can review/restore it. */
export interface OrgDnaVersion {
  id: string;
  createdAt: string;
  /** How this version was produced. */
  source: "ai" | "manual";
  /** The DNA at that point (no nested versions). */
  snapshot: Omit<OrgDna, "versions">;
}

/** An organization (workspace): groups projects and carries the Org DNA. */
export interface OrgRecord {
  id: string;
  ownerId: string;
  name: string;
  /** Visual identity for categorization. */
  color: string;
  icon: string;
  dna: OrgDna;
  /** Latest shared Pain Point Radar analysis (null = none yet). */
  painRadar: import("./org-advisor").AdvisorSaved | null;
  createdAt: string;
  updatedAt: string;
}

/** A file shared in the team chat. `path` is the storage object key; the signed
 *  URL is resolved at load time (the bucket is private). */
export interface TeamChatAttachment {
  path: string;
  name: string;
  type: string;
  size: number;
  /** Short-lived signed URL, attached when messages are loaded for display. */
  url?: string;
}

/** An emoji reaction tally on a chat message. */
export interface TeamChatReaction {
  emoji: string;
  userIds: string[];
}

/** The message a reply points at, denormalized for rendering the quote. */
export interface TeamChatReplyRef {
  id: string;
  author: string;
  excerpt: string;
}

/** One message in a project's team chat (people talking, not the AI builder). */
export interface TeamChatMessage {
  id: string;
  /** "message" = a person; "system" = an activity log (e.g. phase approval). */
  kind: "message" | "system";
  userId: string | null;
  authorName: string | null;
  authorAvatar: string | null;
  body: string;
  attachments: TeamChatAttachment[];
  replyTo?: TeamChatReplyRef | null;
  reactions: TeamChatReaction[];
  createdAt: string;
}

/** One file's before→after state in a build turn (null = absent on that side). */
export interface FileChange {
  path: string;
  before: string | null;
  after: string | null;
}

/** The last successful hand-off of a project to the FITT Code Runner (via the
 *  Gateway `/v1/ingest`). Persisted as `runner_last` (jsonb) so the studio can
 *  show a durable "sent" chip. `buildNo`/`branch` aren't known at ingest — they
 *  arrive later from job status — so they're optional (and present on legacy
 *  rows saved before the Gateway migration). */
export interface RunnerSend {
  jobId: string;
  /** Ingest state, e.g. "QUEUED". */
  state: string;
  /** True when the Gateway deduplicated this send (idempotent replay). */
  duplicate?: boolean;
  /** Channel tag stamped on the send (e.g. "alpha-test"). */
  tag: string;
  /** ISO timestamp of when it was sent. */
  sentAt: string;
  /** Known only after job status resolves (or on legacy rows). */
  buildNo?: number;
  branch?: string;
}

export interface ProjectRecord {
  id: string;
  name: string;
  files: ProjectFiles | null;
  /** Current workflow phase (define → … → ship). */
  phase: PhaseId;
  /** Phases the user has approved (the advance gate). */
  approvedPhases?: PhaseId[];
  /** Snapshots of `files` before each change — capped at 10 (US-004). */
  history: ProjectFiles[];
  messages: ChatMessage[];
  /** Selected domain skill template id (e.g. "erp") — powers domain-expert questioning + build. */
  skillId?: string;
  /** Workspace this project belongs to (null = ส่วนตัว). */
  orgId?: string | null;
  /** Last successful send to the FITT Code Runner (null = never sent). */
  runnerLast?: RunnerSend | null;
  createdAt: string;
  updatedAt: string;
}

export type ShareRole = "viewer" | "editor";

export interface ProjectMember {
  projectId: string;
  userId: string;
  email: string;
  name: string | null;
  role: ShareRole;
  createdAt: string;
}

export interface ProjectInvite {
  id: string;
  projectId: string;
  email: string;
  role: ShareRole;
  token: string;
  status: "pending" | "accepted" | "revoked";
  expiresAt: string;
  createdAt: string;
}

/** Workspace roles. 'owner' is implicit (fittbuilder_orgs.owner_id) and can't be
 *  invited; invites only ever grant 'admin' or 'member'. */
export type OrgRole = "owner" | "admin" | "member";
export type OrgInviteRole = "admin" | "member";

export interface OrgMember {
  orgId: string;
  userId: string;
  email: string;
  name: string | null;
  role: OrgRole;
  createdAt: string;
}

export interface OrgInvite {
  id: string;
  orgId: string;
  email: string;
  role: OrgInviteRole;
  token: string;
  status: "pending" | "accepted" | "revoked";
  expiresAt: string;
  createdAt: string;
}

export interface ProjectSummary {
  id: string;
  name: string;
  fileCount: number;
  /** Workspace this project belongs to (null = unassigned / shared-with-me). */
  orgId: string | null;
  createdAt: string;
  updatedAt: string;
  access: "owner" | "member";
  role?: ShareRole;
  /** Display name of the project's creator — set only for shared (member) rows. */
  ownerName?: string;
}

/** Result the model must produce (parsed from its JSON output). */
export interface GenerationResult {
  /** One-or-two sentence summary shown in the chat, same language as the prompt. */
  note: string;
  /** Full project on first generation; only changed/new files on iteration. */
  files: ProjectFiles;
  /** Paths to delete (iteration mode only). */
  deleted?: string[];
}

/** Server-Sent Events emitted by POST /api/generate (incremental, file-by-file). */
export type GenerateEvent =
  | { type: "thought"; content: string }
  | { type: "status"; message: string }
  | { type: "file"; path: string; content: string }
  | { type: "delete"; path: string }
  | { type: "deps"; packages: string[] }
  | { type: "done"; note: string; deleted: string[] }
  | { type: "error"; message: string };

export interface SpecAnswers {
  [questionId: string]: string | string[];
}

export interface GenerateRequestBody {
  prompt: string;
  previousFiles?: ProjectFiles;
  iterationMode?: boolean;
  brd?: string;
  prd?: string;
  presetId?: string;
  presetAnswers?: SpecAnswers;
  skillId?: string;
}

/* ——— Phase documents (Define/Plan/Verify/Review/Ship produce markdown) ——— */

export type DocKind = "idea" | "brd" | "prd" | "verify" | "review" | "ship";

/** One conversational agent turn: chat reply + any documents it (re)issued. */
export interface AgentTurn {
  reply: string;
  docs: Partial<Record<DocKind, string>>;
  /** Optional clickable choices for the user's next answer. */
  ask?: AgentAsk;
  /** Org DNA aspects this turn drew on (keys: decisionRights/information/motivators/structure/archetype). */
  citations?: string[];
}

/** Server-Sent Events emitted by POST /api/agent. */
export type AgentEvent =
  | { type: "thought"; content: string }
  | { type: "text"; content: string }
  | { type: "action"; icon: string; label: string }
  | { type: "done"; turn: AgentTurn }
  | { type: "error"; message: string };

/** AI-generated skill-template draft (admin generator → fills the form). */
export interface GeneratedSkill {
  name?: string;
  nameEn?: string;
  tagline?: string;
  icon?: string;
  keywords?: string[];
  persona?: string;
  domainKnowledge?: string;
  buildGuidance?: string;
  seedData?: string;
  designHints?: string;
  questionBank?: {
    id: string;
    label: string;
    type: "single" | "multi" | "text";
    options?: string[];
    why?: string;
  }[];
}

/** SSE events from /api/admin/generate-skill (chat-like, with thinking). */
export type GenerateSkillEvent =
  | { type: "thought"; content: string }
  | { type: "text"; content: string }
  | { type: "done"; template: GeneratedSkill }
  | { type: "error"; message: string };

export interface AgentRequestBody {
  phase: PhaseId;
  messages: Pick<ChatMessage, "role" | "content">[];
  /** Current documents (user may have edited them in the code editor). */
  docs?: Partial<Record<DocKind, string>>;
  /** Selected domain skill template id, for domain-expert questioning. */
  skillId?: string;
  /** Express mode: brief is complete — emit the phase doc in one shot, no questions. */
  express?: boolean;
  /** Owning project id, for AI usage attribution. */
  projectId?: string;
  /** Reference images/files the user attached for the AI to read this turn. */
  attachments?: ChatAttachmentInput[];
}

/** A file/image attached to an AI chat turn, sent to Gemini as a content part.
 *  `data` is base64 (no `data:` prefix); images/PDF go in as inlineData, other
 *  files are decoded to text server-side. */
export interface ChatAttachmentInput {
  name: string;
  mimeType: string;
  data: string;
}
