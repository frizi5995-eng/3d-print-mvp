"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdminUser } from "@/lib/auth/admin";
import { createServiceClient } from "@/lib/supabase/server";
import { getAppUrl } from "@/lib/env";
import { sendQuoteReadyEmail } from "@/lib/email/quote-ready";
import { logAdminActivity } from "@/lib/admin/activity-log";
import { getSettings } from "@/lib/admin/settings";
import { isTransitionAllowed, isManufacturingBlockedByPayment, isPaymentGatedTransition } from "@/lib/workflow/gating";
import type { RequestStatus } from "@/types";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

export interface PricingFormState {
  status: "idle" | "success" | "error";
  error?: string;
}

const pricingSchema = z.object({
  requestId: z.uuid(),
  manufacturerName: z.string().max(120).optional(),
  productionCost: z.string().optional(),
  productionShippingCost: z.string().optional(),
  otherCost: z.string().optional(),
  customerManufacturingPrice: z.string().optional(),
  customerShippingPrice: z.string().optional(),
});

function parseMoney(raw: string | undefined): { value: number | null } | { error: true } {
  if (!raw || raw.trim() === "") return { value: null };
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return { error: true };
  return { value: Math.round(n * 100) / 100 };
}

const MONEY_FIELDS = [
  ["productionCost", "production_cost"],
  ["productionShippingCost", "production_shipping_cost"],
  ["otherCost", "other_cost"],
  ["customerManufacturingPrice", "customer_manufacturing_price"],
  ["customerShippingPrice", "customer_shipping_price"],
] as const;

export async function updatePricing(
  _prevState: PricingFormState,
  formData: FormData
): Promise<PricingFormState> {
  const admin = await requireAdminUser();

  const parsed = pricingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { status: "error", error: "Invalid input." };
  }

  const update: Record<string, number | string | null> = {
    manufacturer_name: parsed.data.manufacturerName?.trim() || null,
  };

  for (const [formKey, dbKey] of MONEY_FIELDS) {
    const result = parseMoney(parsed.data[formKey]);
    if ("error" in result) {
      return { status: "error", error: "Enter valid, non-negative amounts." };
    }
    update[dbKey] = result.value;
  }

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("manufacturing_requests")
    .update(update)
    .eq("id", parsed.data.requestId);

  if (error) {
    return { status: "error", error: "Could not save changes. Please try again." };
  }

  await logAdminActivity(admin.email!, "pricing_changed", parsed.data.requestId);

  revalidatePath(`/admin/requests/${parsed.data.requestId}`);
  revalidatePath("/admin/requests");
  revalidatePath("/admin/dashboard");
  return { status: "success" };
}

/**
 * Atomic by construction: the UPDATE's WHERE clause re-checks the status
 * that was just read, so a concurrent change between the read and the
 * write causes this to affect zero rows (reported as a normal "no longer
 * allowed" error) rather than silently clobbering a newer state.
 */
async function setStatusIfAllowed(
  requestId: string,
  next: RequestStatus,
  allowedFrom: RequestStatus[],
  adminEmail: string
): Promise<ActionResult> {
  const supabase = createServiceClient();
  const { data: request } = await supabase
    .from("manufacturing_requests")
    .select("status")
    .eq("id", requestId)
    .maybeSingle();

  if (!request) return { ok: false, error: "Request not found." };
  const currentStatus = request.status as RequestStatus;
  if (!allowedFrom.includes(currentStatus)) {
    return { ok: false, error: "This request is no longer in a status that allows that action." };
  }

  const { data: updated, error } = await supabase
    .from("manufacturing_requests")
    .update({ status: next })
    .eq("id", requestId)
    .eq("status", currentStatus)
    .select("id");

  if (error) return { ok: false, error: "Could not update status. Please try again." };
  if (!updated || updated.length === 0) {
    return { ok: false, error: "This request changed status just now. Please refresh and try again." };
  }

  await logAdminActivity(adminEmail, "status_changed", requestId, { from: currentStatus, to: next });

  revalidatePath(`/admin/requests/${requestId}`);
  revalidatePath("/admin/requests");
  revalidatePath("/admin/dashboard");
  return { ok: true };
}

export async function markChecking(requestId: string): Promise<ActionResult> {
  const admin = await requireAdminUser();
  return setStatusIfAllowed(requestId, "checking", ["new"], admin.email!);
}

export async function markWaitingForPartner(requestId: string): Promise<ActionResult> {
  const admin = await requireAdminUser();
  return setStatusIfAllowed(requestId, "waiting_for_partner", ["new", "checking"], admin.email!);
}

export async function changeRequestStatus(
  requestId: string,
  next: RequestStatus
): Promise<ActionResult> {
  const admin = await requireAdminUser();
  const supabase = createServiceClient();

  const { data: request } = await supabase
    .from("manufacturing_requests")
    .select("status, payment_status, production_started_at, actual_completion_at")
    .eq("id", requestId)
    .maybeSingle();

  if (!request) return { ok: false, error: "Request not found." };
  const currentStatus = request.status as RequestStatus;
  if (!isTransitionAllowed(currentStatus, next)) {
    return { ok: false, error: "That status change isn't allowed from the current status." };
  }

  // Payment is a separate fact from operational status (see migration
  // 0004_payments.sql) — manufacturing must never start on an unpaid order.
  // Only this one forward transition is gated; reverting manufacturing ->
  // accepted doesn't need to re-check payment.
  if (isManufacturingBlockedByPayment(currentStatus, next, request.payment_status)) {
    return {
      ok: false,
      error: "This request hasn't been paid yet. Manufacturing can't start until payment is confirmed.",
    };
  }

  const update: Record<string, string> = { status: next };
  // Record actual timestamps only when the real transition happens — never
  // backfilled/guessed, and never overwritten if already set (e.g. a
  // manufacturing -> accepted -> manufacturing correction keeps the
  // original start time).
  if (next === "manufacturing" && !request.production_started_at) {
    update.production_started_at = new Date().toISOString();
  }
  if (next === "completed" && !request.actual_completion_at) {
    update.actual_completion_at = new Date().toISOString();
  }

  let query = supabase
    .from("manufacturing_requests")
    .update(update)
    .eq("id", requestId)
    .eq("status", currentStatus);
  // Re-check payment_status in the same atomic write for this one gated
  // transition, closing the window between the read above and this update
  // (e.g. a refund webhook landing in between).
  if (isPaymentGatedTransition(currentStatus, next)) {
    query = query.eq("payment_status", "paid");
  }
  const { data: updated, error } = await query.select("id");

  if (error) return { ok: false, error: "Could not update status. Please try again." };
  if (!updated || updated.length === 0) {
    return {
      ok: false,
      error: isPaymentGatedTransition(currentStatus, next)
        ? "Payment is no longer confirmed for this request. Please refresh and check payment status."
        : "This request changed status just now. Please refresh and try again.",
    };
  }

  await logAdminActivity(admin.email!, "status_changed", requestId, { from: currentStatus, to: next });

  revalidatePath(`/admin/requests/${requestId}`);
  revalidatePath("/admin/requests");
  revalidatePath("/admin/dashboard");
  return { ok: true };
}

export async function prepareQuote(requestId: string): Promise<ActionResult> {
  const admin = await requireAdminUser();

  const supabase = createServiceClient();
  const { data: request } = await supabase
    .from("manufacturing_requests")
    .select(
      "status, reference_number, customer_manufacturing_price, customer_shipping_price, customer_name, customer_email, country, postal_code, quote_token, quote_expires_at"
    )
    .eq("id", requestId)
    .maybeSingle();

  if (!request) return { ok: false, error: "Request not found." };

  if (!["new", "checking", "waiting_for_partner"].includes(request.status)) {
    return { ok: false, error: "This request can't move to quote-ready from its current status." };
  }
  if (request.customer_manufacturing_price === null || request.customer_shipping_price === null) {
    return { ok: false, error: "Set a customer manufacturing price and shipping price first." };
  }
  if (!request.customer_name || !request.customer_email || !request.country || !request.postal_code) {
    return { ok: false, error: "Customer details are incomplete." };
  }

  const settings = await getSettings();
  const update: Record<string, string> = { status: "quote_ready" };

  if (!request.quote_token) {
    update.quote_token = randomBytes(32).toString("base64url");
    const expires = new Date();
    expires.setDate(expires.getDate() + settings.quoteValidityDays);
    update.quote_expires_at = expires.toISOString();
  }

  const { error } = await supabase
    .from("manufacturing_requests")
    .update(update)
    .eq("id", requestId);

  if (error) return { ok: false, error: "Could not prepare the quote. Please try again." };

  await logAdminActivity(admin.email!, "quote_prepared", requestId);

  revalidatePath(`/admin/requests/${requestId}`);
  revalidatePath("/admin/requests");
  revalidatePath("/admin/dashboard");

  const finalToken = update.quote_token ?? request.quote_token!;
  const finalExpiresAt = update.quote_expires_at ?? request.quote_expires_at!;

  // Best-effort only — email delivery never blocks or fails this action.
  // "Copy quote link" on this page always works regardless of the outcome.
  const emailResult = await sendQuoteReadyEmail({
    customerName: request.customer_name,
    customerEmail: request.customer_email,
    referenceNumber: request.reference_number,
    total: request.customer_manufacturing_price + request.customer_shipping_price,
    expiresAt: finalExpiresAt,
    quoteUrl: `${getAppUrl()}/q/${finalToken}`,
    supportEmail: settings.supportEmail,
    companyDisplayName: settings.companyDisplayName,
  }).catch((err: unknown): { sent: false; reason: "error"; message: string } => ({
    sent: false,
    reason: "error",
    message: err instanceof Error ? err.message : "unexpected",
  }));

  if (!emailResult.sent && emailResult.reason === "error") {
    // Server-side only — never surfaced to the client. Useful once a real
    // key is configured and a send genuinely fails (bad domain, rate limit).
    console.error(`Quote email failed for request ${requestId}:`, emailResult.message);
  }

  return {
    ok: true,
    message: emailResult.sent
      ? "Quote prepared and emailed to the customer."
      : emailResult.reason === "not_configured"
        ? "Quote prepared. Email not sent (not configured yet) — copy the link below."
        : "Quote prepared, but the email failed to send. Copy the link below.",
  };
}

export async function resendQuoteEmail(requestId: string): Promise<ActionResult> {
  const admin = await requireAdminUser();
  const supabase = createServiceClient();

  const { data: request } = await supabase
    .from("manufacturing_requests")
    .select(
      "status, reference_number, customer_name, customer_email, customer_manufacturing_price, customer_shipping_price, quote_token, quote_expires_at"
    )
    .eq("id", requestId)
    .maybeSingle();

  if (!request) return { ok: false, error: "Request not found." };
  if (!["quote_ready", "quote_sent"].includes(request.status)) {
    return { ok: false, error: "This request doesn't have an active quote to resend." };
  }
  if (!request.quote_token || !request.quote_expires_at) {
    return { ok: false, error: "No quote link exists yet. Prepare a quote first." };
  }
  if (request.customer_manufacturing_price === null || request.customer_shipping_price === null) {
    return { ok: false, error: "Customer pricing is missing." };
  }

  const settings = await getSettings();
  const emailResult = await sendQuoteReadyEmail({
    customerName: request.customer_name,
    customerEmail: request.customer_email,
    referenceNumber: request.reference_number,
    total: request.customer_manufacturing_price + request.customer_shipping_price,
    expiresAt: request.quote_expires_at,
    quoteUrl: `${getAppUrl()}/q/${request.quote_token}`,
    supportEmail: settings.supportEmail,
    companyDisplayName: settings.companyDisplayName,
  }).catch((err: unknown): { sent: false; reason: "error"; message: string } => ({
    sent: false,
    reason: "error",
    message: err instanceof Error ? err.message : "unexpected",
  }));

  if (!emailResult.sent) {
    if (emailResult.reason === "not_configured") {
      return { ok: false, error: "Email isn't configured yet. Use Copy quote link instead." };
    }
    console.error(`Resend quote email failed for request ${requestId}:`, emailResult.message);
    return { ok: false, error: "Could not send the email. Please try again." };
  }

  if (request.status === "quote_ready") {
    await supabase
      .from("manufacturing_requests")
      .update({ status: "quote_sent" })
      .eq("id", requestId)
      .eq("status", "quote_ready");
  }

  await logAdminActivity(admin.email!, "quote_resent", requestId);
  revalidatePath(`/admin/requests/${requestId}`);
  revalidatePath("/admin/requests");
  return { ok: true, message: "Quote email resent." };
}

export async function extendQuoteExpiry(requestId: string): Promise<ActionResult> {
  const admin = await requireAdminUser();
  const supabase = createServiceClient();

  const { data: request } = await supabase
    .from("manufacturing_requests")
    .select("status, quote_token")
    .eq("id", requestId)
    .maybeSingle();

  if (!request) return { ok: false, error: "Request not found." };
  if (!request.quote_token || !["quote_ready", "quote_sent"].includes(request.status)) {
    return { ok: false, error: "No active quote to extend." };
  }

  const { quoteValidityDays } = await getSettings();
  const newExpiry = new Date();
  newExpiry.setDate(newExpiry.getDate() + quoteValidityDays);

  const { error } = await supabase
    .from("manufacturing_requests")
    .update({ quote_expires_at: newExpiry.toISOString() })
    .eq("id", requestId);

  if (error) return { ok: false, error: "Could not extend the quote. Please try again." };

  await logAdminActivity(admin.email!, "quote_expiry_extended", requestId, {
    new_expiry: newExpiry.toISOString(),
  });
  revalidatePath(`/admin/requests/${requestId}`);
  return { ok: true, message: `Quote extended by ${quoteValidityDays} days.` };
}

export interface NotesFormState {
  status: "idle" | "success" | "error";
  error?: string;
}

const notesSchema = z.object({ requestId: z.uuid(), notes: z.string().max(5000).optional() });

export async function updateInternalNotes(
  _prevState: NotesFormState,
  formData: FormData
): Promise<NotesFormState> {
  const admin = await requireAdminUser();
  const parsed = notesSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", error: "Invalid input." };

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("manufacturing_requests")
    .update({ internal_notes: parsed.data.notes?.trim() || null })
    .eq("id", parsed.data.requestId);

  if (error) return { status: "error", error: "Could not save notes." };

  await logAdminActivity(admin.email!, "internal_note_updated", parsed.data.requestId);
  revalidatePath(`/admin/requests/${parsed.data.requestId}`);
  return { status: "success" };
}

export async function toggleTag(requestId: string, tag: string): Promise<ActionResult> {
  const admin = await requireAdminUser();
  const supabase = createServiceClient();

  const { data: request } = await supabase
    .from("manufacturing_requests")
    .select("tags")
    .eq("id", requestId)
    .maybeSingle();

  if (!request) return { ok: false, error: "Request not found." };
  const current: string[] = request.tags ?? [];
  const next = current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag];

  const { error } = await supabase
    .from("manufacturing_requests")
    .update({ tags: next })
    .eq("id", requestId);

  if (error) return { ok: false, error: "Could not update tags." };

  await logAdminActivity(admin.email!, "tags_updated", requestId, { tags: next });
  revalidatePath(`/admin/requests/${requestId}`);
  return { ok: true };
}

export async function setSuspicious(
  requestId: string,
  isSuspicious: boolean,
  reason?: string
): Promise<ActionResult> {
  const admin = await requireAdminUser();
  const supabase = createServiceClient();

  const { error } = await supabase
    .from("manufacturing_requests")
    .update({
      is_suspicious: isSuspicious,
      spam_reason: isSuspicious ? reason?.trim() || null : null,
    })
    .eq("id", requestId);

  if (error) return { ok: false, error: "Could not update." };

  await logAdminActivity(admin.email!, "flagged_suspicious", requestId, { isSuspicious, reason });
  revalidatePath(`/admin/requests/${requestId}`);
  revalidatePath("/admin/requests");
  revalidatePath("/admin/dashboard");
  return { ok: true, message: isSuspicious ? "Flagged as suspicious." : "Suspicious flag removed." };
}
