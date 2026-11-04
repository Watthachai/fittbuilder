import { describe, expect, it } from "vitest";
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { checkDelivery, contentHashOf, errorBody } from "../fittvoice/delivery";
import { itemMarkdown, itemTitle } from "../fittvoice/source-doc";
import type { ErrorCode, MeetingDelivery } from "../fittvoice/types";
import errorSchema from "../fittvoice/schemas/error-v2.schema.json";
import receiptSchema from "../fittvoice/schemas/receipt-v2.schema.json";

/**
 * FITT Voice → Builder, contract fittbuilder.summary-delivery.v2 (v2.1, 4 Nov
 * 2026). The fixtures are FITT Voice's own reference files, generated from its
 * code: their contentHash is FITT Voice's computation, an independent check of
 * ours. The database's rules (bound, stale, forbidden, duplicate) are checked
 * against Postgres; here, everything the route decides before asking it.
 */

const fixture = (name: string) => readFileSync(join(__dirname, "fixtures/fittvoice/v2", name), "utf8");
const create = (): MeetingDelivery => JSON.parse(fixture("delivery-create-project.json"));
const attach = (): MeetingDelivery => JSON.parse(fixture("delivery-attach-to-project.json"));

/** Re-sign a changed payload, so a test isolates the rule it is about. */
const sign = (d: MeetingDelivery): string => JSON.stringify({ ...d, contentHash: contentHashOf(d) });
const check = (d: MeetingDelivery, key: string | null = d.deliveryId) => checkDelivery(sign(d), key);

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validError = ajv.compile(errorSchema);
const validReceipt = ajv.compile(receiptSchema);

describe("v2 meeting deliveries", () => {
  it("computes FITT Voice's test vector: RFC 8785 + SHA-256 without contentHash", () => {
    const vector = JSON.parse(fixture("content-hash-vector.json"));
    expect(contentHashOf(vector.payloadWithoutContentHash)).toBe(vector.sha256);
  });

  it("accepts each of FITT Voice's examples as sent, hash and all", () => {
    for (const name of ["delivery-create-project.json", "delivery-attach-to-project.json", "delivery-revision-update.json"]) {
      const raw = fixture(name);
      expect(checkDelivery(raw, JSON.parse(raw).deliveryId), name).toMatchObject({ ok: true });
    }
  });

  it("holds the target's two shapes, which the schema leaves open", () => {
    const createWithProject = create();
    createWithProject.target = { ...createWithProject.target, builderProjectId: "6c1f3a52-2d1f-4c55-9b55-0f6a8e7b1c11" } as never;
    const createWithoutTitle = create();
    createWithoutTitle.target = { mode: "CREATE_PROJECT", projectTitle: null } as never;
    const attachWithoutProject = attach();
    attachWithoutProject.target = { mode: "ATTACH_TO_PROJECT" } as never;
    const attachWithTitle = attach();
    attachWithTitle.target = { ...attachWithTitle.target, projectTitle: "ชื่อใหม่" } as never;
    for (const d of [createWithProject, createWithoutTitle, attachWithoutProject, attachWithTitle]) {
      expect(check(d), JSON.stringify(d.target)).toMatchObject({ ok: false, code: "INVALID_PAYLOAD", envelope: "v2" });
    }
    // A null is the key left out.
    const nulls = create();
    nulls.target = { ...nulls.target, builderProjectId: null } as never;
    expect(check(nulls)).toMatchObject({ ok: true });
  });

  it("answers in error v2 once the payload is known to be v2", () => {
    const tampered = create();
    tampered.content.summaryMarkdown = "แก้หลังคำนวณ hash";
    expect(checkDelivery(JSON.stringify(tampered), tampered.deliveryId)).toMatchObject({ code: "HASH_MISMATCH", envelope: "v2" });
    expect(check(create(), "another-key")).toMatchObject({ code: "INVALID_PAYLOAD", envelope: "v2" });
    const extra = { ...create(), reviewedByBuilderUserId: "u1" } as unknown as MeetingDelivery;
    expect(check(extra)).toMatchObject({ code: "INVALID_PAYLOAD", envelope: "v2" });
  });

  it("answers in error v1 when the version cannot be read", () => {
    expect(checkDelivery("{not json", "k")).toMatchObject({ code: "INVALID_PAYLOAD", envelope: "v1" });
  });

  it("writes every v2 refusal in the shape FITT Voice's error v2 schema accepts", () => {
    const codes: ErrorCode[] = [
      "UNAUTHORIZED",
      "FORBIDDEN",
      "INVALID_PAYLOAD",
      "HASH_MISMATCH",
      "PAYLOAD_TOO_LARGE",
      "RATE_LIMITED",
      "TEMPORARILY_UNAVAILABLE",
      "PROJECT_WRITE_FORBIDDEN",
      "PROJECT_NOT_FOUND",
      "MEETING_BOUND_TO_OTHER_PROJECT",
      "IDEMPOTENCY_CONFLICT",
      "UNSUPPORTED_SCHEMA_VERSION",
    ];
    for (const code of codes) {
      expect(validError(errorBody(code, "ข้อความ", "req-1", null, "v2")), code).toBe(true);
    }
    const stale = errorBody("STALE_REVISION", "มีฉบับใหม่กว่า", "req-1", 2, "v2");
    expect(validError(stale)).toBe(true);
    expect(Object.keys(stale).sort()).toEqual(Object.keys(JSON.parse(fixture("error-stale-revision-409.json"))).sort());
  });

  it("knows the receipt FITT Voice checks", () => {
    expect(validReceipt(JSON.parse(fixture("receipt-created-201.json")))).toBe(true);
    expect(validReceipt({ ...JSON.parse(fixture("receipt-created-201.json")), outcome: "APPLIED" })).toBe(false);
  });
});

describe("a meeting as the project shows it", () => {
  const item = { kind: "meeting" as const, id: "m1", payload: attach(), receivedAt: "2026-11-03T07:00:06Z", sender: "สมชาย ตัวอย่าง" };

  it("leads with the meeting's own title, its type, and who sent it", () => {
    const md = itemMarkdown(item);
    expect(md.startsWith("# เคลียร์ proposal รอบ 3")).toBe(true);
    expect(md).toContain("Meeting Minutes · Example Co");
    expect(md).toContain("ฉบับที่ 1");
    expect(md).toContain("ส่งโดย สมชาย ตัวอย่าง");
    expect(md).toContain("## งานถัดไป");
    expect(itemTitle(item)).toBe("เคลียร์ proposal รอบ 3");
  });

  it("states its times in Thai time, not as raw timestamps", () => {
    const md = itemMarkdown(item);
    expect(md).toContain("ประชุมเมื่อ 3 พ.ย. 2569 13:11");
    expect(md).toContain("ตรวจแล้วใน FITT Voice เมื่อ 3 พ.ย. 2569 14:00");
    expect(md).not.toContain("2026-11-03T");
  });
});
