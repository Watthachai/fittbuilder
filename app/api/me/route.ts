import { getAdminUser } from "@/lib/admin-server";

/** Lightweight client hint: is the current user an admin? (Real gating stays server-side.) */
export async function GET() {
  const user = await getAdminUser();
  return Response.json({ isAdmin: Boolean(user) });
}
