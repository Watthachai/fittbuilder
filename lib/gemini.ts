import { GoogleGenAI, type Part } from "@google/genai";
import type { ChatAttachmentInput } from "@/lib/types";

/** Server-only Gemini client. Never import from client components. */

export class MissingApiKeyError extends Error {
  constructor() {
    super(
      "GEMINI_API_KEY is not set. Add it to .env.local (see .env.example) — get a key at https://aistudio.google.com/apikey"
    );
    this.name = "MissingApiKeyError";
  }
}

let client: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new MissingApiKeyError();
  client ??= new GoogleGenAI({ apiKey });
  return client;
}

export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash";

/** Token counts for one Gemini call (thinking tokens folded into output). */
export interface TokenUsage {
  promptTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface StreamTextOptions {
  system: string;
  user: string;
  /** Force `application/json` output. */
  json?: boolean;
  /** Stream Gemini thought summaries (parts flagged thought:true) too. */
  thinking?: boolean;
  maxOutputTokens?: number;
  temperature?: number;
  abortSignal?: AbortSignal;
  /** Web grounding: googleSearch (search) and/or urlContext (read given URLs). */
  tools?: ("googleSearch" | "urlContext")[];
  /** Images/files to read alongside `user` (sent as extra content parts). */
  attachments?: ChatAttachmentInput[];
  /** Called once with the final token usage when the stream ends. */
  onUsage?: (usage: TokenUsage) => void;
}

const TEXT_PART_LIMIT = 100_000; // cap decoded text files so one attachment can't blow the context

/** Turn user attachments into Gemini content parts: image/PDF as inlineData, any
 *  other file decoded to a labelled text part so the model reads its contents. */
function attachmentParts(attachments: ChatAttachmentInput[]): Part[] {
  return attachments.map((a) => {
    if (a.mimeType.startsWith("image/") || a.mimeType === "application/pdf") {
      return { inlineData: { mimeType: a.mimeType, data: a.data } };
    }
    const text = Buffer.from(a.data, "base64").toString("utf8").slice(0, TEXT_PART_LIMIT);
    return { text: `ไฟล์แนบ "${a.name}":\n${text}` };
  });
}

export interface StreamPart {
  thought: boolean;
  text: string;
}

/** Stream model output as typed parts, separating thought summaries from the answer. */
export async function* streamParts(options: StreamTextOptions): AsyncGenerator<StreamPart> {
  const ai = getGeminiClient();
  // With attachments, send a single user turn of [text, ...media] parts.
  const contents = options.attachments?.length
    ? [{ text: options.user }, ...attachmentParts(options.attachments)]
    : options.user;
  const stream = await ai.models.generateContentStream({
    model: GEMINI_MODEL,
    contents,
    config: {
      systemInstruction: options.system,
      temperature: options.temperature ?? 0.7,
      maxOutputTokens: options.maxOutputTokens ?? 65536,
      ...(options.json ? { responseMimeType: "application/json" } : {}),
      ...(options.thinking ? { thinkingConfig: { includeThoughts: true } } : {}),
      ...(options.tools?.length
        ? {
            tools: options.tools.map((t) =>
              t === "googleSearch" ? { googleSearch: {} } : { urlContext: {} }
            ),
          }
        : {}),
      ...(options.abortSignal ? { abortSignal: options.abortSignal } : {}),
    },
  });
  let usage: TokenUsage | null = null;
  try {
    for await (const chunk of stream) {
      // usageMetadata arrives on (typically) the last chunk; keep the latest.
      const m = chunk.usageMetadata;
      if (m) {
        const prompt = m.promptTokenCount ?? 0;
        const candidates = m.candidatesTokenCount ?? 0;
        const thoughts = m.thoughtsTokenCount ?? 0;
        usage = {
          promptTokens: prompt,
          outputTokens: candidates + thoughts,
          totalTokens: m.totalTokenCount ?? prompt + candidates + thoughts,
        };
      }
      const parts = chunk.candidates?.[0]?.content?.parts;
      if (!parts) continue;
      for (const part of parts) {
        if (typeof part.text === "string" && part.text.length > 0) {
          yield { thought: part.thought === true, text: part.text };
        }
      }
    }
  } finally {
    if (usage && options.onUsage) options.onUsage(usage);
  }
}

/** Stream model output as text chunks (answer only — thoughts skipped). */
export async function* streamText(options: StreamTextOptions): AsyncGenerator<string> {
  for await (const part of streamParts(options)) {
    if (!part.thought) yield part.text;
  }
}

/** Non-streaming convenience for short classification/extraction calls. */
export async function generateText(options: StreamTextOptions): Promise<string> {
  let out = "";
  for await (const chunk of streamText(options)) out += chunk;
  return out;
}
