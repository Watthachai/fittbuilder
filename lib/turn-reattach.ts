import { DRAFT_STALE_MS, isDraftLive, type GenerationDraft } from "@/lib/storage";
import type { TurnResult } from "@/lib/turn-result";
import type { ProjectFiles } from "@/lib/types";

/**
 * Waiting for a build turn whose connection dropped (case #35).
 *
 * The server runs every turn to the end whether or not anyone is listening, and
 * parks it in the project's draft under the id the studio gave it: its files as
 * they come, a heartbeat while it runs, and its answer when it ends. A studio
 * that lost the stream reads that draft instead of starting the same turn again,
 * which used to put two full turns on one project side by side.
 */

/**
 * How long a turn may go without a draft of its own before it counts as lost.
 * The server parks one as the turn starts, so only a request that never reached
 * it — or a turn that failed with nothing to show — stays without one this long.
 */
export const REATTACH_GRACE_MS = DRAFT_STALE_MS;

/** How often the studio looks while it waits. */
export const REATTACH_POLL_MS = 3_000;

/** No turn outlives its request: /api/generate's maxDuration. */
export const REATTACH_MAX_MS = 900_000;

export type ReattachState =
  | { state: "waiting" }
  | { state: "finished"; files: ProjectFiles; result: TurnResult }
  | { state: "lost" };

/** Where the turn `turnId` stands, from its project's draft. */
export function reattachState(
  draft: GenerationDraft | null,
  turnId: string,
  droppedAt: number,
  now: number
): ReattachState {
  if (draft?.turnId !== turnId) {
    return now - droppedAt < REATTACH_GRACE_MS ? { state: "waiting" } : { state: "lost" };
  }
  if (draft.result) return { state: "finished", files: draft.files, result: draft.result };
  return isDraftLive(draft, now) ? { state: "waiting" } : { state: "lost" };
}

/**
 * Look until the turn finishes or is lost. Null when it is lost or the person
 * cancelled; the caller tells those apart by its own signal. A look that could
 * not read the draft says nothing about the turn, so it looks again — up to the
 * longest any turn can run.
 */
export async function awaitTurn(deps: {
  turnId: string;
  droppedAt: number;
  signal: AbortSignal;
  load: () => Promise<GenerationDraft | null>;
  now: () => number;
  sleep: (ms: number) => Promise<void>;
}): Promise<{ files: ProjectFiles; result: TurnResult } | null> {
  while (!deps.signal.aborted && deps.now() - deps.droppedAt < REATTACH_MAX_MS) {
    let draft: GenerationDraft | null;
    try {
      draft = await deps.load();
    } catch {
      await deps.sleep(REATTACH_POLL_MS);
      continue;
    }
    const at = reattachState(draft, deps.turnId, deps.droppedAt, deps.now());
    if (at.state === "finished") return { files: at.files, result: at.result };
    if (at.state === "lost") return null;
    await deps.sleep(REATTACH_POLL_MS);
  }
  return null;
}
