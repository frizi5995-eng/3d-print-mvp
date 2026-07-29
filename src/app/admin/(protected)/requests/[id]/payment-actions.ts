"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdminUser } from "@/lib/auth/admin";
import { createServiceClient } from "@/lib/supabase/server";
import { createInvoiceForRequest, resendInvoiceEmail } from "@/lib/stripe/invoicing";
import { logAdminActivity } from "@/lib/admin/activity-log";
import type { ActionResult } from "./actions";

const CREATE_INVOICE_ERROR_MESSAGES: Record<string, string> = {
  not_configured: "Stripe isn't configured yet. Add STRIPE_SECRET_KEY to enable invoicing.",
  already_exists: "An invoice already exists for this request.",
  not_eligible: "This request isn't eligible for an invoice yet.",
  error: "Could not create the invoice. Please try again.",
};

export async function createInvoiceAction(requestId: string): Promise<ActionResult> {
  const admin = await requireAdminUser();

  const result = await createInvoiceForRequest(requestId);
  if (!result.created) {
    return {
      ok: false,
      error: result.message ?? CREATE_INVOICE_ERROR_MESSAGES[result.reason],
    };
  }

  await logAdminActivity(admin.email!, "invoice_created", requestId, {
    stripe_invoice_id: result.invoiceId,
  });

  revalidatePath(`/admin/requests/${requestId}`);
  revalidatePath("/admin/requests");
  return { ok: true, message: "Invoice created and sent." };
}

const RESEND_INVOICE_ERROR_MESSAGES: Record<string, string> = {
  not_configured: "Stripe isn't configured yet.",
  not_eligible: "This invoice can no longer be resent (already paid, voided, or a draft).",
  error: "Could not resend the invoice. Please try again.",
};

export async function resendInvoiceAction(requestId: string): Promise<ActionResult> {
  const admin = await requireAdminUser();
  const supabase = createServiceClient();

  const { data: request } = await supabase
    .from("manufacturing_requests")
    .select("stripe_invoice_id")
    .eq("id", requestId)
    .maybeSingle();

  if (!request?.stripe_invoice_id) {
    return { ok: false, error: "No invoice exists for this request yet." };
  }

  const result = await resendInvoiceEmail(request.stripe_invoice_id);
  if (!result.sent) {
    return { ok: false, error: result.message ?? RESEND_INVOICE_ERROR_MESSAGES[result.reason] };
  }

  await logAdminActivity(admin.email!, "invoice_resend_requested", requestId, {
    stripe_invoice_id: request.stripe_invoice_id,
  });

  revalidatePath(`/admin/requests/${requestId}`);
  return { ok: true, message: "Invoice email resent." };
}

const markPaidSchema = z.object({
  requestId: z.uuid(),
  note: z.string().trim().min(1, "A reason is required.").max(1000),
});

export interface MarkPaidFormState {
  status: "idle" | "success" | "error";
  error?: string;
}

/**
 * Explicit, audited manual override for offline/manual payment (bank
 * transfer, cash, etc.) — deliberately NOT a silent status flip. Requires a
 * non-empty reason, which is stored in the audit log alongside the admin
 * who did it. This is the only way payment_status becomes "paid" without a
 * Stripe webhook.
 */
export async function markPaymentPaidManually(
  _prevState: MarkPaidFormState,
  formData: FormData
): Promise<MarkPaidFormState> {
  const admin = await requireAdminUser();
  const parsed = markPaidSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { status: "error", error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = createServiceClient();
  const { data: updated, error } = await supabase
    .from("manufacturing_requests")
    .update({ payment_status: "paid", paid_at: new Date().toISOString() })
    .eq("id", parsed.data.requestId)
    .neq("payment_status", "paid")
    .select("id")
    .maybeSingle();

  if (error) return { status: "error", error: "Could not update payment status." };
  if (!updated) return { status: "error", error: "This request is already marked paid." };

  await logAdminActivity(admin.email!, "payment_marked_paid_manually", parsed.data.requestId, {
    note: parsed.data.note,
  });

  revalidatePath(`/admin/requests/${parsed.data.requestId}`);
  revalidatePath("/admin/requests");
  return { status: "success" };
}
