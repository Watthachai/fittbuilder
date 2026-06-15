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
- **Share** — โปรเจกต์ถูกบีบอัด (deflate) แล้วเข้ารหัสใน URL fragment — เปิดดูได้โดย
  ไม่ต้อง login และไม่ต้องมี database (`/share#...`)
- **Persistence** — localStorage (โปรเจกต์ + undo history 10 ขั้น + chat history)
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

| Var | Required | Default |
|---|---|---|
| `GEMINI_API_KEY` (หรือ `GOOGLE_API_KEY`) | ✅ | — |
| `GEMINI_MODEL` | — | `gemini-2.5-flash` |

## Commands

```bash
npm run dev      # dev server (Turbopack)
npm run build    # production build
npm run lint     # ESLint
npx tsc --noEmit # typecheck
```

## Production checklist (ยังไม่ได้ทำ — ตาม PRD Phase 1-2)

ระบบเหล่านี้ออกแบบ interface รองรับไว้แล้วแต่ยังไม่ implement เพราะต้องการ
infrastructure เพิ่ม:

- [ ] **Auth** — NextAuth v5 (Google OAuth + magic link) + protect `/project/*`
- [ ] **Database** — Prisma + PostgreSQL แทน localStorage (schema อยู่ใน PRD §6.2);
      เปลี่ยน `lib/storage.ts` เป็น API calls
- [ ] **Usage metering** — ตาราง `generations` + เช็ค limit ก่อนเรียก AI (Free 5/เดือน)
      ตอนนี้มีแค่ rate limit ต่อ IP
- [ ] **Stripe billing** — checkout + webhook อัปเดต plan
- [ ] **Rate limiter แบบ distributed** — `lib/rate-limit.ts` เป็น in-memory ต่อ instance;
      ใช้ Upstash Redis เมื่อ deploy หลาย instance
- [ ] **WebContainers commercial license** — จำเป็นสำหรับ production
      (https://webcontainers.io/enterprise)
- [ ] Share link หมดอายุ 30 วันสำหรับ free tier (ตอนนี้ลิงก์อยู่ใน URL ถาวร)

## Deploy

Vercel แนะนำ (รองรับ COOP/COEP headers ตาม `next.config.ts` อัตโนมัติ) —
ตั้ง `GEMINI_API_KEY` ใน project env vars
