"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { DECLINE_REASON_LABELS } from "@/lib/constants";

/**
 * A quote can only be actioned while it's actively awaiting a customer
 * decision. The UPDATE's WHERE clause (status + not-expired) is the guard —
 * Postgres serializes concurrent writes to the same row, so this is
 * atomically race-safe with no explicit transaction needed. Whichever
 * request "wins" is the only one that changes any rows; the loser (a
 * double-click, or a second tab) affects zero rows and just redirects back
 * to see the now-current state.
 */
const ACTIONABLE_STATUSES = ["quote_ready", "quote_sent"];

export async function acceptQuote(token: string): Promise<void> {
  const supabase = createServiceClient();
  await supabase
    .from("manufacturing_requests")
    .update({ status: "accepted" })
    .eq("quote_token", token)
    .in("status", ACTIONABLE_STATUSES)
    .gt("quote_expires_at", new Date().toISOString());

  redirect(`/q/${token}`);
}

const declineSchema = z.object({
  reason: z.enum(Object.keys(DECLINE_REASON_LABELS) as [string, ...string[]]).optional(),
  reasonOther: z.string().max(500).optional(),
});

export async function declineQuote(token: string, formData: FormData): Promise<void> {
  const parsed = declineSchema.safeParse(Object.fromEntries(formData));
  const reason = parsed.success ? (parsed.data.reason ?? null) : null;
  const reasonOther =
    parsed.success && reason === "other" ? parsed.data.reasonOther?.trim() || null : null;

  const supabase = createServiceClient();
  await supabase
    .from("manufacturing_requests")
    .update({
      status: "declined",
      decline_reason: reason,
      decline_reason_other: reasonOther,
    })
    .eq("quote_token", token)
    .in("status", ACTIONABLE_STATUSES)
    .gt("quote_expires_at", new Date().toISOString());

  redirect(`/q/${token}`);
}
