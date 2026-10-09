import { describe, expect, it } from "vitest";
import {
  authorKindFor,
  buildCaseContext,
  isClosed,
  needsTeam,
  ownsAttachmentPath,
  suggestCaseTitle,
  unreadForReporter,
  type CaseActivity,
} from "@/lib/cases";

const ME = "b5c3d598-f908-4181-93e1-da59d56356c6";
const SOMEONE = "0f0e1c2d-3b4a-4c5d-8e6f-7a8b9c0d1e2f";

describe("buildCaseContext", () => {
  it("keeps the last 40 log lines, each cut to 400 characters", () => {
    const log = Array.from({ length: 100 }, (_, i) => `line ${i + 1}`);
    log[99] = "x".repeat(1_000);
    const ctx = buildCaseContext({ log, appVersion: "0.96.0", userAgent: "UA", page: "/project/p" });
    expect(ctx.log).toHaveLength(40);
    expect(ctx.log[0]).toBe("line 61");
    expect(ctx.log[39]).toHaveLength(400);
  });

  it("records a blank error as no error", () => {
    const ctx = buildCaseContext({ error: "   \n", appVersion: "0.96.0", userAgent: "UA", page: "/" });
    expect(ctx.error).toBeNull();
    expect(ctx.phase).toBeNull();
    expect(ctx.fileCount).toBeNull();
    expect(ctx.log).toEqual([]);
  });

  it("keeps what the screen knew", () => {
    const ctx = buildCaseContext({
      phase: "error",
      error: "npm install ล้มเหลว",
      fileCount: 37,
      appVersion: "0.96.0",
      userAgent: "Chrome",
      page: "/project/16ec9f11",
    });
    expect(ctx).toEqual({
      phase: "error",
      error: "npm install ล้มเหลว",
      log: [],
      fileCount: 37,
      appVersion: "0.96.0",
      userAgent: "Chrome",
      page: "/project/16ec9f11",
    });
  });
});

describe("suggestCaseTitle", () => {
  it("names the kind and the first line of the error", () => {
    expect(suggestCaseTitle("preview", "\n npm install ล้มเหลว \nnpm ERR! code E404")).toBe(
      "Preview เปิดไม่ขึ้น: npm install ล้มเหลว"
    );
  });

  it("falls back to the kind alone when there is no error", () => {
    expect(suggestCaseTitle("preview", null)).toBe("Preview เปิดไม่ขึ้น");
  });

  it("leaves a general report for the reporter to name", () => {
    expect(suggestCaseTitle("other", "  ")).toBe("");
  });

  it("stays within 120 characters", () => {
    const title = suggestCaseTitle("runtime", "y".repeat(500));
    expect(title).toHaveLength(120);
    expect(title.endsWith("…")).toBe(true);
  });
});

describe("ownsAttachmentPath", () => {
  it("accepts a file in the author's own folder", () => {
    expect(ownsAttachmentPath(ME, `${ME}/1a2b3c4d-1111-2222-3333-444455556666-screen.png`)).toBe(true);
  });

  it("refuses someone else's file", () => {
    expect(ownsAttachmentPath(ME, `${SOMEONE}/1a2b-screen.png`)).toBe(false);
  });

  it("refuses a path that climbs or nests", () => {
    expect(ownsAttachmentPath(ME, `${ME}/../${SOMEONE}/a.png`)).toBe(false);
    expect(ownsAttachmentPath(ME, `${ME}/sub/a.png`)).toBe(false);
  });
});

describe("isClosed", () => {
  it("closes a case that shipped or turned out not to be a bug", () => {
    expect(isClosed("released")).toBe(true);
    expect(isClosed("not_bug")).toBe(true);
  });

  it("keeps every other status open", () => {
    expect(["new", "investigating", "need_info", "fixed"].map((s) => isClosed(s as "new"))).toEqual([
      false,
      false,
      false,
      false,
    ]);
  });
});

describe("authorKindFor", () => {
  it("files a message on your own case as the reporter's, even from the team (case #3)", () => {
    expect(authorKindFor({ id: ME, team: true }, ME)).toBe("reporter");
  });

  it("files the team's answer on someone else's case as the team's", () => {
    expect(authorKindFor({ id: ME, team: true }, SOMEONE)).toBe("team");
  });

  it("files a non-team reporter as the reporter", () => {
    expect(authorKindFor({ id: SOMEONE, team: false }, SOMEONE)).toBe("reporter");
  });
});

const at = (min: number) => new Date(Date.UTC(2026, 9, 8, 10, min)).toISOString();
const activity = (over: Partial<CaseActivity>): CaseActivity => ({
  status: "new",
  last_reporter_at: at(0),
  last_team_at: null,
  reporter_seen_at: at(0),
  team_seen_at: null,
  ...over,
});

describe("unread", () => {
  it("a new case needs the team until someone on it opens the case", () => {
    expect(needsTeam(activity({}))).toBe(true);
    expect(needsTeam(activity({ team_seen_at: at(5) }))).toBe(false);
  });

  it("the reporter writing again brings the case back to the team", () => {
    expect(needsTeam(activity({ team_seen_at: at(5), last_reporter_at: at(9) }))).toBe(true);
  });

  it("a team answer is unread for the reporter until they open the case", () => {
    expect(unreadForReporter(activity({}))).toBe(false);
    expect(unreadForReporter(activity({ last_team_at: at(7) }))).toBe(true);
    expect(unreadForReporter(activity({ last_team_at: at(7), reporter_seen_at: at(8) }))).toBe(false);
  });
});
