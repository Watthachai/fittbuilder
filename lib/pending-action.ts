// Ephemeral hand-off of the launch intent from the landing LaunchPad to the
// studio across the client-side navigation. It is NOT a project field: the
// intent is transient and one-shot, so it rides in sessionStorage (which
// survives the navigation that drops in-memory state) and is consumed the first
// time the studio opens the project.

const KEY = (projectId: string) => `fittbuilder:pending:${projectId}`;

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
