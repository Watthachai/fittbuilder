# เชื่อม FITT Builder กับ FITT Billing App — design

วันที่: 2026-10-14 · สถานะ: รอผู้ใช้ review · เจ้าของ: อั๋น · OKR: KR1 "FITT Billing - App: ทำ API ส่งเข้าระบบ" (ภายใน 15/10/2026)
Fittcore: DIG-2927 (ข้อมูลโปรเจกต์และเอกสาร), DIG-2928 (ประเภทการจ่ายเงิน), DIG-2929 (ระงับและเปิดคืน)

## เป้าหมาย

FITT Billing App (ตังทำหน้าระบบเสร็จแล้ว) ต้องได้ข้อมูลของโปรเจกต์ลูกค้าจาก FITT Builder โดยไม่ต้องกรอกซ้ำ และต้องสั่งระงับแอปของลูกค้าได้เมื่อลูกค้าค้างจ่ายหรือไม่ต่อ MA แล้วเปิดคืนได้

**ถือว่าสำเร็จเมื่อ:** Billing ดึงโปรเจกต์จริง 1 โปรเจกต์ได้ครบ (ข้อมูลโปรเจกต์ ลูกค้า ใบเสนอราคาพร้อมยอด ประเภทการจ่าย Proposal BRD/PRD) · สั่งระงับแล้วแอปที่ติดตั้งอยู่ขึ้นหน้าระงับภายใน 5 นาที · เปิดคืนแล้วใช้งานต่อได้ทันทีโดยข้อมูลไม่หาย

## สิ่งที่ตัดสินแล้ว (14 ต.ค.)

1. **Billing เป็นฝ่ายดึง** — FITT Builder เปิด API ให้ Billing เรียก ไม่ส่งข้อมูลเข้า Billing เอง จึงไม่ต้องรอสเปก API ของ Billing
2. **ประเภทการจ่ายเงินเลือกในใบเสนอราคา** — ในส่วน MA
3. **ระงับด้วยสวิตช์ในแอป** — ทุกแอปที่ CRN สร้างเช็คสถานะกับ FITT Builder เอง ไม่ใช้การสั่ง CRN แก้โค้ดทุกครั้ง (แบบนั้นเสีย $8–42 และ 8–31 นาทีต่อครั้ง ผลไม่แน่นอน และบังคับไม่ได้ เพราะ image ใหม่ต้องมีคนนำไปติดตั้งเอง)

## สิ่งที่มีอยู่แล้วใน FITT Builder (สำรวจ 14 ต.ค.)

- โปรเจกต์: `fittbuilder_projects` (`active_version` = standard/premium, `phase`, `org_id`) · BRD/PRD เป็นไฟล์ markdown ใน `projects.files` (`docs/BRD.md`, `docs/PRD.md`)
- ใบเสนอราคา: `fittbuilder_project_quotes(project_id, version, payload)` แยกแพ็กเกจ · ยอดเงินไม่ถูกเก็บ คำนวณจาก `quoteTotals()`, `paymentSchedule()`, `maintenanceTotals()` (pure ใช้ฝั่งเซิร์ฟเวอร์ได้)
- Proposal: `fittbuilder_project_proposals(project_id, version, payload)` ไม่มีตัวเงิน
- **ไม่มี:** ตารางลูกค้า (ชื่อลูกค้าเป็นข้อความในใบเสนอราคา) · ประเภทการจ่ายรายเดือน/รายปี · สถานะระงับ · ไฟล์ PDF ฝั่งเซิร์ฟเวอร์ (พิมพ์จากเบราว์เซอร์เท่านั้น)
- ต้นแบบ API ให้ระบบอื่นเรียก: FITT Voice (`/v1/integrations/fittvoice/*`) ใช้ Bearer token ต่อ workspace เก็บแค่ hash ใน `fittbuilder_integration_bindings`

## ไม่อยู่ในขอบเขตรอบนี้

- ไฟล์ PDF ของใบเสนอราคา/Proposal (API ส่งเป็นข้อมูล)
- ตารางลูกค้ากลาง (ใช้ project id เป็นตัวเชื่อม ชื่อลูกค้าเอาจากใบเสนอราคา)
- การล็อกโปรเจกต์ใน studio ของ FITT Builder (ระงับที่ตัวแอปของลูกค้า)
- แอปของลูกค้าที่ไม่มีอินเทอร์เน็ต — ระงับจากระยะไกลไม่ได้ ใช้สัญญาแทน
- นโยบายว่าเหตุไหนควรระงับ (ค้างจ่าย subscription vs ไม่ต่อ MA) — ฝ่ายขายและบัญชีตัดสิน ระบบรับคำสั่งพร้อมเหตุผลเท่านั้น

## Design

### 1. ประเภทการจ่ายเงินในใบเสนอราคา

- `Maintenance` (`lib/quote.ts`) เพิ่ม `billingCycle: "monthly" | "yearly" | null` ค่าเริ่มต้น `null` (ยังไม่เลือก)
- `parseDoc` อ่านค่าที่ไม่รู้จักหรือไม่มีเป็น `null` ใบเสนอราคาเก่าจึงไม่พัง
- แผง MA ในหน้าใบเสนอราคาเพิ่มตัวเลือก "ชำระ: รายเดือน / รายปี"
- เงื่อนไข MA ที่พิมพ์ (`lib/quote-clauses.ts`) ระบุรอบการชำระเมื่อเลือกแล้ว
- ไม่ต้องแก้ฐานข้อมูล (อยู่ใน `payload jsonb` เดิม)

### 2. ฐานข้อมูล (migration ใหม่)

- `fittbuilder_integration_bindings.producer` รับ `'FITT_BILLING'` เพิ่ม
- `fittbuilder_project_billing`
  - `project_id uuid primary key references fittbuilder_projects on delete cascade`
  - `status text not null default 'active' check (status in ('active','suspended'))`
  - `reason text not null default ''`
  - `license_key_hash text unique` (SHA-256 hex, ว่างได้จนกว่าจะออก key)
  - `changed_at timestamptz not null default now()`, `changed_by uuid references fittbuilder_integration_bindings`
- `fittbuilder_project_billing_events` — ประวัติทุกคำสั่ง: `id, project_id, status, reason, binding_id, at`
- เปิด RLS ทั้งสองตาราง ไม่มี policy ให้ผู้ใช้ทั่วไป อ่านเขียนผ่าน service role ในเซิร์ฟเวอร์เท่านั้น
- โปรเจกต์ที่ไม่มีแถวในตาราง billing ถือว่า `active`

### 3. API ให้ Billing (`/v1/integrations/billing/*`)

**ยืนยันตัวตน:** `Authorization: Bearer <token>` · token ออกด้วย `node scripts/billing-binding.mjs create <org-id>` แสดงครั้งเดียว เก็บแค่ hash · token ผูกกับ workspace (org) เดียว เห็นเฉพาะโปรเจกต์ใน org นั้น โปรเจกต์อื่นตอบ `404` · ยกเลิกได้ (`revoked_at`)

**Endpoint:**

| Method | Path | ทำอะไร |
|---|---|---|
| GET | `/projects?updatedSince=<ISO>&limit=<1-100>&cursor=<c>` | รายการโปรเจกต์แบบย่อ เรียงตามเวลาที่แก้ล่าสุด |
| GET | `/projects/{id}` | ข้อมูลครบชุด (schema ด้านล่าง) |
| PUT | `/projects/{id}/status` | ตั้ง `active` / `suspended` พร้อม `reason` · ส่งซ้ำได้ผลเท่าเดิม · บันทึกลงประวัติทุกครั้ง |
| POST | `/projects/{id}/license-key` | ออก license key ใหม่ให้แอปของโปรเจกต์นี้ (แสดงครั้งเดียว key เดิมใช้ไม่ได้ทันที) |

**รายการแบบย่อ:** `{ items: [{ id, name, phase, updatedAt, customerName, quoteNo, billingStatus }], nextCursor }`

**ข้อมูลครบชุด** (`schemaVersion: "fittbuilder.billing.project.v1"`):

```json
{
  "schemaVersion": "fittbuilder.billing.project.v1",
  "project": { "id": "uuid", "name": "", "phase": "build", "orgId": "uuid", "orgName": "", "activeVersion": "standard", "createdAt": "", "updatedAt": "" },
  "customer": { "name": "", "attn": "", "address": "", "phone": "" },
  "billing": { "status": "active", "reason": "", "changedAt": "", "licenseKeyIssued": false },
  "quotes": {
    "standard": {
      "quoteNo": "SQPDV-0001", "issuedAt": "2026-10-01", "validDays": 30, "subject": "", "currency": "THB",
      "rows": [{ "name": "", "pricing": "days", "days": 3, "qty": 0, "unit": "", "unitPrice": 0, "note": "", "sub": false }],
      "totals": { "days": 0, "subtotal": 0, "discount": 0, "net": 0, "vat": 0, "grand": 0 },
      "paymentSchedule": [{ "when": "", "percent": 50, "netDays": 30, "amount": 0 }],
      "maintenance": { "enabled": true, "billingCycle": "monthly", "modules": 1, "perModule": 15000, "monthly": 15000, "includedMonths": 12, "includedValue": 180000, "annual": 90000 },
      "updatedAt": ""
    },
    "premium": null
  },
  "proposals": { "standard": { "proposalNo": "", "issuedAt": "", "subject": "", "points": [], "excluded": "", "closing": "" }, "premium": null },
  "documents": { "brd": "markdown หรือ null", "prd": "markdown หรือ null" }
}
```

- `customer` เอาจากใบเสนอราคาของ `activeVersion` ถ้าไม่มีใช้ของ Proposal ถ้าไม่มีทั้งคู่เป็น `null`
- `quoteNo` / `proposalNo` เป็น `""` จนกว่าจะ export ครั้งแรก (ระบบออกเลขตอน export)
- ยอดเงินคำนวณด้วยฟังก์ชันเดียวกับที่หน้าใบเสนอราคาใช้ ตัวเลขจึงตรงกับกระดาษ

**Error:** `{ schemaVersion: "fittbuilder.error.v1", code, message, retryable, requestId }` · `401 unauthorized` · `404 not_found` · `400 invalid_request` · `429 rate_limited` · `500 internal` · จำกัดจำนวนครั้งต่อ token

### 4. สถานะสำหรับแอป (`GET /v1/service-status`)

- แอปส่ง `Authorization: Bearer <license key>` · ตอบ `{ status: "active" | "suspended", message, checkedAt }`
- `message` ตอนระงับ: "บริการถูกระงับชั่วคราว กรุณาติดต่อผู้ให้บริการ"
- key ไม่ถูกหรือถูกยกเลิก → `401` · จำกัดจำนวนครั้งต่อ key
- ไม่ส่งข้อมูลอื่นของโปรเจกต์ออกไปทาง endpoint นี้
- เพิ่ม `/v1/service-status` ใน `PUBLIC_PREFIXES` ของ `lib/supabase/middleware.ts` (ไม่ต้องล็อกอิน)

### 5. สวิตช์ระงับในแอป (repo fitt-coderunner — สกิล fitt-build)

- ไฟล์สำเร็จรูปใหม่ `assets/service-status.mjs` (แบบเดียวกับ `bootstrap-once.mjs`) Claude ไม่ต้องเขียนเอง และสกิลบังคับให้ต่อเข้าแอปทุกตัว
- อ่าน `FITT_STATUS_URL` และ `FITT_LICENSE_KEY` จาก env ตอนรัน · ไม่ได้ตั้งทั้งคู่ = สวิตช์ปิด (แอปทำงานปกติ)
- เช็คตอนเริ่มและทุก 5 นาที เก็บสถานะล่าสุดในหน่วยความจำ · เช็คไม่ได้ = ใช้สถานะล่าสุดที่รู้ · ไม่ทำให้แอปเริ่มช้าหรือล้ม
- ถูกระงับ = ทุก route ตอบหน้า "ระงับบริการชั่วคราว" (HTTP 503) ยกเว้น health check · ข้อมูลไม่ถูกแตะ
- เพิ่ม `FITT_STATUS_URL`, `FITT_LICENSE_KEY` (ค่าว่าง) ใน compose, INSTALL และ env ตัวอย่างใน contract
- ขั้นตรวจตอน build: รันแอปคู่กับ server จำลองที่ตอบ `suspended` แล้วหน้าแรกต้องได้หน้าระงับ (503) · ตอบ `active` แล้วต้องใช้งานปกติ

### 6. ความปลอดภัย

- token ของ Billing และ license key เก็บแค่ SHA-256 · ไม่ log token หรือเนื้อหา request
- อ่านเขียนตารางใหม่ผ่าน service role ในเซิร์ฟเวอร์เท่านั้น
- license key ใช้ได้แค่ถามสถานะ ไม่เห็นข้อมูลอื่น
- ใครถือ token ของ Billing สั่งระงับแอปลูกค้าได้ → ออก token เฉพาะเครื่อง Billing และยกเลิกได้ทันที

## Testing

- Unit (vitest): แปลงข้อมูลโปรเจกต์ → JSON (ยอดเงินตรงกับ `quoteTotals`), `parseDoc` กับ `billingCycle` ทั้งค่าเก่าและค่าใหม่, ตรวจ token, ตอบ error ตาม envelope
- Route: token ผิด/ยกเลิก → 401 · โปรเจกต์นอก org → 404 · ตั้งสถานะซ้ำได้ผลเท่าเดิมและมีประวัติ · ออก key ใหม่แล้ว key เก่าใช้ไม่ได้
- Migration: รันบนฐาน sandbox ก่อน production
- CRN: unit test ของ `service-status.mjs` และขั้นตรวจตอน build ตามข้อ 5

## ลำดับส่งมอบ

| วันที่ | ส่งมอบ |
|---|---|
| 15 ต.ค. | spec นี้ + เอกสาร API ให้ตังใช้ต่อเชื่อม (ประชุม 15 ต.ค.) |
| 16–17 ต.ค. | ข้อ 1 (ประเภทการจ่าย) + ข้อ 2–3 ส่วนอ่านข้อมูล บน sandbox |
| ภายใน 23 ต.ค. | ข้อ 3 ส่วนสถานะ/license + ข้อ 4 + ข้อ 5 (CRN) ทันรอบ build ใหม่ 24 ต.ค. |

deploy production ของ FITT Builder และ CRN ต้องได้รับอนุมัติก่อนทุกครั้ง · งานข้อ 5 ใช้ขั้นตรวจตัวเดียวกับงาน A1/B5 ของ CRN (23 ต.ค.) จะทำต่อกัน

## คำถามสำหรับประชุมกับตัง (15 ต.ค.)

1. ข้อมูลใน schema ครบพอสำหรับออกใบแจ้งหนี้ไหม ขาดช่องไหน
2. ต้องการไฟล์ PDF ของใบเสนอราคาด้วยไหม (รอบนี้ยังไม่มี)
3. Billing จะดึงข้อมูลบ่อยแค่ไหน ใช้ `updatedSince` พอไหม
4. ใครเป็นคนส่ง license key ให้ทีมที่ติดตั้งแอป (Billing หรือ FTCDV)
5. เงินเข้าจริงบันทึกที่ระบบไหน (คำถามเดียวกับ DIG-2885)
6. ระงับเมื่อไร: ค้างจ่าย subscription กี่วัน · ไม่ต่อ MA ระงับทั้งแอปหรือแค่หยุดดูแล
7. Billing ต้องดูกี่ workspace (org) — ออก token ต่อ org
