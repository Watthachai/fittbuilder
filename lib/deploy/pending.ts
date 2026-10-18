import type { DeliveryRow, DeployEventRow } from "./types";

/** After this many failures of the same build in a row, a person has to look. */
export const MAX_FAILURES = 3;
/**
 * A run that said "registering" or "deploying" this recently may still be at work:
 * the sweep leaves it alone, so two runs never register one project at once. One
 * that said so longer ago died mid-way and is picked up again (a run takes a few
 * minutes; Cloud Build stops it at 15).
 */
export const IN_PROGRESS_MS = 15 * 60_000;

function newestFirst(events: DeployEventRow[]): DeployEventRow[] {
  return [...events].sort((a, b) => b.at.localeCompare(a.at));
}

/** Whether a project's UAT events (any order) end in MAX_FAILURES failures of its newest build. */
export function needsTeam(uatEvents: DeployEventRow[]): boolean {
  const events = newestFirst(uatEvents.filter((e) => e.env === "uat"));
  if (events[0]?.stage !== "failed") return false;
  const build = events[0].build_no;
  let failed = 0;
  for (const e of events) {
    if (e.build_no !== build) break;
    if (e.stage === "failed") failed++;
    if (failed >= MAX_FAILURES) return true;
  }
  return false;
}

/**
 * The cloud projects the deploy side's sweep should work on: no UAT yet, or the
 * newest UAT event is not "ready" — unless its newest build has already failed
 * MAX_FAILURES times. A new build starts the count again.
 */
export function pendingProjects(deliveries: DeliveryRow[], uatEvents: DeployEventRow[], now = Date.now()): string[] {
  const byProject = new Map<string, DeployEventRow[]>();
  for (const e of uatEvents) if (e.env === "uat") byProject.set(e.project_id, [...(byProject.get(e.project_id) ?? []), e]);
  return deliveries
    .filter((d) => d.target === "cloud")
    .map((d) => d.project_id)
    .filter((id) => {
      const events = newestFirst(byProject.get(id) ?? []);
      const newest = events[0];
      if (newest?.stage === "ready") return false;
      if ((newest?.stage === "registering" || newest?.stage === "deploying") && now - Date.parse(newest.at) < IN_PROGRESS_MS) return false;
      return !needsTeam(events);
    });
}
