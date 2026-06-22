# Domain Skill Templates — Design Spec

**Date:** 2026-06-22
**Status:** Approved (design), pending implementation plan
**Branch:** `feat/domain-skill-templates` (stacked on `feat/auth-cloud-storage`)

## Goal

Make FITT Builder's questioning and generation **domain-expert**. When a user starts a
project, the AI detects the domain (e.g. ERP), confirms it with a delightful selection
moment, then conducts the Define/Plan interview and the Build generation as a true domain
specialist — asking the right questions, using domain terminology, and producing a
multi-screen demo seeded with realistic sample data. ERP ships deep; the other five
domains ship as shallow templates migrated from the existing presets.

## Locked Decisions

| Decision | Choice |
|---|---|
| Authoring | **Dev-authored, curated** — templates live in the repo (`lib/skills/`), no user-created templates in v1 |
| Domain selection | **AI auto-detects + user confirms/changes** (extends the existing keyword detection) |
| Depth | **ERP deep**; CRM / E-commerce / Dashboard / Booking / Landing shallow (migrated from presets) |
| Integration | **All three phases** — Define (interview), Plan (PRD), Build (generation) — plus express build |
| Seed data | **Yes** — templates carry realistic sample data embedded into the generated demo |
| Preset system | **Unified** — `lib/presets.ts` is absorbed into `lib/skills/`; skills become the single domain source of truth |

## Architecture (Approach A+C: modular SkillTemplate + registry)

One file per domain under `lib/skills/`, each exporting a `SkillTemplate`. A registry
aggregates them and provides detection. The same template object feeds the Define agent,
the Plan agent, the Build prompt, and the Spec-to-Demo Typeform — eliminating the current
split between `lib/presets.ts` (Typeform only) and the generic SKILL.md agents.

### Types — `lib/skills/types.ts`

```ts
export type SkillQuestionType = "single" | "multi" | "text";

export interface SkillQuestion {
  id: string;
  label: string;            // the question (Thai)
  type: SkillQuestionType;
  options?: string[];       // for single/multi
  placeholder?: string;     // for text
  why?: string;             // short reason shown to the user ("ทำไมถึงถาม") — the "smart" signal
}

export interface SkillTemplate {
  id: string;               // "erp"
  name: string;             // "ระบบ ERP"
  nameEn: string;           // "ERP"
  tagline: string;          // short pitch for the gallery card
  icon: string;             // lucide icon name (e.g. "Factory")
  keywords: string[];       // for AI/keyword detection
  persona: string;          // domain-expert framing injected into the interviewer
  questionBank: SkillQuestion[];   // deep domain questions (replaces preset questions)
  domainKnowledge: string;  // markdown: modules, workflows, roles, entities/fields, KPIs, glossary
  buildGuidance: string;    // markdown: screens, architecture, libraries, status/badges hints
  seedData: string;         // markdown/JSON: realistic sample records to embed in the demo
  designHints?: string;     // optional domain visual direction
}
```

### Registry — `lib/skills/registry.ts`

```ts
export const SKILLS: SkillTemplate[]            // [erp, crm, ecommerce, dashboard, booking, landing]
export const SKILL_IDS: string[]
export function getSkill(id: string): SkillTemplate | undefined
export function detectSkillByKeywords(text: string): { skillId: string; score: number }
```

Files: `lib/skills/{erp,crm,ecommerce,dashboard,booking,landing}.ts` + `types.ts` + `registry.ts`.
ERP is authored deeply (full persona/questionBank/domainKnowledge/buildGuidance/seedData);
the other five are migrated from `lib/presets.ts` (keywords + questions → `questionBank`)
with a one-paragraph `domainKnowledge`/`buildGuidance` and light `seedData`.

## Detection + Selection UX (the "wow" moment)

1. **Detect.** When the user submits the first prompt (LaunchPad) or enters Define, call
   detection: AI classification with a keyword-score fallback (reuse the existing
   `/api/detect-preset` machinery, renamed/extended to `/api/detect-skill` returning a
   `skillId`). The existing `DETECT_PRESET_SYSTEM` prompt is updated to classify into the
   skill ids.
2. **Confirm card.** A prominent card announces the detected domain and what the AI will
   do, with primary "✓ ใช่ ลุยเลย" and secondary "เปลี่ยนโดเมน ▾":

   ```
   ┌─────────────────────────────────────────────┐
   │  🏭  ตรวจพบ: ระบบ ERP                          │
   │  ผมจะสวมบทที่ปรึกษา ERP ระดับ enterprise        │
   │  ถามให้ตรงจุด: PR→PO→GR→Invoice, roles, KPI    │
   │  [ ✓ ใช่ ลุยเลย ]   [ เปลี่ยนโดเมน ▾ ]          │
   └─────────────────────────────────────────────┘
   ```
3. **Gallery.** "เปลี่ยนโดเมน" expands a grid of six template cards (icon + name + tagline);
   user picks manually. Selecting any option locks `skillId` onto the project.
4. **Component:** `components/studio/SkillPicker.tsx` (confirm card + gallery), themed
   "midnight" + lucide icons. Mirrors the existing `DesignPicker.tsx` interaction pattern.

The selection happens once per project, early, and is editable later (re-open the picker
from the phase area). A "no clear match" detection defaults to the gallery (no forced pick).

## Persistence

- Migration `supabase/migrations/0002_skill_id.sql` (idempotent): `alter table
  fittbuilder_projects add column if not exists skill_id text;`
- `ProjectRecord.skillId?: string`; `ProjectRow.skill_id`; mapper + `projectToRow` updated
  to read/write it. RLS unchanged (column on an already-guarded table).
- `lib/db/types.ts` `fittbuilder_projects` Row/Insert/Update gain `skill_id: string | null`.

## Phase Injection (data flow)

The selected `SkillTemplate` is loaded by id wherever a phase runs:

- **Define — `app/api/agent` (idea-interviewer):** `buildAgentSystemPrompt` gains an
  optional `skill` argument; when present it appends the skill's `persona`,
  `questionBank` (as a prioritized checklist), and `domainKnowledge` so the interview is
  domain-expert and skips generic/obvious questions. The request body carries `skillId`.
- **Plan — `app/api/agent` (spec-writer):** same injection of `domainKnowledge` +
  `buildGuidance` so the PRD is domain-grounded.
- **Build — `app/api/generate` (code-builder):** `buildSpecContext` /
  `buildGenerationSystemPrompt` gain the skill's `domainKnowledge` + `buildGuidance` +
  `seedData`, so generation produces the right screens and embeds realistic data. Works
  for both the full flow and express build (skillId passed through).
- The Spec-to-Demo Typeform reads its questions from `getSkill(id).questionBank` instead
  of `getPreset(id).questions`.

`skillId` flows: client reads `project.skillId` and includes it in `/api/agent` and
`/api/generate` request bodies (zod-validated, optional). Server loads `getSkill(skillId)`.

## ERP Deep Content (what makes it wow)

- **persona:** an enterprise ERP consultant (SAP/Oracle/Odoo background) who speaks in
  procure-to-pay / order-to-cash terms and insists on concrete answers.
- **questionBank:** modules (Finance / Inventory / Procurement / Manufacturing / HR);
  primary workflow (PR→PO→GR→Invoice→Payment); roles + approval matrix (Requester /
  Approver / Buyer / Warehouse / Finance / CFO / Auditor); document numbering;
  multi-currency; KPIs; core entities + fields (PR, PO, GRN, Invoice, Item, Supplier,
  Stock). Each question carries a `why`.
- **domainKnowledge:** module map, the procure-to-pay & order-to-cash flows, master data,
  approval hierarchies, and a terminology glossary.
- **buildGuidance:** screens — Dashboard (KPI cards + recharts), PR list, PO create with
  line items, Approval inbox, Goods Receipt, Stock levels, Supplier list; a role switcher;
  status badges; table-dense layout.
- **seedData:** realistic suppliers, items (SKU / unit / price), POs with line items and
  statuses, stock levels, and pending approvals — enough that the demo reads as a real ERP.

## Components & Files

**Create:** `lib/skills/types.ts`, `lib/skills/registry.ts`,
`lib/skills/{erp,crm,ecommerce,dashboard,booking,landing}.ts`,
`components/studio/SkillPicker.tsx`, `supabase/migrations/0002_skill_id.sql`,
`app/api/detect-skill/route.ts` (or rename `detect-preset`).

**Modify:** `lib/types.ts` (`ProjectRecord.skillId`), `lib/db/types.ts` (`skill_id`),
`lib/db/project-mapper.ts`, `lib/storage.ts` (persist skillId), `lib/prompts.ts`
(`buildAgentSystemPrompt`/`buildGenerationSystemPrompt`/`DETECT_PRESET_SYSTEM` skill-aware),
`lib/context-builder.ts` (`buildSpecContext` takes a skill), `app/api/agent/route.ts`
(accept `skillId`, load skill), `app/api/generate/route.ts` (accept `skillId`, inject),
`app/api/extract-answers/route.ts` (read skill questions), `components/studio/Studio.tsx`
(selection flow + pass skillId), `components/landing/LaunchPad.tsx` (kick off detection).

**Absorb/replace:** `lib/presets.ts` → migrated into `lib/skills/`; remaining references
updated (Spec-to-Demo Typeform reads skills). Keep a thin compatibility shim only if a
caller cannot be updated in scope (none expected).

## Testing Strategy

Vitest for pure logic only (per repo convention): `detectSkillByKeywords` (scoring +
fallback), the registry (`getSkill`, ids, every template has required fields and a deep
ERP), and the skill→prompt injection builders (assert the persona/knowledge/seed strings
land in the composed prompt). UI/API/migration verified via `tsc`/`lint`/`build` + manual.

## Out of Scope (v1)

- User-created / editable skill templates (custom domains via UI) — dev-authored only.
- Deep authoring of the five non-ERP domains (shallow v1; deepen later).
- Real-time / collaboration concerns (separate spec).
- Per-skill billing/metering.

## Verification

1. `npx vitest run` (detection + registry + injection units) green; `tsc`/`lint`/`build` clean.
2. Detection: an ERP-flavored prompt surfaces the ERP confirm card; "เปลี่ยนโดเมน" shows
   the 6-card gallery; selecting locks `skill_id` (visible on the row after save).
3. Define with ERP selected asks ERP-specific questions (PR→PO→GR, roles, KPIs), not the
   generic set; the BRD/PRD reflect domain terminology.
4. Build with ERP produces multi-screen output (dashboard + PO + approvals + stock) seeded
   with realistic sample data.
5. Spec-to-Demo Typeform shows the skill's `questionBank`.
6. A non-matching prompt defaults to the gallery without crashing.
