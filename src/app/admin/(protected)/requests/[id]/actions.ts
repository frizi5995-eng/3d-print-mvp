"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdminUser } from "@/lib/auth/admin";
import { createServiceClient } from "@/lib/supabase/server";
import { getAppUrl } from "@/lib/env";
import { sendQuoteReadyEmail } from "@/lib/email/quote-ready";
import { logAdminActivity } from "@/lib/admin/activity-log";
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

/**
 * The post-acceptance operational workflow, plus one-step-back corrections
 * only (never an arbitrary jump) so status management stays predictable.
 * quote_ready/quote_sent are deliberately excluded — those go through
 * prepareQuote(), which does more than flip a status column.
 */
const WORKFLOW_TRANSITIONS: Partial<Record<RequestStatus, RequestStatus[]>> = {
  accepted: ["manufacturing"],
  manufacturing: ["shipped", "accepted"],
  shipped: ["completed", "manufacturing"],
  completed: ["shipped"],
};

export const NEXT_ACTION_LABELS: Partial<Record<RequestStatus, string>> = {
  accepted: "Start manufacturing",
  manufacturing: "Mark shipped",
  shipped: "Mark completed",
};

export async function changeRequestStatus(
  requestId: string,
  next: RequestStatus
): Promise<ActionResult> {
  const admin = await requireAdminUser();
  const supabase = createServiceClient();

  const { data: request } = await supabase
    .from("manufacturing_requests")
    .select("status")
    .eq("id", requestId)
    .maybeSingle();

  if (!request) return { ok: false, error: "Request not found." };
  const currentStatus = request.status as RequestStatus;
  const allowed = WORKFLOW_TRANSITIONS[currentStatus] ?? [];
  if (!allowed.includes(next)) {
    return { ok: false, error: "That status change isn't allowed from the current status." };
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

  await logAdminActivity(admin.email!, "status_changed", requestId, { from: currentStatus, to: next });

  revalidatePath(`/admin/requests/${requestId}`);
  revalidatePath("/admin/requests");
  revalidatePath("/admin/dashboard");
  return { ok: true };
}

const QUOTE_VALIDITY_DAYS = 7;

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

  const update: Record<string, string> = { status: "quote_ready" };

  if (!request.quote_token) {
    update.quote_token = randomBytes(32).toString("base64url");
    const expires = new Date();
    expires.setDate(expires.getDate() + QUOTE_VALIDITY_DAYS);
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
