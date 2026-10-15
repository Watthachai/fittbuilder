# Edit turns name the lines they change

Date: 2026-10-16 · Status: approved in chat, implemented as 0.111.0

## Why

Turn time follows what the model writes (r² 0.89 against output tokens, no
fixed overhead). An edit turn wrote every file it touched in full: across 60
recent AI revisions, 76% of what the model wrote was existing code it only
copied. The copying cost time and money, and every copied line was one the
model could quietly change: a dropped export, a truncated file.

## What the user asked for

- Faster edits.
- Exactness: change only the part asked for. Everything else in the file must
  stay exactly as it was.
- Rejected: rewriting the whole file when an edit cannot be placed. That is the
  behaviour this replaces.

## Design

- **Contract (edit turns only).** An existing file changes through
  `<edit path="…">` holding `<find>`/`<replace>` pairs. `<file>` is for a new
  file, or a file the user asked to rebuild from scratch. First builds are
  unchanged.
- **Placement (`lib/apply-edit`).** Done by string on the server, not by the
  model.
  - Each `<find>` must match the file exactly once.
  - Pairs apply in order; an edit is all or nothing.
  - An empty `<replace>` removes the lines along with their line break.
  - Everything outside the matched text is untouched by construction.
- **Downstream unchanged.** A placed edit goes out as an ordinary `file`
  event carrying the whole file, so these see finished files as before:
  - the preview,
  - the draft,
  - history,
  - turn reattach,
  - the JSX and default-export repairs.
- **When an edit cannot be placed.** The file is left exactly as it was. Then
  there is one retry with no thinking. It is shown:
  - what it sent,
  - which `<find>` missed and why (not found / more than one place),
  - the file as it is now.

  It may answer only with edits to those files. Anything still unplaced:
  - is named in the chat (`unplacedNote`), never "เรียบร้อย";
  - a task turn's verdict is set to ไม่ครบ (`markIncomplete`), so the task list
    runs the item again.

  An edit to a path that does not exist is not retried.
- **Measurement.** `fittbuilder_ai_usage.edit_stats` (migration 0058) records
  `{applied, repaired, failed, rewritten}` per edit turn. `rewritten` counts
  existing files still written out whole. The retry's tokens are added to the
  turn's.

## Not done (until the numbers ask for it)

- Whitespace-tolerant matching. Exact match first, then measure `failed`.
- Line-number addressing. An off-by-one would edit the neighbouring line
  silently, while a quoted `<find>` that is wrong is always caught.
