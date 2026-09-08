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

/**
 * How long ONE MODEL TURN's chat reply may be.
 *
 * Separate from MESSAGE_MAX_CHARS because they bound different things: that one
 * is what a person may type, this one is what we ourselves generated. Sharing
 * the 20k figure across both is what deadlocked a project — a 22,777-character
 * reply was written, stored, and then rejected by our own request schema on
 * every following turn, so the phase could never advance again.
 *
 * The rule that keeps it from recurring is not the size but the pairing: this
 * is clamped where the reply is STORED and bounded by the same constant where
 * it is READ BACK, so a stored transcript is valid by construction.
 */
export const REPLY_MAX_CHARS = 60_000;

/**
 * How long one phase document (BRD/PRD/…) may be, in transit and at rest.
 *
 * gemini-3.8-flash caps output at 65,536 tokens and Thai runs ~4 characters per
 * token, so a single turn cannot physically write past roughly 260k characters —
 * this sits below that and above any real document. Same pairing as the reply
 * cap: clamped where a document is written, bounded identically where it is sent.
 */
export const DOC_MAX_CHARS = 150_000;

