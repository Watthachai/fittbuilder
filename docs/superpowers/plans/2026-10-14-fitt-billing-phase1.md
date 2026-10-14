# FITT Billing integration — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** FITT Billing App can pull a customer project's data (project, customer, priced quotations, monthly/yearly billing cycle, MA, proposals, BRD/PRD) from FITT Builder through a token-protected read API, and quotations let the seller pick the MA billing cycle.

**Architecture:** A pure serializer (`lib/billing/serialize.ts`) turns stored rows into the contract JSON using the same quote math the editor prints with; a service-role store (`lib/billing/store.ts`) reads rows scoped to the token's workspace; two Next route handlers under `/v1/integrations/billing/` glue auth, rate limit, store and serializer. The billing cycle is one new field on the quote's `Maintenance`, rendered on screen, on paper, in Word and in the MA clause. Migration 0054 adds the `FITT_BILLING` credential type and the billing-status tables Phase 2 writes to.

**Tech Stack:** Next.js 16.3.5 route handlers, TypeScript, Supabase Postgres via `@supabase/supabase-js` (service role, hand-authored types in `lib/db/types.ts`), vitest (`lib/__tests__/*.test.ts`), plain SQL migrations applied with `npm run db:migrate`.

**Spec:** `docs/superpowers/specs/2026-10-14-fitt-billing-integration-design.md` — Phase 1 = spec §1, §2, §3 (the two GET endpoints and credentials). Phase 2 (status PUT, license key, `/v1/service-status`, CRN switch) is a separate plan.

## Global Constraints

- Work only in the worktree `~/fitt-builder-billing-api` on branch `feature/billing-api`. Never touch `~/fitt-builder-v2` (another session ships user cases from it).
- No new npm dependencies.
- UI and API message strings are Thai; code comments are English and explain *why*, matching the surrounding files.
- `billingCycle` is `"monthly" | "yearly" | null`; `null` means "not chosen yet". Old quotations without the field read as `null`.
- Migration number is `0054`. Existing `FITT_VOICE` bindings must stay valid.
- API base path `/v1/integrations/billing` (already public in `lib/supabase/middleware.ts`). Auth `Authorization: Bearer <token>`; only the SHA-256 of a token is stored; producer `FITT_BILLING`; a token sees only projects whose `org_id` equals its binding's `org_id`.
- Error body: `{ schemaVersion: "fittbuilder.error.v1", code, message, retryable, requestId }` with `code` ∈ `unauthorized` (401), `not_found` (404), `invalid_request` (400), `rate_limited` (429, with `Retry-After`), `internal` (500). `retryable` is true only for `rate_limited` and `internal`.
- Project detail `schemaVersion` is `"fittbuilder.billing.project.v1"`. Money comes from `quoteTotals`, `paymentSchedule`, `maintenanceTotals`, `lineTotal` in `lib/quote.ts` — never re-derived.
- Never log tokens, request bodies or document contents. The service-role client (`lib/supabase/admin.ts`) is server-only.
- No `git push`, no deploy, no migration applied to any database, no credential issued — those are release steps that need the user's explicit approval (see "Release" at the end).
- Checks: `npx vitest run <file>` per task; at the end `npm test`, `npx tsc --noEmit`, `npm run lint`.

## Review Focus

1. A quotation saved before this feature, or with a junk `billingCycle` such as `"weekly"`, must load with `billingCycle: null`, never throw or drop the document — Task 1 test.
2. A project with no quotation, no proposal and no BRD/PRD must return `200` with `customer: null`, `quotes.{standard,premium}: null`, `documents.{brd,prd}: null`, never a 500 — Task 4 test.
3. A lump-sum quotation's row amounts do not add up to its subtotal; the detail must carry `lumpSum` so Billing does not re-add rows — Task 4 test.
4. A FITT Voice token, a revoked token, or a token from another workspace must not read a project: 401 for the first two, 404 for a project outside the token's workspace — Tasks 3 and 5 tests.
5. Malformed list parameters (`limit=abc`, `limit=0`, `limit=500`, a garbage `cursor`, an unparsable `updatedSince`) must answer 400 `invalid_request`, never 500 — Task 5 test.

## File Structure

| File | Responsibility |
|---|---|
| `lib/quote.ts` (modify) | `BillingCycle` type, `BILLING_CYCLE_LABEL`, `Maintenance.billingCycle`, default and parsing |
| `components/studio/QuoteTerms.tsx` (modify) | "รอบชำระ MA" select in the MA panel |
| `lib/quote-clauses.ts` (modify) | MA clause names the billing cycle |
| `components/studio/QuotationPrint.tsx` (modify) | printed MA table row "รอบการชำระ" |
| `lib/quotation-word.ts` (modify) | Word MA table row "รอบการชำระ" |
| `supabase/migrations/0054_fitt_billing.sql` (create) | `FITT_BILLING` producer; `fittbuilder_project_billing`, `fittbuilder_project_billing_events` |
| `lib/db/types.ts` (modify) | hand-authored types for the two new tables |
| `scripts/billing-binding.mjs` (create) | issue / list / revoke a Billing credential per workspace |
| `lib/billing/types.ts` (create) | contract types shared by serializer, store and routes |
| `lib/billing/errors.ts` (create) | error envelope response |
| `lib/billing/store.ts` (create) | service-role reads: binding lookup, org snapshot, project bundle |
| `lib/billing/authenticate.ts` (create) | Bearer token → binding |
| `lib/billing/serialize.ts` (create) | pure: summaries, paging, detail |
| `app/v1/integrations/billing/projects/route.ts` (create) | `GET /projects` |
| `app/v1/integrations/billing/projects/[id]/route.ts` (create) | `GET /projects/{id}` |
| `docs/integrations/fitt-billing.md` (create) | the contract for the Billing team |
| `lib/changelog.ts` (modify) | release note |

---

### Task 1: Billing cycle on the quotation's maintenance

**Files:**
- Modify: `lib/quote.ts` (types near line 142, `defaultMaintenance` near line 399, `parseDoc` `ma:` block near line 642)
- Test: `lib/__tests__/quote.test.ts` (append)

**Interfaces:**
- Produces: `export type BillingCycle = "monthly" | "yearly"`; `export const BILLING_CYCLE_LABEL: Record<BillingCycle, string>`; `Maintenance.billingCycle: BillingCycle | null`.

- [ ] **Step 0: Install dependencies in the worktree (once)**

Run: `cd ~/fitt-builder-billing-api && npm ci`
Expected: completes without errors (the worktree has no `node_modules` yet).

- [ ] **Step 1: Write the failing test** — append to `lib/__tests__/quote.test.ts` (add `BILLING_CYCLE_LABEL` to the existing import from `"@/lib/quote"` or `"../quote"` — use whichever path the file already imports from):

```ts
describe("MA billing cycle (FITT Billing reads it)", () => {
  it("starts unchosen", () => {
    expect(defaultMaintenance().billingCycle).toBeNull();
  });

  it("keeps monthly and yearly, and reads old or junk values as unchosen", () => {
    const base = { rows: [] };
    const cycle = (ma: unknown) => parseDoc({ ...base, ma }, "2026-10-14")!.ma.billingCycle;
    expect(cycle({ enabled: true, billingCycle: "monthly" })).toBe("monthly");
    expect(cycle({ enabled: true, billingCycle: "yearly" })).toBe("yearly");
    expect(cycle({ enabled: true })).toBeNull();
    expect(cycle({ enabled: true, billingCycle: "weekly" })).toBeNull();
    expect(cycle(undefined)).toBeNull();
  });

  it("labels each cycle in Thai", () => {
    expect(BILLING_CYCLE_LABEL).toEqual({ monthly: "รายเดือน", yearly: "รายปี" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/__tests__/quote.test.ts`
Expected: FAIL — `BILLING_CYCLE_LABEL` is not exported / `billingCycle` is undefined.

- [ ] **Step 3: Implement** in `lib/quote.ts`

Directly above `export interface Maintenance`:

```ts
/**
 * How the customer pays for maintenance once it starts being billed. FITT
 * Billing reads it to set up the invoice cycle; null until someone picks, so a
 * quotation never claims a cycle nobody agreed.
 */
export type BillingCycle = "monthly" | "yearly";

export const BILLING_CYCLE_LABEL: Record<BillingCycle, string> = {
  monthly: "รายเดือน",
  yearly: "รายปี",
};
```

Inside `interface Maintenance`, after `note: string;`:

```ts
  /** Null until chosen. Printed with the MA terms and sent to FITT Billing. */
  billingCycle: BillingCycle | null;
```

In `defaultMaintenance()`, after `note: "",`:

```ts
    billingCycle: null,
```

In `parseDoc`, inside the returned `ma: { ... }` block, after `note: str(ma.note),`:

```ts
      // Quotations saved before the field existed have none; a value we don't
      // know is treated the same rather than printed.
      billingCycle: ma.billingCycle === "monthly" || ma.billingCycle === "yearly" ? ma.billingCycle : null,
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npx vitest run lib/__tests__/quote.test.ts && npx tsc --noEmit`
Expected: PASS, and no type errors (if `tsc` reports another object literal typed `Maintenance` without `billingCycle`, add `billingCycle: null` there).

- [ ] **Step 5: Commit**

```bash
git add lib/quote.ts lib/__tests__/quote.test.ts
git commit -m "feat(quote): MA billing cycle (monthly/yearly), unchosen by default"
```

---

### Task 2: Show and edit the billing cycle — panel, clause, print, Word

**Files:**
- Modify: `components/studio/QuoteTerms.tsx` (MA section, after the 4-column grid ending near line 580)
- Modify: `lib/quote-clauses.ts` (the `if (doc.ma.enabled)` block near line 101)
- Modify: `components/studio/QuotationPrint.tsx` (MA table near line 331; import list at line 3)
- Modify: `lib/quotation-word.ts` (`maintenance()` near line 346 and its call near line 78)
- Test: `lib/__tests__/quote-clauses.test.ts`, `lib/__tests__/quotation-print.test.ts`, `lib/__tests__/quotation-word.test.ts` (append)

**Interfaces:**
- Consumes: `BillingCycle`, `BILLING_CYCLE_LABEL`, `Maintenance.billingCycle` (Task 1).
- Produces: `maintenance(ma: MaintenanceTotals, cycle: BillingCycle | null)` inside `lib/quotation-word.ts` (file-local).

- [ ] **Step 1: Write the failing tests**

Append to `lib/__tests__/quote-clauses.test.ts` inside its main `describe` (reuse the file's `doc()` helper and `defaultMaintenance` import):

```ts
  it("names the MA billing cycle once one is chosen", () => {
    const clause = (billingCycle: "monthly" | "yearly" | null) =>
      acceptanceClauses(doc({ ma: { ...defaultMaintenance(), enabled: true, billingCycle } })).join("\n");
    expect(clause("monthly")).toContain("ชำระเป็นรายเดือน");
    expect(clause("yearly")).toContain("ชำระเป็นรายปี");
    expect(clause(null)).not.toContain("ชำระเป็น");
  });
```

Append to `lib/__tests__/quotation-print.test.ts`:

```ts
describe("the printed MA table", () => {
  it("prints the billing cycle row only when one is chosen", () => {
    const base = newDoc([], "Pace", "2026-10-12");
    const render = (billingCycle: "monthly" | "yearly" | null) =>
      renderToStaticMarkup(
        createElement(QuotationPrint, { doc: { ...base, ma: { ...base.ma, enabled: true, billingCycle } }, shots: [] })
      );
    expect(render("yearly")).toContain("รอบการชำระ");
    expect(render("yearly")).toContain("รายปี");
    expect(render(null)).not.toContain("รอบการชำระ");
  });
});
```

Append to `lib/__tests__/quotation-word.test.ts` (reuse its `quote()` helper and `NO_ART`):

```ts
describe("the Word MA table", () => {
  it("carries the billing cycle when one is chosen", async () => {
    const doc = quote();
    const withCycle = await readWord(
      quotationDocx({ ...doc, ma: { ...doc.ma, enabled: true, billingCycle: "monthly" } }, [], NO_ART)
    );
    expect(withCycle.body).toContain("รอบการชำระ");
    expect(withCycle.body).toContain("รายเดือน");
    const without = await readWord(quotationDocx({ ...doc, ma: { ...doc.ma, enabled: true, billingCycle: null } }, [], NO_ART));
    expect(without.body).not.toContain("รอบการชำระ");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/__tests__/quote-clauses.test.ts lib/__tests__/quotation-print.test.ts lib/__tests__/quotation-word.test.ts`
Expected: the three new tests FAIL (no cycle text anywhere yet).

- [ ] **Step 3: Implement**

`lib/quote-clauses.ts` — import `BILLING_CYCLE_LABEL` from `./quote` alongside `maintenanceTotals`, then replace the `out.push(...)` inside `if (doc.ma.enabled)` with:

```ts
    const cycle = doc.ma.billingCycle ? ` ชำระเป็น${BILLING_CYCLE_LABEL[doc.ma.billingCycle]}` : "";
    out.push(
      `${included}หลังจากนั้นคิดค่าบำรุงรักษา ${baht(t.annual)} ต่อปี ` +
        `(อัตราขั้นต่ำ ${baht(t.monthly)} ต่อเดือน สำหรับ ${t.modules} module)${cycle}`
    );
```

`components/studio/QuotationPrint.tsx` — add `BILLING_CYCLE_LABEL` to the import from `@/lib/quote` (line 3), and insert before `<tr className="q-ma-year2">`:

```tsx
                      {doc.ma.billingCycle && (
                        <tr>
                          <th>รอบการชำระ</th>
                          <td className="q-r">{BILLING_CYCLE_LABEL[doc.ma.billingCycle]}</td>
                        </tr>
                      )}
```

`lib/quotation-word.ts` — import `BILLING_CYCLE_LABEL` and `type BillingCycle` from `./quote` (or the path the file already uses). Change the call near line 78 to `maintenance(ma, doc.ma.billingCycle)`. Change the function:

```ts
function maintenance(ma: ReturnType<typeof maintenanceTotals>, cycle: BillingCycle | null): Table {
```

and, right before `lines.push(["ปีที่ 2 เป็นต้นไป", ...])`, add:

```ts
  if (cycle) lines.push(["รอบการชำระ", BILLING_CYCLE_LABEL[cycle], false]);
```

`components/studio/QuoteTerms.tsx` — after the closing `</div>` of the 4-column MA grid (the one containing "ปีที่ 2 เป็นต้นไป (฿/ปี)") and before `{ma.clamped && (`, insert:

```tsx
            <div className="mt-2.5 grid gap-2.5 sm:grid-cols-4">
              <Field label="รอบชำระ MA">
                <select
                  value={doc.ma.billingCycle ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    const billingCycle = v === "monthly" || v === "yearly" ? v : null;
                    onEdit((d) => ({ ...d, ma: { ...d.ma, billingCycle } }));
                  }}
                  className={inputCls}
                  disabled={readOnly}
                >
                  <option value="">ยังไม่เลือก</option>
                  <option value="monthly">รายเดือน</option>
                  <option value="yearly">รายปี</option>
                </select>
              </Field>
            </div>
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npx vitest run lib/__tests__/quote-clauses.test.ts lib/__tests__/quotation-print.test.ts lib/__tests__/quotation-word.test.ts && npx tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 5: Commit**

```bash
git add components/studio/QuoteTerms.tsx lib/quote-clauses.ts components/studio/QuotationPrint.tsx lib/quotation-word.ts lib/__tests__/quote-clauses.test.ts lib/__tests__/quotation-print.test.ts lib/__tests__/quotation-word.test.ts
git commit -m "feat(quote): pick the MA billing cycle, and print it on paper, in Word and in the MA clause"
```

---

### Task 3: Migration 0054, table types, credential script, store and authentication

**Files:**
- Create: `supabase/migrations/0054_fitt_billing.sql`
- Modify: `lib/db/types.ts` (add two tables beside `fittbuilder_integration_bindings`)
- Create: `scripts/billing-binding.mjs`
- Create: `lib/billing/types.ts`, `lib/billing/errors.ts`, `lib/billing/store.ts`, `lib/billing/authenticate.ts`
- Test: `lib/__tests__/billing-authenticate.test.ts`, `lib/__tests__/billing-errors.test.ts`

**Interfaces:**
- Produces (exact):
  - `lib/billing/types.ts`: `BillingErrorCode`, `BillingStatus`, `BillingBinding`, `ProjectRecord`, `DocRecord`, `BillingRow`, `OrgSnapshot`, `ProjectBundle`, `BillingCustomer`, `BillingQuote`, `BillingProposal`, `BillingProjectSummary`, `BillingProjectDetail`, `BillingPage` (definitions below).
  - `lib/billing/errors.ts`: `billingError(code: BillingErrorCode, message: string, requestId: string, retryAfter?: number): Response`
  - `lib/billing/store.ts`: `findBillingBinding(tokenHash: string): Promise<BillingBinding | null>`, `touchBillingBinding(id: string, now: Date): Promise<void>`, `loadOrgSnapshot(orgId: string): Promise<OrgSnapshot>`, `loadProjectBundle(orgId: string, projectId: string): Promise<ProjectBundle | null>`
  - `lib/billing/authenticate.ts`: `authenticateBilling(authorization: string | null, now?: Date): Promise<{ ok: true; binding: BillingBinding } | { ok: false; code: "unauthorized" | "internal"; message: string }>`

- [ ] **Step 1: Write the migration** `supabase/migrations/0054_fitt_billing.sql`

```sql
-- FITT Billing App: a service credential per workspace (producer FITT_BILLING)
-- that pulls project data, and the billing status a project's deployed app
-- obeys (written in phase 2). See docs/integrations/fitt-billing.md.

-- The producer check was declared inline in 0045, so its name is Postgres's
-- choice. Drop whatever check mentions `producer`, then name the new one.
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'fittbuilder_integration_bindings'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%producer%'
  loop
    execute format('alter table fittbuilder_integration_bindings drop constraint %I', c.conname);
  end loop;
end $$;
alter table fittbuilder_integration_bindings
  add constraint fittbuilder_integration_bindings_producer_check
  check (producer in ('FITT_VOICE', 'FITT_BILLING'));

-- A project without a row here is active.
create table if not exists fittbuilder_project_billing (
  project_id uuid primary key references fittbuilder_projects(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'suspended')),
  reason text not null default '',
  license_key_hash text unique check (license_key_hash ~ '^[a-f0-9]{64}$'),
  changed_at timestamptz not null default now(),
  changed_by uuid references fittbuilder_integration_bindings(id) on delete set null
);
alter table fittbuilder_project_billing enable row level security;

-- Every status change, kept: who, when and why a customer's app was suspended.
create table if not exists fittbuilder_project_billing_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references fittbuilder_projects(id) on delete cascade,
  status text not null check (status in ('active', 'suspended')),
  reason text not null default '',
  binding_id uuid references fittbuilder_integration_bindings(id) on delete set null,
  at timestamptz not null default now()
);
create index if not exists fittbuilder_project_billing_events_project_idx
  on fittbuilder_project_billing_events (project_id, at desc);
alter table fittbuilder_project_billing_events enable row level security;
-- No policies: both tables are read and written by the service role only.
```

- [ ] **Step 2: Add the table types** to `lib/db/types.ts`, directly after the `fittbuilder_integration_bindings` entry:

```ts
      /** A project's billing status, set by FITT Billing (migration 0054). No row = active. */
      fittbuilder_project_billing: {
        Row: {
          project_id: string;
          status: string;
          reason: string;
          license_key_hash: string | null;
          changed_at: string;
          changed_by: string | null;
        };
        Insert: {
          project_id: string;
          status?: string;
          reason?: string;
          license_key_hash?: string | null;
          changed_at?: string;
          changed_by?: string | null;
        };
        Update: {
          status?: string;
          reason?: string;
          license_key_hash?: string | null;
          changed_at?: string;
          changed_by?: string | null;
        };
        Relationships: [];
      };
      /** Every billing status change (migration 0054). */
      fittbuilder_project_billing_events: {
        Row: {
          id: string;
          project_id: string;
          status: string;
          reason: string;
          binding_id: string | null;
          at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          status: string;
          reason?: string;
          binding_id?: string | null;
          at?: string;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
```

- [ ] **Step 3: Write the credential script** `scripts/billing-binding.mjs` (same shape as `scripts/fittvoice-binding.mjs`, producer `FITT_BILLING`, prefix `fbb_`):

```js
// Issue, list or revoke the service credential FITT Billing App uses to read a
// workspace's projects (migration 0054). The credential is printed once and only
// its SHA-256 is stored — hand it over through the agreed secret channel, never
// in a document, a chat or a repository.
//
//   node scripts/billing-binding.mjs create <workspace-id> "<label>"
//   node scripts/billing-binding.mjs list   <workspace-id>
//   node scripts/billing-binding.mjs revoke <binding-id>
//
// Targets NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from the
// environment first, then .env.local / .env. It names the host it writes to.
import { createHash, randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function envValue(key) {
  if (process.env[key]) return process.env[key];
  for (const file of [".env.local", ".env"]) {
    if (!existsSync(file)) continue;
    const m = readFileSync(file, "utf8").match(new RegExp(`^${key}=(.*)$`, "m"));
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  }
  return "";
}

const url = envValue("NEXT_PUBLIC_SUPABASE_URL");
const key = envValue("SUPABASE_SERVICE_ROLE_KEY");
if (!url || !key) {
  console.error("✖ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });
console.log(`→ ${new URL(url).host}`);

const PRODUCER = "FITT_BILLING";
const [command, arg, label = ""] = process.argv.slice(2);

function fail(message) {
  console.error(`✖ ${message}`);
  process.exit(1);
}

if (command === "create" && arg) {
  const { data: org, error: orgError } = await db.from("fittbuilder_orgs").select("id, name").eq("id", arg).maybeSingle();
  if (orgError) fail(orgError.message);
  if (!org) fail(`workspace ${arg} not found`);
  const token = `fbb_${randomBytes(32).toString("base64url")}`;
  const tokenHash = createHash("sha256").update(token, "utf8").digest("hex");
  const { data, error } = await db
    .from("fittbuilder_integration_bindings")
    .insert({ org_id: org.id, producer: PRODUCER, token_hash: tokenHash, label })
    .select("id")
    .single();
  if (error) fail(error.message);
  console.log(`✓ binding ${data.id} → workspace "${org.name}" (${org.id})`);
  console.log(`\n  ${token}\n`);
  console.log("This is the only time the credential is shown. Send it through the secret channel.");
} else if (command === "list" && arg) {
  const { data, error } = await db
    .from("fittbuilder_integration_bindings")
    .select("id, label, created_at, last_used_at, revoked_at")
    .eq("org_id", arg)
    .eq("producer", PRODUCER)
    .order("created_at");
  if (error) fail(error.message);
  for (const b of data) console.log(`${b.id}  ${b.revoked_at ? "revoked" : "live   "}  ${b.created_at}  ${b.label}`);
  if (data.length === 0) console.log("(no FITT Billing credentials)");
} else if (command === "revoke" && arg) {
  const { data, error } = await db
    .from("fittbuilder_integration_bindings")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", arg)
    .eq("producer", PRODUCER)
    .is("revoked_at", null)
    .select("id");
  if (error) fail(error.message);
  console.log(data.length ? `✓ revoked ${arg}` : `nothing to revoke (${arg} not found or already revoked)`);
} else {
  console.log("usage: node scripts/billing-binding.mjs create <workspace-id> \"<label>\" | list <workspace-id> | revoke <binding-id>");
  process.exit(1);
}
```

- [ ] **Step 4: Write the shared types** `lib/billing/types.ts`

```ts
import type { Json } from "@/lib/db/types";
import type { BillingCycle, PaymentTerm } from "@/lib/quote";

/** The FITT Billing contract (docs/integrations/fitt-billing.md). */

export type BillingErrorCode = "unauthorized" | "not_found" | "invalid_request" | "rate_limited" | "internal";
export type BillingStatus = "active" | "suspended";

export interface BillingBinding {
  id: string;
  org_id: string;
}

/** A project as the store reads it. `files` is present only in a bundle. */
export interface ProjectRecord {
  id: string;
  name: string;
  phase: string;
  active_version: string;
  created_at: string;
  updated_at: string;
  files?: Json | null;
}

/** A stored quotation or proposal. `payload` is absent where the store didn't read it. */
export interface DocRecord {
  project_id: string;
  version: string;
  updated_at: string;
  payload?: Json;
}

export interface BillingRow {
  project_id: string;
  status: string;
  reason: string;
  changed_at: string;
  license_key_hash: string | null;
}

export interface OrgSnapshot {
  projects: ProjectRecord[];
  quotes: DocRecord[];
  proposals: DocRecord[];
  billing: BillingRow[];
}

export interface ProjectBundle {
  project: ProjectRecord;
  orgId: string;
  orgName: string;
  quotes: DocRecord[];
  proposals: DocRecord[];
  billing: BillingRow | null;
}

export interface BillingCustomer {
  name: string;
  attn: string;
  address: string;
  phone: string;
}

export interface BillingQuote {
  quoteNo: string;
  issuedAt: string;
  validDays: number;
  subject: string;
  currency: "THB";
  ratePerDay: number;
  vatPercent: number;
  rows: {
    name: string;
    pricing: "days" | "unit";
    days: number;
    qty: number;
    unit: string;
    unitPrice: number;
    note: string;
    sub: boolean;
    amount: number;
  }[];
  /** When enabled, `amount` is the agreed subtotal and replaces the rows' sum. */
  lumpSum: { enabled: boolean; amount: number };
  totals: { days: number; subtotal: number; discount: number; net: number; vat: number; grand: number };
  paymentSchedule: { when: PaymentTerm["when"]; percent: number; netDays: number; amount: number }[];
  maintenance: {
    enabled: boolean;
    billingCycle: BillingCycle | null;
    modules: number;
    perModule: number;
    monthly: number;
    includedMonths: number;
    includedValue: number;
    annual: number;
    note: string;
  };
  updatedAt: string;
}

export interface BillingProposal {
  proposalNo: string;
  issuedAt: string;
  subject: string;
  context: string;
  points: { problem: string; feature: string; outcome: string }[];
  excluded: string[];
  closing: string;
  quoteNo: string;
  updatedAt: string;
}

export interface BillingProjectSummary {
  id: string;
  name: string;
  phase: string;
  updatedAt: string;
  customerName: string | null;
  quoteNo: string | null;
  billingStatus: BillingStatus;
}

export interface BillingPage {
  items: BillingProjectSummary[];
  nextCursor: string | null;
}

export interface BillingProjectDetail {
  schemaVersion: "fittbuilder.billing.project.v1";
  project: {
    id: string;
    name: string;
    phase: string;
    orgId: string;
    orgName: string;
    activeVersion: string;
    createdAt: string;
    updatedAt: string;
  };
  customer: BillingCustomer | null;
  billing: { status: BillingStatus; reason: string; changedAt: string | null; licenseKeyIssued: boolean };
  quotes: { standard: BillingQuote | null; premium: BillingQuote | null };
  proposals: { standard: BillingProposal | null; premium: BillingProposal | null };
  documents: { brd: string | null; prd: string | null };
}
```

Note: if `PaymentTerm` is not exported from `lib/quote.ts`, use `string` for `when` instead of `PaymentTerm["when"]`.

- [ ] **Step 5: Write the failing tests**

`lib/__tests__/billing-errors.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { billingError } from "@/lib/billing/errors";

describe("billing error envelope", () => {
  it("maps each code to its status and marks only transient ones retryable", async () => {
    const cases = [
      ["unauthorized", 401, false],
      ["not_found", 404, false],
      ["invalid_request", 400, false],
      ["rate_limited", 429, true],
      ["internal", 500, true],
    ] as const;
    for (const [code, status, retryable] of cases) {
      const res = billingError(code, "ข้อความ", "req_1");
      expect(res.status).toBe(status);
      expect(await res.json()).toEqual({ schemaVersion: "fittbuilder.error.v1", code, message: "ข้อความ", retryable, requestId: "req_1" });
    }
  });

  it("tells a rate-limited caller when to come back", () => {
    expect(billingError("rate_limited", "ช้าลงหน่อย", "req_2", 17).headers.get("retry-after")).toBe("17");
  });
});
```

`lib/__tests__/billing-authenticate.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";

const store = {
  binding: { id: "bind_1", org_id: "org_1" } as { id: string; org_id: string } | null,
  fail: false,
  lookedUp: [] as string[],
};
const touched = vi.fn();
vi.mock("@/lib/billing/store", () => ({
  findBillingBinding: async (hash: string) => {
    store.lookedUp.push(hash);
    if (store.fail) throw new Error("db down");
    return store.binding;
  },
  touchBillingBinding: async (id: string) => touched(id),
}));

const { authenticateBilling } = await import("@/lib/billing/authenticate");

beforeEach(() => {
  store.binding = { id: "bind_1", org_id: "org_1" };
  store.fail = false;
  store.lookedUp = [];
  touched.mockReset();
});

describe("authenticateBilling", () => {
  it("looks the token up by its SHA-256 and counts the use", async () => {
    const r = await authenticateBilling("Bearer fbb_secret");
    expect(r).toEqual({ ok: true, binding: { id: "bind_1", org_id: "org_1" } });
    expect(store.lookedUp).toEqual([createHash("sha256").update("fbb_secret", "utf8").digest("hex")]);
    expect(touched).toHaveBeenCalledWith("bind_1");
  });

  it("refuses a missing header, a non-Bearer header and an unknown or revoked token", async () => {
    expect(await authenticateBilling(null)).toMatchObject({ ok: false, code: "unauthorized" });
    expect(await authenticateBilling("Basic abc")).toMatchObject({ ok: false, code: "unauthorized" });
    store.binding = null;
    expect(await authenticateBilling("Bearer fvb_voice_token")).toMatchObject({ ok: false, code: "unauthorized" });
    expect(touched).not.toHaveBeenCalled();
  });

  it("answers internal, not unauthorized, when the database is down", async () => {
    store.fail = true;
    expect(await authenticateBilling("Bearer fbb_secret")).toMatchObject({ ok: false, code: "internal" });
  });
});
```

- [ ] **Step 6: Run tests to verify they fail**

Run: `npx vitest run lib/__tests__/billing-errors.test.ts lib/__tests__/billing-authenticate.test.ts`
Expected: FAIL — modules `@/lib/billing/errors` and `@/lib/billing/authenticate` not found.

- [ ] **Step 7: Implement** `lib/billing/errors.ts`, `lib/billing/store.ts`, `lib/billing/authenticate.ts`

`lib/billing/errors.ts`:

```ts
import type { BillingErrorCode } from "./types";

const STATUS: Record<BillingErrorCode, number> = {
  unauthorized: 401,
  not_found: 404,
  invalid_request: 400,
  rate_limited: 429,
  internal: 500,
};

/** The shared error envelope (fittbuilder.error.v1). Only transient failures are worth sending again. */
export function billingError(code: BillingErrorCode, message: string, requestId: string, retryAfter?: number): Response {
  const headers: Record<string, string> = { "cache-control": "no-store" };
  if (code === "rate_limited" && retryAfter) headers["retry-after"] = String(retryAfter);
  return Response.json(
    {
      schemaVersion: "fittbuilder.error.v1",
      code,
      message,
      retryable: code === "rate_limited" || code === "internal",
      requestId,
    },
    { status: STATUS[code], headers }
  );
}
```

`lib/billing/store.ts`:

```ts
import { createAdminClient } from "@/lib/supabase/admin";
import type { BillingBinding, BillingRow, DocRecord, OrgSnapshot, ProjectBundle, ProjectRecord } from "./types";

/**
 * Every database read behind the FITT Billing API (migration 0054). Service
 * role, server only — the routes have already decided which workspace is
 * asking, and every read here is scoped to it. Each throws on a database
 * error; the caller answers "try again", never a guess.
 */

const PRODUCER = "FITT_BILLING";
/** `.in()` travels in the URL; batches keep a large workspace under its limit. */
const IN_BATCH = 100;

function must<T>(r: { data: T; error: { message: string } | null }, what: string): T {
  if (r.error) throw new Error(`${what}: ${r.error.message}`);
  return r.data;
}

function batches(ids: string[]): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < ids.length; i += IN_BATCH) out.push(ids.slice(i, i + IN_BATCH));
  return out;
}

export async function findBillingBinding(tokenHash: string): Promise<BillingBinding | null> {
  const r = await createAdminClient()
    .from("fittbuilder_integration_bindings")
    .select("id, org_id")
    .eq("token_hash", tokenHash)
    .eq("producer", PRODUCER)
    .is("revoked_at", null)
    .maybeSingle();
  return must(r, "billing binding lookup");
}

export async function touchBillingBinding(id: string, now: Date): Promise<void> {
  const r = await createAdminClient()
    .from("fittbuilder_integration_bindings")
    .update({ last_used_at: now.toISOString() })
    .eq("id", id);
  must(r, "billing binding touch");
}

/** Every project of the workspace, without its files, plus what is needed to list them. */
export async function loadOrgSnapshot(orgId: string): Promise<OrgSnapshot> {
  const db = createAdminClient();
  const projects: ProjectRecord[] = must(
    await db
      .from("fittbuilder_projects")
      .select("id, name, phase, active_version, created_at, updated_at")
      .eq("org_id", orgId),
    "billing projects"
  );
  const snapshot: OrgSnapshot = { projects, quotes: [], proposals: [], billing: [] };
  for (const ids of batches(projects.map((p) => p.id))) {
    const [quotes, proposals, billing] = await Promise.all([
      db.from("fittbuilder_project_quotes").select("project_id, version, payload, updated_at").in("project_id", ids),
      db.from("fittbuilder_project_proposals").select("project_id, version, updated_at").in("project_id", ids),
      db
        .from("fittbuilder_project_billing")
        .select("project_id, status, reason, changed_at, license_key_hash")
        .in("project_id", ids),
    ]);
    snapshot.quotes.push(...(must(quotes, "billing quotes") as DocRecord[]));
    snapshot.proposals.push(...(must(proposals, "billing proposals") as DocRecord[]));
    snapshot.billing.push(...(must(billing, "billing status") as BillingRow[]));
  }
  return snapshot;
}

/** One project of the workspace with everything the detail needs; null when it isn't the workspace's. */
export async function loadProjectBundle(orgId: string, projectId: string): Promise<ProjectBundle | null> {
  const db = createAdminClient();
  const project = must(
    await db
      .from("fittbuilder_projects")
      .select("id, name, phase, active_version, files, created_at, updated_at")
      .eq("id", projectId)
      .eq("org_id", orgId)
      .maybeSingle(),
    "billing project"
  ) as ProjectRecord | null;
  if (!project) return null;
  const [org, quotes, proposals, billing] = await Promise.all([
    db.from("fittbuilder_orgs").select("name").eq("id", orgId).maybeSingle(),
    db.from("fittbuilder_project_quotes").select("project_id, version, payload, updated_at").eq("project_id", projectId),
    db.from("fittbuilder_project_proposals").select("project_id, version, payload, updated_at").eq("project_id", projectId),
    db
      .from("fittbuilder_project_billing")
      .select("project_id, status, reason, changed_at, license_key_hash")
      .eq("project_id", projectId)
      .maybeSingle(),
  ]);
  return {
    project,
    orgId,
    orgName: (must(org, "billing org") as { name: string } | null)?.name ?? "",
    quotes: must(quotes, "billing quotes") as DocRecord[],
    proposals: must(proposals, "billing proposals") as DocRecord[],
    billing: must(billing, "billing status") as BillingRow | null,
  };
}
```

`lib/billing/authenticate.ts`:

```ts
import { createHash } from "node:crypto";
import { findBillingBinding, touchBillingBinding } from "./store";
import type { BillingBinding } from "./types";

export type BillingAuth =
  | { ok: true; binding: BillingBinding }
  | { ok: false; code: "unauthorized" | "internal"; message: string };

const sha256hex = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");

/**
 * Which workspace a FITT Billing bearer token speaks for. Only FITT_BILLING
 * credentials match (a FITT Voice token is refused), revoked ones never do,
 * and a database failure is "try again", not "you are not allowed".
 */
export async function authenticateBilling(authorization: string | null, now = new Date()): Promise<BillingAuth> {
  const token = /^Bearer\s+(\S+)$/i.exec(authorization ?? "")?.[1];
  if (!token) return { ok: false, code: "unauthorized", message: "ต้องส่ง Authorization: Bearer <token>" };
  try {
    const binding = await findBillingBinding(sha256hex(token));
    if (!binding) return { ok: false, code: "unauthorized", message: "token ไม่ถูกต้องหรือถูกยกเลิกแล้ว" };
    await touchBillingBinding(binding.id, now);
    return { ok: true, binding };
  } catch (e) {
    console.error(`[billing] authenticate failed: ${(e as Error).message}`);
    return { ok: false, code: "internal", message: "ระบบไม่พร้อมชั่วคราว ลองใหม่ได้" };
  }
}
```

- [ ] **Step 8: Run tests and typecheck**

Run: `npx vitest run lib/__tests__/billing-errors.test.ts lib/__tests__/billing-authenticate.test.ts && npx tsc --noEmit`
Expected: PASS, no type errors. (If supabase-js typing rejects a `.select(...)` result assignment, add an explicit cast as the store already does for `DocRecord[]`; do not loosen `lib/db/types.ts`.)

- [ ] **Step 9: Commit**

```bash
git add supabase/migrations/0054_fitt_billing.sql lib/db/types.ts scripts/billing-binding.mjs lib/billing/types.ts lib/billing/errors.ts lib/billing/store.ts lib/billing/authenticate.ts lib/__tests__/billing-errors.test.ts lib/__tests__/billing-authenticate.test.ts
git commit -m "feat(billing): FITT_BILLING credentials, billing tables, and a workspace-scoped store"
```

---

### Task 4: Serializer — summaries, paging and project detail

**Files:**
- Create: `lib/billing/serialize.ts`
- Test: `lib/__tests__/billing-serialize.test.ts`

**Interfaces:**
- Consumes: types from Task 3; `parseDoc`, `quoteTotals`, `paymentSchedule`, `maintenanceTotals`, `lineTotal`, `newDoc`, `emptyRow`, `QuoteDoc` from `lib/quote.ts`; `parseProposal`, `ProposalDoc` from `lib/proposal.ts`; `docsFromFiles` from `lib/define.ts`; `VERSION_KEYS` from `lib/versions.ts`; `ProjectFiles` from `lib/types.ts`.
- Produces:
  - `projectSummaries(snapshot: OrgSnapshot, today: string): BillingProjectSummary[]` — sorted ascending by `updatedAt`, then `id`.
  - `parseListQuery(params: URLSearchParams): { ok: true; updatedSince: number | null; limit: number; cursor: { updatedAt: string; id: string } | null } | { ok: false; message: string }`
  - `pageOf(items: BillingProjectSummary[], q: { updatedSince: number | null; limit: number; cursor: { updatedAt: string; id: string } | null }): BillingPage`
  - `projectDetail(bundle: ProjectBundle, today: string): BillingProjectDetail`

- [ ] **Step 1: Write the failing test** `lib/__tests__/billing-serialize.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { emptyRow, newDoc, quoteTotals, type QuoteDoc } from "@/lib/quote";
import { pageOf, parseListQuery, projectDetail, projectSummaries } from "@/lib/billing/serialize";
import type { ProjectBundle, OrgSnapshot } from "@/lib/billing/types";
import type { Json } from "@/lib/db/types";

const TODAY = "2026-10-14";

function quote(over: Partial<QuoteDoc> = {}): QuoteDoc {
  const doc = newDoc([], "คลังสินค้า", TODAY);
  return {
    ...doc,
    quoteNo: "SQPDV-0001",
    customerName: "บริษัท ตัวอย่าง จำกัด",
    customerAttn: "คุณสมชาย",
    rows: [{ ...emptyRow(), name: "หน้ารับสินค้า", days: 3 }],
    ...over,
  };
}

function bundle(over: Partial<ProjectBundle> = {}): ProjectBundle {
  return {
    project: {
      id: "p1",
      name: "คลังสินค้า",
      phase: "build",
      active_version: "standard",
      created_at: "2026-09-01T03:00:00Z",
      updated_at: "2026-10-13T09:12:00Z",
      files: { "docs/BRD.md": "# BRD", "docs/PRD.md": "# PRD" },
    },
    orgId: "org_1",
    orgName: "Digital Value",
    quotes: [{ project_id: "p1", version: "standard", payload: quote() as unknown as Json, updated_at: "2026-10-13T10:00:00Z" }],
    proposals: [],
    billing: null,
    ...over,
  };
}

describe("projectDetail", () => {
  it("carries the quotation with the totals the editor prints", () => {
    const d = projectDetail(bundle(), TODAY);
    expect(d.schemaVersion).toBe("fittbuilder.billing.project.v1");
    expect(d.project).toMatchObject({ id: "p1", orgId: "org_1", orgName: "Digital Value", activeVersion: "standard" });
    expect(d.quotes.standard?.totals).toEqual(quoteTotals(quote()));
    expect(d.quotes.standard?.quoteNo).toBe("SQPDV-0001");
    expect(d.quotes.premium).toBeNull();
    expect(d.customer).toEqual({ name: "บริษัท ตัวอย่าง จำกัด", attn: "คุณสมชาย", address: "", phone: "" });
    expect(d.documents).toEqual({ brd: "# BRD", prd: "# PRD" });
    expect(d.billing).toEqual({ status: "active", reason: "", changedAt: null, licenseKeyIssued: false });
  });

  it("sends the MA billing cycle", () => {
    const q = quote();
    const d = projectDetail(
      bundle({ quotes: [{ project_id: "p1", version: "standard", payload: { ...q, ma: { ...q.ma, enabled: true, billingCycle: "yearly" } } as unknown as Json, updated_at: "2026-10-13T10:00:00Z" }] }),
      TODAY
    );
    expect(d.quotes.standard?.maintenance).toMatchObject({ enabled: true, billingCycle: "yearly" });
  });

  it("answers a bare project with nulls, not an error", () => {
    const d = projectDetail(bundle({ quotes: [], proposals: [], project: { ...bundle().project, files: null } }), TODAY);
    expect(d.customer).toBeNull();
    expect(d.quotes).toEqual({ standard: null, premium: null });
    expect(d.proposals).toEqual({ standard: null, premium: null });
    expect(d.documents).toEqual({ brd: null, prd: null });
  });

  it("marks a lump sum so the rows are not added up again", () => {
    const q = quote({ lumpSum: { ...quote().lumpSum, enabled: true, amount: 50_000 } });
    const d = projectDetail(
      bundle({ quotes: [{ project_id: "p1", version: "standard", payload: q as unknown as Json, updated_at: "2026-10-13T10:00:00Z" }] }),
      TODAY
    );
    expect(d.quotes.standard?.lumpSum).toEqual({ enabled: true, amount: 50_000 });
    expect(d.quotes.standard?.totals.subtotal).toBe(50_000);
  });

  it("reports a suspension and whether a licence key exists", () => {
    const d = projectDetail(
      bundle({ billing: { project_id: "p1", status: "suspended", reason: "ค้างชำระ", changed_at: "2026-10-14T01:00:00Z", license_key_hash: "a".repeat(64) } }),
      TODAY
    );
    expect(d.billing).toEqual({ status: "suspended", reason: "ค้างชำระ", changedAt: "2026-10-14T01:00:00Z", licenseKeyIssued: true });
  });
});

describe("projectSummaries and paging", () => {
  const snapshot: OrgSnapshot = {
    projects: [
      { id: "a", name: "A", phase: "define", active_version: "standard", created_at: "2026-09-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z" },
      { id: "b", name: "B", phase: "build", active_version: "standard", created_at: "2026-09-01T00:00:00Z", updated_at: "2026-10-02T00:00:00Z" },
    ],
    // A quotation edited later than its project moves the project's updatedAt.
    quotes: [{ project_id: "a", version: "standard", payload: quote() as unknown as Json, updated_at: "2026-10-05T00:00:00Z" }],
    proposals: [],
    billing: [],
  };

  it("takes the latest change across the project and its documents, oldest first", () => {
    const s = projectSummaries(snapshot, TODAY);
    expect(s.map((x) => [x.id, x.updatedAt])).toEqual([
      ["b", "2026-10-02T00:00:00.000Z"],
      ["a", "2026-10-05T00:00:00.000Z"],
    ]);
    expect(s[1]).toMatchObject({ customerName: "บริษัท ตัวอย่าง จำกัด", quoteNo: "SQPDV-0001", billingStatus: "active" });
    expect(s[0]).toMatchObject({ customerName: null, quoteNo: null });
  });

  it("filters by updatedSince and pages with a cursor", () => {
    const all = projectSummaries(snapshot, TODAY);
    const first = pageOf(all, { updatedSince: null, limit: 1, cursor: null });
    expect(first.items.map((x) => x.id)).toEqual(["b"]);
    expect(first.nextCursor).not.toBeNull();
    const q = parseListQuery(new URLSearchParams({ cursor: first.nextCursor!, limit: "1" }));
    if (!q.ok) throw new Error(q.message);
    const second = pageOf(all, q);
    expect(second.items.map((x) => x.id)).toEqual(["a"]);
    expect(second.nextCursor).toBeNull();
    const since = parseListQuery(new URLSearchParams({ updatedSince: "2026-10-03T00:00:00Z" }));
    if (!since.ok) throw new Error(since.message);
    expect(pageOf(all, since).items.map((x) => x.id)).toEqual(["a"]);
  });

  it("refuses malformed parameters", () => {
    for (const bad of [{ limit: "abc" }, { limit: "0" }, { limit: "500" }, { cursor: "garbage" }, { updatedSince: "yesterday" }]) {
      expect(parseListQuery(new URLSearchParams(bad)).ok).toBe(false);
    }
    expect(parseListQuery(new URLSearchParams())).toEqual({ ok: true, updatedSince: null, limit: 50, cursor: null });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/__tests__/billing-serialize.test.ts`
Expected: FAIL — module `@/lib/billing/serialize` not found.

- [ ] **Step 3: Implement** `lib/billing/serialize.ts`

```ts
import { lineTotal, maintenanceTotals, parseDoc, paymentSchedule, quoteTotals, type QuoteDoc } from "@/lib/quote";
import { parseProposal, type ProposalDoc } from "@/lib/proposal";
import { docsFromFiles } from "@/lib/define";
import { VERSION_KEYS } from "@/lib/versions";
import type { ProjectFiles } from "@/lib/types";
import type {
  BillingCustomer,
  BillingPage,
  BillingProjectDetail,
  BillingProjectSummary,
  BillingProposal,
  BillingQuote,
  BillingRow,
  BillingStatus,
  DocRecord,
  OrgSnapshot,
  ProjectBundle,
} from "./types";

/**
 * Stored rows → the FITT Billing contract. Pure: every figure comes from the
 * same functions the quotation editor prints with, so Billing never shows a
 * number the customer's paper doesn't.
 */

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

const iso = (ms: number) => new Date(ms).toISOString();
const statusOf = (row: BillingRow | null | undefined): BillingStatus => (row?.status === "suspended" ? "suspended" : "active");

function docFor(records: DocRecord[], version: string): DocRecord | null {
  return records.find((r) => r.version === version) ?? null;
}

function serializeQuote(doc: QuoteDoc, updatedAt: string): BillingQuote {
  const ma = maintenanceTotals(doc.ma);
  return {
    quoteNo: doc.quoteNo,
    issuedAt: doc.issuedAt,
    validDays: doc.validDays,
    subject: doc.subject,
    currency: "THB",
    ratePerDay: doc.ratePerDay,
    vatPercent: doc.vatPercent,
    rows: doc.rows.map((r) => ({
      name: r.name,
      pricing: r.pricing,
      days: r.days,
      qty: r.qty,
      unit: r.unit,
      unitPrice: r.unitPrice,
      note: r.note,
      sub: r.sub,
      // Rounded once per line, exactly as the printed quotation rounds it.
      amount: Math.round(lineTotal(r, doc.ratePerDay) * 100) / 100,
    })),
    lumpSum: { enabled: doc.lumpSum.enabled, amount: doc.lumpSum.amount },
    totals: quoteTotals(doc),
    paymentSchedule: paymentSchedule(doc).rows.map((l) => ({
      when: l.term.when,
      percent: l.term.percent,
      netDays: l.term.netDays,
      amount: l.amount,
    })),
    maintenance: {
      enabled: doc.ma.enabled,
      billingCycle: doc.ma.billingCycle,
      modules: ma.modules,
      perModule: ma.perModule,
      monthly: ma.monthly,
      includedMonths: ma.includedMonths,
      includedValue: ma.includedValue,
      annual: ma.annual,
      note: doc.ma.note,
    },
    updatedAt,
  };
}

function serializeProposal(doc: ProposalDoc, updatedAt: string): BillingProposal {
  return {
    proposalNo: doc.proposalNo,
    issuedAt: doc.issuedAt,
    subject: doc.subject,
    context: doc.context,
    points: doc.points.map(({ problem, feature, outcome }) => ({ problem, feature, outcome })),
    excluded: doc.excluded,
    closing: doc.closing,
    quoteNo: doc.quoteNo,
    updatedAt,
  };
}

/** The customer as the chosen tier's quotation names them, else its proposal; null when neither does. */
function customerOf(...docs: (QuoteDoc | ProposalDoc | null)[]): BillingCustomer | null {
  for (const d of docs) {
    if (!d) continue;
    const c = {
      name: d.customerName.trim(),
      attn: d.customerAttn.trim(),
      address: d.customerAddress.trim(),
      phone: d.customerPhone.trim(),
    };
    if (c.name || c.attn || c.address || c.phone) return c;
  }
  return null;
}

export function projectDetail(b: ProjectBundle, today: string): BillingProjectDetail {
  const quotes = { standard: null, premium: null } as BillingProjectDetail["quotes"];
  const proposals = { standard: null, premium: null } as BillingProjectDetail["proposals"];
  const quoteDocs: Record<string, QuoteDoc | null> = {};
  const proposalDocs: Record<string, ProposalDoc | null> = {};
  for (const v of VERSION_KEYS) {
    const q = docFor(b.quotes, v);
    const qd = q ? parseDoc(q.payload, today) : null;
    quoteDocs[v] = qd;
    if (q && qd) quotes[v] = serializeQuote(qd, q.updated_at);
    const p = docFor(b.proposals, v);
    const pd = p ? parseProposal(p.payload, today) : null;
    proposalDocs[v] = pd;
    if (p && pd) proposals[v] = serializeProposal(pd, p.updated_at);
  }
  const active = b.project.active_version;
  const files = b.project.files && typeof b.project.files === "object" && !Array.isArray(b.project.files)
    ? (b.project.files as unknown as ProjectFiles)
    : null;
  const docs = docsFromFiles(files);
  return {
    schemaVersion: "fittbuilder.billing.project.v1",
    project: {
      id: b.project.id,
      name: b.project.name,
      phase: b.project.phase,
      orgId: b.orgId,
      orgName: b.orgName,
      activeVersion: active,
      createdAt: b.project.created_at,
      updatedAt: b.project.updated_at,
    },
    customer: customerOf(quoteDocs[active] ?? null, proposalDocs[active] ?? null),
    billing: {
      status: statusOf(b.billing),
      reason: b.billing?.reason ?? "",
      changedAt: b.billing?.changed_at ?? null,
      licenseKeyIssued: Boolean(b.billing?.license_key_hash),
    },
    quotes,
    proposals,
    documents: { brd: docs.brd ?? null, prd: docs.prd ?? null },
  };
}

export function projectSummaries(s: OrgSnapshot, today: string): BillingProjectSummary[] {
  const latest = new Map<string, number>();
  const bump = (id: string, at: string) => {
    const t = Date.parse(at);
    if (Number.isFinite(t) && t > (latest.get(id) ?? -Infinity)) latest.set(id, t);
  };
  for (const p of s.projects) bump(p.id, p.updated_at);
  for (const r of [...s.quotes, ...s.proposals]) bump(r.project_id, r.updated_at);
  for (const r of s.billing) bump(r.project_id, r.changed_at);
  const items = s.projects.map((p) => {
    const q = s.quotes.find((r) => r.project_id === p.id && r.version === p.active_version);
    const qd = q ? parseDoc(q.payload, today) : null;
    return {
      id: p.id,
      name: p.name,
      phase: p.phase,
      updatedAt: iso(latest.get(p.id) ?? Date.parse(p.updated_at)),
      customerName: qd?.customerName.trim() || null,
      quoteNo: qd?.quoteNo || null,
      billingStatus: statusOf(s.billing.find((r) => r.project_id === p.id)),
    };
  });
  return items.sort((a, b) => (a.updatedAt === b.updatedAt ? a.id.localeCompare(b.id) : a.updatedAt.localeCompare(b.updatedAt)));
}

type ListQuery = { updatedSince: number | null; limit: number; cursor: { updatedAt: string; id: string } | null };

export function parseListQuery(params: URLSearchParams): ({ ok: true } & ListQuery) | { ok: false; message: string } {
  let updatedSince: number | null = null;
  const since = params.get("updatedSince");
  if (since !== null) {
    updatedSince = Date.parse(since);
    if (!Number.isFinite(updatedSince)) return { ok: false, message: "updatedSince ต้องเป็นเวลาแบบ ISO 8601" };
  }
  let limit = DEFAULT_LIMIT;
  const rawLimit = params.get("limit");
  if (rawLimit !== null) {
    limit = Number(rawLimit);
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) return { ok: false, message: `limit ต้องเป็นจำนวนเต็ม 1–${MAX_LIMIT}` };
  }
  let cursor: ListQuery["cursor"] = null;
  const rawCursor = params.get("cursor");
  if (rawCursor !== null) {
    try {
      const v = JSON.parse(Buffer.from(rawCursor, "base64url").toString("utf8"));
      if (!Array.isArray(v) || typeof v[0] !== "string" || typeof v[1] !== "string" || !Number.isFinite(Date.parse(v[0]))) throw new Error();
      cursor = { updatedAt: v[0], id: v[1] };
    } catch {
      return { ok: false, message: "cursor ไม่ถูกต้อง ให้ใช้ค่า nextCursor ที่ได้จากหน้าก่อน" };
    }
  }
  return { ok: true, updatedSince, limit, cursor };
}

export function pageOf(items: BillingProjectSummary[], q: ListQuery): BillingPage {
  const after = (x: BillingProjectSummary) =>
    !q.cursor || x.updatedAt > q.cursor.updatedAt || (x.updatedAt === q.cursor.updatedAt && x.id > q.cursor.id);
  const eligible = items.filter((x) => (q.updatedSince === null || Date.parse(x.updatedAt) > q.updatedSince) && after(x));
  const page = eligible.slice(0, q.limit);
  const last = page[page.length - 1];
  const more = eligible.length > page.length;
  return {
    items: page,
    nextCursor: more && last ? Buffer.from(JSON.stringify([last.updatedAt, last.id]), "utf8").toString("base64url") : null,
  };
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npx vitest run lib/__tests__/billing-serialize.test.ts && npx tsc --noEmit`
Expected: PASS, no type errors. If `lineTotal`'s signature differs from `(row, ratePerDay)`, read it in `lib/quote.ts` and call it as declared — do not reimplement line math.

- [ ] **Step 5: Commit**

```bash
git add lib/billing/serialize.ts lib/__tests__/billing-serialize.test.ts
git commit -m "feat(billing): serialize projects, quotes and proposals for FITT Billing"
```

---

### Task 5: The two routes

**Files:**
- Create: `app/v1/integrations/billing/projects/route.ts`
- Create: `app/v1/integrations/billing/projects/[id]/route.ts`
- Test: `lib/__tests__/billing-routes.test.ts`

**Interfaces:**
- Consumes: `authenticateBilling` (Task 3), `billingError` (Task 3), `loadOrgSnapshot`, `loadProjectBundle` (Task 3), `projectSummaries`, `parseListQuery`, `pageOf`, `projectDetail` (Task 4), `rateLimit` from `@/lib/rate-limit`.
- Produces: `GET` handlers.

- [ ] **Step 1: Write the failing test** `lib/__tests__/billing-routes.test.ts`

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OrgSnapshot, ProjectBundle } from "@/lib/billing/types";

const auth = { result: { ok: true, binding: { id: "bind_1", org_id: "org_1" } } as unknown };
vi.mock("@/lib/billing/authenticate", () => ({ authenticateBilling: async () => auth.result }));

const data = {
  snapshot: { projects: [], quotes: [], proposals: [], billing: [] } as OrgSnapshot,
  bundle: null as ProjectBundle | null,
  fail: false,
  bundleArgs: [] as [string, string][],
};
vi.mock("@/lib/billing/store", () => ({
  loadOrgSnapshot: async () => {
    if (data.fail) throw new Error("db down");
    return data.snapshot;
  },
  loadProjectBundle: async (orgId: string, projectId: string) => {
    data.bundleArgs.push([orgId, projectId]);
    if (data.fail) throw new Error("db down");
    return data.bundle;
  },
}));
const limit = { ok: true, retryAfter: 0 };
vi.mock("@/lib/rate-limit", () => ({ rateLimit: async () => limit }));

const list = await import("../../app/v1/integrations/billing/projects/route");
const detail = await import("../../app/v1/integrations/billing/projects/[id]/route");

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const get = (path: string) => new Request(`http://builder.test/v1/integrations/billing${path}`, { headers: { authorization: "Bearer fbb_x" } });
const getDetail = (id: string) => detail.GET(get(`/projects/${id}`), { params: Promise.resolve({ id }) });

beforeEach(() => {
  auth.result = { ok: true, binding: { id: "bind_1", org_id: "org_1" } };
  data.snapshot = {
    projects: [{ id: PROJECT_ID, name: "A", phase: "build", active_version: "standard", created_at: "2026-09-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z" }],
    quotes: [],
    proposals: [],
    billing: [],
  };
  data.bundle = null;
  data.fail = false;
  data.bundleArgs = [];
  limit.ok = true;
});

describe("GET /v1/integrations/billing/projects", () => {
  it("lists the workspace's projects", async () => {
    const res = await list.GET(get("/projects"));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ items: [{ id: PROJECT_ID, name: "A", billingStatus: "active" }], nextCursor: null });
  });

  it("refuses a bad token with the error envelope", async () => {
    auth.result = { ok: false, code: "unauthorized", message: "token ไม่ถูกต้องหรือถูกยกเลิกแล้ว" };
    const res = await list.GET(get("/projects"));
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ schemaVersion: "fittbuilder.error.v1", code: "unauthorized", retryable: false });
  });

  it("answers 400 for malformed parameters, not 500", async () => {
    for (const q of ["?limit=abc", "?limit=0", "?limit=500", "?cursor=garbage", "?updatedSince=yesterday"]) {
      const res = await list.GET(get(`/projects${q}`));
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ code: "invalid_request" });
    }
  });

  it("answers 429 with Retry-After when over the rate", async () => {
    limit.ok = false;
    limit.retryAfter = 9;
    const res = await list.GET(get("/projects"));
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("9");
  });

  it("answers 500 internal, retryable, when the database fails", async () => {
    data.fail = true;
    const res = await list.GET(get("/projects"));
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ code: "internal", retryable: true });
  });
});

describe("GET /v1/integrations/billing/projects/{id}", () => {
  it("reads only within the token's workspace and answers 404 outside it", async () => {
    const res = await getDetail(PROJECT_ID);
    expect(res.status).toBe(404);
    expect(data.bundleArgs).toEqual([["org_1", PROJECT_ID]]);
  });

  it("answers 404 for an id that is not a UUID, without asking the database", async () => {
    const res = await getDetail("not-a-uuid");
    expect(res.status).toBe(404);
    expect(data.bundleArgs).toEqual([]);
  });

  it("returns the project detail", async () => {
    data.bundle = {
      project: { id: PROJECT_ID, name: "A", phase: "build", active_version: "standard", created_at: "2026-09-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z", files: null },
      orgId: "org_1",
      orgName: "Digital Value",
      quotes: [],
      proposals: [],
      billing: null,
    };
    const res = await getDetail(PROJECT_ID);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ schemaVersion: "fittbuilder.billing.project.v1", project: { id: PROJECT_ID, orgName: "Digital Value" } });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/__tests__/billing-routes.test.ts`
Expected: FAIL — the route modules do not exist.

- [ ] **Step 3: Implement the routes**

`app/v1/integrations/billing/projects/route.ts`:

```ts
import { randomUUID } from "node:crypto";
import { rateLimit } from "@/lib/rate-limit";
import { authenticateBilling } from "@/lib/billing/authenticate";
import { billingError } from "@/lib/billing/errors";
import { loadOrgSnapshot } from "@/lib/billing/store";
import { pageOf, parseListQuery, projectSummaries } from "@/lib/billing/serialize";

/**
 * FITT Billing → FITT Builder: the workspace's projects, oldest change first,
 * so Billing can sync incrementally with updatedSince and a cursor.
 * Order follows the FITT Voice receiver: credential, rate, input, then data.
 * Neither credentials nor contents are logged.
 */

/** Per credential. */
const RATE_PER_MINUTE = 120;

export async function GET(request: Request) {
  const requestId = randomUUID();
  const auth = await authenticateBilling(request.headers.get("authorization"));
  if (!auth.ok) return billingError(auth.code, auth.message, requestId);
  const limit = await rateLimit(`billing:${auth.binding.id}`, RATE_PER_MINUTE, 60_000);
  if (!limit.ok) return billingError("rate_limited", "เรียกถี่เกินไป รอแล้วลองใหม่", requestId, limit.retryAfter);
  const q = parseListQuery(new URL(request.url).searchParams);
  if (!q.ok) return billingError("invalid_request", q.message, requestId);
  try {
    const today = new Date().toISOString().slice(0, 10);
    const items = projectSummaries(await loadOrgSnapshot(auth.binding.org_id), today);
    return Response.json(pageOf(items, q), { headers: { "cache-control": "no-store" } });
  } catch (e) {
    console.error(`[billing] list failed (${requestId}): ${(e as Error).message}`);
    return billingError("internal", "ระบบไม่พร้อมชั่วคราว ลองใหม่ได้", requestId);
  }
}
```

`app/v1/integrations/billing/projects/[id]/route.ts`:

```ts
import { randomUUID } from "node:crypto";
import { rateLimit } from "@/lib/rate-limit";
import { authenticateBilling } from "@/lib/billing/authenticate";
import { billingError } from "@/lib/billing/errors";
import { loadProjectBundle } from "@/lib/billing/store";
import { projectDetail } from "@/lib/billing/serialize";

/**
 * FITT Billing → FITT Builder: one project in full. A project outside the
 * token's workspace answers exactly like one that doesn't exist.
 */

const RATE_PER_MINUTE = 120;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const requestId = randomUUID();
  const auth = await authenticateBilling(request.headers.get("authorization"));
  if (!auth.ok) return billingError(auth.code, auth.message, requestId);
  const limit = await rateLimit(`billing:${auth.binding.id}`, RATE_PER_MINUTE, 60_000);
  if (!limit.ok) return billingError("rate_limited", "เรียกถี่เกินไป รอแล้วลองใหม่", requestId, limit.retryAfter);
  const { id } = await ctx.params;
  if (!UUID.test(id)) return billingError("not_found", "ไม่พบโปรเจกต์", requestId);
  try {
    const bundle = await loadProjectBundle(auth.binding.org_id, id);
    if (!bundle) return billingError("not_found", "ไม่พบโปรเจกต์", requestId);
    const today = new Date().toISOString().slice(0, 10);
    return Response.json(projectDetail(bundle, today), { headers: { "cache-control": "no-store" } });
  } catch (e) {
    console.error(`[billing] detail failed (${requestId}): ${(e as Error).message}`);
    return billingError("internal", "ระบบไม่พร้อมชั่วคราว ลองใหม่ได้", requestId);
  }
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npx vitest run lib/__tests__/billing-routes.test.ts && npx tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 5: Commit**

```bash
git add "app/v1/integrations/billing/projects/route.ts" "app/v1/integrations/billing/projects/[id]/route.ts" lib/__tests__/billing-routes.test.ts
git commit -m "feat(billing): GET /v1/integrations/billing/projects and /projects/{id}"
```

---

### Task 6: Contract document, changelog, full checks

**Files:**
- Create: `docs/integrations/fitt-billing.md`
- Modify: `lib/changelog.ts` (prepend one entry)

- [ ] **Step 1: Write `docs/integrations/fitt-billing.md`** (Thai, for the Billing team). Required sections, using the exact values from the Global Constraints and Task 3–5 code:
  1. ภาพรวม — Billing pulls; FITT Builder never pushes.
  2. การเชื่อมต่อ — base URL `https://fitt-builder.fittbsa.com/v1/integrations/billing`, `Authorization: Bearer <token>`, one token per workspace, issued with `node scripts/billing-binding.mjs create <workspace-id> "<label>"`, revoke with `revoke <binding-id>`.
  3. `GET /projects` — parameters `updatedSince` (ISO 8601), `limit` (1–100, default 50), `cursor` (from `nextCursor`); order oldest change first; summary fields `id, name, phase, updatedAt, customerName, quoteNo, billingStatus`; `updatedAt` = latest change of the project, its quotations, proposals or billing status.
  4. `GET /projects/{id}` — the full JSON shape from `BillingProjectDetail` in `lib/billing/types.ts`, including `ratePerDay`, `vatPercent`, row `amount`, `lumpSum`, `maintenance.billingCycle`, `maintenance.note`, proposal `context`; rules: `customer` from the active tier's quotation then proposal; `quoteNo`/`proposalNo` empty until first export; money from the editor's own functions; no PDFs.
  5. Error envelope and the five codes with status and `retryable`.
  6. ยังไม่มีใน phase นี้ — `PUT /projects/{id}/status`, `POST /projects/{id}/license-key`, `/v1/service-status` (phase 2).

- [ ] **Step 2: Prepend a changelog entry** at the top of `CHANGELOG` in `lib/changelog.ts`. Use the next MINOR above the version currently first in the array on `origin/main` (at plan time `0.106.1` → `0.107.0`; re-check after `git fetch` and before merge):

```ts
  {
    version: "0.107.0",
    date: "2026-10-16",
    title: "เลือกรอบชำระ MA ในใบเสนอราคา และเชื่อมข้อมูลโปรเจกต์ให้ FITT Billing",
    items: [
      {
        type: "feature",
        text: "ส่วนค่าบำรุงรักษาระบบ (MA) ในใบเสนอราคาเลือกรอบชำระได้ว่า รายเดือน หรือ รายปี และพิมพ์รอบชำระในใบเสนอราคา ไฟล์ Word และเงื่อนไข MA",
      },
      {
        type: "feature",
        text: "FITT Billing ดึงข้อมูลโปรเจกต์ ลูกค้า ใบเสนอราคาพร้อมยอด รอบชำระ MA ข้อเสนอโครงการ และ BRD/PRD ได้ผ่าน API ที่ต้องใช้ token ของ workspace",
      },
    ],
  },
```

- [ ] **Step 3: Run every check**

Run: `npm test && npx tsc --noEmit && npm run lint`
Expected: all tests pass (including `lib/__tests__/changelog.test.ts`, which validates entry shape and ordering), no type errors, no lint errors in changed files.

- [ ] **Step 4: Commit**

```bash
git add docs/integrations/fitt-billing.md lib/changelog.ts
git commit -m "docs(billing): the FITT Billing contract, and 0.107.0 in the changelog"
```

---

## Release (controller only — each step needs the user's explicit go-ahead)

1. **Rebase** `feature/billing-api` onto `origin/main` (`git fetch && git rebase origin/main`); resolve expected conflicts in `lib/quote.ts`, `components/studio/QuoteTerms.tsx`, `lib/changelog.ts` (take the next version above `main`). Re-run `npm test && npx tsc --noEmit`.
2. **Apply migration 0054** with `npm run db:migrate` against the target database (the user runs it or provides the environment; confirm which database first). Additive only: two new tables and a widened producer check.
3. **Issue a Sandbox credential** for the Digital Value workspace with `node scripts/billing-binding.mjs create <workspace-id> "FITT Billing (Sandbox)"`; hand it to the Billing team through the agreed secret channel only.
4. **Deploy**: pushing to `main` deploys production. Coordinate with the fitt-builder session (it pushes `main`, `dev` and `codex/light-theme-contrast` together) before any push.
