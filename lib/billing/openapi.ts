/**
 * The FITT Billing contract (docs/integrations/fitt-billing.md) as OpenAPI 3.1,
 * served at /v1/integrations/billing/openapi.json so FITT Billing can browse it
 * or generate its client from it. Every object refuses fields it doesn't name:
 * lib/__tests__/billing-openapi.test.ts checks real serializer output against
 * these schemas, so a field added to the API and not here fails the build.
 */

type Schema = Record<string, unknown>;

const ref = (name: string): Schema => ({ $ref: `#/components/schemas/${name}` });
const nullable = (s: Schema): Schema => ({ anyOf: [s, { type: "null" }] });
const str = (description?: string): Schema => ({ type: "string", ...(description ? { description } : {}) });
const num = (description?: string): Schema => ({ type: "number", ...(description ? { description } : {}) });
const time = (description?: string): Schema => ({ type: "string", format: "date-time", ...(description ? { description } : {}) });
/** Every property is required and no other is allowed. */
const obj = (properties: Record<string, Schema>, description?: string): Schema => ({
  type: "object",
  additionalProperties: false,
  required: Object.keys(properties),
  properties,
  ...(description ? { description } : {}),
});

const errorResponse = (description: string): Schema => ({
  description,
  content: { "application/json": { schema: ref("Error") } },
});
const rateLimited: Schema = {
  description: "เรียกถี่เกิน 120 ครั้งต่อนาทีต่อ token",
  headers: { "Retry-After": { description: "รอกี่วินาทีแล้วค่อยลองใหม่", schema: { type: "integer" } } },
  content: { "application/json": { schema: ref("Error") } },
};

const quoteRow = obj({
  name: str(),
  pricing: { type: "string", enum: ["days", "unit"], description: "days = คิดเป็นวันทำงาน × ratePerDay · unit = qty × unitPrice" },
  days: num(),
  qty: num(),
  unit: str(),
  unitPrice: num(),
  note: str(),
  sub: { type: "boolean", description: "บรรทัดย่อยของบรรทัดก่อนหน้า" },
  amount: num("ยอดบรรทัดนี้ ปัดสองตำแหน่งเหมือนที่พิมพ์"),
});

const quote = obj(
  {
    quoteNo: str("ว่างจนกว่าจะ export เอกสารครั้งแรก"),
    issuedAt: str("วันที่ออกใบเสนอราคา YYYY-MM-DD"),
    validDays: num(),
    subject: str(),
    currency: { type: "string", const: "THB" },
    ratePerDay: num(),
    vatPercent: num(),
    rows: { type: "array", items: quoteRow },
    lumpSum: obj(
      { enabled: { type: "boolean" }, amount: num() },
      "ถ้า enabled เป็น true ยอด totals.subtotal คือ amount ไม่ใช่ผลรวมของ rows ห้ามบวกแถวซ้ำ"
    ),
    totals: obj({ days: num(), subtotal: num(), discount: num(), net: num(), vat: num(), grand: num() }),
    paymentSchedule: {
      type: "array",
      description: "งวดชำระตามที่ตกลงในใบเสนอราคา ไม่ใช่เงินที่รับจริง",
      items: obj({ when: str("งวดนี้ถึงกำหนดเมื่อไร ตามที่เขียนในใบเสนอราคา"), percent: num(), netDays: num(), amount: num() }),
    },
    maintenance: obj({
      enabled: { type: "boolean" },
      billingCycle: { type: ["string", "null"], enum: ["monthly", "yearly", null], description: "รอบชำระ MA · null = ยังไม่เลือก" },
      modules: num(),
      perModule: num(),
      monthly: num(),
      includedMonths: num(),
      includedValue: num(),
      annual: num(),
      note: str(),
    }),
    updatedAt: time(),
  },
  "ใบเสนอราคาของแพ็กเกจหนึ่ง ยอดทุกตัวคำนวณด้วยสูตรเดียวกับหน้าใบเสนอราคา"
);

const proposal = obj({
  proposalNo: str("ว่างจนกว่าจะ export เอกสารครั้งแรก"),
  issuedAt: str("YYYY-MM-DD"),
  subject: str(),
  context: str(),
  points: { type: "array", items: obj({ problem: str(), feature: str(), outcome: str() }) },
  excluded: { type: "array", items: { type: "string" } },
  closing: str(),
  quoteNo: str(),
  updatedAt: time(),
});

const billingStatus: Schema = { type: "string", enum: ["active", "suspended"] };
const orgId = nullable(str("workspace · null = โปรเจกต์ส่วนตัว"));
const orgName = nullable(str());

export const billingOpenApi = {
  openapi: "3.1.0",
  info: {
    title: "FITT Builder → FITT Billing",
    version: "1.1.0",
    description:
      "FITT Billing ดึงข้อมูลโปรเจกต์ลูกค้าจาก FITT Builder: ลูกค้า ใบเสนอราคาพร้อมยอดและงวดชำระ รอบชำระ MA ข้อเสนอโครงการ BRD/PRD สถานะระงับ และเวลาที่ส่งไป build · token เดียวเห็นทุกโปรเจกต์ ทั้งทุก workspace และโปรเจกต์ส่วนตัว · เก็บ token ไว้ฝั่งเซิร์ฟเวอร์เท่านั้น",
  },
  servers: [{ url: "https://fitt-builder.fittbsa.com/v1/integrations/billing" }],
  security: [{ bearerAuth: [] }],
  paths: {
    "/projects": {
      get: {
        operationId: "listProjects",
        summary: "รายการโปรเจกต์ทั้งหมด เรียงจากที่เปลี่ยนเก่าสุดไปใหม่สุด",
        description:
          "ซิงก์: เก็บ updatedAt ล่าสุดที่เห็น รอบถัดไปส่ง updatedSince = ค่านั้นลบ 2 นาที แล้วตัดรายการซ้ำด้วย id",
        parameters: [
          { name: "updatedSince", in: "query", required: false, description: "ได้โปรเจกต์ที่เปลี่ยนตั้งแต่เวลานี้ (รวมเวลาที่เท่ากัน)", schema: time() },
          { name: "limit", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 100, default: 50 } },
          { name: "cursor", in: "query", required: false, description: "ค่า nextCursor จากหน้าก่อน", schema: str() },
        ],
        responses: {
          "200": { description: "หนึ่งหน้า", content: { "application/json": { schema: ref("ProjectPage") } } },
          "400": errorResponse("พารามิเตอร์ผิดรูปแบบ"),
          "401": errorResponse("ไม่มี token, token ผิด หรือถูกยกเลิก"),
          "429": rateLimited,
          "500": errorResponse("ฝั่ง FITT Builder มีปัญหา ลองใหม่ได้"),
        },
      },
    },
    "/projects/{id}": {
      get: {
        operationId: "getProject",
        summary: "ข้อมูลครบชุดของโปรเจกต์หนึ่ง",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          "200": { description: "โปรเจกต์", content: { "application/json": { schema: ref("ProjectDetail") } } },
          "401": errorResponse("ไม่มี token, token ผิด หรือถูกยกเลิก"),
          "404": errorResponse("ไม่มีโปรเจกต์นี้ (หรือถูกลบไปแล้ว)"),
          "429": rateLimited,
          "500": errorResponse("ฝั่ง FITT Builder มีปัญหา ลองใหม่ได้"),
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", description: "token ของ FITT Billing (ขึ้นต้นด้วย fbb_)" },
    },
    schemas: {
      ProjectSummary: obj({
        id: str(),
        name: str(),
        phase: str("ขั้นของโปรเจกต์ใน FITT Builder เช่น define, build, ship"),
        orgId,
        orgName,
        ownerId: str("คนในทีมที่สร้างโปรเจกต์ (ไม่ใช่ลูกค้า)"),
        ownerName: nullable(str()),
        buildSentAt: nullable(time("ส่งไป Code Runner เพื่อ build ครั้งล่าสุดเมื่อไร · null = ยังไม่เคยส่ง")),
        updatedAt: time("เวลาล่าสุดที่โปรเจกต์ ใบเสนอราคา ข้อเสนอโครงการ หรือสถานะ billing เปลี่ยน"),
        customerName: nullable(str("จากใบเสนอราคาของแพ็กเกจที่เลือก")),
        quoteNo: nullable(str()),
        billingStatus,
      }),
      ProjectPage: obj({
        items: { type: "array", items: ref("ProjectSummary") },
        nextCursor: nullable(str("ส่งเป็น cursor เพื่อดึงหน้าถัดไป · null = หมดแล้ว")),
      }),
      ProjectDetail: obj({
        schemaVersion: { type: "string", const: "fittbuilder.billing.project.v1" },
        project: obj({
          id: str(),
          name: str(),
          phase: str(),
          orgId,
          orgName,
          ownerId: str(),
          ownerName: nullable(str()),
          ownerEmail: nullable(str()),
          activeVersion: str("แพ็กเกจที่เลือกอยู่: standard หรือ premium"),
          createdAt: time(),
          updatedAt: time(),
        }),
        customer: nullable(
          obj({ name: str(), attn: str(), address: str(), phone: str() }, "จากใบเสนอราคาของแพ็กเกจที่เลือก ถ้าไม่มีใช้ข้อเสนอโครงการ")
        ),
        build: nullable(
          obj(
            {
              sentAt: time(),
              jobId: str("job id ฝั่ง Code Runner ใช้ตามดูผล build"),
              buildNo: nullable({ type: "number" }),
            },
            "การส่งไป Code Runner ครั้งล่าสุด บอกว่าส่งแล้ว ไม่ได้บอกว่า build ผ่าน"
          )
        ),
        billing: obj({
          status: billingStatus,
          reason: str(),
          changedAt: nullable(time()),
          licenseKeyIssued: { type: "boolean" },
        }),
        quotes: obj({ standard: nullable(ref("Quote")), premium: nullable(ref("Quote")) }),
        proposals: obj({ standard: nullable(ref("Proposal")), premium: nullable(ref("Proposal")) }),
        documents: obj({ brd: nullable(str("markdown")), prd: nullable(str("markdown")) }),
      }),
      Quote: quote,
      Proposal: proposal,
      Error: obj({
        schemaVersion: { type: "string", const: "fittbuilder.error.v1" },
        code: { type: "string", enum: ["unauthorized", "not_found", "invalid_request", "rate_limited", "internal"] },
        message: str("ข้อความภาษาไทย อ่านให้คนดูได้"),
        retryable: { type: "boolean", description: "true = ลองเรียกซ้ำได้" },
        requestId: str("ส่งให้ทีม FITT Builder เมื่อแจ้งปัญหา"),
      }),
    },
  },
};
