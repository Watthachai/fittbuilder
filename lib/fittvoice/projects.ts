import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import { authenticate } from "./authenticate";
import type { BindingRow } from "./connection-store";
import { HTTP_STATUS, errorBody } from "./delivery";
import type { ErrorCode } from "./types";

/**
 * The projects a FITT Voice sender may send a meeting into (contract v2.1,
 * 2.2): GET /projects to search, GET /projects/{id} to check one before a send
 * or a retry. Only the connection's workspace, only what the person may read,
 * with canWrite as Builder will judge it on delivery. Both answer in error v2.
 */

/** Searching runs as the user types, so it is counted apart from deliveries. */
const READS_PER_MINUTE = 120;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 50;
const MAX_QUERY = 200;

export interface ProjectItem {
  builderProjectId: string;
  name: string;
  workspaceId: string;
  canWrite: boolean;
  updatedAt: string;
  meetingCount: number;
}

/** Where the next page starts: the last item's exact updated_at and id. */
interface After {
  at: string;
  id: string;
}

export const encodeCursor = (after: After) => Buffer.from(JSON.stringify(after), "utf8").toString("base64url");

export function decodeCursor(cursor: string): After | null {
  try {
    const v = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as Partial<After>;
    if (typeof v.at !== "string" || Number.isNaN(Date.parse(v.at))) return null;
    if (typeof v.id !== "string" || !UUID.test(v.id)) return null;
    return { at: v.at, id: v.id };
  } catch {
    return null;
  }
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** An ILIKE pattern that finds `query` anywhere in the name, its own % _ \ taken literally. */
export const likePattern = (query: string) => `%${query.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

export type SearchParams = { ok: true; pattern: string | null; limit: number; after: After | null } | { ok: false; message: string };

/** ?query=&cursor=&limit= — each at most once. */
export function readSearch(params: URLSearchParams): SearchParams {
  for (const k of new Set(params.keys())) {
    if (params.getAll(k).length > 1) return { ok: false, message: `${k} ส่งซ้ำ` };
  }
  const query = (params.get("query") ?? "").trim();
  if (query.length > MAX_QUERY) return { ok: false, message: `query ยาวเกิน ${MAX_QUERY} ตัวอักษร` };
  const rawLimit = params.get("limit") ?? String(DEFAULT_LIMIT);
  const limit = Number(rawLimit);
  if (!/^\d{1,3}$/.test(rawLimit) || limit < 1 || limit > MAX_LIMIT) {
    return { ok: false, message: `limit ต้องเป็นจำนวนเต็ม 1–${MAX_LIMIT}` };
  }
  const cursor = params.get("cursor");
  const after = cursor ? decodeCursor(cursor) : null;
  if (cursor && !after) return { ok: false, message: "cursor ไม่ถูกต้อง" };
  return { ok: true, pattern: query ? likePattern(query) : null, limit, after };
}

/** One page of the workspace's projects, newest edit first; one more is asked for to know whether a page follows. */
export async function findProjects(
  binding: BindingRow & { user_id: string },
  q: { project: string | null; pattern: string | null; after: After | null; limit: number }
): Promise<{ items: ProjectItem[]; nextCursor: string | null }> {
  const { data, error } = await createAdminClient().rpc("fittbuilder_fittvoice_projects", {
    p_org: binding.org_id,
    p_user: binding.user_id,
    p_project: q.project,
    p_pattern: q.pattern,
    p_after_at: q.after?.at ?? null,
    p_after_id: q.after?.id ?? null,
    p_limit: q.limit + 1,
  });
  if (error) throw new Error(`project search: ${error.message}`);
  const rows = data as unknown as (ProjectItem & { cursorAt: string })[];
  const page = rows.slice(0, q.limit);
  const last = page[page.length - 1];
  return {
    items: page.map(({ cursorAt: _cursor, ...item }) => {
      void _cursor;
      return item;
    }),
    nextCursor: rows.length > q.limit && last ? encodeCursor({ at: last.cursorAt, id: last.builderProjectId }) : null,
  };
}

type Sender = { ok: true; binding: BindingRow & { user_id: string }; fail: Fail } | { ok: false; response: Response };
type Fail = (code: ErrorCode, message: string, headers?: HeadersInit) => Response;

/**
 * Who is asking, for both routes: a person's live connection, still in the
 * workspace, within the read rate. A service credential has no person whose
 * rights could be judged, so it is refused.
 */
export async function sender(request: Request, route: string): Promise<Sender> {
  const requestId = randomUUID();
  const fail: Fail = (code, message, headers) => {
    console.info(`[fittvoice] ${requestId} ${route} ${code}`);
    return Response.json(errorBody(code, message, requestId, null, "v2"), {
      status: HTTP_STATUS[code],
      headers: { "Cache-Control": "no-store", ...headers },
    });
  };
  const auth = await authenticate(request.headers.get("authorization"));
  if (!auth.ok) return { ok: false, response: fail(auth.code, auth.message) };
  const { binding } = auth;
  if (!binding.user_id) {
    return { ok: false, response: fail("FORBIDDEN", "ใช้ได้เฉพาะการเชื่อมบัญชีรายผู้ใช้ ไม่รับ service credential") };
  }
  if (!auth.role) {
    return {
      ok: false,
      response: fail("FORBIDDEN", "ผู้ใช้ที่เชื่อมบัญชีไม่ได้อยู่ใน workspace นี้แล้ว ให้ผู้ใช้เชื่อมใหม่กับ workspace ที่มีสิทธิ์"),
    };
  }
  const limit = await rateLimit(`fittvoice-read:${binding.id}`, READS_PER_MINUTE, 60_000);
  if (!limit.ok) {
    return {
      ok: false,
      response: fail("RATE_LIMITED", `เกิน ${READS_PER_MINUTE} ครั้งต่อนาที ลองใหม่หลัง Retry-After`, {
        "Retry-After": String(limit.retryAfter),
      }),
    };
  }
  return { ok: true, binding: { ...binding, user_id: binding.user_id }, fail };
}
