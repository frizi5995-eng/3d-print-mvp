import "server-only";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { claimRequestsForAuthenticatedUser } from "@/lib/auth/claim-requests";
import { sanitizeNextPath } from "@/lib/auth/safe-redirect";

/**
 * OAuth callback (Google, via Supabase Auth) — standard Supabase SSR
 * "Confirm"/callback pattern for Next.js App Router:
 * exchangeCodeForSession() turns the ?code= param into a session cookie.
 *
 * Flow: browser -> supabase.auth.signInWithOAuth({provider:"google",
 * redirectTo: `${origin}/auth/callback?next=...`}) -> Google -> Supabase's
 * own /auth/v1/callback -> here, with ?code=.
 *
 * Same safety posture as /auth/confirm: claim only ever runs through
 * claimRequestsForAuthenticatedUser(user), which itself re-checks
 * user.email_confirmed_at — never trusted from a query param or claimed
 * just because a session now exists. Google identities Supabase considers
 * verified have email_confirmed_at set automatically.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = sanitizeNextPath(searchParams.get("next"));

  if (!code) {
    redirect("/login?error=oauth_failed");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    redirect("/login?error=oauth_failed");
  }

  await claimRequestsForAuthenticatedUser(data.user);
  redirect(next);
}
