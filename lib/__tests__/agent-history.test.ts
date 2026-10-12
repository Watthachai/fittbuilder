import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { priorWithin } from "@/lib/agent-history";

/**
 * Case #15: /api/agent took at most 400 messages, and the studio sends the
 * whole journey. Mabuchi WMS had 433 — 428 of them build turns — so every
 * document action on it ("อัปเดตเอกสารจากของจริง", revising a BRD) was
 * refused as "คำขอไม่ถูกต้อง", for good. Two other projects were past 400 too.
 * The count was never the real bound; how much the model reads is.
 */
describe("priorWithin", () => {
  const msg = (content: string) => ({ role: "user" as const, content });

  it("keeps the newest messages that fit the budget, and counts the rest", () => {
    const messages = [msg("a".repeat(50)), msg("b".repeat(30)), msg("c".repeat(40)), msg("d".repeat(20))];
    expect(priorWithin(messages, 70)).toEqual({ kept: [messages[2], messages[3]], dropped: 2 });
  });

  it("keeps everything when it all fits", () => {
    const messages = [msg("a"), msg("b")];
    expect(priorWithin(messages, 70)).toEqual({ kept: messages, dropped: 0 });
  });
});

describe("/api/agent", () => {
  const route = readFileSync("app/api/agent/route.ts", "utf8");

  it("accepts a history of any length", () => {
    const schema = route.slice(route.indexOf("const bodySchema"), route.indexOf("function sse("));
    expect(schema).not.toMatch(/\.max\(400\)/);
  });

  it("bounds the earlier phases by what the model reads, not by a count", () => {
    expect(route).toContain("priorWithin(");
  });
});
