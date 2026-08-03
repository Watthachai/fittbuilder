# FITT Builder — Jira backlog (รอบ v0.43.0 → v0.44.1)

| | |
|---|---|
| ช่วงงาน | 2026-07-24 → 2026-07-30 |
| Branch | `feat/domain-skill-templates` |
| Deploy | `c21d93f` — ขึ้น `dev` (UAT `fitt-builder-sandbox`) และ `main` (prod `fitt-builder`) แล้ว |
| Release | v0.43.0, v0.44.0, v0.44.1 |
| จำนวน commit | 14 |
| สถานะรวม | ทุกงานในเอกสารนี้ **Done** (ผ่าน gate: `tsc` · `eslint` · `vitest` · `next build` และ deploy ขึ้น prod แล้ว) |

> วิธีใช้: หัวข้อ `###` = Task (หรือ Bug), bullet ใต้ **Subtasks** = Sub-task ใน Jira · ท้ายเอกสารมีตาราง CSV สำหรับ bulk import

---

## EPIC 1 — FITT Consult (โมดูลที่ปรึกษาธุรกิจ, alpha)

**Epic goal:** แยก "ที่ปรึกษาธุรกิจ" ออกจากหน้าจัดการ Workspace ให้เป็นระบบของตัวเอง มี landing + แอปของตัวเอง และเพิ่มเลนส์วิเคราะห์ใหม่ "ตรวจสุขภาพธุรกิจ 5 ด้าน"

### FB-1 · FITT Consult เป็นระบบแยก + Business Health Check 5 ด้าน
- **Type:** Story · **Status:** Done · **Commit:** `c3c83c4` · **Release:** v0.43.0
- **คำอธิบาย:** สร้าง product surface ใหม่ `/consult/app` ที่ใช้ข้อมูลจริงขององค์กร (พิมพ์/แนบไฟล์ รวม Excel) แล้วเลือกเลนส์วิเคราะห์ได้ 2 แบบ พร้อมเก็บทุกผลเป็นประวัติของทีมเพื่อเทียบรอบต่อรอบ
- **Subtasks:**
  - DB: migration `0023_advisor_reports.sql` — ตาราง `fittbuilder_advisor_reports` (org_id, kind, result jsonb, created_by) + RLS gate ตามสมาชิกองค์กร + index; backfill ผลเดิมจาก `orgs.pain_radar`
  - Engine: `lib/advisor-health.ts` — 5 ด้าน (กระแสเงินสด · โครงสร้างกำไรแยกส่วนลด · ยอดขาย · หนี้สิน-ลูกหนี้ · คนและพลังองค์กร), คะแนน 0-100, สถานะ แข็งแรง/เฝ้าระวัง/วิกฤต, อ้างอิงที่มา, ระบุชัดเมื่อข้อมูลไม่พอ
  - API: `app/api/advisor-health/route.ts` (kind `health_check`) + ย้าย `/api/org-advisor` มาเขียนลงตารางประวัติ
  - UI: `ConsultShell` — เลือก org, input hub รองรับ drag-drop, การ์ดเลนส์ 2 ใบ, ประวัติพร้อมลูกศรเทียบรอบก่อน + ชื่อผู้รัน + ลบได้
  - UI: `HealthCheckResult` — คะแนนรวม, แถวรายด้าน, ปุ่ม "ที่มา" เปิด SourceViewer, ข้อเสนอแบบ human-in-the-loop
  - คงหน้าเดิม: "หา Pain Point" ในหน้า Workspace ยังอยู่ และอ่านผลล่าสุดจากตารางประวัติเดียวกัน
- **AC:**
  - รันเลนส์ไหนก็ได้แล้วผลถูกบันทึกเป็นแถวใหม่ (ไม่ทับของเก่า) และสมาชิกคนอื่นในองค์กรเห็นด้วย
  - คนนอกองค์กรเรียก API ตรงๆ ไม่ได้ (RLS)
  - หน้า Workspace ยังหา Pain Point ได้เหมือนเดิม และผลตรงกับที่เห็นใน `/consult/app`

### FB-2 · เมนู FITT Consult (ALPHA) ใน top nav — เห็นเฉพาะ admin
- **Type:** Story · **Status:** Done · **Commit:** `f8ff6eb`
- **คำอธิบาย:** เอาเมนู "ราคา" ออกจาก top nav แทนที่ด้วยเมนู FITT Consult ติดป้าย ALPHA และเพิ่มทางเข้าในเมนูบัญชี — แสดงเฉพาะ admin ระหว่างช่วงทดสอบ
- **Subtasks:**
  - `MainframeHero` — nav desktop + mobile, ตรวจสิทธิ์ผ่าน `/api/me`
  - `AccountMenu` — เมนูเข้าระบบ Consult (ไอคอน Stethoscope)
- **AC:** ผู้ใช้ทั่วไปไม่เห็นเมนูนี้ · admin เห็นพร้อมป้าย ALPHA · เมนู "ราคา" หายจาก nav

### FB-3 · Landing page `/consult` ตาม blueprint + rebrand เป็น FITT Consult
- **Type:** Story · **Status:** Done · **Commit:** `d4ad347` · **Release:** v0.43.0
- **คำอธิบาย:** หน้า marketing ของ Consult ตามแบบที่ลูกค้าให้มา (ธีมสว่าง #0084FF, ฟอนต์ Outfit/Fustat, liquid-glass nav, วิดีโอโรบอต, floating badge 3 ใบพร้อม motion) และเปลี่ยนชื่อจาก "FITT Advisor" เป็น "FITT Consult" ทั้งระบบ
- **Subtasks:**
  - `app/consult/page.tsx` — server page + โหลดฟอนต์ผ่าน `next/font` เป็น CSS variable
  - `components/consult/ConsultLanding.tsx` — hero, badges, motion ตามสเปก
  - เปลี่ยนชื่อ route/คอมโพเนนต์ `advisor` → `consult` (engine ภายในยังใช้ชื่อ advisor)
- **AC:** เปิด `/consult` แล้วได้หน้าตามแบบ · ปุ่ม CTA เข้าสู่ `/consult/app` ได้ · ไม่มีคำว่า "Advisor" โผล่ใน UI ผู้ใช้
- **หมายเหตุ (deviation ที่แจ้งลูกค้าแล้ว):** ใช้ป้าย alpha ตามจริงแทนตัวเลข "10,000+ users" ที่ blueprint ให้มา และพาดหัวเป็นภาษาอังกฤษเพราะ tracking -3px ทำให้สระ/วรรณยุกต์ไทยแตก

### FB-4 · Landing รองรับโหมดสว่าง/มืดของแอป
- **Type:** Bug · **Status:** Done · **Commit:** `b548865`
- **คำอธิบาย:** หน้า `/consult` ถูกออกแบบเป็นธีมสว่างตายตัว ทำให้ผู้ใช้ที่ตั้งค่าโหมดมืดเจอหน้าจอขาวจ้าและสลับธีมไม่ได้
- **Subtasks:** เพิ่ม `@custom-variant dark` ใน `globals.css` ให้ utility `dark:` ผูกกับคลาส `.light`/`.dark` + system fallback · ใส่ dark variant ครบทุก section ของ landing
- **AC:** สลับธีมจากปุ่มในแอปแล้วหน้า `/consult` เปลี่ยนตามทันที ทั้งกรณีตั้งค่าเองและตามเครื่อง

### FB-5 · ไอคอนแอปลอยเหนือหัวโรบอตพร้อมอนิเมชัน
- **Type:** Story · **Status:** Done · **Commit:** `9f43065`
- **AC:** ไอคอนลอยอยู่เหนือหัวโรบอต ขยับ bob + เอียงเบาๆ ต่อเนื่อง และเคารพ `prefers-reduced-motion`

### FB-6 · ดาร์กโหมด: การ์ดวิดีโอโรบอตกลืนกับพื้นหลัง
- **Type:** Bug · **Status:** Done · **Commits:** `39ce693`, `f5c50f3`, `2b47b9c`, `858a563`, `bfcd736`
- **คำอธิบาย:** วิดีโอโรบอตมีพื้นหลังขาวติดมาในไฟล์ ทำให้ในโหมดมืดเห็นเป็นกล่องขาวลอยตัดกับพื้นดำ
- **Subtasks:**
  - ทำให้ขาวของวิดีโอ fade ออกสู่พื้นหลัง (เฉพาะโหมดมืด) — `39ce693`, `f5c50f3`
  - แก้ floating badge อ่านไม่ออกเมื่อทับการ์ดขาว → เปลี่ยนเป็นกระจกฝ้าทึบ + เงาแยกตามธีม — `2b47b9c`
  - เพิ่มออร่าขาวรอบขอบการ์ดแบบใหญ่/เนียน (2 เลเยอร์ blur) — `858a563`
  - **Root cause fix:** ออร่าโผล่แล้วหายหลังอนิเมชันเข้าจบ — motion ถอด inline transform ทิ้งเมื่อ entrance จบ → stacking context สลาย → เลเยอร์ `-z-10` ตกไปหลังพื้นหลังหน้า แก้ด้วย `isolate` — `bfcd736`
- **AC:** ในโหมดมืด การ์ดวิดีโอกลืนกับพื้นหลัง ออร่าอยู่ครบตลอด (ทั้งก่อนและหลังอนิเมชัน) และตัวหนังสือบน badge อ่านออกทุกใบ

---

## EPIC 2 — คุณภาพโค้ดที่ AI สร้าง (Codegen quality)

**Epic goal:** โค้ดที่ AI สร้างต้องอ่านได้ แก้ได้ และไม่พังทั้งแอปเพราะจุดเดียว

### FB-7 · AI สร้างโครงสร้างไฟล์แบบโปรเจกต์จริง ไม่กองใน App.tsx
- **Type:** Story · **Status:** Done · **Commit:** `72d7bfb` · **Release:** v0.44.0
- **ปัญหาที่พบจากผู้ใช้จริง:** `src/App.tsx` โตถึง 2,628 บรรทัด → แก้ 1 ครั้งต้องเขียนทับทั้งไฟล์ (~30k tokens จากเพดาน 65k) → ถูกตัดกลาง template string → babel พังทั้งไฟล์ และ AI เสียหลายเทิร์นไล่หาวงเล็บ
- **Root cause:** `buildIterationSystemPrompt` ไม่มีกฎโครงสร้างเลย (มีเฉพาะตอน build ครั้งแรก) ทุกเทิร์นที่ผู้ใช้สั่งแก้จึงไม่มีแรงกดดันให้แตกไฟล์ + ไม่มี feedback ว่าไฟล์ใหญ่แค่ไหน
- **Subtasks:**
  - นิยาม ARCHITECTURE contract (`src/pages`, `components/ui|layout|<feature>`, `hooks`, `data`, `lib`, `types.ts`; App.tsx = shell ≤120 บรรทัด; ทุกไฟล์ ≤200 บรรทัด; 1 ไฟล์ = 1 component) และใส่ทั้ง build + iteration prompt
  - เพิ่ม iteration rule: แตกไฟล์ระหว่างทาง (extract เฉพาะส่วนที่แก้) ห้ามยกโค้ดกลับเข้า App.tsx
  - `lib/code-health.ts` — วัดไฟล์ที่เกินกำหนด + ป้อนจำนวนบรรทัดจริงกลับเข้า prompt ทุกเทิร์น (STRUCTURE DEBT)
  - `CodePanel` — แถบเตือนไฟล์ยาวเกิน + ปุ่ม "✦ จัดโครงสร้างใหม่" สั่ง refactor แบบไม่เปลี่ยนพฤติกรรม
  - Unit tests: `lib/__tests__/code-health.test.ts` (5 เคส)
- **AC:**
  - สร้าง demo ใหม่แล้วได้ 12-30 ไฟล์ตามผัง ไม่ใช่ไฟล์เดียว
  - โปรเจกต์ที่มีไฟล์เกิน 300 บรรทัดจะเห็นแถบเตือนในแท็บ Code และกดปุ่มเดียวให้ AI แตกไฟล์ได้ โดย UI/ฟีเจอร์เหมือนเดิม

### FB-8 · AI ติดตั้งไลบรารีที่แนะนำเองได้อย่างเชื่อถือได้
- **Type:** Story · **Status:** Done · **Commit:** `3755639` · **Release:** v0.44.0
- **Subtasks:**
  - ขยายแคตาล็อกที่ยืนยัน React 18 แล้วเป็น 6 ตัว: lucide-react, recharts, framer-motion, date-fns, clsx, sonner (ตรวจ peerDependencies จาก npm registry)
  - เขียนกฎชัดว่าแพ็กเกจติดตั้งเอง — ห้ามบอกผู้ใช้ให้ไปรัน `npm install` ห้ามเลี่ยงไปเขียนเองเพราะคิดว่าไม่มีไลบรารี และต้องประกาศ `<deps>` ในเทิร์นเดียวกับที่ import
  - ให้เส้นทาง iteration ได้แคตาล็อกนี้ด้วย (เดิมมีแค่ประโยคลอยๆ)
  - **Bug fix:** `newPackages()` — ข้ามแพ็กเกจที่ติดตั้งแล้ว (เดิมถูกเขียนทับเป็น `latest` เสี่ยงกระโดดข้ามเมเจอร์) และห้ามแตะ react/react-dom/vite/@vitejs/plugin-react ของ scaffold
  - Unit tests: `lib/__tests__/scaffold-deps.test.ts` (5 เคส)
- **AC:** สั่งงานที่ต้องใช้กราฟ/อนิเมชัน แล้ว terminal ขึ้น `+ ติดตั้ง: …` และ preview รันได้โดยผู้ใช้ไม่ต้องทำอะไร · สั่งแก้ซ้ำแล้วแพ็กเกจเดิมไม่ถูกติดตั้งใหม่/ไม่ reboot container โดยไม่จำเป็น

### FB-9 · [PROD] สั่งแก้แล้ว AI บอกว่าเรียบร้อย แต่ของจริงไม่เปลี่ยน
- **Type:** Bug · **Priority:** Highest · **Status:** Done · **Commit:** `c21d93f` · **Release:** v0.44.1
- **อาการ (ผู้ใช้จริงแจ้ง):** สั่ง "ลบเมนูงบประมาณ" 3 รอบ แชทขึ้นโค้ด JSON ดิบพร้อมข้อความว่าทำเรียบร้อยแล้ว แต่หน้าจอไม่เปลี่ยน — เสียโควตาทุกรอบ
- **Root cause:** system prompt มี output contract ขัดกัน 2 อัน — `agents/code-builder/SKILL.md` (ต่อหัวสุด) สั่ง "ตอบเป็น JSON object เดียว" ซึ่งเป็นซากของ contract ก่อนยุค streaming ขณะที่ OUTPUT FORMAT ท้าย prompt สั่งให้ส่งบล็อก `<file>` · โมเดลเก่าเชื่อคำสั่งท้าย โมเดลใหม่ (gemini-3.6-flash) เชื่อ persona → parser หาไฟล์ไม่เจอ → ไม่เขียนไฟล์ แต่ route เอา JSON ไปโชว์เป็นคำตอบซึ่งข้างในเขียนว่าสำเร็จ
- **Subtasks:**
  - เขียน persona `code-builder` ใหม่ให้ยึดบล็อก `<file>`/`<delete>` + ระบุผลเสียของการตอบ JSON
  - ล้างคีย์ JSON (`"files"`, `"deleted"`) ออกจาก ITERATION RULES และเพิ่ม rule 0 "ห้ามตอบ JSON" ใน OUTPUT FORMAT
  - `salvageJsonFiles()` — กู้ไฟล์จากคำตอบ JSON (รองรับทั้งแบบ array และ map, มี/ไม่มี fence), แสดง note ของโมเดลแทน JSON, `console.warn` ไว้ให้เห็นว่า drift
  - ลบซากโค้ดยุค JSON ที่ไม่มีใครเรียก: `parseGeneration`, `GenerationParseError`, `REQUIRED_FILES`, `mergeFiles`, type `GenerationResult` (94 บรรทัด)
  - Unit tests: `lib/__tests__/stream-parse.test.ts` (6 เคส รวม payload จริงจากหน้างาน)
- **AC:**
  - สั่งลบเมนูแล้วเห็นไฟล์วิ่งใน terminal (`📝 src/components/Sidebar.tsx`) และ preview เปลี่ยนจริง
  - ถ้าโมเดลยังตอบ JSON ไฟล์ต้องถูกเขียนลงโปรเจกต์ (กู้อัตโนมัติ) และไม่มี JSON ดิบโผล่ในแชท

---

## EPIC 3 — แพลตฟอร์ม AI & Release

### FB-10 · อัปเกรดโมเดลเป็น gemini-3.6-flash
- **Type:** Task · **Status:** Done · **Commit:** `3cf1018` · **Release:** v0.44.0
- **เหตุผล:** โมเดลใหม่เน้น code generation + agentic loop ซึ่งเป็นงานหลักของสตูดิโอ และค่า output ถูกลง
- **Subtasks:**
  - `lib/gemini.ts` — เปลี่ยน default model (env `GEMINI_MODEL` ยัง override ได้)
  - `lib/ai-usage.ts` — ใส่ราคาจริงจากหน้า pricing ($1.50 in / $7.50 out ต่อ 1M) + `DEFAULT_PRICE` เพื่อให้รายงาน admin ไม่ประเมินเกิน
  - `cloudbuild.sandbox.yaml` + `cloudbuild.production.yaml` — เปลี่ยน `_GEMINI_MODEL` ทั้ง UAT และ prod
  - `README.md` — ตาราง env เขียนค้างเป็น gemini-2.5-flash
  - ตรวจว่า Cloud Build trigger ไม่ได้ตั้ง `_GEMINI_MODEL` ทับ (ยืนยันแล้ว: ไม่มี)
- **AC:** `/admin/usage` แสดงว่าใช้โมเดล `gemini-3.6-flash` และค่าใช้จ่ายประมาณการคำนวณจากราคาใหม่

### FB-11 · Release v0.43.0 → v0.44.1 ขึ้น UAT และ Production
- **Type:** Task · **Status:** Done
- **Subtasks:**
  - Gate ก่อน deploy: `npx tsc --noEmit` · `npx eslint` · `npx vitest run` (58/58) · `npm run build`
  - Fast-forward `feat/domain-skill-templates` → `dev` (UAT sandbox) และ → `main` (prod) ผ่าน Cloud Build trigger
  - อัปเดต `lib/changelog.ts` (v0.44.0, v0.44.1) ให้ผู้ใช้อ่านได้ที่หน้า `/changelog`
- **AC:** ทั้ง 3 branch ชี้ commit เดียวกัน (`c21d93f`) และ Cloud Run ทั้งสอง environment รันเวอร์ชันใหม่

---

## ตารางสำหรับ bulk import (CSV)

```csv
Issue Type,Summary,Epic Link,Status,Priority,Labels,Commit
Epic,FITT Consult (โมดูลที่ปรึกษาธุรกิจ alpha),,Done,High,consult,
Story,FITT Consult เป็นระบบแยก + Business Health Check 5 ด้าน,FITT Consult,Done,High,consult;backend;ai,c3c83c4
Story,เมนู FITT Consult (ALPHA) ใน top nav เห็นเฉพาะ admin,FITT Consult,Done,Medium,consult;frontend,f8ff6eb
Story,Landing page /consult ตาม blueprint + rebrand,FITT Consult,Done,High,consult;frontend,d4ad347
Bug,Landing ไม่รองรับโหมดสว่าง/มืดของแอป,FITT Consult,Done,Medium,consult;frontend,b548865
Story,ไอคอนแอปลอยเหนือหัวโรบอตพร้อมอนิเมชัน,FITT Consult,Done,Low,consult;frontend,9f43065
Bug,ดาร์กโหมด: การ์ดวิดีโอโรบอตไม่กลืนกับพื้นหลัง,FITT Consult,Done,Medium,consult;frontend,bfcd736
Epic,คุณภาพโค้ดที่ AI สร้าง,,Done,High,codegen,
Story,AI สร้างโครงสร้างไฟล์แบบโปรเจกต์จริง ไม่กองใน App.tsx,คุณภาพโค้ดที่ AI สร้าง,Done,High,codegen;prompt,72d7bfb
Story,AI ติดตั้งไลบรารีที่แนะนำเองได้อย่างเชื่อถือได้,คุณภาพโค้ดที่ AI สร้าง,Done,Medium,codegen;prompt,3755639
Bug,[PROD] สั่งแก้แล้ว AI บอกว่าเรียบร้อย แต่ของจริงไม่เปลี่ยน,คุณภาพโค้ดที่ AI สร้าง,Done,Highest,codegen;prompt;incident,c21d93f
Epic,แพลตฟอร์ม AI & Release,,Done,Medium,platform,
Task,อัปเกรดโมเดลเป็น gemini-3.6-flash,แพลตฟอร์ม AI & Release,Done,Medium,platform;ai,3cf1018
Task,Release v0.43.0-v0.44.1 ขึ้น UAT และ Production,แพลตฟอร์ม AI & Release,Done,Medium,platform;release,c21d93f
```

---

## งานที่ค้าง / ตามต่อ (ยังไม่ได้ทำ — ใส่เป็น backlog ได้)

| Summary | Type | Priority | หมายเหตุ |
|---|---|---|---|
| ทดสอบ Business Health Check กับข้อมูลจริง แล้วจูน prompt | Task | High | ยังไม่เคยรันกับงบจริงของลูกค้า |
| ย้าย secret ใน Cloud Build trigger ไป Secret Manager | Task | High | ตอนนี้ `_GEMINI_API_KEY` / `_SUPABASE_SERVICE_ROLE_KEY` / `_FITTCORE_GATEWAY_API_KEY` เป็น substitution ธรรมดา อ่านได้จาก UI + build metadata |
| จำกัดหน้า `/consult` และ `/consult/app` ให้ admin เท่านั้น (page gate) | Task | Medium | ตอนนี้ซ่อนแค่เมนู ถ้ารู้ URL ยังเข้าได้ |
| เปลี่ยนวิดีโอโรบอตเป็นไฟล์ของเราเอง | Task | Low | ตอนนี้ยังใช้ CDN ของ blueprint |
| ตัดสินใจเรื่องไฟล์ค้าง `components/projects/ProjectsDrawer.tsx` (`z-[60]` → `z-60`) | Task | Low | ยังไม่ commit — `z-60` อาจไม่มีผลถ้าไม่ได้ประกาศ scale ใน `@theme` |
