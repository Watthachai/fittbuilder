# FITT Builder → Code Runner — Hand-off Payload

> เอกสารสัญญา (wire contract) ของสิ่งที่ **FITT Builder (FBD)** ส่งให้ **FITT Code Runner (CRN)**
> ตอนผู้ใช้กด **"ส่งไป Code Runner"** ใน Studio
>
> ที่มาของความจริง (source of truth):
> - ฝั่งส่ง: `lib/fittcore.ts` (`FittcorePayload`, `buildFittcorePayload`)
> - proxy: `app/api/fittcore/route.ts`
> - ฝั่งรับ: `~/fitt-coderunner/internal/api/api.go` (`ingestBody`, `handleIngest`)
>
> ช่องทางตอนนี้ติดแท็ก **`alpha-test`** (`FITTCORE_TAG`)

---

## 1. ภาพรวม flow

```
┌─────────────┐   1 POST (JSON)      ┌──────────────────┐   2 POST (forward)   ┌──────────────────┐
│  Studio UI  │ ──────────────────▶ │  /api/fittcore   │ ──────────────────▶ │ CRN              │
│ Export modal│   FittcorePayload    │  (Next proxy)    │   body เดิมทั้งก้อน   │ /internal/projects│
└─────────────┘                      └──────────────────┘                      └──────────────────┘
       ▲                                                                                  │
       │                          3  202 Accepted { build_no, git_branch, ... }           │
       └──────────────────────────────────────────────────────────────────────────────────┘
```

- **1 →** `FittcoreExportModal` เรียก `buildFittcorePayload(project, orgName)` แล้ว `POST /api/fittcore`
- **2 →** proxy ฝั่ง server forward body เดิม**ทั้งก้อน**ไป `${FITTCORE_RUNNER_URL}/internal/projects` (default `http://localhost:8080`) — เหตุผลที่ต้องมี proxy: ซ่อน URL ของ Runner ไม่ให้หลุดไป client + Next server อยู่ host เดียวกับ CRN
- **3 →** CRN ตอบ **202 Accepted** พร้อม `build_no`, `git_branch`, `git_remote` → FBD เก็บลง DB (`runner_last`) เป็นชิปถาวร "🚀 Code Runner #N"

หลักการสำคัญ: **โค้ดต้นแบบไปเป็น zip ก้อนเดียว** (ไม่มี array แยกไฟล์บนสาย) — CRN วาง zip ลง build workdir แล้ว **Claude Code build agent แตก zip เอง** ส่วน `idea/brd/prd/prompts` ส่งเป็น text ซ้ำ (แม้จะอยู่ใน zip ใต้ `docs/` แล้ว) เพื่อให้ CRN ประกอบ build prompt ได้ทันทีโดยไม่ต้องแตก zip ก่อน

---

## 2. Payload — ตารางฟิลด์ทั้งหมด

`Content-Type: application/json` · ฝั่ง CRN decode แบบ **strict** (`DisallowUnknownFields`) → ทุกฟิลด์ต้องมีครบ ห้ามมีฟิลด์เกิน

| field | type | คือ | ที่มา (FBD) |
|---|---|---|---|
| `org_id` | `string` | id องค์กร (UUID หรือ `""`) | `project.orgId ?? ""` |
| `org_name` | `string` | ชื่อองค์กร | ส่งเข้ามาตอนเรียก (`orgName`) |
| `project_id` | `string` | id โปรเจกต์ | `project.id` |
| `name` | `string` | ชื่อโปรเจกต์ | `project.name` |
| `tag` | `string` | ช่องทาง hand-off | `"alpha-test"` (`FITTCORE_TAG`) |
| `idea` | `string` | ไอเดียตั้งต้น | `docsFromFiles(files).idea` |
| `brd` | `string` | Business Requirements Doc | `docsFromFiles(files).brd` |
| `prd` | `string` | Product Requirements Doc | `docsFromFiles(files).prd` |
| `prompts` | `string[]` | ข้อความแชทของผู้ใช้ทั้งหมด เรียงตามลำดับ | `project.messages` เฉพาะ `role === "user"` |
| `zip_name` | `string` | ชื่อไฟล์ zip แนะนำ | `slug(project.name) + ".zip"` |
| `zip_base64` | `string` | ทุกไฟล์ในโปรเจกต์ (รวม `docs/`) → zip → base64 | `JSZip` over `project.files` |
| `file_count` | `number` | จำนวนไฟล์ใน zip | `Object.keys(files).length` |
| `zip_bytes` | `number` | ขนาด zip (ไบต์ ก่อน base64) | `bytes.length` |

> **การตรวจฝั่ง proxy** (`/api/fittcore`): ต้องมี `name` (string) และ `zip_base64` (string ไม่ว่าง) ไม่งั้น 400
> **rate limit**: ต่อ client IP — ถี่เกินได้ 429

---

## 3. รายละเอียดรายฟิลด์

### เอกสาร brief — `idea` / `brd` / `prd`
ดึงด้วย `docsFromFiles(project.files)` (parse จากไฟล์ `docs/*.md` ในโปรเจกต์) ทั้งสามตัว**อยู่ใน `zip_base64` ด้วย**แล้ว (ใต้ `docs/`) แต่ส่งซ้ำเป็น plain text เพื่อให้ CRN เอาไปใส่ build prompt ได้เลย ถ้าไม่มีเอกสารจะเป็น `""`

### `prompts`
= ข้อความแชทของผู้ใช้ทั้งหมด (เฉพาะ `role === "user"`) เรียงตามลำดับที่พิมพ์ — เป็น requirement ตั้งต้นที่ผู้ใช้สั่ง

### `zip_base64` (ก้อนหลัก)
1. `JSZip` ใส่ทุก entry ของ `project.files` โดย**คงพาธเดิม** (รวม `docs/`, `src/`, ฯลฯ)
2. `generateAsync({ type: "uint8array" })`
3. encode base64 แบบ **chunked** (slice ละ 32 KB) เพราะ `btoa(String.fromCharCode(...bigArray))` จะ blow call stack

---

## 4. ตัวอย่าง body (wire shape)

> ตัวอย่าง `idea/brd/zip_base64` ถูกย่อ — ของจริงเป็นข้อความ/base64 เต็ม
> (ในโมดัลกดปุ่ม **"ดู body (JSON) ที่จะ POST"** จะเห็นรูปแบบนี้ โดยฟิลด์หนักถูกย่อ)

```json
{
  "org_id": "3f1c2b90-8a4e-4c11-9b2f-6d5e0a7c1234",
  "org_name": "FITT Web Team",
  "project_id": "a12bc3d4-56ef-7890-ab12-cd34ef567890",
  "name": "ExpenseFlow",
  "tag": "alpha-test",
  "idea": "‹แอปบันทึกค่าใช้จ่ายทีม …›",
  "brd": "‹Business Requirements … 4,210 ตัวอักษร›",
  "prd": "‹Product Requirements … 6,880 ตัวอักษร›",
  "prompts": [
    "สร้างแอปบันทึกค่าใช้จ่ายของทีม",
    "เพิ่มหน้าสรุปยอดรายเดือนเป็นกราฟ"
  ],
  "zip_name": "expenseflow.zip",
  "zip_base64": "‹base64 · zip 14 ไฟล์›",
  "file_count": 14,
  "zip_bytes": 48213
}
```

---

## 5. Response จาก CRN (202 Accepted)

`FittcoreRunnerResult` (`lib/fittcore.ts`) — FBD เก็บ `build_no`/`git_branch` ลง `runner_last`

| field | type | คือ |
|---|---|---|
| `project_id` | `string` | id โปรเจกต์ (ที่ CRN ใช้จริง — อาจ mint ใหม่ถ้าไม่ส่งมา) |
| `job_id` | `string` | id งาน build ที่เข้าคิว |
| `build_no` | `number` | เลข build (running number ต่อโปรเจกต์) |
| `org_id` | `string` | id องค์กรที่ CRN ใช้จริง |
| `git_remote` | `string` | remote ปลายทาง (เช่น `Watthachai/coderunner_test.git`) |
| `git_branch` | `string` | branch ที่จะ build — `crn/<slug(name)>-<projectId[:8]>` |
| `status` | `string` | สถานะงานตอนเข้าคิว |

```json
{
  "project_id": "a12bc3d4-56ef-7890-ab12-cd34ef567890",
  "job_id": "e5f6a7b8-90cd-1234-ef56-7890abcdef12",
  "build_no": 3,
  "org_id": "3f1c2b90-8a4e-4c11-9b2f-6d5e0a7c1234",
  "git_remote": "https://github.com/Watthachai/coderunner_test.git",
  "git_branch": "crn/expenseflow-a12bc3d4",
  "status": "queued"
}
```

---

## 6. CRN ทำอะไรกับ payload (`handleIngest`)

1. **Ensure org** — parse `org_id` (ถ้าว่างใช้ default), upsert org ด้วย `org_name` (ว่าง → `"FBD Default"`)
2. **Ensure project** — parse `project_id`; ถ้ายังไม่มีในระบบ → สร้างใหม่ (re-export ใช้ id เดิมซ้ำได้)
3. **Enqueue build** — re-marshal `ingestBody` ทั้งก้อน (รวม `zip_base64`) เป็น job payload → jobs layer เอาไป materialize ไฟล์ + ประกอบ Claude prompt จาก `idea`/`brd`/`prd`/`prompts`
4. ตอบ **202** พร้อมข้อมูล build

---

## 7. Endpoints / config

| อะไร | ค่า |
|---|---|
| FBD proxy | `POST /api/fittcore` |
| CRN ingest | `POST /internal/projects` |
| Runner URL (env) | `FITTCORE_RUNNER_URL` (default `http://localhost:8080`) |
| proxy timeout | 20s (`AbortSignal.timeout`) · route `maxDuration = 25` |
| target repo (แสดงในโมดัล) | `Watthachai/coderunner_test.git` |

---

## หมายเหตุ

- **hand-off เป็น user-initiated เท่านั้น** — ไม่มี auto-send; ผู้ใช้ต้องกดยืนยันในโมดัลเอง
- หลังส่งสำเร็จ FBD จะ (ก) โพสต์ลงแชททีมว่าใครส่ง + build # และ (ข) persist `runner_last` ลง DB เป็นชิปถาวรบน TopBar
- ยังมี hand-off แบบ**เอกสาร Markdown** (`buildFittcoreSpec` / `downloadFittcoreSpec`) เป็นช่องทางสำรองให้ดาวน์โหลด `.fittcore.md` ไปเปิด issue เองแบบ manual — คนละอันกับ payload เครื่องนี้
