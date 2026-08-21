/**
 * How long a single message from the user may be.
 *
 * One number, because it has to hold at four places that only work together:
 * the landing textarea, the studio chat textarea, /api/agent's message content
 * and /api/generate's prompt. They were separately-written 10_000s, and the
 * brief passthrough then accepted 20_000 — so the tightest of them silently
 * decided the real limit.
 *
 * 20k is sized for what people actually paste: a full design spec runs 8-12k
 * characters, and a textarea that stops accepting input mid-paste loses the END
 * of a document — which is where a spec keeps its palette and its font stack.
 */
export const MESSAGE_MAX_CHARS = 20_000;

/** Below this the counter is quiet; above it, it warns. */
export const MESSAGE_WARN_CHARS = Math.floor(MESSAGE_MAX_CHARS * 0.9);

/**
 * How much of one attached TEXT file the model is given.
 *
 * Five times the typed limit, because attaching a document is the answer to
 * "my spec is longer than the box" — but still a cap, so one pasted log cannot
 * crowd out the brief and the project files it has to sit beside. Images and
 * PDFs are not counted in characters and go whole.
 *
 * Enforced where the file is READ, not where it is sent, so the cut carries a
 * visible marker instead of the model silently receiving half a document.
 */
export const ATTACHMENT_TEXT_MAX_CHARS = 100_000;
