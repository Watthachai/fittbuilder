import { z } from "zod";
import { getAgent } from "@/lib/agents/registry";
import { buildSpecContext } from "@/lib/context-builder";
import { isSafePath, normalizePath, sanitizeCss } from "@/lib/files";
import { extraDepsOf, packageJsonWithDeps, TSCONFIG, VITE_CONFIG } from "@/lib/scaffold";
import { FileStreamParser } from "@/lib/stream-parse";
import { MissingApiKeyError, streamParts } from "@/lib/gemini";
import {
  buildGenerationSystemPrompt,
  buildIterationSystemPrompt,
  buildIterationUserPrompt,
} from "@/lib/prompts";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { PRESET_IDS } from "@/lib/presets";
import { getSkill } from "@/lib/skills/registry";
import type { GenerateEvent } from "@/lib/types";

// Generation streams file-by-file, so a longer single pass is fine — partial
// output is still written live, and there's no all-or-nothing JSON parse.
export const maxDuration = 300;
const ATTEMPT_TIMEOUT_MS = 240_000;

/** package.json + vite.config.js + tsconfig.json are injected canonically, not taken from the model. */
const RESERVED_PATHS = new Set(["package.json", "vite.config.js", "tsconfig.json"]);

/** Guard <deps> entries so only real npm package names reach package.json. */
function isValidPackageName(name: string): boolean {
  return (
    name.length <= 100 &&
    /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/.test(name)
  );
}

const bodySchema = z.object({
  prompt: z.string().trim().min(1).max(10_000),
  previousFiles: z.record(z.string().max(200), z.string().max(200_000)).optional(),
  iterationMode: z.boolean().optional(),
  brd: z.string().max(50_000).optional(),
  prd: z.string().max(50_000).optional(),
  presetId: z
    .string()
    .refine((id) => PRESET_IDS.includes(id) || id === "other")
    .optional(),
  presetAnswers: z
    .record(z.string(), z.union([z.string().max(2_000), z.array(z.string().max(500)).max(20)]))
    .optional(),
  skillId: z.string().max(40).optional(),
});

function sse(event: GenerateEvent): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`);
}

export async function POST(request: Request) {
  const limit = rateLimit(`generate:${clientIp(request)}`);
  if (!limit.ok) {
    return Response.json(
      { error: `คำขอถี่เกินไป ลองใหม่ใน ${limit.retryAfter} วินาที` },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return Response.json({ error: "คำขอไม่ถูกต้อง" }, { status: 400 });
  }

  const iteration = Boolean(body.iterationMode && body.previousFiles);
  // The code-builder SKILL.md body is the Build-phase persona; fall back to the
  // built-in default if the file is unreadable so generation still works.
  const persona = (await getAgent("code-builder").catch(() => null))?.body;
  const system = iteration
    ? buildIterationSystemPrompt(persona)
    : buildGenerationSystemPrompt(
        buildSpecContext({
          brd: body.brd,
          prd: body.prd,
          presetId: body.presetId,
          answers: body.presetAnswers,
        }),
        persona,
        getSkill(body.skillId)
      );
  const user = iteration
    ? buildIterationUserPrompt(body.prompt, body.previousFiles!)
    : body.prompt;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: GenerateEvent) => controller.enqueue(sse(event));
      const parser = new FileStreamParser();
      let fileCount = 0;
      const deleted: string[] = [];
      const wantedDeps = new Set<string>();

      try {
        const abort = AbortSignal.timeout(ATTEMPT_TIMEOUT_MS);
        try {
          for await (const part of streamParts({
            system,
            user,
            thinking: true,
            abortSignal: abort,
            temperature: 0.6,
          })) {
            if (part.thought) {
              send({ type: "thought", content: part.text });
              continue;
            }
            const { files, deletes, deps } = parser.push(part.text);
            for (const file of files) {
              const path = normalizePath(file.path);
              if (RESERVED_PATHS.has(path) || !isSafePath(path)) continue;
              fileCount++;
              const content = path.endsWith(".css") ? sanitizeCss(file.content) : file.content;
              send({ type: "file", path, content });
            }
            for (const target of deletes) {
              const path = normalizePath(target);
              if (RESERVED_PATHS.has(path) || !isSafePath(path)) continue;
              deleted.push(path);
              send({ type: "delete", path });
            }
            const fresh = deps.filter((d) => isValidPackageName(d) && !wantedDeps.has(d));
            for (const d of fresh) wantedDeps.add(d);
            if (fresh.length) send({ type: "deps", packages: fresh });
          }
        } catch (streamError) {
          // Partial output is usable (files were already streamed/written live);
          // only a total failure (nothing produced) is a hard error.
          if (fileCount === 0) throw streamError;
          console.error("[generate] stream ended early, using partial output:", streamError);
        }

        // The model answered without emitting any files (e.g. it explained a
        // limitation). Surface its note as a normal reply instead of an error.
        if (fileCount === 0) {
          send({
            type: "done",
            note: parser.getReply() || "ไม่มีไฟล์ที่ต้องเปลี่ยน — ลองอธิบายสิ่งที่อยากได้ให้ชัดขึ้นได้ครับ",
            deleted: [],
          });
          controller.close();
          return;
        }

        // Inject canonical build config so the project always runs: package.json
        // (preserving user-installed extra deps on iteration + any the build asked
        // for via <deps>) + vite.config.js.
        const extra = iteration ? extraDepsOf(body.previousFiles?.["package.json"]) : {};
        for (const name of wantedDeps) extra[name] = "latest";
        send({ type: "file", path: "package.json", content: packageJsonWithDeps(extra) });
        if (!iteration) {
          send({ type: "file", path: "vite.config.js", content: VITE_CONFIG });
          send({ type: "file", path: "tsconfig.json", content: TSCONFIG });
        }

        send({
          type: "done",
          note: parser.getReply() || (iteration ? "แก้ไขเรียบร้อยแล้ว" : "สร้าง demo เรียบร้อยแล้ว"),
          deleted,
        });
        controller.close();
      } catch (error) {
        const message =
          error instanceof MissingApiKeyError
            ? error.message
            : error instanceof Error && error.name === "TimeoutError"
              ? "AI ใช้เวลานานเกินไป กรุณาลองใหม่"
              : "สร้างไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";
        console.error("[generate] failed:", error);
        send({ type: "error", message });
        controller.close();
      }
    },
    cancel() {
      // Client aborted (Escape key) — nothing to clean up beyond the stream.
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
