# Streaming Chat with AI Thinking + Inline Actions — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the FITT Builder chat stream the assistant's reply live into the bubble, show a collapsible "💭 thinking" section (Gemini thought summaries) that auto-collapses when the answer starts, and show inline action chips for what the AI did — across all chat surfaces.

**Architecture:** Server streams typed events (`thought` / `text` / `action` / existing build events). `lib/gemini.ts` exposes `streamParts` that separates Gemini thought parts from answer parts. `/api/agent` runs the answer through a streaming block-filter so ```brd / ```ask never reach the bubble (they become doc actions). The client folds events into a single React-state `live` message (rendered live), committing one persisted `ChatMessage` at done.

**Tech Stack:** Next.js 16 (App Router, SSE over POST), `@google/genai` 2.8 (gemini-2.5-flash thinking), React 19, Tailwind v4, TypeScript strict, lucide-react.

## Global Constraints

- **No unit-test framework** in this repo. Each task's verification cycle is: `npx tsc --noEmit` (clean) + `npm run lint` (0 problems) + `npm run build` (succeeds). Pure-logic modules add a `node --input-type=module -e "…"` smoke check shown in the task. Never add a test runner.
- **Gemini only** via `lib/gemini.ts` (`@google/genai`, model `gemini-2.5-flash`). Thinking = `config.thinkingConfig = { includeThoughts: true }`; a part is a thought iff `part.thought === true`. Thought summaries only (no raw chain-of-thought).
- **Keep the existing 6-phase flow + doc extraction.** `/api/agent` must still return `{ reply, docs, ask }` at done; docs still land in `docs/*.md` via the client. The streaming block-filter only changes HOW the answer streams, not the final turn shape.
- **No raw fenced doc/ask markdown in the chat bubble** — ` ```idea|brd|prd|verify|review|ship ` and ` ```ask ` blocks are filtered to actions; OTHER ``` (ordinary code blocks in prose) pass through as text.
- **localStorage only**, single Vite app, midnight-studio theme (`#64cefb`, Inter/Anuphan). Per-token updates live in React state; localStorage is written once per turn (at done).
- TypeScript strict; path alias `@/*`. Match surrounding code style.

---

### Task 1: Shared types — events, message fields, live-message + action

**Files:**
- Modify: `lib/types.ts`

**Interfaces:**
- Produces: `AgentAction`, `LiveMessage`, updated `AgentEvent`, updated `GenerateEvent`, `ChatMessage.thinking?`, `ChatMessage.actions?`. Every later task consumes these.

- [ ] **Step 1: Add `AgentAction` + `LiveMessage` and extend `ChatMessage`**

In `lib/types.ts`, add near `AgentAsk` / `ChatMessage`:

```ts
/** A compact "what the AI did" chip shown inline in chat. */
export interface AgentAction {
  icon: string;
  label: string;
}

/** The in-progress assistant turn, held in React state (not persisted) while streaming. */
export interface LiveMessage {
  thinking: string;
  content: string;
  actions: AgentAction[];
}
```

And add the two optional fields to `ChatMessage` (keep existing fields):

```ts
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  phase?: PhaseId;
  ask?: AgentAsk;
  /** Gemini thought summary for this assistant turn (collapsible in the UI). */
  thinking?: string;
  /** Inline action chips for what the AI did this turn. */
  actions?: AgentAction[];
}
```

- [ ] **Step 2: Replace `AgentEvent` and extend `GenerateEvent`**

Replace the existing `AgentEvent` union with:

```ts
/** Server-Sent Events emitted by POST /api/agent. */
export type AgentEvent =
  | { type: "thought"; content: string }
  | { type: "text"; content: string }
  | { type: "action"; icon: string; label: string }
  | { type: "done"; turn: AgentTurn }
  | { type: "error"; message: string };
```

Replace the existing `GenerateEvent` union with (drop `delta`, add `thought`):

```ts
/** Server-Sent Events emitted by POST /api/generate (incremental, file-by-file). */
export type GenerateEvent =
  | { type: "thought"; content: string }
  | { type: "status"; message: string }
  | { type: "file"; path: string; content: string }
  | { type: "delete"; path: string }
  | { type: "deps"; packages: string[] }
  | { type: "done"; note: string; deleted: string[] }
  | { type: "error"; message: string };
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: errors ONLY in files that still reference the removed `delta` event (`app/api/generate/route.ts`, `app/api/agent/route.ts`, `components/studio/Studio.tsx`, `components/studio/ChatPanel.tsx`) — those are fixed in later tasks. No errors in `lib/types.ts` itself.

> Note for the controller: Task 1 intentionally leaves consumers broken; do NOT run lint/build as a gate here. The next tasks restore green. Confirm only that `lib/types.ts` has no self-contained type error (e.g. `npx tsc --noEmit 2>&1 | grep 'lib/types.ts'` is empty).

- [ ] **Step 4: Commit**

```bash
git add lib/types.ts
git commit -m "feat(types): event protocol for streaming thoughts/text/actions"
```

---

### Task 2: Gemini `streamParts` (separate thoughts from the answer)

**Files:**
- Modify: `lib/gemini.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `interface StreamPart { thought: boolean; text: string }`, `streamParts(opts): AsyncGenerator<StreamPart>`, and `StreamTextOptions.thinking?: boolean`. `streamText` is re-implemented on top of `streamParts` (answer-only), so its existing callers are unchanged.

- [ ] **Step 1: Add the `thinking` option to `StreamTextOptions`**

In `lib/gemini.ts`, add to the `StreamTextOptions` interface:

```ts
  /** Stream Gemini thought summaries (parts flagged thought:true) too. */
  thinking?: boolean;
```

- [ ] **Step 2: Add `StreamPart` + `streamParts`, and reimplement `streamText`**

Replace the existing `streamText` function with:

```ts
export interface StreamPart {
  thought: boolean;
  text: string;
}

/** Stream model output as typed parts, separating thought summaries from the answer. */
export async function* streamParts(options: StreamTextOptions): AsyncGenerator<StreamPart> {
  const ai = getGeminiClient();
  const stream = await ai.models.generateContentStream({
    model: GEMINI_MODEL,
    contents: options.user,
    config: {
      systemInstruction: options.system,
      temperature: options.temperature ?? 0.7,
      maxOutputTokens: options.maxOutputTokens ?? 65536,
      ...(options.json ? { responseMimeType: "application/json" } : {}),
      ...(options.thinking ? { thinkingConfig: { includeThoughts: true } } : {}),
      ...(options.abortSignal ? { abortSignal: options.abortSignal } : {}),
    },
  });
  for await (const chunk of stream) {
    const parts = chunk.candidates?.[0]?.content?.parts;
    if (!parts) continue;
    for (const part of parts) {
      if (typeof part.text === "string" && part.text.length > 0) {
        yield { thought: part.thought === true, text: part.text };
      }
    }
  }
}

/** Stream model output as text chunks (answer only — thoughts skipped). */
export async function* streamText(options: StreamTextOptions): AsyncGenerator<string> {
  for await (const part of streamParts(options)) {
    if (!part.thought) yield part.text;
  }
}
```

(Leave `generateText` unchanged — it already builds on `streamText`.)

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit 2>&1 | grep 'lib/gemini.ts'`
Expected: empty (no errors in this file). `chunk.candidates?.[0]?.content?.parts` and `part.thought` typecheck against `@google/genai` 2.8.

- [ ] **Step 4: Commit**

```bash
git add lib/gemini.ts
git commit -m "feat(gemini): streamParts separating thought summaries from answer"
```

---

### Task 3: Agent streaming block-filter (`lib/agent-stream.ts`)

**Files:**
- Create: `lib/agent-stream.ts`

**Interfaces:**
- Consumes: `AgentAsk`, `AgentTurn`, `DocKind` from `lib/types`.
- Produces: `class AgentStreamFilter` with `push(chunk: string): { text: string; actions: { icon: string; label: string }[] }` and `getTurn(): AgentTurn`. `/api/agent` (Task 4) feeds it the answer text; it emits clean prose deltas + doc actions and accumulates `{ reply, docs, ask }`.

Behavior: text outside fenced blocks streams out as `text`. A fence whose info line is exactly one of `idea|brd|prd|verify|review|ship|ask` is captured (no raw output); on close, a doc fence produces an `action` (`📄 อัปเดต <LABEL>`) and is stored in `docs`, an `ask` fence is parsed into `ask`. Any OTHER ``` fence (e.g. ```js) is ordinary prose and passes through as `text`. A partial fence at a chunk boundary is held until it completes.

- [ ] **Step 1: Write the module**

```ts
import type { AgentAsk, AgentTurn, DocKind } from "./types";

const DOC_KINDS = ["idea", "brd", "prd", "verify", "review", "ship"] as const;
const DOC_LABELS: Record<DocKind, string> = {
  idea: "IDEA",
  brd: "BRD",
  prd: "PRD",
  verify: "VERIFY",
  review: "REVIEW",
  ship: "SHIP",
};

function isDocKind(value: string): value is DocKind {
  return (DOC_KINDS as readonly string[]).includes(value);
}

/** Parse a ```ask JSON body into a validated AgentAsk (ignored if malformed). */
function parseAsk(json: string): AgentAsk | undefined {
  try {
    const raw = JSON.parse(json) as Record<string, unknown>;
    const options = Array.isArray(raw.options)
      ? raw.options.filter((o): o is string => typeof o === "string" && o.trim().length > 0).slice(0, 6)
      : [];
    if (options.length < 2) return undefined;
    return {
      question: typeof raw.question === "string" ? raw.question : "",
      options,
      multi: raw.multi === true,
      allowText: raw.allowText !== false,
    };
  } catch {
    return undefined;
  }
}

/**
 * Streaming filter for a conversational agent's answer text. Emits clean prose
 * as it arrives and converts completed ```<docKind> / ```ask blocks into actions
 * (so raw markdown never reaches the chat), while accumulating the final turn.
 */
export class AgentStreamFilter {
  private buffer = "";
  private block: DocKind | "ask" | null = null;
  private body = "";
  private reply = "";
  private docs: Partial<Record<DocKind, string>> = {};
  private ask?: AgentAsk;

  push(chunk: string): { text: string; actions: { icon: string; label: string }[] } {
    this.buffer += chunk;
    let text = "";
    const actions: { icon: string; label: string }[] = [];

    for (;;) {
      if (this.block === null) {
        const fence = this.buffer.indexOf("```");
        if (fence === -1) {
          // No fence at all — but keep a tiny tail in case "``" is forming.
          const keep = this.buffer.length >= 2 ? this.buffer.slice(-2) : "";
          const emit = this.buffer.slice(0, this.buffer.length - keep.length);
          text += emit;
          this.reply += emit;
          this.buffer = keep;
          break;
        }
        // Emit text before the fence.
        const before = this.buffer.slice(0, fence);
        text += before;
        this.reply += before;
        const rest = this.buffer.slice(fence); // starts with ```
        const nl = rest.indexOf("\n");
        if (nl === -1) {
          // Info line incomplete — wait for more.
          this.buffer = rest;
          break;
        }
        const info = rest.slice(3, nl).trim();
        if (info === "ask" || isDocKind(info)) {
          this.block = info as DocKind | "ask";
          this.body = "";
          this.buffer = rest.slice(nl + 1);
        } else {
          // Ordinary code fence in prose — pass through as text.
          const line = rest.slice(0, nl + 1);
          text += line;
          this.reply += line;
          this.buffer = rest.slice(nl + 1);
        }
      } else {
        const close = this.buffer.indexOf("\n```");
        if (close === -1) {
          // Accumulate, holding a 4-char tail in case "\n```" straddles chunks.
          const keep = this.buffer.length >= 4 ? this.buffer.slice(-4) : "";
          this.body += this.buffer.slice(0, this.buffer.length - keep.length);
          this.buffer = keep;
          break;
        }
        this.body += this.buffer.slice(0, close);
        // Drop "\n```" plus the rest of that line (and one trailing newline).
        const afterClose = this.buffer.slice(close + 4);
        this.buffer = afterClose.replace(/^[^\n]*\n?/, "");
        if (this.block === "ask") {
          this.ask = this.ask ?? parseAsk(this.body);
        } else {
          this.docs[this.block] = this.body.trim();
          actions.push({ icon: "📄", label: `อัปเดต ${DOC_LABELS[this.block]}` });
        }
        this.block = null;
        this.body = "";
      }
    }

    return { text, actions };
  }

  /** Final turn — call after the stream ends (flushes any held tail). */
  getTurn(): AgentTurn {
    if (this.block === null && this.buffer) {
      this.reply += this.buffer;
      this.buffer = "";
    }
    return {
      reply: this.reply.trim() || "อัปเดตเรียบร้อยแล้วครับ",
      docs: this.docs,
      ...(this.ask ? { ask: this.ask } : {}),
    };
  }
}
```

- [ ] **Step 2: Smoke-check the filter (no framework — run with node)**

Run (from repo root):

```bash
npx tsx -e '
import { AgentStreamFilter } from "./lib/agent-stream.ts";
const f = new AgentStreamFilter();
let text = ""; const acts = [];
const chunks = ["สวัสดีครับ เริ่มเลย\n", "```brd\n# BRD\n", "เนื้อหา\n```\n", "ตรวจดูได้เลย"];
for (const c of chunks) { const o = f.push(c); text += o.text; acts.push(...o.actions); }
const turn = f.getTurn();
console.log(JSON.stringify({ text, acts, reply: turn.reply, hasBrd: !!turn.docs.brd }));
'
```

Expected output (the BRD body must NOT appear in `text`):
`{"text":"สวัสดีครับ เริ่มเลย\nตรวจดูได้เลย","acts":[{"icon":"📄","label":"อัปเดต BRD"}],"reply":"สวัสดีครับ เริ่มเลย\nตรวจดูได้เลย","hasBrd":true}`

(If `tsx` is unavailable, run `npx tsc --noEmit` only and rely on the controller's reviewer to verify logic.)

- [ ] **Step 3: Verify types**

Run: `npx tsc --noEmit 2>&1 | grep 'lib/agent-stream.ts'`
Expected: empty.

- [ ] **Step 4: Commit**

```bash
git add lib/agent-stream.ts
git commit -m "feat(agent): streaming block-filter for live prose + doc actions"
```

---

### Task 4: `/api/agent` — stream thought/text/action

**Files:**
- Modify: `app/api/agent/route.ts`

**Interfaces:**
- Consumes: `streamParts` (Task 2), `AgentStreamFilter` (Task 3), `AgentEvent` (Task 1).
- Produces: SSE stream of `thought` / `text` / `action` / `done` / `error` events.

The body schema, rate limit, build-phase rejection, `getAgentForPhase`, and `buildAgentSystemPrompt` stay. Remove the old `extractTurn` / `DOC_BLOCK` / `ASK_BLOCK` / `DOC_LABELS` (now in the filter).

- [ ] **Step 1: Rewrite the stream body**

Replace the `extractTurn` helper and the `ReadableStream` `start` body. Keep imports for zod, `getAgentForPhase`, `MissingApiKeyError`, `isBuildPhase`/`isPhaseId`, `buildAgentSystemPrompt`, `clientIp`/`rateLimit`, and the body schema. Update the gemini import and types import:

```ts
import { MissingApiKeyError, streamParts } from "@/lib/gemini";
import { AgentStreamFilter } from "@/lib/agent-stream";
import type { AgentEvent } from "@/lib/types";
```

Delete `extractTurn`, `parseAsk`, `DOC_BLOCK`, `ASK_BLOCK`, `DOC_LABELS` (all now live in `lib/agent-stream.ts`). Keep `DOC_KINDS` (used by the body schema's `docs` partialRecord). The stream becomes:

```ts
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: AgentEvent) => controller.enqueue(sse(event));
      const filter = new AgentStreamFilter();
      try {
        for await (const part of streamParts({
          system,
          user,
          temperature: 0.6,
          thinking: true,
          abortSignal: AbortSignal.any([request.signal, AbortSignal.timeout(ATTEMPT_TIMEOUT_MS)]),
        })) {
          if (part.thought) {
            send({ type: "thought", content: part.text });
            continue;
          }
          const { text, actions } = filter.push(part.text);
          if (text) send({ type: "text", content: text });
          for (const a of actions) send({ type: "action", icon: a.icon, label: a.label });
        }
        send({ type: "done", turn: filter.getTurn() });
      } catch (error) {
        const message =
          error instanceof MissingApiKeyError
            ? error.message
            : error instanceof Error && error.name === "TimeoutError"
              ? "AI ใช้เวลานานเกินไป กรุณาลองใหม่"
              : "ตัวแทน AI สะดุด กรุณาส่งข้อความอีกครั้ง";
        console.error("[agent] failed:", error);
        send({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });
```

(`sse` helper stays but its parameter type is now `AgentEvent` — already is.)

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit 2>&1 | grep 'api/agent'`
Expected: empty.

- [ ] **Step 3: Commit**

```bash
git add app/api/agent/route.ts
git commit -m "feat(api/agent): stream thought/text/action events"
```

---

### Task 5: `/api/generate` — add thought streaming, drop delta

**Files:**
- Modify: `app/api/generate/route.ts`

**Interfaces:**
- Consumes: `streamParts` (Task 2), updated `GenerateEvent` (Task 1).

The file-block/`deps`/`delete`/canonical-package.json/vite-config/no-files logic all stay. Only: switch `streamText` → `streamParts`, route thought parts to `thought` events, feed answer parts to the existing `FileStreamParser`, and remove the `delta` send.

- [ ] **Step 1: Swap the import**

```ts
import { MissingApiKeyError, streamParts } from "@/lib/gemini";
```

- [ ] **Step 2: Update the stream loop**

Replace the `for await (const chunk of streamText({…}))` loop body. The `streamText` call becomes `streamParts` with `thinking: true`, and inside the loop, thought parts emit a `thought` event while answer parts go through `parser.push`:

```ts
          for await (const part of streamParts({
            system,
            user,
            thinking: true,
            abortSignal: abort,
            temperature: 0.6,
          })) {
            if (part.thought) {
              send({ type: "thought", content: part.text });
              continue;
            }
            const { files, deletes, deps } = parser.push(part.text);
            for (const file of files) {
              const path = normalizePath(file.path);
              if (RESERVED_PATHS.has(path) || !isSafePath(path)) continue;
              fileCount++;
              send({ type: "file", path, content: file.content });
            }
            for (const target of deletes) {
              const path = normalizePath(target);
              if (RESERVED_PATHS.has(path) || !isSafePath(path)) continue;
              deleted.push(path);
              send({ type: "delete", path });
            }
            const fresh = deps.filter((d) => isValidPackageName(d) && !wantedDeps.has(d));
            for (const d of fresh) wantedDeps.add(d);
            if (fresh.length) send({ type: "deps", packages: fresh });
          }
```

(Remove the old `send({ type: "delta", content: chunk })` line. Everything after the loop — partial-output handling, `fileCount === 0` done-with-note, canonical package.json + vite.config injection, final `done` — is unchanged.)

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit 2>&1 | grep 'api/generate'`
Expected: empty.

- [ ] **Step 4: Commit**

```bash
git add app/api/generate/route.ts
git commit -m "feat(api/generate): stream thoughts; drop char-count delta"
```

---

### Task 6: Studio — live message state + wiring

**Files:**
- Modify: `components/studio/Studio.tsx`

**Interfaces:**
- Consumes: `LiveMessage`, `AgentAction` (Task 1); the new `AgentEvent`/`GenerateEvent` shapes.
- Produces: a `live` value passed to `ChatPanel` (Task 7) of type `LiveMessage | null`, plus `streaming: boolean`.

- [ ] **Step 1: Add the `live` state and a setter helper**

Add import: `import type { LiveMessage } from "@/lib/types";` (merge into the existing type import). Add state near `chatStreaming`:

```ts
  const [live, setLive] = useState<LiveMessage | null>(null);
```

Add a helper above `runAgent`:

```ts
  const appendLive = useCallback(
    (patch: Partial<LiveMessage> | ((prev: LiveMessage) => LiveMessage)) =>
      setLive((prev) => {
        const base = prev ?? { thinking: "", content: "", actions: [] };
        return typeof patch === "function" ? patch(base) : { ...base, ...patch };
      }),
    []
  );
```

- [ ] **Step 2: Rewire `runAgent` to consume thought/text/action and use `live`**

In `runAgent`, after `setChatStreaming(true)` add `setLive({ thinking: "", content: "", actions: [] });`. Replace the event loop and the assistant-message commit with:

```ts
        let turn: AgentTurn | null = null;
        for await (const event of streamAgent(
          {
            phase: working.phase,
            messages: working.messages
              .filter((m) => m.phase === working.phase)
              .map(({ role, content }) => ({ role, content })),
            docs: docsFromFiles(working.files),
          },
          controller.signal
        )) {
          if (event.type === "thought") {
            appendLive((p) => ({ ...p, thinking: p.thinking + event.content }));
          } else if (event.type === "text") {
            appendLive((p) => ({ ...p, content: p.content + event.content }));
          } else if (event.type === "action") {
            appendLive((p) => ({ ...p, actions: [...p.actions, { icon: event.icon, label: event.label }] }));
          } else if (event.type === "error") {
            throw new Error(event.message);
          } else if (event.type === "done") {
            turn = event.turn;
          }
        }
        if (!turn) throw new Error("ไม่ได้รับคำตอบจาก AI");

        const docEntries = Object.entries(turn.docs) as [DocKind, string][];
        if (docEntries.length > 0) {
          const files = { ...(working.files ?? {}) };
          for (const [kind, contents] of docEntries) files[DOC_PATHS[kind]] = contents;
          working = { ...working, files };
          setView("code");
          pushTerminal(`📄 อัปเดต ${docEntries.map(([kind]) => DOC_PATHS[kind]).join(", ")}`);
        }
        const assistantMsg = newMessage("assistant", turn.reply, working.phase);
        if (turn.ask) assistantMsg.ask = turn.ask;
        const snap = liveRef.current;
        if (snap?.thinking.trim()) assistantMsg.thinking = snap.thinking.trim();
        if (snap?.actions.length) assistantMsg.actions = snap.actions;
        working = appendMessage(working, assistantMsg);
        persist(working);
```

In the `finally` of `runAgent`, add `setLive(null);` (alongside `setChatStreaming(false)`).

Because `live` is React state that the loop can't read freshly, also keep a ref in sync. Add near the other refs: `const liveRef = useRef<LiveMessage | null>(null);` and make `appendLive` also write it:

```ts
  const appendLive = useCallback(
    (patch: Partial<LiveMessage> | ((prev: LiveMessage) => LiveMessage)) =>
      setLive((prev) => {
        const base = prev ?? { thinking: "", content: "", actions: [] };
        const next = typeof patch === "function" ? patch(base) : { ...base, ...patch };
        liveRef.current = next;
        return next;
      }),
    []
  );
```

When clearing in `finally`: `setLive(null); liveRef.current = null;`. When initializing at start of `runAgent`/`generate`: set both `setLive(...)` and `liveRef.current = ...`.

- [ ] **Step 3: Rewire `generate` to consume thought + map build events to actions**

In `generate`, at the streaming start set `setLive({ thinking:"", content:"", actions:[] }); liveRef.current = { thinking:"", content:"", actions:[] };`. In the event loop, replace the `delta` branch and add thought + map file/deps to live actions (keep file→writeFile, deps→depsAdded, delete, done):

```ts
          if (event.type === "thought") {
            appendLive((p) => ({ ...p, thinking: p.thinking + event.content }));
          } else if (event.type === "status") {
            pushTerminal(`… ${event.message}`);
          } else if (event.type === "file") {
            files[event.path] = event.content;
            pushTerminal(`📝 ${event.path}`);
            appendLive((p) => ({ ...p, actions: [...p.actions, { icon: "📝", label: event.path }] }));
            if (live) void writeFile(event.path, event.content).catch(() => {});
          } else if (event.type === "delete") {
            delete files[event.path];
            if (live) void removeFile(event.path).catch(() => {});
          } else if (event.type === "deps") {
            depsAdded = true;
            pushTerminal(`+ ติดตั้ง: ${event.packages.join(", ")}`);
            appendLive((p) => ({ ...p, actions: [...p.actions, { icon: "➕", label: event.packages.join(", ") }] }));
          } else if (event.type === "error") {
            throw new Error(event.message);
          } else if (event.type === "done") {
            note = event.note;
            deleted = event.deleted;
          }
```

> Naming fix: the existing `generate` uses a local `const live = previewSupported && Boolean(previewUrl)` for "dev server running". That now collides with the `live` state. Rename the LOCAL to `liveContainer` throughout `generate` (declaration + the two `if (live)` write/remove guards + the final `if (live) setPhase("ready")`). The `live` STATE is only set/cleared in `generate`, not read for control flow there.

At `generate`'s assistant-message commit, attach thinking/actions from `liveRef.current`:

```ts
        const assistantMsg = newMessage("assistant", note || "สร้างเรียบร้อยแล้ว", current.phase);
        const snap = liveRef.current;
        if (snap?.thinking.trim()) assistantMsg.thinking = snap.thinking.trim();
        if (snap?.actions.length) assistantMsg.actions = snap.actions;
        working = appendMessage(working, assistantMsg);
        persist(working);
```

In `generate`'s `finally`, add `setLive(null); liveRef.current = null;`.

- [ ] **Step 4: Update derived flags + ChatPanel props**

Replace `streamedChars` usage. `setStreamedChars` calls can be removed (the live content is the progress now); delete the `streamedChars` state and its `setStreamedChars(0)`/`setStreamedChars((n)=>…)` calls. Derive:

```ts
  const streamingNow = chatStreaming; // unchanged
```

Pass to `ChatPanel` (Task 7 changes its props): replace `streamedChars={streamedChars}` with `live={live}`. Keep `busy`, `streaming`, `workflowPhase`, `agentName`, `hasApp`, `onSubmit`, `onCancel`.

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit 2>&1 | grep 'Studio.tsx'`
Expected: empty (ChatPanel prop type mismatch is fixed in Task 7; if tsc flags the `live` prop on ChatPanel, that resolves once Task 7 lands — controller runs full `tsc` after Task 7).

- [ ] **Step 6: Commit**

```bash
git add components/studio/Studio.tsx
git commit -m "feat(studio): live streaming message (thinking/text/actions)"
```

---

### Task 7: ChatPanel — render live message + thinking + action chips

**Files:**
- Modify: `components/studio/ChatPanel.tsx`

**Interfaces:**
- Consumes: `LiveMessage`, `AgentAction`, `ChatMessage` (with `thinking`/`actions`).

- [ ] **Step 1: Update props**

Replace `streamedChars: number` with `live: LiveMessage | null` in `ChatPanelProps` and the destructure. Update the import: `import type { ChatMessage, LiveMessage } from "@/lib/types";`.

- [ ] **Step 2: Add a thinking sub-component (collapsible, auto-collapse)**

Add above the default export:

```tsx
function Thinking({ text, live }: { text: string; live: boolean }) {
  // Live + no answer yet → expanded; once answering or settled → collapsed (toggle).
  const [open, setOpen] = useState(false);
  if (!text) return null;
  const expanded = live ? open || text.length > 0 : open;
  return (
    <div className="mb-1.5 rounded-md border-l-2 border-night-edge bg-night/40 px-2.5 py-1.5">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-chalk-dim transition hover:text-chalk"
      >
        💭 ความคิด {open ? "▾" : "▸"}
      </button>
      {(open || live) && (
        <p className="mt-1 whitespace-pre-wrap text-[12px] italic leading-relaxed text-chalk-dim">
          {text}
        </p>
      )}
    </div>
  );
}
```

> The "auto-collapse when the answer starts" is handled in the message renderer: the live bubble shows `Thinking` with `live` true (and the answer text below); completed messages render `Thinking` with `live={false}` (collapsed, expandable). Keep this component minimal — the toggle is local.

- [ ] **Step 3: Render `thinking`/`actions` on each assistant message and the live bubble**

In the messages `.map`, for assistant messages render thinking (collapsed) + content + action chips:

```tsx
        {messages.map((message) => (
          <div key={message.id}>
            <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-chalk-dim">
              {message.role === "user" ? "คุณ" : agentName}
            </p>
            {message.role === "assistant" && message.thinking && (
              <Thinking text={message.thinking} live={false} />
            )}
            <div
              className={`whitespace-pre-wrap rounded-md px-3.5 py-2.5 text-[14px] leading-relaxed ${
                message.role === "user"
                  ? "border border-night-edge bg-night text-chalk"
                  : "border-l-2 border-shine bg-shine/[0.07] text-chalk"
              }`}
            >
              {message.content}
            </div>
            {message.role === "assistant" && message.actions && message.actions.length > 0 && (
              <ActionChips actions={message.actions} />
            )}
          </div>
        ))}
```

Replace the existing `{streaming && (…char counter…)}` block with the live bubble:

```tsx
        {live && (
          <div>
            <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-chalk-dim">
              {agentName}
            </p>
            <Thinking text={live.thinking} live />
            {(live.content || !live.thinking) && (
              <div className="whitespace-pre-wrap rounded-md border-l-2 border-shine bg-shine/[0.08] px-3.5 py-2.5 text-[14px] leading-relaxed text-chalk">
                {live.content}
                <span className="caret-blink text-shine">▍</span>
              </div>
            )}
            {live.actions.length > 0 && <ActionChips actions={live.actions} />}
          </div>
        )}
```

Add the `ActionChips` component above the default export:

```tsx
function ActionChips({ actions }: { actions: { icon: string; label: string }[] }) {
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {actions.map((a, i) => (
        <span
          key={i}
          className="inline-flex max-w-[220px] items-center gap-1 truncate rounded-full border border-night-edge bg-night px-2 py-0.5 font-mono text-[10px] text-chalk-dim"
        >
          {a.icon} <span className="truncate">{a.label}</span>
        </span>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Keep `streaming` for the input-disabled/empty-state logic**

`streaming` prop stays (drives input disabling and hides the empty-state). The old per-char indicator is gone (replaced by the live bubble). Ensure `useState` is imported (it is) and the `ask` active-choice logic still keys off `!busy && !streaming`.

- [ ] **Step 5: Verify (full gate — last code task)**

Run: `npx tsc --noEmit` → clean · `npm run lint` → 0 problems · `npm run build` → succeeds (12 routes).

- [ ] **Step 6: Commit**

```bash
git add components/studio/ChatPanel.tsx
git commit -m "feat(chat): render live streaming, thinking, action chips"
```

---

## Manual verification (after all tasks)

In Chrome/Edge with `GEMINI_API_KEY` set, `npm run dev`:
1. **Define** "ให้ AI สัมภาษณ์": 💭 ความคิด streams then collapses as the reply streams in word-by-word; when the agent emits BRD, a `📄 อัปเดต BRD` chip appears and **no raw ```brd markdown shows** in the bubble.
2. **Build**: 💭 + `📝 <file>` / `➕ <pkg>` chips stream live; the note shows at done.
3. **Esc mid-stream**: the live bubble disappears cleanly (no orphan empty/partial bubble).
4. **Reload**: completed assistant messages keep a collapsed 💭 (expandable) + their chips.
