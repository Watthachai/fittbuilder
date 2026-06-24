# Changelog

All notable changes to **FITT Builder** are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versioning follows [Semantic Versioning](https://semver.org/) — `MAJOR.MINOR.PATCH`:

- **Bug fix** (no new behavior) → bump **PATCH** — `0.6.0 → 0.6.1`
- **New feature** (backward-compatible) → bump **MINOR**, reset patch — `0.6.1 → 0.7.0`
- **Breaking change** → bump **MAJOR**, reset minor/patch — `0.7.0 → 1.0.0`

The user-facing in-app changelog lives in `lib/changelog.ts` (page: `/changelog`)
and is kept in sync with the entries below.

## [Unreleased]

## [0.8.0] - 2026-06-24

### Added
- **Light/Dark theme** across the whole app (default = system) with a floating glass switcher (bottom-right, every page).
- **AI usage report** (`/admin/usage`): per-chat / per-user / per-kind token totals with an estimated cost.
- **AI skill-template generator** (`/admin/skills`): researches a domain via an optional URL and/or Google Search grounding, streams the thinking + a Thai report, and auto-fills the template for review.
- **Multi-party phase approval**: on shared projects every member (any role) must approve a phase before it advances.
- **Express auto-pilot**: a complete prompt now generates BRD → PRD → build automatically (Define and Plan emit their docs in one shot).
- **Rework from docs**: regenerate the app from the current BRD/PRD; a doc-preview modal (IDEA / BRD tabs) with an inline AI "revise" box; a "ดูเอกสาร" button on chat turns that produced a doc.

### Changed
- Frosted-glass surfaces + Google-Stitch-style entrance animations across pages (projects, login, changelog, admin).

### Fixed
- Project creation failed with an RLS error — `INSERT…RETURNING` applied a SELECT policy whose owner check was a self-referential subquery that couldn't see the new row.
- Mouse-scrub hero video was janky — a persistent CSS transform kept it off the fast compositing path.
- The launch prompt was lost on navigation; it's now handed off via `sessionStorage`.
- `/api/agent` rejected long briefs — per-message cap raised 6k → 10k to match the input limit.
- Chat renders user messages as Markdown and wraps long URLs/code instead of overflowing.
- Monaco stopped red-underlining valid in-browser code (semantic validation off, JSX configured).
- Account + admin links are now reachable on mobile.

## [0.7.0] - 2026-06-23

### Added
- **Admin-authored skill templates**: create/edit/publish custom domains from `/admin/skills`
  (full form + question builder), gated by `ADMIN_EMAILS` (email or `@domain`).
- Published custom templates appear everywhere built-ins do — SkillDropdown, detection,
  and Define/Plan/Build injection — resolved dynamically (built-in code + DB).

## [0.6.0] - 2026-06-22

### Added
- Domain **Skill Templates**: deep ERP template + 5 shallow (CRM, E-commerce, Dashboard, Booking, Landing).
- AI domain detection (`/api/detect-skill`) + AI-Studio-style **SkillDropdown** and confirm/gallery picker.
- Domain expertise injected into the Define/Plan interview and Build, with realistic seed data.
- Chat prompt limit raised 500 → 10,000 characters.
- Motion animations: landing scroll-reveal, "+" actions menu, animated dropdowns.

### Changed
- `lib/presets.ts` now derives from the skill registry (single source of truth).

## [0.5.0] - 2026-06-22

### Added
- **Accounts**: Supabase auth (Google + magic link), forced login, account menu with sign out.
- **Cloud storage**: projects in Postgres with RLS; "My projects" / "Shared with me" lists.
- **Team sharing**: share links + email invites (viewer/editor) sent via DMAIL.
- In-app **changelog** ("What's new") page with an unseen badge.

### Fixed
- Auth callback session-cookie redirect loop; singleton browser client; profile backfill for pre-existing users.

## [0.3.0] - 2026-06-18

### Added
- Streaming chat with AI **thinking**, grouped **action history**, and a **"View changes"** diff viewer.

## [0.1.0]

### Added
- Initial FITT Builder — natural-language prompt → runnable web demo in the browser
  (Vite + React + WebContainers, Google Gemini), Spec-to-Demo, share via URL, localStorage persistence.
