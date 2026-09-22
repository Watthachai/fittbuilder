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

### Added
- **A dashboard for personnel records** at its overview: a document-compliance gauge with who is short, a department donut, a week strip with tinted agenda cards (contract expiry, probation, anniversaries), the twelve-month headcount columns, a status tracker (probation / fixed-term / left) and recent events with kind-coloured tags. Every figure is computed. `demo/modules/ui.tsx` gains `PALETTE`/`swatchFor` (stable category colours), `Tag`, `TintCard`, `Dot`, `Gauge`, `Donut` and `WeekStrip`, all SVG/CSS with motion. Screens accept `onOpenSection` so "ดูทั้งหมด" can move to a capability; both hosts supply it.
- **The marketplace sells systems.** One `SystemCard` per family with its parts, capabilities and per-part prices inside and a system total; `/marketplace/[id]` is a `SystemDetail` (module ids redirect to their system). "ลองใช้ทั้งระบบ" opens `/erp?system=<family>` — the ERP trial scope is now a system, listing every part with the role's locks, and the trial switcher moves between systems. The basket (`useScope`) adds and removes whole systems and pulls cross-system dependencies with a note. `ModuleCard`/`ModuleDetail` are gone.
- **Families present as systems, permissions cut per module.** The sidebar heads each family as "ระบบ…" and lists every part of it; parts the account may not open are drawn locked rather than hidden. `Role.modules` replaces `Role.families`, gated everywhere through one `mayOpen(role, id)`. A payroll role is added so the split inside one system is visible: HR opens personnel/org/time but not payroll; payroll opens payroll/personnel/time but not org. `SYSTEM_NAMES` in `lib/modules/types.ts` is the single source of the buyer-facing names; the registry's `FAMILIES`, the ERP shell, the marketplace and the generated shell all read it. The marketplace groups listings under their system with an "เพิ่มทั้งระบบ" action.
- **The Recruitsmart-style visual language** for the demo system: grey page, hairline white cards, one violet accent, line icons on every label (`lucide-react`), and motion that answers actions (`motion`). Both libraries are now scaffold base dependencies so a generated project renders identically. `demo/modules/ui.tsx` gains `Avatar`, `IconRow`, `SectionTitle`, `StatStrip`, `Segmented`, `ViewToggle`, `Progress`, `Stepper`, `Timeline`, `Chip`, `Button`, `IconButton`, `Reveal`; `kit.tsx` gains `DetailModal` (large, centred, with a prev/next pager) and a `ConfirmDialog` that takes a `subject` card and `fields`.
- **Personnel records rebuilt as a candidate-management-style screen**: a divided stat strip on top, segmented status filter with counts, list/grid toggle, a table with avatars, icons, status badges, favourites and a per-row menu; a large detail modal with a profile column (mailto, contact, employment, note composer) and six tabs (contract stepper, document-compliance progress, event and activity timelines, benefit tiles); a resignation dialog with a subject card, reason select and a template-drafted message.
- **The management-system kit** (`demo/modules/kit.tsx`, composer-owned like `ui.tsx`): a data table with a sticky header, per-column sorting, a density toggle, row selection with a contextual bulk bar and Enter-to-open; a slide-out `Drawer` for row detail; a `ConfirmDialog` that can require typing a word; and a `Wizard` that validates on leaving each step rather than at submit.
- **A module overview page.** `/erp/[module]` now renders the module's own dashboard and `/erp/[module]/[n]` its capabilities. Personnel records ships the first one: headline figures with year-over-year movement, a twelve-month headcount column chart, what falls due inside 120 days, headcount by department and the latest personnel events — all derived, none stored.
- **A trial switcher** in the top bar (`app/erp/TrialSwitcher.tsx`): while trialling one module, jump straight to trialling another, grouped by family with the current one ticked, plus a way out to the whole system and a shortcut to that module's marketplace listing.
- **Shell chrome for people who live in it**: a sidebar that collapses to icons, breadcrumbs, a Cmd/Ctrl+K command palette over every module and capability, and a notification bell whose contents are derived from the same data the screens read (`app/erp/alerts.ts`).
- **Dark mode** for the demo system, on the document root so it is a real theme. The generated project gets the class-based `dark:` variant through the scaffold's inline Tailwind config, so a taken project behaves the same.
- Skeleton loading states, in the table and as `app/erp/[module]/loading.tsx`.
- **`/marketplace` — the catalogue as a shop.** Each module is a listing with its price, its capabilities and what it must be bought alongside; `/marketplace/[id]` gives the full capability list, what the module reads and who reads it. Filter by family, search across names, SAP codes and capability names. Public, same as `/erp`.
- **A scope basket** (`components/marketplace/scope.ts`) that survives navigation: adding a module pulls in its transitive dependencies and says which and why; removing one drops whatever was left reading from it, so the scope is always buildable.
- `lib/modules/start-project.ts` — the one path from a chosen scope to a built project, shared by the marketplace and the ERP header.
- **`/erp` — the standard system as a running web app**, not a generator. Sign in as one of four roles, get a sidebar of the modules that role can open, and use them. Public (listed in `PUBLIC_PREFIXES`): it exists to answer "what am I buying?" before anyone has an account.
- **Role-based access** that is enforced, not decorative: `app/erp/[module]/ModuleView.tsx` gates on the signed-in role, so typing a module URL you lack rights to returns a refusal panel rather than the screen.
- **"Take these modules as a project"** in the ERP header — the scope is what the role can open, so it is chosen by using the system rather than ticked off a list first.
- `demo/modules/**` as the single source of truth: real typed `.tsx`/`.ts` the product renders as pages. `scripts/sync-module-sources.mjs` (`npm run modules:sync`) generates `lib/modules/generated/sources.ts` for the WebContainer, and `lib/__tests__/modules-source-sync.test.ts` fails if it goes stale.
- `demo/modules/ui.tsx` — one typed set of screen pieces (card, table head, badge, bar, modal, stat) replacing ten drifting copies. Composer-owned, shipped like the app shell.
- **Module catalog** (`lib/modules/`): a "เลือกโมดูล" picker on the landing page beside the template picker. Ticking modules composes a runnable project — screens, a PRD section and a quotation (effort days + monthly MA) — with no AI call.
- **HR family, four modules, full key-feature coverage** matching the SAP module each is named after: PA (personal / contract / administrative data, personnel events, compensation & benefits), OM (org structure, positions & jobs, assignments, headcount planning, qualifications, reporting), PT (work schedule planning, time recording, absence management, attendance tracking), PY (payroll calculation, benefits, absence & lateness, statutory deductions, payment management).
- **Logistics family**: MM (material & vendor master, requisitions & purchase orders, goods receipt with three-way invoice match, stock, vendor rating), PP (production master data, MRP, capacity planning, production orders, output reporting), SD (customer master, pricing & discounts, sales orders, shipping, billing, credit limits), WM (bin structure, putaway, picking, internal transfers, physical inventory).
- **Finance family**: FI (chart of accounts & journal, payables, receivables, fixed assets, financial statements), CO (cost centres, internal orders, product costing, gross-margin analysis, profit centres).
- **Cross-family entity contract**: accounting reads `vendor` from purchasing and `customer` from sales, so the journal is generated from real sales orders and supplier invoices. `lib/__tests__/modules-families.test.ts` holds the chain: every declared need has a provider, no module both provides and needs the same entity, and every module becomes buyable by adding its transitive closure.
- `Module.keyFeatures` — the capability list a module claims. `lib/__tests__/modules-coverage.test.ts` holds each module's own generated source and quotation copy against it, so a module cannot claim a feature it does not build.

### Changed
- **One capability per page.** Each module screen takes a `section` prop and renders only that capability; the in-page tab strips are gone. The sidebar expands the open module into its `keyFeatures`, each at `/erp/[module]/[n]`, and the composer's generated shell carries the same two-level sidebar so a built project navigates the way the demo does.
- The personnel register's columns follow the chosen capability rather than staying fixed, and opening a record lands on that part of it.
- The landing page's second entry point is now the marketplace rather than a module picker or a bare link into `/erp`; `components/landing/ModuleGallery.tsx` and `LaunchPad`'s `createFromModules` are gone, their job moved into the running system.
- The composer orders tabs by family before data flow, so a ten-module demo reads as whole businesses rather than interleaving personnel and warehouse screens. `FAMILY_ORDER` must stay dependency-safe for this to remain correct.
- The module picker groups by family and puts each module's dependency on its own card; one tap adds a selection's whole transitive closure rather than one provider at a time.
- Every demo figure is computed, not hard-coded: withholding tax walks the real PIT bands, social security is 5% capped at ฿750, absence is priced off the daily rate, and lateness is judged against the roster shift.

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
- The navigation offered "ภาพรวม" for every module although only personnel records has a dashboard, so the entry showed the first capability instead. `Module.hasOverview` now gates the entry in both shells and the command palette, and the first capability is highlighted where there is no dashboard.
- "ลองใช้" from a marketplace listing opened the whole suite. `?only=<id>` now narrows the shell to that one module — sidebar, command palette, alerts and the take-as-project action — and every in-shell link carries it so a capability click does not silently widen the trial. "ดูทั้งระบบ" leaves it. It is a view scope, not a permission: the role still decides what may be opened at all.
- The new-employee form let you type one character per field. `Text` was declared inside `NewEmployee`, so every keystroke produced a new component type and React remounted the input, taking the caret with it. Declared at module scope.
- An expired contract counted down past zero ("เหลือ -5 วัน"). It now reads as expired.

### Fixed
- Shift `S` (กะเสริม) appeared in a roster but was never declared in `SHIFTS`. The old code hid it behind a lookup that printed "เสริม" when it found nothing; once lookups started throwing, the roster crashed. Fixed in the data, where the gap was.

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
