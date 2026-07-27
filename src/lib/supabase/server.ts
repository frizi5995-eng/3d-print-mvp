import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only client using the service role key, which bypasses RLS.
 * Never import this from a client component — the `server-only` package
 * throws a build error if that happens. All reads/writes to
 * manufacturing_requests, models, and status_history go through here.
 */
export function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
