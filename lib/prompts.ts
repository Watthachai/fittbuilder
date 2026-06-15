/** System prompts for the generation model (PRD §6.4, adapted for Gemini). */

import { truncateDoc } from "./context-builder";
import type { DocKind } from "./types";

/**
 * The generated project is deliberately dependency-light so `npm install`
 * inside the WebContainer stays under the PRD's 30s budget:
 * react + react-dom + vite only (Vite transpiles JSX natively), with
 * Tailwind loaded through its browser build in index.html.
 */
export const PACKAGE_JSON_TEMPLATE = `{
  "name": "fitt-demo",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "vite": "^6.3.5"
  }
}`;

const OUTPUT_CONTRACT = `OUTPUT FORMAT — STRICT:
Respond with a single valid JSON object and nothing else (no markdown, no code fences, no commentary):
{
  "note": "<1-2 sentence summary of what you built/changed, in the SAME language as the user's request>",
  "files": { "<path>": "<full file contents>", ... },
  "deleted": ["<path>", ...]
}
- "files" values are complete file contents as strings. Never use placeholders or "...".
- "deleted" is optional and only used in iteration mode.
- All paths are relative, e.g. "src/App.jsx". Never use ".." or absolute paths.`;

const PROJECT_RULES = `PROJECT RULES:
1. Always produce a Vite + React 18 project. Use EXACTLY this package.json (do not add dependencies):
${PACKAGE_JSON_TEMPLATE}
2. Required files: "package.json", "index.html", "src/main.jsx", "src/App.jsx", "src/index.css".
3. index.html must include, inside <head>:
   - <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>  (Tailwind CSS — style ONLY with Tailwind utility classes)
   - <script type="module" src="/src/main.jsx"></script> goes in <body>.
4. Vite transpiles .jsx natively — do NOT add a vite.config file and do NOT import any npm package other than react and react-dom.
5. Build beautiful, responsive, production-quality UI. Use realistic mock data (names, prices, dates) — never lorem ipsum. Add hover states, transitions, and a coherent color palette.
6. State must work: clickable tabs, working forms, add-to-cart counters, kanban drag is optional but buttons must do something. Use React hooks.
7. If the user's request is in Thai, generate ALL visible content in Thai and load a Thai font in index.html:
   <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700&display=swap" rel="stylesheet">
   then set it as the Tailwind font (class or inline style font-family:'Sarabun',sans-serif on <body>).
8. Never call external APIs or backends. All data is local mock data in the React code.
9. Keep total output under 100KB. Prefer one rich page over many thin ones; use simple client-side view switching (useState) if multiple screens are needed.
10. Images: use inline SVG or CSS gradients/shapes. Do not hotlink external images.`;

const DEFAULT_BUILD_PERSONA =
  "You are FITT Builder, a web application generator for non-technical users (designers, product managers, marketers). You turn a natural-language brief into a complete, runnable web demo.";

/** Build-phase system prompt. `persona` is the code-builder SKILL.md body. */
export function buildGenerationSystemPrompt(specContext?: string, persona?: string): string {
  return `${persona ?? DEFAULT_BUILD_PERSONA}

${PROJECT_RULES}

${specContext ? `${specContext}\n\n` : ""}${OUTPUT_CONTRACT}`;
}

export function buildIterationSystemPrompt(persona?: string): string {
  return `${persona ?? DEFAULT_BUILD_PERSONA}

The user has an existing generated project and wants a modification described in plain language (Thai or English).

ITERATION RULES:
1. You receive the current project files. Apply ONLY the requested change.
2. Return ONLY the files whose contents change (full new contents for each), plus new files if needed. Unchanged files must NOT appear in "files".
3. List removed files in "deleted".
4. Keep the existing stack: do not add dependencies, do not change package.json unless explicitly asked.
5. Preserve the existing design language and data unless the request says otherwise.

${OUTPUT_CONTRACT}`;
}

export function buildIterationUserPrompt(prompt: string, files: Record<string, string>): string {
  const fileDump = Object.entries(files)
    .map(([path, contents]) => `--- ${path} ---\n${contents}`)
    .join("\n\n");
  return `CURRENT PROJECT FILES:\n\n${fileDump}\n\nUSER REQUEST: ${prompt}`;
}

/* ——— Conversational phase agents (define/plan/verify/review/ship) ——— */

const DOC_LABELS: Record<DocKind, string> = {
  idea: "IDEA",
  brd: "BRD",
  prd: "PRD",
  verify: "VERIFY",
  review: "REVIEW",
  ship: "SHIP",
};

/**
 * Compose a conversational agent's system prompt: its SKILL.md body, the
 * current phase documents, and the fenced-block output contract used to
 * extract (re)issued documents.
 */
export function buildAgentSystemPrompt(
  agentBody: string,
  docs: Partial<Record<DocKind, string>>
): string {
  const docState = (Object.keys(DOC_LABELS) as DocKind[])
    .filter((kind) => docs[kind])
    .map((kind) => `--- ${DOC_LABELS[kind]} ปัจจุบัน (docs/${DOC_LABELS[kind]}.md) ---\n${truncateDoc(docs[kind]!)}`)
    .join("\n\n");

  const contract = `DOC OUTPUT CONTRACT — สำคัญ:
- เมื่อจะออก/แก้เอกสาร ให้ครอบเนื้อหา Markdown ฉบับเต็มด้วย fenced block ที่ขึ้นต้น \`\`\`<kind> โดย <kind> เป็นหนึ่งใน: ${(Object.keys(DOC_LABELS) as DocKind[]).join(" | ")}
- ส่งเอกสารทั้งฉบับเสมอ (ไม่ใช่เฉพาะส่วนที่แก้) และห้ามมี \`\`\` ซ้อนอยู่ภายในเอกสาร
- ข้อความนอกบล็อกคือบทสนทนาปกติที่ผู้ใช้จะเห็นในแชท`;

  return `${agentBody}

${docState ? `สถานะเอกสารปัจจุบัน (ผู้ใช้อาจแก้ไขเองใน editor — ยึดฉบับนี้เป็นหลัก):\n\n${docState}\n\n` : ""}${contract}`;
}

/* ——— Spec-to-Demo helpers (preset detection / answer extraction) ——— */

export const DETECT_PRESET_SYSTEM = `You classify a product/business document into a domain. Reply with ONLY one word from this exact list:
erp | crm | ecommerce | dashboard | booking | landing | other
No punctuation, no explanation.`;

export function buildExtractAnswersSystem(questionsJson: string): string {
  return `You extract answers to clarifying questions from a product document (BRD/PRD), which may be in Thai or English.

QUESTIONS (JSON):
${questionsJson}

Rules:
- Only answer a question if the document clearly states or strongly implies the answer.
- For "single" questions: the answer must be EXACTLY one of the given options.
- For "multi" questions: an array containing only the given options.
- For "text" questions: a concise string in the document's language.
- Omit questions the document doesn't answer.

OUTPUT — STRICT: a single JSON object, nothing else:
{ "answers": { "<questionId>": <string or array>, ... } }`;
}
