// Ephemeral hand-off of the launch intent from the landing LaunchPad to the
// studio across the client-side navigation. It is NOT a project field: the
// intent is transient and one-shot, so it rides in sessionStorage (which
// survives the navigation that drops in-memory state) and is consumed the first
// time the studio opens the project.

import { idbGet, idbSet } from "./idb";
import type { ChatAttachmentInput } from "./types";

const KEY = (projectId: string) => `fittbuilder:pending:${projectId}`;
const ATTACH_KEY = (projectId: string) => `pending_attachments:${projectId}`;

export type PendingAction =
  | { kind: "express"; prompt: string } // auto-pilot the full flow (BRD→PRD→build)
  | { kind: "spec" }; // open the Spec-to-Demo flow

export function setPendingAction(projectId: string, action: PendingAction): void {
  sessionStorage.setItem(KEY(projectId), JSON.stringify(action));
}

/** Read and remove the pending action for a project (one-shot). */
export function takePendingAction(projectId: string): PendingAction | null {
  const raw = sessionStorage.getItem(KEY(projectId));
  if (!raw) return null;
  sessionStorage.removeItem(KEY(projectId));
  return JSON.parse(raw) as PendingAction;
}

/**
 * Attachments picked on the landing LaunchPad, riding along with an "express"
 * pending action. Base64 payloads are far too large for sessionStorage (~5MB
 * quota), so they take the same one-shot hand-off through IndexedDB instead.
 */
export async function setPendingAttachments(
  projectId: string,
  attachments: ChatAttachmentInput[]
): Promise<void> {
  await idbSet(ATTACH_KEY(projectId), attachments);
}

/** Read and remove the pending attachments for a project (one-shot). */
export async function takePendingAttachments(
  projectId: string
): Promise<ChatAttachmentInput[] | null> {
  const attachments = await idbGet<ChatAttachmentInput[]>(ATTACH_KEY(projectId));
  if (attachments) await idbSet(ATTACH_KEY(projectId), null);
  return attachments?.length ? attachments : null;
}
