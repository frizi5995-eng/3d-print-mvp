import "server-only";
import { cookies } from "next/headers";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

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

/**
 * User-context client (anon key + the visitor's auth cookies), used only to
 * find out who is signed in for the admin login/allowlist check. Never used
 * for reading or writing app data — that always goes through
 * `createServiceClient()`, same as the rest of the app.
 *
 * There is no middleware refreshing the auth session on every request (see
 * README/limitations). If an access token needs refreshing during a plain
 * page render, cookies can't be written from there — the `setAll` below
 * swallows that case. Worst case: an admin is asked to sign in again a bit
 * sooner than the token's full lifetime.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component render, where cookies are
            // read-only. Safe to ignore — see doc comment above.
          }
        },
      },
    }
  );
}
