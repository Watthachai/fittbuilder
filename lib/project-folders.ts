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
