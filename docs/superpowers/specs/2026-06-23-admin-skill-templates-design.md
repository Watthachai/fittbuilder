# Admin-Authored Skill Templates — Design Spec

**Date:** 2026-06-23
**Status:** Approved (design), implemented inline (no subagents) per user preference
**Branch:** `feat/domain-skill-templates` (continues the skill-templates work)
**Target version:** 0.7.0 (MINOR — new feature)

## Goal

Let admins create and publish additional domain **skill templates** from an in-app
admin page, so new domains can be added without a code deploy. Built-in templates
(ERP + 5) stay in code; admins add custom ones that, once published, appear everywhere
built-ins do — detection, the SkillDropdown, and Define/Plan/Build injection.

## Locked Decisions

| Decision | Choice |
|---|---|
| Admin gating | `ADMIN_EMAILS` env (comma-separated), each entry a full email **or** a `@domain` match |
| Authoring depth | Full form **+ question builder** (add/remove questions; type single/multi/text + options + why) |
| Publish flow | **Draft → Publish** (users only see published) |
| Built-ins | **Add custom only** — built-ins remain code-defined and read-only |
| Visibility | Custom templates are **global** (every user sees published ones) |
| Icon | Admin picks from a **curated lucide set** (dropdown), not free text |
| Writes | Through admin server routes that verify `isAdminEmail`, then write with the **service-role** client (RLS blocks direct client writes) |

## A. Admin gating — `lib/admin.ts`

```ts
export function isAdminEmail(email: string | null | undefined): boolean
```
- Reads `process.env.ADMIN_EMAILS` (comma-separated). Each entry matches if it equals the
  email (case-insensitive) OR starts with `@` and the email ends with that domain.
- Env: `ADMIN_EMAILS=@digitalvalue.co.th,wattchaichai@gmail.com`
- Server-only. Used by the admin page (server component) + every `/api/admin/*` route:
  load the user via the server Supabase client, `isAdminEmail(user.email)` → else 403/redirect.

## B. Storage — `fittbuilder_skill_templates` (migration `0003`)

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `slug` | text unique | runtime skill id; must NOT collide with a built-in `SKILL_IDS` (enforced in the create route) |
| `name`, `name_en`, `tagline` | text | |
| `icon` | text | one of the curated lucide names |
| `keywords` | jsonb | string[] for detection |
| `persona`, `domain_knowledge`, `build_guidance`, `seed_data`, `design_hints` | text | `design_hints` nullable |
| `question_bank` | jsonb | array of `{ id, label, type, options?, placeholder?, why? }` |
| `status` | text | `'draft' | 'published'` (default `'draft'`) |
| `created_by` | uuid | → auth.users(id) |
| `created_at`, `updated_at` | timestamptz | updated_at via touch trigger |

**RLS** (enabled):
- SELECT: `status = 'published'` → any authenticated user; OR `created_by = auth.uid()` (author sees own drafts).
- INSERT/UPDATE/DELETE: **no policy for normal users** → denied. Admin writes use the
  service-role client (bypasses RLS) from server routes after `isAdminEmail`.

Migration is idempotent (`create table if not exists`, `create or replace`, `drop policy if exists`), ends with `notify pgrst, 'reload schema'`.

## C. Dynamic registry (built-in + published custom)

The registry stays the single entry point but gains DB-aware, async server lookups.
Built-in `SKILLS` (sync, code) remain; published custom templates load from the DB.

- `lib/skills/db.ts` (server-only):
  - `listPublishedSkills(): Promise<SkillTemplate[]>` — maps published rows → `SkillTemplate`.
  - `getSkillFromDb(slug): Promise<SkillTemplate | null>`.
  - `rowToSkillTemplate(row)` mapper.
- `getAllSkills(): Promise<SkillTemplate[]>` = built-in `SKILLS` ++ published custom (built-ins win on slug collision, though collisions are prevented at create time).
- `resolveSkill(id): Promise<SkillTemplate | undefined>` = built-in `getSkill(id)` ?? `getSkillFromDb(id)`. Used by `/api/agent` + `/api/generate` injection (replaces the sync `getSkill`).
- `GET /api/skills` → `getAllSkills()` (published only) for the client `SkillDropdown`.
- `/api/detect-skill` classifies across `getAllSkills()` (built-in + custom keywords).
- `SkillDropdown` + the landing chip list fetch `/api/skills` instead of importing static `SKILLS` (falls back to built-ins if the fetch fails).

> Note: built-in injection paths currently call the sync `getSkill`. They switch to the
> async `resolveSkill` so custom skills inject too. The sync `getSkill` stays for built-in-only callers/tests.

## D. Admin UI — `/admin/skills`

- `app/admin/skills/page.tsx` — server component; redirects non-admins (proxy allows the
  route only for authed users; the page itself enforces `isAdminEmail`).
- Lists built-in templates (read-only badge) + custom templates (status badge, edit/delete/publish-toggle).
- `components/admin/SkillTemplateForm.tsx` (client): all fields + a **question builder**
  (rows of {label, type select, options (for single/multi), why}; add/remove/reorder).
  Icon = `<select>` from the curated lucide set; live validation (slug format, no built-in collision, ≥1 question).
- Actions call `/api/admin/skills`:
  - `POST` create (draft), `PATCH /:id` update, `DELETE /:id`, `PATCH /:id` with `{ status: 'published' }` to publish.
  - Every handler: `isAdminEmail` gate → service-role write → zod-validate body.

## E. Files

**Create:** `lib/admin.ts`, `lib/skills/db.ts`, `lib/supabase/admin.ts` (service-role client),
`supabase/migrations/0003_skill_templates.sql`, `app/admin/skills/page.tsx`,
`app/api/admin/skills/route.ts` (+ `[id]/route.ts`), `app/api/skills/route.ts`,
`components/admin/SkillTemplateForm.tsx`, `components/admin/SkillTemplateList.tsx`.

**Modify:** `lib/skills/registry.ts` (export curated icon list / keep sync built-ins),
`app/api/detect-skill/route.ts` (classify across all), `app/api/agent/route.ts` +
`app/api/generate/route.ts` (use async `resolveSkill`), `components/studio/SkillDropdown.tsx`
+ `components/landing/LaunchPad.tsx` (fetch `/api/skills`), `lib/db/types.ts`
(add `fittbuilder_skill_templates`), `.env.example` + README (`ADMIN_EMAILS`), proxy
public routes unchanged (admin is authed).

## F. Testing

Vitest (pure logic): `isAdminEmail` (exact + domain + case-insensitivity + reject), the
`rowToSkillTemplate` mapper, and slug-collision validation. UI/API/RLS verified via
`tsc`/`lint`/`build` + manual.

## G. Out of Scope (v1)

- Editing built-in templates (code-only).
- Per-user / per-team templates (custom are global).
- Template versioning / history.
- Managing the admin list from the UI (admins set via env).

## H. Verification

1. `npx vitest run` (admin + mapper units) green; `tsc`/`lint`/`build` clean.
2. Non-admin hitting `/admin/skills` → redirected; non-admin `POST /api/admin/skills` → 403.
3. Admin creates a draft template (with questions) → not visible to users; publishes → appears
   in the SkillDropdown + landing chips + detection for everyone.
4. Selecting a custom published template drives a domain-expert interview + build (injection works via `resolveSkill`).
5. Creating a template with a slug equal to a built-in id is rejected.
6. Direct client write to `fittbuilder_skill_templates` with the anon key is denied by RLS.
