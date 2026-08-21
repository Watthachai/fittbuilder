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
