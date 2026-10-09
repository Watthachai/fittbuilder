# FITT Voice → FITT Builder: ตัวรับข้อมูล (สัญญา V1)

ตัวรับตามสัญญา `fittbuilder.delivery.v1` ของทีม FITT Voice (ส่งมาเมื่อ 4 ต.ค. 2026) schema และตัวอย่างต้นฉบับเก็บไว้ที่ `lib/fittvoice/schemas/` และ `lib/__tests__/fixtures/fittvoice/` ใช้ตรวจตามนั้นตรง ๆ ไม่ได้เขียนกฎซ้ำเอง

## ปลายทาง

`POST {BASE_URL}/v1/integrations/fittvoice/deliveries`

- `Authorization: Bearer <service credential>` ผูกกับ workspace เดียว
- `Content-Type: application/json`
- `Idempotency-Key: <deliveryId>` ต้องตรงกับ body
- ขนาดไม่เกิน 1 MiB (นับไบต์ UTF-8 ขณะอ่าน ไม่เชื่อ header)
- 60 request ต่อนาทีต่อ credential เกินแล้วตอบ 429 พร้อม `Retry-After` เป็นวินาที

ตอบ 201 เมื่อสร้างโปรเจกต์ใหม่ และ 200 เมื่ออัปเดตหรือส่งซ้ำ (`outcome=DUPLICATE`) ข้อผิดพลาดตอบตาม `error-v1.schema.json` โดย `retryable=true` เฉพาะ `RATE_LIMITED` และ `TEMPORARILY_UNAVAILABLE`

## ลำดับการตรวจ

1. credential ตรวจกับ hash ที่เก็บไว้ ถ้าไม่มีหรือถูกเพิกถอนตอบ 401 ก่อนอ่าน body
2. rate limit
3. Content-Type และขนาด
4. อ่าน JSON แบบเข้มงวด: ปฏิเสธชื่อ property ซ้ำ surrogate ไม่ครบคู่ ตัวเลขทศนิยม และตัวเลขเกิน safe integer
5. ตรวจกับ schema ที่ทีม Voice เผยแพร่ (ajv draft 2020-12 พร้อม format)
6. `Idempotency-Key` ตรงกับ `deliveryId`
7. `contentHash` คำนวณด้วย RFC 8785 (แพ็กเกจ `canonicalize`) แล้ว SHA-256 ผลตรงกับ hash ในตัวอย่างของทีม Voice
8. กฎอ้างอิง: id ไม่ซ้ำ หลักฐานที่อ้างต้องมีอยู่จริง ห้ามมีหลักฐานที่ไม่มีใครอ้าง `actorId`/`nextStepId` ต้องมีปลายทาง `endMs >= startMs`
9. ฟังก์ชัน `fittbuilder_fittvoice_apply` (migration 0045) ทำส่วนที่เหลือใน transaction เดียว และล็อกต่อ session: ส่งซ้ำแบบเดิม → สร้างใหม่/อัปเดต → stale/conflict/finalized → บันทึก snapshot, latest pointer และ receipt

ไม่เขียน body หรือ credential ลง log มีเพียง requestId กับผลลัพธ์

## ในตัว Builder

- ส่งครั้งแรกสร้างโปรเจกต์ในเฟส Define ของ workspace ที่ credential ผูกอยู่ เจ้าของโปรเจกต์คือเจ้าของ workspace
- ตัวตนของโปรเจกต์คือ `(workspace, exportSessionId)` จึงเปลี่ยน credential ได้โดยโปรเจกต์ไม่หลุด
- ปุ่ม "FITT Voice" บนแถบด้านบนของโปรเจกต์เปิดเอกสารต้นทาง ทุกรายการติดป้าย 🗣 ลูกค้าระบุ / ✔︎ ผู้ตรวจยืนยัน / 💡 AI เสนอ — ยังไม่ยืนยัน พร้อมหลักฐานและเวลา ร่างแสดงคำว่า "ร่างระหว่างคุย — ยังไม่ตรวจ"
- AI ของเฟส Define/Plan ได้รับเอกสารนี้เป็นข้อมูลที่ไม่ใช่คำสั่ง และถูกกำหนดให้ถามผู้ใช้ก่อนร่างเอกสาร การรับข้อมูลไม่สร้าง BRD หรือ Prototype เอง

## ข้อแตกต่างและข้อชี้แจงจากสัญญา

1. ยังไม่ตอบ `FORBIDDEN` เพราะ credential ผูก workspace เดียว และไม่มีกรณีที่รู้ตัวตนแล้วแต่ไม่มีสิทธิ์
2. ตอบ `PROJECT_NOT_FOUND` (404) ในสามกรณีเมื่อเป็น `UPDATE_PROJECT`:
   - session นี้ไม่มีใน workspace นี้
   - `builderProjectId` ไม่ใช่โปรเจกต์ของ session นี้ ซึ่งรวมโปรเจกต์ของ workspace อื่นด้วย
   - โปรเจกต์ถูกลบใน Builder
3. ถ้าโปรเจกต์ถูกลบไปแล้ว แต่ส่ง delivery เดิมซ้ำแบบตรงทุกตัว ยังได้ receipt เดิม (`DUPLICATE`) ตามกฎข้อ 3 ส่วน `UPDATE_PROJECT` ครั้งต่อไปจะได้ `PROJECT_NOT_FOUND`
4. `latestSnapshotRevision` มีค่าใน 409 ทุกตัว และใน 404 เมื่อรู้จัก session ที่เหลือเป็น `null`
5. `INVALID_PAYLOAD` (422) ครอบคลุมกรณีต่อไปนี้ด้วย:
   - Content-Type ไม่ใช่ JSON
   - ไม่ส่ง `Idempotency-Key` หรือส่งมาไม่ตรงกับ `deliveryId`
   - body ไม่ใช่ UTF-8
   - ชื่อ property ซ้ำ
   - ตัวเลขที่ไม่ใช่จำนวนเต็ม
6. ชื่อโปรเจกต์ตาม `projectTitle` ถ้าเป็นร่างจะขึ้นต้นด้วย "ร่างระหว่างคุย — " และทุก snapshot ที่บันทึกสำเร็จจะเปลี่ยนชื่อโปรเจกต์ตามฉบับนั้น
7. `acceptedAt` เป็นเวลา UTC ละเอียดระดับวินาที เช่น `2026-10-07T05:04:27Z`
8. ไม่ปฏิเสธ `CUSTOMER_STATED` ที่หลักฐานไม่ระบุผู้พูด ถือเป็นหน้าที่ฝั่ง Voice ตามสัญญา และไม่อยู่ในเกณฑ์รับงานร่วม
9. V1 ไม่มี route สำหรับลบ

## สัญญา Summary-only (`fittbuilder.summary-delivery.v1`)

ทีม FITT Voice เสนอเมื่อ 9 ต.ค. 2026 ให้ส่งเฉพาะบทสรุปที่ผู้ใช้ตรวจและยืนยันแล้ว แทน discovery 15 หมวด schema ต้นฉบับอยู่ที่ `lib/fittvoice/schemas/summary-delivery-v1.schema.json` และตัวอย่างสังเคราะห์อยู่ที่ `lib/__tests__/fixtures/fittvoice/summary-create.json` (hash ตรงกับ test vector ของทีม Voice)

- ปลายทาง credential `Idempotency-Key` ขนาด rate limit และ receipt/error เหมือนสัญญาเดิมทุกอย่าง
- ตัวรับดู `schemaVersion` แล้วเลือก schema ให้เอง รับทั้งสองสัญญาที่ URL เดิมระหว่างช่วงเปลี่ยน `schemaVersion` อื่นตอบ `INVALID_PAYLOAD` พร้อมบอกว่ารับรุ่นไหนบ้าง
- ข้อ 1–7 ของลำดับการตรวจใช้เหมือนเดิม ข้อ 8 (กฎอ้างอิง) ใช้กับสัญญาเดิมเท่านั้น เพราะ Summary-only ไม่มี item หรือหลักฐาน
- ฟังก์ชัน `fittbuilder_fittvoice_apply` ใช้ตัวเดิมได้ทั้งหมด ไม่ต้องมี migration เพราะใช้แค่ field ที่ทั้งสองสัญญามี `stage` เป็น `REVIEWED` เสมอ จึงไม่มีร่าง
- ปุ่ม "FITT Voice" แสดงชื่อโปรเจกต์ เวลาที่ตรวจ และบทสรุปตามที่ผู้ใช้ยืนยัน ผ่าน renderer ที่ไม่รัน HTML ดิบ AI เฟส Define/Plan ได้รับบทสรุปนี้เป็นข้อมูลที่ไม่ใช่คำสั่ง การรับข้อมูลไม่สร้าง BRD หรือ Prototype เอง
- `review` ของสัญญานี้ไม่มี `reviewerRef` เอกสารต้นทางจึงแสดงเฉพาะเวลาที่ตรวจ

## ตั้งค่า Sandbox

1. Deploy build นี้แยกจาก production พร้อมฐานข้อมูล Supabase แยก
2. ใส่ `DIRECT_URL` ของ Sandbox แล้วรัน `npm run db:migrate` เพื่อลง migration ทั้งหมดจนถึง 0045
3. สร้าง workspace สำหรับทดสอบกับ FITT Voice
4. ออก credential โดยใช้ค่าของ Sandbox:
   `NEXT_PUBLIC_SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/fittvoice-binding.mjs create <workspace-id> "FITT Voice sandbox"`
   สคริปต์แสดง host ที่กำลังเขียน และแสดง credential เพียงครั้งเดียว
5. ส่ง credential ผ่านช่องทางลับที่ตกลงกัน ห้ามส่งในเอกสาร แชต หรือ repository
6. เพิกถอนด้วย `node scripts/fittvoice-binding.mjs revoke <binding-id>`

rate limit ใช้หน่วยความจำของแต่ละ instance ถ้า Sandbox มีหลาย instance ให้ตั้ง Upstash (`UPSTASH_REDIS_REST_URL`/`TOKEN`) เพื่อให้นับรวมกัน
