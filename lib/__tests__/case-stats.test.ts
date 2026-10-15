import { describe, expect, it } from "vitest";
import { caseStats, toStatCases, type StatCase } from "@/lib/case-stats";

// 2026-10-15 is a Thursday. Bangkok weeks start Monday 00:00 (+07:00).
const NOW = new Date("2026-10-15T05:00:00Z");

const stat = (over: Partial<StatCase>): StatCase => ({
  number: 1,
  kind: "runtime",
  status: "new",
  cause: null,
  area: null,
  createdAt: "2026-10-14T03:00:00Z",
  closedAt: null,
  ...over,
});

describe("caseStats weeks", () => {
  it("files a case by its Bangkok week: Sunday 23:30 is the week before, Monday 00:30 the new one", () => {
    const s = caseStats(
      [
        stat({ number: 1, createdAt: "2026-10-11T16:30:00Z" }), // Sun 23:30 BKK → week of Oct 5
        stat({ number: 2, createdAt: "2026-10-11T17:30:00Z" }), // Mon 00:30 BKK → week of Oct 12
      ],
      NOW
    );
    expect(s.weeks.map((w) => [w.start, w.opened.unclassified])).toEqual([
      ["2026-10-05", 1],
      ["2026-10-12", 1],
    ]);
  });

  it("counts new cases by cause, closed cases in the week they closed, and their median hours", () => {
    const s = caseStats(
      [
        stat({ number: 1, cause: "platform_bug", area: "documents", status: "released", createdAt: "2026-10-06T02:00:00Z", closedAt: "2026-10-13T02:00:00Z" }),
        stat({ number: 2, cause: "feature", area: "documents", status: "released", createdAt: "2026-10-13T02:00:00Z", closedAt: "2026-10-13T06:00:00Z" }),
        stat({ number: 3, cause: "ai_code", area: "ai_builder", status: "released", createdAt: "2026-10-13T03:00:00Z", closedAt: "2026-10-14T05:00:00Z" }),
        stat({ number: 4, createdAt: "2026-10-14T03:00:00Z" }),
      ],
      NOW
    );
    const [first, second] = s.weeks;
    expect(first.opened).toMatchObject({ platform_bug: 1, ai_code: 0, feature: 0, unclassified: 0 });
    expect(first.closed).toBe(0);
    expect(first.medianHours).toBeNull();
    expect(second.opened).toMatchObject({ platform_bug: 0, ai_code: 1, feature: 1, unclassified: 1 });
    expect(second.closed).toBe(3);
    // 168h, 4h and 26h closed in the week of Oct 12 → median 26h.
    expect(second.medianHours).toBe(26);
  });

  it("runs from the first case's week to this week, empty weeks included, at most twelve", () => {
    const quiet = caseStats([stat({ createdAt: "2026-09-28T03:00:00Z" })], NOW);
    expect(quiet.weeks.map((w) => w.start)).toEqual(["2026-09-28", "2026-10-05", "2026-10-12"]);
    expect(quiet.weeks[1].opened.unclassified).toBe(0);

    const long = caseStats([stat({ createdAt: "2026-01-05T03:00:00Z" })], NOW);
    expect(long.weeks).toHaveLength(12);
    expect(long.weeks.at(-1)!.start).toBe("2026-10-12");
  });
});

describe("caseStats days", () => {
  it("files a case by its Bangkok day, from the first case's day to today", () => {
    const s = caseStats(
      [
        stat({ number: 1, createdAt: "2026-10-11T16:30:00Z" }), // 23:30 on the 11th in Bangkok
        stat({ number: 2, createdAt: "2026-10-11T17:30:00Z", status: "released", cause: "platform_bug", area: "preview", closedAt: "2026-10-14T05:30:00Z" }),
      ],
      NOW
    );
    expect(s.days.map((d) => d.start)).toEqual(["2026-10-11", "2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15"]);
    expect(s.days[0].opened.unclassified).toBe(1);
    expect(s.days[1].opened.platform_bug).toBe(1);
    expect(s.days[3]).toMatchObject({ closed: 1, medianHours: 60 });
  });

  it("keeps the last 28 days", () => {
    const s = caseStats([stat({ createdAt: "2026-06-01T03:00:00Z" })], NOW);
    expect(s.days).toHaveLength(28);
    expect(s.days.at(-1)!.start).toBe("2026-10-15");
  });
});

describe("caseStats verdict", () => {
  const opened = (n: number, createdAt: string, over: Partial<StatCase> = {}) =>
    Array.from({ length: n }, (_, i) => stat({ number: i + 1, createdAt, ...over }));
  // A request from a month back: the record covers both weeks, and it is no problem.
  const anchor = stat({
    number: 99,
    cause: "feature",
    area: "documents",
    status: "released",
    createdAt: "2026-09-15T03:00:00Z",
    closedAt: "2026-09-15T04:00:00Z",
  });

  it("is better when fewer problem cases came in this 7 days than the 7 before", () => {
    const s = caseStats([anchor, ...opened(4, "2026-10-05T03:00:00Z"), ...opened(1, "2026-10-14T03:00:00Z")], NOW);
    expect(s.verdict).toEqual({ trend: "better", recent: 1, previous: 4, comparableAt: null });
  });

  it("is worse when more came in", () => {
    const s = caseStats([anchor, ...opened(1, "2026-10-05T03:00:00Z"), ...opened(3, "2026-10-14T03:00:00Z")], NOW);
    expect(s.verdict.trend).toBe("worse");
  });

  it("does not count feature requests or non-issues as the system getting worse", () => {
    const s = caseStats(
      [
        anchor,
        ...opened(1, "2026-10-05T03:00:00Z", { cause: "platform_bug", area: "preview", status: "released", closedAt: "2026-10-06T03:00:00Z" }),
        ...opened(3, "2026-10-14T03:00:00Z", { cause: "feature", area: "documents", status: "released", closedAt: "2026-10-14T05:00:00Z" }),
        ...opened(2, "2026-10-14T03:00:00Z", { cause: "not_issue", area: "preview", status: "not_bug", closedAt: "2026-10-14T05:00:00Z" }),
      ],
      NOW
    );
    expect(s.verdict).toEqual({ trend: "better", recent: 0, previous: 1, comparableAt: null });
  });

  it("is quiet when no problem case came in for two weeks", () => {
    expect(caseStats([stat({ createdAt: "2026-09-01T03:00:00Z" })], NOW).verdict.trend).toBe("quiet");
  });

  it("is early, not worse, while the cases go back less than 14 days: there is nothing before them to compare", () => {
    const s = caseStats(opened(25, "2026-10-08T07:02:00Z"), NOW);
    expect(s.verdict).toEqual({ trend: "early", recent: 25, previous: 0, comparableAt: "2026-10-22T07:02:00.000Z" });
    expect(s.firstAt).toBe("2026-10-08T07:02:00Z");
  });
});

describe("caseStats totals and breakdowns", () => {
  const cases = [
    stat({ number: 1, cause: "platform_bug", area: "documents", status: "released", createdAt: "2026-10-01T00:00:00Z", closedAt: "2026-10-01T10:00:00Z" }),
    stat({ number: 2, cause: "platform_bug", area: "ai_builder", status: "released", createdAt: "2026-10-02T00:00:00Z", closedAt: "2026-10-02T20:00:00Z" }),
    stat({ number: 3, cause: "ai_code", area: "ai_builder", status: "released", createdAt: "2026-10-14T00:00:00Z", closedAt: "2026-10-14T06:00:00Z" }),
    stat({ number: 4, status: "investigating", createdAt: "2026-10-14T00:00:00Z" }),
    stat({ number: 5, cause: "feature", area: "documents", status: "fixed", createdAt: "2026-10-14T00:00:00Z" }),
  ];
  const s = caseStats(cases, NOW);

  it("counts what is still open, what closed in the last 7 days, and the median hours to close over 30 days", () => {
    expect(s.totals).toEqual({ total: 5, open: 2, closed7d: 1, medianHours30d: 10 });
  });

  it("splits every case by cause, unclassified last", () => {
    expect(s.causes).toEqual([
      { cause: "platform_bug", count: 2 },
      { cause: "ai_code", count: 1 },
      { cause: "feature", count: 1 },
      { cause: "unclassified", count: 1 },
    ]);
  });

  it("lists the areas with classified cases, most cases first, by cause", () => {
    expect(s.areas).toEqual([
      { area: "ai_builder", total: 2, counts: { platform_bug: 1, ai_code: 1, external: 0, feature: 0, not_issue: 0 } },
      { area: "documents", total: 2, counts: { platform_bug: 1, ai_code: 0, external: 0, feature: 1, not_issue: 0 } },
    ]);
  });
});

describe("toStatCases", () => {
  const row = {
    number: 7,
    kind: "other" as const,
    cause: "platform_bug" as const,
    area: "project" as const,
    created_at: "2026-10-10T00:00:00Z",
  };

  it("closes a case at its last move to released or not_bug", () => {
    const [c] = toStatCases(
      [{ ...row, id: "a", status: "released" }],
      [
        { case_id: "a", status_to: "released", created_at: "2026-10-11T00:00:00Z" },
        { case_id: "a", status_to: "investigating", created_at: "2026-10-12T00:00:00Z" },
        { case_id: "a", status_to: "released", created_at: "2026-10-13T00:00:00Z" },
      ]
    );
    expect(c.closedAt).toBe("2026-10-13T00:00:00Z");
  });

  it("leaves a reopened case open", () => {
    const [c] = toStatCases(
      [{ ...row, id: "a", status: "investigating" }],
      [{ case_id: "a", status_to: "released", created_at: "2026-10-11T00:00:00Z" }]
    );
    expect(c.closedAt).toBeNull();
  });
});
