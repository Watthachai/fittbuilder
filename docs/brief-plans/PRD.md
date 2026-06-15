# Product Requirements Document (PRD)
**Product:** PromptBuild — AI-Powered Web Demo Builder
**Version:** 1.1
**Date:** 2026-06-11
**References:** BRD v1.0
**Status:** Draft
**Changelog:** v1.1 — เพิ่ม Spec-to-Demo (BRD/PRD input + Preset Question Flow)

---

## 1. Product Vision

> "ให้ทุกคนสร้าง web demo ได้ใน 60 วินาที โดยไม่ต้องเขียนโค้ดแม้แต่บรรทัดเดียว"

PromptBuild เป็น Next.js SaaS ที่ใช้ Claude AI สร้าง React application และรันด้วย WebContainers API ใน browser แบบ real-time มุ่งเน้น UX สำหรับ Designer และ Non-developer โดยเฉพาะ

---

## 2. Tech Stack

| Layer | Technology | เหตุผล |
|---|---|---|
| Frontend | Next.js 16 (App Router) | SSR + API routes ในที่เดียว |
| Styling | Tailwind CSS + shadcn/ui | เร็ว, consistent |
| AI | Anthropic Claude claude-sonnet-4-20250514 | Code quality + context window |
| Sandbox | WebContainers API | Real Node.js ใน browser |
| Code Editor | Monaco Editor | VS Code experience |
| Auth | NextAuth.js (Google + Email) | Fastest to ship |
| Database | PostgreSQL + Prisma | Projects, users, usage tracking |
| Hosting | Vercel | COEP/COOP headers support |
| Payments | Stripe | Subscription management |

---

## 3. User Personas

### Persona 1 — "ปลา" Digital Designer
- เครื่องมือหลัก: Figma, Notion
- เป้าหมาย: ส่ง interactive demo ให้ client ก่อน dev sprint
- Frustration: Figma prototype ไม่รัน real interaction
- Tech level: รู้จัก HTML แต่ไม่เขียน code
- Quote: "อยากให้ client เห็นของจริงๆ ไม่ใช่แค่ clickable wireframe"

### Persona 2 — "ต้น" Product Manager
- เครื่องมือหลัก: Jira, Confluence, Miro
- เป้าหมาย: Validate feature กับ stakeholder ก่อน sprint planning
- Frustration: ต้องรอ 2 sprints กว่าจะเห็น prototype
- Tech level: เขียน SQL ได้นิดหน่อย, ไม่รู้ frontend
- Quote: "ถ้ากูอธิบายเป็น text ได้ กูอยากเห็น prototype เลย"

### Persona 3 — "มิ้ว" Marketing Manager
- เครื่องมือหลัก: Canva, Google Analytics
- เป้าหมาย: สร้าง campaign landing page เองโดยไม่ง้อ dev
- Frustration: Dev backlog เต็ม landing page ต้องรอ 3 สัปดาห์
- Tech level: ไม่มี technical background เลย
- Quote: "Wix ก็ยากแล้ว อยากแค่พิมพ์แล้วได้เลย"

---

## 4. User Stories

### Epic 1: Core Generation

| ID | User Story | Priority | Acceptance Criteria |
|---|---|---|---|
| US-001 | ในฐานะ user ฉันต้องการพิมพ์ prompt เป็นภาษาไทย/อังกฤษแล้วได้ web demo | P0 | AI generate ใน < 60s, preview ขึ้นใน iframe |
| US-002 | ในฐานะ user ฉันต้องการเห็น real-time progress ขณะรอ | P0 | แสดง step: Generating → Installing → Starting server |
| US-003 | ในฐานะ user ฉันต้องการ iterate บน demo ด้วยภาษาธรรมดา | P1 | พิมพ์ "เปลี่ยนสีปุ่ม" แล้ว AI แก้ให้ถูกต้อง |
| US-004 | ในฐานะ user ฉันต้องการ undo การเปลี่ยนแปลง | P2 | History ย้อนกลับได้ 10 ครั้ง |

### Epic 2: Preview & Sharing

| ID | User Story | Priority | Acceptance Criteria |
|---|---|---|---|
| US-010 | ในฐานะ user ฉันต้องการดู preview แบบ responsive (mobile/tablet/desktop) | P1 | Toggle viewport 375px / 768px / 1440px |
| US-011 | ในฐานะ user ฉันต้องการ share link ให้คนอื่นดูโดยไม่ต้อง login | P0 | Public URL ใช้งานได้ 30 วันสำหรับ free, ถาวรสำหรับ paid |
| US-012 | ในฐานะ paid user ฉันต้องการ export code เป็น zip | P1 | Download .zip มี index.html + assets หรือ React project |

### Epic 3: Project Management

| ID | User Story | Priority | Acceptance Criteria |
|---|---|---|---|
| US-020 | ในฐานะ user ฉันต้องการบันทึก project และตั้งชื่อ | P0 | Save ได้, แสดงใน dashboard |
| US-021 | ในฐานะ user ฉันต้องการดู project ทั้งหมดใน dashboard | P1 | Grid view พร้อม thumbnail + ชื่อ + วันที่แก้ล่าสุด |
| US-022 | ในฐานะ user ฉันต้องการ duplicate project | P2 | Copy project พร้อม files และ prompt history |

### Epic 4: Auth & Billing

| ID | User Story | Priority | Acceptance Criteria |
|---|---|---|---|
| US-030 | ในฐานะ user ฉันต้องการ login ด้วย Google หรือ email | P0 | OAuth Google + Magic Link email |
| US-031 | ในฐานะ free user ฉันต้องการรู้ว่าใช้ generation ไปเท่าไหร่ | P0 | แสดง "3/5 generations used" ใน UI |
| US-032 | ในฐานะ free user ที่ถึง limit ฉันต้องการ upgrade ได้ง่าย | P0 | Modal พร้อม Stripe checkout ใน < 3 clicks |

---

## 5. Feature Specifications

### 5.1 MVP (Phase 1 — 6 สัปดาห์)

#### F-001: Prompt Input & Generation
```
Component: PromptBar
- Textarea ขนาดใหญ่ placeholder: "อยากได้ web แบบไหน? เช่น 'landing page สำหรับ coffee shop สไตล์ minimal'"
- ปุ่ม Generate (disabled ถ้า prompt ว่าง)
- Character limit: 500 chars
- ส่ง POST /api/generate พร้อม { prompt, projectId?, previousFiles? }
```

#### F-002: AI Code Generation API
```
Endpoint: POST /api/generate
Input: { prompt: string, previousFiles?: FileSystemTree, iterationMode?: boolean }

System Prompt Strategy:
- Generate Vite + React + Tailwind project
- Output: JSON FileSystemTree เท่านั้น (ไม่มี explanation)
- Files ที่ต้องมีเสมอ: package.json, src/main.jsx, src/App.jsx, index.html
- ใช้ shadcn/ui components เมื่อเหมาะสม
- Iteration mode: รับ previousFiles + คำสั่งแก้ไข แล้ว return ไฟล์ที่เปลี่ยนเท่านั้น

Response: Server-Sent Events (streaming JSON chunks)
Error handling: timeout 45s, retry 1 ครั้ง
```

#### F-003: WebContainer Runtime
```
lib/webcontainer.ts — Singleton pattern

Lifecycle:
1. WebContainer.boot() — ครั้งเดียวต่อ browser session
2. wc.mount(FileSystemTree) — mount files
3. spawn('npm', ['install']) — รอ exit code 0
4. spawn('npm', ['run', 'dev']) — Vite dev server
5. on('server-ready') → set iframe src

Performance targets:
- boot(): < 2s
- npm install (cached): < 5s
- npm install (fresh): < 30s
- server-ready: < 5s หลัง install

Error handling:
- install exit code ≠ 0 → แสดง error + retry button
- server-ready timeout 60s → แสดง timeout message
```

#### F-004: Preview Panel
```
Component: PreviewPanel
Layout: Split view (50/50 default, resizable)
- Left: PromptBar + Chat history + Code view (toggle)
- Right: iframe preview + viewport toggle + URL bar

iframe attributes:
- sandbox="allow-scripts allow-same-origin allow-forms"
- src = WebContainer server URL

Viewport presets: Mobile (375px) | Tablet (768px) | Desktop (100%)
Refresh button: remount WebContainer files
```

#### F-005: Status & Progress UI
```
States: idle → generating → installing → starting → ready → error

Visual:
- Progress bar พร้อม step labels
- Terminal output (collapsed by default, expandable)
- Error state: friendly message + retry + "แก้ด้วย AI" button
```

#### F-006: Authentication
```
Provider: NextAuth.js v5
Methods: Google OAuth, Email magic link
Session: JWT, 30 วัน
Middleware: protect /app/* routes, redirect to /login
```

#### F-007: Usage Metering
```
Database: Table `generations` { id, userId, projectId, prompt, status, createdAt }
Logic:
- นับ generation เมื่อ status = 'success'
- Check limit ก่อน call AI API
- Free limit: 5/month, Pro: 50/month, Business: unlimited
- Reset วันที่ 1 ของเดือน
API middleware: checkGenerationLimit() ก่อน handler
```

### 5.2 Phase 2 (สัปดาห์ที่ 7-12)

| Feature | Description | Priority |
|---|---|---|
| F-010: Code Editor | Monaco Editor แสดง generated files, edit แล้ว hot-reload | P1 |
| F-011: Export | Download .zip (React project หรือ static HTML) | P1 |
| F-012: Project Dashboard | Grid view, search, sort, delete | P1 |
| F-013: Shareable Link | Public URL + Open Graph preview | P1 |
| F-014: Stripe Billing | Subscription management, upgrade/downgrade | P1 |
| F-015: Template Gallery | Starter templates (landing page, dashboard, portfolio) | P2 |
| F-016: Version History | ย้อนกลับ generation เก่าๆ | P2 |
| F-017: Custom Domain | Paid user map custom domain ไปที่ shared demo | P3 |

---

## 6. Technical Architecture

### 6.1 Directory Structure
```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── layout.tsx
│   ├── (app)/
│   │   ├── layout.tsx              ← auth guard
│   │   ├── page.tsx                ← dashboard
│   │   └── project/[id]/page.tsx  ← editor + preview
│   ├── api/
│   │   ├── generate/route.ts       ← POST: AI generation
│   │   ├── projects/route.ts       ← CRUD projects
│   │   └── usage/route.ts          ← GET current usage
│   └── layout.tsx
├── components/
│   ├── PromptBar.tsx
│   ├── PreviewPanel.tsx
│   ├── StatusBar.tsx
│   ├── CodeEditor.tsx              ← Monaco wrapper
│   ├── ViewportToggle.tsx
│   └── UpgradeModal.tsx
├── lib/
│   ├── webcontainer.ts             ← singleton boot + run
│   ├── anthropic.ts                ← streaming generate
│   ├── usage.ts                    ← check + increment
│   └── db.ts                       ← Prisma client
└── middleware.ts                   ← auth + CORS headers
```

### 6.2 Database Schema (Prisma)
```prisma
model User {
  id           String   @id @default(cuid())
  email        String   @unique
  name         String?
  plan         Plan     @default(FREE)
  stripeId     String?
  createdAt    DateTime @default(now())
  projects     Project[]
  generations  Generation[]
}

model Project {
  id          String   @id @default(cuid())
  name        String   @default("Untitled")
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  files       Json?    // FileSystemTree snapshot
  shareToken  String?  @unique
  isPublic    Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  generations Generation[]
}

model Generation {
  id        String   @id @default(cuid())
  userId    String
  projectId String
  prompt    String
  status    String   // pending | success | error
  tokens    Int?
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id])
  project   Project  @relation(fields: [projectId], references: [id])
}

enum Plan {
  FREE
  PRO
  BUSINESS
}
```

### 6.3 API Contracts

**POST /api/generate**
```typescript
// Request
{
  prompt: string            // max 500 chars
  projectId?: string        // ถ้าเป็น iteration บน existing project
  previousFiles?: object    // FileSystemTree จาก snapshot ล่าสุด
  iterationMode?: boolean   // true = แค่แก้ไม่ต้อง regenerate ทั้งหมด
}

// Response: Server-Sent Events
// event: chunk → data: { type: 'delta', content: string }
// event: done  → data: { type: 'done', files: FileSystemTree }
// event: error → data: { type: 'error', message: string }
```

**GET /api/usage**
```typescript
// Response
{
  plan: 'FREE' | 'PRO' | 'BUSINESS'
  used: number
  limit: number | null    // null = unlimited
  resetDate: string       // ISO date
}
```

### 6.4 System Prompt (Claude)
```
You are a web application generator for non-technical users.

Rules:
1. Output ONLY a valid JSON object in FileSystemTree format — no explanation, no markdown
2. Always create a Vite + React 18 + Tailwind CSS project
3. Required files: package.json, index.html, src/main.jsx, src/App.jsx, src/index.css
4. Use shadcn/ui components when appropriate (import from CDN via unpkg is NOT allowed — must be proper npm)
5. Make the UI beautiful, responsive, and production-quality
6. For Thai language prompts: generate content in Thai, use Thai-friendly fonts (Sarabun from Google Fonts)
7. Never generate files that require backend API (no fetch to external APIs unless specified)
8. Keep total file size under 100KB

FileSystemTree format:
{
  "package.json": { "file": { "contents": "..." } },
  "src/App.jsx": { "file": { "contents": "..." } },
  "src": { "directory": { "App.jsx": { "file": { "contents": "..." } } } }
}
```

---

## 7. UI/UX Requirements

### 7.1 Design Principles
- **Minimal friction**: ไม่มี modal หรือ setup wizard ก่อนเริ่ม generate
- **Real-time feedback**: แสดง progress ทุก step ไม่ปล่อยให้ user นั่งงง
- **Mobile-first**: editor ใช้ได้บน tablet (iPad landscape)
- **Error recovery**: ทุก error state มี actionable button

### 7.2 Layout Specification
```
Main Editor Page (desktop):
┌─────────────────────────────────────────────┐
│ Header: Logo | Project name (editable) | ... │
├──────────────┬──────────────────────────────┤
│              │                              │
│  Left Panel  │      Preview iframe          │
│  (380px)     │      (flex-1)                │
│              │                              │
│  PromptBar   │  [Mobile][Tablet][Desktop]   │
│  ─────────   │  ─────────────────────────   │
│  Chat msgs   │  <iframe>                    │
│  ─────────   │                              │
│  [Code view] │                              │
└──────────────┴──────────────────────────────┘
│ StatusBar: step indicators + terminal toggle │
└─────────────────────────────────────────────┘
```

### 7.3 Key Interactions
- Enter key ใน PromptBar → Generate (Shift+Enter = newline)
- Drag divider ระหว่าง panels
- Escape key → cancel generation (ถ้ายังอยู่ใน generating state)
- Cmd/Ctrl+Z → undo ล่าสุด

---

## 8. Non-functional Requirements

### 8.1 Performance
| Metric | Target |
|---|---|
| Time to first meaningful preview | ≤ 90 วินาที (cold start) |
| Iteration (แค่แก้ files) | ≤ 30 วินาที |
| Page load (LCP) | ≤ 2.5s |
| npm install (cached packages) | ≤ 8 วินาที |

### 8.2 Security
- ไม่เก็บ API key ฝั่ง client เด็ดขาด
- WebContainer sandbox ป้องกัน XSS จาก generated code
- Rate limit: 10 req/min per IP บน /api/generate
- Input sanitize ก่อนส่ง Claude
- HTTPS only, HSTS header

### 8.3 Scalability
- Stateless API routes → scale ด้วย Vercel auto-scaling
- WebContainer รันใน user's browser → ไม่กิน server resource
- Database connection pool via Prisma Accelerate

### 8.4 Availability
- Target uptime: 99.5%
- Graceful degradation: ถ้า Claude API down → แสดง maintenance message อย่างสง่าผ่าเผย
- WebContainer fallback: ถ้า browser ไม่รองรับ → แสดง static code ใน syntax highlighter

---

## 9. Spec-to-Demo Feature (Preset Question Flow)

### 9.1 Overview

นอกจาก free-text prompt แล้ว ผู้ใช้สามารถอัปโหลด BRD + PRD แล้วให้ระบบถามคำถามที่เจาะจงตาม domain ก่อน generate demo โดยอัตโนมัติ ทำให้ output ตรงกับ business requirement จริงๆ ไม่ใช่แค่ generic template

```
อัปโหลด BRD + PRD
       ↓
Auto-detect preset (หรือเลือกเอง)
       ↓
Preset Question Flow (3-5 คำถาม step-by-step)
       ↓
Context Builder รวม: docs + answers → rich system prompt
       ↓
Claude generate demo ที่ตรงกับ spec
       ↓
WebContainers preview
```

### 9.2 Document Input (F-020)

```
Component: DocInputPanel
Modes:
  - Paste text (BRD และ PRD แยก textarea)
  - Upload file (.md, .txt, .pdf — extract text)
  - URL (fetch markdown จาก Notion/Confluence public page)

Validation:
  - ต้องมีอย่างน้อย 1 document (BRD หรือ PRD)
  - Max 50,000 chars ต่อ document
  - แสดง char count และ warning เมื่อใกล้ limit
```

### 9.3 Auto-detect Preset (F-021)

```
Endpoint: POST /api/detect-preset
Input: { documentText: string }  // BRD + PRD รวมกัน (first 3,000 chars)

System prompt:
  "Detect document domain. Reply with ONLY one word:
   erp | crm | ecommerce | dashboard | booking | landing | saas | other"

Response: { presetId: string, confidence: 'high' | 'low' }

UX:
  - confidence=high → แสดง "ดูเหมือนจะเป็น ERP — ใช่ไหม?" พร้อม confirm/change button
  - confidence=low  → แสดง preset selector ให้เลือกเอง
  - เสมอมี option "เลือก preset เอง" ให้ override
```

### 9.4 Preset Definitions (F-022)

แต่ละ preset มี id, keywords สำหรับ auto-detect, และชุดคำถามที่เจาะจง domain นั้น

**Preset: ERP**

| # | คำถาม | Type | Options |
|---|---|---|---|
| 1 | โมดูลหลักที่ต้องการใน demo? | multi | Finance, HR, คลังสินค้า, จัดซื้อ (PR→PO), การผลิต, รายงาน |
| 2 | User roles ใน system? | multi | Admin, Manager, พนักงาน, CFO, Auditor |
| 3 | Workflow หลักที่ต้องเห็น? | single | PR→PO→GR→Invoice / Leave→Approval / Stock in/out / Custom |
| 4 | KPI หลักบน dashboard? | text | (free text — ดึงจาก PRD ถ้ามี) |

**Preset: CRM**

| # | คำถาม | Type | Options |
|---|---|---|---|
| 1 | Sales pipeline stages? | text | e.g. Lead → Qualified → Proposal → Won/Lost |
| 2 | Features ที่ต้องแสดง? | multi | Contact list, Deal kanban, Activity timeline, Email log, Reports |
| 3 | ประเภท customer หลัก? | single | B2B / B2C / Both |

**Preset: E-commerce**

| # | คำถาม | Type | Options |
|---|---|---|---|
| 1 | ประเภทสินค้า? | single | Physical / Digital / Service |
| 2 | หน้าหลักที่ต้องการ? | multi | Homepage, Product listing, Product detail, Cart, Checkout, Order tracking |
| 3 | สไตล์? | single | Minimal, Luxury/Premium, Marketplace, ตาม brand guideline ใน PRD |

**Preset: Dashboard / Analytics**

| # | คำถาม | Type | Options |
|---|---|---|---|
| 1 | ข้อมูลหลักที่แสดง? | multi | Sales, Finance, Operations, Marketing, HR, Custom |
| 2 | Chart types ที่ต้องการ? | multi | Bar, Line, Pie/Donut, KPI cards, Table, Map |
| 3 | Time filter? | single | Daily / Weekly / Monthly / Custom range |
| 4 | KPIs หลัก? | text | (free text) |

**Preset: Booking System**

| # | คำถาม | Type | Options |
|---|---|---|---|
| 1 | ประเภทการจอง? | single | Appointment, Room/Hotel, Event ticket, Restaurant table |
| 2 | Flow การจอง? | single | Calendar pick → form → confirm / List → detail → book |
| 3 | Roles? | multi | Customer, Staff, Admin |

**Preset: Landing Page**

| # | คำถาม | Type | Options |
|---|---|---|---|
| 1 | เป้าหมายหลักของ page? | single | Lead gen, Product launch, Event reg, App download |
| 2 | Sections ที่ต้องการ? | multi | Hero, Features, Pricing, Testimonials, FAQ, CTA, Footer |
| 3 | สไตล์? | single | Minimal/Clean, Bold/Startup, Corporate, Creative |

### 9.5 Question Flow UX (F-023)

```
Component: QuestionFlow
Design: Step-by-step เหมือน Typeform — ทีละ 1 คำถาม ไม่ใช่ form ยาว

States:
  idle       → แสดง preset selector
  detecting  → spinner "กำลังอ่านเอกสาร..."
  confirmed  → แสดงชื่อ preset + เริ่ม questions
  answering  → แสดงคำถามทีละข้อ พร้อม progress dots
  done       → summary ของ answers + "Generate Demo" button

Keyboard:
  Enter → next question (single/text)
  Space → toggle multi-select option
  Escape → back to previous question

Skip logic:
  ถ้าคำตอบ mention อยู่ใน PRD แล้ว → pre-fill และ skip ได้
  (Claude extract จาก doc ก่อนแสดง question)
```

### 9.6 Context Builder (F-024)

```typescript
// lib/context-builder.ts

buildSystemPrompt(brd, prd, preset, answers) → string

Output structure:
  [1] Business Requirements (BRD excerpt — key sections)
  [2] Product Requirements (PRD excerpt — features + tech stack)
  [3] Domain: {preset.name}
  [4] Clarifications:
        {question 1} → {answer}
        {question 2} → {answer}
        ...
  [5] Generation rules (output format, tech stack, UI language)

Token budget: ≤ 8,000 tokens (BRD+PRD truncate intelligently — keep headings + key sections)
Truncation strategy: Claude-assisted summarize ถ้า doc ยาวเกิน
```

### 9.7 New API Routes

| Route | Method | Description |
|---|---|---|
| `/api/detect-preset` | POST | รับ doc text → return presetId |
| `/api/extract-answers` | POST | รับ doc + questions → pre-fill answers จาก doc |
| `/api/generate` | POST | เพิ่ม param: `brd?`, `prd?`, `presetId?`, `presetAnswers?` |

### 9.8 New Files

```
lib/
  presets.ts          ← preset definitions (questions, keywords)
  context-builder.ts  ← buildSystemPrompt() function
components/
  DocInputPanel.tsx   ← BRD + PRD textarea / upload
  PresetSelector.tsx  ← grid of preset cards
  QuestionFlow.tsx    ← step-by-step question UI
  AnswerSummary.tsx   ← review answers ก่อน generate
```

---

## 10. Acceptance Criteria

### Sprint 1 Acceptance (MVP Core)
- [ ] User สมัครและ login ด้วย Google ได้
- [ ] User พิมพ์ prompt และ Generate button ใช้งานได้
- [ ] AI generate FileSystemTree ภายใน 45 วินาที (p95)
- [ ] WebContainer boot และแสดง Vite app ใน iframe ได้
- [ ] Progress states ทั้งหมดแสดงถูกต้อง
- [ ] Free limit 5 generations/เดือนทำงานถูกต้อง
- [ ] UpgradeModal แสดงเมื่อถึง limit

### Sprint 2 Acceptance (Sharing & Projects)
- [ ] บันทึก project ได้
- [ ] Share link ทำงานโดยไม่ต้อง login
- [ ] Viewport toggle ทำงาน (375/768/1440)
- [ ] Iteration (แก้ด้วยภาษาธรรมดา) ทำงานถูกต้อง

### Sprint 3 Acceptance (Billing)
- [ ] Stripe checkout ทำงาน
- [ ] Plan upgrade เปลี่ยน limit ทันที
- [ ] Export code ดาวน์โหลด .zip ได้

### Sprint 4 Acceptance (Spec-to-Demo)
- [ ] User paste BRD + PRD แล้วระบบ detect preset ได้ถูกต้อง ≥ 80%
- [ ] QuestionFlow แสดงคำถามทีละข้อ และ pre-fill จาก doc ได้
- [ ] Context builder รวม docs + answers เป็น system prompt ≤ 8,000 tokens
- [ ] Generated demo มี UI ที่ตรงกับ domain (ERP ไม่ได้ออกมาเหมือน landing page)
- [ ] User สามารถ override preset และเริ่ม question flow ใหม่ได้

---

## 10. Roadmap

```
Phase 1 — MVP (สัปดาห์ 1-6)
├── Week 1-2: Setup + Auth + DB schema
├── Week 3-4: AI generation + WebContainer integration
├── Week 5: Preview panel + Status UI + Error handling
└── Week 6: Usage metering + Free tier limit + Soft launch

Phase 2 — Growth (สัปดาห์ 7-12)
├── Week 7-8: Project dashboard + Save/Load
├── Week 9:   Sharing + Public URL
├── Week 10:  Stripe billing + Pro plan
├── Week 11:  Code editor (Monaco) + Export
├── Week 11:  Spec-to-Demo — DocInput + Auto-detect preset
└── Week 12:  QuestionFlow UI + Context builder + Template gallery

Phase 3 — Scale (เดือนที่ 4-6)
├── Team workspace (Business plan)
├── Version history
├── Custom domain
└── API access (สำหรับ developer ที่อยาก integrate)
```
