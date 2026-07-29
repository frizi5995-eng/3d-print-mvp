import "server-only";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { claimRequestsForAuthenticatedUser } from "@/lib/auth/claim-requests";

/**
 * Supabase email-confirmation / magic-link / password-recovery callback
 * (standard Supabase SSR "Confirm" route pattern for Next.js App Router —
 * verifyOtp against the token_hash Supabase put in the confirmation email).
 *
 * The Supabase project's email templates must point their confirmation
 * links at `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/account`
 * (configured in the Supabase Dashboard, not this repo) with Site URL set
 * to https://3d-print-mvp.vercel.app for production.
 *
 * This is the first point at which an email-confirmation signup becomes an
 * authenticated, CONFIRMED session — so it's also where guest requests get
 * claimed for that flow (register/actions.ts only claims when a session
 * came back immediately, i.e. confirmation disabled).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/account";

  if (tokenHash && type) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });

    if (!error && data.user) {
      await claimRequestsForAuthenticatedUser(data.user);
      redirect(next);
    }
  }

  redirect("/login?error=confirmation_failed");
}
