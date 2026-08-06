import { describe, expect, it } from "vitest";
import { projectToRow } from "@/lib/db/project-mapper";
import type { ChatMessage, ProjectRecord } from "@/lib/types";

const turn = (i: number): ChatMessage => ({
  id: `m${i}`,
  role: "assistant",
  content: `turn ${i}`,
  createdAt: "2026-08-06T00:00:00Z",
  changes: [{ path: "src/App.tsx", before: `old ${i}`, after: `new ${i}` }],
});

const rec = (messages: ChatMessage[]): ProjectRecord => ({
  id: "p",
  name: "p",
  files: {},
  phase: "build",
  history: [],
  messages,
  createdAt: "2026-08-06T00:00:00Z",
  updatedAt: "2026-08-06T00:00:00Z",
});

/**
 * Chat logs grew without bound: one measured project held 2 MB of before/after
 * file bodies across 223 turns, re-read in full on every studio open. That was
 * half the row that took the database down on 2026-08-06.
 */
describe("projectToRow — persisted chat size", () => {
  it("keeps the newest ten changesets whole", () => {
    const rows = projectToRow(rec(Array.from({ length: 10 }, (_, i) => turn(i))));
    expect(rows.messages.every((m) => m.changes![0].after !== null)).toBe(true);
  });

  it("drops file bodies from older turns but keeps which files changed", () => {
    const rows = projectToRow(rec(Array.from({ length: 14 }, (_, i) => turn(i))));
    // Oldest four are trimmed, newest ten intact.
    expect(rows.messages.slice(0, 4).every((m) => m.changes![0].after === null)).toBe(true);
    expect(rows.messages.slice(4).map((m) => m.changes![0].after)).toEqual(
      Array.from({ length: 10 }, (_, i) => `new ${i + 4}`)
    );
    // The file list survives — the chip still says how many files a turn touched.
    expect(rows.messages[0].changes).toEqual([{ path: "src/App.tsx", before: null, after: null }]);
  });

  // Turns without a changeset (plain replies, questions) must not eat the budget.
  it("counts only turns that actually carry a changeset", () => {
    const chat: ChatMessage[] = [];
    for (let i = 0; i < 11; i++) {
      chat.push({ id: `u${i}`, role: "user", content: "hi", createdAt: "2026-08-06T00:00:00Z" });
      chat.push(turn(i));
    }
    const rows = projectToRow(rec(chat));
    const withChanges = rows.messages.filter((m) => m.changes?.length);
    expect(withChanges.filter((m) => m.changes![0].after !== null)).toHaveLength(10);
  });

  it("leaves a project with no changesets alone", () => {
    const chat: ChatMessage[] = [
      { id: "u", role: "user", content: "hi", createdAt: "2026-08-06T00:00:00Z" },
    ];
    expect(projectToRow(rec(chat)).messages).toEqual(chat);
  });
});
