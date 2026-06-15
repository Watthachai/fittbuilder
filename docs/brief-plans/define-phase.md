# Forced production flow — Define → … → Ship (DVIBE-style)

FITT Builder บังคับให้ทุกโปรเจกต์เดินตาม flow เดียวกัน ข้ามขั้นไม่ได้ โดยมิเรอร์
มาจากโปรเจกต์ DVIBE (`/Users/itswatthachai/dvibe-coder`) แต่รันบน stack ปัจจุบันของ
FITT Builder (localStorage + WebContainer + Gemini) — ไม่มี Postgres/auth/esbuild

```
Define → Plan → Build → Verify → Review → Ship   (มุมมองผู้ใช้)
Idea   → Spec → Code  → Test   → QA     → Production (มุมมอง dev/AI)
```

## หนึ่งเฟส = หนึ่ง agent = หนึ่งไฟล์ SKILL.md

แต่ละเฟสมี agent เป็นเจ้าของ และ **agent แต่ละตัวคือไฟล์ `agents/<slug>/SKILL.md`**
(คอนเวนชันเดียวกับ Claude Code / DVIBE) — frontmatter เป็น metadata, body เป็น
system prompt `lib/agents/registry.ts` โหลดไฟล์เหล่านี้ตอน runtime และ
`getAgentForPhase(phase)` เลือก agent ของเฟสปัจจุบัน

| เฟส | Agent (SKILL.md) | สร้างเอกสาร/ผลลัพธ์ | เงื่อนไขผ่านเฟส (gate) |
|---|---|---|---|
| define | `idea-interviewer` | docs/IDEA.md, docs/BRD.md | มี BRD + กดอนุมัติ |
| plan | `spec-writer` | docs/PRD.md | มี PRD + กดอนุมัติ |
| build | `code-builder` | ไฟล์แอป (รันใน WebContainer) | แอปรันได้ (`package.json`) |
| verify | `test-runner` | docs/VERIFY.md | มี VERIFY.md + กดอนุมัติ |
| review | `qa-reviewer` | docs/REVIEW.md | มี REVIEW.md + กดอนุมัติ |
| ship | `shipper` | docs/SHIP.md | — (เฟสสุดท้าย) |

frontmatter ของ SKILL.md:

```yaml
---
name: idea-interviewer
description: …
phase: define          # define | plan | build | verify | review | ship
when_to_use: "…"
allowed-tools: [Write, AskUser]
---
# body = system prompt (ภาษาไทย)
```

## Flow การทำงาน

```
ผู้ใช้กด "ให้ AI สัมภาษณ์ (Define)" ที่หน้าแรก
        ↓ idea-interviewer สัมภาษณ์ทีละคำถาม → IDEA → BRD
กดปุ่ม "อนุมัติ & ไปต่อ" บนแถบเฟส (gate: ต้องมี BRD)
        ↓ spec-writer ถามคำถามอุดช่องว่าง → PRD
อนุมัติ → เฟส Build kickoff อัตโนมัติ (สร้าง demo จาก BRD/PRD)
        ↓ code-builder → WebContainer preview
อนุมัติ → test-runner (VERIFY.md) → qa-reviewer (REVIEW.md) → shipper (SHIP.md)
        ↓
ส่งมอบผ่านปุ่ม "แชร์" (ลิงก์) และ "Export" (.zip)
```

- เอกสารทุกฉบับเป็น **ไฟล์จริงในโปรเจกต์** (`docs/*.md`) แก้ได้ในแท็บ Code,
  ถูก mount เข้า WebContainer, ติดไป zip/share และคงอยู่ทุกครั้งที่ regenerate
  (`docOnlyFiles` ใน `lib/define.ts`)
- การอนุมัติเป็นแบบ **single-user** (กดปุ่มเดียว) — multi-user approval/comment
  อยู่นอกขอบเขต Tier 1 (ต้องมี DB/auth ก่อน)
- เฟสที่ผ่านแล้วคลิกย้อนกลับได้จากแถบเฟส

## เกณฑ์ออกจาก Define Phase (กฎเหล็ก)

- เอกสารห้ามมีคำว่า "น่าจะ" "แล้วแต่" "อะไรก็ได้"
- ทุกข้อตอบได้: ใช่/ไม่ใช่ · ทำ/ไม่ทำ · วัดได้/วัดไม่ได้
- BRD §9 (คำถามค้าง) ต้องว่างก่อนอนุมัติ
- ถ้าผู้ใช้ตอบคลุมเครือ agent ต้องเสนอตัวเลือก 2-3 ข้อให้เลือกทันที

## ทางเข้า (หน้าแรก, `components/landing/LaunchPad.tsx`)

| ปุ่ม | เริ่มที่เฟส | พฤติกรรม |
|---|---|---|
| ให้ AI สัมภาษณ์ (Define) | define | flow เต็ม — agent เปิดบทสัมภาษณ์ |
| สร้างเลย (พิมพ์ prompt) | build | express — ข้ามไป Build ด้วย prompt ทันที |
| มีเอกสารแล้ว | (SpecFlow) → build | วาง BRD/PRD → ตอบคำถาม → สร้าง demo |

## กลไกฝั่งโค้ด

| ชิ้น | ที่อยู่ |
|---|---|
| Phase model + helpers | `lib/phases.ts` |
| Agent registry (โหลด SKILL.md, frontmatter parser) | `lib/agents/registry.ts` |
| SKILL.md ทั้ง 6 | `agents/<slug>/SKILL.md` |
| Endpoint เฟสสนทนา (SSE, แยกบล็อก ```idea/```brd/…) | `app/api/agent/route.ts` |
| Endpoint สร้างโค้ด (Build) | `app/api/generate/route.ts` (persona = code-builder body) |
| เอกสาร ↔ ไฟล์ | `lib/define.ts` (`DOC_PATHS`) |
| orchestration, gate, advance/navigate | `components/studio/Studio.tsx` |
| แถบเฟส + ปุ่มอนุมัติ | `components/studio/PhaseStepper.tsx` |
| WebContainer (mount/install/dev/HMR) | `lib/webcontainer.ts` (ไม่แตะ — คง pipeline เดิม) |

> **หมายเหตุ runtime:** registry อ่าน SKILL.md จาก `process.cwd()/agents` ตอนรัน
> ดังนั้นโฟลเดอร์ `agents/` ต้องอยู่คู่กับโปรเซส (`npm run dev` / `next start`
> รันจาก root ของโปรเจกต์ — ใช้งานได้) ถ้าทำ standalone output ต้อง copy `agents/` ไปด้วย
