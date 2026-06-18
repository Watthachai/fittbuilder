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
          // No fence — hold up to 2 trailing chars (longest prefix of "```")
          // so a fence split across chunks is still detected.
          const keep = this.buffer.slice(-2);
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
          // Accumulate, holding up to 3 trailing chars (longest prefix of
          // "\n```") so a closing fence split across chunks is still detected.
          const keep = this.buffer.slice(-3);
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

  /** Final turn — call after the stream ends (salvages any held/partial content). */
  getTurn(): AgentTurn {
    if (this.block !== null) {
      // Stream ended INSIDE a block (e.g. the model hit maxOutputTokens before
      // closing the fence). Salvage the partial so a half-written doc/ask isn't
      // silently lost.
      const body = (this.body + this.buffer).trim();
      if (this.block === "ask") {
        this.ask = this.ask ?? parseAsk(body);
      } else if (body) {
        this.docs[this.block] = body;
      }
      this.block = null;
      this.body = "";
      this.buffer = "";
    } else if (this.buffer) {
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
