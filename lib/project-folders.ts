import type { ProjectSummary } from "@/lib/types";

/**
 * Which tab of the projects drawer a project belongs in.
 *
 * A workspace's projects belong to everyone in it, so they go under "ของฉัน"
 * (in the workspace's folder) whoever created them. Filing by owner alone left
 * a member's folder reading "ยังไม่มีโปรเจกต์" beside a workspace full of work.
 * "แชร์กับฉัน" is what someone shared with me outside my workspaces.
 */
export function fileProjects(
  projects: ProjectSummary[],
  myWorkspaceIds: ReadonlySet<string>
): { mine: ProjectSummary[]; shared: ProjectSummary[] } {
  const inMyWorkspace = (p: ProjectSummary) => p.orgId !== null && myWorkspaceIds.has(p.orgId);
  return {
    mine: projects.filter((p) => p.access === "owner" || inMyWorkspace(p)),
    shared: projects.filter((p) => p.access === "member" && !inMyWorkspace(p)),
  };
}

/**
 * The workspaces in which someone else created a project I see under "ของฉัน".
 * Members used to find those under "แชร์กับฉัน"; once they moved, people took
 * them for gone, so the shared tab names where they went.
 */
export function workspacesWithOthersProjects<W extends { id: string }>(
  workspaces: W[],
  mine: ProjectSummary[]
): W[] {
  return workspaces.filter((w) => mine.some((p) => p.access === "member" && p.orgId === w.id));
}
