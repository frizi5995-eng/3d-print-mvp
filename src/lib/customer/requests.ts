import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import type { PaymentStatus, RequestStatus } from "@/types";

const PAGE_SIZE = 20;

export const ACCOUNT_STATUS_FILTERS: Record<string, RequestStatus[] | null> = {
  all: null,
  open: ["new", "checking", "waiting_for_partner"],
  quote_ready: ["quote_ready", "quote_sent"],
  accepted: ["accepted"],
  manufacturing: ["manufacturing"],
  shipped: ["shipped"],
  completed: ["completed"],
  declined: ["declined"],
};

export const ACCOUNT_STATUS_FILTER_LABELS: Record<string, string> = {
  all: "All",
  open: "Open",
  quote_ready: "Quote ready",
  accepted: "Accepted",
  manufacturing: "Manufacturing",
  shipped: "Shipped",
  completed: "Completed",
  declined: "Declined",
};

function unwrapOne<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

/**
 * Every query here is scoped by customer_user_id, server-side, taken from
 * the verified session (see src/lib/auth/customer.ts) — never from a URL,
 * form field, or client-supplied id. This is the only thing preventing one
 * customer from seeing another's requests.
 */
export async function listMyRequests({
  userId,
  filter = "all",
  page = 1,
}: {
  userId: string;
  filter?: string;
  page?: number;
}) {
  const supabase = createServiceClient();
  const statuses = ACCOUNT_STATUS_FILTERS[filter] ?? null;

  let query = supabase
    .from("manufacturing_requests")
    .select(
      "id, reference_number, status, created_at, updated_at, customer_manufacturing_price, customer_shipping_price, quote_token, quote_expires_at, models(filename)",
      { count: "exact" }
    )
    .eq("customer_user_id", userId)
    .order("created_at", { ascending: false });

  if (statuses) {
    query = query.in("status", statuses);
  }

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const { data, count } = await query.range(from, to);

  return {
    rows: (data ?? []).map((row) => ({
      id: row.id as string,
      reference_number: row.reference_number as number,
      status: row.status as RequestStatus,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
      customer_manufacturing_price: row.customer_manufacturing_price as number | null,
      customer_shipping_price: row.customer_shipping_price as number | null,
      quote_token: row.quote_token as string | null,
      quote_expires_at: row.quote_expires_at as string | null,
      model: unwrapOne(row.models as { filename: string } | { filename: string }[] | null),
    })),
    total: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
  };
}

/**
 * Returns null both when the request doesn't exist AND when it belongs to
 * someone else — the caller (and therefore the URL) can never distinguish
 * the two, which is exactly what prevents leaking another customer's data.
 */
export async function getMyRequestById(userId: string, id: string) {
  const supabase = createServiceClient();

  const { data: request } = await supabase
    .from("manufacturing_requests")
    .select(
      "id, reference_number, status, quantity, material, color, desired_size, notes, customer_manufacturing_price, customer_shipping_price, quote_token, quote_expires_at, payment_status, stripe_invoice_id, paid_at, carrier, tracking_number, tracking_url, shipped_at, estimated_delivery_at, delivered_at, created_at, models(*)"
    )
    .eq("id", id)
    .eq("customer_user_id", userId)
    .maybeSingle();

  if (!request) return null;

  const { data: history } = await supabase
    .from("status_history")
    .select("*")
    .eq("request_id", id)
    .order("created_at", { ascending: true });

  const { models, ...requestFields } = request as Record<string, unknown> & { models: unknown };

  return {
    request: requestFields,
    model: unwrapOne(models as Record<string, unknown> | Record<string, unknown>[] | null),
    history: history ?? [],
  };
}

export interface DashboardCounts {
  active: number;
  quotesRequiringAction: number;
  awaitingPayment: number;
  manufacturing: number;
  shipped: number;
  completed: number;
}

/** Scoped by customer_user_id, same as every other query in this file. */
export async function getMyDashboardCounts(userId: string): Promise<DashboardCounts> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("manufacturing_requests")
    .select("status, payment_status")
    .eq("customer_user_id", userId);

  const rows = (data ?? []) as { status: RequestStatus; payment_status: PaymentStatus }[];

  return rows.reduce<DashboardCounts>(
    (acc, row) => {
      if (row.status !== "declined" && row.status !== "completed") acc.active += 1;
      if (row.status === "quote_ready" || row.status === "quote_sent") acc.quotesRequiringAction += 1;
      if (row.status === "accepted" && row.payment_status !== "paid") acc.awaitingPayment += 1;
      if (row.status === "manufacturing") acc.manufacturing += 1;
      if (row.status === "shipped") acc.shipped += 1;
      if (row.status === "completed") acc.completed += 1;
      return acc;
    },
    { active: 0, quotesRequiringAction: 0, awaitingPayment: 0, manufacturing: 0, shipped: 0, completed: 0 }
  );
}
