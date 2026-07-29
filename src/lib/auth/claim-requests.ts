import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { canClaimGuestRequests } from "@/lib/auth/claim-eligibility";
import type { User } from "@supabase/supabase-js";

/**
 * The ONLY entry point for claiming guest requests. Takes the full
 * authenticated Supabase User object (not a userId+email pair) so a caller
 * can't accidentally skip the confirmation check by passing arbitrary
 * strings — email and confirmation status are read from the object
 * Supabase itself returned from getUser()/signUp()/signInWithPassword()/
 * verifyOtp(), never from client input.
 *
 * Safe by construction:
 * - refuses to run unless user.email_confirmed_at is set (see
 *   canClaimGuestRequests) — a session alone, or an unconfirmed signup,
 *   can never trigger a claim
 * - only rows with customer_user_id IS NULL are touched, so an already-owned
 *   request (this user's or anyone else's) can never be reassigned
 * - idempotent: safe to call on every login/confirmation, not just once
 */
export async function claimRequestsForAuthenticatedUser(user: User): Promise<void> {
  if (!canClaimGuestRequests(user)) return;

  const supabase = createServiceClient();
  await supabase
    .from("manufacturing_requests")
    .update({ customer_user_id: user.id })
    .is("customer_user_id", null)
    .ilike("customer_email", user.email);
}
