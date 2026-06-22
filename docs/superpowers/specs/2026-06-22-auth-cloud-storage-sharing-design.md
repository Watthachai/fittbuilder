# Spec 1: Auth + Cloud Storage + Team Sharing + Changelog

**Date:** 2026-06-22
**Status:** Approved (design), pending implementation plan
**Branch:** `feat/auth-cloud-storage`

## Goal

Turn FITT Builder from a single-device localStorage app into a multi-user product:
forced login, projects stored in the cloud, async team sharing (link + email invites
with viewer/editor roles), and an in-app Changelog ("What's new") page. Real-time
co-editing is explicitly **out of scope** here — it is Spec 2, built on top of this
foundation.

## Locked Decisions

| Decision | Choice |
|---|---|
| Stack | **Supabase all-in** — Supabase Auth + Supabase Postgres, accessed via `@supabase/supabase-js` + `@supabase/ssr` |
| Authorization | **Postgres RLS** (row-level security) as the leak guard + `supabase gen types typescript` for typed queries |
| Table naming | Every app table prefixed `fittbuilder_` (cannot rename Supabase's own `auth.users`) |
| Guest mode | **Forced login** — no anonymous use of the studio |
| localStorage migration | **None** — start fresh in the cloud; abandon existing local projects (dev-only data) |
| Sharing model | **Both** invite-by-link and invite-by-email, roles `viewer` / `editor`, **async** (no real-time) |
| Changelog | Static typed content in code, rendered as an in-app page with a "What's new" badge |

## Why Supabase + RLS (not Prisma)

The leak guard lives at the **database**: RLS policies are enforced by Postgres on
every query regardless of app-code correctness, so a forgotten filter or an exposed
anon key cannot cross-tenant leak. Prisma is an ORM with a privileged connection that
**bypasses RLS** and relies on every `where: { userId }` being correct — one miss
leaks. For a solo/non-expert builder optimizing for "cannot leak," RLS centralizes the
rule in one auditable place (`auth.uid() = owner_id`) instead of scattering it across
every query. Typed queries are preserved via generated types, so readability stays
close to Prisma.

---

## A. Database Schema

All tables in the `public` schema, prefixed `fittbuilder_`. Primary keys are `uuid`.
`auth.users` (Supabase-managed) is referenced but never modified.

### `fittbuilder_profiles`
1:1 with `auth.users`, created automatically by a trigger on `auth.users` insert.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | FK → `auth.users(id)` ON DELETE CASCADE |
| `email` | text | copied from auth.users |
| `name` | text null | |
| `avatar_url` | text null | from Google OAuth if present |
| `plan` | text default `'free'` | reserved for future billing (not enforced this spec) |
| `last_seen_changelog` | text null | latest changelog version the user has seen (for the badge) |
| `created_at` | timestamptz default now() | |

### `fittbuilder_projects`
The cloud equivalent of today's `ProjectRecord`. Bulk document fields stored as
`jsonb` (doc-style); queryable fields as real columns.

| Column | Type | Maps to `ProjectRecord` |
|---|---|---|
| `id` | uuid PK | `id` |
| `owner_id` | uuid | FK → `auth.users(id)` ON DELETE CASCADE |
| `name` | text default `'Untitled'` | `name` |
| `files` | jsonb null | `files` (path→contents map) |
| `phase` | text | `phase` (PhaseId) |
| `approved_phases` | jsonb default `'[]'` | `approvedPhases` |
| `history` | jsonb default `'[]'` | `history` (≤10 file snapshots) |
| `messages` | jsonb default `'[]'` | `messages` (ChatMessage[] incl. thinking/actions/changes) |
| `share_token` | text unique null | random token for the public share link |
| `share_role` | text null | `'viewer'` \| `'editor'` — role granted by the link |
| `created_at` | timestamptz default now() | `createdAt` |
| `updated_at` | timestamptz default now() | `updatedAt` (touched by trigger on update) |

`pendingPrompt` / `pendingSpec` are **not** persisted — they remain transient client
state passed from the landing page (sessionStorage / navigation).

### `fittbuilder_project_members`
Accepted collaborators.

| Column | Type | Notes |
|---|---|---|
| `project_id` | uuid | FK → `fittbuilder_projects(id)` ON DELETE CASCADE |
| `user_id` | uuid | FK → `auth.users(id)` ON DELETE CASCADE |
| `role` | text | `'viewer'` \| `'editor'` |
| `created_at` | timestamptz default now() | |
| PK | (`project_id`, `user_id`) | |

### `fittbuilder_project_invites`
Pending email invites (person may not have an account yet).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `project_id` | uuid | FK → `fittbuilder_projects(id)` ON DELETE CASCADE |
| `email` | text | invitee email (lowercased) |
| `role` | text | `'viewer'` \| `'editor'` |
| `token` | text unique | accept-link token |
| `status` | text default `'pending'` | `'pending'` \| `'accepted'` \| `'revoked'` |
| `expires_at` | timestamptz | default now() + 14 days |
| `created_at` | timestamptz default now() | |

### RLS Policies

RLS enabled on all four tables. To avoid the classic **infinite-recursion** trap
(projects policy reads members, members policy reads projects), membership checks go
through `SECURITY DEFINER` helper functions that bypass RLS internally:

```sql
-- returns true if uid owns or is a member of the project
create function fittbuilder_can_read_project(pid uuid, uid uuid) returns boolean
  language sql security definer stable as $$
    select exists(select 1 from fittbuilder_projects p where p.id = pid and p.owner_id = uid)
        or exists(select 1 from fittbuilder_project_members m where m.project_id = pid and m.user_id = uid);
  $$;

-- returns true if uid owns or is an editor member of the project
create function fittbuilder_can_edit_project(pid uuid, uid uuid) returns boolean
  language sql security definer stable as $$
    select exists(select 1 from fittbuilder_projects p where p.id = pid and p.owner_id = uid)
        or exists(select 1 from fittbuilder_project_members m
                  where m.project_id = pid and m.user_id = uid and m.role = 'editor');
  $$;
```

Policy summary:

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `fittbuilder_profiles` | `id = auth.uid()` | (trigger only) | `id = auth.uid()` | — |
| `fittbuilder_projects` | `fittbuilder_can_read_project(id, auth.uid())` | `owner_id = auth.uid()` | `fittbuilder_can_edit_project(id, auth.uid())` | `owner_id = auth.uid()` |
| `fittbuilder_project_members` | `fittbuilder_can_read_project(project_id, auth.uid())` | project owner | project owner (change role) | project owner (remove) + self (leave) |
| `fittbuilder_project_invites` | project owner | project owner | project owner / accept flow | project owner |

---

## B. Auth (Next.js 16 + `@supabase/ssr`)

- **Providers:** Google OAuth + magic link (email OTP) via Supabase Auth.
- **Sessions:** cookie-based via `@supabase/ssr`. Three clients:
  - `lib/supabase/server.ts` — server components / route handlers (reads cookies)
  - `lib/supabase/client.ts` — browser client (`createBrowserClient`)
  - `lib/supabase/middleware.ts` — session refresh helper used by `proxy.ts`
- **Route protection:** `proxy.ts` at project root (**Next 16 renames `middleware.ts` →
  `proxy.ts`**) refreshes the session and redirects unauthenticated requests for the
  studio/projects to `/login`. Public routes: `/login`, `/auth/callback`, `/changelog`,
  `/share/*` (public read links).
- **Files:** `app/login/page.tsx` (Google button + email input), `app/auth/callback/route.ts`
  (exchanges code for session, resolves any pending invites for the email, redirects).
- **Env:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Service-role key
  (`SUPABASE_SERVICE_ROLE_KEY`) only used server-side for the trigger-free admin paths
  if any are needed (kept out of the browser).

Read `node_modules/next/dist/docs/` for App Router specifics before coding (async
`cookies()`, `proxy.ts`, route handlers).

---

## C. Storage Layer Refactor (highest-risk unit)

`lib/storage.ts` changes from synchronous localStorage to async Supabase calls. The
**interface shape is preserved** so callers change minimally, but persistence functions
become `async`.

| Function | Before | After |
|---|---|---|
| `getProject(id)` | sync | `async` → select one row, map to `ProjectRecord` |
| `saveProject(rec)` | sync | `async` → upsert row (sets `updated_at`) |
| `createProject(opts)` | sync | `async` → insert with `owner_id = auth.uid()` |
| `deleteProject(id)` | sync | `async` → delete (RLS: owner only) |
| `duplicateProject(id)` | sync | `async` → read + insert copy |
| `listProjects()` | sync | `async` → select owned **and** shared (via RLS) → `ProjectSummary[]` with an `access: 'owner' \| 'member'` flag and role |
| `withHistory` / `undo` / `appendMessage` / `newMessage` | pure | **unchanged** (stay pure) |

- A `lib/storage.ts` row↔`ProjectRecord` mapper (snake_case columns ↔ camelCase fields).
- `Studio.tsx` keeps the project in React state as today; cloud saves are **debounced**
  (e.g. 800ms after the last change) with a small "saving…/saved" indicator. Build turns
  still save immediately on completion.
- Remove all localStorage read/write paths (no dual-write, no migration — per "start
  fresh"). The `pb:` localStorage keys are dropped.
- `listProjects` returns owned + shared; the projects UI splits them into "ของฉัน" and
  "แชร์กับฉัน".

---

## D. Sharing (async)

- **Share modal** (per project, owner only to manage):
  - Copy public link with a role toggle (viewer/editor) → sets `share_token` + `share_role`.
  - Invite by email + role → inserts `fittbuilder_project_invites` keyed by the email and
    **sends a real invite email via the DMAIL API** (`lib/email.ts`), containing the
    accept link. Also exposes the same link as copyable for manual sharing.
  - Member list with role + remove; revoke pending invites.
- **Accepting:**
  - **Link:** a logged-in user opening `/join/<share_token>` is inserted into
    `fittbuilder_project_members` with the link's `share_role` (idempotent).
  - **Email:** two paths, no email service required — (a) opening the copied invite link
    while logged in marks the invite `accepted` and creates the membership; (b) **at every
    login**, `auth/callback` resolves any `pending` invites whose `email` matches the
    user's email into memberships automatically, so an invitee who just logs in normally
    finds the project under "แชร์กับฉัน" without ever clicking a link.
- **Permissions in the studio:** `viewer` → read-only UI (chat input, build, edit, share
  controls disabled); `editor` → full edit except team management + delete (owner only).
- **Concurrency:** async only. Last-write-wins on save; no locking in this spec. (Spec 2
  adds real-time + turn-taking for AI builds.)

---

## E. Changelog / "What's new"

- **Content:** `lib/changelog.ts` exports a typed array:
  ```ts
  export interface ChangelogEntry { version: string; date: string; title: string; body: string /* markdown */ }
  export const CHANGELOG: ChangelogEntry[] // newest first
  ```
- **Page:** `app/changelog/page.tsx` renders entries with the existing
  `components/studio/Markdown.tsx`. Public route (no login needed to read).
- **"What's new" badge:** compare `CHANGELOG[0].version` with
  `profiles.last_seen_changelog`. If different, show a dot on the changelog nav entry.
  Visiting `/changelog` updates `last_seen_changelog` to the latest version.
- Authoring is code-only (we write entries); no admin UI, no DB table for changelog.

---

## Email (DMAIL API)

Invite emails are sent through the existing DMAIL transactional service (no new npm
dependency — uses `fetch`).

- `lib/email.ts` exports `sendProjectInviteEmail({ to, projectName, role, inviteLink, senderName })`.
- POST `https://dmailservicebackend-sandbox-1095128507689.asia-southeast1.run.app/api/v1/mail/send`
  with header `X-API-Key: process.env.DMAIL_API_KEY` (server-only).
- **Template:** reuse the existing FITT BSA invitation template
  `4b72b137-4124-4b4a-982b-a7b38d723547` with mapped variables — `companyName` ←
  project name, `roleText` ← `Viewer`/`Editor`, `branchName` ← `"-"`, `invitationLink` ←
  the accept link, `senderName` ← inviter's name, `year`. A Builder-specific template can
  replace `INVITATION_TEMPLATE_ID` later without code changes elsewhere.
- Sending is **best-effort**: a DMAIL failure is logged but does not fail the invite — the
  invite row + copyable link still work, and login-email matching still grants access.

## Out of Scope (this spec)

- Real-time co-editing / CRDT / presence / shared cursors (→ Spec 2).
- Sharing one WebContainer across users (technically impossible — runs per-browser-tab;
  each editor rebuilds preview locally from synced files).
- AI-build turn-taking when multiple editors are online (→ Spec 2).
- Usage metering, quotas, Stripe billing (deferred; `plan` column reserved only).
- Distributed rate limiting (Upstash/Redis) — keep current per-instance limiter.
- WebContainers commercial license procurement.

## New Dependencies

- `@supabase/supabase-js`, `@supabase/ssr`
- dev: `supabase` CLI (for `gen types`, local migrations) — optional if using hosted SQL editor

## Environment Variables (add)

| Var | Scope | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | anon key (safe in browser, guarded by RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | server-only | admin paths (invite resolution if needed) |
| `DMAIL_API_KEY` | server-only | DMAIL transactional email (invite emails) |

## Verification

1. `npx tsc --noEmit` clean; `npm run lint` 0 problems; `npm run build` compiles.
2. RLS proof: as user A, attempt to `select`/`update` user B's project → 0 rows / denied.
3. Forced login: hitting `/` or a project URL while logged out → redirect to `/login`.
4. Sharing: A invites B (editor) by email → B logs in → project appears under "แชร์กับฉัน",
   B can edit; A invites C (viewer) by link → C is read-only.
5. Changelog: new entry → badge dot appears → visiting `/changelog` clears it.
6. No localStorage `pb:` keys are read or written anywhere.

## File Map

**Create:** `lib/supabase/{server,client,middleware}.ts`, `proxy.ts`,
`app/login/page.tsx`, `app/auth/callback/route.ts`, `app/changelog/page.tsx`,
`app/join/[token]/route.ts`, `lib/changelog.ts`, `lib/db/types.ts` (generated),
`lib/email.ts` (DMAIL invite email), `components/studio/ShareModal.tsx`,
`supabase/migrations/*.sql` (schema + RLS).

**Modify:** `lib/storage.ts` (async Supabase), `lib/types.ts` (add member/invite types,
`access`/`role` on `ProjectSummary`), `components/studio/Studio.tsx` (async saves,
role-gated UI), `components/landing/LaunchPad.tsx` (auth-aware), projects list UI,
`next.config.ts` (verify COOP/COEP still OK with Supabase), `README.md` (update
checklist), `.env.example`.

**Delete:** localStorage code paths inside `lib/storage.ts`.
