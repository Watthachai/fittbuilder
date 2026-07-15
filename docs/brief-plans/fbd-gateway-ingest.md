# FBD → Gateway `/v1/ingest` — สรุปความพร้อมฝั่ง FITT Builder

> เทียบ contract ของ Gateway (`POST {GATEWAY_URL}/v1/ingest`) กับสิ่งที่ **FITT Builder (FBD) ส่งจริงตอนนี้**
> อ้างอิงโค้ดจริง: `lib/fittcore.ts` (สร้าง payload) + `app/api/fittcore/route.ts` (proxy ที่ยิงออก)

> **สถานะ (อัปเดต):** ✅ ฝั่ง FBD ทำแล้ว — proxy ยิงเข้า `/v1/ingest`, แนบ `X-API-Key` (จาก env) + `Idempotency-Key` (content hash), pre-check ขนาด/จำนวน, และ parse response `{jobId,state,duplicate}` แล้ว
> **รอ:** ค่า `FITTCORE_GATEWAY_URL` + `FITTCORE_GATEWAY_API_KEY` ใส่ใน `.env.local` (จากฝั่ง Gateway) แล้วทดสอบยิงจริงได้เลย

## TL;DR

1. **Body พร้อมแล้ว ~100%** — payload ที่ FBD สร้าง (`FittcorePayload`) ตรงกับ body ของ `/v1/ingest` ครบทุก field รวมถึง `zip_bytes` (integrity check ผ่านแน่)
2. ตอนนี้ FBD ยิง **ตรงเข้า Runner** ที่ `{RUNNER_URL}/internal/projects` — ยังไม่ผ่าน Gateway และ **ไม่ได้แนบ auth ใดๆ**
3. งานที่เหลือฝั่ง FBD = เปลี่ยนปลายทาง + แนบ 2 header + parse response ใหม่ + pre-check ขนาด. **ของใหม่จริงชิ้นเดียวคือระบบ "org API key"**

---

## 1) Body — ตรงเป๊ะทุก field ✅

`FittcorePayload` (FBD ส่งอยู่แล้ว) ↔ body ที่ `/v1/ingest` ต้องการ:

| field | Gateway ต้องการ | FBD ส่งอยู่ | หมายเหตุ |
|---|---|---|---|
| `org_id` | ✅ ต้องตรงกับ org ของ API key | ✅ `project.orgId` | ตัวที่ Gateway ใช้เช็ค `org_mismatch` |
| `org_name` | ✅ | ✅ | |
| `project_id` | ✅ (idempotency + mapping) | ✅ `project.id` | external id ของ FBD |
| `name`, `tag` | ✅ | ✅ (`tag="alpha-test"`) | |
| `idea`, `brd`, `prd` | ✅ (markdown ≤400KB) | ✅ | มาจาก docs ของ project |
| `prompts[]` | ✅ (≤500 ตัว, ตัวละ ≤64KB) | ✅ (user messages ตามลำดับ) | FBD ยังไม่ cap จำนวน/ขนาด |
| `zip_name` | ✅ | ✅ `"<slug>.zip"` | |
| `zip_base64` | ✅ | ✅ (zip ทุกไฟล์ก้อนเดียว) | |
| `zip_bytes` | ✅ (⚠️ ต้องตรง byte จริง) | ✅ `bytes.length` | **คำนวณจาก byte จริง → integrity ผ่าน** |
| `file_count` | ✅ | ✅ | |

> สรุป: **ไม่ต้องแก้รูปร่าง body เลย** ยกเว้นเพิ่ม guard เรื่องขนาด/จำนวน (ดูข้อ 2)

---

## 2) สิ่งที่ต้องเปลี่ยน เพื่อยิงผ่าน Gateway

| เรื่อง | ตอนนี้ (FBD) | ต้องทำ |
|---|---|---|
| **Endpoint** | `POST {RUNNER_URL}/internal/projects` | → `POST {GATEWAY_URL}/v1/ingest` (แก้ที่ `app/api/fittcore/route.ts`) |
| **`X-API-Key`** | ❌ ไม่ส่ง auth เลย | แนบ **org key** (server-side เท่านั้น) — *ของใหม่จริง ดูข้อ 3* |
| **`Idempotency-Key`** | ❌ ไม่มี | สร้าง key นิ่งต่อ "งาน" (เช่น `${project_id}:${buildNo}`) เพื่อให้ retry เด้ง `200 duplicate:true` แทนสร้างงานซ้ำ |
| **Response shape** | คาด `{ project_id, job_id, build_no, org_id, git_remote, git_branch, status }` (**snake_case**) | Gateway คืน `{ jobId, state:"QUEUED", duplicate }` (**camelCase**) → ต้องแก้ตัว parse + status chip "ส่งเข้า Runner แล้ว" (persist ใน `runner_last`) |
| **Error handling** | pass-through status เฉยๆ | แมป UI ให้ชัด: `403 org_mismatch` · `413 zip_too_large (>25MB)` · `422 invalid_payload` |
| **Pre-check ก่อนส่ง** | ไม่มี | กันตั้งแต่ฝั่ง FBD: `zip_bytes ≤ 25MB`, `prompts ≤ 500` (ตัวละ ≤64KB), `brd/prd ≤ 400KB` — fail เร็ว ไม่เสีย round-trip |

**สถานะโค้ด (มุม FBD):**
- `202 { jobId, state:"QUEUED", duplicate:false }` → งานเข้าคิวสำเร็จ → โชว์ chip "ส่งเข้า Runner แล้ว" + เก็บ `jobId`
- `200 { ..., duplicate:true }` → ยิง Idempotency-Key เดิมซ้ำ → ถือว่าสำเร็จ (idempotent) ไม่ต้อง error
- `403 org_mismatch` → API key ไม่ตรง `org_id` → บอกผู้ใช้ว่า key ของ workspace ผิด
- `413 zip_too_large` → prototype ใหญ่เกิน 25MB → บอกให้ลดไฟล์ (ควรกันตั้งแต่ก่อนส่ง)
- `422 invalid_payload` → field ขาด/ผิดรูป → log + บอก error

---

## 3) ⭐ ของใหม่จริงชิ้นเดียว — "org API key"

ทุกอย่างข้างบนคือแก้ปลายทาง/header/parse. **แต่ FBD ยังไม่มีคอนเซ็ปต์ per-org API key เลย** และ Gateway ตรวจว่า `X-API-Key` ต้องเป็น key ของ org ที่ตรงกับ `org_id` (ไม่งั้น `403 org_mismatch`).

สิ่งที่ต้องมีฝั่ง FBD:
- **ที่เก็บ key ต่อ workspace** (คอลัมน์บน org row หรือตารางแยก) + วิธี issue/rotate
- **แนบ key ฝั่ง server เท่านั้น** — `/api/fittcore` เป็น server-side proxy อยู่แล้ว = จุดที่เหมาะ; key **ห้ามหลุดไป client / bundle / NEXT_PUBLIC**
- ตอนส่ง: proxy look up key ของ `org_id` นั้น → ใส่ `X-API-Key` → forward ไป Gateway

---

## 4) ก่อน/หลัง (คำขอที่ FBD ยิงออก)

**ตอนนี้:**
```
POST {RUNNER_URL}/internal/projects
content-type: application/json
accept: application/json

<FittcorePayload JSON>
```

**เป้าหมาย:**
```
POST {GATEWAY_URL}/v1/ingest
content-type: application/json
X-API-Key: <org key ของ org_id>
Idempotency-Key: <project_id>:<buildNo>

<FittcorePayload JSON>   ← body เดิม ไม่ต้องแก้
```

---

## 5) คำถามถึงฝั่ง Gateway (ให้เพื่อนช่วยเคลียร์)

1. **org key ออกยังไง?** — ต่อ org, ตั้งใน env, หรือมี endpoint ให้ FBD ขอ/หมุน key? รูปแบบ key (prefix, ความยาว)?
2. **`Idempotency-Key` มี TTL ไหม?** ควรผูกกับอะไร — ต่อ project หรือต่อ "การกดส่ง" แต่ละครั้ง? (เผื่อผู้ใช้ตั้งใจส่งซ้ำเพื่อ rebuild)
3. **25MB คิดจากอะไร** — zip bytes จริง (หลัง decode) หรือขนาด HTTP body (base64 ~+33%)? Gateway รับ body ใหญ่แค่ไหน?
4. **หลัง `QUEUED` แล้วไง?** — FBD รู้สถานะงานต่อได้ยังไง (poll `GET /v1/jobs/{jobId}`? webhook? stream?) นี่คือ step 2️⃣+ ที่ยังไม่เห็น
5. **`git_remote`/`git_branch`** ที่เดิม Runner คืนมา — Gateway ยังคืนไหม หรือย้ายไปอยู่ใน job status?

---

## อ้างอิงในโค้ด FBD (ให้เพื่อนดูประกอบ)
- `lib/fittcore.ts` — `FittcorePayload` + `buildFittcorePayload()` (zip + fields)
- `app/api/fittcore/route.ts` — server proxy ที่ยิงออก (จุดที่ต้องเปลี่ยน endpoint + แนบ headers)
- `FittcoreRunnerResult` (ใน `lib/fittcore.ts`) — response type เดิมที่ต้องปรับให้ตรง `{jobId, state, duplicate}`
