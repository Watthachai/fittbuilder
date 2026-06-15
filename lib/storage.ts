"use client";

import { isPhaseId, type PhaseId } from "./phases";
import type { ChatMessage, ProjectFiles, ProjectRecord, ProjectSummary } from "./types";

/**
 * localStorage-backed project store. This is the MVP persistence layer —
 * swap for Prisma/PostgreSQL behind the same interface when auth lands.
 */

const INDEX_KEY = "pb:projects";
const PROJECT_PREFIX = "pb:project:";
const HISTORY_LIMIT = 10; // US-004

function readIndex(): string[] {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function writeIndex(ids: string[]): void {
  localStorage.setItem(INDEX_KEY, JSON.stringify(ids));
}

/** Fill in fields added after a project was first saved (forward-compat). */
function normalize(raw: ProjectRecord & { mode?: string }): ProjectRecord {
  const phase: PhaseId = isPhaseId(raw.phase)
    ? raw.phase
    : raw.mode === "define"
      ? "define"
      : raw.files?.["package.json"]
        ? "build"
        : "define";
  return { ...raw, phase, approvedPhases: raw.approvedPhases ?? [] };
}

export function getProject(id: string): ProjectRecord | null {
  try {
    const raw = localStorage.getItem(PROJECT_PREFIX + id);
    return raw ? normalize(JSON.parse(raw) as ProjectRecord) : null;
  } catch {
    return null;
  }
}

export function saveProject(project: ProjectRecord): ProjectRecord {
  const updated = { ...project, updatedAt: new Date().toISOString() };
  localStorage.setItem(PROJECT_PREFIX + project.id, JSON.stringify(updated));
  const ids = readIndex();
  if (!ids.includes(project.id)) {
    writeIndex([project.id, ...ids]);
  }
  return updated;
}

export function createProject(options?: {
  name?: string;
  pendingPrompt?: string;
  pendingSpec?: boolean;
  phase?: PhaseId;
}): ProjectRecord {
  const now = new Date().toISOString();
  const project: ProjectRecord = {
    id: crypto.randomUUID().slice(0, 8),
    name: options?.name?.trim() || "Untitled",
    files: null,
    phase: options?.phase ?? "define",
    approvedPhases: [],
    history: [],
    messages: [],
    pendingPrompt: options?.pendingPrompt,
    pendingSpec: options?.pendingSpec,
    createdAt: now,
    updatedAt: now,
  };
  return saveProject(project);
}

export function deleteProject(id: string): void {
  localStorage.removeItem(PROJECT_PREFIX + id);
  writeIndex(readIndex().filter((existing) => existing !== id));
}

export function duplicateProject(id: string): ProjectRecord | null {
  const source = getProject(id);
  if (!source) return null;
  const now = new Date().toISOString();
  const copy: ProjectRecord = {
    ...source,
    id: crypto.randomUUID().slice(0, 8),
    name: `${source.name} (copy)`,
    pendingPrompt: undefined,
    pendingSpec: undefined,
    createdAt: now,
    updatedAt: now,
  };
  return saveProject(copy);
}

export function listProjects(): ProjectSummary[] {
  return readIndex()
    .map((id) => getProject(id))
    .filter((p): p is ProjectRecord => p !== null)
    .map((p) => ({
      id: p.id,
      name: p.name,
      fileCount: p.files ? Object.keys(p.files).length : 0,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** Snapshot current files into history before replacing them. */
export function withHistory(project: ProjectRecord, nextFiles: ProjectFiles): ProjectRecord {
  const history = project.files
    ? [...project.history, project.files].slice(-HISTORY_LIMIT)
    : project.history;
  return { ...project, history, files: nextFiles };
}

/** Undo the latest change. Returns null when there is nothing to undo. */
export function undo(project: ProjectRecord): ProjectRecord | null {
  if (project.history.length === 0) return null;
  const history = [...project.history];
  const files = history.pop()!;
  return { ...project, files, history };
}

export function appendMessage(project: ProjectRecord, message: ChatMessage): ProjectRecord {
  return { ...project, messages: [...project.messages, message] };
}

export function newMessage(
  role: ChatMessage["role"],
  content: string,
  phase?: PhaseId
): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    createdAt: new Date().toISOString(),
    ...(phase ? { phase } : {}),
  };
}
