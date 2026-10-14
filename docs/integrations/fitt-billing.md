# FITT Billing ← FITT Builder: สัญญา API (phase 1)

FITT Billing App ดึงข้อมูลโปรเจกต์ลูกค้าจาก FITT Builder ผ่าน API ชุดนี้ FITT Builder ไม่ส่งข้อมูลเข้า Billing เอง Billing จึงเลือกได้ว่าจะดึงเมื่อไร

Spec: `docs/superpowers/specs/2026-10-14-fitt-billing-integration-design.md`

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

ตอบ `{ "items": [...], "nextCursor": "<string>" | null }` แต่ละรายการมี `id`, `name`, `phase`, `orgId`, `orgName`, `ownerId`, `ownerName`, `updatedAt`, `customerName`, `quoteNo`, `billingStatus`

**วิธีซิงก์ที่แนะนำ:** เก็บ `updatedAt` ล่าสุดที่เห็น แล้วรอบถัดไปส่ง `updatedSince` = ค่านั้นลบ 2 นาที และตัดรายการซ้ำด้วย `id` · การแก้ที่บันทึกพร้อมกับตอนที่ Billing ดึงข้อมูลอาจได้เวลาที่เก่ากว่าค่าล่าสุดที่เห็นเล็กน้อย การถามย้อนจึงกันไม่ให้พลาด ส่วนรายการซ้ำไม่เป็นปัญหา

`updatedAt` = เวลาล่าสุดที่โปรเจกต์ ใบเสนอราคา ข้อเสนอโครงการ หรือสถานะ billing ของโปรเจกต์นั้นเปลี่ยน · `customerName` และ `quoteNo` มาจากใบเสนอราคาของแพ็กเกจที่เลือกอยู่ ไม่มีเป็น `null`

## `GET /projects/{id}`

```json
{
  "schemaVersion": "fittbuilder.billing.project.v1",
  "project": { "id": "uuid", "name": "", "phase": "build", "orgId": "uuid หรือ null", "orgName": "ชื่อ workspace หรือ null", "ownerId": "uuid", "ownerName": "ชื่อ หรือ null", "ownerEmail": "อีเมล หรือ null", "activeVersion": "standard", "createdAt": "", "updatedAt": "" },
  "customer": { "name": "", "attn": "", "address": "", "phone": "" },
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

## ยังไม่มีใน phase นี้ (phase 2)

- `PUT /projects/{id}/status` — ระงับ / เปิดคืน
- `POST /projects/{id}/license-key` — ออก license key ให้แอป
- `GET /v1/service-status` — endpoint ที่แอปของลูกค้าใช้ถามสถานะ
