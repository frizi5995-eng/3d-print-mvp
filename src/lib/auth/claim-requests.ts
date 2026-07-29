import "server-only";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Associates unclaimed anonymous requests with a newly authenticated user.
 * Safe by construction:
 * - email comes from the verified Supabase Auth session, never client input
 * - only rows with customer_user_id IS NULL are touched, so an already-owned
 *   request (this user's or anyone else's) can never be reassigned
 * - idempotent: safe to call on every login, not just the first one
 */
export async function claimRequestsForUser(userId: string, email: string): Promise<void> {
  const supabase = createServiceClient();
  await supabase
    .from("manufacturing_requests")
    .update({ customer_user_id: userId })
    .is("customer_user_id", null)
    .ilike("customer_email", email);
}
