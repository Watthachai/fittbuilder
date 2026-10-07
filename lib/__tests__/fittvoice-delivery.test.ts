import { describe, expect, it } from "vitest";
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseStrictJson } from "../fittvoice/strict-json";
import { checkDelivery, contentHashOf, errorBody } from "../fittvoice/delivery";
import { sourceMarkdown } from "../fittvoice/source-doc";
import type { Delivery } from "../fittvoice/types";
import receiptSchema from "../fittvoice/schemas/receipt-v1.schema.json";
import errorSchema from "../fittvoice/schemas/error-v1.schema.json";

/**
 * FITT Voice → Builder, contract fittbuilder.delivery.v1. The fixtures are the
 * synthetic examples FITT Voice published with the contract; their contentHash
 * is FITT Voice's own computation, so it is an independent check of ours.
 */

const fixture = (name: string) => readFileSync(join(__dirname, "fixtures/fittvoice", name), "utf8");
const batch = fixture("batch-create.json");
const base = (): Delivery => JSON.parse(batch);

/** Re-sign a changed payload, so a test isolates the rule it is about. */
const sign = (d: Delivery): string => JSON.stringify({ ...d, contentHash: contentHashOf(d) });
const check = (d: Delivery, key: string | null = d.deliveryId) => checkDelivery(sign(d), key);
const codeOf = (r: ReturnType<typeof checkDelivery>) => (r.ok ? "OK" : r.code);

describe("parseStrictJson", () => {
  it("reads what JSON.parse reads", () => {
    expect(parseStrictJson(batch)).toEqual(JSON.parse(batch));
  });

  it("rejects what JSON.parse lets through and the contract does not", () => {
    expect(() => parseStrictJson('{"a":1,"a":2}')).toThrow(/ซ้ำ/);
    expect(() => parseStrictJson('{"a":"\\ud800x"}')).toThrow(/surrogate/);
    expect(() => parseStrictJson('{"a":1.5}')).toThrow(/จำนวนเต็ม/);
    expect(() => parseStrictJson('{"a":1e3}')).toThrow(/จำนวนเต็ม/);
    expect(() => parseStrictJson('{"a":9007199254740993}')).toThrow(/safe integer/);
    expect(() => parseStrictJson('{"a":01}')).toThrow();
    expect(() => parseStrictJson('{"a":1} x')).toThrow();
  });
});

describe("contentHashOf", () => {
  it("matches the hash FITT Voice computed for its own example", () => {
    expect(contentHashOf(base())).toBe(base().contentHash);
  });
});

describe("checkDelivery", () => {
  it("accepts the published batch example as it is", () => {
    const r = checkDelivery(batch, "del_synthetic_batch_1");
    expect(r.ok).toBe(true);
  });

  it("requires the Idempotency-Key header to be the deliveryId", () => {
    expect(codeOf(check(base(), null))).toBe("INVALID_PAYLOAD");
    expect(codeOf(check(base(), "del_other"))).toBe("INVALID_PAYLOAD");
  });

  it("rejects a hash that does not match the content", () => {
    const d = base();
    d.content.projectTitle = "แก้ชื่อหลังคำนวณ hash";
    expect(codeOf(checkDelivery(JSON.stringify(d), d.deliveryId))).toBe("HASH_MISMATCH");
  });

  it("rejects a field the schema does not know", () => {
    expect(codeOf(check({ ...base(), extra: 1 } as Delivery))).toBe("INVALID_PAYLOAD");
  });

  it("rejects an AI proposal that slipped into a reviewed requirement", () => {
    const d = base();
    d.content.discovery.functionalRequirements.items[0].assertion = "AI_PROPOSED";
    expect(codeOf(check(d))).toBe("INVALID_PAYLOAD");
  });

  it("rejects confirmed-none in a draft", () => {
    const d = base();
    d.stage = "DRAFT";
    d.review = null;
    d.content.discovery.goals.knowledgeStatus = "CONFIRMED_NONE";
    expect(codeOf(check(d))).toBe("INVALID_PAYLOAD");
  });

  it("rejects evidence that is cited but not sent, and evidence sent but never cited", () => {
    const dangling = base();
    dangling.content.discovery.painPoints.items[0].evidenceIds = ["ev_missing"];
    expect(check(dangling)).toMatchObject({ code: "INVALID_PAYLOAD", message: expect.stringContaining("ev_missing") });

    const orphan = base();
    orphan.evidence.push({ id: "ev_2", segmentId: "seg_2", startMs: 0, endMs: 10, speaker: null, text: "ไม่มีใครอ้าง" });
    expect(check(orphan)).toMatchObject({ code: "INVALID_PAYLOAD", message: expect.stringContaining("ev_2") });
  });

  it("rejects a workflow step whose actor or next step does not exist", () => {
    const actor = base();
    actor.content.discovery.asIsWorkflow.items[0].actorId = "actor_ghost";
    expect(check(actor)).toMatchObject({ code: "INVALID_PAYLOAD", message: expect.stringContaining("actor_ghost") });

    const next = base();
    next.content.discovery.asIsWorkflow.items[0].nextStepId = "step_elsewhere";
    expect(check(next)).toMatchObject({ code: "INVALID_PAYLOAD", message: expect.stringContaining("step_elsewhere") });
  });

  it("rejects an id used twice in the discovery namespace, and time that runs backwards", () => {
    const dup = base();
    dup.content.discovery.painPoints.items[0].id = "req_1";
    expect(check(dup)).toMatchObject({ code: "INVALID_PAYLOAD", message: expect.stringContaining("req_1") });

    const time = base();
    time.evidence[0].endMs = 10;
    expect(codeOf(check(time))).toBe("INVALID_PAYLOAD");
  });
});

describe("errorBody", () => {
  it("builds error envelopes the published schema accepts, retryable exactly where the contract says", () => {
    const ajv = new Ajv2020({ strict: false });
    addFormats(ajv);
    const valid = ajv.compile(errorSchema);
    for (const code of ["STALE_REVISION", "RATE_LIMITED", "TEMPORARILY_UNAVAILABLE", "INVALID_PAYLOAD"] as const) {
      const body = errorBody(code, "ข้อความ", "req_1", code === "STALE_REVISION" ? 3 : null);
      expect(valid(body)).toBe(true);
      expect(body.retryable).toBe(code === "RATE_LIMITED" || code === "TEMPORARILY_UNAVAILABLE");
    }
    expect(errorBody("STALE_REVISION", "มีฉบับใหม่กว่าแล้ว", "request_synthetic_1", 3)).toEqual(JSON.parse(fixture("error-stale.json")));
    // The published receipts are what the database function builds.
    const receipt = ajv.compile(receiptSchema);
    expect(receipt(JSON.parse(fixture("receipt-created.json")))).toBe(true);
  });
});

describe("sourceMarkdown", () => {
  it("labels every item by who said it and cites its evidence with its time", () => {
    const md = sourceMarkdown(base());
    expect(md).toContain("# ระบบคำสั่งซื้อ — ตัวอย่างสังเคราะห์");
    expect(md).toContain("ลูกค้าระบุ");
    expect(md).toContain("AI เสนอ — ยังไม่ยืนยัน");
    expect(md).toContain("ผู้ใดมีสิทธิ์แก้สถานะคำสั่งซื้อ?");
    expect(md).toContain("ev_1");
    expect(md).toContain("00:01–00:12");
    expect(md).toContain("พนักงานขายรับคำสั่งซื้อ"); // the workflow step names its actor
    expect(md).not.toContain("ร่างระหว่างคุย");
  });

  it("marks a draft as a draft", () => {
    const d = base();
    d.stage = "DRAFT";
    d.review = null;
    expect(sourceMarkdown(d)).toContain("ร่างระหว่างคุย — ยังไม่ตรวจ");
  });
});
