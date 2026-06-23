import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";

/**
 * Service-role Supabase client — bypasses RLS. SERVER-ONLY: only import from API
 * routes that have already verified the caller is an admin (isAdminEmail). Never
 * import this from a client component.
 */
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
