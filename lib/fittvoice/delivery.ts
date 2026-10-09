import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import canonicalize from "canonicalize";
import { createHash } from "node:crypto";
import deliverySchema from "./schemas/delivery-v1.schema.json";
import summarySchema from "./schemas/summary-delivery-v1.schema.json";
import { parseStrictJson } from "./strict-json";
import { CATEGORIES, WORKFLOWS, type Delivery, type ErrorCode, type SummaryDelivery, type VoiceDelivery } from "./types";

/**
 * Everything the receiver checks before it writes anything (contract rule 1):
 * the JSON itself, the published schema, the Idempotency-Key, the hash, and the
 * reference rules a JSON Schema cannot express. The database function then
 * decides create / update / duplicate / stale atomically.
 *
 * Two contracts arrive at the same URL, told apart by schemaVersion: the full
 * delivery (discovery + evidence) and the summary-only one FITT Voice moved to
 * on 9 Oct 2026. Everything after the schema is shared.
 */

/** 1 MiB of UTF-8 JSON as sent — the contract's limit, checked before parsing. */
export const MAX_BODY_BYTES = 1024 * 1024;

export const HTTP_STATUS: Record<ErrorCode, number> = {
  INVALID_PAYLOAD: 422,
  HASH_MISMATCH: 422,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  PROJECT_NOT_FOUND: 404,
  STALE_REVISION: 409,
  IDEMPOTENCY_CONFLICT: 409,
  REVISION_CONFLICT: 409,
  SESSION_FINALIZED: 409,
  PAYLOAD_TOO_LARGE: 413,
  RATE_LIMITED: 429,
  TEMPORARILY_UNAVAILABLE: 503,
};

/** The error envelope (schemas/error-v1.schema.json). Only these two are worth sending again. */
export function errorBody(code: ErrorCode, message: string, requestId: string, latestSnapshotRevision: number | null) {
  return {
    schemaVersion: "fittbuilder.error.v1" as const,
    code,
    message,
    retryable: code === "RATE_LIMITED" || code === "TEMPORARILY_UNAVAILABLE",
    requestId,
    latestSnapshotRevision,
  };
}

/** SHA-256, lowercase hex, of the RFC 8785 canonical form without the top-level contentHash. */
export function contentHashOf(payload: object): string {
  const { contentHash: _omit, ...rest } = payload as Record<string, unknown>;
  void _omit;
  return createHash("sha256").update(canonicalize(rest)!, "utf8").digest("hex");
}

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const VALIDATORS = {
  "fittbuilder.delivery.v1": ajv.compile<Delivery>(deliverySchema),
  "fittbuilder.summary-delivery.v1": ajv.compile<SummaryDelivery>(summarySchema),
};
type SchemaVersion = keyof typeof VALIDATORS;
const isSupported = (v: unknown): v is SchemaVersion => typeof v === "string" && Object.hasOwn(VALIDATORS, v);

type Check = { ok: true; delivery: VoiceDelivery } | { ok: false; code: ErrorCode; message: string };

const invalid = (message: string): Check => ({ ok: false, code: "INVALID_PAYLOAD", message });

/** Rules on references between parts of the payload — the contract's "ตรวจใน application เพิ่ม". */
function referenceProblems(d: Delivery): string[] {
  const problems: string[] = [];
  const discovery = d.content.discovery;
  const items = CATEGORIES.flatMap((c) => discovery[c].items);

  const seen = new Set<string>();
  for (const { id } of items) {
    if (seen.has(id)) problems.push(`item id ซ้ำ: ${id}`);
    seen.add(id);
  }
  const evidenceIds = new Set<string>();
  for (const e of d.evidence) {
    if (evidenceIds.has(e.id)) problems.push(`evidence id ซ้ำ: ${e.id}`);
    evidenceIds.add(e.id);
    if (e.endMs < e.startMs) problems.push(`evidence ${e.id}: endMs น้อยกว่า startMs`);
  }

  const cited = new Set(items.flatMap((i) => i.evidenceIds));
  for (const id of cited) if (!evidenceIds.has(id)) problems.push(`อ้าง evidence ที่ไม่ได้ส่งมา: ${id}`);
  for (const id of evidenceIds) if (!cited.has(id)) problems.push(`evidence ที่ไม่มี item อ้าง: ${id}`);

  const actors = new Set(discovery.actors.items.map((a) => a.id));
  for (const w of WORKFLOWS) {
    const steps = new Set(discovery[w].items.map((s) => s.id));
    for (const s of discovery[w].items) {
      if (s.actorId !== null && !actors.has(s.actorId)) problems.push(`${w}.${s.id}: actorId ไม่มีใน actors: ${s.actorId}`);
      if (s.nextStepId !== null && !steps.has(s.nextStepId)) problems.push(`${w}.${s.id}: nextStepId ไม่มีใน ${w}: ${s.nextStepId}`);
    }
  }
  return problems;
}

/** `raw` is the body as received; `idempotencyKey` the header, which must be the deliveryId. */
export function checkDelivery(raw: string, idempotencyKey: string | null): Check {
  let parsed: unknown;
  try {
    parsed = parseStrictJson(raw);
  } catch (e) {
    return invalid(`JSON ไม่ถูกต้อง: ${e instanceof Error ? e.message : "อ่านไม่ได้"}`);
  }
  const version = (parsed as { schemaVersion?: unknown } | null)?.schemaVersion;
  if (!isSupported(version)) {
    return invalid(`schemaVersion ไม่รองรับ: ${String(version)} — รับ ${Object.keys(VALIDATORS).join(" และ ")}`);
  }
  const validate = VALIDATORS[version];
  if (!validate(parsed)) {
    const where = (validate.errors ?? []).slice(0, 5).map((e) => `${e.instancePath || "/"} ${e.message}`);
    return invalid(`ไม่ตรง schema ${version}: ${where.join("; ")}`);
  }
  const delivery = parsed as VoiceDelivery;
  if (idempotencyKey !== delivery.deliveryId) return invalid("Idempotency-Key ต้องเท่ากับ deliveryId ใน body");
  if (contentHashOf(delivery) !== delivery.contentHash) {
    return { ok: false, code: "HASH_MISMATCH", message: "contentHash ไม่ตรงกับเนื้อหา (RFC 8785 + SHA-256 ไม่รวม contentHash)" };
  }
  // Only the full contract carries references between its parts.
  if (delivery.schemaVersion === "fittbuilder.delivery.v1") {
    const problems = referenceProblems(delivery);
    if (problems.length) return invalid(problems.slice(0, 10).join("; "));
  }
  return { ok: true, delivery };
}
