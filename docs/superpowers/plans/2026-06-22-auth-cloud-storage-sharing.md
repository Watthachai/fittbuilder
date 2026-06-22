# Auth + Cloud Storage + Team Sharing + Changelog — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move FITT Builder from single-device localStorage to a multi-user product — forced Supabase login, cloud project storage guarded by RLS, async team sharing (link + email invites with viewer/editor roles), DMAIL invite emails, and an in-app Changelog page.

**Architecture:** Supabase Auth + Postgres accessed via `@supabase/ssr` (cookie sessions). Row-Level Security is the leak guard; `lib/storage.ts` is rewritten from sync localStorage to async Supabase calls behind the same function names, with pure helpers untouched. The studio keeps the project in React state and debounce-saves to the cloud. Sharing logic lives in `lib/sharing.ts`; invite emails go through the existing DMAIL HTTP API in `lib/email.ts`.

**Tech Stack:** Next.js 16 (App Router, `proxy.ts`), `@supabase/supabase-js`, `@supabase/ssr`, Postgres + RLS, Vitest (pure-logic units only), DMAIL transactional email API.

## Global Constraints

- Next.js 16.2.9 — async request APIs (`await cookies()`), middleware file is **`proxy.ts`** at repo root (not `middleware.ts`). Read `node_modules/next/dist/docs/` before writing Next.js code.
- TypeScript strict mode; path alias `@/*` → repo root.
- Every app table is named with the prefix `fittbuilder_` (verbatim). Never modify Supabase's `auth.users`.
- Authorization is enforced by Postgres **RLS**, not app code. Membership checks go through `SECURITY DEFINER` helper functions to avoid policy recursion.
- Roles are exactly the string literals `'viewer'` and `'editor'`. Invite status is exactly `'pending' | 'accepted' | 'revoked'`.
- Forced login: only `/login`, `/auth/callback`, `/changelog`, `/join/*`, and static assets are reachable logged-out.
- No localStorage migration — delete the `pb:` localStorage code paths; do not dual-write.
- Env vars (exact names): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server-only), `DMAIL_API_KEY` (server-only).
- DMAIL endpoint: `https://dmailservicebackend-sandbox-1095128507689.asia-southeast1.run.app/api/v1/mail/send`, auth header `X-API-Key`, invite template id `4b72b137-4124-4b4a-982b-a7b38d723547`.
- Keep the existing COOP/COEP headers in `next.config.ts` unchanged (WebContainers need them).

## Testing Strategy (read before Task 1)

This repo has **no test framework**. Per CLAUDE.md "don't overengineer," we add **Vitest only for pure logic** that is cheap to test in isolation: the row↔record mapper, the DMAIL payload builder, and the changelog comparison helper. Everything else — SQL/RLS, Supabase clients, auth, routes, and UI — is verified by `npx tsc --noEmit`, `npm run lint`, `npm run build`, scripted SQL proof queries, and the manual flows listed per task. Do **not** write Supabase-integration or DOM tests; they are out of proportion here.

## Prerequisites (one-time external setup — do before Task 2)

The human (or the Supabase MCP) must, before Task 2's migration can be applied:
1. Create a Supabase project (free tier).
2. Put `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`.
3. Enable Google OAuth + Email (magic link) providers in Supabase Auth settings; set the site URL + `/auth/callback` redirect.
4. Put `DMAIL_API_KEY` in `.env.local`.

The migration SQL (Task 2) is applied via the Supabase SQL editor, the Supabase MCP, or `supabase db push`. Type generation (Task 3) requires the project to exist.

## File Structure

| File | Responsibility |
|---|---|
| `supabase/migrations/0001_init.sql` | Tables, triggers, RLS helpers + policies (the leak guard) |
| `lib/db/types.ts` | Generated Supabase types (`Database`) |
| `lib/supabase/server.ts` | Server-side Supabase client (RSC / route handlers) |
| `lib/supabase/client.ts` | Browser Supabase client |
| `lib/supabase/middleware.ts` | Session-refresh helper used by `proxy.ts` |
| `proxy.ts` | Forced-login redirect + session refresh |
| `app/login/page.tsx` | Google + magic-link login UI |
| `app/auth/callback/route.ts` | OAuth/OTP code exchange + pending-invite resolution |
| `lib/db/project-mapper.ts` | Row ↔ `ProjectRecord` mapping (pure) |
| `lib/storage.ts` | Async cloud persistence (rewritten); pure helpers kept |
| `lib/sharing.ts` | Share link, members, invites, join-by-token |
| `lib/email.ts` | DMAIL invite email (`buildInvitePayload` pure + sender) |
| `app/join/[token]/route.ts` | Add caller as member from a share link |
| `lib/changelog.ts` | Changelog content + comparison helpers (pure) |
| `app/changelog/page.tsx` | Changelog page |
| `components/studio/ShareModal.tsx` | Sharing UI |
| `components/studio/Studio.tsx` | Async load/save + role-gating (modify) |
| `components/landing/LaunchPad.tsx` | `await createProject` (modify) |
| `components/projects/ProjectGrid.tsx` | Async list, owned vs shared (modify) |
| `lib/types.ts` | `ShareRole`, `ProjectMember`, `ProjectInvite`, `ProjectSummary.access/role` (modify) |

---

## Task 1: Dependencies + Vitest harness + env scaffolding

**Files:**
- Modify: `package.json` (deps + `test` script)
- Create: `vitest.config.ts`
- Create: `lib/__tests__/smoke.test.ts`
- Modify: `.env.example`

**Interfaces:**
- Produces: a working `npx vitest run`; Supabase + ssr packages installed.

- [ ] **Step 1: Install packages**

```bash
npm install @supabase/supabase-js @supabase/ssr
npm install -D vitest
```

- [ ] **Step 2: Add the test script to `package.json`**

In the `"scripts"` block add:
```json
"test": "vitest run"
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  test: { environment: "node", include: ["**/__tests__/**/*.test.ts"] },
  resolve: { alias: { "@": resolve(__dirname, ".") } },
});
```

- [ ] **Step 4: Write the smoke test**

`lib/__tests__/smoke.test.ts`:
```ts
import { expect, test } from "vitest";

test("vitest runs", () => {
  expect(1 + 1).toBe(2);
});
```

- [ ] **Step 5: Run it**

Run: `npx vitest run`
Expected: 1 passed.

- [ ] **Step 6: Append to `.env.example`**

```bash
# Supabase (cloud auth + storage)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
# DMAIL transactional email (team invites)
DMAIL_API_KEY=
```

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vitest.config.ts lib/__tests__/smoke.test.ts .env.example
git commit -m "chore: add supabase + ssr deps and vitest harness"
```

---

## Task 2: Supabase schema + RLS migration

**Files:**
- Create: `supabase/migrations/0001_init.sql`

**Interfaces:**
- Produces: tables `fittbuilder_profiles`, `fittbuilder_projects`, `fittbuilder_project_members`, `fittbuilder_project_invites`; functions `fittbuilder_can_read_project(uuid, uuid)`, `fittbuilder_can_edit_project(uuid, uuid)`; auto-profile trigger; `updated_at` trigger.

- [ ] **Step 1: Write the migration**

`supabase/migrations/0001_init.sql`:
```sql
-- ---------- profiles ----------
create table fittbuilder_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text,
  avatar_url text,
  plan text not null default 'free',
  last_seen_changelog text,
  created_at timestamptz not null default now()
);

-- auto-create a profile row on signup
create function fittbuilder_handle_new_user() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  insert into fittbuilder_profiles (id, email, name, avatar_url)
  values (new.id, new.email,
          new.raw_user_meta_data->>'full_name',
          new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;
  return new;
end; $$;

create trigger fittbuilder_on_auth_user_created
  after insert on auth.users
  for each row execute function fittbuilder_handle_new_user();

-- ---------- projects ----------
create table fittbuilder_projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Untitled',
  files jsonb,
  phase text not null default 'define',
  approved_phases jsonb not null default '[]',
  history jsonb not null default '[]',
  messages jsonb not null default '[]',
  share_token text unique,
  share_role text check (share_role in ('viewer','editor')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on fittbuilder_projects (owner_id);

create function fittbuilder_touch_updated_at() returns trigger
  language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger fittbuilder_projects_touch
  before update on fittbuilder_projects
  for each row execute function fittbuilder_touch_updated_at();

-- ---------- members ----------
create table fittbuilder_project_members (
  project_id uuid not null references fittbuilder_projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('viewer','editor')),
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);
create index on fittbuilder_project_members (user_id);

-- ---------- invites ----------
create table fittbuilder_project_invites (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references fittbuilder_projects(id) on delete cascade,
  email text not null,
  role text not null check (role in ('viewer','editor')),
  token text not null unique,
  status text not null default 'pending' check (status in ('pending','accepted','revoked')),
  expires_at timestamptz not null default now() + interval '14 days',
  created_at timestamptz not null default now()
);
create index on fittbuilder_project_invites (lower(email));

-- ---------- RLS helper functions (bypass RLS internally to avoid recursion) ----------
create function fittbuilder_can_read_project(pid uuid, uid uuid) returns boolean
  language sql security definer stable set search_path = public as $$
    select exists(select 1 from fittbuilder_projects p where p.id = pid and p.owner_id = uid)
        or exists(select 1 from fittbuilder_project_members m where m.project_id = pid and m.user_id = uid);
  $$;

create function fittbuilder_can_edit_project(pid uuid, uid uuid) returns boolean
  language sql security definer stable set search_path = public as $$
    select exists(select 1 from fittbuilder_projects p where p.id = pid and p.owner_id = uid)
        or exists(select 1 from fittbuilder_project_members m
                  where m.project_id = pid and m.user_id = uid and m.role = 'editor');
  $$;

create function fittbuilder_is_project_owner(pid uuid, uid uuid) returns boolean
  language sql security definer stable set search_path = public as $$
    select exists(select 1 from fittbuilder_projects p where p.id = pid and p.owner_id = uid);
  $$;

-- ---------- enable RLS ----------
alter table fittbuilder_profiles         enable row level security;
alter table fittbuilder_projects         enable row level security;
alter table fittbuilder_project_members  enable row level security;
alter table fittbuilder_project_invites  enable row level security;

-- profiles
create policy profiles_select_own on fittbuilder_profiles
  for select using (id = auth.uid());
create policy profiles_update_own on fittbuilder_profiles
  for update using (id = auth.uid());

-- projects
create policy projects_select on fittbuilder_projects
  for select using (fittbuilder_can_read_project(id, auth.uid()));
create policy projects_insert on fittbuilder_projects
  for insert with check (owner_id = auth.uid());
create policy projects_update on fittbuilder_projects
  for update using (fittbuilder_can_edit_project(id, auth.uid()));
create policy projects_delete on fittbuilder_projects
  for delete using (owner_id = auth.uid());

-- members
create policy members_select on fittbuilder_project_members
  for select using (fittbuilder_can_read_project(project_id, auth.uid()));
create policy members_insert on fittbuilder_project_members
  for insert with check (fittbuilder_is_project_owner(project_id, auth.uid()));
create policy members_update on fittbuilder_project_members
  for update using (fittbuilder_is_project_owner(project_id, auth.uid()));
create policy members_delete on fittbuilder_project_members
  for delete using (fittbuilder_is_project_owner(project_id, auth.uid()) or user_id = auth.uid());

-- invites
create policy invites_select on fittbuilder_project_invites
  for select using (fittbuilder_is_project_owner(project_id, auth.uid()));
create policy invites_insert on fittbuilder_project_invites
  for insert with check (fittbuilder_is_project_owner(project_id, auth.uid()));
create policy invites_update on fittbuilder_project_invites
  for update using (fittbuilder_is_project_owner(project_id, auth.uid()));
create policy invites_delete on fittbuilder_project_invites
  for delete using (fittbuilder_is_project_owner(project_id, auth.uid()));
```

- [ ] **Step 2: Apply the migration**

Apply via Supabase SQL editor (paste the file), the Supabase MCP, or `supabase db push`. Expected: no errors; 4 tables + 5 functions created.

- [ ] **Step 3: RLS proof query (run in SQL editor as two different users, or with `set local role`)**

Create a project as user A, then as user B run:
```sql
select count(*) from fittbuilder_projects; -- B sees only B's rows (0 of A's)
```
Expected: B cannot see A's project. Document the result in the task report.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0001_init.sql
git commit -m "feat(db): supabase schema + RLS for fittbuilder_ tables"
```

---

## Task 3: Supabase clients + generated types

**Files:**
- Create: `lib/db/types.ts` (generated)
- Create: `lib/supabase/server.ts`, `lib/supabase/client.ts`, `lib/supabase/middleware.ts`

**Interfaces:**
- Consumes: `Database` type from `lib/db/types.ts`.
- Produces: `createClient()` (browser) in `client.ts`; `createClient()` (async, server) in `server.ts`; `updateSession(request)` in `middleware.ts`.

- [ ] **Step 1: Generate DB types**

```bash
npx supabase gen types typescript --project-id <PROJECT_REF> --schema public > lib/db/types.ts
```
(If the CLI is unavailable, generate via the Supabase MCP and write the same file.)

- [ ] **Step 2: Browser client** — `lib/supabase/client.ts`

```ts
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/db/types";

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 3: Server client** — `lib/supabase/server.ts` (read `node_modules/next/dist/docs/` for async `cookies()`)

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/db/types";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(toSet) {
          try {
            toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // called from a Server Component — safe to ignore; proxy.ts refreshes.
          }
        },
      },
    }
  );
}
```

- [ ] **Step 4: Session-refresh helper** — `lib/supabase/middleware.ts`

```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/db/types";

const PUBLIC_PREFIXES = ["/login", "/auth", "/changelog", "/join"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(toSet) {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  return response;
}
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add lib/db/types.ts lib/supabase/
git commit -m "feat(auth): supabase browser/server/middleware clients + generated types"
```

---

## Task 4: `proxy.ts` forced login

**Files:**
- Create: `proxy.ts` (repo root)

**Interfaces:**
- Consumes: `updateSession` from `lib/supabase/middleware.ts`.

- [ ] **Step 1: Read the Next 16 proxy doc**

Read `node_modules/next/dist/docs/` for the proxy/middleware reference — confirm the export name (`proxy` vs default) and `config.matcher` shape for 16.2.9. Use what the doc specifies.

- [ ] **Step 2: Write `proxy.ts`** (adjust the export to match the doc from Step 1)

```ts
import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: compiles; proxy registered.

- [ ] **Step 4: Manual check**

`npm run dev`, open an incognito window to `http://localhost:3000/` → redirected to `/login`. Open `/changelog` → loads without login.

- [ ] **Step 5: Commit**

```bash
git add proxy.ts
git commit -m "feat(auth): proxy.ts enforces login except public routes"
```

---

## Task 5: Login page + auth callback + pending-invite resolution

**Files:**
- Create: `app/login/page.tsx`
- Create: `app/auth/callback/route.ts`

**Interfaces:**
- Consumes: `createClient` (browser) for login; `createClient` (server) for the callback.
- Produces: a logged-in session; converts matching `pending` invites into memberships on login.

- [ ] **Step 1: Login page** — `app/login/page.tsx` (Client Component; mirror the "midnight" theme tokens used elsewhere)

```tsx
"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const supabase = createClient();
  const redirectTo = typeof window !== "undefined" ? `${location.origin}/auth/callback` : undefined;

  async function google() {
    await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
  }
  async function magicLink(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
    if (!error) setSent(true);
  }

  return (
    <main className="min-h-screen grid place-items-center bg-black text-white p-6">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-2xl font-semibold">เข้าสู่ระบบ FITT Builder</h1>
        <button onClick={google} className="w-full rounded-lg border border-white/15 py-2.5 hover:bg-white/5">
          เข้าสู่ระบบด้วย Google
        </button>
        {sent ? (
          <p className="text-sm text-white/70">ส่งลิงก์เข้าสู่ระบบไปที่ {email} แล้ว เช็คอีเมลได้เลย</p>
        ) : (
          <form onSubmit={magicLink} className="space-y-3">
            <input
              type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              className="w-full rounded-lg bg-white/5 border border-white/15 px-3 py-2.5 outline-none focus:border-[#64cefb]"
            />
            <button className="w-full rounded-lg bg-[#64cefb] text-black font-medium py-2.5">
              ส่งลิงก์เข้าสู่ระบบ (magic link)
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Auth callback** — `app/auth/callback/route.ts`

```ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) await resolvePendingInvites(supabase, user.id, user.email);
      return NextResponse.redirect(`${origin}${next}`);
    }
  }
  return NextResponse.redirect(`${origin}/login`);
}

// Convert any pending invites for this email into memberships.
async function resolvePendingInvites(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  email: string
) {
  const { data: invites } = await supabase
    .from("fittbuilder_project_invites")
    .select("id, project_id, role")
    .eq("status", "pending")
    .ilike("email", email);
  for (const inv of invites ?? []) {
    await supabase.from("fittbuilder_project_members").upsert(
      { project_id: inv.project_id, user_id: userId, role: inv.role },
      { onConflict: "project_id,user_id" }
    );
    await supabase.from("fittbuilder_project_invites").update({ status: "accepted" }).eq("id", inv.id);
  }
}
```

> Note: invite rows are inserted by the owner (Task 10); their RLS lets only the owner read/update them. Resolution here updates `status` — since the invitee is not the owner, perform the membership upsert + status update in a `SECURITY DEFINER` RPC if RLS blocks it. If the update is blocked, add this RPC to the migration and call it instead:
> ```sql
> create function fittbuilder_accept_invites(uid uuid, mail text) returns void
>   language sql security definer set search_path = public as $$
>     insert into fittbuilder_project_members (project_id, user_id, role)
>       select project_id, uid, role from fittbuilder_project_invites
>       where status = 'pending' and lower(email) = lower(mail)
>     on conflict (project_id, user_id) do nothing;
>     update fittbuilder_project_invites set status = 'accepted'
>       where status = 'pending' and lower(email) = lower(mail);
>   $$;
> ```
> Then the callback calls `await supabase.rpc("fittbuilder_accept_invites", { uid: user.id, mail: user.email })`. Prefer the RPC (it is the correct, RLS-safe path); add it to `supabase/migrations/0001_init.sql` and re-apply.

- [ ] **Step 3: Typecheck + manual login**

Run: `npx tsc --noEmit` (clean). Then `npm run dev`: log in with Google and with magic link; confirm redirect to `/` and a `fittbuilder_profiles` row exists.

- [ ] **Step 4: Commit**

```bash
git add app/login app/auth supabase/migrations/0001_init.sql
git commit -m "feat(auth): login page + callback with pending-invite resolution"
```

---

## Task 6: Types + row↔record mapper (pure, unit-tested)

**Files:**
- Modify: `lib/types.ts`
- Create: `lib/db/project-mapper.ts`
- Create: `lib/db/__tests__/project-mapper.test.ts`

**Interfaces:**
- Produces:
  - `type ShareRole = "viewer" | "editor"`
  - `interface ProjectMember { projectId: string; userId: string; email: string; name: string | null; role: ShareRole; createdAt: string }`
  - `interface ProjectInvite { id: string; projectId: string; email: string; role: ShareRole; token: string; status: "pending" | "accepted" | "revoked"; expiresAt: string; createdAt: string }`
  - `ProjectSummary` gains `access: "owner" | "member"` and `role?: ShareRole`
  - `rowToProject(row): ProjectRecord` and `projectToRow(rec, ownerId): ProjectInsertRow`

- [ ] **Step 1: Extend `lib/types.ts`**

Add to `lib/types.ts`:
```ts
export type ShareRole = "viewer" | "editor";

export interface ProjectMember {
  projectId: string;
  userId: string;
  email: string;
  name: string | null;
  role: ShareRole;
  createdAt: string;
}

export interface ProjectInvite {
  id: string;
  projectId: string;
  email: string;
  role: ShareRole;
  token: string;
  status: "pending" | "accepted" | "revoked";
  expiresAt: string;
  createdAt: string;
}
```
And change `ProjectSummary` to:
```ts
export interface ProjectSummary {
  id: string;
  name: string;
  fileCount: number;
  createdAt: string;
  updatedAt: string;
  access: "owner" | "member";
  role?: ShareRole;
}
```

- [ ] **Step 2: Write the failing mapper test** — `lib/db/__tests__/project-mapper.test.ts`

```ts
import { expect, test } from "vitest";
import { projectToRow, rowToProject } from "@/lib/db/project-mapper";
import type { ProjectRecord } from "@/lib/types";

const rec: ProjectRecord = {
  id: "11111111-1111-1111-1111-111111111111",
  name: "Demo",
  files: { "src/App.tsx": "x" },
  phase: "build",
  approvedPhases: ["define", "plan"],
  history: [{ "src/App.tsx": "old" }],
  messages: [{ id: "m1", role: "user", content: "hi", createdAt: "2026-01-01T00:00:00.000Z" }],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
};

test("rowToProject reverses projectToRow", () => {
  const row = projectToRow(rec, "owner-1");
  const back = rowToProject({
    ...row,
    id: rec.id,
    owner_id: "owner-1",
    created_at: rec.createdAt,
    updated_at: rec.updatedAt,
    share_token: null,
    share_role: null,
  });
  expect(back).toEqual(rec);
});

test("null files round-trips", () => {
  const row = projectToRow({ ...rec, files: null, history: [], approvedPhases: [] }, "o");
  expect(row.files).toBeNull();
  expect(row.history).toEqual([]);
});
```

- [ ] **Step 3: Run it (fails — module missing)**

Run: `npx vitest run lib/db/__tests__/project-mapper.test.ts`
Expected: FAIL (cannot find `project-mapper`).

- [ ] **Step 4: Implement** — `lib/db/project-mapper.ts`

```ts
import type { PhaseId } from "@/lib/phases";
import type { ChatMessage, ProjectFiles, ProjectRecord } from "@/lib/types";

export interface ProjectRow {
  id: string;
  owner_id: string;
  name: string;
  files: ProjectFiles | null;
  phase: string;
  approved_phases: PhaseId[];
  history: ProjectFiles[];
  messages: ChatMessage[];
  share_token: string | null;
  share_role: "viewer" | "editor" | null;
  created_at: string;
  updated_at: string;
}

/** Columns we write on insert/update (owner-managed; id/timestamps are DB-managed). */
export interface ProjectInsertRow {
  owner_id: string;
  name: string;
  files: ProjectFiles | null;
  phase: string;
  approved_phases: PhaseId[];
  history: ProjectFiles[];
  messages: ChatMessage[];
}

export function rowToProject(row: ProjectRow): ProjectRecord {
  return {
    id: row.id,
    name: row.name,
    files: row.files,
    phase: row.phase as PhaseId,
    approvedPhases: row.approved_phases ?? [],
    history: row.history ?? [],
    messages: row.messages ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function projectToRow(rec: ProjectRecord, ownerId: string): ProjectInsertRow {
  return {
    owner_id: ownerId,
    name: rec.name,
    files: rec.files,
    phase: rec.phase,
    approved_phases: rec.approvedPhases ?? [],
    history: rec.history,
    messages: rec.messages,
  };
}
```

- [ ] **Step 5: Run tests (pass)**

Run: `npx vitest run lib/db/__tests__/project-mapper.test.ts`
Expected: 2 passed.

- [ ] **Step 6: Commit**

```bash
git add lib/types.ts lib/db/project-mapper.ts lib/db/__tests__/project-mapper.test.ts
git commit -m "feat(db): project row<->record mapper + sharing types"
```

---

## Task 7: Async storage layer

**Files:**
- Modify: `lib/storage.ts` (full rewrite of persistence functions; keep pure helpers)

**Interfaces:**
- Consumes: `createClient` (browser) from `lib/supabase/client.ts`; mapper from Task 6.
- Produces (all async now):
  - `getProject(id: string): Promise<ProjectRecord | null>`
  - `saveProject(project: ProjectRecord): Promise<ProjectRecord>`
  - `createProject(opts?): Promise<ProjectRecord>`
  - `deleteProject(id: string): Promise<void>`
  - `duplicateProject(id: string): Promise<ProjectRecord | null>`
  - `listProjects(): Promise<ProjectSummary[]>`
  - unchanged pure: `withHistory`, `undo`, `appendMessage`, `newMessage`

- [ ] **Step 1: Rewrite `lib/storage.ts`**

```ts
"use client";

import { createClient } from "@/lib/supabase/client";
import { projectToRow, rowToProject, type ProjectRow } from "@/lib/db/project-mapper";
import type { PhaseId } from "./phases";
import type { ChatMessage, ProjectFiles, ProjectRecord, ProjectSummary, ShareRole } from "./types";

const HISTORY_LIMIT = 10; // US-004

const SELECT = "id, owner_id, name, files, phase, approved_phases, history, messages, share_token, share_role, created_at, updated_at";

async function uid(): Promise<string> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");
  return user.id;
}

export async function getProject(id: string): Promise<ProjectRecord | null> {
  const supabase = createClient();
  const { data, error } = await supabase.from("fittbuilder_projects").select(SELECT).eq("id", id).maybeSingle();
  if (error || !data) return null;
  return rowToProject(data as ProjectRow);
}

export async function saveProject(project: ProjectRecord): Promise<ProjectRecord> {
  const supabase = createClient();
  const ownerId = await uid();
  const row = { id: project.id, ...projectToRow(project, ownerId) };
  const { data, error } = await supabase.from("fittbuilder_projects").upsert(row).select(SELECT).single();
  if (error) throw error;
  return rowToProject(data as ProjectRow);
}

export async function createProject(options?: {
  name?: string;
  pendingPrompt?: string;
  pendingSpec?: boolean;
  phase?: PhaseId;
}): Promise<ProjectRecord> {
  const supabase = createClient();
  const ownerId = await uid();
  const { data, error } = await supabase
    .from("fittbuilder_projects")
    .insert({ owner_id: ownerId, name: options?.name?.trim() || "Untitled", phase: options?.phase ?? "define" })
    .select(SELECT)
    .single();
  if (error) throw error;
  const rec = rowToProject(data as ProjectRow);
  return { ...rec, pendingPrompt: options?.pendingPrompt, pendingSpec: options?.pendingSpec };
}

export async function deleteProject(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("fittbuilder_projects").delete().eq("id", id);
  if (error) throw error;
}

export async function duplicateProject(id: string): Promise<ProjectRecord | null> {
  const source = await getProject(id);
  if (!source) return null;
  return saveProjectAsNew({ ...source, name: `${source.name} (copy)` });
}

async function saveProjectAsNew(rec: ProjectRecord): Promise<ProjectRecord> {
  const supabase = createClient();
  const ownerId = await uid();
  const { data, error } = await supabase
    .from("fittbuilder_projects")
    .insert(projectToRow(rec, ownerId))
    .select(SELECT)
    .single();
  if (error) throw error;
  return rowToProject(data as ProjectRow);
}

export async function listProjects(): Promise<ProjectSummary[]> {
  const supabase = createClient();
  const me = await uid();
  // RLS returns owned + shared rows; classify by owner_id, attach role from memberships.
  const { data: rows } = await supabase
    .from("fittbuilder_projects")
    .select("id, owner_id, name, files, created_at, updated_at")
    .order("updated_at", { ascending: false });
  const { data: memberships } = await supabase
    .from("fittbuilder_project_members")
    .select("project_id, role")
    .eq("user_id", me);
  const roleByProject = new Map<string, ShareRole>((memberships ?? []).map((m) => [m.project_id, m.role as ShareRole]));
  return (rows ?? []).map((r) => {
    const owner = r.owner_id === me;
    return {
      id: r.id,
      name: r.name,
      fileCount: r.files ? Object.keys(r.files as ProjectFiles).length : 0,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      access: owner ? "owner" : "member",
      role: owner ? undefined : roleByProject.get(r.id),
    } satisfies ProjectSummary;
  });
}

/* ---------- pure helpers (unchanged behaviour) ---------- */

export function withHistory(project: ProjectRecord, nextFiles: ProjectFiles): ProjectRecord {
  const history = project.files
    ? [...project.history, project.files].slice(-HISTORY_LIMIT)
    : project.history;
  return { ...project, history, files: nextFiles };
}

export function undo(project: ProjectRecord): ProjectRecord | null {
  if (project.history.length === 0) return null;
  const history = [...project.history];
  const files = history.pop()!;
  return { ...project, files, history };
}

export function appendMessage(project: ProjectRecord, message: ChatMessage): ProjectRecord {
  return { ...project, messages: [...project.messages, message] };
}

export function newMessage(role: ChatMessage["role"], content: string, phase?: PhaseId): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    createdAt: new Date().toISOString(),
    ...(phase ? { phase } : {}),
  };
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: errors only at the now-async call sites in `Studio.tsx`, `LaunchPad.tsx`, `ProjectGrid.tsx` (fixed in Tasks 8–9). The `lib/storage.ts` file itself is clean.

- [ ] **Step 3: Commit**

```bash
git add lib/storage.ts
git commit -m "feat(storage): async supabase persistence replacing localStorage"
```

---

## Task 8: Studio async load/save + role-gating

**Files:**
- Modify: `components/studio/Studio.tsx`

**Interfaces:**
- Consumes: async `getProject`/`saveProject`; `ProjectRecord`.
- Produces: studio loads a cloud project asynchronously, debounce-saves, and gates editing for `viewer` access.

- [ ] **Step 1: Make `persist` update state synchronously + debounce the cloud save**

Replace the `persist` callback (around `Studio.tsx:149`) with a version that bumps `updatedAt` locally (so chained `working = persist(...)` keeps working synchronously) and schedules a debounced save. Add a `saveState` indicator and a debounce ref near the other refs:

```tsx
// near the other useRef/useState declarations
const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");

const persist = useCallback((next: ProjectRecord) => {
  const local = { ...next, updatedAt: new Date().toISOString() };
  projectRef.current = local;     // synchronous for chained calls
  setProject(local);
  if (saveTimer.current) clearTimeout(saveTimer.current);
  setSaveState("saving");
  saveTimer.current = setTimeout(() => {
    saveProject(local)
      .then(() => setSaveState("saved"))
      .catch((e) => {
        console.error("[studio] save failed:", e);
        setSaveState("idle");
      });
  }, 800);
  return local;
}, []);
```

- [ ] **Step 2: Make the project-load effect async**

The load (around `Studio.tsx:709`) currently does `const loaded = getProject(projectId)`. Wrap it so it awaits and shows a loading state. Inside the loading `useEffect`:

```tsx
let cancelled = false;
(async () => {
  const loaded = await getProject(projectId);
  if (cancelled) return;
  if (!loaded) { setNotFound(true); return; }
  projectRef.current = loaded;
  setProject(loaded);
  // ...existing post-load logic (boot preview, consume pendingPrompt) stays,
  // moved inside this async block.
})();
return () => { cancelled = true; };
```
Add `const [notFound, setNotFound] = useState(false);` and render a "ไม่พบโปรเจกต์ หรือคุณไม่มีสิทธิ์เข้าถึง" notice when `notFound`. Keep a `project == null` → loading spinner branch.

- [ ] **Step 3: Resolve the line-726 save**

The `saveProject({...})` call clearing pending state at ~726 must be awaited or routed through `persist`. Replace the direct `saveProject(...)` with `persist({ ...cleared })` (debounced) since it is a state mutation, OR `void saveProject(...)` if it must not touch render state. Pick `persist` for consistency.

- [ ] **Step 4: Role-gating**

Determine the caller's access for this project and disable mutating UI for viewers. Compute once after load:
```tsx
const supabase = createClient();
const { data: { user } } = await supabase.auth.getUser();
const owner = loaded ? user?.id === /* loaded.ownerId — see note */ : false;
```
> Note: `rowToProject` currently drops `owner_id`. Add `ownerId: string` to `ProjectRecord` (optional, `ownerId?: string`) and set it in `rowToProject`, OR fetch the membership role via `listProjects()`/a dedicated `getAccess(id)` helper in `lib/storage.ts`:
> ```ts
> export async function getAccess(id: string): Promise<{ access: "owner" | "member"; role?: ShareRole } | null> {
>   const me = await uid();
>   const supabase = createClient();
>   const { data: p } = await supabase.from("fittbuilder_projects").select("owner_id").eq("id", id).maybeSingle();
>   if (!p) return null;
>   if (p.owner_id === me) return { access: "owner" };
>   const { data: m } = await supabase.from("fittbuilder_project_members").select("role").eq("project_id", id).eq("user_id", me).maybeSingle();
>   return { access: "member", role: m?.role as ShareRole | undefined };
> }
> ```
> Use `getAccess(projectId)` in the load effect; store `const [readOnly, setReadOnly] = useState(false)` = `access.role === "viewer"`. Add `getAccess` to Task 7's storage file (note it here so the reviewer expects it).

Disable the chat input / build / undo / Monaco edit handlers when `readOnly` is true, and show a "อ่านอย่างเดียว (viewer)" badge.

- [ ] **Step 5: Typecheck + build + manual**

Run: `npx tsc --noEmit` and `npm run build` (clean). Manual: load a project (spinner → loads), make a change (indicator → "saving" → "saved"; reload shows persistence), open as a viewer (UI read-only).

- [ ] **Step 6: Commit**

```bash
git add components/studio/Studio.tsx lib/storage.ts lib/db/project-mapper.ts lib/types.ts
git commit -m "feat(studio): async cloud load/save + viewer read-only gating"
```

---

## Task 9: LaunchPad + ProjectGrid async

**Files:**
- Modify: `components/landing/LaunchPad.tsx`
- Modify: `components/projects/ProjectGrid.tsx`

**Interfaces:**
- Consumes: async `createProject`, `listProjects`, `deleteProject`, `duplicateProject`.

- [ ] **Step 1: `await` the three `createProject` calls in `LaunchPad.tsx`**

The handlers at lines 27, 38, 46 currently do `const project = createProject({...})`. Make each handler `async` and `await`:
```tsx
const project = await createProject({ /* …same options… */ });
router.push(`/project/${project.id}`); // existing navigation, unchanged
```
Add a simple submitting state to prevent double-submit (disable the button while awaiting).

- [ ] **Step 2: `ProjectGrid.tsx` async refresh + owned/shared split**

Replace the sync `refresh` (line 24) with:
```tsx
const [loading, setLoading] = useState(true);
const refresh = useCallback(async () => {
  setLoading(true);
  setProjects(await listProjects());
  setLoading(false);
}, []);
useEffect(() => { void refresh(); }, [refresh]);
```
Make the duplicate/delete handlers `await ...` then `await refresh()`. Split rendering into two sections using the new `access` field:
```tsx
const owned = projects.filter((p) => p.access === "owner");
const shared = projects.filter((p) => p.access === "member");
```
Render "ของฉัน" (owned) and, when `shared.length`, a "แชร์กับฉัน" section showing each item's `role` badge. Show a loading state while `loading`.

- [ ] **Step 3: Typecheck + build + manual**

Run: `npx tsc --noEmit` and `npm run build` (clean). Manual: create a project from each LaunchPad entry; the projects page lists owned and (after Task 10) shared.

- [ ] **Step 4: Commit**

```bash
git add components/landing/LaunchPad.tsx components/projects/ProjectGrid.tsx
git commit -m "feat(ui): async project create + owned/shared lists"
```

---

## Task 10: Sharing backend — link, members, invites, join route

**Files:**
- Create: `lib/sharing.ts`
- Create: `app/join/[token]/route.ts`
- Modify: `supabase/migrations/0001_init.sql` (add `fittbuilder_join_by_token` RPC)

**Interfaces:**
- Consumes: `createClient` (browser + server), `ShareRole`, `ProjectMember`, `ProjectInvite`.
- Produces:
  - `setShareLink(projectId: string, role: ShareRole): Promise<string>` (returns token)
  - `disableShareLink(projectId: string): Promise<void>`
  - `getShareToken(projectId: string): Promise<{ token: string; role: ShareRole } | null>`
  - `listMembers(projectId: string): Promise<ProjectMember[]>`
  - `removeMember(projectId: string, userId: string): Promise<void>`
  - `listInvites(projectId: string): Promise<ProjectInvite[]>`
  - `createInvite(projectId: string, email: string, role: ShareRole, senderName: string, projectName: string): Promise<ProjectInvite>`
  - `revokeInvite(inviteId: string): Promise<void>`

- [ ] **Step 1: Add the join RPC to the migration and re-apply**

```sql
-- Adds the caller as a member using a project's share link token.
create function fittbuilder_join_by_token(tok text, uid uuid) returns uuid
  language plpgsql security definer set search_path = public as $$
declare pid uuid; r text;
begin
  select id, share_role into pid, r from fittbuilder_projects where share_token = tok;
  if pid is null or r is null then return null; end if;
  insert into fittbuilder_project_members (project_id, user_id, role)
    values (pid, uid, r) on conflict (project_id, user_id) do nothing;
  return pid;
end; $$;
```
Re-apply the migration. Expected: function created.

- [ ] **Step 2: `lib/sharing.ts`**

```ts
"use client";

import { createClient } from "@/lib/supabase/client";
import { sendProjectInviteEmail } from "@/lib/email";
import type { ProjectInvite, ProjectMember, ShareRole } from "@/lib/types";

function token(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

export async function setShareLink(projectId: string, role: ShareRole): Promise<string> {
  const supabase = createClient();
  const tok = token();
  const { error } = await supabase
    .from("fittbuilder_projects")
    .update({ share_token: tok, share_role: role })
    .eq("id", projectId);
  if (error) throw error;
  return tok;
}

export async function disableShareLink(projectId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("fittbuilder_projects")
    .update({ share_token: null, share_role: null })
    .eq("id", projectId);
  if (error) throw error;
}

export async function getShareToken(projectId: string): Promise<{ token: string; role: ShareRole } | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("fittbuilder_projects")
    .select("share_token, share_role")
    .eq("id", projectId)
    .maybeSingle();
  if (!data?.share_token || !data.share_role) return null;
  return { token: data.share_token, role: data.share_role as ShareRole };
}

export async function listMembers(projectId: string): Promise<ProjectMember[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("fittbuilder_project_members")
    .select("project_id, user_id, role, created_at, fittbuilder_profiles(email, name)")
    .eq("project_id", projectId);
  return (data ?? []).map((m) => {
    const profile = m.fittbuilder_profiles as { email: string; name: string | null } | null;
    return {
      projectId: m.project_id,
      userId: m.user_id,
      email: profile?.email ?? "",
      name: profile?.name ?? null,
      role: m.role as ShareRole,
      createdAt: m.created_at,
    };
  });
}

export async function removeMember(projectId: string, userId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("fittbuilder_project_members")
    .delete()
    .eq("project_id", projectId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function listInvites(projectId: string): Promise<ProjectInvite[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("fittbuilder_project_invites")
    .select("*")
    .eq("project_id", projectId)
    .eq("status", "pending");
  return (data ?? []).map((i) => ({
    id: i.id, projectId: i.project_id, email: i.email, role: i.role as ShareRole,
    token: i.token, status: i.status as ProjectInvite["status"],
    expiresAt: i.expires_at, createdAt: i.created_at,
  }));
}

export async function createInvite(
  projectId: string, email: string, role: ShareRole, senderName: string, projectName: string
): Promise<ProjectInvite> {
  const supabase = createClient();
  const tok = token();
  const { data, error } = await supabase
    .from("fittbuilder_project_invites")
    .insert({ project_id: projectId, email: email.toLowerCase(), role, token: tok })
    .select("*")
    .single();
  if (error) throw error;
  const inviteLink = `${location.origin}/join/${tok}`;
  // best-effort email; failure must not break the invite
  void sendProjectInviteEmail({ to: email, projectName, role, inviteLink, senderName }).catch((e) =>
    console.error("[sharing] invite email failed:", e)
  );
  return {
    id: data.id, projectId: data.project_id, email: data.email, role: data.role as ShareRole,
    token: data.token, status: data.status as ProjectInvite["status"],
    expiresAt: data.expires_at, createdAt: data.created_at,
  };
}

export async function revokeInvite(inviteId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("fittbuilder_project_invites")
    .update({ status: "revoked" })
    .eq("id", inviteId);
  if (error) throw error;
}
```

- [ ] **Step 3: Join route** — `app/join/[token]/route.ts` (Next 16 async params)

```ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const { origin } = new URL(request.url);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login?next=/join/${token}`);

  const { data: pid } = await supabase.rpc("fittbuilder_join_by_token", { tok: token, uid: user.id });
  if (!pid) return NextResponse.redirect(`${origin}/?joinError=1`);
  return NextResponse.redirect(`${origin}/project/${pid}`);
}
```

- [ ] **Step 4: Typecheck + manual RLS/share check**

Run: `npx tsc --noEmit` (clean). Manual: owner sets a share link → second account opens `/join/<token>` → becomes a member → project appears under "แชร์กับฉัน" with the right role; viewer is read-only, editor can edit.

- [ ] **Step 5: Commit**

```bash
git add lib/sharing.ts app/join supabase/migrations/0001_init.sql
git commit -m "feat(sharing): share link, members, invites, join-by-token"
```

---

## Task 11: DMAIL invite email (pure payload unit-tested)

**Files:**
- Create: `lib/email.ts`
- Create: `lib/__tests__/email.test.ts`

**Interfaces:**
- Produces:
  - `buildInvitePayload(args: InviteEmailArgs): DmailPayload` (pure)
  - `sendProjectInviteEmail(args: InviteEmailArgs): Promise<{ success: boolean }>`
  - `interface InviteEmailArgs { to: string; projectName: string; role: ShareRole; inviteLink: string; senderName: string }`

- [ ] **Step 1: Write the failing payload test** — `lib/__tests__/email.test.ts`

```ts
import { expect, test } from "vitest";
import { buildInvitePayload } from "@/lib/email";

test("maps role and project into DMAIL variables", () => {
  const p = buildInvitePayload({
    to: "a@b.com", projectName: "Shop Demo", role: "editor",
    inviteLink: "https://app/join/x", senderName: "Watt",
  });
  expect(p.templateId).toBe("4b72b137-4124-4b4a-982b-a7b38d723547");
  expect(p.to).toEqual([{ email: "a@b.com", name: "a@b.com" }]);
  expect(p.variables.companyName).toBe("Shop Demo");
  expect(p.variables.roleText).toBe("Editor");
  expect(p.variables.branchName).toBe("-");
  expect(p.variables.invitationLink).toBe("https://app/join/x");
  expect(buildInvitePayload({ to: "a@b.com", projectName: "X", role: "viewer", inviteLink: "l", senderName: "s" }).variables.roleText).toBe("Viewer");
});
```

- [ ] **Step 2: Run it (fails)**

Run: `npx vitest run lib/__tests__/email.test.ts`
Expected: FAIL (no module).

- [ ] **Step 3: Implement** — `lib/email.ts`

```ts
import type { ShareRole } from "@/lib/types";

const DMAIL_API_URL =
  "https://dmailservicebackend-sandbox-1095128507689.asia-southeast1.run.app/api/v1/mail/send";
const INVITATION_TEMPLATE_ID = "4b72b137-4124-4b4a-982b-a7b38d723547";

export interface InviteEmailArgs {
  to: string;
  projectName: string;
  role: ShareRole;
  inviteLink: string;
  senderName: string;
}

export interface DmailPayload {
  templateId: string;
  to: { email: string; name: string }[];
  subject: string;
  variables: Record<string, string>;
}

export function buildInvitePayload(args: InviteEmailArgs): DmailPayload {
  const roleText = args.role === "editor" ? "Editor" : "Viewer";
  return {
    templateId: INVITATION_TEMPLATE_ID,
    to: [{ email: args.to, name: args.to }],
    subject: `คำเชิญร่วมโปรเจกต์ ${args.projectName} — FITT Builder`,
    variables: {
      name: args.to,
      companyName: args.projectName,
      branchName: "-",
      roleText,
      invitationLink: args.inviteLink,
      senderName: args.senderName,
      year: new Date().getFullYear().toString(),
    },
  };
}

export async function sendProjectInviteEmail(args: InviteEmailArgs): Promise<{ success: boolean }> {
  const apiKey = process.env.DMAIL_API_KEY;
  if (!apiKey) {
    console.error("[email] DMAIL_API_KEY not set — skipping invite email");
    return { success: false };
  }
  const res = await fetch(DMAIL_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
    body: JSON.stringify(buildInvitePayload(args)),
  });
  if (!res.ok) throw new Error(`DMAIL error ${res.status}: ${await res.text()}`);
  return { success: true };
}
```

> Note: `process.env.DMAIL_API_KEY` is server-only. `createInvite` in `lib/sharing.ts` is a Client Component module, so the invite email must be sent from the server. **Adjust Task 10**: instead of calling `sendProjectInviteEmail` from the browser, `createInvite` should POST to a new route `app/api/invite-email/route.ts` that runs `sendProjectInviteEmail` server-side (validating the caller owns the project). If the reviewer flags this cross-task seam, that route is the fix — keep `lib/email.ts` server-imported only.

- [ ] **Step 4: Create the server route** — `app/api/invite-email/route.ts`

```ts
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { sendProjectInviteEmail } from "@/lib/email";

const schema = z.object({
  to: z.string().email(),
  projectName: z.string().max(200),
  role: z.enum(["viewer", "editor"]),
  inviteLink: z.string().url(),
  senderName: z.string().max(200),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  let body: z.infer<typeof schema>;
  try { body = schema.parse(await request.json()); }
  catch { return Response.json({ error: "bad request" }, { status: 400 }); }
  try {
    const r = await sendProjectInviteEmail(body);
    return Response.json(r);
  } catch (e) {
    console.error("[invite-email] failed:", e);
    return Response.json({ success: false }, { status: 200 }); // best-effort
  }
}
```
Then in `lib/sharing.ts` `createInvite`, replace the direct `sendProjectInviteEmail(...)` call with:
```ts
void fetch("/api/invite-email", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ to: email, projectName, role, inviteLink, senderName }),
}).catch((e) => console.error("[sharing] invite email failed:", e));
```
and remove the `sendProjectInviteEmail` import from `lib/sharing.ts`.

- [ ] **Step 5: Run tests + typecheck**

Run: `npx vitest run lib/__tests__/email.test.ts` (2 passed) and `npx tsc --noEmit` (clean).

- [ ] **Step 6: Commit**

```bash
git add lib/email.ts lib/__tests__/email.test.ts app/api/invite-email lib/sharing.ts
git commit -m "feat(email): DMAIL invite email via server route"
```

---

## Task 12: ShareModal UI

**Files:**
- Create: `components/studio/ShareModal.tsx`
- Modify: `components/studio/Studio.tsx` (open the modal; owner only)

**Interfaces:**
- Consumes: all of `lib/sharing.ts`.

- [ ] **Step 1: Build `ShareModal.tsx`**

A modal (mirror the structure/animation of the existing `DiffViewer.tsx` modal and the midnight theme) with three sections:
1. **Public link** — a `ShareRole` toggle (viewer/editor) + "สร้างลิงก์" → `setShareLink`, shows the resulting `${origin}/join/${token}` with a copy button; "ปิดลิงก์" → `disableShareLink`. Initialize from `getShareToken`.
2. **Invite by email** — email input + role select → `createInvite(projectId, email, role, senderName, projectName)`; on success refresh the invite list. `senderName` = current user's name/email (from `createClient().auth.getUser()`).
3. **People** — `listMembers` (email + role + remove button → `removeMember`) and pending `listInvites` (email + "revoke" → `revokeInvite`).

Props: `{ projectId: string; projectName: string; onClose: () => void }`. Use `lucide-react` icons (Link, Mail, Users, X, Copy, Trash2) — no emoji.

- [ ] **Step 2: Wire into Studio**

Add a "แชร์" button to the studio top bar that opens `<ShareModal>` — render the button **only when the caller is the owner** (`access === "owner"` from Task 8's `getAccess`). Pass `projectId` and `project.name`.

- [ ] **Step 3: Typecheck + build + manual**

Run: `npx tsc --noEmit` and `npm run build` (clean). Manual: owner opens Share, creates a link, invites an email (check the invite row + email), removes a member.

- [ ] **Step 4: Commit**

```bash
git add components/studio/ShareModal.tsx components/studio/Studio.tsx
git commit -m "feat(sharing): ShareModal UI (link + email invite + people)"
```

---

## Task 13: Changelog page + "What's new" badge

**Files:**
- Create: `lib/changelog.ts`
- Create: `lib/__tests__/changelog.test.ts`
- Create: `app/changelog/page.tsx`
- Modify: a shared nav/top-bar component to show the badge + mark-seen

**Interfaces:**
- Produces:
  - `interface ChangelogEntry { version: string; date: string; title: string; body: string }`
  - `CHANGELOG: ChangelogEntry[]` (newest first)
  - `latestVersion(): string`
  - `isChangelogUnseen(lastSeen: string | null): boolean`

- [ ] **Step 1: Write the failing helper test** — `lib/__tests__/changelog.test.ts`

```ts
import { expect, test } from "vitest";
import { CHANGELOG, isChangelogUnseen, latestVersion } from "@/lib/changelog";

test("latestVersion is the first entry's version", () => {
  expect(latestVersion()).toBe(CHANGELOG[0].version);
});
test("unseen when lastSeen differs or is null", () => {
  expect(isChangelogUnseen(null)).toBe(true);
  expect(isChangelogUnseen("0.0.0-old")).toBe(true);
  expect(isChangelogUnseen(CHANGELOG[0].version)).toBe(false);
});
```

- [ ] **Step 2: Run it (fails)**

Run: `npx vitest run lib/__tests__/changelog.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement** — `lib/changelog.ts`

```ts
export interface ChangelogEntry {
  version: string;
  date: string;   // YYYY-MM-DD
  title: string;
  body: string;   // markdown
}

// Newest first.
export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "2026.06.22",
    date: "2026-06-22",
    title: "บัญชีผู้ใช้ + เก็บงานบนคลาวด์ + แชร์ทีม",
    body: [
      "- เข้าสู่ระบบด้วย Google หรือ magic link",
      "- โปรเจกต์เก็บบนคลาวด์ เปิดข้ามเครื่องได้",
      "- แชร์โปรเจกต์ให้ทีมด้วยลิงก์หรืออีเมล (viewer/editor)",
    ].join("\n"),
  },
];

export function latestVersion(): string {
  return CHANGELOG[0].version;
}

export function isChangelogUnseen(lastSeen: string | null): boolean {
  return lastSeen !== latestVersion();
}
```

- [ ] **Step 4: Run tests (pass)**

Run: `npx vitest run lib/__tests__/changelog.test.ts`
Expected: 2 passed.

- [ ] **Step 5: Changelog page** — `app/changelog/page.tsx` (Client Component; marks seen on mount)

```tsx
"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { CHANGELOG, latestVersion } from "@/lib/changelog";
import Markdown from "@/components/studio/Markdown";

export default function ChangelogPage() {
  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from("fittbuilder_profiles")
          .update({ last_seen_changelog: latestVersion() })
          .eq("id", user.id);
      }
    })();
  }, []);

  return (
    <main className="min-h-screen bg-black text-white px-6 py-12">
      <div className="mx-auto max-w-2xl space-y-10">
        <h1 className="text-3xl font-semibold">มีอะไรใหม่</h1>
        {CHANGELOG.map((e) => (
          <article key={e.version} className="space-y-2 border-b border-white/10 pb-8">
            <div className="text-sm text-white/50">{e.date} · v{e.version}</div>
            <h2 className="text-xl font-medium">{e.title}</h2>
            <Markdown>{e.body}</Markdown>
          </article>
        ))}
      </div>
    </main>
  );
}
```
> Confirm `components/studio/Markdown.tsx`'s export (default vs named) and props — match its actual signature.

- [ ] **Step 6: Badge**

In the shared top-bar/nav (the component rendered on the projects/studio pages), add a "มีอะไรใหม่" link to `/changelog`. Fetch the profile's `last_seen_changelog` once and show a `#64cefb` dot when `isChangelogUnseen(lastSeen)` is true. Visiting the page clears it (Step 5).

- [ ] **Step 7: Build + manual**

Run: `npm run build` (clean). Manual: badge dot shows for a fresh user; visiting `/changelog` clears it on next load.

- [ ] **Step 8: Commit**

```bash
git add lib/changelog.ts lib/__tests__/changelog.test.ts app/changelog components
git commit -m "feat(changelog): What's new page + unseen badge"
```

---

## Task 14: Docs + final verification

**Files:**
- Modify: `README.md` (production checklist), `.env.example` (already done Task 1 — verify)

- [ ] **Step 1: Update `README.md`**

In the "Production checklist" section, check off Auth, Database, and (partially) sharing; update the Persistence line from "localStorage" to "Supabase (Postgres + RLS)"; add the four new env vars to the Environment table; note Changelog at `/changelog`.

- [ ] **Step 2: Full verification sweep**

Run all and confirm clean:
```bash
npx vitest run        # all unit tests pass
npx tsc --noEmit      # no type errors
npm run lint          # 0 problems
npm run build         # compiles
```

- [ ] **Step 3: Manual acceptance (Chrome/Edge, env set)**

Walk the spec's verification list: forced-login redirect; RLS isolation (A cannot see B); A invites B (editor, email) → B logs in → "แชร์กับฉัน" → B edits; A shares a viewer link → C is read-only; changelog badge shows then clears; confirm DevTools → Application shows **no `pb:` localStorage keys** written.

- [ ] **Step 4: Commit**

```bash
git add README.md .env.example
git commit -m "docs: update checklist + env for supabase auth/storage/sharing"
```

---

## Self-Review notes (planner)

- **Spec coverage:** A(schema/RLS)→T2; B(auth)→T3,T4,T5; C(storage)→T6,T7,T8,T9; D(sharing)→T10,T11,T12; E(changelog)→T13; email/DMAIL→T11; docs/env→T1,T14. All spec sections mapped.
- **Cross-task seams flagged inline:** (1) `ProjectRecord.ownerId`/`getAccess` for role-gating (T8 note, used by T12); (2) DMAIL is server-only → invite email moved to `app/api/invite-email` (T11 note adjusts T10); (3) pending-invite resolution prefers the `fittbuilder_accept_invites` RPC (T5 note, added to T2's migration). The executing controller should treat these notes as binding.
- **Type consistency:** `ShareRole`, `ProjectMember`, `ProjectInvite`, `ProjectSummary.access/role` defined in T6 and used unchanged in T7–T13. Storage signatures in T7 match call sites in T8–T9.
