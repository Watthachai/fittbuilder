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
}

/** One file's before→after state in a build turn (null = absent on that side). */
export interface FileChange {
  path: string;
  before: string | null;
  after: string | null;
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

export interface ProjectSummary {
  id: string;
  name: string;
  fileCount: number;
  createdAt: string;
  updatedAt: string;
  access: "owner" | "member";
  role?: ShareRole;
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
}
