# AI Domain Skill Studio + Living Org DNA — Design Spec

**Date:** 2026-07-14
**Status:** Approved (design) — pending spec review before implementation
**Branch base:** `feat/domain-skill-templates` (also on `main`/`dev`)

## 1. Overview

Two tightly-coupled features that make each workspace's demos domain-grade and self-improving, both orbiting **Org DNA as the workspace's brain**:

- **Part A — AI Domain Skill Studio:** a workspace generates its own AI "domain specialist" (a `SkillTemplate`) from its Org DNA + a short brief. Every demo built in that workspace then auto-uses this specialist, so output fits the industry (e.g. SCB → banking: audit trails, compliance, formal Thai, realistic banking seed data).
- **Part B — Living Org DNA:** while chatting with the AI in a project (Define/Plan), the AI notices org-relevant facts the user reveals, proposes adding them to the workspace's Org DNA, and — on confirm — writes them as a new versioned snapshot. The DNA grows with use, which in turn sharpens the specialist and future demos.

**Phasing:** Build **Part A first (v1)**, then **Part B (v1.1)**. One spec, sequenced.

### Goals
- Democratize skill creation from admin-only (`/admin/skills`, global) to **workspace owners/members**, scoped to their org.
- Reuse the existing AI skill-generation engine and Org DNA drafting/versioning patterns — minimize new surface.
- Keep the canonical Org DNA model (4 blocks + 7 archetypes) intact; enrich it, don't bloat it.

### Non-goals (v1)
- Multiple specialists per workspace (one per workspace in v1).
- Cross-org sharing / marketplace of custom skills.
- Partial regeneration or version diffing of a specialist.
- Silent/auto writes to Org DNA (always confirm — it's a shared resource).

## 2. Existing pieces we reuse (grounding)

| Piece | File | Reuse |
|---|---|---|
| SkillTemplate shape | `lib/skills/types.ts` | persona, questionBank, domainKnowledge, buildGuidance, seedData, designHints |
| AI skill generator (admin) | `app/api/admin/generate-skill/route.ts` | streams a full SkillTemplate from a `topic`; adapt to inject Org DNA + brief, workspace-auth |
| Skill DB + resolution | `lib/skills/db.ts` (`resolveSkill`, `getAllSkills`), `lib/skills/db-mapper.ts` | add org-scoped preference |
| Skill table + RLS | `supabase/migrations/0003_skill_templates.sql` | add `org_id`, `source`; new write RLS |
| Org DNA store + versions | `lib/orgs.ts` (`updateOrgDna`), `lib/org-dna.ts` (`DNA_BLOCKS`, `buildOrgDnaContext`) | write-back + versioning (`OrgDnaVersion`) |
| Org DNA draft UX | `components/org/OrgDnaEditor.tsx` | mirror paste/upload→AI→versions for the Studio card |
| Org DNA → generation | `lib/org-context.ts` (`getProjectOrgDnaContext`) | already injects DNA into `/api/generate` |
| Skill → generation | `app/api/generate/route.ts` (`resolveSkill(body.skillId)`) | workspace skill auto-applies |
| Skill picker + detect | `components/studio/SkillPicker.tsx`, `/api/detect-skill` | workspace skill becomes the default/auto choice |
| Chat answer extraction | `/api/extract-answers` | pattern for Part B's lightweight fact extraction |

## 3. Part A — AI Domain Skill Studio

### 3.1 User flow
1. On the workspace page (`/org/[id]`, `OrgDnaEditor`), a new **"ปั้นผู้เชี่ยวชาญประจำองค์กร"** card appears below the members panel.
2. Inputs: an optional **brief** (industry/what the org does) + optional file uploads — but Org DNA (already on the page) is the primary source. If DNA is empty, nudge to fill it first.
3. **Generate** streams the specialist **section by section (the "reveal")**: persona → sample smart questions → domain modules/entities → seed data sample → design direction.
4. Result is saved as a **workspace-scoped, published `SkillTemplate`** (one per workspace in v1). Editable (persona/questions/knowledge/seed/design) and **versioned** like Org DNA.
5. In the Studio, any project belonging to that workspace **auto-uses the specialist**; TopBar shows a chip **"ขับเคลื่อนโดย &lt;specialist&gt;"**, with an override to pick a different/no skill.

### 3.2 Data model — migration `0019_org_skills.sql`
```sql
alter table fittbuilder_skill_templates
  add column if not exists org_id uuid references fittbuilder_orgs(id) on delete cascade,
  add column if not exists source text not null default 'manual' check (source in ('manual','ai'));
create index if not exists fittbuilder_skill_templates_org_idx on fittbuilder_skill_templates (org_id);
```
- `org_id = null` → a global/admin template (existing behavior, unchanged).
- `org_id = <org>` → workspace-scoped specialist.
- **RLS (new, additive to 0003's select policy):**
  - SELECT: keep existing (`status='published' or created_by=auth.uid()`) **plus** org members can read their org's templates → `or (org_id is not null and fittbuilder_is_org_member(org_id, auth.uid()))`.
  - INSERT/UPDATE/DELETE: allow when `org_id is not null and fittbuilder_is_org_member(org_id, auth.uid())` (workspace members manage their org's skill). Global templates (`org_id is null`) stay admin/service-role only (no client write policy — unchanged).
- Reuse existing helper `fittbuilder_is_org_member` (from 0015).

### 3.3 API — `POST /api/org-skill/generate`
- Auth: signed-in + member of the target org (verified server-side).
- Body: `{ orgId, brief?, attachments? }`.
- Loads the org's Org DNA server-side (service role via existing org-context util), composes the generation prompt = admin generator's prompt **+ Org DNA context (`buildOrgDnaContext`) + brief**.
- Streams a `SkillTemplate` (reuse the admin route's stream + parser). Client renders the reveal.
- On accept, client calls `saveOrgSkill(orgId, template)` → upsert into `fittbuilder_skill_templates` with `org_id`, `source='ai'`, `status='published'`, a slug like `org-<shortid>`.
- Records AI usage (`recordUsage`, kind `generate_skill`) — kind already exists.

### 3.4 lib — `lib/org-skills.ts`
- `getOrgSkill(orgId): SkillTemplate | null` — the workspace's specialist (one in v1).
- `saveOrgSkill(orgId, template)` / `updateOrgSkill(id, patch)` — upsert/edit (client, RLS-gated).
- `deleteOrgSkill(id)`.
- Versions stored the same way Org DNA versions are (snapshot list on the record or a `versions` jsonb) — reuse `OrgDnaVersion`-style shape.

### 3.5 Generation wiring
- `resolveSkill`/generate: when a project has `org_id` and no explicit `skillId`, resolve to the workspace's specialist. Cleanest: at generate time in `/api/generate`, if `body.skillId` is empty and the project's org has a specialist, use it. Keep explicit `skillId` as an override.
- `getProjectOrgDnaContext` already injects DNA; the specialist injects persona/knowledge/seed via the existing skill path — no new prompt plumbing beyond resolution.
- Studio TopBar: chip showing the active specialist + a menu to override (reuse SkillPicker).

### 3.6 UI
- `components/org/DomainSkillStudio.tsx` — the card + streaming reveal + save/edit/versions, mounted in `OrgDnaEditor`.
- Reveal component streams sections with a "thinking" feel (respect `prefers-reduced-motion`).
- Chip in `components/studio/TopBar.tsx`.

## 4. Part B — Living Org DNA (v1.1)

### 4.1 User flow
1. During the AI chat (Define/Plan `runAgent` turns) in a project that belongs to a workspace, after a user message, a lightweight check detects org-DNA-relevant facts.
2. If found, a subtle chip renders in the chat: **"🧬 เจอข้อมูลองค์กร — [block] "&lt;snippet&gt;" · [เพิ่มเข้า Org DNA] [ข้าม]"**.
3. On confirm → append the snippet to the mapped block of the workspace's Org DNA and save as a **new version** (reuse `OrgDnaVersion` + `updateOrgDna`).
4. Never writes silently (shared resource). Only workspace members can write (RLS `orgs_update` = `is_org_member`).

### 4.2 Detection — `POST /api/dna-capture`
- Body: `{ text }` (the user message; optionally the recent turn).
- Returns `{ block: 'decisionRights'|'information'|'motivators'|'structure', snippet: string } | { block: null }`.
- Lightweight Gemini call (pattern of `/api/extract-answers`); rate-limited; records usage (`org_dna` kind).
- Called from the Studio chat only when the project has an `org_id` (else skip — nothing to enrich).
- Debounced / only on substantive user messages to avoid noise + cost.

### 4.3 Write-back
- `lib/orgs.ts`: reuse `updateOrgDna`. Append to the block (don't overwrite): `blockText = existing ? existing + "\n" + snippet : snippet`, push a new `OrgDnaVersion` (source `'ai'`).
- UI chip lives in `components/studio/ChatPanel.tsx` (or the turn renderer).

## 5. Data flow

```
Part A:  workspace Org DNA + brief ─▶ /api/org-skill/generate (stream)
              └▶ SkillTemplate JSON ─▶ save (org_id, source=ai) ─▶ resolveSkill prefers it
              ─▶ /api/generate (demo) uses persona/knowledge/seed ─▶ domain-grade demo

Part B:  user chat msg ─▶ /api/dna-capture ─▶ {block, snippet}?
              └▶ chip ─▶ confirm ─▶ updateOrgDna (append + version) ─▶ richer DNA ─▶ (feeds Part A)
```

## 6. Error handling
- Generation stream failure → toast + keep the card usable (retry); no partial save unless the user accepts a complete result.
- Empty Org DNA when generating a specialist → block with a nudge to fill DNA first (the specialist needs a base).
- `/api/dna-capture` failure or `{block:null}` → silently no chip (never interrupt the chat).
- RLS denial on save (non-member) → clear toast; UI hides write controls for non-members.
- Concurrency: workspace has one specialist in v1 → regenerate replaces (with a version snapshot first, so it's undoable).

## 7. Testing
- Unit: `db-mapper` round-trip for the new `org_id`/`source` fields; slug generation; block-append logic for Living DNA.
- RLS (rolled-back psql, per project convention): a member can read+write their org's skill; a non-member cannot; global (`org_id null`) templates stay unwritable by clients.
- Manual/verify: generate a specialist for a test workspace, confirm a demo built there is auto-powered by it; in chat, reveal an org fact → confirm the chip → confirm the DNA version was appended.
- tsc + eslint + `next build` + vitest on each commit; migrations via `npm run db:migrate` (DIRECT_URL, creds hidden).

## 8. Rollout / phasing
- **v1 (Part A):** migration 0019, `/api/org-skill/generate`, `lib/org-skills.ts`, `DomainSkillStudio` UI, generation wiring, TopBar chip.
- **v1.1 (Part B):** `/api/dna-capture`, chat chip, DNA append+version write-back.
- Deploys via existing triggers (dev→sandbox, main→prod). Changelog + version bump per feature.

## 9. Open questions (resolved)
- Auto-apply vs opt-in specialist → **auto-apply with override**.
- Silent vs confirm DNA writes → **always confirm**.
- One vs many specialists per workspace → **one in v1**.
- Generate source → **Org DNA + optional brief/files**.
