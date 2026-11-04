import { UUID, findProjects, sender } from "@/lib/fittvoice/projects";

/**
 * One project, as the search lists it — FITT Voice checks canWrite here when the
 * user presses send and on every retry (contract v2.1, 2.2). A project that does
 * not exist, was deleted, or is outside the connected workspace is one answer:
 * 404 PROJECT_NOT_FOUND.
 */
export async function GET(request: Request, ctx: { params: Promise<{ builderProjectId: string }> }) {
  const who = await sender(request, "project");
  if (!who.ok) return who.response;
  const { builderProjectId } = await ctx.params;
  const notFound = () => who.fail("PROJECT_NOT_FOUND", "ไม่พบโปรเจกต์นี้ใน workspace ที่เชื่อม");
  if (!UUID.test(builderProjectId)) return notFound();
  try {
    const { items } = await findProjects(who.binding, { project: builderProjectId, pattern: null, after: null, limit: 1 });
    return items[0] ? Response.json(items[0], { headers: { "Cache-Control": "no-store" } }) : notFound();
  } catch (e) {
    console.error(`[fittvoice] project lookup failed: ${(e as Error).message}`);
    return who.fail("TEMPORARILY_UNAVAILABLE", "ระบบไม่พร้อมชั่วคราว ลองใหม่ได้");
  }
}
