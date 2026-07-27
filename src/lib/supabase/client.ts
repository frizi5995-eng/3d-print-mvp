import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser client using the public anon key. RLS is enabled with no
 * policies on every app table, so this client cannot read or write
 * application data directly — it exists only for operations Supabase
 * explicitly designs for the browser, like uploading to a pre-signed
 * storage URL.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
