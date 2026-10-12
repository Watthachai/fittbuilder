/**
 * How much of the earlier phases' conversation a document turn reads as
 * reference.
 *
 * The studio sends the whole journey, and on a long project almost all of it
 * is build turns — Mabuchi WMS had 428 of them, half a million characters. The
 * current phase's own talk always goes whole; this bounds the rest, newest
 * first, by what the model reads rather than by a count (a 400-message cap
 * refused every document action on such projects outright — case #15).
 * ~300k characters keeps it well inside the context window beside the docs.
 */
export const PRIOR_BUDGET_CHARS = 300_000;

/** The newest messages whose content fits `budget` characters, and how many older ones were left out. */
export function priorWithin<T extends { content: string }>(
  messages: T[],
  budget: number = PRIOR_BUDGET_CHARS
): { kept: T[]; dropped: number } {
  let used = 0;
  let start = messages.length;
  while (start > 0 && used + messages[start - 1].content.length <= budget) {
    used += messages[start - 1].content.length;
    start--;
  }
  return { kept: messages.slice(start), dropped: start };
}
