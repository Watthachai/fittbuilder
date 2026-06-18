# Design — Streaming chat with AI thinking + inline actions

Date: 2026-06-18 · Status: approved (brainstorming)

## Goal

Make FITT Builder's chat feel like the Claude Code experience the user is having:
1. The assistant's reply **streams into the bubble live** (today only a character
   counter shows during streaming, not the text).
2. A collapsible **"💭 ความคิด" (thinking)** section shows the model's reasoning,
   streaming live and **auto-collapsing** when the answer starts.
3. **Inline action items** show what the AI did (📄 updated BRD · 📝 wrote
   src/Login.jsx · ➕ installed @react-oauth/google).

## Decisions (from brainstorming)

- **Scope:** all chat surfaces — conversational phases (Define/Plan/Verify/Review/
  Ship via `/api/agent`) AND Build (`/api/generate`).
- **Thinking:** Gemini 2.5 **thought summaries** (`thinkingConfig.includeThoughts`),
  shown live then auto-collapsed. Not raw chain-of-thought (Gemini only exposes
  summaries). Accepts the small extra latency/token cost.
- **Actions:** shown **inline in the chat** as compact chips.
- **Approach A** (chosen): typed-segment streaming into a live message object.
  Keep the 6-phase flow + doc extraction; only make streaming smooth + add
  thinking/actions.

## Architecture

Server streams **typed events** (thought / text / action / file / deps / done).
The client accumulates them into a single **live message object** held in React
state (not localStorage), renders it live, and commits one persisted
`ChatMessage` at done. No raw markdown (```brd / ```ask) ever reaches the bubble —
a streaming filter converts completed doc/ask blocks into action chips.

## Components

### 1. `lib/gemini.ts` — separate thoughts from the answer
Add:
```
export interface StreamPart { thought: boolean; text: string }
export async function* streamParts(opts: StreamTextOptions): AsyncGenerator<StreamPart>
```
- Calls `generateContentStream` with `config.thinkingConfig = { includeThoughts: true }`.
- Per chunk, iterate `chunk.candidates?.[0]?.content?.parts ?? []`; for each part with
  `text`, yield `{ thought: part.thought === true, text: part.text }`.
- `streamText` stays (answer-only) and is reimplemented on top of `streamParts`
  (skip `thought` parts) so existing callers (extract/detect helpers) are unchanged.
- A `thinking?: boolean` option on `StreamTextOptions` lets callers opt in; the two
  chat routes pass `thinking: true`.

### 2. Event protocol (`lib/types.ts`)
```
type AgentEvent =
  | { type: "thought"; content: string }
  | { type: "text"; content: string }
  | { type: "action"; icon: string; label: string }
  | { type: "done"; turn: AgentTurn }
  | { type: "error"; message: string };
```
(removes `delta`). `GenerateEvent` also drops `delta` and gains
`{ type: "thought"; content: string }` (its existing `file`/`deps`/`delete` events
are the actions; `status`/`done`/`error` stay; the Build bubble shows thinking +
chips + the final note, not a char counter). `ChatMessage` gains
`thinking?: string` and `actions?: { icon: string; label: string }[]`.

### 3. `/api/agent` — streaming block-filter
A small state machine over the answer stream (thought parts → `thought` events):
- Outside a fenced block: emit clean prose as `{type:"text"}` as it arrives.
- A ` ```idea|brd|prd|verify|review|ship ` or ` ```ask ` block opens: **buffer it,
  emit nothing raw**. When it closes: emit `{type:"action", icon, label}` (📄 for
  docs: "อัปเดต BRD"; for ask no chip) and record the doc/ask for the done turn.
- Incomplete fence at a chunk boundary: hold until it closes.
- At `done`: emit `{type:"done", turn:{reply, docs, ask}}` exactly as today
  (`reply` = concatenated clean prose). The existing `DOC_BLOCK`/`ASK_BLOCK`
  regexes + `extractTurn` logic are reused, made streaming-aware.

### 4. `/api/generate` — thinking
Use `streamParts` (thinking on): thought parts → `{type:"thought"}`; answer parts
feed the existing `FileStreamParser` (files/deps/deletes) unchanged. The build's
visible text is just the final note (sent in `done`).

### 5. Studio — live message state + wiring
- New state `live: { thinking: string; content: string; actions: Action[]; phase: PhaseId } | null`.
- `runAgent`/`generate` set `live` (empty) at start; on each event:
  `thought` → append `live.thinking`; `text` → append `live.content`;
  `action`/`file`/`deps` → push a chip to `live.actions`.
- At `done`: build a real `ChatMessage` (`content` = clean reply / note, plus
  `thinking`, `actions`, `ask`), `appendMessage` + **persist once**, `setLive(null)`,
  then run the existing post-turn work (write docs to files / boot / install).
- Updates are React-state only (cheap per token); localStorage is written once at done.
- Replaces `streamedChars`; `streamingNow`/`phaseBusy` derive from `live !== null`.

### 6. `ChatPanel` UI
- Props: drop `streamedChars`/`streaming`; add `live`. Render `messages` then the
  `live` bubble (if any).
- Each assistant bubble renders, in order:
  - **💭 ความคิด** (only if `thinking`): collapsible. Live message → expanded while
    `content` is empty, **auto-collapses once `content` has text** or at done;
    completed messages → collapsed, click to expand. Dimmed, left-border style.
  - **content**: `whitespace-pre-wrap`; live message shows a blinking caret.
  - **actions**: a row of small chips (`{icon} {label}`).
- The existing interactive `ask` choices still render under the last message.

## Data flow

`streamParts` → route classifies parts (thought vs answer) → route emits typed
events (answer further split by the block-filter / FileStreamParser) → `streamAgent`/
`streamGenerate` yield them → Studio folds them into `live` → ChatPanel renders
`live` live → at `done` Studio commits one `ChatMessage` and clears `live`.

## Error handling
- Abort mid-stream → discard the `live` bubble (no orphan empty/partial message),
  matching the existing abort cleanup.
- `error` event → surface via the existing error path; clear `live`.
- Model returns no thought parts → no thinking section (graceful).
- `thinkingConfig` unsupported / SDK shape differs → `streamParts` yields only
  answer text (thought defaults false); chat still works, just no thinking.

## Testing
No test framework configured → `npx tsc --noEmit`, `npm run lint`, `npm run build`
must pass, plus manual in Chrome/Edge:
- Define interview: 💭 streams then auto-collapses; reply streams live; 📄 chip when
  BRD is emitted (no raw ```brd in the bubble).
- Build: 💭 + 📝/➕ chips stream live; note at done.
- Abort mid-stream: live bubble disappears cleanly.
- Reload: completed messages keep collapsed 💭 + chips.

## Out of scope
- Raw/full chain-of-thought (Gemini exposes summaries only).
- Persisting per-token timeline; auth/DB; multi-stack templates.
- A toggle to disable thinking (always-on per the chosen design; revisit if cost matters).
