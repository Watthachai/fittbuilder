import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "./admin";

/** Returns the authenticated user iff they are an admin, else null. Server-only. */
export async function getAdminUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user && isAdminEmail(user.email) ? user : null;
}
