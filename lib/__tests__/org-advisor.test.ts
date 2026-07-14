import { expect, test } from "vitest";
import { parseAdvisorResult } from "@/lib/org-advisor";

test("parses a well-formed result and coerces options", () => {
  const raw = JSON.stringify({
    briefing: "## สรุป\nลูกค้าบ่นเรื่องแอปช้าเป็นหลัก",
    sentimentIndex: 58,
    options: [
      { title: "แคชชั่วคราว", tradeoffs: "Impact กลาง · เวลา 1 สัปดาห์ (ประมาณการ)", rationale: "บรรเทาเร็ว", recommended: true },
      { title: "เพิ่ม read replica", tradeoffs: "Impact สูง", rationale: "แก้ราก", recommended: false },
      { notTitle: "ทิ้ง" }, // no title → dropped
    ],
  });
  const r = parseAdvisorResult(raw)!;
  expect(r.briefing).toContain("แอปช้า");
  expect(r.sentimentIndex).toBe(58);
  expect(r.options).toHaveLength(2);
  expect(r.options[0].recommended).toBe(true);
  expect(r.options[1].recommended).toBe(false);
});

test("clamps sentimentIndex to 0-100 and rounds", () => {
  expect(parseAdvisorResult(JSON.stringify({ briefing: "x", sentimentIndex: 150 }))!.sentimentIndex).toBe(100);
  expect(parseAdvisorResult(JSON.stringify({ briefing: "x", sentimentIndex: -5 }))!.sentimentIndex).toBe(0);
  expect(parseAdvisorResult(JSON.stringify({ briefing: "x", sentimentIndex: 61.7 }))!.sentimentIndex).toBe(62);
});

test("missing sentimentIndex → null; missing options → empty array", () => {
  const r = parseAdvisorResult(JSON.stringify({ briefing: "x" }))!;
  expect(r.sentimentIndex).toBeNull();
  expect(r.options).toEqual([]);
});

test("returns null when JSON is invalid or the briefing is empty", () => {
  expect(parseAdvisorResult("not json")).toBeNull();
  expect(parseAdvisorResult(JSON.stringify({ briefing: "   ", sentimentIndex: 50 }))).toBeNull();
  expect(parseAdvisorResult(JSON.stringify({ sentimentIndex: 50 }))).toBeNull();
});

test("recommended defaults to false unless strictly true", () => {
  const r = parseAdvisorResult(
    JSON.stringify({ briefing: "x", options: [{ title: "a", recommended: "yes" }] })
  )!;
  expect(r.options[0].recommended).toBe(false);
});
