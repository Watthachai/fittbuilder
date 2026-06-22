import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/db/types";

// Single shared browser client. createBrowserClient() called per-component would
// spin up multiple GoTrueClient instances that race over the session (one
// refreshing while another emits SIGNED_OUT), which flickers auth-dependent UI.
let client: ReturnType<typeof createBrowserClient<Database>> | undefined;

export function createClient() {
  if (!client) {
    client = createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return client;
}
