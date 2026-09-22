import { after } from "next/server";
import { z } from "zod";
import { DOC_MAX_CHARS, MESSAGE_MAX_CHARS, REPLY_MAX_CHARS } from "@/lib/limits";
import { getAgentForPhase } from "@/lib/agents/registry";
import { AgentStreamFilter } from "@/lib/agent-stream";
import { currentUserId, recordUsage } from "@/lib/ai-usage";
import { MissingApiKeyError, streamParts, type TokenUsage } from "@/lib/gemini";
import { isBuildPhase, isPhaseId, type PhaseId } from "@/lib/phases";
import { DOC_PATHS } from "@/lib/define";
import { buildAgentSystemPrompt } from "@/lib/prompts";
import { getProjectOrgDnaContext } from "@/lib/org-context";
import { resolveSkill } from "@/lib/skills/db";
import { createClient } from "@/lib/supabase/server";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import type { AgentEvent, DocKind } from "@/lib/types";

export const maxDuration = 300;

/**
 * gemini-3.8-flash caps output at 65,536 tokens and streams at roughly 290 of
 * them per second, so a 55-second budget could only ever reach about a quarter
 * of what the model can write — a long PRD died as "AI ใช้เวลานานเกินไป" with the
 * half-written document thrown away. 240s covers the full ceiling with room to
 * spare, and matches what /api/generate already runs at.
 */
const ATTEMPT_TIMEOUT_MS = 240_000;

/** How often a running turn refreshes its draft — same cadence as the build route. */
const DRAFT_INTERVAL_MS = 5_000;

/**
 * Phases that rewrite a whole specification get the model's top reasoning tier.
 * The interview phases stay on the default so a question still comes back fast.
 */
const DEEP_PHASES = new Set<PhaseId>(["plan", "review"]);

const DOC_KINDS = ["idea", "brd", "prd", "verify", "review", "ship"] as const;

const bodySchema = z.object({
  phase: z.string().refine(isPhaseId, "unknown phase"),
  // Split by role on purpose: MESSAGE_MAX_CHARS bounds what a PERSON typed,
  // REPLY_MAX_CHARS bounds what we generated. One 22,777-character reply under a
  // shared 20k cap 400'd every following turn of that phase, permanently.
  // `phase` is optional so a client still running the previous bundle — which
  // pre-filtered to one phase and sent no phase field — keeps working unchanged.
  messages: z
    .array(
      z.discriminatedUnion("role", [
        z.object({
          role: z.literal("user"),
          content: z.string().max(MESSAGE_MAX_CHARS),
          phase: z.string().optional(),
        }),
        z.object({
          role: z.literal("assistant"),
          content: z.string().max(REPLY_MAX_CHARS),
          phase: z.string().optional(),
        }),
      ])
    )
    .max(400),
  // partialRecord: the client sends only the docs that exist so far (often none
  // on the first turn). z.record with an enum key is exhaustive in Zod v4 and
  // would reject any partial set — including {} — which 400s every agent call.
  docs: z.partialRecord(z.enum(DOC_KINDS), z.string().max(DOC_MAX_CHARS)).optional(),
  skillId: z.string().max(40).optional(),
  express: z.boolean().optional(),
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

function sse(event: AgentEvent): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`);
}

export async function POST(request: Request) {
  const limit = await rateLimit(`agent:${clientIp(request)}`);
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

  // The Build phase produces code, not a markdown doc — that path is /api/generate.
  if (isBuildPhase(body.phase)) {
    return Response.json(
      { error: "เฟส Build ใช้ /api/generate" },
      { status: 400 }
    );
  }

  // Authorize projectId against the caller before deriving Org DNA context from
  // it (getProjectOrgDnaContext reads with the RLS-bypassing admin client). The
  // specialist here is resolved by skillId only (resolveSkill), not projectId, so
  // only the Org DNA path needs the guard. An inaccessible project → context off.
  let ctxProjectId: string | null = null;
  if (body.projectId) {
    const supabase = await createClient();
    const { data: accessible } = await supabase
      .from("fittbuilder_projects")
      .select("id")
      .eq("id", body.projectId)
      .maybeSingle();
    if (accessible) ctxProjectId = body.projectId;
  }

  const agent = await getAgentForPhase(body.phase);
  const baseSystem = buildAgentSystemPrompt(
    agent.body,
    body.docs ?? {},
    await resolveSkill(body.skillId),
    body.express
  );
  // Workspace Org DNA as context so the interview/docs fit the org's reality.
  const orgCtx = ctxProjectId ? await getProjectOrgDnaContext(ctxProjectId) : "";
  // Treat the DNA as already-known facts: don't re-ask what it (or the user's own
  // messages) already answers, and never open with generic org/business questions.
  const useDnaRule = orgCtx
    ? '\n\nสำคัญมาก: ORG DNA ข้างบนคือสิ่งที่ "รู้แล้ว" เกี่ยวกับองค์กรของผู้ใช้ — ห้ามถามซ้ำในสิ่งที่อนุมานได้จากข้อมูลนี้ (ลักษณะองค์กร โครงสร้าง สิทธิ์การตัดสินใจ การไหลของข้อมูล วิธีทำงาน วัฒนธรรม) และห้ามเปิดบทสนทนาด้วยคำถามพื้นฐานทั่วๆ ไป เช่น "ธุรกิจของคุณทำเกี่ยวกับอะไร" ถ้าตอบได้จาก DNA หรือจากสิ่งที่ผู้ใช้พิมพ์มาแล้ว ให้ทักทายสั้นๆ โดยพาดพิงสิ่งที่รู้จาก DNA/บริบท แล้วข้ามไปถามเฉพาะรายละเอียดเฉพาะของระบบที่จะสร้างซึ่ง DNA ยังไม่ครอบคลุม (เช่น ฟีเจอร์/หน้าจอ/ข้อมูลที่ต้องแสดง/บทบาทผู้ใช้ของระบบนี้)'
    : "";
  const citeRule = orgCtx
    ? '\n\nเมื่อคุณใช้ข้อมูลจาก ORG DNA ข้างต้นในการตอบ/สร้างเอกสาร ให้ปิดท้ายข้อความด้วยบล็อกอ้างอิงหนึ่งบรรทัด:\n```cite\n{"aspects":["structure","decisionRights"]}\n```\nโดย aspects เลือกจาก [decisionRights, information, motivators, structure, archetype] เฉพาะด้านที่ใช้จริง (ถ้าไม่ได้ใช้ Org DNA เลย ไม่ต้องใส่บล็อกนี้)'
    : "";
  const system = orgCtx ? `${baseSystem}\n\n${orgCtx}${useDnaRule}${citeRule}` : baseSystem;
  // Each agent used to see only its own phase's turns — a sensible economy when
  // the context window was small. At 1,048,576 input tokens it is just blindness:
  // the spec-writer wrote a PRD without ever reading the interview its BRD was
  // distilled from. Earlier phases now ride along as reference, while the current
  // phase stays the live conversation.
  const speak = (m: { role: string; content: string }) =>
    `${m.role === "user" ? "ผู้ใช้" : "FITT"}: ${m.content}`;
  const prior = body.messages.filter((m) => m.phase && m.phase !== body.phase);
  const current = body.messages.filter((m) => !m.phase || m.phase === body.phase);
  const priorBlock = prior.length
    ? `บทสนทนาจากเฟสก่อนหน้า (บริบทอ้างอิงเท่านั้น — ห้ามตอบซ้ำ ใช้เพื่อเข้าใจที่มาและรายละเอียดที่เอกสารสรุปอาจตกหล่น):\n\n${prior
        .map(speak)
        .join("\n\n")}\n\n---\n\nบทสนทนาของเฟสปัจจุบัน:\n\n`
    : "";
  let user =
    priorBlock +
    (current.map(speak).join("\n\n") ||
      (body.express
        ? "(สร้างเอกสารของเฟสนี้จาก brief และเอกสารก่อนหน้าให้สมบูรณ์ในครั้งเดียว)"
        : "(เริ่มบทสนทนา — ทักทายสั้นๆ แล้วเริ่มงานของเฟสนี้)"));
  if (body.attachments?.length) {
    // Express is one-shot (no back-and-forth), so "ask before adding" would
    // stall the pipeline — pull the attachment content into the doc directly.
    user += body.express
      ? "\n\n(ผู้ใช้แนบไฟล์/รูปอ้างอิงมาด้วย — อ่านเนื้อหาแล้วดึงส่วนที่เกี่ยวข้อง เช่น requirement, หน้าจอ, โครงสร้างข้อมูล ไปใช้ในเอกสารของเฟสนี้ได้เลย)"
      : "\n\n(ผู้ใช้แนบไฟล์/รูปอ้างอิงมาด้วย — อ่านแล้วสรุปสั้นๆ ว่ามันเกี่ยวข้องกับโปรเจกต์นี้อย่างไร" +
        " ถ้ามีส่วนที่ควรเพิ่มลงในเอกสาร BRD/PRD ให้ถามผู้ใช้ก่อนว่าจะเพิ่มเข้าไปไหม แล้วค่อยอัปเดตเมื่อผู้ใช้ตกลง)";
  }

  /** What the user asked, for the recovery dialog to show alongside the draft. */
  const lastUserMessage =
    [...body.messages].reverse().find((m) => m.role === "user")?.content ?? "";

  let usage: TokenUsage | null = null;
  const userId = await currentUserId();
  // Built here, not inside the stream: createClient() reads cookies(), which
  // Next forbids once the response has been handed off.
  const db = ctxProjectId ? await createClient() : null;
  after(() =>
    void recordUsage({ userId, projectId: ctxProjectId, kind: "agent", usage })
  );

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      /**
       * A document turn used to die with its tab.
       *
       * The model call was tied to request.signal, so a closed tab or a dropped
       * connection aborted it — a PRD the server had already paid to write was
       * thrown away, and the studio meanwhile said "กำลังสร้างเบื้องหลัง… จะอัปเดต
       * ให้เมื่อเสร็จ" about a turn that would never finish. The build route
       * solved this long ago; this one never got the same treatment.
       *
       * So: the call runs to completion whether or not anyone is listening, the
       * enqueue is guarded because the controller is closed once they are not,
       * and the documents are parked as they are produced.
       */
      let closed = false;
      const send = (event: AgentEvent) => {
        if (closed) return;
        try {
          controller.enqueue(sse(event));
        } catch {
          closed = true;
        }
      };

      /**
       * Park what this turn has written where a returning browser finds it.
       *
       * Documents ARE files — docs/BRD.md and friends — so they ride the same
       * draft row the build route uses, and the studio's existing poller and
       * apply path take them without knowing which route produced them.
       */
      const parkDocs = async (docs: Record<string, string>, complete: boolean) => {
        if (!ctxProjectId || !db || Object.keys(docs).length === 0) return;
        try {
          await db.from("fittbuilder_project_drafts").upsert(
            {
              project_id: ctxProjectId,
              files: docs,
              prompt: lastUserMessage,
              updated_at: new Date().toISOString(),
              updated_by: userId,
              complete,
            },
            { onConflict: "project_id" }
          );
        } catch (e) {
          // Losing a checkpoint must never take the turn down with it.
          console.error("[agent] draft checkpoint failed:", e);
        }
      };

      /** A doc map addressed the way the project stores its files. */
      const asFiles = (docs: Partial<Record<DocKind, string>>): Record<string, string> => {
        const out: Record<string, string> = {};
        for (const [kind, text] of Object.entries(docs)) {
          if (text) out[DOC_PATHS[kind as DocKind]] = text;
        }
        return out;
      };

      const filter = new AgentStreamFilter();
      let lastPark = 0;
      try {
        for await (const part of streamParts({
          system,
          user,
          attachments: body.attachments,
          level: body.express || DEEP_PHASES.has(body.phase) ? "high" : "medium",
          thinking: true,
          abortSignal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
          onUsage: (u) => {
            usage = u;
          },
        })) {
          if (part.thought) {
            send({ type: "thought", content: part.text });
            continue;
          }
          const { text, actions } = filter.push(part.text);
          if (text) send({ type: "text", content: text });
          for (const a of actions) send({ type: "action", icon: a.icon, label: a.label });
          // Heartbeat: the timestamp is what tells a live turn from a dead one,
          // so it must keep moving even while the model is still writing.
          if (Date.now() - lastPark >= DRAFT_INTERVAL_MS) {
            lastPark = Date.now();
            await parkDocs(asFiles(filter.peekDocs()), false);
          }
        }
        const turn = filter.getTurn();
        // The completed set goes down BEFORE `done`, so a browser that takes the
        // result never races the server's last write.
        await parkDocs(asFiles(turn.docs), true);
        send({ type: "done", turn });
      } catch (error) {
        const message =
          error instanceof MissingApiKeyError
            ? error.message
            : error instanceof Error && error.name === "TimeoutError"
              ? "AI ใช้เวลานานเกินไป กรุณาลองใหม่"
              : "ตัวแทน AI สะดุด กรุณาส่งข้อความอีกครั้ง";
        console.error("[agent] failed:", error);
        send({ type: "error", message });
      } finally {
        if (!closed) {
          closed = true;
          try {
            controller.close();
          } catch {
            // already closed by the client — nothing to do
          }
        }
      }
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
