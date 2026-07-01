import { expect, test } from "vitest";
import { projectToRow, rowToProject } from "@/lib/db/project-mapper";
import type { ProjectRecord } from "@/lib/types";

const rec: ProjectRecord = {
  id: "11111111-1111-1111-1111-111111111111",
  name: "Demo",
  files: { "src/App.tsx": "x" },
  phase: "build",
  approvedPhases: ["define", "plan"],
  history: [{ "src/App.tsx": "old" }],
  messages: [{ id: "m1", role: "user", content: "hi", createdAt: "2026-01-01T00:00:00.000Z" }],
  orgId: null,
  runnerLast: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
};

test("rowToProject reverses projectToRow", () => {
  const row = projectToRow(rec, "owner-1");
  const back = rowToProject({
    ...row,
    id: rec.id,
    owner_id: "owner-1",
    created_at: rec.createdAt,
    updated_at: rec.updatedAt,
    share_token: null,
    share_role: null,
    org_id: null,
    runner_last: null,
  });
  expect(back).toEqual(rec);
});

test("null files round-trips", () => {
  const row = projectToRow({ ...rec, files: null, history: [], approvedPhases: [] }, "o");
  expect(row.files).toBeNull();
  expect(row.history).toEqual([]);
});
