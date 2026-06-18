import { GoogleGenAI } from "@google/genai";

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
}

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

/** Non-streaming convenience for short classification/extraction calls. */
export async function generateText(options: StreamTextOptions): Promise<string> {
  let out = "";
  for await (const chunk of streamText(options)) out += chunk;
  return out;
}
