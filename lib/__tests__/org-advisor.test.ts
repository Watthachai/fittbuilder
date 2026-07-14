import { expect, test } from "vitest";
import { parseAdvisorResult } from "@/lib/org-advisor";

test("parses a well-formed result, coercing issues and options", () => {
  const raw = JSON.stringify({
    briefing: "## สรุป\nลูกค้าบ่นเรื่องแอปช้าเป็นหลัก",
    sentimentIndex: 58,
    sourceText: "แอปช้ามากตอนเย็น. ส่งของ 5 วันยังไม่ถึง.",
    issues: [
      { title: "แอปช้า", severity: "critical", detail: "โหลดช้าช่วง peak", cite: "แอปช้ามากตอนเย็น" },
      { title: "ส่งของช้า", severity: "high", cite: "ส่งของ 5 วันยังไม่ถึง" },
      { severity: "low", cite: "x" }, // no title → dropped
    ],
    options: [
      { title: "แคชชั่วคราว", tradeoffs: "Impact กลาง (ประมาณการ)", rationale: "บรรเทาเร็ว", recommended: true },
      { notTitle: "ทิ้ง" }, // no title → dropped
    ],
  });
  const r = parseAdvisorResult(raw)!;
  expect(r.briefing).toContain("แอปช้า");
  expect(r.sentimentIndex).toBe(58);
  expect(r.sourceText).toContain("ส่งของ 5 วัน");
  expect(r.issues).toHaveLength(2);
  expect(r.issues[0]).toMatchObject({ title: "แอปช้า", severity: "critical", cite: "แอปช้ามากตอนเย็น" });
  expect(r.issues[1].detail).toBe(""); // missing detail → ""
  expect(r.options).toHaveLength(1);
  expect(r.options[0].recommended).toBe(true);
});

test("unknown severity falls back to 'medium'", () => {
  const r = parseAdvisorResult(
    JSON.stringify({ briefing: "x", issues: [{ title: "a", severity: "spicy", cite: "" }] })
  )!;
  expect(r.issues[0].severity).toBe("medium");
});

test("clamps sentimentIndex to 0-100 and rounds", () => {
  expect(parseAdvisorResult(JSON.stringify({ briefing: "x", sentimentIndex: 150 }))!.sentimentIndex).toBe(100);
  expect(parseAdvisorResult(JSON.stringify({ briefing: "x", sentimentIndex: -5 }))!.sentimentIndex).toBe(0);
  expect(parseAdvisorResult(JSON.stringify({ briefing: "x", sentimentIndex: 61.7 }))!.sentimentIndex).toBe(62);
});

test("missing optional fields → sensible defaults", () => {
  const r = parseAdvisorResult(JSON.stringify({ briefing: "x" }))!;
  expect(r.sentimentIndex).toBeNull();
  expect(r.sourceText).toBe("");
  expect(r.issues).toEqual([]);
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
