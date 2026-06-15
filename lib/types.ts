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

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  /** Workflow phase this turn belongs to (scopes the per-agent transcript). */
  phase?: PhaseId;
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
  /** Prompt queued from the landing page, consumed on first studio load. */
  pendingPrompt?: string;
  /** Spec-to-Demo flow requested from the landing page. */
  pendingSpec?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectSummary {
  id: string;
  name: string;
  fileCount: number;
  createdAt: string;
  updatedAt: string;
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

/** Server-Sent Events emitted by POST /api/generate. */
export type GenerateEvent =
  | { type: "delta"; content: string }
  | { type: "status"; message: string }
  | { type: "done"; result: GenerationResult }
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
}

/* ——— Phase documents (Define/Plan/Verify/Review/Ship produce markdown) ——— */

export type DocKind = "idea" | "brd" | "prd" | "verify" | "review" | "ship";

/** One conversational agent turn: chat reply + any documents it (re)issued. */
export interface AgentTurn {
  reply: string;
  docs: Partial<Record<DocKind, string>>;
}

/** Server-Sent Events emitted by POST /api/agent. */
export type AgentEvent =
  | { type: "delta"; content: string }
  | { type: "done"; turn: AgentTurn }
  | { type: "error"; message: string };

export interface AgentRequestBody {
  phase: PhaseId;
  messages: Pick<ChatMessage, "role" | "content">[];
  /** Current documents (user may have edited them in the code editor). */
  docs?: Partial<Record<DocKind, string>>;
}
