# Merge Plan — vibecode-editor → FITT Builder

> **LOCKED SCOPE (confirmed 2026-06-18):** Build **Tier A in full**. **Defer auth/DB** (keep
> localStorage). **Keep the single Vite app** (AI-generated) — no multi-stack templates for now.
> Build order: A.1 multi-file editor → A.4 terminal upgrades → A.3 inline autocomplete → A.2 chat side-panel.
>
> Implementation choice: keep FITT's flat `ProjectFiles = Record<path,string>` as the single source
> of truth (don't import vibecode's nested TemplateFolder/Zustand/DB model). The new editor DERIVES a
> tree from flat paths, so `stream-parse`, `/api/generate`, `lib/storage.ts` stay untouched.

Source studied: `/Users/itswatthachai/vibecode-playground` ("vibecode-editor"), a full
Next.js 15 web IDE. Goal: bring its capabilities + flow into FITT Builder while keeping
FITT's AI orchestration. Grounded in a per-subsystem code analysis (6 analysts).

## What each side is

- **vibecode** = a manual, multi-user, **DB-backed multi-stack web IDE**: OAuth login →
  dashboard → pick a stack template (React/Next/Vue/Angular/Express/Hono) → `/playground/[id]`
  full IDE (file-tree + multi-tab Monaco + xterm terminal + WebContainer preview + AI chat
  side-panel + Ollama inline autocomplete), everything saved to MongoDB via Prisma.
- **FITT** = an anonymous, localStorage, **single Vite+React app** driven by an **AI 6-phase
  orchestration** (Define→Plan→Build→Verify→Review→Ship) with incremental `<file>` streaming
  into a live WebContainer.

The merge = give FITT a **real IDE surface + AI code-assist**, with FITT's orchestration as the
brain. We do NOT copy everything verbatim — some of FITT's pieces are already better.

## Keep from FITT (do not replace)

- 6-phase agent orchestration: `agents/*/SKILL.md`, `/api/agent`, `/api/generate` incremental
  `<file>` streaming (`lib/stream-parse.ts`).
- WebContainer lifecycle (`lib/webcontainer.ts`): serialized runs, run supersession, per-project
  workdir reset, **IndexedDB node_modules snapshot** (`lib/idb.ts`), `startShell` (jsh), `readSource`.
  → vibecode's container layer is a weaker reimplementation (no snapshot, cold install every mount,
  `npm run start` mismatch). **Do not port it.**
- Gemini (`@google/genai`). → vibecode uses local Ollama; keep Gemini, just add routes.
- Midnight-studio theme (black + `#64cefb`, Inter/Anuphan, Tailwind v4). → vibecode is red/Poppins/shadcn.
- **FITT already has multi-project**: `/projects` (grid) + `/project/[id]` (studio) on localStorage —
  so vibecode's dashboard is mostly already covered.

## Add from vibecode — by effort tier

### Tier A — high value, fits FITT today (recommended first)
1. **Multi-file IDE editor** — port the file-tree + multi-tab model (`features/playground/`:
   `useFileExplorer` Zustand store, `path-to-json`, `file-utils`, `playground-explorer`, tab bar,
   CRUD dialogs). Replace FITT's single-file `CodePanel.tsx`. Retarget persistence → `lib/storage.ts`,
   sync → `lib/webcontainer.ts` (`writeFile`/`removeFile`). Route the Build stream's `<file>` blocks
   into the tree/tabs. *(adapt)*
2. **AI chat side-panel** — `features/ai-chat/` (attach files, 4 modes Chat/Review/Fix/Optimize,
   markdown + code blocks with Copy/Insert/Run). Add as a SEPARATE "ask AI about code" drawer
   (keep FITT's phase ChatPanel as primary). New `app/api/chat` on Gemini (`lib/gemini.ts`). *(adapt)*
3. **AI inline autocomplete** — `useAISuggestion` + Monaco ghost-text (Ctrl+Space / Tab / Esc) +
   overlay + settings toggle. New `app/api/code-suggestion` on Gemini. *(adapt)*
4. **Terminal UX upgrades** — borrow `terminal.tsx` addons (search, web-links, copy-selection,
   download-log, webgl) onto FITT's existing `startShell` PTY in `StatusBar` Shell tab. *(drop-in-ish)*

### Tier B — optional / later
5. **Multi-stack templates** — `vibecode-starters/` + `path-to-json` scan + `template-selector-modal`.
   Strip DB coupling; pre-scan starters to a static map; make the generator stack-aware (per-stack
   canonical package.json so the snapshot cache stays keyed). ⚠ Next.js + Angular starters likely
   **won't run in WebContainer** (the very reason FITT is on Vite); realistic set = React/Vue/Express/Hono.
   Conflicts with FITT's "one AI-generated Vite app" philosophy — treat as an alternate entry. *(adapt)*
6. **Dashboard polish** — borrow `project-card/table/star` UI to upgrade FITT's `/projects`, restyled. *(adapt)*

### Tier C — heavy infra / defer
7. **Auth + Database** — NextAuth v5 (`auth.ts`/`auth.config.ts`) + Prisma + a DB, for accounts,
   cross-device persistence, sharing. Must be reworked for **Next 16**: `middleware.ts` → `proxy.ts`,
   async request APIs; recommend **Postgres** over Mongo. Keep login OPTIONAL (vibecode gates
   everything; FITT's value is instant anonymous use). FITT's README already defers this. *(heavy)*

## Top conflicts to decide
- **Persistence**: localStorage (FITT) vs DB (vibecode) — mutually exclusive; FITT's "no fallbacks"
  principle says pick one. Recommend: stay localStorage now, add DB only in Tier C.
- **Editor**: single-file CodePanel → multi-file tree+tabs is a structural UI replacement (Tier A.1).
- **Stacks**: single Vite (AI-generated) vs multi-stack boilerplates — and Next/Angular don't run in WC.
- **AI**: keep Gemini; rewrite vibecode's Ollama routes onto `lib/gemini.ts`.
- **Theme**: every ported vibecode component needs restyling to midnight-studio tokens.

## Recommended roadmap
1. **A.1 multi-file editor** (biggest UX win; unlocks the rest) →
2. **A.4 terminal upgrades** (small, while in the editor) →
3. **A.3 inline autocomplete** + **A.2 chat side-panel** (the AI-assist layer) →
4. **B.6 dashboard polish** →
5. **B.5 multi-stack** (only if non-Vite demos are wanted) →
6. **C.7 auth + DB** (when accounts/sharing/cross-device are needed).
