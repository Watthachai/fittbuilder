import { findProjects, readSearch, sender } from "@/lib/fittvoice/projects";

/**
 * Search the projects a FITT Voice user may send a meeting into: the connected
 * workspace's projects they may read, newest edit first, with canWrite
 * (contract v2.1, 2.2). `query` matches the name, ignoring case; empty lists all.
 */
export async function GET(request: Request) {
  const who = await sender(request, "projects");
  if (!who.ok) return who.response;
  const search = readSearch(new URL(request.url).searchParams);
  if (!search.ok) return who.fail("INVALID_PAYLOAD", search.message);
  try {
    const page = await findProjects(who.binding, { project: null, ...search });
    return Response.json(page, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error(`[fittvoice] project search failed: ${(e as Error).message}`);
    return who.fail("TEMPORARILY_UNAVAILABLE", "ระบบไม่พร้อมชั่วคราว ลองใหม่ได้");
  }
}
