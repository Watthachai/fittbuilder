# Living Org DNA (Part B / v1.1) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** While chatting with the AI in a project that belongs to a workspace, detect org-relevant facts the user reveals, propose adding them to the workspace's Org DNA, and — on confirm — append them as a new versioned snapshot.

**Architecture:** A lightweight JSON classification call (`/api/dna-capture`, mirroring `/api/extract-answers`) runs fire-and-forget after each substantive user message when `org != null`. A match surfaces a chip in the chat; on confirm, a shared `appendDnaBlock` helper appends the snippet to the mapped block + pushes an `OrgDnaVersion`, persisted via the existing `updateOrgDna` and reflected in Studio's `org` state. Never writes silently (shared resource; RLS `orgs_update` = org member).

**Tech Stack:** Next.js 16 route handler, `generateText` (json) from `lib/gemini`, Supabase client (`updateOrgDna`), React 19 client components, vitest.

**Spec:** `docs/superpowers/specs/2026-07-14-domain-skill-studio-design.md` §4 (Part B). Part A (Domain Skill Studio) is already shipped on this branch.

## Global Constraints

- `OrgDna` text blocks are exactly: `decisionRights | information | motivators | structure` (the `DnaTextKey` union; see `lib/org-dna.ts` `DNA_BLOCKS`). Never invent other block keys.
- `OrgDnaVersion = { id, createdAt, source: "ai"|"manual", snapshot: Omit<OrgDna,"versions"> }`; versions list is newest-first, capped at 12 (matches `OrgDnaEditor`).
- Writes go through `updateOrgDna(orgId, dna)` (client, RLS-gated to org members). Never write Org DNA silently — always require an explicit user confirm.
- `generateText` is server-only (`lib/gemini`), signature `{ system, user, json?, temperature?, maxOutputTokens?, onUsage? }`. Record usage with `recordUsage({..., kind: "org_dna" })` (existing kind) in `after()`. Rate-limit with `await rateLimit(key, max)` (async).
- Thai UI copy; midnight-studio tokens; no `Date.now()` during React render (snapshot via `useState(() => Date.now())` if needed). `SkillTemplate` lives in `@/lib/skills/types`; `OrgDna`/`OrgDnaVersion` in `@/lib/types`.
- Per change: `npx tsc --noEmit` + `npx eslint <files>` + `npm run build` + `npx vitest run` green; commit only the task's exact files (never `git add` pre-existing dirty `lib/scaffold.ts`, `public/*`, `graphify-out/*`, `scratchpad/*`). Do NOT push dev/main (auto-deploys).

---

### Task 1: Part A polish (feature-specific follow-ups)

**Files:**
- Modify: `components/org/DomainSkillStudio.tsx` (reveal: status-only aria-live + auto-scroll)
- Modify: `lib/org-skills.ts` (`saveOrgSkill` preserves original `created_by` on update)
- Modify: `lib/skills/org-resolve.ts` (log, don't swallow, query errors)

**Interfaces:** No new exports; behavior polish only.

- [ ] **Step 1: DomainSkillStudio a11y + auto-scroll.** In `components/org/DomainSkillStudio.tsx`: (a) change the streamed reveal container's `aria-live` from the growing Markdown body to `aria-live="off"`, and add a separate visually-hidden `aria-live="polite"` status line that announces only a short status string (e.g. `busy ? "กำลังค้นคว้าและร่างผู้เชี่ยวชาญ…" : draft ? "ร่างเสร็จแล้ว" : ""`). (b) Add auto-scroll: a `ref` on the reveal panel and an effect `useEffect(() => { el.current?.scrollTo({ top: el.current.scrollHeight }); }, [report])` so new tokens stay in view. Respect `prefers-reduced-motion` (use `behavior: "auto"`).

- [ ] **Step 2: Preserve created_by on update.** In `lib/org-skills.ts` `saveOrgSkill`: before upsert, read the existing row's `created_by` (`getOrgSkill` doesn't expose it — do a targeted `select("created_by").eq("org_id", orgId).maybeSingle()`); if a row exists, pass that original `created_by` into `skillTemplateToInsertRow`'s `createdBy` instead of the current user, so a regenerate/edit by another member doesn't overwrite authorship. New rows still use the current user id.

- [ ] **Step 3: Log query errors in org-resolve.** In `lib/skills/org-resolve.ts`, destructure `error` on both admin queries and `console.error("[org-resolve] <which> failed:", error)` when present (still fall through to `undefined` — fail closed, but observable).

- [ ] **Step 4: Verify + commit.**

Run: `npx tsc --noEmit && npx eslint components/org/DomainSkillStudio.tsx lib/org-skills.ts lib/skills/org-resolve.ts && npm run build`
Expected: clean.
```bash
git add components/org/DomainSkillStudio.tsx lib/org-skills.ts lib/skills/org-resolve.ts
git commit -m "polish(skills): studio a11y+autoscroll, preserve created_by, log org-resolve errors"
```

---

### Task 2: `appendDnaBlock` shared helper

**Files:**
- Modify: `lib/org-dna.ts` (add `appendDnaBlock` + `MAX_DNA_VERSIONS`)
- Test: `lib/__tests__/org-dna.test.ts`

**Interfaces:**
- Produces: `MAX_DNA_VERSIONS = 12`; `appendDnaBlock(dna: OrgDna, block: DnaTextKey, snippet: string): OrgDna` — returns a new OrgDna with `snippet` appended to `block` (newline-joined if the block already had text) and a new `OrgDnaVersion` (source `"ai"`) prepended (capped at `MAX_DNA_VERSIONS`).

- [ ] **Step 1: Write the failing test**

```ts
// lib/__tests__/org-dna.test.ts
import { describe, expect, it } from "vitest";
import { appendDnaBlock } from "@/lib/org-dna";
import type { OrgDna } from "@/lib/types";

describe("appendDnaBlock", () => {
  it("appends to an empty block and records a version", () => {
    const out = appendDnaBlock({}, "decisionRights", "อนุมัติงบผ่าน 3 กรรมการ");
    expect(out.decisionRights).toBe("อนุมัติงบผ่าน 3 กรรมการ");
    expect(out.versions).toHaveLength(1);
    expect(out.versions![0].source).toBe("ai");
    expect(out.versions![0].snapshot.decisionRights).toBe("อนุมัติงบผ่าน 3 กรรมการ");
  });

  it("newline-joins when the block already has text and prepends the version", () => {
    const base: OrgDna = { information: "ข้อมูลอยู่ในไซโล", versions: [] };
    const out = appendDnaBlock(base, "information", "มี DataX เป็นศูนย์กลาง");
    expect(out.information).toBe("ข้อมูลอยู่ในไซโล\nมี DataX เป็นศูนย์กลาง");
    expect(out.versions).toHaveLength(1);
  });

  it("caps versions at MAX_DNA_VERSIONS (12)", () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      id: `v${i}`, createdAt: "2026-01-01T00:00:00Z", source: "ai" as const, snapshot: {},
    }));
    const out = appendDnaBlock({ versions: many }, "structure", "แยกเป็นบริษัทลูก");
    expect(out.versions).toHaveLength(12);
    expect(out.versions![0].snapshot.structure).toBe("แยกเป็นบริษัทลูก");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/__tests__/org-dna.test.ts`
Expected: FAIL — `appendDnaBlock is not a function`.

- [ ] **Step 3: Implement in `lib/org-dna.ts`**

Add (import `OrgDna`, `OrgDnaVersion`, and the `DnaTextKey` type already used by `DNA_BLOCKS` from their sources at the top of the file):

```ts
export const MAX_DNA_VERSIONS = 12;

/** Append a captured snippet to one DNA block and record a version (newest-first,
 *  capped). Pure except for id/timestamp generation. Used by Living Org DNA
 *  capture and any other incremental DNA edit. */
export function appendDnaBlock(dna: OrgDna, block: DnaTextKey, snippet: string): OrgDna {
  const clean = snippet.trim();
  const existing = dna[block]?.trim();
  const nextText = existing ? `${existing}\n${clean}` : clean;
  const { versions: _drop, ...rest } = dna;
  const snapshot: Omit<OrgDna, "versions"> = { ...rest, [block]: nextText };
  const version: OrgDnaVersion = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    source: "ai",
    snapshot,
  };
  const versions = [version, ...(dna.versions ?? [])].slice(0, MAX_DNA_VERSIONS);
  return { ...dna, [block]: nextText, versions };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/__tests__/org-dna.test.ts`
Expected: PASS (3/3).

- [ ] **Step 5: Commit**

```bash
git add lib/org-dna.ts lib/__tests__/org-dna.test.ts
git commit -m "feat(org-dna): appendDnaBlock helper — append snippet + versioned snapshot"
```

---

### Task 3: `/api/dna-capture` + prompt + client lib

**Files:**
- Modify: `lib/prompts.ts` (add `buildDnaCaptureSystem`)
- Create: `app/api/dna-capture/route.ts`
- Create: `lib/dna-capture.ts` (client `captureDnaFromText`)

**Interfaces:**
- Consumes: `generateText` (`lib/gemini`), `currentUserId`/`recordUsage` (`lib/ai-usage`), `rateLimit`/`clientIp` (`lib/rate-limit`).
- Produces: `DnaCapture = { block: DnaTextKey; snippet: string }`; `captureDnaFromText(text: string): Promise<DnaCapture | null>` (client).

- [ ] **Step 1: Add the classification prompt to `lib/prompts.ts`**

```ts
/** System prompt for Living Org DNA capture: classify a user chat message into one
 *  of the 4 Org DNA blocks + extract a concise Thai snippet, or return none. */
export function buildDnaCaptureSystem(): string {
  return `คุณเป็นตัวช่วยสกัด "Org DNA" จากข้อความแชทของผู้ใช้ (โมเดล 4 ฐานราก).
พิจารณาข้อความเดียวที่ผู้ใช้พิมพ์ แล้วตัดสินว่ามัน "เผยข้อมูลเกี่ยวกับวิธีทำงานขององค์กร" หรือไม่ — ถ้าใช่ จัดเข้า 1 ใน 4 บล็อก:
- decisionRights: ใครมีอำนาจตัดสินใจ/ต้องอนุมัติกี่ขั้น
- information: ข้อมูลไหลข้ามสายงานไหม, KPI, ระบบ/แหล่งข้อมูล
- motivators: ผลตอบแทน/รางวัล/แรงจูงใจ/วัฒนธรรมความเสี่ยง
- structure: โครงสร้าง/ลำดับขั้น/การแบ่งทีมหรือบริษัท
คืน JSON เท่านั้น รูปแบบ:
{"block": "decisionRights"|"information"|"motivators"|"structure"|null, "snippet": "ประโยคสรุปสั้นๆ เป็นภาษาไทย (<=140 ตัวอักษร)"}
ถ้าข้อความเป็นแค่คำสั่งสร้างงาน/คำถามทั่วไป/ไม่ได้บอกลักษณะองค์กร ให้ block=null.`;
}
```

- [ ] **Step 2: Create `app/api/dna-capture/route.ts`**

```ts
import { after } from "next/server";
import { z } from "zod";
import { generateText, MissingApiKeyError, type TokenUsage } from "@/lib/gemini";
import { currentUserId, recordUsage } from "@/lib/ai-usage";
import { buildDnaCaptureSystem } from "@/lib/prompts";
import { clientIp, rateLimit } from "@/lib/rate-limit";

const BLOCKS = ["decisionRights", "information", "motivators", "structure"] as const;

const bodySchema = z.object({ text: z.string().trim().min(12).max(4_000) });

export async function POST(request: Request) {
  const limit = await rateLimit(`dnacap:${clientIp(request)}`, 30);
  if (!limit.ok) return Response.json({ error: "คำขอถี่เกินไป" }, { status: 429 });

  let body: z.infer<typeof bodySchema>;
  try { body = bodySchema.parse(await request.json()); }
  catch { return Response.json({ block: null }); } // too short / invalid → nothing to capture

  let usage: TokenUsage | null = null;
  const userId = await currentUserId();
  after(() => void recordUsage({ userId, projectId: null, kind: "org_dna", usage }));

  try {
    const raw = await generateText({
      system: buildDnaCaptureSystem(),
      user: body.text.slice(0, 4_000),
      json: true,
      temperature: 0,
      maxOutputTokens: 512,
      onUsage: (u) => { usage = u; },
    });
    const parsed = JSON.parse(raw) as { block?: unknown; snippet?: unknown };
    const block = typeof parsed.block === "string" && (BLOCKS as readonly string[]).includes(parsed.block)
      ? (parsed.block as (typeof BLOCKS)[number]) : null;
    const snippet = typeof parsed.snippet === "string" ? parsed.snippet.trim() : "";
    if (!block || !snippet) return Response.json({ block: null });
    return Response.json({ block, snippet: snippet.slice(0, 140) });
  } catch (error) {
    if (error instanceof MissingApiKeyError) return Response.json({ block: null });
    console.error("[dna-capture] failed:", error);
    return Response.json({ block: null }); // never disrupt the chat
  }
}
```

- [ ] **Step 3: Create `lib/dna-capture.ts` (client)**

```ts
"use client";

import type { DnaTextKey } from "@/lib/org-dna";

export interface DnaCapture {
  block: DnaTextKey;
  snippet: string;
}

/** Ask the server whether a chat message reveals an Org DNA fact. Returns null on
 *  no-match or any failure — capture must never disrupt the chat. */
export async function captureDnaFromText(text: string): Promise<DnaCapture | null> {
  try {
    const res = await fetch("/api/dna-capture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { block: DnaTextKey | null; snippet?: string };
    return data.block && data.snippet ? { block: data.block, snippet: data.snippet } : null;
  } catch {
    return null;
  }
}
```
(If `DnaTextKey` is not exported from `lib/org-dna.ts`, export it there — it's the union backing `DNA_BLOCKS[].key`.)

- [ ] **Step 4: Verify + commit**

Run: `npx tsc --noEmit && npx eslint app/api/dna-capture/route.ts lib/dna-capture.ts lib/prompts.ts && npm run build`
Expected: clean; `/api/dna-capture` in the route list.
```bash
git add app/api/dna-capture/route.ts lib/dna-capture.ts lib/prompts.ts
git commit -m "feat(dna): /api/dna-capture — classify a chat message into an Org DNA block"
```

---

### Task 4: `DnaCaptureChip` component

**Files:**
- Create: `components/studio/DnaCaptureChip.tsx`

**Interfaces:**
- Consumes: `DnaCapture` (`lib/dna-capture`), `DNA_BLOCKS` (`lib/org-dna`) for the block's Thai label.
- Produces: `<DnaCaptureChip capture onAdd onDismiss busy />` — a compact chip showing the block label + snippet with "เพิ่มเข้า Org DNA" / "ข้าม".

- [ ] **Step 1: Implement**

```tsx
"use client";

import { Check, Dna, X } from "lucide-react";
import { DNA_BLOCKS } from "@/lib/org-dna";
import type { DnaCapture } from "@/lib/dna-capture";

export default function DnaCaptureChip({
  capture, onAdd, onDismiss, busy,
}: {
  capture: DnaCapture;
  onAdd: () => void;
  onDismiss: () => void;
  busy: boolean;
}) {
  const label = DNA_BLOCKS.find((b) => b.key === capture.block)?.th ?? capture.block;
  return (
    <div className="mx-3 mb-2 flex items-start gap-2 rounded-lg border border-shine/40 bg-shine/[0.06] px-3 py-2">
      <Dna size={14} className="mt-0.5 shrink-0 text-shine" />
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[10px] uppercase tracking-wider text-shine">เจอข้อมูลองค์กร · {label}</p>
        <p className="mt-0.5 line-clamp-2 text-[12px] text-chalk">“{capture.snippet}”</p>
      </div>
      <button onClick={onAdd} disabled={busy}
        className="inline-flex shrink-0 items-center gap-1 rounded-full bg-shine px-2.5 py-1 font-display text-[11px] font-semibold text-night transition hover:brightness-110 disabled:opacity-50">
        <Check size={12} /> เพิ่มเข้า Org DNA
      </button>
      <button onClick={onDismiss} disabled={busy} aria-label="ข้าม"
        className="shrink-0 rounded-sm p-1 text-chalk-dim transition hover:text-chalk disabled:opacity-50">
        <X size={13} />
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Verify + commit**

Run: `npx tsc --noEmit && npx eslint components/studio/DnaCaptureChip.tsx && npm run build`
Expected: clean.
```bash
git add components/studio/DnaCaptureChip.tsx
git commit -m "feat(studio): DnaCaptureChip — confirm adding a captured fact to Org DNA"
```

---

### Task 5: Wire capture into the Studio chat + changelog

**Files:**
- Modify: `components/studio/Studio.tsx` (fire capture on submit when `org` set; hold pending capture; render chip; confirm → append + persist + setOrg)
- Modify: `components/studio/ChatPanel.tsx` (accept + render an optional chip slot above the input)
- Modify: `lib/changelog.ts`, `package.json`

**Interfaces:**
- Consumes: `captureDnaFromText` (`lib/dna-capture`), `appendDnaBlock` (`lib/org-dna`), `updateOrgDna` (`lib/orgs`), `DnaCaptureChip` (Task 4), `toast`.

- [ ] **Step 1: Studio state + capture trigger.** In `components/studio/Studio.tsx`:
  - Add state: `const [dnaCapture, setDnaCapture] = useState<DnaCapture | null>(null);` and `const [dnaSaving, setDnaSaving] = useState(false);`.
  - Wrap the ChatPanel `onSubmit` (currently `(full, media) => { ...; void runAgent(full, undefined, undefined, media); }` around line 1620): AFTER kicking off `runAgent`, if `org` is set and `full.trim().length >= 12`, fire-and-forget `void captureDnaFromText(full).then((c) => { if (c) setDnaCapture(c); }).catch(() => {})`. Do not await; never block the turn. (Only one pending chip at a time — a new capture replaces the old.)
  - Add `const addDnaCapture = useCallback(async () => { if (!dnaCapture || !org) return; setDnaSaving(true); try { const next = appendDnaBlock(org.dna, dnaCapture.block, dnaCapture.snippet); await updateOrgDna(org.id, next); setOrg({ ...org, dna: next }); toast.success("เพิ่มเข้า Org DNA แล้ว"); setDnaCapture(null); } catch (e) { toast.error("เพิ่มไม่สำเร็จ", { description: e instanceof Error ? e.message : undefined }); } finally { setDnaSaving(false); } }, [dnaCapture, org]);`.
  - Clear the capture when switching projects (add `setDnaCapture(null)` where `org` is (re)loaded, near line 1240-1249) so a stale chip doesn't cross projects.

- [ ] **Step 2: Pass the chip to ChatPanel.** Add props to `ChatPanelProps` in `components/studio/ChatPanel.tsx`: `dnaCapture?: DnaCapture | null; onDnaAdd?: () => void; onDnaDismiss?: () => void; dnaSaving?: boolean;`. Render `{dnaCapture && onDnaAdd && onDnaDismiss && (<DnaCaptureChip capture={dnaCapture} onAdd={onDnaAdd} onDismiss={onDnaDismiss} busy={!!dnaSaving} />)}` immediately ABOVE the chat input row (find the input container in the component's return). Import `DnaCaptureChip` + the `DnaCapture` type.
  - In Studio's `<ChatPanel ... />` (around line 1602), pass `dnaCapture={dnaCapture}`, `onDnaAdd={() => void addDnaCapture()}`, `onDnaDismiss={() => setDnaCapture(null)}`, `dnaSaving={dnaSaving}`.

- [ ] **Step 3: Changelog + version.** Add a v0.30.0 `feature` entry to `lib/changelog.ts` (top, newest-first, same shape) describing Living Org DNA (AI notices org facts while you chat and offers to add them to Org DNA with one tap; versioned; confirm-before-write). Bump `package.json` to `0.30.0`.

- [ ] **Step 4: Verify + commit**

Run: `npx tsc --noEmit && npx eslint components/studio/Studio.tsx components/studio/ChatPanel.tsx && npm run build && npx vitest run`
Expected: all green.
```bash
git add components/studio/Studio.tsx components/studio/ChatPanel.tsx lib/changelog.ts package.json
git commit -m "feat(dna): Living Org DNA — capture org facts from chat into Org DNA (v0.30.0)"
```

---

## Self-Review

**Spec coverage (§4):** ✅ detection endpoint (T3), block-mapped classification (T3 prompt), confirm-before-write chip (T4), append+version write-back via updateOrgDna (T2+T5), fired only when project has an org + on substantive messages, fire-and-forget non-disruptive (T5). Plus Part A polish (T1).

**Placeholder scan:** none — every step has concrete code or precise edit instructions against named hook points (Studio onSubmit ~L1620, org load ~L1240, ChatPanel input row).

**Type consistency:** `DnaCapture`/`DnaTextKey` used across T3/T4/T5; `appendDnaBlock(dna, block, snippet)` signature consistent T2→T5; `captureDnaFromText` T3→T5; `MAX_DNA_VERSIONS` in T2.

**Security note:** `/api/dna-capture` only classifies the caller's OWN message text (no cross-tenant read); the WRITE (`updateOrgDna`) is RLS-gated to org members — a non-member's confirm fails at the DB with a toast. No new authorization surface.
