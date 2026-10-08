import { describe, expect, it } from "vitest";
import { fileProjects } from "@/lib/project-folders";
import type { ProjectSummary } from "@/lib/types";

const WORKSPACE = "09d2e921-b783-47e1-8291-9e55aa432a5d";
const OTHER_WORKSPACE = "11111111-2222-4333-8444-555555555555";

const project = (id: string, over: Partial<ProjectSummary>): ProjectSummary => ({
  id,
  name: id,
  fileCount: 0,
  orgId: null,
  createdAt: "2026-10-07T00:00:00Z",
  updatedAt: "2026-10-07T00:00:00Z",
  access: "owner",
  ...over,
});

const ids = (list: ProjectSummary[]) => list.map((p) => p.id);

describe("fileProjects", () => {
  it("files a workspace's projects under mine for a member who did not create them", () => {
    const fromVoice = project("voice-test", { orgId: WORKSPACE, access: "member" });
    const { mine, shared } = fileProjects([fromVoice], new Set([WORKSPACE]));
    expect(ids(mine)).toEqual(["voice-test"]);
    expect(shared).toEqual([]);
  });

  it("keeps a project shared directly, outside my workspaces, under shared", () => {
    const direct = project("direct", { access: "member", role: "editor" });
    const foreign = project("foreign", { orgId: OTHER_WORKSPACE, access: "member", role: "viewer" });
    const { mine, shared } = fileProjects([direct, foreign], new Set([WORKSPACE]));
    expect(mine).toEqual([]);
    expect(ids(shared)).toEqual(["direct", "foreign"]);
  });

  it("keeps everything I own under mine", () => {
    const personal = project("personal", {});
    const inWorkspace = project("in-workspace", { orgId: WORKSPACE });
    const { mine, shared } = fileProjects([personal, inWorkspace], new Set([WORKSPACE]));
    expect(ids(mine)).toEqual(["personal", "in-workspace"]);
    expect(shared).toEqual([]);
  });
});
