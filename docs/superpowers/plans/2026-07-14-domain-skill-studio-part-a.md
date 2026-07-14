# AI Domain Skill Studio (Part A / v1) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a workspace generate its own AI "domain specialist" (a workspace-scoped `SkillTemplate`) from its Org DNA + a brief, and auto-apply it to every demo built in that workspace.

**Architecture:** Reuse the existing admin skill generator (`/api/admin/generate-skill`), the `fittbuilder_skill_templates` table, and the Org DNA drafting/versioning patterns. Add an `org_id`-scoped skill row + member-write RLS, a workspace generation endpoint that injects Org DNA, a CRUD lib, generation wiring that prefers the workspace skill, and a "Studio" UI card in the workspace page + a TopBar chip.

**Tech Stack:** Next.js 16 (App Router, route handlers), Supabase Postgres + RLS, `@google/genai` via `lib/gemini` (`streamParts`), React 19 client components, Tailwind v4, vitest.

**Spec:** `docs/superpowers/specs/2026-07-14-domain-skill-studio-design.md` (Part A only; Part B "Living Org DNA" is a separate plan).

## Global Constraints

- Migrations are idempotent (`create ... if not exists`, `create or replace`, `drop policy if exists`) and applied via `npm run db:migrate` (reads `DIRECT_URL` from `.env.local`; never echo the URL).
- RLS helper `fittbuilder_is_org_member(oid uuid, uid uuid)` exists (migration 0015). Reuse it; do not reference `auth.users` from client-reachable policies.
- Client Supabase types live in `lib/db/types.ts`; every `.from()`/`.rpc()` must typecheck against it.
- SkillTemplate runtime `id` = the row's `slug` (see `rowToSkillTemplate`).
- Thai UI copy; midnight-studio tokens (`night`, `night-edge`, `chalk`, `chalk-dim`, `shine`, `go`, `halt`). No `Date.now()` during React render (eslint `react-hooks/purity`) — snapshot via `useState(() => Date.now())`.
- Per change: `npx tsc --noEmit` + `npx eslint <files>` + `npm run build` + `npx vitest run` green; bump `package.json` version + add a `lib/changelog.ts` entry; commit. Do NOT push `main`/`dev` for doc-only changes (they auto-deploy prod/UAT via Cloud Build triggers).

---

### Task 1: Migration 0019 — org-scoped skills + member-write RLS

**Files:**
- Create: `supabase/migrations/0019_org_skills.sql`

**Interfaces:**
- Produces: `fittbuilder_skill_templates.org_id uuid`, `.source text`; RLS allowing org members to read+write their org's skill rows.

- [ ] **Step 1: Write the migration**

```sql
-- Workspace-scoped domain specialists. org_id null = global/admin template
-- (unchanged). org_id set = a workspace's own AI-generated specialist that org
-- members can read + manage.
alter table fittbuilder_skill_templates
  add column if not exists org_id uuid references fittbuilder_orgs(id) on delete cascade,
  add column if not exists source text not null default 'manual' check (source in ('manual','ai'));
create index if not exists fittbuilder_skill_templates_org_idx on fittbuilder_skill_templates (org_id);

-- SELECT: existing (published OR own draft) PLUS org members read their org's rows.
-- is_org_member queries orgs/org_members only (never skill_templates), so it is
-- safe under INSERT ... RETURNING (no self-reference; cf. 0006).
drop policy if exists skill_templates_select on fittbuilder_skill_templates;
create policy skill_templates_select on fittbuilder_skill_templates
  for select using (
    status = 'published'
    or created_by = auth.uid()
    or (org_id is not null and fittbuilder_is_org_member(org_id, auth.uid()))
  );

-- Writes: only for org-scoped rows, by members of that org. Global rows
-- (org_id null) keep NO client write policy → admin/service-role only.
drop policy if exists skill_templates_insert on fittbuilder_skill_templates;
create policy skill_templates_insert on fittbuilder_skill_templates
  for insert with check (org_id is not null and fittbuilder_is_org_member(org_id, auth.uid()));
drop policy if exists skill_templates_update on fittbuilder_skill_templates;
create policy skill_templates_update on fittbuilder_skill_templates
  for update using (org_id is not null and fittbuilder_is_org_member(org_id, auth.uid()));
drop policy if exists skill_templates_delete on fittbuilder_skill_templates;
create policy skill_templates_delete on fittbuilder_skill_templates
  for delete using (org_id is not null and fittbuilder_is_org_member(org_id, auth.uid()));

notify pgrst, 'reload schema';
```

- [ ] **Step 2: Apply**

Run: `npm run db:migrate`
Expected: tail shows `▶ applying 0019_org_skills.sql` … `ALTER TABLE` / `CREATE POLICY` … `✓ all migrations applied`.

- [ ] **Step 3: Verify RLS (rolled-back tx, no data change)**

Write `scratchpad/verify_org_skill_rls.sql`:
```sql
begin;
do $$
declare v_org uuid; v_member uuid; v_other uuid; ins_ok boolean;
begin
  select o.id, o.owner_id into v_org, v_member from fittbuilder_orgs o limit 1;
  select id into v_other from auth.users where id <> v_member
    and not fittbuilder_is_org_member(v_org, id) limit 1;
  insert into fittbuilder_skill_templates (slug, name, name_en, tagline, icon, keywords,
    persona, domain_knowledge, build_guidance, seed_data, question_bank, status, created_by, org_id, source)
  values ('verify-'||substr(v_org::text,1,8), 'x','x','x','Box','[]'::jsonb,'x','x','x','x','[]'::jsonb,
    'published', v_member, v_org, 'ai');
  ins_ok := true;
  raise notice 'RESULT: owner_can_read=%  other_is_member=%  insert_ok=%',
    fittbuilder_is_org_member(v_org, v_member),
    coalesce(fittbuilder_is_org_member(v_org, v_other), false), ins_ok;
end $$;
rollback;
```
Run (mirror `scripts/migrate.mjs` connection so creds stay hidden):
`node scratchpad/run_verify.mjs scratchpad/verify_org_skill_rls.sql | grep RESULT`
Expected: `owner_can_read=t other_is_member=f insert_ok=t`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0019_org_skills.sql
git commit -m "feat(skills): org-scoped skill rows + member-write RLS (migration 0019)"
```

---

### Task 2: Client DB types + row mappers for org_id/source

**Files:**
- Modify: `lib/db/types.ts` (fittbuilder_skill_templates Row/Insert/Update — add `org_id`, `source`)
- Modify: `lib/skills/db-mapper.ts` (SkillTemplateRow + add insert mapper)
- Test: `lib/skills/__tests__/db-mapper.test.ts`

**Interfaces:**
- Produces: `SkillTemplateRow` gains `org_id: string | null; source: string`; `skillTemplateToInsertRow(t, opts)` producing a `fittbuilder_skill_templates` Insert row.

- [ ] **Step 1: Add fields to `lib/db/types.ts`**

In `fittbuilder_skill_templates` `Row`, add after `question_bank`: `org_id: string | null; source: string;`. In `Insert` and `Update`, add: `org_id?: string | null; source?: string;`.

- [ ] **Step 2: Extend `SkillTemplateRow` in `lib/skills/db-mapper.ts`**

Add to the interface: `org_id: string | null;` and `source: "manual" | "ai";`. `rowToSkillTemplate` is unchanged (runtime SkillTemplate doesn't carry org_id).

- [ ] **Step 3: Write the failing test**

```ts
// lib/skills/__tests__/db-mapper.test.ts
import { describe, expect, it } from "vitest";
import { rowToSkillTemplate, skillTemplateToInsertRow, type SkillTemplateRow } from "@/lib/skills/db-mapper";

const row: SkillTemplateRow = {
  id: "u1", slug: "org-abc", name: "ธนาคาร", name_en: "Bank", tagline: "t", icon: "Landmark",
  keywords: ["bank"], persona: "p", domain_knowledge: "d", build_guidance: "b", seed_data: "s",
  design_hints: null, question_bank: [], status: "published", created_by: "user1",
  created_at: "2026-07-14T00:00:00Z", updated_at: "2026-07-14T00:00:00Z", org_id: "org1", source: "ai",
};

describe("skill db-mapper", () => {
  it("round-trips a generated skill into an insert row", () => {
    const ins = skillTemplateToInsertRow(
      { name: "ธนาคาร", nameEn: "Bank", tagline: "t", icon: "Landmark", keywords: ["bank"],
        persona: "p", domainKnowledge: "d", buildGuidance: "b", seedData: "s", questionBank: [] },
      { slug: "org-abc", orgId: "org1", createdBy: "user1", source: "ai" }
    );
    expect(ins.slug).toBe("org-abc");
    expect(ins.org_id).toBe("org1");
    expect(ins.source).toBe("ai");
    expect(ins.name_en).toBe("Bank");
    expect(ins.status).toBe("published");
    expect(rowToSkillTemplate(row).id).toBe("org-abc");
  });
});
```

- [ ] **Step 2b: Run test to verify it fails**

Run: `npx vitest run lib/skills/__tests__/db-mapper.test.ts`
Expected: FAIL — `skillTemplateToInsertRow is not a function`.

- [ ] **Step 3b: Implement the insert mapper in `lib/skills/db-mapper.ts`**

```ts
import type { GeneratedSkill } from "@/lib/types";
import type { Database } from "@/lib/db/types";

type SkillInsert = Database["public"]["Tables"]["fittbuilder_skill_templates"]["Insert"];

/** GeneratedSkill (AI output) → a fittbuilder_skill_templates Insert row. */
export function skillTemplateToInsertRow(
  t: GeneratedSkill,
  opts: { slug: string; orgId: string; createdBy: string; source: "manual" | "ai" }
): SkillInsert {
  return {
    slug: opts.slug,
    name: t.name ?? "ผู้เชี่ยวชาญองค์กร",
    name_en: t.nameEn ?? "Org Specialist",
    tagline: t.tagline ?? "",
    icon: t.icon ?? "Sparkles",
    keywords: (t.keywords ?? []) as unknown as SkillInsert["keywords"],
    persona: t.persona ?? "",
    domain_knowledge: t.domainKnowledge ?? "",
    build_guidance: t.buildGuidance ?? "",
    seed_data: t.seedData ?? "",
    design_hints: t.designHints ?? null,
    question_bank: (t.questionBank ?? []) as unknown as SkillInsert["question_bank"],
    status: "published",
    created_by: opts.createdBy,
    org_id: opts.orgId,
    source: opts.source,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/skills/__tests__/db-mapper.test.ts`
Expected: PASS (both assertions).

- [ ] **Step 5: Commit**

```bash
git add lib/db/types.ts lib/skills/db-mapper.ts lib/skills/__tests__/db-mapper.test.ts
git commit -m "feat(skills): org_id/source in skill types + insert-row mapper"
```

---

### Task 3: Extract shared skill-generation prompt + parser (DRY)

**Files:**
- Create: `lib/skills/generate.ts`
- Modify: `app/api/admin/generate-skill/route.ts` (import from the shared module)

**Interfaces:**
- Produces: `SKILL_SYSTEM: string`, `parseGeneratedSkill(text: string): GeneratedSkill` — used by both the admin route and the new org route.

- [ ] **Step 1: Create `lib/skills/generate.ts`**

Move `SYSTEM` (rename export `SKILL_SYSTEM`), `ICONS`, and `parseTemplate` (rename export `parseGeneratedSkill`) VERBATIM from `app/api/admin/generate-skill/route.ts` (lines 22–98), keeping the `SKILL_ICON_NAMES` import and the `GeneratedSkill` type import. This file is server-only logic (no `"use client"`).

- [ ] **Step 2: Update the admin route to import them**

In `app/api/admin/generate-skill/route.ts`: delete the moved `SYSTEM`/`ICONS`/`parseTemplate` definitions; add `import { SKILL_SYSTEM, parseGeneratedSkill } from "@/lib/skills/generate";`; replace `system: SYSTEM` → `system: SKILL_SYSTEM` and `parseTemplate(full)` → `parseGeneratedSkill(full)`.

- [ ] **Step 3: Verify no behavior change**

Run: `npx tsc --noEmit && npx eslint app/api/admin/generate-skill/route.ts lib/skills/generate.ts`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add lib/skills/generate.ts app/api/admin/generate-skill/route.ts
git commit -m "refactor(skills): extract shared SKILL_SYSTEM + parseGeneratedSkill"
```

---

### Task 4: `lib/org-skills.ts` — workspace specialist CRUD (client)

**Files:**
- Create: `lib/org-skills.ts`

**Interfaces:**
- Consumes: `skillTemplateToInsertRow` (Task 2), `rowToSkillTemplate` + `SkillTemplateRow` (db-mapper), `GeneratedSkill` (lib/types).
- Produces:
  - `getOrgSkill(orgId: string): Promise<SkillTemplate | null>`
  - `saveOrgSkill(orgId: string, generated: GeneratedSkill): Promise<SkillTemplate>` (upsert the single v1 specialist)
  - `deleteOrgSkill(orgId: string): Promise<void>`
  - `orgSkillSlug(orgId: string): string` → `"org-" + orgId.slice(0,8)`

- [ ] **Step 1: Implement**

```ts
"use client";

import { createClient } from "@/lib/supabase/client";
import { rowToSkillTemplate, skillTemplateToInsertRow, type SkillTemplateRow } from "@/lib/skills/db-mapper";
import type { GeneratedSkill, SkillTemplate } from "@/lib/types";

const SELECT =
  "id, slug, name, name_en, tagline, icon, keywords, persona, domain_knowledge, build_guidance, seed_data, design_hints, question_bank, status, created_by, created_at, updated_at, org_id, source";

/** Deterministic slug for a workspace's single v1 specialist. */
export function orgSkillSlug(orgId: string): string {
  return `org-${orgId.slice(0, 8)}`;
}

export async function getOrgSkill(orgId: string): Promise<SkillTemplate | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("fittbuilder_skill_templates")
    .select(SELECT)
    .eq("org_id", orgId)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToSkillTemplate(data as unknown as SkillTemplateRow) : null;
}

/** Upsert the workspace's specialist (one per org in v1) from an AI result. */
export async function saveOrgSkill(orgId: string, generated: GeneratedSkill): Promise<SkillTemplate> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("ไม่พบผู้ใช้");
  const row = skillTemplateToInsertRow(generated, {
    slug: orgSkillSlug(orgId), orgId, createdBy: user.id, source: "ai",
  });
  const { data, error } = await supabase
    .from("fittbuilder_skill_templates")
    .upsert(row, { onConflict: "slug" })
    .select(SELECT)
    .single();
  if (error) throw error;
  return rowToSkillTemplate(data as unknown as SkillTemplateRow);
}

export async function deleteOrgSkill(orgId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("fittbuilder_skill_templates")
    .delete()
    .eq("org_id", orgId);
  if (error) throw error;
}
```

- [ ] **Step 2: Verify types**

Run: `npx tsc --noEmit && npx eslint lib/org-skills.ts`
Expected: clean. (Note: `slug` must be `unique` for `onConflict` — it already is per 0003.)

- [ ] **Step 3: Commit**

```bash
git add lib/org-skills.ts
git commit -m "feat(skills): lib/org-skills client CRUD for the workspace specialist"
```

---

### Task 5: `POST /api/org-skill/generate` — workspace generator with Org DNA

**Files:**
- Create: `app/api/org-skill/generate/route.ts`
- Reference (read-only): `app/api/admin/generate-skill/route.ts`, `lib/org-context.ts` (`getProjectOrgDnaContext`), `lib/org-dna.ts` (`buildOrgDnaContext`), `lib/supabase/server`, `lib/supabase/admin`.

**Interfaces:**
- Consumes: `SKILL_SYSTEM`, `parseGeneratedSkill` (Task 3); `streamParts` (`lib/gemini`); `GenerateSkillEvent` (lib/types); `buildOrgDnaContext` (lib/org-dna).
- Produces: an SSE endpoint that streams `GenerateSkillEvent` (`thought`/`text`/`done`/`error`) — same wire shape the admin skill UI already consumes.

- [ ] **Step 1: Implement the route**

```ts
import { after } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { currentUserId, recordUsage } from "@/lib/ai-usage";
import { MissingApiKeyError, streamParts, type TokenUsage } from "@/lib/gemini";
import { SKILL_SYSTEM, parseGeneratedSkill } from "@/lib/skills/generate";
import { buildOrgDnaContext } from "@/lib/org-dna";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import type { GenerateSkillEvent, OrgDna } from "@/lib/types";

export const maxDuration = 120;
const ATTEMPT_TIMEOUT_MS = 110_000;

const bodySchema = z.object({
  orgId: z.string().uuid(),
  brief: z.string().trim().max(4_000).optional(),
});

function sse(e: GenerateSkillEvent): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(e)}\n\n`);
}

export async function POST(request: Request) {
  const limit = await rateLimit(`orgskill:${clientIp(request)}`, 8);
  if (!limit.ok) {
    return Response.json({ error: `คำขอถี่เกินไป ลองใหม่ใน ${limit.retryAfter} วินาที` }, { status: 429 });
  }

  let body: z.infer<typeof bodySchema>;
  try { body = bodySchema.parse(await request.json()); }
  catch { return Response.json({ error: "คำขอไม่ถูกต้อง" }, { status: 400 }); }

  // Membership gate: the caller must be able to read the org (RLS orgs_select).
  const supabase = await createClient();
  const { data: org } = await supabase
    .from("fittbuilder_orgs").select("id").eq("id", body.orgId).maybeSingle();
  if (!org) return Response.json({ error: "ไม่มีสิทธิ์เข้าถึง workspace นี้" }, { status: 403 });

  // Org DNA via service role (same trust path as generation context).
  const admin = createAdminClient();
  const { data: dnaRow } = await admin
    .from("fittbuilder_orgs").select("org_dna, name").eq("id", body.orgId).maybeSingle();
  const dna = (dnaRow?.org_dna ?? {}) as OrgDna;
  const dnaCtx = buildOrgDnaContext(dna);

  const user = [
    `องค์กร: ${dnaRow?.name ?? "-"}`,
    body.brief ? `บริบท/อุตสาหกรรมเพิ่มเติม: ${body.brief}` : "",
    dnaCtx ? `\nนี่คือ Org DNA ขององค์กร ใช้เป็นฐานในการปั้นผู้เชี่ยวชาญให้ตรงกับวิธีทำงานจริง:\n${dnaCtx}` : "",
    "\nสร้างผู้เชี่ยวชาญประจำองค์กรนี้ (persona/questionBank/domainKnowledge/buildGuidance/seedData/designHints) ให้เหมาะกับอุตสาหกรรมและ Org DNA ข้างบน",
  ].filter(Boolean).join("\n");

  let usage: TokenUsage | null = null;
  let full = "";
  const userId = await currentUserId();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: GenerateSkillEvent) => controller.enqueue(sse(e));
      try {
        for await (const part of streamParts({
          system: SKILL_SYSTEM,
          user,
          thinking: true,
          temperature: 0.7,
          abortSignal: AbortSignal.any([request.signal, AbortSignal.timeout(ATTEMPT_TIMEOUT_MS)]),
          onUsage: (u) => { usage = u; },
        })) {
          if (part.thought) { send({ type: "thought", content: part.text }); continue; }
          full += part.text;
          send({ type: "text", content: part.text });
        }
        send({ type: "done", template: parseGeneratedSkill(full) });
      } catch (error) {
        const message = error instanceof MissingApiKeyError ? error.message : "สร้างไม่สำเร็จ กรุณาลองใหม่";
        console.error("[org-skill/generate] failed:", error);
        send({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  after(() => void recordUsage({ userId, projectId: null, kind: "generate_skill", usage }));

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" },
  });
}
```

- [ ] **Step 2: Add a client stream helper in `lib/sse.ts`**

Append:
```ts
export function streamOrgSkill(
  body: { orgId: string; brief?: string },
  signal: AbortSignal
): AsyncGenerator<GenerateSkillEvent> {
  return streamSse<GenerateSkillEvent>("/api/org-skill/generate", body, signal);
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npx eslint app/api/org-skill/generate/route.ts lib/sse.ts && npm run build`
Expected: clean; `/api/org-skill/generate` appears in the route list.

- [ ] **Step 4: Commit**

```bash
git add app/api/org-skill/generate/route.ts lib/sse.ts
git commit -m "feat(skills): /api/org-skill/generate — workspace specialist from Org DNA"
```

---

### Task 6: Generation wiring — workspace specialist auto-applies

**Files:**
- Create: `lib/skills/org-resolve.ts` (server)
- Modify: `app/api/generate/route.ts` (resolve org specialist when no explicit skillId)

**Interfaces:**
- Consumes: `resolveSkill` (lib/skills/db) — unchanged.
- Produces: `resolveSkillForProject(skillId, projectId): Promise<SkillTemplate | undefined>` — explicit skillId wins; else the project's org specialist; else undefined.

- [ ] **Step 1: Implement `lib/skills/org-resolve.ts`**

```ts
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { rowToSkillTemplate, type SkillTemplateRow } from "@/lib/skills/db-mapper";
import { resolveSkill } from "@/lib/skills/db";
import type { SkillTemplate } from "@/lib/types";

/** Explicit skillId wins; otherwise the project's workspace specialist (if any). */
export async function resolveSkillForProject(
  skillId: string | null | undefined,
  projectId: string | null | undefined
): Promise<SkillTemplate | undefined> {
  if (skillId) return resolveSkill(skillId);
  if (!projectId) return undefined;
  const admin = createAdminClient();
  const { data: proj } = await admin
    .from("fittbuilder_projects").select("org_id").eq("id", projectId).maybeSingle();
  if (!proj?.org_id) return undefined;
  const { data: row } = await admin
    .from("fittbuilder_skill_templates").select("*").eq("org_id", proj.org_id).maybeSingle();
  return row ? rowToSkillTemplate(row as unknown as SkillTemplateRow) : undefined;
}
```

- [ ] **Step 2: Wire into `/api/generate/route.ts`**

Replace `const skill = await resolveSkill(body.skillId);` with:
```ts
import { resolveSkillForProject } from "@/lib/skills/org-resolve";
// ...
const skill = await resolveSkillForProject(body.skillId, body.projectId);
```
Remove the now-unused `resolveSkill` import if nothing else uses it.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npx eslint app/api/generate/route.ts lib/skills/org-resolve.ts && npm run build`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add lib/skills/org-resolve.ts app/api/generate/route.ts
git commit -m "feat(generate): auto-apply the workspace specialist when no skill chosen"
```

---

### Task 7: UI — Domain Skill Studio card + streaming reveal

**Files:**
- Create: `components/org/DomainSkillStudio.tsx`
- Modify: `components/org/OrgDnaEditor.tsx` (mount `<DomainSkillStudio orgId={orgId} />` under `<WorkspaceMembers />`)

**Interfaces:**
- Consumes: `streamOrgSkill` (Task 5), `getOrgSkill`/`saveOrgSkill`/`deleteOrgSkill` (Task 4), `GeneratedSkill`/`GenerateSkillEvent` (lib/types), `toast`, `confirm`.
- Produces: the workspace-page Studio section.

Follow the established patterns: the AI-draft flow + card styling from `components/org/OrgDnaEditor.tsx` (the "ให้ AI ร่างให้จากข้อมูลที่มี" section), and the streaming consumption from the admin skill page (search `streamGenerateSkill` usage) — same `GenerateSkillEvent` shape.

- [ ] **Step 1: Build the component**

Structure (real logic; JSX styled with existing tokens like the OrgDnaEditor sections):
```tsx
"use client";
import { useEffect, useRef, useState } from "react";
import { Loader2, Sparkles, Trash2 } from "lucide-react";
import { streamOrgSkill } from "@/lib/sse";
import { getOrgSkill, saveOrgSkill, deleteOrgSkill } from "@/lib/org-skills";
import { confirm } from "@/lib/confirm";
import { toast } from "@/lib/toast";
import type { GeneratedSkill, SkillTemplate } from "@/lib/types";

export default function DomainSkillStudio({ orgId }: { orgId: string }) {
  const [existing, setExisting] = useState<SkillTemplate | null>(null);
  const [brief, setBrief] = useState("");
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState("");           // streamed research text (the "reveal")
  const [draft, setDraft] = useState<GeneratedSkill | null>(null); // parsed result to save
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getOrgSkill(orgId).then((s) => { if (!cancelled) setExisting(s); }).catch(() => {});
    return () => { cancelled = true; };
  }, [orgId]);

  async function generate() {
    if (busy) return;
    setBusy(true); setReport(""); setDraft(null);
    const ac = new AbortController(); abortRef.current = ac;
    try {
      for await (const ev of streamOrgSkill({ orgId, brief: brief.trim() || undefined }, ac.signal)) {
        if (ev.type === "text") setReport((r) => r + ev.content);
        else if (ev.type === "done") setDraft(ev.template ?? null);
        else if (ev.type === "error") throw new Error(ev.message);
        // ev.type === "thought": optionally surface as a subtle "กำลังคิด…" line
      }
    } catch (e) {
      toast.error("สร้างผู้เชี่ยวชาญไม่สำเร็จ", { description: e instanceof Error ? e.message : undefined });
    } finally { setBusy(false); }
  }

  async function save() {
    if (!draft) return;
    try {
      const saved = await saveOrgSkill(orgId, draft);
      setExisting(saved); setDraft(null); setReport("");
      toast.success(`บันทึกผู้เชี่ยวชาญ "${saved.name}" แล้ว`);
    } catch (e) {
      toast.error("บันทึกไม่สำเร็จ", { description: e instanceof Error ? e.message : undefined });
    }
  }

  async function remove() {
    if (!(await confirm({ title: "ลบผู้เชี่ยวชาญนี้?", message: "เดโมใน workspace จะกลับไปใช้การเดาโดเมนอัตโนมัติ", confirmLabel: "ลบ", danger: true }))) return;
    await deleteOrgSkill(orgId); setExisting(null);
  }

  // Render: a card titled "ปั้นผู้เชี่ยวชาญประจำองค์กร" mirroring OrgDnaEditor's
  // AI-draft section — brief <textarea>, a generate button (Sparkles/Loader2),
  // the streamed <report> in a scrolling panel (the reveal), a save button when
  // draft is ready, and an "active specialist" summary (existing.name + tagline +
  // question count) with a delete button when one exists.
  return (/* JSX per the pattern above */ null);
}
```
Fill the JSX using the same class tokens/spacing as the OrgDnaEditor AI-draft section (`rounded-xl border border-night-edge bg-night-panel p-4`, `bg-shine text-night` button, `scroll-thin` panel). Respect `prefers-reduced-motion`.

- [ ] **Step 2: Mount in `OrgDnaEditor.tsx`**

Add `import DomainSkillStudio from "./DomainSkillStudio";` and render `<DomainSkillStudio orgId={orgId} />` immediately after `<WorkspaceMembers orgId={orgId} />`.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npx eslint components/org/DomainSkillStudio.tsx components/org/OrgDnaEditor.tsx && npm run build`
Expected: clean.

- [ ] **Step 4: Manual verify (verify skill)**

Start the app, open a workspace with Org DNA filled, generate a specialist, watch the reveal stream, save it. Confirm `getOrgSkill` returns it on reload.

- [ ] **Step 5: Commit**

```bash
git add components/org/DomainSkillStudio.tsx components/org/OrgDnaEditor.tsx
git commit -m "feat(org): Domain Skill Studio card — generate + reveal + save the specialist"
```

---

### Task 8: UI — "powered by specialist" chip + changelog/version

**Files:**
- Modify: `components/studio/TopBar.tsx` (chip when the project's workspace has a specialist)
- Create: `lib/skills/use-org-skill.ts` (small client hook: given `project.orgId`, fetch the specialist name)
- Modify: `lib/changelog.ts`, `package.json`

**Interfaces:**
- Consumes: `getOrgSkill` (Task 4).
- Produces: a TopBar chip `⚡ ขับเคลื่อนโดย <name>` (title shows it auto-applies; hidden when none).

- [ ] **Step 1: Hook `lib/skills/use-org-skill.ts`**

```ts
"use client";
import { useEffect, useState } from "react";
import { getOrgSkill } from "@/lib/org-skills";

export function useOrgSkillName(orgId: string | null | undefined): string | null {
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    if (!orgId) { setName(null); return; }
    let cancelled = false;
    void getOrgSkill(orgId).then((s) => { if (!cancelled) setName(s?.name ?? null); }).catch(() => {});
    return () => { cancelled = true; };
  }, [orgId]);
  return name;
}
```

- [ ] **Step 2: Render the chip in `TopBar.tsx`**

Near the QuotaChip: `const specialist = useOrgSkillName(project.orgId);` then, before the Export button:
```tsx
{specialist && (
  <span title={`เดโมใน workspace นี้ขับเคลื่อนโดยผู้เชี่ยวชาญ "${specialist}"`}
    className="inline-flex shrink-0 items-center gap-1 rounded-full border border-shine/40 bg-shine/10 px-2 py-1 font-mono text-[10px] text-shine">
    <Sparkles size={11} /> <span className="hidden lg:inline">ขับเคลื่อนโดย</span> {specialist}
  </span>
)}
```
Add `Sparkles` to the lucide import.

- [ ] **Step 3: Changelog + version bump**

Add a `feature` entry (v0.29.0) to `lib/changelog.ts` describing the Domain Skill Studio; bump `package.json` to `0.29.0`.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npx eslint components/studio/TopBar.tsx lib/skills/use-org-skill.ts && npm run build && npx vitest run`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add components/studio/TopBar.tsx lib/skills/use-org-skill.ts lib/changelog.ts package.json
git commit -m "feat(studio): 'powered by <specialist>' chip + v0.29.0 changelog"
```

---

## Self-Review

**Spec coverage (Part A):** ✅ migration+RLS (T1), types/mapper (T2), shared generator (T3), org-skills CRUD (T4), `/api/org-skill/generate` with Org DNA (T5), auto-apply wiring (T6), Studio card + reveal (T7), TopBar chip (T8). Editing/versioning of the specialist beyond regenerate-and-replace is deferred (spec §Non-goals allows one-per-workspace + replace-with-snapshot; full version history is a follow-up). Auto-apply override via SkillPicker is available through the existing picker (unchanged) — noted, not re-implemented here.

**Placeholder scan:** No "TBD"/"add error handling" — errors are handled explicitly (toast/SSE `error`/RLS-denial toast). Task 7 JSX is described against a concrete existing pattern with the real logic supplied; the executor fills styled markup following `OrgDnaEditor`.

**Type consistency:** `GeneratedSkill`/`GenerateSkillEvent` (lib/types) reused across T3/T5/T7; `SkillTemplateRow` extended in T2 and consumed in T4/T6; `orgSkillSlug`/`saveOrgSkill` names consistent T4→T7; `resolveSkillForProject(skillId, projectId)` signature consistent T6.

**Part B (Living Org DNA):** intentionally NOT in this plan — separate plan `2026-07-14-living-org-dna-part-b.md` after Part A ships.
