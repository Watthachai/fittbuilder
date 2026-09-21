# Module Catalog — Design Spec

**Date:** 2026-09-21
**Status:** Draft — awaiting review
**Depends on:** `lib/skills/` (domain skill templates, 2026-06-22), `lib/design-templates.ts`

## Problem Statement

A buyer arrives saying "ผมอยากได้ระบบ HR" and means something specific: personnel records,
org chart, payroll, leave. Today that intent survives only as free text in one multi-select
answer inside `lib/skills/erp.ts` — six option strings with no price, no build spec, and no
relationship to each other. Selecting "HR" and "Finance" tells the system nothing about the
fact that both of them read the same employee table.

Three costs follow from that:

1. **The same screen is re-invented every time.** A demo with an employee register comes out
   differently on every build, because nothing describes what an employee register *is*.
2. **Nothing can be priced before it is built.** `PremiumOption` carries `effortDays` and feeds
   the quotation, but only for paid upsells — base scope has no equivalent, so a quotation for
   "HR + Finance" has to be assembled by hand.
3. **Scope is invisible to the buyer.** There is no artefact that says "this is what you are
   buying, these are the parts, this is what each part costs."

## Solution

A **module** becomes a first-class object: a named, priced, buildable unit of business
capability that a buyer recognises ("ทะเบียนพนักงาน") and the system can both demo and cost.

A project selects several modules. A **composer** turns that selection into a working demo,
a PRD section, and quotation line items. Modules never collide, because modules never own
shared files — the composer does.

## Locked Decisions

| Decision | Choice | Why |
|---|---|---|
| What a module carries | **Spec + build recipe + real source** (three faces) | The interview needs a persona and questions; the build needs binding instructions; consistency needs actual code |
| Relationship to existing types | **`Module` generalises `PremiumOption`**, gaining `tier: "base" \| "premium"` | `PremiumOption` already has `name`/`pitch`/`requires`/`effortDays`/`build`. A third overlapping concept would split pricing and MA logic across two places |
| Domain layer | **`SkillTemplate` unchanged** — it stays the persona/domain layer; modules hang off it | Modules are scope; skills are expertise. Different questions |
| Selection | **AI pre-selects, user adjusts** | Matches `SkillPicker`'s existing detect → confirm → gallery flow |
| Naming | **Thai name primary, SAP code as a searchable alias** | A buyer from SAP searches "PA"; a Thai SME does not know what PA means. We also do not claim to be SAP |
| Surviving the next Build | **Separate territory** — modules own `src/modules/<id>/`, the model owns everything else | Locking files would make "เปลี่ยนสีปุ่มหน้าทะเบียนพนักงาน" silently do nothing. Not locking means the second build destroys the module |
| Collisions | **Modules never touch shared files.** The composer generates `App.tsx`, navigation and routing | The only merge that exists today is "later wins", which loses a module with no error |
| Storage | **In-repo, real files**, like `lib/skills/` and `lib/scaffold.ts` | Code that must compile and be tested does not belong in a textarea. A DB-authored tier can come later |
| Entity sharing | Each module declares **`provides`** (entities it owns) and **`needs`** (entities it reads) | PY reads the employee PA owns. This promotes `PremiumOption.requires` from feature strings to entity names |
| Pricing | **Sum `effortDays`; sum MA per module per month.** No shared-infrastructure discount in v1 | The quotation already renders line items. A discount rule with no observed demand is speculation |

## Rejected, with reasons

These were considered in design and are recorded so they are not re-proposed.

| Rejected | Why |
|---|---|
| Ship module source that overwrites the demo's shared files | Dies twice: the next Build overwrites it (exactly how `SCAFFOLD_APP` dies on every project), and CRN rewrites the app from the documents regardless |
| Switch the WebContainer to Next.js so the demo *is* the product | Next.js does not run in WebContainer. `vercel/next.js#84026` and `stackblitz/webcontainer-core#1978` were both filed Sept 2025 and are both still open. It would also kill Wand, live cursors, the error reporter and the screen-capture bridge, all of which hang off the Vite plugin API, and invalidate the install cache for all 76 runnable projects |
| Send captured screenshots to CRN as a visual reference | Measured against 48 CRN traces: 96% of build time is the model writing code, no build below 93%. A search of 1,583 build messages found no instance of the agent guessing at appearance. The agent already screenshots its own output with Playwright, and compares against the demo *source* at behaviour level, which is finer than any image |

## Architecture

### The module type — `lib/modules/types.ts`

`Module` is `PremiumOption` widened. Every existing `PremiumOption` is a valid `Module` with
`tier: "premium"`, so the current premium catalogue migrates by adding one field.

The new parts are `provides`/`needs` (the entity contract), `family` (grouping), `sapCode`
(alias only), and `files` — the module's own source, confined to its own directory.

### The composer — `lib/modules/compose.ts`

One pure function is the whole seam:

```
composeModules(selected: Module[]) → {
  files:      ProjectFiles      // module dirs + generated App/nav/router
  prdSection: string            // scope text for the PRD
  quoteLines: QuoteLine[]       // one line per module
  missing:    string[]          // unsatisfied `needs`
}
```

Modules in, everything out. No IO, no network, no React. Dependency resolution, collision
prevention, pricing and document text are all decided here and nowhere else.

### Territory

- `src/modules/<id>/` — the module's own files. The generator is told this directory is
  authored and must be edited in place, never regenerated wholesale.
- `src/App.tsx`, navigation, routing — composer-generated, model-editable.

The generator's `ARCHITECTURE` contract (`lib/prompts.ts`) gains one rule describing the
split. This is guidance, not a lock: a user asking to change a module's screen must get
their change.

## User Stories

1. As a buyer, I want to see the parts of the system I am buying as a named list, so that I know what I am paying for.
2. As a buyer, I want each part to show a price, so that I can drop one I do not need.
3. As a buyer coming from SAP, I want to find "PA" by searching, so that I can map this to what I already know.
4. As a Thai SME owner who has never used SAP, I want parts named in Thai, so that I can read the list without a glossary.
5. As a salesperson, I want the AI to pre-select the obvious modules from the customer's brief, so that I do not start from an empty form.
6. As a salesperson, I want to add or remove a module after the AI's guess, so that I am not stuck with a wrong reading.
7. As a salesperson, I want a running total of days and monthly MA as I select, so that I can steer the conversation on price.
8. As a salesperson, I want the quotation to carry one line per module, so that the customer can see the breakdown without me rewriting it.
9. As a user selecting payroll without personnel records, I want to be told what is missing and offered the fix, so that I do not build a system that cannot work.
10. As a user, I want the employee table to be the same table in every module that uses it, so that data does not diverge between screens.
11. As a user, I want the demo of a module to look the same every time it is built, so that I can show it to a customer without re-checking it.
12. As a user, I want to ask for a change inside a module's screen and have it happen, so that the module is a starting point and not a cage.
13. As a developer, I want a module to be a file in the repo, so that it compiles, is reviewed and is tested like the rest of the code.
14. As a developer, I want one function to test composition through, so that collisions and dependency rules have a single place to be proven.
15. As a developer adding a module, I want the composer to reject a module that collides with a shared file, so that I find out at test time rather than in a customer's demo.
16. As CRN, I want the PRD to state the chosen modules explicitly, so that the production build scopes to the same parts the customer approved.
17. As a partner reselling this, I want the module list to be stable between quotes, so that the same scope produces the same price.
18. As an existing project, I want nothing to change until modules are chosen, so that 76 running demos keep working.
19. As a user of the existing premium upsell, I want my premium options to keep working, so that the migration costs me nothing.
20. As a reviewer of the quotation, I want the MA figure to be the sum of the module MA figures, so that the number is checkable by hand.

## Implementation Decisions

- `PremiumOption` is renamed to `Module` and widened; `tier` defaults to `"premium"` so
  existing catalogue entries migrate untouched. The pricing and MA logic keeps one home.
- Modules live one file per module under `lib/modules/`, aggregated by a registry, mirroring
  `lib/skills/registry.ts`.
- `provides`/`needs` are entity names, compared as strings. No schema language, no types
  describing types — the composer only needs to answer "is this satisfied".
- The composer is pure and synchronous. Anything requiring IO stays in the caller.
- The generator contract gains one rule about `src/modules/<id>/`. No new API parameter:
  module scope reaches the build through the brief and the PRD, exactly as design templates
  already do.
- The picker extends the existing `SkillPicker` moment rather than adding a new screen, and
  groups by `family` with a running total.
- v1 ships one family end to end rather than all three shallowly, so the composition rules
  are proven against a real dependency (payroll needing personnel records) before the
  catalogue is widened.

## Testing Decisions

A good test here asserts what a caller can observe: given these modules, what files, what
document text, what price, what missing dependencies. It must not reach into how the
composer decides.

**One seam: `composeModules`.** Every rule is provable through it, with no mounting, no
network and no React — matching the existing pure-function tests in `lib/__tests__/`.

Cases to cover:

- Two modules that both want a shared file — the shared file is composer-generated and
  neither module's copy appears.
- A module whose `needs` are unsatisfied — reported in `missing`, not silently dropped.
- The same selection composed twice — byte-identical output.
- Selection order changed — output unchanged.
- `quoteLines` sum to the same total as the sum of `effortDays`.
- An existing `PremiumOption` shaped object composes as `tier: "premium"` without change.

Prior art: `lib/__tests__/doc-sync.test.ts` and `lib/__tests__/agent-stream.test.ts` both
assert behaviour through one function and read as explanations of a past failure. The
collision case should be written the same way, because "later wins" losing a module silently
is the failure this design exists to prevent.

## Out of Scope

- Partner- or user-authored modules (DB-backed). In-repo only for v1.
- A discount for infrastructure shared between modules.
- Sending anything new to CRN — no payload change, no screenshots, no INDEX file.
- Changing the demo stack.
- All three SAP families. One family ships first.
- Any claim of SAP compatibility. SAP codes are search aliases and nothing more.

## Further Notes

The module source is used by the demo only. CRN rebuilds the production app from the
documents, so the durable output of a module is the PRD section it contributes, not its
`.tsx` files. The source exists to make the demo consistent and fast, which is worth doing
on its own, but it should not be mistaken for shipping production code.

## Verification

- `npm test` — composer cases above.
- `npx tsc --noEmit`, `npm run lint`, `npm run build`.
- Manual: select two modules with a dependency between them, build, confirm both appear and
  share one entity; then ask the AI to change something inside one module's screen and
  confirm the change lands.
