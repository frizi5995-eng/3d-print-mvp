import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import type { AdminActivityLogEntry } from "@/types";

const PAGE_SIZE = 30;

export const ACTIVITY_ACTIONS = [
  "status_changed",
  "pricing_changed",
  "quote_prepared",
  "quote_resent",
  "quote_expiry_extended",
  "internal_note_updated",
  "tags_updated",
  "flagged_suspicious",
  "settings_updated",
  "requests_exported",
  "invoice_created",
  "invoice_resend_requested",
  "payment_paid",
  "payment_failed",
  "payment_voided",
  "payment_refunded",
  "payment_marked_paid_manually",
  "supplier_created",
  "supplier_updated",
  "supplier_quote_added",
  "supplier_quote_updated",
  "supplier_quote_selected",
  "pricing_recommendation_applied",
  "production_info_updated",
  "shipping_info_updated",
] as const;

export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

export const ACTIVITY_ACTION_LABELS: Record<ActivityAction, string> = {
  status_changed: "Status changed",
  pricing_changed: "Pricing changed",
  quote_prepared: "Quote prepared",
  quote_resent: "Quote resent",
  quote_expiry_extended: "Quote expiry extended",
  internal_note_updated: "Internal note updated",
  tags_updated: "Tags updated",
  flagged_suspicious: "Spam flag changed",
  settings_updated: "Settings updated",
  requests_exported: "Requests exported (CSV)",
  invoice_created: "Invoice created",
  invoice_resend_requested: "Invoice resent",
  payment_paid: "Payment received",
  payment_failed: "Payment failed",
  payment_voided: "Invoice voided",
  payment_refunded: "Payment refunded",
  payment_marked_paid_manually: "Payment marked paid (manual override)",
  supplier_created: "Supplier created",
  supplier_updated: "Supplier updated",
  supplier_quote_added: "Supplier quote added",
  supplier_quote_updated: "Supplier quote updated",
  supplier_quote_selected: "Supplier quote selected",
  pricing_recommendation_applied: "Pricing recommendation applied",
  production_info_updated: "Production info updated",
  shipping_info_updated: "Shipping info updated",
};

/** Used for admin_activity_log entries written by the Stripe webhook, which has no signed-in admin. */
export const STRIPE_WEBHOOK_ACTOR = "system:stripe-webhook";

/** The fixed set of admin emails authorized to act — same allowlist auth uses, for the filter dropdown. */
export function adminEmailAllowlist(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export interface ListActivityParams {
  adminEmail?: string;
  action?: string;
  requestId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
}

export interface ActivityListRow extends AdminActivityLogEntry {
  request_reference_number: number | null;
}

export async function listActivityLog(params: ListActivityParams) {
  const { adminEmail, action, requestId, dateFrom, dateTo, page = 1 } = params;
  const supabase = createServiceClient();

  let query = supabase
    .from("admin_activity_log")
    .select("id, admin_email, action, request_id, metadata, created_at", { count: "exact" });

  if (adminEmail && adminEmail !== "all") query = query.eq("admin_email", adminEmail);
  if (action && action !== "all") query = query.eq("action", action);
  if (requestId) query = query.eq("request_id", requestId);
  if (dateFrom) query = query.gte("created_at", dateFrom);
  if (dateTo) query = query.lte("created_at", dateTo);

  query = query.order("created_at", { ascending: false });

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const { data, count } = await query.range(from, to);

  const rows = (data ?? []) as unknown as AdminActivityLogEntry[];

  const requestIds = Array.from(new Set(rows.map((r) => r.request_id).filter((id): id is string => !!id)));
  let refByRequestId = new Map<string, number>();
  if (requestIds.length) {
    const { data: refs } = await supabase
      .from("manufacturing_requests")
      .select("id, reference_number")
      .in("id", requestIds);
    refByRequestId = new Map((refs ?? []).map((r) => [r.id as string, r.reference_number as number]));
  }

  return {
    rows: rows.map((r) => ({
      ...r,
      request_reference_number: r.request_id ? (refByRequestId.get(r.request_id) ?? null) : null,
    })) as ActivityListRow[],
    total: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
  };
}
