# FITT Builder — AI-Powered Web Demo Builder

พิมพ์ prompt ภาษาไทยหรืออังกฤษ → ได้ web demo ที่รันจริงใน browser ภายใน ~60 วินาที
สำหรับ designer, PM และทุกคนที่ไม่เขียนโค้ด (ตาม `docs/brief-plans/BRD.md` + `PRD.md`)

## Quick start

1. ขอ API key ฟรีจาก [Google AI Studio](https://aistudio.google.com/apikey)
2. ใส่ key ใน `.env.local`:

   ```bash
   GEMINI_API_KEY=your-key-here
   ```

3. รัน:

   ```bash
   npm install
   npm run dev
   ```

4. เปิด http://localhost:3000 ด้วย **Chrome หรือ Edge** (live preview ต้องการ
   cross-origin isolation ซึ่ง Safari ยังไม่รองรับ WebContainers เต็มรูปแบบ)

## How it works

```
prompt / BRD+PRD ─→ POST /api/generate (Gemini, SSE streaming)
                         │  JSON { note, files{path→contents}, deleted[] }
                         ▼
              WebContainer (รันใน browser ผู้ใช้)
              mount → npm install → vite --host → server-ready
                         ▼
                  <iframe> live preview
```

- **Generation** — Gemini สร้างโปรเจกต์ Vite + React 18 (deps แค่ react/react-dom/vite
  เพื่อให้ `npm install` เร็ว; Tailwind โหลดผ่าน browser build ใน index.html)
- **Iteration** — ส่งเฉพาะไฟล์ที่เปลี่ยน แล้ว hot-write เข้า container (Vite HMR)
- **Spec-to-Demo** — วาง BRD/PRD → auto-detect preset (ERP/CRM/E-commerce/Dashboard/
  Booking/Landing) → คำถาม 3-5 ข้อแบบ Typeform (pre-fill จากเอกสาร) → context builder
  รวมทุกอย่างเป็น system prompt
- **Share** — team sharing (link + email invites, viewer/editor role) ผ่าน `/project/[id]/share`;
  `/changelog` page แสดง build history พร้อม badge แจ้ง unread turns
- **Persistence** — Supabase (Postgres + RLS); forced login — โปรเจกต์ + undo history +
  chat history เก็บใน cloud; ไม่ใช้ localStorage แล้ว
- **Export** — ดาวน์โหลด .zip รันต่อได้ด้วย `npm install && npm run dev`

## Key paths

| Path | What |
|---|---|
| `app/api/generate/route.ts` | SSE generation endpoint (zod validation, 10 req/min/IP, retry 1 ครั้ง) |
| `app/api/interview/route.ts` | Define Phase — AI สัมภาษณ์ → IDEA → BRD → PRD (ดู `docs/brief-plans/define-phase.md`) |
| `app/api/detect-preset`, `app/api/extract-answers` | Spec-to-Demo (PRD §9) |
| `app/webcontainer/connect/[id]` | Bridge สำหรับเปิด preview ในแท็บใหม่ (`setupConnect`) |
| `lib/prompts.ts` | System prompts + template package.json ของ demo |
| `lib/webcontainer.ts` | WebContainer singleton: boot/mount/install/dev-server |
| `lib/files.ts` | Parse/validate model output, path-safety, FileSystemTree |
| `components/studio/` | Split-view editor: chat, preview, Monaco, status bar |
| `next.config.ts` | COOP/COEP headers (จำเป็นสำหรับ WebContainers) |
| `docs/brief-plans/design.md` | Design system ("midnight studio" theme) |

## Environment

| Var | Required | Default | Notes |
|---|---|---|---|
| `GEMINI_API_KEY` (หรือ `GOOGLE_API_KEY`) | ✅ | — | |
| `GEMINI_MODEL` | — | `gemini-2.5-flash` | |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | — | inlined at build time — ต้องตั้งก่อน `next build` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | — | inlined at build time — ต้องตั้งก่อน `next build` |
| `SUPABASE_SERVICE_ROLE_KEY` | — | — | reserved for future admin use (not currently required) |
| `DMAIL_API_KEY` | ✅ | — | server-only (transactional email สำหรับ team invites) |

> **Build note:** `NEXT_PUBLIC_SUPABASE_*` ถูก inline เข้า bundle ตอน `next build` —
> ถ้าไม่ตั้งค่าไว้ prerender `/login` จะ fail ด้วย "supabaseUrl is required"

## Commands

```bash
npm run dev      # dev server (Turbopack)
npm run build    # production build
npm run lint     # ESLint
npx tsc --noEmit # typecheck
```

## Setup (Supabase)

1. สร้าง Supabase project ที่ https://supabase.com
2. ตั้งค่า env vars ทั้ง 4 ตัว (ดูตาราง Environment ด้านบน) — `NEXT_PUBLIC_*` ต้องมีก่อน `next build`
3. เปิด Auth providers: **Google** และ **Email** (magic link) → ตั้ง redirect URL เป็น `<your-domain>/auth/callback`
4. รัน migration: `psql $DATABASE_URL -f supabase/migrations/0001_init.sql`
   (สร้างตาราง `fittbuilder_*` พร้อม RLS policies ทั้งหมด)

## Production checklist (Auth + DB เสร็จแล้ว — ที่เหลือตาม PRD Phase 1-2)

ระบบที่เหลือยังไม่ implement เพราะต้องการ infrastructure เพิ่ม:

- [x] **Auth** — Supabase Auth (Google OAuth + magic link) + protect `/project/*`
- [x] **Database** — Supabase Postgres + RLS (ตาราง prefix `fittbuilder_`) แทน localStorage
- [ ] **Usage metering** — ตาราง `generations` + เช็ค limit ก่อนเรียก AI (Free 5/เดือน)
      ตอนนี้มีแค่ rate limit ต่อ IP
- [ ] **Stripe billing** — checkout + webhook อัปเดต plan
- [ ] **Rate limiter แบบ distributed** — `lib/rate-limit.ts` เป็น in-memory ต่อ instance;
      ใช้ Upstash Redis เมื่อ deploy หลาย instance
- [ ] **WebContainers commercial license** — จำเป็นสำหรับ production
      (https://webcontainers.io/enterprise)
- [ ] Share link หมดอายุ 30 วันสำหรับ free tier (ตอนนี้ join token ไม่หมดอายุ; invite token หมดอายุ 14 วัน)
- [ ] Real-time co-editing (CRDT) — Spec 2 (ตอนนี้แชร์เป็น async, last-write-wins)

## Deploy

Vercel แนะนำ (รองรับ COOP/COEP headers ตาม `next.config.ts` อัตโนมัติ) —
ตั้ง `GEMINI_API_KEY` ใน project env vars
