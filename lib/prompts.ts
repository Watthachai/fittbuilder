/** System prompts for the generation model (PRD §6.4, adapted for Gemini). */

import { truncateDoc } from "./context-builder";
import { DEMO_PACKAGE_JSON } from "./scaffold";
import type { DocKind } from "./types";

/**
 * Generated demos run as a Vite + React 18 app inside the WebContainer (see
 * lib/scaffold.ts for why Vite, not Next.js). The package is kept to
 * react + react-dom + vite so the install matches the pre-warmed scaffold and
 * Build skips `npm install`.
 */
export const PACKAGE_JSON_TEMPLATE = DEMO_PACKAGE_JSON;

const OUTPUT_CONTRACT = `OUTPUT FORMAT — STRICT (stream files one at a time):
1. Go straight to the file blocks. At most ONE short lead-in line before them — save the real explanation for the final summary (rule 8).
2. Output EACH file as its own block in this EXACT shape — no markdown code fences, no commentary between blocks:
<file path="src/App.tsx">
<full, complete file contents here>
</file>
3. Write COMPLETE file contents every time — never placeholders, "...", or partial files. Do NOT wrap blocks in \`\`\`.
4. When practical, output a file BEFORE the files that import it, so the live preview stays valid while it streams.
5. Use relative paths only (e.g. "src/components/Header.tsx") — never ".." or absolute paths. Do NOT output package.json, vite.config.js, or tsconfig.json (they are provided automatically).
6. (iteration only) Output ONLY the files that change. To remove a file, output a self-closing tag: <delete path="src/Old.tsx"/>
7. If your code imports an npm package other than react/react-dom, declare it with a directive: <deps>package-name another-package</deps> (names ONLY, no versions). It is installed automatically. NEVER write "npm install …" or tell the user to run any command — just declare <deps> and import it.
8. AFTER the last </file>, write a polished Markdown summary for the user — this is the ONLY text they read in chat, so make it genuinely useful and well-formatted, in the SAME language as the request:
   - A 1-2 sentence intro of what you built/changed.
   - Then bullet points grouped by area, each starting with a **bold label**, e.g. **ดีไซน์ (Theme):** …, **ฟังก์ชัน:** …, **โครงสร้างโค้ด:** …, **ส่วนที่แก้ (iteration):** …
   - Be concrete (mention the actual components, colors, libraries, interactions). Use real Markdown (bold, bullet lists). Do NOT restate the file list (the UI already shows it) and do NOT include code fences here.`;

const PROJECT_RULES = `PROJECT RULES (Vite + React 18 + TypeScript):
1. Always produce a Vite + React 18 + TypeScript project. Base package.json (do NOT add/remove/change dependencies yourself — the user installs npm packages separately; if the current files already list extra dependencies, keep them):
${DEMO_PACKAGE_JSON}
2. Required files (always include all of them): "index.html", "src/main.tsx", "src/App.tsx", "src/index.css". (package.json, vite.config.js, and tsconfig.json are provided automatically — do NOT output them.)
3. index.html must include, inside <head>, EXACTLY:
   - <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>  (Tailwind — style ONLY with Tailwind utility classes)
   - <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Anuphan:wght@400;500;600;700&display=swap" rel="stylesheet" />
   - <style>body{font-family:'Anuphan','Inter',system-ui,sans-serif}</style>
   and in <body>: <div id="root"></div> then <script type="module" src="/src/main.tsx"></script>.
4. src/main.tsx mounts <App /> into #root via react-dom/client createRoot and imports "./index.css".
5. TypeScript + JSX (.tsx) ONLY. The project uses @vitejs/plugin-react with a vite.config.js + tsconfig.json that are PROVIDED automatically — do NOT create or modify them. With the automatic JSX runtime you do NOT need to "import React"; just import the hooks you use (e.g. import { useState } from "react"). Write idiomatic TypeScript: type component props with interfaces/types and type your state and mock-data shapes, but the build does NOT typecheck — prefer a running app over exhaustive typing, and never let types block functionality. You may import react, react-dom, and any npm package ALREADY in package.json "dependencies". To use an EXTRA npm package, declare it with a <deps>package-name</deps> directive (see output format) and it is installed automatically — never hand-write "npm install". Import local files with RELATIVE paths WITHOUT extension (e.g. "./components/Header").
6. DESIGN QUALITY — make it look like a real, shipped SaaS product (think Linear / Vercel / Stripe dashboards), not a tutorial demo:
   - Cohesive palette (pick ~2 neutrals + 1 accent and use them consistently). Cards = white/surface with a subtle border AND soft shadow (e.g. "rounded-xl border border-gray-200 shadow-sm"); generous padding and whitespace; clear type hierarchy (big bold numbers, muted labels).
   - A real app chrome: a top navbar (logo + name + search + avatar/notification) and a titled main area — not a bare centered box.
   - Dashboards: KPI cards each with an icon, the metric, and a colored ▲/▼ delta vs. last period; charts with axes/grid/tooltip; tables with a header row, hover rows, and status badges (colored dot + label).
   - Hover/focus transitions on every interactive element. Use realistic Thai mock data (real-sounding names, ฿ prices, Thai-formatted dates) — never lorem ipsum or placeholder zeros.
7. RICH LIBRARIES — reach for these to hit production quality (declare with <deps> and import; they auto-install):
   - "lucide-react" for crisp icons (import { Store, Bell, TrendingUp } from "lucide-react").
   - "recharts" for charts (AreaChart/BarChart/PieChart with ResponsiveContainer, gradients, and a styled Tooltip).
   - Example directive: <deps>recharts lucide-react</deps>
8. State must work: clickable tabs, working forms, add-to-cart counters, filters — buttons must DO something. Use React hooks.
9. If the request/documents are in Thai, generate ALL visible content in Thai (the Anuphan font is already loaded).
10. Never call external APIs or backends. All data is local mock data in the React code.
11. PROJECT STRUCTURE — build it like a real codebase, not one giant file: keep the page composition in src/App.tsx, extract each reusable piece into its own file under src/components/*.tsx (e.g. KPICard.tsx, SalesChart.tsx, TransactionTable.tsx), put shared TypeScript types in src/types.ts, and mock data in src/data.ts. Keep each file focused and import with relative paths without extension. For multiple screens, switch views client-side with useState (stays a single-page app). Total output under ~140KB.
12. Images: use inline SVG or CSS gradients/shapes. Do not hotlink external images.`;

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
1. You receive the current project files (a Vite + React + TypeScript app). Apply ONLY the requested change.
2. Return ONLY the files whose contents change (full new contents for each), plus new files if needed. Unchanged files must NOT appear in "files".
3. List removed files in "deleted".
4. Keep the existing stack: TypeScript (.tsx) only; NEVER change package.json/vite.config.js/tsconfig.json or add dependencies via files (use the <deps> directive for new npm packages). Use relative imports without file extensions.
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
- ข้อความนอกบล็อกคือบทสนทนาปกติที่ผู้ใช้จะเห็นในแชท

INTERACTIVE ASK CONTRACT — สำคัญมาก:
- ทุกครั้งที่คุณ "ถามคำถาม" ผู้ใช้ ให้แนบตัวเลือกที่กดได้ โดยใส่ fenced block ขึ้นต้น \`\`\`ask ตามด้วย JSON หนึ่งบรรทัด เช่น:
\`\`\`ask
{"question":"ธุรกิจของคุณเป็นแบบไหน?","options":["ร้านอาหาร","ร้านค้าออนไลน์","บริการจองคิว","อื่นๆ"],"multi":false,"allowText":true}
\`\`\`
- options เป็นคำตอบรูปธรรมที่พบบ่อย 2-5 ข้อ ให้ผู้ใช้กดเลือกได้ทันที (เขียนคำถามเต็มในบทสนทนาปกติด้วย ส่วนบล็อก ask ให้แค่ตัวเลือก)
- ใช้ multi=true เมื่อเลือกได้หลายข้อ (เช่น เลือกฟีเจอร์), allowText=false เมื่อไม่ต้องการให้พิมพ์เอง
- ถามทีละคำถาม → ใส่บล็อก \`\`\`ask ได้สูงสุด 1 บล็อกต่อข้อความ และอย่าใส่ ask เมื่อกำลังส่งเอกสารให้ตรวจ (ให้ผู้ใช้กดปุ่ม "อนุมัติ & ไปต่อ" แทน)`;

  return `${agentBody}

${docState ? `สถานะเอกสารปัจจุบัน (ผู้ใช้อาจแก้ไขเองใน editor — ยึดฉบับนี้เป็นหลัก):\n\n${docState}\n\n` : ""}${contract}`;
}

/* ——— Spec-to-Demo helpers (preset detection / answer extraction) ——— */

export const DESIGN_OPTIONS_SYSTEM = `You are a senior product designer. Given a short web-app idea (Thai or English), propose 5 DISTINCT visual design directions for the app.

OUTPUT — STRICT: a single JSON object, nothing else (no markdown, no code fences):
{"options":[{"name":"Bento Grid","description":"<Thai one-liner>","palette":{"bg":"#0b0b0f","surface":"#15151c","primary":"#64cefb","text":"#f5f5f7"},"font":"Inter, geometric sans, airy spacing"}]}

Rules:
- EXACTLY 5 options, each visually distinct from the others in BOTH palette and layout philosophy. Draw from varied directions such as: clean minimalism, dense data/dashboard, bento-grid cards, bold editorial, soft rounded/friendly, sleek dark, high-contrast light. Do not give five variations of the same idea.
- "name": a short memorable English label (1-3 words), like "Bento Grid", "Clean Minimalism", "High Density", "Geometric Balance", "Sleek Interface".
- "description": Thai, <= 90 characters, concrete about the layout/feel.
- "palette": four valid #rrggbb hex values. "text" MUST have strong contrast against "bg". Tailor palettes to the app's domain (a finance dashboard is not a kids' app).
- "font": short free-text describing the typographic + spacing vibe.`;

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
