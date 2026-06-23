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
