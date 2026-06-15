# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

- `npm run dev` — start dev server (Turbopack, default in Next 16)
- `npm run build` — production build
- `npm run lint` — ESLint (flat config in `eslint.config.mjs`; `next lint` is removed in Next 16)
- `npx next typegen` — regenerate route type helpers (`PageProps`, `LayoutProps`, `RouteContext`)

No test framework is configured yet.

## Next.js 16 — differences from training data

This project uses Next.js 16.2.9, which has breaking changes vs. what you likely know. The version-matched docs live in `node_modules/next/dist/docs/` (mirrors nextjs.org structure: `01-app/01-getting-started/`, `02-guides/`, `03-api-reference/`). Read the relevant doc before writing Next.js code. Highlights:

- **Async request APIs only**: `cookies()`, `headers()`, `draftMode()`, and `params`/`searchParams` props are Promises — synchronous access is fully removed. Type pages as `PageProps<'/route/[slug]'>` and `await props.params`.
- **`middleware.ts` is now `proxy.ts`** (project root, exports the same functionality under the Proxy name).
- **Cache Components** is the caching model: `cacheComponents: true` in `next.config.ts`, `'use cache'` directive with `cacheLife()` for data- or UI-level caching. The old fetch-options caching model is documented separately in `02-guides/caching-without-cache-components.md`.
- **`revalidateTag(tag, profile)`** now requires a second `cacheLife` profile argument; use the new `updateTag(tag)` in Server Actions for read-your-writes semantics.
- **Instant navigation**: routes that should navigate instantly export `unstable_instant`; with Cache Components, uncached data must sit behind correctly-placed `<Suspense>` boundaries (see `02-guides/instant-navigation.md` — boundaries in a root layout don't cover sibling client navigations).

## What this project is

The product is **FITT Builder** — an AI-powered web demo builder where non-developers type a natural-language prompt (Thai or English) and get a runnable web demo in the browser. Requirements live in `docs/brief-plans/PRD.md` and `docs/brief-plans/BRD.md` (written in Thai; they predate the rename and still say "PromptBuild"). The design system ("midnight studio": black canvas, Inter+Anuphan, single `#64cefb` accent) is specified in `docs/brief-plans/design.md` and implemented as tokens in `app/globals.css`.

Stack as implemented: Google Gemini (`@google/genai`) for code generation, WebContainers API for in-browser preview (needs COOP/COEP headers, see `next.config.ts`), Monaco Editor, localStorage persistence, Tailwind v4. Auth/Prisma/Stripe are deferred — see the production checklist in `README.md`.

## Conventions

- TypeScript strict mode; path alias `@/*` maps to the repo root.
- Tailwind CSS v4: configured in CSS via `@theme` in `app/globals.css` (no `tailwind.config` file); PostCSS plugin is `@tailwindcss/postcss`.

### Foundational Mindset

1. **Detective mindset:** Treat bugs as a crime scene; find a theory, gather evidence, and only fix after proof.
2. **Zero speculation:** Verify API and library behaviors via documentation or testing instead of assuming.
3. **Read before writing:** Absorb the local codebase and architectural context fully before generating solutions.
4. **Strict type safety:** Rely on precise compile-time constraints rather than loose, unpredictable structures.
5. **Explicit over implicit:** Prefer clear, readable code flow over clever shortcuts or magic abstractions.

### Design Principles

6. **Don't overengineer:** Simple beats complex.
7. **No fallbacks:** One correct path, no alternatives.
8. **One way:** One way to do things, not many.
9. **Clarity over compatibility:** Clear code beats backward compatibility.
10. **Throw errors:** Fail fast when preconditions aren't met.
11. **No backups:** Trust the primary mechanism.
12. **Separation of concerns:** Each function should have a single responsibility.

### Development Methodology

13. **Surgical changes only:** Make minimal, focused fixes.
14. **Evidence-based debugging:** Add minimal, targeted logging.
15. **Fix root causes:** Address the u**nderlying issue, not just symptoms.**
16. **Simple > Complex:** Let TypeScript catch errors instead of excessive runtime checks.
17. **Collaborative process:** Work with user to identify most efficient solution.

### Agentic Guardrails (2026 Execution)

18. **Toolchain validation:** Use environment tools (linters, test runners, type-checkers) to verify code health empirically.
19. **Propose before action:** Present the "theory of the crime" and exact evidence to the user before executing file writes.
20. **Diff-only generation:** Output only the specific lines changing; never rewrite unchanged context or entire files.

## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- For cross-module "how does X relate to Y" questions, prefer `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` over grep — these traverse the graph's EXTRACTED + INFERRED edges instead of scanning files
- After modifying code files in this session, run `graphify update .` to keep the graph current (AST-only, no API cost)
