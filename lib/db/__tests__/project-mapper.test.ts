import { expect, test } from "vitest";
import { projectToRow, rowToProject } from "@/lib/db/project-mapper";
import type { ProjectRecord } from "@/lib/types";

const rec: ProjectRecord = {
  id: "11111111-1111-1111-1111-111111111111",
  name: "Demo",
  files: { "src/App.tsx": "x" },
  phase: "build",
  approvedPhases: ["define", "plan"],
  historyCount: 3,
  messages: [{ id: "m1", role: "user", content: "hi", createdAt: "2026-01-01T00:00:00.000Z" }],
  orgId: null,
  runnerLast: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
};

test("rowToProject reverses projectToRow", () => {
  const row = projectToRow(rec);
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
    history_count: rec.historyCount,
  });
  expect(back).toEqual(rec);
});

test("null files round-trips", () => {
  const row = projectToRow({ ...rec, files: null, approvedPhases: [] });
  expect(row.files).toBeNull();
});

/**
 * The undo stack is ten copies of the source tree — 3 MB on the heaviest project,
 * 89% of its row. It is pushed and popped in the database (migration 0032); an
 * ordinary save must never carry it, or every keystroke pays for it again.
 */
test("projectToRow never writes history", () => {
  expect("history" in projectToRow(rec)).toBe(false);
});

test("projectToRow never writes owner_id (a shared editor must not take ownership)", () => {
  expect("owner_id" in projectToRow(rec)).toBe(false);
});
