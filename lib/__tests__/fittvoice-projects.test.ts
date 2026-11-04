import { beforeEach, describe, expect, it, vi } from "vitest";
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import errorSchema from "../fittvoice/schemas/error-v2.schema.json";
import { decodeCursor, encodeCursor, likePattern } from "../fittvoice/projects";

/**
 * GET /projects and /projects/{id} (contract v2.1, 2.2): who may ask, what the
 * query becomes, and how the database's rows become a page. Which projects a
 * person may read and write is the database's (fittbuilder_fittvoice_projects),
 * checked against Postgres; here its rows are given.
 */

type Binding = { id: string; org_id: string; user_id: string | null; client_id: string | null; created_at: string; last_used_at: string | null };
const PERSON: Binding = { id: "binding_c", org_id: "org_1", user_id: "user_1", client_id: "fittvoice-sandbox", created_at: "2026-10-01T00:00:00Z", last_used_at: new Date().toISOString() };
const binding = { data: PERSON as Binding | null };
const role = { value: "MEMBER" as string | null };
vi.mock("@/lib/fittvoice/connection-store", () => ({
  findBinding: async () => binding.data,
  roleOf: async () => role.value,
  touchBinding: async () => undefined,
}));
const rpc = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc }) }));
const limit = { ok: true, retryAfter: 0 };
vi.mock("@/lib/rate-limit", () => ({ rateLimit: async () => limit }));

const search = (await import("../../app/v1/integrations/fittvoice/projects/route")).GET;
const one = (await import("../../app/v1/integrations/fittvoice/projects/[builderProjectId]/route")).GET;

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validError = ajv.compile(errorSchema);

const get = (query = "", auth = "Bearer fvc_test") =>
  search(new Request(`http://builder.test/v1/integrations/fittvoice/projects${query}`, { headers: { authorization: auth } }));
const getOne = (id: string) =>
  one(new Request(`http://builder.test/v1/integrations/fittvoice/projects/${id}`, { headers: { authorization: "Bearer fvc_test" } }), {
    params: Promise.resolve({ builderProjectId: id }),
  });

const PROJECT_ID = "6c1f3a52-2d1f-4c55-9b55-0f6a8e7b1c11";
const row = (id: string, at: string) => ({
  builderProjectId: id,
  name: "ระบบจัดซื้อ — บริษัทตัวอย่าง",
  workspaceId: "org_1",
  canWrite: true,
  updatedAt: at.replace(/\.\d+/, "").replace("+00:00", "Z"),
  meetingCount: 2,
  cursorAt: at,
});

beforeEach(() => {
  binding.data = PERSON;
  role.value = "MEMBER";
  limit.ok = true;
  rpc.mockReset();
});

describe("who may look", () => {
  it("refuses a service credential and a person who left, in error v2", async () => {
    binding.data = { ...PERSON, user_id: null, client_id: null };
    let res = await get();
    expect(res.status).toBe(403);
    expect(validError(await res.json())).toBe(true);

    binding.data = PERSON;
    role.value = null;
    res = await get();
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ schemaVersion: "fittbuilder.error.v2", code: "FORBIDDEN" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("answers 401 in error v2 to an unknown token", async () => {
    binding.data = null;
    const res = await get();
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ schemaVersion: "fittbuilder.error.v2", code: "UNAUTHORIZED" });
  });
});

describe("GET /projects", () => {
  it("asks the database for the connection's workspace and person, one row more than the page", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    const res = await get("?query=50%25_off&limit=5");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ items: [], nextCursor: null });
    expect(rpc).toHaveBeenCalledWith("fittbuilder_fittvoice_projects", {
      p_org: "org_1",
      p_user: "user_1",
      p_project: null,
      p_pattern: "%50\\%\\_off%",
      p_after_at: null,
      p_after_id: null,
      p_limit: 6,
    });
  });

  it("lists everything, twenty at a time, when the query is empty", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    await get();
    expect(rpc).toHaveBeenCalledWith("fittbuilder_fittvoice_projects", expect.objectContaining({ p_pattern: null, p_limit: 21 }));
  });

  it("pages by the last item's exact time and id, and the cursor carries them back", async () => {
    const rows = [
      row(PROJECT_ID, "2026-11-04T03:00:00.123456+00:00"),
      row("7d2e4b63-3e2f-4d66-8c66-1a7b9f8c2d22", "2026-11-03T03:00:00.5+00:00"),
    ];
    rpc.mockResolvedValue({ data: rows, error: null });
    const page = await (await get("?limit=1")).json();
    expect(page.items).toEqual([
      {
        builderProjectId: PROJECT_ID,
        name: "ระบบจัดซื้อ — บริษัทตัวอย่าง",
        workspaceId: "org_1",
        canWrite: true,
        updatedAt: "2026-11-04T03:00:00Z",
        meetingCount: 2,
      },
    ]);
    expect(decodeCursor(page.nextCursor)).toEqual({ at: "2026-11-04T03:00:00.123456+00:00", id: PROJECT_ID });

    rpc.mockResolvedValue({ data: [], error: null });
    await get(`?limit=1&cursor=${page.nextCursor}`);
    expect(rpc).toHaveBeenLastCalledWith(
      "fittbuilder_fittvoice_projects",
      expect.objectContaining({ p_after_at: "2026-11-04T03:00:00.123456+00:00", p_after_id: PROJECT_ID })
    );
  });

  it("refuses a limit outside 1–50, a cursor it did not write, and a repeated parameter", async () => {
    for (const q of ["?limit=0", "?limit=51", "?limit=2.5", "?cursor=bm9wZQ", "?query=a&query=b"]) {
      const res = await get(q);
      expect(res.status, q).toBe(422);
      expect(await res.json(), q).toMatchObject({ schemaVersion: "fittbuilder.error.v2", code: "INVALID_PAYLOAD" });
    }
    expect(rpc).not.toHaveBeenCalled();
  });

  it("answers 503, retryable, when the database cannot be reached", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "timeout" } });
    const res = await get();
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ code: "TEMPORARILY_UNAVAILABLE", retryable: true });
  });
});

describe("GET /projects/{id}", () => {
  it("answers the one project as the search lists it", async () => {
    rpc.mockResolvedValue({ data: [row(PROJECT_ID, "2026-11-04T03:00:00+00:00")], error: null });
    const res = await getOne(PROJECT_ID);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ builderProjectId: PROJECT_ID, canWrite: true });
    expect(rpc).toHaveBeenCalledWith("fittbuilder_fittvoice_projects", expect.objectContaining({ p_project: PROJECT_ID }));
  });

  it("answers 404 PROJECT_NOT_FOUND for no such project, or an id that is not one", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    for (const id of [PROJECT_ID, "prj_123"]) {
      const res = await getOne(id);
      expect(res.status, id).toBe(404);
      expect(await res.json(), id).toMatchObject({ schemaVersion: "fittbuilder.error.v2", code: "PROJECT_NOT_FOUND" });
    }
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});

describe("the query helpers", () => {
  it("takes % _ and \\ in a name literally", () => {
    expect(likePattern("a_b%c\\d")).toBe("%a\\_b\\%c\\\\d%");
  });

  it("reads back only the cursors it writes", () => {
    const after = { at: "2026-11-04T03:00:00.123456+00:00", id: PROJECT_ID };
    expect(decodeCursor(encodeCursor(after))).toEqual(after);
    expect(decodeCursor("not-a-cursor")).toBeNull();
    expect(decodeCursor(encodeCursor({ at: "yesterday", id: PROJECT_ID }))).toBeNull();
  });
});
