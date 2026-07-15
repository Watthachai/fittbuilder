# CRN System Architecture
## FITT Ecosystem — Code Runner & Orchestration Layer

> Version 0.2 — 2026-06-30  
> เอกสารนี้ครอบคลุม architecture ของ pipeline ตั้งแต่ FBD ไปถึง production deployment

---

> ## ⚠️ สถานะจริง (as-built) — อัปเดต 2026-07-15
>
> เอกสารด้านล่างเป็น **ดีไซน์เป้าหมาย**. โค้ดที่ deploy จริง (`fitt-coderunner`) ตอนนี้เป็น MVP ที่ยัง**ต่างจากดีไซน์นี้หลายจุด** — เวลาต่อระบบให้ยึด **โค้ดจริง** เป็นหลัก (ตรวจแล้วทีละบรรทัดกับ source):
>
> | เรื่อง | ดีไซน์ (เอกสารนี้) | โค้ดจริงตอนนี้ |
> |---|---|---|
> | FBD ส่งงาน | FBD → DB กลาง `POST /api/v1/projects/submit` (Bearer) แล้ว FTC DV poll → `POST /internal/trigger` | FBD ยิง**ตรง**เข้า CRN `POST /internal/projects` (`:8080`, ผ่าน proxy `/api/fittcore` ของ FBD) — **ไม่มี auth** (`handleIngest`) |
> | ส่ง code zip | presigned URL (`sc_zip_url`) | **`zip_base64` แนบมาใน body** (decoder เข้มงวด `DisallowUnknownFields` → ใส่ `zip_uri` จะได้ `400`) |
> | response ตอนรับงาน | `201` + `estimated_queue_position` | **`202`** + `{project_id, job_id, build_no, org_id, git_remote, git_branch, status:"queued"}` |
> | รายงานผล build | INSERT `build_events` → DB กลาง fan-out (poll / LISTEN-NOTIFY, flag `notified_fbd`/`notified_ftcdv`) | **ตรงกับดีไซน์** ✓ — `event_type` ∈ `build_started`/`build_done`/`build_failed`; **ไม่มี** HTTP callback และ**ไม่มี**สถานะ `released` |
> | auth / idempotency / จำกัดขนาด (zip 25MB, brd·prd 400KB, prompts 500×64KB) | ระบุไว้ในดีไซน์ | **ยังไม่ implement** — ถือเป็นช่องที่ต้องเติม (ตอนนี้ ingest ไม่เช็คขนาด ไม่มี 403/413/422, body พัง = `400`) |
>
> **สำคัญ — ปลายทางของทีมสร้างตามดีไซน์แล้ว:** ฝั่ง FBD/Gateway/FTC DV (LAN) ทำตาม *ดีไซน์* คือส่ง **`zip_uri`** (LAN IP ให้ CRN คนละเครื่องโหลด zip เองได้) และมี **FTC DV callback endpoint** ที่พร้อมแล้ว (403 แก้แล้ว, callback token ผ่าน). แต่ CRN ตอนนี้รับแค่ `zip_base64` (decoder เข้มงวด → `zip_uri` = 400) และรายงานผลผ่าน `build_events` เท่านั้น. **สองฝั่งจึงยังต่อกันไม่ได้** จนกว่าจะเติมฝั่ง CRN: (1) รับ `zip_uri` แล้ว **HTTP GET โหลด zip** (แทน/เพิ่มจาก base64), (2) หลัง build ยิง **HTTP callback ไป FTC DV** (`POST {FTC_DV}/api/ingest/crn/callback` + Bearer token) เพิ่มจากการเขียน `build_events`. ตัวอย่าง endpoint dev: Gateway `172.168.1.167:8080`, FTC DV `172.168.1.167:3101`.
>
> อ้างอิงโค้ด: `internal/api/api.go` (`handleIngest`, route `/internal/projects`), `internal/store/store.go` (`Notify` → `build_events`), `migrations/0001_init.sql` (ตาราง `build_events` + CHECK `event_type`).

---

## 1. ภาพรวมระบบ (System Overview)

```
┌───────────────────────────────────────────────────────────────────────────┐
│                           FITT Ecosystem                                  │
│                                                                           │
│  ┌─────────┐  insert    ┌───────────────┐  CRUD/Cron                     │
│  │   FBD   │───────────►│   DB กลาง     │◄────────────────────────────┐  │
│  │(Builder)│◄───────────│  (VM Fixed IP)│◄──── notify (build done) ───┤  │
│  └─────────┘  notify    └──────┬────────┘                             │  │
│                                │ trigger (new job)                    │  │
│                                ▼                                      │  │
│                        ┌──────────────┐                               │  │
│                        │   FTC DV     │  (Paperclip)                  │  │
│                        │  (local)     │◄──── notify (build done) ─────┤  │
│                        │ read + spawn │                               │  │
│                        └──────┬───────┘                               │  │
│                               │ spawn Claude Code                     │  │
│                               ▼                                       │  │
│                        ┌──────────────────────────────────────┐       │  │
│                        │          CRN DV (separate machine)   │       │  │
│                        │                                       │       │  │
│                        │  ┌─────────────┐  ┌───────────────┐  │       │  │
│                        │  │ Next.js GUI │  │  Go Backend   │  │       │  │
│                        │  │  Dashboard  │  │  API + WS     │  │       │  │
│                        │  └─────────────┘  └───────┬───────┘  │       │  │
│                        │                           │           │       │  │
│                        │  Build Lifecycle:         │notify─────┼───────┘  │
│                        │  • manage jobs            │           │          │
│                        │  • stream Claude output   ▼           │          │
│                        │  • docker build/push  PostgreSQL      │          │
│                        │  • notify DB กลาง     MongoDB         │          │
│                        └──────────────────────────────────────┘          │
│                               │ docker build/push                         │
│                               ▼                                           │
│                        ┌──────────────┐                                   │
│                        │   FTC MTS    │                                   │
│                        │ Agent DevOp  │                                   │
│                        │  pull image  │                                   │
│                        │  user test   │                                   │
│                        └──────────────┘                                   │
└───────────────────────────────────────────────────────────────────────────┘
```

### Notification Flow (build เสร็จ)
```
CRN ──────────────────► DB กลาง ──┬──► FBD   (แจ้ง user ใน Builder)
 │ (notify build done)             └──► FTC DV (trigger next action / Paperclip)
 │
 └──► CRN Dashboard (แสดง status ใน GUI ของ Code Runner เอง)
```

---

## 2. Components

### 2.1 FBD — FITT Builder (this repo)
**บทบาท:** AI-powered prototype generator ที่ user ใช้สร้าง web demo  
**รับแจ้งเตือน:** เมื่อ build เสร็จ (ผ่าน DB กลาง)

**Output ที่ส่งออกไป:**
```json
{
  "org_id": "uuid",
  "project_id": "uuid",
  "sc_zip_url": "presigned_url",
  "brd": "markdown string",
  "prd": "markdown string",
  "metadata": {
    "created_at": "ISO8601",
    "version": "1.0.0",
    "stack": "nextjs | react | vanilla"
  }
}
```

**Trigger:** User กด export / ส่ง prototype ออกจาก Studio

---

### 2.2 DB กลาง — Central Database
**บทบาท:** Shared state store + event bus ระหว่างทุก service

**Infrastructure:**
- VM ที่มี Fixed IP (accessible ทุก service)
- PostgreSQL เป็น primary (relational state + job queue)
- MongoDB สำหรับ document store (BRD/PRD content)

**Core Tables:**
```sql
-- Project registry
CREATE TABLE projects (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL,
  name          TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending',
  -- pending | active | archived
  current_build INT NOT NULL DEFAULT 0,
  stack         TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Job queue (หัวใจของ state machine)
CREATE TABLE project_jobs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID NOT NULL REFERENCES projects(id),
  status        TEXT NOT NULL DEFAULT 'queued',
  -- queued | building | done | failed | cancelled
  build_no      INT NOT NULL,
  payload       JSONB NOT NULL,    -- requirement + assets
  session_id    TEXT,              -- Claude Code session ID (for resume)
  docker_tag    TEXT,              -- {dockerhub_user}/{project_id}:v{build_no}
  error_msg     TEXT,
  queued_at     TIMESTAMPTZ DEFAULT now(),
  started_at    TIMESTAMPTZ,
  finished_at   TIMESTAMPTZ
);

-- Edit requests (ขอแก้)
CREATE TABLE edit_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID NOT NULL REFERENCES projects(id),
  job_id        UUID REFERENCES project_jobs(id),
  requester     TEXT,              -- org member / external API caller
  diff_request  JSONB NOT NULL,    -- { "change": "...", "files": [...] }
  status        TEXT NOT NULL DEFAULT 'pending',
  -- pending | merged_to_job | rejected
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Notification events (event bus สำหรับ fan-out)
CREATE TABLE build_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id        UUID NOT NULL REFERENCES project_jobs(id),
  event_type    TEXT NOT NULL,   -- build_done | build_failed | build_started
  payload       JSONB,
  created_at    TIMESTAMPTZ DEFAULT now(),
  -- subscribers poll หรือใช้ LISTEN/NOTIFY
  notified_fbd  BOOLEAN DEFAULT false,
  notified_ftcdv BOOLEAN DEFAULT false
);
```

---

### 2.3 FTC DV — FITT Core Dev (local orchestrator / Paperclip)
**บทบาท:** อ่าน DB กลาง → ส่ง Trigger ไปยัง CRN เท่านั้น  
**ไม่รับผิดชอบ:** spawn Claude Code, build lifecycle (ทั้งหมดอยู่ที่ CRN)

**Tech Stack:**
- Go (lightweight daemon)

**Responsibilities (เฉพาะ 2 อย่างนี้):**
1. Poll `project_jobs` WHERE status = `queued` ทุก 5 วินาที
2. ส่ง trigger HTTP/event ไปยัง CRN เพื่อบอกว่า "มี job ใหม่แล้ว"

**Trigger ที่ส่งไป CRN:**
```
POST {CRN_URL}/internal/trigger
{
  "job_id":     "uuid",
  "project_id": "uuid",
  "org_id":     "uuid"
}
```

**รับ notification จาก DB กลาง:**
- `build_done` → ตรวจสอบว่ามี job ในคิวถัดไปหรือไม่ → trigger CRN ต่อ
- `build_failed` → log + alert

> FTC DV ทำงานคล้าย Paperclip — always-on daemon ที่ respond ต่อ event จาก DB กลาง แล้วส่งต่อให้ CRN เป็นคนทำงาน

---

### 2.4 CRN DV — Code Runner Dev
**บทบาท:** ทั้ง build lifecycle management + GUI dashboard + API gateway  
**Deploy:** Machine แยกต่างหาก มี GUI สำหรับบริหารระบบ

**Tech Stack:**
- **Frontend:** Next.js (system management GUI)
- **Backend:** Go (REST API + WebSocket server)
- **DB:** PostgreSQL + MongoDB (sync กับ DB กลาง)
- **Registry:** Docker Hub

**Concurrent build limit:** 1 build ต่อ 1 org (ห้าม parallel สำหรับ org เดียวกัน)

#### Frontend — System Management GUI
```
CRN Dashboard
├── Overview
│   ├── Total active orgs
│   ├── Jobs in queue (global)
│   └── Builds running now
│
├── Project List (per org)
│   ├── Status Badge: idle / queued / building / done / error
│   ├── Current build no. + Docker tag
│   ├── Queue depth
│   └── [View Logs] [Rollback] [Cancel]
│
├── Job Monitor (live per project)
│   ├── Claude Code output stream (WebSocket)
│   ├── Current tool call: Read / Edit / Bash / ...
│   ├── File currently being modified
│   ├── Token usage + cost (USD)
│   └── Session ID
│
├── Edit Request Panel
│   ├── Incoming requests from external API
│   ├── Queue position
│   └── [Approve] [Reject] [Prioritize]
│
└── Notification Log
    ├── Build events timeline
    └── Sent notifications to DB กลาง (→ FBD, → FTC DV)
```

#### Build Lifecycle (CRN owns this)
```
1. Receive job from FTC DV spawn signal
2. Lock: ตรวจว่า org นี้มี building job อยู่หรือไม่
   - ถ้ามี → queue ไว้ก่อน
   - ถ้าไม่มี → proceed
3. Stream Claude Code output → WebSocket → GUI
4. เมื่อ Claude Code เสร็จ:
   a. git commit ใน project folder
   b. docker build -t {dockerhub_user}/{project_id}:v{N} .
   c. docker push
   d. Update project_jobs.status = 'done'
   e. Notify DB กลาง (INSERT INTO build_events)
5. DB กลาง fan-out → FBD + FTC DV
```

**Backend API:**
```
POST /api/v1/projects/{id}/edit-request
  Authorization: X-API-Key {api_key_per_org}
  Body: { "change": "...", "files": ["..."] }
  → Creates edit_request
  → If org idle: immediate job
  → If org building: queue

GET  /api/v1/projects/{id}/status
  → { status, current_build, queue_depth, session_id, docker_tag }

GET  /api/v1/projects/{id}/jobs/{build_no}/logs  (WebSocket)
  → Streams Claude Code JSON events

POST /api/v1/projects/{id}/rollback/{build_no}
  → docker pull :v{N}, retag as :latest
  → Notify FTC MTS to re-pull

GET  /api/v1/orgs/{org_id}/api-key
  → Returns API key for this org (admin only)
```

---

### 2.5 FTC MTS — FITT Core MTS (production/staging)
**บทบาท:** Pull Docker image จาก Docker Hub → deploy → user testing

**Tech Stack:**
- Agent DevOp (shell automation)
- Docker daemon
- Reverse proxy (nginx / Caddy)

**Flow:**
```
CRN ──notify──► FTC MTS Agent
                    │
               docker pull {dockerhub_user}/{project_id}:v{N}
                    │
               docker stop old_container
               docker run  new_container --port auto
                    │
               update nginx upstream
                    │
               user test ready
```

---

## 3. State Machine — Edit Lifecycle

```
                     User / External API ขอแก้
                               │
                               ▼
                    ┌──────────────────────┐
                    │  edit_request        │
                    │  status = pending    │
                    └──────────┬───────────┘
                               │
               ┌───────────────▼───────────────┐
               │  org มี status=building อยู่?  │
               └───────────────┬───────────────┘
              NO                │           YES
               │                │              │
               ▼                │              ▼
      ┌────────────────┐        │   ┌──────────────────────┐
      │  Create job    │        │   │  Queue edit_request   │
      │  status=queued │        │   │  (wait for current    │
      └───────┬────────┘        │   │   build to finish)    │
              │                 │   └──────────┬─────────────┘
              ▼                 │              │ build_done event
      ┌────────────────┐        │              │
      │  building...   │◄───────┘◄────────────┘
      │  (Claude Code) │
      └───────┬────────┘
              │
       ┌──────┴──────┐
       │ success?    │
       ├─────────────┤
      YES            NO
       │              │
       ▼              ▼
  docker build    ┌──────────┐
  docker push     │  error   │
       │          │ rollback │
       ▼          │ available│
  notify          └──────────┘
  DB กลาง
  ├──► FBD (แจ้ง user)
  └──► FTC DV (trigger next)
```

**กฎที่ห้ามละเมิด:**
- 1 org = max 1 `building` job ในเวลาเดียวกัน
- job ใหม่ที่มาระหว่าง building → queue เท่านั้น ห้าม interrupt
- Claude Code `session_id` เก็บใน `project_jobs` เพื่อ `--resume` ได้
- ทุก build สร้าง git commit (immutable history)

---

## 4. Version Control Strategy

### Git inside project folder
```
/projects/{project_id}/
  ├── .git/   ← 1 commit per build
  ├── src/
  └── ...

Tags: v1, v2, v3, ...
```

### Docker Hub Tags
```
{dockerhub_user}/{project_id}:v{build_no}   ← immutable per build
{dockerhub_user}/{project_id}:latest         ← points to current
```

### Rollback
```bash
docker pull {dockerhub_user}/{project_id}:v{N-1}
docker tag  {dockerhub_user}/{project_id}:v{N-1} \
            {dockerhub_user}/{project_id}:latest
# Notify FTC MTS to re-pull :latest
```

---

## 5. API Contract: FBD → DB กลาง

```
POST /api/v1/projects/submit
Authorization: Bearer {service_token}
Content-Type: application/json

{
  "org_id":             "uuid",
  "project_id":         "uuid | null",   // null = new project
  "sc_zip_url":         "presigned_url",
  "brd":                "markdown...",
  "prd":                "markdown...",
  "change_description": "เพิ่ม feature X ตรงหน้า Y",
  "stack_hint":         "nextjs",
  "metadata":           {}
}

Response 201:
{
  "job_id":                    "uuid",
  "project_id":                "uuid",
  "build_no":                  3,
  "estimated_queue_position":  0,
  "status":                    "queued"
}
```

---

## 6. External Edit Request API (เพื่อนยิง API มาหา CRN)

```
POST /api/v1/projects/{project_id}/edit-request
Authorization: X-API-Key {api_key_for_org}

{
  "change":       "แก้หน้า Dashboard ให้แสดง chart แบบ bar",
  "target_files": ["src/Dashboard.tsx"],   // optional
  "priority":     "normal"                 // normal | urgent
}

Response 202:
{
  "request_id":       "uuid",
  "status":           "queued",
  "queue_position":   2,
  "current_build_no": 5
}
```

**Auth — API Key per Org:**
```
Header: X-API-Key sk-org-{org_id}-{random_32}

- 1 key ต่อ 1 org
- Admin generate ผ่าน CRN Dashboard
- Revoke/rotate ได้ทันที
- เก็บ hash ใน DB (ไม่เก็บ plaintext)
```

---

## 7. Claude Code Integration

### Stream JSON parsing (สำหรับ GUI)

Claude Code `--output-format stream-json` ส่ง event ทีละบรรทัด:

```json
{"type": "assistant", "message": {"content": [{"type": "text", "text": "กำลังอ่าน requirement..."}]}}
{"type": "tool_use", "name": "Read", "input": {"file_path": "/projects/abc/src/App.tsx"}}
{"type": "tool_result", "content": "...file contents..."}
{"type": "tool_use", "name": "Edit", "input": {"file_path": "...", "old_string": "...", "new_string": "..."}}
{"type": "result", "subtype": "success", "cost_usd": 0.0234, "session_id": "sess_xyz"}
```

CRN Go backend parse → WebSocket → Next.js Dashboard:

```json
{
  "event":     "tool_call",
  "tool":      "Edit",
  "file":      "src/Dashboard.tsx",
  "cost_usd":  0.0234,
  "timestamp": "2026-06-30T11:00:00Z"
}
```

---

## 8. Development Priority / Build Order

| Phase | Component | สิ่งที่ต้องทำ | Dependency |
|-------|-----------|--------------|------------|
| 1 | DB Schema | Tables + migrations (PostgreSQL) | — |
| 2 | CRN Backend | REST API + API Key auth + job lifecycle | DB |
| 3 | FTC DV Daemon | Poll + spawn Claude Code + stream | DB + claude CLI |
| 4 | CRN Frontend GUI | Dashboard + WebSocket monitor | CRN Backend |
| 5 | Notification | CRN → DB กลาง → FBD + FTC DV fan-out | DB |
| 6 | FBD Integration | Submit API call เมื่อ export | CRN Backend |
| 7 | Docker Pipeline | build + push + Docker Hub | claude done |
| 8 | FTC MTS Deploy | pull image + nginx + serve | Docker Hub |
| 9 | DB กลาง (VM) | Move to shared VM, fixed IP | รอเพื่อน |

> Phase 9 รอเพื่อน — ระหว่างนั้น CRN ทำงานแบบ standalone ด้วย local DB ได้

---

## 9. Decisions Resolved

| คำถาม | คำตอบ |
|--------|-------|
| Registry | Docker Hub |
| Auth (external edit API) | API Key per Org (`X-API-Key` header) |
| CRN DV deploy | Machine แยก — มี system management GUI |
| Max concurrent builds | 1 per org |
| Notification path | CRN → DB กลาง → fan-out ไปยัง FBD + FTC DV |
| FTC DV scope | Read DB กลาง + spawn Claude Code เท่านั้น (ไม่จัดการ build lifecycle) |
