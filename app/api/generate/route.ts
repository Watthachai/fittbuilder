import { after } from "next/server";
import { z } from "zod";
import { DOC_MAX_CHARS, MESSAGE_MAX_CHARS, TURN_PROMPT_MAX_CHARS } from "@/lib/limits";
import {
  blockedAssets,
  blockedAssetsNote,
  externalAssetUrls,
  proxiedAssetsNote,
  routeBlockedThroughProxy,
} from "@/lib/asset-check";
import { publicSiteUrl } from "@/lib/origin";
import { getAgent } from "@/lib/agents/registry";
import { buildSpecContext } from "@/lib/context-builder";
import { currentUserId, recordUsage } from "@/lib/ai-usage";
import { isSafePath, normalizePath, sanitizeCss } from "@/lib/files";
import {
  extraDepsOf,
  newPackages,
  packageJsonWithDeps,
  TSCONFIG,
  VITE_CONFIG,
} from "@/lib/scaffold";
import { FileStreamParser, salvageJsonFiles } from "@/lib/stream-parse";
import { MissingApiKeyError, streamParts, type TokenUsage } from "@/lib/gemini";
import {
  buildGenerationSystemPrompt,
  buildIterationSystemPrompt,
  buildIterationUserPrompt,
  buildShellPrompt,
} from "@/lib/prompts";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { PRESET_IDS } from "@/lib/presets";
import { KIT_SOURCES } from "@/lib/modules/sources";
import { fixKitImports, kitOf } from "@/lib/kit-imports";
import { contextFor, namedIn, overBudget } from "@/lib/iteration-context";
import { pickFiles } from "@/lib/pick-files";
import { getProjectOrgDnaContext } from "@/lib/org-context";
import { resolveSkillForProject } from "@/lib/skills/org-resolve";
import { createClient } from "@/lib/supabase/server";
import type { GenerateEvent } from "@/lib/types";
import { TURN_CUT_LABEL, type TurnCut } from "@/lib/tasks";
import { missingDefaultExports } from "@/lib/default-exports";
import { outcomeOf, type RecordedTurn } from "@/lib/generate-outcome";

// Generation streams file-by-file, so a longer single pass is fine — partial
// output is still written live, and there's no all-or-nothing JSON parse.
// 900s is Cloud Run's request timeout (`--timeout` in cloudbuild.*.yaml), the
// cap that actually ends the request; this states it for the build output.
export const maxDuration = 900;

/**
 * One pass of the model. It was 240s, and on large projects (prompts of 300k+
 * tokens) about one turn in six ran into it: median turns took ~2 minutes and
 * the slow tail sat right at the cap, so the clock — not the work — decided
 * where a turn ended. 540s leaves the shell retry and the 60s margin below
 * inside Cloud Run's 900s.
 */
const ATTEMPT_TIMEOUT_MS = 540_000;

/**
 * The wall clock the whole route has, kept under maxDuration so the shell
 * retry below can still answer instead of being cut off mid-write.
 */
const DEADLINE_MS = 840_000;

/** How often the server parks what it has produced. Mirrors the studio's own
 *  cadence — see DRAFT_INTERVAL_MS in Studio.tsx. */
const DRAFT_INTERVAL_MS = 5_000;

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
  prompt: z.string().trim().min(1).max(TURN_PROMPT_MAX_CHARS),
  /** The user's own words that started the project, carried through verbatim. */
  brief: z.string().max(MESSAGE_MAX_CHARS).optional(),
  previousFiles: z.record(z.string().max(200), z.string().max(200_000)).optional(),
  iterationMode: z.boolean().optional(),
  brd: z.string().max(DOC_MAX_CHARS).optional(),
  prd: z.string().max(DOC_MAX_CHARS).optional(),
  presetId: z
    .string()
    .refine((id) => PRESET_IDS.includes(id) || id === "other")
    .optional(),
  presetAnswers: z
    .record(z.string(), z.union([z.string().max(2_000), z.array(z.string().max(500)).max(20)]))
    .optional(),
  skillId: z.string().max(40).optional(),
  projectId: z.string().uuid().optional(),
  attachments: z
    .array(
      z.object({
        name: z.string().max(200),
        mimeType: z.string().max(120),
        data: z.string().max(8_000_000),
      })
    )
    .max(5)
    .optional(),
});

function sse(event: GenerateEvent): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`);
}

export async function POST(request: Request) {
  const limit = await rateLimit(`generate:${clientIp(request)}`);
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


  const userId = await currentUserId();

  // Authorize projectId against the caller BEFORE using it for context lookups
  // that read with the RLS-bypassing admin client (specialist + Org DNA). Without
  // this, a caller could pass a victim's projectId and fold that org's specialist
  // and Org DNA into their own generation. The user-scoped client enforces RLS;
  // an inaccessible project is treated as absent (context off), never a 500.
  let ctxProjectId: string | null = null;
  /**
   * Built HERE, while the request context still exists, and reused for the rest
   * of the turn.
   *
   * createClient() reads cookies(), and Next forbids that once the response has
   * been handed off — a client created later inside the stream throws "used
   * cookies() inside after()". Every server-side checkpoint failed silently that
   * way, including the final one, so a turn whose tab closed left a partial
   * draft and nothing else. Create the client once; the token it captured is
   * good for the life of the turn.
   */
  let db: Awaited<ReturnType<typeof createClient>> | null = null;
  if (body.projectId) {
    db = await createClient();
    const { data: accessible } = await db
      .from("fittbuilder_projects")
      .select("id")
      .eq("id", body.projectId)
      .maybeSingle();
    if (accessible) ctxProjectId = body.projectId;
  }

  const iteration = Boolean(body.iterationMode && body.previousFiles);
  // The code-builder SKILL.md body is the Build-phase persona; fall back to the
  // built-in default if the file is unreadable so generation still works.
  const persona = (await getAgent("code-builder").catch(() => null))?.body;
  const skill = await resolveSkillForProject(body.skillId, ctxProjectId);
  /**
   * A back-office build starts with the studio's own kit already in the project.
   *
   * First builds only: an edit turn finds the kit among the files it is sent,
   * and re-shipping it would overwrite whatever that project has done to it.
   */
  const kit = !iteration && skill?.kit ? KIT_SOURCES : undefined;
  /** The kit's files are this turn's to write, not the model's. */
  const shipped = (path: string) => kit !== undefined && path in kit;
  /** The kit this project has: shipped this turn, or already in the project on an edit. */
  const kitFiles = kitOf(kit ?? body.previousFiles ?? {});
  /** A model file as the project receives it. */
  const prepare = (path: string, content: string) => {
    if (path.endsWith(".css")) return sanitizeCss(content);
    const fixed = fixKitImports(path, content, kitFiles);
    if (fixed !== content) console.info(`[generate] moved kit imports to the file that exports them in ${path}`);
    return fixed;
  };
  const baseSystem = iteration
    ? buildIterationSystemPrompt(persona)
    : buildGenerationSystemPrompt(
        buildSpecContext({
          brief: body.brief,
          brd: body.brd,
          prd: body.prd,
          presetId: body.presetId,
          answers: body.presetAnswers,
        }),
        persona,
        skill,
        kit
      );
  // Workspace Org DNA shapes the build (flow/structure/roles) when present.
  const orgCtx = ctxProjectId ? await getProjectOrgDnaContext(ctxProjectId) : "";
  const system = orgCtx ? `${baseSystem}\n\n${orgCtx}` : baseSystem;
  const attachmentNote = body.attachments?.length
    ? "\n\n(ผู้ใช้แนบรูป/ไฟล์อ้างอิงมาด้วย เช่น ภาพหน้าจอ prototype — ดูประกอบแล้วทำตามที่ผู้ใช้ขอ" +
      " โดยให้เข้ากับโครงสร้างและสไตล์ของโปรเจกต์ปัจจุบัน)"
    : "";
  /**
   * What the model is asked. An edit carries the project's files: all of them,
   * or — past the context budget — the ones this request needs (lib/iteration-context).
   */
  const buildUser = async (status: (message: string) => void) => {
    if (!iteration) return body.prompt + attachmentNote;
    const files = body.previousFiles!;
    if (!overBudget(files)) return buildIterationUserPrompt(body.prompt, files, []) + attachmentNote;
    status("โปรเจกต์ใหญ่ — เลือกไฟล์ที่เกี่ยวกับคำสั่งนี้ก่อนแก้");
    const wanted = [...namedIn(body.prompt, Object.keys(files)), ...(await pickFiles(body.prompt, files))];
    const { shown, omitted } = contextFor(files, wanted);
    console.info(`[generate] large project: showing ${Object.keys(shown).length} of ${Object.keys(files).length} files`);
    return buildIterationUserPrompt(body.prompt, shown, omitted) + attachmentNote;
  };

  let usage: TokenUsage | null = null;
  // How the turn ended and how long it ran: what the admin report counts cut
  // and failed builds from. Set where the turn ends, read once the response is done.
  let turn: RecordedTurn | null = null;
  after(() =>
    void recordUsage({ userId, projectId: ctxProjectId, kind: "generate", usage, turn })
  );

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // Once the client disconnects (navigation, Escape, or a superseded
      // request), the controller is closed and any further enqueue throws
      // ERR_INVALID_STATE. Guard enqueue + close so a disconnect ends the turn
      // quietly instead of crashing the route with "Controller is already
      // closed" — the model stream just drains to nothing until the timeout.
      let closed = false;

      /**
       * Everything this turn has produced, kept server-side.
       *
       * The model call is deliberately NOT tied to request.signal — it runs to
       * completion whether or not anyone is still listening. Until now nobody
       * wrote that down: the browser was the only writer, so closing the tab
       * threw away work the server had already paid for and finished.
       *
       * Recorded BEFORE the `closed` guard on purpose. Once the client is gone
       * there is nothing to enqueue, and that is exactly when this matters.
       *
       * This is a DELTA, not a project: on an iteration the model re-sends only
       * what it changed. Recovery merges it over the current files rather than
       * replacing them (see DraftRecovery in Studio) — seeding it with the whole
       * project instead would put the entire file map on the wire at every
       * checkpoint, for nothing.
       */
      const produced: Record<string, string> = {};
      let lastPark = 0;
      /**
       * Park the turn's output where a returning browser will pick it up.
       *
       * `complete` is what separates "this finished while you were away" from
       * "the server died mid-turn" — set only by the final call, after the
       * canonical build files are in and before `done` goes out.
       */
      const parkDraft = async (complete = false) => {
        if (!ctxProjectId || !db) return;
        try {
          await db.from("fittbuilder_project_drafts").upsert(
            {
              project_id: ctxProjectId,
              files: produced,
              prompt: body.prompt,
              updated_at: new Date().toISOString(),
              updated_by: userId,
              complete,
            },
            { onConflict: "project_id" }
          );
        } catch (e) {
          // Losing a checkpoint must never take the generation down with it.
          console.error("[generate] draft checkpoint failed:", e);
        }
      };

      const send = (event: GenerateEvent) => {
        if (event.type === "file") produced[event.path] = event.content;
        else if (event.type === "delete") delete produced[event.path];
        if (closed) return;
        try {
          controller.enqueue(sse(event));
        } catch {
          closed = true;
        }
      };
      const close = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          // already closed by the client — nothing to do
        }
      };
      const parser = new FileStreamParser();
      let fileCount = 0;
      const deleted: string[] = [];
      // Extra packages already in the project (installed on an earlier turn or
      // from the package UI) — the base for this turn's package.json AND the
      // filter that keeps a re-declared package from triggering a reinstall.
      const extra = iteration ? extraDepsOf(body.previousFiles?.["package.json"]) : {};
      const startedAt = Date.now();
      const wantedDeps = new Set<string>();

      try {
        // Before the model's first file, so every page it writes imports
        // something that is already there and the live preview never breaks on
        // a missing kit.
        if (kit) {
          send({ type: "status", message: "เริ่มจากชุดหน้าจอเดียวกับระบบ HR ของสตูดิโอ" });
          for (const [path, content] of Object.entries(kit)) send({ type: "file", path, content });
        }

        const user = await buildUser((message) => send({ type: "status", message }));
        const abort = AbortSignal.timeout(ATTEMPT_TIMEOUT_MS);
        // Why the turn stopped before the model said it was done, if it did.
        // Partial output is still kept below; this is what stops the chat from
        // calling it "เรียบร้อย" and lets the studio carry on from where it cut.
        // `as`: assigned inside a callback, which TypeScript's narrowing cannot see.
        let cut = null as TurnCut | null;
        try {
          for await (const part of streamParts({
            system,
            user,
            attachments: body.attachments,
            thinking: true,
            abortSignal: abort,
            level: "medium",
            onUsage: (u) => {
              usage = u;
            },
            onFinish: (reason) => {
              if (reason === "MAX_TOKENS") cut = "tokens";
            },
          })) {
            if (part.thought) {
              send({ type: "thought", content: part.text });
              continue;
            }
            const { files, deletes, deps } = parser.push(part.text);
            for (const file of files) {
              const path = normalizePath(file.path);
              if (RESERVED_PATHS.has(path) || !isSafePath(path) || shipped(path)) continue;
              fileCount++;
              send({ type: "file", path, content: prepare(path, file.content) });
            }
            for (const target of deletes) {
              const path = normalizePath(target);
              if (RESERVED_PATHS.has(path) || !isSafePath(path) || shipped(path)) continue;
              deleted.push(path);
              send({ type: "delete", path });
            }
            const fresh = newPackages(deps.filter(isValidPackageName), extra).filter(
              (d) => !wantedDeps.has(d)
            );
            for (const d of fresh) wantedDeps.add(d);
            if (fresh.length) send({ type: "deps", packages: fresh });
            // Fire and forget mid-stream: a checkpoint that is one file behind
            // is worth far more than a generation that waits on the database.
            if (Date.now() - lastPark >= DRAFT_INTERVAL_MS) {
              lastPark = Date.now();
              void parkDraft();
            }
          }
        } catch (streamError) {
          // Partial output is usable (files were already streamed/written live);
          // only a total failure (nothing produced) is a hard error.
          if (fileCount === 0) throw streamError;
          // Our own deadline, read from our own signal: the SDK surfaces an abort
          // under whatever name it likes, and a build cut by the clock was being
          // reported as "การเชื่อมต่อกับ AI หลุดกลางทาง" (Central Home, 8 Oct).
          cut = abort.aborted ? "time" : "error";
          console.error("[generate] stream ended early, using partial output:", streamError);
        }
        if (cut) {
          console.warn(
            `[generate] turn cut (${cut}) after ${fileCount} file(s) in ${Math.round((Date.now() - startedAt) / 1000)}s`
          );
        }

        // No <file> block streamed. Before treating that as "nothing to change",
        // check for a JSON payload: a model that drifts to the old JSON contract
        // did the work but in the wrong envelope, and dropping it would report
        // success while the project stays untouched. `fromJson` then redirects
        // the chat note, since the parser's "reply" is the raw JSON blob.
        let fromJson = false;
        let salvagedNote = "";
        if (fileCount === 0) {
          const salvaged = salvageJsonFiles(parser.getReply());
          if (salvaged) {
            fromJson = true;
            console.warn(
              `[generate] model replied in JSON, not <file> blocks — salvaged ${salvaged.files.length} file(s), ${salvaged.deletes.length} delete(s)`
            );
            salvagedNote = salvaged.note;
            for (const file of salvaged.files) {
              const path = normalizePath(file.path);
              if (RESERVED_PATHS.has(path) || !isSafePath(path) || shipped(path)) continue;
              fileCount++;
              send({ type: "file", path, content: prepare(path, file.content) });
            }
            for (const target of salvaged.deletes) {
              const path = normalizePath(target);
              if (RESERVED_PATHS.has(path) || !isSafePath(path) || shipped(path)) continue;
              deleted.push(path);
              send({ type: "delete", path });
            }
          }
        }

        // The model answered without emitting any files (e.g. it explained a
        // limitation). Surface its note as a normal reply instead of an error.
        if (fileCount === 0) {
          send({
            type: "done",
            // Cut before the first file: the model spent the turn thinking, which
            // is not the same thing as there being nothing to change.
            note: cut
              ? `ยังไม่ได้แก้ไฟล์ — AI หยุดกลางทางเพราะ${TURN_CUT_LABEL[cut]}`
              : parser.getReply() || "ไม่มีไฟล์ที่ต้องเปลี่ยน — ลองอธิบายสิ่งที่อยากได้ให้ชัดขึ้นได้ครับ",
            deleted: [],
            cut,
          });
          close();
          return;
        }

        // Inject canonical build config so the project always runs: package.json
        // (preserving user-installed extra deps on iteration + any the build asked
        // for via <deps>) + vite.config.js.
        for (const name of wantedDeps) extra[name] = "latest";
        send({ type: "file", path: "package.json", content: packageJsonWithDeps(extra) });
        if (!iteration) {
          send({ type: "file", path: "vite.config.js", content: VITE_CONFIG });
          send({ type: "file", path: "tsconfig.json", content: TSCONFIG });
        }

        // Remote assets the preview would drop: routed through our relay where we
        // can, named where we cannot. Runs BEFORE the final park so the parked
        // copy holds the same URLs the browser was just sent — parking first
        // would file the pre-rewrite text as the turn's result. Best-effort: a
        // check that fails must not cost the turn its reply.
        let assetNote = "";
        try {
          const blocked = await blockedAssets(externalAssetUrls(produced));
          const siteUrl = publicSiteUrl(request);
          if (blocked.length > 0 && siteUrl) {
            const { files: rewritten, changed } = routeBlockedThroughProxy(produced, blocked, siteUrl);
            for (const path of changed) {
              // The client keys by path, so this replaces what it already
              // applied rather than adding to it.
              produced[path] = rewritten[path];
              send({ type: "file", path, content: rewritten[path] });
            }
            assetNote = proxiedAssetsNote(blocked);
          } else {
            assetNote = blockedAssetsNote(blocked);
          }
        } catch {
          assetNote = "";
        }

        // AWAITED, and before `done`: the browser clears the draft once it has
        // saved the finished files, so this write has to land first or the two
        // race and a completed turn leaves a stale draft behind (or worse, the
        // complete set is written after the clear and offered back as if it
        // were unfinished).
        /**
         * A first build that wrote screens but no shell has not built anything.
         *
         * The structure rule asks for App.tsx LAST so the preview keeps
         * compiling while the rest streams — which also makes the one file
         * without which nothing renders the one most exposed to a truncated
         * turn. Seen live on 22 Sep 2026: twenty pages and components written,
         * no src/App.tsx, the turn reported "สร้างระบบเรียบร้อยแล้ว", and the
         * preview went on serving the scaffold's placeholder because its App.tsx
         * was still the one on disk. Nothing in the pipeline disagreed.
         *
         * Iterations are exempt: they legitimately touch a page and leave the
         * shell alone.
         */
        // The kit sits under src/components/ from the first millisecond, so it
        // cannot count as the model having written anything.
        const wroteScreens = Object.keys(produced).some(
          (path) => !shipped(path) && (path.startsWith("src/pages/") || path.startsWith("src/components/"))
        );
        let shellGap = (["src/App.tsx", "src/main.tsx"] as const).filter(
          (f) => !produced[f]
        ) as string[];

        /**
         * Finish the job rather than hand it back.
         *
         * A first build that wrote the screens and stopped before its entry
         * files has not produced an app, and the reason is almost always the
         * output ceiling — the structure rule puts these two last, so they are
         * what a long build runs out of room for. Asking the user to press a
         * button is asking them to pay for our own truncation.
         *
         * The retry cannot fail the same way: it is two small files written
         * against a tree that already exists, a fraction of the turn that just
         * ran. It is capped by whatever wall clock is left under maxDuration,
         * and if it still comes back short the honest note below stands.
         */
        if (!iteration && wroteScreens && shellGap.length > 0) {
          const left = DEADLINE_MS - (Date.now() - startedAt);
          if (left > 20_000) {
            send({ type: "status", message: `เขียนไฟล์หลักที่ยังขาด: ${shellGap.join(", ")}` });
            const shellParser = new FileStreamParser();
            try {
              for await (const part of streamParts({
                system,
                user: buildShellPrompt(shellGap, produced),
                thinking: false,
                abortSignal: AbortSignal.timeout(Math.min(left - 5_000, 90_000)),
                level: "medium",
                onUsage: (u) => {
                  usage = u;
                },
              })) {
                if (part.thought) continue;
                for (const file of shellParser.push(part.text).files) {
                  const path = normalizePath(file.path);
                  // Only the two that are missing: a second pass that starts
                  // rewriting pages is the failure this exists to avoid.
                  if (!shellGap.includes(path)) continue;
                  fileCount++;
                  send({ type: "file", path, content: file.content });
                }
              }
            } catch (shellError) {
              console.error("[generate] shell retry failed:", shellError);
            }
            shellGap = shellGap.filter((f) => !produced[f]);
          }
        }

        // A page imported as a default that only exports its name is a white
        // screen (lib/default-exports). Checked against the whole project once
        // every file is in — the importer and the page are rarely written
        // together, and the shell retry above may be what wrote App.tsx.
        const project: Record<string, string> = { ...(iteration ? body.previousFiles ?? {} : {}), ...produced };
        for (const path of deleted) delete project[path];
        for (const [path, content] of Object.entries(missingDefaultExports(project))) {
          console.info(`[generate] added the default export that ${path}'s importers expect`);
          send({ type: "file", path, content });
        }

        // One park marks completeness, and it lands after every file this turn
        // will ever produce — including the retry's.
        await parkDraft(true);

        const shellMissing = !iteration && wroteScreens && shellGap.length > 0;

        turn = { outcome: outcomeOf(cut), durationMs: Date.now() - startedAt, error: null };
        send({
          type: "done",
          note: shellMissing
            ? `เขียนหน้าจอและคอมโพเนนต์ครบแล้ว แต่ยังไม่ได้เขียน ${shellGap.join(" และ ")} ` +
              "ซึ่งเป็นไฟล์ที่ประกอบทุกอย่างเข้าด้วยกันและเป็นจุดเริ่มของแอป " +
              "หน้าตัวอย่างจึงยังไม่ใช่สิ่งที่เพิ่งสร้าง กดปุ่มในหน้าตัวอย่างเพื่อให้เขียนสองไฟล์นี้ให้ครบ" +
              assetNote
            : cut
              ? // Never "เรียบร้อย" for a turn that stopped half way — that line is
                // what had people sending the same ten-item message again and again.
                `ยังไม่ครบ — AI หยุดกลางทางเพราะ${TURN_CUT_LABEL[cut]} เขียนไปได้ ${fileCount} ไฟล์` +
                (parser.getReply() ? `\n\n${parser.getReply()}` : "") +
                assetNote
              : ((fromJson ? salvagedNote : parser.getReply()) ||
                  (iteration ? "แก้ไขเรียบร้อยแล้ว" : "สร้างระบบเรียบร้อยแล้ว")) + assetNote,
          deleted,
          cut,
        });
        close();
      } catch (error) {
        const message =
          error instanceof MissingApiKeyError
            ? error.message
            : error instanceof Error && error.name === "TimeoutError"
              ? "AI ใช้เวลานานเกินไป กรุณาลองใหม่"
              : "สร้างไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";
        console.error("[generate] failed:", error);
        turn = {
          outcome: "failed",
          durationMs: Date.now() - startedAt,
          error: (error instanceof Error ? error.message : String(error)).slice(0, 500),
        };
        send({ type: "error", message });
        close();
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
