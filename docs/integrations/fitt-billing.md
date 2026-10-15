# FITT Billing ← FITT Builder: สัญญา API (phase 1)

FITT Billing App ดึงข้อมูลโปรเจกต์ลูกค้าจาก FITT Builder ผ่าน API ชุดนี้ FITT Builder ไม่ส่งข้อมูลเข้า Billing เอง Billing จึงเลือกได้ว่าจะดึงเมื่อไร

Spec: `docs/superpowers/specs/2026-10-14-fitt-billing-integration-design.md`

**OpenAPI 3.1:** `GET https://fitt-builder.fittbsa.com/v1/integrations/billing/openapi.json` (ไม่ต้องใช้ token) เปิดใน Swagger Editor เพื่อดูและลองเรียก หรือใช้สร้าง client ฝั่ง Billing ได้ · ต้นฉบับอยู่ที่ `lib/billing/openapi.ts` และมี test ตรวจว่าตรงกับข้อมูลที่ API ส่งจริงทุกช่อง

## การเชื่อมต่อ

| เรื่อง | ค่า |
|---|---|
| ที่อยู่ | `https://fitt-builder.fittbsa.com/v1/integrations/billing` (Sandbox ใช้โดเมนของ Sandbox) |
| ยืนยันตัวตน | `Authorization: Bearer <token>` |
| ขอบเขต | token เดียวเห็นทุกโปรเจกต์ ทั้งทุก workspace และโปรเจกต์ส่วนตัวที่ไม่อยู่ใน workspace ไหน |
| รูปแบบ | JSON (UTF-8) · เวลาแบบ ISO 8601 · เงินเป็นบาท (THB) |
| จำกัดความถี่ | 120 ครั้งต่อนาทีต่อ token |

ออก token: `node scripts/billing-binding.mjs create "<label>"` (แสดงครั้งเดียว ระบบเก็บแค่ SHA-256)
ดูรายการ: `node scripts/billing-binding.mjs list` · ยกเลิก: `node scripts/billing-binding.mjs revoke <binding-id>`

ส่ง token ผ่านช่องทางลับที่ตกลงกันเท่านั้น อย่าใส่ในเอกสาร แชท หรือ repository

**token นี้อ่านได้ทุกโปรเจกต์** ทั้งใบเสนอราคา ข้อมูลลูกค้า และ BRD/PRD ถ้าสงสัยว่าหลุด ให้ยกเลิกทันทีแล้วออกใหม่ (ออก token ใหม่ก่อนแล้วค่อยยกเลิกตัวเก่าได้ ช่วงสลับจึงไม่สะดุด) · ใน phase 2 token เดียวกันจะสั่งระงับแอปของลูกค้าได้ทุกรายด้วย

## `GET /projects`

รายการโปรเจกต์ทั้งหมด เรียงจากที่เปลี่ยนเก่าสุดไปใหม่สุด ใช้ซิงก์เฉพาะส่วนที่เปลี่ยนได้

| พารามิเตอร์ | ค่า |
|---|---|
| `updatedSince` | เวลา ISO 8601 · ได้โปรเจกต์ที่เปลี่ยนตั้งแต่เวลานี้ (รวมเวลาที่เท่ากัน) |
| `limit` | 1–100 · ค่าเริ่มต้น 50 |
| `cursor` | ค่า `nextCursor` จากหน้าก่อน |

ตอบ `{ "items": [...], "nextCursor": "<string>" | null }` แต่ละรายการมี `id`, `name`, `phase`, `orgId`, `orgName`, `ownerId`, `ownerName`, `buildSentAt`, `updatedAt`, `customerName`, `quoteNo`, `billingStatus`

**วิธีซิงก์ที่แนะนำ:** เก็บ `updatedAt` ล่าสุดที่เห็น แล้วรอบถัดไปส่ง `updatedSince` = ค่านั้นลบ 2 นาที และตัดรายการซ้ำด้วย `id` · การแก้ที่บันทึกพร้อมกับตอนที่ Billing ดึงข้อมูลอาจได้เวลาที่เก่ากว่าค่าล่าสุดที่เห็นเล็กน้อย การถามย้อนจึงกันไม่ให้พลาด ส่วนรายการซ้ำไม่เป็นปัญหา

`updatedAt` = เวลาล่าสุดที่โปรเจกต์ ใบเสนอราคา ข้อเสนอโครงการ หรือสถานะ billing ของโปรเจกต์นั้นเปลี่ยน · `customerName` และ `quoteNo` มาจากใบเสนอราคาของแพ็กเกจที่เลือกอยู่ ไม่มีเป็น `null`

## `GET /projects/{id}`

```json
{
  "schemaVersion": "fittbuilder.billing.project.v1",
  "project": { "id": "uuid", "name": "", "phase": "build", "orgId": "uuid หรือ null", "orgName": "ชื่อ workspace หรือ null", "ownerId": "uuid", "ownerName": "ชื่อ หรือ null", "ownerEmail": "อีเมล หรือ null", "activeVersion": "standard", "createdAt": "", "updatedAt": "" },
  "customer": { "name": "", "attn": "", "address": "", "phone": "" },
  "build": { "sentAt": "2026-10-10T02:00:00.000Z", "jobId": "", "buildNo": null },
  "billing": { "status": "active", "reason": "", "changedAt": null, "licenseKeyIssued": false },
  "quotes": {
    "standard": {
      "quoteNo": "", "issuedAt": "2026-10-01", "validDays": 30, "subject": "", "currency": "THB",
      "ratePerDay": 8000, "vatPercent": 7,
      "rows": [{ "name": "", "pricing": "days", "days": 3, "qty": 0, "unit": "", "unitPrice": 0, "note": "", "sub": false, "amount": 24000 }],
      "lumpSum": { "enabled": false, "amount": 0 },
      "totals": { "days": 3, "subtotal": 24000, "discount": 0, "net": 24000, "vat": 1680, "grand": 25680 },
      "paymentSchedule": [{ "when": "", "percent": 50, "netDays": 30, "amount": 12840 }],
      "maintenance": { "enabled": true, "billingCycle": "monthly", "modules": 1, "perModule": 15000, "monthly": 15000, "includedMonths": 12, "includedValue": 180000, "annual": 90000, "note": "" },
      "updatedAt": ""
    },
    "premium": null
  },
  "proposals": {
    "standard": { "proposalNo": "", "issuedAt": "", "subject": "", "context": "", "points": [{ "problem": "", "feature": "", "outcome": "" }], "excluded": [], "closing": "", "quoteNo": "", "updatedAt": "" },
    "premium": null
  },
  "documents": { "brd": "markdown หรือ null", "prd": "markdown หรือ null" }
}
```

กติกา:

- โปรเจกต์ส่วนตัวไม่อยู่ใน workspace ไหน `orgId` และ `orgName` จึงเป็น `null` · ใช้ `ownerId` / `ownerName` / `ownerEmail` ดูว่าเป็นของใคร (เจ้าของคือคนในทีมที่สร้างโปรเจกต์ ไม่ใช่ลูกค้า ลูกค้าดูที่ `customer`) · `ownerName` เป็น `null` ถ้าเจ้าของไม่ได้ตั้งชื่อ
- `build` = การส่งไป Code Runner เพื่อ build ครั้งล่าสุด (`null` = ยังไม่เคยส่ง) บอกว่าส่งไปแล้ว ไม่ได้บอกว่า build ผ่านหรือส่งมอบแล้ว ผล build ดูที่ Code Runner ด้วย `jobId` · `buildNo` ตอนนี้เป็น `null` ทุกโปรเจกต์ (ระบบไม่ได้บันทึกกลับ) อย่าใช้อ้างอิง · ในรายการแบบย่อคือ `buildSentAt`
- ข้อมูลการจ่ายเงินที่มีคือเงื่อนไขในใบเสนอราคา (`paymentSchedule`, `maintenance.billingCycle`) FITT Builder ไม่ได้บันทึกว่าลูกค้าจ่ายเงินแล้วหรือยัง
- `customer` มาจากใบเสนอราคาของ `activeVersion` ถ้าไม่มีใช้ข้อเสนอโครงการ ถ้าไม่มีทั้งคู่เป็น `null`
- แพ็กเกจที่ไม่มีใบเสนอราคาหรือข้อเสนอโครงการเป็น `null` · โปรเจกต์ที่ยังไม่มีเอกสารเลยก็ตอบ 200 ได้ปกติ
- `quoteNo` / `proposalNo` เป็นค่าว่างจนกว่าจะ export เอกสารครั้งแรก (ระบบออกเลขตอน export)
- ยอดเงินทุกตัวคำนวณด้วยฟังก์ชันเดียวกับหน้าใบเสนอราคา · `rows[].amount` ปัดสองตำแหน่งต่อบรรทัดเหมือนที่พิมพ์
- ถ้า `lumpSum.enabled` เป็น `true` ยอด `totals.subtotal` คือ `lumpSum.amount` ไม่ใช่ผลรวมของ `rows` ห้ามบวกแถวซ้ำ
- `maintenance.billingCycle` = `"monthly"`, `"yearly"` หรือ `null` (ยังไม่เลือก)
- ไม่มีไฟล์ PDF

## Error

```json
{ "schemaVersion": "fittbuilder.error.v1", "code": "not_found", "message": "ไม่พบโปรเจกต์", "retryable": false, "requestId": "uuid" }
```

| HTTP | `code` | `retryable` | หมายถึง |
|---|---|---|---|
| 400 | `invalid_request` | false | พารามิเตอร์ผิดรูปแบบ |
| 401 | `unauthorized` | false | ไม่มี token, token ผิด หรือถูกยกเลิก |
| 404 | `not_found` | false | ไม่มีโปรเจกต์นี้ (หรือถูกลบไปแล้ว) |
| 429 | `rate_limited` | true | เรียกถี่เกิน · ดู header `Retry-After` (วินาที) |
| 500 | `internal` | true | ฝั่ง FITT Builder มีปัญหา · ลองใหม่ได้ ถ้าไม่หายส่ง `requestId` ให้ทีม |

## ระงับและเปิดคืนแอปของลูกค้า

แต่ละแอปที่ Code Runner สร้างมีสวิตช์ระงับในตัว แอปถาม `GET /v1/service-status` ด้วย license key ของโปรเจกต์ตอนเริ่มและทุก 5 นาที

1. **ก่อนติดตั้ง:** `POST /projects/{id}/license-key` ได้ `{ "licenseKey": "fbl_..." }` (แสดงครั้งเดียว ระบบเก็บแค่ SHA-256) ส่งให้คนติดตั้งผ่านช่องทางลับ ใส่ใน `FITT_LICENSE_KEY` คู่กับ `FITT_STATUS_URL=https://fitt-builder.fittbsa.com/v1/service-status`
2. **ระงับ:** `PUT /projects/{id}/status` body `{ "status": "suspended", "reason": "ค้างชำระค่าบริการเดือนกันยายน" }` ภายในประมาณ 5 นาที ทุกหน้าของแอปตอบหน้า "บริการถูกระงับชั่วคราว" (HTTP 503) ข้อมูลของลูกค้าไม่ถูกแตะ
3. **เปิดคืน:** คำสั่งเดิมด้วย `{ "status": "active" }` แอปกลับมาใช้งานได้ภายในประมาณ 5 นาที
4. **ประวัติ:** ทุกคำสั่งถูกบันทึกพร้อมเหตุผล เวลา และ token ที่สั่ง

`PUT /projects/{id}/status` ตอบ `{ "status", "reason", "changedAt" }` · ส่งคำสั่งเดิมซ้ำได้ ผลเท่าเดิม (`changedAt` ไม่ขยับ แต่บันทึกประวัติทุกครั้ง) · `reason` ไม่เกิน 500 ตัวอักษร และทุกคำสั่งตั้งเหตุผลใหม่ ไม่ส่ง `reason` = ล้างเหตุผลเดิม ถ้าจะส่งซ้ำให้ส่งเหตุผลเดิมไปด้วย · body ผิดรูปแบบตอบ 400 · ไม่มีโปรเจกต์ตอบ 404

`POST /projects/{id}/license-key` ตอบ 201 · ออกใหม่เมื่อไร key เดิมใช้ไม่ได้ทันที ต้องเปลี่ยนในแอปที่ติดตั้งด้วย (ระหว่างนั้นแอปใช้สถานะล่าสุดที่รู้) · ถ้าเรียกพร้อมกันสองครั้ง ใช้ได้เฉพาะ key ที่ออกทีหลัง · การออก key ครั้งแรกให้โปรเจกต์ที่ไม่เคยถูกสั่งมาก่อนจะตั้ง `billing.changedAt` เป็นเวลาที่ออก key (สถานะยังเป็น `active`)

`GET /v1/service-status` (แอปเรียกเอง) ส่ง `Authorization: Bearer <license key>` ตอบ `{ "status": "active" | "suspended", "message", "checkedAt" }` · `message` ตอนระงับคือ "บริการถูกระงับชั่วคราว กรุณาติดต่อผู้ให้บริการ" · ไม่มีข้อมูลอื่นของโปรเจกต์ · key ผิดหรือถูกเปลี่ยนตอบ 401 · จำกัด 60 ครั้งต่อนาทีต่อ key

**ข้อจำกัด**

- ใช้ได้กับแอปที่ build หลังใส่สวิตช์แล้วเท่านั้น
- แอปที่ไม่ได้ตั้ง `FITT_STATUS_URL` และ `FITT_LICENSE_KEY` หรือเครื่องลูกค้าไม่มีอินเทอร์เน็ต ระงับจากระยะไกลไม่ได้ ต้องใช้สัญญาแทน
- ถ้าแอปถาม FITT Builder ไม่ได้ชั่วคราว จะใช้สถานะล่าสุดที่รู้ ไม่หยุดทำงานเอง
- token ของ Billing ตัวเดียวสั่งระงับได้ทุกโปรเจกต์ เก็บไว้ฝั่งเซิร์ฟเวอร์ของ Billing เท่านั้น
